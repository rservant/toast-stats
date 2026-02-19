/**
 * Distinguished club analytics type definitions.
 *
 * Requirements: 5.1, 5.2
 */

import type {
  DateRange,
  DistinguishedClubCounts,
  DistinguishedClubSummary,
  DistinguishedProjection,
} from './core.js'

/**
 * Achievement record for a club reaching a distinguished level.
 * Tracks when clubs achieve distinguished status and at what level.
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
 * Pre-computed by scraper-cli, served by backend.
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

/**
 * Distinguished club analytics data structure for pre-computed files.
 * Pre-computed by scraper-cli, served by backend.
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
}
