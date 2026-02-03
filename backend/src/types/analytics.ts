/**
 * Type definitions for analytics data structures
 */

// Re-export DistrictRanking for convenience
export type { DistrictRanking } from './snapshots.js'

// Import and re-export ClubHealthStatus from shared-contracts (Requirements: 4.1)
import type { ClubHealthStatus as ClubHealthStatusType } from '@toastmasters/shared-contracts'
export type ClubHealthStatus = ClubHealthStatusType
export type TrendDirection = 'improving' | 'stable' | 'declining'
export type DistinguishedLevel =
  | 'NotDistinguished'
  | 'Smedley'
  | 'President'
  | 'Select'
  | 'Distinguished'

export interface ClubTrend {
  clubId: string
  clubName: string
  divisionId: string
  divisionName: string
  areaId: string
  areaName: string
  membershipTrend: Array<{ date: string; count: number }>
  dcpGoalsTrend: Array<{ date: string; goalsAchieved: number }>
  currentStatus: ClubHealthStatus
  riskFactors: string[]
  distinguishedLevel: DistinguishedLevel

  // Membership payment tracking fields (Requirements 8.1, 8.5, 8.6, 8.7)
  // Derived from Toastmasters dashboard CSV: "Oct. Ren", "Apr. Ren", "New Members"
  octoberRenewals?: number // Count of October renewals
  aprilRenewals?: number // Count of April renewals
  newMembers?: number // Count of new members

  /**
   * Club operational status from Toastmasters dashboard
   * Values: "Active", "Suspended", "Ineligible", "Low", or undefined
   * Requirements: 2.1
   */
  clubStatus?: string
}

export interface DivisionAnalytics {
  divisionId: string
  divisionName: string
  totalClubs: number
  totalDcpGoals: number
  averageClubHealth: number
  rank: number
  trend: TrendDirection
}

export interface AreaAnalytics {
  areaId: string
  areaName: string
  divisionId: string
  totalClubs: number
  averageClubHealth: number
  totalDcpGoals: number
  normalizedScore: number
}

// ========== Distinguished Area Program (DAP) Types ==========

/**
 * Recognition level for Areas and Divisions
 * Ordinal: NotDistinguished < Distinguished < Select < Presidents
 */
export type AreaDivisionRecognitionLevel =
  | 'NotDistinguished'
  | 'Distinguished'
  | 'Select'
  | 'Presidents'

/**
 * Eligibility status for DAP/DDP recognition
 * - 'eligible': All eligibility gates passed
 * - 'ineligible': One or more eligibility gates failed
 * - 'unknown': Cannot determine eligibility (missing data, e.g., club visits)
 */
export type RecognitionEligibility = 'eligible' | 'ineligible' | 'unknown'

/**
 * Distinguished Area Program (DAP) metrics and recognition
 *
 * Per steering document dap-ddp-recognition.md:
 * - Eligibility requires club visits (2 per club) - currently unavailable from dashboard
 * - Paid clubs threshold: ≥75%
 * - Distinguished clubs calculated against paid clubs only
 */
export interface AreaRecognition {
  areaId: string
  areaName: string
  divisionId: string

  // Club counts
  totalClubs: number
  paidClubs: number
  distinguishedClubs: number // Clubs at any distinguished level (Distinguished, Select, Presidents, Smedley)

  // Percentages (0-100 scale)
  paidClubsPercent: number // paidClubs / totalClubs * 100
  distinguishedClubsPercent: number // distinguishedClubs / paidClubs * 100 (denominator is paid clubs)

  // Eligibility and recognition
  eligibility: RecognitionEligibility
  eligibilityReason?: string // Explanation when ineligible or unknown
  recognitionLevel: AreaDivisionRecognitionLevel

  // Threshold status for UI display
  meetsPaidThreshold: boolean // paidClubsPercent >= 75
  meetsDistinguishedThreshold: boolean // Based on recognition level requirements
}

// ========== Distinguished Division Program (DDP) Types ==========

/**
 * Distinguished Division Program (DDP) metrics and recognition
 *
 * Per steering document dap-ddp-recognition.md:
 * - Eligibility requires area club visits completion - currently unavailable from dashboard
 * - Paid areas threshold: ≥85%
 * - Distinguished areas calculated against paid areas only
 */
export interface DivisionRecognition {
  divisionId: string
  divisionName: string

  // Area counts
  totalAreas: number
  paidAreas: number
  distinguishedAreas: number // Areas at any distinguished level

  // Percentages (0-100 scale)
  paidAreasPercent: number // paidAreas / totalAreas * 100
  distinguishedAreasPercent: number // distinguishedAreas / paidAreas * 100 (denominator is paid areas)

  // Eligibility and recognition
  eligibility: RecognitionEligibility
  eligibilityReason?: string // Explanation when ineligible or unknown
  recognitionLevel: AreaDivisionRecognitionLevel

  // Threshold status for UI display
  meetsPaidThreshold: boolean // paidAreasPercent >= 85
  meetsDistinguishedThreshold: boolean // Based on recognition level requirements

  // Nested area recognition data
  areas: AreaRecognition[]
}

export interface SeasonalPattern {
  month: number
  monthName: string
  averageChange: number
  trend: 'growth' | 'decline' | 'stable'
}

export interface MembershipAnalytics {
  totalMembership: number
  membershipChange: number
  programYearChange: number
  membershipTrend: Array<{ date: string; count: number }>
  topGrowthClubs: Array<{ clubId: string; clubName: string; growth: number }>
  topDecliningClubs: Array<{
    clubId: string
    clubName: string
    decline: number
  }>
  seasonalPatterns: SeasonalPattern[]
  yearOverYearComparison?: {
    currentMembership: number
    previousMembership: number
    percentageChange: number
    membershipChange: number
  }
}

export interface DistinguishedClubAchievement {
  clubId: string
  clubName: string
  level: DistinguishedLevel
  achievedDate: string
  goalsAchieved: number
}

export interface DCPGoalAnalysis {
  goalNumber: number
  achievementCount: number
  achievementPercentage: number
}

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

export interface LeadershipEffectivenessScore {
  divisionId: string
  divisionName: string
  healthScore: number // 0-100
  growthScore: number // 0-100
  dcpScore: number // 0-100
  overallScore: number // Weighted: 40% health, 30% growth, 30% DCP
  rank: number
  isBestPractice: boolean
}

export interface LeadershipChange {
  divisionId: string
  divisionName: string
  changeDate: string
  performanceBeforeChange: number
  performanceAfterChange: number
  performanceDelta: number
  trend: 'improved' | 'declined' | 'stable'
}

export interface AreaDirectorCorrelation {
  areaId: string
  areaName: string
  divisionId: string
  clubPerformanceScore: number
  activityIndicator: 'high' | 'medium' | 'low'
  correlation: 'positive' | 'neutral' | 'negative'
}

export interface LeadershipInsights {
  // Leadership effectiveness scores (Requirement 8.1)
  leadershipScores: LeadershipEffectivenessScore[]

  // Best practice divisions (Requirement 8.2)
  bestPracticeDivisions: LeadershipEffectivenessScore[]

  // Performance changes with leadership changes (Requirement 8.3)
  leadershipChanges: LeadershipChange[]

  // Area director activity correlations (Requirement 8.4)
  areaDirectorCorrelations: AreaDirectorCorrelation[]

  // Summary report (Requirement 8.5)
  summary: {
    topPerformingDivisions: Array<{
      divisionId: string
      divisionName: string
      score: number
    }>
    topPerformingAreas: Array<{
      areaId: string
      areaName: string
      score: number
    }>
    averageLeadershipScore: number
    totalBestPracticeDivisions: number
  }
}

export interface YearOverYearComparison {
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

export interface DistrictAnalytics {
  districtId: string
  dateRange: { start: string; end: string }

  // Membership insights
  totalMembership: number
  membershipChange: number
  membershipTrend: Array<{ date: string; count: number }>
  topGrowthClubs: Array<{ clubId: string; clubName: string; growth: number }>

  // Payment insights (Requirements: membership-payments-chart 3.1, 3.2)
  paymentsTrend?: Array<{ date: string; payments: number }>

  // Club health
  allClubs: ClubTrend[]
  vulnerableClubs: ClubTrend[] // Contains only vulnerable clubs (not intervention-required)
  thrivingClubs: ClubTrend[]
  interventionRequiredClubs: ClubTrend[]

  // Distinguished status
  distinguishedClubs: {
    smedley: number
    presidents: number
    select: number
    distinguished: number
    total: number
  }
  distinguishedProjection: number

  // Distinguished club analytics with DCP goal analysis
  distinguishedClubAnalytics: DistinguishedClubAnalytics

  // Division/Area performance
  divisionRankings: DivisionAnalytics[]
  topPerformingAreas: AreaAnalytics[]

  // DAP/DDP Recognition (optional - may not be available for all data)
  divisionRecognition?: DivisionRecognition[]

  // Year-over-year comparison (if data available)
  yearOverYear?: {
    membershipChange: number
    distinguishedChange: number
    clubHealthChange: number
  }

  /**
   * Performance targets and rankings data for district overview
   * Contains targets for paid clubs, membership payments, and distinguished clubs
   * along with world rank, region rank, and world percentile for each metric
   * Null if base values are unavailable
   * Requirements: 7.1, 7.2, 7.3, 7.4
   */
  performanceTargets?: DistrictPerformanceTargets
}

// ========== District Performance Targets Types ==========

/**
 * Recognition levels for district performance targets
 * Ordered from lowest to highest achievement tier
 */
export type RecognitionLevel =
  | 'distinguished'
  | 'select'
  | 'presidents'
  | 'smedley'

/**
 * Target values for each recognition level
 * All values are integers (ceiling-rounded from formulas)
 */
export interface RecognitionTargets {
  distinguished: number
  select: number
  presidents: number
  smedley: number
}

/**
 * Target calculation result for a single metric
 * Contains base value, current value, calculated targets, and achieved level
 */
export interface MetricTargets {
  /** Base value used for target calculation (null if unavailable) */
  base: number | null
  /** Current value of the metric */
  current: number
  /** Calculated targets for each recognition level (null if base unavailable) */
  targets: RecognitionTargets | null
  /** Highest recognition level achieved (null if none achieved or targets unavailable) */
  achievedLevel: RecognitionLevel | null
}

/**
 * Region ranking data for a single metric
 */
export interface RegionRankData {
  /** District's rank within its region (1 = best, null if unavailable) */
  regionRank: number | null
  /** Total number of districts in the region */
  totalInRegion: number
  /** Region identifier (null if unknown) */
  region: string | null
}

/**
 * Complete ranking data for a metric
 * Includes world rank, percentile, and region rank
 */
export interface MetricRankings {
  /** District's world rank (1 = best, null if unavailable) */
  worldRank: number | null
  /** World percentile (0-100, rounded to 1 decimal, null if unavailable) */
  worldPercentile: number | null
  /** District's rank within its region (1 = best, null if unavailable) */
  regionRank: number | null
  /** Total number of districts worldwide */
  totalDistricts: number
  /** Total number of districts in the region */
  totalInRegion: number
  /** Region identifier (null if unknown) */
  region: string | null
}

/**
 * Performance targets and rankings for district overview
 * Contains data for all three enhanced metric cards
 */
export interface DistrictPerformanceTargets {
  paidClubs: {
    current: number
    base: number | null
    targets: RecognitionTargets | null
    achievedLevel: RecognitionLevel | null
    rankings: MetricRankings
  }
  membershipPayments: {
    current: number
    base: number | null
    targets: RecognitionTargets | null
    achievedLevel: RecognitionLevel | null
    rankings: MetricRankings
  }
  distinguishedClubs: {
    current: number
    base: number | null // Uses Club_Base for percentage calculation
    targets: RecognitionTargets | null
    achievedLevel: RecognitionLevel | null
    rankings: MetricRankings
  }
}
