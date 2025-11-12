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
  distinguished: number
}

export interface EducationStats {
  totalAwards: number
  byType: AwardTypeCount[]
  topClubs: ClubAwards[]
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
  status: 'active' | 'suspended' | 'ineligible'
  memberCount: number
  distinguished: boolean
  distinguishedLevel?: 'select' | 'distinguished' | 'president'
  awards: number
}

export interface ClubsResponse {
  clubs: Club[]
}
