/**
 * Unit tests for AnalyticsComputer.computePerformanceTargets with rankings integration
 *
 * Tests the integration of MetricRankingsCalculator into computePerformanceTargets,
 * verifying that world ranks are correctly extracted from allDistrictsRankings data
 * and that null handling works correctly.
 *
 * Also verifies that paidClubsCount is included in computation results.
 *
 * **Validates: Requirements 1.2, 1.3, 1.4, 1.5**
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { AnalyticsComputer } from '../AnalyticsComputer.js'
import type { DistrictStatistics, ClubStatistics } from '../../interfaces.js'
import type {
  AllDistrictsRankingsData,
  DistrictRanking,
} from '@toastmasters/shared-contracts'

/**
 * Helper to create a mock club
 */
function createMockClub(
  overrides: Partial<ClubStatistics> = {}
): ClubStatistics {
  return {
    clubId: '1234',
    clubName: 'Test Club',
    divisionId: 'A',
    areaId: 'A1',
    divisionName: 'Division A',
    areaName: 'Area A1',
    membershipCount: 25,
    paymentsCount: 20,
    dcpGoals: 5,
    status: 'Active',
    octoberRenewals: 10,
    aprilRenewals: 5,
    newMembers: 5,
    membershipBase: 20,
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

/**
 * Helper to create a minimal AllDistrictsRankingsData structure for testing.
 */
function createRankingsData(
  rankings: Partial<DistrictRanking>[],
  totalDistricts?: number
): AllDistrictsRankingsData {
  const fullRankings = rankings.map((r, index) => ({
    districtId: r.districtId ?? `${index + 1}`,
    districtName: r.districtName ?? `District ${index + 1}`,
    region: r.region ?? 'Region 1',
    paidClubs: r.paidClubs ?? 100,
    paidClubBase: r.paidClubBase ?? 95,
    clubGrowthPercent: r.clubGrowthPercent ?? 5.0,
    totalPayments: r.totalPayments ?? 5000,
    paymentBase: r.paymentBase ?? 4800,
    paymentGrowthPercent: r.paymentGrowthPercent ?? 4.0,
    activeClubs: r.activeClubs ?? 98,
    distinguishedClubs: r.distinguishedClubs ?? 45,
    selectDistinguished: r.selectDistinguished ?? 15,
    presidentsDistinguished: r.presidentsDistinguished ?? 10,
    distinguishedPercent: r.distinguishedPercent ?? 45.0,
    clubsRank: r.clubsRank ?? index + 1,
    paymentsRank: r.paymentsRank ?? index + 1,
    distinguishedRank: r.distinguishedRank ?? index + 1,
    aggregateScore: r.aggregateScore ?? 150,
    overallRank: r.overallRank ?? index + 1,
  }))

  return {
    metadata: {
      snapshotId: '2024-01-15',
      calculatedAt: '2024-01-15T00:00:00.000Z',
      schemaVersion: '1.0',
      calculationVersion: '1.0',
      rankingVersion: '2.0',
      sourceCsvDate: '2024-01-15',
      csvFetchedAt: '2024-01-15T00:00:00.000Z',
      totalDistricts: totalDistricts ?? fullRankings.length,
      fromCache: false,
    },
    rankings: fullRankings,
  }
}

describe('computePerformanceTargets with rankings integration', () => {
  let computer: AnalyticsComputer

  beforeEach(() => {
    computer = new AnalyticsComputer()
  })

  describe('null allDistrictsRankings handling', () => {
    /**
     * Test that null allDistrictsRankings results in null rankings
     *
     * **Validates: Requirement 1.5**
     */
    it('should return null rankings when allDistrictsRankings is undefined', () => {
      const clubs = [
        createMockClub({
          clubId: '1',
          areaId: 'A1',
          areaName: 'Area A1',
          divisionId: 'A',
          membershipCount: 100,
          dcpGoals: 5,
          status: 'Active',
        }),
      ]
      const snapshot = createMockSnapshot('D101', '2024-01-15', clubs)

      // Call without allDistrictsRankings parameter
      const result = computer.computePerformanceTargets('D101', [snapshot])

      // All rankings should be null
      expect(result.paidClubsRankings.worldRank).toBeNull()
      expect(result.paidClubsRankings.worldPercentile).toBeNull()
      expect(result.paidClubsRankings.regionRank).toBeNull()
      expect(result.paidClubsRankings.totalDistricts).toBe(0)
      expect(result.paidClubsRankings.totalInRegion).toBe(0)
      expect(result.paidClubsRankings.region).toBeNull()

      expect(result.membershipPaymentsRankings.worldRank).toBeNull()
      expect(result.membershipPaymentsRankings.worldPercentile).toBeNull()
      expect(result.membershipPaymentsRankings.regionRank).toBeNull()

      expect(result.distinguishedClubsRankings.worldRank).toBeNull()
      expect(result.distinguishedClubsRankings.worldPercentile).toBeNull()
      expect(result.distinguishedClubsRankings.regionRank).toBeNull()

      // Verify paidClubsCount is included and correct (1 Active club)
      // **Validates: Requirement 1.2**
      expect(result.paidClubsCount).toBeDefined()
      expect(result.paidClubsCount).toBe(1)
      expect(Number.isInteger(result.paidClubsCount)).toBe(true)
      expect(result.paidClubsCount).toBeGreaterThanOrEqual(0)
    })

    it('should return null rankings for empty snapshots with undefined allDistrictsRankings', () => {
      const result = computer.computePerformanceTargets('D101', [])

      expect(result.paidClubsRankings.worldRank).toBeNull()
      expect(result.membershipPaymentsRankings.worldRank).toBeNull()
      expect(result.distinguishedClubsRankings.worldRank).toBeNull()

      // Verify paidClubsCount is included and zero for empty snapshots
      // **Validates: Requirement 1.2**
      expect(result.paidClubsCount).toBeDefined()
      expect(result.paidClubsCount).toBe(0)
      expect(Number.isInteger(result.paidClubsCount)).toBe(true)
    })
  })

  describe('world rank extraction from allDistrictsRankings', () => {
    /**
     * Test that clubsRank is extracted as worldRank for paidClubsRankings
     *
     * **Validates: Requirement 1.2**
     */
    it('should extract clubsRank as paidClubsRankings.worldRank', () => {
      const clubs = [
        createMockClub({
          clubId: '1',
          areaId: 'A1',
          areaName: 'Area A1',
          divisionId: 'A',
          membershipCount: 100,
          status: 'Active',
        }),
      ]
      const snapshot = createMockSnapshot('D101', '2024-01-15', clubs)

      const allDistrictsRankings = createRankingsData(
        [
          {
            districtId: 'D101',
            clubsRank: 5,
            paymentsRank: 10,
            distinguishedRank: 3,
            region: 'Region 10',
          },
        ],
        100
      )

      const result = computer.computePerformanceTargets(
        'D101',
        [snapshot],
        allDistrictsRankings
      )

      expect(result.paidClubsRankings.worldRank).toBe(5)

      // Verify paidClubsCount is included (1 Active club)
      // **Validates: Requirement 1.2**
      expect(result.paidClubsCount).toBeDefined()
      expect(result.paidClubsCount).toBe(1)
    })

    /**
     * Test that paymentsRank is extracted as worldRank for membershipPaymentsRankings
     *
     * **Validates: Requirement 1.3**
     */
    it('should extract paymentsRank as membershipPaymentsRankings.worldRank', () => {
      const clubs = [
        createMockClub({
          clubId: '1',
          areaId: 'A1',
          areaName: 'Area A1',
          divisionId: 'A',
          membershipCount: 100,
          status: 'Active',
        }),
      ]
      const snapshot = createMockSnapshot('D101', '2024-01-15', clubs)

      const allDistrictsRankings = createRankingsData(
        [
          {
            districtId: 'D101',
            clubsRank: 5,
            paymentsRank: 10,
            distinguishedRank: 3,
            region: 'Region 10',
          },
        ],
        100
      )

      const result = computer.computePerformanceTargets(
        'D101',
        [snapshot],
        allDistrictsRankings
      )

      expect(result.membershipPaymentsRankings.worldRank).toBe(10)
    })

    /**
     * Test that distinguishedRank is extracted as worldRank for distinguishedClubsRankings
     *
     * **Validates: Requirement 1.4**
     */
    it('should extract distinguishedRank as distinguishedClubsRankings.worldRank', () => {
      const clubs = [
        createMockClub({
          clubId: '1',
          areaId: 'A1',
          areaName: 'Area A1',
          divisionId: 'A',
          membershipCount: 100,
          status: 'Active',
        }),
      ]
      const snapshot = createMockSnapshot('D101', '2024-01-15', clubs)

      const allDistrictsRankings = createRankingsData(
        [
          {
            districtId: 'D101',
            clubsRank: 5,
            paymentsRank: 10,
            distinguishedRank: 3,
            region: 'Region 10',
          },
        ],
        100
      )

      const result = computer.computePerformanceTargets(
        'D101',
        [snapshot],
        allDistrictsRankings
      )

      expect(result.distinguishedClubsRankings.worldRank).toBe(3)
    })
  })

  describe('valid allDistrictsRankings data', () => {
    /**
     * Test complete rankings structure with valid data
     */
    it('should return complete rankings with all fields populated', () => {
      const clubs = [
        createMockClub({
          clubId: '1',
          areaId: 'A1',
          areaName: 'Area A1',
          divisionId: 'A',
          membershipCount: 100,
          dcpGoals: 6,
          status: 'Active',
        }),
      ]
      const snapshot = createMockSnapshot('D101', '2024-01-15', clubs)

      const allDistrictsRankings = createRankingsData(
        [
          {
            districtId: 'D101',
            clubsRank: 5,
            paymentsRank: 10,
            distinguishedRank: 3,
            region: 'Region 10',
            clubGrowthPercent: 8.0,
            paymentGrowthPercent: 6.0,
            distinguishedPercent: 50.0,
          },
          {
            districtId: 'D102',
            clubsRank: 15,
            paymentsRank: 20,
            distinguishedRank: 12,
            region: 'Region 10',
            clubGrowthPercent: 5.0,
            paymentGrowthPercent: 4.0,
            distinguishedPercent: 40.0,
          },
        ],
        100
      )

      const result = computer.computePerformanceTargets(
        'D101',
        [snapshot],
        allDistrictsRankings
      )

      // Verify paidClubsRankings
      expect(result.paidClubsRankings.worldRank).toBe(5)
      expect(result.paidClubsRankings.worldPercentile).toBe(95.0) // ((100-5)/100)*100
      expect(result.paidClubsRankings.regionRank).toBe(1) // D101 has higher clubGrowthPercent
      expect(result.paidClubsRankings.totalDistricts).toBe(100)
      expect(result.paidClubsRankings.totalInRegion).toBe(2)
      expect(result.paidClubsRankings.region).toBe('Region 10')

      // Verify membershipPaymentsRankings
      expect(result.membershipPaymentsRankings.worldRank).toBe(10)
      expect(result.membershipPaymentsRankings.worldPercentile).toBe(90.0) // ((100-10)/100)*100
      expect(result.membershipPaymentsRankings.regionRank).toBe(1)
      expect(result.membershipPaymentsRankings.totalDistricts).toBe(100)

      // Verify distinguishedClubsRankings
      expect(result.distinguishedClubsRankings.worldRank).toBe(3)
      expect(result.distinguishedClubsRankings.worldPercentile).toBe(97.0) // ((100-3)/100)*100
      expect(result.distinguishedClubsRankings.regionRank).toBe(1)
      expect(result.distinguishedClubsRankings.totalDistricts).toBe(100)

      // Verify paidClubsCount is included and correct (1 Active club)
      // **Validates: Requirement 1.2**
      expect(result.paidClubsCount).toBeDefined()
      expect(result.paidClubsCount).toBe(1)
      expect(Number.isInteger(result.paidClubsCount)).toBe(true)
      expect(result.paidClubsCount).toBeGreaterThanOrEqual(0)
    })

    it('should return null rankings when district not found in allDistrictsRankings', () => {
      const clubs = [
        createMockClub({
          clubId: '1',
          areaId: 'A1',
          areaName: 'Area A1',
          divisionId: 'A',
          membershipCount: 100,
          status: 'Active',
        }),
      ]
      const snapshot = createMockSnapshot('D101', '2024-01-15', clubs)

      // Rankings data does not include D101
      const allDistrictsRankings = createRankingsData(
        [
          {
            districtId: 'D999',
            clubsRank: 5,
            paymentsRank: 10,
            distinguishedRank: 3,
          },
        ],
        100
      )

      const result = computer.computePerformanceTargets(
        'D101',
        [snapshot],
        allDistrictsRankings
      )

      // All rankings should be null when district not found
      expect(result.paidClubsRankings.worldRank).toBeNull()
      expect(result.paidClubsRankings.worldPercentile).toBeNull()
      expect(result.paidClubsRankings.regionRank).toBeNull()
      expect(result.paidClubsRankings.totalDistricts).toBe(0)

      expect(result.membershipPaymentsRankings.worldRank).toBeNull()
      expect(result.distinguishedClubsRankings.worldRank).toBeNull()

      // Verify paidClubsCount is still computed correctly even when rankings not found
      // **Validates: Requirement 1.2**
      expect(result.paidClubsCount).toBeDefined()
      expect(result.paidClubsCount).toBe(1)
    })

    it('should still compute performance targets correctly when rankings are provided', () => {
      const clubs = [
        createMockClub({
          clubId: '1',
          areaId: 'A1',
          areaName: 'Area A1',
          divisionId: 'A',
          membershipCount: 100,
          dcpGoals: 6,
          status: 'Active',
        }),
      ]
      const snapshot = createMockSnapshot('D101', '2024-01-15', clubs)

      const allDistrictsRankings = createRankingsData(
        [
          {
            districtId: 'D101',
            clubsRank: 5,
            paymentsRank: 10,
            distinguishedRank: 3,
            region: 'Region 10',
          },
        ],
        100
      )

      const result = computer.computePerformanceTargets(
        'D101',
        [snapshot],
        allDistrictsRankings
      )

      // Verify that performance targets are still computed correctly
      expect(result.districtId).toBe('D101')
      expect(result.membershipTarget).toBe(105) // ceil(100 * 1.05)
      expect(result.currentProgress.membership).toBe(100)
      expect(result.computedAt).toBeDefined()

      // And rankings are also populated
      expect(result.paidClubsRankings.worldRank).toBe(5)

      // Verify paidClubsCount is included and correct (1 Active club)
      // **Validates: Requirement 1.2**
      expect(result.paidClubsCount).toBeDefined()
      expect(result.paidClubsCount).toBe(1)
    })

    it('should handle empty snapshots with valid allDistrictsRankings', () => {
      const allDistrictsRankings = createRankingsData(
        [
          {
            districtId: 'D101',
            clubsRank: 5,
            paymentsRank: 10,
            distinguishedRank: 3,
            region: 'Region 10',
          },
        ],
        100
      )

      const result = computer.computePerformanceTargets(
        'D101',
        [],
        allDistrictsRankings
      )

      // Performance targets should be zero
      expect(result.membershipTarget).toBe(0)
      expect(result.distinguishedTarget).toBe(0)
      expect(result.clubGrowthTarget).toBe(0)

      // But rankings should still be populated from allDistrictsRankings
      expect(result.paidClubsRankings.worldRank).toBe(5)
      expect(result.membershipPaymentsRankings.worldRank).toBe(10)
      expect(result.distinguishedClubsRankings.worldRank).toBe(3)

      // Verify paidClubsCount is zero for empty snapshots
      // **Validates: Requirement 1.2**
      expect(result.paidClubsCount).toBeDefined()
      expect(result.paidClubsCount).toBe(0)
      expect(Number.isInteger(result.paidClubsCount)).toBe(true)
    })
  })
})
