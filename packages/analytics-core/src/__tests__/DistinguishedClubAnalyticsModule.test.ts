/**
 * DistinguishedClubAnalyticsModule Unit Tests
 *
 * Tests for threshold classification of distinguished clubs.
 * Per testing.md Section 7.3: "Would 5 well-chosen examples provide equivalent confidence?
 * If yes, prefer the examples." - These boundary tests are clearer than properties.
 *
 * Requirements: 3.2 (Smedley threshold check)
 */

import { describe, it, expect } from 'vitest'
import { DistinguishedClubAnalyticsModule } from '../analytics/DistinguishedClubAnalyticsModule.js'
import type { DistrictStatistics, ClubStatistics } from '../interfaces.js'

/**
 * Helper to create a mock club with specified goals and membership
 * By default, membershipBase equals membershipCount (net growth = 0)
 * to test pure membership thresholds without net growth influence.
 */
function createMockClub(
  clubId: string,
  dcpGoals: number,
  membershipCount: number,
  membershipBase?: number
): ClubStatistics {
  return {
    clubId,
    clubName: `Test Club ${clubId}`,
    divisionId: 'A',
    areaId: 'A1',
    divisionName: 'Division A',
    areaName: 'Area A1',
    membershipCount,
    paymentsCount: membershipCount,
    dcpGoals,
    status: 'Active',
    octoberRenewals: Math.floor(membershipCount * 0.4),
    aprilRenewals: Math.floor(membershipCount * 0.3),
    newMembers: Math.floor(membershipCount * 0.3),
    // Default to membershipCount so net growth = 0 (tests pure membership threshold)
    membershipBase: membershipBase ?? membershipCount,
  }
}

/**
 * Helper to create a mock district statistics snapshot with given clubs
 */
function createMockSnapshot(clubs: ClubStatistics[]): DistrictStatistics {
  const totalMembership = clubs.reduce((sum, c) => sum + c.membershipCount, 0)
  const totalPayments = clubs.reduce((sum, c) => sum + c.paymentsCount, 0)

  return {
    districtId: 'D101',
    snapshotDate: '2024-01-15',
    clubs,
    divisions: [],
    areas: [],
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

describe('DistinguishedClubAnalyticsModule', () => {
  describe('Threshold Classification (Req 3.2)', () => {
    /**
     * Recognition Level Thresholds:
     * | Level       | Goals Required | Members Required |
     * |-------------|---------------|------------------|
     * | Smedley     | 10+           | 25+              |
     * | President's | 9+            | 20+              |
     * | Select      | 7+            | 20+              |
     * | Distinguished | 5+          | 20+              |
     */

    describe('Smedley Distinguished (10+ goals, 25+ members)', () => {
      it('should classify club with exactly 10 goals and 25 members as smedley', () => {
        const module = new DistinguishedClubAnalyticsModule()
        const club = createMockClub('1', 10, 25)
        const snapshot = createMockSnapshot([club])

        const summaries = module.generateDistinguishedClubSummaries([snapshot])

        expect(summaries).toHaveLength(1)
        expect(summaries[0]?.status).toBe('smedley')
      })

      it('should classify club with 10 goals but only 24 members as president (not smedley)', () => {
        const module = new DistinguishedClubAnalyticsModule()
        const club = createMockClub('1', 10, 24)
        const snapshot = createMockSnapshot([club])

        const summaries = module.generateDistinguishedClubSummaries([snapshot])

        expect(summaries).toHaveLength(1)
        expect(summaries[0]?.status).toBe('president')
      })

      it('should classify club with 9 goals and 25 members as president (not smedley)', () => {
        const module = new DistinguishedClubAnalyticsModule()
        const club = createMockClub('1', 9, 25)
        const snapshot = createMockSnapshot([club])

        const summaries = module.generateDistinguishedClubSummaries([snapshot])

        expect(summaries).toHaveLength(1)
        expect(summaries[0]?.status).toBe('president')
      })

      it('should classify club with more than 10 goals and 25+ members as smedley', () => {
        const module = new DistinguishedClubAnalyticsModule()
        const club = createMockClub('1', 12, 30)
        const snapshot = createMockSnapshot([club])

        const summaries = module.generateDistinguishedClubSummaries([snapshot])

        expect(summaries).toHaveLength(1)
        expect(summaries[0]?.status).toBe('smedley')
      })
    })

    describe("President's Distinguished (9+ goals, 20+ members)", () => {
      it('should classify club with exactly 9 goals and 20 members as president', () => {
        const module = new DistinguishedClubAnalyticsModule()
        const club = createMockClub('1', 9, 20)
        const snapshot = createMockSnapshot([club])

        const summaries = module.generateDistinguishedClubSummaries([snapshot])

        expect(summaries).toHaveLength(1)
        expect(summaries[0]?.status).toBe('president')
      })

      it('should classify club with 9 goals but only 19 members as none (not president)', () => {
        const module = new DistinguishedClubAnalyticsModule()
        const club = createMockClub('1', 9, 19)
        const snapshot = createMockSnapshot([club])

        const summaries = module.generateDistinguishedClubSummaries([snapshot])

        // Club doesn't meet minimum membership requirement for any distinguished level
        expect(summaries).toHaveLength(0)
      })

      it('should classify club with 8 goals and 20 members as select (not president)', () => {
        const module = new DistinguishedClubAnalyticsModule()
        const club = createMockClub('1', 8, 20)
        const snapshot = createMockSnapshot([club])

        const summaries = module.generateDistinguishedClubSummaries([snapshot])

        expect(summaries).toHaveLength(1)
        expect(summaries[0]?.status).toBe('select')
      })
    })

    describe('Select Distinguished (7+ goals, 20+ members)', () => {
      it('should classify club with exactly 7 goals and 20 members as select', () => {
        const module = new DistinguishedClubAnalyticsModule()
        const club = createMockClub('1', 7, 20)
        const snapshot = createMockSnapshot([club])

        const summaries = module.generateDistinguishedClubSummaries([snapshot])

        expect(summaries).toHaveLength(1)
        expect(summaries[0]?.status).toBe('select')
      })

      it('should classify club with 6 goals and 20 members as distinguished (not select)', () => {
        const module = new DistinguishedClubAnalyticsModule()
        const club = createMockClub('1', 6, 20)
        const snapshot = createMockSnapshot([club])

        const summaries = module.generateDistinguishedClubSummaries([snapshot])

        expect(summaries).toHaveLength(1)
        expect(summaries[0]?.status).toBe('distinguished')
      })
    })

    describe('Distinguished (5+ goals, 20+ members)', () => {
      it('should classify club with exactly 5 goals and 20 members as distinguished', () => {
        const module = new DistinguishedClubAnalyticsModule()
        const club = createMockClub('1', 5, 20)
        const snapshot = createMockSnapshot([club])

        const summaries = module.generateDistinguishedClubSummaries([snapshot])

        expect(summaries).toHaveLength(1)
        expect(summaries[0]?.status).toBe('distinguished')
      })

      it('should classify club with 4 goals and 20 members as none (not distinguished)', () => {
        const module = new DistinguishedClubAnalyticsModule()
        const club = createMockClub('1', 4, 20)
        const snapshot = createMockSnapshot([club])

        const summaries = module.generateDistinguishedClubSummaries([snapshot])

        // Club doesn't meet minimum goals requirement for any distinguished level
        expect(summaries).toHaveLength(0)
      })

      it('should classify club with 5 goals but only 19 members as none', () => {
        const module = new DistinguishedClubAnalyticsModule()
        const club = createMockClub('1', 5, 19)
        const snapshot = createMockSnapshot([club])

        const summaries = module.generateDistinguishedClubSummaries([snapshot])

        // Club doesn't meet minimum membership requirement
        expect(summaries).toHaveLength(0)
      })
    })

    describe('generateDistinguishedClubCounts threshold verification', () => {
      it('should count smedley club correctly (10 goals, 25 members)', () => {
        const module = new DistinguishedClubAnalyticsModule()
        const club = createMockClub('1', 10, 25)
        const snapshot = createMockSnapshot([club])

        const counts = module.generateDistinguishedClubCounts([snapshot])

        expect(counts.smedley).toBe(1)
        expect(counts.presidents).toBe(0)
        expect(counts.select).toBe(0)
        expect(counts.distinguished).toBe(0)
        expect(counts.total).toBe(1)
      })

      it('should count president club correctly (9 goals, 20 members)', () => {
        const module = new DistinguishedClubAnalyticsModule()
        const club = createMockClub('1', 9, 20)
        const snapshot = createMockSnapshot([club])

        const counts = module.generateDistinguishedClubCounts([snapshot])

        expect(counts.smedley).toBe(0)
        expect(counts.presidents).toBe(1)
        expect(counts.select).toBe(0)
        expect(counts.distinguished).toBe(0)
        expect(counts.total).toBe(1)
      })

      it('should count select club correctly (7 goals, 20 members)', () => {
        const module = new DistinguishedClubAnalyticsModule()
        const club = createMockClub('1', 7, 20)
        const snapshot = createMockSnapshot([club])

        const counts = module.generateDistinguishedClubCounts([snapshot])

        expect(counts.smedley).toBe(0)
        expect(counts.presidents).toBe(0)
        expect(counts.select).toBe(1)
        expect(counts.distinguished).toBe(0)
        expect(counts.total).toBe(1)
      })

      it('should count distinguished club correctly (5 goals, 20 members)', () => {
        const module = new DistinguishedClubAnalyticsModule()
        const club = createMockClub('1', 5, 20)
        const snapshot = createMockSnapshot([club])

        const counts = module.generateDistinguishedClubCounts([snapshot])

        expect(counts.smedley).toBe(0)
        expect(counts.presidents).toBe(0)
        expect(counts.select).toBe(0)
        expect(counts.distinguished).toBe(1)
        expect(counts.total).toBe(1)
      })

      it('should return zero counts for club not meeting any threshold (4 goals, 20 members)', () => {
        const module = new DistinguishedClubAnalyticsModule()
        const club = createMockClub('1', 4, 20)
        const snapshot = createMockSnapshot([club])

        const counts = module.generateDistinguishedClubCounts([snapshot])

        expect(counts.smedley).toBe(0)
        expect(counts.presidents).toBe(0)
        expect(counts.select).toBe(0)
        expect(counts.distinguished).toBe(0)
        expect(counts.total).toBe(0)
      })

      it('should return zero counts for club with insufficient membership (10 goals, 19 members)', () => {
        const module = new DistinguishedClubAnalyticsModule()
        const club = createMockClub('1', 10, 19)
        const snapshot = createMockSnapshot([club])

        const counts = module.generateDistinguishedClubCounts([snapshot])

        expect(counts.smedley).toBe(0)
        expect(counts.presidents).toBe(0)
        expect(counts.select).toBe(0)
        expect(counts.distinguished).toBe(0)
        expect(counts.total).toBe(0)
      })
    })

    describe('Edge cases', () => {
      it('should return empty summaries for empty snapshots', () => {
        const module = new DistinguishedClubAnalyticsModule()

        const summaries = module.generateDistinguishedClubSummaries([])

        expect(summaries).toHaveLength(0)
      })

      it('should return zero counts for empty snapshots', () => {
        const module = new DistinguishedClubAnalyticsModule()

        const counts = module.generateDistinguishedClubCounts([])

        expect(counts.smedley).toBe(0)
        expect(counts.presidents).toBe(0)
        expect(counts.select).toBe(0)
        expect(counts.distinguished).toBe(0)
        expect(counts.total).toBe(0)
      })

      it('should return empty summaries for snapshot with no clubs', () => {
        const module = new DistinguishedClubAnalyticsModule()
        const snapshot = createMockSnapshot([])

        const summaries = module.generateDistinguishedClubSummaries([snapshot])

        expect(summaries).toHaveLength(0)
      })

      it('should return zero counts for snapshot with no clubs', () => {
        const module = new DistinguishedClubAnalyticsModule()
        const snapshot = createMockSnapshot([])

        const counts = module.generateDistinguishedClubCounts([snapshot])

        expect(counts.smedley).toBe(0)
        expect(counts.presidents).toBe(0)
        expect(counts.select).toBe(0)
        expect(counts.distinguished).toBe(0)
        expect(counts.total).toBe(0)
      })

      it('should use the latest snapshot when multiple snapshots provided', () => {
        const module = new DistinguishedClubAnalyticsModule()

        // First snapshot: club has 5 goals (distinguished)
        const snapshot1: DistrictStatistics = {
          ...createMockSnapshot([createMockClub('1', 5, 20)]),
          snapshotDate: '2024-01-01',
        }

        // Second snapshot: club has 10 goals and 25 members (smedley)
        const snapshot2: DistrictStatistics = {
          ...createMockSnapshot([createMockClub('1', 10, 25)]),
          snapshotDate: '2024-02-01',
        }

        const summaries = module.generateDistinguishedClubSummaries([
          snapshot1,
          snapshot2,
        ])

        expect(summaries).toHaveLength(1)
        expect(summaries[0]?.status).toBe('smedley')
      })
    })
  })

  describe('No Double Counting (Req 3.3)', () => {
    /**
     * Per Requirement 3.3: WHEN counting distinguished clubs, THE DistinguishedClubAnalyticsModule
     * SHALL ensure each club is counted in exactly one category (the highest achieved level)
     *
     * This ensures clubs are not double-counted across multiple recognition levels.
     * A club that qualifies for multiple levels should only appear in the highest level.
     */

    it('should count club qualifying for smedley ONLY in smedley count (not in presidents/select/distinguished)', () => {
      const module = new DistinguishedClubAnalyticsModule()
      // Club with 10+ goals and 25+ members qualifies for ALL levels, but should only count as smedley
      const smedleyClub = createMockClub('1', 10, 25)
      const snapshot = createMockSnapshot([smedleyClub])

      const counts = module.generateDistinguishedClubCounts([snapshot])

      // Should appear ONLY in smedley
      expect(counts.smedley).toBe(1)
      expect(counts.presidents).toBe(0)
      expect(counts.select).toBe(0)
      expect(counts.distinguished).toBe(0)
      // Total should equal exactly 1 (no double counting)
      expect(counts.total).toBe(1)
    })

    it('should count club qualifying for president (but not smedley) ONLY in presidents count', () => {
      const module = new DistinguishedClubAnalyticsModule()
      // Club with 9 goals and 20 members qualifies for president, select, and distinguished
      // but NOT smedley (needs 10+ goals AND 25+ members)
      const presidentClub = createMockClub('1', 9, 20)
      const snapshot = createMockSnapshot([presidentClub])

      const counts = module.generateDistinguishedClubCounts([snapshot])

      // Should appear ONLY in presidents
      expect(counts.smedley).toBe(0)
      expect(counts.presidents).toBe(1)
      expect(counts.select).toBe(0)
      expect(counts.distinguished).toBe(0)
      // Total should equal exactly 1 (no double counting)
      expect(counts.total).toBe(1)
    })

    it('should produce correct exclusive counts for mixed set of clubs at different levels', () => {
      const module = new DistinguishedClubAnalyticsModule()

      // Create clubs at each recognition level
      const smedleyClub = createMockClub('1', 10, 25) // Smedley: 10+ goals, 25+ members
      const presidentClub = createMockClub('2', 9, 20) // President: 9+ goals, 20+ members
      const selectClub = createMockClub('3', 7, 20) // Select: 7+ goals, 20+ members
      const distinguishedClub = createMockClub('4', 5, 20) // Distinguished: 5+ goals, 20+ members
      const nonDistinguishedClub = createMockClub('5', 4, 20) // None: below threshold

      const snapshot = createMockSnapshot([
        smedleyClub,
        presidentClub,
        selectClub,
        distinguishedClub,
        nonDistinguishedClub,
      ])

      const counts = module.generateDistinguishedClubCounts([snapshot])

      // Each club should be counted in exactly one category
      expect(counts.smedley).toBe(1)
      expect(counts.presidents).toBe(1)
      expect(counts.select).toBe(1)
      expect(counts.distinguished).toBe(1)

      // Total should equal sum of individual counts (no double counting)
      expect(counts.total).toBe(4)
      expect(counts.total).toBe(
        counts.smedley +
          counts.presidents +
          counts.select +
          counts.distinguished
      )
    })

    it('should count multiple clubs at the same level correctly without double counting', () => {
      const module = new DistinguishedClubAnalyticsModule()

      // Multiple smedley clubs
      const smedleyClub1 = createMockClub('1', 10, 25)
      const smedleyClub2 = createMockClub('2', 12, 30)
      // Multiple president clubs
      const presidentClub1 = createMockClub('3', 9, 20)
      const presidentClub2 = createMockClub('4', 9, 24) // 24 members, not 25, so president not smedley

      const snapshot = createMockSnapshot([
        smedleyClub1,
        smedleyClub2,
        presidentClub1,
        presidentClub2,
      ])

      const counts = module.generateDistinguishedClubCounts([snapshot])

      expect(counts.smedley).toBe(2)
      expect(counts.presidents).toBe(2)
      expect(counts.select).toBe(0)
      expect(counts.distinguished).toBe(0)
      expect(counts.total).toBe(4)
      expect(counts.total).toBe(
        counts.smedley +
          counts.presidents +
          counts.select +
          counts.distinguished
      )
    })
  })
})
