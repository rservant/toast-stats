/**
 * Snapshots routes module
 * Handles snapshot listing and cached dates endpoints
 * Requirements: 2.4
 */

import { Router, type Request, type Response } from 'express'
import { transformErrorResponse } from '../../utils/transformers.js'
import { cacheMiddleware } from '../../middleware/cache.js'
import { logger } from '../../utils/logger.js'
import {
  getValidDistrictId,
  perDistrictSnapshotStore,
  districtSnapshotIndexService,
} from './shared.js'

export const snapshotsRouter = Router()

/**
 * GET /api/districts/cache/dates
 * Get all cached dates from per-district snapshots
 *
 * Optimized: Uses listSnapshotIds() which only lists GCS prefixes (~1s)
 * instead of listSnapshots() which reads metadata from each snapshot (~91s).
 */
snapshotsRouter.get(
  '/cache/dates',
  cacheMiddleware({
    ttl: 3600, // 1 hour cache
  }),
  async (_req: Request, res: Response) => {
    try {
      // Fast path: only list snapshot IDs, no metadata reads
      const snapshotIds = await perDistrictSnapshotStore.listSnapshotIds()
      const snapshotDates = snapshotIds.filter(id =>
        /^\d{4}-\d{2}-\d{2}$/.test(id)
      )

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
  }
)

/**
 * GET /api/districts/:districtId/cached-dates
 * List all available cached dates for a district
 *
 * Fast path: Uses pre-computed district-snapshot index (single GCS read, cached 1h).
 * Fallback: If index is unavailable, falls back to listSnapshotIds() +
 *           parallel hasDistrictInSnapshot() HEAD requests.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */
snapshotsRouter.get(
  '/:districtId/cached-dates',
  cacheMiddleware({
    ttl: 3600, // 1 hour cache
  }),
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

      // ── Fast path: pre-computed index ──────────────────────────────────
      const indexDates =
        await districtSnapshotIndexService.getDatesForDistrict(districtId)

      if (indexDates !== null) {
        // Index available — sort descending (newest first)
        const sortedDates = [...indexDates].sort((a, b) => b.localeCompare(a))
        const dateRange =
          sortedDates.length > 0
            ? {
                startDate: sortedDates[sortedDates.length - 1],
                endDate: sortedDates[0],
              }
            : null

        logger.info('Served cached-dates from pre-computed index', {
          operation: 'cachedDates',
          districtId,
          count: sortedDates.length,
          source: 'index',
        })

        res.json({
          districtId,
          dates: sortedDates,
          count: sortedDates.length,
          dateRange,
        })
        return
      }

      // ── Fallback: HEAD request scan ───────────────────────────────────
      logger.info('Index unavailable, falling back to HEAD request scan', {
        operation: 'cachedDates',
        districtId,
        source: 'fallback',
      })

      const snapshotIds = await perDistrictSnapshotStore.listSnapshotIds()
      const validSnapshotIds = snapshotIds.filter(id =>
        /^\d{4}-\d{2}-\d{2}$/.test(id)
      )

      // Check district membership in parallel batches (concurrency 25)
      const CONCURRENCY = 25
      const districtDates: string[] = []

      for (let i = 0; i < validSnapshotIds.length; i += CONCURRENCY) {
        const batch = validSnapshotIds.slice(i, i + CONCURRENCY)
        const results = await Promise.all(
          batch.map(async snapshotId => {
            const exists = await perDistrictSnapshotStore.hasDistrictInSnapshot(
              snapshotId,
              districtId
            )
            return { snapshotId, exists }
          })
        )

        for (const { snapshotId, exists } of results) {
          if (exists) {
            districtDates.push(snapshotId)
          }
        }
      }

      // Sort dates descending (newest first)
      const sortedDates = districtDates.sort((a, b) => b.localeCompare(a))

      // Calculate date range
      const dateRange =
        sortedDates.length > 0
          ? {
              startDate: sortedDates[sortedDates.length - 1],
              endDate: sortedDates[0],
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
