import { Router, type Request, type Response } from 'express'
import { cacheMiddleware } from '../middleware/cache.js'
import { generateDistrictCacheKey } from '../utils/cacheKeys.js'
import { RealToastmastersAPIService } from '../services/RealToastmastersAPIService.js'
import { MockToastmastersAPIService } from '../services/MockToastmastersAPIService.js'
import {
  transformDistrictsResponse,
  transformDistrictStatisticsResponse,
  transformMembershipHistoryResponse,
  transformClubsResponse,
  transformDailyReportsResponse,
  transformDailyReportDetailResponse,
  transformEducationalAwardsResponse,
  transformErrorResponse,
} from '../utils/transformers.js'
import type {
  DistrictsResponse,
  DistrictStatistics,
  MembershipHistoryResponse,
  ClubsResponse,
  DailyReportsResponse,
  DailyReportDetailResponse,
} from '../types/districts.js'

const router = Router()

// Use mock API in development (USE_MOCK_DATA=true), real scraper otherwise
const useMockData = process.env.USE_MOCK_DATA === 'true'
const toastmastersAPI = useMockData
  ? new MockToastmastersAPIService()
  : new RealToastmastersAPIService()

/**
 * Validate district ID format
 */
function validateDistrictId(districtId: string): boolean {
  // District IDs are typically numeric or alphanumeric
  // Adjust this validation based on actual Toastmasters district ID format
  return /^[A-Za-z0-9]+$/.test(districtId) && districtId.length > 0
}

/**
 * GET /api/districts
 * Fetch available districts with caching
 */
router.get(
  '/',
  cacheMiddleware({
    ttl: 900, // 15 minutes
  }),
  async (_req: Request, res: Response) => {
    try {
      // Fetch districts from Toastmasters API
      const apiResponse = await toastmastersAPI.getDistricts()

      // Transform response to internal format
      const districts = transformDistrictsResponse(apiResponse) as DistrictsResponse

      res.json(districts)
    } catch (error) {
      const errorResponse = transformErrorResponse(error)
      
      res.status(500).json({
        error: {
          code: errorResponse.code || 'FETCH_ERROR',
          message: 'Failed to fetch districts',
          details: errorResponse.details,
        },
      })
    }
  }
)

/**
 * GET /api/districts/rankings
 * Fetch all districts with performance rankings
 */
router.get(
  '/rankings',
  cacheMiddleware({
    ttl: 900, // 15 minutes
  }),
  async (_req: Request, res: Response) => {
    try {
      // Fetch district rankings
      const rankings = await toastmastersAPI.getAllDistrictsRankings()

      res.json(rankings)
    } catch (error) {
      const errorResponse = transformErrorResponse(error)
      
      res.status(500).json({
        error: {
          code: errorResponse.code || 'FETCH_ERROR',
          message: 'Failed to fetch district rankings',
          details: errorResponse.details,
        },
      })
    }
  }
)

/**
 * GET /api/districts/:districtId/statistics
 * Fetch district statistics with caching
 */
router.get(
  '/:districtId/statistics',
  cacheMiddleware({
    ttl: 900, // 15 minutes
    keyGenerator: (req) =>
      generateDistrictCacheKey(req.params.districtId, 'statistics'),
  }),
  async (req: Request, res: Response) => {
    try {
      const { districtId } = req.params

      // Validate district ID
      if (!validateDistrictId(districtId)) {
        res.status(400).json({
          error: {
            code: 'INVALID_DISTRICT_ID',
            message: 'Invalid district ID format',
          },
        })
        return
      }

      // Fetch statistics from Toastmasters API
      const apiResponse = await toastmastersAPI.getDistrictStatistics(districtId)

      // Transform response to internal format
      const statistics = transformDistrictStatisticsResponse(apiResponse) as DistrictStatistics

      res.json(statistics)
    } catch (error) {
      const errorResponse = transformErrorResponse(error)
      
      // Check if it's a 404 error (district not found)
      if (errorResponse.code.includes('404')) {
        res.status(404).json({
          error: {
            code: 'DISTRICT_NOT_FOUND',
            message: 'District not found',
          },
        })
        return
      }

      res.status(500).json({
        error: {
          code: errorResponse.code || 'FETCH_ERROR',
          message: 'Failed to fetch district statistics',
          details: errorResponse.details,
        },
      })
    }
  }
)

/**
 * GET /api/districts/:districtId/membership-history
 * Fetch membership history with query parameters
 */
router.get(
  '/:districtId/membership-history',
  cacheMiddleware({
    ttl: 900, // 15 minutes
    keyGenerator: (req) =>
      generateDistrictCacheKey(req.params.districtId, 'membership-history', {
        months: req.query.months,
      }),
  }),
  async (req: Request, res: Response) => {
    try {
      const { districtId } = req.params
      const { months } = req.query

      // Validate district ID
      if (!validateDistrictId(districtId)) {
        res.status(400).json({
          error: {
            code: 'INVALID_DISTRICT_ID',
            message: 'Invalid district ID format',
          },
        })
        return
      }

      // Validate months parameter
      const monthsNum = months ? parseInt(months as string, 10) : 12
      if (isNaN(monthsNum) || monthsNum < 1 || monthsNum > 24) {
        res.status(400).json({
          error: {
            code: 'INVALID_MONTHS_PARAMETER',
            message: 'Months parameter must be a number between 1 and 24',
          },
        })
        return
      }

      // Fetch membership history from Toastmasters API
      const apiResponse = await toastmastersAPI.getMembershipHistory(
        districtId,
        monthsNum
      )

      // Transform response to internal format
      const history = transformMembershipHistoryResponse(apiResponse) as MembershipHistoryResponse

      res.json(history)
    } catch (error) {
      const errorResponse = transformErrorResponse(error)
      
      // Check if it's a 404 error (district not found)
      if (errorResponse.code.includes('404')) {
        res.status(404).json({
          error: {
            code: 'DISTRICT_NOT_FOUND',
            message: 'District not found',
          },
        })
        return
      }

      res.status(500).json({
        error: {
          code: errorResponse.code || 'FETCH_ERROR',
          message: 'Failed to fetch membership history',
          details: errorResponse.details,
        },
      })
    }
  }
)

/**
 * GET /api/districts/:districtId/clubs
 * Fetch clubs for a district
 */
router.get(
  '/:districtId/clubs',
  cacheMiddleware({
    ttl: 900, // 15 minutes
    keyGenerator: (req) =>
      generateDistrictCacheKey(req.params.districtId, 'clubs'),
  }),
  async (req: Request, res: Response) => {
    try {
      const { districtId } = req.params

      // Validate district ID
      if (!validateDistrictId(districtId)) {
        res.status(400).json({
          error: {
            code: 'INVALID_DISTRICT_ID',
            message: 'Invalid district ID format',
          },
        })
        return
      }

      // Fetch clubs from Toastmasters API
      const apiResponse = await toastmastersAPI.getClubs(districtId)

      // Transform response to internal format
      const clubs = transformClubsResponse(apiResponse) as ClubsResponse

      res.json(clubs)
    } catch (error) {
      const errorResponse = transformErrorResponse(error)
      
      // Check if it's a 404 error (district not found)
      if (errorResponse.code.includes('404')) {
        res.status(404).json({
          error: {
            code: 'DISTRICT_NOT_FOUND',
            message: 'District not found',
          },
        })
        return
      }

      res.status(500).json({
        error: {
          code: errorResponse.code || 'FETCH_ERROR',
          message: 'Failed to fetch clubs',
          details: errorResponse.details,
        },
      })
    }
  }
)

/**
 * GET /api/districts/:districtId/educational-awards
 * Fetch educational awards history with query parameters
 */
router.get(
  '/:districtId/educational-awards',
  cacheMiddleware({
    ttl: 900, // 15 minutes
    keyGenerator: (req) =>
      generateDistrictCacheKey(req.params.districtId, 'educational-awards', {
        months: req.query.months,
      }),
  }),
  async (req: Request, res: Response) => {
    try {
      const { districtId } = req.params
      const { months } = req.query

      // Validate district ID
      if (!validateDistrictId(districtId)) {
        res.status(400).json({
          error: {
            code: 'INVALID_DISTRICT_ID',
            message: 'Invalid district ID format',
          },
        })
        return
      }

      // Validate months parameter
      const monthsNum = months ? parseInt(months as string, 10) : 12
      if (isNaN(monthsNum) || monthsNum < 1 || monthsNum > 24) {
        res.status(400).json({
          error: {
            code: 'INVALID_MONTHS_PARAMETER',
            message: 'Months parameter must be a number between 1 and 24',
          },
        })
        return
      }

      // Fetch educational awards from Toastmasters API
      const apiResponse = await toastmastersAPI.getEducationalAwards(
        districtId,
        monthsNum
      )

      // Transform response to internal format
      const awards = transformEducationalAwardsResponse(apiResponse)

      res.json(awards)
    } catch (error) {
      const errorResponse = transformErrorResponse(error)
      
      // Check if it's a 404 error (district not found)
      if (errorResponse.code.includes('404')) {
        res.status(404).json({
          error: {
            code: 'DISTRICT_NOT_FOUND',
            message: 'District not found',
          },
        })
        return
      }

      res.status(500).json({
        error: {
          code: errorResponse.code || 'FETCH_ERROR',
          message: 'Failed to fetch educational awards',
          details: errorResponse.details,
        },
      })
    }
  }
)

/**
 * Validate date format (YYYY-MM-DD)
 */
function validateDateFormat(date: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(date)) {
    return false
  }
  
  const parsedDate = new Date(date)
  return !isNaN(parsedDate.getTime())
}

/**
 * GET /api/districts/:districtId/daily-reports
 * Fetch daily reports for a date range
 */
router.get(
  '/:districtId/daily-reports',
  cacheMiddleware({
    ttl: 900, // 15 minutes
    keyGenerator: (req) =>
      generateDistrictCacheKey(req.params.districtId, 'daily-reports', {
        startDate: req.query.startDate,
        endDate: req.query.endDate,
      }),
  }),
  async (req: Request, res: Response) => {
    try {
      const { districtId } = req.params
      const { startDate, endDate } = req.query

      // Validate district ID
      if (!validateDistrictId(districtId)) {
        res.status(400).json({
          error: {
            code: 'INVALID_DISTRICT_ID',
            message: 'Invalid district ID format',
          },
        })
        return
      }

      // Validate date parameters
      if (!startDate || !endDate) {
        res.status(400).json({
          error: {
            code: 'MISSING_DATE_PARAMETERS',
            message: 'Both startDate and endDate query parameters are required',
          },
        })
        return
      }

      if (typeof startDate !== 'string' || typeof endDate !== 'string') {
        res.status(400).json({
          error: {
            code: 'INVALID_DATE_FORMAT',
            message: 'Date parameters must be strings',
          },
        })
        return
      }

      if (!validateDateFormat(startDate) || !validateDateFormat(endDate)) {
        res.status(400).json({
          error: {
            code: 'INVALID_DATE_FORMAT',
            message: 'Dates must be in YYYY-MM-DD format',
          },
        })
        return
      }

      // Validate date range
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

      // Limit date range to prevent excessive data requests (e.g., max 90 days)
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      if (daysDiff > 90) {
        res.status(400).json({
          error: {
            code: 'DATE_RANGE_TOO_LARGE',
            message: 'Date range cannot exceed 90 days',
          },
        })
        return
      }

      // Fetch daily reports from Toastmasters API
      const apiResponse = await toastmastersAPI.getDailyReports(
        districtId,
        startDate,
        endDate
      )

      // Transform response to internal format
      const reports = transformDailyReportsResponse(apiResponse) as DailyReportsResponse

      res.json(reports)
    } catch (error) {
      const errorResponse = transformErrorResponse(error)
      
      // Check if it's a 404 error (district not found)
      if (errorResponse.code.includes('404')) {
        res.status(404).json({
          error: {
            code: 'DISTRICT_NOT_FOUND',
            message: 'District not found',
          },
        })
        return
      }

      res.status(500).json({
        error: {
          code: errorResponse.code || 'FETCH_ERROR',
          message: 'Failed to fetch daily reports',
          details: errorResponse.details,
        },
      })
    }
  }
)

/**
 * GET /api/districts/:districtId/daily-reports/:date
 * Fetch detailed daily report for a specific date
 */
router.get(
  '/:districtId/daily-reports/:date',
  cacheMiddleware({
    ttl: 900, // 15 minutes
    keyGenerator: (req) =>
      generateDistrictCacheKey(req.params.districtId, `daily-reports/${req.params.date}`),
  }),
  async (req: Request, res: Response) => {
    try {
      const { districtId, date } = req.params

      // Validate district ID
      if (!validateDistrictId(districtId)) {
        res.status(400).json({
          error: {
            code: 'INVALID_DISTRICT_ID',
            message: 'Invalid district ID format',
          },
        })
        return
      }

      // Validate date format
      if (!validateDateFormat(date)) {
        res.status(400).json({
          error: {
            code: 'INVALID_DATE_FORMAT',
            message: 'Date must be in YYYY-MM-DD format',
          },
        })
        return
      }

      // Validate date is not in the future
      const requestedDate = new Date(date)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      if (requestedDate > today) {
        res.status(400).json({
          error: {
            code: 'FUTURE_DATE_NOT_ALLOWED',
            message: 'Cannot fetch reports for future dates',
          },
        })
        return
      }

      // Fetch daily report detail from Toastmasters API
      const apiResponse = await toastmastersAPI.getDailyReportDetail(
        districtId,
        date
      )

      // Transform response to internal format
      const report = transformDailyReportDetailResponse(apiResponse) as DailyReportDetailResponse

      res.json(report)
    } catch (error) {
      const errorResponse = transformErrorResponse(error)
      
      // Check if it's a 404 error (district or report not found)
      if (errorResponse.code.includes('404')) {
        res.status(404).json({
          error: {
            code: 'REPORT_NOT_FOUND',
            message: 'Daily report not found for the specified date',
          },
        })
        return
      }

      res.status(500).json({
        error: {
          code: errorResponse.code || 'FETCH_ERROR',
          message: 'Failed to fetch daily report detail',
          details: errorResponse.details,
        },
      })
    }
  }
)

export default router
