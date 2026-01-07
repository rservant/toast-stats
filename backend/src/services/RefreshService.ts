/**
 * RefreshService orchestrates the complete refresh workflow
 *
 * This service coordinates scraping, normalization, validation, and snapshot creation
 * to implement the snapshot-based data architecture. It separates refresh operations
 * from read operations, ensuring consistent performance and reliability.
 */

import { logger } from '../utils/logger.js'
import { RetryManager } from '../utils/RetryManager.js'
import { CircuitBreaker, CircuitBreakerError } from '../utils/CircuitBreaker.js'
import { ToastmastersScraper } from './ToastmastersScraper.js'
import { DataValidator } from './DataValidator.js'
import { DistrictConfigurationService } from './DistrictConfigurationService.js'
import type { RankingCalculator } from './RankingCalculator.js'
import type {
  SnapshotStore,
  Snapshot,
  NormalizedData,
  SnapshotStatus,
} from '../types/snapshots.js'
import type { DistrictStatistics, ScrapedRecord } from '../types/districts.js'

/**
 * Raw data collected from scraping operations
 */
interface RawData {
  /** All districts summary data */
  allDistricts: ScrapedRecord[]
  /** District-specific performance data */
  districtData: Map<
    string,
    {
      districtPerformance: ScrapedRecord[]
      divisionPerformance: ScrapedRecord[]
      clubPerformance: ScrapedRecord[]
    }
  >
  /** Metadata about the scraping operation */
  scrapingMetadata: {
    startTime: string
    endTime: string
    durationMs: number
    districtCount: number
    errors: string[]
    /** Per-district error tracking */
    districtErrors: Map<string, DistrictError[]>
    /** Successfully processed districts */
    successfulDistricts: string[]
    /** Failed districts */
    failedDistricts: string[]
  }
}

/**
 * Error information for a specific district
 */
interface DistrictError {
  /** District ID that failed */
  districtId: string
  /** Type of operation that failed */
  operation: 'districtPerformance' | 'divisionPerformance' | 'clubPerformance'
  /** Error message */
  error: string
  /** Timestamp when error occurred */
  timestamp: string
  /** Whether this district should be retried in next refresh */
  shouldRetry: boolean
}

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
 * RefreshService orchestrates the complete refresh workflow
 */
export class RefreshService {
  private readonly scraper: ToastmastersScraper
  private readonly validator: DataValidator
  private readonly snapshotStore: SnapshotStore
  private readonly districtConfigService: DistrictConfigurationService
  private readonly rankingCalculator?: RankingCalculator
  private readonly retryOptions = RetryManager.getDashboardRetryOptions()
  private readonly scrapingCircuitBreaker: CircuitBreaker

  constructor(
    snapshotStore: SnapshotStore,
    scraper: ToastmastersScraper,
    validator?: DataValidator,
    districtConfigService?: DistrictConfigurationService,
    rankingCalculator?: RankingCalculator
  ) {
    this.snapshotStore = snapshotStore
    this.scraper = scraper
    this.validator = validator || new DataValidator()
    this.districtConfigService =
      districtConfigService || new DistrictConfigurationService()
    if (rankingCalculator !== undefined) {
      this.rankingCalculator = rankingCalculator
    }

    // Initialize circuit breaker for scraping operations
    this.scrapingCircuitBreaker =
      CircuitBreaker.createDashboardCircuitBreaker('refresh-scraping')

    logger.debug('RefreshService initialized with circuit breaker', {
      circuitBreakerName: this.scrapingCircuitBreaker.getName(),
      retryOptions: this.retryOptions,
      hasRankingCalculator: !!this.rankingCalculator,
    })
  }

  /**
   * Execute a complete refresh cycle
   * Coordinates scraping, normalization, validation, and snapshot creation
   */
  async executeRefresh(): Promise<RefreshResult> {
    const startTime = Date.now()
    const startedAt = new Date().toISOString()
    const refreshId = `refresh_${startTime}`

    logger.info('Starting refresh operation', {
      refreshId,
      startedAt,
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

        // Create failed snapshot with configuration errors
        const currentDate = new Date().toISOString()
        const dateOnly = currentDate.split('T')[0]
        if (!dateOnly) {
          throw new Error('Failed to extract date from ISO string')
        }

        const minimalData: NormalizedData = {
          districts: [],
          metadata: {
            source: 'toastmasters-dashboard',
            fetchedAt: currentDate,
            dataAsOfDate: dateOnly,
            districtCount: 0,
            processingDurationMs: Date.now() - startTime,
          },
        }

        const failedSnapshot = await this.createSnapshot(
          minimalData,
          'failed',
          [errorMessage]
        )

        const duration_ms = Date.now() - startTime
        const completedAt = new Date().toISOString()

        return {
          success: false,
          snapshot_id: failedSnapshot.snapshot_id,
          duration_ms,
          errors: [errorMessage],
          status: 'failed',
          metadata: {
            districtCount: 0,
            startedAt,
            completedAt,
            schemaVersion: this.getCurrentSchemaVersion(),
            calculationVersion: this.getCurrentCalculationVersion(),
          },
        }
      }

      logger.info('District configuration validated successfully', {
        refreshId,
        operation: 'executeRefresh',
        phase: 'configuration_validation',
        configuredDistricts: configValidationResult.configuredDistricts.length,
        validDistricts: configValidationResult.validDistricts.length,
        warnings: configValidationResult.warnings.length,
      })

      // Step 1: Scrape raw data from dashboard
      logger.info('Starting data scraping phase', {
        refreshId,
        operation: 'executeRefresh',
        phase: 'scraping',
      })
      const rawData = await this.scrapeData()

      logger.info('Data scraping completed successfully', {
        refreshId,
        operation: 'executeRefresh',
        phase: 'scraping',
        districtCount: rawData.districtData.size,
        scrapingDurationMs: rawData.scrapingMetadata.durationMs,
        errors: rawData.scrapingMetadata.errors.length,
      })

      // Step 2: Normalize raw data into structured format
      logger.info('Starting data normalization phase', {
        refreshId,
        operation: 'executeRefresh',
        phase: 'normalization',
        inputDistrictCount: rawData.districtData.size,
      })
      const normalizedData = await this.normalizeData(rawData)

      logger.info('Data normalization completed successfully', {
        refreshId,
        operation: 'executeRefresh',
        phase: 'normalization',
        outputDistrictCount: normalizedData.districts.length,
        processingDurationMs: normalizedData.metadata.processingDurationMs,
      })

      // Step 2.5: Calculate rankings (NEW STEP)
      let rankedDistricts = normalizedData.districts
      if (this.rankingCalculator) {
        logger.info('Starting ranking calculation phase', {
          refreshId,
          operation: 'executeRefresh',
          phase: 'ranking_calculation',
          districtCount: normalizedData.districts.length,
          rankingVersion: this.rankingCalculator.getRankingVersion(),
        })

        try {
          rankedDistricts = await this.rankingCalculator.calculateRankings(
            normalizedData.districts
          )

          logger.info('Ranking calculation completed successfully', {
            refreshId,
            operation: 'executeRefresh',
            phase: 'ranking_calculation',
            districtCount: rankedDistricts.length,
            rankedDistrictCount: rankedDistricts.filter(d => d.ranking).length,
            rankingVersion: this.rankingCalculator.getRankingVersion(),
          })
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error'
          logger.error(
            'Ranking calculation failed, continuing without rankings',
            {
              refreshId,
              operation: 'executeRefresh',
              phase: 'ranking_calculation',
              error: errorMessage,
              districtCount: normalizedData.districts.length,
            }
          )
          // Continue with original districts without ranking data
          // This implements the error handling requirement 5.3
        }
      } else {
        logger.debug(
          'No ranking calculator provided, skipping ranking calculation',
          {
            refreshId,
            operation: 'executeRefresh',
            phase: 'ranking_calculation',
          }
        )
      }

      // Update normalized data with ranked districts
      const finalNormalizedData: NormalizedData = {
        ...normalizedData,
        districts: rankedDistricts,
      }

      // Step 3: Validate normalized data
      logger.info('Starting data validation phase', {
        refreshId,
        operation: 'executeRefresh',
        phase: 'validation',
        districtCount: finalNormalizedData.districts.length,
      })
      const validationResult =
        await this.validator.validate(finalNormalizedData)

      logger.info('Data validation completed', {
        refreshId,
        operation: 'executeRefresh',
        phase: 'validation',
        isValid: validationResult.isValid,
        errorCount: validationResult.errors.length,
        warningCount: validationResult.warnings.length,
      })

      if (!validationResult.isValid) {
        // Create failed snapshot with validation errors
        logger.info('Creating failed snapshot due to validation errors', {
          refreshId,
          operation: 'executeRefresh',
          phase: 'snapshot_creation',
          status: 'failed',
          validationErrors: validationResult.errors,
        })

        const failedSnapshot = await this.createSnapshot(
          finalNormalizedData,
          'failed',
          validationResult.errors
        )

        const duration_ms = Date.now() - startTime
        const completedAt = new Date().toISOString()

        logger.error('Refresh failed due to validation errors', {
          refreshId,
          snapshot_id: failedSnapshot.snapshot_id,
          operation: 'executeRefresh',
          status: 'failed',
          errors: validationResult.errors,
          duration_ms,
          completedAt,
        })

        return {
          success: false,
          snapshot_id: failedSnapshot.snapshot_id,
          duration_ms,
          errors: validationResult.errors,
          status: 'failed',
          metadata: {
            districtCount: finalNormalizedData.districts.length,
            startedAt,
            completedAt,
            schemaVersion: this.getCurrentSchemaVersion(),
            calculationVersion: this.getCurrentCalculationVersion(),
          },
        }
      }

      // Step 4: Create successful snapshot
      logger.info('Creating successful snapshot', {
        refreshId,
        operation: 'executeRefresh',
        phase: 'snapshot_creation',
        status: 'success',
        districtCount: finalNormalizedData.districts.length,
        warningCount: validationResult.warnings.length,
      })

      // Determine snapshot status based on scraping results
      let snapshotStatus: SnapshotStatus = 'success'
      const allErrors: string[] = [...validationResult.warnings]

      // Check if we had any district failures during scraping
      if (rawData.scrapingMetadata.failedDistricts.length > 0) {
        snapshotStatus = 'partial'
        allErrors.push(
          `Partial snapshot: ${rawData.scrapingMetadata.failedDistricts.length} districts failed during data collection: ${rawData.scrapingMetadata.failedDistricts.join(', ')}`
        )

        logger.info('Creating partial snapshot due to district failures', {
          refreshId,
          operation: 'executeRefresh',
          phase: 'snapshot_creation',
          status: 'partial',
          successfulDistricts:
            rawData.scrapingMetadata.successfulDistricts.length,
          failedDistricts: rawData.scrapingMetadata.failedDistricts.length,
          failedDistrictIds: rawData.scrapingMetadata.failedDistricts,
        })
      }

      const successSnapshot = await this.createSnapshot(
        finalNormalizedData,
        snapshotStatus,
        allErrors,
        rawData.scrapingMetadata // Pass scraping metadata for detailed error tracking
      )

      const duration_ms = Date.now() - startTime
      const completedAt = new Date().toISOString()

      logger.info('Refresh completed successfully', {
        refreshId,
        snapshot_id: successSnapshot.snapshot_id,
        operation: 'executeRefresh',
        status: snapshotStatus,
        duration_ms,
        districtCount: finalNormalizedData.districts.length,
        warnings: validationResult.warnings.length,
        completedAt,
        schemaVersion: successSnapshot.schema_version,
        calculationVersion: successSnapshot.calculation_version,
        successfulDistricts:
          rawData.scrapingMetadata.successfulDistricts.length,
        failedDistricts: rawData.scrapingMetadata.failedDistricts.length,
      })

      return {
        success: true,
        snapshot_id: successSnapshot.snapshot_id,
        duration_ms,
        errors: allErrors,
        status: snapshotStatus,
        metadata: {
          districtCount: finalNormalizedData.districts.length,
          startedAt,
          completedAt,
          schemaVersion: this.getCurrentSchemaVersion(),
          calculationVersion: this.getCurrentCalculationVersion(),
        },
      }
    } catch (error) {
      const duration_ms = Date.now() - startTime
      const completedAt = new Date().toISOString()
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      logger.error('Refresh failed with unexpected error', {
        refreshId,
        operation: 'executeRefresh',
        error: errorMessage,
        duration_ms,
        completedAt,
      })

      // Try to create a failed snapshot with minimal data
      try {
        logger.info('Attempting to create failed snapshot with minimal data', {
          refreshId,
          operation: 'executeRefresh',
          phase: 'error_recovery',
        })

        const currentDate = new Date().toISOString()
        const dateOnly = currentDate.split('T')[0]
        if (!dateOnly) {
          throw new Error('Failed to extract date from ISO string')
        }

        const minimalData: NormalizedData = {
          districts: [],
          metadata: {
            source: 'toastmasters-dashboard',
            fetchedAt: currentDate,
            dataAsOfDate: dateOnly,
            districtCount: 0,
            processingDurationMs: duration_ms,
          },
        }

        const failedSnapshot = await this.createSnapshot(
          minimalData,
          'failed',
          [errorMessage]
        )

        logger.info(
          'Failed snapshot created successfully during error recovery',
          {
            refreshId,
            snapshot_id: failedSnapshot.snapshot_id,
            operation: 'executeRefresh',
            phase: 'error_recovery',
          }
        )

        return {
          success: false,
          snapshot_id: failedSnapshot.snapshot_id,
          duration_ms,
          errors: [errorMessage],
          status: 'failed',
          metadata: {
            districtCount: 0,
            startedAt,
            completedAt,
            schemaVersion: this.getCurrentSchemaVersion(),
            calculationVersion: this.getCurrentCalculationVersion(),
          },
        }
      } catch (snapshotError) {
        // Even snapshot creation failed
        const snapshotErrorMessage =
          snapshotError instanceof Error
            ? snapshotError.message
            : 'Unknown error'
        logger.error('Failed to create failed snapshot during error recovery', {
          refreshId,
          operation: 'executeRefresh',
          phase: 'error_recovery',
          originalError: errorMessage,
          snapshotError: snapshotErrorMessage,
        })

        return {
          success: false,
          duration_ms,
          errors: [errorMessage, 'Failed to create snapshot'],
          status: 'failed',
          metadata: {
            districtCount: 0,
            startedAt,
            completedAt,
            schemaVersion: this.getCurrentSchemaVersion(),
            calculationVersion: this.getCurrentCalculationVersion(),
          },
        }
      }
    } finally {
      // Always close the browser to free resources
      try {
        await this.scraper.closeBrowser()
        logger.debug('Browser closed successfully', {
          operation: 'executeRefresh',
          phase: 'cleanup',
        })
      } catch (error) {
        logger.warn('Failed to close browser during cleanup', {
          operation: 'executeRefresh',
          phase: 'cleanup',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }
  }

  /**
   * Scrape raw data from Toastmasters dashboard
   * Integrates with existing ToastmastersScraper with retry logic and circuit breaker
   * Only processes configured districts instead of all districts
   * Implements resilient processing with detailed error tracking per district
   */
  private async scrapeData(): Promise<RawData> {
    const startTime = Date.now()
    const startTimeIso = new Date().toISOString()
    const errors: string[] = []
    const districtErrors = new Map<string, DistrictError[]>()
    const successfulDistricts: string[] = []
    const failedDistricts: string[] = []

    logger.info(
      'Starting data scraping operation with circuit breaker protection'
    )

    try {
      // Step 1: Get all districts summary data with circuit breaker and retry
      const allDistricts = await this.scrapingCircuitBreaker.execute(
        async () => {
          const retryResult = await RetryManager.executeWithRetry(
            () => this.scraper.getAllDistricts(),
            this.retryOptions,
            { operation: 'getAllDistricts' }
          )

          // If retry failed, throw the error so circuit breaker can record it
          if (!retryResult.success) {
            throw retryResult.error || new Error('Retry operation failed')
          }

          return retryResult
        },
        { operation: 'getAllDistricts' }
      )

      if (!allDistricts.success || !allDistricts.result) {
        throw new Error(
          `Failed to fetch all districts: ${allDistricts.error?.message || 'Unknown error'}`
        )
      }

      logger.info('Fetched all districts summary', {
        count: allDistricts.result.length,
        attempts: allDistricts.attempts,
        circuitBreakerState: this.scrapingCircuitBreaker.getStats().state,
      })

      // Step 2: Get configured district IDs instead of extracting all
      const districtIds = await this.getConfiguredDistrictIds(
        allDistricts.result
      )
      logger.info('Using configured district IDs', {
        count: districtIds.length,
        districtIds,
      })

      // Step 3: Check for previously failed districts that should be retried
      const previouslyFailedDistricts =
        await this.getPreviouslyFailedDistricts()
      const districtsToRetry = previouslyFailedDistricts.filter(
        d => districtIds.includes(d.districtId) && d.shouldRetry
      )

      if (districtsToRetry.length > 0) {
        logger.info('Retrying previously failed districts', {
          retryCount: districtsToRetry.length,
          retryDistricts: districtsToRetry.map(d => d.districtId),
        })
      }

      // Step 4: Fetch detailed data for each configured district with circuit breaker and retry
      const districtData = new Map<
        string,
        {
          districtPerformance: ScrapedRecord[]
          divisionPerformance: ScrapedRecord[]
          clubPerformance: ScrapedRecord[]
        }
      >()

      for (const districtId of districtIds) {
        const districtStartTime = Date.now()
        logger.debug('Processing district with resilient error handling', {
          districtId,
          isRetry: districtsToRetry.some(d => d.districtId === districtId),
        })

        try {
          // Attempt to fetch all three data types for this district
          const districtResults =
            await this.fetchDistrictDataResilient(districtId)

          if (districtResults.success) {
            districtData.set(districtId, {
              districtPerformance: districtResults.districtPerformance,
              divisionPerformance: districtResults.divisionPerformance,
              clubPerformance: districtResults.clubPerformance,
            })

            successfulDistricts.push(districtId)

            logger.debug('Successfully fetched district data', {
              districtId,
              districtRecords: districtResults.districtPerformance.length,
              divisionRecords: districtResults.divisionPerformance.length,
              clubRecords: districtResults.clubPerformance.length,
              processingTimeMs: Date.now() - districtStartTime,
              circuitBreakerState: this.scrapingCircuitBreaker.getStats().state,
            })
          } else {
            // District failed - record detailed errors
            failedDistricts.push(districtId)
            districtErrors.set(districtId, districtResults.errors)

            // Add summary error message
            const errorSummary = `District ${districtId} failed: ${districtResults.errors.map(e => e.operation + ' - ' + e.error).join('; ')}`
            errors.push(errorSummary)

            logger.warn('Failed to fetch district data', {
              districtId,
              errorCount: districtResults.errors.length,
              errors: districtResults.errors,
              processingTimeMs: Date.now() - districtStartTime,
            })
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error'

          // Record district-level error
          failedDistricts.push(districtId)
          const districtError: DistrictError = {
            districtId,
            operation: 'districtPerformance', // Default to first operation
            error: errorMessage,
            timestamp: new Date().toISOString(),
            shouldRetry: !(error instanceof CircuitBreakerError), // Don't retry circuit breaker errors immediately
          }
          districtErrors.set(districtId, [districtError])

          // Check if this is a circuit breaker error
          if (error instanceof CircuitBreakerError) {
            errors.push(
              `Circuit breaker is open for district ${districtId}: ${errorMessage}`
            )
            logger.warn('Circuit breaker prevented scraping attempt', {
              districtId,
              error: errorMessage,
              circuitBreakerStats: this.scrapingCircuitBreaker.getStats(),
            })

            // When circuit breaker is open, we should fail fast for remaining districts
            // to avoid wasting time on operations that will likely fail
            logger.info(
              'Circuit breaker is open, stopping district processing early',
              {
                processedDistricts: districtData.size,
                remainingDistricts:
                  districtIds.length -
                  Array.from(districtData.keys()).length -
                  1,
                circuitBreakerStats: this.scrapingCircuitBreaker.getStats(),
              }
            )
            break
          } else {
            errors.push(
              `Failed to fetch data for district ${districtId}: ${errorMessage}`
            )
            logger.warn('Failed to fetch district data', {
              districtId,
              error: errorMessage,
              processingTimeMs: Date.now() - districtStartTime,
            })
          }
        }
      }

      const endTime = Date.now()
      const durationMs = endTime - startTime
      const circuitBreakerStats = this.scrapingCircuitBreaker.getStats()

      logger.info(
        'Completed data scraping operation with resilient processing',
        {
          totalDistricts: districtIds.length,
          successfulDistricts: successfulDistricts.length,
          failedDistricts: failedDistricts.length,
          errors: errors.length,
          durationMs,
          circuitBreakerState: circuitBreakerStats.state,
          circuitBreakerFailures: circuitBreakerStats.failureCount,
          successfulDistrictIds: successfulDistricts,
          failedDistrictIds: failedDistricts,
        }
      )

      // Create partial snapshot if we have some successful districts
      // Don't fail completely unless we have zero successful districts
      if (successfulDistricts.length === 0) {
        const circuitBreakerInfo =
          circuitBreakerStats.state === 'OPEN'
            ? ` Circuit breaker is open (next retry: ${circuitBreakerStats.nextRetryTime?.toISOString()}).`
            : ''
        throw new Error(
          `Failed to fetch data for any configured districts.${circuitBreakerInfo} Errors: ${errors.join('; ')}`
        )
      }

      return {
        allDistricts: allDistricts.result,
        districtData,
        scrapingMetadata: {
          startTime: startTimeIso,
          endTime: new Date().toISOString(),
          durationMs,
          districtCount: districtData.size,
          errors,
          districtErrors,
          successfulDistricts,
          failedDistricts,
        },
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      const circuitBreakerStats = this.scrapingCircuitBreaker.getStats()

      logger.error('Data scraping failed', {
        error: errorMessage,
        errors,
        successfulDistricts: successfulDistricts.length,
        failedDistricts: failedDistricts.length,
        circuitBreakerState: circuitBreakerStats.state,
        circuitBreakerFailures: circuitBreakerStats.failureCount,
      })

      throw new Error(`Scraping failed: ${errorMessage}`)
    }
  }

  /**
   * Get configured district IDs and validate them against all districts data
   * This replaces the old extractDistrictIds method to use configured districts instead of all districts
   */
  private async getConfiguredDistrictIds(
    allDistricts: ScrapedRecord[]
  ): Promise<string[]> {
    // Get configured districts from the configuration service
    const configuredDistricts =
      await this.districtConfigService.getConfiguredDistricts()

    if (configuredDistricts.length === 0) {
      throw new Error(
        'No districts configured for data collection. Please configure at least one district.'
      )
    }

    // Extract all available district IDs from the summary data for validation
    const availableDistrictIds = this.extractDistrictIds(allDistricts)

    // Validate configured districts against available districts
    const validDistricts: string[] = []
    const invalidDistricts: string[] = []

    for (const districtId of configuredDistricts) {
      if (availableDistrictIds.includes(districtId)) {
        validDistricts.push(districtId)
      } else {
        invalidDistricts.push(districtId)
        logger.warn('Configured district not found in all-districts summary', {
          districtId,
          availableDistricts: availableDistrictIds,
        })
      }
    }

    if (invalidDistricts.length > 0) {
      logger.warn(
        'Some configured districts were not found in the Toastmasters system',
        {
          invalidDistricts,
          validDistricts,
          totalConfigured: configuredDistricts.length,
        }
      )
    }

    if (validDistricts.length === 0) {
      throw new Error(
        `None of the configured districts were found in the Toastmasters system. Configured: [${configuredDistricts.join(', ')}], Available: [${availableDistrictIds.join(', ')}]`
      )
    }

    logger.info('Using configured districts for data collection', {
      configuredCount: configuredDistricts.length,
      validCount: validDistricts.length,
      invalidCount: invalidDistricts.length,
      validDistricts,
      invalidDistricts,
    })

    return validDistricts
  }

  /**
   * Extract district IDs from all districts summary data
   * This method is now used internally for validation purposes
   */
  private extractDistrictIds(allDistricts: ScrapedRecord[]): string[] {
    const districtIds = new Set<string>()

    for (const record of allDistricts) {
      // Try different possible field names for district ID
      const possibleFields = [
        'DISTRICT',
        'District',
        'district',
        'District ID',
        'DistrictId',
      ]

      for (const field of possibleFields) {
        const value = record[field]
        if (value && typeof value === 'string' && value.trim()) {
          // Clean up the district ID (remove "District " prefix if present)
          const cleanId = value.replace(/^District\s+/i, '').trim()
          if (cleanId) {
            districtIds.add(cleanId)
            break
          }
        }
      }
    }

    const result = Array.from(districtIds).sort()
    logger.debug('Extracted district IDs from all-districts summary', {
      count: result.length,
      ids: result,
    })
    return result
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
   * Normalize raw scraping data into structured NormalizedData format
   */
  private async normalizeData(rawData: RawData): Promise<NormalizedData> {
    const startTime = Date.now()
    logger.info('Starting data normalization', {
      districtCount: rawData.districtData.size,
    })

    try {
      const districts: DistrictStatistics[] = []

      // Process each district's data
      for (const [districtId, data] of Array.from(
        rawData.districtData.entries()
      )) {
        try {
          const districtStats = await this.normalizeDistrictData(
            districtId,
            data
          )
          districts.push(districtStats)
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error'
          logger.warn('Failed to normalize district data', {
            districtId,
            error: errorMessage,
          })
          // Continue with other districts rather than failing completely
        }
      }

      if (districts.length === 0) {
        throw new Error('No districts were successfully normalized')
      }

      const processingDurationMs = Date.now() - startTime

      const normalizedData: NormalizedData = {
        districts,
        metadata: {
          source: 'toastmasters-dashboard',
          fetchedAt: rawData.scrapingMetadata.startTime,
          dataAsOfDate: this.extractDataAsOfDate(rawData.allDistricts),
          districtCount: districts.length,
          processingDurationMs,
        },
      }

      logger.info('Completed data normalization', {
        inputDistricts: rawData.districtData.size,
        outputDistricts: districts.length,
        processingDurationMs,
      })

      return normalizedData
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Data normalization failed', { error: errorMessage })
      throw new Error(`Normalization failed: ${errorMessage}`)
    }
  }

  /**
   * Normalize data for a single district
   */
  private async normalizeDistrictData(
    districtId: string,
    data: {
      districtPerformance: ScrapedRecord[]
      divisionPerformance: ScrapedRecord[]
      clubPerformance: ScrapedRecord[]
    }
  ): Promise<DistrictStatistics> {
    // This is a simplified normalization - in a real implementation,
    // this would contain complex logic to transform the raw CSV data
    // into the structured DistrictStatistics format

    // For now, create a basic structure with the raw data preserved
    const currentDate = new Date().toISOString()
    const dateOnly = currentDate.split('T')[0]
    if (!dateOnly) {
      throw new Error('Failed to extract date from ISO string')
    }

    const districtStats: DistrictStatistics = {
      districtId,
      asOfDate: dateOnly,
      membership: {
        total: this.extractMembershipTotal(data.clubPerformance),
        change: 0,
        changePercent: 0,
        byClub: this.extractClubMembership(data.clubPerformance),
      },
      clubs: {
        total: data.clubPerformance.length,
        active: this.countActiveClubs(data.clubPerformance),
        suspended: 0,
        ineligible: 0,
        low: 0,
        distinguished: this.countDistinguishedClubs(data.clubPerformance),
      },
      education: {
        totalAwards: 0,
        byType: [],
        topClubs: [],
      },
      // Preserve raw data for caching purposes
      districtPerformance: data.districtPerformance,
      divisionPerformance: data.divisionPerformance,
      clubPerformance: data.clubPerformance,
    }

    return districtStats
  }

  /**
   * Extract total membership from club performance data
   */
  private extractMembershipTotal(clubPerformance: ScrapedRecord[]): number {
    let total = 0
    for (const club of clubPerformance) {
      const members =
        club['Active Members'] || club['Membership'] || club['Members']
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
   * Extract club membership data
   */
  private extractClubMembership(clubPerformance: ScrapedRecord[]): Array<{
    clubId: string
    clubName: string
    memberCount: number
  }> {
    return clubPerformance
      .map(club => ({
        clubId: String(club['Club Number'] || club['ClubId'] || ''),
        clubName: String(club['Club Name'] || club['ClubName'] || ''),
        memberCount: this.parseNumber(
          club['Active Members'] || club['Membership'] || club['Members'] || 0
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
        club['Club Distinguished Status'] || club['Distinguished']
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
      const parsed = parseInt(value, 10)
      return isNaN(parsed) ? 0 : parsed
    }
    return 0
  }

  /**
   * Extract the data as-of date from all districts data
   */
  private extractDataAsOfDate(allDistricts: ScrapedRecord[]): string {
    // Try to find a date field in the data
    for (const record of allDistricts) {
      for (const [key, value] of Object.entries(record)) {
        if (key.toLowerCase().includes('date') && typeof value === 'string') {
          // Try to parse as date
          const date = new Date(value)
          if (!isNaN(date.getTime())) {
            const dateOnly = date.toISOString().split('T')[0]
            if (!dateOnly) {
              throw new Error('Failed to extract date from ISO string')
            }
            return dateOnly
          }
        }
      }
    }

    // Fallback to current date
    const currentDate = new Date().toISOString()
    const dateOnly = currentDate.split('T')[0]
    if (!dateOnly) {
      throw new Error('Failed to extract date from ISO string')
    }
    return dateOnly
  }

  /**
   * Create a snapshot with proper versioning and error handling
   * Supports detailed error tracking per district for resilient processing
   */
  private async createSnapshot(
    data: NormalizedData,
    status: SnapshotStatus,
    errors: string[] = [],
    scrapingMetadata?: RawData['scrapingMetadata']
  ): Promise<Snapshot> {
    const snapshotId = Date.now().toString()
    const createdAt = new Date().toISOString()

    const snapshot: Snapshot = {
      snapshot_id: snapshotId,
      created_at: createdAt,
      schema_version: this.getCurrentSchemaVersion(),
      calculation_version: this.getCurrentCalculationVersion(),
      status,
      errors,
      payload: data,
    }

    // Add detailed error tracking to snapshot metadata if available
    if (scrapingMetadata && 'districtErrors' in scrapingMetadata) {
      // Store district-level error information in the snapshot for future retry logic
      const detailedErrors = Array.from(
        scrapingMetadata.districtErrors.entries()
      ).flatMap(([districtId, districtErrors]) =>
        districtErrors.map(
          error => `${districtId}: ${error.operation} - ${error.error}`
        )
      )

      snapshot.errors = [...errors, ...detailedErrors]
    }

    logger.info('Creating snapshot with resilient error tracking', {
      operation: 'createSnapshot',
      snapshot_id: snapshotId,
      status,
      schema_version: snapshot.schema_version,
      calculation_version: snapshot.calculation_version,
      district_count: data.districts.length,
      error_count: snapshot.errors.length,
      created_at: createdAt,
      successful_districts: scrapingMetadata?.successfulDistricts?.length || 0,
      failed_districts: scrapingMetadata?.failedDistricts?.length || 0,
    })

    try {
      await this.snapshotStore.writeSnapshot(snapshot)
      logger.info('Snapshot created successfully with error tracking', {
        operation: 'createSnapshot',
        snapshot_id: snapshotId,
        status,
        district_count: data.districts.length,
        successful_districts:
          scrapingMetadata?.successfulDistricts?.length || 0,
        failed_districts: scrapingMetadata?.failedDistricts?.length || 0,
      })
      return snapshot
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to write snapshot', {
        operation: 'createSnapshot',
        snapshot_id: snapshotId,
        status,
        error: errorMessage,
      })
      throw new Error(`Failed to create snapshot: ${errorMessage}`)
    }
  }

  /**
   * Get current schema version
   */
  private getCurrentSchemaVersion(): string {
    // Import the constant at runtime to avoid circular dependencies
    return '1.0.0' // This should match CURRENT_SCHEMA_VERSION
  }

  /**
   * Get current calculation version
   */
  private getCurrentCalculationVersion(): string {
    // Import the constant at runtime to avoid circular dependencies
    return '1.0.0' // This should match CURRENT_CALCULATION_VERSION
  }

  /**
   * Get circuit breaker statistics for monitoring and debugging
   */
  getCircuitBreakerStats(): { scraping: unknown } {
    return {
      scraping: this.scrapingCircuitBreaker.getStats(),
    }
  }

  /**
   * Reset circuit breaker to allow immediate retry attempts
   * Useful for manual recovery after resolving external issues
   */
  resetCircuitBreaker(): void {
    logger.info('Manually resetting scraping circuit breaker')
    this.scrapingCircuitBreaker.reset()
  }

  /**
   * Fetch all data types for a single district with resilient error handling
   * Returns success/failure status with detailed error information per operation
   */
  private async fetchDistrictDataResilient(districtId: string): Promise<{
    success: boolean
    districtPerformance: ScrapedRecord[]
    divisionPerformance: ScrapedRecord[]
    clubPerformance: ScrapedRecord[]
    errors: DistrictError[]
  }> {
    const errors: DistrictError[] = []
    let districtPerformance: ScrapedRecord[] = []
    let divisionPerformance: ScrapedRecord[] = []
    let clubPerformance: ScrapedRecord[] = []

    // Attempt to fetch district performance data
    try {
      const districtPerformanceResult =
        await this.scrapingCircuitBreaker.execute(
          async () => {
            const retryResult = await RetryManager.executeWithRetry(
              () => this.scraper.getDistrictPerformance(districtId),
              this.retryOptions,
              { operation: 'getDistrictPerformance', districtId }
            )

            if (!retryResult.success) {
              throw retryResult.error || new Error('Retry operation failed')
            }

            return retryResult
          },
          { operation: 'getDistrictPerformance', districtId }
        )

      if (
        districtPerformanceResult.success &&
        districtPerformanceResult.result
      ) {
        districtPerformance = districtPerformanceResult.result
      } else {
        errors.push({
          districtId,
          operation: 'districtPerformance',
          error: districtPerformanceResult.error?.message || 'Unknown error',
          timestamp: new Date().toISOString(),
          shouldRetry: true,
        })
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      errors.push({
        districtId,
        operation: 'districtPerformance',
        error: errorMessage,
        timestamp: new Date().toISOString(),
        shouldRetry: !(error instanceof CircuitBreakerError),
      })
    }

    // Attempt to fetch division performance data
    try {
      const divisionPerformanceResult =
        await this.scrapingCircuitBreaker.execute(
          async () => {
            const retryResult = await RetryManager.executeWithRetry(
              () => this.scraper.getDivisionPerformance(districtId),
              this.retryOptions,
              { operation: 'getDivisionPerformance', districtId }
            )

            if (!retryResult.success) {
              throw retryResult.error || new Error('Retry operation failed')
            }

            return retryResult
          },
          { operation: 'getDivisionPerformance', districtId }
        )

      if (
        divisionPerformanceResult.success &&
        divisionPerformanceResult.result
      ) {
        divisionPerformance = divisionPerformanceResult.result
      } else {
        errors.push({
          districtId,
          operation: 'divisionPerformance',
          error: divisionPerformanceResult.error?.message || 'Unknown error',
          timestamp: new Date().toISOString(),
          shouldRetry: true,
        })
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      errors.push({
        districtId,
        operation: 'divisionPerformance',
        error: errorMessage,
        timestamp: new Date().toISOString(),
        shouldRetry: !(error instanceof CircuitBreakerError),
      })
    }

    // Attempt to fetch club performance data
    try {
      const clubPerformanceResult = await this.scrapingCircuitBreaker.execute(
        async () => {
          const retryResult = await RetryManager.executeWithRetry(
            () => this.scraper.getClubPerformance(districtId),
            this.retryOptions,
            { operation: 'getClubPerformance', districtId }
          )

          if (!retryResult.success) {
            throw retryResult.error || new Error('Retry operation failed')
          }

          return retryResult
        },
        { operation: 'getClubPerformance', districtId }
      )

      if (clubPerformanceResult.success && clubPerformanceResult.result) {
        clubPerformance = clubPerformanceResult.result
      } else {
        errors.push({
          districtId,
          operation: 'clubPerformance',
          error: clubPerformanceResult.error?.message || 'Unknown error',
          timestamp: new Date().toISOString(),
          shouldRetry: true,
        })
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      errors.push({
        districtId,
        operation: 'clubPerformance',
        error: errorMessage,
        timestamp: new Date().toISOString(),
        shouldRetry: !(error instanceof CircuitBreakerError),
      })
    }

    // Consider district successful if we got at least one data type
    // This allows partial data collection for districts with some failing endpoints
    const success =
      districtPerformance.length > 0 ||
      divisionPerformance.length > 0 ||
      clubPerformance.length > 0

    return {
      success,
      districtPerformance,
      divisionPerformance,
      clubPerformance,
      errors,
    }
  }

  /**
   * Get previously failed districts from the latest snapshot for retry logic
   */
  private async getPreviouslyFailedDistricts(): Promise<DistrictError[]> {
    try {
      const latestSnapshot = await this.snapshotStore.getLatest()
      if (!latestSnapshot) {
        return []
      }

      // Check if this is a per-district snapshot store with metadata
      if ('getSnapshotMetadata' in this.snapshotStore) {
        const perDistrictStore = this.snapshotStore as {
          getSnapshotMetadata: (id: string) => Promise<{
            failedDistricts?: string[]
            createdAt?: string
          } | null>
        }
        const metadata = await perDistrictStore.getSnapshotMetadata(
          latestSnapshot.snapshot_id
        )

        if (
          metadata &&
          metadata.failedDistricts &&
          Array.isArray(metadata.failedDistricts) &&
          metadata.failedDistricts.length > 0
        ) {
          // Create retry entries for previously failed districts
          return metadata.failedDistricts.map((districtId: string) => ({
            districtId,
            operation: 'districtPerformance' as const,
            error: 'Previously failed district',
            timestamp: metadata.createdAt || new Date().toISOString(),
            shouldRetry: true,
          }))
        }
      }

      return []
    } catch (error) {
      logger.warn('Failed to get previously failed districts for retry', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      return []
    }
  }
}
