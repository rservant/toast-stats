/**
 * Analytics Generator for Unified Backfill Service
 *
 * NOTE: This service has been updated to comply with the data-computation-separation
 * steering document. All computation methods have been removed. Analytics and time-series
 * data are now pre-computed by scraper-cli during the compute-analytics pipeline.
 *
 * This service now only:
 * - Provides preview functionality for backfill operations
 * - Reads pre-computed data (no computation)
 * - Supports cancellation
 *
 * Requirements: 15.1-15.7
 */

import type { ISnapshotStorage } from '../../../types/storageInterfaces.js'
import type { PreComputedAnalyticsService } from '../../PreComputedAnalyticsService.js'
import { logger } from '../../../utils/logger.js'

// ============================================================================
// Types
// ============================================================================

/**
 * Progress information for analytics generation
 */
export interface GenerationProgress {
  /** Total number of snapshots to process */
  totalItems: number

  /** Number of snapshots successfully processed */
  processedItems: number

  /** Number of snapshots that failed */
  failedItems: number

  /** Number of snapshots skipped */
  skippedItems: number

  /** Current snapshot being processed */
  currentItem: string | null

  /** Percentage complete (0-100) */
  percentComplete: number
}

/**
 * Result of an analytics generation operation
 */
export interface GenerationResult {
  /** Whether the generation completed successfully */
  success: boolean

  /** Number of snapshots processed */
  processedItems: number

  /** Number of snapshots that failed */
  failedItems: number

  /** Number of snapshots skipped */
  skippedItems: number

  /** Snapshot IDs that were processed */
  snapshotIds: string[]

  /** Errors encountered during generation */
  errors: GenerationError[]

  /** Total duration in milliseconds */
  duration: number
}

/**
 * Error encountered during generation
 */
export interface GenerationError {
  /** The snapshot/item that caused the error */
  itemId: string

  /** Error message */
  message: string

  /** When the error occurred */
  occurredAt: string

  /** Whether the error is retryable */
  isRetryable: boolean
}

/**
 * Preview of an analytics generation operation (dry run)
 */
export interface GenerationPreview {
  /** Total number of snapshots that would be processed */
  totalItems: number

  /** Date range for the operation */
  dateRange: {
    startDate: string
    endDate: string
  }

  /** Snapshot IDs that would be processed */
  snapshotIds: string[]

  /** Estimated duration in milliseconds */
  estimatedDuration: number
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Estimated time per snapshot in milliseconds
 * Used for duration estimation in preview
 */
const ESTIMATED_MS_PER_SNAPSHOT = 5000 // 5 seconds per snapshot

// ============================================================================
// AnalyticsGenerator Class
// ============================================================================

/**
 * Analytics Generator for Unified Backfill Service
 *
 * NOTE: Per the data-computation-separation steering document, this service
 * no longer performs any computation. All analytics and time-series data
 * are pre-computed by scraper-cli during the compute-analytics pipeline.
 *
 * This service now only provides:
 * - Preview functionality for backfill operations
 * - Verification that pre-computed data exists
 * - Cancellation support
 *
 * @example
 * ```typescript
 * const generator = new AnalyticsGenerator(snapshotStorage, preComputedAnalyticsService)
 *
 * // Preview what would be processed
 * const preview = await generator.previewGeneration('2024-01-01', '2024-01-31')
 *
 * // Process snapshots (reads pre-computed data only)
 * const result = await generator.generateForSnapshots(
 *   ['2024-01-15', '2024-01-16'],
 *   (progress) => console.log(`${progress.percentComplete}% complete`)
 * )
 * ```
 */
export class AnalyticsGenerator {
  private readonly snapshotStorage: ISnapshotStorage

  /**
   * Flag to track if generation should be cancelled
   */
  private cancelled = false

  /**
   * Creates a new AnalyticsGenerator instance
   *
   * NOTE: The timeSeriesStorage and preComputedAnalyticsService parameters
   * are kept for backward compatibility but are no longer used. Analytics
   * and time-series data are now pre-computed by scraper-cli.
   *
   * @param snapshotStorage - Storage for snapshot operations
   * @param _preComputedAnalyticsService - DEPRECATED: Analytics are now pre-computed by scraper-cli
   */
  constructor(
    snapshotStorage: ISnapshotStorage,
    _preComputedAnalyticsService: PreComputedAnalyticsService
  ) {
    this.snapshotStorage = snapshotStorage
    // NOTE: preComputedAnalyticsService parameter is kept for backward compatibility
    // but is no longer used. Analytics are now pre-computed by scraper-cli.

    logger.debug('AnalyticsGenerator initialized (read-only mode)', {
      component: 'AnalyticsGenerator',
    })
  }

  // ============================================================================
  // Public Methods
  // ============================================================================

  /**
   * Generate analytics for specified snapshots
   *
   * NOTE: Per the data-computation-separation steering document, this method
   * no longer performs any computation. It verifies that snapshots exist and
   * logs that analytics should be pre-computed by scraper-cli.
   *
   * @param snapshotIds - Array of snapshot IDs to process
   * @param progressCallback - Callback for progress updates
   * @returns Generation result
   *
   * Requirements: 15.7
   */
  async generateForSnapshots(
    snapshotIds: string[],
    progressCallback: (progress: GenerationProgress) => void
  ): Promise<GenerationResult> {
    const startTime = Date.now()
    this.cancelled = false

    const totalItems = snapshotIds.length

    logger.info('Starting analytics verification (read-only mode)', {
      totalSnapshots: totalItems,
      component: 'AnalyticsGenerator',
      operation: 'generateForSnapshots',
    })

    // Initialize progress tracking
    let processedItems = 0
    let failedItems = 0
    let skippedItems = 0
    const processedSnapshotIds: string[] = []
    const errors: GenerationError[] = []

    // Report initial progress
    progressCallback({
      totalItems,
      processedItems,
      failedItems,
      skippedItems,
      currentItem: null,
      percentComplete: this.calculatePercentComplete(0, totalItems),
    })

    // Process each snapshot (verification only, no computation)
    for (const snapshotId of snapshotIds) {
      // Check for cancellation
      if (this.cancelled) {
        logger.info('Analytics verification cancelled', {
          snapshotId,
          processedItems,
          component: 'AnalyticsGenerator',
          operation: 'generateForSnapshots',
        })
        break
      }

      // Report current item
      progressCallback({
        totalItems,
        processedItems,
        failedItems,
        skippedItems,
        currentItem: snapshotId,
        percentComplete: this.calculatePercentComplete(
          processedItems + failedItems + skippedItems,
          totalItems
        ),
      })

      try {
        // Verify the snapshot exists (no computation)
        const result = await this.verifySnapshot(snapshotId)

        if (result.success) {
          processedItems++
          processedSnapshotIds.push(snapshotId)

          logger.debug('Verified snapshot exists', {
            snapshotId,
            districtsFound: result.districtsFound,
            component: 'AnalyticsGenerator',
            operation: 'generateForSnapshots',
          })
        } else if (result.skipped) {
          skippedItems++

          logger.debug('Skipped snapshot', {
            snapshotId,
            reason: result.reason,
            component: 'AnalyticsGenerator',
            operation: 'generateForSnapshots',
          })
        } else {
          failedItems++
          errors.push({
            itemId: snapshotId,
            message: result.error ?? 'Unknown error during verification',
            occurredAt: new Date().toISOString(),
            isRetryable: result.isRetryable ?? true,
          })

          logger.warn('Failed to verify snapshot', {
            snapshotId,
            error: result.error,
            component: 'AnalyticsGenerator',
            operation: 'generateForSnapshots',
          })
        }
      } catch (error) {
        failedItems++
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error'
        errors.push({
          itemId: snapshotId,
          message: errorMessage,
          occurredAt: new Date().toISOString(),
          isRetryable: this.isRetryableError(error),
        })

        logger.error('Error verifying snapshot', {
          snapshotId,
          error: errorMessage,
          component: 'AnalyticsGenerator',
          operation: 'generateForSnapshots',
        })
      }

      // Report progress after each snapshot
      progressCallback({
        totalItems,
        processedItems,
        failedItems,
        skippedItems,
        currentItem: snapshotId,
        percentComplete: this.calculatePercentComplete(
          processedItems + failedItems + skippedItems,
          totalItems
        ),
      })
    }

    const duration = Date.now() - startTime

    logger.info('Analytics verification completed (read-only mode)', {
      processedItems,
      failedItems,
      skippedItems,
      duration,
      cancelled: this.cancelled,
      component: 'AnalyticsGenerator',
      operation: 'generateForSnapshots',
      note: 'Analytics and time-series data should be pre-computed by scraper-cli',
    })

    return {
      success: failedItems === 0 && !this.cancelled,
      processedItems,
      failedItems,
      skippedItems,
      snapshotIds: processedSnapshotIds,
      errors,
      duration,
    }
  }

  /**
   * Preview an analytics generation operation (dry run)
   *
   * Returns information about what would be processed without
   * actually executing the generation.
   *
   * @param startDate - Optional start date filter (ISO format: YYYY-MM-DD)
   * @param endDate - Optional end date filter (ISO format: YYYY-MM-DD)
   * @returns Preview of the generation operation
   *
   * Requirements: 4.5, 11.2
   */
  async previewGeneration(
    startDate?: string,
    endDate?: string
  ): Promise<GenerationPreview> {
    logger.debug('Generating analytics preview', {
      startDate,
      endDate,
      component: 'AnalyticsGenerator',
      operation: 'previewGeneration',
    })

    // Get all successful snapshots
    const allSnapshots = await this.snapshotStorage.listSnapshots(undefined, {
      status: 'success',
    })

    // Filter by date range if specified
    let filteredSnapshots = allSnapshots

    if (startDate !== undefined || endDate !== undefined) {
      filteredSnapshots = allSnapshots.filter(snapshot => {
        const snapshotDate = snapshot.snapshot_id

        if (startDate !== undefined && snapshotDate < startDate) {
          return false
        }

        if (endDate !== undefined && snapshotDate > endDate) {
          return false
        }

        return true
      })
    }

    // Sort by date (oldest first for processing order)
    filteredSnapshots.sort((a, b) => a.snapshot_id.localeCompare(b.snapshot_id))

    const snapshotIds = filteredSnapshots.map(s => s.snapshot_id)

    // Determine actual date range from filtered snapshots
    const actualStartDate =
      snapshotIds.length > 0 ? (snapshotIds[0] ?? '') : (startDate ?? '')
    const actualEndDate =
      snapshotIds.length > 0
        ? (snapshotIds[snapshotIds.length - 1] ?? '')
        : (endDate ?? '')

    // Estimate duration
    const estimatedDuration = snapshotIds.length * ESTIMATED_MS_PER_SNAPSHOT

    logger.debug('Generated analytics preview', {
      totalSnapshots: snapshotIds.length,
      startDate: actualStartDate,
      endDate: actualEndDate,
      estimatedDuration,
      component: 'AnalyticsGenerator',
      operation: 'previewGeneration',
    })

    return {
      totalItems: snapshotIds.length,
      dateRange: {
        startDate: actualStartDate,
        endDate: actualEndDate,
      },
      snapshotIds,
      estimatedDuration,
    }
  }

  /**
   * Cancel the current generation operation
   *
   * Sets a flag that will be checked during processing.
   * The generation will stop at the next snapshot boundary.
   */
  cancel(): void {
    this.cancelled = true
    logger.info('Analytics verification cancellation requested', {
      component: 'AnalyticsGenerator',
      operation: 'cancel',
    })
  }

  /**
   * Check if generation is cancelled
   */
  isCancelled(): boolean {
    return this.cancelled
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Verify a snapshot exists and has districts
   *
   * NOTE: This method only verifies that the snapshot exists. It does NOT
   * perform any computation. Analytics and time-series data should be
   * pre-computed by scraper-cli.
   *
   * @param snapshotId - The snapshot ID to verify
   * @returns Verification result
   */
  private async verifySnapshot(snapshotId: string): Promise<{
    success: boolean
    skipped?: boolean
    reason?: string
    error?: string
    isRetryable?: boolean
    districtsFound?: number
  }> {
    // Get the snapshot
    const snapshot = await this.snapshotStorage.getSnapshot(snapshotId)

    if (snapshot === null) {
      return {
        success: false,
        skipped: true,
        reason: 'Snapshot not found',
      }
    }

    // Get list of districts in the snapshot
    const districtIds =
      await this.snapshotStorage.listDistrictsInSnapshot(snapshotId)

    if (districtIds.length === 0) {
      return {
        success: false,
        skipped: true,
        reason: 'No districts in snapshot',
      }
    }

    // NOTE: Per the data-computation-separation steering document, we do NOT
    // compute analytics or time-series data here. That is done by scraper-cli.
    // This method only verifies that the snapshot exists and has districts.

    logger.debug('Snapshot verified (no computation performed)', {
      snapshotId,
      districtsFound: districtIds.length,
      component: 'AnalyticsGenerator',
      operation: 'verifySnapshot',
      note: 'Analytics and time-series data should be pre-computed by scraper-cli',
    })

    return {
      success: true,
      districtsFound: districtIds.length,
    }
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
