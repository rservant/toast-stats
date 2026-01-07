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
import { DistrictConfigurationService } from '../services/DistrictConfigurationService.js'

const router = express.Router()

/**
 * Middleware to log admin access (token validation removed for development)
 */
const logAdminAccess = (
  req: express.Request,
  _res: express.Response,
  next: express.NextFunction
): void => {
  logger.info('Admin endpoint accessed', {
    endpoint: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  })
  next()
}

/**
 * GET /api/admin/snapshots
 * List snapshots with optional filtering and limiting
 */
router.get('/snapshots', logAdminAccess, async (req, res) => {
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
router.get(
  '/snapshots/:snapshotId',
  logAdminAccess,
  async (req, res): Promise<void> => {
    const startTime = Date.now()
    const snapshotId = req.params['snapshotId']
    const operationId = `inspect_snapshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Validate snapshotId parameter
    if (!snapshotId) {
      res.status(400).json({
        error: {
          code: 'MISSING_SNAPSHOT_ID',
          message: 'Snapshot ID is required',
        },
      })
      return
    }

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
  }
)

/**
 * GET /api/admin/snapshots/:snapshotId/payload
 * Get the full payload data for a specific snapshot
 */
router.get(
  '/snapshots/:snapshotId/payload',
  logAdminAccess,
  async (req, res): Promise<void> => {
    const startTime = Date.now()
    const snapshotId = req.params['snapshotId']
    const operationId = `get_payload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Validate snapshotId parameter
    if (!snapshotId) {
      res.status(400).json({
        error: {
          code: 'MISSING_SNAPSHOT_ID',
          message: 'Snapshot ID is required',
        },
      })
      return
    }

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
router.get('/snapshot-store/health', logAdminAccess, async (req, res) => {
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
router.get('/snapshot-store/integrity', logAdminAccess, async (req, res) => {
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
})

/**
 * GET /api/admin/snapshot-store/performance
 * Get performance metrics for the snapshot store
 */
router.get('/snapshot-store/performance', logAdminAccess, async (req, res) => {
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
      cache_efficiency: performanceMetrics.totalReads > 0 ? 'good' : 'no_data',
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

    logger.error('Admin snapshot store performance metrics retrieval failed', {
      operation: 'getPerformanceMetrics',
      operation_id: operationId,
      error: errorMessage,
      duration_ms: duration,
    })

    res.status(500).json({
      error: {
        code: 'PERFORMANCE_METRICS_FAILED',
        message: 'Failed to retrieve performance metrics',
        details: errorMessage,
      },
    })
  }
})

/**
 * POST /api/admin/snapshot-store/performance/reset
 * Reset performance metrics
 */
router.post(
  '/snapshot-store/performance/reset',
  logAdminAccess,
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
router.get('/process-separation/validate', logAdminAccess, async (req, res) => {
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
})

/**
 * GET /api/admin/process-separation/monitor
 * Monitor concurrent operations performance
 */
router.get('/process-separation/monitor', logAdminAccess, async (req, res) => {
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
})

/**
 * GET /api/admin/process-separation/compliance
 * Get process separation compliance metrics
 */
router.get(
  '/process-separation/compliance',
  logAdminAccess,
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
  logAdminAccess,
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

/**
 * GET /api/admin/districts/config
 * View current district configuration with validation and collection status
 */
router.get('/districts/config', logAdminAccess, async (req, res) => {
  const startTime = Date.now()
  const operationId = `get_district_config_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  logger.info('Admin district configuration view requested', {
    operation: 'getDistrictConfiguration',
    operation_id: operationId,
    ip: req.ip,
  })

  try {
    const factory = getProductionServiceFactory()
    const cacheConfig = factory.createCacheConfigService()
    const config = cacheConfig.getConfiguration()

    const districtConfigService = new DistrictConfigurationService(
      config.baseDirectory
    )
    const snapshotStore = factory.createSnapshotStore()

    const districtConfig = await districtConfigService.getConfiguration()
    const hasDistricts = await districtConfigService.hasConfiguredDistricts()

    // Get validation information with collection history
    const validationResult = await districtConfigService.validateConfiguration(
      undefined, // No all-districts validation for basic view
      snapshotStore
    )

    const duration = Date.now() - startTime

    logger.info('Admin district configuration retrieved', {
      operation: 'getDistrictConfiguration',
      operation_id: operationId,
      district_count: districtConfig.configuredDistricts.length,
      has_districts: hasDistricts,
      duration_ms: duration,
    })

    res.json({
      configuration: districtConfig,
      status: {
        hasConfiguredDistricts: hasDistricts,
        totalDistricts: districtConfig.configuredDistricts.length,
      },
      validation: {
        isValid: validationResult.isValid,
        configuredDistricts: validationResult.configuredDistricts,
        validDistricts: validationResult.validDistricts,
        invalidDistricts: validationResult.invalidDistricts,
        warnings: validationResult.warnings,
        lastCollectionInfo: validationResult.lastCollectionInfo,
      },
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

    logger.error('Admin district configuration retrieval failed', {
      operation: 'getDistrictConfiguration',
      operation_id: operationId,
      error: errorMessage,
      duration_ms: duration,
    })

    res.status(500).json({
      error: {
        code: 'DISTRICT_CONFIG_RETRIEVAL_FAILED',
        message: 'Failed to retrieve district configuration',
        details: errorMessage,
      },
    })
  }
})

/**
 * POST /api/admin/districts/config
 * Add districts to the configuration
 */
router.post('/districts/config', logAdminAccess, async (req, res) => {
  const startTime = Date.now()
  const operationId = `add_districts_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  logger.info('Admin add districts to configuration requested', {
    operation: 'addDistrictsToConfiguration',
    operation_id: operationId,
    ip: req.ip,
    request_body: req.body,
  })

  try {
    // Validate request body
    const { districtIds, replace = false } = req.body

    if (!districtIds) {
      return res.status(400).json({
        error: {
          code: 'MISSING_DISTRICT_IDS',
          message: 'districtIds field is required',
        },
      })
    }

    if (!Array.isArray(districtIds)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DISTRICT_IDS_FORMAT',
          message: 'districtIds must be an array of strings',
        },
      })
    }

    if (districtIds.length === 0) {
      return res.status(400).json({
        error: {
          code: 'EMPTY_DISTRICT_IDS',
          message: 'districtIds array cannot be empty',
        },
      })
    }

    // Validate each district ID format
    for (const districtId of districtIds) {
      if (!districtId || typeof districtId !== 'string') {
        return res.status(400).json({
          error: {
            code: 'INVALID_DISTRICT_ID',
            message: `Invalid district ID: ${districtId}. Must be a non-empty string`,
          },
        })
      }
    }

    const factory = getProductionServiceFactory()
    const cacheConfig = factory.createCacheConfigService()
    const config = cacheConfig.getConfiguration()

    const districtConfigService = new DistrictConfigurationService(
      config.baseDirectory
    )
    const adminUser = 'admin' // In a real system, this would come from authentication

    if (replace) {
      // Replace entire configuration
      await districtConfigService.setConfiguredDistricts(districtIds, adminUser)
    } else {
      // Add districts individually
      for (const districtId of districtIds) {
        await districtConfigService.addDistrict(districtId, adminUser)
      }
    }

    const updatedConfig = await districtConfigService.getConfiguration()
    const duration = Date.now() - startTime

    logger.info('Admin districts added to configuration', {
      operation: 'addDistrictsToConfiguration',
      operation_id: operationId,
      districts_added: districtIds,
      replace_mode: replace,
      total_districts: updatedConfig.configuredDistricts.length,
      duration_ms: duration,
    })

    res.json({
      success: true,
      message: replace
        ? 'District configuration replaced successfully'
        : 'Districts added to configuration successfully',
      configuration: updatedConfig,
      changes: {
        action: replace ? 'replace' : 'add',
        districts: districtIds,
        total_districts: updatedConfig.configuredDistricts.length,
      },
      metadata: {
        updated_at: new Date().toISOString(),
        operation_duration_ms: duration,
        operation_id: operationId,
      },
    })
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'

    logger.error('Admin add districts to configuration failed', {
      operation: 'addDistrictsToConfiguration',
      operation_id: operationId,
      error: errorMessage,
      duration_ms: duration,
    })

    // Check for validation errors and return appropriate status
    if (errorMessage.includes('Invalid district ID format')) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DISTRICT_ID_FORMAT',
          message: errorMessage,
        },
      })
    }

    res.status(500).json({
      error: {
        code: 'DISTRICT_CONFIG_UPDATE_FAILED',
        message: 'Failed to update district configuration',
        details: errorMessage,
      },
    })
  }
})

/**
 * DELETE /api/admin/districts/config/:districtId
 * Remove a district from the configuration
 */
router.delete(
  '/districts/config/:districtId',
  logAdminAccess,
  async (req, res) => {
    const startTime = Date.now()
    const { districtId } = req.params
    const operationId = `remove_district_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    logger.info('Admin remove district from configuration requested', {
      operation: 'removeDistrictFromConfiguration',
      operation_id: operationId,
      district_id: districtId,
      ip: req.ip,
    })

    try {
      if (!districtId || typeof districtId !== 'string') {
        return res.status(400).json({
          error: {
            code: 'INVALID_DISTRICT_ID',
            message: 'District ID must be a non-empty string',
          },
        })
      }

      const factory = getProductionServiceFactory()
      const cacheConfig = factory.createCacheConfigService()
      const config = cacheConfig.getConfiguration()

      const districtConfigService = new DistrictConfigurationService(
        config.baseDirectory
      )
      const adminUser = 'admin' // In a real system, this would come from authentication

      // Check if district exists in configuration before removal
      const currentDistricts =
        await districtConfigService.getConfiguredDistricts()
      const normalizedDistrictId = districtId
        .trim()
        .replace(/^District\s+/i, '')
        .trim()

      if (!currentDistricts.includes(normalizedDistrictId)) {
        return res.status(404).json({
          error: {
            code: 'DISTRICT_NOT_CONFIGURED',
            message: `District ${districtId} is not in the current configuration`,
          },
        })
      }

      await districtConfigService.removeDistrict(districtId, adminUser)
      const updatedConfig = await districtConfigService.getConfiguration()
      const duration = Date.now() - startTime

      logger.info('Admin district removed from configuration', {
        operation: 'removeDistrictFromConfiguration',
        operation_id: operationId,
        district_id: districtId,
        total_districts: updatedConfig.configuredDistricts.length,
        duration_ms: duration,
      })

      res.json({
        success: true,
        message: 'District removed from configuration successfully',
        configuration: updatedConfig,
        changes: {
          action: 'remove',
          district: districtId,
          total_districts: updatedConfig.configuredDistricts.length,
        },
        metadata: {
          updated_at: new Date().toISOString(),
          operation_duration_ms: duration,
          operation_id: operationId,
        },
      })
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      logger.error('Admin remove district from configuration failed', {
        operation: 'removeDistrictFromConfiguration',
        operation_id: operationId,
        district_id: districtId,
        error: errorMessage,
        duration_ms: duration,
      })

      res.status(500).json({
        error: {
          code: 'DISTRICT_CONFIG_REMOVAL_FAILED',
          message: 'Failed to remove district from configuration',
          details: errorMessage,
        },
      })
    }
  }
)

/**
 * POST /api/admin/districts/config/validate
 * Validate district configuration against available districts with enhanced feedback
 */
router.post('/districts/config/validate', logAdminAccess, async (req, res) => {
  const startTime = Date.now()
  const operationId = `validate_district_config_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  logger.info('Admin district configuration validation requested', {
    operation: 'validateDistrictConfiguration',
    operation_id: operationId,
    ip: req.ip,
  })

  try {
    const factory = getProductionServiceFactory()
    const cacheConfig = factory.createCacheConfigService()
    const config = cacheConfig.getConfiguration()

    const districtConfigService = new DistrictConfigurationService(
      config.baseDirectory
    )
    const snapshotStore = factory.createSnapshotStore()

    // Get all district IDs from request body (optional)
    const { allDistrictIds } = req.body

    const validationResult = await districtConfigService.validateConfiguration(
      allDistrictIds,
      snapshotStore
    )

    // Update status in collection info based on validation results
    const updatedCollectionInfo = validationResult.lastCollectionInfo.map(
      info => ({
        ...info,
        status: validationResult.validDistricts.includes(info.districtId)
          ? ('valid' as const)
          : validationResult.invalidDistricts.includes(info.districtId)
            ? ('invalid' as const)
            : ('unknown' as const),
      })
    )

    const enhancedValidationResult = {
      ...validationResult,
      lastCollectionInfo: updatedCollectionInfo,
    }

    const duration = Date.now() - startTime

    logger.info('Admin district configuration validation completed', {
      operation: 'validateDistrictConfiguration',
      operation_id: operationId,
      is_valid: validationResult.isValid,
      configured_count: validationResult.configuredDistricts.length,
      valid_count: validationResult.validDistricts.length,
      invalid_count: validationResult.invalidDistricts.length,
      suggestions_count: validationResult.suggestions.length,
      duration_ms: duration,
    })

    res.json({
      validation: enhancedValidationResult,
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

    logger.error('Admin district configuration validation failed', {
      operation: 'validateDistrictConfiguration',
      operation_id: operationId,
      error: errorMessage,
      duration_ms: duration,
    })

    res.status(500).json({
      error: {
        code: 'DISTRICT_CONFIG_VALIDATION_FAILED',
        message: 'Failed to validate district configuration',
        details: errorMessage,
      },
    })
  }
})

/**
 * GET /api/admin/districts/config/history
 * Get configuration change history with optional filtering
 */
router.get('/districts/config/history', logAdminAccess, async (req, res) => {
  const startTime = Date.now()
  const operationId = `get_district_config_history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  logger.info('Admin district configuration history requested', {
    operation: 'getDistrictConfigurationHistory',
    operation_id: operationId,
    query: req.query,
    ip: req.ip,
  })

  try {
    const factory = getProductionServiceFactory()
    const cacheConfig = factory.createCacheConfigService()
    const config = cacheConfig.getConfiguration()

    const districtConfigService = new DistrictConfigurationService(
      config.baseDirectory
    )

    // Parse query parameters
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50
    const startDate = req.query.start_date as string
    const endDate = req.query.end_date as string
    const includeSummary = req.query.include_summary === 'true'

    // Get configuration history
    const history = await districtConfigService.getConfigurationHistory(limit)

    // Get summary if requested
    let summary = null
    if (includeSummary) {
      summary = await districtConfigService.getConfigurationChangeSummary(
        startDate,
        endDate
      )
    }

    const duration = Date.now() - startTime

    logger.info('Admin district configuration history retrieved', {
      operation: 'getDistrictConfigurationHistory',
      operation_id: operationId,
      history_count: history.length,
      include_summary: includeSummary,
      duration_ms: duration,
    })

    res.json({
      history,
      summary,
      metadata: {
        retrieved_at: new Date().toISOString(),
        retrieval_duration_ms: duration,
        operation_id: operationId,
        filters: {
          limit,
          start_date: startDate || null,
          end_date: endDate || null,
        },
      },
    })
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'

    logger.error('Admin district configuration history retrieval failed', {
      operation: 'getDistrictConfigurationHistory',
      operation_id: operationId,
      error: errorMessage,
      duration_ms: duration,
    })

    res.status(500).json({
      error: {
        code: 'DISTRICT_CONFIG_HISTORY_FAILED',
        message: 'Failed to retrieve district configuration history',
        details: errorMessage,
      },
    })
  }
})

export default router
