/**
 * Storage Provider Interfaces for GCP Migration
 *
 * This module defines the storage abstraction layer interfaces that enable
 * swappable implementations for snapshot and CSV storage operations.
 *
 * The interfaces mirror existing service contracts for compatibility:
 * - ISnapshotStorage mirrors SnapshotStore + PerDistrictSnapshotStoreInterface
 * - IRawCSVStorage mirrors IRawCSVCacheService
 *
 * Requirements: 1.1, 1.2, 6.1, 6.2, 6.3
 */

import type { DistrictStatistics } from './districts.js'
import type {
  Snapshot,
  SnapshotMetadata,
  SnapshotFilters,
  AllDistrictsRankingsData,
} from './snapshots.js'
import type {
  SnapshotManifest,
  PerDistrictSnapshotMetadata,
  WriteSnapshotOptions,
} from '../services/SnapshotStore.js'
import type {
  CSVType,
  RawCSVCacheMetadata,
  RawCSVCacheStatistics,
  CacheHealthStatus,
} from './rawCSVCache.js'
import type {
  TimeSeriesDataPoint,
  ProgramYearIndex,
} from './precomputedAnalytics.js'
import type {
  DistrictConfiguration,
  ConfigurationChange,
} from '../services/DistrictConfigurationService.js'

/**
 * Closing period metadata for CSV caching
 *
 * Used when storing CSV files during month-end closing periods
 * to track the relationship between requested and actual dates.
 */
export interface ClosingPeriodMetadata {
  requestedDate?: string
  isClosingPeriod?: boolean
  dataMonth?: string
}

/**
 * Cache storage information for monitoring and maintenance
 *
 * Provides summary information about the cache storage state
 * including size, file counts, and maintenance recommendations.
 */
export interface CacheStorageInfo {
  totalSizeMB: number
  totalFiles: number
  oldestDate: string | null
  newestDate: string | null
  isLargeCache: boolean
  recommendations: string[]
}

/**
 * Snapshot storage interface - abstracts snapshot persistence
 *
 * This interface defines the contract for snapshot storage operations,
 * enabling swappable implementations for local filesystem and cloud storage.
 *
 * Mirrors the existing SnapshotStore and PerDistrictSnapshotStoreInterface
 * for compatibility with existing business logic.
 *
 * Requirements: 1.1, 6.1, 6.2, 6.3
 */
export interface ISnapshotStorage {
  // ============================================================================
  // Core Snapshot Operations
  // ============================================================================

  /**
   * Get the most recent successful snapshot
   *
   * Returns the latest snapshot with status 'success', or null if no
   * successful snapshots exist. Used as the default data source for
   * read operations.
   *
   * @returns Latest successful snapshot or null if none exists
   */
  getLatestSuccessful(): Promise<Snapshot | null>

  /**
   * Get the most recent snapshot regardless of status
   *
   * Returns the latest snapshot by date, regardless of whether it was
   * successful, partial, or failed. Useful for debugging and monitoring.
   *
   * @returns Latest snapshot or null if none exists
   */
  getLatest(): Promise<Snapshot | null>

  /**
   * Write a new snapshot atomically
   *
   * Persists a complete snapshot including all district data. The operation
   * should be atomic - either all data is written successfully or the
   * operation fails without partial writes.
   *
   * @param snapshot - The snapshot to persist
   * @param allDistrictsRankings - Optional rankings data to store with the snapshot
   * @param options - Optional write options (e.g., override snapshot date for closing periods)
   */
  writeSnapshot(
    snapshot: Snapshot,
    allDistrictsRankings?: AllDistrictsRankingsData,
    options?: WriteSnapshotOptions
  ): Promise<void>

  /**
   * List snapshots with optional filtering and limiting
   *
   * Returns lightweight metadata about snapshots for listing and debugging.
   * Results are sorted by creation date (newest first).
   *
   * @param limit - Maximum number of snapshots to return
   * @param filters - Optional filters for status, version, date range, etc.
   * @returns Array of snapshot metadata sorted by creation date (newest first)
   */
  listSnapshots(
    limit?: number,
    filters?: SnapshotFilters
  ): Promise<SnapshotMetadata[]>

  /**
   * List all snapshot IDs without reading metadata
   *
   * Returns just the snapshot identifiers (YYYY-MM-DD dates) by listing
   * storage prefixes/directories. Much faster than listSnapshots() because
   * it avoids reading metadata files for each snapshot.
   *
   * @returns Array of snapshot IDs sorted newest-first
   */
  listSnapshotIds(): Promise<string[]>

  /**
   * Check if a specific district exists in a snapshot
   *
   * Performs a single file existence check rather than listing all districts.
   * Much faster than listDistrictsInSnapshot() when checking one district.
   *
   * @param snapshotId - The snapshot ID (ISO date format: YYYY-MM-DD)
   * @param districtId - The district identifier to check for
   * @returns True if the district exists in the snapshot
   */
  hasDistrictInSnapshot(
    snapshotId: string,
    districtId: string
  ): Promise<boolean>

  /**
   * Get a specific snapshot by ID
   *
   * Retrieves a complete snapshot including all district data by its
   * unique identifier (ISO date format: YYYY-MM-DD).
   *
   * @param snapshotId - The unique identifier of the snapshot
   * @returns The snapshot or null if not found
   */
  getSnapshot(snapshotId: string): Promise<Snapshot | null>

  /**
   * Delete a snapshot and all its associated data
   *
   * Removes the snapshot document/directory and all district data.
   * Does NOT handle cascading deletion of time-series or analytics data -
   * that responsibility belongs to the calling code (e.g., admin routes).
   *
   * @param snapshotId - The snapshot ID (ISO date format: YYYY-MM-DD)
   * @returns true if the snapshot was successfully deleted, false if it didn't exist
   * @throws StorageOperationError on deletion failure (e.g., permission denied, I/O error)
   */
  deleteSnapshot(snapshotId: string): Promise<boolean>

  /**
   * Check if the storage is properly initialized and accessible
   *
   * Verifies that the storage backend is ready for operations. This may
   * include checking directory existence, database connectivity, or
   * authentication status.
   *
   * @returns True if the storage is ready for operations
   */
  isReady(): Promise<boolean>

  // ============================================================================
  // Per-District Operations
  // ============================================================================

  /**
   * Write district data to a snapshot
   *
   * Stores individual district statistics within a snapshot. Used for
   * incremental snapshot building and per-district updates.
   *
   * @param snapshotId - The snapshot ID (ISO date format: YYYY-MM-DD)
   * @param districtId - The district identifier
   * @param data - The district statistics to store
   */
  writeDistrictData(
    snapshotId: string,
    districtId: string,
    data: DistrictStatistics
  ): Promise<void>

  /**
   * Read district data from a snapshot
   *
   * Retrieves individual district statistics from a snapshot. Returns null
   * if the district data doesn't exist or failed to load.
   *
   * @param snapshotId - The snapshot ID (ISO date format: YYYY-MM-DD)
   * @param districtId - The district identifier
   * @returns District statistics or null if not found
   */
  readDistrictData(
    snapshotId: string,
    districtId: string
  ): Promise<DistrictStatistics | null>

  /**
   * List all districts in a snapshot
   *
   * Returns the IDs of all successfully stored districts within a snapshot.
   * Failed districts are excluded from the list.
   *
   * @param snapshotId - The snapshot ID (ISO date format: YYYY-MM-DD)
   * @returns Array of district IDs
   */
  listDistrictsInSnapshot(snapshotId: string): Promise<string[]>

  /**
   * Get snapshot manifest
   *
   * Retrieves the manifest listing all district files within a snapshot,
   * including their status, file sizes, and any error messages.
   *
   * @param snapshotId - The snapshot ID (ISO date format: YYYY-MM-DD)
   * @returns Snapshot manifest or null if not found
   */
  getSnapshotManifest(snapshotId: string): Promise<SnapshotManifest | null>

  /**
   * Get snapshot metadata
   *
   * Retrieves the per-district snapshot metadata including status,
   * configured districts, successful/failed districts, and error details.
   *
   * @param snapshotId - The snapshot ID (ISO date format: YYYY-MM-DD)
   * @returns Snapshot metadata or null if not found
   */
  getSnapshotMetadata(
    snapshotId: string
  ): Promise<PerDistrictSnapshotMetadata | null>

  // ============================================================================
  // Rankings Operations
  // ============================================================================

  /**
   * Write all-districts rankings data to a snapshot
   *
   * Stores the BordaCount rankings data for all districts worldwide
   * within a snapshot.
   *
   * @param snapshotId - The snapshot ID (ISO date format: YYYY-MM-DD)
   * @param rankingsData - The rankings data to store
   */
  writeAllDistrictsRankings(
    snapshotId: string,
    rankingsData: AllDistrictsRankingsData
  ): Promise<void>

  /**
   * Read all-districts rankings data from a snapshot
   *
   * Retrieves the BordaCount rankings data for all districts worldwide
   * from a snapshot.
   *
   * @param snapshotId - The snapshot ID (ISO date format: YYYY-MM-DD)
   * @returns Rankings data or null if not found
   */
  readAllDistrictsRankings(
    snapshotId: string
  ): Promise<AllDistrictsRankingsData | null>

  /**
   * Check if all-districts rankings exist for a snapshot
   *
   * Verifies whether rankings data has been stored for a given snapshot
   * without loading the full data.
   *
   * @param snapshotId - The snapshot ID (ISO date format: YYYY-MM-DD)
   * @returns True if rankings data exists
   */
  hasAllDistrictsRankings(snapshotId: string): Promise<boolean>

  // ============================================================================
  // Write Completion Check
  // ============================================================================

  /**
   * Check if a snapshot write completed fully
   *
   * Determines whether a snapshot was fully written or if some districts
   * failed during the chunked write process. This is useful for identifying
   * snapshots that may have partial data due to write failures.
   *
   * Return value logic:
   * - Returns `true` if the write completed fully
   * - Returns `true` if the snapshot is a legacy snapshot without the writeComplete field (backward compatibility)
   * - Returns `false` if the write was partial (some districts failed)
   * - Returns `false` if the snapshot doesn't exist
   *
   * @param snapshotId - The snapshot ID (ISO date format: YYYY-MM-DD)
   * @returns true if the write completed fully (or for legacy snapshots),
   *          false if the write was partial or snapshot doesn't exist
   *
   * Requirements: 5.5
   */
  isSnapshotWriteComplete(snapshotId: string): Promise<boolean>
}

/**
 * Raw CSV storage interface - abstracts CSV file caching
 *
 * This interface defines the contract for raw CSV cache operations,
 * enabling swappable implementations for local filesystem and cloud storage.
 *
 * Mirrors the existing IRawCSVCacheService interface for compatibility
 * with existing business logic. This interface focuses on storage operations
 * and excludes service-specific concerns like configuration management,
 * circuit breaker status, and service lifecycle.
 *
 * Requirements: 1.2, 6.1, 6.2, 6.3
 */
export interface IRawCSVStorage {
  // ============================================================================
  // Core Cache Operations
  // ============================================================================

  /**
   * Get cached CSV content
   *
   * Retrieves the content of a cached CSV file for the specified date,
   * type, and optional district. Returns null if the file is not cached.
   *
   * @param date - The date in YYYY-MM-DD format
   * @param type - The type of CSV file (all-districts, club-performance, etc.)
   * @param districtId - Optional district ID for district-specific files
   * @returns The CSV content as a string, or null if not cached
   */
  getCachedCSV(
    date: string,
    type: CSVType,
    districtId?: string
  ): Promise<string | null>

  /**
   * Store CSV content in cache
   *
   * Caches the content of a CSV file for the specified date, type,
   * and optional district. Overwrites any existing cached content.
   *
   * @param date - The date in YYYY-MM-DD format
   * @param type - The type of CSV file (all-districts, club-performance, etc.)
   * @param csvContent - The CSV content to cache
   * @param districtId - Optional district ID for district-specific files
   */
  setCachedCSV(
    date: string,
    type: CSVType,
    csvContent: string,
    districtId?: string
  ): Promise<void>

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
  setCachedCSVWithMetadata(
    date: string,
    type: CSVType,
    csvContent: string,
    districtId?: string,
    additionalMetadata?: ClosingPeriodMetadata
  ): Promise<void>

  /**
   * Check if a CSV file is cached
   *
   * Verifies whether a CSV file exists in the cache without loading
   * its content. Useful for cache-first lookup patterns.
   *
   * @param date - The date in YYYY-MM-DD format
   * @param type - The type of CSV file (all-districts, club-performance, etc.)
   * @param districtId - Optional district ID for district-specific files
   * @returns True if the CSV file is cached
   */
  hasCachedCSV(
    date: string,
    type: CSVType,
    districtId?: string
  ): Promise<boolean>

  // ============================================================================
  // Metadata Management
  // ============================================================================

  /**
   * Get cache metadata for a date
   *
   * Retrieves the metadata for all cached files for a specific date,
   * including file inventory, download statistics, and integrity info.
   *
   * @param date - The date in YYYY-MM-DD format
   * @returns Cache metadata or null if no cache exists for the date
   */
  getCacheMetadata(date: string): Promise<RawCSVCacheMetadata | null>

  /**
   * Update cache metadata for a date
   *
   * Partially updates the metadata for a cached date. Only the provided
   * fields are updated; other fields remain unchanged.
   *
   * @param date - The date in YYYY-MM-DD format
   * @param metadata - Partial metadata to merge with existing metadata
   */
  updateCacheMetadata(
    date: string,
    metadata: Partial<RawCSVCacheMetadata>
  ): Promise<void>

  // ============================================================================
  // Cache Management
  // ============================================================================

  /**
   * Clear all cached files for a date
   *
   * Removes all cached CSV files and metadata for the specified date.
   * This operation is irreversible.
   *
   * @param date - The date in YYYY-MM-DD format
   */
  clearCacheForDate(date: string): Promise<void>

  /**
   * Get all cached dates
   *
   * Returns a list of all dates that have cached CSV files.
   * Dates are returned in YYYY-MM-DD format, sorted newest first.
   *
   * @returns Array of cached dates in YYYY-MM-DD format
   */
  getCachedDates(): Promise<string[]>

  // ============================================================================
  // Health and Statistics
  // ============================================================================

  /**
   * Get cache storage information
   *
   * Returns summary information about the cache storage state including
   * total size, file counts, date range, and maintenance recommendations.
   *
   * @returns Cache storage information
   */
  getCacheStorageInfo(): Promise<CacheStorageInfo>

  /**
   * Get cache statistics
   *
   * Returns detailed statistics about cache usage including hit/miss ratios,
   * disk usage, and performance metrics.
   *
   * @returns Detailed cache statistics
   */
  getCacheStatistics(): Promise<RawCSVCacheStatistics>

  /**
   * Get cache health status
   *
   * Returns the health status of the cache including accessibility,
   * permissions, disk space, and any errors or warnings.
   *
   * @returns Cache health status
   */
  getHealthStatus(): Promise<CacheHealthStatus>
}

/**
 * District configuration storage interface - abstracts district config persistence
 *
 * This interface defines the contract for district configuration storage operations,
 * enabling swappable implementations for local filesystem and Firestore storage.
 *
 * Mirrors the existing storage abstraction pattern used by ISnapshotStorage
 * and IRawCSVStorage for consistency across the storage layer.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */
export interface IDistrictConfigStorage {
  // ============================================================================
  // Core Configuration Operations
  // ============================================================================

  /**
   * Get the current district configuration
   *
   * Retrieves the stored district configuration including the list of
   * configured districts, timestamps, and version information.
   * Returns null if no configuration exists.
   *
   * @returns The district configuration or null if not found
   */
  getConfiguration(): Promise<DistrictConfiguration | null>

  /**
   * Save the district configuration
   *
   * Persists the district configuration atomically. The operation should
   * either succeed completely or fail without partial writes.
   *
   * @param config - The district configuration to persist
   */
  saveConfiguration(config: DistrictConfiguration): Promise<void>

  // ============================================================================
  // Audit Log Operations
  // ============================================================================

  /**
   * Append a configuration change to the audit log
   *
   * Records a configuration change for audit trail purposes. Changes are
   * appended to the history and should not modify existing entries.
   *
   * @param change - The configuration change to record
   */
  appendChangeLog(change: ConfigurationChange): Promise<void>

  /**
   * Get configuration change history
   *
   * Retrieves the most recent configuration changes from the audit log.
   * Results are returned in reverse chronological order (most recent first).
   *
   * @param limit - Maximum number of changes to return
   * @returns Array of configuration changes sorted by timestamp (newest first)
   */
  getChangeHistory(limit: number): Promise<ConfigurationChange[]>

  // ============================================================================
  // Health Check
  // ============================================================================

  /**
   * Check if the storage is properly initialized and accessible
   *
   * Verifies that the storage backend is ready for operations. This may
   * include checking directory existence, database connectivity, or
   * authentication status. Returns false without throwing when storage
   * is unavailable.
   *
   * @returns True if the storage is ready for operations
   */
  isReady(): Promise<boolean>
}

/**
 * Time-series index storage interface - abstracts time-series data persistence
 *
 * This interface defines the contract for time-series index operations,
 * enabling swappable implementations for local filesystem and Firestore storage.
 *
 * The time-series index stores date-indexed analytics summaries across all
 * snapshots, enabling efficient trend queries without loading individual
 * snapshot data. Data is partitioned by program year (July 1 - June 30) to
 * limit file sizes and support efficient range queries.
 *
 * Requirements: 4.1, 4.2, 4.3
 */
export interface ITimeSeriesIndexStorage {
  // ============================================================================
  // Core Time-Series Operations (Read-Only)
  // ============================================================================

  /**
   * Get trend data for a date range
   *
   * Retrieves all time-series data points for a district within the
   * specified date range (inclusive). Results are returned in
   * chronological order.
   *
   * @param districtId - The district identifier (e.g., "42", "61", "F")
   * @param startDate - Start date in ISO format (YYYY-MM-DD)
   * @param endDate - End date in ISO format (YYYY-MM-DD)
   * @returns Array of time-series data points in chronological order
   * @throws StorageOperationError on read failure
   */
  getTrendData(
    districtId: string,
    startDate: string,
    endDate: string
  ): Promise<TimeSeriesDataPoint[]>

  /**
   * Get all data for a program year
   *
   * Retrieves the complete program year index for a district, including
   * all data points and summary statistics. Returns null if no data
   * exists for the specified program year.
   *
   * @param districtId - The district identifier (e.g., "42", "61", "F")
   * @param programYear - Program year identifier (e.g., "2023-2024")
   * @returns Program year index or null if not found
   * @throws StorageOperationError on read failure
   */
  getProgramYearData(
    districtId: string,
    programYear: string
  ): Promise<ProgramYearIndex | null>

  // ============================================================================
  // Deletion Operations
  // ============================================================================

  /**
   * Delete all time-series entries for a specific snapshot
   *
   * Removes all data points associated with a given snapshot ID across
   * all districts and program years. This is used during cascading
   * deletion to clean up time-series data when a snapshot is deleted.
   *
   * The operation scans all districts and program years to find and
   * remove entries where the snapshotId matches. This may be a slow
   * operation for large datasets.
   *
   * @param snapshotId - The snapshot ID to remove entries for (ISO date format: YYYY-MM-DD)
   * @returns Number of entries removed across all districts
   * @throws StorageOperationError on deletion failure
   */
  deleteSnapshotEntries(snapshotId: string): Promise<number>

  // ============================================================================
  // Health Check
  // ============================================================================

  /**
   * Check if the storage is properly initialized and accessible
   *
   * Verifies that the storage backend is ready for operations. This may
   * include checking directory existence, database connectivity, or
   * authentication status. Returns false without throwing when storage
   * is unavailable.
   *
   * @returns True if the storage is ready for operations
   */
  isReady(): Promise<boolean>
}

// ============================================================================
// Storage Configuration Types
// ============================================================================

/**
 * Storage provider type
 *
 * Defines the available storage backend implementations:
 * - 'local': Local filesystem storage for development
 * - 'gcp': Google Cloud Platform storage (Firestore + GCS) for production
 */
export type StorageProviderType = 'local' | 'gcp'

/**
 * Local storage provider configuration
 *
 * Configuration options for the local filesystem storage provider.
 * Used for development environments without GCP credentials.
 */
export interface LocalStorageConfig {
  /**
   * Base directory for cache storage
   *
   * All snapshot and CSV cache files will be stored under this directory.
   * Should be an absolute path or relative to the application root.
   */
  cacheDir: string
}

/**
 * GCP storage provider configuration
 *
 * Configuration options for the Google Cloud Platform storage provider.
 * Requires valid GCP credentials and project access.
 */
export interface GCPStorageConfig {
  /**
   * GCP project identifier
   *
   * The Google Cloud project ID where Cloud Storage
   * resources are provisioned.
   */
  projectId: string

  /**
   * Cloud Storage bucket name
   *
   * The GCS bucket name for storing all data.
   * Must be globally unique and accessible by the service account.
   */
  bucketName: string
}

/**
 * Storage configuration
 *
 * Configuration for storage providers, enabling environment-based
 * selection between local filesystem and GCP cloud storage.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */
export interface StorageConfig {
  /**
   * Storage provider type
   *
   * Determines which storage backend implementation to use.
   * - 'local': Uses local filesystem (development)
   * - 'gcp': Uses Cloud Firestore + Cloud Storage (production)
   */
  provider: StorageProviderType

  /**
   * Local provider configuration
   *
   * Required when provider is 'local'.
   * Contains filesystem-specific settings.
   */
  local?: LocalStorageConfig

  /**
   * GCP provider configuration
   *
   * Required when provider is 'gcp'.
   * Contains GCP-specific settings including project and bucket names.
   */
  gcp?: GCPStorageConfig
}

// ============================================================================
// Storage Error Types
// ============================================================================

/**
 * Provider type for error context
 *
 * Identifies the specific storage backend that generated an error.
 * More granular than StorageProviderType to distinguish between
 * Firestore and GCS within the GCP provider.
 */
export type StorageErrorProvider = 'local' | 'gcs'

/**
 * Base error class for storage operations
 *
 * Provides a common base for all storage-related errors with
 * consistent context information for debugging and logging.
 *
 * Requirements: 7.1, 7.2
 */
export class StorageError extends Error {
  /**
   * Creates a new StorageError
   *
   * @param message - Human-readable error description
   * @param operation - The storage operation that failed (e.g., 'writeSnapshot', 'getCachedCSV')
   * @param provider - The storage provider that generated the error
   * @param cause - The underlying error that caused this failure (optional)
   */
  constructor(
    message: string,
    public readonly operation: string,
    public readonly provider: StorageErrorProvider,
    public readonly cause?: Error
  ) {
    super(message)
    this.name = 'StorageError'

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, StorageError.prototype)

    // Capture stack trace, excluding constructor call from it
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, StorageError)
    }
  }
}

/**
 * Error when storage is not properly configured
 *
 * Thrown during provider initialization when required configuration
 * is missing or invalid. Includes details about which configuration
 * values are missing to aid in troubleshooting.
 *
 * Requirements: 5.7
 */
export class StorageConfigurationError extends StorageError {
  /**
   * Creates a new StorageConfigurationError
   *
   * @param message - Human-readable error description
   * @param missingConfig - Array of missing configuration keys
   */
  constructor(
    message: string,
    public readonly missingConfig: string[]
  ) {
    // Configuration errors are always related to initialization
    super(message, 'initialize', 'local')
    this.name = 'StorageConfigurationError'

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, StorageConfigurationError.prototype)
  }
}

/**
 * Error when a storage operation fails
 *
 * Thrown when a specific storage operation (read, write, delete, etc.)
 * fails. Includes information about whether the operation can be retried,
 * which is useful for implementing retry logic and circuit breakers.
 *
 * Requirements: 7.1, 7.2
 */
export class StorageOperationError extends StorageError {
  /**
   * Creates a new StorageOperationError
   *
   * @param message - Human-readable error description
   * @param operation - The storage operation that failed
   * @param provider - The storage provider that generated the error
   * @param retryable - Whether the operation can be safely retried
   * @param cause - The underlying error that caused this failure (optional)
   */
  constructor(
    message: string,
    operation: string,
    provider: StorageErrorProvider,
    public readonly retryable: boolean,
    cause?: Error
  ) {
    super(message, operation, provider, cause)
    this.name = 'StorageOperationError'

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, StorageOperationError.prototype)
  }
}
