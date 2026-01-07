/**
 * Integration tests for PerDistrictSnapshotStore snapshot creation with rankings
 *
 * Tests the complete snapshot creation flow including all-districts rankings data.
 * Validates that rankings are properly integrated into the snapshot write process.
 *
 * Feature: all-districts-rankings-storage
 * Property 1: All Districts Rankings Completeness
 * Validates: Requirements 1.3, 1.4, 5.3
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import { PerDistrictFileSnapshotStore } from '../PerDistrictSnapshotStore.js'
import {
  Snapshot,
  AllDistrictsRankingsData,
  CURRENT_SCHEMA_VERSION,
  CURRENT_CALCULATION_VERSION,
} from '../../types/snapshots.js'
import { DistrictStatistics } from '../../types/districts.js'

describe('PerDistrictSnapshotStore Snapshot with Rankings Integration', () => {
  let testCacheDir: string
  let store: PerDistrictFileSnapshotStore

  beforeEach(async () => {
    // Create unique test cache directory for each test run
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substring(2, 8)
    testCacheDir = path.join(
      process.cwd(),
      'test-cache',
      `rankings-integration-${timestamp}-${randomSuffix}`
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
      {
        districtId: '15',
        asOfDate: dataAsOfDate,
        membership: {
          total: 9500,
          change: 500,
          changePercent: 5.56,
          byClub: [],
        },
        clubs: {
          total: 180,
          active: 178,
          suspended: 2,
          ineligible: 0,
          low: 8,
          distinguished: 120,
        },
        education: {
          totalAwards: 320,
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
    snapshotId: string
  ): AllDistrictsRankingsData {
    return {
      metadata: {
        snapshotId,
        calculatedAt: new Date().toISOString(),
        schemaVersion: CURRENT_SCHEMA_VERSION,
        calculationVersion: CURRENT_CALCULATION_VERSION,
        rankingVersion: 'borda-count-v1',
        sourceCsvDate: snapshotId,
        csvFetchedAt: new Date().toISOString(),
        totalDistricts: 3,
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
          paidClubs: 180,
          paidClubBase: 175,
          clubGrowthPercent: 2.86,
          totalPayments: 9500,
          paymentBase: 9000,
          paymentGrowthPercent: 5.56,
          activeClubs: 178,
          distinguishedClubs: 120,
          selectDistinguished: 30,
          presidentsDistinguished: 8,
          distinguishedPercent: 67.42,
          clubsRank: 25,
          paymentsRank: 18,
          distinguishedRank: 12,
          aggregateScore: 285.3,
        },
        {
          districtId: 'F',
          districtName: 'District F',
          region: 'Region 1',
          paidClubs: 320,
          paidClubBase: 310,
          clubGrowthPercent: 3.23,
          totalPayments: 16000,
          paymentBase: 15000,
          paymentGrowthPercent: 6.67,
          activeClubs: 315,
          distinguishedClubs: 240,
          selectDistinguished: 60,
          presidentsDistinguished: 15,
          distinguishedPercent: 76.19,
          clubsRank: 8,
          paymentsRank: 5,
          distinguishedRank: 2,
          aggregateScore: 398.7,
        },
      ],
    }
  }

  describe('writeSnapshot() with rankings', () => {
    it('should create complete snapshot including rankings file', async () => {
      const dataAsOfDate = '2025-01-07T00:00:00.000Z'
      const snapshot = createTestSnapshot(dataAsOfDate)
      const expectedSnapshotId = '2025-01-07'
      const rankingsData = createTestRankingsData(expectedSnapshotId)

      // Write snapshot with rankings
      await store.writeSnapshot(snapshot, rankingsData)

      // Verify snapshot directory was created with ISO date format
      const snapshotDir = path.join(
        testCacheDir,
        'snapshots',
        expectedSnapshotId
      )
      const dirExists = await fs
        .access(snapshotDir)
        .then(() => true)
        .catch(() => false)
      expect(dirExists).toBe(true)

      // Verify rankings file was created
      const rankingsFile = path.join(snapshotDir, 'all-districts-rankings.json')
      const rankingsExists = await fs
        .access(rankingsFile)
        .then(() => true)
        .catch(() => false)
      expect(rankingsExists).toBe(true)

      // Verify rankings file content
      const rankingsContent = await fs.readFile(rankingsFile, 'utf-8')
      const parsedRankings = JSON.parse(rankingsContent)
      expect(parsedRankings.metadata.snapshotId).toBe(expectedSnapshotId)
      expect(parsedRankings.rankings).toHaveLength(3)

      // Verify manifest includes rankings file
      const manifestFile = path.join(snapshotDir, 'manifest.json')
      const manifestContent = await fs.readFile(manifestFile, 'utf-8')
      const manifest = JSON.parse(manifestContent)
      expect(manifest.allDistrictsRankings).toBeDefined()
      expect(manifest.allDistrictsRankings.status).toBe('present')
      expect(manifest.allDistrictsRankings.filename).toBe(
        'all-districts-rankings.json'
      )
      expect(manifest.allDistrictsRankings.size).toBeGreaterThan(0)

      // Verify district files were also created
      expect(manifest.districts).toHaveLength(2)
      expect(manifest.successfulDistricts).toBe(2)
    })

    it('should create snapshot without rankings when rankings not provided', async () => {
      const dataAsOfDate = '2025-01-07T00:00:00.000Z'
      const snapshot = createTestSnapshot(dataAsOfDate)
      const expectedSnapshotId = '2025-01-07'

      // Write snapshot without rankings
      await store.writeSnapshot(snapshot)

      // Verify snapshot directory was created
      const snapshotDir = path.join(
        testCacheDir,
        'snapshots',
        expectedSnapshotId
      )
      const dirExists = await fs
        .access(snapshotDir)
        .then(() => true)
        .catch(() => false)
      expect(dirExists).toBe(true)

      // Verify rankings file was NOT created
      const rankingsFile = path.join(snapshotDir, 'all-districts-rankings.json')
      const rankingsExists = await fs
        .access(rankingsFile)
        .then(() => true)
        .catch(() => false)
      expect(rankingsExists).toBe(false)

      // Verify manifest marks rankings as missing
      const manifestFile = path.join(snapshotDir, 'manifest.json')
      const manifestContent = await fs.readFile(manifestFile, 'utf-8')
      const manifest = JSON.parse(manifestContent)
      expect(manifest.allDistrictsRankings).toBeDefined()
      expect(manifest.allDistrictsRankings.status).toBe('missing')
      expect(manifest.allDistrictsRankings.size).toBe(0)

      // Verify district files were still created
      expect(manifest.districts).toHaveLength(2)
      expect(manifest.successfulDistricts).toBe(2)
    })

    it('should fail entire operation if rankings write fails', async () => {
      const dataAsOfDate = '2025-01-07T00:00:00.000Z'
      const snapshot = createTestSnapshot(dataAsOfDate)
      const expectedSnapshotId = '2025-01-07'

      // Create invalid rankings data that will cause write to fail
      // by making the snapshot directory read-only after it's created
      const rankingsData = createTestRankingsData(expectedSnapshotId)

      // First, let the snapshot directory be created
      const snapshotDir = path.join(
        testCacheDir,
        'snapshots',
        expectedSnapshotId
      )
      await fs.mkdir(snapshotDir, { recursive: true })

      // Make the directory read-only to cause write failure
      await fs.chmod(snapshotDir, 0o444)

      try {
        // Attempt to write snapshot with rankings - should fail
        await expect(
          store.writeSnapshot(snapshot, rankingsData)
        ).rejects.toThrow()

        // Verify the error message mentions rankings
        await expect(
          store.writeSnapshot(snapshot, rankingsData)
        ).rejects.toThrow(/rankings/i)
      } finally {
        // Restore permissions for cleanup
        await fs.chmod(snapshotDir, 0o755)
      }
    })

    // Property 1: All Districts Rankings Completeness
    it('Property 1: All Districts Rankings Completeness - snapshot includes rankings for all districts in CSV', async () => {
      const dataAsOfDate = '2025-01-07T00:00:00.000Z'
      const snapshot = createTestSnapshot(dataAsOfDate)
      const expectedSnapshotId = '2025-01-07'
      const rankingsData = createTestRankingsData(expectedSnapshotId)

      // Write snapshot with rankings
      await store.writeSnapshot(snapshot, rankingsData)

      // Read rankings back
      const readRankings =
        await store.readAllDistrictsRankings(expectedSnapshotId)

      // Verify all districts from rankings data are present
      expect(readRankings).toBeDefined()
      expect(readRankings!.rankings).toHaveLength(rankingsData.rankings.length)

      // Verify each district from original data is in the snapshot
      for (const originalRanking of rankingsData.rankings) {
        const foundRanking = readRankings!.rankings.find(
          r => r.districtId === originalRanking.districtId
        )
        expect(foundRanking).toBeDefined()
        expect(foundRanking!.districtName).toBe(originalRanking.districtName)
        expect(foundRanking!.aggregateScore).toBe(
          originalRanking.aggregateScore
        )
      }

      // Verify metadata totalDistricts matches actual rankings count
      expect(readRankings!.metadata.totalDistricts).toBe(
        readRankings!.rankings.length
      )
    })
  })

  describe('Snapshot retrieval with rankings', () => {
    it('should be able to read rankings from snapshot after creation', async () => {
      const dataAsOfDate = '2025-01-07T00:00:00.000Z'
      const snapshot = createTestSnapshot(dataAsOfDate)
      const expectedSnapshotId = '2025-01-07'
      const rankingsData = createTestRankingsData(expectedSnapshotId)

      // Write snapshot with rankings
      await store.writeSnapshot(snapshot, rankingsData)

      // Read rankings using the dedicated method
      const readRankings =
        await store.readAllDistrictsRankings(expectedSnapshotId)

      expect(readRankings).toBeDefined()
      expect(readRankings!.metadata.snapshotId).toBe(expectedSnapshotId)
      expect(readRankings!.rankings).toHaveLength(3)

      // Verify rankings data integrity
      expect(readRankings!.rankings[0].districtId).toBe('42')
      expect(readRankings!.rankings[1].districtId).toBe('15')
      expect(readRankings!.rankings[2].districtId).toBe('F')
    })

    it('should detect rankings presence using hasAllDistrictsRankings', async () => {
      const dataAsOfDate = '2025-01-07T00:00:00.000Z'
      const snapshot = createTestSnapshot(dataAsOfDate)
      const expectedSnapshotId = '2025-01-07'
      const rankingsData = createTestRankingsData(expectedSnapshotId)

      // Before writing, rankings should not exist
      const beforeWrite =
        await store.hasAllDistrictsRankings(expectedSnapshotId)
      expect(beforeWrite).toBe(false)

      // Write snapshot with rankings
      await store.writeSnapshot(snapshot, rankingsData)

      // After writing, rankings should exist
      const afterWrite = await store.hasAllDistrictsRankings(expectedSnapshotId)
      expect(afterWrite).toBe(true)
    })
  })

  describe('Multiple snapshots with rankings', () => {
    it('should handle multiple snapshots with different rankings data', async () => {
      // Create first snapshot
      const date1 = '2025-01-07T00:00:00.000Z'
      const snapshot1 = createTestSnapshot(date1)
      const snapshotId1 = '2025-01-07'
      const rankings1 = createTestRankingsData(snapshotId1)

      await store.writeSnapshot(snapshot1, rankings1)

      // Create second snapshot with different date
      const date2 = '2025-01-08T00:00:00.000Z'
      const snapshot2 = createTestSnapshot(date2)
      const snapshotId2 = '2025-01-08'
      const rankings2 = createTestRankingsData(snapshotId2)
      // Modify rankings2 to have different data
      rankings2.rankings[0].aggregateScore = 999.9

      await store.writeSnapshot(snapshot2, rankings2)

      // Verify both snapshots have their own rankings
      const read1 = await store.readAllDistrictsRankings(snapshotId1)
      const read2 = await store.readAllDistrictsRankings(snapshotId2)

      expect(read1).toBeDefined()
      expect(read2).toBeDefined()
      expect(read1!.metadata.snapshotId).toBe(snapshotId1)
      expect(read2!.metadata.snapshotId).toBe(snapshotId2)

      // Verify rankings are different
      expect(read1!.rankings[0].aggregateScore).toBe(342.5)
      expect(read2!.rankings[0].aggregateScore).toBe(999.9)
    })
  })
})
