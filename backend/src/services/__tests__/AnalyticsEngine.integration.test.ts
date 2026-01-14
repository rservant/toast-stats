/**
 * Integration Tests for AnalyticsEngine
 *
 * Feature: club-health-classification
 * Task 12: Integration testing
 *
 * Tests:
 * - 12.1: Verify generateDistrictAnalytics returns correct arrays
 *   - vulnerableClubs contains Vulnerable clubs
 *   - interventionRequiredClubs contains Intervention Required clubs
 *   - thrivingClubs contains Thriving clubs
 *   - Requirements: 3.2
 *
 * - 12.2: Verify year-over-year calculations use new logic
 *   - Club health metrics use new classification
 *   - Requirements: 3.4
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
        fetchedAt: new Date().toISOString(),
        source: 'test',
        districtCount: districts.length,
        processingDurationMs: 0,
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
 * Helper to create district statistics for testing with full club data
 * Includes all fields needed for health classification
 */
function createDistrictStats(
  districtId: string,
  clubPerformance: Array<{
    clubNumber: string
    clubName: string
    membership: number
    memBase: number
    goalsMet: number
    cspSubmitted?: boolean
    division?: string
    area?: string
  }>
): DistrictStatistics {
  // Calculate totals from club data
  const totalMembers = clubPerformance.reduce((sum, c) => sum + c.membership, 0)
  const totalGoals = clubPerformance.reduce((sum, c) => sum + c.goalsMet, 0)

  return {
    districtId,
    asOfDate: new Date().toISOString(),
    membership: {
      total: totalMembers,
      change: 0,
      changePercent: 0,
      byClub: clubPerformance.map(c => ({
        clubId: c.clubNumber,
        clubName: c.clubName,
        memberCount: c.membership,
      })),
    },
    clubs: {
      total: clubPerformance.length,
      active: clubPerformance.length,
      suspended: 0,
      ineligible: 0,
      low: clubPerformance.filter(c => c.membership < 12).length,
      distinguished: clubPerformance.filter(c => c.goalsMet >= 5).length,
    },
    education: {
      totalAwards: totalGoals,
      byType: [],
      topClubs: [],
    },
    clubPerformance: clubPerformance.map(club => ({
      'Club Number': club.clubNumber,
      'Club Name': club.clubName,
      'Active Members': String(club.membership),
      'Mem. Base': String(club.memBase),
      'Goals Met': String(club.goalsMet),
      CSP: club.cspSubmitted !== false ? 'Yes' : 'No',
      Division: club.division || 'A',
      'Division Name': `Division ${club.division || 'A'}`,
      Area: club.area || '1',
      'Area Name': `Area ${club.area || '1'}`,
    })),
    districtPerformance: [],
    divisionPerformance: [],
  }
}

describe('AnalyticsEngine Integration Tests - Club Health Classification', () => {
  let snapshotStore: PerDistrictFileSnapshotStore
  let analyticsEngine: AnalyticsEngine
  let testCacheConfig: TestCacheConfig

  beforeEach(async () => {
    // Create isolated test cache configuration
    const testName = `analytics-integration-${process.pid}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
    testCacheConfig = await createTestCacheConfig(testName)

    // Ensure the cache directory and subdirectories exist
    const snapshotsDir = path.resolve(testCacheConfig.cacheDir, 'snapshots')
    await fs.mkdir(snapshotsDir, { recursive: true })

    // Create the data source stack
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
    analyticsEngine.clearCaches()
  })

  afterEach(async () => {
    if (analyticsEngine) {
      analyticsEngine.clearCaches()
      await analyticsEngine.dispose()
    }
    await cleanupTestCacheConfig(testCacheConfig)
  })

  /**
   * Task 12.1: Verify generateDistrictAnalytics returns correct arrays
   * Requirements: 3.2
   */
  describe('12.1 generateDistrictAnalytics returns correct arrays', () => {
    it('vulnerableClubs contains only Vulnerable clubs', async () => {
      const districtId = `test-district-${Date.now()}`
      // January 15 - requires 3 DCP goals
      const snapshotDate = '2026-01-15'

      // Create clubs with different health statuses:
      // Club 1: Vulnerable - membership 20, DCP 2 (below checkpoint of 3)
      // Club 2: Thriving - membership 20, DCP 5
      // Club 3: Intervention Required - membership 8, net growth 0
      const stats = createDistrictStats(districtId, [
        {
          clubNumber: '1',
          clubName: 'Vulnerable Club',
          membership: 20,
          memBase: 18,
          goalsMet: 2, // Below January checkpoint of 3
          division: 'A',
          area: '1',
        },
        {
          clubNumber: '2',
          clubName: 'Thriving Club',
          membership: 25,
          memBase: 20,
          goalsMet: 5,
          division: 'A',
          area: '2',
        },
        {
          clubNumber: '3',
          clubName: 'Intervention Club',
          membership: 8,
          memBase: 8, // net growth = 0
          goalsMet: 5,
          division: 'B',
          area: '3',
        },
      ])

      await createTestSnapshot(snapshotStore, snapshotDate, [stats])

      const analytics = await analyticsEngine.generateDistrictAnalytics(
        districtId,
        snapshotDate,
        snapshotDate
      )

      // Verify vulnerableClubs contains only vulnerable clubs
      expect(analytics.vulnerableClubs).toHaveLength(1)
      expect(analytics.vulnerableClubs[0]?.clubId).toBe('1')
      expect(analytics.vulnerableClubs[0]?.currentStatus).toBe('vulnerable')

      // Verify no intervention-required clubs in vulnerableClubs
      const hasInterventionInVulnerable = analytics.vulnerableClubs.some(
        c => c.currentStatus === 'intervention-required'
      )
      expect(hasInterventionInVulnerable).toBe(false)

      // Verify no thriving clubs in vulnerableClubs
      const hasThrivingInVulnerable = analytics.vulnerableClubs.some(
        c => c.currentStatus === 'thriving'
      )
      expect(hasThrivingInVulnerable).toBe(false)
    })

    it('interventionRequiredClubs contains only Intervention Required clubs', async () => {
      const districtId = `test-district-${Date.now()}`
      const snapshotDate = '2026-01-15'

      const stats = createDistrictStats(districtId, [
        {
          clubNumber: '1',
          clubName: 'Vulnerable Club',
          membership: 20,
          memBase: 18,
          goalsMet: 2,
          division: 'A',
          area: '1',
        },
        {
          clubNumber: '2',
          clubName: 'Thriving Club',
          membership: 25,
          memBase: 20,
          goalsMet: 5,
          division: 'A',
          area: '2',
        },
        {
          clubNumber: '3',
          clubName: 'Intervention Club 1',
          membership: 8,
          memBase: 8, // net growth = 0
          goalsMet: 5,
          division: 'B',
          area: '3',
        },
        {
          clubNumber: '4',
          clubName: 'Intervention Club 2',
          membership: 10,
          memBase: 9, // net growth = 1 (< 3)
          goalsMet: 3,
          division: 'B',
          area: '4',
        },
      ])

      await createTestSnapshot(snapshotStore, snapshotDate, [stats])

      const analytics = await analyticsEngine.generateDistrictAnalytics(
        districtId,
        snapshotDate,
        snapshotDate
      )

      // Verify interventionRequiredClubs contains only intervention-required clubs
      expect(analytics.interventionRequiredClubs).toHaveLength(2)
      expect(
        analytics.interventionRequiredClubs.every(
          c => c.currentStatus === 'intervention-required'
        )
      ).toBe(true)

      // Verify club IDs
      const interventionClubIds = analytics.interventionRequiredClubs.map(
        c => c.clubId
      )
      expect(interventionClubIds).toContain('3')
      expect(interventionClubIds).toContain('4')
    })

    it('thrivingClubs contains only Thriving clubs', async () => {
      const districtId = `test-district-${Date.now()}`
      const snapshotDate = '2026-01-15'

      const stats = createDistrictStats(districtId, [
        {
          clubNumber: '1',
          clubName: 'Vulnerable Club',
          membership: 20,
          memBase: 18,
          goalsMet: 2,
          division: 'A',
          area: '1',
        },
        {
          clubNumber: '2',
          clubName: 'Thriving Club 1',
          membership: 25,
          memBase: 20,
          goalsMet: 5,
          division: 'A',
          area: '2',
        },
        {
          clubNumber: '3',
          clubName: 'Thriving Club 2',
          membership: 20,
          memBase: 15,
          goalsMet: 3, // Meets January checkpoint
          division: 'B',
          area: '3',
        },
        {
          clubNumber: '4',
          clubName: 'Intervention Club',
          membership: 8,
          memBase: 8,
          goalsMet: 5,
          division: 'B',
          area: '4',
        },
      ])

      await createTestSnapshot(snapshotStore, snapshotDate, [stats])

      const analytics = await analyticsEngine.generateDistrictAnalytics(
        districtId,
        snapshotDate,
        snapshotDate
      )

      // Verify thrivingClubs contains only thriving clubs
      expect(analytics.thrivingClubs).toHaveLength(2)
      expect(
        analytics.thrivingClubs.every(c => c.currentStatus === 'thriving')
      ).toBe(true)

      // Verify club IDs
      const thrivingClubIds = analytics.thrivingClubs.map(c => c.clubId)
      expect(thrivingClubIds).toContain('2')
      expect(thrivingClubIds).toContain('3')
    })

    it('all clubs are mutually exclusive across arrays', async () => {
      const districtId = `test-district-${Date.now()}`
      const snapshotDate = '2026-01-15'

      // Create a mix of clubs
      const stats = createDistrictStats(districtId, [
        {
          clubNumber: '1',
          clubName: 'Thriving Club',
          membership: 25,
          memBase: 20,
          goalsMet: 5,
          division: 'A',
          area: '1',
        },
        {
          clubNumber: '2',
          clubName: 'Vulnerable Club 1',
          membership: 20,
          memBase: 18,
          goalsMet: 2,
          division: 'A',
          area: '2',
        },
        {
          clubNumber: '3',
          clubName: 'Vulnerable Club 2',
          membership: 18,
          memBase: 16, // net growth = 2 (< 3), membership < 20
          goalsMet: 5,
          division: 'B',
          area: '3',
        },
        {
          clubNumber: '4',
          clubName: 'Intervention Club',
          membership: 10,
          memBase: 10,
          goalsMet: 5,
          division: 'B',
          area: '4',
        },
      ])

      await createTestSnapshot(snapshotStore, snapshotDate, [stats])

      const analytics = await analyticsEngine.generateDistrictAnalytics(
        districtId,
        snapshotDate,
        snapshotDate
      )

      // Collect all club IDs from each array
      const thrivingIds = new Set(analytics.thrivingClubs.map(c => c.clubId))
      const vulnerableIds = new Set(
        analytics.vulnerableClubs.map(c => c.clubId)
      )
      const interventionIds = new Set(
        analytics.interventionRequiredClubs.map(c => c.clubId)
      )

      // Verify no overlap between arrays
      for (const id of thrivingIds) {
        expect(vulnerableIds.has(id)).toBe(false)
        expect(interventionIds.has(id)).toBe(false)
      }
      for (const id of vulnerableIds) {
        expect(thrivingIds.has(id)).toBe(false)
        expect(interventionIds.has(id)).toBe(false)
      }
      for (const id of interventionIds) {
        expect(thrivingIds.has(id)).toBe(false)
        expect(vulnerableIds.has(id)).toBe(false)
      }

      // Verify total count matches allClubs
      const totalCategorized =
        analytics.thrivingClubs.length +
        analytics.vulnerableClubs.length +
        analytics.interventionRequiredClubs.length
      expect(totalCategorized).toBe(analytics.allClubs.length)
    })

    it('arrays use new status values (thriving, vulnerable, intervention-required)', async () => {
      const districtId = `test-district-${Date.now()}`
      const snapshotDate = '2026-01-15'

      const stats = createDistrictStats(districtId, [
        {
          clubNumber: '1',
          clubName: 'Test Club',
          membership: 25,
          memBase: 20,
          goalsMet: 5,
          division: 'A',
          area: '1',
        },
      ])

      await createTestSnapshot(snapshotStore, snapshotDate, [stats])

      const analytics = await analyticsEngine.generateDistrictAnalytics(
        districtId,
        snapshotDate,
        snapshotDate
      )

      // Verify all clubs use new status values
      for (const club of analytics.allClubs) {
        expect(['thriving', 'vulnerable', 'intervention-required']).toContain(
          club.currentStatus
        )
      }

      // Verify old status values are not used
      for (const club of analytics.allClubs) {
        expect(club.currentStatus).not.toBe('healthy')
        expect(club.currentStatus).not.toBe('at-risk')
        expect(club.currentStatus).not.toBe('critical')
      }
    })
  })

  /**
   * Task 12.2: Verify year-over-year calculations use new logic
   * Requirements: 3.4
   *
   * Note: The countThrivingClubs/countVulnerableClubs/countInterventionRequiredClubs methods
   * use a simplified classification for counting purposes:
   * - Thriving: membership >= 20 OR net growth >= 3, AND dcpGoals > 0
   * - Intervention Required: membership < 12 AND net growth < 3
   * - Vulnerable: everything else (not thriving and not intervention)
   */
  describe('12.2 year-over-year calculations use new classification logic', () => {
    it('clubHealth metrics use new classification (thrivingClubs, vulnerableClubs, interventionRequiredClubs)', async () => {
      const districtId = `test-district-${Date.now()}`
      const currentDate = '2026-01-15'
      const previousDate = '2025-01-15'

      // Current year: 3 thriving, 0 vulnerable, 1 intervention
      // Note: countThrivingClubs uses simplified logic: (membership >= 20 OR netGrowth >= 3) AND dcpGoals > 0
      const currentStats = createDistrictStats(districtId, [
        {
          clubNumber: '1',
          clubName: 'Thriving Club 1',
          membership: 25,
          memBase: 20,
          goalsMet: 5, // Thriving: membership >= 20, dcpGoals > 0
          division: 'A',
          area: '1',
        },
        {
          clubNumber: '2',
          clubName: 'Thriving Club 2',
          membership: 22,
          memBase: 18,
          goalsMet: 4, // Thriving: membership >= 20, dcpGoals > 0
          division: 'A',
          area: '2',
        },
        {
          clubNumber: '3',
          clubName: 'Thriving Club 3',
          membership: 20,
          memBase: 18,
          goalsMet: 2, // Thriving: membership >= 20, dcpGoals > 0 (simplified check)
          division: 'B',
          area: '3',
        },
        {
          clubNumber: '4',
          clubName: 'Intervention Club',
          membership: 8,
          memBase: 8, // net growth = 0
          goalsMet: 5, // Intervention: membership < 12 AND net growth < 3
          division: 'B',
          area: '4',
        },
      ])
      await createTestSnapshot(snapshotStore, currentDate, [currentStats])

      // Previous year: 2 thriving, 1 vulnerable, 1 intervention
      const previousStats = createDistrictStats(districtId, [
        {
          clubNumber: '1',
          clubName: 'Thriving Club 1',
          membership: 22,
          memBase: 18,
          goalsMet: 4, // Thriving: membership >= 20, dcpGoals > 0
          division: 'A',
          area: '1',
        },
        {
          clubNumber: '2',
          clubName: 'Thriving Club 2',
          membership: 20,
          memBase: 18,
          goalsMet: 2, // Thriving: membership >= 20, dcpGoals > 0
          division: 'A',
          area: '2',
        },
        {
          clubNumber: '3',
          clubName: 'Vulnerable Club',
          membership: 18,
          memBase: 16, // net growth = 2 (< 3), membership < 20
          goalsMet: 3, // Vulnerable: membership < 20 AND net growth < 3
          division: 'B',
          area: '3',
        },
        {
          clubNumber: '4',
          clubName: 'Intervention Club',
          membership: 10,
          memBase: 10, // net growth = 0
          goalsMet: 5, // Intervention: membership < 12 AND net growth < 3
          division: 'B',
          area: '4',
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

      // Verify clubHealth metrics exist with new terminology
      expect(result!.metrics!.clubHealth).toBeDefined()
      expect(result!.metrics!.clubHealth.thrivingClubs).toBeDefined()
      expect(result!.metrics!.clubHealth.vulnerableClubs).toBeDefined()
      expect(
        result!.metrics!.clubHealth.interventionRequiredClubs
      ).toBeDefined()

      // Verify thrivingClubs metrics (current: 3, previous: 2)
      expect(result!.metrics!.clubHealth.thrivingClubs.current).toBe(3)
      expect(result!.metrics!.clubHealth.thrivingClubs.previous).toBe(2)
      expect(result!.metrics!.clubHealth.thrivingClubs.change).toBe(1)

      // Verify vulnerableClubs metrics (current: 0, previous: 1)
      expect(result!.metrics!.clubHealth.vulnerableClubs.current).toBe(0)
      expect(result!.metrics!.clubHealth.vulnerableClubs.previous).toBe(1)
      expect(result!.metrics!.clubHealth.vulnerableClubs.change).toBe(-1)

      // Verify interventionRequiredClubs metrics (current: 1, previous: 1)
      expect(
        result!.metrics!.clubHealth.interventionRequiredClubs.current
      ).toBe(1)
      expect(
        result!.metrics!.clubHealth.interventionRequiredClubs.previous
      ).toBe(1)
      expect(result!.metrics!.clubHealth.interventionRequiredClubs.change).toBe(
        0
      )
    })

    it('year-over-year does not use old terminology (healthyClubs, atRiskClubs, criticalClubs)', async () => {
      const districtId = `test-district-${Date.now()}`
      const currentDate = '2026-01-15'
      const previousDate = '2025-01-15'

      const currentStats = createDistrictStats(districtId, [
        {
          clubNumber: '1',
          clubName: 'Test Club',
          membership: 25,
          memBase: 20,
          goalsMet: 5,
          division: 'A',
          area: '1',
        },
      ])
      await createTestSnapshot(snapshotStore, currentDate, [currentStats])

      const previousStats = createDistrictStats(districtId, [
        {
          clubNumber: '1',
          clubName: 'Test Club',
          membership: 22,
          memBase: 18,
          goalsMet: 4,
          division: 'A',
          area: '1',
        },
      ])
      await createTestSnapshot(snapshotStore, previousDate, [previousStats])

      const result = await analyticsEngine.calculateYearOverYear(
        districtId,
        currentDate
      )

      expect(result).not.toBeNull()
      expect(result!.metrics).toBeDefined()

      // Verify old terminology is not present
      const metricsJson = JSON.stringify(result!.metrics)
      expect(metricsJson).not.toContain('healthyClubs')
      expect(metricsJson).not.toContain('atRiskClubs')
      expect(metricsJson).not.toContain('criticalClubs')

      // Verify new terminology is present
      expect(metricsJson).toContain('thrivingClubs')
      expect(metricsJson).toContain('vulnerableClubs')
      expect(metricsJson).toContain('interventionRequiredClubs')
    })

    it('percentage changes are calculated correctly for club health metrics', async () => {
      const districtId = `test-district-${Date.now()}`
      const currentDate = '2026-01-15'
      const previousDate = '2025-01-15'

      // Current year: 4 thriving clubs (all meet: membership >= 20 AND dcpGoals > 0)
      const currentStats = createDistrictStats(districtId, [
        {
          clubNumber: '1',
          clubName: 'Thriving 1',
          membership: 25,
          memBase: 20,
          goalsMet: 5,
          division: 'A',
          area: '1',
        },
        {
          clubNumber: '2',
          clubName: 'Thriving 2',
          membership: 22,
          memBase: 18,
          goalsMet: 4,
          division: 'A',
          area: '2',
        },
        {
          clubNumber: '3',
          clubName: 'Thriving 3',
          membership: 20,
          memBase: 15,
          goalsMet: 3,
          division: 'B',
          area: '3',
        },
        {
          clubNumber: '4',
          clubName: 'Thriving 4',
          membership: 21,
          memBase: 16,
          goalsMet: 4,
          division: 'B',
          area: '4',
        },
      ])
      await createTestSnapshot(snapshotStore, currentDate, [currentStats])

      // Previous year: 2 thriving clubs, 1 vulnerable, 1 intervention
      const previousStats = createDistrictStats(districtId, [
        {
          clubNumber: '1',
          clubName: 'Thriving 1',
          membership: 22,
          memBase: 18,
          goalsMet: 4, // Thriving: membership >= 20, dcpGoals > 0
          division: 'A',
          area: '1',
        },
        {
          clubNumber: '2',
          clubName: 'Thriving 2',
          membership: 20,
          memBase: 15,
          goalsMet: 3, // Thriving: membership >= 20, dcpGoals > 0
          division: 'A',
          area: '2',
        },
        {
          clubNumber: '3',
          clubName: 'Vulnerable',
          membership: 18,
          memBase: 16, // net growth = 2 (< 3), membership < 20
          goalsMet: 2, // Vulnerable: membership < 20 AND net growth < 3
          division: 'B',
          area: '3',
        },
        {
          clubNumber: '4',
          clubName: 'Intervention',
          membership: 8,
          memBase: 8, // net growth = 0
          goalsMet: 5, // Intervention: membership < 12 AND net growth < 3
          division: 'B',
          area: '4',
        },
      ])
      await createTestSnapshot(snapshotStore, previousDate, [previousStats])

      const result = await analyticsEngine.calculateYearOverYear(
        districtId,
        currentDate
      )

      expect(result).not.toBeNull()
      expect(result!.metrics!.clubHealth.thrivingClubs.current).toBe(4)
      expect(result!.metrics!.clubHealth.thrivingClubs.previous).toBe(2)
      expect(result!.metrics!.clubHealth.thrivingClubs.change).toBe(2)
      // Percentage change: (4-2)/2 * 100 = 100%
      expect(result!.metrics!.clubHealth.thrivingClubs.percentageChange).toBe(
        100
      )
    })
  })
})
