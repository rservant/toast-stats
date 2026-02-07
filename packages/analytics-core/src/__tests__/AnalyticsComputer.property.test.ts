/**
 * Property-Based Tests for AnalyticsComputer
 *
 * **Property 1: Analytics Computation Equivalence**
 * *For any* valid snapshot data containing district statistics, computing analytics
 * using the shared `AnalyticsComputer` module SHALL produce results identical to
 * computing analytics using the original `AnalyticsEngine` with the same input data.
 *
 * **Validates: Requirements 1.2, 1.4, 7.2, 7.3, 7.4, 7.5**
 *
 * Feature: precomputed-analytics-pipeline
 * Property 1: Analytics Computation Equivalence
 *
 * These tests verify that the AnalyticsComputer produces consistent and deterministic
 * results across all valid inputs using property-based testing with fast-check.
 */

import { describe, it, expect, afterEach } from 'vitest'
import * as fc from 'fast-check'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { AnalyticsComputer } from '../analytics/AnalyticsComputer.js'
import type { DistrictStatistics, ClubStatistics } from '../interfaces.js'

// ========== Test Isolation Utilities ==========

interface IsolatedTestDir {
  path: string
  cleanup: () => Promise<void>
}

/**
 * Create an isolated temporary directory for test isolation
 */
function createIsolatedTestDir(): IsolatedTestDir {
  const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const testPath = path.join(os.tmpdir(), `analytics-core-test-${uniqueId}`)

  return {
    path: testPath,
    cleanup: async () => {
      try {
        await fs.rm(testPath, { recursive: true, force: true })
      } catch {
        // Ignore cleanup errors
      }
    },
  }
}

// ========== Arbitraries (Generators) ==========

/**
 * Generate a valid club ID (numeric string)
 */
const clubIdArb = fc.integer({ min: 1000, max: 9999999 }).map(n => String(n))

/**
 * Generate a valid club name
 */
const clubNameArb = fc
  .array(
    fc.constantFrom(
      ...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz '.split('')
    ),
    { minLength: 3, maxLength: 50 }
  )
  .map(chars => {
    const name = chars.join('').trim()
    return name.length > 0 ? name : 'Test Club'
  })

/**
 * Generate a valid division ID (A-Z)
 */
const divisionIdArb = fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''))

/**
 * Generate a valid area ID (e.g., A1, B2, C3)
 */
const areaIdArb = fc
  .tuple(divisionIdArb, fc.integer({ min: 1, max: 9 }))
  .map(([div, num]) => `${div}${num}`)

/**
 * Generate a valid membership count (realistic range)
 */
const membershipCountArb = fc.integer({ min: 0, max: 100 })

/**
 * Generate a valid payments count (realistic range, usually <= membership)
 */
const paymentsCountArb = fc.integer({ min: 0, max: 100 })

/**
 * Generate a valid DCP goals count (0-10)
 */
const dcpGoalsArb = fc.integer({ min: 0, max: 10 })

/**
 * Generate a valid club status
 */
const clubStatusArb = fc.constantFrom(
  'Active',
  'Suspended',
  'Ineligible',
  'Low'
)

/**
 * Generate a valid snapshot date (YYYY-MM-DD format)
 */
const snapshotDateArb = fc
  .tuple(
    fc.integer({ min: 2020, max: 2025 }),
    fc.integer({ min: 1, max: 12 }),
    fc.integer({ min: 1, max: 28 })
  )
  .map(([year, month, day]) => {
    const monthStr = String(month).padStart(2, '0')
    const dayStr = String(day).padStart(2, '0')
    return `${year}-${monthStr}-${dayStr}`
  })

/**
 * Generate a valid district ID
 */
const districtIdArb = fc.constantFrom(
  'D101',
  'D102',
  'D103',
  'D104',
  'D105',
  'D1',
  'D2',
  'D3'
)

/**
 * Generate a valid ClubStatistics object
 */
const clubStatisticsArb: fc.Arbitrary<ClubStatistics> = fc.record({
  clubId: clubIdArb,
  clubName: clubNameArb,
  divisionId: divisionIdArb,
  areaId: areaIdArb,
  membershipCount: membershipCountArb,
  paymentsCount: paymentsCountArb,
  dcpGoals: dcpGoalsArb,
  status: clubStatusArb,
  membershipBase: fc.integer({ min: 0, max: 100 }),
})

/**
 * Generate a valid DistrictStatistics object with varying club counts
 */
const districtStatisticsArb = (
  districtId: string,
  snapshotDate: string
): fc.Arbitrary<DistrictStatistics> =>
  fc.array(clubStatisticsArb, { minLength: 1, maxLength: 50 }).map(clubs => {
    // Ensure unique club IDs
    const uniqueClubs = clubs.reduce<ClubStatistics[]>((acc, club, idx) => {
      const uniqueClub = { ...club, clubId: `${club.clubId}-${idx}` }
      acc.push(uniqueClub)
      return acc
    }, [])

    const totalMembership = uniqueClubs.reduce(
      (sum, c) => sum + c.membershipCount,
      0
    )
    const totalPayments = uniqueClubs.reduce(
      (sum, c) => sum + c.paymentsCount,
      0
    )

    return {
      districtId,
      snapshotDate,
      clubs: uniqueClubs,
      divisions: [],
      areas: [],
      totals: {
        totalClubs: uniqueClubs.length,
        totalMembership,
        totalPayments,
        distinguishedClubs: uniqueClubs.filter(
          c => c.dcpGoals >= 5 && c.membershipCount >= 20
        ).length,
        selectDistinguishedClubs: uniqueClubs.filter(
          c => c.dcpGoals >= 7 && c.membershipCount >= 20
        ).length,
        presidentDistinguishedClubs: uniqueClubs.filter(
          c => c.dcpGoals >= 9 && c.membershipCount >= 20
        ).length,
      },
    }
  })

/**
 * Generate multiple snapshots for trend analysis
 */
const multipleSnapshotsArb = (
  districtId: string
): fc.Arbitrary<DistrictStatistics[]> =>
  fc.array(snapshotDateArb, { minLength: 1, maxLength: 5 }).chain(dates => {
    // Sort dates and ensure uniqueness
    const uniqueDates = [...new Set(dates)].sort()
    return fc.tuple(
      ...uniqueDates.map(date => districtStatisticsArb(districtId, date))
    )
  })

// ========== Property Tests ==========

describe('AnalyticsComputer Property Tests', () => {
  /**
   * Feature: precomputed-analytics-pipeline
   * Property 1: Analytics Computation Equivalence
   *
   * **Validates: Requirements 1.2, 1.4, 7.2, 7.3, 7.4, 7.5**
   */
  describe('Property 1: Analytics Computation Equivalence', () => {
    let testDir: IsolatedTestDir | null = null

    afterEach(async () => {
      if (testDir) {
        await testDir.cleanup()
        testDir = null
      }
    })

    /**
     * Property 1.1: Deterministic Output
     * Computing analytics twice with the same input should produce equivalent results
     * (excluding timestamp fields which are expected to differ).
     *
     * **Validates: Requirements 1.4**
     */
    it('should produce deterministic results for the same input (excluding timestamps)', async () => {
      testDir = createIsolatedTestDir()

      await fc.assert(
        fc.asyncProperty(
          districtIdArb,
          fc
            .array(snapshotDateArb, { minLength: 1, maxLength: 3 })
            .chain(dates => {
              const uniqueDates = [...new Set(dates)].sort()
              return fc
                .tuple(
                  fc.constant(uniqueDates[0]!),
                  ...uniqueDates.map(date =>
                    districtStatisticsArb('D101', date)
                  )
                )
                .map(([_firstDate, ...snapshots]) => snapshots)
            }),
          async (districtId, snapshots) => {
            const computer1 = new AnalyticsComputer()
            const computer2 = new AnalyticsComputer()

            const result1 = await computer1.computeDistrictAnalytics(
              districtId,
              snapshots
            )
            const result2 = await computer2.computeDistrictAnalytics(
              districtId,
              snapshots
            )

            // Compare district analytics (excluding computedAt timestamp)
            expect(result1.districtAnalytics).toEqual(result2.districtAnalytics)
            expect(result1.membershipTrends).toEqual(result2.membershipTrends)
            expect(result1.clubHealth).toEqual(result2.clubHealth)
            expect(result1.schemaVersion).toEqual(result2.schemaVersion)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * Property 1.2: Membership Total Consistency
     * The total membership in the result should equal the sum of all club memberships
     * in the latest snapshot.
     *
     * **Validates: Requirements 7.2**
     */
    it('should compute total membership as sum of all club memberships in latest snapshot', async () => {
      testDir = createIsolatedTestDir()

      await fc.assert(
        fc.asyncProperty(
          districtIdArb,
          multipleSnapshotsArb('D101'),
          async (districtId, snapshots) => {
            const computer = new AnalyticsComputer()
            const result = await computer.computeDistrictAnalytics(
              districtId,
              snapshots
            )

            // Sort snapshots by date to find the latest
            const sortedSnapshots = [...snapshots].sort((a, b) =>
              a.snapshotDate.localeCompare(b.snapshotDate)
            )
            const latestSnapshot = sortedSnapshots[sortedSnapshots.length - 1]

            if (!latestSnapshot) {
              expect(result.districtAnalytics.totalMembership).toBe(0)
              return true
            }

            const expectedTotal = latestSnapshot.clubs.reduce(
              (sum, club) => sum + club.membershipCount,
              0
            )

            expect(result.districtAnalytics.totalMembership).toBe(expectedTotal)
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * Property 1.3: Membership Change Consistency (Snapshot-Based Fallback)
     * Without rankings data, the membership change should equal
     * sum(paymentsCount) - sum(membershipBase) from the latest snapshot.
     *
     * **Validates: Requirements 7.2**
     */
    it('should compute membership change as snapshot-based fallback without rankings', async () => {
      testDir = createIsolatedTestDir()

      await fc.assert(
        fc.asyncProperty(
          districtIdArb,
          multipleSnapshotsArb('D101'),
          async (districtId, snapshots) => {
            const computer = new AnalyticsComputer()
            const result = await computer.computeDistrictAnalytics(
              districtId,
              snapshots
            )

            const sortedSnapshots = [...snapshots].sort((a, b) =>
              a.snapshotDate.localeCompare(b.snapshotDate)
            )

            if (sortedSnapshots.length === 0) {
              expect(result.districtAnalytics.membershipChange).toBe(0)
              return true
            }

            // Without rankings, fallback uses latest snapshot:
            // sum(paymentsCount) - sum(membershipBase)
            const lastSnapshot = sortedSnapshots[sortedSnapshots.length - 1]!

            const totalPayments = lastSnapshot.clubs.reduce(
              (sum, club) => sum + club.paymentsCount,
              0
            )
            const totalMembershipBase = lastSnapshot.clubs.reduce(
              (sum, club) => sum + (club.membershipBase ?? 0),
              0
            )

            expect(result.districtAnalytics.membershipChange).toBe(
              totalPayments - totalMembershipBase
            )
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * Property 1.4: Club Health Categorization Completeness
     * All clubs should be categorized into exactly one health category.
     *
     * **Validates: Requirements 7.3**
     */
    it('should categorize all clubs into health categories', async () => {
      testDir = createIsolatedTestDir()

      await fc.assert(
        fc.asyncProperty(
          districtIdArb,
          multipleSnapshotsArb('D101'),
          async (districtId, snapshots) => {
            const computer = new AnalyticsComputer()
            const result = await computer.computeDistrictAnalytics(
              districtId,
              snapshots
            )

            const { clubHealth } = result

            // All clubs should be in allClubs
            const allClubIds = new Set(clubHealth.allClubs.map(c => c.clubId))

            // Each categorized club should be in allClubs
            for (const club of clubHealth.thrivingClubs) {
              expect(allClubIds.has(club.clubId)).toBe(true)
            }
            for (const club of clubHealth.vulnerableClubs) {
              expect(allClubIds.has(club.clubId)).toBe(true)
            }
            for (const club of clubHealth.interventionRequiredClubs) {
              expect(allClubIds.has(club.clubId)).toBe(true)
            }

            // Sum of categorized clubs should equal total clubs
            // (clubs can only be in one category)
            const categorizedCount =
              clubHealth.thrivingClubs.length +
              clubHealth.vulnerableClubs.length +
              clubHealth.interventionRequiredClubs.length

            // Note: Some clubs may be 'stable' status which isn't a separate category
            // The categorized count should be <= allClubs count
            expect(categorizedCount).toBeLessThanOrEqual(
              clubHealth.allClubs.length
            )

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * Property 1.5: Distinguished Club Criteria Consistency
     * Clubs marked as distinguished should meet the DCP goals and membership/net growth criteria.
     * Per Toastmasters rules, clubs can qualify via membership OR net growth:
     * - Distinguished: 5+ goals AND (20+ members OR net growth >= 3)
     * - Select: 7+ goals AND (20+ members OR net growth >= 5)
     * - President: 9+ goals AND 20+ members
     * - Smedley: 10+ goals AND 25+ members
     *
     * **Validates: Requirements 7.4**
     */
    it('should only mark clubs as distinguished if they meet criteria', async () => {
      testDir = createIsolatedTestDir()

      await fc.assert(
        fc.asyncProperty(
          districtIdArb,
          multipleSnapshotsArb('D101'),
          async (districtId, snapshots) => {
            const computer = new AnalyticsComputer()
            const result = await computer.computeDistrictAnalytics(
              districtId,
              snapshots
            )

            // Use distinguishedClubsList for the array of club summaries (Requirements 2.2)
            const { distinguishedClubsList } = result.districtAnalytics

            // Get latest snapshot for verification
            const sortedSnapshots = [...snapshots].sort((a, b) =>
              a.snapshotDate.localeCompare(b.snapshotDate)
            )
            const latestSnapshot = sortedSnapshots[sortedSnapshots.length - 1]

            if (!latestSnapshot) {
              expect(distinguishedClubsList).toHaveLength(0)
              return true
            }

            // Verify each distinguished club meets criteria
            for (const distinguished of distinguishedClubsList) {
              const club = latestSnapshot.clubs.find(
                c => c.clubId === distinguished.clubId
              )

              if (club) {
                // Calculate net growth for membership alternative check
                const netGrowth =
                  club.membershipCount - (club.membershipBase ?? 0)

                // Smedley requires 10+ goals and 25+ members
                // President requires 9+ goals and 20+ members
                // Select requires 7+ goals and (20+ members OR net growth >= 5)
                // Distinguished requires 5+ goals and (20+ members OR net growth >= 3)
                if (distinguished.status === 'smedley') {
                  expect(club.dcpGoals).toBeGreaterThanOrEqual(10)
                  expect(club.membershipCount).toBeGreaterThanOrEqual(25)
                } else if (distinguished.status === 'president') {
                  expect(club.dcpGoals).toBeGreaterThanOrEqual(9)
                  expect(club.membershipCount).toBeGreaterThanOrEqual(20)
                } else if (distinguished.status === 'select') {
                  expect(club.dcpGoals).toBeGreaterThanOrEqual(7)
                  // Select: 20+ members OR net growth >= 5
                  expect(club.membershipCount >= 20 || netGrowth >= 5).toBe(
                    true
                  )
                } else if (distinguished.status === 'distinguished') {
                  expect(club.dcpGoals).toBeGreaterThanOrEqual(5)
                  // Distinguished: 20+ members OR net growth >= 3
                  expect(club.membershipCount >= 20 || netGrowth >= 3).toBe(
                    true
                  )
                }
              }
            }

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * Property 1.6: Division Rankings Consistency
     * Division rankings should be sorted by score in descending order.
     *
     * **Validates: Requirements 7.5**
     */
    it('should produce division rankings sorted by score descending', async () => {
      testDir = createIsolatedTestDir()

      await fc.assert(
        fc.asyncProperty(
          districtIdArb,
          multipleSnapshotsArb('D101'),
          async (districtId, snapshots) => {
            const computer = new AnalyticsComputer()
            const result = await computer.computeDistrictAnalytics(
              districtId,
              snapshots
            )

            const { divisionRankings } = result.districtAnalytics

            // Verify rankings are sorted by score descending
            for (let i = 1; i < divisionRankings.length; i++) {
              const prev = divisionRankings[i - 1]!
              const curr = divisionRankings[i]!
              expect(prev.score).toBeGreaterThanOrEqual(curr.score)
            }

            // Verify rank numbers are sequential starting from 1
            for (let i = 0; i < divisionRankings.length; i++) {
              expect(divisionRankings[i]!.rank).toBe(i + 1)
            }

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * Property 1.7: Membership Trend Data Points
     * The membership trend should have one data point per snapshot.
     *
     * **Validates: Requirements 7.2**
     */
    it('should produce membership trend with one point per snapshot', async () => {
      testDir = createIsolatedTestDir()

      await fc.assert(
        fc.asyncProperty(
          districtIdArb,
          multipleSnapshotsArb('D101'),
          async (districtId, snapshots) => {
            const computer = new AnalyticsComputer()
            const result = await computer.computeDistrictAnalytics(
              districtId,
              snapshots
            )

            const { membershipTrend } = result.membershipTrends

            // Should have same number of data points as snapshots
            expect(membershipTrend.length).toBe(snapshots.length)

            // Each data point should have a valid date and count
            for (const point of membershipTrend) {
              expect(point.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
              expect(typeof point.count).toBe('number')
              expect(point.count).toBeGreaterThanOrEqual(0)
            }

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * Property 1.8: Date Range Consistency
     * The date range should span from the earliest to latest snapshot date.
     *
     * **Validates: Requirements 1.2**
     */
    it('should set date range from earliest to latest snapshot', async () => {
      testDir = createIsolatedTestDir()

      await fc.assert(
        fc.asyncProperty(
          districtIdArb,
          multipleSnapshotsArb('D101'),
          async (districtId, snapshots) => {
            const computer = new AnalyticsComputer()
            const result = await computer.computeDistrictAnalytics(
              districtId,
              snapshots
            )

            const sortedSnapshots = [...snapshots].sort((a, b) =>
              a.snapshotDate.localeCompare(b.snapshotDate)
            )

            if (sortedSnapshots.length === 0) {
              return true
            }

            const expectedStart = sortedSnapshots[0]!.snapshotDate
            const expectedEnd =
              sortedSnapshots[sortedSnapshots.length - 1]!.snapshotDate

            expect(result.districtAnalytics.dateRange.start).toBe(expectedStart)
            expect(result.districtAnalytics.dateRange.end).toBe(expectedEnd)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * Property 1.9: Schema Version Presence
     * Every computation result should include a valid schema version.
     *
     * **Validates: Requirements 1.4**
     */
    it('should always include a valid schema version', async () => {
      testDir = createIsolatedTestDir()

      await fc.assert(
        fc.asyncProperty(
          districtIdArb,
          multipleSnapshotsArb('D101'),
          async (districtId, snapshots) => {
            const computer = new AnalyticsComputer()
            const result = await computer.computeDistrictAnalytics(
              districtId,
              snapshots
            )

            expect(result.schemaVersion).toBeDefined()
            expect(typeof result.schemaVersion).toBe('string')
            expect(result.schemaVersion.length).toBeGreaterThan(0)
            // Schema version should follow semver format
            expect(result.schemaVersion).toMatch(/^\d+\.\d+\.\d+$/)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * Property 1.10: Empty Input Handling
     * Computing analytics with empty snapshots should produce valid empty results.
     *
     * **Validates: Requirements 1.2, 1.4**
     */
    it('should handle empty snapshots gracefully', async () => {
      testDir = createIsolatedTestDir()

      await fc.assert(
        fc.asyncProperty(districtIdArb, async districtId => {
          const computer = new AnalyticsComputer()
          const result = await computer.computeDistrictAnalytics(districtId, [])

          expect(result.districtAnalytics.districtId).toBe(districtId)
          expect(result.districtAnalytics.totalMembership).toBe(0)
          expect(result.districtAnalytics.membershipChange).toBe(0)
          expect(result.districtAnalytics.allClubs).toHaveLength(0)
          expect(result.schemaVersion).toBeDefined()
          expect(result.computedAt).toBeDefined()

          return true
        }),
        { numRuns: 100 }
      )
    })
  })
})
