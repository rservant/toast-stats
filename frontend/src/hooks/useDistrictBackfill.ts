import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../services/api'

interface DistrictBackfillRequest {
  startDate?: string
  endDate?: string
}

interface BackfillProgress {
  total: number
  completed: number
  skipped: number
  unavailable: number
  failed: number
  current: string
}

interface DistrictBackfillResponse {
  backfillId: string
  districtId: string
  status: 'processing' | 'complete' | 'error'
  progress: BackfillProgress
  error?: string
}

/**
 * Hook to initiate a district backfill
 */
export function useInitiateDistrictBackfill(districtId: string) {
  return useMutation({
    mutationFn: async (request: DistrictBackfillRequest) => {
      const response = await apiClient.post<DistrictBackfillResponse>(
        `/districts/${districtId}/backfill`,
        request
      )
      return response.data
    },
  })
}

/**
 * Hook to poll district backfill status
 * Automatically polls every 2 seconds while backfill is processing
 */
export function useDistrictBackfillStatus(
  districtId: string,
  backfillId: string | null,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['districtBackfillStatus', districtId, backfillId],
    queryFn: async () => {
      if (!backfillId) {
        throw new Error('No backfill ID provided')
      }
      const response = await apiClient.get<DistrictBackfillResponse>(
        `/districts/${districtId}/backfill/${backfillId}`
      )
      return response.data
    },
    enabled: enabled && !!backfillId,
    refetchInterval: (query) => {
      const data = query.state.data
      // Stop polling if backfill is complete or errored
      if (data?.status === 'complete' || data?.status === 'error') {
        return false
      }
      // Poll every 2 seconds while processing
      return 2000
    },
    refetchIntervalInBackground: true,
    staleTime: 0, // Always consider data stale to ensure fresh polling
  })
}

/**
 * Hook to cancel a district backfill
 */
export function useCancelDistrictBackfill(districtId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (backfillId: string) => {
      await apiClient.delete(`/districts/${districtId}/backfill/${backfillId}`)
    },
    onSuccess: (_data, backfillId) => {
      // Invalidate the status query to stop polling
      queryClient.invalidateQueries({ queryKey: ['districtBackfillStatus', districtId, backfillId] })
      // Invalidate cached dates to refresh the list
      queryClient.invalidateQueries({ queryKey: ['district-cached-dates', districtId] })
    },
  })
}
