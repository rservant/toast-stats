/**
 * Firestore Backfill Job Storage Implementation
 *
 * Implements the IBackfillJobStorage interface using Google Cloud Firestore
 * for storing backfill job data in a document database.
 *
 * Document Structure:
 * Collection: backfill-jobs
 * Document ID: {jobId}
 * {
 *   jobId: string,
 *   jobType: BackfillJobType,
 *   status: BackfillJobStatus,
 *   config: JobConfig,
 *   progress: JobProgress,
 *   checkpoint: JobCheckpoint | null,
 *   createdAt: string,
 *   startedAt: string | null,
 *   completedAt: string | null,
 *   resumedAt: string | null,
 *   result: JobResult | null,
 *   error: string | null
 * }
 *
 * Rate Limit Config:
 * Document: config/rate-limit
 * {
 *   maxRequestsPerMinute: number,
 *   maxConcurrent: number,
 *   minDelayMs: number,
 *   maxDelayMs: number,
 *   backoffMultiplier: number
 * }
 *
 * Requirements: 1.1, 1.5, 12.5
 */

import { Firestore, CollectionReference } from '@google-cloud/firestore'
import { logger } from '../../utils/logger.js'
import { CircuitBreaker } from '../../utils/CircuitBreaker.js'
import type {
  IBackfillJobStorage,
  BackfillJob,
  BackfillJobStatus,
  JobCheckpoint,
  RateLimitConfig,
  ListJobsOptions,
} from '../../types/storageInterfaces.js'
import { StorageOperationError } from '../../types/storageInterfaces.js'
import { isIndexError, extractIndexUrl } from './FirestoreSnapshotStorage.js'

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Configuration for FirestoreBackfillJobStorage
 */
export interface FirestoreBackfillJobStorageConfig {
  projectId: string
  collectionName?: string // defaults to 'backfill-jobs'
}

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default rate limit configuration
 *
 * Applied when no rate limit configuration exists in storage.
 * These values provide a conservative starting point that balances
 * backfill speed with system load.
 */
const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  maxRequestsPerMinute: 10,
  maxConcurrent: 3,
  minDelayMs: 2000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
}

// ============================================================================
// FirestoreBackfillJobStorage Implementation
// ============================================================================

/**
 * Cloud Firestore backfill job storage implementation
 *
 * Stores backfill jobs in Firestore with the following structure:
 * - Jobs stored in 'backfill-jobs' collection (configurable)
 * - Rate limit config stored in 'config/rate-limit' document
 * - Document IDs use job IDs for direct access
 *
 * Features:
 * - Circuit breaker integration for resilience
 * - Proper error handling with StorageOperationError
 * - Graceful initialization (creates defaults if missing)
 * - Jobs sorted by creation time (newest first) when listing
 * - Structured logging for all operations
 */
export class FirestoreBackfillJobStorage implements IBackfillJobStorage {
  private readonly firestore: Firestore
  private readonly collectionName: string
  private readonly rateLimitConfigPath = 'config/rate-limit'
  private readonly circuitBreaker: CircuitBreaker

  /**
   * Creates a new FirestoreBackfillJobStorage instance
   *
   * @param config - Configuration containing projectId and optional collectionName
   */
  constructor(config: FirestoreBackfillJobStorageConfig) {
    this.firestore = new Firestore({
      projectId: config.projectId,
    })
    this.collectionName = config.collectionName ?? 'backfill-jobs'
    this.circuitBreaker = CircuitBreaker.createCacheCircuitBreaker(
      'firestore-backfill-jobs'
    )

    logger.info('FirestoreBackfillJobStorage initialized', {
      operation: 'constructor',
      projectId: config.projectId,
      collectionName: this.collectionName,
      rateLimitConfigPath: this.rateLimitConfigPath,
      provider: 'firestore',
    })
  }

  /**
   * Get the jobs collection reference
   */
  private get jobsCollection(): CollectionReference {
    return this.firestore.collection(this.collectionName)
  }

  /**
   * Determine if an error is retryable (transient)
   *
   * Transient errors include network issues, timeouts, and server errors
   * that may succeed on retry.
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase()
      return (
        message.includes('network') ||
        message.includes('timeout') ||
        message.includes('unavailable') ||
        message.includes('deadline') ||
        message.includes('internal') ||
        message.includes('aborted') ||
        message.includes('resource_exhausted') ||
        message.includes('cancelled')
      )
    }
    return false
  }

  // ============================================================================
  // Job CRUD Operations
  // ============================================================================

  /**
   * Create a new backfill job
   *
   * Persists a new backfill job record. The job must have a unique jobId.
   * Throws an error if a job with the same ID already exists.
   *
   * @param job - The backfill job to create
   * @throws StorageOperationError if the job already exists or write fails
   */
  async createJob(job: BackfillJob): Promise<void> {
    const startTime = Date.now()

    logger.debug('Starting createJob operation', {
      operation: 'createJob',
      jobId: job.jobId,
      jobType: job.jobType,
      provider: 'firestore',
    })

    try {
      await this.circuitBreaker.execute(
        async () => {
          const docRef = this.jobsCollection.doc(job.jobId)
          const docSnapshot = await docRef.get()

          if (docSnapshot.exists) {
            throw new StorageOperationError(
              `Job with ID '${job.jobId}' already exists`,
              'createJob',
              'firestore',
              false
            )
          }

          // Convert job to Firestore-safe format (no undefined values)
          const jobData = this.toFirestoreDocument(job)
          await docRef.set(jobData)

          logger.info('Backfill job created', {
            operation: 'createJob',
            jobId: job.jobId,
            jobType: job.jobType,
            status: job.status,
            duration_ms: Date.now() - startTime,
            provider: 'firestore',
          })
        },
        { operation: 'createJob', jobId: job.jobId }
      )
    } catch (error) {
      if (error instanceof StorageOperationError) {
        throw error
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to create backfill job', {
        operation: 'createJob',
        jobId: job.jobId,
        error: errorMessage,
        duration_ms: Date.now() - startTime,
        provider: 'firestore',
      })

      throw new StorageOperationError(
        `Failed to create backfill job: ${errorMessage}`,
        'createJob',
        'firestore',
        this.isRetryableError(error),
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Get a backfill job by ID
   *
   * Retrieves a backfill job by its unique identifier.
   * Returns null if the job does not exist.
   *
   * @param jobId - The unique job identifier
   * @returns The backfill job or null if not found
   * @throws StorageOperationError on read failure
   */
  async getJob(jobId: string): Promise<BackfillJob | null> {
    const startTime = Date.now()

    logger.debug('Starting getJob operation', {
      operation: 'getJob',
      jobId,
      provider: 'firestore',
    })

    try {
      return await this.circuitBreaker.execute(
        async () => {
          const docRef = this.jobsCollection.doc(jobId)
          const docSnapshot = await docRef.get()

          if (!docSnapshot.exists) {
            logger.debug('Job not found', {
              operation: 'getJob',
              jobId,
              duration_ms: Date.now() - startTime,
              provider: 'firestore',
            })
            return null
          }

          const data = docSnapshot.data()
          if (!data || !this.isValidJobStructure(data)) {
            logger.warn('Invalid job structure in Firestore', {
              operation: 'getJob',
              jobId,
              duration_ms: Date.now() - startTime,
              provider: 'firestore',
            })
            return null
          }

          const job = this.fromFirestoreDocument(data)

          logger.debug('Backfill job retrieved', {
            operation: 'getJob',
            jobId,
            jobType: job.jobType,
            status: job.status,
            duration_ms: Date.now() - startTime,
            provider: 'firestore',
          })

          return job
        },
        { operation: 'getJob', jobId }
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to get backfill job', {
        operation: 'getJob',
        jobId,
        error: errorMessage,
        duration_ms: Date.now() - startTime,
        provider: 'firestore',
      })

      throw new StorageOperationError(
        `Failed to get backfill job: ${errorMessage}`,
        'getJob',
        'firestore',
        this.isRetryableError(error),
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Update an existing backfill job
   *
   * Partially updates a backfill job with the provided fields.
   * Only the specified fields are updated; other fields remain unchanged.
   * Throws an error if the job does not exist.
   *
   * @param jobId - The unique job identifier
   * @param updates - Partial job data to merge with existing job
   * @throws StorageOperationError if the job doesn't exist or update fails
   */
  async updateJob(jobId: string, updates: Partial<BackfillJob>): Promise<void> {
    const startTime = Date.now()

    logger.debug('Starting updateJob operation', {
      operation: 'updateJob',
      jobId,
      updatedFields: Object.keys(updates),
      provider: 'firestore',
    })

    try {
      await this.circuitBreaker.execute(
        async () => {
          const docRef = this.jobsCollection.doc(jobId)
          const docSnapshot = await docRef.get()

          if (!docSnapshot.exists) {
            throw new StorageOperationError(
              `Job with ID '${jobId}' not found`,
              'updateJob',
              'firestore',
              false
            )
          }

          // Convert updates to Firestore-safe format
          const updateData = this.toFirestorePartialUpdate(updates)
          await docRef.update(updateData)

          logger.debug('Backfill job updated', {
            operation: 'updateJob',
            jobId,
            updatedFields: Object.keys(updates),
            duration_ms: Date.now() - startTime,
            provider: 'firestore',
          })
        },
        { operation: 'updateJob', jobId }
      )
    } catch (error) {
      if (error instanceof StorageOperationError) {
        throw error
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to update backfill job', {
        operation: 'updateJob',
        jobId,
        error: errorMessage,
        duration_ms: Date.now() - startTime,
        provider: 'firestore',
      })

      throw new StorageOperationError(
        `Failed to update backfill job: ${errorMessage}`,
        'updateJob',
        'firestore',
        this.isRetryableError(error),
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Delete a backfill job
   *
   * Removes a backfill job and all its associated data.
   * Returns true if the job was deleted, false if it didn't exist.
   *
   * @param jobId - The unique job identifier
   * @returns true if deleted, false if job didn't exist
   * @throws StorageOperationError on deletion failure
   */
  async deleteJob(jobId: string): Promise<boolean> {
    const startTime = Date.now()

    logger.debug('Starting deleteJob operation', {
      operation: 'deleteJob',
      jobId,
      provider: 'firestore',
    })

    try {
      return await this.circuitBreaker.execute(
        async () => {
          const docRef = this.jobsCollection.doc(jobId)
          const docSnapshot = await docRef.get()

          if (!docSnapshot.exists) {
            logger.debug('Job not found for deletion', {
              operation: 'deleteJob',
              jobId,
              duration_ms: Date.now() - startTime,
              provider: 'firestore',
            })
            return false
          }

          await docRef.delete()

          logger.info('Backfill job deleted', {
            operation: 'deleteJob',
            jobId,
            duration_ms: Date.now() - startTime,
            provider: 'firestore',
          })

          return true
        },
        { operation: 'deleteJob', jobId }
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to delete backfill job', {
        operation: 'deleteJob',
        jobId,
        error: errorMessage,
        duration_ms: Date.now() - startTime,
        provider: 'firestore',
      })

      throw new StorageOperationError(
        `Failed to delete backfill job: ${errorMessage}`,
        'deleteJob',
        'firestore',
        this.isRetryableError(error),
        error instanceof Error ? error : undefined
      )
    }
  }

  // ============================================================================
  // Job Queries
  // ============================================================================

  /**
   * List backfill jobs with optional filtering and pagination
   *
   * Returns backfill jobs matching the specified criteria.
   * Results are sorted by creation time (newest first).
   *
   * @param options - Optional filtering and pagination options
   * @returns Array of backfill jobs sorted by creation time (newest first)
   * @throws StorageOperationError on read failure
   */
  async listJobs(options?: ListJobsOptions): Promise<BackfillJob[]> {
    const startTime = Date.now()

    logger.debug('Starting listJobs operation', {
      operation: 'listJobs',
      options,
      provider: 'firestore',
    })

    try {
      return await this.circuitBreaker.execute(
        async () => {
          // Start with base query ordered by createdAt descending
          let query = this.jobsCollection.orderBy('createdAt', 'desc')

          // Apply status filter if provided
          if (options?.status && options.status.length > 0) {
            query = query.where('status', 'in', options.status)
          }

          // Apply jobType filter if provided
          if (options?.jobType && options.jobType.length > 0) {
            query = query.where('jobType', 'in', options.jobType)
          }

          const querySnapshot = await query.get()

          let jobs: BackfillJob[] = []

          for (const doc of querySnapshot.docs) {
            const data = doc.data()
            if (this.isValidJobStructure(data)) {
              jobs.push(this.fromFirestoreDocument(data))
            } else {
              logger.warn('Skipping invalid job document', {
                operation: 'listJobs',
                docId: doc.id,
                provider: 'firestore',
              })
            }
          }

          // Apply date filters (client-side since Firestore has query limitations)
          if (options?.startDateFrom) {
            jobs = jobs.filter(job => job.createdAt >= options.startDateFrom!)
          }
          if (options?.startDateTo) {
            jobs = jobs.filter(job => job.createdAt <= options.startDateTo!)
          }

          // Apply pagination
          const offset = options?.offset ?? 0
          const limit = options?.limit ?? jobs.length
          const paginatedJobs = jobs.slice(offset, offset + limit)

          logger.debug('Jobs listed', {
            operation: 'listJobs',
            totalJobs: querySnapshot.size,
            filteredJobs: jobs.length,
            returnedJobs: paginatedJobs.length,
            offset,
            limit,
            duration_ms: Date.now() - startTime,
            provider: 'firestore',
          })

          return paginatedJobs
        },
        { operation: 'listJobs' }
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      // Handle index errors gracefully
      if (isIndexError(error)) {
        const indexUrl = error instanceof Error ? extractIndexUrl(error) : null
        logger.warn('Firestore query failed due to missing index', {
          operation: 'listJobs',
          error: errorMessage,
          indexUrl,
          recommendation:
            'Deploy indexes using: firebase deploy --only firestore:indexes',
          provider: 'firestore',
        })
        return []
      }

      logger.error('Failed to list backfill jobs', {
        operation: 'listJobs',
        error: errorMessage,
        duration_ms: Date.now() - startTime,
        provider: 'firestore',
      })

      throw new StorageOperationError(
        `Failed to list backfill jobs: ${errorMessage}`,
        'listJobs',
        'firestore',
        this.isRetryableError(error),
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Get the currently active (running or recovering) job
   *
   * Returns the job that is currently running or being recovered.
   * Returns null if no job is active. Used for one-job-at-a-time enforcement.
   *
   * @returns The active job or null if none is active
   * @throws StorageOperationError on read failure
   */
  async getActiveJob(): Promise<BackfillJob | null> {
    const startTime = Date.now()

    logger.debug('Starting getActiveJob operation', {
      operation: 'getActiveJob',
      provider: 'firestore',
    })

    try {
      const activeStatuses: BackfillJobStatus[] = ['running', 'recovering']
      const activeJobs = await this.getJobsByStatus(activeStatuses)

      if (activeJobs.length === 0) {
        logger.debug('No active job found', {
          operation: 'getActiveJob',
          duration_ms: Date.now() - startTime,
          provider: 'firestore',
        })
        return null
      }

      // Return the most recently created active job
      const activeJob = activeJobs[0] ?? null

      if (activeJob) {
        logger.debug('Active job found', {
          operation: 'getActiveJob',
          jobId: activeJob.jobId,
          status: activeJob.status,
          duration_ms: Date.now() - startTime,
          provider: 'firestore',
        })
      }

      return activeJob
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to get active job', {
        operation: 'getActiveJob',
        error: errorMessage,
        duration_ms: Date.now() - startTime,
        provider: 'firestore',
      })

      throw new StorageOperationError(
        `Failed to get active job: ${errorMessage}`,
        'getActiveJob',
        'firestore',
        this.isRetryableError(error),
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Get jobs by status
   *
   * Returns all jobs matching any of the specified statuses.
   * Results are sorted by creation time (newest first).
   *
   * @param status - Array of statuses to filter by
   * @returns Array of matching jobs sorted by creation time (newest first)
   * @throws StorageOperationError on read failure
   */
  async getJobsByStatus(status: BackfillJobStatus[]): Promise<BackfillJob[]> {
    return this.listJobs({ status })
  }

  // ============================================================================
  // Checkpoint Operations
  // ============================================================================

  /**
   * Update the checkpoint for a job
   *
   * Saves checkpoint information for job recovery. The checkpoint is
   * stored as part of the job record and can be retrieved with getCheckpoint.
   *
   * @param jobId - The unique job identifier
   * @param checkpoint - The checkpoint data to save
   * @throws StorageOperationError if the job doesn't exist or update fails
   */
  async updateCheckpoint(
    jobId: string,
    checkpoint: JobCheckpoint
  ): Promise<void> {
    await this.updateJob(jobId, { checkpoint })

    logger.debug('Checkpoint updated', {
      operation: 'updateCheckpoint',
      jobId,
      lastProcessedItem: checkpoint.lastProcessedItem,
      itemsCompleted: checkpoint.itemsCompleted.length,
      provider: 'firestore',
    })
  }

  /**
   * Get the checkpoint for a job
   *
   * Retrieves the most recent checkpoint for a job.
   * Returns null if no checkpoint exists.
   *
   * @param jobId - The unique job identifier
   * @returns The checkpoint or null if not found
   * @throws StorageOperationError on read failure
   */
  async getCheckpoint(jobId: string): Promise<JobCheckpoint | null> {
    const job = await this.getJob(jobId)
    return job?.checkpoint ?? null
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  /**
   * Get the rate limit configuration
   *
   * Retrieves the global rate limit configuration for backfill operations.
   * Returns default configuration if none has been set.
   *
   * @returns The rate limit configuration
   * @throws StorageOperationError on read failure
   */
  async getRateLimitConfig(): Promise<RateLimitConfig> {
    const startTime = Date.now()

    logger.debug('Starting getRateLimitConfig operation', {
      operation: 'getRateLimitConfig',
      configPath: this.rateLimitConfigPath,
      provider: 'firestore',
    })

    try {
      return await this.circuitBreaker.execute(
        async () => {
          const docRef = this.firestore.doc(this.rateLimitConfigPath)
          const docSnapshot = await docRef.get()

          if (!docSnapshot.exists) {
            // Config doesn't exist - create with defaults
            logger.info('Rate limit config not found, creating with defaults', {
              operation: 'getRateLimitConfig',
              configPath: this.rateLimitConfigPath,
              provider: 'firestore',
            })

            await this.setRateLimitConfig(DEFAULT_RATE_LIMIT_CONFIG)
            return { ...DEFAULT_RATE_LIMIT_CONFIG }
          }

          const data = docSnapshot.data()
          if (!data || !this.isValidRateLimitConfig(data)) {
            logger.warn(
              'Invalid rate limit config structure, returning defaults',
              {
                operation: 'getRateLimitConfig',
                configPath: this.rateLimitConfigPath,
                duration_ms: Date.now() - startTime,
                provider: 'firestore',
              }
            )
            return { ...DEFAULT_RATE_LIMIT_CONFIG }
          }

          const config: RateLimitConfig = {
            maxRequestsPerMinute: data['maxRequestsPerMinute'] as number,
            maxConcurrent: data['maxConcurrent'] as number,
            minDelayMs: data['minDelayMs'] as number,
            maxDelayMs: data['maxDelayMs'] as number,
            backoffMultiplier: data['backoffMultiplier'] as number,
          }

          logger.debug('Rate limit config retrieved', {
            operation: 'getRateLimitConfig',
            config,
            duration_ms: Date.now() - startTime,
            provider: 'firestore',
          })

          return config
        },
        { operation: 'getRateLimitConfig' }
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to get rate limit config', {
        operation: 'getRateLimitConfig',
        error: errorMessage,
        duration_ms: Date.now() - startTime,
        provider: 'firestore',
      })

      throw new StorageOperationError(
        `Failed to get rate limit config: ${errorMessage}`,
        'getRateLimitConfig',
        'firestore',
        this.isRetryableError(error),
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Set the rate limit configuration
   *
   * Persists the global rate limit configuration for backfill operations.
   * Overwrites any existing configuration.
   *
   * @param config - The rate limit configuration to save
   * @throws StorageOperationError on write failure
   */
  async setRateLimitConfig(config: RateLimitConfig): Promise<void> {
    const startTime = Date.now()

    logger.debug('Starting setRateLimitConfig operation', {
      operation: 'setRateLimitConfig',
      configPath: this.rateLimitConfigPath,
      config,
      provider: 'firestore',
    })

    try {
      await this.circuitBreaker.execute(
        async () => {
          const docRef = this.firestore.doc(this.rateLimitConfigPath)
          await docRef.set({
            maxRequestsPerMinute: config.maxRequestsPerMinute,
            maxConcurrent: config.maxConcurrent,
            minDelayMs: config.minDelayMs,
            maxDelayMs: config.maxDelayMs,
            backoffMultiplier: config.backoffMultiplier,
          })

          logger.info('Rate limit config saved', {
            operation: 'setRateLimitConfig',
            config,
            duration_ms: Date.now() - startTime,
            provider: 'firestore',
          })
        },
        { operation: 'setRateLimitConfig' }
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to save rate limit config', {
        operation: 'setRateLimitConfig',
        error: errorMessage,
        duration_ms: Date.now() - startTime,
        provider: 'firestore',
      })

      throw new StorageOperationError(
        `Failed to save rate limit config: ${errorMessage}`,
        'setRateLimitConfig',
        'firestore',
        this.isRetryableError(error),
        error instanceof Error ? error : undefined
      )
    }
  }

  // ============================================================================
  // Maintenance
  // ============================================================================

  /**
   * Clean up old completed/failed jobs
   *
   * Removes jobs older than the specified retention period.
   * Only removes jobs with terminal status (completed, failed, cancelled).
   * Running and pending jobs are never removed.
   *
   * @param retentionDays - Number of days to retain jobs
   * @returns Number of jobs removed
   * @throws StorageOperationError on deletion failure
   */
  async cleanupOldJobs(retentionDays: number): Promise<number> {
    const startTime = Date.now()

    logger.debug('Starting cleanupOldJobs operation', {
      operation: 'cleanupOldJobs',
      retentionDays,
      provider: 'firestore',
    })

    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays)
      const cutoffTimestamp = cutoffDate.toISOString()

      const terminalStatuses: BackfillJobStatus[] = [
        'completed',
        'failed',
        'cancelled',
      ]
      const jobs = await this.listJobs({ status: terminalStatuses })

      let deletedCount = 0

      for (const job of jobs) {
        // Use completedAt if available, otherwise use createdAt
        const jobTimestamp = job.completedAt ?? job.createdAt

        if (jobTimestamp < cutoffTimestamp) {
          const deleted = await this.deleteJob(job.jobId)
          if (deleted) {
            deletedCount++
          }
        }
      }

      logger.info('Old jobs cleaned up', {
        operation: 'cleanupOldJobs',
        retentionDays,
        cutoffTimestamp,
        deletedCount,
        duration_ms: Date.now() - startTime,
        provider: 'firestore',
      })

      return deletedCount
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to cleanup old jobs', {
        operation: 'cleanupOldJobs',
        retentionDays,
        error: errorMessage,
        duration_ms: Date.now() - startTime,
        provider: 'firestore',
      })

      throw new StorageOperationError(
        `Failed to cleanup old jobs: ${errorMessage}`,
        'cleanupOldJobs',
        'firestore',
        this.isRetryableError(error),
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Check if the storage is properly initialized and accessible
   *
   * Verifies that the storage backend is ready for operations. This may
   * include checking directory existence, database connectivity, or
   * authentication status. Returns false without throwing when storage
   * is unavailable.
   *
   * @returns True if the storage is ready for operations
   */
  async isReady(): Promise<boolean> {
    try {
      // Attempt a simple read operation to verify connectivity
      const docRef = this.firestore.doc(this.rateLimitConfigPath)
      await docRef.get()

      logger.debug('Storage ready check passed', {
        operation: 'isReady',
        collectionName: this.collectionName,
        provider: 'firestore',
      })

      return true
    } catch (error) {
      logger.warn('Storage ready check failed', {
        operation: 'isReady',
        collectionName: this.collectionName,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: 'firestore',
      })

      return false
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Convert a BackfillJob to a Firestore-safe document
   *
   * Firestore doesn't accept undefined values, so we need to convert
   * the job to a format that only includes defined values.
   *
   * @param job - The job to convert
   * @returns A Firestore-safe document object
   */
  private toFirestoreDocument(job: BackfillJob): Record<string, unknown> {
    const doc: Record<string, unknown> = {
      jobId: job.jobId,
      jobType: job.jobType,
      status: job.status,
      config: this.cleanObject(job.config),
      progress: this.cleanObject(job.progress),
      createdAt: job.createdAt,
    }

    // Only include optional fields if they have values
    if (job.checkpoint !== null) {
      doc['checkpoint'] = this.cleanObject(job.checkpoint)
    }
    if (job.startedAt !== null) {
      doc['startedAt'] = job.startedAt
    }
    if (job.completedAt !== null) {
      doc['completedAt'] = job.completedAt
    }
    if (job.resumedAt !== null) {
      doc['resumedAt'] = job.resumedAt
    }
    if (job.result !== null) {
      doc['result'] = this.cleanObject(job.result)
    }
    if (job.error !== null) {
      doc['error'] = job.error
    }

    return doc
  }

  /**
   * Convert partial updates to Firestore-safe format
   *
   * @param updates - Partial job updates
   * @returns Firestore-safe update object
   */
  private toFirestorePartialUpdate(
    updates: Partial<BackfillJob>
  ): Record<string, unknown> {
    const doc: Record<string, unknown> = {}

    if (updates.status !== undefined) {
      doc['status'] = updates.status
    }
    if (updates.config !== undefined) {
      doc['config'] = this.cleanObject(updates.config)
    }
    if (updates.progress !== undefined) {
      doc['progress'] = this.cleanObject(updates.progress)
    }
    if (updates.checkpoint !== undefined) {
      doc['checkpoint'] =
        updates.checkpoint !== null
          ? this.cleanObject(updates.checkpoint)
          : null
    }
    if (updates.startedAt !== undefined) {
      doc['startedAt'] = updates.startedAt
    }
    if (updates.completedAt !== undefined) {
      doc['completedAt'] = updates.completedAt
    }
    if (updates.resumedAt !== undefined) {
      doc['resumedAt'] = updates.resumedAt
    }
    if (updates.result !== undefined) {
      doc['result'] =
        updates.result !== null ? this.cleanObject(updates.result) : null
    }
    if (updates.error !== undefined) {
      doc['error'] = updates.error
    }

    return doc
  }

  /**
   * Convert a Firestore document to a BackfillJob
   *
   * @param data - The Firestore document data
   * @returns A BackfillJob object
   */
  private fromFirestoreDocument(data: Record<string, unknown>): BackfillJob {
    const progress = data['progress'] as Record<string, unknown>

    return {
      jobId: data['jobId'] as string,
      jobType: data['jobType'] as BackfillJob['jobType'],
      status: data['status'] as BackfillJob['status'],
      config: data['config'] as BackfillJob['config'],
      progress: {
        totalItems: progress['totalItems'] as number,
        processedItems: progress['processedItems'] as number,
        failedItems: progress['failedItems'] as number,
        skippedItems: progress['skippedItems'] as number,
        currentItem: (progress['currentItem'] as string | null) ?? null,
        districtProgress:
          (progress['districtProgress'] as Record<
            string,
            BackfillJob['progress']['districtProgress'][string]
          >) ?? {},
        errors: (progress['errors'] as BackfillJob['progress']['errors']) ?? [],
      },
      checkpoint: (data['checkpoint'] as BackfillJob['checkpoint']) ?? null,
      createdAt: data['createdAt'] as string,
      startedAt: (data['startedAt'] as string | null) ?? null,
      completedAt: (data['completedAt'] as string | null) ?? null,
      resumedAt: (data['resumedAt'] as string | null) ?? null,
      result: (data['result'] as BackfillJob['result']) ?? null,
      error: (data['error'] as string | null) ?? null,
    }
  }

  /**
   * Remove undefined values from an object recursively
   *
   * Firestore doesn't accept undefined values, so we need to clean
   * objects before storing them.
   *
   * @param obj - The object to clean
   * @returns A new object without undefined values
   */
  private cleanObject(obj: object): Record<string, unknown> {
    const cleaned: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined) {
        continue
      }
      if (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value)
      ) {
        cleaned[key] = this.cleanObject(value as object)
      } else {
        cleaned[key] = value
      }
    }

    return cleaned
  }

  /**
   * Validate job object structure
   *
   * Checks that the job has all required fields with correct types.
   *
   * @param data - The data object to validate
   * @returns True if the job structure is valid
   */
  private isValidJobStructure(
    data: Record<string, unknown>
  ): data is Record<string, unknown> {
    // Check required string fields
    if (typeof data['jobId'] !== 'string') return false
    if (typeof data['createdAt'] !== 'string') return false

    // Check jobType
    if (
      data['jobType'] !== 'data-collection' &&
      data['jobType'] !== 'analytics-generation'
    ) {
      return false
    }

    // Check status
    const validStatuses: BackfillJobStatus[] = [
      'pending',
      'running',
      'completed',
      'failed',
      'cancelled',
      'recovering',
    ]
    if (!validStatuses.includes(data['status'] as BackfillJobStatus)) {
      return false
    }

    // Check config object exists
    if (!data['config'] || typeof data['config'] !== 'object') return false

    // Check progress object exists and has required fields
    if (!data['progress'] || typeof data['progress'] !== 'object') return false
    const progress = data['progress'] as Record<string, unknown>
    if (typeof progress['totalItems'] !== 'number') return false
    if (typeof progress['processedItems'] !== 'number') return false
    if (typeof progress['failedItems'] !== 'number') return false
    if (typeof progress['skippedItems'] !== 'number') return false

    return true
  }

  /**
   * Validate rate limit config structure
   *
   * Checks that the config has all required fields with correct types.
   *
   * @param data - The data object to validate
   * @returns True if the config structure is valid
   */
  private isValidRateLimitConfig(
    data: Record<string, unknown>
  ): data is Record<string, unknown> {
    return (
      typeof data['maxRequestsPerMinute'] === 'number' &&
      typeof data['maxConcurrent'] === 'number' &&
      typeof data['minDelayMs'] === 'number' &&
      typeof data['maxDelayMs'] === 'number' &&
      typeof data['backoffMultiplier'] === 'number'
    )
  }
}
