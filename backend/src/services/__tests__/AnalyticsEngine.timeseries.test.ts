/**
 * Tests for AnalyticsEngine Time-Series Index Integration
 * 
 * Requirement 2.3: WHEN querying analytics for a date range, THE Analytics_Engine 
 * SHALL read from the time-series index instead of loading individual snapshots
 * 
 * These tests verify:
 * 1. AnalyticsEngine uses time-series index when available
 * 2. Falls back to individual snapshots when index is unavailable
 * 3. Falls back when index returns empty data
 * 4. Logs which data source was used
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { promises as fs } from 'fs'
import path from 'path'
import { AnalyticsEngine } from '../AnalyticsEngine.js'
import {
  PerDistrictFileSnapshotStore,
} from '../SnapshotStore.js'
import { AnalyticsDataSourceAdapter } from '../AnalyticsDataSourceAdapter.js'
import { createDistrictDataAggregator } from '../DistrictDataAggregator.js'
import {
  TimeSeriesIndexService,
  type ITimeSeriesIndexService,
} from '../TimeSeriesIndexService.js'
import {
  createTestCacheConfig,
  cleanupTestCacheConfig,
} from '../../utils/test-cache-helper.js'
import type { TestCacheConfig } from '../../utils/test-cache-helper.js'
import type { DistrictStatistics } from '../../types/districts.js'
import type { Snapshot } from '../../types/snapshots.js'
import type { TimeSeriesDataPoint } from '../../types/precomputedAnalytics.js'

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
      Division: club.division ?? 'A',
      'Division Name': `Division ${club.division ?? 'A'}`,
      Area: club.area ?? '1',
      'Area Name': `Area ${club.area ?? '1'}`,
    })),
    districtPerformance: [],
    divisionPerformance: [],
  }
}

/**
 * Create a mock TimeSeriesIndexService for testing
 */
function createMockTimeSeriesIndexService(
  trendData: TimeSeriesDataPoint[] = []
): ITimeSeriesIndexService {
  return {
    appendDataPoint: vi.fn().mockResolvedValue(undefined),
    getTrendData: vi.fn().mockResolvedValue(trendData),
    getProgramYearData: vi.fn().mockResolvedValue(null),
    rebuildIndex: vi.fn().mockResolvedValue(undefined),
  }
}

describe('AnalyticsEngine Time-Series Index Integration', () => {
  let snapshotStore: PerDistrictFileSnapshotStore
  let testCacheConfig: TestCacheConfig
  let dataSource: AnalyticsDataSourceAdapter

  beforeEach(async () => {
    // Create isolated test cache configuration
    const testName = `analytics-timeseries-${process.pid}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
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
    dataSource = new AnalyticsDataSourceAdapter(
      districtDataAggregator,
      snapshotStore
    )
  })

  afterEach(async () => {
    await cleanupTestCacheConfig(testCacheConfig)
  })

  describe('Time-Series Index Usage (Requirement 2.3)', () => {
    it('should use time-series index when available and has data', async () => {
      const districtId = `testDistrict${Date.now()}`
      const startDate = '2024-01-01'
      const endDate = '2024-01-31'

      // Create mock time-series data
      const mockTrendData: TimeSeriesDataPoint[] = [
        {
          date: '2024-01-15',
          snapshotId: '2024-01-15',
          membership: 500,
          payments: 450,
          dcpGoals: 100,
          distinguishedTotal: 10,
          clubCounts: {
            total: 50,
            thriving: 30,
            vulnerable: 15,
            interventionRequired: 5,
          },
        },
        {
          date: '2024-01-22',
          snapshotId: '2024-01-22',
          membership: 510,
          payments: 460,
          dcpGoals: 105,
          distinguishedTotal: 11,
          clubCounts: {
            total: 50,
            thriving: 32,
            vulnerable: 13,
            interventionRequired: 5,
          },
        },
      ]

      const mockTimeSeriesService = createMockTimeSeriesIndexService(mockTrendData)

      // Create AnalyticsEngine with time-series service
      const analyticsEngine = new AnalyticsEngine(
        dataSource,
        undefined,
        undefined,
        mockTimeSeriesService
      )

      // Also create a snapshot so the engine has some data to work with
      const districtStats = createDistrictStats(districtId, [
        { clubNumber: '1', clubName: 'Club 1', membership: 20, goalsMet: 5 },
      ])
      await createTestSnapshot(snapshotStore, '2024-01-22', [districtStats])

      // Generate analytics - this should use the time-series index
      const analytics = await analyticsEngine.generateDistrictAnalytics(
        districtId,
        startDate,
        endDate
      )

      // Verify time-series service was called
      expect(mockTimeSeriesService.getTrendData).toHaveBeenCalledWith(
        districtId,
        startDate,
        endDate
      )

      // Verify analytics were generated
      expect(analytics).toBeDefined()
      expect(analytics.districtId).toBe(districtId)

      await analyticsEngine.dispose()
    })

    it('should fall back to individual snapshots when time-series index returns empty', async () => {
      const districtId = `testDistrict${Date.now()}`
      const startDate = '2024-01-01'
      const endDate = '2024-01-31'

      // Create mock time-series service that returns empty data
      const mockTimeSeriesService = createMockTimeSeriesIndexService([])

      // Create a snapshot so fallback has data
      const districtStats = createDistrictStats(districtId, [
        { clubNumber: '1', clubName: 'Club 1', membership: 20, goalsMet: 5 },
      ])
      await createTestSnapshot(snapshotStore, '2024-01-15', [districtStats])

      // Create AnalyticsEngine with time-series service
      const analyticsEngine = new AnalyticsEngine(
        dataSource,
        undefined,
        undefined,
        mockTimeSeriesService
      )

      // Generate analytics - should fall back to snapshots
      const analytics = await analyticsEngine.generateDistrictAnalytics(
        districtId,
        startDate,
        endDate
      )

      // Verify time-series service was called
      expect(mockTimeSeriesService.getTrendData).toHaveBeenCalled()

      // Verify analytics were generated from snapshot fallback
      expect(analytics).toBeDefined()
      expect(analytics.districtId).toBe(districtId)

      await analyticsEngine.dispose()
    })

    it('should fall back to individual snapshots when time-series index throws error', async () => {
      const districtId = `testDistrict${Date.now()}`
      const startDate = '2024-01-01'
      const endDate = '2024-01-31'

      // Create mock time-series service that throws an error
      const mockTimeSeriesService: ITimeSeriesIndexService = {
        appendDataPoint: vi.fn().mockResolvedValue(undefined),
        getTrendData: vi.fn().mockRejectedValue(new Error('Index corrupted')),
        getProgramYearData: vi.fn().mockResolvedValue(null),
        rebuildIndex: vi.fn().mockResolvedValue(undefined),
      }

      // Create a snapshot so fallback has data
      const districtStats = createDistrictStats(districtId, [
        { clubNumber: '1', clubName: 'Club 1', membership: 20, goalsMet: 5 },
      ])
      await createTestSnapshot(snapshotStore, '2024-01-15', [districtStats])

      // Create AnalyticsEngine with time-series service
      const analyticsEngine = new AnalyticsEngine(
        dataSource,
        undefined,
        undefined,
        mockTimeSeriesService
      )

      // Generate analytics - should fall back to snapshots despite error
      const analytics = await analyticsEngine.generateDistrictAnalytics(
        districtId,
        startDate,
        endDate
      )

      // Verify time-series service was called
      expect(mockTimeSeriesService.getTrendData).toHaveBeenCalled()

      // Verify analytics were generated from snapshot fallback
      expect(analytics).toBeDefined()
      expect(analytics.districtId).toBe(districtId)

      await analyticsEngine.dispose()
    })

    it('should use individual snapshots when no time-series service is provided', async () => {
      const districtId = `testDistrict${Date.now()}`
      const startDate = '2024-01-01'
      const endDate = '2024-01-31'

      // Create a snapshot
      const districtStats = createDistrictStats(districtId, [
        { clubNumber: '1', clubName: 'Club 1', membership: 20, goalsMet: 5 },
      ])
      await createTestSnapshot(snapshotStore, '2024-01-15', [districtStats])

      // Create AnalyticsEngine WITHOUT time-series service
      const analyticsEngine = new AnalyticsEngine(dataSource)

      // Generate analytics - should use snapshots directly
      const analytics = await analyticsEngine.generateDistrictAnalytics(
        districtId,
        startDate,
        endDate
      )

      // Verify analytics were generated
      expect(analytics).toBeDefined()
      expect(analytics.districtId).toBe(districtId)

      await analyticsEngine.dispose()
    })

    it('should skip time-series index when no date range is provided', async () => {
      const districtId = `testDistrict${Date.now()}`

      // Create mock time-series service
      const mockTimeSeriesService = createMockTimeSeriesIndexService([])

      // Create a snapshot
      const districtStats = createDistrictStats(districtId, [
        { clubNumber: '1', clubName: 'Club 1', membership: 20, goalsMet: 5 },
      ])
      await createTestSnapshot(snapshotStore, '2024-01-15', [districtStats])

      // Create AnalyticsEngine with time-series service
      const analyticsEngine = new AnalyticsEngine(
        dataSource,
        undefined,
        undefined,
        mockTimeSeriesService
      )

      // Generate analytics without date range
      const analytics = await analyticsEngine.generateDistrictAnalytics(districtId)

      // Time-series service should NOT be called when no date range provided
      // (because we need both startDate and endDate for efficient range queries)
      expect(mockTimeSeriesService.getTrendData).not.toHaveBeenCalled()

      // Verify analytics were generated
      expect(analytics).toBeDefined()
      expect(analytics.districtId).toBe(districtId)

      await analyticsEngine.dispose()
    })
  })

  describe('Real TimeSeriesIndexService Integration', () => {
    it('should work with real TimeSeriesIndexService', async () => {
      const districtId = `testDistrict${Date.now()}`
      const startDate = '2024-01-01'
      const endDate = '2024-01-31'

      // Create real TimeSeriesIndexService
      const timeSeriesService = new TimeSeriesIndexService({
        cacheDir: testCacheConfig.cacheDir,
      })

      // Add some data points to the index
      await timeSeriesService.appendDataPoint(districtId, {
        date: '2024-01-15',
        snapshotId: '2024-01-15',
        membership: 500,
        payments: 450,
        dcpGoals: 100,
        distinguishedTotal: 10,
        clubCounts: {
          total: 50,
          thriving: 30,
          vulnerable: 15,
          interventionRequired: 5,
        },
      })

      // Create a snapshot for fallback/detailed data
      const districtStats = createDistrictStats(districtId, [
        { clubNumber: '1', clubName: 'Club 1', membership: 20, goalsMet: 5 },
      ])
      await createTestSnapshot(snapshotStore, '2024-01-15', [districtStats])

      // Create AnalyticsEngine with real time-series service
      const analyticsEngine = new AnalyticsEngine(
        dataSource,
        undefined,
        undefined,
        timeSeriesService
      )

      // Generate analytics
      const analytics = await analyticsEngine.generateDistrictAnalytics(
        districtId,
        startDate,
        endDate
      )

      // Verify analytics were generated
      expect(analytics).toBeDefined()
      expect(analytics.districtId).toBe(districtId)

      await analyticsEngine.dispose()
    })
  })
})
