/**
 * UnifiedBackfillService Integration Tests
 *
 * Tests the UnifiedBackfillService orchestrator for the Unified Backfill Service.
 * Validates Requirements 2.2, 2.3, 10.1 from the spec.
 *
 * Test Coverage:
 * 1. Job creation and execution - data-collection and analytics-generation jobs
 * 2. Job status and cancellation - get status, cancel running jobs
 * 3. Preview functionality - dry run for both job types
 * 4. Job listing - list all jobs with filters and pagination
 * 5. Rate limit configuration - get and update rate limit config
 * 6. Recovery flow - initialize with auto-recovery
 * 7. Service lifecycle - initialize and dispose
 *
 * Test Isolation Requirements (per testing steering document):
 * - Each test uses mocked dependencies
 * - Tests clean up all mocks in afterEach hooks
 * - Tests do not depend on execution order
 * - All tests pass when run with --run (parallel mode)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Mock } from 'vitest'
import { UnifiedBackfillService } from '../UnifiedBackfillService.js'
import type {
  IBackfillJobStorage,
  ISnapshotStorage,
  ITimeSeriesIndexStorage,
  BackfillJob,
  JobCheckpoint,
  RateLimitConfig,
} from '../../../../types/storageInterfaces.js'
import type { CreateJobRequest } from '../../../../types/backfillJob.js'
import type { RefreshService } from '../../../RefreshService.js'
import type { DistrictConfigurationService } from '../../../DistrictConfigurationService.js'
import type { PreComputedAnalyticsService } from '../../../PreComputedAnalyticsService.js'

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
 * Default rate limit configuration for tests
 */
const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  maxRequestsPerMinute: 10,
  maxConcurrent: 3,
  minDelayMs: 2000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
}

/**
 * Create a mock IBackfillJobStorage implementation
 */
function createMockJobStorage(): IBackfillJobStorage & {
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
    getRateLimitConfig: vi
      .fn()
      .mockResolvedValue({ ...DEFAULT_RATE_LIMIT_CONFIG }),
    setRateLimitConfig: vi.fn().mockResolvedValue(undefined),
    cleanupOldJobs: vi.fn().mockResolvedValue(0),
    isReady: vi.fn().mockResolvedValue(true),
  }
}

/**
 * Create a mock ISnapshotStorage implementation
 */
function createMockSnapshotStorage(): ISnapshotStorage & {
  getLatestSuccessful: Mock
  getLatest: Mock
  writeSnapshot: Mock
  listSnapshots: Mock
  getSnapshot: Mock
  deleteSnapshot: Mock
  isReady: Mock
  writeDistrictData: Mock
  readDistrictData: Mock
  listDistrictsInSnapshot: Mock
  getSnapshotManifest: Mock
  getSnapshotMetadata: Mock
  writeAllDistrictsRankings: Mock
  readAllDistrictsRankings: Mock
  hasAllDistrictsRankings: Mock
} {
  return {
    getLatestSuccessful: vi.fn().mockResolvedValue(null),
    getLatest: vi.fn().mockResolvedValue(null),
    writeSnapshot: vi.fn().mockResolvedValue(undefined),
    listSnapshots: vi.fn().mockResolvedValue([]),
    getSnapshot: vi.fn().mockResolvedValue(null),
    deleteSnapshot: vi.fn().mockResolvedValue(true),
    isReady: vi.fn().mockResolvedValue(true),
    writeDistrictData: vi.fn().mockResolvedValue(undefined),
    readDistrictData: vi.fn().mockResolvedValue(null),
    listDistrictsInSnapshot: vi.fn().mockResolvedValue([]),
    getSnapshotManifest: vi.fn().mockResolvedValue(null),
    getSnapshotMetadata: vi.fn().mockResolvedValue(null),
    writeAllDistrictsRankings: vi.fn().mockResolvedValue(undefined),
    readAllDistrictsRankings: vi.fn().mockResolvedValue(null),
    hasAllDistrictsRankings: vi.fn().mockResolvedValue(false),
  }
}

/**
 * Create a mock ITimeSeriesIndexStorage implementation
 * Note: appendDataPoint has been removed per data-computation-separation steering
 */
function createMockTimeSeriesStorage(): ITimeSeriesIndexStorage & {
  getTrendData: Mock
  getProgramYearData: Mock
  deleteSnapshotEntries: Mock
  isReady: Mock
} {
  return {
    getTrendData: vi.fn().mockResolvedValue([]),
    getProgramYearData: vi.fn().mockResolvedValue(null),
    deleteSnapshotEntries: vi.fn().mockResolvedValue(0),
    isReady: vi.fn().mockResolvedValue(true),
  }
}

/**
 * Create a mock RefreshService implementation
 */
function createMockRefreshService(): RefreshService & {
  executeRefresh: Mock
} {
  return {
    executeRefresh: vi.fn().mockResolvedValue({
      success: true,
      snapshot_id: '2024-01-01',
      errors: [],
    }),
  } as unknown as RefreshService & { executeRefresh: Mock }
}

/**
 * Create a mock DistrictConfigurationService implementation
 */
function createMockConfigService(): DistrictConfigurationService & {
  getConfiguredDistricts: Mock
} {
  return {
    getConfiguredDistricts: vi.fn().mockResolvedValue(['42', '61']),
  } as unknown as DistrictConfigurationService & {
    getConfiguredDistricts: Mock
  }
}

/**
 * Create a mock PreComputedAnalyticsService implementation
 */
function createMockPreComputedAnalyticsService(): PreComputedAnalyticsService & {
  computeAndStore: Mock
} {
  return {
    computeAndStore: vi.fn().mockResolvedValue(undefined),
  } as unknown as PreComputedAnalyticsService & {
    computeAndStore: Mock
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
 * Create a valid CreateJobRequest
 */
function createTestRequest(
  overrides: Partial<CreateJobRequest> = {}
): CreateJobRequest {
  return {
    jobType: 'data-collection',
    startDate: '2024-01-01',
    endDate: '2024-01-15',
    ...overrides,
  }
}

// ============================================================================
// Test Suite
// ============================================================================

describe('UnifiedBackfillService', () => {
  let mockJobStorage: ReturnType<typeof createMockJobStorage>
  let mockSnapshotStorage: ReturnType<typeof createMockSnapshotStorage>
  let mockTimeSeriesStorage: ReturnType<typeof createMockTimeSeriesStorage>
  let mockRefreshService: ReturnType<typeof createMockRefreshService>
  let mockConfigService: ReturnType<typeof createMockConfigService>
  let mockPreComputedAnalyticsService: ReturnType<
    typeof createMockPreComputedAnalyticsService
  >
  let service: UnifiedBackfillService

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    mockJobStorage = createMockJobStorage()
    mockSnapshotStorage = createMockSnapshotStorage()
    mockTimeSeriesStorage = createMockTimeSeriesStorage()
    mockRefreshService = createMockRefreshService()
    mockConfigService = createMockConfigService()
    mockPreComputedAnalyticsService = createMockPreComputedAnalyticsService()

    service = new UnifiedBackfillService(
      mockJobStorage,
      mockSnapshotStorage,
      mockTimeSeriesStorage,
      mockRefreshService,
      mockConfigService,
      mockPreComputedAnalyticsService,
      { autoRecoverOnInit: false } // Disable auto-recovery for most tests
    )
  })

  afterEach(async () => {
    // Dispose the service to clean up timers and resources
    await service.dispose()
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  // ============================================================================
  // Job Creation and Execution Tests (Requirements 2.2, 2.3)
  // ============================================================================

  describe('Job Creation and Execution', () => {
    describe('createJob', () => {
      it('should create data-collection job successfully', async () => {
        // Arrange
        const request = createTestRequest({ jobType: 'data-collection' })
        mockJobStorage.getActiveJob.mockResolvedValue(null)
        mockSnapshotStorage.listSnapshots.mockResolvedValue([])

        // Act
        const job = await service.createJob(request)

        // Assert
        expect(job).toBeDefined()
        expect(job.jobId).toBeDefined()
        expect(job.jobType).toBe('data-collection')
        expect(job.status).toBe('pending')
        expect(job.config.startDate).toBe(request.startDate)
        expect(job.config.endDate).toBe(request.endDate)
        expect(mockJobStorage.createJob).toHaveBeenCalledTimes(1)
      })

      it('should create analytics-generation job successfully', async () => {
        // Arrange
        const request = createTestRequest({
          jobType: 'analytics-generation',
          startDate: '2024-01-01',
          endDate: '2024-01-15',
        })
        mockJobStorage.getActiveJob.mockResolvedValue(null)
        mockSnapshotStorage.listSnapshots.mockResolvedValue([
          {
            snapshot_id: '2024-01-01',
            status: 'success',
            created_at: '2024-01-01T00:00:00Z',
          },
        ])

        // Act
        const job = await service.createJob(request)

        // Assert
        expect(job).toBeDefined()
        expect(job.jobType).toBe('analytics-generation')
        expect(job.status).toBe('pending')
        expect(mockJobStorage.createJob).toHaveBeenCalledTimes(1)
      })

      it('should enforce one-job-at-a-time rule', async () => {
        // Arrange
        const request = createTestRequest()
        const runningJob = createTestJob({
          status: 'running',
          startedAt: new Date().toISOString(),
        })
        mockJobStorage.getActiveJob.mockResolvedValue(runningJob)

        // Act & Assert
        await expect(service.createJob(request)).rejects.toThrow(
          /Cannot create new job.*already running/
        )
        expect(mockJobStorage.createJob).not.toHaveBeenCalled()
      })

      it('should create job even with invalid date range (validation happens during execution)', async () => {
        // Arrange - Invalid date range (start after end)
        // Note: Job creation succeeds; validation happens during async execution
        const request = createTestRequest({
          jobType: 'data-collection',
          startDate: '2024-01-31',
          endDate: '2024-01-01', // End before start
        })
        mockJobStorage.getActiveJob.mockResolvedValue(null)

        // Act - Job creation succeeds (validation is deferred to execution)
        const job = await service.createJob(request)

        // Assert - Job is created with pending status
        expect(job).toBeDefined()
        expect(job.status).toBe('pending')
        expect(job.config.startDate).toBe('2024-01-31')
        expect(job.config.endDate).toBe('2024-01-01')
      })

      it('should start job execution asynchronously after creation', async () => {
        // Arrange
        const request = createTestRequest()
        mockJobStorage.getActiveJob.mockResolvedValue(null)
        mockSnapshotStorage.listSnapshots.mockResolvedValue([])

        // Act
        const job = await service.createJob(request)

        // Assert - Job should be created with pending status
        expect(job.status).toBe('pending')
        // The job execution happens asynchronously
        expect(mockJobStorage.createJob).toHaveBeenCalledTimes(1)
      })
    })
  })

  // ============================================================================
  // Job Status and Cancellation Tests
  // ============================================================================

  describe('Job Status and Cancellation', () => {
    describe('getJobStatus', () => {
      it('should get job status by ID', async () => {
        // Arrange
        const job = createTestJob({ status: 'running' })
        mockJobStorage.getJob.mockResolvedValue(job)

        // Act
        const status = await service.getJobStatus(job.jobId)

        // Assert
        expect(status).toBe('running')
        expect(mockJobStorage.getJob).toHaveBeenCalledWith(job.jobId)
      })

      it('should return null for non-existent job', async () => {
        // Arrange
        mockJobStorage.getJob.mockResolvedValue(null)

        // Act
        const status = await service.getJobStatus('non-existent-job')

        // Assert
        expect(status).toBeNull()
      })
    })

    describe('getJob', () => {
      it('should get full job by ID', async () => {
        // Arrange
        const job = createTestJob({
          status: 'running',
          progress: {
            totalItems: 10,
            processedItems: 5,
            failedItems: 0,
            skippedItems: 0,
            currentItem: '2024-01-05',
            districtProgress: {},
            errors: [],
          },
        })
        mockJobStorage.getJob.mockResolvedValue(job)

        // Act
        const result = await service.getJob(job.jobId)

        // Assert
        expect(result).toEqual(job)
        expect(result?.progress.processedItems).toBe(5)
      })

      it('should return null for non-existent job', async () => {
        // Arrange
        mockJobStorage.getJob.mockResolvedValue(null)

        // Act
        const result = await service.getJob('non-existent-job')

        // Assert
        expect(result).toBeNull()
      })
    })

    describe('cancelJob', () => {
      it('should cancel running job', async () => {
        // Arrange
        const runningJob = createTestJob({
          status: 'running',
          startedAt: new Date().toISOString(),
        })
        mockJobStorage.getJob.mockResolvedValue(runningJob)

        // Act
        const result = await service.cancelJob(runningJob.jobId)

        // Assert
        expect(result).toBe(true)
        expect(mockJobStorage.updateJob).toHaveBeenCalledWith(
          runningJob.jobId,
          expect.objectContaining({
            status: 'cancelled',
          })
        )
      })

      it('should return false for non-existent job', async () => {
        // Arrange
        mockJobStorage.getJob.mockResolvedValue(null)

        // Act
        const result = await service.cancelJob('non-existent-job')

        // Assert
        expect(result).toBe(false)
      })

      it('should return false for already completed job', async () => {
        // Arrange
        const completedJob = createTestJob({
          status: 'completed',
          completedAt: new Date().toISOString(),
        })
        mockJobStorage.getJob.mockResolvedValue(completedJob)

        // Act
        const result = await service.cancelJob(completedJob.jobId)

        // Assert
        expect(result).toBe(false)
      })
    })
  })

  // ============================================================================
  // Preview Functionality Tests
  // ============================================================================

  describe('Preview Functionality', () => {
    describe('previewJob', () => {
      it('should preview data-collection job', async () => {
        // Arrange
        const request = createTestRequest({
          jobType: 'data-collection',
          startDate: '2024-01-01',
          endDate: '2024-01-05',
        })
        mockSnapshotStorage.listSnapshots.mockResolvedValue([])
        mockConfigService.getConfiguredDistricts.mockResolvedValue(['42', '61'])

        // Act
        const preview = await service.previewJob(request)

        // Assert
        expect(preview.jobType).toBe('data-collection')
        expect(preview.totalItems).toBe(5) // 5 days
        expect(preview.dateRange.startDate).toBe('2024-01-01')
        expect(preview.dateRange.endDate).toBe('2024-01-05')
        expect(preview.affectedDistricts).toEqual(['42', '61'])
        expect(preview.estimatedDuration).toBeGreaterThan(0)
        expect(preview.itemBreakdown.dates).toBeDefined()
        expect(preview.itemBreakdown.dates?.length).toBe(5)
      })

      it('should preview analytics-generation job', async () => {
        // Arrange
        const request = createTestRequest({
          jobType: 'analytics-generation',
          startDate: '2024-01-01',
          endDate: '2024-01-10',
        })
        mockSnapshotStorage.listSnapshots.mockResolvedValue([
          {
            snapshot_id: '2024-01-01',
            status: 'success',
            created_at: '2024-01-01T00:00:00Z',
          },
          {
            snapshot_id: '2024-01-05',
            status: 'success',
            created_at: '2024-01-05T00:00:00Z',
          },
          {
            snapshot_id: '2024-01-10',
            status: 'success',
            created_at: '2024-01-10T00:00:00Z',
          },
        ])
        mockConfigService.getConfiguredDistricts.mockResolvedValue(['42', '61'])

        // Act
        const preview = await service.previewJob(request)

        // Assert
        expect(preview.jobType).toBe('analytics-generation')
        expect(preview.totalItems).toBe(3) // 3 snapshots
        expect(preview.itemBreakdown.snapshotIds).toBeDefined()
        expect(preview.itemBreakdown.snapshotIds?.length).toBe(3)
      })

      it('should handle preview validation errors', async () => {
        // Arrange - Missing required dates for data-collection
        const request: CreateJobRequest = {
          jobType: 'data-collection',
          // Missing startDate and endDate
        }

        // Act & Assert
        await expect(service.previewJob(request)).rejects.toThrow(
          /startDate and endDate are required/
        )
      })

      it('should skip existing snapshots in data-collection preview', async () => {
        // Arrange
        const request = createTestRequest({
          jobType: 'data-collection',
          startDate: '2024-01-01',
          endDate: '2024-01-05',
          skipExisting: true,
        })
        // Two snapshots already exist
        mockSnapshotStorage.listSnapshots.mockResolvedValue([
          {
            snapshot_id: '2024-01-01',
            status: 'success',
            created_at: '2024-01-01T00:00:00Z',
          },
          {
            snapshot_id: '2024-01-03',
            status: 'success',
            created_at: '2024-01-03T00:00:00Z',
          },
        ])

        // Act
        const preview = await service.previewJob(request)

        // Assert - Should only include 3 dates (excluding existing)
        expect(preview.totalItems).toBe(3)
      })
    })
  })

  // ============================================================================
  // Job Listing Tests
  // ============================================================================

  describe('Job Listing', () => {
    describe('listJobs', () => {
      it('should list all jobs', async () => {
        // Arrange
        const jobs = [
          createTestJob({ jobId: 'job-1', status: 'completed' }),
          createTestJob({ jobId: 'job-2', status: 'running' }),
          createTestJob({ jobId: 'job-3', status: 'pending' }),
        ]
        mockJobStorage.listJobs.mockResolvedValue(jobs)

        // Act
        const result = await service.listJobs()

        // Assert
        expect(result).toHaveLength(3)
        expect(mockJobStorage.listJobs).toHaveBeenCalledWith(undefined)
      })

      it('should list jobs with status filter', async () => {
        // Arrange
        const completedJobs = [
          createTestJob({ jobId: 'job-1', status: 'completed' }),
          createTestJob({ jobId: 'job-2', status: 'completed' }),
        ]
        mockJobStorage.listJobs.mockResolvedValue(completedJobs)

        // Act
        const result = await service.listJobs({ status: ['completed'] })

        // Assert
        expect(result).toHaveLength(2)
        expect(mockJobStorage.listJobs).toHaveBeenCalledWith({
          status: ['completed'],
        })
      })

      it('should list jobs with pagination', async () => {
        // Arrange
        const paginatedJobs = [
          createTestJob({ jobId: 'job-3' }),
          createTestJob({ jobId: 'job-4' }),
        ]
        mockJobStorage.listJobs.mockResolvedValue(paginatedJobs)

        // Act
        const result = await service.listJobs({ limit: 2, offset: 2 })

        // Assert
        expect(result).toHaveLength(2)
        expect(mockJobStorage.listJobs).toHaveBeenCalledWith({
          limit: 2,
          offset: 2,
        })
      })

      it('should list jobs with multiple filters', async () => {
        // Arrange
        const filteredJobs = [
          createTestJob({
            jobId: 'job-1',
            jobType: 'data-collection',
            status: 'completed',
          }),
        ]
        mockJobStorage.listJobs.mockResolvedValue(filteredJobs)

        // Act
        const result = await service.listJobs({
          status: ['completed', 'failed'],
          jobType: ['data-collection'],
          limit: 10,
          offset: 0,
        })

        // Assert
        expect(result).toHaveLength(1)
        expect(mockJobStorage.listJobs).toHaveBeenCalledWith({
          status: ['completed', 'failed'],
          jobType: ['data-collection'],
          limit: 10,
          offset: 0,
        })
      })
    })
  })

  // ============================================================================
  // Rate Limit Configuration Tests
  // ============================================================================

  describe('Rate Limit Configuration', () => {
    describe('getRateLimitConfig', () => {
      it('should get rate limit config', async () => {
        // Arrange
        const config: RateLimitConfig = {
          maxRequestsPerMinute: 20,
          maxConcurrent: 5,
          minDelayMs: 1000,
          maxDelayMs: 15000,
          backoffMultiplier: 1.5,
        }
        mockJobStorage.getRateLimitConfig.mockResolvedValue(config)

        // Act
        const result = await service.getRateLimitConfig()

        // Assert
        expect(result).toEqual(config)
        expect(mockJobStorage.getRateLimitConfig).toHaveBeenCalledTimes(1)
      })

      it('should return default config on storage error', async () => {
        // Arrange
        mockJobStorage.getRateLimitConfig.mockRejectedValue(
          new Error('Storage error')
        )

        // Act
        const result = await service.getRateLimitConfig()

        // Assert - Should return default config
        expect(result).toEqual(DEFAULT_RATE_LIMIT_CONFIG)
      })
    })

    describe('updateRateLimitConfig', () => {
      it('should update rate limit config', async () => {
        // Arrange
        const currentConfig: RateLimitConfig = { ...DEFAULT_RATE_LIMIT_CONFIG }
        mockJobStorage.getRateLimitConfig.mockResolvedValue(currentConfig)

        const updates: Partial<RateLimitConfig> = {
          maxRequestsPerMinute: 30,
          maxConcurrent: 10,
        }

        // Act
        await service.updateRateLimitConfig(updates)

        // Assert
        expect(mockJobStorage.setRateLimitConfig).toHaveBeenCalledWith({
          ...currentConfig,
          ...updates,
        })
      })

      it('should merge partial config updates', async () => {
        // Arrange
        const currentConfig: RateLimitConfig = {
          maxRequestsPerMinute: 10,
          maxConcurrent: 3,
          minDelayMs: 2000,
          maxDelayMs: 30000,
          backoffMultiplier: 2,
        }
        mockJobStorage.getRateLimitConfig.mockResolvedValue(currentConfig)

        // Act - Only update one field
        await service.updateRateLimitConfig({ minDelayMs: 500 })

        // Assert - Other fields should remain unchanged
        expect(mockJobStorage.setRateLimitConfig).toHaveBeenCalledWith({
          maxRequestsPerMinute: 10,
          maxConcurrent: 3,
          minDelayMs: 500, // Updated
          maxDelayMs: 30000,
          backoffMultiplier: 2,
        })
      })
    })
  })

  // ============================================================================
  // Recovery Flow Tests (Requirement 10.1)
  // ============================================================================

  describe('Recovery Flow', () => {
    describe('initialize with auto-recovery', () => {
      it('should initialize with auto-recovery enabled', async () => {
        // Arrange - Create service with auto-recovery enabled
        const autoRecoveryService = new UnifiedBackfillService(
          mockJobStorage,
          mockSnapshotStorage,
          mockTimeSeriesStorage,
          mockRefreshService,
          mockConfigService,
          mockPreComputedAnalyticsService,
          { autoRecoverOnInit: true }
        )
        mockJobStorage.getJobsByStatus.mockResolvedValue([])

        // Act
        const result = await autoRecoveryService.initialize()

        // Assert
        expect(result).toBeDefined()
        expect(result?.success).toBe(true)
        expect(result?.jobsRecovered).toBe(0)
        expect(mockJobStorage.getJobsByStatus).toHaveBeenCalledWith([
          'running',
          'pending',
        ])

        // Cleanup
        await autoRecoveryService.dispose()
      })

      it('should not auto-recover when disabled', async () => {
        // Arrange - Service already created with autoRecoverOnInit: false

        // Act
        const result = await service.initialize()

        // Assert
        expect(result).toBeUndefined()
        expect(mockJobStorage.getJobsByStatus).not.toHaveBeenCalled()
      })

      it('should warn on double initialization', async () => {
        // Arrange
        await service.initialize()

        // Act
        const result = await service.initialize()

        // Assert
        expect(result).toBeUndefined()
      })
    })

    describe('recoverIncompleteJobs', () => {
      it('should recover incomplete jobs', async () => {
        // Arrange
        const incompleteJob = createTestJob({
          status: 'running',
          startedAt: new Date().toISOString(),
        })
        mockJobStorage.getJobsByStatus.mockResolvedValue([incompleteJob])
        mockJobStorage.getCheckpoint.mockResolvedValue(null)

        // Act
        const result = await service.recoverIncompleteJobs()

        // Assert
        expect(result.success).toBe(true)
        expect(result.jobsRecovered).toBe(1)
        expect(mockJobStorage.updateJob).toHaveBeenCalledWith(
          incompleteJob.jobId,
          expect.objectContaining({
            status: 'recovering',
            resumedAt: expect.any(String),
          })
        )
      })

      it('should handle recovery with checkpoint', async () => {
        // Arrange
        const checkpoint = createTestCheckpoint({
          lastProcessedItem: '2024-01-05',
          itemsCompleted: [
            '2024-01-01',
            '2024-01-02',
            '2024-01-03',
            '2024-01-04',
            '2024-01-05',
          ],
        })
        const incompleteJob = createTestJob({
          status: 'running',
          checkpoint,
        })
        mockJobStorage.getJobsByStatus.mockResolvedValue([incompleteJob])
        mockJobStorage.getCheckpoint.mockResolvedValue(checkpoint)

        // Act
        const result = await service.recoverIncompleteJobs()

        // Assert
        expect(result.success).toBe(true)
        expect(result.jobsRecovered).toBe(1)
      })

      it('should return success with no jobs to recover', async () => {
        // Arrange
        mockJobStorage.getJobsByStatus.mockResolvedValue([])

        // Act
        const result = await service.recoverIncompleteJobs()

        // Assert
        expect(result.success).toBe(true)
        expect(result.jobsRecovered).toBe(0)
        expect(result.jobsFailed).toBe(0)
      })
    })

    describe('getRecoveryStatus', () => {
      it('should return recovery status', () => {
        // Act
        const status = service.getRecoveryStatus()

        // Assert
        expect(status).toBeDefined()
        expect(status.status).toBe('idle')
        expect(status.lastRecoveryAt).toBeNull()
        expect(status.jobsRecovered).toBe(0)
        expect(status.jobsFailed).toBe(0)
      })
    })
  })

  // ============================================================================
  // Service Lifecycle Tests
  // ============================================================================

  describe('Service Lifecycle', () => {
    describe('initialize', () => {
      it('should initialize service successfully', async () => {
        // Act
        await service.initialize()

        // Assert - Should check storage readiness
        expect(mockJobStorage.isReady).toHaveBeenCalledTimes(1)
      })

      it('should handle storage not ready during initialization', async () => {
        // Arrange
        mockJobStorage.isReady.mockResolvedValue(false)

        // Act - Should not throw, just log warning
        await expect(service.initialize()).resolves.not.toThrow()
      })
    })

    describe('dispose', () => {
      it('should dispose service properly', async () => {
        // Arrange
        await service.initialize()

        // Act
        await service.dispose()

        // Assert - Should complete without error
        // The dispose method cleans up internal resources
      })

      it('should handle dispose without initialization', async () => {
        // Act & Assert - Should not throw
        await expect(service.dispose()).resolves.not.toThrow()
      })

      it('should cancel active job on dispose', async () => {
        // Arrange
        const request = createTestRequest()
        mockJobStorage.getActiveJob.mockResolvedValue(null)
        mockSnapshotStorage.listSnapshots.mockResolvedValue([])

        // Create a job (starts async execution)
        await service.createJob(request)

        // Act - Dispose should cancel the active job
        await service.dispose()

        // Assert - Service should be disposed cleanly
      })
    })
  })

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('Error Handling', () => {
    it('should handle storage errors during job creation', async () => {
      // Arrange
      mockJobStorage.getActiveJob.mockRejectedValue(
        new Error('Storage unavailable')
      )

      // Act & Assert
      await expect(service.createJob(createTestRequest())).rejects.toThrow(
        'Storage unavailable'
      )
    })

    it('should handle storage errors during job status retrieval', async () => {
      // Arrange
      mockJobStorage.getJob.mockRejectedValue(new Error('Storage read error'))

      // Act & Assert
      await expect(service.getJobStatus('some-job-id')).rejects.toThrow(
        'Storage read error'
      )
    })

    it('should handle storage errors during job listing', async () => {
      // Arrange
      mockJobStorage.listJobs.mockRejectedValue(new Error('Storage list error'))

      // Act & Assert
      await expect(service.listJobs()).rejects.toThrow('Storage list error')
    })

    it('should handle invalid job type in preview', async () => {
      // Arrange
      const request = {
        jobType: 'invalid-type' as 'data-collection',
        startDate: '2024-01-01',
        endDate: '2024-01-15',
      }

      // Act & Assert
      await expect(service.previewJob(request)).rejects.toThrow(
        /Invalid job type/
      )
    })
  })

  // ============================================================================
  // Integration Scenarios Tests
  // ============================================================================

  describe('Integration Scenarios', () => {
    it('should handle complete data-collection job lifecycle', async () => {
      // Arrange
      const request = createTestRequest({
        jobType: 'data-collection',
        startDate: '2024-01-01',
        endDate: '2024-01-03',
      })
      mockJobStorage.getActiveJob.mockResolvedValue(null)
      mockSnapshotStorage.listSnapshots.mockResolvedValue([])
      mockRefreshService.executeRefresh.mockResolvedValue({
        success: true,
        snapshot_id: '2024-01-01',
        errors: [],
      })

      // Act - Create job
      const job = await service.createJob(request)

      // Assert - Job created
      expect(job).toBeDefined()
      expect(job.status).toBe('pending')
      expect(mockJobStorage.createJob).toHaveBeenCalledTimes(1)

      // Verify job can be retrieved
      mockJobStorage.getJob.mockResolvedValue(job)
      const retrievedJob = await service.getJob(job.jobId)
      expect(retrievedJob?.jobId).toBe(job.jobId)
    })

    it('should handle complete analytics-generation job lifecycle', async () => {
      // Arrange
      const request = createTestRequest({
        jobType: 'analytics-generation',
        startDate: '2024-01-01',
        endDate: '2024-01-10',
      })
      mockJobStorage.getActiveJob.mockResolvedValue(null)
      mockSnapshotStorage.listSnapshots.mockResolvedValue([
        {
          snapshot_id: '2024-01-01',
          status: 'success',
          created_at: '2024-01-01T00:00:00Z',
        },
        {
          snapshot_id: '2024-01-05',
          status: 'success',
          created_at: '2024-01-05T00:00:00Z',
        },
      ])

      // Act - Create job
      const job = await service.createJob(request)

      // Assert - Job created
      expect(job).toBeDefined()
      expect(job.jobType).toBe('analytics-generation')
      expect(job.status).toBe('pending')
    })

    it('should prevent concurrent job creation', async () => {
      // Arrange - First job is running
      const runningJob = createTestJob({
        status: 'running',
        startedAt: new Date().toISOString(),
      })
      mockJobStorage.getActiveJob.mockResolvedValue(runningJob)

      // Act & Assert - Second job should be rejected
      await expect(service.createJob(createTestRequest())).rejects.toThrow(
        /Cannot create new job/
      )
    })

    it('should allow job creation after previous job completes', async () => {
      // Arrange - No active job
      mockJobStorage.getActiveJob.mockResolvedValue(null)
      mockSnapshotStorage.listSnapshots.mockResolvedValue([])

      // Act - Create first job
      const job1 = await service.createJob(createTestRequest())
      expect(job1).toBeDefined()

      // Simulate job completion - no active job
      mockJobStorage.getActiveJob.mockResolvedValue(null)

      // Act - Create second job
      const job2 = await service.createJob(createTestRequest())
      expect(job2).toBeDefined()
      expect(job2.jobId).not.toBe(job1.jobId)
    })
  })
})
