/**
 * Data Collector for Unified Backfill Service
 *
 * Handles data collection backfill operations, including:
 * - Date range processing with checkpoint support
 * - Preview/dry-run functionality
 * - Integration with RefreshService and SnapshotStorage
 * - Skip-on-resume logic for recovery
 *
 * Requirements: 2.2, 4.1, 4.3, 4.4, 10.3, 11.2
 */

import type { RefreshService } from '../../RefreshService.js'
import type { ISnapshotStorage } from '../../../types/storageInterfaces.js'
import type { DistrictConfigurationService } from '../../DistrictConfigurationService.js'
import { logger } from '../../../utils/logger.js'

// ============================================================================
// Types
// ============================================================================

/**
 * Options for data collection operations
 */
export interface CollectionOptions {
  /**
   * Target districts for data collection
   * If not specified, all configured districts are processed
   */
  targetDistricts?: string[]

  /**
   * Skip dates that already have snapshots
   * Defaults to true
   */
  skipExisting?: boolean

  /**
   * Items already completed (for skip-on-resume)
   * Used when recovering from a checkpoint
   */
  completedItems?: string[]
}

/**
 * Progress information for data collection
 */
export interface CollectionProgress {
  /** Total number of dates to process */
  totalItems: number

  /** Number of dates successfully processed */
  processedItems: number

  /** Number of dates that failed */
  failedItems: number

  /** Number of dates skipped (already exist or in checkpoint) */
  skippedItems: number

  /** Current date being processed */
  currentItem: string | null

  /** Percentage complete (0-100) */
  percentComplete: number
}

/**
 * Result of a data collection operation
 */
export interface CollectionResult {
  /** Whether the collection completed successfully */
  success: boolean

  /** Number of dates processed */
  processedItems: number

  /** Number of dates that failed */
  failedItems: number

  /** Number of dates skipped */
  skippedItems: number

  /** Snapshot IDs created during collection */
  snapshotIds: string[]

  /** Errors encountered during collection */
  errors: CollectionError[]

  /** Total duration in milliseconds */
  duration: number
}

/**
 * Error encountered during collection
 */
export interface CollectionError {
  /** The date that caused the error */
  date: string

  /** Error message */
  message: string

  /** Whether the error is retryable */
  isRetryable: boolean
}

/**
 * Preview of a data collection operation (dry run)
 */
export interface CollectionPreview {
  /** Total number of dates that would be processed */
  totalItems: number

  /** Date range for the operation */
  dateRange: {
    startDate: string
    endDate: string
  }

  /** Districts that would be affected */
  affectedDistricts: string[]

  /** Estimated duration in milliseconds */
  estimatedDuration: number

  /** List of dates that would be processed */
  dates: string[]

  /** Dates that would be skipped (already exist) */
  skippedDates: string[]
}

/**
 * Validation error for date range
 */
export class DateRangeValidationError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'INVALID_DATE_FORMAT'
      | 'START_AFTER_END'
      | 'END_NOT_BEFORE_TODAY'
  ) {
    super(message)
    this.name = 'DateRangeValidationError'
    Object.setPrototypeOf(this, DateRangeValidationError.prototype)
  }
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Estimated time per date in milliseconds
 * Used for duration estimation in preview
 */
const ESTIMATED_MS_PER_DATE = 30000 // 30 seconds per date

// ============================================================================
// DataCollector Class
// ============================================================================

/**
 * Data Collector for Unified Backfill Service
 *
 * Handles data collection backfill operations by coordinating with
 * RefreshService to fetch historical dashboard data for specified date ranges.
 *
 * @example
 * ```typescript
 * const collector = new DataCollector(refreshService, snapshotStorage, configService)
 *
 * // Preview what would be collected
 * const preview = await collector.previewCollection('2024-01-01', '2024-01-31', {})
 *
 * // Collect data with progress callback
 * const result = await collector.collectForDateRange(
 *   '2024-01-01',
 *   '2024-01-31',
 *   { skipExisting: true },
 *   (progress) => console.log(`${progress.percentComplete}% complete`)
 * )
 * ```
 */
export class DataCollector {
  private readonly refreshService: RefreshService
  private readonly snapshotStorage: ISnapshotStorage
  private readonly configService: DistrictConfigurationService

  /**
   * Flag to track if collection should be cancelled
   */
  private cancelled = false

  /**
   * Creates a new DataCollector instance
   *
   * @param refreshService - Service for executing refresh operations
   * @param snapshotStorage - Storage for snapshot operations
   * @param configService - Service for district configuration
   */
  constructor(
    refreshService: RefreshService,
    snapshotStorage: ISnapshotStorage,
    configService: DistrictConfigurationService
  ) {
    this.refreshService = refreshService
    this.snapshotStorage = snapshotStorage
    this.configService = configService

    logger.debug('DataCollector initialized', {
      component: 'DataCollector',
    })
  }

  // ============================================================================
  // Public Methods
  // ============================================================================

  /**
   * Collect data for a date range
   *
   * Processes each date in the range, calling RefreshService to fetch
   * and store snapshot data. Supports skip-on-resume via completedItems
   * in options.
   *
   * @param startDate - Start date (ISO format: YYYY-MM-DD)
   * @param endDate - End date (ISO format: YYYY-MM-DD)
   * @param options - Collection options
   * @param progressCallback - Callback for progress updates
   * @returns Collection result
   *
   * Requirements: 2.2, 4.1, 4.3, 4.4, 10.3
   */
  async collectForDateRange(
    startDate: string,
    endDate: string,
    options: CollectionOptions,
    progressCallback: (progress: CollectionProgress) => void
  ): Promise<CollectionResult> {
    const startTime = Date.now()
    this.cancelled = false

    // Validate date range
    this.validateDateRange(startDate, endDate)

    // Generate dates to process
    const allDates = this.generateDateRange(startDate, endDate)

    // Filter out completed items (for skip-on-resume)
    const completedSet = new Set(options.completedItems ?? [])
    const datesToProcess = allDates.filter(date => !completedSet.has(date))

    // Check for existing snapshots if skipExisting is enabled
    const skipExisting = options.skipExisting ?? true
    const { datesToCollect, skippedDates } = skipExisting
      ? await this.filterExistingSnapshots(datesToProcess)
      : { datesToCollect: datesToProcess, skippedDates: [] }

    const totalItems = allDates.length
    const initialSkipped = completedSet.size + skippedDates.length

    logger.info('Starting data collection', {
      startDate,
      endDate,
      totalDates: totalItems,
      datesToCollect: datesToCollect.length,
      skippedFromCheckpoint: completedSet.size,
      skippedExisting: skippedDates.length,
      component: 'DataCollector',
      operation: 'collectForDateRange',
    })

    // Initialize progress
    let processedItems = 0
    let failedItems = 0
    let skippedItems = initialSkipped
    const snapshotIds: string[] = []
    const errors: CollectionError[] = []

    // Report initial progress
    progressCallback({
      totalItems,
      processedItems,
      failedItems,
      skippedItems,
      currentItem: null,
      percentComplete: this.calculatePercentComplete(
        processedItems + skippedItems,
        totalItems
      ),
    })

    // Process each date
    for (const date of datesToCollect) {
      // Check for cancellation
      if (this.cancelled) {
        logger.info('Data collection cancelled', {
          date,
          processedItems,
          component: 'DataCollector',
          operation: 'collectForDateRange',
        })
        break
      }

      // Report current item
      progressCallback({
        totalItems,
        processedItems,
        failedItems,
        skippedItems,
        currentItem: date,
        percentComplete: this.calculatePercentComplete(
          processedItems + skippedItems,
          totalItems
        ),
      })

      try {
        // Execute refresh for this date
        const result = await this.refreshService.executeRefresh(date)

        if (result.success && result.snapshot_id) {
          snapshotIds.push(result.snapshot_id)
          processedItems++

          logger.debug('Successfully collected data for date', {
            date,
            snapshotId: result.snapshot_id,
            component: 'DataCollector',
            operation: 'collectForDateRange',
          })
        } else {
          // Partial success or failure
          failedItems++
          errors.push({
            date,
            message: result.errors.join('; ') || 'Unknown error during refresh',
            isRetryable: true,
          })

          logger.warn('Failed to collect data for date', {
            date,
            errors: result.errors,
            component: 'DataCollector',
            operation: 'collectForDateRange',
          })
        }
      } catch (error) {
        failedItems++
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error'
        errors.push({
          date,
          message: errorMessage,
          isRetryable: this.isRetryableError(error),
        })

        logger.error('Error collecting data for date', {
          date,
          error: errorMessage,
          component: 'DataCollector',
          operation: 'collectForDateRange',
        })
      }

      // Report progress after each date
      progressCallback({
        totalItems,
        processedItems,
        failedItems,
        skippedItems,
        currentItem: date,
        percentComplete: this.calculatePercentComplete(
          processedItems + skippedItems + failedItems,
          totalItems
        ),
      })
    }

    const duration = Date.now() - startTime

    logger.info('Data collection completed', {
      startDate,
      endDate,
      processedItems,
      failedItems,
      skippedItems,
      snapshotCount: snapshotIds.length,
      duration,
      cancelled: this.cancelled,
      component: 'DataCollector',
      operation: 'collectForDateRange',
    })

    return {
      success: failedItems === 0 && !this.cancelled,
      processedItems,
      failedItems,
      skippedItems,
      snapshotIds,
      errors,
      duration,
    }
  }

  /**
   * Preview a data collection operation (dry run)
   *
   * Returns information about what would be processed without
   * actually executing the collection.
   *
   * @param startDate - Start date (ISO format: YYYY-MM-DD)
   * @param endDate - End date (ISO format: YYYY-MM-DD)
   * @param options - Collection options
   * @returns Preview of the collection operation
   *
   * Requirements: 11.2
   */
  async previewCollection(
    startDate: string,
    endDate: string,
    options: CollectionOptions
  ): Promise<CollectionPreview> {
    // Validate date range
    this.validateDateRange(startDate, endDate)

    // Generate dates to process
    const allDates = this.generateDateRange(startDate, endDate)

    // Check for existing snapshots if skipExisting is enabled
    const skipExisting = options.skipExisting ?? true
    const { datesToCollect, skippedDates } = skipExisting
      ? await this.filterExistingSnapshots(allDates)
      : { datesToCollect: allDates, skippedDates: [] }

    // Get affected districts
    const affectedDistricts = options.targetDistricts?.length
      ? options.targetDistricts
      : await this.configService.getConfiguredDistricts()

    // Estimate duration
    const estimatedDuration = datesToCollect.length * ESTIMATED_MS_PER_DATE

    logger.debug('Generated collection preview', {
      startDate,
      endDate,
      totalDates: allDates.length,
      datesToCollect: datesToCollect.length,
      skippedDates: skippedDates.length,
      affectedDistricts: affectedDistricts.length,
      estimatedDuration,
      component: 'DataCollector',
      operation: 'previewCollection',
    })

    return {
      totalItems: datesToCollect.length,
      dateRange: {
        startDate,
        endDate,
      },
      affectedDistricts,
      estimatedDuration,
      dates: datesToCollect,
      skippedDates,
    }
  }

  /**
   * Cancel the current collection operation
   *
   * Sets a flag that will be checked during processing.
   * The collection will stop at the next date boundary.
   */
  cancel(): void {
    this.cancelled = true
    logger.info('Data collection cancellation requested', {
      component: 'DataCollector',
      operation: 'cancel',
    })
  }

  /**
   * Check if collection is cancelled
   */
  isCancelled(): boolean {
    return this.cancelled
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Validate date range
   *
   * Ensures:
   * - Both dates are valid ISO format (YYYY-MM-DD)
   * - startDate <= endDate
   * - endDate < today
   *
   * @param startDate - Start date
   * @param endDate - End date
   * @throws DateRangeValidationError if validation fails
   *
   * Requirements: 4.3, 4.4
   */
  private validateDateRange(startDate: string, endDate: string): void {
    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(startDate)) {
      throw new DateRangeValidationError(
        `Invalid start date format: ${startDate}. Expected YYYY-MM-DD.`,
        'INVALID_DATE_FORMAT'
      )
    }
    if (!dateRegex.test(endDate)) {
      throw new DateRangeValidationError(
        `Invalid end date format: ${endDate}. Expected YYYY-MM-DD.`,
        'INVALID_DATE_FORMAT'
      )
    }

    // Parse dates
    const start = new Date(startDate)
    const end = new Date(endDate)

    // Validate parsed dates
    if (isNaN(start.getTime())) {
      throw new DateRangeValidationError(
        `Invalid start date: ${startDate}`,
        'INVALID_DATE_FORMAT'
      )
    }
    if (isNaN(end.getTime())) {
      throw new DateRangeValidationError(
        `Invalid end date: ${endDate}`,
        'INVALID_DATE_FORMAT'
      )
    }

    // Validate startDate <= endDate
    if (start > end) {
      throw new DateRangeValidationError(
        `Start date (${startDate}) must be before or equal to end date (${endDate})`,
        'START_AFTER_END'
      )
    }

    // Validate endDate < today
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const endDateOnly = new Date(endDate)
    endDateOnly.setHours(0, 0, 0, 0)

    if (endDateOnly >= today) {
      throw new DateRangeValidationError(
        `End date (${endDate}) must be before today. Dashboard data is delayed.`,
        'END_NOT_BEFORE_TODAY'
      )
    }
  }

  /**
   * Generate array of dates in range (inclusive)
   *
   * @param startDate - Start date (YYYY-MM-DD)
   * @param endDate - End date (YYYY-MM-DD)
   * @returns Array of date strings in YYYY-MM-DD format
   */
  private generateDateRange(startDate: string, endDate: string): string[] {
    const dates: string[] = []
    const current = new Date(startDate)
    const end = new Date(endDate)

    while (current <= end) {
      dates.push(this.formatDate(current))
      current.setDate(current.getDate() + 1)
    }

    return dates
  }

  /**
   * Format a Date object as YYYY-MM-DD string
   *
   * Uses UTC methods to avoid timezone issues when parsing ISO date strings.
   * Input dates like '2026-01-26' are parsed as UTC midnight, so we must
   * use getUTCFullYear/getUTCMonth/getUTCDate to get the correct date back.
   *
   * @param date - Date to format
   * @returns Date string in YYYY-MM-DD format
   */
  private formatDate(date: Date): string {
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const day = String(date.getUTCDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  /**
   * Filter out dates that already have snapshots
   *
   * @param dates - Array of dates to check
   * @returns Object with dates to collect and skipped dates
   */
  private async filterExistingSnapshots(
    dates: string[]
  ): Promise<{ datesToCollect: string[]; skippedDates: string[] }> {
    const datesToCollect: string[] = []
    const skippedDates: string[] = []

    // Get list of existing snapshots
    const existingSnapshots = await this.snapshotStorage.listSnapshots(
      undefined,
      {
        status: 'success',
      }
    )
    const existingSnapshotIds = new Set(
      existingSnapshots.map(s => s.snapshot_id)
    )

    for (const date of dates) {
      if (existingSnapshotIds.has(date)) {
        skippedDates.push(date)
      } else {
        datesToCollect.push(date)
      }
    }

    return { datesToCollect, skippedDates }
  }

  /**
   * Calculate percentage complete
   *
   * @param completed - Number of items completed
   * @param total - Total number of items
   * @returns Percentage (0-100)
   */
  private calculatePercentComplete(completed: number, total: number): number {
    if (total === 0) {
      return 100
    }
    return Math.round((completed / total) * 100)
  }

  /**
   * Determine if an error is retryable
   *
   * @param error - The error to check
   * @returns true if the error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase()
      // Network errors, timeouts, and temporary failures are retryable
      return (
        message.includes('timeout') ||
        message.includes('network') ||
        message.includes('econnreset') ||
        message.includes('econnrefused') ||
        message.includes('temporary') ||
        message.includes('rate limit')
      )
    }
    return false
  }
}
