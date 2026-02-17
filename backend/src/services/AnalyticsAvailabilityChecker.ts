/**
 * AnalyticsAvailabilityChecker
 *
 * Service for checking whether pre-computed analytics are available for snapshots.
 * This service checks for the existence of analytics-summary.json files within
 * snapshot directories.
 *
 * Requirements:
 * - 2.1: Snapshot list endpoint SHALL include a boolean field indicating analytics availability
 * - 2.2: Analytics availability check SHALL verify existence of analytics-summary.json file
 *
 * Design Notes:
 * - Uses filesystem access to check for analytics-summary.json files
 * - Handles file system errors gracefully (returns false, doesn't throw)
 * - Supports batch checking for efficient snapshot list operations
 * - Follows the storage abstraction pattern for consistency
 */

import fs from 'fs/promises'
import path from 'path'
import { logger } from '../utils/logger.js'

/**
 * Configuration for AnalyticsAvailabilityChecker
 */
export interface AnalyticsAvailabilityCheckerConfig {
  /** Base directory for snapshot storage */
  snapshotsDir: string
}

/**
 * Interface for analytics availability checking operations
 *
 * This interface defines the contract for checking whether pre-computed
 * analytics exist for snapshots.
 */
export interface IAnalyticsAvailabilityChecker {
  /**
   * Check if analytics-summary.json exists for a snapshot
   * @param snapshotId - The snapshot ID to check
   * @returns true if analytics exist, false otherwise
   */
  hasAnalytics(snapshotId: string): Promise<boolean>

  /**
   * Batch check analytics availability for multiple snapshots
   * @param snapshotIds - Array of snapshot IDs to check
   * @returns Map of snapshotId to availability status
   */
  checkBatch(snapshotIds: string[]): Promise<Map<string, boolean>>
}

/**
 * Service for checking pre-computed analytics availability.
 *
 * This service checks for the existence of analytics-summary.json files
 * within snapshot directories to determine if pre-computed analytics
 * are available.
 *
 * Requirements:
 * - 2.1: Provide boolean field indicating analytics availability
 * - 2.2: Verify existence of analytics-summary.json file
 */
export class AnalyticsAvailabilityChecker implements IAnalyticsAvailabilityChecker {
  private readonly snapshotsDir: string

  /**
   * Creates a new AnalyticsAvailabilityChecker instance
   *
   * @param config - Configuration containing the snapshots directory path
   */
  constructor(config: AnalyticsAvailabilityCheckerConfig) {
    this.snapshotsDir = config.snapshotsDir
  }

  /**
   * Check if analytics-summary.json exists for a snapshot
   *
   * Requirement 2.2: Verify existence of analytics-summary.json file
   *
   * @param snapshotId - The snapshot ID (date string, e.g., "2024-01-15")
   * @returns true if analytics exist, false otherwise (never throws)
   */
  async hasAnalytics(snapshotId: string): Promise<boolean> {
    try {
      // Validate snapshot ID format to prevent path traversal
      if (!this.isValidSnapshotId(snapshotId)) {
        logger.warn('Invalid snapshot ID format in hasAnalytics', {
          operation: 'hasAnalytics',
          snapshotId,
        })
        return false
      }

      const analyticsPath = path.join(
        this.snapshotsDir,
        snapshotId,
        'analytics-summary.json'
      )

      await fs.access(analyticsPath)

      logger.debug('Analytics file found for snapshot', {
        operation: 'hasAnalytics',
        snapshotId,
        analyticsPath,
      })

      return true
    } catch (error) {
      // Handle file not found - this is expected and not an error
      if ((error as { code?: string }).code === 'ENOENT') {
        logger.debug('Analytics file not found for snapshot', {
          operation: 'hasAnalytics',
          snapshotId,
        })
        return false
      }

      // Handle other file system errors gracefully
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.warn('Error checking analytics availability', {
        operation: 'hasAnalytics',
        snapshotId,
        error: errorMessage,
      })

      // Return false for any error - don't throw
      return false
    }
  }

  /**
   * Batch check analytics availability for multiple snapshots
   *
   * Efficiently checks analytics availability for multiple snapshots
   * in parallel. This is used by the snapshot list endpoint to avoid
   * N+1 query patterns.
   *
   * Requirement 2.4: Analytics availability check SHALL NOT significantly
   * impact snapshot list performance (under 100ms additional latency)
   *
   * @param snapshotIds - Array of snapshot IDs to check
   * @returns Map of snapshotId to availability status
   */
  async checkBatch(snapshotIds: string[]): Promise<Map<string, boolean>> {
    const startTime = Date.now()
    const results = new Map<string, boolean>()

    logger.debug('Starting batch analytics availability check', {
      operation: 'checkBatch',
      snapshotCount: snapshotIds.length,
    })

    // Check all snapshots in parallel for performance
    const checkPromises = snapshotIds.map(async snapshotId => {
      const hasAnalytics = await this.hasAnalytics(snapshotId)
      return { snapshotId, hasAnalytics }
    })

    const checkResults = await Promise.all(checkPromises)

    // Build the results map
    for (const { snapshotId, hasAnalytics } of checkResults) {
      results.set(snapshotId, hasAnalytics)
    }

    const duration = Date.now() - startTime
    const availableCount = Array.from(results.values()).filter(Boolean).length

    logger.debug('Completed batch analytics availability check', {
      operation: 'checkBatch',
      snapshotCount: snapshotIds.length,
      analyticsAvailableCount: availableCount,
      analyticsMissingCount: snapshotIds.length - availableCount,
      durationMs: duration,
    })

    return results
  }

  /**
   * Validate snapshot ID format to prevent path traversal attacks
   *
   * Valid snapshot IDs are ISO date strings (YYYY-MM-DD format)
   *
   * @param snapshotId - The snapshot ID to validate
   * @returns true if the snapshot ID is valid
   */
  private isValidSnapshotId(snapshotId: string): boolean {
    if (typeof snapshotId !== 'string' || snapshotId.length === 0) {
      return false
    }

    // Snapshot IDs should be ISO date format (YYYY-MM-DD)
    // This pattern prevents path traversal by rejecting special characters
    const SNAPSHOT_ID_PATTERN = /^\d{4}-\d{2}-\d{2}$/
    return SNAPSHOT_ID_PATTERN.test(snapshotId)
  }
}

/**
 * Factory function to create an AnalyticsAvailabilityChecker from a cache directory
 *
 * This follows the pattern used by other services in the codebase where
 * the snapshots directory is derived from the cache directory.
 *
 * @param cacheDir - The base cache directory
 * @returns A configured AnalyticsAvailabilityChecker instance
 */
export function createAnalyticsAvailabilityChecker(
  cacheDir: string
): AnalyticsAvailabilityChecker {
  const snapshotsDir = path.join(cacheDir, 'snapshots')
  return new AnalyticsAvailabilityChecker({ snapshotsDir })
}
