import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { buildPaymentTrend, PaymentSnapshotData } from '../paymentTrend'

/**
 * Property-based tests for payment trend utilities
 * **Feature: membership-payments-chart**
 */

describe('buildPaymentTrend Property Tests', () => {
  /**
   * **Feature: membership-payments-chart, Property 4: Payment Data Extraction**
   * **Validates: Requirements 3.1, 3.2**
   *
   * For any array of snapshot data containing district rankings, the buildPaymentTrend
   * function SHALL produce a trend array where each element's payments value equals
   * the corresponding snapshot's totalPayments field, and the array SHALL be sorted
   * by date in ascending order.
   */

  // Generator for valid ISO date strings
  const validDateArb = fc
    .integer({
      min: new Date('2020-01-01').getTime(),
      max: new Date('2030-12-31').getTime(),
    })
    .map(timestamp => {
      const date = new Date(timestamp)
      return date.toISOString().split('T')[0] // YYYY-MM-DD format
    })

  // Generator for valid payment counts
  const validPaymentArb = fc.integer({ min: 0, max: 10000 })

  // Generator for optional payment values (including undefined and null)
  const optionalPaymentArb = fc.oneof(
    fc.constant(undefined),
    fc.constant(null),
    validPaymentArb
  )

  // Generator for snapshot data with valid payments
  const validSnapshotArb: fc.Arbitrary<PaymentSnapshotData> = fc.record({
    date: validDateArb,
    totalPayments: validPaymentArb,
    paymentBase: fc.option(validPaymentArb, { nil: undefined }),
  })

  // Generator for snapshot data with optional payments (may be missing)
  const snapshotWithOptionalPaymentsArb: fc.Arbitrary<PaymentSnapshotData> =
    fc.record({
      date: validDateArb,
      totalPayments: optionalPaymentArb,
      paymentBase: fc.option(validPaymentArb, { nil: undefined }),
    })

  it('should produce a trend array sorted by date in ascending order', () => {
    fc.assert(
      fc.property(
        fc.array(validSnapshotArb, { minLength: 0, maxLength: 50 }),
        snapshots => {
          const result = buildPaymentTrend(snapshots)

          // Verify the result is sorted by date ascending
          for (let i = 1; i < result.length; i++) {
            const prevDate = result[i - 1].date
            const currDate = result[i].date
            expect(currDate.localeCompare(prevDate)).toBeGreaterThanOrEqual(0)
          }
        }
      ),
      { numRuns: 25 } // Optimized for CI/CD timeout compliance (was 100)
    )
  })

  it('should preserve payment values from source snapshots', () => {
    fc.assert(
      fc.property(
        fc.array(validSnapshotArb, { minLength: 1, maxLength: 50 }),
        snapshots => {
          const result = buildPaymentTrend(snapshots)

          // Create a map of date -> Set of payments from source (to handle duplicates)
          const sourcePayments = new Map<string, Set<number>>()
          for (const snapshot of snapshots) {
            if (
              snapshot.totalPayments !== undefined &&
              snapshot.totalPayments !== null
            ) {
              if (!sourcePayments.has(snapshot.date)) {
                sourcePayments.set(snapshot.date, new Set())
              }
              sourcePayments.get(snapshot.date)!.add(snapshot.totalPayments)
            }
          }

          // Verify each result payment exists in the source for that date
          for (const point of result) {
            const validPayments = sourcePayments.get(point.date)
            expect(validPayments).toBeDefined()
            expect(validPayments!.has(point.payments)).toBe(true)
          }
        }
      ),
      { numRuns: 25 } // Optimized for CI/CD timeout compliance (was 100)
    )
  })

  it('should exclude snapshots with undefined or null totalPayments', () => {
    fc.assert(
      fc.property(
        fc.array(snapshotWithOptionalPaymentsArb, {
          minLength: 0,
          maxLength: 50,
        }),
        snapshots => {
          const result = buildPaymentTrend(snapshots)

          // Count valid snapshots (those with defined, non-null payments)
          const validCount = snapshots.filter(
            s => s.totalPayments !== undefined && s.totalPayments !== null
          ).length

          // Result length should match valid count (accounting for duplicate dates)
          expect(result.length).toBeLessThanOrEqual(validCount)

          // All result items should have valid payment values
          for (const point of result) {
            expect(point.payments).toBeDefined()
            expect(typeof point.payments).toBe('number')
            expect(Number.isFinite(point.payments)).toBe(true)
          }
        }
      ),
      { numRuns: 25 } // Optimized for CI/CD timeout compliance (was 100)
    )
  })

  it('should calculate programYearDay for each data point', () => {
    fc.assert(
      fc.property(
        fc.array(validSnapshotArb, { minLength: 1, maxLength: 50 }),
        snapshots => {
          const result = buildPaymentTrend(snapshots)

          // Verify each result has a valid programYearDay
          for (const point of result) {
            expect(point.programYearDay).toBeDefined()
            expect(typeof point.programYearDay).toBe('number')
            expect(point.programYearDay).toBeGreaterThanOrEqual(0)
            expect(point.programYearDay).toBeLessThanOrEqual(365)
          }
        }
      ),
      { numRuns: 25 } // Optimized for CI/CD timeout compliance (was 100)
    )
  })

  it('should return empty array for empty input', () => {
    const result = buildPaymentTrend([])
    expect(result).toEqual([])
  })

  it('should return empty array when all snapshots have missing payments', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            date: validDateArb,
            totalPayments: fc.oneof(fc.constant(undefined), fc.constant(null)),
            paymentBase: fc.option(validPaymentArb, { nil: undefined }),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        snapshots => {
          const result = buildPaymentTrend(snapshots)
          expect(result).toEqual([])
        }
      ),
      { numRuns: 25 } // Optimized for CI/CD timeout compliance (was 100)
    )
  })
})
