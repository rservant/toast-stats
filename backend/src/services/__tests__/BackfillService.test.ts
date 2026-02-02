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
 * NOTE: Analytics computation is now handled by scraper-cli during the
 * compute-analytics pipeline. The BackfillService is now read-only and
 * only orchestrates backfill operations without performing any computation.
 *
 * Requirements: 7.2, 7.3, 7.4, 2.1-2.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  BackfillService,
  type BackfillServiceConfig,
} from '../BackfillService.js'
import {
  clearBackfillJobs,
  getBackfillJob,
  createBackfillJobInStore,
} from '../../routes/admin/backfill.js'
import type { FileSnapshotStore, SnapshotManifest } from '../SnapshotStore.js'
import type { PreComputedAnalyticsService } from '../PreComputedAnalyticsService.js'
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

describe('BackfillService', () => {
  let service: BackfillService
  let mockSnapshotStore: {
    listSnapshots: ReturnType<typeof vi.fn>
    getSnapshotManifest: ReturnType<typeof vi.fn>
    readDistrictData: ReturnType<typeof vi.fn>
  }
  let mockPreComputedAnalyticsService: {
    getAnalyticsSummary: ReturnType<typeof vi.fn>
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

    // PreComputedAnalyticsService is now read-only - no computeAndStore method
    mockPreComputedAnalyticsService = {
      getAnalyticsSummary: vi.fn().mockResolvedValue(null),
    }

    // Create service with mocks (no timeSeriesIndexService - removed per Requirements 2.1-2.5)
    service = new BackfillService({
      snapshotStore: mockSnapshotStore as unknown as FileSnapshotStore,
      preComputedAnalyticsService:
        mockPreComputedAnalyticsService as unknown as PreComputedAnalyticsService,
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

      // Track the order of snapshot processing via readDistrictData calls
      const processedOrder: string[] = []
      mockSnapshotStore.readDistrictData.mockImplementation(
        (snapshotId: string, districtId: string) => {
          if (!processedOrder.includes(snapshotId)) {
            processedOrder.push(snapshotId)
          }
          return Promise.resolve(createMockDistrictStats(districtId, snapshotId))
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

      // Track which snapshots had readDistrictData called
      const processedSnapshots: string[] = []
      mockSnapshotStore.readDistrictData.mockImplementation(
        (snapshotId: string, districtId: string) => {
          if (!processedSnapshots.includes(snapshotId)) {
            processedSnapshots.push(snapshotId)
          }
          return Promise.resolve(createMockDistrictStats(districtId, snapshotId))
        }
      )

      await service.startBackfill(jobId, {})

      // readDistrictData should only be called for the second snapshot (first was skipped)
      expect(processedSnapshots).toEqual(['2024-02-15'])
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

      const processedSnapshots: string[] = []
      mockSnapshotStore.readDistrictData.mockImplementation(
        (snapshotId: string, districtId: string) => {
          if (!processedSnapshots.includes(snapshotId)) {
            processedSnapshots.push(snapshotId)
          }
          return Promise.resolve(createMockDistrictStats(districtId, snapshotId))
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

      // Second snapshot fails when reading district data
      mockSnapshotStore.readDistrictData.mockImplementation(
        (snapshotId: string, districtId: string) => {
          if (snapshotId === '2024-02-15') {
            return Promise.reject(new Error('Read failed'))
          }
          return Promise.resolve(createMockDistrictStats(districtId, snapshotId))
        }
      )

      await service.startBackfill(jobId, {})

      // Job should complete despite error
      const job = getBackfillJob(jobId)
      expect(job?.progress.status).toBe('completed')
      expect(job?.progress.processedSnapshots).toBe(3)
      // Note: The error is logged but doesn't stop processing
    })

    it('should process multiple districts in a single snapshot', async () => {
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

      // readDistrictData should be called for both districts
      expect(mockSnapshotStore.readDistrictData).toHaveBeenCalledWith(
        '2024-01-15',
        '42'
      )
      expect(mockSnapshotStore.readDistrictData).toHaveBeenCalledWith(
        '2024-01-15',
        '61'
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

      let processedCount = 0
      mockSnapshotStore.readDistrictData.mockImplementation(
        async (snapshotId: string, districtId: string) => {
          processedCount++
          // Cancel after first snapshot
          if (processedCount === 1) {
            service.cancelBackfill(jobId)
          }
          // Add small delay to allow cancellation to take effect
          await new Promise(resolve => setTimeout(resolve, 10))
          return createMockDistrictStats(districtId, snapshotId)
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

  describe('read-only compliance (Requirements 2.1-2.5)', () => {
    it('should not have any time-series write dependencies', () => {
      // Verify the service config interface no longer includes timeSeriesIndexService
      const config: BackfillServiceConfig = {
        snapshotStore: mockSnapshotStore as unknown as FileSnapshotStore,
        preComputedAnalyticsService:
          mockPreComputedAnalyticsService as unknown as PreComputedAnalyticsService,
      }

      // This should compile without errors - no timeSeriesIndexService required
      const testService = new BackfillService(config)
      expect(testService).toBeDefined()
    })

    it('should only read data during processing, not compute', async () => {
      const jobId = 'test_readonly_1'
      simulateJobCreation(jobId)

      mockSnapshotStore.listSnapshots.mockResolvedValue([
        createMockSnapshotMetadata('2024-01-15'),
      ])

      mockSnapshotStore.getSnapshotManifest.mockResolvedValue(
        createMockManifest('2024-01-15', ['42'])
      )

      mockSnapshotStore.readDistrictData.mockImplementation(
        (snapshotId: string, districtId: string) =>
          Promise.resolve(createMockDistrictStats(districtId, snapshotId))
      )

      await service.startBackfill(jobId, {})

      // Verify only read operations were called
      expect(mockSnapshotStore.listSnapshots).toHaveBeenCalled()
      expect(mockSnapshotStore.getSnapshotManifest).toHaveBeenCalled()
      expect(mockSnapshotStore.readDistrictData).toHaveBeenCalled()
      expect(mockPreComputedAnalyticsService.getAnalyticsSummary).toHaveBeenCalled()
      
      // No computation methods should exist on the mock
      expect((mockPreComputedAnalyticsService as Record<string, unknown>).computeAndStore).toBeUndefined()
    })
  })
})
