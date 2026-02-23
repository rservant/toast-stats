/**
 * Distinguished club analytics types.
 *
 * Types for distinguished club projections, summaries, counts,
 * achievements, DCP goal analysis, and pre-computed distinguished analytics data.
 */

import type { DateRange } from './metadata.js'

/**
 * Distinguished club projection data.
 * Simplified to a single projected field (projectedDistinguished = thriving count).
 *
 * Requirements: 2.1, 2.2
 */
export interface DistinguishedProjection {
  projectedDistinguished: number // Single projected field = thriving count
  currentDistinguished: number
  currentSelect: number
  currentPresident: number
  projectionDate: string
}

/**
 * Distinguished club summary.
 */
export interface DistinguishedClubSummary {
  clubId: string
  clubName: string
  status: 'smedley' | 'president' | 'select' | 'distinguished' | 'none'
  dcpPoints: number
  goalsCompleted: number
}

/**
 * Summary counts of distinguished clubs by recognition level.
 * Used in DistrictAnalytics.distinguishedClubs field.
 */
export interface DistinguishedClubCounts {
  /** Clubs achieving Smedley Distinguished (10+ goals, 25+ members) */
  smedley: number
  /** Clubs achieving President's Distinguished (9+ goals, 20+ members) */
  presidents: number
  /** Clubs achieving Select Distinguished (7+ goals, 20+ members) */
  select: number
  /** Clubs achieving Distinguished (5+ goals, 20+ members) */
  distinguished: number
  /** Total count of all distinguished clubs */
  total: number
}

// ========== Distinguished Club Analytics Types (moved from backend) ==========

/**
 * Achievement record for a club reaching a distinguished level.
 * Tracks when clubs achieve distinguished status and at what level.
 * Moved from backend/src/types/analytics.ts to preserve hardened logic.
 *
 * Requirements: 5.1, 5.2
 */
export interface DistinguishedClubAchievement {
  clubId: string
  clubName: string
  level: 'Smedley' | 'President' | 'Select' | 'Distinguished'
  achievedDate: string
  goalsAchieved: number
}

/**
 * DCP goal analysis data for a single goal.
 * Tracks achievement count and percentage for each of the 10 DCP goals.
 * Moved from backend/src/types/analytics.ts to preserve hardened logic.
 *
 * Requirements: 5.1, 5.2
 */
export interface DCPGoalAnalysis {
  goalNumber: number
  achievementCount: number
  achievementPercentage: number
}

/**
 * Comprehensive distinguished club analytics data structure.
 * Pre-computed by collector-cli, served by backend.
 * Moved from backend/src/types/analytics.ts to preserve hardened logic.
 *
 * Requirements: 5.1, 5.2
 */
export interface DistinguishedClubAnalytics {
  // Current counts by level (Requirement 7.1)
  distinguishedClubs: {
    smedley: number
    presidents: number
    select: number
    distinguished: number
    total: number
  }

  // Projection for final count (Requirement 7.2)
  distinguishedProjection: {
    smedley: number
    presidents: number
    select: number
    distinguished: number
    total: number
  }

  // Clubs that achieved distinguished levels with dates (Requirement 7.3)
  achievements: DistinguishedClubAchievement[]

  // Year-over-year comparison (Requirement 7.4)
  yearOverYearComparison?: {
    currentTotal: number
    previousTotal: number
    change: number
    percentageChange: number
    currentByLevel: {
      smedley: number
      presidents: number
      select: number
      distinguished: number
    }
    previousByLevel: {
      smedley: number
      presidents: number
      select: number
      distinguished: number
    }
  }

  // DCP goal analysis (Requirement 7.5)
  dcpGoalAnalysis: {
    mostCommonlyAchieved: DCPGoalAnalysis[]
    leastCommonlyAchieved: DCPGoalAnalysis[]
  }
}

// ========== Distinguished Club Analytics Data Types (for pre-computed files) ==========

/**
 * Distinguished club analytics data structure for pre-computed files.
 * Pre-computed by collector-cli, served by backend.
 *
 * Contains comprehensive distinguished club progress and projections
 * derived from the DistinguishedClubAnalytics analysis.
 *
 * Requirements: 5.1, 5.2
 */
export interface DistinguishedClubAnalyticsData {
  /** District identifier */
  districtId: string
  /** Date range covered by the analytics */
  dateRange: DateRange
  /** Summary counts of distinguished clubs by level */
  distinguishedClubs: DistinguishedClubCounts
  /** Detailed list of distinguished clubs */
  distinguishedClubsList: DistinguishedClubSummary[]
  /** Projection for end-of-year distinguished club counts */
  distinguishedProjection: DistinguishedProjection
  /** Progress by recognition level with current, projected, and trend */
  progressByLevel: {
    smedley: { current: number; projected: number; trend: string }
    presidents: { current: number; projected: number; trend: string }
    select: { current: number; projected: number; trend: string }
    distinguished: { current: number; projected: number; trend: string }
  }
  /** DCP goal analysis — most/least commonly achieved goals across clubs */
  dcpGoalAnalysis?: {
    mostCommonlyAchieved: DCPGoalAnalysis[]
    leastCommonlyAchieved: DCPGoalAnalysis[]
  }
}
