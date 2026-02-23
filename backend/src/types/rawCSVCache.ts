/**
 * Raw CSV Cache System Types
 *
 * Type definitions for the raw CSV caching system that stores CSV downloads
 * from the collector-cli and provides cache-first lookup for the backend.
 */

/**
 * CSV file type enumeration for strongly-typed cache operations
 */
export enum CSVType {
  ALL_DISTRICTS = 'all-districts',
  DISTRICT_PERFORMANCE = 'district-performance',
  DIVISION_PERFORMANCE = 'division-performance',
  CLUB_PERFORMANCE = 'club-performance',
}

/**
 * Cache metadata for each cached date directory
 */
export interface RawCSVCacheMetadata {
  date: string // YYYY-MM-DD format (actual dashboard date)
  requestedDate?: string // YYYY-MM-DD format (originally requested date, if different)
  timestamp: number // When cache was created
  programYear: string // e.g., "2024-2025"
  dataMonth?: string // YYYY-MM format (which month the data represents, for closing periods)
  isClosingPeriod?: boolean // True if this data was collected during month-end closing
  csvFiles: {
    // Track cached files
    allDistricts: boolean
    districts: {
      [districtId: string]: {
        districtPerformance: boolean
        divisionPerformance: boolean
        clubPerformance: boolean
      }
    }
  }
  downloadStats: {
    totalDownloads: number
    cacheHits: number
    cacheMisses: number
    lastAccessed: number
  }
  integrity: {
    checksums: { [filename: string]: string }
    totalSize: number
    fileCount: number
  }
  source: 'collector'
  cacheVersion: number
}

/**
 * Cache statistics for monitoring and observability
 */
export interface RawCSVCacheStatistics {
  totalCachedDates: number
  totalCachedFiles: number
  totalCacheSize: number
  hitRatio: number
  missRatio: number
  averageFileSize: number
  oldestCacheDate: string | null
  newestCacheDate: string | null
  diskUsage: {
    used: number
    available: number
    percentUsed: number
  }
  performance: {
    averageReadTime: number
    averageWriteTime: number
    slowestOperations: Array<{
      operation: string
      duration: number
      timestamp: string
    }>
  }
}

/**
 * Cache health status for monitoring
 */
export interface CacheHealthStatus {
  isHealthy: boolean
  cacheDirectory: string
  isAccessible: boolean
  hasWritePermissions: boolean
  diskSpaceAvailable: number
  lastSuccessfulOperation: number | null
  errors: string[]
  warnings: string[]
}

/**
 * Cache cleanup operation result
 */
export interface CleanupResult {
  deletedDates: string[]
  deletedFiles: number
  freedSpace: number
  errors: string[]
}

/**
 * Raw CSV cache configuration
 */
export interface RawCSVCacheConfig {
  cacheDir: string
  enableCompression: boolean
  performanceThresholds: {
    maxReadTimeMs: number
    maxWriteTimeMs: number
    maxMemoryUsageMB: number
    enablePerformanceLogging: boolean
  }
  security: {
    validatePaths: boolean
    sanitizeInputs: boolean
    enforcePermissions: boolean
  }
  monitoring: {
    enableDetailedStats: boolean
    trackSlowOperations: boolean
    maxSlowOperationsHistory: number
    storageSizeWarningMB: number
  }
}

/**
 * Month-end closing period handling interface
 */
export interface MonthEndClosingInfo {
  isClosingPeriod: boolean
  dataMonth: string // YYYY-MM format
  actualDate: string // YYYY-MM-DD format (dashboard date)
  requestedDate: string // YYYY-MM-DD format (originally requested date)
}

/**
 * Month-end data mapping service interface
 */
export interface IMonthEndDataMapper {
  /**
   * Determine if a date falls during a month-end closing period
   */
  detectClosingPeriod(
    requestedDate: string,
    actualDashboardDate: string
  ): MonthEndClosingInfo

  /**
   * Get the appropriate CSV date for a given processed data date
   * Returns null if no data should be available (expected gap)
   */
  getCSVDateForProcessedDate(processedDate: string): Promise<string | null>

  /**
   * Get the last day data for a given month (uses closing period data)
   */
  getMonthEndData(month: string, year: number): Promise<string | null>

  /**
   * Check if a date should have no data due to closing period
   */
  isExpectedDataGap(date: string): Promise<boolean>
}

/**
 * Default cache configuration values
 */
export const DEFAULT_RAW_CSV_CACHE_CONFIG: RawCSVCacheConfig = {
  cacheDir: './cache/raw-csv',
  enableCompression: false,
  performanceThresholds: {
    maxReadTimeMs: 5000,
    maxWriteTimeMs: 10000,
    maxMemoryUsageMB: 100,
    enablePerformanceLogging: true,
  },
  security: {
    validatePaths: true,
    sanitizeInputs: true,
    enforcePermissions: true,
  },
  monitoring: {
    enableDetailedStats: true,
    trackSlowOperations: true,
    maxSlowOperationsHistory: 50,
    storageSizeWarningMB: 1000, // Warn when cache exceeds 1GB
  },
}
