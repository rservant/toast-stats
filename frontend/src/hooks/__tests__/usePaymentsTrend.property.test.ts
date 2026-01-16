/**
 * Property-based tests for usePaymentsTrend hook
 * **Feature: membership-payments-chart**
 *
 * Tests the pure utility functions exported from usePaymentsTrend
 * that handle year count limiting and statistics calculation.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  limitYearCount,
  calculateYearOverYearChange,
  groupByProgramYear,
  buildMultiYearData,
  findComparablePayment,
} from '../usePaymentsTrend'
import { PaymentTrendDataPoint } from '../../utils/paymentTrend'
import { ProgramYear, getProgramYear } from '../../utils/programYear'

// Generators for test data

/**
 * Generator for valid program year starting years (2015-2030)
 */
const programYearStartArb = fc.integer({ min: 2015, max: 2030 })

/**
 * Generator for valid payment counts
 */
const validPaymentArb = fc.integer({ min: 0, max: 100000 })

/**
 * Generator for valid program year day (0-365)
 */
const programYearDayArb = fc.integer({ min: 0, max: 365 })

/**
 * Generator for a payment trend data point
 */
const paymentTrendPointArb: fc.Arbitrary<PaymentTrendDataPoint> = fc.record({
  date: fc
    .integer({
      min: new Date('2015-07-01').getTime(),
      max: new Date('2030-06-30').getTime(),
    })
    .map(timestamp => new Date(timestamp).toISOString().split('T')[0]),
  payments: validPaymentArb,
  programYearDay: programYearDayArb,
})

/**
 * Generator for grouped data map entry
 */
const groupedDataEntryArb = (year: number) =>
  fc.record({
    programYear: fc.constant(getProgramYear(year)),
    data: fc.array(paymentTrendPointArb, { minLength: 1, maxLength: 20 }),
  })

/**
 * Generator for a map of grouped payment data with specific year count
 */
const groupedDataMapArb = (yearCount: number) => {
  const baseYear = 2024
  const years = Array.from({ length: yearCount }, (_, i) => baseYear - i)

  return fc
    .tuple(...years.map(year => groupedDataEntryArb(year)))
    .map(entries => {
      const map = new Map<
        string,
        { programYear: ProgramYear; data: PaymentTrendDataPoint[] }
      >()
      entries.forEach((entry, i) => {
        const year = years[i]
        if (year !== undefined) {
          const label = `${year}-${year + 1}`
          map.set(label, entry)
        }
      })
      return map
    })
}

describe('usePaymentsTrend Property Tests', () => {
  /**
   * **Feature: membership-payments-chart, Property 2: Year Count Limiting**
   * **Validates: Requirements 2.1, 2.4**
   *
   * For any multi-year payment data set, the chart SHALL display at most 3 program years,
   * and SHALL display exactly the number of available years when fewer than 3 are present.
   */
  describe('Property 2: Year Count Limiting', () => {
    it('should limit to at most 3 years when more are available', () => {
      fc.assert(
        fc.property(fc.integer({ min: 4, max: 10 }), yearCount => {
          // Create a map with more than 3 years
          const baseYear = 2024
          const map = new Map<
            string,
            { programYear: ProgramYear; data: PaymentTrendDataPoint[] }
          >()

          for (let i = 0; i < yearCount; i++) {
            const year = baseYear - i
            const label = `${year}-${year + 1}`
            map.set(label, {
              programYear: getProgramYear(year),
              data: [
                { date: `${year}-08-01`, payments: 100, programYearDay: 31 },
              ],
            })
          }

          const result = limitYearCount(map, 3)

          // Should have exactly 3 years
          expect(result.size).toBe(3)
        }),
        { numRuns: 100 }
      )
    })

    it('should return all years when fewer than 3 are available', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 3 }), yearCount => {
          // Create a map with 1-3 years
          const baseYear = 2024
          const map = new Map<
            string,
            { programYear: ProgramYear; data: PaymentTrendDataPoint[] }
          >()

          for (let i = 0; i < yearCount; i++) {
            const year = baseYear - i
            const label = `${year}-${year + 1}`
            map.set(label, {
              programYear: getProgramYear(year),
              data: [
                { date: `${year}-08-01`, payments: 100, programYearDay: 31 },
              ],
            })
          }

          const result = limitYearCount(map, 3)

          // Should have exactly the number of available years
          expect(result.size).toBe(yearCount)
        }),
        { numRuns: 100 }
      )
    })

    it('should return exactly min(available, maxYears) years', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }),
          fc.integer({ min: 1, max: 5 }),
          (availableYears, maxYears) => {
            const baseYear = 2024
            const map = new Map<
              string,
              { programYear: ProgramYear; data: PaymentTrendDataPoint[] }
            >()

            for (let i = 0; i < availableYears; i++) {
              const year = baseYear - i
              const label = `${year}-${year + 1}`
              map.set(label, {
                programYear: getProgramYear(year),
                data: [
                  { date: `${year}-08-01`, payments: 100, programYearDay: 31 },
                ],
              })
            }

            const result = limitYearCount(map, maxYears)

            // Should have exactly min(available, maxYears) years
            expect(result.size).toBe(Math.min(availableYears, maxYears))
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should keep the most recent years when limiting', () => {
      fc.assert(
        fc.property(fc.integer({ min: 4, max: 10 }), yearCount => {
          const baseYear = 2024
          const map = new Map<
            string,
            { programYear: ProgramYear; data: PaymentTrendDataPoint[] }
          >()

          for (let i = 0; i < yearCount; i++) {
            const year = baseYear - i
            const label = `${year}-${year + 1}`
            map.set(label, {
              programYear: getProgramYear(year),
              data: [
                { date: `${year}-08-01`, payments: 100, programYearDay: 31 },
              ],
            })
          }

          const result = limitYearCount(map, 3)

          // Should contain the 3 most recent years
          const resultYears = Array.from(result.values()).map(
            v => v.programYear.year
          )
          const expectedYears = [baseYear, baseYear - 1, baseYear - 2]

          expect(resultYears.sort((a, b) => b - a)).toEqual(expectedYears)
        }),
        { numRuns: 100 }
      )
    })

    it('should handle empty input', () => {
      const emptyMap = new Map<
        string,
        { programYear: ProgramYear; data: PaymentTrendDataPoint[] }
      >()

      const result = limitYearCount(emptyMap, 3)

      expect(result.size).toBe(0)
    })

    it('should preserve data integrity when limiting', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }),
          fc.array(validPaymentArb, { minLength: 1, maxLength: 20 }),
          (yearCount, payments) => {
            const baseYear = 2024
            const map = new Map<
              string,
              { programYear: ProgramYear; data: PaymentTrendDataPoint[] }
            >()

            for (let i = 0; i < yearCount; i++) {
              const year = baseYear - i
              const label = `${year}-${year + 1}`
              const data = payments.map((p, idx) => ({
                date: `${year}-${String(8 + (idx % 4)).padStart(2, '0')}-01`,
                payments: p,
                programYearDay: 31 + idx * 30,
              }))
              map.set(label, {
                programYear: getProgramYear(year),
                data,
              })
            }

            const result = limitYearCount(map, 3)

            // Verify data integrity - each entry in result should match original
            for (const [label, entry] of result) {
              const original = map.get(label)
              expect(original).toBeDefined()
              expect(entry.data).toEqual(original!.data)
              expect(entry.programYear).toEqual(original!.programYear)
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * **Feature: membership-payments-chart, Property 5: Statistics Calculation**
   * **Validates: Requirements 6.1, 6.2, 6.4**
   *
   * For any payment trend with current and previous year data, the year-over-year
   * change SHALL equal (currentPayments - previousPayments), and the trend direction
   * SHALL be "up" when change > 0, "down" when change < 0, and "stable" when change = 0.
   */
  describe('Property 5: Statistics Calculation', () => {
    it('should calculate correct year-over-year change', () => {
      fc.assert(
        fc.property(
          validPaymentArb,
          validPaymentArb,
          (currentPayments, previousPayments) => {
            const result = calculateYearOverYearChange(
              currentPayments,
              previousPayments
            )

            // Change should equal current - previous
            expect(result.change).toBe(currentPayments - previousPayments)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should return "up" direction when change is positive', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100000 }),
          fc.integer({ min: 0, max: 99999 }),
          (currentPayments, previousPayments) => {
            // Ensure current > previous
            const adjustedCurrent = previousPayments + currentPayments

            const result = calculateYearOverYearChange(
              adjustedCurrent,
              previousPayments
            )

            expect(result.direction).toBe('up')
            expect(result.change).toBeGreaterThan(0)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should return "down" direction when change is negative', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 99999 }),
          fc.integer({ min: 1, max: 100000 }),
          (currentPayments, additionalPrevious) => {
            // Ensure previous > current
            const previousPayments = currentPayments + additionalPrevious

            const result = calculateYearOverYearChange(
              currentPayments,
              previousPayments
            )

            expect(result.direction).toBe('down')
            expect(result.change).toBeLessThan(0)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should return "stable" direction when change is zero', () => {
      fc.assert(
        fc.property(validPaymentArb, payments => {
          const result = calculateYearOverYearChange(payments, payments)

          expect(result.direction).toBe('stable')
          expect(result.change).toBe(0)
        }),
        { numRuns: 100 }
      )
    })

    it('should return null change and direction when previous is null', () => {
      fc.assert(
        fc.property(validPaymentArb, currentPayments => {
          const result = calculateYearOverYearChange(currentPayments, null)

          expect(result.change).toBeNull()
          expect(result.direction).toBeNull()
        }),
        { numRuns: 100 }
      )
    })

    it('should have consistent direction with change sign', () => {
      fc.assert(
        fc.property(
          validPaymentArb,
          fc.option(validPaymentArb, { nil: null }),
          (currentPayments, previousPayments) => {
            const result = calculateYearOverYearChange(
              currentPayments,
              previousPayments
            )

            if (previousPayments === null) {
              expect(result.change).toBeNull()
              expect(result.direction).toBeNull()
            } else {
              const change = result.change!
              if (change > 0) {
                expect(result.direction).toBe('up')
              } else if (change < 0) {
                expect(result.direction).toBe('down')
              } else {
                expect(result.direction).toBe('stable')
              }
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Additional property tests for helper functions
   */
  describe('findComparablePayment', () => {
    it('should return null for empty data', () => {
      const result = findComparablePayment([], 100)
      expect(result).toBeNull()
    })

    it('should find closest payment within 7 days', () => {
      fc.assert(
        fc.property(
          fc.array(paymentTrendPointArb, { minLength: 1, maxLength: 50 }),
          programYearDayArb,
          (data, targetDay) => {
            const result = findComparablePayment(data, targetDay)

            if (result !== null) {
              // Find the closest point
              const closestPoint = data.reduce((closest, point) => {
                const closestDiff = Math.abs(closest.programYearDay - targetDay)
                const pointDiff = Math.abs(point.programYearDay - targetDay)
                return pointDiff < closestDiff ? point : closest
              })

              // The closest point should be within 7 days
              expect(
                Math.abs(closestPoint.programYearDay - targetDay)
              ).toBeLessThanOrEqual(7)
              expect(result).toBe(closestPoint.payments)
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should return null when no data point is within 7 days', () => {
      // Create data points all far from target
      const data: PaymentTrendDataPoint[] = [
        { date: '2024-07-01', payments: 100, programYearDay: 0 },
        { date: '2024-07-10', payments: 200, programYearDay: 9 },
      ]

      // Target day 100 is far from both points (0 and 9)
      const result = findComparablePayment(data, 100)
      expect(result).toBeNull()
    })
  })

  describe('groupByProgramYear', () => {
    it('should group data points by their program year', () => {
      fc.assert(
        fc.property(
          fc.array(paymentTrendPointArb, { minLength: 1, maxLength: 50 }),
          data => {
            const result = groupByProgramYear(data)

            // All data points should be accounted for
            let totalPoints = 0
            for (const [, entry] of result) {
              totalPoints += entry.data.length
            }
            expect(totalPoints).toBe(data.length)

            // Each entry should have a valid program year
            for (const [label, entry] of result) {
              expect(label).toBe(entry.programYear.label)
              expect(entry.data.length).toBeGreaterThan(0)
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('buildMultiYearData', () => {
    it('should return null for empty grouped data', () => {
      const emptyMap = new Map<
        string,
        { programYear: ProgramYear; data: PaymentTrendDataPoint[] }
      >()
      const currentYear = getProgramYear(2024)

      const result = buildMultiYearData(emptyMap, currentYear)
      expect(result).toBeNull()
    })

    it('should separate current year from previous years', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 5 }), yearCount => {
          const baseYear = 2024
          const currentYear = getProgramYear(baseYear)
          const map = new Map<
            string,
            { programYear: ProgramYear; data: PaymentTrendDataPoint[] }
          >()

          for (let i = 0; i < yearCount; i++) {
            const year = baseYear - i
            const label = `${year}-${year + 1}`
            map.set(label, {
              programYear: getProgramYear(year),
              data: [
                { date: `${year}-08-01`, payments: 100, programYearDay: 31 },
              ],
            })
          }

          const result = buildMultiYearData(map, currentYear)

          expect(result).not.toBeNull()
          expect(result!.currentYear.label).toBe(currentYear.label)
          expect(result!.previousYears.length).toBe(yearCount - 1)

          // Previous years should not include current year
          for (const prevYear of result!.previousYears) {
            expect(prevYear.label).not.toBe(currentYear.label)
          }
        }),
        { numRuns: 100 }
      )
    })
  })
})
