/**
 * Type definitions for district-related data structures
 */

export interface District {
  id: string
  name: string
}

export interface DistrictsResponse {
  districts: District[]
}

export interface MembershipStats {
  total: number
  change: number
  changePercent: number
  byClub: ClubMembership[]
  new?: number // Optional for backward compatibility
  renewed?: number // Optional for backward compatibility
  dual?: number // Optional for backward compatibility
}

export interface ClubMembership {
  clubId: string
  clubName: string
  memberCount: number
}

export interface ClubStats {
  total: number
  active: number
  suspended: number
  ineligible: number
  low: number
  distinguished: number
  chartered?: number // Optional for backward compatibility
}

export interface EducationStats {
  totalAwards: number
  byType: AwardTypeCount[]
  topClubs: ClubAwards[]
  byMonth?: MonthlyAwards[]
}

export interface MonthlyAwards {
  month: string
  count: number
}

export interface AwardTypeCount {
  type: string
  count: number
}

export interface ClubAwards {
  clubId: string
  clubName: string
  awards: number
}

export interface DistrictGoals {
  clubsGoal: number
  membershipGoal: number
  distinguishedGoal: number
}

export interface DistrictPerformance {
  membershipNet: number
  clubsNet: number
  distinguishedPercent: number
}

// Raw scraped data types (CSV records with dynamic columns)
export type ScrapedRecord = Record<string, string | number | null>

// Raw CSV performance data interfaces (from dashboard exports)
export interface ClubPerformanceRecord {
  'Club Number': string
  'Club Name': string
  Division: string
  Area: string
  'Active Members': string
  'Goals Met': string
  'Club Status'?: string
  'Club Distinguished Status'?: string
  'Mem. Base'?: string
  Status?: string
  Membership?: string
  [key: string]: string | undefined // Allow additional dynamic fields
}

export interface DivisionPerformanceRecord {
  Division: string
  'Total Clubs': string
  'Total Members': string
  'Goals Met': string
  [key: string]: string | undefined // Allow additional dynamic fields
}

export interface DistrictPerformanceRecord {
  District: string
  'Total Clubs': string
  'Total Members': string
  'Goals Met': string
  'Distinguished Clubs': string
  [key: string]: string | undefined // Allow additional dynamic fields
}

// Raw CSV data from getAllDistricts API call
export interface AllDistrictsCSVRecord {
  DISTRICT: string
  REGION: string
  'Paid Clubs': string
  'Paid Club Base': string
  '% Club Growth': string
  'Total YTD Payments': string
  'Payment Base': string
  '% Payment Growth': string
  'Active Clubs': string
  'Total Distinguished Clubs': string
  'Select Distinguished Clubs': string
  'Presidents Distinguished Clubs'?: string // Optional as it may not always be present
  [key: string]: string | undefined // Allow additional dynamic fields
}

// District list from dropdown
export interface DistrictInfo {
  id: string
  name: string
}

export interface DistrictStatistics {
  districtId: string
  asOfDate: string
  membership: MembershipStats
  clubs: ClubStats
  education: EducationStats
  goals?: DistrictGoals
  performance?: DistrictPerformance

  // New ranking fields
  ranking?: DistrictRankingData

  // Raw data arrays from scraper (for caching purposes)
  districtPerformance?: ScrapedRecord[]
  divisionPerformance?: ScrapedRecord[]
  clubPerformance?: ScrapedRecord[]
}

export interface DistrictRankingData {
  // Individual category ranks (1 = best)
  clubsRank: number
  paymentsRank: number
  distinguishedRank: number

  // Aggregate Borda count score (higher = better)
  aggregateScore: number

  // Growth metrics used for ranking
  clubGrowthPercent: number
  paymentGrowthPercent: number
  distinguishedPercent: number

  // Base values for growth calculations
  paidClubBase: number
  paymentBase: number

  // Absolute values
  paidClubs: number
  totalPayments: number
  distinguishedClubs: number
  activeClubs: number
  selectDistinguished: number
  presidentsDistinguished: number

  // Regional information
  region: string
  districtName: string

  // Algorithm metadata
  rankingVersion: string
  calculatedAt: string
}

export interface MembershipHistoryPoint {
  date: string
  count: number
}

export interface MembershipHistoryResponse {
  data: MembershipHistoryPoint[]
}

export interface Club {
  id: string
  name: string
  status: 'active' | 'suspended' | 'ineligible' | 'low'
  memberCount: number
  distinguished: boolean
  distinguishedLevel?: 'select' | 'distinguished' | 'president'
  awards: number
}

export interface ClubsResponse {
  clubs: Club[]
}

// Daily Report Types

export interface Member {
  name: string
  clubId: string
  clubName: string
}

export interface ClubChange {
  clubId: string
  clubName: string
  changeType: 'chartered' | 'suspended' | 'reinstated' | 'closed'
  details?: string
}

export interface Award {
  type: string
  level?: string
  recipient: string
  clubId: string
  clubName: string
}

export interface DailyReportSummary {
  totalNewMembers: number
  totalRenewals: number
  totalAwards: number
  netMembershipChange: number
  dayOverDayChange: number
}

export interface DailyReport {
  date: string
  newMembers: Member[]
  renewals: Member[]
  clubChanges: ClubChange[]
  awards: Award[]
  summary: DailyReportSummary
}

export interface DailyReportsResponse {
  reports: Array<{
    date: string
    newMembers: number
    renewals: number
    clubChanges: Array<{ clubId: string; change: string }>
    awards: number
  }>
}

export type DailyReportDetailResponse = DailyReport

// Historical Cache Types

export interface DistrictRankSnapshot {
  districtId: string
  districtName: string
  aggregateScore: number
  clubsRank: number
  paymentsRank: number
  distinguishedRank: number
  paidClubs: number
  totalPayments: number
  distinguishedClubs: number
}

export interface CacheMetadata {
  date: string
  timestamp: number // Unix timestamp when cached
  dataCompleteness: 'complete' | 'partial' | 'empty'
  districtCount: number
  source: 'scraper' | 'manual' | 'api'
  programYear: string
  cacheVersion?: number // Cache format version for migration tracking (added v2)
}

export interface HistoricalDataIndex {
  dates: string[] // Sorted array of all cached dates
  districtIds: string[] // All unique district IDs
  ranksByDate: Map<string, DistrictRankSnapshot[]> // date -> array of district ranks
  metadata: Map<string, CacheMetadata> // date -> metadata
}

export interface CacheStatistics {
  totalDates: number
  dateRange: {
    earliest: string | null
    latest: string | null
  }
  completeDates: number
  partialDates: number
  emptyDates: number
  totalDistricts: number
  programYears: string[]
  cacheSize: number // Total size in bytes (approximate)
}

// Backfill Types

export interface BackfillRequest {
  startDate?: string
  endDate?: string
}

export interface BackfillProgress {
  total: number
  completed: number
  skipped: number
  unavailable: number
  failed: number
  current: string
}

export interface BackfillJob {
  backfillId: string
  status: 'processing' | 'complete' | 'error'
  progress: BackfillProgress
  error?: string
  createdAt: number
}

export interface BackfillResponse {
  backfillId: string
  status: 'processing' | 'complete' | 'error'
  progress: BackfillProgress
  error?: string
}

// District Rankings Types (for getAllDistrictsRankings API)
// DistrictRanking is exported from snapshots.ts to avoid duplicate exports
// Re-export it here for backward compatibility
export type { DistrictRanking } from './snapshots.js'

export interface DistrictRankingsResponse {
  rankings: import('./snapshots.js').DistrictRanking[]
  date: string
}

// District-Level Cache Types

export interface DistrictCacheEntry {
  districtId: string
  date: string
  districtPerformance: ScrapedRecord[] // From District.aspx
  divisionPerformance: ScrapedRecord[] // From Division.aspx
  clubPerformance: ScrapedRecord[] // From Club.aspx
  fetchedAt: string
  /**
   * Optional time-series summary data when loaded from time-series index
   * Contains pre-computed metrics for efficient trend calculations
   * Requirement 2.3: Support efficient range queries via time-series index
   */
  _timeSeriesSummary?: {
    membership: number
    payments: number
    dcpGoals: number
    distinguishedTotal: number
    clubCounts: {
      total: number
      thriving: number
      vulnerable: number
      interventionRequired: number
    }
  }
}

export interface DistrictDataRange {
  startDate: string
  endDate: string
}

// Available Program Years Types (for Global Rankings feature)

/**
 * Program year with associated ranking data metadata
 * Used by the Global Rankings tab to display available program years
 */
export interface ProgramYearWithData {
  /** Program year string, e.g., "2023-2024" */
  year: string
  /** Start date of the program year (July 1), e.g., "2023-07-01" */
  startDate: string
  /** End date of the program year (June 30), e.g., "2024-06-30" */
  endDate: string
  /** Whether the program year has complete data (ended and has final snapshot) */
  hasCompleteData: boolean
  /** Number of snapshots available for this program year */
  snapshotCount: number
  /** Date of the latest snapshot in this program year */
  latestSnapshotDate: string
}

/**
 * Response type for the available ranking years endpoint
 * GET /api/districts/:districtId/available-ranking-years
 */
export interface AvailableRankingYearsResponse {
  districtId: string
  programYears: ProgramYearWithData[]
}
