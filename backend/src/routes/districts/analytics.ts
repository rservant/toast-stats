/**
 * Analytics routes module
 * Handles analytics, trends, division/area comparison, and year-over-year endpoints
 * Requirements: 2.2
 */

import { Router, type Request, type Response } from 'express'
import { cacheMiddleware } from '../../middleware/cache.js'
import { generateDistrictCacheKey } from '../../utils/cacheKeys.js'
import { logger } from '../../utils/logger.js'
import { transformErrorResponse } from '../../utils/transformers.js'
import type {
  DistrictAnalytics,
  ClubTrend,
  DivisionAnalytics,
  AreaAnalytics,
} from '../../types/analytics.js'
import {
  validateDistrictId,
  getValidDistrictId,
  validateDateFormat,
  getAnalyticsEngine,
  extractStringParam,
} from './shared.js'

export const analyticsRouter = Router()

/**
 * GET /api/districts/:districtId/membership-analytics
 * Generate comprehensive membership analytics for a district
 * Query params: startDate (optional), endDate (optional)
 */
analyticsRouter.get(
  '/:districtId/membership-analytics',
  async (req: Request, res: Response) => {
    try {
      const districtId = getValidDistrictId(req)
      const startDate = req.query['startDate']
      const endDate = req.query['endDate']

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
      if (
        startDate &&
        typeof startDate === 'string' &&
        !validateDateFormat(startDate!)
      ) {
        res.status(400).json({
          error: {
            code: 'INVALID_DATE_FORMAT',
            message: 'startDate must be in YYYY-MM-DD format',
          },
        })
        return
      }

      if (
        endDate &&
        typeof endDate === 'string' &&
        !validateDateFormat(endDate!)
      ) {
        res.status(400).json({
          error: {
            code: 'INVALID_DATE_FORMAT',
            message: 'endDate must be in YYYY-MM-DD format',
          },
        })
        return
      }

      // Validate date range
      if (
        startDate &&
        endDate &&
        typeof startDate === 'string' &&
        typeof endDate === 'string'
      ) {
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
      }

      // Generate membership analytics
      const analyticsEngine = await getAnalyticsEngine()
      const analytics = await analyticsEngine.generateMembershipAnalytics(
        districtId,
        startDate as string | undefined,
        endDate as string | undefined
      )

      res.json(analytics)
    } catch (error) {
      const errorResponse = transformErrorResponse(error)

      // Check for specific error messages
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to generate membership analytics'

      if (errorMessage.includes('No cached data available')) {
        res.status(404).json({
          error: {
            code: 'NO_DATA_AVAILABLE',
            message: errorMessage,
            details: 'Consider initiating a backfill to fetch historical data',
          },
        })
        return
      }

      res.status(500).json({
        error: {
          code: errorResponse.code || 'ANALYTICS_ERROR',
          message: errorMessage,
          details: errorResponse.details,
        },
      })
    }
  }
)

/**
 * GET /api/districts/:districtId/analytics
 * Generate comprehensive district analytics
 * Query params: startDate (optional), endDate (optional)
 * Requirements: 3.1, 3.2, 4.4, 5.1, 6.1, 7.1, 8.1
 */
analyticsRouter.get(
  '/:districtId/analytics',
  cacheMiddleware({
    ttl: 300, // 5 minutes cache for analytics
    keyGenerator: req => {
      const districtId = extractStringParam(
        req.params['districtId'],
        'districtId'
      )
      return generateDistrictCacheKey(districtId, 'analytics', {
        startDate: req.query['startDate'],
        endDate: req.query['endDate'],
      })
    },
  }),
  async (req: Request, res: Response) => {
    try {
      const districtId = getValidDistrictId(req)
      const { startDate, endDate } = req.query

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
      if (
        startDate &&
        typeof startDate === 'string' &&
        !validateDateFormat(startDate!)
      ) {
        res.status(400).json({
          error: {
            code: 'INVALID_DATE_FORMAT',
            message: 'startDate must be in YYYY-MM-DD format',
          },
        })
        return
      }

      if (
        endDate &&
        typeof endDate === 'string' &&
        !validateDateFormat(endDate!)
      ) {
        res.status(400).json({
          error: {
            code: 'INVALID_DATE_FORMAT',
            message: 'endDate must be in YYYY-MM-DD format',
          },
        })
        return
      }

      // Validate date range
      if (
        startDate &&
        endDate &&
        typeof startDate === 'string' &&
        typeof endDate === 'string'
      ) {
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
      }

      // Generate comprehensive district analytics
      const analyticsEngine = await getAnalyticsEngine()
      const analytics = await analyticsEngine.generateDistrictAnalytics(
        districtId,
        startDate as string | undefined,
        endDate as string | undefined
      )

      // Set cache control headers
      res.set('Cache-Control', 'public, max-age=300') // 5 minutes

      res.json(analytics)
    } catch (error) {
      const errorResponse = transformErrorResponse(error)

      // Check for specific error messages
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to generate district analytics'

      // Requirement 6.1: Return 404 with NO_DATA_AVAILABLE when no snapshot data exists
      if (
        errorMessage.includes('No cached data available') ||
        errorMessage.includes('No snapshot data found') ||
        errorMessage.includes('No district data found')
      ) {
        res.status(404).json({
          error: {
            code: 'NO_DATA_AVAILABLE',
            message: 'No cached data available for analytics',
            details: 'Consider initiating a backfill to fetch historical data',
          },
        })
        return
      }

      // Requirement 6.2: Return 503 with SERVICE_UNAVAILABLE when snapshot store is unavailable
      if (
        errorMessage.includes('ENOENT') ||
        errorMessage.includes('EACCES') ||
        errorMessage.includes('snapshot store') ||
        errorMessage.includes('Failed to read') ||
        errorMessage.includes('Connection refused') ||
        errorMessage.includes('timeout')
      ) {
        res.status(503).json({
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Snapshot store is temporarily unavailable',
            details: 'Please try again later',
          },
        })
        return
      }

      // Requirement 6.3: Include actionable details in error responses
      res.status(500).json({
        error: {
          code: errorResponse.code || 'ANALYTICS_ERROR',
          message: errorMessage,
          details:
            errorResponse.details ||
            'An unexpected error occurred while generating analytics. Please try again or contact support if the issue persists.',
        },
      })
    }
  }
)

/**
 * GET /api/districts/:districtId/clubs/:clubId/trends
 * Get club-specific trend data
 * Requirements: 3.2
 */
analyticsRouter.get(
  '/:districtId/clubs/:clubId/trends',
  cacheMiddleware({
    ttl: 300, // 5 minutes cache
    keyGenerator: req => {
      const districtId = extractStringParam(
        req.params['districtId'],
        'districtId'
      )
      const clubId = extractStringParam(req.params['clubId'], 'clubId')
      return generateDistrictCacheKey(districtId, `clubs/${clubId}/trends`)
    },
  }),
  async (req: Request, res: Response) => {
    try {
      const districtId = getValidDistrictId(req)
      const rawClubId = req.params['clubId']
      const clubId = Array.isArray(rawClubId) ? rawClubId[0] : rawClubId

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

      // Validate club ID
      if (!clubId || clubId.trim() === '') {
        res.status(400).json({
          error: {
            code: 'INVALID_CLUB_ID',
            message: 'Club ID is required',
          },
        })
        return
      }

      // Get club trends
      const analyticsEngine = await getAnalyticsEngine()
      const clubTrend = await analyticsEngine.getClubTrends(districtId, clubId)

      if (!clubTrend) {
        res.status(404).json({
          error: {
            code: 'CLUB_NOT_FOUND',
            message: 'Club not found in district analytics',
            details: 'The club may not exist or no cached data is available',
          },
        })
        return
      }

      // Set cache control headers
      res.set('Cache-Control', 'public, max-age=300') // 5 minutes

      res.json(clubTrend)
    } catch (error) {
      const errorResponse = transformErrorResponse(error)

      // Check for specific error messages
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to get club trends'

      if (errorMessage.includes('No cached data available')) {
        res.status(404).json({
          error: {
            code: 'NO_DATA_AVAILABLE',
            message: errorMessage,
            details: 'Consider initiating a backfill to fetch historical data',
          },
        })
        return
      }

      res.status(500).json({
        error: {
          code: errorResponse.code || 'ANALYTICS_ERROR',
          message: errorMessage,
          details: errorResponse.details,
        },
      })
    }
  }
)

/**
 * GET /api/districts/:districtId/vulnerable-clubs
 * Get list of vulnerable clubs for a district
 * Requirements: 4.4
 *
 * Note: Renamed from at-risk-clubs to vulnerable-clubs to align with
 * internal terminology shift documented in the codebase.
 */
analyticsRouter.get(
  '/:districtId/vulnerable-clubs',
  cacheMiddleware({
    ttl: 300, // 5 minutes cache
    keyGenerator: req => {
      const districtId = extractStringParam(
        req.params['districtId'],
        'districtId'
      )
      return generateDistrictCacheKey(districtId, 'vulnerable-clubs')
    },
  }),
  async (req: Request, res: Response) => {
    try {
      const districtId = getValidDistrictId(req)

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

      // Identify vulnerable clubs (formerly at-risk)
      const analyticsEngine = await getAnalyticsEngine()
      const vulnerableClubs =
        await analyticsEngine.identifyAtRiskClubs(districtId)

      // Get intervention-required clubs separately - only if we have vulnerable clubs data
      let interventionRequiredCount = 0
      let allClubs: ClubTrend[] = [...vulnerableClubs]

      if (vulnerableClubs.length > 0) {
        try {
          const analytics =
            await analyticsEngine.generateDistrictAnalytics(districtId)
          interventionRequiredCount = analytics.interventionRequiredClubs.length
          allClubs = [
            ...vulnerableClubs,
            ...analytics.interventionRequiredClubs,
          ]
        } catch (error) {
          // If analytics fails, just use vulnerable clubs
          logger.warn(
            'Failed to get intervention-required clubs, using vulnerable only',
            {
              districtId,
              error,
            }
          )
        }
      }

      // Set cache control headers
      res.set('Cache-Control', 'public, max-age=300') // 5 minutes

      // Response uses new terminology aligned with frontend expectations
      res.json({
        districtId,
        totalVulnerableClubs: vulnerableClubs.length,
        interventionRequiredClubs: interventionRequiredCount,
        vulnerableClubs: vulnerableClubs.length,
        clubs: allClubs,
      })
    } catch (error) {
      const errorResponse = transformErrorResponse(error)

      // Check for specific error messages
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to identify vulnerable clubs'

      if (errorMessage.includes('No cached data available')) {
        res.status(404).json({
          error: {
            code: 'NO_DATA_AVAILABLE',
            message: errorMessage,
            details: 'Consider initiating a backfill to fetch historical data',
          },
        })
        return
      }

      res.status(500).json({
        error: {
          code: errorResponse.code || 'ANALYTICS_ERROR',
          message: errorMessage,
          details: errorResponse.details,
        },
      })
    }
  }
)

/**
 * GET /api/districts/:districtId/leadership-insights
 * Generate comprehensive leadership effectiveness analytics
 * Query params: startDate (optional), endDate (optional)
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */
analyticsRouter.get(
  '/:districtId/leadership-insights',
  cacheMiddleware({
    ttl: 300, // 5 minutes cache
    keyGenerator: req => {
      const districtId = extractStringParam(
        req.params['districtId'],
        'districtId'
      )
      return generateDistrictCacheKey(districtId, 'leadership-insights', {
        startDate: req.query['startDate'],
        endDate: req.query['endDate'],
      })
    },
  }),
  async (req: Request, res: Response) => {
    try {
      const { districtId } = req.params
      const { startDate, endDate } = req.query

      // Validate district ID - ensure it's a string first
      if (
        !districtId ||
        typeof districtId !== 'string' ||
        !validateDistrictId(districtId)
      ) {
        res.status(400).json({
          error: {
            code: 'INVALID_DISTRICT_ID',
            message: 'Invalid district ID format',
          },
        })
        return
      }

      // Validate date formats if provided
      if (
        startDate &&
        typeof startDate === 'string' &&
        !validateDateFormat(startDate!)
      ) {
        res.status(400).json({
          error: {
            code: 'INVALID_DATE_FORMAT',
            message: 'startDate must be in YYYY-MM-DD format',
          },
        })
        return
      }

      if (
        endDate &&
        typeof endDate === 'string' &&
        !validateDateFormat(endDate!)
      ) {
        res.status(400).json({
          error: {
            code: 'INVALID_DATE_FORMAT',
            message: 'endDate must be in YYYY-MM-DD format',
          },
        })
        return
      }

      // Validate date range
      if (
        startDate &&
        endDate &&
        typeof startDate === 'string' &&
        typeof endDate === 'string'
      ) {
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
      }

      // Generate leadership insights
      const analyticsEngine = await getAnalyticsEngine()
      const insights = await analyticsEngine.generateLeadershipInsights(
        districtId,
        startDate as string | undefined,
        endDate as string | undefined
      )

      // Set cache control headers
      res.set('Cache-Control', 'public, max-age=300') // 5 minutes

      res.json(insights)
    } catch (error) {
      const errorResponse = transformErrorResponse(error)

      // Check for specific error messages
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to generate leadership insights'

      if (errorMessage.includes('No cached data available')) {
        res.status(404).json({
          error: {
            code: 'NO_DATA_AVAILABLE',
            message: errorMessage,
            details: 'Consider initiating a backfill to fetch historical data',
          },
        })
        return
      }

      res.status(500).json({
        error: {
          code: errorResponse.code || 'ANALYTICS_ERROR',
          message: errorMessage,
          details: errorResponse.details,
        },
      })
    }
  }
)

/**
 * GET /api/districts/:districtId/distinguished-club-analytics
 * Generate comprehensive distinguished club analytics
 * Query params: startDate (optional), endDate (optional)
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */
analyticsRouter.get(
  '/:districtId/distinguished-club-analytics',
  cacheMiddleware({
    ttl: 300, // 5 minutes cache
    keyGenerator: req => {
      const districtId = extractStringParam(
        req.params['districtId'],
        'districtId'
      )
      return generateDistrictCacheKey(
        districtId,
        'distinguished-club-analytics',
        {
          startDate: req.query['startDate'],
          endDate: req.query['endDate'],
        }
      )
    },
  }),
  async (req: Request, res: Response) => {
    try {
      const { districtId } = req.params
      const { startDate, endDate } = req.query

      // Validate district ID - ensure it's a string first
      if (
        !districtId ||
        typeof districtId !== 'string' ||
        !validateDistrictId(districtId)
      ) {
        res.status(400).json({
          error: {
            code: 'INVALID_DISTRICT_ID',
            message: 'Invalid district ID format',
          },
        })
        return
      }

      // Validate date formats if provided
      if (
        startDate &&
        typeof startDate === 'string' &&
        !validateDateFormat(startDate!)
      ) {
        res.status(400).json({
          error: {
            code: 'INVALID_DATE_FORMAT',
            message: 'startDate must be in YYYY-MM-DD format',
          },
        })
        return
      }

      if (
        endDate &&
        typeof endDate === 'string' &&
        !validateDateFormat(endDate!)
      ) {
        res.status(400).json({
          error: {
            code: 'INVALID_DATE_FORMAT',
            message: 'endDate must be in YYYY-MM-DD format',
          },
        })
        return
      }

      // Validate date range
      if (
        startDate &&
        endDate &&
        typeof startDate === 'string' &&
        typeof endDate === 'string'
      ) {
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
      }

      // Generate distinguished club analytics
      const analyticsEngine = await getAnalyticsEngine()
      const analytics =
        await analyticsEngine.generateDistinguishedClubAnalytics(
          districtId,
          startDate as string | undefined,
          endDate as string | undefined
        )

      // Set cache control headers
      res.set('Cache-Control', 'public, max-age=300') // 5 minutes

      res.json(analytics)
    } catch (error) {
      const errorResponse = transformErrorResponse(error)

      // Check for specific error messages
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to generate distinguished club analytics'

      if (errorMessage.includes('No cached data available')) {
        res.status(404).json({
          error: {
            code: 'NO_DATA_AVAILABLE',
            message: errorMessage,
            details: 'Consider initiating a backfill to fetch historical data',
          },
        })
        return
      }

      res.status(500).json({
        error: {
          code: errorResponse.code || 'ANALYTICS_ERROR',
          message: errorMessage,
          details: errorResponse.details,
        },
      })
    }
  }
)

/**
 * GET /api/districts/:districtId/year-over-year/:date
 * Calculate year-over-year comparison for a specific date
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */
analyticsRouter.get(
  '/:districtId/year-over-year/:date',
  cacheMiddleware({
    ttl: 300, // 5 minutes cache
    keyGenerator: req => {
      const districtId = extractStringParam(
        req.params['districtId'],
        'districtId'
      )
      const date = extractStringParam(req.params['date'], 'date')
      return generateDistrictCacheKey(districtId, `year-over-year/${date}`)
    },
  }),
  async (req: Request, res: Response) => {
    try {
      const districtId = getValidDistrictId(req)
      const rawDate = req.params['date']
      const date = Array.isArray(rawDate) ? rawDate[0] : rawDate

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

      // Validate date format
      if (!date || !validateDateFormat(date)) {
        res.status(400).json({
          error: {
            code: 'INVALID_DATE_FORMAT',
            message: 'Date must be in YYYY-MM-DD format',
          },
        })
        return
      }

      // Calculate year-over-year comparison
      const analyticsEngine = await getAnalyticsEngine()
      const comparison = await analyticsEngine.calculateYearOverYear(
        districtId,
        date
      )

      // Set cache control headers
      res.set('Cache-Control', 'public, max-age=300') // 5 minutes

      res.json(comparison)
    } catch (error) {
      const errorResponse = transformErrorResponse(error)

      // Check for specific error messages
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to calculate year-over-year comparison'

      res.status(500).json({
        error: {
          code: errorResponse.code || 'ANALYTICS_ERROR',
          message: errorMessage,
          details: errorResponse.details,
        },
      })
    }
  }
)

/**
 * GET /api/districts/:districtId/export
 * Export district data to CSV format
 * Query params: format (csv), startDate (optional), endDate (optional)
 * Requirements: 10.1, 10.3
 */
analyticsRouter.get(
  '/:districtId/export',
  async (req: Request, res: Response) => {
    try {
      const { districtId } = req.params
      const { format, startDate, endDate } = req.query

      // Validate district ID - ensure it's a string first
      if (
        !districtId ||
        typeof districtId !== 'string' ||
        !validateDistrictId(districtId)
      ) {
        res.status(400).json({
          error: {
            code: 'INVALID_DISTRICT_ID',
            message: 'Invalid district ID format',
          },
        })
        return
      }

      // Validate format parameter
      if (!format || format !== 'csv') {
        res.status(400).json({
          error: {
            code: 'INVALID_FORMAT',
            message: 'Only CSV format is currently supported. Use format=csv',
          },
        })
        return
      }

      // Validate date formats if provided
      if (
        startDate &&
        typeof startDate === 'string' &&
        !validateDateFormat(startDate!)
      ) {
        res.status(400).json({
          error: {
            code: 'INVALID_DATE_FORMAT',
            message: 'startDate must be in YYYY-MM-DD format',
          },
        })
        return
      }

      if (
        endDate &&
        typeof endDate === 'string' &&
        !validateDateFormat(endDate!)
      ) {
        res.status(400).json({
          error: {
            code: 'INVALID_DATE_FORMAT',
            message: 'endDate must be in YYYY-MM-DD format',
          },
        })
        return
      }

      // Validate date range
      if (
        startDate &&
        endDate &&
        typeof startDate === 'string' &&
        typeof endDate === 'string'
      ) {
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
      }

      // Generate analytics data for export
      const analyticsEngine = await getAnalyticsEngine()
      const analytics = await analyticsEngine.generateDistrictAnalytics(
        districtId,
        startDate as string | undefined,
        endDate as string | undefined
      )

      // Generate CSV content
      const csvContent = generateDistrictAnalyticsCSV(analytics, districtId)

      // Generate filename with date range
      const dateRangeStr =
        startDate && endDate
          ? `_${startDate}_to_${endDate}`
          : `_${analytics.dateRange.start}_to_${analytics.dateRange.end}`
      const filename = `district_${districtId}_analytics${dateRangeStr}.csv`

      // Set headers for CSV download
      res.setHeader('Content-Type', 'text/csv;charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      res.setHeader('Cache-Control', 'no-cache')

      // Stream the CSV content
      res.send(csvContent)
    } catch (error) {
      const errorResponse = transformErrorResponse(error)

      // Check for specific error messages
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to export district data'

      if (errorMessage.includes('No cached data available')) {
        res.status(404).json({
          error: {
            code: 'NO_DATA_AVAILABLE',
            message: errorMessage,
            details: 'Consider initiating a backfill to fetch historical data',
          },
        })
        return
      }

      res.status(500).json({
        error: {
          code: errorResponse.code || 'EXPORT_ERROR',
          message: errorMessage,
          details: errorResponse.details,
        },
      })
    }
  }
)

/**
 * Helper function to generate CSV content from district analytics
 */
function generateDistrictAnalyticsCSV(
  analytics: DistrictAnalytics,
  districtId: string
): string {
  const lines: string[] = []

  // Helper to escape CSV values
  const escapeCSV = (value: unknown): string => {
    const str = String(value ?? '')
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  // Header section
  lines.push(`District Analytics Export`)
  lines.push(`District ID,${escapeCSV(districtId)}`)
  lines.push(
    `Date Range,${escapeCSV(analytics.dateRange.start)} to ${escapeCSV(analytics.dateRange.end)}`
  )
  lines.push(`Export Date,${new Date().toISOString()}`)
  lines.push('')

  // Summary statistics
  lines.push('Summary Statistics')
  lines.push('Metric,Value')
  lines.push(`Total Membership,${analytics.totalMembership}`)
  lines.push(`Membership Change,${analytics.membershipChange}`)
  lines.push(`Thriving Clubs,${analytics.thrivingClubs.length}`)
  lines.push(`Vulnerable Clubs,${analytics.vulnerableClubs.length}`)
  lines.push(
    `Intervention Required Clubs,${analytics.interventionRequiredClubs.length}`
  )
  lines.push(
    `Distinguished Clubs (Total),${analytics.distinguishedClubs.total}`
  )
  lines.push(
    `Distinguished Clubs (President's),${analytics.distinguishedClubs.presidents}`
  )
  lines.push(
    `Distinguished Clubs (Select),${analytics.distinguishedClubs.select}`
  )
  lines.push(
    `Distinguished Clubs (Distinguished),${analytics.distinguishedClubs.distinguished}`
  )
  lines.push(`Distinguished Projection,${analytics.distinguishedProjection}`)
  lines.push('')

  // Membership trend
  lines.push('Membership Trend')
  lines.push('Date,Member Count')
  analytics.membershipTrend.forEach(
    (point: { date: string; count: number }) => {
      lines.push(`${escapeCSV(point.date)},${point.count}`)
    }
  )
  lines.push('')

  // Top growth clubs
  if (analytics.topGrowthClubs && analytics.topGrowthClubs.length > 0) {
    lines.push('Top Growth Clubs')
    lines.push('Club ID,Club Name,Growth')
    analytics.topGrowthClubs.forEach(
      (club: { clubId: string; clubName: string; growth: number }) => {
        lines.push(
          `${escapeCSV(club.clubId)},${escapeCSV(club.clubName)},${club.growth}`
        )
      }
    )
    lines.push('')
  }

  // Vulnerable clubs (formerly at-risk)
  if (analytics.vulnerableClubs && analytics.vulnerableClubs.length > 0) {
    lines.push('Vulnerable Clubs')
    lines.push(
      'Club ID,Club Name,Status,Current Membership,Current DCP Goals,Risk Factors'
    )
    analytics.vulnerableClubs.forEach((club: ClubTrend) => {
      const currentMembership =
        club.membershipTrend[club.membershipTrend.length - 1]?.count || 0
      const currentDcpGoals =
        club.dcpGoalsTrend[club.dcpGoalsTrend.length - 1]?.goalsAchieved || 0
      const riskFactors = club.riskFactors.join('; ')
      lines.push(
        `${escapeCSV(club.clubId)},${escapeCSV(club.clubName)},${escapeCSV(club.currentStatus)},${currentMembership},${currentDcpGoals},${escapeCSV(riskFactors)}`
      )
    })
    lines.push('')
  }

  // All clubs performance
  if (analytics.allClubs && analytics.allClubs.length > 0) {
    lines.push('All Clubs Performance')
    lines.push(
      'Club ID,Club Name,Division,Area,Current Membership,Current DCP Goals,Status,Distinguished Level'
    )
    analytics.allClubs.forEach((club: ClubTrend) => {
      const currentMembership =
        club.membershipTrend[club.membershipTrend.length - 1]?.count || 0
      const currentDcpGoals =
        club.dcpGoalsTrend[club.dcpGoalsTrend.length - 1]?.goalsAchieved || 0
      lines.push(
        `${escapeCSV(club.clubId)},${escapeCSV(club.clubName)},${escapeCSV(club.divisionName)},${escapeCSV(club.areaName)},${currentMembership},${currentDcpGoals},${escapeCSV(club.currentStatus)},${escapeCSV(club.distinguishedLevel || 'None')}`
      )
    })
    lines.push('')
  }

  // Division rankings
  if (analytics.divisionRankings && analytics.divisionRankings.length > 0) {
    lines.push('Division Rankings')
    lines.push(
      'Rank,Division ID,Division Name,Total Clubs,Total DCP Goals,Average Club Health,Trend'
    )
    analytics.divisionRankings.forEach((division: DivisionAnalytics) => {
      lines.push(
        `${division.rank},${escapeCSV(division.divisionId)},${escapeCSV(division.divisionName)},${division.totalClubs},${division.totalDcpGoals},${division.averageClubHealth.toFixed(2)},${escapeCSV(division.trend)}`
      )
    })
    lines.push('')
  }

  // Top performing areas
  if (analytics.topPerformingAreas && analytics.topPerformingAreas.length > 0) {
    lines.push('Top Performing Areas')
    lines.push(
      'Area ID,Area Name,Division ID,Total Clubs,Total DCP Goals,Average Club Health,Normalized Score'
    )
    analytics.topPerformingAreas.forEach((area: AreaAnalytics) => {
      lines.push(
        `${escapeCSV(area.areaId)},${escapeCSV(area.areaName)},${escapeCSV(area.divisionId)},${area.totalClubs},${area.totalDcpGoals},${area.averageClubHealth.toFixed(2)},${area.normalizedScore.toFixed(2)}`
      )
    })
  }

  return lines.join('\n')
}
