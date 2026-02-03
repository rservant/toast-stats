/**
 * Core type definitions for analytics computation.
 *
 * These types define the structure of analytics data that flows through
 * the pre-computed analytics pipeline.
 */

import type { AllDistrictsRankingsData } from '@toastmasters/shared-contracts'

/**
 * Metadata included in every pre-computed analytics file.
 */
export interface AnalyticsMetadata {
  /** Schema version for compatibility checking */
  schemaVersion: string
  /** ISO timestamp when analytics were computed */
  computedAt: string
  /** Date of the snapshot used for computation (YYYY-MM-DD) */
  snapshotDate: string
  /** District identifier */
  districtId: string
  /** SHA256 checksum of the data field */
  checksum: string
  /** SHA256 checksum of the source snapshot file used for computation (Requirement 5.4) */
  sourceSnapshotChecksum?: string
}

/**
 * Membership trend data point.
 */
export interface MembershipTrendPoint {
  date: string
  count: number
}

/**
 * Payments trend data point.
 */
export interface PaymentsTrendPoint {
  date: string
  payments: number
}

/**
 * Year-over-year comparison data.
 */
export interface YearOverYearComparison {
  currentYear: number
  previousYear: number
  membershipChange: number
  membershipChangePercent: number
  paymentsChange: number
  paymentsChangePercent: number
}

/**
 * Membership trends data structure.
 */
export interface MembershipTrendData {
  membershipTrend: MembershipTrendPoint[]
  paymentsTrend: PaymentsTrendPoint[]
  yearOverYear?: YearOverYearComparison
}

/**
 * Risk factors for club health assessment.
 */
export interface ClubRiskFactors {
  lowMembership: boolean
  decliningMembership: boolean
  lowPayments: boolean
  inactiveOfficers: boolean
  noRecentMeetings: boolean
}

/**
 * Club health status classification.
 */
export type ClubHealthStatus =
  | 'thriving'
  | 'stable'
  | 'vulnerable'
  | 'intervention_required'

/**
 * Distinguished level classification for clubs.
 * Based on DCP goals achieved and membership thresholds.
 */
export type DistinguishedLevel =
  | 'NotDistinguished'
  | 'Smedley'
  | 'President'
  | 'Select'
  | 'Distinguished'

/**
 * DCP goals trend data point.
 */
export interface DcpGoalsTrendPoint {
  date: string
  goalsAchieved: number
}

/**
 * Individual club trend data.
 * Enhanced to include all fields required by frontend.
 */
export interface ClubTrend {
  // Core identification
  clubId: string
  clubName: string

  // Division and Area information (Requirements 1.1, 1.2)
  divisionId: string
  divisionName: string
  areaId: string
  areaName: string

  // Health assessment
  currentStatus: ClubHealthStatus
  healthScore: number

  // Membership and payments
  membershipCount: number
  paymentsCount: number

  // Trend arrays (Requirements 1.3, 1.4)
  membershipTrend: MembershipTrendPoint[]
  dcpGoalsTrend: DcpGoalsTrendPoint[]

  // Risk factors as string array (Requirement 1.6)
  riskFactors: string[]

  // Distinguished level (Requirement 1.5)
  distinguishedLevel: DistinguishedLevel

  // Payment breakdown fields (Requirement 1.7)
  octoberRenewals?: number
  aprilRenewals?: number
  newMembers?: number

  // Club operational status (Requirement 1.8)
  clubStatus?: string
}

/**
 * Club health data structure.
 */
export interface ClubHealthData {
  allClubs: ClubTrend[]
  thrivingClubs: ClubTrend[]
  vulnerableClubs: ClubTrend[]
  interventionRequiredClubs: ClubTrend[]
}

/**
 * Division ranking data.
 */
export interface DivisionRanking {
  divisionId: string
  divisionName: string
  rank: number
  score: number
  clubCount: number
  membershipTotal: number
}

/**
 * Area performance data.
 */
export interface AreaPerformance {
  areaId: string
  areaName: string
  divisionId: string
  score: number
  clubCount: number
  membershipTotal: number
}

// ========== Division/Area Analytics Types (moved from backend) ==========

/**
 * Trend direction for analytics.
 * Used for division and area trend indicators.
 */
export type TrendDirection = 'improving' | 'stable' | 'declining'

/**
 * Division analytics data structure.
 * Contains division performance metrics with rankings and trends.
 * Moved from backend/src/types/analytics.ts to preserve hardened logic.
 *
 * Requirements: 4.1
 */
export interface DivisionAnalytics {
  divisionId: string
  divisionName: string
  totalClubs: number
  totalDcpGoals: number
  averageClubHealth: number
  rank: number
  trend: TrendDirection
}

/**
 * Area analytics data structure.
 * Contains area performance metrics with normalized scores.
 * Moved from backend/src/types/analytics.ts to preserve hardened logic.
 *
 * Requirements: 4.1
 */
export interface AreaAnalytics {
  areaId: string
  areaName: string
  divisionId: string
  totalClubs: number
  averageClubHealth: number
  totalDcpGoals: number
  normalizedScore: number
}

/**
 * Distinguished club projection data.
 */
export interface DistinguishedProjection {
  projectedDistinguished: number
  projectedSelect: number
  projectedPresident: number
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

/**
 * Date range for analytics.
 */
export interface DateRange {
  start: string
  end: string
}

/**
 * Complete district analytics structure.
 * This matches the frontend DistrictAnalytics type exactly.
 */
export interface DistrictAnalytics {
  districtId: string
  dateRange: DateRange
  totalMembership: number
  membershipChange: number
  membershipTrend: MembershipTrendPoint[]
  allClubs: ClubTrend[]
  vulnerableClubs: ClubTrend[]
  thrivingClubs: ClubTrend[]
  interventionRequiredClubs: ClubTrend[]
  /** Summary counts of distinguished clubs by level */
  distinguishedClubs: DistinguishedClubCounts
  /** Detailed list of distinguished clubs */
  distinguishedClubsList: DistinguishedClubSummary[]
  distinguishedProjection: DistinguishedProjection
  divisionRankings: DivisionRanking[]
  topPerformingAreas: AreaPerformance[]
}

/**
 * Result of analytics computation.
 */
export interface AnalyticsComputationResult {
  districtAnalytics: DistrictAnalytics
  membershipTrends: MembershipTrendData
  clubHealth: ClubHealthData
  computedAt: string
  schemaVersion: string
}

/**
 * Options for analytics computation.
 */
export interface ComputeOptions {
  /** Force recomputation even if cached results exist */
  force?: boolean
  /** Enable verbose logging */
  verbose?: boolean
  /**
   * All-districts rankings data for computing per-metric rankings.
   * When provided, rankings (world rank, world percentile, region rank) will be
   * computed for each metric in performance targets.
   * Requirement 5.2: Pass all-districts rankings data to computePerformanceTargets
   */
  allDistrictsRankings?: AllDistrictsRankingsData
}

/**
 * Pre-computed analytics file wrapper.
 * All analytics files follow this structure.
 */
export interface PreComputedAnalyticsFile<T> {
  metadata: AnalyticsMetadata
  data: T
}

/**
 * Analytics manifest entry for a single file.
 */
export interface AnalyticsManifestEntry {
  filename: string
  districtId: string
  type:
    | 'analytics'
    | 'membership'
    | 'clubhealth'
    | 'rankings'
    | 'membership-analytics'
    | 'vulnerable-clubs'
    | 'leadership-insights'
    | 'distinguished-analytics'
    | 'year-over-year'
    | 'performance-targets'
    | 'club-trends-index'
  size: number
  checksum: string
}

/**
 * Analytics manifest for a snapshot date.
 */
export interface AnalyticsManifest {
  snapshotDate: string
  generatedAt: string
  schemaVersion: string
  files: AnalyticsManifestEntry[]
  totalFiles: number
  totalSize: number
}

// ========== Membership Analytics Types (moved from backend) ==========

/**
 * Seasonal pattern for membership analytics.
 * Identifies monthly trends in membership changes.
 */
export interface SeasonalPattern {
  month: number
  monthName: string
  averageChange: number
  trend: 'growth' | 'decline' | 'stable'
}

/**
 * Year-over-year comparison specific to membership analytics.
 * Simpler structure than the full YearOverYearComparison type.
 */
export interface MembershipYearOverYearComparison {
  currentMembership: number
  previousMembership: number
  percentageChange: number
  membershipChange: number
}

/**
 * Comprehensive membership analytics data structure.
 * Pre-computed by scraper-cli, served by backend.
 * Moved from backend/src/types/analytics.ts to preserve hardened logic.
 */
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
  yearOverYearComparison?: MembershipYearOverYearComparison
}

// ========== Membership Analytics Data Types (for pre-computed files) ==========

/**
 * Membership analytics data structure for pre-computed files.
 * Pre-computed by scraper-cli, served by backend.
 * This is the wrapper type for the pre-computed membership analytics file.
 *
 * Requirements: 1.1, 1.2
 */
export interface MembershipAnalyticsData {
  /** District identifier */
  districtId: string
  /** Date range covered by the analytics */
  dateRange: DateRange
  /** Total membership count at the end of the period */
  totalMembership: number
  /** Net membership change over the period */
  membershipChange: number
  /** Membership trend over time */
  membershipTrend: MembershipTrendPoint[]
  /** Payments trend over time */
  paymentsTrend: PaymentsTrendPoint[]
  /** Year-over-year comparison (optional, requires historical data) */
  yearOverYear?: YearOverYearComparison
  /** Growth rate as a percentage (positive = growth, negative = decline) */
  growthRate: number
  /** Retention rate as a percentage (0-100) */
  retentionRate: number
}

// ========== Leadership Insights Types (moved from backend) ==========

/**
 * Leadership effectiveness score for a division.
 * Combines health, growth, and DCP metrics into an overall score.
 */
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

/**
 * Leadership change tracking for performance correlation.
 * Tracks performance before and after leadership changes.
 */
export interface LeadershipChange {
  divisionId: string
  divisionName: string
  changeDate: string
  performanceBeforeChange: number
  performanceAfterChange: number
  performanceDelta: number
  trend: 'improved' | 'declined' | 'stable'
}

/**
 * Area director activity correlation with club performance.
 * Measures correlation between area director activity and club outcomes.
 */
export interface AreaDirectorCorrelation {
  areaId: string
  areaName: string
  divisionId: string
  clubPerformanceScore: number
  activityIndicator: 'high' | 'medium' | 'low'
  correlation: 'positive' | 'neutral' | 'negative'
}

/**
 * Comprehensive leadership insights data structure.
 * Pre-computed by scraper-cli, served by backend.
 * Moved from backend/src/types/analytics.ts to preserve hardened logic.
 */
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

// ========== Leadership Insights Data Types (for pre-computed files) ==========

/**
 * Leadership insights data structure for pre-computed files.
 * Pre-computed by scraper-cli, served by backend.
 * This is the wrapper type for the pre-computed leadership insights file.
 *
 * Contains leadership effectiveness metrics and officer performance data
 * derived from the comprehensive LeadershipInsights analysis.
 *
 * Requirements: 4.1, 4.2
 */
export interface LeadershipInsightsData {
  /** District identifier */
  districtId: string
  /** Date range covered by the analytics */
  dateRange: DateRange
  /** Officer completion rate as a percentage (0-100) */
  officerCompletionRate: number
  /** Training completion rate as a percentage (0-100) */
  trainingCompletionRate: number
  /** Overall leadership effectiveness score (0-100) */
  leadershipEffectivenessScore: number
  /** Top performing divisions ranked by leadership effectiveness */
  topPerformingDivisions: DivisionRanking[]
  /** Areas that need support based on performance metrics */
  areasNeedingSupport: AreaPerformance[]
  /** Full leadership insights data for detailed analysis */
  insights: LeadershipInsights
}

// ========== Extended Year-Over-Year Comparison Types (moved from backend) ==========

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

// ========== Vulnerable Clubs Data Types ==========

/**
 * Vulnerable clubs data structure.
 * Pre-computed list of clubs requiring attention.
 * Wraps existing ClubTrend arrays with metadata for the pre-computed file.
 *
 * Requirements: 3.2
 */
export interface VulnerableClubsData {
  /** District identifier */
  districtId: string
  /** ISO timestamp when the data was computed */
  computedAt: string
  /** Total count of vulnerable clubs */
  totalVulnerableClubs: number
  /** Count of clubs requiring intervention */
  interventionRequiredClubs: number
  /** Clubs categorized as vulnerable */
  vulnerableClubs: ClubTrend[]
  /** Clubs requiring immediate intervention */
  interventionRequired: ClubTrend[]
}

// ========== Club Trends Index Types ==========

/**
 * Club trends data for individual club lookup.
 * Stored per-district with clubs indexed by club ID for efficient O(1) retrieval.
 * Pre-computed by scraper-cli, served by backend.
 *
 * Requirements: 2.2
 */
export interface ClubTrendsIndex {
  /** District identifier */
  districtId: string
  /** ISO timestamp when the index was computed */
  computedAt: string
  /** Map of club ID to ClubTrend for efficient lookup */
  clubs: Record<string, ClubTrend>
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
 * Pre-computed by scraper-cli, served by backend.
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

// ========== District Performance Targets Types (moved from backend) ==========

/**
 * Recognition levels for district performance targets.
 * Ordered from lowest to highest achievement tier.
 * Moved from backend/src/types/analytics.ts to preserve hardened logic.
 *
 * Requirements: 7.2
 */
export type RecognitionLevel =
  | 'distinguished'
  | 'select'
  | 'presidents'
  | 'smedley'

/**
 * Target values for each recognition level.
 * All values are integers (ceiling-rounded from formulas).
 * Moved from backend/src/types/analytics.ts to preserve hardened logic.
 *
 * Requirements: 7.2
 */
export interface RecognitionTargets {
  distinguished: number
  select: number
  presidents: number
  smedley: number
}

/**
 * Target calculation result for a single metric.
 * Contains base value, current value, calculated targets, and achieved level.
 * Moved from backend/src/types/analytics.ts to preserve hardened logic.
 *
 * Requirements: 7.2
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
 * Region ranking data for a single metric.
 * Moved from backend/src/types/analytics.ts to preserve hardened logic.
 *
 * Requirements: 7.2
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
 * Complete ranking data for a metric.
 * Includes world rank, percentile, and region rank.
 * Moved from backend/src/types/analytics.ts to preserve hardened logic.
 *
 * Requirements: 7.2
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
 * Performance targets and rankings for district overview.
 * Contains data for all three enhanced metric cards:
 * - Paid Clubs
 * - Membership Payments
 * - Distinguished Clubs
 *
 * Each metric includes current value, base value, calculated targets,
 * achieved recognition level, and complete ranking data.
 *
 * Moved from backend/src/types/analytics.ts to preserve hardened logic.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4
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

// ========== Area/Division Recognition Types (moved from backend) ==========

/**
 * Recognition level for Areas and Divisions
 * Ordinal: NotDistinguished < Distinguished < Select < Presidents
 *
 * Moved from backend/src/types/analytics.ts to preserve hardened logic.
 *
 * Requirements: 7.1
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
 *
 * Moved from backend/src/types/analytics.ts to preserve hardened logic.
 *
 * Requirements: 7.1
 */
export type RecognitionEligibility = 'eligible' | 'ineligible' | 'unknown'

/**
 * Distinguished Area Program (DAP) metrics and recognition
 *
 * Per steering document dap-ddp-recognition.md:
 * - Eligibility requires club visits (2 per club) - currently unavailable from dashboard
 * - Paid clubs threshold: ≥75%
 * - Distinguished clubs calculated against paid clubs only
 *
 * Moved from backend/src/types/analytics.ts to preserve hardened logic.
 *
 * Requirements: 7.1
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

/**
 * Distinguished Division Program (DDP) metrics and recognition
 *
 * Per steering document dap-ddp-recognition.md:
 * - Eligibility requires area club visits completion - currently unavailable from dashboard
 * - Paid areas threshold: ≥85%
 * - Distinguished areas calculated against paid areas only
 *
 * Moved from backend/src/types/analytics.ts to preserve hardened logic.
 *
 * Requirements: 7.1
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

// ========== Performance Targets Data Types (for pre-computed files) ==========

/**
 * Performance targets data structure for pre-computed files.
 * Pre-computed by scraper-cli, served by backend.
 *
 * Contains recognition level targets (DAP, DDP) and progress tracking
 * for district performance metrics. Uses AreaDivisionRecognitionModule
 * to compute targets based on paid clubs and distinguished clubs percentages.
 *
 * Requirements: 7.1, 7.2
 */
export interface PerformanceTargetsData {
  /** District identifier */
  districtId: string
  /** ISO timestamp when the data was computed */
  computedAt: string
  /** Target for membership (based on base membership + growth target) */
  membershipTarget: number
  /** Target for distinguished clubs count */
  distinguishedTarget: number
  /** Target for club growth (net new clubs) */
  clubGrowthTarget: number
  /** Total count of paid clubs (clubs with "Active" status) */
  paidClubsCount: number
  /** Current progress toward targets */
  currentProgress: {
    /** Current membership count */
    membership: number
    /** Current distinguished clubs count */
    distinguished: number
    /** Current club growth (net change from base) */
    clubGrowth: number
  }
  /** Whether targets are projected to be achieved */
  projectedAchievement: {
    /** Whether membership target is projected to be achieved */
    membership: boolean
    /** Whether distinguished target is projected to be achieved */
    distinguished: boolean
    /** Whether club growth target is projected to be achieved */
    clubGrowth: boolean
  }
  /** Rankings for paid clubs metric (Requirements 4.1, 4.4) */
  paidClubsRankings: MetricRankings
  /** Rankings for membership payments metric (Requirements 4.2, 4.4) */
  membershipPaymentsRankings: MetricRankings
  /** Rankings for distinguished clubs metric (Requirements 4.3, 4.4) */
  distinguishedClubsRankings: MetricRankings
}

// ========== Distinguished Club Analytics Data Types (for pre-computed files) ==========

/**
 * Distinguished club analytics data structure for pre-computed files.
 * Pre-computed by scraper-cli, served by backend.
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
}

// ========== Extended Analytics Computation Result ==========

/**
 * Extended analytics computation result.
 * Extends the base AnalyticsComputationResult with all additional
 * pre-computed analytics data types.
 *
 * This is the complete result returned by computeDistrictAnalytics
 * when all analytics modules are invoked.
 *
 * Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1
 */
export interface ExtendedAnalyticsComputationResult extends AnalyticsComputationResult {
  /** Membership analytics data for pre-computed file */
  membershipAnalytics: MembershipAnalyticsData
  /** Vulnerable clubs data for pre-computed file */
  vulnerableClubs: VulnerableClubsData
  /** Leadership insights data for pre-computed file */
  leadershipInsights: LeadershipInsightsData
  /** Distinguished club analytics data for pre-computed file */
  distinguishedClubAnalytics: DistinguishedClubAnalyticsData
  /** Year-over-year comparison data for pre-computed file */
  yearOverYear: YearOverYearData
  /** Performance targets data for pre-computed file */
  performanceTargets: PerformanceTargetsData
  /** Club trends index for efficient O(1) lookup by club ID */
  clubTrendsIndex: ClubTrendsIndex
}
