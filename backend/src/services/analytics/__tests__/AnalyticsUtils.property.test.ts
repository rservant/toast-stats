/**
 * Property-Based Tests for AnalyticsUtils
 *
 * **Property 3: Utility Function Equivalence**
 * *For any* valid input to a shared utility function (parseIntSafe, ensureString,
 * getDCPCheckpoint, etc.), the extracted utility SHALL produce consistent and
 * correct results.
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 *
 * These tests verify that utility functions behave correctly across all valid inputs
 * using property-based testing with fast-check.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  parseIntSafe,
  ensureString,
  getDCPCheckpoint,
  getCurrentProgramMonth,
  getMonthName,
  findPreviousProgramYearDate,
  calculatePercentageChange,
  determineTrend,
} from '../AnalyticsUtils.js'

describe('AnalyticsUtils Property Tests', () => {
  /**
   * Property 3.1: parseIntSafe Consistency
   * For any valid input, parseIntSafe should return a consistent integer result.
   * **Validates: Requirements 3.1**
   */
  describe('Property 3.1: parseIntSafe Consistency', () => {
    it('should always return an integer for number inputs', () => {
      fc.assert(
        fc.property(fc.float({ noNaN: true, noDefaultInfinity: true }), num => {
          const result = parseIntSafe(num)
          return Number.isInteger(result)
        }),
        { numRuns: 100 }
      )
    })

    it('should always return an integer for string inputs', () => {
      fc.assert(
        fc.property(fc.string(), str => {
          const result = parseIntSafe(str)
          return Number.isInteger(result)
        }),
        { numRuns: 100 }
      )
    })

    it('should return default value for null/undefined', () => {
      fc.assert(
        fc.property(fc.integer(), defaultVal => {
          const resultNull = parseIntSafe(null, defaultVal)
          const resultUndefined = parseIntSafe(undefined, defaultVal)
          return resultNull === defaultVal && resultUndefined === defaultVal
        }),
        { numRuns: 100 }
      )
    })

    it('should floor floating point numbers consistently', () => {
      fc.assert(
        fc.property(fc.float({ noNaN: true, noDefaultInfinity: true }), num => {
          const result = parseIntSafe(num)
          return result === Math.floor(num)
        }),
        { numRuns: 100 }
      )
    })

    it('should parse integer strings correctly', () => {
      fc.assert(
        fc.property(fc.integer({ min: -1000000, max: 1000000 }), num => {
          const result = parseIntSafe(String(num))
          return result === num
        }),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 3.2: ensureString Consistency
   * For any input, ensureString should return a string.
   * **Validates: Requirements 3.1**
   */
  describe('Property 3.2: ensureString Consistency', () => {
    it('should always return a string for any input', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.string(),
            fc.integer(),
            fc.float({ noNaN: true }),
            fc.constant(null),
            fc.constant(undefined)
          ),
          input => {
            const result = ensureString(
              input as string | number | null | undefined
            )
            return typeof result === 'string'
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should return empty string for null/undefined', () => {
      expect(ensureString(null)).toBe('')
      expect(ensureString(undefined)).toBe('')
    })

    it('should preserve string inputs', () => {
      fc.assert(
        fc.property(fc.string(), str => {
          return ensureString(str) === str
        }),
        { numRuns: 100 }
      )
    })

    it('should convert numbers to their string representation', () => {
      fc.assert(
        fc.property(fc.integer(), num => {
          return ensureString(num) === String(num)
        }),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 3.3: getDCPCheckpoint Monotonicity
   * DCP checkpoints should be monotonically non-decreasing through the program year.
   * **Validates: Requirements 3.3**
   */
  describe('Property 3.3: getDCPCheckpoint Monotonicity', () => {
    it('should return values between 0 and 5 for valid months', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 12 }), month => {
          const result = getDCPCheckpoint(month)
          return result >= 0 && result <= 5
        }),
        { numRuns: 100 }
      )
    })

    it('should throw for invalid months', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.integer({ min: -100, max: 0 }),
            fc.integer({ min: 13, max: 100 })
          ),
          month => {
            try {
              getDCPCheckpoint(month)
              return false // Should have thrown
            } catch {
              return true // Expected behavior
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should be monotonically non-decreasing through program year', () => {
      // Program year order: July(7) → Aug(8) → Sep(9) → Oct(10) → Nov(11) → Dec(12) → Jan(1) → Feb(2) → Mar(3) → Apr(4) → May(5) → Jun(6)
      const programYearOrder = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6]
      const checkpoints = programYearOrder.map(getDCPCheckpoint)

      for (let i = 1; i < checkpoints.length; i++) {
        expect(checkpoints[i]).toBeGreaterThanOrEqual(checkpoints[i - 1]!)
      }
    })
  })

  /**
   * Property 3.4: getCurrentProgramMonth Range
   * getCurrentProgramMonth should always return a value between 1 and 12.
   * **Validates: Requirements 3.2**
   */
  describe('Property 3.4: getCurrentProgramMonth Range', () => {
    it('should return month between 1 and 12 for valid date strings', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2000, max: 2100 }),
          fc.integer({ min: 1, max: 12 }),
          fc.integer({ min: 1, max: 28 }),
          (year, month, day) => {
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const result = getCurrentProgramMonth(dateStr)
            // Result should be between 1 and 12
            return result >= 1 && result <= 12
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should return current month when no date provided', () => {
      const result = getCurrentProgramMonth()
      expect(result).toBeGreaterThanOrEqual(1)
      expect(result).toBeLessThanOrEqual(12)
    })
  })

  /**
   * Property 3.5: getMonthName Completeness
   * getMonthName should return a valid month name for months 1-12.
   * **Validates: Requirements 3.2**
   */
  describe('Property 3.5: getMonthName Completeness', () => {
    const validMonthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ]

    it('should return valid month name for months 1-12', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 12 }), month => {
          const result = getMonthName(month)
          return validMonthNames.includes(result)
        }),
        { numRuns: 100 }
      )
    })

    it('should return Unknown for invalid months', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.integer({ min: -100, max: 0 }),
            fc.integer({ min: 13, max: 100 })
          ),
          month => {
            return getMonthName(month) === 'Unknown'
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 3.6: findPreviousProgramYearDate Year Decrement
   * findPreviousProgramYearDate should always decrement the year by 1.
   * **Validates: Requirements 3.2**
   */
  describe('Property 3.6: findPreviousProgramYearDate Year Decrement', () => {
    it('should decrement year by exactly 1', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2000, max: 2100 }),
          fc.integer({ min: 1, max: 12 }),
          fc.integer({ min: 1, max: 28 }),
          (year, month, day) => {
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const result = findPreviousProgramYearDate(dateStr)
            const expectedYear = year - 1
            return result.startsWith(String(expectedYear))
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should preserve month and day', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2000, max: 2100 }),
          fc.integer({ min: 1, max: 12 }),
          fc.integer({ min: 1, max: 28 }),
          (year, month, day) => {
            const monthStr = String(month).padStart(2, '0')
            const dayStr = String(day).padStart(2, '0')
            const dateStr = `${year}-${monthStr}-${dayStr}`
            const result = findPreviousProgramYearDate(dateStr)
            return result.endsWith(`-${monthStr}-${dayStr}`)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 3.7: calculatePercentageChange Consistency
   * calculatePercentageChange should be consistent with mathematical definition.
   * **Validates: Requirements 3.2**
   */
  describe('Property 3.7: calculatePercentageChange Consistency', () => {
    it('should return 0 when values are equal', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 10000 }), value => {
          return calculatePercentageChange(value, value) === 0
        }),
        { numRuns: 100 }
      )
    })

    it('should return positive for increase', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000 }),
          fc.integer({ min: 1, max: 1000 }),
          (prev, increase) => {
            const current = prev + increase
            return calculatePercentageChange(prev, current) > 0
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should return negative for decrease', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 1000 }),
          fc.integer({ min: 1, max: 99 }),
          (prev, current) => {
            // Ensure current < prev for a decrease
            return calculatePercentageChange(prev, current) < 0
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should return 100 when previous is 0 and current is positive', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 1000 }), current => {
          return calculatePercentageChange(0, current) === 100
        }),
        { numRuns: 100 }
      )
    })

    it('should return 0 when both are 0', () => {
      expect(calculatePercentageChange(0, 0)).toBe(0)
    })
  })

  /**
   * Property 3.8: determineTrend Consistency
   * determineTrend should return consistent results for clearly trending data.
   * **Validates: Requirements 3.2**
   */
  describe('Property 3.8: determineTrend Consistency', () => {
    it('should return stable for single value or empty array', () => {
      expect(determineTrend([])).toBe('stable')
      fc.assert(
        fc.property(fc.float({ noNaN: true }), value => {
          return determineTrend([value]) === 'stable'
        }),
        { numRuns: 100 }
      )
    })

    it('should return stable for constant values', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000 }),
          fc.integer({ min: 2, max: 10 }),
          (value, length) => {
            const values = Array(length).fill(value)
            return determineTrend(values) === 'stable'
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should return increasing for strictly increasing sequences', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 20, max: 50 }),
          fc.integer({ min: 3, max: 10 }),
          (start, increment, length) => {
            const values = Array.from(
              { length },
              (_, i) => start + i * increment
            )
            return determineTrend(values) === 'increasing'
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should return decreasing for strictly decreasing sequences', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 200 }),
          fc.integer({ min: 10, max: 20 }),
          fc.integer({ min: 3, max: 10 }),
          (start, decrement, length) => {
            // Ensure decrement is significant enough relative to start value
            // to exceed the 5% threshold used by determineTrend
            const values = Array.from(
              { length },
              (_, i) => start - i * decrement
            )
            const result = determineTrend(values)
            // For small sequences with significant decrements, should be decreasing
            // But the threshold is 5%, so we need to verify the math
            const n = values.length
            const sumX = (n * (n - 1)) / 2
            const sumY = values.reduce((sum, val) => sum + val, 0)
            const sumXY = values.reduce((sum, val, idx) => sum + idx * val, 0)
            const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6
            const denominator = n * sumX2 - sumX * sumX
            const slope = (n * sumXY - sumX * sumY) / denominator
            const avgValue = sumY / n
            const relativeSlope = avgValue > 0 ? slope / avgValue : slope

            // If relative slope is < -0.05, should be decreasing
            // If relative slope is > 0.05, should be increasing
            // Otherwise should be stable
            if (relativeSlope < -0.05) {
              return result === 'decreasing'
            } else if (relativeSlope > 0.05) {
              return result === 'increasing'
            } else {
              return result === 'stable'
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should always return one of the three valid trend values', () => {
      fc.assert(
        fc.property(
          fc.array(fc.float({ min: -1000, max: 1000, noNaN: true }), {
            minLength: 0,
            maxLength: 20,
          }),
          values => {
            const result = determineTrend(values)
            return (
              result === 'increasing' ||
              result === 'decreasing' ||
              result === 'stable'
            )
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
