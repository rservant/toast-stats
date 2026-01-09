/**
 * Snapshots routes module
 * Handles snapshot listing and cached dates endpoints
 * Requirements: 2.4
 */

import { Router, type Request, type Response } from 'express'
import { transformErrorResponse } from '../../utils/transformers.js'
import { getValidDistrictId, perDistrictSnapshotStore } from './shared.js'

export const snapshotsRouter = Router()

/**
 * GET /api/districts/cache/dates
 * Get all cached dates from per-district snapshots
 */
snapshotsRouter.get('/cache/dates', async (_req: Request, res: Response) => {
  try {
    // Get dates from per-district snapshot format
    const snapshots = await perDistrictSnapshotStore.listSnapshots()
    const snapshotDates = snapshots
      .filter(s => s.status === 'success')
      .map(s => s.snapshot_id)
      .filter(id => /^\d{4}-\d{2}-\d{2}$/.test(id)) // Only ISO date format IDs

    // Sort in descending order (newest first)
    snapshotDates.sort((a, b) => b.localeCompare(a))

    res.json({ dates: snapshotDates })
  } catch (error) {
    const errorResponse = transformErrorResponse(error)
    res.status(500).json({
      error: {
        code: errorResponse.code || 'FETCH_ERROR',
        message: 'Failed to get cached dates',
        details: errorResponse.details,
      },
    })
  }
})

/**
 * GET /api/districts/:districtId/cached-dates
 * List all available cached dates for a district
 *
 * Migrated to use PerDistrictSnapshotStore instead of legacy DistrictCacheManager.
 * Queries snapshots and filters to find those containing the requested district.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */
snapshotsRouter.get(
  '/:districtId/cached-dates',
  async (req: Request, res: Response) => {
    try {
      const districtId = getValidDistrictId(req)

      // Validate district ID
      if (!districtId) {
        res.status(400).json({
          error: {
            code: 'INVALID_DISTRICT_ID',
            message: 'Invalid district ID format',
          },
        })
        return
      }

      // Get all snapshots from PerDistrictSnapshotStore
      const snapshots = await perDistrictSnapshotStore.listSnapshots()

      // Filter to snapshots that contain this district and are successful
      const districtDates: string[] = []
      for (const snapshot of snapshots) {
        if (snapshot.status !== 'success') continue

        // Check if district exists in this snapshot
        const districts =
          await perDistrictSnapshotStore.listDistrictsInSnapshot(
            snapshot.snapshot_id
          )
        if (districts.includes(districtId)) {
          districtDates.push(snapshot.snapshot_id) // snapshot_id is YYYY-MM-DD format
        }
      }

      // Sort dates ascending
      const sortedDates = districtDates.sort()

      // Calculate date range
      const dateRange =
        sortedDates.length > 0
          ? {
              startDate: sortedDates[0],
              endDate: sortedDates[sortedDates.length - 1],
            }
          : null

      res.json({
        districtId,
        dates: sortedDates,
        count: sortedDates.length,
        dateRange,
      })
    } catch (error) {
      const errorResponse = transformErrorResponse(error)

      res.status(500).json({
        error: {
          code: errorResponse.code || 'SNAPSHOT_ERROR',
          message: 'Failed to retrieve cached dates',
          details: errorResponse.details,
        },
      })
    }
  }
)
