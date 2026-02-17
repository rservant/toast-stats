/**
 * Property-Based Tests for ClosingPeriodDetector
 *
 * @pbt-justification Warranted per .kiro/steering/testing.md criteria:
 *   - Complex input space: date-based detection across generated date ranges and boundaries
 *   - Mathematical invariant: closing period detection must be consistent across all valid dates
 *
 * Feature: refresh-service-refactor
 *
 * Property 1: Closing Period Detection Correctness
 * Property 5: Date Boundary Conditions
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 5.4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import fc from 'fast-check'
import {
  ClosingPeriodDetector,
  type Logger,
  type ClosingPeriodDetectorDependencies,
} from '../ClosingPeriodDetector.js'

describe('ClosingPeriodDetector - Property Tests', () => {
  let mockLogger: Logger
  let detector: ClosingPeriodDetector

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }

    const dependencies: ClosingPeriodDetectorDependencies = {
      logger: mockLogger,
    }

    detector = new ClosingPeriodDetector(dependencies)
  })

  /**
   * Property 1: Closing Period Detection Correctness
   *
   * *For any* valid CSV date and data month combination, the ClosingPeriodDetector
   * SHALL correctly identify whether it represents a closing period by comparing
   * the data month to the CSV date month, and when a closing period is detected,
   * the snapshot date SHALL be the last day of the data month.
   *
   * **Validates: Requirements 1.1, 1.2, 1.3**
   */
  describe('Property 1: Closing Period Detection Correctness', () => {
    it('correctly identifies closing periods and sets snapshot date to last day of data month', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a valid date between 2020 and 2030
          fc
            .date({
              min: new Date('2020-01-01'),
              max: new Date('2030-12-31'),
            })
            .filter(d => !isNaN(d.getTime())),
          // Whether to create a closing period scenario
          fc.boolean(),
          async (baseDate: Date, shouldBeClosingPeriod: boolean) => {
            // Generate test dates using UTC methods for consistency
            const csvDate = baseDate.toISOString().split('T')[0]!
            const csvYear = baseDate.getUTCFullYear()
            const csvMonth = baseDate.getUTCMonth() + 1

            let dataMonth: string
            let expectedIsClosingPeriod: boolean

            if (shouldBeClosingPeriod) {
              // Create a closing period scenario: data month < CSV month
              const dataMonthNum = csvMonth === 1 ? 12 : csvMonth - 1
              const dataYear = csvMonth === 1 ? csvYear - 1 : csvYear
              dataMonth = `${dataYear}-${dataMonthNum.toString().padStart(2, '0')}`
              expectedIsClosingPeriod = true
            } else {
              // Create a non-closing period scenario: data month = CSV month
              dataMonth = `${csvYear}-${csvMonth.toString().padStart(2, '0')}`
              expectedIsClosingPeriod = false
            }

            // Test the closing period detection
            const result = detector.detect(csvDate, dataMonth)

            // Verify the detection result
            expect(result.isClosingPeriod).toBe(expectedIsClosingPeriod)
            expect(result.asOfDate).toBe(csvDate)
            expect(result.collectionDate).toBe(csvDate)

            if (expectedIsClosingPeriod) {
              // For closing periods, snapshot date should be last day of data month
              const [dataYearStr, dataMonthStr] = dataMonth.split('-')
              const dataYearNum = parseInt(dataYearStr!, 10)
              const dataMonthNum = parseInt(dataMonthStr!, 10)
              // Calculate last day of month using UTC to avoid timezone issues
              const lastDay = new Date(
                Date.UTC(dataYearNum, dataMonthNum, 0)
              ).getUTCDate()
              const expectedSnapshotDate = `${dataYearNum}-${dataMonthStr}-${lastDay.toString().padStart(2, '0')}`

              expect(result.snapshotDate).toBe(expectedSnapshotDate)
              expect(result.snapshotDate).not.toBe(csvDate) // Should be different from CSV date
            } else {
              // For non-closing periods, snapshot date should equal CSV date
              expect(result.snapshotDate).toBe(csvDate)
            }

            // Verify data month is properly formatted
            expect(result.dataMonth).toMatch(/^\d{4}-\d{2}$/)
          }
        ),
        // Optimized for CI/CD timeout compliance (30s limit)
        { numRuns: 25 }
      )
    })

    it('correctly handles MM format data month with year inference', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2020, max: 2030 }), // Year
          fc.integer({ min: 1, max: 12 }), // CSV month
          fc.integer({ min: 1, max: 28 }), // Day (safe for all months)
          async (year: number, csvMonth: number, day: number) => {
            // Create CSV date
            const csvDate = `${year}-${csvMonth.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`

            // Create data month in MM format (previous month)
            const dataMonthNum = csvMonth === 1 ? 12 : csvMonth - 1
            const dataMonth = dataMonthNum.toString().padStart(2, '0')

            // Test the closing period detection
            const result = detector.detect(csvDate, dataMonth)

            // Verify this is detected as a closing period (previous month)
            expect(result.isClosingPeriod).toBe(true)
            expect(result.asOfDate).toBe(csvDate)
            expect(result.collectionDate).toBe(csvDate)

            // Verify the inferred year is correct
            const expectedDataYear = csvMonth === 1 ? year - 1 : year
            expect(result.dataMonth).toBe(
              `${expectedDataYear}-${dataMonthNum.toString().padStart(2, '0')}`
            )

            // Verify snapshot date is last day of the data month
            const lastDay = new Date(
              Date.UTC(expectedDataYear, dataMonthNum, 0)
            ).getUTCDate()
            const expectedSnapshotDate = `${expectedDataYear}-${dataMonthNum.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`
            expect(result.snapshotDate).toBe(expectedSnapshotDate)
          }
        ),
        // Optimized for CI/CD timeout compliance (30s limit)
        { numRuns: 25 }
      )
    })
  })

  /**
   * Property 5: Date Boundary Conditions
   *
   * *For any* month boundary scenario (including February in leap/non-leap years,
   * months with 30/31 days, and year boundaries), the ClosingPeriodDetector SHALL
   * correctly calculate the last day of the month and handle cross-year closing periods.
   *
   * **Validates: Requirements 1.1, 1.2, 5.4**
   */
  describe('Property 5: Date Boundary Conditions', () => {
    it('correctly calculates last day of month for all months', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2000, max: 2100 }), // Year range including century boundaries
          fc.integer({ min: 1, max: 12 }), // Month
          async (year: number, month: number) => {
            const lastDay = detector.getLastDayOfMonth(year, month)

            // Verify last day is within valid range
            expect(lastDay).toBeGreaterThanOrEqual(28)
            expect(lastDay).toBeLessThanOrEqual(31)

            // Verify specific month constraints
            if (month === 2) {
              // February: 28 or 29 days
              const isLeapYear =
                (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
              expect(lastDay).toBe(isLeapYear ? 29 : 28)
            } else if ([4, 6, 9, 11].includes(month)) {
              // April, June, September, November: 30 days
              expect(lastDay).toBe(30)
            } else {
              // January, March, May, July, August, October, December: 31 days
              expect(lastDay).toBe(31)
            }
          }
        ),
        // Optimized for CI/CD timeout compliance (30s limit)
        { numRuns: 25 }
      )
    })

    it('correctly handles February in leap years', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate leap years (divisible by 4, not by 100 unless by 400)
          fc
            .integer({ min: 2000, max: 2100 })
            .filter(
              year => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
            ),
          async (leapYear: number) => {
            // Create a closing period scenario for February
            const csvDate = `${leapYear}-03-05`
            const dataMonth = `${leapYear}-02`

            const result = detector.detect(csvDate, dataMonth)

            expect(result.isClosingPeriod).toBe(true)
            expect(result.snapshotDate).toBe(`${leapYear}-02-29`)
          }
        ),
        { numRuns: 25 }
      )
    })

    it('correctly handles February in non-leap years', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate non-leap years
          fc
            .integer({ min: 2001, max: 2099 })
            .filter(
              year =>
                !((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0)
            ),
          async (nonLeapYear: number) => {
            // Create a closing period scenario for February
            const csvDate = `${nonLeapYear}-03-05`
            const dataMonth = `${nonLeapYear}-02`

            const result = detector.detect(csvDate, dataMonth)

            expect(result.isClosingPeriod).toBe(true)
            expect(result.snapshotDate).toBe(`${nonLeapYear}-02-28`)
          }
        ),
        { numRuns: 25 }
      )
    })

    it('correctly handles 30-day months (Apr, Jun, Sep, Nov)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2020, max: 2030 }), // Year
          fc.constantFrom(4, 6, 9, 11), // 30-day months
          async (year: number, month: number) => {
            // Create a closing period scenario
            const nextMonth = month === 12 ? 1 : month + 1
            const nextYear = month === 12 ? year + 1 : year
            const csvDate = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-05`
            const dataMonth = `${year}-${month.toString().padStart(2, '0')}`

            const result = detector.detect(csvDate, dataMonth)

            expect(result.isClosingPeriod).toBe(true)
            expect(result.snapshotDate).toBe(
              `${year}-${month.toString().padStart(2, '0')}-30`
            )
          }
        ),
        { numRuns: 40 }
      )
    })

    it('correctly handles 31-day months (Jan, Mar, May, Jul, Aug, Oct, Dec)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2020, max: 2030 }), // Year
          fc.constantFrom(1, 3, 5, 7, 8, 10, 12), // 31-day months
          async (year: number, month: number) => {
            // Create a closing period scenario
            const nextMonth = month === 12 ? 1 : month + 1
            const nextYear = month === 12 ? year + 1 : year
            const csvDate = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-05`
            const dataMonth = `${year}-${month.toString().padStart(2, '0')}`

            const result = detector.detect(csvDate, dataMonth)

            expect(result.isClosingPeriod).toBe(true)
            expect(result.snapshotDate).toBe(
              `${year}-${month.toString().padStart(2, '0')}-31`
            )
          }
        ),
        { numRuns: 70 }
      )
    })

    it('correctly handles December-to-January year boundary', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2020, max: 2030 }), // Year for January CSV date
          fc.integer({ min: 1, max: 31 }), // Day in January
          async (year: number, day: number) => {
            // Create January CSV date and December data month (previous year)
            const csvDate = `${year}-01-${day.toString().padStart(2, '0')}`
            const dataMonth = `${year - 1}-12`

            const result = detector.detect(csvDate, dataMonth)

            // Verify this is detected as a closing period
            expect(result.isClosingPeriod).toBe(true)
            expect(result.asOfDate).toBe(csvDate)
            expect(result.collectionDate).toBe(csvDate)

            // Verify snapshot date is December 31 of the previous year
            expect(result.snapshotDate).toBe(`${year - 1}-12-31`)
            expect(result.dataMonth).toBe(`${year - 1}-12`)
          }
        ),
        { numRuns: 25 }
      )
    })
  })
})
