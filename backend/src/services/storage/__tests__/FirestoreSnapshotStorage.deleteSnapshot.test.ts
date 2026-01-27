/**
 * Unit tests for FirestoreSnapshotStorage.deleteSnapshot
 *
 * Tests the deleteSnapshot implementation with mocked Firestore client.
 *
 * **Validates: Requirements 2.1, 2.2, 2.4**
 *
 * Requirements:
 * - 2.1: WHEN deleteSnapshot is called on FirestoreSnapshotStorage, THE implementation SHALL delete the root snapshot document
 * - 2.2: WHEN deleteSnapshot is called on FirestoreSnapshotStorage, THE implementation SHALL delete all documents in the districts subcollection
 * - 2.4: IF the snapshot document does not exist, THEN THE FirestoreSnapshotStorage deleteSnapshot method SHALL return false without throwing an error
 *
 * Test Isolation Requirements (per testing steering document):
 * - Each test uses mocked Firestore client
 * - Tests clean up all mocks in afterEach hooks
 * - Tests do not depend on execution order
 * - All tests pass when run with --run (parallel mode)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Mock } from 'vitest'
import { StorageOperationError } from '../../../types/storageInterfaces.js'

// ============================================================================
// Mock Types for Firestore
// ============================================================================

interface MockDocumentSnapshot {
  exists: boolean
  id: string
  ref: MockDocumentReference
  data: () => Record<string, unknown> | undefined
}

interface MockQuerySnapshot {
  empty: boolean
  docs: MockDocumentSnapshot[]
}

interface MockDocumentReference {
  get: Mock
  set: Mock
  update: Mock
  delete: Mock
  collection: Mock
}

interface MockCollectionReference {
  doc: Mock
  get: Mock
  where: Mock
  orderBy: Mock
  limit: Mock
}

interface MockBatch {
  set: Mock
  delete: Mock
  commit: Mock
}

// ============================================================================
// Mock Variables (hoisted)
// ============================================================================

let mockBatch: MockBatch
let mockDocRef: MockDocumentReference
let mockDistrictsCollection: MockCollectionReference
let mockCollection: MockCollectionReference

// ============================================================================
// Mock Setup - Must be before imports that use the mocked modules
// ============================================================================

// Create chainable mock collection
const createMockCollection = (): MockCollectionReference => ({
  doc: vi.fn(),
  get: vi.fn(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
})

const createMockDocRef = (): MockDocumentReference => ({
  get: vi.fn(),
  set: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  collection: vi.fn(),
})

const createMockBatch = (): MockBatch => ({
  set: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  commit: vi.fn().mockResolvedValue(undefined),
})

// Mock the @google-cloud/firestore module
vi.mock('@google-cloud/firestore', () => {
  // Use a class-like constructor function
  const MockFirestore = function (this: Record<string, unknown>) {
    mockBatch = createMockBatch()
    mockDistrictsCollection = createMockCollection()
    mockDocRef = createMockDocRef()
    mockDocRef.collection.mockReturnValue(mockDistrictsCollection)
    mockCollection = createMockCollection()
    mockCollection.doc.mockReturnValue(mockDocRef)

    this.collection = vi.fn().mockReturnValue(mockCollection)
    this.batch = vi.fn().mockReturnValue(mockBatch)
  }

  return {
    Firestore: MockFirestore,
  }
})

// Mock the logger to avoid console output during tests
vi.mock('../../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// Mock the CircuitBreaker to avoid actual circuit breaker behavior
vi.mock('../../../utils/CircuitBreaker.js', () => ({
  CircuitBreaker: {
    createCacheCircuitBreaker: vi.fn(() => ({
      execute: vi.fn(async <T>(operation: () => Promise<T>) => operation()),
      getStats: vi.fn(() => ({
        state: 'CLOSED',
        failureCount: 0,
        successCount: 0,
        totalRequests: 0,
        totalFailures: 0,
        totalSuccesses: 0,
      })),
      reset: vi.fn(),
    })),
  },
}))

// Import after mocks are set up
import { FirestoreSnapshotStorage } from '../FirestoreSnapshotStorage.js'

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a mock document snapshot
 */
function createMockDocSnapshot(
  exists: boolean,
  id: string,
  data?: Record<string, unknown>
): MockDocumentSnapshot {
  const ref = createMockDocRef()
  return {
    exists,
    id,
    ref,
    data: () => data,
  }
}

/**
 * Create a mock query snapshot with district documents
 */
function createMockQuerySnapshot(
  docs: MockDocumentSnapshot[]
): MockQuerySnapshot {
  return {
    empty: docs.length === 0,
    docs,
  }
}

/**
 * Create mock district document snapshots for testing
 */
function createMockDistrictDocs(count: number): MockDocumentSnapshot[] {
  const docs: MockDocumentSnapshot[] = []
  for (let i = 0; i < count; i++) {
    const districtId = `${i + 1}`
    docs.push(
      createMockDocSnapshot(true, `district_${districtId}`, {
        districtId,
        districtName: `District ${districtId}`,
        collectedAt: new Date().toISOString(),
        status: 'success',
        data: {
          districtId,
          asOfDate: '2024-01-15',
        },
      })
    )
  }
  return docs
}

// ============================================================================
// Test Suite
// ============================================================================

describe('FirestoreSnapshotStorage.deleteSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================================
  // Delete Existing Snapshot Tests
  // ============================================================================

  describe('delete existing snapshot', () => {
    /**
     * Test: deleteSnapshot returns true when deleting an existing snapshot
     *
     * **Validates: Requirements 2.1**
     *
     * This test verifies that when a snapshot exists and is deleted,
     * the method returns true and the root document is deleted.
     */
    it('should return true when deleting an existing snapshot', async () => {
      const storage = new FirestoreSnapshotStorage({
        projectId: 'test-project',
      })

      // Mock: Snapshot document exists
      mockDocRef.get.mockResolvedValue(
        createMockDocSnapshot(true, '2024-01-15', {
          metadata: { snapshotId: '2024-01-15', status: 'success' },
          manifest: { snapshotId: '2024-01-15' },
        })
      )

      // Mock: No districts in subcollection
      mockDistrictsCollection.get.mockResolvedValue(createMockQuerySnapshot([]))

      // Mock: Delete succeeds
      mockDocRef.delete.mockResolvedValue(undefined)

      const result = await storage.deleteSnapshot('2024-01-15')

      expect(result).toBe(true)
    })

    /**
     * Test: deleteSnapshot deletes the root snapshot document
     *
     * **Validates: Requirements 2.1**
     *
     * This test verifies that the root snapshot document is deleted
     * when deleteSnapshot is called.
     */
    it('should delete the root snapshot document', async () => {
      const storage = new FirestoreSnapshotStorage({
        projectId: 'test-project',
      })

      // Mock: Snapshot document exists
      mockDocRef.get.mockResolvedValue(
        createMockDocSnapshot(true, '2024-01-15', {
          metadata: { snapshotId: '2024-01-15', status: 'success' },
          manifest: { snapshotId: '2024-01-15' },
        })
      )

      // Mock: No districts in subcollection
      mockDistrictsCollection.get.mockResolvedValue(createMockQuerySnapshot([]))

      // Mock: Delete succeeds
      mockDocRef.delete.mockResolvedValue(undefined)

      await storage.deleteSnapshot('2024-01-15')

      // Verify the root document delete was called
      expect(mockDocRef.delete).toHaveBeenCalled()
    })
  })

  // ============================================================================
  // Delete Non-Existent Snapshot Tests
  // ============================================================================

  describe('delete non-existent snapshot', () => {
    /**
     * Test: deleteSnapshot returns false when snapshot doesn't exist
     *
     * **Validates: Requirements 2.4**
     *
     * This test verifies that when attempting to delete a snapshot that
     * doesn't exist, the method returns false without throwing an error.
     */
    it('should return false when deleting a non-existent snapshot', async () => {
      const storage = new FirestoreSnapshotStorage({
        projectId: 'test-project',
      })

      // Mock: Snapshot document does not exist
      mockDocRef.get.mockResolvedValue(
        createMockDocSnapshot(false, '2024-12-31')
      )

      const result = await storage.deleteSnapshot('2024-12-31')

      expect(result).toBe(false)
    })

    /**
     * Test: deleteSnapshot does not throw when snapshot doesn't exist
     *
     * **Validates: Requirements 2.4**
     *
     * This test explicitly verifies that no error is thrown when
     * attempting to delete a non-existent snapshot.
     */
    it('should not throw an error when snapshot does not exist', async () => {
      const storage = new FirestoreSnapshotStorage({
        projectId: 'test-project',
      })

      // Mock: Snapshot document does not exist
      mockDocRef.get.mockResolvedValue(
        createMockDocSnapshot(false, '2024-12-31')
      )

      await expect(storage.deleteSnapshot('2024-12-31')).resolves.not.toThrow()
    })

    /**
     * Test: deleteSnapshot does not attempt to delete when snapshot doesn't exist
     *
     * **Validates: Requirements 2.4**
     *
     * This test verifies that no delete operations are performed
     * when the snapshot doesn't exist.
     */
    it('should not attempt to delete when snapshot does not exist', async () => {
      const storage = new FirestoreSnapshotStorage({
        projectId: 'test-project',
      })

      // Mock: Snapshot document does not exist
      mockDocRef.get.mockResolvedValue(
        createMockDocSnapshot(false, '2024-12-31')
      )

      await storage.deleteSnapshot('2024-12-31')

      // Verify no delete operations were called
      expect(mockDocRef.delete).not.toHaveBeenCalled()
      expect(mockBatch.delete).not.toHaveBeenCalled()
      expect(mockBatch.commit).not.toHaveBeenCalled()
    })
  })

  // ============================================================================
  // Districts Subcollection Deletion Tests
  // ============================================================================

  describe('districts subcollection deletion', () => {
    /**
     * Test: deleteSnapshot deletes all documents in districts subcollection
     *
     * **Validates: Requirements 2.2**
     *
     * This test verifies that all district documents in the subcollection
     * are deleted when the snapshot is deleted.
     */
    it('should delete all documents in the districts subcollection', async () => {
      const storage = new FirestoreSnapshotStorage({
        projectId: 'test-project',
      })

      // Mock: Snapshot document exists
      mockDocRef.get.mockResolvedValue(
        createMockDocSnapshot(true, '2024-01-15', {
          metadata: { snapshotId: '2024-01-15', status: 'success' },
          manifest: { snapshotId: '2024-01-15' },
        })
      )

      // Mock: 3 districts in subcollection
      const districtDocs = createMockDistrictDocs(3)
      mockDistrictsCollection.get.mockResolvedValue(
        createMockQuerySnapshot(districtDocs)
      )

      // Mock: Delete succeeds
      mockDocRef.delete.mockResolvedValue(undefined)

      await storage.deleteSnapshot('2024-01-15')

      // Verify batch delete was called for each district
      expect(mockBatch.delete).toHaveBeenCalledTimes(3)
      expect(mockBatch.commit).toHaveBeenCalled()
    })

    /**
     * Test: deleteSnapshot handles snapshot with no districts
     *
     * **Validates: Requirements 2.1, 2.2**
     *
     * This test verifies that deletion works correctly when the snapshot
     * has no district documents in the subcollection.
     */
    it('should handle snapshot with no districts', async () => {
      const storage = new FirestoreSnapshotStorage({
        projectId: 'test-project',
      })

      // Mock: Snapshot document exists
      mockDocRef.get.mockResolvedValue(
        createMockDocSnapshot(true, '2024-01-15', {
          metadata: { snapshotId: '2024-01-15', status: 'success' },
          manifest: { snapshotId: '2024-01-15' },
        })
      )

      // Mock: No districts in subcollection
      mockDistrictsCollection.get.mockResolvedValue(createMockQuerySnapshot([]))

      // Mock: Delete succeeds
      mockDocRef.delete.mockResolvedValue(undefined)

      const result = await storage.deleteSnapshot('2024-01-15')

      expect(result).toBe(true)
      // Verify root document was still deleted
      expect(mockDocRef.delete).toHaveBeenCalled()
      // Verify no batch deletes were needed for districts
      expect(mockBatch.delete).not.toHaveBeenCalled()
    })
  })

  // ============================================================================
  // Batched Deletion Tests (>500 districts)
  // ============================================================================

  describe('batched deletion for >500 districts', () => {
    /**
     * Test: deleteSnapshot uses batched deletion for large number of districts
     *
     * **Validates: Requirements 2.2**
     *
     * This test verifies that when there are more than 500 districts,
     * the deletion is performed in batches (Firestore batch limit is 500).
     */
    it('should use batched deletion when there are more than 500 districts', async () => {
      const storage = new FirestoreSnapshotStorage({
        projectId: 'test-project',
      })

      // Mock: Snapshot document exists
      mockDocRef.get.mockResolvedValue(
        createMockDocSnapshot(true, '2024-01-15', {
          metadata: { snapshotId: '2024-01-15', status: 'success' },
          manifest: { snapshotId: '2024-01-15' },
        })
      )

      // Mock: 750 districts in subcollection (requires 2 batches)
      const districtDocs = createMockDistrictDocs(750)
      mockDistrictsCollection.get.mockResolvedValue(
        createMockQuerySnapshot(districtDocs)
      )

      // Mock: Delete succeeds
      mockDocRef.delete.mockResolvedValue(undefined)

      await storage.deleteSnapshot('2024-01-15')

      // Verify batch delete was called for all 750 districts
      expect(mockBatch.delete).toHaveBeenCalledTimes(750)
      // Verify batch commit was called twice (500 + 250)
      expect(mockBatch.commit).toHaveBeenCalledTimes(2)
    })

    /**
     * Test: deleteSnapshot handles exactly 500 districts in single batch
     *
     * **Validates: Requirements 2.2**
     *
     * This test verifies that exactly 500 districts are handled in a single batch.
     */
    it('should handle exactly 500 districts in a single batch', async () => {
      const storage = new FirestoreSnapshotStorage({
        projectId: 'test-project',
      })

      // Mock: Snapshot document exists
      mockDocRef.get.mockResolvedValue(
        createMockDocSnapshot(true, '2024-01-15', {
          metadata: { snapshotId: '2024-01-15', status: 'success' },
          manifest: { snapshotId: '2024-01-15' },
        })
      )

      // Mock: Exactly 500 districts in subcollection
      const districtDocs = createMockDistrictDocs(500)
      mockDistrictsCollection.get.mockResolvedValue(
        createMockQuerySnapshot(districtDocs)
      )

      // Mock: Delete succeeds
      mockDocRef.delete.mockResolvedValue(undefined)

      await storage.deleteSnapshot('2024-01-15')

      // Verify batch delete was called for all 500 districts
      expect(mockBatch.delete).toHaveBeenCalledTimes(500)
      // Verify batch commit was called once
      expect(mockBatch.commit).toHaveBeenCalledTimes(1)
    })

    /**
     * Test: deleteSnapshot handles 501 districts requiring two batches
     *
     * **Validates: Requirements 2.2**
     *
     * This test verifies that 501 districts are handled in two batches
     * (500 + 1).
     */
    it('should handle 501 districts requiring two batches', async () => {
      const storage = new FirestoreSnapshotStorage({
        projectId: 'test-project',
      })

      // Mock: Snapshot document exists
      mockDocRef.get.mockResolvedValue(
        createMockDocSnapshot(true, '2024-01-15', {
          metadata: { snapshotId: '2024-01-15', status: 'success' },
          manifest: { snapshotId: '2024-01-15' },
        })
      )

      // Mock: 501 districts in subcollection (requires 2 batches)
      const districtDocs = createMockDistrictDocs(501)
      mockDistrictsCollection.get.mockResolvedValue(
        createMockQuerySnapshot(districtDocs)
      )

      // Mock: Delete succeeds
      mockDocRef.delete.mockResolvedValue(undefined)

      await storage.deleteSnapshot('2024-01-15')

      // Verify batch delete was called for all 501 districts
      expect(mockBatch.delete).toHaveBeenCalledTimes(501)
      // Verify batch commit was called twice (500 + 1)
      expect(mockBatch.commit).toHaveBeenCalledTimes(2)
    })

    /**
     * Test: deleteSnapshot handles 1000 districts requiring two full batches
     *
     * **Validates: Requirements 2.2**
     *
     * This test verifies that 1000 districts are handled in two full batches.
     */
    it('should handle 1000 districts requiring two full batches', async () => {
      const storage = new FirestoreSnapshotStorage({
        projectId: 'test-project',
      })

      // Mock: Snapshot document exists
      mockDocRef.get.mockResolvedValue(
        createMockDocSnapshot(true, '2024-01-15', {
          metadata: { snapshotId: '2024-01-15', status: 'success' },
          manifest: { snapshotId: '2024-01-15' },
        })
      )

      // Mock: 1000 districts in subcollection (requires 2 batches)
      const districtDocs = createMockDistrictDocs(1000)
      mockDistrictsCollection.get.mockResolvedValue(
        createMockQuerySnapshot(districtDocs)
      )

      // Mock: Delete succeeds
      mockDocRef.delete.mockResolvedValue(undefined)

      await storage.deleteSnapshot('2024-01-15')

      // Verify batch delete was called for all 1000 districts
      expect(mockBatch.delete).toHaveBeenCalledTimes(1000)
      // Verify batch commit was called twice (500 + 500)
      expect(mockBatch.commit).toHaveBeenCalledTimes(2)
    })
  })

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('error handling', () => {
    /**
     * Test: deleteSnapshot throws StorageOperationError on Firestore error
     *
     * **Validates: Requirements 2.1**
     *
     * This test verifies that Firestore errors are wrapped in StorageOperationError.
     */
    it('should throw StorageOperationError when Firestore delete fails', async () => {
      const storage = new FirestoreSnapshotStorage({
        projectId: 'test-project',
      })

      // Mock: Snapshot document exists
      mockDocRef.get.mockResolvedValue(
        createMockDocSnapshot(true, '2024-01-15', {
          metadata: { snapshotId: '2024-01-15', status: 'success' },
          manifest: { snapshotId: '2024-01-15' },
        })
      )

      // Mock: No districts in subcollection
      mockDistrictsCollection.get.mockResolvedValue(createMockQuerySnapshot([]))

      // Mock: Delete fails
      mockDocRef.delete.mockRejectedValue(new Error('Firestore delete failed'))

      await expect(storage.deleteSnapshot('2024-01-15')).rejects.toThrow(
        StorageOperationError
      )
    })

    /**
     * Test: deleteSnapshot validates snapshot ID format
     *
     * **Validates: Requirements 2.1**
     *
     * This test verifies that invalid snapshot IDs are rejected.
     */
    it('should reject invalid snapshot ID format', async () => {
      const storage = new FirestoreSnapshotStorage({
        projectId: 'test-project',
      })

      await expect(storage.deleteSnapshot('invalid-date')).rejects.toThrow(
        StorageOperationError
      )
      await expect(storage.deleteSnapshot('2024/01/15')).rejects.toThrow(
        StorageOperationError
      )
      await expect(storage.deleteSnapshot('')).rejects.toThrow(
        StorageOperationError
      )
    })

    /**
     * Test: deleteSnapshot throws StorageOperationError when batch commit fails
     *
     * **Validates: Requirements 2.2**
     *
     * This test verifies that batch commit errors are properly handled.
     */
    it('should throw StorageOperationError when batch commit fails', async () => {
      const storage = new FirestoreSnapshotStorage({
        projectId: 'test-project',
      })

      // Mock: Snapshot document exists
      mockDocRef.get.mockResolvedValue(
        createMockDocSnapshot(true, '2024-01-15', {
          metadata: { snapshotId: '2024-01-15', status: 'success' },
          manifest: { snapshotId: '2024-01-15' },
        })
      )

      // Mock: 3 districts in subcollection
      const districtDocs = createMockDistrictDocs(3)
      mockDistrictsCollection.get.mockResolvedValue(
        createMockQuerySnapshot(districtDocs)
      )

      // Mock: Batch commit fails
      mockBatch.commit.mockRejectedValue(new Error('Batch commit failed'))

      await expect(storage.deleteSnapshot('2024-01-15')).rejects.toThrow(
        StorageOperationError
      )
    })
  })
})
