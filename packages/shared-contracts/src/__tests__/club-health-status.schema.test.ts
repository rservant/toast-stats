/**
 * Unit tests for ClubHealthStatusSchema Zod validation.
 *
 * These tests verify that the Zod schema correctly validates:
 * - All 3 valid ClubHealthStatus values: 'thriving', 'vulnerable', 'intervention-required'
 * - Rejects the underscore variant 'intervention_required' (common mistake)
 * - Rejects arbitrary invalid strings
 *
 * **Validates: Requirements 1.2, 1.3**
 *
 * @module club-health-status.schema.test
 */

import { describe, it, expect } from 'vitest'
import { ClubHealthStatusSchema } from '../schemas/club-health-status.schema.js'

describe('ClubHealthStatusSchema validation', () => {
  describe('valid ClubHealthStatus values', () => {
    /**
     * **Validates: Requirements 1.2, 1.3**
     *
     * THE shared-contracts package SHALL export a Zod schema `ClubHealthStatusSchema`
     * for runtime validation with values: 'thriving', 'vulnerable', 'intervention-required'
     */
    it('should accept "thriving" as a valid status', () => {
      const result = ClubHealthStatusSchema.safeParse('thriving')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe('thriving')
      }
    })

    it('should accept "vulnerable" as a valid status', () => {
      const result = ClubHealthStatusSchema.safeParse('vulnerable')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe('vulnerable')
      }
    })

    it('should accept "intervention-required" (hyphen format) as a valid status', () => {
      const result = ClubHealthStatusSchema.safeParse('intervention-required')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe('intervention-required')
      }
    })
  })

  describe('invalid ClubHealthStatus values', () => {
    /**
     * **Validates: Requirements 1.3**
     *
     * THE shared-contracts package SHALL use hyphen format ('intervention-required')
     * to match frontend conventions. The underscore variant MUST be rejected.
     */
    it('should reject "intervention_required" (underscore variant)', () => {
      const result = ClubHealthStatusSchema.safeParse('intervention_required')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toBeDefined()
        expect(result.error.issues.length).toBeGreaterThan(0)
      }
    })

    /**
     * **Validates: Requirements 1.2**
     *
     * THE Zod schema SHALL reject arbitrary invalid strings that are not
     * one of the 3 valid ClubHealthStatus values.
     */
    it('should reject arbitrary invalid string "invalid-status"', () => {
      const result = ClubHealthStatusSchema.safeParse('invalid-status')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toBeDefined()
        expect(result.error.issues.length).toBeGreaterThan(0)
      }
    })

    it('should reject empty string', () => {
      const result = ClubHealthStatusSchema.safeParse('')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toBeDefined()
        expect(result.error.issues.length).toBeGreaterThan(0)
      }
    })

    it('should reject "stable" (not a valid status value)', () => {
      const result = ClubHealthStatusSchema.safeParse('stable')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toBeDefined()
        expect(result.error.issues.length).toBeGreaterThan(0)
      }
    })

    it('should reject non-string values (number)', () => {
      const result = ClubHealthStatusSchema.safeParse(123)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toBeDefined()
        expect(result.error.issues.length).toBeGreaterThan(0)
      }
    })

    it('should reject non-string values (null)', () => {
      const result = ClubHealthStatusSchema.safeParse(null)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toBeDefined()
        expect(result.error.issues.length).toBeGreaterThan(0)
      }
    })

    it('should reject non-string values (undefined)', () => {
      const result = ClubHealthStatusSchema.safeParse(undefined)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toBeDefined()
        expect(result.error.issues.length).toBeGreaterThan(0)
      }
    })

    it('should reject non-string values (object)', () => {
      const result = ClubHealthStatusSchema.safeParse({ status: 'thriving' })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toBeDefined()
        expect(result.error.issues.length).toBeGreaterThan(0)
      }
    })
  })
})
