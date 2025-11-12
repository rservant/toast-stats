import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import type { DistrictsResponse } from '../types/districts';

/**
 * React Query hook to fetch available districts
 */
export const useDistricts = () => {
  return useQuery<DistrictsResponse, Error>({
    queryKey: ['districts'],
    queryFn: async () => {
      const response = await apiClient.get<DistrictsResponse>('/districts');
      return response.data;
    },
    staleTime: 15 * 60 * 1000, // 15 minutes - matches backend cache
    retry: 2,
  });
};
