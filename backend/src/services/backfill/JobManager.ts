/**
 * Job Manager for unified job lifecycle management with enhanced error handling
 *
 * Handles job creation, progress tracking, error tracking, and cleanup for backfill operations.
 */

import { v4 as uuidv4 } from 'uuid'
import { logger } from '../../utils/logger.js'
import { RetryOptions } from '../../utils/RetryManager.js'
import type {
  BackfillRequest,
  BackfillScope,
  BackfillJob,
  BackfillProgress,
  CollectionStrategy,
  DistrictError,
  PartialSnapshotResult,
} from './types.js'

export class JobManager {
  private jobs: Map<string, BackfillJob> = new Map()

  createJob(request: BackfillRequest, scope: BackfillScope): BackfillJob {
    const backfillId = uuidv4()

    // Create initial collection strategy (will be refined by DataSourceSelector)
    const initialStrategy: CollectionStrategy = {
      type: scope.scopeType === 'system-wide' ? 'system-wide' : 'targeted',
      refreshMethod: {
        name: 'getAllDistricts',
        params: {},
      },
      rationale: 'Initial strategy - will be refined',
      estimatedEfficiency: 0.5,
    }

    // Create retry configuration based on request preferences
    const retryConfig: RetryOptions = {
      maxAttempts: request.retryFailures !== false ? 3 : 1,
      baseDelayMs: 2000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
      retryableErrors: (error: Error) => {
        const message = error.message.toLowerCase()
        return (
          message.includes('network') ||
          message.includes('timeout') ||
          message.includes('econnreset') ||
          message.includes('enotfound') ||
          message.includes('econnrefused') ||
          message.includes('500') ||
          message.includes('502') ||
          message.includes('503') ||
          message.includes('504') ||
          message.includes('rate limit') ||
          message.includes('temporary')
        )
      },
    }

    const job: BackfillJob = {
      backfillId,
      status: 'processing',
      scope,
      progress: {
        total: 0, // Will be calculated after date range processing
        completed: 0,
        skipped: 0,
        unavailable: 0,
        failed: 0,
        current: request.startDate,
        districtProgress: new Map(),
        partialSnapshots: 0,
        totalErrors: 0,
        retryableErrors: 0,
        permanentErrors: 0,
      },
      collectionStrategy: initialStrategy,
      createdAt: Date.now(),
      snapshotIds: [],
      errorTrackers: new Map(),
      partialSnapshots: [],
      retryConfig,
    }

    this.jobs.set(backfillId, job)

    logger.info('Created backfill job with enhanced error tracking', {
      backfillId,
      scopeType: scope.scopeType,
      targetDistricts: scope.targetDistricts.length,
      configuredDistricts: scope.configuredDistricts.length,
      retryEnabled: request.retryFailures !== false,
      maxRetryAttempts: retryConfig.maxAttempts,
      operation: 'createJob',
    })

    return job
  }

  updateProgress(jobId: string, progress: Partial<BackfillProgress>): void {
    const job = this.jobs.get(jobId)
    if (job) {
      job.progress = { ...job.progress, ...progress }

      logger.debug('Updated job progress with enhanced tracking', {
        jobId,
        completed: job.progress.completed,
        total: job.progress.total,
        failed: job.progress.failed,
        totalErrors: job.progress.totalErrors,
        retryableErrors: job.progress.retryableErrors,
        permanentErrors: job.progress.permanentErrors,
        partialSnapshots: job.progress.partialSnapshots,
        current: job.progress.current,
        operation: 'updateProgress',
      })
    }
  }

  /**
   * Track district-level error with detailed context
   * Implements Requirement 6.2: Track district-specific errors with detailed context
   */
  trackDistrictError(
    jobId: string,
    districtId: string,
    error: Error,
    errorType: DistrictError['errorType'],
    context?: Record<string, unknown>
  ): void {
    const job = this.jobs.get(jobId)
    if (!job) return

    const timestamp = new Date().toISOString()
    const isRetryable = job.retryConfig.retryableErrors!(error)

    // Get or create error tracker for this district
    let errorTracker = job.errorTrackers.get(districtId)
    if (!errorTracker) {
      errorTracker = {
        districtId,
        errors: [],
        consecutiveFailures: 0,
        totalRetries: 0,
        isBlacklisted: false,
      }
      job.errorTrackers.set(districtId, errorTracker)
    }

    // Create detailed error record
    const districtError: DistrictError = {
      districtId,
      error: error.message,
      errorType,
      timestamp,
      retryCount: errorTracker.totalRetries,
      isRetryable,
      context,
    }

    // Update error tracker
    errorTracker.errors.push(districtError)
    errorTracker.consecutiveFailures++
    errorTracker.lastFailureAt = timestamp
    errorTracker.totalRetries++

    // Check if district should be blacklisted (Requirement 6.5: exponential backoff)
    if (errorTracker.consecutiveFailures >= 5) {
      errorTracker.isBlacklisted = true
      errorTracker.blacklistUntil = new Date(
        Date.now() + Math.pow(2, errorTracker.consecutiveFailures) * 60000
      ).toISOString()

      logger.warn('District blacklisted due to consecutive failures', {
        jobId,
        districtId,
        consecutiveFailures: errorTracker.consecutiveFailures,
        blacklistUntil: errorTracker.blacklistUntil,
        operation: 'trackDistrictError',
      })
    }

    // Update job progress counters
    job.progress.totalErrors++
    if (isRetryable) {
      job.progress.retryableErrors++
    } else {
      job.progress.permanentErrors++
    }

    // Update district progress
    const districtProgress = job.progress.districtProgress.get(districtId)
    if (districtProgress) {
      districtProgress.status = errorTracker.isBlacklisted
        ? 'blacklisted'
        : 'failed'
      districtProgress.lastError = error.message
      districtProgress.errorTracker = errorTracker
      districtProgress.retryCount = errorTracker.totalRetries
    }

    logger.error('District error tracked with detailed context', {
      jobId,
      districtId,
      errorType,
      error: error.message,
      isRetryable,
      consecutiveFailures: errorTracker.consecutiveFailures,
      totalRetries: errorTracker.totalRetries,
      isBlacklisted: errorTracker.isBlacklisted,
      context,
      operation: 'trackDistrictError',
    })
  }

  /**
   * Track district success and reset error counters
   */
  trackDistrictSuccess(jobId: string, districtId: string): void {
    const job = this.jobs.get(jobId)
    if (!job) return

    const errorTracker = job.errorTrackers.get(districtId)
    if (errorTracker) {
      errorTracker.consecutiveFailures = 0
      errorTracker.lastSuccessAt = new Date().toISOString()
      errorTracker.isBlacklisted = false
      errorTracker.blacklistUntil = undefined
    }

    // Update district progress
    const districtProgress = job.progress.districtProgress.get(districtId)
    if (districtProgress) {
      districtProgress.status = 'completed'
      districtProgress.lastError = undefined
    }

    logger.debug('District success tracked - error counters reset', {
      jobId,
      districtId,
      operation: 'trackDistrictSuccess',
    })
  }

  /**
   * Check if district is blacklisted and should be skipped
   */
  isDistrictBlacklisted(jobId: string, districtId: string): boolean {
    const job = this.jobs.get(jobId)
    if (!job) return false

    const errorTracker = job.errorTrackers.get(districtId)
    if (!errorTracker || !errorTracker.isBlacklisted) return false

    // Check if blacklist has expired
    if (errorTracker.blacklistUntil) {
      const blacklistExpiry = new Date(errorTracker.blacklistUntil)
      if (Date.now() > blacklistExpiry.getTime()) {
        errorTracker.isBlacklisted = false
        errorTracker.blacklistUntil = undefined
        logger.info('District blacklist expired - re-enabling', {
          jobId,
          districtId,
          operation: 'isDistrictBlacklisted',
        })
        return false
      }
    }

    return true
  }

  /**
   * Record partial snapshot creation
   * Implements Requirement 6.3: Create partial snapshots when some districts succeed and others fail
   */
  recordPartialSnapshot(
    jobId: string,
    partialSnapshot: PartialSnapshotResult
  ): void {
    const job = this.jobs.get(jobId)
    if (!job) return

    job.partialSnapshots.push(partialSnapshot)
    job.progress.partialSnapshots++

    logger.info('Partial snapshot recorded', {
      jobId,
      snapshotId: partialSnapshot.snapshotId,
      successfulDistricts: partialSnapshot.successfulDistricts.length,
      failedDistricts: partialSnapshot.failedDistricts.length,
      successRate: partialSnapshot.successRate,
      operation: 'recordPartialSnapshot',
    })
  }

  getJob(jobId: string): BackfillJob | null {
    return this.jobs.get(jobId) || null
  }

  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId)
    if (job && job.status === 'processing') {
      job.status = 'cancelled'
      job.error = 'Backfill cancelled by user'
      job.completedAt = Date.now()

      logger.info('Cancelled backfill job', {
        jobId,
        operation: 'cancelJob',
      })

      return true
    }
    return false
  }

  cleanupCompletedJobs(maxAge: number): void {
    const cutoffTime = Date.now() - maxAge
    const jobsToDelete: string[] = []

    for (const [jobId, job] of this.jobs.entries()) {
      if (job.createdAt < cutoffTime && job.status !== 'processing') {
        jobsToDelete.push(jobId)
      }
    }

    jobsToDelete.forEach(id => this.jobs.delete(id))

    if (jobsToDelete.length > 0) {
      logger.info('Cleaned up old backfill jobs', {
        count: jobsToDelete.length,
        operation: 'cleanupCompletedJobs',
      })
    }
  }
}
