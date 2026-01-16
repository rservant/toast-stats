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
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped'
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

  // District-specific fields (for backward compatibility)
  districtId?: string
}

/**
 * Options for backfill hooks
 * When districtId is provided, uses district-specific endpoints
 * When districtId is absent, uses global backfill endpoints
 */
interface BackfillOptions {
  districtId?: string
}

/**
 * Constructs the appropriate endpoint URL based on whether a districtId is provided
 */
function getBackfillEndpoint(districtId?: string): string {
  return districtId
    ? `/districts/${districtId}/backfill`
    : '/districts/backfill'
}

/**
 * Constructs the appropriate endpoint URL for a specific backfill operation
 */
function getBackfillStatusEndpoint(
  backfillId: string,
  districtId?: string
): string {
  return districtId
    ? `/districts/${districtId}/backfill/${backfillId}`
    : `/districts/backfill/${backfillId}`
}

/**
 * Hook to initiate a backfill
 * @param districtId - Optional district ID for district-specific backfills
 */
export function useInitiateBackfill(districtId?: string) {
  const endpoint = getBackfillEndpoint(districtId)

  return useMutation({
    mutationFn: async (request: BackfillRequest) => {
      const response = await apiClient.post<BackfillResponse>(endpoint, request)
      return response.data
    },
  })
}

/**
 * Hook to poll backfill status
 * Automatically polls every 2 seconds while backfill is processing
 * @param backfillId - The backfill ID to poll
 * @param enabled - Whether polling is enabled (default: true)
 * @param districtId - Optional district ID for district-specific backfills
 */
export function useBackfillStatus(
  backfillId: string | null,
  enabled: boolean = true,
  districtId?: string
) {
  return useQuery({
    queryKey: districtId
      ? ['districtBackfillStatus', districtId, backfillId]
      : ['backfillStatus', backfillId],
    queryFn: async () => {
      if (!backfillId) {
        throw new Error('No backfill ID provided')
      }
      const endpoint = getBackfillStatusEndpoint(backfillId, districtId)
      const response = await apiClient.get<BackfillResponse>(endpoint)
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
 * @param districtId - Optional district ID for district-specific backfills
 */
export function useCancelBackfill(districtId?: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (backfillId: string) => {
      const endpoint = getBackfillStatusEndpoint(backfillId, districtId)
      await apiClient.delete(endpoint)
    },
    onSuccess: (_data, backfillId) => {
      // Invalidate the status query to stop polling
      if (districtId) {
        queryClient.invalidateQueries({
          queryKey: ['districtBackfillStatus', districtId, backfillId],
        })
        // Invalidate district-specific cached dates
        queryClient.invalidateQueries({
          queryKey: ['district-cached-dates', districtId],
        })
      } else {
        queryClient.invalidateQueries({
          queryKey: ['backfillStatus', backfillId],
        })
        // Invalidate global cached dates
        queryClient.invalidateQueries({ queryKey: ['cached-dates'] })
      }
    },
  })
}

// ============================================================================
// Convenience hooks for backward compatibility with useDistrictBackfill
// ============================================================================

/**
 * Hook to initiate a district-specific backfill
 * @deprecated Use useInitiateBackfill(districtId) instead
 */
export function useInitiateDistrictBackfill(districtId: string) {
  return useInitiateBackfill(districtId)
}

/**
 * Hook to poll district-specific backfill status
 * @deprecated Use useBackfillStatus(backfillId, enabled, districtId) instead
 */
export function useDistrictBackfillStatus(
  districtId: string,
  backfillId: string | null,
  enabled: boolean = true
) {
  return useBackfillStatus(backfillId, enabled, districtId)
}

/**
 * Hook to cancel a district-specific backfill
 * @deprecated Use useCancelBackfill(districtId) instead
 */
export function useCancelDistrictBackfill(districtId: string) {
  return useCancelBackfill(districtId)
}

// ============================================================================
// Unified hook interface (as specified in design document)
// ============================================================================

interface UseBackfillResult {
  initiateBackfill: ReturnType<typeof useInitiateBackfill>
  backfillStatus: ReturnType<typeof useBackfillStatus>
  cancelBackfill: ReturnType<typeof useCancelBackfill>
}

/**
 * Unified hook for backfill operations
 * Provides a single interface that handles both global and district-specific backfills
 *
 * @param options - Optional configuration including districtId
 * @param backfillId - The backfill ID to track (for status polling)
 * @param enabled - Whether status polling is enabled
 *
 * @example
 * // Global backfill
 * const { initiateBackfill, backfillStatus, cancelBackfill } = useBackfill()
 *
 * @example
 * // District-specific backfill
 * const { initiateBackfill, backfillStatus, cancelBackfill } = useBackfill(
 *   { districtId: '42' },
 *   backfillId,
 *   true
 * )
 */
export function useBackfill(
  options?: BackfillOptions,
  backfillId?: string | null,
  enabled: boolean = true
): UseBackfillResult {
  const { districtId } = options ?? {}

  const initiateBackfill = useInitiateBackfill(districtId)
  const backfillStatus = useBackfillStatus(
    backfillId ?? null,
    enabled,
    districtId
  )
  const cancelBackfill = useCancelBackfill(districtId)

  return {
    initiateBackfill,
    backfillStatus,
    cancelBackfill,
  }
}
