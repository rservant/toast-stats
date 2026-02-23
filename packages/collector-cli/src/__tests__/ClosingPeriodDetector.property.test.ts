/**
 * Property-Based Tests for ClosingPeriodDetector
 *
 * @pbt-justification Warranted per .kiro/steering/testing.md criteria:
 *   - Complex input space: date boundary detection across generated date combinations
 *   - Mathematical invariant: closing period detection must be deterministic for any date
 *
 * Feature: collector-cli-month-end-compliance
 *
 * Property 1: Last Day of Month Calculation
 * *For any* valid year and month combination, the `getLastDayOfMonth` function
 * should return the correct last day (handling February in leap years, 30-day
 * months, and 31-day months).
 * **Validates: Requirements 2.1**
 *
 * Property 2: Closing Period Snapshot Date Calculation
 * *For any* closing period data with a valid data month, the calculated snapshot
 * date should be the last day of that data month, including correct handling of
 * cross-year scenarios (December data collected in January).
 * **Validates: Requirements 2.2, 2.3, 5.1, 5.2**
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { ClosingPeriodDetector } from '../utils/ClosingPeriodDetector.js'

// ========== Arbitraries (Generators) ==========

/**
 * Generate a valid year in a reasonable range
 * Range: 1970-2100 covers historical data and future projections
 */
const yearArb = fc.integer({ min: 1970, max: 2100 })

/**
 * Generate a valid month (1-12)
 */
const monthArb = fc.integer({ min: 1, max: 12 })

/**
 * Generate a valid year and month combination
 */
const yearMonthArb = fc.tuple(yearArb, monthArb)

// ========== Helper Functions ==========

/**
 * Determine if a year is a leap year
 *
 * A year is a leap year if:
 * - It is divisible by 4 AND
 * - Either not divisible by 100 OR divisible by 400
 */
function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

/**
 * Get the expected last day of a month using a reference implementation
 *
 * This is an independent implementation to verify against the system under test.
 * Uses explicit month-day mapping rather than Date object manipulation.
 */
function getExpectedLastDay(year: number, month: number): number {
  // Days in each month (non-leap year)
  const daysInMonth: Record<number, number> = {
    1: 31, // January
    2: 28, // February (non-leap year)
    3: 31, // March
    4: 30, // April
    5: 31, // May
    6: 30, // June
    7: 31, // July
    8: 31, // August
    9: 30, // September
    10: 31, // October
    11: 30, // November
    12: 31, // December
  }

  // Handle February in leap years
  if (month === 2 && isLeapYear(year)) {
    return 29
  }

  const days = daysInMonth[month]
  if (days === undefined) {
    throw new Error(`Invalid month: ${month}`)
  }

  return days
}

// ========== Property Tests ==========

describe('ClosingPeriodDetector Property Tests', () => {
  /**
   * Feature: collector-cli-month-end-compliance
   * Property 1: Last Day of Month Calculation
   *
   * *For any* valid year and month combination, the `getLastDayOfMonth` function
   * should return the correct last day (handling February in leap years, 30-day
   * months, and 31-day months).
   *
   * **Validates: Requirements 2.1**
   */
  describe('Property 1: Last Day of Month Calculation', () => {
    const detector = new ClosingPeriodDetector()

    it('should return the correct last day for any valid year and month', () => {
      // **Validates: Requirements 2.1**
      fc.assert(
        fc.property(yearMonthArb, ([year, month]) => {
          const actual = detector.getLastDayOfMonth(year, month)
          const expected = getExpectedLastDay(year, month)

          expect(actual).toBe(expected)
        }),
        { numRuns: 100 }
      )
    })

    it('should return 28 or 29 for February depending on leap year', () => {
      // **Validates: Requirements 2.1**
      fc.assert(
        fc.property(yearArb, year => {
          const actual = detector.getLastDayOfMonth(year, 2)

          if (isLeapYear(year)) {
            expect(actual).toBe(29)
          } else {
            expect(actual).toBe(28)
          }
        }),
        { numRuns: 100 }
      )
    })

    it('should return 31 for months with 31 days (Jan, Mar, May, Jul, Aug, Oct, Dec)', () => {
      // **Validates: Requirements 2.1**
      const thirtyOneDayMonths = [1, 3, 5, 7, 8, 10, 12]
      const monthWith31DaysArb = fc.constantFrom(...thirtyOneDayMonths)

      fc.assert(
        fc.property(yearArb, monthWith31DaysArb, (year, month) => {
          const actual = detector.getLastDayOfMonth(year, month)
          expect(actual).toBe(31)
        }),
        { numRuns: 100 }
      )
    })

    it('should return 30 for months with 30 days (Apr, Jun, Sep, Nov)', () => {
      // **Validates: Requirements 2.1**
      const thirtyDayMonths = [4, 6, 9, 11]
      const monthWith30DaysArb = fc.constantFrom(...thirtyDayMonths)

      fc.assert(
        fc.property(yearArb, monthWith30DaysArb, (year, month) => {
          const actual = detector.getLastDayOfMonth(year, month)
          expect(actual).toBe(30)
        }),
        { numRuns: 100 }
      )
    })

    it('should handle leap year edge cases correctly', () => {
      // **Validates: Requirements 2.1**
      // Test specific leap year rules:
      // - Divisible by 4 but not 100 → leap year
      // - Divisible by 100 but not 400 → NOT leap year
      // - Divisible by 400 → leap year

      // Generate years that are divisible by 4
      const divisibleBy4Arb = fc
        .integer({ min: 1972, max: 2096 })
        .filter(y => y % 4 === 0)

      fc.assert(
        fc.property(divisibleBy4Arb, year => {
          const actual = detector.getLastDayOfMonth(year, 2)
          const expectedLeapYear = isLeapYear(year)

          if (expectedLeapYear) {
            expect(actual).toBe(29)
          } else {
            expect(actual).toBe(28)
          }
        }),
        { numRuns: 100 }
      )
    })

    it('should handle century years correctly (1900, 2000, 2100)', () => {
      // **Validates: Requirements 2.1**
      // Century years are only leap years if divisible by 400
      // 1900: not leap (divisible by 100, not by 400)
      // 2000: leap (divisible by 400)
      // 2100: not leap (divisible by 100, not by 400)

      expect(detector.getLastDayOfMonth(1900, 2)).toBe(28) // Not a leap year
      expect(detector.getLastDayOfMonth(2000, 2)).toBe(29) // Leap year
      expect(detector.getLastDayOfMonth(2100, 2)).toBe(28) // Not a leap year
    })

    it('should always return a value between 28 and 31', () => {
      // **Validates: Requirements 2.1**
      fc.assert(
        fc.property(yearMonthArb, ([year, month]) => {
          const actual = detector.getLastDayOfMonth(year, month)

          expect(actual).toBeGreaterThanOrEqual(28)
          expect(actual).toBeLessThanOrEqual(31)
        }),
        { numRuns: 100 }
      )
    })

    it('should be consistent across multiple calls with same inputs', () => {
      // **Validates: Requirements 2.1**
      fc.assert(
        fc.property(yearMonthArb, ([year, month]) => {
          const result1 = detector.getLastDayOfMonth(year, month)
          const result2 = detector.getLastDayOfMonth(year, month)
          const result3 = detector.getLastDayOfMonth(year, month)

          expect(result1).toBe(result2)
          expect(result2).toBe(result3)
        }),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Feature: collector-cli-month-end-compliance
   * Property 2: Closing Period Snapshot Date Calculation
   *
   * *For any* closing period data with a valid data month, the calculated snapshot
   * date should be the last day of that data month, including correct handling of
   * cross-year scenarios (December data collected in January).
   *
   * **Validates: Requirements 2.2, 2.3, 5.1, 5.2**
   */
  describe('Property 2: Closing Period Snapshot Date Calculation', () => {
    const detector = new ClosingPeriodDetector()

    // ========== Arbitraries for Property 2 ==========

    /**
     * Generate a valid data month in YYYY-MM format
     */
    const dataMonthArb = fc.tuple(yearArb, monthArb).map(([year, month]) => ({
      year,
      month,
      formatted: `${year}-${month.toString().padStart(2, '0')}`,
    }))

    /**
     * Generate a valid collection date that is in the month AFTER the data month
     * This simulates a closing period scenario where data from month N is collected in month N+1
     */
    const closingPeriodScenarioArb = fc
      .tuple(yearArb, monthArb, fc.integer({ min: 1, max: 28 }))
      .map(([dataYear, dataMonth, collectionDay]) => {
        // Collection is in the month after data month
        let collectionYear = dataYear
        let collectionMonth = dataMonth + 1

        // Handle year rollover
        if (collectionMonth > 12) {
          collectionMonth = 1
          collectionYear = dataYear + 1
        }

        const collectionDate = `${collectionYear}-${collectionMonth.toString().padStart(2, '0')}-${collectionDay.toString().padStart(2, '0')}`
        const dataMonthFormatted = `${dataYear}-${dataMonth.toString().padStart(2, '0')}`

        return {
          dataYear,
          dataMonth,
          dataMonthFormatted,
          collectionYear,
          collectionMonth,
          collectionDay,
          collectionDate,
        }
      })

    /**
     * Generate specifically December data collected in January (cross-year scenario)
     */
    const crossYearScenarioArb = fc
      .tuple(yearArb, fc.integer({ min: 1, max: 28 }))
      .map(([dataYear, collectionDay]) => {
        const collectionYear = dataYear + 1
        const collectionDate = `${collectionYear}-01-${collectionDay.toString().padStart(2, '0')}`
        const dataMonthFormatted = `${dataYear}-12`

        return {
          dataYear,
          dataMonth: 12,
          dataMonthFormatted,
          collectionYear,
          collectionMonth: 1,
          collectionDay,
          collectionDate,
        }
      })

    // ========== Property 2 Tests ==========

    it('should calculate snapshot date as last day of data month for any closing period', () => {
      // **Validates: Requirements 2.2, 5.2**
      // Requirement 2.2: WHEN `isClosingPeriod` is true THEN the TransformService SHALL write
      // the snapshot to `CACHE_DIR/snapshots/{lastDayOfDataMonth}/`
      // Requirement 5.2: WHEN transforming closing period data THEN the TransformService SHALL
      // only create a snapshot for the last day of the data month

      fc.assert(
        fc.property(closingPeriodScenarioArb, scenario => {
          const metadata = {
            date: scenario.collectionDate,
            isClosingPeriod: true,
            dataMonth: scenario.dataMonthFormatted,
          }

          const result = detector.detect(scenario.collectionDate, metadata)

          // Verify it's detected as a closing period
          expect(result.isClosingPeriod).toBe(true)

          // Calculate expected last day
          const expectedLastDay = getExpectedLastDay(
            scenario.dataYear,
            scenario.dataMonth
          )
          const expectedSnapshotDate = `${scenario.dataYear}-${scenario.dataMonth.toString().padStart(2, '0')}-${expectedLastDay.toString().padStart(2, '0')}`

          // Verify snapshot date is the last day of the data month
          expect(result.snapshotDate).toBe(expectedSnapshotDate)
          expect(result.logicalDate).toBe(expectedSnapshotDate)
        }),
        { numRuns: 100 }
      )
    })

    it('should produce December 31 of prior year for cross-year scenarios (December data in January)', () => {
      // **Validates: Requirements 2.3**
      // Requirement 2.3: WHEN the data month is December and the collection date is in January
      // THEN the snapshot SHALL be dated December 31 of the prior year

      fc.assert(
        fc.property(crossYearScenarioArb, scenario => {
          const metadata = {
            date: scenario.collectionDate,
            isClosingPeriod: true,
            dataMonth: scenario.dataMonthFormatted,
          }

          const result = detector.detect(scenario.collectionDate, metadata)

          // Verify it's detected as a closing period
          expect(result.isClosingPeriod).toBe(true)

          // December always has 31 days
          const expectedSnapshotDate = `${scenario.dataYear}-12-31`

          // Verify snapshot date is December 31 of the data year (prior year)
          expect(result.snapshotDate).toBe(expectedSnapshotDate)
          expect(result.logicalDate).toBe(expectedSnapshotDate)

          // Verify the snapshot year is the prior year (data year, not collection year)
          const snapshotYear = parseInt(
            result.snapshotDate.split('-')[0] ?? '0',
            10
          )
          expect(snapshotYear).toBe(scenario.dataYear)
          expect(snapshotYear).toBe(scenario.collectionYear - 1)
        }),
        { numRuns: 100 }
      )
    })

    it('should never produce a snapshot date in the collection month for closing periods', () => {
      // **Validates: Requirements 5.1**
      // Requirement 5.1: WHEN a closing period is detected THEN the TransformService SHALL NOT
      // create a snapshot dated in the new month (the month of the collection date)

      fc.assert(
        fc.property(closingPeriodScenarioArb, scenario => {
          const metadata = {
            date: scenario.collectionDate,
            isClosingPeriod: true,
            dataMonth: scenario.dataMonthFormatted,
          }

          const result = detector.detect(scenario.collectionDate, metadata)

          // Extract month from snapshot date
          const snapshotDateParts = result.snapshotDate.split('-')
          const snapshotYear = parseInt(snapshotDateParts[0] ?? '0', 10)
          const snapshotMonth = parseInt(snapshotDateParts[1] ?? '0', 10)

          // The snapshot should NOT be in the collection month
          // Either the year is different, or the month is different
          const isInCollectionMonth =
            snapshotYear === scenario.collectionYear &&
            snapshotMonth === scenario.collectionMonth

          expect(isInCollectionMonth).toBe(false)

          // Additionally, the snapshot should be in the data month
          expect(snapshotYear).toBe(scenario.dataYear)
          expect(snapshotMonth).toBe(scenario.dataMonth)
        }),
        { numRuns: 100 }
      )
    })

    it('should preserve the data month in the result for closing periods', () => {
      // **Validates: Requirements 2.2**
      // Verifies that the dataMonth field in the result matches the input data month

      fc.assert(
        fc.property(closingPeriodScenarioArb, scenario => {
          const metadata = {
            date: scenario.collectionDate,
            isClosingPeriod: true,
            dataMonth: scenario.dataMonthFormatted,
          }

          const result = detector.detect(scenario.collectionDate, metadata)

          // The dataMonth in the result should match the input
          expect(result.dataMonth).toBe(scenario.dataMonthFormatted)
        }),
        { numRuns: 100 }
      )
    })

    it('should set collectionDate to the requested date for closing periods', () => {
      // **Validates: Requirements 2.2**
      // The collectionDate should be the actual "As of" date (the requested date)

      fc.assert(
        fc.property(closingPeriodScenarioArb, scenario => {
          const metadata = {
            date: scenario.collectionDate,
            isClosingPeriod: true,
            dataMonth: scenario.dataMonthFormatted,
          }

          const result = detector.detect(scenario.collectionDate, metadata)

          // The collectionDate should be the requested date
          expect(result.collectionDate).toBe(scenario.collectionDate)
        }),
        { numRuns: 100 }
      )
    })

    it('should handle all months correctly in closing period scenarios', () => {
      // **Validates: Requirements 2.2, 5.2**
      // Verifies that all 12 months produce correct last-day calculations

      fc.assert(
        fc.property(
          dataMonthArb,
          fc.integer({ min: 1, max: 28 }),
          (dataMonthInfo, collectionDay) => {
            // Create a collection date in the next month
            let collectionYear = dataMonthInfo.year
            let collectionMonth = dataMonthInfo.month + 1

            if (collectionMonth > 12) {
              collectionMonth = 1
              collectionYear = dataMonthInfo.year + 1
            }

            const collectionDate = `${collectionYear}-${collectionMonth.toString().padStart(2, '0')}-${collectionDay.toString().padStart(2, '0')}`

            const metadata = {
              date: collectionDate,
              isClosingPeriod: true,
              dataMonth: dataMonthInfo.formatted,
            }

            const result = detector.detect(collectionDate, metadata)

            // Verify the snapshot date ends with the correct last day
            const expectedLastDay = getExpectedLastDay(
              dataMonthInfo.year,
              dataMonthInfo.month
            )
            const snapshotDay = parseInt(
              result.snapshotDate.split('-')[2] ?? '0',
              10
            )

            expect(snapshotDay).toBe(expectedLastDay)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should be consistent: logicalDate always equals snapshotDate for closing periods', () => {
      // **Validates: Requirements 2.2**
      // Per the design doc, logicalDate is "Same as snapshotDate for closing periods"

      fc.assert(
        fc.property(closingPeriodScenarioArb, scenario => {
          const metadata = {
            date: scenario.collectionDate,
            isClosingPeriod: true,
            dataMonth: scenario.dataMonthFormatted,
          }

          const result = detector.detect(scenario.collectionDate, metadata)

          expect(result.logicalDate).toBe(result.snapshotDate)
        }),
        { numRuns: 100 }
      )
    })
  })
})
