/**
 * AnalyticsComputer Integration Tests
 *
 * End-to-end integration tests that verify the complete DistrictAnalytics
 * structure is produced correctly by the AnalyticsComputer.
 *
 * These tests create realistic snapshot data, run the full analytics
 * computation pipeline, and verify the output structure matches all
 * frontend expectations.
 *
 * Requirements: 3.1-3.9
 * - 3.1: allClubs as array of complete ClubTrend objects
 * - 3.2: vulnerableClubs as array of complete ClubTrend objects
 * - 3.3: thrivingClubs as array of complete ClubTrend objects
 * - 3.4: interventionRequiredClubs as array of complete ClubTrend objects
 * - 3.5: membershipTrend as array of date/count objects
 * - 3.6: divisionRankings as array of DivisionRanking objects
 * - 3.7: topPerformingAreas as array of AreaPerformance objects
 * - 3.8: distinguishedClubsList as array of DistinguishedClubSummary objects
 * - 3.9: distinguishedProjection as DistinguishedProjection object
 */

import { describe, it, expect } from 'vitest'
import { AnalyticsComputer } from './AnalyticsComputer.js'
import type { DistrictStatistics, ClubStatistics } from '../interfaces.js'
import type {
  DistrictAnalytics,
  ClubTrend,
  DivisionRanking,
  AreaPerformance,
  DistinguishedClubSummary,
  DistinguishedProjection,
  MembershipTrendPoint,
} from '../types.js'

// ============================================================================
// Test Data Helpers
// ============================================================================

/**
 * Creates a realistic club with all required fields populated.
 */
function createTestClub(
  overrides: Partial<ClubStatistics> = {}
): ClubStatistics {
  return {
    clubId: '1234567',
    clubName: 'Test Speakers Club',
    divisionId: 'A',
    areaId: 'A1',
    divisionName: 'Division A',
    areaName: 'Area A1',
    membershipCount: 22,
    paymentsCount: 20,
    dcpGoals: 5,
    status: 'Active',
    octoberRenewals: 12,
    aprilRenewals: 5,
    newMembers: 3,
    membershipBase: 18,
    clubStatus: 'Active',
    ...overrides,
  }
}

/**
 * Creates a realistic district statistics snapshot with multiple clubs.
 */
function createTestSnapshot(
  districtId: string,
  snapshotDate: string,
  clubs: ClubStatistics[]
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

/**
 * Creates a comprehensive set of test clubs representing various health states
 * and distinguished levels for realistic integration testing.
 */
function createRealisticClubSet(): ClubStatistics[] {
  return [
    // Thriving clubs with high membership and DCP goals
    createTestClub({
      clubId: '1001',
      clubName: 'Excellence Speakers',
      divisionId: 'A',
      areaId: 'A1',
      divisionName: 'Division A',
      areaName: 'Area A1',
      membershipCount: 28,
      paymentsCount: 26,
      dcpGoals: 10,
      octoberRenewals: 15,
      aprilRenewals: 8,
      newMembers: 5,
      membershipBase: 22,
      clubStatus: 'Active',
    }),
    createTestClub({
      clubId: '1002',
      clubName: 'Premier Toastmasters',
      divisionId: 'A',
      areaId: 'A2',
      divisionName: 'Division A',
      areaName: 'Area A2',
      membershipCount: 25,
      paymentsCount: 24,
      dcpGoals: 9,
      octoberRenewals: 12,
      aprilRenewals: 8,
      newMembers: 5,
      membershipBase: 20,
      clubStatus: 'Active',
    }),
    // Select Distinguished club
    createTestClub({
      clubId: '1003',
      clubName: 'Select Speakers',
      divisionId: 'B',
      areaId: 'B1',
      divisionName: 'Division B',
      areaName: 'Area B1',
      membershipCount: 22,
      paymentsCount: 20,
      dcpGoals: 7,
      octoberRenewals: 10,
      aprilRenewals: 6,
      newMembers: 4,
      membershipBase: 18,
      clubStatus: 'Active',
    }),
    // Distinguished club
    createTestClub({
      clubId: '1004',
      clubName: 'Distinguished Club',
      divisionId: 'B',
      areaId: 'B2',
      divisionName: 'Division B',
      areaName: 'Area B2',
      membershipCount: 20,
      paymentsCount: 18,
      dcpGoals: 5,
      octoberRenewals: 8,
      aprilRenewals: 6,
      newMembers: 4,
      membershipBase: 16,
      clubStatus: 'Active',
    }),
    // Vulnerable club (low membership but not critical)
    createTestClub({
      clubId: '1005',
      clubName: 'Growing Speakers',
      divisionId: 'C',
      areaId: 'C1',
      divisionName: 'Division C',
      areaName: 'Area C1',
      membershipCount: 15,
      paymentsCount: 12,
      dcpGoals: 2,
      octoberRenewals: 6,
      aprilRenewals: 4,
      newMembers: 2,
      membershipBase: 14,
      clubStatus: 'Active',
    }),
    // Intervention required club (critical membership)
    createTestClub({
      clubId: '1006',
      clubName: 'Struggling Club',
      divisionId: 'C',
      areaId: 'C2',
      divisionName: 'Division C',
      areaName: 'Area C2',
      membershipCount: 9,
      paymentsCount: 6,
      dcpGoals: 1,
      octoberRenewals: 3,
      aprilRenewals: 2,
      newMembers: 1,
      membershipBase: 10,
      clubStatus: 'Low',
    }),
  ]
}

/**
 * Creates multiple snapshots over time to test trend computation.
 */
function createMultipleSnapshots(districtId: string): DistrictStatistics[] {
  // Snapshot 1: January - baseline
  const clubs1 = [
    createTestClub({
      clubId: '1001',
      clubName: 'Excellence Speakers',
      divisionId: 'A',
      areaId: 'A1',
      divisionName: 'Division A',
      areaName: 'Area A1',
      membershipCount: 24,
      dcpGoals: 6,
    }),
    createTestClub({
      clubId: '1002',
      clubName: 'Premier Toastmasters',
      divisionId: 'A',
      areaId: 'A2',
      divisionName: 'Division A',
      areaName: 'Area A2',
      membershipCount: 22,
      dcpGoals: 5,
    }),
    createTestClub({
      clubId: '1003',
      clubName: 'Growing Club',
      divisionId: 'B',
      areaId: 'B1',
      divisionName: 'Division B',
      areaName: 'Area B1',
      membershipCount: 18,
      dcpGoals: 3,
    }),
  ]

  // Snapshot 2: February - growth
  const clubs2 = [
    createTestClub({
      clubId: '1001',
      clubName: 'Excellence Speakers',
      divisionId: 'A',
      areaId: 'A1',
      divisionName: 'Division A',
      areaName: 'Area A1',
      membershipCount: 26,
      dcpGoals: 8,
    }),
    createTestClub({
      clubId: '1002',
      clubName: 'Premier Toastmasters',
      divisionId: 'A',
      areaId: 'A2',
      divisionName: 'Division A',
      areaName: 'Area A2',
      membershipCount: 24,
      dcpGoals: 7,
    }),
    createTestClub({
      clubId: '1003',
      clubName: 'Growing Club',
      divisionId: 'B',
      areaId: 'B1',
      divisionName: 'Division B',
      areaName: 'Area B1',
      membershipCount: 20,
      dcpGoals: 4,
    }),
  ]

  // Snapshot 3: March - continued growth
  const clubs3 = [
    createTestClub({
      clubId: '1001',
      clubName: 'Excellence Speakers',
      divisionId: 'A',
      areaId: 'A1',
      divisionName: 'Division A',
      areaName: 'Area A1',
      membershipCount: 28,
      dcpGoals: 10,
    }),
    createTestClub({
      clubId: '1002',
      clubName: 'Premier Toastmasters',
      divisionId: 'A',
      areaId: 'A2',
      divisionName: 'Division A',
      areaName: 'Area A2',
      membershipCount: 25,
      dcpGoals: 9,
    }),
    createTestClub({
      clubId: '1003',
      clubName: 'Growing Club',
      divisionId: 'B',
      areaId: 'B1',
      divisionName: 'Division B',
      areaName: 'Area B1',
      membershipCount: 22,
      dcpGoals: 5,
    }),
  ]

  return [
    createTestSnapshot(districtId, '2024-01-15', clubs1),
    createTestSnapshot(districtId, '2024-02-15', clubs2),
    createTestSnapshot(districtId, '2024-03-15', clubs3),
  ]
}

// ============================================================================
// Type Guard Helpers for Validation
// ============================================================================

/**
 * Validates that a ClubTrend object has all required fields populated.
 */
function isCompleteClubTrend(club: ClubTrend): boolean {
  // Core identification
  if (!club.clubId || !club.clubName) return false

  // Division and area info (Requirements 1.1, 1.2)
  if (!club.divisionId || !club.divisionName) return false
  if (!club.areaId || !club.areaName) return false

  // Health assessment
  if (!club.currentStatus) return false
  if (typeof club.healthScore !== 'number') return false

  // Membership data
  if (typeof club.membershipCount !== 'number') return false
  if (typeof club.paymentsCount !== 'number') return false

  // Trend arrays (Requirements 1.3, 1.4)
  if (!Array.isArray(club.membershipTrend)) return false
  if (!Array.isArray(club.dcpGoalsTrend)) return false

  // Risk factors as string array (Requirement 1.6)
  if (!Array.isArray(club.riskFactors)) return false

  // Distinguished level (Requirement 1.5)
  if (!club.distinguishedLevel) return false

  return true
}

/**
 * Validates that a DivisionRanking object has all required fields.
 */
function isCompleteDivisionRanking(ranking: DivisionRanking): boolean {
  return (
    typeof ranking.divisionId === 'string' &&
    typeof ranking.divisionName === 'string' &&
    typeof ranking.rank === 'number' &&
    typeof ranking.score === 'number' &&
    typeof ranking.clubCount === 'number' &&
    typeof ranking.membershipTotal === 'number'
  )
}

/**
 * Validates that an AreaPerformance object has all required fields.
 */
function isCompleteAreaPerformance(area: AreaPerformance): boolean {
  return (
    typeof area.areaId === 'string' &&
    typeof area.areaName === 'string' &&
    typeof area.divisionId === 'string' &&
    typeof area.score === 'number' &&
    typeof area.clubCount === 'number' &&
    typeof area.membershipTotal === 'number'
  )
}

/**
 * Validates that a DistinguishedClubSummary object has all required fields.
 */
function isCompleteDistinguishedClubSummary(
  summary: DistinguishedClubSummary
): boolean {
  return (
    typeof summary.clubId === 'string' &&
    typeof summary.clubName === 'string' &&
    typeof summary.status === 'string' &&
    typeof summary.dcpPoints === 'number' &&
    typeof summary.goalsCompleted === 'number'
  )
}

/**
 * Validates that a DistinguishedProjection object has all required fields.
 */
function isCompleteDistinguishedProjection(
  projection: DistinguishedProjection
): boolean {
  return (
    typeof projection.projectedDistinguished === 'number' &&
    typeof projection.projectedSelect === 'number' &&
    typeof projection.projectedPresident === 'number' &&
    typeof projection.currentDistinguished === 'number' &&
    typeof projection.currentSelect === 'number' &&
    typeof projection.currentPresident === 'number' &&
    typeof projection.projectionDate === 'string'
  )
}

/**
 * Validates that a MembershipTrendPoint has all required fields.
 */
function isCompleteMembershipTrendPoint(point: MembershipTrendPoint): boolean {
  return typeof point.date === 'string' && typeof point.count === 'number'
}

// ============================================================================
// Integration Tests
// ============================================================================

describe('AnalyticsComputer Integration Tests', () => {
  describe('End-to-End Analytics Computation (Requirements 3.1-3.9)', () => {
    it('should produce complete DistrictAnalytics structure from realistic data', async () => {
      // Arrange: Create realistic test data
      const computer = new AnalyticsComputer()
      const clubs = createRealisticClubSet()
      const snapshot = createTestSnapshot('D101', '2024-03-15', clubs)

      // Act: Run the full analytics computation
      const result = await computer.computeDistrictAnalytics('D101', [snapshot])
      const analytics: DistrictAnalytics = result.districtAnalytics

      // Assert: Verify top-level structure
      expect(analytics.districtId).toBe('D101')
      expect(analytics.dateRange).toBeDefined()
      expect(analytics.dateRange.start).toBe('2024-03-15')
      expect(analytics.dateRange.end).toBe('2024-03-15')
      expect(typeof analytics.totalMembership).toBe('number')
      expect(typeof analytics.membershipChange).toBe('number')
    })

    /**
     * Requirement 3.1: allClubs as array of complete ClubTrend objects
     */
    it('should include allClubs as array of complete ClubTrend objects (Req 3.1)', async () => {
      const computer = new AnalyticsComputer()
      const clubs = createRealisticClubSet()
      const snapshot = createTestSnapshot('D101', '2024-03-15', clubs)

      const result = await computer.computeDistrictAnalytics('D101', [snapshot])
      const analytics = result.districtAnalytics

      // Verify allClubs is an array with expected count
      expect(Array.isArray(analytics.allClubs)).toBe(true)
      expect(analytics.allClubs.length).toBe(clubs.length)

      // Verify each club has all required fields
      for (const club of analytics.allClubs) {
        expect(isCompleteClubTrend(club)).toBe(true)
      }

      // Verify specific club data is preserved
      const excellenceClub = analytics.allClubs.find(c => c.clubId === '1001')
      expect(excellenceClub).toBeDefined()
      expect(excellenceClub?.clubName).toBe('Excellence Speakers')
      expect(excellenceClub?.divisionId).toBe('A')
      expect(excellenceClub?.areaId).toBe('A1')
    })

    /**
     * Requirement 3.2: vulnerableClubs as array of complete ClubTrend objects
     */
    it('should include vulnerableClubs as array of complete ClubTrend objects (Req 3.2)', async () => {
      const computer = new AnalyticsComputer()
      const clubs = createRealisticClubSet()
      const snapshot = createTestSnapshot('D101', '2024-03-15', clubs)

      const result = await computer.computeDistrictAnalytics('D101', [snapshot])
      const analytics = result.districtAnalytics

      // Verify vulnerableClubs is an array
      expect(Array.isArray(analytics.vulnerableClubs)).toBe(true)

      // Verify each vulnerable club has all required fields
      for (const club of analytics.vulnerableClubs) {
        expect(isCompleteClubTrend(club)).toBe(true)
      }

      // Verify vulnerable clubs have appropriate health status
      for (const club of analytics.vulnerableClubs) {
        expect(['vulnerable', 'stable']).toContain(club.currentStatus)
      }
    })

    /**
     * Requirement 3.3: thrivingClubs as array of complete ClubTrend objects
     */
    it('should include thrivingClubs as array of complete ClubTrend objects (Req 3.3)', async () => {
      const computer = new AnalyticsComputer()
      const clubs = createRealisticClubSet()
      const snapshot = createTestSnapshot('D101', '2024-03-15', clubs)

      const result = await computer.computeDistrictAnalytics('D101', [snapshot])
      const analytics = result.districtAnalytics

      // Verify thrivingClubs is an array
      expect(Array.isArray(analytics.thrivingClubs)).toBe(true)
      expect(analytics.thrivingClubs.length).toBeGreaterThan(0)

      // Verify each thriving club has all required fields
      for (const club of analytics.thrivingClubs) {
        expect(isCompleteClubTrend(club)).toBe(true)
      }

      // Verify thriving clubs have 'thriving' status
      for (const club of analytics.thrivingClubs) {
        expect(club.currentStatus).toBe('thriving')
      }
    })

    /**
     * Requirement 3.4: interventionRequiredClubs as array of complete ClubTrend objects
     */
    it('should include interventionRequiredClubs as array of complete ClubTrend objects (Req 3.4)', async () => {
      const computer = new AnalyticsComputer()
      const clubs = createRealisticClubSet()
      const snapshot = createTestSnapshot('D101', '2024-03-15', clubs)

      const result = await computer.computeDistrictAnalytics('D101', [snapshot])
      const analytics = result.districtAnalytics

      // Verify interventionRequiredClubs is an array
      expect(Array.isArray(analytics.interventionRequiredClubs)).toBe(true)
      expect(analytics.interventionRequiredClubs.length).toBeGreaterThan(0)

      // Verify each intervention required club has all required fields
      for (const club of analytics.interventionRequiredClubs) {
        expect(isCompleteClubTrend(club)).toBe(true)
      }

      // Verify intervention required clubs have appropriate status
      for (const club of analytics.interventionRequiredClubs) {
        expect(club.currentStatus).toBe('intervention_required')
      }

      // Verify the struggling club is in intervention required
      const strugglingClub = analytics.interventionRequiredClubs.find(
        c => c.clubId === '1006'
      )
      expect(strugglingClub).toBeDefined()
      expect(strugglingClub?.clubName).toBe('Struggling Club')
    })

    /**
     * Requirement 3.5: membershipTrend as array of date/count objects
     */
    it('should include membershipTrend as array of date/count objects (Req 3.5)', async () => {
      const computer = new AnalyticsComputer()
      const snapshots = createMultipleSnapshots('D101')

      const result = await computer.computeDistrictAnalytics('D101', snapshots)
      const analytics = result.districtAnalytics

      // Verify membershipTrend is an array
      expect(Array.isArray(analytics.membershipTrend)).toBe(true)
      expect(analytics.membershipTrend.length).toBe(3) // 3 snapshots

      // Verify each trend point has required fields
      for (const point of analytics.membershipTrend) {
        expect(isCompleteMembershipTrendPoint(point)).toBe(true)
      }

      // Verify trend data is in chronological order
      expect(analytics.membershipTrend[0]?.date).toBe('2024-01-15')
      expect(analytics.membershipTrend[1]?.date).toBe('2024-02-15')
      expect(analytics.membershipTrend[2]?.date).toBe('2024-03-15')

      // Verify membership counts are reasonable
      for (const point of analytics.membershipTrend) {
        expect(point.count).toBeGreaterThan(0)
      }
    })

    /**
     * Requirement 3.6: divisionRankings as array of DivisionRanking objects
     */
    it('should include divisionRankings as array of DivisionRanking objects (Req 3.6)', async () => {
      const computer = new AnalyticsComputer()
      const clubs = createRealisticClubSet()
      const snapshot = createTestSnapshot('D101', '2024-03-15', clubs)

      const result = await computer.computeDistrictAnalytics('D101', [snapshot])
      const analytics = result.districtAnalytics

      // Verify divisionRankings is an array
      expect(Array.isArray(analytics.divisionRankings)).toBe(true)
      expect(analytics.divisionRankings.length).toBeGreaterThan(0)

      // Verify each ranking has all required fields
      for (const ranking of analytics.divisionRankings) {
        expect(isCompleteDivisionRanking(ranking)).toBe(true)
      }

      // Verify rankings are sorted by rank
      for (let i = 0; i < analytics.divisionRankings.length; i++) {
        expect(analytics.divisionRankings[i]?.rank).toBe(i + 1)
      }

      // Verify we have rankings for all divisions in test data (A, B, C)
      const divisionIds = analytics.divisionRankings.map(r => r.divisionId)
      expect(divisionIds).toContain('A')
      expect(divisionIds).toContain('B')
      expect(divisionIds).toContain('C')
    })

    /**
     * Requirement 3.7: topPerformingAreas as array of AreaPerformance objects
     */
    it('should include topPerformingAreas as array of AreaPerformance objects (Req 3.7)', async () => {
      const computer = new AnalyticsComputer()
      const clubs = createRealisticClubSet()
      const snapshot = createTestSnapshot('D101', '2024-03-15', clubs)

      const result = await computer.computeDistrictAnalytics('D101', [snapshot])
      const analytics = result.districtAnalytics

      // Verify topPerformingAreas is an array
      expect(Array.isArray(analytics.topPerformingAreas)).toBe(true)
      expect(analytics.topPerformingAreas.length).toBeGreaterThan(0)

      // Verify each area has all required fields
      for (const area of analytics.topPerformingAreas) {
        expect(isCompleteAreaPerformance(area)).toBe(true)
      }

      // Verify areas are sorted by score (descending)
      for (let i = 1; i < analytics.topPerformingAreas.length; i++) {
        const prev = analytics.topPerformingAreas[i - 1]
        const curr = analytics.topPerformingAreas[i]
        expect(prev?.score).toBeGreaterThanOrEqual(curr?.score ?? 0)
      }
    })

    /**
     * Requirement 3.8: distinguishedClubsList as array of DistinguishedClubSummary objects
     */
    it('should include distinguishedClubsList as array of DistinguishedClubSummary objects (Req 3.8)', async () => {
      const computer = new AnalyticsComputer()
      const clubs = createRealisticClubSet()
      const snapshot = createTestSnapshot('D101', '2024-03-15', clubs)

      const result = await computer.computeDistrictAnalytics('D101', [snapshot])
      const analytics = result.districtAnalytics

      // Verify distinguishedClubsList is an array
      expect(Array.isArray(analytics.distinguishedClubsList)).toBe(true)
      expect(analytics.distinguishedClubsList.length).toBeGreaterThan(0)

      // Verify each summary has all required fields
      for (const summary of analytics.distinguishedClubsList) {
        expect(isCompleteDistinguishedClubSummary(summary)).toBe(true)
      }

      // Verify status values are valid
      const validStatuses = [
        'smedley',
        'president',
        'select',
        'distinguished',
        'none',
      ]
      for (const summary of analytics.distinguishedClubsList) {
        expect(validStatuses).toContain(summary.status)
      }

      // Verify we have the expected distinguished clubs from test data
      // Club 1001 has 10 goals, 28 members -> Smedley
      // Club 1002 has 9 goals, 25 members -> President
      // Club 1003 has 7 goals, 22 members -> Select
      // Club 1004 has 5 goals, 20 members -> Distinguished
      const clubIds = analytics.distinguishedClubsList.map(s => s.clubId)
      expect(clubIds).toContain('1001')
      expect(clubIds).toContain('1002')
      expect(clubIds).toContain('1003')
      expect(clubIds).toContain('1004')
    })

    /**
     * Requirement 3.9: distinguishedProjection as DistinguishedProjection object
     */
    it('should include distinguishedProjection as DistinguishedProjection object (Req 3.9)', async () => {
      const computer = new AnalyticsComputer()
      const clubs = createRealisticClubSet()
      const snapshot = createTestSnapshot('D101', '2024-03-15', clubs)

      const result = await computer.computeDistrictAnalytics('D101', [snapshot])
      const analytics = result.districtAnalytics

      // Verify distinguishedProjection exists and has all required fields
      expect(analytics.distinguishedProjection).toBeDefined()
      expect(
        isCompleteDistinguishedProjection(analytics.distinguishedProjection)
      ).toBe(true)

      // Verify projection values are non-negative
      expect(
        analytics.distinguishedProjection.projectedDistinguished
      ).toBeGreaterThanOrEqual(0)
      expect(
        analytics.distinguishedProjection.projectedSelect
      ).toBeGreaterThanOrEqual(0)
      expect(
        analytics.distinguishedProjection.projectedPresident
      ).toBeGreaterThanOrEqual(0)
      expect(
        analytics.distinguishedProjection.currentDistinguished
      ).toBeGreaterThanOrEqual(0)
      expect(
        analytics.distinguishedProjection.currentSelect
      ).toBeGreaterThanOrEqual(0)
      expect(
        analytics.distinguishedProjection.currentPresident
      ).toBeGreaterThanOrEqual(0)

      // Verify projection date is set
      expect(analytics.distinguishedProjection.projectionDate).toBeTruthy()
    })

    /**
     * Verify distinguishedClubs counts object is populated correctly
     */
    it('should include distinguishedClubs as counts object with all levels', async () => {
      const computer = new AnalyticsComputer()
      const clubs = createRealisticClubSet()
      const snapshot = createTestSnapshot('D101', '2024-03-15', clubs)

      const result = await computer.computeDistrictAnalytics('D101', [snapshot])
      const analytics = result.districtAnalytics

      // Verify distinguishedClubs is a counts object
      expect(analytics.distinguishedClubs).toBeDefined()
      expect(typeof analytics.distinguishedClubs.smedley).toBe('number')
      expect(typeof analytics.distinguishedClubs.presidents).toBe('number')
      expect(typeof analytics.distinguishedClubs.select).toBe('number')
      expect(typeof analytics.distinguishedClubs.distinguished).toBe('number')
      expect(typeof analytics.distinguishedClubs.total).toBe('number')

      // Verify counts are non-negative
      expect(analytics.distinguishedClubs.smedley).toBeGreaterThanOrEqual(0)
      expect(analytics.distinguishedClubs.presidents).toBeGreaterThanOrEqual(0)
      expect(analytics.distinguishedClubs.select).toBeGreaterThanOrEqual(0)
      expect(analytics.distinguishedClubs.distinguished).toBeGreaterThanOrEqual(
        0
      )

      // Verify total equals sum of individual counts
      const expectedTotal =
        analytics.distinguishedClubs.smedley +
        analytics.distinguishedClubs.presidents +
        analytics.distinguishedClubs.select +
        analytics.distinguishedClubs.distinguished
      expect(analytics.distinguishedClubs.total).toBe(expectedTotal)
    })
  })

  describe('ClubTrend Field Completeness', () => {
    /**
     * Verify all ClubTrend fields are populated with correct types
     */
    it('should populate all ClubTrend fields with correct types', async () => {
      const computer = new AnalyticsComputer()
      const clubs = createRealisticClubSet()
      const snapshot = createTestSnapshot('D101', '2024-03-15', clubs)

      const result = await computer.computeDistrictAnalytics('D101', [snapshot])
      const clubTrend = result.districtAnalytics.allClubs[0]!

      // Core identification
      expect(typeof clubTrend.clubId).toBe('string')
      expect(typeof clubTrend.clubName).toBe('string')

      // Division and area info
      expect(typeof clubTrend.divisionId).toBe('string')
      expect(typeof clubTrend.divisionName).toBe('string')
      expect(typeof clubTrend.areaId).toBe('string')
      expect(typeof clubTrend.areaName).toBe('string')

      // Health assessment
      expect(typeof clubTrend.currentStatus).toBe('string')
      expect([
        'thriving',
        'stable',
        'vulnerable',
        'intervention_required',
      ]).toContain(clubTrend.currentStatus)
      expect(typeof clubTrend.healthScore).toBe('number')

      // Membership data
      expect(typeof clubTrend.membershipCount).toBe('number')
      expect(typeof clubTrend.paymentsCount).toBe('number')

      // Trend arrays
      expect(Array.isArray(clubTrend.membershipTrend)).toBe(true)
      expect(Array.isArray(clubTrend.dcpGoalsTrend)).toBe(true)

      // Risk factors
      expect(Array.isArray(clubTrend.riskFactors)).toBe(true)

      // Distinguished level
      expect(typeof clubTrend.distinguishedLevel).toBe('string')
      expect([
        'NotDistinguished',
        'Smedley',
        'President',
        'Select',
        'Distinguished',
      ]).toContain(clubTrend.distinguishedLevel)
    })

    /**
     * Verify optional payment fields are populated when available
     */
    it('should populate optional payment fields when available', async () => {
      const computer = new AnalyticsComputer()
      const clubs = createRealisticClubSet()
      const snapshot = createTestSnapshot('D101', '2024-03-15', clubs)

      const result = await computer.computeDistrictAnalytics('D101', [snapshot])

      // Find a club with payment data
      const excellenceClub = result.districtAnalytics.allClubs.find(
        c => c.clubId === '1001'
      )
      expect(excellenceClub).toBeDefined()

      // Verify payment fields are numbers (may be 0 or positive)
      expect(typeof excellenceClub?.octoberRenewals).toBe('number')
      expect(typeof excellenceClub?.aprilRenewals).toBe('number')
      expect(typeof excellenceClub?.newMembers).toBe('number')
    })

    /**
     * Verify club status is extracted correctly
     */
    it('should extract club status correctly', async () => {
      const computer = new AnalyticsComputer()
      const clubs = createRealisticClubSet()
      const snapshot = createTestSnapshot('D101', '2024-03-15', clubs)

      const result = await computer.computeDistrictAnalytics('D101', [snapshot])

      // Find the struggling club with 'Low' status
      const strugglingClub = result.districtAnalytics.allClubs.find(
        c => c.clubId === '1006'
      )
      expect(strugglingClub).toBeDefined()
      expect(strugglingClub?.clubStatus).toBe('Low')

      // Find an active club
      const activeClub = result.districtAnalytics.allClubs.find(
        c => c.clubId === '1001'
      )
      expect(activeClub).toBeDefined()
      expect(activeClub?.clubStatus).toBe('Active')
    })
  })

  describe('Trend Data with Multiple Snapshots', () => {
    /**
     * Verify club-level trends are built from multiple snapshots
     */
    it('should build club-level membership trends from multiple snapshots', async () => {
      const computer = new AnalyticsComputer()
      const snapshots = createMultipleSnapshots('D101')

      const result = await computer.computeDistrictAnalytics('D101', snapshots)

      // Find a club that exists in all snapshots
      const excellenceClub = result.districtAnalytics.allClubs.find(
        c => c.clubId === '1001'
      )
      expect(excellenceClub).toBeDefined()

      // Verify membership trend has entries for all snapshots
      expect(excellenceClub?.membershipTrend.length).toBe(3)

      // Verify trend shows growth over time
      expect(excellenceClub?.membershipTrend[0]?.count).toBe(24) // Jan
      expect(excellenceClub?.membershipTrend[1]?.count).toBe(26) // Feb
      expect(excellenceClub?.membershipTrend[2]?.count).toBe(28) // Mar
    })

    /**
     * Verify club-level DCP goals trends are built from multiple snapshots
     */
    it('should build club-level DCP goals trends from multiple snapshots', async () => {
      const computer = new AnalyticsComputer()
      const snapshots = createMultipleSnapshots('D101')

      const result = await computer.computeDistrictAnalytics('D101', snapshots)

      // Find a club that exists in all snapshots
      const excellenceClub = result.districtAnalytics.allClubs.find(
        c => c.clubId === '1001'
      )
      expect(excellenceClub).toBeDefined()

      // Verify DCP goals trend has entries for all snapshots
      expect(excellenceClub?.dcpGoalsTrend.length).toBe(3)

      // Verify trend shows progress over time
      expect(excellenceClub?.dcpGoalsTrend[0]?.goalsAchieved).toBe(6) // Jan
      expect(excellenceClub?.dcpGoalsTrend[1]?.goalsAchieved).toBe(8) // Feb
      expect(excellenceClub?.dcpGoalsTrend[2]?.goalsAchieved).toBe(10) // Mar
    })

    /**
     * Verify date range is calculated correctly from multiple snapshots
     */
    it('should calculate correct date range from multiple snapshots', async () => {
      const computer = new AnalyticsComputer()
      const snapshots = createMultipleSnapshots('D101')

      const result = await computer.computeDistrictAnalytics('D101', snapshots)
      const analytics = result.districtAnalytics

      expect(analytics.dateRange.start).toBe('2024-01-15')
      expect(analytics.dateRange.end).toBe('2024-03-15')
    })

    /**
     * Verify membership change is calculated from first to last snapshot
     */
    it('should calculate membership change from first to last snapshot', async () => {
      const computer = new AnalyticsComputer()
      const snapshots = createMultipleSnapshots('D101')

      const result = await computer.computeDistrictAnalytics('D101', snapshots)
      const analytics = result.districtAnalytics

      // Total membership in Jan: 24 + 22 + 18 = 64
      // Total membership in Mar: 28 + 25 + 22 = 75
      // Change: 75 - 64 = 11
      expect(analytics.membershipChange).toBe(11)
      expect(analytics.totalMembership).toBe(75)
    })
  })
})
