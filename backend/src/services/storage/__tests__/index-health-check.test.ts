/**
 * Index Health Check Unit Tests
 *
 * Tests the isIndexHealthy method and its integration with isReady
 * for validating Firestore composite index availability.
 *
 * Feature: firestore-index-fix
 *
 * Property 4: Health Check Failure Detection
 * For any call to `isIndexHealthy` where the underlying Firestore query fails
 * with a `FAILED_PRECONDITION` error, the method SHALL return an `IndexHealthResult`
 * with `healthy: false` and include the index creation URL in `indexCreationUrls`
 * if available in the error message.
 *
 * Validates: Requirements 5.3, 5.5
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
 * Create a Firestore index error without a URL
 */
function createIndexErrorWithoutUrl(): Error {
  return new Error(
    '9 FAILED_PRECONDITION: The query requires an index for this operation'
  )
}

/**
 * Create a non-index error (e.g., network error)
 */
function createNetworkError(): Error {
  return new Error('14 UNAVAILABLE: Service temporarily unavailable')
}

/**
 * Create a successful query snapshot
 */
function createSuccessfulQuerySnapshot(): MockQuerySnapshot {
  return {
    empty: true,
    docs: [],
  }
}

// ============================================================================
// Test Suite
// ============================================================================

describe('Index Health Check', () => {
  describe('Feature: firestore-index-fix', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    afterEach(() => {
      vi.clearAllMocks()
    })

    // ========================================================================
    // isIndexHealthy Tests
    // ========================================================================

    describe('isIndexHealthy', () => {
      /**
       * Property 4: Health Check Failure Detection
       * Validates: Requirement 5.4
       *
       * IF the health check query succeeds THEN THE `isIndexHealthy` method
       * SHALL return true
       */
      describe('successful health check', () => {
        it('should return healthy: true with empty arrays when query succeeds', async () => {
          const storage = new FirestoreSnapshotStorage({
            projectId: 'test-project',
          })

          mockCollection.get.mockResolvedValue(createSuccessfulQuerySnapshot())

          const result = await storage.isIndexHealthy()

          expect(result).toEqual({
            healthy: true,
            missingIndexes: [],
            indexCreationUrls: [],
          })
        })

        it('should log success when health check passes', async () => {
          const storage = new FirestoreSnapshotStorage({
            projectId: 'test-project',
          })

          mockCollection.get.mockResolvedValue(createSuccessfulQuerySnapshot())

          await storage.isIndexHealthy()

          expect(logger.info).toHaveBeenCalledWith(
            'Index health check passed',
            expect.objectContaining({
              operation: 'isIndexHealthy',
              healthy: true,
            })
          )
        })

        it('should execute query with orderBy and limit', async () => {
          const storage = new FirestoreSnapshotStorage({
            projectId: 'test-project',
          })

          mockCollection.get.mockResolvedValue(createSuccessfulQuerySnapshot())

          await storage.isIndexHealthy()

          expect(mockCollection.orderBy).toHaveBeenCalledWith(
            '__name__',
            'desc'
          )
          expect(mockCollection.limit).toHaveBeenCalledWith(1)
          expect(mockCollection.get).toHaveBeenCalled()
        })
      })

      /**
       * Property 4: Health Check Failure Detection
       * Validates: Requirements 5.3, 5.5
       *
       * IF the health check query fails with `FAILED_PRECONDITION` THEN THE
       * `isIndexHealthy` method SHALL return false with diagnostic information
       */
      describe('failed health check with index error', () => {
        it('should return healthy: false with index URL when query fails with index error', async () => {
          const storage = new FirestoreSnapshotStorage({
            projectId: 'test-project',
          })

          mockCollection.get.mockRejectedValue(
            createIndexError('isIndexHealthy')
          )

          const result = await storage.isIndexHealthy()

          expect(result).toEqual({
            healthy: false,
            missingIndexes: ['snapshots collection index'],
            indexCreationUrls: [
              'https://console.firebase.google.com/v1/r/project/test-project/firestore/indexes?create_composite=abc123_isIndexHealthy',
            ],
          })
        })

        it('should return healthy: false with empty URLs when error has no URL', async () => {
          const storage = new FirestoreSnapshotStorage({
            projectId: 'test-project',
          })

          mockCollection.get.mockRejectedValue(createIndexErrorWithoutUrl())

          const result = await storage.isIndexHealthy()

          expect(result).toEqual({
            healthy: false,
            missingIndexes: ['snapshots collection index'],
            indexCreationUrls: [],
          })
        })

        it('should log warning with index URL when index error occurs', async () => {
          const storage = new FirestoreSnapshotStorage({
            projectId: 'test-project',
          })

          mockCollection.get.mockRejectedValue(
            createIndexError('isIndexHealthy')
          )

          await storage.isIndexHealthy()

          expect(logger.warn).toHaveBeenCalledWith(
            'Index health check failed - missing index detected',
            expect.objectContaining({
              operation: 'isIndexHealthy',
              healthy: false,
              indexUrl: expect.stringContaining(
                'https://console.firebase.google.com'
              ),
              recommendation: expect.stringContaining('firebase deploy'),
            })
          )
        })

        it('should log warning with null indexUrl when error has no URL', async () => {
          const storage = new FirestoreSnapshotStorage({
            projectId: 'test-project',
          })

          mockCollection.get.mockRejectedValue(createIndexErrorWithoutUrl())

          await storage.isIndexHealthy()

          expect(logger.warn).toHaveBeenCalledWith(
            'Index health check failed - missing index detected',
            expect.objectContaining({
              operation: 'isIndexHealthy',
              healthy: false,
              indexUrl: null,
            })
          )
        })
      })

      /**
       * Tests for non-index errors
       * Validates: Requirement 5.3 (graceful handling of unexpected errors)
       */
      describe('failed health check with non-index error', () => {
        it('should return healthy: false for non-index errors', async () => {
          const storage = new FirestoreSnapshotStorage({
            projectId: 'test-project',
          })

          mockCollection.get.mockRejectedValue(createNetworkError())

          const result = await storage.isIndexHealthy()

          expect(result).toEqual({
            healthy: false,
            missingIndexes: ['snapshots collection index (check failed)'],
            indexCreationUrls: [],
          })
        })

        it('should log error for non-index errors', async () => {
          const storage = new FirestoreSnapshotStorage({
            projectId: 'test-project',
          })

          mockCollection.get.mockRejectedValue(createNetworkError())

          await storage.isIndexHealthy()

          expect(logger.error).toHaveBeenCalledWith(
            'Index health check failed with unexpected error',
            expect.objectContaining({
              operation: 'isIndexHealthy',
              healthy: false,
            })
          )
        })
      })
    })

    // ========================================================================
    // isReady Tests (incorporating index health)
    // ========================================================================

    describe('isReady', () => {
      /**
       * Validates: Requirement 5.6
       *
       * THE existing `isReady` method SHALL incorporate index health validation
       */
      describe('index health integration', () => {
        it('should return true when both connectivity and index health pass', async () => {
          const storage = new FirestoreSnapshotStorage({
            projectId: 'test-project',
          })

          // First call is for connectivity check (limit(1).get())
          // Second call is for index health check (orderBy + limit + get)
          mockCollection.get
            .mockResolvedValueOnce(createSuccessfulQuerySnapshot()) // connectivity
            .mockResolvedValueOnce(createSuccessfulQuerySnapshot()) // index health

          const result = await storage.isReady()

          expect(result).toBe(true)
        })

        it('should return false when connectivity passes but index health fails', async () => {
          const storage = new FirestoreSnapshotStorage({
            projectId: 'test-project',
          })

          // First call succeeds (connectivity), second call fails (index health)
          mockCollection.get
            .mockResolvedValueOnce(createSuccessfulQuerySnapshot()) // connectivity
            .mockRejectedValueOnce(createIndexError('isReady')) // index health

          const result = await storage.isReady()

          expect(result).toBe(false)
        })

        it('should log warning when index health fails during isReady', async () => {
          const storage = new FirestoreSnapshotStorage({
            projectId: 'test-project',
          })

          mockCollection.get
            .mockResolvedValueOnce(createSuccessfulQuerySnapshot()) // connectivity
            .mockRejectedValueOnce(createIndexError('isReady')) // index health

          await storage.isReady()

          expect(logger.warn).toHaveBeenCalledWith(
            'Firestore storage not ready - indexes unhealthy',
            expect.objectContaining({
              operation: 'isReady',
              missingIndexes: expect.any(Array),
              indexCreationUrls: expect.any(Array),
              recommendation: expect.stringContaining('firebase deploy'),
            })
          )
        })

        it('should return false when connectivity check fails', async () => {
          const storage = new FirestoreSnapshotStorage({
            projectId: 'test-project',
          })

          mockCollection.get.mockRejectedValue(createNetworkError())

          const result = await storage.isReady()

          expect(result).toBe(false)
        })

        it('should log warning when connectivity check fails', async () => {
          const storage = new FirestoreSnapshotStorage({
            projectId: 'test-project',
          })

          mockCollection.get.mockRejectedValue(createNetworkError())

          await storage.isReady()

          expect(logger.warn).toHaveBeenCalledWith(
            'Firestore storage not ready',
            expect.objectContaining({
              operation: 'isReady',
              error: expect.any(String),
            })
          )
        })
      })
    })

    // ========================================================================
    // Edge Cases
    // ========================================================================

    describe('edge cases', () => {
      it('should handle index error with lowercase "index" keyword', async () => {
        const storage = new FirestoreSnapshotStorage({
          projectId: 'test-project',
        })

        const error = new Error(
          'FAILED_PRECONDITION: Missing composite index for query'
        )
        mockCollection.get.mockRejectedValue(error)

        const result = await storage.isIndexHealthy()

        expect(result.healthy).toBe(false)
        expect(result.missingIndexes).toContain('snapshots collection index')
      })

      it('should handle index error with URL containing special characters', async () => {
        const storage = new FirestoreSnapshotStorage({
          projectId: 'test-project',
        })

        const error = new Error(
          '9 FAILED_PRECONDITION: The query requires an index. You can create it here: https://console.firebase.google.com/v1/r/project/my-project-123/firestore/indexes?create_composite=Cg1zbmFwc2hvdHMSCl9fbmFtZV9fGgEC'
        )
        mockCollection.get.mockRejectedValue(error)

        const result = await storage.isIndexHealthy()

        expect(result.healthy).toBe(false)
        expect(result.indexCreationUrls).toHaveLength(1)
        expect(result.indexCreationUrls[0]).toContain(
          'https://console.firebase.google.com'
        )
      })

      it('should handle FAILED_PRECONDITION without index keyword as non-index error', async () => {
        const storage = new FirestoreSnapshotStorage({
          projectId: 'test-project',
        })

        const error = new Error(
          '9 FAILED_PRECONDITION: Document already exists'
        )
        mockCollection.get.mockRejectedValue(error)

        const result = await storage.isIndexHealthy()

        // This should be treated as a non-index error
        expect(result.healthy).toBe(false)
        expect(result.missingIndexes).toContain(
          'snapshots collection index (check failed)'
        )
        expect(result.indexCreationUrls).toEqual([])
      })
    })
  })
})
