/**
 * JobManager Unit Tests
 *
 * Tests the JobManager component for the Unified Backfill Service.
 * Validates Requirements 3.1, 3.4, 7.2, 7.3 from the spec.
 *
 * Test Isolation Requirements (per testing steering document):
 * - Each test uses mocked IBackfillJobStorage
 * - Tests clean up all mocks in afterEach hooks
 * - Tests do not depend on execution order
 * - All tests pass when run with --run (parallel mode)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Mock } from 'vitest'
import { JobManager } from '../JobManager.js'
import type {
  IBackfillJobStorage,
  BackfillJob,
  JobCheckpoint,
  JobResult,
} from '../../../../types/storageInterfaces.js'
import type { CreateJobRequest } from '../../../../types/backfillJob.js'

// ============================================================================
// Mock Setup
// ============================================================================

// Mock the logger to avoid console output during tests
vi.mock('../../../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Generate a unique job ID for test isolation
 */
function createUniqueJobId(): string {
  const timestamp = Date.now()
  const randomSuffix = Math.random().toString(36).substring(2, 11)
  return `test-job-${timestamp}-${randomSuffix}`
}

/**
 * Create a mock IBackfillJobStorage implementation
 */
function createMockStorage(): IBackfillJobStorage & {
  createJob: Mock
  getJob: Mock
  updateJob: Mock
  deleteJob: Mock
  listJobs: Mock
  getActiveJob: Mock
  getJobsByStatus: Mock
  updateCheckpoint: Mock
  getCheckpoint: Mock
  getRateLimitConfig: Mock
  setRateLimitConfig: Mock
  cleanupOldJobs: Mock
  isReady: Mock
} {
  return {
    createJob: vi.fn().mockResolvedValue(undefined),
    getJob: vi.fn().mockResolvedValue(null),
    updateJob: vi.fn().mockResolvedValue(undefined),
    deleteJob: vi.fn().mockResolvedValue(true),
    listJobs: vi.fn().mockResolvedValue([]),
    getActiveJob: vi.fn().mockResolvedValue(null),
    getJobsByStatus: vi.fn().mockResolvedValue([]),
    updateCheckpoint: vi.fn().mockResolvedValue(undefined),
    getCheckpoint: vi.fn().mockResolvedValue(null),
    getRateLimitConfig: vi.fn().mockResolvedValue({
      maxRequestsPerMinute: 10,
      maxConcurrent: 3,
      minDelayMs: 2000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
    }),
    setRateLimitConfig: vi.fn().mockResolvedValue(undefined),
    cleanupOldJobs: vi.fn().mockResolvedValue(0),
    isReady: vi.fn().mockResolvedValue(true),
  }
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
 * Create a valid test job result
 */
function createTestResult(overrides: Partial<JobResult> = {}): JobResult {
  return {
    itemsProcessed: 10,
    itemsFailed: 0,
    itemsSkipped: 0,
    snapshotIds: ['2024-01-01', '2024-01-02'],
    duration: 60000,
    ...overrides,
  }
}

/**
 * Create a valid CreateJobRequest
 */
function createTestRequest(
  overrides: Partial<CreateJobRequest> = {}
): CreateJobRequest {
  return {
    jobType: 'data-collection',
    startDate: '2024-01-01',
    endDate: '2024-01-31',
    ...overrides,
  }
}

// ============================================================================
// Test Suite
// ============================================================================

describe('JobManager', () => {
  let mockStorage: ReturnType<typeof createMockStorage>
  let jobManager: JobManager

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    mockStorage = createMockStorage()
    jobManager = new JobManager(mockStorage)
  })

  afterEach(async () => {
    // Dispose the job manager to clean up timers
    await jobManager.dispose()
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  // ============================================================================
  // createJob Tests (Requirements 1.2, 3.1, 3.4)
  // ============================================================================

  describe('createJob', () => {
    it('should create job successfully and generate unique ID', async () => {
      // Arrange
      const request = createTestRequest()
      mockStorage.getActiveJob.mockResolvedValue(null)

      // Act
      const job = await jobManager.createJob(request)

      // Assert
      expect(job).toBeDefined()
      expect(job.jobId).toBeDefined()
      expect(job.jobId.length).toBeGreaterThan(0)
      expect(job.jobType).toBe(request.jobType)
      expect(job.status).toBe('pending')
      expect(job.config.startDate).toBe(request.startDate)
      expect(job.config.endDate).toBe(request.endDate)
      expect(mockStorage.createJob).toHaveBeenCalledTimes(1)
    })

    it('should throw when job already running (one-job-at-a-time)', async () => {
      // Arrange
      const request = createTestRequest()
      const runningJob = createTestJob({
        status: 'running',
        startedAt: new Date().toISOString(),
      })
      mockStorage.getActiveJob.mockResolvedValue(runningJob)

      // Act & Assert
      await expect(jobManager.createJob(request)).rejects.toThrow(
        /Cannot create new job.*already running/
      )
      expect(mockStorage.createJob).not.toHaveBeenCalled()
    })

    it('should allow new job when active job is stale (10 min threshold)', async () => {
      // Arrange
      const request = createTestRequest()
      const staleTime = new Date(Date.now() - 11 * 60 * 1000).toISOString() // 11 minutes ago
      const staleJob = createTestJob({
        jobId: 'stale-job',
        status: 'running',
        startedAt: staleTime,
        createdAt: staleTime,
      })
      mockStorage.getActiveJob.mockResolvedValue(staleJob)
      mockStorage.getJob.mockResolvedValue(staleJob)

      // Act
      const job = await jobManager.createJob(request)

      // Assert
      expect(job).toBeDefined()
      expect(job.jobId).not.toBe(staleJob.jobId)
      // Stale job should be marked as failed
      expect(mockStorage.updateJob).toHaveBeenCalledWith(
        staleJob.jobId,
        expect.objectContaining({
          status: 'failed',
          error: expect.stringContaining('inactivity'),
        })
      )
      // New job should be created
      expect(mockStorage.createJob).toHaveBeenCalledTimes(1)
    })

    it('should not consider job stale if within 10 minute threshold', async () => {
      // Arrange
      const request = createTestRequest()
      const recentTime = new Date(Date.now() - 5 * 60 * 1000).toISOString() // 5 minutes ago
      const recentJob = createTestJob({
        jobId: 'recent-job',
        status: 'running',
        startedAt: recentTime,
        createdAt: recentTime,
      })
      mockStorage.getActiveJob.mockResolvedValue(recentJob)

      // Act & Assert
      await expect(jobManager.createJob(request)).rejects.toThrow(
        /Cannot create new job.*already running/
      )
      expect(mockStorage.createJob).not.toHaveBeenCalled()
    })

    it('should use checkpoint timestamp for staleness check', async () => {
      // Arrange
      const request = createTestRequest()
      const oldCreatedTime = new Date(Date.now() - 20 * 60 * 1000).toISOString() // 20 minutes ago
      const recentCheckpointTime = new Date(
        Date.now() - 5 * 60 * 1000
      ).toISOString() // 5 minutes ago
      const jobWithRecentCheckpoint = createTestJob({
        jobId: 'checkpoint-job',
        status: 'running',
        startedAt: oldCreatedTime,
        createdAt: oldCreatedTime,
        checkpoint: {
          lastProcessedItem: 'item-5',
          lastProcessedAt: recentCheckpointTime,
          itemsCompleted: ['item-1', 'item-2', 'item-3', 'item-4', 'item-5'],
        },
      })
      mockStorage.getActiveJob.mockResolvedValue(jobWithRecentCheckpoint)

      // Act & Assert - Job should NOT be considered stale due to recent checkpoint
      await expect(jobManager.createJob(request)).rejects.toThrow(
        /Cannot create new job.*already running/
      )
      expect(mockStorage.createJob).not.toHaveBeenCalled()
    })

    it('should initialize job with correct default values', async () => {
      // Arrange
      const request = createTestRequest({
        jobType: 'analytics-generation',
        targetDistricts: ['42', '61'],
      })
      mockStorage.getActiveJob.mockResolvedValue(null)

      // Act
      const job = await jobManager.createJob(request)

      // Assert
      expect(job.status).toBe('pending')
      expect(job.progress.totalItems).toBe(0)
      expect(job.progress.processedItems).toBe(0)
      expect(job.progress.failedItems).toBe(0)
      expect(job.progress.skippedItems).toBe(0)
      expect(job.progress.currentItem).toBeNull()
      expect(job.progress.errors).toEqual([])
      expect(job.checkpoint).toBeNull()
      expect(job.startedAt).toBeNull()
      expect(job.completedAt).toBeNull()
      expect(job.resumedAt).toBeNull()
      expect(job.result).toBeNull()
      expect(job.error).toBeNull()
      expect(job.config.targetDistricts).toEqual(['42', '61'])
      expect(job.config.skipExisting).toBe(true) // Default value
    })
  })

  // ============================================================================
  // startJob Tests
  // ============================================================================

  describe('startJob', () => {
    it('should transition pending job to running', async () => {
      // Arrange
      const jobId = createUniqueJobId()

      // Act
      await jobManager.startJob(jobId)

      // Assert
      expect(mockStorage.updateJob).toHaveBeenCalledWith(
        jobId,
        expect.objectContaining({
          status: 'running',
          startedAt: expect.any(String),
        })
      )
    })

    it('should set startedAt timestamp', async () => {
      // Arrange
      const jobId = createUniqueJobId()
      const beforeStart = new Date().toISOString()

      // Act
      await jobManager.startJob(jobId)

      // Assert
      const updateCall = mockStorage.updateJob.mock.calls[0]
      expect(updateCall).toBeDefined()
      const updates = updateCall[1] as Partial<BackfillJob>
      expect(updates.startedAt).toBeDefined()
      expect(new Date(updates.startedAt!).getTime()).toBeGreaterThanOrEqual(
        new Date(beforeStart).getTime()
      )
    })
  })

  // ============================================================================
  // completeJob Tests
  // ============================================================================

  describe('completeJob', () => {
    it('should mark job as completed with result', async () => {
      // Arrange
      const jobId = createUniqueJobId()
      const result = createTestResult()
      mockStorage.getJob.mockResolvedValue(createTestJob({ jobId }))

      // Act
      await jobManager.completeJob(jobId, result)

      // Assert
      expect(mockStorage.updateJob).toHaveBeenCalledWith(
        jobId,
        expect.objectContaining({
          status: 'completed',
          completedAt: expect.any(String),
          result,
        })
      )
    })

    it('should set completedAt timestamp', async () => {
      // Arrange
      const jobId = createUniqueJobId()
      const result = createTestResult()
      mockStorage.getJob.mockResolvedValue(createTestJob({ jobId }))
      const beforeComplete = new Date().toISOString()

      // Act
      await jobManager.completeJob(jobId, result)

      // Assert
      const updateCall = mockStorage.updateJob.mock.calls[0]
      expect(updateCall).toBeDefined()
      const updates = updateCall[1] as Partial<BackfillJob>
      expect(updates.completedAt).toBeDefined()
      expect(new Date(updates.completedAt!).getTime()).toBeGreaterThanOrEqual(
        new Date(beforeComplete).getTime()
      )
    })
  })

  // ============================================================================
  // failJob Tests
  // ============================================================================

  describe('failJob', () => {
    it('should mark job as failed with error', async () => {
      // Arrange
      const jobId = createUniqueJobId()
      const errorMessage = 'Test error: something went wrong'
      mockStorage.getJob.mockResolvedValue(createTestJob({ jobId }))

      // Act
      await jobManager.failJob(jobId, errorMessage)

      // Assert
      expect(mockStorage.updateJob).toHaveBeenCalledWith(
        jobId,
        expect.objectContaining({
          status: 'failed',
          completedAt: expect.any(String),
          error: errorMessage,
        })
      )
    })

    it('should set completedAt timestamp on failure', async () => {
      // Arrange
      const jobId = createUniqueJobId()
      mockStorage.getJob.mockResolvedValue(createTestJob({ jobId }))
      const beforeFail = new Date().toISOString()

      // Act
      await jobManager.failJob(jobId, 'Error')

      // Assert
      const updateCall = mockStorage.updateJob.mock.calls[0]
      expect(updateCall).toBeDefined()
      const updates = updateCall[1] as Partial<BackfillJob>
      expect(updates.completedAt).toBeDefined()
      expect(new Date(updates.completedAt!).getTime()).toBeGreaterThanOrEqual(
        new Date(beforeFail).getTime()
      )
    })
  })

  // ============================================================================
  // cancelJob Tests (Requirements 7.2, 7.3)
  // ============================================================================

  describe('cancelJob', () => {
    it('should cancel running job and return true', async () => {
      // Arrange
      const runningJob = createTestJob({
        status: 'running',
        startedAt: new Date().toISOString(),
      })
      mockStorage.getJob.mockResolvedValue(runningJob)

      // Act
      const result = await jobManager.cancelJob(runningJob.jobId)

      // Assert
      expect(result).toBe(true)
      expect(mockStorage.updateJob).toHaveBeenCalledWith(
        runningJob.jobId,
        expect.objectContaining({
          status: 'cancelled',
          completedAt: expect.any(String),
        })
      )
    })

    it('should cancel pending job and return true', async () => {
      // Arrange
      const pendingJob = createTestJob({ status: 'pending' })
      mockStorage.getJob.mockResolvedValue(pendingJob)

      // Act
      const result = await jobManager.cancelJob(pendingJob.jobId)

      // Assert
      expect(result).toBe(true)
      expect(mockStorage.updateJob).toHaveBeenCalledWith(
        pendingJob.jobId,
        expect.objectContaining({
          status: 'cancelled',
        })
      )
    })

    it('should return false for completed job', async () => {
      // Arrange
      const completedJob = createTestJob({
        status: 'completed',
        completedAt: new Date().toISOString(),
        result: createTestResult(),
      })
      mockStorage.getJob.mockResolvedValue(completedJob)

      // Act
      const result = await jobManager.cancelJob(completedJob.jobId)

      // Assert
      expect(result).toBe(false)
      expect(mockStorage.updateJob).not.toHaveBeenCalled()
    })

    it('should return false for failed job', async () => {
      // Arrange
      const failedJob = createTestJob({
        status: 'failed',
        completedAt: new Date().toISOString(),
        error: 'Previous error',
      })
      mockStorage.getJob.mockResolvedValue(failedJob)

      // Act
      const result = await jobManager.cancelJob(failedJob.jobId)

      // Assert
      expect(result).toBe(false)
      expect(mockStorage.updateJob).not.toHaveBeenCalled()
    })

    it('should return false for non-existent job', async () => {
      // Arrange
      mockStorage.getJob.mockResolvedValue(null)

      // Act
      const result = await jobManager.cancelJob('non-existent-job-id')

      // Assert
      expect(result).toBe(false)
      expect(mockStorage.updateJob).not.toHaveBeenCalled()
    })

    it('should return false for already cancelled job', async () => {
      // Arrange
      const cancelledJob = createTestJob({
        status: 'cancelled',
        completedAt: new Date().toISOString(),
      })
      mockStorage.getJob.mockResolvedValue(cancelledJob)

      // Act
      const result = await jobManager.cancelJob(cancelledJob.jobId)

      // Assert
      expect(result).toBe(false)
      expect(mockStorage.updateJob).not.toHaveBeenCalled()
    })
  })

  // ============================================================================
  // canStartNewJob Tests (Requirements 3.1, 3.4)
  // ============================================================================

  describe('canStartNewJob', () => {
    it('should return true when no active job', async () => {
      // Arrange
      mockStorage.getActiveJob.mockResolvedValue(null)

      // Act
      const canStart = await jobManager.canStartNewJob()

      // Assert
      expect(canStart).toBe(true)
    })

    it('should return false when job is running', async () => {
      // Arrange
      const runningJob = createTestJob({
        status: 'running',
        startedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      })
      mockStorage.getActiveJob.mockResolvedValue(runningJob)

      // Act
      const canStart = await jobManager.canStartNewJob()

      // Assert
      expect(canStart).toBe(false)
    })

    it('should return true when active job is stale', async () => {
      // Arrange
      const staleTime = new Date(Date.now() - 11 * 60 * 1000).toISOString() // 11 minutes ago
      const staleJob = createTestJob({
        status: 'running',
        startedAt: staleTime,
        createdAt: staleTime,
      })
      mockStorage.getActiveJob.mockResolvedValue(staleJob)
      mockStorage.getJob.mockResolvedValue(staleJob)

      // Act
      const canStart = await jobManager.canStartNewJob()

      // Assert
      expect(canStart).toBe(true)
      // Stale job should be marked as failed
      expect(mockStorage.updateJob).toHaveBeenCalledWith(
        staleJob.jobId,
        expect.objectContaining({
          status: 'failed',
        })
      )
    })

    it('should return false when job is recovering', async () => {
      // Arrange
      const recoveringJob = createTestJob({
        status: 'recovering',
        resumedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      })
      mockStorage.getActiveJob.mockResolvedValue(recoveringJob)

      // Act
      const canStart = await jobManager.canStartNewJob()

      // Assert
      expect(canStart).toBe(false)
    })
  })

  // ============================================================================
  // updateProgress Tests (Batching)
  // ============================================================================

  describe('updateProgress', () => {
    it('should batch updates and persist within 5 seconds', async () => {
      // Arrange
      const job = createTestJob({ status: 'running' })
      mockStorage.getJob.mockResolvedValue(job)

      // Act - Queue multiple progress updates
      await jobManager.updateProgress(job.jobId, { processedItems: 1 })
      await jobManager.updateProgress(job.jobId, { processedItems: 2 })
      await jobManager.updateProgress(job.jobId, { processedItems: 3 })

      // Assert - No immediate persistence
      expect(mockStorage.updateJob).not.toHaveBeenCalled()

      // Advance timers to trigger batch persistence
      await vi.advanceTimersByTimeAsync(5000)

      // Assert - Now persisted
      expect(mockStorage.updateJob).toHaveBeenCalled()
    })

    it('should merge multiple progress updates', async () => {
      // Arrange
      const job = createTestJob({ status: 'running' })
      mockStorage.getJob.mockResolvedValue(job)

      // Act - Queue multiple progress updates with different fields
      await jobManager.updateProgress(job.jobId, { processedItems: 5 })
      await jobManager.updateProgress(job.jobId, { currentItem: 'item-5' })
      await jobManager.updateProgress(job.jobId, { failedItems: 1 })

      // Advance timers to trigger batch persistence
      await vi.advanceTimersByTimeAsync(5000)

      // Assert - All updates merged
      expect(mockStorage.updateJob).toHaveBeenCalledWith(
        job.jobId,
        expect.objectContaining({
          progress: expect.objectContaining({
            processedItems: 5,
            currentItem: 'item-5',
            failedItems: 1,
          }),
        })
      )
    })
  })

  // ============================================================================
  // updateCheckpoint Tests
  // ============================================================================

  describe('updateCheckpoint', () => {
    it('should persist checkpoint immediately (not batched)', async () => {
      // Arrange
      const jobId = createUniqueJobId()
      const checkpoint = createTestCheckpoint()

      // Act
      await jobManager.updateCheckpoint(jobId, checkpoint)

      // Assert - Immediate persistence, no timer needed
      expect(mockStorage.updateCheckpoint).toHaveBeenCalledWith(
        jobId,
        checkpoint
      )
    })

    it('should persist checkpoint with all fields', async () => {
      // Arrange
      const jobId = createUniqueJobId()
      const checkpoint = createTestCheckpoint({
        lastProcessedItem: 'item-50',
        lastProcessedAt: '2024-01-15T12:00:00.000Z',
        itemsCompleted: ['item-1', 'item-2', 'item-50'],
      })

      // Act
      await jobManager.updateCheckpoint(jobId, checkpoint)

      // Assert
      expect(mockStorage.updateCheckpoint).toHaveBeenCalledWith(jobId, {
        lastProcessedItem: 'item-50',
        lastProcessedAt: '2024-01-15T12:00:00.000Z',
        itemsCompleted: ['item-1', 'item-2', 'item-50'],
      })
    })
  })

  // ============================================================================
  // dispose Tests
  // ============================================================================

  describe('dispose', () => {
    it('should flush pending updates on dispose', async () => {
      // Arrange
      const job = createTestJob({ status: 'running' })
      mockStorage.getJob.mockResolvedValue(job)

      // Queue a progress update
      await jobManager.updateProgress(job.jobId, { processedItems: 10 })

      // Assert - Not yet persisted
      expect(mockStorage.updateJob).not.toHaveBeenCalled()

      // Act - Dispose the manager
      await jobManager.dispose()

      // Assert - Now persisted
      expect(mockStorage.updateJob).toHaveBeenCalled()
    })

    it('should handle dispose with no pending updates', async () => {
      // Act & Assert - Should not throw
      await expect(jobManager.dispose()).resolves.not.toThrow()
    })

    it('should flush updates for multiple jobs on dispose', async () => {
      // Arrange
      const job1 = createTestJob({ jobId: 'job-1', status: 'running' })
      const job2 = createTestJob({ jobId: 'job-2', status: 'running' })
      mockStorage.getJob.mockResolvedValueOnce(job1).mockResolvedValueOnce(job2)

      // Queue progress updates for both jobs
      await jobManager.updateProgress(job1.jobId, { processedItems: 5 })
      await jobManager.updateProgress(job2.jobId, { processedItems: 10 })

      // Act
      await jobManager.dispose()

      // Assert - Both jobs should have their updates persisted
      expect(mockStorage.updateJob).toHaveBeenCalledTimes(2)
    })
  })

  // ============================================================================
  // getJob Tests
  // ============================================================================

  describe('getJob', () => {
    it('should return job when exists', async () => {
      // Arrange
      const job = createTestJob()
      mockStorage.getJob.mockResolvedValue(job)

      // Act
      const result = await jobManager.getJob(job.jobId)

      // Assert
      expect(result).toEqual(job)
      expect(mockStorage.getJob).toHaveBeenCalledWith(job.jobId)
    })

    it('should return null for non-existent job', async () => {
      // Arrange
      mockStorage.getJob.mockResolvedValue(null)

      // Act
      const result = await jobManager.getJob('non-existent')

      // Assert
      expect(result).toBeNull()
    })
  })

  // ============================================================================
  // getActiveJob Tests
  // ============================================================================

  describe('getActiveJob', () => {
    it('should return active job when exists', async () => {
      // Arrange
      const activeJob = createTestJob({ status: 'running' })
      mockStorage.getActiveJob.mockResolvedValue(activeJob)

      // Act
      const result = await jobManager.getActiveJob()

      // Assert
      expect(result).toEqual(activeJob)
    })

    it('should return null when no active job', async () => {
      // Arrange
      mockStorage.getActiveJob.mockResolvedValue(null)

      // Act
      const result = await jobManager.getActiveJob()

      // Assert
      expect(result).toBeNull()
    })
  })
})
