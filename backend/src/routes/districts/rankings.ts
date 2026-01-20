/**
 * Rankings routes module
 * Handles global rankings and available program years endpoints
 * Requirements: Global Rankings Tab feature
 */

import { Router, type Request, type Response } from 'express'
import { cacheMiddleware } from '../../middleware/cache.js'
import { generateDistrictCacheKey } from '../../utils/cacheKeys.js'
import { logger } from '../../utils/logger.js'
import { transformErrorResponse } from '../../utils/transformers.js'
import { getValidDistrictId, perDistrictSnapshotStore } from './shared.js'
import {
  AvailableProgramYearsService,
  type IAvailableProgramYearsService,
} from '../../services/AvailableProgramYearsService.js'
import type { AvailableRankingYearsResponse } from '../../types/districts.js'

export const rankingsRouter = Router()

// Initialize the service with the snapshot store
// This can be overridden for testing via dependency injection
let availableProgramYearsService: IAvailableProgramYearsService =
  new AvailableProgramYearsService(perDistrictSnapshotStore)

/**
 * Set the AvailableProgramYearsService instance (for testing/dependency injection)
 */
export function setAvailableProgramYearsService(
  service: IAvailableProgramYearsService
): void {
  availableProgramYearsService = service
}

/**
 * Get the current AvailableProgramYearsService instance
 */
export function getAvailableProgramYearsService(): IAvailableProgramYearsService {
  return availableProgramYearsService
}

/**
 * GET /api/districts/:districtId/available-ranking-years
 * Fetch all program years with ranking data available for a district
 *
 * Returns a list of program years that have ranking snapshots containing
 * data for the specified district. This endpoint is used by the Global Rankings
 * tab to populate the program year selector.
 *
 * Requirements:
 * - 2.1: Display program year selector showing all available program years with ranking data
 * - 2.3: Default to current or most recent program year with available data
 */
rankingsRouter.get(
  '/:districtId/available-ranking-years',
  cacheMiddleware({
    ttl: 900, // 15 minutes - program years don't change frequently
    keyGenerator: req => {
      const rawDistrictId = req.params['districtId']
      const districtId = Array.isArray(rawDistrictId)
        ? (rawDistrictId[0] ?? 'unknown')
        : (rawDistrictId ?? 'unknown')
      return generateDistrictCacheKey(districtId, 'available-ranking-years')
    },
  }),
  async (req: Request, res: Response) => {
    const districtId = getValidDistrictId(req)
    const requestId = `available_years_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`

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

    logger.info('Received request for available ranking years', {
      operation: 'GET /api/districts/:districtId/available-ranking-years',
      request_id: requestId,
      district_id: districtId,
      user_agent: req.get('user-agent'),
      ip: req.ip,
    })

    try {
      // Use the service to get available program years
      const result =
        await availableProgramYearsService.getAvailableProgramYears(districtId)

      const response: AvailableRankingYearsResponse = {
        districtId: result.districtId,
        programYears: result.programYears,
      }

      logger.info('Successfully served available ranking years', {
        operation: 'GET /api/districts/:districtId/available-ranking-years',
        request_id: requestId,
        district_id: districtId,
        program_years_count: response.programYears.length,
        program_years: response.programYears.map(py => py.year),
      })

      res.json(response)
    } catch (error) {
      const errorResponse = transformErrorResponse(error)
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      logger.error('Failed to fetch available ranking years', {
        operation: 'GET /api/districts/:districtId/available-ranking-years',
        request_id: requestId,
        district_id: districtId,
        error: errorMessage,
      })

      res.status(500).json({
        error: {
          code: errorResponse.code || 'RANKINGS_ERROR',
          message: 'Failed to fetch available ranking years',
          details: errorResponse.details,
        },
      })
    }
  }
)
