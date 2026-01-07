/**
 * Version Consistency Integration Tests
 *
 * Tests that rankings metadata versions match snapshot metadata versions.
 * Validates version consistency across the system.
 *
 * Feature: all-districts-rankings-storage
 * Property 4: Version Consistency
 * Validates: Requirements 6.1, 6.2, 6.4
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'fs'
import path from 'path'
import { PerDistrictFileSnapshotStore } from '../PerDistrictSnapshotStore.js'
import {
  Snapshot,
  AllDistrictsRankingsData,
  CURRENT_SCHEMA_VERSION,
  CURRENT_CALCULATION_VERSION,
} from '../../types/snapshots.js'
import { DistrictStatistics } from '../../types/districts.js'

describe('Version Consistency Integration Tests', () => {
  let testCacheDir: string
  let store: PerDistrictFileSnapshotStore

  beforeEach(async () => {
    // Create unique test cache directory
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substring(2, 8)
    testCacheDir = path.join(
      process.cwd(),
      'test-cache',
      `version-consistency-${timestamp}-${randomSuffix}`
    )

    await fs.mkdir(testCacheDir, { recursive: true })

    store = new PerDistrictFileSnapshotStore({
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
   * Helper function to create a test snapshot
   */
  function createTestSnapshot(dataAsOfDate: string): Snapshot {
    const districts: DistrictStatistics[] = [
      {
        districtId: '42',
        asOfDate: dataAsOfDate,
        membership: {
          total: 12500,
          change: 500,
          changePercent: 4.17,
          byClub: [],
        },
        clubs: {
          total: 245,
          active: 243,
          suspended: 2,
          ineligible: 0,
          low: 5,
          distinguished: 180,
        },
        education: {
          totalAwards: 450,
          byType: [],
          topClubs: [],
        },
      },
    ]

    return {
      snapshot_id: 'temp-id',
      created_at: new Date(dataAsOfDate).toISOString(),
      schema_version: CURRENT_SCHEMA_VERSION,
      calculation_version: CURRENT_CALCULATION_VERSION,
      status: 'success',
      errors: [],
      payload: {
        districts,
        metadata: {
          source: 'test',
          fetchedAt: new Date(dataAsOfDate).toISOString(),
          dataAsOfDate,
          districtCount: districts.length,
          processingDurationMs: 1000,
        },
      },
    }
  }

  /**
   * Helper function to create test rankings data
   */
  function createTestRankingsData(
    snapshotId: string,
    schemaVersion: string = CURRENT_SCHEMA_VERSION,
    calculationVersion: string = CURRENT_CALCULATION_VERSION
  ): AllDistrictsRankingsData {
    return {
      metadata: {
        snapshotId,
        calculatedAt: new Date().toISOString(),
        schemaVersion,
        calculationVersion,
        rankingVersion: 'borda-count-v1',
        sourceCsvDate: snapshotId,
        csvFetchedAt: new Date().toISOString(),
        totalDistricts: 2,
        fromCache: false,
      },
      rankings: [
        {
          districtId: '42',
          districtName: 'District 42',
          region: 'Region 5',
          paidClubs: 245,
          paidClubBase: 240,
          clubGrowthPercent: 2.08,
          totalPayments: 12500,
          paymentBase: 12000,
          paymentGrowthPercent: 4.17,
          activeClubs: 243,
          distinguishedClubs: 180,
          selectDistinguished: 45,
          presidentsDistinguished: 12,
          distinguishedPercent: 74.07,
          clubsRank: 15,
          paymentsRank: 8,
          distinguishedRank: 3,
          aggregateScore: 342.5,
        },
        {
          districtId: '15',
          districtName: 'District 15',
          region: 'Region 2',
          paidClubs: 200,
          paidClubBase: 195,
          clubGrowthPercent: 2.56,
          totalPayments: 10000,
          paymentBase: 9500,
          paymentGrowthPercent: 5.26,
          activeClubs: 198,
          distinguishedClubs: 145,
          selectDistinguished: 35,
          presidentsDistinguished: 8,
          distinguishedPercent: 73.23,
          clubsRank: 25,
          paymentsRank: 18,
          distinguishedRank: 12,
          aggregateScore: 285.3,
        },
      ],
    }
  }

  describe('Property 4: Version Consistency', () => {
    it('Rankings metadata versions match snapshot metadata versions', async () => {
      // Arrange
      const dataAsOfDate = '2025-01-07T00:00:00.000Z'
      const snapshot = createTestSnapshot(dataAsOfDate)
      const expectedSnapshotId = '2025-01-07'
      const rankingsData = createTestRankingsData(
        expectedSnapshotId,
        CURRENT_SCHEMA_VERSION,
        CURRENT_CALCULATION_VERSION
      )

      // Act: Write snapshot with rankings
      await store.writeSnapshot(snapshot, rankingsData)

      // Read back snapshot metadata
      const savedSnapshot = await store.getSnapshot(expectedSnapshotId)
      expect(savedSnapshot).toBeDefined()

      // Read back rankings data
      const savedRankings =
        await store.readAllDistrictsRankings(expectedSnapshotId)
      expect(savedRankings).toBeDefined()

      // Assert: Versions match
      expect(savedRankings!.metadata.schemaVersion).toBe(
        savedSnapshot!.schema_version
      )
      expect(savedRankings!.metadata.calculationVersion).toBe(
        savedSnapshot!.calculation_version
      )

      // Validates: Requirements 6.1, 6.2, 6.4
    })

    it('Detects version mismatch when rankings have different schema version', async () => {
      // Arrange
      const dataAsOfDate = '2025-01-07T00:00:00.000Z'
      const snapshot = createTestSnapshot(dataAsOfDate)
      const expectedSnapshotId = '2025-01-07'

      // Create rankings with DIFFERENT schema version
      const rankingsData = createTestRankingsData(
        expectedSnapshotId,
        '0.9.0', // Different from snapshot's CURRENT_SCHEMA_VERSION (1.0.0)
        CURRENT_CALCULATION_VERSION
      )

      // Act: Write snapshot with rankings
      await store.writeSnapshot(snapshot, rankingsData)

      // Read back
      const savedSnapshot = await store.getSnapshot(expectedSnapshotId)
      const savedRankings =
        await store.readAllDistrictsRankings(expectedSnapshotId)

      // Assert: Versions are different (mismatch detected)
      expect(savedRankings!.metadata.schemaVersion).not.toBe(
        savedSnapshot!.schema_version
      )
      expect(savedRankings!.metadata.schemaVersion).toBe('0.9.0')
      expect(savedSnapshot!.schema_version).toBe(CURRENT_SCHEMA_VERSION)

      // This test demonstrates that version mismatches can be detected
      // In production, the system should log warnings when this occurs
      // Validates: Requirements 6.4
    })

    it('Detects version mismatch when rankings have different calculation version', async () => {
      // Arrange
      const dataAsOfDate = '2025-01-07T00:00:00.000Z'
      const snapshot = createTestSnapshot(dataAsOfDate)
      const expectedSnapshotId = '2025-01-07'

      // Create rankings with DIFFERENT calculation version
      const rankingsData = createTestRankingsData(
        expectedSnapshotId,
        CURRENT_SCHEMA_VERSION,
        '0.9.0' // Different from snapshot's CURRENT_CALCULATION_VERSION (1.0.0)
      )

      // Act: Write snapshot with rankings
      await store.writeSnapshot(snapshot, rankingsData)

      // Read back
      const savedSnapshot = await store.getSnapshot(expectedSnapshotId)
      const savedRankings =
        await store.readAllDistrictsRankings(expectedSnapshotId)

      // Assert: Versions are different (mismatch detected)
      expect(savedRankings!.metadata.calculationVersion).not.toBe(
        savedSnapshot!.calculation_version
      )
      expect(savedRankings!.metadata.calculationVersion).toBe('0.9.0')
      expect(savedSnapshot!.calculation_version).toBe(
        CURRENT_CALCULATION_VERSION
      )

      // This test demonstrates that version mismatches can be detected
      // In production, the system should log warnings when this occurs
      // Validates: Requirements 6.2, 6.4
    })

    it('Multiple snapshots maintain independent version consistency', async () => {
      // Arrange: Create two snapshots with different dates
      const date1 = '2025-01-07T00:00:00.000Z'
      const date2 = '2025-01-08T00:00:00.000Z'

      const snapshot1 = createTestSnapshot(date1)
      const snapshot2 = createTestSnapshot(date2)

      const snapshotId1 = '2025-01-07'
      const snapshotId2 = '2025-01-08'

      const rankings1 = createTestRankingsData(snapshotId1)
      const rankings2 = createTestRankingsData(snapshotId2)

      // Act: Write both snapshots
      await store.writeSnapshot(snapshot1, rankings1)
      await store.writeSnapshot(snapshot2, rankings2)

      // Read back both
      const saved1 = await store.getSnapshot(snapshotId1)
      const saved2 = await store.getSnapshot(snapshotId2)
      const savedRankings1 = await store.readAllDistrictsRankings(snapshotId1)
      const savedRankings2 = await store.readAllDistrictsRankings(snapshotId2)

      // Assert: Each snapshot has consistent versions
      expect(savedRankings1!.metadata.schemaVersion).toBe(
        saved1!.schema_version
      )
      expect(savedRankings1!.metadata.calculationVersion).toBe(
        saved1!.calculation_version
      )

      expect(savedRankings2!.metadata.schemaVersion).toBe(
        saved2!.schema_version
      )
      expect(savedRankings2!.metadata.calculationVersion).toBe(
        saved2!.calculation_version
      )

      // Validates: Requirements 6.1, 6.2
    })
  })
})
