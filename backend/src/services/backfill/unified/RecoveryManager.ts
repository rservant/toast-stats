/**
 * Recovery Manager for Unified Backfill Service
 *
 * Handles automatic recovery of incomplete jobs on server startup, including:
 * - Detection of jobs with 'running' or 'pending' status
 * - Automatic resume from checkpoint
 * - Recovery status tracking
 * - Graceful handling of corrupted checkpoints
 *
 * Requirements: 1.4, 10.1, 10.2, 10.3
 */

import type {
  IBackfillJobStorage,
  BackfillJob,
  BackfillJobStatus,
} from '../../../types/storageInterfaces.js'
import { logger } from '../../../utils/logger.js'

// ============================================================================
// Types
// ============================================================================

/**
 * Result of a recovery operation
 *
 * Provides summary information about the recovery attempt,
 * including success status and details about recovered/failed jobs.
 */
export interface RecoveryResult {
  /** Whether the overall recovery operation succeeded */
  success: boolean

  /** Number of jobs successfully recovered */
  jobsRecovered: number

  /** Number of jobs that failed to recover */
  jobsFailed: number

  /** Errors encountered during recovery */
  errors: Array<{ jobId: string; message: string }>
}

/**
 * Current recovery status
 *
 * Tracks the state of the recovery manager and provides
 * information about the last recovery operation.
 */
export interface RecoveryStatus {
  /** Current status of the recovery manager */
  status: 'idle' | 'recovering' | 'completed' | 'failed'

  /** ISO timestamp of the last recovery attempt (null if never run) */
  lastRecoveryAt: string | null

  /** Number of jobs recovered in the last recovery operation */
  jobsRecovered: number

  /** Number of jobs that failed in the last recovery operation */
  jobsFailed: number
}

/**
 * Callback function type for resuming a job
 *
 * This callback is provided by the UnifiedBackfillService to handle
 * the actual job execution. The RecoveryManager calls this to resume
 * jobs from their checkpoint.
 */
export type ResumeJobCallback = (
  job: BackfillJob,
  checkpoint: BackfillJob['checkpoint']
) => Promise<void>

// ============================================================================
// RecoveryManager Class
// ============================================================================

/**
 * Recovery Manager for Unified Backfill Service
 *
 * Manages automatic recovery of incomplete jobs on server startup.
 * Detects jobs that were interrupted (status 'running' or 'pending')
 * and resumes them from their last checkpoint.
 *
 * @example
 * ```typescript
 * const recoveryManager = new RecoveryManager(jobStorage)
 *
 * // Set the resume callback (provided by UnifiedBackfillService)
 * recoveryManager.setResumeCallback(async (job, checkpoint) => {
 *   // Resume job execution from checkpoint
 * })
 *
 * // Recover incomplete jobs on startup
 * const result = await recoveryManager.recoverIncompleteJobs()
 *
 * // Check recovery status
 * const status = recoveryManager.getRecoveryStatus()
 * ```
 */
export class RecoveryManager {
  private readonly jobStorage: IBackfillJobStorage

  /**
   * Callback for resuming jobs (set by UnifiedBackfillService)
   */
  private resumeCallback: ResumeJobCallback | null = null

  /**
   * Current recovery status
   */
  private recoveryStatus: RecoveryStatus = {
    status: 'idle',
    lastRecoveryAt: null,
    jobsRecovered: 0,
    jobsFailed: 0,
  }

  /**
   * Creates a new RecoveryManager instance
   *
   * @param jobStorage - The storage implementation for persisting jobs
   */
  constructor(jobStorage: IBackfillJobStorage) {
    this.jobStorage = jobStorage

    logger.debug('RecoveryManager initialized', {
      component: 'RecoveryManager',
    })
  }

  // ============================================================================
  // Public Methods
  // ============================================================================

  /**
   * Set the callback for resuming jobs
   *
   * This callback is called for each job that needs to be resumed.
   * It should be provided by the UnifiedBackfillService which has
   * access to all the necessary services for job execution.
   *
   * @param callback - The callback function for resuming jobs
   */
  setResumeCallback(callback: ResumeJobCallback): void {
    this.resumeCallback = callback

    logger.debug('Resume callback set', {
      component: 'RecoveryManager',
      operation: 'setResumeCallback',
    })
  }

  /**
   * Recover incomplete jobs on startup
   *
   * Detects jobs with status 'running' or 'pending' and attempts
   * to resume them from their checkpoint. Jobs are marked as
   * 'recovering' during the recovery process.
   *
   * @returns Recovery result with success status and details
   *
   * Requirements: 1.4, 10.1, 10.2, 10.3
   */
  async recoverIncompleteJobs(): Promise<RecoveryResult> {
    const startTime = Date.now()

    logger.info('Starting recovery of incomplete jobs', {
      component: 'RecoveryManager',
      operation: 'recoverIncompleteJobs',
    })

    // Update status to recovering
    this.recoveryStatus = {
      status: 'recovering',
      lastRecoveryAt: new Date().toISOString(),
      jobsRecovered: 0,
      jobsFailed: 0,
    }

    const result: RecoveryResult = {
      success: true,
      jobsRecovered: 0,
      jobsFailed: 0,
      errors: [],
    }

    try {
      // Find incomplete jobs (running or pending status)
      const incompleteJobs = await this.findIncompleteJobs()

      if (incompleteJobs.length === 0) {
        logger.info('No incomplete jobs found for recovery', {
          component: 'RecoveryManager',
          operation: 'recoverIncompleteJobs',
        })

        this.recoveryStatus = {
          status: 'completed',
          lastRecoveryAt: new Date().toISOString(),
          jobsRecovered: 0,
          jobsFailed: 0,
        }

        return result
      }

      logger.info('Found incomplete jobs for recovery', {
        count: incompleteJobs.length,
        jobIds: incompleteJobs.map(j => j.jobId),
        component: 'RecoveryManager',
        operation: 'recoverIncompleteJobs',
      })

      // Process each incomplete job
      for (const job of incompleteJobs) {
        const jobResult = await this.recoverJob(job)

        if (jobResult.success) {
          result.jobsRecovered++
        } else {
          result.jobsFailed++
          result.errors.push({
            jobId: job.jobId,
            message: jobResult.error ?? 'Unknown error during recovery',
          })
        }
      }

      // Determine overall success
      result.success = result.jobsFailed === 0

      // Update final status
      this.recoveryStatus = {
        status: result.success ? 'completed' : 'failed',
        lastRecoveryAt: new Date().toISOString(),
        jobsRecovered: result.jobsRecovered,
        jobsFailed: result.jobsFailed,
      }

      const duration = Date.now() - startTime

      logger.info('Recovery of incomplete jobs completed', {
        success: result.success,
        jobsRecovered: result.jobsRecovered,
        jobsFailed: result.jobsFailed,
        duration,
        component: 'RecoveryManager',
        operation: 'recoverIncompleteJobs',
      })

      return result
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      logger.error('Failed to recover incomplete jobs', {
        error: errorMessage,
        component: 'RecoveryManager',
        operation: 'recoverIncompleteJobs',
      })

      this.recoveryStatus = {
        status: 'failed',
        lastRecoveryAt: new Date().toISOString(),
        jobsRecovered: result.jobsRecovered,
        jobsFailed: result.jobsFailed + 1,
      }

      return {
        success: false,
        jobsRecovered: result.jobsRecovered,
        jobsFailed: result.jobsFailed + 1,
        errors: [
          ...result.errors,
          {
            jobId: 'unknown',
            message: `Recovery process failed: ${errorMessage}`,
          },
        ],
      }
    }
  }

  /**
   * Get the current recovery status
   *
   * Returns information about the recovery manager's state,
   * including the last recovery attempt and its results.
   *
   * @returns Current recovery status
   */
  getRecoveryStatus(): RecoveryStatus {
    return { ...this.recoveryStatus }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Find all incomplete jobs that need recovery
   *
   * Queries storage for jobs with 'running' or 'pending' status.
   * These jobs were interrupted and need to be recovered.
   *
   * @returns Array of incomplete jobs
   */
  private async findIncompleteJobs(): Promise<BackfillJob[]> {
    const incompleteStatuses: BackfillJobStatus[] = ['running', 'pending']

    const jobs = await this.jobStorage.getJobsByStatus(incompleteStatuses)

    logger.debug('Found incomplete jobs', {
      count: jobs.length,
      statuses: incompleteStatuses,
      component: 'RecoveryManager',
      operation: 'findIncompleteJobs',
    })

    return jobs
  }

  /**
   * Recover a single job
   *
   * Marks the job as 'recovering', retrieves its checkpoint,
   * and calls the resume callback to continue execution.
   *
   * @param job - The job to recover
   * @returns Recovery result for this job
   */
  private async recoverJob(
    job: BackfillJob
  ): Promise<{ success: boolean; error?: string }> {
    logger.info('Recovering job', {
      jobId: job.jobId,
      jobType: job.jobType,
      previousStatus: job.status,
      hasCheckpoint: job.checkpoint !== null,
      component: 'RecoveryManager',
      operation: 'recoverJob',
    })

    try {
      // Mark job as recovering
      await this.markJobAsRecovering(job.jobId)

      // Get checkpoint (may be null if job never checkpointed)
      const checkpoint = await this.getJobCheckpoint(job.jobId)

      // Validate checkpoint if present
      if (checkpoint !== null) {
        const validationResult = this.validateCheckpoint(checkpoint)
        if (!validationResult.valid) {
          logger.warn(
            'Corrupted checkpoint detected, will restart job from beginning',
            {
              jobId: job.jobId,
              reason: validationResult.reason,
              component: 'RecoveryManager',
              operation: 'recoverJob',
            }
          )
          // Continue with null checkpoint to restart from beginning
        }
      }

      // Check if resume callback is set
      if (this.resumeCallback === null) {
        logger.warn('No resume callback set, marking job as failed', {
          jobId: job.jobId,
          component: 'RecoveryManager',
          operation: 'recoverJob',
        })

        await this.markJobAsFailed(
          job.jobId,
          'Recovery failed: No resume callback configured'
        )

        return {
          success: false,
          error: 'No resume callback configured',
        }
      }

      // Resume the job (this is async and will run in the background)
      // The resume callback is responsible for updating job status
      const validCheckpoint =
        checkpoint !== null && this.validateCheckpoint(checkpoint).valid
          ? checkpoint
          : null

      // Call the resume callback
      // Note: We don't await this because job execution is long-running
      // The callback is responsible for handling errors and updating status
      this.resumeCallback(job, validCheckpoint).catch(error => {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error'
        logger.error('Job resume failed', {
          jobId: job.jobId,
          error: errorMessage,
          component: 'RecoveryManager',
          operation: 'recoverJob',
        })
      })

      logger.info('Job recovery initiated', {
        jobId: job.jobId,
        hasValidCheckpoint: validCheckpoint !== null,
        itemsCompleted: validCheckpoint?.itemsCompleted.length ?? 0,
        component: 'RecoveryManager',
        operation: 'recoverJob',
      })

      return { success: true }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      logger.error('Failed to recover job', {
        jobId: job.jobId,
        error: errorMessage,
        component: 'RecoveryManager',
        operation: 'recoverJob',
      })

      // Try to mark the job as failed
      try {
        await this.markJobAsFailed(
          job.jobId,
          `Recovery failed: ${errorMessage}`
        )
      } catch (updateError) {
        logger.error('Failed to mark job as failed after recovery error', {
          jobId: job.jobId,
          error:
            updateError instanceof Error
              ? updateError.message
              : 'Unknown error',
          component: 'RecoveryManager',
          operation: 'recoverJob',
        })
      }

      return {
        success: false,
        error: errorMessage,
      }
    }
  }

  /**
   * Mark a job as recovering
   *
   * Updates the job status to 'recovering' and sets the resumedAt timestamp.
   *
   * @param jobId - The job ID to update
   *
   * Requirements: 10.1
   */
  private async markJobAsRecovering(jobId: string): Promise<void> {
    const now = new Date().toISOString()

    await this.jobStorage.updateJob(jobId, {
      status: 'recovering',
      resumedAt: now,
    })

    logger.debug('Job marked as recovering', {
      jobId,
      resumedAt: now,
      component: 'RecoveryManager',
      operation: 'markJobAsRecovering',
    })
  }

  /**
   * Mark a job as failed
   *
   * Updates the job status to 'failed' with an error message.
   *
   * @param jobId - The job ID to update
   * @param error - The error message
   */
  private async markJobAsFailed(jobId: string, error: string): Promise<void> {
    const now = new Date().toISOString()

    await this.jobStorage.updateJob(jobId, {
      status: 'failed',
      completedAt: now,
      error,
    })

    logger.debug('Job marked as failed', {
      jobId,
      error,
      component: 'RecoveryManager',
      operation: 'markJobAsFailed',
    })
  }

  /**
   * Get the checkpoint for a job
   *
   * Retrieves the checkpoint from storage. Returns null if no
   * checkpoint exists.
   *
   * @param jobId - The job ID
   * @returns The checkpoint or null
   *
   * Requirements: 10.2
   */
  private async getJobCheckpoint(
    jobId: string
  ): Promise<BackfillJob['checkpoint']> {
    const checkpoint = await this.jobStorage.getCheckpoint(jobId)

    logger.debug('Retrieved job checkpoint', {
      jobId,
      hasCheckpoint: checkpoint !== null,
      itemsCompleted: checkpoint?.itemsCompleted.length ?? 0,
      component: 'RecoveryManager',
      operation: 'getJobCheckpoint',
    })

    return checkpoint
  }

  /**
   * Validate a checkpoint for integrity
   *
   * Checks that the checkpoint has all required fields and
   * valid data. Returns validation result with reason if invalid.
   *
   * @param checkpoint - The checkpoint to validate
   * @returns Validation result
   */
  private validateCheckpoint(
    checkpoint: NonNullable<BackfillJob['checkpoint']>
  ): { valid: boolean; reason?: string } {
    // Check required fields
    if (typeof checkpoint.lastProcessedItem !== 'string') {
      return {
        valid: false,
        reason: 'Missing or invalid lastProcessedItem',
      }
    }

    if (typeof checkpoint.lastProcessedAt !== 'string') {
      return {
        valid: false,
        reason: 'Missing or invalid lastProcessedAt',
      }
    }

    if (!Array.isArray(checkpoint.itemsCompleted)) {
      return {
        valid: false,
        reason: 'Missing or invalid itemsCompleted array',
      }
    }

    // Validate timestamp format
    const timestamp = new Date(checkpoint.lastProcessedAt)
    if (isNaN(timestamp.getTime())) {
      return {
        valid: false,
        reason: 'Invalid lastProcessedAt timestamp format',
      }
    }

    // Validate itemsCompleted contains strings
    for (const item of checkpoint.itemsCompleted) {
      if (typeof item !== 'string') {
        return {
          valid: false,
          reason: 'itemsCompleted contains non-string values',
        }
      }
    }

    return { valid: true }
  }
}
