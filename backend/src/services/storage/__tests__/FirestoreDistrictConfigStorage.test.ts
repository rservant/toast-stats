/**
 * FirestoreDistrictConfigStorage Unit Tests
 *
 * Tests the FirestoreDistrictConfigStorage implementation with mocked Firestore client.
 * Validates Requirements 3.1, 3.2, 3.3, 3.4, 3.5 from the District Configuration Storage Abstraction spec.
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
import type {
  DistrictConfiguration,
  ConfigurationChange,
} from '../../DistrictConfigurationService.js'

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
  delete: Mock
}

interface MockCollectionReference {
  doc: Mock
  add: Mock
  orderBy: Mock
  limit: Mock
  get: Mock
}

// ============================================================================
// Mock Variables (hoisted)
// ============================================================================

let mockDocRef: MockDocumentReference
let mockHistoryCollection: MockCollectionReference

// ============================================================================
// Mock Setup - Must be before imports that use the mocked modules
// ============================================================================

// Create chainable mock collection
const createMockCollection = (): MockCollectionReference => ({
  doc: vi.fn(),
  add: vi.fn(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  get: vi.fn(),
})

const createMockDocRef = (): MockDocumentReference => ({
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
})

// Track circuit breaker execution for testing
let circuitBreakerExecuteMock: Mock

// Mock the @google-cloud/firestore module
vi.mock('@google-cloud/firestore', () => {
  // Use a class-like constructor function
  const MockFirestore = function (this: Record<string, unknown>) {
    mockHistoryCollection = createMockCollection()
    mockDocRef = createMockDocRef()

    this.doc = vi.fn().mockReturnValue(mockDocRef)
    this.collection = vi.fn().mockReturnValue(mockHistoryCollection)
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

// Mock the CircuitBreaker to track execution and allow testing
vi.mock('../../../utils/CircuitBreaker.js', () => ({
  CircuitBreaker: {
    createCacheCircuitBreaker: vi.fn(() => {
      circuitBreakerExecuteMock = vi.fn(
        async <T>(operation: () => Promise<T>) => operation()
      )
      return {
        execute: circuitBreakerExecuteMock,
        getStats: vi.fn(() => ({
          state: 'CLOSED',
          failureCount: 0,
          successCount: 0,
          totalRequests: 0,
          totalFailures: 0,
          totalSuccesses: 0,
        })),
        reset: vi.fn(),
      }
    }),
  },
}))

// Import after mocks are set up
import { FirestoreDistrictConfigStorage } from '../FirestoreDistrictConfigStorage.js'
import type { IDistrictConfigStorage } from '../../../types/storageInterfaces.js'

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
  return {
    exists,
    id,
    data: () => data,
  }
}

/**
 * Create a mock query snapshot
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
 * Create a valid test configuration
 */
function createTestConfiguration(
  overrides: Partial<DistrictConfiguration> = {}
): DistrictConfiguration {
  return {
    configuredDistricts: ['42', '43', 'F'],
    lastUpdated: new Date().toISOString(),
    updatedBy: 'test-user',
    version: 1,
    ...overrides,
  }
}

/**
 * Create a valid test configuration change
 */
function createTestChange(
  overrides: Partial<ConfigurationChange> = {}
): ConfigurationChange {
  return {
    timestamp: new Date().toISOString(),
    action: 'add',
    districtId: '42',
    adminUser: 'test-admin',
    context: 'Test change',
    ...overrides,
  }
}

/**
 * Create Firestore document data for a configuration
 */
function createFirestoreConfigDoc(
  config: DistrictConfiguration
): Record<string, unknown> {
  return {
    configuredDistricts: config.configuredDistricts,
    lastUpdated: config.lastUpdated,
    updatedBy: config.updatedBy,
    version: config.version,
  }
}

/**
 * Create Firestore document data for a configuration change
 */
function createFirestoreChangeDoc(
  change: ConfigurationChange
): Record<string, unknown> {
  const doc: Record<string, unknown> = {
    timestamp: change.timestamp,
    action: change.action,
    districtId: change.districtId,
    adminUser: change.adminUser,
  }
  if (change.previousDistricts !== undefined) {
    doc['previousDistricts'] = change.previousDistricts
  }
  if (change.newDistricts !== undefined) {
    doc['newDistricts'] = change.newDistricts
  }
  if (change.context !== undefined) {
    doc['context'] = change.context
  }
  return doc
}

// ============================================================================
// Test Suite
// ============================================================================

describe('FirestoreDistrictConfigStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================================
  // Interface Compliance Tests
  // ============================================================================

  describe('Interface Compliance', () => {
    it('should implement IDistrictConfigStorage interface', () => {
      const storage: IDistrictConfigStorage =
        new FirestoreDistrictConfigStorage({
          projectId: 'test-project',
        })

      // Verify all required methods exist
      expect(typeof storage.getConfiguration).toBe('function')
      expect(typeof storage.saveConfiguration).toBe('function')
      expect(typeof storage.appendChangeLog).toBe('function')
      expect(typeof storage.getChangeHistory).toBe('function')
      expect(typeof storage.isReady).toBe('function')
    })
  })

  // ============================================================================
  // Document Path Construction Tests (Requirement 3.1, 3.2)
  // ============================================================================

  describe('Document Path Construction', () => {
    it('should use config/districts as the document path for configuration', async () => {
      const storage = new FirestoreDistrictConfigStorage({
        projectId: 'test-project',
      })

      mockDocRef.get.mockResolvedValue(
        createMockDocSnapshot(false, 'districts')
      )

      await storage.getConfiguration()

      // Verify the correct document path was accessed
      // The Firestore mock's doc() should be called with 'config/districts'
      expect(mockDocRef.get).toHaveBeenCalled()
    })

    it('should use config/districts/history as the subcollection path for history', async () => {
      const storage = new FirestoreDistrictConfigStorage({
        projectId: 'test-project',
      })

      mockHistoryCollection.get.mockResolvedValue(createMockQuerySnapshot([]))

      await storage.getChangeHistory(10)

      // Verify the history collection was queried
      expect(mockHistoryCollection.orderBy).toHaveBeenCalledWith(
        'timestamp',
        'desc'
      )
      expect(mockHistoryCollection.limit).toHaveBeenCalledWith(10)
    })

    it('should store configuration at the correct document path', async () => {
      const storage = new FirestoreDistrictConfigStorage({
        projectId: 'test-project',
      })
      const config = createTestConfiguration()

      mockDocRef.set.mockResolvedValue(undefined)

      await storage.saveConfiguration(config)

      // Verify set was called with the configuration data
      expect(mockDocRef.set).toHaveBeenCalledWith({
        configuredDistricts: config.configuredDistricts,
        lastUpdated: config.lastUpdated,
        updatedBy: config.updatedBy,
        version: config.version,
      })
    })

    it('should add history entries to the subcollection', async () => {
      const storage = new FirestoreDistrictConfigStorage({
        projectId: 'test-project',
      })
      const change = createTestChange()

      mockHistoryCollection.add.mockResolvedValue({ id: 'auto-generated-id' })

      await storage.appendChangeLog(change)

      // Verify add was called with the change data
      expect(mockHistoryCollection.add).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: change.timestamp,
          action: change.action,
          districtId: change.districtId,
          adminUser: change.adminUser,
        })
      )
    })
  })

  // ============================================================================
  // Circuit Breaker Integration Tests (Requirement 3.4)
  // ============================================================================

  describe('Circuit Breaker Integration', () => {
    it('should use circuit breaker for getConfiguration', async () => {
      const storage = new FirestoreDistrictConfigStorage({
        projectId: 'test-project',
      })

      mockDocRef.get.mockResolvedValue(
        createMockDocSnapshot(false, 'districts')
      )

      await storage.getConfiguration()

      // Verify circuit breaker was used
      expect(circuitBreakerExecuteMock).toHaveBeenCalled()
    })

    it('should use circuit breaker for saveConfiguration', async () => {
      const storage = new FirestoreDistrictConfigStorage({
        projectId: 'test-project',
      })
      const config = createTestConfiguration()

      mockDocRef.set.mockResolvedValue(undefined)

      await storage.saveConfiguration(config)

      // Verify circuit breaker was used
      expect(circuitBreakerExecuteMock).toHaveBeenCalled()
    })

    it('should use circuit breaker for appendChangeLog', async () => {
      const storage = new FirestoreDistrictConfigStorage({
        projectId: 'test-project',
      })
      const change = createTestChange()

      mockHistoryCollection.add.mockResolvedValue({ id: 'auto-generated-id' })

      await storage.appendChangeLog(change)

      // Verify circuit breaker was used
      expect(circuitBreakerExecuteMock).toHaveBeenCalled()
    })

    it('should use circuit breaker for getChangeHistory', async () => {
      const storage = new FirestoreDistrictConfigStorage({
        projectId: 'test-project',
      })

      mockHistoryCollection.get.mockResolvedValue(createMockQuerySnapshot([]))

      await storage.getChangeHistory(10)

      // Verify circuit breaker was used
      expect(circuitBreakerExecuteMock).toHaveBeenCalled()
    })

    it('should NOT use circuit breaker for isReady (graceful degradation)', async () => {
      const storage = new FirestoreDistrictConfigStorage({
        projectId: 'test-project',
      })

      mockDocRef.get.mockResolvedValue(
        createMockDocSnapshot(false, 'districts')
      )

      // Clear mock to track only isReady calls
      circuitBreakerExecuteMock.mockClear()

      await storage.isReady()

      // isReady should NOT use circuit breaker - it's a health check
      expect(circuitBreakerExecuteMock).not.toHaveBeenCalled()
    })

    it('should pass operation context to circuit breaker', async () => {
      const storage = new FirestoreDistrictConfigStorage({
        projectId: 'test-project',
      })

      mockDocRef.get.mockResolvedValue(
        createMockDocSnapshot(false, 'districts')
      )

      await storage.getConfiguration()

      // Verify circuit breaker was called with operation context
      expect(circuitBreakerExecuteMock).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ operation: 'getConfiguration' })
      )
    })
  })

  // ============================================================================
  // Retryable Error Classification Tests (Requirement 3.5)
  // ============================================================================

  describe('Retryable Error Classification', () => {
    it('should classify network errors as retryable', async () => {
      const storage = new FirestoreDistrictConfigStorage({
        projectId: 'test-project',
      })

      mockDocRef.get.mockRejectedValue(new Error('network error occurred'))

      try {
        await storage.getConfiguration()
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(StorageOperationError)
        const storageError = error as StorageOperationError
        expect(storageError.retryable).toBe(true)
      }
    })

    it('should classify timeout errors as retryable', async () => {
      const storage = new FirestoreDistrictConfigStorage({
        projectId: 'test-project',
      })

      mockDocRef.get.mockRejectedValue(new Error('request timeout'))

      try {
        await storage.getConfiguration()
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(StorageOperationError)
        const storageError = error as StorageOperationError
        expect(storageError.retryable).toBe(true)
      }
    })

    it('should classify unavailable errors as retryable', async () => {
      const storage = new FirestoreDistrictConfigStorage({
        projectId: 'test-project',
      })

      mockDocRef.get.mockRejectedValue(new Error('service unavailable'))

      try {
        await storage.getConfiguration()
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(StorageOperationError)
        const storageError = error as StorageOperationError
        expect(storageError.retryable).toBe(true)
      }
    })

    it('should classify deadline exceeded errors as retryable', async () => {
      const storage = new FirestoreDistrictConfigStorage({
        projectId: 'test-project',
      })

      mockDocRef.get.mockRejectedValue(new Error('deadline exceeded'))

      try {
        await storage.getConfiguration()
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(StorageOperationError)
        const storageError = error as StorageOperationError
        expect(storageError.retryable).toBe(true)
      }
    })

    it('should classify internal errors as retryable', async () => {
      const storage = new FirestoreDistrictConfigStorage({
        projectId: 'test-project',
      })

      mockDocRef.get.mockRejectedValue(new Error('internal server error'))

      try {
        await storage.getConfiguration()
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(StorageOperationError)
        const storageError = error as StorageOperationError
        expect(storageError.retryable).toBe(true)
      }
    })

    it('should classify aborted errors as retryable', async () => {
      const storage = new FirestoreDistrictConfigStorage({
        projectId: 'test-project',
      })

      mockDocRef.get.mockRejectedValue(new Error('operation aborted'))

      try {
        await storage.getConfiguration()
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(StorageOperationError)
        const storageError = error as StorageOperationError
        expect(storageError.retryable).toBe(true)
      }
    })

    it('should classify resource_exhausted errors as retryable', async () => {
      const storage = new FirestoreDistrictConfigStorage({
        projectId: 'test-project',
      })

      mockDocRef.get.mockRejectedValue(new Error('resource_exhausted'))

      try {
        await storage.getConfiguration()
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(StorageOperationError)
        const storageError = error as StorageOperationError
        expect(storageError.retryable).toBe(true)
      }
    })

    it('should classify cancelled errors as retryable', async () => {
      const storage = new FirestoreDistrictConfigStorage({
        projectId: 'test-project',
      })

      mockDocRef.get.mockRejectedValue(new Error('request cancelled'))

      try {
        await storage.getConfiguration()
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(StorageOperationError)
        const storageError = error as StorageOperationError
        expect(storageError.retryable).toBe(true)
      }
    })

    it('should classify permission denied errors as NOT retryable', async () => {
      const storage = new FirestoreDistrictConfigStorage({
        projectId: 'test-project',
      })

      mockDocRef.get.mockRejectedValue(new Error('permission denied'))

      try {
        await storage.getConfiguration()
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(StorageOperationError)
        const storageError = error as StorageOperationError
        expect(storageError.retryable).toBe(false)
      }
    })

    it('should classify invalid argument errors as NOT retryable', async () => {
      const storage = new FirestoreDistrictConfigStorage({
        projectId: 'test-project',
      })

      mockDocRef.get.mockRejectedValue(new Error('invalid argument'))

      try {
        await storage.getConfiguration()
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(StorageOperationError)
        const storageError = error as StorageOperationError
        expect(storageError.retryable).toBe(false)
      }
    })

    it('should classify unknown errors as NOT retryable', async () => {
      const storage = new FirestoreDistrictConfigStorage({
        projectId: 'test-project',
      })

      mockDocRef.get.mockRejectedValue(new Error('some unknown error'))

      try {
        await storage.getConfiguration()
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(StorageOperationError)
        const storageError = error as StorageOperationError
        expect(storageError.retryable).toBe(false)
      }
    })

    it('should handle non-Error objects as NOT retryable', async () => {
      const storage = new FirestoreDistrictConfigStorage({
        projectId: 'test-project',
      })

      mockDocRef.get.mockRejectedValue('string error')

      try {
        await storage.getConfiguration()
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(StorageOperationError)
        const storageError = error as StorageOperationError
        expect(storageError.retryable).toBe(false)
      }
    })
  })

  // ============================================================================
  // Subcollection Query Ordering Tests (Requirement 3.2)
  // ============================================================================

  describe('Subcollection Query Ordering', () => {
    it('should order history by timestamp descending', async () => {
      const storage = new FirestoreDistrictConfigStorage({
        projectId: 'test-project',
      })

      mockHistoryCollection.get.mockResolvedValue(createMockQuerySnapshot([]))

      await storage.getChangeHistory(10)

      // Verify ordering
      expect(mockHistoryCollection.orderBy).toHaveBeenCalledWith(
        'timestamp',
        'desc'
      )
    })

    it('should apply limit to history query', async () => {
      const storage = new FirestoreDistrictConfigStorage({
        projectId: 'test-project',
      })

      mockHistoryCollection.get.mockResolvedValue(createMockQuerySnapshot([]))

      await storage.getChangeHistory(5)

      expect(mockHistoryCollection.limit).toHaveBeenCalledWith(5)
    })

    it('should return changes in reverse chronological order (most recent first)', async () => {
      const storage = new FirestoreDistrictConfigStorage({
        projectId: 'test-project',
      })

      const changes = [
        createTestChange({
          timestamp: '2024-01-15T12:00:00.000Z',
          districtId: 'third',
        }),
        createTestChange({
          timestamp: '2024-01-15T11:00:00.000Z',
          districtId: 'second',
        }),
        createTestChange({
          timestamp: '2024-01-15T10:00:00.000Z',
          districtId: 'first',
        }),
      ]

      const mockDocs = changes.map((change, index) =>
        createMockDocSnapshot(
          true,
          `doc-${index}`,
          createFirestoreChangeDoc(change)
        )
      )

      mockHistoryCollection.get.mockResolvedValue(
        createMockQuerySnapshot(mockDocs)
      )

      const history = await storage.getChangeHistory(10)

      // Verify order is preserved (most recent first)
      expect(history.length).toBe(3)
      expect(history[0]?.districtId).toBe('third')
      expect(history[1]?.districtId).toBe('second')
      expect(history[2]?.districtId).toBe('first')
    })

    it('should handle empty history gracefully', async () => {
      const storage = new FirestoreDistrictConfigStorage({
        projectId: 'test-project',
      })

      mockHistoryCollection.get.mockResolvedValue(createMockQuerySnapshot([]))

      const history = await storage.getChangeHistory(10)

      expect(history).toEqual([])
    })

    it('should skip invalid history entries and continue parsing', async () => {
      const storage = new FirestoreDistrictConfigStorage({
        projectId: 'test-project',
      })

      const validChange = createTestChange({ districtId: 'valid' })
      const mockDocs = [
        createMockDocSnapshot(
          true,
          'doc-1',
          createFirestoreChangeDoc(validChange)
        ),
        createMockDocSnapshot(true, 'doc-2', { invalid: 'structure' }), // Invalid
        createMockDocSnapshot(
          true,
          'doc-3',
          createFirestoreChangeDoc(
            createTestChange({ districtId: 'also-valid' })
          )
        ),
      ]

      mockHistoryCollection.get.mockResolvedValue(
        createMockQuerySnapshot(mockDocs)
      )

      const history = await storage.getChangeHistory(10)

      // Should have 2 valid entries (skipping the invalid one)
      expect(history.length).toBe(2)
      expect(history[0]?.districtId).toBe('valid')
      expect(history[1]?.districtId).toBe('also-valid')
    })
  })

  // ============================================================================
  // Core Configuration Operations Tests
  // ============================================================================

  describe('Core Configuration Operations', () => {
    describe('getConfiguration', () => {
      it('should return null when document does not exist', async () => {
        const storage = new FirestoreDistrictConfigStorage({
          projectId: 'test-project',
        })

        mockDocRef.get.mockResolvedValue(
          createMockDocSnapshot(false, 'districts')
        )

        const result = await storage.getConfiguration()
        expect(result).toBeNull()
      })

      it('should return null when document exists but has no data', async () => {
        const storage = new FirestoreDistrictConfigStorage({
          projectId: 'test-project',
        })

        mockDocRef.get.mockResolvedValue(
          createMockDocSnapshot(true, 'districts', undefined)
        )

        const result = await storage.getConfiguration()
        expect(result).toBeNull()
      })

      it('should return null for invalid configuration structure', async () => {
        const storage = new FirestoreDistrictConfigStorage({
          projectId: 'test-project',
        })

        mockDocRef.get.mockResolvedValue(
          createMockDocSnapshot(true, 'districts', { invalid: 'structure' })
        )

        const result = await storage.getConfiguration()
        expect(result).toBeNull()
      })

      it('should return configuration when document exists with valid data', async () => {
        const storage = new FirestoreDistrictConfigStorage({
          projectId: 'test-project',
        })
        const config = createTestConfiguration()

        mockDocRef.get.mockResolvedValue(
          createMockDocSnapshot(
            true,
            'districts',
            createFirestoreConfigDoc(config)
          )
        )

        const result = await storage.getConfiguration()

        expect(result).not.toBeNull()
        expect(result?.configuredDistricts).toEqual(config.configuredDistricts)
        expect(result?.lastUpdated).toBe(config.lastUpdated)
        expect(result?.updatedBy).toBe(config.updatedBy)
        expect(result?.version).toBe(config.version)
      })

      it('should throw StorageOperationError on Firestore error', async () => {
        const storage = new FirestoreDistrictConfigStorage({
          projectId: 'test-project',
        })

        mockDocRef.get.mockRejectedValue(new Error('Firestore error'))

        await expect(storage.getConfiguration()).rejects.toThrow(
          StorageOperationError
        )
      })

      it('should include operation name in error', async () => {
        const storage = new FirestoreDistrictConfigStorage({
          projectId: 'test-project',
        })

        mockDocRef.get.mockRejectedValue(new Error('Firestore error'))

        try {
          await storage.getConfiguration()
          expect.fail('Should have thrown')
        } catch (error) {
          expect(error).toBeInstanceOf(StorageOperationError)
          const storageError = error as StorageOperationError
          expect(storageError.operation).toBe('getConfiguration')
          expect(storageError.provider).toBe('firestore')
        }
      })
    })

    describe('saveConfiguration', () => {
      it('should save configuration successfully', async () => {
        const storage = new FirestoreDistrictConfigStorage({
          projectId: 'test-project',
        })
        const config = createTestConfiguration()

        mockDocRef.set.mockResolvedValue(undefined)

        await expect(storage.saveConfiguration(config)).resolves.not.toThrow()
      })

      it('should write all configuration fields', async () => {
        const storage = new FirestoreDistrictConfigStorage({
          projectId: 'test-project',
        })
        const config = createTestConfiguration({
          configuredDistricts: ['1', '2', '3'],
          lastUpdated: '2024-01-15T10:00:00.000Z',
          updatedBy: 'admin',
          version: 5,
        })

        mockDocRef.set.mockResolvedValue(undefined)

        await storage.saveConfiguration(config)

        expect(mockDocRef.set).toHaveBeenCalledWith({
          configuredDistricts: ['1', '2', '3'],
          lastUpdated: '2024-01-15T10:00:00.000Z',
          updatedBy: 'admin',
          version: 5,
        })
      })

      it('should handle empty district list', async () => {
        const storage = new FirestoreDistrictConfigStorage({
          projectId: 'test-project',
        })
        const config = createTestConfiguration({ configuredDistricts: [] })

        mockDocRef.set.mockResolvedValue(undefined)

        await storage.saveConfiguration(config)

        expect(mockDocRef.set).toHaveBeenCalledWith(
          expect.objectContaining({ configuredDistricts: [] })
        )
      })

      it('should throw StorageOperationError on Firestore error', async () => {
        const storage = new FirestoreDistrictConfigStorage({
          projectId: 'test-project',
        })
        const config = createTestConfiguration()

        mockDocRef.set.mockRejectedValue(new Error('Firestore error'))

        await expect(storage.saveConfiguration(config)).rejects.toThrow(
          StorageOperationError
        )
      })

      it('should include operation name in error', async () => {
        const storage = new FirestoreDistrictConfigStorage({
          projectId: 'test-project',
        })
        const config = createTestConfiguration()

        mockDocRef.set.mockRejectedValue(new Error('Firestore error'))

        try {
          await storage.saveConfiguration(config)
          expect.fail('Should have thrown')
        } catch (error) {
          expect(error).toBeInstanceOf(StorageOperationError)
          const storageError = error as StorageOperationError
          expect(storageError.operation).toBe('saveConfiguration')
          expect(storageError.provider).toBe('firestore')
        }
      })
    })
  })

  // ============================================================================
  // Audit Log Operations Tests
  // ============================================================================

  describe('Audit Log Operations', () => {
    describe('appendChangeLog', () => {
      it('should add change to history subcollection', async () => {
        const storage = new FirestoreDistrictConfigStorage({
          projectId: 'test-project',
        })
        const change = createTestChange()

        mockHistoryCollection.add.mockResolvedValue({ id: 'auto-id' })

        await storage.appendChangeLog(change)

        expect(mockHistoryCollection.add).toHaveBeenCalled()
      })

      it('should include all required fields', async () => {
        const storage = new FirestoreDistrictConfigStorage({
          projectId: 'test-project',
        })
        const change = createTestChange({
          timestamp: '2024-01-15T10:00:00.000Z',
          action: 'add',
          districtId: '42',
          adminUser: 'admin',
        })

        mockHistoryCollection.add.mockResolvedValue({ id: 'auto-id' })

        await storage.appendChangeLog(change)

        expect(mockHistoryCollection.add).toHaveBeenCalledWith(
          expect.objectContaining({
            timestamp: '2024-01-15T10:00:00.000Z',
            action: 'add',
            districtId: '42',
            adminUser: 'admin',
          })
        )
      })

      it('should include optional fields when present', async () => {
        const storage = new FirestoreDistrictConfigStorage({
          projectId: 'test-project',
        })
        const change = createTestChange({
          action: 'replace',
          districtId: null,
          previousDistricts: ['1', '2'],
          newDistricts: ['3', '4'],
          context: 'Bulk update',
        })

        mockHistoryCollection.add.mockResolvedValue({ id: 'auto-id' })

        await storage.appendChangeLog(change)

        expect(mockHistoryCollection.add).toHaveBeenCalledWith(
          expect.objectContaining({
            previousDistricts: ['1', '2'],
            newDistricts: ['3', '4'],
            context: 'Bulk update',
          })
        )
      })

      it('should NOT include undefined optional fields', async () => {
        const storage = new FirestoreDistrictConfigStorage({
          projectId: 'test-project',
        })
        const change: ConfigurationChange = {
          timestamp: '2024-01-15T10:00:00.000Z',
          action: 'add',
          districtId: '42',
          adminUser: 'admin',
          // No optional fields
        }

        mockHistoryCollection.add.mockResolvedValue({ id: 'auto-id' })

        await storage.appendChangeLog(change)

        const addCall = mockHistoryCollection.add.mock.calls[0]?.[0] as Record<
          string,
          unknown
        >
        expect(addCall).not.toHaveProperty('previousDistricts')
        expect(addCall).not.toHaveProperty('newDistricts')
        expect(addCall).not.toHaveProperty('context')
      })

      it('should handle all action types', async () => {
        const storage = new FirestoreDistrictConfigStorage({
          projectId: 'test-project',
        })

        mockHistoryCollection.add.mockResolvedValue({ id: 'auto-id' })

        // Test 'add' action
        await storage.appendChangeLog(createTestChange({ action: 'add' }))
        expect(mockHistoryCollection.add).toHaveBeenLastCalledWith(
          expect.objectContaining({ action: 'add' })
        )

        // Test 'remove' action
        await storage.appendChangeLog(createTestChange({ action: 'remove' }))
        expect(mockHistoryCollection.add).toHaveBeenLastCalledWith(
          expect.objectContaining({ action: 'remove' })
        )

        // Test 'replace' action
        await storage.appendChangeLog(createTestChange({ action: 'replace' }))
        expect(mockHistoryCollection.add).toHaveBeenLastCalledWith(
          expect.objectContaining({ action: 'replace' })
        )
      })

      it('should throw StorageOperationError on Firestore error', async () => {
        const storage = new FirestoreDistrictConfigStorage({
          projectId: 'test-project',
        })
        const change = createTestChange()

        mockHistoryCollection.add.mockRejectedValue(
          new Error('Firestore error')
        )

        await expect(storage.appendChangeLog(change)).rejects.toThrow(
          StorageOperationError
        )
      })

      it('should include operation name in error', async () => {
        const storage = new FirestoreDistrictConfigStorage({
          projectId: 'test-project',
        })
        const change = createTestChange()

        mockHistoryCollection.add.mockRejectedValue(
          new Error('Firestore error')
        )

        try {
          await storage.appendChangeLog(change)
          expect.fail('Should have thrown')
        } catch (error) {
          expect(error).toBeInstanceOf(StorageOperationError)
          const storageError = error as StorageOperationError
          expect(storageError.operation).toBe('appendChangeLog')
          expect(storageError.provider).toBe('firestore')
        }
      })
    })

    describe('getChangeHistory', () => {
      it('should return empty array when no history exists', async () => {
        const storage = new FirestoreDistrictConfigStorage({
          projectId: 'test-project',
        })

        mockHistoryCollection.get.mockResolvedValue(createMockQuerySnapshot([]))

        const history = await storage.getChangeHistory(10)
        expect(history).toEqual([])
      })

      it('should return all fields from history entries', async () => {
        const storage = new FirestoreDistrictConfigStorage({
          projectId: 'test-project',
        })

        const change = createTestChange({
          timestamp: '2024-01-15T10:00:00.000Z',
          action: 'replace',
          districtId: null,
          adminUser: 'admin',
          previousDistricts: ['1'],
          newDistricts: ['2', '3'],
          context: 'Migration',
        })

        mockHistoryCollection.get.mockResolvedValue(
          createMockQuerySnapshot([
            createMockDocSnapshot(
              true,
              'doc-1',
              createFirestoreChangeDoc(change)
            ),
          ])
        )

        const history = await storage.getChangeHistory(10)

        expect(history.length).toBe(1)
        expect(history[0]).toEqual(change)
      })

      it('should throw StorageOperationError on Firestore error', async () => {
        const storage = new FirestoreDistrictConfigStorage({
          projectId: 'test-project',
        })

        mockHistoryCollection.get.mockRejectedValue(
          new Error('Firestore error')
        )

        await expect(storage.getChangeHistory(10)).rejects.toThrow(
          StorageOperationError
        )
      })

      it('should include operation name in error', async () => {
        const storage = new FirestoreDistrictConfigStorage({
          projectId: 'test-project',
        })

        mockHistoryCollection.get.mockRejectedValue(
          new Error('Firestore error')
        )

        try {
          await storage.getChangeHistory(10)
          expect.fail('Should have thrown')
        } catch (error) {
          expect(error).toBeInstanceOf(StorageOperationError)
          const storageError = error as StorageOperationError
          expect(storageError.operation).toBe('getChangeHistory')
          expect(storageError.provider).toBe('firestore')
        }
      })
    })
  })

  // ============================================================================
  // Health Check Tests
  // ============================================================================

  describe('Health Check (isReady)', () => {
    it('should return true when Firestore is accessible', async () => {
      const storage = new FirestoreDistrictConfigStorage({
        projectId: 'test-project',
      })

      mockDocRef.get.mockResolvedValue(
        createMockDocSnapshot(false, 'districts')
      )

      const result = await storage.isReady()
      expect(result).toBe(true)
    })

    it('should return true even when document does not exist', async () => {
      const storage = new FirestoreDistrictConfigStorage({
        projectId: 'test-project',
      })

      mockDocRef.get.mockResolvedValue(
        createMockDocSnapshot(false, 'districts')
      )

      const result = await storage.isReady()
      expect(result).toBe(true)
    })

    it('should return false when Firestore is not accessible', async () => {
      const storage = new FirestoreDistrictConfigStorage({
        projectId: 'test-project',
      })

      mockDocRef.get.mockRejectedValue(new Error('Connection failed'))

      const result = await storage.isReady()
      expect(result).toBe(false)
    })

    it('should NOT throw when Firestore is not accessible', async () => {
      const storage = new FirestoreDistrictConfigStorage({
        projectId: 'test-project',
      })

      mockDocRef.get.mockRejectedValue(new Error('Connection failed'))

      // Should not throw, just return false
      await expect(storage.isReady()).resolves.toBe(false)
    })
  })

  // ============================================================================
  // Configuration Validation Tests
  // ============================================================================

  describe('Configuration Validation', () => {
    it('should reject configuration with non-array configuredDistricts', async () => {
      const storage = new FirestoreDistrictConfigStorage({
        projectId: 'test-project',
      })

      mockDocRef.get.mockResolvedValue(
        createMockDocSnapshot(true, 'districts', {
          configuredDistricts: 'not-an-array',
          lastUpdated: '2024-01-15T10:00:00.000Z',
          updatedBy: 'admin',
          version: 1,
        })
      )

      const result = await storage.getConfiguration()
      expect(result).toBeNull()
    })

    it('should reject configuration with non-string district IDs', async () => {
      const storage = new FirestoreDistrictConfigStorage({
        projectId: 'test-project',
      })

      mockDocRef.get.mockResolvedValue(
        createMockDocSnapshot(true, 'districts', {
          configuredDistricts: [1, 2, 3], // Numbers instead of strings
          lastUpdated: '2024-01-15T10:00:00.000Z',
          updatedBy: 'admin',
          version: 1,
        })
      )

      const result = await storage.getConfiguration()
      expect(result).toBeNull()
    })

    it('should reject configuration with non-string lastUpdated', async () => {
      const storage = new FirestoreDistrictConfigStorage({
        projectId: 'test-project',
      })

      mockDocRef.get.mockResolvedValue(
        createMockDocSnapshot(true, 'districts', {
          configuredDistricts: ['42'],
          lastUpdated: 12345, // Number instead of string
          updatedBy: 'admin',
          version: 1,
        })
      )

      const result = await storage.getConfiguration()
      expect(result).toBeNull()
    })

    it('should reject configuration with non-string updatedBy', async () => {
      const storage = new FirestoreDistrictConfigStorage({
        projectId: 'test-project',
      })

      mockDocRef.get.mockResolvedValue(
        createMockDocSnapshot(true, 'districts', {
          configuredDistricts: ['42'],
          lastUpdated: '2024-01-15T10:00:00.000Z',
          updatedBy: null, // Null instead of string
          version: 1,
        })
      )

      const result = await storage.getConfiguration()
      expect(result).toBeNull()
    })

    it('should reject configuration with non-number version', async () => {
      const storage = new FirestoreDistrictConfigStorage({
        projectId: 'test-project',
      })

      mockDocRef.get.mockResolvedValue(
        createMockDocSnapshot(true, 'districts', {
          configuredDistricts: ['42'],
          lastUpdated: '2024-01-15T10:00:00.000Z',
          updatedBy: 'admin',
          version: '1', // String instead of number
        })
      )

      const result = await storage.getConfiguration()
      expect(result).toBeNull()
    })

    it('should reject configuration with missing required fields', async () => {
      const storage = new FirestoreDistrictConfigStorage({
        projectId: 'test-project',
      })

      mockDocRef.get.mockResolvedValue(
        createMockDocSnapshot(true, 'districts', {
          configuredDistricts: ['42'],
          // Missing lastUpdated, updatedBy, version
        })
      )

      const result = await storage.getConfiguration()
      expect(result).toBeNull()
    })
  })

  // ============================================================================
  // Change History Validation Tests
  // ============================================================================

  describe('Change History Validation', () => {
    it('should reject change with invalid action', async () => {
      const storage = new FirestoreDistrictConfigStorage({
        projectId: 'test-project',
      })

      mockHistoryCollection.get.mockResolvedValue(
        createMockQuerySnapshot([
          createMockDocSnapshot(true, 'doc-1', {
            timestamp: '2024-01-15T10:00:00.000Z',
            action: 'invalid-action', // Invalid action
            districtId: '42',
            adminUser: 'admin',
          }),
        ])
      )

      const history = await storage.getChangeHistory(10)
      expect(history).toEqual([]) // Invalid entry should be skipped
    })

    it('should reject change with missing timestamp', async () => {
      const storage = new FirestoreDistrictConfigStorage({
        projectId: 'test-project',
      })

      mockHistoryCollection.get.mockResolvedValue(
        createMockQuerySnapshot([
          createMockDocSnapshot(true, 'doc-1', {
            // Missing timestamp
            action: 'add',
            districtId: '42',
            adminUser: 'admin',
          }),
        ])
      )

      const history = await storage.getChangeHistory(10)
      expect(history).toEqual([])
    })

    it('should reject change with missing adminUser', async () => {
      const storage = new FirestoreDistrictConfigStorage({
        projectId: 'test-project',
      })

      mockHistoryCollection.get.mockResolvedValue(
        createMockQuerySnapshot([
          createMockDocSnapshot(true, 'doc-1', {
            timestamp: '2024-01-15T10:00:00.000Z',
            action: 'add',
            districtId: '42',
            // Missing adminUser
          }),
        ])
      )

      const history = await storage.getChangeHistory(10)
      expect(history).toEqual([])
    })

    it('should accept change with null districtId (for replace action)', async () => {
      const storage = new FirestoreDistrictConfigStorage({
        projectId: 'test-project',
      })

      mockHistoryCollection.get.mockResolvedValue(
        createMockQuerySnapshot([
          createMockDocSnapshot(true, 'doc-1', {
            timestamp: '2024-01-15T10:00:00.000Z',
            action: 'replace',
            districtId: null, // Valid for replace action
            adminUser: 'admin',
          }),
        ])
      )

      const history = await storage.getChangeHistory(10)
      expect(history.length).toBe(1)
      expect(history[0]?.districtId).toBeNull()
    })
  })
})
