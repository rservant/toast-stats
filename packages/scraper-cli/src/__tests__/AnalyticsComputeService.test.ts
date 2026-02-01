/**
 * Unit Tests for AnalyticsComputeService
 *
 * Tests the analytics computation pipeline that loads snapshot data,
 * computes analytics using the shared AnalyticsComputer, and writes
 * the results using AnalyticsWriter.
 *
 * Requirements:
 * - 1.2: WHEN snapshots are created, THE Scraper_CLI SHALL compute analytics
 *        for each district using the same algorithms as the Analytics_Engine
 * - 1.3: WHEN computing analytics, THE Scraper_CLI SHALL generate membership
 *        trends, club health scores, distinguished club projections,
 *        division/area comparisons, and year-over-year metrics
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { AnalyticsComputeService } from '../services/AnalyticsComputeService.js'
import {
  ANALYTICS_SCHEMA_VERSION,
  type DistrictStatistics,
  type PreComputedAnalyticsFile,
  type DistrictAnalytics,
  type MembershipTrendData,
  type ClubHealthData,
  type AnalyticsManifest,
} from '@toastmasters/analytics-core'

/**
 * Create an isolated test cache directory
 */
function createIsolatedCacheDir(): {
  path: string
  cleanup: () => Promise<void>
} {
  const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const cachePath = path.join(
    os.tmpdir(),
    `analytics-compute-test-${uniqueId}`
  )

  return {
    path: cachePath,
    cleanup: async () => {
      await fs.rm(cachePath, { recursive: true, force: true })
    },
  }
}

/**
 * Create sample district statistics for testing
 */
function createSampleDistrictStatistics(
  districtId: string,
  date: string
): DistrictStatistics {
  return {
    districtId,
    snapshotDate: date,
    clubs: [
      {
        clubId: '1234',
        clubName: 'Test Club One',
        divisionId: 'A',
        areaId: 'A1',
        membershipCount: 25,
        paymentsCount: 30,
        dcpGoals: 7,
        status: 'Active',
        charterDate: '2020-01-15',
      },
      {
        clubId: '5678',
        clubName: 'Test Club Two',
        divisionId: 'A',
        areaId: 'A2',
        membershipCount: 15,
        paymentsCount: 18,
        dcpGoals: 4,
        status: 'Active',
        charterDate: '2019-06-01',
      },
      {
        clubId: '9012',
        clubName: 'Test Club Three',
        divisionId: 'B',
        areaId: 'B1',
        membershipCount: 8,
        paymentsCount: 10,
        dcpGoals: 2,
        status: 'Active',
        charterDate: '2021-03-20',
      },
    ],
    divisions: [
      {
        divisionId: 'A',
        divisionName: 'Division Alpha',
        clubCount: 2,
        membershipTotal: 40,
        paymentsTotal: 48,
      },
      {
        divisionId: 'B',
        divisionName: 'Division Beta',
        clubCount: 1,
        membershipTotal: 8,
        paymentsTotal: 10,
      },
    ],
    areas: [
      {
        areaId: 'A1',
        areaName: 'Area A1',
        divisionId: 'A',
        clubCount: 1,
        membershipTotal: 25,
        paymentsTotal: 30,
      },
      {
        areaId: 'A2',
        areaName: 'Area A2',
        divisionId: 'A',
        clubCount: 1,
        membershipTotal: 15,
        paymentsTotal: 18,
      },
      {
        areaId: 'B1',
        areaName: 'Area B1',
        divisionId: 'B',
        clubCount: 1,
        membershipTotal: 8,
        paymentsTotal: 10,
      },
    ],
    totals: {
      totalClubs: 3,
      totalMembership: 48,
      totalPayments: 58,
      distinguishedClubs: 1,
      selectDistinguishedClubs: 0,
      presidentDistinguishedClubs: 0,
    },
  }
}

/**
 * Write a district snapshot to the test cache
 */
async function writeDistrictSnapshot(
  cacheDir: string,
  date: string,
  districtId: string,
  stats: DistrictStatistics
): Promise<void> {
  const snapshotDir = path.join(cacheDir, 'snapshots', date)
  await fs.mkdir(snapshotDir, { recursive: true })

  const snapshotPath = path.join(snapshotDir, `district_${districtId}.json`)
  await fs.writeFile(snapshotPath, JSON.stringify(stats, null, 2), 'utf-8')
}

describe('AnalyticsComputeService', () => {
  let testCache: { path: string; cleanup: () => Promise<void> }
  let analyticsComputeService: AnalyticsComputeService

  beforeEach(async () => {
    testCache = createIsolatedCacheDir()
    await fs.mkdir(testCache.path, { recursive: true })

    analyticsComputeService = new AnalyticsComputeService({
      cacheDir: testCache.path,
    })
  })

  afterEach(async () => {
    await testCache.cleanup()
  })

  describe('getAnalyticsDir', () => {
    it('should return correct analytics directory path', () => {
      const date = '2024-01-15'
      const analyticsDir = analyticsComputeService.getAnalyticsDir(date)

      expect(analyticsDir).toBe(
        path.join(testCache.path, 'snapshots', date, 'analytics')
      )
    })
  })

  describe('snapshotExists', () => {
    it('should return false when snapshot directory does not exist', async () => {
      const exists = await analyticsComputeService.snapshotExists('2024-01-15')
      expect(exists).toBe(false)
    })

    it('should return true when snapshot directory exists', async () => {
      const date = '2024-01-15'
      const snapshotDir = path.join(testCache.path, 'snapshots', date)
      await fs.mkdir(snapshotDir, { recursive: true })

      const exists = await analyticsComputeService.snapshotExists(date)
      expect(exists).toBe(true)
    })
  })

  describe('analyticsExist', () => {
    it('should return false when analytics do not exist', async () => {
      const exists = await analyticsComputeService.analyticsExist(
        '2024-01-15',
        '1'
      )
      expect(exists).toBe(false)
    })

    it('should return true when analytics exist', async () => {
      const date = '2024-01-15'
      const districtId = '1'
      const analyticsDir = path.join(
        testCache.path,
        'snapshots',
        date,
        'analytics'
      )
      await fs.mkdir(analyticsDir, { recursive: true })
      await fs.writeFile(
        path.join(analyticsDir, `district_${districtId}_analytics.json`),
        '{}'
      )

      const exists = await analyticsComputeService.analyticsExist(
        date,
        districtId
      )
      expect(exists).toBe(true)
    })
  })

  describe('loadDistrictSnapshot', () => {
    it('should return null when snapshot does not exist', async () => {
      const snapshot = await analyticsComputeService.loadDistrictSnapshot(
        '2024-01-15',
        '1'
      )
      expect(snapshot).toBeNull()
    })

    it('should load snapshot when it exists', async () => {
      const date = '2024-01-15'
      const districtId = '1'
      const stats = createSampleDistrictStatistics(districtId, date)

      await writeDistrictSnapshot(testCache.path, date, districtId, stats)

      const snapshot = await analyticsComputeService.loadDistrictSnapshot(
        date,
        districtId
      )
      expect(snapshot).toEqual(stats)
    })
  })

  describe('discoverAvailableDistricts', () => {
    it('should return empty array when snapshot directory does not exist', async () => {
      const districts =
        await analyticsComputeService.discoverAvailableDistricts('2024-01-15')
      expect(districts).toEqual([])
    })

    it('should discover districts from snapshot files', async () => {
      const date = '2024-01-15'

      // Write multiple district snapshots
      await writeDistrictSnapshot(
        testCache.path,
        date,
        '1',
        createSampleDistrictStatistics('1', date)
      )
      await writeDistrictSnapshot(
        testCache.path,
        date,
        '2',
        createSampleDistrictStatistics('2', date)
      )
      await writeDistrictSnapshot(
        testCache.path,
        date,
        '10',
        createSampleDistrictStatistics('10', date)
      )

      const districts =
        await analyticsComputeService.discoverAvailableDistricts(date)

      // Should be sorted numerically
      expect(districts).toEqual(['1', '2', '10'])
    })

    it('should handle non-numeric district IDs', async () => {
      const date = '2024-01-15'

      await writeDistrictSnapshot(
        testCache.path,
        date,
        'F',
        createSampleDistrictStatistics('F', date)
      )
      await writeDistrictSnapshot(
        testCache.path,
        date,
        '1',
        createSampleDistrictStatistics('1', date)
      )

      const districts =
        await analyticsComputeService.discoverAvailableDistricts(date)

      // Numeric first, then alphabetic
      expect(districts).toEqual(['1', 'F'])
    })

    it('should ignore non-district files', async () => {
      const date = '2024-01-15'
      const snapshotDir = path.join(testCache.path, 'snapshots', date)
      await fs.mkdir(snapshotDir, { recursive: true })

      // Write district file
      await writeDistrictSnapshot(
        testCache.path,
        date,
        '1',
        createSampleDistrictStatistics('1', date)
      )

      // Write non-district files
      await fs.writeFile(
        path.join(snapshotDir, 'metadata.json'),
        '{}'
      )
      await fs.writeFile(
        path.join(snapshotDir, 'manifest.json'),
        '{}'
      )

      const districts =
        await analyticsComputeService.discoverAvailableDistricts(date)

      expect(districts).toEqual(['1'])
    })
  })

  describe('computeDistrictAnalytics', () => {
    it('should compute analytics for a district', async () => {
      const date = '2024-01-15'
      const districtId = '1'
      const stats = createSampleDistrictStatistics(districtId, date)

      await writeDistrictSnapshot(testCache.path, date, districtId, stats)

      const result = await analyticsComputeService.computeDistrictAnalytics(
        date,
        districtId
      )

      expect(result.success).toBe(true)
      expect(result.districtId).toBe(districtId)
      expect(result.analyticsPath).toBeDefined()
      expect(result.membershipPath).toBeDefined()
      expect(result.clubHealthPath).toBeDefined()
      expect(result.skipped).toBeUndefined()
    })

    it('should write analytics files with correct structure', async () => {
      const date = '2024-01-15'
      const districtId = '1'
      const stats = createSampleDistrictStatistics(districtId, date)

      await writeDistrictSnapshot(testCache.path, date, districtId, stats)

      const result = await analyticsComputeService.computeDistrictAnalytics(
        date,
        districtId
      )

      // Verify analytics file
      const analyticsContent = await fs.readFile(
        result.analyticsPath!,
        'utf-8'
      )
      const analytics = JSON.parse(
        analyticsContent
      ) as PreComputedAnalyticsFile<DistrictAnalytics>

      expect(analytics.metadata.schemaVersion).toBe(ANALYTICS_SCHEMA_VERSION)
      expect(analytics.metadata.snapshotDate).toBe(date)
      expect(analytics.metadata.districtId).toBe(districtId)
      expect(analytics.data.districtId).toBe(districtId)
      expect(analytics.data.totalMembership).toBe(48)
    })

    it('should write membership trends file', async () => {
      const date = '2024-01-15'
      const districtId = '1'
      const stats = createSampleDistrictStatistics(districtId, date)

      await writeDistrictSnapshot(testCache.path, date, districtId, stats)

      const result = await analyticsComputeService.computeDistrictAnalytics(
        date,
        districtId
      )

      const membershipContent = await fs.readFile(
        result.membershipPath!,
        'utf-8'
      )
      const membership = JSON.parse(
        membershipContent
      ) as PreComputedAnalyticsFile<MembershipTrendData>

      expect(membership.metadata.schemaVersion).toBe(ANALYTICS_SCHEMA_VERSION)
      expect(membership.data.membershipTrend).toBeDefined()
      expect(membership.data.paymentsTrend).toBeDefined()
    })

    it('should write club health file', async () => {
      const date = '2024-01-15'
      const districtId = '1'
      const stats = createSampleDistrictStatistics(districtId, date)

      await writeDistrictSnapshot(testCache.path, date, districtId, stats)

      const result = await analyticsComputeService.computeDistrictAnalytics(
        date,
        districtId
      )

      const healthContent = await fs.readFile(
        result.clubHealthPath!,
        'utf-8'
      )
      const health = JSON.parse(
        healthContent
      ) as PreComputedAnalyticsFile<ClubHealthData>

      expect(health.metadata.schemaVersion).toBe(ANALYTICS_SCHEMA_VERSION)
      expect(health.data.allClubs).toBeDefined()
      expect(health.data.thrivingClubs).toBeDefined()
      expect(health.data.vulnerableClubs).toBeDefined()
      expect(health.data.interventionRequiredClubs).toBeDefined()
    })

    it('should skip computation when analytics exist and force is false', async () => {
      const date = '2024-01-15'
      const districtId = '1'
      const stats = createSampleDistrictStatistics(districtId, date)

      await writeDistrictSnapshot(testCache.path, date, districtId, stats)

      // First computation
      await analyticsComputeService.computeDistrictAnalytics(date, districtId)

      // Second computation without force
      const result = await analyticsComputeService.computeDistrictAnalytics(
        date,
        districtId,
        { force: false }
      )

      expect(result.success).toBe(true)
      expect(result.skipped).toBe(true)
    })

    it('should recompute when force is true', async () => {
      const date = '2024-01-15'
      const districtId = '1'
      const stats = createSampleDistrictStatistics(districtId, date)

      await writeDistrictSnapshot(testCache.path, date, districtId, stats)

      // First computation
      await analyticsComputeService.computeDistrictAnalytics(date, districtId)

      // Second computation with force
      const result = await analyticsComputeService.computeDistrictAnalytics(
        date,
        districtId,
        { force: true }
      )

      expect(result.success).toBe(true)
      expect(result.skipped).toBeUndefined()
      expect(result.analyticsPath).toBeDefined()
    })

    it('should return error when snapshot does not exist', async () => {
      const result = await analyticsComputeService.computeDistrictAnalytics(
        '2024-01-15',
        '999'
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('Snapshot not found')
    })
  })

  describe('compute', () => {
    it('should compute analytics for all available districts', async () => {
      const date = '2024-01-15'

      // Write multiple district snapshots
      await writeDistrictSnapshot(
        testCache.path,
        date,
        '1',
        createSampleDistrictStatistics('1', date)
      )
      await writeDistrictSnapshot(
        testCache.path,
        date,
        '2',
        createSampleDistrictStatistics('2', date)
      )

      const result = await analyticsComputeService.compute({
        date,
      })

      expect(result.success).toBe(true)
      expect(result.districtsProcessed).toEqual(['1', '2'])
      expect(result.districtsSucceeded).toEqual(['1', '2'])
      expect(result.districtsFailed).toEqual([])
      expect(result.analyticsLocations.length).toBeGreaterThan(0)
    })

    it('should compute analytics for specific districts only', async () => {
      const date = '2024-01-15'

      // Write multiple district snapshots
      await writeDistrictSnapshot(
        testCache.path,
        date,
        '1',
        createSampleDistrictStatistics('1', date)
      )
      await writeDistrictSnapshot(
        testCache.path,
        date,
        '2',
        createSampleDistrictStatistics('2', date)
      )
      await writeDistrictSnapshot(
        testCache.path,
        date,
        '3',
        createSampleDistrictStatistics('3', date)
      )

      const result = await analyticsComputeService.compute({
        date,
        districts: ['1', '3'],
      })

      expect(result.success).toBe(true)
      expect(result.districtsProcessed).toEqual(['1', '3'])
      expect(result.districtsSucceeded).toEqual(['1', '3'])
    })

    it('should return error when snapshot does not exist for date', async () => {
      const result = await analyticsComputeService.compute({
        date: '2024-01-15',
      })

      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0]?.error).toContain('Snapshot not found')
    })

    it('should write analytics manifest', async () => {
      const date = '2024-01-15'

      await writeDistrictSnapshot(
        testCache.path,
        date,
        '1',
        createSampleDistrictStatistics('1', date)
      )

      await analyticsComputeService.compute({ date })

      const manifestPath = path.join(
        testCache.path,
        'snapshots',
        date,
        'analytics',
        'manifest.json'
      )
      const manifestContent = await fs.readFile(manifestPath, 'utf-8')
      const manifest = JSON.parse(manifestContent) as AnalyticsManifest

      expect(manifest.snapshotDate).toBe(date)
      expect(manifest.schemaVersion).toBe(ANALYTICS_SCHEMA_VERSION)
      expect(manifest.files.length).toBeGreaterThan(0)
      expect(manifest.totalFiles).toBe(manifest.files.length)
    })

    it('should continue processing when one district fails (Requirement 1.5)', async () => {
      const date = '2024-01-15'

      // Write valid snapshot for district 1
      await writeDistrictSnapshot(
        testCache.path,
        date,
        '1',
        createSampleDistrictStatistics('1', date)
      )

      // Write invalid snapshot for district 2 (invalid JSON)
      const snapshotDir = path.join(testCache.path, 'snapshots', date)
      await fs.writeFile(
        path.join(snapshotDir, 'district_2.json'),
        'invalid json'
      )

      const result = await analyticsComputeService.compute({
        date,
      })

      // Should have partial success
      expect(result.districtsSucceeded).toContain('1')
      expect(result.districtsFailed).toContain('2')
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should skip districts with existing analytics when force is false', async () => {
      const date = '2024-01-15'

      await writeDistrictSnapshot(
        testCache.path,
        date,
        '1',
        createSampleDistrictStatistics('1', date)
      )
      await writeDistrictSnapshot(
        testCache.path,
        date,
        '2',
        createSampleDistrictStatistics('2', date)
      )

      // First computation
      await analyticsComputeService.compute({ date })

      // Second computation without force
      const result = await analyticsComputeService.compute({
        date,
        force: false,
      })

      expect(result.success).toBe(true)
      expect(result.districtsSkipped).toEqual(['1', '2'])
      expect(result.districtsSucceeded).toEqual([])
    })

    it('should recompute all districts when force is true', async () => {
      const date = '2024-01-15'

      await writeDistrictSnapshot(
        testCache.path,
        date,
        '1',
        createSampleDistrictStatistics('1', date)
      )

      // First computation
      await analyticsComputeService.compute({ date })

      // Second computation with force
      const result = await analyticsComputeService.compute({
        date,
        force: true,
      })

      expect(result.success).toBe(true)
      expect(result.districtsSucceeded).toEqual(['1'])
      expect(result.districtsSkipped).toEqual([])
    })

    it('should include duration_ms in result', async () => {
      const date = '2024-01-15'

      await writeDistrictSnapshot(
        testCache.path,
        date,
        '1',
        createSampleDistrictStatistics('1', date)
      )

      const result = await analyticsComputeService.compute({ date })

      expect(result.duration_ms).toBeGreaterThanOrEqual(0)
    })
  })

  describe('analytics file structure (Requirements 1.2, 1.3)', () => {
    it('should generate all required analytics types', async () => {
      const date = '2024-01-15'
      const districtId = '1'

      await writeDistrictSnapshot(
        testCache.path,
        date,
        districtId,
        createSampleDistrictStatistics(districtId, date)
      )

      await analyticsComputeService.compute({ date })

      const analyticsDir = path.join(
        testCache.path,
        'snapshots',
        date,
        'analytics'
      )
      const files = await fs.readdir(analyticsDir)

      // Should have all three analytics files plus manifest
      expect(files).toContain(`district_${districtId}_analytics.json`)
      expect(files).toContain(`district_${districtId}_membership.json`)
      expect(files).toContain(`district_${districtId}_clubhealth.json`)
      expect(files).toContain('manifest.json')
    })

    it('should include membership trends in analytics', async () => {
      const date = '2024-01-15'
      const districtId = '1'

      await writeDistrictSnapshot(
        testCache.path,
        date,
        districtId,
        createSampleDistrictStatistics(districtId, date)
      )

      await analyticsComputeService.compute({ date })

      const analyticsPath = path.join(
        testCache.path,
        'snapshots',
        date,
        'analytics',
        `district_${districtId}_analytics.json`
      )
      const content = await fs.readFile(analyticsPath, 'utf-8')
      const analytics = JSON.parse(
        content
      ) as PreComputedAnalyticsFile<DistrictAnalytics>

      expect(analytics.data.membershipTrend).toBeDefined()
      expect(Array.isArray(analytics.data.membershipTrend)).toBe(true)
    })

    it('should include club health data in analytics', async () => {
      const date = '2024-01-15'
      const districtId = '1'

      await writeDistrictSnapshot(
        testCache.path,
        date,
        districtId,
        createSampleDistrictStatistics(districtId, date)
      )

      await analyticsComputeService.compute({ date })

      const analyticsPath = path.join(
        testCache.path,
        'snapshots',
        date,
        'analytics',
        `district_${districtId}_analytics.json`
      )
      const content = await fs.readFile(analyticsPath, 'utf-8')
      const analytics = JSON.parse(
        content
      ) as PreComputedAnalyticsFile<DistrictAnalytics>

      expect(analytics.data.allClubs).toBeDefined()
      expect(analytics.data.vulnerableClubs).toBeDefined()
      expect(analytics.data.thrivingClubs).toBeDefined()
      expect(analytics.data.interventionRequiredClubs).toBeDefined()
    })

    it('should include distinguished club data in analytics', async () => {
      const date = '2024-01-15'
      const districtId = '1'

      await writeDistrictSnapshot(
        testCache.path,
        date,
        districtId,
        createSampleDistrictStatistics(districtId, date)
      )

      await analyticsComputeService.compute({ date })

      const analyticsPath = path.join(
        testCache.path,
        'snapshots',
        date,
        'analytics',
        `district_${districtId}_analytics.json`
      )
      const content = await fs.readFile(analyticsPath, 'utf-8')
      const analytics = JSON.parse(
        content
      ) as PreComputedAnalyticsFile<DistrictAnalytics>

      expect(analytics.data.distinguishedClubs).toBeDefined()
      expect(analytics.data.distinguishedProjection).toBeDefined()
    })

    it('should include division/area rankings in analytics', async () => {
      const date = '2024-01-15'
      const districtId = '1'

      await writeDistrictSnapshot(
        testCache.path,
        date,
        districtId,
        createSampleDistrictStatistics(districtId, date)
      )

      await analyticsComputeService.compute({ date })

      const analyticsPath = path.join(
        testCache.path,
        'snapshots',
        date,
        'analytics',
        `district_${districtId}_analytics.json`
      )
      const content = await fs.readFile(analyticsPath, 'utf-8')
      const analytics = JSON.parse(
        content
      ) as PreComputedAnalyticsFile<DistrictAnalytics>

      expect(analytics.data.divisionRankings).toBeDefined()
      expect(analytics.data.topPerformingAreas).toBeDefined()
    })
  })

  describe('incremental update logic (Requirements 5.1-5.5)', () => {
    it('should store source snapshot checksum in analytics metadata (Requirement 5.4)', async () => {
      const date = '2024-01-15'
      const districtId = '1'
      const stats = createSampleDistrictStatistics(districtId, date)

      await writeDistrictSnapshot(testCache.path, date, districtId, stats)

      await analyticsComputeService.computeDistrictAnalytics(date, districtId)

      const analyticsPath = path.join(
        testCache.path,
        'snapshots',
        date,
        'analytics',
        `district_${districtId}_analytics.json`
      )
      const content = await fs.readFile(analyticsPath, 'utf-8')
      const analytics = JSON.parse(content) as PreComputedAnalyticsFile<DistrictAnalytics>

      // Requirement 5.4: Source snapshot checksum should be stored
      expect(analytics.metadata.sourceSnapshotChecksum).toBeDefined()
      expect(analytics.metadata.sourceSnapshotChecksum).toMatch(/^[a-f0-9]{64}$/)
    })

    it('should skip computation when snapshot checksum is unchanged (Requirement 5.3)', async () => {
      const date = '2024-01-15'
      const districtId = '1'
      const stats = createSampleDistrictStatistics(districtId, date)

      await writeDistrictSnapshot(testCache.path, date, districtId, stats)

      // First computation
      await analyticsComputeService.computeDistrictAnalytics(date, districtId)

      // Second computation - snapshot unchanged
      const result = await analyticsComputeService.computeDistrictAnalytics(
        date,
        districtId,
        { force: false }
      )

      expect(result.success).toBe(true)
      expect(result.skipped).toBe(true)
    })

    it('should recompute when snapshot checksum changes (Requirement 5.2)', async () => {
      const date = '2024-01-15'
      const districtId = '1'
      const stats = createSampleDistrictStatistics(districtId, date)

      await writeDistrictSnapshot(testCache.path, date, districtId, stats)

      // First computation
      const firstResult = await analyticsComputeService.computeDistrictAnalytics(
        date,
        districtId
      )
      expect(firstResult.success).toBe(true)
      expect(firstResult.skipped).toBeUndefined()

      // Get the original checksum
      const analyticsPath = path.join(
        testCache.path,
        'snapshots',
        date,
        'analytics',
        `district_${districtId}_analytics.json`
      )
      const originalContent = await fs.readFile(analyticsPath, 'utf-8')
      const originalAnalytics = JSON.parse(originalContent) as PreComputedAnalyticsFile<DistrictAnalytics>
      const originalChecksum = originalAnalytics.metadata.sourceSnapshotChecksum

      // Modify the snapshot (change membership count)
      const modifiedStats = {
        ...stats,
        totals: {
          ...stats.totals,
          totalMembership: 100, // Changed from 48
        },
      }
      await writeDistrictSnapshot(testCache.path, date, districtId, modifiedStats)

      // Second computation - snapshot changed, should recompute
      const secondResult = await analyticsComputeService.computeDistrictAnalytics(
        date,
        districtId,
        { force: false }
      )

      expect(secondResult.success).toBe(true)
      expect(secondResult.skipped).toBeUndefined() // Should NOT be skipped

      // Verify the checksum was updated
      const newContent = await fs.readFile(analyticsPath, 'utf-8')
      const newAnalytics = JSON.parse(newContent) as PreComputedAnalyticsFile<DistrictAnalytics>
      expect(newAnalytics.metadata.sourceSnapshotChecksum).not.toBe(originalChecksum)
    })

    it('should bypass checksum comparison with --force-analytics (Requirement 5.5)', async () => {
      const date = '2024-01-15'
      const districtId = '1'
      const stats = createSampleDistrictStatistics(districtId, date)

      await writeDistrictSnapshot(testCache.path, date, districtId, stats)

      // First computation
      await analyticsComputeService.computeDistrictAnalytics(date, districtId)

      // Get the original computedAt timestamp
      const analyticsPath = path.join(
        testCache.path,
        'snapshots',
        date,
        'analytics',
        `district_${districtId}_analytics.json`
      )
      const originalContent = await fs.readFile(analyticsPath, 'utf-8')
      const originalAnalytics = JSON.parse(originalContent) as PreComputedAnalyticsFile<DistrictAnalytics>
      const originalComputedAt = originalAnalytics.metadata.computedAt

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10))

      // Second computation with force - should recompute even though snapshot unchanged
      const result = await analyticsComputeService.computeDistrictAnalytics(
        date,
        districtId,
        { force: true }
      )

      expect(result.success).toBe(true)
      expect(result.skipped).toBeUndefined()

      // Verify the file was rewritten (computedAt should be different)
      const newContent = await fs.readFile(analyticsPath, 'utf-8')
      const newAnalytics = JSON.parse(newContent) as PreComputedAnalyticsFile<DistrictAnalytics>
      expect(newAnalytics.metadata.computedAt).not.toBe(originalComputedAt)
    })

    it('should calculate correct snapshot checksum (Requirement 5.1)', async () => {
      const date = '2024-01-15'
      const districtId = '1'
      const stats = createSampleDistrictStatistics(districtId, date)

      await writeDistrictSnapshot(testCache.path, date, districtId, stats)

      // Calculate expected checksum manually
      const snapshotPath = path.join(
        testCache.path,
        'snapshots',
        date,
        `district_${districtId}.json`
      )
      const snapshotContent = await fs.readFile(snapshotPath, 'utf-8')
      const crypto = await import('crypto')
      const expectedChecksum = crypto.createHash('sha256').update(snapshotContent).digest('hex')

      // Compute analytics
      await analyticsComputeService.computeDistrictAnalytics(date, districtId)

      // Verify stored checksum matches
      const analyticsPath = path.join(
        testCache.path,
        'snapshots',
        date,
        'analytics',
        `district_${districtId}_analytics.json`
      )
      const analyticsContent = await fs.readFile(analyticsPath, 'utf-8')
      const analytics = JSON.parse(analyticsContent) as PreComputedAnalyticsFile<DistrictAnalytics>

      expect(analytics.metadata.sourceSnapshotChecksum).toBe(expectedChecksum)
    })

    it('should recompute legacy analytics without sourceSnapshotChecksum', async () => {
      const date = '2024-01-15'
      const districtId = '1'
      const stats = createSampleDistrictStatistics(districtId, date)

      await writeDistrictSnapshot(testCache.path, date, districtId, stats)

      // Create legacy analytics file without sourceSnapshotChecksum
      const analyticsDir = path.join(
        testCache.path,
        'snapshots',
        date,
        'analytics'
      )
      await fs.mkdir(analyticsDir, { recursive: true })

      const legacyAnalytics = {
        metadata: {
          schemaVersion: '1.0.0',
          computedAt: new Date().toISOString(),
          snapshotDate: date,
          districtId,
          checksum: 'abc123',
          // Note: no sourceSnapshotChecksum
        },
        data: {
          districtId,
          dateRange: { start: date, end: date },
          totalMembership: 0,
          membershipChange: 0,
          membershipTrend: [],
          allClubs: [],
          vulnerableClubs: [],
          thrivingClubs: [],
          interventionRequiredClubs: [],
          distinguishedClubs: [],
          distinguishedProjection: {
            projectedDistinguished: 0,
            projectedSelect: 0,
            projectedPresident: 0,
            currentDistinguished: 0,
            currentSelect: 0,
            currentPresident: 0,
            projectionDate: date,
          },
          divisionRankings: [],
          topPerformingAreas: [],
        },
      }

      await fs.writeFile(
        path.join(analyticsDir, `district_${districtId}_analytics.json`),
        JSON.stringify(legacyAnalytics, null, 2)
      )

      // Compute analytics - should recompute because no stored checksum
      const result = await analyticsComputeService.computeDistrictAnalytics(
        date,
        districtId,
        { force: false }
      )

      expect(result.success).toBe(true)
      expect(result.skipped).toBeUndefined() // Should NOT be skipped

      // Verify the new analytics has sourceSnapshotChecksum
      const analyticsPath = path.join(analyticsDir, `district_${districtId}_analytics.json`)
      const newContent = await fs.readFile(analyticsPath, 'utf-8')
      const newAnalytics = JSON.parse(newContent) as PreComputedAnalyticsFile<DistrictAnalytics>

      expect(newAnalytics.metadata.sourceSnapshotChecksum).toBeDefined()
      expect(newAnalytics.metadata.sourceSnapshotChecksum).toMatch(/^[a-f0-9]{64}$/)
    })

    it('should store same checksum in all analytics files for a district', async () => {
      const date = '2024-01-15'
      const districtId = '1'
      const stats = createSampleDistrictStatistics(districtId, date)

      await writeDistrictSnapshot(testCache.path, date, districtId, stats)

      await analyticsComputeService.computeDistrictAnalytics(date, districtId)

      const analyticsDir = path.join(
        testCache.path,
        'snapshots',
        date,
        'analytics'
      )

      // Read all three analytics files
      const analyticsContent = await fs.readFile(
        path.join(analyticsDir, `district_${districtId}_analytics.json`),
        'utf-8'
      )
      const membershipContent = await fs.readFile(
        path.join(analyticsDir, `district_${districtId}_membership.json`),
        'utf-8'
      )
      const clubHealthContent = await fs.readFile(
        path.join(analyticsDir, `district_${districtId}_clubhealth.json`),
        'utf-8'
      )

      const analytics = JSON.parse(analyticsContent) as PreComputedAnalyticsFile<unknown>
      const membership = JSON.parse(membershipContent) as PreComputedAnalyticsFile<unknown>
      const clubHealth = JSON.parse(clubHealthContent) as PreComputedAnalyticsFile<unknown>

      // All should have the same sourceSnapshotChecksum
      expect(analytics.metadata.sourceSnapshotChecksum).toBeDefined()
      expect(membership.metadata.sourceSnapshotChecksum).toBe(
        analytics.metadata.sourceSnapshotChecksum
      )
      expect(clubHealth.metadata.sourceSnapshotChecksum).toBe(
        analytics.metadata.sourceSnapshotChecksum
      )
    })
  })
})
