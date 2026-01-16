/**
 * RegionRankingService
 *
 * Derives region rankings from world rankings for district performance metrics.
 * Calculates region rank by filtering districts to the same region and computing
 * relative position. Also calculates world percentile for global comparison.
 *
 * Requirements:
 * - 4.1: Derive region rankings from existing world rankings data
 * - 4.2: Filter districts to same region for region rank calculation
 * - 4.3: Assign region rank based on position (1 = best in region)
 * - 4.4: Calculate region rank for each metric (clubs, payments, distinguished)
 * - 5.1: Calculate world percentile based on world rank and total districts
 * - 5.2: Use formula: ((totalDistricts - worldRank) / totalDistricts) × 100
 * - 5.3: Round percentile to one decimal place
 * - 5.4: Display as "Top X%" where X = 100 - percentile
 */

import type {
  IRegionRankingService,
  RegionRankData,
  MetricRankings,
  DistrictRanking,
} from '../types/analytics.js'

/**
 * Metric type for ranking calculations
 */
type RankingMetric = 'clubs' | 'payments' | 'distinguished'

/**
 * RegionRankingService implementation
 *
 * Provides region ranking and world percentile calculations for district
 * performance metrics. Region rankings are derived by filtering world
 * rankings to districts in the same region.
 */
export class RegionRankingService implements IRegionRankingService {
  /**
   * Calculate region rank by filtering world rankings to same region
   *
   * Region rank 1 = best in region. Districts are ranked by the specified
   * metric value in descending order (higher value = better rank).
   *
   * @param districtId - The district to calculate region rank for
   * @param metric - The metric to rank by ('clubs', 'payments', 'distinguished')
   * @param allDistrictRankings - Array of all district rankings data
   * @returns RegionRankData with region rank, total in region, and region name
   */
  calculateRegionRank(
    districtId: string,
    metric: RankingMetric,
    allDistrictRankings: DistrictRanking[]
  ): RegionRankData {
    // Find the target district
    const targetDistrict = allDistrictRankings.find(
      d => d.districtId === districtId
    )

    // If district not found or has no region (null or empty string), return null data
    if (
      !targetDistrict ||
      !targetDistrict.region ||
      targetDistrict.region.trim() === ''
    ) {
      return {
        regionRank: null,
        totalInRegion: 0,
        region: targetDistrict?.region || null,
      }
    }

    const region = targetDistrict.region

    // Filter districts to same region
    const regionalDistricts = allDistrictRankings.filter(
      d => d.region === region
    )

    // If no regional districts found (shouldn't happen), return null
    if (regionalDistricts.length === 0) {
      return {
        regionRank: null,
        totalInRegion: 0,
        region,
      }
    }

    // Get the world rank for the metric (used for region ranking)
    const getWorldRank = (district: DistrictRanking): number => {
      switch (metric) {
        case 'clubs':
          return district.clubsRank
        case 'payments':
          return district.paymentsRank
        case 'distinguished':
          return district.distinguishedRank
      }
    }

    // Sort regional districts by world rank (ascending - lower rank is better)
    const sortedRegionalDistricts = [...regionalDistricts].sort(
      (a, b) => getWorldRank(a) - getWorldRank(b)
    )

    // Calculate region rank based on position in sorted list
    // Districts with the same world rank get the same region rank
    const targetWorldRank = getWorldRank(targetDistrict)
    let rank = 1

    for (const district of sortedRegionalDistricts) {
      const worldRank = getWorldRank(district)
      if (worldRank < targetWorldRank) {
        rank++
      } else {
        // Found our position (or a tie at our position)
        break
      }
    }

    return {
      regionRank: rank,
      totalInRegion: regionalDistricts.length,
      region,
    }
  }

  /**
   * Calculate world percentile using formula:
   * ((totalDistricts - worldRank) / totalDistricts) × 100
   *
   * The result is rounded to one decimal place.
   * This represents the percentage of districts that the current district
   * outperforms worldwide.
   *
   * Display as "Top X%" where X = 100 - percentile
   * Example: Rank 10 of 100 districts
   *   - percentile = ((100 - 10) / 100) × 100 = 90%
   *   - displayValue = "Top 10%"
   *
   * @param worldRank - The district's world rank (1 = best)
   * @param totalDistricts - Total number of districts worldwide
   * @returns World percentile rounded to one decimal place
   */
  calculateWorldPercentile(worldRank: number, totalDistricts: number): number {
    // Handle edge cases
    if (totalDistricts <= 0 || worldRank <= 0) {
      return 0
    }

    // Handle case where rank exceeds total (shouldn't happen but be defensive)
    if (worldRank > totalDistricts) {
      return 0
    }

    // Calculate percentile: ((total - rank) / total) × 100
    const percentile = ((totalDistricts - worldRank) / totalDistricts) * 100

    // Round to one decimal place
    return Math.round(percentile * 10) / 10
  }

  /**
   * Build complete metric rankings including world rank, percentile, and region rank
   *
   * This is a convenience method that combines world ranking data with
   * calculated region rank and world percentile.
   *
   * @param districtId - The district to build rankings for
   * @param metric - The metric to rank by
   * @param worldRank - The district's world rank for this metric
   * @param totalDistricts - Total number of districts worldwide
   * @param allDistrictRankings - Array of all district rankings data
   * @returns Complete MetricRankings object
   */
  buildMetricRankings(
    districtId: string,
    metric: RankingMetric,
    worldRank: number | null,
    totalDistricts: number,
    allDistrictRankings: DistrictRanking[]
  ): MetricRankings {
    // Calculate region rank
    const regionData = this.calculateRegionRank(
      districtId,
      metric,
      allDistrictRankings
    )

    // Calculate world percentile (only if world rank is available)
    const worldPercentile =
      worldRank !== null && totalDistricts > 0
        ? this.calculateWorldPercentile(worldRank, totalDistricts)
        : null

    return {
      worldRank,
      worldPercentile,
      regionRank: regionData.regionRank,
      totalDistricts,
      totalInRegion: regionData.totalInRegion,
      region: regionData.region,
    }
  }
}
