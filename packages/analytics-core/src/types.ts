/**
 * Core type definitions for analytics computation.
 *
 * These types define the structure of analytics data that flows through
 * the pre-computed analytics pipeline.
 */

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
 * Individual club trend data.
 */
export interface ClubTrend {
  clubId: string
  clubName: string
  currentStatus: ClubHealthStatus
  riskFactors: ClubRiskFactors
  membershipCount: number
  paymentsCount: number
  healthScore: number
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
  status: 'distinguished' | 'select' | 'president' | 'none'
  dcpPoints: number
  goalsCompleted: number
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
  distinguishedClubs: DistinguishedClubSummary[]
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
  type: 'analytics' | 'membership' | 'clubhealth' | 'rankings'
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
