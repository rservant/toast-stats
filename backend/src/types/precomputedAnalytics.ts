/**
 * Type definitions for pre-computed analytics data structures
 *
 * These types support the pre-computation of analytics during snapshot creation
 * to enable fast retrieval without on-demand computation.
 *
 * Requirements:
 * - 1.2: Pre-computed analytics include membership totals, club health counts, and distinguished club counts
 * - 1.3: Pre-computed analytics include membership trend data points for the snapshot date
 */

/**
 * Club health count breakdown
 * Represents the distribution of clubs across health status categories
 */
export interface ClubHealthCounts {
  /** Total number of clubs in the district */
  total: number
  /** Number of clubs classified as thriving */
  thriving: number
  /** Number of clubs classified as vulnerable */
  vulnerable: number
  /** Number of clubs requiring intervention */
  interventionRequired: number
}

/**
 * Distinguished club count breakdown by recognition level
 * Represents the distribution of clubs across distinguished status levels
 */
export interface DistinguishedClubCounts {
  /** Number of clubs at Smedley Distinguished level */
  smedley: number
  /** Number of clubs at President's Distinguished level */
  presidents: number
  /** Number of clubs at Select Distinguished level */
  select: number
  /** Number of clubs at Distinguished level */
  distinguished: number
  /** Total number of distinguished clubs (sum of all levels) */
  total: number
}

/**
 * Trend data point for a single snapshot
 * Contains key metrics captured at a specific point in time
 *
 * Requirement 1.3: Includes membership trend data points (date and count) for the snapshot date
 */
export interface TrendDataPoint {
  /** ISO date string for this data point (YYYY-MM-DD) */
  date: string
  /** Total membership count at this date */
  membership: number
  /** Total membership payments at this date */
  payments: number
  /** Total DCP goals achieved at this date */
  dcpGoals: number
}

/**
 * Pre-computed analytics summary for a single district within a snapshot
 *
 * This interface contains all the summary metrics that can be quickly retrieved
 * without needing to recompute from raw data.
 *
 * Requirement 1.2: Includes membership totals, club health counts (thriving, vulnerable,
 * intervention-required), and distinguished club counts
 *
 * Requirement 1.3: Includes membership trend data points (date and count) for the snapshot date
 */
export interface PreComputedAnalyticsSummary {
  /** Unique identifier of the snapshot this summary belongs to */
  snapshotId: string

  /** District identifier */
  districtId: string

  /** ISO timestamp when this summary was computed */
  computedAt: string

  // ========== Summary Metrics (fast to retrieve) ==========

  /**
   * Total membership count across all clubs in the district
   * Requirement 1.2
   */
  totalMembership: number

  /**
   * Net change in membership since the previous snapshot
   * Positive values indicate growth, negative values indicate decline
   */
  membershipChange: number

  /**
   * Club health status distribution
   * Requirement 1.2: Includes thriving, vulnerable, and intervention-required counts
   */
  clubCounts: ClubHealthCounts

  /**
   * Distinguished club distribution by recognition level
   * Requirement 1.2: Includes distinguished club counts
   */
  distinguishedClubs: DistinguishedClubCounts

  // ========== Trend Data ==========

  /**
   * Trend data point for this snapshot
   * Requirement 1.3: Includes membership trend data points for the snapshot date
   */
  trendDataPoint: TrendDataPoint
}

/**
 * Rejection reason for a district that failed validation
 * Used to track why specific districts were excluded from analytics
 */
export interface RejectionReason {
  /** District ID that was rejected */
  districtId: string
  /** Human-readable reason for rejection */
  reason: string
}

/**
 * Validation summary for the analytics computation process
 * Tracks how many records were processed, accepted, and rejected
 */
export interface ValidationSummary {
  /** Total number of district records processed */
  totalRecords: number
  /** Number of records that passed validation and were included */
  validRecords: number
  /** Number of records that failed validation and were excluded */
  rejectedRecords: number
  /** Details of each rejected record */
  rejectionReasons: RejectionReason[]
}

/**
 * Complete analytics summary file stored within a snapshot directory
 *
 * This file contains pre-computed analytics for all districts in a snapshot,
 * along with validation metadata about the computation process.
 *
 * Storage location: CACHE_DIR/snapshots/{date}/analytics-summary.json
 */
export interface AnalyticsSummaryFile {
  /** Unique identifier of the snapshot this file belongs to */
  snapshotId: string

  /** ISO timestamp when this file was computed */
  computedAt: string

  /** Schema version for this file format (for future migrations) */
  schemaVersion: string

  /**
   * Pre-computed analytics summaries indexed by district ID
   * Key: district ID (e.g., "42", "61", "F")
   * Value: Pre-computed analytics summary for that district
   */
  districts: Record<string, PreComputedAnalyticsSummary>

  /**
   * Validation summary for the computation process
   * Tracks total, valid, and rejected records with reasons
   */
  validation: ValidationSummary
}

/**
 * Current schema version for analytics summary files
 * Increment when the AnalyticsSummaryFile structure changes
 */
export const ANALYTICS_SUMMARY_SCHEMA_VERSION = '1.0.0'

// ============================================================================
// Time-Series Index Types
// ============================================================================

/**
 * Time-series data point for efficient range queries
 *
 * This interface represents a single data point in the time-series index,
 * containing key metrics captured at a specific snapshot date. The time-series
 * index enables efficient retrieval of trend data without loading individual
 * snapshots.
 *
 * Requirement 2.1: THE Snapshot_Store SHALL maintain a time-series index file
 * that contains date-indexed analytics summaries across all snapshots
 */
export interface TimeSeriesDataPoint {
  /** ISO date string for this data point (YYYY-MM-DD) */
  date: string

  /** Unique identifier of the snapshot this data point was derived from */
  snapshotId: string

  /** Total membership count at this date */
  membership: number

  /** Total membership payments at this date */
  payments: number

  /** Total DCP goals achieved at this date */
  dcpGoals: number

  /** Total number of distinguished clubs at this date */
  distinguishedTotal: number

  /**
   * Club health status distribution at this date
   * Enables tracking of club health trends over time
   */
  clubCounts: {
    /** Total number of clubs in the district */
    total: number
    /** Number of clubs classified as thriving */
    thriving: number
    /** Number of clubs classified as vulnerable */
    vulnerable: number
    /** Number of clubs requiring intervention */
    interventionRequired: number
  }
}

/**
 * Program year index structure
 *
 * Contains all time-series data points for a single program year (July 1 - June 30).
 * This structure supports efficient range queries for program year boundaries.
 *
 * Requirement 2.1: THE Snapshot_Store SHALL maintain a time-series index file
 * that contains date-indexed analytics summaries across all snapshots
 *
 * Requirement 2.4: THE time-series index SHALL support efficient range queries
 * for program year boundaries (July 1 to June 30)
 *
 * Requirement 2.5: THE time-series index SHALL be partitioned by program year
 * to limit file sizes
 */
export interface ProgramYearIndex {
  /** Program year identifier (e.g., "2023-2024") */
  programYear: string

  /** Start date of the program year (e.g., "2023-07-01") */
  startDate: string

  /** End date of the program year (e.g., "2024-06-30") */
  endDate: string

  /** Array of time-series data points in chronological order */
  dataPoints: TimeSeriesDataPoint[]

  /** ISO timestamp when this index was last updated */
  lastUpdated: string
}

/**
 * Summary statistics for a program year
 *
 * Contains aggregated statistics computed from all data points in a program year.
 * These statistics enable quick overview without iterating through all data points.
 */
export interface ProgramYearSummary {
  /** Total number of data points in this program year */
  totalDataPoints: number

  /** Membership count at the start of the program year */
  membershipStart: number

  /** Membership count at the end of the program year (or latest available) */
  membershipEnd: number

  /** Peak membership count during the program year */
  membershipPeak: number

  /** Lowest membership count during the program year */
  membershipLow: number
}

/**
 * Complete program year index file structure
 *
 * This is the full file format stored at:
 * CACHE_DIR/time-series/{district_id}/{program_year}.json
 *
 * Example: CACHE_DIR/time-series/district_42/2023-2024.json
 *
 * Requirement 2.1: THE Snapshot_Store SHALL maintain a time-series index file
 * that contains date-indexed analytics summaries across all snapshots
 *
 * Requirement 2.5: THE time-series index SHALL be partitioned by program year
 * to limit file sizes
 */
export interface ProgramYearIndexFile {
  /** District identifier (e.g., "42", "61", "F") */
  districtId: string

  /** Program year identifier (e.g., "2023-2024") */
  programYear: string

  /** Start date of the program year (e.g., "2023-07-01") */
  startDate: string

  /** End date of the program year (e.g., "2024-06-30") */
  endDate: string

  /** ISO timestamp when this file was last updated */
  lastUpdated: string

  /** Array of time-series data points in chronological order */
  dataPoints: TimeSeriesDataPoint[]

  /**
   * Summary statistics for the program year
   * Provides quick overview without iterating through all data points
   */
  summary: ProgramYearSummary
}

/**
 * Index metadata file structure
 *
 * This file tracks all available program years for a district.
 * Stored at: CACHE_DIR/time-series/{district_id}/index-metadata.json
 */
export interface TimeSeriesIndexMetadata {
  /** District identifier */
  districtId: string

  /** ISO timestamp when this metadata was last updated */
  lastUpdated: string

  /** List of available program years in chronological order */
  availableProgramYears: string[]

  /** Total number of data points across all program years */
  totalDataPoints: number
}

/**
 * Current schema version for time-series index files
 * Increment when the ProgramYearIndexFile structure changes
 */
export const TIME_SERIES_INDEX_SCHEMA_VERSION = '1.0.0'
