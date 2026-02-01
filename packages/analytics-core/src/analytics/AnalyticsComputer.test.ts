/**
 * AnalyticsComputer Unit Tests
 *
 * Tests for the main analytics computation orchestrator.
 *
 * Requirements: 7.2, 7.3, 7.4, 7.5
 */

import { describe, it, expect } from 'vitest'
import { AnalyticsComputer } from './AnalyticsComputer.js'
import type { DistrictStatistics, ClubStatistics } from '../interfaces.js'

/**
 * Helper to create a mock club
 */
function createMockClub(overrides: Partial<ClubStatistics> = {}): ClubStatistics {
  return {
    clubId: '1234',
    clubName: 'Test Club',
    divisionId: 'A',
    areaId: 'A1',
    membershipCount: 25,
    paymentsCount: 20,
    dcpGoals: 5,
    status: 'Active',
    ...overrides,
  }
}

/**
 * Helper to create a mock district statistics snapshot
 */
function createMockSnapshot(
  districtId: string,
  snapshotDate: string,
  clubs: ClubStatistics[] = []
): DistrictStatistics {
  const totalMembership = clubs.reduce((sum, c) => sum + c.membershipCount, 0)
  const totalPayments = clubs.reduce((sum, c) => sum + c.paymentsCount, 0)

  return {
    districtId,
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

describe('AnalyticsComputer', () => {
  describe('computeDistrictAnalytics', () => {
    it('should return empty analytics for empty snapshots', async () => {
      const computer = new AnalyticsComputer()
      const result = await computer.computeDistrictAnalytics('D101', [])

      expect(result.districtAnalytics.districtId).toBe('D101')
      expect(result.districtAnalytics.totalMembership).toBe(0)
      expect(result.districtAnalytics.membershipChange).toBe(0)
      expect(result.districtAnalytics.allClubs).toHaveLength(0)
      expect(result.schemaVersion).toBeDefined()
      expect(result.computedAt).toBeDefined()
    })

    it('should compute analytics from a single snapshot', async () => {
      const computer = new AnalyticsComputer()
      const clubs = [
        createMockClub({ clubId: '1', clubName: 'Club A', membershipCount: 25, dcpGoals: 6 }),
        createMockClub({ clubId: '2', clubName: 'Club B', membershipCount: 15, dcpGoals: 3 }),
        createMockClub({ clubId: '3', clubName: 'Club C', membershipCount: 10, dcpGoals: 1 }),
      ]
      const snapshot = createMockSnapshot('D101', '2024-01-15', clubs)

      const result = await computer.computeDistrictAnalytics('D101', [snapshot])

      expect(result.districtAnalytics.districtId).toBe('D101')
      expect(result.districtAnalytics.totalMembership).toBe(50) // 25 + 15 + 10
      expect(result.districtAnalytics.membershipChange).toBe(0) // No change with single snapshot
      expect(result.districtAnalytics.allClubs).toHaveLength(3)
    })

    it('should compute membership change from multiple snapshots', async () => {
      const computer = new AnalyticsComputer()

      const snapshot1 = createMockSnapshot('D101', '2024-01-01', [
        createMockClub({ clubId: '1', membershipCount: 20 }),
      ])
      const snapshot2 = createMockSnapshot('D101', '2024-02-01', [
        createMockClub({ clubId: '1', membershipCount: 25 }),
      ])

      const result = await computer.computeDistrictAnalytics('D101', [snapshot1, snapshot2])

      expect(result.districtAnalytics.membershipChange).toBe(5) // 25 - 20
      expect(result.districtAnalytics.totalMembership).toBe(25) // Latest
    })

    it('should sort snapshots by date for trend analysis', async () => {
      const computer = new AnalyticsComputer()

      // Provide snapshots out of order
      const snapshot2 = createMockSnapshot('D101', '2024-02-01', [
        createMockClub({ clubId: '1', membershipCount: 30 }),
      ])
      const snapshot1 = createMockSnapshot('D101', '2024-01-01', [
        createMockClub({ clubId: '1', membershipCount: 20 }),
      ])

      const result = await computer.computeDistrictAnalytics('D101', [snapshot2, snapshot1])

      // Should use sorted order: snapshot1 (Jan) -> snapshot2 (Feb)
      expect(result.districtAnalytics.membershipChange).toBe(10) // 30 - 20
      expect(result.districtAnalytics.totalMembership).toBe(30) // Latest (Feb)
    })

    it('should categorize clubs by health status', async () => {
      const computer = new AnalyticsComputer()

      const clubs = [
        // Thriving: membership >= 20 and DCP checkpoint met
        createMockClub({ clubId: '1', clubName: 'Thriving Club', membershipCount: 25, dcpGoals: 5 }),
        // Vulnerable: membership < 20 but >= 12
        createMockClub({ clubId: '2', clubName: 'Vulnerable Club', membershipCount: 15, dcpGoals: 0 }),
        // Intervention required: membership < 12
        createMockClub({ clubId: '3', clubName: 'Critical Club', membershipCount: 8, dcpGoals: 0 }),
      ]
      const snapshot = createMockSnapshot('D101', '2024-01-15', clubs)

      const result = await computer.computeDistrictAnalytics('D101', [snapshot])

      expect(result.clubHealth.thrivingClubs.length).toBeGreaterThanOrEqual(1)
      expect(result.clubHealth.vulnerableClubs.length).toBeGreaterThanOrEqual(0)
      expect(result.clubHealth.interventionRequiredClubs.length).toBeGreaterThanOrEqual(1)
    })

    it('should generate distinguished club summaries', async () => {
      const computer = new AnalyticsComputer()

      const clubs = [
        // President's Distinguished: 9+ goals, 20+ members
        createMockClub({ clubId: '1', clubName: 'President Club', membershipCount: 25, dcpGoals: 9 }),
        // Select Distinguished: 7+ goals, 20+ members
        createMockClub({ clubId: '2', clubName: 'Select Club', membershipCount: 22, dcpGoals: 7 }),
        // Distinguished: 5+ goals, 20+ members
        createMockClub({ clubId: '3', clubName: 'Distinguished Club', membershipCount: 20, dcpGoals: 5 }),
        // Not distinguished
        createMockClub({ clubId: '4', clubName: 'Regular Club', membershipCount: 15, dcpGoals: 3 }),
      ]
      const snapshot = createMockSnapshot('D101', '2024-01-15', clubs)

      const result = await computer.computeDistrictAnalytics('D101', [snapshot])

      expect(result.districtAnalytics.distinguishedClubs.length).toBe(3)
      expect(result.districtAnalytics.distinguishedClubs.some(c => c.status === 'president')).toBe(true)
      expect(result.districtAnalytics.distinguishedClubs.some(c => c.status === 'select')).toBe(true)
      expect(result.districtAnalytics.distinguishedClubs.some(c => c.status === 'distinguished')).toBe(true)
    })

    it('should generate division rankings', async () => {
      const computer = new AnalyticsComputer()

      const clubs = [
        createMockClub({ clubId: '1', divisionId: 'A', membershipCount: 25, dcpGoals: 8 }),
        createMockClub({ clubId: '2', divisionId: 'A', membershipCount: 22, dcpGoals: 6 }),
        createMockClub({ clubId: '3', divisionId: 'B', membershipCount: 18, dcpGoals: 3 }),
        createMockClub({ clubId: '4', divisionId: 'B', membershipCount: 15, dcpGoals: 2 }),
      ]
      const snapshot = createMockSnapshot('D101', '2024-01-15', clubs)

      const result = await computer.computeDistrictAnalytics('D101', [snapshot])

      expect(result.districtAnalytics.divisionRankings.length).toBe(2)
      // Division A should rank higher (more DCP goals)
      expect(result.districtAnalytics.divisionRankings[0]?.divisionId).toBe('A')
      expect(result.districtAnalytics.divisionRankings[0]?.rank).toBe(1)
    })

    it('should generate top performing areas', async () => {
      const computer = new AnalyticsComputer()

      const clubs = [
        createMockClub({ clubId: '1', divisionId: 'A', areaId: 'A1', membershipCount: 25, dcpGoals: 8 }),
        createMockClub({ clubId: '2', divisionId: 'A', areaId: 'A2', membershipCount: 15, dcpGoals: 2 }),
        createMockClub({ clubId: '3', divisionId: 'B', areaId: 'B1', membershipCount: 20, dcpGoals: 5 }),
      ]
      const snapshot = createMockSnapshot('D101', '2024-01-15', clubs)

      const result = await computer.computeDistrictAnalytics('D101', [snapshot])

      expect(result.districtAnalytics.topPerformingAreas.length).toBeGreaterThan(0)
      // Area A1 should be top (highest score)
      expect(result.districtAnalytics.topPerformingAreas[0]?.areaId).toBe('A1')
    })

    it('should include membership trends in result', async () => {
      const computer = new AnalyticsComputer()

      const snapshot1 = createMockSnapshot('D101', '2024-01-01', [
        createMockClub({ clubId: '1', membershipCount: 20, paymentsCount: 15 }),
      ])
      const snapshot2 = createMockSnapshot('D101', '2024-02-01', [
        createMockClub({ clubId: '1', membershipCount: 25, paymentsCount: 20 }),
      ])

      const result = await computer.computeDistrictAnalytics('D101', [snapshot1, snapshot2])

      expect(result.membershipTrends.membershipTrend).toHaveLength(2)
      expect(result.membershipTrends.paymentsTrend).toHaveLength(2)
      expect(result.membershipTrends.membershipTrend[0]?.count).toBe(20)
      expect(result.membershipTrends.membershipTrend[1]?.count).toBe(25)
    })

    it('should set correct date range', async () => {
      const computer = new AnalyticsComputer()

      const snapshot1 = createMockSnapshot('D101', '2024-01-01', [createMockClub()])
      const snapshot2 = createMockSnapshot('D101', '2024-03-15', [createMockClub()])

      const result = await computer.computeDistrictAnalytics('D101', [snapshot1, snapshot2])

      expect(result.districtAnalytics.dateRange.start).toBe('2024-01-01')
      expect(result.districtAnalytics.dateRange.end).toBe('2024-03-15')
    })
  })
})
