/**
 * Property-Based Tests for LocalBackfillJobStorage
 *
 * Feature: unified-backfill-service
 * Property 1: Job Persistence Round-Trip
 *
 * **Validates: Requirements 1.2**
 *
 * For any valid BackfillJob, creating the job via Job_Storage and then
 * retrieving it by jobId SHALL return an equivalent job object.
 *
 * This test validates that the LocalBackfillJobStorage correctly persists
 * and retrieves backfill jobs without data loss or corruption.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import fs from 'fs/promises'
import path from 'path'
import { LocalBackfillJobStorage } from '../LocalBackfillJobStorage.js'
import type {
  BackfillJob,
  BackfillJobType,
  BackfillJobStatus,
  JobConfig,
  JobProgress,
  JobCheckpoint,
  JobResult,
  JobError,
  DistrictProgress,
} from '../../../types/storageInterfaces.js'

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
// Fast-Check Generators
// ============================================================================

/**
 * Generator for valid job IDs (UUIDs)
 */
const jobIdArbitrary = fc.uuid()

/**
 * Generator for job types
 */
const jobTypeArbitrary: fc.Arbitrary<BackfillJobType> = fc.constantFrom(
  'data-collection',
  'analytics-generation'
)

/**
 * Generator for valid ISO date strings (YYYY-MM-DD)
 * Uses explicit date components to avoid invalid date issues
 */
const dateArbitrary: fc.Arbitrary<string> = fc
  .tuple(
    fc.integer({ min: 2020, max: 2025 }),
    fc.integer({ min: 1, max: 12 }),
    fc.integer({ min: 1, max: 28 }) // Use 28 to avoid invalid dates
  )
  .map(
    ([year, month, day]) =>
      `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  )

/**
 * Generator for job status
 */
const jobStatusArbitrary: fc.Arbitrary<BackfillJobStatus> = fc.constantFrom(
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled'
)

/**
 * Generator for valid ISO timestamp strings
 * Uses explicit date components to avoid invalid date issues
 */
const timestampArbitrary: fc.Arbitrary<string> = fc
  .tuple(
    fc.integer({ min: 2020, max: 2025 }),
    fc.integer({ min: 1, max: 12 }),
    fc.integer({ min: 1, max: 28 }), // Use 28 to avoid invalid dates
    fc.integer({ min: 0, max: 23 }),
    fc.integer({ min: 0, max: 59 }),
    fc.integer({ min: 0, max: 59 })
  )
  .map(([year, month, day, hour, minute, second]) => {
    const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
    return date.toISOString()
  })

/**
 * Generator for district IDs
 */
const districtIdArbitrary: fc.Arbitrary<string> = fc.oneof(
  fc.integer({ min: 1, max: 999 }).map(n => String(n)),
  fc.constantFrom('A', 'B', 'C', 'D', 'E', 'F', 'U')
)

/**
 * Generator for district progress status
 */
const districtProgressStatusArbitrary: fc.Arbitrary<
  DistrictProgress['status']
> = fc.constantFrom('pending', 'processing', 'completed', 'failed', 'skipped')

/**
 * Generator for district progress
 */
const districtProgressArbitrary: fc.Arbitrary<DistrictProgress> = fc.record({
  districtId: districtIdArbitrary,
  status: districtProgressStatusArbitrary,
  itemsProcessed: fc.integer({ min: 0, max: 1000 }),
  itemsTotal: fc.integer({ min: 0, max: 1000 }),
  lastError: fc.option(
    fc
      .string({ minLength: 1, maxLength: 100 })
      .map(s => s.replace(/[^\x20-\x7E]/g, 'X')),
    { nil: null }
  ),
})

/**
 * Generator for job errors
 */
const jobErrorArbitrary: fc.Arbitrary<JobError> = fc.record({
  itemId: fc
    .string({ minLength: 1, maxLength: 50 })
    .map(s => s.replace(/[^\x20-\x7E]/g, 'X')),
  message: fc
    .string({ minLength: 1, maxLength: 200 })
    .map(s => s.replace(/[^\x20-\x7E]/g, 'X')),
  occurredAt: timestampArbitrary,
  isRetryable: fc.boolean(),
})

/**
 * Generator for job progress with district progress as Record
 */
const jobProgressArbitrary: fc.Arbitrary<JobProgress> = fc
  .tuple(
    fc.integer({ min: 0, max: 10000 }),
    fc.integer({ min: 0, max: 10000 }),
    fc.integer({ min: 0, max: 1000 }),
    fc.integer({ min: 0, max: 1000 }),
    fc.option(
      fc
        .string({ minLength: 1, maxLength: 50 })
        .map(s => s.replace(/[^\x20-\x7E]/g, 'X')),
      { nil: null }
    ),
    fc.array(districtProgressArbitrary, { minLength: 0, maxLength: 5 }),
    fc.array(jobErrorArbitrary, { minLength: 0, maxLength: 3 })
  )
  .map(
    ([
      totalItems,
      processedItems,
      failedItems,
      skippedItems,
      currentItem,
      districtProgressArray,
      errors,
    ]) => {
      // Convert array to Record<string, DistrictProgress>
      const districtProgress: Record<string, DistrictProgress> = {}
      for (const dp of districtProgressArray) {
        districtProgress[dp.districtId] = dp
      }

      return {
        totalItems,
        processedItems,
        failedItems,
        skippedItems,
        currentItem,
        districtProgress,
        errors,
      }
    }
  )

/**
 * Generator for job config
 */
const jobConfigArbitrary: fc.Arbitrary<JobConfig> = fc.record({
  startDate: fc.option(dateArbitrary, { nil: undefined }),
  endDate: fc.option(dateArbitrary, { nil: undefined }),
  targetDistricts: fc.option(
    fc.array(districtIdArbitrary, { minLength: 0, maxLength: 5 }),
    { nil: undefined }
  ),
  skipExisting: fc.option(fc.boolean(), { nil: undefined }),
  rateLimitOverrides: fc.option(
    fc.record({
      maxRequestsPerMinute: fc.option(fc.integer({ min: 1, max: 100 }), {
        nil: undefined,
      }),
      maxConcurrent: fc.option(fc.integer({ min: 1, max: 10 }), {
        nil: undefined,
      }),
      minDelayMs: fc.option(fc.integer({ min: 100, max: 10000 }), {
        nil: undefined,
      }),
      maxDelayMs: fc.option(fc.integer({ min: 1000, max: 60000 }), {
        nil: undefined,
      }),
      backoffMultiplier: fc.option(fc.double({ min: 1, max: 5, noNaN: true }), {
        nil: undefined,
      }),
    }),
    { nil: undefined }
  ),
})

/**
 * Generator for job checkpoint
 */
const jobCheckpointArbitrary: fc.Arbitrary<JobCheckpoint> = fc.record({
  lastProcessedItem: fc
    .string({ minLength: 1, maxLength: 50 })
    .map(s => s.replace(/[^\x20-\x7E]/g, 'X')),
  lastProcessedAt: timestampArbitrary,
  itemsCompleted: fc.array(
    fc
      .string({ minLength: 1, maxLength: 50 })
      .map(s => s.replace(/[^\x20-\x7E]/g, 'X')),
    { minLength: 0, maxLength: 10 }
  ),
})

/**
 * Generator for job result
 */
const jobResultArbitrary: fc.Arbitrary<JobResult> = fc.record({
  itemsProcessed: fc.integer({ min: 0, max: 10000 }),
  itemsFailed: fc.integer({ min: 0, max: 1000 }),
  itemsSkipped: fc.integer({ min: 0, max: 1000 }),
  snapshotIds: fc.array(dateArbitrary, { minLength: 0, maxLength: 10 }),
  duration: fc.integer({ min: 0, max: 86400000 }), // Up to 24 hours in ms
})

/**
 * Generator for complete BackfillJob objects
 */
const backfillJobArbitrary: fc.Arbitrary<BackfillJob> = fc
  .tuple(
    jobIdArbitrary,
    jobTypeArbitrary,
    jobStatusArbitrary,
    jobConfigArbitrary,
    jobProgressArbitrary,
    fc.option(jobCheckpointArbitrary, { nil: null }),
    timestampArbitrary,
    fc.option(timestampArbitrary, { nil: null }),
    fc.option(timestampArbitrary, { nil: null }),
    fc.option(timestampArbitrary, { nil: null }),
    fc.option(jobResultArbitrary, { nil: null }),
    fc.option(
      fc
        .string({ minLength: 1, maxLength: 200 })
        .map(s => s.replace(/[^\x20-\x7E]/g, 'X')),
      { nil: null }
    )
  )
  .map(
    ([
      jobId,
      jobType,
      status,
      config,
      progress,
      checkpoint,
      createdAt,
      startedAt,
      completedAt,
      resumedAt,
      result,
      error,
    ]) => ({
      jobId,
      jobType,
      status,
      config,
      progress,
      checkpoint,
      createdAt,
      startedAt,
      completedAt,
      resumedAt,
      result,
      error,
    })
  )

// ============================================================================
// Comparison Utilities
// ============================================================================

/**
 * Deep comparison of two BackfillJob objects for equivalence
 *
 * This function compares all fields that should be preserved
 * through a round-trip write/read operation.
 */
function assertJobsEquivalent(
  original: BackfillJob,
  retrieved: BackfillJob
): void {
  // Compare top-level fields
  expect(retrieved.jobId).toBe(original.jobId)
  expect(retrieved.jobType).toBe(original.jobType)
  expect(retrieved.status).toBe(original.status)
  expect(retrieved.createdAt).toBe(original.createdAt)
  expect(retrieved.startedAt).toBe(original.startedAt)
  expect(retrieved.completedAt).toBe(original.completedAt)
  expect(retrieved.resumedAt).toBe(original.resumedAt)
  expect(retrieved.error).toBe(original.error)

  // Compare config
  expect(retrieved.config.startDate).toBe(original.config.startDate)
  expect(retrieved.config.endDate).toBe(original.config.endDate)
  expect(retrieved.config.skipExisting).toBe(original.config.skipExisting)

  // Compare targetDistricts (may be undefined or array)
  if (original.config.targetDistricts === undefined) {
    expect(retrieved.config.targetDistricts).toBeUndefined()
  } else {
    expect(retrieved.config.targetDistricts).toEqual(
      original.config.targetDistricts
    )
  }

  // Compare rateLimitOverrides
  if (original.config.rateLimitOverrides === undefined) {
    expect(retrieved.config.rateLimitOverrides).toBeUndefined()
  } else {
    expect(retrieved.config.rateLimitOverrides).toEqual(
      original.config.rateLimitOverrides
    )
  }

  // Compare progress
  expect(retrieved.progress.totalItems).toBe(original.progress.totalItems)
  expect(retrieved.progress.processedItems).toBe(
    original.progress.processedItems
  )
  expect(retrieved.progress.failedItems).toBe(original.progress.failedItems)
  expect(retrieved.progress.skippedItems).toBe(original.progress.skippedItems)
  expect(retrieved.progress.currentItem).toBe(original.progress.currentItem)
  expect(retrieved.progress.errors).toEqual(original.progress.errors)

  // Compare district progress
  const originalDistrictIds = Object.keys(
    original.progress.districtProgress
  ).sort()
  const retrievedDistrictIds = Object.keys(
    retrieved.progress.districtProgress
  ).sort()
  expect(retrievedDistrictIds).toEqual(originalDistrictIds)

  for (const districtId of originalDistrictIds) {
    const origDp = original.progress.districtProgress[districtId]!
    const retDp = retrieved.progress.districtProgress[districtId]!
    expect(retDp.districtId).toBe(origDp.districtId)
    expect(retDp.status).toBe(origDp.status)
    expect(retDp.itemsProcessed).toBe(origDp.itemsProcessed)
    expect(retDp.itemsTotal).toBe(origDp.itemsTotal)
    expect(retDp.lastError).toBe(origDp.lastError)
  }

  // Compare checkpoint
  if (original.checkpoint === null) {
    expect(retrieved.checkpoint).toBeNull()
  } else {
    expect(retrieved.checkpoint).not.toBeNull()
    expect(retrieved.checkpoint!.lastProcessedItem).toBe(
      original.checkpoint.lastProcessedItem
    )
    expect(retrieved.checkpoint!.lastProcessedAt).toBe(
      original.checkpoint.lastProcessedAt
    )
    expect(retrieved.checkpoint!.itemsCompleted).toEqual(
      original.checkpoint.itemsCompleted
    )
  }

  // Compare result
  if (original.result === null) {
    expect(retrieved.result).toBeNull()
  } else {
    expect(retrieved.result).not.toBeNull()
    expect(retrieved.result!.itemsProcessed).toBe(
      original.result.itemsProcessed
    )
    expect(retrieved.result!.itemsFailed).toBe(original.result.itemsFailed)
    expect(retrieved.result!.itemsSkipped).toBe(original.result.itemsSkipped)
    expect(retrieved.result!.snapshotIds).toEqual(original.result.snapshotIds)
    expect(retrieved.result!.duration).toBe(original.result.duration)
  }
}

// ============================================================================
// Test Suite
// ============================================================================

describe('Feature: unified-backfill-service, Property 1: Job Persistence Round-Trip', () => {
  let storage: LocalBackfillJobStorage
  let testCacheDir: string
  let testId: string

  beforeEach(async () => {
    // Create unique test directory for isolation
    // Uses timestamp + random string to ensure uniqueness across parallel test runs
    testId = `backfill-job-pbt-${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${process.pid}`
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
   * Property 1: Job Persistence Round-Trip
   *
   * For any valid BackfillJob, creating the job via Job_Storage and then
   * retrieving it by jobId SHALL return an equivalent job object.
   *
   * **Validates: Requirements 1.2**
   */
  it(
    'Property 1: Job persistence round-trip produces equivalent data',
    async () => {
      await fc.assert(
        fc.asyncProperty(backfillJobArbitrary, async (job: BackfillJob) => {
          // Create the job
          await storage.createJob(job)

          // Read it back
          const retrieved = await storage.getJob(job.jobId)

          // Verify it was retrieved
          expect(retrieved).not.toBeNull()

          // Verify equivalence
          assertJobsEquivalent(job, retrieved!)

          return true
        }),
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
   * Property 1a: Multiple jobs maintain isolation
   *
   * Writing multiple jobs should not cause data corruption or mixing.
   * Each job should be retrievable independently with correct data.
   *
   * **Validates: Requirements 1.2**
   */
  it(
    'Property 1a: Multiple jobs maintain isolation',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(backfillJobArbitrary, { minLength: 2, maxLength: 5 }),
          async (jobs: BackfillJob[]) => {
            // Ensure unique job IDs by regenerating them
            const uniqueJobs = jobs.map((job, index) => ({
              ...job,
              jobId: `${job.jobId}-${index}`,
            }))

            // Create all jobs
            for (const job of uniqueJobs) {
              await storage.createJob(job)
            }

            // Verify each job can be retrieved correctly
            for (const original of uniqueJobs) {
              const retrieved = await storage.getJob(original.jobId)
              expect(retrieved).not.toBeNull()
              assertJobsEquivalent(original, retrieved!)
            }

            return true
          }
        ),
        {
          numRuns: Math.floor(PROPERTY_TEST_CONFIG.numRuns / 4), // Fewer runs for multi-job tests
          seed: PROPERTY_TEST_CONFIG.seed,
          verbose: PROPERTY_TEST_CONFIG.verbose,
        }
      )
    },
    PROPERTY_TEST_TIMEOUT
  )

  /**
   * Property 1b: Job update preserves unmodified fields
   *
   * When updating a job with partial data, unmodified fields should
   * remain unchanged after the update.
   *
   * **Validates: Requirements 1.2**
   */
  it(
    'Property 1b: Job update preserves unmodified fields',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          backfillJobArbitrary,
          jobStatusArbitrary,
          async (job: BackfillJob, newStatus: BackfillJobStatus) => {
            // Create the job
            await storage.createJob(job)

            // Update only the status
            await storage.updateJob(job.jobId, { status: newStatus })

            // Read it back
            const retrieved = await storage.getJob(job.jobId)
            expect(retrieved).not.toBeNull()

            // Verify status was updated
            expect(retrieved!.status).toBe(newStatus)

            // Verify other fields remain unchanged
            expect(retrieved!.jobId).toBe(job.jobId)
            expect(retrieved!.jobType).toBe(job.jobType)
            expect(retrieved!.createdAt).toBe(job.createdAt)
            expect(retrieved!.config).toEqual(job.config)
            expect(retrieved!.progress.totalItems).toBe(job.progress.totalItems)

            return true
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
   * Property 1c: Checkpoint update round-trip
   *
   * Updating a job's checkpoint and then retrieving it should
   * return the exact checkpoint data.
   *
   * **Validates: Requirements 1.2**
   */
  it(
    'Property 1c: Checkpoint update round-trip produces equivalent data',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          backfillJobArbitrary,
          jobCheckpointArbitrary,
          async (job: BackfillJob, checkpoint: JobCheckpoint) => {
            // Create the job
            await storage.createJob(job)

            // Update the checkpoint
            await storage.updateCheckpoint(job.jobId, checkpoint)

            // Read checkpoint back
            const retrievedCheckpoint = await storage.getCheckpoint(job.jobId)
            expect(retrievedCheckpoint).not.toBeNull()

            // Verify checkpoint equivalence
            expect(retrievedCheckpoint!.lastProcessedItem).toBe(
              checkpoint.lastProcessedItem
            )
            expect(retrievedCheckpoint!.lastProcessedAt).toBe(
              checkpoint.lastProcessedAt
            )
            expect(retrievedCheckpoint!.itemsCompleted).toEqual(
              checkpoint.itemsCompleted
            )

            return true
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

/**
 * Property-Based Tests for LocalBackfillJobStorage
 *
 * Feature: unified-backfill-service
 * Property 2: Job Listing Order Invariant
 *
 * **Validates: Requirements 1.6**
 *
 * For any set of BackfillJobs created at different times, listing jobs
 * SHALL return them sorted by creation time with newest first.
 *
 * This test validates that the LocalBackfillJobStorage correctly maintains
 * the ordering invariant when listing jobs.
 */
describe('Feature: unified-backfill-service, Property 2: Job Listing Order Invariant', () => {
  let storage: LocalBackfillJobStorage
  let testCacheDir: string
  let testId: string

  beforeEach(async () => {
    // Create unique test directory for isolation
    // Uses timestamp + random string to ensure uniqueness across parallel test runs
    testId = `backfill-job-pbt-order-${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${process.pid}`
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
   * Property 2: Job Listing Order Invariant
   *
   * For any set of BackfillJobs created at different times, listing jobs
   * SHALL return them sorted by creation time with newest first.
   *
   * **Validates: Requirements 1.6**
   */
  it(
    'Property 2: Jobs are listed in descending order by creation time (newest first)',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate 2-10 jobs with unique timestamps
          fc.integer({ min: 2, max: 10 }).chain(count =>
            fc.tuple(
              fc.array(backfillJobArbitrary, {
                minLength: count,
                maxLength: count,
              }),
              // Generate unique timestamps for each job (in milliseconds since epoch)
              fc.array(
                fc.integer({ min: 1577836800000, max: 1735689600000 }), // 2020-01-01 to 2025-01-01
                { minLength: count, maxLength: count }
              )
            )
          ),
          async ([jobs, timestamps]: [BackfillJob[], number[]]) => {
            // Create a fresh storage instance for this iteration to ensure isolation
            const iterationId = `order-${Date.now()}-${Math.random().toString(36).substring(2, 10)}-${process.pid}`
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
              // Ensure unique timestamps by sorting and adding offsets
              const sortedTimestamps = [...timestamps].sort((a, b) => a - b)
              const uniqueTimestamps = sortedTimestamps.map(
                (ts, idx) => ts + idx * 1000
              )

              // Create jobs with guaranteed unique IDs
              const jobsWithUniqueTimestamps = jobs.map((job, index) => ({
                ...job,
                jobId: `order-${iterationId}-${index}`,
                createdAt: new Date(uniqueTimestamps[index]!).toISOString(),
              }))

              // Create all jobs (in arbitrary order - the order we create them shouldn't matter)
              for (const job of jobsWithUniqueTimestamps) {
                await iterationStorage.createJob(job)
              }

              // List all jobs
              const listedJobs = await iterationStorage.listJobs()

              // Verify we got all jobs back
              expect(listedJobs.length).toBe(jobsWithUniqueTimestamps.length)

              // Verify jobs are sorted by creation time (newest first)
              for (let i = 0; i < listedJobs.length - 1; i++) {
                const currentJob = listedJobs[i]!
                const nextJob = listedJobs[i + 1]!
                const currentTime = new Date(currentJob.createdAt).getTime()
                const nextTime = new Date(nextJob.createdAt).getTime()

                // Current job should have a creation time >= next job (descending order)
                expect(currentTime).toBeGreaterThanOrEqual(nextTime)
              }

              return true
            } finally {
              // Clean up iteration-specific directory
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
   * Property 2a: Job listing order is stable across multiple calls
   *
   * Listing jobs multiple times should return the same order each time.
   *
   * **Validates: Requirements 1.6**
   */
  it(
    'Property 2a: Job listing order is stable across multiple calls',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(backfillJobArbitrary, { minLength: 3, maxLength: 7 }),
          async (jobs: BackfillJob[]) => {
            // Create jobs with unique IDs and staggered timestamps
            const baseTime = Date.now()
            const jobsWithUniqueData = jobs.map((job, index) => ({
              ...job,
              jobId: `${job.jobId}-stable-${index}`,
              createdAt: new Date(baseTime - index * 60000).toISOString(), // 1 minute apart
            }))

            // Create all jobs
            for (const job of jobsWithUniqueData) {
              await storage.createJob(job)
            }

            // List jobs multiple times
            const firstListing = await storage.listJobs()
            const secondListing = await storage.listJobs()
            const thirdListing = await storage.listJobs()

            // Verify all listings have the same order
            expect(firstListing.length).toBe(secondListing.length)
            expect(secondListing.length).toBe(thirdListing.length)

            for (let i = 0; i < firstListing.length; i++) {
              expect(firstListing[i]!.jobId).toBe(secondListing[i]!.jobId)
              expect(secondListing[i]!.jobId).toBe(thirdListing[i]!.jobId)
            }

            return true
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
   * Property 2b: Job listing order is maintained after updates
   *
   * Updating a job's status or progress should not change its position
   * in the listing order (which is based on creation time).
   *
   * **Validates: Requirements 1.6**
   */
  it(
    'Property 2b: Job listing order is maintained after updates',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(backfillJobArbitrary, { minLength: 3, maxLength: 5 }),
          jobStatusArbitrary,
          async (jobs: BackfillJob[], newStatus: BackfillJobStatus) => {
            // Create jobs with unique IDs and staggered timestamps
            const baseTime = Date.now()
            const jobsWithUniqueData = jobs.map((job, index) => ({
              ...job,
              jobId: `${job.jobId}-update-${index}`,
              createdAt: new Date(baseTime - index * 60000).toISOString(), // 1 minute apart
            }))

            // Create all jobs
            for (const job of jobsWithUniqueData) {
              await storage.createJob(job)
            }

            // Get initial listing order
            const initialListing = await storage.listJobs()
            const initialOrder = initialListing.map(j => j.jobId)

            // Update a random job's status (pick the middle one)
            const middleIndex = Math.floor(jobsWithUniqueData.length / 2)
            const jobToUpdate = jobsWithUniqueData[middleIndex]!
            await storage.updateJob(jobToUpdate.jobId, { status: newStatus })

            // Get listing after update
            const afterUpdateListing = await storage.listJobs()
            const afterUpdateOrder = afterUpdateListing.map(j => j.jobId)

            // Verify order is unchanged
            expect(afterUpdateOrder).toEqual(initialOrder)

            return true
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
