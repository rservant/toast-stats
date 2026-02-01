/**
 * AreaDivisionRecognitionModule Unit Tests
 *
 * Tests for Distinguished Area Program (DAP) and Distinguished Division Program (DDP)
 * recognition calculations per steering document dap-ddp-recognition.md.
 *
 * Per testing.md Section 7.3: "Would 5 well-chosen examples provide equivalent confidence?
 * If yes, prefer the examples." - These boundary tests are clearer than properties.
 *
 * Requirements: 7.1
 */

import { describe, it, expect } from 'vitest'
import {
  AreaDivisionRecognitionModule,
  DAP_THRESHOLDS,
  DDP_THRESHOLDS,
} from './AreaDivisionRecognitionModule.js'
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
  status = 'Active'
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
    status,
    clubStatus: status,
    octoberRenewals: Math.floor(membershipCount * 0.4),
    aprilRenewals: Math.floor(membershipCount * 0.3),
    newMembers: Math.floor(membershipCount * 0.3),
    membershipBase: membershipCount,
  }
}

/**
 * Helper to create a mock district statistics snapshot
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

describe('AreaDivisionRecognitionModule', () => {
  describe('Threshold Constants', () => {
    it('should export correct DAP thresholds', () => {
      expect(DAP_THRESHOLDS.PAID_CLUBS).toBe(75)
      expect(DAP_THRESHOLDS.DISTINGUISHED).toBe(50)
      expect(DAP_THRESHOLDS.SELECT).toBe(75)
      expect(DAP_THRESHOLDS.PRESIDENTS).toBe(100)
    })

    it('should export correct DDP thresholds', () => {
      expect(DDP_THRESHOLDS.PAID_AREAS).toBe(85)
      expect(DDP_THRESHOLDS.DISTINGUISHED).toBe(50)
      expect(DDP_THRESHOLDS.SELECT).toBe(75)
      expect(DDP_THRESHOLDS.PRESIDENTS).toBe(100)
    })
  })

  describe('calculateAreaRecognition', () => {
    it('should return empty array for snapshot with no clubs', () => {
      const module = new AreaDivisionRecognitionModule()
      const snapshot = createMockSnapshot([])

      const areas = module.calculateAreaRecognition(snapshot)

      expect(areas).toHaveLength(0)
    })

    it('should calculate recognition for each area', () => {
      const module = new AreaDivisionRecognitionModule()
      const clubs = [
        createMockClub('1', 'A', 'A1', 20, 5),
        createMockClub('2', 'A', 'A2', 20, 5),
        createMockClub('3', 'B', 'B1', 20, 5),
      ]
      const snapshot = createMockSnapshot(clubs)

      const areas = module.calculateAreaRecognition(snapshot)

      expect(areas).toHaveLength(3)
    })

    it('should aggregate clubs in the same area', () => {
      const module = new AreaDivisionRecognitionModule()
      const clubs = [
        createMockClub('1', 'A', 'A1', 20, 5),
        createMockClub('2', 'A', 'A1', 20, 7),
        createMockClub('3', 'A', 'A1', 20, 3),
      ]
      const snapshot = createMockSnapshot(clubs)

      const areas = module.calculateAreaRecognition(snapshot)

      expect(areas).toHaveLength(1)
      expect(areas[0]?.totalClubs).toBe(3)
    })
  })

  describe('DAP Recognition Levels', () => {
    /**
     * DAP Thresholds:
     * - Paid clubs threshold: ≥75%
     * - Distinguished: ≥50% of paid clubs distinguished
     * - Select: ≥75% of paid clubs distinguished
     * - Presidents: 100% of paid clubs distinguished
     */

    it('should classify area as NotDistinguished when paid clubs < 75%', () => {
      const module = new AreaDivisionRecognitionModule()
      // 2 out of 4 clubs are paid (50% < 75%)
      const clubs = [
        createMockClub('1', 'A', 'A1', 20, 5, 'Active'),
        createMockClub('2', 'A', 'A1', 20, 5, 'Active'),
        createMockClub('3', 'A', 'A1', 20, 5, 'Suspended'),
        createMockClub('4', 'A', 'A1', 20, 5, 'Suspended'),
      ]
      const snapshot = createMockSnapshot(clubs)

      const areas = module.calculateAreaRecognition(snapshot)

      expect(areas[0]?.recognitionLevel).toBe('NotDistinguished')
      expect(areas[0]?.meetsPaidThreshold).toBe(false)
    })

    it('should classify area as Distinguished when ≥50% of paid clubs are distinguished', () => {
      const module = new AreaDivisionRecognitionModule()
      // All clubs paid, 2 out of 4 distinguished (50%)
      const clubs = [
        createMockClub('1', 'A', 'A1', 20, 5, 'Active'), // Distinguished
        createMockClub('2', 'A', 'A1', 20, 5, 'Active'), // Distinguished
        createMockClub('3', 'A', 'A1', 20, 3, 'Active'), // Not distinguished
        createMockClub('4', 'A', 'A1', 20, 2, 'Active'), // Not distinguished
      ]
      const snapshot = createMockSnapshot(clubs)

      const areas = module.calculateAreaRecognition(snapshot)

      expect(areas[0]?.recognitionLevel).toBe('Distinguished')
      expect(areas[0]?.meetsPaidThreshold).toBe(true)
      expect(areas[0]?.meetsDistinguishedThreshold).toBe(true)
    })

    it('should classify area as Select when ≥75% of paid clubs are distinguished', () => {
      const module = new AreaDivisionRecognitionModule()
      // All clubs paid, 3 out of 4 distinguished (75%)
      const clubs = [
        createMockClub('1', 'A', 'A1', 20, 5, 'Active'), // Distinguished
        createMockClub('2', 'A', 'A1', 20, 6, 'Active'), // Distinguished
        createMockClub('3', 'A', 'A1', 20, 7, 'Active'), // Distinguished
        createMockClub('4', 'A', 'A1', 20, 2, 'Active'), // Not distinguished
      ]
      const snapshot = createMockSnapshot(clubs)

      const areas = module.calculateAreaRecognition(snapshot)

      expect(areas[0]?.recognitionLevel).toBe('Select')
    })

    it('should classify area as Presidents when 100% of paid clubs are distinguished', () => {
      const module = new AreaDivisionRecognitionModule()
      // All clubs paid and distinguished
      const clubs = [
        createMockClub('1', 'A', 'A1', 20, 5, 'Active'),
        createMockClub('2', 'A', 'A1', 20, 6, 'Active'),
        createMockClub('3', 'A', 'A1', 20, 7, 'Active'),
        createMockClub('4', 'A', 'A1', 20, 8, 'Active'),
      ]
      const snapshot = createMockSnapshot(clubs)

      const areas = module.calculateAreaRecognition(snapshot)

      expect(areas[0]?.recognitionLevel).toBe('Presidents')
    })
  })

  describe('Club Paid Status', () => {
    it('should count Active clubs as paid', () => {
      const module = new AreaDivisionRecognitionModule()
      const clubs = [createMockClub('1', 'A', 'A1', 20, 5, 'Active')]
      const snapshot = createMockSnapshot(clubs)

      const areas = module.calculateAreaRecognition(snapshot)

      expect(areas[0]?.paidClubs).toBe(1)
    })

    it('should count Suspended clubs as not paid', () => {
      const module = new AreaDivisionRecognitionModule()
      const clubs = [createMockClub('1', 'A', 'A1', 20, 5, 'Suspended')]
      const snapshot = createMockSnapshot(clubs)

      const areas = module.calculateAreaRecognition(snapshot)

      expect(areas[0]?.paidClubs).toBe(0)
    })

    it('should count clubs with empty status as paid', () => {
      const module = new AreaDivisionRecognitionModule()
      const clubs = [createMockClub('1', 'A', 'A1', 20, 5, '')]
      const snapshot = createMockSnapshot(clubs)

      const areas = module.calculateAreaRecognition(snapshot)

      expect(areas[0]?.paidClubs).toBe(1)
    })
  })

  describe('Club Distinguished Status', () => {
    it('should count clubs with 5+ DCP goals as distinguished', () => {
      const module = new AreaDivisionRecognitionModule()
      const clubs = [createMockClub('1', 'A', 'A1', 20, 5, 'Active')]
      const snapshot = createMockSnapshot(clubs)

      const areas = module.calculateAreaRecognition(snapshot)

      expect(areas[0]?.distinguishedClubs).toBe(1)
    })

    it('should not count clubs with < 5 DCP goals as distinguished', () => {
      const module = new AreaDivisionRecognitionModule()
      const clubs = [createMockClub('1', 'A', 'A1', 20, 4, 'Active')]
      const snapshot = createMockSnapshot(clubs)

      const areas = module.calculateAreaRecognition(snapshot)

      expect(areas[0]?.distinguishedClubs).toBe(0)
    })

    it('should only count paid clubs as distinguished', () => {
      const module = new AreaDivisionRecognitionModule()
      const clubs = [
        createMockClub('1', 'A', 'A1', 20, 5, 'Active'), // Paid and distinguished
        createMockClub('2', 'A', 'A1', 20, 5, 'Suspended'), // Not paid, so not counted
      ]
      const snapshot = createMockSnapshot(clubs)

      const areas = module.calculateAreaRecognition(snapshot)

      expect(areas[0]?.distinguishedClubs).toBe(1)
    })
  })

  describe('calculateDivisionRecognition', () => {
    it('should return empty array for snapshot with no clubs', () => {
      const module = new AreaDivisionRecognitionModule()
      const snapshot = createMockSnapshot([])

      const divisions = module.calculateDivisionRecognition(snapshot)

      expect(divisions).toHaveLength(0)
    })

    it('should calculate recognition for each division', () => {
      const module = new AreaDivisionRecognitionModule()
      const clubs = [
        createMockClub('1', 'A', 'A1', 20, 5),
        createMockClub('2', 'B', 'B1', 20, 5),
      ]
      const snapshot = createMockSnapshot(clubs)

      const divisions = module.calculateDivisionRecognition(snapshot)

      expect(divisions).toHaveLength(2)
    })

    it('should include nested area recognition data', () => {
      const module = new AreaDivisionRecognitionModule()
      const clubs = [
        createMockClub('1', 'A', 'A1', 20, 5),
        createMockClub('2', 'A', 'A2', 20, 5),
      ]
      const snapshot = createMockSnapshot(clubs)

      const divisions = module.calculateDivisionRecognition(snapshot)

      expect(divisions[0]?.areas).toHaveLength(2)
    })
  })

  describe('DDP Recognition Levels', () => {
    /**
     * DDP Thresholds:
     * - Paid areas threshold: ≥85%
     * - Distinguished: ≥50% of paid areas distinguished
     * - Select: ≥75% of paid areas distinguished
     * - Presidents: 100% of paid areas distinguished
     */

    it('should classify division as NotDistinguished when paid areas < 85%', () => {
      const module = new AreaDivisionRecognitionModule()
      // Create areas where some have no paid clubs
      const clubs = [
        createMockClub('1', 'A', 'A1', 20, 5, 'Active'),
        createMockClub('2', 'A', 'A2', 20, 5, 'Suspended'), // Area A2 has no paid clubs
      ]
      const snapshot = createMockSnapshot(clubs)

      const divisions = module.calculateDivisionRecognition(snapshot)

      // Only 1 out of 2 areas is paid (50% < 85%)
      expect(divisions[0]?.meetsPaidThreshold).toBe(false)
      expect(divisions[0]?.recognitionLevel).toBe('NotDistinguished')
    })

    it('should classify division as Distinguished when ≥50% of paid areas are distinguished', () => {
      const module = new AreaDivisionRecognitionModule()
      // All areas paid, 1 out of 2 distinguished (50%)
      const clubs = [
        // Area A1: all clubs distinguished
        createMockClub('1', 'A', 'A1', 20, 5, 'Active'),
        createMockClub('2', 'A', 'A1', 20, 5, 'Active'),
        createMockClub('3', 'A', 'A1', 20, 5, 'Active'),
        createMockClub('4', 'A', 'A1', 20, 5, 'Active'),
        // Area A2: no clubs distinguished
        createMockClub('5', 'A', 'A2', 20, 2, 'Active'),
        createMockClub('6', 'A', 'A2', 20, 2, 'Active'),
        createMockClub('7', 'A', 'A2', 20, 2, 'Active'),
        createMockClub('8', 'A', 'A2', 20, 2, 'Active'),
      ]
      const snapshot = createMockSnapshot(clubs)

      const divisions = module.calculateDivisionRecognition(snapshot)

      // Both areas are paid (100% >= 85%)
      expect(divisions[0]?.meetsPaidThreshold).toBe(true)
      // 1 out of 2 areas is distinguished (50%)
      expect(divisions[0]?.recognitionLevel).toBe('Distinguished')
    })

    it('should classify division as Presidents when 100% of paid areas are distinguished', () => {
      const module = new AreaDivisionRecognitionModule()
      // All areas paid and distinguished
      const clubs = [
        // Area A1: all clubs distinguished
        createMockClub('1', 'A', 'A1', 20, 5, 'Active'),
        createMockClub('2', 'A', 'A1', 20, 5, 'Active'),
        createMockClub('3', 'A', 'A1', 20, 5, 'Active'),
        createMockClub('4', 'A', 'A1', 20, 5, 'Active'),
        // Area A2: all clubs distinguished
        createMockClub('5', 'A', 'A2', 20, 5, 'Active'),
        createMockClub('6', 'A', 'A2', 20, 5, 'Active'),
        createMockClub('7', 'A', 'A2', 20, 5, 'Active'),
        createMockClub('8', 'A', 'A2', 20, 5, 'Active'),
      ]
      const snapshot = createMockSnapshot(clubs)

      const divisions = module.calculateDivisionRecognition(snapshot)

      expect(divisions[0]?.recognitionLevel).toBe('Presidents')
    })
  })

  describe('Eligibility Status', () => {
    it('should set eligibility to unknown (club visit data not available)', () => {
      const module = new AreaDivisionRecognitionModule()
      const clubs = [createMockClub('1', 'A', 'A1', 20, 5)]
      const snapshot = createMockSnapshot(clubs)

      const areas = module.calculateAreaRecognition(snapshot)

      expect(areas[0]?.eligibility).toBe('unknown')
      expect(areas[0]?.eligibilityReason).toContain('not available')
    })

    it('should set division eligibility to unknown', () => {
      const module = new AreaDivisionRecognitionModule()
      const clubs = [createMockClub('1', 'A', 'A1', 20, 5)]
      const snapshot = createMockSnapshot(clubs)

      const divisions = module.calculateDivisionRecognition(snapshot)

      expect(divisions[0]?.eligibility).toBe('unknown')
      expect(divisions[0]?.eligibilityReason).toContain('not available')
    })
  })

  describe('Percentage Calculations', () => {
    it('should calculate paid clubs percentage correctly', () => {
      const module = new AreaDivisionRecognitionModule()
      const clubs = [
        createMockClub('1', 'A', 'A1', 20, 5, 'Active'),
        createMockClub('2', 'A', 'A1', 20, 5, 'Active'),
        createMockClub('3', 'A', 'A1', 20, 5, 'Active'),
        createMockClub('4', 'A', 'A1', 20, 5, 'Suspended'),
      ]
      const snapshot = createMockSnapshot(clubs)

      const areas = module.calculateAreaRecognition(snapshot)

      // 3 out of 4 = 75%
      expect(areas[0]?.paidClubsPercent).toBe(75)
    })

    it('should calculate distinguished clubs percentage against paid clubs', () => {
      const module = new AreaDivisionRecognitionModule()
      const clubs = [
        createMockClub('1', 'A', 'A1', 20, 5, 'Active'), // Paid and distinguished
        createMockClub('2', 'A', 'A1', 20, 5, 'Active'), // Paid and distinguished
        createMockClub('3', 'A', 'A1', 20, 2, 'Active'), // Paid but not distinguished
        createMockClub('4', 'A', 'A1', 20, 5, 'Suspended'), // Not paid
      ]
      const snapshot = createMockSnapshot(clubs)

      const areas = module.calculateAreaRecognition(snapshot)

      // 2 distinguished out of 3 paid = 66.67%
      expect(areas[0]?.distinguishedClubsPercent).toBeCloseTo(66.67, 1)
    })

    it('should handle zero paid clubs gracefully', () => {
      const module = new AreaDivisionRecognitionModule()
      const clubs = [
        createMockClub('1', 'A', 'A1', 20, 5, 'Suspended'),
        createMockClub('2', 'A', 'A1', 20, 5, 'Suspended'),
      ]
      const snapshot = createMockSnapshot(clubs)

      const areas = module.calculateAreaRecognition(snapshot)

      expect(areas[0]?.paidClubs).toBe(0)
      expect(areas[0]?.distinguishedClubsPercent).toBe(0)
    })
  })
})
