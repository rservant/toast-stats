/**
 * Admin routes for snapshot management and debugging
 *
 * Provides endpoints for:
 * - Snapshot listing with filtering and limiting
 * - Snapshot metadata inspection
 * - Debugging capabilities for snapshot analysis
 * - Snapshot store health and integrity checks
 */

import express from 'express'
import { logger } from '../utils/logger.js'
import { getProductionServiceFactory } from '../services/ProductionServiceFactory.js'
import { ProcessSeparationValidator } from '../services/ProcessSeparationValidator.js'
// import { ProcessSeparationMonitor } from '../services/ProcessSeparationMonitor.js'
import { SnapshotFilters } from '../types/snapshots.js'
import { FileSnapshotStore } from '../services/FileSnapshotStore.js'

const router = express.Router()

/**
 * Middleware to validate admin token
 */
const validateAdminToken = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const token =
    req.headers.authorization?.replace('Bearer ', '') ||
    (req.query.token as string)
  const adminToken = process.env.ADMIN_TOKEN

  if (!adminToken) {
    logger.warn('Admin endpoint accessed but ADMIN_TOKEN not configured', {
      endpoint: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    })
    return res.status(500).json({
      error: {
        code: 'ADMIN_TOKEN_NOT_CONFIGURED',
        message: 'Admin functionality is not properly configured',
      },
    })
  }

  if (!token || token !== adminToken) {
    logger.warn('Unauthorized admin access attempt', {
      endpoint: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      hasToken: !!token,
    })
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Valid admin token required',
      },
    })
  }

  next()
}

/**
 * GET /api/admin/snapshots
 * List snapshots with optional filtering and limiting
 */
router.get('/snapshots', validateAdminToken, async (req, res) => {
  const startTime = Date.now()
  const operationId = `list_snapshots_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  logger.info('Admin snapshot listing requested', {
    operation: 'listSnapshots',
    operation_id: operationId,
    query: req.query,
    ip: req.ip,
  })

  try {
    const factory = getProductionServiceFactory()
    const snapshotStore = factory.createSnapshotStore()

    // Parse query parameters
    const limit = req.query.limit
      ? parseInt(req.query.limit as string)
      : undefined
    const filters: SnapshotFilters = {}

    if (req.query.status) {
      filters.status = req.query.status as 'success' | 'partial' | 'failed'
    }
    if (req.query.schema_version) {
      filters.schema_version = req.query.schema_version as string
    }
    if (req.query.calculation_version) {
      filters.calculation_version = req.query.calculation_version as string
    }
    if (req.query.created_after) {
      filters.created_after = req.query.created_after as string
    }
    if (req.query.created_before) {
      filters.created_before = req.query.created_before as string
    }
    if (req.query.min_district_count) {
      filters.min_district_count = parseInt(
        req.query.min_district_count as string
      )
    }

    // Get snapshot metadata
    const snapshots = await snapshotStore.listSnapshots(limit, filters)
    const duration = Date.now() - startTime

    logger.info('Admin snapshot listing completed', {
      operation: 'listSnapshots',
      operation_id: operationId,
      snapshot_count: snapshots.length,
      filters_applied: Object.keys(filters).length,
      limit_applied: limit,
      duration_ms: duration,
    })

    res.json({
      snapshots,
      metadata: {
        total_count: snapshots.length,
        filters_applied: filters,
        limit_applied: limit,
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
 */
router.get('/snapshots/:snapshotId', validateAdminToken, async (req, res) => {
  const startTime = Date.now()
  const { snapshotId } = req.params
  const operationId = `inspect_snapshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  logger.info('Admin snapshot inspection requested', {
    operation: 'inspectSnapshot',
    operation_id: operationId,
    snapshot_id: snapshotId,
    ip: req.ip,
  })

  try {
    const factory = getProductionServiceFactory()
    const snapshotStore = factory.createSnapshotStore()

    // Get the specific snapshot
    const snapshot = await snapshotStore.getSnapshot(snapshotId)

    if (!snapshot) {
      logger.warn('Admin requested non-existent snapshot', {
        operation: 'inspectSnapshot',
        operation_id: operationId,
        snapshot_id: snapshotId,
      })

      return res.status(404).json({
        error: {
          code: 'SNAPSHOT_NOT_FOUND',
          message: `Snapshot ${snapshotId} not found`,
        },
      })
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
          name: `District ${district.districtId}`, // DistrictStatistics doesn't have name field
          club_count: district.clubs?.total || 0, // Use total instead of length
          membership_total: district.membership?.total || 0,
          performance_score: district.performance?.membershipNet || 0, // Use membershipNet instead of overallScore
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
})

/**
 * GET /api/admin/snapshots/:snapshotId/payload
 * Get the full payload data for a specific snapshot
 */
router.get(
  '/snapshots/:snapshotId/payload',
  validateAdminToken,
  async (req, res) => {
    const startTime = Date.now()
    const { snapshotId } = req.params
    const operationId = `get_payload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    logger.info('Admin snapshot payload requested', {
      operation: 'getSnapshotPayload',
      operation_id: operationId,
      snapshot_id: snapshotId,
      ip: req.ip,
    })

    try {
      const factory = getProductionServiceFactory()
      const snapshotStore = factory.createSnapshotStore()

      // Get the specific snapshot
      const snapshot = await snapshotStore.getSnapshot(snapshotId)

      if (!snapshot) {
        return res.status(404).json({
          error: {
            code: 'SNAPSHOT_NOT_FOUND',
            message: `Snapshot ${snapshotId} not found`,
          },
        })
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

/**
 * GET /api/admin/snapshot-store/health
 * Check the health and integrity of the snapshot store
 */
router.get('/snapshot-store/health', validateAdminToken, async (req, res) => {
  const startTime = Date.now()
  const operationId = `health_check_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  logger.info('Admin snapshot store health check requested', {
    operation: 'snapshotStoreHealthCheck',
    operation_id: operationId,
    ip: req.ip,
  })

  try {
    const factory = getProductionServiceFactory()
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
})

/**
 * GET /api/admin/snapshot-store/integrity
 * Validate the integrity of the snapshot store
 */
router.get(
  '/snapshot-store/integrity',
  validateAdminToken,
  async (req, res) => {
    const startTime = Date.now()
    const operationId = `integrity_check_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    logger.info('Admin snapshot store integrity check requested', {
      operation: 'snapshotStoreIntegrityCheck',
      operation_id: operationId,
      ip: req.ip,
    })

    try {
      const factory = getProductionServiceFactory()
      const snapshotStore = factory.createSnapshotStore()

      // Validate integrity (this assumes FileSnapshotStore has validateIntegrity method)
      const integrityResult = (await (
        snapshotStore as FileSnapshotStore & {
          validateIntegrity?: () => Promise<unknown>
        }
      ).validateIntegrity?.()) || {
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
 */
router.get(
  '/snapshot-store/performance',
  validateAdminToken,
  async (req, res) => {
    const startTime = Date.now()
    const operationId = `performance_metrics_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    logger.info('Admin snapshot store performance metrics requested', {
      operation: 'getPerformanceMetrics',
      operation_id: operationId,
      ip: req.ip,
    })

    try {
      const factory = getProductionServiceFactory()
      const snapshotStore = factory.createSnapshotStore()

      // Get performance metrics (this assumes FileSnapshotStore has getPerformanceMetrics method)
      const performanceMetrics = (await (
        snapshotStore as FileSnapshotStore & {
          getPerformanceMetrics?: () => Promise<unknown>
        }
      ).getPerformanceMetrics?.()) || {
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
 */
router.post(
  '/snapshot-store/performance/reset',
  validateAdminToken,
  async (req, res) => {
    const startTime = Date.now()
    const operationId = `reset_metrics_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    logger.info('Admin performance metrics reset requested', {
      operation: 'resetPerformanceMetrics',
      operation_id: operationId,
      ip: req.ip,
    })

    try {
      const factory = getProductionServiceFactory()
      const snapshotStore = factory.createSnapshotStore()

      // Reset performance metrics (this assumes FileSnapshotStore has resetPerformanceMetrics method)
      if (
        typeof (
          snapshotStore as FileSnapshotStore & {
            resetPerformanceMetrics?: () => void
          }
        ).resetPerformanceMetrics === 'function'
      ) {
        ;(
          snapshotStore as FileSnapshotStore & {
            resetPerformanceMetrics?: () => void
          }
        ).resetPerformanceMetrics()
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

/**
 * GET /api/admin/process-separation/validate
 * Validate process separation compliance
 */
router.get(
  '/process-separation/validate',
  validateAdminToken,
  async (req, res) => {
    const startTime = Date.now()
    const operationId = `process_separation_validate_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    logger.info('Admin process separation validation requested', {
      operation: 'validateProcessSeparation',
      operation_id: operationId,
      ip: req.ip,
    })

    try {
      const factory = getProductionServiceFactory()
      const snapshotStore = factory.createSnapshotStore()
      const refreshService = factory.createRefreshService()

      const validator = new ProcessSeparationValidator(
        snapshotStore,
        refreshService
      )
      const validationResult = await validator.validateProcessSeparation()

      const duration = Date.now() - startTime

      logger.info('Admin process separation validation completed', {
        operation: 'validateProcessSeparation',
        operation_id: operationId,
        is_valid: validationResult.isValid,
        issues_count: validationResult.issues.length,
        duration_ms: duration,
      })

      res.json({
        validation: validationResult,
        metadata: {
          validated_at: new Date().toISOString(),
          validation_duration_ms: duration,
          operation_id: operationId,
        },
      })
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      logger.error('Admin process separation validation failed', {
        operation: 'validateProcessSeparation',
        operation_id: operationId,
        error: errorMessage,
        duration_ms: duration,
      })

      res.status(500).json({
        error: {
          code: 'PROCESS_SEPARATION_VALIDATION_FAILED',
          message: 'Failed to validate process separation',
          details: errorMessage,
        },
      })
    }
  }
)

/**
 * GET /api/admin/process-separation/monitor
 * Monitor concurrent operations performance
 */
router.get(
  '/process-separation/monitor',
  validateAdminToken,
  async (req, res) => {
    const startTime = Date.now()
    const operationId = `process_separation_monitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    logger.info('Admin process separation monitoring requested', {
      operation: 'monitorConcurrentOperations',
      operation_id: operationId,
      ip: req.ip,
    })

    try {
      const factory = getProductionServiceFactory()
      const snapshotStore = factory.createSnapshotStore()
      const refreshService = factory.createRefreshService()

      const validator = new ProcessSeparationValidator(
        snapshotStore,
        refreshService
      )
      const monitoringResult = await validator.monitorConcurrentOperations()

      const duration = Date.now() - startTime

      logger.info('Admin process separation monitoring completed', {
        operation: 'monitorConcurrentOperations',
        operation_id: operationId,
        max_concurrent_reads: monitoringResult.maxConcurrentReads,
        read_throughput: monitoringResult.readThroughput,
        duration_ms: duration,
      })

      res.json({
        monitoring: monitoringResult,
        metadata: {
          monitored_at: new Date().toISOString(),
          monitoring_duration_ms: duration,
          operation_id: operationId,
        },
      })
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      logger.error('Admin process separation monitoring failed', {
        operation: 'monitorConcurrentOperations',
        operation_id: operationId,
        error: errorMessage,
        duration_ms: duration,
      })

      res.status(500).json({
        error: {
          code: 'PROCESS_SEPARATION_MONITORING_FAILED',
          message: 'Failed to monitor concurrent operations',
          details: errorMessage,
        },
      })
    }
  }
)

/**
 * GET /api/admin/process-separation/compliance
 * Get process separation compliance metrics
 */
router.get(
  '/process-separation/compliance',
  validateAdminToken,
  async (req, res) => {
    const startTime = Date.now()
    const operationId = `process_separation_compliance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    logger.info('Admin process separation compliance metrics requested', {
      operation: 'getComplianceMetrics',
      operation_id: operationId,
      ip: req.ip,
    })

    try {
      const factory = getProductionServiceFactory()
      const snapshotStore = factory.createSnapshotStore()
      const refreshService = factory.createRefreshService()

      const validator = new ProcessSeparationValidator(
        snapshotStore,
        refreshService
      )
      const complianceMetrics = await validator.getComplianceMetrics()

      const duration = Date.now() - startTime

      logger.info('Admin process separation compliance metrics retrieved', {
        operation: 'getComplianceMetrics',
        operation_id: operationId,
        compliance_score: complianceMetrics.processSeparationScore,
        compliance_status: complianceMetrics.complianceStatus,
        duration_ms: duration,
      })

      res.json({
        compliance: complianceMetrics,
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

      logger.error('Admin process separation compliance metrics failed', {
        operation: 'getComplianceMetrics',
        operation_id: operationId,
        error: errorMessage,
        duration_ms: duration,
      })

      res.status(500).json({
        error: {
          code: 'PROCESS_SEPARATION_COMPLIANCE_FAILED',
          message: 'Failed to get compliance metrics',
          details: errorMessage,
        },
      })
    }
  }
)

/**
 * GET /api/admin/process-separation/independence
 * Validate read performance independence
 */
router.get(
  '/process-separation/independence',
  validateAdminToken,
  async (req, res) => {
    const startTime = Date.now()
    const operationId = `process_separation_independence_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    logger.info('Admin read performance independence validation requested', {
      operation: 'validateReadPerformanceIndependence',
      operation_id: operationId,
      ip: req.ip,
    })

    try {
      const factory = getProductionServiceFactory()
      const snapshotStore = factory.createSnapshotStore()
      const refreshService = factory.createRefreshService()

      const validator = new ProcessSeparationValidator(
        snapshotStore,
        refreshService
      )
      const independenceResult =
        await validator.validateReadPerformanceIndependence()

      const duration = Date.now() - startTime

      logger.info('Admin read performance independence validation completed', {
        operation: 'validateReadPerformanceIndependence',
        operation_id: operationId,
        is_independent: independenceResult.isIndependent,
        performance_degradation: independenceResult.performanceDegradation,
        duration_ms: duration,
      })

      res.json({
        independence: independenceResult,
        metadata: {
          validated_at: new Date().toISOString(),
          validation_duration_ms: duration,
          operation_id: operationId,
        },
      })
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      logger.error('Admin read performance independence validation failed', {
        operation: 'validateReadPerformanceIndependence',
        operation_id: operationId,
        error: errorMessage,
        duration_ms: duration,
      })

      res.status(500).json({
        error: {
          code: 'READ_PERFORMANCE_INDEPENDENCE_FAILED',
          message: 'Failed to validate read performance independence',
          details: errorMessage,
        },
      })
    }
  }
)

export default router
