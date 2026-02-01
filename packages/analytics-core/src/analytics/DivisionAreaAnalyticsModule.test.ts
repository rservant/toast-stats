/**
 * DivisionAreaAnalyticsModule Unit Tests
 *
 * Tests for division and area performance analytics.
 * Per testing.md Section 7.3: "Would 5 well-chosen examples provide equivalent confidence?
 * If yes, prefer the examples." - These boundary tests are clearer than properties.
 *
 * Requirements: 4.1, 5.1, 5.2, 5.3
 */

import { describe, it, expect } from 'vitest'
import { DivisionAreaAnalyticsModule } from './DivisionAreaAnalyticsModule.js'
import type { DistrictStatistics, ClubStatistics } from '../interfaces.js'

/**
 * Helper to create a mock club with specified properties
 */
function createMockClub(
  clubId: string,
  divisionId: string,
  areaId: string,
  membershipCount: number,
  dcpGoals: number
): ClubStatistics {
  return {
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
    octoberRenewals: Math.floor(membershipCount * 0.4),
    aprilRenewals: Math.floor(membershipCount * 0.3),
    newMembers: Math.floor(membershipCount * 0.3),
    membershipBase: membershipCount,
  }
}

/**
 * Helper to create a mock district statistics snapshot
 */
function createMockSnapshot(
  clubs: ClubStatistics[],
  snapshotDate = '2024-01-15'
): DistrictStatistics {
  const totalMembership = clubs.reduce((sum, c) => sum + c.membershipCount, 0)
  const totalPayments = clubs.reduce((sum, c) => sum + c.paymentsCount, 0)

  return {
    districtId: 'D101',
    snapshotDate,
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

describe('DivisionAreaAnalyticsModule', () => {
  describe('generateDivisionRankings', () => {
    it('should return empty array for empty snapshots', () => {
      const module = new DivisionAreaAnalyticsModule()
      const rankings = module.generateDivisionRankings([])
      expect(rankings).toHaveLength(0)
    })

    it('should return empty array for snapshot with no clubs', () => {
      const module = new DivisionAreaAnalyticsModule()
      const snapshot = createMockSnapshot([])
      const rankings = module.generateDivisionRankings([snapshot])
      expect(rankings).toHaveLength(0)
    })

    it('should rank divisions by total DCP goals (primary)', () => {
      const module = new DivisionAreaAnalyticsModule()
      const clubs = [
        createMockClub('1', 'A', 'A1', 20, 8), // Division A: 8 goals
        createMockClub('2', 'A', 'A2', 20, 7), // Division A: +7 = 15 goals
        createMockClub('3', 'B', 'B1', 20, 5), // Division B: 5 goals
        createMockClub('4', 'B', 'B2', 20, 3), // Division B: +3 = 8 goals
      ]
      const snapshot = createMockSnapshot(clubs)

      const rankings = module.generateDivisionRankings([snapshot])

      expect(rankings).toHaveLength(2)
      expect(rankings[0]?.divisionId).toBe('A')
      expect(rankings[0]?.rank).toBe(1)
      expect(rankings[1]?.divisionId).toBe('B')
      expect(rankings[1]?.rank).toBe(2)
    })

    it('should use average club health as secondary sort when DCP goals are equal', () => {
      const module = new DivisionAreaAnalyticsModule()
      const clubs = [
        // Division A: 10 goals total, clubs with low membership (unhealthy)
        createMockClub('1', 'A', 'A1', 10, 5), // membership < 12 = critical
        createMockClub('2', 'A', 'A2', 10, 5),
        // Division B: 10 goals total, clubs with high membership (healthy)
        createMockClub('3', 'B', 'B1', 20, 5), // membership >= 12, goals >= 1 = healthy
        createMockClub('4', 'B', 'B2', 20, 5),
      ]
      const snapshot = createMockSnapshot(clubs)

      const rankings = module.generateDivisionRankings([snapshot])

      expect(rankings).toHaveLength(2)
      // Division B should rank higher due to better club health
      expect(rankings[0]?.divisionId).toBe('B')
      expect(rankings[1]?.divisionId).toBe('A')
    })

    it('should include correct club count and membership total', () => {
      const module = new DivisionAreaAnalyticsModule()
      const clubs = [
        createMockClub('1', 'A', 'A1', 25, 5),
        createMockClub('2', 'A', 'A2', 30, 3),
        createMockClub('3', 'B', 'B1', 15, 2),
      ]
      const snapshot = createMockSnapshot(clubs)

      const rankings = module.generateDivisionRankings([snapshot])

      const divisionA = rankings.find(r => r.divisionId === 'A')
      expect(divisionA?.clubCount).toBe(2)
      expect(divisionA?.membershipTotal).toBe(55)

      const divisionB = rankings.find(r => r.divisionId === 'B')
      expect(divisionB?.clubCount).toBe(1)
      expect(divisionB?.membershipTotal).toBe(15)
    })
  })

  describe('generateTopPerformingAreas', () => {
    it('should return empty array for empty snapshots', () => {
      const module = new DivisionAreaAnalyticsModule()
      const areas = module.generateTopPerformingAreas([])
      expect(areas).toHaveLength(0)
    })

    it('should return empty array for snapshot with no clubs', () => {
      const module = new DivisionAreaAnalyticsModule()
      const snapshot = createMockSnapshot([])
      const areas = module.generateTopPerformingAreas([snapshot])
      expect(areas).toHaveLength(0)
    })

    it('should rank areas by normalized score (health + DCP)', () => {
      const module = new DivisionAreaAnalyticsModule()
      const clubs = [
        // Area A1: high health (20 members, 8 goals)
        createMockClub('1', 'A', 'A1', 20, 8),
        // Area A2: low health (10 members, 2 goals)
        createMockClub('2', 'A', 'A2', 10, 2),
      ]
      const snapshot = createMockSnapshot(clubs)

      const areas = module.generateTopPerformingAreas([snapshot])

      expect(areas).toHaveLength(2)
      expect(areas[0]?.areaId).toBe('A1')
      expect(areas[1]?.areaId).toBe('A2')
    })

    it('should respect the limit parameter', () => {
      const module = new DivisionAreaAnalyticsModule()
      const clubs = [
        createMockClub('1', 'A', 'A1', 20, 8),
        createMockClub('2', 'A', 'A2', 20, 7),
        createMockClub('3', 'B', 'B1', 20, 6),
        createMockClub('4', 'B', 'B2', 20, 5),
        createMockClub('5', 'C', 'C1', 20, 4),
      ]
      const snapshot = createMockSnapshot(clubs)

      const areas = module.generateTopPerformingAreas([snapshot], 3)

      expect(areas).toHaveLength(3)
    })

    it('should include correct division ID for each area', () => {
      const module = new DivisionAreaAnalyticsModule()
      const clubs = [
        createMockClub('1', 'A', 'A1', 20, 5),
        createMockClub('2', 'B', 'B1', 20, 5),
      ]
      const snapshot = createMockSnapshot(clubs)

      const areas = module.generateTopPerformingAreas([snapshot])

      const areaA1 = areas.find(a => a.areaId === 'A1')
      expect(areaA1?.divisionId).toBe('A')

      const areaB1 = areas.find(a => a.areaId === 'B1')
      expect(areaB1?.divisionId).toBe('B')
    })
  })

  describe('compareDivisions (DivisionAnalytics)', () => {
    it('should return empty array for empty snapshots', () => {
      const module = new DivisionAreaAnalyticsModule()
      const divisions = module.compareDivisions([])
      expect(divisions).toHaveLength(0)
    })

    it('should calculate average club health correctly', () => {
      const module = new DivisionAreaAnalyticsModule()
      const clubs = [
        // All healthy clubs (membership >= 12, goals >= 1)
        createMockClub('1', 'A', 'A1', 20, 5),
        createMockClub('2', 'A', 'A2', 20, 3),
      ]
      const snapshot = createMockSnapshot(clubs)

      const divisions = module.compareDivisions([snapshot])

      expect(divisions).toHaveLength(1)
      expect(divisions[0]?.averageClubHealth).toBe(1) // All healthy = 1.0
    })

    it('should calculate mixed health scores correctly', () => {
      const module = new DivisionAreaAnalyticsModule()
      const clubs = [
        createMockClub('1', 'A', 'A1', 20, 5), // Healthy (1.0)
        createMockClub('2', 'A', 'A2', 15, 0), // At-risk (0.5)
        createMockClub('3', 'A', 'A3', 10, 3), // Critical (0.0)
      ]
      const snapshot = createMockSnapshot(clubs)

      const divisions = module.compareDivisions([snapshot])

      expect(divisions).toHaveLength(1)
      // Average: (1.0 + 0.5 + 0.0) / 3 = 0.5
      expect(divisions[0]?.averageClubHealth).toBe(0.5)
    })

    it('should detect improving trend when DCP goals increase by more than 10%', () => {
      const module = new DivisionAreaAnalyticsModule()

      const snapshot1 = createMockSnapshot(
        [createMockClub('1', 'A', 'A1', 20, 5)],
        '2024-01-01'
      )
      const snapshot2 = createMockSnapshot(
        [createMockClub('1', 'A', 'A1', 20, 7)], // 40% increase
        '2024-02-01'
      )

      const divisions = module.compareDivisions([snapshot1, snapshot2])

      expect(divisions).toHaveLength(1)
      expect(divisions[0]?.trend).toBe('improving')
    })

    it('should detect declining trend when DCP goals decrease by more than 10%', () => {
      const module = new DivisionAreaAnalyticsModule()

      const snapshot1 = createMockSnapshot(
        [createMockClub('1', 'A', 'A1', 20, 10)],
        '2024-01-01'
      )
      const snapshot2 = createMockSnapshot(
        [createMockClub('1', 'A', 'A1', 20, 5)], // 50% decrease
        '2024-02-01'
      )

      const divisions = module.compareDivisions([snapshot1, snapshot2])

      expect(divisions).toHaveLength(1)
      expect(divisions[0]?.trend).toBe('declining')
    })

    it('should detect stable trend when DCP goals change by less than 10%', () => {
      const module = new DivisionAreaAnalyticsModule()

      const snapshot1 = createMockSnapshot(
        [createMockClub('1', 'A', 'A1', 20, 10)],
        '2024-01-01'
      )
      const snapshot2 = createMockSnapshot(
        [createMockClub('1', 'A', 'A1', 20, 10)], // No change
        '2024-02-01'
      )

      const divisions = module.compareDivisions([snapshot1, snapshot2])

      expect(divisions).toHaveLength(1)
      expect(divisions[0]?.trend).toBe('stable')
    })
  })

  describe('analyzeAreasForSnapshot (AreaAnalytics)', () => {
    it('should return empty array for empty snapshots', () => {
      const module = new DivisionAreaAnalyticsModule()
      const areas = module.analyzeAreasForSnapshot([])
      expect(areas).toHaveLength(0)
    })

    it('should calculate normalized score correctly', () => {
      const module = new DivisionAreaAnalyticsModule()
      // Club with perfect health (membership >= 12, goals >= 1) and max DCP (10 goals)
      const clubs = [createMockClub('1', 'A', 'A1', 20, 10)]
      const snapshot = createMockSnapshot(clubs)

      const areas = module.analyzeAreasForSnapshot([snapshot])

      expect(areas).toHaveLength(1)
      // Health score: 1.0 (healthy)
      // DCP score: 10/10 = 1.0
      // Normalized: (1.0 * 0.5) + (1.0 * 0.5) = 1.0
      expect(areas[0]?.normalizedScore).toBe(1)
    })

    it('should aggregate multiple clubs in the same area', () => {
      const module = new DivisionAreaAnalyticsModule()
      const clubs = [
        createMockClub('1', 'A', 'A1', 20, 5),
        createMockClub('2', 'A', 'A1', 25, 7),
      ]
      const snapshot = createMockSnapshot(clubs)

      const areas = module.analyzeAreasForSnapshot([snapshot])

      expect(areas).toHaveLength(1)
      expect(areas[0]?.totalClubs).toBe(2)
      expect(areas[0]?.totalDcpGoals).toBe(12)
    })

    it('should respect the limit parameter', () => {
      const module = new DivisionAreaAnalyticsModule()
      const clubs = [
        createMockClub('1', 'A', 'A1', 20, 8),
        createMockClub('2', 'A', 'A2', 20, 7),
        createMockClub('3', 'B', 'B1', 20, 6),
        createMockClub('4', 'B', 'B2', 20, 5),
        createMockClub('5', 'C', 'C1', 20, 4),
      ]
      const snapshot = createMockSnapshot(clubs)

      const areas = module.analyzeAreasForSnapshot([snapshot], 2)

      expect(areas).toHaveLength(2)
    })
  })

  describe('Club Health Score Calculation', () => {
    /**
     * Club health scoring per Requirements 3.1-3.4:
     * - Critical (0 points): membership < 12
     * - At-risk (0.5 points): membership >= 12 AND dcpGoals = 0
     * - Healthy (1 point): membership >= 12 AND dcpGoals >= 1
     */

    it('should score critical clubs (membership < 12) as 0', () => {
      const module = new DivisionAreaAnalyticsModule()
      const clubs = [createMockClub('1', 'A', 'A1', 11, 5)] // 11 members = critical
      const snapshot = createMockSnapshot(clubs)

      const divisions = module.compareDivisions([snapshot])

      expect(divisions[0]?.averageClubHealth).toBe(0)
    })

    it('should score at-risk clubs (membership >= 12, goals = 0) as 0.5', () => {
      const module = new DivisionAreaAnalyticsModule()
      const clubs = [createMockClub('1', 'A', 'A1', 15, 0)] // 15 members, 0 goals = at-risk
      const snapshot = createMockSnapshot(clubs)

      const divisions = module.compareDivisions([snapshot])

      expect(divisions[0]?.averageClubHealth).toBe(0.5)
    })

    it('should score healthy clubs (membership >= 12, goals >= 1) as 1', () => {
      const module = new DivisionAreaAnalyticsModule()
      const clubs = [createMockClub('1', 'A', 'A1', 12, 1)] // 12 members, 1 goal = healthy
      const snapshot = createMockSnapshot(clubs)

      const divisions = module.compareDivisions([snapshot])

      expect(divisions[0]?.averageClubHealth).toBe(1)
    })

    it('should handle boundary case: exactly 12 members with 0 goals', () => {
      const module = new DivisionAreaAnalyticsModule()
      const clubs = [createMockClub('1', 'A', 'A1', 12, 0)]
      const snapshot = createMockSnapshot(clubs)

      const divisions = module.compareDivisions([snapshot])

      expect(divisions[0]?.averageClubHealth).toBe(0.5) // At-risk
    })

    it('should handle boundary case: exactly 12 members with 1 goal', () => {
      const module = new DivisionAreaAnalyticsModule()
      const clubs = [createMockClub('1', 'A', 'A1', 12, 1)]
      const snapshot = createMockSnapshot(clubs)

      const divisions = module.compareDivisions([snapshot])

      expect(divisions[0]?.averageClubHealth).toBe(1) // Healthy
    })
  })
})
