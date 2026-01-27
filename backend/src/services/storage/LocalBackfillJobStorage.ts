/**
 * Local Filesystem Backfill Job Storage
 *
 * Implements the IBackfillJobStorage interface for local filesystem storage.
 * This implementation stores backfill jobs as individual JSON files and
 * maintains a separate rate limit configuration file.
 *
 * Features:
 * - Atomic file writes using temp file + rename pattern
 * - Automatic directory creation on initialization
 * - Default rate limit configuration if none exists
 * - Jobs sorted by creation time (newest first)
 * - Graceful initialization (creates directories/defaults if missing)
 *
 * Storage Structure:
 * - {cacheDir}/backfill-jobs/
 *   - {jobId}.json - Individual job files
 *   - rate-limit-config.json - Rate limit configuration
 *
 * Requirements: 1.1, 1.2, 1.5, 12.5
 */

import fs from 'fs/promises'
import path from 'path'
import type {
  IBackfillJobStorage,
  BackfillJob,
  BackfillJobStatus,
  JobCheckpoint,
  RateLimitConfig,
  ListJobsOptions,
} from '../../types/storageInterfaces.js'
import { StorageOperationError } from '../../types/storageInterfaces.js'
import { logger } from '../../utils/logger.js'

/**
 * Type for Node.js error objects with code property
 */
interface NodeError extends Error {
  code?: string
}

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

/**
 * Local filesystem backfill job storage implementation
 *
 * Stores backfill jobs in `{cacheDir}/backfill-jobs/` directory with
 * each job as a separate JSON file named `{jobId}.json`.
 *
 * This implementation:
 * - Uses atomic file writes (temp file + rename) for data integrity
 * - Creates directories automatically if they don't exist
 * - Provides default rate limit configuration if none exists
 * - Sorts jobs by creation time (newest first) when listing
 * - Provides structured logging for all operations
 *
 * @example
 * ```typescript
 * const storage = new LocalBackfillJobStorage('./cache')
 * await storage.createJob(job)
 * const retrievedJob = await storage.getJob(job.jobId)
 * ```
 */
export class LocalBackfillJobStorage implements IBackfillJobStorage {
  private readonly jobsDir: string
  private readonly rateLimitConfigPath: string

  /**
   * Creates a new LocalBackfillJobStorage instance
   *
   * @param cacheDir - Base directory for cache storage (e.g., './cache')
   */
  constructor(cacheDir: string) {
    this.jobsDir = path.join(cacheDir, 'backfill-jobs')
    this.rateLimitConfigPath = path.join(this.jobsDir, 'rate-limit-config.json')

    logger.debug('LocalBackfillJobStorage initialized', {
      jobsDir: this.jobsDir,
      rateLimitConfigPath: this.rateLimitConfigPath,
      provider: 'local',
    })
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
    try {
      await this.ensureJobsDirectory()

      const jobFilePath = this.getJobFilePath(job.jobId)

      // Check if job already exists
      const existingJob = await this.getJob(job.jobId)
      if (existingJob !== null) {
        throw new StorageOperationError(
          `Job with ID '${job.jobId}' already exists`,
          'createJob',
          'local',
          false
        )
      }

      // Write job file atomically
      await this.writeJobFile(jobFilePath, job)

      logger.info('Backfill job created', {
        jobId: job.jobId,
        jobType: job.jobType,
        status: job.status,
        provider: 'local',
        operation: 'createJob',
      })
    } catch (error) {
      if (error instanceof StorageOperationError) {
        throw error
      }

      logger.error('Failed to create backfill job', {
        jobId: job.jobId,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: 'local',
        operation: 'createJob',
      })

      throw new StorageOperationError(
        `Failed to create backfill job: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'createJob',
        'local',
        false,
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
    try {
      const jobFilePath = this.getJobFilePath(jobId)
      const jobData = await fs.readFile(jobFilePath, 'utf-8')
      const job = JSON.parse(jobData) as unknown

      if (!this.isValidJobStructure(job)) {
        logger.warn('Invalid job structure in file', {
          jobId,
          jobFilePath,
          provider: 'local',
          operation: 'getJob',
        })
        return null
      }

      logger.debug('Backfill job retrieved', {
        jobId,
        jobType: job.jobType,
        status: job.status,
        provider: 'local',
        operation: 'getJob',
      })

      return job
    } catch (error) {
      if ((error as NodeError).code === 'ENOENT') {
        logger.debug('Job file not found', {
          jobId,
          provider: 'local',
          operation: 'getJob',
        })
        return null
      }

      logger.error('Failed to read backfill job', {
        jobId,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: 'local',
        operation: 'getJob',
      })

      throw new StorageOperationError(
        `Failed to read backfill job: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'getJob',
        'local',
        false,
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
    try {
      const existingJob = await this.getJob(jobId)
      if (existingJob === null) {
        throw new StorageOperationError(
          `Job with ID '${jobId}' not found`,
          'updateJob',
          'local',
          false
        )
      }

      // Merge updates with existing job
      const updatedJob: BackfillJob = {
        ...existingJob,
        ...updates,
        // Ensure jobId cannot be changed
        jobId: existingJob.jobId,
      }

      const jobFilePath = this.getJobFilePath(jobId)
      await this.writeJobFile(jobFilePath, updatedJob)

      logger.debug('Backfill job updated', {
        jobId,
        updatedFields: Object.keys(updates),
        provider: 'local',
        operation: 'updateJob',
      })
    } catch (error) {
      if (error instanceof StorageOperationError) {
        throw error
      }

      logger.error('Failed to update backfill job', {
        jobId,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: 'local',
        operation: 'updateJob',
      })

      throw new StorageOperationError(
        `Failed to update backfill job: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'updateJob',
        'local',
        false,
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
    try {
      const jobFilePath = this.getJobFilePath(jobId)

      // Check if job exists
      const existingJob = await this.getJob(jobId)
      if (existingJob === null) {
        logger.debug('Job not found for deletion', {
          jobId,
          provider: 'local',
          operation: 'deleteJob',
        })
        return false
      }

      await fs.unlink(jobFilePath)

      logger.info('Backfill job deleted', {
        jobId,
        provider: 'local',
        operation: 'deleteJob',
      })

      return true
    } catch (error) {
      if ((error as NodeError).code === 'ENOENT') {
        return false
      }

      logger.error('Failed to delete backfill job', {
        jobId,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: 'local',
        operation: 'deleteJob',
      })

      throw new StorageOperationError(
        `Failed to delete backfill job: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'deleteJob',
        'local',
        false,
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
    try {
      await this.ensureJobsDirectory()

      const files = await fs.readdir(this.jobsDir)
      const jobFiles = files.filter(
        file => file.endsWith('.json') && file !== 'rate-limit-config.json'
      )

      const jobs: BackfillJob[] = []

      for (const file of jobFiles) {
        try {
          const jobFilePath = path.join(this.jobsDir, file)
          const jobData = await fs.readFile(jobFilePath, 'utf-8')
          const job = JSON.parse(jobData) as unknown

          if (this.isValidJobStructure(job)) {
            jobs.push(job)
          } else {
            logger.warn('Skipping invalid job file', {
              file,
              provider: 'local',
              operation: 'listJobs',
            })
          }
        } catch (parseError) {
          logger.warn('Failed to parse job file', {
            file,
            error:
              parseError instanceof Error
                ? parseError.message
                : 'Unknown error',
            provider: 'local',
            operation: 'listJobs',
          })
        }
      }

      // Apply filters
      let filteredJobs = jobs

      if (options?.status && options.status.length > 0) {
        filteredJobs = filteredJobs.filter(job =>
          options.status?.includes(job.status)
        )
      }

      if (options?.jobType && options.jobType.length > 0) {
        filteredJobs = filteredJobs.filter(job =>
          options.jobType?.includes(job.jobType)
        )
      }

      if (options?.startDateFrom) {
        filteredJobs = filteredJobs.filter(
          job => job.createdAt >= options.startDateFrom!
        )
      }

      if (options?.startDateTo) {
        filteredJobs = filteredJobs.filter(
          job => job.createdAt <= options.startDateTo!
        )
      }

      // Sort by creation time (newest first)
      filteredJobs.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )

      // Apply pagination
      const offset = options?.offset ?? 0
      const limit = options?.limit ?? filteredJobs.length

      const paginatedJobs = filteredJobs.slice(offset, offset + limit)

      logger.debug('Jobs listed', {
        totalJobs: jobs.length,
        filteredJobs: filteredJobs.length,
        returnedJobs: paginatedJobs.length,
        offset,
        limit,
        provider: 'local',
        operation: 'listJobs',
      })

      return paginatedJobs
    } catch (error) {
      logger.error('Failed to list backfill jobs', {
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: 'local',
        operation: 'listJobs',
      })

      throw new StorageOperationError(
        `Failed to list backfill jobs: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'listJobs',
        'local',
        false,
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
    try {
      const activeStatuses: BackfillJobStatus[] = ['running', 'recovering']
      const activeJobs = await this.getJobsByStatus(activeStatuses)

      if (activeJobs.length === 0) {
        return null
      }

      // Return the most recently created active job
      return activeJobs[0] ?? null
    } catch (error) {
      logger.error('Failed to get active job', {
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: 'local',
        operation: 'getActiveJob',
      })

      throw new StorageOperationError(
        `Failed to get active job: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'getActiveJob',
        'local',
        false,
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
      jobId,
      lastProcessedItem: checkpoint.lastProcessedItem,
      itemsCompleted: checkpoint.itemsCompleted.length,
      provider: 'local',
      operation: 'updateCheckpoint',
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
    try {
      await this.ensureJobsDirectory()

      const configData = await fs.readFile(this.rateLimitConfigPath, 'utf-8')
      const config = JSON.parse(configData) as unknown

      if (!this.isValidRateLimitConfig(config)) {
        logger.warn('Invalid rate limit config structure, returning defaults', {
          rateLimitConfigPath: this.rateLimitConfigPath,
          provider: 'local',
          operation: 'getRateLimitConfig',
        })
        return { ...DEFAULT_RATE_LIMIT_CONFIG }
      }

      logger.debug('Rate limit config retrieved', {
        config,
        provider: 'local',
        operation: 'getRateLimitConfig',
      })

      return config
    } catch (error) {
      if ((error as NodeError).code === 'ENOENT') {
        // File doesn't exist - create with defaults
        logger.info('Rate limit config not found, creating with defaults', {
          rateLimitConfigPath: this.rateLimitConfigPath,
          provider: 'local',
          operation: 'getRateLimitConfig',
        })

        await this.setRateLimitConfig(DEFAULT_RATE_LIMIT_CONFIG)
        return { ...DEFAULT_RATE_LIMIT_CONFIG }
      }

      logger.error('Failed to read rate limit config', {
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: 'local',
        operation: 'getRateLimitConfig',
      })

      throw new StorageOperationError(
        `Failed to read rate limit config: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'getRateLimitConfig',
        'local',
        false,
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
    try {
      await this.ensureJobsDirectory()

      // Write config file atomically
      const tempFilePath = `${this.rateLimitConfigPath}.tmp.${Date.now()}.${Math.random().toString(36).substring(2, 11)}`
      const configData = JSON.stringify(config, null, 2)

      await fs.writeFile(tempFilePath, configData, 'utf-8')

      try {
        await fs.rename(tempFilePath, this.rateLimitConfigPath)
      } catch (renameError) {
        // Clean up temp file if rename fails
        try {
          await fs.unlink(tempFilePath)
        } catch {
          // Ignore cleanup errors
        }
        throw renameError
      }

      logger.info('Rate limit config saved', {
        config,
        provider: 'local',
        operation: 'setRateLimitConfig',
      })
    } catch (error) {
      logger.error('Failed to save rate limit config', {
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: 'local',
        operation: 'setRateLimitConfig',
      })

      throw new StorageOperationError(
        `Failed to save rate limit config: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'setRateLimitConfig',
        'local',
        false,
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
        retentionDays,
        cutoffTimestamp,
        deletedCount,
        provider: 'local',
        operation: 'cleanupOldJobs',
      })

      return deletedCount
    } catch (error) {
      logger.error('Failed to cleanup old jobs', {
        retentionDays,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: 'local',
        operation: 'cleanupOldJobs',
      })

      throw new StorageOperationError(
        `Failed to cleanup old jobs: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'cleanupOldJobs',
        'local',
        false,
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
      // Ensure the jobs directory exists
      await this.ensureJobsDirectory()

      // Verify we can access the directory
      await fs.access(this.jobsDir)

      logger.debug('Storage ready check passed', {
        jobsDir: this.jobsDir,
        provider: 'local',
        operation: 'isReady',
      })

      return true
    } catch (error) {
      logger.warn('Storage ready check failed', {
        jobsDir: this.jobsDir,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: 'local',
        operation: 'isReady',
      })

      return false
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Get the file path for a job
   *
   * @param jobId - The job identifier
   * @returns The full file path for the job
   */
  private getJobFilePath(jobId: string): string {
    return path.join(this.jobsDir, `${jobId}.json`)
  }

  /**
   * Ensure the jobs directory exists
   *
   * Creates the directory recursively if it doesn't exist.
   */
  private async ensureJobsDirectory(): Promise<void> {
    await fs.mkdir(this.jobsDir, { recursive: true })
  }

  /**
   * Write a job file atomically
   *
   * Uses temp file + rename pattern for atomic writes.
   *
   * @param filePath - The target file path
   * @param job - The job data to write
   */
  private async writeJobFile(
    filePath: string,
    job: BackfillJob
  ): Promise<void> {
    const tempFilePath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).substring(2, 11)}`
    const jobData = JSON.stringify(job, null, 2)

    await fs.writeFile(tempFilePath, jobData, 'utf-8')

    try {
      await fs.rename(tempFilePath, filePath)
    } catch (renameError) {
      // Clean up temp file if rename fails
      try {
        await fs.unlink(tempFilePath)
      } catch {
        // Ignore cleanup errors
      }
      throw renameError
    }
  }

  /**
   * Validate job object structure
   *
   * Checks that the job has all required fields with correct types.
   *
   * @param job - The job object to validate
   * @returns True if the job structure is valid
   */
  private isValidJobStructure(job: unknown): job is BackfillJob {
    if (!job || typeof job !== 'object') return false

    const j = job as Record<string, unknown>

    // Check required string fields
    if (typeof j['jobId'] !== 'string') return false
    if (typeof j['createdAt'] !== 'string') return false

    // Check jobType
    if (
      j['jobType'] !== 'data-collection' &&
      j['jobType'] !== 'analytics-generation'
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
    if (!validStatuses.includes(j['status'] as BackfillJobStatus)) {
      return false
    }

    // Check config object exists
    if (!j['config'] || typeof j['config'] !== 'object') return false

    // Check progress object exists and has required fields
    if (!j['progress'] || typeof j['progress'] !== 'object') return false
    const progress = j['progress'] as Record<string, unknown>
    if (typeof progress['totalItems'] !== 'number') return false
    if (typeof progress['processedItems'] !== 'number') return false
    if (typeof progress['failedItems'] !== 'number') return false
    if (typeof progress['skippedItems'] !== 'number') return false

    // Optional fields can be null or their expected type
    // checkpoint, startedAt, completedAt, resumedAt, result, error

    return true
  }

  /**
   * Validate rate limit config structure
   *
   * Checks that the config has all required fields with correct types.
   *
   * @param config - The config object to validate
   * @returns True if the config structure is valid
   */
  private isValidRateLimitConfig(config: unknown): config is RateLimitConfig {
    if (!config || typeof config !== 'object') return false

    const c = config as Record<string, unknown>

    return (
      typeof c['maxRequestsPerMinute'] === 'number' &&
      typeof c['maxConcurrent'] === 'number' &&
      typeof c['minDelayMs'] === 'number' &&
      typeof c['maxDelayMs'] === 'number' &&
      typeof c['backoffMultiplier'] === 'number'
    )
  }
}
