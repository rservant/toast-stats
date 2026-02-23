/**
 * GCS Raw CSV Storage Implementation
 *
 * Implements the IRawCSVStorage interface using Google Cloud Storage
 * for storing raw CSV files in a cloud bucket.
 *
 * Object Path Structure:
 * raw-csv/{date}/all-districts.csv
 * raw-csv/{date}/district-{id}/club-performance.csv
 * raw-csv/{date}/district-{id}/division-performance.csv
 * raw-csv/{date}/district-{id}/district-performance.csv
 * raw-csv/{date}/metadata.json
 *
 * Metadata stored alongside CSV files for atomic operations.
 *
 * Requirements: 3.1-3.6, 7.1-7.4
 */

import { Storage, Bucket, File } from '@google-cloud/storage'
import { logger } from '../../utils/logger.js'
import { CircuitBreaker } from '../../utils/CircuitBreaker.js'
import type {
  CSVType,
  RawCSVCacheMetadata,
  RawCSVCacheStatistics,
  CacheHealthStatus,
} from '../../types/rawCSVCache.js'
import type {
  IRawCSVStorage,
  CacheStorageInfo,
  ClosingPeriodMetadata,
} from '../../types/storageInterfaces.js'
import { StorageOperationError } from '../../types/storageInterfaces.js'

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Configuration for GCSRawCSVStorage
 */
export interface GCSRawCSVStorageConfig {
  projectId: string
  bucketName: string
}

// ============================================================================
// Constants
// ============================================================================

/** Base prefix for all raw CSV objects in GCS */
const RAW_CSV_PREFIX = 'raw-csv'

/** Metadata filename */
const METADATA_FILENAME = 'metadata.json'

// ============================================================================
// GCSRawCSVStorage Implementation
// ============================================================================

/**
 * Cloud Storage raw CSV storage implementation
 *
 * Stores raw CSV files in GCS with the following structure:
 * - CSV files organized by date and optional district
 * - Metadata stored as JSON objects alongside CSV files
 * - Path convention matches local filesystem implementation
 *
 * Features:
 * - Circuit breaker integration for resilience
 * - Proper error handling with StorageOperationError
 * - Consistent path conventions with local storage
 * - Metadata management for cache tracking
 */
export class GCSRawCSVStorage implements IRawCSVStorage {
  private readonly storage: Storage
  private readonly bucket: Bucket
  private readonly circuitBreaker: CircuitBreaker

  /**
   * Creates a new GCSRawCSVStorage instance
   *
   * @param config - Configuration containing projectId and bucketName
   */
  constructor(config: GCSRawCSVStorageConfig) {
    this.storage = new Storage({
      projectId: config.projectId,
    })
    this.bucket = this.storage.bucket(config.bucketName)
    this.circuitBreaker =
      CircuitBreaker.createCacheCircuitBreaker('gcs-raw-csv')

    logger.info('GCSRawCSVStorage initialized', {
      operation: 'constructor',
      projectId: config.projectId,
      bucketName: config.bucketName,
    })
  }

  // ============================================================================
  // Path Building Methods
  // ============================================================================

  /**
   * Build the GCS object path for a CSV file
   *
   * Path convention:
   * - All districts: raw-csv/{date}/all-districts.csv
   * - District-specific: raw-csv/{date}/district-{id}/{type}.csv
   *
   * @param date - Date in YYYY-MM-DD format
   * @param type - CSV type (all-districts, club-performance, etc.)
   * @param districtId - Optional district ID for district-specific files
   * @returns GCS object path
   */
  private buildObjectPath(
    date: string,
    type: CSVType,
    districtId?: string
  ): string {
    if (type === 'all-districts') {
      return `${RAW_CSV_PREFIX}/${date}/${type}.csv`
    }

    if (!districtId) {
      throw new StorageOperationError(
        `District ID required for CSV type: ${type}`,
        'buildObjectPath',
        'gcs',
        false
      )
    }

    return `${RAW_CSV_PREFIX}/${date}/district-${districtId}/${type}.csv`
  }

  /**
   * Build the GCS object path for metadata
   *
   * @param date - Date in YYYY-MM-DD format
   * @returns GCS object path for metadata
   */
  private buildMetadataPath(date: string): string {
    return `${RAW_CSV_PREFIX}/${date}/${METADATA_FILENAME}`
  }

  /**
   * Build the GCS prefix for a date directory
   *
   * @param date - Date in YYYY-MM-DD format
   * @returns GCS prefix for the date
   */
  private buildDatePrefix(date: string): string {
    return `${RAW_CSV_PREFIX}/${date}/`
  }

  // ============================================================================
  // Validation Methods
  // ============================================================================

  /**
   * Validate date string format (YYYY-MM-DD)
   */
  private validateDateString(date: string): void {
    if (typeof date !== 'string' || date.length === 0) {
      throw new StorageOperationError(
        'Invalid date: empty or non-string value',
        'validateDateString',
        'gcs',
        false
      )
    }

    const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
    if (!ISO_DATE_PATTERN.test(date)) {
      throw new StorageOperationError(
        `Invalid date format: ${date}. Expected YYYY-MM-DD`,
        'validateDateString',
        'gcs',
        false
      )
    }
  }

  /**
   * Validate CSV type
   */
  private validateCSVType(type: CSVType): void {
    const validTypes = [
      'all-districts',
      'club-performance',
      'division-performance',
      'district-performance',
    ]
    if (!validTypes.includes(type)) {
      throw new StorageOperationError(
        `Invalid CSV type: ${type}`,
        'validateCSVType',
        'gcs',
        false
      )
    }
  }

  /**
   * Validate district ID format
   */
  private validateDistrictId(districtId: string): void {
    if (typeof districtId !== 'string' || districtId.length === 0) {
      throw new StorageOperationError(
        'Invalid district ID: empty or non-string value',
        'validateDistrictId',
        'gcs',
        false
      )
    }

    // Allow alphanumeric characters only
    const DISTRICT_ID_PATTERN = /^[A-Za-z0-9]+$/
    if (!DISTRICT_ID_PATTERN.test(districtId)) {
      throw new StorageOperationError(
        `Invalid district ID format: ${districtId}`,
        'validateDistrictId',
        'gcs',
        false
      )
    }
  }

  /**
   * Determine if an error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase()
      // Network errors, timeouts, and server errors are retryable
      return (
        message.includes('network') ||
        message.includes('timeout') ||
        message.includes('unavailable') ||
        message.includes('deadline') ||
        message.includes('internal') ||
        message.includes('aborted') ||
        message.includes('econnreset') ||
        message.includes('enotfound') ||
        message.includes('econnrefused')
      )
    }
    return false
  }

  // ============================================================================
  // Core Cache Operations
  // ============================================================================

  /**
   * Get cached CSV content
   *
   * @param date - The date in YYYY-MM-DD format
   * @param type - The type of CSV file (all-districts, club-performance, etc.)
   * @param districtId - Optional district ID for district-specific files
   * @returns The CSV content as a string, or null if not cached
   */
  async getCachedCSV(
    date: string,
    type: CSVType,
    districtId?: string
  ): Promise<string | null> {
    const startTime = Date.now()

    this.validateDateString(date)
    this.validateCSVType(type)
    if (districtId) {
      this.validateDistrictId(districtId)
    }

    const objectPath = this.buildObjectPath(date, type, districtId)

    logger.debug('Starting getCachedCSV operation', {
      operation: 'getCachedCSV',
      date,
      type,
      districtId,
      objectPath,
    })

    try {
      return await this.circuitBreaker.execute(
        async () => {
          const file = this.bucket.file(objectPath)
          const [exists] = await file.exists()

          if (!exists) {
            logger.debug('Cache miss for CSV file', {
              operation: 'getCachedCSV',
              date,
              type,
              districtId,
              objectPath,
              duration_ms: Date.now() - startTime,
            })
            return null
          }

          const [content] = await file.download()
          const csvContent = content.toString('utf-8')

          logger.debug('Cache hit for CSV file', {
            operation: 'getCachedCSV',
            date,
            type,
            districtId,
            objectPath,
            size: csvContent.length,
            duration_ms: Date.now() - startTime,
          })

          return csvContent
        },
        { operation: 'getCachedCSV', date, type, districtId }
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to get cached CSV', {
        operation: 'getCachedCSV',
        date,
        type,
        districtId,
        objectPath,
        error: errorMessage,
        duration_ms: Date.now() - startTime,
      })

      throw new StorageOperationError(
        `Failed to get cached CSV for ${date}/${type}: ${errorMessage}`,
        'getCachedCSV',
        'gcs',
        this.isRetryableError(error),
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Store CSV content in cache
   *
   * @param date - The date in YYYY-MM-DD format
   * @param type - The type of CSV file (all-districts, club-performance, etc.)
   * @param csvContent - The CSV content to cache
   * @param districtId - Optional district ID for district-specific files
   */
  async setCachedCSV(
    date: string,
    type: CSVType,
    csvContent: string,
    districtId?: string
  ): Promise<void> {
    const startTime = Date.now()

    this.validateDateString(date)
    this.validateCSVType(type)
    if (districtId) {
      this.validateDistrictId(districtId)
    }

    const objectPath = this.buildObjectPath(date, type, districtId)

    logger.info('Starting setCachedCSV operation', {
      operation: 'setCachedCSV',
      date,
      type,
      districtId,
      objectPath,
      contentSize: csvContent.length,
    })

    try {
      await this.circuitBreaker.execute(
        async () => {
          const file = this.bucket.file(objectPath)
          await file.save(csvContent, {
            contentType: 'text/csv',
            metadata: {
              date,
              type,
              districtId: districtId ?? '',
              createdAt: new Date().toISOString(),
            },
          })

          // Update metadata
          await this.updateCacheMetadataForFile(date, type, districtId)

          logger.info('CSV file cached successfully', {
            operation: 'setCachedCSV',
            date,
            type,
            districtId,
            objectPath,
            size: csvContent.length,
            duration_ms: Date.now() - startTime,
          })
        },
        { operation: 'setCachedCSV', date, type, districtId }
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to cache CSV file', {
        operation: 'setCachedCSV',
        date,
        type,
        districtId,
        objectPath,
        error: errorMessage,
        duration_ms: Date.now() - startTime,
      })

      throw new StorageOperationError(
        `Failed to cache CSV for ${date}/${type}: ${errorMessage}`,
        'setCachedCSV',
        'gcs',
        this.isRetryableError(error),
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Store CSV content with additional metadata
   *
   * Enhanced cache operation for month-end closing periods that stores
   * CSV content along with metadata about the data's temporal context.
   *
   * @param date - The date in YYYY-MM-DD format (actual dashboard date)
   * @param type - The type of CSV file (all-districts, club-performance, etc.)
   * @param csvContent - The CSV content to cache
   * @param districtId - Optional district ID for district-specific files
   * @param additionalMetadata - Optional metadata for closing period handling
   */
  async setCachedCSVWithMetadata(
    date: string,
    type: CSVType,
    csvContent: string,
    districtId?: string,
    additionalMetadata?: ClosingPeriodMetadata
  ): Promise<void> {
    const startTime = Date.now()

    this.validateDateString(date)
    this.validateCSVType(type)
    if (districtId) {
      this.validateDistrictId(districtId)
    }

    const objectPath = this.buildObjectPath(date, type, districtId)

    logger.info('Starting setCachedCSVWithMetadata operation', {
      operation: 'setCachedCSVWithMetadata',
      date,
      type,
      districtId,
      objectPath,
      contentSize: csvContent.length,
      requestedDate: additionalMetadata?.requestedDate,
      isClosingPeriod: additionalMetadata?.isClosingPeriod,
      dataMonth: additionalMetadata?.dataMonth,
    })

    try {
      await this.circuitBreaker.execute(
        async () => {
          const file = this.bucket.file(objectPath)
          await file.save(csvContent, {
            contentType: 'text/csv',
            metadata: {
              date,
              type,
              districtId: districtId ?? '',
              createdAt: new Date().toISOString(),
              requestedDate: additionalMetadata?.requestedDate ?? '',
              isClosingPeriod: additionalMetadata?.isClosingPeriod
                ? 'true'
                : 'false',
              dataMonth: additionalMetadata?.dataMonth ?? '',
            },
          })

          // Update metadata with closing period info
          await this.updateCacheMetadataForFileWithClosingInfo(
            date,
            type,
            districtId,
            additionalMetadata
          )

          logger.info('CSV file cached successfully with enhanced metadata', {
            operation: 'setCachedCSVWithMetadata',
            date,
            type,
            districtId,
            objectPath,
            size: csvContent.length,
            duration_ms: Date.now() - startTime,
          })
        },
        { operation: 'setCachedCSVWithMetadata', date, type, districtId }
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to cache CSV file with enhanced metadata', {
        operation: 'setCachedCSVWithMetadata',
        date,
        type,
        districtId,
        objectPath,
        error: errorMessage,
        duration_ms: Date.now() - startTime,
      })

      throw new StorageOperationError(
        `Failed to cache CSV with metadata for ${date}/${type}: ${errorMessage}`,
        'setCachedCSVWithMetadata',
        'gcs',
        this.isRetryableError(error),
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Check if a CSV file is cached
   *
   * @param date - The date in YYYY-MM-DD format
   * @param type - The type of CSV file (all-districts, club-performance, etc.)
   * @param districtId - Optional district ID for district-specific files
   * @returns True if the CSV file is cached
   */
  async hasCachedCSV(
    date: string,
    type: CSVType,
    districtId?: string
  ): Promise<boolean> {
    const startTime = Date.now()

    try {
      this.validateDateString(date)
      this.validateCSVType(type)
      if (districtId) {
        this.validateDistrictId(districtId)
      }

      const objectPath = this.buildObjectPath(date, type, districtId)

      return await this.circuitBreaker.execute(
        async () => {
          const file = this.bucket.file(objectPath)
          const [exists] = await file.exists()

          logger.debug('Checked CSV existence', {
            operation: 'hasCachedCSV',
            date,
            type,
            districtId,
            objectPath,
            exists,
            duration_ms: Date.now() - startTime,
          })

          return exists
        },
        { operation: 'hasCachedCSV', date, type, districtId }
      )
    } catch (error) {
      logger.error('Failed to check cached CSV existence', {
        operation: 'hasCachedCSV',
        date,
        type,
        districtId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration_ms: Date.now() - startTime,
      })
      return false
    }
  }

  // ============================================================================
  // Metadata Management
  // ============================================================================

  /**
   * Get cache metadata for a date
   *
   * @param date - The date in YYYY-MM-DD format
   * @returns Cache metadata or null if no cache exists for the date
   */
  async getCacheMetadata(date: string): Promise<RawCSVCacheMetadata | null> {
    const startTime = Date.now()

    try {
      this.validateDateString(date)

      const metadataPath = this.buildMetadataPath(date)

      return await this.circuitBreaker.execute(
        async () => {
          const file = this.bucket.file(metadataPath)
          const [exists] = await file.exists()

          if (!exists) {
            logger.debug('Metadata not found', {
              operation: 'getCacheMetadata',
              date,
              metadataPath,
              duration_ms: Date.now() - startTime,
            })
            return null
          }

          const [content] = await file.download()
          const metadata = JSON.parse(
            content.toString('utf-8')
          ) as RawCSVCacheMetadata

          logger.debug('Retrieved cache metadata', {
            operation: 'getCacheMetadata',
            date,
            metadataPath,
            duration_ms: Date.now() - startTime,
          })

          return metadata
        },
        { operation: 'getCacheMetadata', date }
      )
    } catch (error) {
      logger.error('Failed to get cache metadata', {
        operation: 'getCacheMetadata',
        date,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration_ms: Date.now() - startTime,
      })
      return null
    }
  }

  /**
   * Update cache metadata for a date
   *
   * @param date - The date in YYYY-MM-DD format
   * @param metadata - Partial metadata to merge with existing metadata
   */
  async updateCacheMetadata(
    date: string,
    metadata: Partial<RawCSVCacheMetadata>
  ): Promise<void> {
    const startTime = Date.now()

    try {
      this.validateDateString(date)

      const metadataPath = this.buildMetadataPath(date)

      await this.circuitBreaker.execute(
        async () => {
          // Get existing metadata or create new
          let existingMetadata = await this.getCacheMetadata(date)
          if (!existingMetadata) {
            existingMetadata = this.createDefaultMetadata(date)
          }

          // Merge metadata
          const updatedMetadata = { ...existingMetadata, ...metadata }

          // Write updated metadata
          const file = this.bucket.file(metadataPath)
          await file.save(JSON.stringify(updatedMetadata, null, 2), {
            contentType: 'application/json',
            metadata: {
              date,
              updatedAt: new Date().toISOString(),
            },
          })

          logger.debug('Cache metadata updated', {
            operation: 'updateCacheMetadata',
            date,
            metadataPath,
            duration_ms: Date.now() - startTime,
          })
        },
        { operation: 'updateCacheMetadata', date }
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to update cache metadata', {
        operation: 'updateCacheMetadata',
        date,
        error: errorMessage,
        duration_ms: Date.now() - startTime,
      })

      throw new StorageOperationError(
        `Failed to update cache metadata for ${date}: ${errorMessage}`,
        'updateCacheMetadata',
        'gcs',
        this.isRetryableError(error),
        error instanceof Error ? error : undefined
      )
    }
  }

  // ============================================================================
  // Cache Management
  // ============================================================================

  /**
   * Clear all cached files for a date
   *
   * @param date - The date in YYYY-MM-DD format
   */
  async clearCacheForDate(date: string): Promise<void> {
    const startTime = Date.now()

    try {
      this.validateDateString(date)

      const prefix = this.buildDatePrefix(date)

      await this.circuitBreaker.execute(
        async () => {
          // List all objects with the date prefix
          const [files] = await this.bucket.getFiles({ prefix })

          if (files.length === 0) {
            logger.info('No files to clear for date', {
              operation: 'clearCacheForDate',
              date,
              prefix,
              duration_ms: Date.now() - startTime,
            })
            return
          }

          // Delete all files
          await Promise.all(files.map((file: File) => file.delete()))

          logger.info('Cache cleared for date', {
            operation: 'clearCacheForDate',
            date,
            prefix,
            filesDeleted: files.length,
            duration_ms: Date.now() - startTime,
          })
        },
        { operation: 'clearCacheForDate', date }
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to clear cache for date', {
        operation: 'clearCacheForDate',
        date,
        error: errorMessage,
        duration_ms: Date.now() - startTime,
      })

      throw new StorageOperationError(
        `Failed to clear cache for ${date}: ${errorMessage}`,
        'clearCacheForDate',
        'gcs',
        this.isRetryableError(error),
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Get all cached dates
   *
   * @returns Array of cached dates in YYYY-MM-DD format
   */
  async getCachedDates(): Promise<string[]> {
    const startTime = Date.now()

    try {
      return await this.circuitBreaker.execute(
        async () => {
          // List all objects with the raw-csv prefix
          const [files] = await this.bucket.getFiles({
            prefix: `${RAW_CSV_PREFIX}/`,
          })

          // Extract unique dates from file paths
          const dateSet = new Set<string>()
          for (const file of files) {
            // Extract date from path like "raw-csv/2024-01-15/..."
            const match = file.name.match(/raw-csv\/(\d{4}-\d{2}-\d{2})\//)
            if (match?.[1]) {
              dateSet.add(match[1])
            }
          }

          const dates = Array.from(dateSet).sort().reverse() // Newest first

          logger.debug('Retrieved cached dates', {
            operation: 'getCachedDates',
            count: dates.length,
            duration_ms: Date.now() - startTime,
          })

          return dates
        },
        { operation: 'getCachedDates' }
      )
    } catch (error) {
      logger.error('Failed to get cached dates', {
        operation: 'getCachedDates',
        error: error instanceof Error ? error.message : 'Unknown error',
        duration_ms: Date.now() - startTime,
      })
      return []
    }
  }

  // ============================================================================
  // Health and Statistics
  // ============================================================================

  /**
   * Get cache storage information
   *
   * @returns Cache storage information
   */
  async getCacheStorageInfo(): Promise<CacheStorageInfo> {
    const startTime = Date.now()

    try {
      return await this.circuitBreaker.execute(
        async () => {
          const dates = await this.getCachedDates()
          const recommendations: string[] = []
          let totalFiles = 0
          let totalSize = 0

          // Get file count and size from listing
          const [files] = await this.bucket.getFiles({
            prefix: `${RAW_CSV_PREFIX}/`,
          })
          totalFiles = files.length

          for (const file of files) {
            const [metadata] = await file.getMetadata()
            totalSize += parseInt(String(metadata.size ?? '0'), 10)
          }

          const totalSizeMB = totalSize / (1024 * 1024)
          const isLargeCache = totalSizeMB > 1000 // 1GB warning threshold

          // Generate recommendations
          if (isLargeCache) {
            recommendations.push(
              `Cache size (${totalSizeMB.toFixed(2)}MB) exceeds warning threshold (1000MB)`
            )
            recommendations.push('Consider monitoring storage costs regularly')
          }

          if (dates.length > 365) {
            recommendations.push(
              `Cache contains ${dates.length} date directories spanning over a year`
            )
            recommendations.push(
              'Consider archiving very old data if storage costs become an issue'
            )
          }

          if (totalFiles > 10000) {
            recommendations.push(
              `Cache contains ${totalFiles} files which may impact listing performance`
            )
          }

          if (recommendations.length === 0) {
            recommendations.push('Cache storage is within normal parameters')
          }

          const result: CacheStorageInfo = {
            totalSizeMB,
            totalFiles,
            oldestDate:
              dates.length > 0 ? (dates[dates.length - 1] ?? null) : null,
            newestDate: dates.length > 0 ? (dates[0] ?? null) : null,
            isLargeCache,
            recommendations,
          }

          logger.info('Cache storage information retrieved', {
            operation: 'getCacheStorageInfo',
            ...result,
            duration_ms: Date.now() - startTime,
          })

          return result
        },
        { operation: 'getCacheStorageInfo' }
      )
    } catch (error) {
      logger.error('Failed to get cache storage information', {
        operation: 'getCacheStorageInfo',
        error: error instanceof Error ? error.message : 'Unknown error',
        duration_ms: Date.now() - startTime,
      })

      throw new StorageOperationError(
        `Failed to get cache storage info: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'getCacheStorageInfo',
        'gcs',
        this.isRetryableError(error),
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Get cache statistics
   *
   * @returns Detailed cache statistics
   */
  async getCacheStatistics(): Promise<RawCSVCacheStatistics> {
    const startTime = Date.now()

    try {
      return await this.circuitBreaker.execute(
        async () => {
          const dates = await this.getCachedDates()
          let totalFiles = 0
          let totalSize = 0
          let totalHits = 0
          let totalMisses = 0
          const fileSizes: number[] = []

          // Get file statistics
          const [files] = await this.bucket.getFiles({
            prefix: `${RAW_CSV_PREFIX}/`,
          })
          totalFiles = files.length

          for (const file of files) {
            const [metadata] = await file.getMetadata()
            const size = parseInt(String(metadata.size ?? '0'), 10)
            totalSize += size
            fileSizes.push(size)
          }

          // Get hit/miss stats from metadata files
          for (const date of dates.slice(0, 30)) {
            // Sample last 30 dates for performance
            try {
              const metadata = await this.getCacheMetadata(date)
              if (metadata) {
                totalHits += metadata.downloadStats.cacheHits
                totalMisses += metadata.downloadStats.cacheMisses
              }
            } catch {
              // Ignore errors for individual metadata files
            }
          }

          const averageFileSize =
            fileSizes.length > 0
              ? fileSizes.reduce((sum, size) => sum + size, 0) /
                fileSizes.length
              : 0

          const totalRequests = totalHits + totalMisses
          const hitRatio = totalRequests > 0 ? totalHits / totalRequests : 0
          const missRatio = totalRequests > 0 ? totalMisses / totalRequests : 0

          const result: RawCSVCacheStatistics = {
            totalCachedDates: dates.length,
            totalCachedFiles: totalFiles,
            totalCacheSize: totalSize,
            hitRatio,
            missRatio,
            averageFileSize,
            oldestCacheDate:
              dates.length > 0 ? (dates[dates.length - 1] ?? null) : null,
            newestCacheDate: dates.length > 0 ? (dates[0] ?? null) : null,
            diskUsage: {
              used: totalSize,
              available: 0, // Not applicable for GCS
              percentUsed: 0, // Not applicable for GCS
            },
            performance: {
              averageReadTime: 0, // Would need to track over time
              averageWriteTime: 0, // Would need to track over time
              slowestOperations: [],
            },
          }

          logger.debug('Cache statistics retrieved', {
            operation: 'getCacheStatistics',
            totalDates: dates.length,
            totalFiles,
            totalSizeMB: totalSize / (1024 * 1024),
            duration_ms: Date.now() - startTime,
          })

          return result
        },
        { operation: 'getCacheStatistics' }
      )
    } catch (error) {
      logger.error('Failed to get cache statistics', {
        operation: 'getCacheStatistics',
        error: error instanceof Error ? error.message : 'Unknown error',
        duration_ms: Date.now() - startTime,
      })

      throw new StorageOperationError(
        `Failed to get cache statistics: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'getCacheStatistics',
        'gcs',
        this.isRetryableError(error),
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Get cache health status
   *
   * @returns Cache health status
   */
  async getHealthStatus(): Promise<CacheHealthStatus> {
    const startTime = Date.now()
    const errors: string[] = []
    const warnings: string[] = []
    let isAccessible = false
    let hasWritePermissions = false

    try {
      // Check if bucket is accessible
      try {
        await this.bucket.getMetadata()
        isAccessible = true
      } catch (error) {
        errors.push(
          `Bucket is not accessible: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }

      // Check write permissions by attempting to write a test file
      if (isAccessible) {
        try {
          const testFile = this.bucket.file(
            `${RAW_CSV_PREFIX}/.health-check-${Date.now()}`
          )
          await testFile.save('test', { contentType: 'text/plain' })
          await testFile.delete()
          hasWritePermissions = true
        } catch (error) {
          errors.push(
            `Bucket is not writable: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        }
      }

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

      // Check storage info for warnings
      if (isAccessible) {
        try {
          const storageInfo = await this.getCacheStorageInfo()

          if (storageInfo.isLargeCache) {
            warnings.push(
              `Cache size is large (${storageInfo.totalSizeMB.toFixed(2)}MB) - monitor storage costs regularly`
            )
          }

          if (storageInfo.totalFiles > 10000) {
            warnings.push(
              `Large number of cached files (${storageInfo.totalFiles}) - may impact listing performance`
            )
          }
        } catch (error) {
          warnings.push(
            `Unable to check cache storage info: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        }
      }

      const result: CacheHealthStatus = {
        isHealthy: errors.length === 0,
        cacheDirectory: `gs://${this.bucket.name}/${RAW_CSV_PREFIX}`,
        isAccessible,
        hasWritePermissions,
        diskSpaceAvailable: 0, // Not applicable for GCS (virtually unlimited)
        lastSuccessfulOperation: Date.now(),
        errors,
        warnings,
      }

      logger.info('Health status checked', {
        operation: 'getHealthStatus',
        isHealthy: result.isHealthy,
        isAccessible,
        hasWritePermissions,
        errorCount: errors.length,
        warningCount: warnings.length,
        duration_ms: Date.now() - startTime,
      })

      return result
    } catch (error) {
      errors.push(
        `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )

      return {
        isHealthy: false,
        cacheDirectory: `gs://${this.bucket.name}/${RAW_CSV_PREFIX}`,
        isAccessible: false,
        hasWritePermissions: false,
        diskSpaceAvailable: 0,
        lastSuccessfulOperation: null,
        errors,
        warnings,
      }
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

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
      source: 'collector',
      cacheVersion: 1,
    }
  }

  /**
   * Get program year for a date (same logic as collector-cli)
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
    districtId?: string
  ): Promise<void> {
    try {
      let metadata = await this.getCacheMetadata(date)
      if (!metadata) {
        metadata = this.createDefaultMetadata(date)
      }

      // Update file tracking
      if (type === 'all-districts') {
        metadata.csvFiles.allDistricts = true
      } else if (districtId) {
        if (!metadata.csvFiles.districts[districtId]) {
          metadata.csvFiles.districts[districtId] = {
            districtPerformance: false,
            divisionPerformance: false,
            clubPerformance: false,
          }
        }

        const districtFiles = metadata.csvFiles.districts[districtId]
        if (districtFiles) {
          if (type === 'district-performance') {
            districtFiles.districtPerformance = true
          } else if (type === 'division-performance') {
            districtFiles.divisionPerformance = true
          } else if (type === 'club-performance') {
            districtFiles.clubPerformance = true
          }
        }
      }

      // Update download stats
      metadata.downloadStats.totalDownloads++
      metadata.downloadStats.lastAccessed = Date.now()

      // Update integrity info
      metadata.integrity.fileCount++

      await this.updateCacheMetadata(date, metadata)
    } catch (error) {
      // Log but don't fail the main operation
      logger.warn('Failed to update cache metadata for file', {
        operation: 'updateCacheMetadataForFile',
        date,
        type,
        districtId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  /**
   * Update cache metadata with closing period information
   */
  private async updateCacheMetadataForFileWithClosingInfo(
    date: string,
    type: CSVType,
    districtId?: string,
    additionalMetadata?: ClosingPeriodMetadata
  ): Promise<void> {
    try {
      // First do the standard metadata update
      await this.updateCacheMetadataForFile(date, type, districtId)

      // Then enhance with closing period information if provided
      if (additionalMetadata) {
        const metadata = await this.getCacheMetadata(date)
        if (metadata) {
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
        }
      }
    } catch (error) {
      // Log but don't fail the main operation
      logger.warn('Failed to update cache metadata with closing info', {
        operation: 'updateCacheMetadataForFileWithClosingInfo',
        date,
        type,
        districtId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }
}
