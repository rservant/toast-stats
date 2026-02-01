/**
 * @toastmasters/analytics-core
 *
 * Shared analytics computation logic for Toastmasters statistics.
 * This package provides the core algorithms and types used by both
 * scraper-cli (for pre-computing analytics) and backend (for validation).
 */

// Version and compatibility
export {
  ANALYTICS_SCHEMA_VERSION,
  COMPUTATION_VERSION,
  isCompatibleVersion,
} from './version.js'

// Data transformation
export { DataTransformer } from './transformation/index.js'
export type { Logger, DataTransformerConfig } from './transformation/index.js'

// Analytics computation
export {
  AnalyticsComputer,
  MembershipAnalyticsModule,
  ClubHealthAnalyticsModule,
  DistinguishedClubAnalyticsModule,
  DivisionAreaAnalyticsModule,
  LeadershipAnalyticsModule,
  AreaDivisionRecognitionModule,
  DAP_THRESHOLDS,
  DDP_THRESHOLDS,
  // Utility functions
  parseIntSafe,
  parseIntOrUndefined,
  ensureString,
  getDCPCheckpoint,
  getCurrentProgramMonth,
  getMonthName,
  findPreviousProgramYearDate,
  calculatePercentageChange,
  determineTrend,
  // Risk factors conversion utilities (Requirements 2.6)
  riskFactorsToStringArray,
  stringArrayToRiskFactors,
  RISK_FACTOR_LABELS,
} from './analytics/index.js'

export type { MultiYearTrendDirection } from './analytics/index.js'

// Type definitions
export type {
  // Metadata
  AnalyticsMetadata,

  // Membership trends
  MembershipTrendPoint,
  PaymentsTrendPoint,
  YearOverYearComparison,
  MembershipTrendData,

  // Club health
  ClubRiskFactors,
  ClubHealthStatus,
  DistinguishedLevel,
  DcpGoalsTrendPoint,
  ClubTrend,
  ClubHealthData,

  // Division and area
  DivisionRanking,
  AreaPerformance,
  TrendDirection,
  DivisionAnalytics,
  AreaAnalytics,

  // Distinguished clubs
  DistinguishedProjection,
  DistinguishedClubSummary,
  DistinguishedClubCounts,

  // Distinguished Club Analytics types (Requirements 5.1, 5.2)
  DistinguishedClubAchievement,
  DCPGoalAnalysis,
  DistinguishedClubAnalytics,

  // Core analytics
  DateRange,
  DistrictAnalytics,
  AnalyticsComputationResult,
  ComputeOptions,

  // File structures
  PreComputedAnalyticsFile,
  AnalyticsManifestEntry,
  AnalyticsManifest,

  // Membership Analytics types (Requirements 1.2)
  SeasonalPattern,
  MembershipYearOverYearComparison,
  MembershipAnalytics,

  // Leadership Insights types (Requirements 4.2)
  LeadershipEffectivenessScore,
  LeadershipChange,
  AreaDirectorCorrelation,
  LeadershipInsights,

  // Extended Year-Over-Year Comparison types (Requirements 6.2, 6.3)
  ExtendedYearOverYearComparison,

  // District Performance Targets types (Requirements 7.2)
  RecognitionLevel,
  RecognitionTargets,
  MetricTargets,
  RegionRankData,
  MetricRankings,
  DistrictPerformanceTargets,

  // Vulnerable Clubs Data types (Requirements 3.2)
  VulnerableClubsData,

  // Club Trends Index types (Requirements 2.2)
  ClubTrendsIndex,

  // Area/Division Recognition types (Requirements 7.1)
  AreaDivisionRecognitionLevel,
  RecognitionEligibility,
  AreaRecognition,
  DivisionRecognition,
} from './types.js'

// Interfaces
export type {
  // Raw data
  RawCSVData,

  // Statistics
  DistrictStatistics,
  ClubStatistics,
  DivisionStatistics,
  AreaStatistics,
  DistrictTotals,

  // Snapshots
  SnapshotMetadata,
  Snapshot,

  // Core interfaces
  IAnalyticsComputer,
  IDataTransformer,
} from './interfaces.js'
