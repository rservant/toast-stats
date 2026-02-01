/**
 * Division/Area Analytics Module
 *
 * Handles division and area performance analysis.
 * Moved from backend AnalyticsEngine for shared use in analytics-core.
 * Preserves all hardened computation logic from the backend version.
 *
 * Requirements: 4.1, 7.5
 */

import type { DistrictStatistics } from '../interfaces.js'
import type {
  DivisionRanking,
  AreaPerformance,
  DivisionAnalytics,
  AreaAnalytics,
} from '../types.js'

/**
 * DivisionAreaAnalyticsModule
 *
 * Specialized module for division and area performance analytics.
 * Works directly with DistrictStatistics data without external dependencies.
 * Stateless module - all methods accept data as parameters.
 *
 * Requirements: 4.1, 7.5
 */
export class DivisionAreaAnalyticsModule {
  // ========== Public API Methods ==========

  /**
   * Generate division rankings from snapshots
   *
   * Division ranking is based on:
   * - Primary: Total DCP goals (descending)
   * - Secondary: Average club health (descending)
   *
   * @param snapshots - Array of district statistics snapshots (sorted by date ascending)
   * @returns Array of DivisionRanking objects
   */
  generateDivisionRankings(snapshots: DistrictStatistics[]): DivisionRanking[] {
    if (snapshots.length === 0) {
      return []
    }

    const latestSnapshot = snapshots[snapshots.length - 1]
    if (!latestSnapshot) {
      return []
    }

    return this.analyzeDivisionsForRankings(latestSnapshot)
  }

  /**
   * Generate top performing areas from snapshots
   *
   * @param snapshots - Array of district statistics snapshots (sorted by date ascending)
   * @param limit - Maximum number of areas to return (default: 10)
   * @returns Array of AreaPerformance objects
   */
  generateTopPerformingAreas(
    snapshots: DistrictStatistics[],
    limit = 10
  ): AreaPerformance[] {
    if (snapshots.length === 0) {
      return []
    }

    const latestSnapshot = snapshots[snapshots.length - 1]
    if (!latestSnapshot) {
      return []
    }

    return this.analyzeAreasForPerformance(latestSnapshot, limit)
  }

  /**
   * Compare divisions for a specific snapshot
   *
   * Returns division analytics with rankings based on DCP goals and club health.
   * This is the hardened backend logic adapted for analytics-core.
   *
   * Requirements: 4.1
   *
   * @param snapshots - Array of district statistics snapshots (sorted by date ascending)
   * @returns Array of DivisionAnalytics objects
   */
  compareDivisions(snapshots: DistrictStatistics[]): DivisionAnalytics[] {
    if (snapshots.length === 0) {
      return []
    }

    return this.analyzeDivisions(snapshots)
  }

  /**
   * Analyze areas for a specific snapshot
   *
   * Returns area analytics with normalized scores based on club health and DCP goals.
   *
   * Requirements: 4.1
   *
   * @param snapshots - Array of district statistics snapshots (sorted by date ascending)
   * @param limit - Maximum number of areas to return (default: 10)
   * @returns Array of AreaAnalytics objects
   */
  analyzeAreasForSnapshot(
    snapshots: DistrictStatistics[],
    limit = 10
  ): AreaAnalytics[] {
    if (snapshots.length === 0) {
      return []
    }

    const latestSnapshot = snapshots[snapshots.length - 1]
    if (!latestSnapshot) {
      return []
    }

    return this.analyzeAreas(latestSnapshot, limit)
  }

  // ========== Division Analysis Methods (Hardened Backend Logic) ==========

  /**
   * Analyze divisions from snapshots
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
   * @param snapshots - Array of district statistics snapshots
   * @returns Array of DivisionAnalytics objects
   */
  analyzeDivisions(snapshots: DistrictStatistics[]): DivisionAnalytics[] {
    const latestSnapshot = snapshots[snapshots.length - 1]
    if (!latestSnapshot) {
      return []
    }

    // Track division data with health scores
    const divisionMap = new Map<
      string,
      DivisionAnalytics & { healthScoreSum: number }
    >()

    // Aggregate data by division
    for (const club of latestSnapshot.clubs) {
      const divisionId = club.divisionId
      const divisionName = club.divisionName || divisionId

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

      const dcpGoals = club.dcpGoals
      division.totalDcpGoals += isNaN(dcpGoals) ? 0 : dcpGoals

      // Calculate club health score based on Requirements 3.1-3.4
      const membership = club.membershipCount
      const clubHealthScore = this.calculateClubHealthScore(membership, dcpGoals)
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
    if (snapshots.length >= 2) {
      this.detectDivisionTrends(divisions, snapshots)
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
   * @param snapshots - Array of district statistics snapshots for trend analysis
   */
  detectDivisionTrends(
    divisions: DivisionAnalytics[],
    snapshots: DistrictStatistics[]
  ): void {
    // Compare current to previous period
    if (snapshots.length < 2) return

    const previousSnapshot = snapshots[snapshots.length - 2]
    if (!previousSnapshot) return

    for (const division of divisions) {
      const previousDcpGoals = this.getDivisionDcpGoals(
        previousSnapshot,
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
   * Get division DCP goals from a snapshot
   *
   * @param snapshot - District statistics snapshot
   * @param divisionId - Division ID to get goals for
   * @returns Total DCP goals for the division
   */
  getDivisionDcpGoals(snapshot: DistrictStatistics, divisionId: string): number {
    return snapshot.clubs
      .filter(club => club.divisionId === divisionId)
      .reduce((sum, club) => {
        const dcpGoals = club.dcpGoals
        return sum + (isNaN(dcpGoals) ? 0 : dcpGoals)
      }, 0)
  }

  /**
   * Get total DCP goals from a snapshot
   *
   * @param snapshot - District statistics snapshot
   * @returns Total DCP goals for all clubs in the snapshot
   */
  getTotalDcpGoals(snapshot: DistrictStatistics): number {
    return snapshot.clubs.reduce((sum, club) => {
      const dcpGoals = club.dcpGoals
      return sum + (isNaN(dcpGoals) ? 0 : dcpGoals)
    }, 0)
  }

  // ========== Area Analysis Methods (Hardened Backend Logic) ==========

  /**
   * Analyze areas from a district statistics snapshot
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
   * @param snapshot - District statistics snapshot
   * @param limit - Maximum number of areas to return (default: 10)
   * @returns Array of AreaAnalytics objects
   */
  analyzeAreas(snapshot: DistrictStatistics, limit = 10): AreaAnalytics[] {
    // Track area data with health scores
    const areaMap = new Map<
      string,
      AreaAnalytics & { healthScoreSum: number }
    >()

    for (const club of snapshot.clubs) {
      const areaId = club.areaId
      const areaName = club.areaName || areaId
      const divisionId = club.divisionId

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

      const dcpGoals = club.dcpGoals
      area.totalDcpGoals += isNaN(dcpGoals) ? 0 : dcpGoals

      // Calculate club health score based on Requirements 3.1-3.4
      const membership = club.membershipCount
      const clubHealthScore = this.calculateClubHealthScore(membership, dcpGoals)
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

    return areas.slice(0, limit)
  }

  // ========== Legacy API Methods (for DivisionRanking/AreaPerformance types) ==========

  /**
   * Analyze divisions from a snapshot for DivisionRanking output
   * (Legacy method for backward compatibility with existing code)
   */
  private analyzeDivisionsForRankings(
    snapshot: DistrictStatistics
  ): DivisionRanking[] {
    // Track division data
    const divisionMap = new Map<
      string,
      {
        divisionId: string
        divisionName: string
        clubCount: number
        membershipTotal: number
        totalDcpGoals: number
        healthScoreSum: number
      }
    >()

    // Aggregate data by division
    for (const club of snapshot.clubs) {
      const divisionId = club.divisionId
      if (!divisionId) continue

      if (!divisionMap.has(divisionId)) {
        divisionMap.set(divisionId, {
          divisionId,
          divisionName: club.divisionName || divisionId,
          clubCount: 0,
          membershipTotal: 0,
          totalDcpGoals: 0,
          healthScoreSum: 0,
        })
      }

      const division = divisionMap.get(divisionId)!
      division.clubCount++
      division.membershipTotal += club.membershipCount
      division.totalDcpGoals += club.dcpGoals

      // Calculate club health score
      const healthScore = this.calculateClubHealthScore(
        club.membershipCount,
        club.dcpGoals
      )
      division.healthScoreSum += healthScore
    }

    // Convert to rankings
    const divisions: DivisionRanking[] = Array.from(divisionMap.values()).map(
      div => {
        // Calculate score based on DCP goals and health
        const avgHealth =
          div.clubCount > 0 ? div.healthScoreSum / div.clubCount : 0
        const score = div.totalDcpGoals + avgHealth * 10 // Weight health score

        return {
          divisionId: div.divisionId,
          divisionName: div.divisionName,
          rank: 0, // Will be set after sorting
          score: Math.round(score * 100) / 100,
          clubCount: div.clubCount,
          membershipTotal: div.membershipTotal,
        }
      }
    )

    // Sort by score (descending) and assign ranks
    divisions.sort((a, b) => b.score - a.score)
    divisions.forEach((div, index) => {
      div.rank = index + 1
    })

    return divisions
  }

  /**
   * Analyze areas from a snapshot for AreaPerformance output
   * (Legacy method for backward compatibility with existing code)
   *
   * Normalized score combines:
   * - Average club health (0-1 scale)
   * - DCP goals per club (normalized to 0-1 scale, max 10 goals = 1.0)
   *
   * Final score = (averageClubHealth * 0.5) + (normalizedDcpGoals * 0.5)
   */
  private analyzeAreasForPerformance(
    snapshot: DistrictStatistics,
    limit: number
  ): AreaPerformance[] {
    // Track area data
    const areaMap = new Map<
      string,
      {
        areaId: string
        areaName: string
        divisionId: string
        clubCount: number
        membershipTotal: number
        totalDcpGoals: number
        healthScoreSum: number
      }
    >()

    for (const club of snapshot.clubs) {
      const areaId = club.areaId
      if (!areaId) continue

      if (!areaMap.has(areaId)) {
        areaMap.set(areaId, {
          areaId,
          areaName: club.areaName || areaId,
          divisionId: club.divisionId,
          clubCount: 0,
          membershipTotal: 0,
          totalDcpGoals: 0,
          healthScoreSum: 0,
        })
      }

      const area = areaMap.get(areaId)!
      area.clubCount++
      area.membershipTotal += club.membershipCount
      area.totalDcpGoals += club.dcpGoals

      // Calculate club health score
      const healthScore = this.calculateClubHealthScore(
        club.membershipCount,
        club.dcpGoals
      )
      area.healthScoreSum += healthScore
    }

    // Calculate normalized scores
    const areas: AreaPerformance[] = Array.from(areaMap.values()).map(area => {
      // Calculate average club health (0-1 scale)
      const avgHealth =
        area.clubCount > 0 ? area.healthScoreSum / area.clubCount : 0

      // Calculate normalized DCP goals (0-1 scale, max 10 goals per club = 1.0)
      const avgDcpGoals =
        area.clubCount > 0 ? area.totalDcpGoals / area.clubCount : 0
      const normalizedDcpGoals = Math.min(avgDcpGoals / 10, 1)

      // Combined normalized score (50% health, 50% DCP goals)
      const score =
        Math.round((avgHealth * 0.5 + normalizedDcpGoals * 0.5) * 100) / 100

      return {
        areaId: area.areaId,
        areaName: area.areaName,
        divisionId: area.divisionId,
        score,
        clubCount: area.clubCount,
        membershipTotal: area.membershipTotal,
      }
    })

    // Sort by score (descending) and return top N
    areas.sort((a, b) => b.score - a.score)

    return areas.slice(0, limit)
  }
}
