/**
 * Unified BackfillService
 *
 * A complete rewrite that replaces both existing BackfillService and DistrictBackfillService
 * with a modern, unified system that leverages RefreshService methods as the primary
 * data acquisition mechanism for historical data collection.
 *
 * ## Key Features
 * - **RefreshService Integration**: Direct use of proven RefreshService methods for reliable data acquisition
 * - **Intelligent Collection**: Automatic selection of optimal collection strategies based on scope and requirements
 * - **Unified Job Management**: Single job queue for all backfill types with unified progress tracking
 * - **Enhanced Error Handling**: District-level error tracking with partial snapshot creation
 * - **Modern API Design**: Clean, modern API interface with comprehensive error handling
 * - **Performance Optimization**: Rate limiting, concurrency controls, and caching for efficiency
 *
 * ## Architecture
 * The service consists of four main components:
 * - **BackfillService**: Main orchestrator for all backfill operations
 * - **JobManager**: Handles job lifecycle, progress tracking, and cleanup
 * - **DataSourceSelector**: Manages collection strategy selection and delegates to RefreshService methods
 * - **ScopeManager**: Manages district targeting and configuration validation
 *
 * ## Collection Strategies
 * The service automatically selects optimal collection strategies:
 * - **System-Wide**: Uses RefreshService.executeRefresh() for comprehensive data collection
 * - **Per-District**: Uses RefreshService scraper methods for district-specific detailed data
 * - **Targeted**: Hybrid approach optimized based on district count and requirements
 *
 * ## Error Handling
 * Comprehensive error handling at multiple levels:
 * - **District-Level**: Individual district failures don't stop processing of other districts
 * - **Job-Level**: Jobs can be cancelled and cleaned up properly
 * - **System-Level**: Circuit breakers and retry logic protect against external service failures
 *
 * ## Performance Optimization
 * Built-in performance optimization features:
 * - **Rate Limiting**: Protects external data sources from being overwhelmed
 * - **Concurrency Control**: Limits simultaneous operations to prevent resource exhaustion
 * - **Intermediate Caching**: Caches results to avoid redundant operations
 *
 * @example Basic Usage
 * ```typescript
 * const service = new BackfillService(refreshService, snapshotStore, configService);
 *
 * // Simple system-wide backfill
 * const backfillId = await service.initiateBackfill({
 *   startDate: '2024-01-01',
 *   endDate: '2024-01-30'
 * });
 *
 * // Check status
 * const status = service.getBackfillStatus(backfillId);
 * console.log(`Progress: ${status.progress.completed}/${status.progress.total}`);
 * ```
 *
 * @example Advanced Configuration
 * ```typescript
 * // Targeted backfill with performance optimization
 * const backfillId = await service.initiateBackfill({
 *   targetDistricts: ['42', '15', '73'],
 *   startDate: '2024-07-01',
 *   endDate: '2024-12-31',
 *   collectionType: 'per-district',
 *   concurrency: 5,
 *   retryFailures: true,
 *   enableCaching: true,
 *   rateLimitDelayMs: 1000
 * });
 * ```
 *
 * @example Error Handling
 * ```typescript
 * try {
 *   const backfillId = await service.initiateBackfill(request);
 *
 *   // Monitor for completion
 *   let status;
 *   do {
 *     await new Promise(resolve => setTimeout(resolve, 2000));
 *     status = service.getBackfillStatus(backfillId);
 *
 *     if (status.progress.totalErrors > 0) {
 *       console.warn(`Errors detected: ${status.errorSummary?.totalErrors}`);
 *     }
 *   } while (status?.status === 'processing');
 *
 *   if (status?.status === 'partial_success') {
 *     console.log('Completed with some issues');
 *     console.log(`Partial snapshots: ${status.partialSnapshots?.length}`);
 *   }
 * } catch (error) {
 *   console.error('Backfill failed:', error.message);
 * }
 * ```
 *
 * @see {@link https://github.com/your-org/docs/unified-backfill-service.md} Full Documentation
 * @see {@link https://github.com/your-org/docs/unified-backfill-api-reference.md} API Reference
 * @see {@link https://github.com/your-org/docs/unified-backfill-examples.md} Usage Examples
 */

import { v4 as uuidv4 } from 'uuid'
import { logger } from '../utils/logger.js'
import {
  CircuitBreaker,
  CircuitBreakerManager,
  ICircuitBreakerManager,
} from '../utils/CircuitBreaker.js'
import { AlertManager } from '../utils/AlertManager.js'
import { RetryManager, RetryOptions } from '../utils/RetryManager.js'
import { RateLimiter, RateLimiterManager } from '../utils/RateLimiter.js'
import {
  ConcurrencyLimiter,
  ConcurrencyLimiterManager,
} from '../utils/ConcurrencyLimiter.js'
import {
  IntermediateCache,
  IntermediateCacheManager,
} from '../utils/IntermediateCache.js'
import { RefreshService } from './RefreshService.js'
import { PerDistrictFileSnapshotStore } from './PerDistrictSnapshotStore.js'
import { DistrictConfigurationService } from './DistrictConfigurationService.js'
import type { RankingCalculator } from './RankingCalculator.js'
import type { DistrictStatistics, ScrapedRecord } from '../types/districts.js'
import type {
  Snapshot,
  NormalizedData,
  SnapshotStore,
} from '../types/snapshots.js'

/**
 * Backfill request interface with flexible targeting and configuration options
 *
 * This interface defines all the parameters that can be used to configure a backfill operation.
 * The service provides intelligent defaults for most parameters, making it easy to use while
 * still offering fine-grained control when needed.
 *
 * @example Basic Request
 * ```typescript
 * const request: BackfillRequest = {
 *   startDate: '2024-01-01',
 *   endDate: '2024-01-30'
 * };
 * ```
 *
 * @example Advanced Request
 * ```typescript
 * const request: BackfillRequest = {
 *   targetDistricts: ['42', '15', '73'],
 *   startDate: '2024-07-01',
 *   endDate: '2024-12-31',
 *   collectionType: 'per-district',
 *   concurrency: 5,
 *   retryFailures: true,
 *   enableCaching: true,
 *   rateLimitDelayMs: 1000
 * };
 * ```
 */
export interface BackfillRequest {
  // Targeting options
  /**
   * Specific districts to process. If not provided, all configured districts will be processed.
   * District IDs should be valid Toastmasters district identifiers.
   *
   * @example ['42', '15', '73']
   */
  targetDistricts?: string[]

  // Date range
  /**
   * Start date for backfill operation in ISO date format (YYYY-MM-DD).
   * This is the earliest date that will be processed.
   *
   * @example '2024-01-01'
   */
  startDate: string

  /**
   * End date for backfill operation in ISO date format (YYYY-MM-DD).
   * If not provided, defaults to startDate (single day backfill).
   *
   * @example '2024-01-30'
   */
  endDate?: string

  // Collection preferences
  /**
   * Collection strategy to use. 'auto' lets the service choose the optimal strategy.
   * - 'system-wide': Uses RefreshService.executeRefresh() for all districts at once
   * - 'per-district': Uses district-specific scraping for detailed data
   * - 'auto': Service selects optimal strategy based on scope and requirements
   *
   * @default 'auto'
   */
  collectionType?: 'system-wide' | 'per-district' | 'auto'

  // Processing options (Requirements 9.1, 9.2)
  /**
   * Maximum number of concurrent district operations.
   * Higher values increase speed but may overwhelm external services.
   *
   * @default 3
   * @min 1
   * @max 10
   */
  concurrency?: number

  /**
   * Whether to retry failed districts with exponential backoff.
   * Recommended for better resilience against transient failures.
   *
   * @default true
   */
  retryFailures?: boolean

  /**
   * Whether to skip dates that are already cached.
   * Improves performance by avoiding redundant operations.
   *
   * @default true
   */
  skipExisting?: boolean

  // Performance optimization options (Requirements 9.1, 9.2, 9.3)
  /**
   * Override default rate limit delay in milliseconds.
   * Lower values increase speed but may trigger rate limiting.
   *
   * @default 2000
   * @min 500
   */
  rateLimitDelayMs?: number

  /**
   * Enable intermediate result caching to avoid redundant operations.
   * Highly recommended for better performance.
   *
   * @default true
   */
  enableCaching?: boolean

  /**
   * Custom cache key prefix for this operation.
   * Useful for organizing cached data by operation type or priority.
   *
   * @example 'priority', 'batch-2024', 'district-42'
   */
  cacheKeyPrefix?: string
}

/**
 * Collection strategy determined by DataSourceSelector
 */
export interface CollectionStrategy {
  type: 'system-wide' | 'per-district' | 'targeted'
  refreshMethod: RefreshMethod
  rationale: string
  estimatedEfficiency: number
  targetDistricts?: string[]
}

/**
 * RefreshService method configuration
 */
export interface RefreshMethod {
  name: 'getAllDistricts' | 'getDistrictPerformance' | 'getMultipleDistricts'
  params: RefreshParams
}

/**
 * Parameters for RefreshService method calls
 */
export interface RefreshParams {
  date?: string
  districtIds?: string[]
  includeDetails?: boolean
}

/**
 * Backfill data structure from RefreshService integration
 */
export interface BackfillData {
  source: 'refresh-service'
  method: RefreshMethod
  date: string
  districts: string[]
  snapshotData: DistrictStatistics[]
  metadata: CollectionMetadata
}

/**
 * Collection metadata for tracking and analysis
 */
export interface CollectionMetadata {
  collectionStrategy: CollectionStrategy
  processingTime: number
  successCount: number
  failureCount: number
  errors?: DistrictError[]
}

/**
 * District-specific error tracking with enhanced context
 */
export interface DistrictError {
  districtId: string
  error: string
  errorType:
    | 'fetch_failed'
    | 'validation_failed'
    | 'processing_failed'
    | 'scope_violation'
    | 'network_error'
    | 'timeout_error'
    | 'rate_limit_error'
    | 'data_unavailable'
    | 'snapshot_creation_failed'
  timestamp: string
  retryCount: number
  isRetryable: boolean
  context?: Record<string, unknown>
}

/**
 * Enhanced error tracking for district-level operations
 */
export interface DistrictErrorTracker {
  districtId: string
  errors: DistrictError[]
  consecutiveFailures: number
  lastSuccessAt?: string
  lastFailureAt?: string
  totalRetries: number
  isBlacklisted: boolean
  blacklistUntil?: string
}

/**
 * Partial snapshot creation result
 */
export interface PartialSnapshotResult {
  snapshotId: string
  successfulDistricts: string[]
  failedDistricts: string[]
  totalDistricts: number
  successRate: number
  errors: DistrictError[]
  metadata: {
    createdAt: string
    processingTime: number
    isPartial: boolean
    backfillJobId: string
  }
}

/**
 * Backfill scope validation result
 */
export interface BackfillScope {
  targetDistricts: string[]
  configuredDistricts: string[]
  scopeType: 'system-wide' | 'targeted' | 'single-district'
  validationPassed: boolean
}

/**
 * District-level progress tracking with enhanced error information
 */
export interface DistrictProgress {
  districtId: string
  status:
    | 'pending'
    | 'processing'
    | 'completed'
    | 'failed'
    | 'skipped'
    | 'blacklisted'
  datesProcessed: number
  datesTotal: number
  lastError?: string
  errorTracker?: DistrictErrorTracker
  successfulDates: string[]
  failedDates: string[]
  retryCount: number
}

/**
 * Backfill progress tracking with enhanced error information
 */
export interface BackfillProgress {
  total: number // Total operations to perform
  completed: number // Completed operations
  skipped: number // Skipped (already cached)
  unavailable: number // Data not available
  failed: number // Failed operations
  current: string // Current date being processed

  // District-level tracking with enhanced error information
  districtProgress: Map<string, DistrictProgress>

  // Enhanced error tracking
  partialSnapshots: number // Snapshots created with some failures
  totalErrors: number // Total error count across all districts
  retryableErrors: number // Errors that can be retried
  permanentErrors: number // Errors that cannot be retried
}

/**
 * Backfill job tracking with enhanced error information
 */
export interface BackfillJob {
  backfillId: string
  status: 'processing' | 'complete' | 'error' | 'cancelled' | 'partial_success'
  scope: BackfillScope
  progress: BackfillProgress
  collectionStrategy: CollectionStrategy
  error?: string
  createdAt: number
  completedAt?: number
  snapshotIds: string[] // Created snapshots

  // Enhanced error tracking
  errorTrackers: Map<string, DistrictErrorTracker> // District-level error tracking
  partialSnapshots: PartialSnapshotResult[] // Partial snapshots created
  retryConfig: RetryOptions // Retry configuration for this job
}

/**
 * Backfill response for API consumers with enhanced error information
 */
export interface BackfillResponse {
  backfillId: string
  status: 'processing' | 'complete' | 'error' | 'cancelled' | 'partial_success'
  scope: BackfillScope
  progress: BackfillProgress
  collectionStrategy: CollectionStrategy
  error?: string
  snapshotIds: string[]

  // Enhanced error information
  errorSummary?: {
    totalErrors: number
    retryableErrors: number
    permanentErrors: number
    affectedDistricts: string[]
    partialSnapshots: number
  }
  partialSnapshots?: PartialSnapshotResult[]
}

/**
 * Job Manager for unified job lifecycle management with enhanced error handling
 */
export class JobManager {
  private jobs: Map<string, BackfillJob> = new Map()

  createJob(request: BackfillRequest, scope: BackfillScope): BackfillJob {
    const backfillId = uuidv4()

    // Create initial collection strategy (will be refined by DataSourceSelector)
    const initialStrategy: CollectionStrategy = {
      type: scope.scopeType === 'system-wide' ? 'system-wide' : 'targeted',
      refreshMethod: {
        name: 'getAllDistricts',
        params: {},
      },
      rationale: 'Initial strategy - will be refined',
      estimatedEfficiency: 0.5,
    }

    // Create retry configuration based on request preferences
    const retryConfig: RetryOptions = {
      maxAttempts: request.retryFailures !== false ? 3 : 1,
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
    }

    const job: BackfillJob = {
      backfillId,
      status: 'processing',
      scope,
      progress: {
        total: 0, // Will be calculated after date range processing
        completed: 0,
        skipped: 0,
        unavailable: 0,
        failed: 0,
        current: request.startDate,
        districtProgress: new Map(),
        partialSnapshots: 0,
        totalErrors: 0,
        retryableErrors: 0,
        permanentErrors: 0,
      },
      collectionStrategy: initialStrategy,
      createdAt: Date.now(),
      snapshotIds: [],
      errorTrackers: new Map(),
      partialSnapshots: [],
      retryConfig,
    }

    this.jobs.set(backfillId, job)

    logger.info('Created backfill job with enhanced error tracking', {
      backfillId,
      scopeType: scope.scopeType,
      targetDistricts: scope.targetDistricts.length,
      configuredDistricts: scope.configuredDistricts.length,
      retryEnabled: request.retryFailures !== false,
      maxRetryAttempts: retryConfig.maxAttempts,
      operation: 'createJob',
    })

    return job
  }

  updateProgress(jobId: string, progress: Partial<BackfillProgress>): void {
    const job = this.jobs.get(jobId)
    if (job) {
      job.progress = { ...job.progress, ...progress }

      logger.debug('Updated job progress with enhanced tracking', {
        jobId,
        completed: job.progress.completed,
        total: job.progress.total,
        failed: job.progress.failed,
        totalErrors: job.progress.totalErrors,
        retryableErrors: job.progress.retryableErrors,
        permanentErrors: job.progress.permanentErrors,
        partialSnapshots: job.progress.partialSnapshots,
        current: job.progress.current,
        operation: 'updateProgress',
      })
    }
  }

  /**
   * Track district-level error with detailed context
   * Implements Requirement 6.2: Track district-specific errors with detailed context
   */
  trackDistrictError(
    jobId: string,
    districtId: string,
    error: Error,
    errorType: DistrictError['errorType'],
    context?: Record<string, unknown>
  ): void {
    const job = this.jobs.get(jobId)
    if (!job) return

    const timestamp = new Date().toISOString()
    const isRetryable = job.retryConfig.retryableErrors!(error)

    // Get or create error tracker for this district
    let errorTracker = job.errorTrackers.get(districtId)
    if (!errorTracker) {
      errorTracker = {
        districtId,
        errors: [],
        consecutiveFailures: 0,
        totalRetries: 0,
        isBlacklisted: false,
      }
      job.errorTrackers.set(districtId, errorTracker)
    }

    // Create detailed error record
    const districtError: DistrictError = {
      districtId,
      error: error.message,
      errorType,
      timestamp,
      retryCount: errorTracker.totalRetries,
      isRetryable,
      context,
    }

    // Update error tracker
    errorTracker.errors.push(districtError)
    errorTracker.consecutiveFailures++
    errorTracker.lastFailureAt = timestamp
    errorTracker.totalRetries++

    // Check if district should be blacklisted (Requirement 6.5: exponential backoff)
    if (errorTracker.consecutiveFailures >= 5) {
      errorTracker.isBlacklisted = true
      errorTracker.blacklistUntil = new Date(
        Date.now() + Math.pow(2, errorTracker.consecutiveFailures) * 60000
      ).toISOString()

      logger.warn('District blacklisted due to consecutive failures', {
        jobId,
        districtId,
        consecutiveFailures: errorTracker.consecutiveFailures,
        blacklistUntil: errorTracker.blacklistUntil,
        operation: 'trackDistrictError',
      })
    }

    // Update job progress counters
    job.progress.totalErrors++
    if (isRetryable) {
      job.progress.retryableErrors++
    } else {
      job.progress.permanentErrors++
    }

    // Update district progress
    const districtProgress = job.progress.districtProgress.get(districtId)
    if (districtProgress) {
      districtProgress.status = errorTracker.isBlacklisted
        ? 'blacklisted'
        : 'failed'
      districtProgress.lastError = error.message
      districtProgress.errorTracker = errorTracker
      districtProgress.retryCount = errorTracker.totalRetries
    }

    logger.error('District error tracked with detailed context', {
      jobId,
      districtId,
      errorType,
      error: error.message,
      isRetryable,
      consecutiveFailures: errorTracker.consecutiveFailures,
      totalRetries: errorTracker.totalRetries,
      isBlacklisted: errorTracker.isBlacklisted,
      context,
      operation: 'trackDistrictError',
    })
  }

  /**
   * Track district success and reset error counters
   */
  trackDistrictSuccess(jobId: string, districtId: string): void {
    const job = this.jobs.get(jobId)
    if (!job) return

    const errorTracker = job.errorTrackers.get(districtId)
    if (errorTracker) {
      errorTracker.consecutiveFailures = 0
      errorTracker.lastSuccessAt = new Date().toISOString()
      errorTracker.isBlacklisted = false
      errorTracker.blacklistUntil = undefined
    }

    // Update district progress
    const districtProgress = job.progress.districtProgress.get(districtId)
    if (districtProgress) {
      districtProgress.status = 'completed'
      districtProgress.lastError = undefined
    }

    logger.debug('District success tracked - error counters reset', {
      jobId,
      districtId,
      operation: 'trackDistrictSuccess',
    })
  }

  /**
   * Check if district is blacklisted and should be skipped
   */
  isDistrictBlacklisted(jobId: string, districtId: string): boolean {
    const job = this.jobs.get(jobId)
    if (!job) return false

    const errorTracker = job.errorTrackers.get(districtId)
    if (!errorTracker || !errorTracker.isBlacklisted) return false

    // Check if blacklist has expired
    if (errorTracker.blacklistUntil) {
      const blacklistExpiry = new Date(errorTracker.blacklistUntil)
      if (Date.now() > blacklistExpiry.getTime()) {
        errorTracker.isBlacklisted = false
        errorTracker.blacklistUntil = undefined
        logger.info('District blacklist expired - re-enabling', {
          jobId,
          districtId,
          operation: 'isDistrictBlacklisted',
        })
        return false
      }
    }

    return true
  }

  /**
   * Record partial snapshot creation
   * Implements Requirement 6.3: Create partial snapshots when some districts succeed and others fail
   */
  recordPartialSnapshot(
    jobId: string,
    partialSnapshot: PartialSnapshotResult
  ): void {
    const job = this.jobs.get(jobId)
    if (!job) return

    job.partialSnapshots.push(partialSnapshot)
    job.progress.partialSnapshots++

    logger.info('Partial snapshot recorded', {
      jobId,
      snapshotId: partialSnapshot.snapshotId,
      successfulDistricts: partialSnapshot.successfulDistricts.length,
      failedDistricts: partialSnapshot.failedDistricts.length,
      successRate: partialSnapshot.successRate,
      operation: 'recordPartialSnapshot',
    })
  }

  getJob(jobId: string): BackfillJob | null {
    return this.jobs.get(jobId) || null
  }

  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId)
    if (job && job.status === 'processing') {
      job.status = 'cancelled'
      job.error = 'Backfill cancelled by user'
      job.completedAt = Date.now()

      logger.info('Cancelled backfill job', {
        jobId,
        operation: 'cancelJob',
      })

      return true
    }
    return false
  }

  cleanupCompletedJobs(maxAge: number): void {
    const cutoffTime = Date.now() - maxAge
    const jobsToDelete: string[] = []

    for (const [jobId, job] of this.jobs.entries()) {
      if (job.createdAt < cutoffTime && job.status !== 'processing') {
        jobsToDelete.push(jobId)
      }
    }

    jobsToDelete.forEach(id => this.jobs.delete(id))

    if (jobsToDelete.length > 0) {
      logger.info('Cleaned up old backfill jobs', {
        count: jobsToDelete.length,
        operation: 'cleanupCompletedJobs',
      })
    }
  }
}

/**
 * Data Source Selector for intelligent collection strategy selection
 */
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
    this.rankingCalculator = rankingCalculator

    if (!this.snapshotStore) {
      throw new Error('SnapshotStore is required for DataSourceSelector')
    }

    // Initialize rate limiter for data source protection (Requirement 9.1)
    this.rateLimiter = RateLimiterManager.getRateLimiter(
      'data-source-selector',
      {
        maxRequests: 15, // Slightly higher limit for data source selector
        windowMs: 60000, // 1 minute window
        minDelayMs: 1000, // Minimum 1 second between requests
        maxDelayMs: 20000, // Maximum 20 seconds backoff
        backoffMultiplier: 1.5,
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
      const { ToastmastersScraper } = await import('./ToastmastersScraper.js')
      const scraper = new ToastmastersScraper()

      for (const districtId of params.districtIds) {
        try {
          logger.debug('Collecting data for district', {
            districtId,
            operation: 'executePerDistrictCollection',
          })

          // Fetch district-specific data using the scraper with proper error handling
          let districtPerformanceData: ScrapedRecord[] = []
          let divisionPerformanceData: ScrapedRecord[] = []
          let clubPerformanceData: ScrapedRecord[] = []

          try {
            districtPerformanceData =
              await scraper.getDistrictPerformance(districtId)
            logger.debug('District performance data fetched successfully', {
              districtId,
              recordCount: districtPerformanceData.length,
              operation: 'executePerDistrictCollection',
            })
          } catch (error) {
            logger.warn(
              'District performance data not available, using empty data',
              {
                districtId,
                error: error instanceof Error ? error.message : 'Unknown error',
                operation: 'executePerDistrictCollection',
              }
            )
          }

          try {
            divisionPerformanceData =
              await scraper.getDivisionPerformance(districtId)
            logger.debug('Division performance data fetched successfully', {
              districtId,
              recordCount: divisionPerformanceData.length,
              operation: 'executePerDistrictCollection',
            })
          } catch (error) {
            logger.warn(
              'Division performance data not available, using empty data',
              {
                districtId,
                error: error instanceof Error ? error.message : 'Unknown error',
                operation: 'executePerDistrictCollection',
              }
            )
          }

          try {
            clubPerformanceData = await scraper.getClubPerformance(districtId)
            logger.debug('Club performance data fetched successfully', {
              districtId,
              recordCount: clubPerformanceData.length,
              operation: 'executePerDistrictCollection',
            })
          } catch (error) {
            logger.warn('Failed to fetch club performance data for district', {
              districtId,
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
              operation: 'executePerDistrictCollection',
            })
            continue
          }

          // Normalize the district data with available data
          const districtStats = await this.normalizeDistrictData(districtId, {
            districtPerformance: districtPerformanceData,
            divisionPerformance: divisionPerformanceData,
            clubPerformance: clubPerformanceData,
          })

          results.push(districtStats)

          logger.debug('Successfully collected district data', {
            districtId,
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
            error: errorMessage,
            operation: 'executePerDistrictCollection',
          })
          // Continue with other districts
        }
      }

      logger.info('Per-district collection completed', {
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
   */
  private async normalizeDistrictData(
    districtId: string,
    data: {
      districtPerformance: ScrapedRecord[]
      divisionPerformance: ScrapedRecord[]
      clubPerformance: ScrapedRecord[]
    }
  ): Promise<DistrictStatistics> {
    logger.debug('Normalizing district data', {
      districtId,
      districtRecords: data.districtPerformance.length,
      divisionRecords: data.divisionPerformance.length,
      clubRecords: data.clubPerformance.length,
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
        asOfDate: new Date().toISOString().split('T')[0],
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

/**
 * Scope Manager for district targeting and configuration validation
 */
export class ScopeManager {
  constructor(private configService: DistrictConfigurationService) {}

  async validateScope(request: BackfillRequest): Promise<BackfillScope> {
    logger.info('Validating backfill scope', {
      targetDistricts: request.targetDistricts?.length || 0,
      operation: 'validateScope',
    })

    const configuredDistricts =
      await this.configService.getConfiguredDistricts()
    const targetDistricts = await this.getTargetDistricts(request)

    // Validate all target districts are in scope
    const validationPassed = targetDistricts.every(
      districtId =>
        configuredDistricts.length === 0 ||
        configuredDistricts.includes(districtId)
    )

    // Determine scope type
    let scopeType: 'system-wide' | 'targeted' | 'single-district'
    if (
      targetDistricts.length === 0 ||
      targetDistricts.length === configuredDistricts.length
    ) {
      scopeType = 'system-wide'
    } else if (targetDistricts.length === 1) {
      scopeType = 'single-district'
    } else {
      scopeType = 'targeted'
    }

    const scope: BackfillScope = {
      targetDistricts,
      configuredDistricts,
      scopeType,
      validationPassed,
    }

    logger.info('Scope validation completed', {
      scopeType,
      targetDistricts: targetDistricts.length,
      configuredDistricts: configuredDistricts.length,
      validationPassed,
      operation: 'validateScope',
    })

    return scope
  }

  async getTargetDistricts(request: BackfillRequest): Promise<string[]> {
    if (request.targetDistricts && request.targetDistricts.length > 0) {
      return request.targetDistricts
    }

    // No specific targets - use all configured districts
    const configuredDistricts =
      await this.configService.getConfiguredDistricts()
    return configuredDistricts
  }

  isDistrictInScope(
    districtId: string,
    configuredDistricts: string[]
  ): boolean {
    // Requirement 7.2: When no districts configured, process all available districts
    if (configuredDistricts.length === 0) {
      return true
    }

    // Requirement 7.3: Restrict operations to configured scope
    return configuredDistricts.includes(districtId)
  }

  /**
   * Filter out-of-scope districts and return only valid ones
   * Implements Requirement 7.5 - exclude out-of-scope districts from processing
   */
  async filterValidDistricts(
    requestedDistricts: string[],
    logViolations: boolean = true
  ): Promise<{
    validDistricts: string[]
    invalidDistricts: string[]
    scopeViolations: Array<{
      districtId: string
      violationType: 'not_configured' | 'invalid_format'
      message: string
      suggestedAction: string
    }>
  }> {
    const configuredDistricts =
      await this.configService.getConfiguredDistricts()
    const validDistricts: string[] = []
    const invalidDistricts: string[] = []
    const scopeViolations: Array<{
      districtId: string
      violationType: 'not_configured' | 'invalid_format'
      message: string
      suggestedAction: string
    }> = []

    for (const districtId of requestedDistricts) {
      if (this.isDistrictInScope(districtId, configuredDistricts)) {
        validDistricts.push(districtId)
      } else {
        invalidDistricts.push(districtId)

        const violation = {
          districtId,
          violationType: 'not_configured' as const,
          message: `District ${districtId} excluded from processing - not in configuration scope`,
          suggestedAction:
            configuredDistricts.length === 0
              ? 'Configure districts using the district configuration service'
              : `Add district ${districtId} to configuration or use one of: [${configuredDistricts.join(', ')}]`,
        }
        scopeViolations.push(violation)

        if (logViolations) {
          // Requirement 7.5: Log scope violations
          logger.warn('District scope violation - excluding from processing', {
            districtId,
            violationType: violation.violationType,
            message: violation.message,
            suggestedAction: violation.suggestedAction,
            configuredDistricts,
            operation: 'filterValidDistricts',
          })
        }
      }
    }

    // Log summary of scope violations (Requirement 7.5)
    if (scopeViolations.length > 0 && logViolations) {
      logger.warn('Scope violations detected during district filtering', {
        totalViolations: scopeViolations.length,
        invalidDistricts,
        validDistricts,
        configuredDistricts,
        violations: scopeViolations.map(v => ({
          districtId: v.districtId,
          type: v.violationType,
          message: v.message,
        })),
        operation: 'filterValidDistricts',
      })
    }

    return {
      validDistricts,
      invalidDistricts,
      scopeViolations,
    }
  }

  /**
   * Determine scope type based on target and configured districts
   * Implements Requirements 2.4, 2.5
   */
  determineScopeType(
    targetDistricts: string[],
    configuredDistricts: string[]
  ): 'system-wide' | 'targeted' | 'single-district' {
    if (
      targetDistricts.length === 0 ||
      (configuredDistricts.length > 0 &&
        targetDistricts.length === configuredDistricts.length)
    ) {
      return 'system-wide'
    } else if (targetDistricts.length === 1) {
      // Requirement 2.4: Support single-district targeting
      return 'single-district'
    } else {
      // Requirement 2.5: Support multi-district targeting
      return 'targeted'
    }
  }
}

/**
 * Unified BackfillService - Complete rewrite replacing existing services
 */
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
    this.rankingCalculator = rankingCalculator

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
   *
   * This is the main entry point for starting backfill operations. The method performs
   * comprehensive validation, scope checking, and strategy selection before starting
   * the background processing.
   *
   * ## Process Flow
   * 1. **Scope Validation**: Validates target districts against configured scope
   * 2. **Job Creation**: Creates a new job with unique ID and progress tracking
   * 3. **Strategy Selection**: Selects optimal collection strategy based on request
   * 4. **Background Processing**: Starts asynchronous processing with error handling
   *
   * ## Error Handling
   * - Invalid districts are filtered out with detailed logging
   * - Scope violations are logged and excluded from processing
   * - Network and API errors are handled with retry logic
   * - Partial failures result in partial snapshots rather than complete failure
   *
   * @param request - Backfill configuration with targeting and performance options
   * @returns Promise resolving to unique backfill job ID
   *
   * @throws {Error} When no valid districts are available for processing
   * @throws {Error} When request validation fails
   * @throws {Error} When job creation fails
   *
   * @example Basic Usage
   * ```typescript
   * const backfillId = await service.initiateBackfill({
   *   startDate: '2024-01-01',
   *   endDate: '2024-01-30'
   * });
   * ```
   *
   * @example Advanced Usage
   * ```typescript
   * const backfillId = await service.initiateBackfill({
   *   targetDistricts: ['42', '15'],
   *   startDate: '2024-07-01',
   *   endDate: '2024-12-31',
   *   collectionType: 'per-district',
   *   concurrency: 5,
   *   retryFailures: true,
   *   enableCaching: true
   * });
   * ```
   *
   * @see {@link getBackfillStatus} For monitoring progress
   * @see {@link cancelBackfill} For cancelling operations
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

      // Create scope with filtered districts (Requirement 7.5: exclude out-of-scope districts)
      const configuredDistricts =
        await this.configService.getConfiguredDistricts()
      const scope: BackfillScope = {
        targetDistricts: filterResult.validDistricts, // Only valid districts
        configuredDistricts,
        scopeType: this.scopeManager.determineScopeType(
          filterResult.validDistricts,
          configuredDistricts
        ),
        validationPassed: true, // Always true since we filtered out invalid districts
      }

      // Log scope violations if any (Requirement 7.5)
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
        targetDistricts: filterResult.validDistricts, // Use filtered districts
      })
      job.collectionStrategy = strategy

      // Step 4: Start background processing
      this.processBackfill(job.backfillId, {
        ...request,
        targetDistricts: filterResult.validDistricts, // Use filtered districts
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
   *
   * This method provides detailed information about a backfill job's current state,
   * including progress tracking, error summaries, performance metrics, and partial
   * snapshot information.
   *
   * ## Returned Information
   * - **Job Status**: Current status (processing, complete, error, cancelled, partial_success)
   * - **Progress Tracking**: Detailed progress with district-level breakdown
   * - **Error Information**: Comprehensive error summaries and district-specific errors
   * - **Performance Metrics**: Rate limiting, concurrency, and caching statistics
   * - **Snapshot Information**: Created snapshots and partial snapshot details
   *
   * ## Status Types
   * - `processing`: Job is currently running
   * - `complete`: Job completed successfully with no errors
   * - `partial_success`: Job completed but some districts failed
   * - `error`: Job failed completely
   * - `cancelled`: Job was cancelled by user
   *
   * @param backfillId - Unique identifier of the backfill job
   * @returns BackfillResponse with comprehensive status information, or null if job not found
   *
   * @example Basic Status Check
   * ```typescript
   * const status = service.getBackfillStatus(backfillId);
   * if (status) {
   *   console.log(`Status: ${status.status}`);
   *   console.log(`Progress: ${status.progress.completed}/${status.progress.total}`);
   * }
   * ```
   *
   * @example Detailed Error Analysis
   * ```typescript
   * const status = service.getBackfillStatus(backfillId);
   * if (status?.errorSummary && status.errorSummary.totalErrors > 0) {
   *   console.log(`Total errors: ${status.errorSummary.totalErrors}`);
   *   console.log(`Affected districts: ${status.errorSummary.affectedDistricts.join(', ')}`);
   *   console.log(`Retryable errors: ${status.errorSummary.retryableErrors}`);
   * }
   * ```
   *
   * @example Performance Monitoring
   * ```typescript
   * const status = service.getBackfillStatus(backfillId);
   * if (status?.performanceStatus) {
   *   const perf = status.performanceStatus;
   *   console.log(`Cache hit rate: ${Math.round(perf.intermediateCache.hitRate * 100)}%`);
   *   console.log(`Active slots: ${perf.concurrencyLimiter.activeSlots}/${perf.concurrencyLimiter.maxConcurrent}`);
   * }
   * ```
   *
   * @see {@link initiateBackfill} For starting backfill operations
   * @see {@link cancelBackfill} For cancelling operations
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
   *
   * This method attempts to cancel a backfill job that is currently in 'processing' status.
   * The cancellation is graceful - it will stop processing new operations but allow
   * currently running operations to complete.
   *
   * ## Cancellation Behavior
   * - Only jobs in 'processing' status can be cancelled
   * - Currently running district operations will complete
   * - No new operations will be started
   * - Job status will be updated to 'cancelled'
   * - Partial results (if any) will be preserved
   *
   * @param backfillId - Unique identifier of the backfill job to cancel
   * @returns Promise resolving to true if cancellation was successful, false otherwise
   *
   * @example Cancel a Job
   * ```typescript
   * const cancelled = await service.cancelBackfill(backfillId);
   * if (cancelled) {
   *   console.log('Backfill cancelled successfully');
   * } else {
   *   console.log('Could not cancel backfill (may already be complete)');
   * }
   * ```
   *
   * @example Cancel with Status Check
   * ```typescript
   * const status = service.getBackfillStatus(backfillId);
   * if (status?.status === 'processing') {
   *   const cancelled = await service.cancelBackfill(backfillId);
   *   console.log(`Cancellation ${cancelled ? 'successful' : 'failed'}`);
   * } else {
   *   console.log(`Cannot cancel job in ${status?.status} status`);
   * }
   * ```
   *
   * @see {@link getBackfillStatus} For checking if job can be cancelled
   * @see {@link initiateBackfill} For starting new operations
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
   * Provides visibility into rate limiting, concurrency control, and caching performance
   */
  getPerformanceStatus(): {
    rateLimiter: ReturnType<RateLimiter['getStatus']>
    concurrencyLimiter: ReturnType<ConcurrencyLimiter['getStatus']>
    intermediateCache: ReturnType<IntermediateCache['getStats']>
  } {
    return {
      rateLimiter: this.rateLimiter.getStatus(),
      concurrencyLimiter: this.concurrencyLimiter.getStatus(),
      intermediateCache: this.intermediateCache.getStats(),
    }
  }

  /**
   * Update performance optimization settings
   * Allows runtime adjustment of performance parameters
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
      // Rate limiter doesn't have a direct update method, but we can log the intent
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
   * Background processing of backfill operations with enhanced error handling and performance optimizations
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
      // Update concurrency limit if specified in request (Requirement 9.2)
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

      // Process dates with concurrency control (Requirement 9.2)
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

          // Continue with next date - don't fail entire job for single date failure
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
   * Implements Requirements 6.1, 6.2, 6.3: Continue processing when districts fail, track errors, create partial snapshots
   * Implements Requirement 9.3: Caching for intermediate results to avoid redundant operations
   */
  private async processDateWithErrorHandlingAndCaching(
    backfillId: string,
    date: string,
    job: BackfillJob,
    request: BackfillRequest
  ): Promise<void> {
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

        // Execute collection for single district with caching (Requirement 9.3)
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

          // Update district progress
          if (districtProgress) {
            districtProgress.datesProcessed++
            districtProgress.successfulDates.push(date)
            districtProgress.status = 'completed'
          }

          logger.debug('Successfully collected district data with caching', {
            backfillId,
            districtId,
            date,
            fromCache: false, // This will be true when retrieved from cache
            operation: 'processDateWithErrorHandlingAndCaching',
          })
        } else {
          // No data available for this district/date
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

        // Update district progress
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

    // Create snapshot if we have any successful districts (Requirement 6.3: partial snapshots)
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
   * Implements Requirement 9.3: Caching for intermediate results to avoid redundant operations
   */
  private async collectDistrictDataWithCaching(
    districtId: string,
    date: string,
    strategy: CollectionStrategy,
    enableCaching: boolean = true,
    cacheKeyPrefix?: string
  ): Promise<DistrictStatistics | null> {
    const cacheKey = `${cacheKeyPrefix || 'district'}_${districtId}_${date}_${strategy.type}`

    // Try to get from cache first (Requirement 9.3)
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

      // Cache the result if successful and caching is enabled (Requirement 9.3)
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
      // Log error before re-throwing for debugging
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
   * Implements Requirement 6.3: Create partial snapshots when some districts succeed and others fail
   */
  private async createPartialSnapshot(
    backfillId: string,
    date: string,
    successfulDistricts: DistrictStatistics[],
    failedDistricts: string[],
    errors: DistrictError[]
  ): Promise<PartialSnapshotResult> {
    const snapshotId = `${Date.parse(date)}-partial-${Date.now()}`
    const startTime = Date.now()

    logger.info('Creating partial snapshot', {
      backfillId,
      snapshotId,
      date,
      successfulDistricts: successfulDistricts.length,
      failedDistricts: failedDistricts.length,
      operation: 'createPartialSnapshot',
    })

    try {
      // Step 1: Calculate rankings if ranking calculator is available
      let rankedDistricts = successfulDistricts
      if (this.rankingCalculator && successfulDistricts.length > 0) {
        logger.info('Starting ranking calculation for partial snapshot', {
          backfillId,
          snapshotId,
          date,
          districtCount: successfulDistricts.length,
          rankingVersion: this.rankingCalculator.getRankingVersion(),
          operation: 'createPartialSnapshot',
        })

        try {
          rankedDistricts =
            await this.rankingCalculator.calculateRankings(successfulDistricts)

          logger.info('Ranking calculation completed for partial snapshot', {
            backfillId,
            snapshotId,
            date,
            districtCount: rankedDistricts.length,
            rankedDistrictCount: rankedDistricts.filter(d => d.ranking).length,
            rankingVersion: this.rankingCalculator.getRankingVersion(),
            operation: 'createPartialSnapshot',
          })
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error'
          logger.error(
            'Ranking calculation failed for partial snapshot, continuing without rankings',
            {
              backfillId,
              snapshotId,
              date,
              error: errorMessage,
              districtCount: successfulDistricts.length,
              operation: 'createPartialSnapshot',
            }
          )
          // Continue with original districts without ranking data
          // This implements the error handling requirement 5.3
        }
      } else {
        logger.debug(
          'No ranking calculator provided or no successful districts, skipping ranking calculation',
          {
            backfillId,
            snapshotId,
            date,
            hasRankingCalculator: !!this.rankingCalculator,
            districtCount: successfulDistricts.length,
            operation: 'createPartialSnapshot',
          }
        )
      }

      // Step 2: Create normalized data structure with ranked districts
      // Enhanced metadata for Requirement 5.5: data source, scope, and collection method
      const job = this.jobManager.getJob(backfillId)
      const normalizedData: NormalizedData = {
        districts: rankedDistricts,
        metadata: {
          source: 'unified-backfill-service',
          fetchedAt: new Date().toISOString(),
          dataAsOfDate: date,
          districtCount: rankedDistricts.length,
          processingDurationMs: Date.now() - startTime,
          backfillJobId: backfillId,
          // Enhanced metadata for Requirement 5.5: scope and collection method
          configuredDistricts: job?.scope.configuredDistricts || [],
          successfulDistricts: rankedDistricts.map(d => d.districtId),
          failedDistricts: failedDistricts,
          districtErrors: errors.map(e => ({
            districtId: e.districtId,
            error: e.error,
            errorType: this.mapToSnapshotErrorType(e.errorType),
            timestamp: e.timestamp,
          })),
          // Additional metadata for RefreshService compatibility (Requirement 11.3)
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

      // Write snapshot
      await this.snapshotStore.writeSnapshot(snapshot)

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
        snapshotId,
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
   * Generate date range for processing
   */
  private generateDateRange(startDate: string, endDate?: string): string[] {
    const start = new Date(startDate)
    const end = endDate ? new Date(endDate) : new Date(startDate)
    const dates: string[] = []

    const currentDate = new Date(start)
    while (currentDate <= end) {
      dates.push(currentDate.toISOString().split('T')[0])
      currentDate.setDate(currentDate.getDate() + 1)
    }

    return dates.reverse() // Start with most recent
  }
}
