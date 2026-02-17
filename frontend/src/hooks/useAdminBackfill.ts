/**
 * useAdminBackfill Hook
 *
 * Provides functionality for managing admin backfill operations:
 * - Trigger backfill via POST /api/admin/backfill
 * - Poll for progress via GET /api/admin/backfill/:jobId
 * - Cancel backfill via DELETE /api/admin/backfill/:jobId
 *
 * Requirements: 10.4, 10.6
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../services/api'

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Status of a backfill job
 */
export type BackfillJobStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'

/**
 * Backfill job configuration options
 */
export interface BackfillJobOptions {
  /** Start date for backfill (inclusive, YYYY-MM-DD format) */
  startDate?: string
  /** End date for backfill (inclusive, YYYY-MM-DD format) */
  endDate?: string
  /** Specific district IDs to backfill (if not provided, all districts are processed) */
  districtIds?: string[]
}

/**
 * Error information for a failed snapshot during backfill
 */
export interface BackfillError {
  /** Snapshot ID that failed */
  snapshotId: string
  /** Error message */
  message: string
  /** ISO timestamp when the error occurred */
  occurredAt: string
}

/**
 * Progress information for a backfill job
 */
export interface BackfillProgress {
  /** Current status of the job */
  status: BackfillJobStatus
  /** Total number of snapshots to process */
  totalSnapshots: number
  /** Number of snapshots processed so far */
  processedSnapshots: number
  /** Percentage complete (0-100) */
  percentComplete: number
  /** ID of the snapshot currently being processed */
  currentSnapshot?: string
  /** ISO timestamp when the job started */
  startedAt?: string
  /** ISO timestamp when the job completed (or failed/cancelled) */
  completedAt?: string
  /** Estimated time remaining in seconds */
  estimatedTimeRemaining?: number
  /** List of errors encountered during processing */
  errors: BackfillError[]
}

/**
 * Response for POST /api/admin/backfill
 */
export interface BackfillTriggerResponse {
  /** Unique job identifier for tracking */
  jobId: string
  /** Initial job status */
  status: BackfillJobStatus
  /** Message describing the job */
  message: string
  /** Metadata about the operation */
  metadata: {
    operationId: string
    createdAt: string
  }
}

/**
 * Response for GET /api/admin/backfill/:jobId
 */
export interface BackfillProgressResponse {
  /** Job identifier */
  jobId: string
  /** Job configuration options */
  options: BackfillJobOptions
  /** Current progress information */
  progress: BackfillProgress
  /** Metadata about the operation */
  metadata: {
    operationId: string
    retrievedAt: string
  }
}

/**
 * Response for DELETE /api/admin/backfill/:jobId
 */
export interface BackfillCancelResponse {
  /** Job identifier */
  jobId: string
  /** Whether cancellation was successful */
  cancelled: boolean
  /** Previous status before cancellation */
  previousStatus: BackfillJobStatus
  /** Message describing the result */
  message: string
  /** Metadata about the operation */
  metadata: {
    operationId: string
    cancelledAt: string
  }
}

// ============================================================================
// Individual Hooks
// ============================================================================

/**
 * Hook to trigger a backfill operation
 *
 * @example
 * const triggerBackfill = useTriggerBackfill()
 * await triggerBackfill.mutateAsync({ startDate: '2024-01-01' })
 */
export function useTriggerBackfill() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (options: BackfillJobOptions = {}) => {
      const response = await apiClient.post<BackfillTriggerResponse>(
        '/admin/backfill',
        options
      )
      return response.data
    },
    onSuccess: () => {
      // Invalidate any cached backfill status queries
      queryClient.invalidateQueries({ queryKey: ['admin-backfill'] })
    },
  })
}

/**
 * Hook to poll backfill job progress
 *
 * Automatically polls every 2 seconds while the job is running or pending.
 * Stops polling when the job completes, fails, or is cancelled.
 *
 * @param jobId - The backfill job ID to track
 * @param enabled - Whether polling is enabled (default: true)
 *
 * @example
 * const { data, isLoading, error } = useBackfillProgress('backfill_123', true)
 */
export function useBackfillProgress(
  jobId: string | null,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['admin-backfill', 'progress', jobId],
    queryFn: async () => {
      if (!jobId) {
        throw new Error('No job ID provided')
      }
      const response = await apiClient.get<BackfillProgressResponse>(
        `/admin/backfill/${jobId}`
      )
      return response.data
    },
    enabled: enabled && !!jobId,
    refetchInterval: query => {
      const data = query.state.data
      // Stop polling if backfill is complete, failed, or cancelled
      if (
        data?.progress.status === 'completed' ||
        data?.progress.status === 'failed' ||
        data?.progress.status === 'cancelled'
      ) {
        return false
      }
      // Poll every 2 seconds while pending or running
      return 2000
    },
    refetchIntervalInBackground: true,
    staleTime: 0, // Always consider data stale to ensure fresh polling
  })
}

/**
 * Hook to cancel a running backfill job
 *
 * @example
 * const cancelBackfill = useCancelBackfill()
 * await cancelBackfill.mutateAsync('backfill_123')
 */
export function useCancelBackfill() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (jobId: string) => {
      const response = await apiClient.delete<BackfillCancelResponse>(
        `/admin/backfill/${jobId}`
      )
      return response.data
    },
    onSuccess: (_data, jobId) => {
      // Invalidate the progress query to update UI
      queryClient.invalidateQueries({
        queryKey: ['admin-backfill', 'progress', jobId],
      })
    },
  })
}

// ============================================================================
// Unified Hook
// ============================================================================

/**
 * Result type for the unified useAdminBackfill hook
 */
export interface UseAdminBackfillResult {
  /** Mutation to trigger a new backfill job */
  triggerBackfill: ReturnType<typeof useTriggerBackfill>
  /** Query for current backfill progress (if jobId is provided) */
  progress: ReturnType<typeof useBackfillProgress>
  /** Mutation to cancel a running backfill job */
  cancelBackfill: ReturnType<typeof useCancelBackfill>
  /** Whether a backfill is currently in progress */
  isBackfillRunning: boolean
  /** Whether the backfill has completed (successfully or with errors) */
  isBackfillComplete: boolean
  /** Current backfill status */
  backfillStatus: BackfillJobStatus | null
}

/**
 * Unified hook for admin backfill operations
 *
 * Provides a single interface for triggering, monitoring, and cancelling
 * backfill operations from the admin panel.
 *
 * @param jobId - Optional job ID to track progress for
 * @param enabled - Whether progress polling is enabled (default: true)
 *
 * @example
 * const {
 *   triggerBackfill,
 *   progress,
 *   cancelBackfill,
 *   isBackfillRunning,
 *   backfillStatus
 * } = useAdminBackfill(currentJobId)
 *
 * // Trigger a new backfill
 * const result = await triggerBackfill.mutateAsync({ startDate: '2024-01-01' })
 * setCurrentJobId(result.jobId)
 *
 * // Cancel if needed
 * await cancelBackfill.mutateAsync(currentJobId)
 *
 * Requirements: 10.4, 10.6
 */
export function useAdminBackfill(
  jobId?: string | null,
  enabled: boolean = true
): UseAdminBackfillResult {
  const triggerBackfill = useTriggerBackfill()
  const progress = useBackfillProgress(jobId ?? null, enabled)
  const cancelBackfill = useCancelBackfill()

  const backfillStatus = progress.data?.progress.status ?? null

  const isBackfillRunning =
    backfillStatus === 'pending' || backfillStatus === 'running'

  const isBackfillComplete =
    backfillStatus === 'completed' ||
    backfillStatus === 'failed' ||
    backfillStatus === 'cancelled'

  return {
    triggerBackfill,
    progress,
    cancelBackfill,
    isBackfillRunning,
    isBackfillComplete,
    backfillStatus,
  }
}
