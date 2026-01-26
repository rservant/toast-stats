/**
 * Unit tests for FirestoreTimeSeriesIndexStorage
 *
 * Tests the FirestoreTimeSeriesIndexStorage implementation with mocked Firestore client.
 *
 * **Validates: Requirements 4.2**
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Mock } from 'vitest'
import { StorageOperationError } from '../../../types/storageInterfaces.js'
import type { TimeSeriesDataPoint } from '../../../types/precomputedAnalytics.js'

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
  collection: Mock
  id: string
}

interface MockCollectionReference {
  doc: Mock
  get: Mock
  limit: Mock
}

interface MockBatch {
  set: Mock
  commit: Mock
}

let districtProgramYearsMap = new Map<string, MockCollectionReference>()
let mockBatch: MockBatch
let mockTimeSeriesCollection: MockCollectionReference

function createMockCollection(): MockCollectionReference {
  return {
    doc: vi.fn(),
    get: vi.fn(),
    limit: vi.fn().mockReturnThis(),
  }
}

function createMockDocRef(id: string): MockDocumentReference {
  return {
    get: vi.fn(),
    set: vi.fn(),
    collection: vi.fn(),
    id,
  }
}

function createMockBatch(): MockBatch {
  return {
    set: vi.fn().mockReturnThis(),
    commit: vi.fn().mockResolvedValue(undefined),
  }
}

vi.mock('@google-cloud/firestore', () => {
  const MockFirestore = function (this: Record<string, unknown>) {
    mockBatch = createMockBatch()
    mockTimeSeriesCollection = createMockCollection()

    mockTimeSeriesCollection.doc.mockImplementation((districtId: string) => {
      const districtDocRef = createMockDocRef(districtId)
      let programYearsCol = districtProgramYearsMap.get(districtId)
      if (!programYearsCol) {
        programYearsCol = createMockCollection()
        districtProgramYearsMap.set(districtId, programYearsCol)
      }
      districtDocRef.collection.mockReturnValue(programYearsCol)
      return districtDocRef
    })

    this.collection = vi.fn().mockReturnValue(mockTimeSeriesCollection)
    this.batch = vi.fn().mockReturnValue(mockBatch)
  }

  return { Firestore: MockFirestore }
})

vi.mock('../../../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('../../../utils/CircuitBreaker.js', () => ({
  CircuitBreaker: {
    createCacheCircuitBreaker: vi.fn(() => ({
      execute: vi.fn(async <T>(operation: () => Promise<T>) => operation()),
    })),
  },
}))

import { FirestoreTimeSeriesIndexStorage } from '../FirestoreTimeSeriesIndexStorage.js'

const createTestDataPoint = (
  date: string,
  snapshotId: string,
  membership: number = 100
): TimeSeriesDataPoint => ({
  date,
  snapshotId,
  membership,
  payments: membership * 10,
  dcpGoals: 5,
  distinguishedTotal: 3,
  clubCounts: {
    total: 10,
    thriving: 5,
    vulnerable: 3,
    interventionRequired: 2,
  },
})

function createMockDocSnapshot(
  exists: boolean,
  id: string,
  data?: Record<string, unknown>
): MockDocumentSnapshot {
  const ref = createMockDocRef(id)
  return { exists, id, ref, data: () => data }
}

function createMockQuerySnapshot(
  docs: MockDocumentSnapshot[]
): MockQuerySnapshot {
  return { empty: docs.length === 0, docs }
}

function createMockProgramYearDoc(
  programYear: string,
  districtId: string,
  dataPoints: TimeSeriesDataPoint[]
): MockDocumentSnapshot {
  const memberships = dataPoints.map(dp => dp.membership)
  const firstDataPoint = dataPoints[0]
  const lastDataPoint = dataPoints[dataPoints.length - 1]

  return createMockDocSnapshot(true, programYear, {
    districtId,
    programYear,
    startDate: programYear.split('-')[0] + '-07-01',
    endDate: programYear.split('-')[1] + '-06-30',
    lastUpdated: new Date().toISOString(),
    dataPoints,
    summary: {
      totalDataPoints: dataPoints.length,
      membershipStart: firstDataPoint?.membership ?? 0,
      membershipEnd: lastDataPoint?.membership ?? 0,
      membershipPeak: dataPoints.length > 0 ? Math.max(...memberships) : 0,
      membershipLow: dataPoints.length > 0 ? Math.min(...memberships) : 0,
    },
  })
}

function setupDistrictsMock(districtIds: string[]): void {
  const districtDocs = districtIds.map(id =>
    createMockDocSnapshot(true, id, { districtId: id })
  )
  mockTimeSeriesCollection.get.mockResolvedValue(
    createMockQuerySnapshot(districtDocs)
  )
}

function setupProgramYearsMock(
  districtId: string,
  programYearDocs: MockDocumentSnapshot[]
): void {
  let programYearsCol = districtProgramYearsMap.get(districtId)
  if (!programYearsCol) {
    programYearsCol = createMockCollection()
    districtProgramYearsMap.set(districtId, programYearsCol)
  }
  programYearsCol.get.mockResolvedValue(
    createMockQuerySnapshot(programYearDocs)
  )
}

describe('FirestoreTimeSeriesIndexStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    districtProgramYearsMap = new Map()
    mockBatch = createMockBatch()
    mockTimeSeriesCollection = createMockCollection()
    mockTimeSeriesCollection.doc.mockImplementation((districtId: string) => {
      const districtDocRef = createMockDocRef(districtId)
      let programYearsCol = districtProgramYearsMap.get(districtId)
      if (!programYearsCol) {
        programYearsCol = createMockCollection()
        districtProgramYearsMap.set(districtId, programYearsCol)
      }
      districtDocRef.collection.mockReturnValue(programYearsCol)
      return districtDocRef
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('deleteSnapshotEntries', () => {
    it('should remove entries matching the snapshot ID', async () => {
      const storage = new FirestoreTimeSeriesIndexStorage({
        projectId: 'test-project',
      })

      const dataPoints = [
        createTestDataPoint('2024-01-15', '2024-01-15', 100),
        createTestDataPoint('2024-01-16', '2024-01-16', 105),
        createTestDataPoint('2024-01-17', '2024-01-17', 110),
      ]

      setupDistrictsMock(['42'])
      setupProgramYearsMock('42', [
        createMockProgramYearDoc('2023-2024', '42', dataPoints),
      ])

      const removedCount = await storage.deleteSnapshotEntries('2024-01-16')

      expect(removedCount).toBe(1)
      expect(mockBatch.set).toHaveBeenCalledTimes(1)
      expect(mockBatch.commit).toHaveBeenCalledTimes(1)
    })

    it('should return the count of removed entries', async () => {
      const storage = new FirestoreTimeSeriesIndexStorage({
        projectId: 'test-project',
      })
      const targetSnapshotId = '2024-01-16'

      setupDistrictsMock(['42', '61'])
      setupProgramYearsMock('42', [
        createMockProgramYearDoc('2023-2024', '42', [
          createTestDataPoint('2024-01-15', '2024-01-15', 100),
          createTestDataPoint('2024-01-16', targetSnapshotId, 105),
        ]),
      ])
      setupProgramYearsMock('61', [
        createMockProgramYearDoc('2023-2024', '61', [
          createTestDataPoint('2024-01-15', '2024-01-15', 200),
          createTestDataPoint('2024-01-16', targetSnapshotId, 210),
        ]),
      ])

      const removedCount = await storage.deleteSnapshotEntries(targetSnapshotId)
      expect(removedCount).toBe(2)
    })

    it('should return 0 when no entries match', async () => {
      const storage = new FirestoreTimeSeriesIndexStorage({
        projectId: 'test-project',
      })

      setupDistrictsMock(['42'])
      setupProgramYearsMock('42', [
        createMockProgramYearDoc('2023-2024', '42', [
          createTestDataPoint('2024-01-15', '2024-01-15', 100),
        ]),
      ])

      const removedCount = await storage.deleteSnapshotEntries('2024-12-31')
      expect(removedCount).toBe(0)
    })

    it('should return 0 when collection is empty', async () => {
      const storage = new FirestoreTimeSeriesIndexStorage({
        projectId: 'test-project',
      })
      mockTimeSeriesCollection.get.mockResolvedValue(
        createMockQuerySnapshot([])
      )

      const removedCount = await storage.deleteSnapshotEntries('2024-01-15')
      expect(removedCount).toBe(0)
    })

    it('should throw StorageOperationError for invalid snapshotId', async () => {
      const storage = new FirestoreTimeSeriesIndexStorage({
        projectId: 'test-project',
      })

      await expect(storage.deleteSnapshotEntries('invalid')).rejects.toThrow(
        StorageOperationError
      )
      await expect(storage.deleteSnapshotEntries('')).rejects.toThrow(
        StorageOperationError
      )
    })
  })

  describe('isReady', () => {
    it('should return true when accessible', async () => {
      const storage = new FirestoreTimeSeriesIndexStorage({
        projectId: 'test-project',
      })
      mockTimeSeriesCollection.limit.mockReturnThis()
      mockTimeSeriesCollection.get.mockResolvedValue(
        createMockQuerySnapshot([])
      )

      const ready = await storage.isReady()
      expect(ready).toBe(true)
    })

    it('should return false when not accessible', async () => {
      const storage = new FirestoreTimeSeriesIndexStorage({
        projectId: 'test-project',
      })
      mockTimeSeriesCollection.limit.mockReturnThis()
      mockTimeSeriesCollection.get.mockRejectedValue(
        new Error('Connection failed')
      )

      const ready = await storage.isReady()
      expect(ready).toBe(false)
    })
  })
})
