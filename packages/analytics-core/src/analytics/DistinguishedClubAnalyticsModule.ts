/**
 * Distinguished Club Analytics Module
 *
 * Handles DCP goals analysis, distinguished club projections, and achievement tracking.
 * Extracted from backend AnalyticsEngine for shared use in analytics-core.
 *
 * Requirements: 7.4
 */

import type { DistrictStatistics, ClubStatistics } from '../interfaces.js'
import type {
  DistinguishedProjection,
  DistinguishedClubSummary,
} from '../types.js'

/**
 * Distinguished club status type
 */
type DistinguishedStatus = 'distinguished' | 'select' | 'president' | 'none'

/**
 * DistinguishedClubAnalyticsModule
 *
 * Specialized module for distinguished club analytics calculations.
 * Works directly with DistrictStatistics data without external dependencies.
 *
 * Requirements: 7.4
 */
export class DistinguishedClubAnalyticsModule {
  /**
   * Generate distinguished club summaries from snapshots
   *
   * @param snapshots - Array of district statistics snapshots (sorted by date ascending)
   * @returns Array of DistinguishedClubSummary objects
   */
  generateDistinguishedClubSummaries(
    snapshots: DistrictStatistics[]
  ): DistinguishedClubSummary[] {
    if (snapshots.length === 0) {
      return []
    }

    const latestSnapshot = snapshots[snapshots.length - 1]
    if (!latestSnapshot) {
      return []
    }

    const summaries: DistinguishedClubSummary[] = []

    for (const club of latestSnapshot.clubs) {
      const status = this.determineDistinguishedStatus(club)

      // Only include clubs that have achieved some distinguished status
      if (status !== 'none') {
        summaries.push({
          clubId: club.clubId,
          clubName: club.clubName,
          status,
          dcpPoints: club.dcpGoals,
          goalsCompleted: club.dcpGoals,
        })
      }
    }

    // Sort by status (president > select > distinguished) then by goals
    const statusOrder: Record<DistinguishedStatus, number> = {
      president: 3,
      select: 2,
      distinguished: 1,
      none: 0,
    }

    summaries.sort((a, b) => {
      const statusDiff = statusOrder[b.status] - statusOrder[a.status]
      if (statusDiff !== 0) return statusDiff
      return b.goalsCompleted - a.goalsCompleted
    })

    return summaries
  }

  /**
   * Generate distinguished club projection based on trends
   *
   * @param snapshots - Array of district statistics snapshots (sorted by date ascending)
   * @returns DistinguishedProjection object
   */
  generateDistinguishedProjection(
    snapshots: DistrictStatistics[]
  ): DistinguishedProjection {
    if (snapshots.length === 0) {
      return this.createEmptyProjection()
    }

    const latestSnapshot = snapshots[snapshots.length - 1]
    if (!latestSnapshot) {
      return this.createEmptyProjection()
    }

    // Count current distinguished clubs
    const currentCounts = this.countDistinguishedClubs(latestSnapshot)

    // Calculate projection based on trends
    const projectedCounts = this.calculateProjection(snapshots)

    return {
      projectedDistinguished: projectedCounts.distinguished,
      projectedSelect: projectedCounts.select,
      projectedPresident: projectedCounts.president,
      currentDistinguished: currentCounts.distinguished,
      currentSelect: currentCounts.select,
      currentPresident: currentCounts.president,
      projectionDate: latestSnapshot.snapshotDate,
    }
  }

  /**
   * Count clubs at each distinguished level
   *
   * @param snapshot - District statistics snapshot
   * @returns Object with counts for each level
   */
  countDistinguishedClubs(snapshot: DistrictStatistics): {
    distinguished: number
    select: number
    president: number
    total: number
  } {
    let distinguished = 0
    let select = 0
    let president = 0

    for (const club of snapshot.clubs) {
      const status = this.determineDistinguishedStatus(club)

      switch (status) {
        case 'president':
          president++
          break
        case 'select':
          select++
          break
        case 'distinguished':
          distinguished++
          break
      }
    }

    return {
      distinguished,
      select,
      president,
      total: distinguished + select + president,
    }
  }

  // ========== Private Helper Methods ==========

  /**
   * Create empty projection object
   */
  private createEmptyProjection(): DistinguishedProjection {
    const today = new Date().toISOString().split('T')[0] || ''
    return {
      projectedDistinguished: 0,
      projectedSelect: 0,
      projectedPresident: 0,
      currentDistinguished: 0,
      currentSelect: 0,
      currentPresident: 0,
      projectionDate: today,
    }
  }

  /**
   * Determine distinguished status for a club based on DCP goals and membership
   *
   * Distinguished levels:
   * - President's Distinguished: 9+ goals AND 20+ members
   * - Select Distinguished: 7+ goals AND 20+ members (or net growth >= 5)
   * - Distinguished: 5+ goals AND 20+ members (or net growth >= 3)
   */
  private determineDistinguishedStatus(
    club: ClubStatistics
  ): DistinguishedStatus {
    const dcpGoals = club.dcpGoals
    const membership = club.membershipCount

    // President's Distinguished: 9 goals + 20 members
    if (dcpGoals >= 9 && membership >= 20) {
      return 'president'
    }
    // Select Distinguished: 7 goals + 20 members
    else if (dcpGoals >= 7 && membership >= 20) {
      return 'select'
    }
    // Distinguished: 5 goals + 20 members
    else if (dcpGoals >= 5 && membership >= 20) {
      return 'distinguished'
    }

    return 'none'
  }

  /**
   * Calculate projection based on trends
   */
  private calculateProjection(snapshots: DistrictStatistics[]): {
    distinguished: number
    select: number
    president: number
  } {
    if (snapshots.length < 2) {
      // Not enough data for projection, return current counts
      const latest = snapshots[snapshots.length - 1]
      if (!latest) {
        return { distinguished: 0, select: 0, president: 0 }
      }
      const counts = this.countDistinguishedClubs(latest)
      return {
        distinguished: counts.distinguished,
        select: counts.select,
        president: counts.president,
      }
    }

    // Calculate trend for each level
    const trends = {
      distinguished: [] as number[],
      select: [] as number[],
      president: [] as number[],
    }

    for (const snapshot of snapshots) {
      const counts = this.countDistinguishedClubs(snapshot)
      trends.distinguished.push(counts.distinguished)
      trends.select.push(counts.select)
      trends.president.push(counts.president)
    }

    // Calculate linear trend and project forward
    const projectLevel = (values: number[]): number => {
      if (values.length < 2) return values[0] || 0

      // Simple linear regression
      const n = values.length
      const sumX = (n * (n - 1)) / 2 // Sum of indices 0, 1, 2, ...
      const sumY = values.reduce((sum, val) => sum + val, 0)
      const sumXY = values.reduce((sum, val, idx) => sum + idx * val, 0)
      const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6 // Sum of squares

      const denominator = n * sumX2 - sumX * sumX
      if (denominator === 0) return values[values.length - 1] || 0

      const slope = (n * sumXY - sumX * sumY) / denominator
      const intercept = (sumY - slope * sumX) / n

      // Project forward by 2-3 time periods (conservative estimate)
      const projectionPeriods = 2
      const projection = slope * (n + projectionPeriods) + intercept

      return Math.max(0, Math.round(projection))
    }

    return {
      distinguished: projectLevel(trends.distinguished),
      select: projectLevel(trends.select),
      president: projectLevel(trends.president),
    }
  }
}
