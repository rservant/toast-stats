/**
 * useUnifiedBackfill Hooks
 *
 * Provides functionality for managing unified backfill operations:
 * - Create new backfill jobs (data-collection or analytics-generation)
 * - Poll for job status and progress
 * - Cancel running jobs
 * - List job history with filtering
 * - Preview jobs (dry run)
 * - Manage rate limit configuration
 *
 * Requirements: 5.2, 6.1, 8.4, 11.4, 12.1
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../services/api'

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Backfill job type
 * - 'data-collection': Fetches historical Toastmasters dashboard data
 * - 'analytics-generation': Generates pre-computed analytics for snapshots
 */
export type BackfillJobType = 'data-collection' | 'analytics-generation'

/**
 * Backfill job status
 */
export type BackfillJobStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'recovering'

/**
 * Rate limit configuration for backfill operations
 */
export interface RateLimitConfig {
  /** Maximum requests per minute */
  maxRequestsPerMinute: number
  /** Maximum concurrent requests */
  maxConcurrent: number
  /** Minimum delay between requests in milliseconds */
  minDelayMs: number
  /** Maximum delay between requests in milliseconds (for backoff) */
  maxDelayMs: number
  /** Multiplier for exponential backoff */
  backoffMultiplier: number
}

/**
 * Job configuration
 */
export interface JobConfig {
  /** Start date for the backfill operation (ISO format: YYYY-MM-DD) */
  startDate?: string
  /** End date for the backfill operation (ISO format: YYYY-MM-DD) */
  endDate?: string
  /** Target districts for data-collection jobs */
  targetDistricts?: string[]
  /** Skip existing data during data-collection */
  skipExisting?: boolean
  /** Rate limiting overrides for this specific job */
  rateLimitOverrides?: Partial<RateLimitConfig>
}

/**
 * District progress tracking
 */
export interface DistrictProgress {
  /** The district identifier */
  districtId: string
  /** Current processing status for this district */
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped'
  /** Number of items processed for this district */
  itemsProcessed: number
  /** Total number of items to process for this district */
  itemsTotal: number
  /** Last error message if status is 'failed' */
  lastError: string | null
}

/**
 * Job error record
 */
export interface JobError {
  /** Identifier of the item that caused the error */
  itemId: string
  /** Human-readable error message */
  message: string
  /** ISO timestamp when the error occurred */
  occurredAt: string
  /** Whether the operation can be retried */
  isRetryable: boolean
}

/**
 * Job progress tracking
 */
export interface JobProgress {
  /** Total number of items to process */
  totalItems: number
  /** Number of items successfully processed */
  processedItems: number
  /** Number of items that failed processing */
  failedItems: number
  /** Number of items skipped (e.g., already exist) */
  skippedItems: number
  /** Identifier of the item currently being processed */
  currentItem: string | null
  /** Per-district progress breakdown */
  districtProgress: Record<string, DistrictProgress>
  /** List of errors encountered during processing */
  errors: JobError[]
}

/**
 * Job checkpoint for recovery
 */
export interface JobCheckpoint {
  /** Identifier of the last successfully processed item */
  lastProcessedItem: string
  /** ISO timestamp of the last checkpoint update */
  lastProcessedAt: string
  /** List of completed item IDs for skip-on-resume */
  itemsCompleted: string[]
}

/**
 * Job result summary
 */
export interface JobResult {
  /** Number of items successfully processed */
  itemsProcessed: number
  /** Number of items that failed processing */
  itemsFailed: number
  /** Number of items skipped */
  itemsSkipped: number
  /** Snapshot IDs created (for data-collection jobs) */
  snapshotIds: string[]
  /** Total job duration in milliseconds */
  duration: number
}

/**
 * Complete backfill job representation
 */
export interface BackfillJob {
  /** Unique job identifier */
  jobId: string
  /** Type of backfill operation */
  jobType: BackfillJobType
  /** Current job status */
  status: BackfillJobStatus
  /** Job configuration */
  config: JobConfig
  /** Progress tracking information */
  progress: JobProgress
  /** Checkpoint for recovery (null if no checkpoint saved) */
  checkpoint: JobCheckpoint | null
  /** ISO timestamp when the job was created */
  createdAt: string
  /** ISO timestamp when the job started processing (null if pending) */
  startedAt: string | null
  /** ISO timestamp when the job completed (null if not completed) */
  completedAt: string | null
  /** ISO timestamp when the job was resumed after restart (null if not recovered) */
  resumedAt: string | null
  /** Job result summary (null if not completed) */
  result: JobResult | null
  /** Error message if job failed (null otherwise) */
  error: string | null
}

// ============================================================================
// API Request Types
// ============================================================================

/**
 * Request body for creating a new backfill job
 */
export interface CreateJobRequest {
  /** Type of backfill operation to perform */
  jobType: BackfillJobType
  /** Start date for the backfill operation (ISO format: YYYY-MM-DD) */
  startDate?: string
  /** End date for the backfill operation (ISO format: YYYY-MM-DD) */
  endDate?: string
  /** Target districts for data-collection jobs */
  targetDistricts?: string[]
  /** Skip existing data during data-collection */
  skipExisting?: boolean
  /** Rate limiting overrides for this specific job */
  rateLimitOverrides?: Partial<RateLimitConfig>
}

/**
 * Options for listing backfill jobs
 */
export interface ListJobsOptions {
  /** Maximum number of jobs to return */
  limit?: number
  /** Number of jobs to skip (for pagination) */
  offset?: number
  /** Filter by job status */
  status?: BackfillJobStatus[]
  /** Filter by job type */
  jobType?: BackfillJobType[]
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Response body for job creation
 */
export interface CreateJobResponse {
  /** Unique identifier for the created job */
  jobId: string
  /** Initial status of the job */
  status: BackfillJobStatus
  /** Human-readable message about the job creation */
  message: string
  /** Response metadata for tracing */
  metadata: {
    /** Unique identifier for this API operation */
    operationId: string
    /** ISO timestamp when the job was created */
    createdAt: string
  }
}

/**
 * Response body for job status queries
 */
export interface JobStatusResponse {
  /** Unique job identifier */
  jobId: string
  /** Type of backfill operation */
  jobType: BackfillJobType
  /** Current job status */
  status: BackfillJobStatus
  /** Job configuration */
  config: JobConfig
  /** Progress tracking information */
  progress: JobProgress
  /** Checkpoint for recovery (null if no checkpoint saved) */
  checkpoint: JobCheckpoint | null
  /** ISO timestamp when the job was created */
  createdAt: string
  /** ISO timestamp when the job started processing (null if pending) */
  startedAt: string | null
  /** ISO timestamp when the job completed (null if not completed) */
  completedAt: string | null
  /** ISO timestamp when the job was resumed after restart (null if not recovered) */
  resumedAt: string | null
  /** Job result summary (null if not completed) */
  result: JobResult | null
  /** Error message if job failed (null otherwise) */
  error: string | null
  /** Response metadata for tracing */
  metadata: {
    /** Unique identifier for this API operation */
    operationId: string
    /** ISO timestamp when the status was retrieved */
    retrievedAt: string
  }
}

/**
 * Response body for listing jobs
 */
export interface ListJobsResponse {
  /** Array of backfill jobs matching the query */
  jobs: BackfillJob[]
  /** Total number of jobs matching the filter (for pagination) */
  total: number
  /** Maximum number of jobs returned per page */
  limit: number
  /** Number of jobs skipped (for pagination offset) */
  offset: number
  /** Response metadata for tracing */
  metadata: {
    /** Unique identifier for this API operation */
    operationId: string
    /** ISO timestamp when the jobs were retrieved */
    retrievedAt: string
  }
}

/**
 * Item breakdown for job preview
 */
export interface ItemBreakdown {
  /** Dates to be processed (for data-collection jobs) */
  dates?: string[]
  /** Snapshot IDs to be processed (for analytics-generation jobs) */
  snapshotIds?: string[]
}

/**
 * Job preview data for dry run
 */
export interface JobPreview {
  /** Type of backfill operation */
  jobType: BackfillJobType
  /** Total number of items that would be processed */
  totalItems: number
  /** Date range for the operation */
  dateRange: {
    /** Start date (ISO format: YYYY-MM-DD) */
    startDate: string
    /** End date (ISO format: YYYY-MM-DD) */
    endDate: string
  }
  /** Districts that would be affected by the operation */
  affectedDistricts: string[]
  /** Estimated duration in milliseconds */
  estimatedDuration: number
  /** Detailed breakdown of items to be processed */
  itemBreakdown: ItemBreakdown
}

/**
 * Response body for job preview/dry run
 */
export interface JobPreviewResponse {
  /** Preview data showing what would be processed */
  preview: JobPreview
  /** Response metadata for tracing */
  metadata: {
    /** Unique identifier for this API operation */
    operationId: string
    /** ISO timestamp when the preview was generated */
    generatedAt: string
  }
}

/**
 * Response body for cancel job
 */
export interface CancelJobResponse {
  /** Job identifier */
  jobId: string
  /** Whether cancellation was successful */
  cancelled: boolean
  /** Previous status before cancellation */
  previousStatus: BackfillJobStatus
  /** Message describing the result */
  message: string
  /** Response metadata for tracing */
  metadata: {
    /** Unique identifier for this API operation */
    operationId: string
    /** ISO timestamp when the job was cancelled */
    cancelledAt: string
  }
}

/**
 * Response body for force-cancel job
 *
 * Returned when a stuck job is successfully force-cancelled via the
 * POST /admin/unified-backfill/{jobId}/force-cancel endpoint.
 *
 * Requirements: 6.1
 */
export interface ForceCancelResponse {
  /** Job identifier that was force-cancelled */
  jobId: string
  /** Status of the job before force-cancellation */
  previousStatus: BackfillJobStatus
  /** New status after force-cancellation (always 'cancelled') */
  newStatus: 'cancelled'
  /** Human-readable message about the force-cancellation */
  message: string
  /** Response metadata for tracing */
  metadata: {
    /** Unique identifier for this API operation */
    operationId: string
    /** ISO timestamp when the job was force-cancelled */
    cancelledAt: string
    /** Indicates this was a force-cancel operation (always true) */
    forceCancelled: true
  }
}

/**
 * Error response body for force-cancel job failures
 *
 * Returned when a force-cancel request fails due to validation errors,
 * missing job, or storage errors.
 *
 * Requirements: 6.1
 */
export interface ForceCancelErrorResponse {
  /** Error details */
  error: {
    /** Error code (e.g., 'FORCE_REQUIRED', 'JOB_NOT_FOUND', 'INVALID_JOB_STATE', 'STORAGE_ERROR') */
    code: string
    /** Human-readable error message */
    message: string
    /** Additional error details (optional) */
    details?: string
    /** Whether the operation can be retried (optional) */
    retryable?: boolean
  }
  /** Response metadata for tracing */
  metadata: {
    /** Unique identifier for this API operation */
    operationId: string
    /** ISO timestamp when the error occurred */
    timestamp: string
  }
}

// ============================================================================
// Query Keys
// ============================================================================

const UNIFIED_BACKFILL_QUERY_KEYS = {
  all: ['unified-backfill'] as const,
  jobs: () => [...UNIFIED_BACKFILL_QUERY_KEYS.all, 'jobs'] as const,
  jobsList: (options?: ListJobsOptions) =>
    [...UNIFIED_BACKFILL_QUERY_KEYS.jobs(), options] as const,
  jobStatus: (jobId: string | null) =>
    [...UNIFIED_BACKFILL_QUERY_KEYS.all, 'status', jobId] as const,
  rateLimitConfig: () =>
    [...UNIFIED_BACKFILL_QUERY_KEYS.all, 'rate-limit-config'] as const,
}

// ============================================================================
// Individual Hooks
// ============================================================================

/**
 * Hook to create a new backfill job
 *
 * @example
 * const createJob = useCreateJob()
 * await createJob.mutateAsync({
 *   jobType: 'data-collection',
 *   startDate: '2024-01-01',
 *   endDate: '2024-01-31'
 * })
 */
export function useCreateJob() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (request: CreateJobRequest) => {
      const response = await apiClient.post<CreateJobResponse>(
        '/admin/unified-backfill',
        request
      )
      return response.data
    },
    onSuccess: () => {
      // Invalidate job list and status queries
      queryClient.invalidateQueries({
        queryKey: UNIFIED_BACKFILL_QUERY_KEYS.all,
      })
    },
  })
}

/**
 * Options for useJobStatus hook
 */
export interface UseJobStatusOptions {
  /** Polling interval in milliseconds (default: 2000) */
  pollingInterval?: number
  /** Whether the query is enabled (default: true) */
  enabled?: boolean
}

/**
 * Hook to get job status with optional polling
 *
 * Automatically polls while the job is running or pending.
 * Stops polling when the job completes, fails, or is cancelled.
 *
 * @param jobId - The backfill job ID to track (null to disable)
 * @param options - Optional configuration for polling
 *
 * @example
 * const { data, isLoading, error } = useJobStatus('job_123', { pollingInterval: 3000 })
 */
export function useJobStatus(
  jobId: string | null,
  options: UseJobStatusOptions = {}
) {
  const { pollingInterval = 2000, enabled = true } = options

  return useQuery({
    queryKey: UNIFIED_BACKFILL_QUERY_KEYS.jobStatus(jobId),
    queryFn: async () => {
      if (!jobId) {
        throw new Error('No job ID provided')
      }
      const response = await apiClient.get<JobStatusResponse>(
        `/admin/unified-backfill/${jobId}`
      )
      return response.data
    },
    enabled: enabled && !!jobId,
    refetchInterval: query => {
      const data = query.state.data
      // Stop polling if job is in a terminal state
      if (
        data?.status === 'completed' ||
        data?.status === 'failed' ||
        data?.status === 'cancelled'
      ) {
        return false
      }
      // Poll at the specified interval while pending, running, or recovering
      return pollingInterval
    },
    refetchIntervalInBackground: true,
    staleTime: 0, // Always consider data stale to ensure fresh polling
  })
}

/**
 * Hook to cancel a running backfill job
 *
 * @example
 * const cancelJob = useCancelJob()
 * await cancelJob.mutateAsync('job_123')
 */
export function useCancelJob() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (jobId: string) => {
      const response = await apiClient.delete<CancelJobResponse>(
        `/admin/unified-backfill/${jobId}`
      )
      return response.data
    },
    onSuccess: (_data, jobId) => {
      // Invalidate the specific job status query
      queryClient.invalidateQueries({
        queryKey: UNIFIED_BACKFILL_QUERY_KEYS.jobStatus(jobId),
      })
      // Invalidate the jobs list
      queryClient.invalidateQueries({
        queryKey: UNIFIED_BACKFILL_QUERY_KEYS.jobs(),
      })
    },
  })
}

/**
 * Hook to force-cancel a stuck backfill job
 *
 * Force-cancels a job that is stuck in 'running' or 'recovering' state.
 * This is a destructive operation that marks the job as cancelled and clears
 * its checkpoint to prevent automatic recovery.
 *
 * Requirements: 6.1, 6.2, 6.3
 *
 * @example
 * const forceCancelJob = useForceCancelJob()
 * await forceCancelJob.mutateAsync({ jobId: 'job_123', force: true })
 */
export function useForceCancelJob() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ jobId, force }: { jobId: string; force: boolean }) => {
      const response = await apiClient.post<ForceCancelResponse>(
        `/admin/unified-backfill/${jobId}/force-cancel`,
        undefined,
        {
          params: { force },
        }
      )
      return response.data
    },
    onSuccess: (_data, { jobId }) => {
      // Invalidate the specific job status query
      queryClient.invalidateQueries({
        queryKey: UNIFIED_BACKFILL_QUERY_KEYS.jobStatus(jobId),
      })
      // Invalidate the jobs list
      queryClient.invalidateQueries({
        queryKey: UNIFIED_BACKFILL_QUERY_KEYS.jobs(),
      })
    },
  })
}

/**
 * Hook to list backfill jobs with optional filtering
 *
 * @param options - Optional filtering and pagination options
 * @param enabled - Whether the query is enabled (default: true)
 *
 * @example
 * const { data, isLoading } = useListJobs({ limit: 10, status: ['completed', 'failed'] })
 */
export function useListJobs(
  options?: ListJobsOptions,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: UNIFIED_BACKFILL_QUERY_KEYS.jobsList(options),
    queryFn: async () => {
      const params = new URLSearchParams()

      if (options?.limit !== undefined) {
        params.append('limit', options.limit.toString())
      }
      if (options?.offset !== undefined) {
        params.append('offset', options.offset.toString())
      }
      if (options?.status && options.status.length > 0) {
        // Send status as comma-separated values
        params.append('status', options.status.join(','))
      }
      if (options?.jobType && options.jobType.length > 0) {
        // Send jobType as comma-separated values
        params.append('jobType', options.jobType.join(','))
      }

      const queryString = params.toString()
      const url = queryString
        ? `/admin/unified-backfill/jobs?${queryString}`
        : '/admin/unified-backfill/jobs'

      const response = await apiClient.get<ListJobsResponse>(url)
      return response.data
    },
    enabled,
    staleTime: 30000, // Consider data stale after 30 seconds
  })
}

/**
 * Hook to preview a job (dry run)
 *
 * Returns what would be processed without actually executing the backfill.
 *
 * @example
 * const previewJob = usePreviewJob()
 * const preview = await previewJob.mutateAsync({
 *   jobType: 'data-collection',
 *   startDate: '2024-01-01',
 *   endDate: '2024-01-31'
 * })
 */
export function usePreviewJob() {
  return useMutation({
    mutationFn: async (request: CreateJobRequest) => {
      const response = await apiClient.post<JobPreviewResponse>(
        '/admin/unified-backfill/preview',
        request
      )
      return response.data
    },
  })
}

/**
 * Hook to get rate limit configuration
 *
 * @param enabled - Whether the query is enabled (default: true)
 *
 * @example
 * const { data: config, isLoading } = useRateLimitConfig()
 */
export function useRateLimitConfig(enabled: boolean = true) {
  return useQuery({
    queryKey: UNIFIED_BACKFILL_QUERY_KEYS.rateLimitConfig(),
    queryFn: async () => {
      const response = await apiClient.get<RateLimitConfig>(
        '/admin/unified-backfill/config/rate-limit'
      )
      return response.data
    },
    enabled,
    staleTime: 60000, // Consider data stale after 1 minute
  })
}

/**
 * Hook to update rate limit configuration
 *
 * @example
 * const updateConfig = useUpdateRateLimitConfig()
 * await updateConfig.mutateAsync({ maxRequestsPerMinute: 20 })
 */
export function useUpdateRateLimitConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (config: Partial<RateLimitConfig>) => {
      const response = await apiClient.put<RateLimitConfig>(
        '/admin/unified-backfill/config/rate-limit',
        config
      )
      return response.data
    },
    onSuccess: () => {
      // Invalidate the rate limit config query
      queryClient.invalidateQueries({
        queryKey: UNIFIED_BACKFILL_QUERY_KEYS.rateLimitConfig(),
      })
    },
  })
}

// ============================================================================
// Unified Hook
// ============================================================================

/**
 * Result type for the unified useUnifiedBackfill hook
 */
export interface UseUnifiedBackfillResult {
  /** Mutation to create a new backfill job */
  createJob: ReturnType<typeof useCreateJob>
  /** Query for current job status (if jobId is provided) */
  jobStatus: ReturnType<typeof useJobStatus>
  /** Mutation to cancel a running job */
  cancelJob: ReturnType<typeof useCancelJob>
  /** Query for job history list */
  jobsList: ReturnType<typeof useListJobs>
  /** Mutation to preview a job (dry run) */
  previewJob: ReturnType<typeof usePreviewJob>
  /** Query for rate limit configuration */
  rateLimitConfig: ReturnType<typeof useRateLimitConfig>
  /** Mutation to update rate limit configuration */
  updateRateLimitConfig: ReturnType<typeof useUpdateRateLimitConfig>
  /** Whether a job is currently in progress */
  isJobRunning: boolean
  /** Whether the current job has completed (successfully or with errors) */
  isJobComplete: boolean
  /** Current job status */
  currentJobStatus: BackfillJobStatus | null
  /** Percentage complete for the current job (0-100) */
  percentComplete: number
}

/**
 * Options for the unified useUnifiedBackfill hook
 */
export interface UseUnifiedBackfillOptions {
  /** Job ID to track status for */
  jobId?: string | null
  /** Whether job status polling is enabled */
  statusEnabled?: boolean
  /** Polling interval for job status in milliseconds */
  pollingInterval?: number
  /** Options for listing jobs */
  listJobsOptions?: ListJobsOptions
  /** Whether job list query is enabled */
  listJobsEnabled?: boolean
  /** Whether rate limit config query is enabled */
  rateLimitConfigEnabled?: boolean
}

/**
 * Unified hook for all unified backfill operations
 *
 * Provides a single interface for creating, monitoring, and managing
 * backfill operations from the admin panel.
 *
 * @param options - Configuration options for the hook
 *
 * @example
 * const {
 *   createJob,
 *   jobStatus,
 *   cancelJob,
 *   jobsList,
 *   previewJob,
 *   rateLimitConfig,
 *   updateRateLimitConfig,
 *   isJobRunning,
 *   percentComplete
 * } = useUnifiedBackfill({ jobId: currentJobId })
 *
 * // Create a new job
 * const result = await createJob.mutateAsync({
 *   jobType: 'data-collection',
 *   startDate: '2024-01-01',
 *   endDate: '2024-01-31'
 * })
 * setCurrentJobId(result.jobId)
 *
 * // Cancel if needed
 * await cancelJob.mutateAsync(currentJobId)
 *
 * Requirements: 5.2, 6.1, 8.4, 11.4, 12.1
 */
export function useUnifiedBackfill(
  options: UseUnifiedBackfillOptions = {}
): UseUnifiedBackfillResult {
  const {
    jobId = null,
    statusEnabled = true,
    pollingInterval = 2000,
    listJobsOptions,
    listJobsEnabled = true,
    rateLimitConfigEnabled = true,
  } = options

  const createJob = useCreateJob()
  const jobStatus = useJobStatus(jobId, {
    pollingInterval,
    enabled: statusEnabled,
  })
  const cancelJob = useCancelJob()
  const jobsList = useListJobs(listJobsOptions, listJobsEnabled)
  const previewJob = usePreviewJob()
  const rateLimitConfig = useRateLimitConfig(rateLimitConfigEnabled)
  const updateRateLimitConfig = useUpdateRateLimitConfig()

  const currentJobStatus = jobStatus.data?.status ?? null

  const isJobRunning =
    currentJobStatus === 'pending' ||
    currentJobStatus === 'running' ||
    currentJobStatus === 'recovering'

  const isJobComplete =
    currentJobStatus === 'completed' ||
    currentJobStatus === 'failed' ||
    currentJobStatus === 'cancelled'

  // Calculate percentage complete
  const progress = jobStatus.data?.progress
  const percentComplete =
    progress && progress.totalItems > 0
      ? Math.round((progress.processedItems / progress.totalItems) * 100)
      : 0

  return {
    createJob,
    jobStatus,
    cancelJob,
    jobsList,
    previewJob,
    rateLimitConfig,
    updateRateLimitConfig,
    isJobRunning,
    isJobComplete,
    currentJobStatus,
    percentComplete,
  }
}
