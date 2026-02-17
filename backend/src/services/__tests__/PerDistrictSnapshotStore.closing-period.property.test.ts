/**
 * Property-Based Tests for PerDistrictSnapshotStore Closing Period Support
 *
 * Feature: closing-period-api-integration
 * Property 2: Snapshot Date Correctness
 *
 * Validates: Requirements 2.1, 2.5
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'
import fs from 'fs/promises'
import path from 'path'
import { FileSnapshotStore } from '../SnapshotStore.js'
import type { Snapshot, NormalizedData } from '../../types/snapshots.js'

// Test configuration
const TEST_ITERATIONS = 100
const TEST_TIMEOUT = 30000

describe('PerDistrictSnapshotStore - Closing Period Property Tests', () => {
  let testCacheDir: string
  let store: FileSnapshotStore

  beforeEach(async () => {
    // Create unique test cache directory for each test run
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substring(2, 8)
    testCacheDir = path.join(
      process.cwd(),
      'test-cache',
      `per-district-closing-period-pbt-${timestamp}-${randomSuffix}`
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
   * Helper to calculate the last day of a month
   */
  function getLastDayOfMonth(year: number, month: number): string {
    // month is 1-indexed (1 = January, 12 = December)
    const lastDay = new Date(year, month, 0).getDate()
    return `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`
  }

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
   * Property 2: Snapshot Date Correctness
   *
   * For any closing period data for month M, the snapshot directory should be
   * named with the last day of month M (e.g., "2024-12-31" for December data
   * collected in January).
   *
   * When overrideSnapshotDate is provided:
   * - The snapshot directory should use the override date
   * - The actual collection date should be preserved in metadata
   *
   * Validates: Requirements 2.1, 2.5
   */
  it(
    'Property 2: Snapshot Date Correctness - override date determines directory name',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a year between 2020 and 2030
          fc.integer({ min: 2020, max: 2030 }),
          // Generate a month (1-12)
          fc.integer({ min: 1, max: 12 }),
          // Generate a day in the next month (1-28 to be safe)
          fc.integer({ min: 1, max: 28 }),
          async (year: number, dataMonth: number, collectionDay: number) => {
            // Calculate the collection date (in the month AFTER the data month)
            const collectionMonth = dataMonth === 12 ? 1 : dataMonth + 1
            const collectionYear = dataMonth === 12 ? year + 1 : year
            const collectionDate = `${collectionYear}-${collectionMonth.toString().padStart(2, '0')}-${collectionDay.toString().padStart(2, '0')}`

            // Calculate the expected snapshot date (last day of data month)
            const expectedSnapshotDate = getLastDayOfMonth(year, dataMonth)

            // Create a snapshot with the collection date as dataAsOfDate
            // but with closing period metadata indicating the override date
            const snapshot = createTestSnapshot(
              expectedSnapshotDate, // dataAsOfDate is the override date (last day of data month)
              collectionDate, // collectionDate is when CSV was actually collected
              true, // isClosingPeriodData
              expectedSnapshotDate // logicalDate matches the snapshot date
            )

            // Write the snapshot
            await store.writeSnapshot(snapshot)

            // Verify the snapshot directory was created with the expected date
            const snapshotDir = path.join(
              testCacheDir,
              'snapshots',
              expectedSnapshotDate
            )
            const dirExists = await fs
              .access(snapshotDir)
              .then(() => true)
              .catch(() => false)

            expect(dirExists).toBe(true)

            // Verify metadata.json exists and contains correct information
            const metadataPath = path.join(snapshotDir, 'metadata.json')
            const metadataContent = await fs.readFile(metadataPath, 'utf-8')
            const metadata = JSON.parse(metadataContent)

            // The snapshot ID should be the override date
            expect(metadata.snapshotId).toBe(expectedSnapshotDate)
            // The dataAsOfDate should be the override date
            expect(metadata.dataAsOfDate).toBe(expectedSnapshotDate)

            // Read back the snapshot and verify
            const readSnapshot = await store.getSnapshot(expectedSnapshotDate)
            expect(readSnapshot).not.toBeNull()
            expect(readSnapshot!.snapshot_id).toBe(expectedSnapshotDate)

            // Verify closing period metadata is preserved
            expect(readSnapshot!.payload.metadata.collectionDate).toBe(
              collectionDate
            )
            expect(readSnapshot!.payload.metadata.isClosingPeriodData).toBe(
              true
            )
            expect(readSnapshot!.payload.metadata.logicalDate).toBe(
              expectedSnapshotDate
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
   * Property 2b: Cross-Year Closing Period Handling
   *
   * For December data collected in January, the snapshot should be dated
   * December 31 of the prior year.
   *
   * Validates: Requirements 2.5
   */
  it(
    'Property 2b: Cross-Year Closing Period - December data collected in January',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a year between 2021 and 2030 (need prior year for December)
          fc.integer({ min: 2021, max: 2030 }),
          // Generate a day in January (1-31)
          fc.integer({ min: 1, max: 31 }),
          async (januaryYear: number, januaryDay: number) => {
            // Collection date is in January of the given year
            const collectionDate = `${januaryYear}-01-${januaryDay.toString().padStart(2, '0')}`

            // Data is for December of the PREVIOUS year
            const dataYear = januaryYear - 1
            const expectedSnapshotDate = `${dataYear}-12-31`

            // Create a snapshot representing closing period data
            const snapshot = createTestSnapshot(
              expectedSnapshotDate, // dataAsOfDate is Dec 31 of prior year
              collectionDate, // collectionDate is in January
              true, // isClosingPeriodData
              expectedSnapshotDate // logicalDate
            )

            // Write the snapshot
            await store.writeSnapshot(snapshot)

            // Verify the snapshot directory was created with December 31 of prior year
            const snapshotDir = path.join(
              testCacheDir,
              'snapshots',
              expectedSnapshotDate
            )
            const dirExists = await fs
              .access(snapshotDir)
              .then(() => true)
              .catch(() => false)

            expect(dirExists).toBe(true)

            // Verify the snapshot can be read back correctly
            const readSnapshot = await store.getSnapshot(expectedSnapshotDate)
            expect(readSnapshot).not.toBeNull()
            expect(readSnapshot!.snapshot_id).toBe(expectedSnapshotDate)

            // Verify the collection date is preserved (January date)
            expect(readSnapshot!.payload.metadata.collectionDate).toBe(
              collectionDate
            )

            // Verify the snapshot date is December 31 of prior year
            expect(readSnapshot!.payload.metadata.dataAsOfDate).toBe(
              expectedSnapshotDate
            )

            return true
          }
        ),
        { numRuns: 25 }
      )
    },
    TEST_TIMEOUT
  )

  /**
   * Property 2c: Non-Closing Period Snapshots Unchanged
   *
   * For non-closing period data, the snapshot directory should use the
   * dataAsOfDate directly without any override.
   *
   * Validates: Requirements 2.1
   */
  it(
    'Property 2c: Non-Closing Period - directory uses dataAsOfDate directly',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate year, month, day separately to avoid Invalid Date issues
          fc.integer({ min: 2020, max: 2030 }),
          fc.integer({ min: 1, max: 12 }),
          fc.integer({ min: 1, max: 28 }), // Use 28 to be safe for all months
          async (year: number, month: number, day: number) => {
            const dataAsOfDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`

            // Create a non-closing period snapshot
            const snapshot = createTestSnapshot(
              dataAsOfDate,
              dataAsOfDate, // collectionDate equals dataAsOfDate
              false, // NOT closing period data
              dataAsOfDate // logicalDate equals dataAsOfDate
            )

            // Write the snapshot
            await store.writeSnapshot(snapshot)

            // Verify the snapshot directory was created with the dataAsOfDate
            const snapshotDir = path.join(
              testCacheDir,
              'snapshots',
              dataAsOfDate
            )
            const dirExists = await fs
              .access(snapshotDir)
              .then(() => true)
              .catch(() => false)

            expect(dirExists).toBe(true)

            // Verify the snapshot can be read back correctly
            const readSnapshot = await store.getSnapshot(dataAsOfDate)
            expect(readSnapshot).not.toBeNull()
            expect(readSnapshot!.snapshot_id).toBe(dataAsOfDate)
            expect(readSnapshot!.payload.metadata.dataAsOfDate).toBe(
              dataAsOfDate
            )
            expect(readSnapshot!.payload.metadata.isClosingPeriodData).toBe(
              false
            )

            return true
          }
        ),
        { numRuns: TEST_ITERATIONS }
      )
    },
    TEST_TIMEOUT
  )
})
