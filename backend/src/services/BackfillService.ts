/**
 * BackfillService
 *
 * Processes existing snapshots to generate pre-computed analytics.
 * This enables historical data to benefit from the performance
 * improvements of pre-computed analytics.
 *
 * Key features:
 * - Processes snapshots in chronological order
 * - Tracks progress and supports resumption from the last processed snapshot
 * - Runs in background without blocking normal operations
 * - Handles errors gracefully, continuing with next snapshot on error
 *
 * NOTE: Time-series data is now pre-computed by scraper-cli during the
 * compute-analytics pipeline. This service no longer computes or writes
 * time-series data - it only orchestrates backfill operations for analytics.
 *
 * Requirements:
 * - 7.2: Process snapshots in chronological order to build accurate time-series data
 * - 7.3: Resumable, tracking progress and continuing from the last processed snapshot
 * - 7.4: Run in background without blocking normal operations
 * - 2.1-2.5: No time-series computation (handled by scraper-cli)
 */

import { logger } from '../utils/logger.js'
import type {
  IBackfillService,
  BackfillJobOptions,
} from '../routes/admin/backfill.js'
import {
  updateBackfillJobProgress,
  getBackfillJob,
} from '../routes/admin/backfill.js'
import type { PreComputedAnalyticsService } from './PreComputedAnalyticsService.js'
import type { FileSnapshotStore } from './SnapshotStore.js'
import type { DistrictStatistics } from '../types/districts.js'

/**
 * Configuration for BackfillService
 */
export interface BackfillServiceConfig {
  /** Snapshot store for reading snapshots */
  snapshotStore: FileSnapshotStore
  /** Pre-computed analytics service for generating analytics */
  preComputedAnalyticsService: PreComputedAnalyticsService
}

/**
 * Internal state for tracking active backfill jobs
 */
interface ActiveBackfillJob {
  jobId: string
  cancelled: boolean
}

/**
 * Service for backfilling pre-computed analytics for existing snapshots.
 *
 * This service processes historical snapshots to generate pre-computed analytics,
 * enabling fast retrieval of historical data.
 *
 * NOTE: Time-series index generation is now handled by scraper-cli during the
 * compute-analytics pipeline. This service focuses only on analytics backfill.
 *
 * Requirement 7.2: Process snapshots in chronological order
 * Requirement 7.3: Support resumption from last processed snapshot
 * Requirement 7.4: Run in background without blocking normal operations
 */
export class BackfillService implements IBackfillService {
  private readonly snapshotStore: FileSnapshotStore
  private readonly preComputedAnalyticsService: PreComputedAnalyticsService

  /** Track active jobs for cancellation support */
  private readonly activeJobs = new Map<string, ActiveBackfillJob>()

  constructor(config: BackfillServiceConfig) {
    this.snapshotStore = config.snapshotStore
    this.preComputedAnalyticsService = config.preComputedAnalyticsService
  }

  /**
   * Start a backfill job
   *
   * This method starts the backfill process in the background and returns
   * immediately. Progress is tracked via the job store and can be queried
   * through the admin API.
   *
   * Requirement 7.4: Run in background without blocking normal operations
   *
   * @param jobId - Unique job identifier for tracking
   * @param options - Backfill configuration options
   */
  async startBackfill(
    jobId: string,
    options: BackfillJobOptions
  ): Promise<void> {
    const operationId = `backfill_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    logger.info('Starting backfill job', {
      operation: 'startBackfill',
      operationId,
      jobId,
      options,
    })

    // Register this job as active
    this.activeJobs.set(jobId, { jobId, cancelled: false })

    // Update job status to running
    updateBackfillJobProgress(jobId, {
      status: 'running',
      startedAt: new Date().toISOString(),
    })

    try {
      // Run the backfill process
      await this.runBackfill(jobId, options, operationId)

      // Check if job was cancelled during processing
      const activeJob = this.activeJobs.get(jobId)
      if (activeJob?.cancelled) {
        logger.info('Backfill job was cancelled', {
          operation: 'startBackfill',
          operationId,
          jobId,
        })
        // Status already updated by cancelBackfill
        return
      }

      // Mark job as completed
      updateBackfillJobProgress(jobId, {
        status: 'completed',
        completedAt: new Date().toISOString(),
        percentComplete: 100,
      })

      logger.info('Backfill job completed successfully', {
        operation: 'startBackfill',
        operationId,
        jobId,
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      logger.error('Backfill job failed', {
        operation: 'startBackfill',
        operationId,
        jobId,
        error: errorMessage,
      })

      // Mark job as failed
      updateBackfillJobProgress(jobId, {
        status: 'failed',
        completedAt: new Date().toISOString(),
        errors: [
          {
            snapshotId: 'N/A',
            message: errorMessage,
            occurredAt: new Date().toISOString(),
          },
        ],
      })

      throw error
    } finally {
      // Clean up active job tracking
      this.activeJobs.delete(jobId)
    }
  }

  /**
   * Cancel a running backfill job
   *
   * Sets a cancellation flag that will be checked during processing.
   * The job will stop at the next checkpoint.
   *
   * @param jobId - Job identifier to cancel
   * @returns true if cancellation was requested, false if job not found or not running
   */
  cancelBackfill(jobId: string): boolean {
    const activeJob = this.activeJobs.get(jobId)

    if (!activeJob) {
      // Job not found in active jobs - check if it exists in job store
      const job = getBackfillJob(jobId)
      if (!job) {
        return false
      }

      // Job exists but is not active (already completed/failed/cancelled)
      if (
        job.progress.status !== 'running' &&
        job.progress.status !== 'pending'
      ) {
        return false
      }

      // Job is pending but not yet started - update status directly
      updateBackfillJobProgress(jobId, {
        status: 'cancelled',
        completedAt: new Date().toISOString(),
      })

      return true
    }

    // Set cancellation flag for active job
    activeJob.cancelled = true

    logger.info('Backfill job cancellation requested', {
      operation: 'cancelBackfill',
      jobId,
    })

    // Update job status
    updateBackfillJobProgress(jobId, {
      status: 'cancelled',
      completedAt: new Date().toISOString(),
    })

    return true
  }

  // ========== Private Methods ==========

  /**
   * Run the backfill process
   *
   * Requirement 7.2: Process snapshots in chronological order
   * Requirement 7.3: Support resumption by checking if analytics already exist
   */
  private async runBackfill(
    jobId: string,
    options: BackfillJobOptions,
    operationId: string
  ): Promise<void> {
    // Get list of snapshots to process
    const snapshots = await this.getSnapshotsToProcess(options)

    logger.info('Retrieved snapshots for backfill', {
      operation: 'runBackfill',
      operationId,
      jobId,
      snapshotCount: snapshots.length,
      startDate: options.startDate,
      endDate: options.endDate,
    })

    if (snapshots.length === 0) {
      logger.info('No snapshots to process', {
        operation: 'runBackfill',
        operationId,
        jobId,
      })
      updateBackfillJobProgress(jobId, {
        totalSnapshots: 0,
        processedSnapshots: 0,
        percentComplete: 100,
      })
      return
    }

    // Update total count
    updateBackfillJobProgress(jobId, {
      totalSnapshots: snapshots.length,
      processedSnapshots: 0,
      percentComplete: 0,
    })

    const errors: Array<{
      snapshotId: string
      message: string
      occurredAt: string
    }> = []
    let processedCount = 0

    // Process each snapshot in chronological order
    // Requirement 7.2: Process snapshots in chronological order
    for (const snapshotId of snapshots) {
      // Check for cancellation
      const activeJob = this.activeJobs.get(jobId)
      if (activeJob?.cancelled) {
        logger.info('Backfill cancelled, stopping processing', {
          operation: 'runBackfill',
          operationId,
          jobId,
          processedCount,
          totalSnapshots: snapshots.length,
        })
        break
      }

      // Update current snapshot
      updateBackfillJobProgress(jobId, {
        currentSnapshot: snapshotId,
      })

      try {
        // Check if analytics already exist (for resumption support)
        // Requirement 7.3: Support resumption
        const analyticsExist = await this.checkAnalyticsExist(snapshotId)

        if (analyticsExist) {
          logger.debug('Analytics already exist for snapshot, skipping', {
            operation: 'runBackfill',
            operationId,
            jobId,
            snapshotId,
          })
        } else {
          // Process this snapshot
          await this.processSnapshot(
            snapshotId,
            options.districtIds,
            operationId
          )
        }

        processedCount++

        // Update progress
        const percentComplete = Math.round(
          (processedCount / snapshots.length) * 100
        )
        const estimatedTimeRemaining = this.estimateTimeRemaining(
          processedCount,
          snapshots.length,
          jobId
        )

        updateBackfillJobProgress(jobId, {
          processedSnapshots: processedCount,
          percentComplete,
          estimatedTimeRemaining,
        })

        logger.debug('Processed snapshot', {
          operation: 'runBackfill',
          operationId,
          jobId,
          snapshotId,
          processedCount,
          totalSnapshots: snapshots.length,
          percentComplete,
        })
      } catch (error) {
        // Handle errors gracefully - log and continue with next snapshot
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error'

        logger.warn('Failed to process snapshot, continuing with next', {
          operation: 'runBackfill',
          operationId,
          jobId,
          snapshotId,
          error: errorMessage,
        })

        errors.push({
          snapshotId,
          message: errorMessage,
          occurredAt: new Date().toISOString(),
        })

        // Update errors in progress
        updateBackfillJobProgress(jobId, {
          errors,
        })

        // Continue with next snapshot
        processedCount++
      }
    }

    logger.info('Backfill processing complete', {
      operation: 'runBackfill',
      operationId,
      jobId,
      processedCount,
      totalSnapshots: snapshots.length,
      errorCount: errors.length,
    })
  }

  /**
   * Get list of snapshots to process based on options
   *
   * Returns snapshot IDs sorted in chronological order (oldest first)
   * to ensure time-series data is built correctly.
   *
   * Requirement 7.2: Process snapshots in chronological order
   */
  private async getSnapshotsToProcess(
    options: BackfillJobOptions
  ): Promise<string[]> {
    // Get all snapshots
    const allSnapshots = await this.snapshotStore.listSnapshots(undefined, {
      status: 'success',
    })

    // Filter by date range if specified
    let filteredSnapshots = allSnapshots

    if (options.startDate) {
      filteredSnapshots = filteredSnapshots.filter(
        s => s.snapshot_id >= options.startDate!
      )
    }

    if (options.endDate) {
      filteredSnapshots = filteredSnapshots.filter(
        s => s.snapshot_id <= options.endDate!
      )
    }

    // Sort in chronological order (oldest first)
    // Requirement 7.2: Process snapshots in chronological order
    filteredSnapshots.sort((a, b) => a.snapshot_id.localeCompare(b.snapshot_id))

    // Return just the snapshot IDs
    return filteredSnapshots.map(s => s.snapshot_id)
  }

  /**
   * Check if pre-computed analytics already exist for a snapshot
   *
   * Used for resumption support - if analytics exist, we can skip processing.
   *
   * Requirement 7.3: Support resumption
   */
  private async checkAnalyticsExist(snapshotId: string): Promise<boolean> {
    try {
      // Try to get analytics for any district - if the file exists, analytics exist
      // We use a simple approach: check if we can get the manifest and if it has districts
      const manifest = await this.snapshotStore.getSnapshotManifest(snapshotId)

      if (!manifest || manifest.successfulDistricts === 0) {
        return false
      }

      // Check if analytics summary exists by trying to get analytics for the first district
      const firstDistrictEntry = manifest.districts.find(
        d => d.status === 'success'
      )
      if (!firstDistrictEntry) {
        return false
      }

      const analytics =
        await this.preComputedAnalyticsService.getAnalyticsSummary(
          firstDistrictEntry.districtId,
          snapshotId
        )

      return analytics !== null
    } catch {
      // If we can't check, assume analytics don't exist
      return false
    }
  }

  /**
   * Process a single snapshot
   *
   * Generates pre-computed analytics for all districts in the snapshot.
   *
   * NOTE: Time-series index generation is now handled by scraper-cli during
   * the compute-analytics pipeline, not during backfill operations.
   */
  private async processSnapshot(
    snapshotId: string,
    districtIds: string[] | undefined,
    operationId: string
  ): Promise<void> {
    logger.debug('Processing snapshot', {
      operation: 'processSnapshot',
      operationId,
      snapshotId,
      districtFilter: districtIds,
    })

    // Get the manifest to find all districts in this snapshot
    const manifest = await this.snapshotStore.getSnapshotManifest(snapshotId)

    if (!manifest) {
      throw new Error(`Snapshot manifest not found: ${snapshotId}`)
    }

    // Get successful districts
    const successfulDistricts = manifest.districts.filter(
      d => d.status === 'success'
    )

    // Filter by district IDs if specified
    const districtsToProcess = districtIds
      ? successfulDistricts.filter(d => districtIds.includes(d.districtId))
      : successfulDistricts

    if (districtsToProcess.length === 0) {
      logger.debug('No districts to process in snapshot', {
        operation: 'processSnapshot',
        operationId,
        snapshotId,
      })
      return
    }

    // Load district data
    const districtData: DistrictStatistics[] = []

    for (const districtEntry of districtsToProcess) {
      try {
        const data = await this.snapshotStore.readDistrictData(
          snapshotId,
          districtEntry.districtId
        )

        if (data) {
          districtData.push(data)
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error'
        logger.warn('Failed to read district data', {
          operation: 'processSnapshot',
          operationId,
          snapshotId,
          districtId: districtEntry.districtId,
          error: errorMessage,
        })
        // Continue with other districts
      }
    }

    if (districtData.length === 0) {
      logger.warn('No district data loaded for snapshot', {
        operation: 'processSnapshot',
        operationId,
        snapshotId,
      })
      return
    }

    // NOTE: Pre-computed analytics are now generated by scraper-cli during the
    // compute-analytics pipeline. The backend no longer performs any computation
    // per the data-computation-separation steering document.

    logger.debug('Completed processing snapshot', {
      operation: 'processSnapshot',
      operationId,
      snapshotId,
      districtsProcessed: districtData.length,
    })
  }

  /**
   * Estimate remaining time based on processing rate
   */
  private estimateTimeRemaining(
    processedCount: number,
    totalCount: number,
    jobId: string
  ): number | undefined {
    if (processedCount === 0) {
      return undefined
    }

    const job = getBackfillJob(jobId)
    if (!job?.progress.startedAt) {
      return undefined
    }

    const startTime = new Date(job.progress.startedAt).getTime()
    const elapsedMs = Date.now() - startTime
    const avgTimePerSnapshot = elapsedMs / processedCount
    const remainingSnapshots = totalCount - processedCount

    return Math.round((avgTimePerSnapshot * remainingSnapshots) / 1000)
  }
}

/**
 * Factory function to create a BackfillService instance
 */
export function createBackfillService(
  config: BackfillServiceConfig
): IBackfillService {
  return new BackfillService(config)
}
