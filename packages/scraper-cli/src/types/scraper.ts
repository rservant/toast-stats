/**
 * Scraper Types
 *
 * Type definitions shared between the scraper and other components.
 * These types are extracted from the backend to enable standalone operation.
 *
 * Requirements:
 * - 8.3: THE ToastmastersScraper class SHALL be moved to the Scraper_CLI package
 * - 5.1: THE Scraper_CLI SHALL operate without requiring the backend to be running
 */

/**
 * Raw scraped data types (CSV records with dynamic columns)
 * This is the primary type for data returned from scraping operations.
 */
export type ScrapedRecord = Record<string, string | number | null>

/**
 * District information from dropdown
 */
export interface DistrictInfo {
  id: string
  name: string
}

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
 * Raw CSV performance data interfaces (from dashboard exports)
 */
export interface ClubPerformanceRecord {
  'Club Number': string
  'Club Name': string
  Division: string
  Area: string
  'Active Members': string
  'Goals Met': string
  'Club Status'?: string
  'Club Distinguished Status'?: string
  'Mem. Base'?: string
  Status?: string
  Membership?: string
  [key: string]: string | undefined
}

export interface DivisionPerformanceRecord {
  Division: string
  'Total Clubs': string
  'Total Members': string
  'Goals Met': string
  [key: string]: string | undefined
}

export interface DistrictPerformanceRecord {
  District: string
  'Total Clubs': string
  'Total Members': string
  'Goals Met': string
  'Distinguished Clubs': string
  [key: string]: string | undefined
}

/**
 * Raw CSV data from getAllDistricts API call
 */
export interface AllDistrictsCSVRecord {
  DISTRICT: string
  REGION: string
  'Paid Clubs': string
  'Paid Club Base': string
  '% Club Growth': string
  'Total YTD Payments': string
  'Payment Base': string
  '% Payment Growth': string
  'Active Clubs': string
  'Total Distinguished Clubs': string
  'Select Distinguished Clubs': string
  'Presidents Distinguished Clubs'?: string
  [key: string]: string | undefined
}

/**
 * Cache metadata interface for the scraper
 */
export interface CacheMetadata {
  date: string
  isClosingPeriod?: boolean
  dataMonth?: string
}

/**
 * Interface for cache operations
 * This allows the scraper to work with different cache implementations
 */
export interface IScraperCache {
  getCachedCSV(
    date: string,
    type: CSVType,
    districtId?: string
  ): Promise<string | null>
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
  getCacheMetadata(date: string): Promise<CacheMetadata | null>
}

/**
 * Fallback navigation information stored in the cache
 *
 * When the scraper successfully uses fallback navigation for a date (e.g., during
 * closing periods), this information is cached so subsequent CSV downloads for
 * the same date can skip the initial failed attempt and go directly to the fallback URL.
 *
 * Requirements:
 * - 2.1: THE Fallback_Cache SHALL store the requested date as the cache key
 * - 2.2: THE Fallback_Cache SHALL store the fallback month parameter that succeeded
 * - 2.3: THE Fallback_Cache SHALL store whether a program year boundary crossing was required
 * - 2.4: THE Fallback_Cache SHALL store the actual date string returned by the dashboard
 */
export interface FallbackInfo {
  /** The date that was requested (YYYY-MM-DD format) */
  requestedDate: string

  /** The month parameter that succeeded in the fallback URL (1-12) */
  fallbackMonth: number

  /** The year for the fallback month (may differ if crossing year boundary) */
  fallbackYear: number

  /** Whether the fallback crossed a program year boundary (July) */
  crossedProgramYearBoundary: boolean

  /** The actual date string returned by the dashboard */
  actualDateString: string

  /** Timestamp when this entry was cached */
  cachedAt: number
}

/**
 * Metrics for tracking fallback cache efficiency
 *
 * These metrics help operators understand the efficiency gains from fallback caching
 * and verify the optimization is working correctly.
 *
 * Requirements:
 * - 7.1: THE Scraper SHALL track the number of cache hits (fallback knowledge reused)
 * - 7.2: THE Scraper SHALL track the number of cache misses (fallback discovered fresh)
 */
export interface FallbackMetrics {
  /** Number of times cached fallback knowledge was reused */
  cacheHits: number

  /** Number of times fallback was discovered fresh (cache miss) */
  cacheMisses: number

  /** Number of unique dates that required fallback navigation */
  fallbackDatesDiscovered: number
}
