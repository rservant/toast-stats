/**
 * Graceful Degradation Unit Tests
 *
 * Tests that Firestore storage methods gracefully handle missing index errors
 * by returning safe default values instead of throwing exceptions.
 *
 * Feature: firestore-index-fix
 *
 * Property 1: Graceful Degradation on Index Failure
 * For any storage method in `FirestoreSnapshotStorage` or `FirestoreDistrictConfigStorage`
 * that executes a Firestore query requiring a composite index, if the query fails with a
 * `FAILED_PRECONDITION` error containing "index", the method SHALL return a safe default
 * value (empty array for list operations, null for single-item operations) instead of
 * throwing an exception.
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4
 *
 * Test Isolation Requirements (per testing steering document):
 * - Each test uses mocked Firestore client
 * - Tests clean up all mocks in afterEach hooks
 * - Tests do not depend on execution order
 * - All tests pass when run with --run (parallel mode)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Mock } from 'vitest'

// ============================================================================
// Mock Types for Firestore
// ============================================================================

interface MockDocumentSnapshot {
  exists: boolean
  id: string
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
  collection: Mock
}

interface MockCollectionReference {
  doc: Mock
  get: Mock
  where: Mock
  orderBy: Mock
  limit: Mock
  add: Mock
}

// ============================================================================
// Mock Variables (hoisted)
// ============================================================================

let mockBatch: { set: Mock; commit: Mock }
let mockDocRef: MockDocumentReference
let mockDistrictsCollection: MockCollectionReference
let mockCollection: MockCollectionReference
let mockHistoryCollection: MockCollectionReference

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
  add: vi.fn(),
})

const createMockDocRef = (): MockDocumentReference => ({
  get: vi.fn(),
  set: vi.fn(),
  update: vi.fn(),
  collection: vi.fn(),
})

const createMockBatch = () => ({
  set: vi.fn().mockReturnThis(),
  commit: vi.fn().mockResolvedValue(undefined),
})

// Mock the @google-cloud/firestore module
vi.mock('@google-cloud/firestore', () => {
  // Use a class-like constructor function
  const MockFirestore = function (this: Record<string, unknown>) {
    mockBatch = createMockBatch()
    mockDistrictsCollection = createMockCollection()
    mockHistoryCollection = createMockCollection()
    mockDocRef = createMockDocRef()
    mockDocRef.collection.mockReturnValue(mockDistrictsCollection)
    mockCollection = createMockCollection()
    mockCollection.doc.mockReturnValue(mockDocRef)

    this.collection = vi.fn((path: string) => {
      if (path.includes('history')) {
        return mockHistoryCollection
      }
      return mockCollection
    })
    this.doc = vi.fn().mockReturnValue(mockDocRef)
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

// Mock the CircuitBreaker to pass through operations
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
import { FirestoreDistrictConfigStorage } from '../FirestoreDistrictConfigStorage.js'
import { StorageOperationError } from '../../../types/storageInterfaces.js'
import { logger } from '../../../utils/logger.js'

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a Firestore index error with the typical error message format
 */
function createIndexError(operation: string): Error {
  return new Error(
    `9 FAILED_PRECONDITION: The query requires an index. You can create it here: https://console.firebase.google.com/v1/r/project/test-project/firestore/indexes?create_composite=abc123_${operation}`
  )
}

/**
 * Create a non-index error (e.g., network error)
 */
function createNetworkError(): Error {
  return new Error('14 UNAVAILABLE: Service temporarily unavailable')
}

/**
 * Create a FAILED_PRECONDITION error without index keyword
 */
function createNonIndexPreconditionError(): Error {
  return new Error('9 FAILED_PRECONDITION: Document already exists')
}

// ============================================================================
// Test Suite
// ============================================================================

describe('Graceful Degradation on Index Failure', () => {
  describe('Feature: firestore-index-fix', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    afterEach(() => {
      vi.clearAllMocks()
    })

    // ========================================================================
    // FirestoreSnapshotStorage Tests
    // ========================================================================

    describe('FirestoreSnapshotStorage', () => {
      /**
       * Property 1: Graceful Degradation on Index Failure
       * Validates: Requirement 2.1
       *
       * WHEN the `listSnapshots` operation fails due to a missing index
       * THEN THE Snapshot_Storage SHALL return an empty array with a logged warning
       */
      describe('listSnapshots graceful degradation', () => {
        it('should return empty array when Firestore throws index error', async () => {
          const storage = new FirestoreSnapshotStorage({
            projectId: 'test-project',
          })

          mockCollection.get.mockRejectedValue(
            createIndexError('listSnapshots')
          )

          const result = await storage.listSnapshots()

          expect(result).toEqual([])
        })

        it('should log warning with index URL when index error occurs', async () => {
          const storage = new FirestoreSnapshotStorage({
            projectId: 'test-project',
          })

          mockCollection.get.mockRejectedValue(
            createIndexError('listSnapshots')
          )

          await storage.listSnapshots()

          expect(logger.warn).toHaveBeenCalledWith(
            'Firestore query failed due to missing index',
            expect.objectContaining({
              operation: 'listSnapshots',
              indexUrl: expect.stringContaining(
                'https://console.firebase.google.com'
              ),
              recommendation: expect.stringContaining('firebase deploy'),
            })
          )
        })

        it('should throw StorageOperationError for non-index errors', async () => {
          const storage = new FirestoreSnapshotStorage({
            projectId: 'test-project',
          })

          mockCollection.get.mockRejectedValue(createNetworkError())

          await expect(storage.listSnapshots()).rejects.toThrow(
            StorageOperationError
          )
        })

        it('should throw for FAILED_PRECONDITION without index keyword', async () => {
          const storage = new FirestoreSnapshotStorage({
            projectId: 'test-project',
          })

          mockCollection.get.mockRejectedValue(
            createNonIndexPreconditionError()
          )

          await expect(storage.listSnapshots()).rejects.toThrow(
            StorageOperationError
          )
        })
      })

      /**
       * Property 1: Graceful Degradation on Index Failure
       * Validates: Requirement 2.2
       *
       * WHEN the `getLatestSuccessful` operation fails due to a missing index
       * THEN THE Snapshot_Storage SHALL return null with a logged warning
       */
      describe('getLatestSuccessful graceful degradation', () => {
        it('should return null when Firestore throws index error', async () => {
          const storage = new FirestoreSnapshotStorage({
            projectId: 'test-project',
          })

          mockCollection.get.mockRejectedValue(
            createIndexError('getLatestSuccessful')
          )

          const result = await storage.getLatestSuccessful()

          expect(result).toBeNull()
        })

        it('should log warning with index URL when index error occurs', async () => {
          const storage = new FirestoreSnapshotStorage({
            projectId: 'test-project',
          })

          mockCollection.get.mockRejectedValue(
            createIndexError('getLatestSuccessful')
          )

          await storage.getLatestSuccessful()

          expect(logger.warn).toHaveBeenCalledWith(
            'Firestore query failed due to missing index',
            expect.objectContaining({
              operation: 'getLatestSuccessful',
              indexUrl: expect.stringContaining(
                'https://console.firebase.google.com'
              ),
              recommendation: expect.stringContaining('firebase deploy'),
            })
          )
        })

        it('should throw StorageOperationError for non-index errors', async () => {
          const storage = new FirestoreSnapshotStorage({
            projectId: 'test-project',
          })

          mockCollection.get.mockRejectedValue(createNetworkError())

          await expect(storage.getLatestSuccessful()).rejects.toThrow(
            StorageOperationError
          )
        })

        it('should throw for FAILED_PRECONDITION without index keyword', async () => {
          const storage = new FirestoreSnapshotStorage({
            projectId: 'test-project',
          })

          mockCollection.get.mockRejectedValue(
            createNonIndexPreconditionError()
          )

          await expect(storage.getLatestSuccessful()).rejects.toThrow(
            StorageOperationError
          )
        })
      })

      /**
       * Property 1: Graceful Degradation on Index Failure
       * Validates: Requirement 2.3
       *
       * WHEN the `getLatest` operation fails due to a missing index
       * THEN THE Snapshot_Storage SHALL return null with a logged warning
       */
      describe('getLatest graceful degradation', () => {
        it('should return null when Firestore throws index error', async () => {
          const storage = new FirestoreSnapshotStorage({
            projectId: 'test-project',
          })

          mockCollection.get.mockRejectedValue(createIndexError('getLatest'))

          const result = await storage.getLatest()

          expect(result).toBeNull()
        })

        it('should log warning with index URL when index error occurs', async () => {
          const storage = new FirestoreSnapshotStorage({
            projectId: 'test-project',
          })

          mockCollection.get.mockRejectedValue(createIndexError('getLatest'))

          await storage.getLatest()

          expect(logger.warn).toHaveBeenCalledWith(
            'Firestore query failed due to missing index',
            expect.objectContaining({
              operation: 'getLatest',
              indexUrl: expect.stringContaining(
                'https://console.firebase.google.com'
              ),
              recommendation: expect.stringContaining('firebase deploy'),
            })
          )
        })

        it('should throw StorageOperationError for non-index errors', async () => {
          const storage = new FirestoreSnapshotStorage({
            projectId: 'test-project',
          })

          mockCollection.get.mockRejectedValue(createNetworkError())

          await expect(storage.getLatest()).rejects.toThrow(
            StorageOperationError
          )
        })

        it('should throw for FAILED_PRECONDITION without index keyword', async () => {
          const storage = new FirestoreSnapshotStorage({
            projectId: 'test-project',
          })

          mockCollection.get.mockRejectedValue(
            createNonIndexPreconditionError()
          )

          await expect(storage.getLatest()).rejects.toThrow(
            StorageOperationError
          )
        })
      })
    })

    // ========================================================================
    // FirestoreDistrictConfigStorage Tests
    // ========================================================================

    describe('FirestoreDistrictConfigStorage', () => {
      /**
       * Property 1: Graceful Degradation on Index Failure
       * Validates: Requirement 2.4
       *
       * WHEN the `getChangeHistory` operation fails due to a missing index
       * THEN THE District_Config_Storage SHALL return an empty array with a logged warning
       */
      describe('getChangeHistory graceful degradation', () => {
        it('should return empty array when Firestore throws index error', async () => {
          const storage = new FirestoreDistrictConfigStorage({
            projectId: 'test-project',
          })

          mockHistoryCollection.get.mockRejectedValue(
            createIndexError('getChangeHistory')
          )

          const result = await storage.getChangeHistory(10)

          expect(result).toEqual([])
        })

        it('should log warning with index URL when index error occurs', async () => {
          const storage = new FirestoreDistrictConfigStorage({
            projectId: 'test-project',
          })

          mockHistoryCollection.get.mockRejectedValue(
            createIndexError('getChangeHistory')
          )

          await storage.getChangeHistory(10)

          expect(logger.warn).toHaveBeenCalledWith(
            'Firestore query failed due to missing index',
            expect.objectContaining({
              operation: 'getChangeHistory',
              indexUrl: expect.stringContaining(
                'https://console.firebase.google.com'
              ),
              recommendation: expect.stringContaining('firebase deploy'),
            })
          )
        })

        it('should throw StorageOperationError for non-index errors', async () => {
          const storage = new FirestoreDistrictConfigStorage({
            projectId: 'test-project',
          })

          mockHistoryCollection.get.mockRejectedValue(createNetworkError())

          await expect(storage.getChangeHistory(10)).rejects.toThrow(
            StorageOperationError
          )
        })

        it('should throw for FAILED_PRECONDITION without index keyword', async () => {
          const storage = new FirestoreDistrictConfigStorage({
            projectId: 'test-project',
          })

          mockHistoryCollection.get.mockRejectedValue(
            createNonIndexPreconditionError()
          )

          await expect(storage.getChangeHistory(10)).rejects.toThrow(
            StorageOperationError
          )
        })
      })
    })

    // ========================================================================
    // Cross-cutting Concerns
    // ========================================================================

    describe('Index error detection edge cases', () => {
      it('should handle index error with lowercase "index" keyword', async () => {
        const storage = new FirestoreSnapshotStorage({
          projectId: 'test-project',
        })

        const error = new Error(
          'FAILED_PRECONDITION: Missing composite index for query'
        )
        mockCollection.get.mockRejectedValue(error)

        const result = await storage.listSnapshots()

        expect(result).toEqual([])
      })

      it('should handle index error with "index" appearing after FAILED_PRECONDITION', async () => {
        const storage = new FirestoreSnapshotStorage({
          projectId: 'test-project',
        })

        const error = new Error(
          'Query failed: FAILED_PRECONDITION - requires index creation'
        )
        mockCollection.get.mockRejectedValue(error)

        const result = await storage.listSnapshots()

        expect(result).toEqual([])
      })

      it('should log null indexUrl when error message has no URL', async () => {
        const storage = new FirestoreSnapshotStorage({
          projectId: 'test-project',
        })

        const error = new Error(
          'FAILED_PRECONDITION: Missing index for this query'
        )
        mockCollection.get.mockRejectedValue(error)

        await storage.listSnapshots()

        expect(logger.warn).toHaveBeenCalledWith(
          'Firestore query failed due to missing index',
          expect.objectContaining({
            operation: 'listSnapshots',
            indexUrl: null,
          })
        )
      })
    })

    describe('Error message content verification', () => {
      it('should include recommendation to deploy indexes in warning', async () => {
        const storage = new FirestoreSnapshotStorage({
          projectId: 'test-project',
        })

        mockCollection.get.mockRejectedValue(createIndexError('listSnapshots'))

        await storage.listSnapshots()

        expect(logger.warn).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            recommendation:
              'Deploy indexes using: firebase deploy --only firestore:indexes',
          })
        )
      })

      it('should include error message in warning log', async () => {
        const storage = new FirestoreSnapshotStorage({
          projectId: 'test-project',
        })

        const indexError = createIndexError('listSnapshots')
        mockCollection.get.mockRejectedValue(indexError)

        await storage.listSnapshots()

        expect(logger.warn).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            error: indexError.message,
          })
        )
      })
    })
  })
})
