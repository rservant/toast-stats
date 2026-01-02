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

/**
 * GET /api/districts/:districtId/club-health
 * Get all clubs health data for a district
 * Requirements: 5.4, 5.2, 5.6
 */
router.get(
  '/districts/:districtId/club-health',
  validateDistrictIdParam(),
  cacheMiddleware({
    ttl: 1200, // 20 minutes
    keyGenerator: req => `district_clubs_health:${req.params.districtId}`,
  }),
  async (req: Request, res: Response) => {
    try {
      const { districtId } = req.params

      // Get district health summary which includes all clubs
      const summary =
        await clubHealthService.getDistrictHealthSummary(districtId)

      logger.info('District clubs health data retrieved', {
        districtId,
        totalClubs: summary.total_clubs,
        clubsReturned: summary.clubs.length,
      })

      // Return just the clubs array for the frontend
      const response = formatSuccessResponse(summary.clubs, {
        district_id: districtId,
        total_clubs: summary.total_clubs,
      })

      res.status(200).json(response)
    } catch (error) {
      let statusCode = 500
      let errorCode = 'CLUBS_RETRIEVAL_ERROR'

      // Check if it's a 404 error (district not found)
      if (error instanceof Error && error.message.includes('not found')) {
        statusCode = 404
        errorCode = 'DISTRICT_NOT_FOUND'
      }

      const { response } = formatErrorResponse(
        errorCode,
        statusCode === 404
          ? 'District not found or no club health data available'
          : 'Failed to retrieve district clubs health data',
        process.env.NODE_ENV === 'development'
          ? error instanceof Error
            ? error.message
            : String(error)
          : undefined,
        statusCode
      )

      logger.error('Failed to get district clubs health data', {
        districtId: req.params.districtId,
        error: error instanceof Error ? error.message : String(error),
      })

      res.status(statusCode).json(response)
    }
  }
)

/**
 * POST /api/club-health/refresh/:clubName
 * Refresh club data from external sources
 * Requirements: Real-time data integration
 */
router.post(
  '/refresh/:clubName',
  validateClubNameParam(),
  async (req: Request, res: Response) => {
    try {
      const { clubName } = req.params
      const { districtId } = req.body

      logger.info('Refreshing club data from external sources', {
        clubName,
        districtId,
      })

      // Refresh club data from external sources
      const result = await clubHealthService.refreshClubData(
        clubName,
        districtId
      )

      logger.info('Club data refreshed successfully', {
        clubName,
        healthStatus: result.health_status,
        trajectory: result.trajectory,
      })

      const response = formatSuccessResponse(result, {
        refreshed_at: new Date().toISOString(),
        data_source: 'external',
      })

      res.status(200).json(response)
    } catch (error) {
      let statusCode = 500
      let errorCode = 'REFRESH_ERROR'

      // Check if it's a club not found error
      if (error instanceof Error && error.message.includes('not found')) {
        statusCode = 404
        errorCode = 'CLUB_NOT_FOUND'
      }

      const { response } = formatErrorResponse(
        errorCode,
        statusCode === 404
          ? 'Club not found or not available in external data source'
          : 'Failed to refresh club data from external sources',
        process.env.NODE_ENV === 'development'
          ? error instanceof Error
            ? error.message
            : String(error)
          : undefined,
        statusCode
      )

      logger.error('Failed to refresh club data', {
        clubName: req.params.clubName,
        districtId: req.body.districtId,
        error: error instanceof Error ? error.message : String(error),
      })

      res.status(statusCode).json(response)
    }
  }
)

/**
 * POST /api/club-health/districts/:districtId/refresh
 * Refresh all club data for a district from external sources
 * Requirements: Bulk data refresh capability
 */
router.post(
  '/districts/:districtId/refresh',
  validateDistrictIdParam(),
  async (req: Request, res: Response) => {
    try {
      const { districtId } = req.params

      logger.info('Refreshing district club data from external sources', {
        districtId,
      })

      // Refresh all club data for the district
      const results =
        await clubHealthService.refreshDistrictClubData(districtId)

      logger.info('District club data refreshed successfully', {
        districtId,
        clubCount: results.length,
      })

      const response = formatSuccessResponse(results, {
        district_id: districtId,
        clubs_refreshed: results.length,
        refreshed_at: new Date().toISOString(),
        data_source: 'external',
      })

      res.status(200).json(response)
    } catch (error) {
      let statusCode = 500
      let errorCode = 'DISTRICT_REFRESH_ERROR'

      // Check if it's a district not found error
      if (error instanceof Error && error.message.includes('not found')) {
        statusCode = 404
        errorCode = 'DISTRICT_NOT_FOUND'
      }

      const { response } = formatErrorResponse(
        errorCode,
        statusCode === 404
          ? 'District not found or no clubs available in external data source'
          : 'Failed to refresh district club data from external sources',
        process.env.NODE_ENV === 'development'
          ? error instanceof Error
            ? error.message
            : String(error)
          : undefined,
        statusCode
      )

      logger.error('Failed to refresh district club data', {
        districtId: req.params.districtId,
        error: error instanceof Error ? error.message : String(error),
      })

      res.status(statusCode).json(response)
    }
  }
)

/**
 * POST /api/club-health/refresh/:clubName
 * Refresh club data from external sources
 * Requirements: Real-time data integration
 */
router.post(
  '/refresh/:clubName',
  validateClubNameParam(),
  async (req: Request, res: Response) => {
    try {
      const { clubName } = req.params
      const { districtId } = req.body

      logger.info('Refreshing club data from external sources', {
        clubName,
        districtId,
      })

      // Refresh club data from external sources
      const result = await clubHealthService.refreshClubData(
        clubName,
        districtId
      )

      logger.info('Club data refresh completed', {
        clubName,
        districtId,
        healthStatus: result.health_status,
        trajectory: result.trajectory,
      })

      const response = formatSuccessResponse(result, {
        refreshed_from_external_sources: true,
        refresh_timestamp: new Date().toISOString(),
      })

      res.status(200).json(response)
    } catch (error) {
      const { response, statusCode } = formatErrorResponse(
        'REFRESH_ERROR',
        'Failed to refresh club data from external sources',
        process.env.NODE_ENV === 'development'
          ? error instanceof Error
            ? error.message
            : String(error)
          : undefined
      )

      logger.error('Failed to refresh club data', {
        clubName: req.params.clubName,
        districtId: req.body?.districtId,
        error: error instanceof Error ? error.message : String(error),
      })

      res.status(statusCode).json(response)
    }
  }
)

/**
 * POST /api/club-health/refresh/district/:districtId
 * Refresh all club data for a district from external sources
 * Requirements: Bulk data refresh
 */
router.post(
  '/refresh/district/:districtId',
  validateDistrictIdParam(),
  async (req: Request, res: Response) => {
    try {
      const { districtId } = req.params

      logger.info('Refreshing district club data from external sources', {
        districtId,
      })

      // Refresh all club data for the district
      const results =
        await clubHealthService.refreshDistrictClubData(districtId)

      logger.info('District club data refresh completed', {
        districtId,
        totalClubs: results.length,
      })

      const response = formatSuccessResponse(results, {
        district_id: districtId,
        total_clubs_refreshed: results.length,
        refreshed_from_external_sources: true,
        refresh_timestamp: new Date().toISOString(),
      })

      res.status(200).json(response)
    } catch (error) {
      const { response, statusCode } = formatErrorResponse(
        'DISTRICT_REFRESH_ERROR',
        'Failed to refresh district club data from external sources',
        process.env.NODE_ENV === 'development'
          ? error instanceof Error
            ? error.message
            : String(error)
          : undefined
      )

      logger.error('Failed to refresh district club data', {
        districtId: req.params.districtId,
        error: error instanceof Error ? error.message : String(error),
      })

      res.status(statusCode).json(response)
    }
  }
)

/**
 * GET /api/club-health/debug
 * Debug endpoint to check loaded data
 */
router.get('/debug', async (_req: Request, res: Response) => {
  try {
    const debugInfo = clubHealthService.getDebugInfo()
    res.json({
      success: true,
      data: debugInfo,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    })
  }
})

// Apply global error handler
router.use(clubHealthErrorHandler())

export default router
