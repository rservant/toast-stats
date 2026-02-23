/**
 * Tests for DCP Projections utility (#6)
 *
 * Tests the per-club DCP projection calculations:
 * - Gap computation for each distinguished tier
 * - Projected membership using April renewals
 * - "Closest tier" label generation
 * - Edge cases (already at tier, net growth alternative path)
 */

import { describe, it, expect } from 'vitest'
import {
  calculateClubProjection,
  calculateClubProjections,
  getClosestTierLabel,
  type ClubDCPProjection,
} from '../dcpProjections'
import type { ClubTrend } from '../../hooks/useDistrictAnalytics'

// Helper to create a minimal ClubTrend with sensible defaults
function makeClub(
  overrides: Partial<ClubTrend> & { clubId: string }
): ClubTrend {
  return {
    clubName: `Club ${overrides.clubId}`,
    divisionId: 'A',
    divisionName: 'Division A',
    areaId: 'A1',
    areaName: 'Area A1',
    membershipTrend: overrides.membershipTrend ?? [
      {
        date: '2025-01-01',
        count: overrides.membershipTrend?.[0]?.count ?? 20,
      },
    ],
    dcpGoalsTrend: overrides.dcpGoalsTrend ?? [
      { date: '2025-01-01', goalsAchieved: 0 },
    ],
    currentStatus: overrides.currentStatus ?? 'thriving',
    riskFactors: overrides.riskFactors ?? [],
    distinguishedLevel: overrides.distinguishedLevel ?? 'NotDistinguished',
    octoberRenewals: overrides.octoberRenewals ?? 0,
    aprilRenewals: overrides.aprilRenewals,
    newMembers: overrides.newMembers ?? 0,
    clubStatus: overrides.clubStatus ?? 'Active',
    ...overrides,
  }
}

describe('DCP Projections Utility (#6)', () => {
  describe('calculateClubProjection', () => {
    it('should compute gap to Distinguished for a club with 4 goals and 20 members', () => {
      const club = makeClub({
        clubId: '1',
        dcpGoalsTrend: [{ date: '2025-01-01', goalsAchieved: 4 }],
        membershipTrend: [{ date: '2025-01-01', count: 20 }],
      })

      const projection = calculateClubProjection(club)

      expect(projection.currentGoals).toBe(4)
      expect(projection.currentMembers).toBe(20)
      expect(projection.gapToDistinguished.goals).toBe(1) // need 5, have 4
      expect(projection.gapToDistinguished.members).toBe(0) // 20 >= 20
    })

    it('should return zero gaps for a Smedley club (all thresholds met)', () => {
      const club = makeClub({
        clubId: '2',
        dcpGoalsTrend: [{ date: '2025-01-01', goalsAchieved: 10 }],
        membershipTrend: [{ date: '2025-01-01', count: 30 }],
        distinguishedLevel: 'Smedley',
      })

      const projection = calculateClubProjection(club)

      expect(projection.gapToDistinguished).toEqual({ goals: 0, members: 0 })
      expect(projection.gapToSelect).toEqual({ goals: 0, members: 0 })
      expect(projection.gapToPresident).toEqual({ goals: 0, members: 0 })
      expect(projection.gapToSmedley).toEqual({ goals: 0, members: 0 })
      expect(projection.currentLevel).toBe('Smedley')
    })

    it('should compute gap to Select when club has 6 goals and 22 members', () => {
      const club = makeClub({
        clubId: '3',
        dcpGoalsTrend: [{ date: '2025-01-01', goalsAchieved: 6 }],
        membershipTrend: [{ date: '2025-01-01', count: 22 }],
        distinguishedLevel: 'Distinguished',
      })

      const projection = calculateClubProjection(club)

      // Already Distinguished, need Select (7 goals)
      expect(projection.gapToDistinguished).toEqual({ goals: 0, members: 0 })
      expect(projection.gapToSelect.goals).toBe(1) // need 7, have 6
      expect(projection.gapToSelect.members).toBe(0) // 22 >= 20
    })

    it('should project membership using aprilRenewals when available', () => {
      const club = makeClub({
        clubId: '4',
        membershipTrend: [{ date: '2025-01-01', count: 15 }],
        dcpGoalsTrend: [{ date: '2025-01-01', goalsAchieved: 5 }],
        aprilRenewals: 8,
      })

      const projection = calculateClubProjection(club)

      // projectedMembers should factor in April renewals
      expect(projection.aprilRenewals).toBe(8)
      expect(projection.projectedMembers).toBeGreaterThan(
        projection.currentMembers
      )
    })

    it('should use current members as projected when aprilRenewals is missing', () => {
      const club = makeClub({
        clubId: '5',
        membershipTrend: [{ date: '2025-01-01', count: 18 }],
        dcpGoalsTrend: [{ date: '2025-01-01', goalsAchieved: 3 }],
        aprilRenewals: undefined,
      })

      const projection = calculateClubProjection(club)

      expect(projection.aprilRenewals).toBeNull()
      expect(projection.projectedMembers).toBe(18)
    })

    it('should handle club with 0 goals and low membership', () => {
      const club = makeClub({
        clubId: '6',
        dcpGoalsTrend: [{ date: '2025-01-01', goalsAchieved: 0 }],
        membershipTrend: [{ date: '2025-01-01', count: 8 }],
      })

      const projection = calculateClubProjection(club)

      expect(projection.gapToDistinguished.goals).toBe(5)
      expect(projection.gapToDistinguished.members).toBe(12) // need 20, have 8
      expect(projection.gapToSmedley.goals).toBe(10)
      expect(projection.gapToSmedley.members).toBe(17) // need 25, have 8
    })

    it('should handle empty dcpGoalsTrend', () => {
      const club = makeClub({
        clubId: '7',
        dcpGoalsTrend: [],
        membershipTrend: [{ date: '2025-01-01', count: 20 }],
      })

      const projection = calculateClubProjection(club)

      expect(projection.currentGoals).toBe(0)
    })

    it('should handle empty membershipTrend', () => {
      const club = makeClub({
        clubId: '8',
        dcpGoalsTrend: [{ date: '2025-01-01', goalsAchieved: 5 }],
        membershipTrend: [],
      })

      const projection = calculateClubProjection(club)

      expect(projection.currentMembers).toBe(0)
    })
  })

  describe('getClosestTierLabel', () => {
    it('should return "1 goal from Select" for club needing 1 goal', () => {
      const projection: ClubDCPProjection = {
        clubId: '1',
        clubName: 'Test Club',
        division: 'A',
        area: 'A1',
        currentGoals: 6,
        currentMembers: 22,
        membershipBase: 20,
        aprilRenewals: null,
        projectedMembers: 22,
        currentLevel: 'Distinguished',
        projectedLevel: 'Distinguished',
        gapToDistinguished: { goals: 0, members: 0 },
        gapToSelect: { goals: 1, members: 0 },
        gapToPresident: { goals: 3, members: 0 },
        gapToSmedley: { goals: 4, members: 3 },
        closestTierAbove: null,
      }

      const label = getClosestTierLabel(projection)

      expect(label).toContain('Select')
      expect(label).toContain('1')
    })

    it('should return null for a Smedley club (highest tier)', () => {
      const projection: ClubDCPProjection = {
        clubId: '2',
        clubName: 'Top Club',
        division: 'B',
        area: 'B1',
        currentGoals: 10,
        currentMembers: 30,
        membershipBase: 25,
        aprilRenewals: null,
        projectedMembers: 30,
        currentLevel: 'Smedley',
        projectedLevel: 'Smedley',
        gapToDistinguished: { goals: 0, members: 0 },
        gapToSelect: { goals: 0, members: 0 },
        gapToPresident: { goals: 0, members: 0 },
        gapToSmedley: { goals: 0, members: 0 },
        closestTierAbove: null,
      }

      const label = getClosestTierLabel(projection)

      expect(label).toBeNull()
    })
  })

  describe('calculateClubProjections (batch)', () => {
    it('should process multiple clubs and return projections for each', () => {
      const clubs = [
        makeClub({
          clubId: '1',
          dcpGoalsTrend: [{ date: '2025-01-01', goalsAchieved: 4 }],
          membershipTrend: [{ date: '2025-01-01', count: 20 }],
        }),
        makeClub({
          clubId: '2',
          dcpGoalsTrend: [{ date: '2025-01-01', goalsAchieved: 10 }],
          membershipTrend: [{ date: '2025-01-01', count: 30 }],
        }),
      ]

      const projections = calculateClubProjections(clubs)

      expect(projections).toHaveLength(2)
      expect(projections[0]!.clubId).toBe('1')
      expect(projections[1]!.clubId).toBe('2')
    })

    it('should handle empty club list', () => {
      const projections = calculateClubProjections([])
      expect(projections).toEqual([])
    })
  })
})
