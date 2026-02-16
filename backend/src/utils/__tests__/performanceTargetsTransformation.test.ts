/**
 * Unit tests for performance targets transformation utilities.
 *
 * These tests verify that the transformPerformanceTargets function correctly
 * transforms PerformanceTargetsData from analytics-core into the
 * DistrictPerformanceTargets format expected by the frontend.
 *
 * Requirements:
 * - 1.3: WHEN transforming performance targets for the frontend,
 *        THE Transformation_Layer SHALL use the actual paidClubsCount value
 *        instead of hardcoded zero
 */

import { describe, it, expect } from 'vitest'
import type {
  PerformanceTargetsData,
  MetricRankings,
} from '@toastmasters/analytics-core'
import {
  transformPerformanceTargets,
  createNullPerformanceTargets,
} from '../performanceTargetsTransformation.js'

/**
 * Creates a valid PerformanceTargetsData object for testing.
 * All required fields are populated with sensible defaults.
 */
function createTestPerformanceTargetsData(
  overrides: Partial<PerformanceTargetsData> = {}
): PerformanceTargetsData {
  const defaultRankings: MetricRankings = {
    worldRank: 1,
    worldPercentile: 99.5,
    regionRank: 1,
    totalDistricts: 100,
    totalInRegion: 10,
    region: 'Region 1',
  }

  return {
    districtId: 'D001',
    computedAt: new Date().toISOString(),
    membershipTarget: 1000,
    distinguishedTarget: 50,
    clubGrowthTarget: 10,
    paidClubsCount: 0,
    currentProgress: {
      membership: 800,
      distinguished: 30,
      clubGrowth: 5,
    },
    projectedAchievement: {
      membership: true,
      distinguished: false,
      clubGrowth: true,
    },
    paidClubsRankings: defaultRankings,
    membershipPaymentsRankings: defaultRankings,
    distinguishedClubsRankings: defaultRankings,
    // NEW: Base values from All Districts Rankings (Requirements 6.1, 6.2)
    paidClubBase: null,
    paymentBase: null,
    // NEW: Recognition level targets (Requirements 6.3, 6.4, 6.5)
    paidClubsTargets: null,
    membershipPaymentsTargets: null,
    distinguishedClubsTargets: null,
    // NEW: Achieved recognition levels (Requirements 6.6, 6.7, 6.8)
    paidClubsAchievedLevel: null,
    membershipPaymentsAchievedLevel: null,
    distinguishedClubsAchievedLevel: null,
    ...overrides,
  }
}

describe('performanceTargetsTransformation', () => {
  describe('transformPerformanceTargets', () => {
    describe('paidClubsCount pass-through (Requirement 1.3)', () => {
      /**
       * Test: Pass-through verification
       * Rule: The transformation layer SHALL use the actual paidClubsCount value
       *
       * Input: paidClubsCount: 42
       * Expected Output: paidClubs.current: 42
       */
      it('passes through paidClubsCount value to paidClubs.current', () => {
        const input = createTestPerformanceTargetsData({
          paidClubsCount: 42,
        })

        const result = transformPerformanceTargets(input)

        expect(result.paidClubs.current).toBe(42)
      })

      /**
       * Test: Zero value handling
       * Rule: Zero is a valid value and should be passed through correctly
       *
       * Input: paidClubsCount: 0
       * Expected Output: paidClubs.current: 0
       */
      it('handles zero paidClubsCount correctly', () => {
        const input = createTestPerformanceTargetsData({
          paidClubsCount: 0,
        })

        const result = transformPerformanceTargets(input)

        expect(result.paidClubs.current).toBe(0)
      })

      /**
       * Test: Large value handling
       * Rule: Large values should be passed through without modification
       */
      it('handles large paidClubsCount values correctly', () => {
        const input = createTestPerformanceTargetsData({
          paidClubsCount: 999,
        })

        const result = transformPerformanceTargets(input)

        expect(result.paidClubs.current).toBe(999)
      })
    })

    describe('other fields transformation', () => {
      /**
       * Test: Membership payments current value
       * Rule: currentProgress.membership should map to membershipPayments.current
       */
      it('maps currentProgress.membership to membershipPayments.current', () => {
        const input = createTestPerformanceTargetsData({
          currentProgress: {
            membership: 750,
            distinguished: 25,
            clubGrowth: 3,
          },
        })

        const result = transformPerformanceTargets(input)

        expect(result.membershipPayments.current).toBe(750)
      })

      /**
       * Test: Distinguished clubs current value
       * Rule: currentProgress.distinguished should map to distinguishedClubs.current
       */
      it('maps currentProgress.distinguished to distinguishedClubs.current', () => {
        const input = createTestPerformanceTargetsData({
          currentProgress: {
            membership: 800,
            distinguished: 57,
            clubGrowth: 5,
          },
        })

        const result = transformPerformanceTargets(input)

        expect(result.distinguishedClubs.current).toBe(57)
      })

      /**
       * Test: Rankings pass-through
       * Rule: Rankings should be passed through from input to output
       */
      it('passes through paidClubsRankings to paidClubs.rankings', () => {
        const customRankings: MetricRankings = {
          worldRank: 5,
          worldPercentile: 95.0,
          regionRank: 2,
          totalDistricts: 150,
          totalInRegion: 15,
          region: 'Region 5',
        }

        const input = createTestPerformanceTargetsData({
          paidClubsRankings: customRankings,
        })

        const result = transformPerformanceTargets(input)

        expect(result.paidClubs.rankings).toEqual(customRankings)
      })
    })

    describe('null rankings handling', () => {
      /**
       * Test: Missing rankings fallback
       * Rule: When rankings are undefined, should use NULL_RANKINGS defaults
       */
      it('uses NULL_RANKINGS when paidClubsRankings is undefined', () => {
        const input = createTestPerformanceTargetsData()
        // Force undefined rankings by casting
        const inputWithUndefinedRankings = {
          ...input,
          paidClubsRankings: undefined,
        } as unknown as PerformanceTargetsData

        const result = transformPerformanceTargets(inputWithUndefinedRankings)

        expect(result.paidClubs.rankings).toEqual({
          worldRank: null,
          worldPercentile: null,
          regionRank: null,
          totalDistricts: 0,
          totalInRegion: 0,
          region: null,
        })
      })
    })

    describe('output structure', () => {
      /**
       * Test: Output has correct structure
       * Rule: Output should have paidClubs, membershipPayments, and distinguishedClubs
       */
      it('returns object with all required metric fields', () => {
        const input = createTestPerformanceTargetsData()

        const result = transformPerformanceTargets(input)

        expect(result).toHaveProperty('paidClubs')
        expect(result).toHaveProperty('membershipPayments')
        expect(result).toHaveProperty('distinguishedClubs')
      })

      /**
       * Test: Each metric has correct sub-fields
       * Rule: Each metric should have current, base, targets, achievedLevel, rankings
       */
      it('each metric has current, base, targets, achievedLevel, and rankings', () => {
        const input = createTestPerformanceTargetsData()

        const result = transformPerformanceTargets(input)

        for (const metric of [
          result.paidClubs,
          result.membershipPayments,
          result.distinguishedClubs,
        ]) {
          expect(metric).toHaveProperty('current')
          expect(metric).toHaveProperty('base')
          expect(metric).toHaveProperty('targets')
          expect(metric).toHaveProperty('achievedLevel')
          expect(metric).toHaveProperty('rankings')
        }
      })

      /**
       * Test: Base and targets pass-through when null
       * Rule: When base and targets are null in input, they should be null in output
       *
       * Requirements: 7.1-7.9
       */
      it('passes through null base and targets when input has null values', () => {
        const input = createTestPerformanceTargetsData({
          paidClubBase: null,
          paymentBase: null,
          paidClubsTargets: null,
          membershipPaymentsTargets: null,
          distinguishedClubsTargets: null,
        })

        const result = transformPerformanceTargets(input)

        expect(result.paidClubs.base).toBeNull()
        expect(result.paidClubs.targets).toBeNull()
        expect(result.membershipPayments.base).toBeNull()
        expect(result.membershipPayments.targets).toBeNull()
        expect(result.distinguishedClubs.base).toBeNull()
        expect(result.distinguishedClubs.targets).toBeNull()
      })
    })

    describe('base value mappings (Requirements 7.1-7.3)', () => {
      /**
       * Test: paidClubBase maps to paidClubs.base
       * Rule: THE Backend_Transformation SHALL map paidClubBase to paidClubs.base
       *
       * Requirement: 7.1
       */
      it('maps paidClubBase to paidClubs.base (Requirement 7.1)', () => {
        const input = createTestPerformanceTargetsData({
          paidClubBase: 95,
        })

        const result = transformPerformanceTargets(input)

        expect(result.paidClubs.base).toBe(95)
      })

      /**
       * Test: paymentBase maps to membershipPayments.base
       * Rule: THE Backend_Transformation SHALL map paymentBase to membershipPayments.base
       *
       * Requirement: 7.2
       */
      it('maps paymentBase to membershipPayments.base (Requirement 7.2)', () => {
        const input = createTestPerformanceTargetsData({
          paymentBase: 2500,
        })

        const result = transformPerformanceTargets(input)

        expect(result.membershipPayments.base).toBe(2500)
      })

      /**
       * Test: paidClubBase maps to distinguishedClubs.base
       * Rule: THE Backend_Transformation SHALL map paidClubBase to distinguishedClubs.base
       *       (distinguished clubs use Club_Base for percentage calculation)
       *
       * Requirement: 7.3
       */
      it('maps paidClubBase to distinguishedClubs.base (Requirement 7.3)', () => {
        const input = createTestPerformanceTargetsData({
          paidClubBase: 95,
        })

        const result = transformPerformanceTargets(input)

        expect(result.distinguishedClubs.base).toBe(95)
      })
    })

    describe('targets mappings (Requirements 7.4-7.6)', () => {
      const sampleTargets = {
        distinguished: 96,
        select: 98,
        presidents: 100,
        smedley: 103,
      }

      /**
       * Test: paidClubsTargets maps to paidClubs.targets
       * Rule: THE Backend_Transformation SHALL map paidClubsTargets to paidClubs.targets
       *
       * Requirement: 7.4
       */
      it('maps paidClubsTargets to paidClubs.targets (Requirement 7.4)', () => {
        const input = createTestPerformanceTargetsData({
          paidClubsTargets: sampleTargets,
        })

        const result = transformPerformanceTargets(input)

        expect(result.paidClubs.targets).toEqual(sampleTargets)
      })

      /**
       * Test: membershipPaymentsTargets maps to membershipPayments.targets
       * Rule: THE Backend_Transformation SHALL map membershipPaymentsTargets to membershipPayments.targets
       *
       * Requirement: 7.5
       */
      it('maps membershipPaymentsTargets to membershipPayments.targets (Requirement 7.5)', () => {
        const membershipTargets = {
          distinguished: 2525,
          select: 2575,
          presidents: 2625,
          smedley: 2700,
        }
        const input = createTestPerformanceTargetsData({
          membershipPaymentsTargets: membershipTargets,
        })

        const result = transformPerformanceTargets(input)

        expect(result.membershipPayments.targets).toEqual(membershipTargets)
      })

      /**
       * Test: distinguishedClubsTargets maps to distinguishedClubs.targets
       * Rule: THE Backend_Transformation SHALL map distinguishedClubsTargets to distinguishedClubs.targets
       *
       * Requirement: 7.6
       */
      it('maps distinguishedClubsTargets to distinguishedClubs.targets (Requirement 7.6)', () => {
        const distinguishedTargets = {
          distinguished: 43,
          select: 48,
          presidents: 53,
          smedley: 57,
        }
        const input = createTestPerformanceTargetsData({
          distinguishedClubsTargets: distinguishedTargets,
        })

        const result = transformPerformanceTargets(input)

        expect(result.distinguishedClubs.targets).toEqual(distinguishedTargets)
      })
    })

    describe('achieved level mappings (Requirements 7.7-7.9)', () => {
      /**
       * Test: paidClubsAchievedLevel maps to paidClubs.achievedLevel
       * Rule: THE Backend_Transformation SHALL map paidClubsAchievedLevel to paidClubs.achievedLevel
       *
       * Requirement: 7.7
       */
      it('maps paidClubsAchievedLevel to paidClubs.achievedLevel (Requirement 7.7)', () => {
        const input = createTestPerformanceTargetsData({
          paidClubsAchievedLevel: 'select',
        })

        const result = transformPerformanceTargets(input)

        expect(result.paidClubs.achievedLevel).toBe('select')
      })

      /**
       * Test: membershipPaymentsAchievedLevel maps to membershipPayments.achievedLevel
       * Rule: THE Backend_Transformation SHALL map membershipPaymentsAchievedLevel to membershipPayments.achievedLevel
       *
       * Requirement: 7.8
       */
      it('maps membershipPaymentsAchievedLevel to membershipPayments.achievedLevel (Requirement 7.8)', () => {
        const input = createTestPerformanceTargetsData({
          membershipPaymentsAchievedLevel: 'presidents',
        })

        const result = transformPerformanceTargets(input)

        expect(result.membershipPayments.achievedLevel).toBe('presidents')
      })

      /**
       * Test: distinguishedClubsAchievedLevel maps to distinguishedClubs.achievedLevel
       * Rule: THE Backend_Transformation SHALL map distinguishedClubsAchievedLevel to distinguishedClubs.achievedLevel
       *
       * Requirement: 7.9
       */
      it('maps distinguishedClubsAchievedLevel to distinguishedClubs.achievedLevel (Requirement 7.9)', () => {
        const input = createTestPerformanceTargetsData({
          distinguishedClubsAchievedLevel: 'smedley',
        })

        const result = transformPerformanceTargets(input)

        expect(result.distinguishedClubs.achievedLevel).toBe('smedley')
      })

      /**
       * Test: All recognition levels are correctly mapped
       * Rule: All valid recognition levels should be passed through correctly
       */
      it('correctly maps all recognition level values', () => {
        const levels = [
          'distinguished',
          'select',
          'presidents',
          'smedley',
        ] as const

        for (const level of levels) {
          const input = createTestPerformanceTargetsData({
            paidClubsAchievedLevel: level,
            membershipPaymentsAchievedLevel: level,
            distinguishedClubsAchievedLevel: level,
          })

          const result = transformPerformanceTargets(input)

          expect(result.paidClubs.achievedLevel).toBe(level)
          expect(result.membershipPayments.achievedLevel).toBe(level)
          expect(result.distinguishedClubs.achievedLevel).toBe(level)
        }
      })
    })

    describe('complete transformation with all fields populated (Requirements 7.1-7.9)', () => {
      /**
       * Test: Complete transformation with all fields
       * Rule: All fields should be correctly mapped when fully populated
       *
       * Requirements: 7.1-7.9
       */
      it('correctly transforms complete PerformanceTargetsData with all fields populated', () => {
        const paidClubsTargets = {
          distinguished: 96,
          select: 98,
          presidents: 100,
          smedley: 103,
        }
        const membershipPaymentsTargets = {
          distinguished: 2525,
          select: 2575,
          presidents: 2625,
          smedley: 2700,
        }
        const distinguishedClubsTargets = {
          distinguished: 43,
          select: 48,
          presidents: 53,
          smedley: 57,
        }

        const input = createTestPerformanceTargetsData({
          paidClubsCount: 100,
          currentProgress: {
            membership: 2600,
            distinguished: 50,
            clubGrowth: 5,
          },
          paidClubBase: 95,
          paymentBase: 2500,
          paidClubsTargets,
          membershipPaymentsTargets,
          distinguishedClubsTargets,
          paidClubsAchievedLevel: 'presidents',
          membershipPaymentsAchievedLevel: 'select',
          distinguishedClubsAchievedLevel: 'distinguished',
        })

        const result = transformPerformanceTargets(input)

        // Verify paidClubs mapping (Requirements 7.1, 7.4, 7.7)
        expect(result.paidClubs.current).toBe(100)
        expect(result.paidClubs.base).toBe(95)
        expect(result.paidClubs.targets).toEqual(paidClubsTargets)
        expect(result.paidClubs.achievedLevel).toBe('presidents')

        // Verify membershipPayments mapping (Requirements 7.2, 7.5, 7.8)
        expect(result.membershipPayments.current).toBe(2600)
        expect(result.membershipPayments.base).toBe(2500)
        expect(result.membershipPayments.targets).toEqual(
          membershipPaymentsTargets
        )
        expect(result.membershipPayments.achievedLevel).toBe('select')

        // Verify distinguishedClubs mapping (Requirements 7.3, 7.6, 7.9)
        expect(result.distinguishedClubs.current).toBe(50)
        expect(result.distinguishedClubs.base).toBe(95) // Uses paidClubBase per Requirement 7.3
        expect(result.distinguishedClubs.targets).toEqual(
          distinguishedClubsTargets
        )
        expect(result.distinguishedClubs.achievedLevel).toBe('distinguished')
      })
    })
  })

  describe('createNullPerformanceTargets', () => {
    /**
     * Test: Creates null/empty performance targets
     * Rule: Should return all zeros and null values for when data is unavailable
     */
    it('returns all zero current values', () => {
      const result = createNullPerformanceTargets()

      expect(result.paidClubs.current).toBe(0)
      expect(result.membershipPayments.current).toBe(0)
      expect(result.distinguishedClubs.current).toBe(0)
    })

    it('returns null for base, targets, and achievedLevel', () => {
      const result = createNullPerformanceTargets()

      expect(result.paidClubs.base).toBeNull()
      expect(result.paidClubs.targets).toBeNull()
      expect(result.paidClubs.achievedLevel).toBeNull()
    })

    it('returns NULL_RANKINGS for all metrics', () => {
      const result = createNullPerformanceTargets()

      const expectedNullRankings = {
        worldRank: null,
        worldPercentile: null,
        regionRank: null,
        totalDistricts: 0,
        totalInRegion: 0,
        region: null,
      }

      expect(result.paidClubs.rankings).toEqual(expectedNullRankings)
      expect(result.membershipPayments.rankings).toEqual(expectedNullRankings)
      expect(result.distinguishedClubs.rankings).toEqual(expectedNullRankings)
    })
  })
})
