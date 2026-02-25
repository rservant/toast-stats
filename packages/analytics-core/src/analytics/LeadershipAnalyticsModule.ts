/**
 * Leadership Analytics Module
 *
 * Handles leadership effectiveness insights and correlations.
 * Moved from backend AnalyticsEngine for shared use in analytics-core.
 * Preserves all hardened computation logic from the backend version.
 *
 * Requirements: 1.5, 4.1, 4.2
 */

import type { DistrictStatistics, ClubStatistics } from '../interfaces.js'
import type {
  LeadershipInsights,
  LeadershipEffectivenessScore,
  LeadershipChange,
  AreaDirectorCorrelation,
} from '../types.js'

/**
 * Internal data structure for tracking division data across snapshots
 */
interface DivisionHistoricalData {
  divisionId: string
  divisionName: string
  clubs: ClubStatistics[]
  historicalData: Array<{ date: string; clubs: ClubStatistics[] }>
}

/**
 * LeadershipAnalyticsModule
 *
 * Specialized module for leadership effectiveness analytics.
 * Works directly with DistrictStatistics data without external dependencies.
 * Stateless module - all methods accept data as parameters.
 *
 * Requirements: 1.5, 4.1, 4.2
 */
export class LeadershipAnalyticsModule {
  // ========== Public API Methods ==========

  /**
   * Generate comprehensive leadership effectiveness analytics
   *
   * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
   *
   * @param snapshots - Array of district statistics snapshots (sorted by date ascending)
   * @returns LeadershipInsights object
   */
  generateLeadershipInsights(
    snapshots: DistrictStatistics[]
  ): LeadershipInsights {
    if (snapshots.length === 0) {
      return this.createEmptyInsights()
    }

    const leadershipScores = this.calculateLeadershipEffectiveness(snapshots)
    const bestPracticeDivisions = this.identifyBestPracticeDivisions(
      leadershipScores,
      snapshots
    )
    const leadershipChanges = this.trackLeadershipChanges(snapshots)
    const areaDirectorCorrelations =
      this.analyzeAreaDirectorCorrelations(snapshots)
    const summary = this.generateLeadershipSummary(
      leadershipScores,
      bestPracticeDivisions,
      snapshots
    )

    return {
      leadershipScores,
      bestPracticeDivisions,
      leadershipChanges,
      areaDirectorCorrelations,
      summary,
    }
  }

  // ========== Private Helper Methods ==========

  /**
   * Create empty insights when no data is available
   */
  private createEmptyInsights(): LeadershipInsights {
    return {
      leadershipScores: [],
      bestPracticeDivisions: [],
      leadershipChanges: [],
      areaDirectorCorrelations: [],
      summary: {
        topPerformingDivisions: [],
        topPerformingAreas: [],
        averageLeadershipScore: 0,
        totalBestPracticeDivisions: 0,
      },
    }
  }

  /**
   * Calculate leadership effectiveness score for divisions
   * Weighted: 40% health, 30% growth, 30% DCP (Requirement 8.1)
   */
  private calculateLeadershipEffectiveness(
    snapshots: DistrictStatistics[]
  ): LeadershipEffectivenessScore[] {
    const latestSnapshot = snapshots[snapshots.length - 1]
    if (!latestSnapshot) return []

    const divisionMap = new Map<string, DivisionHistoricalData>()

    // Build division data structure
    for (const snapshot of snapshots) {
      for (const club of snapshot.clubs) {
        const divisionId = club.divisionId
        const divisionName = club.divisionName || divisionId
        if (!divisionId) continue

        if (!divisionMap.has(divisionId)) {
          divisionMap.set(divisionId, {
            divisionId,
            divisionName,
            clubs: [],
            historicalData: [],
          })
        }

        const division = divisionMap.get(divisionId)!
        let dateEntry = division.historicalData.find(
          h => h.date === snapshot.snapshotDate
        )
        if (!dateEntry) {
          dateEntry = { date: snapshot.snapshotDate, clubs: [] }
          division.historicalData.push(dateEntry)
        }
        dateEntry.clubs.push(club)

        if (snapshot === latestSnapshot) {
          division.clubs.push(club)
        }
      }
    }

    // Calculate scores for each division
    const scores: LeadershipEffectivenessScore[] = []
    for (const division of divisionMap.values()) {
      const healthScore = this.calculateDivisionHealthScore(division.clubs)
      const growthScore = this.calculateDivisionGrowthScore(
        division.historicalData
      )
      const dcpScore = this.calculateDivisionDCPScore(division.clubs)
      const overallScore = Math.round(
        healthScore * 0.4 + growthScore * 0.3 + dcpScore * 0.3
      )

      scores.push({
        divisionId: division.divisionId,
        divisionName: division.divisionName,
        healthScore: Math.round(healthScore),
        growthScore: Math.round(growthScore),
        dcpScore: Math.round(dcpScore),
        overallScore,
        rank: 0,
        isBestPractice: false,
      })
    }

    scores.sort((a, b) => b.overallScore - a.overallScore)
    scores.forEach((score, index) => {
      score.rank = index + 1
    })
    return scores
  }

  /** Calculate division health score based on club health metrics */
  private calculateDivisionHealthScore(clubs: ClubStatistics[]): number {
    if (clubs.length === 0) return 0

    let healthyClubs = 0
    let totalMembership = 0
    let clubsWithMinimumMembers = 0

    for (const club of clubs) {
      const membership = club.membershipCount
      const dcpGoals = club.dcpGoals
      totalMembership += membership
      if (membership >= 12 && dcpGoals > 0) healthyClubs++
      if (membership >= 20) clubsWithMinimumMembers++
    }

    const averageMembership = totalMembership / clubs.length
    const healthyClubPercentage = (healthyClubs / clubs.length) * 100
    const strongMembershipPercentage =
      (clubsWithMinimumMembers / clubs.length) * 100

    // Weighted: 50% healthy clubs, 30% avg membership (normalized), 20% strong membership
    return (
      healthyClubPercentage * 0.5 +
      Math.min((averageMembership / 30) * 100, 100) * 0.3 +
      strongMembershipPercentage * 0.2
    )
  }

  /** Calculate division growth score based on membership trends */
  private calculateDivisionGrowthScore(
    historicalData: Array<{ date: string; clubs: ClubStatistics[] }>
  ): number {
    if (historicalData.length < 2) {
      // Fallback: use membershipBase vs membershipCount from the snapshot (#111)
      const latestClubs = historicalData[0]?.clubs ?? []
      return this.calculateGrowthFromBase(latestClubs)
    }

    const membershipByDate = historicalData.map(entry => {
      const totalMembership = entry.clubs.reduce((sum, club) => {
        return sum + club.membershipCount
      }, 0)
      return { date: entry.date, membership: totalMembership }
    })

    if (membershipByDate.length === 0) return 50
    const firstMembership = membershipByDate[0]?.membership ?? 0
    const lastMembership =
      membershipByDate[membershipByDate.length - 1]?.membership ?? 0
    const growthRate =
      firstMembership > 0
        ? ((lastMembership - firstMembership) / firstMembership) * 100
        : 0

    // +10% growth = 100, 0% growth = 50, -10% growth = 0
    return Math.max(0, Math.min(100, 50 + growthRate * 5))
  }

  /**
   * Calculate growth score from membershipBase vs membershipCount (#111)
   *
   * Used as fallback when fewer than 2 historical snapshots exist.
   * membershipBase = member count at start of period (from Toastmasters data)
   * membershipCount = current active members
   */
  private calculateGrowthFromBase(clubs: ClubStatistics[]): number {
    if (clubs.length === 0) return 50
    const totalBase = clubs.reduce((sum, c) => sum + c.membershipBase, 0)
    const totalCurrent = clubs.reduce((sum, c) => sum + c.membershipCount, 0)
    if (totalBase === 0) return 50
    const growthRate = ((totalCurrent - totalBase) / totalBase) * 100
    // Same scale: +10% growth = 100, 0% growth = 50, -10% growth = 0
    return Math.max(0, Math.min(100, 50 + growthRate * 5))
  }

  /** Calculate division DCP score based on goal achievement */
  private calculateDivisionDCPScore(clubs: ClubStatistics[]): number {
    if (clubs.length === 0) return 0
    let totalDcpGoals = 0
    for (const club of clubs) {
      totalDcpGoals += club.dcpGoals
    }
    return (totalDcpGoals / (clubs.length * 10)) * 100
  }

  /** Identify consistently high-performing divisions as "Best Practices" (Requirement 8.2) */
  private identifyBestPracticeDivisions(
    leadershipScores: LeadershipEffectivenessScore[],
    snapshots: DistrictStatistics[]
  ): LeadershipEffectivenessScore[] {
    const threshold = 75
    const topPercentile = Math.ceil(leadershipScores.length * 0.2)
    const bestPractices: LeadershipEffectivenessScore[] = []

    for (let i = 0; i < leadershipScores.length; i++) {
      const score = leadershipScores[i]
      if (!score) continue

      const meetsScoreThreshold = score.overallScore >= threshold
      const isTopPercentile = i < topPercentile
      const isConsistent = this.isDivisionConsistent(
        score.divisionId,
        snapshots
      )

      if (meetsScoreThreshold && isTopPercentile && isConsistent) {
        score.isBestPractice = true
        bestPractices.push(score)
      }
    }

    return bestPractices
  }

  /** Check if a division has consistent performance over time */
  private isDivisionConsistent(
    divisionId: string,
    snapshots: DistrictStatistics[]
  ): boolean {
    if (snapshots.length < 3) return true

    const dcpGoalsByDate: number[] = []
    for (const snapshot of snapshots) {
      const divisionClubs = snapshot.clubs.filter(
        club => club.divisionId === divisionId
      )
      const totalDcpGoals = divisionClubs.reduce(
        (sum, club) => sum + club.dcpGoals,
        0
      )
      dcpGoalsByDate.push(totalDcpGoals)
    }

    for (let i = 1; i < dcpGoalsByDate.length; i++) {
      const previous = dcpGoalsByDate[i - 1]
      const current = dcpGoalsByDate[i]
      if (
        previous !== undefined &&
        current !== undefined &&
        previous > 0 &&
        current < previous * 0.7
      ) {
        return false
      }
    }
    return true
  }

  /**
   * Track performance changes when leadership changes (Requirement 8.3)
   * Note: Simplified implementation - detects significant performance shifts
   */
  private trackLeadershipChanges(
    snapshots: DistrictStatistics[]
  ): LeadershipChange[] {
    if (snapshots.length < 3) return []

    const changes: LeadershipChange[] = []
    const divisionPerformance = new Map<
      string,
      Array<{ date: string; score: number }>
    >()

    for (const snapshot of snapshots) {
      const divisionScores = new Map<
        string,
        { totalDcp: number; totalClubs: number }
      >()

      for (const club of snapshot.clubs) {
        const divisionId = club.divisionId
        if (!divisionId) continue

        if (!divisionScores.has(divisionId)) {
          divisionScores.set(divisionId, { totalDcp: 0, totalClubs: 0 })
        }
        const divScore = divisionScores.get(divisionId)!
        divScore.totalDcp += club.dcpGoals
        divScore.totalClubs++

        if (!divisionPerformance.has(divisionId)) {
          divisionPerformance.set(divisionId, [])
        }
      }

      for (const [divisionId, score] of divisionScores.entries()) {
        const avgScore =
          score.totalClubs > 0 ? score.totalDcp / score.totalClubs : 0
        divisionPerformance
          .get(divisionId)!
          .push({ date: snapshot.snapshotDate, score: avgScore })
      }
    }

    for (const [divisionId, history] of divisionPerformance.entries()) {
      if (history.length < 3) continue

      for (let i = 2; i < history.length; i++) {
        const historyI2 = history[i - 2]
        const historyI1 = history[i - 1]
        const historyI = history[i]
        if (!historyI2 || !historyI1 || !historyI) continue

        const beforeAvg = (historyI2.score + historyI1.score) / 2
        const afterScore = historyI.score
        const delta = afterScore - beforeAvg

        if (Math.abs(delta) >= beforeAvg * 0.2 && beforeAvg > 0) {
          const latestSnapshot = snapshots[snapshots.length - 1]
          if (!latestSnapshot) continue
          const divisionClub = latestSnapshot.clubs.find(
            club => club.divisionId === divisionId
          )
          const divisionName = divisionClub?.divisionName || divisionId

          changes.push({
            divisionId,
            divisionName,
            changeDate: historyI.date,
            performanceBeforeChange: Math.round(beforeAvg * 10) / 10,
            performanceAfterChange: Math.round(afterScore * 10) / 10,
            performanceDelta: Math.round(delta * 10) / 10,
            trend: delta > 0 ? 'improved' : delta < 0 ? 'declined' : 'stable',
          })
        }
      }
    }

    changes.sort((a, b) => b.changeDate.localeCompare(a.changeDate))
    return changes
  }

  /**
   * Identify correlations between area director activity and club performance (Requirement 8.4)
   * Note: Simplified implementation - infers activity from club performance patterns
   */
  private analyzeAreaDirectorCorrelations(
    snapshots: DistrictStatistics[]
  ): AreaDirectorCorrelation[] {
    const latestSnapshot = snapshots[snapshots.length - 1]
    if (!latestSnapshot) return []

    const areaMap = new Map<
      string,
      {
        areaId: string
        areaName: string
        divisionId: string
        clubs: ClubStatistics[]
      }
    >()

    for (const club of latestSnapshot.clubs) {
      const areaId = club.areaId
      const areaName = club.areaName || areaId
      const divisionId = club.divisionId
      if (!areaId) continue

      if (!areaMap.has(areaId)) {
        areaMap.set(areaId, { areaId, areaName, divisionId, clubs: [] })
      }
      areaMap.get(areaId)!.clubs.push(club)
    }

    const correlations: AreaDirectorCorrelation[] = []
    for (const area of areaMap.values()) {
      let totalDcpGoals = 0
      let totalMembership = 0
      let healthyClubs = 0

      for (const club of area.clubs) {
        const dcpGoals = club.dcpGoals
        const membership = club.membershipCount
        totalDcpGoals += dcpGoals
        totalMembership += membership
        if (membership >= 12 && dcpGoals > 0) healthyClubs++
      }

      const avgDcpGoals =
        area.clubs.length > 0 ? totalDcpGoals / area.clubs.length : 0
      const avgMembership =
        area.clubs.length > 0 ? totalMembership / area.clubs.length : 0
      const healthyPercentage =
        area.clubs.length > 0 ? healthyClubs / area.clubs.length : 0

      const performanceScore = Math.round(
        (avgDcpGoals / 10) * 40 +
          Math.min((avgMembership / 30) * 100, 100) * 0.3 +
          healthyPercentage * 100 * 0.3
      )

      let activityIndicator: 'high' | 'medium' | 'low'
      if (performanceScore >= 70) activityIndicator = 'high'
      else if (performanceScore >= 40) activityIndicator = 'medium'
      else activityIndicator = 'low'

      let correlation: 'positive' | 'neutral' | 'negative'
      if (activityIndicator === 'high' && performanceScore >= 70)
        correlation = 'positive'
      else if (activityIndicator === 'low' && performanceScore < 40)
        correlation = 'negative'
      else correlation = 'neutral'

      correlations.push({
        areaId: area.areaId,
        areaName: area.areaName,
        divisionId: area.divisionId,
        clubPerformanceScore: performanceScore,
        activityIndicator,
        correlation,
      })
    }

    correlations.sort((a, b) => b.clubPerformanceScore - a.clubPerformanceScore)
    return correlations
  }

  /** Generate summary report of top-performing divisions and areas (Requirement 8.5) */
  private generateLeadershipSummary(
    leadershipScores: LeadershipEffectivenessScore[],
    bestPracticeDivisions: LeadershipEffectivenessScore[],
    snapshots: DistrictStatistics[]
  ): LeadershipInsights['summary'] {
    const topPerformingDivisions = leadershipScores.slice(0, 5).map(score => ({
      divisionId: score.divisionId,
      divisionName: score.divisionName,
      score: score.overallScore,
    }))

    const latestSnapshot = snapshots[snapshots.length - 1]
    if (!latestSnapshot) {
      return {
        topPerformingDivisions: [],
        topPerformingAreas: [],
        averageLeadershipScore: 0,
        totalBestPracticeDivisions: 0,
      }
    }

    const areaScores = new Map<
      string,
      { areaId: string; areaName: string; totalDcp: number; totalClubs: number }
    >()
    for (const club of latestSnapshot.clubs) {
      const areaId = club.areaId
      const areaName = club.areaName || areaId
      if (!areaId) continue

      if (!areaScores.has(areaId)) {
        areaScores.set(areaId, { areaId, areaName, totalDcp: 0, totalClubs: 0 })
      }
      const area = areaScores.get(areaId)!
      area.totalDcp += club.dcpGoals
      area.totalClubs++
    }

    const topPerformingAreas = Array.from(areaScores.values())
      .map(area => ({
        areaId: area.areaId,
        areaName: area.areaName,
        score:
          area.totalClubs > 0
            ? Math.round((area.totalDcp / area.totalClubs) * 10)
            : 0,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)

    const averageLeadershipScore =
      leadershipScores.length > 0
        ? Math.round(
            leadershipScores.reduce(
              (sum, score) => sum + score.overallScore,
              0
            ) / leadershipScores.length
          )
        : 0

    return {
      topPerformingDivisions,
      topPerformingAreas,
      averageLeadershipScore,
      totalBestPracticeDivisions: bestPracticeDivisions.length,
    }
  }
}
