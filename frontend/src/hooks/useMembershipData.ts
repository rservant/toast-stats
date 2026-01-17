import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../services/api'
import type {
  DistrictStatistics,
  MembershipHistoryResponse,
} from '../types/districts'

/**
 * React Query hook to fetch district statistics including membership data
 *
 * @param districtId - The district ID to fetch statistics for
 * @param selectedDate - Optional date in YYYY-MM-DD format to fetch statistics for a specific date.
 *                       When provided, the API will return data from the snapshot matching that date
 *                       (or the nearest available snapshot if exact date not found).
 *                       When undefined, returns the latest snapshot (backward compatible behavior).
 */
export const useDistrictStatistics = (
  districtId: string | null,
  selectedDate?: string
) => {
  return useQuery<DistrictStatistics, Error>({
    queryKey: ['districtStatistics', districtId, selectedDate],
    queryFn: async () => {
      if (!districtId) {
        throw new Error('District ID is required')
      }
      const response = await apiClient.get<DistrictStatistics>(
        `/districts/${districtId}/statistics`,
        {
          params: selectedDate ? { date: selectedDate } : undefined,
        }
      )
      return response.data
    },
    enabled: !!districtId,
    staleTime: 15 * 60 * 1000, // 15 minutes - matches backend cache
    retry: 2,
  })
}

/**
 * React Query hook to fetch membership history data
 */
export const useMembershipHistory = (
  districtId: string | null,
  months: number = 12
) => {
  return useQuery<MembershipHistoryResponse, Error>({
    queryKey: ['membershipHistory', districtId, months],
    queryFn: async () => {
      if (!districtId) {
        throw new Error('District ID is required')
      }
      const response = await apiClient.get<MembershipHistoryResponse>(
        `/districts/${districtId}/membership-history`,
        {
          params: { months },
        }
      )
      return response.data
    },
    enabled: !!districtId,
    staleTime: 15 * 60 * 1000, // 15 minutes - matches backend cache
    retry: 2,
  })
}
