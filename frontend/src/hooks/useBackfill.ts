import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../services/api'

interface BackfillRequest {
  // Targeting options
  targetDistricts?: string[]

  // Date range
  startDate?: string
  endDate?: string

  // Collection preferences
  collectionType?: 'system-wide' | 'per-district' | 'auto'

  // Performance options
  concurrency?: number
  retryFailures?: boolean
  skipExisting?: boolean
  rateLimitDelayMs?: number
  enableCaching?: boolean
}

interface DistrictProgress {
  districtId: string
  status:
    | 'pending'
    | 'processing'
    | 'completed'
    | 'failed'
    | 'skipped'
    | 'blacklisted'
  datesProcessed: number
  datesTotal: number
  lastError?: string
  successfulDates: string[]
  failedDates: string[]
  retryCount: number
}

interface BackfillProgress {
  total: number
  completed: number
  skipped: number
  unavailable: number
  failed: number
  current: string

  // Enhanced error tracking
  partialSnapshots: number
  totalErrors: number
  retryableErrors: number
  permanentErrors: number
  districtProgress: Record<string, DistrictProgress>
}

interface CollectionStrategy {
  type: 'system-wide' | 'per-district' | 'targeted'
  refreshMethod: {
    name: string
    params: Record<string, unknown>
  }
  rationale: string
  estimatedEfficiency: number
  targetDistricts?: string[]
}

interface BackfillScope {
  targetDistricts: string[]
  configuredDistricts: string[]
  scopeType: 'system-wide' | 'targeted' | 'single-district'
  validationPassed: boolean
}

interface ErrorSummary {
  totalErrors: number
  retryableErrors: number
  permanentErrors: number
  affectedDistricts: string[]
  partialSnapshots: number
}

interface PerformanceStatus {
  rateLimiter: {
    currentCount: number
    maxRequests: number
    windowMs: number
    nextResetAt: string
  }
  concurrencyLimiter: {
    activeSlots: number
    maxConcurrent: number
    queueLength: number
  }
  intermediateCache: {
    hitRate: number
    entryCount: number
    sizeBytes: number
  }
}

interface BackfillResponse {
  backfillId: string
  status: 'processing' | 'complete' | 'error' | 'cancelled' | 'partial_success'
  scope: BackfillScope
  progress: BackfillProgress
  collectionStrategy: CollectionStrategy
  error?: string
  snapshotIds: string[]

  // Enhanced error information
  errorSummary?: ErrorSummary
  partialSnapshots?: Array<{
    snapshotId: string
    successfulDistricts: string[]
    failedDistricts: string[]
    totalDistricts: number
    successRate: number
  }>

  // Performance optimization status
  performanceStatus?: PerformanceStatus
}

/**
 * Hook to initiate a backfill
 */
export function useInitiateBackfill() {
  return useMutation({
    mutationFn: async (request: BackfillRequest) => {
      const response = await apiClient.post<BackfillResponse>(
        '/districts/backfill',
        request
      )
      return response.data
    },
  })
}

/**
 * Hook to poll backfill status
 * Automatically polls every 2 seconds while backfill is processing
 */
export function useBackfillStatus(
  backfillId: string | null,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['backfillStatus', backfillId],
    queryFn: async () => {
      if (!backfillId) {
        throw new Error('No backfill ID provided')
      }
      const response = await apiClient.get<BackfillResponse>(
        `/districts/backfill/${backfillId}`
      )
      return response.data
    },
    enabled: enabled && !!backfillId,
    refetchInterval: query => {
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
      queryClient.invalidateQueries({
        queryKey: ['backfillStatus', backfillId],
      })
      // Invalidate cached dates to refresh the list
      queryClient.invalidateQueries({ queryKey: ['cached-dates'] })
    },
  })
}
