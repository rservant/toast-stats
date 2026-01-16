/**
 * Property-Based Tests for TargetCalculatorService
 *
 * These tests validate the correctness of target calculation formulas
 * using property-based testing with fast-check.
 *
 * **Feature: district-performance-targets**
 */

import { describe, it, expect, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { TargetCalculatorService } from '../TargetCalculatorService.js'
import type { RecognitionLevel } from '../../types/analytics.js'

describe('TargetCalculatorService - Property Tests', () => {
  let calculator: TargetCalculatorService

  beforeEach(() => {
    calculator = new TargetCalculatorService()
  })

  /**
   * Property 1: Target Calculation Formula Correctness
   *
   * For any valid base value and recognition level, the calculated target
   * SHALL equal the ceiling of (base × multiplier), where multiplier is
   * defined by the recognition level and metric type.
   *
   * **Validates: Requirements 1.2, 1.3, 1.4, 1.5, 2.2, 2.3, 2.4, 2.5, 3.2, 3.3, 3.4, 3.5**
   */
  describe('Property 1: Target Calculation Formula Correctness', () => {
    // Growth multipliers for paid clubs and payments
    const GROWTH_MULTIPLIERS = {
      distinguished: 1.01,
      select: 1.03,
      presidents: 1.05,
      smedley: 1.08,
    } as const

    // Percentages for distinguished clubs
    const DISTINGUISHED_PERCENTAGES = {
      distinguished: 0.45,
      select: 0.5,
      presidents: 0.55,
      smedley: 0.6,
    } as const

    const recognitionLevels: RecognitionLevel[] = [
      'distinguished',
      'select',
      'presidents',
      'smedley',
    ]

    // Arbitrary for positive base values (realistic range for districts)
    const positiveBaseArb = fc.integer({ min: 1, max: 10000 })
    const currentValueArb = fc.integer({ min: 0, max: 15000 })

    it('paid clubs targets match formula: ceil(base × multiplier)', () => {
      fc.assert(
        fc.property(positiveBaseArb, currentValueArb, (base, current) => {
          const result = calculator.calculatePaidClubsTargets(base, current)

          expect(result.base).toBe(base)
          expect(result.current).toBe(current)
          expect(result.targets).not.toBeNull()

          // Verify each recognition level target matches the formula
          for (const level of recognitionLevels) {
            const expectedTarget = Math.ceil(base * GROWTH_MULTIPLIERS[level])
            expect(result.targets![level]).toBe(expectedTarget)
          }
        }),
        { numRuns: 100 }
      )
    })

    it('membership payments targets match formula: ceil(base × multiplier)', () => {
      fc.assert(
        fc.property(positiveBaseArb, currentValueArb, (base, current) => {
          const result = calculator.calculatePaymentsTargets(base, current)

          expect(result.base).toBe(base)
          expect(result.current).toBe(current)
          expect(result.targets).not.toBeNull()

          // Verify each recognition level target matches the formula
          for (const level of recognitionLevels) {
            const expectedTarget = Math.ceil(base * GROWTH_MULTIPLIERS[level])
            expect(result.targets![level]).toBe(expectedTarget)
          }
        }),
        { numRuns: 100 }
      )
    })

    it('distinguished clubs targets match formula: ceil(base × percentage)', () => {
      fc.assert(
        fc.property(positiveBaseArb, currentValueArb, (base, current) => {
          const result = calculator.calculateDistinguishedTargets(base, current)

          expect(result.base).toBe(base)
          expect(result.current).toBe(current)
          expect(result.targets).not.toBeNull()

          // Verify each recognition level target matches the formula
          for (const level of recognitionLevels) {
            const expectedTarget = Math.ceil(
              base * DISTINGUISHED_PERCENTAGES[level]
            )
            expect(result.targets![level]).toBe(expectedTarget)
          }
        }),
        { numRuns: 100 }
      )
    })

    it('targets are monotonically increasing across recognition levels', () => {
      fc.assert(
        fc.property(positiveBaseArb, currentValueArb, (base, current) => {
          const paidClubsResult = calculator.calculatePaidClubsTargets(
            base,
            current
          )
          const paymentsResult = calculator.calculatePaymentsTargets(
            base,
            current
          )
          const distinguishedResult = calculator.calculateDistinguishedTargets(
            base,
            current
          )

          // For all metric types, targets should increase: distinguished < select < presidents < smedley
          for (const result of [
            paidClubsResult,
            paymentsResult,
            distinguishedResult,
          ]) {
            const targets = result.targets!
            expect(targets.distinguished).toBeLessThanOrEqual(targets.select)
            expect(targets.select).toBeLessThanOrEqual(targets.presidents)
            expect(targets.presidents).toBeLessThanOrEqual(targets.smedley)
          }
        }),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 2: Ceiling Rounding Invariant
   *
   * For any target calculation that produces a fractional result, the output
   * SHALL be the smallest integer greater than or equal to the calculated value
   * (ceiling function).
   *
   * **Validates: Requirements 1.6, 2.6, 3.6**
   */
  describe('Property 2: Ceiling Rounding Invariant', () => {
    // Use base values that will produce fractional intermediate results
    const baseArb = fc.integer({ min: 1, max: 10000 })
    const currentArb = fc.integer({ min: 0, max: 15000 })

    it('all targets are integers (ceiling applied)', () => {
      fc.assert(
        fc.property(baseArb, currentArb, (base, current) => {
          const paidClubsResult = calculator.calculatePaidClubsTargets(
            base,
            current
          )
          const paymentsResult = calculator.calculatePaymentsTargets(
            base,
            current
          )
          const distinguishedResult = calculator.calculateDistinguishedTargets(
            base,
            current
          )

          for (const result of [
            paidClubsResult,
            paymentsResult,
            distinguishedResult,
          ]) {
            if (result.targets) {
              expect(Number.isInteger(result.targets.distinguished)).toBe(true)
              expect(Number.isInteger(result.targets.select)).toBe(true)
              expect(Number.isInteger(result.targets.presidents)).toBe(true)
              expect(Number.isInteger(result.targets.smedley)).toBe(true)
            }
          }
        }),
        { numRuns: 100 }
      )
    })

    it('targets are always >= raw calculation (ceiling, not floor)', () => {
      const GROWTH_MULTIPLIERS = {
        distinguished: 1.01,
        select: 1.03,
        presidents: 1.05,
        smedley: 1.08,
      }

      const DISTINGUISHED_PERCENTAGES = {
        distinguished: 0.45,
        select: 0.5,
        presidents: 0.55,
        smedley: 0.6,
      }

      fc.assert(
        fc.property(baseArb, currentArb, (base, current) => {
          const paidClubsResult = calculator.calculatePaidClubsTargets(
            base,
            current
          )
          const paymentsResult = calculator.calculatePaymentsTargets(
            base,
            current
          )
          const distinguishedResult = calculator.calculateDistinguishedTargets(
            base,
            current
          )

          // Paid clubs: target >= base * multiplier
          for (const [level, multiplier] of Object.entries(
            GROWTH_MULTIPLIERS
          )) {
            const rawValue = base * multiplier
            expect(
              paidClubsResult.targets![level as keyof typeof GROWTH_MULTIPLIERS]
            ).toBeGreaterThanOrEqual(rawValue)
          }

          // Payments: target >= base * multiplier
          for (const [level, multiplier] of Object.entries(
            GROWTH_MULTIPLIERS
          )) {
            const rawValue = base * multiplier
            expect(
              paymentsResult.targets![level as keyof typeof GROWTH_MULTIPLIERS]
            ).toBeGreaterThanOrEqual(rawValue)
          }

          // Distinguished: target >= base * percentage
          for (const [level, percentage] of Object.entries(
            DISTINGUISHED_PERCENTAGES
          )) {
            const rawValue = base * percentage
            expect(
              distinguishedResult.targets![
                level as keyof typeof DISTINGUISHED_PERCENTAGES
              ]
            ).toBeGreaterThanOrEqual(rawValue)
          }
        }),
        { numRuns: 100 }
      )
    })

    it('targets are at most 1 greater than raw calculation (proper ceiling)', () => {
      const GROWTH_MULTIPLIERS = {
        distinguished: 1.01,
        select: 1.03,
        presidents: 1.05,
        smedley: 1.08,
      }

      const DISTINGUISHED_PERCENTAGES = {
        distinguished: 0.45,
        select: 0.5,
        presidents: 0.55,
        smedley: 0.6,
      }

      fc.assert(
        fc.property(baseArb, currentArb, (base, current) => {
          const paidClubsResult = calculator.calculatePaidClubsTargets(
            base,
            current
          )
          const paymentsResult = calculator.calculatePaymentsTargets(
            base,
            current
          )
          const distinguishedResult = calculator.calculateDistinguishedTargets(
            base,
            current
          )

          // Paid clubs: target < base * multiplier + 1
          for (const [level, multiplier] of Object.entries(
            GROWTH_MULTIPLIERS
          )) {
            const rawValue = base * multiplier
            expect(
              paidClubsResult.targets![level as keyof typeof GROWTH_MULTIPLIERS]
            ).toBeLessThan(rawValue + 1)
          }

          // Payments: target < base * multiplier + 1
          for (const [level, multiplier] of Object.entries(
            GROWTH_MULTIPLIERS
          )) {
            const rawValue = base * multiplier
            expect(
              paymentsResult.targets![level as keyof typeof GROWTH_MULTIPLIERS]
            ).toBeLessThan(rawValue + 1)
          }

          // Distinguished: target < base * percentage + 1
          for (const [level, percentage] of Object.entries(
            DISTINGUISHED_PERCENTAGES
          )) {
            const rawValue = base * percentage
            expect(
              distinguishedResult.targets![
                level as keyof typeof DISTINGUISHED_PERCENTAGES
              ]
            ).toBeLessThan(rawValue + 1)
          }
        }),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Additional Property: Achieved Level Correctness
   *
   * For any current value and targets, the achieved level should be the
   * highest level where current >= target.
   */
  describe('Property: Achieved Level Correctness', () => {
    const baseArb = fc.integer({ min: 1, max: 1000 })
    const currentArb = fc.integer({ min: 0, max: 2000 })

    it('achieved level is highest level where current >= target', () => {
      fc.assert(
        fc.property(baseArb, currentArb, (base, current) => {
          const result = calculator.calculatePaidClubsTargets(base, current)
          const targets = result.targets!
          const achieved = result.achievedLevel

          if (current >= targets.smedley) {
            expect(achieved).toBe('smedley')
          } else if (current >= targets.presidents) {
            expect(achieved).toBe('presidents')
          } else if (current >= targets.select) {
            expect(achieved).toBe('select')
          } else if (current >= targets.distinguished) {
            expect(achieved).toBe('distinguished')
          } else {
            expect(achieved).toBeNull()
          }
        }),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Additional Property: Invalid Base Handling
   *
   * For invalid base values (zero, negative, NaN), targets should be null.
   */
  describe('Property: Invalid Base Handling', () => {
    const invalidBaseArb = fc.oneof(
      fc.constant(0),
      fc.integer({ min: -10000, max: -1 }),
      fc.constant(NaN)
    )
    const currentArb = fc.integer({ min: 0, max: 1000 })

    it('returns null targets for invalid base values', () => {
      fc.assert(
        fc.property(invalidBaseArb, currentArb, (base, current) => {
          const paidClubsResult = calculator.calculatePaidClubsTargets(
            base,
            current
          )
          const paymentsResult = calculator.calculatePaymentsTargets(
            base,
            current
          )
          const distinguishedResult = calculator.calculateDistinguishedTargets(
            base,
            current
          )

          expect(paidClubsResult.base).toBeNull()
          expect(paidClubsResult.targets).toBeNull()
          expect(paidClubsResult.achievedLevel).toBeNull()
          expect(paidClubsResult.current).toBe(current)

          expect(paymentsResult.base).toBeNull()
          expect(paymentsResult.targets).toBeNull()
          expect(paymentsResult.achievedLevel).toBeNull()
          expect(paymentsResult.current).toBe(current)

          expect(distinguishedResult.base).toBeNull()
          expect(distinguishedResult.targets).toBeNull()
          expect(distinguishedResult.achievedLevel).toBeNull()
          expect(distinguishedResult.current).toBe(current)
        }),
        { numRuns: 100 }
      )
    })
  })
})
