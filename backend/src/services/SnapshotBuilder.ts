/**
 * SnapshotBuilder Service
 *
 * Creates snapshots exclusively from cached CSV data without performing any scraping.
 * This service is part of the scraper-cli separation architecture where:
 * - Scraper CLI: Handles data collection and caching
 * - SnapshotBuilder: Creates snapshots from cached data
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.7, 6.3, 6.4
 */

import * as crypto from 'crypto'
import { logger } from '../utils/logger.js'
import { DataValidator } from './DataValidator.js'
import { ClosingPeriodDetector } from './ClosingPeriodDetector.js'
import {
  DataNormalizer,
  type RawData,
  type RawDistrictData,
} from './DataNormalizer.js'
import type { RankingCalculator } from './RankingCalculator.js'
import type {
  IRawCSVStorage,
  ISnapshotStorage,
} from '../types/storageInterfaces.js'
import type { DistrictConfigurationService } from './DistrictConfigurationService.js'
import type { FileSnapshotStore } from './SnapshotStore.js'
import type {
  Snapshot,
  NormalizedData,
  SnapshotStatus,
  AllDistrictsRankingsData,
} from '../types/snapshots.js'
import type { ScrapedRecord } from '../types/districts.js'
import { CSVType, type RawCSVCacheMetadata } from '../types/rawCSVCache.js'
import { parse } from 'csv-parse/sync'

/**
 * Configuration for SnapshotBuilder
 */
export interface SnapshotBuilderConfig {
  /** Base cache directory path */
  cacheDir: string
  /** Snapshot storage directory path */
  snapshotDir: string
}

/**
 * Options for building snapshots
 */
export interface BuildOptions {
  /** Target date for snapshot (YYYY-MM-DD format), defaults to current date */
  date?: string
}

/**
 * Result of a build operation
 */
export interface BuildResult {
  /** Whether the build was successful */
  success: boolean
  /** ID of the created snapshot (if any) */
  snapshotId?: string
  /** Target date for the snapshot */
  date: string
  /** Districts included in the snapshot */
  districtsIncluded: string[]
  /** Districts missing from cache */
  districtsMissing: string[]
  /** Overall status of the build */
  status: 'success' | 'partial' | 'failed'
  /** Error messages encountered */
  errors: string[]
  /** Duration of the build operation in milliseconds */
  duration_ms: number
}

/**
 * Cache availability information
 */
export interface CacheAvailability {
  /** Target date checked */
  date: string
  /** Whether any cache data is available */
  available: boolean
  /** Districts with cached data */
  cachedDistricts: string[]
  /** All configured districts */
  configuredDistricts: string[]
  /** Districts missing from cache */
  missingDistricts: string[]
}

/**
 * Result of checksum validation for a single file
 */
export interface ChecksumValidationResult {
  /** Whether the checksum is valid */
  isValid: boolean
  /** The filename that was validated */
  filename: string
  /** Expected checksum from metadata */
  expectedChecksum?: string
  /** Actual checksum calculated from content */
  actualChecksum?: string
  /** Error message if validation failed */
  error?: string
}

/**
 * Logger interface for dependency injection
 */
export interface ILogger {
  info(message: string, data?: unknown): void
  warn(message: string, data?: unknown): void
  error(message: string, error?: Error | unknown): void
  debug(message: string, data?: unknown): void
}

/**
 * SnapshotBuilder creates snapshots from cached CSV data
 *
 * This service reads CSV data from the Raw CSV Cache and creates snapshots
 * without performing any network requests or browser automation.
 *
 * Requirements:
 * - 3.1: Provide SnapshotBuilder service that creates snapshots from cache
 * - 3.2: Read CSV data from cache without scraping
 * - 3.3: Normalize, validate, and calculate rankings from cached data
 * - 3.4: Support building snapshots for specific dates
 * - 3.5: Create partial snapshots when some districts are missing
 * - 3.7: Preserve closing period metadata from cache
 * - 6.3: Validate cache data integrity before processing
 * - 6.4: Skip corrupted files with appropriate error logging
 *
 * Storage Abstraction (Requirements 1.3, 1.4):
 * - Uses ISnapshotStorage interface for snapshot persistence
 * - Uses IRawCSVStorage interface for raw CSV cache operations
 * - Supports both local filesystem and cloud storage backends
 */
export class SnapshotBuilder {
  private readonly rawCSVCache: IRawCSVStorage
  private readonly districtConfigService: DistrictConfigurationService
  private readonly snapshotStorage: ISnapshotStorage
  private readonly validator: DataValidator
  private readonly closingPeriodDetector: ClosingPeriodDetector
  private readonly dataNormalizer: DataNormalizer
  private readonly rankingCalculator?: RankingCalculator
  private readonly log: ILogger

  /**
   * Create a new SnapshotBuilder instance
   *
   * @param rawCSVCache - Storage interface for raw CSV data (IRawCSVStorage)
   *                      Supports both local filesystem and cloud storage backends
   * @param districtConfigService - District configuration service
   * @param snapshotStorage - Storage interface for snapshot operations (ISnapshotStorage or FileSnapshotStore)
   *                          Supports both local filesystem and cloud storage backends
   * @param validator - Optional data validator
   * @param rankingCalculator - Optional ranking calculator for BordaCount rankings
   * @param closingPeriodDetector - Optional closing period detector
   * @param dataNormalizer - Optional data normalizer
   * @param customLogger - Optional custom logger
   */
  constructor(
    rawCSVCache: IRawCSVStorage,
    districtConfigService: DistrictConfigurationService,
    snapshotStorage: ISnapshotStorage | FileSnapshotStore,
    validator?: DataValidator,
    rankingCalculator?: RankingCalculator,
    closingPeriodDetector?: ClosingPeriodDetector,
    dataNormalizer?: DataNormalizer,
    customLogger?: ILogger
  ) {
    this.rawCSVCache = rawCSVCache
    this.districtConfigService = districtConfigService
    // ISnapshotStorage is a superset of FileSnapshotStore's writeSnapshot method
    // so we can safely cast for backward compatibility
    this.snapshotStorage = snapshotStorage as ISnapshotStorage
    this.validator = validator ?? new DataValidator()
    this.log = customLogger ?? logger

    // Initialize ClosingPeriodDetector
    this.closingPeriodDetector =
      closingPeriodDetector ?? new ClosingPeriodDetector({ logger: this.log })

    // Initialize DataNormalizer with ClosingPeriodDetector
    this.dataNormalizer =
      dataNormalizer ??
      new DataNormalizer({
        logger: this.log,
        closingPeriodDetector: this.closingPeriodDetector,
      })

    if (rankingCalculator !== undefined) {
      this.rankingCalculator = rankingCalculator
    }

    this.log.info('SnapshotBuilder initialized', {
      hasRankingCalculator: !!this.rankingCalculator,
    })
  }

  /**
   * Build a snapshot from cached CSV data
   *
   * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.7
   *
   * @param options - Build options including target date
   * @returns Build result with snapshot ID and status
   */
  async build(options: BuildOptions = {}): Promise<BuildResult> {
    const startTime = Date.now()
    const targetDate = options.date ?? this.getCurrentDateString()
    const buildId = `build_${startTime}`

    this.log.info('Starting snapshot build from cache', {
      buildId,
      targetDate,
    })

    try {
      // Step 1: Check cache availability
      const availability = await this.getCacheAvailability(targetDate)

      if (!availability.available) {
        const errorMessage = `No cached data available for date ${targetDate}`
        this.log.error('Build failed: no cache data', {
          buildId,
          targetDate,
          configuredDistricts: availability.configuredDistricts,
        })

        return {
          success: false,
          date: targetDate,
          districtsIncluded: [],
          districtsMissing: availability.configuredDistricts,
          status: 'failed',
          errors: [errorMessage],
          duration_ms: Date.now() - startTime,
        }
      }

      // Step 2: Read cached data and build RawData structure
      const rawData = await this.readCachedData(targetDate, availability)

      // Step 3: Normalize data
      this.log.info('Normalizing cached data', {
        buildId,
        districtCount: rawData.districtData.size,
      })

      const normalizationResult = await this.dataNormalizer.normalize(rawData)
      const normalizedData = normalizationResult.normalizedData

      // Step 4: Calculate rankings if calculator is available
      let allDistrictsRankings: AllDistrictsRankingsData | undefined
      if (this.rankingCalculator && rawData.allDistricts.length > 0) {
        this.log.info('Calculating all-districts rankings', {
          buildId,
          districtCount: rawData.allDistricts.length,
        })

        try {
          allDistrictsRankings = await this.calculateAllDistrictsRankings(
            rawData.allDistricts,
            rawData.allDistrictsMetadata
          )
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error'
          this.log.error('Rankings calculation failed', {
            buildId,
            error: errorMessage,
          })
          // Continue without rankings - don't fail the entire build
        }
      }

      // Step 5: Validate normalized data
      this.log.info('Validating normalized data', {
        buildId,
        districtCount: normalizedData.districts.length,
      })

      const validationResult = await this.validator.validate(normalizedData)

      if (!validationResult.isValid) {
        this.log.error('Validation failed', {
          buildId,
          errors: validationResult.errors,
        })

        // Create failed snapshot
        const failedSnapshot = await this.createSnapshot(
          normalizedData,
          'failed',
          validationResult.errors,
          rawData,
          allDistrictsRankings
        )

        return {
          success: false,
          snapshotId: failedSnapshot.snapshot_id,
          date: targetDate,
          districtsIncluded: availability.cachedDistricts,
          districtsMissing: availability.missingDistricts,
          status: 'failed',
          errors: validationResult.errors,
          duration_ms: Date.now() - startTime,
        }
      }

      // Step 6: Determine snapshot status (success or partial)
      let snapshotStatus: SnapshotStatus = 'success'
      const allErrors: string[] = [...validationResult.warnings]

      if (availability.missingDistricts.length > 0) {
        snapshotStatus = 'partial'
        allErrors.push(
          `Partial snapshot: ${availability.missingDistricts.length} districts missing from cache: ${availability.missingDistricts.join(', ')}`
        )

        this.log.info('Creating partial snapshot due to missing districts', {
          buildId,
          cachedDistricts: availability.cachedDistricts.length,
          missingDistricts: availability.missingDistricts.length,
        })
      }

      // Step 7: Create snapshot
      const snapshot = await this.createSnapshot(
        normalizedData,
        snapshotStatus,
        allErrors,
        rawData,
        allDistrictsRankings
      )

      this.log.info('Snapshot build completed successfully', {
        buildId,
        snapshotId: snapshot.snapshot_id,
        status: snapshotStatus,
        districtsIncluded: availability.cachedDistricts.length,
        districtsMissing: availability.missingDistricts.length,
        duration_ms: Date.now() - startTime,
      })

      return {
        success: true,
        snapshotId: snapshot.snapshot_id,
        date: targetDate,
        districtsIncluded: availability.cachedDistricts,
        districtsMissing: availability.missingDistricts,
        status: snapshotStatus,
        errors: allErrors,
        duration_ms: Date.now() - startTime,
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      this.log.error('Snapshot build failed with unexpected error', {
        buildId,
        targetDate,
        error: errorMessage,
      })

      return {
        success: false,
        date: targetDate,
        districtsIncluded: [],
        districtsMissing: [],
        status: 'failed',
        errors: [errorMessage],
        duration_ms: Date.now() - startTime,
      }
    }
  }

  /**
   * Check cache availability for a specific date
   *
   * Requirements: 3.2, 3.5
   *
   * @param date - Target date (YYYY-MM-DD format)
   * @returns Cache availability information
   */
  async getCacheAvailability(date: string): Promise<CacheAvailability> {
    const configuredDistricts =
      await this.districtConfigService.getConfiguredDistricts()
    const cachedDistricts: string[] = []
    const missingDistricts: string[] = []

    // Check all-districts cache
    const hasAllDistricts = await this.rawCSVCache.hasCachedCSV(
      date,
      CSVType.ALL_DISTRICTS
    )

    // Check each configured district
    for (const districtId of configuredDistricts) {
      const hasDistrictData = await this.rawCSVCache.hasCachedCSV(
        date,
        CSVType.CLUB_PERFORMANCE,
        districtId
      )

      if (hasDistrictData) {
        cachedDistricts.push(districtId)
      } else {
        missingDistricts.push(districtId)
      }
    }

    // Cache is available if we have all-districts data OR at least one district
    const available = hasAllDistricts || cachedDistricts.length > 0

    this.log.debug('Cache availability checked', {
      date,
      hasAllDistricts,
      cachedDistricts: cachedDistricts.length,
      missingDistricts: missingDistricts.length,
      available,
    })

    return {
      date,
      available,
      cachedDistricts,
      configuredDistricts,
      missingDistricts,
    }
  }

  /**
   * Read cached CSV data and build RawData structure
   *
   * Requirements: 3.2, 3.7, 6.3, 6.4
   *
   * @param date - Target date
   * @param availability - Cache availability information
   * @returns RawData structure for normalization
   */
  private async readCachedData(
    date: string,
    availability: CacheAvailability
  ): Promise<RawData> {
    const startTime = Date.now()
    const districtData = new Map<string, RawDistrictData>()
    const districtErrors = new Map<
      string,
      Array<{
        districtId: string
        operation:
          | 'districtPerformance'
          | 'divisionPerformance'
          | 'clubPerformance'
        error: string
        timestamp: string
        shouldRetry: boolean
      }>
    >()
    const successfulDistricts: string[] = []
    const failedDistricts: string[] = []
    const errors: string[] = []
    const corruptedFiles: string[] = []

    // Read cache metadata for closing period info and checksum validation
    const cacheMetadata = await this.rawCSVCache.getCacheMetadata(date)

    // Read all-districts data with checksum validation (Requirements 6.3, 6.4)
    let allDistricts: ScrapedRecord[] = []
    const {
      content: allDistrictsCSV,
      validationResult: allDistrictsValidation,
    } = await this.readAndValidateCachedCSV(
      date,
      CSVType.ALL_DISTRICTS,
      undefined,
      cacheMetadata
    )

    if (allDistrictsValidation && !allDistrictsValidation.isValid) {
      corruptedFiles.push(allDistrictsValidation.filename)
      errors.push(
        `Corrupted cache file skipped: ${allDistrictsValidation.filename} - ${allDistrictsValidation.error}`
      )
    }

    if (allDistrictsCSV) {
      try {
        allDistricts = this.parseCSV(allDistrictsCSV)
        this.log.debug('Parsed all-districts CSV', {
          date,
          recordCount: allDistricts.length,
        })
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error'
        this.log.warn('Failed to parse all-districts CSV', {
          date,
          error: errorMessage,
        })
        errors.push(`Failed to parse all-districts CSV: ${errorMessage}`)
      }
    }

    // Read each cached district's data with checksum validation
    for (const districtId of availability.cachedDistricts) {
      try {
        const rawDistrictData = await this.readDistrictCacheDataWithValidation(
          date,
          districtId,
          cacheMetadata,
          corruptedFiles,
          errors
        )

        if (rawDistrictData) {
          districtData.set(districtId, rawDistrictData)
          successfulDistricts.push(districtId)
        } else {
          failedDistricts.push(districtId)
          errors.push(`No data found for district ${districtId}`)
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error'
        failedDistricts.push(districtId)
        errors.push(`Failed to read district ${districtId}: ${errorMessage}`)

        districtErrors.set(districtId, [
          {
            districtId,
            operation: 'clubPerformance',
            error: errorMessage,
            timestamp: new Date().toISOString(),
            shouldRetry: true,
          },
        ])
      }
    }

    // Build metadata from cache
    const allDistrictsMetadata = this.buildAllDistrictsMetadata(
      date,
      cacheMetadata
    )

    const rawData: RawData = {
      allDistricts,
      allDistrictsMetadata,
      districtData,
      scrapingMetadata: {
        startTime: new Date(startTime).toISOString(),
        endTime: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        districtCount: districtData.size,
        errors,
        districtErrors,
        successfulDistricts,
        failedDistricts,
      },
    }

    this.log.info('Cached data read completed', {
      date,
      allDistrictsCount: allDistricts.length,
      districtDataCount: districtData.size,
      successfulDistricts: successfulDistricts.length,
      failedDistricts: failedDistricts.length,
      corruptedFilesSkipped: corruptedFiles.length,
      corruptedFiles: corruptedFiles.length > 0 ? corruptedFiles : undefined,
      isClosingPeriod: cacheMetadata?.isClosingPeriod,
      dataMonth: cacheMetadata?.dataMonth,
    })

    return rawData
  }

  /**
   * Read cached data for a single district with checksum validation
   *
   * Requirements: 6.3, 6.4 - Validate cache data integrity and skip corrupted files
   *
   * @param date - Target date
   * @param districtId - District ID
   * @param cacheMetadata - Cache metadata for checksum validation
   * @param corruptedFiles - Array to track corrupted files (mutated)
   * @param errors - Array to track errors (mutated)
   * @returns Raw district data or null if not available
   */
  private async readDistrictCacheDataWithValidation(
    date: string,
    districtId: string,
    cacheMetadata: RawCSVCacheMetadata | null,
    corruptedFiles: string[],
    errors: string[]
  ): Promise<RawDistrictData | null> {
    const districtPerformance: ScrapedRecord[] = []
    const divisionPerformance: ScrapedRecord[] = []
    const clubPerformance: ScrapedRecord[] = []

    // Read and validate district performance CSV
    const { content: districtCSV, validationResult: districtValidation } =
      await this.readAndValidateCachedCSV(
        date,
        CSVType.DISTRICT_PERFORMANCE,
        districtId,
        cacheMetadata
      )

    if (districtValidation && !districtValidation.isValid) {
      corruptedFiles.push(districtValidation.filename)
      errors.push(
        `Corrupted cache file skipped: ${districtValidation.filename} - ${districtValidation.error}`
      )
    }

    if (districtCSV) {
      try {
        districtPerformance.push(...this.parseCSV(districtCSV))
      } catch (error) {
        this.log.warn('Failed to parse district performance CSV', {
          date,
          districtId,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    // Read and validate division performance CSV
    const { content: divisionCSV, validationResult: divisionValidation } =
      await this.readAndValidateCachedCSV(
        date,
        CSVType.DIVISION_PERFORMANCE,
        districtId,
        cacheMetadata
      )

    if (divisionValidation && !divisionValidation.isValid) {
      corruptedFiles.push(divisionValidation.filename)
      errors.push(
        `Corrupted cache file skipped: ${divisionValidation.filename} - ${divisionValidation.error}`
      )
    }

    if (divisionCSV) {
      try {
        divisionPerformance.push(...this.parseCSV(divisionCSV))
      } catch (error) {
        this.log.warn('Failed to parse division performance CSV', {
          date,
          districtId,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    // Read and validate club performance CSV
    const { content: clubCSV, validationResult: clubValidation } =
      await this.readAndValidateCachedCSV(
        date,
        CSVType.CLUB_PERFORMANCE,
        districtId,
        cacheMetadata
      )

    if (clubValidation && !clubValidation.isValid) {
      corruptedFiles.push(clubValidation.filename)
      errors.push(
        `Corrupted cache file skipped: ${clubValidation.filename} - ${clubValidation.error}`
      )
    }

    if (clubCSV) {
      try {
        clubPerformance.push(...this.parseCSV(clubCSV))
      } catch (error) {
        this.log.warn('Failed to parse club performance CSV', {
          date,
          districtId,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    // Return null if no data was found
    if (
      districtPerformance.length === 0 &&
      divisionPerformance.length === 0 &&
      clubPerformance.length === 0
    ) {
      return null
    }

    return {
      districtPerformance,
      divisionPerformance,
      clubPerformance,
    }
  }

  /**
   * Build all-districts metadata from cache metadata
   *
   * Requirements: 3.7 - Preserve closing period info from cache
   *
   * @param date - Target date
   * @param cacheMetadata - Cache metadata (may be null)
   * @returns All-districts metadata structure
   */
  private buildAllDistrictsMetadata(
    date: string,
    cacheMetadata: RawCSVCacheMetadata | null
  ): RawData['allDistrictsMetadata'] {
    return {
      fromCache: true,
      csvDate: date,
      fetchedAt: cacheMetadata
        ? new Date(cacheMetadata.timestamp).toISOString()
        : new Date().toISOString(),
      // Preserve closing period info from cache metadata (Requirement 3.7)
      dataMonth: cacheMetadata?.dataMonth,
      isClosingPeriod: cacheMetadata?.isClosingPeriod,
    }
  }

  /**
   * Parse CSV content into ScrapedRecord array
   *
   * Filters out footer rows that contain "Month of" (e.g., "Month of Mar, As of 03/24/2024")
   * which are metadata lines from the Toastmasters dashboard, not actual data records.
   *
   * @param csvContent - Raw CSV string
   * @returns Array of parsed records
   */
  private parseCSV(csvContent: string): ScrapedRecord[] {
    try {
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
      }) as ScrapedRecord[]

      // Filter out footer rows containing "Month of" (e.g., "Month of Mar, As of 03/24/2024")
      // These are metadata lines from the Toastmasters dashboard, not actual data records
      const filteredRecords = records.filter((record: ScrapedRecord) => {
        const hasMonthOf = Object.values(record).some(
          value => typeof value === 'string' && value.includes('Month of')
        )
        return !hasMonthOf
      })

      if (filteredRecords.length < records.length) {
        this.log.debug('Filtered CSV footer rows', {
          totalRecords: records.length,
          filteredRecords: filteredRecords.length,
          removedRecords: records.length - filteredRecords.length,
        })
      }

      return filteredRecords
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`CSV parsing failed: ${errorMessage}`)
    }
  }

  /**
   * Calculate all-districts rankings
   *
   * @param allDistricts - All districts data
   * @param metadata - All districts metadata
   * @returns Rankings data or undefined
   */
  private async calculateAllDistrictsRankings(
    allDistricts: ScrapedRecord[],
    metadata: RawData['allDistrictsMetadata']
  ): Promise<AllDistrictsRankingsData | undefined> {
    if (!this.rankingCalculator || allDistricts.length === 0) {
      return undefined
    }

    // Convert ScrapedRecord to DistrictStatistics for ranking calculation
    const districtStats = allDistricts.map(record => ({
      districtId: String(record['DISTRICT'] ?? record['District'] ?? ''),
      asOfDate: metadata.csvDate,
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
    }))

    const rankedDistricts =
      await this.rankingCalculator.calculateRankings(districtStats)

    // Build rankings data structure
    const rankings = rankedDistricts
      .filter(d => d.ranking)
      .map(d => ({
        districtId: d.districtId,
        districtName: d.ranking?.districtName ?? d.districtId,
        region: d.ranking?.region ?? 'Unknown',
        paidClubs: d.ranking?.paidClubs ?? 0,
        paidClubBase: d.ranking?.paidClubBase ?? 0,
        clubGrowthPercent: d.ranking?.clubGrowthPercent ?? 0,
        totalPayments: d.ranking?.totalPayments ?? 0,
        paymentBase: d.ranking?.paymentBase ?? 0,
        paymentGrowthPercent: d.ranking?.paymentGrowthPercent ?? 0,
        activeClubs: d.ranking?.activeClubs ?? 0,
        distinguishedClubs: d.ranking?.distinguishedClubs ?? 0,
        selectDistinguished: d.ranking?.selectDistinguished ?? 0,
        presidentsDistinguished: d.ranking?.presidentsDistinguished ?? 0,
        distinguishedPercent: d.ranking?.distinguishedPercent ?? 0,
        clubsRank: d.ranking?.clubsRank ?? 0,
        paymentsRank: d.ranking?.paymentsRank ?? 0,
        distinguishedRank: d.ranking?.distinguishedRank ?? 0,
        aggregateScore: d.ranking?.aggregateScore ?? 0,
      }))

    return {
      metadata: {
        snapshotId: '', // Will be set when snapshot is created
        calculatedAt: new Date().toISOString(),
        schemaVersion: '1.0.0',
        calculationVersion: '1.0.0',
        rankingVersion: this.rankingCalculator.getRankingVersion(),
        sourceCsvDate: metadata.csvDate,
        csvFetchedAt: metadata.fetchedAt,
        totalDistricts: rankings.length,
        fromCache: true,
      },
      rankings,
    }
  }

  /**
   * Create and persist a snapshot
   *
   * Requirements: 3.3, 3.5, 3.7
   *
   * @param normalizedData - Normalized data to snapshot
   * @param status - Snapshot status
   * @param errors - Error messages
   * @param rawData - Raw data for metadata
   * @param allDistrictsRankings - Optional rankings data
   * @returns Created snapshot
   */
  private async createSnapshot(
    normalizedData: NormalizedData,
    status: SnapshotStatus,
    errors: string[],
    rawData?: RawData,
    allDistrictsRankings?: AllDistrictsRankingsData
  ): Promise<Snapshot> {
    const createdAt = new Date().toISOString()

    // Determine the effective snapshot date (used as the storage key/ID)
    // For closing period data, use the logical date; otherwise use dataAsOfDate
    let effectiveSnapshotDate: string
    if (
      normalizedData.metadata.isClosingPeriodData &&
      normalizedData.metadata.logicalDate
    ) {
      effectiveSnapshotDate = normalizedData.metadata.logicalDate
    } else {
      effectiveSnapshotDate = normalizedData.metadata.dataAsOfDate
    }

    // Use the ISO date as the snapshot ID - this matches how SnapshotStore stores snapshots
    const snapshotId = effectiveSnapshotDate

    // Enhance metadata with scraping info if available
    if (rawData) {
      normalizedData.metadata.configuredDistricts =
        rawData.scrapingMetadata.successfulDistricts.concat(
          rawData.scrapingMetadata.failedDistricts
        )
      normalizedData.metadata.successfulDistricts =
        rawData.scrapingMetadata.successfulDistricts
      normalizedData.metadata.failedDistricts =
        rawData.scrapingMetadata.failedDistricts

      // Convert district errors to the expected format
      if (rawData.scrapingMetadata.districtErrors.size > 0) {
        normalizedData.metadata.districtErrors = []
        for (const [districtId, districtErrorList] of rawData.scrapingMetadata
          .districtErrors) {
          for (const err of districtErrorList) {
            normalizedData.metadata.districtErrors.push({
              districtId,
              error: err.error,
              errorType: 'fetch_failed',
              timestamp: err.timestamp,
            })
          }
        }
      }
    }

    const snapshot: Snapshot = {
      snapshot_id: snapshotId,
      created_at: createdAt,
      schema_version: this.getCurrentSchemaVersion(),
      calculation_version: this.getCurrentCalculationVersion(),
      status,
      errors,
      payload: normalizedData,
    }

    // Write snapshot to store with the effective date as override
    // This ensures the snapshot is stored in the correct date-based directory
    await this.snapshotStorage.writeSnapshot(snapshot, allDistrictsRankings, {
      overrideSnapshotDate: effectiveSnapshotDate,
    })

    this.log.info('Snapshot created and persisted', {
      snapshotId: snapshot.snapshot_id,
      status,
      districtCount: normalizedData.districts.length,
      errorCount: errors.length,
      isClosingPeriod: normalizedData.metadata.isClosingPeriodData,
      effectiveSnapshotDate,
    })

    return snapshot
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

  /**
   * Calculate SHA-256 checksum for content
   *
   * @param content - Content to hash
   * @returns Hex-encoded SHA-256 hash
   */
  private calculateChecksum(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex')
  }

  /**
   * Validate file checksum against cache metadata
   *
   * Requirements: 6.3, 6.4 - Validate cache data integrity before processing
   *
   * @param content - File content to validate
   * @param filename - Filename for lookup in metadata checksums
   * @param cacheMetadata - Cache metadata containing expected checksums
   * @returns Validation result with details
   */
  validateFileChecksum(
    content: string,
    filename: string,
    cacheMetadata: RawCSVCacheMetadata | null
  ): ChecksumValidationResult {
    // If no metadata, we can't validate - treat as valid but log warning
    if (!cacheMetadata) {
      this.log.warn('No cache metadata available for checksum validation', {
        filename,
      })
      return {
        isValid: true,
        filename,
        error: 'No metadata available for validation',
      }
    }

    const expectedChecksum = cacheMetadata.integrity.checksums[filename]

    // If no checksum in metadata, we can't validate - treat as valid but log warning
    if (!expectedChecksum) {
      this.log.warn('No checksum found in metadata for file', {
        filename,
        availableChecksums: Object.keys(cacheMetadata.integrity.checksums),
      })
      return {
        isValid: true,
        filename,
        error: 'No checksum in metadata for this file',
      }
    }

    const actualChecksum = this.calculateChecksum(content)

    if (actualChecksum !== expectedChecksum) {
      this.log.error('Checksum mismatch detected - file may be corrupted', {
        filename,
        expectedChecksum,
        actualChecksum,
      })
      return {
        isValid: false,
        filename,
        expectedChecksum,
        actualChecksum,
        error: `Checksum mismatch: expected ${expectedChecksum}, got ${actualChecksum}`,
      }
    }

    this.log.debug('Checksum validation passed', {
      filename,
      checksum: actualChecksum,
    })

    return {
      isValid: true,
      filename,
      expectedChecksum,
      actualChecksum,
    }
  }

  /**
   * Get the filename key used in cache metadata checksums
   *
   * @param type - CSV type
   * @param districtId - Optional district ID
   * @returns Filename key for checksum lookup
   */
  private getChecksumFilename(type: CSVType, districtId?: string): string {
    if (type === CSVType.ALL_DISTRICTS) {
      return 'all-districts.csv'
    }
    if (!districtId) {
      throw new Error(`District ID required for CSV type: ${type}`)
    }
    return `district-${districtId}/${type}.csv`
  }

  /**
   * Read and validate cached CSV content with checksum verification
   *
   * Requirements: 6.3, 6.4 - Validate cache data integrity and skip corrupted files
   *
   * @param date - Target date
   * @param type - CSV type
   * @param districtId - Optional district ID
   * @param cacheMetadata - Cache metadata for checksum validation
   * @returns CSV content if valid, null if corrupted or missing
   */
  async readAndValidateCachedCSV(
    date: string,
    type: CSVType,
    districtId: string | undefined,
    cacheMetadata: RawCSVCacheMetadata | null
  ): Promise<{
    content: string | null
    validationResult: ChecksumValidationResult | null
  }> {
    const csvContent = await this.rawCSVCache.getCachedCSV(
      date,
      type,
      districtId
    )

    if (!csvContent) {
      return { content: null, validationResult: null }
    }

    const filename = this.getChecksumFilename(type, districtId)
    const validationResult = this.validateFileChecksum(
      csvContent,
      filename,
      cacheMetadata
    )

    if (!validationResult.isValid) {
      this.log.error('Skipping corrupted cache file', {
        date,
        type,
        districtId,
        filename,
        error: validationResult.error,
      })
      return { content: null, validationResult }
    }

    return { content: csvContent, validationResult }
  }
}
