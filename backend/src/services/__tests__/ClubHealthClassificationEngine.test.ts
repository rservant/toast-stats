/**
 * Tests for Club Health Classification Engine
 */

import { describe, test, expect } from 'vitest'
import { ClubHealthClassificationEngineImpl } from '../ClubHealthClassificationEngine'
import { ClubHealthInput } from '../../types/clubHealth'

describe('ClubHealthClassificationEngine', () => {
  const engine = new ClubHealthClassificationEngineImpl()

  const createValidInput = (): ClubHealthInput => ({
    club_name: 'Test Club',
    current_members: 25,
    member_growth_since_july: 5,
    current_month: 'October',
    dcp_goals_achieved_ytd: 3,
    csp_submitted: true,
    officer_list_submitted: true,
    officers_trained: true,
    previous_month_members: 23,
    previous_month_dcp_goals_achieved_ytd: 2,
    previous_month_health_status: 'Vulnerable',
  })

  describe('validateInput', () => {
    test('should validate correct input', () => {
      const input = createValidInput()
      const result = engine.validateInput(input)

      expect(result.is_valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    test('should reject empty club name', () => {
      const input = createValidInput()
      input.club_name = ''

      const result = engine.validateInput(input)

      expect(result.is_valid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].code).toBe('MISSING_REQUIRED_FIELD')
    })

    test('should reject negative membership count', () => {
      const input = createValidInput()
      input.current_members = -1

      const result = engine.validateInput(input)

      expect(result.is_valid).toBe(false)
      expect(result.errors[0].code).toBe('INVALID_MEMBERSHIP_COUNT')
    })

    test('should reject invalid month', () => {
      const input = createValidInput()
      // @ts-expect-error Testing invalid month
      input.current_month = 'InvalidMonth'

      const result = engine.validateInput(input)

      expect(result.is_valid).toBe(false)
      expect(result.errors[0].code).toBe('INVALID_MONTH')
    })
  })

  describe('classifyClub', () => {
    test('should classify a thriving club correctly', () => {
      const input = createValidInput()

      const result = engine.classifyClub(input)

      expect(result.club_name).toBe('Test Club')
      expect(result.health_status).toBe('Thriving')
      expect(result.trajectory).toBe('Recovering')
      expect(result.composite_key).toBe('Thriving__Recovering')
      expect(result.composite_label).toBe('Thriving · Recovering')
      expect(result.members_delta_mom).toBe(2) // 25 - 23
      expect(result.dcp_delta_mom).toBe(1) // 3 - 2
      expect(result.reasons).toContain(
        'All requirements met: membership, DCP, and CSP'
      )
      expect(result.metadata.rule_version).toBe('1.0.0')
    })

    test('should calculate month-over-month deltas correctly', () => {
      const input = createValidInput()
      input.current_members = 20
      input.previous_month_members = 18
      input.dcp_goals_achieved_ytd = 4
      input.previous_month_dcp_goals_achieved_ytd = 3

      const result = engine.classifyClub(input)

      expect(result.members_delta_mom).toBe(2)
      expect(result.dcp_delta_mom).toBe(1)
    })

    test('should throw error for invalid input', () => {
      const input = createValidInput()
      input.club_name = ''

      expect(() => engine.classifyClub(input)).toThrow('Invalid input')
    })
  })

  describe('batchClassifyClubs', () => {
    test('should process multiple clubs correctly', () => {
      const inputs = [
        createValidInput(),
        {
          ...createValidInput(),
          club_name: 'Second Club',
          current_members: 15,
        },
      ]

      const results = engine.batchClassifyClubs(inputs)

      expect(results).toHaveLength(2)
      expect(results[0].club_name).toBe('Test Club')
      expect(results[1].club_name).toBe('Second Club')
    })

    test('should return empty array for empty input', () => {
      const results = engine.batchClassifyClubs([])

      expect(results).toHaveLength(0)
    })

    test('should throw error for invalid array input', () => {
      // @ts-expect-error Testing invalid input
      expect(() => engine.batchClassifyClubs('not an array')).toThrow(
        'Input must be an array'
      )
    })

    test('should handle mixed valid and invalid inputs', () => {
      const inputs = [
        createValidInput(),
        { ...createValidInput(), club_name: '' }, // Invalid
      ]

      expect(() => engine.batchClassifyClubs(inputs)).toThrow(
        'Batch processing failed'
      )
    })

    test('should ensure consistent results between individual and batch processing', () => {
      const input = createValidInput()

      const individualResult = engine.classifyClub(input)
      const batchResults = engine.batchClassifyClubs([input])

      expect(batchResults).toHaveLength(1)
      expect(batchResults[0].club_name).toBe(individualResult.club_name)
      expect(batchResults[0].health_status).toBe(individualResult.health_status)
      expect(batchResults[0].trajectory).toBe(individualResult.trajectory)
      expect(batchResults[0].composite_key).toBe(individualResult.composite_key)
      expect(batchResults[0].composite_label).toBe(
        individualResult.composite_label
      )
      expect(batchResults[0].members_delta_mom).toBe(
        individualResult.members_delta_mom
      )
      expect(batchResults[0].dcp_delta_mom).toBe(individualResult.dcp_delta_mom)
    })
  })
})
