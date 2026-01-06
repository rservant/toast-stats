/**
 * RankingCalculator service for computing district rankings using Borda count system
 *
 * This service implements the sophisticated Borda count ranking algorithm that was
 * previously part of the legacy cache system. It calculates rankings across three
 * categories: club growth, payment growth, and distinguished club percentages.
 */

import { logger } from '../utils/logger.js'
import type {
  DistrictStatistics,
  AllDistrictsCSVRecord,
  DistrictRankingData,
} from '../types/districts.js'

/**
 * Data structure for district ranking information
 */
export interface RankingCalculator {
  /**
   * Calculate rankings for all districts using Borda count system
   */
  calculateRankings(
    districts: DistrictStatistics[]
  ): Promise<DistrictStatistics[]>

  /**
   * Get the current ranking algorithm version
   */
  getRankingVersion(): string
}

/**
 * Internal structure for ranking metrics extraction
 */
interface RankingMetrics {
  districtId: string
  districtName: string
  region: string
  clubGrowthPercent: number
  paymentGrowthPercent: number
  distinguishedPercent: number
  paidClubs: number
  paidClubBase: number
  totalPayments: number
  paymentBase: number
  distinguishedClubs: number
  activeClubs: number
  selectDistinguished: number
  presidentsDistinguished: number
}

/**
 * Category ranking result
 */
interface CategoryRanking {
  districtId: string
  rank: number
  bordaPoints: number
  value: number
}

/**
 * Aggregate ranking result
 */
interface AggregateRanking {
  districtId: string
  clubsRank: number
  paymentsRank: number
  distinguishedRank: number
  aggregateScore: number
}

/**
 * Borda Count Ranking Calculator implementation
 *
 * Implements the sophisticated ranking system using Borda count scoring:
 * - Ranks districts in three categories: club growth, payment growth, distinguished percentage
 * - Handles ties by assigning the same rank to districts with equal values
 * - Calculates Borda points: (total districts - rank + 1)
 * - Sums Borda points across categories for aggregate score
 * - Orders districts by aggregate score (highest first)
 */
export class BordaCountRankingCalculator implements RankingCalculator {
  private readonly RANKING_VERSION = '2.0'

  /**
   * Calculate rankings for all districts using Borda count system
   */
  async calculateRankings(
    districts: DistrictStatistics[]
  ): Promise<DistrictStatistics[]> {
    const startTime = Date.now()
    const calculatedAt = new Date().toISOString()

    logger.info('Starting Borda count ranking calculation', {
      operation: 'calculateRankings',
      districtCount: districts.length,
      rankingVersion: this.RANKING_VERSION,
      calculatedAt,
    })

    try {
      if (districts.length === 0) {
        logger.warn('No districts provided for ranking calculation')
        return districts
      }

      // Step 1: Extract ranking metrics from district data
      const metrics = this.extractRankingMetrics(districts)
      logger.debug('Extracted ranking metrics', {
        operation: 'calculateRankings',
        metricsCount: metrics.length,
      })

      // Step 2: Calculate category rankings
      const clubRankings = this.calculateCategoryRanking(
        metrics,
        'clubGrowthPercent',
        'clubs'
      )
      const paymentRankings = this.calculateCategoryRanking(
        metrics,
        'paymentGrowthPercent',
        'payments'
      )
      const distinguishedRankings = this.calculateCategoryRanking(
        metrics,
        'distinguishedPercent',
        'distinguished'
      )

      logger.debug('Calculated category rankings', {
        operation: 'calculateRankings',
        clubRankings: clubRankings.length,
        paymentRankings: paymentRankings.length,
        distinguishedRankings: distinguishedRankings.length,
      })

      // Step 3: Calculate aggregate rankings
      const aggregateRankings = this.calculateAggregateRankings(
        clubRankings,
        paymentRankings,
        distinguishedRankings
      )

      logger.debug('Calculated aggregate rankings', {
        operation: 'calculateRankings',
        aggregateRankings: aggregateRankings.length,
      })

      // Step 4: Apply rankings to district data
      const rankedDistricts = this.applyRankingsToDistricts(
        districts,
        metrics,
        aggregateRankings,
        calculatedAt
      )

      // Step 5: Sort districts by aggregate score (highest first)
      const sortedDistricts = rankedDistricts.sort((a, b) => {
        const scoreA = a.ranking?.aggregateScore || 0
        const scoreB = b.ranking?.aggregateScore || 0
        return scoreB - scoreA
      })

      const duration = Date.now() - startTime
      logger.info('Completed Borda count ranking calculation', {
        operation: 'calculateRankings',
        districtCount: sortedDistricts.length,
        rankingVersion: this.RANKING_VERSION,
        durationMs: duration,
        calculatedAt,
      })

      return sortedDistricts
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      const duration = Date.now() - startTime

      logger.error('Ranking calculation failed', {
        operation: 'calculateRankings',
        error: errorMessage,
        districtCount: districts.length,
        durationMs: duration,
      })

      // Return original districts without ranking data on failure
      return districts
    }
  }

  /**
   * Get the current ranking algorithm version
   */
  getRankingVersion(): string {
    return this.RANKING_VERSION
  }

  /**
   * Extract ranking metrics from district statistics
   */
  private extractRankingMetrics(
    districts: DistrictStatistics[]
  ): RankingMetrics[] {
    const metrics: RankingMetrics[] = []

    for (const district of districts) {
      try {
        // Extract metrics from the raw district performance data
        const districtPerformance = district
          .districtPerformance?.[0] as AllDistrictsCSVRecord

        if (!districtPerformance) {
          logger.warn('No district performance data found', {
            districtId: district.districtId,
            operation: 'extractRankingMetrics',
          })
          continue
        }

        const metric: RankingMetrics = {
          districtId: district.districtId,
          districtName: districtPerformance.DISTRICT || district.districtId,
          region: districtPerformance.REGION || 'Unknown',
          clubGrowthPercent: this.parsePercentage(
            districtPerformance['% Club Growth']
          ),
          paymentGrowthPercent: this.parsePercentage(
            districtPerformance['% Payment Growth']
          ),
          distinguishedPercent:
            this.calculateDistinguishedPercent(districtPerformance),
          paidClubs: this.parseNumber(districtPerformance['Paid Clubs']),
          paidClubBase: this.parseNumber(districtPerformance['Paid Club Base']),
          totalPayments: this.parseNumber(
            districtPerformance['Total YTD Payments']
          ),
          paymentBase: this.parseNumber(districtPerformance['Payment Base']),
          distinguishedClubs: this.parseNumber(
            districtPerformance['Total Distinguished Clubs']
          ),
          activeClubs: this.parseNumber(districtPerformance['Active Clubs']),
          selectDistinguished: this.parseNumber(
            districtPerformance['Select Distinguished Clubs']
          ),
          presidentsDistinguished: this.parseNumber(
            districtPerformance['Presidents Distinguished Clubs']
          ),
        }

        metrics.push(metric)
      } catch (error) {
        logger.warn('Failed to extract metrics for district', {
          districtId: district.districtId,
          error: error instanceof Error ? error.message : 'Unknown error',
          operation: 'extractRankingMetrics',
        })
      }
    }

    return metrics
  }

  /**
   * Calculate distinguished club percentage from raw data
   */
  private calculateDistinguishedPercent(data: AllDistrictsCSVRecord): number {
    const distinguishedClubs = this.parseNumber(
      data['Total Distinguished Clubs']
    )
    const activeClubs = this.parseNumber(data['Active Clubs'])

    if (activeClubs === 0) {
      return 0
    }

    return (distinguishedClubs / activeClubs) * 100
  }

  /**
   * Calculate ranking for a single category
   */
  private calculateCategoryRanking(
    metrics: RankingMetrics[],
    valueField: keyof RankingMetrics,
    category: string
  ): CategoryRanking[] {
    // Sort districts by value (highest first)
    const sortedMetrics = [...metrics].sort((a, b) => {
      const aValue = a[valueField] as number
      const bValue = b[valueField] as number
      return bValue - aValue
    })

    const rankings: CategoryRanking[] = []
    let currentRank = 1

    for (let i = 0; i < sortedMetrics.length; i++) {
      const metric = sortedMetrics[i]
      const value = metric[valueField] as number

      // Handle ties: if current value equals previous value, use same rank
      if (i > 0) {
        const previousValue = sortedMetrics[i - 1][valueField] as number
        if (value !== previousValue) {
          currentRank = i + 1
        }
      }

      // Calculate Borda points: total districts - rank + 1
      const bordaPoints = metrics.length - currentRank + 1

      rankings.push({
        districtId: metric.districtId,
        rank: currentRank,
        bordaPoints,
        value,
      })
    }

    logger.debug('Calculated category ranking', {
      category,
      totalDistricts: metrics.length,
      uniqueRanks: new Set(rankings.map(r => r.rank)).size,
      operation: 'calculateCategoryRanking',
    })

    return rankings
  }

  /**
   * Calculate aggregate rankings by summing Borda points across categories
   */
  private calculateAggregateRankings(
    clubRankings: CategoryRanking[],
    paymentRankings: CategoryRanking[],
    distinguishedRankings: CategoryRanking[]
  ): AggregateRanking[] {
    const aggregateMap = new Map<string, AggregateRanking>()

    // Initialize aggregate rankings
    for (const ranking of clubRankings) {
      aggregateMap.set(ranking.districtId, {
        districtId: ranking.districtId,
        clubsRank: ranking.rank,
        paymentsRank: 0,
        distinguishedRank: 0,
        aggregateScore: ranking.bordaPoints,
      })
    }

    // Add payment rankings
    for (const ranking of paymentRankings) {
      const aggregate = aggregateMap.get(ranking.districtId)
      if (aggregate) {
        aggregate.paymentsRank = ranking.rank
        aggregate.aggregateScore += ranking.bordaPoints
      }
    }

    // Add distinguished rankings
    for (const ranking of distinguishedRankings) {
      const aggregate = aggregateMap.get(ranking.districtId)
      if (aggregate) {
        aggregate.distinguishedRank = ranking.rank
        aggregate.aggregateScore += ranking.bordaPoints
      }
    }

    // Sort by aggregate score (highest first)
    const sortedAggregates = Array.from(aggregateMap.values()).sort(
      (a, b) => b.aggregateScore - a.aggregateScore
    )

    logger.debug('Calculated aggregate rankings', {
      totalDistricts: sortedAggregates.length,
      highestScore: sortedAggregates[0]?.aggregateScore || 0,
      lowestScore:
        sortedAggregates[sortedAggregates.length - 1]?.aggregateScore || 0,
      operation: 'calculateAggregateRankings',
    })

    return sortedAggregates
  }

  /**
   * Apply calculated rankings to district statistics
   */
  private applyRankingsToDistricts(
    districts: DistrictStatistics[],
    metrics: RankingMetrics[],
    aggregateRankings: AggregateRanking[],
    calculatedAt: string
  ): DistrictStatistics[] {
    const metricsMap = new Map(metrics.map(m => [m.districtId, m]))
    const rankingsMap = new Map(aggregateRankings.map(r => [r.districtId, r]))

    return districts.map(district => {
      const metric = metricsMap.get(district.districtId)
      const ranking = rankingsMap.get(district.districtId)

      if (!metric || !ranking) {
        // Return district without ranking data if metrics/rankings are missing
        logger.warn('Missing metrics or rankings for district', {
          districtId: district.districtId,
          hasMetric: !!metric,
          hasRanking: !!ranking,
          operation: 'applyRankingsToDistricts',
        })
        return district
      }

      const rankingData: DistrictRankingData = {
        clubsRank: ranking.clubsRank,
        paymentsRank: ranking.paymentsRank,
        distinguishedRank: ranking.distinguishedRank,
        aggregateScore: ranking.aggregateScore,
        clubGrowthPercent: metric.clubGrowthPercent,
        paymentGrowthPercent: metric.paymentGrowthPercent,
        distinguishedPercent: metric.distinguishedPercent,
        paidClubBase: metric.paidClubBase,
        paymentBase: metric.paymentBase,
        paidClubs: metric.paidClubs,
        totalPayments: metric.totalPayments,
        distinguishedClubs: metric.distinguishedClubs,
        activeClubs: metric.activeClubs,
        selectDistinguished: metric.selectDistinguished,
        presidentsDistinguished: metric.presidentsDistinguished,
        region: metric.region,
        districtName: metric.districtName,
        rankingVersion: this.RANKING_VERSION,
        calculatedAt,
      }

      return {
        ...district,
        ranking: rankingData,
      }
    })
  }

  /**
   * Parse percentage string to number
   */
  private parsePercentage(value: string | number | null | undefined): number {
    if (typeof value === 'number') {
      return value
    }

    if (typeof value === 'string') {
      // Remove % sign and parse as float
      const cleaned = value.replace('%', '').trim()
      const parsed = parseFloat(cleaned)
      return isNaN(parsed) ? 0 : parsed
    }

    return 0
  }

  /**
   * Parse number from various input types
   */
  private parseNumber(value: string | number | null | undefined): number {
    if (typeof value === 'number') {
      return value
    }

    if (typeof value === 'string') {
      // Remove commas and parse as integer
      const cleaned = value.replace(/,/g, '').trim()
      const parsed = parseInt(cleaned, 10)
      return isNaN(parsed) ? 0 : parsed
    }

    return 0
  }
}
