import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import type { EducationalAwardsResponse } from '../types/districts';

/**
 * React Query hook to fetch educational awards data for a district
 */
export const useEducationalAwards = (
  districtId: string | null,
  months: number = 12
) => {
  return useQuery<EducationalAwardsResponse, Error>({
    queryKey: ['educationalAwards', districtId, months],
    queryFn: async () => {
      if (!districtId) {
        throw new Error('District ID is required');
      }
      const response = await apiClient.get<EducationalAwardsResponse>(
        `/districts/${districtId}/educational-awards`,
        {
          params: { months },
        }
      );
      return response.data;
    },
    enabled: !!districtId,
    staleTime: 15 * 60 * 1000, // 15 minutes - matches backend cache
    retry: 2,
  });
};
