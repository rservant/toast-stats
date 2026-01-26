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
 * - Associated pre-computed analytics
 * - Associated time-series index entries
 *
 * Requirements: 8.1, 8.2, 8.3
 */

import { Router } from 'express'
import fs from 'fs/promises'
import path from 'path'
import {
  logAdminAccess,
  generateOperationId,
  getServiceFactory,
} from './shared.js'
import { logger } from '../../utils/logger.js'
import type { ProgramYearIndexFile } from '../../types/precomputedAnalytics.js'

export const snapshotManagementRouter = Router()

/**
 * Result of a snapshot deletion operation
 */
interface SnapshotDeletionResult {
  snapshotId: string
  success: boolean
  error?: string
  deletedFiles: {
    snapshotDir: boolean
    analyticsFile: boolean
    timeSeriesEntries: number
  }
}

/**
 * Summary of a batch deletion operation
 */
interface DeletionSummary {
  totalRequested: number
  successfulDeletions: number
  failedDeletions: number
  results: SnapshotDeletionResult[]
}

/**
 * Get the cache directory from the service factory
 */
function getCacheDir(): string {
  const factory = getServiceFactory()
  const cacheConfig = factory.createCacheConfigService()
  return cacheConfig.getCacheDirectory()
}

/**
 * Get the program year for a given date
 * Toastmasters program years run from July 1 to June 30
 */
function getProgramYearForDate(dateStr: string): string {
  const parts = dateStr.split('-')
  const year = parseInt(parts[0] ?? '0', 10)
  const month = parseInt(parts[1] ?? '0', 10)

  if (month >= 7) {
    return `${year}-${year + 1}`
  } else {
    return `${year - 1}-${year}`
  }
}

/**
 * Delete a single snapshot with cascading deletion
 *
 * Implements Property 11: Snapshot Deletion Cascade
 * - Deletes snapshot data files
 * - Deletes associated pre-computed analytics
 * - Removes time-series index entries for the deleted snapshot
 *
 * Requirements: 8.3
 */
async function deleteSnapshotWithCascade(
  snapshotId: string,
  cacheDir: string,
  operationId: string
): Promise<SnapshotDeletionResult> {
  const result: SnapshotDeletionResult = {
    snapshotId,
    success: false,
    deletedFiles: {
      snapshotDir: false,
      analyticsFile: false,
      timeSeriesEntries: 0,
    },
  }

  try {
    const snapshotsDir = path.join(cacheDir, 'snapshots')
    const timeSeriesDir = path.join(cacheDir, 'time-series')
    const snapshotDir = path.join(snapshotsDir, snapshotId)

    // 1. Check if snapshot exists
    try {
      await fs.access(snapshotDir)
    } catch {
      result.error = `Snapshot ${snapshotId} not found`
      logger.warn('Snapshot not found for deletion', {
        operation: 'deleteSnapshotWithCascade',
        operationId,
        snapshotId,
      })
      return result
    }

    // 2. Read manifest to get list of districts (for time-series cleanup)
    let districtIds: string[] = []
    try {
      const manifestPath = path.join(snapshotDir, 'manifest.json')
      const manifestContent = await fs.readFile(manifestPath, 'utf-8')
      const manifest = JSON.parse(manifestContent) as {
        districts: Array<{ districtId: string }>
      }
      districtIds = manifest.districts.map(d => d.districtId)
    } catch {
      logger.warn('Could not read manifest for district list', {
        operation: 'deleteSnapshotWithCascade',
        operationId,
        snapshotId,
      })
    }

    // 3. Delete time-series index entries for this snapshot
    const programYear = getProgramYearForDate(snapshotId)
    let timeSeriesEntriesDeleted = 0

    for (const districtId of districtIds) {
      try {
        const indexFilePath = path.join(
          timeSeriesDir,
          `district_${districtId}`,
          `${programYear}.json`
        )

        const indexContent = await fs.readFile(indexFilePath, 'utf-8')
        const indexFile: ProgramYearIndexFile = JSON.parse(indexContent)

        // Filter out data points for this snapshot
        const originalCount = indexFile.dataPoints.length
        indexFile.dataPoints = indexFile.dataPoints.filter(
          dp => dp.snapshotId !== snapshotId
        )
        const removedCount = originalCount - indexFile.dataPoints.length

        if (removedCount > 0) {
          // Update the index file
          indexFile.lastUpdated = new Date().toISOString()

          // Recalculate summary
          if (indexFile.dataPoints.length > 0) {
            const memberships = indexFile.dataPoints.map(dp => dp.membership)
            const firstDataPoint = indexFile.dataPoints[0]
            const lastDataPoint =
              indexFile.dataPoints[indexFile.dataPoints.length - 1]

            indexFile.summary = {
              totalDataPoints: indexFile.dataPoints.length,
              membershipStart: firstDataPoint?.membership ?? 0,
              membershipEnd: lastDataPoint?.membership ?? 0,
              membershipPeak: Math.max(...memberships),
              membershipLow: Math.min(...memberships),
            }
          } else {
            indexFile.summary = {
              totalDataPoints: 0,
              membershipStart: 0,
              membershipEnd: 0,
              membershipPeak: 0,
              membershipLow: 0,
            }
          }

          await fs.writeFile(
            indexFilePath,
            JSON.stringify(indexFile, null, 2),
            'utf-8'
          )

          timeSeriesEntriesDeleted += removedCount

          logger.debug('Removed time-series entries for snapshot', {
            operation: 'deleteSnapshotWithCascade',
            operationId,
            snapshotId,
            districtId,
            removedCount,
          })
        }
      } catch (error) {
        // Index file might not exist for this district/program year
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          logger.warn('Error updating time-series index', {
            operation: 'deleteSnapshotWithCascade',
            operationId,
            snapshotId,
            districtId,
            error: error instanceof Error ? error.message : 'Unknown error',
          })
        }
      }
    }

    result.deletedFiles.timeSeriesEntries = timeSeriesEntriesDeleted

    // 4. Check if analytics-summary.json exists (it's inside the snapshot dir)
    const analyticsPath = path.join(snapshotDir, 'analytics-summary.json')
    try {
      await fs.access(analyticsPath)
      result.deletedFiles.analyticsFile = true
    } catch {
      // Analytics file doesn't exist, that's okay
    }

    // 5. Delete the entire snapshot directory (includes analytics-summary.json)
    await fs.rm(snapshotDir, { recursive: true, force: true })
    result.deletedFiles.snapshotDir = true
    result.success = true

    logger.info('Successfully deleted snapshot with cascade', {
      operation: 'deleteSnapshotWithCascade',
      operationId,
      snapshotId,
      districtCount: districtIds.length,
      timeSeriesEntriesDeleted,
      hadAnalyticsFile: result.deletedFiles.analyticsFile,
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
 * Requirements: 8.1, 8.3
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

      const cacheDir = getCacheDir()
      const results: SnapshotDeletionResult[] = []

      // Delete each snapshot with cascading
      for (const snapshotId of snapshotIds as string[]) {
        const result = await deleteSnapshotWithCascade(
          snapshotId,
          cacheDir,
          operationId
        )
        results.push(result)
      }

      const summary: DeletionSummary = {
        totalRequested: snapshotIds.length,
        successfulDeletions: results.filter(r => r.success).length,
        failedDeletions: results.filter(r => !r.success).length,
        results,
      }

      const duration = Date.now() - startTime

      logger.info('Admin snapshot deletion completed', {
        operation: 'deleteSnapshots',
        operationId,
        totalRequested: summary.totalRequested,
        successfulDeletions: summary.successfulDeletions,
        failedDeletions: summary.failedDeletions,
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
 * Requirements: 8.2, 8.3
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
            message: 'startDate and endDate must be strings in YYYY-MM-DD format',
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

      const cacheDir = getCacheDir()
      const snapshotsDir = path.join(cacheDir, 'snapshots')

      // List all snapshot directories
      let snapshotDirs: string[] = []
      try {
        const entries = await fs.readdir(snapshotsDir, { withFileTypes: true })
        snapshotDirs = entries
          .filter(entry => entry.isDirectory())
          .map(entry => entry.name)
          .filter(name => datePattern.test(name))
          .filter(name => name >= startDate && name <= endDate)
          .sort()
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          // Snapshots directory doesn't exist
          snapshotDirs = []
        } else {
          throw error
        }
      }

      logger.info('Found snapshots in date range', {
        operation: 'deleteSnapshotsRange',
        operationId,
        startDate,
        endDate,
        snapshotCount: snapshotDirs.length,
      })

      const results: SnapshotDeletionResult[] = []

      // Delete each snapshot with cascading
      for (const snapshotId of snapshotDirs) {
        const result = await deleteSnapshotWithCascade(
          snapshotId,
          cacheDir,
          operationId
        )
        results.push(result)
      }

      const summary: DeletionSummary = {
        totalRequested: snapshotDirs.length,
        successfulDeletions: results.filter(r => r.success).length,
        failedDeletions: results.filter(r => !r.success).length,
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
 * Requirements: 8.1, 8.3
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

      const cacheDir = getCacheDir()
      const snapshotsDir = path.join(cacheDir, 'snapshots')
      const timeSeriesDir = path.join(cacheDir, 'time-series')

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

        let deletedDistrictFiles = 0
        let deletedTimeSeriesFiles = 0

        // Delete district files from all snapshots
        try {
          const snapshotEntries = await fs.readdir(snapshotsDir, {
            withFileTypes: true,
          })

          for (const entry of snapshotEntries) {
            if (entry.isDirectory()) {
              const districtFilePath = path.join(
                snapshotsDir,
                entry.name,
                `district_${districtId}.json`
              )

              try {
                await fs.unlink(districtFilePath)
                deletedDistrictFiles++

                // Update manifest to remove this district
                const manifestPath = path.join(
                  snapshotsDir,
                  entry.name,
                  'manifest.json'
                )
                try {
                  const manifestContent = await fs.readFile(manifestPath, 'utf-8')
                  const manifest = JSON.parse(manifestContent) as {
                    districts: Array<{ districtId: string }>
                    totalDistricts: number
                    successfulDistricts: number
                  }

                  manifest.districts = manifest.districts.filter(
                    d => d.districtId !== districtId
                  )
                  manifest.totalDistricts = manifest.districts.length
                  manifest.successfulDistricts = manifest.districts.filter(
                    d => (d as { status?: string }).status === 'success'
                  ).length

                  await fs.writeFile(
                    manifestPath,
                    JSON.stringify(manifest, null, 2),
                    'utf-8'
                  )
                } catch {
                  // Manifest update failed, continue
                }
              } catch {
                // District file doesn't exist in this snapshot
              }
            }
          }
        } catch {
          // Snapshots directory doesn't exist
        }

        // Delete time-series directory for this district
        const districtTimeSeriesDir = path.join(
          timeSeriesDir,
          `district_${districtId}`
        )
        try {
          await fs.rm(districtTimeSeriesDir, { recursive: true, force: true })
          deletedTimeSeriesFiles = 1
        } catch {
          // Time-series directory doesn't exist
        }

        const duration = Date.now() - startTime

        logger.info('Completed district-specific deletion', {
          operation: 'deleteAllSnapshots',
          operationId,
          districtId,
          deletedDistrictFiles,
          deletedTimeSeriesFiles,
          durationMs: duration,
        })

        res.json({
          summary: {
            districtId,
            deletedDistrictFiles,
            deletedTimeSeriesDirectory: deletedTimeSeriesFiles > 0,
          },
          metadata: {
            operationId,
            durationMs: duration,
            completedAt: new Date().toISOString(),
          },
        })
        return
      }

      // Delete ALL snapshots
      const datePattern = /^\d{4}-\d{2}-\d{2}$/
      let snapshotDirs: string[] = []

      try {
        const entries = await fs.readdir(snapshotsDir, { withFileTypes: true })
        snapshotDirs = entries
          .filter(entry => entry.isDirectory())
          .map(entry => entry.name)
          .filter(name => datePattern.test(name))
          .sort()
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          snapshotDirs = []
        } else {
          throw error
        }
      }

      logger.info('Found all snapshots for deletion', {
        operation: 'deleteAllSnapshots',
        operationId,
        snapshotCount: snapshotDirs.length,
      })

      const results: SnapshotDeletionResult[] = []

      // Delete each snapshot with cascading
      for (const snapshotId of snapshotDirs) {
        const result = await deleteSnapshotWithCascade(
          snapshotId,
          cacheDir,
          operationId
        )
        results.push(result)
      }

      // Also clean up any orphaned time-series directories
      let cleanedTimeSeriesDirs = 0
      try {
        const timeSeriesEntries = await fs.readdir(timeSeriesDir, {
          withFileTypes: true,
        })

        for (const entry of timeSeriesEntries) {
          if (entry.isDirectory()) {
            const dirPath = path.join(timeSeriesDir, entry.name)
            await fs.rm(dirPath, { recursive: true, force: true })
            cleanedTimeSeriesDirs++
          }
        }
      } catch {
        // Time-series directory doesn't exist
      }

      const summary: DeletionSummary = {
        totalRequested: snapshotDirs.length,
        successfulDeletions: results.filter(r => r.success).length,
        failedDeletions: results.filter(r => !r.success).length,
        results,
      }

      const duration = Date.now() - startTime

      logger.info('Admin delete all snapshots completed', {
        operation: 'deleteAllSnapshots',
        operationId,
        totalRequested: summary.totalRequested,
        successfulDeletions: summary.successfulDeletions,
        failedDeletions: summary.failedDeletions,
        cleanedTimeSeriesDirs,
        durationMs: duration,
      })

      res.json({
        summary: {
          ...summary,
          cleanedTimeSeriesDirectories: cleanedTimeSeriesDirs,
        },
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
