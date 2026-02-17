/**
 * Property-Based Tests for Club Categorization Partition
 *
 * @pbt-justification Warranted per .kiro/steering/testing.md criteria:
 *   - Mathematical invariant: partition completeness (every club categorized, no overlaps)
 *   - Complex input space: generated club data across varied statuses and metrics
 *
 * Feature: precomputed-analytics-alignment
 * Property 6: Club categorization partitions allClubs
 *
 * *For any* computed DistrictAnalytics, the union of thrivingClubs,
 * vulnerableClubs, and interventionRequiredClubs should equal allClubs
 * (no club is missing, no club is duplicated, every club is in exactly
 * one category).
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { ClubHealthAnalyticsModule } from './ClubHealthAnalyticsModule.js'
import type { DistrictStatistics, ClubStatistics } from '../interfaces.js'
import type { ClubHealthData, ClubTrend } from '../types.js'

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
 * Generate a valid club status.
 */
const clubStatusArb: fc.Arbitrary<string | undefined> = fc.oneof(
  fc.constant('Active'),
  fc.constant('Suspended'),
  fc.constant('Low'),
  fc.constant('Ineligible'),
  fc.constant(undefined)
)

/**
 * Generate a ClubStatistics object with various health indicators.
 *
 * The generator creates clubs with a wide range of membership counts,
 * payment counts, and DCP goals to exercise all categorization paths:
 * - Thriving: membership >= 20 AND DCP checkpoint met
 * - Vulnerable: some requirements not met
 * - Intervention Required: membership < 12 AND net growth < 3
 */
const clubStatisticsArb: fc.Arbitrary<ClubStatistics> = fc.record({
  clubId: clubIdArb,
  clubName: clubNameArb,
  divisionId: divisionIdArb,
  divisionName: divisionIdArb.map(id => `Division ${id}`),
  areaId: areaIdArb,
  areaName: areaIdArb.map(id => `Area ${id}`),
  // Membership count: 5-50 to cover intervention (<12), vulnerable (12-19), thriving (20+)
  membershipCount: fc.integer({ min: 5, max: 50 }),
  // Payments count: 0 to membership count
  paymentsCount: fc.integer({ min: 0, max: 50 }),
  // DCP goals: 0-10 to cover all distinguished levels
  dcpGoals: fc.integer({ min: 0, max: 10 }),
  status: fc.constant('Active'),
  octoberRenewals: fc.integer({ min: 0, max: 20 }),
  aprilRenewals: fc.integer({ min: 0, max: 20 }),
  newMembers: fc.integer({ min: 0, max: 10 }),
  membershipBase: fc.integer({ min: 5, max: 40 }),
  clubStatus: clubStatusArb,
})

/**
 * Generate a unique list of ClubStatistics with distinct club IDs.
 * Uses a counter-based approach to ensure uniqueness.
 */
const uniqueClubListArb = (
  minClubs: number,
  maxClubs: number
): fc.Arbitrary<ClubStatistics[]> =>
  fc
    .array(clubStatisticsArb, { minLength: minClubs, maxLength: maxClubs })
    .map(clubs => {
      // Ensure unique club IDs by appending index
      return clubs.map((club, index) => ({
        ...club,
        clubId: `${club.clubId}-${index}`,
      }))
    })

/**
 * Generate a valid snapshot date (YYYY-MM-DD format).
 * Uses integer-based generation to avoid invalid date issues.
 */
const snapshotDateArb: fc.Arbitrary<string> = fc
  .integer({
    min: 0,
    max: 364,
  })
  .map(dayOffset => {
    const baseDate = new Date('2024-01-01')
    baseDate.setDate(baseDate.getDate() + dayOffset)
    return baseDate.toISOString().split('T')[0] ?? '2024-01-15'
  })

/**
 * Generate a DistrictStatistics snapshot with clubs.
 */
const districtStatisticsArb = (
  clubs: ClubStatistics[],
  date: string
): DistrictStatistics => {
  const totalMembership = clubs.reduce((sum, c) => sum + c.membershipCount, 0)
  const totalPayments = clubs.reduce((sum, c) => sum + c.paymentsCount, 0)

  return {
    districtId: 'D101',
    snapshotDate: date,
    clubs,
    divisions: [],
    areas: [],
    divisionPerformance: [],
    clubPerformance: [],
    districtPerformance: [],
    totals: {
      totalClubs: clubs.length,
      totalMembership,
      totalPayments,
      distinguishedClubs: clubs.filter(c => c.dcpGoals >= 5).length,
      selectDistinguishedClubs: clubs.filter(c => c.dcpGoals >= 7).length,
      presidentDistinguishedClubs: clubs.filter(c => c.dcpGoals >= 9).length,
    },
  }
}

/**
 * Generate a sequence of snapshots for the same clubs with varying data.
 * This simulates historical data where membership and goals change over time.
 */
const snapshotSequenceArb: fc.Arbitrary<DistrictStatistics[]> = fc
  .tuple(uniqueClubListArb(1, 20), fc.integer({ min: 1, max: 5 }))
  .chain(([baseClubs, numSnapshots]) => {
    // Generate dates for each snapshot
    const dates: string[] = []
    const baseDate = new Date('2024-01-01')
    for (let i = 0; i < numSnapshots; i++) {
      const date = new Date(baseDate)
      date.setMonth(date.getMonth() + i)
      dates.push(date.toISOString().split('T')[0] ?? '2024-01-15')
    }

    // Generate membership variations for each snapshot
    return fc
      .array(fc.integer({ min: -5, max: 5 }), {
        minLength: numSnapshots,
        maxLength: numSnapshots,
      })
      .map(membershipDeltas => {
        return dates.map((date, snapshotIndex) => {
          const clubs = baseClubs.map(club => ({
            ...club,
            // Vary membership slightly across snapshots
            membershipCount: Math.max(
              5,
              club.membershipCount + (membershipDeltas[snapshotIndex] ?? 0)
            ),
            // Vary DCP goals slightly (can only increase)
            dcpGoals: Math.min(
              10,
              club.dcpGoals + Math.floor(snapshotIndex / 2)
            ),
          }))
          return districtStatisticsArb(clubs, date)
        })
      })
  })

// ========== Helper Functions ==========

/**
 * Extract club IDs from a ClubTrend array.
 */
function getClubIds(clubs: ClubTrend[]): Set<string> {
  return new Set(clubs.map(c => c.clubId))
}

/**
 * Check if two sets are equal.
 */
function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false
  for (const item of a) {
    if (!b.has(item)) return false
  }
  return true
}

// ========== Property Tests ==========

describe('Club Categorization Partition Property Tests', () => {
  /**
   * Feature: precomputed-analytics-alignment
   * Property 6: Club categorization partitions allClubs
   *
   * *For any* computed DistrictAnalytics, the union of thrivingClubs,
   * vulnerableClubs, and interventionRequiredClubs should equal allClubs
   * (no club is missing, no club is duplicated, every club is in exactly
   * one category).
   *
   * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
   */
  describe('Property 6: Club categorization partitions allClubs', () => {
    it('should have union of categories equal to allClubs (no missing clubs)', () => {
      // **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
      const module = new ClubHealthAnalyticsModule()

      fc.assert(
        fc.property(snapshotSequenceArb, snapshots => {
          const result: ClubHealthData =
            module.generateClubHealthData(snapshots)

          // Get all club IDs from allClubs
          const allClubIds = getClubIds(result.allClubs)

          // Get club IDs from each category
          const thrivingIds = getClubIds(result.thrivingClubs)
          const vulnerableIds = getClubIds(result.vulnerableClubs)
          const interventionIds = getClubIds(result.interventionRequiredClubs)

          // Union of all categories
          const unionIds = new Set([
            ...thrivingIds,
            ...vulnerableIds,
            ...interventionIds,
          ])

          // Property: Union of categories equals allClubs
          expect(setsEqual(unionIds, allClubIds)).toBe(true)
        }),
        { numRuns: 100 }
      )
    })

    it('should have no club appearing in multiple categories (no duplicates)', () => {
      // **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
      const module = new ClubHealthAnalyticsModule()

      fc.assert(
        fc.property(snapshotSequenceArb, snapshots => {
          const result: ClubHealthData =
            module.generateClubHealthData(snapshots)

          // Get club IDs from each category
          const thrivingIds = getClubIds(result.thrivingClubs)
          const vulnerableIds = getClubIds(result.vulnerableClubs)
          const interventionIds = getClubIds(result.interventionRequiredClubs)

          // Check for intersections between categories
          // Thriving ∩ Vulnerable = ∅
          for (const id of thrivingIds) {
            expect(vulnerableIds.has(id)).toBe(false)
          }

          // Thriving ∩ Intervention = ∅
          for (const id of thrivingIds) {
            expect(interventionIds.has(id)).toBe(false)
          }

          // Vulnerable ∩ Intervention = ∅
          for (const id of vulnerableIds) {
            expect(interventionIds.has(id)).toBe(false)
          }
        }),
        { numRuns: 100 }
      )
    })

    it('should have every club in exactly one category', () => {
      // **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
      const module = new ClubHealthAnalyticsModule()

      fc.assert(
        fc.property(snapshotSequenceArb, snapshots => {
          const result: ClubHealthData =
            module.generateClubHealthData(snapshots)

          // For each club in allClubs, count how many categories it appears in
          for (const club of result.allClubs) {
            let categoryCount = 0

            if (result.thrivingClubs.some(c => c.clubId === club.clubId)) {
              categoryCount++
            }
            if (result.vulnerableClubs.some(c => c.clubId === club.clubId)) {
              categoryCount++
            }
            if (
              result.interventionRequiredClubs.some(
                c => c.clubId === club.clubId
              )
            ) {
              categoryCount++
            }

            // Property: Each club appears in exactly one category
            expect(categoryCount).toBe(1)
          }
        }),
        { numRuns: 100 }
      )
    })

    it('should have category counts sum to allClubs count', () => {
      // **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
      const module = new ClubHealthAnalyticsModule()

      fc.assert(
        fc.property(snapshotSequenceArb, snapshots => {
          const result: ClubHealthData =
            module.generateClubHealthData(snapshots)

          const totalCategorized =
            result.thrivingClubs.length +
            result.vulnerableClubs.length +
            result.interventionRequiredClubs.length

          // Property: Sum of category sizes equals allClubs size
          expect(totalCategorized).toBe(result.allClubs.length)
        }),
        { numRuns: 100 }
      )
    })

    it('should maintain partition property with empty snapshots', () => {
      // **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
      const module = new ClubHealthAnalyticsModule()

      const result: ClubHealthData = module.generateClubHealthData([])

      // Empty input should produce empty output
      expect(result.allClubs).toHaveLength(0)
      expect(result.thrivingClubs).toHaveLength(0)
      expect(result.vulnerableClubs).toHaveLength(0)
      expect(result.interventionRequiredClubs).toHaveLength(0)
    })

    it('should maintain partition property with single club', () => {
      // **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
      const module = new ClubHealthAnalyticsModule()

      fc.assert(
        fc.property(clubStatisticsArb, snapshotDateArb, (club, date) => {
          const snapshot = districtStatisticsArb([club], date)
          const result: ClubHealthData = module.generateClubHealthData([
            snapshot,
          ])

          // Single club should be in exactly one category
          expect(result.allClubs).toHaveLength(1)

          const totalCategorized =
            result.thrivingClubs.length +
            result.vulnerableClubs.length +
            result.interventionRequiredClubs.length

          expect(totalCategorized).toBe(1)
        }),
        { numRuns: 100 }
      )
    })

    it('should have currentStatus match category placement', () => {
      // **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
      const module = new ClubHealthAnalyticsModule()

      fc.assert(
        fc.property(snapshotSequenceArb, snapshots => {
          const result: ClubHealthData =
            module.generateClubHealthData(snapshots)

          // Verify thriving clubs have 'thriving' status
          for (const club of result.thrivingClubs) {
            expect(club.currentStatus).toBe('thriving')
          }

          // Verify vulnerable clubs have 'vulnerable' status
          for (const club of result.vulnerableClubs) {
            expect(club.currentStatus).toBe('vulnerable')
          }

          // Verify intervention clubs have 'intervention-required' status
          for (const club of result.interventionRequiredClubs) {
            expect(club.currentStatus).toBe('intervention-required')
          }
        }),
        { numRuns: 100 }
      )
    })
  })
})
