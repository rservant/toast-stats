/**
 * Property-Based Tests for Risk Factors Conversion
 *
 * Feature: precomputed-analytics-alignment
 * Property 4: Risk factors conversion preserves information
 *
 * *For any* ClubRiskFactors object, converting to a string array and then
 * checking which risk factors are present should yield the same set of
 * true risk factors as the original object.
 *
 * **Validates: Requirements 2.6**
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import type { ClubRiskFactors } from '../types.js'
import {
  riskFactorsToStringArray,
  stringArrayToRiskFactors,
  RISK_FACTOR_LABELS,
} from './riskFactors.js'

// ========== Arbitraries (Generators) ==========

/**
 * Generate valid ClubRiskFactors with all boolean combinations.
 *
 * Input space: 2^5 = 32 combinations of boolean flags.
 * Currently only 3 risk factors are implemented in the system
 * (lowMembership, decliningMembership, lowPayments), but we test
 * all 5 to ensure the conversion handles the full interface.
 */
const clubRiskFactorsArb: fc.Arbitrary<ClubRiskFactors> = fc.record({
  lowMembership: fc.boolean(),
  decliningMembership: fc.boolean(),
  lowPayments: fc.boolean(),
  inactiveOfficers: fc.boolean(),
  noRecentMeetings: fc.boolean(),
})

// ========== Property Tests ==========

describe('Risk Factors Conversion Property Tests', () => {
  /**
   * Feature: precomputed-analytics-alignment
   * Property 4: Risk factors conversion preserves information
   *
   * *For any* ClubRiskFactors object, converting to a string array and then
   * checking which risk factors are present should yield the same set of
   * true risk factors as the original object.
   *
   * **Validates: Requirements 2.6**
   */
  describe('Property 4: Risk factors conversion preserves information', () => {
    it('should preserve all risk factors through round-trip conversion (object → string[] → object)', () => {
      // **Validates: Requirements 2.6**
      fc.assert(
        fc.property(clubRiskFactorsArb, originalFactors => {
          // Convert to string array
          const stringArray = riskFactorsToStringArray(originalFactors)

          // Convert back to object
          const roundTrippedFactors = stringArrayToRiskFactors(stringArray)

          // Verify all flags match
          expect(roundTrippedFactors.lowMembership).toBe(
            originalFactors.lowMembership
          )
          expect(roundTrippedFactors.decliningMembership).toBe(
            originalFactors.decliningMembership
          )
          expect(roundTrippedFactors.lowPayments).toBe(
            originalFactors.lowPayments
          )
          expect(roundTrippedFactors.inactiveOfficers).toBe(
            originalFactors.inactiveOfficers
          )
          expect(roundTrippedFactors.noRecentMeetings).toBe(
            originalFactors.noRecentMeetings
          )
        }),
        { numRuns: 100 }
      )
    })

    it('should produce string array with exactly the count of true flags', () => {
      // **Validates: Requirements 2.6**
      fc.assert(
        fc.property(clubRiskFactorsArb, factors => {
          const stringArray = riskFactorsToStringArray(factors)

          // Count true flags in original object
          const trueCount = [
            factors.lowMembership,
            factors.decliningMembership,
            factors.lowPayments,
            factors.inactiveOfficers,
            factors.noRecentMeetings,
          ].filter(Boolean).length

          // String array length should match count of true flags
          expect(stringArray.length).toBe(trueCount)
        }),
        { numRuns: 100 }
      )
    })

    it('should produce string array containing only valid risk factor labels', () => {
      // **Validates: Requirements 2.6**
      const validLabels = Object.values(RISK_FACTOR_LABELS)

      fc.assert(
        fc.property(clubRiskFactorsArb, factors => {
          const stringArray = riskFactorsToStringArray(factors)

          // Every string in the array should be a valid risk factor label
          for (const label of stringArray) {
            expect(validLabels).toContain(label)
          }
        }),
        { numRuns: 100 }
      )
    })

    it('should produce string array with no duplicates', () => {
      // **Validates: Requirements 2.6**
      fc.assert(
        fc.property(clubRiskFactorsArb, factors => {
          const stringArray = riskFactorsToStringArray(factors)

          // Check for duplicates using Set
          const uniqueLabels = new Set(stringArray)
          expect(uniqueLabels.size).toBe(stringArray.length)
        }),
        { numRuns: 100 }
      )
    })

    it('should have bijective mapping: each true flag maps to exactly one string', () => {
      // **Validates: Requirements 2.6**
      fc.assert(
        fc.property(clubRiskFactorsArb, factors => {
          const stringArray = riskFactorsToStringArray(factors)

          // Verify each true flag has its corresponding string
          if (factors.lowMembership) {
            expect(stringArray).toContain(RISK_FACTOR_LABELS.lowMembership)
          } else {
            expect(stringArray).not.toContain(RISK_FACTOR_LABELS.lowMembership)
          }

          if (factors.decliningMembership) {
            expect(stringArray).toContain(
              RISK_FACTOR_LABELS.decliningMembership
            )
          } else {
            expect(stringArray).not.toContain(
              RISK_FACTOR_LABELS.decliningMembership
            )
          }

          if (factors.lowPayments) {
            expect(stringArray).toContain(RISK_FACTOR_LABELS.lowPayments)
          } else {
            expect(stringArray).not.toContain(RISK_FACTOR_LABELS.lowPayments)
          }

          if (factors.inactiveOfficers) {
            expect(stringArray).toContain(RISK_FACTOR_LABELS.inactiveOfficers)
          } else {
            expect(stringArray).not.toContain(
              RISK_FACTOR_LABELS.inactiveOfficers
            )
          }

          if (factors.noRecentMeetings) {
            expect(stringArray).toContain(RISK_FACTOR_LABELS.noRecentMeetings)
          } else {
            expect(stringArray).not.toContain(
              RISK_FACTOR_LABELS.noRecentMeetings
            )
          }
        }),
        { numRuns: 100 }
      )
    })

    it('should handle all-false case (empty risk factors)', () => {
      // **Validates: Requirements 2.6**
      const allFalse: ClubRiskFactors = {
        lowMembership: false,
        decliningMembership: false,
        lowPayments: false,
        inactiveOfficers: false,
        noRecentMeetings: false,
      }

      const stringArray = riskFactorsToStringArray(allFalse)
      expect(stringArray).toEqual([])

      const roundTripped = stringArrayToRiskFactors(stringArray)
      expect(roundTripped).toEqual(allFalse)
    })

    it('should handle all-true case (all risk factors present)', () => {
      // **Validates: Requirements 2.6**
      const allTrue: ClubRiskFactors = {
        lowMembership: true,
        decliningMembership: true,
        lowPayments: true,
        inactiveOfficers: true,
        noRecentMeetings: true,
      }

      const stringArray = riskFactorsToStringArray(allTrue)
      expect(stringArray).toHaveLength(5)
      expect(stringArray).toContain(RISK_FACTOR_LABELS.lowMembership)
      expect(stringArray).toContain(RISK_FACTOR_LABELS.decliningMembership)
      expect(stringArray).toContain(RISK_FACTOR_LABELS.lowPayments)
      expect(stringArray).toContain(RISK_FACTOR_LABELS.inactiveOfficers)
      expect(stringArray).toContain(RISK_FACTOR_LABELS.noRecentMeetings)

      const roundTripped = stringArrayToRiskFactors(stringArray)
      expect(roundTripped).toEqual(allTrue)
    })
  })
})
