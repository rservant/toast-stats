/**
 * Unit tests for monthlyTargetService
 * Tests monthly target derivation, cumulative calculations, and month/number conversions
 */

import { describe, it, expect } from 'vitest'
import {
  deriveMonthlyTargets,
  deriveAllMonthlyTargets,
  getMonthlyTarget,
  calculateCumulativeTarget,
  getProgramYearMonths,
  getMonthNumber,
  getMonthName,
  validateMonthlyTargets,
} from '../services/monthlyTargetService.js'
import { DistrictConfig } from '../types/assessment.js'

const mockConfig: DistrictConfig = {
  district_number: 61,
  program_year: '2024-2025',
  year_end_targets: {
    membership_growth: 120,
    club_growth: 12,
    distinguished_clubs: 24,
  },
  recognition_levels: [
    {
      level: 'Distinguished',
      membershipPaymentsTarget: 30,
      paidClubsTarget: 3,
      distinguishedClubsTarget: 6,
    },
    {
      level: 'Select',
      membershipPaymentsTarget: 30,
      paidClubsTarget: 3,
      distinguishedClubsTarget: 6,
    },
    {
      level: "President's",
      membershipPaymentsTarget: 30,
      paidClubsTarget: 3,
      distinguishedClubsTarget: 6,
    },
    {
      level: 'Smedley Distinguished',
      membershipPaymentsTarget: 30,
      paidClubsTarget: 3,
      distinguishedClubsTarget: 6,
    },
  ],
  csp_submission_target: 48,
  csp_to_distinguished_clubs_ratio: 0.5,
}

describe('monthlyTargetService', () => {
  describe('deriveMonthlyTargets', () => {
    it('should derive monthly targets from year-end targets', () => {
      const target = deriveMonthlyTargets(mockConfig, 'August')

      expect(target.district_number).toBe(61)
      expect(target.program_year).toBe('2024-2025')
      expect(target.month).toBe('August')
      expect(target.membership_growth_target).toBe(10) // 120 / 12 = 10
      expect(target.club_growth_target).toBe(1) // 12 / 12 = 1
      expect(target.distinguished_clubs_target).toBe(2) // 24 / 12 = 2
    })

    it('should derive recognition level targets', () => {
      const target = deriveMonthlyTargets(mockConfig, 'September')

      expect(target.recognition_level_targets).toHaveLength(4)
      expect(target.recognition_level_targets[0].membershipPaymentsTarget).toBe(
        3
      ) // 30 / 12 ≈ 2.5 → 3
      expect(target.recognition_level_targets[0].paidClubsTarget).toBe(0) // 3 / 12 = 0.25 → 0
      expect(target.recognition_level_targets[0].distinguishedClubsTarget).toBe(
        1
      ) // 6 / 12 = 0.5 → 0 or 1
    })

    it('should handle rounding correctly', () => {
      const customConfig = {
        ...mockConfig,
        year_end_targets: {
          ...mockConfig.year_end_targets,
          membership_growth: 100,
        },
      }

      const target = deriveMonthlyTargets(customConfig, 'October')
      // 100 / 12 ≈ 8.33 → 8 (Math.round)
      expect(target.membership_growth_target).toBe(8)
    })
  })

  describe('deriveAllMonthlyTargets', () => {
    it('should derive targets for all 12 months', () => {
      const targets = deriveAllMonthlyTargets(mockConfig)

      expect(targets).toHaveLength(12)
      expect(targets[0].month).toBe('July')
      expect(targets[11].month).toBe('June')
    })

    it('should maintain consistency across all months', () => {
      const targets = deriveAllMonthlyTargets(mockConfig)

      // All months should have the same derived targets (linear derivation)
      const firstTarget = targets[0].membership_growth_target
      for (const target of targets) {
        expect(target.membership_growth_target).toBe(firstTarget)
      }
    })
  })

  describe('getMonthlyTarget', () => {
    it('should retrieve target by month name', () => {
      const target = getMonthlyTarget(mockConfig, 'November')

      expect(target.month).toBe('November')
      expect(target.membership_growth_target).toBe(10)
    })

    it('should retrieve target by month number', () => {
      const target1 = getMonthlyTarget(mockConfig, 1) // July
      const target2 = getMonthlyTarget(mockConfig, 'July')

      expect(target1.month).toBe(target2.month)
      expect(target1.membership_growth_target).toBe(
        target2.membership_growth_target
      )
    })

    it('should throw error for invalid month number', () => {
      expect(() => getMonthlyTarget(mockConfig, 0)).toThrow()
      expect(() => getMonthlyTarget(mockConfig, 13)).toThrow()
    })

    it('should handle case-insensitive month names', () => {
      const target1 = getMonthlyTarget(mockConfig, 'december')
      const target2 = getMonthlyTarget(mockConfig, 'DECEMBER')
      const target3 = getMonthlyTarget(mockConfig, 'December')

      expect(target1.month).toBe(target2.month)
      expect(target2.month).toBe(target3.month)
    })
  })

  describe('calculateCumulativeTarget', () => {
    it('should calculate cumulative target for month 1', () => {
      const cumulative = calculateCumulativeTarget(120, 1)

      // (120 / 12) * 1 = 10
      expect(cumulative).toBe(10)
    })

    it('should calculate cumulative target for mid-year months', () => {
      const cumulative = calculateCumulativeTarget(120, 6)

      // (120 / 12) * 6 = 60
      expect(cumulative).toBe(60)
    })

    it('should calculate cumulative target for month 12', () => {
      const cumulative = calculateCumulativeTarget(120, 12)

      // (120 / 12) * 12 = 120
      expect(cumulative).toBe(120)
    })

    it('should throw error for invalid month number', () => {
      expect(() => calculateCumulativeTarget(100, 0)).toThrow()
      expect(() => calculateCumulativeTarget(100, 13)).toThrow()
    })
  })

  describe('getProgramYearMonths', () => {
    it('should return all 12 months in order', () => {
      const months = getProgramYearMonths()

      expect(months).toHaveLength(12)
      expect(months[0]).toBe('July')
      expect(months[11]).toBe('June')
    })
  })

  describe('getMonthNumber', () => {
    it('should convert month names to numbers', () => {
      expect(getMonthNumber('July')).toBe(1)
      expect(getMonthNumber('August')).toBe(2)
      expect(getMonthNumber('December')).toBe(6)
      expect(getMonthNumber('June')).toBe(12)
    })

    it('should handle case-insensitive input', () => {
      expect(getMonthNumber('july')).toBe(1)
      expect(getMonthNumber('AUGUST')).toBe(2)
    })

    it('should throw error for invalid month name', () => {
      expect(() => getMonthNumber('Invalid')).toThrow()
      expect(() => getMonthNumber('Sept')).toThrow()
    })
  })

  describe('getMonthName', () => {
    it('should convert month numbers to names', () => {
      expect(getMonthName(1)).toBe('July')
      expect(getMonthName(2)).toBe('August')
      expect(getMonthName(6)).toBe('December')
      expect(getMonthName(12)).toBe('June')
    })

    it('should throw error for invalid month number', () => {
      expect(() => getMonthName(0)).toThrow()
      expect(() => getMonthName(13)).toThrow()
    })
  })

  describe('validateMonthlyTargets', () => {
    it('should validate correct monthly targets', () => {
      const target = deriveMonthlyTargets(mockConfig, 'September')
      const errors = validateMonthlyTargets(target, mockConfig)

      expect(errors).toEqual([])
    })

    it('should reject district number mismatch', () => {
      const target = deriveMonthlyTargets(mockConfig, 'September')
      const wrongConfig = { ...mockConfig, district_number: 62 }

      const errors = validateMonthlyTargets(target, wrongConfig)
      expect(errors.some(e => e.includes('District number'))).toBe(true)
    })

    it('should reject program year mismatch', () => {
      const target = deriveMonthlyTargets(mockConfig, 'September')
      const wrongConfig = { ...mockConfig, program_year: '2025-2026' }

      const errors = validateMonthlyTargets(target, wrongConfig)
      expect(errors.some(e => e.includes('Program year'))).toBe(true)
    })

    it('should reject negative targets', () => {
      const target = deriveMonthlyTargets(mockConfig, 'September')
      const invalidTarget = { ...target, membership_growth_target: -1 }

      const errors = validateMonthlyTargets(invalidTarget, mockConfig)
      expect(errors.some(e => e.includes('Membership growth target'))).toBe(
        true
      )
    })

    it('should reject missing recognition level targets', () => {
      const target = deriveMonthlyTargets(mockConfig, 'September')
      const invalidTarget = { ...target, recognition_level_targets: [] }

      const errors = validateMonthlyTargets(invalidTarget, mockConfig)
      expect(errors.some(e => e.includes('Recognition level targets'))).toBe(
        true
      )
    })
  })
})
