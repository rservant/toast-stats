/**
 * Unified Backfill Service
 *
 * Orchestrates the complete backfill workflow by coordinating:
 * - JobManager: Job lifecycle, progress tracking, checkpoint management
 * - DataCollector: Historical data collection operations
 * - AnalyticsGenerator: Pre-computed analytics generation
 * - RecoveryManager: Automatic recovery of incomplete jobs on startup
 *
 * This service provides a single entry point for all backfill operations,
 * including job creation, status tracking, cancellation, preview, and
 * rate limit configuration management.
 *
 * Requirements: 2.1, 2.2, 2.3, 3.1, 7.1, 11.2, 12.3
 */

import type {
  IBackfillJobStorage,
  ISnapshotStorage,
  ITimeSeriesIndexStorage,
  BackfillJob,
  BackfillJobStatus,
  RateLimitConfig,
  ListJobsOptions,
  JobCheckpoint,
  JobResult,
} from '../../../types/storageInterfaces.js'
import type {
  CreateJobRequest,
  JobPreview,
} from '../../../types/backfillJob.js'
import type { RefreshService } from '../../RefreshService.js'
import type { DistrictConfigurationService } from '../../DistrictConfigurationService.js'
import type { PreComputedAnalyticsService } from '../../PreComputedAnalyticsService.js'
import { JobManager } from './JobManager.js'
import { DataCollector, type CollectionProgress } from './DataCollector.js'
import {
  AnalyticsGenerator,
  type GenerationProgress,
} from './AnalyticsGenerator.js'
import {
  RecoveryManager,
  type RecoveryResult,
  type RecoveryStatus,
} from './RecoveryManager.js'
import { logger } from '../../../utils/logger.js'

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for UnifiedBackfillService
 */
export interface UnifiedBackfillServiceConfig {
  /**
   * Whether to automatically recover incomplete jobs on initialization
   * Defaults to true
   */
  autoRecoverOnInit?: boolean
}

/**
 * Default rate limit configuration
 *
 * Used when no rate limit configuration exists in storage.
 * These values provide a conservative default that balances
 * throughput with system load.
 */
const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  maxRequestsPerMinute: 10,
  maxConcurrent: 3,
  minDelayMs: 2000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
}

// ============================================================================
// UnifiedBackfillService Class
// ============================================================================

/**
 * Unified Backfill Service
 *
 * Main orchestrator for all backfill operations. Coordinates job lifecycle,
 * data collection, analytics generation, and recovery.
 *
 * @example
 * ```typescript
 * const service = new UnifiedBackfillService(
 *   jobStorage,
 *   snapshotStorage,
 *   timeSeriesStorage,
 *   refreshService,
 *   configService
 * )
 *
 * // Initialize and recover any incomplete jobs
 * await service.initialize()
 *
 * // Create a new data collection job
 * const job = await service.createJob({
 *   jobType: 'data-collection',
 *   startDate: '2024-01-01',
 *   endDate: '2024-01-31'
 * })
 *
 * // Check job status
 * const status = await service.getJobStatus(job.jobId)
 *
 * // Cancel if needed
 * await service.cancelJob(job.jobId)
 * ```
 */
export class UnifiedBackfillService {
  private readonly jobStorage: IBackfillJobStorage
  private readonly configService: DistrictConfigurationService

  // Component instances
  private readonly jobManager: JobManager
  private readonly dataCollector: DataCollector
  private readonly analyticsGenerator: AnalyticsGenerator
  private readonly recoveryManager: RecoveryManager

  // Service configuration
  private readonly config: UnifiedBackfillServiceConfig

  // Track active job execution for cancellation
  private activeJobId: string | null = null
  private isInitialized = false

  /**
   * Creates a new UnifiedBackfillService instance
   *
   * @param jobStorage - Storage for backfill job persistence
   * @param snapshotStorage - Storage for snapshot operations
   * @param timeSeriesStorage - Storage for time-series index operations
   * @param refreshService - Service for executing refresh operations
   * @param configService - Service for district configuration
   * @param preComputedAnalyticsService - Service for computing and storing pre-computed analytics
   * @param config - Optional service configuration
   */
  constructor(
    jobStorage: IBackfillJobStorage,
    snapshotStorage: ISnapshotStorage,
    timeSeriesStorage: ITimeSeriesIndexStorage,
    refreshService: RefreshService,
    configService: DistrictConfigurationService,
    preComputedAnalyticsService: PreComputedAnalyticsService,
    config?: UnifiedBackfillServiceConfig
  ) {
    this.jobStorage = jobStorage
    this.configService = configService
    this.config = {
      autoRecoverOnInit: true,
      ...config,
    }

    // Initialize components
    this.jobManager = new JobManager(jobStorage)
    this.dataCollector = new DataCollector(
      refreshService,
      snapshotStorage,
      configService
    )
    this.analyticsGenerator = new AnalyticsGenerator(
      snapshotStorage,
      timeSeriesStorage,
      preComputedAnalyticsService
    )
    this.recoveryManager = new RecoveryManager(jobStorage)

    // Wire up recovery callback
    this.recoveryManager.setResumeCallback(this.handleJobResume.bind(this))

    logger.info('UnifiedBackfillService created', {
      autoRecoverOnInit: this.config.autoRecoverOnInit,
      component: 'UnifiedBackfillService',
    })
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  /**
   * Initialize the service
   *
   * Performs any necessary setup and optionally recovers incomplete jobs.
   * Should be called once during application startup.
   *
   * @returns Recovery result if auto-recovery is enabled, undefined otherwise
   */
  async initialize(): Promise<RecoveryResult | undefined> {
    if (this.isInitialized) {
      logger.warn('UnifiedBackfillService already initialized', {
        component: 'UnifiedBackfillService',
        operation: 'initialize',
      })
      return undefined
    }

    logger.info('Initializing UnifiedBackfillService', {
      autoRecoverOnInit: this.config.autoRecoverOnInit,
      component: 'UnifiedBackfillService',
      operation: 'initialize',
    })

    // Check storage readiness
    const storageReady = await this.jobStorage.isReady()
    if (!storageReady) {
      logger.warn('Job storage not ready during initialization', {
        component: 'UnifiedBackfillService',
        operation: 'initialize',
      })
    }

    this.isInitialized = true

    // Recover incomplete jobs if configured
    if (this.config.autoRecoverOnInit) {
      return this.recoverIncompleteJobs()
    }

    return undefined
  }

  // ============================================================================
  // Job Operations
  // ============================================================================

  /**
   * Create a new backfill job
   *
   * Creates a job with the specified configuration and starts execution
   * asynchronously. The job runs in the background and progress can be
   * tracked via getJobStatus().
   *
   * @param request - Job creation request
   * @returns The created job
   * @throws Error if a job is already running or validation fails
   *
   * Requirements: 2.1, 2.2, 2.3, 3.1
   */
  async createJob(request: CreateJobRequest): Promise<BackfillJob> {
    logger.info('Creating backfill job', {
      jobType: request.jobType,
      startDate: request.startDate,
      endDate: request.endDate,
      targetDistricts: request.targetDistricts?.length ?? 'all',
      component: 'UnifiedBackfillService',
      operation: 'createJob',
    })

    // Create the job via JobManager (handles one-job-at-a-time enforcement)
    const job = await this.jobManager.createJob(request)

    // Start job execution asynchronously (don't block on long-running jobs)
    this.executeJobAsync(job).catch(error => {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Job execution failed', {
        jobId: job.jobId,
        error: errorMessage,
        component: 'UnifiedBackfillService',
        operation: 'createJob',
      })
    })

    return job
  }

  /**
   * Get the status of a job
   *
   * Returns the current status of a job by its ID.
   * Returns null if the job doesn't exist.
   *
   * @param jobId - The job identifier
   * @returns The job status or null if not found
   */
  async getJobStatus(jobId: string): Promise<BackfillJobStatus | null> {
    const job = await this.jobStorage.getJob(jobId)

    if (job === null) {
      logger.debug('Job not found', {
        jobId,
        component: 'UnifiedBackfillService',
        operation: 'getJobStatus',
      })
      return null
    }

    return job.status
  }

  /**
   * Get a job by ID
   *
   * Returns the complete job object including progress and checkpoint.
   * Returns null if the job doesn't exist.
   *
   * @param jobId - The job identifier
   * @returns The job or null if not found
   */
  async getJob(jobId: string): Promise<BackfillJob | null> {
    return this.jobStorage.getJob(jobId)
  }

  /**
   * Cancel a running job
   *
   * Attempts to cancel a running job. The job will complete any
   * in-flight item processing before stopping gracefully.
   *
   * @param jobId - The job identifier
   * @returns true if cancelled, false if job couldn't be cancelled
   *
   * Requirements: 7.1
   */
  async cancelJob(jobId: string): Promise<boolean> {
    logger.info('Cancelling job', {
      jobId,
      component: 'UnifiedBackfillService',
      operation: 'cancelJob',
    })

    // Cancel via JobManager
    const cancelled = await this.jobManager.cancelJob(jobId)

    if (cancelled) {
      // Signal cancellation to active collectors/generators
      if (this.activeJobId === jobId) {
        this.dataCollector.cancel()
        this.analyticsGenerator.cancel()
      }

      logger.info('Job cancelled successfully', {
        jobId,
        component: 'UnifiedBackfillService',
        operation: 'cancelJob',
      })
    } else {
      logger.warn('Job cancellation failed', {
        jobId,
        component: 'UnifiedBackfillService',
        operation: 'cancelJob',
      })
    }

    return cancelled
  }

  /**
   * Force-cancel a job regardless of its current execution state
   *
   * Unlike regular cancelJob(), this method:
   * - Does not check if the job is actively running
   * - Clears the checkpoint to prevent recovery
   * - Sets a specific error message indicating force-cancellation
   *
   * This is intended for administrative intervention when jobs are stuck
   * in 'running' or 'recovering' states and cannot be cancelled normally.
   *
   * @param jobId - The job identifier
   * @param operatorContext - Context about who initiated the force-cancel
   * @returns true if cancelled, false if job not found or already terminal
   *
   * Requirements: 2.1, 2.2, 2.3, 2.4
   */
  async forceCancelJob(
    jobId: string,
    operatorContext: { ip?: string; reason?: string }
  ): Promise<boolean> {
    logger.info('Force-cancelling job', {
      jobId,
      operatorIp: operatorContext.ip ?? 'unknown',
      reason: operatorContext.reason ?? 'not specified',
      component: 'UnifiedBackfillService',
      operation: 'forceCancelJob',
    })

    // Check if job exists
    const job = await this.jobStorage.getJob(jobId)

    if (!job) {
      logger.warn('Cannot force-cancel job: job not found', {
        jobId,
        component: 'UnifiedBackfillService',
        operation: 'forceCancelJob',
      })
      return false
    }

    // Terminal states cannot be force-cancelled
    const terminalStates: BackfillJobStatus[] = [
      'completed',
      'failed',
      'cancelled',
    ]
    if (terminalStates.includes(job.status)) {
      logger.warn('Cannot force-cancel job: job is already in terminal state', {
        jobId,
        currentStatus: job.status,
        component: 'UnifiedBackfillService',
        operation: 'forceCancelJob',
      })
      return false
    }

    const now = new Date().toISOString()
    const previousStatus = job.status

    // Build error message with operator context
    const reasonText = operatorContext.reason
      ? ` Reason: ${operatorContext.reason}`
      : ''
    const ipText = operatorContext.ip ? ` (IP: ${operatorContext.ip})` : ''
    const errorMessage = `Force-cancelled by operator at ${now}.${reasonText}${ipText}`

    // Update job with cancelled status, completedAt, error message, and clear checkpoint
    // Requirements: 2.1 (status), 2.2 (completedAt), 2.3 (error), 2.4 (checkpoint=null)
    await this.jobStorage.updateJob(jobId, {
      status: 'cancelled',
      completedAt: now,
      error: errorMessage,
      checkpoint: null,
    })

    // Signal cancellation to active collectors/generators if this is the active job
    if (this.activeJobId === jobId) {
      this.dataCollector.cancel()
      this.analyticsGenerator.cancel()
    }

    logger.info('Job force-cancelled successfully', {
      jobId,
      previousStatus,
      completedAt: now,
      operatorIp: operatorContext.ip ?? 'unknown',
      reason: operatorContext.reason ?? 'not specified',
      component: 'UnifiedBackfillService',
      operation: 'forceCancelJob',
    })

    return true
  }

  // ============================================================================
  // Preview / Dry Run
  // ============================================================================

  /**
   * Preview a job without executing it
   *
   * Returns information about what would be processed without
   * actually executing the backfill. Useful for verifying
   * configuration before large operations.
   *
   * @param request - Job creation request to preview
   * @returns Preview of what would be processed
   *
   * Requirements: 11.2
   */
  async previewJob(request: CreateJobRequest): Promise<JobPreview> {
    logger.debug('Generating job preview', {
      jobType: request.jobType,
      startDate: request.startDate,
      endDate: request.endDate,
      component: 'UnifiedBackfillService',
      operation: 'previewJob',
    })

    if (request.jobType === 'data-collection') {
      // Validate required fields for data-collection
      if (!request.startDate || !request.endDate) {
        throw new Error(
          'startDate and endDate are required for data-collection jobs'
        )
      }

      const preview = await this.dataCollector.previewCollection(
        request.startDate,
        request.endDate,
        {
          targetDistricts: request.targetDistricts,
          skipExisting: request.skipExisting ?? true,
        }
      )

      return {
        jobType: 'data-collection',
        totalItems: preview.totalItems,
        dateRange: preview.dateRange,
        affectedDistricts: preview.affectedDistricts,
        estimatedDuration: preview.estimatedDuration,
        itemBreakdown: {
          dates: preview.dates,
        },
      }
    } else if (request.jobType === 'analytics-generation') {
      const preview = await this.analyticsGenerator.previewGeneration(
        request.startDate,
        request.endDate
      )

      // Get affected districts from configured districts
      const affectedDistricts =
        await this.configService.getConfiguredDistricts()

      return {
        jobType: 'analytics-generation',
        totalItems: preview.totalItems,
        dateRange: preview.dateRange,
        affectedDistricts,
        estimatedDuration: preview.estimatedDuration,
        itemBreakdown: {
          snapshotIds: preview.snapshotIds,
        },
      }
    } else {
      throw new Error(`Invalid job type: ${request.jobType as string}`)
    }
  }

  // ============================================================================
  // Job History
  // ============================================================================

  /**
   * List jobs with optional filtering and pagination
   *
   * Returns jobs matching the specified criteria, sorted by
   * creation time (newest first).
   *
   * @param options - Optional filtering and pagination options
   * @returns Array of jobs matching the criteria
   */
  async listJobs(options?: ListJobsOptions): Promise<BackfillJob[]> {
    return this.jobStorage.listJobs(options)
  }

  // ============================================================================
  // Rate Limit Configuration
  // ============================================================================

  /**
   * Get the current rate limit configuration
   *
   * Returns the global rate limit configuration for backfill operations.
   * Returns default configuration if none has been set.
   *
   * @returns The rate limit configuration
   *
   * Requirements: 12.3
   */
  async getRateLimitConfig(): Promise<RateLimitConfig> {
    try {
      return await this.jobStorage.getRateLimitConfig()
    } catch (error) {
      logger.warn('Failed to get rate limit config, using defaults', {
        error: error instanceof Error ? error.message : 'Unknown error',
        component: 'UnifiedBackfillService',
        operation: 'getRateLimitConfig',
      })
      return { ...DEFAULT_RATE_LIMIT_CONFIG }
    }
  }

  /**
   * Update the rate limit configuration
   *
   * Merges the provided configuration with the existing configuration.
   * Only the specified fields are updated.
   *
   * @param config - Partial rate limit configuration to merge
   *
   * Requirements: 12.3
   */
  async updateRateLimitConfig(config: Partial<RateLimitConfig>): Promise<void> {
    const currentConfig = await this.getRateLimitConfig()

    const updatedConfig: RateLimitConfig = {
      ...currentConfig,
      ...config,
    }

    await this.jobStorage.setRateLimitConfig(updatedConfig)

    logger.info('Rate limit configuration updated', {
      config: updatedConfig,
      component: 'UnifiedBackfillService',
      operation: 'updateRateLimitConfig',
    })
  }

  // ============================================================================
  // Recovery
  // ============================================================================

  /**
   * Recover incomplete jobs
   *
   * Detects jobs that were interrupted (status 'running' or 'pending')
   * and resumes them from their last checkpoint.
   *
   * @returns Recovery result with success status and details
   */
  async recoverIncompleteJobs(): Promise<RecoveryResult> {
    logger.info('Starting recovery of incomplete jobs', {
      component: 'UnifiedBackfillService',
      operation: 'recoverIncompleteJobs',
    })

    return this.recoveryManager.recoverIncompleteJobs()
  }

  /**
   * Get the current recovery status
   *
   * @returns Current recovery status
   */
  getRecoveryStatus(): RecoveryStatus {
    return this.recoveryManager.getRecoveryStatus()
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Dispose of the service
   *
   * Cleans up resources and flushes pending updates.
   * Should be called when shutting down the application.
   */
  async dispose(): Promise<void> {
    logger.info('Disposing UnifiedBackfillService', {
      component: 'UnifiedBackfillService',
      operation: 'dispose',
    })

    // Cancel any active job
    if (this.activeJobId) {
      this.dataCollector.cancel()
      this.analyticsGenerator.cancel()
    }

    // Dispose of JobManager (flushes pending progress updates)
    await this.jobManager.dispose()

    this.isInitialized = false

    logger.info('UnifiedBackfillService disposed', {
      component: 'UnifiedBackfillService',
      operation: 'dispose',
    })
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Execute a job asynchronously
   *
   * Starts job execution in the background. Updates job status
   * and progress as the job runs.
   *
   * @param job - The job to execute
   */
  private async executeJobAsync(job: BackfillJob): Promise<void> {
    this.activeJobId = job.jobId

    try {
      // Mark job as started
      await this.jobManager.startJob(job.jobId)

      logger.info('Starting job execution', {
        jobId: job.jobId,
        jobType: job.jobType,
        component: 'UnifiedBackfillService',
        operation: 'executeJobAsync',
      })

      let result: JobResult

      if (job.jobType === 'data-collection') {
        result = await this.executeDataCollectionJob(job)
      } else if (job.jobType === 'analytics-generation') {
        result = await this.executeAnalyticsGenerationJob(job)
      } else {
        throw new Error(`Unknown job type: ${job.jobType as string}`)
      }

      // Complete the job
      await this.jobManager.completeJob(job.jobId, result)

      logger.info('Job execution completed', {
        jobId: job.jobId,
        jobType: job.jobType,
        itemsProcessed: result.itemsProcessed,
        itemsFailed: result.itemsFailed,
        duration: result.duration,
        component: 'UnifiedBackfillService',
        operation: 'executeJobAsync',
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      logger.error('Job execution failed', {
        jobId: job.jobId,
        jobType: job.jobType,
        error: errorMessage,
        component: 'UnifiedBackfillService',
        operation: 'executeJobAsync',
      })

      // Mark job as failed
      await this.jobManager.failJob(job.jobId, errorMessage)
    } finally {
      this.activeJobId = null
    }
  }

  /**
   * Execute a data collection job
   *
   * @param job - The job to execute
   * @returns Job result
   */
  private async executeDataCollectionJob(job: BackfillJob): Promise<JobResult> {
    const startTime = Date.now()

    // Validate required configuration
    if (!job.config.startDate || !job.config.endDate) {
      throw new Error(
        'startDate and endDate are required for data-collection jobs'
      )
    }

    // Get completed items from checkpoint for skip-on-resume
    const completedItems = job.checkpoint?.itemsCompleted ?? []

    // Execute data collection
    const result = await this.dataCollector.collectForDateRange(
      job.config.startDate,
      job.config.endDate,
      {
        targetDistricts: job.config.targetDistricts,
        skipExisting: job.config.skipExisting ?? true,
        completedItems,
      },
      (progress: CollectionProgress) =>
        this.handleDataCollectionProgress(job.jobId, progress)
    )

    return {
      itemsProcessed: result.processedItems,
      itemsFailed: result.failedItems,
      itemsSkipped: result.skippedItems,
      snapshotIds: result.snapshotIds,
      duration: Date.now() - startTime,
    }
  }

  /**
   * Execute an analytics generation job
   *
   * @param job - The job to execute
   * @returns Job result
   */
  private async executeAnalyticsGenerationJob(
    job: BackfillJob
  ): Promise<JobResult> {
    const jobStartTime = Date.now()

    // Get snapshots to process
    const preview = await this.analyticsGenerator.previewGeneration(
      job.config.startDate,
      job.config.endDate
    )

    // Filter out already completed snapshots from checkpoint
    const completedSet = new Set(job.checkpoint?.itemsCompleted ?? [])
    const snapshotsToProcess = preview.snapshotIds.filter(
      id => !completedSet.has(id)
    )

    // Execute analytics generation
    const result = await this.analyticsGenerator.generateForSnapshots(
      snapshotsToProcess,
      (progress: GenerationProgress) =>
        this.handleAnalyticsGenerationProgress(job.jobId, progress)
    )

    return {
      itemsProcessed: result.processedItems,
      itemsFailed: result.failedItems,
      itemsSkipped: result.skippedItems + completedSet.size,
      snapshotIds: result.snapshotIds,
      duration: Date.now() - jobStartTime,
    }
  }

  /**
   * Handle progress updates from data collection
   *
   * @param jobId - The job identifier
   * @param progress - Collection progress
   */
  private async handleDataCollectionProgress(
    jobId: string,
    progress: CollectionProgress
  ): Promise<void> {
    // Update job progress
    await this.jobManager.updateProgress(jobId, {
      totalItems: progress.totalItems,
      processedItems: progress.processedItems,
      failedItems: progress.failedItems,
      skippedItems: progress.skippedItems,
      currentItem: progress.currentItem,
    })

    // Update checkpoint if we have a current item
    if (progress.currentItem && progress.processedItems > 0) {
      // Build list of completed items (dates that have been processed)
      // This is a simplified approach - in production you might want to track this more precisely
      const checkpoint: JobCheckpoint = {
        lastProcessedItem: progress.currentItem,
        lastProcessedAt: new Date().toISOString(),
        itemsCompleted: [], // Would need to track this from the collector
      }

      await this.jobManager.updateCheckpoint(jobId, checkpoint)
    }
  }

  /**
   * Handle progress updates from analytics generation
   *
   * @param jobId - The job identifier
   * @param progress - Generation progress
   */
  private async handleAnalyticsGenerationProgress(
    jobId: string,
    progress: GenerationProgress
  ): Promise<void> {
    // Update job progress
    await this.jobManager.updateProgress(jobId, {
      totalItems: progress.totalItems,
      processedItems: progress.processedItems,
      failedItems: progress.failedItems,
      skippedItems: progress.skippedItems,
      currentItem: progress.currentItem,
    })

    // Update checkpoint if we have a current item
    if (progress.currentItem && progress.processedItems > 0) {
      const checkpoint: JobCheckpoint = {
        lastProcessedItem: progress.currentItem,
        lastProcessedAt: new Date().toISOString(),
        itemsCompleted: [], // Would need to track this from the generator
      }

      await this.jobManager.updateCheckpoint(jobId, checkpoint)
    }
  }

  /**
   * Handle job resume from recovery
   *
   * This callback is called by RecoveryManager when resuming a job.
   * It re-executes the job from the checkpoint.
   *
   * @param job - The job to resume
   * @param checkpoint - The checkpoint to resume from (may be null)
   */
  private async handleJobResume(
    job: BackfillJob,
    checkpoint: JobCheckpoint | null
  ): Promise<void> {
    logger.info('Resuming job from recovery', {
      jobId: job.jobId,
      jobType: job.jobType,
      hasCheckpoint: checkpoint !== null,
      itemsCompleted: checkpoint?.itemsCompleted.length ?? 0,
      component: 'UnifiedBackfillService',
      operation: 'handleJobResume',
    })

    // Update job with checkpoint if provided
    const jobWithCheckpoint: BackfillJob = {
      ...job,
      checkpoint,
    }

    // Execute the job (this will handle the checkpoint internally)
    await this.executeJobAsync(jobWithCheckpoint)
  }
}
