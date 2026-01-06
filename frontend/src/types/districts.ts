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

export interface MembershipHistoryPoint {
  date: string
  count: number
}

export interface MembershipHistoryResponse {
  data: MembershipHistoryPoint[]
}

export interface MembershipStats {
  total: number
  change: number
  changePercent: number
}

export interface ClubStats {
  total: number
  active: number
  suspended: number
  ineligible: number
  low: number
  distinguished: number
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

export interface MonthlyAwards {
  month: string
  count: number
}

export interface EducationStats {
  totalAwards: number
  byType: AwardTypeCount[]
  topClubs: ClubAwards[]
  byMonth: MonthlyAwards[]
}

export interface EducationalAwardsResponse {
  totalAwards: number
  byType: AwardTypeCount[]
  topClubs: ClubAwards[]
  byMonth: MonthlyAwards[]
}

export interface DistrictStatistics {
  districtId: string
  asOfDate: string
  membership: MembershipStats
  clubs: ClubStats
  education: EducationStats

  // New ranking fields
  ranking?: DistrictRankingData
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

// Historical Rank Types

export interface HistoricalRankPoint {
  date: string
  aggregateScore: number
  clubsRank: number
  paymentsRank: number
  distinguishedRank: number
}

export interface DistrictRankHistory {
  districtId: string
  districtName: string
  history: HistoricalRankPoint[]
}

export interface ProgramYearInfo {
  startDate: string
  endDate: string
  year: string
}

export interface RankHistoryResponse {
  districtId: string
  districtName: string
  history: HistoricalRankPoint[]
  programYear: ProgramYearInfo
}

export interface AvailableDatesResponse {
  dates: Array<{
    date: string
    month: number
    day: number
    monthName: string
  }>
  programYear: ProgramYearInfo
}

// District Rankings Types (for getAllDistrictsRankings API)
export interface DistrictRanking {
  districtId: string
  districtName: string
  region: string
  paidClubs: number
  paidClubBase: number
  clubGrowthPercent: number
  totalPayments: number
  paymentBase: number
  paymentGrowthPercent: number
  activeClubs: number
  distinguishedClubs: number
  selectDistinguished: number
  presidentsDistinguished: number
  distinguishedPercent: number
  clubsRank: number
  paymentsRank: number
  distinguishedRank: number
  aggregateScore: number
}

export interface DistrictRankingsResponse {
  rankings: DistrictRanking[]
  date: string
}
