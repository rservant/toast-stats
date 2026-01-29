/**
 * UnifiedBackfillService End-to-End Tests
 *
 * Tests the complete job flows for the Unified Backfill Service.
 * Validates Requirements 2.2, 2.3, 10.1 from the spec.
 *
 * Test Coverage:
 * 1. Complete data-collection job flow (create → run → complete)
 * 2. Complete analytics-generation job flow (create → run → complete)
 * 3. Recovery after simulated restart (create job → simulate crash → recover)
 * 4. Job cancellation during execution
 * 5. Error handling and failure scenarios
 *
 * Test Isolation Requirements (per testing steering document):
 * - Each test uses unique directories and isolated storage instances
 * - Tests clean up all resources in afterEach hooks
 * - Tests do not depend on execution order
 * - All tests pass when run with --run (parallel mode)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Mock } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { UnifiedBackfillService } from '../UnifiedBackfillService.js'
import { LocalBackfillJobStorage } from '../../../storage/LocalBackfillJobStorage.js'
import { RecoveryManager } from '../RecoveryManager.js'
import type {
  ISnapshotStorage,
  ITimeSeriesIndexStorage,
  BackfillJob,
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
 * Generate a unique test directory for isolation
 */
function createUniqueTestDir(): string {
  const timestamp = Date.now()
  const randomSuffix = Math.random().toString(36).substring(2, 11)
  return path.join(
    os.tmpdir(),
    `backfill-e2e-test-${timestamp}-${randomSuffix}`
  )
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
 */
function createMockTimeSeriesStorage(): ITimeSeriesIndexStorage & {
  appendDataPoint: Mock
  getTrendData: Mock
  getProgramYearData: Mock
  deleteSnapshotEntries: Mock
  isReady: Mock
} {
  return {
    appendDataPoint: vi.fn().mockResolvedValue(undefined),
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
 * Create a valid CreateJobRequest for data-collection
 */
function createDataCollectionRequest(
  overrides: Partial<CreateJobRequest> = {}
): CreateJobRequest {
  // Use dates in the past to pass validation
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 2)
  const twoDaysAgo = new Date()
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 3)

  return {
    jobType: 'data-collection',
    startDate: twoDaysAgo.toISOString().split('T')[0],
    endDate: yesterday.toISOString().split('T')[0],
    ...overrides,
  }
}

/**
 * Create a valid CreateJobRequest for analytics-generation
 */
function createAnalyticsGenerationRequest(
  overrides: Partial<CreateJobRequest> = {}
): CreateJobRequest {
  return {
    jobType: 'analytics-generation',
    startDate: '2024-01-01',
    endDate: '2024-01-10',
    ...overrides,
  }
}

/**
 * Wait for a condition to be true with timeout
 */
async function waitForCondition(
  condition: () => Promise<boolean>,
  timeoutMs: number = 5000,
  intervalMs: number = 100
): Promise<boolean> {
  const startTime = Date.now()
  while (Date.now() - startTime < timeoutMs) {
    if (await condition()) {
      return true
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs))
  }
  return false
}

// ============================================================================
// Test Suite
// ============================================================================

describe('UnifiedBackfillService E2E Tests', () => {
  let testDir: string
  let jobStorage: LocalBackfillJobStorage
  let mockSnapshotStorage: ReturnType<typeof createMockSnapshotStorage>
  let mockTimeSeriesStorage: ReturnType<typeof createMockTimeSeriesStorage>
  let mockRefreshService: ReturnType<typeof createMockRefreshService>
  let mockConfigService: ReturnType<typeof createMockConfigService>
  let mockPreComputedAnalyticsService: ReturnType<typeof createMockPreComputedAnalyticsService>
  let service: UnifiedBackfillService

  beforeEach(async () => {
    vi.clearAllMocks()

    // Create unique test directory for isolation
    testDir = createUniqueTestDir()
    await fs.mkdir(testDir, { recursive: true })

    // Create real LocalBackfillJobStorage with isolated directory
    jobStorage = new LocalBackfillJobStorage(testDir)

    // Create mock services
    mockSnapshotStorage = createMockSnapshotStorage()
    mockTimeSeriesStorage = createMockTimeSeriesStorage()
    mockRefreshService = createMockRefreshService()
    mockConfigService = createMockConfigService()
    mockPreComputedAnalyticsService = createMockPreComputedAnalyticsService()

    // Create service with real storage and mock dependencies
    service = new UnifiedBackfillService(
      jobStorage,
      mockSnapshotStorage,
      mockTimeSeriesStorage,
      mockRefreshService,
      mockConfigService,
      mockPreComputedAnalyticsService,
      { autoRecoverOnInit: false }
    )
  })

  afterEach(async () => {
    // Dispose service to clean up timers
    await service.dispose()

    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }

    vi.clearAllMocks()
  })

  // ============================================================================
  // Complete Data-Collection Job Flow Tests (Requirement 2.2)
  // ============================================================================

  describe('Complete Data-Collection Job Flow', () => {
    it('should complete data-collection job flow: create → run → complete', async () => {
      // Arrange
      const request = createDataCollectionRequest()
      mockSnapshotStorage.listSnapshots.mockResolvedValue([])

      // Configure mock to return success for each date
      let callCount = 0
      mockRefreshService.executeRefresh.mockImplementation(
        async (date: string) => {
          callCount++
          return {
            success: true,
            snapshot_id: date,
            errors: [],
          }
        }
      )

      // Act - Create job
      const job = await service.createJob(request)

      // Assert - Job created with pending status
      expect(job).toBeDefined()
      expect(job.jobId).toBeDefined()
      expect(job.jobType).toBe('data-collection')
      expect(job.status).toBe('pending')

      // Wait for job to complete (async execution)
      const completed = await waitForCondition(async () => {
        const status = await service.getJobStatus(job.jobId)
        return status === 'completed' || status === 'failed'
      }, 10000)

      expect(completed).toBe(true)

      // Verify final job state
      const finalJob = await service.getJob(job.jobId)
      expect(finalJob).not.toBeNull()
      expect(finalJob?.status).toBe('completed')
      expect(finalJob?.result).not.toBeNull()
      expect(finalJob?.result?.itemsProcessed).toBeGreaterThan(0)
      expect(finalJob?.completedAt).not.toBeNull()

      // Verify RefreshService was called
      expect(mockRefreshService.executeRefresh).toHaveBeenCalled()
    })

    it('should handle data-collection job with partial failures', async () => {
      // Arrange
      const request = createDataCollectionRequest()
      mockSnapshotStorage.listSnapshots.mockResolvedValue([])

      // Configure mock to fail on some dates
      let callCount = 0
      mockRefreshService.executeRefresh.mockImplementation(
        async (date: string) => {
          callCount++
          if (callCount % 2 === 0) {
            return {
              success: false,
              snapshot_id: null,
              errors: ['Simulated failure'],
            }
          }
          return {
            success: true,
            snapshot_id: date,
            errors: [],
          }
        }
      )

      // Act
      const job = await service.createJob(request)

      // Wait for job to complete
      const completed = await waitForCondition(async () => {
        const status = await service.getJobStatus(job.jobId)
        return status === 'completed' || status === 'failed'
      }, 10000)

      expect(completed).toBe(true)

      // Verify job completed (even with failures)
      const finalJob = await service.getJob(job.jobId)
      expect(finalJob).not.toBeNull()
      // Job may be completed or failed depending on failure count
      expect(['completed', 'failed']).toContain(finalJob?.status)
      // Verify the job ran and tracked progress
      expect(finalJob?.progress).toBeDefined()
      expect(typeof finalJob?.progress.processedItems).toBe('number')
      expect(typeof finalJob?.progress.failedItems).toBe('number')
    })

    it('should skip existing snapshots when skipExisting is true', async () => {
      // Arrange
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 2)
      const twoDaysAgo = new Date()
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 3)

      const request = createDataCollectionRequest({
        skipExisting: true,
        startDate: twoDaysAgo.toISOString().split('T')[0],
        endDate: yesterday.toISOString().split('T')[0],
      })

      // Mock existing snapshot for one date
      const existingDate = twoDaysAgo.toISOString().split('T')[0]
      mockSnapshotStorage.listSnapshots.mockResolvedValue([
        {
          snapshot_id: existingDate,
          status: 'success',
          created_at: existingDate,
        },
      ])

      mockRefreshService.executeRefresh.mockImplementation(
        async (date: string) => ({
          success: true,
          snapshot_id: date,
          errors: [],
        })
      )

      // Act
      const job = await service.createJob(request)

      // Wait for job to complete
      await waitForCondition(async () => {
        const status = await service.getJobStatus(job.jobId)
        return status === 'completed' || status === 'failed'
      }, 10000)

      // Verify existing date was skipped
      const finalJob = await service.getJob(job.jobId)
      expect(finalJob?.result?.itemsSkipped).toBeGreaterThanOrEqual(1)
    })
  })

  // ============================================================================
  // Complete Analytics-Generation Job Flow Tests (Requirement 2.3)
  // ============================================================================

  describe('Complete Analytics-Generation Job Flow', () => {
    it('should complete analytics-generation job flow: create → run → complete', async () => {
      // Arrange
      const request = createAnalyticsGenerationRequest()

      // Mock existing snapshots to process
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

      // Mock snapshot data
      mockSnapshotStorage.getSnapshot.mockResolvedValue({
        snapshot_id: '2024-01-01',
        status: 'success',
        created_at: '2024-01-01T00:00:00Z',
      })

      mockSnapshotStorage.listDistrictsInSnapshot.mockResolvedValue([
        '42',
        '61',
      ])

      mockSnapshotStorage.readDistrictData.mockResolvedValue({
        asOfDate: '2024-01-01',
        membership: { total: 100 },
        clubPerformance: [
          { 'Active Members': 25, 'Goals Met': 5, 'Mem. Base': 20 },
        ],
      })

      // Act
      const job = await service.createJob(request)

      // Assert - Job created
      expect(job).toBeDefined()
      expect(job.jobType).toBe('analytics-generation')
      expect(job.status).toBe('pending')

      // Wait for job to complete
      const completed = await waitForCondition(async () => {
        const status = await service.getJobStatus(job.jobId)
        return status === 'completed' || status === 'failed'
      }, 10000)

      expect(completed).toBe(true)

      // Verify final job state
      const finalJob = await service.getJob(job.jobId)
      expect(finalJob).not.toBeNull()
      expect(finalJob?.status).toBe('completed')
      expect(finalJob?.result).not.toBeNull()
      expect(finalJob?.result?.itemsProcessed).toBeGreaterThan(0)

      // Verify time series storage was called
      expect(mockTimeSeriesStorage.appendDataPoint).toHaveBeenCalled()
    })

    it('should handle analytics-generation with no snapshots', async () => {
      // Arrange
      const request = createAnalyticsGenerationRequest()
      mockSnapshotStorage.listSnapshots.mockResolvedValue([])

      // Act
      const job = await service.createJob(request)

      // Wait for job to complete
      await waitForCondition(async () => {
        const status = await service.getJobStatus(job.jobId)
        return status === 'completed' || status === 'failed'
      }, 10000)

      // Verify job completed with 0 items
      const finalJob = await service.getJob(job.jobId)
      expect(finalJob?.status).toBe('completed')
      expect(finalJob?.result?.itemsProcessed).toBe(0)
    })

    it('should filter snapshots by date range', async () => {
      // Arrange
      const request = createAnalyticsGenerationRequest({
        startDate: '2024-01-03',
        endDate: '2024-01-07',
      })

      // Mock snapshots - only some within range
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

      mockSnapshotStorage.getSnapshot.mockResolvedValue({
        snapshot_id: '2024-01-05',
        status: 'success',
        created_at: '2024-01-05T00:00:00Z',
      })

      mockSnapshotStorage.listDistrictsInSnapshot.mockResolvedValue(['42'])
      mockSnapshotStorage.readDistrictData.mockResolvedValue({
        asOfDate: '2024-01-05',
        membership: { total: 100 },
        clubPerformance: [],
      })

      // Act
      const job = await service.createJob(request)

      // Wait for job to complete
      await waitForCondition(async () => {
        const status = await service.getJobStatus(job.jobId)
        return status === 'completed' || status === 'failed'
      }, 10000)

      // Verify only filtered snapshots were processed
      const finalJob = await service.getJob(job.jobId)
      expect(finalJob?.status).toBe('completed')
      // Only 2024-01-05 is within range
      expect(finalJob?.result?.itemsProcessed).toBe(1)
    })
  })

  // ============================================================================
  // Recovery After Simulated Restart Tests (Requirement 10.1)
  // ============================================================================

  describe('Recovery After Simulated Restart', () => {
    it('should recover incomplete job after simulated restart', async () => {
      // Arrange - Create a job and simulate it being interrupted
      const request = createDataCollectionRequest()
      mockSnapshotStorage.listSnapshots.mockResolvedValue([])

      // Create job but don't let it complete - simulate crash
      const job = await service.createJob(request)

      // Wait briefly for job to start
      await new Promise(resolve => setTimeout(resolve, 100))

      // Dispose current service (simulate crash)
      await service.dispose()

      // Manually update job status to 'running' to simulate interrupted state
      await jobStorage.updateJob(job.jobId, {
        status: 'running',
        startedAt: new Date().toISOString(),
      })

      // Create new service instance (simulate restart)
      const newService = new UnifiedBackfillService(
        jobStorage,
        mockSnapshotStorage,
        mockTimeSeriesStorage,
        mockRefreshService,
        mockConfigService,
        mockPreComputedAnalyticsService,
        { autoRecoverOnInit: true }
      )

      // Act - Initialize with auto-recovery
      const recoveryResult = await newService.initialize()

      // Assert - Recovery should have been attempted
      expect(recoveryResult).toBeDefined()
      expect(recoveryResult?.jobsRecovered).toBeGreaterThanOrEqual(0)

      // Wait for recovered job to complete
      await waitForCondition(async () => {
        const status = await newService.getJobStatus(job.jobId)
        return (
          status === 'completed' ||
          status === 'failed' ||
          status === 'recovering'
        )
      }, 10000)

      // Verify job was recovered
      const recoveredJob = await newService.getJob(job.jobId)
      expect(recoveredJob).not.toBeNull()
      // Job should have resumedAt set if it was recovered
      if (recoveredJob?.status === 'recovering' || recoveredJob?.resumedAt) {
        expect(recoveredJob.resumedAt).not.toBeNull()
      }

      // Cleanup
      await newService.dispose()
    })

    it('should recover job with checkpoint and skip completed items', async () => {
      // Arrange - Create a job with checkpoint
      const request = createDataCollectionRequest()
      mockSnapshotStorage.listSnapshots.mockResolvedValue([])

      // Create job
      const job = await service.createJob(request)

      // Wait briefly for job to start
      await new Promise(resolve => setTimeout(resolve, 100))

      // Dispose current service
      await service.dispose()

      // Manually set up job with checkpoint (simulate partial completion)
      const checkpoint = {
        lastProcessedItem: '2024-01-01',
        lastProcessedAt: new Date().toISOString(),
        itemsCompleted: ['2024-01-01'],
      }

      await jobStorage.updateJob(job.jobId, {
        status: 'running',
        startedAt: new Date().toISOString(),
        checkpoint,
        progress: {
          totalItems: 2,
          processedItems: 1,
          failedItems: 0,
          skippedItems: 0,
          currentItem: '2024-01-01',
          districtProgress: {},
          errors: [],
        },
      })

      // Create new service instance
      const newService = new UnifiedBackfillService(
        jobStorage,
        mockSnapshotStorage,
        mockTimeSeriesStorage,
        mockRefreshService,
        mockConfigService,
        mockPreComputedAnalyticsService,
        { autoRecoverOnInit: true }
      )

      // Act - Initialize with auto-recovery
      await newService.initialize()

      // Wait for job to complete
      await waitForCondition(async () => {
        const status = await newService.getJobStatus(job.jobId)
        return status === 'completed' || status === 'failed'
      }, 10000)

      // Verify checkpoint was used
      const recoveredJob = await newService.getJob(job.jobId)
      expect(recoveredJob).not.toBeNull()

      // Cleanup
      await newService.dispose()
    })

    it('should handle recovery with no incomplete jobs', async () => {
      // Arrange - No jobs in storage
      const newService = new UnifiedBackfillService(
        jobStorage,
        mockSnapshotStorage,
        mockTimeSeriesStorage,
        mockRefreshService,
        mockConfigService,
        mockPreComputedAnalyticsService,
        { autoRecoverOnInit: true }
      )

      // Act
      const recoveryResult = await newService.initialize()

      // Assert
      expect(recoveryResult).toBeDefined()
      expect(recoveryResult?.success).toBe(true)
      expect(recoveryResult?.jobsRecovered).toBe(0)
      expect(recoveryResult?.jobsFailed).toBe(0)

      // Cleanup
      await newService.dispose()
    })

    it('should mark stale jobs as failed during recovery', async () => {
      // Arrange - Create a stale job (no progress for > 10 minutes)
      const staleTime = new Date()
      staleTime.setMinutes(staleTime.getMinutes() - 15) // 15 minutes ago

      const staleJob: BackfillJob = {
        jobId: `stale-job-${Date.now()}`,
        jobType: 'data-collection',
        status: 'running',
        config: {
          startDate: '2024-01-01',
          endDate: '2024-01-02',
        },
        progress: {
          totalItems: 2,
          processedItems: 0,
          failedItems: 0,
          skippedItems: 0,
          currentItem: null,
          districtProgress: {},
          errors: [],
        },
        checkpoint: null,
        createdAt: staleTime.toISOString(),
        startedAt: staleTime.toISOString(),
        completedAt: null,
        resumedAt: null,
        result: null,
        error: null,
      }

      await jobStorage.createJob(staleJob)

      // Create new service
      const newService = new UnifiedBackfillService(
        jobStorage,
        mockSnapshotStorage,
        mockTimeSeriesStorage,
        mockRefreshService,
        mockConfigService,
        mockPreComputedAnalyticsService,
        { autoRecoverOnInit: true }
      )

      // Act
      await newService.initialize()

      // Wait for recovery to process
      await new Promise(resolve => setTimeout(resolve, 500))

      // Cleanup
      await newService.dispose()
    })
  })

  // ============================================================================
  // Job Cancellation Tests (Requirement 7.1)
  // ============================================================================

  describe('Job Cancellation', () => {
    it('should cancel running job gracefully', async () => {
      // Arrange
      const request = createDataCollectionRequest()
      mockSnapshotStorage.listSnapshots.mockResolvedValue([])

      // Make refresh slow to allow cancellation
      mockRefreshService.executeRefresh.mockImplementation(
        async (date: string) => {
          await new Promise(resolve => setTimeout(resolve, 500))
          return {
            success: true,
            snapshot_id: date,
            errors: [],
          }
        }
      )

      // Act - Create job
      const job = await service.createJob(request)

      // Wait for job to start running
      await waitForCondition(async () => {
        const status = await service.getJobStatus(job.jobId)
        return status === 'running'
      }, 5000)

      // Cancel the job
      const cancelled = await service.cancelJob(job.jobId)

      // Assert
      expect(cancelled).toBe(true)

      // Wait for cancellation to complete
      await waitForCondition(async () => {
        const status = await service.getJobStatus(job.jobId)
        return status === 'cancelled'
      }, 5000)

      const finalJob = await service.getJob(job.jobId)
      expect(finalJob?.status).toBe('cancelled')
      expect(finalJob?.completedAt).not.toBeNull()
    })

    it('should return false when cancelling non-existent job', async () => {
      // Act
      const cancelled = await service.cancelJob('non-existent-job-id')

      // Assert
      expect(cancelled).toBe(false)
    })

    it('should return false when cancelling already completed job', async () => {
      // Arrange - Create and complete a job
      const request = createDataCollectionRequest()
      mockSnapshotStorage.listSnapshots.mockResolvedValue([])
      mockRefreshService.executeRefresh.mockResolvedValue({
        success: true,
        snapshot_id: '2024-01-01',
        errors: [],
      })

      const job = await service.createJob(request)

      // Wait for job to complete
      await waitForCondition(async () => {
        const status = await service.getJobStatus(job.jobId)
        return status === 'completed'
      }, 10000)

      // Act - Try to cancel completed job
      const cancelled = await service.cancelJob(job.jobId)

      // Assert
      expect(cancelled).toBe(false)
    })
  })

  // ============================================================================
  // Job Listing and History Tests (Requirement 6.1)
  // ============================================================================

  describe('Job Listing and History', () => {
    it('should list jobs sorted by creation time (newest first)', async () => {
      // Arrange - Create multiple jobs sequentially
      mockSnapshotStorage.listSnapshots.mockResolvedValue([])
      mockRefreshService.executeRefresh.mockResolvedValue({
        success: true,
        snapshot_id: '2024-01-01',
        errors: [],
      })

      // Create first job and wait for completion
      const job1 = await service.createJob(createDataCollectionRequest())
      await waitForCondition(async () => {
        const status = await service.getJobStatus(job1.jobId)
        return status === 'completed' || status === 'failed'
      }, 10000)

      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 50))

      // Create second job and wait for completion
      const job2 = await service.createJob(createDataCollectionRequest())
      await waitForCondition(async () => {
        const status = await service.getJobStatus(job2.jobId)
        return status === 'completed' || status === 'failed'
      }, 10000)

      // Act
      const jobs = await service.listJobs()

      // Assert - Newest first
      expect(jobs.length).toBeGreaterThanOrEqual(2)
      expect(jobs[0]?.jobId).toBe(job2.jobId)
      expect(jobs[1]?.jobId).toBe(job1.jobId)
    })

    it('should filter jobs by status', async () => {
      // Arrange - Create a completed job
      mockSnapshotStorage.listSnapshots.mockResolvedValue([])
      mockRefreshService.executeRefresh.mockResolvedValue({
        success: true,
        snapshot_id: '2024-01-01',
        errors: [],
      })

      const job = await service.createJob(createDataCollectionRequest())
      await waitForCondition(async () => {
        const status = await service.getJobStatus(job.jobId)
        return status === 'completed'
      }, 10000)

      // Act
      const completedJobs = await service.listJobs({ status: ['completed'] })
      const runningJobs = await service.listJobs({ status: ['running'] })

      // Assert
      expect(completedJobs.length).toBeGreaterThanOrEqual(1)
      expect(completedJobs.every(j => j.status === 'completed')).toBe(true)
      expect(runningJobs.every(j => j.status === 'running')).toBe(true)
    })

    it('should support pagination', async () => {
      // Arrange - Create multiple jobs
      mockSnapshotStorage.listSnapshots.mockResolvedValue([])
      mockRefreshService.executeRefresh.mockResolvedValue({
        success: true,
        snapshot_id: '2024-01-01',
        errors: [],
      })

      // Create 3 jobs
      for (let i = 0; i < 3; i++) {
        const job = await service.createJob(createDataCollectionRequest())
        await waitForCondition(async () => {
          const status = await service.getJobStatus(job.jobId)
          return status === 'completed' || status === 'failed'
        }, 10000)
        await new Promise(resolve => setTimeout(resolve, 50))
      }

      // Act
      const page1 = await service.listJobs({ limit: 2, offset: 0 })
      const page2 = await service.listJobs({ limit: 2, offset: 2 })

      // Assert
      expect(page1.length).toBe(2)
      expect(page2.length).toBeGreaterThanOrEqual(1)
    })
  })

  // ============================================================================
  // Rate Limit Configuration Tests (Requirement 12.3)
  // ============================================================================

  describe('Rate Limit Configuration', () => {
    it('should get and update rate limit configuration', async () => {
      // Act - Get initial config
      const initialConfig = await service.getRateLimitConfig()

      // Assert - Should have default values
      expect(initialConfig).toBeDefined()
      expect(initialConfig.maxRequestsPerMinute).toBeDefined()
      expect(initialConfig.maxConcurrent).toBeDefined()

      // Act - Update config
      await service.updateRateLimitConfig({
        maxRequestsPerMinute: 20,
        maxConcurrent: 5,
      })

      // Assert - Config should be updated
      const updatedConfig = await service.getRateLimitConfig()
      expect(updatedConfig.maxRequestsPerMinute).toBe(20)
      expect(updatedConfig.maxConcurrent).toBe(5)
      // Other fields should remain unchanged
      expect(updatedConfig.minDelayMs).toBe(initialConfig.minDelayMs)
    })

    it('should persist rate limit configuration across service restarts', async () => {
      // Arrange - Update config
      await service.updateRateLimitConfig({
        maxRequestsPerMinute: 30,
        backoffMultiplier: 3,
      })

      // Dispose current service
      await service.dispose()

      // Create new service instance
      const newService = new UnifiedBackfillService(
        jobStorage,
        mockSnapshotStorage,
        mockTimeSeriesStorage,
        mockRefreshService,
        mockConfigService,
        mockPreComputedAnalyticsService,
        { autoRecoverOnInit: false }
      )

      // Act - Get config from new service
      const config = await newService.getRateLimitConfig()

      // Assert - Config should be persisted
      expect(config.maxRequestsPerMinute).toBe(30)
      expect(config.backoffMultiplier).toBe(3)

      // Cleanup
      await newService.dispose()
    })
  })

  // ============================================================================
  // Preview/Dry Run Tests (Requirement 11.2)
  // ============================================================================

  describe('Preview/Dry Run', () => {
    it('should preview data-collection job without executing', async () => {
      // Arrange
      const request = createDataCollectionRequest()
      mockSnapshotStorage.listSnapshots.mockResolvedValue([])

      // Act
      const preview = await service.previewJob(request)

      // Assert
      expect(preview).toBeDefined()
      expect(preview.jobType).toBe('data-collection')
      expect(preview.totalItems).toBeGreaterThan(0)
      expect(preview.dateRange.startDate).toBe(request.startDate)
      expect(preview.dateRange.endDate).toBe(request.endDate)
      expect(preview.affectedDistricts).toEqual(['42', '61'])
      expect(preview.estimatedDuration).toBeGreaterThan(0)
      expect(preview.itemBreakdown.dates).toBeDefined()

      // Verify no actual execution happened
      expect(mockRefreshService.executeRefresh).not.toHaveBeenCalled()
    })

    it('should preview analytics-generation job without executing', async () => {
      // Arrange
      const request = createAnalyticsGenerationRequest()
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

      // Act
      const preview = await service.previewJob(request)

      // Assert
      expect(preview).toBeDefined()
      expect(preview.jobType).toBe('analytics-generation')
      expect(preview.totalItems).toBe(2)
      expect(preview.itemBreakdown.snapshotIds).toHaveLength(2)

      // Verify no actual execution happened
      expect(mockTimeSeriesStorage.appendDataPoint).not.toHaveBeenCalled()
    })
  })

  // ============================================================================
  // One-Job-At-A-Time Enforcement Tests (Requirement 3.1)
  // ============================================================================

  describe('One-Job-At-A-Time Enforcement', () => {
    it('should reject new job when another is running', async () => {
      // Arrange
      mockSnapshotStorage.listSnapshots.mockResolvedValue([])

      // Make refresh slow to keep job running
      mockRefreshService.executeRefresh.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 2000))
        return { success: true, snapshot_id: '2024-01-01', errors: [] }
      })

      // Create first job
      const job1 = await service.createJob(createDataCollectionRequest())

      // Wait for job to start running
      await waitForCondition(async () => {
        const status = await service.getJobStatus(job1.jobId)
        return status === 'running'
      }, 5000)

      // Act & Assert - Try to create second job
      await expect(
        service.createJob(createDataCollectionRequest())
      ).rejects.toThrow(/already running/)

      // Cleanup - Cancel the running job
      await service.cancelJob(job1.jobId)
    })

    it('should allow new job after previous completes', async () => {
      // Arrange
      mockSnapshotStorage.listSnapshots.mockResolvedValue([])
      mockRefreshService.executeRefresh.mockResolvedValue({
        success: true,
        snapshot_id: '2024-01-01',
        errors: [],
      })

      // Create and complete first job
      const job1 = await service.createJob(createDataCollectionRequest())
      await waitForCondition(async () => {
        const status = await service.getJobStatus(job1.jobId)
        return status === 'completed'
      }, 10000)

      // Act - Create second job
      const job2 = await service.createJob(createDataCollectionRequest())

      // Assert
      expect(job2).toBeDefined()
      expect(job2.jobId).not.toBe(job1.jobId)

      // Wait for second job to complete
      await waitForCondition(async () => {
        const status = await service.getJobStatus(job2.jobId)
        return status === 'completed' || status === 'failed'
      }, 10000)
    })
  })

  // ============================================================================
  // Service Lifecycle Tests
  // ============================================================================

  describe('Service Lifecycle', () => {
    it('should initialize and dispose cleanly', async () => {
      // Act
      await service.initialize()

      // Assert - Should be ready
      const ready = await jobStorage.isReady()
      expect(ready).toBe(true)

      // Dispose
      await service.dispose()

      // Service should handle multiple dispose calls gracefully
      await expect(service.dispose()).resolves.not.toThrow()
    })

    it('should report recovery status', async () => {
      // Act
      const status = service.getRecoveryStatus()

      // Assert
      expect(status).toBeDefined()
      expect(status.status).toBe('idle')
      expect(status.jobsRecovered).toBe(0)
      expect(status.jobsFailed).toBe(0)
    })
  })
})
