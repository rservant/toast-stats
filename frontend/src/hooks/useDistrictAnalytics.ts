import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api';

export interface ClubTrend {
  clubId: string;
  clubName: string;
  divisionId: string;
  divisionName: string;
  areaId: string;
  areaName: string;
  membershipTrend: Array<{ date: string; count: number }>;
  dcpGoalsTrend: Array<{ date: string; goalsAchieved: number }>;
  currentStatus: 'healthy' | 'at-risk' | 'critical';
  riskFactors: string[];
  distinguishedLevel?: 'President' | 'Select' | 'Distinguished';
}

export interface DivisionAnalytics {
  divisionId: string;
  divisionName: string;
  totalClubs: number;
  totalDcpGoals: number;
  averageClubHealth: number;
  rank: number;
  trend: 'improving' | 'stable' | 'declining';
}

export interface AreaAnalytics {
  areaId: string;
  areaName: string;
  divisionId: string;
  totalClubs: number;
  averageClubHealth: number;
  totalDcpGoals: number;
  normalizedScore: number;
}

export interface DistrictAnalytics {
  districtId: string;
  dateRange: { start: string; end: string };
  totalMembership: number;
  membershipChange: number;
  membershipTrend: Array<{ date: string; count: number }>;
  topGrowthClubs: Array<{ clubId: string; clubName: string; growth: number }>;
  allClubs: ClubTrend[];
  atRiskClubs: ClubTrend[];
  healthyClubs: number;
  criticalClubs: number;
  distinguishedClubs: {
    presidents: number;
    select: number;
    distinguished: number;
    total: number;
  };
  distinguishedProjection: number;
  divisionRankings: DivisionAnalytics[];
  topPerformingAreas: AreaAnalytics[];
  yearOverYear?: {
    membershipChange: number;
    distinguishedChange: number;
    clubHealthChange: number;
  };
}

/**
 * Hook to fetch district analytics with caching for common date ranges
 */
export const useDistrictAnalytics = (
  districtId: string | null,
  startDate?: string,
  endDate?: string
) => {
  return useQuery<DistrictAnalytics, Error>({
    queryKey: ['districtAnalytics', districtId, startDate, endDate],
    queryFn: async () => {
      if (!districtId) {
        throw new Error('District ID is required');
      }

      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await apiClient.get<DistrictAnalytics>(
        `/districts/${districtId}/analytics${params.toString() ? `?${params.toString()}` : ''}`
      );
      return response.data;
    },
    enabled: !!districtId,
    staleTime: 10 * 60 * 1000, // 10 minutes - cache analytics calculations longer
    gcTime: 30 * 60 * 1000, // 30 minutes - keep in cache for common date ranges
    retry: (failureCount, error: any) => {
      // Don't retry on 404 (no data) or 400 (bad request)
      if (error?.response?.status === 404 || error?.response?.status === 400) {
        return false;
      }
      // Retry up to 2 times for other errors
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  });
};


