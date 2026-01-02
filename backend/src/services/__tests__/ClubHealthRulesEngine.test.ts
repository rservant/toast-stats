/**
 * Tests for Club Health Rules Engine
 */

import { describe, test, expect } from 'vitest'
import { ClubHealthRulesEngineImpl } from '../ClubHealthRulesEngine'
import { ClubHealthInput, Month, HealthStatus } from '../../types/clubHealth'

describe('ClubHealthRulesEngine', () => {
  const rulesEngine = new ClubHealthRulesEngineImpl()

  describe('getDCPRequirement', () => {
    test('should return correct DCP requirements for each month', () => {
      expect(rulesEngine.getDCPRequirement('August')).toBe(1)
      expect(rulesEngine.getDCPRequirement('September')).toBe(1)
      expect(rulesEngine.getDCPRequirement('October')).toBe(2)
      expect(rulesEngine.getDCPRequirement('November')).toBe(2)
      expect(rulesEngine.getDCPRequirement('December')).toBe(3)
      expect(rulesEngine.getDCPRequirement('January')).toBe(3)
      expect(rulesEngine.getDCPRequirement('February')).toBe(4)
      expect(rulesEngine.getDCPRequirement('March')).toBe(4)
      expect(rulesEngine.getDCPRequirement('April')).toBe(5)
      expect(rulesEngine.getDCPRequirement('May')).toBe(5)
      expect(rulesEngine.getDCPRequirement('June')).toBe(5)
    })

    test('should return 0 for July (administrative checkpoint)', () => {
      expect(rulesEngine.getDCPRequirement('July')).toBe(0)
    })
  })

  describe('checkMembershipRequirement', () => {
    test('should return true for 20+ members', () => {
      expect(rulesEngine.checkMembershipRequirement(20, 0)).toBe(true)
      expect(rulesEngine.checkMembershipRequirement(25, -2)).toBe(true)
    })

    test('should return true for 3+ growth', () => {
      expect(rulesEngine.checkMembershipRequirement(15, 3)).toBe(true)
      expect(rulesEngine.checkMembershipRequirement(10, 5)).toBe(true)
    })

    test('should return false when both conditions fail', () => {
      expect(rulesEngine.checkMembershipRequirement(15, 2)).toBe(false)
      expect(rulesEngine.checkMembershipRequirement(10, -1)).toBe(false)
    })
  })

  describe('evaluateHealthStatus', () => {
    const baseInput: ClubHealthInput = {
      club_name: 'Test Club',
      current_members: 15,
      member_growth_since_july: 2,
      current_month: 'October',
      dcp_goals_achieved_ytd: 2,
      csp_submitted: true,
      officer_list_submitted: false,
      officers_trained: false,
      previous_month_members: 14,
      previous_month_dcp_goals_achieved_ytd: 1,
      previous_month_health_status: 'Vulnerable',
    }

    test('should classify as Intervention Required when membership < 12 and growth < 3', () => {
      const input = {
        ...baseInput,
        current_members: 10,
        member_growth_since_july: 1,
      }

      const result = rulesEngine.evaluateHealthStatus(input)
      expect(result.status).toBe('Intervention Required')
      expect(result.reasons).toContain(
        'Intervention required: 10 members (<12) AND 1 growth (<3)'
      )
    })

    test('should classify as Thriving when all requirements met', () => {
      const input = {
        ...baseInput,
        current_members: 25,
        member_growth_since_july: 5,
        dcp_goals_achieved_ytd: 3,
        csp_submitted: true,
      }

      const result = rulesEngine.evaluateHealthStatus(input)
      expect(result.status).toBe('Thriving')
      expect(result.requirements_met.membership).toBe(true)
      expect(result.requirements_met.dcp).toBe(true)
      expect(result.requirements_met.csp).toBe(true)
    })

    test('should classify as Vulnerable when partial requirements met', () => {
      const input = {
        ...baseInput,
        current_members: 25,
        member_growth_since_july: 5,
        dcp_goals_achieved_ytd: 1, // Below October requirement of 2
        csp_submitted: false,
      }

      const result = rulesEngine.evaluateHealthStatus(input)
      expect(result.status).toBe('Vulnerable')
      expect(result.requirements_met.membership).toBe(true)
      expect(result.requirements_met.dcp).toBe(false)
      expect(result.requirements_met.csp).toBe(false)
    })

    test('should handle July administrative checkpoint correctly', () => {
      const input = {
        ...baseInput,
        current_month: 'July' as Month,
        officer_list_submitted: true,
        officers_trained: false,
        current_members: 25,
        csp_submitted: true,
      }

      const result = rulesEngine.evaluateHealthStatus(input)
      expect(result.status).toBe('Thriving')
      expect(result.requirements_met.dcp).toBe(true)
      expect(result.reasons).toContain(
        'July administrative checkpoint met: Officer list submitted'
      )
    })
  })

  describe('evaluateTrajectory', () => {
    const baseInput: ClubHealthInput = {
      club_name: 'Test Club',
      current_members: 15,
      member_growth_since_july: 2,
      current_month: 'October',
      dcp_goals_achieved_ytd: 2,
      csp_submitted: true,
      officer_list_submitted: false,
      officers_trained: false,
      previous_month_members: 14,
      previous_month_dcp_goals_achieved_ytd: 1,
      previous_month_health_status: 'Vulnerable',
    }

    test('should return Recovering when health status improves', () => {
      const healthResult = {
        status: 'Thriving' as HealthStatus,
        reasons: [],
        requirements_met: { membership: true, dcp: true, csp: true },
      }

      const result = rulesEngine.evaluateTrajectory(baseInput, healthResult)
      expect(result.trajectory).toBe('Recovering')
      expect(result.reasons).toContain(
        'Health status improved: Vulnerable → Thriving'
      )
    })

    test('should return Declining when health status worsens', () => {
      const input = {
        ...baseInput,
        previous_month_health_status: 'Thriving' as HealthStatus,
      }

      const healthResult = {
        status: 'Vulnerable' as HealthStatus,
        reasons: [],
        requirements_met: { membership: true, dcp: false, csp: true },
      }

      const result = rulesEngine.evaluateTrajectory(input, healthResult)
      expect(result.trajectory).toBe('Declining')
      expect(result.reasons).toContain(
        'Health status declined: Thriving → Vulnerable'
      )
    })

    test('should return Recovering for vulnerable club with 2+ member growth', () => {
      const input = {
        ...baseInput,
        current_members: 17,
        previous_month_members: 15, // +2 growth
      }

      const healthResult = {
        status: 'Vulnerable' as HealthStatus,
        reasons: [],
        requirements_met: { membership: false, dcp: true, csp: true },
      }

      const result = rulesEngine.evaluateTrajectory(input, healthResult)
      expect(result.trajectory).toBe('Recovering')
      expect(result.reasons).toContain(
        'Vulnerable club with positive momentum: +2 members month-over-month'
      )
    })

    test('should return Declining when losing members', () => {
      const input = {
        ...baseInput,
        current_members: 13,
        previous_month_members: 15, // -2 members
      }

      const healthResult = {
        status: 'Vulnerable' as HealthStatus,
        reasons: [],
        requirements_met: { membership: false, dcp: true, csp: true },
      }

      const result = rulesEngine.evaluateTrajectory(input, healthResult)
      expect(result.trajectory).toBe('Declining')
      expect(result.reasons).toContain(
        'Negative momentum: -2 members month-over-month'
      )
    })

    test('should return Stable for positive momentum', () => {
      const input = {
        ...baseInput,
        current_members: 16,
        previous_month_members: 15, // +1 member
        dcp_goals_achieved_ytd: 2,
        previous_month_dcp_goals_achieved_ytd: 1, // +1 DCP goal
      }

      const healthResult = {
        status: 'Vulnerable' as HealthStatus,
        reasons: [],
        requirements_met: { membership: false, dcp: true, csp: true },
      }

      const result = rulesEngine.evaluateTrajectory(input, healthResult)
      expect(result.trajectory).toBe('Stable')
      expect(result.reasons).toContain(
        'Stable momentum: +1 members, +1 DCP goals month-over-month'
      )
    })
  })
})
