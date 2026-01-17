/**
 * Property-Based Tests for RegionRankingService
 *
 * These tests validate the correctness of region ranking and world percentile
 * calculations using property-based testing with fast-check.
 *
 * **Feature: district-performance-targets**
 */

import { describe, it, expect, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { RegionRankingService } from '../RegionRankingService.js'
import type { DistrictRanking } from '../../types/analytics.js'

describe('RegionRankingService - Property Tests', () => {
  let service: RegionRankingService

  beforeEach(() => {
    service = new RegionRankingService()
  })

  /**
   * Arbitrary for generating valid district ranking data
   * Uses the actual DistrictRanking interface fields from snapshots.ts
   */
  const districtRankingArb = (
    districtId: string,
    region: string | null
  ): fc.Arbitrary<DistrictRanking> =>
    fc.record({
      districtId: fc.constant(districtId),
      districtName: fc.constant(`District ${districtId}`),
      region: fc.constant(region ?? ''),
      paidClubs: fc.integer({ min: 1, max: 500 }),
      paidClubBase: fc.integer({ min: 1, max: 500 }),
      clubGrowthPercent: fc.float({ min: -10, max: 20 }),
      totalPayments: fc.integer({ min: 100, max: 50000 }),
      paymentBase: fc.integer({ min: 100, max: 50000 }),
      paymentGrowthPercent: fc.float({ min: -10, max: 20 }),
      activeClubs: fc.integer({ min: 1, max: 500 }),
      distinguishedClubs: fc.integer({ min: 0, max: 200 }),
      selectDistinguished: fc.integer({ min: 0, max: 100 }),
      presidentsDistinguished: fc.integer({ min: 0, max: 50 }),
      distinguishedPercent: fc.float({ min: 0, max: 100 }),
      clubsRank: fc.integer({ min: 1, max: 200 }),
      paymentsRank: fc.integer({ min: 1, max: 200 }),
      distinguishedRank: fc.integer({ min: 1, max: 200 }),
      aggregateScore: fc.float({ min: 0, max: 100 }),
    })

  /**
   * Generate a list of district rankings with specified regions
   */
  const districtRankingsArb = (
    regions: string[],
    districtsPerRegion: number
  ): fc.Arbitrary<DistrictRanking[]> => {
    const arbitraries: fc.Arbitrary<DistrictRanking>[] = []
    let districtCounter = 1

    for (const region of regions) {
      for (let i = 0; i < districtsPerRegion; i++) {
        const districtId = `D${districtCounter}`
        arbitraries.push(districtRankingArb(districtId, region))
        districtCounter++
      }
    }

    return fc.tuple(...arbitraries).map(arr => arr as DistrictRanking[])
  }

  /**
   * Property 3: Region Ranking Correctness
   *
   * For any district with a known region, the region rank SHALL be calculated by:
   * 1. Filtering all districts to those in the same region
   * 2. Ordering by the metric value (descending)
   * 3. Assigning rank 1 to the best performer
   *
   * **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
   */
  describe('Property 3: Region Ranking Correctness', () => {
    const metrics = ['clubs', 'payments', 'distinguished'] as const

    it('region rank is derived from world rankings data (Req 4.1)', () => {
      fc.assert(
        fc.property(
          districtRankingsArb(['Region1', 'Region2'], 5),
          fc.constantFrom(...metrics),
          (rankings, metric) => {
            const targetDistrict = rankings[0]
            if (!targetDistrict) return

            const result = service.calculateRegionRank(
              targetDistrict.districtId,
              metric,
              rankings
            )

            // Region rank should be derived (not null for valid data)
            expect(result.regionRank).not.toBeNull()
            expect(result.region).toBe(targetDistrict.region)
          }
        ),
        { numRuns: 25 } // Optimized for CI/CD timeout compliance
      )
    })

    it('region rank filters to same region only (Req 4.2)', () => {
      fc.assert(
        fc.property(
          districtRankingsArb(['RegionA', 'RegionB', 'RegionC'], 4),
          fc.constantFrom(...metrics),
          (rankings, metric) => {
            const targetDistrict = rankings[0]
            if (!targetDistrict) return

            const result = service.calculateRegionRank(
              targetDistrict.districtId,
              metric,
              rankings
            )

            // Total in region should match count of districts in same region
            const sameRegionCount = rankings.filter(
              d => d.region === targetDistrict.region
            ).length

            expect(result.totalInRegion).toBe(sameRegionCount)
          }
        ),
        { numRuns: 25 } // Optimized for CI/CD timeout compliance
      )
    })

    it('region rank 1 is assigned to best performer (Req 4.3)', () => {
      fc.assert(
        fc.property(
          districtRankingsArb(['TestRegion'], 5),
          fc.constantFrom(...metrics),
          (rankings, metric) => {
            // Find the best performer in the region (lowest world rank for that metric)
            const getWorldRank = (d: DistrictRanking): number => {
              switch (metric) {
                case 'clubs':
                  return d.clubsRank
                case 'payments':
                  return d.paymentsRank
                case 'distinguished':
                  return d.distinguishedRank
              }
            }

            const sortedByWorldRank = [...rankings].sort(
              (a, b) => getWorldRank(a) - getWorldRank(b)
            )
            const bestPerformer = sortedByWorldRank[0]
            if (!bestPerformer) return

            const result = service.calculateRegionRank(
              bestPerformer.districtId,
              metric,
              rankings
            )

            // Best performer (lowest world rank) should have region rank 1
            expect(result.regionRank).toBe(1)
          }
        ),
        { numRuns: 25 } // Optimized for CI/CD timeout compliance
      )
    })

    it('region rank is calculated for all three metrics (Req 4.4)', () => {
      fc.assert(
        fc.property(districtRankingsArb(['MultiMetricRegion'], 3), rankings => {
          const targetDistrict = rankings[0]
          if (!targetDistrict) return

          // Calculate region rank for each metric
          const clubsResult = service.calculateRegionRank(
            targetDistrict.districtId,
            'clubs',
            rankings
          )
          const paymentsResult = service.calculateRegionRank(
            targetDistrict.districtId,
            'payments',
            rankings
          )
          const distinguishedResult = service.calculateRegionRank(
            targetDistrict.districtId,
            'distinguished',
            rankings
          )

          // All should return valid region ranks
          expect(clubsResult.regionRank).not.toBeNull()
          expect(paymentsResult.regionRank).not.toBeNull()
          expect(distinguishedResult.regionRank).not.toBeNull()

          // All should have same total in region
          expect(clubsResult.totalInRegion).toBe(rankings.length)
          expect(paymentsResult.totalInRegion).toBe(rankings.length)
          expect(distinguishedResult.totalInRegion).toBe(rankings.length)
        }),
        // Optimized for CI/CD timeout compliance (30s limit)
        { numRuns: 25 }
      )
    })

    it('region rank is within valid bounds [1, totalInRegion]', () => {
      fc.assert(
        fc.property(
          districtRankingsArb(['BoundsRegion'], 10),
          fc.constantFrom(...metrics),
          (rankings, metric) => {
            for (const district of rankings) {
              const result = service.calculateRegionRank(
                district.districtId,
                metric,
                rankings
              )

              expect(result.regionRank).toBeGreaterThanOrEqual(1)
              expect(result.regionRank).toBeLessThanOrEqual(
                result.totalInRegion
              )
            }
          }
        ),
        { numRuns: 25 } // Optimized for CI/CD timeout compliance
      )
    })

    it('handles ties correctly - same world rank gets same region rank', () => {
      // Create districts with identical world ranks for the metric
      const createTiedDistricts = (): DistrictRanking[] => [
        {
          districtId: 'D1',
          districtName: 'District D1',
          region: 'TieRegion',
          paidClubs: 100,
          paidClubBase: 95,
          clubGrowthPercent: 5.26,
          totalPayments: 5000,
          paymentBase: 4800,
          paymentGrowthPercent: 4.17,
          activeClubs: 100,
          distinguishedClubs: 50,
          selectDistinguished: 20,
          presidentsDistinguished: 10,
          distinguishedPercent: 50,
          clubsRank: 1, // Tied for best
          paymentsRank: 1, // Tied for best
          distinguishedRank: 1, // Tied for best
          aggregateScore: 90,
        },
        {
          districtId: 'D2',
          districtName: 'District D2',
          region: 'TieRegion',
          paidClubs: 100,
          paidClubBase: 95,
          clubGrowthPercent: 5.26,
          totalPayments: 5000,
          paymentBase: 4800,
          paymentGrowthPercent: 4.17,
          activeClubs: 100,
          distinguishedClubs: 50,
          selectDistinguished: 20,
          presidentsDistinguished: 10,
          distinguishedPercent: 50,
          clubsRank: 1, // Tied for best (same world rank as D1)
          paymentsRank: 1, // Tied for best
          distinguishedRank: 1, // Tied for best
          aggregateScore: 90,
        },
        {
          districtId: 'D3',
          districtName: 'District D3',
          region: 'TieRegion',
          paidClubs: 50,
          paidClubBase: 48,
          clubGrowthPercent: 4.17,
          totalPayments: 2500,
          paymentBase: 2400,
          paymentGrowthPercent: 4.17,
          activeClubs: 50,
          distinguishedClubs: 25,
          selectDistinguished: 10,
          presidentsDistinguished: 5,
          distinguishedPercent: 50,
          clubsRank: 3, // Worse world rank
          paymentsRank: 3, // Worse world rank
          distinguishedRank: 3, // Worse world rank
          aggregateScore: 70,
        },
      ]

      const tiedDistricts = createTiedDistricts()

      for (const metric of metrics) {
        const result1 = service.calculateRegionRank('D1', metric, tiedDistricts)
        const result2 = service.calculateRegionRank('D2', metric, tiedDistricts)
        const result3 = service.calculateRegionRank('D3', metric, tiedDistricts)

        // D1 and D2 should have the same region rank (tied for first based on world rank)
        expect(result1.regionRank).toBe(result2.regionRank)
        expect(result1.regionRank).toBe(1)

        // D3 should have a lower region rank (worse world rank)
        expect(result3.regionRank).toBeGreaterThan(result1.regionRank!)
      }
    })

    it('returns null region rank for unknown region', () => {
      const districtWithNullRegion: DistrictRanking = {
        districtId: 'D1',
        districtName: 'District D1',
        region: '', // Empty string represents unknown region
        paidClubs: 100,
        paidClubBase: 95,
        clubGrowthPercent: 5.26,
        totalPayments: 5000,
        paymentBase: 4800,
        paymentGrowthPercent: 4.17,
        activeClubs: 100,
        distinguishedClubs: 50,
        selectDistinguished: 20,
        presidentsDistinguished: 10,
        distinguishedPercent: 50,
        clubsRank: 1,
        paymentsRank: 1,
        distinguishedRank: 1,
        aggregateScore: 90,
      }

      for (const metric of metrics) {
        const result = service.calculateRegionRank('D1', metric, [
          districtWithNullRegion,
        ])

        // Empty region should be treated as unknown
        expect(result.regionRank).toBeNull()
      }
    })

    it('returns null region rank for non-existent district', () => {
      fc.assert(
        fc.property(
          districtRankingsArb(['SomeRegion'], 3),
          fc.constantFrom(...metrics),
          (rankings, metric) => {
            const result = service.calculateRegionRank(
              'NonExistentDistrict',
              metric,
              rankings
            )

            expect(result.regionRank).toBeNull()
            expect(result.totalInRegion).toBe(0)
          }
        ),
        { numRuns: 25 } // Optimized for CI/CD timeout compliance
      )
    })
  })

  /**
   * Property 4: World Percentile Calculation
   *
   * For any district with a world rank, the percentile SHALL be calculated as
   * `((totalDistricts - worldRank) / totalDistricts) × 100`, rounded to one
   * decimal place, and displayed as "Top X%" where X = 100 - percentile.
   *
   * **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
   */
  describe('Property 4: World Percentile Calculation', () => {
    // Arbitrary for valid world rank and total districts
    const worldRankArb = fc.integer({ min: 1, max: 200 })
    const totalDistrictsArb = fc.integer({ min: 1, max: 200 })

    it('percentile is calculated based on world rank and total districts (Req 5.1)', () => {
      fc.assert(
        fc.property(
          worldRankArb,
          totalDistrictsArb,
          (worldRank, totalDistricts) => {
            // Ensure worldRank <= totalDistricts for valid input
            const validRank = Math.min(worldRank, totalDistricts)

            const percentile = service.calculateWorldPercentile(
              validRank,
              totalDistricts
            )

            // Percentile should be a number
            expect(typeof percentile).toBe('number')
            expect(isNaN(percentile)).toBe(false)
          }
        ),
        { numRuns: 25 } // Optimized for CI/CD timeout compliance
      )
    })

    it('percentile uses formula: ((total - rank) / total) × 100 (Req 5.2)', () => {
      fc.assert(
        fc.property(
          worldRankArb,
          totalDistrictsArb,
          (worldRank, totalDistricts) => {
            // Ensure worldRank <= totalDistricts for valid input
            const validRank = Math.min(worldRank, totalDistricts)

            const percentile = service.calculateWorldPercentile(
              validRank,
              totalDistricts
            )

            // Calculate expected value using the formula
            const expectedRaw =
              ((totalDistricts - validRank) / totalDistricts) * 100
            const expectedRounded = Math.round(expectedRaw * 10) / 10

            expect(percentile).toBe(expectedRounded)
          }
        ),
        { numRuns: 25 } // Optimized for CI/CD timeout compliance
      )
    })

    it('percentile is rounded to one decimal place (Req 5.3)', () => {
      fc.assert(
        fc.property(
          worldRankArb,
          totalDistrictsArb,
          (worldRank, totalDistricts) => {
            const validRank = Math.min(worldRank, totalDistricts)

            const percentile = service.calculateWorldPercentile(
              validRank,
              totalDistricts
            )

            // Check that percentile has at most one decimal place
            const decimalPlaces = (percentile.toString().split('.')[1] || '')
              .length
            expect(decimalPlaces).toBeLessThanOrEqual(1)
          }
        ),
        { numRuns: 25 } // Optimized for CI/CD timeout compliance
      )
    })

    it('percentile supports "Top X%" display where X = 100 - percentile (Req 5.4)', () => {
      // Test specific examples to verify the display formula
      // Rank 10 of 100 districts:
      // - percentile = ((100 - 10) / 100) × 100 = 90%
      // - displayValue = "Top 10%" (which is 100 - 90)
      const percentile = service.calculateWorldPercentile(10, 100)
      expect(percentile).toBe(90)
      const topX = 100 - percentile
      expect(topX).toBe(10) // "Top 10%"

      // Rank 1 of 100 districts (best):
      // - percentile = ((100 - 1) / 100) × 100 = 99%
      // - displayValue = "Top 1%"
      const percentileBest = service.calculateWorldPercentile(1, 100)
      expect(percentileBest).toBe(99)
      const topXBest = 100 - percentileBest
      expect(topXBest).toBe(1) // "Top 1%"

      // Rank 100 of 100 districts (worst):
      // - percentile = ((100 - 100) / 100) × 100 = 0%
      // - displayValue = "Top 100%"
      const percentileWorst = service.calculateWorldPercentile(100, 100)
      expect(percentileWorst).toBe(0)
      const topXWorst = 100 - percentileWorst
      expect(topXWorst).toBe(100) // "Top 100%"
    })

    it('percentile is within valid bounds [0, 100)', () => {
      fc.assert(
        fc.property(
          worldRankArb,
          totalDistrictsArb,
          (worldRank, totalDistricts) => {
            const validRank = Math.min(worldRank, totalDistricts)

            const percentile = service.calculateWorldPercentile(
              validRank,
              totalDistricts
            )

            // Percentile should be >= 0 and < 100 (can't be exactly 100 since rank >= 1)
            expect(percentile).toBeGreaterThanOrEqual(0)
            expect(percentile).toBeLessThan(100)
          }
        ),
        { numRuns: 25 } // Optimized for CI/CD timeout compliance
      )
    })

    it('higher rank (worse) results in lower percentile', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 10, max: 200 }), // totalDistricts
          totalDistricts => {
            // Compare two different ranks
            const betterRank = 1
            const worseRank = totalDistricts

            const betterPercentile = service.calculateWorldPercentile(
              betterRank,
              totalDistricts
            )
            const worsePercentile = service.calculateWorldPercentile(
              worseRank,
              totalDistricts
            )

            // Better rank should have higher percentile
            expect(betterPercentile).toBeGreaterThan(worsePercentile)
          }
        ),
        { numRuns: 25 } // Optimized for CI/CD timeout compliance
      )
    })

    it('percentile is monotonically decreasing as rank increases', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 5, max: 100 }), // totalDistricts
          totalDistricts => {
            let previousPercentile = 100

            for (let rank = 1; rank <= totalDistricts; rank++) {
              const percentile = service.calculateWorldPercentile(
                rank,
                totalDistricts
              )
              expect(percentile).toBeLessThanOrEqual(previousPercentile)
              previousPercentile = percentile
            }
          }
        ),
        { numRuns: 25 }
      )
    })

    it('handles edge cases gracefully', () => {
      // Zero total districts
      expect(service.calculateWorldPercentile(1, 0)).toBe(0)

      // Zero rank (invalid)
      expect(service.calculateWorldPercentile(0, 100)).toBe(0)

      // Negative values
      expect(service.calculateWorldPercentile(-1, 100)).toBe(0)
      expect(service.calculateWorldPercentile(1, -100)).toBe(0)

      // Rank exceeds total (invalid but handled gracefully)
      expect(service.calculateWorldPercentile(150, 100)).toBe(0)
    })

    it('single district case: rank 1 of 1 gives 0% percentile', () => {
      // When there's only one district, it's both best and worst
      // percentile = ((1 - 1) / 1) × 100 = 0%
      const percentile = service.calculateWorldPercentile(1, 1)
      expect(percentile).toBe(0)
    })
  })

  /**
   * Additional Property: buildMetricRankings combines all ranking data correctly
   */
  describe('Property: buildMetricRankings Integration', () => {
    it('combines world rank, percentile, and region rank correctly', () => {
      fc.assert(
        fc.property(
          districtRankingsArb(['IntegrationRegion'], 5),
          fc.constantFrom('clubs', 'payments', 'distinguished') as fc.Arbitrary<
            'clubs' | 'payments' | 'distinguished'
          >,
          fc.integer({ min: 1, max: 5 }), // worldRank
          (rankings, metric, worldRank) => {
            const targetDistrict = rankings[0]
            if (!targetDistrict) return

            const totalDistricts = rankings.length

            const result = service.buildMetricRankings(
              targetDistrict.districtId,
              metric,
              worldRank,
              totalDistricts,
              rankings
            )

            // Verify all fields are populated correctly
            expect(result.worldRank).toBe(worldRank)
            expect(result.totalDistricts).toBe(totalDistricts)
            expect(result.region).toBe(targetDistrict.region)

            // World percentile should match calculated value
            const expectedPercentile = service.calculateWorldPercentile(
              worldRank,
              totalDistricts
            )
            expect(result.worldPercentile).toBe(expectedPercentile)

            // Region rank should be valid
            expect(result.regionRank).not.toBeNull()
            expect(result.totalInRegion).toBe(rankings.length)
          }
        ),
        { numRuns: 25 } // Optimized for CI/CD timeout compliance
      )
    })

    it('handles null world rank correctly', () => {
      fc.assert(
        fc.property(
          districtRankingsArb(['NullRankRegion'], 3),
          fc.constantFrom('clubs', 'payments', 'distinguished') as fc.Arbitrary<
            'clubs' | 'payments' | 'distinguished'
          >,
          (rankings, metric) => {
            const targetDistrict = rankings[0]
            if (!targetDistrict) return

            const result = service.buildMetricRankings(
              targetDistrict.districtId,
              metric,
              null, // null world rank
              rankings.length,
              rankings
            )

            // World rank and percentile should be null
            expect(result.worldRank).toBeNull()
            expect(result.worldPercentile).toBeNull()

            // Region rank should still be calculated
            expect(result.regionRank).not.toBeNull()
          }
        ),
        { numRuns: 25 } // Optimized for CI/CD timeout compliance
      )
    })
  })
})
