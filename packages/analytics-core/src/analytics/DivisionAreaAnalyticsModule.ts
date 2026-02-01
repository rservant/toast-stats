/**
 * Division/Area Analytics Module
 *
 * Handles division and area performance analysis.
 * Extracted from backend AnalyticsEngine for shared use in analytics-core.
 *
 * Requirements: 7.5
 */

import type { DistrictStatistics } from '../interfaces.js'
import type { DivisionRanking, AreaPerformance } from '../types.js'

/**
 * DivisionAreaAnalyticsModule
 *
 * Specialized module for division and area performance analytics.
 * Works directly with DistrictStatistics data without external dependencies.
 *
 * Requirements: 7.5
 */
export class DivisionAreaAnalyticsModule {
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

    return this.analyzeDivisions(latestSnapshot)
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

    return this.analyzeAreas(latestSnapshot, limit)
  }

  // ========== Private Helper Methods ==========

  /**
   * Analyze divisions from a snapshot
   */
  private analyzeDivisions(snapshot: DistrictStatistics): DivisionRanking[] {
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
          divisionName: divisionId, // Use ID as name if not available
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
   * Analyze areas from a snapshot
   *
   * Normalized score combines:
   * - Average club health (0-1 scale)
   * - DCP goals per club (normalized to 0-1 scale, max 10 goals = 1.0)
   *
   * Final score = (averageClubHealth * 0.5) + (normalizedDcpGoals * 0.5)
   */
  private analyzeAreas(
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
          areaName: areaId, // Use ID as name if not available
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

  /**
   * Calculate club health score based on membership and DCP goals
   *
   * - Critical (0 points): membership < 12
   * - At-risk (0.5 points): membership >= 12 AND dcpGoals = 0
   * - Healthy (1 point): membership >= 12 AND dcpGoals >= 1
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
}
