/**
 * AnalyticsGenerator Unit Tests
 *
 * Tests the AnalyticsGenerator component for the Unified Backfill Service.
 * Validates Requirements 4.5, 11.3 from the spec.
 *
 * Test Coverage:
 * 1. Preview functionality - snapshot selection with and without date range
 * 2. Generation execution - processing snapshots with progress reporting
 * 3. Cancellation - stopping processing gracefully
 * 4. Analytics calculation - verifying metric calculations
 *
 * Test Isolation Requirements (per testing steering document):
 * - Each test uses mocked dependencies
 * - Tests clean up all mocks in afterEach hooks
 * - Tests do not depend on execution order
 * - All tests pass when run with --run (parallel mode)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Mock } from 'vitest'
import { AnalyticsGenerator } from '../AnalyticsGenerator.js'
import type {
  ISnapshotStorage,
  ITimeSeriesIndexStorage,
} from '../../../../types/storageInterfaces.js'
import type { Snapshot, SnapshotMetadata } from '../../../../types/snapshots.js'
import type { TimeSeriesDataPoint } from '../../../../types/precomputedAnalytics.js'

// ============================================================================
// Mock Setup
// ============================================================================

// Mock the logger to avoid console output during tests
vi.mock('../../../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a mock ISnapshotStorage implementation
 */
function createMockSnapshotStorage(): ISnapshotStorage & {
  listSnapshots: Mock
  getSnapshot: Mock
  listDistrictsInSnapshot: Mock
  readDistrictData: Mock
} {
  return {
    listSnapshots: vi.fn().mockResolvedValue([]),
    getSnapshot: vi.fn().mockResolvedValue(null),
    listDistrictsInSnapshot: vi.fn().mockResolvedValue([]),
    readDistrictData: vi.fn().mockResolvedValue(null),
    getLatestSuccessful: vi.fn().mockResolvedValue(null),
    getLatest: vi.fn().mockResolvedValue(null),
    writeSnapshot: vi.fn().mockResolvedValue(undefined),
    deleteSnapshot: vi.fn().mockResolvedValue(true),
    isReady: vi.fn().mockResolvedValue(true),
    writeDistrictData: vi.fn().mockResolvedValue(undefined),
    getSnapshotManifest: vi.fn().mockResolvedValue(null),
    getSnapshotMetadata: vi.fn().mockResolvedValue(null),
    writeAllDistrictsRankings: vi.fn().mockResolvedValue(undefined),
    readAllDistrictsRankings: vi.fn().mockResolvedValue(null),
    hasAllDistrictsRankings: vi.fn().mockResolvedValue(false),
  } as unknown as ISnapshotStorage & {
    listSnapshots: Mock
    getSnapshot: Mock
    listDistrictsInSnapshot: Mock
    readDistrictData: Mock
  }
}

/**
 * Create a mock ITimeSeriesIndexStorage implementation
 */
function createMockTimeSeriesStorage(): ITimeSeriesIndexStorage & {
  appendDataPoint: Mock
} {
  return {
    appendDataPoint: vi.fn().mockResolvedValue(undefined),
    getTrendData: vi.fn().mockResolvedValue([]),
    getProgramYearData: vi.fn().mockResolvedValue(null),
    deleteSnapshotEntries: vi.fn().mockResolvedValue(0),
    isReady: vi.fn().mockResolvedValue(true),
  } as unknown as ITimeSeriesIndexStorage & {
    appendDataPoint: Mock
  }
}

/**
 * Create a mock progress callback
 */
function createProgressCallback(): Mock {
  return vi.fn()
}

/**
 * Create a mock snapshot metadata entry
 */
function createSnapshotMetadata(
  snapshotId: string,
  status: 'success' | 'partial' | 'failed' = 'success'
): SnapshotMetadata {
  return {
    snapshot_id: snapshotId,
    status,
    created_at: new Date().toISOString(),
    schema_version: '1.0.0',
    calculation_version: '1.0.0',
    size_bytes: 1024,
    error_count: status === 'failed' ? 1 : 0,
    district_count: 3,
  }
}

/**
 * Create a mock snapshot
 */
function createMockSnapshot(snapshotId: string): Snapshot {
  return {
    snapshot_id: snapshotId,
    created_at: new Date().toISOString(),
    schema_version: '1.0.0',
    calculation_version: '1.0.0',
    status: 'success',
    errors: [],
    payload: {
      districts: [],
      metadata: {
        source: 'test',
        fetchedAt: new Date().toISOString(),
        dataAsOfDate: snapshotId,
        districtCount: 0,
        processingDurationMs: 100,
      },
    },
  }
}

/**
 * Create mock district data with club performance
 */
function createMockDistrictData(options: {
  asOfDate: string
  totalMembership?: number
  clubs?: Array<{
    'Active Members'?: number
    'Oct. Ren.'?: number
    'Apr. Ren.'?: number
    'New Members'?: number
    'Goals Met'?: number
    'Mem. Base'?: number
    'Club Distinguished Status'?: string
    CSP?: string
  }>
}) {
  const defaultClubs = [
    {
      'Active Members': 25,
      'Oct. Ren.': 10,
      'Apr. Ren.': 8,
      'New Members': 5,
      'Goals Met': 6,
      'Mem. Base': 20,
      'Club Distinguished Status': 'Distinguished',
      CSP: 'yes',
    },
    {
      'Active Members': 15,
      'Oct. Ren.': 5,
      'Apr. Ren.': 4,
      'New Members': 3,
      'Goals Met': 3,
      'Mem. Base': 12,
      'Club Distinguished Status': '',
      CSP: 'yes',
    },
  ]

  return {
    asOfDate: options.asOfDate,
    membership:
      options.totalMembership !== undefined
        ? { total: options.totalMembership }
        : undefined,
    clubPerformance: options.clubs ?? defaultClubs,
  }
}

// ============================================================================
// Test Suite
// ============================================================================

describe('AnalyticsGenerator', () => {
  let mockSnapshotStorage: ReturnType<typeof createMockSnapshotStorage>
  let mockTimeSeriesStorage: ReturnType<typeof createMockTimeSeriesStorage>
  let analyticsGenerator: AnalyticsGenerator

  beforeEach(() => {
    vi.clearAllMocks()
    mockSnapshotStorage = createMockSnapshotStorage()
    mockTimeSeriesStorage = createMockTimeSeriesStorage()
    analyticsGenerator = new AnalyticsGenerator(
      mockSnapshotStorage,
      mockTimeSeriesStorage
    )
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================================
  // Preview Functionality Tests (Requirements 4.5, 11.3)
  // ============================================================================

  describe('Preview Functionality', () => {
    it('should return all snapshots when no date range specified', async () => {
      // Arrange
      const snapshots: SnapshotMetadata[] = [
        createSnapshotMetadata('2024-01-15'),
        createSnapshotMetadata('2024-01-14'),
        createSnapshotMetadata('2024-01-13'),
      ]
      mockSnapshotStorage.listSnapshots.mockResolvedValue(snapshots)

      // Act
      const preview = await analyticsGenerator.previewGeneration()

      // Assert
      expect(preview.totalItems).toBe(3)
      expect(preview.snapshotIds).toHaveLength(3)
      expect(mockSnapshotStorage.listSnapshots).toHaveBeenCalledWith(
        undefined,
        { status: 'success' }
      )
    })

    it('should filter snapshots by start date', async () => {
      // Arrange
      const snapshots: SnapshotMetadata[] = [
        createSnapshotMetadata('2024-01-15'),
        createSnapshotMetadata('2024-01-14'),
        createSnapshotMetadata('2024-01-13'),
        createSnapshotMetadata('2024-01-12'),
        createSnapshotMetadata('2024-01-11'),
      ]
      mockSnapshotStorage.listSnapshots.mockResolvedValue(snapshots)

      // Act
      const preview = await analyticsGenerator.previewGeneration('2024-01-13')

      // Assert - Should include 2024-01-13, 2024-01-14, 2024-01-15
      expect(preview.totalItems).toBe(3)
      expect(preview.snapshotIds).toContain('2024-01-13')
      expect(preview.snapshotIds).toContain('2024-01-14')
      expect(preview.snapshotIds).toContain('2024-01-15')
      expect(preview.snapshotIds).not.toContain('2024-01-12')
      expect(preview.snapshotIds).not.toContain('2024-01-11')
    })

    it('should filter snapshots by end date', async () => {
      // Arrange
      const snapshots: SnapshotMetadata[] = [
        createSnapshotMetadata('2024-01-15'),
        createSnapshotMetadata('2024-01-14'),
        createSnapshotMetadata('2024-01-13'),
        createSnapshotMetadata('2024-01-12'),
        createSnapshotMetadata('2024-01-11'),
      ]
      mockSnapshotStorage.listSnapshots.mockResolvedValue(snapshots)

      // Act
      const preview = await analyticsGenerator.previewGeneration(
        undefined,
        '2024-01-13'
      )

      // Assert - Should include 2024-01-11, 2024-01-12, 2024-01-13
      expect(preview.totalItems).toBe(3)
      expect(preview.snapshotIds).toContain('2024-01-11')
      expect(preview.snapshotIds).toContain('2024-01-12')
      expect(preview.snapshotIds).toContain('2024-01-13')
      expect(preview.snapshotIds).not.toContain('2024-01-14')
      expect(preview.snapshotIds).not.toContain('2024-01-15')
    })

    it('should filter snapshots by both start and end date', async () => {
      // Arrange
      const snapshots: SnapshotMetadata[] = [
        createSnapshotMetadata('2024-01-15'),
        createSnapshotMetadata('2024-01-14'),
        createSnapshotMetadata('2024-01-13'),
        createSnapshotMetadata('2024-01-12'),
        createSnapshotMetadata('2024-01-11'),
      ]
      mockSnapshotStorage.listSnapshots.mockResolvedValue(snapshots)

      // Act
      const preview = await analyticsGenerator.previewGeneration(
        '2024-01-12',
        '2024-01-14'
      )

      // Assert - Should include 2024-01-12, 2024-01-13, 2024-01-14
      expect(preview.totalItems).toBe(3)
      expect(preview.snapshotIds).toContain('2024-01-12')
      expect(preview.snapshotIds).toContain('2024-01-13')
      expect(preview.snapshotIds).toContain('2024-01-14')
      expect(preview.snapshotIds).not.toContain('2024-01-11')
      expect(preview.snapshotIds).not.toContain('2024-01-15')
    })

    it('should return empty list when no snapshots match date range', async () => {
      // Arrange
      const snapshots: SnapshotMetadata[] = [
        createSnapshotMetadata('2024-01-15'),
        createSnapshotMetadata('2024-01-14'),
      ]
      mockSnapshotStorage.listSnapshots.mockResolvedValue(snapshots)

      // Act
      const preview = await analyticsGenerator.previewGeneration(
        '2024-02-01',
        '2024-02-28'
      )

      // Assert
      expect(preview.totalItems).toBe(0)
      expect(preview.snapshotIds).toHaveLength(0)
    })

    it('should return correct estimated duration', async () => {
      // Arrange
      const snapshots: SnapshotMetadata[] = [
        createSnapshotMetadata('2024-01-15'),
        createSnapshotMetadata('2024-01-14'),
        createSnapshotMetadata('2024-01-13'),
      ]
      mockSnapshotStorage.listSnapshots.mockResolvedValue(snapshots)
      const expectedMsPerSnapshot = 5000 // From ESTIMATED_MS_PER_SNAPSHOT constant

      // Act
      const preview = await analyticsGenerator.previewGeneration()

      // Assert
      expect(preview.estimatedDuration).toBe(3 * expectedMsPerSnapshot)
    })

    it('should return correct date range from filtered snapshots', async () => {
      // Arrange
      const snapshots: SnapshotMetadata[] = [
        createSnapshotMetadata('2024-01-15'),
        createSnapshotMetadata('2024-01-14'),
        createSnapshotMetadata('2024-01-13'),
      ]
      mockSnapshotStorage.listSnapshots.mockResolvedValue(snapshots)

      // Act
      const preview = await analyticsGenerator.previewGeneration()

      // Assert - Snapshots are sorted oldest first, so date range should reflect that
      expect(preview.dateRange.startDate).toBe('2024-01-13')
      expect(preview.dateRange.endDate).toBe('2024-01-15')
    })

    it('should return empty date range when no snapshots exist', async () => {
      // Arrange
      mockSnapshotStorage.listSnapshots.mockResolvedValue([])

      // Act
      const preview = await analyticsGenerator.previewGeneration()

      // Assert
      expect(preview.totalItems).toBe(0)
      expect(preview.dateRange.startDate).toBe('')
      expect(preview.dateRange.endDate).toBe('')
    })
  })

  // ============================================================================
  // Generation Execution Tests (Requirements 4.5, 11.3)
  // ============================================================================

  describe('Generation Execution', () => {
    it('should process all specified snapshots', async () => {
      // Arrange
      const snapshotIds = ['2024-01-15', '2024-01-14', '2024-01-13']
      const progressCallback = createProgressCallback()

      // Setup mocks for each snapshot
      for (const snapshotId of snapshotIds) {
        mockSnapshotStorage.getSnapshot.mockResolvedValueOnce(
          createMockSnapshot(snapshotId)
        )
      }
      mockSnapshotStorage.listDistrictsInSnapshot.mockResolvedValue([
        '42',
        '61',
      ])
      mockSnapshotStorage.readDistrictData.mockResolvedValue(
        createMockDistrictData({ asOfDate: '2024-01-15' })
      )

      // Act
      const result = await analyticsGenerator.generateForSnapshots(
        snapshotIds,
        progressCallback
      )

      // Assert
      expect(result.processedItems).toBe(3)
      expect(result.snapshotIds).toHaveLength(3)
      expect(mockSnapshotStorage.getSnapshot).toHaveBeenCalledTimes(3)
    })

    it('should report progress via callback', async () => {
      // Arrange
      const snapshotIds = ['2024-01-15', '2024-01-14']
      const progressCallback = createProgressCallback()

      mockSnapshotStorage.getSnapshot.mockResolvedValue(
        createMockSnapshot('2024-01-15')
      )
      mockSnapshotStorage.listDistrictsInSnapshot.mockResolvedValue(['42'])
      mockSnapshotStorage.readDistrictData.mockResolvedValue(
        createMockDistrictData({ asOfDate: '2024-01-15' })
      )

      // Act
      await analyticsGenerator.generateForSnapshots(
        snapshotIds,
        progressCallback
      )

      // Assert - Progress callback should be called multiple times
      expect(progressCallback).toHaveBeenCalled()
      // Initial progress + before each snapshot + after each snapshot
      expect(progressCallback.mock.calls.length).toBeGreaterThanOrEqual(3)

      // Verify progress structure
      const firstCall = progressCallback.mock.calls[0]
      expect(firstCall).toBeDefined()
      expect(firstCall[0]).toHaveProperty('totalItems')
      expect(firstCall[0]).toHaveProperty('processedItems')
      expect(firstCall[0]).toHaveProperty('percentComplete')
    })

    it('should handle snapshot not found', async () => {
      // Arrange
      const snapshotIds = ['2024-01-15', '2024-01-14']
      const progressCallback = createProgressCallback()

      // First snapshot not found, second exists
      mockSnapshotStorage.getSnapshot
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(createMockSnapshot('2024-01-14'))
      mockSnapshotStorage.listDistrictsInSnapshot.mockResolvedValue(['42'])
      mockSnapshotStorage.readDistrictData.mockResolvedValue(
        createMockDistrictData({ asOfDate: '2024-01-14' })
      )

      // Act
      const result = await analyticsGenerator.generateForSnapshots(
        snapshotIds,
        progressCallback
      )

      // Assert - First snapshot skipped, second processed
      expect(result.processedItems).toBe(1)
      expect(result.skippedItems).toBe(1)
    })

    it('should handle empty district list', async () => {
      // Arrange
      const snapshotIds = ['2024-01-15']
      const progressCallback = createProgressCallback()

      mockSnapshotStorage.getSnapshot.mockResolvedValue(
        createMockSnapshot('2024-01-15')
      )
      mockSnapshotStorage.listDistrictsInSnapshot.mockResolvedValue([]) // No districts

      // Act
      const result = await analyticsGenerator.generateForSnapshots(
        snapshotIds,
        progressCallback
      )

      // Assert - Snapshot skipped due to no districts
      expect(result.processedItems).toBe(0)
      expect(result.skippedItems).toBe(1)
    })

    it('should continue processing on individual failures', async () => {
      // Arrange
      const snapshotIds = ['2024-01-15', '2024-01-14', '2024-01-13']
      const progressCallback = createProgressCallback()

      // First snapshot succeeds
      mockSnapshotStorage.getSnapshot
        .mockResolvedValueOnce(createMockSnapshot('2024-01-15'))
        .mockRejectedValueOnce(new Error('Storage error')) // Second fails
        .mockResolvedValueOnce(createMockSnapshot('2024-01-13')) // Third succeeds

      mockSnapshotStorage.listDistrictsInSnapshot.mockResolvedValue(['42'])
      mockSnapshotStorage.readDistrictData.mockResolvedValue(
        createMockDistrictData({ asOfDate: '2024-01-15' })
      )

      // Act
      const result = await analyticsGenerator.generateForSnapshots(
        snapshotIds,
        progressCallback
      )

      // Assert - Should continue after failure
      expect(result.processedItems).toBe(2)
      expect(result.failedItems).toBe(1)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]!.message).toContain('Storage error')
    })

    it('should collect errors for failed snapshots', async () => {
      // Arrange
      const snapshotIds = ['2024-01-15']
      const progressCallback = createProgressCallback()

      mockSnapshotStorage.getSnapshot.mockRejectedValue(
        new Error('Connection timeout')
      )

      // Act
      const result = await analyticsGenerator.generateForSnapshots(
        snapshotIds,
        progressCallback
      )

      // Assert
      expect(result.failedItems).toBe(1)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]!.itemId).toBe('2024-01-15')
      expect(result.errors[0]!.message).toContain('Connection timeout')
      expect(result.errors[0]!.occurredAt).toBeDefined()
    })

    it('should return success=true when all succeed', async () => {
      // Arrange
      const snapshotIds = ['2024-01-15', '2024-01-14']
      const progressCallback = createProgressCallback()

      mockSnapshotStorage.getSnapshot.mockResolvedValue(
        createMockSnapshot('2024-01-15')
      )
      mockSnapshotStorage.listDistrictsInSnapshot.mockResolvedValue(['42'])
      mockSnapshotStorage.readDistrictData.mockResolvedValue(
        createMockDistrictData({ asOfDate: '2024-01-15' })
      )

      // Act
      const result = await analyticsGenerator.generateForSnapshots(
        snapshotIds,
        progressCallback
      )

      // Assert
      expect(result.success).toBe(true)
      expect(result.failedItems).toBe(0)
    })

    it('should return success=false when any fail', async () => {
      // Arrange
      const snapshotIds = ['2024-01-15', '2024-01-14']
      const progressCallback = createProgressCallback()

      mockSnapshotStorage.getSnapshot
        .mockResolvedValueOnce(createMockSnapshot('2024-01-15'))
        .mockRejectedValueOnce(new Error('Failed'))

      mockSnapshotStorage.listDistrictsInSnapshot.mockResolvedValue(['42'])
      mockSnapshotStorage.readDistrictData.mockResolvedValue(
        createMockDistrictData({ asOfDate: '2024-01-15' })
      )

      // Act
      const result = await analyticsGenerator.generateForSnapshots(
        snapshotIds,
        progressCallback
      )

      // Assert
      expect(result.success).toBe(false)
      expect(result.failedItems).toBe(1)
    })

    it('should return duration in result', async () => {
      // Arrange
      const snapshotIds = ['2024-01-15']
      const progressCallback = createProgressCallback()

      mockSnapshotStorage.getSnapshot.mockResolvedValue(
        createMockSnapshot('2024-01-15')
      )
      mockSnapshotStorage.listDistrictsInSnapshot.mockResolvedValue(['42'])
      mockSnapshotStorage.readDistrictData.mockResolvedValue(
        createMockDistrictData({ asOfDate: '2024-01-15' })
      )

      // Act
      const result = await analyticsGenerator.generateForSnapshots(
        snapshotIds,
        progressCallback
      )

      // Assert
      expect(result.duration).toBeGreaterThanOrEqual(0)
      expect(typeof result.duration).toBe('number')
    })
  })

  // ============================================================================
  // Cancellation Tests
  // ============================================================================

  describe('Cancellation', () => {
    it('should stop processing when cancelled', async () => {
      // Arrange
      const snapshotIds = [
        '2024-01-15',
        '2024-01-14',
        '2024-01-13',
        '2024-01-12',
        '2024-01-11',
      ]
      let callCount = 0
      const progressCallback = createProgressCallback()

      mockSnapshotStorage.getSnapshot.mockImplementation(async () => {
        callCount++
        if (callCount === 2) {
          analyticsGenerator.cancel()
        }
        return createMockSnapshot('2024-01-15')
      })
      mockSnapshotStorage.listDistrictsInSnapshot.mockResolvedValue(['42'])
      mockSnapshotStorage.readDistrictData.mockResolvedValue(
        createMockDistrictData({ asOfDate: '2024-01-15' })
      )

      // Act
      const result = await analyticsGenerator.generateForSnapshots(
        snapshotIds,
        progressCallback
      )

      // Assert - Should have stopped after cancellation
      expect(result.success).toBe(false) // Cancelled jobs are not successful
      expect(mockSnapshotStorage.getSnapshot.mock.calls.length).toBeLessThan(5)
    })

    it('should report cancelled state correctly', async () => {
      // Arrange
      expect(analyticsGenerator.isCancelled()).toBe(false)

      // Act
      analyticsGenerator.cancel()

      // Assert
      expect(analyticsGenerator.isCancelled()).toBe(true)
    })

    it('should reset cancelled state for new generator instance', () => {
      // Arrange
      analyticsGenerator.cancel()
      expect(analyticsGenerator.isCancelled()).toBe(true)

      // Act - Create new instance
      const newGenerator = new AnalyticsGenerator(
        mockSnapshotStorage,
        mockTimeSeriesStorage
      )

      // Assert - New instance should not be cancelled
      expect(newGenerator.isCancelled()).toBe(false)
    })
  })

  // ============================================================================
  // Analytics Calculation Tests
  // ============================================================================

  describe('Analytics Calculation', () => {
    it('should calculate total membership correctly from membership.total', async () => {
      // Arrange
      const snapshotIds = ['2024-01-15']
      const progressCallback = createProgressCallback()

      mockSnapshotStorage.getSnapshot.mockResolvedValue(
        createMockSnapshot('2024-01-15')
      )
      mockSnapshotStorage.listDistrictsInSnapshot.mockResolvedValue(['42'])
      mockSnapshotStorage.readDistrictData.mockResolvedValue(
        createMockDistrictData({ asOfDate: '2024-01-15', totalMembership: 500 })
      )

      // Act
      await analyticsGenerator.generateForSnapshots(
        snapshotIds,
        progressCallback
      )

      // Assert - Verify appendDataPoint was called with correct membership
      expect(mockTimeSeriesStorage.appendDataPoint).toHaveBeenCalled()
      const appendCall = mockTimeSeriesStorage.appendDataPoint.mock.calls[0]
      expect(appendCall).toBeDefined()
      const dataPoint = appendCall[1] as TimeSeriesDataPoint
      expect(dataPoint.membership).toBe(500)
    })

    it('should calculate total membership from club performance when membership.total is undefined', async () => {
      // Arrange
      const snapshotIds = ['2024-01-15']
      const progressCallback = createProgressCallback()

      mockSnapshotStorage.getSnapshot.mockResolvedValue(
        createMockSnapshot('2024-01-15')
      )
      mockSnapshotStorage.listDistrictsInSnapshot.mockResolvedValue(['42'])
      mockSnapshotStorage.readDistrictData.mockResolvedValue(
        createMockDistrictData({
          asOfDate: '2024-01-15',
          clubs: [
            { 'Active Members': 25 },
            { 'Active Members': 30 },
            { 'Active Members': 20 },
          ],
        })
      )

      // Act
      await analyticsGenerator.generateForSnapshots(
        snapshotIds,
        progressCallback
      )

      // Assert - Verify appendDataPoint was called with summed membership
      expect(mockTimeSeriesStorage.appendDataPoint).toHaveBeenCalled()
      const appendCall = mockTimeSeriesStorage.appendDataPoint.mock.calls[0]
      expect(appendCall).toBeDefined()
      const dataPoint = appendCall[1] as TimeSeriesDataPoint
      expect(dataPoint.membership).toBe(75) // 25 + 30 + 20
    })

    it('should calculate total payments correctly', async () => {
      // Arrange
      const snapshotIds = ['2024-01-15']
      const progressCallback = createProgressCallback()

      mockSnapshotStorage.getSnapshot.mockResolvedValue(
        createMockSnapshot('2024-01-15')
      )
      mockSnapshotStorage.listDistrictsInSnapshot.mockResolvedValue(['42'])
      mockSnapshotStorage.readDistrictData.mockResolvedValue(
        createMockDistrictData({
          asOfDate: '2024-01-15',
          clubs: [
            { 'Oct. Ren.': 10, 'Apr. Ren.': 8, 'New Members': 5 },
            { 'Oct. Ren.': 15, 'Apr. Ren.': 12, 'New Members': 3 },
          ],
        })
      )

      // Act
      await analyticsGenerator.generateForSnapshots(
        snapshotIds,
        progressCallback
      )

      // Assert - Verify payments calculation
      expect(mockTimeSeriesStorage.appendDataPoint).toHaveBeenCalled()
      const appendCall = mockTimeSeriesStorage.appendDataPoint.mock.calls[0]
      expect(appendCall).toBeDefined()
      const dataPoint = appendCall[1] as TimeSeriesDataPoint
      // (10 + 8 + 5) + (15 + 12 + 3) = 23 + 30 = 53
      expect(dataPoint.payments).toBe(53)
    })

    it('should calculate DCP goals correctly', async () => {
      // Arrange
      const snapshotIds = ['2024-01-15']
      const progressCallback = createProgressCallback()

      mockSnapshotStorage.getSnapshot.mockResolvedValue(
        createMockSnapshot('2024-01-15')
      )
      mockSnapshotStorage.listDistrictsInSnapshot.mockResolvedValue(['42'])
      mockSnapshotStorage.readDistrictData.mockResolvedValue(
        createMockDistrictData({
          asOfDate: '2024-01-15',
          clubs: [{ 'Goals Met': 7 }, { 'Goals Met': 5 }, { 'Goals Met': 3 }],
        })
      )

      // Act
      await analyticsGenerator.generateForSnapshots(
        snapshotIds,
        progressCallback
      )

      // Assert - Verify DCP goals calculation
      expect(mockTimeSeriesStorage.appendDataPoint).toHaveBeenCalled()
      const appendCall = mockTimeSeriesStorage.appendDataPoint.mock.calls[0]
      expect(appendCall).toBeDefined()
      const dataPoint = appendCall[1] as TimeSeriesDataPoint
      expect(dataPoint.dcpGoals).toBe(15) // 7 + 5 + 3
    })

    it('should calculate club health counts correctly', async () => {
      // Arrange
      const snapshotIds = ['2024-01-15']
      const progressCallback = createProgressCallback()

      mockSnapshotStorage.getSnapshot.mockResolvedValue(
        createMockSnapshot('2024-01-15')
      )
      mockSnapshotStorage.listDistrictsInSnapshot.mockResolvedValue(['42'])
      mockSnapshotStorage.readDistrictData.mockResolvedValue(
        createMockDistrictData({
          asOfDate: '2024-01-15',
          clubs: [
            // Thriving: membership >= 20 AND DCP > 0
            { 'Active Members': 25, 'Goals Met': 5, 'Mem. Base': 20 },
            // Vulnerable: membership < 20 AND net growth < 3 AND DCP = 0 (but not intervention)
            { 'Active Members': 15, 'Goals Met': 0, 'Mem. Base': 14 },
            // Intervention Required: membership < 12 AND net growth < 3
            { 'Active Members': 10, 'Goals Met': 0, 'Mem. Base': 10 },
          ],
        })
      )

      // Act
      await analyticsGenerator.generateForSnapshots(
        snapshotIds,
        progressCallback
      )

      // Assert - Verify club health counts
      // Club 1: membership=25, netGrowth=5, dcpGoals=5 -> Thriving (membership>=20 AND dcpGoals>0)
      // Club 2: membership=15, netGrowth=1, dcpGoals=0 -> Vulnerable (not intervention, but dcpGoals=0)
      // Club 3: membership=10, netGrowth=0, dcpGoals=0 -> Intervention (membership<12 AND netGrowth<3)
      expect(mockTimeSeriesStorage.appendDataPoint).toHaveBeenCalled()
      const appendCall = mockTimeSeriesStorage.appendDataPoint.mock.calls[0]
      expect(appendCall).toBeDefined()
      const dataPoint = appendCall[1] as TimeSeriesDataPoint
      expect(dataPoint.clubCounts.total).toBe(3)
      expect(dataPoint.clubCounts.thriving).toBe(1)
      expect(dataPoint.clubCounts.vulnerable).toBe(1)
      expect(dataPoint.clubCounts.interventionRequired).toBe(1)
    })

    it('should calculate distinguished total correctly', async () => {
      // Arrange
      const snapshotIds = ['2024-01-15']
      const progressCallback = createProgressCallback()

      mockSnapshotStorage.getSnapshot.mockResolvedValue(
        createMockSnapshot('2024-01-15')
      )
      mockSnapshotStorage.listDistrictsInSnapshot.mockResolvedValue(['42'])
      mockSnapshotStorage.readDistrictData.mockResolvedValue(
        createMockDistrictData({
          asOfDate: '2024-01-15',
          clubs: [
            // Distinguished: CSP submitted + status field
            {
              'Active Members': 25,
              'Goals Met': 5,
              'Mem. Base': 20,
              'Club Distinguished Status': 'Distinguished',
              CSP: 'yes',
            },
            // Distinguished: CSP submitted + 5+ goals + membership requirement
            {
              'Active Members': 22,
              'Goals Met': 6,
              'Mem. Base': 18,
              'Club Distinguished Status': '',
              CSP: 'yes',
            },
            // Not distinguished: CSP not submitted
            {
              'Active Members': 25,
              'Goals Met': 7,
              'Mem. Base': 20,
              'Club Distinguished Status': 'Distinguished',
              CSP: 'no',
            },
            // Not distinguished: insufficient goals
            {
              'Active Members': 25,
              'Goals Met': 3,
              'Mem. Base': 20,
              'Club Distinguished Status': '',
              CSP: 'yes',
            },
          ],
        })
      )

      // Act
      await analyticsGenerator.generateForSnapshots(
        snapshotIds,
        progressCallback
      )

      // Assert - Verify distinguished total
      expect(mockTimeSeriesStorage.appendDataPoint).toHaveBeenCalled()
      const appendCall = mockTimeSeriesStorage.appendDataPoint.mock.calls[0]
      expect(appendCall).toBeDefined()
      const dataPoint = appendCall[1] as TimeSeriesDataPoint
      expect(dataPoint.distinguishedTotal).toBe(2) // First two clubs are distinguished
    })

    it('should handle missing or null values gracefully', async () => {
      // Arrange
      const snapshotIds = ['2024-01-15']
      const progressCallback = createProgressCallback()

      mockSnapshotStorage.getSnapshot.mockResolvedValue(
        createMockSnapshot('2024-01-15')
      )
      mockSnapshotStorage.listDistrictsInSnapshot.mockResolvedValue(['42'])
      mockSnapshotStorage.readDistrictData.mockResolvedValue({
        asOfDate: '2024-01-15',
        clubPerformance: [
          { 'Active Members': null, 'Goals Met': undefined, 'Oct. Ren.': '' },
          { 'Active Members': 20, 'Goals Met': 5 },
        ],
      })

      // Act
      const result = await analyticsGenerator.generateForSnapshots(
        snapshotIds,
        progressCallback
      )

      // Assert - Should not throw and should process successfully
      expect(result.success).toBe(true)
      expect(mockTimeSeriesStorage.appendDataPoint).toHaveBeenCalled()
    })

    it('should append data point for each district in snapshot', async () => {
      // Arrange
      const snapshotIds = ['2024-01-15']
      const progressCallback = createProgressCallback()

      mockSnapshotStorage.getSnapshot.mockResolvedValue(
        createMockSnapshot('2024-01-15')
      )
      mockSnapshotStorage.listDistrictsInSnapshot.mockResolvedValue([
        '42',
        '61',
        '101',
      ])
      mockSnapshotStorage.readDistrictData.mockResolvedValue(
        createMockDistrictData({ asOfDate: '2024-01-15' })
      )

      // Act
      await analyticsGenerator.generateForSnapshots(
        snapshotIds,
        progressCallback
      )

      // Assert - Should call appendDataPoint for each district
      expect(mockTimeSeriesStorage.appendDataPoint).toHaveBeenCalledTimes(3)
      expect(mockTimeSeriesStorage.appendDataPoint).toHaveBeenCalledWith(
        '42',
        expect.any(Object)
      )
      expect(mockTimeSeriesStorage.appendDataPoint).toHaveBeenCalledWith(
        '61',
        expect.any(Object)
      )
      expect(mockTimeSeriesStorage.appendDataPoint).toHaveBeenCalledWith(
        '101',
        expect.any(Object)
      )
    })
  })

  // ============================================================================
  // Progress Calculation Tests
  // ============================================================================

  describe('Progress Calculation', () => {
    it('should calculate correct percentage complete', async () => {
      // Arrange
      const snapshotIds = [
        '2024-01-15',
        '2024-01-14',
        '2024-01-13',
        '2024-01-12',
      ]
      const progressCallback = createProgressCallback()

      mockSnapshotStorage.getSnapshot.mockResolvedValue(
        createMockSnapshot('2024-01-15')
      )
      mockSnapshotStorage.listDistrictsInSnapshot.mockResolvedValue(['42'])
      mockSnapshotStorage.readDistrictData.mockResolvedValue(
        createMockDistrictData({ asOfDate: '2024-01-15' })
      )

      // Act
      await analyticsGenerator.generateForSnapshots(
        snapshotIds,
        progressCallback
      )

      // Assert - Final progress should be 100%
      const lastCall =
        progressCallback.mock.calls[progressCallback.mock.calls.length - 1]
      expect(lastCall).toBeDefined()
      expect(lastCall[0].percentComplete).toBe(100)
    })

    it('should report 100% when total items is zero', async () => {
      // Arrange
      const snapshotIds: string[] = []
      const progressCallback = createProgressCallback()

      // Act
      await analyticsGenerator.generateForSnapshots(
        snapshotIds,
        progressCallback
      )

      // Assert - Should report 100% for empty list
      expect(progressCallback).toHaveBeenCalled()
      const firstCall = progressCallback.mock.calls[0]
      expect(firstCall).toBeDefined()
      expect(firstCall[0].percentComplete).toBe(100)
    })

    it('should track current item being processed', async () => {
      // Arrange
      const snapshotIds = ['2024-01-15', '2024-01-14']
      const progressCallback = createProgressCallback()
      const currentItems: (string | null)[] = []

      progressCallback.mockImplementation(progress => {
        currentItems.push(progress.currentItem)
      })

      mockSnapshotStorage.getSnapshot.mockResolvedValue(
        createMockSnapshot('2024-01-15')
      )
      mockSnapshotStorage.listDistrictsInSnapshot.mockResolvedValue(['42'])
      mockSnapshotStorage.readDistrictData.mockResolvedValue(
        createMockDistrictData({ asOfDate: '2024-01-15' })
      )

      // Act
      await analyticsGenerator.generateForSnapshots(
        snapshotIds,
        progressCallback
      )

      // Assert - Should have tracked current items
      expect(currentItems).toContain('2024-01-15')
      expect(currentItems).toContain('2024-01-14')
    })
  })
})
