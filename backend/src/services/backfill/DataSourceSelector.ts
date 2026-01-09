/**
 * Data Source Selector for intelligent collection strategy selection
 *
 * Manages collection strategy selection and delegates to RefreshService methods
 * for data acquisition during backfill operations.
 */

import { logger } from '../../utils/logger.js'
import { RetryManager } from '../../utils/RetryManager.js'
import { RateLimiter, RateLimiterManager } from '../../utils/RateLimiter.js'
import { RefreshService } from '../RefreshService.js'
import type { RankingCalculator } from '../RankingCalculator.js'
import type {
  DistrictStatistics,
  ScrapedRecord,
} from '../../types/districts.js'
import type { SnapshotStore } from '../../types/snapshots.js'
import type {
  BackfillRequest,
  BackfillData,
  CollectionStrategy,
  RefreshMethod,
  RefreshParams,
} from './types.js'

export class DataSourceSelector {
  private snapshotStore: SnapshotStore
  private rateLimiter: RateLimiter
  private rankingCalculator?: RankingCalculator

  constructor(
    private refreshService: RefreshService,
    snapshotStore?: SnapshotStore,
    rankingCalculator?: RankingCalculator
  ) {
    // Get snapshot store from RefreshService if not provided
    this.snapshotStore =
      snapshotStore ||
      (refreshService as unknown as { snapshotStore: SnapshotStore })
        .snapshotStore
    if (rankingCalculator !== undefined) {
      this.rankingCalculator = rankingCalculator
    }

    if (!this.snapshotStore) {
      throw new Error('SnapshotStore is required for DataSourceSelector')
    }

    // Initialize rate limiter for data source protection (Requirement 9.1)
    this.rateLimiter = RateLimiterManager.getRateLimiter(
      'data-source-selector',
      {
        maxRequests: 1000, // Slightly higher limit for data source selector
        windowMs: 3000, // 3 second window
        minDelayMs: 1000, // Minimum 1 second between requests
        maxDelayMs: 20000, // Maximum 20 seconds backoff
        backoffMultiplier: 1.2,
      }
    )
  }

  selectCollectionStrategy(request: BackfillRequest): CollectionStrategy {
    const targetCount = request.targetDistricts?.length || 0
    const collectionType = request.collectionType || 'auto'

    // Auto-select strategy based on scope and requirements
    if (collectionType === 'auto') {
      if (targetCount === 0) {
        // System-wide collection
        return {
          type: 'system-wide',
          refreshMethod: {
            name: 'getAllDistricts',
            params: {},
          },
          rationale: 'System-wide collection for all configured districts',
          estimatedEfficiency: 0.9,
        }
      } else if (targetCount === 1) {
        // Single district - use per-district method
        return {
          type: 'per-district',
          refreshMethod: {
            name: 'getDistrictPerformance',
            params: { districtIds: request.targetDistricts },
          },
          rationale:
            'Per-district collection for single district with detailed data',
          estimatedEfficiency: 0.8,
          targetDistricts: request.targetDistricts,
        }
      } else {
        // Multiple districts - use targeted approach
        return {
          type: 'targeted',
          refreshMethod: {
            name: 'getMultipleDistricts',
            params: { districtIds: request.targetDistricts },
          },
          rationale: 'Targeted collection for multiple specific districts',
          estimatedEfficiency: 0.7,
          targetDistricts: request.targetDistricts,
        }
      }
    }

    // Use explicit collection type
    switch (collectionType) {
      case 'system-wide':
        return {
          type: 'system-wide',
          refreshMethod: {
            name: 'getAllDistricts',
            params: {},
          },
          rationale: 'Explicit system-wide collection requested',
          estimatedEfficiency: 0.9,
        }

      case 'per-district':
        return {
          type: 'per-district',
          refreshMethod: {
            name: 'getDistrictPerformance',
            params: { districtIds: request.targetDistricts },
          },
          rationale: 'Explicit per-district collection requested',
          estimatedEfficiency: 0.8,
          targetDistricts: request.targetDistricts,
        }

      default:
        throw new Error(`Unsupported collection type: ${collectionType}`)
    }
  }

  async executeCollection(
    strategy: CollectionStrategy,
    date: string,
    districts?: string[]
  ): Promise<BackfillData> {
    logger.info(
      'Executing collection strategy with enhanced error handling and performance optimizations',
      {
        strategy: strategy.type,
        method: strategy.refreshMethod.name,
        date,
        districts: districts?.length || 0,
        operation: 'executeCollection',
      }
    )

    const startTime = Date.now()

    try {
      // Execute with rate limiting and retry logic for transient failures (Requirements 9.1)
      const retryResult = await RetryManager.executeWithRetry(
        async () => {
          // Apply rate limiting before making the request
          await this.rateLimiter.waitForNext()
          this.rateLimiter.consumeToken()

          return await this.delegateToRefreshService(strategy.refreshMethod, {
            ...strategy.refreshMethod.params,
            date,
          })
        },
        {
          maxAttempts: 3,
          baseDelayMs: 2000,
          maxDelayMs: 30000,
          backoffMultiplier: 2,
          retryableErrors: (error: Error) => {
            const message = error.message.toLowerCase()
            return (
              message.includes('network') ||
              message.includes('timeout') ||
              message.includes('econnreset') ||
              message.includes('enotfound') ||
              message.includes('econnrefused') ||
              message.includes('500') ||
              message.includes('502') ||
              message.includes('503') ||
              message.includes('504') ||
              message.includes('rate limit') ||
              message.includes('temporary')
            )
          },
        },
        {
          strategy: strategy.type,
          method: strategy.refreshMethod.name,
          date,
          operation: 'executeCollection',
        }
      )

      if (!retryResult.success) {
        throw (
          retryResult.error ||
          new Error('Collection execution failed after retries')
        )
      }

      const refreshServiceData = retryResult.result!
      const processingTime = Date.now() - startTime

      const backfillData: BackfillData = {
        source: 'refresh-service',
        method: strategy.refreshMethod,
        date,
        districts: districts || [],
        snapshotData: refreshServiceData,
        metadata: {
          collectionStrategy: strategy,
          processingTime,
          successCount: refreshServiceData.length,
          failureCount: 0,
          errors: [],
        },
      }

      logger.info(
        'Collection strategy executed successfully with rate limiting and retry support',
        {
          strategy: strategy.type,
          method: strategy.refreshMethod.name,
          date,
          districtCount: refreshServiceData.length,
          processingTime,
          retryAttempts: retryResult.attempts,
          rateLimiterStatus: this.rateLimiter.getStatus(),
          operation: 'executeCollection',
        }
      )

      return backfillData
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      const processingTime = Date.now() - startTime

      logger.error('Collection strategy execution failed after all retries', {
        strategy: strategy.type,
        method: strategy.refreshMethod.name,
        date,
        error: errorMessage,
        processingTime,
        rateLimiterStatus: this.rateLimiter.getStatus(),
        operation: 'executeCollection',
      })

      throw new Error(`Collection execution failed: ${errorMessage}`)
    }
  }

  private async delegateToRefreshService(
    method: RefreshMethod,
    params: RefreshParams
  ): Promise<DistrictStatistics[]> {
    logger.debug('Delegating to RefreshService', {
      method: method.name,
      params,
      operation: 'delegateToRefreshService',
    })

    try {
      switch (method.name) {
        case 'getAllDistricts':
          return await this.executeSystemWideCollection(params)

        case 'getDistrictPerformance':
          return await this.executePerDistrictCollection(params)

        case 'getMultipleDistricts':
          return await this.executeTargetedCollection(params)

        default:
          throw new Error(`Unsupported RefreshService method: ${method.name}`)
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('RefreshService delegation failed', {
        method: method.name,
        params,
        error: errorMessage,
        operation: 'delegateToRefreshService',
      })
      throw new Error(`RefreshService delegation failed: ${errorMessage}`)
    }
  }

  /**
   * Execute system-wide collection using RefreshService
   * Leverages RefreshService.executeRefresh() for comprehensive data collection
   */
  private async executeSystemWideCollection(
    params: RefreshParams
  ): Promise<DistrictStatistics[]> {
    logger.info('Executing system-wide collection via RefreshService', {
      params,
      operation: 'executeSystemWideCollection',
    })

    try {
      // Use RefreshService's executeRefresh method for system-wide collection
      const refreshResult = await this.refreshService.executeRefresh()

      if (!refreshResult.success) {
        throw new Error(
          `RefreshService execution failed: ${refreshResult.errors.join('; ')}`
        )
      }

      // Get the created snapshot to extract district data
      if (!refreshResult.snapshot_id) {
        throw new Error('RefreshService did not create a snapshot')
      }

      const snapshot = await this.snapshotStore.getSnapshot(
        refreshResult.snapshot_id
      )
      if (!snapshot) {
        throw new Error(`Snapshot ${refreshResult.snapshot_id} not found`)
      }

      logger.info('System-wide collection completed successfully', {
        snapshotId: refreshResult.snapshot_id,
        districtCount: snapshot.payload.districts.length,
        status: refreshResult.status,
        operation: 'executeSystemWideCollection',
      })

      return snapshot.payload.districts
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('System-wide collection failed', {
        error: errorMessage,
        operation: 'executeSystemWideCollection',
      })
      throw new Error(`System-wide collection failed: ${errorMessage}`)
    }
  }

  /**
   * Execute per-district collection using RefreshService methods
   * Uses RefreshService's district-specific scraping capabilities
   */
  private async executePerDistrictCollection(
    params: RefreshParams
  ): Promise<DistrictStatistics[]> {
    logger.info('Executing per-district collection via RefreshService', {
      params,
      districtIds: params.districtIds?.length || 0,
      operation: 'executePerDistrictCollection',
    })

    if (!params.districtIds || params.districtIds.length === 0) {
      throw new Error('District IDs required for per-district collection')
    }

    try {
      const results: DistrictStatistics[] = []

      // Create our own scraper instance for per-district collection
      // BackfillService should be independent and not rely on RefreshService internals
      const { ToastmastersScraper } = await import('../ToastmastersScraper.js')
      const { getProductionServiceFactory } =
        await import('../ProductionServiceFactory.js')

      // Get cache service from production factory
      const serviceFactory = getProductionServiceFactory()
      const rawCSVCacheService = serviceFactory.createRawCSVCacheService()
      const scraper = new ToastmastersScraper(rawCSVCacheService)

      // Extract the date from params for historical data fetching
      // Use current date as fallback if not provided
      const dateString =
        params.date || new Date().toISOString().split('T')[0] || ''

      // Fetch and cache the all-districts CSV for this date
      // This ensures we have the summary/rankings data for historical backfill
      // IMPORTANT: Use getAllDistrictsWithMetadata to get the actual "As of" date
      let actualCsvDate = dateString // Default to requested date
      try {
        logger.info('Fetching all-districts CSV for backfill date', {
          date: dateString,
          operation: 'executePerDistrictCollection',
        })

        const allDistrictsResult =
          await scraper.getAllDistrictsWithMetadata(dateString)
        actualCsvDate = allDistrictsResult.actualDate

        logger.info('All-districts CSV fetched and cached successfully', {
          requestedDate: dateString,
          actualDate: actualCsvDate,
          recordCount: allDistrictsResult.records.length,
          operation: 'executePerDistrictCollection',
        })
      } catch (error) {
        // Log warning but continue with per-district collection
        // The all-districts CSV is useful but not strictly required for per-district data
        // However, we should use the requested date as the asOfDate in this case
        logger.warn(
          'Failed to fetch all-districts CSV for backfill date, continuing with per-district collection using requested date',
          {
            date: dateString,
            error: error instanceof Error ? error.message : 'Unknown error',
            operation: 'executePerDistrictCollection',
          }
        )
      }

      for (const districtId of params.districtIds) {
        try {
          logger.debug('Collecting data for district', {
            districtId,
            date: dateString,
            operation: 'executePerDistrictCollection',
          })

          // Fetch district-specific data using the scraper with proper error handling
          // Pass the date parameter to fetch historical data for backfill operations
          let districtPerformanceData: ScrapedRecord[] = []
          let divisionPerformanceData: ScrapedRecord[] = []
          let clubPerformanceData: ScrapedRecord[] = []

          try {
            districtPerformanceData = await scraper.getDistrictPerformance(
              districtId,
              dateString
            )
            logger.debug('District performance data fetched successfully', {
              districtId,
              date: dateString,
              recordCount: districtPerformanceData.length,
              operation: 'executePerDistrictCollection',
            })
          } catch (error) {
            logger.warn(
              'District performance data not available, using empty data',
              {
                districtId,
                date: dateString,
                error: error instanceof Error ? error.message : 'Unknown error',
                operation: 'executePerDistrictCollection',
              }
            )
          }

          try {
            divisionPerformanceData = await scraper.getDivisionPerformance(
              districtId,
              dateString
            )
            logger.debug('Division performance data fetched successfully', {
              districtId,
              date: dateString,
              recordCount: divisionPerformanceData.length,
              operation: 'executePerDistrictCollection',
            })
          } catch (error) {
            logger.warn(
              'Division performance data not available, using empty data',
              {
                districtId,
                date: dateString,
                error: error instanceof Error ? error.message : 'Unknown error',
                operation: 'executePerDistrictCollection',
              }
            )
          }

          try {
            clubPerformanceData = await scraper.getClubPerformance(
              districtId,
              dateString
            )
            logger.debug('Club performance data fetched successfully', {
              districtId,
              date: dateString,
              recordCount: clubPerformanceData.length,
              operation: 'executePerDistrictCollection',
            })
          } catch (error) {
            logger.warn('Failed to fetch club performance data for district', {
              districtId,
              date: dateString,
              error: error instanceof Error ? error.message : 'Unknown error',
              operation: 'executePerDistrictCollection',
            })
            // Continue to next district if club data fails - club data is most important
            continue
          }

          // Check if we have at least some club data (most important)
          if (!clubPerformanceData || clubPerformanceData.length === 0) {
            logger.warn('No club performance data available for district', {
              districtId,
              date: dateString,
              operation: 'executePerDistrictCollection',
            })
            continue
          }

          // Normalize the district data with available data
          // Use the actual CSV date from the All Districts fetch
          const districtStats = await this.normalizeDistrictData(
            districtId,
            {
              districtPerformance: districtPerformanceData,
              divisionPerformance: divisionPerformanceData,
              clubPerformance: clubPerformanceData,
            },
            actualCsvDate
          )

          results.push(districtStats)

          logger.debug('Successfully collected district data', {
            districtId,
            date: dateString,
            districtRecords: districtPerformanceData.length,
            divisionRecords: divisionPerformanceData.length,
            clubRecords: clubPerformanceData.length,
            operation: 'executePerDistrictCollection',
          })
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error'
          logger.warn('Failed to collect data for district', {
            districtId,
            date: dateString,
            error: errorMessage,
            operation: 'executePerDistrictCollection',
          })
          // Continue with other districts
        }
      }

      logger.info('Per-district collection completed', {
        date: dateString,
        requestedDistricts: params.districtIds.length,
        successfulDistricts: results.length,
        operation: 'executePerDistrictCollection',
      })

      // Apply ranking calculation if ranking calculator is available
      if (this.rankingCalculator && results.length > 0) {
        logger.info('Applying ranking calculation to collected districts', {
          districtCount: results.length,
          rankingVersion: this.rankingCalculator.getRankingVersion(),
          operation: 'executePerDistrictCollection',
        })

        try {
          const rankedResults =
            await this.rankingCalculator.calculateRankings(results)

          logger.info('Ranking calculation completed successfully', {
            districtCount: rankedResults.length,
            rankedDistrictCount: rankedResults.filter(
              (d: DistrictStatistics) => d.ranking
            ).length,
            rankingVersion: this.rankingCalculator.getRankingVersion(),
            operation: 'executePerDistrictCollection',
          })

          return rankedResults
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error'
          logger.error(
            'Ranking calculation failed, continuing without rankings',
            {
              error: errorMessage,
              districtCount: results.length,
              operation: 'executePerDistrictCollection',
            }
          )
          // Continue with original results without ranking data
        }
      } else {
        logger.debug(
          'No ranking calculator provided or no successful districts, skipping ranking calculation',
          {
            hasRankingCalculator: !!this.rankingCalculator,
            rankingCalculatorType: this.rankingCalculator?.constructor?.name,
            districtCount: results.length,
            operation: 'executePerDistrictCollection',
          }
        )
      }

      return results
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Per-district collection failed', {
        error: errorMessage,
        operation: 'executePerDistrictCollection',
      })
      throw new Error(`Per-district collection failed: ${errorMessage}`)
    }
  }

  /**
   * Execute targeted collection for multiple districts
   * Optimized approach for collecting data from specific districts
   */
  private async executeTargetedCollection(
    params: RefreshParams
  ): Promise<DistrictStatistics[]> {
    logger.info('Executing targeted collection via RefreshService', {
      params,
      districtIds: params.districtIds?.length || 0,
      operation: 'executeTargetedCollection',
    })

    if (!params.districtIds || params.districtIds.length === 0) {
      throw new Error('District IDs required for targeted collection')
    }

    try {
      // For targeted collection with multiple districts, we can use a hybrid approach:
      // 1. If we have many districts, use system-wide collection and filter
      // 2. If we have few districts, use per-district collection

      const districtCount = params.districtIds.length
      const THRESHOLD_FOR_SYSTEM_WIDE = 10 // Configurable threshold

      if (districtCount >= THRESHOLD_FOR_SYSTEM_WIDE) {
        logger.info(
          'Using system-wide collection with filtering for targeted collection',
          {
            districtCount,
            threshold: THRESHOLD_FOR_SYSTEM_WIDE,
            operation: 'executeTargetedCollection',
          }
        )

        // Use system-wide collection and filter results
        const allDistricts = await this.executeSystemWideCollection(params)
        const filteredDistricts = allDistricts.filter(district =>
          params.districtIds!.includes(district.districtId)
        )

        logger.info('Filtered system-wide results for targeted collection', {
          totalDistricts: allDistricts.length,
          filteredDistricts: filteredDistricts.length,
          requestedDistricts: params.districtIds.length,
          operation: 'executeTargetedCollection',
        })

        return filteredDistricts
      } else {
        logger.info('Using per-district collection for targeted collection', {
          districtCount,
          threshold: THRESHOLD_FOR_SYSTEM_WIDE,
          operation: 'executeTargetedCollection',
        })

        // Use per-district collection for smaller sets
        return await this.executePerDistrictCollection(params)
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Targeted collection failed', {
        error: errorMessage,
        operation: 'executeTargetedCollection',
      })
      throw new Error(`Targeted collection failed: ${errorMessage}`)
    }
  }

  /**
   * Normalize district data from scraper results
   * Converts raw scraper data into DistrictStatistics format
   *
   * @param districtId - The district ID
   * @param data - Raw scraped data for the district
   * @param asOfDate - The actual "as of" date from the CSV data (not today's date)
   */
  private async normalizeDistrictData(
    districtId: string,
    data: {
      districtPerformance: ScrapedRecord[]
      divisionPerformance: ScrapedRecord[]
      clubPerformance: ScrapedRecord[]
    },
    asOfDate: string
  ): Promise<DistrictStatistics> {
    logger.debug('Normalizing district data', {
      districtId,
      districtRecords: data.districtPerformance.length,
      divisionRecords: data.divisionPerformance.length,
      clubRecords: data.clubPerformance.length,
      asOfDate,
      operation: 'normalizeDistrictData',
    })

    try {
      // Extract membership data from club performance
      const totalMembership = this.extractMembershipTotal(data.clubPerformance)
      const clubMembership = this.extractClubMembership(data.clubPerformance)

      // Count club statistics
      const totalClubs = data.clubPerformance.length
      const activeClubs = this.countActiveClubs(data.clubPerformance)
      const distinguishedClubs = this.countDistinguishedClubs(
        data.clubPerformance
      )

      const districtStats: DistrictStatistics = {
        districtId,
        asOfDate,
        membership: {
          total: totalMembership,
          change: 0, // Historical change calculation would require previous data
          changePercent: 0,
          byClub: clubMembership,
        },
        clubs: {
          total: totalClubs,
          active: activeClubs,
          suspended: totalClubs - activeClubs,
          ineligible: 0, // Would need specific status field
          low: 0, // Would need membership threshold logic
          distinguished: distinguishedClubs,
        },
        education: {
          totalAwards: 0, // Would need education data extraction
          byType: [],
          topClubs: [],
        },
        // Preserve raw data for compatibility
        districtPerformance: data.districtPerformance,
        divisionPerformance: data.divisionPerformance,
        clubPerformance: data.clubPerformance,
      }

      logger.debug('District data normalized successfully', {
        districtId,
        totalMembership,
        totalClubs,
        activeClubs,
        distinguishedClubs,
        operation: 'normalizeDistrictData',
      })

      return districtStats
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to normalize district data', {
        districtId,
        error: errorMessage,
        operation: 'normalizeDistrictData',
      })
      throw new Error(
        `Failed to normalize district data for ${districtId}: ${errorMessage}`
      )
    }
  }

  /**
   * Extract total membership from club performance data
   */
  private extractMembershipTotal(clubPerformance: ScrapedRecord[]): number {
    let total = 0
    for (const club of clubPerformance) {
      const members =
        club['Active Members'] ||
        club['Membership'] ||
        club['Members'] ||
        club['Base Members']
      if (typeof members === 'string') {
        const parsed = parseInt(members, 10)
        if (!isNaN(parsed)) {
          total += parsed
        }
      } else if (typeof members === 'number') {
        total += members
      }
    }
    return total
  }

  /**
   * Extract club membership data with proper typing
   */
  private extractClubMembership(clubPerformance: ScrapedRecord[]): Array<{
    clubId: string
    clubName: string
    memberCount: number
  }> {
    return clubPerformance
      .map(club => ({
        clubId: String(
          club['Club Number'] || club['ClubId'] || club['Club ID'] || ''
        ),
        clubName: String(club['Club Name'] || club['ClubName'] || ''),
        memberCount: this.parseNumber(
          club['Active Members'] ||
            club['Membership'] ||
            club['Members'] ||
            club['Base Members'] ||
            0
        ),
      }))
      .filter(club => club.clubId && club.clubName)
  }

  /**
   * Count active clubs from performance data
   */
  private countActiveClubs(clubPerformance: ScrapedRecord[]): number {
    return clubPerformance.filter(club => {
      const status = club['Club Status'] || club['Status']
      return !status || String(status).toLowerCase() !== 'suspended'
    }).length
  }

  /**
   * Count distinguished clubs from performance data
   */
  private countDistinguishedClubs(clubPerformance: ScrapedRecord[]): number {
    return clubPerformance.filter(club => {
      const distinguished =
        club['Club Distinguished Status'] ||
        club['Distinguished'] ||
        club['DCP Status']
      return (
        distinguished &&
        String(distinguished).toLowerCase().includes('distinguished')
      )
    }).length
  }

  /**
   * Parse a number from various input types
   */
  private parseNumber(value: unknown): number {
    if (typeof value === 'number') return value
    if (typeof value === 'string') {
      const parsed = parseInt(value.replace(/[^\d]/g, ''), 10)
      return isNaN(parsed) ? 0 : parsed
    }
    return 0
  }
}
