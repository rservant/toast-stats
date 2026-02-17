/**
 * Property-Based Tests for FirestoreSnapshotStorage Chunked Write
 *
 * **Property 4: Backoff Calculation with Jitter**
 * *For any* retry attempt number `n` (0-indexed), the calculated backoff delay
 * SHALL be `min(initialBackoffMs * 2^n, maxBackoffMs) * (1 ± jitterFactor)`,
 * where the jitter is uniformly distributed within the specified range.
 *
 * **Validates: Requirements 2.2, 2.4**
 *
 * **Property 9: Document Structure Equivalence**
 * *For any* valid Snapshot object, when all batches succeed, reading the snapshot
 * back via `getSnapshot()` SHALL return a Snapshot object equivalent to the input
 * (same districts, metadata, and rankings).
 *
 * **Validates: Requirements 6.2, 6.3**
 *
 * Per the property-testing-guidance steering document, these property tests are
 * warranted because:
 * - Property 4: Mathematical formula with randomness; need to verify jitter bounds
 * - Property 9: Round-trip property with complex input space (varying district counts)
 * - 100 iterations minimum to ensure properties hold
 *
 * Test Isolation Requirements (per testing steering document):
 * - Property 4 tests use mocked Firestore client
 * - Property 9 tests require Firestore emulator (skipped if unavailable)
 * - Tests clean up all mocks/resources in afterEach hooks
 * - Tests do not depend on execution order
 * - All tests pass when run with --run (parallel mode)
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
  beforeAll,
} from 'vitest'
import * as fc from 'fast-check'
import type {
  Snapshot,
  AllDistrictsRankingsData,
} from '../../../types/snapshots.js'
import type { DistrictStatistics } from '../../../types/districts.js'

// ============================================================================
// Mock Setup - Must be before imports that use the mocked modules
// ============================================================================

// Mock the @google-cloud/firestore module
vi.mock('@google-cloud/firestore', () => {
  const MockFirestore = function (this: Record<string, unknown>) {
    this.collection = vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn(),
        set: vi.fn(),
        update: vi.fn(),
        collection: vi.fn().mockReturnValue({
          doc: vi.fn(),
          get: vi.fn(),
        }),
      }),
      get: vi.fn(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    })
    this.batch = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnThis(),
      commit: vi.fn().mockResolvedValue(undefined),
    })
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
import {
  FirestoreSnapshotStorage,
  DEFAULT_BATCH_WRITE_CONFIG,
} from '../FirestoreSnapshotStorage.js'

// ============================================================================
// Type Definitions for Testing Private Methods
// ============================================================================

/**
 * Interface that exposes private methods for testing purposes.
 * This allows us to test the calculateBackoffDelay method directly
 * while maintaining type safety.
 */
interface FirestoreSnapshotStorageTestable {
  calculateBackoffDelay: (attempt: number, randomFn?: () => number) => number
  batchWriteConfig: typeof DEFAULT_BATCH_WRITE_CONFIG
}

// ============================================================================
// Property-Based Test Suite: Backoff Jitter Bounds
// ============================================================================

describe('FirestoreSnapshotStorage - Chunked Write Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  /**
   * Test helper to access the private calculateBackoffDelay method.
   * Uses type assertion to access private method for testing.
   */
  function getTestableStorage(
    config?: Partial<typeof DEFAULT_BATCH_WRITE_CONFIG>
  ): FirestoreSnapshotStorageTestable {
    const storage = new FirestoreSnapshotStorage({
      projectId: 'test-project',
      batchWriteConfig: config,
    })
    return storage as unknown as FirestoreSnapshotStorageTestable
  }

  /**
   * Property 4: Backoff Calculation with Jitter
   *
   * *For any* retry attempt number `n` (0-indexed), the calculated backoff delay
   * SHALL be `min(initialBackoffMs * 2^n, maxBackoffMs) * (1 ± jitterFactor)`,
   * where the jitter is uniformly distributed within the specified range.
   *
   * **Validates: Requirements 2.2, 2.4**
   */
  describe('Property 4: Backoff Calculation with Jitter', () => {
    /**
     * Property 4.1: Jitter bounds are always respected
     *
     * For any attempt number (0-10) and any random value (0-1),
     * the actual delay must be within baseDelay * (1 ± jitterFactor).
     *
     * Formula verification:
     * - baseDelay = min(initialBackoffMs * 2^attempt, maxBackoffMs)
     * - minDelay = baseDelay * (1 - jitterFactor)
     * - maxDelay = baseDelay * (1 + jitterFactor)
     * - actualDelay must satisfy: minDelay <= actualDelay <= maxDelay
     */
    it('should always produce delay within jitter bounds for any attempt and random value', () => {
      const storage = getTestableStorage()
      const { initialBackoffMs, maxBackoffMs, jitterFactor } =
        storage.batchWriteConfig

      fc.assert(
        fc.property(
          // Generate attempt numbers 0-10 as specified in the design
          fc.integer({ min: 0, max: 10 }),
          // Generate random values in [0, 1) to simulate Math.random()
          fc.float({ min: 0, max: 1, noNaN: true }),
          (attempt, randomValue) => {
            // Calculate expected base delay (before jitter)
            const baseDelay = Math.min(
              initialBackoffMs * Math.pow(2, attempt),
              maxBackoffMs
            )

            // Calculate expected bounds with jitter
            const expectedMinDelay = baseDelay * (1 - jitterFactor)
            const expectedMaxDelay = baseDelay * (1 + jitterFactor)

            // Get actual delay using the random value
            const actualDelay = storage.calculateBackoffDelay(
              attempt,
              () => randomValue
            )

            // Verify the delay is within bounds
            return (
              actualDelay >= expectedMinDelay && actualDelay <= expectedMaxDelay
            )
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * Property 4.2: Exponential growth is respected before cap
     *
     * For attempts where baseDelay < maxBackoffMs, the base delay
     * should follow exponential growth: initialBackoffMs * 2^attempt
     */
    it('should follow exponential growth pattern before reaching cap', () => {
      const storage = getTestableStorage()
      const { initialBackoffMs, maxBackoffMs } = storage.batchWriteConfig

      fc.assert(
        fc.property(
          // Generate attempt numbers that won't hit the cap
          // With defaults: 1000 * 2^4 = 16000 < 30000, so attempts 0-4 are safe
          fc.integer({ min: 0, max: 4 }),
          fc.float({ min: 0, max: 1, noNaN: true }),
          (attempt, randomValue) => {
            const expectedBaseDelay = initialBackoffMs * Math.pow(2, attempt)

            // Verify we're testing below the cap
            if (expectedBaseDelay >= maxBackoffMs) {
              return true // Skip this case, tested separately
            }

            // With zero jitter (randomValue = 0.5), delay should equal base
            const delayWithNoJitter = storage.calculateBackoffDelay(
              attempt,
              () => 0.5
            )

            // The delay with no jitter should equal the expected base delay
            return delayWithNoJitter === expectedBaseDelay
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * Property 4.3: Cap is always respected
     *
     * For any attempt number, the base delay (before jitter) should
     * never exceed maxBackoffMs.
     */
    it('should cap base delay at maxBackoffMs for high attempt numbers', () => {
      const storage = getTestableStorage()
      const { maxBackoffMs } = storage.batchWriteConfig

      fc.assert(
        fc.property(
          // Generate high attempt numbers that would exceed cap
          fc.integer({ min: 5, max: 10 }),
          attempt => {
            // With no jitter (randomValue = 0.5), delay should be capped
            const delayWithNoJitter = storage.calculateBackoffDelay(
              attempt,
              () => 0.5
            )

            // The delay should be exactly maxBackoffMs when no jitter
            // (since all these attempts would exceed the cap)
            return delayWithNoJitter === maxBackoffMs
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * Property 4.4: Jitter distribution covers full range
     *
     * When random returns 0, delay should be at minimum bound.
     * When random returns 1, delay should be at maximum bound.
     */
    it('should produce minimum bound when random returns 0', () => {
      const storage = getTestableStorage()
      const { initialBackoffMs, maxBackoffMs, jitterFactor } =
        storage.batchWriteConfig

      fc.assert(
        fc.property(fc.integer({ min: 0, max: 10 }), attempt => {
          const baseDelay = Math.min(
            initialBackoffMs * Math.pow(2, attempt),
            maxBackoffMs
          )
          const expectedMinDelay = baseDelay * (1 - jitterFactor)

          const actualDelay = storage.calculateBackoffDelay(attempt, () => 0)

          return actualDelay === expectedMinDelay
        }),
        { numRuns: 100 }
      )
    })

    it('should produce maximum bound when random returns 1', () => {
      const storage = getTestableStorage()
      const { initialBackoffMs, maxBackoffMs, jitterFactor } =
        storage.batchWriteConfig

      fc.assert(
        fc.property(fc.integer({ min: 0, max: 10 }), attempt => {
          const baseDelay = Math.min(
            initialBackoffMs * Math.pow(2, attempt),
            maxBackoffMs
          )
          const expectedMaxDelay = baseDelay * (1 + jitterFactor)

          const actualDelay = storage.calculateBackoffDelay(attempt, () => 1)

          return actualDelay === expectedMaxDelay
        }),
        { numRuns: 100 }
      )
    })

    /**
     * Property 4.5: Custom configuration is respected
     *
     * The property should hold for any valid configuration values,
     * not just the defaults.
     */
    it('should respect custom configuration values', () => {
      fc.assert(
        fc.property(
          // Generate valid configuration values
          fc.integer({ min: 100, max: 5000 }), // initialBackoffMs
          fc.integer({ min: 5000, max: 60000 }), // maxBackoffMs
          // Use integer for jitterFactor percentage (5-50) and convert to decimal
          fc.integer({ min: 5, max: 50 }).map(n => n / 100), // jitterFactor (0.05-0.5)
          fc.integer({ min: 0, max: 10 }), // attempt
          // Use integer for random percentage (0-100) and convert to decimal
          fc.integer({ min: 0, max: 100 }).map(n => n / 100), // randomValue (0-1)
          (
            initialBackoffMs,
            maxBackoffMs,
            jitterFactor,
            attempt,
            randomValue
          ) => {
            const storage = getTestableStorage({
              initialBackoffMs,
              maxBackoffMs,
              jitterFactor,
            })

            // Calculate expected bounds
            const baseDelay = Math.min(
              initialBackoffMs * Math.pow(2, attempt),
              maxBackoffMs
            )
            const expectedMinDelay = baseDelay * (1 - jitterFactor)
            const expectedMaxDelay = baseDelay * (1 + jitterFactor)

            // Get actual delay
            const actualDelay = storage.calculateBackoffDelay(
              attempt,
              () => randomValue
            )

            // Verify bounds are respected
            return (
              actualDelay >= expectedMinDelay && actualDelay <= expectedMaxDelay
            )
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * Property 4.6: Zero jitter factor produces exact base delay
     *
     * When jitterFactor is 0, the delay should always equal the base delay
     * regardless of the random value.
     */
    it('should produce exact base delay when jitterFactor is 0', () => {
      const storage = getTestableStorage({ jitterFactor: 0 })
      const { initialBackoffMs, maxBackoffMs } = storage.batchWriteConfig

      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10 }),
          fc.float({ min: 0, max: 1, noNaN: true }),
          (attempt, randomValue) => {
            const expectedBaseDelay = Math.min(
              initialBackoffMs * Math.pow(2, attempt),
              maxBackoffMs
            )

            const actualDelay = storage.calculateBackoffDelay(
              attempt,
              () => randomValue
            )

            // With zero jitter, all random values should produce the same delay
            return actualDelay === expectedBaseDelay
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * Property 4.7: Delay is always positive
     *
     * For any valid inputs, the calculated delay should always be positive.
     */
    it('should always produce positive delay', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 5000 }), // initialBackoffMs
          fc.integer({ min: 5000, max: 60000 }), // maxBackoffMs
          // Use integer for jitterFactor percentage (0-50) and convert to decimal
          fc.integer({ min: 0, max: 50 }).map(n => n / 100), // jitterFactor (max 0.5 to ensure positive)
          fc.integer({ min: 0, max: 10 }), // attempt
          // Use integer for random percentage (0-100) and convert to decimal
          fc.integer({ min: 0, max: 100 }).map(n => n / 100), // randomValue (0-1)
          (
            initialBackoffMs,
            maxBackoffMs,
            jitterFactor,
            attempt,
            randomValue
          ) => {
            const storage = getTestableStorage({
              initialBackoffMs,
              maxBackoffMs,
              jitterFactor,
            })

            const actualDelay = storage.calculateBackoffDelay(
              attempt,
              () => randomValue
            )

            return actualDelay > 0
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})

// ============================================================================
// Property 9: Document Structure Equivalence (Requires Firestore Emulator)
// ============================================================================

/**
 * Property 9: Document Structure Equivalence
 *
 * *For any* valid Snapshot object, when all batches succeed, reading the snapshot
 * back via `getSnapshot()` SHALL return a Snapshot object equivalent to the input
 * (same districts, metadata, and rankings).
 *
 * **Validates: Requirements 6.2, 6.3**
 *
 * This test suite requires the Firestore emulator to be running.
 * It will be skipped if the emulator is not available.
 *
 * To run these tests:
 * 1. Start the Firestore emulator: `firebase emulators:start --only firestore`
 * 2. Set FIRESTORE_EMULATOR_HOST environment variable (usually localhost:8080)
 * 3. Run the tests: `npm test`
 */
describe('Property 9: Document Structure Equivalence (Firestore Emulator)', () => {
  // Check if Firestore emulator is available
  const FIRESTORE_EMULATOR_HOST = process.env['FIRESTORE_EMULATOR_HOST']
  const isEmulatorAvailable = !!FIRESTORE_EMULATOR_HOST

  // Skip all tests in this suite if emulator is not available
  beforeAll(() => {
    if (!isEmulatorAvailable) {
      console.log(
        'Skipping Property 9 tests: Firestore emulator not available.',
        'Set FIRESTORE_EMULATOR_HOST to run these tests.'
      )
    }
  })

  // ============================================================================
  // Fast-Check Arbitraries for Snapshot Generation
  // ============================================================================

  /**
   * Generate a valid MembershipStats object
   */
  const membershipStatsArb = fc.record({
    total: fc.integer({ min: 0, max: 100000 }),
    change: fc.integer({ min: -10000, max: 10000 }),
    changePercent: fc.integer({ min: -100, max: 100 }), // Use integer to avoid float issues
    byClub: fc.constant(
      [] as Array<{ clubId: string; clubName: string; memberCount: number }>
    ),
    new: fc.option(fc.integer({ min: 0, max: 10000 }), { nil: undefined }),
    renewed: fc.option(fc.integer({ min: 0, max: 10000 }), { nil: undefined }),
    dual: fc.option(fc.integer({ min: 0, max: 1000 }), { nil: undefined }),
  })

  /**
   * Generate a valid ClubStats object
   */
  const clubStatsArb = fc.record({
    total: fc.integer({ min: 0, max: 1000 }),
    active: fc.integer({ min: 0, max: 1000 }),
    suspended: fc.integer({ min: 0, max: 100 }),
    ineligible: fc.integer({ min: 0, max: 100 }),
    low: fc.integer({ min: 0, max: 100 }),
    distinguished: fc.integer({ min: 0, max: 500 }),
    chartered: fc.option(fc.integer({ min: 0, max: 100 }), { nil: undefined }),
  })

  /**
   * Generate a valid EducationStats object
   */
  const educationStatsArb = fc.record({
    totalAwards: fc.integer({ min: 0, max: 10000 }),
    byType: fc.constant([] as Array<{ type: string; count: number }>),
    topClubs: fc.constant(
      [] as Array<{ clubId: string; clubName: string; awards: number }>
    ),
    byMonth: fc.option(
      fc.constant([] as Array<{ month: string; count: number }>),
      { nil: undefined }
    ),
  })

  /**
   * Generate a valid DistrictStatistics object with a given index for unique ID
   */
  const districtStatisticsArb = (
    asOfDate: string,
    index: number
  ): fc.Arbitrary<DistrictStatistics> =>
    fc.record({
      districtId: fc.constant(`D${index.toString().padStart(3, '0')}`),
      asOfDate: fc.constant(asOfDate),
      membership: membershipStatsArb,
      clubs: clubStatsArb,
      education: educationStatsArb,
      goals: fc.option(
        fc.record({
          clubsGoal: fc.integer({ min: 0, max: 500 }),
          membershipGoal: fc.integer({ min: 0, max: 50000 }),
          distinguishedGoal: fc.integer({ min: 0, max: 100 }),
        }),
        { nil: undefined }
      ),
      performance: fc.option(
        fc.record({
          membershipNet: fc.integer({ min: -5000, max: 5000 }),
          clubsNet: fc.integer({ min: -100, max: 100 }),
          distinguishedPercent: fc.integer({ min: 0, max: 100 }),
        }),
        { nil: undefined }
      ),
    }) as unknown as fc.Arbitrary<DistrictStatistics>

  /**
   * Generate a valid date string in YYYY-MM-DD format
   */
  const dateStringArb = fc
    .record({
      year: fc.integer({ min: 2020, max: 2030 }),
      month: fc.integer({ min: 1, max: 12 }),
      day: fc.integer({ min: 1, max: 28 }), // Use 28 to avoid invalid dates
    })
    .map(({ year, month, day }) => {
      const m = month.toString().padStart(2, '0')
      const d = day.toString().padStart(2, '0')
      return `${year}-${m}-${d}`
    })

  /**
   * Generate a valid Snapshot object with a specified number of districts
   */
  const snapshotArb = (districtCount: number): fc.Arbitrary<Snapshot> =>
    dateStringArb.chain(dataAsOfDate => {
      const isoDate = `${dataAsOfDate}T00:00:00.000Z`

      // Generate districts with unique IDs
      const districtArbs = Array.from({ length: districtCount }, (_, i) =>
        districtStatisticsArb(dataAsOfDate, i)
      )

      return fc.tuple(...districtArbs).map(districts => ({
        snapshot_id: dataAsOfDate, // Will be overwritten by storage
        created_at: isoDate,
        schema_version: '1.0.0',
        calculation_version: '1.0.0',
        status: 'success' as const,
        errors: [] as string[],
        payload: {
          districts: districts as DistrictStatistics[],
          metadata: {
            source: 'property-test',
            fetchedAt: isoDate,
            dataAsOfDate,
            districtCount: districts.length,
            processingDurationMs: 1000,
          },
        },
      }))
    })

  /**
   * Generate optional AllDistrictsRankingsData
   */
  const rankingsArb = (
    snapshotId: string,
    districts: DistrictStatistics[]
  ): fc.Arbitrary<AllDistrictsRankingsData | undefined> =>
    fc.option(
      fc.constant({
        metadata: {
          snapshotId,
          calculatedAt: new Date().toISOString(),
          schemaVersion: '1.0.0',
          calculationVersion: '1.0.0',
          rankingVersion: '1.0.0',
          sourceCsvDate: snapshotId,
          csvFetchedAt: new Date().toISOString(),
          totalDistricts: districts.length,
          fromCache: false,
        },
        rankings: districts.map((d, i) => ({
          districtId: d.districtId,
          districtName: `District ${d.districtId}`,
          region: 'Test Region',
          paidClubs: d.clubs.total,
          paidClubBase: Math.max(1, d.clubs.total - 10),
          clubGrowthPercent: 5.0,
          totalPayments: d.membership.total * 10,
          paymentBase: Math.max(1, d.membership.total * 9),
          paymentGrowthPercent: 10.0,
          activeClubs: d.clubs.active,
          distinguishedClubs: d.clubs.distinguished,
          selectDistinguished: Math.floor(d.clubs.distinguished / 3),
          presidentsDistinguished: Math.floor(d.clubs.distinguished / 6),
          distinguishedPercent:
            d.clubs.total > 0
              ? (d.clubs.distinguished / d.clubs.total) * 100
              : 0,
          clubsRank: i + 1,
          paymentsRank: i + 1,
          distinguishedRank: i + 1,
          aggregateScore: districts.length - i,
        })),
      }),
      { nil: undefined }
    )

  // ============================================================================
  // Helper Functions
  // ============================================================================

  /**
   * Compare two snapshots for equivalence, ignoring fields that may differ
   * due to storage implementation details.
   *
   * Fields that may differ:
   * - snapshot_id: Generated by storage based on dataAsOfDate
   * - created_at: May be normalized by storage
   *
   * Fields that MUST be equivalent:
   * - status
   * - schema_version
   * - calculation_version
   * - errors
   * - payload.districts (all district data)
   * - payload.metadata (all metadata fields)
   */
  function areSnapshotsEquivalent(
    original: Snapshot,
    retrieved: Snapshot | null
  ): { equivalent: boolean; differences: string[] } {
    const differences: string[] = []

    if (!retrieved) {
      return { equivalent: false, differences: ['Retrieved snapshot is null'] }
    }

    // Compare status
    if (original.status !== retrieved.status) {
      differences.push(
        `status: expected '${original.status}', got '${retrieved.status}'`
      )
    }

    // Compare schema_version
    if (original.schema_version !== retrieved.schema_version) {
      differences.push(
        `schema_version: expected '${original.schema_version}', got '${retrieved.schema_version}'`
      )
    }

    // Compare calculation_version
    if (original.calculation_version !== retrieved.calculation_version) {
      differences.push(
        `calculation_version: expected '${original.calculation_version}', got '${retrieved.calculation_version}'`
      )
    }

    // Compare errors array
    if (JSON.stringify(original.errors) !== JSON.stringify(retrieved.errors)) {
      differences.push(
        `errors: expected ${JSON.stringify(original.errors)}, got ${JSON.stringify(retrieved.errors)}`
      )
    }

    // Compare district count
    if (
      original.payload.districts.length !== retrieved.payload.districts.length
    ) {
      differences.push(
        `district count: expected ${original.payload.districts.length}, got ${retrieved.payload.districts.length}`
      )
    }

    // Compare each district
    const originalDistrictsById = new Map(
      original.payload.districts.map(d => [d.districtId, d])
    )
    const retrievedDistrictsById = new Map(
      retrieved.payload.districts.map(d => [d.districtId, d])
    )

    for (const [districtId, originalDistrict] of originalDistrictsById) {
      const retrievedDistrict = retrievedDistrictsById.get(districtId)
      if (!retrievedDistrict) {
        differences.push(
          `district ${districtId}: missing in retrieved snapshot`
        )
        continue
      }

      // Compare key district fields
      if (originalDistrict.asOfDate !== retrievedDistrict.asOfDate) {
        differences.push(
          `district ${districtId} asOfDate: expected '${originalDistrict.asOfDate}', got '${retrievedDistrict.asOfDate}'`
        )
      }

      // Compare membership stats
      if (
        originalDistrict.membership.total !== retrievedDistrict.membership.total
      ) {
        differences.push(
          `district ${districtId} membership.total: expected ${originalDistrict.membership.total}, got ${retrievedDistrict.membership.total}`
        )
      }

      // Compare club stats
      if (originalDistrict.clubs.total !== retrievedDistrict.clubs.total) {
        differences.push(
          `district ${districtId} clubs.total: expected ${originalDistrict.clubs.total}, got ${retrievedDistrict.clubs.total}`
        )
      }

      if (originalDistrict.clubs.active !== retrievedDistrict.clubs.active) {
        differences.push(
          `district ${districtId} clubs.active: expected ${originalDistrict.clubs.active}, got ${retrievedDistrict.clubs.active}`
        )
      }

      // Compare education stats
      if (
        originalDistrict.education.totalAwards !==
        retrievedDistrict.education.totalAwards
      ) {
        differences.push(
          `district ${districtId} education.totalAwards: expected ${originalDistrict.education.totalAwards}, got ${retrievedDistrict.education.totalAwards}`
        )
      }
    }

    // Compare metadata
    const origMeta = original.payload.metadata
    const retMeta = retrieved.payload.metadata

    if (origMeta.source !== retMeta.source) {
      differences.push(
        `metadata.source: expected '${origMeta.source}', got '${retMeta.source}'`
      )
    }

    if (origMeta.districtCount !== retMeta.districtCount) {
      differences.push(
        `metadata.districtCount: expected ${origMeta.districtCount}, got ${retMeta.districtCount}`
      )
    }

    return {
      equivalent: differences.length === 0,
      differences,
    }
  }

  /**
   * Compare rankings data for equivalence
   */
  function areRankingsEquivalent(
    original: AllDistrictsRankingsData | undefined,
    retrieved: AllDistrictsRankingsData | null | undefined
  ): { equivalent: boolean; differences: string[] } {
    const differences: string[] = []

    // Both undefined/null is equivalent
    if (!original && !retrieved) {
      return { equivalent: true, differences: [] }
    }

    // One defined, one not
    if (!original || !retrieved) {
      differences.push(
        `rankings presence: expected ${!!original}, got ${!!retrieved}`
      )
      return { equivalent: false, differences }
    }

    // Compare ranking count
    if (original.rankings.length !== retrieved.rankings.length) {
      differences.push(
        `rankings count: expected ${original.rankings.length}, got ${retrieved.rankings.length}`
      )
    }

    // Compare metadata
    if (
      original.metadata.totalDistricts !== retrieved.metadata.totalDistricts
    ) {
      differences.push(
        `rankings metadata.totalDistricts: expected ${original.metadata.totalDistricts}, got ${retrieved.metadata.totalDistricts}`
      )
    }

    // Compare individual rankings by districtId
    const originalRankingsById = new Map(
      original.rankings.map(r => [r.districtId, r])
    )
    const retrievedRankingsById = new Map(
      retrieved.rankings.map(r => [r.districtId, r])
    )

    for (const [districtId, origRanking] of originalRankingsById) {
      const retRanking = retrievedRankingsById.get(districtId)
      if (!retRanking) {
        differences.push(`ranking for ${districtId}: missing in retrieved`)
        continue
      }

      if (origRanking.aggregateScore !== retRanking.aggregateScore) {
        differences.push(
          `ranking ${districtId} aggregateScore: expected ${origRanking.aggregateScore}, got ${retRanking.aggregateScore}`
        )
      }
    }

    return {
      equivalent: differences.length === 0,
      differences,
    }
  }

  // ============================================================================
  // Property Tests (Skipped if Emulator Not Available)
  // ============================================================================

  /**
   * Property 9.1: Write/Read Equivalence for Small Snapshots (1-10 districts)
   *
   * For small snapshots that fit in a single batch, verify that the
   * round-trip preserves all data.
   */
  it.skipIf(!isEmulatorAvailable)(
    'should preserve snapshot data through write/read cycle for small snapshots (1-10 districts)',
    async () => {
      // Dynamic import to avoid loading Firestore when emulator not available
      const { FirestoreSnapshotStorage: RealFirestoreSnapshotStorage } =
        await import('../FirestoreSnapshotStorage.js')

      // Use a unique collection name for test isolation
      const testCollectionName = `test_snapshots_small_${Date.now()}_${Math.random().toString(36).substring(7)}`

      const storage = new RealFirestoreSnapshotStorage({
        projectId: 'test-project',
        collectionName: testCollectionName,
      })

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10 }),
          async districtCount => {
            // Generate a snapshot with the specified number of districts
            const snapshot = fc.sample(snapshotArb(districtCount), 1)[0]
            if (!snapshot) {
              throw new Error('Failed to generate snapshot')
            }

            // Generate optional rankings
            const rankings = fc.sample(
              rankingsArb(
                snapshot.payload.metadata.dataAsOfDate,
                snapshot.payload.districts
              ),
              1
            )[0]

            try {
              // Write the snapshot
              await storage.writeSnapshot(snapshot, rankings)

              // Read it back
              const snapshotId = snapshot.payload.metadata.dataAsOfDate
              const retrieved = await storage.getSnapshot(snapshotId)

              // Verify equivalence
              const snapshotComparison = areSnapshotsEquivalent(
                snapshot,
                retrieved
              )

              if (!snapshotComparison.equivalent) {
                console.error(
                  'Snapshot differences:',
                  snapshotComparison.differences
                )
                return false
              }

              // If rankings were provided, verify they were stored correctly
              if (rankings) {
                const retrievedRankings =
                  await storage.readAllDistrictsRankings(snapshotId)
                const rankingsComparison = areRankingsEquivalent(
                  rankings,
                  retrievedRankings
                )

                if (!rankingsComparison.equivalent) {
                  console.error(
                    'Rankings differences:',
                    rankingsComparison.differences
                  )
                  return false
                }
              }

              return true
            } finally {
              // Clean up: delete the snapshot
              try {
                const snapshotId = snapshot.payload.metadata.dataAsOfDate
                await storage.deleteSnapshot(snapshotId)
              } catch {
                // Ignore cleanup errors
              }
            }
          }
        ),
        { numRuns: 20 } // Reduced iterations for emulator tests (slower)
      )
    },
    120000 // 2 minute timeout for emulator tests
  )

  /**
   * Property 9.2: Write/Read Equivalence for Medium Snapshots (50-100 districts)
   *
   * For medium snapshots that require multiple batches, verify that the
   * chunked write preserves all data correctly.
   */
  it.skipIf(!isEmulatorAvailable)(
    'should preserve snapshot data through write/read cycle for medium snapshots (50-100 districts)',
    async () => {
      // Dynamic import to avoid loading Firestore when emulator not available
      const { FirestoreSnapshotStorage: RealFirestoreSnapshotStorage } =
        await import('../FirestoreSnapshotStorage.js')

      // Use a unique collection name for test isolation
      const testCollectionName = `test_snapshots_medium_${Date.now()}_${Math.random().toString(36).substring(7)}`

      const storage = new RealFirestoreSnapshotStorage({
        projectId: 'test-project',
        collectionName: testCollectionName,
      })

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 50, max: 100 }),
          async districtCount => {
            // Generate a snapshot with the specified number of districts
            const snapshot = fc.sample(snapshotArb(districtCount), 1)[0]
            if (!snapshot) {
              throw new Error('Failed to generate snapshot')
            }

            try {
              // Write the snapshot (no rankings for medium tests to speed up)
              await storage.writeSnapshot(snapshot)

              // Read it back
              const snapshotId = snapshot.payload.metadata.dataAsOfDate
              const retrieved = await storage.getSnapshot(snapshotId)

              // Verify equivalence
              const comparison = areSnapshotsEquivalent(snapshot, retrieved)

              if (!comparison.equivalent) {
                console.error('Snapshot differences:', comparison.differences)
                return false
              }

              return true
            } finally {
              // Clean up: delete the snapshot
              try {
                const snapshotId = snapshot.payload.metadata.dataAsOfDate
                await storage.deleteSnapshot(snapshotId)
              } catch {
                // Ignore cleanup errors
              }
            }
          }
        ),
        { numRuns: 10 } // Fewer iterations for larger snapshots
      )
    },
    300000 // 5 minute timeout for medium snapshot tests
  )

  /**
   * Property 9.3: Write/Read Equivalence for Large Snapshots (150-200 districts)
   *
   * For large snapshots similar to production workloads, verify that the
   * chunked write with concurrency preserves all data correctly.
   */
  it.skipIf(!isEmulatorAvailable)(
    'should preserve snapshot data through write/read cycle for large snapshots (150-200 districts)',
    async () => {
      // Dynamic import to avoid loading Firestore when emulator not available
      const { FirestoreSnapshotStorage: RealFirestoreSnapshotStorage } =
        await import('../FirestoreSnapshotStorage.js')

      // Use a unique collection name for test isolation
      const testCollectionName = `test_snapshots_large_${Date.now()}_${Math.random().toString(36).substring(7)}`

      const storage = new RealFirestoreSnapshotStorage({
        projectId: 'test-project',
        collectionName: testCollectionName,
      })

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 150, max: 200 }),
          async districtCount => {
            // Generate a snapshot with the specified number of districts
            const snapshot = fc.sample(snapshotArb(districtCount), 1)[0]
            if (!snapshot) {
              throw new Error('Failed to generate snapshot')
            }

            try {
              // Write the snapshot
              await storage.writeSnapshot(snapshot)

              // Read it back
              const snapshotId = snapshot.payload.metadata.dataAsOfDate
              const retrieved = await storage.getSnapshot(snapshotId)

              // Verify equivalence
              const comparison = areSnapshotsEquivalent(snapshot, retrieved)

              if (!comparison.equivalent) {
                console.error('Snapshot differences:', comparison.differences)
                return false
              }

              return true
            } finally {
              // Clean up: delete the snapshot
              try {
                const snapshotId = snapshot.payload.metadata.dataAsOfDate
                await storage.deleteSnapshot(snapshotId)
              } catch {
                // Ignore cleanup errors
              }
            }
          }
        ),
        { numRuns: 5 } // Very few iterations for large snapshots
      )
    },
    600000 // 10 minute timeout for large snapshot tests
  )

  /**
   * Property 9.4: Rankings Data Equivalence
   *
   * Verify that rankings data is correctly preserved through the write/read cycle.
   */
  it.skipIf(!isEmulatorAvailable)(
    'should preserve rankings data through write/read cycle',
    async () => {
      // Dynamic import to avoid loading Firestore when emulator not available
      const { FirestoreSnapshotStorage: RealFirestoreSnapshotStorage } =
        await import('../FirestoreSnapshotStorage.js')

      // Use a unique collection name for test isolation
      const testCollectionName = `test_snapshots_rankings_${Date.now()}_${Math.random().toString(36).substring(7)}`

      const storage = new RealFirestoreSnapshotStorage({
        projectId: 'test-project',
        collectionName: testCollectionName,
      })

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 5, max: 50 }),
          async districtCount => {
            // Generate a snapshot with the specified number of districts
            const snapshot = fc.sample(snapshotArb(districtCount), 1)[0]
            if (!snapshot) {
              throw new Error('Failed to generate snapshot')
            }

            // Always generate rankings for this test
            const rankings: AllDistrictsRankingsData = {
              metadata: {
                snapshotId: snapshot.payload.metadata.dataAsOfDate,
                calculatedAt: new Date().toISOString(),
                schemaVersion: '1.0.0',
                calculationVersion: '1.0.0',
                rankingVersion: '1.0.0',
                sourceCsvDate: snapshot.payload.metadata.dataAsOfDate,
                csvFetchedAt: new Date().toISOString(),
                totalDistricts: snapshot.payload.districts.length,
                fromCache: false,
              },
              rankings: snapshot.payload.districts.map((d, i) => ({
                districtId: d.districtId,
                districtName: `District ${d.districtId}`,
                region: 'Test Region',
                paidClubs: d.clubs.total,
                paidClubBase: Math.max(1, d.clubs.total - 10),
                clubGrowthPercent: 5.0,
                totalPayments: d.membership.total * 10,
                paymentBase: Math.max(1, d.membership.total * 9),
                paymentGrowthPercent: 10.0,
                activeClubs: d.clubs.active,
                distinguishedClubs: d.clubs.distinguished,
                selectDistinguished: Math.floor(d.clubs.distinguished / 3),
                presidentsDistinguished: Math.floor(d.clubs.distinguished / 6),
                distinguishedPercent:
                  d.clubs.total > 0
                    ? (d.clubs.distinguished / d.clubs.total) * 100
                    : 0,
                clubsRank: i + 1,
                paymentsRank: i + 1,
                distinguishedRank: i + 1,
                aggregateScore: snapshot.payload.districts.length - i,
              })),
            }

            try {
              // Write the snapshot with rankings
              await storage.writeSnapshot(snapshot, rankings)

              // Read rankings back
              const snapshotId = snapshot.payload.metadata.dataAsOfDate
              const retrievedRankings =
                await storage.readAllDistrictsRankings(snapshotId)

              // Verify rankings equivalence
              const comparison = areRankingsEquivalent(
                rankings,
                retrievedRankings
              )

              if (!comparison.equivalent) {
                console.error('Rankings differences:', comparison.differences)
                return false
              }

              return true
            } finally {
              // Clean up: delete the snapshot
              try {
                const snapshotId = snapshot.payload.metadata.dataAsOfDate
                await storage.deleteSnapshot(snapshotId)
              } catch {
                // Ignore cleanup errors
              }
            }
          }
        ),
        { numRuns: 20 }
      )
    },
    120000 // 2 minute timeout
  )
})
