/**
 * RefreshService orchestrates the complete refresh workflow
 *
 * This service coordinates snapshot creation from cached CSV data.
 * It uses SnapshotBuilder to create snapshots without performing any scraping.
 * Scraping is handled separately by the scraper-cli tool.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 8.1, 8.2
 */

import { logger } from '../utils/logger.js'
import { DataValidator } from './DataValidator.js'
import { DistrictConfigurationService } from './DistrictConfigurationService.js'
import { RawCSVCacheService } from './RawCSVCacheService.js'
import { ClosingPeriodDetector } from './ClosingPeriodDetector.js'
import { DataNormalizer } from './DataNormalizer.js'
import { SnapshotBuilder, type BuildResult } from './SnapshotBuilder.js'
import type { RankingCalculator } from './RankingCalculator.js'
import type { SnapshotStore } from '../types/snapshots.js'
import type { FileSnapshotStore } from './SnapshotStore.js'

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
 */
export class RefreshService {
  private readonly snapshotBuilder: SnapshotBuilder
  private readonly districtConfigService: DistrictConfigurationService
  private readonly snapshotStore: SnapshotStore

  constructor(
    snapshotStore: SnapshotStore,
    rawCSVCache: RawCSVCacheService,
    districtConfigService?: DistrictConfigurationService,
    rankingCalculator?: RankingCalculator,
    closingPeriodDetector?: ClosingPeriodDetector,
    dataNormalizer?: DataNormalizer,
    validator?: DataValidator
  ) {
    this.snapshotStore = snapshotStore
    this.districtConfigService =
      districtConfigService ?? new DistrictConfigurationService()

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
    this.snapshotBuilder = new SnapshotBuilder(
      rawCSVCache,
      this.districtConfigService,
      snapshotStore as FileSnapshotStore,
      validator ?? new DataValidator(),
      rankingCalculator,
      detector,
      normalizer
    )

    logger.debug('RefreshService initialized with SnapshotBuilder', {
      hasRankingCalculator: !!rankingCalculator,
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
        const errorMessage = `No cached data available for date ${targetDate}. Please run scraper-cli to collect data first.`
        logger.error('Refresh failed: no cached data available', {
          refreshId,
          operation: 'executeRefresh',
          phase: 'cache_check',
          targetDate,
          configuredDistricts: cacheAvailability.configuredDistricts,
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
  async validateConfiguration(): Promise<
    import('./DistrictConfigurationService.js').ConfigurationValidationResult
  > {
    logger.debug('Validating district configuration')

    // Check if any districts are configured
    const hasConfiguredDistricts =
      await this.districtConfigService.hasConfiguredDistricts()
    if (!hasConfiguredDistricts) {
      return {
        isValid: false,
        configuredDistricts: [],
        validDistricts: [],
        invalidDistricts: [],
        warnings: [
          'No districts configured for data collection. Please configure at least one district before running refresh operations.',
        ],
        suggestions: [],
        lastCollectionInfo: [],
      }
    }

    // For basic validation, we don't have all-districts data yet
    // This will be enhanced during the actual refresh process
    const basicValidation =
      await this.districtConfigService.validateConfiguration(
        undefined, // No all-districts validation yet
        this.snapshotStore
      )

    return basicValidation
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
   */
  private convertBuildResultToRefreshResult(
    buildResult: BuildResult,
    startTime: number,
    startedAt: string
  ): RefreshResult {
    const completedAt = new Date().toISOString()
    const duration_ms = Date.now() - startTime

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
