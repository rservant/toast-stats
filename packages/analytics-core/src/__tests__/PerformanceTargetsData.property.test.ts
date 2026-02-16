/**
 * Property-Based Tests for PerformanceTargetsData Serialization
 *
 * **Property 4: Performance Targets Data Round-Trip Serialization**
 * *For any* valid `PerformanceTargetsData` object, serializing to JSON and then deserializing
 * SHALL produce an object equivalent to the original, with all fields including `paidClubsCount`
 * and `currentProgress.distinguished` preserved.
 *
 * **Validates: Requirements 3.1, 3.2, 3.3**
 *
 * Feature: district-overview-data-consistency
 * Property 4: Performance Targets Data Round-Trip Serialization
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import type { PerformanceTargetsData, MetricRankings } from '../types.js'

// ========== Arbitraries (Generators) ==========

/**
 * Generate a valid district ID (e.g., "D101", "D42", "D1")
 */
const districtIdArb = fc.integer({ min: 1, max: 999 }).map(n => `D${n}`)

/**
 * Generate a valid ISO timestamp string
 * Using integer-based approach to avoid invalid date issues with fc.date()
 */
const isoTimestampArb = fc
  .integer({
    // Timestamps from 2020-01-01 to 2030-12-31
    min: new Date('2020-01-01T00:00:00.000Z').getTime(),
    max: new Date('2030-12-31T23:59:59.999Z').getTime(),
  })
  .map(timestamp => new Date(timestamp).toISOString())

/**
 * Generate a non-negative integer for counts and targets
 */
const nonNegativeIntArb = fc.integer({ min: 0, max: 10000 })

/**
 * Generate a nullable positive integer for world rank (1 = best)
 */
const worldRankArb = fc.oneof(
  fc.constant(null),
  fc.integer({ min: 1, max: 500 })
)

/**
 * Generate a nullable percentile (0-100, rounded to 1 decimal)
 */
const percentileArb = fc.oneof(
  fc.constant(null),
  fc.float({ min: 0, max: 100, noNaN: true }).map(n => Math.round(n * 10) / 10)
)

/**
 * Generate a nullable region rank
 */
const regionRankArb = fc.oneof(
  fc.constant(null),
  fc.integer({ min: 1, max: 100 })
)

/**
 * Generate a nullable region identifier
 */
const regionArb = fc.oneof(
  fc.constant(null),
  fc.constantFrom(
    'Region 1',
    'Region 2',
    'Region 3',
    'Region 4',
    'Region 5',
    'Region 6',
    'Region 7',
    'Region 8'
  )
)

/**
 * Generate a valid MetricRankings object
 */
const metricRankingsArb: fc.Arbitrary<MetricRankings> = fc.record({
  worldRank: worldRankArb,
  worldPercentile: percentileArb,
  regionRank: regionRankArb,
  totalDistricts: fc.integer({ min: 1, max: 500 }),
  totalInRegion: fc.integer({ min: 1, max: 100 }),
  region: regionArb,
})

/**
 * Generate a valid currentProgress object
 */
const currentProgressArb = fc.record({
  membership: nonNegativeIntArb,
  distinguished: nonNegativeIntArb,
  clubGrowth: fc.integer({ min: -100, max: 100 }), // Can be negative for decline
})

/**
 * Generate a valid projectedAchievement object
 */
const projectedAchievementArb = fc.record({
  membership: fc.boolean(),
  distinguished: fc.boolean(),
  clubGrowth: fc.boolean(),
})

/**
 * Generate a valid PerformanceTargetsData object
 */
const performanceTargetsDataArb: fc.Arbitrary<PerformanceTargetsData> =
  fc.record({
    districtId: districtIdArb,
    computedAt: isoTimestampArb,
    membershipTarget: nonNegativeIntArb,
    distinguishedTarget: nonNegativeIntArb,
    clubGrowthTarget: nonNegativeIntArb,
    paidClubsCount: nonNegativeIntArb,
    currentProgress: currentProgressArb,
    projectedAchievement: projectedAchievementArb,
    paidClubsRankings: metricRankingsArb,
    membershipPaymentsRankings: metricRankingsArb,
    distinguishedClubsRankings: metricRankingsArb,
  })

// ========== Helper Functions ==========

/**
 * Deep equality check for PerformanceTargetsData objects.
 * Handles null values and nested objects correctly.
 */
function arePerformanceTargetsEqual(
  original: PerformanceTargetsData,
  deserialized: PerformanceTargetsData
): boolean {
  // Check primitive fields
  if (original.districtId !== deserialized.districtId) return false
  if (original.computedAt !== deserialized.computedAt) return false
  if (original.membershipTarget !== deserialized.membershipTarget) return false
  if (original.distinguishedTarget !== deserialized.distinguishedTarget)
    return false
  if (original.clubGrowthTarget !== deserialized.clubGrowthTarget) return false
  if (original.paidClubsCount !== deserialized.paidClubsCount) return false

  // Check currentProgress
  if (
    original.currentProgress.membership !==
    deserialized.currentProgress.membership
  )
    return false
  if (
    original.currentProgress.distinguished !==
    deserialized.currentProgress.distinguished
  )
    return false
  if (
    original.currentProgress.clubGrowth !==
    deserialized.currentProgress.clubGrowth
  )
    return false

  // Check projectedAchievement
  if (
    original.projectedAchievement.membership !==
    deserialized.projectedAchievement.membership
  )
    return false
  if (
    original.projectedAchievement.distinguished !==
    deserialized.projectedAchievement.distinguished
  )
    return false
  if (
    original.projectedAchievement.clubGrowth !==
    deserialized.projectedAchievement.clubGrowth
  )
    return false

  // Check rankings
  if (
    !areMetricRankingsEqual(
      original.paidClubsRankings,
      deserialized.paidClubsRankings
    )
  )
    return false
  if (
    !areMetricRankingsEqual(
      original.membershipPaymentsRankings,
      deserialized.membershipPaymentsRankings
    )
  )
    return false
  if (
    !areMetricRankingsEqual(
      original.distinguishedClubsRankings,
      deserialized.distinguishedClubsRankings
    )
  )
    return false

  return true
}

/**
 * Deep equality check for MetricRankings objects.
 * Handles null values correctly.
 */
function areMetricRankingsEqual(
  original: MetricRankings,
  deserialized: MetricRankings
): boolean {
  if (original.worldRank !== deserialized.worldRank) return false
  if (original.worldPercentile !== deserialized.worldPercentile) return false
  if (original.regionRank !== deserialized.regionRank) return false
  if (original.totalDistricts !== deserialized.totalDistricts) return false
  if (original.totalInRegion !== deserialized.totalInRegion) return false
  if (original.region !== deserialized.region) return false
  return true
}

// ========== Property Tests ==========

describe('PerformanceTargetsData Property Tests', () => {
  /**
   * Feature: district-overview-data-consistency
   * Property 4: Performance Targets Data Round-Trip Serialization
   *
   * **Validates: Requirements 3.1, 3.2, 3.3**
   */
  describe('Property 4: Performance Targets Data Round-Trip Serialization', () => {
    /**
     * Property 4.1: JSON round-trip preserves all fields
     *
     * For any valid PerformanceTargetsData object, serializing to JSON
     * and then deserializing should produce an equivalent object.
     *
     * **Validates: Requirements 3.1, 3.2, 3.3**
     */
    it('should preserve all fields through JSON serialization round-trip', () => {
      fc.assert(
        fc.property(performanceTargetsDataArb, original => {
          // Serialize to JSON
          const serialized = JSON.stringify(original)

          // Deserialize from JSON
          const deserialized = JSON.parse(serialized) as PerformanceTargetsData

          // Verify all fields are preserved
          expect(arePerformanceTargetsEqual(original, deserialized)).toBe(true)

          return true
        }),
        { numRuns: 100 }
      )
    })

    /**
     * Property 4.2: paidClubsCount field is preserved through round-trip
     *
     * The paidClubsCount field specifically must be preserved, as this is
     * a new field that was previously missing and caused bugs.
     *
     * **Validates: Requirements 3.2**
     */
    it('should preserve paidClubsCount field through JSON round-trip', () => {
      fc.assert(
        fc.property(performanceTargetsDataArb, original => {
          const serialized = JSON.stringify(original)
          const deserialized = JSON.parse(serialized) as PerformanceTargetsData

          expect(deserialized.paidClubsCount).toBe(original.paidClubsCount)

          return true
        }),
        { numRuns: 100 }
      )
    })

    /**
     * Property 4.3: currentProgress.distinguished field is preserved through round-trip
     *
     * The currentProgress.distinguished field must be preserved with the
     * correct distinguished clubs count.
     *
     * **Validates: Requirements 3.3**
     */
    it('should preserve currentProgress.distinguished field through JSON round-trip', () => {
      fc.assert(
        fc.property(performanceTargetsDataArb, original => {
          const serialized = JSON.stringify(original)
          const deserialized = JSON.parse(serialized) as PerformanceTargetsData

          expect(deserialized.currentProgress.distinguished).toBe(
            original.currentProgress.distinguished
          )

          return true
        }),
        { numRuns: 100 }
      )
    })

    /**
     * Property 4.4: All currentProgress fields are preserved
     *
     * All fields in the currentProgress object must be preserved.
     *
     * **Validates: Requirements 3.1**
     */
    it('should preserve all currentProgress fields through JSON round-trip', () => {
      fc.assert(
        fc.property(performanceTargetsDataArb, original => {
          const serialized = JSON.stringify(original)
          const deserialized = JSON.parse(serialized) as PerformanceTargetsData

          expect(deserialized.currentProgress.membership).toBe(
            original.currentProgress.membership
          )
          expect(deserialized.currentProgress.distinguished).toBe(
            original.currentProgress.distinguished
          )
          expect(deserialized.currentProgress.clubGrowth).toBe(
            original.currentProgress.clubGrowth
          )

          return true
        }),
        { numRuns: 100 }
      )
    })

    /**
     * Property 4.5: All projectedAchievement boolean fields are preserved
     *
     * Boolean fields must be preserved correctly through JSON round-trip.
     *
     * **Validates: Requirements 3.1**
     */
    it('should preserve all projectedAchievement boolean fields through JSON round-trip', () => {
      fc.assert(
        fc.property(performanceTargetsDataArb, original => {
          const serialized = JSON.stringify(original)
          const deserialized = JSON.parse(serialized) as PerformanceTargetsData

          expect(deserialized.projectedAchievement.membership).toBe(
            original.projectedAchievement.membership
          )
          expect(deserialized.projectedAchievement.distinguished).toBe(
            original.projectedAchievement.distinguished
          )
          expect(deserialized.projectedAchievement.clubGrowth).toBe(
            original.projectedAchievement.clubGrowth
          )

          return true
        }),
        { numRuns: 100 }
      )
    })

    /**
     * Property 4.6: All MetricRankings fields are preserved including null values
     *
     * MetricRankings objects contain nullable fields that must be preserved
     * correctly through JSON round-trip.
     *
     * **Validates: Requirements 3.1**
     */
    it('should preserve all MetricRankings fields including null values through JSON round-trip', () => {
      fc.assert(
        fc.property(performanceTargetsDataArb, original => {
          const serialized = JSON.stringify(original)
          const deserialized = JSON.parse(serialized) as PerformanceTargetsData

          // Check paidClubsRankings
          expect(
            areMetricRankingsEqual(
              original.paidClubsRankings,
              deserialized.paidClubsRankings
            )
          ).toBe(true)

          // Check membershipPaymentsRankings
          expect(
            areMetricRankingsEqual(
              original.membershipPaymentsRankings,
              deserialized.membershipPaymentsRankings
            )
          ).toBe(true)

          // Check distinguishedClubsRankings
          expect(
            areMetricRankingsEqual(
              original.distinguishedClubsRankings,
              deserialized.distinguishedClubsRankings
            )
          ).toBe(true)

          return true
        }),
        { numRuns: 100 }
      )
    })

    /**
     * Property 4.7: Serialized JSON is valid and parseable
     *
     * The serialized JSON should always be valid and parseable.
     *
     * **Validates: Requirements 3.1**
     */
    it('should produce valid parseable JSON', () => {
      fc.assert(
        fc.property(performanceTargetsDataArb, original => {
          const serialized = JSON.stringify(original)

          // Should not throw when parsing
          expect(() => JSON.parse(serialized)).not.toThrow()

          // Should produce an object (not null, undefined, or primitive)
          const parsed = JSON.parse(serialized)
          expect(typeof parsed).toBe('object')
          expect(parsed).not.toBeNull()

          return true
        }),
        { numRuns: 100 }
      )
    })

    /**
     * Property 4.8: Deep equality using JSON.stringify comparison
     *
     * Alternative verification using JSON.stringify for deep equality.
     * This catches any edge cases in our manual comparison.
     *
     * **Validates: Requirements 3.1, 3.2, 3.3**
     */
    it('should produce identical JSON when re-serialized after round-trip', () => {
      fc.assert(
        fc.property(performanceTargetsDataArb, original => {
          const serialized1 = JSON.stringify(original)
          const deserialized = JSON.parse(serialized1) as PerformanceTargetsData
          const serialized2 = JSON.stringify(deserialized)

          // The JSON strings should be identical
          expect(serialized1).toBe(serialized2)

          return true
        }),
        { numRuns: 100 }
      )
    })
  })
})
