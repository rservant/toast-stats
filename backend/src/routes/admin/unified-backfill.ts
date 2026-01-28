/**
 * Unified Backfill API Routes
 *
 * Provides endpoints for the Unified Backfill Service:
 * - POST /api/admin/backfill - Create new backfill job
 * - GET /api/admin/backfill/:jobId - Get job status
 * - DELETE /api/admin/backfill/:jobId - Cancel job
 * - GET /api/admin/backfill/jobs - List job history
 * - POST /api/admin/backfill/preview - Dry run preview
 * - GET /api/admin/backfill/config/rate-limit - Get rate limit config
 * - PUT /api/admin/backfill/config/rate-limit - Update rate limit config
 *
 * These endpoints enable system operators to manage backfill operations
 * for both data collection (historical snapshots) and analytics generation.
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 11.2, 12.1, 12.2
 */

import { Router, type Request, type Response } from 'express'
import { logAdminAccess, generateOperationId } from './shared.js'
import { logger } from '../../utils/logger.js'
import { getUnifiedBackfillServiceInstance } from '../../index.js'
import type { UnifiedBackfillService } from '../../services/backfill/unified/UnifiedBackfillService.js'
import type {
  CreateJobRequest,
  CreateJobResponse,
  JobStatusResponse,
  ListJobsResponse,
  JobPreviewResponse,
  ErrorResponse,
} from '../../types/backfillJob.js'
import { BACKFILL_ERROR_CODES } from '../../types/backfillJob.js'
import type {
  RateLimitConfig,
  BackfillJobType,
} from '../../types/storageInterfaces.js'

export const unifiedBackfillRouter = Router()

// ============================================================================
// Service Instance Management
// ============================================================================

/**
 * Mock service instance for testing
 * When set, this takes precedence over the singleton from index.ts
 */
let mockUnifiedBackfillService: UnifiedBackfillService | null = null

/**
 * Get the UnifiedBackfillService instance
 * Uses the singleton from index.ts (shared with server startup for recovery)
 * Falls back to mock service if set (for testing)
 */
async function getUnifiedBackfillService(): Promise<UnifiedBackfillService> {
  // Use mock service if set (for testing)
  if (mockUnifiedBackfillService) {
    return mockUnifiedBackfillService
  }

  // Use the singleton from index.ts
  return getUnifiedBackfillServiceInstance()
}

/**
 * Reset the service instance (for testing)
 * Note: This only resets the mock, not the singleton from index.ts
 */
export function resetUnifiedBackfillService(): void {
  mockUnifiedBackfillService = null
}

/**
 * Set a mock service instance (for testing)
 * This allows tests to inject a mock service without going through the factory
 */
export function setUnifiedBackfillService(
  service: UnifiedBackfillService | null
): void {
  mockUnifiedBackfillService = service
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate date format (YYYY-MM-DD)
 */
function isValidDateFormat(date: string): boolean {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/
  if (!datePattern.test(date)) {
    return false
  }
  // Verify it's a valid date
  const parsed = new Date(date)
  return !isNaN(parsed.getTime())
}

/**
 * Validate job type
 */
function isValidJobType(jobType: unknown): jobType is BackfillJobType {
  return jobType === 'data-collection' || jobType === 'analytics-generation'
}

/**
 * Create error response
 */
function createErrorResponse(
  code: string,
  message: string,
  operationId: string,
  details?: string,
  retryable?: boolean
): ErrorResponse {
  return {
    error: {
      code,
      message,
      details,
      retryable,
    },
    metadata: {
      operationId,
      timestamp: new Date().toISOString(),
    },
  }
}

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * POST /api/admin/backfill
 * Create a new backfill job
 *
 * Request Body:
 * - jobType: 'data-collection' | 'analytics-generation' (required)
 * - startDate: string (YYYY-MM-DD, required for data-collection)
 * - endDate: string (YYYY-MM-DD, required for data-collection)
 * - targetDistricts: string[] (optional)
 * - skipExisting: boolean (optional, defaults to true)
 * - rateLimitOverrides: Partial<RateLimitConfig> (optional)
 *
 * Requirements: 9.2
 */
unifiedBackfillRouter.post(
  '/',
  logAdminAccess,
  async (req: Request, res: Response): Promise<void> => {
    const operationId = generateOperationId('create_backfill_job')

    logger.info('Create backfill job requested', {
      operation: 'POST /api/admin/backfill',
      operationId,
      ip: req.ip,
    })

    try {
      const body = req.body as Record<string, unknown>

      // Validate jobType (required)
      if (!body['jobType']) {
        res
          .status(400)
          .json(
            createErrorResponse(
              BACKFILL_ERROR_CODES.VALIDATION_ERROR,
              'jobType is required',
              operationId,
              'jobType must be either "data-collection" or "analytics-generation"'
            )
          )
        return
      }

      if (!isValidJobType(body['jobType'])) {
        res
          .status(400)
          .json(
            createErrorResponse(
              BACKFILL_ERROR_CODES.INVALID_JOB_TYPE,
              'Invalid job type',
              operationId,
              `jobType must be either "data-collection" or "analytics-generation", got: ${String(body['jobType'])}`
            )
          )
        return
      }

      const jobType = body['jobType']

      // Validate dates for data-collection jobs
      if (jobType === 'data-collection') {
        if (!body['startDate'] || typeof body['startDate'] !== 'string') {
          res
            .status(400)
            .json(
              createErrorResponse(
                BACKFILL_ERROR_CODES.VALIDATION_ERROR,
                'startDate is required for data-collection jobs',
                operationId
              )
            )
          return
        }

        if (!body['endDate'] || typeof body['endDate'] !== 'string') {
          res
            .status(400)
            .json(
              createErrorResponse(
                BACKFILL_ERROR_CODES.VALIDATION_ERROR,
                'endDate is required for data-collection jobs',
                operationId
              )
            )
          return
        }
      }

      // Validate date formats if provided
      const startDate = body['startDate'] as string | undefined
      const endDate = body['endDate'] as string | undefined

      if (startDate && !isValidDateFormat(startDate)) {
        res
          .status(400)
          .json(
            createErrorResponse(
              BACKFILL_ERROR_CODES.INVALID_DATE_RANGE,
              'Invalid startDate format',
              operationId,
              'startDate must be in YYYY-MM-DD format'
            )
          )
        return
      }

      if (endDate && !isValidDateFormat(endDate)) {
        res
          .status(400)
          .json(
            createErrorResponse(
              BACKFILL_ERROR_CODES.INVALID_DATE_RANGE,
              'Invalid endDate format',
              operationId,
              'endDate must be in YYYY-MM-DD format'
            )
          )
        return
      }

      // Validate date range
      if (startDate && endDate && startDate > endDate) {
        res
          .status(400)
          .json(
            createErrorResponse(
              BACKFILL_ERROR_CODES.INVALID_DATE_RANGE,
              'startDate must be before or equal to endDate',
              operationId
            )
          )
        return
      }

      // Validate endDate is before today (dashboard data is delayed)
      if (endDate) {
        const today = new Date().toISOString().split('T')[0]
        if (endDate && today && endDate >= today) {
          res
            .status(400)
            .json(
              createErrorResponse(
                BACKFILL_ERROR_CODES.INVALID_DATE_RANGE,
                'endDate must be before today',
                operationId,
                'Dashboard data is delayed, so endDate must be in the past'
              )
            )
          return
        }
      }

      // Validate targetDistricts if provided
      let targetDistricts: string[] | undefined
      if (body['targetDistricts'] !== undefined) {
        if (!Array.isArray(body['targetDistricts'])) {
          res
            .status(400)
            .json(
              createErrorResponse(
                BACKFILL_ERROR_CODES.VALIDATION_ERROR,
                'targetDistricts must be an array',
                operationId
              )
            )
          return
        }

        const invalidDistricts = (body['targetDistricts'] as unknown[]).filter(
          d => typeof d !== 'string'
        )
        if (invalidDistricts.length > 0) {
          res
            .status(400)
            .json(
              createErrorResponse(
                BACKFILL_ERROR_CODES.VALIDATION_ERROR,
                'All targetDistricts must be strings',
                operationId
              )
            )
          return
        }

        targetDistricts = body['targetDistricts'] as string[]
      }

      // Build request
      const request: CreateJobRequest = {
        jobType,
        startDate,
        endDate,
        targetDistricts,
        skipExisting: body['skipExisting'] !== false, // Default to true
        rateLimitOverrides: body['rateLimitOverrides'] as
          | Partial<RateLimitConfig>
          | undefined,
      }

      // Create the job
      const service = await getUnifiedBackfillService()
      const job = await service.createJob(request)

      const response: CreateJobResponse = {
        jobId: job.jobId,
        status: job.status,
        message: 'Backfill job created and queued for processing',
        metadata: {
          operationId,
          createdAt: job.createdAt,
        },
      }

      logger.info('Backfill job created', {
        operation: 'POST /api/admin/backfill',
        operationId,
        jobId: job.jobId,
        jobType: job.jobType,
      })

      res.status(202).json(response)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      logger.error('Failed to create backfill job', {
        operation: 'POST /api/admin/backfill',
        operationId,
        error: errorMessage,
      })

      // Check for specific error types
      if (
        errorMessage.includes('already running') ||
        errorMessage.includes('one job at a time')
      ) {
        res
          .status(409)
          .json(
            createErrorResponse(
              BACKFILL_ERROR_CODES.JOB_ALREADY_RUNNING,
              'A backfill job is already running',
              operationId,
              errorMessage,
              false
            )
          )
        return
      }

      res
        .status(500)
        .json(
          createErrorResponse(
            BACKFILL_ERROR_CODES.STORAGE_ERROR,
            'Failed to create backfill job',
            operationId,
            errorMessage,
            true
          )
        )
    }
  }
)

/**
 * GET /api/admin/backfill/jobs
 * List job history with optional filtering and pagination
 *
 * Query Parameters:
 * - limit: number (optional, default 20)
 * - offset: number (optional, default 0)
 * - status: string (optional, comma-separated list of statuses)
 * - jobType: string (optional, comma-separated list of job types)
 *
 * Requirements: 9.5
 */
unifiedBackfillRouter.get(
  '/jobs',
  logAdminAccess,
  async (req: Request, res: Response): Promise<void> => {
    const operationId = generateOperationId('list_backfill_jobs')

    logger.info('List backfill jobs requested', {
      operation: 'GET /api/admin/backfill/jobs',
      operationId,
      ip: req.ip,
    })

    try {
      // Parse query parameters
      const limitParam = req.query['limit']
      const offsetParam = req.query['offset']
      const statusParam = req.query['status']
      const jobTypeParam = req.query['jobType']

      const limit = limitParam ? parseInt(String(limitParam), 10) : 20
      const offset = offsetParam ? parseInt(String(offsetParam), 10) : 0

      // Validate limit and offset
      if (isNaN(limit) || limit < 1 || limit > 100) {
        res
          .status(400)
          .json(
            createErrorResponse(
              BACKFILL_ERROR_CODES.VALIDATION_ERROR,
              'Invalid limit parameter',
              operationId,
              'limit must be a number between 1 and 100'
            )
          )
        return
      }

      if (isNaN(offset) || offset < 0) {
        res
          .status(400)
          .json(
            createErrorResponse(
              BACKFILL_ERROR_CODES.VALIDATION_ERROR,
              'Invalid offset parameter',
              operationId,
              'offset must be a non-negative number'
            )
          )
        return
      }

      // Parse status filter
      let statusFilter: string[] | undefined
      if (statusParam && typeof statusParam === 'string') {
        statusFilter = statusParam.split(',').map(s => s.trim())
        const validStatuses = [
          'pending',
          'running',
          'completed',
          'failed',
          'cancelled',
          'recovering',
        ]
        const invalidStatuses = statusFilter.filter(
          s => !validStatuses.includes(s)
        )
        if (invalidStatuses.length > 0) {
          res
            .status(400)
            .json(
              createErrorResponse(
                BACKFILL_ERROR_CODES.VALIDATION_ERROR,
                'Invalid status filter',
                operationId,
                `Invalid statuses: ${invalidStatuses.join(', ')}. Valid values: ${validStatuses.join(', ')}`
              )
            )
          return
        }
      }

      // Parse jobType filter
      let jobTypeFilter: BackfillJobType[] | undefined
      if (jobTypeParam && typeof jobTypeParam === 'string') {
        const types = jobTypeParam.split(',').map(t => t.trim())
        const validTypes = ['data-collection', 'analytics-generation']
        const invalidTypes = types.filter(t => !validTypes.includes(t))
        if (invalidTypes.length > 0) {
          res
            .status(400)
            .json(
              createErrorResponse(
                BACKFILL_ERROR_CODES.VALIDATION_ERROR,
                'Invalid jobType filter',
                operationId,
                `Invalid job types: ${invalidTypes.join(', ')}. Valid values: ${validTypes.join(', ')}`
              )
            )
          return
        }
        jobTypeFilter = types as BackfillJobType[]
      }

      const service = await getUnifiedBackfillService()
      const jobs = await service.listJobs({
        limit: limit + 1, // Fetch one extra to determine if there are more
        offset,
        status: statusFilter as
          | import('../../types/storageInterfaces.js').BackfillJobStatus[]
          | undefined,
        jobType: jobTypeFilter,
      })

      // Determine total (simplified - in production you'd want a count query)
      const hasMore = jobs.length > limit
      const returnedJobs = hasMore ? jobs.slice(0, limit) : jobs

      const response: ListJobsResponse = {
        jobs: returnedJobs,
        total: offset + jobs.length, // Approximate total
        limit,
        offset,
        metadata: {
          operationId,
          retrievedAt: new Date().toISOString(),
        },
      }

      logger.debug('Backfill jobs listed', {
        operation: 'GET /api/admin/backfill/jobs',
        operationId,
        count: returnedJobs.length,
      })

      res.json(response)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      logger.error('Failed to list backfill jobs', {
        operation: 'GET /api/admin/backfill/jobs',
        operationId,
        error: errorMessage,
      })

      res
        .status(500)
        .json(
          createErrorResponse(
            BACKFILL_ERROR_CODES.STORAGE_ERROR,
            'Failed to list backfill jobs',
            operationId,
            errorMessage,
            true
          )
        )
    }
  }
)

/**
 * POST /api/admin/backfill/preview
 * Preview what a backfill job would process (dry run)
 *
 * Request Body: Same as POST /api/admin/backfill
 *
 * Requirements: 11.2
 */
unifiedBackfillRouter.post(
  '/preview',
  logAdminAccess,
  async (req: Request, res: Response): Promise<void> => {
    const operationId = generateOperationId('preview_backfill_job')

    logger.info('Preview backfill job requested', {
      operation: 'POST /api/admin/backfill/preview',
      operationId,
      ip: req.ip,
    })

    try {
      const body = req.body as Record<string, unknown>

      // Validate jobType (required)
      if (!body['jobType']) {
        res
          .status(400)
          .json(
            createErrorResponse(
              BACKFILL_ERROR_CODES.VALIDATION_ERROR,
              'jobType is required',
              operationId
            )
          )
        return
      }

      if (!isValidJobType(body['jobType'])) {
        res
          .status(400)
          .json(
            createErrorResponse(
              BACKFILL_ERROR_CODES.INVALID_JOB_TYPE,
              'Invalid job type',
              operationId,
              `jobType must be either "data-collection" or "analytics-generation"`
            )
          )
        return
      }

      const jobType = body['jobType']

      // Validate dates for data-collection jobs
      if (jobType === 'data-collection') {
        if (!body['startDate'] || typeof body['startDate'] !== 'string') {
          res
            .status(400)
            .json(
              createErrorResponse(
                BACKFILL_ERROR_CODES.VALIDATION_ERROR,
                'startDate is required for data-collection jobs',
                operationId
              )
            )
          return
        }

        if (!body['endDate'] || typeof body['endDate'] !== 'string') {
          res
            .status(400)
            .json(
              createErrorResponse(
                BACKFILL_ERROR_CODES.VALIDATION_ERROR,
                'endDate is required for data-collection jobs',
                operationId
              )
            )
          return
        }
      }

      // Validate date formats
      const startDate = body['startDate'] as string | undefined
      const endDate = body['endDate'] as string | undefined

      if (startDate && !isValidDateFormat(startDate)) {
        res
          .status(400)
          .json(
            createErrorResponse(
              BACKFILL_ERROR_CODES.INVALID_DATE_RANGE,
              'Invalid startDate format',
              operationId,
              'startDate must be in YYYY-MM-DD format'
            )
          )
        return
      }

      if (endDate && !isValidDateFormat(endDate)) {
        res
          .status(400)
          .json(
            createErrorResponse(
              BACKFILL_ERROR_CODES.INVALID_DATE_RANGE,
              'Invalid endDate format',
              operationId,
              'endDate must be in YYYY-MM-DD format'
            )
          )
        return
      }

      if (startDate && endDate && startDate > endDate) {
        res
          .status(400)
          .json(
            createErrorResponse(
              BACKFILL_ERROR_CODES.INVALID_DATE_RANGE,
              'startDate must be before or equal to endDate',
              operationId
            )
          )
        return
      }

      // Build request
      const request: CreateJobRequest = {
        jobType,
        startDate,
        endDate,
        targetDistricts: body['targetDistricts'] as string[] | undefined,
        skipExisting: body['skipExisting'] !== false,
      }

      const service = await getUnifiedBackfillService()
      const preview = await service.previewJob(request)

      const response: JobPreviewResponse = {
        preview,
        metadata: {
          operationId,
          generatedAt: new Date().toISOString(),
        },
      }

      logger.info('Backfill preview generated', {
        operation: 'POST /api/admin/backfill/preview',
        operationId,
        jobType: preview.jobType,
        totalItems: preview.totalItems,
      })

      res.json(response)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      logger.error('Failed to generate backfill preview', {
        operation: 'POST /api/admin/backfill/preview',
        operationId,
        error: errorMessage,
      })

      res
        .status(500)
        .json(
          createErrorResponse(
            BACKFILL_ERROR_CODES.STORAGE_ERROR,
            'Failed to generate backfill preview',
            operationId,
            errorMessage,
            true
          )
        )
    }
  }
)

/**
 * GET /api/admin/backfill/config/rate-limit
 * Get the current rate limit configuration
 *
 * Requirements: 12.1
 */
unifiedBackfillRouter.get(
  '/config/rate-limit',
  logAdminAccess,
  async (req: Request, res: Response): Promise<void> => {
    const operationId = generateOperationId('get_rate_limit_config')

    logger.info('Get rate limit config requested', {
      operation: 'GET /api/admin/backfill/config/rate-limit',
      operationId,
      ip: req.ip,
    })

    try {
      const service = await getUnifiedBackfillService()
      const config = await service.getRateLimitConfig()

      res.json({
        config,
        metadata: {
          operationId,
          retrievedAt: new Date().toISOString(),
        },
      })

      logger.debug('Rate limit config retrieved', {
        operation: 'GET /api/admin/backfill/config/rate-limit',
        operationId,
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      logger.error('Failed to get rate limit config', {
        operation: 'GET /api/admin/backfill/config/rate-limit',
        operationId,
        error: errorMessage,
      })

      res
        .status(500)
        .json(
          createErrorResponse(
            BACKFILL_ERROR_CODES.STORAGE_ERROR,
            'Failed to get rate limit configuration',
            operationId,
            errorMessage,
            true
          )
        )
    }
  }
)

/**
 * PUT /api/admin/backfill/config/rate-limit
 * Update the rate limit configuration
 *
 * Request Body (all optional):
 * - maxRequestsPerMinute: number
 * - maxConcurrent: number
 * - minDelayMs: number
 * - maxDelayMs: number
 * - backoffMultiplier: number
 *
 * Requirements: 12.2
 */
unifiedBackfillRouter.put(
  '/config/rate-limit',
  logAdminAccess,
  async (req: Request, res: Response): Promise<void> => {
    const operationId = generateOperationId('update_rate_limit_config')

    logger.info('Update rate limit config requested', {
      operation: 'PUT /api/admin/backfill/config/rate-limit',
      operationId,
      ip: req.ip,
    })

    try {
      const body = req.body as Record<string, unknown>
      const updates: Partial<RateLimitConfig> = {}

      // Validate and extract fields
      if (body['maxRequestsPerMinute'] !== undefined) {
        const value = body['maxRequestsPerMinute']
        if (typeof value !== 'number' || value < 1 || value > 1000) {
          res
            .status(400)
            .json(
              createErrorResponse(
                BACKFILL_ERROR_CODES.VALIDATION_ERROR,
                'Invalid maxRequestsPerMinute',
                operationId,
                'maxRequestsPerMinute must be a number between 1 and 1000'
              )
            )
          return
        }
        updates.maxRequestsPerMinute = value
      }

      if (body['maxConcurrent'] !== undefined) {
        const value = body['maxConcurrent']
        if (typeof value !== 'number' || value < 1 || value > 100) {
          res
            .status(400)
            .json(
              createErrorResponse(
                BACKFILL_ERROR_CODES.VALIDATION_ERROR,
                'Invalid maxConcurrent',
                operationId,
                'maxConcurrent must be a number between 1 and 100'
              )
            )
          return
        }
        updates.maxConcurrent = value
      }

      if (body['minDelayMs'] !== undefined) {
        const value = body['minDelayMs']
        if (typeof value !== 'number' || value < 0 || value > 60000) {
          res
            .status(400)
            .json(
              createErrorResponse(
                BACKFILL_ERROR_CODES.VALIDATION_ERROR,
                'Invalid minDelayMs',
                operationId,
                'minDelayMs must be a number between 0 and 60000'
              )
            )
          return
        }
        updates.minDelayMs = value
      }

      if (body['maxDelayMs'] !== undefined) {
        const value = body['maxDelayMs']
        if (typeof value !== 'number' || value < 0 || value > 300000) {
          res
            .status(400)
            .json(
              createErrorResponse(
                BACKFILL_ERROR_CODES.VALIDATION_ERROR,
                'Invalid maxDelayMs',
                operationId,
                'maxDelayMs must be a number between 0 and 300000'
              )
            )
          return
        }
        updates.maxDelayMs = value
      }

      if (body['backoffMultiplier'] !== undefined) {
        const value = body['backoffMultiplier']
        if (typeof value !== 'number' || value < 1 || value > 10) {
          res
            .status(400)
            .json(
              createErrorResponse(
                BACKFILL_ERROR_CODES.VALIDATION_ERROR,
                'Invalid backoffMultiplier',
                operationId,
                'backoffMultiplier must be a number between 1 and 10'
              )
            )
          return
        }
        updates.backoffMultiplier = value
      }

      // Validate minDelayMs <= maxDelayMs if both provided
      if (
        updates.minDelayMs !== undefined &&
        updates.maxDelayMs !== undefined
      ) {
        if (updates.minDelayMs > updates.maxDelayMs) {
          res
            .status(400)
            .json(
              createErrorResponse(
                BACKFILL_ERROR_CODES.VALIDATION_ERROR,
                'minDelayMs must be less than or equal to maxDelayMs',
                operationId
              )
            )
          return
        }
      }

      // Check if any updates were provided
      if (Object.keys(updates).length === 0) {
        res
          .status(400)
          .json(
            createErrorResponse(
              BACKFILL_ERROR_CODES.VALIDATION_ERROR,
              'No valid configuration fields provided',
              operationId,
              'Provide at least one of: maxRequestsPerMinute, maxConcurrent, minDelayMs, maxDelayMs, backoffMultiplier'
            )
          )
        return
      }

      const service = await getUnifiedBackfillService()
      await service.updateRateLimitConfig(updates)

      // Get the updated config to return
      const updatedConfig = await service.getRateLimitConfig()

      res.json({
        config: updatedConfig,
        message: 'Rate limit configuration updated successfully',
        metadata: {
          operationId,
          updatedAt: new Date().toISOString(),
        },
      })

      logger.info('Rate limit config updated', {
        operation: 'PUT /api/admin/backfill/config/rate-limit',
        operationId,
        updates,
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      logger.error('Failed to update rate limit config', {
        operation: 'PUT /api/admin/backfill/config/rate-limit',
        operationId,
        error: errorMessage,
      })

      res
        .status(500)
        .json(
          createErrorResponse(
            BACKFILL_ERROR_CODES.STORAGE_ERROR,
            'Failed to update rate limit configuration',
            operationId,
            errorMessage,
            true
          )
        )
    }
  }
)

/**
 * GET /api/admin/backfill/:jobId
 * Get the status of a specific backfill job
 *
 * Path Parameters:
 * - jobId: string - The unique job identifier
 *
 * Requirements: 9.3
 */
unifiedBackfillRouter.get(
  '/:jobId',
  logAdminAccess,
  async (req: Request, res: Response): Promise<void> => {
    const operationId = generateOperationId('get_backfill_job_status')
    const jobId = req.params['jobId']

    logger.info('Get backfill job status requested', {
      operation: 'GET /api/admin/backfill/:jobId',
      operationId,
      jobId,
      ip: req.ip,
    })

    try {
      // Validate jobId
      if (!jobId || typeof jobId !== 'string' || jobId.trim().length === 0) {
        res
          .status(400)
          .json(
            createErrorResponse(
              BACKFILL_ERROR_CODES.VALIDATION_ERROR,
              'Invalid job ID',
              operationId,
              'jobId must be a non-empty string'
            )
          )
        return
      }

      const service = await getUnifiedBackfillService()
      const job = await service.getJob(jobId)

      if (!job) {
        res
          .status(404)
          .json(
            createErrorResponse(
              BACKFILL_ERROR_CODES.JOB_NOT_FOUND,
              `Backfill job with ID '${jobId}' not found`,
              operationId
            )
          )
        return
      }

      const response: JobStatusResponse = {
        jobId: job.jobId,
        jobType: job.jobType,
        status: job.status,
        config: job.config,
        progress: job.progress,
        checkpoint: job.checkpoint,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        resumedAt: job.resumedAt,
        result: job.result,
        error: job.error,
        metadata: {
          operationId,
          retrievedAt: new Date().toISOString(),
        },
      }

      logger.debug('Backfill job status retrieved', {
        operation: 'GET /api/admin/backfill/:jobId',
        operationId,
        jobId,
        status: job.status,
      })

      res.json(response)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      logger.error('Failed to get backfill job status', {
        operation: 'GET /api/admin/backfill/:jobId',
        operationId,
        jobId,
        error: errorMessage,
      })

      res
        .status(500)
        .json(
          createErrorResponse(
            BACKFILL_ERROR_CODES.STORAGE_ERROR,
            'Failed to get backfill job status',
            operationId,
            errorMessage,
            true
          )
        )
    }
  }
)

/**
 * DELETE /api/admin/backfill/:jobId
 * Cancel a running backfill job
 *
 * Path Parameters:
 * - jobId: string - The unique job identifier
 *
 * Requirements: 9.4
 */
unifiedBackfillRouter.delete(
  '/:jobId',
  logAdminAccess,
  async (req: Request, res: Response): Promise<void> => {
    const operationId = generateOperationId('cancel_backfill_job')
    const jobId = req.params['jobId']

    logger.info('Cancel backfill job requested', {
      operation: 'DELETE /api/admin/backfill/:jobId',
      operationId,
      jobId,
      ip: req.ip,
    })

    try {
      // Validate jobId
      if (!jobId || typeof jobId !== 'string' || jobId.trim().length === 0) {
        res
          .status(400)
          .json(
            createErrorResponse(
              BACKFILL_ERROR_CODES.VALIDATION_ERROR,
              'Invalid job ID',
              operationId,
              'jobId must be a non-empty string'
            )
          )
        return
      }

      const service = await getUnifiedBackfillService()

      // Check if job exists first
      const job = await service.getJob(jobId)
      if (!job) {
        res
          .status(404)
          .json(
            createErrorResponse(
              BACKFILL_ERROR_CODES.JOB_NOT_FOUND,
              `Backfill job with ID '${jobId}' not found`,
              operationId
            )
          )
        return
      }

      // Check if job can be cancelled
      if (job.status === 'completed') {
        res
          .status(400)
          .json(
            createErrorResponse(
              BACKFILL_ERROR_CODES.CANCELLATION_FAILED,
              'Cannot cancel a completed job',
              operationId
            )
          )
        return
      }

      if (job.status === 'cancelled') {
        res
          .status(400)
          .json(
            createErrorResponse(
              BACKFILL_ERROR_CODES.CANCELLATION_FAILED,
              'Job has already been cancelled',
              operationId
            )
          )
        return
      }

      if (job.status === 'failed') {
        res
          .status(400)
          .json(
            createErrorResponse(
              BACKFILL_ERROR_CODES.CANCELLATION_FAILED,
              'Cannot cancel a failed job',
              operationId
            )
          )
        return
      }

      const previousStatus = job.status
      const cancelled = await service.cancelJob(jobId)

      if (!cancelled) {
        res
          .status(500)
          .json(
            createErrorResponse(
              BACKFILL_ERROR_CODES.CANCELLATION_FAILED,
              'Failed to cancel backfill job',
              operationId,
              'The cancellation operation failed unexpectedly'
            )
          )
        return
      }

      logger.info('Backfill job cancelled', {
        operation: 'DELETE /api/admin/backfill/:jobId',
        operationId,
        jobId,
        previousStatus,
      })

      res.json({
        jobId,
        cancelled: true,
        previousStatus,
        message: 'Backfill job has been cancelled',
        metadata: {
          operationId,
          cancelledAt: new Date().toISOString(),
        },
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      logger.error('Failed to cancel backfill job', {
        operation: 'DELETE /api/admin/backfill/:jobId',
        operationId,
        jobId,
        error: errorMessage,
      })

      res
        .status(500)
        .json(
          createErrorResponse(
            BACKFILL_ERROR_CODES.CANCELLATION_FAILED,
            'Failed to cancel backfill job',
            operationId,
            errorMessage,
            true
          )
        )
    }
  }
)

/**
 * POST /api/admin/backfill/:jobId/force-cancel
 * Force-cancel a stuck backfill job
 *
 * This endpoint is for administrative intervention when jobs are stuck
 * in 'running' or 'recovering' states and cannot be cancelled normally.
 *
 * Path Parameters:
 * - jobId: string - The unique job identifier
 *
 * Query Parameters:
 * - force: boolean (required) - Must be 'true' to confirm the action
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 4.1, 4.2, 4.3
 */
unifiedBackfillRouter.post(
  '/:jobId/force-cancel',
  logAdminAccess,
  async (req: Request, res: Response): Promise<void> => {
    const operationId = generateOperationId('force_cancel_backfill_job')
    const jobId = req.params['jobId']
    const forceParam = req.query['force']

    // Requirement 4.1: Log request with job ID and operator IP address
    logger.info('Force-cancel backfill job requested', {
      operation: 'POST /api/admin/backfill/:jobId/force-cancel',
      operationId,
      jobId,
      forceParam,
      ip: req.ip,
    })

    try {
      // Validate jobId
      if (!jobId || typeof jobId !== 'string' || jobId.trim().length === 0) {
        logger.warn('Force-cancel failed: invalid job ID', {
          operation: 'POST /api/admin/backfill/:jobId/force-cancel',
          operationId,
          jobId,
        })
        res
          .status(400)
          .json(
            createErrorResponse(
              BACKFILL_ERROR_CODES.VALIDATION_ERROR,
              'Invalid job ID',
              operationId,
              'jobId must be a non-empty string'
            )
          )
        return
      }

      // Requirement 1.2: Return 400 error if force parameter is missing or not 'true'
      // Requirement 1.3: Proceed with cancellation when force=true
      if (forceParam !== 'true') {
        // Requirement 4.3: Log failure reason
        logger.warn('Force-cancel failed: force parameter not set to true', {
          operation: 'POST /api/admin/backfill/:jobId/force-cancel',
          operationId,
          jobId,
          forceParam,
        })
        res
          .status(400)
          .json(
            createErrorResponse(
              BACKFILL_ERROR_CODES.FORCE_REQUIRED,
              'Force-cancel requires explicit confirmation. Set force=true to proceed.',
              operationId,
              'The force query parameter must be set to "true" to confirm this destructive action'
            )
          )
        return
      }

      const service = await getUnifiedBackfillService()

      // Check if job exists first (for better error messages)
      const job = await service.getJob(jobId)

      // Requirement 1.4: Return 404 for non-existent job ID
      if (!job) {
        // Requirement 4.3: Log failure reason
        logger.warn('Force-cancel failed: job not found', {
          operation: 'POST /api/admin/backfill/:jobId/force-cancel',
          operationId,
          jobId,
        })
        res
          .status(404)
          .json(
            createErrorResponse(
              BACKFILL_ERROR_CODES.JOB_NOT_FOUND,
              `Backfill job with ID '${jobId}' not found`,
              operationId
            )
          )
        return
      }

      // Requirement 1.5: Return 400 for jobs already in terminal state
      const terminalStates = ['completed', 'failed', 'cancelled']
      if (terminalStates.includes(job.status)) {
        // Requirement 4.3: Log failure reason
        logger.warn('Force-cancel failed: job is in terminal state', {
          operation: 'POST /api/admin/backfill/:jobId/force-cancel',
          operationId,
          jobId,
          currentStatus: job.status,
        })
        res
          .status(400)
          .json(
            createErrorResponse(
              BACKFILL_ERROR_CODES.INVALID_JOB_STATE,
              `Cannot force-cancel job with status '${job.status}'. Job is already in a terminal state.`,
              operationId,
              'Force-cancel is only available for jobs in running, recovering, or pending states'
            )
          )
        return
      }

      const previousStatus = job.status

      // Requirement 1.1: Mark job as cancelled
      // Call service.forceCancelJob() with operator context
      const cancelled = await service.forceCancelJob(jobId, {
        ip: req.ip,
        reason: 'Force-cancelled via admin API',
      })

      if (!cancelled) {
        // Requirement 4.3: Log failure reason
        logger.error('Force-cancel failed: service returned false', {
          operation: 'POST /api/admin/backfill/:jobId/force-cancel',
          operationId,
          jobId,
          previousStatus,
        })
        res
          .status(500)
          .json(
            createErrorResponse(
              BACKFILL_ERROR_CODES.STORAGE_ERROR,
              'Failed to force-cancel backfill job',
              operationId,
              'The force-cancel operation failed unexpectedly',
              true
            )
          )
        return
      }

      const cancelledAt = new Date().toISOString()

      // Requirement 4.2: Log successful cancellation with previous status and timestamp
      logger.info('Backfill job force-cancelled successfully', {
        operation: 'POST /api/admin/backfill/:jobId/force-cancel',
        operationId,
        jobId,
        previousStatus,
        newStatus: 'cancelled',
        cancelledAt,
        ip: req.ip,
      })

      // Return success response matching ForceCancelResponse interface from design
      res.json({
        jobId,
        previousStatus,
        newStatus: 'cancelled',
        message: 'Backfill job has been force-cancelled',
        metadata: {
          operationId,
          cancelledAt,
          forceCancelled: true,
        },
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      // Requirement 4.3: Log failure reason
      logger.error('Failed to force-cancel backfill job', {
        operation: 'POST /api/admin/backfill/:jobId/force-cancel',
        operationId,
        jobId,
        error: errorMessage,
      })

      res
        .status(500)
        .json(
          createErrorResponse(
            BACKFILL_ERROR_CODES.STORAGE_ERROR,
            'Failed to force-cancel backfill job',
            operationId,
            errorMessage,
            true
          )
        )
    }
  }
)
