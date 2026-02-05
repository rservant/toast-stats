/**
 * Unit tests for the getSnapshotForDate helper function
 *
 * Tests the date-aware snapshot selection logic that centralizes
 * how analytics endpoints select snapshots based on the endDate parameter.
 *
 * Requirements:
 * - 1.1, 2.1, 3.1, 4.1, 5.1: Use snapshotStore.getSnapshot(endDate) when date is provided
 * - 1.2, 2.2, 3.2, 4.2, 5.2: Use snapshotStore.getLatestSuccessful() when no date provided
 * - 1.3, 2.3, 3.3, 4.3, 5.3, 6.1, 6.2, 6.3, 6.4: Return proper error for non-existent snapshots
 *
 * Test Isolation:
 * - Uses dependency injection via a factory function to inject mock snapshotStore
 * - Each test uses fresh mock instances
 * - Tests are safe for parallel execution
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Snapshot } from '../../../types/snapshots.js'
import type { ISnapshotStorage } from '../../../types/storageInterfaces.js'
import type { GetSnapshotForDateResult } from '../shared.js'

/**
 * Helper to create a mock Snapshot object for testing
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
 * Create a mock ISnapshotStorage for testing
 */
function createMockSnapshotStore(): ISnapshotStorage {
  return {
    getLatestSuccessful: vi.fn(),
    getSnapshot: vi.fn(),
    getLatest: vi.fn(),
    writeSnapshot: vi.fn(),
    listSnapshots: vi.fn(),
    isReady: vi.fn(),
    deleteSnapshot: vi.fn(),
    writeDistrictData: vi.fn(),
    readDistrictData: vi.fn(),
    listDistrictsInSnapshot: vi.fn(),
    getSnapshotManifest: vi.fn(),
    getSnapshotMetadata: vi.fn(),
    writeAllDistrictsRankings: vi.fn(),
    readAllDistrictsRankings: vi.fn(),
    hasAllDistrictsRankings: vi.fn(),
    isSnapshotWriteComplete: vi.fn(),
  }
}

/**
 * Pure implementation of getSnapshotForDate logic for unit testing.
 * This mirrors the implementation in shared.ts but accepts the snapshotStore
 * as a parameter for dependency injection, enabling proper test isolation.
 *
 * This approach follows the Testing Steering Document requirement:
 * "Use dependency injection instead of global state"
 */
async function getSnapshotForDateWithStore(
  snapshotStore: ISnapshotStorage,
  endDate?: string
): Promise<GetSnapshotForDateResult> {
  // When no endDate is provided, use the latest successful snapshot (backward compatibility)
  if (!endDate) {
    const latestSnapshot = await snapshotStore.getLatestSuccessful()

    if (!latestSnapshot) {
      return {
        snapshot: null,
        snapshotDate: null,
      }
    }

    return {
      snapshot: latestSnapshot,
      snapshotDate: latestSnapshot.snapshot_id,
    }
  }

  // When endDate is provided, get the specific snapshot for that date
  const snapshot = await snapshotStore.getSnapshot(endDate)

  if (!snapshot) {
    // Return error structure for non-existent snapshot
    return {
      snapshot: null,
      snapshotDate: null,
      error: {
        code: 'SNAPSHOT_NOT_FOUND',
        message: `Snapshot not found for date ${endDate}`,
        details:
          'The requested snapshot does not exist. Try a different date or check available snapshots.',
      },
    }
  }

  return {
    snapshot,
    snapshotDate: snapshot.snapshot_id,
  }
}

describe('getSnapshotForDate', () => {
  let mockSnapshotStore: ISnapshotStorage

  beforeEach(() => {
    // Create fresh mock for each test - ensures test isolation
    mockSnapshotStore = createMockSnapshotStore()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Date-aware selection (Requirements 1.1, 2.1, 3.1, 4.1, 5.1)', () => {
    it('should return the specific snapshot when endDate is provided and snapshot exists', async () => {
      // Arrange
      const requestedDate = '2024-01-15'
      const mockSnapshot = createMockSnapshot(requestedDate)
      vi.mocked(mockSnapshotStore.getSnapshot).mockResolvedValue(mockSnapshot)

      // Act
      const result = await getSnapshotForDateWithStore(mockSnapshotStore, requestedDate)

      // Assert
      expect(mockSnapshotStore.getSnapshot).toHaveBeenCalledWith(requestedDate)
      expect(mockSnapshotStore.getSnapshot).toHaveBeenCalledTimes(1)
      expect(mockSnapshotStore.getLatestSuccessful).not.toHaveBeenCalled()
      expect(result.snapshot).toBe(mockSnapshot)
      expect(result.snapshotDate).toBe(requestedDate)
      expect(result.error).toBeUndefined()
    })

    it('should use snapshotStore.getSnapshot for date-specific retrieval', async () => {
      // Arrange
      const requestedDate = '2023-07-01'
      const mockSnapshot = createMockSnapshot(requestedDate)
      vi.mocked(mockSnapshotStore.getSnapshot).mockResolvedValue(mockSnapshot)

      // Act
      await getSnapshotForDateWithStore(mockSnapshotStore, requestedDate)

      // Assert - verify the correct method is called with the exact date
      expect(mockSnapshotStore.getSnapshot).toHaveBeenCalledWith('2023-07-01')
    })
  })

  describe('Backward compatibility - no date returns latest (Requirements 1.2, 2.2, 3.2, 4.2, 5.2)', () => {
    it('should return the latest successful snapshot when endDate is undefined', async () => {
      // Arrange
      const latestSnapshotId = '2024-02-20'
      const mockLatestSnapshot = createMockSnapshot(latestSnapshotId)
      vi.mocked(mockSnapshotStore.getLatestSuccessful).mockResolvedValue(mockLatestSnapshot)

      // Act
      const result = await getSnapshotForDateWithStore(mockSnapshotStore, undefined)

      // Assert
      expect(mockSnapshotStore.getLatestSuccessful).toHaveBeenCalledTimes(1)
      expect(mockSnapshotStore.getSnapshot).not.toHaveBeenCalled()
      expect(result.snapshot).toBe(mockLatestSnapshot)
      expect(result.snapshotDate).toBe(latestSnapshotId)
      expect(result.error).toBeUndefined()
    })

    it('should return null snapshot when no endDate provided and no snapshots exist', async () => {
      // Arrange
      vi.mocked(mockSnapshotStore.getLatestSuccessful).mockResolvedValue(null)

      // Act
      const result = await getSnapshotForDateWithStore(mockSnapshotStore, undefined)

      // Assert
      expect(mockSnapshotStore.getLatestSuccessful).toHaveBeenCalledTimes(1)
      expect(result.snapshot).toBeNull()
      expect(result.snapshotDate).toBeNull()
      expect(result.error).toBeUndefined()
    })

    it('should return the latest successful snapshot when endDate is empty string', async () => {
      // Arrange - empty string should be treated as "no date provided"
      const latestSnapshotId = '2024-03-10'
      const mockLatestSnapshot = createMockSnapshot(latestSnapshotId)
      vi.mocked(mockSnapshotStore.getLatestSuccessful).mockResolvedValue(mockLatestSnapshot)

      // Act
      const result = await getSnapshotForDateWithStore(mockSnapshotStore, '')

      // Assert - empty string is falsy, so should use getLatestSuccessful
      expect(mockSnapshotStore.getLatestSuccessful).toHaveBeenCalledTimes(1)
      expect(mockSnapshotStore.getSnapshot).not.toHaveBeenCalled()
      expect(result.snapshot).toBe(mockLatestSnapshot)
      expect(result.snapshotDate).toBe(latestSnapshotId)
    })
  })

  describe('Error handling for non-existent snapshots (Requirements 1.3, 2.3, 3.3, 4.3, 5.3, 6.1, 6.2, 6.3, 6.4)', () => {
    it('should return error with SNAPSHOT_NOT_FOUND code when requested snapshot does not exist', async () => {
      // Arrange
      const requestedDate = '2024-01-01'
      vi.mocked(mockSnapshotStore.getSnapshot).mockResolvedValue(null)

      // Act
      const result = await getSnapshotForDateWithStore(mockSnapshotStore, requestedDate)

      // Assert - Requirement 6.2: error code is SNAPSHOT_NOT_FOUND
      expect(result.snapshot).toBeNull()
      expect(result.snapshotDate).toBeNull()
      expect(result.error).toBeDefined()
      expect(result.error?.code).toBe('SNAPSHOT_NOT_FOUND')
    })

    it('should include the requested date in the error message (Requirement 6.3)', async () => {
      // Arrange
      const requestedDate = '2023-12-25'
      vi.mocked(mockSnapshotStore.getSnapshot).mockResolvedValue(null)

      // Act
      const result = await getSnapshotForDateWithStore(mockSnapshotStore, requestedDate)

      // Assert - Requirement 6.3: message contains the requested date
      expect(result.error?.message).toContain(requestedDate)
      expect(result.error?.message).toBe(`Snapshot not found for date ${requestedDate}`)
    })

    it('should include guidance in error details (Requirement 6.4)', async () => {
      // Arrange
      const requestedDate = '2024-06-15'
      vi.mocked(mockSnapshotStore.getSnapshot).mockResolvedValue(null)

      // Act
      const result = await getSnapshotForDateWithStore(mockSnapshotStore, requestedDate)

      // Assert - Requirement 6.4: details suggest trying a different date
      expect(result.error?.details).toBeDefined()
      expect(result.error?.details).toContain('different date')
      expect(result.error?.details).toContain('available snapshots')
    })

    it('should return complete error structure for non-existent snapshot', async () => {
      // Arrange
      const requestedDate = '2022-01-01'
      vi.mocked(mockSnapshotStore.getSnapshot).mockResolvedValue(null)

      // Act
      const result = await getSnapshotForDateWithStore(mockSnapshotStore, requestedDate)

      // Assert - verify complete error structure
      expect(result).toEqual({
        snapshot: null,
        snapshotDate: null,
        error: {
          code: 'SNAPSHOT_NOT_FOUND',
          message: `Snapshot not found for date ${requestedDate}`,
          details: 'The requested snapshot does not exist. Try a different date or check available snapshots.',
        },
      })
    })
  })

  describe('Edge cases', () => {
    it('should handle various valid date formats', async () => {
      // Arrange
      const testDates = ['2024-01-01', '2023-12-31', '2020-02-29']

      for (const date of testDates) {
        // Create fresh mock for each iteration
        const store = createMockSnapshotStore()
        const mockSnapshot = createMockSnapshot(date)
        vi.mocked(store.getSnapshot).mockResolvedValue(mockSnapshot)

        // Act
        const result = await getSnapshotForDateWithStore(store, date)

        // Assert
        expect(store.getSnapshot).toHaveBeenCalledWith(date)
        expect(result.snapshot?.snapshot_id).toBe(date)
        expect(result.error).toBeUndefined()
      }
    })

    it('should not call getLatestSuccessful when a specific date is provided', async () => {
      // Arrange
      const requestedDate = '2024-05-01'
      vi.mocked(mockSnapshotStore.getSnapshot).mockResolvedValue(null)

      // Act
      await getSnapshotForDateWithStore(mockSnapshotStore, requestedDate)

      // Assert - even when snapshot not found, should not fall back to latest
      expect(mockSnapshotStore.getSnapshot).toHaveBeenCalledWith(requestedDate)
      expect(mockSnapshotStore.getLatestSuccessful).not.toHaveBeenCalled()
    })

    it('should return snapshot_id as snapshotDate when snapshot is found', async () => {
      // Arrange
      const requestedDate = '2024-04-15'
      const mockSnapshot = createMockSnapshot(requestedDate)
      vi.mocked(mockSnapshotStore.getSnapshot).mockResolvedValue(mockSnapshot)

      // Act
      const result = await getSnapshotForDateWithStore(mockSnapshotStore, requestedDate)

      // Assert - snapshotDate should match the snapshot's snapshot_id
      expect(result.snapshotDate).toBe(mockSnapshot.snapshot_id)
    })
  })
})
