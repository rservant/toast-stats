/**
 * Analytics type definitions — re-export barrel.
 *
 * All types are organized by domain in the types/ directory.
 * This barrel file re-exports everything for backward compatibility —
 * existing import paths (`from '../types.js'`) continue to work unchanged.
 */

// Core analytics types
export type {
  AnalyticsMetadata,
  MembershipTrendPoint,
  PaymentsTrendPoint,
  YearOverYearComparison,
  MembershipTrendData,
  ClubRiskFactors,
  ClubHealthStatus,
  DistinguishedLevel,
  DcpGoalsTrendPoint,
  ClubTrend,
  ClubHealthData,
  DivisionRanking,
  AreaPerformance,
  TrendDirection,
  DivisionAnalytics,
  AreaAnalytics,
  DistinguishedProjection,
  DistinguishedClubSummary,
  DistinguishedClubCounts,
  DateRange,
  DistrictAnalytics,
  AnalyticsComputationResult,
  ComputeOptions,
  PreComputedAnalyticsFile,
  AnalyticsManifestEntry,
  AnalyticsManifest,
} from './types/core.js'

// Membership analytics types
export type {
  SeasonalPattern,
  MembershipYearOverYearComparison,
  MembershipAnalytics,
  MembershipAnalyticsData,
} from './types/membership.js'

// Leadership insights types
export type {
  LeadershipEffectivenessScore,
  LeadershipChange,
  AreaDirectorCorrelation,
  LeadershipInsights,
  LeadershipInsightsData,
} from './types/leadership.js'

// Year-over-year comparison types
export type {
  ExtendedYearOverYearComparison,
  MetricComparison,
  MultiYearTrend,
  YearOverYearData,
} from './types/yearOverYear.js'

// Vulnerable clubs and club trends types
export type {
  VulnerableClubsData,
  ClubTrendsIndex,
} from './types/vulnerableClubs.js'

// Distinguished club analytics types
export type {
  DistinguishedClubAchievement,
  DCPGoalAnalysis,
  DistinguishedClubAnalytics,
  DistinguishedClubAnalyticsData,
} from './types/distinguished.js'

// Performance targets types
export type {
  RecognitionLevel,
  RecognitionTargets,
  MetricTargets,
  RegionRankData,
  MetricRankings,
  DistrictPerformanceTargets,
  PerformanceTargetsData,
} from './types/performanceTargets.js'

// Area/Division recognition types
export type {
  AreaDivisionRecognitionLevel,
  RecognitionEligibility,
  AreaRecognition,
  DivisionRecognition,
} from './types/recognition.js'

// Extended analytics computation result
// This type references types from multiple domains, so it lives here.
import type { AnalyticsComputationResult } from './types/core.js'
import type { MembershipAnalyticsData } from './types/membership.js'
import type { LeadershipInsightsData } from './types/leadership.js'
import type { YearOverYearData } from './types/yearOverYear.js'
import type {
  VulnerableClubsData,
  ClubTrendsIndex,
} from './types/vulnerableClubs.js'
import type { DistinguishedClubAnalyticsData } from './types/distinguished.js'
import type { PerformanceTargetsData } from './types/performanceTargets.js'

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
