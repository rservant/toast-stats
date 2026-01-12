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
import type { DistrictStatistics } from '../../types/districts.js'
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
   * Execute per-district collection using cached data
   * Reads from the Raw CSV Cache and builds snapshots using RefreshService
   *
   * Note: This method now reads from cached data only. If data is not in the cache,
   * the scraper-cli tool must be run first to populate the cache.
   */
  private async executePerDistrictCollection(
    params: RefreshParams
  ): Promise<DistrictStatistics[]> {
    logger.info('Executing per-district collection from cached data', {
      params,
      districtIds: params.districtIds?.length || 0,
      operation: 'executePerDistrictCollection',
    })

    if (!params.districtIds || params.districtIds.length === 0) {
      throw new Error('District IDs required for per-district collection')
    }

    try {
      // Extract the date from params for historical data fetching
      // Use current date as fallback if not provided
      const dateString =
        params.date || new Date().toISOString().split('T')[0] || ''

      // Use RefreshService to build a snapshot from cached data for the specified date
      // RefreshService now uses SnapshotBuilder which reads from the cache
      logger.info(
        'Building snapshot from cached data for per-district collection',
        {
          date: dateString,
          targetDistricts: params.districtIds,
          operation: 'executePerDistrictCollection',
        }
      )

      const refreshResult = await this.refreshService.executeRefresh(dateString)

      if (!refreshResult.success) {
        // If cache data is not available, provide a helpful error message
        const errorMessage = refreshResult.errors.join('; ')
        if (
          errorMessage.includes('No cached data available') ||
          errorMessage.includes('cache')
        ) {
          throw new Error(
            `No cached data available for date ${dateString}. Please run scraper-cli to collect data first: npx scraper-cli scrape --date ${dateString}`
          )
        }
        throw new Error(`RefreshService execution failed: ${errorMessage}`)
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

      // Filter to only the requested districts
      const filteredDistricts = snapshot.payload.districts.filter(
        (district: DistrictStatistics) =>
          params.districtIds!.includes(district.districtId)
      )

      logger.info('Per-district collection from cache completed', {
        date: dateString,
        requestedDistricts: params.districtIds.length,
        availableDistricts: snapshot.payload.districts.length,
        filteredDistricts: filteredDistricts.length,
        snapshotId: refreshResult.snapshot_id,
        operation: 'executePerDistrictCollection',
      })

      // Apply ranking calculation if ranking calculator is available and we have results
      if (this.rankingCalculator && filteredDistricts.length > 0) {
        logger.info('Applying ranking calculation to collected districts', {
          districtCount: filteredDistricts.length,
          rankingVersion: this.rankingCalculator.getRankingVersion(),
          operation: 'executePerDistrictCollection',
        })

        try {
          const rankedResults =
            await this.rankingCalculator.calculateRankings(filteredDistricts)

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
              districtCount: filteredDistricts.length,
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
            districtCount: filteredDistricts.length,
            operation: 'executePerDistrictCollection',
          }
        )
      }

      return filteredDistricts
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
}
