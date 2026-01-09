/**
 * Leadership Analytics Module
 * Handles leadership effectiveness insights and correlations.
 * Requirements: 1.5, 4.1, 4.2
 */

import type { IAnalyticsDataSource } from '../../types/serviceInterfaces.js'
import type {
  LeadershipInsights,
  LeadershipEffectivenessScore,
  LeadershipChange,
  AreaDirectorCorrelation,
} from '../../types/analytics.js'
import type {
  DistrictCacheEntry,
  DistrictStatistics,
  ScrapedRecord,
} from '../../types/districts.js'
import { parseIntSafe, ensureString } from './AnalyticsUtils.js'
import { logger } from '../../utils/logger.js'

/**
 * LeadershipAnalyticsModule - Specialized module for leadership effectiveness analytics.
 * Accepts dependencies via constructor injection for testability.
 * Requirements: 1.5, 4.1, 4.2
 */
export class LeadershipAnalyticsModule {
  private readonly dataSource: IAnalyticsDataSource

  constructor(dataSource: IAnalyticsDataSource) {
    this.dataSource = dataSource
  }

  /**
   * Generate comprehensive leadership effectiveness analytics
   * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
   */
  async generateLeadershipInsights(
    districtId: string,
    startDate?: string,
    endDate?: string
  ): Promise<LeadershipInsights> {
    try {
      const dataEntries = await this.loadDistrictData(
        districtId,
        startDate,
        endDate
      )
      if (dataEntries.length === 0) {
        throw new Error('No cached data available for leadership analytics')
      }

      const leadershipScores =
        this.calculateLeadershipEffectiveness(dataEntries)
      const bestPracticeDivisions = this.identifyBestPracticeDivisions(
        leadershipScores,
        dataEntries
      )
      const leadershipChanges = this.trackLeadershipChanges(dataEntries)
      const areaDirectorCorrelations =
        this.analyzeAreaDirectorCorrelations(dataEntries)
      const summary = this.generateLeadershipSummary(
        leadershipScores,
        bestPracticeDivisions,
        dataEntries
      )

      const insights: LeadershipInsights = {
        leadershipScores,
        bestPracticeDivisions,
        leadershipChanges,
        areaDirectorCorrelations,
        summary,
      }

      logger.info('Generated leadership insights', {
        districtId,
        totalDivisions: leadershipScores.length,
        bestPracticeDivisions: bestPracticeDivisions.length,
        averageScore: summary.averageLeadershipScore,
      })

      return insights
    } catch (error) {
      logger.error('Failed to generate leadership insights', {
        districtId,
        error,
      })
      throw error
    }
  }

  /**
   * Calculate leadership effectiveness score for divisions
   * Weighted: 40% health, 30% growth, 30% DCP (Requirement 8.1)
   */
  private calculateLeadershipEffectiveness(
    dataEntries: DistrictCacheEntry[]
  ): LeadershipEffectivenessScore[] {
    const latestEntry = dataEntries[dataEntries.length - 1]
    if (!latestEntry) return []

    const divisionMap = new Map<
      string,
      {
        divisionId: string
        divisionName: string
        clubs: ScrapedRecord[]
        historicalData: Array<{ date: string; clubs: ScrapedRecord[] }>
      }
    >()

    // Build division data structure
    for (const entry of dataEntries) {
      for (const club of entry.clubPerformance) {
        const divisionId = ensureString(club['Division'])
        const divisionName = ensureString(club['Division Name']) || divisionId
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
        let dateEntry = division.historicalData.find(h => h.date === entry.date)
        if (!dateEntry) {
          dateEntry = { date: entry.date, clubs: [] }
          division.historicalData.push(dateEntry)
        }
        dateEntry.clubs.push(club)

        if (entry === latestEntry) {
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
  private calculateDivisionHealthScore(clubs: ScrapedRecord[]): number {
    if (clubs.length === 0) return 0

    let healthyClubs = 0
    let totalMembership = 0
    let clubsWithMinimumMembers = 0

    for (const club of clubs) {
      const membership = parseIntSafe(
        club['Active Members'] ||
          club['Active Membership'] ||
          club['Membership']
      )
      const dcpGoals = parseIntSafe(club['Goals Met'])
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
    historicalData: Array<{ date: string; clubs: ScrapedRecord[] }>
  ): number {
    if (historicalData.length < 2) return 50

    const membershipByDate = historicalData.map(entry => {
      const totalMembership = entry.clubs.reduce((sum, club) => {
        return (
          sum +
          parseIntSafe(
            club['Active Members'] ||
              club['Active Membership'] ||
              club['Membership']
          )
        )
      }, 0)
      return { date: entry.date, membership: totalMembership }
    })

    if (membershipByDate.length === 0) return 50
    const firstMembership = membershipByDate[0]!.membership
    const lastMembership =
      membershipByDate[membershipByDate.length - 1]!.membership
    const growthRate =
      firstMembership > 0
        ? ((lastMembership - firstMembership) / firstMembership) * 100
        : 0

    // +10% growth = 100, 0% growth = 50, -10% growth = 0
    return Math.max(0, Math.min(100, 50 + growthRate * 5))
  }

  /** Calculate division DCP score based on goal achievement */
  private calculateDivisionDCPScore(clubs: ScrapedRecord[]): number {
    if (clubs.length === 0) return 0
    let totalDcpGoals = 0
    for (const club of clubs) {
      totalDcpGoals += parseIntSafe(club['Goals Met'])
    }
    return (totalDcpGoals / (clubs.length * 10)) * 100
  }

  /** Identify consistently high-performing divisions as "Best Practices" (Requirement 8.2) */
  private identifyBestPracticeDivisions(
    leadershipScores: LeadershipEffectivenessScore[],
    dataEntries: DistrictCacheEntry[]
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
        dataEntries
      )

      if (meetsScoreThreshold && isTopPercentile && isConsistent) {
        score.isBestPractice = true
        bestPractices.push(score)
      }
    }

    logger.info('Identified best practice divisions', {
      total: bestPractices.length,
      threshold,
      topPercentile,
    })
    return bestPractices
  }

  /** Check if a division has consistent performance over time */
  private isDivisionConsistent(
    divisionId: string,
    dataEntries: DistrictCacheEntry[]
  ): boolean {
    if (dataEntries.length < 3) return true

    const dcpGoalsByDate: number[] = []
    for (const entry of dataEntries) {
      const divisionClubs = entry.clubPerformance.filter(
        club => club['Division'] === divisionId
      )
      const totalDcpGoals = divisionClubs.reduce(
        (sum, club) => sum + parseIntSafe(club['Goals Met']),
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
    dataEntries: DistrictCacheEntry[]
  ): LeadershipChange[] {
    if (dataEntries.length < 3) return []

    const changes: LeadershipChange[] = []
    const divisionPerformance = new Map<
      string,
      Array<{ date: string; score: number }>
    >()

    for (const entry of dataEntries) {
      const divisionScores = new Map<
        string,
        { totalDcp: number; totalClubs: number }
      >()

      for (const club of entry.clubPerformance) {
        const divisionId = ensureString(club['Division'])
        if (!divisionId) continue

        if (!divisionScores.has(divisionId)) {
          divisionScores.set(divisionId, { totalDcp: 0, totalClubs: 0 })
        }
        const divScore = divisionScores.get(divisionId)!
        divScore.totalDcp += parseIntSafe(club['Goals Met'])
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
          .push({ date: entry.date, score: avgScore })
      }
    }

    for (const [divisionId, history] of divisionPerformance.entries()) {
      if (history.length < 3) continue

      for (let i = 2; i < history.length; i++) {
        const beforeAvg = (history[i - 2]!.score + history[i - 1]!.score) / 2
        const afterScore = history[i]!.score
        const delta = afterScore - beforeAvg

        if (Math.abs(delta) >= beforeAvg * 0.2 && beforeAvg > 0) {
          const latestEntry = dataEntries[dataEntries.length - 1]
          if (!latestEntry) continue
          const divisionName = ensureString(
            latestEntry.clubPerformance.find(
              club => club['Division'] === divisionId
            )?.['Division Name'] || divisionId
          )

          changes.push({
            divisionId,
            divisionName,
            changeDate: history[i]!.date,
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
    dataEntries: DistrictCacheEntry[]
  ): AreaDirectorCorrelation[] {
    const latestEntry = dataEntries[dataEntries.length - 1]
    if (!latestEntry) return []

    const areaMap = new Map<
      string,
      {
        areaId: string
        areaName: string
        divisionId: string
        clubs: ScrapedRecord[]
      }
    >()

    for (const club of latestEntry.clubPerformance) {
      const areaId = ensureString(club['Area'])
      const areaName = ensureString(club['Area Name']) || areaId
      const divisionId = ensureString(club['Division'])
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
        const dcpGoals = parseIntSafe(club['Goals Met'])
        const membership = parseIntSafe(
          club['Active Members'] ||
            club['Active Membership'] ||
            club['Membership']
        )
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
    dataEntries: DistrictCacheEntry[]
  ): {
    topPerformingDivisions: Array<{
      divisionId: string
      divisionName: string
      score: number
    }>
    topPerformingAreas: Array<{
      areaId: string
      areaName: string
      score: number
    }>
    averageLeadershipScore: number
    totalBestPracticeDivisions: number
  } {
    const topPerformingDivisions = leadershipScores.slice(0, 5).map(score => ({
      divisionId: score.divisionId,
      divisionName: score.divisionName,
      score: score.overallScore,
    }))

    const latestEntry = dataEntries[dataEntries.length - 1]
    if (!latestEntry) {
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
    for (const club of latestEntry.clubPerformance) {
      const areaId = ensureString(club['Area'])
      const areaName = ensureString(club['Area Name']) || areaId
      if (!areaId) continue

      if (!areaScores.has(areaId)) {
        areaScores.set(areaId, { areaId, areaName, totalDcp: 0, totalClubs: 0 })
      }
      const area = areaScores.get(areaId)!
      area.totalDcp += parseIntSafe(club['Goals Met'])
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

  /** Map DistrictStatistics to DistrictCacheEntry format */
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

  /** Load cached data for a district within a date range */
  private async loadDistrictData(
    districtId: string,
    startDate?: string,
    endDate?: string
  ): Promise<DistrictCacheEntry[]> {
    try {
      const snapshots = await this.dataSource.getSnapshotsInRange(
        startDate,
        endDate
      )

      if (snapshots.length === 0) {
        const latestSnapshot = await this.dataSource.getLatestSnapshot()
        if (!latestSnapshot) {
          logger.warn('No snapshot data found for district', {
            districtId,
            startDate,
            endDate,
          })
          return []
        }

        const districtData = await this.dataSource.getDistrictData(
          latestSnapshot.snapshot_id,
          districtId
        )
        if (!districtData) {
          logger.warn('No district data found in latest snapshot', {
            districtId,
            snapshotId: latestSnapshot.snapshot_id,
          })
          return []
        }

        return [
          this.mapDistrictStatisticsToEntry(
            districtData,
            latestSnapshot.snapshot_id
          ),
        ]
      }

      const dataEntries: DistrictCacheEntry[] = []
      for (const snapshotInfo of snapshots) {
        const districtData = await this.dataSource.getDistrictData(
          snapshotInfo.snapshotId,
          districtId
        )
        if (districtData) {
          dataEntries.push(
            this.mapDistrictStatisticsToEntry(
              districtData,
              snapshotInfo.dataAsOfDate
            )
          )
        }
      }

      dataEntries.sort((a, b) => a.date.localeCompare(b.date))
      logger.info('Loaded district data for leadership analytics', {
        districtId,
        totalSnapshots: snapshots.length,
        loadedEntries: dataEntries.length,
        dateRange: {
          start: dataEntries[0]?.date,
          end: dataEntries[dataEntries.length - 1]?.date,
        },
      })

      return dataEntries
    } catch (error) {
      logger.error('Failed to load district data for leadership analytics', {
        districtId,
        startDate,
        endDate,
        error,
      })
      throw error
    }
  }
}
