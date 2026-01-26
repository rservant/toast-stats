/**
 * Admin backfill routes for pre-computed analytics
 *
 * Provides endpoints for:
 * - POST /api/admin/backfill - Trigger backfill of pre-computed analytics
 * - GET /api/admin/backfill/:jobId - Get backfill job progress
 * - DELETE /api/admin/backfill/:jobId - Cancel a running backfill job
 *
 * These endpoints enable system operators to generate pre-computed analytics
 * for existing snapshots, improving performance for historical data queries.
 *
 * Requirements: 7.1
 */

import { Router } from 'express'
import { logAdminAccess, generateOperationId } from './shared.js'
import { logger } from '../../utils/logger.js'

export const backfillRouter = Router()

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
 * Complete backfill job information
 */
export interface BackfillJob {
  /** Unique job identifier */
  jobId: string
  /** Job configuration options */
  options: BackfillJobOptions
  /** Job progress information */
  progress: BackfillProgress
  /** ISO timestamp when the job was created */
  createdAt: string
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
// In-Memory Job Store
// ============================================================================

/**
 * In-memory store for backfill jobs
 *
 * Note: In a production system, this would be persisted to a database
 * to survive server restarts. For this implementation, jobs are stored
 * in memory and will be lost on restart.
 */
const backfillJobs = new Map<string, BackfillJob>()

/**
 * Clear all backfill jobs from the store
 * This is primarily used for testing to ensure test isolation
 */
export function clearBackfillJobs(): void {
  backfillJobs.clear()
}

/**
 * Generate a unique job ID
 */
function generateJobId(): string {
  return `backfill_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Get a backfill job by ID
 */
export function getBackfillJob(jobId: string): BackfillJob | undefined {
  return backfillJobs.get(jobId)
}

/**
 * Get the count of pending or running backfill jobs
 * Used by the system health endpoint to report pending operations
 */
export function getPendingBackfillJobCount(): number {
  let count = 0
  for (const job of backfillJobs.values()) {
    if (
      job.progress.status === 'pending' ||
      job.progress.status === 'running'
    ) {
      count++
    }
  }
  return count
}

/**
 * Update a backfill job's progress
 * This function is exported for use by the BackfillService
 */
export function updateBackfillJobProgress(
  jobId: string,
  updates: Partial<BackfillProgress>
): void {
  const job = backfillJobs.get(jobId)
  if (job) {
    job.progress = { ...job.progress, ...updates }
    backfillJobs.set(jobId, job)
  }
}

/**
 * Create a backfill job in the store
 * This function is exported for use by tests and the BackfillService
 */
export function createBackfillJobInStore(
  jobId: string,
  options: BackfillJobOptions = {}
): BackfillJob {
  const now = new Date().toISOString()
  const job: BackfillJob = {
    jobId,
    options,
    progress: {
      status: 'pending',
      totalSnapshots: 0,
      processedSnapshots: 0,
      percentComplete: 0,
      errors: [],
    },
    createdAt: now,
  }
  backfillJobs.set(jobId, job)
  return job
}

/**
 * Mark a backfill job as cancelled
 */
function cancelBackfillJob(jobId: string): BackfillJob | undefined {
  const job = backfillJobs.get(jobId)
  if (job) {
    job.progress.status = 'cancelled'
    job.progress.completedAt = new Date().toISOString()
    backfillJobs.set(jobId, job)
  }
  return job
}

// ============================================================================
// Service Interface
// ============================================================================

/**
 * Interface for the BackfillService
 *
 * This interface defines the contract that the BackfillService (task 9.3)
 * must implement. The routes use this interface to interact with the service.
 */
export interface IBackfillService {
  /**
   * Start a backfill job
   * @param jobId - Unique job identifier
   * @param options - Backfill configuration options
   * @returns Promise that resolves when the job is started (not completed)
   */
  startBackfill(jobId: string, options: BackfillJobOptions): Promise<void>

  /**
   * Cancel a running backfill job
   * @param jobId - Job identifier to cancel
   * @returns true if cancellation was requested, false if job not found or not running
   */
  cancelBackfill(jobId: string): boolean
}

/**
 * Placeholder BackfillService implementation
 *
 * This is a stub implementation that will be replaced by the actual
 * BackfillService in task 9.3. It provides basic functionality for
 * testing the endpoints.
 */
class PlaceholderBackfillService implements IBackfillService {
  async startBackfill(
    jobId: string,
    _options: BackfillJobOptions
  ): Promise<void> {
    // In the real implementation, this would:
    // 1. List all snapshots in the date range
    // 2. Process each snapshot in chronological order
    // 3. Update job progress as it goes
    // 4. Handle errors gracefully

    // For now, just mark the job as running
    const job = backfillJobs.get(jobId)
    if (job) {
      job.progress.status = 'running'
      job.progress.startedAt = new Date().toISOString()
      backfillJobs.set(jobId, job)

      logger.info('Placeholder backfill service started', {
        operation: 'startBackfill',
        jobId,
        message:
          'BackfillService not yet implemented. Job will remain in running state.',
      })
    }
  }

  cancelBackfill(jobId: string): boolean {
    const job = backfillJobs.get(jobId)
    if (!job) {
      return false
    }

    if (
      job.progress.status !== 'running' &&
      job.progress.status !== 'pending'
    ) {
      return false
    }

    cancelBackfillJob(jobId)
    return true
  }
}

// Service instance - will be replaced when BackfillService is implemented
let backfillService: IBackfillService = new PlaceholderBackfillService()

/**
 * Set the backfill service instance
 * Called by the application during initialization to inject the real service
 */
export function setBackfillService(service: IBackfillService): void {
  backfillService = service
}

/**
 * Get the current backfill service instance
 */
export function getBackfillService(): IBackfillService {
  return backfillService
}

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * POST /api/admin/backfill
 * Trigger a backfill of pre-computed analytics for existing snapshots
 *
 * Request Body (all optional):
 * - startDate: string - Start date for backfill (YYYY-MM-DD format)
 * - endDate: string - End date for backfill (YYYY-MM-DD format)
 * - districtIds: string[] - Specific district IDs to backfill
 *
 * Returns a jobId for tracking progress
 *
 * Requirements: 7.1
 */
backfillRouter.post('/', logAdminAccess, async (req, res): Promise<void> => {
  const operationId = generateOperationId('trigger_backfill')

  logger.info('Admin backfill requested', {
    operation: 'triggerBackfill',
    operationId,
    ip: req.ip,
  })

  try {
    // Parse and validate request body
    const body = req.body as {
      startDate?: unknown
      endDate?: unknown
      districtIds?: unknown
    }

    const options: BackfillJobOptions = {}

    // Validate startDate if provided
    if (body.startDate !== undefined) {
      if (typeof body.startDate !== 'string') {
        res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'startDate must be a string in YYYY-MM-DD format',
          },
        })
        return
      }

      const datePattern = /^\d{4}-\d{2}-\d{2}$/
      if (!datePattern.test(body.startDate)) {
        res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'startDate must be in YYYY-MM-DD format',
          },
        })
        return
      }

      options.startDate = body.startDate
    }

    // Validate endDate if provided
    if (body.endDate !== undefined) {
      if (typeof body.endDate !== 'string') {
        res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'endDate must be a string in YYYY-MM-DD format',
          },
        })
        return
      }

      const datePattern = /^\d{4}-\d{2}-\d{2}$/
      if (!datePattern.test(body.endDate)) {
        res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'endDate must be in YYYY-MM-DD format',
          },
        })
        return
      }

      options.endDate = body.endDate
    }

    // Validate date range if both provided
    if (
      options.startDate &&
      options.endDate &&
      options.startDate > options.endDate
    ) {
      res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'startDate must be before or equal to endDate',
        },
      })
      return
    }

    // Validate districtIds if provided
    if (body.districtIds !== undefined) {
      if (!Array.isArray(body.districtIds)) {
        res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'districtIds must be an array of strings',
          },
        })
        return
      }

      const invalidIds = body.districtIds.filter(id => typeof id !== 'string')
      if (invalidIds.length > 0) {
        res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'All districtIds must be strings',
          },
        })
        return
      }

      // Validate district ID format (alphanumeric only)
      const districtIdPattern = /^[A-Za-z0-9]+$/
      const invalidFormat = (body.districtIds as string[]).filter(
        id => !districtIdPattern.test(id)
      )
      if (invalidFormat.length > 0) {
        res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: `Invalid district ID format: ${invalidFormat.join(', ')}. District IDs must be alphanumeric.`,
          },
        })
        return
      }

      options.districtIds = body.districtIds as string[]
    }

    // Create the job
    const jobId = generateJobId()
    const now = new Date().toISOString()

    const job: BackfillJob = {
      jobId,
      options,
      progress: {
        status: 'pending',
        totalSnapshots: 0,
        processedSnapshots: 0,
        percentComplete: 0,
        errors: [],
      },
      createdAt: now,
    }

    backfillJobs.set(jobId, job)

    logger.info('Backfill job created', {
      operation: 'triggerBackfill',
      operationId,
      jobId,
      options,
    })

    // Start the backfill in the background (don't await)
    backfillService.startBackfill(jobId, options).catch(error => {
      logger.error('Backfill job failed to start', {
        operation: 'triggerBackfill',
        operationId,
        jobId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      const failedJob = backfillJobs.get(jobId)
      if (failedJob) {
        failedJob.progress.status = 'failed'
        failedJob.progress.completedAt = new Date().toISOString()
        failedJob.progress.errors.push({
          snapshotId: 'N/A',
          message: error instanceof Error ? error.message : 'Unknown error',
          occurredAt: new Date().toISOString(),
        })
        backfillJobs.set(jobId, failedJob)
      }
    })

    const response: BackfillTriggerResponse = {
      jobId,
      status: 'pending',
      message: 'Backfill job created and queued for processing',
      metadata: {
        operationId,
        createdAt: now,
      },
    }

    res.status(202).json(response)
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'

    logger.error('Failed to create backfill job', {
      operation: 'triggerBackfill',
      operationId,
      error: errorMessage,
    })

    res.status(500).json({
      error: {
        code: 'BACKFILL_CREATION_FAILED',
        message: 'Failed to create backfill job',
        details: errorMessage,
      },
    })
  }
})

/**
 * GET /api/admin/backfill/:jobId
 * Get the progress of a backfill job
 *
 * Path Parameters:
 * - jobId: string - The job identifier returned from POST /api/admin/backfill
 *
 * Returns current progress including percentage complete, current snapshot,
 * and any errors encountered.
 *
 * Requirements: 7.1
 */
backfillRouter.get(
  '/:jobId',
  logAdminAccess,
  async (req, res): Promise<void> => {
    const operationId = generateOperationId('get_backfill_progress')
    const jobId = req.params['jobId'] as string

    logger.info('Admin backfill progress requested', {
      operation: 'getBackfillProgress',
      operationId,
      jobId,
      ip: req.ip,
    })

    try {
      const job = backfillJobs.get(jobId)

      if (!job) {
        logger.warn('Backfill job not found', {
          operation: 'getBackfillProgress',
          operationId,
          jobId,
        })

        res.status(404).json({
          error: {
            code: 'JOB_NOT_FOUND',
            message: `Backfill job with ID '${jobId}' not found`,
          },
        })
        return
      }

      const response: BackfillProgressResponse = {
        jobId: job.jobId,
        options: job.options,
        progress: job.progress,
        metadata: {
          operationId,
          retrievedAt: new Date().toISOString(),
        },
      }

      logger.debug('Backfill progress retrieved', {
        operation: 'getBackfillProgress',
        operationId,
        jobId,
        status: job.progress.status,
        percentComplete: job.progress.percentComplete,
      })

      res.json(response)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      logger.error('Failed to get backfill progress', {
        operation: 'getBackfillProgress',
        operationId,
        jobId,
        error: errorMessage,
      })

      res.status(500).json({
        error: {
          code: 'PROGRESS_RETRIEVAL_FAILED',
          message: 'Failed to retrieve backfill progress',
          details: errorMessage,
        },
      })
    }
  }
)

/**
 * DELETE /api/admin/backfill/:jobId
 * Cancel a running backfill job
 *
 * Path Parameters:
 * - jobId: string - The job identifier to cancel
 *
 * Returns the cancellation result including whether it was successful
 * and the previous job status.
 *
 * Requirements: 7.1
 */
backfillRouter.delete(
  '/:jobId',
  logAdminAccess,
  async (req, res): Promise<void> => {
    const operationId = generateOperationId('cancel_backfill')
    const jobId = req.params['jobId'] as string

    logger.info('Admin backfill cancellation requested', {
      operation: 'cancelBackfill',
      operationId,
      jobId,
      ip: req.ip,
    })

    try {
      const job = backfillJobs.get(jobId)

      if (!job) {
        logger.warn('Backfill job not found for cancellation', {
          operation: 'cancelBackfill',
          operationId,
          jobId,
        })

        res.status(404).json({
          error: {
            code: 'JOB_NOT_FOUND',
            message: `Backfill job with ID '${jobId}' not found`,
          },
        })
        return
      }

      const previousStatus = job.progress.status

      // Check if job can be cancelled
      if (previousStatus === 'completed') {
        res.status(400).json({
          error: {
            code: 'JOB_ALREADY_COMPLETED',
            message: 'Cannot cancel a completed job',
          },
        })
        return
      }

      if (previousStatus === 'cancelled') {
        res.status(400).json({
          error: {
            code: 'JOB_ALREADY_CANCELLED',
            message: 'Job has already been cancelled',
          },
        })
        return
      }

      if (previousStatus === 'failed') {
        res.status(400).json({
          error: {
            code: 'JOB_ALREADY_FAILED',
            message: 'Cannot cancel a failed job',
          },
        })
        return
      }

      // Request cancellation through the service
      const cancelled = backfillService.cancelBackfill(jobId)

      if (!cancelled) {
        // This shouldn't happen given the checks above, but handle it gracefully
        logger.warn('Backfill cancellation failed', {
          operation: 'cancelBackfill',
          operationId,
          jobId,
          previousStatus,
        })

        res.status(500).json({
          error: {
            code: 'CANCELLATION_FAILED',
            message: 'Failed to cancel backfill job',
          },
        })
        return
      }

      logger.info('Backfill job cancelled', {
        operation: 'cancelBackfill',
        operationId,
        jobId,
        previousStatus,
      })

      const response: BackfillCancelResponse = {
        jobId,
        cancelled: true,
        previousStatus,
        message: 'Backfill job has been cancelled',
        metadata: {
          operationId,
          cancelledAt: new Date().toISOString(),
        },
      }

      res.json(response)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      logger.error('Failed to cancel backfill job', {
        operation: 'cancelBackfill',
        operationId,
        jobId,
        error: errorMessage,
      })

      res.status(500).json({
        error: {
          code: 'CANCELLATION_FAILED',
          message: 'Failed to cancel backfill job',
          details: errorMessage,
        },
      })
    }
  }
)
