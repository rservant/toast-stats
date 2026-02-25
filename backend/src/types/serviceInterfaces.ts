/**
 * Service Interfaces for Dependency Injection
 *
 * Defines interfaces for all injectable services to support interface-based
 * dependency injection and mock substitution for testing.
 */

import type { DistrictCacheEntry, DistrictStatistics } from './districts.js'
import type {
  Snapshot,
  SnapshotMetadata,
  SnapshotFilters,
  AllDistrictsRankingsData,
} from './snapshots.js'
import type { PerDistrictSnapshotMetadata } from '../services/snapshot/types.js'
import type {
  CSVType,
  RawCSVCacheMetadata,
  RawCSVCacheStatistics,
  CacheHealthStatus,
  RawCSVCacheConfig,
} from './rawCSVCache.js'

/**
 * Integrity validation result
 */
export interface IntegrityValidationResult {
  isValid: boolean
  issues: string[]
  actualStats: { fileCount: number; totalSize: number }
  metadataStats: { fileCount: number; totalSize: number }
}

/**
 * Corruption detection result
 */
export interface CorruptionDetectionResult {
  isValid: boolean
  issues: string[]
}

/**
 * Recovery operation result
 */
export interface RecoveryResult {
  success: boolean
  actions: string[]
  errors: string[]
}

/**
 * Cache Integrity Validator Interface
 *
 * Handles metadata validation, corruption detection, and recovery operations
 * for the raw CSV cache system.
 */
export interface ICacheIntegrityValidator {
  /**
   * Validate metadata integrity against actual files on disk
   * @param cacheDir - Base cache directory path
   * @param date - Date string (YYYY-MM-DD format)
   * @param metadata - Current metadata to validate
   * @returns Validation result with issues and statistics
   */
  validateMetadataIntegrity(
    cacheDir: string,
    date: string,
    metadata: RawCSVCacheMetadata | null
  ): Promise<IntegrityValidationResult>

  /**
   * Detect corruption in cached CSV content
   * @param content - CSV content to validate
   * @param metadata - Associated metadata for checksum verification
   * @param filename - Filename for checksum lookup
   * @returns Corruption detection result
   */
  detectCorruption(
    content: string,
    metadata: RawCSVCacheMetadata | null,
    filename: string
  ): Promise<CorruptionDetectionResult>

  /**
   * Attempt to recover from file corruption
   * @param cacheDir - Base cache directory path
   * @param date - Date string (YYYY-MM-DD format)
   * @param type - CSV type
   * @param districtId - Optional district ID
   * @returns Recovery result with actions taken
   */
  attemptCorruptionRecovery(
    cacheDir: string,
    date: string,
    type: CSVType,
    districtId?: string
  ): Promise<RecoveryResult>

  /**
   * Recalculate integrity totals from actual files
   * @param cacheDir - Base cache directory path
   * @param date - Date string (YYYY-MM-DD format)
   * @param metadata - Metadata to update
   * @returns Updated metadata with recalculated totals
   */
  recalculateIntegrityTotals(
    cacheDir: string,
    date: string,
    metadata: RawCSVCacheMetadata
  ): Promise<RawCSVCacheMetadata>

  /**
   * Repair metadata integrity by recalculating from actual files
   * @param cacheDir - Base cache directory path
   * @param date - Date string (YYYY-MM-DD format)
   * @param existingMetadata - Existing metadata or null
   * @returns Repair result
   */
  repairMetadataIntegrity(
    cacheDir: string,
    date: string,
    existingMetadata: RawCSVCacheMetadata | null
  ): Promise<RecoveryResult>
}
import type {
  CircuitBreakerOptions,
  CircuitBreaker,
  CircuitBreakerStats,
} from '../utils/CircuitBreaker.js'
import type {
  DistrictConfiguration,
  ConfigurationChange,
  ConfigurationValidationResult,
} from '../services/DistrictConfigurationService.js'
import type { AvailableRankingYearsResponse } from './districts.js'

/**
 * Security configuration subset for CacheSecurityManager
 */
export interface SecurityConfig {
  validatePaths: boolean
  sanitizeInputs: boolean
  enforcePermissions: boolean
}

/**
 * Cache Security Manager Interface
 *
 * Handles path safety validation, directory bounds checking, file permissions,
 * and content security validation for the raw CSV cache system.
 */
export interface ICacheSecurityManager {
  /**
   * Validate path safety to prevent path traversal attacks
   * @param input - Input string to validate
   * @param inputType - Description of input type for error messages
   * @throws Error if path contains dangerous patterns
   */
  validatePathSafety(input: string, inputType: string): void

  /**
   * Validate that a file path is within cache directory bounds
   * @param filePath - File path to validate
   * @param cacheDir - Base cache directory
   * @throws Error if path is outside bounds
   */
  validateCacheDirectoryBounds(filePath: string, cacheDir: string): void

  /**
   * Set secure file permissions (owner read/write only)
   * @param filePath - Path to file
   */
  setSecureFilePermissions(filePath: string): Promise<void>

  /**
   * Set secure directory permissions (owner access only)
   * @param dirPath - Path to directory
   */
  setSecureDirectoryPermissions(dirPath: string): Promise<void>

  /**
   * Validate CSV content for security issues
   * @param csvContent - CSV content to validate
   * @throws Error if content contains malicious patterns
   */
  validateCSVContentSecurity(csvContent: string): void

  /**
   * Sanitize district ID by removing dangerous characters
   * @param districtId - District ID to sanitize
   * @returns Sanitized district ID
   */
  sanitizeDistrictId(districtId: string): string

  /**
   * Validate district ID format and security
   * @param districtId - District ID to validate
   * @throws Error if district ID is invalid
   */
  validateDistrictId(districtId: string): void

  /**
   * Validate date string format
   * @param date - Date string to validate
   * @throws Error if date format is invalid
   */
  validateDateString(date: string): void

  /**
   * Validate CSV content (non-empty, size limits, structure)
   * @param csvContent - CSV content to validate
   * @param maxSizeMB - Maximum allowed size in MB
   * @throws Error if content is invalid
   */
  validateCSVContent(csvContent: string, maxSizeMB: number): void
}

/**
 * Logger interface for dependency injection
 */
export interface ILogger {
  info(message: string, data?: unknown): void
  warn(message: string, data?: unknown): void
  error(message: string, error?: Error | unknown): void
  debug(message: string, data?: unknown): void
}

/**
 * Circuit Breaker Manager Interface
 */
export interface ICircuitBreakerManager {
  getCircuitBreaker(
    name: string,
    options?: Partial<CircuitBreakerOptions>
  ): CircuitBreaker
  getAllStats(): Record<string, CircuitBreakerStats>
  resetAll(): void
  dispose(): Promise<void>
}

/**
 * District Configuration Service Interface
 */
export interface IDistrictConfigurationService {
  getConfiguredDistricts(): Promise<string[]>
  addDistrict(districtId: string, adminUser?: string): Promise<void>
  removeDistrict(districtId: string, adminUser?: string): Promise<void>
  setConfiguredDistricts(
    districtIds: string[],
    adminUser?: string
  ): Promise<void>
  validateDistrictId(districtId: string): boolean
  getConfigurationHistory(): Promise<ConfigurationChange[]>
  getConfiguration(): Promise<DistrictConfiguration>
  hasConfiguredDistricts(): Promise<boolean>
  validateConfiguration(
    allDistrictIds?: string[]
  ): Promise<ConfigurationValidationResult>
  clearCache(): void
}

/**
 * Cache Configuration Service Interface
 */
export interface ICacheConfigService {
  getCacheDirectory(): string
  getConfiguration(): {
    baseDirectory: string
    isConfigured: boolean
    source: 'environment' | 'default' | 'test'
    validationStatus: {
      isValid: boolean
      isAccessible: boolean
      isSecure: boolean
      errorMessage?: string
    }
  }
  initialize(): Promise<void>
  validateCacheDirectory(): Promise<void>
  isReady(): boolean
  dispose(): Promise<void>
}

/**
 * Backfill Service Interface
 */
export interface IBackfillService {
  startBackfill(
    startDate: string,
    endDate: string,
    options?: { force?: boolean }
  ): Promise<string>
  getBackfillStatus(jobId: string): Promise<{
    id: string
    status: 'pending' | 'running' | 'completed' | 'failed'
    progress: number
    error?: string
  } | null>
  cancelBackfill(jobId: string): Promise<void>
  dispose(): Promise<void>
}

/**
 * District Backfill Service Interface
 */
export interface IDistrictBackfillService {
  startDistrictBackfill(
    districtId: string,
    startDate: string,
    endDate: string,
    options?: { force?: boolean }
  ): Promise<string>
  getDistrictBackfillStatus(jobId: string): Promise<{
    id: string
    districtId: string
    status: 'pending' | 'running' | 'completed' | 'failed'
    progress: number
    error?: string
  } | null>
  cancelDistrictBackfill(jobId: string): Promise<void>
}

/**
 * Unified Backfill Service Interface
 * Modern interface that replaces both IBackfillService and IDistrictBackfillService
 */
export interface IUnifiedBackfillService {
  initiateBackfill(request: {
    targetDistricts?: string[]
    startDate: string
    endDate?: string
    collectionType?: 'system-wide' | 'per-district' | 'auto'
    concurrency?: number
    retryFailures?: boolean
    skipExisting?: boolean
  }): Promise<string>

  getBackfillStatus(backfillId: string): Promise<{
    backfillId: string
    status: 'processing' | 'complete' | 'error' | 'cancelled'
    scope: {
      targetDistricts: string[]
      configuredDistricts: string[]
      scopeType: 'system-wide' | 'targeted' | 'single-district'
      validationPassed: boolean
    }
    progress: {
      total: number
      completed: number
      skipped: number
      unavailable: number
      failed: number
      current: string
      districtProgress: Map<
        string,
        {
          districtId: string
          status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped'
          datesProcessed: number
          datesTotal: number
          lastError?: string
        }
      >
    }
    collectionStrategy: {
      type: 'system-wide' | 'per-district' | 'targeted'
      refreshMethod: {
        name:
          | 'getAllDistricts'
          | 'getDistrictPerformance'
          | 'getMultipleDistricts'
        params: Record<string, unknown>
      }
      rationale: string
      estimatedEfficiency: number
      targetDistricts?: string[]
    }
    error?: string
    snapshotIds: string[]
  } | null>

  cancelBackfill(backfillId: string): Promise<boolean>
  cleanupOldJobs(): Promise<void>
  dispose(): Promise<void>
}

/**
 * Cache Service Interface
 */
export interface ICacheService {
  get<T>(key: string): T | undefined
  set<T>(key: string, value: T, ttl?: number): boolean
  del(key: string): number
  flush(): void
  keys(): string[]
  has(key: string): boolean
  ttl(key: string): number
  getStats(): {
    keys: number
    hits: number
    misses: number
    ksize: number
    vsize: number
  }
  dispose(): Promise<void>
}

/**
 * Cache Update Manager Interface
 */
export interface ICacheUpdateManager {
  updateDistrictCache(
    districtId: string,
    data: DistrictCacheEntry
  ): Promise<void>
  backupDistrictCache(districtId: string): Promise<void>
  restoreDistrictCache(districtId: string): Promise<void>
  validateCacheIntegrity(districtId: string): Promise<boolean>
  dispose(): Promise<void>
}

/**
 * Snapshot Store Interface
 */
export interface ISnapshotStore {
  getLatestSuccessful(): Promise<Snapshot | null>
  getLatest(): Promise<Snapshot | null>
  writeSnapshot(snapshot: Snapshot): Promise<void>
  listSnapshots(
    limit?: number,
    filters?: SnapshotFilters
  ): Promise<SnapshotMetadata[]>
  getSnapshot(snapshotId: string): Promise<Snapshot | null>
  isReady(): Promise<boolean>
}

/**
 * Raw CSV Cache Service Interface
 */
export interface IRawCSVCacheService {
  // Core cache operations
  getCachedCSV(
    date: string,
    type: CSVType,
    districtId?: string
  ): Promise<string | null>
  setCachedCSV(
    date: string,
    type: CSVType,
    csvContent: string,
    districtId?: string
  ): Promise<void>

  // Enhanced cache operation for month-end closing periods
  setCachedCSVWithMetadata(
    date: string,
    type: CSVType,
    csvContent: string,
    districtId?: string,
    additionalMetadata?: {
      requestedDate?: string
      isClosingPeriod?: boolean
      dataMonth?: string
    }
  ): Promise<void>

  hasCachedCSV(
    date: string,
    type: CSVType,
    districtId?: string
  ): Promise<boolean>

  // Metadata management
  getCacheMetadata(date: string): Promise<RawCSVCacheMetadata | null>
  updateCacheMetadata(
    date: string,
    metadata: Partial<RawCSVCacheMetadata>
  ): Promise<void>
  validateMetadataIntegrity(date: string): Promise<{
    isValid: boolean
    issues: string[]
    actualStats: { fileCount: number; totalSize: number }
    metadataStats: { fileCount: number; totalSize: number }
  }>
  repairMetadataIntegrity(date: string): Promise<{
    success: boolean
    repairedFields: string[]
    errors: string[]
  }>

  // Cache management
  clearCacheForDate(date: string): Promise<void>
  getCachedDates(): Promise<string[]>

  // Manual maintenance (no automatic cleanup)
  getCacheStorageInfo(): Promise<{
    totalSizeMB: number
    totalFiles: number
    oldestDate: string | null
    newestDate: string | null
    isLargeCache: boolean
    recommendations: string[]
  }>

  // Configuration management
  getConfiguration(): RawCSVCacheConfig
  updateConfiguration(updates: Partial<RawCSVCacheConfig>): void
  resetConfiguration(): void

  // Statistics and monitoring
  getCacheStatistics(): Promise<RawCSVCacheStatistics>
  getHealthStatus(): Promise<CacheHealthStatus>
  clearPerformanceHistory(): void

  // Error handling and recovery
  getCircuitBreakerStatus(): {
    isOpen: boolean
    failures: number
    lastFailureTime: number | null
    timeSinceLastFailure: number | null
    halfOpenAttempts: number
  }
  resetCircuitBreakerManually(): void

  // Service lifecycle
  dispose(): Promise<void>
}

/**
 * Snapshot Info for Analytics Data Source
 * Lightweight metadata about snapshots for date range filtering
 */
export interface AnalyticsSnapshotInfo {
  /** Snapshot ID (ISO date format: YYYY-MM-DD) */
  snapshotId: string
  /** Status of the snapshot */
  status: 'success' | 'partial' | 'failed'
  /** ISO timestamp when snapshot was created */
  createdAt: string
  /** The date the data represents (business date) */
  dataAsOfDate: string
}

/**
 * Available Program Years Service Interface
 *
 * Provides access to program years with ranking data for a district.
 * Used by the Global Rankings tab to display available program years.
 *
 * Requirements: 2.1, 2.3 (Global Rankings feature)
 */
export interface IAvailableProgramYearsService {
  /**
   * Get all program years with ranking data available for a district
   *
   * @param districtId - The district ID to query
   * @returns Promise resolving to available program years result
   */
  getAvailableProgramYears(
    districtId: string
  ): Promise<AvailableRankingYearsResponse>
}

/**
 * Analytics Data Source Interface
 *
 * Provides an abstraction layer for analytics computation to access district data
 * from the new PerDistrictSnapshotStore format. This interface enables dependency
 * injection and supports the migration from DistrictCacheManager to the new
 * snapshot-based data architecture.
 *
 * Requirements: 1.1, 2.1, 2.2, 2.3
 */
export interface IAnalyticsDataSource {
  /**
   * Get district data from a specific snapshot
   *
   * @param snapshotId - The snapshot ID (ISO date format: YYYY-MM-DD)
   * @param districtId - The district ID to retrieve
   * @returns District statistics or null if not found
   */
  getDistrictData(
    snapshotId: string,
    districtId: string
  ): Promise<DistrictStatistics | null>

  /**
   * Get snapshots within a date range
   *
   * Filters snapshots based on the provided date range parameters.
   * Only returns successful snapshots by default.
   *
   * Requirements: 2.1, 2.2, 2.3
   *
   * @param startDate - Optional start date (inclusive, YYYY-MM-DD format)
   * @param endDate - Optional end date (inclusive, YYYY-MM-DD format)
   * @returns Array of snapshot info within the date range, sorted newest first
   */
  getSnapshotsInRange(
    startDate?: string,
    endDate?: string
  ): Promise<AnalyticsSnapshotInfo[]>

  /**
   * Get the latest successful snapshot
   *
   * @returns The latest successful snapshot or null if none exists
   */
  getLatestSnapshot(): Promise<Snapshot | null>

  /**
   * Get snapshot metadata for a specific snapshot
   *
   * @param snapshotId - The snapshot ID (ISO date format: YYYY-MM-DD)
   * @returns Snapshot metadata or null if not found
   */
  getSnapshotMetadata(
    snapshotId: string
  ): Promise<PerDistrictSnapshotMetadata | null>

  /**
   * Get all districts rankings data from a specific snapshot
   *
   * Used for region ranking calculations and world percentile display.
   * Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4
   *
   * @param snapshotId - The snapshot ID (ISO date format: YYYY-MM-DD)
   * @returns All districts rankings data or null if not found
   */
  getAllDistrictsRankings(
    snapshotId: string
  ): Promise<AllDistrictsRankingsData | null>
}
