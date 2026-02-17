/**
 * Property-Based Tests for RefreshService No New-Month Snapshots
 *
 * @pbt-justification Warranted per .kiro/steering/testing.md criteria:
 *   - Universal business rule: no misleading new-month snapshots during closing periods
 *   - Complex input space: generated month-boundary scenarios with varied data states
 *
 * Feature: closing-period-api-integration
 * Property 4: No Misleading New-Month Snapshots
 *
 * Validates: Requirements 3.1
 *
 * This test verifies that when closing period data is detected, the system
 * does NOT create a snapshot dated in the new month (the month of the "As of" date).
 * Instead, the snapshot should be dated as the last day of the data month.
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

describe('RefreshService - No New-Month Snapshots Property Tests', () => {
  let closingPeriodDetector: ClosingPeriodDetector

  beforeEach(() => {
    // Create ClosingPeriodDetector instance for testing
    closingPeriodDetector = new ClosingPeriodDetector({ logger: testLogger })
  })

  /**
   * Helper to calculate the last day of a month
   */
  function getLastDayOfMonth(year: number, month: number): string {
    // month is 1-indexed (1 = January, 12 = December)
    // Use UTC to avoid timezone issues
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
    return `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`
  }

  /**
   * Property 4: No Misleading New-Month Snapshots
   *
   * For any closing period data, no snapshot should be created with a date
   * in the new month (the month of the "As of" date).
   *
   * This property verifies that:
   * 1. When detectClosingPeriod identifies a closing period, the snapshotDate
   *    is NEVER in the same month as the csvDate (As of date)
   * 2. The snapshotDate is always the last day of the data month
   *
   * Validates: Requirements 3.1
   */
  it('Property 4: No Misleading New-Month Snapshots', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a year between 2020 and 2030
        fc.integer({ min: 2020, max: 2030 }),
        // Generate a month for the CSV date (2-12, so we can have a previous month)
        fc.integer({ min: 2, max: 12 }),
        // Generate a day for the CSV date (1-28 to be safe)
        fc.integer({ min: 1, max: 28 }),
        async (year: number, csvMonth: number, csvDay: number) => {
          // Create CSV date (As of date) - this is in the "new month"
          const csvDate = `${year}-${csvMonth.toString().padStart(2, '0')}-${csvDay.toString().padStart(2, '0')}`

          // Create data month (previous month) - this is the "closing month"
          const dataMonthNum = csvMonth - 1
          const dataMonth = `${year}-${dataMonthNum.toString().padStart(2, '0')}`

          // Test the closing period detection using ClosingPeriodDetector
          const result = closingPeriodDetector.detect(csvDate, dataMonth)

          // PROPERTY ASSERTION: This MUST be detected as a closing period
          expect(result.isClosingPeriod).toBe(true)

          // PROPERTY ASSERTION: The snapshot date MUST NOT be in the new month (csvMonth)
          // Parse the snapshot date to check its month
          const snapshotDateParts = result.snapshotDate.split('-')
          const snapshotYear = parseInt(snapshotDateParts[0]!, 10)
          const snapshotMonth = parseInt(snapshotDateParts[1]!, 10)

          // The snapshot month should be the data month, NOT the CSV month
          expect(snapshotMonth).toBe(dataMonthNum)
          expect(snapshotMonth).not.toBe(csvMonth)

          // PROPERTY ASSERTION: The snapshot date should be the last day of the data month
          const expectedSnapshotDate = getLastDayOfMonth(year, dataMonthNum)
          expect(result.snapshotDate).toBe(expectedSnapshotDate)

          // PROPERTY ASSERTION: The snapshot year should match the data year
          expect(snapshotYear).toBe(year)

          // Verify the collection date is preserved as the original CSV date
          expect(result.collectionDate).toBe(csvDate)
          expect(result.asOfDate).toBe(csvDate)

          return true
        }
      ),
      { numRuns: 25 } // Optimized for CI/CD timeout compliance
    )
  })

  /**
   * Property 4b: Cross-Year No New-Month Snapshots
   *
   * For December data collected in January, the snapshot should be dated
   * December 31 of the prior year, NOT any date in January.
   *
   * Validates: Requirements 3.1, 2.5
   */
  it('Property 4b: Cross-Year No New-Month Snapshots', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a year for January (2021-2030 so we have a prior year)
        fc.integer({ min: 2021, max: 2030 }),
        // Generate a day in January (1-31)
        fc.integer({ min: 1, max: 31 }),
        async (januaryYear: number, januaryDay: number) => {
          // Create January CSV date (As of date) - this is in the "new month"
          const csvDate = `${januaryYear}-01-${januaryDay.toString().padStart(2, '0')}`

          // Data month is December of the previous year
          const dataMonth = `${januaryYear - 1}-12`

          // Test the closing period detection using ClosingPeriodDetector
          const result = closingPeriodDetector.detect(csvDate, dataMonth)

          // PROPERTY ASSERTION: This MUST be detected as a closing period
          expect(result.isClosingPeriod).toBe(true)

          // PROPERTY ASSERTION: The snapshot date MUST NOT be in January
          const snapshotDateParts = result.snapshotDate.split('-')
          const snapshotYear = parseInt(snapshotDateParts[0]!, 10)
          const snapshotMonth = parseInt(snapshotDateParts[1]!, 10)

          // The snapshot should be in December of the previous year, NOT January
          expect(snapshotMonth).toBe(12)
          expect(snapshotMonth).not.toBe(1)
          expect(snapshotYear).toBe(januaryYear - 1)

          // PROPERTY ASSERTION: The snapshot date should be December 31 of the prior year
          const expectedSnapshotDate = `${januaryYear - 1}-12-31`
          expect(result.snapshotDate).toBe(expectedSnapshotDate)

          // Verify the collection date is preserved as the original CSV date
          expect(result.collectionDate).toBe(csvDate)
          expect(result.asOfDate).toBe(csvDate)

          return true
        }
      ),
      { numRuns: 25 }
    )
  })

  /**
   * Property 4c: Non-Closing Period Allows Same-Month Snapshots
   *
   * For non-closing period data (data month equals CSV month), the snapshot
   * date should be the same as the CSV date (in the same month).
   *
   * This is the inverse property - verifying that we DON'T incorrectly
   * prevent same-month snapshots for non-closing period data.
   *
   * Validates: Requirements 3.4 (implicit - normal operation)
   */
  it('Property 4c: Non-Closing Period Allows Same-Month Snapshots', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a year between 2020 and 2030
        fc.integer({ min: 2020, max: 2030 }),
        // Generate a month (1-12)
        fc.integer({ min: 1, max: 12 }),
        // Generate a day (1-28 to be safe)
        fc.integer({ min: 1, max: 28 }),
        async (year: number, month: number, day: number) => {
          // Create CSV date
          const csvDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`

          // Data month is the SAME as CSV month (non-closing period)
          const dataMonth = `${year}-${month.toString().padStart(2, '0')}`

          // Test the closing period detection using ClosingPeriodDetector
          const result = closingPeriodDetector.detect(csvDate, dataMonth)

          // PROPERTY ASSERTION: This should NOT be detected as a closing period
          expect(result.isClosingPeriod).toBe(false)

          // PROPERTY ASSERTION: The snapshot date should be the same as the CSV date
          expect(result.snapshotDate).toBe(csvDate)

          // Parse the snapshot date to verify it's in the same month
          const snapshotDateParts = result.snapshotDate.split('-')
          const snapshotMonth = parseInt(snapshotDateParts[1]!, 10)

          // The snapshot month should be the same as the CSV month
          expect(snapshotMonth).toBe(month)

          return true
        }
      ),
      { numRuns: 25 } // Optimized for CI/CD timeout compliance
    )
  })
})
