/**
 * RefreshService orchestrates the complete refresh workflow
 *
 * This service coordinates snapshot creation from cached CSV data.
 * It uses SnapshotBuilder to create snapshots without performing any scraping.
 * Scraping is handled separately by the scraper-cli tool.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 8.1, 8.2
 * Storage Abstraction: Requirements 1.3, 1.4
 * Pre-Computed Analytics: Requirements 1.1, 1.4
 */

import { logger } from '../utils/logger.js'
import { DataValidator } from './DataValidator.js'
import { DistrictConfigurationService } from './DistrictConfigurationService.js'
import { ClosingPeriodDetector } from './ClosingPeriodDetector.js'
import { DataNormalizer } from './DataNormalizer.js'
import { SnapshotBuilder, type BuildResult } from './SnapshotBuilder.js'
import type { PreComputedAnalyticsService } from './PreComputedAnalyticsService.js'
import type { ITimeSeriesIndexService } from './TimeSeriesIndexService.js'
import type { RankingCalculator } from './RankingCalculator.js'
import type { SnapshotStore } from '../types/snapshots.js'
import type {
  ISnapshotStorage,
  IRawCSVStorage,
} from '../types/storageInterfaces.js'
import type { TimeSeriesDataPoint } from '../types/precomputedAnalytics.js'
import { StorageProviderFactory } from './storage/StorageProviderFactory.js'

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
  private readonly districtConfigService: DistrictConfigurationService
  private readonly snapshotStorage: ISnapshotStorage
  private readonly preComputedAnalyticsService?: PreComputedAnalyticsService
  private readonly timeSeriesIndexService?: ITimeSeriesIndexService

  /**
   * Create a new RefreshService instance
   *
   * @param snapshotStorage - Storage interface for snapshot operations (ISnapshotStorage)
   *                          Supports both local filesystem and cloud storage backends
   * @param rawCSVCache - Storage interface for raw CSV data (IRawCSVStorage)
   *                      Supports both local filesystem and cloud storage backends
   * @param districtConfigService - Optional district configuration service
   * @param rankingCalculator - Optional ranking calculator for BordaCount rankings
   * @param closingPeriodDetector - Optional closing period detector
   * @param dataNormalizer - Optional data normalizer
   * @param validator - Optional data validator
   * @param preComputedAnalyticsService - Optional service for pre-computing analytics during snapshot creation
   * @param timeSeriesIndexService - Optional service for maintaining time-series indexes during snapshot creation
   */
  constructor(
    snapshotStorage: ISnapshotStorage | SnapshotStore,
    rawCSVCache: IRawCSVStorage,
    districtConfigService?: DistrictConfigurationService,
    rankingCalculator?: RankingCalculator,
    closingPeriodDetector?: ClosingPeriodDetector,
    dataNormalizer?: DataNormalizer,
    validator?: DataValidator,
    preComputedAnalyticsService?: PreComputedAnalyticsService,
    timeSeriesIndexService?: ITimeSeriesIndexService
  ) {
    // Store the snapshot storage - ISnapshotStorage is a superset of SnapshotStore
    // so we can safely cast SnapshotStore to ISnapshotStorage for backward compatibility
    this.snapshotStorage = snapshotStorage as ISnapshotStorage

    // Store the pre-computed analytics service if provided
    this.preComputedAnalyticsService = preComputedAnalyticsService

    // Store the time-series index service if provided
    this.timeSeriesIndexService = timeSeriesIndexService

    // Create DistrictConfigurationService with storage from StorageProviderFactory if not provided
    if (districtConfigService) {
      this.districtConfigService = districtConfigService
    } else {
      const storageProviders = StorageProviderFactory.createFromEnvironment()
      this.districtConfigService = new DistrictConfigurationService(
        storageProviders.districtConfigStorage
      )
    }

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
    this.snapshotBuilder = new SnapshotBuilder(
      rawCSVCache,
      this.districtConfigService,
      this.snapshotStorage,
      validator ?? new DataValidator(),
      rankingCalculator,
      detector,
      normalizer
    )

    logger.debug('RefreshService initialized with SnapshotBuilder', {
      hasRankingCalculator: !!rankingCalculator,
      hasPreComputedAnalyticsService: !!preComputedAnalyticsService,
      hasTimeSeriesIndexService: !!timeSeriesIndexService,
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
        this.snapshotStorage
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
   *
   * Also triggers pre-computed analytics generation if the service is available.
   * Requirement 1.1: Compute and store analytics summaries for each district in the snapshot
   * Requirement 1.4: Log errors and continue if individual district fails
   * Requirement 2.2: Append analytics summary to time-series index when snapshot is created
   */
  private async convertBuildResultToRefreshResult(
    buildResult: BuildResult,
    startTime: number,
    startedAt: string
  ): Promise<RefreshResult> {
    const completedAt = new Date().toISOString()
    const duration_ms = Date.now() - startTime

    // Trigger pre-computed analytics generation if service is available and build was successful
    // Requirement 1.1: Compute and store analytics summaries when a new snapshot is created
    if (
      this.preComputedAnalyticsService &&
      buildResult.success &&
      buildResult.snapshotId
    ) {
      await this.triggerPreComputedAnalytics(buildResult.snapshotId)
    }

    // Trigger time-series index update if service is available and build was successful
    // Requirement 2.2: Append analytics summary to time-series index when snapshot is created
    if (
      this.timeSeriesIndexService &&
      buildResult.success &&
      buildResult.snapshotId &&
      buildResult.districtData
    ) {
      await this.triggerTimeSeriesIndexUpdate(
        buildResult.snapshotId,
        buildResult.districtData
      )
    }

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
   * Trigger pre-computed analytics generation for a snapshot
   *
   * Requirement 1.1: Compute and store analytics summaries for each district in the snapshot
   * Requirement 1.4: Log errors and continue if individual district fails (handled by PreComputedAnalyticsService)
   *
   * @param snapshotId - The snapshot ID to compute analytics for
   */
  private async triggerPreComputedAnalytics(snapshotId: string): Promise<void> {
    if (!this.preComputedAnalyticsService) {
      return
    }

    try {
      logger.info('Triggering pre-computed analytics generation', {
        operation: 'triggerPreComputedAnalytics',
        snapshotId,
      })

      // Load the snapshot to get district data
      const snapshot = await this.snapshotStorage.getSnapshot(snapshotId)

      if (!snapshot) {
        logger.warn('Snapshot not found for pre-computed analytics', {
          operation: 'triggerPreComputedAnalytics',
          snapshotId,
        })
        return
      }

      const districtData = snapshot.payload.districts

      if (districtData.length === 0) {
        logger.warn('No district data in snapshot for pre-computed analytics', {
          operation: 'triggerPreComputedAnalytics',
          snapshotId,
        })
        return
      }

      // Compute and store analytics
      // Requirement 1.4: PreComputedAnalyticsService handles errors gracefully internally
      await this.preComputedAnalyticsService.computeAndStore(
        snapshotId,
        districtData
      )

      logger.info('Pre-computed analytics generation completed', {
        operation: 'triggerPreComputedAnalytics',
        snapshotId,
        districtCount: districtData.length,
      })
    } catch (error) {
      // Requirement 1.4: Log error and continue - don't fail the entire snapshot
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      logger.error('Pre-computed analytics generation failed', {
        operation: 'triggerPreComputedAnalytics',
        snapshotId,
        error: errorMessage,
      })

      // Don't rethrow - pre-computation failure should not fail the snapshot
    }
  }

  /**
   * Trigger time-series index update for a snapshot
   *
   * Requirement 2.2: Append analytics summary to time-series index when snapshot is created
   *
   * This method uses the original district data (with clubPerformance) to build
   * time-series data points and appends them to the time-series index.
   * Errors are logged but do not fail the snapshot creation.
   *
   * @param snapshotId - The snapshot ID to update time-series index for
   * @param districtData - The original district data with clubPerformance preserved
   */
  private async triggerTimeSeriesIndexUpdate(
    snapshotId: string,
    districtData: import('../types/districts.js').DistrictStatistics[]
  ): Promise<void> {
    if (!this.timeSeriesIndexService) {
      return
    }

    try {
      logger.info('Triggering time-series index update', {
        operation: 'triggerTimeSeriesIndexUpdate',
        snapshotId,
      })

      if (districtData.length === 0) {
        logger.warn(
          'No district data provided for time-series index update',
          {
            operation: 'triggerTimeSeriesIndexUpdate',
            snapshotId,
          }
        )
        return
      }

      // Update time-series index for each district
      let successCount = 0
      let errorCount = 0

      for (const district of districtData) {
        try {
          // Build time-series data point from district data
          const dataPoint = this.buildTimeSeriesDataPoint(snapshotId, district)

          // Append to time-series index
          await this.timeSeriesIndexService.appendDataPoint(
            district.districtId,
            dataPoint
          )

          successCount++
        } catch (error) {
          // Log error and continue with other districts
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error'

          logger.warn('Failed to update time-series index for district', {
            operation: 'triggerTimeSeriesIndexUpdate',
            snapshotId,
            districtId: district.districtId,
            error: errorMessage,
          })

          errorCount++
        }
      }

      logger.info('Time-series index update completed', {
        operation: 'triggerTimeSeriesIndexUpdate',
        snapshotId,
        totalDistricts: districtData.length,
        successCount,
        errorCount,
      })
    } catch (error) {
      // Log error and continue - don't fail the entire snapshot
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      logger.error('Time-series index update failed', {
        operation: 'triggerTimeSeriesIndexUpdate',
        snapshotId,
        error: errorMessage,
      })

      // Don't rethrow - time-series index failure should not fail the snapshot
    }
  }

  /**
   * Build a TimeSeriesDataPoint from district statistics
   *
   * This method extracts the relevant metrics from district data to create
   * a data point for the time-series index.
   *
   * @param snapshotId - The snapshot ID
   * @param district - The district statistics
   * @returns TimeSeriesDataPoint for the time-series index
   */
  private buildTimeSeriesDataPoint(
    snapshotId: string,
    district: import('../types/districts.js').DistrictStatistics
  ): TimeSeriesDataPoint {
    // Calculate total membership
    const membership = this.calculateTotalMembership(district)

    // Calculate total payments
    const payments = this.calculateTotalPayments(district)

    // Calculate total DCP goals
    const dcpGoals = this.calculateTotalDCPGoals(district)

    // Calculate club health counts
    const clubCounts = this.calculateClubHealthCounts(district)

    // Calculate distinguished club total
    const distinguishedTotal = this.calculateDistinguishedTotal(district)

    return {
      date: district.asOfDate,
      snapshotId,
      membership,
      payments,
      dcpGoals,
      distinguishedTotal,
      clubCounts,
    }
  }

  /**
   * Calculate total membership from district statistics
   */
  private calculateTotalMembership(
    district: import('../types/districts.js').DistrictStatistics
  ): number {
    // Primary: Use membership.total if available
    if (district.membership?.total !== undefined) {
      return district.membership.total
    }

    // Fallback: Sum from club performance data
    if (district.clubPerformance && district.clubPerformance.length > 0) {
      return district.clubPerformance.reduce((total, club) => {
        const membership = this.parseIntSafe(
          club['Active Members'] ??
            club['Active Membership'] ??
            club['Membership']
        )
        return total + membership
      }, 0)
    }

    return 0
  }

  /**
   * Calculate total payments from district statistics
   */
  private calculateTotalPayments(
    district: import('../types/districts.js').DistrictStatistics
  ): number {
    const clubs = district.clubPerformance ?? []

    return clubs.reduce((total, club) => {
      const octRenewals = this.parseIntSafe(
        club['Oct. Ren.'] ?? club['Oct. Ren']
      )
      const aprRenewals = this.parseIntSafe(
        club['Apr. Ren.'] ?? club['Apr. Ren']
      )
      const newMembers = this.parseIntSafe(club['New Members'] ?? club['New'])

      return total + octRenewals + aprRenewals + newMembers
    }, 0)
  }

  /**
   * Calculate total DCP goals from district statistics
   */
  private calculateTotalDCPGoals(
    district: import('../types/districts.js').DistrictStatistics
  ): number {
    const clubs = district.clubPerformance ?? []

    return clubs.reduce((total, club) => {
      const goals = this.parseIntSafe(club['Goals Met'])
      return total + goals
    }, 0)
  }

  /**
   * Calculate club health counts from district statistics
   */
  private calculateClubHealthCounts(
    district: import('../types/districts.js').DistrictStatistics
  ): TimeSeriesDataPoint['clubCounts'] {
    const clubs = district.clubPerformance ?? []
    const total = clubs.length

    let thriving = 0
    let vulnerable = 0
    let interventionRequired = 0

    for (const club of clubs) {
      const membership = this.parseIntSafe(
        club['Active Members'] ??
          club['Active Membership'] ??
          club['Membership']
      )
      const dcpGoals = this.parseIntSafe(club['Goals Met'])
      const memBase = this.parseIntSafe(club['Mem. Base'])
      const netGrowth = membership - memBase

      // Classification rules from ClubHealthAnalyticsModule
      if (membership < 12 && netGrowth < 3) {
        interventionRequired++
      } else {
        const membershipRequirementMet = membership >= 20 || netGrowth >= 3
        const dcpCheckpointMet = dcpGoals > 0

        if (membershipRequirementMet && dcpCheckpointMet) {
          thriving++
        } else {
          vulnerable++
        }
      }
    }

    return {
      total,
      thriving,
      vulnerable,
      interventionRequired,
    }
  }

  /**
   * Calculate total distinguished clubs from district statistics
   */
  private calculateDistinguishedTotal(
    district: import('../types/districts.js').DistrictStatistics
  ): number {
    const clubs = district.clubPerformance ?? []
    let total = 0

    for (const club of clubs) {
      if (this.isDistinguished(club)) {
        total++
      }
    }

    return total
  }

  /**
   * Check if a club qualifies as distinguished
   */
  private isDistinguished(
    club: import('../types/districts.js').ScrapedRecord
  ): boolean {
    // Check CSP status first
    const cspValue =
      club['CSP'] ??
      club['Club Success Plan'] ??
      club['CSP Submitted'] ??
      club['Club Success Plan Submitted']

    // Historical data compatibility: if field doesn't exist, assume submitted
    if (cspValue !== undefined && cspValue !== null) {
      const cspString = String(cspValue).toLowerCase().trim()
      if (
        cspString === 'no' ||
        cspString === 'false' ||
        cspString === '0' ||
        cspString === 'not submitted' ||
        cspString === 'n'
      ) {
        return false
      }
    }

    // Check Club Distinguished Status field
    const statusField = club['Club Distinguished Status']
    if (statusField !== null && statusField !== undefined) {
      const status = String(statusField).toLowerCase().trim()
      if (
        status !== '' &&
        status !== 'none' &&
        status !== 'n/a' &&
        (status.includes('smedley') ||
          status.includes('president') ||
          status.includes('select') ||
          status.includes('distinguished'))
      ) {
        return true
      }
    }

    // Fallback: Calculate based on DCP goals, membership, and net growth
    const dcpGoals = this.parseIntSafe(club['Goals Met'])
    const membership = this.parseIntSafe(
      club['Active Members'] ?? club['Active Membership'] ?? club['Membership']
    )
    const memBase = this.parseIntSafe(club['Mem. Base'])
    const netGrowth = membership - memBase

    // Distinguished: 5+ goals + (20 members OR net growth of 3)
    return dcpGoals >= 5 && (membership >= 20 || netGrowth >= 3)
  }

  /**
   * Parse an integer value safely, returning 0 for invalid values
   */
  private parseIntSafe(value: string | number | null | undefined): number {
    if (value === null || value === undefined || value === '') {
      return 0
    }
    if (typeof value === 'number') {
      return isNaN(value) ? 0 : Math.floor(value)
    }
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed === '') {
        return 0
      }
      const parsed = parseInt(trimmed, 10)
      return isNaN(parsed) ? 0 : parsed
    }
    return 0
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
