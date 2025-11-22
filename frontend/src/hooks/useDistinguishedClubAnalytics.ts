import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api';

interface DCPGoalAnalysis {
  goalNumber: number;
  achievementCount: number;
  achievementPercentage: number;
}

interface DistinguishedClubAchievement {
  clubId: string;
  clubName: string;
  level: 'President' | 'Select' | 'Distinguished';
  achievedDate: string;
  goalsAchieved: number;
}

export interface DistinguishedClubAnalytics {
  distinguishedClubs: {
    presidents: number;
    select: number;
    distinguished: number;
    total: number;
  };
  distinguishedProjection: {
    presidents: number;
    select: number;
    distinguished: number;
    total: number;
  };
  achievements: DistinguishedClubAchievement[];
  yearOverYearComparison?: {
    currentTotal: number;
    previousTotal: number;
    change: number;
    percentageChange: number;
    currentByLevel: {
      presidents: number;
      select: number;
      distinguished: number;
    };
    previousByLevel: {
      presidents: number;
      select: number;
      distinguished: number;
    };
  };
  dcpGoalAnalysis: {
    mostCommonlyAchieved: DCPGoalAnalysis[];
    leastCommonlyAchieved: DCPGoalAnalysis[];
  };
}

/**
 * Hook to fetch distinguished club analytics for a district
 */
export const useDistinguishedClubAnalytics = (
  districtId: string | null,
  startDate?: string,
  endDate?: string
) => {
  return useQuery<DistinguishedClubAnalytics, Error>({
    queryKey: ['distinguishedClubAnalytics', districtId, startDate, endDate],
    queryFn: async () => {
      if (!districtId) {
        throw new Error('District ID is required');
      }

      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await apiClient.get<DistinguishedClubAnalytics>(
        `/districts/${districtId}/distinguished-club-analytics${params.toString() ? `?${params.toString()}` : ''}`
      );
      return response.data;
    },
    enabled: !!districtId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
};
