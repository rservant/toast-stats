/**
 * Unit tests for AnalyticsComputer.computePerformanceTargets - paidClubsCount computation
 *
 * Tests that paidClubsCount correctly counts only clubs with "Active" status.
 * Per the design document, paidClubsCount is computed by summing paidClubs from
 * all area recognitions, where paidClubs counts clubs with "Active" status.
 *
 * **Validates: Requirements 1.2, 4.3**
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { AnalyticsComputer } from '../AnalyticsComputer.js'
import type { DistrictStatistics, ClubStatistics } from '../../interfaces.js'

/**
 * Helper to create a mock club with specified status
 */
function createMockClub(
  overrides: Partial<ClubStatistics> = {}
): ClubStatistics {
  return {
    clubId: overrides.clubId ?? '1234',
    clubName: overrides.clubName ?? 'Test Club',
    divisionId: overrides.divisionId ?? 'A',
    areaId: overrides.areaId ?? 'A1',
    divisionName: 'Division A',
    areaName: 'Area A1',
    membershipCount: overrides.membershipCount ?? 25,
    paymentsCount: overrides.paymentsCount ?? 20,
    dcpGoals: overrides.dcpGoals ?? 5,
    status: overrides.status ?? 'Active',
    clubStatus: overrides.clubStatus,
    octoberRenewals: 10,
    aprilRenewals: 5,
    newMembers: 5,
    membershipBase: overrides.membershipBase ?? 20,
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
      distinguishedClubs: 0,
      selectDistinguishedClubs: 0,
      presidentDistinguishedClubs: 0,
    },
  }
}

describe('computePerformanceTargets - paidClubsCount computation', () => {
  let computer: AnalyticsComputer

  beforeEach(() => {
    computer = new AnalyticsComputer()
  })

  describe('paidClubsCount counts only Active clubs', () => {
    /**
     * Test: Snapshot with mixed statuses
     * 3 Active, 2 Suspended, 1 Low → paidClubsCount: 3
     *
     * Rule being tested: paidClubsCount SHALL count only clubs with "Active" status
     *
     * **Validates: Requirements 1.2, 4.3**
     */
    it('should count only Active clubs when snapshot has mixed statuses', () => {
      const clubs = [
        // 3 Active clubs
        createMockClub({ clubId: '1', status: 'Active', areaId: 'A1' }),
        createMockClub({ clubId: '2', status: 'Active', areaId: 'A1' }),
        createMockClub({ clubId: '3', status: 'Active', areaId: 'A2' }),
        // 2 Suspended clubs
        createMockClub({ clubId: '4', status: 'Suspended', areaId: 'A2' }),
        createMockClub({ clubId: '5', status: 'Suspended', areaId: 'A3' }),
        // 1 Low club
        createMockClub({ clubId: '6', status: 'Low', areaId: 'A3' }),
      ]
      const snapshot = createMockSnapshot('D101', '2024-01-15', clubs)

      const result = computer.computePerformanceTargets('D101', [snapshot])

      expect(result.paidClubsCount).toBe(3)
    })

    /**
     * Test: All clubs Active
     * 5 Active → paidClubsCount: 5
     *
     * Rule being tested: All Active clubs should be counted as paid
     *
     * **Validates: Requirements 1.2, 4.3**
     */
    it('should count all clubs when all are Active', () => {
      const clubs = [
        createMockClub({ clubId: '1', status: 'Active', areaId: 'A1' }),
        createMockClub({ clubId: '2', status: 'Active', areaId: 'A1' }),
        createMockClub({ clubId: '3', status: 'Active', areaId: 'A2' }),
        createMockClub({ clubId: '4', status: 'Active', areaId: 'A2' }),
        createMockClub({ clubId: '5', status: 'Active', areaId: 'A3' }),
      ]
      const snapshot = createMockSnapshot('D101', '2024-01-15', clubs)

      const result = computer.computePerformanceTargets('D101', [snapshot])

      expect(result.paidClubsCount).toBe(5)
    })

    /**
     * Test: All clubs Suspended
     * 3 Suspended → paidClubsCount: 0
     *
     * Rule being tested: Suspended clubs should not be counted as paid
     *
     * **Validates: Requirements 1.2, 4.3**
     */
    it('should return zero when all clubs are Suspended', () => {
      const clubs = [
        createMockClub({ clubId: '1', status: 'Suspended', areaId: 'A1' }),
        createMockClub({ clubId: '2', status: 'Suspended', areaId: 'A2' }),
        createMockClub({ clubId: '3', status: 'Suspended', areaId: 'A3' }),
      ]
      const snapshot = createMockSnapshot('D101', '2024-01-15', clubs)

      const result = computer.computePerformanceTargets('D101', [snapshot])

      expect(result.paidClubsCount).toBe(0)
    })

    /**
     * Test: Empty snapshot
     * No clubs → paidClubsCount: 0
     *
     * Rule being tested: Empty snapshot should return zero paid clubs
     *
     * **Validates: Requirements 1.2, 4.3**
     */
    it('should return zero for empty snapshot', () => {
      const snapshot = createMockSnapshot('D101', '2024-01-15', [])

      const result = computer.computePerformanceTargets('D101', [snapshot])

      expect(result.paidClubsCount).toBe(0)
    })
  })

  describe('paidClubsCount edge cases', () => {
    /**
     * Test: clubStatus field takes precedence when both status and clubStatus exist
     *
     * The isClubPaid method checks clubStatus first, then falls back to status.
     * This test verifies the precedence behavior.
     */
    it('should use clubStatus field when present', () => {
      const clubs = [
        // clubStatus is Active, status is Suspended - should be counted as paid
        createMockClub({
          clubId: '1',
          status: 'Suspended',
          clubStatus: 'Active',
          areaId: 'A1',
        }),
        // clubStatus is Suspended, status is Active - should NOT be counted as paid
        createMockClub({
          clubId: '2',
          status: 'Active',
          clubStatus: 'Suspended',
          areaId: 'A1',
        }),
      ]
      const snapshot = createMockSnapshot('D101', '2024-01-15', clubs)

      const result = computer.computePerformanceTargets('D101', [snapshot])

      // Only the first club should be counted (clubStatus: Active)
      expect(result.paidClubsCount).toBe(1)
    })

    /**
     * Test: Ineligible status should not be counted as paid
     */
    it('should not count Ineligible clubs as paid', () => {
      const clubs = [
        createMockClub({ clubId: '1', status: 'Active', areaId: 'A1' }),
        createMockClub({ clubId: '2', status: 'Ineligible', areaId: 'A1' }),
        createMockClub({ clubId: '3', status: 'Active', areaId: 'A2' }),
      ]
      const snapshot = createMockSnapshot('D101', '2024-01-15', clubs)

      const result = computer.computePerformanceTargets('D101', [snapshot])

      expect(result.paidClubsCount).toBe(2)
    })

    /**
     * Test: Empty string status should be treated as Active (paid)
     *
     * Per isClubPaid implementation: if status is empty string, treat as Active
     */
    it('should treat empty status as Active (paid)', () => {
      const clubs = [
        createMockClub({ clubId: '1', status: '', areaId: 'A1' }),
        createMockClub({ clubId: '2', status: 'Active', areaId: 'A1' }),
      ]
      const snapshot = createMockSnapshot('D101', '2024-01-15', clubs)

      const result = computer.computePerformanceTargets('D101', [snapshot])

      expect(result.paidClubsCount).toBe(2)
    })

    /**
     * Test: Case insensitivity of status field
     *
     * The isClubPaid method converts status to lowercase before comparison
     */
    it('should handle case-insensitive status values', () => {
      const clubs = [
        createMockClub({ clubId: '1', status: 'ACTIVE', areaId: 'A1' }),
        createMockClub({ clubId: '2', status: 'active', areaId: 'A1' }),
        createMockClub({ clubId: '3', status: 'Active', areaId: 'A2' }),
        createMockClub({ clubId: '4', status: 'SUSPENDED', areaId: 'A2' }),
      ]
      const snapshot = createMockSnapshot('D101', '2024-01-15', clubs)

      const result = computer.computePerformanceTargets('D101', [snapshot])

      expect(result.paidClubsCount).toBe(3)
    })

    /**
     * Test: paidClubsCount is always non-negative
     *
     * **Validates: Requirement 4.3** - paidClubsCount SHALL be typed as non-negative integer
     */
    it('should always return non-negative paidClubsCount', () => {
      // Test with various scenarios
      const scenarios = [
        [], // empty
        [createMockClub({ clubId: '1', status: 'Suspended', areaId: 'A1' })], // all suspended
        [createMockClub({ clubId: '1', status: 'Active', areaId: 'A1' })], // one active
      ]

      for (const clubs of scenarios) {
        const snapshot = createMockSnapshot('D101', '2024-01-15', clubs)
        const result = computer.computePerformanceTargets('D101', [snapshot])

        expect(result.paidClubsCount).toBeGreaterThanOrEqual(0)
        expect(Number.isInteger(result.paidClubsCount)).toBe(true)
      }
    })
  })
})
