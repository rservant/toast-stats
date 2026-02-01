/**
 * Property-Based Tests for AnalyticsComputer
 *
 * Feature: backend-computation-removal
 *
 * Property 3: Club Trends Index Lookup
 * *For any* club ID in a district, looking up the club in the club-trends-index
 * SHALL return the same ClubTrend data as would be found in the allClubs array
 * of the district analytics.
 * **Validates: Requirements 2.2, 2.3, 2.4**
 *
 * Property 4: Vulnerable Clubs Partition
 * *For any* VulnerableClubsData, the union of vulnerableClubs and interventionRequired
 * arrays SHALL equal the set of clubs with currentStatus of 'vulnerable' or
 * 'intervention_required' in the district analytics.
 * **Validates: Requirements 3.2, 3.3**
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { AnalyticsComputer } from './AnalyticsComputer.js'
import type {
  ClubHealthData,
  ClubTrend,
  ClubTrendsIndex,
  VulnerableClubsData,
} from '../types.js'

// ========== Arbitraries (Generators) ==========

/**
 * Generate a valid club ID (numeric string).
 */
const clubIdArb: fc.Arbitrary<string> = fc
  .integer({ min: 1000, max: 9999999 })
  .map(n => n.toString())

/**
 * Generate a valid club name.
 */
const clubNameArb: fc.Arbitrary<string> = fc
  .string({ minLength: 3, maxLength: 50 })
  .map(s => s.replace(/[^A-Za-z ]/g, 'X').trim() || 'Test Club')

/**
 * Generate a valid division ID (single letter A-Z).
 */
const divisionIdArb: fc.Arbitrary<string> = fc.constantFrom(
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J'
)

/**
 * Generate a valid area ID (letter + number).
 */
const areaIdArb: fc.Arbitrary<string> = fc
  .tuple(divisionIdArb, fc.integer({ min: 1, max: 9 }))
  .map(([div, num]) => `${div}${num}`)

/**
 * Generate a valid club health status.
 */
const clubHealthStatusArb: fc.Arbitrary<
  'thriving' | 'vulnerable' | 'intervention_required'
> = fc.constantFrom('thriving', 'vulnerable', 'intervention_required')

/**
 * Generate a valid distinguished level.
 */
const distinguishedLevelArb: fc.Arbitrary<
  'Smedley' | 'President' | 'Select' | 'Distinguished' | 'NotDistinguished'
> = fc.constantFrom(
  'Smedley',
  'President',
  'Select',
  'Distinguished',
  'NotDistinguished'
)

/**
 * Generate a valid date string in YYYY-MM-DD format.
 * Uses integer-based generation to avoid invalid date issues.
 */
const dateStringArb: fc.Arbitrary<string> = fc
  .integer({ min: 0, max: 730 }) // ~2 years of days
  .map(dayOffset => {
    const baseDate = new Date('2023-01-01')
    baseDate.setDate(baseDate.getDate() + dayOffset)
    return baseDate.toISOString().split('T')[0] ?? '2024-01-15'
  })

/**
 * Generate a membership trend point.
 */
const membershipTrendPointArb = fc.record({
  date: dateStringArb,
  count: fc.integer({ min: 5, max: 100 }),
})

/**
 * Generate a DCP goals trend point.
 */
const dcpGoalsTrendPointArb = fc.record({
  date: dateStringArb,
  goalsAchieved: fc.integer({ min: 0, max: 10 }),
})

/**
 * Generate a ClubTrend object with all required fields.
 */
const clubTrendArb: fc.Arbitrary<ClubTrend> = fc.record({
  clubId: clubIdArb,
  clubName: clubNameArb,
  divisionId: divisionIdArb,
  divisionName: divisionIdArb.map(id => `Division ${id}`),
  areaId: areaIdArb,
  areaName: areaIdArb.map(id => `Area ${id}`),
  currentStatus: clubHealthStatusArb,
  healthScore: fc.double({ min: 0, max: 1, noNaN: true }),
  membershipCount: fc.integer({ min: 5, max: 100 }),
  paymentsCount: fc.integer({ min: 0, max: 100 }),
  membershipTrend: fc.array(membershipTrendPointArb, {
    minLength: 0,
    maxLength: 5,
  }),
  dcpGoalsTrend: fc.array(dcpGoalsTrendPointArb, {
    minLength: 0,
    maxLength: 5,
  }),
  riskFactors: fc.array(
    fc.constantFrom('Low membership', 'Low payments', 'No growth'),
    {
      minLength: 0,
      maxLength: 3,
    }
  ),
  distinguishedLevel: distinguishedLevelArb,
  octoberRenewals: fc.option(fc.integer({ min: 0, max: 50 }), {
    nil: undefined,
  }),
  aprilRenewals: fc.option(fc.integer({ min: 0, max: 50 }), { nil: undefined }),
  newMembers: fc.option(fc.integer({ min: 0, max: 20 }), { nil: undefined }),
  clubStatus: fc.option(
    fc.constantFrom('Active', 'Suspended', 'Low', 'Ineligible'),
    {
      nil: undefined,
    }
  ),
})

/**
 * Generate a unique list of ClubTrend objects with distinct club IDs.
 * Uses a counter-based approach to ensure uniqueness.
 */
const uniqueClubTrendListArb = (
  minClubs: number,
  maxClubs: number
): fc.Arbitrary<ClubTrend[]> =>
  fc
    .array(clubTrendArb, { minLength: minClubs, maxLength: maxClubs })
    .map(clubs => {
      // Ensure unique club IDs by appending index
      return clubs.map((club, index) => ({
        ...club,
        clubId: `${club.clubId}-${index}`,
      }))
    })

/**
 * Generate a ClubHealthData object with categorized clubs.
 * The allClubs array contains all clubs, and the category arrays
 * are subsets based on currentStatus.
 */
const clubHealthDataArb: fc.Arbitrary<ClubHealthData> = uniqueClubTrendListArb(
  1,
  30
).map(allClubs => {
  const thrivingClubs = allClubs.filter(c => c.currentStatus === 'thriving')
  const vulnerableClubs = allClubs.filter(c => c.currentStatus === 'vulnerable')
  const interventionRequiredClubs = allClubs.filter(
    c => c.currentStatus === 'intervention_required'
  )

  return {
    allClubs,
    thrivingClubs,
    vulnerableClubs,
    interventionRequiredClubs,
  }
})

// ========== Helper Functions ==========

/**
 * Deep equality check for ClubTrend objects.
 * Compares all properties to ensure the index lookup returns
 * the exact same data as the allClubs array.
 */
function clubTrendsEqual(a: ClubTrend, b: ClubTrend): boolean {
  // Compare all primitive properties
  if (a.clubId !== b.clubId) return false
  if (a.clubName !== b.clubName) return false
  if (a.divisionId !== b.divisionId) return false
  if (a.divisionName !== b.divisionName) return false
  if (a.areaId !== b.areaId) return false
  if (a.areaName !== b.areaName) return false
  if (a.currentStatus !== b.currentStatus) return false
  if (a.healthScore !== b.healthScore) return false
  if (a.membershipCount !== b.membershipCount) return false
  if (a.paymentsCount !== b.paymentsCount) return false
  if (a.distinguishedLevel !== b.distinguishedLevel) return false
  if (a.octoberRenewals !== b.octoberRenewals) return false
  if (a.aprilRenewals !== b.aprilRenewals) return false
  if (a.newMembers !== b.newMembers) return false
  if (a.clubStatus !== b.clubStatus) return false

  // Compare arrays
  if (JSON.stringify(a.membershipTrend) !== JSON.stringify(b.membershipTrend))
    return false
  if (JSON.stringify(a.dcpGoalsTrend) !== JSON.stringify(b.dcpGoalsTrend))
    return false
  if (JSON.stringify(a.riskFactors) !== JSON.stringify(b.riskFactors))
    return false

  return true
}

// ========== Property Tests ==========

describe('Club Trends Index Lookup Property Tests', () => {
  /**
   * Feature: backend-computation-removal
   * Property 3: Club Trends Index Lookup
   *
   * *For any* club ID in a district, looking up the club in the club-trends-index
   * SHALL return the same ClubTrend data as would be found in the allClubs array
   * of the district analytics.
   *
   * **Validates: Requirements 2.2, 2.3, 2.4**
   */
  describe('Property 3: Club Trends Index Lookup', () => {
    it('should return the same ClubTrend data from index lookup as from allClubs array', () => {
      // **Validates: Requirements 2.2, 2.3, 2.4**
      const computer = new AnalyticsComputer()

      fc.assert(
        fc.property(clubHealthDataArb, clubHealth => {
          const index: ClubTrendsIndex = computer.buildClubTrendsIndex(
            'D101',
            clubHealth
          )

          // For every club in allClubs, verify the index lookup returns the same data
          for (const club of clubHealth.allClubs) {
            const indexedClub = index.clubs[club.clubId]

            // Property: Index lookup must return a club
            expect(indexedClub).toBeDefined()

            // Property: Index lookup must return the exact same ClubTrend data
            expect(clubTrendsEqual(club, indexedClub!)).toBe(true)
          }
        }),
        { numRuns: 100 }
      )
    })

    it('should have index size equal to allClubs length (no missing clubs)', () => {
      // **Validates: Requirements 2.2, 2.3, 2.4**
      const computer = new AnalyticsComputer()

      fc.assert(
        fc.property(clubHealthDataArb, clubHealth => {
          const index: ClubTrendsIndex = computer.buildClubTrendsIndex(
            'D101',
            clubHealth
          )

          // Property: Index should contain exactly the same number of clubs as allClubs
          expect(Object.keys(index.clubs).length).toBe(
            clubHealth.allClubs.length
          )
        }),
        { numRuns: 100 }
      )
    })

    it('should have all allClubs club IDs present in the index', () => {
      // **Validates: Requirements 2.2, 2.3, 2.4**
      const computer = new AnalyticsComputer()

      fc.assert(
        fc.property(clubHealthDataArb, clubHealth => {
          const index: ClubTrendsIndex = computer.buildClubTrendsIndex(
            'D101',
            clubHealth
          )

          // Get all club IDs from allClubs
          const allClubIds = new Set(clubHealth.allClubs.map(c => c.clubId))

          // Get all club IDs from index
          const indexClubIds = new Set(Object.keys(index.clubs))

          // Property: All club IDs from allClubs must be in the index
          for (const clubId of allClubIds) {
            expect(indexClubIds.has(clubId)).toBe(true)
          }

          // Property: All club IDs in the index must be from allClubs
          for (const clubId of indexClubIds) {
            expect(allClubIds.has(clubId)).toBe(true)
          }
        }),
        { numRuns: 100 }
      )
    })

    it('should preserve club data integrity through index lookup', () => {
      // **Validates: Requirements 2.2, 2.3, 2.4**
      const computer = new AnalyticsComputer()

      fc.assert(
        fc.property(clubHealthDataArb, clubHealth => {
          const index: ClubTrendsIndex = computer.buildClubTrendsIndex(
            'D101',
            clubHealth
          )

          // For each club, verify specific properties are preserved
          for (const club of clubHealth.allClubs) {
            const indexedClub = index.clubs[club.clubId]

            // Verify core identification is preserved
            expect(indexedClub?.clubId).toBe(club.clubId)
            expect(indexedClub?.clubName).toBe(club.clubName)

            // Verify division/area info is preserved
            expect(indexedClub?.divisionId).toBe(club.divisionId)
            expect(indexedClub?.areaId).toBe(club.areaId)

            // Verify health assessment is preserved
            expect(indexedClub?.currentStatus).toBe(club.currentStatus)
            expect(indexedClub?.healthScore).toBe(club.healthScore)

            // Verify membership data is preserved
            expect(indexedClub?.membershipCount).toBe(club.membershipCount)
            expect(indexedClub?.paymentsCount).toBe(club.paymentsCount)

            // Verify distinguished level is preserved
            expect(indexedClub?.distinguishedLevel).toBe(
              club.distinguishedLevel
            )
          }
        }),
        { numRuns: 100 }
      )
    })

    it('should handle empty allClubs array', () => {
      // **Validates: Requirements 2.2, 2.3, 2.4**
      const computer = new AnalyticsComputer()

      const emptyClubHealth: ClubHealthData = {
        allClubs: [],
        thrivingClubs: [],
        vulnerableClubs: [],
        interventionRequiredClubs: [],
      }

      const index: ClubTrendsIndex = computer.buildClubTrendsIndex(
        'D101',
        emptyClubHealth
      )

      // Property: Empty allClubs should produce empty index
      expect(Object.keys(index.clubs).length).toBe(0)
      expect(index.districtId).toBe('D101')
      expect(index.computedAt).toBeDefined()
    })

    it('should set correct districtId in the index', () => {
      // **Validates: Requirements 2.2, 2.3, 2.4**
      const computer = new AnalyticsComputer()

      fc.assert(
        fc.property(
          clubHealthDataArb,
          fc
            .string({ minLength: 1, maxLength: 10 })
            .map(s => `D${s.replace(/[^0-9]/g, '1')}`),
          (clubHealth, districtId) => {
            const index: ClubTrendsIndex = computer.buildClubTrendsIndex(
              districtId,
              clubHealth
            )

            // Property: Index should have the correct districtId
            expect(index.districtId).toBe(districtId)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should include valid computedAt timestamp', () => {
      // **Validates: Requirements 2.2, 2.3, 2.4**
      const computer = new AnalyticsComputer()

      fc.assert(
        fc.property(clubHealthDataArb, clubHealth => {
          const beforeCompute = new Date().toISOString()
          const index: ClubTrendsIndex = computer.buildClubTrendsIndex(
            'D101',
            clubHealth
          )
          const afterCompute = new Date().toISOString()

          // Property: computedAt should be a valid ISO timestamp
          expect(() => new Date(index.computedAt)).not.toThrow()

          // Property: computedAt should be between before and after compute times
          expect(index.computedAt >= beforeCompute).toBe(true)
          expect(index.computedAt <= afterCompute).toBe(true)
        }),
        { numRuns: 100 }
      )
    })
  })
})

// ========== Property 4: Vulnerable Clubs Partition ==========

describe('Vulnerable Clubs Partition Property Tests', () => {
  /**
   * Feature: backend-computation-removal
   * Property 4: Vulnerable Clubs Partition
   *
   * *For any* VulnerableClubsData, the union of vulnerableClubs and interventionRequired
   * arrays SHALL equal the set of clubs with currentStatus of 'vulnerable' or
   * 'intervention_required' in the district analytics.
   *
   * **Validates: Requirements 3.2, 3.3**
   */
  describe('Property 4: Vulnerable Clubs Partition', () => {
    it('should partition clubs correctly: vulnerableClubs contains exactly clubs with vulnerable status', () => {
      // **Validates: Requirements 3.2, 3.3**
      const computer = new AnalyticsComputer()

      fc.assert(
        fc.property(clubHealthDataArb, clubHealth => {
          const vulnerableClubsData: VulnerableClubsData =
            computer.computeVulnerableClubs('D101', clubHealth)

          // Get clubs with 'vulnerable' status from allClubs
          const expectedVulnerable = clubHealth.allClubs.filter(
            c => c.currentStatus === 'vulnerable'
          )

          // Property: vulnerableClubs array should contain exactly the clubs with 'vulnerable' status
          expect(vulnerableClubsData.vulnerableClubs.length).toBe(
            expectedVulnerable.length
          )

          // Verify each club in vulnerableClubs has 'vulnerable' status
          for (const club of vulnerableClubsData.vulnerableClubs) {
            expect(club.currentStatus).toBe('vulnerable')
          }

          // Verify all expected vulnerable clubs are present
          const vulnerableIds = new Set(
            vulnerableClubsData.vulnerableClubs.map(c => c.clubId)
          )
          for (const club of expectedVulnerable) {
            expect(vulnerableIds.has(club.clubId)).toBe(true)
          }
        }),
        { numRuns: 100 }
      )
    })

    it('should partition clubs correctly: interventionRequired contains exactly clubs with intervention_required status', () => {
      // **Validates: Requirements 3.2, 3.3**
      const computer = new AnalyticsComputer()

      fc.assert(
        fc.property(clubHealthDataArb, clubHealth => {
          const vulnerableClubsData: VulnerableClubsData =
            computer.computeVulnerableClubs('D101', clubHealth)

          // Get clubs with 'intervention_required' status from allClubs
          const expectedIntervention = clubHealth.allClubs.filter(
            c => c.currentStatus === 'intervention_required'
          )

          // Property: interventionRequired array should contain exactly the clubs with 'intervention_required' status
          expect(vulnerableClubsData.interventionRequired.length).toBe(
            expectedIntervention.length
          )

          // Verify each club in interventionRequired has 'intervention_required' status
          for (const club of vulnerableClubsData.interventionRequired) {
            expect(club.currentStatus).toBe('intervention_required')
          }

          // Verify all expected intervention-required clubs are present
          const interventionIds = new Set(
            vulnerableClubsData.interventionRequired.map(c => c.clubId)
          )
          for (const club of expectedIntervention) {
            expect(interventionIds.has(club.clubId)).toBe(true)
          }
        }),
        { numRuns: 100 }
      )
    })

    it('should have union of vulnerableClubs and interventionRequired equal to all at-risk clubs', () => {
      // **Validates: Requirements 3.2, 3.3**
      const computer = new AnalyticsComputer()

      fc.assert(
        fc.property(clubHealthDataArb, clubHealth => {
          const vulnerableClubsData: VulnerableClubsData =
            computer.computeVulnerableClubs('D101', clubHealth)

          // Get all at-risk clubs from allClubs (vulnerable OR intervention_required)
          const allAtRiskClubs = clubHealth.allClubs.filter(
            c =>
              c.currentStatus === 'vulnerable' ||
              c.currentStatus === 'intervention_required'
          )

          // Get union of vulnerableClubs and interventionRequired
          const unionClubs = [
            ...vulnerableClubsData.vulnerableClubs,
            ...vulnerableClubsData.interventionRequired,
          ]

          // Property: Union size should equal all at-risk clubs size
          expect(unionClubs.length).toBe(allAtRiskClubs.length)

          // Property: Union should contain exactly the same clubs as allAtRiskClubs
          const unionIds = new Set(unionClubs.map(c => c.clubId))
          const atRiskIds = new Set(allAtRiskClubs.map(c => c.clubId))

          // All at-risk clubs should be in the union
          for (const clubId of atRiskIds) {
            expect(unionIds.has(clubId)).toBe(true)
          }

          // All clubs in the union should be at-risk
          for (const clubId of unionIds) {
            expect(atRiskIds.has(clubId)).toBe(true)
          }
        }),
        { numRuns: 100 }
      )
    })

    it('should have no overlap between vulnerableClubs and interventionRequired (disjoint sets)', () => {
      // **Validates: Requirements 3.2, 3.3**
      const computer = new AnalyticsComputer()

      fc.assert(
        fc.property(clubHealthDataArb, clubHealth => {
          const vulnerableClubsData: VulnerableClubsData =
            computer.computeVulnerableClubs('D101', clubHealth)

          // Get club IDs from both arrays
          const vulnerableIds = new Set(
            vulnerableClubsData.vulnerableClubs.map(c => c.clubId)
          )
          const interventionIds = new Set(
            vulnerableClubsData.interventionRequired.map(c => c.clubId)
          )

          // Property: No club should appear in both arrays (disjoint partition)
          for (const clubId of vulnerableIds) {
            expect(interventionIds.has(clubId)).toBe(false)
          }

          for (const clubId of interventionIds) {
            expect(vulnerableIds.has(clubId)).toBe(false)
          }
        }),
        { numRuns: 100 }
      )
    })

    it('should have correct counts matching array lengths', () => {
      // **Validates: Requirements 3.2, 3.3**
      const computer = new AnalyticsComputer()

      fc.assert(
        fc.property(clubHealthDataArb, clubHealth => {
          const vulnerableClubsData: VulnerableClubsData =
            computer.computeVulnerableClubs('D101', clubHealth)

          // Property: totalVulnerableClubs should match vulnerableClubs array length
          expect(vulnerableClubsData.totalVulnerableClubs).toBe(
            vulnerableClubsData.vulnerableClubs.length
          )

          // Property: interventionRequiredClubs should match interventionRequired array length
          expect(vulnerableClubsData.interventionRequiredClubs).toBe(
            vulnerableClubsData.interventionRequired.length
          )
        }),
        { numRuns: 100 }
      )
    })

    it('should exclude thriving clubs from both vulnerable and intervention arrays', () => {
      // **Validates: Requirements 3.2, 3.3**
      const computer = new AnalyticsComputer()

      fc.assert(
        fc.property(clubHealthDataArb, clubHealth => {
          const vulnerableClubsData: VulnerableClubsData =
            computer.computeVulnerableClubs('D101', clubHealth)

          // Get all thriving club IDs
          const thrivingIds = new Set(
            clubHealth.allClubs
              .filter(c => c.currentStatus === 'thriving')
              .map(c => c.clubId)
          )

          // Property: No thriving club should appear in vulnerableClubs
          for (const club of vulnerableClubsData.vulnerableClubs) {
            expect(thrivingIds.has(club.clubId)).toBe(false)
          }

          // Property: No thriving club should appear in interventionRequired
          for (const club of vulnerableClubsData.interventionRequired) {
            expect(thrivingIds.has(club.clubId)).toBe(false)
          }
        }),
        { numRuns: 100 }
      )
    })

    it('should handle empty allClubs array', () => {
      // **Validates: Requirements 3.2, 3.3**
      const computer = new AnalyticsComputer()

      const emptyClubHealth: ClubHealthData = {
        allClubs: [],
        thrivingClubs: [],
        vulnerableClubs: [],
        interventionRequiredClubs: [],
      }

      const vulnerableClubsData: VulnerableClubsData =
        computer.computeVulnerableClubs('D101', emptyClubHealth)

      // Property: Empty input should produce empty output arrays
      expect(vulnerableClubsData.vulnerableClubs.length).toBe(0)
      expect(vulnerableClubsData.interventionRequired.length).toBe(0)
      expect(vulnerableClubsData.totalVulnerableClubs).toBe(0)
      expect(vulnerableClubsData.interventionRequiredClubs).toBe(0)
      expect(vulnerableClubsData.districtId).toBe('D101')
      expect(vulnerableClubsData.computedAt).toBeDefined()
    })

    it('should handle all clubs being thriving (no at-risk clubs)', () => {
      // **Validates: Requirements 3.2, 3.3**
      const computer = new AnalyticsComputer()

      fc.assert(
        fc.property(
          uniqueClubTrendListArb(1, 20).map(clubs =>
            clubs.map(club => ({ ...club, currentStatus: 'thriving' as const }))
          ),
          thrivingClubs => {
            const clubHealth: ClubHealthData = {
              allClubs: thrivingClubs,
              thrivingClubs: thrivingClubs,
              vulnerableClubs: [],
              interventionRequiredClubs: [],
            }

            const vulnerableClubsData: VulnerableClubsData =
              computer.computeVulnerableClubs('D101', clubHealth)

            // Property: All thriving clubs should result in empty at-risk arrays
            expect(vulnerableClubsData.vulnerableClubs.length).toBe(0)
            expect(vulnerableClubsData.interventionRequired.length).toBe(0)
            expect(vulnerableClubsData.totalVulnerableClubs).toBe(0)
            expect(vulnerableClubsData.interventionRequiredClubs).toBe(0)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should handle all clubs being vulnerable', () => {
      // **Validates: Requirements 3.2, 3.3**
      const computer = new AnalyticsComputer()

      fc.assert(
        fc.property(
          uniqueClubTrendListArb(1, 20).map(clubs =>
            clubs.map(club => ({
              ...club,
              currentStatus: 'vulnerable' as const,
            }))
          ),
          vulnerableOnlyClubs => {
            const clubHealth: ClubHealthData = {
              allClubs: vulnerableOnlyClubs,
              thrivingClubs: [],
              vulnerableClubs: vulnerableOnlyClubs,
              interventionRequiredClubs: [],
            }

            const vulnerableClubsData: VulnerableClubsData =
              computer.computeVulnerableClubs('D101', clubHealth)

            // Property: All vulnerable clubs should be in vulnerableClubs array
            expect(vulnerableClubsData.vulnerableClubs.length).toBe(
              vulnerableOnlyClubs.length
            )
            expect(vulnerableClubsData.interventionRequired.length).toBe(0)
            expect(vulnerableClubsData.totalVulnerableClubs).toBe(
              vulnerableOnlyClubs.length
            )
            expect(vulnerableClubsData.interventionRequiredClubs).toBe(0)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should handle all clubs requiring intervention', () => {
      // **Validates: Requirements 3.2, 3.3**
      const computer = new AnalyticsComputer()

      fc.assert(
        fc.property(
          uniqueClubTrendListArb(1, 20).map(clubs =>
            clubs.map(club => ({
              ...club,
              currentStatus: 'intervention_required' as const,
            }))
          ),
          interventionOnlyClubs => {
            const clubHealth: ClubHealthData = {
              allClubs: interventionOnlyClubs,
              thrivingClubs: [],
              vulnerableClubs: [],
              interventionRequiredClubs: interventionOnlyClubs,
            }

            const vulnerableClubsData: VulnerableClubsData =
              computer.computeVulnerableClubs('D101', clubHealth)

            // Property: All intervention-required clubs should be in interventionRequired array
            expect(vulnerableClubsData.vulnerableClubs.length).toBe(0)
            expect(vulnerableClubsData.interventionRequired.length).toBe(
              interventionOnlyClubs.length
            )
            expect(vulnerableClubsData.totalVulnerableClubs).toBe(0)
            expect(vulnerableClubsData.interventionRequiredClubs).toBe(
              interventionOnlyClubs.length
            )
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should set correct districtId in the result', () => {
      // **Validates: Requirements 3.2, 3.3**
      const computer = new AnalyticsComputer()

      fc.assert(
        fc.property(
          clubHealthDataArb,
          fc
            .string({ minLength: 1, maxLength: 10 })
            .map(s => `D${s.replace(/[^0-9]/g, '1')}`),
          (clubHealth, districtId) => {
            const vulnerableClubsData: VulnerableClubsData =
              computer.computeVulnerableClubs(districtId, clubHealth)

            // Property: Result should have the correct districtId
            expect(vulnerableClubsData.districtId).toBe(districtId)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should include valid computedAt timestamp', () => {
      // **Validates: Requirements 3.2, 3.3**
      const computer = new AnalyticsComputer()

      fc.assert(
        fc.property(clubHealthDataArb, clubHealth => {
          const beforeCompute = new Date().toISOString()
          const vulnerableClubsData: VulnerableClubsData =
            computer.computeVulnerableClubs('D101', clubHealth)
          const afterCompute = new Date().toISOString()

          // Property: computedAt should be a valid ISO timestamp
          expect(() => new Date(vulnerableClubsData.computedAt)).not.toThrow()

          // Property: computedAt should be between before and after compute times
          expect(vulnerableClubsData.computedAt >= beforeCompute).toBe(true)
          expect(vulnerableClubsData.computedAt <= afterCompute).toBe(true)
        }),
        { numRuns: 100 }
      )
    })

    it('should preserve club data integrity in vulnerable clubs array', () => {
      // **Validates: Requirements 3.2, 3.3**
      const computer = new AnalyticsComputer()

      fc.assert(
        fc.property(clubHealthDataArb, clubHealth => {
          const vulnerableClubsData: VulnerableClubsData =
            computer.computeVulnerableClubs('D101', clubHealth)

          // For each club in vulnerableClubs, verify it matches the original in allClubs
          for (const club of vulnerableClubsData.vulnerableClubs) {
            const originalClub = clubHealth.allClubs.find(
              c => c.clubId === club.clubId
            )
            expect(originalClub).toBeDefined()
            expect(clubTrendsEqual(club, originalClub!)).toBe(true)
          }

          // For each club in interventionRequired, verify it matches the original in allClubs
          for (const club of vulnerableClubsData.interventionRequired) {
            const originalClub = clubHealth.allClubs.find(
              c => c.clubId === club.clubId
            )
            expect(originalClub).toBeDefined()
            expect(clubTrendsEqual(club, originalClub!)).toBe(true)
          }
        }),
        { numRuns: 100 }
      )
    })
  })
})
