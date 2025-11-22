import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../services/api'

interface BackfillRequest {
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

interface BackfillResponse {
  backfillId: string
  status: 'processing' | 'complete' | 'error'
  progress: BackfillProgress
  error?: string
}

/**
 * Hook to initiate a backfill
 */
export function useInitiateBackfill() {
  return useMutation({
    mutationFn: async (request: BackfillRequest) => {
      const response = await apiClient.post<BackfillResponse>('/districts/backfill', request)
      return response.data
    },
  })
}

/**
 * Hook to poll backfill status
 * Automatically polls every 2 seconds while backfill is processing
 */
export function useBackfillStatus(backfillId: string | null, enabled: boolean = true) {
  return useQuery({
    queryKey: ['backfillStatus', backfillId],
    queryFn: async () => {
      if (!backfillId) {
        throw new Error('No backfill ID provided')
      }
      const response = await apiClient.get<BackfillResponse>(`/districts/backfill/${backfillId}`)
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
 * Hook to cancel a backfill
 */
export function useCancelBackfill() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (backfillId: string) => {
      await apiClient.delete(`/districts/backfill/${backfillId}`)
    },
    onSuccess: (_data, backfillId) => {
      // Invalidate the status query to stop polling
      queryClient.invalidateQueries({ queryKey: ['backfillStatus', backfillId] })
      // Invalidate cached dates to refresh the list
      queryClient.invalidateQueries({ queryKey: ['cached-dates'] })
    },
  })
}
