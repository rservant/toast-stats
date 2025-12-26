import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../services/api'
import type { RankHistoryResponse } from '../types/districts'

interface UseRankHistoryParams {
  districtIds: string[]
  startDate?: string
  endDate?: string
}

/**
 * React Query hook to fetch historical rank data for multiple districts
 */
export const useRankHistory = ({
  districtIds,
  startDate,
  endDate,
}: UseRankHistoryParams) => {
  return useQuery<RankHistoryResponse[], Error>({
    queryKey: ['rank-history', districtIds, startDate, endDate],
    queryFn: async () => {
      // Fetch rank history for each district
      const promises = districtIds.map(async districtId => {
        const params: Record<string, string> = {}
        if (startDate) params.startDate = startDate
        if (endDate) params.endDate = endDate

        const response = await apiClient.get<RankHistoryResponse>(
          `/districts/${districtId}/rank-history`,
          { params }
        )
        return response.data
      })

      return Promise.all(promises)
    },
    enabled: districtIds.length > 0,
    staleTime: 15 * 60 * 1000, // 15 minutes
    retry: 2,
  })
}
