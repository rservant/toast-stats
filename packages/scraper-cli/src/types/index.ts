/**
 * Type definitions for the Scraper CLI
 *
 * These types define the interfaces for the scraper orchestrator,
 * CLI options, and output formats.
 *
 * Requirements:
 * - 1.9: JSON output format specification
 * - 1.11: Exit code definitions
 * - 8.3: Shared types for scraper
 */

// Re-export scraper types for convenience
export type {
  ScrapedRecord,
  DistrictInfo,
  IScraperCache,
  CacheMetadata,
  ClubPerformanceRecord,
  DivisionPerformanceRecord,
  DistrictPerformanceRecord,
  AllDistrictsCSVRecord,
} from './scraper.js'

export { CSVType } from './scraper.js'

/**
 * Configuration for the ScraperOrchestrator
 */
export interface ScraperOrchestratorConfig {
  /** Directory where cached CSV files are stored */
  cacheDir: string
  /** Path to the district configuration file */
  districtConfigPath: string
  /** Maximum timeout for scraping operations in seconds */
  timeout: number
  /** Enable verbose logging output */
  verbose: boolean
}

/**
 * Options for a scrape operation
 */
export interface ScrapeOptions {
  /** Target date in YYYY-MM-DD format, defaults to current date */
  date?: string
  /** Specific districts to scrape, defaults to all configured */
  districts?: string[]
  /** Force re-scrape even if cache exists */
  force?: boolean
}

/**
 * Result of a scrape operation
 */
export interface ScrapeResult {
  /** Whether the overall operation succeeded */
  success: boolean
  /** The date that was scraped */
  date: string
  /** All districts that were processed */
  districtsProcessed: string[]
  /** Districts that were successfully scraped */
  districtsSucceeded: string[]
  /** Districts that failed to scrape */
  districtsFailed: string[]
  /** Paths to created cache files */
  cacheLocations: string[]
  /** Detailed error information for failed districts */
  errors: Array<{
    districtId: string
    error: string
    timestamp: string
  }>
  /** Total duration of the scrape operation in milliseconds */
  duration_ms: number
}

/**
 * JSON output summary for CLI
 * Requirement 1.9: JSON summary output format
 */
export interface ScrapeSummary {
  /** ISO timestamp when scrape completed */
  timestamp: string
  /** Date that was scraped */
  date: string
  /** Overall status: success, partial, or failed */
  status: 'success' | 'partial' | 'failed'
  /** District processing statistics */
  districts: {
    total: number
    succeeded: number
    failed: number
    skipped: number
  }
  /** Cache information */
  cache: {
    directory: string
    filesCreated: number
    totalSize: number
  }
  /** Error details for failed districts */
  errors: Array<{
    districtId: string
    error: string
  }>
  /** Total duration in milliseconds */
  duration_ms: number
}

/**
 * Exit codes for the CLI
 * Requirement 1.11: Exit code specification
 */
export enum ExitCode {
  /** All districts scraped successfully */
  SUCCESS = 0,
  /** Some districts failed, others succeeded */
  PARTIAL_FAILURE = 1,
  /** All districts failed or fatal error occurred */
  COMPLETE_FAILURE = 2,
}

/**
 * CLI command options parsed from command line arguments
 */
export interface CLIOptions {
  /** Target date in YYYY-MM-DD format */
  date?: string
  /** Parsed list of district IDs */
  districts?: string[]
  /** Force re-scrape even if cache exists */
  force: boolean
  /** Enable verbose logging */
  verbose: boolean
  /** Maximum timeout in seconds */
  timeout: number
  /** Path to alternative configuration file */
  config?: string
}

/**
 * Cache status for a specific date
 */
export interface CacheStatus {
  /** The date being checked */
  date: string
  /** Districts that have cached data */
  cachedDistricts: string[]
  /** Districts that are missing from cache */
  missingDistricts: string[]
}

/**
 * Configuration validation result
 */
export interface ConfigValidationResult {
  /** Whether the configuration is valid */
  isValid: boolean
  /** List of validation errors */
  errors: string[]
}
