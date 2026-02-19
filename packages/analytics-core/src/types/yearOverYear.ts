/**
 * Year-over-year comparison types.
 *
 * Types for extended year-over-year comparisons, metric comparisons,
 * multi-year trends, and pre-computed year-over-year data.
 */

/**
 * Extended year-over-year comparison data structure.
 * Contains full metrics structure with byLevel breakdowns for distinguished clubs.
 * Pre-computed by scraper-cli, served by backend.
 * Moved from backend/src/types/analytics.ts to preserve hardened logic.
 *
 * Requirements: 6.2, 6.3
 */
export interface ExtendedYearOverYearComparison {
  currentDate: string
  previousYearDate: string
  dataAvailable: boolean
  message?: string
  metrics?: {
    membership: {
      current: number
      previous: number
      change: number
      percentageChange: number
    }
    distinguishedClubs: {
      current: number
      previous: number
      change: number
      percentageChange: number
      byLevel: {
        smedley: { current: number; previous: number; change: number }
        presidents: { current: number; previous: number; change: number }
        select: { current: number; previous: number; change: number }
        distinguished: { current: number; previous: number; change: number }
      }
    }
    clubHealth: {
      thrivingClubs: {
        current: number
        previous: number
        change: number
        percentageChange: number
      }
      vulnerableClubs: {
        current: number
        previous: number
        change: number
        percentageChange: number
      }
      interventionRequiredClubs: {
        current: number
        previous: number
        change: number
        percentageChange: number
      }
    }
    dcpGoals: {
      totalGoals: {
        current: number
        previous: number
        change: number
        percentageChange: number
      }
      averagePerClub: {
        current: number
        previous: number
        change: number
        percentageChange: number
      }
    }
    clubCount: {
      current: number
      previous: number
      change: number
      percentageChange: number
    }
  }
  multiYearTrends?: {
    available: boolean
    years?: Array<{
      year: number
      date: string
      membership: number
      distinguishedClubs: number
      totalDcpGoals: number
      clubCount: number
    }>
    trends?: {
      membershipTrend: 'increasing' | 'decreasing' | 'stable'
      distinguishedTrend: 'increasing' | 'decreasing' | 'stable'
      dcpGoalsTrend: 'increasing' | 'decreasing' | 'stable'
    }
  }
}

// ========== Year-Over-Year Data Types (for pre-computed files) ==========

/**
 * Metric comparison structure for year-over-year analysis.
 * Contains current value, previous value, and calculated changes.
 *
 * Requirements: 6.2, 6.3
 */
export interface MetricComparison {
  /** Current period value */
  current: number
  /** Previous year value */
  previous: number
  /** Absolute change (current - previous) */
  change: number
  /** Percentage change ((current - previous) / previous * 100) */
  percentageChange: number
}

/**
 * Multi-year trend data point for historical analysis.
 * Tracks key metrics across multiple years.
 *
 * Requirements: 6.2, 6.3
 */
export interface MultiYearTrend {
  /** Year number (e.g., 2024) */
  year: number
  /** Date string (YYYY-MM-DD) */
  date: string
  /** Total membership count */
  membership: number
  /** Total distinguished clubs count */
  distinguishedClubs: number
  /** Total DCP goals achieved across all clubs */
  totalDcpGoals: number
  /** Total club count */
  clubCount: number
}

/**
 * Year-over-year comparison data structure.
 * Pre-computed historical comparison metrics for a district.
 * Pre-computed by scraper-cli, served by backend.
 *
 * This type supports both cases:
 * - dataAvailable=true: Full metrics comparison available
 * - dataAvailable=false: Insufficient historical data, message explains why
 *
 * Requirements: 6.1, 6.2, 6.3
 */
export interface YearOverYearData {
  /** District identifier */
  districtId: string
  /** Current date being compared (YYYY-MM-DD) */
  currentDate: string
  /** Previous year date for comparison (YYYY-MM-DD) */
  previousYearDate: string
  /** Whether year-over-year data is available */
  dataAvailable: boolean
  /** Message explaining why data is not available (when dataAvailable=false) */
  message?: string
  /** Comparison metrics (only present when dataAvailable=true) */
  metrics?: {
    /** Membership comparison */
    membership: MetricComparison
    /** Distinguished clubs comparison */
    distinguishedClubs: MetricComparison
    /** Club health metrics comparison */
    clubHealth: {
      thrivingClubs: MetricComparison
      vulnerableClubs: MetricComparison
      interventionRequiredClubs: MetricComparison
    }
    /** DCP goals comparison */
    dcpGoals: {
      totalGoals: MetricComparison
      averagePerClub: MetricComparison
    }
    /** Club count comparison */
    clubCount: MetricComparison
  }
  /** Multi-year trends for extended historical analysis (optional) */
  multiYearTrends?: MultiYearTrend[]
}
