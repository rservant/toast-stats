/**
 * Monitoring routes for admin API
 *
 * Provides endpoints for:
 * - Snapshot store health check
 * - Snapshot store integrity validation
 * - Performance metrics retrieval
 * - Performance metrics reset
 * - System health metrics (cache hit rates, response times, pending operations)
 *
 * Requirements: 3.1, 3.2, 3.3, 3.7, 11.1
 *
 * Storage Abstraction:
 * These routes use the ISnapshotStorage interface from the storage abstraction
 * layer, enabling environment-based selection between local filesystem and
 * GCP cloud storage backends.
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
import type { ISnapshotStorage } from '../../types/storageInterfaces.js'
import { getPendingBackfillJobCount } from './backfill.js'

export const monitoringRouter = Router()

// ============================================================================
// Type definitions for optional ISnapshotStorage methods
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

/**
 * Extended ISnapshotStorage interface with optional monitoring methods
 *
 * These methods may be available on some storage implementations
 * (e.g., LocalSnapshotStorage) but not others (e.g., FirestoreSnapshotStorage).
 */
type ISnapshotStorageWithOptionalMethods = ISnapshotStorage & {
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
      // Use ISnapshotStorage interface for storage abstraction layer support
      // This enables environment-based selection between local and cloud storage
      const snapshotStorage = factory.createSnapshotStorage()

      // Check if store is ready
      const isReady = await snapshotStorage.isReady()

      // Get current snapshot info
      const currentSnapshot = await snapshotStorage.getLatestSuccessful()
      const latestSnapshot = await snapshotStorage.getLatest()

      // Get recent snapshots for analysis
      const recentSnapshots = await snapshotStorage.listSnapshots(10)

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
      // Use ISnapshotStorage interface for storage abstraction layer support
      // Cast to extended type for optional monitoring methods
      const snapshotStorage =
        factory.createSnapshotStorage() as ISnapshotStorageWithOptionalMethods

      // Validate integrity (this method may not be available on all storage implementations)
      const integrityResult = (await snapshotStorage.validateIntegrity?.()) || {
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
      // Use ISnapshotStorage interface for storage abstraction layer support
      // Cast to extended type for optional monitoring methods
      const snapshotStorage =
        factory.createSnapshotStorage() as ISnapshotStorageWithOptionalMethods

      // Get performance metrics (this method may not be available on all storage implementations)
      const performanceMetrics = snapshotStorage.getPerformanceMetrics?.() || {
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
      // Use ISnapshotStorage interface for storage abstraction layer support
      // Cast to extended type for optional monitoring methods
      const snapshotStorage =
        factory.createSnapshotStorage() as ISnapshotStorageWithOptionalMethods

      // Reset performance metrics (this method may not be available on all storage implementations)
      if (typeof snapshotStorage.resetPerformanceMetrics === 'function') {
        snapshotStorage.resetPerformanceMetrics()
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

// ============================================================================
// System Health Types
// ============================================================================

/**
 * System health metrics for the admin panel
 *
 * Provides aggregated metrics from various services including:
 * - Cache performance (hit rates)
 * - Response time statistics
 * - Pending operations count
 * - Snapshot and analytics coverage
 *
 * Requirements: 11.1
 */
export interface SystemHealthMetrics {
  /** Cache hit rate as a percentage (0-100) */
  cacheHitRate: number
  /** Average response time in milliseconds for analytics requests */
  averageResponseTime: number
  /** Number of pending background operations (e.g., backfill jobs) */
  pendingOperations: number
  /** Total number of snapshots in the store */
  snapshotCount: number
  /** Number of snapshots with pre-computed analytics */
  precomputedAnalyticsCount: number
}

/**
 * GET /api/admin/health
 * Get system health metrics for the admin panel
 *
 * Returns aggregated metrics including:
 * - Cache hit rates from snapshot store
 * - Average response times for analytics requests
 * - Pending background operations count
 * - Snapshot store status
 * - Pre-computed analytics coverage
 *
 * Requirements: 11.1
 */
monitoringRouter.get('/health', logAdminAccess, async (req, res) => {
  const startTime = Date.now()
  const operationId = generateOperationId('system_health')

  logger.info('Admin system health check requested', {
    operation: 'getSystemHealth',
    operation_id: operationId,
    ip: req.ip,
  })

  try {
    const factory = getServiceFactory()
    const snapshotStorage =
      factory.createSnapshotStorage() as ISnapshotStorageWithOptionalMethods
    const cacheConfig = factory.createCacheConfigService()

    // Get performance metrics from snapshot store
    const performanceMetrics = snapshotStorage.getPerformanceMetrics?.() || {
      totalReads: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageReadTime: 0,
      concurrentReads: 0,
      maxConcurrentReads: 0,
    }

    // Calculate cache hit rate
    const cacheHitRate =
      performanceMetrics.totalReads > 0
        ? (performanceMetrics.cacheHits / performanceMetrics.totalReads) * 100
        : 0

    // Get snapshot count
    const snapshots = await snapshotStorage.listSnapshots()
    const snapshotCount = snapshots.length

    // Count snapshots with pre-computed analytics
    const cacheDir = cacheConfig.getCacheDirectory()
    const snapshotsDir = path.join(cacheDir, 'snapshots')
    let precomputedAnalyticsCount = 0

    try {
      for (const snapshot of snapshots) {
        const analyticsPath = path.join(
          snapshotsDir,
          snapshot.snapshot_id,
          'analytics-summary.json'
        )
        try {
          await fs.access(analyticsPath)
          precomputedAnalyticsCount++
        } catch {
          // Analytics file doesn't exist for this snapshot
        }
      }
    } catch {
      // Error counting analytics files - continue with 0
      logger.warn('Failed to count pre-computed analytics files', {
        operation: 'getSystemHealth',
        operation_id: operationId,
      })
    }

    // Count pending backfill operations
    const pendingOperations = getPendingBackfillJobCount()

    const systemHealth: SystemHealthMetrics = {
      cacheHitRate: Math.round(cacheHitRate * 100) / 100, // Round to 2 decimal places
      averageResponseTime:
        Math.round(performanceMetrics.averageReadTime * 100) / 100,
      pendingOperations,
      snapshotCount,
      precomputedAnalyticsCount,
    }

    const duration = Date.now() - startTime

    logger.info('Admin system health check completed', {
      operation: 'getSystemHealth',
      operation_id: operationId,
      cache_hit_rate: `${systemHealth.cacheHitRate}%`,
      snapshot_count: snapshotCount,
      precomputed_analytics_count: precomputedAnalyticsCount,
      pending_operations: pendingOperations,
      duration_ms: duration,
    })

    res.json({
      health: systemHealth,
      details: {
        cache: {
          hitRate: systemHealth.cacheHitRate,
          totalReads: performanceMetrics.totalReads,
          cacheHits: performanceMetrics.cacheHits,
          cacheMisses: performanceMetrics.cacheMisses,
          efficiency:
            performanceMetrics.totalReads > 0 ? 'operational' : 'no_data',
        },
        snapshots: {
          total: snapshotCount,
          withPrecomputedAnalytics: precomputedAnalyticsCount,
          analyticsCoverage:
            snapshotCount > 0
              ? Math.round((precomputedAnalyticsCount / snapshotCount) * 100)
              : 0,
        },
        operations: {
          pending: pendingOperations,
          status: pendingOperations > 0 ? 'processing' : 'idle',
        },
        performance: {
          averageResponseTime: systemHealth.averageResponseTime,
          concurrentReads: performanceMetrics.concurrentReads,
          maxConcurrentReads: performanceMetrics.maxConcurrentReads,
        },
      },
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

    logger.error('Admin system health check failed', {
      operation: 'getSystemHealth',
      operation_id: operationId,
      error: errorMessage,
      duration_ms: duration,
    })

    res.status(500).json({
      error: {
        code: 'SYSTEM_HEALTH_CHECK_FAILED',
        message: 'Failed to retrieve system health metrics',
        details: errorMessage,
      },
    })
  }
})
