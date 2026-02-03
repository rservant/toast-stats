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
import type { PerformanceTargetsData, MetricRankings } from '@toastmasters/analytics-core'
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

        for (const metric of [result.paidClubs, result.membershipPayments, result.distinguishedClubs]) {
          expect(metric).toHaveProperty('current')
          expect(metric).toHaveProperty('base')
          expect(metric).toHaveProperty('targets')
          expect(metric).toHaveProperty('achievedLevel')
          expect(metric).toHaveProperty('rankings')
        }
      })

      /**
       * Test: Base and targets are null (not computed in current implementation)
       * Rule: Base and targets should be null as they're not available in analytics-core output
       */
      it('sets base and targets to null for all metrics', () => {
        const input = createTestPerformanceTargetsData()

        const result = transformPerformanceTargets(input)

        expect(result.paidClubs.base).toBeNull()
        expect(result.paidClubs.targets).toBeNull()
        expect(result.membershipPayments.base).toBeNull()
        expect(result.membershipPayments.targets).toBeNull()
        expect(result.distinguishedClubs.base).toBeNull()
        expect(result.distinguishedClubs.targets).toBeNull()
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
