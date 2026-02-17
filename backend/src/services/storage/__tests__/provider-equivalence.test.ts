/**
 * Unit Tests for Provider Contract Equivalence
 *
 * Verifies that different storage provider implementations produce
 * identical results for the same sequence of operations.
 *
 * Converted from property-based tests — the PBT generated test data
 * via fast-check but assertions are contract equivalence checks, not
 * mathematical invariants. Fixed test data covers the same scenarios.
 */

import { describe, it, expect, afterEach } from 'vitest'
import * as path from 'node:path'
import * as fs from 'node:fs/promises'
import { LocalSnapshotStorage } from '../LocalSnapshotStorage.js'
import { LocalRawCSVStorage } from '../LocalRawCSVStorage.js'
import type { Snapshot } from '../../../types/snapshots.js'
import type { DistrictStatistics } from '../../../types/districts.js'
import { CSVType } from '../../../types/rawCSVCache.js'
import type {
  ICacheConfigService,
  ILogger,
} from '../../../types/serviceInterfaces.js'

// ============================================================================
// Test Helpers
// ============================================================================

function isFirestoreEmulatorAvailable(): boolean {
  return !!process.env['FIRESTORE_EMULATOR_HOST']
}

function isGCSEmulatorAvailable(): boolean {
  return !!process.env['STORAGE_EMULATOR_HOST']
}

function createMockLogger(): ILogger {
  return {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  }
}

function createTestCacheConfigService(cacheDir: string): ICacheConfigService {
  return {
    getCacheDirectory: () => cacheDir,
    getConfiguration: () => ({
      cacheDirectory: cacheDir,
      maxCacheAgeDays: 30,
      maxCacheSizeMB: 100,
      enableCompression: false,
      enableBackup: false,
    }),
    initialize: async () => {},
    validateCacheDirectory: async () => true,
    isReady: () => true,
    dispose: async () => {},
  }
}

function createMinimalDistrictStats(
  districtId: string,
  asOfDate: string
): DistrictStatistics {
  return {
    districtId,
    snapshotDate: asOfDate,
    clubs: [],
    divisions: [],
    areas: [],
    divisionPerformance: [],
    clubPerformance: [],
    districtPerformance: [],
    totals: {
      totalClubs: 0,
      totalMembership: 0,
      totalPayments: 0,
      distinguishedClubs: 0,
      selectDistinguishedClubs: 0,
      presidentDistinguishedClubs: 0,
    },
  }
}

function createTestSnapshot(
  date: string,
  status: 'success' | 'error',
  districtIds: string[]
): Snapshot {
  return {
    snapshot_id: date,
    created_at: new Date().toISOString(),
    schema_version: '1.0.0',
    calculation_version: '1.0.0',
    status,
    errors: status === 'success' ? [] : ['Test error'],
    payload: {
      districts: districtIds.map(id => createMinimalDistrictStats(id, date)),
      metadata: {
        source: 'test' as const,
        fetchedAt: new Date().toISOString(),
        dataAsOfDate: date,
        districtCount: districtIds.length,
        processingDurationMs: 100,
      },
    },
  }
}

// ============================================================================
// Comparison Utilities
// ============================================================================

function compareSnapshots(a: Snapshot | null, b: Snapshot | null): boolean {
  if (a === null && b === null) return true
  if (a === null || b === null) return false
  if (a.snapshot_id !== b.snapshot_id) return false
  if (a.status !== b.status) return false
  if (a.payload.districts.length !== b.payload.districts.length) return false
  const aIds = a.payload.districts.map(d => d.districtId).sort()
  const bIds = b.payload.districts.map(d => d.districtId).sort()
  return JSON.stringify(aIds) === JSON.stringify(bIds)
}

function compareSnapshotLists(
  a: Array<{ snapshot_id: string; status: string }>,
  b: Array<{ snapshot_id: string; status: string }>
): boolean {
  if (a.length !== b.length) return false
  const sortedA = [...a].sort((x, y) =>
    x.snapshot_id.localeCompare(y.snapshot_id)
  )
  const sortedB = [...b].sort((x, y) =>
    x.snapshot_id.localeCompare(y.snapshot_id)
  )
  for (let i = 0; i < sortedA.length; i++) {
    if (sortedA[i]?.snapshot_id !== sortedB[i]?.snapshot_id) return false
    if (sortedA[i]?.status !== sortedB[i]?.status) return false
  }
  return true
}

// ============================================================================
// Test Constants
// ============================================================================

const TEST_DATES = ['2024-01-15', '2024-02-20', '2024-03-25']
const TEST_DISTRICT_IDS = ['1', '2']

// ============================================================================
// Test Suites
// ============================================================================

describe('Provider Contract Equivalence', () => {
  const cleanupDirs: string[] = []

  afterEach(async () => {
    for (const dir of cleanupDirs) {
      try {
        await fs.rm(dir, { recursive: true, force: true })
      } catch {
        // Ignore cleanup errors
      }
    }
    cleanupDirs.length = 0
  })

  // --------------------------------------------------------------------------
  // LocalSnapshotStorage Self-Consistency
  // --------------------------------------------------------------------------

  describe('LocalSnapshotStorage Contract Consistency', () => {
    async function createTwoLocalStorages() {
      const testId = `equiv-local-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
      const dir1 = path.join(process.cwd(), 'test-cache', `${testId}-1`)
      const dir2 = path.join(process.cwd(), 'test-cache', `${testId}-2`)
      await fs.mkdir(dir1, { recursive: true })
      await fs.mkdir(dir2, { recursive: true })
      cleanupDirs.push(dir1, dir2)
      return {
        storage1: new LocalSnapshotStorage({ cacheDir: dir1 }),
        storage2: new LocalSnapshotStorage({ cacheDir: dir2 }),
      }
    }

    it('should produce identical results for write/read/list operations', async () => {
      const { storage1, storage2 } = await createTwoLocalStorages()

      // Write snapshots to both
      for (const date of TEST_DATES) {
        const snapshot = createTestSnapshot(date, 'success', TEST_DISTRICT_IDS)
        await storage1.writeSnapshot(snapshot)
        await storage2.writeSnapshot(snapshot)
      }

      // Read each snapshot — results should match
      for (const date of TEST_DATES) {
        const r1 = await storage1.getSnapshot(date)
        const r2 = await storage2.getSnapshot(date)
        expect(compareSnapshots(r1, r2)).toBe(true)
      }

      // List — results should match
      const list1 = await storage1.listSnapshots()
      const list2 = await storage2.listSnapshots()
      expect(compareSnapshotLists(list1, list2)).toBe(true)

      // getLatest — results should match
      const latest1 = await storage1.getLatest()
      const latest2 = await storage2.getLatest()
      expect(compareSnapshots(latest1, latest2)).toBe(true)

      // getLatestSuccessful — results should match
      const latestSucc1 = await storage1.getLatestSuccessful()
      const latestSucc2 = await storage2.getLatestSuccessful()
      expect(compareSnapshots(latestSucc1, latestSucc2)).toBe(true)
    })

    it('should produce identical results with mixed success/error snapshots', async () => {
      const { storage1, storage2 } = await createTwoLocalStorages()

      const successSnap = createTestSnapshot(
        '2024-01-15',
        'success',
        TEST_DISTRICT_IDS
      )
      const errorSnap = createTestSnapshot(
        '2024-02-20',
        'error',
        TEST_DISTRICT_IDS
      )

      await storage1.writeSnapshot(successSnap)
      await storage1.writeSnapshot(errorSnap)
      await storage2.writeSnapshot(successSnap)
      await storage2.writeSnapshot(errorSnap)

      const latestSucc1 = await storage1.getLatestSuccessful()
      const latestSucc2 = await storage2.getLatestSuccessful()
      expect(compareSnapshots(latestSucc1, latestSucc2)).toBe(true)

      const latest1 = await storage1.getLatest()
      const latest2 = await storage2.getLatest()
      expect(compareSnapshots(latest1, latest2)).toBe(true)
    })
  })

  // --------------------------------------------------------------------------
  // LocalSnapshotStorage vs FirestoreSnapshotStorage Equivalence
  // --------------------------------------------------------------------------

  describe.skipIf(!isFirestoreEmulatorAvailable())(
    'LocalSnapshotStorage vs FirestoreSnapshotStorage Equivalence',
    () => {
      it('should produce identical results for same operations', async () => {
        // Dynamically import to avoid errors when emulator not available
        const { FirestoreSnapshotStorage } =
          await import('../FirestoreSnapshotStorage.js')
        const testId = `equiv-snap-${Date.now()}`
        const localDir = path.join(process.cwd(), 'test-cache', testId)
        await fs.mkdir(localDir, { recursive: true })
        cleanupDirs.push(localDir)

        const localStorage = new LocalSnapshotStorage({ cacheDir: localDir })
        const firestoreStorage = new FirestoreSnapshotStorage({
          projectId: 'test-project',
          collectionName: `snapshots-equiv-${testId}`,
        })

        // Write same snapshots to both
        for (const date of TEST_DATES) {
          const snapshot = createTestSnapshot(
            date,
            'success',
            TEST_DISTRICT_IDS
          )
          await localStorage.writeSnapshot(snapshot)
          await firestoreStorage.writeSnapshot(snapshot)
        }

        // Compare reads
        for (const date of TEST_DATES) {
          const localResult = await localStorage.getSnapshot(date)
          const firestoreResult = await firestoreStorage.getSnapshot(date)
          expect(compareSnapshots(localResult, firestoreResult)).toBe(true)
        }

        // Compare lists
        const localList = await localStorage.listSnapshots()
        const firestoreList = await firestoreStorage.listSnapshots()
        expect(compareSnapshotLists(localList, firestoreList)).toBe(true)
      })
    }
  )

  // --------------------------------------------------------------------------
  // LocalRawCSVStorage Self-Consistency
  // --------------------------------------------------------------------------

  describe('LocalRawCSVStorage Contract Consistency', () => {
    async function createTwoLocalCSVStorages() {
      const testId = `equiv-csv-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
      const dir1 = path.join(
        process.cwd(),
        'test-cache',
        `${testId}-1`,
        'raw-csv'
      )
      const dir2 = path.join(
        process.cwd(),
        'test-cache',
        `${testId}-2`,
        'raw-csv'
      )
      await fs.mkdir(dir1, { recursive: true })
      await fs.mkdir(dir2, { recursive: true })
      cleanupDirs.push(
        path.join(process.cwd(), 'test-cache', `${testId}-1`),
        path.join(process.cwd(), 'test-cache', `${testId}-2`)
      )

      const logger = createMockLogger()
      return {
        storage1: new LocalRawCSVStorage(
          createTestCacheConfigService(dir1),
          logger
        ),
        storage2: new LocalRawCSVStorage(
          createTestCacheConfigService(dir2),
          logger
        ),
      }
    }

    it('should produce identical results for write/read/has/list CSV operations', async () => {
      const { storage1, storage2 } = await createTwoLocalCSVStorages()
      const testContent = 'header1,header2\nvalue1,value2\nvalue3,value4'

      // Write same CSV to both
      for (const date of TEST_DATES) {
        await storage1.setCachedCSV(date, CSVType.ALL_DISTRICTS, testContent)
        await storage2.setCachedCSV(date, CSVType.ALL_DISTRICTS, testContent)
      }

      // Read — results should match
      for (const date of TEST_DATES) {
        const r1 = await storage1.getCachedCSV(date, CSVType.ALL_DISTRICTS)
        const r2 = await storage2.getCachedCSV(date, CSVType.ALL_DISTRICTS)
        expect(r1).toBe(r2)
      }

      // Has — results should match
      for (const date of TEST_DATES) {
        const h1 = await storage1.hasCachedCSV(date, CSVType.ALL_DISTRICTS)
        const h2 = await storage2.hasCachedCSV(date, CSVType.ALL_DISTRICTS)
        expect(h1).toBe(h2)
      }

      // List dates — results should match
      const dates1 = await storage1.getCachedDates()
      const dates2 = await storage2.getCachedDates()
      expect([...dates1].sort()).toEqual([...dates2].sort())
    })
  })

  // --------------------------------------------------------------------------
  // LocalRawCSVStorage vs GCSRawCSVStorage Equivalence
  // --------------------------------------------------------------------------

  describe.skipIf(!isGCSEmulatorAvailable())(
    'LocalRawCSVStorage vs GCSRawCSVStorage Equivalence',
    () => {
      it('should produce identical results for same CSV operations', async () => {
        const { GCSRawCSVStorage } = await import('../GCSRawCSVStorage.js')
        const testId = `equiv-csv-${Date.now()}`
        const localDir = path.join(
          process.cwd(),
          'test-cache',
          testId,
          'raw-csv'
        )
        await fs.mkdir(localDir, { recursive: true })
        cleanupDirs.push(path.join(process.cwd(), 'test-cache', testId))

        const logger = createMockLogger()
        const localStorage = new LocalRawCSVStorage(
          createTestCacheConfigService(localDir),
          logger
        )
        const gcsStorage = new GCSRawCSVStorage({
          projectId: 'test-project',
          bucketName: `test-bucket-equiv-${testId}`,
        })

        const testContent = 'col1,col2\na,1\nb,2'

        // Write same CSV to both
        for (const date of TEST_DATES) {
          await localStorage.setCachedCSV(
            date,
            CSVType.ALL_DISTRICTS,
            testContent
          )
          await gcsStorage.setCachedCSV(
            date,
            CSVType.ALL_DISTRICTS,
            testContent
          )
        }

        // Compare reads
        for (const date of TEST_DATES) {
          const localResult = await localStorage.getCachedCSV(
            date,
            CSVType.ALL_DISTRICTS
          )
          const gcsResult = await gcsStorage.getCachedCSV(
            date,
            CSVType.ALL_DISTRICTS
          )
          expect(localResult).toBe(gcsResult)
        }
      })
    }
  )
})
