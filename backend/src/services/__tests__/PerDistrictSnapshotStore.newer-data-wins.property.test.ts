/**
 * Property-Based Tests for PerDistrictSnapshotStore Snapshot Comparison Logic
 *
 * Feature: closing-period-api-integration
 * Property 3: Newer Data Wins
 *
 * Validates: Requirements 2.2, 2.3, 2.4
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'
import fs from 'fs/promises'
import path from 'path'
import { FileSnapshotStore } from '../SnapshotStore.js'
import type { Snapshot, NormalizedData } from '../../types/snapshots.js'

// Test configuration
// Optimized for CI/CD timeout compliance (30s limit)
const TEST_ITERATIONS = 25
const TEST_TIMEOUT = 30000

describe('PerDistrictSnapshotStore - Newer Data Wins Property Tests', () => {
  let testCacheDir: string
  let store: FileSnapshotStore

  beforeEach(async () => {
    // Create unique test cache directory for each test run
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substring(2, 8)
    testCacheDir = path.join(
      process.cwd(),
      'test-cache',
      `per-district-newer-data-wins-pbt-${timestamp}-${randomSuffix}`
    )

    await fs.mkdir(testCacheDir, { recursive: true })

    store = new FileSnapshotStore({
      cacheDir: testCacheDir,
      maxSnapshots: 50,
      maxAgeDays: 7,
    })
  })

  afterEach(async () => {
    // Clean up test cache directory
    try {
      await fs.rm(testCacheDir, { recursive: true, force: true })
    } catch (error) {
      console.warn(`Failed to clean up test cache directory: ${error}`)
    }
  })

  /**
   * Helper to create a minimal valid snapshot for testing
   */
  function createTestSnapshot(
    dataAsOfDate: string,
    collectionDate?: string,
    isClosingPeriodData?: boolean,
    logicalDate?: string
  ): Snapshot {
    const metadata: NormalizedData['metadata'] = {
      source: 'test',
      fetchedAt: new Date().toISOString(),
      dataAsOfDate,
      districtCount: 1,
      processingDurationMs: 100,
    }

    // Add closing period fields if provided
    if (collectionDate !== undefined) {
      metadata.collectionDate = collectionDate
    }
    if (isClosingPeriodData !== undefined) {
      metadata.isClosingPeriodData = isClosingPeriodData
    }
    if (logicalDate !== undefined) {
      metadata.logicalDate = logicalDate
    }

    return {
      snapshot_id: Date.now().toString(),
      created_at: new Date().toISOString(),
      schema_version: '1.0.0',
      calculation_version: '1.0.0',
      status: 'success',
      errors: [],
      payload: {
        districts: [
          {
            districtId: '42',
            asOfDate: dataAsOfDate,
            membership: {
              total: 100,
              change: 5,
              changePercent: 5.0,
              byClub: [],
            },
            clubs: {
              total: 10,
              active: 8,
              suspended: 1,
              ineligible: 1,
              low: 2,
              distinguished: 3,
            },
            education: {
              totalAwards: 50,
              byType: [],
              topClubs: [],
            },
          },
        ],
        metadata,
      },
    }
  }

  /**
   * Property 3: Newer Data Wins
   *
   * For any attempt to update a closing period snapshot:
   * - If no existing snapshot exists, should allow update (Requirement 2.2)
   * - If new data has strictly newer collection date, should allow update (Requirement 2.3)
   * - If collection dates are equal, should allow update (same-day refresh) (Requirement 2.3)
   * - If existing snapshot has newer collection date, should NOT allow update (Requirement 2.4)
   *
   * Validates: Requirements 2.2, 2.3, 2.4
   */
  it(
    'Property 3: Newer Data Wins - no existing snapshot allows update',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a year and month/day to construct valid dates
          fc.integer({ min: 2020, max: 2030 }),
          fc.integer({ min: 1, max: 12 }),
          fc.integer({ min: 1, max: 28 }), // Safe day for all months
          // Generate a separate collection date
          fc.integer({ min: 2020, max: 2030 }),
          fc.integer({ min: 1, max: 12 }),
          fc.integer({ min: 1, max: 28 }),
          async (
            snapshotYear: number,
            snapshotMonth: number,
            snapshotDay: number,
            collectionYear: number,
            collectionMonth: number,
            collectionDay: number
          ) => {
            const snapshotDateStr = `${snapshotYear}-${snapshotMonth.toString().padStart(2, '0')}-${snapshotDay.toString().padStart(2, '0')}`
            const collectionDateStr = `${collectionYear}-${collectionMonth.toString().padStart(2, '0')}-${collectionDay.toString().padStart(2, '0')}`

            // Test comparison when no existing snapshot exists
            const result = await store.shouldUpdateClosingPeriodSnapshot(
              snapshotDateStr,
              collectionDateStr
            )

            // Should allow update when no existing snapshot (Requirement 2.2)
            expect(result.shouldUpdate).toBe(true)
            expect(result.reason).toBe('no_existing')
            expect(result.newCollectionDate).toBe(collectionDateStr)
            expect(result.existingCollectionDate).toBeUndefined()

            return true
          }
        ),
        { numRuns: TEST_ITERATIONS }
      )
    },
    TEST_TIMEOUT
  )

  it(
    'Property 3: Newer Data Wins - newer collection date allows update',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a year and month/day to construct valid dates
          fc.integer({ min: 2021, max: 2029 }),
          fc.integer({ min: 1, max: 12 }),
          fc.integer({ min: 1, max: 28 }), // Safe day for all months
          // Generate days offset for existing collection date (1-365 days before new)
          fc.integer({ min: 1, max: 365 }),
          async (
            year: number,
            month: number,
            day: number,
            daysOffset: number
          ) => {
            // Construct a valid snapshot date
            const snapshotDateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`

            // Create existing snapshot with older collection date
            const snapshotDate = new Date(snapshotDateStr)
            const existingCollectionDate = new Date(snapshotDate)
            existingCollectionDate.setDate(
              existingCollectionDate.getDate() - daysOffset
            )
            const existingCollectionDateStr = existingCollectionDate
              .toISOString()
              .split('T')[0]!

            // New collection date is the snapshot date (newer)
            const newCollectionDateStr = snapshotDateStr

            // Create and write existing snapshot
            const existingSnapshot = createTestSnapshot(
              snapshotDateStr,
              existingCollectionDateStr,
              true,
              snapshotDateStr
            )
            await store.writeSnapshot(existingSnapshot)

            // Test comparison with newer collection date
            const result = await store.shouldUpdateClosingPeriodSnapshot(
              snapshotDateStr,
              newCollectionDateStr
            )

            // Should allow update when new data is newer (Requirement 2.3)
            expect(result.shouldUpdate).toBe(true)
            expect(result.reason).toBe('newer_data')
            expect(result.newCollectionDate).toBe(newCollectionDateStr)
            expect(result.existingCollectionDate).toBe(
              existingCollectionDateStr
            )

            return true
          }
        ),
        { numRuns: TEST_ITERATIONS }
      )
    },
    TEST_TIMEOUT
  )

  it(
    'Property 3: Newer Data Wins - same collection date allows update (same-day refresh)',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a year and month/day to construct valid dates
          fc.integer({ min: 2020, max: 2030 }),
          fc.integer({ min: 1, max: 12 }),
          fc.integer({ min: 1, max: 28 }), // Safe day for all months
          async (year: number, month: number, day: number) => {
            const snapshotDateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
            const collectionDateStr = snapshotDateStr // Same date

            // Create and write existing snapshot with same collection date
            const existingSnapshot = createTestSnapshot(
              snapshotDateStr,
              collectionDateStr,
              true,
              snapshotDateStr
            )
            await store.writeSnapshot(existingSnapshot)

            // Test comparison with same collection date
            const result = await store.shouldUpdateClosingPeriodSnapshot(
              snapshotDateStr,
              collectionDateStr
            )

            // Should allow update for same-day refresh (Requirement 2.3)
            expect(result.shouldUpdate).toBe(true)
            expect(result.reason).toBe('same_day_refresh')
            expect(result.newCollectionDate).toBe(collectionDateStr)
            expect(result.existingCollectionDate).toBe(collectionDateStr)

            return true
          }
        ),
        { numRuns: TEST_ITERATIONS }
      )
    },
    TEST_TIMEOUT
  )

  it(
    'Property 3: Newer Data Wins - older collection date does NOT allow update',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a year and month/day to construct valid dates
          fc.integer({ min: 2021, max: 2029 }),
          fc.integer({ min: 1, max: 12 }),
          fc.integer({ min: 1, max: 28 }), // Safe day for all months
          // Generate days offset for new collection date (1-365 days before existing)
          fc.integer({ min: 1, max: 365 }),
          async (
            year: number,
            month: number,
            day: number,
            daysOffset: number
          ) => {
            // Construct a valid snapshot date
            const snapshotDateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`

            // Existing collection date is the snapshot date (newer)
            const existingCollectionDateStr = snapshotDateStr

            // New collection date is older (subtract days)
            const snapshotDate = new Date(snapshotDateStr)
            const newCollectionDate = new Date(snapshotDate)
            newCollectionDate.setDate(newCollectionDate.getDate() - daysOffset)
            const newCollectionDateStr = newCollectionDate
              .toISOString()
              .split('T')[0]!

            // Create and write existing snapshot with newer collection date
            const existingSnapshot = createTestSnapshot(
              snapshotDateStr,
              existingCollectionDateStr,
              true,
              snapshotDateStr
            )
            await store.writeSnapshot(existingSnapshot)

            // Test comparison with older collection date
            const result = await store.shouldUpdateClosingPeriodSnapshot(
              snapshotDateStr,
              newCollectionDateStr
            )

            // Should NOT allow update when existing is newer (Requirement 2.4)
            expect(result.shouldUpdate).toBe(false)
            expect(result.reason).toBe('existing_is_newer')
            expect(result.newCollectionDate).toBe(newCollectionDateStr)
            expect(result.existingCollectionDate).toBe(
              existingCollectionDateStr
            )

            return true
          }
        ),
        { numRuns: TEST_ITERATIONS }
      )
    },
    TEST_TIMEOUT
  )

  /**
   * Property 3b: Fallback to dataAsOfDate when collectionDate is missing
   *
   * For existing snapshots without collectionDate field (legacy snapshots),
   * the comparison should fall back to using dataAsOfDate.
   *
   * Validates: Requirements 2.3, 2.4
   */
  it(
    'Property 3b: Fallback to dataAsOfDate when collectionDate is missing',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a year and month/day to construct valid dates
          fc.integer({ min: 2021, max: 2029 }),
          fc.integer({ min: 1, max: 12 }),
          fc.integer({ min: 1, max: 28 }), // Safe day for all months
          // Generate days offset for new collection date
          fc.integer({ min: -365, max: 365 }),
          async (
            year: number,
            month: number,
            day: number,
            daysOffset: number
          ) => {
            const snapshotDateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`

            // Create existing snapshot WITHOUT collectionDate (legacy format)
            const existingSnapshot = createTestSnapshot(
              snapshotDateStr,
              undefined, // No collectionDate
              false,
              undefined
            )
            await store.writeSnapshot(existingSnapshot)

            // New collection date with offset
            const snapshotDate = new Date(snapshotDateStr)
            const newCollectionDate = new Date(snapshotDate)
            newCollectionDate.setDate(newCollectionDate.getDate() + daysOffset)
            const newCollectionDateStr = newCollectionDate
              .toISOString()
              .split('T')[0]!

            // Test comparison
            const result = await store.shouldUpdateClosingPeriodSnapshot(
              snapshotDateStr,
              newCollectionDateStr
            )

            // Verify the comparison uses dataAsOfDate as fallback
            // The existingCollectionDate should be the dataAsOfDate (snapshotDateStr)
            expect(result.existingCollectionDate).toBe(snapshotDateStr)

            // Verify correct update decision based on date comparison
            if (daysOffset > 0) {
              // New date is newer
              expect(result.shouldUpdate).toBe(true)
              expect(result.reason).toBe('newer_data')
            } else if (daysOffset === 0) {
              // Same date
              expect(result.shouldUpdate).toBe(true)
              expect(result.reason).toBe('same_day_refresh')
            } else {
              // New date is older
              expect(result.shouldUpdate).toBe(false)
              expect(result.reason).toBe('existing_is_newer')
            }

            return true
          }
        ),
        { numRuns: TEST_ITERATIONS }
      )
    },
    TEST_TIMEOUT
  )
})
