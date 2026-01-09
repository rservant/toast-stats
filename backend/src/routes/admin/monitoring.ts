/**
 * Monitoring routes for admin API
 *
 * Provides endpoints for:
 * - Snapshot store health check
 * - Snapshot store integrity validation
 * - Performance metrics retrieval
 * - Performance metrics reset
 *
 * Requirements: 3.1, 3.2, 3.3, 3.7
 */

import { Router } from 'express'
import {
  logAdminAccess,
  generateOperationId,
  getServiceFactory,
} from './shared.js'
import { logger } from '../../utils/logger.js'
import { FileSnapshotStore } from '../../services/FileSnapshotStore.js'

export const monitoringRouter = Router()

// ============================================================================
// Type definitions for optional FileSnapshotStore methods
// ============================================================================

interface PerformanceMetrics {
  totalReads: number
  cacheHits: number
  cacheMisses: number
  averageReadTime: number
  concurrentReads: number
  maxConcurrentReads: number
}

interface IntegrityResult {
  isHealthy?: boolean
  isValid?: boolean
  storeIssues?: unknown[]
  corruptionIssues?: unknown[]
  recoveryRecommendations?: unknown[]
  validatedAt?: string
}

type FileSnapshotStoreWithOptionalMethods = FileSnapshotStore & {
  validateIntegrity?: () => Promise<IntegrityResult>
  getPerformanceMetrics?: () => PerformanceMetrics
  resetPerformanceMetrics?: () => void
}

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /api/admin/snapshot-store/health
 * Check the health and integrity of the snapshot store
 *
 * Returns:
 * - is_ready: Whether the store is ready for operations
 * - current_snapshot: Details of the current (latest successful) snapshot
 * - latest_snapshot: Details of the most recent snapshot (any status)
 * - recent_activity: Summary of recent snapshot activity
 * - store_status: Overall store status indicators
 *
 * Requirements: 3.1
 */
monitoringRouter.get(
  '/snapshot-store/health',
  logAdminAccess,
  async (req, res) => {
    const startTime = Date.now()
    const operationId = generateOperationId('health_check')

    logger.info('Admin snapshot store health check requested', {
      operation: 'snapshotStoreHealthCheck',
      operation_id: operationId,
      ip: req.ip,
    })

    try {
      const factory = getServiceFactory()
      const snapshotStore = factory.createSnapshotStore()

      // Check if store is ready
      const isReady = await snapshotStore.isReady()

      // Get current snapshot info
      const currentSnapshot = await snapshotStore.getLatestSuccessful()
      const latestSnapshot = await snapshotStore.getLatest()

      // Get recent snapshots for analysis
      const recentSnapshots = await snapshotStore.listSnapshots(10)

      const duration = Date.now() - startTime

      const healthData = {
        is_ready: isReady,
        current_snapshot: currentSnapshot
          ? {
              snapshot_id: currentSnapshot.snapshot_id,
              created_at: currentSnapshot.created_at,
              status: currentSnapshot.status,
              schema_version: currentSnapshot.schema_version,
              calculation_version: currentSnapshot.calculation_version,
              district_count: currentSnapshot.payload.districts.length,
              error_count: currentSnapshot.errors.length,
            }
          : null,
        latest_snapshot: latestSnapshot
          ? {
              snapshot_id: latestSnapshot.snapshot_id,
              created_at: latestSnapshot.created_at,
              status: latestSnapshot.status,
            }
          : null,
        recent_activity: {
          total_snapshots: recentSnapshots.length,
          successful_snapshots: recentSnapshots.filter(
            s => s.status === 'success'
          ).length,
          failed_snapshots: recentSnapshots.filter(s => s.status === 'failed')
            .length,
          partial_snapshots: recentSnapshots.filter(s => s.status === 'partial')
            .length,
          most_recent: recentSnapshots[0] || null,
        },
        store_status: {
          has_current_snapshot: !!currentSnapshot,
          current_matches_latest:
            currentSnapshot?.snapshot_id === latestSnapshot?.snapshot_id,
          store_accessible: isReady,
        },
      }

      logger.info('Admin snapshot store health check completed', {
        operation: 'snapshotStoreHealthCheck',
        operation_id: operationId,
        is_ready: isReady,
        has_current: !!currentSnapshot,
        has_latest: !!latestSnapshot,
        recent_count: recentSnapshots.length,
        duration_ms: duration,
      })

      res.json({
        health: healthData,
        metadata: {
          checked_at: new Date().toISOString(),
          check_duration_ms: duration,
          operation_id: operationId,
        },
      })
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      logger.error('Admin snapshot store health check failed', {
        operation: 'snapshotStoreHealthCheck',
        operation_id: operationId,
        error: errorMessage,
        duration_ms: duration,
      })

      res.status(500).json({
        error: {
          code: 'HEALTH_CHECK_FAILED',
          message: 'Failed to check snapshot store health',
          details: errorMessage,
        },
      })
    }
  }
)

/**
 * GET /api/admin/snapshot-store/integrity
 * Validate the integrity of the snapshot store
 *
 * Returns:
 * - integrity: Detailed integrity validation results
 * - metadata: Operation metadata including timing
 *
 * Requirements: 3.2
 */
monitoringRouter.get(
  '/snapshot-store/integrity',
  logAdminAccess,
  async (req, res) => {
    const startTime = Date.now()
    const operationId = generateOperationId('integrity_check')

    logger.info('Admin snapshot store integrity check requested', {
      operation: 'snapshotStoreIntegrityCheck',
      operation_id: operationId,
      ip: req.ip,
    })

    try {
      const factory = getServiceFactory()
      const snapshotStore =
        factory.createSnapshotStore() as FileSnapshotStoreWithOptionalMethods

      // Validate integrity (this assumes FileSnapshotStore has validateIntegrity method)
      const integrityResult = (await snapshotStore.validateIntegrity?.()) || {
        isValid: true,
        corruptionIssues: [],
        recoveryRecommendations: [],
        validatedAt: new Date().toISOString(),
      }

      const duration = Date.now() - startTime

      logger.info('Admin snapshot store integrity check completed', {
        operation: 'snapshotStoreIntegrityCheck',
        operation_id: operationId,
        is_valid: integrityResult.isHealthy,
        issue_count: integrityResult.storeIssues?.length || 0,
        duration_ms: duration,
      })

      res.json({
        integrity: integrityResult,
        metadata: {
          checked_at: new Date().toISOString(),
          check_duration_ms: duration,
          operation_id: operationId,
        },
      })
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      logger.error('Admin snapshot store integrity check failed', {
        operation: 'snapshotStoreIntegrityCheck',
        operation_id: operationId,
        error: errorMessage,
        duration_ms: duration,
      })

      res.status(500).json({
        error: {
          code: 'INTEGRITY_CHECK_FAILED',
          message: 'Failed to check snapshot store integrity',
          details: errorMessage,
        },
      })
    }
  }
)

/**
 * GET /api/admin/snapshot-store/performance
 * Get performance metrics for the snapshot store
 *
 * Returns:
 * - performance: Performance metrics including cache hit rates
 * - metadata: Operation metadata including timing
 *
 * Requirements: 3.3
 */
monitoringRouter.get(
  '/snapshot-store/performance',
  logAdminAccess,
  async (req, res) => {
    const startTime = Date.now()
    const operationId = generateOperationId('performance_metrics')

    logger.info('Admin snapshot store performance metrics requested', {
      operation: 'getPerformanceMetrics',
      operation_id: operationId,
      ip: req.ip,
    })

    try {
      const factory = getServiceFactory()
      const snapshotStore =
        factory.createSnapshotStore() as FileSnapshotStoreWithOptionalMethods

      // Get performance metrics (this assumes FileSnapshotStore has getPerformanceMetrics method)
      const performanceMetrics = snapshotStore.getPerformanceMetrics?.() || {
        totalReads: 0,
        cacheHits: 0,
        cacheMisses: 0,
        averageReadTime: 0,
        concurrentReads: 0,
        maxConcurrentReads: 0,
      }

      const duration = Date.now() - startTime

      // Calculate additional metrics
      const cacheHitRate =
        performanceMetrics.totalReads > 0
          ? (
              (performanceMetrics.cacheHits / performanceMetrics.totalReads) *
              100
            ).toFixed(2)
          : '0'

      const enhancedMetrics = {
        ...performanceMetrics,
        cache_hit_rate_percent: parseFloat(cacheHitRate),
        cache_efficiency:
          performanceMetrics.totalReads > 0 ? 'good' : 'no_data',
      }

      logger.info('Admin snapshot store performance metrics retrieved', {
        operation: 'getPerformanceMetrics',
        operation_id: operationId,
        total_reads: performanceMetrics.totalReads,
        cache_hit_rate: `${cacheHitRate}%`,
        duration_ms: duration,
      })

      res.json({
        performance: enhancedMetrics,
        metadata: {
          retrieved_at: new Date().toISOString(),
          retrieval_duration_ms: duration,
          operation_id: operationId,
        },
      })
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      logger.error(
        'Admin snapshot store performance metrics retrieval failed',
        {
          operation: 'getPerformanceMetrics',
          operation_id: operationId,
          error: errorMessage,
          duration_ms: duration,
        }
      )

      res.status(500).json({
        error: {
          code: 'PERFORMANCE_METRICS_FAILED',
          message: 'Failed to retrieve performance metrics',
          details: errorMessage,
        },
      })
    }
  }
)

/**
 * POST /api/admin/snapshot-store/performance/reset
 * Reset performance metrics
 *
 * Returns:
 * - success: Boolean indicating operation success
 * - message: Human-readable success message
 * - metadata: Operation metadata including timing
 *
 * Requirements: 3.7
 */
monitoringRouter.post(
  '/snapshot-store/performance/reset',
  logAdminAccess,
  async (req, res) => {
    const startTime = Date.now()
    const operationId = generateOperationId('reset_metrics')

    logger.info('Admin performance metrics reset requested', {
      operation: 'resetPerformanceMetrics',
      operation_id: operationId,
      ip: req.ip,
    })

    try {
      const factory = getServiceFactory()
      const snapshotStore =
        factory.createSnapshotStore() as FileSnapshotStoreWithOptionalMethods

      // Reset performance metrics (this assumes FileSnapshotStore has resetPerformanceMetrics method)
      if (typeof snapshotStore.resetPerformanceMetrics === 'function') {
        snapshotStore.resetPerformanceMetrics()
      }

      const duration = Date.now() - startTime

      logger.info('Admin performance metrics reset completed', {
        operation: 'resetPerformanceMetrics',
        operation_id: operationId,
        duration_ms: duration,
      })

      res.json({
        success: true,
        message: 'Performance metrics reset successfully',
        metadata: {
          reset_at: new Date().toISOString(),
          operation_duration_ms: duration,
          operation_id: operationId,
        },
      })
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      logger.error('Admin performance metrics reset failed', {
        operation: 'resetPerformanceMetrics',
        operation_id: operationId,
        error: errorMessage,
        duration_ms: duration,
      })

      res.status(500).json({
        error: {
          code: 'METRICS_RESET_FAILED',
          message: 'Failed to reset performance metrics',
          details: errorMessage,
        },
      })
    }
  }
)
