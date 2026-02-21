import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../services/api'
import type { RankHistoryResponse } from '../types/districts'

interface UseRankHistoryParams {
  districtIds: string[]
  startDate?: string
  endDate?: string
}

/**
 * React Query hook to fetch historical rank data for multiple districts.
 * Uses the batch endpoint to avoid N concurrent requests overwhelming Cloud Run.
 */
export const useRankHistory = ({
  districtIds,
  startDate,
  endDate,
}: UseRankHistoryParams) => {
  return useQuery<RankHistoryResponse[], Error>({
    queryKey: ['rank-history', districtIds, startDate, endDate],
    queryFn: async () => {
      // Single batch request instead of N parallel requests
      const response = await apiClient.post<RankHistoryResponse[]>(
        '/districts/rank-history-batch',
        {
          districtIds,
          startDate,
          endDate,
        }
      )
      return response.data
    },
    enabled: districtIds.length > 0,
    staleTime: 15 * 60 * 1000, // 15 minutes
    retry: 2,
  })
}
