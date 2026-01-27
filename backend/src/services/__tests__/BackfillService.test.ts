/**
 * Unit tests for BackfillService
 *
 * Tests:
 * - Processing snapshots in chronological order (Requirement 7.2)
 * - Resumption support by checking existing analytics (Requirement 7.3)
 * - Background processing without blocking (Requirement 7.4)
 * - Error handling and graceful continuation
 * - Cancellation support
 *
 * Requirements: 7.2, 7.3, 7.4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  BackfillService,
  type BackfillServiceConfig,
} from '../BackfillService.js'
import {
  clearBackfillJobs,
  getBackfillJob,
  updateBackfillJobProgress,
  createBackfillJobInStore,
  type BackfillJob,
  type BackfillProgress,
} from '../../routes/admin/backfill.js'
import type { FileSnapshotStore, SnapshotManifest } from '../SnapshotStore.js'
import type { PreComputedAnalyticsService } from '../PreComputedAnalyticsService.js'
import type { ITimeSeriesIndexService } from '../TimeSeriesIndexService.js'
import type { DistrictStatistics } from '../../types/districts.js'
import type { SnapshotMetadata } from '../../types/snapshots.js'
import type { PreComputedAnalyticsSummary } from '../../types/precomputedAnalytics.js'

// Mock logger
vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// Helper to create a mock snapshot metadata
function createMockSnapshotMetadata(snapshotId: string): SnapshotMetadata {
  return {
    snapshot_id: snapshotId,
    created_at: `${snapshotId}T12:00:00Z`,
    status: 'success',
    schema_version: '1.0.0',
    calculation_version: '1.0.0',
    size_bytes: 1000,
    error_count: 0,
    district_count: 2,
  }
}

// Helper to create a mock snapshot manifest
function createMockManifest(
  snapshotId: string,
  districtIds: string[]
): SnapshotManifest {
  return {
    snapshotId,
    createdAt: `${snapshotId}T12:00:00Z`,
    districts: districtIds.map(id => ({
      districtId: id,
      fileName: `district_${id}.json`,
      status: 'success' as const,
      fileSize: 500,
      lastModified: `${snapshotId}T12:00:00Z`,
    })),
    totalDistricts: districtIds.length,
    successfulDistricts: districtIds.length,
    failedDistricts: 0,
  }
}

// Helper to create mock district statistics
function createMockDistrictStats(
  districtId: string,
  asOfDate: string
): DistrictStatistics {
  return {
    districtId,
    asOfDate,
    membership: { total: 100, newMembers: 10, renewals: 90 },
    clubPerformance: [
      {
        'Club Number': '1234',
        'Club Name': 'Test Club 1',
        'Active Members': '25',
        'Mem. Base': '20',
        'Goals Met': '6',
        'Oct. Ren.': '10',
        'Apr. Ren.': '8',
        'New Members': '5',
      },
      {
        'Club Number': '5678',
        'Club Name': 'Test Club 2',
        'Active Members': '18',
        'Mem. Base': '15',
        'Goals Met': '4',
        'Oct. Ren.': '8',
        'Apr. Ren.': '6',
        'New Members': '3',
      },
    ],
  }
}

// Helper to create a backfill job in the store
function createBackfillJob(jobId: string): void {
  // We need to create the job through the route's internal mechanism
  // Since we can't directly access the Map, we'll use updateBackfillJobProgress
  // which will create the job if it doesn't exist (it won't, but we need to
  // simulate the job creation that happens in the route handler)
  // Actually, we need to simulate what the route does - create the job first
  // For testing, we'll need to work around this by checking the job exists
  // after startBackfill is called
}

describe('BackfillService', () => {
  let service: BackfillService
  let mockSnapshotStore: {
    listSnapshots: ReturnType<typeof vi.fn>
    getSnapshotManifest: ReturnType<typeof vi.fn>
    readDistrictData: ReturnType<typeof vi.fn>
  }
  let mockPreComputedAnalyticsService: {
    computeAndStore: ReturnType<typeof vi.fn>
    getAnalyticsSummary: ReturnType<typeof vi.fn>
  }
  let mockTimeSeriesIndexService: {
    appendDataPoint: ReturnType<typeof vi.fn>
    getTrendData: ReturnType<typeof vi.fn>
    getProgramYearData: ReturnType<typeof vi.fn>
    rebuildIndex: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    // Clear job store for test isolation
    clearBackfillJobs()

    // Create mock services
    mockSnapshotStore = {
      listSnapshots: vi.fn(),
      getSnapshotManifest: vi.fn(),
      readDistrictData: vi.fn(),
    }

    mockPreComputedAnalyticsService = {
      computeAndStore: vi.fn().mockResolvedValue(undefined),
      getAnalyticsSummary: vi.fn().mockResolvedValue(null),
    }

    mockTimeSeriesIndexService = {
      appendDataPoint: vi.fn().mockResolvedValue(undefined),
      getTrendData: vi.fn().mockResolvedValue([]),
      getProgramYearData: vi.fn().mockResolvedValue(null),
      rebuildIndex: vi.fn().mockResolvedValue(undefined),
    }

    // Create service with mocks
    service = new BackfillService({
      snapshotStore: mockSnapshotStore as unknown as FileSnapshotStore,
      preComputedAnalyticsService:
        mockPreComputedAnalyticsService as unknown as PreComputedAnalyticsService,
      timeSeriesIndexService:
        mockTimeSeriesIndexService as unknown as ITimeSeriesIndexService,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // Helper to simulate job creation (what the route handler does)
  function simulateJobCreation(jobId: string): void {
    // Use the exported helper to create the job in the store
    createBackfillJobInStore(jobId, {})
  }

  describe('startBackfill', () => {
    it('should process snapshots in chronological order (Requirement 7.2)', async () => {
      const jobId = 'test_job_1'
      simulateJobCreation(jobId)

      // Setup: Return snapshots in reverse chronological order (as listSnapshots does)
      mockSnapshotStore.listSnapshots.mockResolvedValue([
        createMockSnapshotMetadata('2024-03-15'),
        createMockSnapshotMetadata('2024-02-15'),
        createMockSnapshotMetadata('2024-01-15'),
      ])

      // Setup manifests and district data
      mockSnapshotStore.getSnapshotManifest.mockImplementation(
        (snapshotId: string) =>
          Promise.resolve(createMockManifest(snapshotId, ['42']))
      )
      mockSnapshotStore.readDistrictData.mockImplementation(
        (snapshotId: string, districtId: string) =>
          Promise.resolve(createMockDistrictStats(districtId, snapshotId))
      )

      // Track the order of computeAndStore calls
      const processedOrder: string[] = []
      mockPreComputedAnalyticsService.computeAndStore.mockImplementation(
        (snapshotId: string) => {
          processedOrder.push(snapshotId)
          return Promise.resolve()
        }
      )

      await service.startBackfill(jobId, {})

      // Verify snapshots were processed in chronological order (oldest first)
      expect(processedOrder).toEqual(['2024-01-15', '2024-02-15', '2024-03-15'])
    })

    it('should skip snapshots with existing analytics (Requirement 7.3)', async () => {
      const jobId = 'test_job_2'
      simulateJobCreation(jobId)

      mockSnapshotStore.listSnapshots.mockResolvedValue([
        createMockSnapshotMetadata('2024-01-15'),
        createMockSnapshotMetadata('2024-02-15'),
      ])

      mockSnapshotStore.getSnapshotManifest.mockImplementation(
        (snapshotId: string) =>
          Promise.resolve(createMockManifest(snapshotId, ['42']))
      )
      mockSnapshotStore.readDistrictData.mockImplementation(
        (snapshotId: string, districtId: string) =>
          Promise.resolve(createMockDistrictStats(districtId, snapshotId))
      )

      // First snapshot has existing analytics, second doesn't
      mockPreComputedAnalyticsService.getAnalyticsSummary.mockImplementation(
        (districtId: string, snapshotId: string) => {
          if (snapshotId === '2024-01-15') {
            return Promise.resolve({
              snapshotId,
              districtId,
              computedAt: '2024-01-15T12:00:00Z',
              totalMembership: 100,
              membershipChange: 0,
              clubCounts: {
                total: 2,
                thriving: 1,
                vulnerable: 1,
                interventionRequired: 0,
              },
              distinguishedClubs: {
                smedley: 0,
                presidents: 0,
                select: 0,
                distinguished: 1,
                total: 1,
              },
              trendDataPoint: {
                date: '2024-01-15',
                membership: 100,
                payments: 50,
                dcpGoals: 10,
              },
            } as PreComputedAnalyticsSummary)
          }
          return Promise.resolve(null)
        }
      )

      await service.startBackfill(jobId, {})

      // computeAndStore should only be called for the second snapshot
      expect(
        mockPreComputedAnalyticsService.computeAndStore
      ).toHaveBeenCalledTimes(1)
      expect(
        mockPreComputedAnalyticsService.computeAndStore
      ).toHaveBeenCalledWith('2024-02-15', expect.any(Array))
    })

    it('should filter snapshots by date range', async () => {
      const jobId = 'test_job_3'
      simulateJobCreation(jobId)

      mockSnapshotStore.listSnapshots.mockResolvedValue([
        createMockSnapshotMetadata('2024-03-15'),
        createMockSnapshotMetadata('2024-02-15'),
        createMockSnapshotMetadata('2024-01-15'),
        createMockSnapshotMetadata('2023-12-15'),
      ])

      mockSnapshotStore.getSnapshotManifest.mockImplementation(
        (snapshotId: string) =>
          Promise.resolve(createMockManifest(snapshotId, ['42']))
      )
      mockSnapshotStore.readDistrictData.mockImplementation(
        (snapshotId: string, districtId: string) =>
          Promise.resolve(createMockDistrictStats(districtId, snapshotId))
      )

      const processedSnapshots: string[] = []
      mockPreComputedAnalyticsService.computeAndStore.mockImplementation(
        (snapshotId: string) => {
          processedSnapshots.push(snapshotId)
          return Promise.resolve()
        }
      )

      await service.startBackfill(jobId, {
        startDate: '2024-01-01',
        endDate: '2024-02-28',
      })

      // Only snapshots within the date range should be processed
      expect(processedSnapshots).toEqual(['2024-01-15', '2024-02-15'])
    })

    it('should filter by district IDs when specified', async () => {
      const jobId = 'test_job_4'
      simulateJobCreation(jobId)

      mockSnapshotStore.listSnapshots.mockResolvedValue([
        createMockSnapshotMetadata('2024-01-15'),
      ])

      // Manifest has multiple districts
      mockSnapshotStore.getSnapshotManifest.mockResolvedValue(
        createMockManifest('2024-01-15', ['42', '61', 'F'])
      )

      mockSnapshotStore.readDistrictData.mockImplementation(
        (snapshotId: string, districtId: string) =>
          Promise.resolve(createMockDistrictStats(districtId, snapshotId))
      )

      await service.startBackfill(jobId, {
        districtIds: ['42', 'F'],
      })

      // readDistrictData should only be called for specified districts
      expect(mockSnapshotStore.readDistrictData).toHaveBeenCalledWith(
        '2024-01-15',
        '42'
      )
      expect(mockSnapshotStore.readDistrictData).toHaveBeenCalledWith(
        '2024-01-15',
        'F'
      )
      expect(mockSnapshotStore.readDistrictData).not.toHaveBeenCalledWith(
        '2024-01-15',
        '61'
      )
    })

    it('should update job progress during processing', async () => {
      const jobId = 'test_job_5'
      simulateJobCreation(jobId)

      mockSnapshotStore.listSnapshots.mockResolvedValue([
        createMockSnapshotMetadata('2024-01-15'),
        createMockSnapshotMetadata('2024-02-15'),
      ])

      mockSnapshotStore.getSnapshotManifest.mockImplementation(
        (snapshotId: string) =>
          Promise.resolve(createMockManifest(snapshotId, ['42']))
      )
      mockSnapshotStore.readDistrictData.mockImplementation(
        (snapshotId: string, districtId: string) =>
          Promise.resolve(createMockDistrictStats(districtId, snapshotId))
      )

      await service.startBackfill(jobId, {})

      // Check final job state
      const job = getBackfillJob(jobId)
      expect(job).toBeDefined()
      expect(job?.progress.status).toBe('completed')
      expect(job?.progress.totalSnapshots).toBe(2)
      expect(job?.progress.processedSnapshots).toBe(2)
      expect(job?.progress.percentComplete).toBe(100)
    })

    it('should handle empty snapshot list gracefully', async () => {
      const jobId = 'test_job_6'
      simulateJobCreation(jobId)

      mockSnapshotStore.listSnapshots.mockResolvedValue([])

      await service.startBackfill(jobId, {})

      const job = getBackfillJob(jobId)
      expect(job?.progress.status).toBe('completed')
      expect(job?.progress.totalSnapshots).toBe(0)
      expect(job?.progress.processedSnapshots).toBe(0)
      expect(job?.progress.percentComplete).toBe(100)
    })

    it('should continue processing after individual snapshot errors', async () => {
      const jobId = 'test_job_7'
      simulateJobCreation(jobId)

      mockSnapshotStore.listSnapshots.mockResolvedValue([
        createMockSnapshotMetadata('2024-01-15'),
        createMockSnapshotMetadata('2024-02-15'),
        createMockSnapshotMetadata('2024-03-15'),
      ])

      mockSnapshotStore.getSnapshotManifest.mockImplementation(
        (snapshotId: string) =>
          Promise.resolve(createMockManifest(snapshotId, ['42']))
      )
      mockSnapshotStore.readDistrictData.mockImplementation(
        (snapshotId: string, districtId: string) =>
          Promise.resolve(createMockDistrictStats(districtId, snapshotId))
      )

      // Second snapshot fails
      mockPreComputedAnalyticsService.computeAndStore.mockImplementation(
        (snapshotId: string) => {
          if (snapshotId === '2024-02-15') {
            return Promise.reject(new Error('Computation failed'))
          }
          return Promise.resolve()
        }
      )

      await service.startBackfill(jobId, {})

      // Job should complete despite error
      const job = getBackfillJob(jobId)
      expect(job?.progress.status).toBe('completed')
      expect(job?.progress.processedSnapshots).toBe(3)
      expect(job?.progress.errors).toHaveLength(1)
      expect(job?.progress.errors[0]?.snapshotId).toBe('2024-02-15')
    })

    it('should call timeSeriesIndexService.appendDataPoint for each district', async () => {
      const jobId = 'test_job_8'
      simulateJobCreation(jobId)

      mockSnapshotStore.listSnapshots.mockResolvedValue([
        createMockSnapshotMetadata('2024-01-15'),
      ])

      mockSnapshotStore.getSnapshotManifest.mockResolvedValue(
        createMockManifest('2024-01-15', ['42', '61'])
      )

      mockSnapshotStore.readDistrictData.mockImplementation(
        (snapshotId: string, districtId: string) =>
          Promise.resolve(createMockDistrictStats(districtId, snapshotId))
      )

      await service.startBackfill(jobId, {})

      // appendDataPoint should be called for each district
      expect(mockTimeSeriesIndexService.appendDataPoint).toHaveBeenCalledTimes(
        2
      )
      expect(mockTimeSeriesIndexService.appendDataPoint).toHaveBeenCalledWith(
        '42',
        expect.objectContaining({
          date: '2024-01-15',
          snapshotId: '2024-01-15',
        })
      )
      expect(mockTimeSeriesIndexService.appendDataPoint).toHaveBeenCalledWith(
        '61',
        expect.objectContaining({
          date: '2024-01-15',
          snapshotId: '2024-01-15',
        })
      )
    })
  })

  describe('cancelBackfill', () => {
    it('should return false for non-existent job', () => {
      const result = service.cancelBackfill('nonexistent_job')
      expect(result).toBe(false)
    })

    it('should cancel a pending job', async () => {
      const jobId = 'test_cancel_1'
      simulateJobCreation(jobId)

      // Job is pending but not yet started
      const result = service.cancelBackfill(jobId)

      expect(result).toBe(true)
      const job = getBackfillJob(jobId)
      expect(job?.progress.status).toBe('cancelled')
    })

    it('should stop processing when cancelled during execution', async () => {
      const jobId = 'test_cancel_2'
      simulateJobCreation(jobId)

      mockSnapshotStore.listSnapshots.mockResolvedValue([
        createMockSnapshotMetadata('2024-01-15'),
        createMockSnapshotMetadata('2024-02-15'),
        createMockSnapshotMetadata('2024-03-15'),
      ])

      mockSnapshotStore.getSnapshotManifest.mockImplementation(
        (snapshotId: string) =>
          Promise.resolve(createMockManifest(snapshotId, ['42']))
      )
      mockSnapshotStore.readDistrictData.mockImplementation(
        (snapshotId: string, districtId: string) =>
          Promise.resolve(createMockDistrictStats(districtId, snapshotId))
      )

      let processedCount = 0
      mockPreComputedAnalyticsService.computeAndStore.mockImplementation(
        async () => {
          processedCount++
          // Cancel after first snapshot
          if (processedCount === 1) {
            service.cancelBackfill(jobId)
          }
          // Add small delay to allow cancellation to take effect
          await new Promise(resolve => setTimeout(resolve, 10))
        }
      )

      await service.startBackfill(jobId, {})

      // Should have stopped after cancellation
      const job = getBackfillJob(jobId)
      expect(job?.progress.status).toBe('cancelled')
      // May have processed 1 or 2 depending on timing, but not all 3
      expect(processedCount).toBeLessThanOrEqual(2)
    })
  })

  describe('time-series data point building', () => {
    it('should correctly calculate membership totals', async () => {
      const jobId = 'test_ts_1'
      simulateJobCreation(jobId)

      mockSnapshotStore.listSnapshots.mockResolvedValue([
        createMockSnapshotMetadata('2024-01-15'),
      ])

      mockSnapshotStore.getSnapshotManifest.mockResolvedValue(
        createMockManifest('2024-01-15', ['42'])
      )

      const districtStats = createMockDistrictStats('42', '2024-01-15')
      mockSnapshotStore.readDistrictData.mockResolvedValue(districtStats)

      let capturedDataPoint: unknown
      mockTimeSeriesIndexService.appendDataPoint.mockImplementation(
        (_districtId: string, dataPoint: unknown) => {
          capturedDataPoint = dataPoint
          return Promise.resolve()
        }
      )

      await service.startBackfill(jobId, {})

      // Verify data point calculations
      // Club 1: 25 members, Club 2: 18 members = 43 total
      expect(capturedDataPoint).toMatchObject({
        date: '2024-01-15',
        snapshotId: '2024-01-15',
        membership: 43,
        clubCounts: {
          total: 2,
        },
      })
    })

    it('should correctly calculate club health counts', async () => {
      const jobId = 'test_ts_2'
      simulateJobCreation(jobId)

      mockSnapshotStore.listSnapshots.mockResolvedValue([
        createMockSnapshotMetadata('2024-01-15'),
      ])

      mockSnapshotStore.getSnapshotManifest.mockResolvedValue(
        createMockManifest('2024-01-15', ['42'])
      )

      // Create district with specific club health scenarios
      const districtStats: DistrictStatistics = {
        districtId: '42',
        asOfDate: '2024-01-15',
        membership: { total: 100, newMembers: 10, renewals: 90 },
        clubPerformance: [
          // Thriving: 25 members (>= 20), 6 goals (> 0)
          {
            'Club Number': '1',
            'Active Members': '25',
            'Mem. Base': '20',
            'Goals Met': '6',
          },
          // Vulnerable: 15 members (< 20), 0 goals
          {
            'Club Number': '2',
            'Active Members': '15',
            'Mem. Base': '12',
            'Goals Met': '0',
          },
          // Intervention Required: 10 members (< 12), net growth < 3
          {
            'Club Number': '3',
            'Active Members': '10',
            'Mem. Base': '9',
            'Goals Met': '2',
          },
        ],
      }
      mockSnapshotStore.readDistrictData.mockResolvedValue(districtStats)

      let capturedDataPoint: unknown
      mockTimeSeriesIndexService.appendDataPoint.mockImplementation(
        (_districtId: string, dataPoint: unknown) => {
          capturedDataPoint = dataPoint
          return Promise.resolve()
        }
      )

      await service.startBackfill(jobId, {})

      expect(capturedDataPoint).toMatchObject({
        clubCounts: {
          total: 3,
          thriving: 1,
          vulnerable: 1,
          interventionRequired: 1,
        },
      })
    })
  })
})
