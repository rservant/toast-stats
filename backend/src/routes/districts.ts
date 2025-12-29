import { Router, type Request, type Response } from 'express'
import { cacheMiddleware } from '../middleware/cache.js'
import { generateDistrictCacheKey } from '../utils/cacheKeys.js'
import { logger } from '../utils/logger.js'
import { RealToastmastersAPIService } from '../services/RealToastmastersAPIService.js'
import { MockToastmastersAPIService } from '../services/MockToastmastersAPIService.js'
import { BackfillService } from '../services/BackfillService.js'
import { CacheManager } from '../services/CacheManager.js'
import { DistrictBackfillService } from '../services/DistrictBackfillService.js'
import { DistrictCacheManager } from '../services/DistrictCacheManager.js'
import { getProductionServiceFactory } from '../services/ProductionServiceFactory.js'
import { ToastmastersScraper } from '../services/ToastmastersScraper.js'
import {
  DistrictAnalytics,
  ClubTrend,
  DivisionAnalytics,
  AreaAnalytics,
} from '../types/analytics.js'
import { AnalyticsEngine } from '../services/AnalyticsEngine.js'
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
// Force mock data in test environment
const useMockData =
  process.env.USE_MOCK_DATA === 'true' || process.env.NODE_ENV === 'test'

const toastmastersAPI = useMockData
  ? new MockToastmastersAPIService()
  : new RealToastmastersAPIService()

// Initialize cache configuration service and get cache directory
const productionFactory = getProductionServiceFactory()
const cacheConfig = productionFactory.createCacheConfigService()
const cacheDirectory = cacheConfig.getCacheDirectory()

// Initialize services with configured cache directory
const cacheManager = new CacheManager(cacheDirectory)
const backfillService = new BackfillService(cacheManager, toastmastersAPI)

// Initialize district-level services with configured cache directory
const districtCacheManager = new DistrictCacheManager(cacheDirectory)
const scraper = new ToastmastersScraper()
const districtBackfillService = new DistrictBackfillService(
  districtCacheManager,
  scraper
)
const analyticsEngine = new AnalyticsEngine(districtCacheManager)

// Initialize cache configuration asynchronously (validation happens lazily)
cacheConfig.initialize().catch((error: unknown) => {
  console.error('Failed to initialize cache configuration:', error)
  // Services will still work with the resolved cache directory path
})

// Cleanup old jobs every hour
setInterval(
  () => {
    backfillService.cleanupOldJobs().catch(error => {
      console.error('Failed to cleanup old backfill jobs:', error)
    })
  },
  60 * 60 * 1000
)

// Cleanup old district backfill jobs every hour
setInterval(
  () => {
    districtBackfillService.cleanupOldJobs().catch(error => {
      console.error('Failed to cleanup old district backfill jobs:', error)
    })
  },
  60 * 60 * 1000
)

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
      const districts = transformDistrictsResponse(
        apiResponse
      ) as DistrictsResponse

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
      console.error('Error in rankings endpoint:', error)
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
 * GET /api/districts/cache/version
 * Get cache version information
 */
router.get('/cache/version', async (_req: Request, res: Response) => {
  try {
    const cacheManagerInstance = cacheManager
    if (!cacheManagerInstance) {
      return res.status(500).json({
        error: {
          code: 'CACHE_UNAVAILABLE',
          message: 'Cache manager not available',
        },
      })
    }

    const currentVersion = (
      cacheManagerInstance.constructor as typeof CacheManager
    ).getCacheVersion()
    const statistics = await cacheManagerInstance.getCacheStatistics()

    res.json({
      currentVersion,
      statistics,
      versionHistory: {
        1: 'Simple rank-sum scoring system (legacy)',
        2: 'Borda count scoring with percentage-based ranking (current)',
      },
    })
  } catch (error) {
    const errorResponse = transformErrorResponse(error)
    res.status(500).json({
      error: {
        code: errorResponse.code || 'CACHE_ERROR',
        message: 'Failed to get cache version information',
        details: errorResponse.details,
      },
    })
  }
})

/**
 * GET /api/districts/cache/stats
 * Get detailed cache statistics
 */
router.get('/cache/stats', async (_req: Request, res: Response) => {
  try {
    const cacheManagerInstance = cacheManager
    if (!cacheManagerInstance) {
      return res.status(500).json({
        error: {
          code: 'CACHE_UNAVAILABLE',
          message: 'Cache manager not available',
        },
      })
    }

    const statistics = await cacheManagerInstance.getCacheStatistics()
    res.json(statistics)
  } catch (error) {
    const errorResponse = transformErrorResponse(error)
    res.status(500).json({
      error: {
        code: errorResponse.code || 'CACHE_ERROR',
        message: 'Failed to get cache statistics',
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
    keyGenerator: req =>
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
      const apiResponse =
        await toastmastersAPI.getDistrictStatistics(districtId)

      // Transform response to internal format
      const statistics = transformDistrictStatisticsResponse(
        apiResponse
      ) as DistrictStatistics

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
    keyGenerator: req =>
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
      const history = transformMembershipHistoryResponse(
        apiResponse
      ) as MembershipHistoryResponse

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
    keyGenerator: req =>
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
    keyGenerator: req =>
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
    keyGenerator: req =>
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
      const daysDiff = Math.ceil(
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
      )
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
      const reports = transformDailyReportsResponse(
        apiResponse
      ) as DailyReportsResponse

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
    keyGenerator: req =>
      generateDistrictCacheKey(
        req.params.districtId,
        `daily-reports/${req.params.date}`
      ),
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
      const report = transformDailyReportDetailResponse(
        apiResponse
      ) as DailyReportDetailResponse

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
router.get('/:districtId/rank-history', async (req: Request, res: Response) => {
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
})

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
        message:
          error instanceof Error
            ? error.message
            : 'Failed to initiate backfill',
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

/**
 * GET /api/districts/:districtId/data/:date
 * Retrieve cached district data for a specific date
 */
router.get('/:districtId/data/:date', async (req: Request, res: Response) => {
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

    // Get cached district data
    const data = await districtCacheManager.getDistrictData(districtId, date)

    if (!data) {
      res.status(404).json({
        error: {
          code: 'DATA_NOT_FOUND',
          message: 'No cached data found for the specified district and date',
          details: 'Consider initiating a backfill to fetch historical data',
        },
      })
      return
    }

    res.json(data)
  } catch (error) {
    const errorResponse = transformErrorResponse(error)

    res.status(500).json({
      error: {
        code: errorResponse.code || 'FETCH_ERROR',
        message: 'Failed to retrieve district data',
        details: errorResponse.details,
      },
    })
  }
})

/**
 * GET /api/districts/:districtId/cached-dates
 * List all available cached dates for a district
 */
router.get('/:districtId/cached-dates', async (req: Request, res: Response) => {
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

    // Get cached dates
    const dates =
      await districtCacheManager.getCachedDatesForDistrict(districtId)

    // Get date range if dates exist
    const dateRange =
      dates.length > 0
        ? await districtCacheManager.getDistrictDataRange(districtId)
        : null

    res.json({
      districtId,
      dates,
      count: dates.length,
      dateRange,
    })
  } catch (error) {
    const errorResponse = transformErrorResponse(error)

    res.status(500).json({
      error: {
        code: errorResponse.code || 'FETCH_ERROR',
        message: 'Failed to retrieve cached dates',
        details: errorResponse.details,
      },
    })
  }
})

/**
 * POST /api/districts/:districtId/backfill
 * Initiate backfill of historical data for a specific district
 */
router.post('/:districtId/backfill', async (req: Request, res: Response) => {
  try {
    const { districtId } = req.params
    const { startDate, endDate } = req.body

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

    // Validate date formats if provided
    if (startDate && !validateDateFormat(startDate)) {
      res.status(400).json({
        error: {
          code: 'INVALID_DATE_FORMAT',
          message: 'startDate must be in YYYY-MM-DD format',
        },
      })
      return
    }

    if (endDate && !validateDateFormat(endDate)) {
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

    // Initiate backfill
    const backfillId = await districtBackfillService.initiateDistrictBackfill({
      districtId,
      startDate,
      endDate,
    })

    const status = districtBackfillService.getBackfillStatus(backfillId)

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
})

/**
 * GET /api/districts/:districtId/backfill/:backfillId
 * Check backfill status for a specific district
 */
router.get(
  '/:districtId/backfill/:backfillId',
  async (req: Request, res: Response) => {
    try {
      const { districtId, backfillId } = req.params

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

      const status = districtBackfillService.getBackfillStatus(backfillId)

      if (!status) {
        res.status(404).json({
          error: {
            code: 'BACKFILL_NOT_FOUND',
            message: 'Backfill job not found',
          },
        })
        return
      }

      // Verify the backfill belongs to the requested district
      if (status.districtId !== districtId) {
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
router.delete(
  '/:districtId/backfill/:backfillId',
  async (req: Request, res: Response) => {
    try {
      const { districtId, backfillId } = req.params

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

      // Get status first to verify it belongs to this district
      const status = districtBackfillService.getBackfillStatus(backfillId)

      if (!status) {
        res.status(404).json({
          error: {
            code: 'BACKFILL_NOT_FOUND',
            message: 'Backfill job not found',
          },
        })
        return
      }

      // Verify the backfill belongs to the requested district
      if (status.districtId !== districtId) {
        res.status(404).json({
          error: {
            code: 'BACKFILL_NOT_FOUND',
            message: 'Backfill job not found for this district',
          },
        })
        return
      }

      const cancelled = await districtBackfillService.cancelBackfill(backfillId)

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

/**
 * GET /api/districts/:districtId/membership-analytics
 * Generate comprehensive membership analytics for a district
 * Query params: startDate (optional), endDate (optional)
 */
router.get(
  '/:districtId/membership-analytics',
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

      // Generate membership analytics
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
router.get(
  '/:districtId/analytics',
  cacheMiddleware({
    ttl: 300, // 5 minutes cache for analytics
    keyGenerator: req =>
      generateDistrictCacheKey(req.params.districtId, 'analytics', {
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

      // Generate comprehensive district analytics
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
 * GET /api/districts/:districtId/clubs/:clubId/trends
 * Get club-specific trend data
 * Requirements: 3.2
 */
router.get(
  '/:districtId/clubs/:clubId/trends',
  cacheMiddleware({
    ttl: 300, // 5 minutes cache
    keyGenerator: req =>
      generateDistrictCacheKey(
        req.params.districtId,
        `clubs/${req.params.clubId}/trends`
      ),
  }),
  async (req: Request, res: Response) => {
    try {
      const { districtId, clubId } = req.params

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
 * GET /api/districts/:districtId/at-risk-clubs
 * Get list of at-risk clubs for a district
 * Requirements: 4.4
 */
router.get(
  '/:districtId/at-risk-clubs',
  cacheMiddleware({
    ttl: 300, // 5 minutes cache
    keyGenerator: req =>
      generateDistrictCacheKey(req.params.districtId, 'at-risk-clubs'),
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

      // Identify at-risk clubs
      const atRiskClubs = await analyticsEngine.identifyAtRiskClubs(districtId)

      // Get critical clubs separately - only if we have at-risk clubs data
      let criticalClubsCount = 0
      let allClubs: ClubTrend[] = [...atRiskClubs]

      if (atRiskClubs.length > 0) {
        try {
          const analytics =
            await analyticsEngine.generateDistrictAnalytics(districtId)
          criticalClubsCount = analytics.criticalClubs.length
          allClubs = [...atRiskClubs, ...analytics.criticalClubs]
        } catch (error) {
          // If analytics fails, just use at-risk clubs
          logger.warn('Failed to get critical clubs, using at-risk only', {
            districtId,
            error,
          })
        }
      }

      // Set cache control headers
      res.set('Cache-Control', 'public, max-age=300') // 5 minutes

      res.json({
        districtId,
        totalAtRiskClubs: atRiskClubs.length,
        criticalClubs: criticalClubsCount,
        atRiskClubs: atRiskClubs.length,
        clubs: allClubs,
      })
    } catch (error) {
      const errorResponse = transformErrorResponse(error)

      // Check for specific error messages
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to identify at-risk clubs'

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
router.get(
  '/:districtId/leadership-insights',
  cacheMiddleware({
    ttl: 300, // 5 minutes cache
    keyGenerator: req =>
      generateDistrictCacheKey(req.params.districtId, 'leadership-insights', {
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

      // Generate leadership insights
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
router.get(
  '/:districtId/distinguished-club-analytics',
  cacheMiddleware({
    ttl: 300, // 5 minutes cache
    keyGenerator: req =>
      generateDistrictCacheKey(
        req.params.districtId,
        'distinguished-club-analytics',
        {
          startDate: req.query.startDate,
          endDate: req.query.endDate,
        }
      ),
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

      // Generate distinguished club analytics
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
router.get(
  '/:districtId/year-over-year/:date',
  cacheMiddleware({
    ttl: 300, // 5 minutes cache
    keyGenerator: req =>
      generateDistrictCacheKey(
        req.params.districtId,
        `year-over-year/${req.params.date}`
      ),
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

      // Calculate year-over-year comparison
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
router.get('/:districtId/export', async (req: Request, res: Response) => {
  try {
    const { districtId } = req.params
    const { format, startDate, endDate } = req.query

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

    // Generate analytics data for export
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
      error instanceof Error ? error.message : 'Failed to export district data'

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
})

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
  lines.push(`Healthy Clubs,${analytics.healthyClubs}`)
  lines.push(`At-Risk Clubs,${analytics.atRiskClubs.length}`)
  lines.push(`Critical Clubs,${analytics.criticalClubs}`)
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

  // At-risk clubs
  if (analytics.atRiskClubs && analytics.atRiskClubs.length > 0) {
    lines.push('At-Risk Clubs')
    lines.push(
      'Club ID,Club Name,Status,Current Membership,Current DCP Goals,Risk Factors'
    )
    analytics.atRiskClubs.forEach((club: ClubTrend) => {
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

export default router
