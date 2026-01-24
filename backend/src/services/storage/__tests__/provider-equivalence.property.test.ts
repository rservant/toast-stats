/**
 * Property-Based Tests for Provider Contract Equivalence
 *
 * Feature: gcp-storage-migration
 * Property 4: Provider Contract Equivalence
 *
 * **Validates: Requirements 4.4, 1.1, 1.2**
 *
 * For any sequence of valid storage operations, both LocalSnapshotStorage and
 * FirestoreSnapshotStorage (and LocalRawCSVStorage and GCSRawCSVStorage) SHALL
 * produce equivalent observable results when given the same inputs.
 *
 * This test generates operation sequences and verifies that both provider
 * implementations behave identically, ensuring the storage abstraction layer
 * maintains consistent behavior across backends.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import fs from 'fs/promises'
import path from 'path'
import { LocalSnapshotStorage } from '../LocalSnapshotStorage.js'
import { FirestoreSnapshotStorage } from '../FirestoreSnapshotStorage.js'
import { LocalRawCSVStorage } from '../LocalRawCSVStorage.js'
import { GCSRawCSVStorage } from '../GCSRawCSVStorage.js'
import type {
  ISnapshotStorage,
  IRawCSVStorage,
} from '../../../types/storageInterfaces.js'
import type { Snapshot, SnapshotStatus } from '../../../types/snapshots.js'
import type { DistrictStatistics } from '../../../types/districts.js'
import { CSVType } from '../../../types/rawCSVCache.js'
import type {
  ICacheConfigService,
  ILogger,
} from '../../../types/serviceInterfaces.js'

// ============================================================================
// Test Configuration
// ============================================================================

const PROPERTY_TEST_ITERATIONS = 100
const PROPERTY_TEST_TIMEOUT = 180000 // 3 minutes for equivalence tests

/**
 * Check if Firestore emulator is available
 */
function isFirestoreEmulatorAvailable(): boolean {
  return !!process.env['FIRESTORE_EMULATOR_HOST']
}

/**
 * Check if GCS emulator is available
 */
function isGCSEmulatorAvailable(): boolean {
  return !!process.env['STORAGE_EMULATOR_HOST']
}

// ============================================================================
// Mock Utilities
// ============================================================================

/**
 * Create a mock logger for testing
 */
function createMockLogger(): ILogger {
  return {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  }
}

/**
 * Create a test cache config service
 */
function createTestCacheConfigService(cacheDir: string): ICacheConfigService {
  return {
    getCacheDirectory: () => cacheDir,
    getConfiguration: () => ({
      baseDirectory: cacheDir,
      isConfigured: true,
      source: 'test' as const,
      validationStatus: {
        isValid: true,
        isAccessible: true,
        isSecure: true,
      },
    }),
    initialize: async () => {},
    validateCacheDirectory: async () => {},
    isReady: () => true,
    dispose: async () => {},
  }
}

// ============================================================================
// Fast-Check Generators
// ============================================================================

/**
 * Generator for valid ISO date strings (YYYY-MM-DD)
 */
const generateISODate = (): fc.Arbitrary<string> =>
  fc
    .tuple(
      fc.integer({ min: 2020, max: 2030 }),
      fc.integer({ min: 1, max: 12 }),
      fc.integer({ min: 1, max: 28 })
    )
    .map(
      ([year, month, day]) =>
        `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    )

/**
 * Generator for valid ISO timestamp strings
 */
const generateISOTimestamp = (): fc.Arbitrary<string> =>
  generateISODate().map(date => `${date}T12:00:00.000Z`)

/**
 * Generator for valid district IDs (alphanumeric)
 */
const generateDistrictId = (): fc.Arbitrary<string> =>
  fc.oneof(
    fc.integer({ min: 1, max: 999 }).map(n => String(n)),
    fc.constantFrom('A', 'B', 'C', 'D', 'E', 'F', 'U')
  )

/**
 * Generator for snapshot status
 */
const generateSnapshotStatus = (): fc.Arbitrary<SnapshotStatus> =>
  fc.constantFrom('success', 'partial', 'failed')

/**
 * Generator for schema version strings
 */
const generateSchemaVersion = (): fc.Arbitrary<string> =>
  fc
    .tuple(
      fc.integer({ min: 1, max: 5 }),
      fc.integer({ min: 0, max: 9 }),
      fc.integer({ min: 0, max: 9 })
    )
    .map(([major, minor, patch]) => `${major}.${minor}.${patch}`)

/**
 * Generator for minimal district statistics
 */
const generateMinimalDistrictStatistics = (
  districtId: string,
  asOfDate: string
): DistrictStatistics => ({
  districtId,
  asOfDate,
  membership: {
    total: 100,
    change: 0,
    changePercent: 0,
    byClub: [],
  },
  clubs: {
    total: 10,
    active: 8,
    suspended: 1,
    ineligible: 0,
    low: 1,
    distinguished: 3,
  },
  education: {
    totalAwards: 50,
    byType: [],
    topClubs: [],
  },
})

/**
 * Generator for a minimal snapshot with specified date and status
 */
const generateMinimalSnapshot = (
  date: string,
  status: SnapshotStatus,
  districtIds: string[]
): fc.Arbitrary<Snapshot> =>
  fc
    .tuple(
      generateSchemaVersion(),
      generateSchemaVersion(),
      generateISOTimestamp()
    )
    .map(([schemaVersion, calcVersion, createdAt]) => ({
      snapshot_id: date,
      created_at: createdAt,
      schema_version: schemaVersion,
      calculation_version: calcVersion,
      status,
      errors: status === 'success' ? [] : ['Test error'],
      payload: {
        districts: districtIds.map(id =>
          generateMinimalDistrictStatistics(id, date)
        ),
        metadata: {
          source: 'test' as const,
          fetchedAt: createdAt,
          dataAsOfDate: date,
          districtCount: districtIds.length,
          processingDurationMs: 100,
        },
      },
    }))

/**
 * Generator for unique dates (ensures no duplicates)
 */
const generateUniqueDates = (count: number): fc.Arbitrary<string[]> => {
  const datePool: string[] = []
  for (let year = 2020; year <= 2025; year++) {
    for (let month = 1; month <= 12; month++) {
      for (let day = 1; day <= 28; day++) {
        datePool.push(
          `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        )
      }
    }
  }
  return fc.shuffledSubarray(datePool, { minLength: count, maxLength: count })
}

/**
 * Generator for unique district IDs
 */
const generateUniqueDistrictIds = (count: number): fc.Arbitrary<string[]> => {
  const allPossibleIds = [
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '10',
    '11',
    '12',
    '13',
    '14',
    '15',
    '16',
    '17',
    '18',
    '19',
    '20',
    'A',
    'B',
    'C',
    'D',
    'E',
    'F',
    'U',
  ]
  if (count === 0) return fc.constant([])
  return fc.shuffledSubarray(allPossibleIds, {
    minLength: count,
    maxLength: count,
  })
}

// ============================================================================
// Snapshot Operation Types
// ============================================================================

/**
 * Types of snapshot operations for equivalence testing
 */
type SnapshotOperationType =
  | 'write'
  | 'read'
  | 'list'
  | 'getLatest'
  | 'getLatestSuccessful'

/**
 * Snapshot operation definition
 */
interface SnapshotOperation {
  type: SnapshotOperationType
  snapshotId?: string
  snapshot?: Snapshot
}

/**
 * Generator for snapshot operation sequences
 */
const generateSnapshotOperationSequence = (
  dates: string[],
  districtIds: string[]
): fc.Arbitrary<SnapshotOperation[]> => {
  // First, generate write operations for all dates
  const writeOps: fc.Arbitrary<SnapshotOperation[]> = fc.tuple(
    ...dates.map(date =>
      fc
        .tuple(generateSnapshotStatus(), fc.constant(date))
        .chain(([status, d]) =>
          generateMinimalSnapshot(d, status, districtIds).map(snapshot => ({
            type: 'write' as const,
            snapshotId: d,
            snapshot,
          }))
        )
    )
  )

  // Then add read operations
  return writeOps.chain(writes => {
    const readOps: SnapshotOperation[] = dates.map(date => ({
      type: 'read' as const,
      snapshotId: date,
    }))

    const listOp: SnapshotOperation = { type: 'list' as const }
    const getLatestOp: SnapshotOperation = { type: 'getLatest' as const }
    const getLatestSuccessfulOp: SnapshotOperation = {
      type: 'getLatestSuccessful' as const,
    }

    // Return writes followed by reads and queries
    return fc.constant([
      ...writes,
      ...readOps,
      listOp,
      getLatestOp,
      getLatestSuccessfulOp,
    ])
  })
}

// ============================================================================
// CSV Operation Types
// ============================================================================

/**
 * Types of CSV operations for equivalence testing
 */
type CSVOperationType = 'write' | 'read' | 'has' | 'list'

/**
 * CSV operation definition
 */
interface CSVOperation {
  type: CSVOperationType
  date?: string
  csvType?: CSVType
  districtId?: string
  content?: string
}

/**
 * Generator for safe CSV content (alphanumeric only)
 */
const generateSafeCSVContent = (): fc.Arbitrary<string> =>
  fc
    .tuple(fc.integer({ min: 2, max: 4 }), fc.integer({ min: 1, max: 5 }))
    .chain(([colCount, rowCount]) =>
      fc.tuple(
        fc.array(
          fc
            .string({ minLength: 3, maxLength: 10 })
            .filter(s => /^[a-zA-Z]+$/.test(s)),
          { minLength: colCount, maxLength: colCount }
        ),
        fc.array(
          fc.array(
            fc.oneof(
              fc
                .string({ minLength: 1, maxLength: 10 })
                .filter(s => /^[a-zA-Z0-9]+$/.test(s)),
              fc.integer({ min: 0, max: 99999 }).map(String)
            ),
            { minLength: colCount, maxLength: colCount }
          ),
          { minLength: rowCount, maxLength: rowCount }
        )
      )
    )
    .map(([headers, rows]) => {
      const headerLine = headers.join(',')
      const dataLines = rows.map(row => row.join(','))
      return [headerLine, ...dataLines].join('\n')
    })

/**
 * Generator for CSV operation sequences
 */
const generateCSVOperationSequence = (
  dates: string[]
): fc.Arbitrary<CSVOperation[]> => {
  // Generate write operations for each date
  const writeOpsArb: fc.Arbitrary<CSVOperation[]> = fc.tuple(
    ...dates.map(date =>
      generateSafeCSVContent().map(content => ({
        type: 'write' as const,
        date,
        csvType: CSVType.ALL_DISTRICTS,
        content,
      }))
    )
  )

  return writeOpsArb.map(writes => {
    // Add read operations for each date
    const readOps: CSVOperation[] = dates.map(date => ({
      type: 'read' as const,
      date,
      csvType: CSVType.ALL_DISTRICTS,
    }))

    // Add has operations for each date
    const hasOps: CSVOperation[] = dates.map(date => ({
      type: 'has' as const,
      date,
      csvType: CSVType.ALL_DISTRICTS,
    }))

    // Add list operation
    const listOp: CSVOperation = { type: 'list' as const }

    return [...writes, ...readOps, ...hasOps, listOp]
  })
}

// ============================================================================
// Result Comparison Utilities
// ============================================================================

/**
 * Compare two snapshots for equivalence (ignoring implementation-specific fields)
 */
function compareSnapshots(a: Snapshot | null, b: Snapshot | null): boolean {
  if (a === null && b === null) return true
  if (a === null || b === null) return false

  // Compare essential fields
  if (a.snapshot_id !== b.snapshot_id) return false
  if (a.status !== b.status) return false
  if (a.schema_version !== b.schema_version) return false
  if (a.calculation_version !== b.calculation_version) return false
  if (a.errors.length !== b.errors.length) return false

  // Compare district count
  if (a.payload.districts.length !== b.payload.districts.length) return false

  // Compare district IDs (sorted)
  const aDistrictIds = a.payload.districts.map(d => d.districtId).sort()
  const bDistrictIds = b.payload.districts.map(d => d.districtId).sort()
  if (JSON.stringify(aDistrictIds) !== JSON.stringify(bDistrictIds))
    return false

  return true
}

/**
 * Compare snapshot metadata lists for equivalence
 */
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

/**
 * Compare CSV content for equivalence
 */
function compareCSVContent(a: string | null, b: string | null): boolean {
  return a === b
}

/**
 * Compare date lists for equivalence
 */
function compareDateLists(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const sortedA = [...a].sort()
  const sortedB = [...b].sort()
  return JSON.stringify(sortedA) === JSON.stringify(sortedB)
}

// ============================================================================
// Test Suites
// ============================================================================

describe('Provider Contract Equivalence Property Tests', () => {
  // ============================================================================
  // LocalSnapshotStorage Self-Consistency Tests
  // ============================================================================

  describe('LocalSnapshotStorage Contract Consistency', () => {
    /**
     * Helper to create isolated local storage instances
     */
    async function createIsolatedLocalStorages(): Promise<{
      storage1: ISnapshotStorage
      storage2: ISnapshotStorage
      cleanup: () => Promise<void>
    }> {
      const testId = `equiv-local-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
      const testCacheDir1 = path.join(
        process.cwd(),
        'test-cache',
        `${testId}-1`
      )
      const testCacheDir2 = path.join(
        process.cwd(),
        'test-cache',
        `${testId}-2`
      )

      await fs.mkdir(testCacheDir1, { recursive: true })
      await fs.mkdir(testCacheDir2, { recursive: true })

      const storage1 = new LocalSnapshotStorage({ cacheDir: testCacheDir1 })
      const storage2 = new LocalSnapshotStorage({ cacheDir: testCacheDir2 })

      const cleanup = async (): Promise<void> => {
        try {
          await fs.rm(testCacheDir1, { recursive: true, force: true })
          await fs.rm(testCacheDir2, { recursive: true, force: true })
        } catch {
          // Ignore cleanup errors
        }
      }

      return { storage1, storage2, cleanup }
    }

    /**
     * Property 4a: Two LocalSnapshotStorage instances produce identical results
     *
     * Given the same sequence of operations, two independent LocalSnapshotStorage
     * instances should produce equivalent observable results.
     *
     * **Validates: Requirements 4.4, 1.1**
     */
    it(
      'Property 4a: Two LocalSnapshotStorage instances produce identical results for same operations',
      async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.tuple(generateUniqueDates(3), generateUniqueDistrictIds(2)),
            async ([dates, districtIds]) => {
              const { storage1, storage2, cleanup } =
                await createIsolatedLocalStorages()

              try {
                // Generate operation sequence
                const opsArb = generateSnapshotOperationSequence(
                  dates,
                  districtIds
                )
                const operations = fc.sample(opsArb, 1)[0]!

                // Execute operations on both storages
                for (const op of operations) {
                  switch (op.type) {
                    case 'write':
                      if (op.snapshot) {
                        await storage1.writeSnapshot(op.snapshot)
                        await storage2.writeSnapshot(op.snapshot)
                      }
                      break
                    case 'read':
                      if (op.snapshotId) {
                        const result1 = await storage1.getSnapshot(
                          op.snapshotId
                        )
                        const result2 = await storage2.getSnapshot(
                          op.snapshotId
                        )
                        expect(compareSnapshots(result1, result2)).toBe(true)
                      }
                      break
                    case 'list': {
                      const list1 = await storage1.listSnapshots()
                      const list2 = await storage2.listSnapshots()
                      expect(compareSnapshotLists(list1, list2)).toBe(true)
                      break
                    }
                    case 'getLatest': {
                      const latest1 = await storage1.getLatest()
                      const latest2 = await storage2.getLatest()
                      expect(compareSnapshots(latest1, latest2)).toBe(true)
                      break
                    }
                    case 'getLatestSuccessful': {
                      const latestSucc1 = await storage1.getLatestSuccessful()
                      const latestSucc2 = await storage2.getLatestSuccessful()
                      expect(compareSnapshots(latestSucc1, latestSucc2)).toBe(
                        true
                      )
                      break
                    }
                  }
                }

                return true
              } finally {
                await cleanup()
              }
            }
          ),
          { numRuns: PROPERTY_TEST_ITERATIONS }
        )
      },
      PROPERTY_TEST_TIMEOUT
    )
  })

  // ============================================================================
  // LocalSnapshotStorage vs FirestoreSnapshotStorage Equivalence
  // ============================================================================

  describe.skipIf(!isFirestoreEmulatorAvailable())(
    'LocalSnapshotStorage vs FirestoreSnapshotStorage Equivalence',
    () => {
      /**
       * Helper to create isolated storage instances for both providers
       */
      async function createIsolatedStorages(): Promise<{
        localStorage: ISnapshotStorage
        firestoreStorage: ISnapshotStorage
        cleanup: () => Promise<void>
      }> {
        const testId = `equiv-snap-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
        const testCacheDir = path.join(process.cwd(), 'test-cache', testId)
        await fs.mkdir(testCacheDir, { recursive: true })

        const localStorage = new LocalSnapshotStorage({
          cacheDir: testCacheDir,
        })
        const firestoreStorage = new FirestoreSnapshotStorage({
          projectId: 'test-project',
          collectionName: `snapshots-equiv-${testId}`,
        })

        const cleanup = async (): Promise<void> => {
          try {
            await fs.rm(testCacheDir, { recursive: true, force: true })
          } catch {
            // Ignore cleanup errors
          }
        }

        return { localStorage, firestoreStorage, cleanup }
      }

      /**
       * Property 4b: LocalSnapshotStorage and FirestoreSnapshotStorage produce identical results
       *
       * For any sequence of valid storage operations, both LocalSnapshotStorage and
       * FirestoreSnapshotStorage SHALL produce equivalent observable results.
       *
       * **Validates: Requirements 4.4, 1.1**
       */
      it(
        'Property 4b: LocalSnapshotStorage and FirestoreSnapshotStorage produce identical results',
        async () => {
          await fc.assert(
            fc.asyncProperty(
              fc.tuple(generateUniqueDates(3), generateUniqueDistrictIds(2)),
              async ([dates, districtIds]) => {
                const { localStorage, firestoreStorage, cleanup } =
                  await createIsolatedStorages()

                try {
                  // Generate operation sequence
                  const opsArb = generateSnapshotOperationSequence(
                    dates,
                    districtIds
                  )
                  const operations = fc.sample(opsArb, 1)[0]!

                  // Execute operations on both storages
                  for (const op of operations) {
                    switch (op.type) {
                      case 'write':
                        if (op.snapshot) {
                          await localStorage.writeSnapshot(op.snapshot)
                          await firestoreStorage.writeSnapshot(op.snapshot)
                        }
                        break
                      case 'read':
                        if (op.snapshotId) {
                          const localResult = await localStorage.getSnapshot(
                            op.snapshotId
                          )
                          const firestoreResult =
                            await firestoreStorage.getSnapshot(op.snapshotId)
                          expect(
                            compareSnapshots(localResult, firestoreResult)
                          ).toBe(true)
                        }
                        break
                      case 'list': {
                        const localList = await localStorage.listSnapshots()
                        const firestoreList =
                          await firestoreStorage.listSnapshots()
                        expect(
                          compareSnapshotLists(localList, firestoreList)
                        ).toBe(true)
                        break
                      }
                      case 'getLatest': {
                        const localLatest = await localStorage.getLatest()
                        const firestoreLatest =
                          await firestoreStorage.getLatest()
                        expect(
                          compareSnapshots(localLatest, firestoreLatest)
                        ).toBe(true)
                        break
                      }
                      case 'getLatestSuccessful': {
                        const localLatestSucc =
                          await localStorage.getLatestSuccessful()
                        const firestoreLatestSucc =
                          await firestoreStorage.getLatestSuccessful()
                        expect(
                          compareSnapshots(localLatestSucc, firestoreLatestSucc)
                        ).toBe(true)
                        break
                      }
                    }
                  }

                  return true
                } finally {
                  await cleanup()
                }
              }
            ),
            { numRuns: PROPERTY_TEST_ITERATIONS }
          )
        },
        PROPERTY_TEST_TIMEOUT
      )
    }
  )

  // ============================================================================
  // LocalRawCSVStorage Self-Consistency Tests
  // ============================================================================

  describe('LocalRawCSVStorage Contract Consistency', () => {
    /**
     * Helper to create isolated local CSV storage instances
     */
    async function createIsolatedLocalCSVStorages(): Promise<{
      storage1: IRawCSVStorage
      storage2: IRawCSVStorage
      cleanup: () => Promise<void>
    }> {
      const testId = `equiv-csv-local-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
      const testCacheDir1 = path.join(
        process.cwd(),
        'test-cache',
        `${testId}-1`,
        'raw-csv'
      )
      const testCacheDir2 = path.join(
        process.cwd(),
        'test-cache',
        `${testId}-2`,
        'raw-csv'
      )

      await fs.mkdir(testCacheDir1, { recursive: true })
      await fs.mkdir(testCacheDir2, { recursive: true })

      const logger = createMockLogger()
      const cacheConfig1 = createTestCacheConfigService(testCacheDir1)
      const cacheConfig2 = createTestCacheConfigService(testCacheDir2)

      const storage1 = new LocalRawCSVStorage(cacheConfig1, logger)
      const storage2 = new LocalRawCSVStorage(cacheConfig2, logger)

      const cleanup = async (): Promise<void> => {
        try {
          const parentDir1 = path.join(
            process.cwd(),
            'test-cache',
            `${testId}-1`
          )
          const parentDir2 = path.join(
            process.cwd(),
            'test-cache',
            `${testId}-2`
          )
          await fs.rm(parentDir1, { recursive: true, force: true })
          await fs.rm(parentDir2, { recursive: true, force: true })
        } catch {
          // Ignore cleanup errors
        }
      }

      return { storage1, storage2, cleanup }
    }

    /**
     * Property 4c: Two LocalRawCSVStorage instances produce identical results
     *
     * Given the same sequence of operations, two independent LocalRawCSVStorage
     * instances should produce equivalent observable results.
     *
     * **Validates: Requirements 4.4, 1.2**
     */
    it(
      'Property 4c: Two LocalRawCSVStorage instances produce identical results for same operations',
      async () => {
        await fc.assert(
          fc.asyncProperty(generateUniqueDates(3), async dates => {
            const { storage1, storage2, cleanup } =
              await createIsolatedLocalCSVStorages()

            try {
              // Generate operation sequence
              const opsArb = generateCSVOperationSequence(dates)
              const operations = fc.sample(opsArb, 1)[0]!

              // Execute operations on both storages
              for (const op of operations) {
                switch (op.type) {
                  case 'write':
                    if (op.date && op.csvType && op.content) {
                      await storage1.setCachedCSV(
                        op.date,
                        op.csvType,
                        op.content,
                        op.districtId
                      )
                      await storage2.setCachedCSV(
                        op.date,
                        op.csvType,
                        op.content,
                        op.districtId
                      )
                    }
                    break
                  case 'read':
                    if (op.date && op.csvType) {
                      const result1 = await storage1.getCachedCSV(
                        op.date,
                        op.csvType,
                        op.districtId
                      )
                      const result2 = await storage2.getCachedCSV(
                        op.date,
                        op.csvType,
                        op.districtId
                      )
                      expect(compareCSVContent(result1, result2)).toBe(true)
                    }
                    break
                  case 'has':
                    if (op.date && op.csvType) {
                      const has1 = await storage1.hasCachedCSV(
                        op.date,
                        op.csvType,
                        op.districtId
                      )
                      const has2 = await storage2.hasCachedCSV(
                        op.date,
                        op.csvType,
                        op.districtId
                      )
                      expect(has1).toBe(has2)
                    }
                    break
                  case 'list': {
                    const dates1 = await storage1.getCachedDates()
                    const dates2 = await storage2.getCachedDates()
                    expect(compareDateLists(dates1, dates2)).toBe(true)
                    break
                  }
                }
              }

              return true
            } finally {
              await cleanup()
            }
          }),
          { numRuns: PROPERTY_TEST_ITERATIONS }
        )
      },
      PROPERTY_TEST_TIMEOUT
    )
  })

  // ============================================================================
  // LocalRawCSVStorage vs GCSRawCSVStorage Equivalence
  // ============================================================================

  describe.skipIf(!isGCSEmulatorAvailable())(
    'LocalRawCSVStorage vs GCSRawCSVStorage Equivalence',
    () => {
      /**
       * Helper to create isolated CSV storage instances for both providers
       */
      async function createIsolatedCSVStorages(): Promise<{
        localStorage: IRawCSVStorage
        gcsStorage: IRawCSVStorage
        cleanup: () => Promise<void>
      }> {
        const testId = `equiv-csv-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
        const testCacheDir = path.join(
          process.cwd(),
          'test-cache',
          testId,
          'raw-csv'
        )
        await fs.mkdir(testCacheDir, { recursive: true })

        const logger = createMockLogger()
        const cacheConfig = createTestCacheConfigService(testCacheDir)

        const localStorage = new LocalRawCSVStorage(cacheConfig, logger)
        const gcsStorage = new GCSRawCSVStorage({
          projectId: 'test-project',
          bucketName: `test-bucket-equiv-${testId}`,
        })

        const cleanup = async (): Promise<void> => {
          try {
            const parentDir = path.join(process.cwd(), 'test-cache', testId)
            await fs.rm(parentDir, { recursive: true, force: true })
          } catch {
            // Ignore cleanup errors
          }
        }

        return { localStorage, gcsStorage, cleanup }
      }

      /**
       * Property 4d: LocalRawCSVStorage and GCSRawCSVStorage produce identical results
       *
       * For any sequence of valid CSV storage operations, both LocalRawCSVStorage and
       * GCSRawCSVStorage SHALL produce equivalent observable results.
       *
       * **Validates: Requirements 4.4, 1.2**
       */
      it(
        'Property 4d: LocalRawCSVStorage and GCSRawCSVStorage produce identical results',
        async () => {
          await fc.assert(
            fc.asyncProperty(generateUniqueDates(3), async dates => {
              const { localStorage, gcsStorage, cleanup } =
                await createIsolatedCSVStorages()

              try {
                // Generate operation sequence
                const opsArb = generateCSVOperationSequence(dates)
                const operations = fc.sample(opsArb, 1)[0]!

                // Execute operations on both storages
                for (const op of operations) {
                  switch (op.type) {
                    case 'write':
                      if (op.date && op.csvType && op.content) {
                        await localStorage.setCachedCSV(
                          op.date,
                          op.csvType,
                          op.content,
                          op.districtId
                        )
                        await gcsStorage.setCachedCSV(
                          op.date,
                          op.csvType,
                          op.content,
                          op.districtId
                        )
                      }
                      break
                    case 'read':
                      if (op.date && op.csvType) {
                        const localResult = await localStorage.getCachedCSV(
                          op.date,
                          op.csvType,
                          op.districtId
                        )
                        const gcsResult = await gcsStorage.getCachedCSV(
                          op.date,
                          op.csvType,
                          op.districtId
                        )
                        expect(compareCSVContent(localResult, gcsResult)).toBe(
                          true
                        )
                      }
                      break
                    case 'has':
                      if (op.date && op.csvType) {
                        const localHas = await localStorage.hasCachedCSV(
                          op.date,
                          op.csvType,
                          op.districtId
                        )
                        const gcsHas = await gcsStorage.hasCachedCSV(
                          op.date,
                          op.csvType,
                          op.districtId
                        )
                        expect(localHas).toBe(gcsHas)
                      }
                      break
                    case 'list': {
                      const localDates = await localStorage.getCachedDates()
                      const gcsDates = await gcsStorage.getCachedDates()
                      expect(compareDateLists(localDates, gcsDates)).toBe(true)
                      break
                    }
                  }
                }

                return true
              } finally {
                await cleanup()
              }
            }),
            { numRuns: PROPERTY_TEST_ITERATIONS }
          )
        },
        PROPERTY_TEST_TIMEOUT
      )
    }
  )
})
