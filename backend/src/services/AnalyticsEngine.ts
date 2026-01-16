/**
 * Analytics Engine
 * Processes cached district data to generate insights and analytics
 *
 * Uses IAnalyticsDataSource for data retrieval from PerDistrictSnapshotStore.
 * Delegates to specialized modules for specific analytics domains.
 *
 * Requirements: 1.1, 1.3, 1.4, 1.6, 1.7
 */

import {
  IAnalyticsEngine,
  IAnalyticsDataSource,
} from '../types/serviceInterfaces.js'
import { logger } from '../utils/logger.js'
import type {
  ClubTrend,
  DivisionAnalytics,
  DistrictAnalytics,
  MembershipAnalytics,
  DistinguishedClubAnalytics,
  YearOverYearComparison,
  DistrictPerformanceTargets,
  ITargetCalculatorService,
  IRegionRankingService,
} from '../types/analytics.js'
import type {
  DistrictCacheEntry,
  DistrictStatistics,
} from '../types/districts.js'
import { MembershipAnalyticsModule } from './analytics/MembershipAnalyticsModule.js'
import { DistinguishedClubAnalyticsModule } from './analytics/DistinguishedClubAnalyticsModule.js'
import { ClubHealthAnalyticsModule } from './analytics/ClubHealthAnalyticsModule.js'
import { DivisionAreaAnalyticsModule } from './analytics/DivisionAreaAnalyticsModule.js'
import { LeadershipAnalyticsModule } from './analytics/LeadershipAnalyticsModule.js'
import { AreaDivisionRecognitionModule } from './analytics/AreaDivisionRecognitionModule.js'
import { TargetCalculatorService } from './TargetCalculatorService.js'
import { RegionRankingService } from './RegionRankingService.js'
import {
  getDCPCheckpoint,
  getCurrentProgramMonth,
  findPreviousProgramYearDate,
  calculatePercentageChange,
  determineTrend,
} from './analytics/AnalyticsUtils.js'

export class AnalyticsEngine implements IAnalyticsEngine {
  private dataSource: IAnalyticsDataSource
  private readonly membershipModule: MembershipAnalyticsModule
  private readonly distinguishedModule: DistinguishedClubAnalyticsModule
  private readonly clubHealthModule: ClubHealthAnalyticsModule
  private readonly divisionAreaModule: DivisionAreaAnalyticsModule
  private readonly leadershipModule: LeadershipAnalyticsModule
  private readonly recognitionModule: AreaDivisionRecognitionModule
  private readonly targetCalculator: ITargetCalculatorService
  private readonly regionRankingService: IRegionRankingService

  /**
   * Create an AnalyticsEngine instance
   *
   * Requirements: 1.1, 1.4, 7.1, 7.2, 7.3, 7.4
   *
   * @param dataSource - IAnalyticsDataSource for snapshot-based data retrieval
   * @param targetCalculator - Optional ITargetCalculatorService for target calculations (defaults to TargetCalculatorService)
   * @param regionRankingService - Optional IRegionRankingService for region rankings (defaults to RegionRankingService)
   */
  constructor(
    dataSource: IAnalyticsDataSource,
    targetCalculator?: ITargetCalculatorService,
    regionRankingService?: IRegionRankingService
  ) {
    this.dataSource = dataSource
    this.membershipModule = new MembershipAnalyticsModule(dataSource)
    this.distinguishedModule = new DistinguishedClubAnalyticsModule(dataSource)
    this.clubHealthModule = new ClubHealthAnalyticsModule(dataSource)
    this.divisionAreaModule = new DivisionAreaAnalyticsModule(dataSource)
    this.leadershipModule = new LeadershipAnalyticsModule(dataSource)
    this.recognitionModule = new AreaDivisionRecognitionModule(dataSource)
    this.targetCalculator = targetCalculator ?? new TargetCalculatorService()
    this.regionRankingService =
      regionRankingService ?? new RegionRankingService()

    logger.info('AnalyticsEngine initialized', {
      operation: 'constructor',
    })
  }

  /**
   * Get the DCP goals checkpoint for a given month
   * Delegates to shared utility function.
   * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
   */
  public getDCPCheckpoint(month: number): number {
    return getDCPCheckpoint(month)
  }

  /**
   * Determine the current month for DCP checkpoint evaluation
   * Delegates to shared utility function.
   * Requirements: 2.1
   */
  public getCurrentProgramMonth(dateString?: string): number {
    return getCurrentProgramMonth(dateString)
  }

  /**
   * Clear internal caches (for testing purposes)
   */
  public clearCaches(): void {
    // No internal caches to clear - data source handles caching
  }

  /**
   * Map DistrictStatistics to DistrictCacheEntry format for compatibility
   * Requirements: 1.1, 1.3
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
   * Uses IAnalyticsDataSource for snapshot-based data retrieval.
   * Requirements: 1.1, 1.3, 2.1, 2.2, 2.3
   */
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
      if (!districtData) return null
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

  /**
   * Generate comprehensive district analytics
   * Composes analytics from specialized modules.
   * Requirements: 2.3, 2.4
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

      const dates = dataEntries.map(e => e.date).sort()
      const dateRange = {
        start: dates[0] || '',
        end: dates[dates.length - 1] || '',
      }

      const latestEntry = dataEntries[dataEntries.length - 1]
      if (!latestEntry) {
        throw new Error('No latest entry available for analytics')
      }

      // Use MembershipAnalyticsModule for membership metrics
      const membershipTrend = dataEntries.map(entry => ({
        date: entry.date,
        count: this.membershipModule.getTotalMembership(entry),
      }))
      const totalMembership =
        membershipTrend[membershipTrend.length - 1]?.count || 0
      const membershipChange =
        membershipTrend.length >= 2
          ? (membershipTrend[membershipTrend.length - 1]?.count ?? 0) -
            (membershipTrend[0]?.count ?? 0)
          : 0

      // Use ClubHealthAnalyticsModule for club health analysis
      const clubTrends = await this.clubHealthModule.analyzeClubTrends(
        districtId,
        dataEntries
      )
      const vulnerableClubs = clubTrends.filter(
        c => c.currentStatus === 'vulnerable'
      )
      const interventionRequiredClubs = clubTrends.filter(
        c => c.currentStatus === 'intervention-required'
      )
      const thrivingClubs = clubTrends.filter(
        c => c.currentStatus === 'thriving'
      )

      // Use DistinguishedClubAnalyticsModule for distinguished club counts
      const distinguishedClubs =
        this.distinguishedModule.calculateDistinguishedClubs(latestEntry)

      // Use DivisionAreaAnalyticsModule for division and area analysis
      const divisionRankings =
        this.divisionAreaModule.analyzeDivisions(dataEntries)
      const topPerformingAreas =
        this.divisionAreaModule.analyzeAreas(latestEntry)

      // Use AreaDivisionRecognitionModule for DAP/DDP recognition
      const divisionRecognition =
        this.recognitionModule.analyzeDivisionRecognition(latestEntry)

      // Calculate top growth clubs from club trends
      const topGrowthClubs = this.calculateTopGrowthClubs(clubTrends)

      // Calculate distinguished projection (equals thriving clubs count)
      const distinguishedProjection = this.projectDistinguishedClubs(
        dataEntries,
        thrivingClubs.length
      )

      // Use DistinguishedClubAnalyticsModule for comprehensive distinguished club analytics
      const distinguishedClubAnalytics =
        await this.distinguishedModule.generateDistinguishedClubAnalytics(
          districtId,
          startDate,
          endDate
        )

      // Build payments trend from snapshot rankings data
      // Requirements: membership-payments-chart 3.1, 3.2, 3.3
      const paymentsTrend = await this.buildPaymentsTrend(
        districtId,
        startDate,
        endDate
      )

      // Calculate year-over-year comparison
      const yearOverYearData =
        await this.membershipModule.calculateMembershipYearOverYear(
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
        const currentDate = latestEntry.date
        const currentYear = parseInt(currentDate.substring(0, 4))
        const previousYearDate = `${currentYear - 1}${currentDate.substring(4)}`

        try {
          const previousEntry = await this.getDistrictDataForDate(
            districtId,
            previousYearDate
          )
          if (previousEntry) {
            const currentDistinguished =
              this.distinguishedModule.calculateDistinguishedClubs(latestEntry)
            const previousDistinguished =
              this.distinguishedModule.calculateDistinguishedClubs(
                previousEntry
              )
            const distinguishedChange =
              previousDistinguished.total > 0
                ? Math.round(
                    ((currentDistinguished.total -
                      previousDistinguished.total) /
                      previousDistinguished.total) *
                      1000
                  ) / 10
                : 0

            const currentThrivingPercent =
              (thrivingClubs.length / clubTrends.length) * 100
            const previousClubTrends =
              await this.clubHealthModule.analyzeClubTrends(districtId, [
                previousEntry,
              ])
            const previousThrivingClubs = previousClubTrends.filter(
              c => c.currentStatus === 'thriving'
            ).length
            const previousThrivingPercent =
              previousClubTrends.length > 0
                ? (previousThrivingClubs / previousClubTrends.length) * 100
                : 0
            const clubHealthChange =
              Math.round(
                (currentThrivingPercent - previousThrivingPercent) * 10
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
        paymentsTrend: paymentsTrend.length > 0 ? paymentsTrend : undefined,
        topGrowthClubs,
        allClubs: clubTrends,
        vulnerableClubs,
        thrivingClubs,
        interventionRequiredClubs,
        distinguishedClubs,
        distinguishedProjection,
        distinguishedClubAnalytics,
        divisionRankings,
        topPerformingAreas,
        divisionRecognition,
        yearOverYear,
      }

      // Calculate performance targets and rankings
      // Requirements: 7.1, 7.2, 7.3, 7.4, 8.1, 8.2, 8.3
      const performanceTargets = await this.calculatePerformanceTargets(
        districtId,
        latestEntry.date,
        distinguishedClubs.total
      )
      if (performanceTargets) {
        analytics.performanceTargets = performanceTargets
      }

      logger.info('Generated district analytics', {
        districtId,
        dateRange,
        totalClubs: clubTrends.length,
        vulnerableClubs: vulnerableClubs.length,
        interventionRequiredClubs: interventionRequiredClubs.length,
        thrivingClubs: thrivingClubs.length,
        hasPerformanceTargets: !!performanceTargets,
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
   * Delegates to ClubHealthAnalyticsModule.
   * Requirements: 1.3, 2.1, 2.2
   */
  async getClubTrends(
    districtId: string,
    clubId: string
  ): Promise<ClubTrend | null> {
    return this.clubHealthModule.getClubTrends(districtId, clubId)
  }

  /**
   * Identify at-risk clubs
   * Delegates to ClubHealthAnalyticsModule.
   * Requirements: 1.3, 2.1, 2.2
   */
  async identifyAtRiskClubs(districtId: string): Promise<ClubTrend[]> {
    return this.clubHealthModule.identifyAtRiskClubs(districtId)
  }

  /**
   * Compare divisions
   * Delegates to DivisionAreaAnalyticsModule.
   * Requirements: 1.4, 2.1, 2.2
   */
  async compareDivisions(
    districtId: string,
    date: string
  ): Promise<DivisionAnalytics[]> {
    return this.divisionAreaModule.compareDivisions(districtId, date)
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
      const previousYearDate = findPreviousProgramYearDate(currentDate)

      const currentEntry = await this.getDistrictDataForDate(
        districtId,
        currentDate
      )
      const previousEntry = await this.getDistrictDataForDate(
        districtId,
        previousYearDate
      )

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

      const metrics = this.calculateYearOverYearMetrics(
        currentEntry,
        previousEntry
      )
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
   * Calculate percentage changes for all key metrics
   * Composes from specialized modules.
   * Requirements: 9.2, 2.3, 2.4
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
      thrivingClubs: {
        current: number
        previous: number
        change: number
        percentageChange: number
      }
      vulnerableClubs: {
        current: number
        previous: number
        change: number
        percentageChange: number
      }
      interventionRequiredClubs: {
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
    // Membership metrics - delegate to MembershipAnalyticsModule
    const currentMembership =
      this.membershipModule.getTotalMembership(currentEntry)
    const previousMembership =
      this.membershipModule.getTotalMembership(previousEntry)
    const membershipChange = currentMembership - previousMembership
    const membershipPercentageChange = calculatePercentageChange(
      previousMembership,
      currentMembership
    )

    // Distinguished clubs metrics - delegate to DistinguishedClubAnalyticsModule
    const currentDistinguished =
      this.distinguishedModule.calculateDistinguishedClubs(currentEntry)
    const previousDistinguished =
      this.distinguishedModule.calculateDistinguishedClubs(previousEntry)
    const distinguishedChange =
      currentDistinguished.total - previousDistinguished.total
    const distinguishedPercentageChange = calculatePercentageChange(
      previousDistinguished.total,
      currentDistinguished.total
    )

    // Club health metrics - delegate to ClubHealthAnalyticsModule
    const currentThriving =
      this.clubHealthModule.countThrivingClubs(currentEntry)
    const previousThriving =
      this.clubHealthModule.countThrivingClubs(previousEntry)
    const currentVulnerable =
      this.clubHealthModule.countVulnerableClubs(currentEntry)
    const previousVulnerable =
      this.clubHealthModule.countVulnerableClubs(previousEntry)
    const currentInterventionRequired =
      this.clubHealthModule.countInterventionRequiredClubs(currentEntry)
    const previousInterventionRequired =
      this.clubHealthModule.countInterventionRequiredClubs(previousEntry)

    // DCP goals metrics - delegate to DivisionAreaAnalyticsModule
    const currentTotalDcp =
      this.divisionAreaModule.getTotalDcpGoals(currentEntry)
    const previousTotalDcp =
      this.divisionAreaModule.getTotalDcpGoals(previousEntry)
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
        thrivingClubs: {
          current: currentThriving,
          previous: previousThriving,
          change: currentThriving - previousThriving,
          percentageChange: calculatePercentageChange(
            previousThriving,
            currentThriving
          ),
        },
        vulnerableClubs: {
          current: currentVulnerable,
          previous: previousVulnerable,
          change: currentVulnerable - previousVulnerable,
          percentageChange: calculatePercentageChange(
            previousVulnerable,
            currentVulnerable
          ),
        },
        interventionRequiredClubs: {
          current: currentInterventionRequired,
          previous: previousInterventionRequired,
          change: currentInterventionRequired - previousInterventionRequired,
          percentageChange: calculatePercentageChange(
            previousInterventionRequired,
            currentInterventionRequired
          ),
        },
      },
      dcpGoals: {
        totalGoals: {
          current: currentTotalDcp,
          previous: previousTotalDcp,
          change: currentTotalDcp - previousTotalDcp,
          percentageChange: calculatePercentageChange(
            previousTotalDcp,
            currentTotalDcp
          ),
        },
        averagePerClub: {
          current: Math.round(currentAvgDcp * 10) / 10,
          previous: Math.round(previousAvgDcp * 10) / 10,
          change: Math.round((currentAvgDcp - previousAvgDcp) * 10) / 10,
          percentageChange: calculatePercentageChange(
            previousAvgDcp,
            currentAvgDcp
          ),
        },
      },
      clubCount: {
        current: currentClubCount,
        previous: previousClubCount,
        change: currentClubCount - previousClubCount,
        percentageChange: calculatePercentageChange(
          previousClubCount,
          currentClubCount
        ),
      },
    }
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

      for (let i = 0; i < 3; i++) {
        const year = currentYear - i
        const yearDate = `${year}${currentDate.substring(4)}`
        const entry = await this.getDistrictDataForDate(districtId, yearDate)

        if (entry) {
          yearData.push({
            year,
            date: yearDate,
            membership: this.membershipModule.getTotalMembership(entry),
            distinguishedClubs:
              this.distinguishedModule.calculateDistinguishedClubs(entry).total,
            totalDcpGoals: this.divisionAreaModule.getTotalDcpGoals(entry),
            clubCount: entry.clubPerformance.length,
          })
        }
      }

      if (yearData.length < 3) {
        return { available: false }
      }

      yearData.sort((a, b) => a.year - b.year)

      return {
        available: true,
        years: yearData,
        trends: {
          membershipTrend: determineTrend(yearData.map(d => d.membership)),
          distinguishedTrend: determineTrend(
            yearData.map(d => d.distinguishedClubs)
          ),
          dcpGoalsTrend: determineTrend(yearData.map(d => d.totalDcpGoals)),
        },
      }
    } catch (error) {
      logger.warn('Failed to calculate multi-year trends', {
        districtId,
        currentDate,
        error,
      })
      return { available: false }
    }
  }

  /**
   * Generate comprehensive membership analytics
   * Delegates to MembershipAnalyticsModule.
   * Requirements: 1.1, 2.1, 2.2, 6.1, 6.2, 6.3, 6.4, 6.5
   */
  async generateMembershipAnalytics(
    districtId: string,
    startDate?: string,
    endDate?: string
  ): Promise<MembershipAnalytics> {
    return this.membershipModule.generateMembershipAnalytics(
      districtId,
      startDate,
      endDate
    )
  }

  /**
   * Generate comprehensive distinguished club analytics
   * Delegates to DistinguishedClubAnalyticsModule.
   * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
   */
  async generateDistinguishedClubAnalytics(
    districtId: string,
    startDate?: string,
    endDate?: string
  ): Promise<DistinguishedClubAnalytics> {
    return this.distinguishedModule.generateDistinguishedClubAnalytics(
      districtId,
      startDate,
      endDate
    )
  }

  /**
   * Generate leadership insights
   * Delegates to LeadershipAnalyticsModule.
   * Requirements: 1.5, 8.1, 8.2, 8.3, 8.4, 8.5
   */
  async generateLeadershipInsights(
    districtId: string,
    startDate?: string,
    endDate?: string
  ): Promise<import('../types/analytics.js').LeadershipInsights> {
    return this.leadershipModule.generateLeadershipInsights(
      districtId,
      startDate,
      endDate
    )
  }

  /**
   * Dispose of resources
   */
  async dispose(): Promise<void> {
    // No resources to dispose - modules don't hold persistent connections
    logger.info('AnalyticsEngine disposed')
  }

  /**
   * Calculate top growth clubs from club trends
   * Helper method for generateDistrictAnalytics
   */
  private calculateTopGrowthClubs(
    clubTrends: ClubTrend[]
  ): Array<{ clubId: string; clubName: string; growth: number }> {
    return clubTrends
      .map(club => {
        const trend = club.membershipTrend
        if (trend.length < 2)
          return { clubId: club.clubId, clubName: club.clubName, growth: 0 }
        const first = trend[0]?.count ?? 0
        const last = trend[trend.length - 1]?.count ?? 0
        return {
          clubId: club.clubId,
          clubName: club.clubName,
          growth: last - first,
        }
      })
      .filter(club => club.growth > 0)
      .sort((a, b) => b.growth - a.growth)
      .slice(0, 10)
  }

  /**
   * Build payments trend from snapshot rankings data
   * Helper method for generateDistrictAnalytics
   *
   * Extracts totalPayments from each snapshot's district ranking data
   * to build a time series of payment data.
   *
   * Requirements: membership-payments-chart 3.1, 3.2, 3.3
   *
   * @param districtId - The district ID
   * @param startDate - Start date for the range
   * @param endDate - End date for the range
   * @returns Array of payment trend data points, sorted by date ascending
   */
  private async buildPaymentsTrend(
    districtId: string,
    startDate?: string,
    endDate?: string
  ): Promise<Array<{ date: string; payments: number }>> {
    try {
      const snapshots = await this.dataSource.getSnapshotsInRange(
        startDate,
        endDate
      )

      const paymentsTrend: Array<{ date: string; payments: number }> = []

      for (const snapshotInfo of snapshots) {
        const rankings = await this.dataSource.getAllDistrictsRankings(
          snapshotInfo.snapshotId
        )

        if (rankings) {
          const districtRanking = rankings.rankings.find(
            r => r.districtId === districtId
          )

          if (districtRanking && districtRanking.totalPayments !== undefined) {
            paymentsTrend.push({
              date: snapshotInfo.dataAsOfDate,
              payments: districtRanking.totalPayments,
            })
          }
        }
      }

      // Sort by date ascending
      paymentsTrend.sort((a, b) => a.date.localeCompare(b.date))

      return paymentsTrend
    } catch (error) {
      logger.warn('Failed to build payments trend', {
        districtId,
        startDate,
        endDate,
        error,
      })
      return []
    }
  }

  /**
   * Project distinguished clubs based on thriving clubs count
   * Helper method for generateDistrictAnalytics
   *
   * Projected year-end distinguished clubs equals the current thriving clubs count,
   * as thriving clubs are on track to achieve distinguished status by year end.
   */
  private projectDistinguishedClubs(
    dataEntries: DistrictCacheEntry[],
    thrivingClubsCount?: number
  ): number {
    // If thriving clubs count is provided, use it directly as the projection
    if (thrivingClubsCount !== undefined) {
      return thrivingClubsCount
    }

    // Fallback: calculate from latest entry if no thriving count provided
    const latestEntry = dataEntries[dataEntries.length - 1]
    if (!latestEntry) return 0

    return this.distinguishedModule.calculateDistinguishedClubs(latestEntry)
      .total
  }

  /**
   * Calculate performance targets and rankings for a district
   *
   * Computes recognition level targets for paid clubs, membership payments,
   * and distinguished clubs. Also calculates world rank, region rank, and
   * world percentile for each metric.
   *
   * Requirements: 7.1, 7.2, 7.3, 7.4, 8.1, 8.2, 8.3
   *
   * @param districtId - The district ID
   * @param snapshotId - The snapshot ID to get rankings from
   * @param currentDistinguishedClubs - Current count of distinguished clubs
   * @returns DistrictPerformanceTargets or null if data unavailable
   */
  private async calculatePerformanceTargets(
    districtId: string,
    snapshotId: string,
    currentDistinguishedClubs: number
  ): Promise<DistrictPerformanceTargets | null> {
    try {
      // Get all districts rankings data for region ranking calculations
      const allDistrictsRankings =
        await this.dataSource.getAllDistrictsRankings(snapshotId)

      if (!allDistrictsRankings || allDistrictsRankings.rankings.length === 0) {
        logger.warn(
          'No all-districts rankings data available for performance targets',
          {
            districtId,
            snapshotId,
          }
        )
        return null
      }

      // Find the current district in the rankings
      const districtRanking = allDistrictsRankings.rankings.find(
        r => r.districtId === districtId
      )

      if (!districtRanking) {
        logger.warn('District not found in rankings data', {
          districtId,
          snapshotId,
          totalRankings: allDistrictsRankings.rankings.length,
        })
        return null
      }

      // Use the rankings directly - they already match the DistrictRanking interface from snapshots.ts
      const totalDistricts = allDistrictsRankings.rankings.length

      // Calculate paid clubs targets and rankings
      const paidClubsTargets = this.targetCalculator.calculatePaidClubsTargets(
        districtRanking.paidClubBase,
        districtRanking.paidClubs
      )
      const paidClubsRankings = this.regionRankingService.buildMetricRankings(
        districtId,
        'clubs',
        districtRanking.clubsRank,
        totalDistricts,
        allDistrictsRankings.rankings
      )

      // Calculate membership payments targets and rankings
      const paymentsTargets = this.targetCalculator.calculatePaymentsTargets(
        districtRanking.paymentBase,
        districtRanking.totalPayments
      )
      const paymentsRankings = this.regionRankingService.buildMetricRankings(
        districtId,
        'payments',
        districtRanking.paymentsRank,
        totalDistricts,
        allDistrictsRankings.rankings
      )

      // Calculate distinguished clubs targets and rankings
      const distinguishedTargets =
        this.targetCalculator.calculateDistinguishedTargets(
          districtRanking.paidClubBase, // Uses Club_Base for percentage calculation
          currentDistinguishedClubs
        )
      const distinguishedRankings =
        this.regionRankingService.buildMetricRankings(
          districtId,
          'distinguished',
          districtRanking.distinguishedRank,
          totalDistricts,
          allDistrictsRankings.rankings
        )

      const performanceTargets: DistrictPerformanceTargets = {
        paidClubs: {
          current: districtRanking.paidClubs,
          base: paidClubsTargets.base,
          targets: paidClubsTargets.targets,
          achievedLevel: paidClubsTargets.achievedLevel,
          rankings: paidClubsRankings,
        },
        membershipPayments: {
          current: districtRanking.totalPayments,
          base: paymentsTargets.base,
          targets: paymentsTargets.targets,
          achievedLevel: paymentsTargets.achievedLevel,
          rankings: paymentsRankings,
        },
        distinguishedClubs: {
          current: currentDistinguishedClubs,
          base: distinguishedTargets.base,
          targets: distinguishedTargets.targets,
          achievedLevel: distinguishedTargets.achievedLevel,
          rankings: distinguishedRankings,
        },
      }

      logger.debug('Calculated performance targets', {
        districtId,
        snapshotId,
        paidClubsBase: paidClubsTargets.base,
        paymentsBase: paymentsTargets.base,
        hasTargets: !!paidClubsTargets.targets,
      })

      return performanceTargets
    } catch (error) {
      logger.error('Failed to calculate performance targets', {
        districtId,
        snapshotId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      return null
    }
  }
}
