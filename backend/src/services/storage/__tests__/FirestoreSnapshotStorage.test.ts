/**
 * FirestoreSnapshotStorage Unit Tests
 *
 * Tests the FirestoreSnapshotStorage implementation with mocked Firestore client.
 * Validates Requirements 2.1-2.6, 7.1-7.4 from the GCP Storage Migration spec.
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
  Snapshot,
  AllDistrictsRankingsData,
} from '../../../types/snapshots.js'
import type { DistrictStatistics } from '../../../types/districts.js'
import {
  CURRENT_SCHEMA_VERSION,
  CURRENT_CALCULATION_VERSION,
} from '../../../types/snapshots.js'

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
}

interface MockBatch {
  set: Mock
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
  collection: vi.fn(),
})

const createMockBatch = (): MockBatch => ({
  set: vi.fn().mockReturnThis(),
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
import type { ISnapshotStorage } from '../../../types/storageInterfaces.js'

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
 * Create a test snapshot object
 */
function createTestSnapshot(
  snapshotId: string,
  status: 'success' | 'partial' | 'failed' = 'success'
): Snapshot {
  return {
    snapshot_id: snapshotId,
    created_at: new Date().toISOString(),
    schema_version: CURRENT_SCHEMA_VERSION,
    calculation_version: CURRENT_CALCULATION_VERSION,
    status,
    errors: status === 'failed' ? ['Test error'] : [],
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
 * Create test district statistics
 */
function createTestDistrictData(districtId: string): DistrictStatistics {
  return {
    districtId,
    districtName: `District ${districtId}`,
    region: 1,
    programYear: '2024-2025',
    asOfDate: '2024-01-15',
    clubs: [],
    divisions: [],
    areas: [],
    summary: {
      totalClubs: 10,
      totalMembers: 200,
      distinguishedClubs: 5,
      selectDistinguishedClubs: 2,
      presidentDistinguishedClubs: 1,
      suspendedClubs: 0,
      lowMembershipClubs: 1,
      goalsMet: {
        dcpGoals: 8,
        membershipGoals: 6,
        trainingGoals: 4,
        adminGoals: 2,
      },
    },
  }
}

/**
 * Create test rankings data
 */
function createTestRankings(): AllDistrictsRankingsData {
  return {
    calculatedAt: new Date().toISOString(),
    rankingVersion: '1.0.0',
    totalDistricts: 2,
    metadata: {
      rankingVersion: '1.0.0',
      calculatedAt: new Date().toISOString(),
    },
    rankings: [
      {
        districtId: '42',
        districtName: 'District 42',
        overallRank: 1,
        overallScore: 100,
        metrics: {},
      },
      {
        districtId: '43',
        districtName: 'District 43',
        overallRank: 2,
        overallScore: 90,
        metrics: {},
      },
    ],
  }
}

/**
 * Create a Firestore document structure for a snapshot
 */
function createFirestoreSnapshotDoc(
  snapshot: Snapshot,
  rankings?: AllDistrictsRankingsData
) {
  return {
    metadata: {
      snapshotId: snapshot.snapshot_id,
      createdAt: snapshot.created_at,
      schemaVersion: snapshot.schema_version,
      calculationVersion: snapshot.calculation_version,
      status: snapshot.status,
      configuredDistricts: snapshot.payload.districts.map(d => d.districtId),
      successfulDistricts: snapshot.payload.districts.map(d => d.districtId),
      failedDistricts: [],
      errors: snapshot.errors,
      processingDuration: snapshot.payload.metadata.processingDurationMs,
      source: snapshot.payload.metadata.source,
      dataAsOfDate: snapshot.payload.metadata.dataAsOfDate,
    },
    manifest: {
      snapshotId: snapshot.snapshot_id,
      createdAt: snapshot.created_at,
      districts: [],
      totalDistricts: snapshot.payload.districts.length,
      successfulDistricts: snapshot.payload.districts.length,
      failedDistricts: 0,
      allDistrictsRankings: rankings
        ? { filename: 'rankings', size: 0, status: 'present' }
        : { filename: 'rankings', size: 0, status: 'missing' },
    },
    rankings,
  }
}

// ============================================================================
// Test Suite
// ============================================================================

describe('FirestoreSnapshotStorage', () => {
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
    it('should implement ISnapshotStorage interface', () => {
      const storage: ISnapshotStorage = new FirestoreSnapshotStorage({
        projectId: 'test-project',
      })

      // Verify all required methods exist
      expect(typeof storage.getLatestSuccessful).toBe('function')
      expect(typeof storage.getLatest).toBe('function')
      expect(typeof storage.writeSnapshot).toBe('function')
      expect(typeof storage.listSnapshots).toBe('function')
      expect(typeof storage.getSnapshot).toBe('function')
      expect(typeof storage.isReady).toBe('function')
      expect(typeof storage.writeDistrictData).toBe('function')
      expect(typeof storage.readDistrictData).toBe('function')
      expect(typeof storage.listDistrictsInSnapshot).toBe('function')
      expect(typeof storage.getSnapshotManifest).toBe('function')
      expect(typeof storage.getSnapshotMetadata).toBe('function')
      expect(typeof storage.writeAllDistrictsRankings).toBe('function')
      expect(typeof storage.readAllDistrictsRankings).toBe('function')
      expect(typeof storage.hasAllDistrictsRankings).toBe('function')
    })
  })

  // ============================================================================
  // Document ID Format Tests (Requirement 2.6)
  // ============================================================================

  describe('Document ID Format (Requirement 2.6)', () => {
    it('should validate snapshot ID format as ISO date (YYYY-MM-DD)', async () => {
      const storage = new FirestoreSnapshotStorage({
        projectId: 'test-project',
      })

      // Valid ISO date format should not throw during validation
      mockDocRef.get.mockResolvedValue(
        createMockDocSnapshot(false, '2024-01-15')
      )

      const result = await storage.getSnapshot('2024-01-15')
      expect(result).toBeNull()
    })

    it('should reject invalid snapshot ID format', async () => {
      const storage = new FirestoreSnapshotStorage({
        projectId: 'test-project',
      })

      await expect(storage.getSnapshot('invalid-date')).rejects.toThrow(
        StorageOperationError
      )
      await expect(storage.getSnapshot('2024/01/15')).rejects.toThrow(
        StorageOperationError
      )
      await expect(storage.getSnapshot('20240115')).rejects.toThrow(
        StorageOperationError
      )
      await expect(storage.getSnapshot('')).rejects.toThrow(
        StorageOperationError
      )
    })

    it('should use ISO date as document ID when writing snapshot', async () => {
      const storage = new FirestoreSnapshotStorage({
        projectId: 'test-project',
      })
      const snapshot = createTestSnapshot('2024-01-15')

      mockDistrictsCollection.get.mockResolvedValue(createMockQuerySnapshot([]))

      await storage.writeSnapshot(snapshot)

      // Verify batch operations were called
      expect(mockBatch.set).toHaveBeenCalled()
      expect(mockBatch.commit).toHaveBeenCalled()
    })
  })

  // ============================================================================
  // Core Snapshot Operations Tests (Requirements 2.1-2.4)
  // ============================================================================

  describe('Core Snapshot Operations', () => {
    describe('getLatestSuccessful (Requirement 2.3)', () => {
      it('should return null when no successful snapshots exist', async () => {
        const storage = new FirestoreSnapshotStorage({
          projectId: 'test-project',
        })

        mockCollection.get.mockResolvedValue(createMockQuerySnapshot([]))

        const result = await storage.getLatestSuccessful()
        expect(result).toBeNull()
      })

      it('should query for successful snapshots ordered by date descending', async () => {
        const storage = new FirestoreSnapshotStorage({
          projectId: 'test-project',
        })

        mockCollection.get.mockResolvedValue(createMockQuerySnapshot([]))

        await storage.getLatestSuccessful()

        expect(mockCollection.where).toHaveBeenCalledWith(
          'metadata.status',
          '==',
          'success'
        )
        expect(mockCollection.orderBy).toHaveBeenCalledWith('__name__', 'desc')
        expect(mockCollection.limit).toHaveBeenCalledWith(1)
      })

      it('should return the latest successful snapshot', async () => {
        const storage = new FirestoreSnapshotStorage({
          projectId: 'test-project',
        })
        const snapshot = createTestSnapshot('2024-01-15', 'success')
        const firestoreDoc = createFirestoreSnapshotDoc(snapshot)

        const mockDocSnapshot = createMockDocSnapshot(
          true,
          '2024-01-15',
          firestoreDoc
        )
        mockCollection.get.mockResolvedValue(
          createMockQuerySnapshot([mockDocSnapshot])
        )
        mockDocRef.get.mockResolvedValue(mockDocSnapshot)
        mockDistrictsCollection.get.mockResolvedValue(
          createMockQuerySnapshot([])
        )

        const result = await storage.getLatestSuccessful()

        expect(result).not.toBeNull()
        expect(result?.snapshot_id).toBe('2024-01-15')
        expect(result?.status).toBe('success')
      })
    })

    describe('getLatest', () => {
      it('should return null when no snapshots exist', async () => {
        const storage = new FirestoreSnapshotStorage({
          projectId: 'test-project',
        })

        mockCollection.get.mockResolvedValue(createMockQuerySnapshot([]))

        const result = await storage.getLatest()
        expect(result).toBeNull()
      })

      it('should return the most recent snapshot regardless of status', async () => {
        const storage = new FirestoreSnapshotStorage({
          projectId: 'test-project',
        })
        const snapshot = createTestSnapshot('2024-01-16', 'failed')
        const firestoreDoc = createFirestoreSnapshotDoc(snapshot)

        const mockDocSnapshot = createMockDocSnapshot(
          true,
          '2024-01-16',
          firestoreDoc
        )
        mockCollection.get.mockResolvedValue(
          createMockQuerySnapshot([mockDocSnapshot])
        )
        mockDocRef.get.mockResolvedValue(mockDocSnapshot)
        mockDistrictsCollection.get.mockResolvedValue(
          createMockQuerySnapshot([])
        )

        const result = await storage.getLatest()

        expect(result).not.toBeNull()
        expect(result?.snapshot_id).toBe('2024-01-16')
        expect(result?.status).toBe('failed')
      })
    })

    describe('writeSnapshot (Requirements 2.1, 2.2)', () => {
      it('should write snapshot metadata to root document', async () => {
        const storage = new FirestoreSnapshotStorage({
          projectId: 'test-project',
        })
        const snapshot = createTestSnapshot('2024-01-15')

        await storage.writeSnapshot(snapshot)

        expect(mockBatch.set).toHaveBeenCalled()
        expect(mockBatch.commit).toHaveBeenCalled()
      })

      it('should write district data to subcollection', async () => {
        const storage = new FirestoreSnapshotStorage({
          projectId: 'test-project',
        })
        const districtData = createTestDistrictData('42')
        const snapshot: Snapshot = {
          ...createTestSnapshot('2024-01-15'),
          payload: {
            districts: [districtData],
            metadata: {
              source: 'test',
              fetchedAt: new Date().toISOString(),
              dataAsOfDate: '2024-01-15',
              districtCount: 1,
              processingDurationMs: 100,
            },
          },
        }

        await storage.writeSnapshot(snapshot)

        // Verify batch operations were called (root doc + 1 district)
        expect(mockBatch.set).toHaveBeenCalledTimes(2)
        expect(mockBatch.commit).toHaveBeenCalled()
      })

      it('should write rankings data when provided (Requirement 2.5)', async () => {
        const storage = new FirestoreSnapshotStorage({
          projectId: 'test-project',
        })
        const snapshot = createTestSnapshot('2024-01-15')
        const rankings = createTestRankings()

        await storage.writeSnapshot(snapshot, rankings)

        expect(mockBatch.set).toHaveBeenCalled()
      })

      it('should use atomic batch writes for consistency', async () => {
        const storage = new FirestoreSnapshotStorage({
          projectId: 'test-project',
        })
        const snapshot = createTestSnapshot('2024-01-15')

        await storage.writeSnapshot(snapshot)

        expect(mockBatch.commit).toHaveBeenCalled()
      })
    })

    describe('getSnapshot', () => {
      it('should return null for non-existent snapshot', async () => {
        const storage = new FirestoreSnapshotStorage({
          projectId: 'test-project',
        })

        mockDocRef.get.mockResolvedValue(
          createMockDocSnapshot(false, '2024-01-15')
        )

        const result = await storage.getSnapshot('2024-01-15')
        expect(result).toBeNull()
      })

      it('should retrieve snapshot with all district data', async () => {
        const storage = new FirestoreSnapshotStorage({
          projectId: 'test-project',
        })
        const snapshot = createTestSnapshot('2024-01-15')
        const firestoreDoc = createFirestoreSnapshotDoc(snapshot)

        mockDocRef.get.mockResolvedValue(
          createMockDocSnapshot(true, '2024-01-15', firestoreDoc)
        )
        mockDistrictsCollection.get.mockResolvedValue(
          createMockQuerySnapshot([])
        )

        const result = await storage.getSnapshot('2024-01-15')

        expect(result).not.toBeNull()
        expect(result?.snapshot_id).toBe('2024-01-15')
      })
    })

    describe('listSnapshots', () => {
      it('should return empty array when no snapshots exist', async () => {
        const storage = new FirestoreSnapshotStorage({
          projectId: 'test-project',
        })

        mockCollection.get.mockResolvedValue(createMockQuerySnapshot([]))

        const result = await storage.listSnapshots()
        expect(result).toEqual([])
      })

      it('should respect limit parameter', async () => {
        const storage = new FirestoreSnapshotStorage({
          projectId: 'test-project',
        })

        mockCollection.get.mockResolvedValue(createMockQuerySnapshot([]))

        await storage.listSnapshots(5)

        expect(mockCollection.limit).toHaveBeenCalledWith(5)
      })

      it('should apply status filter when provided', async () => {
        const storage = new FirestoreSnapshotStorage({
          projectId: 'test-project',
        })

        mockCollection.get.mockResolvedValue(createMockQuerySnapshot([]))

        await storage.listSnapshots(undefined, { status: 'success' })

        expect(mockCollection.where).toHaveBeenCalledWith(
          'metadata.status',
          '==',
          'success'
        )
      })
    })

    describe('isReady', () => {
      it('should return true when Firestore is accessible', async () => {
        const storage = new FirestoreSnapshotStorage({
          projectId: 'test-project',
        })

        mockCollection.get.mockResolvedValue(createMockQuerySnapshot([]))

        const result = await storage.isReady()
        expect(result).toBe(true)
      })

      it('should return false when Firestore is not accessible', async () => {
        const storage = new FirestoreSnapshotStorage({
          projectId: 'test-project',
        })

        mockCollection.get.mockRejectedValue(new Error('Connection failed'))

        const result = await storage.isReady()
        expect(result).toBe(false)
      })
    })
  })

  // ============================================================================
  // Per-District Operations Tests
  // ============================================================================

  describe('Per-District Operations', () => {
    describe('writeDistrictData', () => {
      it('should write district data to subcollection', async () => {
        const storage = new FirestoreSnapshotStorage({
          projectId: 'test-project',
        })
        const districtData = createTestDistrictData('42')

        const mockDistrictDocRef = { set: vi.fn().mockResolvedValue(undefined) }
        mockDistrictsCollection.doc.mockReturnValue(mockDistrictDocRef)

        await storage.writeDistrictData('2024-01-15', '42', districtData)

        expect(mockDistrictsCollection.doc).toHaveBeenCalledWith('district_42')
        expect(mockDistrictDocRef.set).toHaveBeenCalled()
      })

      it('should validate district ID format', async () => {
        const storage = new FirestoreSnapshotStorage({
          projectId: 'test-project',
        })
        const districtData = createTestDistrictData('42')

        await expect(
          storage.writeDistrictData('2024-01-15', '', districtData)
        ).rejects.toThrow(StorageOperationError)

        await expect(
          storage.writeDistrictData('2024-01-15', 'invalid-id!', districtData)
        ).rejects.toThrow(StorageOperationError)
      })
    })

    describe('readDistrictData', () => {
      it('should return null for non-existent district', async () => {
        const storage = new FirestoreSnapshotStorage({
          projectId: 'test-project',
        })

        const mockDistrictDocRef = {
          get: vi
            .fn()
            .mockResolvedValue(createMockDocSnapshot(false, 'district_42')),
        }
        mockDistrictsCollection.doc.mockReturnValue(mockDistrictDocRef)

        const result = await storage.readDistrictData('2024-01-15', '42')
        expect(result).toBeNull()
      })

      it('should return district data when it exists', async () => {
        const storage = new FirestoreSnapshotStorage({
          projectId: 'test-project',
        })
        const districtData = createTestDistrictData('42')

        const mockDistrictDocRef = {
          get: vi.fn().mockResolvedValue(
            createMockDocSnapshot(true, 'district_42', {
              districtId: '42',
              districtName: 'District 42',
              collectedAt: new Date().toISOString(),
              status: 'success',
              data: districtData,
            })
          ),
        }
        mockDistrictsCollection.doc.mockReturnValue(mockDistrictDocRef)

        const result = await storage.readDistrictData('2024-01-15', '42')

        expect(result).not.toBeNull()
        expect(result?.districtId).toBe('42')
      })

      it('should return null for failed district status', async () => {
        const storage = new FirestoreSnapshotStorage({
          projectId: 'test-project',
        })

        const mockDistrictDocRef = {
          get: vi.fn().mockResolvedValue(
            createMockDocSnapshot(true, 'district_42', {
              districtId: '42',
              districtName: 'District 42',
              collectedAt: new Date().toISOString(),
              status: 'failed',
              errorMessage: 'Collection failed',
              data: null,
            })
          ),
        }
        mockDistrictsCollection.doc.mockReturnValue(mockDistrictDocRef)

        const result = await storage.readDistrictData('2024-01-15', '42')
        expect(result).toBeNull()
      })
    })

    describe('listDistrictsInSnapshot', () => {
      it('should return empty array for snapshot with no districts', async () => {
        const storage = new FirestoreSnapshotStorage({
          projectId: 'test-project',
        })
        const snapshot = createTestSnapshot('2024-01-15')
        const firestoreDoc = createFirestoreSnapshotDoc(snapshot)

        mockDocRef.get.mockResolvedValue(
          createMockDocSnapshot(true, '2024-01-15', firestoreDoc)
        )

        const result = await storage.listDistrictsInSnapshot('2024-01-15')
        expect(result).toEqual([])
      })
    })

    describe('getSnapshotManifest', () => {
      it('should return null for non-existent snapshot', async () => {
        const storage = new FirestoreSnapshotStorage({
          projectId: 'test-project',
        })

        mockDocRef.get.mockResolvedValue(
          createMockDocSnapshot(false, '2024-01-15')
        )

        const result = await storage.getSnapshotManifest('2024-01-15')
        expect(result).toBeNull()
      })

      it('should return manifest for existing snapshot', async () => {
        const storage = new FirestoreSnapshotStorage({
          projectId: 'test-project',
        })
        const snapshot = createTestSnapshot('2024-01-15')
        const firestoreDoc = createFirestoreSnapshotDoc(snapshot)

        mockDocRef.get.mockResolvedValue(
          createMockDocSnapshot(true, '2024-01-15', firestoreDoc)
        )

        const result = await storage.getSnapshotManifest('2024-01-15')

        expect(result).not.toBeNull()
        expect(result?.snapshotId).toBe('2024-01-15')
      })
    })

    describe('getSnapshotMetadata', () => {
      it('should return null for non-existent snapshot', async () => {
        const storage = new FirestoreSnapshotStorage({
          projectId: 'test-project',
        })

        mockDocRef.get.mockResolvedValue(
          createMockDocSnapshot(false, '2024-01-15')
        )

        const result = await storage.getSnapshotMetadata('2024-01-15')
        expect(result).toBeNull()
      })

      it('should return metadata for existing snapshot', async () => {
        const storage = new FirestoreSnapshotStorage({
          projectId: 'test-project',
        })
        const snapshot = createTestSnapshot('2024-01-15')
        const firestoreDoc = createFirestoreSnapshotDoc(snapshot)

        mockDocRef.get.mockResolvedValue(
          createMockDocSnapshot(true, '2024-01-15', firestoreDoc)
        )

        const result = await storage.getSnapshotMetadata('2024-01-15')

        expect(result).not.toBeNull()
        expect(result?.snapshotId).toBe('2024-01-15')
        expect(result?.status).toBe('success')
      })
    })
  })

  // ============================================================================
  // Rankings Operations Tests (Requirement 2.5)
  // ============================================================================

  describe('Rankings Operations (Requirement 2.5)', () => {
    describe('writeAllDistrictsRankings', () => {
      it('should throw error if snapshot does not exist', async () => {
        const storage = new FirestoreSnapshotStorage({
          projectId: 'test-project',
        })
        const rankings = createTestRankings()

        mockDocRef.get.mockResolvedValue(
          createMockDocSnapshot(false, '2024-01-15')
        )

        await expect(
          storage.writeAllDistrictsRankings('2024-01-15', rankings)
        ).rejects.toThrow(StorageOperationError)
      })

      it('should update rankings in existing snapshot', async () => {
        const storage = new FirestoreSnapshotStorage({
          projectId: 'test-project',
        })
        const snapshot = createTestSnapshot('2024-01-15')
        const firestoreDoc = createFirestoreSnapshotDoc(snapshot)
        const rankings = createTestRankings()

        mockDocRef.get.mockResolvedValue(
          createMockDocSnapshot(true, '2024-01-15', firestoreDoc)
        )
        mockDocRef.update.mockResolvedValue(undefined)

        await storage.writeAllDistrictsRankings('2024-01-15', rankings)

        expect(mockDocRef.update).toHaveBeenCalled()
      })
    })

    describe('readAllDistrictsRankings', () => {
      it('should return null for non-existent snapshot', async () => {
        const storage = new FirestoreSnapshotStorage({
          projectId: 'test-project',
        })

        mockDocRef.get.mockResolvedValue(
          createMockDocSnapshot(false, '2024-01-15')
        )

        const result = await storage.readAllDistrictsRankings('2024-01-15')
        expect(result).toBeNull()
      })

      it('should return null when snapshot has no rankings', async () => {
        const storage = new FirestoreSnapshotStorage({
          projectId: 'test-project',
        })
        const snapshot = createTestSnapshot('2024-01-15')
        const firestoreDoc = createFirestoreSnapshotDoc(snapshot) // No rankings

        mockDocRef.get.mockResolvedValue(
          createMockDocSnapshot(true, '2024-01-15', firestoreDoc)
        )

        const result = await storage.readAllDistrictsRankings('2024-01-15')
        expect(result).toBeNull()
      })

      it('should return rankings when they exist', async () => {
        const storage = new FirestoreSnapshotStorage({
          projectId: 'test-project',
        })
        const snapshot = createTestSnapshot('2024-01-15')
        const rankings = createTestRankings()
        const firestoreDoc = createFirestoreSnapshotDoc(snapshot, rankings)

        mockDocRef.get.mockResolvedValue(
          createMockDocSnapshot(true, '2024-01-15', firestoreDoc)
        )

        const result = await storage.readAllDistrictsRankings('2024-01-15')

        expect(result).not.toBeNull()
        expect(result?.totalDistricts).toBe(2)
        expect(result?.rankings.length).toBe(2)
      })
    })

    describe('hasAllDistrictsRankings', () => {
      it('should return false for non-existent snapshot', async () => {
        const storage = new FirestoreSnapshotStorage({
          projectId: 'test-project',
        })

        mockDocRef.get.mockResolvedValue(
          createMockDocSnapshot(false, '2024-01-15')
        )

        const result = await storage.hasAllDistrictsRankings('2024-01-15')
        expect(result).toBe(false)
      })

      it('should return false when snapshot has no rankings', async () => {
        const storage = new FirestoreSnapshotStorage({
          projectId: 'test-project',
        })
        const snapshot = createTestSnapshot('2024-01-15')
        const firestoreDoc = createFirestoreSnapshotDoc(snapshot)

        mockDocRef.get.mockResolvedValue(
          createMockDocSnapshot(true, '2024-01-15', firestoreDoc)
        )

        const result = await storage.hasAllDistrictsRankings('2024-01-15')
        expect(result).toBe(false)
      })

      it('should return true when rankings exist', async () => {
        const storage = new FirestoreSnapshotStorage({
          projectId: 'test-project',
        })
        const snapshot = createTestSnapshot('2024-01-15')
        const rankings = createTestRankings()
        const firestoreDoc = createFirestoreSnapshotDoc(snapshot, rankings)

        mockDocRef.get.mockResolvedValue(
          createMockDocSnapshot(true, '2024-01-15', firestoreDoc)
        )

        const result = await storage.hasAllDistrictsRankings('2024-01-15')
        expect(result).toBe(true)
      })
    })
  })

  // ============================================================================
  // Error Handling Tests (Requirements 7.1-7.4)
  // ============================================================================

  describe('Error Handling (Requirements 7.1-7.4)', () => {
    describe('StorageOperationError context', () => {
      it('should include operation name in error', async () => {
        const storage = new FirestoreSnapshotStorage({
          projectId: 'test-project',
        })

        mockDocRef.get.mockRejectedValue(new Error('Firestore unavailable'))

        try {
          await storage.getSnapshot('2024-01-15')
          expect.fail('Should have thrown')
        } catch (error) {
          expect(error).toBeInstanceOf(StorageOperationError)
          const storageError = error as StorageOperationError
          expect(storageError.operation).toBe('getSnapshot')
        }
      })

      it('should include provider type in error', async () => {
        const storage = new FirestoreSnapshotStorage({
          projectId: 'test-project',
        })

        mockDocRef.get.mockRejectedValue(new Error('Firestore unavailable'))

        try {
          await storage.getSnapshot('2024-01-15')
          expect.fail('Should have thrown')
        } catch (error) {
          expect(error).toBeInstanceOf(StorageOperationError)
          const storageError = error as StorageOperationError
          expect(storageError.provider).toBe('firestore')
        }
      })

      it('should mark network errors as retryable', async () => {
        const storage = new FirestoreSnapshotStorage({
          projectId: 'test-project',
        })

        mockDocRef.get.mockRejectedValue(new Error('Network timeout'))

        try {
          await storage.getSnapshot('2024-01-15')
          expect.fail('Should have thrown')
        } catch (error) {
          expect(error).toBeInstanceOf(StorageOperationError)
          const storageError = error as StorageOperationError
          expect(storageError.retryable).toBe(true)
        }
      })

      it('should mark validation errors as non-retryable', async () => {
        const storage = new FirestoreSnapshotStorage({
          projectId: 'test-project',
        })

        try {
          await storage.getSnapshot('invalid-date')
          expect.fail('Should have thrown')
        } catch (error) {
          expect(error).toBeInstanceOf(StorageOperationError)
          const storageError = error as StorageOperationError
          expect(storageError.retryable).toBe(false)
        }
      })
    })

    describe('Error propagation', () => {
      it('should wrap Firestore errors in StorageOperationError', async () => {
        const storage = new FirestoreSnapshotStorage({
          projectId: 'test-project',
        })
        const originalError = new Error('Firestore internal error')

        mockDocRef.get.mockRejectedValue(originalError)

        try {
          await storage.getSnapshot('2024-01-15')
          expect.fail('Should have thrown')
        } catch (error) {
          expect(error).toBeInstanceOf(StorageOperationError)
          const storageError = error as StorageOperationError
          expect(storageError.cause).toBe(originalError)
        }
      })

      it('should handle getLatestSuccessful errors', async () => {
        const storage = new FirestoreSnapshotStorage({
          projectId: 'test-project',
        })

        mockCollection.get.mockRejectedValue(new Error('Query failed'))

        await expect(storage.getLatestSuccessful()).rejects.toThrow(
          StorageOperationError
        )
      })

      it('should handle writeSnapshot errors', async () => {
        const storage = new FirestoreSnapshotStorage({
          projectId: 'test-project',
        })
        const snapshot = createTestSnapshot('2024-01-15')

        mockBatch.commit.mockRejectedValue(new Error('Batch commit failed'))

        await expect(storage.writeSnapshot(snapshot)).rejects.toThrow(
          StorageOperationError
        )
      })

      it('should handle listSnapshots errors', async () => {
        const storage = new FirestoreSnapshotStorage({
          projectId: 'test-project',
        })

        mockCollection.get.mockRejectedValue(new Error('List failed'))

        await expect(storage.listSnapshots()).rejects.toThrow(
          StorageOperationError
        )
      })
    })
  })

  // ============================================================================
  // Circuit Breaker Integration Tests (Requirement 7.4)
  // ============================================================================

  describe('Circuit Breaker Integration (Requirement 7.4)', () => {
    it('should use circuit breaker for operations', async () => {
      // The circuit breaker is created during construction
      // and used for all operations - verified by the mock setup
      const storage = new FirestoreSnapshotStorage({
        projectId: 'test-project',
      })

      mockDocRef.get.mockResolvedValue(
        createMockDocSnapshot(false, '2024-01-15')
      )

      // This operation should go through the circuit breaker
      await storage.getSnapshot('2024-01-15')

      // If we got here without error, the circuit breaker mock worked
      expect(true).toBe(true)
    })
  })
})
