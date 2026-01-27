/**
 * Property-Based Tests for DistrictIdValidator
 *
 * **Feature: district-analytics-performance, Property 12: District ID Validation**
 *
 * This test validates the district ID validation logic using property-based testing
 * to ensure correct acceptance/rejection across all valid inputs.
 *
 * **Validates: Requirements 9.1, 9.2, 9.3**
 *
 * Property 12: District ID Validation
 * *For any* generated string:
 * - If matches date pattern → rejected
 * - If empty/whitespace → rejected
 * - If contains non-alphanumeric → rejected
 * - If alphanumeric only → accepted
 *
 * This is warranted because:
 * - Input validation with many boundary conditions
 * - Existing bug reveals missed edge cases
 * - Manual enumeration of all date formats is impractical
 */

import { describe, it, expect, beforeEach } from 'vitest'
import fc from 'fast-check'
import {
  DistrictIdValidator,
  RejectionReasons,
} from '../DistrictIdValidator.js'

describe('DistrictIdValidator - Property Tests', () => {
  let validator: DistrictIdValidator

  beforeEach(() => {
    validator = new DistrictIdValidator()
  })

  /**
   * Generator for valid alphanumeric district IDs
   * These should always be accepted
   */
  const validDistrictIdArb = fc
    .stringMatching(/^[A-Za-z0-9]+$/)
    .filter(s => s.length > 0)

  /**
   * Generator for date pattern strings that should be rejected
   * Matches "As of MM/DD/YYYY" or "As of M/D/YYYY" with case variations
   */
  const datePatternArb = fc
    .tuple(
      fc.constantFrom('As of', 'as of', 'AS OF', 'As Of', 'aS oF'),
      fc.integer({ min: 1, max: 12 }), // month
      fc.integer({ min: 1, max: 31 }), // day
      fc.integer({ min: 1900, max: 2100 }) // year
    )
    .map(([prefix, month, day, year]) => `${prefix} ${month}/${day}/${year}`)

  /**
   * Generator for empty/whitespace strings that should be rejected
   */
  const emptyOrWhitespaceArb = fc.oneof(
    fc.constant(''),
    fc.constant(' '),
    fc.constant('  '),
    fc.constant('   '),
    fc.constant('\t'),
    fc.constant('\n'),
    fc.constant('\r'),
    fc.constant(' \t\n'),
    fc.constant('\t\t\t'),
    fc.constant('  \n  ')
  )

  /**
   * Generator for strings with invalid characters (non-alphanumeric)
   * These should be rejected
   */
  const invalidCharacterArb = fc
    .tuple(
      fc
        .string({ minLength: 0, maxLength: 5 })
        .filter(s => /^[A-Za-z0-9]*$/.test(s)),
      fc.constantFrom(
        '-',
        '_',
        ' ',
        '.',
        '/',
        '@',
        '#',
        '!',
        '$',
        '%',
        '^',
        '&',
        '*',
        '(',
        ')'
      ),
      fc
        .string({ minLength: 0, maxLength: 5 })
        .filter(s => /^[A-Za-z0-9]*$/.test(s))
    )
    .map(([prefix, invalidChar, suffix]) => `${prefix}${invalidChar}${suffix}`)
    .filter(s => s.trim().length > 0) // Exclude pure whitespace (handled separately)

  /**
   * Property 12: District ID Validation
   *
   * **Feature: district-analytics-performance, Property 12: District ID Validation**
   * **Validates: Requirements 9.1, 9.2, 9.3**
   *
   * *For any* generated string:
   * - If matches date pattern → rejected
   * - If empty/whitespace → rejected
   * - If contains non-alphanumeric → rejected
   * - If alphanumeric only → accepted
   */
  describe('Property 12: District ID Validation', () => {
    /**
     * Property: Valid alphanumeric district IDs are always accepted
     *
     * **Validates: Requirement 9.3** - only alphanumeric characters allowed
     */
    it('accepts all valid alphanumeric district IDs', () => {
      fc.assert(
        fc.property(validDistrictIdArb, (districtId: string) => {
          const result = validator.validate(districtId)

          expect(result.isValid).toBe(true)
          expect(result.reason).toBeUndefined()
        }),
        { numRuns: 100 }
      )
    })

    /**
     * Property: Date pattern strings are always rejected
     *
     * **Validates: Requirement 9.1** - reject records where district ID matches date pattern
     */
    it('rejects all date pattern strings', () => {
      fc.assert(
        fc.property(datePatternArb, (dateString: string) => {
          const result = validator.validate(dateString)

          expect(result.isValid).toBe(false)
          expect(result.reason).toBe(RejectionReasons.DATE_PATTERN)
        }),
        { numRuns: 100 }
      )
    })

    /**
     * Property: Empty and whitespace-only strings are always rejected
     *
     * **Validates: Requirement 9.2** - reject empty, null, or whitespace-only
     */
    it('rejects all empty and whitespace-only strings', () => {
      fc.assert(
        fc.property(emptyOrWhitespaceArb, (emptyString: string) => {
          const result = validator.validate(emptyString)

          expect(result.isValid).toBe(false)
          expect(
            result.reason === RejectionReasons.EMPTY ||
              result.reason === RejectionReasons.WHITESPACE_ONLY
          ).toBe(true)
        }),
        { numRuns: 100 }
      )
    })

    /**
     * Property: Strings with invalid characters are always rejected
     *
     * **Validates: Requirement 9.3** - only alphanumeric characters allowed
     */
    it('rejects all strings with invalid characters', () => {
      fc.assert(
        fc.property(invalidCharacterArb, (invalidString: string) => {
          const result = validator.validate(invalidString)

          expect(result.isValid).toBe(false)
          expect(result.reason).toBe(RejectionReasons.INVALID_CHARACTERS)
        }),
        { numRuns: 100 }
      )
    })

    /**
     * Property: Validation is deterministic - same input always produces same output
     */
    it('validation is deterministic', () => {
      fc.assert(
        fc.property(fc.string(), (input: string) => {
          const result1 = validator.validate(input)
          const result2 = validator.validate(input)

          expect(result1.isValid).toBe(result2.isValid)
          expect(result1.reason).toBe(result2.reason)
        }),
        { numRuns: 100 }
      )
    })

    /**
     * Property: Validation result is always well-formed
     * - isValid is always a boolean
     * - reason is undefined when valid, defined when invalid
     */
    it('validation result is always well-formed', () => {
      fc.assert(
        fc.property(fc.string(), (input: string) => {
          const result = validator.validate(input)

          expect(typeof result.isValid).toBe('boolean')

          if (result.isValid) {
            expect(result.reason).toBeUndefined()
          } else {
            expect(result.reason).toBeDefined()
            expect(typeof result.reason).toBe('string')
            expect(result.reason!.length).toBeGreaterThan(0)
          }
        }),
        { numRuns: 100 }
      )
    })

    /**
     * Property: Numeric-only strings are valid district IDs
     * This covers common district IDs like "42", "61", "123"
     */
    it('accepts all numeric-only strings', () => {
      const numericOnlyArb = fc
        .stringMatching(/^[0-9]+$/)
        .filter(s => s.length > 0)

      fc.assert(
        fc.property(numericOnlyArb, (numericId: string) => {
          const result = validator.validate(numericId)

          expect(result.isValid).toBe(true)
          expect(result.reason).toBeUndefined()
        }),
        { numRuns: 100 }
      )
    })

    /**
     * Property: Letter-only strings are valid district IDs
     * This covers district IDs like "F", "A", "District"
     */
    it('accepts all letter-only strings', () => {
      const letterOnlyArb = fc
        .stringMatching(/^[A-Za-z]+$/)
        .filter(s => s.length > 0)

      fc.assert(
        fc.property(letterOnlyArb, (letterId: string) => {
          const result = validator.validate(letterId)

          expect(result.isValid).toBe(true)
          expect(result.reason).toBeUndefined()
        }),
        { numRuns: 100 }
      )
    })

    /**
     * Property: Mixed alphanumeric strings are valid district IDs
     * This covers district IDs like "D42", "Region1", "42A"
     */
    it('accepts all mixed alphanumeric strings', () => {
      const mixedAlphanumericArb = fc
        .tuple(fc.stringMatching(/^[A-Za-z]+$/), fc.stringMatching(/^[0-9]+$/))
        .chain(([letters, numbers]) =>
          fc.constantFrom(
            `${letters}${numbers}`,
            `${numbers}${letters}`,
            `${letters}${numbers}${letters}`
          )
        )
        .filter(s => s.length > 0)

      fc.assert(
        fc.property(mixedAlphanumericArb, (mixedId: string) => {
          const result = validator.validate(mixedId)

          expect(result.isValid).toBe(true)
          expect(result.reason).toBeUndefined()
        }),
        { numRuns: 100 }
      )
    })

    /**
     * Property: Date patterns with various month/day combinations are rejected
     * Tests edge cases like single-digit months/days
     */
    it('rejects date patterns with all valid month/day combinations', () => {
      const comprehensiveDateArb = fc
        .tuple(
          fc.constantFrom('As of', 'as of', 'AS OF'),
          fc.integer({ min: 1, max: 12 }),
          fc.integer({ min: 1, max: 31 }),
          fc.integer({ min: 2000, max: 2030 })
        )
        .map(
          ([prefix, month, day, year]) => `${prefix} ${month}/${day}/${year}`
        )

      fc.assert(
        fc.property(comprehensiveDateArb, (dateString: string) => {
          const result = validator.validate(dateString)

          expect(result.isValid).toBe(false)
          expect(result.reason).toBe(RejectionReasons.DATE_PATTERN)
        }),
        { numRuns: 100 }
      )
    })

    /**
     * Property: Strings with leading/trailing whitespace and alphanumeric content
     * are rejected due to invalid characters (the whitespace)
     */
    it('rejects alphanumeric strings with leading/trailing whitespace', () => {
      const paddedAlphanumericArb = fc
        .tuple(
          fc.constantFrom(' ', '  ', '\t', ' \t'),
          fc.stringMatching(/^[A-Za-z0-9]+$/).filter(s => s.length > 0),
          fc.constantFrom('', ' ', '\t', '  ')
        )
        .map(
          ([leading, content, trailing]) => `${leading}${content}${trailing}`
        )

      fc.assert(
        fc.property(paddedAlphanumericArb, (paddedString: string) => {
          const result = validator.validate(paddedString)

          expect(result.isValid).toBe(false)
          expect(result.reason).toBe(RejectionReasons.INVALID_CHARACTERS)
        }),
        { numRuns: 100 }
      )
    })

    /**
     * Property: Special characters mixed with alphanumeric are always rejected
     */
    it('rejects strings with special characters mixed with alphanumeric', () => {
      const specialCharMixArb = fc
        .tuple(
          fc.stringMatching(/^[A-Za-z0-9]{1,5}$/),
          fc.constantFrom(
            '!',
            '@',
            '#',
            '$',
            '%',
            '^',
            '&',
            '*',
            '(',
            ')',
            '-',
            '_',
            '+',
            '=',
            '[',
            ']',
            '{',
            '}',
            '|',
            '\\',
            ':',
            ';',
            '"',
            "'",
            '<',
            '>',
            ',',
            '.',
            '?',
            '/'
          ),
          fc.stringMatching(/^[A-Za-z0-9]{0,5}$/)
        )
        .map(([prefix, special, suffix]) => `${prefix}${special}${suffix}`)

      fc.assert(
        fc.property(specialCharMixArb, (mixedString: string) => {
          const result = validator.validate(mixedString)

          expect(result.isValid).toBe(false)
          expect(result.reason).toBe(RejectionReasons.INVALID_CHARACTERS)
        }),
        { numRuns: 100 }
      )
    })
  })
})
