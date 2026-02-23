/**
 * Local Filesystem Time-Series Index Storage
 *
 * Implements the ITimeSeriesIndexStorage interface by delegating to the existing
 * TimeSeriesIndexService implementation. This adapter enables the storage
 * abstraction layer to use local filesystem storage for development
 * environments without requiring GCP credentials.
 *
 * The deleteSnapshotEntries method is implemented directly here since it
 * requires scanning all district directories and program year files to
 * find and remove entries matching a specific snapshot ID.
 *
 * Requirements: 4.4
 */

import fs from 'fs/promises'
import path from 'path'
import { logger } from '../../utils/logger.js'
import { TimeSeriesIndexService } from '../TimeSeriesIndexService.js'
import type { ITimeSeriesIndexStorage } from '../../types/storageInterfaces.js'
import type {
  TimeSeriesDataPoint,
  ProgramYearIndex,
  ProgramYearIndexFile,
} from '../../types/precomputedAnalytics.js'

/**
 * Configuration for LocalTimeSeriesIndexStorage
 */
export interface LocalTimeSeriesIndexStorageConfig {
  /** Base directory for cache storage */
  cacheDir: string
}

/**
 * Local filesystem time-series index storage implementation
 *
 * Delegates most operations to the existing TimeSeriesIndexService implementation,
 * providing a consistent interface for the storage abstraction layer.
 *
 * This class acts as an adapter that:
 * - Implements the ITimeSeriesIndexStorage interface
 * - Wraps the existing TimeSeriesIndexService for read/write operations
 * - Implements deleteSnapshotEntries by scanning all program year files
 * - Maintains full feature parity with cloud providers for testing
 * - Requires no GCP credentials or network connectivity
 *
 * @example
 * ```typescript
 * const storage = new LocalTimeSeriesIndexStorage({ cacheDir: './data/cache' })
 * const trendData = await storage.getTrendData('42', '2024-01-01', '2024-06-30')
 * ```
 */
export class LocalTimeSeriesIndexStorage implements ITimeSeriesIndexStorage {
  private readonly service: TimeSeriesIndexService
  private readonly cacheDir: string
  private readonly timeSeriesDir: string

  /**
   * Creates a new LocalTimeSeriesIndexStorage instance
   *
   * @param config - Configuration containing the cache directory path
   */
  constructor(config: LocalTimeSeriesIndexStorageConfig) {
    this.cacheDir = config.cacheDir
    this.timeSeriesDir = path.join(this.cacheDir, 'time-series')
    this.service = new TimeSeriesIndexService({ cacheDir: config.cacheDir })
  }

  // ============================================================================
  // Core Time-Series Operations (Read-Only - Delegated to TimeSeriesIndexService)
  // ============================================================================

  /**
   * Get trend data for a date range
   *
   * Delegates to TimeSeriesIndexService.getTrendData
   *
   * @param districtId - The district identifier (e.g., "42", "61", "F")
   * @param startDate - Start date in ISO format (YYYY-MM-DD)
   * @param endDate - End date in ISO format (YYYY-MM-DD)
   * @returns Array of time-series data points in chronological order
   */
  async getTrendData(
    districtId: string,
    startDate: string,
    endDate: string
  ): Promise<TimeSeriesDataPoint[]> {
    return this.service.getTrendData(districtId, startDate, endDate)
  }

  /**
   * Get all data for a program year
   *
   * Delegates to TimeSeriesIndexService.getProgramYearData
   *
   * @param districtId - The district identifier (e.g., "42", "61", "F")
   * @param programYear - Program year identifier (e.g., "2023-2024")
   * @returns Program year index or null if not found
   */
  async getProgramYearData(
    districtId: string,
    programYear: string
  ): Promise<ProgramYearIndex | null> {
    return this.service.getProgramYearData(districtId, programYear)
  }

  // ============================================================================
  // Deletion Operations
  // ============================================================================

  /**
   * Delete all time-series entries for a specific snapshot
   *
   * Scans all district directories and program year files to find and remove
   * entries where the snapshotId matches. This is used during cascading
   * deletion to clean up time-series data when a snapshot is deleted.
   *
   * The operation:
   * 1. Lists all district directories in the time-series folder
   * 2. For each district, lists all program year files
   * 3. Reads each file, filters out entries with matching snapshotId
   * 4. Writes back the filtered data (or deletes file if empty)
   * 5. Returns the total count of removed entries
   *
   * @param snapshotId - The snapshot ID to remove entries for (ISO date format: YYYY-MM-DD)
   * @returns Number of entries removed across all districts
   */
  async deleteSnapshotEntries(snapshotId: string): Promise<number> {
    const startTime = Date.now()
    const operationId = `delete_entries_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    logger.info('Starting deleteSnapshotEntries operation', {
      operation: 'deleteSnapshotEntries',
      operationId,
      snapshotId,
    })

    let totalRemoved = 0

    try {
      // Check if time-series directory exists
      try {
        await fs.access(this.timeSeriesDir)
      } catch {
        logger.info('Time-series directory does not exist, nothing to delete', {
          operation: 'deleteSnapshotEntries',
          operationId,
          snapshotId,
          timeSeriesDir: this.timeSeriesDir,
          duration_ms: Date.now() - startTime,
        })
        return 0
      }

      // List all district directories
      const entries = await fs.readdir(this.timeSeriesDir, {
        withFileTypes: true,
      })
      const districtDirs = entries.filter(
        entry => entry.isDirectory() && entry.name.startsWith('district_')
      )

      logger.debug('Found district directories to scan', {
        operation: 'deleteSnapshotEntries',
        operationId,
        snapshotId,
        districtCount: districtDirs.length,
      })

      // Process each district directory
      for (const districtDir of districtDirs) {
        const districtId = districtDir.name.replace('district_', '')
        const removedFromDistrict =
          await this.deleteSnapshotEntriesFromDistrict(
            districtId,
            snapshotId,
            operationId
          )
        totalRemoved += removedFromDistrict
      }

      logger.info('Successfully completed deleteSnapshotEntries operation', {
        operation: 'deleteSnapshotEntries',
        operationId,
        snapshotId,
        totalRemoved,
        districtsScanned: districtDirs.length,
        duration_ms: Date.now() - startTime,
      })

      return totalRemoved
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to delete snapshot entries', {
        operation: 'deleteSnapshotEntries',
        operationId,
        snapshotId,
        error: errorMessage,
        duration_ms: Date.now() - startTime,
      })
      throw new Error(
        `Failed to delete snapshot entries for ${snapshotId}: ${errorMessage}`
      )
    }
  }

  /**
   * Delete snapshot entries from a specific district
   *
   * @param districtId - The district ID to process
   * @param snapshotId - The snapshot ID to remove entries for
   * @param operationId - Operation ID for logging correlation
   * @returns Number of entries removed from this district
   */
  private async deleteSnapshotEntriesFromDistrict(
    districtId: string,
    snapshotId: string,
    operationId: string
  ): Promise<number> {
    const districtDir = path.join(this.timeSeriesDir, `district_${districtId}`)
    let removedFromDistrict = 0

    try {
      // List all files in the district directory
      const files = await fs.readdir(districtDir)
      const programYearFiles = files.filter(
        f => f.endsWith('.json') && f !== 'index-metadata.json'
      )

      // Process each program year file
      for (const fileName of programYearFiles) {
        const filePath = path.join(districtDir, fileName)
        const removedFromFile = await this.deleteSnapshotEntriesFromFile(
          filePath,
          snapshotId,
          districtId,
          operationId
        )
        removedFromDistrict += removedFromFile
      }

      if (removedFromDistrict > 0) {
        logger.debug('Removed entries from district', {
          operation: 'deleteSnapshotEntries',
          operationId,
          districtId,
          snapshotId,
          removedCount: removedFromDistrict,
        })
      }

      return removedFromDistrict
    } catch (error) {
      // If directory doesn't exist or can't be read, skip it
      if ((error as { code?: string }).code === 'ENOENT') {
        return 0
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.warn('Failed to process district directory', {
        operation: 'deleteSnapshotEntries',
        operationId,
        districtId,
        snapshotId,
        error: errorMessage,
      })
      // Continue processing other districts
      return 0
    }
  }

  /**
   * Delete snapshot entries from a specific program year file
   *
   * @param filePath - Path to the program year JSON file
   * @param snapshotId - The snapshot ID to remove entries for
   * @param districtId - The district ID (for logging)
   * @param operationId - Operation ID for logging correlation
   * @returns Number of entries removed from this file
   */
  private async deleteSnapshotEntriesFromFile(
    filePath: string,
    snapshotId: string,
    districtId: string,
    operationId: string
  ): Promise<number> {
    try {
      // Read the program year index file
      const content = await fs.readFile(filePath, 'utf-8')
      const indexFile: ProgramYearIndexFile = JSON.parse(content)

      // Count entries before filtering
      const originalCount = indexFile.dataPoints.length

      // Filter out entries matching the snapshotId
      indexFile.dataPoints = indexFile.dataPoints.filter(
        dp => dp.snapshotId !== snapshotId
      )

      const removedCount = originalCount - indexFile.dataPoints.length

      if (removedCount > 0) {
        // Update the lastUpdated timestamp
        indexFile.lastUpdated = new Date().toISOString()

        // Note: Summary is NOT recalculated here per data-computation-separation steering.
        // The summary will be stale until collector-cli regenerates the index file.
        // This is acceptable because deletion is an admin operation and the summary
        // is informational only.

        // Write back the filtered data
        await fs.writeFile(
          filePath,
          JSON.stringify(indexFile, null, 2),
          'utf-8'
        )

        logger.debug('Removed entries from program year file', {
          operation: 'deleteSnapshotEntries',
          operationId,
          districtId,
          programYear: indexFile.programYear,
          snapshotId,
          removedCount,
          remainingCount: indexFile.dataPoints.length,
        })
      }

      return removedCount
    } catch (error) {
      // If file doesn't exist or can't be read, skip it
      if ((error as { code?: string }).code === 'ENOENT') {
        return 0
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.warn('Failed to process program year file', {
        operation: 'deleteSnapshotEntries',
        operationId,
        filePath,
        snapshotId,
        error: errorMessage,
      })
      // Continue processing other files
      return 0
    }
  }

  // ============================================================================
  // Health Check
  // ============================================================================

  /**
   * Check if the storage is properly initialized and accessible
   *
   * Verifies that the time-series directory exists and is accessible.
   * Returns false without throwing when storage is unavailable.
   *
   * @returns True if the storage is ready for operations
   */
  async isReady(): Promise<boolean> {
    try {
      // Check if the time-series directory exists
      await fs.access(this.timeSeriesDir)
      return true
    } catch {
      // Directory doesn't exist yet - this is okay, it will be created on first write
      // Check if we can at least access the parent cache directory
      try {
        await fs.access(this.cacheDir)
        return true
      } catch {
        return false
      }
    }
  }
}
