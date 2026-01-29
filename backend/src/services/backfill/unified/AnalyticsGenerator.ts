/**
 * Analytics Generator for Unified Backfill Service
 *
 * Handles analytics generation backfill operations, including:
 * - Generating pre-computed analytics for existing snapshots
 * - Snapshot selection with optional date range filter
 * - Preview/dry-run functionality
 * - Integration with TimeSeriesIndexStorage
 * - Cancellation support
 *
 * Requirements: 2.3, 4.2, 4.5, 11.2
 */

import type {
  ISnapshotStorage,
  ITimeSeriesIndexStorage,
} from '../../../types/storageInterfaces.js'
import type { TimeSeriesDataPoint } from '../../../types/precomputedAnalytics.js'
import type { DistrictStatistics } from '../../../types/districts.js'
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
 * Handles analytics generation backfill operations by processing existing
 * snapshots and generating time-series index data for each district.
 *
 * @example
 * ```typescript
 * const generator = new AnalyticsGenerator(snapshotStorage, timeSeriesStorage)
 *
 * // Preview what would be generated
 * const preview = await generator.previewGeneration('2024-01-01', '2024-01-31')
 *
 * // Generate analytics with progress callback
 * const result = await generator.generateForSnapshots(
 *   ['2024-01-15', '2024-01-16'],
 *   (progress) => console.log(`${progress.percentComplete}% complete`)
 * )
 * ```
 */
export class AnalyticsGenerator {
  private readonly snapshotStorage: ISnapshotStorage
  private readonly timeSeriesStorage: ITimeSeriesIndexStorage
  private readonly preComputedAnalyticsService: PreComputedAnalyticsService

  /**
   * Flag to track if generation should be cancelled
   */
  private cancelled = false

  /**
   * Creates a new AnalyticsGenerator instance
   *
   * @param snapshotStorage - Storage for snapshot operations
   * @param timeSeriesStorage - Storage for time-series index operations
   * @param preComputedAnalyticsService - Service for computing and storing pre-computed analytics
   */
  constructor(
    snapshotStorage: ISnapshotStorage,
    timeSeriesStorage: ITimeSeriesIndexStorage,
    preComputedAnalyticsService: PreComputedAnalyticsService
  ) {
    this.snapshotStorage = snapshotStorage
    this.timeSeriesStorage = timeSeriesStorage
    this.preComputedAnalyticsService = preComputedAnalyticsService

    logger.debug('AnalyticsGenerator initialized', {
      component: 'AnalyticsGenerator',
    })
  }

  // ============================================================================
  // Public Methods
  // ============================================================================

  /**
   * Generate analytics for specified snapshots
   *
   * Processes each snapshot, extracting district data and generating
   * time-series index entries. Supports cancellation and progress reporting.
   *
   * @param snapshotIds - Array of snapshot IDs to process
   * @param progressCallback - Callback for progress updates
   * @returns Generation result
   *
   * Requirements: 2.3, 4.2
   */
  async generateForSnapshots(
    snapshotIds: string[],
    progressCallback: (progress: GenerationProgress) => void
  ): Promise<GenerationResult> {
    const startTime = Date.now()
    this.cancelled = false

    const totalItems = snapshotIds.length

    logger.info('Starting analytics generation', {
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

    // Process each snapshot
    for (const snapshotId of snapshotIds) {
      // Check for cancellation
      if (this.cancelled) {
        logger.info('Analytics generation cancelled', {
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
        // Process the snapshot
        const result = await this.processSnapshot(snapshotId)

        if (result.success) {
          processedItems++
          processedSnapshotIds.push(snapshotId)

          logger.debug('Successfully generated analytics for snapshot', {
            snapshotId,
            districtsProcessed: result.districtsProcessed,
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
            message:
              result.error ?? 'Unknown error during analytics generation',
            occurredAt: new Date().toISOString(),
            isRetryable: result.isRetryable ?? true,
          })

          logger.warn('Failed to generate analytics for snapshot', {
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

        logger.error('Error generating analytics for snapshot', {
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

    logger.info('Analytics generation completed', {
      processedItems,
      failedItems,
      skippedItems,
      duration,
      cancelled: this.cancelled,
      component: 'AnalyticsGenerator',
      operation: 'generateForSnapshots',
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
    logger.info('Analytics generation cancellation requested', {
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
   * Process a single snapshot and generate time-series data
   *
   * @param snapshotId - The snapshot ID to process
   * @returns Processing result
   */
  private async processSnapshot(snapshotId: string): Promise<{
    success: boolean
    skipped?: boolean
    reason?: string
    error?: string
    isRetryable?: boolean
    districtsProcessed?: number
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

    let districtsProcessed = 0
    const districtErrors: string[] = []
    const collectedDistrictData: DistrictStatistics[] = []

    // Process each district
    for (const districtId of districtIds) {
      try {
        // Read district data
        const districtData = await this.snapshotStorage.readDistrictData(
          snapshotId,
          districtId
        )

        if (districtData === null) {
          logger.warn('District data not found', {
            snapshotId,
            districtId,
            component: 'AnalyticsGenerator',
            operation: 'processSnapshot',
          })
          continue
        }

        // Collect district data for pre-computed analytics generation
        collectedDistrictData.push(districtData)

        // Build time-series data point from district data
        const dataPoint = this.buildTimeSeriesDataPoint(
          snapshotId,
          districtData
        )

        // Append to time-series index
        await this.timeSeriesStorage.appendDataPoint(districtId, dataPoint)

        districtsProcessed++
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error'
        districtErrors.push(`${districtId}: ${errorMessage}`)

        logger.warn('Failed to process district', {
          snapshotId,
          districtId,
          error: errorMessage,
          component: 'AnalyticsGenerator',
          operation: 'processSnapshot',
        })
      }
    }

    // Consider success if at least one district was processed
    if (districtsProcessed > 0) {
      // Generate pre-computed analytics for this snapshot
      // Requirements: 2.1, 2.3 - Generate analytics AFTER successfully reading district data
      await this.generatePreComputedAnalytics(snapshotId, collectedDistrictData)

      return {
        success: true,
        districtsProcessed,
      }
    }

    return {
      success: false,
      error: `Failed to process any districts. Errors: ${districtErrors.join('; ')}`,
      isRetryable: true,
    }
  }

  /**
   * Generate pre-computed analytics for a snapshot
   *
   * Calls PreComputedAnalyticsService.computeAndStore() to generate the
   * analytics-summary.json file. Errors are logged but do not fail the
   * snapshot processing.
   *
   * @param snapshotId - The snapshot ID to generate analytics for
   * @param districtData - Array of district statistics
   *
   * Requirements: 2.1, 2.2
   */
  private async generatePreComputedAnalytics(
    snapshotId: string,
    districtData: DistrictStatistics[]
  ): Promise<void> {
    try {
      await this.preComputedAnalyticsService.computeAndStore(
        snapshotId,
        districtData
      )
      logger.debug('Generated pre-computed analytics for snapshot', {
        snapshotId,
        districtCount: districtData.length,
        component: 'AnalyticsGenerator',
        operation: 'generatePreComputedAnalytics',
      })
    } catch (error) {
      // Log error but don't fail the snapshot processing
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.warn('Failed to generate pre-computed analytics for snapshot', {
        snapshotId,
        error: errorMessage,
        component: 'AnalyticsGenerator',
        operation: 'generatePreComputedAnalytics',
      })
    }
  }

  /**
   * Build a TimeSeriesDataPoint from district statistics
   *
   * @param snapshotId - The snapshot ID
   * @param districtData - The district statistics
   * @returns Time-series data point
   */
  private buildTimeSeriesDataPoint(
    snapshotId: string,
    districtData: {
      asOfDate: string
      membership?: { total?: number }
      clubPerformance?: Array<
        Record<string, string | number | null | undefined>
      >
    }
  ): TimeSeriesDataPoint {
    // Calculate total membership
    const totalMembership = this.calculateTotalMembership(districtData)

    // Calculate total payments
    const payments = this.calculateTotalPayments(districtData)

    // Calculate total DCP goals
    const dcpGoals = this.calculateTotalDCPGoals(districtData)

    // Calculate club health counts
    const clubCounts = this.calculateClubHealthCounts(districtData)

    // Calculate distinguished clubs total
    const distinguishedTotal = this.calculateDistinguishedTotal(districtData)

    return {
      date: districtData.asOfDate,
      snapshotId,
      membership: totalMembership,
      payments,
      dcpGoals,
      distinguishedTotal,
      clubCounts,
    }
  }

  /**
   * Calculate total membership from district statistics
   */
  private calculateTotalMembership(district: {
    membership?: { total?: number }
    clubPerformance?: Array<Record<string, string | number | null | undefined>>
  }): number {
    // Primary: Use membership.total if available
    if (district.membership?.total !== undefined) {
      return district.membership.total
    }

    // Fallback: Sum from club performance data
    if (
      district.clubPerformance !== undefined &&
      district.clubPerformance.length > 0
    ) {
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
   * Calculate total membership payments from district data
   */
  private calculateTotalPayments(district: {
    clubPerformance?: Array<Record<string, string | number | null | undefined>>
  }): number {
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
   * Calculate total DCP goals achieved across all clubs
   */
  private calculateTotalDCPGoals(district: {
    clubPerformance?: Array<Record<string, string | number | null | undefined>>
  }): number {
    const clubs = district.clubPerformance ?? []

    return clubs.reduce((total, club) => {
      const goals = this.parseIntSafe(club['Goals Met'])
      return total + goals
    }, 0)
  }

  /**
   * Calculate club health counts
   */
  private calculateClubHealthCounts(district: {
    clubPerformance?: Array<Record<string, string | number | null | undefined>>
  }): {
    total: number
    thriving: number
    vulnerable: number
    interventionRequired: number
  } {
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

      // Classification rules:
      // 1. Intervention Required: membership < 12 AND net growth < 3
      // 2. Thriving: membership requirement met AND DCP checkpoint met
      // 3. Vulnerable: any requirement not met (but not intervention)

      if (membership < 12 && netGrowth < 3) {
        interventionRequired++
      } else {
        // Membership requirement: >= 20 OR net growth >= 3
        const membershipRequirementMet = membership >= 20 || netGrowth >= 3

        // DCP checkpoint: simplified check (dcpGoals > 0)
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
   * Calculate total distinguished clubs
   */
  private calculateDistinguishedTotal(district: {
    clubPerformance?: Array<Record<string, string | number | null | undefined>>
  }): number {
    const clubs = district.clubPerformance ?? []

    let distinguishedCount = 0

    for (const club of clubs) {
      if (this.isDistinguished(club)) {
        distinguishedCount++
      }
    }

    return distinguishedCount
  }

  /**
   * Check if a club is distinguished
   */
  private isDistinguished(
    club: Record<string, string | number | null | undefined>
  ): boolean {
    // Check CSP status first (required for 2025-2026+)
    const cspSubmitted = this.getCSPStatus(club)
    if (!cspSubmitted) {
      return false
    }

    // Check Club Distinguished Status field
    const statusField = club['Club Distinguished Status']
    if (this.hasDistinguishedStatus(statusField)) {
      return true
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
   * Check if status field indicates distinguished
   */
  private hasDistinguishedStatus(
    statusField: string | number | null | undefined
  ): boolean {
    if (statusField === null || statusField === undefined) {
      return false
    }

    const status = String(statusField).toLowerCase().trim()

    if (status === '' || status === 'none' || status === 'n/a') {
      return false
    }

    return (
      status.includes('smedley') ||
      status.includes('president') ||
      status.includes('select') ||
      status.includes('distinguished')
    )
  }

  /**
   * Get CSP (Club Success Plan) submission status from club data
   */
  private getCSPStatus(
    club: Record<string, string | number | null | undefined>
  ): boolean {
    const cspValue =
      club['CSP'] ??
      club['Club Success Plan'] ??
      club['CSP Submitted'] ??
      club['Club Success Plan Submitted']

    // Historical data compatibility: if field doesn't exist, assume submitted
    if (cspValue === undefined || cspValue === null) {
      return true
    }

    const cspString = String(cspValue).toLowerCase().trim()

    if (
      cspString === 'yes' ||
      cspString === 'true' ||
      cspString === '1' ||
      cspString === 'submitted' ||
      cspString === 'y'
    ) {
      return true
    }

    if (
      cspString === 'no' ||
      cspString === 'false' ||
      cspString === '0' ||
      cspString === 'not submitted' ||
      cspString === 'n'
    ) {
      return false
    }

    // Default to true for unknown values
    return true
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
