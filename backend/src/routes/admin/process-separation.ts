/**
 * Process separation routes for admin API
 *
 * Provides endpoints for:
 * - Process separation validation
 * - Concurrent operations monitoring
 * - Compliance metrics retrieval
 * - Read performance independence validation
 *
 * Requirements: 4.1, 4.2, 4.3
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
import { ProcessSeparationValidator } from '../../services/ProcessSeparationValidator.js'

export const processSeparationRouter = Router()

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /api/admin/process-separation/validate
 * Validate process separation compliance
 *
 * Returns:
 * - validation: Process separation validation results
 * - metadata: Operation metadata including timing
 *
 * Requirements: 4.1
 */
processSeparationRouter.get(
  '/process-separation/validate',
  logAdminAccess,
  async (req, res) => {
    const startTime = Date.now()
    const operationId = generateOperationId('process_separation_validate')

    logger.info('Admin process separation validation requested', {
      operation: 'validateProcessSeparation',
      operation_id: operationId,
      ip: req.ip,
    })

    try {
      const factory = getServiceFactory()
      // Use ISnapshotStorage interface for storage abstraction layer support
      // This enables environment-based selection between local and cloud storage
      const snapshotStorage = factory.createSnapshotStorage()
      const refreshService = factory.createRefreshService()

      // ProcessSeparationValidator accepts SnapshotStore which is compatible with ISnapshotStorage
      const validator = new ProcessSeparationValidator(
        snapshotStorage,
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
 *
 * Returns:
 * - monitoring: Concurrent operations monitoring results
 * - metadata: Operation metadata including timing
 *
 * Requirements: 4.2
 */
processSeparationRouter.get(
  '/process-separation/monitor',
  logAdminAccess,
  async (req, res) => {
    const startTime = Date.now()
    const operationId = generateOperationId('process_separation_monitor')

    logger.info('Admin process separation monitoring requested', {
      operation: 'monitorConcurrentOperations',
      operation_id: operationId,
      ip: req.ip,
    })

    try {
      const factory = getServiceFactory()
      // Use ISnapshotStorage interface for storage abstraction layer support
      // This enables environment-based selection between local and cloud storage
      const snapshotStorage = factory.createSnapshotStorage()
      const refreshService = factory.createRefreshService()

      // ProcessSeparationValidator accepts SnapshotStore which is compatible with ISnapshotStorage
      const validator = new ProcessSeparationValidator(
        snapshotStorage,
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
 *
 * Returns:
 * - compliance: Compliance metrics including score and health status
 * - metadata: Operation metadata including timing
 *
 * Requirements: 4.2
 */
processSeparationRouter.get(
  '/process-separation/compliance',
  logAdminAccess,
  async (req, res) => {
    const startTime = Date.now()
    const operationId = generateOperationId('process_separation_compliance')

    logger.info('Admin process separation compliance metrics requested', {
      operation: 'getComplianceMetrics',
      operation_id: operationId,
      ip: req.ip,
    })

    try {
      const factory = getServiceFactory()
      // Use ISnapshotStorage interface for storage abstraction layer support
      // This enables environment-based selection between local and cloud storage
      const snapshotStorage = factory.createSnapshotStorage()
      const refreshService = factory.createRefreshService()

      // ProcessSeparationValidator accepts SnapshotStore which is compatible with ISnapshotStorage
      const validator = new ProcessSeparationValidator(
        snapshotStorage,
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
 *
 * Returns:
 * - independence: Read performance independence validation results
 * - metadata: Operation metadata including timing
 *
 * Requirements: 4.2
 */
processSeparationRouter.get(
  '/process-separation/independence',
  logAdminAccess,
  async (req, res) => {
    const startTime = Date.now()
    const operationId = generateOperationId('process_separation_independence')

    logger.info('Admin read performance independence validation requested', {
      operation: 'validateReadPerformanceIndependence',
      operation_id: operationId,
      ip: req.ip,
    })

    try {
      const factory = getServiceFactory()
      // Use ISnapshotStorage interface for storage abstraction layer support
      // This enables environment-based selection between local and cloud storage
      const snapshotStorage = factory.createSnapshotStorage()
      const refreshService = factory.createRefreshService()

      // ProcessSeparationValidator accepts SnapshotStore which is compatible with ISnapshotStorage
      const validator = new ProcessSeparationValidator(
        snapshotStorage,
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
