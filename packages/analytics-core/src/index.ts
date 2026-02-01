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
  ClubTrend,
  ClubHealthData,
  
  // Division and area
  DivisionRanking,
  AreaPerformance,
  
  // Distinguished clubs
  DistinguishedProjection,
  DistinguishedClubSummary,
  
  // Core analytics
  DateRange,
  DistrictAnalytics,
  AnalyticsComputationResult,
  ComputeOptions,
  
  // File structures
  PreComputedAnalyticsFile,
  AnalyticsManifestEntry,
  AnalyticsManifest,
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
