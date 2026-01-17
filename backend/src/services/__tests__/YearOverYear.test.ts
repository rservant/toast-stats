/**
 * Tests for Year-Over-Year Comparison Logic
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 *
 * Updated to use the new IAnalyticsDataSource interface with
 * PerDistrictSnapshotStore and AnalyticsDataSourceAdapter.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'fs'
import path from 'path'
import { AnalyticsEngine } from '../AnalyticsEngine.js'
import {
  FileSnapshotStore,
  PerDistrictFileSnapshotStore,
} from '../SnapshotStore.js'
import { AnalyticsDataSourceAdapter } from '../AnalyticsDataSourceAdapter.js'
import { createDistrictDataAggregator } from '../DistrictDataAggregator.js'
import {
  createTestCacheConfig,
  cleanupTestCacheConfig,
} from '../../utils/test-cache-helper.js'
import type { TestCacheConfig } from '../../utils/test-cache-helper.js'
import type { DistrictStatistics } from '../../types/districts.js'
import type { Snapshot } from '../../types/snapshots.js'

/**
 * Helper to create a snapshot with district data for testing
 */
async function createTestSnapshot(
  snapshotStore: PerDistrictFileSnapshotStore,
  snapshotDate: string,
  districts: DistrictStatistics[]
): Promise<void> {
  const snapshot: Snapshot = {
    snapshot_id: snapshotDate,
    created_at: new Date().toISOString(),
    schema_version: '1.0.0',
    calculation_version: '1.0.0',
    status: 'success',
    payload: {
      metadata: {
        dataAsOfDate: snapshotDate,
        collectedAt: new Date().toISOString(),
        source: 'test',
        configuredDistricts: districts.map(d => d.districtId),
        successfulDistricts: districts.map(d => d.districtId),
        failedDistricts: [],
      },
      districts,
    },
    errors: [],
  }

  await snapshotStore.writeSnapshot(snapshot)
}

/**
 * Helper to create district statistics for testing
 */
function createDistrictStats(
  districtId: string,
  clubPerformance: Array<{
    clubNumber: string
    clubName: string
    membership: number
    goalsMet: number
    division?: string
    area?: string
  }>
): DistrictStatistics {
  return {
    districtId,
    asOfDate: new Date().toISOString(),
    clubPerformance: clubPerformance.map(club => ({
      'Club Number': club.clubNumber,
      'Club Name': club.clubName,
      'Active Membership': String(club.membership),
      'Goals Met': String(club.goalsMet),
      Division: club.division || 'A',
      'Division Name': `Division ${club.division || 'A'}`,
      Area: club.area || '1',
      'Area Name': `Area ${club.area || '1'}`,
    })),
    districtPerformance: [],
    divisionPerformance: [],
  }
}

describe('Year-Over-Year Comparison Logic', () => {
  let snapshotStore: PerDistrictFileSnapshotStore
  let analyticsEngine: AnalyticsEngine
  let testCacheConfig: TestCacheConfig

  beforeEach(async () => {
    // Create isolated test cache configuration with unique test name and process ID
    const testName = `year-over-year-${process.pid}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
    testCacheConfig = await createTestCacheConfig(testName)

    // Ensure the cache directory and subdirectories exist
    const snapshotsDir = path.resolve(testCacheConfig.cacheDir, 'snapshots')
    await fs.mkdir(snapshotsDir, { recursive: true })

    // Create the new data source stack
    snapshotStore = new PerDistrictFileSnapshotStore({
      cacheDir: testCacheConfig.cacheDir,
      maxSnapshots: 100,
      maxAgeDays: 365,
    })

    const districtDataAggregator = createDistrictDataAggregator(snapshotStore)
    const dataSource = new AnalyticsDataSourceAdapter(
      districtDataAggregator,
      snapshotStore
    )

    analyticsEngine = new AnalyticsEngine(dataSource)

    // Clear any internal caches
    analyticsEngine.clearCaches()
  })

  afterEach(async () => {
    // Clear caches before cleanup
    if (analyticsEngine) {
      analyticsEngine.clearCaches()
    }

    // Clean up test cache configuration
    await cleanupTestCacheConfig(testCacheConfig)
  })

  describe('findPreviousProgramYearDate', () => {
    it('should calculate previous year date correctly (Requirement 9.1)', async () => {
      const districtId = `testDistrict${Date.now()}v5`
      const currentDate = '2024-11-22'
      const previousDate = '2023-11-22'

      // Create current year snapshot
      const currentStats = createDistrictStats(districtId, [
        {
          clubNumber: '12345',
          clubName: 'Test Club',
          membership: 25,
          goalsMet: 5,
        },
      ])
      await createTestSnapshot(snapshotStore, currentDate, [currentStats])

      // Create previous year snapshot
      const previousStats = createDistrictStats(districtId, [
        {
          clubNumber: '12345',
          clubName: 'Test Club',
          membership: 20,
          goalsMet: 3,
        },
      ])
      await createTestSnapshot(snapshotStore, previousDate, [previousStats])

      // Calculate year-over-year
      const result = await analyticsEngine.calculateYearOverYear(
        districtId,
        currentDate
      )

      expect(result).toBeDefined()
      expect(result).not.toBeNull()
      expect(result!.currentDate).toBe(currentDate)
      expect(result!.previousYearDate).toBe(previousDate)
      expect(result!.dataAvailable).toBe(true)
    })
  })

  describe('calculatePercentageChanges', () => {
    it('should calculate percentage changes for all key metrics (Requirement 9.2)', async () => {
      const districtId = `testDistrict${Date.now()}${Math.random().toString(36).substring(2, 8)}`
      const currentDate = '2024-11-22'
      const previousDate = '2023-11-22'

      // Create current year snapshot
      const currentStats = createDistrictStats(districtId, [
        {
          clubNumber: '1',
          clubName: 'Club 1',
          membership: 30,
          goalsMet: 8,
          division: 'A',
          area: '1',
        },
        {
          clubNumber: '2',
          clubName: 'Club 2',
          membership: 25,
          goalsMet: 6,
          division: 'B',
          area: '2',
        },
      ])
      await createTestSnapshot(snapshotStore, currentDate, [currentStats])

      // Create previous year snapshot
      const previousStats = createDistrictStats(districtId, [
        {
          clubNumber: '1',
          clubName: 'Club 1',
          membership: 25,
          goalsMet: 5,
          division: 'A',
          area: '1',
        },
        {
          clubNumber: '2',
          clubName: 'Club 2',
          membership: 20,
          goalsMet: 4,
          division: 'B',
          area: '2',
        },
      ])
      await createTestSnapshot(snapshotStore, previousDate, [previousStats])

      const result = await analyticsEngine.calculateYearOverYear(
        districtId,
        currentDate
      )

      expect(result).not.toBeNull()
      expect(result!.dataAvailable).toBe(true)
      expect(result!.metrics).toBeDefined()

      // Check membership metrics
      expect(result!.metrics!.membership.current).toBe(55) // 30 + 25
      expect(result!.metrics!.membership.previous).toBe(45) // 25 + 20
      expect(result!.metrics!.membership.change).toBe(10)
      expect(result!.metrics!.membership.percentageChange).toBeCloseTo(22.2, 1)

      // Check DCP goals metrics
      expect(result!.metrics!.dcpGoals.totalGoals.current).toBe(14) // 8 + 6
      expect(result!.metrics!.dcpGoals.totalGoals.previous).toBe(9) // 5 + 4
      expect(result!.metrics!.dcpGoals.totalGoals.change).toBe(5)

      // Check club count
      expect(result!.metrics!.clubCount.current).toBe(2)
      expect(result!.metrics!.clubCount.previous).toBe(2)
    })
  })

  describe('handleMissingData', () => {
    it('should handle missing previous year data gracefully (Requirement 9.3)', async () => {
      const districtId = `testDistrict${Date.now()}v1`
      const currentDate = '2024-11-22'

      // Only create current year snapshot
      const currentStats = createDistrictStats(districtId, [
        {
          clubNumber: '1',
          clubName: 'Club 1',
          membership: 25,
          goalsMet: 5,
        },
      ])
      await createTestSnapshot(snapshotStore, currentDate, [currentStats])

      const result = await analyticsEngine.calculateYearOverYear(
        districtId,
        currentDate
      )

      expect(result).toBeDefined()
      expect(result).not.toBeNull()
      expect(result!.dataAvailable).toBe(false)
      expect(result!.message).toContain('N/A')
      expect(result!.metrics).toBeUndefined()
    })

    it('should handle missing current year data gracefully (Requirement 9.3)', async () => {
      const districtId = `testDistrict${Date.now()}v2`
      const currentDate = '2024-11-22'

      // No data cached at all for this district
      const result = await analyticsEngine.calculateYearOverYear(
        districtId,
        currentDate
      )

      expect(result).toBeNull()
    })
  })

  describe('multiYearTrends', () => {
    it('should support multi-year trends when 3+ years available (Requirement 9.5)', async () => {
      const districtId = `testDistrict${Date.now()}${Math.random().toString(36).substring(2, 8)}`

      // Create snapshots for 3 years
      for (let year = 2022; year <= 2024; year++) {
        const date = `${year}-11-22`
        const membership = 40 + (year - 2022) * 5 // Growing membership

        const stats = createDistrictStats(districtId, [
          {
            clubNumber: '1',
            clubName: 'Club 1',
            membership,
            goalsMet: 5 + (year - 2022),
          },
        ])
        await createTestSnapshot(snapshotStore, date, [stats])
      }

      const result = await analyticsEngine.calculateYearOverYear(
        districtId,
        '2024-11-22'
      )

      expect(result).not.toBeNull()
      expect(result!.dataAvailable).toBe(true)
      expect(result!.multiYearTrends).toBeDefined()
      expect(result!.multiYearTrends!.available).toBe(true)
      expect(result!.multiYearTrends!.years).toHaveLength(3)
      expect(result!.multiYearTrends!.trends).toBeDefined()
      expect(result!.multiYearTrends!.trends!.membershipTrend).toBe(
        'increasing'
      )
    })

    it('should not provide multi-year trends when less than 3 years available', async () => {
      const districtId = `testDistrict${Date.now()}${Math.random().toString(36).substring(2, 8)}`

      // Create snapshots for only 2 years
      for (let year = 2023; year <= 2024; year++) {
        const date = `${year}-11-22`

        const stats = createDistrictStats(districtId, [
          {
            clubNumber: '1',
            clubName: 'Club 1',
            membership: 25,
            goalsMet: 5,
          },
        ])
        await createTestSnapshot(snapshotStore, date, [stats])
      }

      const result = await analyticsEngine.calculateYearOverYear(
        districtId,
        '2024-11-22'
      )

      expect(result).not.toBeNull()
      expect(result!.dataAvailable).toBe(true)
      expect(result!.multiYearTrends).toBeDefined()
      expect(result!.multiYearTrends!.available).toBe(false)
    })
  })

  describe('distinguishedClubsComparison', () => {
    it('should calculate distinguished clubs year-over-year with breakdown by level', async () => {
      const districtId = `testDistrict${Date.now()}${Math.random().toString(36).substring(2, 8)}`
      const currentDate = '2024-11-22'
      const previousDate = '2023-11-22'

      // Current year: 2 President's (9 goals), 1 Select (7 goals), 1 Distinguished (5 goals)
      const currentStats = createDistrictStats(districtId, [
        {
          clubNumber: '1',
          clubName: 'Club 1',
          membership: 25,
          goalsMet: 9,
          division: 'A',
          area: '1',
        },
        {
          clubNumber: '2',
          clubName: 'Club 2',
          membership: 25,
          goalsMet: 9,
          division: 'A',
          area: '2',
        },
        {
          clubNumber: '3',
          clubName: 'Club 3',
          membership: 25,
          goalsMet: 7,
          division: 'B',
          area: '3',
        },
        {
          clubNumber: '4',
          clubName: 'Club 4',
          membership: 25,
          goalsMet: 5,
          division: 'B',
          area: '4',
        },
      ])
      await createTestSnapshot(snapshotStore, currentDate, [currentStats])

      // Previous year: 1 President's, 1 Select, 1 Distinguished
      const previousStats = createDistrictStats(districtId, [
        {
          clubNumber: '1',
          clubName: 'Club 1',
          membership: 25,
          goalsMet: 9,
          division: 'A',
          area: '1',
        },
        {
          clubNumber: '2',
          clubName: 'Club 2',
          membership: 25,
          goalsMet: 7,
          division: 'A',
          area: '2',
        },
        {
          clubNumber: '3',
          clubName: 'Club 3',
          membership: 25,
          goalsMet: 5,
          division: 'B',
          area: '3',
        },
      ])
      await createTestSnapshot(snapshotStore, previousDate, [previousStats])

      const result = await analyticsEngine.calculateYearOverYear(
        districtId,
        currentDate
      )

      expect(result).not.toBeNull()
      expect(result!.dataAvailable).toBe(true)
      expect(result!.metrics!.distinguishedClubs.current).toBe(4)
      expect(result!.metrics!.distinguishedClubs.previous).toBe(3)
      expect(result!.metrics!.distinguishedClubs.change).toBe(1)
      expect(
        result!.metrics!.distinguishedClubs.byLevel.presidents.current
      ).toBe(2)
      expect(
        result!.metrics!.distinguishedClubs.byLevel.presidents.previous
      ).toBe(1)
      expect(
        result!.metrics!.distinguishedClubs.byLevel.presidents.change
      ).toBe(1)
    })
  })
})
