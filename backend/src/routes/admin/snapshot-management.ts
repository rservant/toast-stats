/**
 * Snapshot management routes for admin API - DELETE operations
 *
 * Provides endpoints for:
 * - Delete snapshots by IDs
 * - Delete snapshots in a date range
 * - Delete all snapshots (with optional district filter)
 *
 * All delete operations implement cascading deletion:
 * - Snapshot data files
 * - Associated pre-computed analytics (stored within snapshots)
 * - Associated time-series index entries
 *
 * This module uses storage abstractions for all data operations,
 * complying with the storage abstraction steering document.
 *
 * Requirements: 8.1, 8.2, 8.3, 5.1, 5.2, 5.3, 5.6, 5.7
 */

import { Router } from 'express'
import { logAdminAccess, generateOperationId } from './shared.js'
import { logger } from '../../utils/logger.js'
import { StorageProviderFactory } from '../../services/storage/StorageProviderFactory.js'
import type {
  ISnapshotStorage,
  ITimeSeriesIndexStorage,
} from '../../types/storageInterfaces.js'

export const snapshotManagementRouter = Router()

/**
 * Result of a snapshot deletion operation
 *
 * Updated to use storage abstraction terminology
 */
interface SnapshotDeletionResult {
  snapshotId: string
  success: boolean
  error?: string
  deletedFiles: {
    snapshotDeleted: boolean
    timeSeriesEntriesRemoved: number
  }
}

/**
 * Summary of a batch deletion operation
 */
interface DeletionSummary {
  totalRequested: number
  successfulDeletions: number
  failedDeletions: number
  totalTimeSeriesEntriesRemoved: number
  results: SnapshotDeletionResult[]
}

/**
 * Delete a single snapshot with cascading deletion
 *
 * Implements Property 11: Snapshot Deletion Cascade
 * - Deletes snapshot data via storage abstraction
 * - Removes time-series index entries for the deleted snapshot
 *
 * Note: Pre-computed analytics are stored within the snapshot and are
 * automatically deleted when the snapshot is deleted.
 *
 * Requirements: 5.2, 5.3, 6.1, 6.3, 6.4
 */
async function deleteSnapshotWithCascade(
  snapshotId: string,
  snapshotStorage: ISnapshotStorage,
  timeSeriesStorage: ITimeSeriesIndexStorage,
  operationId: string
): Promise<SnapshotDeletionResult> {
  const result: SnapshotDeletionResult = {
    snapshotId,
    success: false,
    deletedFiles: {
      snapshotDeleted: false,
      timeSeriesEntriesRemoved: 0,
    },
  }

  try {
    // 1. Get list of districts in the snapshot (for logging purposes)
    let districtCount = 0
    try {
      const districtIds =
        await snapshotStorage.listDistrictsInSnapshot(snapshotId)
      districtCount = districtIds.length
    } catch {
      logger.warn('Could not get district list for snapshot', {
        operation: 'deleteSnapshotWithCascade',
        operationId,
        snapshotId,
      })
    }

    // 2. Delete time-series index entries for this snapshot
    // Handle failures gracefully - log and continue with snapshot deletion
    try {
      const entriesRemoved =
        await timeSeriesStorage.deleteSnapshotEntries(snapshotId)
      result.deletedFiles.timeSeriesEntriesRemoved = entriesRemoved

      if (entriesRemoved > 0) {
        logger.debug('Removed time-series entries for snapshot', {
          operation: 'deleteSnapshotWithCascade',
          operationId,
          snapshotId,
          entriesRemoved,
        })
      }
    } catch (error) {
      // Log warning but continue with snapshot deletion
      logger.warn('Failed to clean up time-series entries', {
        operation: 'deleteSnapshotWithCascade',
        operationId,
        snapshotId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      // Continue with snapshot deletion even if time-series cleanup fails
    }

    // 3. Delete the snapshot via storage abstraction
    // This also deletes any analytics-summary.json stored within the snapshot
    const deleted = await snapshotStorage.deleteSnapshot(snapshotId)

    if (!deleted) {
      result.error = `Snapshot ${snapshotId} not found`
      logger.warn('Snapshot not found for deletion', {
        operation: 'deleteSnapshotWithCascade',
        operationId,
        snapshotId,
      })
      return result
    }

    result.deletedFiles.snapshotDeleted = true
    result.success = true

    logger.info('Successfully deleted snapshot with cascade', {
      operation: 'deleteSnapshotWithCascade',
      operationId,
      snapshotId,
      districtCount,
      timeSeriesEntriesRemoved: result.deletedFiles.timeSeriesEntriesRemoved,
    })

    return result
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    result.error = errorMessage

    logger.error('Failed to delete snapshot', {
      operation: 'deleteSnapshotWithCascade',
      operationId,
      snapshotId,
      error: errorMessage,
    })

    return result
  }
}

/**
 * DELETE /api/admin/snapshots
 * Delete snapshots by array of IDs
 *
 * Request Body:
 * - snapshotIds: string[] - Array of snapshot IDs to delete
 *
 * Requirements: 5.6, 8.1, 8.3
 */
snapshotManagementRouter.delete(
  '/snapshots',
  logAdminAccess,
  async (req, res): Promise<void> => {
    const startTime = Date.now()
    const operationId = generateOperationId('delete_snapshots')

    logger.info('Admin snapshot deletion requested', {
      operation: 'deleteSnapshots',
      operationId,
      ip: req.ip,
    })

    try {
      // Validate request body
      const body = req.body as { snapshotIds?: unknown }
      const snapshotIds = body.snapshotIds

      if (!Array.isArray(snapshotIds)) {
        res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'snapshotIds must be an array of strings',
          },
        })
        return
      }

      if (snapshotIds.length === 0) {
        res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'snapshotIds array cannot be empty',
          },
        })
        return
      }

      // Validate all IDs are strings
      const invalidIds = snapshotIds.filter(id => typeof id !== 'string')
      if (invalidIds.length > 0) {
        res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'All snapshotIds must be strings',
          },
        })
        return
      }

      // Get storage providers from factory
      const { snapshotStorage, timeSeriesIndexStorage } =
        StorageProviderFactory.createFromEnvironment()

      const results: SnapshotDeletionResult[] = []

      // Delete each snapshot with cascading
      for (const snapshotId of snapshotIds as string[]) {
        const result = await deleteSnapshotWithCascade(
          snapshotId,
          snapshotStorage,
          timeSeriesIndexStorage,
          operationId
        )
        results.push(result)
      }

      const summary: DeletionSummary = {
        totalRequested: snapshotIds.length,
        successfulDeletions: results.filter(r => r.success).length,
        failedDeletions: results.filter(r => !r.success).length,
        totalTimeSeriesEntriesRemoved: results.reduce(
          (sum, r) => sum + r.deletedFiles.timeSeriesEntriesRemoved,
          0
        ),
        results,
      }

      const duration = Date.now() - startTime

      logger.info('Admin snapshot deletion completed', {
        operation: 'deleteSnapshots',
        operationId,
        totalRequested: summary.totalRequested,
        successfulDeletions: summary.successfulDeletions,
        failedDeletions: summary.failedDeletions,
        totalTimeSeriesEntriesRemoved: summary.totalTimeSeriesEntriesRemoved,
        durationMs: duration,
      })

      res.json({
        summary,
        metadata: {
          operationId,
          durationMs: duration,
          completedAt: new Date().toISOString(),
        },
      })
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      logger.error('Admin snapshot deletion failed', {
        operation: 'deleteSnapshots',
        operationId,
        error: errorMessage,
        durationMs: duration,
      })

      res.status(500).json({
        error: {
          code: 'DELETION_FAILED',
          message: 'Failed to delete snapshots',
          details: errorMessage,
        },
      })
    }
  }
)

/**
 * DELETE /api/admin/snapshots/range
 * Delete snapshots within a date range
 *
 * Request Body:
 * - startDate: string - Start date (inclusive, YYYY-MM-DD format)
 * - endDate: string - End date (inclusive, YYYY-MM-DD format)
 *
 * Requirements: 5.7, 8.2, 8.3
 */
snapshotManagementRouter.delete(
  '/snapshots/range',
  logAdminAccess,
  async (req, res): Promise<void> => {
    const startTime = Date.now()
    const operationId = generateOperationId('delete_snapshots_range')

    logger.info('Admin snapshot range deletion requested', {
      operation: 'deleteSnapshotsRange',
      operationId,
      ip: req.ip,
    })

    try {
      // Validate request body
      const body = req.body as { startDate?: unknown; endDate?: unknown }
      const { startDate, endDate } = body

      if (typeof startDate !== 'string' || typeof endDate !== 'string') {
        res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message:
              'startDate and endDate must be strings in YYYY-MM-DD format',
          },
        })
        return
      }

      // Validate date format (YYYY-MM-DD)
      const datePattern = /^\d{4}-\d{2}-\d{2}$/
      if (!datePattern.test(startDate) || !datePattern.test(endDate)) {
        res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Dates must be in YYYY-MM-DD format',
          },
        })
        return
      }

      // Validate date range
      if (startDate > endDate) {
        res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'startDate must be before or equal to endDate',
          },
        })
        return
      }

      // Get storage providers from factory
      const { snapshotStorage, timeSeriesIndexStorage } =
        StorageProviderFactory.createFromEnvironment()

      // Get all snapshots and filter by snapshot_id (which is the date)
      // Note: We don't use created_after/created_before filters because those
      // filter by created_at timestamp, not by snapshot_id date
      const snapshotMetadataList = await snapshotStorage.listSnapshots()

      // Extract snapshot IDs and filter by date pattern and range
      // The snapshot_id is the date (YYYY-MM-DD format)
      const snapshotIds = snapshotMetadataList
        .map(meta => meta.snapshot_id)
        .filter(id => datePattern.test(id))
        .filter(id => id >= startDate && id <= endDate)
        .sort()

      logger.info('Found snapshots in date range', {
        operation: 'deleteSnapshotsRange',
        operationId,
        startDate,
        endDate,
        snapshotCount: snapshotIds.length,
      })

      const results: SnapshotDeletionResult[] = []

      // Delete each snapshot with cascading
      for (const snapshotId of snapshotIds) {
        const result = await deleteSnapshotWithCascade(
          snapshotId,
          snapshotStorage,
          timeSeriesIndexStorage,
          operationId
        )
        results.push(result)
      }

      const summary: DeletionSummary = {
        totalRequested: snapshotIds.length,
        successfulDeletions: results.filter(r => r.success).length,
        failedDeletions: results.filter(r => !r.success).length,
        totalTimeSeriesEntriesRemoved: results.reduce(
          (sum, r) => sum + r.deletedFiles.timeSeriesEntriesRemoved,
          0
        ),
        results,
      }

      const duration = Date.now() - startTime

      logger.info('Admin snapshot range deletion completed', {
        operation: 'deleteSnapshotsRange',
        operationId,
        startDate,
        endDate,
        totalRequested: summary.totalRequested,
        successfulDeletions: summary.successfulDeletions,
        failedDeletions: summary.failedDeletions,
        totalTimeSeriesEntriesRemoved: summary.totalTimeSeriesEntriesRemoved,
        durationMs: duration,
      })

      res.json({
        summary,
        dateRange: { startDate, endDate },
        metadata: {
          operationId,
          durationMs: duration,
          completedAt: new Date().toISOString(),
        },
      })
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      logger.error('Admin snapshot range deletion failed', {
        operation: 'deleteSnapshotsRange',
        operationId,
        error: errorMessage,
        durationMs: duration,
      })

      res.status(500).json({
        error: {
          code: 'DELETION_FAILED',
          message: 'Failed to delete snapshots in range',
          details: errorMessage,
        },
      })
    }
  }
)

/**
 * DELETE /api/admin/snapshots/all
 * Delete all snapshots (with optional districtId filter)
 *
 * Request Body (optional):
 * - districtId: string - If provided, only delete data for this district
 *
 * Note: District-specific deletion is a more complex operation that requires
 * iterating through all snapshots. This is handled via the storage abstraction
 * but may be slower than full snapshot deletion.
 *
 * Requirements: 5.2, 8.1, 8.3
 */
snapshotManagementRouter.delete(
  '/snapshots/all',
  logAdminAccess,
  async (req, res): Promise<void> => {
    const startTime = Date.now()
    const operationId = generateOperationId('delete_all_snapshots')

    logger.info('Admin delete all snapshots requested', {
      operation: 'deleteAllSnapshots',
      operationId,
      ip: req.ip,
    })

    try {
      const body = req.body as { districtId?: unknown }
      const districtId =
        typeof body.districtId === 'string' ? body.districtId : undefined

      // Get storage providers from factory
      const { snapshotStorage, timeSeriesIndexStorage } =
        StorageProviderFactory.createFromEnvironment()

      // If districtId is provided, only delete data for that district
      if (districtId) {
        logger.info('Deleting data for specific district', {
          operation: 'deleteAllSnapshots',
          operationId,
          districtId,
        })

        // Validate district ID format (alphanumeric only)
        const districtIdPattern = /^[A-Za-z0-9]+$/
        if (!districtIdPattern.test(districtId)) {
          res.status(400).json({
            error: {
              code: 'INVALID_REQUEST',
              message: 'districtId must contain only alphanumeric characters',
            },
          })
          return
        }

        // District-specific deletion is not directly supported by the storage abstraction
        // This would require iterating through all snapshots and removing district data
        // For now, we return an error indicating this operation is not supported
        // via the storage abstraction layer
        //
        // Note: In the future, this could be implemented by:
        // 1. Listing all snapshots
        // 2. For each snapshot, removing the district data file
        // 3. Updating the manifest
        // 4. Deleting the district's time-series data
        //
        // However, this is a complex operation that may need to be handled
        // differently for local vs cloud storage.

        res.status(501).json({
          error: {
            code: 'NOT_IMPLEMENTED',
            message:
              'District-specific deletion is not yet supported via storage abstraction. Use full snapshot deletion instead.',
            details:
              'This operation requires iterating through all snapshots and modifying each one, which is not yet implemented in the storage abstraction layer.',
          },
        })
        return
      }

      // Delete ALL snapshots
      const datePattern = /^\d{4}-\d{2}-\d{2}$/

      // Use listSnapshots to get all snapshots
      const snapshotMetadataList = await snapshotStorage.listSnapshots()

      // Extract snapshot IDs that match the date pattern
      const snapshotIds = snapshotMetadataList
        .map(meta => meta.snapshot_id)
        .filter(id => datePattern.test(id))
        .sort()

      logger.info('Found all snapshots for deletion', {
        operation: 'deleteAllSnapshots',
        operationId,
        snapshotCount: snapshotIds.length,
      })

      const results: SnapshotDeletionResult[] = []

      // Delete each snapshot with cascading
      for (const snapshotId of snapshotIds) {
        const result = await deleteSnapshotWithCascade(
          snapshotId,
          snapshotStorage,
          timeSeriesIndexStorage,
          operationId
        )
        results.push(result)
      }

      const summary: DeletionSummary = {
        totalRequested: snapshotIds.length,
        successfulDeletions: results.filter(r => r.success).length,
        failedDeletions: results.filter(r => !r.success).length,
        totalTimeSeriesEntriesRemoved: results.reduce(
          (sum, r) => sum + r.deletedFiles.timeSeriesEntriesRemoved,
          0
        ),
        results,
      }

      const duration = Date.now() - startTime

      logger.info('Admin delete all snapshots completed', {
        operation: 'deleteAllSnapshots',
        operationId,
        totalRequested: summary.totalRequested,
        successfulDeletions: summary.successfulDeletions,
        failedDeletions: summary.failedDeletions,
        totalTimeSeriesEntriesRemoved: summary.totalTimeSeriesEntriesRemoved,
        durationMs: duration,
      })

      res.json({
        summary,
        metadata: {
          operationId,
          durationMs: duration,
          completedAt: new Date().toISOString(),
        },
      })
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      logger.error('Admin delete all snapshots failed', {
        operation: 'deleteAllSnapshots',
        operationId,
        error: errorMessage,
        durationMs: duration,
      })

      res.status(500).json({
        error: {
          code: 'DELETION_FAILED',
          message: 'Failed to delete all snapshots',
          details: errorMessage,
        },
      })
    }
  }
)
