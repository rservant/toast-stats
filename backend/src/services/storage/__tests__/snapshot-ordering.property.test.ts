/**
 * Property-Based Tests for Latest Successful Snapshot Ordering
 *
 * @pbt-justification Warranted per .kiro/steering/testing.md criteria:
 *   - Mathematical invariant: latest-snapshot ordering must be correct across all date sequences
 *   - Complex input space: generated snapshot date sequences with varied orderings
 *
 * Feature: gcp-storage-migration
 * Property 3: Latest Successful Snapshot Ordering
 *
 * **Validates: Requirements 2.3, 2.4**
 *
 * For any set of snapshots with varying dates and statuses (success/partial/failed),
 * `getLatestSuccessful` SHALL return the snapshot with the most recent date among
 * those with status 'success', or null if no successful snapshots exist.
 *
 * This test runs against LocalSnapshotStorage to verify the ordering invariant
 * holds across many combinations of snapshot dates and statuses.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import fs from 'fs/promises'
import path from 'path'
import { LocalSnapshotStorage } from '../LocalSnapshotStorage.js'
import type { ISnapshotStorage } from '../../../types/storageInterfaces.js'
import type { Snapshot, SnapshotStatus } from '../../../types/snapshots.js'
import type { DistrictStatistics } from '../../../types/districts.js'

// ============================================================================
// Test Configuration
// ============================================================================

const PROPERTY_TEST_ITERATIONS = 100
const PROPERTY_TEST_TIMEOUT = 120000 // 2 minutes for property tests

// ============================================================================
// Fast-Check Generators
// ============================================================================

/**
 * Generator for valid ISO date strings (YYYY-MM-DD)
 * Uses a constrained date range to ensure valid dates
 */
const generateISODate = (): fc.Arbitrary<string> =>
  fc
    .tuple(
      fc.integer({ min: 2020, max: 2030 }),
      fc.integer({ min: 1, max: 12 }),
      fc.integer({ min: 1, max: 28 }) // Use 28 to avoid invalid dates
    )
    .map(
      ([year, month, day]) =>
        `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    )

/**
 * Generator for valid ISO timestamp strings
 */
const generateISOTimestamp = (): fc.Arbitrary<string> =>
  generateISODate().map(date => `${date}T12:00:00.000Z`)

/**
 * Generator for snapshot status
 */
const generateSnapshotStatus = (): fc.Arbitrary<SnapshotStatus> =>
  fc.constantFrom('success', 'partial', 'failed')

/**
 * Generator for schema version strings
 */
const generateSchemaVersion = (): fc.Arbitrary<string> =>
  fc
    .tuple(
      fc.integer({ min: 1, max: 5 }),
      fc.integer({ min: 0, max: 9 }),
      fc.integer({ min: 0, max: 9 })
    )
    .map(([major, minor, patch]) => `${major}.${minor}.${patch}`)

/**
 * Generator for minimal district statistics (for testing ordering, not content)
 */
const generateMinimalDistrictStatistics = (
  districtId: string,
  asOfDate: string
): DistrictStatistics => ({
  districtId,
  asOfDate,
  membership: {
    total: 100,
    change: 0,
    changePercent: 0,
    byClub: [],
  },
  clubs: {
    total: 10,
    active: 8,
    suspended: 1,
    ineligible: 0,
    low: 1,
    distinguished: 3,
  },
  education: {
    totalAwards: 50,
    byType: [],
    topClubs: [],
  },
})

/**
 * Generator for a minimal snapshot with specified date and status
 * This creates lightweight snapshots focused on testing ordering logic
 */
const generateMinimalSnapshot = (
  date: string,
  status: SnapshotStatus
): fc.Arbitrary<Snapshot> =>
  fc
    .tuple(
      generateSchemaVersion(),
      generateSchemaVersion(),
      generateISOTimestamp()
    )
    .map(([schemaVersion, calcVersion, createdAt]) => ({
      snapshot_id: date,
      created_at: createdAt,
      schema_version: schemaVersion,
      calculation_version: calcVersion,
      status,
      errors: status === 'success' ? [] : ['Test error'],
      payload: {
        districts: [generateMinimalDistrictStatistics('1', date)],
        metadata: {
          source: 'test' as const,
          fetchedAt: createdAt,
          dataAsOfDate: date,
          districtCount: 1,
          processingDurationMs: 100,
        },
      },
    }))

/**
 * Generator for a set of unique dates
 * Ensures no duplicate dates in the generated set
 */
const generateUniqueDates = (count: number): fc.Arbitrary<string[]> => {
  // Generate dates from a pool to ensure uniqueness
  const years = [2020, 2021, 2022, 2023, 2024, 2025]
  const months = Array.from({ length: 12 }, (_, i) => i + 1)
  const days = Array.from({ length: 28 }, (_, i) => i + 1)

  // Create a pool of possible dates
  const datePool: string[] = []
  for (const year of years) {
    for (const month of months) {
      for (const day of days) {
        datePool.push(
          `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        )
      }
    }
  }

  return fc.shuffledSubarray(datePool, { minLength: count, maxLength: count })
}

/**
 * Generator for snapshot date-status pairs
 * Generates a set of unique dates with random statuses
 */
const generateSnapshotSpecs = (
  minCount: number,
  maxCount: number
): fc.Arbitrary<Array<{ date: string; status: SnapshotStatus }>> =>
  fc
    .integer({ min: minCount, max: maxCount })
    .chain(count =>
      fc.tuple(
        generateUniqueDates(count),
        fc.array(generateSnapshotStatus(), {
          minLength: count,
          maxLength: count,
        })
      )
    )
    .map(([dates, statuses]) =>
      dates.map((date, i) => ({
        date,
        status: statuses[i]!,
      }))
    )

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Find the expected latest successful snapshot from a set of specs
 * Returns the date of the most recent successful snapshot, or null if none
 */
function findExpectedLatestSuccessful(
  specs: Array<{ date: string; status: SnapshotStatus }>
): string | null {
  const successfulSpecs = specs.filter(s => s.status === 'success')
  if (successfulSpecs.length === 0) {
    return null
  }

  // Sort by date descending and return the first (most recent)
  const sorted = [...successfulSpecs].sort((a, b) =>
    b.date.localeCompare(a.date)
  )
  return sorted[0]!.date
}

// ============================================================================
// Test Suites
// ============================================================================

describe('Snapshot Ordering Property Tests', () => {
  describe('LocalSnapshotStorage', () => {
    // Helper to create isolated storage for each test iteration
    async function createIsolatedStorage(): Promise<{
      storage: ISnapshotStorage
      cleanup: () => Promise<void>
    }> {
      const testId = `snapshot-ordering-pbt-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
      const testCacheDir = path.join(process.cwd(), 'test-cache', testId)
      await fs.mkdir(testCacheDir, { recursive: true })

      const storage = new LocalSnapshotStorage({ cacheDir: testCacheDir })

      const cleanup = async (): Promise<void> => {
        try {
          await fs.rm(testCacheDir, { recursive: true, force: true })
        } catch {
          // Ignore cleanup errors
        }
      }

      return { storage, cleanup }
    }

    // For simple tests that don't need per-iteration isolation
    let storage: ISnapshotStorage
    let testCacheDir: string
    let testId: string

    beforeEach(async () => {
      // Create unique test directory for isolation
      testId = `snapshot-ordering-pbt-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
      testCacheDir = path.join(process.cwd(), 'test-cache', testId)
      await fs.mkdir(testCacheDir, { recursive: true })

      // Create storage instance
      storage = new LocalSnapshotStorage({ cacheDir: testCacheDir })
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
     * Property 3: Latest Successful Snapshot Ordering
     *
     * For any set of snapshots with varying dates and statuses,
     * `getLatestSuccessful` SHALL return the snapshot with the most recent
     * date among those with status 'success', or null if no successful
     * snapshots exist.
     *
     * **Validates: Requirements 2.3, 2.4**
     */
    it(
      'Property 3: getLatestSuccessful returns most recent successful snapshot',
      async () => {
        await fc.assert(
          fc.asyncProperty(generateSnapshotSpecs(1, 10), async specs => {
            // Create isolated storage for this iteration
            const { storage: isolatedStorage, cleanup } =
              await createIsolatedStorage()

            try {
              // Write all snapshots
              for (const spec of specs) {
                const snapshotArb = generateMinimalSnapshot(
                  spec.date,
                  spec.status
                )
                const snapshot = fc.sample(snapshotArb, 1)[0]!
                await isolatedStorage.writeSnapshot(snapshot)
              }

              // Get the latest successful snapshot
              const latestSuccessful =
                await isolatedStorage.getLatestSuccessful()

              // Calculate expected result
              const expectedDate = findExpectedLatestSuccessful(specs)

              if (expectedDate === null) {
                // No successful snapshots - should return null
                expect(latestSuccessful).toBeNull()
              } else {
                // Should return the snapshot with the expected date
                expect(latestSuccessful).not.toBeNull()
                expect(latestSuccessful!.snapshot_id).toBe(expectedDate)
                expect(latestSuccessful!.status).toBe('success')
              }

              return true
            } finally {
              await cleanup()
            }
          }),
          { numRuns: PROPERTY_TEST_ITERATIONS }
        )
      },
      PROPERTY_TEST_TIMEOUT
    )

    /**
     * Property 3a: Edge case - no snapshots
     *
     * When no snapshots exist, getLatestSuccessful should return null.
     * Per Requirements 2.3, 2.4, 3.1, 3.2: The storage gracefully handles
     * missing directories and returns null instead of throwing an error.
     *
     * **Validates: Requirements 2.3, 2.4, 3.1, 3.2**
     */
    it('Property 3a: getLatestSuccessful returns null when no snapshots exist', async () => {
      // Per Requirement 2.3, 2.4, 3.1, 3.2: getLatestSuccessful returns null
      // when storage is empty instead of throwing an error
      const result = await storage.getLatestSuccessful()
      expect(result).toBeNull()
    })

    /**
     * Property 3b: Edge case - no successful snapshots
     *
     * When all snapshots have non-success status, getLatestSuccessful should return null.
     *
     * **Validates: Requirements 2.3, 2.4**
     */
    it(
      'Property 3b: getLatestSuccessful returns null when no successful snapshots exist',
      async () => {
        await fc.assert(
          fc.asyncProperty(
            generateUniqueDates(5).chain(dates =>
              fc.tuple(
                fc.constant(dates),
                fc.array(
                  fc.constantFrom(
                    'partial',
                    'failed'
                  ) as fc.Arbitrary<SnapshotStatus>,
                  {
                    minLength: dates.length,
                    maxLength: dates.length,
                  }
                )
              )
            ),
            async ([dates, statuses]) => {
              // Create isolated storage for this iteration
              const { storage: isolatedStorage, cleanup } =
                await createIsolatedStorage()

              try {
                // Write snapshots with only partial/failed statuses
                for (let i = 0; i < dates.length; i++) {
                  const snapshotArb = generateMinimalSnapshot(
                    dates[i]!,
                    statuses[i]!
                  )
                  const snapshot = fc.sample(snapshotArb, 1)[0]!
                  await isolatedStorage.writeSnapshot(snapshot)
                }

                // Should return null since no successful snapshots
                const latestSuccessful =
                  await isolatedStorage.getLatestSuccessful()
                expect(latestSuccessful).toBeNull()

                return true
              } finally {
                await cleanup()
              }
            }
          ),
          { numRuns: Math.floor(PROPERTY_TEST_ITERATIONS / 2) }
        )
      },
      PROPERTY_TEST_TIMEOUT
    )

    /**
     * Property 3c: Edge case - all successful snapshots
     *
     * When all snapshots are successful, getLatestSuccessful should return
     * the one with the most recent date.
     *
     * **Validates: Requirements 2.3, 2.4**
     */
    it(
      'Property 3c: getLatestSuccessful returns most recent when all are successful',
      async () => {
        await fc.assert(
          fc.asyncProperty(generateUniqueDates(5), async dates => {
            // Create isolated storage for this iteration
            const { storage: isolatedStorage, cleanup } =
              await createIsolatedStorage()

            try {
              // Write all snapshots as successful
              for (const date of dates) {
                const snapshotArb = generateMinimalSnapshot(date, 'success')
                const snapshot = fc.sample(snapshotArb, 1)[0]!
                await isolatedStorage.writeSnapshot(snapshot)
              }

              // Get the latest successful snapshot
              const latestSuccessful =
                await isolatedStorage.getLatestSuccessful()

              // Should return the most recent date
              const sortedDates = [...dates].sort((a, b) => b.localeCompare(a))
              const expectedDate = sortedDates[0]!

              expect(latestSuccessful).not.toBeNull()
              expect(latestSuccessful!.snapshot_id).toBe(expectedDate)
              expect(latestSuccessful!.status).toBe('success')

              return true
            } finally {
              await cleanup()
            }
          }),
          { numRuns: Math.floor(PROPERTY_TEST_ITERATIONS / 2) }
        )
      },
      PROPERTY_TEST_TIMEOUT
    )

    /**
     * Property 3d: Ordering is stable across multiple calls
     *
     * Multiple calls to getLatestSuccessful should return the same result
     * when no new snapshots are written.
     *
     * **Validates: Requirements 2.3, 2.4**
     */
    it(
      'Property 3d: getLatestSuccessful is stable across multiple calls',
      async () => {
        await fc.assert(
          fc.asyncProperty(generateSnapshotSpecs(3, 8), async specs => {
            // Create isolated storage for this iteration
            const { storage: isolatedStorage, cleanup } =
              await createIsolatedStorage()

            try {
              // Write all snapshots
              for (const spec of specs) {
                const snapshotArb = generateMinimalSnapshot(
                  spec.date,
                  spec.status
                )
                const snapshot = fc.sample(snapshotArb, 1)[0]!
                await isolatedStorage.writeSnapshot(snapshot)
              }

              // Call getLatestSuccessful multiple times
              const result1 = await isolatedStorage.getLatestSuccessful()
              const result2 = await isolatedStorage.getLatestSuccessful()
              const result3 = await isolatedStorage.getLatestSuccessful()

              // All results should be identical
              if (result1 === null) {
                expect(result2).toBeNull()
                expect(result3).toBeNull()
              } else {
                expect(result2).not.toBeNull()
                expect(result3).not.toBeNull()
                expect(result2!.snapshot_id).toBe(result1.snapshot_id)
                expect(result3!.snapshot_id).toBe(result1.snapshot_id)
              }

              return true
            } finally {
              await cleanup()
            }
          }),
          { numRuns: Math.floor(PROPERTY_TEST_ITERATIONS / 2) }
        )
      },
      PROPERTY_TEST_TIMEOUT
    )

    /**
     * Property 3e: Latest successful is always a successful snapshot
     *
     * If getLatestSuccessful returns a non-null value, it must have status 'success'.
     *
     * **Validates: Requirements 2.3, 2.4**
     */
    it(
      'Property 3e: getLatestSuccessful always returns a snapshot with success status',
      async () => {
        await fc.assert(
          fc.asyncProperty(generateSnapshotSpecs(1, 10), async specs => {
            // Create isolated storage for this iteration
            const { storage: isolatedStorage, cleanup } =
              await createIsolatedStorage()

            try {
              // Write all snapshots
              for (const spec of specs) {
                const snapshotArb = generateMinimalSnapshot(
                  spec.date,
                  spec.status
                )
                const snapshot = fc.sample(snapshotArb, 1)[0]!
                await isolatedStorage.writeSnapshot(snapshot)
              }

              // Get the latest successful snapshot
              const latestSuccessful =
                await isolatedStorage.getLatestSuccessful()

              // If not null, must have success status
              if (latestSuccessful !== null) {
                expect(latestSuccessful.status).toBe('success')
              }

              return true
            } finally {
              await cleanup()
            }
          }),
          { numRuns: PROPERTY_TEST_ITERATIONS }
        )
      },
      PROPERTY_TEST_TIMEOUT
    )

    /**
     * Property 3f: Latest successful date is >= all other successful dates
     *
     * The date of the returned snapshot must be greater than or equal to
     * all other successful snapshot dates.
     *
     * **Validates: Requirements 2.3, 2.4**
     */
    it(
      'Property 3f: getLatestSuccessful date is >= all other successful dates',
      async () => {
        await fc.assert(
          fc.asyncProperty(generateSnapshotSpecs(2, 10), async specs => {
            // Create isolated storage for this iteration
            const { storage: isolatedStorage, cleanup } =
              await createIsolatedStorage()

            try {
              // Write all snapshots
              for (const spec of specs) {
                const snapshotArb = generateMinimalSnapshot(
                  spec.date,
                  spec.status
                )
                const snapshot = fc.sample(snapshotArb, 1)[0]!
                await isolatedStorage.writeSnapshot(snapshot)
              }

              // Get the latest successful snapshot
              const latestSuccessful =
                await isolatedStorage.getLatestSuccessful()

              // Get all successful dates
              const successfulDates = specs
                .filter(s => s.status === 'success')
                .map(s => s.date)

              if (latestSuccessful !== null) {
                // The returned date must be >= all other successful dates
                for (const date of successfulDates) {
                  expect(latestSuccessful.snapshot_id >= date).toBe(true)
                }
              }

              return true
            } finally {
              await cleanup()
            }
          }),
          { numRuns: PROPERTY_TEST_ITERATIONS }
        )
      },
      PROPERTY_TEST_TIMEOUT
    )
  })
})
