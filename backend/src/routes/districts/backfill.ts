/**
 * Backfill routes module
 * Handles global and district-specific backfill operations
 * Requirements: 2.3
 */

import { Router, type Request, type Response } from 'express'
import { logger } from '../../utils/logger.js'
import { transformErrorResponse } from '../../utils/transformers.js'
import type { BackfillRequest } from '../../services/UnifiedBackfillService.js'
import {
  getValidDistrictId,
  validateDateFormat,
  validateBackfillRequest,
  estimateCompletionTime,
  getBackfillService,
} from './shared.js'

export const backfillRouter = Router()

/**
 * POST /api/districts/backfill
 * Initiate backfill of historical data with modern API design
 *
 * Enhanced features:
 * - Comprehensive input validation with detailed error messages
 * - Proper HTTP status codes and response headers
 * - Clear error handling with actionable feedback
 * - Request validation with helpful suggestions
 */
backfillRouter.post('/backfill', async (req: Request, res: Response) => {
  const requestId = `backfill_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  logger.info('Received backfill initiation request', {
    operation: 'POST /api/districts/backfill',
    request_id: requestId,
    user_agent: req.get('user-agent'),
    ip: req.ip,
    body_keys: Object.keys(req.body || {}),
  })

  try {
    // Enhanced input validation
    const validationResult = validateBackfillRequest(req.body)
    if (!validationResult.isValid) {
      logger.warn('Backfill request validation failed', {
        operation: 'POST /api/districts/backfill',
        request_id: requestId,
        validation_errors: validationResult.errors,
      })

      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: validationResult.errors,
          suggestions: validationResult.suggestions,
        },
        request_id: requestId,
      })
      return
    }

    const request: BackfillRequest = validationResult.sanitizedRequest

    logger.info('Initiating backfill with validated request', {
      operation: 'POST /api/districts/backfill',
      request_id: requestId,
      target_districts: request.targetDistricts?.length || 0,
      start_date: request.startDate,
      end_date: request.endDate,
      collection_type: request.collectionType,
      concurrency: request.concurrency,
    })

    const backfillService = await getBackfillService()
    const backfillId = await backfillService.initiateBackfill(request)
    const status = backfillService.getBackfillStatus(backfillId!)

    if (!status) {
      logger.error('Failed to retrieve backfill status after creation', {
        operation: 'POST /api/districts/backfill',
        request_id: requestId,
        backfill_id: backfillId,
      })

      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Backfill initiated but status unavailable',
          details:
            'The backfill job was created but status could not be retrieved',
        },
        request_id: requestId,
      })
      return
    }

    // Set appropriate response headers
    res.set({
      'Content-Type': 'application/json',
      'X-Request-ID': requestId,
      'X-Backfill-ID': backfillId,
    })

    // Return 202 Accepted for async operation
    res.status(202).json({
      ...status,
      request_id: requestId,
      links: {
        self: `/api/districts/backfill/${backfillId}`,
        cancel: `/api/districts/backfill/${backfillId}`,
      },
    })

    logger.info('Backfill initiated successfully', {
      operation: 'POST /api/districts/backfill',
      request_id: requestId,
      backfill_id: backfillId,
      status: status.status,
      scope_type: status.scope.scopeType,
      target_districts: status.scope.targetDistricts.length,
    })
  } catch (error) {
    const errorResponse = transformErrorResponse(error)
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'

    logger.error('Backfill initiation failed', {
      operation: 'POST /api/districts/backfill',
      request_id: requestId,
      error: errorMessage,
      error_code: errorResponse.code,
    })

    // Determine appropriate HTTP status code based on error type
    let statusCode = 500
    let errorCode = errorResponse.code || 'BACKFILL_ERROR'

    if (errorMessage.includes('scope') || errorMessage.includes('district')) {
      statusCode = 400
      errorCode = 'SCOPE_ERROR'
    } else if (errorMessage.includes('configuration')) {
      statusCode = 422
      errorCode = 'CONFIGURATION_ERROR'
    }

    res.status(statusCode).json({
      error: {
        code: errorCode,
        message: 'Failed to initiate backfill',
        details: errorResponse.details,
        original_error: errorMessage,
      },
      request_id: requestId,
    })
  }
})

/**
 * GET /api/districts/backfill/:backfillId
 * Get backfill progress/status with enhanced response format
 *
 * Enhanced features:
 * - Detailed progress information
 * - Proper HTTP status codes
 * - Response headers with metadata
 * - Links for related operations
 */
backfillRouter.get(
  '/backfill/:backfillId',
  async (req: Request, res: Response) => {
    const requestId = `backfill_status_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const { backfillId } = req.params

    logger.info('Received backfill status request', {
      operation: 'GET /api/districts/backfill/:backfillId',
      request_id: requestId,
      backfill_id: backfillId,
      user_agent: req.get('user-agent'),
      ip: req.ip,
    })

    try {
      // Validate backfill ID format
      if (
        !backfillId ||
        typeof backfillId !== 'string' ||
        backfillId.trim().length === 0 ||
        !/^[a-zA-Z0-9\-_]+$/.test(backfillId.trim())
      ) {
        logger.warn('Invalid backfill ID format', {
          operation: 'GET /api/districts/backfill/:backfillId',
          request_id: requestId,
          backfill_id: backfillId,
        })

        res.status(400).json({
          error: {
            code: 'INVALID_BACKFILL_ID',
            message: 'Invalid backfill ID format',
            details:
              'Backfill ID must be a non-empty string containing only alphanumeric characters, hyphens, and underscores',
          },
          request_id: requestId,
        })
        return
      }

      const backfillService = await getBackfillService()
      const status = backfillService.getBackfillStatus(backfillId!)

      if (!status) {
        logger.warn('Backfill job not found', {
          operation: 'GET /api/districts/backfill/:backfillId',
          request_id: requestId,
          backfill_id: backfillId,
        })

        res.status(404).json({
          error: {
            code: 'BACKFILL_NOT_FOUND',
            message: 'Backfill job not found',
            details:
              'The specified backfill job does not exist or has been cleaned up',
            suggestions: [
              'Verify the backfill ID is correct',
              'Check if the job has been completed and cleaned up',
              'Initiate a new backfill if needed',
            ],
          },
          request_id: requestId,
        })
        return
      }

      // Set response headers
      res.set({
        'Content-Type': 'application/json',
        'X-Request-ID': requestId,
        'X-Backfill-ID': backfillId,
        'X-Backfill-Status': status.status,
      })

      // Add cache headers based on status
      if (
        status.status === 'complete' ||
        status.status === 'error' ||
        status.status === 'cancelled'
      ) {
        res.set('Cache-Control', 'public, max-age=3600') // Cache completed jobs for 1 hour
      } else {
        res.set('Cache-Control', 'no-cache') // Don't cache in-progress jobs
      }

      // Enhanced response with additional metadata
      const enhancedStatus: Record<string, unknown> = {
        ...status,
        request_id: requestId,
        links: {
          self: `/api/districts/backfill/${backfillId}`,
          cancel:
            status.status === 'processing'
              ? `/api/districts/backfill/${backfillId}`
              : undefined,
        },
        metadata: {
          estimated_completion:
            status.status === 'processing' && status.progress.total > 0
              ? estimateCompletionTime(status.progress)
              : undefined,
          efficiency_rating: status.collectionStrategy.estimatedEfficiency,
          collection_method: status.collectionStrategy.type,
        },
      }

      // Remove undefined values from links
      const links = enhancedStatus['links'] as Record<string, unknown>
      if (!links['cancel']) {
        delete links['cancel']
      }

      res.json(enhancedStatus)

      logger.info('Backfill status retrieved successfully', {
        operation: 'GET /api/districts/backfill/:backfillId',
        request_id: requestId,
        backfill_id: backfillId,
        status: status.status,
        progress: `${status.progress.completed}/${status.progress.total}`,
        failed: status.progress.failed,
      })
    } catch (error) {
      const errorResponse = transformErrorResponse(error)
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      logger.error('Failed to get backfill status', {
        operation: 'GET /api/districts/backfill/:backfillId',
        request_id: requestId,
        backfill_id: backfillId,
        error: errorMessage,
      })

      res.status(500).json({
        error: {
          code: errorResponse.code || 'BACKFILL_ERROR',
          message: 'Failed to get backfill status',
          details: errorResponse.details,
          original_error: errorMessage,
        },
        request_id: requestId,
      })
    }
  }
)

/**
 * DELETE /api/districts/backfill/:backfillId
 * Cancel a backfill job with enhanced error handling
 *
 * Enhanced features:
 * - Detailed validation and error messages
 * - Proper HTTP status codes
 * - Clear success/failure responses
 * - Helpful suggestions for common issues
 */
backfillRouter.delete(
  '/backfill/:backfillId',
  async (req: Request, res: Response) => {
    const requestId = `backfill_cancel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const { backfillId } = req.params

    logger.info('Received backfill cancellation request', {
      operation: 'DELETE /api/districts/backfill/:backfillId',
      request_id: requestId,
      backfill_id: backfillId,
      user_agent: req.get('user-agent'),
      ip: req.ip,
    })

    try {
      // Validate backfill ID format
      if (
        !backfillId ||
        typeof backfillId !== 'string' ||
        backfillId.trim().length === 0 ||
        !/^[a-zA-Z0-9\-_]+$/.test(backfillId.trim())
      ) {
        logger.warn('Invalid backfill ID format for cancellation', {
          operation: 'DELETE /api/districts/backfill/:backfillId',
          request_id: requestId,
          backfill_id: backfillId,
        })

        res.status(400).json({
          error: {
            code: 'INVALID_BACKFILL_ID',
            message: 'Invalid backfill ID format',
            details:
              'Backfill ID must be a non-empty string containing only alphanumeric characters, hyphens, and underscores',
          },
          request_id: requestId,
        })
        return
      }

      const backfillService = await getBackfillService()

      // Check if job exists before attempting cancellation
      const currentStatus = backfillService.getBackfillStatus(backfillId!)
      if (!currentStatus) {
        logger.warn('Attempted to cancel non-existent backfill job', {
          operation: 'DELETE /api/districts/backfill/:backfillId',
          request_id: requestId,
          backfill_id: backfillId,
        })

        res.status(404).json({
          error: {
            code: 'BACKFILL_NOT_FOUND',
            message: 'Backfill job not found',
            details:
              'The specified backfill job does not exist or has been cleaned up',
            suggestions: [
              'Verify the backfill ID is correct',
              'Check if the job has already completed',
              'Use GET /api/districts/backfill/:id to check job status',
            ],
          },
          request_id: requestId,
        })
        return
      }

      // Check if job can be cancelled
      if (currentStatus.status !== 'processing') {
        logger.warn('Attempted to cancel non-processing backfill job', {
          operation: 'DELETE /api/districts/backfill/:backfillId',
          request_id: requestId,
          backfill_id: backfillId,
          current_status: currentStatus.status,
        })

        res.status(409).json({
          error: {
            code: 'CANNOT_CANCEL_JOB',
            message: `Cannot cancel backfill job in '${currentStatus.status}' status`,
            details: 'Only processing jobs can be cancelled',
            current_status: currentStatus.status,
            suggestions: [
              'Only jobs with status "processing" can be cancelled',
              'Completed, failed, or already cancelled jobs cannot be cancelled',
            ],
          },
          request_id: requestId,
        })
        return
      }

      const cancelled = await backfillService.cancelBackfill(backfillId!)

      if (!cancelled) {
        logger.error('Backfill cancellation failed unexpectedly', {
          operation: 'DELETE /api/districts/backfill/:backfillId',
          request_id: requestId,
          backfill_id: backfillId,
          current_status: currentStatus.status,
        })

        res.status(500).json({
          error: {
            code: 'CANCELLATION_FAILED',
            message: 'Failed to cancel backfill job',
            details: 'The cancellation operation failed unexpectedly',
          },
          request_id: requestId,
        })
        return
      }

      // Set response headers
      res.set({
        'Content-Type': 'application/json',
        'X-Request-ID': requestId,
        'X-Backfill-ID': backfillId,
      })

      res.json({
        success: true,
        message: 'Backfill cancelled successfully',
        backfill_id: backfillId,
        request_id: requestId,
        cancelled_at: new Date().toISOString(),
        links: {
          status: `/api/districts/backfill/${backfillId}`,
        },
      })

      logger.info('Backfill cancelled successfully', {
        operation: 'DELETE /api/districts/backfill/:backfillId',
        request_id: requestId,
        backfill_id: backfillId,
      })
    } catch (error) {
      const errorResponse = transformErrorResponse(error)
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      logger.error('Backfill cancellation failed', {
        operation: 'DELETE /api/districts/backfill/:backfillId',
        request_id: requestId,
        backfill_id: backfillId,
        error: errorMessage,
      })

      res.status(500).json({
        error: {
          code: errorResponse.code || 'BACKFILL_ERROR',
          message: 'Failed to cancel backfill',
          details: errorResponse.details,
          original_error: errorMessage,
        },
        request_id: requestId,
      })
    }
  }
)

/**
 * POST /api/districts/:districtId/backfill
 * Initiate backfill of historical data for a specific district
 */
backfillRouter.post(
  '/:districtId/backfill',
  async (req: Request, res: Response) => {
    try {
      const districtId = getValidDistrictId(req)
      const { startDate, endDate } = req.body

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

      // Validate date formats if provided
      if (startDate && !validateDateFormat(startDate!)) {
        res.status(400).json({
          error: {
            code: 'INVALID_DATE_FORMAT',
            message: 'startDate must be in YYYY-MM-DD format',
          },
        })
        return
      }

      if (endDate && !validateDateFormat(endDate!)) {
        res.status(400).json({
          error: {
            code: 'INVALID_DATE_FORMAT',
            message: 'endDate must be in YYYY-MM-DD format',
          },
        })
        return
      }

      // Validate date range
      if (startDate && endDate) {
        const start = new Date(startDate)
        const end = new Date(endDate)

        if (start > end) {
          res.status(400).json({
            error: {
              code: 'INVALID_DATE_RANGE',
              message: 'startDate must be before or equal to endDate',
            },
          })
          return
        }

        // Limit date range to prevent excessive requests (e.g., max 365 days)
        const daysDiff = Math.ceil(
          (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
        )
        if (daysDiff > 365) {
          res.status(400).json({
            error: {
              code: 'DATE_RANGE_TOO_LARGE',
              message: 'Date range cannot exceed 365 days',
            },
          })
          return
        }
      }

      // Initiate backfill using unified service
      const backfillService = await getBackfillService()
      const backfillId = await backfillService.initiateBackfill({
        targetDistricts: [districtId],
        startDate,
        endDate,
        collectionType: 'per-district',
      })

      const status = backfillService.getBackfillStatus(backfillId!)

      res.json(status)
    } catch (error) {
      const errorResponse = transformErrorResponse(error)

      // Check for specific error messages
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to initiate backfill'

      if (errorMessage.includes('already cached')) {
        res.status(400).json({
          error: {
            code: 'ALL_DATES_CACHED',
            message: errorMessage,
          },
        })
        return
      }

      if (errorMessage.includes('No dates in the specified range')) {
        res.status(400).json({
          error: {
            code: 'INVALID_DATE_RANGE',
            message: errorMessage,
          },
        })
        return
      }

      res.status(500).json({
        error: {
          code: errorResponse.code || 'BACKFILL_ERROR',
          message: errorMessage,
          details: errorResponse.details,
        },
      })
    }
  }
)

/**
 * GET /api/districts/:districtId/backfill/:backfillId
 * Check backfill status for a specific district
 */
backfillRouter.get(
  '/:districtId/backfill/:backfillId',
  async (req: Request, res: Response) => {
    try {
      const districtId = getValidDistrictId(req)
      const backfillId = req.params['backfillId']

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

      const backfillService = await getBackfillService()
      const status = backfillService.getBackfillStatus(backfillId!)

      if (!status) {
        res.status(404).json({
          error: {
            code: 'BACKFILL_NOT_FOUND',
            message: 'Backfill job not found',
          },
        })
        return
      }

      // Verify the backfill includes the requested district
      if (!status.scope.targetDistricts.includes(districtId!)) {
        res.status(404).json({
          error: {
            code: 'BACKFILL_NOT_FOUND',
            message: 'Backfill job not found for this district',
          },
        })
        return
      }

      res.json(status)
    } catch (error) {
      const errorResponse = transformErrorResponse(error)

      res.status(500).json({
        error: {
          code: errorResponse.code || 'BACKFILL_ERROR',
          message: 'Failed to get backfill status',
          details: errorResponse.details,
        },
      })
    }
  }
)

/**
 * DELETE /api/districts/:districtId/backfill/:backfillId
 * Cancel a backfill job for a specific district
 */
backfillRouter.delete(
  '/:districtId/backfill/:backfillId',
  async (req: Request, res: Response) => {
    try {
      const districtId = getValidDistrictId(req)
      const backfillId = req.params['backfillId']

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

      const backfillService = await getBackfillService()

      // Get status first to verify it belongs to this district
      const status = backfillService.getBackfillStatus(backfillId!)

      if (!status) {
        res.status(404).json({
          error: {
            code: 'BACKFILL_NOT_FOUND',
            message: 'Backfill job not found',
          },
        })
        return
      }

      // Verify the backfill includes the requested district
      if (!status.scope.targetDistricts.includes(districtId!)) {
        res.status(404).json({
          error: {
            code: 'BACKFILL_NOT_FOUND',
            message: 'Backfill job not found for this district',
          },
        })
        return
      }

      const cancelled = await backfillService.cancelBackfill(backfillId!)

      if (!cancelled) {
        res.status(400).json({
          error: {
            code: 'CANNOT_CANCEL',
            message:
              'Backfill job cannot be cancelled (already completed or failed)',
          },
        })
        return
      }

      res.json({
        success: true,
        message: 'Backfill cancelled successfully',
      })
    } catch (error) {
      const errorResponse = transformErrorResponse(error)

      res.status(500).json({
        error: {
          code: errorResponse.code || 'BACKFILL_ERROR',
          message: 'Failed to cancel backfill',
          details: errorResponse.details,
        },
      })
    }
  }
)
