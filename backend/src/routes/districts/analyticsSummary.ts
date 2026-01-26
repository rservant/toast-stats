/**
 * Aggregated Analytics Summary Route
 *
 * Provides a single endpoint that returns combined analytics data from
 * pre-computed analytics and time-series index for fast retrieval.
 *
 * Requirements:
 * - 4.1: Provide a single aggregated endpoint that returns analytics, distinguished
 *        club analytics, and leadership insights in one response
 * - 4.4: Support the same query parameters (startDate, endDate) as individual endpoints
 */

import { Router, type Request, type Response } from 'express'
import { cacheMiddleware } from '../../middleware/cache.js'
import { requestDeduplicationMiddleware } from '../../middleware/requestDeduplication.js'
import { generateDistrictCacheKey } from '../../utils/cacheKeys.js'
import { logger } from '../../utils/logger.js'
import { transformErrorResponse } from '../../utils/transformers.js'
import type { PreComputedAnalyticsSummary } from '../../types/precomputedAnalytics.js'
import {
  getValidDistrictId,
  validateDateFormat,
  getPreComputedAnalyticsService,
  getTimeSeriesIndexService,
  getAnalyticsEngine,
  extractStringParam,
} from './shared.js'

export const analyticsSummaryRouter = Router()

/**
 * Response type for the aggregated analytics endpoint
 *
 * Combines summary data from pre-computed analytics with trend data
 * from the time-series index for efficient retrieval.
 */
interface AggregatedAnalyticsResponse {
  districtId: string
  dateRange: { start: string; end: string }

  // Summary data (from pre-computed analytics)
  summary: {
    totalMembership: number
    membershipChange: number
    clubCounts: {
      total: number
      thriving: number
      vulnerable: number
      interventionRequired: number
    }
    distinguishedClubs: {
      smedley: number
      presidents: number
      select: number
      distinguished: number
      total: number
    }
    distinguishedProjection: number
  }

  // Trend data (from time-series index)
  trends: {
    membership: Array<{ date: string; count: number }>
    payments?: Array<{ date: string; payments: number }>
  }

  // Year-over-year comparison
  yearOverYear?: {
    membershipChange: number
    distinguishedChange: number
    clubHealthChange: number
  }

  // Performance targets (from latest snapshot)
  performanceTargets?: {
    membershipTarget?: number
    distinguishedTarget?: number
    clubGrowthTarget?: number
  }

  // Metadata
  dataSource: 'precomputed' | 'computed'
  computedAt: string
}

/**
 * GET /api/districts/:districtId/analytics-summary
 *
 * Returns aggregated analytics data combining:
 * - Summary metrics from pre-computed analytics
 * - Trend data from time-series index
 * - Year-over-year comparison
 *
 * Query params:
 * - startDate (optional): Start date for trend data (YYYY-MM-DD)
 * - endDate (optional): End date for trend data (YYYY-MM-DD)
 *
 * Requirements:
 * - 4.1: Single aggregated endpoint returning analytics in one response
 * - 4.4: Support startDate and endDate query parameters
 * - 6.1: Process only one request and share result with all waiting clients
 */
analyticsSummaryRouter.get(
  '/:districtId/analytics-summary',
  // Request deduplication middleware - prevents redundant processing of concurrent identical requests
  // Requirement 6.1: Process only one request and share result with all waiting clients
  requestDeduplicationMiddleware({
    keyGenerator: req => {
      const districtId = extractStringParam(
        req.params['districtId'],
        'districtId'
      )
      return generateDistrictCacheKey(districtId, 'analytics-summary-dedup', {
        startDate: req.query['startDate'],
        endDate: req.query['endDate'],
      })
    },
  }),
  cacheMiddleware({
    ttl: 300, // 5 minutes cache for analytics summary
    keyGenerator: req => {
      const districtId = extractStringParam(
        req.params['districtId'],
        'districtId'
      )
      return generateDistrictCacheKey(districtId, 'analytics-summary', {
        startDate: req.query['startDate'],
        endDate: req.query['endDate'],
      })
    },
  }),
  async (req: Request, res: Response) => {
    const startTime = Date.now()
    const operationId = `analytics_summary_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

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

      logger.info('Processing analytics summary request', {
        operation: 'getAnalyticsSummary',
        operationId,
        districtId,
        startDate,
        endDate,
      })

      // Validate date formats if provided
      if (
        startDate &&
        typeof startDate === 'string' &&
        !validateDateFormat(startDate)
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
        !validateDateFormat(endDate)
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

      // Get services
      const preComputedAnalyticsService = await getPreComputedAnalyticsService()
      const timeSeriesIndexService = await getTimeSeriesIndexService()

      // Determine date range for queries
      const effectiveEndDate =
        typeof endDate === 'string'
          ? endDate
          : new Date().toISOString().split('T')[0]

      // Default to current program year start if no start date provided
      const effectiveStartDate =
        typeof startDate === 'string'
          ? startDate
          : getProgramYearStartDate(
              effectiveEndDate ?? new Date().toISOString().split('T')[0] ?? ''
            )

      // Try to get pre-computed analytics first
      let summary: PreComputedAnalyticsSummary | null = null
      let dataSource: 'precomputed' | 'computed' = 'precomputed'

      summary = await preComputedAnalyticsService.getLatestSummary(districtId)

      if (!summary) {
        // Requirement 11.3: Log warning when pre-computed analytics are missing
        logger.warn(
          'Pre-computed analytics not available for requested date range',
          {
            operation: 'analyticsRequest',
            districtId,
            data_source: 'computed',
            message:
              'Backfill may be needed to generate pre-computed analytics',
          }
        )
        dataSource = 'computed'
      }

      // Get trend data from time-series index
      let trendData: Array<{ date: string; count: number }> = []
      let paymentsTrend: Array<{ date: string; payments: number }> = []

      try {
        const timeSeriesData = await timeSeriesIndexService.getTrendData(
          districtId,
          effectiveStartDate ?? '',
          effectiveEndDate ?? ''
        )

        trendData = timeSeriesData.map(dp => ({
          date: dp.date,
          count: dp.membership,
        }))

        paymentsTrend = timeSeriesData.map(dp => ({
          date: dp.date,
          payments: dp.payments,
        }))

        logger.debug('Retrieved trend data from time-series index', {
          operation: 'getAnalyticsSummary',
          operationId,
          districtId,
          dataPointCount: timeSeriesData.length,
        })
      } catch (trendError) {
        logger.warn('Failed to get trend data from time-series index', {
          operation: 'getAnalyticsSummary',
          operationId,
          districtId,
          error:
            trendError instanceof Error ? trendError.message : 'Unknown error',
        })
        // Continue without trend data - we can still return summary
      }

      // Calculate year-over-year comparison if we have enough data
      let yearOverYear: AggregatedAnalyticsResponse['yearOverYear'] | undefined

      try {
        const analyticsEngine = await getAnalyticsEngine()
        const yoyComparison = await analyticsEngine.calculateYearOverYear(
          districtId,
          effectiveEndDate ?? new Date().toISOString().split('T')[0] ?? ''
        )

        if (
          yoyComparison &&
          yoyComparison.dataAvailable &&
          yoyComparison.metrics
        ) {
          yearOverYear = {
            membershipChange: yoyComparison.metrics.membership.change,
            distinguishedChange:
              yoyComparison.metrics.distinguishedClubs.change,
            clubHealthChange:
              yoyComparison.metrics.clubHealth.thrivingClubs.change,
          }
        }
      } catch (yoyError) {
        logger.debug('Year-over-year comparison not available', {
          operation: 'getAnalyticsSummary',
          operationId,
          districtId,
          error: yoyError instanceof Error ? yoyError.message : 'Unknown error',
        })
        // Year-over-year is optional, continue without it
      }

      // Build the response
      let response: AggregatedAnalyticsResponse

      if (summary) {
        // Use pre-computed data
        response = {
          districtId,
          dateRange: {
            start: effectiveStartDate ?? '',
            end: effectiveEndDate ?? '',
          },
          summary: {
            totalMembership: summary.totalMembership,
            membershipChange: summary.membershipChange,
            clubCounts: {
              total: summary.clubCounts.total,
              thriving: summary.clubCounts.thriving,
              vulnerable: summary.clubCounts.vulnerable,
              interventionRequired: summary.clubCounts.interventionRequired,
            },
            distinguishedClubs: {
              smedley: summary.distinguishedClubs.smedley,
              presidents: summary.distinguishedClubs.presidents,
              select: summary.distinguishedClubs.select,
              distinguished: summary.distinguishedClubs.distinguished,
              total: summary.distinguishedClubs.total,
            },
            distinguishedProjection: calculateDistinguishedProjection(
              summary.distinguishedClubs.total,
              summary.clubCounts.total
            ),
          },
          trends: {
            membership: trendData,
            payments: paymentsTrend.length > 0 ? paymentsTrend : undefined,
          },
          yearOverYear,
          dataSource,
          computedAt: summary.computedAt,
        }
      } else {
        // Fall back to computing from analytics engine
        // Requirement 4.5: Fall back to on-demand computation with warning log
        // Requirement 11.3: Log warning indicating backfill may be needed
        logger.warn('Falling back to on-demand analytics computation', {
          operation: 'analyticsRequest',
          districtId,
          data_source: 'computed',
          message:
            'Pre-computed analytics not available, backfill may be needed',
        })

        const analyticsEngine = await getAnalyticsEngine()
        const computedAnalytics =
          await analyticsEngine.generateDistrictAnalytics(
            districtId,
            effectiveStartDate,
            effectiveEndDate
          )

        response = {
          districtId,
          dateRange: computedAnalytics.dateRange,
          summary: {
            totalMembership: computedAnalytics.totalMembership,
            membershipChange: computedAnalytics.membershipChange,
            clubCounts: {
              total:
                computedAnalytics.thrivingClubs.length +
                computedAnalytics.vulnerableClubs.length +
                computedAnalytics.interventionRequiredClubs.length,
              thriving: computedAnalytics.thrivingClubs.length,
              vulnerable: computedAnalytics.vulnerableClubs.length,
              interventionRequired:
                computedAnalytics.interventionRequiredClubs.length,
            },
            distinguishedClubs: {
              smedley: computedAnalytics.distinguishedClubs.smedley ?? 0,
              presidents: computedAnalytics.distinguishedClubs.presidents ?? 0,
              select: computedAnalytics.distinguishedClubs.select ?? 0,
              distinguished:
                computedAnalytics.distinguishedClubs.distinguished ?? 0,
              total: computedAnalytics.distinguishedClubs.total,
            },
            distinguishedProjection: computedAnalytics.distinguishedProjection,
          },
          trends: {
            membership: computedAnalytics.membershipTrend,
            payments: undefined, // Not available from computed analytics
          },
          yearOverYear,
          dataSource: 'computed',
          computedAt: new Date().toISOString(),
        }
      }

      const duration = Date.now() - startTime

      // Log performance metrics
      // Requirement 11.1: Log total processing time and whether pre-computed data was used
      logger.info('Analytics request completed', {
        operation: 'analyticsRequest',
        districtId,
        duration_ms: duration,
        data_source: response.dataSource,
        trendDataPoints: response.trends.membership.length,
        hasYearOverYear: !!response.yearOverYear,
      })

      // Requirement 11.2: Log warning if response time exceeds 5 seconds
      if (duration > 5000) {
        logger.warn('Analytics request exceeded 5 second threshold', {
          operation: 'analyticsRequest',
          districtId,
          duration_ms: duration,
          data_source: response.dataSource,
          warning: true,
        })
      }

      // Set cache control headers
      res.set('Cache-Control', 'public, max-age=300') // 5 minutes

      res.json(response)
    } catch (error) {
      const duration = Date.now() - startTime
      const errorResponse = transformErrorResponse(error)
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to generate analytics summary'

      logger.error('Analytics summary request failed', {
        operation: 'getAnalyticsSummary',
        operationId,
        error: errorMessage,
        durationMs: duration,
      })

      // Check for specific error messages
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

      if (
        errorMessage.includes('ENOENT') ||
        errorMessage.includes('EACCES') ||
        errorMessage.includes('snapshot store') ||
        errorMessage.includes('Failed to read')
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

      res.status(500).json({
        error: {
          code: errorResponse.code || 'ANALYTICS_ERROR',
          message: errorMessage,
          details:
            errorResponse.details ||
            'An unexpected error occurred while generating analytics summary.',
        },
      })
    }
  }
)

/**
 * Calculate the program year start date for a given date
 *
 * Toastmasters program years run from July 1 to June 30.
 * For example:
 * - 2024-01-15 is in program year 2023-2024, which starts 2023-07-01
 * - 2024-08-15 is in program year 2024-2025, which starts 2024-07-01
 */
function getProgramYearStartDate(dateStr: string): string {
  const parts = dateStr.split('-')
  const year = parseInt(parts[0] ?? '0', 10)
  const month = parseInt(parts[1] ?? '0', 10)

  // If month is July (7) or later, program year starts this year
  // If month is before July, program year started last year
  if (month >= 7) {
    return `${year}-07-01`
  } else {
    return `${year - 1}-07-01`
  }
}

/**
 * Calculate distinguished club projection based on current progress
 *
 * Simple projection based on current distinguished percentage
 * and remaining time in the program year.
 */
function calculateDistinguishedProjection(
  currentDistinguished: number,
  totalClubs: number
): number {
  if (totalClubs === 0) {
    return 0
  }

  // Get current date and calculate progress through program year
  const now = new Date()
  const currentMonth = now.getMonth() + 1 // 1-12
  const currentYear = now.getFullYear()

  // Determine program year boundaries
  let programYearStart: Date
  let programYearEnd: Date

  if (currentMonth >= 7) {
    programYearStart = new Date(currentYear, 6, 1) // July 1 of current year
    programYearEnd = new Date(currentYear + 1, 5, 30) // June 30 of next year
  } else {
    programYearStart = new Date(currentYear - 1, 6, 1) // July 1 of previous year
    programYearEnd = new Date(currentYear, 5, 30) // June 30 of current year
  }

  // Calculate progress through program year (0 to 1)
  const totalDays =
    (programYearEnd.getTime() - programYearStart.getTime()) /
    (1000 * 60 * 60 * 24)
  const elapsedDays =
    (now.getTime() - programYearStart.getTime()) / (1000 * 60 * 60 * 24)
  const progress = Math.min(1, Math.max(0, elapsedDays / totalDays))

  // If we're very early in the year, don't project
  if (progress < 0.1) {
    return currentDistinguished
  }

  // Simple linear projection
  const projectedDistinguished = Math.round(currentDistinguished / progress)

  // Cap at total clubs
  return Math.min(projectedDistinguished, totalClubs)
}
