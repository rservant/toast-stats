/**
 * Type definitions for district-related data structures
 */

export interface District {
  id: string;
  name: string;
}

export interface DistrictsResponse {
  districts: District[];
}

export interface MembershipHistoryPoint {
  date: string;
  count: number;
}

export interface MembershipHistoryResponse {
  data: MembershipHistoryPoint[];
}

export interface MembershipStats {
  total: number;
  change: number;
  changePercent: number;
}

export interface ClubStats {
  total: number;
  active: number;
  suspended: number;
  distinguished: number;
}

export interface EducationStats {
  totalAwards: number;
}

export interface DistrictStatistics {
  districtId: string;
  asOfDate: string;
  membership: MembershipStats;
  clubs: ClubStats;
  education: EducationStats;
}
