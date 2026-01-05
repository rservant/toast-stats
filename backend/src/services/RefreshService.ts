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
  }
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
  status: 'success' | 'failed'
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
  private readonly retryOptions = RetryManager.getDashboardRetryOptions()
  private readonly scrapingCircuitBreaker: CircuitBreaker

  constructor(
    snapshotStore: SnapshotStore,
    scraper?: ToastmastersScraper,
    validator?: DataValidator
  ) {
    this.snapshotStore = snapshotStore
    this.scraper = scraper || new ToastmastersScraper()
    this.validator = validator || new DataValidator()

    // Initialize circuit breaker for scraping operations
    this.scrapingCircuitBreaker =
      CircuitBreaker.createDashboardCircuitBreaker('refresh-scraping')

    logger.debug('RefreshService initialized with circuit breaker', {
      circuitBreakerName: this.scrapingCircuitBreaker.getName(),
      retryOptions: this.retryOptions,
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

      // Step 3: Validate normalized data
      logger.info('Starting data validation phase', {
        refreshId,
        operation: 'executeRefresh',
        phase: 'validation',
        districtCount: normalizedData.districts.length,
      })
      const validationResult = await this.validator.validate(normalizedData)

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
          normalizedData,
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
            districtCount: normalizedData.districts.length,
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
        districtCount: normalizedData.districts.length,
        warningCount: validationResult.warnings.length,
      })

      const successSnapshot = await this.createSnapshot(
        normalizedData,
        'success',
        validationResult.warnings // Include warnings but not as errors
      )

      const duration_ms = Date.now() - startTime
      const completedAt = new Date().toISOString()

      logger.info('Refresh completed successfully', {
        refreshId,
        snapshot_id: successSnapshot.snapshot_id,
        operation: 'executeRefresh',
        status: 'success',
        duration_ms,
        districtCount: normalizedData.districts.length,
        warnings: validationResult.warnings.length,
        completedAt,
        schemaVersion: successSnapshot.schema_version,
        calculationVersion: successSnapshot.calculation_version,
      })

      return {
        success: true,
        snapshot_id: successSnapshot.snapshot_id,
        duration_ms,
        errors: [],
        status: 'success',
        metadata: {
          districtCount: normalizedData.districts.length,
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

        const minimalData: NormalizedData = {
          districts: [],
          metadata: {
            source: 'toastmasters-dashboard',
            fetchedAt: new Date().toISOString(),
            dataAsOfDate: new Date().toISOString().split('T')[0],
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
   */
  private async scrapeData(): Promise<RawData> {
    const startTime = Date.now()
    const startTimeIso = new Date().toISOString()
    const errors: string[] = []

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

      // Step 2: Extract district IDs from the summary data
      const districtIds = this.extractDistrictIds(allDistricts.result)
      logger.info('Extracted district IDs', {
        count: districtIds.length,
        districtIds,
      })

      // Step 3: Fetch detailed data for each district with circuit breaker and retry
      const districtData = new Map<
        string,
        {
          districtPerformance: ScrapedRecord[]
          divisionPerformance: ScrapedRecord[]
          clubPerformance: ScrapedRecord[]
        }
      >()

      for (const districtId of districtIds) {
        try {
          logger.debug(
            'Fetching district data with circuit breaker protection',
            { districtId }
          )

          // Fetch district performance data with circuit breaker
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

          // Fetch division performance data with circuit breaker
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

          // Fetch club performance data with circuit breaker
          const clubPerformanceResult =
            await this.scrapingCircuitBreaker.execute(
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

          // Check if all operations succeeded
          if (
            !districtPerformanceResult.success ||
            !districtPerformanceResult.result
          ) {
            errors.push(
              `Failed to fetch district performance for ${districtId}: ${districtPerformanceResult.error?.message || 'Unknown error'}`
            )
            continue
          }

          if (
            !divisionPerformanceResult.success ||
            !divisionPerformanceResult.result
          ) {
            errors.push(
              `Failed to fetch division performance for ${districtId}: ${divisionPerformanceResult.error?.message || 'Unknown error'}`
            )
            continue
          }

          if (!clubPerformanceResult.success || !clubPerformanceResult.result) {
            errors.push(
              `Failed to fetch club performance for ${districtId}: ${clubPerformanceResult.error?.message || 'Unknown error'}`
            )
            continue
          }

          districtData.set(districtId, {
            districtPerformance: districtPerformanceResult.result,
            divisionPerformance: divisionPerformanceResult.result,
            clubPerformance: clubPerformanceResult.result,
          })

          logger.debug('Successfully fetched district data', {
            districtId,
            districtRecords: districtPerformanceResult.result.length,
            divisionRecords: divisionPerformanceResult.result.length,
            clubRecords: clubPerformanceResult.result.length,
            circuitBreakerState: this.scrapingCircuitBreaker.getStats().state,
          })
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error'

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
            })
          }
        }
      }

      const endTime = Date.now()
      const durationMs = endTime - startTime
      const circuitBreakerStats = this.scrapingCircuitBreaker.getStats()

      logger.info('Completed data scraping operation', {
        totalDistricts: districtIds.length,
        successfulDistricts: districtData.size,
        failedDistricts: districtIds.length - districtData.size,
        errors: errors.length,
        durationMs,
        circuitBreakerState: circuitBreakerStats.state,
        circuitBreakerFailures: circuitBreakerStats.failureCount,
      })

      // If we failed to get data for all districts, throw an error
      if (districtData.size === 0) {
        const circuitBreakerInfo =
          circuitBreakerStats.state === 'OPEN'
            ? ` Circuit breaker is open (next retry: ${circuitBreakerStats.nextRetryTime?.toISOString()}).`
            : ''
        throw new Error(
          `Failed to fetch data for any districts.${circuitBreakerInfo} Errors: ${errors.join('; ')}`
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
        },
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      const circuitBreakerStats = this.scrapingCircuitBreaker.getStats()

      logger.error('Data scraping failed', {
        error: errorMessage,
        errors,
        circuitBreakerState: circuitBreakerStats.state,
        circuitBreakerFailures: circuitBreakerStats.failureCount,
      })

      throw new Error(`Scraping failed: ${errorMessage}`)
    }
  }

  /**
   * Extract district IDs from all districts summary data
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
    logger.debug('Extracted district IDs', {
      count: result.length,
      ids: result,
    })
    return result
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
    const districtStats: DistrictStatistics = {
      districtId,
      asOfDate: new Date().toISOString().split('T')[0],
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
            return date.toISOString().split('T')[0]
          }
        }
      }
    }

    // Fallback to current date
    return new Date().toISOString().split('T')[0]
  }

  /**
   * Create a snapshot with proper versioning and error handling
   */
  private async createSnapshot(
    data: NormalizedData,
    status: SnapshotStatus,
    errors: string[] = []
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

    logger.info('Creating snapshot', {
      operation: 'createSnapshot',
      snapshot_id: snapshotId,
      status,
      schema_version: snapshot.schema_version,
      calculation_version: snapshot.calculation_version,
      district_count: data.districts.length,
      error_count: errors.length,
      created_at: createdAt,
    })

    try {
      await this.snapshotStore.writeSnapshot(snapshot)
      logger.info('Snapshot created successfully', {
        operation: 'createSnapshot',
        snapshot_id: snapshotId,
        status,
        district_count: data.districts.length,
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
  getCircuitBreakerStats() {
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
}
