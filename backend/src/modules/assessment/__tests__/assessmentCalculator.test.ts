/**
 * Unit tests for assessmentCalculator
 * Tests Goal 1, 2, and 3 calculations against test fixtures and Excel reference data
 */

import { describe, it, expect } from 'vitest'
import {
  calculateGoal1,
  calculateGoal2,
  calculateGoal3,
  calculateAllGoals,
  validateAgainstExcel,
} from '../services/assessmentCalculator'
import { MonthlyAssessment, DistrictConfig } from '../types/assessment'

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

const baseAssessment: MonthlyAssessment = {
  district_number: 61,
  program_year: '2024-2025',
  month: 'July',
  membership_payments_ytd: 0,
  paid_clubs_ytd: 0,
  distinguished_clubs_ytd: 0,
  csp_submissions_ytd: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

describe('assessmentCalculator', () => {
  describe('calculateGoal1 - Membership Growth', () => {
    it('should calculate Goal 1 as "On Track" when actual >= target', () => {
      const assessment: MonthlyAssessment = {
        ...baseAssessment,
        month: 'August',
        membership_payments_ytd: 25, // (120 / 12) * 2 = 20; actual 25 >= 20
      }

      const goal1 = calculateGoal1(assessment, mockConfig)

      expect(goal1.goal_number).toBe(1)
      expect(goal1.status).toBe('On Track')
      expect(goal1.actual).toBe(25)
      expect(goal1.target).toBe(20)
      expect(goal1.delta).toBe(5)
    })

    it('should calculate Goal 1 as "Off Track" when actual < target', () => {
      const assessment: MonthlyAssessment = {
        ...baseAssessment,
        month: 'October',
        membership_payments_ytd: 30, // (120 / 12) * 4 = 40; actual 30 < 40
      }

      const goal1 = calculateGoal1(assessment, mockConfig)

      expect(goal1.goal_number).toBe(1)
      expect(goal1.status).toBe('Off Track')
      expect(goal1.actual).toBe(30)
      expect(goal1.target).toBe(40)
      expect(goal1.delta).toBe(-10)
    })

    it('should handle July (month 1) correctly', () => {
      const assessment: MonthlyAssessment = {
        ...baseAssessment,
        month: 'July',
        membership_payments_ytd: 10, // (120 / 12) * 1 = 10
      }

      const goal1 = calculateGoal1(assessment, mockConfig)

      expect(goal1.target).toBe(10)
      expect(goal1.actual).toBe(10)
      expect(goal1.delta).toBe(0)
      expect(goal1.status).toBe('On Track')
    })

    it('should handle June (month 12) correctly', () => {
      const assessment: MonthlyAssessment = {
        ...baseAssessment,
        month: 'June',
        membership_payments_ytd: 120, // (120 / 12) * 12 = 120
      }

      const goal1 = calculateGoal1(assessment, mockConfig)

      expect(goal1.target).toBe(120)
      expect(goal1.actual).toBe(120)
      expect(goal1.delta).toBe(0)
      expect(goal1.status).toBe('On Track')
    })

    it('should calculate cumulative targets across all months', () => {
      for (let month = 1; month <= 12; month++) {
        const monthNames = [
          'July',
          'August',
          'September',
          'October',
          'November',
          'December',
          'January',
          'February',
          'March',
          'April',
          'May',
          'June',
        ]
        const monthName = monthNames[month - 1]
        const assessment: MonthlyAssessment = {
          ...baseAssessment,
          month: monthName,
          membership_payments_ytd: 10 * month, // Linear progression
        }

        const goal1 = calculateGoal1(assessment, mockConfig)

        // Target should be (120 / 12) * month = 10 * month
        expect(goal1.target).toBe(10 * month)
        expect(goal1.status).toBe('On Track')
      }
    })
  })

  describe('calculateGoal2 - Club Growth', () => {
    it('should calculate Goal 2 as "On Track" when actual >= target', () => {
      const assessment: MonthlyAssessment = {
        ...baseAssessment,
        month: 'September',
        paid_clubs_ytd: 4, // (12 / 12) * 3 = 3; actual 4 >= 3
      }

      const goal2 = calculateGoal2(assessment, mockConfig)

      expect(goal2.goal_number).toBe(2)
      expect(goal2.status).toBe('On Track')
      expect(goal2.actual).toBe(4)
      expect(goal2.target).toBe(3)
      expect(goal2.delta).toBe(1)
    })

    it('should calculate Goal 2 as "Off Track" when actual < target', () => {
      const assessment: MonthlyAssessment = {
        ...baseAssessment,
        month: 'December',
        paid_clubs_ytd: 4, // (12 / 12) * 6 = 6; actual 4 < 6
      }

      const goal2 = calculateGoal2(assessment, mockConfig)

      expect(goal2.goal_number).toBe(2)
      expect(goal2.status).toBe('Off Track')
      expect(goal2.actual).toBe(4)
      expect(goal2.target).toBe(6)
      expect(goal2.delta).toBe(-2)
    })
  })

  describe('calculateGoal3 - Distinguished Clubs', () => {
    it('should use distinguished_clubs_ytd when available', () => {
      const assessment: MonthlyAssessment = {
        ...baseAssessment,
        month: 'November',
        distinguished_clubs_ytd: 12, // Actual data available
        csp_submissions_ytd: 30,
      }

      const goal3 = calculateGoal3(assessment, mockConfig)

      expect(goal3.goal_number).toBe(3)
      expect(goal3.actual).toBe(12)
      expect(goal3.status).toBe('On Track') // 12 >= (24 / 12) * 5 = 10
    })

    it('should use CSP fallback when distinguished_clubs_ytd is null', () => {
      const assessment: MonthlyAssessment = {
        ...baseAssessment,
        month: 'September',
        distinguished_clubs_ytd: null,
        csp_submissions_ytd: 20, // 20 * 0.5 = 10 estimated distinguished clubs
      }

      const goal3 = calculateGoal3(assessment, mockConfig)

      expect(goal3.goal_number).toBe(3)
      expect(goal3.actual).toBe(10) // 20 * 0.5 = 10
      expect(goal3.status).toBe('On Track') // 10 >= (24 / 12) * 3 = 6
    })

    it('should use CSP fallback when distinguished_clubs_ytd is undefined', () => {
      const assessment: MonthlyAssessment = {
        ...baseAssessment,
        month: 'April',
        distinguished_clubs_ytd: null,
        csp_submissions_ytd: 16, // 16 * 0.5 = 8 estimated distinguished clubs
      }

      const goal3 = calculateGoal3(assessment, mockConfig)

      expect(goal3.goal_number).toBe(3)
      expect(goal3.actual).toBe(8) // 16 * 0.5 = 8
    })

    it('should return "Pending Data" when both inputs unavailable', () => {
      const assessment: MonthlyAssessment = {
        ...baseAssessment,
        month: 'May',
        distinguished_clubs_ytd: null,
        csp_submissions_ytd: 0,
      }

      const goal3 = calculateGoal3(assessment, mockConfig)

      expect(goal3.goal_number).toBe(3)
      expect(goal3.status).toBe('Pending Data')
      expect(goal3.actual).toBe(0)
    })

    it('should round CSP-based calculation correctly', () => {
      const assessment: MonthlyAssessment = {
        ...baseAssessment,
        month: 'June',
        distinguished_clubs_ytd: null,
        csp_submissions_ytd: 25, // 25 * 0.5 = 12.5 → rounds to 13
      }

      const goal3 = calculateGoal3(assessment, mockConfig)

      expect(goal3.actual).toBe(13) // Math.round(12.5) = 13
    })
  })

  describe('calculateAllGoals', () => {
    it('should calculate all three goals in one call', () => {
      const assessment: MonthlyAssessment = {
        ...baseAssessment,
        month: 'August',
        membership_payments_ytd: 25,
        paid_clubs_ytd: 2,
        distinguished_clubs_ytd: 4, // >= (24/12)*2 = 4
        csp_submissions_ytd: 8,
      }

      const result = calculateAllGoals(assessment, mockConfig)

      expect(result.goal_1_status.goal_number).toBe(1)
      expect(result.goal_2_status.goal_number).toBe(2)
      expect(result.goal_3_status.goal_number).toBe(3)
      expect(result.goal_1_status.status).toBe('On Track')
      expect(result.goal_2_status.status).toBe('On Track') // 2 >= (12/12)*2 = 2
      expect(result.goal_3_status.status).toBe('On Track') // 4 >= (24/12)*2 = 4
    })
  })

  describe('validateAgainstExcel', () => {
    it('should validate matching results', () => {
      const calculated = {
        goal_number: 1 as const,
        status: 'On Track' as const,
        actual: 25,
        target: 20,
        delta: 5,
      }

      const excel = {
        goal_number: 1 as const,
        status: 'On Track' as const,
        actual: 25,
        target: 20,
        delta: 5,
      }

      const result = validateAgainstExcel(calculated, excel)

      expect(result.valid).toBe(true)
      expect(result.message).toContain('Match')
    })

    it('should reject status mismatch', () => {
      const calculated = {
        goal_number: 1 as const,
        status: 'On Track' as const,
        actual: 25,
        target: 20,
        delta: 5,
      }

      const excel = {
        goal_number: 1 as const,
        status: 'Off Track' as const,
        actual: 25,
        target: 30,
        delta: -5,
      }

      const result = validateAgainstExcel(calculated, excel)

      expect(result.valid).toBe(false)
      expect(result.message).toContain('Status mismatch')
    })

    it('should reject delta variance exceeding tolerance', () => {
      const calculated = {
        goal_number: 2 as const,
        status: 'On Track' as const,
        actual: 10,
        target: 8,
        delta: 2,
      }

      const excel = {
        goal_number: 2 as const,
        status: 'On Track' as const,
        actual: 10,
        target: 8,
        delta: 2.2, // Variance of 0.2 > allowed 0.1
      }

      const result = validateAgainstExcel(calculated, excel, 0.1)

      expect(result.valid).toBe(false)
      expect(result.message).toContain('variance')
    })

    it('should allow delta within tolerance', () => {
      const calculated = {
        goal_number: 3 as const,
        status: 'On Track' as const,
        actual: 12,
        target: 10,
        delta: 2.0,
      }

      const excel = {
        goal_number: 3 as const,
        status: 'On Track' as const,
        actual: 12,
        target: 10,
        delta: 2.05, // Variance of 0.05 < allowed 0.1
      }

      const result = validateAgainstExcel(calculated, excel, 0.1)

      expect(result.valid).toBe(true)
    })
  })
})
