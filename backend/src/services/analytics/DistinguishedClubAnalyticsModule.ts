/**
 * Distinguished Club Analytics Module
 * Handles DCP goals analysis, distinguished club projections, and achievement tracking.
 * Requirements: 1.2, 4.1, 4.2
 */

import type { IAnalyticsDataSource } from '../../types/serviceInterfaces.js'
import type {
  DistinguishedClubAnalytics,
  DistinguishedClubAchievement,
  DCPGoalAnalysis,
} from '../../types/analytics.js'
import type {
  DistrictCacheEntry,
  DistrictStatistics,
  ScrapedRecord,
} from '../../types/districts.js'
import { parseIntSafe, ensureString } from './AnalyticsUtils.js'
import { logger } from '../../utils/logger.js'

/**
 * Specialized module for distinguished club analytics calculations.
 * Accepts dependencies via constructor injection for testability.
 */
export class DistinguishedClubAnalyticsModule {
  private readonly dataSource: IAnalyticsDataSource

  constructor(dataSource: IAnalyticsDataSource) {
    this.dataSource = dataSource
  }

  /** Generate comprehensive distinguished club analytics (Requirements: 7.1-7.5) */
  async generateDistinguishedClubAnalytics(
    districtId: string,
    startDate?: string,
    endDate?: string
  ): Promise<DistinguishedClubAnalytics> {
    try {
      const dataEntries = await this.loadDistrictData(
        districtId,
        startDate,
        endDate
      )

      if (dataEntries.length === 0) {
        throw new Error(
          'No cached data available for distinguished club analytics'
        )
      }

      const latestEntry = dataEntries[dataEntries.length - 1]
      if (!latestEntry) {
        throw new Error(
          'No latest entry available for distinguished club analytics'
        )
      }

      // Count clubs at each distinguished level (Requirement 7.1)
      const distinguishedClubs = this.calculateDistinguishedClubs(latestEntry)

      // Calculate projection for final distinguished club count (Requirement 7.2)
      const distinguishedProjection =
        this.calculateDistinguishedProjection(dataEntries)

      // Track dates when clubs achieve distinguished levels (Requirement 7.3)
      const achievements = this.trackDistinguishedAchievements(dataEntries)

      // Compare to previous years if data available (Requirement 7.4)
      const yearOverYearComparison =
        await this.calculateDistinguishedYearOverYear(
          districtId,
          latestEntry.date
        )

      // Identify most/least commonly achieved DCP goals (Requirement 7.5)
      const dcpGoalAnalysis = this.analyzeDCPGoals(latestEntry)

      const analytics: DistinguishedClubAnalytics = {
        distinguishedClubs,
        distinguishedProjection,
        achievements,
        yearOverYearComparison,
        dcpGoalAnalysis,
      }

      logger.info('Generated distinguished club analytics', {
        districtId,
        totalDistinguished: distinguishedClubs.total,
        presidents: distinguishedClubs.presidents,
        select: distinguishedClubs.select,
        distinguished: distinguishedClubs.distinguished,
        projectedTotal: distinguishedProjection.total,
      })

      return analytics
    } catch (error) {
      logger.error('Failed to generate distinguished club analytics', {
        districtId,
        error,
      })
      throw error
    }
  }

  /**
   * Calculate year-over-year distinguished club comparison (Requirement 7.4)
   */
  async calculateDistinguishedYearOverYear(
    districtId: string,
    currentDate: string
  ): Promise<
    | {
        currentTotal: number
        previousTotal: number
        change: number
        percentageChange: number
        currentByLevel: {
          smedley: number
          presidents: number
          select: number
          distinguished: number
        }
        previousByLevel: {
          smedley: number
          presidents: number
          select: number
          distinguished: number
        }
      }
    | undefined
  > {
    try {
      // Calculate previous year date (subtract 1 year)
      const currentYear = parseInt(currentDate.substring(0, 4))
      const previousYearDate = `${currentYear - 1}${currentDate.substring(4)}`

      const currentEntry = await this.getDistrictDataForDate(
        districtId,
        currentDate
      )
      const previousEntry = await this.getDistrictDataForDate(
        districtId,
        previousYearDate
      )

      if (!currentEntry || !previousEntry) {
        logger.info(
          'Insufficient data for year-over-year distinguished comparison',
          {
            districtId,
            currentDate,
            previousYearDate,
          }
        )
        return undefined
      }

      const currentCounts = this.calculateDistinguishedClubs(currentEntry)
      const previousCounts = this.calculateDistinguishedClubs(previousEntry)

      const change = currentCounts.total - previousCounts.total
      const percentageChange =
        previousCounts.total > 0
          ? Math.round((change / previousCounts.total) * 1000) / 10 // Round to 1 decimal
          : 0

      return {
        currentTotal: currentCounts.total,
        previousTotal: previousCounts.total,
        change,
        percentageChange,
        currentByLevel: {
          smedley: currentCounts.smedley,
          presidents: currentCounts.presidents,
          select: currentCounts.select,
          distinguished: currentCounts.distinguished,
        },
        previousByLevel: {
          smedley: previousCounts.smedley,
          presidents: previousCounts.presidents,
          select: previousCounts.select,
          distinguished: previousCounts.distinguished,
        },
      }
    } catch (error) {
      logger.warn(
        'Failed to calculate year-over-year distinguished comparison',
        {
          districtId,
          currentDate,
          error,
        }
      )
      return undefined
    }
  }

  // ========== Private Helper Methods ==========

  /**
   * Calculate distinguished clubs from latest data (Requirements: 4.1, 4.2)
   * Counts clubs at each distinguished level and calculates total.
   * Primary: Use 'Club Distinguished Status' field; Fallback: Calculate from DCP goals/membership
   *
   * This method is public to allow AnalyticsEngine to delegate
   * distinguished club calculations to this module.
   *
   * @param entry - District cache entry
   * @returns Distinguished club counts by level and total
   */
  calculateDistinguishedClubs(entry: DistrictCacheEntry): {
    smedley: number
    presidents: number
    select: number
    distinguished: number
    total: number
  } {
    let smedley = 0
    let presidents = 0
    let select = 0
    let distinguished = 0

    for (const club of entry.clubPerformance) {
      // Primary: Try to extract from Club Distinguished Status field (Requirements: 4.1)
      const statusField = club['Club Distinguished Status']
      let distinguishedLevel =
        this.extractDistinguishedLevelFromStatus(statusField)

      // Fallback: Calculate based on DCP goals, membership, and net growth
      if (distinguishedLevel === null) {
        const dcpGoals = parseIntSafe(club['Goals Met'])
        const membership = parseIntSafe(
          club['Active Members'] ||
            club['Active Membership'] ||
            club['Membership']
        )
        const netGrowth = this.calculateNetGrowth(club)

        // Use the shared distinguished level determination logic
        const calculatedLevel = this.determineDistinguishedLevel(
          dcpGoals,
          membership,
          netGrowth
        )

        // Map calculated level to typed level
        if (calculatedLevel === 'Smedley') {
          distinguishedLevel = 'Smedley'
        } else if (calculatedLevel === 'Presidents') {
          distinguishedLevel = 'Presidents'
        } else if (calculatedLevel === 'Select') {
          distinguishedLevel = 'Select'
        } else if (calculatedLevel === 'Distinguished') {
          distinguishedLevel = 'Distinguished'
        }
      }

      // Count clubs by distinguished level (Requirements: 4.1, 4.2)
      if (distinguishedLevel === 'Smedley') {
        smedley++
      } else if (distinguishedLevel === 'Presidents') {
        presidents++
      } else if (distinguishedLevel === 'Select') {
        select++
      } else if (distinguishedLevel === 'Distinguished') {
        distinguished++
      }

      // Debug logging with club details (only when in development environment)
      if (process.env['NODE_ENV'] === 'development') {
        logger.debug('Distinguished status calculation', {
          clubId: club['Club Number'],
          clubName: club['Club Name'],
          statusField,
          distinguishedLevel,
          dcpGoals: parseIntSafe(club['Goals Met']),
          membership: parseIntSafe(
            club['Active Members'] ||
              club['Active Membership'] ||
              club['Membership']
          ),
        })
      }
    }

    return {
      smedley,
      presidents,
      select,
      distinguished,
      total: smedley + presidents + select + distinguished,
    }
  }

  /** Calculate distinguished club projection based on trends (Requirement 7.2) */
  private calculateDistinguishedProjection(dataEntries: DistrictCacheEntry[]): {
    smedley: number
    presidents: number
    select: number
    distinguished: number
    total: number
  } {
    if (dataEntries.length < 2) {
      // Not enough data for projection, return current counts
      const latest = dataEntries[0]
      if (!latest) {
        return {
          smedley: 0,
          presidents: 0,
          select: 0,
          distinguished: 0,
          total: 0,
        }
      }
      return this.calculateDistinguishedClubs(latest)
    }

    // Calculate trend for each level
    const trends = {
      smedley: [] as number[],
      presidents: [] as number[],
      select: [] as number[],
      distinguished: [] as number[],
    }

    for (const entry of dataEntries) {
      const counts = this.calculateDistinguishedClubs(entry)
      trends.smedley.push(counts.smedley)
      trends.presidents.push(counts.presidents)
      trends.select.push(counts.select)
      trends.distinguished.push(counts.distinguished)
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

      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
      const intercept = (sumY - slope * sumX) / n

      // Project forward by 2-3 time periods (conservative estimate)
      const projectionPeriods = 2
      const projection = slope * (n + projectionPeriods) + intercept

      return Math.max(0, Math.round(projection))
    }

    const smedley = projectLevel(trends.smedley)
    const presidents = projectLevel(trends.presidents)
    const select = projectLevel(trends.select)
    const distinguished = projectLevel(trends.distinguished)

    return {
      smedley,
      presidents,
      select,
      distinguished,
      total: smedley + presidents + select + distinguished,
    }
  }

  /** Track dates when clubs achieve distinguished levels (Requirement 7.3) */
  private trackDistinguishedAchievements(
    dataEntries: DistrictCacheEntry[]
  ): DistinguishedClubAchievement[] {
    const achievements: DistinguishedClubAchievement[] = []
    const clubLevelHistory = new Map<string, { level?: string; date: string }>()

    // Process entries chronologically
    for (const entry of dataEntries) {
      for (const club of entry.clubPerformance) {
        const clubId = ensureString(
          club['Club Number'] || club['Club ID'] || club['ClubID']
        )
        const clubName = ensureString(club['Club Name'] || club['ClubName'])
        const dcpGoals = parseIntSafe(club['Goals Met'])
        const membership = parseIntSafe(club['Active Members'])

        if (!clubId) continue

        let currentLevel: string | undefined
        // Check levels from highest to lowest
        if (dcpGoals >= 10 && membership >= 25) {
          currentLevel = 'Smedley'
        } else if (dcpGoals >= 9 && membership >= 20) {
          currentLevel = 'President'
        } else if (dcpGoals >= 7 && membership >= 20) {
          currentLevel = 'Select'
        } else if (dcpGoals >= 5 && membership >= 20) {
          currentLevel = 'Distinguished'
        }

        const previousRecord = clubLevelHistory.get(clubId)

        // Check if club achieved a new level
        if (currentLevel && (!previousRecord || !previousRecord.level)) {
          // First time achieving distinguished status
          achievements.push({
            clubId,
            clubName,
            level: currentLevel as
              | 'Smedley'
              | 'President'
              | 'Select'
              | 'Distinguished',
            achievedDate: entry.date,
            goalsAchieved: dcpGoals,
          })
        } else if (
          currentLevel &&
          previousRecord &&
          previousRecord.level &&
          this.isHigherLevel(currentLevel, previousRecord.level)
        ) {
          // Upgraded to a higher level
          achievements.push({
            clubId,
            clubName,
            level: currentLevel as
              | 'Smedley'
              | 'President'
              | 'Select'
              | 'Distinguished',
            achievedDate: entry.date,
            goalsAchieved: dcpGoals,
          })
        }

        // Update history
        clubLevelHistory.set(clubId, {
          level: currentLevel,
          date: entry.date,
        })
      }
    }

    // Sort by date (most recent first)
    achievements.sort((a, b) => b.achievedDate.localeCompare(a.achievedDate))

    return achievements
  }

  /** Analyze DCP goals to identify most/least commonly achieved (Requirement 7.5) */
  private analyzeDCPGoals(entry: DistrictCacheEntry): {
    mostCommonlyAchieved: DCPGoalAnalysis[]
    leastCommonlyAchieved: DCPGoalAnalysis[]
  } {
    // DCP has 10 goals (numbered 1-10)
    // Initialize with explicit values to avoid undefined access issues
    const goalCounts: Record<number, number> = {
      0: 0,
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
      6: 0,
      7: 0,
      8: 0,
      9: 0,
    }
    const totalClubs = entry.clubPerformance.length

    // Count how many clubs achieved each goal using actual CSV data
    for (const club of entry.clubPerformance) {
      // Goal 1: Level 1 awards (need 4)
      const level1s = parseIntSafe(club['Level 1s'])
      if (level1s >= 4) goalCounts[0] = (goalCounts[0] ?? 0) + 1

      // Goal 2: Level 2 awards (need 2)
      const level2s = parseIntSafe(club['Level 2s'])
      if (level2s >= 2) goalCounts[1] = (goalCounts[1] ?? 0) + 1

      // Goal 3: More Level 2 awards (need 2 base + 2 additional = 4 total)
      const addLevel2s = parseIntSafe(club['Add. Level 2s'])
      if (level2s >= 2 && addLevel2s >= 2)
        goalCounts[2] = (goalCounts[2] ?? 0) + 1

      // Goal 4: Level 3 awards (need 2)
      const level3s = parseIntSafe(club['Level 3s'])
      if (level3s >= 2) goalCounts[3] = (goalCounts[3] ?? 0) + 1

      // Goal 5 & 6: Level 4/Path Completion/DTM awards
      const { baseField, additionalField } = this.getLevel4FieldName(club)
      const level4s = parseIntSafe(club[baseField])
      const addLevel4s = parseIntSafe(club[additionalField])

      // Goal 5: Need 1 Level 4 award
      if (level4s >= 1) goalCounts[4] = (goalCounts[4] ?? 0) + 1

      // Goal 6: Need 1 base + 1 additional = 2 total
      if (level4s >= 1 && addLevel4s >= 1)
        goalCounts[5] = (goalCounts[5] ?? 0) + 1

      // Goal 7: New members (need 4)
      const newMembers = parseIntSafe(club['New Members'])
      if (newMembers >= 4) goalCounts[6] = (goalCounts[6] ?? 0) + 1

      // Goal 8: More new members (need 4 base + 4 additional = 8 total)
      const addNewMembers = parseIntSafe(club['Add. New Members'])
      if (newMembers >= 4 && addNewMembers >= 4)
        goalCounts[7] = (goalCounts[7] ?? 0) + 1

      // Goal 9: Club officer roles trained (need 4 in Round 1 and 4 in Round 2)
      const trainedRound1 = parseIntSafe(club['Off. Trained Round 1'])
      const trainedRound2 = parseIntSafe(club['Off. Trained Round 2'])
      if (trainedRound1 >= 4 && trainedRound2 >= 4)
        goalCounts[8] = (goalCounts[8] ?? 0) + 1

      // Goal 10: Membership-renewal dues on time & Club officer list on time
      const duesOct = parseIntSafe(club['Mem. dues on time Oct'])
      const duesApr = parseIntSafe(club['Mem. dues on time Apr'])
      const officerList = parseIntSafe(club['Off. List On Time'])
      // Goal 10 requires officer list on time AND at least one dues payment on time
      if (officerList >= 1 && (duesOct >= 1 || duesApr >= 1))
        goalCounts[9] = (goalCounts[9] ?? 0) + 1
    }

    // Create analysis for each goal
    const goalAnalysis: DCPGoalAnalysis[] = []
    for (let i = 0; i < 10; i++) {
      const count = goalCounts[i] ?? 0
      goalAnalysis.push({
        goalNumber: i + 1,
        achievementCount: count,
        achievementPercentage:
          totalClubs > 0
            ? Math.round((count / totalClubs) * 1000) / 10 // Round to 1 decimal
            : 0,
      })
    }

    // Sort by achievement count
    const sortedByCount = [...goalAnalysis].sort(
      (a, b) => b.achievementCount - a.achievementCount
    )

    // Get top 5 most commonly achieved and bottom 5 least commonly achieved
    const mostCommonlyAchieved = sortedByCount.slice(0, 5)
    const leastCommonlyAchieved = sortedByCount.slice(-5).reverse()

    return {
      mostCommonlyAchieved,
      leastCommonlyAchieved,
    }
  }

  /** Determine distinguished level based on DCP goals, membership, and net growth */
  private determineDistinguishedLevel(
    dcpGoals: number,
    membership: number,
    netGrowth: number
  ): string {
    // Smedley Distinguished: 10 goals + 25 members
    if (dcpGoals >= 10 && membership >= 25) {
      return 'Smedley'
    }
    // President's Distinguished: 9 goals + 20 members
    else if (dcpGoals >= 9 && membership >= 20) {
      return 'Presidents'
    }
    // Select Distinguished: 7 goals + (20 members OR net growth of 5)
    else if (dcpGoals >= 7 && (membership >= 20 || netGrowth >= 5)) {
      return 'Select'
    }
    // Distinguished: 5 goals + (20 members OR net growth of 3)
    else if (dcpGoals >= 5 && (membership >= 20 || netGrowth >= 3)) {
      return 'Distinguished'
    }

    return 'None'
  }

  /** Extract distinguished level from Club Distinguished Status field (Requirement 4.1) */
  private extractDistinguishedLevelFromStatus(
    statusField: string | number | null | undefined
  ): 'Smedley' | 'Presidents' | 'Select' | 'Distinguished' | null {
    if (statusField === null || statusField === undefined) {
      return null
    }

    const status = String(statusField).toLowerCase().trim()

    if (status === '' || status === 'none' || status === 'n/a') {
      return null
    }

    // Check for Smedley Distinguished (highest level)
    if (status.includes('smedley')) {
      return 'Smedley'
    }

    // Check for President's Distinguished
    if (status.includes('president')) {
      return 'Presidents'
    }

    // Check for Select Distinguished
    if (status.includes('select')) {
      return 'Select'
    }

    // Check for Distinguished (base level)
    if (status.includes('distinguished')) {
      return 'Distinguished'
    }

    return null
  }

  /** Check if level1 is higher than level2 */
  private isHigherLevel(level1: string, level2: string): boolean {
    const levels = { Distinguished: 1, Select: 2, President: 3, Smedley: 4 }
    return (
      (levels[level1 as keyof typeof levels] || 0) >
      (levels[level2 as keyof typeof levels] || 0)
    )
  }

  /** Get field name for Level 4/Path Completion/DTM awards (handles different program year formats) */
  private getLevel4FieldName(club: ScrapedRecord): {
    baseField: string
    additionalField: string
  } {
    // Check for 2025+ format (Path Completions)
    if ('Level 4s, Path Completions, or DTM Awards' in club) {
      return {
        baseField: 'Level 4s, Path Completions, or DTM Awards',
        additionalField: 'Add. Level 4s, Path Completions, or DTM award',
      }
    }

    // Check for 2020-2024 format (Level 5s)
    if ('Level 4s, Level 5s, or DTM award' in club) {
      return {
        baseField: 'Level 4s, Level 5s, or DTM award',
        additionalField: 'Add. Level 4s, Level 5s, or DTM award',
      }
    }

    // Check for 2019 and earlier format (CL/AL/DTMs)
    if ('CL/AL/DTMs' in club) {
      return {
        baseField: 'CL/AL/DTMs',
        additionalField: 'Add. CL/AL/DTMs',
      }
    }

    // Fallback to 2025+ format if no match
    logger.debug(
      'No matching Level 4 field found, using 2025+ format as fallback',
      {
        clubId: club['Club Number'] || club['Club ID'] || 'unknown',
        availableFields: Object.keys(club),
      }
    )
    return {
      baseField: 'Level 4s, Path Completions, or DTM Awards',
      additionalField: 'Add. Level 4s, Path Completions, or DTM award',
    }
  }

  /** Calculate net growth for a club (Active Members - Mem. Base) */
  private calculateNetGrowth(club: ScrapedRecord): number {
    const currentMembers = parseIntSafe(
      club['Active Members'] || club['Active Membership'] || club['Membership']
    )

    const membershipBase = parseIntSafe(club['Mem. Base'])

    return currentMembers - membershipBase
  }

  // ========== Data Loading Methods ==========

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

      logger.info('Loaded district data for distinguished club analytics', {
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

  /** Get district data for a specific date */
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
