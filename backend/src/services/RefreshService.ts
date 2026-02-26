/**
 * RefreshService orchestrates the complete refresh workflow
 *
 * This service coordinates snapshot creation from cached CSV data.
 * It uses SnapshotBuilder to create snapshots without performing any scraping.
 * Scraping is handled separately by the collector-cli tool.
 *
 * IMPORTANT: This service is READ-ONLY. All computation (time-series data points,
 * rankings, analytics) is performed by collector-cli during the data pipeline.
 * The backend does NOT perform any computation per the data-computation-separation
 * steering document.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 8.1, 8.2
 * Storage Abstraction: Requirements 1.3, 1.4
 * Pre-Computed Analytics: Requirements 1.1, 1.4
 */
import { logger } from '../utils/logger.js'
import type { SnapshotStore } from '../types/snapshots.js'

import { DataValidator } from './DataValidator.js'
import { ClosingPeriodDetector } from './ClosingPeriodDetector.js'
import { DataNormalizer } from './DataNormalizer.js'
import { SnapshotBuilder, type BuildResult } from './SnapshotBuilder.js'
import type { PreComputedAnalyticsService } from './PreComputedAnalyticsService.js'
import type {
  ISnapshotStorage,
  IRawCSVStorage,
} from '../types/storageInterfaces.js'

/**
 * Result of a complete refresh operation
 */
export interface RefreshResult {
  /** Whether the refresh was successful */
  success: boolean
  /** ID of the created snapshot (if any) */
  snapshot_id?: string
  /** Duration of the entire refresh operation in milliseconds */
  duration_ms: number
  /** Any errors encountered during refresh */
  errors: string[]
  /** Status of the refresh operation */
  status: 'success' | 'partial' | 'failed'
  /** Additional metadata about the refresh */
  metadata: {
    /** Number of districts processed */
    districtCount: number
    /** Timestamp when refresh started */
    startedAt: string
    /** Timestamp when refresh completed */
    completedAt: string
    /** Schema version used */
    schemaVersion: string
    /** Calculation version used */
    calculationVersion: string
  }
}

/**
 * RefreshService orchestrates the complete refresh workflow using cached data
 *
 * Requirements:
 * - 4.1: Use SnapshotBuilder to create snapshots from cached CSV data
 * - 4.2: Do not perform any scraping operations
 * - 4.3: Check for available cached data before attempting snapshot creation
 * - 4.4: Return informative error when cache is missing
 * - 8.1: Remove all scraping-related code from RefreshService
 * - 8.2: Exclusively use SnapshotBuilder to create snapshots
 *
 * Storage Abstraction (Requirements 1.3, 1.4):
 * - Uses ISnapshotStorage interface for snapshot operations
 * - Supports both local filesystem and cloud storage backends
 *
 * Pre-Computed Analytics (Requirements 1.1, 1.4):
 * - Computes and stores analytics summaries during snapshot creation
 * - Handles errors gracefully - logs and continues if individual district fails
 */
export class RefreshService {
  private readonly snapshotBuilder: SnapshotBuilder
  private readonly snapshotStorage: ISnapshotStorage

  /**
   * Create a new RefreshService instance
   *
   * IMPORTANT: This service is READ-ONLY. All computation (time-series data points,
   * rankings, analytics) is performed by collector-cli during the data pipeline.
   * The backend does NOT perform any computation per the data-computation-separation
   * steering document.
   *
   * @param snapshotStorage - Storage interface for snapshot operations (ISnapshotStorage)
   *                          Supports both local filesystem and cloud storage backends
   * @param rawCSVCache - Storage interface for raw CSV data (IRawCSVStorage)
   *                      Supports both local filesystem and cloud storage backends
   * @param _rankingCalculator - DEPRECATED: Rankings are pre-computed by collector-cli (kept for backward compatibility)
   * @param closingPeriodDetector - Optional closing period detector
   * @param dataNormalizer - Optional data normalizer
   * @param validator - Optional data validator
   * @param _preComputedAnalyticsService - DEPRECATED: Analytics are now pre-computed by collector-cli
   * @param cacheDir - Directory where raw CSV data is cached
   */
  constructor(
    snapshotStorage: ISnapshotStorage | SnapshotStore,
    rawCSVCache: IRawCSVStorage,
    _rankingCalculator?: unknown, // DEPRECATED: Rankings are pre-computed by collector-cli
    closingPeriodDetector?: ClosingPeriodDetector,
    dataNormalizer?: DataNormalizer,
    validator?: DataValidator,
    _preComputedAnalyticsService?: PreComputedAnalyticsService,
    cacheDir?: string
  ) {
    // Store the snapshot storage - ISnapshotStorage is a superset of SnapshotStore
    // so we can safely cast SnapshotStore to ISnapshotStorage for backward compatibility
    this.snapshotStorage = snapshotStorage as ISnapshotStorage

    // NOTE: preComputedAnalyticsService parameter is kept for backward compatibility
    // but is no longer used. Analytics are now pre-computed by collector-cli.

    // Initialize ClosingPeriodDetector
    const detector =
      closingPeriodDetector ?? new ClosingPeriodDetector({ logger })

    // Initialize DataNormalizer with ClosingPeriodDetector
    const normalizer =
      dataNormalizer ??
      new DataNormalizer({
        logger,
        closingPeriodDetector: detector,
      })

    // Initialize SnapshotBuilder with all dependencies
    // SnapshotBuilder accepts ISnapshotStorage for storage operations
    // Note: Rankings are now pre-computed by collector-cli, so no RankingCalculator is needed
    this.snapshotBuilder = new SnapshotBuilder(
      rawCSVCache,
      this.snapshotStorage,
      validator ?? new DataValidator(),
      detector,
      normalizer,
      undefined, // customLogger
      undefined, // districtIdValidator
      cacheDir
    )

    logger.debug('RefreshService initialized with SnapshotBuilder', {
      hasPreComputedAnalyticsService: !!_preComputedAnalyticsService,
    })
  }

  /**
   * Execute a complete refresh cycle using cached data
   *
   * Requirements:
   * - 4.1: Use SnapshotBuilder to create snapshots from cached CSV data
   * - 4.3: Check for available cached data before attempting snapshot creation
   * - 4.4: Return informative error when cache is missing
   *
   * @param date - Optional date to build snapshot for (YYYY-MM-DD format)
   */
  async executeRefresh(date?: string): Promise<RefreshResult> {
    const startTime = Date.now()
    const startedAt = new Date().toISOString()
    const targetDate = date ?? this.getCurrentDateString()
    const refreshId = `refresh_${startTime}`

    logger.info('Starting refresh operation from cached data', {
      refreshId,
      startedAt,
      targetDate,
      schemaVersion: this.getCurrentSchemaVersion(),
      calculationVersion: this.getCurrentCalculationVersion(),
      operation: 'executeRefresh',
    })

    try {
      // Step 0: Validate district configuration before starting refresh
      logger.info('Validating district configuration', {
        refreshId,
        operation: 'executeRefresh',
        phase: 'configuration_validation',
      })

      const configValidationResult = await this.validateConfiguration()

      if (!configValidationResult.isValid) {
        const errorMessage = `Invalid district configuration: ${configValidationResult.warnings.join('; ')}`
        logger.error('Refresh failed due to invalid configuration', {
          refreshId,
          operation: 'executeRefresh',
          phase: 'configuration_validation',
          errors: configValidationResult.warnings,
        })

        return this.createFailedResult(startTime, startedAt, [errorMessage], 0)
      }

      logger.info('District configuration validated successfully', {
        refreshId,
        operation: 'executeRefresh',
        phase: 'configuration_validation',
        configuredDistricts: configValidationResult.configuredDistricts.length,
        validDistricts: configValidationResult.validDistricts.length,
        warnings: configValidationResult.warnings.length,
      })

      // Step 1: Check cache availability (Requirement 4.3)
      logger.info('Checking cache availability', {
        refreshId,
        operation: 'executeRefresh',
        phase: 'cache_check',
        targetDate,
      })

      const cacheAvailability =
        await this.snapshotBuilder.getCacheAvailability(targetDate)

      if (!cacheAvailability.available) {
        // Requirement 4.4: Return informative error when cache is missing
        const errorMessage = `No cached data available for date ${targetDate}. Please run collector-cli to collect data first.`
        logger.error('Refresh failed: no cached data available', {
          refreshId,
          operation: 'executeRefresh',
          phase: 'cache_check',
          targetDate,
          missingDistricts: cacheAvailability.missingDistricts,
        })

        return this.createFailedResult(startTime, startedAt, [errorMessage], 0)
      }

      logger.info('Cache data available', {
        refreshId,
        operation: 'executeRefresh',
        phase: 'cache_check',
        targetDate,
        cachedDistricts: cacheAvailability.cachedDistricts.length,
        missingDistricts: cacheAvailability.missingDistricts.length,
      })

      // Step 2: Build snapshot from cached data (Requirements 4.1, 8.2)
      logger.info('Building snapshot from cached data', {
        refreshId,
        operation: 'executeRefresh',
        phase: 'snapshot_build',
        targetDate,
      })

      const buildResult = await this.snapshotBuilder.build({ date: targetDate })

      // Convert BuildResult to RefreshResult
      return this.convertBuildResultToRefreshResult(
        buildResult,
        startTime,
        startedAt
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      logger.error('Refresh failed with unexpected error', {
        refreshId,
        operation: 'executeRefresh',
        error: errorMessage,
        targetDate,
      })

      return this.createFailedResult(startTime, startedAt, [errorMessage], 0)
    }
  }

  /**
   * Validate district configuration before refresh operations
   */
  async validateConfiguration(): Promise<{
    isValid: boolean
    configuredDistricts: string[]
    validDistricts: string[]
    invalidDistricts: string[]
    warnings: string[]
    suggestions: string[]
    lastCollectionInfo: Array<{ districtId: string; lastCollectedAt: string }>
  }> {
    logger.debug(
      'Validating district configuration - no longer applicable, districts are dynamically discovered'
    )

    // Always return valid, as we dynamically discover districts
    return {
      isValid: true,
      configuredDistricts: [],
      validDistricts: [],
      invalidDistricts: [],
      warnings: [],
      suggestions: [],
      lastCollectionInfo: [],
    }
  }

  /**
   * Check if cached data is available for a specific date
   *
   * @param date - Target date (YYYY-MM-DD format), defaults to current date
   * @returns Cache availability information
   */
  async checkCacheAvailability(date?: string): Promise<{
    available: boolean
    date: string
    cachedDistricts: string[]
    missingDistricts: string[]
  }> {
    const targetDate = date ?? this.getCurrentDateString()
    const availability =
      await this.snapshotBuilder.getCacheAvailability(targetDate)

    return {
      available: availability.available,
      date: availability.date,
      cachedDistricts: availability.cachedDistricts,
      missingDistricts: availability.missingDistricts,
    }
  }

  /**
   * Convert SnapshotBuilder BuildResult to RefreshResult
   *
   * Also triggers pre-computed analytics generation if the service is available.
   * Requirement 1.1: Compute and store analytics summaries for each district in the snapshot
   * Requirement 1.4: Log errors and continue if individual district fails
   *
   * NOTE: Time-series index updates are now handled by collector-cli during the
   * compute-analytics pipeline per the data-computation-separation steering document.
   */
  private async convertBuildResultToRefreshResult(
    buildResult: BuildResult,
    startTime: number,
    startedAt: string
  ): Promise<RefreshResult> {
    const completedAt = new Date().toISOString()
    const duration_ms = Date.now() - startTime

    // NOTE: Pre-computed analytics and time-series index updates are now handled
    // by collector-cli during the compute-analytics pipeline. The backend no longer
    // performs any computation per the data-computation-separation steering document.

    logger.info('Refresh completed', {
      operation: 'executeRefresh',
      success: buildResult.success,
      status: buildResult.status,
      snapshotId: buildResult.snapshotId,
      districtsIncluded: buildResult.districtsIncluded.length,
      districtsMissing: buildResult.districtsMissing.length,
      duration_ms,
    })

    return {
      success: buildResult.success,
      snapshot_id: buildResult.snapshotId,
      duration_ms,
      errors: buildResult.errors,
      status: buildResult.status,
      metadata: {
        districtCount: buildResult.districtsIncluded.length,
        startedAt,
        completedAt,
        schemaVersion: this.getCurrentSchemaVersion(),
        calculationVersion: this.getCurrentCalculationVersion(),
      },
    }
  }

  /**
   * Create a failed RefreshResult
   */
  private createFailedResult(
    startTime: number,
    startedAt: string,
    errors: string[],
    districtCount: number
  ): RefreshResult {
    const completedAt = new Date().toISOString()
    const duration_ms = Date.now() - startTime

    return {
      success: false,
      duration_ms,
      errors,
      status: 'failed',
      metadata: {
        districtCount,
        startedAt,
        completedAt,
        schemaVersion: this.getCurrentSchemaVersion(),
        calculationVersion: this.getCurrentCalculationVersion(),
      },
    }
  }

  /**
   * Get current date as YYYY-MM-DD string
   */
  private getCurrentDateString(): string {
    return new Date().toISOString().split('T')[0] ?? ''
  }

  /**
   * Get current schema version
   */
  private getCurrentSchemaVersion(): string {
    return '1.0.0'
  }

  /**
   * Get current calculation version
   */
  private getCurrentCalculationVersion(): string {
    return '1.0.0'
  }
}
