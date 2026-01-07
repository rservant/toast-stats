/**
 * Raw CSV Cache Service
 *
 * Core service responsible for caching raw CSV files downloaded from the Toastmasters dashboard.
 * Provides cache-first lookup with automatic fallback to direct downloads, organized file storage
 * by date and district, and comprehensive error handling to ensure reliability.
 *
 * Features:
 * - Cache-first lookup with graceful fallback
 * - Organized directory structure by date and district
 * - Comprehensive metadata tracking
 * - Security validation and path sanitization
 * - Performance monitoring and statistics
 * - Automatic cleanup and retention policies
 */

import { promises as fs } from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import {
  CSVType,
  RawCSVCacheMetadata,
  RawCSVCacheStatistics,
  CacheHealthStatus,
  RawCSVCacheConfig,
  DEFAULT_RAW_CSV_CACHE_CONFIG,
} from '../types/rawCSVCache.js'
import {
  IRawCSVCacheService,
  ILogger,
  ICacheConfigService,
} from '../types/serviceInterfaces.js'

/**
 * Raw CSV Cache Service Implementation
 */
export class RawCSVCacheService implements IRawCSVCacheService {
  private readonly config: RawCSVCacheConfig
  private readonly cacheDir: string
  private readonly logger: ILogger
  private readonly cacheConfigService: ICacheConfigService
  private slowOperations: Array<{
    operation: string
    duration: number
    timestamp: string
  }> = []

  // Circuit breaker state for error handling and recovery
  private circuitBreaker: {
    failures: number
    lastFailureTime: number
    isOpen: boolean
    halfOpenAttempts: number
  } = {
    failures: 0,
    lastFailureTime: 0,
    isOpen: false,
    halfOpenAttempts: 0,
  }

  // Circuit breaker configuration
  private readonly circuitBreakerConfig = {
    failureThreshold: 5, // Open circuit after 5 consecutive failures
    resetTimeoutMs: 60000, // Try to close circuit after 1 minute
    halfOpenMaxAttempts: 3, // Allow 3 attempts in half-open state
  }

  constructor(
    cacheConfigService: ICacheConfigService,
    logger: ILogger,
    config?: Partial<RawCSVCacheConfig>
  ) {
    this.cacheConfigService = cacheConfigService
    this.logger = logger
    this.config = { ...DEFAULT_RAW_CSV_CACHE_CONFIG, ...config }

    // Use the cache config service to get the base directory
    const baseDir = this.cacheConfigService.getCacheDirectory()
    this.cacheDir = path.join(baseDir, 'raw-csv')

    // Override config cache directory to use the resolved path
    this.config.cacheDir = this.cacheDir

    this.logger.info(
      'Raw CSV Cache Service initialized - CSV files are permanent artifacts',
      {
        cacheDir: this.cacheDir,
        enableCompression: this.config.enableCompression,
        storageSizeWarningMB: this.config.monitoring.storageSizeWarningMB,
      }
    )
  }

  /**
   * Get cached CSV content by date, type, and optional district
   */
  async getCachedCSV(
    date: string,
    type: CSVType,
    districtId?: string
  ): Promise<string | null> {
    const startTime = Date.now()

    try {
      // Check circuit breaker state
      if (this.isCircuitBreakerOpen()) {
        this.logger.warn('Circuit breaker is open, skipping cache lookup', {
          date,
          type,
          districtId,
          failures: this.circuitBreaker.failures,
          lastFailureTime: this.circuitBreaker.lastFailureTime,
        })
        return null // Fallback to download
      }

      this.validateDateString(date)
      this.validateCSVType(type)
      if (districtId) {
        this.validateDistrictId(districtId)
      }

      const filePath = this.buildFilePath(date, type, districtId)

      try {
        const content = await fs.readFile(filePath, 'utf-8')

        // Perform corruption detection
        const corruptionCheck = await this.detectCorruption(
          filePath,
          content,
          date,
          type,
          districtId
        )
        if (!corruptionCheck.isValid) {
          this.logger.error('Corruption detected in cached file', {
            date,
            type,
            districtId,
            filePath,
            issues: corruptionCheck.issues,
          })

          // Attempt automatic recovery
          const recoveryResult = await this.attemptCorruptionRecovery(
            filePath,
            date,
            type,
            districtId
          )
          if (recoveryResult.success) {
            this.logger.info('Corruption recovery successful', {
              date,
              type,
              districtId,
              filePath,
              recoveryActions: recoveryResult.actions,
            })
            // Reset circuit breaker on successful recovery
            this.resetCircuitBreaker()
            return null // Force re-download after recovery
          } else {
            this.logger.error('Corruption recovery failed', {
              date,
              type,
              districtId,
              filePath,
              errors: recoveryResult.errors,
            })
            this.recordCircuitBreakerFailure()
            return null // Fallback to download
          }
        }

        // Update cache hit statistics
        await this.updateDownloadStats(date, 'hit')

        const duration = Date.now() - startTime
        this.logger.debug('Cache hit for CSV file', {
          date,
          type,
          districtId,
          filePath,
          duration,
          size: content.length,
        })

        // Track performance
        this.trackSlowOperation('getCachedCSV', duration)

        // Reset circuit breaker on successful operation
        this.resetCircuitBreaker()

        return content
      } catch (error) {
        const err = error as { code?: string }
        if (err.code === 'ENOENT') {
          // File not found - this is a cache miss, not an error
          await this.updateDownloadStats(date, 'miss')

          this.logger.debug('Cache miss for CSV file', {
            date,
            type,
            districtId,
            filePath,
          })

          return null
        }

        // Other errors are actual problems - record for circuit breaker
        this.recordCircuitBreakerFailure()
        throw error
      }
    } catch (error) {
      const duration = Date.now() - startTime

      // Re-throw validation errors - these are security issues that should not be ignored
      if (
        error instanceof Error &&
        (error.message.includes('Invalid date format') ||
          error.message.includes('Invalid CSV type') ||
          error.message.includes('Invalid district ID') ||
          error.message.includes('dangerous character') ||
          error.message.includes('path traversal') ||
          error.message.includes('outside the cache directory') ||
          error.message.includes('too long'))
      ) {
        throw error
      }

      this.logger.error('Failed to get cached CSV', {
        date,
        type,
        districtId,
        duration,
        error: this.formatErrorForLogging(error),
        circuitBreakerState: this.getCircuitBreakerState(),
      })

      // Record failure for circuit breaker
      this.recordCircuitBreakerFailure()

      // Return null on error to allow fallback to download
      return null
    }
  }

  /**
   * Store CSV content in cache with proper organization
   */
  async setCachedCSV(
    date: string,
    type: CSVType,
    csvContent: string,
    districtId?: string
  ): Promise<void> {
    const startTime = Date.now()

    try {
      // Check circuit breaker state
      if (this.isCircuitBreakerOpen()) {
        this.logger.warn('Circuit breaker is open, skipping cache write', {
          date,
          type,
          districtId,
          failures: this.circuitBreaker.failures,
          lastFailureTime: this.circuitBreaker.lastFailureTime,
        })
        throw new Error('Cache write skipped due to circuit breaker being open')
      }

      this.validateDateString(date)
      this.validateCSVType(type)
      if (districtId) {
        this.validateDistrictId(districtId)
      }
      this.validateCSVContent(csvContent)

      const filePath = this.buildFilePath(date, type, districtId)
      const dirPath = path.dirname(filePath)

      // Ensure directory exists
      await fs.mkdir(dirPath, { recursive: true })

      // Set secure directory permissions
      await this.setSecureDirectoryPermissions(dirPath)

      // Write file atomically using temporary file
      const tempFilePath = `${filePath}.tmp.${Date.now()}`

      try {
        await fs.writeFile(tempFilePath, csvContent, 'utf-8')

        // Set secure file permissions on temporary file
        await this.setSecureFilePermissions(tempFilePath)

        // Atomically move to final location
        await fs.rename(tempFilePath, filePath)

        // Update metadata
        await this.updateCacheMetadataForFile(
          date,
          type,
          districtId,
          csvContent
        )

        // Update download statistics
        await this.updateDownloadStats(date, 'download')

        const duration = Date.now() - startTime
        this.logger.info('CSV file cached successfully', {
          date,
          type,
          districtId,
          filePath,
          duration,
          size: csvContent.length,
        })

        // Track performance
        this.trackSlowOperation('setCachedCSV', duration)

        // Reset circuit breaker on successful operation
        this.resetCircuitBreaker()
      } catch (error) {
        // Clean up temporary file if it exists
        try {
          await fs.unlink(tempFilePath)
        } catch {
          // Ignore cleanup errors
        }

        // Record failure for circuit breaker
        this.recordCircuitBreakerFailure()
        throw error
      }
    } catch (error) {
      const duration = Date.now() - startTime
      this.logger.error('Failed to cache CSV file', {
        date,
        type,
        districtId,
        duration,
        error: this.formatErrorForLogging(error),
        circuitBreakerState: this.getCircuitBreakerState(),
      })

      // Record failure for circuit breaker (if not already recorded)
      if (
        !(error instanceof Error) ||
        !error.message.includes('circuit breaker')
      ) {
        this.recordCircuitBreakerFailure()
      }

      throw error
    }
  }

  /**
   * Check if CSV file exists in cache
   */
  async hasCachedCSV(
    date: string,
    type: CSVType,
    districtId?: string
  ): Promise<boolean> {
    try {
      this.validateDateString(date)
      this.validateCSVType(type)
      if (districtId) {
        this.validateDistrictId(districtId)
      }

      const filePath = this.buildFilePath(date, type, districtId)

      try {
        await fs.access(filePath)
        return true
      } catch {
        return false
      }
    } catch (error) {
      this.logger.error('Failed to check cached CSV existence', {
        date,
        type,
        districtId,
        error,
      })
      return false
    }
  }

  /**
   * Get cache metadata for a specific date
   */
  async getCacheMetadata(date: string): Promise<RawCSVCacheMetadata | null> {
    try {
      this.validateDateString(date)

      const metadataPath = this.buildMetadataPath(date)

      try {
        const content = await fs.readFile(metadataPath, 'utf-8')
        return JSON.parse(content) as RawCSVCacheMetadata
      } catch (error) {
        const err = error as { code?: string }
        if (err.code === 'ENOENT') {
          return null
        }
        throw error
      }
    } catch (error) {
      this.logger.error('Failed to get cache metadata', { date, error })
      return null
    }
  }

  /**
   * Update cache metadata for a specific date
   */
  async updateCacheMetadata(
    date: string,
    metadata: Partial<RawCSVCacheMetadata>
  ): Promise<void> {
    try {
      this.validateDateString(date)

      const metadataPath = this.buildMetadataPath(date)
      const dirPath = path.dirname(metadataPath)

      // Ensure directory exists
      await fs.mkdir(dirPath, { recursive: true })

      // Set secure directory permissions
      await this.setSecureDirectoryPermissions(dirPath)

      // Get existing metadata or create new
      let existingMetadata = await this.getCacheMetadata(date)
      if (!existingMetadata) {
        existingMetadata = this.createDefaultMetadata(date)
      }

      // Merge metadata
      const updatedMetadata = { ...existingMetadata, ...metadata }

      // Write atomically
      const tempPath = `${metadataPath}.tmp.${Date.now()}`
      try {
        await fs.writeFile(
          tempPath,
          JSON.stringify(updatedMetadata, null, 2),
          'utf-8'
        )

        // Set secure file permissions on temporary file
        await this.setSecureFilePermissions(tempPath)

        // Atomically move to final location
        await fs.rename(tempPath, metadataPath)

        this.logger.debug('Cache metadata updated', { date, metadataPath })
      } catch (error) {
        // Clean up temporary file
        try {
          await fs.unlink(tempPath)
        } catch {
          // Ignore cleanup errors
        }
        throw error
      }
    } catch (error) {
      this.logger.error('Failed to update cache metadata', { date, error })
      throw error
    }
  }

  /**
   * Clear all cache data for a specific date
   */
  async clearCacheForDate(date: string): Promise<void> {
    try {
      this.validateDateString(date)

      const datePath = this.buildDatePath(date)

      try {
        await fs.rm(datePath, { recursive: true, force: true })
        this.logger.info('Cache cleared for date', { date, datePath })
      } catch (error) {
        const err = error as { code?: string }
        if (err.code !== 'ENOENT') {
          throw error
        }
        // Directory doesn't exist - that's fine
      }
    } catch (error) {
      this.logger.error('Failed to clear cache for date', { date, error })
      throw error
    }
  }

  /**
   * Get list of all cached dates
   */
  async getCachedDates(): Promise<string[]> {
    try {
      try {
        const entries = await fs.readdir(this.cacheDir, { withFileTypes: true })
        const dates = entries
          .filter((entry: any) => entry.isDirectory())
          .map((entry: any) => entry.name)
          .filter((name: string) => this.isValidDateString(name))
          .sort()

        return dates
      } catch (error) {
        const err = error as { code?: string }
        if (err.code === 'ENOENT') {
          return []
        }
        throw error
      }
    } catch (error) {
      this.logger.error('Failed to get cached dates', { error })
      return []
    }
  }

  /**
   * Get cache storage information and recommendations
   */
  async getCacheStorageInfo(): Promise<{
    totalSizeMB: number
    totalFiles: number
    oldestDate: string | null
    newestDate: string | null
    isLargeCache: boolean
    recommendations: string[]
  }> {
    try {
      const dates = await this.getCachedDates()
      const recommendations: string[] = []
      let totalFiles = 0
      let totalSize = 0

      for (const date of dates) {
        try {
          const metadata = await this.getCacheMetadata(date)
          if (metadata) {
            totalFiles += metadata.integrity.fileCount
            totalSize += metadata.integrity.totalSize
          }
        } catch (error) {
          this.logger.warn('Failed to get storage info for date', {
            date,
            error,
          })
        }
      }

      const totalSizeMB = totalSize / (1024 * 1024)
      const isLargeCache =
        totalSizeMB > this.config.monitoring.storageSizeWarningMB

      // Generate recommendations
      if (isLargeCache) {
        recommendations.push(
          `Cache size (${totalSizeMB.toFixed(2)}MB) exceeds warning threshold (${this.config.monitoring.storageSizeWarningMB}MB)`
        )
        recommendations.push('Consider monitoring disk space usage regularly')
      }

      if (dates.length > 365) {
        recommendations.push(
          `Cache contains ${dates.length} date directories spanning over a year`
        )
        recommendations.push(
          'Consider archiving very old data if disk space becomes an issue'
        )
      }

      if (totalFiles > 10000) {
        recommendations.push(
          `Cache contains ${totalFiles} files which may impact file system performance`
        )
      }

      if (recommendations.length === 0) {
        recommendations.push('Cache storage is within normal parameters')
      }

      const result = {
        totalSizeMB,
        totalFiles,
        oldestDate: dates.length > 0 ? (dates[0] ?? null) : null,
        newestDate: dates.length > 0 ? (dates[dates.length - 1] ?? null) : null,
        isLargeCache,
        recommendations,
      }

      this.logger.info('Cache storage information retrieved', result)
      return {
        totalSizeMB: result.totalSizeMB,
        totalFiles: result.totalFiles,
        oldestDate: result.oldestDate,
        newestDate: result.newestDate,
        isLargeCache: result.isLargeCache,
        recommendations: result.recommendations,
      }
    } catch (error) {
      this.logger.error('Failed to get cache storage information', { error })
      throw error
    }
  }

  /**
   * Get comprehensive cache statistics
   */
  async getCacheStatistics(): Promise<RawCSVCacheStatistics> {
    try {
      const dates = await this.getCachedDates()
      let totalFiles = 0
      let totalSize = 0
      let totalHits = 0
      let totalMisses = 0
      const fileSizes: number[] = []

      for (const date of dates) {
        try {
          const metadata = await this.getCacheMetadata(date)
          if (metadata) {
            totalFiles += metadata.integrity.fileCount
            totalSize += metadata.integrity.totalSize
            totalHits += metadata.downloadStats.cacheHits
            totalMisses += metadata.downloadStats.cacheMisses
          }

          const datePath = this.buildDatePath(date)
          const stats = await this.getDirectoryStats(datePath)
          fileSizes.push(...stats.fileSizes)
        } catch (error) {
          this.logger.warn('Failed to get statistics for date', { date, error })
        }
      }

      const averageFileSize =
        fileSizes.length > 0
          ? fileSizes.reduce((sum, size) => sum + size, 0) / fileSizes.length
          : 0

      const totalRequests = totalHits + totalMisses
      const hitRatio = totalRequests > 0 ? totalHits / totalRequests : 0
      const missRatio = totalRequests > 0 ? totalMisses / totalRequests : 0

      return {
        totalCachedDates: dates.length,
        totalCachedFiles: totalFiles,
        totalCacheSize: totalSize,
        hitRatio,
        missRatio,
        averageFileSize,
        oldestCacheDate: dates.length > 0 ? (dates[0] ?? null) : null,
        newestCacheDate:
          dates.length > 0 ? (dates[dates.length - 1] ?? null) : null,
        diskUsage: {
          used: totalSize,
          available: 0, // Would need system call to get actual disk space
          percentUsed: 0,
        },
        performance: {
          averageReadTime: 0, // Would need to track over time
          averageWriteTime: 0, // Would need to track over time
          slowestOperations: this.config.monitoring.trackSlowOperations
            ? [...this.slowOperations]
            : [],
        },
      }
    } catch (error) {
      this.logger.error('Failed to get cache statistics', { error })
      throw error
    }
  }

  /**
   * Get cache health status
   */
  async getHealthStatus(): Promise<CacheHealthStatus> {
    const errors: string[] = []
    const warnings: string[] = []
    let isAccessible = false
    let hasWritePermissions = false
    let diskSpaceAvailable = 0

    try {
      // Check if cache directory exists and is accessible
      try {
        await fs.access(this.cacheDir)
        isAccessible = true
      } catch {
        errors.push('Cache directory is not accessible')
      }

      // Check write permissions
      if (isAccessible) {
        try {
          const testFile = path.join(
            this.cacheDir,
            `.health-check-${Date.now()}`
          )
          await fs.writeFile(testFile, 'test', 'utf-8')
          await fs.unlink(testFile)
          hasWritePermissions = true
        } catch {
          errors.push('Cache directory is not writable')
        }
      }

      // Get disk space (simplified - would need system calls for real implementation)
      diskSpaceAvailable = 1000000000 // 1GB placeholder

      // Check circuit breaker status
      if (this.circuitBreaker.isOpen) {
        errors.push(
          `Circuit breaker is open due to ${this.circuitBreaker.failures} consecutive failures`
        )
      } else if (this.circuitBreaker.failures > 0) {
        warnings.push(
          `Circuit breaker has recorded ${this.circuitBreaker.failures} recent failures`
        )
      }

      // Check configuration health - no warnings about cleanup since files are permanent
      try {
        const storageInfo = await this.getCacheStorageInfo()

        if (storageInfo.isLargeCache) {
          warnings.push(
            `Cache size is large (${storageInfo.totalSizeMB.toFixed(2)}MB) - monitor disk space regularly`
          )
        }

        if (storageInfo.totalFiles > 10000) {
          warnings.push(
            `Large number of cached files (${storageInfo.totalFiles}) - may impact file system performance`
          )
        }
      } catch (error) {
        warnings.push(
          `Unable to check cache storage info: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }

      // Check for slow operations
      const recentSlowOps = this.slowOperations.filter(op => {
        const opTime = new Date(op.timestamp).getTime()
        const oneHourAgo = Date.now() - 60 * 60 * 1000
        return opTime > oneHourAgo
      })

      if (recentSlowOps.length > 10) {
        warnings.push(
          `High number of slow operations in the last hour (${recentSlowOps.length})`
        )
      }

      return {
        isHealthy: errors.length === 0,
        cacheDirectory: this.cacheDir,
        isAccessible,
        hasWritePermissions,
        diskSpaceAvailable,
        lastSuccessfulOperation: Date.now(),
        errors,
        warnings,
      }
    } catch (error) {
      errors.push(
        `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )

      return {
        isHealthy: false,
        cacheDirectory: this.cacheDir,
        isAccessible: false,
        hasWritePermissions: false,
        diskSpaceAvailable: 0,
        lastSuccessfulOperation: null,
        errors,
        warnings,
      }
    }
  }

  /**
   * Validate metadata integrity against actual files
   */
  async validateMetadataIntegrity(date: string): Promise<{
    isValid: boolean
    issues: string[]
    actualStats: { fileCount: number; totalSize: number }
    metadataStats: { fileCount: number; totalSize: number }
  }> {
    const issues: string[] = []
    let isValid = true

    try {
      this.validateDateString(date)

      const metadata = await this.getCacheMetadata(date)
      if (!metadata) {
        return {
          isValid: false,
          issues: ['Metadata file does not exist'],
          actualStats: { fileCount: 0, totalSize: 0 },
          metadataStats: { fileCount: 0, totalSize: 0 },
        }
      }

      const datePath = this.buildDatePath(date)

      // The actual stats include metadata.json, but our metadata tracks only CSV files
      // So we need to count only CSV files for comparison
      let actualCsvFileCount = 0
      let actualCsvTotalSize = 0

      try {
        const entries = await fs.readdir(datePath, { withFileTypes: true })

        for (const entry of entries) {
          const fullPath = path.join(datePath, entry.name)

          if (entry.isFile() && entry.name.endsWith('.csv')) {
            const fileStat = await fs.stat(fullPath)
            actualCsvFileCount += 1
            actualCsvTotalSize += fileStat.size
          } else if (
            entry.isDirectory() &&
            entry.name.startsWith('district-')
          ) {
            // Count CSV files in district subdirectories
            const districtEntries = await fs.readdir(fullPath, {
              withFileTypes: true,
            })
            for (const districtEntry of districtEntries) {
              if (
                districtEntry.isFile() &&
                districtEntry.name.endsWith('.csv')
              ) {
                const districtFilePath = path.join(fullPath, districtEntry.name)
                const fileStat = await fs.stat(districtFilePath)
                actualCsvFileCount += 1
                actualCsvTotalSize += fileStat.size
              }
            }
          }
        }
      } catch (error) {
        issues.push(
          `Failed to scan directory: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
        isValid = false
      }

      const metadataFileCount = metadata.integrity.fileCount
      const metadataTotalSize = metadata.integrity.totalSize

      if (actualCsvFileCount !== metadataFileCount) {
        issues.push(
          `File count mismatch: actual=${actualCsvFileCount}, metadata=${metadataFileCount}`
        )
        isValid = false
      }

      // Allow some tolerance for size differences
      const sizeDifference = Math.abs(actualCsvTotalSize - metadataTotalSize)
      if (sizeDifference > 100) {
        // 100 bytes tolerance
        issues.push(
          `Total size mismatch: actual=${actualCsvTotalSize}, metadata=${metadataTotalSize}`
        )
        isValid = false
      }

      // Validate checksums for existing files
      for (const [filename, expectedChecksum] of Object.entries(
        metadata.integrity.checksums
      )) {
        try {
          const filePath = path.join(datePath, filename)
          const content = await fs.readFile(filePath, 'utf-8')
          const actualChecksum = crypto
            .createHash('sha256')
            .update(content)
            .digest('hex')

          if (actualChecksum !== expectedChecksum) {
            issues.push(`Checksum mismatch for ${filename}`)
            isValid = false
          }
        } catch (error) {
          issues.push(
            `File ${filename} referenced in metadata but not found on disk`
          )
          isValid = false
        }
      }

      return {
        isValid,
        issues,
        actualStats: {
          fileCount: actualCsvFileCount,
          totalSize: actualCsvTotalSize,
        },
        metadataStats: {
          fileCount: metadataFileCount,
          totalSize: metadataTotalSize,
        },
      }
    } catch (error) {
      return {
        isValid: false,
        issues: [
          `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ],
        actualStats: { fileCount: 0, totalSize: 0 },
        metadataStats: { fileCount: 0, totalSize: 0 },
      }
    }
  }

  /**
   * Repair metadata integrity by recalculating from actual files
   */
  async repairMetadataIntegrity(date: string): Promise<{
    success: boolean
    repairedFields: string[]
    errors: string[]
  }> {
    const repairedFields: string[] = []
    const errors: string[] = []

    try {
      this.validateDateString(date)

      let metadata = await this.getCacheMetadata(date)
      if (!metadata) {
        metadata = this.createDefaultMetadata(date)
        repairedFields.push('created missing metadata file')
      }

      const datePath = this.buildDatePath(date)

      // Recalculate integrity totals
      await this.recalculateIntegrityTotals(metadata, date)
      repairedFields.push('recalculated file counts and sizes')

      // Recalculate checksums for all files
      const newChecksums: { [filename: string]: string } = {}

      try {
        // Check for all-districts file
        const allDistrictsPath = path.join(datePath, 'all-districts.csv')
        try {
          const content = await fs.readFile(allDistrictsPath, 'utf-8')
          newChecksums['all-districts.csv'] = crypto
            .createHash('sha256')
            .update(content)
            .digest('hex')
          metadata.csvFiles.allDistricts = true
        } catch {
          metadata.csvFiles.allDistricts = false
        }

        // Check for district-specific files
        const entries = await fs.readdir(datePath, { withFileTypes: true })
        const districtDirs = entries.filter(
          (entry: any) =>
            entry.isDirectory() && entry.name.startsWith('district-')
        )

        for (const districtDir of districtDirs) {
          const districtId = districtDir.name.replace('district-', '')
          const districtPath = path.join(datePath, districtDir.name)

          if (!metadata.csvFiles.districts[districtId]) {
            metadata.csvFiles.districts[districtId] = {
              districtPerformance: false,
              divisionPerformance: false,
              clubPerformance: false,
            }
          }

          // Check each CSV type
          for (const csvType of [
            CSVType.DISTRICT_PERFORMANCE,
            CSVType.DIVISION_PERFORMANCE,
            CSVType.CLUB_PERFORMANCE,
          ]) {
            const csvPath = path.join(districtPath, `${csvType}.csv`)
            try {
              const content = await fs.readFile(csvPath, 'utf-8')
              const filename = `district-${districtId}/${csvType}.csv`
              newChecksums[filename] = crypto
                .createHash('sha256')
                .update(content)
                .digest('hex')

              switch (csvType) {
                case CSVType.DISTRICT_PERFORMANCE:
                  metadata.csvFiles.districts[districtId].districtPerformance =
                    true
                  break
                case CSVType.DIVISION_PERFORMANCE:
                  metadata.csvFiles.districts[districtId].divisionPerformance =
                    true
                  break
                case CSVType.CLUB_PERFORMANCE:
                  metadata.csvFiles.districts[districtId].clubPerformance = true
                  break
              }
            } catch {
              // File doesn't exist - that's fine
            }
          }
        }

        metadata.integrity.checksums = newChecksums
        repairedFields.push('recalculated checksums')

        await this.updateCacheMetadata(date, metadata)

        this.logger.info('Metadata integrity repaired', {
          date,
          repairedFields,
          fileCount: metadata.integrity.fileCount,
          totalSize: metadata.integrity.totalSize,
        })

        return {
          success: true,
          repairedFields,
          errors,
        }
      } catch (error) {
        const errorMessage = `Failed to scan directory: ${error instanceof Error ? error.message : 'Unknown error'}`
        errors.push(errorMessage)
        this.logger.error('Failed to repair metadata integrity', {
          date,
          error,
        })

        return {
          success: false,
          repairedFields,
          errors,
        }
      }
    } catch (error) {
      const errorMessage = `Repair failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      errors.push(errorMessage)

      return {
        success: false,
        repairedFields,
        errors,
      }
    }
  }

  /**
   * Get current cache configuration
   */
  getConfiguration(): RawCSVCacheConfig {
    return { ...this.config }
  }

  /**
   * Update cache configuration
   */
  updateConfiguration(updates: Partial<RawCSVCacheConfig>): void {
    // Deep merge the configuration updates
    Object.assign(this.config, updates)

    this.logger.info('Cache configuration updated', {
      updates,
      newConfig: this.config,
    })
  }

  /**
   * Reset configuration to defaults
   */
  resetConfiguration(): void {
    const baseDir = this.cacheConfigService.getCacheDirectory()
    const defaultConfig = { ...DEFAULT_RAW_CSV_CACHE_CONFIG }
    defaultConfig.cacheDir = path.join(baseDir, 'raw-csv')

    Object.assign(this.config, defaultConfig)

    this.logger.info('Cache configuration reset to defaults', {
      config: this.config,
    })
  }

  /**
   * Clear performance history
   */
  clearPerformanceHistory(): void {
    this.slowOperations = []
    this.logger.debug('Performance history cleared')
  }

  /**
   * Get circuit breaker status for monitoring
   */
  getCircuitBreakerStatus(): {
    isOpen: boolean
    failures: number
    lastFailureTime: number | null
    timeSinceLastFailure: number | null
    halfOpenAttempts: number
  } {
    const now = Date.now()
    return {
      isOpen: this.circuitBreaker.isOpen,
      failures: this.circuitBreaker.failures,
      lastFailureTime: this.circuitBreaker.lastFailureTime || null,
      timeSinceLastFailure: this.circuitBreaker.lastFailureTime
        ? now - this.circuitBreaker.lastFailureTime
        : null,
      halfOpenAttempts: this.circuitBreaker.halfOpenAttempts,
    }
  }

  /**
   * Manually reset circuit breaker (for administrative purposes)
   */
  resetCircuitBreakerManually(): void {
    const previousState = this.getCircuitBreakerState()
    this.resetCircuitBreaker()

    this.logger.info('Circuit breaker manually reset', {
      previousState,
      newState: this.getCircuitBreakerState(),
    })
  }

  /**
   * Dispose of the service and clean up resources
   */
  async dispose(): Promise<void> {
    this.logger.debug('RawCSVCacheService disposed')
  }

  // Error handling and recovery methods

  /**
   * Detect corruption in a cached file
   */
  private async detectCorruption(
    _filePath: string,
    content: string,
    date: string,
    type: CSVType,
    districtId?: string
  ): Promise<{ isValid: boolean; issues: string[] }> {
    const issues: string[] = []

    try {
      // Check basic CSV structure
      if (!content || content.trim().length === 0) {
        issues.push('File is empty')
        return { isValid: false, issues }
      }

      // Check for minimum CSV structure
      const lines = content.trim().split('\n')
      if (lines.length < 2) {
        issues.push('CSV must have at least a header and one data row')
      }

      // Check for binary content or control characters
      if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(content)) {
        issues.push('File contains binary or control characters')
      }

      // Verify file size consistency with metadata
      const metadata = await this.getCacheMetadata(date)
      if (metadata) {
        const filename = this.getFilename(type, districtId)
        const expectedChecksum = metadata.integrity.checksums[filename]

        if (expectedChecksum) {
          const actualChecksum = crypto
            .createHash('sha256')
            .update(content)
            .digest('hex')
          if (actualChecksum !== expectedChecksum) {
            issues.push('Checksum mismatch - file may be corrupted')
          }
        }
      }

      // Check for truncated content (incomplete lines)
      const lastLine = lines[lines.length - 1]
      if (lastLine && !lastLine.includes(',') && lines.length > 2) {
        // Last line doesn't contain commas but we have multiple lines - might be truncated
        issues.push('File may be truncated - last line appears incomplete')
      }

      // Check for excessive line length that might indicate corruption
      for (let i = 0; i < lines.length; i++) {
        if (lines?.[i]?.length && lines[i]!.length > 50000) {
          // 50KB per line is excessive
          issues.push(`Line ${i + 1} is excessively long - possible corruption`)
          break
        }
      }

      return { isValid: issues.length === 0, issues }
    } catch (error) {
      issues.push(
        `Corruption detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
      return { isValid: false, issues }
    }
  }

  /**
   * Attempt to recover from file corruption
   */
  private async attemptCorruptionRecovery(
    filePath: string,
    date: string,
    type: CSVType,
    districtId?: string
  ): Promise<{ success: boolean; actions: string[]; errors: string[] }> {
    const actions: string[] = []
    const errors: string[] = []

    try {
      // Remove the corrupted file
      try {
        await fs.unlink(filePath)
        actions.push('Removed corrupted file')
        this.logger.info('Removed corrupted cache file', { filePath })
      } catch (error) {
        const errorMsg = `Failed to remove corrupted file: ${error instanceof Error ? error.message : 'Unknown error'}`
        errors.push(errorMsg)
        this.logger.error('Failed to remove corrupted file during recovery', {
          filePath,
          error,
        })
      }

      // Update metadata to reflect file removal
      try {
        const metadata = await this.getCacheMetadata(date)
        if (metadata) {
          const filename = this.getFilename(type, districtId)

          // Remove from checksums
          delete metadata.integrity.checksums[filename]

          // Update file tracking
          if (type === CSVType.ALL_DISTRICTS) {
            metadata.csvFiles.allDistricts = false
          } else if (districtId && metadata.csvFiles.districts[districtId]) {
            switch (type) {
              case CSVType.DISTRICT_PERFORMANCE:
                metadata.csvFiles.districts[districtId].districtPerformance =
                  false
                break
              case CSVType.DIVISION_PERFORMANCE:
                metadata.csvFiles.districts[districtId].divisionPerformance =
                  false
                break
              case CSVType.CLUB_PERFORMANCE:
                metadata.csvFiles.districts[districtId].clubPerformance = false
                break
            }
          }

          // Recalculate integrity totals
          await this.recalculateIntegrityTotals(metadata, date)
          await this.updateCacheMetadata(date, metadata)

          actions.push('Updated metadata to reflect file removal')
        }
      } catch (error) {
        const errorMsg = `Failed to update metadata during recovery: ${error instanceof Error ? error.message : 'Unknown error'}`
        errors.push(errorMsg)
        this.logger.error(
          'Failed to update metadata during corruption recovery',
          { date, error }
        )
      }

      const success = errors.length === 0

      this.logger.info('Corruption recovery completed', {
        filePath,
        date,
        type,
        districtId,
        success,
        actions,
        errors,
      })

      return { success, actions, errors }
    } catch (error) {
      const errorMsg = `Recovery process failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      errors.push(errorMsg)

      this.logger.error('Corruption recovery process failed', {
        filePath,
        date,
        type,
        districtId,
        error,
      })

      return { success: false, actions, errors }
    }
  }

  /**
   * Circuit breaker methods for handling repeated failures
   */
  private isCircuitBreakerOpen(): boolean {
    const now = Date.now()

    if (this.circuitBreaker.isOpen) {
      // Check if we should try to close the circuit (half-open state)
      if (
        now - this.circuitBreaker.lastFailureTime >
        this.circuitBreakerConfig.resetTimeoutMs
      ) {
        this.circuitBreaker.isOpen = false
        this.circuitBreaker.halfOpenAttempts = 0
        this.logger.info('Circuit breaker transitioning to half-open state', {
          failures: this.circuitBreaker.failures,
          timeSinceLastFailure: now - this.circuitBreaker.lastFailureTime,
        })
        return false
      }
      return true
    }

    return false
  }

  private recordCircuitBreakerFailure(): void {
    this.circuitBreaker.failures += 1
    this.circuitBreaker.lastFailureTime = Date.now()

    if (
      this.circuitBreaker.failures >= this.circuitBreakerConfig.failureThreshold
    ) {
      this.circuitBreaker.isOpen = true
      this.logger.error('Circuit breaker opened due to repeated failures', {
        failures: this.circuitBreaker.failures,
        threshold: this.circuitBreakerConfig.failureThreshold,
        resetTimeoutMs: this.circuitBreakerConfig.resetTimeoutMs,
      })
    } else {
      this.logger.warn('Circuit breaker failure recorded', {
        failures: this.circuitBreaker.failures,
        threshold: this.circuitBreakerConfig.failureThreshold,
      })
    }
  }

  private resetCircuitBreaker(): void {
    const wasOpen = this.circuitBreaker.isOpen
    const hadFailures = this.circuitBreaker.failures > 0

    this.circuitBreaker.failures = 0
    this.circuitBreaker.isOpen = false
    this.circuitBreaker.halfOpenAttempts = 0

    if (wasOpen || hadFailures) {
      this.logger.info('Circuit breaker reset after successful operation', {
        wasOpen,
        hadFailures,
      })
    }
  }

  private getCircuitBreakerState(): object {
    return {
      failures: this.circuitBreaker.failures,
      isOpen: this.circuitBreaker.isOpen,
      lastFailureTime: this.circuitBreaker.lastFailureTime,
      halfOpenAttempts: this.circuitBreaker.halfOpenAttempts,
    }
  }

  /**
   * Format error for structured logging
   */
  private formatErrorForLogging(error: unknown): object {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
        ...((error as any).code && { code: (error as any).code }),
      }
    }

    return {
      type: typeof error,
      value: String(error),
    }
  }

  // Private helper methods

  /**
   * Track slow operations for performance monitoring
   */
  private trackSlowOperation(operation: string, duration: number): void {
    if (!this.config.monitoring.trackSlowOperations) {
      return
    }

    const threshold = this.getPerformanceThreshold(operation)
    if (duration > threshold) {
      const slowOp = {
        operation,
        duration,
        timestamp: new Date().toISOString(),
      }

      this.slowOperations.push(slowOp)

      // Keep only the most recent slow operations
      if (
        this.slowOperations.length >
        this.config.monitoring.maxSlowOperationsHistory
      ) {
        this.slowOperations = this.slowOperations.slice(
          -this.config.monitoring.maxSlowOperationsHistory
        )
      }

      if (this.config.performanceThresholds.enablePerformanceLogging) {
        this.logger.warn('Slow cache operation detected', {
          operation,
          duration,
          threshold,
          timestamp: slowOp.timestamp,
        })
      }
    }
  }

  /**
   * Get performance threshold for an operation
   */
  private getPerformanceThreshold(operation: string): number {
    if (operation.includes('read') || operation.includes('get')) {
      return this.config.performanceThresholds.maxReadTimeMs
    } else if (operation.includes('write') || operation.includes('set')) {
      return this.config.performanceThresholds.maxWriteTimeMs
    }
    return this.config.performanceThresholds.maxReadTimeMs // Default to read threshold
  }

  /**
   * Comprehensive path safety validation to prevent path traversal attacks
   */
  private validatePathSafety(input: string, inputType: string): void {
    // Check for null bytes
    if (input.includes('\0')) {
      throw new Error(`${inputType} contains null bytes`)
    }

    // Check for path traversal patterns
    const dangerousPatterns = [
      '..', // Parent directory
      '/', // Unix path separator
      '\\', // Windows path separator
      ':', // Drive separator (Windows)
      '<', // Redirection
      '>', // Redirection
      '|', // Pipe
      '?', // Wildcard
      '*', // Wildcard
      '"', // Quote
      '\n', // Newline
      '\r', // Carriage return
      '\t', // Tab
    ]

    for (const pattern of dangerousPatterns) {
      if (input.includes(pattern)) {
        throw new Error(
          `${inputType} contains dangerous character or pattern: ${pattern}`
        )
      }
    }

    // Check for control characters
    if (/[\x00-\x1f\x7f-\x9f]/.test(input)) {
      throw new Error(`${inputType} contains control characters`)
    }

    // Ensure the input doesn't start with dangerous prefixes
    const dangerousPrefixes = ['-', '.', ' ']
    if (dangerousPrefixes.some(prefix => input.startsWith(prefix))) {
      throw new Error(`${inputType} starts with dangerous character`)
    }
  }

  /**
   * Sanitize district ID by removing or replacing dangerous characters
   */
  private sanitizeDistrictId(districtId: string): string {
    // Remove any characters that aren't alphanumeric, hyphens, or underscores
    return districtId.replace(/[^a-zA-Z0-9\-_]/g, '')
  }

  /**
   * Validate CSV content for security issues
   */
  private validateCSVContentSecurity(csvContent: string): void {
    // Check for potential script injection in CSV content
    const dangerousPatterns = [
      /^=.*[|!]/m, // Formula injection (Excel) - starts with = and contains | or !
      /=\s*[+\-@]/, // Formula injection (Excel) - traditional patterns
      /<script/i, // Script tags
      /javascript:/i, // JavaScript URLs
      /data:text\/html/i, // Data URLs
      /vbscript:/i, // VBScript URLs
      /on\w+\s*=/i, // Event handlers
    ]

    for (const pattern of dangerousPatterns) {
      if (pattern.test(csvContent)) {
        throw new Error('CSV content contains potentially malicious patterns')
      }
    }

    // Check for excessive line length that might indicate malicious content
    const lines = csvContent.split('\n')
    const maxLineLength = 10000 // 10KB per line should be sufficient for legitimate CSV

    for (let i = 0; i < lines.length; i++) {
      if (lines?.[i]?.length && lines[i]!.length > maxLineLength) {
        throw new Error(
          `CSV line ${i + 1} exceeds maximum length of ${maxLineLength} characters`
        )
      }
    }

    // Check for suspicious binary content
    if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(csvContent)) {
      throw new Error('CSV content contains binary or control characters')
    }
  }

  /**
   * Ensure all cache operations remain within the designated cache directory
   */
  private validateCacheDirectoryBounds(filePath: string): void {
    if (!this.config.security.validatePaths) {
      return
    }

    try {
      // Resolve the absolute path to handle any relative path components
      const resolvedPath = path.resolve(filePath)
      const resolvedCacheDir = path.resolve(this.cacheDir)

      // Check if the resolved path is within the cache directory
      if (
        !resolvedPath.startsWith(resolvedCacheDir + path.sep) &&
        resolvedPath !== resolvedCacheDir
      ) {
        throw new Error(
          `File path ${filePath} is outside the cache directory bounds`
        )
      }
    } catch (error) {
      throw new Error(
        `Invalid file path: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Set appropriate file permissions for cached files
   */
  private async setSecureFilePermissions(filePath: string): Promise<void> {
    if (!this.config.security.enforcePermissions) {
      return
    }

    try {
      // Set file permissions to be readable/writable by owner only (600)
      // This prevents other users from reading potentially sensitive data
      await fs.chmod(filePath, 0o600)

      this.logger.debug('Set secure file permissions', {
        filePath,
        permissions: '600',
      })
    } catch (error) {
      this.logger.warn('Failed to set secure file permissions', {
        filePath,
        error,
      })
      // Don't throw - this is a security enhancement, not a critical failure
    }
  }

  /**
   * Set appropriate directory permissions for cache directories
   */
  private async setSecureDirectoryPermissions(dirPath: string): Promise<void> {
    if (!this.config.security.enforcePermissions) {
      return
    }

    try {
      // Set directory permissions to be accessible by owner only (700)
      await fs.chmod(dirPath, 0o700)

      this.logger.debug('Set secure directory permissions', {
        dirPath,
        permissions: '700',
      })
    } catch (error) {
      this.logger.warn('Failed to set secure directory permissions', {
        dirPath,
        error,
      })
      // Don't throw - this is a security enhancement, not a critical failure
    }
  }

  // Private helper methods

  /**
   * Validate date string format (YYYY-MM-DD) and prevent path traversal
   */
  private validateDateString(date: string): void {
    if (!this.isValidDateString(date)) {
      throw new Error(
        `Invalid date format: ${date}. Expected YYYY-MM-DD format.`
      )
    }

    // Enhanced security validation for path traversal prevention
    if (this.config.security.validatePaths) {
      this.validatePathSafety(date, 'date string')
    }
  }

  /**
   * Check if date string is valid
   */
  private isValidDateString(date: string): boolean {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(date)) {
      return false
    }

    const dateObj = new Date(date + 'T00:00:00')
    return dateObj.toISOString().startsWith(date)
  }

  /**
   * Validate CSV type
   */
  private validateCSVType(type: CSVType): void {
    if (!Object.values(CSVType).includes(type)) {
      throw new Error(`Invalid CSV type: ${type}`)
    }
  }

  /**
   * Validate district ID and sanitize for path safety
   */
  private validateDistrictId(districtId: string): void {
    if (this.config.security.sanitizeInputs) {
      // Enhanced path traversal protection
      this.validatePathSafety(districtId, 'district ID')

      // Sanitize district ID
      const sanitized = this.sanitizeDistrictId(districtId)
      if (sanitized !== districtId) {
        throw new Error(
          `District ID contains invalid characters: ${districtId}`
        )
      }
    }

    // Basic validation - district IDs should be alphanumeric with limited special characters
    if (!/^[a-zA-Z0-9\-_]+$/.test(districtId)) {
      throw new Error(
        `Invalid district ID format: ${districtId}. Only alphanumeric characters, hyphens, and underscores are allowed.`
      )
    }

    // Length validation
    if (districtId.length > 50) {
      throw new Error(
        `District ID too long: ${districtId}. Maximum length is 50 characters.`
      )
    }
  }

  /**
   * Validate CSV content before caching to prevent malicious content storage
   */
  private validateCSVContent(csvContent: string): void {
    if (!csvContent || csvContent.trim().length === 0) {
      throw new Error('CSV content cannot be empty')
    }

    // Size validation to prevent excessive memory usage
    const maxSize =
      this.config.performanceThresholds.maxMemoryUsageMB * 1024 * 1024 // Convert MB to bytes
    if (Buffer.byteLength(csvContent, 'utf-8') > maxSize) {
      throw new Error(
        `CSV content too large. Maximum size is ${this.config.performanceThresholds.maxMemoryUsageMB}MB`
      )
    }

    // Basic CSV structure validation
    const lines = csvContent.trim().split('\n')
    if (lines.length < 2) {
      throw new Error('CSV must have at least a header and one data row')
    }

    // Enhanced security validation
    if (this.config.security.sanitizeInputs) {
      this.validateCSVContentSecurity(csvContent)
    }
  }

  /**
   * Build file path for cached CSV with security validation
   */
  private buildFilePath(
    date: string,
    type: CSVType,
    districtId?: string
  ): string {
    const datePath = this.buildDatePath(date)

    let filePath: string

    if (type === CSVType.ALL_DISTRICTS) {
      filePath = path.join(datePath, `${type}.csv`)
    } else {
      if (!districtId) {
        throw new Error(`District ID required for CSV type: ${type}`)
      }
      const districtPath = path.join(datePath, `district-${districtId}`)
      filePath = path.join(districtPath, `${type}.csv`)
    }

    // Validate that the constructed path is within cache directory bounds
    this.validateCacheDirectoryBounds(filePath)

    return filePath
  }

  /**
   * Build date directory path
   */
  private buildDatePath(date: string): string {
    return path.join(this.cacheDir, date)
  }

  /**
   * Build metadata file path
   */
  private buildMetadataPath(date: string): string {
    return path.join(this.buildDatePath(date), 'metadata.json')
  }

  /**
   * Create default metadata for a date
   */
  private createDefaultMetadata(date: string): RawCSVCacheMetadata {
    return {
      date,
      timestamp: Date.now(),
      programYear: this.getProgramYear(date),
      csvFiles: {
        allDistricts: false,
        districts: {},
      },
      downloadStats: {
        totalDownloads: 0,
        cacheHits: 0,
        cacheMisses: 0,
        lastAccessed: Date.now(),
      },
      integrity: {
        checksums: {},
        totalSize: 0,
        fileCount: 0,
      },
      source: 'scraper',
      cacheVersion: 1,
    }
  }

  /**
   * Get program year for a date (same logic as ToastmastersScraper)
   */
  private getProgramYear(dateString: string): string {
    const date = new Date(dateString + 'T00:00:00')
    const year = date.getFullYear()
    const month = date.getMonth() + 1 // 1-12

    // If month is July (7) or later, program year starts this year
    // If month is June (6) or earlier, program year started last year
    if (month >= 7) {
      return `${year}-${year + 1}`
    } else {
      return `${year - 1}-${year}`
    }
  }

  /**
   * Update cache metadata when a file is cached
   */
  private async updateCacheMetadataForFile(
    date: string,
    type: CSVType,
    districtId: string | undefined,
    csvContent: string
  ): Promise<void> {
    const checksum = crypto
      .createHash('sha256')
      .update(csvContent)
      .digest('hex')
    const size = Buffer.byteLength(csvContent, 'utf-8')

    const metadata =
      (await this.getCacheMetadata(date)) || this.createDefaultMetadata(date)
    const filename = this.getFilename(type, districtId)

    // Check if file already exists in metadata to handle overwrites correctly
    const existingChecksum = metadata.integrity.checksums[filename]
    const isNewFile = !existingChecksum

    // Update file tracking
    if (type === CSVType.ALL_DISTRICTS) {
      metadata.csvFiles.allDistricts = true
    } else if (districtId) {
      if (!metadata.csvFiles.districts[districtId]) {
        metadata.csvFiles.districts[districtId] = {
          districtPerformance: false,
          divisionPerformance: false,
          clubPerformance: false,
        }
      }

      switch (type) {
        case CSVType.DISTRICT_PERFORMANCE:
          metadata.csvFiles.districts[districtId].districtPerformance = true
          break
        case CSVType.DIVISION_PERFORMANCE:
          metadata.csvFiles.districts[districtId].divisionPerformance = true
          break
        case CSVType.CLUB_PERFORMANCE:
          metadata.csvFiles.districts[districtId].clubPerformance = true
          break
      }
    }

    // Update integrity information
    metadata.integrity.checksums[filename] = checksum

    if (isNewFile) {
      // New file - add to totals
      metadata.integrity.totalSize += size
      metadata.integrity.fileCount += 1
    } else {
      // File overwrite - need to calculate the size difference
      // For simplicity, we'll recalculate the total size from all files
      // This ensures accuracy but is less efficient
      await this.recalculateIntegrityTotals(metadata, date)
    }

    await this.updateCacheMetadata(date, metadata)
  }

  /**
   * Recalculate integrity totals by scanning actual CSV files
   * This ensures accuracy when files are overwritten
   */
  private async recalculateIntegrityTotals(
    metadata: RawCSVCacheMetadata,
    date: string
  ): Promise<void> {
    try {
      const datePath = this.buildDatePath(date)

      // Count only CSV files, not metadata.json
      let csvFileCount = 0
      let csvTotalSize = 0

      const entries = await fs.readdir(datePath, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(datePath, entry.name)

        if (entry.isFile() && entry.name.endsWith('.csv')) {
          const fileStat = await fs.stat(fullPath)
          csvFileCount += 1
          csvTotalSize += fileStat.size
        } else if (entry.isDirectory() && entry.name.startsWith('district-')) {
          // Count CSV files in district subdirectories
          const districtEntries = await fs.readdir(fullPath, {
            withFileTypes: true,
          })
          for (const districtEntry of districtEntries) {
            if (districtEntry.isFile() && districtEntry.name.endsWith('.csv')) {
              const districtFilePath = path.join(fullPath, districtEntry.name)
              const fileStat = await fs.stat(districtFilePath)
              csvFileCount += 1
              csvTotalSize += fileStat.size
            }
          }
        }
      }

      // Update totals based on actual CSV file system state
      metadata.integrity.totalSize = csvTotalSize
      metadata.integrity.fileCount = csvFileCount

      this.logger.debug('Recalculated integrity totals', {
        date,
        totalSize: csvTotalSize,
        fileCount: csvFileCount,
      })
    } catch (error) {
      this.logger.warn('Failed to recalculate integrity totals', {
        date,
        error,
      })
      // Don't throw - this is a non-critical operation
    }
  }

  /**
   * Get filename for a CSV type and district
   */
  private getFilename(type: CSVType, districtId?: string): string {
    if (type === CSVType.ALL_DISTRICTS) {
      return `${type}.csv`
    } else {
      return `district-${districtId}/${type}.csv`
    }
  }

  /**
   * Update download statistics
   */
  private async updateDownloadStats(
    date: string,
    operation: 'hit' | 'miss' | 'download'
  ): Promise<void> {
    try {
      const metadata =
        (await this.getCacheMetadata(date)) || this.createDefaultMetadata(date)

      switch (operation) {
        case 'hit':
          metadata.downloadStats.cacheHits += 1
          break
        case 'miss':
          metadata.downloadStats.cacheMisses += 1
          break
        case 'download':
          metadata.downloadStats.totalDownloads += 1
          break
      }

      metadata.downloadStats.lastAccessed = Date.now()

      await this.updateCacheMetadata(date, metadata)
    } catch (error) {
      // Don't fail the main operation if stats update fails
      this.logger.warn('Failed to update download statistics', {
        date,
        operation,
        error,
      })
    }
  }

  /**
   * Get directory statistics
   */
  private async getDirectoryStats(dirPath: string): Promise<{
    fileCount: number
    totalSize: number
    fileSizes: number[]
  }> {
    const stats = {
      fileCount: 0,
      totalSize: 0,
      fileSizes: [] as number[],
    }

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)

        if (entry.isFile()) {
          try {
            const fileStat = await fs.stat(fullPath)
            stats.fileCount += 1
            stats.totalSize += fileStat.size
            stats.fileSizes.push(fileStat.size)
          } catch {
            // Ignore individual file stat errors
          }
        } else if (entry.isDirectory()) {
          // Recursively get stats for subdirectories
          const subStats = await this.getDirectoryStats(fullPath)
          stats.fileCount += subStats.fileCount
          stats.totalSize += subStats.totalSize
          stats.fileSizes.push(...subStats.fileSizes)
        }
      }
    } catch {
      // Return empty stats if directory can't be read
    }

    return stats
  }
}
