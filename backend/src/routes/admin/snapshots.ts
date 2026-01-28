/**
 * Snapshot management routes for admin API
 *
 * Provides endpoints for:
 * - Snapshot listing with filtering and limiting
 * - Snapshot metadata inspection
 * - Snapshot payload retrieval
 *
 * Requirements: 1.1, 1.2, 1.3, 1.5, 2.1, 2.2, 2.3
 *
 * Storage Abstraction:
 * These routes use the ISnapshotStorage interface from the storage abstraction
 * layer, enabling environment-based selection between local filesystem and
 * GCP cloud storage backends.
 */

import { Router } from 'express'
import {
  logAdminAccess,
  generateOperationId,
  getServiceFactory,
} from './shared.js'
import { logger } from '../../utils/logger.js'
import { SnapshotFilters, SnapshotMetadata } from '../../types/snapshots.js'
import { createAnalyticsAvailabilityChecker } from '../../services/AnalyticsAvailabilityChecker.js'

export const snapshotsRouter = Router()

/**
 * Enhanced snapshot metadata with analytics availability indicator
 *
 * Extends the base SnapshotMetadata with analytics_available field
 * to indicate whether pre-computed analytics exist for the snapshot.
 *
 * Requirements: 2.1, 2.2, 2.3
 */
interface EnhancedSnapshotMetadata extends SnapshotMetadata {
  /** Whether pre-computed analytics (analytics-summary.json) exist for this snapshot */
  analytics_available: boolean
}

/**
 * GET /api/admin/snapshots
 * List snapshots with optional filtering and limiting
 *
 * Query Parameters:
 * - limit: Maximum number of snapshots to return
 * - status: Filter by snapshot status ('success' | 'partial' | 'failed')
 * - schema_version: Filter by schema version
 * - calculation_version: Filter by calculation version
 * - created_after: Filter snapshots created after this date (ISO string)
 * - created_before: Filter snapshots created before this date (ISO string)
 * - min_district_count: Filter by minimum district count
 *
 * Response includes:
 * - snapshots: Array of EnhancedSnapshotMetadata with analytics_available field
 * - metadata: Includes analytics_available_count and analytics_missing_count
 *
 * Requirements: 1.1, 2.1, 2.2, 2.3, 2.4
 */
snapshotsRouter.get('/snapshots', logAdminAccess, async (req, res) => {
  const startTime = Date.now()
  const operationId = generateOperationId('list_snapshots')

  logger.info('Admin snapshot listing requested', {
    operation: 'listSnapshots',
    operation_id: operationId,
    query: req.query,
    ip: req.ip,
  })

  try {
    const factory = getServiceFactory()
    // Use ISnapshotStorage interface for storage abstraction layer support
    // This enables environment-based selection between local and cloud storage
    const snapshotStorage = factory.createSnapshotStorage()

    // Parse query parameters
    const limit = req.query['limit']
      ? parseInt(req.query['limit'] as string)
      : undefined
    const filters: SnapshotFilters = {}

    if (req.query['status']) {
      filters.status = req.query['status'] as 'success' | 'partial' | 'failed'
    }
    if (req.query['schema_version']) {
      filters.schema_version = req.query['schema_version'] as string
    }
    if (req.query['calculation_version']) {
      filters.calculation_version = req.query['calculation_version'] as string
    }
    if (req.query['created_after']) {
      filters.created_after = req.query['created_after'] as string
    }
    if (req.query['created_before']) {
      filters.created_before = req.query['created_before'] as string
    }
    if (req.query['min_district_count']) {
      filters.min_district_count = parseInt(
        req.query['min_district_count'] as string
      )
    }

    // Get snapshot metadata
    const snapshots = await snapshotStorage.listSnapshots(limit, filters)

    // Check analytics availability for all snapshots
    // Requirement 2.1: Include boolean field indicating analytics availability
    // Requirement 2.2: Verify existence of analytics-summary.json file
    // Requirement 2.4: Use batch checking for performance (under 100ms additional latency)
    const cacheDir = process.env['CACHE_DIR'] || './cache'
    const analyticsChecker = createAnalyticsAvailabilityChecker(cacheDir)
    const snapshotIds = snapshots.map(s => s.snapshot_id)
    const analyticsAvailabilityMap =
      await analyticsChecker.checkBatch(snapshotIds)

    // Enhance snapshots with analytics availability
    // Requirement 2.3: Backward compatible - all existing fields preserved
    const enhancedSnapshots: EnhancedSnapshotMetadata[] = snapshots.map(
      snapshot => ({
        ...snapshot,
        analytics_available:
          analyticsAvailabilityMap.get(snapshot.snapshot_id) ?? false,
      })
    )

    // Calculate analytics counts for metadata
    const analyticsAvailableCount = enhancedSnapshots.filter(
      s => s.analytics_available
    ).length
    const analyticsMissingCount =
      enhancedSnapshots.length - analyticsAvailableCount

    const duration = Date.now() - startTime

    logger.info('Admin snapshot listing completed', {
      operation: 'listSnapshots',
      operation_id: operationId,
      snapshot_count: snapshots.length,
      analytics_available_count: analyticsAvailableCount,
      analytics_missing_count: analyticsMissingCount,
      filters_applied: Object.keys(filters).length,
      limit_applied: limit,
      duration_ms: duration,
    })

    res.json({
      snapshots: enhancedSnapshots,
      metadata: {
        total_count: enhancedSnapshots.length,
        analytics_available_count: analyticsAvailableCount,
        analytics_missing_count: analyticsMissingCount,
        filters_applied: filters,
        limit_applied: limit ?? null,
        query_duration_ms: duration,
        generated_at: new Date().toISOString(),
      },
    })
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'

    logger.error('Admin snapshot listing failed', {
      operation: 'listSnapshots',
      operation_id: operationId,
      error: errorMessage,
      duration_ms: duration,
    })

    res.status(500).json({
      error: {
        code: 'SNAPSHOT_LISTING_FAILED',
        message: 'Failed to list snapshots',
        details: errorMessage,
      },
    })
  }
})

/**
 * GET /api/admin/snapshots/:snapshotId
 * Get detailed information about a specific snapshot
 *
 * Path Parameters:
 * - snapshotId: The unique identifier of the snapshot
 *
 * Requirements: 1.2
 */
snapshotsRouter.get(
  '/snapshots/:snapshotId',
  logAdminAccess,
  async (req, res): Promise<void> => {
    const startTime = Date.now()
    const snapshotIdParam = req.params['snapshotId']
    const operationId = generateOperationId('inspect_snapshot')

    // Validate snapshotId parameter - ensure it's a string
    if (!snapshotIdParam || typeof snapshotIdParam !== 'string') {
      res.status(400).json({
        error: {
          code: 'MISSING_SNAPSHOT_ID',
          message: 'Snapshot ID is required',
        },
      })
      return
    }

    const snapshotId = snapshotIdParam

    logger.info('Admin snapshot inspection requested', {
      operation: 'inspectSnapshot',
      operation_id: operationId,
      snapshot_id: snapshotId,
      ip: req.ip,
    })

    try {
      const factory = getServiceFactory()
      // Use ISnapshotStorage interface for storage abstraction layer support
      // This enables environment-based selection between local and cloud storage
      const snapshotStorage = factory.createSnapshotStorage()

      // Get the specific snapshot
      const snapshot = await snapshotStorage.getSnapshot(snapshotId)

      if (!snapshot) {
        logger.warn('Admin requested non-existent snapshot', {
          operation: 'inspectSnapshot',
          operation_id: operationId,
          snapshot_id: snapshotId,
        })

        res.status(404).json({
          error: {
            code: 'SNAPSHOT_NOT_FOUND',
            message: `Snapshot ${snapshotId} not found`,
          },
        })
        return
      }

      const duration = Date.now() - startTime

      // Create detailed inspection data
      const inspectionData = {
        snapshot_id: snapshot.snapshot_id,
        created_at: snapshot.created_at,
        status: snapshot.status,
        schema_version: snapshot.schema_version,
        calculation_version: snapshot.calculation_version,
        errors: snapshot.errors,
        payload_summary: {
          district_count: snapshot.payload.districts.length,
          metadata: snapshot.payload.metadata,
          districts: snapshot.payload.districts.map(district => ({
            districtId: district.districtId,
            name: `District ${district.districtId}`,
            club_count: district.clubs?.total || 0,
            membership_total: district.membership?.total || 0,
            performance_score: district.performance?.membershipNet || 0,
          })),
        },
        size_analysis: {
          total_size_estimate: JSON.stringify(snapshot).length,
          payload_size_estimate: JSON.stringify(snapshot.payload).length,
          errors_size: JSON.stringify(snapshot.errors).length,
        },
      }

      logger.info('Admin snapshot inspection completed', {
        operation: 'inspectSnapshot',
        operation_id: operationId,
        snapshot_id: snapshotId,
        status: snapshot.status,
        district_count: snapshot.payload.districts.length,
        error_count: snapshot.errors.length,
        duration_ms: duration,
      })

      res.json({
        inspection: inspectionData,
        metadata: {
          inspected_at: new Date().toISOString(),
          inspection_duration_ms: duration,
          operation_id: operationId,
        },
      })
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      logger.error('Admin snapshot inspection failed', {
        operation: 'inspectSnapshot',
        operation_id: operationId,
        snapshot_id: snapshotId,
        error: errorMessage,
        duration_ms: duration,
      })

      res.status(500).json({
        error: {
          code: 'SNAPSHOT_INSPECTION_FAILED',
          message: 'Failed to inspect snapshot',
          details: errorMessage,
        },
      })
    }
  }
)

/**
 * GET /api/admin/snapshots/:snapshotId/payload
 * Get the full payload data for a specific snapshot
 *
 * Path Parameters:
 * - snapshotId: The unique identifier of the snapshot
 *
 * Requirements: 1.3
 */
snapshotsRouter.get(
  '/snapshots/:snapshotId/payload',
  logAdminAccess,
  async (req, res): Promise<void> => {
    const startTime = Date.now()
    const snapshotIdParam = req.params['snapshotId']
    const operationId = generateOperationId('get_payload')

    // Validate snapshotId parameter - ensure it's a string
    if (!snapshotIdParam || typeof snapshotIdParam !== 'string') {
      res.status(400).json({
        error: {
          code: 'MISSING_SNAPSHOT_ID',
          message: 'Snapshot ID is required',
        },
      })
      return
    }

    const snapshotId = snapshotIdParam

    logger.info('Admin snapshot payload requested', {
      operation: 'getSnapshotPayload',
      operation_id: operationId,
      snapshot_id: snapshotId,
      ip: req.ip,
    })

    try {
      const factory = getServiceFactory()
      // Use ISnapshotStorage interface for storage abstraction layer support
      // This enables environment-based selection between local and cloud storage
      const snapshotStorage = factory.createSnapshotStorage()

      // Get the specific snapshot
      const snapshot = await snapshotStorage.getSnapshot(snapshotId)

      if (!snapshot) {
        res.status(404).json({
          error: {
            code: 'SNAPSHOT_NOT_FOUND',
            message: `Snapshot ${snapshotId} not found`,
          },
        })
        return
      }

      const duration = Date.now() - startTime

      logger.info('Admin snapshot payload retrieved', {
        operation: 'getSnapshotPayload',
        operation_id: operationId,
        snapshot_id: snapshotId,
        district_count: snapshot.payload.districts.length,
        duration_ms: duration,
      })

      res.json({
        snapshot_id: snapshot.snapshot_id,
        created_at: snapshot.created_at,
        status: snapshot.status,
        payload: snapshot.payload,
        metadata: {
          retrieved_at: new Date().toISOString(),
          retrieval_duration_ms: duration,
        },
      })
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      logger.error('Admin snapshot payload retrieval failed', {
        operation: 'getSnapshotPayload',
        operation_id: operationId,
        snapshot_id: snapshotId,
        error: errorMessage,
        duration_ms: duration,
      })

      res.status(500).json({
        error: {
          code: 'PAYLOAD_RETRIEVAL_FAILED',
          message: 'Failed to retrieve snapshot payload',
          details: errorMessage,
        },
      })
    }
  }
)
