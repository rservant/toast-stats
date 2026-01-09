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

import { promises as fs, Dirent } from 'fs'
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
  ICacheIntegrityValidator,
  ICacheSecurityManager,
} from '../types/serviceInterfaces.js'
import { ScrapedRecord } from '../types/districts.js'
import { CircuitBreaker } from '../utils/CircuitBreaker.js'
import { CacheIntegrityValidator } from './CacheIntegrityValidator.js'
import { CacheSecurityManager } from './CacheSecurityManager.js'

/**
 * Raw CSV Cache Service Implementation
 */
export class RawCSVCacheService implements IRawCSVCacheService {
  private readonly config: RawCSVCacheConfig
  private readonly cacheDir: string
  private readonly logger: ILogger
  private readonly cacheConfigService: ICacheConfigService
  private readonly integrityValidator: ICacheIntegrityValidator
  private readonly securityManager: ICacheSecurityManager
  private readonly circuitBreaker: CircuitBreaker
  private slowOperations: Array<{
    operation: string
    duration: number
    timestamp: string
  }> = []

  constructor(
    cacheConfigService: ICacheConfigService,
    logger: ILogger,
    config?: Partial<RawCSVCacheConfig>,
    // New optional dependencies for extracted modules
    integrityValidator?: ICacheIntegrityValidator,
    securityManager?: ICacheSecurityManager,
    circuitBreaker?: CircuitBreaker
  ) {
    this.cacheConfigService = cacheConfigService
    this.logger = logger
    this.config = { ...DEFAULT_RAW_CSV_CACHE_CONFIG, ...config }

    // Use the cache config service to get the base directory
    const baseDir = this.cacheConfigService.getCacheDirectory()
    this.cacheDir = path.join(baseDir, 'raw-csv')

    // Override config cache directory to use the resolved path
    this.config.cacheDir = this.cacheDir

    // Create default instances when not provided (backward compatibility)
    this.integrityValidator =
      integrityValidator ?? new CacheIntegrityValidator(logger)
    this.securityManager =
      securityManager ?? new CacheSecurityManager(logger, this.config.security)
    this.circuitBreaker =
      circuitBreaker ??
      CircuitBreaker.createCacheCircuitBreaker('raw-csv-cache')

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
        const cbStats = this.circuitBreaker.getStats()
        this.logger.warn('Circuit breaker is open, skipping cache lookup', {
          date,
          type,
          districtId,
          failures: cbStats.failureCount,
          lastFailureTime: cbStats.lastFailureTime?.getTime() ?? null,
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
            this.recordCircuitBreakerFailure(
              new Error('Corruption recovery failed')
            )
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
        this.recordCircuitBreakerFailure(
          error instanceof Error ? error : new Error(String(error))
        )
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
      this.recordCircuitBreakerFailure(
        error instanceof Error ? error : new Error(String(error))
      )

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
        const cbStats = this.circuitBreaker.getStats()
        this.logger.warn('Circuit breaker is open, skipping cache write', {
          date,
          type,
          districtId,
          failures: cbStats.failureCount,
          lastFailureTime: cbStats.lastFailureTime?.getTime() ?? null,
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
        this.recordCircuitBreakerFailure(
          error instanceof Error ? error : new Error(String(error))
        )
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
        this.recordCircuitBreakerFailure(
          error instanceof Error ? error : new Error(String(error))
        )
      }

      throw error
    }
  }

  /**
   * Store CSV content in cache with enhanced metadata for month-end closing periods
   */
  async setCachedCSVWithMetadata(
    date: string,
    type: CSVType,
    csvContent: string,
    districtId?: string,
    additionalMetadata?: {
      requestedDate?: string
      isClosingPeriod?: boolean
      dataMonth?: string
    }
  ): Promise<void> {
    const startTime = Date.now()

    try {
      // Check circuit breaker state
      if (this.isCircuitBreakerOpen()) {
        const cbStats = this.circuitBreaker.getStats()
        this.logger.warn('Circuit breaker is open, skipping cache write', {
          date,
          type,
          districtId,
          failures: cbStats.failureCount,
          lastFailureTime: cbStats.lastFailureTime?.getTime() ?? null,
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

        // Update metadata with additional closing period information
        await this.updateCacheMetadataForFileWithClosingInfo(
          date,
          type,
          districtId,
          csvContent,
          additionalMetadata
        )

        // Update download statistics
        await this.updateDownloadStats(date, 'download')

        const duration = Date.now() - startTime
        this.logger.info(
          'CSV file cached successfully with enhanced metadata',
          {
            date,
            type,
            districtId,
            filePath,
            duration,
            size: csvContent.length,
            requestedDate: additionalMetadata?.requestedDate,
            isClosingPeriod: additionalMetadata?.isClosingPeriod,
            dataMonth: additionalMetadata?.dataMonth,
          }
        )

        // Track performance
        this.trackSlowOperation('setCachedCSVWithMetadata', duration)

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
        this.recordCircuitBreakerFailure(
          error instanceof Error ? error : new Error(String(error))
        )
        throw error
      }
    } catch (error) {
      const duration = Date.now() - startTime
      this.logger.error('Failed to cache CSV file with enhanced metadata', {
        date,
        type,
        districtId,
        duration,
        error: this.formatErrorForLogging(error),
        circuitBreakerState: this.getCircuitBreakerState(),
        requestedDate: additionalMetadata?.requestedDate,
        isClosingPeriod: additionalMetadata?.isClosingPeriod,
        dataMonth: additionalMetadata?.dataMonth,
      })

      // Record failure for circuit breaker (if not already recorded)
      if (
        !(error instanceof Error) ||
        !error.message.includes('circuit breaker')
      ) {
        this.recordCircuitBreakerFailure(
          error instanceof Error ? error : new Error(String(error))
        )
      }

      throw error
    }
  }
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
          .filter((entry: Dirent) => entry.isDirectory())
          .map((entry: Dirent) => entry.name)
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
      const cbStats = this.circuitBreaker.getStats()
      if (cbStats.state === 'OPEN') {
        errors.push(
          `Circuit breaker is open due to ${cbStats.failureCount} consecutive failures`
        )
      } else if (cbStats.failureCount > 0) {
        warnings.push(
          `Circuit breaker has recorded ${cbStats.failureCount} recent failures`
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
   * Delegates to CacheIntegrityValidator
   */
  async validateMetadataIntegrity(date: string): Promise<{
    isValid: boolean
    issues: string[]
    actualStats: { fileCount: number; totalSize: number }
    metadataStats: { fileCount: number; totalSize: number }
  }> {
    try {
      this.validateDateString(date)
      const metadata = await this.getCacheMetadata(date)
      return await this.integrityValidator.validateMetadataIntegrity(
        this.cacheDir,
        date,
        metadata
      )
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
   * Delegates to CacheIntegrityValidator
   */
  async repairMetadataIntegrity(date: string): Promise<{
    success: boolean
    repairedFields: string[]
    errors: string[]
  }> {
    try {
      this.validateDateString(date)
      const existingMetadata = await this.getCacheMetadata(date)
      const result = await this.integrityValidator.repairMetadataIntegrity(
        this.cacheDir,
        date,
        existingMetadata
      )

      // If repair was successful, update the metadata file
      if (result.success) {
        // The integrityValidator has already repaired the metadata internally,
        // but we need to persist it. Let's recalculate and save.
        let metadata = existingMetadata || this.createDefaultMetadata(date)
        metadata = await this.integrityValidator.recalculateIntegrityTotals(
          this.cacheDir,
          date,
          metadata
        )
        await this.updateCacheMetadata(date, metadata)

        this.logger.info('Metadata integrity repaired', {
          date,
          repairedFields: result.actions,
          fileCount: metadata.integrity.fileCount,
          totalSize: metadata.integrity.totalSize,
        })
      }

      return {
        success: result.success,
        repairedFields: result.actions,
        errors: result.errors,
      }
    } catch (error) {
      const errorMessage = `Repair failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      return {
        success: false,
        repairedFields: [],
        errors: [errorMessage],
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
   * Delegates to CircuitBreaker class
   */
  getCircuitBreakerStatus(): {
    isOpen: boolean
    failures: number
    lastFailureTime: number | null
    timeSinceLastFailure: number | null
    halfOpenAttempts: number
  } {
    const stats = this.circuitBreaker.getStats()
    const now = Date.now()
    const lastFailureTime = stats.lastFailureTime?.getTime() ?? null
    return {
      isOpen: stats.state === 'OPEN',
      failures: stats.failureCount,
      lastFailureTime,
      timeSinceLastFailure: lastFailureTime ? now - lastFailureTime : null,
      halfOpenAttempts: stats.state === 'HALF_OPEN' ? 1 : 0,
    }
  }

  /**
   * Manually reset circuit breaker (for administrative purposes)
   * Delegates to CircuitBreaker class
   */
  resetCircuitBreakerManually(): void {
    const previousState = this.getCircuitBreakerState()
    this.circuitBreaker.reset()

    this.logger.info('Circuit breaker manually reset', {
      previousState,
      newState: this.getCircuitBreakerState(),
    })
  }

  /**
   * Get cached All Districts CSV for a specific date
   * Returns cached data with metadata if available, null if cache miss
   */
  async getAllDistrictsCached(date: string): Promise<{
    data: ScrapedRecord[]
    fromCache: boolean
    metadata: {
      fileName: string
      date: string
      fetchedAt: string
      fileSize: number
      checksum: string
    }
  } | null> {
    const startTime = Date.now()

    try {
      this.validateDateString(date)

      // Check if cached CSV exists
      const csvContent = await this.getCachedCSV(
        date,
        CSVType.ALL_DISTRICTS,
        undefined
      )

      if (!csvContent) {
        this.logger.debug('Cache miss for All Districts CSV', { date })
        return null
      }

      // Get metadata for the cached file
      const cacheMetadata = await this.getCacheMetadata(date)
      if (!cacheMetadata) {
        this.logger.warn(
          'CSV file exists but metadata missing for All Districts',
          { date }
        )
        return null
      }

      // Parse CSV content into ScrapedRecord array
      const data = this.parseCSVContent(csvContent)

      // Build metadata response
      const filename = this.getFilename(CSVType.ALL_DISTRICTS, undefined)
      const checksum = cacheMetadata.integrity.checksums[filename] || ''
      const fileSize = Buffer.byteLength(csvContent, 'utf-8')

      const duration = Date.now() - startTime
      this.logger.info('All Districts CSV retrieved from cache', {
        date,
        recordCount: data.length,
        fileSize,
        duration,
      })

      return {
        data,
        fromCache: true,
        metadata: {
          fileName: `all-districts-${date}.csv`,
          date,
          fetchedAt: new Date(cacheMetadata.timestamp).toISOString(),
          fileSize,
          checksum,
        },
      }
    } catch (error) {
      const duration = Date.now() - startTime
      this.logger.error('Failed to get cached All Districts CSV', {
        date,
        duration,
        error: this.formatErrorForLogging(error),
      })
      return null
    }
  }

  /**
   * Store All Districts CSV in cache with metadata
   */
  async cacheAllDistricts(
    date: string,
    data: ScrapedRecord[],
    rawCsv: string
  ): Promise<void> {
    const startTime = Date.now()

    try {
      this.validateDateString(date)

      // Store the raw CSV content
      await this.setCachedCSV(date, CSVType.ALL_DISTRICTS, rawCsv, undefined)

      const duration = Date.now() - startTime
      const fileSize = Buffer.byteLength(rawCsv, 'utf-8')

      this.logger.info('All Districts CSV cached successfully', {
        date,
        recordCount: data.length,
        fileSize,
        duration,
      })
    } catch (error) {
      const duration = Date.now() - startTime
      this.logger.error('Failed to cache All Districts CSV', {
        date,
        duration,
        error: this.formatErrorForLogging(error),
      })
      throw error
    }
  }

  /**
   * Parse CSV content into ScrapedRecord array
   * Simple CSV parser for cached content
   */
  private parseCSVContent(csvContent: string): ScrapedRecord[] {
    const lines = csvContent.trim().split('\n')
    if (lines.length < 2) {
      return []
    }

    // Parse header
    const headerLine = lines[0]
    if (!headerLine) {
      return []
    }
    const headers = this.parseCSVLine(headerLine)

    // Parse data rows
    const records: ScrapedRecord[] = []
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]
      if (!line || line.trim().length === 0) {
        continue
      }

      const values = this.parseCSVLine(line)
      const record: ScrapedRecord = {}

      for (let j = 0; j < headers.length; j++) {
        const header = headers[j]
        const value = values[j]
        if (header) {
          // Try to parse as number if possible
          if (value !== undefined && value !== null && value !== '') {
            const numValue = Number(value)
            record[header] = isNaN(numValue) ? value : numValue
          } else {
            record[header] = null
          }
        }
      }

      records.push(record)
    }

    return records
  }

  /**
   * Parse a single CSV line handling quoted values
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]

      if (char === '"') {
        // Check for escaped quote
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++ // Skip next quote
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }

    // Add last field
    result.push(current.trim())

    return result
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
   * Delegates to CacheIntegrityValidator
   */
  private async detectCorruption(
    _filePath: string,
    content: string,
    date: string,
    type: CSVType,
    districtId?: string
  ): Promise<{ isValid: boolean; issues: string[] }> {
    const metadata = await this.getCacheMetadata(date)
    const filename = this.getFilename(type, districtId)
    return await this.integrityValidator.detectCorruption(
      content,
      metadata,
      filename
    )
  }

  /**
   * Attempt to recover from file corruption
   * Delegates to CacheIntegrityValidator
   */
  private async attemptCorruptionRecovery(
    _filePath: string,
    date: string,
    type: CSVType,
    districtId?: string
  ): Promise<{ success: boolean; actions: string[]; errors: string[] }> {
    const result = await this.integrityValidator.attemptCorruptionRecovery(
      this.cacheDir,
      date,
      type,
      districtId
    )

    // Update metadata to reflect file removal if recovery was successful
    if (result.success) {
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

          // Recalculate integrity totals using the validator
          const updatedMetadata =
            await this.integrityValidator.recalculateIntegrityTotals(
              this.cacheDir,
              date,
              metadata
            )
          await this.updateCacheMetadata(date, updatedMetadata)

          result.actions.push('Updated metadata to reflect file removal')
        }
      } catch (error) {
        const errorMsg = `Failed to update metadata during recovery: ${error instanceof Error ? error.message : 'Unknown error'}`
        result.errors.push(errorMsg)
        this.logger.error(
          'Failed to update metadata during corruption recovery',
          { date, error }
        )
      }
    }

    return result
  }

  /**
   * Circuit breaker methods for handling repeated failures
   * Delegates to CircuitBreaker class
   */
  private isCircuitBreakerOpen(): boolean {
    const stats = this.circuitBreaker.getStats()
    return stats.state === 'OPEN'
  }

  private recordCircuitBreakerFailure(error?: Error): void {
    // Record failure using the CircuitBreaker's recordFailure method
    // Pass the actual error so the expectedErrors filter can evaluate it
    const errorToRecord = error ?? new Error('Cache operation failed')
    this.circuitBreaker.recordFailure(errorToRecord, {
      service: 'RawCSVCacheService',
    })
  }

  private resetCircuitBreaker(): void {
    // Record success to reset failure count
    this.circuitBreaker.recordSuccess({ service: 'RawCSVCacheService' })
  }

  private getCircuitBreakerState(): object {
    const stats = this.circuitBreaker.getStats()
    return {
      failures: stats.failureCount,
      isOpen: stats.state === 'OPEN',
      lastFailureTime: stats.lastFailureTime?.getTime() ?? 0,
      halfOpenAttempts: stats.state === 'HALF_OPEN' ? 1 : 0,
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
        ...((error as { code?: string }).code && {
          code: (error as { code?: string }).code,
        }),
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
   * Ensure all cache operations remain within the designated cache directory
   * Delegates to CacheSecurityManager
   */
  private validateCacheDirectoryBounds(filePath: string): void {
    this.securityManager.validateCacheDirectoryBounds(filePath, this.cacheDir)
  }

  /**
   * Set appropriate file permissions for cached files
   * Delegates to CacheSecurityManager
   */
  private async setSecureFilePermissions(filePath: string): Promise<void> {
    await this.securityManager.setSecureFilePermissions(filePath)
  }

  /**
   * Set appropriate directory permissions for cache directories
   * Delegates to CacheSecurityManager
   */
  private async setSecureDirectoryPermissions(dirPath: string): Promise<void> {
    await this.securityManager.setSecureDirectoryPermissions(dirPath)
  }

  // Private helper methods

  /**
   * Validate date string format (YYYY-MM-DD) and prevent path traversal
   * Delegates to CacheSecurityManager
   */
  private validateDateString(date: string): void {
    this.securityManager.validateDateString(date)
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
   * Delegates to CacheSecurityManager
   */
  private validateDistrictId(districtId: string): void {
    this.securityManager.validateDistrictId(districtId)
  }

  /**
   * Validate CSV content before caching to prevent malicious content storage
   * Delegates to CacheSecurityManager
   */
  private validateCSVContent(csvContent: string): void {
    this.securityManager.validateCSVContent(
      csvContent,
      this.config.performanceThresholds.maxMemoryUsageMB
    )
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
   * Update cache metadata when a file is cached with enhanced closing period information
   */
  private async updateCacheMetadataForFileWithClosingInfo(
    date: string,
    type: CSVType,
    districtId: string | undefined,
    csvContent: string,
    additionalMetadata?: {
      requestedDate?: string
      isClosingPeriod?: boolean
      dataMonth?: string
    }
  ): Promise<void> {
    // First, do the standard metadata update
    await this.updateCacheMetadataForFile(date, type, districtId, csvContent)

    // Then, enhance with closing period information
    if (additionalMetadata) {
      const metadata = await this.getCacheMetadata(date)
      if (metadata) {
        // Add closing period specific metadata
        if (additionalMetadata.requestedDate) {
          metadata.requestedDate = additionalMetadata.requestedDate
        }
        if (additionalMetadata.isClosingPeriod !== undefined) {
          metadata.isClosingPeriod = additionalMetadata.isClosingPeriod
        }
        if (additionalMetadata.dataMonth) {
          metadata.dataMonth = additionalMetadata.dataMonth
        }

        await this.updateCacheMetadata(date, metadata)

        this.logger.debug('Enhanced metadata with closing period information', {
          date,
          requestedDate: additionalMetadata.requestedDate,
          isClosingPeriod: additionalMetadata.isClosingPeriod,
          dataMonth: additionalMetadata.dataMonth,
        })
      }
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
   * Delegates to CacheIntegrityValidator
   */
  private async recalculateIntegrityTotals(
    metadata: RawCSVCacheMetadata,
    date: string
  ): Promise<void> {
    const updatedMetadata =
      await this.integrityValidator.recalculateIntegrityTotals(
        this.cacheDir,
        date,
        metadata
      )
    // Update the passed metadata object with the recalculated values
    metadata.integrity.totalSize = updatedMetadata.integrity.totalSize
    metadata.integrity.fileCount = updatedMetadata.integrity.fileCount
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
