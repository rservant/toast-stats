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

export interface DistrictStatistics {
  districtId: string
  asOfDate: string
  membership: MembershipStats
  clubs: ClubStats
  education: EducationStats
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

export interface DailyReportDetailResponse extends DailyReport {}

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
