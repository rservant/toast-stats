/**
 * Job Manager for Unified Backfill Service
 *
 * Handles job lifecycle management with persistent storage, including:
 * - Job creation, update, completion, failure, and cancellation
 * - One-job-at-a-time enforcement with stale job detection
 * - Checkpoint management for recovery
 * - Progress update batching (persist within 5 seconds)
 *
 * Requirements: 1.2, 1.3, 3.1, 3.4, 7.2, 7.3
 */

import { randomUUID } from 'crypto'
import type {
  IBackfillJobStorage,
  BackfillJob,
  JobConfig,
  JobProgress,
  JobCheckpoint,
  JobResult,
  JobError,
  DistrictProgress,
} from '../../../types/storageInterfaces.js'
import type { CreateJobRequest } from '../../../types/backfillJob.js'
import { logger } from '../../../utils/logger.js'

/**
 * Stale job threshold in milliseconds (10 minutes)
 *
 * If a running job has no progress update for this duration,
 * it is considered stale and new jobs can be created.
 *
 * Requirements: 3.4
 */
const STALE_JOB_THRESHOLD_MS = 10 * 60 * 1000

/**
 * Progress update batch interval in milliseconds (5 seconds)
 *
 * Progress updates are batched and persisted within this interval
 * to reduce storage I/O while ensuring timely persistence.
 *
 * Requirements: 1.3
 */
const PROGRESS_BATCH_INTERVAL_MS = 5000

/**
 * Pending progress update for batching
 */
interface PendingProgressUpdate {
  jobId: string
  progress: Partial<JobProgress>
  timestamp: number
}

/**
 * Job Manager for Unified Backfill Service
 *
 * Manages the lifecycle of backfill jobs with persistent storage.
 * Enforces one-job-at-a-time policy with stale job detection.
 * Batches progress updates for efficient storage I/O.
 *
 * @example
 * ```typescript
 * const jobManager = new JobManager(jobStorage)
 *
 * // Create a new job
 * const job = await jobManager.createJob({
 *   jobType: 'data-collection',
 *   startDate: '2024-01-01',
 *   endDate: '2024-01-31'
 * })
 *
 * // Update progress
 * await jobManager.updateProgress(job.jobId, { processedItems: 10 })
 *
 * // Complete the job
 * await jobManager.completeJob(job.jobId, { itemsProcessed: 100, ... })
 * ```
 */
export class JobManager {
  private readonly jobStorage: IBackfillJobStorage

  /**
   * Pending progress updates waiting to be batched
   */
  private pendingProgressUpdates: Map<string, PendingProgressUpdate> = new Map()

  /**
   * Timer for progress update batching
   */
  private progressBatchTimer: ReturnType<typeof setTimeout> | null = null

  /**
   * Flag to track if the manager is being disposed
   */
  private isDisposing = false

  /**
   * Creates a new JobManager instance
   *
   * @param jobStorage - The storage implementation for persisting jobs
   */
  constructor(jobStorage: IBackfillJobStorage) {
    this.jobStorage = jobStorage

    logger.debug('JobManager initialized', {
      staleJobThresholdMs: STALE_JOB_THRESHOLD_MS,
      progressBatchIntervalMs: PROGRESS_BATCH_INTERVAL_MS,
      component: 'JobManager',
    })
  }

  // ============================================================================
  // Job Lifecycle Operations
  // ============================================================================

  /**
   * Create a new backfill job
   *
   * Creates a new job with the specified configuration. Enforces
   * one-job-at-a-time policy - rejects if another job is running
   * (unless it's stale).
   *
   * @param request - The job creation request
   * @returns The created job
   * @throws Error if a job is already running (and not stale)
   *
   * Requirements: 1.2, 3.1, 3.4
   */
  async createJob(request: CreateJobRequest): Promise<BackfillJob> {
    // Check if we can start a new job (one-job-at-a-time enforcement)
    const canStart = await this.canStartNewJob()
    if (!canStart) {
      const activeJob = await this.getActiveJob()
      throw new Error(
        `Cannot create new job: job '${activeJob?.jobId}' is already running. ` +
          `Only one job can run at a time.`
      )
    }

    const jobId = randomUUID()
    const now = new Date().toISOString()

    // Build job configuration
    const config: JobConfig = {
      startDate: request.startDate,
      endDate: request.endDate,
      targetDistricts: request.targetDistricts,
      skipExisting: request.skipExisting ?? true,
      rateLimitOverrides: request.rateLimitOverrides,
    }

    // Initialize progress tracking
    const progress: JobProgress = {
      totalItems: 0,
      processedItems: 0,
      failedItems: 0,
      skippedItems: 0,
      currentItem: null,
      districtProgress: {},
      errors: [],
    }

    // Create the job
    const job: BackfillJob = {
      jobId,
      jobType: request.jobType,
      status: 'pending',
      config,
      progress,
      checkpoint: null,
      createdAt: now,
      startedAt: null,
      completedAt: null,
      resumedAt: null,
      result: null,
      error: null,
    }

    // Persist the job
    await this.jobStorage.createJob(job)

    logger.info('Backfill job created', {
      jobId,
      jobType: request.jobType,
      startDate: request.startDate,
      endDate: request.endDate,
      targetDistricts: request.targetDistricts?.length ?? 'all',
      component: 'JobManager',
      operation: 'createJob',
    })

    return job
  }

  /**
   * Update job progress
   *
   * Updates the progress of a running job. Progress updates are batched
   * and persisted within 5 seconds to reduce storage I/O.
   *
   * @param jobId - The job identifier
   * @param progress - Partial progress data to merge
   *
   * Requirements: 1.3
   */
  async updateProgress(
    jobId: string,
    progress: Partial<JobProgress>
  ): Promise<void> {
    // Store the pending update
    const existingUpdate = this.pendingProgressUpdates.get(jobId)
    const mergedProgress = existingUpdate
      ? this.mergeProgress(existingUpdate.progress, progress)
      : progress

    this.pendingProgressUpdates.set(jobId, {
      jobId,
      progress: mergedProgress,
      timestamp: Date.now(),
    })

    // Schedule batch persistence if not already scheduled
    this.scheduleBatchPersistence()

    logger.debug('Progress update queued for batching', {
      jobId,
      processedItems: progress.processedItems,
      currentItem: progress.currentItem,
      component: 'JobManager',
      operation: 'updateProgress',
    })
  }

  /**
   * Update job checkpoint for recovery
   *
   * Saves checkpoint information immediately (not batched) to ensure
   * recovery data is always up-to-date.
   *
   * @param jobId - The job identifier
   * @param checkpoint - The checkpoint data
   *
   * Requirements: 1.3, 10.2
   */
  async updateCheckpoint(
    jobId: string,
    checkpoint: JobCheckpoint
  ): Promise<void> {
    await this.jobStorage.updateCheckpoint(jobId, checkpoint)

    logger.debug('Checkpoint updated', {
      jobId,
      lastProcessedItem: checkpoint.lastProcessedItem,
      itemsCompleted: checkpoint.itemsCompleted.length,
      component: 'JobManager',
      operation: 'updateCheckpoint',
    })
  }

  /**
   * Mark a job as started (running)
   *
   * Transitions a pending job to running status.
   *
   * @param jobId - The job identifier
   */
  async startJob(jobId: string): Promise<void> {
    const now = new Date().toISOString()

    await this.jobStorage.updateJob(jobId, {
      status: 'running',
      startedAt: now,
    })

    logger.info('Job started', {
      jobId,
      startedAt: now,
      component: 'JobManager',
      operation: 'startJob',
    })
  }

  /**
   * Complete a job successfully
   *
   * Marks a job as completed with the final result. Flushes any
   * pending progress updates before completing.
   *
   * @param jobId - The job identifier
   * @param result - The job result summary
   *
   * Requirements: 1.2
   */
  async completeJob(jobId: string, result: JobResult): Promise<void> {
    // Flush any pending progress updates for this job
    await this.flushProgressUpdate(jobId)

    const now = new Date().toISOString()

    await this.jobStorage.updateJob(jobId, {
      status: 'completed',
      completedAt: now,
      result,
    })

    logger.info('Job completed successfully', {
      jobId,
      itemsProcessed: result.itemsProcessed,
      itemsFailed: result.itemsFailed,
      itemsSkipped: result.itemsSkipped,
      duration: result.duration,
      snapshotIds: result.snapshotIds.length,
      component: 'JobManager',
      operation: 'completeJob',
    })
  }

  /**
   * Mark a job as failed
   *
   * Marks a job as failed with an error message. Flushes any
   * pending progress updates before failing.
   *
   * @param jobId - The job identifier
   * @param error - The error message
   *
   * Requirements: 1.2
   */
  async failJob(jobId: string, error: string): Promise<void> {
    // Flush any pending progress updates for this job
    await this.flushProgressUpdate(jobId)

    const now = new Date().toISOString()

    await this.jobStorage.updateJob(jobId, {
      status: 'failed',
      completedAt: now,
      error,
    })

    logger.error('Job failed', {
      jobId,
      error,
      component: 'JobManager',
      operation: 'failJob',
    })
  }

  /**
   * Cancel a running job
   *
   * Attempts to cancel a running job. Returns true if the job was
   * cancelled, false if it couldn't be cancelled (e.g., already completed).
   *
   * The job will complete any in-flight item processing before stopping.
   *
   * @param jobId - The job identifier
   * @returns true if cancelled, false otherwise
   *
   * Requirements: 7.2, 7.3
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const job = await this.jobStorage.getJob(jobId)

    if (!job) {
      logger.warn('Cannot cancel job: job not found', {
        jobId,
        component: 'JobManager',
        operation: 'cancelJob',
      })
      return false
    }

    // Can only cancel pending or running jobs
    if (job.status !== 'pending' && job.status !== 'running') {
      logger.warn('Cannot cancel job: job is not in cancellable state', {
        jobId,
        currentStatus: job.status,
        component: 'JobManager',
        operation: 'cancelJob',
      })
      return false
    }

    // Flush any pending progress updates for this job
    await this.flushProgressUpdate(jobId)

    const now = new Date().toISOString()

    await this.jobStorage.updateJob(jobId, {
      status: 'cancelled',
      completedAt: now,
    })

    logger.info('Job cancelled', {
      jobId,
      previousStatus: job.status,
      component: 'JobManager',
      operation: 'cancelJob',
    })

    return true
  }

  // ============================================================================
  // Deduplication (One-Job-At-A-Time)
  // ============================================================================

  /**
   * Check if a new job can be started
   *
   * Returns true if no job is currently running, or if the running
   * job is stale (no progress update for 10 minutes).
   *
   * @returns true if a new job can be started
   *
   * Requirements: 3.1, 3.4
   */
  async canStartNewJob(): Promise<boolean> {
    const activeJob = await this.getActiveJob()

    if (!activeJob) {
      return true
    }

    // Check if the active job is stale
    const isStale = this.isJobStale(activeJob)

    if (isStale) {
      logger.warn('Active job is stale, allowing new job creation', {
        jobId: activeJob.jobId,
        status: activeJob.status,
        lastProgressAt: this.getLastProgressTimestamp(activeJob),
        staleThresholdMs: STALE_JOB_THRESHOLD_MS,
        component: 'JobManager',
        operation: 'canStartNewJob',
      })

      // Mark the stale job as failed
      await this.failJob(
        activeJob.jobId,
        'Job marked as failed due to inactivity (no progress for 10 minutes)'
      )

      return true
    }

    return false
  }

  /**
   * Get the currently active job
   *
   * Returns the job that is currently running or recovering.
   * Returns null if no job is active.
   *
   * @returns The active job or null
   *
   * Requirements: 3.1, 3.3
   */
  async getActiveJob(): Promise<BackfillJob | null> {
    return this.jobStorage.getActiveJob()
  }

  // ============================================================================
  // Job Queries
  // ============================================================================

  /**
   * Get a job by ID
   *
   * @param jobId - The job identifier
   * @returns The job or null if not found
   */
  async getJob(jobId: string): Promise<BackfillJob | null> {
    return this.jobStorage.getJob(jobId)
  }

  // ============================================================================
  // Error Tracking
  // ============================================================================

  /**
   * Add an error to a job's error list
   *
   * @param jobId - The job identifier
   * @param error - The error to add
   */
  async addError(jobId: string, error: JobError): Promise<void> {
    const job = await this.jobStorage.getJob(jobId)
    if (!job) {
      logger.warn('Cannot add error: job not found', {
        jobId,
        component: 'JobManager',
        operation: 'addError',
      })
      return
    }

    const updatedErrors = [...job.progress.errors, error]

    // Queue the error update with progress batching
    await this.updateProgress(jobId, {
      errors: updatedErrors,
      failedItems: job.progress.failedItems + 1,
    })

    logger.debug('Error added to job', {
      jobId,
      itemId: error.itemId,
      isRetryable: error.isRetryable,
      component: 'JobManager',
      operation: 'addError',
    })
  }

  /**
   * Update district progress
   *
   * @param jobId - The job identifier
   * @param districtId - The district identifier
   * @param districtProgress - The district progress data
   */
  async updateDistrictProgress(
    jobId: string,
    districtId: string,
    districtProgress: DistrictProgress
  ): Promise<void> {
    const job = await this.jobStorage.getJob(jobId)
    if (!job) {
      logger.warn('Cannot update district progress: job not found', {
        jobId,
        districtId,
        component: 'JobManager',
        operation: 'updateDistrictProgress',
      })
      return
    }

    const updatedDistrictProgress = {
      ...job.progress.districtProgress,
      [districtId]: districtProgress,
    }

    // Queue the district progress update with batching
    await this.updateProgress(jobId, {
      districtProgress: updatedDistrictProgress,
    })
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Dispose of the JobManager
   *
   * Flushes all pending progress updates and cleans up resources.
   * Should be called when shutting down the service.
   */
  async dispose(): Promise<void> {
    this.isDisposing = true

    // Clear the batch timer
    if (this.progressBatchTimer) {
      clearTimeout(this.progressBatchTimer)
      this.progressBatchTimer = null
    }

    // Flush all pending updates
    await this.flushAllProgressUpdates()

    logger.info('JobManager disposed', {
      component: 'JobManager',
      operation: 'dispose',
    })
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Check if a job is stale (no progress for 10 minutes)
   *
   * @param job - The job to check
   * @returns true if the job is stale
   */
  private isJobStale(job: BackfillJob): boolean {
    const lastProgressTimestamp = this.getLastProgressTimestamp(job)
    const now = Date.now()
    const elapsed = now - lastProgressTimestamp

    return elapsed > STALE_JOB_THRESHOLD_MS
  }

  /**
   * Get the timestamp of the last progress update for a job
   *
   * Uses checkpoint timestamp if available, otherwise falls back to
   * startedAt or createdAt.
   *
   * @param job - The job
   * @returns Timestamp in milliseconds
   */
  private getLastProgressTimestamp(job: BackfillJob): number {
    // Check checkpoint timestamp first (most recent progress indicator)
    if (job.checkpoint?.lastProcessedAt) {
      return new Date(job.checkpoint.lastProcessedAt).getTime()
    }

    // Fall back to startedAt
    if (job.startedAt) {
      return new Date(job.startedAt).getTime()
    }

    // Fall back to createdAt
    return new Date(job.createdAt).getTime()
  }

  /**
   * Merge two partial progress objects
   *
   * @param existing - Existing progress data
   * @param incoming - New progress data to merge
   * @returns Merged progress data
   */
  private mergeProgress(
    existing: Partial<JobProgress>,
    incoming: Partial<JobProgress>
  ): Partial<JobProgress> {
    const merged: Partial<JobProgress> = { ...existing }

    // Merge simple numeric fields (take the latest value)
    if (incoming.totalItems !== undefined) {
      merged.totalItems = incoming.totalItems
    }
    if (incoming.processedItems !== undefined) {
      merged.processedItems = incoming.processedItems
    }
    if (incoming.failedItems !== undefined) {
      merged.failedItems = incoming.failedItems
    }
    if (incoming.skippedItems !== undefined) {
      merged.skippedItems = incoming.skippedItems
    }
    if (incoming.currentItem !== undefined) {
      merged.currentItem = incoming.currentItem
    }

    // Merge district progress (combine maps)
    if (incoming.districtProgress) {
      merged.districtProgress = {
        ...(existing.districtProgress ?? {}),
        ...incoming.districtProgress,
      }
    }

    // Merge errors (append new errors)
    if (incoming.errors) {
      merged.errors = [...(existing.errors ?? []), ...incoming.errors]
    }

    return merged
  }

  /**
   * Schedule batch persistence of progress updates
   *
   * Sets up a timer to persist all pending progress updates
   * within the batch interval.
   */
  private scheduleBatchPersistence(): void {
    if (this.progressBatchTimer || this.isDisposing) {
      return
    }

    this.progressBatchTimer = setTimeout(async () => {
      this.progressBatchTimer = null
      await this.flushAllProgressUpdates()
    }, PROGRESS_BATCH_INTERVAL_MS)
  }

  /**
   * Flush all pending progress updates to storage
   */
  private async flushAllProgressUpdates(): Promise<void> {
    const updates = Array.from(this.pendingProgressUpdates.values())
    this.pendingProgressUpdates.clear()

    for (const update of updates) {
      try {
        await this.persistProgressUpdate(update.jobId, update.progress)
      } catch (error) {
        logger.error('Failed to flush progress update', {
          jobId: update.jobId,
          error: error instanceof Error ? error.message : 'Unknown error',
          component: 'JobManager',
          operation: 'flushAllProgressUpdates',
        })
      }
    }

    if (updates.length > 0) {
      logger.debug('Flushed progress updates', {
        count: updates.length,
        component: 'JobManager',
        operation: 'flushAllProgressUpdates',
      })
    }
  }

  /**
   * Flush a specific job's pending progress update
   *
   * @param jobId - The job identifier
   */
  private async flushProgressUpdate(jobId: string): Promise<void> {
    const update = this.pendingProgressUpdates.get(jobId)
    if (!update) {
      return
    }

    this.pendingProgressUpdates.delete(jobId)

    try {
      await this.persistProgressUpdate(jobId, update.progress)
    } catch (error) {
      logger.error('Failed to flush progress update for job', {
        jobId,
        error: error instanceof Error ? error.message : 'Unknown error',
        component: 'JobManager',
        operation: 'flushProgressUpdate',
      })
    }
  }

  /**
   * Persist a progress update to storage
   *
   * @param jobId - The job identifier
   * @param progress - The progress data to persist
   */
  private async persistProgressUpdate(
    jobId: string,
    progress: Partial<JobProgress>
  ): Promise<void> {
    const job = await this.jobStorage.getJob(jobId)
    if (!job) {
      logger.warn('Cannot persist progress: job not found', {
        jobId,
        component: 'JobManager',
        operation: 'persistProgressUpdate',
      })
      return
    }

    // Merge with existing progress
    const updatedProgress: JobProgress = {
      ...job.progress,
      ...progress,
      // Ensure arrays and objects are properly merged
      districtProgress: {
        ...job.progress.districtProgress,
        ...(progress.districtProgress ?? {}),
      },
      errors: progress.errors ?? job.progress.errors,
    }

    await this.jobStorage.updateJob(jobId, { progress: updatedProgress })

    logger.debug('Progress persisted', {
      jobId,
      processedItems: updatedProgress.processedItems,
      totalItems: updatedProgress.totalItems,
      component: 'JobManager',
      operation: 'persistProgressUpdate',
    })
  }
}
