/**
 * Unified BackfillService - Complete rewrite replacing existing services
 *
 * Main orchestrator for all backfill operations with modern API design,
 * comprehensive error handling, and performance optimizations.
 */

import { logger } from '../../utils/logger.js'
import {
  CircuitBreaker,
  CircuitBreakerManager,
  ICircuitBreakerManager,
} from '../../utils/CircuitBreaker.js'
import { AlertManager } from '../../utils/AlertManager.js'
import { RateLimiter, RateLimiterManager } from '../../utils/RateLimiter.js'
import {
  ConcurrencyLimiter,
  ConcurrencyLimiterManager,
} from '../../utils/ConcurrencyLimiter.js'
import {
  IntermediateCache,
  IntermediateCacheManager,
} from '../../utils/IntermediateCache.js'
import { RefreshService } from '../RefreshService.js'
import { PerDistrictFileSnapshotStore } from '../PerDistrictSnapshotStore.js'
import { DistrictConfigurationService } from '../DistrictConfigurationService.js'
import type { RankingCalculator } from '../RankingCalculator.js'
import type { DistrictStatistics } from '../../types/districts.js'
import type {
  Snapshot,
  NormalizedData,
  AllDistrictsRankingsData,
  DistrictRanking,
} from '../../types/snapshots.js'

import { JobManager } from './JobManager.js'
import { DataSourceSelector } from './DataSourceSelector.js'
import { ScopeManager } from './ScopeManager.js'
import type {
  BackfillRequest,
  BackfillResponse,
  BackfillScope,
  BackfillJob,
  CollectionStrategy,
  DistrictError,
  PartialSnapshotResult,
} from './types.js'

export class BackfillService {
  private jobManager: JobManager
  private dataSourceSelector: DataSourceSelector
  private scopeManager: ScopeManager
  private snapshotStore: PerDistrictFileSnapshotStore
  // Infrastructure components for future use
  // @ts-expect-error - These will be used in future implementations
  private _alertManager: AlertManager
  // @ts-expect-error - These will be used in future implementations
  private _refreshService: RefreshService
  private configService: DistrictConfigurationService
  // @ts-expect-error - These will be used in future implementations
  private _dashboardCircuitBreaker: CircuitBreaker
  // @ts-expect-error - These will be used in future implementations
  private _cacheCircuitBreaker: CircuitBreaker
  private rankingCalculator?: RankingCalculator

  // Performance optimization components (Requirement 9.1, 9.2, 9.3)
  private rateLimiter: RateLimiter
  private concurrencyLimiter: ConcurrencyLimiter
  private intermediateCache: IntermediateCache<DistrictStatistics[]>

  constructor(
    refreshService: RefreshService,
    snapshotStore: PerDistrictFileSnapshotStore,
    configService: DistrictConfigurationService,
    alertManager?: AlertManager,
    circuitBreakerManager?: ICircuitBreakerManager,
    rankingCalculator?: RankingCalculator
  ) {
    this._refreshService = refreshService
    this.snapshotStore = snapshotStore
    this.configService = configService
    this._alertManager = alertManager || new AlertManager()
    if (rankingCalculator !== undefined) {
      this.rankingCalculator = rankingCalculator
    }

    // Initialize managers
    this.jobManager = new JobManager()
    this.dataSourceSelector = new DataSourceSelector(
      refreshService,
      snapshotStore,
      rankingCalculator
    )
    this.scopeManager = new ScopeManager(configService)

    // Initialize circuit breakers
    const circuitManager = circuitBreakerManager || new CircuitBreakerManager()
    this._dashboardCircuitBreaker = circuitManager.getCircuitBreaker(
      'unified-backfill-dashboard',
      {
        failureThreshold: 5,
        recoveryTimeout: 60000,
        monitoringPeriod: 10000,
      }
    )
    this._cacheCircuitBreaker = circuitManager.getCircuitBreaker(
      'unified-backfill-cache',
      {
        failureThreshold: 3,
        recoveryTimeout: 30000,
        monitoringPeriod: 5000,
      }
    )

    // Initialize performance optimization components (Requirements 9.1, 9.2, 9.3)
    this.rateLimiter = RateLimiterManager.getRateLimiter('unified-backfill', {
      maxRequests: 10, // Max 10 requests per minute to protect external sources
      windowMs: 60000, // 1 minute window
      minDelayMs: 2000, // Minimum 2 seconds between requests
      maxDelayMs: 30000, // Maximum 30 seconds backoff
      backoffMultiplier: 2,
    })

    this.concurrencyLimiter = ConcurrencyLimiterManager.getLimiter(
      'unified-backfill',
      {
        maxConcurrent: 3, // Default max 3 concurrent district operations
        timeoutMs: 300000, // 5 minute timeout for acquiring slot
        queueLimit: 20, // Max 20 operations in queue
      }
    )

    this.intermediateCache = IntermediateCacheManager.getCache(
      'unified-backfill',
      {
        defaultTtlMs: 3600000, // 1 hour TTL for intermediate results
        maxEntries: 1000, // Max 1000 cached results
        maxSizeBytes: 50 * 1024 * 1024, // 50MB cache size limit
        useLruEviction: true,
        cleanupIntervalMs: 300000, // Cleanup every 5 minutes
      }
    )

    logger.info(
      'Unified BackfillService initialized with performance optimizations and ranking calculator',
      {
        operation: 'constructor',
        hasRankingCalculator: !!this.rankingCalculator,
        rankingVersion: this.rankingCalculator?.getRankingVersion(),
        circuitBreakers: [
          'unified-backfill-dashboard',
          'unified-backfill-cache',
        ],
        rateLimiter: {
          maxRequests: 10,
          windowMs: 60000,
          minDelayMs: 2000,
        },
        concurrencyLimiter: {
          maxConcurrent: 3,
          timeoutMs: 300000,
          queueLimit: 20,
        },
        intermediateCache: {
          defaultTtlMs: 3600000,
          maxEntries: 1000,
          maxSizeBytes: 50 * 1024 * 1024,
        },
      }
    )
  }

  /**
   * Initiate a backfill operation with modern API design and comprehensive error handling
   */
  async initiateBackfill(request: BackfillRequest): Promise<string> {
    logger.info('Initiating unified backfill operation', {
      targetDistricts: request.targetDistricts?.length || 0,
      startDate: request.startDate,
      endDate: request.endDate,
      collectionType: request.collectionType,
      operation: 'initiateBackfill',
    })

    try {
      // Step 0: Validate date range - reject today's date
      const today = new Date()
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

      const effectiveEndDate = request.endDate || request.startDate
      if (effectiveEndDate >= todayStr) {
        throw new Error(
          `End date must be before today (${todayStr}). The Toastmasters dashboard data is always 1-2 days behind, so today's data is not yet available. Please use yesterday's date or earlier.`
        )
      }

      // Step 1: Enhanced scope validation with violation handling
      const targetDistricts =
        await this.scopeManager.getTargetDistricts(request)
      const filterResult = await this.scopeManager.filterValidDistricts(
        targetDistricts,
        true
      )

      // Check if we have any valid districts to process
      if (filterResult.validDistricts.length === 0) {
        const configuredDistricts =
          await this.configService.getConfiguredDistricts()
        const errorMessage =
          filterResult.invalidDistricts.length > 0
            ? `No valid districts to process. All requested districts are out of scope: [${filterResult.invalidDistricts.join(', ')}]. Configured districts: [${configuredDistricts.join(', ')}]`
            : 'No districts available for processing'

        throw new Error(errorMessage)
      }

      // Create scope with filtered districts
      const configuredDistricts =
        await this.configService.getConfiguredDistricts()
      const scope: BackfillScope = {
        targetDistricts: filterResult.validDistricts,
        configuredDistricts,
        scopeType: this.scopeManager.determineScopeType(
          filterResult.validDistricts,
          configuredDistricts
        ),
        validationPassed: true,
      }

      // Log scope violations if any
      if (filterResult.invalidDistricts.length > 0) {
        logger.warn(
          'Backfill initiated with scope violations - invalid districts excluded',
          {
            totalRequested: targetDistricts.length,
            validDistricts: filterResult.validDistricts.length,
            invalidDistricts: filterResult.invalidDistricts.length,
            excludedDistricts: filterResult.invalidDistricts,
            violations: filterResult.scopeViolations.map(v => ({
              districtId: v.districtId,
              message: v.message,
            })),
            operation: 'initiateBackfill',
          }
        )
      }

      // Step 2: Create job
      const job = this.jobManager.createJob(request, scope)

      // Step 3: Select collection strategy
      const strategy = this.dataSourceSelector.selectCollectionStrategy({
        ...request,
        targetDistricts: filterResult.validDistricts,
      })
      job.collectionStrategy = strategy

      // Step 4: Start background processing
      this.processBackfill(job.backfillId, {
        ...request,
        targetDistricts: filterResult.validDistricts,
      }).catch(error => {
        logger.error('Backfill processing failed', {
          backfillId: job.backfillId,
          error: error instanceof Error ? error.message : 'Unknown error',
          operation: 'initiateBackfill',
        })

        const failedJob = this.jobManager.getJob(job.backfillId)
        if (failedJob) {
          failedJob.status = 'error'
          failedJob.error =
            error instanceof Error ? error.message : 'Unknown error occurred'
          failedJob.completedAt = Date.now()
        }
      })

      logger.info('Unified backfill initiated successfully', {
        backfillId: job.backfillId,
        scopeType: scope.scopeType,
        strategy: strategy.type,
        targetDistricts: scope.targetDistricts.length,
        excludedDistricts: filterResult.invalidDistricts.length,
        operation: 'initiateBackfill',
      })

      return job.backfillId
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      logger.error('Failed to initiate backfill', {
        error: errorMessage,
        operation: 'initiateBackfill',
      })

      throw new Error(`Failed to initiate backfill: ${errorMessage}`)
    }
  }

  /**
   * Get backfill job status with comprehensive error information and performance metrics
   */
  getBackfillStatus(backfillId: string): BackfillResponse | null {
    const job = this.jobManager.getJob(backfillId)

    if (!job) {
      return null
    }

    // Create error summary
    const errorSummary =
      job.progress.totalErrors > 0
        ? {
            totalErrors: job.progress.totalErrors,
            retryableErrors: job.progress.retryableErrors,
            permanentErrors: job.progress.permanentErrors,
            affectedDistricts: Array.from(job.errorTrackers.keys()),
            partialSnapshots: job.progress.partialSnapshots,
          }
        : undefined

    return {
      backfillId: job.backfillId,
      status: job.status,
      scope: job.scope,
      progress: job.progress,
      collectionStrategy: job.collectionStrategy,
      error: job.error,
      snapshotIds: job.snapshotIds,
      errorSummary,
      partialSnapshots:
        job.partialSnapshots.length > 0 ? job.partialSnapshots : undefined,
    }
  }

  /**
   * Cancel a running backfill job
   */
  async cancelBackfill(backfillId: string): Promise<boolean> {
    return this.jobManager.cancelJob(backfillId)
  }

  /**
   * Clean up old completed jobs
   */
  async cleanupOldJobs(): Promise<void> {
    const oneHourAgo = 60 * 60 * 1000 // 1 hour in milliseconds
    this.jobManager.cleanupCompletedJobs(oneHourAgo)
  }

  /**
   * Get performance optimization status
   */
  getPerformanceStatus(): {
    rateLimiter: ReturnType<RateLimiter['getStatus']>
    concurrencyLimiter: ReturnType<ConcurrencyLimiter['getStatus']>
    intermediateCache: ReturnType<
      IntermediateCache<DistrictStatistics[]>['getStats']
    >
  } {
    return {
      rateLimiter: this.rateLimiter.getStatus(),
      concurrencyLimiter: this.concurrencyLimiter.getStatus(),
      intermediateCache: this.intermediateCache.getStats(),
    }
  }

  /**
   * Update performance optimization settings
   */
  updatePerformanceSettings(settings: {
    concurrencyLimit?: number
    rateLimitDelayMs?: number
    cacheEnabled?: boolean
  }): void {
    if (settings.concurrencyLimit !== undefined) {
      this.concurrencyLimiter.updateLimit(settings.concurrencyLimit)
      logger.info('Concurrency limit updated', {
        newLimit: settings.concurrencyLimit,
        operation: 'updatePerformanceSettings',
      })
    }

    if (settings.rateLimitDelayMs !== undefined) {
      logger.info('Rate limit delay setting noted for future requests', {
        delayMs: settings.rateLimitDelayMs,
        operation: 'updatePerformanceSettings',
      })
    }

    if (settings.cacheEnabled === false) {
      this.intermediateCache.clear()
      logger.info('Intermediate cache cleared', {
        operation: 'updatePerformanceSettings',
      })
    }
  }

  /**
   * Clear all performance optimization caches and reset counters
   */
  resetPerformanceOptimizations(): void {
    this.rateLimiter.reset()
    this.concurrencyLimiter.clearQueue()
    this.intermediateCache.clear()

    logger.info('Performance optimizations reset', {
      operation: 'resetPerformanceOptimizations',
    })
  }

  /**
   * Background processing of backfill operations with enhanced error handling
   */
  private async processBackfill(
    backfillId: string,
    request: BackfillRequest
  ): Promise<void> {
    const job = this.jobManager.getJob(backfillId)
    if (!job) {
      throw new Error('Job not found')
    }

    logger.info(
      'Starting backfill processing with enhanced error handling and performance optimizations',
      {
        backfillId,
        strategy: job.collectionStrategy.type,
        retryEnabled: request.retryFailures !== false,
        concurrency: request.concurrency || 3,
        enableCaching: request.enableCaching !== false,
        operation: 'processBackfill',
      }
    )

    try {
      // Update concurrency limit if specified in request
      const concurrencyLimit = request.concurrency || 3
      this.concurrencyLimiter.updateLimit(concurrencyLimit)

      // Generate date range
      const dates = this.generateDateRange(request.startDate, request.endDate)

      // Initialize district progress tracking
      for (const districtId of job.scope.targetDistricts) {
        job.progress.districtProgress.set(districtId, {
          districtId,
          status: 'pending',
          datesProcessed: 0,
          datesTotal: dates.length,
          successfulDates: [],
          failedDates: [],
          retryCount: 0,
        })
      }

      // Update job progress with total count
      this.jobManager.updateProgress(backfillId, {
        total: dates.length,
        current: dates[0] || request.startDate,
      })

      // Process dates with concurrency control
      const dateProcessingFunctions = dates.map(date => async () => {
        // Check if job was cancelled
        if (job.status === 'cancelled') {
          logger.info('Job cancelled, stopping processing', {
            backfillId,
            date,
            operation: 'processBackfill',
          })
          return
        }

        // Update current progress
        this.jobManager.updateProgress(backfillId, {
          current: date,
        })

        try {
          // Process date with district-level error handling and caching
          await this.processDateWithErrorHandlingAndCaching(
            backfillId,
            date,
            job,
            request
          )

          logger.info(
            'Successfully processed date with performance optimizations',
            {
              backfillId,
              date,
              cacheStats: this.intermediateCache.getStats(),
              concurrencyStatus: this.concurrencyLimiter.getStatus(),
              operation: 'processBackfill',
            }
          )
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error'

          this.jobManager.updateProgress(backfillId, {
            failed: (job.progress.failed || 0) + 1,
          })

          logger.error('Failed to process date', {
            backfillId,
            date,
            error: errorMessage,
            operation: 'processBackfill',
          })
        }
      })

      // Execute date processing with concurrency control
      await this.concurrencyLimiter.executeAllSettled(dateProcessingFunctions, {
        backfillId,
        operation: 'processBackfill',
      })

      // Complete job with appropriate status
      this.jobManager.updateProgress(backfillId, {
        completed: dates.length,
      })

      // Determine final job status based on results
      const hasErrors = job.progress.totalErrors > 0
      const hasSuccesses =
        job.snapshotIds.length > 0 || job.partialSnapshots.length > 0

      if (hasSuccesses && hasErrors) {
        job.status = 'partial_success'
      } else if (hasSuccesses) {
        job.status = 'complete'
      } else {
        job.status = 'error'
        job.error = 'No successful data collection occurred'
      }

      // After all snapshots are written, set current pointer to the most recent successful date
      if (hasSuccesses && dates.length > 0) {
        const mostRecentDate = dates[0]
        if (mostRecentDate && 'setCurrentSnapshot' in this.snapshotStore) {
          try {
            const perDistrictStore = this.snapshotStore as {
              setCurrentSnapshot: (snapshotId: string) => Promise<void>
            }
            await perDistrictStore.setCurrentSnapshot(mostRecentDate)
            logger.info('Set current snapshot to most recent backfill date', {
              backfillId,
              mostRecentDate,
              operation: 'processBackfill',
            })
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : 'Unknown error'
            logger.warn('Failed to set current snapshot pointer', {
              backfillId,
              mostRecentDate,
              error: errorMessage,
              operation: 'processBackfill',
            })
          }
        }
      }

      job.completedAt = Date.now()

      logger.info(
        'Backfill processing completed with enhanced error handling and performance optimizations',
        {
          backfillId,
          status: job.status,
          totalDates: dates.length,
          snapshotsCreated: job.snapshotIds.length,
          partialSnapshots: job.partialSnapshots.length,
          failed: job.progress.failed,
          unavailable: job.progress.unavailable,
          totalErrors: job.progress.totalErrors,
          retryableErrors: job.progress.retryableErrors,
          permanentErrors: job.progress.permanentErrors,
          cacheStats: this.intermediateCache.getStats(),
          concurrencyStats: this.concurrencyLimiter.getStatus(),
          rateLimiterStats: this.rateLimiter.getStatus(),
          operation: 'processBackfill',
        }
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      job.status = 'error'
      job.error = errorMessage
      job.completedAt = Date.now()

      logger.error('Backfill processing failed', {
        backfillId,
        error: errorMessage,
        operation: 'processBackfill',
      })

      throw error
    }
  }

  /**
   * Process a single date with district-level error handling, partial snapshot creation, and caching
   */
  private async processDateWithErrorHandlingAndCaching(
    backfillId: string,
    date: string,
    job: BackfillJob,
    request: BackfillRequest
  ): Promise<void> {
    // Skip month-end dates - they will be filled by closing period data from the following month
    if (this.isLastDayOfMonth(date)) {
      logger.info(
        'Skipping month-end date - will be filled by closing period data',
        {
          backfillId,
          date,
          reason:
            'Month-end snapshots are created from closing period data collected in the following month',
          operation: 'processDateWithErrorHandlingAndCaching',
        }
      )

      this.jobManager.updateProgress(backfillId, {
        completed: (job.progress.completed || 0) + 1,
      })
      return
    }

    logger.debug(
      'Processing date with district-level error handling and caching',
      {
        backfillId,
        date,
        targetDistricts: job.scope.targetDistricts.length,
        enableCaching: request.enableCaching !== false,
        operation: 'processDateWithErrorHandlingAndCaching',
      }
    )

    const successfulDistricts: DistrictStatistics[] = []
    const failedDistricts: string[] = []
    const districtErrors: DistrictError[] = []
    const enableCaching = request.enableCaching !== false

    // Process each district individually to enable partial success with caching
    for (const districtId of job.scope.targetDistricts) {
      // Check if district is blacklisted
      if (this.jobManager.isDistrictBlacklisted(backfillId, districtId)) {
        logger.info('Skipping blacklisted district', {
          backfillId,
          districtId,
          date,
          operation: 'processDateWithErrorHandlingAndCaching',
        })

        const districtProgress = job.progress.districtProgress.get(districtId)
        if (districtProgress) {
          districtProgress.status = 'blacklisted'
          districtProgress.failedDates.push(date)
        }

        failedDistricts.push(districtId)
        continue
      }

      try {
        // Update district status
        const districtProgress = job.progress.districtProgress.get(districtId)
        if (districtProgress) {
          districtProgress.status = 'processing'
        }

        // Execute collection for single district with caching
        const districtData = await this.collectDistrictDataWithCaching(
          districtId,
          date,
          job.collectionStrategy,
          enableCaching,
          request.cacheKeyPrefix
        )

        if (districtData) {
          successfulDistricts.push(districtData)
          this.jobManager.trackDistrictSuccess(backfillId, districtId)

          if (districtProgress) {
            districtProgress.datesProcessed++
            districtProgress.successfulDates.push(date)
            districtProgress.status = 'completed'
          }

          logger.debug('Successfully collected district data with caching', {
            backfillId,
            districtId,
            date,
            fromCache: false,
            operation: 'processDateWithErrorHandlingAndCaching',
          })
        } else {
          failedDistricts.push(districtId)

          if (districtProgress) {
            districtProgress.failedDates.push(date)
            districtProgress.status = 'skipped'
          }

          this.jobManager.updateProgress(backfillId, {
            unavailable: (job.progress.unavailable || 0) + 1,
          })
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))

        // Determine error type
        let errorType: DistrictError['errorType'] = 'processing_failed'
        const message = err.message.toLowerCase()

        if (message.includes('network') || message.includes('econnreset')) {
          errorType = 'network_error'
        } else if (message.includes('timeout')) {
          errorType = 'timeout_error'
        } else if (message.includes('rate limit')) {
          errorType = 'rate_limit_error'
        } else if (
          message.includes('not found') ||
          message.includes('unavailable')
        ) {
          errorType = 'data_unavailable'
        } else if (message.includes('fetch')) {
          errorType = 'fetch_failed'
        }

        // Track district error with detailed context
        this.jobManager.trackDistrictError(
          backfillId,
          districtId,
          err,
          errorType,
          {
            date,
            collectionStrategy: job.collectionStrategy.type,
            attempt:
              (job.progress.districtProgress.get(districtId)?.retryCount || 0) +
              1,
            cachingEnabled: enableCaching,
          }
        )

        failedDistricts.push(districtId)

        const districtProgress = job.progress.districtProgress.get(districtId)
        if (districtProgress) {
          districtProgress.failedDates.push(date)
          districtProgress.status = 'failed'
          districtProgress.retryCount++
        }

        logger.warn('District data collection failed', {
          backfillId,
          districtId,
          date,
          error: err.message,
          errorType,
          operation: 'processDateWithErrorHandlingAndCaching',
        })
      }
    }

    // Create snapshot if we have any successful districts
    if (successfulDistricts.length > 0) {
      try {
        const snapshotResult = await this.createPartialSnapshot(
          backfillId,
          date,
          successfulDistricts,
          failedDistricts,
          districtErrors
        )

        job.snapshotIds.push(snapshotResult.snapshotId)
        this.jobManager.recordPartialSnapshot(backfillId, snapshotResult)

        logger.info('Created partial snapshot for date with caching support', {
          backfillId,
          date,
          snapshotId: snapshotResult.snapshotId,
          successfulDistricts: snapshotResult.successfulDistricts.length,
          failedDistricts: snapshotResult.failedDistricts.length,
          successRate: snapshotResult.successRate,
          cacheStats: this.intermediateCache.getStats(),
          operation: 'processDateWithErrorHandlingAndCaching',
        })
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error'

        logger.error('Failed to create partial snapshot', {
          backfillId,
          date,
          error: errorMessage,
          successfulDistricts: successfulDistricts.length,
          failedDistricts: failedDistricts.length,
          operation: 'processDateWithErrorHandlingAndCaching',
        })

        // Track snapshot creation failure
        for (const districtId of successfulDistricts.map(d => d.districtId)) {
          this.jobManager.trackDistrictError(
            backfillId,
            districtId,
            new Error(`Snapshot creation failed: ${errorMessage}`),
            'snapshot_creation_failed',
            { date, successfulDistricts: successfulDistricts.length }
          )
        }
      }
    } else {
      logger.info(
        'No successful districts for date - skipping snapshot creation',
        {
          backfillId,
          date,
          failedDistricts: failedDistricts.length,
          operation: 'processDateWithErrorHandlingAndCaching',
        }
      )

      this.jobManager.updateProgress(backfillId, {
        unavailable: (job.progress.unavailable || 0) + 1,
      })
    }
  }

  /**
   * Collect data for a single district with error handling and caching support
   */
  private async collectDistrictDataWithCaching(
    districtId: string,
    date: string,
    strategy: CollectionStrategy,
    enableCaching: boolean = true,
    cacheKeyPrefix?: string
  ): Promise<DistrictStatistics | null> {
    const cacheKey = `${cacheKeyPrefix || 'district'}_${districtId}_${date}_${strategy.type}`

    // Try to get from cache first
    if (enableCaching) {
      const cached = this.intermediateCache.get(cacheKey)
      if (cached && cached.length > 0) {
        const districtData = cached.find(d => d.districtId === districtId)
        if (districtData) {
          logger.debug('District data retrieved from cache', {
            districtId,
            date,
            cacheKey,
            fromCache: true,
            operation: 'collectDistrictDataWithCaching',
          })

          return districtData
        }
      }
    }

    try {
      // Create district-specific collection strategy
      const districtStrategy: CollectionStrategy = {
        ...strategy,
        type: 'per-district',
        refreshMethod: {
          name: 'getDistrictPerformance',
          params: { districtIds: [districtId], date },
        },
        targetDistricts: [districtId],
      }

      const backfillData = await this.dataSourceSelector.executeCollection(
        districtStrategy,
        date,
        [districtId]
      )

      const districtData =
        backfillData.snapshotData.find(d => d.districtId === districtId) || null

      // Cache the result if successful and caching is enabled
      if (districtData && enableCaching) {
        this.intermediateCache.set(
          cacheKey,
          [districtData],
          3600000, // 1 hour TTL
          {
            districtId,
            date,
            strategy: strategy.type,
            collectedAt: new Date().toISOString(),
          }
        )

        logger.debug('District data cached for future use', {
          districtId,
          date,
          cacheKey,
          operation: 'collectDistrictDataWithCaching',
        })
      }

      return districtData
    } catch (error) {
      logger.error('Failed to collect district data with caching', {
        districtId,
        date,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Map enhanced error types to snapshot error types
   */
  private mapToSnapshotErrorType(
    errorType: DistrictError['errorType']
  ):
    | 'fetch_failed'
    | 'validation_failed'
    | 'processing_failed'
    | 'scope_violation' {
    switch (errorType) {
      case 'network_error':
      case 'timeout_error':
      case 'rate_limit_error':
      case 'data_unavailable':
        return 'fetch_failed'
      case 'snapshot_creation_failed':
        return 'processing_failed'
      case 'fetch_failed':
      case 'validation_failed':
      case 'processing_failed':
      case 'scope_violation':
        return errorType
      default:
        return 'processing_failed'
    }
  }

  /**
   * Create partial snapshot with mixed success/failure results
   */
  private async createPartialSnapshot(
    backfillId: string,
    date: string,
    successfulDistricts: DistrictStatistics[],
    failedDistricts: string[],
    errors: DistrictError[]
  ): Promise<PartialSnapshotResult> {
    const startTime = Date.now()

    logger.info('Creating partial snapshot', {
      backfillId,
      date,
      successfulDistricts: successfulDistricts.length,
      failedDistricts: failedDistricts.length,
      operation: 'createPartialSnapshot',
    })

    try {
      // Step 1: Fetch All Districts CSV data for ranking calculation
      let allDistrictsRankings: AllDistrictsRankingsData | undefined
      let effectiveSnapshotDate = date

      if (this.rankingCalculator) {
        try {
          allDistrictsRankings =
            await this.fetchAndCalculateAllDistrictsRankings(
              backfillId,
              date,
              `${Date.parse(date)}-partial-${Date.now()}`
            )
          if (allDistrictsRankings?.metadata?.snapshotId) {
            effectiveSnapshotDate = allDistrictsRankings.metadata.snapshotId
            logger.info(
              'Using closing period-aware snapshot date from rankings',
              {
                backfillId,
                requestedDate: date,
                effectiveSnapshotDate,
                operation: 'createPartialSnapshot',
              }
            )
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error'
          logger.error(
            'Failed to calculate all-districts rankings, continuing without rankings',
            {
              backfillId,
              date,
              error: errorMessage,
              operation: 'createPartialSnapshot',
            }
          )
        }
      }

      // Check if this is closing period data and if we should update the existing snapshot
      const isClosingPeriod = effectiveSnapshotDate !== date
      const collectionDate =
        allDistrictsRankings?.metadata?.sourceCsvDate || date

      if (
        isClosingPeriod &&
        'shouldUpdateClosingPeriodSnapshot' in this.snapshotStore
      ) {
        const perDistrictStore = this.snapshotStore as {
          shouldUpdateClosingPeriodSnapshot: (
            snapshotDate: string,
            newCollectionDate: string
          ) => Promise<{
            shouldUpdate: boolean
            reason: string
            existingCollectionDate?: string
          }>
        }

        const comparisonResult =
          await perDistrictStore.shouldUpdateClosingPeriodSnapshot(
            effectiveSnapshotDate,
            collectionDate
          )

        if (!comparisonResult.shouldUpdate) {
          logger.info(
            'Skipping closing period snapshot update - existing snapshot has newer data',
            {
              backfillId,
              operation: 'createPartialSnapshot',
              snapshot_date: effectiveSnapshotDate,
              requested_date: date,
              new_collection_date: collectionDate,
              existing_collection_date: comparisonResult.existingCollectionDate,
              reason: comparisonResult.reason,
            }
          )

          return {
            snapshotId: effectiveSnapshotDate,
            successfulDistricts: successfulDistricts.map(d => d.districtId),
            failedDistricts,
            totalDistricts: successfulDistricts.length + failedDistricts.length,
            successRate:
              successfulDistricts.length /
              (successfulDistricts.length + failedDistricts.length),
            errors,
            metadata: {
              createdAt: new Date().toISOString(),
              processingTime: Date.now() - startTime,
              isPartial: false,
              backfillJobId: backfillId,
              skipped: true,
              skipReason: comparisonResult.reason,
            },
          }
        }

        logger.info('Proceeding with closing period snapshot update', {
          backfillId,
          operation: 'createPartialSnapshot',
          snapshot_date: effectiveSnapshotDate,
          requested_date: date,
          new_collection_date: collectionDate,
          reason: comparisonResult.reason,
        })
      }

      // Generate snapshot ID using the effective date
      const snapshotId = `${Date.parse(effectiveSnapshotDate)}-partial-${Date.now()}`

      const rankedDistricts = successfulDistricts

      // Step 2: Create normalized data structure with ranked districts
      const job = this.jobManager.getJob(backfillId)
      const normalizedData: NormalizedData = {
        districts: rankedDistricts,
        metadata: {
          source: 'unified-backfill-service',
          fetchedAt: new Date().toISOString(),
          dataAsOfDate: effectiveSnapshotDate,
          districtCount: rankedDistricts.length,
          processingDurationMs: Date.now() - startTime,
          backfillJobId: backfillId,
          configuredDistricts: job?.scope.configuredDistricts || [],
          successfulDistricts: rankedDistricts.map(d => d.districtId),
          failedDistricts: failedDistricts,
          districtErrors: errors.map(e => ({
            districtId: e.districtId,
            error: e.error,
            errorType: this.mapToSnapshotErrorType(e.errorType),
            timestamp: e.timestamp,
          })),
          extendedMetadata: {
            collectionMethod: job?.collectionStrategy.type || 'unknown',
            collectionScope: job?.scope.scopeType || 'unknown',
            refreshMethod:
              job?.collectionStrategy.refreshMethod.name || 'unknown',
            targetDistricts: job?.scope.targetDistricts || [],
          },
        },
      }

      // Step 3: Create snapshot with ranked data
      const snapshot: Snapshot = {
        snapshot_id: snapshotId,
        created_at: new Date().toISOString(),
        schema_version: '2.0.0',
        calculation_version:
          this.rankingCalculator?.getRankingVersion() || '1.0.0',
        status: failedDistricts.length > 0 ? 'partial' : 'success',
        errors: errors.map(e => e.error),
        payload: normalizedData,
      }

      // Step 4: Write snapshot with all-districts rankings
      if (
        allDistrictsRankings &&
        'writeAllDistrictsRankings' in this.snapshotStore
      ) {
        const perDistrictStore = this.snapshotStore as {
          writeSnapshot: (
            snapshot: Snapshot,
            rankings?: AllDistrictsRankingsData,
            options?: {
              skipCurrentPointerUpdate?: boolean
              overrideSnapshotDate?: string
            }
          ) => Promise<void>
        }
        await perDistrictStore.writeSnapshot(snapshot, allDistrictsRankings, {
          skipCurrentPointerUpdate: true,
          overrideSnapshotDate: effectiveSnapshotDate,
        })

        logger.info(
          'Snapshot written with all-districts rankings (backfill mode)',
          {
            backfillId,
            snapshotId,
            date,
            effectiveSnapshotDate,
            rankingsCount: allDistrictsRankings.rankings.length,
            configuredDistrictsCount: rankedDistricts.length,
            operation: 'createPartialSnapshot',
          }
        )
      } else {
        const perDistrictStore = this.snapshotStore as {
          writeSnapshot: (
            snapshot: Snapshot,
            rankings?: AllDistrictsRankingsData,
            options?: {
              skipCurrentPointerUpdate?: boolean
              overrideSnapshotDate?: string
            }
          ) => Promise<void>
        }
        await perDistrictStore.writeSnapshot(snapshot, undefined, {
          skipCurrentPointerUpdate: true,
          overrideSnapshotDate: effectiveSnapshotDate,
        })
      }

      const processingTime = Date.now() - startTime
      const totalDistricts = successfulDistricts.length + failedDistricts.length
      const successRate =
        totalDistricts > 0 ? successfulDistricts.length / totalDistricts : 0

      const partialResult: PartialSnapshotResult = {
        snapshotId,
        successfulDistricts: rankedDistricts.map(d => d.districtId),
        failedDistricts,
        totalDistricts,
        successRate,
        errors,
        metadata: {
          createdAt: new Date().toISOString(),
          processingTime,
          isPartial: failedDistricts.length > 0,
          backfillJobId: backfillId,
        },
      }

      logger.info('Partial snapshot created successfully', {
        backfillId,
        snapshotId,
        date,
        successfulDistricts: successfulDistricts.length,
        failedDistricts: failedDistricts.length,
        successRate: Math.round(successRate * 100),
        processingTime,
        operation: 'createPartialSnapshot',
      })

      return partialResult
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      logger.error('Failed to create partial snapshot', {
        backfillId,
        date,
        error: errorMessage,
        successfulDistricts: successfulDistricts.length,
        failedDistricts: failedDistricts.length,
        operation: 'createPartialSnapshot',
      })

      throw new Error(`Failed to create partial snapshot: ${errorMessage}`)
    }
  }

  /**
   * Fetch All Districts CSV from cache and calculate rankings for ALL districts
   *
   * Note: This method now reads from cached data only. If data is not in the cache,
   * the scraper-cli tool must be run first to populate the cache.
   */
  private async fetchAndCalculateAllDistrictsRankings(
    backfillId: string,
    date: string,
    snapshotId: string
  ): Promise<AllDistrictsRankingsData> {
    logger.info(
      'Reading All Districts CSV from cache for rankings calculation',
      {
        backfillId,
        date,
        snapshotId,
        operation: 'fetchAndCalculateAllDistrictsRankings',
      }
    )

    const { getProductionServiceFactory } =
      await import('../ProductionServiceFactory.js')

    const serviceFactory = getProductionServiceFactory()
    const rawCSVCacheService = serviceFactory.createRawCSVCacheService()

    try {
      // Read from cache using getAllDistrictsCached which returns parsed records
      const cachedResult = await rawCSVCacheService.getAllDistrictsCached(date)

      if (
        !cachedResult ||
        !cachedResult.fromCache ||
        cachedResult.data.length === 0
      ) {
        throw new Error(
          `No cached All Districts CSV available for date ${date}. Please run scraper-cli to collect data first: npx scraper-cli scrape --date ${date}`
        )
      }

      const cacheMetadata = await rawCSVCacheService.getCacheMetadata(date)
      const actualCsvDate = cacheMetadata?.date || date

      const closingPeriodInfo = this.detectClosingPeriodFromMetadata(
        date,
        actualCsvDate,
        cacheMetadata?.dataMonth,
        cacheMetadata?.isClosingPeriod
      )

      const allDistrictsData = cachedResult.data

      logger.info('All Districts CSV read from cache successfully', {
        backfillId,
        requestedDate: date,
        actualCsvDate,
        recordCount: allDistrictsData.length,
        isClosingPeriod: closingPeriodInfo.isClosingPeriod,
        snapshotDate: closingPeriodInfo.snapshotDate,
        dataMonth: closingPeriodInfo.dataMonth,
        operation: 'fetchAndCalculateAllDistrictsRankings',
      })

      // Convert CSV records to DistrictStatistics format for ranking calculation
      const districtStats: DistrictStatistics[] = allDistrictsData.map(
        record => {
          const districtId = String(
            record['DISTRICT'] || record['District'] || ''
          )
            .replace(/^District\s+/i, '')
            .trim()

          return {
            districtId,
            asOfDate: actualCsvDate,
            membership: {
              total: 0,
              change: 0,
              changePercent: 0,
              byClub: [],
            },
            clubs: {
              total: 0,
              active: 0,
              suspended: 0,
              ineligible: 0,
              low: 0,
              distinguished: 0,
            },
            education: {
              totalAwards: 0,
              byType: [],
              topClubs: [],
            },
            districtPerformance: [record],
            divisionPerformance: [],
            clubPerformance: [],
          }
        }
      )

      logger.debug('Converted All Districts CSV to DistrictStatistics', {
        backfillId,
        date,
        inputCount: allDistrictsData.length,
        outputCount: districtStats.length,
        operation: 'fetchAndCalculateAllDistrictsRankings',
      })

      if (!this.rankingCalculator) {
        throw new Error('Ranking calculator not available')
      }

      const rankedDistricts =
        await this.rankingCalculator.calculateRankings(districtStats)

      logger.info('Rankings calculated for all districts', {
        backfillId,
        date,
        rankedCount: rankedDistricts.length,
        rankedWithData: rankedDistricts.filter(d => d.ranking).length,
        rankingVersion: this.rankingCalculator.getRankingVersion(),
        operation: 'fetchAndCalculateAllDistrictsRankings',
      })

      // Build AllDistrictsRankingsData structure
      const rankings: DistrictRanking[] = rankedDistricts
        .filter(d => d.ranking)
        .map(d => {
          const ranking = d.ranking!
          return {
            districtId: d.districtId,
            districtName: ranking.districtName,
            region: ranking.region,
            paidClubs: ranking.paidClubs,
            paidClubBase: ranking.paidClubBase,
            clubGrowthPercent: ranking.clubGrowthPercent,
            totalPayments: ranking.totalPayments,
            paymentBase: ranking.paymentBase,
            paymentGrowthPercent: ranking.paymentGrowthPercent,
            activeClubs: ranking.activeClubs,
            distinguishedClubs: ranking.distinguishedClubs,
            selectDistinguished: ranking.selectDistinguished,
            presidentsDistinguished: ranking.presidentsDistinguished,
            distinguishedPercent: ranking.distinguishedPercent,
            clubsRank: ranking.clubsRank,
            paymentsRank: ranking.paymentsRank,
            distinguishedRank: ranking.distinguishedRank,
            aggregateScore: ranking.aggregateScore,
          }
        })

      const allDistrictsRankings: AllDistrictsRankingsData = {
        metadata: {
          snapshotId: closingPeriodInfo.snapshotDate,
          calculatedAt: new Date().toISOString(),
          schemaVersion: '2.0.0',
          calculationVersion: this.rankingCalculator.getRankingVersion(),
          rankingVersion: this.rankingCalculator.getRankingVersion(),
          sourceCsvDate: closingPeriodInfo.collectionDate,
          csvFetchedAt: new Date().toISOString(),
          totalDistricts: rankings.length,
          fromCache: false,
        },
        rankings,
      }

      logger.info('All-districts rankings generated successfully', {
        backfillId,
        date,
        snapshotId,
        snapshotDate: closingPeriodInfo.snapshotDate,
        isClosingPeriod: closingPeriodInfo.isClosingPeriod,
        totalDistricts: rankings.length,
        rankingVersion: this.rankingCalculator.getRankingVersion(),
        operation: 'fetchAndCalculateAllDistrictsRankings',
      })

      return allDistrictsRankings
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error(
        'Failed to fetch and calculate all districts rankings from cache',
        {
          backfillId,
          date,
          snapshotId,
          error: errorMessage,
          operation: 'fetchAndCalculateAllDistrictsRankings',
        }
      )
      throw error
    }
  }

  /**
   * Check if a date is the last day of its month
   */
  private isLastDayOfMonth(dateString: string): boolean {
    const date = new Date(dateString + 'T00:00:00')
    const nextDay = new Date(date)
    nextDay.setUTCDate(date.getUTCDate() + 1)
    return nextDay.getUTCMonth() !== date.getUTCMonth()
  }

  /**
   * Detect closing period from cache metadata and determine the correct snapshot date
   */
  private detectClosingPeriodFromMetadata(
    requestedDate: string,
    actualCsvDate: string,
    dataMonth?: string,
    isClosingPeriod?: boolean
  ): {
    isClosingPeriod: boolean
    dataMonth: string
    snapshotDate: string
    collectionDate: string
  } {
    try {
      const csvDateObj = new Date(actualCsvDate + 'T00:00:00')
      const csvYear = csvDateObj.getUTCFullYear()
      const csvMonth = csvDateObj.getUTCMonth() + 1

      // If we have explicit closing period info from cache metadata, use it
      if (isClosingPeriod && dataMonth) {
        const [yearStr, monthStr] = dataMonth.split('-')
        const dataYear = parseInt(yearStr!, 10)
        const dataMonthNum = parseInt(monthStr!, 10)

        const lastDay = new Date(
          Date.UTC(dataYear, dataMonthNum, 0)
        ).getUTCDate()
        const snapshotDate = `${dataYear}-${dataMonthNum.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`

        logger.info('Closing period detected from cache metadata', {
          requestedDate,
          actualCsvDate,
          dataMonth,
          snapshotDate,
          operation: 'detectClosingPeriodFromMetadata',
        })

        return {
          isClosingPeriod: true,
          dataMonth,
          snapshotDate,
          collectionDate: actualCsvDate,
        }
      }

      // Fallback: derive data month from the actual CSV date
      const requestedDateObj = new Date(requestedDate + 'T00:00:00')
      const requestedYear = requestedDateObj.getUTCFullYear()
      const requestedMonth = requestedDateObj.getUTCMonth() + 1

      const isImplicitClosingPeriod =
        csvYear > requestedYear ||
        (csvYear === requestedYear && csvMonth > requestedMonth)

      if (isImplicitClosingPeriod) {
        const lastDay = new Date(
          Date.UTC(requestedYear, requestedMonth, 0)
        ).getUTCDate()
        const snapshotDate = `${requestedYear}-${requestedMonth.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`
        const derivedDataMonth = `${requestedYear}-${requestedMonth.toString().padStart(2, '0')}`

        logger.info('Closing period detected from date comparison', {
          requestedDate,
          actualCsvDate,
          derivedDataMonth,
          snapshotDate,
          operation: 'detectClosingPeriodFromMetadata',
        })

        return {
          isClosingPeriod: true,
          dataMonth: derivedDataMonth,
          snapshotDate,
          collectionDate: actualCsvDate,
        }
      }

      const derivedDataMonth = `${csvYear}-${csvMonth.toString().padStart(2, '0')}`

      return {
        isClosingPeriod: false,
        dataMonth: derivedDataMonth,
        snapshotDate: actualCsvDate,
        collectionDate: actualCsvDate,
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error(
        'Error detecting closing period, using actual CSV date as snapshot date',
        {
          requestedDate,
          actualCsvDate,
          dataMonth,
          error: errorMessage,
          operation: 'detectClosingPeriodFromMetadata',
        }
      )

      return {
        isClosingPeriod: false,
        dataMonth: dataMonth || actualCsvDate.substring(0, 7),
        snapshotDate: actualCsvDate,
        collectionDate: actualCsvDate,
      }
    }
  }

  /**
   * Generate date range for processing
   */
  private generateDateRange(startDate: string, endDate?: string): string[] {
    const start = new Date(startDate)
    const end = endDate ? new Date(endDate) : new Date(startDate)
    const dates: string[] = []

    const currentDate = new Date(start)
    while (currentDate <= end) {
      const dateOnly = currentDate.toISOString().split('T')[0]
      if (!dateOnly) {
        throw new Error('Failed to extract date from ISO string')
      }
      dates.push(dateOnly)
      currentDate.setDate(currentDate.getDate() + 1)
    }

    return dates.reverse() // Start with most recent
  }
}
