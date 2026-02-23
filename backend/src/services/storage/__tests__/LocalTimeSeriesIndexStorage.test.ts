/**
 * Unit tests for LocalTimeSeriesIndexStorage
 *
 * These tests verify that LocalTimeSeriesIndexStorage correctly handles
 * time-series index operations, particularly the deleteSnapshotEntries method.
 *
 * **Validates: Requirements 4.2**
 *
 * Requirements:
 * - 4.2: THE ITimeSeriesIndexStorage interface SHALL include a `deleteSnapshotEntries(snapshotId: string): Promise<number>` method that removes all data points for a given snapshot
 *
 * Test Isolation:
 * - Each test uses unique, isolated directories with timestamps and random suffixes
 * - Tests clean up resources in afterEach hooks
 * - Tests do not depend on execution order
 * - All tests pass when run with `--run` (parallel mode)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import { LocalTimeSeriesIndexStorage } from '../LocalTimeSeriesIndexStorage.js'
import type { ITimeSeriesIndexStorage } from '../../../types/storageInterfaces.js'
import type {
  TimeSeriesDataPoint,
  ProgramYearIndexFile,
} from '../../../types/precomputedAnalytics.js'

describe('LocalTimeSeriesIndexStorage', () => {
  let storage: ITimeSeriesIndexStorage
  let testCacheDir: string
  let testId: string

  /**
   * Create a unique temporary directory for each test.
   * Using timestamp + random suffix ensures isolation for parallel test execution.
   */
  beforeEach(async () => {
    testId = `local-timeseries-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
    testCacheDir = path.join(process.cwd(), 'test-cache', testId)
    await fs.mkdir(testCacheDir, { recursive: true })

    storage = new LocalTimeSeriesIndexStorage({ cacheDir: testCacheDir })
  })

  /**
   * Clean up temporary directory after each test.
   */
  afterEach(async () => {
    try {
      await fs.rm(testCacheDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors - directory may not exist in some test cases
    }
  })

  /**
   * Helper function to create a test time-series data point.
   */
  const createTestDataPoint = (
    date: string,
    snapshotId: string,
    membership: number = 100
  ): TimeSeriesDataPoint => ({
    date,
    snapshotId,
    membership,
    payments: membership * 10,
    dcpGoals: 5,
    distinguishedTotal: 3,
    clubCounts: {
      total: 10,
      thriving: 5,
      vulnerable: 3,
      interventionRequired: 2,
    },
  })

  /**
   * Helper function to create a program year index file directly on disk.
   * This bypasses the storage interface to set up test data.
   */
  const createProgramYearIndexFile = async (
    districtId: string,
    programYear: string,
    dataPoints: TimeSeriesDataPoint[]
  ): Promise<void> => {
    const districtDir = path.join(
      testCacheDir,
      'time-series',
      `district_${districtId}`
    )
    await fs.mkdir(districtDir, { recursive: true })

    const memberships = dataPoints.map(dp => dp.membership)
    const firstDataPoint = dataPoints[0]
    const lastDataPoint = dataPoints[dataPoints.length - 1]

    const indexFile: ProgramYearIndexFile = {
      districtId,
      programYear,
      startDate: `${programYear.split('-')[0]}-07-01`,
      endDate: `${programYear.split('-')[1]}-06-30`,
      lastUpdated: new Date().toISOString(),
      dataPoints,
      summary: {
        totalDataPoints: dataPoints.length,
        membershipStart: firstDataPoint?.membership ?? 0,
        membershipEnd: lastDataPoint?.membership ?? 0,
        membershipPeak: dataPoints.length > 0 ? Math.max(...memberships) : 0,
        membershipLow: dataPoints.length > 0 ? Math.min(...memberships) : 0,
      },
    }

    const filePath = path.join(districtDir, `${programYear}.json`)
    await fs.writeFile(filePath, JSON.stringify(indexFile, null, 2), 'utf-8')
  }

  /**
   * Helper function to read a program year index file directly from disk.
   */
  const readProgramYearIndexFile = async (
    districtId: string,
    programYear: string
  ): Promise<ProgramYearIndexFile | null> => {
    const filePath = path.join(
      testCacheDir,
      'time-series',
      `district_${districtId}`,
      `${programYear}.json`
    )

    try {
      const content = await fs.readFile(filePath, 'utf-8')
      return JSON.parse(content) as ProgramYearIndexFile
    } catch {
      return null
    }
  }

  describe('deleteSnapshotEntries', () => {
    /**
     * Test: deleteSnapshotEntries removes entries matching the snapshot ID
     *
     * **Validates: Requirements 4.2**
     *
     * This test verifies that when deleteSnapshotEntries is called,
     * only entries with the matching snapshotId are removed from the
     * time-series index files.
     */
    it('should remove entries matching the snapshot ID', async () => {
      // Arrange: Create time-series data with multiple snapshots
      const dataPoints = [
        createTestDataPoint('2024-01-15', '2024-01-15', 100),
        createTestDataPoint('2024-01-16', '2024-01-16', 105),
        createTestDataPoint('2024-01-17', '2024-01-17', 110),
      ]
      await createProgramYearIndexFile('42', '2023-2024', dataPoints)

      // Act: Delete entries for one snapshot
      await storage.deleteSnapshotEntries('2024-01-16')

      // Assert: Only the matching entry should be removed
      const indexFile = await readProgramYearIndexFile('42', '2023-2024')
      expect(indexFile).not.toBeNull()
      expect(indexFile!.dataPoints).toHaveLength(2)
      expect(indexFile!.dataPoints.map(dp => dp.snapshotId)).toContain(
        '2024-01-15'
      )
      expect(indexFile!.dataPoints.map(dp => dp.snapshotId)).toContain(
        '2024-01-17'
      )
      expect(indexFile!.dataPoints.map(dp => dp.snapshotId)).not.toContain(
        '2024-01-16'
      )
    })

    /**
     * Test: deleteSnapshotEntries returns the count of removed entries
     *
     * **Validates: Requirements 4.2**
     *
     * This test verifies that the method returns the correct count
     * of entries that were removed across all districts and program years.
     */
    it('should return the count of removed entries', async () => {
      // Arrange: Create time-series data with multiple entries for the same snapshot
      // across multiple districts
      const dataPointsDistrict42 = [
        createTestDataPoint('2024-01-15', '2024-01-15', 100),
        createTestDataPoint('2024-01-16', '2024-01-16', 105),
      ]
      const dataPointsDistrict61 = [
        createTestDataPoint('2024-01-15', '2024-01-15', 200),
        createTestDataPoint('2024-01-16', '2024-01-16', 210),
      ]

      await createProgramYearIndexFile('42', '2023-2024', dataPointsDistrict42)
      await createProgramYearIndexFile('61', '2023-2024', dataPointsDistrict61)

      // Act: Delete entries for snapshot '2024-01-16'
      const removedCount = await storage.deleteSnapshotEntries('2024-01-16')

      // Assert: Should return 2 (one from each district)
      expect(removedCount).toBe(2)
    })

    /**
     * Test: deleteSnapshotEntries returns 0 when no entries match the snapshot ID
     *
     * **Validates: Requirements 4.2**
     *
     * This test verifies that when no entries match the given snapshot ID,
     * the method returns 0 without throwing an error.
     */
    it('should return 0 when no entries match the snapshot ID', async () => {
      // Arrange: Create time-series data with different snapshot IDs
      const dataPoints = [
        createTestDataPoint('2024-01-15', '2024-01-15', 100),
        createTestDataPoint('2024-01-16', '2024-01-16', 105),
      ]
      await createProgramYearIndexFile('42', '2023-2024', dataPoints)

      // Act: Delete entries for a non-existent snapshot
      const removedCount = await storage.deleteSnapshotEntries('2024-12-31')

      // Assert: Should return 0
      expect(removedCount).toBe(0)

      // Verify original data is unchanged
      const indexFile = await readProgramYearIndexFile('42', '2023-2024')
      expect(indexFile).not.toBeNull()
      expect(indexFile!.dataPoints).toHaveLength(2)
    })

    /**
     * Test: deleteSnapshotEntries returns 0 when time-series directory does not exist
     *
     * **Validates: Requirements 4.2**
     *
     * This test verifies that when the time-series directory doesn't exist,
     * the method returns 0 without throwing an error.
     */
    it('should return 0 when time-series directory does not exist', async () => {
      // Arrange: Don't create any time-series data
      // The testCacheDir exists but time-series subdirectory does not

      // Act: Delete entries
      const removedCount = await storage.deleteSnapshotEntries('2024-01-15')

      // Assert: Should return 0 without error
      expect(removedCount).toBe(0)
    })

    /**
     * Test: deleteSnapshotEntries handles entries spanning multiple program years
     *
     * **Validates: Requirements 4.2**
     *
     * This test verifies that entries are correctly removed from multiple
     * program year files when the same snapshot ID appears in different years.
     */
    it('should remove entries from multiple program years', async () => {
      // Arrange: Create data spanning two program years with the same snapshot ID
      // Note: This is an edge case where a snapshot might be referenced in multiple years
      const dataPoints2023 = [
        createTestDataPoint('2024-06-15', '2024-06-15', 100),
        createTestDataPoint('2024-06-20', 'shared-snapshot', 105),
      ]
      const dataPoints2024 = [
        createTestDataPoint('2024-07-15', '2024-07-15', 200),
        createTestDataPoint('2024-07-20', 'shared-snapshot', 210),
      ]

      await createProgramYearIndexFile('42', '2023-2024', dataPoints2023)
      await createProgramYearIndexFile('42', '2024-2025', dataPoints2024)

      // Act: Delete entries for the shared snapshot
      const removedCount =
        await storage.deleteSnapshotEntries('shared-snapshot')

      // Assert: Should remove entries from both program years
      expect(removedCount).toBe(2)

      // Verify both files are updated
      const indexFile2023 = await readProgramYearIndexFile('42', '2023-2024')
      const indexFile2024 = await readProgramYearIndexFile('42', '2024-2025')

      expect(indexFile2023!.dataPoints).toHaveLength(1)
      expect(indexFile2023!.dataPoints[0]!.snapshotId).toBe('2024-06-15')

      expect(indexFile2024!.dataPoints).toHaveLength(1)
      expect(indexFile2024!.dataPoints[0]!.snapshotId).toBe('2024-07-15')
    })

    /**
     * Test: deleteSnapshotEntries does NOT update summary statistics after removal
     *
     * **Validates: Requirements 16.1, 16.4**
     *
     * This test verifies that after removing entries, the summary statistics
     * in the program year index file are NOT recalculated (per data-computation-separation).
     * The summary will be stale until collector-cli regenerates the index file.
     */
    it('should NOT update summary statistics after removal (summary remains stale)', async () => {
      // Arrange: Create data with known membership values
      const dataPoints = [
        createTestDataPoint('2024-01-15', '2024-01-15', 100),
        createTestDataPoint('2024-01-16', '2024-01-16', 150), // Peak value
        createTestDataPoint('2024-01-17', '2024-01-17', 120),
      ]
      await createProgramYearIndexFile('42', '2023-2024', dataPoints)

      // Act: Delete the entry with peak membership
      await storage.deleteSnapshotEntries('2024-01-16')

      // Assert: Summary should NOT be recalculated (remains stale)
      const indexFile = await readProgramYearIndexFile('42', '2023-2024')
      expect(indexFile).not.toBeNull()
      // Data points should be filtered
      expect(indexFile!.dataPoints).toHaveLength(2)
      // Summary should still reflect the original values (stale)
      // The original summary had peak of 150, which is now stale
      expect(indexFile!.summary.totalDataPoints).toBe(3) // Stale - was 3, now 2 data points
      expect(indexFile!.summary.membershipPeak).toBe(150) // Stale - peak was 150, now should be 120
    })

    /**
     * Test: deleteSnapshotEntries handles multiple districts correctly
     *
     * **Validates: Requirements 4.2**
     *
     * This test verifies that entries are removed from all districts
     * that contain the matching snapshot ID.
     */
    it('should remove entries from multiple districts', async () => {
      // Arrange: Create data for multiple districts with the same snapshot
      const targetSnapshotId = '2024-01-20'

      await createProgramYearIndexFile('42', '2023-2024', [
        createTestDataPoint('2024-01-15', '2024-01-15', 100),
        createTestDataPoint('2024-01-20', targetSnapshotId, 110),
      ])

      await createProgramYearIndexFile('61', '2023-2024', [
        createTestDataPoint('2024-01-18', '2024-01-18', 200),
        createTestDataPoint('2024-01-20', targetSnapshotId, 220),
      ])

      await createProgramYearIndexFile('F', '2023-2024', [
        createTestDataPoint('2024-01-20', targetSnapshotId, 50),
      ])

      // Act: Delete entries for the target snapshot
      const removedCount = await storage.deleteSnapshotEntries(targetSnapshotId)

      // Assert: Should remove 3 entries (one from each district)
      expect(removedCount).toBe(3)

      // Verify each district's data
      const indexFile42 = await readProgramYearIndexFile('42', '2023-2024')
      expect(indexFile42!.dataPoints).toHaveLength(1)
      expect(indexFile42!.dataPoints[0]!.snapshotId).toBe('2024-01-15')

      const indexFile61 = await readProgramYearIndexFile('61', '2023-2024')
      expect(indexFile61!.dataPoints).toHaveLength(1)
      expect(indexFile61!.dataPoints[0]!.snapshotId).toBe('2024-01-18')

      const indexFileF = await readProgramYearIndexFile('F', '2023-2024')
      expect(indexFileF!.dataPoints).toHaveLength(0)
    })

    /**
     * Test: deleteSnapshotEntries does not throw when district directory is empty
     *
     * **Validates: Requirements 4.2**
     *
     * This test verifies that the method handles empty district directories
     * gracefully without throwing errors.
     */
    it('should handle empty district directories gracefully', async () => {
      // Arrange: Create an empty district directory
      const districtDir = path.join(testCacheDir, 'time-series', 'district_42')
      await fs.mkdir(districtDir, { recursive: true })

      // Act & Assert: Should not throw
      const removedCount = await storage.deleteSnapshotEntries('2024-01-15')
      expect(removedCount).toBe(0)
    })
  })

  describe('isReady', () => {
    /**
     * Test: isReady returns true when cache directory exists
     *
     * This test verifies that isReady returns true when the storage
     * is properly initialized with an accessible cache directory.
     */
    it('should return true when cache directory exists', async () => {
      // Act
      const ready = await storage.isReady()

      // Assert
      expect(ready).toBe(true)
    })

    /**
     * Test: isReady returns true when time-series directory exists
     *
     * This test verifies that isReady returns true when the time-series
     * directory has been created.
     */
    it('should return true when time-series directory exists', async () => {
      // Arrange: Create the time-series directory
      const timeSeriesDir = path.join(testCacheDir, 'time-series')
      await fs.mkdir(timeSeriesDir, { recursive: true })

      // Act
      const ready = await storage.isReady()

      // Assert
      expect(ready).toBe(true)
    })
  })
})
