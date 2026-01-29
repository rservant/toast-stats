/**
 * Property-Based Tests for UnifiedBackfillService
 *
 * Feature: unified-backfill-service
 *
 * Property 4: Job Filtering By Status
 * **Validates: Requirements 6.3**
 * For any status filter applied to listJobs, all returned jobs SHALL have
 * a status matching one of the filter values.
 *
 * Property 5: Rate Limit Config Persistence Round-Trip
 * **Validates: Requirements 12.5**
 * For any valid RateLimitConfig, setting the config via Job_Storage and then
 * retrieving it SHALL return an equivalent config object.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fc from 'fast-check'
import fs from 'fs/promises'
import path from 'path'
import { UnifiedBackfillService } from '../UnifiedBackfillService.js'
import { LocalBackfillJobStorage } from '../../../storage/LocalBackfillJobStorage.js'
import type {
  BackfillJob,
  BackfillJobType,
  BackfillJobStatus,
  JobConfig,
  JobProgress,
  ISnapshotStorage,
  ITimeSeriesIndexStorage,
  RateLimitConfig,
} from '../../../../types/storageInterfaces.js'
import type { RefreshService } from '../../../RefreshService.js'
import type { DistrictConfigurationService } from '../../../DistrictConfigurationService.js'
import type { PreComputedAnalyticsService } from '../../../PreComputedAnalyticsService.js'

// ============================================================================
// Test Configuration
// ============================================================================

const PROPERTY_TEST_CONFIG = {
  numRuns: 100,
  seed: undefined, // Random seed for reproducibility when debugging
  verbose: false,
}

const PROPERTY_TEST_TIMEOUT = 120000 // 2 minutes for property tests

// ============================================================================
// Mock Factories
// ============================================================================

/**
 * Creates a mock RefreshService for testing
 */
function createMockRefreshService(): RefreshService {
  return {
    executeRefresh: vi.fn().mockResolvedValue({
      success: true,
      snapshot_id: 'test-snapshot-id',
      errors: [],
    }),
  } as unknown as RefreshService
}

/**
 * Creates a mock ISnapshotStorage for testing
 */
function createMockSnapshotStorage(): ISnapshotStorage {
  return {
    listSnapshots: vi.fn().mockResolvedValue([]),
    getLatestSuccessful: vi.fn().mockResolvedValue(null),
    getLatest: vi.fn().mockResolvedValue(null),
    writeSnapshot: vi.fn().mockResolvedValue(undefined),
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
  } as unknown as ISnapshotStorage
}

/**
 * Creates a mock ITimeSeriesIndexStorage for testing
 */
function createMockTimeSeriesStorage(): ITimeSeriesIndexStorage {
  return {
    appendDataPoint: vi.fn().mockResolvedValue(undefined),
    getTrendData: vi.fn().mockResolvedValue([]),
    getProgramYearData: vi.fn().mockResolvedValue(null),
    deleteSnapshotEntries: vi.fn().mockResolvedValue(0),
    isReady: vi.fn().mockResolvedValue(true),
  } as unknown as ITimeSeriesIndexStorage
}

/**
 * Creates a mock DistrictConfigurationService for testing
 */
function createMockConfigService(): DistrictConfigurationService {
  return {
    getConfiguredDistricts: vi.fn().mockResolvedValue(['1', '2', '3']),
  } as unknown as DistrictConfigurationService
}

/**
 * Creates a mock PreComputedAnalyticsService for testing
 */
function createMockPreComputedAnalyticsService(): PreComputedAnalyticsService {
  return {
    computeAndStore: vi.fn().mockResolvedValue(undefined),
  } as unknown as PreComputedAnalyticsService
}

// ============================================================================
// Fast-Check Generators
// ============================================================================

/**
 * All possible job statuses
 */
const ALL_JOB_STATUSES: BackfillJobStatus[] = [
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled',
  'recovering',
]

/**
 * Generator for job status
 */
const jobStatusArbitrary: fc.Arbitrary<BackfillJobStatus> = fc.constantFrom(
  ...ALL_JOB_STATUSES
)

/**
 * Generator for non-empty subsets of job statuses (for filtering)
 */
const statusFilterArbitrary: fc.Arbitrary<BackfillJobStatus[]> = fc.subarray(
  ALL_JOB_STATUSES,
  { minLength: 1, maxLength: ALL_JOB_STATUSES.length }
)

/**
 * Generator for job types
 */
const jobTypeArbitrary: fc.Arbitrary<BackfillJobType> = fc.constantFrom(
  'data-collection',
  'analytics-generation'
)

/**
 * Generator for valid ISO timestamp strings
 */
const timestampArbitrary: fc.Arbitrary<string> = fc
  .tuple(
    fc.integer({ min: 2020, max: 2025 }),
    fc.integer({ min: 1, max: 12 }),
    fc.integer({ min: 1, max: 28 }),
    fc.integer({ min: 0, max: 23 }),
    fc.integer({ min: 0, max: 59 }),
    fc.integer({ min: 0, max: 59 })
  )
  .map(([year, month, day, hour, minute, second]) => {
    const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
    return date.toISOString()
  })

/**
 * Generator for job config
 */
const jobConfigArbitrary: fc.Arbitrary<JobConfig> = fc.record({
  startDate: fc.option(
    fc
      .tuple(
        fc.integer({ min: 2020, max: 2024 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 28 })
      )
      .map(
        ([y, m, d]) =>
          `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      ),
    { nil: undefined }
  ),
  endDate: fc.option(
    fc
      .tuple(
        fc.integer({ min: 2020, max: 2024 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 28 })
      )
      .map(
        ([y, m, d]) =>
          `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      ),
    { nil: undefined }
  ),
  targetDistricts: fc.option(
    fc.array(
      fc.integer({ min: 1, max: 100 }).map(n => String(n)),
      { minLength: 0, maxLength: 3 }
    ),
    { nil: undefined }
  ),
  skipExisting: fc.option(fc.boolean(), { nil: undefined }),
})

/**
 * Generator for job progress
 */
const jobProgressArbitrary: fc.Arbitrary<JobProgress> = fc.record({
  totalItems: fc.integer({ min: 0, max: 1000 }),
  processedItems: fc.integer({ min: 0, max: 1000 }),
  failedItems: fc.integer({ min: 0, max: 100 }),
  skippedItems: fc.integer({ min: 0, max: 100 }),
  currentItem: fc.option(
    fc
      .string({ minLength: 1, maxLength: 20 })
      .map(s => s.replace(/[^\x20-\x7E]/g, 'X')),
    { nil: null }
  ),
  districtProgress: fc.constant({}),
  errors: fc.constant([]),
})

/**
 * Generator for a minimal BackfillJob with specified status
 */
function createJobWithStatus(
  jobId: string,
  status: BackfillJobStatus,
  createdAt: string,
  jobType: BackfillJobType,
  config: JobConfig,
  progress: JobProgress
): BackfillJob {
  return {
    jobId,
    jobType,
    status,
    config,
    progress,
    checkpoint: null,
    createdAt,
    startedAt: status !== 'pending' ? createdAt : null,
    completedAt:
      status === 'completed' || status === 'failed' || status === 'cancelled'
        ? createdAt
        : null,
    resumedAt: status === 'recovering' ? createdAt : null,
    result: null,
    error: status === 'failed' ? 'Test error' : null,
  }
}

/**
 * Generator for a BackfillJob with a specific status
 */
const backfillJobWithStatusArbitrary = (
  status: BackfillJobStatus
): fc.Arbitrary<BackfillJob> =>
  fc
    .tuple(
      fc.uuid(),
      jobTypeArbitrary,
      jobConfigArbitrary,
      jobProgressArbitrary,
      timestampArbitrary
    )
    .map(([jobId, jobType, config, progress, createdAt]) =>
      createJobWithStatus(jobId, status, createdAt, jobType, config, progress)
    )

/**
 * Generator for an array of jobs with random statuses
 */
const jobsWithRandomStatusesArbitrary: fc.Arbitrary<BackfillJob[]> = fc
  .array(
    fc.tuple(
      fc.uuid(),
      jobStatusArbitrary,
      jobTypeArbitrary,
      jobConfigArbitrary,
      jobProgressArbitrary,
      timestampArbitrary
    ),
    { minLength: 3, maxLength: 15 }
  )
  .map(tuples =>
    tuples.map(([jobId, status, jobType, config, progress, createdAt], index) =>
      createJobWithStatus(
        `${jobId}-${index}`, // Ensure unique IDs
        status,
        createdAt,
        jobType,
        config,
        progress
      )
    )
  )

// ============================================================================
// Test Suite
// ============================================================================

/**
 * Generator for valid RateLimitConfig
 *
 * Generates rate limit configurations with realistic constraints:
 * - maxRequestsPerMinute: positive integer (1-1000)
 * - maxConcurrent: positive integer (1-100)
 * - minDelayMs: positive integer (100-60000)
 * - maxDelayMs: positive integer (minDelayMs to 120000)
 * - backoffMultiplier: positive number (1.0-5.0)
 *
 * The generator ensures maxDelayMs >= minDelayMs for valid configurations.
 */
const rateLimitConfigArbitrary: fc.Arbitrary<RateLimitConfig> = fc
  .tuple(
    fc.integer({ min: 1, max: 1000 }), // maxRequestsPerMinute
    fc.integer({ min: 1, max: 100 }), // maxConcurrent
    fc.integer({ min: 100, max: 60000 }), // minDelayMs
    fc.double({ min: 1.0, max: 5.0, noNaN: true }) // backoffMultiplier
  )
  .chain(
    ([maxRequestsPerMinute, maxConcurrent, minDelayMs, backoffMultiplier]) =>
      fc.integer({ min: minDelayMs, max: 120000 }).map(maxDelayMs => ({
        maxRequestsPerMinute,
        maxConcurrent,
        minDelayMs,
        maxDelayMs,
        backoffMultiplier,
      }))
  )

// ============================================================================
// Property 4: Job Filtering By Status Test Suite
// ============================================================================

describe('Feature: unified-backfill-service, Property 4: Job Filtering By Status', () => {
  let storage: LocalBackfillJobStorage
  let service: UnifiedBackfillService
  let testCacheDir: string
  let testId: string

  // Mocks
  let mockRefreshService: RefreshService
  let mockSnapshotStorage: ISnapshotStorage
  let mockTimeSeriesStorage: ITimeSeriesIndexStorage
  let mockConfigService: DistrictConfigurationService
  let mockPreComputedAnalyticsService: PreComputedAnalyticsService

  beforeEach(async () => {
    // Create unique test directory for isolation
    testId = `unified-backfill-pbt-${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${process.pid}`
    testCacheDir = path.join(process.cwd(), 'test-cache', testId)
    await fs.mkdir(testCacheDir, { recursive: true })

    // Create storage instance
    storage = new LocalBackfillJobStorage(testCacheDir)

    // Create mocks
    mockRefreshService = createMockRefreshService()
    mockSnapshotStorage = createMockSnapshotStorage()
    mockTimeSeriesStorage = createMockTimeSeriesStorage()
    mockConfigService = createMockConfigService()
    mockPreComputedAnalyticsService = createMockPreComputedAnalyticsService()

    // Create service instance with autoRecoverOnInit disabled to avoid interference
    service = new UnifiedBackfillService(
      storage,
      mockSnapshotStorage,
      mockTimeSeriesStorage,
      mockRefreshService,
      mockConfigService,
      mockPreComputedAnalyticsService,
      { autoRecoverOnInit: false }
    )
  })

  afterEach(async () => {
    // Dispose service to clean up resources
    try {
      await service.dispose()
    } catch {
      // Ignore disposal errors
    }

    // Clean up test directory
    try {
      await fs.rm(testCacheDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }

    vi.clearAllMocks()
  })

  /**
   * Property 4: Job Filtering By Status
   *
   * For any status filter applied to listJobs, all returned jobs SHALL have
   * a status matching one of the filter values.
   *
   * **Validates: Requirements 6.3**
   */
  it(
    'Property 4: All returned jobs have status matching the filter values',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          jobsWithRandomStatusesArbitrary,
          statusFilterArbitrary,
          async (jobs: BackfillJob[], statusFilter: BackfillJobStatus[]) => {
            // Create a fresh storage and service for this iteration
            const iterationId = `filter-${Date.now()}-${Math.random().toString(36).substring(2, 10)}-${process.pid}`
            const iterationCacheDir = path.join(
              process.cwd(),
              'test-cache',
              iterationId
            )
            await fs.mkdir(iterationCacheDir, { recursive: true })
            const iterationStorage = new LocalBackfillJobStorage(
              iterationCacheDir
            )
            const iterationService = new UnifiedBackfillService(
              iterationStorage,
              mockSnapshotStorage,
              mockTimeSeriesStorage,
              mockRefreshService,
              mockConfigService,
              mockPreComputedAnalyticsService,
              { autoRecoverOnInit: false }
            )

            try {
              // Create all jobs in storage
              for (const job of jobs) {
                await iterationStorage.createJob(job)
              }

              // Apply status filter via listJobs
              const filteredJobs = await iterationService.listJobs({
                status: statusFilter,
              })

              // Property: All returned jobs must have a status in the filter set
              for (const job of filteredJobs) {
                expect(statusFilter).toContain(job.status)
              }

              // Additional verification: count jobs that should match
              const expectedMatchCount = jobs.filter(j =>
                statusFilter.includes(j.status)
              ).length
              expect(filteredJobs.length).toBe(expectedMatchCount)

              return true
            } finally {
              // Clean up iteration resources
              try {
                await iterationService.dispose()
              } catch {
                // Ignore disposal errors
              }
              try {
                await fs.rm(iterationCacheDir, { recursive: true, force: true })
              } catch {
                // Ignore cleanup errors
              }
            }
          }
        ),
        {
          numRuns: PROPERTY_TEST_CONFIG.numRuns,
          seed: PROPERTY_TEST_CONFIG.seed,
          verbose: PROPERTY_TEST_CONFIG.verbose,
        }
      )
    },
    PROPERTY_TEST_TIMEOUT
  )

  /**
   * Property 4a: Empty filter returns all jobs
   *
   * When no status filter is applied (undefined or empty array),
   * all jobs should be returned.
   *
   * **Validates: Requirements 6.3**
   */
  it(
    'Property 4a: No status filter returns all jobs',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          jobsWithRandomStatusesArbitrary,
          async (jobs: BackfillJob[]) => {
            // Create a fresh storage and service for this iteration
            const iterationId = `no-filter-${Date.now()}-${Math.random().toString(36).substring(2, 10)}-${process.pid}`
            const iterationCacheDir = path.join(
              process.cwd(),
              'test-cache',
              iterationId
            )
            await fs.mkdir(iterationCacheDir, { recursive: true })
            const iterationStorage = new LocalBackfillJobStorage(
              iterationCacheDir
            )
            const iterationService = new UnifiedBackfillService(
              iterationStorage,
              mockSnapshotStorage,
              mockTimeSeriesStorage,
              mockRefreshService,
              mockConfigService,
              mockPreComputedAnalyticsService,
              { autoRecoverOnInit: false }
            )

            try {
              // Create all jobs in storage
              for (const job of jobs) {
                await iterationStorage.createJob(job)
              }

              // List jobs without filter
              const allJobs = await iterationService.listJobs()

              // Property: All jobs should be returned
              expect(allJobs.length).toBe(jobs.length)

              // Verify all original job IDs are present
              const returnedIds = new Set(allJobs.map(j => j.jobId))
              for (const job of jobs) {
                expect(returnedIds.has(job.jobId)).toBe(true)
              }

              return true
            } finally {
              // Clean up iteration resources
              try {
                await iterationService.dispose()
              } catch {
                // Ignore disposal errors
              }
              try {
                await fs.rm(iterationCacheDir, { recursive: true, force: true })
              } catch {
                // Ignore cleanup errors
              }
            }
          }
        ),
        {
          numRuns: Math.floor(PROPERTY_TEST_CONFIG.numRuns / 2),
          seed: PROPERTY_TEST_CONFIG.seed,
          verbose: PROPERTY_TEST_CONFIG.verbose,
        }
      )
    },
    PROPERTY_TEST_TIMEOUT
  )

  /**
   * Property 4b: Single status filter returns only jobs with that status
   *
   * When filtering by a single status, only jobs with exactly that status
   * should be returned.
   *
   * **Validates: Requirements 6.3**
   */
  it(
    'Property 4b: Single status filter returns only jobs with that exact status',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          jobsWithRandomStatusesArbitrary,
          jobStatusArbitrary,
          async (jobs: BackfillJob[], targetStatus: BackfillJobStatus) => {
            // Create a fresh storage and service for this iteration
            const iterationId = `single-${Date.now()}-${Math.random().toString(36).substring(2, 10)}-${process.pid}`
            const iterationCacheDir = path.join(
              process.cwd(),
              'test-cache',
              iterationId
            )
            await fs.mkdir(iterationCacheDir, { recursive: true })
            const iterationStorage = new LocalBackfillJobStorage(
              iterationCacheDir
            )
            const iterationService = new UnifiedBackfillService(
              iterationStorage,
              mockSnapshotStorage,
              mockTimeSeriesStorage,
              mockRefreshService,
              mockConfigService,
              mockPreComputedAnalyticsService,
              { autoRecoverOnInit: false }
            )

            try {
              // Create all jobs in storage
              for (const job of jobs) {
                await iterationStorage.createJob(job)
              }

              // Filter by single status
              const filteredJobs = await iterationService.listJobs({
                status: [targetStatus],
              })

              // Property: All returned jobs must have exactly the target status
              for (const job of filteredJobs) {
                expect(job.status).toBe(targetStatus)
              }

              // Verify count matches expected
              const expectedCount = jobs.filter(
                j => j.status === targetStatus
              ).length
              expect(filteredJobs.length).toBe(expectedCount)

              return true
            } finally {
              // Clean up iteration resources
              try {
                await iterationService.dispose()
              } catch {
                // Ignore disposal errors
              }
              try {
                await fs.rm(iterationCacheDir, { recursive: true, force: true })
              } catch {
                // Ignore cleanup errors
              }
            }
          }
        ),
        {
          numRuns: PROPERTY_TEST_CONFIG.numRuns,
          seed: PROPERTY_TEST_CONFIG.seed,
          verbose: PROPERTY_TEST_CONFIG.verbose,
        }
      )
    },
    PROPERTY_TEST_TIMEOUT
  )

  /**
   * Property 4c: Filter with non-matching status returns empty array
   *
   * When filtering by a status that no jobs have, an empty array
   * should be returned.
   *
   * **Validates: Requirements 6.3**
   */
  it(
    'Property 4c: Filter with non-matching status returns empty array',
    async () => {
      // Create jobs with only 'completed' status
      const completedJobs = await fc.sample(
        backfillJobWithStatusArbitrary('completed'),
        5
      )

      // Ensure unique job IDs
      const uniqueJobs = completedJobs.map((job, index) => ({
        ...job,
        jobId: `completed-${index}-${Date.now()}`,
      }))

      // Create all jobs in storage
      for (const job of uniqueJobs) {
        await storage.createJob(job)
      }

      // Filter by 'pending' status (which no jobs have)
      const filteredJobs = await service.listJobs({ status: ['pending'] })

      // Property: Should return empty array
      expect(filteredJobs.length).toBe(0)
    },
    PROPERTY_TEST_TIMEOUT
  )

  /**
   * Property 4d: Filter is idempotent
   *
   * Applying the same filter multiple times should return the same results.
   *
   * **Validates: Requirements 6.3**
   */
  it(
    'Property 4d: Filtering is idempotent - same filter returns same results',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          jobsWithRandomStatusesArbitrary,
          statusFilterArbitrary,
          async (jobs: BackfillJob[], statusFilter: BackfillJobStatus[]) => {
            // Create a fresh storage and service for this iteration
            const iterationId = `idempotent-${Date.now()}-${Math.random().toString(36).substring(2, 10)}-${process.pid}`
            const iterationCacheDir = path.join(
              process.cwd(),
              'test-cache',
              iterationId
            )
            await fs.mkdir(iterationCacheDir, { recursive: true })
            const iterationStorage = new LocalBackfillJobStorage(
              iterationCacheDir
            )
            const iterationService = new UnifiedBackfillService(
              iterationStorage,
              mockSnapshotStorage,
              mockTimeSeriesStorage,
              mockRefreshService,
              mockConfigService,
              mockPreComputedAnalyticsService,
              { autoRecoverOnInit: false }
            )

            try {
              // Create all jobs in storage
              for (const job of jobs) {
                await iterationStorage.createJob(job)
              }

              // Apply filter multiple times
              const firstResult = await iterationService.listJobs({
                status: statusFilter,
              })
              const secondResult = await iterationService.listJobs({
                status: statusFilter,
              })
              const thirdResult = await iterationService.listJobs({
                status: statusFilter,
              })

              // Property: All results should be identical
              expect(firstResult.length).toBe(secondResult.length)
              expect(secondResult.length).toBe(thirdResult.length)

              // Verify same job IDs in same order
              for (let i = 0; i < firstResult.length; i++) {
                expect(firstResult[i]!.jobId).toBe(secondResult[i]!.jobId)
                expect(secondResult[i]!.jobId).toBe(thirdResult[i]!.jobId)
              }

              return true
            } finally {
              // Clean up iteration resources
              try {
                await iterationService.dispose()
              } catch {
                // Ignore disposal errors
              }
              try {
                await fs.rm(iterationCacheDir, { recursive: true, force: true })
              } catch {
                // Ignore cleanup errors
              }
            }
          }
        ),
        {
          numRuns: Math.floor(PROPERTY_TEST_CONFIG.numRuns / 2),
          seed: PROPERTY_TEST_CONFIG.seed,
          verbose: PROPERTY_TEST_CONFIG.verbose,
        }
      )
    },
    PROPERTY_TEST_TIMEOUT
  )

  /**
   * Property 4e: Filter completeness - no jobs outside filter are returned
   *
   * When filtering by status, no jobs with statuses outside the filter
   * should be returned.
   *
   * **Validates: Requirements 6.3**
   */
  it(
    'Property 4e: No jobs with statuses outside the filter are returned',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          jobsWithRandomStatusesArbitrary,
          statusFilterArbitrary,
          async (jobs: BackfillJob[], statusFilter: BackfillJobStatus[]) => {
            // Create a fresh storage and service for this iteration
            const iterationId = `completeness-${Date.now()}-${Math.random().toString(36).substring(2, 10)}-${process.pid}`
            const iterationCacheDir = path.join(
              process.cwd(),
              'test-cache',
              iterationId
            )
            await fs.mkdir(iterationCacheDir, { recursive: true })
            const iterationStorage = new LocalBackfillJobStorage(
              iterationCacheDir
            )
            const iterationService = new UnifiedBackfillService(
              iterationStorage,
              mockSnapshotStorage,
              mockTimeSeriesStorage,
              mockRefreshService,
              mockConfigService,
              mockPreComputedAnalyticsService,
              { autoRecoverOnInit: false }
            )

            try {
              // Create all jobs in storage
              for (const job of jobs) {
                await iterationStorage.createJob(job)
              }

              // Get filtered jobs
              const filteredJobs = await iterationService.listJobs({
                status: statusFilter,
              })

              // Get the set of statuses NOT in the filter
              const excludedStatuses = new Set(
                ALL_JOB_STATUSES.filter(s => !statusFilter.includes(s))
              )

              // Property: No returned job should have an excluded status
              for (const job of filteredJobs) {
                expect(excludedStatuses.has(job.status)).toBe(false)
              }

              return true
            } finally {
              // Clean up iteration resources
              try {
                await iterationService.dispose()
              } catch {
                // Ignore disposal errors
              }
              try {
                await fs.rm(iterationCacheDir, { recursive: true, force: true })
              } catch {
                // Ignore cleanup errors
              }
            }
          }
        ),
        {
          numRuns: PROPERTY_TEST_CONFIG.numRuns,
          seed: PROPERTY_TEST_CONFIG.seed,
          verbose: PROPERTY_TEST_CONFIG.verbose,
        }
      )
    },
    PROPERTY_TEST_TIMEOUT
  )
})

// ============================================================================
// Property 5: Rate Limit Config Persistence Round-Trip Test Suite
// ============================================================================

describe('Feature: unified-backfill-service, Property 5: Rate Limit Config Persistence Round-Trip', () => {
  let storage: LocalBackfillJobStorage
  let testCacheDir: string
  let testId: string

  beforeEach(async () => {
    // Create unique test directory for isolation
    testId = `rate-limit-pbt-${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${process.pid}`
    testCacheDir = path.join(process.cwd(), 'test-cache', testId)
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

  /**
   * Property 5: Rate Limit Config Persistence Round-Trip
   *
   * For any valid RateLimitConfig, setting the config via Job_Storage and then
   * retrieving it SHALL return an equivalent config object.
   *
   * **Validates: Requirements 12.5**
   */
  it(
    'Property 5: Setting and retrieving rate limit config returns equivalent config',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          rateLimitConfigArbitrary,
          async (config: RateLimitConfig) => {
            // Create a fresh storage for this iteration to ensure isolation
            const iterationId = `rate-limit-${Date.now()}-${Math.random().toString(36).substring(2, 10)}-${process.pid}`
            const iterationCacheDir = path.join(
              process.cwd(),
              'test-cache',
              iterationId
            )
            await fs.mkdir(iterationCacheDir, { recursive: true })
            const iterationStorage = new LocalBackfillJobStorage(
              iterationCacheDir
            )

            try {
              // Set the rate limit config
              await iterationStorage.setRateLimitConfig(config)

              // Retrieve the rate limit config
              const retrievedConfig =
                await iterationStorage.getRateLimitConfig()

              // Property: Retrieved config must be equivalent to the original
              expect(retrievedConfig.maxRequestsPerMinute).toBe(
                config.maxRequestsPerMinute
              )
              expect(retrievedConfig.maxConcurrent).toBe(config.maxConcurrent)
              expect(retrievedConfig.minDelayMs).toBe(config.minDelayMs)
              expect(retrievedConfig.maxDelayMs).toBe(config.maxDelayMs)
              expect(retrievedConfig.backoffMultiplier).toBeCloseTo(
                config.backoffMultiplier,
                10
              )

              return true
            } finally {
              // Clean up iteration resources
              try {
                await fs.rm(iterationCacheDir, { recursive: true, force: true })
              } catch {
                // Ignore cleanup errors
              }
            }
          }
        ),
        {
          numRuns: PROPERTY_TEST_CONFIG.numRuns,
          seed: PROPERTY_TEST_CONFIG.seed,
          verbose: PROPERTY_TEST_CONFIG.verbose,
        }
      )
    },
    PROPERTY_TEST_TIMEOUT
  )

  /**
   * Property 5a: Multiple set operations preserve latest config
   *
   * When multiple configs are set sequentially, retrieving the config
   * SHALL return the most recently set config.
   *
   * **Validates: Requirements 12.5**
   */
  it(
    'Property 5a: Multiple set operations preserve the latest config',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(rateLimitConfigArbitrary, { minLength: 2, maxLength: 5 }),
          async (configs: RateLimitConfig[]) => {
            // Create a fresh storage for this iteration
            const iterationId = `rate-limit-multi-${Date.now()}-${Math.random().toString(36).substring(2, 10)}-${process.pid}`
            const iterationCacheDir = path.join(
              process.cwd(),
              'test-cache',
              iterationId
            )
            await fs.mkdir(iterationCacheDir, { recursive: true })
            const iterationStorage = new LocalBackfillJobStorage(
              iterationCacheDir
            )

            try {
              // Set each config sequentially
              for (const config of configs) {
                await iterationStorage.setRateLimitConfig(config)
              }

              // Retrieve the config
              const retrievedConfig =
                await iterationStorage.getRateLimitConfig()

              // Property: Retrieved config must match the last config set
              const lastConfig = configs[configs.length - 1]!
              expect(retrievedConfig.maxRequestsPerMinute).toBe(
                lastConfig.maxRequestsPerMinute
              )
              expect(retrievedConfig.maxConcurrent).toBe(
                lastConfig.maxConcurrent
              )
              expect(retrievedConfig.minDelayMs).toBe(lastConfig.minDelayMs)
              expect(retrievedConfig.maxDelayMs).toBe(lastConfig.maxDelayMs)
              expect(retrievedConfig.backoffMultiplier).toBeCloseTo(
                lastConfig.backoffMultiplier,
                10
              )

              return true
            } finally {
              // Clean up iteration resources
              try {
                await fs.rm(iterationCacheDir, { recursive: true, force: true })
              } catch {
                // Ignore cleanup errors
              }
            }
          }
        ),
        {
          numRuns: Math.floor(PROPERTY_TEST_CONFIG.numRuns / 2),
          seed: PROPERTY_TEST_CONFIG.seed,
          verbose: PROPERTY_TEST_CONFIG.verbose,
        }
      )
    },
    PROPERTY_TEST_TIMEOUT
  )

  /**
   * Property 5b: Config retrieval is idempotent
   *
   * Retrieving the same config multiple times SHALL return equivalent results.
   *
   * **Validates: Requirements 12.5**
   */
  it(
    'Property 5b: Config retrieval is idempotent',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          rateLimitConfigArbitrary,
          async (config: RateLimitConfig) => {
            // Create a fresh storage for this iteration
            const iterationId = `rate-limit-idem-${Date.now()}-${Math.random().toString(36).substring(2, 10)}-${process.pid}`
            const iterationCacheDir = path.join(
              process.cwd(),
              'test-cache',
              iterationId
            )
            await fs.mkdir(iterationCacheDir, { recursive: true })
            const iterationStorage = new LocalBackfillJobStorage(
              iterationCacheDir
            )

            try {
              // Set the config
              await iterationStorage.setRateLimitConfig(config)

              // Retrieve multiple times
              const firstRetrieval = await iterationStorage.getRateLimitConfig()
              const secondRetrieval =
                await iterationStorage.getRateLimitConfig()
              const thirdRetrieval = await iterationStorage.getRateLimitConfig()

              // Property: All retrievals must be equivalent
              expect(firstRetrieval.maxRequestsPerMinute).toBe(
                secondRetrieval.maxRequestsPerMinute
              )
              expect(secondRetrieval.maxRequestsPerMinute).toBe(
                thirdRetrieval.maxRequestsPerMinute
              )

              expect(firstRetrieval.maxConcurrent).toBe(
                secondRetrieval.maxConcurrent
              )
              expect(secondRetrieval.maxConcurrent).toBe(
                thirdRetrieval.maxConcurrent
              )

              expect(firstRetrieval.minDelayMs).toBe(secondRetrieval.minDelayMs)
              expect(secondRetrieval.minDelayMs).toBe(thirdRetrieval.minDelayMs)

              expect(firstRetrieval.maxDelayMs).toBe(secondRetrieval.maxDelayMs)
              expect(secondRetrieval.maxDelayMs).toBe(thirdRetrieval.maxDelayMs)

              expect(firstRetrieval.backoffMultiplier).toBeCloseTo(
                secondRetrieval.backoffMultiplier,
                10
              )
              expect(secondRetrieval.backoffMultiplier).toBeCloseTo(
                thirdRetrieval.backoffMultiplier,
                10
              )

              return true
            } finally {
              // Clean up iteration resources
              try {
                await fs.rm(iterationCacheDir, { recursive: true, force: true })
              } catch {
                // Ignore cleanup errors
              }
            }
          }
        ),
        {
          numRuns: Math.floor(PROPERTY_TEST_CONFIG.numRuns / 2),
          seed: PROPERTY_TEST_CONFIG.seed,
          verbose: PROPERTY_TEST_CONFIG.verbose,
        }
      )
    },
    PROPERTY_TEST_TIMEOUT
  )
})
