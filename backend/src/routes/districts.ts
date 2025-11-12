import { Router, type Request, type Response } from 'express'
import { cacheMiddleware } from '../middleware/cache.js'
import { authenticateToken } from '../middleware/auth.js'
import { generateDistrictCacheKey } from '../utils/cacheKeys.js'
import { ToastmastersAPIService } from '../services/ToastmastersAPIService.js'
import {
  transformDistrictsResponse,
  transformDistrictStatisticsResponse,
  transformMembershipHistoryResponse,
  transformClubsResponse,
  transformErrorResponse,
} from '../utils/transformers.js'
import type {
  DistrictsResponse,
  DistrictStatistics,
  MembershipHistoryResponse,
  ClubsResponse,
} from '../types/districts.js'

const router = Router()
const toastmastersAPI = new ToastmastersAPIService()

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
  authenticateToken,
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
 * GET /api/districts/:districtId/statistics
 * Fetch district statistics with caching
 */
router.get(
  '/:districtId/statistics',
  authenticateToken,
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
  authenticateToken,
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
  authenticateToken,
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

export default router
