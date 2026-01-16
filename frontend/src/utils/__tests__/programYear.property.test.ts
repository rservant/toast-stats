import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { calculateProgramYearDay } from '../programYear'

/**
 * Property-based tests for program year utilities
 * **Feature: membership-payments-chart**
 */

describe('calculateProgramYearDay Property Tests', () => {
  /**
   * **Feature: membership-payments-chart, Property 3: Program Year Day Alignment**
   * **Validates: Requirements 2.2**
   *
   * For any date within a program year, the calculateProgramYearDay function
   * SHALL return a value between 0 and 365 (inclusive), and dates that are
   * the same calendar day in different program years SHALL produce the same
   * program year day value.
   */

  // Generator for valid dates within reasonable range
  const validDateArb = fc
    .integer({
      min: new Date('2015-07-01').getTime(),
      max: new Date('2030-06-30').getTime(),
    })
    .map(timestamp => new Date(timestamp))

  // Generator for month (0-11) and day (1-28 to avoid month boundary issues)
  const monthDayArb = fc.record({
    month: fc.integer({ min: 0, max: 11 }),
    day: fc.integer({ min: 1, max: 28 }),
  })

  // Generator for program year start years
  const programYearStartArb = fc.integer({ min: 2015, max: 2029 })

  it('should always return a value between 0 and 365 inclusive', () => {
    fc.assert(
      fc.property(validDateArb, date => {
        const result = calculateProgramYearDay(date)

        // Result must be in valid range
        expect(result).toBeGreaterThanOrEqual(0)
        expect(result).toBeLessThanOrEqual(365)

        // Result must be an integer
        expect(Number.isInteger(result)).toBe(true)
      }),
      { numRuns: 100 }
    )
  })

  it('should return 0 for July 1 of any year', () => {
    fc.assert(
      fc.property(programYearStartArb, year => {
        const july1 = new Date(year, 6, 1) // Month 6 = July
        const result = calculateProgramYearDay(july1)

        expect(result).toBe(0)
      }),
      { numRuns: 100 }
    )
  })

  it('should return approximately the same day number for the same calendar day in different program years (within leap year variance)', () => {
    fc.assert(
      fc.property(
        monthDayArb,
        fc.integer({ min: 2015, max: 2025 }),
        fc.integer({ min: 2015, max: 2025 }),
        ({ month, day }, year1, year2) => {
          // Create dates with the same month/day but different years
          // Adjust year based on whether the month is in first or second half of program year
          const adjustedYear1 = month >= 6 ? year1 : year1 + 1
          const adjustedYear2 = month >= 6 ? year2 : year2 + 1

          const date1 = new Date(adjustedYear1, month, day)
          const date2 = new Date(adjustedYear2, month, day)

          const result1 = calculateProgramYearDay(date1)
          const result2 = calculateProgramYearDay(date2)

          // Same calendar day (month/day) should produce approximately the same program year day
          // Allow for ±1 day variance due to leap years affecting February
          // (A program year spanning a leap year has 366 days vs 365)
          expect(Math.abs(result1 - result2)).toBeLessThanOrEqual(1)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should produce monotonically increasing values for consecutive dates within a program year', () => {
    fc.assert(
      fc.property(
        programYearStartArb,
        fc.integer({ min: 0, max: 360 }),
        (startYear, dayOffset) => {
          // Create two consecutive dates within the same program year
          const programYearStart = new Date(startYear, 6, 1)
          const date1 = new Date(
            programYearStart.getTime() + dayOffset * 24 * 60 * 60 * 1000
          )
          const date2 = new Date(
            programYearStart.getTime() + (dayOffset + 1) * 24 * 60 * 60 * 1000
          )

          const result1 = calculateProgramYearDay(date1)
          const result2 = calculateProgramYearDay(date2)

          // Later date should have higher or equal day number
          // (equal only at boundary when clamped to 365)
          expect(result2).toBeGreaterThanOrEqual(result1)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should handle string date inputs correctly', () => {
    fc.assert(
      fc.property(validDateArb, date => {
        const dateString = date.toISOString().split('T')[0] // YYYY-MM-DD format

        const resultFromDate = calculateProgramYearDay(date)
        const resultFromString = calculateProgramYearDay(dateString)

        // Both should produce valid results in range
        expect(resultFromDate).toBeGreaterThanOrEqual(0)
        expect(resultFromDate).toBeLessThanOrEqual(365)
        expect(resultFromString).toBeGreaterThanOrEqual(0)
        expect(resultFromString).toBeLessThanOrEqual(365)
      }),
      { numRuns: 100 }
    )
  })
})
