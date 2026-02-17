/**
 * Property-Based Tests for RefreshService Closing Period Detection
 *
 * @pbt-justification Warranted per .kiro/steering/testing.md criteria:
 *   - Universal business rule: closing period detection accuracy across all date scenarios
 *   - Complex input space: generated date/time combinations spanning period transitions
 *
 * Feature: closing-period-api-integration
 * Property 1: Closing Period Detection Accuracy
 *
 * Validates: Requirements 1.1, 1.2
 *
 * Note: These tests now use ClosingPeriodDetector directly since the
 * closing period detection logic has been extracted from RefreshService
 * as part of the refresh-service-refactor spec.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import fc from 'fast-check'
import { ClosingPeriodDetector } from '../ClosingPeriodDetector.js'

// Create a simple logger for testing
const testLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
}

describe('RefreshService - Closing Period Property Tests', () => {
  let closingPeriodDetector: ClosingPeriodDetector

  beforeEach(() => {
    // Create ClosingPeriodDetector instance for testing
    closingPeriodDetector = new ClosingPeriodDetector({ logger: testLogger })
  })

  /**
   * Property 1: Closing Period Detection Accuracy
   *
   * For any CSV with an "As of" date in month M+1 and data for month M,
   * the system should identify this as a closing period and set the snapshot
   * date to the last day of month M.
   *
   * Validates: Requirements 1.1, 1.2
   */
  it('Property 1: Closing Period Detection Accuracy', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc
          .date({
            min: new Date('2020-01-01'),
            max: new Date('2030-12-31'),
          })
          .filter(d => !isNaN(d.getTime())), // Filter out invalid dates
        fc.boolean(), // Whether to create a closing period scenario
        async (baseDate: Date, shouldBeClosingPeriod: boolean) => {
          // Generate test dates using UTC methods for consistency
          // IMPORTANT: Use UTC methods to match toISOString() which returns UTC date
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

          // Test the closing period detection using ClosingPeriodDetector
          const result = closingPeriodDetector.detect(csvDate, dataMonth)

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
            // Day 0 of month N+1 gives last day of month N
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
      { numRuns: 25 } // Optimized for CI/CD timeout compliance
    )
  })

  /**
   * Property 2: Cross-Year Closing Period Handling
   *
   * For any December data collected in January, the snapshot should be
   * dated December 31 of the prior year.
   *
   * Validates: Requirements 1.4, 2.5
   */
  it('Property 2: Cross-Year Closing Period Handling', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2020, max: 2030 }), // Year for January CSV date
        fc.integer({ min: 1, max: 31 }), // Day in January
        async (year: number, day: number) => {
          // Ensure valid day for January
          const validDay = Math.min(day, 31)

          // Create January CSV date and December data month (previous year)
          const csvDate = `${year}-01-${validDay.toString().padStart(2, '0')}`
          const dataMonth = `${year - 1}-12` // December of previous year

          // Test the closing period detection using ClosingPeriodDetector
          const result = closingPeriodDetector.detect(csvDate, dataMonth)

          // Verify this is detected as a closing period
          expect(result.isClosingPeriod).toBe(true)
          expect(result.asOfDate).toBe(csvDate)
          expect(result.collectionDate).toBe(csvDate)

          // Verify snapshot date is December 31 of the previous year
          const expectedSnapshotDate = `${year - 1}-12-31`
          expect(result.snapshotDate).toBe(expectedSnapshotDate)

          // Verify data month is properly formatted
          expect(result.dataMonth).toBe(`${year - 1}-12`)
        }
      ),
      { numRuns: 25 }
    )
  })

  /**
   * Property 3: Month-Only Format Handling
   *
   * For any data month provided in "MM" format (without year),
   * the system should correctly infer the year and detect closing periods.
   *
   * Validates: Requirements 1.1, 1.4
   */
  it('Property 3: Month-Only Format Handling', async () => {
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

          // Test the closing period detection using ClosingPeriodDetector
          const result = closingPeriodDetector.detect(csvDate, dataMonth)

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
          // Use UTC to avoid timezone issues
          const lastDay = new Date(
            Date.UTC(expectedDataYear, dataMonthNum, 0)
          ).getUTCDate()
          const expectedSnapshotDate = `${expectedDataYear}-${dataMonthNum.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`
          expect(result.snapshotDate).toBe(expectedSnapshotDate)
        }
      ),
      { numRuns: 25 }
    )
  })
})
