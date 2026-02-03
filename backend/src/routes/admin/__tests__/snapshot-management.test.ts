/**
 * Unit tests for admin snapshot management routes (DELETE operations)
 *
 * Tests:
 * - Delete snapshots by IDs
 * - Delete snapshots in date range
 * - Delete all snapshots
 * - Cascading deletion of time-series entries
 * - Error handling
 *
 * Requirements: 8.1, 8.2, 8.3, 5.1, 5.2, 5.3, 5.6, 5.7
 * Property 11: Snapshot Deletion Cascade
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { snapshotManagementRouter } from '../snapshot-management.js'
import { FileSnapshotStore } from '../../../services/SnapshotStore.js'
import { PreComputedAnalyticsService } from '../../../services/PreComputedAnalyticsService.js'
import { TimeSeriesIndexService } from '../../../services/TimeSeriesIndexService.js'
import { LocalSnapshotStorage } from '../../../services/storage/LocalSnapshotStorage.js'
import { LocalTimeSeriesIndexStorage } from '../../../services/storage/LocalTimeSeriesIndexStorage.js'
import type { Snapshot } from '../../../types/snapshots.js'
import type { DistrictStatistics } from '../../../types/districts.js'

// Test instances
let testSnapshotStore: FileSnapshotStore
let testSnapshotStorage: LocalSnapshotStorage
let testTimeSeriesIndexStorage: LocalTimeSeriesIndexStorage
let testPreComputedAnalyticsService: PreComputedAnalyticsService
let testTimeSeriesIndexService: TimeSeriesIndexService
let tempDir: string

// Mock the StorageProviderFactory
vi.mock('../../../services/storage/StorageProviderFactory.js', () => ({
  StorageProviderFactory: {
    createFromEnvironment: () => ({
      snapshotStorage: testSnapshotStorage,
      timeSeriesIndexStorage: testTimeSeriesIndexStorage,
    }),
  },
}))

// Mock logger
vi.mock('../../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('Snapshot Management Routes', () => {
  let app: express.Application

  beforeEach(async () => {
    // Create unique temporary directory for test isolation
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), `snapshot-mgmt-test-${uniqueId}-`)
    )

    // Create test services
    testSnapshotStore = new FileSnapshotStore({
      cacheDir: tempDir,
      maxSnapshots: 10,
      maxAgeDays: 7,
      enableCompression: false,
    })

    // Create storage abstractions that wrap the test services
    testSnapshotStorage = new LocalSnapshotStorage({
      cacheDir: tempDir,
    })

    testTimeSeriesIndexStorage = new LocalTimeSeriesIndexStorage({
      cacheDir: tempDir,
    })

    testPreComputedAnalyticsService = new PreComputedAnalyticsService({
      snapshotsDir: path.join(tempDir, 'snapshots'),
    })

    testTimeSeriesIndexService = new TimeSeriesIndexService({
      cacheDir: tempDir,
    })

    // Create test app with snapshot management routes
    app = express()
    app.use(express.json())
    app.use('/api/admin', snapshotManagementRouter)
  })

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  /**
   * Helper to create a test snapshot with district data
   */
  const createTestSnapshot = (
    dateStr: string,
    status: 'success' | 'partial' | 'failed' = 'success',
    districtIds: string[] = ['42', '61']
  ): Snapshot => {
    const districts: DistrictStatistics[] = districtIds.map(districtId => ({
      districtId,
      asOfDate: dateStr,
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
        ineligible: 0,
        low: 1,
        distinguished: 3,
      },
      education: {
        totalAwards: 25,
        byType: [],
        topClubs: [],
      },
      performance: {
        membershipNet: 5,
        clubsNet: 1,
        distinguishedPercent: 30.0,
      },
      clubPerformance: [
        {
          'Club Number': '1234',
          'Club Name': 'Test Club',
          'Active Members': '25',
          'Goals Met': '7',
          'Mem. Base': '20',
          'Oct. Ren.': '10',
          'Apr. Ren.': '8',
          'New Members': '5',
        },
      ],
    }))

    return {
      snapshot_id: dateStr,
      created_at: new Date().toISOString(),
      schema_version: '1.0.0',
      calculation_version: '1.0.0',
      status,
      errors: status === 'failed' ? ['Test error'] : [],
      payload: {
        districts,
        metadata: {
          source: 'test',
          fetchedAt: new Date().toISOString(),
          dataAsOfDate: dateStr,
          districtCount: districts.length,
          processingDurationMs: 1000,
        },
      },
    }
  }

  /**
   * Helper to write time-series data directly to files
   * (TimeSeriesIndexService is now read-only, so we write files directly for tests)
   */
  const writeTimeSeriesDataPoint = async (
    districtId: string,
    dataPoint: {
      date: string
      snapshotId: string
      membership: number
      payments: number
      dcpGoals: number
      distinguishedTotal: number
      clubCounts: {
        total: number
        thriving: number
        vulnerable: number
        interventionRequired: number
      }
    }
  ): Promise<void> => {
    // Determine program year from date
    const date = new Date(dataPoint.date)
    const year = date.getFullYear()
    const month = date.getMonth() + 1 // 1-indexed
    const programYear =
      month >= 7 ? `${year}-${year + 1}` : `${year - 1}-${year}`

    const districtDir = path.join(
      tempDir,
      'time-series',
      `district_${districtId}`
    )
    await fs.mkdir(districtDir, { recursive: true })

    const indexFilePath = path.join(districtDir, `${programYear}.json`)

    // Read existing index or create new one
    let indexFile: {
      districtId: string
      programYear: string
      startDate: string
      endDate: string
      lastUpdated: string
      dataPoints: (typeof dataPoint)[]
      summary: {
        totalDataPoints: number
        membershipStart: number
        membershipEnd: number
        membershipPeak: number
        membershipLow: number
      }
    }

    try {
      const content = await fs.readFile(indexFilePath, 'utf-8')
      indexFile = JSON.parse(content)
    } catch {
      // Create new index file
      const startYear = parseInt(programYear.split('-')[0]!)
      indexFile = {
        districtId,
        programYear,
        startDate: `${startYear}-07-01`,
        endDate: `${startYear + 1}-06-30`,
        lastUpdated: new Date().toISOString(),
        dataPoints: [],
        summary: {
          totalDataPoints: 0,
          membershipStart: 0,
          membershipEnd: 0,
          membershipPeak: 0,
          membershipLow: 0,
        },
      }
    }

    // Add data point
    indexFile.dataPoints.push(dataPoint)
    indexFile.lastUpdated = new Date().toISOString()
    indexFile.summary.totalDataPoints = indexFile.dataPoints.length

    await fs.writeFile(indexFilePath, JSON.stringify(indexFile, null, 2))
  }

  /**
   * Helper to write analytics summary file directly
   * (PreComputedAnalyticsService is now read-only, so we write files directly for tests)
   */
  const writeAnalyticsSummary = async (
    dateStr: string,
    districtIds: string[]
  ): Promise<void> => {
    const snapshotDir = path.join(tempDir, 'snapshots', dateStr)
    await fs.mkdir(snapshotDir, { recursive: true })

    const analyticsSummary = {
      snapshotId: dateStr,
      computedAt: new Date().toISOString(),
      schemaVersion: '1.0.0',
      districts: Object.fromEntries(
        districtIds.map(id => [
          id,
          {
            districtId: id,
            totalMembership: 100,
            totalPayments: 1000,
            totalDCPGoals: 50,
            clubCounts: {
              total: 10,
              thriving: 5,
              vulnerable: 3,
              interventionRequired: 2,
            },
            distinguishedTotal: 3,
          },
        ])
      ),
    }

    await fs.writeFile(
      path.join(snapshotDir, 'analytics-summary.json'),
      JSON.stringify(analyticsSummary, null, 2)
    )
  }

  /**
   * Helper to create a snapshot with pre-computed analytics and time-series entries
   */
  const createSnapshotWithAnalytics = async (
    dateStr: string,
    districtIds: string[] = ['42', '61']
  ): Promise<void> => {
    const snapshot = createTestSnapshot(dateStr, 'success', districtIds)

    // Write snapshot
    await testSnapshotStore.writeSnapshot(snapshot)

    // Write analytics summary file directly
    // (PreComputedAnalyticsService is now read-only per data-computation-separation steering)
    await writeAnalyticsSummary(dateStr, districtIds)

    // Add time-series entries for each district (write directly to files)
    for (const district of snapshot.payload.districts) {
      await writeTimeSeriesDataPoint(district.districtId, {
        date: dateStr,
        snapshotId: dateStr,
        membership: district.membership?.total ?? 0,
        payments: 0,
        dcpGoals: 0,
        distinguishedTotal: 0,
        clubCounts: {
          total: district.clubs?.total ?? 0,
          thriving: 0,
          vulnerable: 0,
          interventionRequired: 0,
        },
      })
    }
  }

  describe('DELETE /api/admin/snapshots', () => {
    it('should delete snapshots by IDs', async () => {
      // Create test snapshots
      await createSnapshotWithAnalytics('2024-01-01')
      await createSnapshotWithAnalytics('2024-01-02')

      const response = await request(app)
        .delete('/api/admin/snapshots')
        .send({ snapshotIds: ['2024-01-01'] })

      expect(response.status).toBe(200)
      expect(response.body.summary.totalRequested).toBe(1)
      expect(response.body.summary.successfulDeletions).toBe(1)
      expect(response.body.summary.failedDeletions).toBe(0)
      expect(response.body.summary.results[0].success).toBe(true)
      expect(response.body.summary.results[0].snapshotId).toBe('2024-01-01')

      // Verify snapshot was deleted
      const snapshotDir = path.join(tempDir, 'snapshots', '2024-01-01')
      await expect(fs.access(snapshotDir)).rejects.toThrow()

      // Verify other snapshot still exists
      const otherSnapshotDir = path.join(tempDir, 'snapshots', '2024-01-02')
      await expect(fs.access(otherSnapshotDir)).resolves.toBeUndefined()
    })

    it('should delete multiple snapshots', async () => {
      await createSnapshotWithAnalytics('2024-01-01')
      await createSnapshotWithAnalytics('2024-01-02')
      await createSnapshotWithAnalytics('2024-01-03')

      const response = await request(app)
        .delete('/api/admin/snapshots')
        .send({ snapshotIds: ['2024-01-01', '2024-01-02'] })

      expect(response.status).toBe(200)
      expect(response.body.summary.totalRequested).toBe(2)
      expect(response.body.summary.successfulDeletions).toBe(2)
      expect(response.body.summary.failedDeletions).toBe(0)
    })

    it('should handle non-existent snapshot IDs gracefully', async () => {
      await createSnapshotWithAnalytics('2024-01-01')

      const response = await request(app)
        .delete('/api/admin/snapshots')
        .send({ snapshotIds: ['2024-01-01', 'nonexistent'] })

      expect(response.status).toBe(200)
      expect(response.body.summary.totalRequested).toBe(2)
      expect(response.body.summary.successfulDeletions).toBe(1)
      expect(response.body.summary.failedDeletions).toBe(1)

      const failedResult = response.body.summary.results.find(
        (r: { snapshotId: string }) => r.snapshotId === 'nonexistent'
      )
      expect(failedResult.success).toBe(false)
      expect(failedResult.error).toContain('not found')
    })

    it('should return 400 for missing snapshotIds', async () => {
      const response = await request(app)
        .delete('/api/admin/snapshots')
        .send({})

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('INVALID_REQUEST')
    })

    it('should return 400 for empty snapshotIds array', async () => {
      const response = await request(app)
        .delete('/api/admin/snapshots')
        .send({ snapshotIds: [] })

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('INVALID_REQUEST')
    })

    it('should return 400 for non-array snapshotIds', async () => {
      const response = await request(app)
        .delete('/api/admin/snapshots')
        .send({ snapshotIds: '2024-01-01' })

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('INVALID_REQUEST')
    })

    it('should cascade delete time-series entries', async () => {
      await createSnapshotWithAnalytics('2024-01-15', ['42'])

      // Verify time-series entry exists before deletion
      const trendDataBefore = await testTimeSeriesIndexService.getTrendData(
        '42',
        '2024-01-01',
        '2024-01-31'
      )
      expect(trendDataBefore.length).toBe(1)

      // Delete snapshot
      const response = await request(app)
        .delete('/api/admin/snapshots')
        .send({ snapshotIds: ['2024-01-15'] })

      expect(response.status).toBe(200)
      expect(
        response.body.summary.results[0].deletedFiles.timeSeriesEntriesRemoved
      ).toBe(1)

      // Verify time-series entry was removed
      const trendDataAfter = await testTimeSeriesIndexService.getTrendData(
        '42',
        '2024-01-01',
        '2024-01-31'
      )
      expect(trendDataAfter.length).toBe(0)
    })
  })

  describe('DELETE /api/admin/snapshots/range', () => {
    it('should delete snapshots in date range', async () => {
      await createSnapshotWithAnalytics('2024-01-01')
      await createSnapshotWithAnalytics('2024-01-15')
      await createSnapshotWithAnalytics('2024-01-31')
      await createSnapshotWithAnalytics('2024-02-15')

      const response = await request(app)
        .delete('/api/admin/snapshots/range')
        .send({ startDate: '2024-01-01', endDate: '2024-01-31' })

      expect(response.status).toBe(200)
      expect(response.body.summary.totalRequested).toBe(3)
      expect(response.body.summary.successfulDeletions).toBe(3)
      expect(response.body.dateRange.startDate).toBe('2024-01-01')
      expect(response.body.dateRange.endDate).toBe('2024-01-31')

      // Verify snapshots in range were deleted
      await expect(
        fs.access(path.join(tempDir, 'snapshots', '2024-01-01'))
      ).rejects.toThrow()
      await expect(
        fs.access(path.join(tempDir, 'snapshots', '2024-01-15'))
      ).rejects.toThrow()
      await expect(
        fs.access(path.join(tempDir, 'snapshots', '2024-01-31'))
      ).rejects.toThrow()

      // Verify snapshot outside range still exists
      await expect(
        fs.access(path.join(tempDir, 'snapshots', '2024-02-15'))
      ).resolves.toBeUndefined()
    })

    it('should handle empty date range', async () => {
      await createSnapshotWithAnalytics('2024-01-15')

      const response = await request(app)
        .delete('/api/admin/snapshots/range')
        .send({ startDate: '2024-02-01', endDate: '2024-02-28' })

      expect(response.status).toBe(200)
      expect(response.body.summary.totalRequested).toBe(0)
      expect(response.body.summary.successfulDeletions).toBe(0)
    })

    it('should return 400 for missing dates', async () => {
      const response = await request(app)
        .delete('/api/admin/snapshots/range')
        .send({ startDate: '2024-01-01' })

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('INVALID_REQUEST')
    })

    it('should return 400 for invalid date format', async () => {
      const response = await request(app)
        .delete('/api/admin/snapshots/range')
        .send({ startDate: '01-01-2024', endDate: '01-31-2024' })

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('INVALID_REQUEST')
      expect(response.body.error.message).toContain('YYYY-MM-DD')
    })

    it('should return 400 when startDate is after endDate', async () => {
      const response = await request(app)
        .delete('/api/admin/snapshots/range')
        .send({ startDate: '2024-01-31', endDate: '2024-01-01' })

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('INVALID_REQUEST')
      expect(response.body.error.message).toContain('before or equal')
    })
  })

  describe('DELETE /api/admin/snapshots/all', () => {
    it('should delete all snapshots', async () => {
      await createSnapshotWithAnalytics('2024-01-01')
      await createSnapshotWithAnalytics('2024-01-15')
      await createSnapshotWithAnalytics('2024-02-01')

      const response = await request(app)
        .delete('/api/admin/snapshots/all')
        .send({})

      expect(response.status).toBe(200)
      expect(response.body.summary.totalRequested).toBe(3)
      expect(response.body.summary.successfulDeletions).toBe(3)

      // Verify all snapshots were deleted
      const snapshotsDir = path.join(tempDir, 'snapshots')
      const entries = await fs.readdir(snapshotsDir)
      expect(entries.length).toBe(0)
    })

    it('should report total time-series entries removed', async () => {
      await createSnapshotWithAnalytics('2024-01-15', ['42', '61'])

      // Verify time-series entries exist
      const trendData42Before = await testTimeSeriesIndexService.getTrendData(
        '42',
        '2024-01-01',
        '2024-01-31'
      )
      const trendData61Before = await testTimeSeriesIndexService.getTrendData(
        '61',
        '2024-01-01',
        '2024-01-31'
      )
      expect(trendData42Before.length).toBe(1)
      expect(trendData61Before.length).toBe(1)

      const response = await request(app)
        .delete('/api/admin/snapshots/all')
        .send({})

      expect(response.status).toBe(200)
      expect(response.body.summary.totalTimeSeriesEntriesRemoved).toBe(2)

      // Verify time-series entries were removed
      const trendData42After = await testTimeSeriesIndexService.getTrendData(
        '42',
        '2024-01-01',
        '2024-01-31'
      )
      const trendData61After = await testTimeSeriesIndexService.getTrendData(
        '61',
        '2024-01-01',
        '2024-01-31'
      )
      expect(trendData42After.length).toBe(0)
      expect(trendData61After.length).toBe(0)
    })

    it('should handle empty snapshots directory', async () => {
      // Ensure snapshots directory exists but is empty
      await fs.mkdir(path.join(tempDir, 'snapshots'), { recursive: true })

      const response = await request(app)
        .delete('/api/admin/snapshots/all')
        .send({})

      expect(response.status).toBe(200)
      expect(response.body.summary.totalRequested).toBe(0)
      expect(response.body.summary.successfulDeletions).toBe(0)
    })

    it('should return 501 for district-specific deletion (not yet implemented)', async () => {
      await createSnapshotWithAnalytics('2024-01-15', ['42', '61'])

      const response = await request(app)
        .delete('/api/admin/snapshots/all')
        .send({ districtId: '42' })

      expect(response.status).toBe(501)
      expect(response.body.error.code).toBe('NOT_IMPLEMENTED')
      expect(response.body.error.message).toContain('not yet supported')
    })

    it('should return 400 for invalid districtId format', async () => {
      const response = await request(app)
        .delete('/api/admin/snapshots/all')
        .send({ districtId: '../../../etc/passwd' })

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('INVALID_REQUEST')
      expect(response.body.error.message).toContain('alphanumeric')
    })
  })

  describe('Cascading Deletion (Property 11)', () => {
    it('should delete snapshot and time-series entries together', async () => {
      await createSnapshotWithAnalytics('2024-01-15', ['42'])

      // Verify all components exist before deletion
      const snapshotDir = path.join(tempDir, 'snapshots', '2024-01-15')
      await expect(fs.access(snapshotDir)).resolves.toBeUndefined()

      const analyticsFile = path.join(snapshotDir, 'analytics-summary.json')
      await expect(fs.access(analyticsFile)).resolves.toBeUndefined()

      const trendData = await testTimeSeriesIndexService.getTrendData(
        '42',
        '2024-01-01',
        '2024-01-31'
      )
      expect(trendData.length).toBe(1)

      // Delete snapshot
      const response = await request(app)
        .delete('/api/admin/snapshots')
        .send({ snapshotIds: ['2024-01-15'] })

      expect(response.status).toBe(200)
      const result = response.body.summary.results[0]
      expect(result.success).toBe(true)
      expect(result.deletedFiles.snapshotDeleted).toBe(true)
      expect(result.deletedFiles.timeSeriesEntriesRemoved).toBe(1)

      // Verify all components were deleted
      await expect(fs.access(snapshotDir)).rejects.toThrow()

      const trendDataAfter = await testTimeSeriesIndexService.getTrendData(
        '42',
        '2024-01-01',
        '2024-01-31'
      )
      expect(trendDataAfter.length).toBe(0)
    })

    it('should not leave orphaned data after deletion', async () => {
      // Create multiple snapshots for the same district
      await createSnapshotWithAnalytics('2024-01-10', ['42'])
      await createSnapshotWithAnalytics('2024-01-20', ['42'])

      // Delete one snapshot
      await request(app)
        .delete('/api/admin/snapshots')
        .send({ snapshotIds: ['2024-01-10'] })

      // Verify only the deleted snapshot's time-series entry is removed
      const trendData = await testTimeSeriesIndexService.getTrendData(
        '42',
        '2024-01-01',
        '2024-01-31'
      )
      expect(trendData.length).toBe(1)
      expect(trendData[0]?.snapshotId).toBe('2024-01-20')
    })
  })

  describe('Storage Abstraction Compliance', () => {
    it('should use storage abstraction for snapshot deletion', async () => {
      await createSnapshotWithAnalytics('2024-01-15')

      // The test verifies that the route uses the mocked storage providers
      // If it tried to use direct fs operations, it would fail because
      // the mock doesn't provide getCacheDirectory
      const response = await request(app)
        .delete('/api/admin/snapshots')
        .send({ snapshotIds: ['2024-01-15'] })

      expect(response.status).toBe(200)
      expect(response.body.summary.successfulDeletions).toBe(1)
    })

    it('should use storage abstraction for listing snapshots in range', async () => {
      await createSnapshotWithAnalytics('2024-01-15')

      const response = await request(app)
        .delete('/api/admin/snapshots/range')
        .send({ startDate: '2024-01-01', endDate: '2024-01-31' })

      expect(response.status).toBe(200)
      expect(response.body.summary.totalRequested).toBe(1)
    })

    it('should use storage abstraction for listing all snapshots', async () => {
      await createSnapshotWithAnalytics('2024-01-15')

      const response = await request(app)
        .delete('/api/admin/snapshots/all')
        .send({})

      expect(response.status).toBe(200)
      expect(response.body.summary.totalRequested).toBe(1)
    })
  })
})
