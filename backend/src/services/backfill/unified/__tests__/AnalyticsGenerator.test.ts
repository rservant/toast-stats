/**
 * AnalyticsGenerator Unit Tests
 *
 * Tests the AnalyticsGenerator component for the Unified Backfill Service.
 * Validates Requirements 15.1-15.7 from the spec.
 *
 * NOTE: Per the data-computation-separation steering document, the AnalyticsGenerator
 * no longer performs any computation. All analytics and time-series data are now
 * pre-computed by scraper-cli. These tests verify the read-only behavior.
 *
 * Test Coverage:
 * 1. Preview functionality - snapshot selection with and without date range
 * 2. Verification execution - verifying snapshots exist (no computation)
 * 3. Cancellation - stopping processing gracefully
 * 4. Read-only compliance - verifying no computation methods exist
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
import type { ISnapshotStorage } from '../../../../types/storageInterfaces.js'
import type { Snapshot, SnapshotMetadata } from '../../../../types/snapshots.js'
import type { PreComputedAnalyticsService } from '../../../PreComputedAnalyticsService.js'

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
 * Create a mock PreComputedAnalyticsService implementation
 *
 * NOTE: This service is no longer used by AnalyticsGenerator but is kept
 * for backward compatibility in the constructor signature.
 */
function createMockPreComputedAnalyticsService(): PreComputedAnalyticsService & {
  computeAndStore: Mock
} {
  return {
    computeAndStore: vi.fn().mockResolvedValue(undefined),
    getAnalyticsSummary: vi.fn().mockResolvedValue(null),
    getLatestSummary: vi.fn().mockResolvedValue(null),
  } as unknown as PreComputedAnalyticsService & {
    computeAndStore: Mock
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

// ============================================================================
// Test Suite
// ============================================================================

describe('AnalyticsGenerator', () => {
  let mockSnapshotStorage: ReturnType<typeof createMockSnapshotStorage>
  let mockPreComputedAnalyticsService: ReturnType<
    typeof createMockPreComputedAnalyticsService
  >
  let analyticsGenerator: AnalyticsGenerator

  beforeEach(() => {
    vi.clearAllMocks()
    mockSnapshotStorage = createMockSnapshotStorage()
    mockPreComputedAnalyticsService = createMockPreComputedAnalyticsService()
    analyticsGenerator = new AnalyticsGenerator(
      mockSnapshotStorage,
      mockPreComputedAnalyticsService
    )
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================================
  // Read-Only Compliance Tests (Requirements 15.1-15.7)
  // ============================================================================

  describe('Read-Only Compliance', () => {
    it('should not have buildTimeSeriesDataPoint method', () => {
      // Validates: Requirement 15.1
      expect(
        (analyticsGenerator as unknown as Record<string, unknown>)['buildTimeSeriesDataPoint']
      ).toBeUndefined()
    })

    it('should not have calculateTotalMembership method', () => {
      // Validates: Requirement 15.2
      expect(
        (analyticsGenerator as unknown as Record<string, unknown>)['calculateTotalMembership']
      ).toBeUndefined()
    })

    it('should not have calculateTotalPayments method', () => {
      // Validates: Requirement 15.3
      expect(
        (analyticsGenerator as unknown as Record<string, unknown>)['calculateTotalPayments']
      ).toBeUndefined()
    })

    it('should not have calculateTotalDCPGoals method', () => {
      // Validates: Requirement 15.4
      expect(
        (analyticsGenerator as unknown as Record<string, unknown>)['calculateTotalDCPGoals']
      ).toBeUndefined()
    })

    it('should not have calculateClubHealthCounts method', () => {
      // Validates: Requirement 15.5
      expect(
        (analyticsGenerator as unknown as Record<string, unknown>)['calculateClubHealthCounts']
      ).toBeUndefined()
    })

    it('should not have calculateDistinguishedTotal method', () => {
      // Validates: Requirement 15.6
      expect(
        (analyticsGenerator as unknown as Record<string, unknown>)['calculateDistinguishedTotal']
      ).toBeUndefined()
    })

    it('should not have isDistinguished method', () => {
      // Validates: Requirement 15.1-15.6 (helper method removed)
      expect(
        (analyticsGenerator as unknown as Record<string, unknown>)['isDistinguished']
      ).toBeUndefined()
    })

    it('should not have parseIntSafe method', () => {
      // Validates: Requirement 15.1-15.6 (helper method removed)
      expect(
        (analyticsGenerator as unknown as Record<string, unknown>)['parseIntSafe']
      ).toBeUndefined()
    })

    it('should not call computeAndStore on PreComputedAnalyticsService', async () => {
      // Validates: Requirement 15.7 - read pre-computed data only
      const snapshotIds = ['2024-01-15']
      const progressCallback = createProgressCallback()

      mockSnapshotStorage.getSnapshot.mockResolvedValue(
        createMockSnapshot('2024-01-15')
      )
      mockSnapshotStorage.listDistrictsInSnapshot.mockResolvedValue(['42', '61'])

      await analyticsGenerator.generateForSnapshots(
        snapshotIds,
        progressCallback
      )

      // computeAndStore should NOT be called - analytics are pre-computed by scraper-cli
      expect(mockPreComputedAnalyticsService.computeAndStore).not.toHaveBeenCalled()
    })

    it('should not read district data for computation', async () => {
      // Validates: Requirement 15.7 - no computation, only verification
      const snapshotIds = ['2024-01-15']
      const progressCallback = createProgressCallback()

      mockSnapshotStorage.getSnapshot.mockResolvedValue(
        createMockSnapshot('2024-01-15')
      )
      mockSnapshotStorage.listDistrictsInSnapshot.mockResolvedValue(['42', '61'])

      await analyticsGenerator.generateForSnapshots(
        snapshotIds,
        progressCallback
      )

      // readDistrictData should NOT be called - we only verify snapshot exists
      expect(mockSnapshotStorage.readDistrictData).not.toHaveBeenCalled()
    })
  })

  // ============================================================================
  // Preview Functionality Tests (Requirements 4.5, 11.2)
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
  // Verification Execution Tests (Requirements 15.7)
  // ============================================================================

  describe('Verification Execution', () => {
    it('should verify all specified snapshots exist', async () => {
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
        mockPreComputedAnalyticsService
      )

      // Assert - New instance should not be cancelled
      expect(newGenerator.isCancelled()).toBe(false)
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

  // ============================================================================
  // Constructor Backward Compatibility Tests
  // ============================================================================

  describe('Constructor Backward Compatibility', () => {
    it('should accept PreComputedAnalyticsService parameter for backward compatibility', () => {
      // The constructor should accept the parameter without error
      // even though it's no longer used
      const generator = new AnalyticsGenerator(
        mockSnapshotStorage,
        mockPreComputedAnalyticsService
      )

      expect(generator).toBeDefined()
      expect(generator.isCancelled()).toBe(false)
    })
  })
})
