/**
 * Property-Based Tests for Snapshot Round-Trip Consistency
 *
 * Feature: gcp-storage-migration
 * Property 1: Snapshot Round-Trip Consistency
 *
 * **Validates: Requirements 2.1, 2.2**
 *
 * For any valid Snapshot object, writing it to storage and then reading it back
 * (via `getSnapshot`) SHALL produce an equivalent Snapshot object with identical
 * metadata, status, and district data.
 *
 * This test runs against both LocalSnapshotStorage and FirestoreSnapshotStorage
 * (with emulator) to verify consistent behavior across implementations.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import fs from 'fs/promises'
import path from 'path'
import { LocalSnapshotStorage } from '../LocalSnapshotStorage.js'
import { FirestoreSnapshotStorage } from '../FirestoreSnapshotStorage.js'
import type { ISnapshotStorage } from '../../../types/storageInterfaces.js'
import type {
  Snapshot,
  SnapshotStatus,
  AllDistrictsRankingsData,
  DistrictRanking,
} from '../../../types/snapshots.js'
import type { DistrictStatistics } from '../../../types/districts.js'

// ============================================================================
// Test Configuration
// ============================================================================

const PROPERTY_TEST_ITERATIONS = 100
const PROPERTY_TEST_TIMEOUT = 120000 // 2 minutes for property tests

/**
 * Check if Firestore emulator is available
 */
function isFirestoreEmulatorAvailable(): boolean {
  return !!process.env['FIRESTORE_EMULATOR_HOST']
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
      fc.integer({ min: 1, max: 28 }) // Use 28 to avoid invalid dates
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
 * Generator for error messages
 */
const generateErrorMessages = (
  status: SnapshotStatus
): fc.Arbitrary<string[]> => {
  if (status === 'success') {
    return fc.constant([])
  }
  return fc.array(
    fc
      .string({ minLength: 5, maxLength: 100 })
      .map(s => s.replace(/[^\x20-\x7E]/g, 'X')),
    { minLength: 0, maxLength: 3 }
  )
}

/**
 * Generator for club performance records
 */
const generateClubPerformanceRecord = (): fc.Arbitrary<
  Record<string, string | number | null>
> =>
  fc.record({
    'Club Number': fc.integer({ min: 1000, max: 99999 }).map(String),
    'Club Name': fc
      .string({ minLength: 3, maxLength: 50 })
      .map(s => s.replace(/[^\x20-\x7E]/g, 'X')),
    Division: fc.constantFrom('A', 'B', 'C', 'D', 'E', 'F'),
    Area: fc.integer({ min: 1, max: 9 }).map(String),
    'Active Members': fc.integer({ min: 0, max: 100 }).map(String),
    'Goals Met': fc.integer({ min: 0, max: 10 }).map(String),
    'Mem. Base': fc.integer({ min: 0, max: 100 }).map(String),
    Status: fc.constantFrom('Active', 'Suspended', 'Ineligible', 'Low'),
  })

/**
 * Generator for membership stats
 */
const generateMembershipStats = (): fc.Arbitrary<
  DistrictStatistics['membership']
> =>
  fc.record({
    total: fc.integer({ min: 0, max: 10000 }),
    change: fc.integer({ min: -500, max: 500 }),
    changePercent: fc.double({ min: -100, max: 100, noNaN: true }),
    byClub: fc.array(
      fc.record({
        clubId: fc.integer({ min: 1000, max: 99999 }).map(String),
        clubName: fc
          .string({ minLength: 3, maxLength: 30 })
          .map(s => s.replace(/[^\x20-\x7E]/g, 'X')),
        memberCount: fc.integer({ min: 0, max: 200 }),
      }),
      { minLength: 0, maxLength: 5 }
    ),
    new: fc.option(fc.integer({ min: 0, max: 500 }), { nil: undefined }),
    renewed: fc.option(fc.integer({ min: 0, max: 500 }), { nil: undefined }),
    dual: fc.option(fc.integer({ min: 0, max: 100 }), { nil: undefined }),
  })

/**
 * Generator for club stats
 *
 * Ensures total equals the sum of active + suspended + ineligible + low
 * to maintain data consistency through round-trip operations.
 */
const generateClubStats = (): fc.Arbitrary<DistrictStatistics['clubs']> =>
  fc
    .record({
      active: fc.integer({ min: 0, max: 500 }),
      suspended: fc.integer({ min: 0, max: 50 }),
      ineligible: fc.integer({ min: 0, max: 50 }),
      low: fc.integer({ min: 0, max: 100 }),
      distinguished: fc.integer({ min: 0, max: 200 }),
      chartered: fc.option(fc.integer({ min: 0, max: 50 }), { nil: undefined }),
    })
    .map(stats => ({
      ...stats,
      // total must equal sum of status counts for round-trip consistency
      total: stats.active + stats.suspended + stats.ineligible + stats.low,
    }))

/**
 * Generator for education stats
 */
const generateEducationStats = (): fc.Arbitrary<
  DistrictStatistics['education']
> =>
  fc.record({
    totalAwards: fc.integer({ min: 0, max: 5000 }),
    byType: fc.array(
      fc.record({
        type: fc.constantFrom(
          'CC',
          'AC',
          'CL',
          'ALB',
          'ALS',
          'DTM',
          'PM1',
          'PM2',
          'PM3'
        ),
        count: fc.integer({ min: 0, max: 500 }),
      }),
      { minLength: 0, maxLength: 5 }
    ),
    topClubs: fc.array(
      fc.record({
        clubId: fc.integer({ min: 1000, max: 99999 }).map(String),
        clubName: fc
          .string({ minLength: 3, maxLength: 30 })
          .map(s => s.replace(/[^\x20-\x7E]/g, 'X')),
        awards: fc.integer({ min: 0, max: 100 }),
      }),
      { minLength: 0, maxLength: 5 }
    ),
    byMonth: fc.option(
      fc.array(
        fc.record({
          month: fc.constantFrom(
            'Jul',
            'Aug',
            'Sep',
            'Oct',
            'Nov',
            'Dec',
            'Jan',
            'Feb',
            'Mar',
            'Apr',
            'May',
            'Jun'
          ),
          count: fc.integer({ min: 0, max: 500 }),
        }),
        { minLength: 0, maxLength: 12 }
      ),
      { nil: undefined }
    ),
  })

/**
 * Generator for district statistics
 */
const generateDistrictStatistics = (
  districtId: string,
  asOfDate: string
): fc.Arbitrary<DistrictStatistics> =>
  fc.record({
    districtId: fc.constant(districtId),
    asOfDate: fc.constant(asOfDate),
    membership: generateMembershipStats(),
    clubs: generateClubStats(),
    education: generateEducationStats(),
    goals: fc.option(
      fc.record({
        clubsGoal: fc.integer({ min: 0, max: 500 }),
        membershipGoal: fc.integer({ min: 0, max: 10000 }),
        distinguishedGoal: fc.integer({ min: 0, max: 200 }),
      }),
      { nil: undefined }
    ),
    performance: fc.option(
      fc.record({
        membershipNet: fc.integer({ min: -1000, max: 1000 }),
        clubsNet: fc.integer({ min: -100, max: 100 }),
        distinguishedPercent: fc.double({ min: 0, max: 100, noNaN: true }),
      }),
      { nil: undefined }
    ),
    clubPerformance: fc.option(
      fc.array(generateClubPerformanceRecord(), {
        minLength: 0,
        maxLength: 10,
      }),
      { nil: undefined }
    ),
    divisionPerformance: fc.option(fc.constant([]), { nil: undefined }),
    districtPerformance: fc.option(fc.constant([]), { nil: undefined }),
  })

/**
 * Generator for normalized data metadata
 */
const generateNormalizedDataMetadata = (
  dataAsOfDate: string,
  districtCount: number
): fc.Arbitrary<Snapshot['payload']['metadata']> =>
  fc.record({
    source: fc.constantFrom('scraper', 'manual', 'api', 'test'),
    fetchedAt: generateISOTimestamp(),
    dataAsOfDate: fc.constant(dataAsOfDate),
    districtCount: fc.constant(districtCount),
    processingDurationMs: fc.integer({ min: 100, max: 60000 }),
    backfillJobId: fc.option(
      fc.uuid().map(id => id.substring(0, 8)),
      { nil: undefined }
    ),
    configuredDistricts: fc.option(
      fc.array(generateDistrictId(), { minLength: 0, maxLength: 5 }),
      { nil: undefined }
    ),
    successfulDistricts: fc.option(
      fc.array(generateDistrictId(), { minLength: 0, maxLength: 5 }),
      { nil: undefined }
    ),
    failedDistricts: fc.option(
      fc.array(generateDistrictId(), { minLength: 0, maxLength: 2 }),
      { nil: undefined }
    ),
    isClosingPeriodData: fc.option(fc.boolean(), { nil: undefined }),
    collectionDate: fc.option(generateISODate(), { nil: undefined }),
    logicalDate: fc.option(generateISODate(), { nil: undefined }),
  })

/**
 * Generator for unique district IDs (ensures no duplicates in a snapshot)
 */
const generateUniqueDistrictIds = (count: number): fc.Arbitrary<string[]> => {
  // Generate a pool of unique district IDs
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

  if (count === 0) {
    return fc.constant([])
  }

  // Use shuffled subset to get unique IDs
  return fc.shuffledSubarray(allPossibleIds, {
    minLength: count,
    maxLength: count,
  })
}

/**
 * Generator for complete Snapshot objects
 */
const generateSnapshot = (): fc.Arbitrary<Snapshot> =>
  fc
    .tuple(
      generateISODate(),
      generateSnapshotStatus(),
      generateSchemaVersion(),
      generateSchemaVersion(),
      fc.integer({ min: 0, max: 5 }) // Number of districts
    )
    .chain(
      ([dataAsOfDate, status, schemaVersion, calcVersion, districtCount]) =>
        fc.tuple(
          fc.constant(dataAsOfDate),
          fc.constant(status),
          fc.constant(schemaVersion),
          fc.constant(calcVersion),
          generateErrorMessages(status),
          // Generate unique district IDs first, then create district statistics for each
          generateUniqueDistrictIds(districtCount).chain(districtIds =>
            fc.tuple(
              ...districtIds.map(districtId =>
                generateDistrictStatistics(districtId, dataAsOfDate)
              )
            )
          ),
          generateNormalizedDataMetadata(dataAsOfDate, districtCount),
          generateISOTimestamp()
        )
    )
    .map(
      ([
        dataAsOfDate,
        status,
        schemaVersion,
        calcVersion,
        errors,
        districts,
        metadata,
        createdAt,
      ]) => ({
        snapshot_id: dataAsOfDate,
        created_at: createdAt,
        schema_version: schemaVersion,
        calculation_version: calcVersion,
        status,
        errors,
        payload: {
          districts: districts as DistrictStatistics[],
          metadata,
        },
      })
    )

/**
 * Generator for district ranking
 */
const generateDistrictRanking = (): fc.Arbitrary<DistrictRanking> =>
  fc.record({
    districtId: generateDistrictId(),
    districtName: fc
      .string({ minLength: 5, maxLength: 30 })
      .map(s => `District ${s.replace(/[^\x20-\x7E]/g, 'X')}`),
    region: fc.constantFrom('Region 1', 'Region 2', 'Region 3', 'Region 4'),
    paidClubs: fc.integer({ min: 0, max: 500 }),
    paidClubBase: fc.integer({ min: 0, max: 500 }),
    clubGrowthPercent: fc.double({ min: -50, max: 50, noNaN: true }),
    totalPayments: fc.integer({ min: 0, max: 50000 }),
    paymentBase: fc.integer({ min: 0, max: 50000 }),
    paymentGrowthPercent: fc.double({ min: -50, max: 50, noNaN: true }),
    activeClubs: fc.integer({ min: 0, max: 500 }),
    distinguishedClubs: fc.integer({ min: 0, max: 200 }),
    selectDistinguished: fc.integer({ min: 0, max: 100 }),
    presidentsDistinguished: fc.integer({ min: 0, max: 50 }),
    distinguishedPercent: fc.double({ min: 0, max: 100, noNaN: true }),
    clubsRank: fc.integer({ min: 1, max: 150 }),
    paymentsRank: fc.integer({ min: 1, max: 150 }),
    distinguishedRank: fc.integer({ min: 1, max: 150 }),
    aggregateScore: fc.integer({ min: 0, max: 450 }),
  })

/**
 * Generator for AllDistrictsRankingsData
 */
const generateAllDistrictsRankings = (
  snapshotId: string
): fc.Arbitrary<AllDistrictsRankingsData> =>
  fc
    .array(generateDistrictRanking(), { minLength: 1, maxLength: 10 })
    .map(rankings => ({
      metadata: {
        snapshotId,
        calculatedAt: new Date().toISOString(),
        schemaVersion: '1.0.0',
        calculationVersion: '1.0.0',
        rankingVersion: '1.0.0',
        sourceCsvDate: snapshotId,
        csvFetchedAt: new Date().toISOString(),
        totalDistricts: rankings.length,
        fromCache: false,
      },
      rankings,
    }))

// ============================================================================
// Comparison Utilities
// ============================================================================

/**
 * Deep comparison of two Snapshot objects for equivalence
 *
 * This function compares the essential fields that should be preserved
 * through a round-trip write/read operation.
 */
function assertSnapshotsEquivalent(
  original: Snapshot,
  retrieved: Snapshot
): void {
  // Compare top-level fields
  expect(retrieved.snapshot_id).toBe(original.snapshot_id)
  expect(retrieved.schema_version).toBe(original.schema_version)
  expect(retrieved.calculation_version).toBe(original.calculation_version)
  expect(retrieved.status).toBe(original.status)
  expect(retrieved.errors).toEqual(original.errors)

  // Compare payload metadata
  const origMeta = original.payload.metadata
  const retMeta = retrieved.payload.metadata

  expect(retMeta.source).toBe(origMeta.source)
  expect(retMeta.dataAsOfDate).toBe(origMeta.dataAsOfDate)
  expect(retMeta.districtCount).toBe(origMeta.districtCount)

  // Compare optional metadata fields if present
  if (origMeta.isClosingPeriodData !== undefined) {
    expect(retMeta.isClosingPeriodData).toBe(origMeta.isClosingPeriodData)
  }
  if (origMeta.collectionDate !== undefined) {
    expect(retMeta.collectionDate).toBe(origMeta.collectionDate)
  }
  if (origMeta.logicalDate !== undefined) {
    expect(retMeta.logicalDate).toBe(origMeta.logicalDate)
  }

  // Compare districts
  expect(retrieved.payload.districts.length).toBe(
    original.payload.districts.length
  )

  // Sort districts by ID for consistent comparison
  const sortedOriginal = [...original.payload.districts].sort((a, b) =>
    a.districtId.localeCompare(b.districtId)
  )
  const sortedRetrieved = [...retrieved.payload.districts].sort((a, b) =>
    a.districtId.localeCompare(b.districtId)
  )

  for (let i = 0; i < sortedOriginal.length; i++) {
    const origDistrict = sortedOriginal[i]!
    const retDistrict = sortedRetrieved[i]!

    expect(retDistrict.districtId).toBe(origDistrict.districtId)
    expect(retDistrict.asOfDate).toBe(origDistrict.asOfDate)

    // Compare membership stats
    expect(retDistrict.membership.total).toBe(origDistrict.membership.total)
    expect(retDistrict.membership.change).toBe(origDistrict.membership.change)

    // Compare club stats
    expect(retDistrict.clubs.total).toBe(origDistrict.clubs.total)
    expect(retDistrict.clubs.active).toBe(origDistrict.clubs.active)
    expect(retDistrict.clubs.suspended).toBe(origDistrict.clubs.suspended)
    expect(retDistrict.clubs.distinguished).toBe(
      origDistrict.clubs.distinguished
    )

    // Compare education stats
    expect(retDistrict.education.totalAwards).toBe(
      origDistrict.education.totalAwards
    )
  }
}

// ============================================================================
// Test Suites
// ============================================================================

describe('Snapshot Round-Trip Property Tests', () => {
  // ============================================================================
  // LocalSnapshotStorage Tests
  // ============================================================================

  describe('LocalSnapshotStorage', () => {
    let storage: ISnapshotStorage
    let testCacheDir: string
    let testId: string

    beforeEach(async () => {
      // Create unique test directory for isolation
      testId = `snapshot-roundtrip-pbt-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
      testCacheDir = path.join(process.cwd(), 'test-cache', testId)
      await fs.mkdir(testCacheDir, { recursive: true })

      // Create storage instance
      storage = new LocalSnapshotStorage({ cacheDir: testCacheDir })
    })

    afterEach(async () => {
      // Clean up test directory
      try {
        await fs.rm(testCacheDir, { recursive: true, force: true })
      } catch {
        // Ignore cleanup errors
      }
    })

    /**
     * Property 1: Snapshot Round-Trip Consistency
     *
     * For any valid Snapshot object, writing it to storage and then reading
     * it back (via `getSnapshot`) SHALL produce an equivalent Snapshot object
     * with identical metadata, status, and district data.
     *
     * **Validates: Requirements 2.1, 2.2**
     */
    it(
      'Property 1: Snapshot round-trip produces equivalent data',
      async () => {
        await fc.assert(
          fc.asyncProperty(generateSnapshot(), async (snapshot: Snapshot) => {
            // Write the snapshot
            await storage.writeSnapshot(snapshot)

            // Read it back
            const retrieved = await storage.getSnapshot(snapshot.snapshot_id)

            // Verify it was retrieved
            expect(retrieved).not.toBeNull()

            // Verify equivalence
            assertSnapshotsEquivalent(snapshot, retrieved!)

            return true
          }),
          { numRuns: PROPERTY_TEST_ITERATIONS }
        )
      },
      PROPERTY_TEST_TIMEOUT
    )

    /**
     * Property 1a: Snapshot with rankings round-trip
     *
     * Snapshots written with rankings data should preserve both the snapshot
     * and rankings through a round-trip.
     *
     * **Validates: Requirements 2.1, 2.2, 2.5**
     */
    it(
      'Property 1a: Snapshot with rankings round-trip produces equivalent data',
      async () => {
        await fc.assert(
          fc.asyncProperty(generateSnapshot(), async (snapshot: Snapshot) => {
            // Generate rankings for this snapshot
            const rankings = fc.sample(
              generateAllDistrictsRankings(snapshot.snapshot_id),
              1
            )[0]!

            // Write the snapshot with rankings
            await storage.writeSnapshot(snapshot, rankings)

            // Read snapshot back
            const retrieved = await storage.getSnapshot(snapshot.snapshot_id)
            expect(retrieved).not.toBeNull()
            assertSnapshotsEquivalent(snapshot, retrieved!)

            // Read rankings back
            const retrievedRankings = await storage.readAllDistrictsRankings(
              snapshot.snapshot_id
            )
            expect(retrievedRankings).not.toBeNull()
            expect(retrievedRankings!.rankings.length).toBe(
              rankings.rankings.length
            )

            return true
          }),
          { numRuns: Math.floor(PROPERTY_TEST_ITERATIONS / 2) } // Fewer runs since this is more expensive
        )
      },
      PROPERTY_TEST_TIMEOUT
    )

    /**
     * Property 1b: Multiple snapshots maintain isolation
     *
     * Writing multiple snapshots should not cause data corruption or mixing.
     *
     * **Validates: Requirements 2.1, 2.2**
     */
    it(
      'Property 1b: Multiple snapshots maintain isolation',
      async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.array(generateSnapshot(), { minLength: 2, maxLength: 5 }),
            async (snapshots: Snapshot[]) => {
              // Ensure unique snapshot IDs by modifying dates
              const uniqueSnapshots = snapshots.map((s, i) => ({
                ...s,
                snapshot_id: `2024-01-${String(i + 1).padStart(2, '0')}`,
                payload: {
                  ...s.payload,
                  metadata: {
                    ...s.payload.metadata,
                    dataAsOfDate: `2024-01-${String(i + 1).padStart(2, '0')}`,
                  },
                },
              }))

              // Write all snapshots
              for (const snapshot of uniqueSnapshots) {
                await storage.writeSnapshot(snapshot)
              }

              // Verify each snapshot can be retrieved correctly
              for (const original of uniqueSnapshots) {
                const retrieved = await storage.getSnapshot(
                  original.snapshot_id
                )
                expect(retrieved).not.toBeNull()
                assertSnapshotsEquivalent(original, retrieved!)
              }

              return true
            }
          ),
          { numRuns: Math.floor(PROPERTY_TEST_ITERATIONS / 4) } // Fewer runs for multi-snapshot tests
        )
      },
      PROPERTY_TEST_TIMEOUT
    )
  })

  // ============================================================================
  // FirestoreSnapshotStorage Tests (with emulator)
  // ============================================================================

  describe.skipIf(!isFirestoreEmulatorAvailable())(
    'FirestoreSnapshotStorage (emulator)',
    () => {
      let storage: ISnapshotStorage
      let testCollectionName: string

      beforeEach(() => {
        // Create unique collection name for isolation
        testCollectionName = `snapshots-pbt-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`

        // Create storage instance pointing to emulator
        storage = new FirestoreSnapshotStorage({
          projectId: 'test-project',
          collectionName: testCollectionName,
        })
      })

      afterEach(async () => {
        // Firestore emulator data is ephemeral, but we could clear the collection
        // if needed for test isolation
      })

      /**
       * Property 1: Snapshot Round-Trip Consistency (Firestore)
       *
       * For any valid Snapshot object, writing it to Firestore and then reading
       * it back (via `getSnapshot`) SHALL produce an equivalent Snapshot object.
       *
       * **Validates: Requirements 2.1, 2.2**
       */
      it(
        'Property 1: Snapshot round-trip produces equivalent data (Firestore)',
        async () => {
          await fc.assert(
            fc.asyncProperty(generateSnapshot(), async (snapshot: Snapshot) => {
              // Write the snapshot
              await storage.writeSnapshot(snapshot)

              // Read it back
              const retrieved = await storage.getSnapshot(snapshot.snapshot_id)

              // Verify it was retrieved
              expect(retrieved).not.toBeNull()

              // Verify equivalence
              assertSnapshotsEquivalent(snapshot, retrieved!)

              return true
            }),
            { numRuns: PROPERTY_TEST_ITERATIONS }
          )
        },
        PROPERTY_TEST_TIMEOUT
      )

      /**
       * Property 1a: Snapshot with rankings round-trip (Firestore)
       *
       * **Validates: Requirements 2.1, 2.2, 2.5**
       */
      it(
        'Property 1a: Snapshot with rankings round-trip produces equivalent data (Firestore)',
        async () => {
          await fc.assert(
            fc.asyncProperty(generateSnapshot(), async (snapshot: Snapshot) => {
              // Generate rankings for this snapshot
              const rankings = fc.sample(
                generateAllDistrictsRankings(snapshot.snapshot_id),
                1
              )[0]!

              // Write the snapshot with rankings
              await storage.writeSnapshot(snapshot, rankings)

              // Read snapshot back
              const retrieved = await storage.getSnapshot(snapshot.snapshot_id)
              expect(retrieved).not.toBeNull()
              assertSnapshotsEquivalent(snapshot, retrieved!)

              // Read rankings back
              const retrievedRankings = await storage.readAllDistrictsRankings(
                snapshot.snapshot_id
              )
              expect(retrievedRankings).not.toBeNull()
              expect(retrievedRankings!.rankings.length).toBe(
                rankings.rankings.length
              )

              return true
            }),
            { numRuns: Math.floor(PROPERTY_TEST_ITERATIONS / 2) }
          )
        },
        PROPERTY_TEST_TIMEOUT
      )
    }
  )
})
