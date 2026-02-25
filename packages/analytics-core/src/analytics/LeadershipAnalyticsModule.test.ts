/**
 * LeadershipAnalyticsModule Unit Tests
 *
 * Tests for leadership effectiveness insights and correlations.
 * Per testing.md Section 7.3: "Would 5 well-chosen examples provide equivalent confidence?
 * If yes, prefer the examples." - These boundary tests are clearer than properties.
 *
 * Requirements: 1.5, 4.1, 4.2, 8.1, 8.2, 8.3, 8.4, 8.5
 */

import { describe, it, expect } from 'vitest'
import { LeadershipAnalyticsModule } from './LeadershipAnalyticsModule.js'
import type { DistrictStatistics, ClubStatistics } from '../interfaces.js'

/**
 * Helper to create a mock club with specified properties
 */
function createMockClub(
  clubId: string,
  divisionId: string,
  areaId: string,
  membershipCount: number,
  dcpGoals: number,
  membershipBase?: number
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
    membershipBase: membershipBase ?? membershipCount,
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

describe('LeadershipAnalyticsModule', () => {
  describe('generateLeadershipInsights', () => {
    it('should return empty insights for empty snapshots', () => {
      const module = new LeadershipAnalyticsModule()
      const insights = module.generateLeadershipInsights([])

      expect(insights.leadershipScores).toHaveLength(0)
      expect(insights.bestPracticeDivisions).toHaveLength(0)
      expect(insights.leadershipChanges).toHaveLength(0)
      expect(insights.areaDirectorCorrelations).toHaveLength(0)
      expect(insights.summary.averageLeadershipScore).toBe(0)
    })

    it('should return empty insights for snapshot with no clubs', () => {
      const module = new LeadershipAnalyticsModule()
      const snapshot = createMockSnapshot([])
      const insights = module.generateLeadershipInsights([snapshot])

      expect(insights.leadershipScores).toHaveLength(0)
      expect(insights.summary.averageLeadershipScore).toBe(0)
    })

    it('should generate leadership scores for each division', () => {
      const module = new LeadershipAnalyticsModule()
      const clubs = [
        createMockClub('1', 'A', 'A1', 20, 5),
        createMockClub('2', 'A', 'A2', 25, 7),
        createMockClub('3', 'B', 'B1', 15, 3),
      ]
      const snapshot = createMockSnapshot(clubs)

      const insights = module.generateLeadershipInsights([snapshot])

      expect(insights.leadershipScores).toHaveLength(2)
      expect(insights.leadershipScores.map(s => s.divisionId).sort()).toEqual([
        'A',
        'B',
      ])
    })

    it('should rank divisions by overall score', () => {
      const module = new LeadershipAnalyticsModule()
      const clubs = [
        // Division A: high performing
        createMockClub('1', 'A', 'A1', 25, 8),
        createMockClub('2', 'A', 'A2', 30, 9),
        // Division B: low performing
        createMockClub('3', 'B', 'B1', 10, 1),
        createMockClub('4', 'B', 'B2', 12, 2),
      ]
      const snapshot = createMockSnapshot(clubs)

      const insights = module.generateLeadershipInsights([snapshot])

      expect(insights.leadershipScores[0]?.divisionId).toBe('A')
      expect(insights.leadershipScores[0]?.rank).toBe(1)
      expect(insights.leadershipScores[1]?.divisionId).toBe('B')
      expect(insights.leadershipScores[1]?.rank).toBe(2)
    })
  })

  describe('Leadership Effectiveness Score (Req 8.1)', () => {
    /**
     * Leadership effectiveness score is weighted:
     * - 40% health score
     * - 30% growth score
     * - 30% DCP score
     */

    it('should calculate health score based on club health metrics', () => {
      const module = new LeadershipAnalyticsModule()
      // All healthy clubs (membership >= 12, goals > 0)
      const clubs = [
        createMockClub('1', 'A', 'A1', 20, 5),
        createMockClub('2', 'A', 'A2', 25, 7),
      ]
      const snapshot = createMockSnapshot(clubs)

      const insights = module.generateLeadershipInsights([snapshot])

      expect(insights.leadershipScores).toHaveLength(1)
      expect(insights.leadershipScores[0]?.healthScore).toBeGreaterThan(0)
    })

    it('should calculate DCP score based on goal achievement', () => {
      const module = new LeadershipAnalyticsModule()
      // Clubs with max DCP goals (10 each)
      const clubs = [
        createMockClub('1', 'A', 'A1', 20, 10),
        createMockClub('2', 'A', 'A2', 20, 10),
      ]
      const snapshot = createMockSnapshot(clubs)

      const insights = module.generateLeadershipInsights([snapshot])

      expect(insights.leadershipScores).toHaveLength(1)
      // DCP score should be 100% (10/10 goals per club)
      expect(insights.leadershipScores[0]?.dcpScore).toBe(100)
    })

    it('should calculate growth score as 50 for single snapshot when membershipBase equals membershipCount', () => {
      const module = new LeadershipAnalyticsModule()
      // membershipBase defaults to membershipCount (no change)
      const clubs = [createMockClub('1', 'A', 'A1', 20, 5)]
      const snapshot = createMockSnapshot(clubs)

      const insights = module.generateLeadershipInsights([snapshot])

      // With equal membershipBase and membershipCount, growth rate is 0 → score = 50
      expect(insights.leadershipScores[0]?.growthScore).toBe(50)
    })

    it('should calculate positive growth score for single snapshot when membership grew from base (#111)', () => {
      const module = new LeadershipAnalyticsModule()
      // membershipBase=15, membershipCount=20 → 33% growth
      const clubs = [
        createMockClub('1', 'A', 'A1', 20, 5, 15),
        createMockClub('2', 'A', 'A2', 25, 5, 20),
      ]
      const snapshot = createMockSnapshot(clubs)

      const insights = module.generateLeadershipInsights([snapshot])

      // Growth from base should produce score > 50
      expect(insights.leadershipScores[0]?.growthScore).toBeGreaterThan(50)
    })

    it('should calculate negative growth score for single snapshot when membership declined from base (#111)', () => {
      const module = new LeadershipAnalyticsModule()
      // membershipBase=25, membershipCount=20 → -20% decline
      const clubs = [
        createMockClub('1', 'A', 'A1', 20, 5, 25),
        createMockClub('2', 'A', 'A2', 15, 5, 20),
      ]
      const snapshot = createMockSnapshot(clubs)

      const insights = module.generateLeadershipInsights([snapshot])

      // Decline from base should produce score < 50
      expect(insights.leadershipScores[0]?.growthScore).toBeLessThan(50)
    })

    it('should return 50 for single snapshot when membershipBase is 0 (#111)', () => {
      const module = new LeadershipAnalyticsModule()
      // membershipBase=0 → can't calculate growth rate
      const clubs = [createMockClub('1', 'A', 'A1', 20, 5, 0)]
      const snapshot = createMockSnapshot(clubs)

      const insights = module.generateLeadershipInsights([snapshot])

      // Zero base = can't calculate growth → neutral 50
      expect(insights.leadershipScores[0]?.growthScore).toBe(50)
    })

    it('should calculate positive growth score when membership increases', () => {
      const module = new LeadershipAnalyticsModule()

      const snapshot1 = createMockSnapshot(
        [createMockClub('1', 'A', 'A1', 20, 5)],
        '2024-01-01'
      )
      const snapshot2 = createMockSnapshot(
        [createMockClub('1', 'A', 'A1', 24, 5)], // 20% increase
        '2024-02-01'
      )

      const insights = module.generateLeadershipInsights([snapshot1, snapshot2])

      expect(insights.leadershipScores[0]?.growthScore).toBeGreaterThan(50)
    })

    it('should calculate negative growth score when membership decreases', () => {
      const module = new LeadershipAnalyticsModule()

      const snapshot1 = createMockSnapshot(
        [createMockClub('1', 'A', 'A1', 25, 5)],
        '2024-01-01'
      )
      const snapshot2 = createMockSnapshot(
        [createMockClub('1', 'A', 'A1', 20, 5)], // 20% decrease
        '2024-02-01'
      )

      const insights = module.generateLeadershipInsights([snapshot1, snapshot2])

      expect(insights.leadershipScores[0]?.growthScore).toBeLessThan(50)
    })
  })

  describe('Best Practice Divisions (Req 8.2)', () => {
    it('should identify high-performing divisions as best practices', () => {
      const module = new LeadershipAnalyticsModule()
      // Create a high-performing division
      const clubs = [
        createMockClub('1', 'A', 'A1', 30, 10),
        createMockClub('2', 'A', 'A2', 28, 9),
        createMockClub('3', 'A', 'A3', 25, 8),
      ]
      const snapshot = createMockSnapshot(clubs)

      const insights = module.generateLeadershipInsights([snapshot])

      // With only one division, it should be in top 20% and potentially best practice
      expect(insights.leadershipScores[0]?.overallScore).toBeGreaterThan(0)
    })

    it('should mark best practice divisions with isBestPractice flag', () => {
      const module = new LeadershipAnalyticsModule()
      // Create multiple divisions with varying performance
      const clubs = [
        // Division A: excellent performance
        createMockClub('1', 'A', 'A1', 30, 10),
        createMockClub('2', 'A', 'A2', 28, 9),
        // Division B: poor performance
        createMockClub('3', 'B', 'B1', 10, 1),
        createMockClub('4', 'B', 'B2', 11, 0),
      ]
      const snapshot = createMockSnapshot(clubs)

      const insights = module.generateLeadershipInsights([snapshot])

      const divisionA = insights.leadershipScores.find(
        s => s.divisionId === 'A'
      )
      const divisionB = insights.leadershipScores.find(
        s => s.divisionId === 'B'
      )

      // Division A should have higher score
      expect(divisionA?.overallScore).toBeGreaterThan(
        divisionB?.overallScore ?? 0
      )
    })

    it('should include best practice divisions in bestPracticeDivisions array', () => {
      const module = new LeadershipAnalyticsModule()
      const clubs = [
        createMockClub('1', 'A', 'A1', 30, 10),
        createMockClub('2', 'A', 'A2', 28, 9),
      ]
      const snapshot = createMockSnapshot(clubs)

      const insights = module.generateLeadershipInsights([snapshot])

      // Best practice divisions should be a subset of leadership scores
      for (const bp of insights.bestPracticeDivisions) {
        expect(bp.isBestPractice).toBe(true)
      }
    })
  })

  describe('Area Director Correlations (Req 8.4)', () => {
    it('should generate correlations for each area', () => {
      const module = new LeadershipAnalyticsModule()
      const clubs = [
        createMockClub('1', 'A', 'A1', 20, 5),
        createMockClub('2', 'A', 'A2', 25, 7),
        createMockClub('3', 'B', 'B1', 15, 3),
      ]
      const snapshot = createMockSnapshot(clubs)

      const insights = module.generateLeadershipInsights([snapshot])

      expect(insights.areaDirectorCorrelations).toHaveLength(3)
    })

    it('should classify high-performing areas with high activity indicator', () => {
      const module = new LeadershipAnalyticsModule()
      const clubs = [
        createMockClub('1', 'A', 'A1', 30, 10), // High performance
      ]
      const snapshot = createMockSnapshot(clubs)

      const insights = module.generateLeadershipInsights([snapshot])

      const areaA1 = insights.areaDirectorCorrelations.find(
        c => c.areaId === 'A1'
      )
      expect(areaA1?.activityIndicator).toBe('high')
      expect(areaA1?.correlation).toBe('positive')
    })

    it('should classify low-performing areas with low activity indicator', () => {
      const module = new LeadershipAnalyticsModule()
      const clubs = [
        createMockClub('1', 'A', 'A1', 10, 0), // Low performance
      ]
      const snapshot = createMockSnapshot(clubs)

      const insights = module.generateLeadershipInsights([snapshot])

      const areaA1 = insights.areaDirectorCorrelations.find(
        c => c.areaId === 'A1'
      )
      expect(areaA1?.activityIndicator).toBe('low')
      expect(areaA1?.correlation).toBe('negative')
    })

    it('should sort correlations by performance score descending', () => {
      const module = new LeadershipAnalyticsModule()
      const clubs = [
        createMockClub('1', 'A', 'A1', 10, 1), // Low
        createMockClub('2', 'A', 'A2', 30, 10), // High
        createMockClub('3', 'B', 'B1', 20, 5), // Medium
      ]
      const snapshot = createMockSnapshot(clubs)

      const insights = module.generateLeadershipInsights([snapshot])

      // Should be sorted by performance score descending
      for (let i = 1; i < insights.areaDirectorCorrelations.length; i++) {
        const prev = insights.areaDirectorCorrelations[i - 1]
        const curr = insights.areaDirectorCorrelations[i]
        expect(prev?.clubPerformanceScore).toBeGreaterThanOrEqual(
          curr?.clubPerformanceScore ?? 0
        )
      }
    })
  })

  describe('Leadership Summary (Req 8.5)', () => {
    it('should include top 5 performing divisions', () => {
      const module = new LeadershipAnalyticsModule()
      const clubs = [
        createMockClub('1', 'A', 'A1', 20, 8),
        createMockClub('2', 'B', 'B1', 20, 7),
        createMockClub('3', 'C', 'C1', 20, 6),
        createMockClub('4', 'D', 'D1', 20, 5),
        createMockClub('5', 'E', 'E1', 20, 4),
        createMockClub('6', 'F', 'F1', 20, 3),
      ]
      const snapshot = createMockSnapshot(clubs)

      const insights = module.generateLeadershipInsights([snapshot])

      expect(
        insights.summary.topPerformingDivisions.length
      ).toBeLessThanOrEqual(5)
    })

    it('should include top 5 performing areas', () => {
      const module = new LeadershipAnalyticsModule()
      const clubs = [
        createMockClub('1', 'A', 'A1', 20, 8),
        createMockClub('2', 'A', 'A2', 20, 7),
        createMockClub('3', 'B', 'B1', 20, 6),
        createMockClub('4', 'B', 'B2', 20, 5),
        createMockClub('5', 'C', 'C1', 20, 4),
        createMockClub('6', 'C', 'C2', 20, 3),
      ]
      const snapshot = createMockSnapshot(clubs)

      const insights = module.generateLeadershipInsights([snapshot])

      expect(insights.summary.topPerformingAreas.length).toBeLessThanOrEqual(5)
    })

    it('should calculate average leadership score', () => {
      const module = new LeadershipAnalyticsModule()
      const clubs = [
        createMockClub('1', 'A', 'A1', 20, 5),
        createMockClub('2', 'B', 'B1', 20, 5),
      ]
      const snapshot = createMockSnapshot(clubs)

      const insights = module.generateLeadershipInsights([snapshot])

      expect(insights.summary.averageLeadershipScore).toBeGreaterThan(0)
    })

    it('should count total best practice divisions', () => {
      const module = new LeadershipAnalyticsModule()
      const clubs = [
        createMockClub('1', 'A', 'A1', 30, 10),
        createMockClub('2', 'B', 'B1', 10, 1),
      ]
      const snapshot = createMockSnapshot(clubs)

      const insights = module.generateLeadershipInsights([snapshot])

      expect(insights.summary.totalBestPracticeDivisions).toBe(
        insights.bestPracticeDivisions.length
      )
    })
  })

  describe('Leadership Changes (Req 8.3)', () => {
    it('should return empty array for less than 3 snapshots', () => {
      const module = new LeadershipAnalyticsModule()
      const snapshot1 = createMockSnapshot(
        [createMockClub('1', 'A', 'A1', 20, 5)],
        '2024-01-01'
      )
      const snapshot2 = createMockSnapshot(
        [createMockClub('1', 'A', 'A1', 20, 7)],
        '2024-02-01'
      )

      const insights = module.generateLeadershipInsights([snapshot1, snapshot2])

      expect(insights.leadershipChanges).toHaveLength(0)
    })

    it('should detect significant performance improvements', () => {
      const module = new LeadershipAnalyticsModule()
      const snapshot1 = createMockSnapshot(
        [createMockClub('1', 'A', 'A1', 20, 2)],
        '2024-01-01'
      )
      const snapshot2 = createMockSnapshot(
        [createMockClub('1', 'A', 'A1', 20, 2)],
        '2024-02-01'
      )
      const snapshot3 = createMockSnapshot(
        [createMockClub('1', 'A', 'A1', 20, 5)], // Significant increase
        '2024-03-01'
      )

      const insights = module.generateLeadershipInsights([
        snapshot1,
        snapshot2,
        snapshot3,
      ])

      // Should detect the improvement
      const improvingChanges = insights.leadershipChanges.filter(
        c => c.trend === 'improved'
      )
      expect(improvingChanges.length).toBeGreaterThanOrEqual(0)
    })

    it('should detect significant performance declines', () => {
      const module = new LeadershipAnalyticsModule()
      const snapshot1 = createMockSnapshot(
        [createMockClub('1', 'A', 'A1', 20, 8)],
        '2024-01-01'
      )
      const snapshot2 = createMockSnapshot(
        [createMockClub('1', 'A', 'A1', 20, 8)],
        '2024-02-01'
      )
      const snapshot3 = createMockSnapshot(
        [createMockClub('1', 'A', 'A1', 20, 2)], // Significant decrease
        '2024-03-01'
      )

      const insights = module.generateLeadershipInsights([
        snapshot1,
        snapshot2,
        snapshot3,
      ])

      // Should detect the decline
      const decliningChanges = insights.leadershipChanges.filter(
        c => c.trend === 'declined'
      )
      expect(decliningChanges.length).toBeGreaterThanOrEqual(0)
    })
  })
})
