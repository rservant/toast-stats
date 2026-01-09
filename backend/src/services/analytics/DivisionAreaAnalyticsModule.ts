/**
 * Division/Area Analytics Module
 *
 * Handles division and area performance analysis.
 * Extracted from AnalyticsEngine for improved maintainability and testability.
 *
 * Requirements: 1.4, 4.1, 4.2
 */

import type { IAnalyticsDataSource } from '../../types/serviceInterfaces.js'
import type { DivisionAnalytics, AreaAnalytics } from '../../types/analytics.js'
import type {
  DistrictCacheEntry,
  DistrictStatistics,
} from '../../types/districts.js'
import { parseIntSafe, ensureString } from './AnalyticsUtils.js'
import { logger } from '../../utils/logger.js'

/**
 * DivisionAreaAnalyticsModule
 *
 * Specialized module for division and area performance analytics.
 * Accepts dependencies via constructor injection for testability.
 *
 * Requirements: 1.4, 4.1, 4.2
 */
export class DivisionAreaAnalyticsModule {
  private readonly dataSource: IAnalyticsDataSource

  /**
   * Create a DivisionAreaAnalyticsModule instance
   *
   * Requirements: 4.1, 4.2
   *
   * @param dataSource - IAnalyticsDataSource for snapshot-based data retrieval
   */
  constructor(dataSource: IAnalyticsDataSource) {
    this.dataSource = dataSource
  }

  /**
   * Compare divisions for a specific date
   *
   * Returns division analytics with rankings based on DCP goals and club health.
   *
   * Requirements: 1.4
   *
   * @param districtId - The district ID to analyze
   * @param date - The date to get division data for (YYYY-MM-DD format)
   * @returns Array of DivisionAnalytics objects
   */
  async compareDivisions(
    districtId: string,
    date: string
  ): Promise<DivisionAnalytics[]> {
    try {
      const entry = await this.getDistrictDataForDate(districtId, date)

      if (!entry) {
        throw new Error(`No data found for district ${districtId} on ${date}`)
      }

      return this.analyzeDivisions([entry])
    } catch (error) {
      logger.error('Failed to compare divisions', { districtId, date, error })
      throw error
    }
  }

  /**
   * Analyze areas for a specific date
   *
   * Returns area analytics with normalized scores based on club health and DCP goals.
   *
   * Requirements: 1.4
   *
   * @param districtId - The district ID to analyze
   * @param date - The date to get area data for (YYYY-MM-DD format)
   * @returns Array of AreaAnalytics objects (top 10)
   */
  async analyzeAreasForDate(
    districtId: string,
    date: string
  ): Promise<AreaAnalytics[]> {
    try {
      const entry = await this.getDistrictDataForDate(districtId, date)

      if (!entry) {
        throw new Error(`No data found for district ${districtId} on ${date}`)
      }

      return this.analyzeAreas(entry)
    } catch (error) {
      logger.error('Failed to analyze areas', { districtId, date, error })
      throw error
    }
  }

  // ========== Division Analysis Methods ==========

  /**
   * Analyze divisions from data entries
   *
   * Division ranking is based on:
   * - Primary: Total DCP goals (descending)
   * - Secondary: Average club health (descending)
   *
   * Club health scoring:
   * - Critical (0 points): membership < 12
   * - At-risk (0.5 points): membership >= 12 AND dcpGoals = 0
   * - Healthy (1 point): membership >= 12 AND dcpGoals >= 1
   *
   * Average club health is the mean of these scores (0-1 scale)
   *
   * This method is exposed for use by AnalyticsEngine when generating
   * comprehensive district analytics.
   *
   * @param dataEntries - Array of district cache entries
   * @returns Array of DivisionAnalytics objects
   */
  analyzeDivisions(dataEntries: DistrictCacheEntry[]): DivisionAnalytics[] {
    const latestEntry = dataEntries[dataEntries.length - 1]
    if (!latestEntry) {
      return []
    }

    // Track division data with health scores
    const divisionMap = new Map<
      string,
      DivisionAnalytics & { healthScoreSum: number }
    >()

    // Aggregate data by division
    for (const club of latestEntry.clubPerformance) {
      const divisionId = ensureString(club['Division'])
      const divisionName = ensureString(club['Division Name']) || divisionId

      if (!divisionId) continue

      if (!divisionMap.has(divisionId)) {
        divisionMap.set(divisionId, {
          divisionId,
          divisionName,
          totalClubs: 0,
          totalDcpGoals: 0,
          averageClubHealth: 0,
          rank: 0,
          trend: 'stable',
          healthScoreSum: 0,
        })
      }

      const division = divisionMap.get(divisionId)!
      division.totalClubs++

      const dcpGoals = parseIntSafe(club['Goals Met'])
      division.totalDcpGoals += isNaN(dcpGoals) ? 0 : dcpGoals

      // Calculate club health score based on Requirements 3.1-3.4
      const membership = parseIntSafe(
        club['Active Members'] ||
          club['Active Membership'] ||
          club['Membership']
      )
      const clubHealthScore = this.calculateClubHealthScore(
        membership,
        dcpGoals
      )
      division.healthScoreSum += clubHealthScore
    }

    // Calculate average club health (0-1 scale based on health scores)
    for (const division of divisionMap.values()) {
      division.averageClubHealth =
        division.totalClubs > 0
          ? Math.round((division.healthScoreSum / division.totalClubs) * 100) /
            100
          : 0
    }

    // Rank divisions by total DCP goals (primary) and average club health (secondary)
    // Requirements 5.1: rank by total DCP goals and average club health
    const divisions = Array.from(divisionMap.values()).map(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ({ healthScoreSum, ...division }) => division
    )
    divisions.sort((a, b) => {
      // Primary sort: total DCP goals (descending)
      const dcpDiff = b.totalDcpGoals - a.totalDcpGoals
      if (dcpDiff !== 0) return dcpDiff
      // Secondary sort: average club health (descending)
      return b.averageClubHealth - a.averageClubHealth
    })
    divisions.forEach((div, index) => {
      div.rank = index + 1
    })

    // Detect trends (requires multiple data points)
    // Requirements 5.3: include trend indicators
    if (dataEntries.length >= 2) {
      this.detectDivisionTrends(divisions, dataEntries)
    }

    return divisions
  }

  /**
   * Calculate club health score based on membership and DCP goals
   *
   * Requirements: 3.1, 3.2, 3.3, 3.4
   * - Critical (0 points): membership < 12
   * - At-risk (0.5 points): membership >= 12 AND dcpGoals = 0
   * - Healthy (1 point): membership >= 12 AND dcpGoals >= 1
   *
   * @param membership - Club membership count
   * @param dcpGoals - Number of DCP goals achieved
   * @returns Health score (0, 0.5, or 1)
   */
  private calculateClubHealthScore(
    membership: number,
    dcpGoals: number
  ): number {
    if (membership < 12) {
      // Critical: 0 points
      return 0
    } else if (dcpGoals === 0) {
      // At-risk: 0.5 points
      return 0.5
    } else {
      // Healthy: 1 point
      return 1
    }
  }

  /**
   * Detect division trends by comparing current to previous period
   *
   * Trend classification:
   * - Improving: current DCP goals > previous * 1.1 (10% increase)
   * - Declining: current DCP goals < previous * 0.9 (10% decrease)
   * - Stable: within 10% of previous
   *
   * @param divisions - Array of division analytics to update
   * @param dataEntries - Array of district cache entries for trend analysis
   */
  detectDivisionTrends(
    divisions: DivisionAnalytics[],
    dataEntries: DistrictCacheEntry[]
  ): void {
    // Compare current to previous period
    if (dataEntries.length < 2) return

    const previousEntry = dataEntries[dataEntries.length - 2]
    if (!previousEntry) return

    for (const division of divisions) {
      const previousDcpGoals = this.getDivisionDcpGoals(
        previousEntry,
        division.divisionId
      )
      const currentDcpGoals = division.totalDcpGoals

      if (currentDcpGoals > previousDcpGoals * 1.1) {
        division.trend = 'improving'
      } else if (currentDcpGoals < previousDcpGoals * 0.9) {
        division.trend = 'declining'
      } else {
        division.trend = 'stable'
      }
    }
  }

  /**
   * Get division DCP goals from an entry
   *
   * @param entry - District cache entry
   * @param divisionId - Division ID to get goals for
   * @returns Total DCP goals for the division
   */
  getDivisionDcpGoals(entry: DistrictCacheEntry, divisionId: string): number {
    return entry.clubPerformance
      .filter(club => club['Division'] === divisionId)
      .reduce((sum, club) => {
        const dcpGoals = parseIntSafe(club['Goals Met'])
        return sum + (isNaN(dcpGoals) ? 0 : dcpGoals)
      }, 0)
  }

  /**
   * Get total DCP goals from an entry
   *
   * @param entry - District cache entry
   * @returns Total DCP goals for all clubs in the entry
   */
  getTotalDcpGoals(entry: DistrictCacheEntry): number {
    return entry.clubPerformance.reduce((sum, club) => {
      const dcpGoals = parseIntSafe(club['Goals Met'])
      return sum + (isNaN(dcpGoals) ? 0 : dcpGoals)
    }, 0)
  }

  // ========== Area Analysis Methods ==========

  /**
   * Analyze areas from a district cache entry
   *
   * Requirements: 5.2
   * - Identify top-performing areas with normalized scores
   *
   * Normalized score combines:
   * - Average club health (0-1 scale based on Requirements 3.1-3.4)
   * - DCP goals per club (normalized to 0-1 scale, max 10 goals = 1.0)
   *
   * Final score = (averageClubHealth * 0.5) + (normalizedDcpGoals * 0.5)
   *
   * This method is exposed for use by AnalyticsEngine when generating
   * comprehensive district analytics.
   *
   * @param entry - District cache entry
   * @returns Array of AreaAnalytics objects (top 10)
   */
  analyzeAreas(entry: DistrictCacheEntry): AreaAnalytics[] {
    // Track area data with health scores
    const areaMap = new Map<
      string,
      AreaAnalytics & { healthScoreSum: number }
    >()

    for (const club of entry.clubPerformance) {
      const areaId = ensureString(club['Area'])
      const areaName = ensureString(club['Area Name']) || areaId
      const divisionId = ensureString(club['Division'])

      if (!areaId) continue

      if (!areaMap.has(areaId)) {
        areaMap.set(areaId, {
          areaId,
          areaName,
          divisionId,
          totalClubs: 0,
          averageClubHealth: 0,
          totalDcpGoals: 0,
          normalizedScore: 0,
          healthScoreSum: 0,
        })
      }

      const area = areaMap.get(areaId)!
      area.totalClubs++

      const dcpGoals = parseIntSafe(club['Goals Met'])
      area.totalDcpGoals += isNaN(dcpGoals) ? 0 : dcpGoals

      // Calculate club health score based on Requirements 3.1-3.4
      const membership = parseIntSafe(
        club['Active Members'] ||
          club['Active Membership'] ||
          club['Membership']
      )
      const clubHealthScore = this.calculateClubHealthScore(
        membership,
        dcpGoals
      )
      area.healthScoreSum += clubHealthScore
    }

    // Calculate normalized scores
    const areas = Array.from(areaMap.values()).map(
      ({ healthScoreSum, ...area }) => {
        // Calculate average club health (0-1 scale)
        const avgHealth =
          area.totalClubs > 0 ? healthScoreSum / area.totalClubs : 0

        // Calculate normalized DCP goals (0-1 scale, max 10 goals per club = 1.0)
        const avgDcpGoals =
          area.totalClubs > 0 ? area.totalDcpGoals / area.totalClubs : 0
        const normalizedDcpGoals = Math.min(avgDcpGoals / 10, 1)

        // Combined normalized score (50% health, 50% DCP goals)
        const normalizedScore =
          Math.round((avgHealth * 0.5 + normalizedDcpGoals * 0.5) * 100) / 100

        return {
          ...area,
          averageClubHealth: Math.round(avgHealth * 100) / 100,
          normalizedScore,
        }
      }
    )

    // Sort by normalized score (descending)
    areas.sort((a, b) => b.normalizedScore - a.normalizedScore)

    return areas.slice(0, 10) // Return top 10 areas
  }

  // ========== Data Loading Methods ==========

  /**
   * Map DistrictStatistics to DistrictCacheEntry format for compatibility
   */
  private mapDistrictStatisticsToEntry(
    stats: DistrictStatistics,
    snapshotDate: string
  ): DistrictCacheEntry {
    return {
      districtId: stats.districtId,
      date: snapshotDate,
      districtPerformance: stats.districtPerformance ?? [],
      divisionPerformance: stats.divisionPerformance ?? [],
      clubPerformance: stats.clubPerformance ?? [],
      fetchedAt: stats.asOfDate,
    }
  }

  /**
   * Get district data for a specific date
   *
   * @param districtId - The district ID to load data for
   * @param date - The specific date to get data for (YYYY-MM-DD format)
   * @returns DistrictCacheEntry or null if not found
   */
  private async getDistrictDataForDate(
    districtId: string,
    date: string
  ): Promise<DistrictCacheEntry | null> {
    try {
      const districtData = await this.dataSource.getDistrictData(
        date,
        districtId
      )

      if (!districtData) {
        return null
      }

      return this.mapDistrictStatisticsToEntry(districtData, date)
    } catch (error) {
      logger.warn('Failed to get district data for date', {
        districtId,
        date,
        error,
      })
      return null
    }
  }
}
