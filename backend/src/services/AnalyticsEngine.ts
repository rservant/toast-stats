/**
 * Analytics Engine
 * Processes cached district data to generate insights and analytics
 */

import {
  IDistrictCacheManager,
  IAnalyticsEngine,
} from '../types/serviceInterfaces.js'
import { logger } from '../utils/logger.js'
import type {
  ClubTrend,
  DivisionAnalytics,
  AreaAnalytics,
  DistrictAnalytics,
  ClubHealthStatus,
  MembershipAnalytics,
  SeasonalPattern,
  DistinguishedClubAnalytics,
  DistinguishedClubAchievement,
  DCPGoalAnalysis,
  LeadershipInsights,
  LeadershipEffectivenessScore,
  LeadershipChange,
  AreaDirectorCorrelation,
  YearOverYearComparison,
} from '../types/analytics.js'
import type { DistrictCacheEntry, ScrapedRecord } from '../types/districts.js'

export class AnalyticsEngine implements IAnalyticsEngine {
  private cacheManager: IDistrictCacheManager
  private cachedDatesCache: Map<
    string,
    { dates: string[]; timestamp: number }
  > = new Map()
  private readonly CACHE_TTL = 5000 // 5 seconds

  constructor(cacheManager: IDistrictCacheManager) {
    this.cacheManager = cacheManager
  }

  /**
   * Safely parse a value that could be string or number to integer
   */
  private parseIntSafe(
    value: string | number | null | undefined,
    defaultValue = 0
  ): number {
    if (typeof value === 'number') return Math.floor(value)
    if (typeof value === 'string') return parseInt(value, 10) || defaultValue
    return defaultValue
  }

  /**
   * Ensure a value is a string for use as Map key
   */
  private ensureString(value: string | number | null | undefined): string {
    if (value === null || value === undefined) return ''
    return String(value)
  }

  /**
   * Get cached dates with in-memory caching to reduce filesystem calls
   */
  private async getCachedDatesWithCache(districtId: string): Promise<string[]> {
    const now = Date.now()
    const cached = this.cachedDatesCache.get(districtId)

    // Return cached value if still valid
    if (cached && now - cached.timestamp < this.CACHE_TTL) {
      return cached.dates
    }

    // Fetch from filesystem and cache
    const dates = await this.cacheManager.getCachedDatesForDistrict(districtId)
    this.cachedDatesCache.set(districtId, { dates, timestamp: now })

    return dates
  }

  /**
   * Clear internal caches (for testing purposes)
   */
  public clearCaches(): void {
    this.cachedDatesCache.clear()
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
      const cachedDates = await this.getCachedDatesWithCache(districtId)

      if (cachedDates.length === 0) {
        logger.warn('No cached data found for district', { districtId })
        return []
      }

      // Filter dates by range if provided
      let filteredDates = cachedDates
      if (startDate) {
        filteredDates = filteredDates.filter(date => date >= startDate)
      }
      if (endDate) {
        filteredDates = filteredDates.filter(date => date <= endDate)
      }

      // Load all data entries
      const dataPromises = filteredDates.map(date =>
        this.cacheManager.getDistrictData(districtId, date)
      )
      const dataEntries = await Promise.all(dataPromises)

      // Filter out null entries
      const validEntries = dataEntries.filter(
        (entry): entry is DistrictCacheEntry => entry !== null
      )

      logger.info('Loaded district data for analytics', {
        districtId,
        totalDates: validEntries.length,
        dateRange: {
          start: filteredDates[0],
          end: filteredDates[filteredDates.length - 1],
        },
      })

      return validEntries
    } catch (error) {
      logger.error('Failed to load district data', { districtId, error })
      throw error
    }
  }

  /**
   * Generate comprehensive district analytics
   */
  async generateDistrictAnalytics(
    districtId: string,
    startDate?: string,
    endDate?: string
  ): Promise<DistrictAnalytics> {
    try {
      const dataEntries = await this.loadDistrictData(
        districtId,
        startDate,
        endDate
      )

      if (dataEntries.length === 0) {
        throw new Error('No cached data available for analytics')
      }

      // Get date range
      const dates = dataEntries.map(e => e.date).sort()
      const dateRange = { start: dates[0], end: dates[dates.length - 1] }

      // Get latest data for current state
      const latestEntry = dataEntries[dataEntries.length - 1]

      // Calculate membership metrics
      const membershipTrend = this.calculateMembershipTrend(dataEntries)
      const totalMembership =
        membershipTrend[membershipTrend.length - 1]?.count || 0
      const membershipChange = this.calculateMembershipChange(membershipTrend)

      // Analyze clubs
      const clubTrends = await this.analyzeClubTrends(districtId, dataEntries)
      const atRiskClubs = clubTrends.filter(c => c.currentStatus === 'at-risk')
      const criticalClubs = clubTrends.filter(
        c => c.currentStatus === 'critical'
      )
      const healthyClubs = clubTrends.filter(c => c.currentStatus === 'healthy')

      // Calculate distinguished clubs
      const distinguishedClubs = this.calculateDistinguishedClubs(latestEntry)

      // Analyze divisions and areas
      const divisionRankings = this.analyzeDivisions(dataEntries)
      const topPerformingAreas = this.analyzeAreas(latestEntry)

      // Calculate top growth clubs
      const topGrowthClubs = this.calculateTopGrowthClubs(clubTrends)

      // Calculate distinguished projection (simple linear projection)
      const distinguishedProjection =
        this.projectDistinguishedClubs(dataEntries)

      // Generate comprehensive distinguished club analytics including DCP goal analysis
      const distinguishedClubAnalytics =
        await this.generateDistinguishedClubAnalytics(
          districtId,
          startDate,
          endDate
        )

      // Calculate year-over-year comparison if previous year data available
      const yearOverYearData = await this.calculateMembershipYearOverYear(
        districtId,
        dataEntries
      )
      let yearOverYear:
        | {
            membershipChange: number
            distinguishedChange: number
            clubHealthChange: number
          }
        | undefined

      if (yearOverYearData) {
        const latestEntry = dataEntries[dataEntries.length - 1]
        const currentDate = latestEntry.date
        const currentYear = parseInt(currentDate.substring(0, 4))
        const previousYearDate = `${currentYear - 1}${currentDate.substring(4)}`

        try {
          const previousEntry = await this.cacheManager.getDistrictData(
            districtId,
            previousYearDate
          )

          if (previousEntry) {
            // Calculate distinguished clubs change
            const currentDistinguished =
              this.calculateDistinguishedClubs(latestEntry)
            const previousDistinguished =
              this.calculateDistinguishedClubs(previousEntry)
            const distinguishedChange =
              previousDistinguished.total > 0
                ? Math.round(
                    ((currentDistinguished.total -
                      previousDistinguished.total) /
                      previousDistinguished.total) *
                      1000
                  ) / 10
                : 0

            // Calculate club health change (percentage of healthy clubs)
            const currentHealthyPercent =
              (healthyClubs.length / clubTrends.length) * 100
            const previousClubTrends = await this.analyzeClubTrends(
              districtId,
              [previousEntry]
            )
            const previousHealthyClubs = previousClubTrends.filter(
              c => c.currentStatus === 'healthy'
            ).length
            const previousHealthyPercent =
              previousClubTrends.length > 0
                ? (previousHealthyClubs / previousClubTrends.length) * 100
                : 0
            const clubHealthChange =
              Math.round(
                (currentHealthyPercent - previousHealthyPercent) * 10
              ) / 10

            yearOverYear = {
              membershipChange: yearOverYearData.percentageChange,
              distinguishedChange,
              clubHealthChange,
            }
          }
        } catch (error) {
          logger.warn('Failed to calculate full year-over-year comparison', {
            districtId,
            error,
          })
          yearOverYear = {
            membershipChange: yearOverYearData.percentageChange,
            distinguishedChange: 0,
            clubHealthChange: 0,
          }
        }
      }

      const analytics: DistrictAnalytics = {
        districtId,
        dateRange,
        totalMembership,
        membershipChange,
        membershipTrend,
        topGrowthClubs,
        allClubs: clubTrends,
        atRiskClubs,
        healthyClubs,
        criticalClubs,
        distinguishedClubs,
        distinguishedProjection,
        distinguishedClubAnalytics,
        divisionRankings,
        topPerformingAreas,
        yearOverYear,
      }

      logger.info('Generated district analytics', {
        districtId,
        dateRange,
        totalClubs: clubTrends.length,
        atRiskClubs: atRiskClubs.length,
        criticalClubs: criticalClubs.length,
        healthyClubs: healthyClubs.length,
      })

      return analytics
    } catch (error) {
      logger.error('Failed to generate district analytics', {
        districtId,
        error,
      })
      throw error
    }
  }

  /**
   * Get club-specific trends
   */
  async getClubTrends(
    districtId: string,
    clubId: string
  ): Promise<ClubTrend | null> {
    try {
      const dataEntries = await this.loadDistrictData(districtId)

      if (dataEntries.length === 0) {
        logger.warn('No cached data available for club trends', {
          districtId,
          clubId,
        })
        return null
      }

      const clubTrends = await this.analyzeClubTrends(districtId, dataEntries)

      const clubTrend = clubTrends.find(c => c.clubId === clubId)

      if (!clubTrend) {
        logger.warn('Club not found in analytics', { districtId, clubId })
        return null
      }

      return clubTrend
    } catch (error) {
      logger.error('Failed to get club trends', { districtId, clubId, error })
      throw error
    }
  }

  /**
   * Identify at-risk clubs
   */
  async identifyAtRiskClubs(districtId: string): Promise<ClubTrend[]> {
    try {
      const dataEntries = await this.loadDistrictData(districtId)

      if (dataEntries.length === 0) {
        logger.warn('No cached data available for at-risk club analysis', {
          districtId,
        })
        return []
      }

      const clubTrends = await this.analyzeClubTrends(districtId, dataEntries)

      // Return only at-risk clubs (not critical clubs)
      return clubTrends.filter(c => c.currentStatus === 'at-risk')
    } catch (error) {
      logger.error('Failed to identify at-risk clubs', { districtId, error })
      throw error
    }
  }

  /**
   * Compare divisions
   */
  async compareDivisions(
    districtId: string,
    date: string
  ): Promise<DivisionAnalytics[]> {
    try {
      const entry = await this.cacheManager.getDistrictData(districtId, date)

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
   * Calculate year-over-year metrics
   * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
   */
  async calculateYearOverYear(
    districtId: string,
    currentDate: string
  ): Promise<YearOverYearComparison | null> {
    try {
      // Find same date in previous program year (Requirement 9.1)
      const previousYearDate = this.findPreviousProgramYearDate(currentDate)

      const currentEntry = await this.cacheManager.getDistrictData(
        districtId,
        currentDate
      )
      const previousEntry = await this.cacheManager.getDistrictData(
        districtId,
        previousYearDate
      )

      // Handle missing data gracefully (Requirement 9.3)
      if (!currentEntry) {
        logger.warn('No current data available for year-over-year comparison', {
          districtId,
          currentDate,
        })
        return null
      }

      if (!previousEntry) {
        logger.info('No previous year data available for comparison', {
          districtId,
          currentDate,
          previousYearDate,
        })
        return {
          currentDate,
          previousYearDate,
          dataAvailable: false,
          message: 'N/A - Previous year data not cached',
        }
      }

      // Calculate percentage changes for all key metrics (Requirement 9.2)
      const metrics = this.calculateYearOverYearMetrics(
        currentEntry,
        previousEntry
      )

      // Support multi-year trends when 3+ years available (Requirement 9.5)
      const multiYearTrends = await this.calculateMultiYearTrends(
        districtId,
        currentDate
      )

      return {
        currentDate,
        previousYearDate,
        dataAvailable: true,
        metrics,
        multiYearTrends,
      }
    } catch (error) {
      logger.error('Failed to calculate year-over-year metrics', {
        districtId,
        currentDate,
        error,
      })
      throw error
    }
  }

  /**
   * Find the same date in the previous program year
   * Requirement 9.1
   */
  private findPreviousProgramYearDate(currentDate: string): string {
    // Toastmasters program year runs July 1 - June 30
    // To find the same point in the previous program year, subtract 1 year
    const currentYear = parseInt(currentDate.substring(0, 4))
    const previousYearDate = `${currentYear - 1}${currentDate.substring(4)}`

    return previousYearDate
  }

  /**
   * Calculate percentage changes for all key metrics
   * Requirement 9.2
   */
  private calculateYearOverYearMetrics(
    currentEntry: DistrictCacheEntry,
    previousEntry: DistrictCacheEntry
  ): {
    membership: {
      current: number
      previous: number
      change: number
      percentageChange: number
    }
    distinguishedClubs: {
      current: number
      previous: number
      change: number
      percentageChange: number
      byLevel: {
        smedley: { current: number; previous: number; change: number }
        presidents: { current: number; previous: number; change: number }
        select: { current: number; previous: number; change: number }
        distinguished: { current: number; previous: number; change: number }
      }
    }
    clubHealth: {
      healthyClubs: {
        current: number
        previous: number
        change: number
        percentageChange: number
      }
      atRiskClubs: {
        current: number
        previous: number
        change: number
        percentageChange: number
      }
      criticalClubs: {
        current: number
        previous: number
        change: number
        percentageChange: number
      }
    }
    dcpGoals: {
      totalGoals: {
        current: number
        previous: number
        change: number
        percentageChange: number
      }
      averagePerClub: {
        current: number
        previous: number
        change: number
        percentageChange: number
      }
    }
    clubCount: {
      current: number
      previous: number
      change: number
      percentageChange: number
    }
  } {
    // Membership metrics
    const currentMembership = this.getTotalMembership(currentEntry)
    const previousMembership = this.getTotalMembership(previousEntry)
    const membershipChange = currentMembership - previousMembership
    const membershipPercentageChange = this.calculatePercentageChange(
      previousMembership,
      currentMembership
    )

    // Distinguished clubs metrics
    const currentDistinguished = this.calculateDistinguishedClubs(currentEntry)
    const previousDistinguished =
      this.calculateDistinguishedClubs(previousEntry)
    const distinguishedChange =
      currentDistinguished.total - previousDistinguished.total
    const distinguishedPercentageChange = this.calculatePercentageChange(
      previousDistinguished.total,
      currentDistinguished.total
    )

    // Club health metrics
    const currentHealthy = this.countHealthyClubs(currentEntry)
    const previousHealthy = this.countHealthyClubs(previousEntry)
    const currentAtRisk = this.countAtRiskClubs(currentEntry)
    const previousAtRisk = this.countAtRiskClubs(previousEntry)
    const currentCritical = this.countCriticalClubs(currentEntry)
    const previousCritical = this.countCriticalClubs(previousEntry)

    // DCP goals metrics
    const currentTotalDcp = this.getTotalDcpGoals(currentEntry)
    const previousTotalDcp = this.getTotalDcpGoals(previousEntry)
    const currentClubCount = currentEntry.clubPerformance.length
    const previousClubCount = previousEntry.clubPerformance.length
    const currentAvgDcp =
      currentClubCount > 0 ? currentTotalDcp / currentClubCount : 0
    const previousAvgDcp =
      previousClubCount > 0 ? previousTotalDcp / previousClubCount : 0

    return {
      membership: {
        current: currentMembership,
        previous: previousMembership,
        change: membershipChange,
        percentageChange: membershipPercentageChange,
      },
      distinguishedClubs: {
        current: currentDistinguished.total,
        previous: previousDistinguished.total,
        change: distinguishedChange,
        percentageChange: distinguishedPercentageChange,
        byLevel: {
          smedley: {
            current: currentDistinguished.smedley,
            previous: previousDistinguished.smedley,
            change:
              currentDistinguished.smedley - previousDistinguished.smedley,
          },
          presidents: {
            current: currentDistinguished.presidents,
            previous: previousDistinguished.presidents,
            change:
              currentDistinguished.presidents -
              previousDistinguished.presidents,
          },
          select: {
            current: currentDistinguished.select,
            previous: previousDistinguished.select,
            change: currentDistinguished.select - previousDistinguished.select,
          },
          distinguished: {
            current: currentDistinguished.distinguished,
            previous: previousDistinguished.distinguished,
            change:
              currentDistinguished.distinguished -
              previousDistinguished.distinguished,
          },
        },
      },
      clubHealth: {
        healthyClubs: {
          current: currentHealthy,
          previous: previousHealthy,
          change: currentHealthy - previousHealthy,
          percentageChange: this.calculatePercentageChange(
            previousHealthy,
            currentHealthy
          ),
        },
        atRiskClubs: {
          current: currentAtRisk,
          previous: previousAtRisk,
          change: currentAtRisk - previousAtRisk,
          percentageChange: this.calculatePercentageChange(
            previousAtRisk,
            currentAtRisk
          ),
        },
        criticalClubs: {
          current: currentCritical,
          previous: previousCritical,
          change: currentCritical - previousCritical,
          percentageChange: this.calculatePercentageChange(
            previousCritical,
            currentCritical
          ),
        },
      },
      dcpGoals: {
        totalGoals: {
          current: currentTotalDcp,
          previous: previousTotalDcp,
          change: currentTotalDcp - previousTotalDcp,
          percentageChange: this.calculatePercentageChange(
            previousTotalDcp,
            currentTotalDcp
          ),
        },
        averagePerClub: {
          current: Math.round(currentAvgDcp * 10) / 10,
          previous: Math.round(previousAvgDcp * 10) / 10,
          change: Math.round((currentAvgDcp - previousAvgDcp) * 10) / 10,
          percentageChange: this.calculatePercentageChange(
            previousAvgDcp,
            currentAvgDcp
          ),
        },
      },
      clubCount: {
        current: currentClubCount,
        previous: previousClubCount,
        change: currentClubCount - previousClubCount,
        percentageChange: this.calculatePercentageChange(
          previousClubCount,
          currentClubCount
        ),
      },
    }
  }

  /**
   * Calculate percentage change between two values
   * Returns "N/A" as 0 if previous value is 0
   */
  private calculatePercentageChange(
    previousValue: number,
    currentValue: number
  ): number {
    if (previousValue === 0) {
      return currentValue > 0 ? 100 : 0
    }
    return (
      Math.round(((currentValue - previousValue) / previousValue) * 1000) / 10
    )
  }

  /**
   * Calculate multi-year trends when 3+ years of data available
   * Requirement 9.5
   */
  private async calculateMultiYearTrends(
    districtId: string,
    currentDate: string
  ): Promise<{
    available: boolean
    years?: Array<{
      year: number
      date: string
      membership: number
      distinguishedClubs: number
      totalDcpGoals: number
      clubCount: number
    }>
    trends?: {
      membershipTrend: 'increasing' | 'decreasing' | 'stable'
      distinguishedTrend: 'increasing' | 'decreasing' | 'stable'
      dcpGoalsTrend: 'increasing' | 'decreasing' | 'stable'
    }
  }> {
    try {
      const currentYear = parseInt(currentDate.substring(0, 4))
      const yearData: Array<{
        year: number
        date: string
        membership: number
        distinguishedClubs: number
        totalDcpGoals: number
        clubCount: number
      }> = []

      // Try to fetch data for current year and previous 2 years (3 years total)
      for (let i = 0; i < 3; i++) {
        const year = currentYear - i
        const yearDate = `${year}${currentDate.substring(4)}`
        const entry = await this.cacheManager.getDistrictData(
          districtId,
          yearDate
        )

        if (entry) {
          yearData.push({
            year,
            date: yearDate,
            membership: this.getTotalMembership(entry),
            distinguishedClubs: this.calculateDistinguishedClubs(entry).total,
            totalDcpGoals: this.getTotalDcpGoals(entry),
            clubCount: entry.clubPerformance.length,
          })
        }
      }

      // Need at least 3 years of data for multi-year trends
      if (yearData.length < 3) {
        return {
          available: false,
        }
      }

      // Sort by year (oldest to newest)
      yearData.sort((a, b) => a.year - b.year)

      // Calculate trends
      const membershipTrend = this.determineTrend(
        yearData.map(d => d.membership)
      )
      const distinguishedTrend = this.determineTrend(
        yearData.map(d => d.distinguishedClubs)
      )
      const dcpGoalsTrend = this.determineTrend(
        yearData.map(d => d.totalDcpGoals)
      )

      return {
        available: true,
        years: yearData,
        trends: {
          membershipTrend,
          distinguishedTrend,
          dcpGoalsTrend,
        },
      }
    } catch (error) {
      logger.warn('Failed to calculate multi-year trends', {
        districtId,
        currentDate,
        error,
      })
      return {
        available: false,
      }
    }
  }

  /**
   * Determine trend direction from a series of values
   */
  private determineTrend(
    values: number[]
  ): 'increasing' | 'decreasing' | 'stable' {
    if (values.length < 2) return 'stable'

    // Calculate simple linear regression slope
    const n = values.length
    const sumX = (n * (n - 1)) / 2 // Sum of indices 0, 1, 2, ...
    const sumY = values.reduce((sum, val) => sum + val, 0)
    const sumXY = values.reduce((sum, val, idx) => sum + idx * val, 0)
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6 // Sum of squares

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)

    // Determine trend based on slope
    // Use a threshold to avoid classifying small changes as trends
    const avgValue = sumY / n
    const relativeSlope = avgValue > 0 ? slope / avgValue : slope

    if (relativeSlope > 0.05) {
      return 'increasing'
    } else if (relativeSlope < -0.05) {
      return 'decreasing'
    } else {
      return 'stable'
    }
  }

  /**
   * Count at-risk clubs (membership declining or zero DCP goals, but not critical)
   */
  private countAtRiskClubs(entry: DistrictCacheEntry): number {
    return entry.clubPerformance.filter(club => {
      const membership = this.parseIntSafe(
        club['Active Members'] ||
          club['Active Membership'] ||
          club['Membership']
      )
      const dcpGoals = this.parseIntSafe(club['Goals Met'] || club['DCP Goals'])

      // At-risk: membership >= 12 but has issues
      return membership >= 12 && dcpGoals === 0
    }).length
  }

  /**
   * Count critical clubs (membership < 12)
   */
  private countCriticalClubs(entry: DistrictCacheEntry): number {
    return entry.clubPerformance.filter(club => {
      const membership = this.parseIntSafe(
        club['Active Members'] ||
          club['Active Membership'] ||
          club['Membership']
      )
      return membership < 12
    }).length
  }

  /**
   * Get total DCP goals from an entry
   */
  private getTotalDcpGoals(entry: DistrictCacheEntry): number {
    return entry.clubPerformance.reduce((sum, club) => {
      const dcpGoals = this.parseIntSafe(club['Goals Met'])
      return sum + (isNaN(dcpGoals) ? 0 : dcpGoals)
    }, 0)
  }

  /**
   * Generate comprehensive membership analytics
   * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
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
   * Generate comprehensive distinguished club analytics
   * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
   */
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
   */
  private getTotalMembership(entry: DistrictCacheEntry): number {
    // Sum up membership from all clubs
    return entry.clubPerformance.reduce((sum, club) => {
      const membership = this.parseIntSafe(
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
    const first = membershipTrend[0].count
    const last = membershipTrend[membershipTrend.length - 1].count
    return last - first
  }

  /**
   * Analyze club trends over time
   */
  private async analyzeClubTrends(
    _districtId: string,
    dataEntries: DistrictCacheEntry[]
  ): Promise<ClubTrend[]> {
    // Get latest entry for current club list
    const latestEntry = dataEntries[dataEntries.length - 1]
    const clubMap = new Map<string, ClubTrend>()

    // Initialize club trends from latest data
    for (const club of latestEntry.clubPerformance) {
      const clubId = this.ensureString(
        club['Club Number'] || club['Club ID'] || club['ClubID']
      )
      if (!clubId) continue
      const clubName = this.ensureString(club['Club Name'] || club['ClubName'])

      if (!clubId) continue

      clubMap.set(clubId, {
        clubId,
        clubName,
        divisionId: this.ensureString(club['Division']),
        divisionName: this.ensureString(
          this.ensureString(club['Division Name'])
        ),
        areaId: this.ensureString(club['Area']),
        areaName: this.ensureString(this.ensureString(club['Area Name'])),
        membershipTrend: [],
        dcpGoalsTrend: [],
        currentStatus: 'healthy',
        riskFactors: [],
      })
    }

    // Build trends for each club
    for (const entry of dataEntries) {
      for (const club of entry.clubPerformance) {
        const clubId = this.ensureString(
          club['Club Number'] || club['Club ID'] || club['ClubID']
        )
        if (!clubId || !clubMap.has(clubId)) continue

        const clubTrend = clubMap.get(clubId)!
        const membership = this.parseIntSafe(
          club['Active Members'] ||
            club['Active Membership'] ||
            club['Membership']
        )
        const dcpGoals = this.parseIntSafe(club['Goals Met'])

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

    // Analyze each club for risk factors and status
    for (const clubTrend of clubMap.values()) {
      this.assessClubHealth(clubTrend)

      // Find the latest club data for this club to calculate net growth
      const latestClubData = latestEntry.clubPerformance.find(club => {
        const clubId = this.ensureString(
          club['Club Number'] || club['Club ID'] || club['ClubID']
        )
        return clubId === clubTrend.clubId
      })

      this.identifyDistinguishedLevel(clubTrend, latestClubData)
    }

    return Array.from(clubMap.values())
  }

  /**
   * Assess club health and identify risk factors
   */
  private assessClubHealth(clubTrend: ClubTrend): void {
    const riskFactors: string[] = []
    let status: ClubHealthStatus = 'healthy'

    // Get current membership
    const currentMembership =
      clubTrend.membershipTrend[clubTrend.membershipTrend.length - 1]?.count ||
      0

    // Check for critical membership
    if (currentMembership < 12) {
      riskFactors.push('Membership below 12 (critical)')
      status = 'critical'
    }

    // Check for declining membership (3+ months)
    if (clubTrend.membershipTrend.length >= 3) {
      const recent = clubTrend.membershipTrend.slice(-3)
      const isDeclining = recent.every((point, i) => {
        if (i === 0) return true
        return point.count < recent[i - 1].count
      })

      if (isDeclining) {
        riskFactors.push('Declining membership for 3+ months')
        if (status !== 'critical') {
          status = 'at-risk'
        }
      }
    }

    // Check for zero DCP goals
    const currentDcpGoals =
      clubTrend.dcpGoalsTrend[clubTrend.dcpGoalsTrend.length - 1]
        ?.goalsAchieved || 0

    if (currentDcpGoals === 0) {
      riskFactors.push('Zero DCP goals achieved')
      if (status !== 'critical') {
        status = 'at-risk'
      }
    }

    clubTrend.riskFactors = riskFactors
    clubTrend.currentStatus = status
  }

  /**
   * Determine the distinguished level for a club based on DCP goals, membership, and net growth
   * @param dcpGoals Number of DCP goals achieved
   * @param membership Current membership count
   * @param netGrowth Net membership growth (current - base)
   * @returns Distinguished level string or 'None' if no level achieved
   */
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

  /**
   * Identify distinguished level for a club
   */
  private identifyDistinguishedLevel(
    clubTrend: ClubTrend,
    latestClubData?: ScrapedRecord
  ): void {
    const currentDcpGoals =
      clubTrend.dcpGoalsTrend[clubTrend.dcpGoalsTrend.length - 1]
        ?.goalsAchieved || 0

    const currentMembership =
      clubTrend.membershipTrend[clubTrend.membershipTrend.length - 1]?.count ||
      0

    // Calculate net growth if we have the raw club data
    let netGrowth = 0
    if (latestClubData) {
      netGrowth = this.calculateNetGrowth(latestClubData)
    }

    // Use the shared distinguished level determination logic
    const distinguishedLevel = this.determineDistinguishedLevel(
      currentDcpGoals,
      currentMembership,
      netGrowth
    )

    // Map the level to the appropriate property name for ClubTrend
    if (distinguishedLevel === 'Smedley') {
      clubTrend.distinguishedLevel = 'Smedley'
    } else if (distinguishedLevel === 'Presidents') {
      clubTrend.distinguishedLevel = 'President'
    } else if (distinguishedLevel === 'Select') {
      clubTrend.distinguishedLevel = 'Select'
    } else if (distinguishedLevel === 'Distinguished') {
      clubTrend.distinguishedLevel = 'Distinguished'
    }
    // If level is 'None', don't set distinguishedLevel (leave undefined)
  }

  /**
   * Calculate net growth for a club using available membership data
   * Net growth = Active Members - Mem. Base
   * Handles missing, null, or invalid "Mem. Base" values by treating as 0
   */
  private calculateNetGrowth(club: ScrapedRecord): number {
    const currentMembers = this.parseIntSafe(
      club['Active Members'] || club['Active Membership'] || club['Membership']
    )

    const membershipBase = this.parseIntSafe(club['Mem. Base'])

    return currentMembers - membershipBase
  }

  /**
   * Calculate distinguished clubs from latest data
   *
   * Official DCP Levels (2025-2026):
   * - Smedley Distinguished: 10 goals + 25 members
   * - President's Distinguished: 9 goals + 20 members
   * - Select Distinguished: 7 goals + (20 members OR net growth of 5)
   * - Distinguished: 5 goals + (20 members OR net growth of 3)
   *
   * IMPORTANT: Membership counts reflect members who have paid their April renewal dues.
   * - Clubs can be officially declared distinguished on or after April 1st once April renewals are processed
   * - The "Active Members" field represents the membership count at the snapshot date
   * - For dates April 1 - June 30: membership counts are valid for official distinguished status
   * - For dates before April 1: membership counts are preliminary/in-progress tracking only
   *
   * Note: Net growth requirements are simplified in this implementation and only check
   * absolute membership count. Full implementation would require comparing to base membership.
   */
  private calculateDistinguishedClubs(entry: DistrictCacheEntry): {
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
      const dcpGoals = this.parseIntSafe(club['Goals Met'])
      const membership = this.parseIntSafe(
        club['Active Members'] ||
          club['Active Membership'] ||
          club['Membership']
      )
      const netGrowth = this.calculateNetGrowth(club)

      // Use the shared distinguished level determination logic
      const distinguishedLevel = this.determineDistinguishedLevel(
        dcpGoals,
        membership,
        netGrowth
      )

      // Count clubs by distinguished level
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
      if (process.env.NODE_ENV === 'development') {
        logger.debug('Distinguished status calculation', {
          clubId: club['Club Number'],
          clubName: club['Club Name'],
          dcpGoals,
          membership,
          membershipBase: this.parseIntSafe(club['Mem. Base']),
          netGrowth,
          distinguishedLevel,
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

  /**
   * Analyze divisions
   */
  private analyzeDivisions(
    dataEntries: DistrictCacheEntry[]
  ): DivisionAnalytics[] {
    const latestEntry = dataEntries[dataEntries.length - 1]
    const divisionMap = new Map<string, DivisionAnalytics>()

    // Aggregate data by division
    for (const club of latestEntry.clubPerformance) {
      const divisionId = this.ensureString(club['Division'])
      const divisionName =
        this.ensureString(club['Division Name']) || divisionId

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
        })
      }

      const division = divisionMap.get(divisionId)!
      division.totalClubs++

      const dcpGoals = this.parseIntSafe(club['Goals Met'])
      division.totalDcpGoals += isNaN(dcpGoals) ? 0 : dcpGoals
    }

    // Calculate average club health (simplified: based on DCP goals)
    for (const division of divisionMap.values()) {
      division.averageClubHealth =
        division.totalClubs > 0
          ? division.totalDcpGoals / division.totalClubs
          : 0
    }

    // Rank divisions by total DCP goals
    const divisions = Array.from(divisionMap.values())
    divisions.sort((a, b) => b.totalDcpGoals - a.totalDcpGoals)
    divisions.forEach((div, index) => {
      div.rank = index + 1
    })

    // Detect trends (requires multiple data points)
    if (dataEntries.length >= 2) {
      this.detectDivisionTrends(divisions, dataEntries)
    }

    return divisions
  }

  /**
   * Detect division trends
   */
  private detectDivisionTrends(
    divisions: DivisionAnalytics[],
    dataEntries: DistrictCacheEntry[]
  ): void {
    // Compare current to previous period
    if (dataEntries.length < 2) return

    const previousEntry = dataEntries[dataEntries.length - 2]

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
   */
  private getDivisionDcpGoals(
    entry: DistrictCacheEntry,
    divisionId: string
  ): number {
    return entry.clubPerformance
      .filter(club => club['Division'] === divisionId)
      .reduce((sum, club) => {
        const dcpGoals = this.parseIntSafe(club['Goals Met'])
        return sum + (isNaN(dcpGoals) ? 0 : dcpGoals)
      }, 0)
  }

  /**
   * Analyze areas
   */
  private analyzeAreas(entry: DistrictCacheEntry): AreaAnalytics[] {
    const areaMap = new Map<string, AreaAnalytics>()

    for (const club of entry.clubPerformance) {
      const areaId = this.ensureString(club['Area'])
      const areaName = this.ensureString(club['Area Name']) || areaId
      const divisionId = this.ensureString(club['Division'])

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
        })
      }

      const area = areaMap.get(areaId)!
      area.totalClubs++

      const dcpGoals = this.parseIntSafe(club['Goals Met'])
      area.totalDcpGoals += isNaN(dcpGoals) ? 0 : dcpGoals
    }

    // Calculate normalized scores
    const areas = Array.from(areaMap.values())
    for (const area of areas) {
      area.averageClubHealth =
        area.totalClubs > 0 ? area.totalDcpGoals / area.totalClubs : 0
      area.normalizedScore = area.averageClubHealth
    }

    // Sort by normalized score
    areas.sort((a, b) => b.normalizedScore - a.normalizedScore)

    return areas.slice(0, 10) // Return top 10 areas
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

        const first = club.membershipTrend[0].count
        const last = club.membershipTrend[club.membershipTrend.length - 1].count
        const growth = last - first

        return { clubId: club.clubId, clubName: club.clubName, growth }
      })
      .filter(club => club.growth > 0)
      .sort((a, b) => b.growth - a.growth)
      .slice(0, 10)

    return growthClubs
  }

  /**
   * Project distinguished clubs to end of year
   */
  private projectDistinguishedClubs(dataEntries: DistrictCacheEntry[]): number {
    if (dataEntries.length < 2) {
      // Not enough data for projection, return current count + small growth
      const latest = dataEntries[0]
      const current = this.calculateDistinguishedClubs(latest).total
      return Math.max(1, current + 1) // Ensure at least 1 for projection
    }

    // Simple linear projection based on trend
    const distinguishedCounts = dataEntries.map(
      entry => this.calculateDistinguishedClubs(entry).total
    )

    const current = distinguishedCounts[distinguishedCounts.length - 1]
    const previous = distinguishedCounts[distinguishedCounts.length - 2]
    const trend = current - previous

    // Project forward (assuming similar growth rate)
    const projection = Math.max(1, current + Math.max(1, trend * 2))

    return Math.round(projection)
  }

  /**
   * Count healthy clubs in an entry
   */
  private countHealthyClubs(entry: DistrictCacheEntry): number {
    return entry.clubPerformance.filter(club => {
      const membership = this.parseIntSafe(
        club['Active Members'] ||
          club['Active Membership'] ||
          club['Membership']
      )
      const dcpGoals = this.parseIntSafe(club['Goals Met'])

      return membership >= 12 && dcpGoals > 0
    }).length
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
    const latestDate = membershipTrend[membershipTrend.length - 1].date
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
    const currentMembership = membershipTrend[membershipTrend.length - 1].count

    return currentMembership - startMembership
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

        const first = club.membershipTrend[0].count
        const last = club.membershipTrend[club.membershipTrend.length - 1].count
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
      const currentPoint = membershipTrend[i]
      const previousPoint = membershipTrend[i - 1]

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
        monthName: monthNames[month - 1],
        averageChange: Math.round(averageChange * 10) / 10, // Round to 1 decimal
        trend,
      })
    }

    // Sort by month
    patterns.sort((a, b) => a.month - b.month)

    return patterns
  }

  /**
   * Calculate year-over-year membership comparison
   */
  private async calculateMembershipYearOverYear(
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
    const currentDate = latestEntry.date

    // Calculate previous year date (subtract 1 year)
    const currentYear = parseInt(currentDate.substring(0, 4))
    const previousYearDate = `${currentYear - 1}${currentDate.substring(4)}`

    try {
      const previousEntry = await this.cacheManager.getDistrictData(
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

  /**
   * Calculate distinguished club projection based on trends
   * Requirement 7.2
   */
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

  /**
   * Track dates when clubs achieve distinguished levels
   * Requirement 7.3
   */
  private trackDistinguishedAchievements(
    dataEntries: DistrictCacheEntry[]
  ): DistinguishedClubAchievement[] {
    const achievements: DistinguishedClubAchievement[] = []
    const clubLevelHistory = new Map<string, { level?: string; date: string }>()

    // Process entries chronologically
    for (const entry of dataEntries) {
      for (const club of entry.clubPerformance) {
        const clubId = this.ensureString(
          club['Club Number'] || club['Club ID'] || club['ClubID']
        )
        const clubName = this.ensureString(
          club['Club Name'] || club['ClubName']
        )
        const dcpGoals = this.parseIntSafe(club['Goals Met'])
        const membership = this.parseIntSafe(club['Active Members'])

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

  /**
   * Check if level1 is higher than level2
   */
  private isHigherLevel(level1: string, level2: string): boolean {
    const levels = { Distinguished: 1, Select: 2, President: 3, Smedley: 4 }
    return (
      (levels[level1 as keyof typeof levels] || 0) >
      (levels[level2 as keyof typeof levels] || 0)
    )
  }

  /**
   * Calculate year-over-year distinguished club comparison
   * Requirement 7.4
   */
  private async calculateDistinguishedYearOverYear(
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

      const currentEntry = await this.cacheManager.getDistrictData(
        districtId,
        currentDate
      )
      const previousEntry = await this.cacheManager.getDistrictData(
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

  /**
   * Get the appropriate field name for Level 4/Path Completion/DTM awards
   * based on the data structure (handles different program year formats)
   */
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

  /**
   * Analyze DCP goals to identify most/least commonly achieved
   * Requirement 7.5
   */
  private analyzeDCPGoals(entry: DistrictCacheEntry): {
    mostCommonlyAchieved: DCPGoalAnalysis[]
    leastCommonlyAchieved: DCPGoalAnalysis[]
  } {
    // DCP has 10 goals (numbered 1-10)
    const goalCounts = new Array(10).fill(0)
    const totalClubs = entry.clubPerformance.length

    // Count how many clubs achieved each goal using actual CSV data
    for (const club of entry.clubPerformance) {
      // Goal 1: Level 1 awards (need 4)
      const level1s = this.parseIntSafe(club['Level 1s'])
      if (level1s >= 4) goalCounts[0]++

      // Goal 2: Level 2 awards (need 2)
      const level2s = this.parseIntSafe(club['Level 2s'])
      if (level2s >= 2) goalCounts[1]++

      // Goal 3: More Level 2 awards (need 2 base + 2 additional = 4 total)
      const addLevel2s = this.parseIntSafe(club['Add. Level 2s'])
      if (level2s >= 2 && addLevel2s >= 2) goalCounts[2]++

      // Goal 4: Level 3 awards (need 2)
      const level3s = this.parseIntSafe(club['Level 3s'])
      if (level3s >= 2) goalCounts[3]++

      // Goal 5 & 6: Level 4/Path Completion/DTM awards
      const { baseField, additionalField } = this.getLevel4FieldName(club)
      const level4s = this.parseIntSafe(club[baseField])
      const addLevel4s = this.parseIntSafe(club[additionalField])

      // Goal 5: Need 1 Level 4 award
      if (level4s >= 1) goalCounts[4]++

      // Goal 6: Need 1 base + 1 additional = 2 total
      if (level4s >= 1 && addLevel4s >= 1) goalCounts[5]++

      // Goal 7: New members (need 4)
      const newMembers = this.parseIntSafe(club['New Members'])
      if (newMembers >= 4) goalCounts[6]++

      // Goal 8: More new members (need 4 base + 4 additional = 8 total)
      const addNewMembers = this.parseIntSafe(club['Add. New Members'])
      if (newMembers >= 4 && addNewMembers >= 4) goalCounts[7]++

      // Goal 9: Club officer roles trained (need 4 in Round 1 and 4 in Round 2)
      const trainedRound1 = this.parseIntSafe(club['Off. Trained Round 1'])
      const trainedRound2 = this.parseIntSafe(club['Off. Trained Round 2'])
      if (trainedRound1 >= 4 && trainedRound2 >= 4) goalCounts[8]++

      // Goal 10: Membership-renewal dues on time & Club officer list on time
      const duesOct = this.parseIntSafe(club['Mem. dues on time Oct'])
      const duesApr = this.parseIntSafe(club['Mem. dues on time Apr'])
      const officerList = this.parseIntSafe(club['Off. List On Time'])
      // Goal 10 requires officer list on time AND at least one dues payment on time
      if (officerList >= 1 && (duesOct >= 1 || duesApr >= 1)) goalCounts[9]++
    }

    // Create analysis for each goal
    const goalAnalysis: DCPGoalAnalysis[] = goalCounts.map((count, index) => ({
      goalNumber: index + 1,
      achievementCount: count,
      achievementPercentage:
        totalClubs > 0
          ? Math.round((count / totalClubs) * 1000) / 10 // Round to 1 decimal
          : 0,
    }))

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

      // Calculate leadership effectiveness scores (Requirement 8.1)
      const leadershipScores =
        this.calculateLeadershipEffectiveness(dataEntries)

      // Identify best practice divisions (Requirement 8.2)
      const bestPracticeDivisions = this.identifyBestPracticeDivisions(
        leadershipScores,
        dataEntries
      )

      // Track performance changes with leadership changes (Requirement 8.3)
      const leadershipChanges = this.trackLeadershipChanges(dataEntries)

      // Identify area director activity correlations (Requirement 8.4)
      const areaDirectorCorrelations =
        this.analyzeAreaDirectorCorrelations(dataEntries)

      // Generate summary report (Requirement 8.5)
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
   * Weighted: 40% health, 30% growth, 30% DCP
   * Requirement 8.1
   */
  private calculateLeadershipEffectiveness(
    dataEntries: DistrictCacheEntry[]
  ): LeadershipEffectivenessScore[] {
    const latestEntry = dataEntries[dataEntries.length - 1]
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
        const divisionId = this.ensureString(club['Division'])
        const divisionName =
          this.ensureString(club['Division Name']) || divisionId

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

        // Add to historical data
        let dateEntry = division.historicalData.find(h => h.date === entry.date)
        if (!dateEntry) {
          dateEntry = { date: entry.date, clubs: [] }
          division.historicalData.push(dateEntry)
        }
        dateEntry.clubs.push(club)

        // Update current clubs list if this is the latest entry
        if (entry === latestEntry) {
          division.clubs.push(club)
        }
      }
    }

    // Calculate scores for each division
    const scores: LeadershipEffectivenessScore[] = []

    for (const division of divisionMap.values()) {
      // Calculate health score (0-100)
      const healthScore = this.calculateDivisionHealthScore(division.clubs)

      // Calculate growth score (0-100)
      const growthScore = this.calculateDivisionGrowthScore(
        division.historicalData
      )

      // Calculate DCP score (0-100)
      const dcpScore = this.calculateDivisionDCPScore(division.clubs)

      // Calculate weighted overall score: 40% health, 30% growth, 30% DCP
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
        rank: 0, // Will be set after sorting
        isBestPractice: false, // Will be set by identifyBestPracticeDivisions
      })
    }

    // Rank divisions by overall score
    scores.sort((a, b) => b.overallScore - a.overallScore)
    scores.forEach((score, index) => {
      score.rank = index + 1
    })

    return scores
  }

  /**
   * Calculate division health score based on club health metrics
   */
  private calculateDivisionHealthScore(clubs: ScrapedRecord[]): number {
    if (clubs.length === 0) return 0

    let healthyClubs = 0
    let totalMembership = 0
    let clubsWithMinimumMembers = 0

    for (const club of clubs) {
      const membership = this.parseIntSafe(
        club['Active Members'] ||
          club['Active Membership'] ||
          club['Membership']
      )
      const dcpGoals = this.parseIntSafe(club['Goals Met'])

      totalMembership += membership

      // Healthy club criteria
      if (membership >= 12 && dcpGoals > 0) {
        healthyClubs++
      }

      if (membership >= 20) {
        clubsWithMinimumMembers++
      }
    }

    const averageMembership = totalMembership / clubs.length
    const healthyClubPercentage = (healthyClubs / clubs.length) * 100
    const strongMembershipPercentage =
      (clubsWithMinimumMembers / clubs.length) * 100

    // Weighted health score
    // 50% based on healthy club percentage
    // 30% based on average membership (normalized to 0-100, assuming 30 is excellent)
    // 20% based on strong membership percentage
    const healthScore =
      healthyClubPercentage * 0.5 +
      Math.min((averageMembership / 30) * 100, 100) * 0.3 +
      strongMembershipPercentage * 0.2

    return healthScore
  }

  /**
   * Calculate division growth score based on membership trends
   */
  private calculateDivisionGrowthScore(
    historicalData: Array<{ date: string; clubs: ScrapedRecord[] }>
  ): number {
    if (historicalData.length < 2) return 50 // Neutral score if no trend data

    // Calculate total membership for each date
    const membershipByDate = historicalData.map(entry => {
      const totalMembership = entry.clubs.reduce((sum, club) => {
        const membership = this.parseIntSafe(
          club['Active Members'] ||
            club['Active Membership'] ||
            club['Membership']
        )
        return sum + membership
      }, 0)
      return { date: entry.date, membership: totalMembership }
    })

    // Calculate growth rate
    const firstMembership = membershipByDate[0].membership
    const lastMembership =
      membershipByDate[membershipByDate.length - 1].membership
    const growthRate =
      firstMembership > 0
        ? ((lastMembership - firstMembership) / firstMembership) * 100
        : 0

    // Convert growth rate to 0-100 score
    // +10% growth = 100, 0% growth = 50, -10% growth = 0
    const growthScore = Math.max(0, Math.min(100, 50 + growthRate * 5))

    return growthScore
  }

  /**
   * Calculate division DCP score based on goal achievement
   */
  private calculateDivisionDCPScore(clubs: ScrapedRecord[]): number {
    if (clubs.length === 0) return 0

    let totalDcpGoals = 0
    let maxPossibleGoals = clubs.length * 10 // Each club can achieve 10 goals

    for (const club of clubs) {
      const dcpGoals = this.parseIntSafe(club['Goals Met'])
      totalDcpGoals += dcpGoals
    }

    // Calculate percentage of maximum possible goals achieved
    const dcpScore = (totalDcpGoals / maxPossibleGoals) * 100

    return dcpScore
  }

  /**
   * Identify consistently high-performing divisions as "Best Practices"
   * Requirement 8.2
   */
  private identifyBestPracticeDivisions(
    leadershipScores: LeadershipEffectivenessScore[],
    dataEntries: DistrictCacheEntry[]
  ): LeadershipEffectivenessScore[] {
    // Best practice criteria:
    // 1. Overall score >= 75
    // 2. Consistent performance (if we have historical data)
    // 3. Top 20% of divisions

    const threshold = 75
    const topPercentile = Math.ceil(leadershipScores.length * 0.2)

    const bestPractices: LeadershipEffectivenessScore[] = []

    for (let i = 0; i < leadershipScores.length; i++) {
      const score = leadershipScores[i]

      // Check if division meets best practice criteria
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

  /**
   * Check if a division has consistent performance over time
   */
  private isDivisionConsistent(
    divisionId: string,
    dataEntries: DistrictCacheEntry[]
  ): boolean {
    if (dataEntries.length < 3) return true // Not enough data to determine consistency

    // Calculate DCP goals for each time period
    const dcpGoalsByDate: number[] = []

    for (const entry of dataEntries) {
      const divisionClubs = entry.clubPerformance.filter(
        club => club['Division'] === divisionId
      )

      const totalDcpGoals = divisionClubs.reduce((sum, club) => {
        const dcpGoals = this.parseIntSafe(club['Goals Met'])
        return sum + dcpGoals
      }, 0)

      dcpGoalsByDate.push(totalDcpGoals)
    }

    // Check for consistency (no major drops)
    for (let i = 1; i < dcpGoalsByDate.length; i++) {
      const previous = dcpGoalsByDate[i - 1]
      const current = dcpGoalsByDate[i]

      // If current is less than 70% of previous, it's not consistent
      if (previous > 0 && current < previous * 0.7) {
        return false
      }
    }

    return true
  }

  /**
   * Track performance changes when leadership changes
   * Requirement 8.3
   *
   * Note: This is a simplified implementation as we don't have explicit
   * leadership change data. We detect significant performance shifts.
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

    // Build performance history for each division
    for (const entry of dataEntries) {
      const divisionScores = new Map<
        string,
        { totalDcp: number; totalClubs: number }
      >()

      for (const club of entry.clubPerformance) {
        const divisionId = this.ensureString(club['Division'])

        if (!divisionId) continue

        if (!divisionScores.has(divisionId)) {
          divisionScores.set(divisionId, { totalDcp: 0, totalClubs: 0 })
        }

        const divScore = divisionScores.get(divisionId)!
        const dcpGoals = this.parseIntSafe(club['Goals Met'])
        divScore.totalDcp += dcpGoals
        divScore.totalClubs++

        // Store division name for later
        if (!divisionPerformance.has(divisionId)) {
          divisionPerformance.set(divisionId, [])
        }
      }

      // Calculate average performance score for each division
      for (const [divisionId, score] of divisionScores.entries()) {
        const avgScore =
          score.totalClubs > 0 ? score.totalDcp / score.totalClubs : 0
        divisionPerformance.get(divisionId)!.push({
          date: entry.date,
          score: avgScore,
        })
      }
    }

    // Detect significant performance changes (potential leadership changes)
    for (const [divisionId, history] of divisionPerformance.entries()) {
      if (history.length < 3) continue

      for (let i = 2; i < history.length; i++) {
        // Compare average of previous 2 periods to current period
        const beforeAvg = (history[i - 2].score + history[i - 1].score) / 2
        const afterScore = history[i].score
        const delta = afterScore - beforeAvg

        // Significant change threshold: 20% or more
        if (Math.abs(delta) >= beforeAvg * 0.2 && beforeAvg > 0) {
          // Find division name from latest entry
          const divisionName = this.ensureString(
            dataEntries[dataEntries.length - 1].clubPerformance.find(
              club => club['Division'] === divisionId
            )?.['Division Name'] || divisionId
          )

          changes.push({
            divisionId,
            divisionName,
            changeDate: history[i].date,
            performanceBeforeChange: Math.round(beforeAvg * 10) / 10,
            performanceAfterChange: Math.round(afterScore * 10) / 10,
            performanceDelta: Math.round(delta * 10) / 10,
            trend: delta > 0 ? 'improved' : delta < 0 ? 'declined' : 'stable',
          })
        }
      }
    }

    // Sort by date (most recent first)
    changes.sort((a, b) => b.changeDate.localeCompare(a.changeDate))

    return changes
  }

  /**
   * Identify correlations between area director activity and club performance
   * Requirement 8.4
   *
   * Note: This is a simplified implementation as we don't have explicit
   * area director activity data. We infer activity from club performance patterns.
   */
  private analyzeAreaDirectorCorrelations(
    dataEntries: DistrictCacheEntry[]
  ): AreaDirectorCorrelation[] {
    const latestEntry = dataEntries[dataEntries.length - 1]
    const areaMap = new Map<
      string,
      {
        areaId: string
        areaName: string
        divisionId: string
        clubs: ScrapedRecord[]
        performanceScore: number
      }
    >()

    // Aggregate club data by area
    for (const club of latestEntry.clubPerformance) {
      const areaId = this.ensureString(club['Area'])
      const areaName = this.ensureString(club['Area Name']) || areaId
      const divisionId = this.ensureString(club['Division'])

      if (!areaId) continue

      if (!areaMap.has(areaId)) {
        areaMap.set(areaId, {
          areaId,
          areaName,
          divisionId,
          clubs: [],
          performanceScore: 0,
        })
      }

      areaMap.get(areaId)!.clubs.push(club)
    }

    // Calculate performance scores and infer activity levels
    const correlations: AreaDirectorCorrelation[] = []

    for (const area of areaMap.values()) {
      // Calculate club performance score
      let totalDcpGoals = 0
      let totalMembership = 0
      let healthyClubs = 0

      for (const club of area.clubs) {
        const dcpGoals = this.parseIntSafe(club['Goals Met'])
        const membership = this.parseIntSafe(
          club['Active Members'] ||
            club['Active Membership'] ||
            club['Membership']
        )

        totalDcpGoals += dcpGoals
        totalMembership += membership

        if (membership >= 12 && dcpGoals > 0) {
          healthyClubs++
        }
      }

      const avgDcpGoals =
        area.clubs.length > 0 ? totalDcpGoals / area.clubs.length : 0
      const avgMembership =
        area.clubs.length > 0 ? totalMembership / area.clubs.length : 0
      const healthyPercentage =
        area.clubs.length > 0 ? healthyClubs / area.clubs.length : 0

      // Calculate overall performance score (0-100)
      const performanceScore = Math.round(
        (avgDcpGoals / 10) * 40 + // DCP goals (40%)
          Math.min((avgMembership / 30) * 100, 100) * 0.3 + // Membership (30%)
          healthyPercentage * 100 * 0.3 // Health (30%)
      )

      // Infer activity level based on performance
      // High performance suggests high activity
      let activityIndicator: 'high' | 'medium' | 'low'
      if (performanceScore >= 70) {
        activityIndicator = 'high'
      } else if (performanceScore >= 40) {
        activityIndicator = 'medium'
      } else {
        activityIndicator = 'low'
      }

      // Determine correlation
      let correlation: 'positive' | 'neutral' | 'negative'
      if (activityIndicator === 'high' && performanceScore >= 70) {
        correlation = 'positive'
      } else if (activityIndicator === 'low' && performanceScore < 40) {
        correlation = 'negative'
      } else {
        correlation = 'neutral'
      }

      correlations.push({
        areaId: area.areaId,
        areaName: area.areaName,
        divisionId: area.divisionId,
        clubPerformanceScore: performanceScore,
        activityIndicator,
        correlation,
      })
    }

    // Sort by performance score (highest first)
    correlations.sort((a, b) => b.clubPerformanceScore - a.clubPerformanceScore)

    return correlations
  }

  /**
   * Generate summary report of top-performing divisions and areas
   * Requirement 8.5
   */
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
    // Get top 5 performing divisions
    const topPerformingDivisions = leadershipScores.slice(0, 5).map(score => ({
      divisionId: score.divisionId,
      divisionName: score.divisionName,
      score: score.overallScore,
    }))

    // Calculate top performing areas
    const latestEntry = dataEntries[dataEntries.length - 1]
    const areaScores = new Map<
      string,
      {
        areaId: string
        areaName: string
        totalDcp: number
        totalClubs: number
      }
    >()

    for (const club of latestEntry.clubPerformance) {
      const areaId = this.ensureString(club['Area'])
      const areaName = this.ensureString(club['Area Name']) || areaId

      if (!areaId) continue

      if (!areaScores.has(areaId)) {
        areaScores.set(areaId, {
          areaId,
          areaName,
          totalDcp: 0,
          totalClubs: 0,
        })
      }

      const area = areaScores.get(areaId)!
      const dcpGoals = this.parseIntSafe(club['Goals Met'])
      area.totalDcp += dcpGoals
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

    // Calculate average leadership score
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

  /**
   * Dispose of resources and cleanup
   * Implements proper disposal for test isolation and resource management
   */
  async dispose(): Promise<void> {
    // Clear internal caches
    this.clearCaches()

    // No other resources to dispose of currently
    // This method provides a clean disposal interface for dependency injection
    logger.debug('AnalyticsEngine disposed successfully')
  }
}
