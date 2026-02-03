/**
 * PreComputedAnalyticsService
 *
 * This service reads pre-computed analytics summaries from storage.
 * Analytics are computed by scraper-cli's `compute-analytics` command.
 *
 * Per the data-computation-separation steering document:
 * - The backend MUST NOT perform any on-demand data computation
 * - All computation happens in scraper-cli
 * - This service only reads pre-computed files
 *
 * Migration path:
 * 1. Run `scraper-cli compute-analytics` to generate full analytics
 * 2. Backend serves from analytics/ directory (full DistrictAnalytics data)
 * 3. analytics-summary.json is retained for backward compatibility only
 */

import fs from 'fs/promises'
import path from 'path'
import { logger } from '../utils/logger.js'
import type {
  PreComputedAnalyticsSummary,
  AnalyticsSummaryFile,
} from '../types/precomputedAnalytics.js'

/**
 * Configuration for PreComputedAnalyticsService
 */
export interface PreComputedAnalyticsServiceConfig {
  /** Base directory for snapshot storage */
  snapshotsDir: string
}

/**
 * Service for reading pre-computed analytics summaries.
 *
 * This service is READ-ONLY. All analytics computation is performed by
 * scraper-cli's compute-analytics command.
 *
 * Per the data-computation-separation steering document:
 * - The backend has a computation budget of 0ms for data computation
 * - All computation happens in scraper-cli
 */
export class PreComputedAnalyticsService {
  private readonly snapshotsDir: string

  constructor(config: PreComputedAnalyticsServiceConfig) {
    this.snapshotsDir = config.snapshotsDir
  }

  /**
   * Get pre-computed analytics for a specific district in a snapshot
   *
   * @param districtId - The district ID to retrieve analytics for
   * @param snapshotId - The snapshot ID (date string)
   * @returns Pre-computed analytics summary or null if not found
   */
  async getAnalyticsSummary(
    districtId: string,
    snapshotId: string
  ): Promise<PreComputedAnalyticsSummary | null> {
    try {
      const summaryFile = await this.readAnalyticsSummaryFile(snapshotId)

      if (!summaryFile) {
        logger.debug('Analytics summary file not found', {
          operation: 'getAnalyticsSummary',
          snapshotId,
          districtId,
        })
        return null
      }

      const districtSummary = summaryFile.districts[districtId]

      if (!districtSummary) {
        logger.debug('District not found in analytics summary', {
          operation: 'getAnalyticsSummary',
          snapshotId,
          districtId,
          availableDistricts: Object.keys(summaryFile.districts).length,
        })
        return null
      }

      return districtSummary
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to get analytics summary', {
        operation: 'getAnalyticsSummary',
        snapshotId,
        districtId,
        error: errorMessage,
      })
      return null
    }
  }

  /**
   * Get the latest analytics summary for a district
   *
   * Finds the most recent snapshot and returns the analytics summary
   * for the specified district.
   *
   * @param districtId - The district ID to retrieve analytics for
   * @returns Pre-computed analytics summary or null if not found
   */
  async getLatestSummary(
    districtId: string
  ): Promise<PreComputedAnalyticsSummary | null> {
    try {
      // Find the latest snapshot with analytics
      const latestSnapshotId = await this.findLatestSnapshotWithAnalytics()

      if (!latestSnapshotId) {
        logger.debug('No snapshots with analytics found', {
          operation: 'getLatestSummary',
          districtId,
        })
        return null
      }

      return this.getAnalyticsSummary(districtId, latestSnapshotId)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to get latest analytics summary', {
        operation: 'getLatestSummary',
        districtId,
        error: errorMessage,
      })
      return null
    }
  }

  // ========== Private File I/O Methods ==========

  /**
   * Read analytics summary file from snapshot directory
   */
  private async readAnalyticsSummaryFile(
    snapshotId: string
  ): Promise<AnalyticsSummaryFile | null> {
    const filePath = path.join(
      this.snapshotsDir,
      snapshotId,
      'analytics-summary.json'
    )

    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const summaryFile: AnalyticsSummaryFile = JSON.parse(content)

      logger.debug('Read analytics summary file', {
        operation: 'readAnalyticsSummaryFile',
        snapshotId,
        filePath,
        districtCount: Object.keys(summaryFile.districts).length,
      })

      return summaryFile
    } catch (error) {
      if ((error as { code?: string }).code === 'ENOENT') {
        logger.debug('Analytics summary file not found', {
          operation: 'readAnalyticsSummaryFile',
          snapshotId,
          filePath,
        })
        return null
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to read analytics summary file', {
        operation: 'readAnalyticsSummaryFile',
        snapshotId,
        filePath,
        error: errorMessage,
      })
      throw new Error(`Failed to read analytics summary file: ${errorMessage}`)
    }
  }

  /**
   * Find the latest snapshot that has an analytics summary file
   */
  private async findLatestSnapshotWithAnalytics(): Promise<string | null> {
    try {
      // List all snapshot directories
      const entries = await fs.readdir(this.snapshotsDir, {
        withFileTypes: true,
      })

      // Filter to directories and sort by date (newest first)
      const snapshotDirs = entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name)
        .sort((a, b) => b.localeCompare(a))

      // Find the first snapshot with an analytics summary file
      for (const snapshotId of snapshotDirs) {
        const analyticsPath = path.join(
          this.snapshotsDir,
          snapshotId,
          'analytics-summary.json'
        )

        try {
          await fs.access(analyticsPath)
          return snapshotId
        } catch {
          // File doesn't exist, continue to next snapshot
          continue
        }
      }

      return null
    } catch (error) {
      if ((error as { code?: string }).code === 'ENOENT') {
        logger.debug('Snapshots directory not found', {
          operation: 'findLatestSnapshotWithAnalytics',
          snapshotsDir: this.snapshotsDir,
        })
        return null
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to find latest snapshot with analytics', {
        operation: 'findLatestSnapshotWithAnalytics',
        error: errorMessage,
      })
      throw error
    }
  }
}
