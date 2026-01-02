import { Router, type Request, type Response } from 'express'
import { cacheMiddleware } from '../middleware/cache.js'
import {
  validateSingleClubHealthInput,
  validateBatchClubHealthInput,
  validateDistrictIdParam,
  validateClubNameParam,
  validateMonthsParam,
  clubHealthErrorHandler,
  formatSuccessResponse,
  formatErrorResponse,
} from '../middleware/clubHealthValidation.js'
import { logger } from '../utils/logger.js'
import { ClubHealthServiceImpl } from '../services/ClubHealthService.js'
import type { ClubHealthInput } from '../types/clubHealth.js'

const router = Router()

// Initialize club health service
const clubHealthService = new ClubHealthServiceImpl()

/**
 * POST /api/club-health/classify
 * Classify a single club's health status and trajectory
 * Requirements: 5.1, 5.2, 5.5, 5.6
 */
router.post(
  '/classify',
  validateSingleClubHealthInput(),
  async (req: Request, res: Response) => {
    try {
      const startTime = Date.now()
      const input = req.body as ClubHealthInput

      // Process club health classification
      const result = await clubHealthService.processClubHealth(input)

      const processingTime = Date.now() - startTime

      logger.info('Club health classification completed', {
        clubName: input.club_name,
        healthStatus: result.health_status,
        trajectory: result.trajectory,
        apiProcessingTime: `${processingTime}ms`,
      })

      const response = formatSuccessResponse(result, {
        api_processing_time_ms: processingTime,
      })

      res.status(200).json(response)
    } catch (error) {
      const { response, statusCode } = formatErrorResponse(
        'CLASSIFICATION_ERROR',
        'Failed to classify club health',
        process.env.NODE_ENV === 'development'
          ? error instanceof Error
            ? error.message
            : String(error)
          : undefined
      )

      logger.error('Failed to classify club health', {
        error: error instanceof Error ? error.message : String(error),
        input: req.body,
      })

      res.status(statusCode).json(response)
    }
  }
)

/**
 * POST /api/club-health/batch
 * Classify multiple clubs in batch
 * Requirements: 5.1, 5.2, 5.5, 5.6
 */
router.post(
  '/batch',
  validateBatchClubHealthInput(),
  async (req: Request, res: Response) => {
    try {
      const startTime = Date.now()
      const inputs = req.body as ClubHealthInput[]

      // Process batch classification
      const results = await clubHealthService.batchProcessClubs(inputs)

      const processingTime = Date.now() - startTime

      logger.info('Batch club health classification completed', {
        clubCount: inputs.length,
        successCount: results.length,
        apiProcessingTime: `${processingTime}ms`,
      })

      const response = formatSuccessResponse(results, {
        total_clubs: inputs.length,
        successful_classifications: results.length,
        api_processing_time_ms: processingTime,
      })

      res.status(200).json(response)
    } catch (error) {
      const { response, statusCode } = formatErrorResponse(
        'BATCH_CLASSIFICATION_ERROR',
        'Failed to process batch club health classification',
        process.env.NODE_ENV === 'development'
          ? error instanceof Error
            ? error.message
            : String(error)
          : undefined
      )

      logger.error('Failed to process batch club health classification', {
        error: error instanceof Error ? error.message : String(error),
        inputCount: Array.isArray(req.body) ? req.body.length : 'invalid',
      })

      res.status(statusCode).json(response)
    }
  }
)

/**
 * GET /api/club-health/:clubName/history
 * Get historical health data for a specific club
 * Requirements: 5.3, 5.2, 5.6
 */
router.get(
  '/:clubName/history',
  validateClubNameParam(),
  validateMonthsParam(),
  cacheMiddleware({
    ttl: 1800, // 30 minutes
    keyGenerator: req =>
      `club_health_history:${req.params.clubName}:${req.query.months || 12}`,
  }),
  async (req: Request, res: Response) => {
    try {
      const { clubName } = req.params
      const monthsNum = req.query.months
        ? parseInt(req.query.months as string, 10)
        : 12

      // Get club health history
      const history = await clubHealthService.getClubHealthHistory(
        clubName,
        monthsNum
      )

      logger.info('Club health history retrieved', {
        clubName,
        months: monthsNum,
        recordCount: history.length,
      })

      const response = formatSuccessResponse(
        {
          club_name: clubName,
          months_requested: monthsNum,
          history,
        },
        {
          record_count: history.length,
        }
      )

      res.status(200).json(response)
    } catch (error) {
      const { response, statusCode } = formatErrorResponse(
        'HISTORY_RETRIEVAL_ERROR',
        'Failed to retrieve club health history',
        process.env.NODE_ENV === 'development'
          ? error instanceof Error
            ? error.message
            : String(error)
          : undefined
      )

      logger.error('Failed to get club health history', {
        clubName: req.params.clubName,
        months: req.query.months,
        error: error instanceof Error ? error.message : String(error),
      })

      res.status(statusCode).json(response)
    }
  }
)

/**
 * GET /api/districts/:districtId/health-summary
 * Get district-wide health summary
 * Requirements: 5.4, 5.2, 5.6
 */
router.get(
  '/districts/:districtId/health-summary',
  validateDistrictIdParam(),
  cacheMiddleware({
    ttl: 1200, // 20 minutes
    keyGenerator: req => `district_health_summary:${req.params.districtId}`,
  }),
  async (req: Request, res: Response) => {
    try {
      const { districtId } = req.params

      // Get district health summary
      const summary =
        await clubHealthService.getDistrictHealthSummary(districtId)

      logger.info('District health summary retrieved', {
        districtId,
        totalClubs: summary.total_clubs,
        clubsNeedingAttention: summary.clubs_needing_attention.length,
      })

      const response = formatSuccessResponse(summary)

      res.status(200).json(response)
    } catch (error) {
      let statusCode = 500
      let errorCode = 'SUMMARY_RETRIEVAL_ERROR'

      // Check if it's a 404 error (district not found)
      if (error instanceof Error && error.message.includes('not found')) {
        statusCode = 404
        errorCode = 'DISTRICT_NOT_FOUND'
      }

      const { response } = formatErrorResponse(
        errorCode,
        statusCode === 404
          ? 'District not found or no health data available'
          : 'Failed to retrieve district health summary',
        process.env.NODE_ENV === 'development'
          ? error instanceof Error
            ? error.message
            : String(error)
          : undefined,
        statusCode
      )

      logger.error('Failed to get district health summary', {
        districtId: req.params.districtId,
        error: error instanceof Error ? error.message : String(error),
      })

      res.status(statusCode).json(response)
    }
  }
)

// Apply global error handler
router.use(clubHealthErrorHandler())

export default router
