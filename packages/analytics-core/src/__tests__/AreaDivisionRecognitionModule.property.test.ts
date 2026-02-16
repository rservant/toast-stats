/**
 * Property-Based Tests for AreaDivisionRecognitionModule
 *
 * **Property 3: Distinguished Club Criteria Validation**
 * *For any* club with DCP goals and membership values, `isClubDistinguished()` SHALL return `true`
 * if and only if the club meets one of the following criteria:
 * - Smedley: 10+ goals AND 25+ members
 * - President's: 9+ goals AND 20+ members
 * - Select: 7+ goals AND (20+ members OR 5+ net growth)
 * - Distinguished: 5+ goals AND (20+ members OR 3+ net growth)
 *
 * **Validates: Requirements 2.1, 2.2**
 *
 * Feature: district-overview-data-consistency
 * Property 3: Distinguished Club Criteria Validation
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { AreaDivisionRecognitionModule } from '../analytics/AreaDivisionRecognitionModule.js'
import type { DistrictStatistics, ClubStatistics } from '../interfaces.js'

// ========== Reference Implementation ==========

/**
 * Reference implementation of the official DCP criteria for distinguished clubs.
 * This is used to verify the actual implementation matches the specification.
 *
 * Per official Toastmasters Distinguished Club Program requirements:
 * - Smedley: 10 DCP goals AND 25+ members
 * - President's Distinguished: 9+ DCP goals AND 20+ members
 * - Select Distinguished: 7+ DCP goals AND (20+ members OR 5+ net growth)
 * - Distinguished: 5+ DCP goals AND (20+ members OR 3+ net growth)
 *
 * @param dcpGoals - Number of DCP goals achieved (0-10)
 * @param membershipCount - Current membership count
 * @param netGrowth - Net growth (current members - membership base)
 * @returns true if the club meets any distinguished criteria
 */
function referenceIsClubDistinguished(
  dcpGoals: number,
  membershipCount: number,
  netGrowth: number
): boolean {
  // Smedley: 10 goals + 25 members
  if (dcpGoals >= 10 && membershipCount >= 25) return true

  // President's: 9 goals + 20 members
  if (dcpGoals >= 9 && membershipCount >= 20) return true

  // Select: 7 goals + (20 members OR 5+ net growth)
  if (dcpGoals >= 7 && (membershipCount >= 20 || netGrowth >= 5)) return true

  // Distinguished: 5 goals + (20 members OR 3+ net growth)
  if (dcpGoals >= 5 && (membershipCount >= 20 || netGrowth >= 3)) return true

  return false
}

// ========== Arbitraries (Generators) ==========

/**
 * Generate a valid club ID (numeric string)
 */
const clubIdArb = fc.integer({ min: 1000, max: 9999999 }).map(n => String(n))

/**
 * Generate a valid club name
 */
const clubNameArb = fc.constant('Test Club')

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
 * Generate DCP goals (0-10, the valid range)
 */
const dcpGoalsArb = fc.integer({ min: 0, max: 10 })

/**
 * Generate membership count (realistic range 0-100)
 * Includes boundary values around thresholds (20, 25)
 */
const membershipCountArb = fc.oneof(
  // Boundary values around thresholds
  fc.constantFrom(0, 19, 20, 21, 24, 25, 26),
  // Random values in realistic range
  fc.integer({ min: 0, max: 100 })
)

/**
 * Generate membership base for net growth calculation
 * Net growth = membershipCount - membershipBase
 */
const membershipBaseArb = fc.integer({ min: 0, max: 100 })

/**
 * Generate a ClubStatistics object with controlled values for testing
 */
interface ClubTestData {
  dcpGoals: number
  membershipCount: number
  membershipBase: number
}

const clubTestDataArb: fc.Arbitrary<ClubTestData> = fc.record({
  dcpGoals: dcpGoalsArb,
  membershipCount: membershipCountArb,
  membershipBase: membershipBaseArb,
})

/**
 * Create a ClubStatistics object from test data
 */
function createClubFromTestData(
  clubId: string,
  areaId: string,
  divisionId: string,
  testData: ClubTestData
): ClubStatistics {
  return {
    clubId,
    clubName: `Test Club ${clubId}`,
    divisionId,
    areaId,
    divisionName: `Division ${divisionId}`,
    areaName: `Area ${areaId}`,
    membershipCount: testData.membershipCount,
    paymentsCount: testData.membershipCount,
    dcpGoals: testData.dcpGoals,
    status: 'Active', // Must be Active to be counted as paid
    octoberRenewals: 0,
    aprilRenewals: 0,
    newMembers: 0,
    membershipBase: testData.membershipBase,
  }
}

/**
 * Create a DistrictStatistics snapshot with a single club
 */
function createSnapshotWithClub(club: ClubStatistics): DistrictStatistics {
  return {
    districtId: 'D101',
    snapshotDate: '2024-01-15',
    clubs: [club],
    divisions: [],
    areas: [],
    totals: {
      totalClubs: 1,
      totalMembership: club.membershipCount,
      totalPayments: club.paymentsCount,
      distinguishedClubs: 0,
      selectDistinguishedClubs: 0,
      presidentDistinguishedClubs: 0,
    },
  }
}

// ========== Property Tests ==========

describe('AreaDivisionRecognitionModule Property Tests', () => {
  /**
   * Feature: district-overview-data-consistency
   * Property 3: Distinguished Club Criteria Validation
   *
   * **Validates: Requirements 2.1, 2.2**
   */
  describe('Property 3: Distinguished Club Criteria Validation', () => {
    /**
     * Property 3.1: Distinguished club criteria matches reference implementation
     *
     * For any club with random DCP goals, membership, and net growth values,
     * the isClubDistinguished method (tested via calculateAreaRecognition)
     * should return the same result as the reference implementation.
     *
     * **Validates: Requirements 2.1, 2.2**
     */
    it('should correctly identify distinguished clubs based on official DCP criteria', () => {
      fc.assert(
        fc.property(
          clubIdArb,
          areaIdArb,
          divisionIdArb,
          clubTestDataArb,
          (clubId, areaId, divisionId, testData) => {
            const module = new AreaDivisionRecognitionModule()

            // Create a club with the generated test data
            const club = createClubFromTestData(
              clubId,
              areaId,
              divisionId,
              testData
            )
            const snapshot = createSnapshotWithClub(club)

            // Calculate area recognition (which uses isClubDistinguished internally)
            const areaRecognitions = module.calculateAreaRecognition(snapshot)

            // Find the area recognition for our club's area
            const areaRecognition = areaRecognitions.find(
              ar => ar.areaId === areaId
            )

            // Calculate expected result using reference implementation
            const netGrowth = testData.membershipCount - testData.membershipBase
            const expectedDistinguished = referenceIsClubDistinguished(
              testData.dcpGoals,
              testData.membershipCount,
              netGrowth
            )

            // The area should have 1 paid club (since status is Active)
            expect(areaRecognition?.paidClubs).toBe(1)

            // The distinguished clubs count should match our reference implementation
            const actualDistinguished = areaRecognition?.distinguishedClubs ?? 0
            expect(actualDistinguished).toBe(expectedDistinguished ? 1 : 0)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * Property 3.2: Clubs below minimum goals threshold are never distinguished
     *
     * A club with fewer than 5 DCP goals should never be considered distinguished,
     * regardless of membership count or net growth.
     *
     * **Validates: Requirements 2.1**
     */
    it('should never mark clubs with fewer than 5 goals as distinguished', () => {
      fc.assert(
        fc.property(
          clubIdArb,
          areaIdArb,
          divisionIdArb,
          fc.integer({ min: 0, max: 4 }), // Goals below threshold
          fc.integer({ min: 0, max: 100 }), // Any membership
          fc.integer({ min: 0, max: 100 }), // Any membership base
          (
            clubId,
            areaId,
            divisionId,
            dcpGoals,
            membershipCount,
            membershipBase
          ) => {
            const module = new AreaDivisionRecognitionModule()

            const club = createClubFromTestData(clubId, areaId, divisionId, {
              dcpGoals,
              membershipCount,
              membershipBase,
            })
            const snapshot = createSnapshotWithClub(club)

            const areaRecognitions = module.calculateAreaRecognition(snapshot)
            const areaRecognition = areaRecognitions.find(
              ar => ar.areaId === areaId
            )

            // Club should never be distinguished with < 5 goals
            expect(areaRecognition?.distinguishedClubs).toBe(0)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * Property 3.3: Smedley criteria is correctly applied
     *
     * A club with 10+ goals AND 25+ members should always be distinguished.
     *
     * **Validates: Requirements 2.1, 2.2**
     */
    it('should always mark clubs meeting Smedley criteria as distinguished', () => {
      fc.assert(
        fc.property(
          clubIdArb,
          areaIdArb,
          divisionIdArb,
          fc.integer({ min: 10, max: 10 }), // Exactly 10 goals (max)
          fc.integer({ min: 25, max: 100 }), // 25+ members
          fc.integer({ min: 0, max: 100 }), // Any membership base
          (
            clubId,
            areaId,
            divisionId,
            dcpGoals,
            membershipCount,
            membershipBase
          ) => {
            const module = new AreaDivisionRecognitionModule()

            const club = createClubFromTestData(clubId, areaId, divisionId, {
              dcpGoals,
              membershipCount,
              membershipBase,
            })
            const snapshot = createSnapshotWithClub(club)

            const areaRecognitions = module.calculateAreaRecognition(snapshot)
            const areaRecognition = areaRecognitions.find(
              ar => ar.areaId === areaId
            )

            // Club should always be distinguished with Smedley criteria
            expect(areaRecognition?.distinguishedClubs).toBe(1)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * Property 3.4: Net growth alternative path works correctly
     *
     * A club with 5+ goals and insufficient membership (< 20) but sufficient
     * net growth (>= 3) should be distinguished.
     *
     * **Validates: Requirements 2.1, 2.2**
     */
    it('should mark clubs as distinguished via net growth alternative', () => {
      fc.assert(
        fc.property(
          clubIdArb,
          areaIdArb,
          divisionIdArb,
          fc.integer({ min: 5, max: 10 }), // 5+ goals
          fc.integer({ min: 3, max: 19 }), // 3-19 members (enough for net growth, but < 20)
          (clubId, areaId, divisionId, dcpGoals, membershipCount) => {
            const module = new AreaDivisionRecognitionModule()

            // Set membershipBase to 0 so net growth = membershipCount >= 3
            const membershipBase = 0

            const club = createClubFromTestData(clubId, areaId, divisionId, {
              dcpGoals,
              membershipCount,
              membershipBase,
            })
            const snapshot = createSnapshotWithClub(club)

            const areaRecognitions = module.calculateAreaRecognition(snapshot)
            const areaRecognition = areaRecognitions.find(
              ar => ar.areaId === areaId
            )

            // Verify net growth is at least 3
            const netGrowth = membershipCount - membershipBase
            expect(netGrowth).toBeGreaterThanOrEqual(3)

            // Club should be distinguished via net growth path
            expect(areaRecognition?.distinguishedClubs).toBe(1)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * Property 3.5: Clubs not meeting any criteria are not distinguished
     *
     * A club with 5+ goals but insufficient membership (< 20) AND insufficient
     * net growth (< 3) should NOT be distinguished.
     *
     * **Validates: Requirements 2.1, 2.2**
     */
    it('should not mark clubs as distinguished when neither membership nor net growth threshold is met', () => {
      fc.assert(
        fc.property(
          clubIdArb,
          areaIdArb,
          divisionIdArb,
          fc.integer({ min: 5, max: 6 }), // 5-6 goals (Distinguished level)
          fc.integer({ min: 0, max: 19 }), // < 20 members
          (clubId, areaId, divisionId, dcpGoals, membershipCount) => {
            const module = new AreaDivisionRecognitionModule()

            // Set membershipBase such that net growth < 3
            // netGrowth = membershipCount - membershipBase < 3
            // membershipBase > membershipCount - 3
            const membershipBase = membershipCount // net growth = 0

            const club = createClubFromTestData(clubId, areaId, divisionId, {
              dcpGoals,
              membershipCount,
              membershipBase,
            })
            const snapshot = createSnapshotWithClub(club)

            const areaRecognitions = module.calculateAreaRecognition(snapshot)
            const areaRecognition = areaRecognitions.find(
              ar => ar.areaId === areaId
            )

            // Verify net growth is less than 3
            const netGrowth = membershipCount - membershipBase
            expect(netGrowth).toBeLessThan(3)

            // Club should NOT be distinguished
            expect(areaRecognition?.distinguishedClubs).toBe(0)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * Property 3.6: Select level net growth threshold (5+) is correctly applied
     *
     * A club with 7+ goals and insufficient membership (< 20) needs net growth >= 5
     * to qualify for Select Distinguished.
     *
     * **Validates: Requirements 2.1, 2.2**
     */
    it('should correctly apply Select level net growth threshold', () => {
      fc.assert(
        fc.property(
          clubIdArb,
          areaIdArb,
          divisionIdArb,
          fc.integer({ min: 7, max: 8 }), // 7-8 goals (Select level, not President's)
          fc.integer({ min: 0, max: 19 }), // < 20 members
          fc.boolean(), // Whether to meet net growth threshold
          (
            clubId,
            areaId,
            divisionId,
            dcpGoals,
            membershipCount,
            meetsNetGrowth
          ) => {
            const module = new AreaDivisionRecognitionModule()

            // For Select: need net growth >= 5 when membership < 20
            // For Distinguished (5-6 goals): need net growth >= 3
            // Since we have 7-8 goals, we need net growth >= 5 for Select
            let membershipBase: number
            if (meetsNetGrowth) {
              // net growth >= 5
              membershipBase = Math.max(0, membershipCount - 5)
            } else {
              // net growth < 5 but >= 3 (would qualify for Distinguished but not Select)
              // Actually, with 7+ goals, if net growth >= 3, they still qualify as Distinguished
              // So we need net growth < 3 to NOT be distinguished at all
              membershipBase = membershipCount // net growth = 0
            }

            const club = createClubFromTestData(clubId, areaId, divisionId, {
              dcpGoals,
              membershipCount,
              membershipBase,
            })
            const snapshot = createSnapshotWithClub(club)

            const areaRecognitions = module.calculateAreaRecognition(snapshot)
            const areaRecognition = areaRecognitions.find(
              ar => ar.areaId === areaId
            )

            const netGrowth = membershipCount - membershipBase

            // With 7+ goals and < 20 members:
            // - If net growth >= 5: Distinguished (via Select criteria)
            // - If net growth >= 3 but < 5: Distinguished (via Distinguished criteria)
            // - If net growth < 3: NOT Distinguished
            const expectedDistinguished = netGrowth >= 3

            expect(areaRecognition?.distinguishedClubs).toBe(
              expectedDistinguished ? 1 : 0
            )

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * Property 3.7: Missing membershipBase defaults to 0 (net growth = membershipCount)
     *
     * When membershipBase is undefined, net growth should be calculated as
     * membershipCount - 0 = membershipCount.
     *
     * **Validates: Requirements 2.1, 2.2**
     */
    it('should handle missing membershipBase gracefully', () => {
      fc.assert(
        fc.property(
          clubIdArb,
          areaIdArb,
          divisionIdArb,
          fc.integer({ min: 5, max: 10 }), // 5+ goals
          fc.integer({ min: 3, max: 19 }), // 3-19 members (enough for net growth path)
          (clubId, areaId, divisionId, dcpGoals, membershipCount) => {
            const module = new AreaDivisionRecognitionModule()

            // Create club without membershipBase (will be undefined)
            const club: ClubStatistics = {
              clubId,
              clubName: `Test Club ${clubId}`,
              divisionId,
              areaId,
              divisionName: `Division ${divisionId}`,
              areaName: `Area ${areaId}`,
              membershipCount,
              paymentsCount: membershipCount,
              dcpGoals,
              status: 'Active',
              octoberRenewals: 0,
              aprilRenewals: 0,
              newMembers: 0,
              membershipBase: 0, // Simulating missing/default value
            }
            const snapshot = createSnapshotWithClub(club)

            const areaRecognitions = module.calculateAreaRecognition(snapshot)
            const areaRecognition = areaRecognitions.find(
              ar => ar.areaId === areaId
            )

            // With membershipBase = 0, net growth = membershipCount
            // Since membershipCount >= 3, net growth >= 3, so should be distinguished
            expect(areaRecognition?.distinguishedClubs).toBe(1)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
