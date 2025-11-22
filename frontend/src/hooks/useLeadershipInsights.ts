import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api';

interface LeadershipEffectivenessScore {
  divisionId: string;
  divisionName: string;
  healthScore: number;
  growthScore: number;
  dcpScore: number;
  overallScore: number;
  rank: number;
  isBestPractice: boolean;
}

interface LeadershipChange {
  divisionId: string;
  divisionName: string;
  changeDate: string;
  performanceBeforeChange: number;
  performanceAfterChange: number;
  performanceDelta: number;
  trend: 'improved' | 'declined' | 'stable';
}

interface AreaDirectorCorrelation {
  areaId: string;
  areaName: string;
  divisionId: string;
  clubPerformanceScore: number;
  activityIndicator: 'high' | 'medium' | 'low';
  correlation: 'positive' | 'neutral' | 'negative';
}

export interface LeadershipInsights {
  leadershipScores: LeadershipEffectivenessScore[];
  bestPracticeDivisions: LeadershipEffectivenessScore[];
  leadershipChanges: LeadershipChange[];
  areaDirectorCorrelations: AreaDirectorCorrelation[];
  summary: {
    topPerformingDivisions: Array<{ divisionId: string; divisionName: string; score: number }>;
    topPerformingAreas: Array<{ areaId: string; areaName: string; score: number }>;
    averageLeadershipScore: number;
    totalBestPracticeDivisions: number;
  };
}

/**
 * Hook to fetch leadership insights for a district
 */
export const useLeadershipInsights = (
  districtId: string | null,
  startDate?: string,
  endDate?: string
) => {
  return useQuery<LeadershipInsights, Error>({
    queryKey: ['leadershipInsights', districtId, startDate, endDate],
    queryFn: async () => {
      if (!districtId) {
        throw new Error('District ID is required');
      }

      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await apiClient.get<LeadershipInsights>(
        `/districts/${districtId}/leadership-insights${params.toString() ? `?${params.toString()}` : ''}`
      );
      return response.data;
    },
    enabled: !!districtId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
};
