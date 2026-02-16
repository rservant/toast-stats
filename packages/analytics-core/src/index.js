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
  // Target calculation utilities (Requirements 2.1-2.6, 3.1-3.6, 4.1-4.6, 5.1-5.6)
  calculateGrowthTargets,
  calculatePercentageTargets,
  determineAchievedLevel,
  GROWTH_PERCENTAGES,
  DISTINGUISHED_PERCENTAGES,
} from './analytics/index.js'
// Time-series computation
export { TimeSeriesDataPointBuilder } from './timeseries/index.js'
// Rankings computation
export {
  BordaCountRankingCalculator,
  MetricRankingsCalculator,
} from './rankings/index.js'
