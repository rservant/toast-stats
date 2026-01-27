/**
 * LocalBackfillJobStorage Unit Tests
 *
 * Tests the LocalBackfillJobStorage implementation of IBackfillJobStorage
 * for local filesystem storage of backfill jobs.
 *
 * Requirements Validated: 1.2, 1.6, 1.7
 *
 * Test Isolation Requirements (per testing steering document):
 * - Each test uses unique, isolated directories
 * - Tests clean up all resources in afterEach hooks
 * - Tests do not depend on execution order
 * - All tests pass when run with --run (parallel mode)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import { LocalBackfillJobStorage } from '../LocalBackfillJobStorage.js'
import type {
  IBackfillJobStorage,
  BackfillJob,
  BackfillJobStatus,
  BackfillJobType,
  JobCheckpoint,
  RateLimitConfig,
  ListJobsOptions,
} from '../../../types/storageInterfaces.js'
import { StorageOperationError } from '../../../types/storageInterfaces.js'

/**
 * Generate a unique test directory for isolation
 */
function createUniqueTestDir(): string {
  const timestamp = Date.now()
  const randomSuffix = Math.random().toString(36).substring(2, 11)
  const processId = process.pid
  return path.join(
    process.cwd(),
    'test-cache',
    `local-backfill-job-${timestamp}-${randomSuffix}-${processId}`
  )
}

/**
 * Generate a unique job ID for test isolation
 */
function createUniqueJobId(): string {
  const timestamp = Date.now()
  const randomSuffix = Math.random().toString(36).substring(2, 11)
  return `test-job-${timestamp}-${randomSuffix}`
}

/**
 * Create a valid test backfill job
 */
function createTestJob(overrides: Partial<BackfillJob> = {}): BackfillJob {
  const jobId = overrides.jobId ?? createUniqueJobId()
  return {
    jobId,
    jobType: 'data-collection',
    status: 'pending',
    config: {
      startDate: '2024-01-01',
      endDate: '2024-01-31',
    },
    progress: {
      totalItems: 10,
      processedItems: 0,
      failedItems: 0,
      skippedItems: 0,
      currentItem: null,
      districtProgress: {},
      errors: [],
    },
    checkpoint: null,
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    resumedAt: null,
    result: null,
    error: null,
    ...overrides,
  }
}

/**
 * Create a valid test checkpoint
 */
function createTestCheckpoint(
  overrides: Partial<JobCheckpoint> = {}
): JobCheckpoint {
  return {
    lastProcessedItem: 'item-1',
    lastProcessedAt: new Date().toISOString(),
    itemsCompleted: ['item-1'],
    ...overrides,
  }
}

/**
 * Create a valid test rate limit config
 */
function createTestRateLimitConfig(
  overrides: Partial<RateLimitConfig> = {}
): RateLimitConfig {
  return {
    maxRequestsPerMinute: 10,
    maxConcurrent: 3,
    minDelayMs: 2000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    ...overrides,
  }
}

describe('LocalBackfillJobStorage', () => {
  let storage: IBackfillJobStorage
  let testCacheDir: string

  beforeEach(async () => {
    // Create unique test directory for isolation
    testCacheDir = createUniqueTestDir()
    await fs.mkdir(testCacheDir, { recursive: true })

    // Create storage instance
    storage = new LocalBackfillJobStorage(testCacheDir)
  })

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testCacheDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  // ============================================================================
  // Interface Compliance Tests
  // ============================================================================

  describe('Interface Compliance', () => {
    it('should implement IBackfillJobStorage interface', () => {
      // Verify all required methods exist
      expect(typeof storage.createJob).toBe('function')
      expect(typeof storage.getJob).toBe('function')
      expect(typeof storage.updateJob).toBe('function')
      expect(typeof storage.deleteJob).toBe('function')
      expect(typeof storage.listJobs).toBe('function')
      expect(typeof storage.getActiveJob).toBe('function')
      expect(typeof storage.getJobsByStatus).toBe('function')
      expect(typeof storage.updateCheckpoint).toBe('function')
      expect(typeof storage.getCheckpoint).toBe('function')
      expect(typeof storage.getRateLimitConfig).toBe('function')
      expect(typeof storage.setRateLimitConfig).toBe('function')
      expect(typeof storage.cleanupOldJobs).toBe('function')
      expect(typeof storage.isReady).toBe('function')
    })
  })

  // ============================================================================
  // Graceful Initialization Tests (Requirement 1.2, 12.5)
  // ============================================================================

  describe('Graceful Initialization', () => {
    it('should create directories if missing on isReady', async () => {
      // Verify jobs directory doesn't exist initially
      const jobsDir = path.join(testCacheDir, 'backfill-jobs')
      const existsBefore = await fs
        .access(jobsDir)
        .then(() => true)
        .catch(() => false)
      expect(existsBefore).toBe(false)

      // Call isReady
      const isReady = await storage.isReady()
      expect(isReady).toBe(true)

      // Verify jobs directory was created
      const existsAfter = await fs
        .access(jobsDir)
        .then(() => true)
        .catch(() => false)
      expect(existsAfter).toBe(true)
    })

    it('should create directories if missing on createJob', async () => {
      const jobsDir = path.join(testCacheDir, 'backfill-jobs')
      const existsBefore = await fs
        .access(jobsDir)
        .then(() => true)
        .catch(() => false)
      expect(existsBefore).toBe(false)

      const job = createTestJob()
      await storage.createJob(job)

      const existsAfter = await fs
        .access(jobsDir)
        .then(() => true)
        .catch(() => false)
      expect(existsAfter).toBe(true)
    })

    it('should create directories if missing on listJobs', async () => {
      const jobsDir = path.join(testCacheDir, 'backfill-jobs')
      const existsBefore = await fs
        .access(jobsDir)
        .then(() => true)
        .catch(() => false)
      expect(existsBefore).toBe(false)

      const jobs = await storage.listJobs()
      expect(jobs).toEqual([])

      const existsAfter = await fs
        .access(jobsDir)
        .then(() => true)
        .catch(() => false)
      expect(existsAfter).toBe(true)
    })

    it('should return default rate limit config if missing', async () => {
      const config = await storage.getRateLimitConfig()

      expect(config.maxRequestsPerMinute).toBe(10)
      expect(config.maxConcurrent).toBe(3)
      expect(config.minDelayMs).toBe(2000)
      expect(config.maxDelayMs).toBe(30000)
      expect(config.backoffMultiplier).toBe(2)
    })

    it('should handle existing directories gracefully', async () => {
      // Create jobs directory manually
      const jobsDir = path.join(testCacheDir, 'backfill-jobs')
      await fs.mkdir(jobsDir, { recursive: true })

      // Operations should not throw
      const isReady = await storage.isReady()
      expect(isReady).toBe(true)

      const job = createTestJob()
      await expect(storage.createJob(job)).resolves.not.toThrow()
    })

    it('should return false from isReady when directory is inaccessible', async () => {
      // Create storage with non-existent parent that can't be created
      const invalidStorage = new LocalBackfillJobStorage(
        '/root/definitely-not-accessible-' + Date.now()
      )

      const isReady = await invalidStorage.isReady()
      expect(isReady).toBe(false)
    })
  })

  // ============================================================================
  // Job CRUD Operations Tests (Requirement 1.2)
  // ============================================================================

  describe('Job CRUD Operations', () => {
    describe('createJob', () => {
      it('should create job successfully', async () => {
        const job = createTestJob()
        await expect(storage.createJob(job)).resolves.not.toThrow()

        const retrieved = await storage.getJob(job.jobId)
        expect(retrieved).not.toBeNull()
        expect(retrieved?.jobId).toBe(job.jobId)
      })

      it('should persist job to disk', async () => {
        const job = createTestJob()
        await storage.createJob(job)

        // Verify file exists
        const jobFilePath = path.join(
          testCacheDir,
          'backfill-jobs',
          `${job.jobId}.json`
        )
        const fileExists = await fs
          .access(jobFilePath)
          .then(() => true)
          .catch(() => false)
        expect(fileExists).toBe(true)
      })

      it('should throw on duplicate job ID', async () => {
        const job = createTestJob()
        await storage.createJob(job)

        await expect(storage.createJob(job)).rejects.toThrow(
          StorageOperationError
        )
      })

      it('should throw StorageOperationError with correct context on duplicate', async () => {
        const job = createTestJob()
        await storage.createJob(job)

        try {
          await storage.createJob(job)
          expect.fail('Should have thrown')
        } catch (error) {
          expect(error).toBeInstanceOf(StorageOperationError)
          const storageError = error as StorageOperationError
          expect(storageError.operation).toBe('createJob')
          expect(storageError.provider).toBe('local')
          expect(storageError.message).toContain(job.jobId)
        }
      })

      it('should handle both job types', async () => {
        const dataJob = createTestJob({ jobType: 'data-collection' })
        const analyticsJob = createTestJob({ jobType: 'analytics-generation' })

        await storage.createJob(dataJob)
        await storage.createJob(analyticsJob)

        const retrievedData = await storage.getJob(dataJob.jobId)
        const retrievedAnalytics = await storage.getJob(analyticsJob.jobId)

        expect(retrievedData?.jobType).toBe('data-collection')
        expect(retrievedAnalytics?.jobType).toBe('analytics-generation')
      })
    })

    describe('getJob', () => {
      it('should return job when exists', async () => {
        const job = createTestJob()
        await storage.createJob(job)

        const retrieved = await storage.getJob(job.jobId)
        expect(retrieved).not.toBeNull()
        expect(retrieved?.jobId).toBe(job.jobId)
        expect(retrieved?.jobType).toBe(job.jobType)
        expect(retrieved?.status).toBe(job.status)
      })

      it('should return null for non-existent job', async () => {
        const result = await storage.getJob('non-existent-job-id')
        expect(result).toBeNull()
      })

      it('should return all job fields correctly', async () => {
        const job = createTestJob({
          status: 'running',
          startedAt: new Date().toISOString(),
          checkpoint: createTestCheckpoint(),
          progress: {
            totalItems: 100,
            processedItems: 50,
            failedItems: 2,
            skippedItems: 3,
            currentItem: 'item-50',
            districtProgress: {
              '42': {
                districtId: '42',
                status: 'processing',
                itemsProcessed: 25,
                itemsTotal: 50,
                lastError: null,
              },
            },
            errors: [
              {
                itemId: 'item-10',
                message: 'Test error',
                occurredAt: new Date().toISOString(),
                isRetryable: true,
              },
            ],
          },
        })
        await storage.createJob(job)

        const retrieved = await storage.getJob(job.jobId)
        expect(retrieved?.progress.totalItems).toBe(100)
        expect(retrieved?.progress.processedItems).toBe(50)
        expect(retrieved?.progress.failedItems).toBe(2)
        expect(retrieved?.progress.skippedItems).toBe(3)
        expect(retrieved?.progress.currentItem).toBe('item-50')
        expect(retrieved?.progress.districtProgress['42']?.status).toBe(
          'processing'
        )
        expect(retrieved?.progress.errors.length).toBe(1)
        expect(retrieved?.checkpoint).not.toBeNull()
      })
    })

    describe('updateJob', () => {
      it('should update job fields', async () => {
        const job = createTestJob({ status: 'pending' })
        await storage.createJob(job)

        await storage.updateJob(job.jobId, {
          status: 'running',
          startedAt: new Date().toISOString(),
        })

        const retrieved = await storage.getJob(job.jobId)
        expect(retrieved?.status).toBe('running')
        expect(retrieved?.startedAt).not.toBeNull()
      })

      it('should throw on non-existent job', async () => {
        await expect(
          storage.updateJob('non-existent-job', { status: 'running' })
        ).rejects.toThrow(StorageOperationError)
      })

      it('should throw StorageOperationError with correct context', async () => {
        try {
          await storage.updateJob('non-existent-job', { status: 'running' })
          expect.fail('Should have thrown')
        } catch (error) {
          expect(error).toBeInstanceOf(StorageOperationError)
          const storageError = error as StorageOperationError
          expect(storageError.operation).toBe('updateJob')
          expect(storageError.provider).toBe('local')
        }
      })

      it('should preserve jobId even if update tries to change it', async () => {
        const job = createTestJob()
        await storage.createJob(job)

        // Attempt to change jobId (should be ignored)
        await storage.updateJob(job.jobId, {
          jobId: 'different-id',
          status: 'running',
        } as Partial<BackfillJob>)

        const retrieved = await storage.getJob(job.jobId)
        expect(retrieved?.jobId).toBe(job.jobId)
      })

      it('should merge updates with existing job data', async () => {
        const job = createTestJob({
          config: {
            startDate: '2024-01-01',
            endDate: '2024-01-31',
            targetDistricts: ['42', '43'],
          },
        })
        await storage.createJob(job)

        await storage.updateJob(job.jobId, { status: 'running' })

        const retrieved = await storage.getJob(job.jobId)
        expect(retrieved?.status).toBe('running')
        expect(retrieved?.config.startDate).toBe('2024-01-01')
        expect(retrieved?.config.targetDistricts).toEqual(['42', '43'])
      })
    })

    describe('deleteJob', () => {
      it('should delete existing job', async () => {
        const job = createTestJob()
        await storage.createJob(job)

        const deleted = await storage.deleteJob(job.jobId)
        expect(deleted).toBe(true)

        const retrieved = await storage.getJob(job.jobId)
        expect(retrieved).toBeNull()
      })

      it('should return false for non-existent job', async () => {
        const deleted = await storage.deleteJob('non-existent-job')
        expect(deleted).toBe(false)
      })

      it('should remove job file from disk', async () => {
        const job = createTestJob()
        await storage.createJob(job)

        const jobFilePath = path.join(
          testCacheDir,
          'backfill-jobs',
          `${job.jobId}.json`
        )

        // Verify file exists before delete
        const existsBefore = await fs
          .access(jobFilePath)
          .then(() => true)
          .catch(() => false)
        expect(existsBefore).toBe(true)

        await storage.deleteJob(job.jobId)

        // Verify file is removed
        const existsAfter = await fs
          .access(jobFilePath)
          .then(() => true)
          .catch(() => false)
        expect(existsAfter).toBe(false)
      })
    })
  })

  // ============================================================================
  // Job Query Tests (Requirement 1.6)
  // ============================================================================

  describe('Job Queries', () => {
    describe('listJobs', () => {
      it('should return empty array when no jobs exist', async () => {
        const jobs = await storage.listJobs()
        expect(jobs).toEqual([])
      })

      it('should return all jobs sorted by creation time (newest first)', async () => {
        const job1 = createTestJob({
          createdAt: '2024-01-01T10:00:00.000Z',
        })
        const job2 = createTestJob({
          createdAt: '2024-01-02T10:00:00.000Z',
        })
        const job3 = createTestJob({
          createdAt: '2024-01-03T10:00:00.000Z',
        })

        // Create in random order
        await storage.createJob(job2)
        await storage.createJob(job1)
        await storage.createJob(job3)

        const jobs = await storage.listJobs()
        expect(jobs.length).toBe(3)
        expect(jobs[0]?.jobId).toBe(job3.jobId) // Newest first
        expect(jobs[1]?.jobId).toBe(job2.jobId)
        expect(jobs[2]?.jobId).toBe(job1.jobId)
      })

      it('should filter by status', async () => {
        const pendingJob = createTestJob({ status: 'pending' })
        const runningJob = createTestJob({ status: 'running' })
        const completedJob = createTestJob({ status: 'completed' })

        await storage.createJob(pendingJob)
        await storage.createJob(runningJob)
        await storage.createJob(completedJob)

        const runningJobs = await storage.listJobs({ status: ['running'] })
        expect(runningJobs.length).toBe(1)
        expect(runningJobs[0]?.status).toBe('running')

        const activeJobs = await storage.listJobs({
          status: ['pending', 'running'],
        })
        expect(activeJobs.length).toBe(2)
      })

      it('should filter by jobType', async () => {
        const dataJob = createTestJob({ jobType: 'data-collection' })
        const analyticsJob = createTestJob({ jobType: 'analytics-generation' })

        await storage.createJob(dataJob)
        await storage.createJob(analyticsJob)

        const dataJobs = await storage.listJobs({
          jobType: ['data-collection'],
        })
        expect(dataJobs.length).toBe(1)
        expect(dataJobs[0]?.jobType).toBe('data-collection')
      })

      it('should filter by date range (startDateFrom)', async () => {
        const oldJob = createTestJob({
          createdAt: '2024-01-01T10:00:00.000Z',
        })
        const newJob = createTestJob({
          createdAt: '2024-02-01T10:00:00.000Z',
        })

        await storage.createJob(oldJob)
        await storage.createJob(newJob)

        const jobs = await storage.listJobs({
          startDateFrom: '2024-01-15T00:00:00.000Z',
        })
        expect(jobs.length).toBe(1)
        expect(jobs[0]?.jobId).toBe(newJob.jobId)
      })

      it('should filter by date range (startDateTo)', async () => {
        const oldJob = createTestJob({
          createdAt: '2024-01-01T10:00:00.000Z',
        })
        const newJob = createTestJob({
          createdAt: '2024-02-01T10:00:00.000Z',
        })

        await storage.createJob(oldJob)
        await storage.createJob(newJob)

        const jobs = await storage.listJobs({
          startDateTo: '2024-01-15T00:00:00.000Z',
        })
        expect(jobs.length).toBe(1)
        expect(jobs[0]?.jobId).toBe(oldJob.jobId)
      })

      it('should apply pagination with limit', async () => {
        for (let i = 0; i < 5; i++) {
          await storage.createJob(createTestJob())
        }

        const jobs = await storage.listJobs({ limit: 3 })
        expect(jobs.length).toBe(3)
      })

      it('should apply pagination with offset', async () => {
        const jobs: BackfillJob[] = []
        for (let i = 0; i < 5; i++) {
          const job = createTestJob({
            createdAt: new Date(Date.now() + i * 1000).toISOString(),
          })
          jobs.push(job)
          await storage.createJob(job)
        }

        const paginatedJobs = await storage.listJobs({ offset: 2, limit: 2 })
        expect(paginatedJobs.length).toBe(2)
      })

      it('should combine multiple filters', async () => {
        const job1 = createTestJob({
          status: 'completed',
          jobType: 'data-collection',
          createdAt: '2024-01-15T10:00:00.000Z',
        })
        const job2 = createTestJob({
          status: 'completed',
          jobType: 'analytics-generation',
          createdAt: '2024-01-15T10:00:00.000Z',
        })
        const job3 = createTestJob({
          status: 'failed',
          jobType: 'data-collection',
          createdAt: '2024-01-15T10:00:00.000Z',
        })

        await storage.createJob(job1)
        await storage.createJob(job2)
        await storage.createJob(job3)

        const jobs = await storage.listJobs({
          status: ['completed'],
          jobType: ['data-collection'],
        })
        expect(jobs.length).toBe(1)
        expect(jobs[0]?.jobId).toBe(job1.jobId)
      })
    })

    describe('getActiveJob', () => {
      it('should return null when no active job exists', async () => {
        const pendingJob = createTestJob({ status: 'pending' })
        const completedJob = createTestJob({ status: 'completed' })

        await storage.createJob(pendingJob)
        await storage.createJob(completedJob)

        const activeJob = await storage.getActiveJob()
        expect(activeJob).toBeNull()
      })

      it('should return running job', async () => {
        const runningJob = createTestJob({ status: 'running' })
        await storage.createJob(runningJob)

        const activeJob = await storage.getActiveJob()
        expect(activeJob).not.toBeNull()
        expect(activeJob?.jobId).toBe(runningJob.jobId)
        expect(activeJob?.status).toBe('running')
      })

      it('should return recovering job', async () => {
        const recoveringJob = createTestJob({ status: 'recovering' })
        await storage.createJob(recoveringJob)

        const activeJob = await storage.getActiveJob()
        expect(activeJob).not.toBeNull()
        expect(activeJob?.jobId).toBe(recoveringJob.jobId)
        expect(activeJob?.status).toBe('recovering')
      })

      it('should return most recent active job when multiple exist', async () => {
        const olderRunning = createTestJob({
          status: 'running',
          createdAt: '2024-01-01T10:00:00.000Z',
        })
        const newerRunning = createTestJob({
          status: 'running',
          createdAt: '2024-01-02T10:00:00.000Z',
        })

        await storage.createJob(olderRunning)
        await storage.createJob(newerRunning)

        const activeJob = await storage.getActiveJob()
        expect(activeJob?.jobId).toBe(newerRunning.jobId)
      })
    })

    describe('getJobsByStatus', () => {
      it('should return jobs matching single status', async () => {
        const pendingJob = createTestJob({ status: 'pending' })
        const runningJob = createTestJob({ status: 'running' })
        const completedJob = createTestJob({ status: 'completed' })

        await storage.createJob(pendingJob)
        await storage.createJob(runningJob)
        await storage.createJob(completedJob)

        const completedJobs = await storage.getJobsByStatus(['completed'])
        expect(completedJobs.length).toBe(1)
        expect(completedJobs[0]?.status).toBe('completed')
      })

      it('should return jobs matching multiple statuses', async () => {
        const pendingJob = createTestJob({ status: 'pending' })
        const runningJob = createTestJob({ status: 'running' })
        const completedJob = createTestJob({ status: 'completed' })
        const failedJob = createTestJob({ status: 'failed' })

        await storage.createJob(pendingJob)
        await storage.createJob(runningJob)
        await storage.createJob(completedJob)
        await storage.createJob(failedJob)

        const terminalJobs = await storage.getJobsByStatus([
          'completed',
          'failed',
          'cancelled',
        ])
        expect(terminalJobs.length).toBe(2)
      })

      it('should return empty array when no jobs match', async () => {
        const pendingJob = createTestJob({ status: 'pending' })
        await storage.createJob(pendingJob)

        const cancelledJobs = await storage.getJobsByStatus(['cancelled'])
        expect(cancelledJobs).toEqual([])
      })

      it('should return jobs sorted by creation time (newest first)', async () => {
        const job1 = createTestJob({
          status: 'completed',
          createdAt: '2024-01-01T10:00:00.000Z',
        })
        const job2 = createTestJob({
          status: 'completed',
          createdAt: '2024-01-02T10:00:00.000Z',
        })

        await storage.createJob(job1)
        await storage.createJob(job2)

        const jobs = await storage.getJobsByStatus(['completed'])
        expect(jobs[0]?.jobId).toBe(job2.jobId) // Newest first
        expect(jobs[1]?.jobId).toBe(job1.jobId)
      })
    })
  })

  // ============================================================================
  // Checkpoint Operations Tests
  // ============================================================================

  describe('Checkpoint Operations', () => {
    describe('updateCheckpoint', () => {
      it('should update checkpoint for existing job', async () => {
        const job = createTestJob()
        await storage.createJob(job)

        const checkpoint = createTestCheckpoint()
        await storage.updateCheckpoint(job.jobId, checkpoint)

        const retrieved = await storage.getJob(job.jobId)
        expect(retrieved?.checkpoint).not.toBeNull()
        expect(retrieved?.checkpoint?.lastProcessedItem).toBe(
          checkpoint.lastProcessedItem
        )
      })

      it('should throw on non-existent job', async () => {
        const checkpoint = createTestCheckpoint()
        await expect(
          storage.updateCheckpoint('non-existent-job', checkpoint)
        ).rejects.toThrow(StorageOperationError)
      })

      it('should overwrite existing checkpoint', async () => {
        const job = createTestJob()
        await storage.createJob(job)

        const checkpoint1 = createTestCheckpoint({
          lastProcessedItem: 'item-1',
          itemsCompleted: ['item-1'],
        })
        await storage.updateCheckpoint(job.jobId, checkpoint1)

        const checkpoint2 = createTestCheckpoint({
          lastProcessedItem: 'item-5',
          itemsCompleted: ['item-1', 'item-2', 'item-3', 'item-4', 'item-5'],
        })
        await storage.updateCheckpoint(job.jobId, checkpoint2)

        const retrieved = await storage.getJob(job.jobId)
        expect(retrieved?.checkpoint?.lastProcessedItem).toBe('item-5')
        expect(retrieved?.checkpoint?.itemsCompleted.length).toBe(5)
      })
    })

    describe('getCheckpoint', () => {
      it('should return checkpoint when exists', async () => {
        const job = createTestJob()
        await storage.createJob(job)

        const checkpoint = createTestCheckpoint()
        await storage.updateCheckpoint(job.jobId, checkpoint)

        const retrieved = await storage.getCheckpoint(job.jobId)
        expect(retrieved).not.toBeNull()
        expect(retrieved?.lastProcessedItem).toBe(checkpoint.lastProcessedItem)
        expect(retrieved?.itemsCompleted).toEqual(checkpoint.itemsCompleted)
      })

      it('should return null when no checkpoint exists', async () => {
        const job = createTestJob()
        await storage.createJob(job)

        const checkpoint = await storage.getCheckpoint(job.jobId)
        expect(checkpoint).toBeNull()
      })

      it('should return null for non-existent job', async () => {
        const checkpoint = await storage.getCheckpoint('non-existent-job')
        expect(checkpoint).toBeNull()
      })
    })
  })

  // ============================================================================
  // Rate Limit Configuration Tests (Requirement 12.5)
  // ============================================================================

  describe('Rate Limit Configuration', () => {
    describe('getRateLimitConfig', () => {
      it('should return defaults if config file missing', async () => {
        const config = await storage.getRateLimitConfig()

        expect(config.maxRequestsPerMinute).toBe(10)
        expect(config.maxConcurrent).toBe(3)
        expect(config.minDelayMs).toBe(2000)
        expect(config.maxDelayMs).toBe(30000)
        expect(config.backoffMultiplier).toBe(2)
      })

      it('should create config file with defaults when missing', async () => {
        await storage.getRateLimitConfig()

        const configPath = path.join(
          testCacheDir,
          'backfill-jobs',
          'rate-limit-config.json'
        )
        const fileExists = await fs
          .access(configPath)
          .then(() => true)
          .catch(() => false)
        expect(fileExists).toBe(true)
      })

      it('should return saved config', async () => {
        const customConfig = createTestRateLimitConfig({
          maxRequestsPerMinute: 20,
          maxConcurrent: 5,
        })
        await storage.setRateLimitConfig(customConfig)

        const retrieved = await storage.getRateLimitConfig()
        expect(retrieved.maxRequestsPerMinute).toBe(20)
        expect(retrieved.maxConcurrent).toBe(5)
      })
    })

    describe('setRateLimitConfig', () => {
      it('should persist config to disk', async () => {
        const config = createTestRateLimitConfig({
          maxRequestsPerMinute: 15,
        })
        await storage.setRateLimitConfig(config)

        // Create new storage instance to verify persistence
        const newStorage = new LocalBackfillJobStorage(testCacheDir)
        const retrieved = await newStorage.getRateLimitConfig()

        expect(retrieved.maxRequestsPerMinute).toBe(15)
      })

      it('should overwrite existing config', async () => {
        const config1 = createTestRateLimitConfig({
          maxRequestsPerMinute: 10,
        })
        await storage.setRateLimitConfig(config1)

        const config2 = createTestRateLimitConfig({
          maxRequestsPerMinute: 25,
        })
        await storage.setRateLimitConfig(config2)

        const retrieved = await storage.getRateLimitConfig()
        expect(retrieved.maxRequestsPerMinute).toBe(25)
      })

      it('should handle all config fields', async () => {
        const config = createTestRateLimitConfig({
          maxRequestsPerMinute: 30,
          maxConcurrent: 10,
          minDelayMs: 500,
          maxDelayMs: 60000,
          backoffMultiplier: 3,
        })
        await storage.setRateLimitConfig(config)

        const retrieved = await storage.getRateLimitConfig()
        expect(retrieved.maxRequestsPerMinute).toBe(30)
        expect(retrieved.maxConcurrent).toBe(10)
        expect(retrieved.minDelayMs).toBe(500)
        expect(retrieved.maxDelayMs).toBe(60000)
        expect(retrieved.backoffMultiplier).toBe(3)
      })
    })
  })

  // ============================================================================
  // Cleanup Tests (Requirement 1.7)
  // ============================================================================

  describe('Cleanup Old Jobs', () => {
    describe('cleanupOldJobs', () => {
      it('should remove old terminal jobs', async () => {
        // Create an old completed job (40 days ago)
        const oldDate = new Date()
        oldDate.setDate(oldDate.getDate() - 40)
        const oldJob = createTestJob({
          status: 'completed',
          createdAt: oldDate.toISOString(),
          completedAt: oldDate.toISOString(),
        })
        await storage.createJob(oldJob)

        // Create a recent completed job
        const recentJob = createTestJob({
          status: 'completed',
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        })
        await storage.createJob(recentJob)

        const deletedCount = await storage.cleanupOldJobs(30)
        expect(deletedCount).toBe(1)

        // Verify old job is deleted
        const oldJobRetrieved = await storage.getJob(oldJob.jobId)
        expect(oldJobRetrieved).toBeNull()

        // Verify recent job still exists
        const recentJobRetrieved = await storage.getJob(recentJob.jobId)
        expect(recentJobRetrieved).not.toBeNull()
      })

      it('should keep recent terminal jobs', async () => {
        const recentJob = createTestJob({
          status: 'completed',
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        })
        await storage.createJob(recentJob)

        const deletedCount = await storage.cleanupOldJobs(30)
        expect(deletedCount).toBe(0)

        const retrieved = await storage.getJob(recentJob.jobId)
        expect(retrieved).not.toBeNull()
      })

      it('should never remove running jobs regardless of age', async () => {
        const oldDate = new Date()
        oldDate.setDate(oldDate.getDate() - 100)
        const oldRunningJob = createTestJob({
          status: 'running',
          createdAt: oldDate.toISOString(),
        })
        await storage.createJob(oldRunningJob)

        const deletedCount = await storage.cleanupOldJobs(30)
        expect(deletedCount).toBe(0)

        const retrieved = await storage.getJob(oldRunningJob.jobId)
        expect(retrieved).not.toBeNull()
      })

      it('should never remove pending jobs regardless of age', async () => {
        const oldDate = new Date()
        oldDate.setDate(oldDate.getDate() - 100)
        const oldPendingJob = createTestJob({
          status: 'pending',
          createdAt: oldDate.toISOString(),
        })
        await storage.createJob(oldPendingJob)

        const deletedCount = await storage.cleanupOldJobs(30)
        expect(deletedCount).toBe(0)

        const retrieved = await storage.getJob(oldPendingJob.jobId)
        expect(retrieved).not.toBeNull()
      })

      it('should remove old failed jobs', async () => {
        const oldDate = new Date()
        oldDate.setDate(oldDate.getDate() - 40)
        const oldFailedJob = createTestJob({
          status: 'failed',
          createdAt: oldDate.toISOString(),
          completedAt: oldDate.toISOString(),
          error: 'Test error',
        })
        await storage.createJob(oldFailedJob)

        const deletedCount = await storage.cleanupOldJobs(30)
        expect(deletedCount).toBe(1)

        const retrieved = await storage.getJob(oldFailedJob.jobId)
        expect(retrieved).toBeNull()
      })

      it('should remove old cancelled jobs', async () => {
        const oldDate = new Date()
        oldDate.setDate(oldDate.getDate() - 40)
        const oldCancelledJob = createTestJob({
          status: 'cancelled',
          createdAt: oldDate.toISOString(),
          completedAt: oldDate.toISOString(),
        })
        await storage.createJob(oldCancelledJob)

        const deletedCount = await storage.cleanupOldJobs(30)
        expect(deletedCount).toBe(1)

        const retrieved = await storage.getJob(oldCancelledJob.jobId)
        expect(retrieved).toBeNull()
      })

      it('should use completedAt for age calculation when available', async () => {
        // Job created 40 days ago but completed 20 days ago
        const createdDate = new Date()
        createdDate.setDate(createdDate.getDate() - 40)
        const completedDate = new Date()
        completedDate.setDate(completedDate.getDate() - 20)

        const job = createTestJob({
          status: 'completed',
          createdAt: createdDate.toISOString(),
          completedAt: completedDate.toISOString(),
        })
        await storage.createJob(job)

        // With 30 day retention, job should NOT be deleted (completed 20 days ago)
        const deletedCount = await storage.cleanupOldJobs(30)
        expect(deletedCount).toBe(0)

        const retrieved = await storage.getJob(job.jobId)
        expect(retrieved).not.toBeNull()
      })

      it('should return count of deleted jobs', async () => {
        const oldDate = new Date()
        oldDate.setDate(oldDate.getDate() - 40)

        // Create 3 old completed jobs
        for (let i = 0; i < 3; i++) {
          const job = createTestJob({
            status: 'completed',
            createdAt: oldDate.toISOString(),
            completedAt: oldDate.toISOString(),
          })
          await storage.createJob(job)
        }

        // Create 2 recent jobs
        for (let i = 0; i < 2; i++) {
          const job = createTestJob({
            status: 'completed',
            createdAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          })
          await storage.createJob(job)
        }

        const deletedCount = await storage.cleanupOldJobs(30)
        expect(deletedCount).toBe(3)

        const remainingJobs = await storage.listJobs()
        expect(remainingJobs.length).toBe(2)
      })
    })
  })

  // ============================================================================
  // isReady Tests
  // ============================================================================

  describe('isReady', () => {
    it('should return true when storage is accessible', async () => {
      const isReady = await storage.isReady()
      expect(isReady).toBe(true)
    })

    it('should return true after directory is created', async () => {
      // First call creates directory
      const firstCheck = await storage.isReady()
      expect(firstCheck).toBe(true)

      // Second call should also return true
      const secondCheck = await storage.isReady()
      expect(secondCheck).toBe(true)
    })

    it('should return true even when no jobs exist', async () => {
      const isReady = await storage.isReady()
      expect(isReady).toBe(true)

      const jobs = await storage.listJobs()
      expect(jobs).toEqual([])
    })
  })

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('Error Handling', () => {
    it('should throw StorageOperationError for invalid JSON in job file', async () => {
      // Create jobs directory
      const jobsDir = path.join(testCacheDir, 'backfill-jobs')
      await fs.mkdir(jobsDir, { recursive: true })

      // Write invalid JSON
      const jobFilePath = path.join(jobsDir, 'invalid-job.json')
      await fs.writeFile(jobFilePath, 'not valid json {{{', 'utf-8')

      await expect(storage.getJob('invalid-job')).rejects.toThrow(
        StorageOperationError
      )
    })

    it('should skip invalid job files when listing', async () => {
      // Create a valid job
      const validJob = createTestJob()
      await storage.createJob(validJob)

      // Create an invalid job file
      const jobsDir = path.join(testCacheDir, 'backfill-jobs')
      const invalidJobPath = path.join(jobsDir, 'invalid-job.json')
      await fs.writeFile(invalidJobPath, 'not valid json', 'utf-8')

      const jobs = await storage.listJobs()
      expect(jobs.length).toBe(1)
      expect(jobs[0]?.jobId).toBe(validJob.jobId)
    })

    it('should skip job files with invalid structure when listing', async () => {
      // Create a valid job
      const validJob = createTestJob()
      await storage.createJob(validJob)

      // Create a job file with invalid structure
      const jobsDir = path.join(testCacheDir, 'backfill-jobs')
      const invalidJobPath = path.join(jobsDir, 'invalid-structure.json')
      await fs.writeFile(
        invalidJobPath,
        JSON.stringify({ someField: 'value' }),
        'utf-8'
      )

      const jobs = await storage.listJobs()
      expect(jobs.length).toBe(1)
      expect(jobs[0]?.jobId).toBe(validJob.jobId)
    })

    it('should return null for job with invalid structure', async () => {
      const jobsDir = path.join(testCacheDir, 'backfill-jobs')
      await fs.mkdir(jobsDir, { recursive: true })

      // Write valid JSON but invalid job structure
      const invalidJob = {
        jobId: 'test-job',
        // Missing required fields
      }
      const jobFilePath = path.join(jobsDir, 'test-job.json')
      await fs.writeFile(jobFilePath, JSON.stringify(invalidJob), 'utf-8')

      const result = await storage.getJob('test-job')
      expect(result).toBeNull()
    })

    it('should return defaults for invalid rate limit config structure', async () => {
      const jobsDir = path.join(testCacheDir, 'backfill-jobs')
      await fs.mkdir(jobsDir, { recursive: true })

      // Write valid JSON but invalid config structure
      const invalidConfig = { someField: 'value' }
      const configPath = path.join(jobsDir, 'rate-limit-config.json')
      await fs.writeFile(configPath, JSON.stringify(invalidConfig), 'utf-8')

      const config = await storage.getRateLimitConfig()
      expect(config.maxRequestsPerMinute).toBe(10) // Default value
    })

    it('should not include rate-limit-config.json in job listing', async () => {
      // Set rate limit config (creates the file)
      await storage.setRateLimitConfig(createTestRateLimitConfig())

      // Create a job
      const job = createTestJob()
      await storage.createJob(job)

      const jobs = await storage.listJobs()
      expect(jobs.length).toBe(1)
      expect(jobs[0]?.jobId).toBe(job.jobId)
    })
  })

  // ============================================================================
  // Edge Cases and Special Scenarios
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle all job statuses', async () => {
      const statuses: BackfillJobStatus[] = [
        'pending',
        'running',
        'completed',
        'failed',
        'cancelled',
        'recovering',
      ]

      for (const status of statuses) {
        const job = createTestJob({ status })
        await storage.createJob(job)

        const retrieved = await storage.getJob(job.jobId)
        expect(retrieved?.status).toBe(status)
      }
    })

    it('should handle job with all optional fields populated', async () => {
      const job = createTestJob({
        status: 'completed',
        config: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          targetDistricts: ['42', '43', 'F'],
          skipExisting: true,
          rateLimitOverrides: {
            maxRequestsPerMinute: 20,
          },
        },
        progress: {
          totalItems: 100,
          processedItems: 95,
          failedItems: 3,
          skippedItems: 2,
          currentItem: null,
          districtProgress: {
            '42': {
              districtId: '42',
              status: 'completed',
              itemsProcessed: 50,
              itemsTotal: 50,
              lastError: null,
            },
          },
          errors: [
            {
              itemId: 'item-10',
              message: 'Network error',
              occurredAt: new Date().toISOString(),
              isRetryable: true,
            },
          ],
        },
        checkpoint: createTestCheckpoint(),
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        resumedAt: new Date().toISOString(),
        result: {
          itemsProcessed: 95,
          itemsFailed: 3,
          itemsSkipped: 2,
          snapshotIds: ['2024-01-01', '2024-01-02'],
          duration: 3600000,
        },
        error: null,
      })

      await storage.createJob(job)
      const retrieved = await storage.getJob(job.jobId)

      expect(retrieved?.config.targetDistricts).toEqual(['42', '43', 'F'])
      expect(retrieved?.config.skipExisting).toBe(true)
      expect(retrieved?.result?.itemsProcessed).toBe(95)
      expect(retrieved?.result?.snapshotIds.length).toBe(2)
    })

    it('should handle job with error message', async () => {
      const job = createTestJob({
        status: 'failed',
        error: 'Critical failure: Unable to connect to data source',
      })
      await storage.createJob(job)

      const retrieved = await storage.getJob(job.jobId)
      expect(retrieved?.error).toBe(
        'Critical failure: Unable to connect to data source'
      )
    })

    it('should handle concurrent read operations', async () => {
      const job = createTestJob()
      await storage.createJob(job)

      // Perform multiple concurrent reads
      const results = await Promise.all([
        storage.getJob(job.jobId),
        storage.getJob(job.jobId),
        storage.getJob(job.jobId),
      ])

      // All should return the same job
      for (const result of results) {
        expect(result?.jobId).toBe(job.jobId)
      }
    })

    it('should handle special characters in job config', async () => {
      const job = createTestJob({
        config: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          targetDistricts: ['F', 'U', 'A'],
        },
      })
      await storage.createJob(job)

      const retrieved = await storage.getJob(job.jobId)
      expect(retrieved?.config.targetDistricts).toEqual(['F', 'U', 'A'])
    })

    it('should handle large checkpoint itemsCompleted array', async () => {
      const job = createTestJob()
      await storage.createJob(job)

      const largeItemsCompleted = Array.from(
        { length: 1000 },
        (_, i) => `item-${i}`
      )
      const checkpoint = createTestCheckpoint({
        itemsCompleted: largeItemsCompleted,
      })
      await storage.updateCheckpoint(job.jobId, checkpoint)

      const retrieved = await storage.getCheckpoint(job.jobId)
      expect(retrieved?.itemsCompleted.length).toBe(1000)
    })

    it('should handle empty districtProgress', async () => {
      const job = createTestJob({
        progress: {
          totalItems: 0,
          processedItems: 0,
          failedItems: 0,
          skippedItems: 0,
          currentItem: null,
          districtProgress: {},
          errors: [],
        },
      })
      await storage.createJob(job)

      const retrieved = await storage.getJob(job.jobId)
      expect(retrieved?.progress.districtProgress).toEqual({})
    })

    it('should handle multiple errors in progress', async () => {
      const errors = Array.from({ length: 10 }, (_, i) => ({
        itemId: `item-${i}`,
        message: `Error ${i}`,
        occurredAt: new Date().toISOString(),
        isRetryable: i % 2 === 0,
      }))

      const job = createTestJob({
        progress: {
          totalItems: 100,
          processedItems: 50,
          failedItems: 10,
          skippedItems: 0,
          currentItem: null,
          districtProgress: {},
          errors,
        },
      })
      await storage.createJob(job)

      const retrieved = await storage.getJob(job.jobId)
      expect(retrieved?.progress.errors.length).toBe(10)
    })
  })
})
