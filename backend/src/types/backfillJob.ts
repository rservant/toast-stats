/**
 * Backfill Job API Request/Response Types
 *
 * This module defines the API request and response types for the Unified Backfill Service.
 * These types are used by the API routes and frontend hooks to ensure type-safe
 * communication between the frontend and backend.
 *
 * Requirements: 9.2, 9.3, 9.5, 11.2, 11.3
 */

import type {
  BackfillJobType,
  BackfillJobStatus,
  JobConfig,
  JobProgress,
  JobCheckpoint,
  JobResult,
  RateLimitConfig,
  BackfillJob,
} from './storageInterfaces.js'

// ============================================================================
// API Request Types
// ============================================================================

/**
 * Request body for creating a new backfill job
 *
 * Used by POST /api/admin/backfill endpoint to create a new backfill job.
 * The jobType is required; all other fields are optional with sensible defaults.
 *
 * Requirements: 9.2
 */
export interface CreateJobRequest {
  /**
   * Type of backfill operation to perform
   * - 'data-collection': Fetch historical dashboard data for date range
   * - 'analytics-generation': Generate pre-computed analytics for snapshots
   */
  jobType: BackfillJobType

  /**
   * Start date for the backfill operation (ISO format: YYYY-MM-DD)
   * For data-collection: Required - start of date range to fetch
   * For analytics-generation: Optional - filter snapshots by date
   */
  startDate?: string

  /**
   * End date for the backfill operation (ISO format: YYYY-MM-DD)
   * For data-collection: Required - end of date range to fetch
   * For analytics-generation: Optional - filter snapshots by date
   */
  endDate?: string

  /**
   * Target districts for data-collection jobs
   * If not specified, all configured districts are processed
   */
  targetDistricts?: string[]

  /**
   * Skip existing data during data-collection
   * When true, dates with existing snapshots are skipped
   * Defaults to true if not specified
   */
  skipExisting?: boolean

  /**
   * Rate limiting overrides for this specific job
   * Merged with global rate limit configuration
   */
  rateLimitOverrides?: Partial<RateLimitConfig>
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Response metadata included in all API responses
 *
 * Provides traceability and timing information for debugging and logging.
 */
export interface ResponseMetadata {
  /** Unique identifier for this API operation (for tracing) */
  operationId: string

  /** ISO timestamp when the response was generated */
  createdAt?: string

  /** ISO timestamp when the data was retrieved */
  retrievedAt?: string
}

/**
 * Response body for job creation
 *
 * Returned by POST /api/admin/backfill endpoint after successfully
 * creating a new backfill job.
 *
 * Requirements: 9.2
 */
export interface CreateJobResponse {
  /** Unique identifier for the created job */
  jobId: string

  /** Initial status of the job (typically 'pending' or 'running') */
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
 *
 * Returned by GET /api/admin/backfill/:jobId endpoint with complete
 * job information including progress and checkpoint data.
 *
 * Requirements: 9.3
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
 *
 * Returned by GET /api/admin/backfill/jobs endpoint with paginated
 * job history and total count for pagination UI.
 *
 * Requirements: 9.5
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

// ============================================================================
// Dry Run / Preview Types
// ============================================================================

/**
 * Item breakdown for job preview
 *
 * Provides detailed breakdown of items that would be processed,
 * specific to the job type.
 */
export interface ItemBreakdown {
  /**
   * Dates to be processed (for data-collection jobs)
   * Array of ISO date strings (YYYY-MM-DD)
   */
  dates?: string[]

  /**
   * Snapshot IDs to be processed (for analytics-generation jobs)
   * Array of snapshot identifiers
   */
  snapshotIds?: string[]
}

/**
 * Job preview response for dry run
 *
 * Returned by POST /api/admin/backfill/preview endpoint to show
 * what would be processed without actually executing the backfill.
 * Allows operators to verify configuration before large operations.
 *
 * Requirements: 11.2, 11.3
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
 *
 * Wraps the JobPreview with standard response metadata.
 *
 * Requirements: 11.2
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

// ============================================================================
// Error Response Types
// ============================================================================

/**
 * Error detail structure for API error responses
 *
 * Provides structured error information for client-side handling.
 */
export interface ErrorDetail {
  /** Machine-readable error code */
  code: string

  /** Human-readable error message */
  message: string

  /** Additional error details (optional) */
  details?: string

  /** Whether the operation can be retried */
  retryable?: boolean
}

/**
 * Standard error response structure
 *
 * Used for all API error responses to provide consistent error handling.
 */
export interface ErrorResponse {
  /** Error information */
  error: ErrorDetail

  /** Response metadata for tracing */
  metadata: {
    /** Unique identifier for this API operation */
    operationId: string

    /** ISO timestamp when the error occurred */
    timestamp: string
  }
}

/**
 * Error codes for backfill API operations
 *
 * Machine-readable error codes for client-side error handling.
 */
export const BACKFILL_ERROR_CODES = {
  /** Job with specified ID was not found */
  JOB_NOT_FOUND: 'JOB_NOT_FOUND',

  /** A job is already running; only one job at a time is allowed */
  JOB_ALREADY_RUNNING: 'JOB_ALREADY_RUNNING',

  /** Invalid date range (start > end or end >= today) */
  INVALID_DATE_RANGE: 'INVALID_DATE_RANGE',

  /** Invalid job type specified */
  INVALID_JOB_TYPE: 'INVALID_JOB_TYPE',

  /** Job cancellation failed */
  CANCELLATION_FAILED: 'CANCELLATION_FAILED',

  /** Storage operation failed */
  STORAGE_ERROR: 'STORAGE_ERROR',

  /** Request validation failed */
  VALIDATION_ERROR: 'VALIDATION_ERROR',

  /** Force-cancel requires explicit confirmation (force=true) */
  FORCE_REQUIRED: 'FORCE_REQUIRED',

  /** Job is already in a terminal state and cannot be force-cancelled */
  INVALID_JOB_STATE: 'INVALID_JOB_STATE',
} as const

/**
 * Type for backfill error codes
 */
export type BackfillErrorCode =
  (typeof BACKFILL_ERROR_CODES)[keyof typeof BACKFILL_ERROR_CODES]

// ============================================================================
// Re-exports for convenience
// ============================================================================

// Note: BackfillJob is NOT re-exported here to avoid conflict with the legacy
// BackfillJob interface in districts.ts. Import BackfillJob directly from
// './storageInterfaces.js' when needed for the unified backfill service.

// Re-export types from storageInterfaces that are commonly used with API types
// and don't conflict with existing exports
export type {
  BackfillJobType,
  BackfillJobStatus,
  JobConfig,
  JobProgress,
  JobCheckpoint,
  JobResult,
  RateLimitConfig,
  DistrictProgress,
  JobError,
  ListJobsOptions,
} from './storageInterfaces.js'
