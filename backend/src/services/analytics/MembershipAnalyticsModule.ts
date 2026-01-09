/**
 * Membership Analytics Module
 *
 * Handles membership trends, year-over-year comparisons, and membership projections.
 * Extracted from AnalyticsEngine for improved maintainability and testability.
 *
 * Requirements: 1.1, 4.1, 4.2
 */

import type { IAnalyticsDataSource } from '../../types/serviceInterfaces.js'
import type {
  MembershipAnalytics,
  SeasonalPattern,
  ClubTrend,
} from '../../types/analytics.js'
import type {
  DistrictCacheEntry,
  DistrictStatistics,
} from '../../types/districts.js'
import { parseIntSafe, ensureString } from './AnalyticsUtils.js'
import { logger } from '../../utils/logger.js'

/**
 * MembershipAnalyticsModule
 *
 * Specialized module for membership-related analytics calculations.
 * Accepts dependencies via constructor injection for testability.
 *
 * Requirements: 1.1, 4.1, 4.2
 */
export class MembershipAnalyticsModule {
  private readonly dataSource: IAnalyticsDataSource

  /**
   * Create a MembershipAnalyticsModule instance
   *
   * Requirements: 4.1, 4.2
   *
   * @param dataSource - IAnalyticsDataSource for snapshot-based data retrieval
   */
  constructor(dataSource: IAnalyticsDataSource) {
    this.dataSource = dataSource
  }

  /**
   * Generate comprehensive membership analytics
   *
   * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
   *
   * @param districtId - The district ID to analyze
   * @param startDate - Optional start date filter (inclusive)
   * @param endDate - Optional end date filter (inclusive)
   * @returns MembershipAnalytics object
   */
  async generateMembershipAnalytics(
    districtId: string,
    startDate?: string,
    endDate?: string
  ): Promise<MembershipAnalytics> {
    try {
      const dataEntries = await this.loadDistrictData(
        districtId,
        startDate,
        endDate
      )

      if (dataEntries.length === 0) {
        throw new Error('No cached data available for membership analytics')
      }

      // Calculate membership trend over time (Requirement 6.1)
      const membershipTrend = this.calculateMembershipTrend(dataEntries)
      const totalMembership =
        membershipTrend[membershipTrend.length - 1]?.count || 0
      const membershipChange = this.calculateMembershipChange(membershipTrend)

      // Calculate program year change (Requirement 6.3)
      const programYearChange = this.calculateProgramYearChange(membershipTrend)

      // Analyze club trends to identify top growth and declining clubs (Requirement 6.4)
      const clubTrends = await this.analyzeClubTrends(districtId, dataEntries)
      const topGrowthClubs = this.calculateTopGrowthClubs(clubTrends)
      const topDecliningClubs = this.calculateTopDecliningClubs(clubTrends)

      // Identify seasonal patterns (Requirement 6.2)
      const seasonalPatterns = this.identifySeasonalPatterns(membershipTrend)

      // Calculate year-over-year comparison if data available (Requirement 6.5)
      const yearOverYearComparison = await this.calculateMembershipYearOverYear(
        districtId,
        dataEntries
      )

      const analytics: MembershipAnalytics = {
        totalMembership,
        membershipChange,
        programYearChange,
        membershipTrend,
        topGrowthClubs,
        topDecliningClubs,
        seasonalPatterns,
        yearOverYearComparison,
      }

      logger.info('Generated membership analytics', {
        districtId,
        totalMembership,
        membershipChange,
        programYearChange,
        topGrowthClubs: topGrowthClubs.length,
        topDecliningClubs: topDecliningClubs.length,
      })

      return analytics
    } catch (error) {
      logger.error('Failed to generate membership analytics', {
        districtId,
        error,
      })
      throw error
    }
  }

  /**
   * Calculate year-over-year membership comparison
   *
   * @param districtId - The district ID
   * @param dataEntries - Array of district cache entries
   * @returns Year-over-year comparison or undefined if not available
   */
  async calculateMembershipYearOverYear(
    districtId: string,
    dataEntries: DistrictCacheEntry[]
  ): Promise<
    | {
        currentMembership: number
        previousMembership: number
        percentageChange: number
        membershipChange: number
      }
    | undefined
  > {
    if (dataEntries.length === 0) {
      return undefined
    }

    const latestEntry = dataEntries[dataEntries.length - 1]
    if (!latestEntry) {
      return undefined
    }

    const currentDate = latestEntry.date

    // Calculate previous year date (subtract 1 year)
    const currentYear = parseInt(currentDate.substring(0, 4))
    const previousYearDate = `${currentYear - 1}${currentDate.substring(4)}`

    try {
      const previousEntry = await this.getDistrictDataForDate(
        districtId,
        previousYearDate
      )

      if (!previousEntry) {
        logger.info('No previous year data available for comparison', {
          districtId,
          currentDate,
          previousYearDate,
        })
        return undefined
      }

      const currentMembership = this.getTotalMembership(latestEntry)
      const previousMembership = this.getTotalMembership(previousEntry)
      const membershipChange = currentMembership - previousMembership
      const percentageChange =
        previousMembership > 0
          ? Math.round((membershipChange / previousMembership) * 1000) / 10 // Round to 1 decimal
          : 0

      return {
        currentMembership,
        previousMembership,
        percentageChange,
        membershipChange,
      }
    } catch (error) {
      logger.warn('Failed to calculate year-over-year membership comparison', {
        districtId,
        currentDate,
        error,
      })
      return undefined
    }
  }

  // ========== Private Helper Methods ==========

  /**
   * Calculate membership trend over time
   */
  private calculateMembershipTrend(
    dataEntries: DistrictCacheEntry[]
  ): Array<{ date: string; count: number }> {
    return dataEntries.map(entry => ({
      date: entry.date,
      count: this.getTotalMembership(entry),
    }))
  }

  /**
   * Get total membership from a cache entry
   *
   * This method is public to allow AnalyticsEngine to delegate
   * membership calculations to this module.
   *
   * @param entry - District cache entry
   * @returns Total membership count
   */
  getTotalMembership(entry: DistrictCacheEntry): number {
    // Sum up membership from all clubs
    return entry.clubPerformance.reduce((sum, club) => {
      const membership = parseIntSafe(
        club['Active Members'] ||
          club['Active Membership'] ||
          club['Membership']
      )
      return sum + (isNaN(membership) ? 0 : membership)
    }, 0)
  }

  /**
   * Calculate membership change
   */
  private calculateMembershipChange(
    membershipTrend: Array<{ date: string; count: number }>
  ): number {
    if (membershipTrend.length < 2) {
      return 0
    }
    const first = membershipTrend[0]?.count ?? 0
    const last = membershipTrend[membershipTrend.length - 1]?.count ?? 0
    return last - first
  }

  /**
   * Calculate top growth clubs
   */
  private calculateTopGrowthClubs(
    clubTrends: ClubTrend[]
  ): Array<{ clubId: string; clubName: string; growth: number }> {
    const growthClubs = clubTrends
      .map(club => {
        if (club.membershipTrend.length < 2) {
          return { clubId: club.clubId, clubName: club.clubName, growth: 0 }
        }

        const first = club.membershipTrend[0]?.count ?? 0
        const last =
          club.membershipTrend[club.membershipTrend.length - 1]?.count ?? 0
        const growth = last - first

        return { clubId: club.clubId, clubName: club.clubName, growth }
      })
      .filter(club => club.growth > 0)
      .sort((a, b) => b.growth - a.growth)
      .slice(0, 10)

    return growthClubs
  }

  /**
   * Calculate top declining clubs
   */
  private calculateTopDecliningClubs(
    clubTrends: ClubTrend[]
  ): Array<{ clubId: string; clubName: string; decline: number }> {
    const decliningClubs = clubTrends
      .map(club => {
        if (club.membershipTrend.length < 2) {
          return { clubId: club.clubId, clubName: club.clubName, decline: 0 }
        }

        const first = club.membershipTrend[0]?.count ?? 0
        const last =
          club.membershipTrend[club.membershipTrend.length - 1]?.count ?? 0
        const decline = first - last // Positive value means decline

        return { clubId: club.clubId, clubName: club.clubName, decline }
      })
      .filter(club => club.decline > 0)
      .sort((a, b) => b.decline - a.decline)
      .slice(0, 10)

    return decliningClubs
  }

  /**
   * Identify seasonal patterns in membership changes
   * Analyzes month-over-month changes to detect patterns
   */
  private identifySeasonalPatterns(
    membershipTrend: Array<{ date: string; count: number }>
  ): SeasonalPattern[] {
    if (membershipTrend.length < 2) {
      return []
    }

    // Group data by month and calculate average changes
    const monthlyChanges = new Map<number, number[]>()

    for (let i = 1; i < membershipTrend.length; i++) {
      const currentPoint = membershipTrend[i]!
      const previousPoint = membershipTrend[i - 1]!

      const month = parseInt(currentPoint.date.substring(5, 7))
      const change = currentPoint.count - previousPoint.count

      if (!monthlyChanges.has(month)) {
        monthlyChanges.set(month, [])
      }
      monthlyChanges.get(month)!.push(change)
    }

    // Calculate average change per month
    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ]

    const patterns: SeasonalPattern[] = []

    for (let month = 1; month <= 12; month++) {
      const changes = monthlyChanges.get(month) || []

      if (changes.length === 0) {
        continue
      }

      const averageChange =
        changes.reduce((sum, val) => sum + val, 0) / changes.length

      let trend: 'growth' | 'decline' | 'stable'
      if (averageChange > 2) {
        trend = 'growth'
      } else if (averageChange < -2) {
        trend = 'decline'
      } else {
        trend = 'stable'
      }

      patterns.push({
        month,
        monthName: monthNames[month - 1] || 'Unknown',
        averageChange: Math.round(averageChange * 10) / 10, // Round to 1 decimal
        trend,
      })
    }

    // Sort by month
    patterns.sort((a, b) => a.month - b.month)

    return patterns
  }

  /**
   * Calculate program year membership change
   * Toastmasters program year runs July 1 - June 30
   */
  private calculateProgramYearChange(
    membershipTrend: Array<{ date: string; count: number }>
  ): number {
    if (membershipTrend.length === 0) {
      return 0
    }

    // Find the start of the current program year (July 1)
    const latestDate = membershipTrend[membershipTrend.length - 1]?.date
    if (!latestDate) {
      return 0
    }

    const latestYear = parseInt(latestDate.substring(0, 4))
    const latestMonth = parseInt(latestDate.substring(5, 7))

    // Determine program year start
    let programYearStart: string
    if (latestMonth >= 7) {
      // Current program year started this year
      programYearStart = `${latestYear}-07-01`
    } else {
      // Current program year started last year
      programYearStart = `${latestYear - 1}-07-01`
    }

    // Find the closest data point to program year start
    const programYearStartData = membershipTrend.find(
      point => point.date >= programYearStart
    )

    if (!programYearStartData) {
      // If no data from program year start, use earliest available
      return this.calculateMembershipChange(membershipTrend)
    }

    const startMembership = programYearStartData.count
    const currentMembership = membershipTrend[membershipTrend.length - 1]?.count
    if (currentMembership === undefined) {
      return 0
    }

    return currentMembership - startMembership
  }

  /**
   * Analyze club trends over time
   * This is a simplified version that builds club trends for membership analysis
   */
  private async analyzeClubTrends(
    _districtId: string,
    dataEntries: DistrictCacheEntry[]
  ): Promise<ClubTrend[]> {
    // Get latest entry for current club list
    const latestEntry = dataEntries[dataEntries.length - 1]
    if (!latestEntry) {
      return []
    }

    const clubMap = new Map<string, ClubTrend>()

    // Initialize club trends from latest data
    for (const club of latestEntry.clubPerformance) {
      const clubId = ensureString(
        club['Club Number'] || club['Club ID'] || club['ClubID']
      )
      if (!clubId) continue
      const clubName = ensureString(club['Club Name'] || club['ClubName'])

      if (!clubId) continue

      clubMap.set(clubId, {
        clubId,
        clubName,
        divisionId: ensureString(club['Division']),
        divisionName:
          ensureString(club['Division Name']) || ensureString(club['Division']),
        areaId: ensureString(club['Area']),
        areaName: ensureString(club['Area Name']) || ensureString(club['Area']),
        membershipTrend: [],
        dcpGoalsTrend: [],
        currentStatus: 'thriving',
        riskFactors: [],
        distinguishedLevel: 'NotDistinguished',
      })
    }

    // Build trends for each club
    for (const entry of dataEntries) {
      for (const club of entry.clubPerformance) {
        const clubId = ensureString(
          club['Club Number'] || club['Club ID'] || club['ClubID']
        )
        if (!clubId || !clubMap.has(clubId)) continue

        const clubTrend = clubMap.get(clubId)!
        const membership = parseIntSafe(
          club['Active Members'] ||
            club['Active Membership'] ||
            club['Membership']
        )
        const dcpGoals = parseIntSafe(club['Goals Met'])

        clubTrend.membershipTrend.push({
          date: entry.date,
          count: isNaN(membership) ? 0 : membership,
        })

        clubTrend.dcpGoalsTrend.push({
          date: entry.date,
          goalsAchieved: isNaN(dcpGoals) ? 0 : dcpGoals,
        })
      }
    }

    return Array.from(clubMap.values())
  }

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
   * Load cached data for a district within a date range
   */
  private async loadDistrictData(
    districtId: string,
    startDate?: string,
    endDate?: string
  ): Promise<DistrictCacheEntry[]> {
    try {
      // Get snapshots in the date range
      const snapshots = await this.dataSource.getSnapshotsInRange(
        startDate,
        endDate
      )

      if (snapshots.length === 0) {
        // If no snapshots in range, try to get the latest snapshot
        const latestSnapshot = await this.dataSource.getLatestSnapshot()
        if (!latestSnapshot) {
          logger.warn('No snapshot data found for district', {
            districtId,
            startDate,
            endDate,
          })
          return []
        }

        // Load district data from the latest snapshot
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

      // Load district data from each snapshot
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

      // Sort by date ascending (oldest first) for trend analysis
      dataEntries.sort((a, b) => a.date.localeCompare(b.date))

      logger.info('Loaded district data for membership analytics', {
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
      logger.error('Failed to load district data', {
        districtId,
        startDate,
        endDate,
        error,
      })
      throw error
    }
  }

  /**
   * Get district data for a specific date
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
