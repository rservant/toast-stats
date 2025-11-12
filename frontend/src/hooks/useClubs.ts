import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import type { ClubsResponse } from '../types/districts';

/**
 * React Query hook to fetch clubs data for a district
 */
export const useClubs = (districtId: string | null) => {
  return useQuery<ClubsResponse, Error>({
    queryKey: ['clubs', districtId],
    queryFn: async () => {
      if (!districtId) {
        throw new Error('District ID is required');
      }
      const response = await apiClient.get<ClubsResponse>(
        `/districts/${districtId}/clubs`
      );
      return response.data;
    },
    enabled: !!districtId,
    staleTime: 15 * 60 * 1000, // 15 minutes - matches backend cache
    retry: 2,
  });
};
