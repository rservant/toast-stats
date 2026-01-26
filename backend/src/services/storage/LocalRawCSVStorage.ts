/**
 * Local Filesystem Raw CSV Storage
 *
 * Implements the IRawCSVStorage interface by delegating to the existing
 * RawCSVCacheService implementation. This adapter enables the storage
 * abstraction layer to use local filesystem storage for development
 * environments without requiring GCP credentials.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */

import type {
  CSVType,
  RawCSVCacheMetadata,
  RawCSVCacheStatistics,
  CacheHealthStatus,
} from '../../types/rawCSVCache.js'
import type {
  ILogger,
  ICacheConfigService,
} from '../../types/serviceInterfaces.js'
import type {
  IRawCSVStorage,
  CacheStorageInfo,
  ClosingPeriodMetadata,
} from '../../types/storageInterfaces.js'
import { RawCSVCacheService } from '../RawCSVCacheService.js'

/**
 * Local filesystem raw CSV storage implementation
 *
 * Delegates all operations to the existing RawCSVCacheService implementation,
 * providing a consistent interface for the storage abstraction layer.
 *
 * This class acts as an adapter that:
 * - Implements the IRawCSVStorage interface
 * - Wraps the existing RawCSVCacheService
 * - Maintains full feature parity with cloud providers for testing
 * - Requires no GCP credentials or network connectivity
 *
 * @example
 * ```typescript
 * const storage = new LocalRawCSVStorage(cacheConfigService, logger)
 * const csv = await storage.getCachedCSV('2024-01-15', 'all-districts')
 * ```
 */
export class LocalRawCSVStorage implements IRawCSVStorage {
  private readonly cache: RawCSVCacheService

  /**
   * Creates a new LocalRawCSVStorage instance
   *
   * @param cacheConfigService - Service providing cache configuration
   * @param logger - Logger for diagnostic output
   */
  constructor(cacheConfigService: ICacheConfigService, logger: ILogger) {
    this.cache = new RawCSVCacheService(cacheConfigService, logger)
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
    return this.cache.getCachedCSV(date, type, districtId)
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
    return this.cache.setCachedCSV(date, type, csvContent, districtId)
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
    return this.cache.setCachedCSVWithMetadata(
      date,
      type,
      csvContent,
      districtId,
      additionalMetadata
    )
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
    return this.cache.hasCachedCSV(date, type, districtId)
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
    return this.cache.getCacheMetadata(date)
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
    return this.cache.updateCacheMetadata(date, metadata)
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
    return this.cache.clearCacheForDate(date)
  }

  /**
   * Get all cached dates
   *
   * @returns Array of cached dates in YYYY-MM-DD format
   */
  async getCachedDates(): Promise<string[]> {
    return this.cache.getCachedDates()
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
    return this.cache.getCacheStorageInfo()
  }

  /**
   * Get cache statistics
   *
   * @returns Detailed cache statistics
   */
  async getCacheStatistics(): Promise<RawCSVCacheStatistics> {
    return this.cache.getCacheStatistics()
  }

  /**
   * Get cache health status
   *
   * @returns Cache health status
   */
  async getHealthStatus(): Promise<CacheHealthStatus> {
    return this.cache.getHealthStatus()
  }
}
