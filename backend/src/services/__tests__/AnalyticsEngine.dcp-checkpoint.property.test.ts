/**
 * Property-Based Tests for AnalyticsEngine DCP Checkpoint
 *
 * Feature: club-health-classification
 * Property 3: DCP Checkpoint Monotonicity
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5
 *
 * The DCP checkpoint thresholds follow the Toastmasters program year:
 * - July (7): 0 (administrative checkpoint)
 * - August-September (8-9): 1 goal
 * - October-November (10-11): 2 goals
 * - December-January (12, 1): 3 goals
 * - February-March (2-3): 4 goals
 * - April-June (4-6): 5 goals
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import { AnalyticsEngine } from '../AnalyticsEngine.js'
import { AnalyticsDataSourceAdapter } from '../AnalyticsDataSourceAdapter.js'
import { PerDistrictFileSnapshotStore } from '../PerDistrictSnapshotStore.js'
import { createDistrictDataAggregator } from '../DistrictDataAggregator.js'
import fs from 'fs/promises'
import path from 'path'

describe('AnalyticsEngine DCP Checkpoint - Property-Based Tests', () => {
  let testCacheDir: string
  let analyticsEngine: AnalyticsEngine

  beforeEach(async () => {
    // Create a unique test cache directory
    testCacheDir = path.join(
      process.cwd(),
      'test-cache',
      `analytics-dcp-checkpoint-pbt-${Date.now()}-${Math.random().toString(36).substring(7)}`
    )
    await fs.mkdir(testCacheDir, { recursive: true })

    // Create the snapshots subdirectory
    const snapshotsDir = path.join(testCacheDir, 'snapshots')
    await fs.mkdir(snapshotsDir, { recursive: true })

    // Create minimal dependencies for AnalyticsEngine
    const snapshotStore = new PerDistrictFileSnapshotStore({
      cacheDir: testCacheDir,
      maxSnapshots: 100,
      maxAgeDays: 365,
    })
    const districtDataAggregator = createDistrictDataAggregator(snapshotStore)
    const dataSource = new AnalyticsDataSourceAdapter(
      districtDataAggregator,
      snapshotStore
    )
    analyticsEngine = new AnalyticsEngine(dataSource)
  })

  afterEach(async () => {
    // Clean up
    if (analyticsEngine) {
      analyticsEngine.clearCaches()
      await analyticsEngine.dispose()
    }

    // Clean up test cache directory
    try {
      await fs.rm(testCacheDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  /**
   * Property 3: DCP Checkpoint Monotonicity
   *
   * For any sequence of months from August to June (following the program year order),
   * the DCP checkpoint requirement SHALL be monotonically non-decreasing (1 → 2 → 3 → 4 → 5).
   *
   * The program year order is: July(7) → Aug(8) → Sep(9) → Oct(10) → Nov(11) → Dec(12) → Jan(1) → Feb(2) → Mar(3) → Apr(4) → May(5) → Jun(6)
   *
   * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**
   */
  it('Property 3: DCP checkpoint requirements should be monotonically non-decreasing through the program year', async () => {
    // Define the program year month order (July through June)
    const programYearMonthOrder = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6]

    await fc.assert(
      fc.asyncProperty(
        // Generate a starting index in the program year (0-11)
        fc.integer({ min: 0, max: 11 }),
        // Generate a sequence length (at least 2 months to test monotonicity)
        fc.integer({ min: 2, max: 12 }),
        async (startIndex: number, sequenceLength: number) => {
          // Get a sequence of consecutive months in program year order
          const monthSequence: number[] = []
          for (let i = 0; i < sequenceLength; i++) {
            const monthIndex = (startIndex + i) % 12
            monthSequence.push(programYearMonthOrder[monthIndex])
          }

          // Get DCP checkpoints for each month in the sequence
          const checkpoints = monthSequence.map(month =>
            analyticsEngine.getDCPCheckpoint(month)
          )

          // Verify monotonicity: each checkpoint should be >= the previous one
          // Exception: July (month 7) resets to 0 at the start of a new program year
          for (let i = 1; i < checkpoints.length; i++) {
            const currentMonth = monthSequence[i]
            const previousMonth = monthSequence[i - 1]

            // If we've crossed into a new program year (previous was June, current is July),
            // the checkpoint resets to 0, which is expected
            if (previousMonth === 6 && currentMonth === 7) {
              // July starts a new program year with checkpoint 0
              expect(checkpoints[i]).toBe(0)
            } else {
              // Otherwise, checkpoints should be monotonically non-decreasing
              expect(checkpoints[i]).toBeGreaterThanOrEqual(checkpoints[i - 1])
            }
          }

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Additional property: DCP checkpoint values should be within expected bounds
   *
   * For any valid month, the DCP checkpoint should be between 0 and 5.
   *
   * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**
   */
  it('Property 3a: DCP checkpoint values should be within expected bounds (0-5)', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate any valid month (1-12)
        fc.integer({ min: 1, max: 12 }),
        async (month: number) => {
          const checkpoint = analyticsEngine.getDCPCheckpoint(month)

          // Checkpoint should be between 0 and 5
          expect(checkpoint).toBeGreaterThanOrEqual(0)
          expect(checkpoint).toBeLessThanOrEqual(5)

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Additional property: DCP checkpoint should match expected values for each month
   *
   * Verifies the specific checkpoint values defined in the requirements.
   *
   * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**
   */
  it('Property 3b: DCP checkpoint should return correct values for each month period', async () => {
    // Define expected checkpoints per month based on requirements
    const expectedCheckpoints: Record<number, number> = {
      7: 0, // July: Administrative checkpoint
      8: 1, // August: 1 goal
      9: 1, // September: 1 goal
      10: 2, // October: 2 goals
      11: 2, // November: 2 goals
      12: 3, // December: 3 goals
      1: 3, // January: 3 goals
      2: 4, // February: 4 goals
      3: 4, // March: 4 goals
      4: 5, // April: 5 goals
      5: 5, // May: 5 goals
      6: 5, // June: 5 goals
    }

    await fc.assert(
      fc.asyncProperty(
        // Generate any valid month (1-12)
        fc.integer({ min: 1, max: 12 }),
        async (month: number) => {
          const checkpoint = analyticsEngine.getDCPCheckpoint(month)
          const expected = expectedCheckpoints[month]

          expect(checkpoint).toBe(expected)

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Additional property: Invalid months should throw an error
   *
   * Verifies that the method properly validates input.
   */
  it('Property 3c: Invalid months should throw an error', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate invalid months (outside 1-12 range)
        fc.oneof(
          fc.integer({ min: -100, max: 0 }),
          fc.integer({ min: 13, max: 100 })
        ),
        async (invalidMonth: number) => {
          expect(() => analyticsEngine.getDCPCheckpoint(invalidMonth)).toThrow(
            /Invalid month/
          )

          return true
        }
      ),
      { numRuns: 50 }
    )
  })
})
