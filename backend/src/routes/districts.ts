import { Router, type Request, type Response } from 'express'
import { cacheMiddleware } from '../middleware/cache.js'
import { generateDistrictCacheKey } from '../utils/cacheKeys.js'
import { RealToastmastersAPIService } from '../services/RealToastmastersAPIService.js'
import { MockToastmastersAPIService } from '../services/MockToastmastersAPIService.js'
import { BackfillService } from '../services/BackfillService.js'
import { CacheManager } from '../services/CacheManager.js'
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
  BackfillRequest,
} from '../types/districts.js'

const router = Router()

// Use mock API in development (USE_MOCK_DATA=true), real scraper otherwise
const useMockData = process.env.USE_MOCK_DATA === 'true'
const toastmastersAPI = useMockData
  ? new MockToastmastersAPIService()
  : new RealToastmastersAPIService()

// Initialize services
const cacheManager = new CacheManager()
const backfillService = new BackfillService(cacheManager, toastmastersAPI)

// Cleanup old jobs every hour
setInterval(() => {
  backfillService.cleanupOldJobs().catch(error => {
    console.error('Failed to cleanup old backfill jobs:', error)
  })
}, 60 * 60 * 1000)

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
 * Optional query param: date (YYYY-MM-DD)
 */
router.get(
  '/rankings',
  cacheMiddleware({
    ttl: 900, // 15 minutes
  }),
  async (req: Request, res: Response) => {
    try {
      const date = req.query.date as string | undefined
      
      // Fetch district rankings (with optional date)
      const rankings = await toastmastersAPI.getAllDistrictsRankings(date)

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
 * GET /api/districts/cache/dates
 * Get all cached dates
 */
router.get('/cache/dates', async (_req: Request, res: Response) => {
  try {
    const dates = await toastmastersAPI.getCachedDates()
    res.json({ dates })
  } catch (error) {
    const errorResponse = transformErrorResponse(error)
    res.status(500).json({
      error: {
        code: errorResponse.code || 'FETCH_ERROR',
        message: 'Failed to get cached dates',
        details: errorResponse.details,
      },
    })
  }
})

/**
 * GET /api/districts/cache/statistics
 * Get cache statistics including metadata
 */
router.get('/cache/statistics', async (_req: Request, res: Response) => {
  try {
    const statistics = await toastmastersAPI.getCacheStatistics()
    res.json(statistics)
  } catch (error) {
    const errorResponse = transformErrorResponse(error)
    res.status(500).json({
      error: {
        code: errorResponse.code || 'FETCH_ERROR',
        message: 'Failed to get cache statistics',
        details: errorResponse.details,
      },
    })
  }
})

/**
 * GET /api/districts/cache/metadata/:date
 * Get metadata for a specific cached date
 */
router.get('/cache/metadata/:date', async (req: Request, res: Response) => {
  try {
    const { date } = req.params
    
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
    
    const metadata = await toastmastersAPI.getCacheMetadata(date)
    
    if (!metadata) {
      res.status(404).json({
        error: {
          code: 'METADATA_NOT_FOUND',
          message: 'No metadata found for the specified date',
        },
      })
      return
    }
    
    res.json(metadata)
  } catch (error) {
    const errorResponse = transformErrorResponse(error)
    res.status(500).json({
      error: {
        code: errorResponse.code || 'FETCH_ERROR',
        message: 'Failed to get cache metadata',
        details: errorResponse.details,
      },
    })
  }
})

/**
 * DELETE /api/districts/cache
 * Clear all cache
 */
router.delete('/cache', async (_req: Request, res: Response) => {
  try {
    await toastmastersAPI.clearCache()
    res.json({ success: true, message: 'Cache cleared successfully' })
  } catch (error) {
    const errorResponse = transformErrorResponse(error)
    res.status(500).json({
      error: {
        code: errorResponse.code || 'FETCH_ERROR',
        message: 'Failed to clear cache',
        details: errorResponse.details,
      },
    })
  }
})

/**
 * GET /api/districts/available-dates
 * Get all available dates with month/day information
 */
router.get('/available-dates', async (_req: Request, res: Response) => {
  try {
    const availableDates = await toastmastersAPI.getAvailableDates()
    res.json(availableDates)
  } catch (error) {
    const errorResponse = transformErrorResponse(error)
    res.status(500).json({
      error: {
        code: errorResponse.code || 'FETCH_ERROR',
        message: 'Failed to get available dates',
        details: errorResponse.details,
      },
    })
  }
})

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

/**
 * GET /api/districts/:districtId/rank-history
 * Fetch historical rank data for a district
 * Query params: startDate (optional), endDate (optional)
 */
router.get(
  '/:districtId/rank-history',
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

      // Fetch rank history from Toastmasters API
      const rankHistory = await toastmastersAPI.getDistrictRankHistory(
        districtId,
        startDate as string | undefined,
        endDate as string | undefined
      )

      res.json(rankHistory)
    } catch (error) {
      const errorResponse = transformErrorResponse(error)
      
      res.status(500).json({
        error: {
          code: errorResponse.code || 'FETCH_ERROR',
          message: 'Failed to fetch district rank history',
          details: errorResponse.details,
        },
      })
    }
  }
)

/**
 * POST /api/districts/backfill
 * Initiate backfill of historical data (only fetches missing dates)
 */
router.post('/backfill', async (req: Request, res: Response) => {
  try {
    const request: BackfillRequest = req.body

    // Validate date formats if provided
    if (request.startDate && !validateDateFormat(request.startDate)) {
      res.status(400).json({
        error: {
          code: 'INVALID_DATE_FORMAT',
          message: 'startDate must be in YYYY-MM-DD format',
        },
      })
      return
    }

    if (request.endDate && !validateDateFormat(request.endDate)) {
      res.status(400).json({
        error: {
          code: 'INVALID_DATE_FORMAT',
          message: 'endDate must be in YYYY-MM-DD format',
        },
      })
      return
    }

    // Validate date range
    if (request.startDate && request.endDate) {
      const start = new Date(request.startDate)
      const end = new Date(request.endDate)
      
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

    const backfillId = await backfillService.initiateBackfill(request)
    const status = backfillService.getBackfillStatus(backfillId)

    res.json(status)
  } catch (error) {
    const errorResponse = transformErrorResponse(error)
    
    res.status(500).json({
      error: {
        code: errorResponse.code || 'BACKFILL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to initiate backfill',
        details: errorResponse.details,
      },
    })
  }
})

/**
 * GET /api/districts/backfill/:backfillId
 * Get backfill progress/status
 */
router.get('/backfill/:backfillId', async (req: Request, res: Response) => {
  try {
    const { backfillId } = req.params

    const status = backfillService.getBackfillStatus(backfillId)

    if (!status) {
      res.status(404).json({
        error: {
          code: 'BACKFILL_NOT_FOUND',
          message: 'Backfill job not found',
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
})

/**
 * DELETE /api/districts/backfill/:backfillId
 * Cancel a backfill job
 */
router.delete('/backfill/:backfillId', async (req: Request, res: Response) => {
  try {
    const { backfillId } = req.params

    const cancelled = await backfillService.cancelBackfill(backfillId)

    if (!cancelled) {
      res.status(404).json({
        error: {
          code: 'BACKFILL_NOT_FOUND',
          message: 'Backfill job not found or cannot be cancelled',
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
})

export default router
