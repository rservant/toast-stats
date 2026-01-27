/**
 * FirestoreBackfillJobStorage Unit Tests
 *
 * Tests the FirestoreBackfillJobStorage implementation with mocked Firestore client.
 * Validates Requirements 1.2, 1.5 from the Unified Backfill Service spec.
 *
 * Test Isolation Requirements (per testing steering document):
 * - Each test uses mocked Firestore client
 * - Tests clean up all mocks in afterEach hooks
 * - Tests do not depend on execution order
 * - All tests pass when run with --run (parallel mode)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Mock } from 'vitest'
import { StorageOperationError } from '../../../types/storageInterfaces.js'
import type {
  IBackfillJobStorage,
  BackfillJob,
  BackfillJobStatus,
  BackfillJobType,
  JobCheckpoint,
  RateLimitConfig,
} from '../../../types/storageInterfaces.js'

// ============================================================================
// Mock Types for Firestore
// ============================================================================

interface MockDocumentSnapshot {
  exists: boolean
  id: string
  data: () => Record<string, unknown> | undefined
}

interface MockQuerySnapshot {
  empty: boolean
  docs: MockDocumentSnapshot[]
  size: number
}

interface MockDocumentReference {
  get: Mock
  set: Mock
  update: Mock
  delete: Mock
}

interface MockQuery {
  get: Mock
  where: Mock
  orderBy: Mock
  limit: Mock
}

interface MockCollectionReference extends MockQuery {
  doc: Mock
}

// ============================================================================
// Mock Variables (hoisted)
// ============================================================================

let mockDocRef: MockDocumentReference
let mockCollection: MockCollectionReference
let mockFirestoreDoc: Mock

// ============================================================================
// Mock Setup - Must be before imports that use the mocked modules
// ============================================================================

/**
 * Create a chainable mock query
 */
const createMockQuery = (): MockQuery => {
  const query: MockQuery = {
    get: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
  }
  // Make chainable
  query.where.mockReturnValue(query)
  query.orderBy.mockReturnValue(query)
  query.limit.mockReturnValue(query)
  return query
}

/**
 * Create a mock collection reference
 */
const createMockCollection = (): MockCollectionReference => {
  const query = createMockQuery()
  return {
    ...query,
    doc: vi.fn(),
  }
}

/**
 * Create a mock document reference
 */
const createMockDocRef = (): MockDocumentReference => ({
  get: vi.fn(),
  set: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
})

// Mock the @google-cloud/firestore module
vi.mock('@google-cloud/firestore', () => {
  const MockFirestore = function (this: Record<string, unknown>) {
    mockDocRef = createMockDocRef()
    mockCollection = createMockCollection()
    mockCollection.doc.mockReturnValue(mockDocRef)

    this.collection = vi.fn().mockReturnValue(mockCollection)
    // Mock the doc method for rate limit config path
    mockFirestoreDoc = vi.fn().mockReturnValue(mockDocRef)
    this.doc = mockFirestoreDoc
  }

  return {
    Firestore: MockFirestore,
  }
})

// Mock the logger to avoid console output during tests
vi.mock('../../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// Mock the CircuitBreaker to avoid actual circuit breaker behavior
vi.mock('../../../utils/CircuitBreaker.js', () => ({
  CircuitBreaker: {
    createCacheCircuitBreaker: vi.fn(() => ({
      execute: vi.fn(async <T>(operation: () => Promise<T>) => operation()),
      getStats: vi.fn(() => ({
        state: 'CLOSED',
        failureCount: 0,
        successCount: 0,
        totalRequests: 0,
        totalFailures: 0,
        totalSuccesses: 0,
      })),
      reset: vi.fn(),
    })),
  },
}))

// Import after mocks are set up
import { FirestoreBackfillJobStorage } from '../FirestoreBackfillJobStorage.js'

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a mock document snapshot
 */
function createMockDocSnapshot(
  exists: boolean,
  id: string,
  data?: Record<string, unknown>
): MockDocumentSnapshot {
  return {
    exists,
    id,
    data: () => data,
  }
}

/**
 * Create a mock query snapshot
 */
function createMockQuerySnapshot(
  docs: MockDocumentSnapshot[]
): MockQuerySnapshot {
  return {
    empty: docs.length === 0,
    docs,
    size: docs.length,
  }
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

/**
 * Convert a BackfillJob to Firestore document format
 */
function toFirestoreDoc(job: BackfillJob): Record<string, unknown> {
  const doc: Record<string, unknown> = {
    jobId: job.jobId,
    jobType: job.jobType,
    status: job.status,
    config: job.config,
    progress: job.progress,
    createdAt: job.createdAt,
  }

  if (job.checkpoint !== null) {
    doc['checkpoint'] = job.checkpoint
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
    doc['result'] = job.result
  }
  if (job.error !== null) {
    doc['error'] = job.error
  }

  return doc
}

// ============================================================================
// Test Suite
// ============================================================================

describe('FirestoreBackfillJobStorage', () => {
  let storage: IBackfillJobStorage

  beforeEach(() => {
    vi.clearAllMocks()
    storage = new FirestoreBackfillJobStorage({
      projectId: 'test-project',
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
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
  // Graceful Initialization Tests (Requirement 1.5)
  // ============================================================================

  describe('Graceful Initialization', () => {
    it('should return default rate limit config if missing', async () => {
      // Mock config document doesn't exist
      mockDocRef.get.mockResolvedValue(
        createMockDocSnapshot(false, 'rate-limit')
      )
      mockDocRef.set.mockResolvedValue(undefined)

      const config = await storage.getRateLimitConfig()

      expect(config.maxRequestsPerMinute).toBe(10)
      expect(config.maxConcurrent).toBe(3)
      expect(config.minDelayMs).toBe(2000)
      expect(config.maxDelayMs).toBe(30000)
      expect(config.backoffMultiplier).toBe(2)
    })

    it('should create config with defaults when missing', async () => {
      mockDocRef.get.mockResolvedValue(
        createMockDocSnapshot(false, 'rate-limit')
      )
      mockDocRef.set.mockResolvedValue(undefined)

      await storage.getRateLimitConfig()

      // Verify set was called to persist defaults
      expect(mockDocRef.set).toHaveBeenCalled()
    })

    it('should return true from isReady when Firestore is accessible', async () => {
      mockDocRef.get.mockResolvedValue(
        createMockDocSnapshot(false, 'rate-limit')
      )

      const isReady = await storage.isReady()
      expect(isReady).toBe(true)
    })

    it('should return false from isReady when Firestore is not accessible', async () => {
      mockDocRef.get.mockRejectedValue(new Error('Connection failed'))

      const isReady = await storage.isReady()
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

        // Mock: job doesn't exist yet
        mockDocRef.get.mockResolvedValue(
          createMockDocSnapshot(false, job.jobId)
        )
        mockDocRef.set.mockResolvedValue(undefined)

        await expect(storage.createJob(job)).resolves.not.toThrow()

        expect(mockDocRef.set).toHaveBeenCalled()
      })

      it('should throw on duplicate job ID', async () => {
        const job = createTestJob()

        // Mock: job already exists
        mockDocRef.get.mockResolvedValue(
          createMockDocSnapshot(true, job.jobId, toFirestoreDoc(job))
        )

        await expect(storage.createJob(job)).rejects.toThrow(
          StorageOperationError
        )
      })

      it('should throw StorageOperationError with correct context on duplicate', async () => {
        const job = createTestJob()

        mockDocRef.get.mockResolvedValue(
          createMockDocSnapshot(true, job.jobId, toFirestoreDoc(job))
        )

        try {
          await storage.createJob(job)
          expect.fail('Should have thrown')
        } catch (error) {
          expect(error).toBeInstanceOf(StorageOperationError)
          const storageError = error as StorageOperationError
          expect(storageError.operation).toBe('createJob')
          expect(storageError.provider).toBe('firestore')
          expect(storageError.message).toContain(job.jobId)
        }
      })

      it('should handle both job types', async () => {
        const dataJob = createTestJob({ jobType: 'data-collection' })
        const analyticsJob = createTestJob({ jobType: 'analytics-generation' })

        mockDocRef.get.mockResolvedValue(createMockDocSnapshot(false, 'any'))
        mockDocRef.set.mockResolvedValue(undefined)

        await expect(storage.createJob(dataJob)).resolves.not.toThrow()
        await expect(storage.createJob(analyticsJob)).resolves.not.toThrow()
      })

      it('should throw StorageOperationError on Firestore write failure', async () => {
        const job = createTestJob()

        mockDocRef.get.mockResolvedValue(
          createMockDocSnapshot(false, job.jobId)
        )
        mockDocRef.set.mockRejectedValue(new Error('Write failed'))

        await expect(storage.createJob(job)).rejects.toThrow(
          StorageOperationError
        )
      })
    })

    describe('getJob', () => {
      it('should return job when exists', async () => {
        const job = createTestJob()

        mockDocRef.get.mockResolvedValue(
          createMockDocSnapshot(true, job.jobId, toFirestoreDoc(job))
        )

        const retrieved = await storage.getJob(job.jobId)

        expect(retrieved).not.toBeNull()
        expect(retrieved?.jobId).toBe(job.jobId)
        expect(retrieved?.jobType).toBe(job.jobType)
        expect(retrieved?.status).toBe(job.status)
      })

      it('should return null for non-existent job', async () => {
        mockDocRef.get.mockResolvedValue(
          createMockDocSnapshot(false, 'non-existent')
        )

        const result = await storage.getJob('non-existent-job-id')
        expect(result).toBeNull()
      })

      it('should return null for job with invalid structure', async () => {
        mockDocRef.get.mockResolvedValue(
          createMockDocSnapshot(true, 'invalid-job', { someField: 'value' })
        )

        const result = await storage.getJob('invalid-job')
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

        mockDocRef.get.mockResolvedValue(
          createMockDocSnapshot(true, job.jobId, toFirestoreDoc(job))
        )

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

      it('should throw StorageOperationError on Firestore read failure', async () => {
        mockDocRef.get.mockRejectedValue(new Error('Read failed'))

        await expect(storage.getJob('any-job')).rejects.toThrow(
          StorageOperationError
        )
      })
    })

    describe('updateJob', () => {
      it('should update job fields', async () => {
        const job = createTestJob({ status: 'pending' })

        // First call: check job exists
        mockDocRef.get.mockResolvedValue(
          createMockDocSnapshot(true, job.jobId, toFirestoreDoc(job))
        )
        mockDocRef.update.mockResolvedValue(undefined)

        await storage.updateJob(job.jobId, {
          status: 'running',
          startedAt: new Date().toISOString(),
        })

        expect(mockDocRef.update).toHaveBeenCalled()
      })

      it('should throw on non-existent job', async () => {
        mockDocRef.get.mockResolvedValue(
          createMockDocSnapshot(false, 'non-existent')
        )

        await expect(
          storage.updateJob('non-existent-job', { status: 'running' })
        ).rejects.toThrow(StorageOperationError)
      })

      it('should throw StorageOperationError with correct context', async () => {
        mockDocRef.get.mockResolvedValue(
          createMockDocSnapshot(false, 'non-existent')
        )

        try {
          await storage.updateJob('non-existent-job', { status: 'running' })
          expect.fail('Should have thrown')
        } catch (error) {
          expect(error).toBeInstanceOf(StorageOperationError)
          const storageError = error as StorageOperationError
          expect(storageError.operation).toBe('updateJob')
          expect(storageError.provider).toBe('firestore')
        }
      })

      it('should throw StorageOperationError on Firestore update failure', async () => {
        const job = createTestJob()

        mockDocRef.get.mockResolvedValue(
          createMockDocSnapshot(true, job.jobId, toFirestoreDoc(job))
        )
        mockDocRef.update.mockRejectedValue(new Error('Update failed'))

        await expect(
          storage.updateJob(job.jobId, { status: 'running' })
        ).rejects.toThrow(StorageOperationError)
      })
    })

    describe('deleteJob', () => {
      it('should delete existing job', async () => {
        const job = createTestJob()

        mockDocRef.get.mockResolvedValue(
          createMockDocSnapshot(true, job.jobId, toFirestoreDoc(job))
        )
        mockDocRef.delete.mockResolvedValue(undefined)

        const deleted = await storage.deleteJob(job.jobId)

        expect(deleted).toBe(true)
        expect(mockDocRef.delete).toHaveBeenCalled()
      })

      it('should return false for non-existent job', async () => {
        mockDocRef.get.mockResolvedValue(
          createMockDocSnapshot(false, 'non-existent')
        )

        const deleted = await storage.deleteJob('non-existent-job')

        expect(deleted).toBe(false)
        expect(mockDocRef.delete).not.toHaveBeenCalled()
      })

      it('should throw StorageOperationError on Firestore delete failure', async () => {
        const job = createTestJob()

        mockDocRef.get.mockResolvedValue(
          createMockDocSnapshot(true, job.jobId, toFirestoreDoc(job))
        )
        mockDocRef.delete.mockRejectedValue(new Error('Delete failed'))

        await expect(storage.deleteJob(job.jobId)).rejects.toThrow(
          StorageOperationError
        )
      })
    })
  })

  // ============================================================================
  // Job Query Tests
  // ============================================================================

  describe('Job Queries', () => {
    describe('listJobs', () => {
      it('should return empty array when no jobs exist', async () => {
        mockCollection.get.mockResolvedValue(createMockQuerySnapshot([]))

        const jobs = await storage.listJobs()
        expect(jobs).toEqual([])
      })

      it('should return all jobs sorted by creation time (newest first)', async () => {
        const job1 = createTestJob({
          jobId: 'job-1',
          createdAt: '2024-01-01T10:00:00.000Z',
        })
        const job2 = createTestJob({
          jobId: 'job-2',
          createdAt: '2024-01-02T10:00:00.000Z',
        })
        const job3 = createTestJob({
          jobId: 'job-3',
          createdAt: '2024-01-03T10:00:00.000Z',
        })

        // Firestore returns in order (newest first due to orderBy)
        mockCollection.get.mockResolvedValue(
          createMockQuerySnapshot([
            createMockDocSnapshot(true, job3.jobId, toFirestoreDoc(job3)),
            createMockDocSnapshot(true, job2.jobId, toFirestoreDoc(job2)),
            createMockDocSnapshot(true, job1.jobId, toFirestoreDoc(job1)),
          ])
        )

        const jobs = await storage.listJobs()

        expect(jobs.length).toBe(3)
        expect(jobs[0]?.jobId).toBe(job3.jobId) // Newest first
        expect(jobs[1]?.jobId).toBe(job2.jobId)
        expect(jobs[2]?.jobId).toBe(job1.jobId)
      })

      it('should filter by status', async () => {
        const runningJob = createTestJob({
          jobId: 'running-job',
          status: 'running',
        })

        mockCollection.get.mockResolvedValue(
          createMockQuerySnapshot([
            createMockDocSnapshot(
              true,
              runningJob.jobId,
              toFirestoreDoc(runningJob)
            ),
          ])
        )

        const jobs = await storage.listJobs({ status: ['running'] })

        expect(jobs.length).toBe(1)
        expect(jobs[0]?.status).toBe('running')
        expect(mockCollection.where).toHaveBeenCalledWith('status', 'in', [
          'running',
        ])
      })

      it('should filter by jobType', async () => {
        const dataJob = createTestJob({
          jobId: 'data-job',
          jobType: 'data-collection',
        })

        mockCollection.get.mockResolvedValue(
          createMockQuerySnapshot([
            createMockDocSnapshot(true, dataJob.jobId, toFirestoreDoc(dataJob)),
          ])
        )

        const jobs = await storage.listJobs({ jobType: ['data-collection'] })

        expect(jobs.length).toBe(1)
        expect(jobs[0]?.jobType).toBe('data-collection')
        expect(mockCollection.where).toHaveBeenCalledWith('jobType', 'in', [
          'data-collection',
        ])
      })

      it('should apply pagination with limit', async () => {
        const job1 = createTestJob({ jobId: 'job-1' })
        const job2 = createTestJob({ jobId: 'job-2' })
        const job3 = createTestJob({ jobId: 'job-3' })

        mockCollection.get.mockResolvedValue(
          createMockQuerySnapshot([
            createMockDocSnapshot(true, job1.jobId, toFirestoreDoc(job1)),
            createMockDocSnapshot(true, job2.jobId, toFirestoreDoc(job2)),
            createMockDocSnapshot(true, job3.jobId, toFirestoreDoc(job3)),
          ])
        )

        const jobs = await storage.listJobs({ limit: 2 })

        expect(jobs.length).toBe(2)
      })

      it('should apply pagination with offset', async () => {
        const job1 = createTestJob({
          jobId: 'job-1',
          createdAt: '2024-01-03T10:00:00.000Z',
        })
        const job2 = createTestJob({
          jobId: 'job-2',
          createdAt: '2024-01-02T10:00:00.000Z',
        })
        const job3 = createTestJob({
          jobId: 'job-3',
          createdAt: '2024-01-01T10:00:00.000Z',
        })

        mockCollection.get.mockResolvedValue(
          createMockQuerySnapshot([
            createMockDocSnapshot(true, job1.jobId, toFirestoreDoc(job1)),
            createMockDocSnapshot(true, job2.jobId, toFirestoreDoc(job2)),
            createMockDocSnapshot(true, job3.jobId, toFirestoreDoc(job3)),
          ])
        )

        const jobs = await storage.listJobs({ offset: 1, limit: 2 })

        expect(jobs.length).toBe(2)
        expect(jobs[0]?.jobId).toBe(job2.jobId)
        expect(jobs[1]?.jobId).toBe(job3.jobId)
      })

      it('should filter by date range (startDateFrom)', async () => {
        const oldJob = createTestJob({
          jobId: 'old-job',
          createdAt: '2024-01-01T10:00:00.000Z',
        })
        const newJob = createTestJob({
          jobId: 'new-job',
          createdAt: '2024-02-01T10:00:00.000Z',
        })

        mockCollection.get.mockResolvedValue(
          createMockQuerySnapshot([
            createMockDocSnapshot(true, newJob.jobId, toFirestoreDoc(newJob)),
            createMockDocSnapshot(true, oldJob.jobId, toFirestoreDoc(oldJob)),
          ])
        )

        const jobs = await storage.listJobs({
          startDateFrom: '2024-01-15T00:00:00.000Z',
        })

        expect(jobs.length).toBe(1)
        expect(jobs[0]?.jobId).toBe(newJob.jobId)
      })

      it('should filter by date range (startDateTo)', async () => {
        const oldJob = createTestJob({
          jobId: 'old-job',
          createdAt: '2024-01-01T10:00:00.000Z',
        })
        const newJob = createTestJob({
          jobId: 'new-job',
          createdAt: '2024-02-01T10:00:00.000Z',
        })

        mockCollection.get.mockResolvedValue(
          createMockQuerySnapshot([
            createMockDocSnapshot(true, newJob.jobId, toFirestoreDoc(newJob)),
            createMockDocSnapshot(true, oldJob.jobId, toFirestoreDoc(oldJob)),
          ])
        )

        const jobs = await storage.listJobs({
          startDateTo: '2024-01-15T00:00:00.000Z',
        })

        expect(jobs.length).toBe(1)
        expect(jobs[0]?.jobId).toBe(oldJob.jobId)
      })

      it('should skip invalid job documents when listing', async () => {
        const validJob = createTestJob({ jobId: 'valid-job' })

        mockCollection.get.mockResolvedValue(
          createMockQuerySnapshot([
            createMockDocSnapshot(
              true,
              validJob.jobId,
              toFirestoreDoc(validJob)
            ),
            createMockDocSnapshot(true, 'invalid-job', { someField: 'value' }),
          ])
        )

        const jobs = await storage.listJobs()

        expect(jobs.length).toBe(1)
        expect(jobs[0]?.jobId).toBe(validJob.jobId)
      })

      it('should return empty array on index error', async () => {
        mockCollection.get.mockRejectedValue(
          new Error(
            '9 FAILED_PRECONDITION: The query requires an index. You can create it here: https://console.firebase.google.com'
          )
        )

        const jobs = await storage.listJobs()

        expect(jobs).toEqual([])
      })

      it('should throw StorageOperationError on non-index Firestore error', async () => {
        mockCollection.get.mockRejectedValue(new Error('Connection failed'))

        await expect(storage.listJobs()).rejects.toThrow(StorageOperationError)
      })
    })

    describe('getActiveJob', () => {
      it('should return null when no active job exists', async () => {
        mockCollection.get.mockResolvedValue(createMockQuerySnapshot([]))

        const activeJob = await storage.getActiveJob()
        expect(activeJob).toBeNull()
      })

      it('should return running job', async () => {
        const runningJob = createTestJob({
          jobId: 'running-job',
          status: 'running',
        })

        mockCollection.get.mockResolvedValue(
          createMockQuerySnapshot([
            createMockDocSnapshot(
              true,
              runningJob.jobId,
              toFirestoreDoc(runningJob)
            ),
          ])
        )

        const activeJob = await storage.getActiveJob()

        expect(activeJob).not.toBeNull()
        expect(activeJob?.jobId).toBe(runningJob.jobId)
        expect(activeJob?.status).toBe('running')
      })

      it('should return recovering job', async () => {
        const recoveringJob = createTestJob({
          jobId: 'recovering-job',
          status: 'recovering',
        })

        mockCollection.get.mockResolvedValue(
          createMockQuerySnapshot([
            createMockDocSnapshot(
              true,
              recoveringJob.jobId,
              toFirestoreDoc(recoveringJob)
            ),
          ])
        )

        const activeJob = await storage.getActiveJob()

        expect(activeJob).not.toBeNull()
        expect(activeJob?.jobId).toBe(recoveringJob.jobId)
        expect(activeJob?.status).toBe('recovering')
      })

      it('should return most recent active job when multiple exist', async () => {
        const olderRunning = createTestJob({
          jobId: 'older-running',
          status: 'running',
          createdAt: '2024-01-01T10:00:00.000Z',
        })
        const newerRunning = createTestJob({
          jobId: 'newer-running',
          status: 'running',
          createdAt: '2024-01-02T10:00:00.000Z',
        })

        // Firestore returns newest first due to orderBy
        mockCollection.get.mockResolvedValue(
          createMockQuerySnapshot([
            createMockDocSnapshot(
              true,
              newerRunning.jobId,
              toFirestoreDoc(newerRunning)
            ),
            createMockDocSnapshot(
              true,
              olderRunning.jobId,
              toFirestoreDoc(olderRunning)
            ),
          ])
        )

        const activeJob = await storage.getActiveJob()

        expect(activeJob?.jobId).toBe(newerRunning.jobId)
      })
    })

    describe('getJobsByStatus', () => {
      it('should return jobs matching single status', async () => {
        const completedJob = createTestJob({
          jobId: 'completed-job',
          status: 'completed',
        })

        mockCollection.get.mockResolvedValue(
          createMockQuerySnapshot([
            createMockDocSnapshot(
              true,
              completedJob.jobId,
              toFirestoreDoc(completedJob)
            ),
          ])
        )

        const jobs = await storage.getJobsByStatus(['completed'])

        expect(jobs.length).toBe(1)
        expect(jobs[0]?.status).toBe('completed')
      })

      it('should return jobs matching multiple statuses', async () => {
        const completedJob = createTestJob({
          jobId: 'completed-job',
          status: 'completed',
        })
        const failedJob = createTestJob({
          jobId: 'failed-job',
          status: 'failed',
        })

        mockCollection.get.mockResolvedValue(
          createMockQuerySnapshot([
            createMockDocSnapshot(
              true,
              completedJob.jobId,
              toFirestoreDoc(completedJob)
            ),
            createMockDocSnapshot(
              true,
              failedJob.jobId,
              toFirestoreDoc(failedJob)
            ),
          ])
        )

        const jobs = await storage.getJobsByStatus(['completed', 'failed'])

        expect(jobs.length).toBe(2)
      })

      it('should return empty array when no jobs match', async () => {
        mockCollection.get.mockResolvedValue(createMockQuerySnapshot([]))

        const jobs = await storage.getJobsByStatus(['cancelled'])

        expect(jobs).toEqual([])
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
        const checkpoint = createTestCheckpoint()

        mockDocRef.get.mockResolvedValue(
          createMockDocSnapshot(true, job.jobId, toFirestoreDoc(job))
        )
        mockDocRef.update.mockResolvedValue(undefined)

        await expect(
          storage.updateCheckpoint(job.jobId, checkpoint)
        ).resolves.not.toThrow()

        expect(mockDocRef.update).toHaveBeenCalled()
      })

      it('should throw on non-existent job', async () => {
        const checkpoint = createTestCheckpoint()

        mockDocRef.get.mockResolvedValue(
          createMockDocSnapshot(false, 'non-existent')
        )

        await expect(
          storage.updateCheckpoint('non-existent-job', checkpoint)
        ).rejects.toThrow(StorageOperationError)
      })
    })

    describe('getCheckpoint', () => {
      it('should return checkpoint when exists', async () => {
        const checkpoint = createTestCheckpoint()
        const job = createTestJob({ checkpoint })

        mockDocRef.get.mockResolvedValue(
          createMockDocSnapshot(true, job.jobId, toFirestoreDoc(job))
        )

        const retrieved = await storage.getCheckpoint(job.jobId)

        expect(retrieved).not.toBeNull()
        expect(retrieved?.lastProcessedItem).toBe(checkpoint.lastProcessedItem)
        expect(retrieved?.itemsCompleted).toEqual(checkpoint.itemsCompleted)
      })

      it('should return null when no checkpoint exists', async () => {
        const job = createTestJob({ checkpoint: null })

        mockDocRef.get.mockResolvedValue(
          createMockDocSnapshot(true, job.jobId, toFirestoreDoc(job))
        )

        const checkpoint = await storage.getCheckpoint(job.jobId)
        expect(checkpoint).toBeNull()
      })

      it('should return null for non-existent job', async () => {
        mockDocRef.get.mockResolvedValue(
          createMockDocSnapshot(false, 'non-existent')
        )

        const checkpoint = await storage.getCheckpoint('non-existent-job')
        expect(checkpoint).toBeNull()
      })
    })
  })

  // ============================================================================
  // Rate Limit Configuration Tests
  // ============================================================================

  describe('Rate Limit Configuration', () => {
    describe('getRateLimitConfig', () => {
      it('should return defaults if config document missing', async () => {
        mockDocRef.get.mockResolvedValue(
          createMockDocSnapshot(false, 'rate-limit')
        )
        mockDocRef.set.mockResolvedValue(undefined)

        const config = await storage.getRateLimitConfig()

        expect(config.maxRequestsPerMinute).toBe(10)
        expect(config.maxConcurrent).toBe(3)
        expect(config.minDelayMs).toBe(2000)
        expect(config.maxDelayMs).toBe(30000)
        expect(config.backoffMultiplier).toBe(2)
      })

      it('should return saved config', async () => {
        const customConfig = createTestRateLimitConfig({
          maxRequestsPerMinute: 20,
          maxConcurrent: 5,
        })

        mockDocRef.get.mockResolvedValue(
          createMockDocSnapshot(
            true,
            'rate-limit',
            customConfig as unknown as Record<string, unknown>
          )
        )

        const retrieved = await storage.getRateLimitConfig()

        expect(retrieved.maxRequestsPerMinute).toBe(20)
        expect(retrieved.maxConcurrent).toBe(5)
      })

      it('should return defaults for invalid config structure', async () => {
        mockDocRef.get.mockResolvedValue(
          createMockDocSnapshot(true, 'rate-limit', { someField: 'value' })
        )

        const config = await storage.getRateLimitConfig()

        expect(config.maxRequestsPerMinute).toBe(10) // Default value
      })

      it('should throw StorageOperationError on Firestore read failure', async () => {
        mockDocRef.get.mockRejectedValue(new Error('Read failed'))

        await expect(storage.getRateLimitConfig()).rejects.toThrow(
          StorageOperationError
        )
      })
    })

    describe('setRateLimitConfig', () => {
      it('should persist config to Firestore', async () => {
        const config = createTestRateLimitConfig({
          maxRequestsPerMinute: 15,
        })

        mockDocRef.set.mockResolvedValue(undefined)

        await storage.setRateLimitConfig(config)

        expect(mockDocRef.set).toHaveBeenCalledWith({
          maxRequestsPerMinute: 15,
          maxConcurrent: 3,
          minDelayMs: 2000,
          maxDelayMs: 30000,
          backoffMultiplier: 2,
        })
      })

      it('should handle all config fields', async () => {
        const config = createTestRateLimitConfig({
          maxRequestsPerMinute: 30,
          maxConcurrent: 10,
          minDelayMs: 500,
          maxDelayMs: 60000,
          backoffMultiplier: 3,
        })

        mockDocRef.set.mockResolvedValue(undefined)

        await storage.setRateLimitConfig(config)

        expect(mockDocRef.set).toHaveBeenCalledWith({
          maxRequestsPerMinute: 30,
          maxConcurrent: 10,
          minDelayMs: 500,
          maxDelayMs: 60000,
          backoffMultiplier: 3,
        })
      })

      it('should throw StorageOperationError on Firestore write failure', async () => {
        const config = createTestRateLimitConfig()

        mockDocRef.set.mockRejectedValue(new Error('Write failed'))

        await expect(storage.setRateLimitConfig(config)).rejects.toThrow(
          StorageOperationError
        )
      })
    })
  })

  // ============================================================================
  // Cleanup Tests
  // ============================================================================

  describe('Cleanup Old Jobs', () => {
    describe('cleanupOldJobs', () => {
      it('should remove old terminal jobs', async () => {
        const oldDate = new Date()
        oldDate.setDate(oldDate.getDate() - 40)
        const oldJob = createTestJob({
          jobId: 'old-job',
          status: 'completed',
          createdAt: oldDate.toISOString(),
          completedAt: oldDate.toISOString(),
        })

        const recentJob = createTestJob({
          jobId: 'recent-job',
          status: 'completed',
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        })

        // listJobs returns terminal jobs
        mockCollection.get.mockResolvedValue(
          createMockQuerySnapshot([
            createMockDocSnapshot(true, oldJob.jobId, toFirestoreDoc(oldJob)),
            createMockDocSnapshot(
              true,
              recentJob.jobId,
              toFirestoreDoc(recentJob)
            ),
          ])
        )

        // deleteJob checks
        mockDocRef.get
          .mockResolvedValueOnce(
            createMockDocSnapshot(true, oldJob.jobId, toFirestoreDoc(oldJob))
          )
          .mockResolvedValueOnce(
            createMockDocSnapshot(
              true,
              recentJob.jobId,
              toFirestoreDoc(recentJob)
            )
          )
        mockDocRef.delete.mockResolvedValue(undefined)

        const deletedCount = await storage.cleanupOldJobs(30)

        expect(deletedCount).toBe(1)
      })

      it('should keep recent terminal jobs', async () => {
        const recentJob = createTestJob({
          jobId: 'recent-job',
          status: 'completed',
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        })

        mockCollection.get.mockResolvedValue(
          createMockQuerySnapshot([
            createMockDocSnapshot(
              true,
              recentJob.jobId,
              toFirestoreDoc(recentJob)
            ),
          ])
        )

        const deletedCount = await storage.cleanupOldJobs(30)

        expect(deletedCount).toBe(0)
        expect(mockDocRef.delete).not.toHaveBeenCalled()
      })

      it('should use completedAt for age calculation when available', async () => {
        // Job created 40 days ago but completed 20 days ago
        const createdDate = new Date()
        createdDate.setDate(createdDate.getDate() - 40)
        const completedDate = new Date()
        completedDate.setDate(completedDate.getDate() - 20)

        const job = createTestJob({
          jobId: 'recent-completed-job',
          status: 'completed',
          createdAt: createdDate.toISOString(),
          completedAt: completedDate.toISOString(),
        })

        mockCollection.get.mockResolvedValue(
          createMockQuerySnapshot([
            createMockDocSnapshot(true, job.jobId, toFirestoreDoc(job)),
          ])
        )

        // With 30 day retention, job should NOT be deleted (completed 20 days ago)
        const deletedCount = await storage.cleanupOldJobs(30)

        expect(deletedCount).toBe(0)
      })
    })
  })

  // ============================================================================
  // isReady Tests
  // ============================================================================

  describe('isReady', () => {
    it('should return true when Firestore is accessible', async () => {
      mockDocRef.get.mockResolvedValue(
        createMockDocSnapshot(false, 'rate-limit')
      )

      const isReady = await storage.isReady()
      expect(isReady).toBe(true)
    })

    it('should return false when Firestore connection fails', async () => {
      mockDocRef.get.mockRejectedValue(new Error('Connection failed'))

      const isReady = await storage.isReady()
      expect(isReady).toBe(false)
    })

    it('should return false on timeout error', async () => {
      mockDocRef.get.mockRejectedValue(new Error('Deadline exceeded'))

      const isReady = await storage.isReady()
      expect(isReady).toBe(false)
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

        mockDocRef.get.mockResolvedValue(
          createMockDocSnapshot(true, job.jobId, toFirestoreDoc(job))
        )

        const retrieved = await storage.getJob(job.jobId)
        expect(retrieved?.status).toBe(status)
      }
    })

    it('should handle both job types', async () => {
      const jobTypes: BackfillJobType[] = [
        'data-collection',
        'analytics-generation',
      ]

      for (const jobType of jobTypes) {
        const job = createTestJob({ jobType })

        mockDocRef.get.mockResolvedValue(
          createMockDocSnapshot(true, job.jobId, toFirestoreDoc(job))
        )

        const retrieved = await storage.getJob(job.jobId)
        expect(retrieved?.jobType).toBe(jobType)
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

      mockDocRef.get.mockResolvedValue(
        createMockDocSnapshot(true, job.jobId, toFirestoreDoc(job))
      )

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

      mockDocRef.get.mockResolvedValue(
        createMockDocSnapshot(true, job.jobId, toFirestoreDoc(job))
      )

      const retrieved = await storage.getJob(job.jobId)
      expect(retrieved?.error).toBe(
        'Critical failure: Unable to connect to data source'
      )
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

      mockDocRef.get.mockResolvedValue(
        createMockDocSnapshot(true, job.jobId, toFirestoreDoc(job))
      )

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

      mockDocRef.get.mockResolvedValue(
        createMockDocSnapshot(true, job.jobId, toFirestoreDoc(job))
      )

      const retrieved = await storage.getJob(job.jobId)
      expect(retrieved?.progress.errors.length).toBe(10)
    })
  })
})
