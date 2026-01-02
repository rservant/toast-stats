/**
 * Comprehensive Business Rules Validation Tests
 *
 * This test suite validates that the club health classification system
 * correctly implements all business rules as specified in the requirements.
 * These tests serve as "golden test cases" to ensure the schema matches
 * the implementation exactly.
 */

import { describe, test, expect } from 'vitest'
import { ClubHealthClassificationEngineImpl } from '../ClubHealthClassificationEngine'
import { ClubHealthRulesEngineImpl } from '../ClubHealthRulesEngine'
import { ClubHealthInput, Month } from '../../types/clubHealth'

describe('Club Health Business Rules Validation', () => {
  const engine = new ClubHealthClassificationEngineImpl()
  const rulesEngine = new ClubHealthRulesEngineImpl()

  /**
   * Helper function to create a base club input
   */
  const createBaseInput = (
    overrides: Partial<ClubHealthInput> = {}
  ): ClubHealthInput => ({
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
    ...overrides,
  })

  describe('DCP Threshold Requirements (Requirements 2.1-2.6)', () => {
    const dcpTestCases: Array<{ month: Month; requiredGoals: number }> = [
      { month: 'August', requiredGoals: 1 },
      { month: 'September', requiredGoals: 1 },
      { month: 'October', requiredGoals: 2 },
      { month: 'November', requiredGoals: 2 },
      { month: 'December', requiredGoals: 3 },
      { month: 'January', requiredGoals: 3 },
      { month: 'February', requiredGoals: 4 },
      { month: 'March', requiredGoals: 4 },
      { month: 'April', requiredGoals: 5 },
      { month: 'May', requiredGoals: 5 },
      { month: 'June', requiredGoals: 5 },
    ]

    test.each(dcpTestCases)(
      'should require $requiredGoals DCP goals for $month',
      ({ month, requiredGoals }) => {
        expect(rulesEngine.getDCPRequirement(month)).toBe(requiredGoals)
      }
    )

    test('should use administrative checkpoint for July', () => {
      expect(rulesEngine.getDCPRequirement('July')).toBe(0)
    })

    test.each(dcpTestCases)(
      'should meet DCP requirement when goals >= $requiredGoals in $month',
      ({ month, requiredGoals }) => {
        const input = createBaseInput({
          current_month: month,
          dcp_goals_achieved_ytd: requiredGoals,
          current_members: 25,
          member_growth_since_july: 5,
          csp_submitted: true,
        })

        const result = engine.classifyClub(input)
        expect(result.health_status).toBe('Thriving')
        expect(result.reasons).toContain(
          `DCP requirement met: ${requiredGoals} goals achieved (≥${requiredGoals} required for ${month})`
        )
      }
    )

    test.each(dcpTestCases)(
      'should not meet DCP requirement when goals < $requiredGoals in $month',
      ({ month, requiredGoals }) => {
        const input = createBaseInput({
          current_month: month,
          dcp_goals_achieved_ytd: Math.max(0, requiredGoals - 1),
          current_members: 25,
          member_growth_since_july: 5,
          csp_submitted: true,
        })

        const result = engine.classifyClub(input)
        expect(result.health_status).toBe('Vulnerable')
        expect(result.reasons).toContain(
          `DCP requirement not met: ${Math.max(0, requiredGoals - 1)} goals achieved (<${requiredGoals} required for ${month})`
        )
      }
    )
  })

  describe('July Administrative Checkpoint (Requirement 2.6)', () => {
    test('should meet July checkpoint with officer list submitted', () => {
      const input = createBaseInput({
        current_month: 'July',
        officer_list_submitted: true,
        officers_trained: false,
        current_members: 25,
        member_growth_since_july: 5,
        csp_submitted: true,
      })

      const result = engine.classifyClub(input)
      expect(result.health_status).toBe('Thriving')
      expect(result.reasons).toContain(
        'July administrative checkpoint met: Officer list submitted'
      )
    })

    test('should meet July checkpoint with officers trained', () => {
      const input = createBaseInput({
        current_month: 'July',
        officer_list_submitted: false,
        officers_trained: true,
        current_members: 25,
        member_growth_since_july: 5,
        csp_submitted: true,
      })

      const result = engine.classifyClub(input)
      expect(result.health_status).toBe('Thriving')
      expect(result.reasons).toContain(
        'July administrative checkpoint met: Officers trained'
      )
    })

    test('should meet July checkpoint with both officer list and training', () => {
      const input = createBaseInput({
        current_month: 'July',
        officer_list_submitted: true,
        officers_trained: true,
        current_members: 25,
        member_growth_since_july: 5,
        csp_submitted: true,
      })

      const result = engine.classifyClub(input)
      expect(result.health_status).toBe('Thriving')
      expect(result.reasons).toContain(
        'July administrative checkpoint met: Officer list submitted AND officers trained'
      )
    })

    test('should not meet July checkpoint with neither requirement', () => {
      const input = createBaseInput({
        current_month: 'July',
        officer_list_submitted: false,
        officers_trained: false,
        current_members: 25,
        member_growth_since_july: 5,
        csp_submitted: true,
      })

      const result = engine.classifyClub(input)
      expect(result.health_status).toBe('Vulnerable')
      expect(result.reasons).toContain(
        'July administrative checkpoint not met: Neither officer list submitted nor officers trained'
      )
    })
  })

  describe('Membership Requirements (Requirements 1.3)', () => {
    test('should meet membership requirement with 20+ members', () => {
      const input = createBaseInput({
        current_members: 20,
        member_growth_since_july: -5, // Negative growth should not matter
      })

      const result = rulesEngine.evaluateHealthStatus(input)
      expect(result.requirements_met.membership).toBe(true)
      expect(result.reasons).toContain(
        'Membership requirement met: 20 members (≥20 required)'
      )
    })

    test('should meet membership requirement with 3+ growth', () => {
      const input = createBaseInput({
        current_members: 10, // Below 20
        member_growth_since_july: 3,
      })

      const result = rulesEngine.evaluateHealthStatus(input)
      expect(result.requirements_met.membership).toBe(true)
      expect(result.reasons).toContain(
        'Membership requirement met: 3 net growth since July (≥3 required)'
      )
    })

    test('should not meet membership requirement with <20 members and <3 growth', () => {
      const input = createBaseInput({
        current_members: 15,
        member_growth_since_july: 2,
      })

      const result = rulesEngine.evaluateHealthStatus(input)
      expect(result.requirements_met.membership).toBe(false)
      expect(result.reasons).toContain(
        'Membership requirement not met: 15 members (<20) and 2 growth (<3)'
      )
    })
  })

  describe('Intervention Override Rule (Requirement 1.2)', () => {
    test('should classify as Intervention Required when membership < 12 AND growth < 3', () => {
      const input = createBaseInput({
        current_members: 10,
        member_growth_since_july: 1,
        dcp_goals_achieved_ytd: 5, // Even with high DCP goals
        csp_submitted: true, // And CSP submitted
      })

      const result = engine.classifyClub(input)
      expect(result.health_status).toBe('Intervention Required')
      expect(result.reasons).toContain(
        'Intervention required: 10 members (<12) AND 1 growth (<3)'
      )
    })

    test('should not trigger intervention with membership < 12 but growth >= 3', () => {
      const input = createBaseInput({
        current_members: 10,
        member_growth_since_july: 3,
        dcp_goals_achieved_ytd: 2,
        csp_submitted: true,
      })

      const result = engine.classifyClub(input)
      expect(result.health_status).toBe('Thriving') // Should be thriving with all requirements met
      expect(result.reasons).not.toContain('Intervention required')
    })

    test('should not trigger intervention with membership >= 12 but growth < 3', () => {
      const input = createBaseInput({
        current_members: 15,
        member_growth_since_july: 1,
        dcp_goals_achieved_ytd: 2,
        csp_submitted: true,
      })

      const result = engine.classifyClub(input)
      expect(result.health_status).toBe('Vulnerable') // Should be vulnerable, not intervention
      expect(result.reasons).not.toContain('Intervention required')
    })
  })

  describe('Health Status Classification (Requirements 1.1, 1.4, 1.5)', () => {
    test('should classify as Thriving when all requirements met', () => {
      const input = createBaseInput({
        current_members: 25,
        member_growth_since_july: 5,
        dcp_goals_achieved_ytd: 3,
        csp_submitted: true,
        current_month: 'October',
      })

      const result = engine.classifyClub(input)
      expect(result.health_status).toBe('Thriving')
      expect(result.reasons).toContain(
        'All requirements met: membership, DCP, and CSP'
      )
    })

    test('should classify as Vulnerable when partial requirements met', () => {
      const input = createBaseInput({
        current_members: 25, // Meets membership
        member_growth_since_july: 5,
        dcp_goals_achieved_ytd: 1, // Does not meet October DCP requirement (2)
        csp_submitted: true, // Meets CSP
        current_month: 'October',
      })

      const result = engine.classifyClub(input)
      expect(result.health_status).toBe('Vulnerable')
      expect(result.reasons).toContain(
        'Partial requirements met: 2 of 3 requirements satisfied'
      )
    })
  })

  describe('Trajectory Analysis (Requirements 3.1-3.6)', () => {
    test('should return Recovering when health status improves', () => {
      const input = createBaseInput({
        current_members: 25,
        member_growth_since_july: 5,
        dcp_goals_achieved_ytd: 3,
        csp_submitted: true,
        previous_month_health_status: 'Vulnerable',
      })

      const result = engine.classifyClub(input)
      expect(result.health_status).toBe('Thriving')
      expect(result.trajectory).toBe('Recovering')
      expect(result.trajectory_reasons).toContain(
        'Health status improved: Vulnerable → Thriving'
      )
    })

    test('should return Declining when health status worsens', () => {
      const input = createBaseInput({
        current_members: 15,
        member_growth_since_july: 2,
        dcp_goals_achieved_ytd: 1, // Below October requirement
        csp_submitted: false,
        previous_month_health_status: 'Thriving',
      })

      const result = engine.classifyClub(input)
      expect(result.health_status).toBe('Vulnerable')
      expect(result.trajectory).toBe('Declining')
      expect(result.trajectory_reasons).toContain(
        'Health status declined: Thriving → Vulnerable'
      )
    })

    test('should return Recovering for vulnerable club with 2+ member growth', () => {
      const input = createBaseInput({
        current_members: 17,
        previous_month_members: 15, // +2 growth
        member_growth_since_july: 2,
        dcp_goals_achieved_ytd: 1, // Below requirement, so Vulnerable
        csp_submitted: true,
        previous_month_health_status: 'Vulnerable',
      })

      const result = engine.classifyClub(input)
      expect(result.health_status).toBe('Vulnerable')
      expect(result.trajectory).toBe('Recovering')
      expect(result.trajectory_reasons).toContain(
        'Vulnerable club with positive momentum: +2 members month-over-month'
      )
    })

    test('should return Declining when losing members', () => {
      const input = createBaseInput({
        current_members: 13,
        previous_month_members: 15, // -2 members
        member_growth_since_july: 2,
        dcp_goals_achieved_ytd: 1,
        csp_submitted: true,
        previous_month_health_status: 'Vulnerable',
      })

      const result = engine.classifyClub(input)
      expect(result.trajectory).toBe('Declining')
      expect(result.trajectory_reasons).toContain(
        'Negative momentum: -2 members month-over-month'
      )
    })

    test('should return Stable for positive momentum', () => {
      const input = createBaseInput({
        current_members: 16,
        previous_month_members: 15, // +1 member
        member_growth_since_july: 2,
        dcp_goals_achieved_ytd: 2,
        previous_month_dcp_goals_achieved_ytd: 1, // +1 DCP goal
        csp_submitted: true,
        previous_month_health_status: 'Vulnerable',
      })

      const result = engine.classifyClub(input)
      expect(result.trajectory).toBe('Stable')
      expect(result.trajectory_reasons).toContain(
        'Stable momentum: +1 members, +1 DCP goals month-over-month'
      )
    })
  })

  describe('Complete Reasoning Provision (Requirements 1.6, 3.6)', () => {
    test('should provide detailed reasoning for all classifications', () => {
      const input = createBaseInput({
        current_members: 25,
        member_growth_since_july: 5,
        dcp_goals_achieved_ytd: 3,
        csp_submitted: true,
        current_month: 'October',
      })

      const result = engine.classifyClub(input)

      // Health status reasoning should be non-empty and descriptive
      expect(result.reasons).toHaveLength(4) // Membership, DCP, CSP, and overall status
      expect(result.reasons[0]).toContain('Membership requirement met')
      expect(result.reasons[1]).toContain('DCP requirement met')
      expect(result.reasons[2]).toContain('CSP requirement met')
      expect(result.reasons[3]).toContain('All requirements met')

      // Trajectory reasoning should be non-empty and descriptive
      expect(result.trajectory_reasons.length).toBeGreaterThan(0)
      expect(result.trajectory_reasons[0]).toContain('Health status improved')
    })

    test('should provide specific reasoning for failed requirements', () => {
      const input = createBaseInput({
        current_members: 15,
        member_growth_since_july: 2,
        dcp_goals_achieved_ytd: 1, // Below October requirement
        csp_submitted: false,
        current_month: 'October',
      })

      const result = engine.classifyClub(input)

      expect(result.reasons).toContain(
        'Membership requirement not met: 15 members (<20) and 2 growth (<3)'
      )
      expect(result.reasons).toContain(
        'DCP requirement not met: 1 goals achieved (<2 required for October)'
      )
      expect(result.reasons).toContain(
        'CSP requirement not met: Club Success Plan not submitted'
      )
    })
  })

  describe('Month-over-Month Delta Calculation (Requirement 4.2)', () => {
    test('should calculate member delta correctly', () => {
      const input = createBaseInput({
        current_members: 20,
        previous_month_members: 18,
      })

      const result = engine.classifyClub(input)
      expect(result.members_delta_mom).toBe(2)
    })

    test('should calculate DCP delta correctly', () => {
      const input = createBaseInput({
        dcp_goals_achieved_ytd: 4,
        previous_month_dcp_goals_achieved_ytd: 3,
      })

      const result = engine.classifyClub(input)
      expect(result.dcp_delta_mom).toBe(1)
    })

    test('should handle negative deltas', () => {
      const input = createBaseInput({
        current_members: 15,
        previous_month_members: 18,
        dcp_goals_achieved_ytd: 2,
        previous_month_dcp_goals_achieved_ytd: 3,
      })

      const result = engine.classifyClub(input)
      expect(result.members_delta_mom).toBe(-3)
      expect(result.dcp_delta_mom).toBe(-1)
    })
  })

  describe('Composite Key Generation (Requirement 4.5)', () => {
    test('should generate correct composite key format', () => {
      const input = createBaseInput({
        current_members: 25,
        member_growth_since_july: 5,
        dcp_goals_achieved_ytd: 3,
        csp_submitted: true,
        previous_month_health_status: 'Vulnerable',
      })

      const result = engine.classifyClub(input)
      expect(result.composite_key).toBe('Thriving__Recovering')
      expect(result.composite_label).toBe('Thriving · Recovering')
    })

    test('should generate keys for basic health status and trajectory combinations', () => {
      // Test a few key combinations to verify the format is correct
      const testCases = [
        {
          input: createBaseInput({
            current_members: 25,
            member_growth_since_july: 5,
            dcp_goals_achieved_ytd: 3,
            csp_submitted: true,
            previous_month_health_status: 'Vulnerable',
          }),
          expectedKey: 'Thriving__Recovering',
          expectedLabel: 'Thriving · Recovering',
        },
        {
          input: createBaseInput({
            current_members: 10,
            member_growth_since_july: 1,
            dcp_goals_achieved_ytd: 2,
            csp_submitted: true,
            previous_month_health_status: 'Intervention Required',
            previous_month_members: 10, // Same members for stable
            previous_month_dcp_goals_achieved_ytd: 2, // Same DCP for stable
          }),
          expectedKey: 'Intervention Required__Stable',
          expectedLabel: 'Intervention Required · Stable',
        },
        {
          input: createBaseInput({
            current_members: 15,
            member_growth_since_july: 2,
            dcp_goals_achieved_ytd: 1, // Below October requirement
            csp_submitted: false,
            previous_month_health_status: 'Thriving',
            previous_month_members: 17, // Lost members
          }),
          expectedKey: 'Vulnerable__Declining',
          expectedLabel: 'Vulnerable · Declining',
        },
      ]

      testCases.forEach(({ input, expectedKey, expectedLabel }) => {
        const result = engine.classifyClub(input)
        expect(result.composite_key).toBe(expectedKey)
        expect(result.composite_label).toBe(expectedLabel)
      })
    })
  })

  describe('Batch Processing Consistency (Requirement 4.6)', () => {
    test('should produce identical results for individual vs batch processing', () => {
      const inputs = [
        createBaseInput({ club_name: 'Club A', current_members: 25 }),
        createBaseInput({ club_name: 'Club B', current_members: 15 }),
        createBaseInput({
          club_name: 'Club C',
          current_members: 8,
          member_growth_since_july: 1,
        }),
      ]

      // Process individually
      const individualResults = inputs.map(input => engine.classifyClub(input))

      // Process as batch
      const batchResults = engine.batchClassifyClubs(inputs)

      expect(batchResults).toHaveLength(individualResults.length)

      for (let i = 0; i < inputs.length; i++) {
        const individual = individualResults[i]
        const batch = batchResults[i]

        expect(batch.club_name).toBe(individual.club_name)
        expect(batch.health_status).toBe(individual.health_status)
        expect(batch.trajectory).toBe(individual.trajectory)
        expect(batch.composite_key).toBe(individual.composite_key)
        expect(batch.composite_label).toBe(individual.composite_label)
        expect(batch.members_delta_mom).toBe(individual.members_delta_mom)
        expect(batch.dcp_delta_mom).toBe(individual.dcp_delta_mom)
        expect(batch.reasons).toEqual(individual.reasons)
        expect(batch.trajectory_reasons).toEqual(individual.trajectory_reasons)
      }
    })
  })

  describe('Input Validation (Requirements 4.1, 5.5)', () => {
    test('should validate all required fields', () => {
      const invalidInputs = [
        { ...createBaseInput(), club_name: '' },
        { ...createBaseInput(), current_members: -1 },
        {
          ...createBaseInput(),
          member_growth_since_july: 'invalid' as unknown,
        },
        { ...createBaseInput(), current_month: 'InvalidMonth' as unknown },
        { ...createBaseInput(), dcp_goals_achieved_ytd: -1 },
        { ...createBaseInput(), csp_submitted: 'not boolean' as unknown },
        {
          ...createBaseInput(),
          previous_month_health_status: 'Invalid' as unknown,
        },
      ]

      invalidInputs.forEach(input => {
        const validation = engine.validateInput(input)
        expect(validation.is_valid).toBe(false)
        expect(validation.errors.length).toBeGreaterThan(0)
      })
    })

    test('should provide descriptive error messages', () => {
      const input = createBaseInput({ club_name: '', current_members: -1 })
      const validation = engine.validateInput(input)

      expect(validation.errors).toContainEqual({
        code: 'MISSING_REQUIRED_FIELD',
        message: 'Club name is required and must be a non-empty string',
        field: 'club_name',
        value: '',
      })

      expect(validation.errors).toContainEqual({
        code: 'INVALID_MEMBERSHIP_COUNT',
        message: 'Current members must be a non-negative integer',
        field: 'current_members',
        value: -1,
      })
    })
  })
})
