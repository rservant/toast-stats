/**
 * Core district routes module
 * Handles district listing, detail, clubs, and membership endpoints
 * Requirements: 2.5
 */

import { Router, type Request, type Response } from 'express'
import { cacheMiddleware } from '../../middleware/cache.js'
import { generateDistrictCacheKey } from '../../utils/cacheKeys.js'
import { logger } from '../../utils/logger.js'
import {
  transformDistrictsResponse,
  transformDistrictStatisticsResponse,
  transformMembershipHistoryResponse,
  transformClubsResponse,
  transformDailyReportsResponse,
  transformDailyReportDetailResponse,
  transformEducationalAwardsResponse,
  transformErrorResponse,
} from '../../utils/transformers.js'
import type {
  DistrictsResponse,
  DistrictStatistics,
  MembershipHistoryResponse,
  ClubsResponse,
  DailyReportsResponse,
  DailyReportDetailResponse,
} from '../../types/districts.js'
import type { Snapshot } from '../../types/snapshots.js'
import {
  validateDistrictId,
  getValidDistrictId,
  validateDateFormat,
  serveFromPerDistrictSnapshot,
  serveDistrictFromPerDistrictSnapshot,
  perDistrictSnapshotStore,
  buildSnapshotResponseMetadata,
  findNearestSnapshot,
  getProgramYearInfo,
} from './shared.js'

export const coreRouter = Router()

/**
 * GET /api/districts
 * Fetch available districts from latest snapshot
 */
coreRouter.get(
  '/',
  cacheMiddleware({
    ttl: 900, // 15 minutes
  }),
  async (req: Request, res: Response) => {
    const requestId = `districts_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    logger.info('Received request for districts list', {
      operation: 'GET /api/districts',
      request_id: requestId,
      user_agent: req.get('user-agent'),
      ip: req.ip,
    })

    const data = await serveFromPerDistrictSnapshot(
      res,
      async (snapshot, aggregator) => {
        logger.debug('Extracting districts list from per-district snapshot', {
          operation: 'GET /api/districts',
          request_id: requestId,
          snapshot_id: snapshot.snapshot_id,
        })

        // Get district summary from aggregator
        const districtSummaries = await aggregator.getDistrictSummary(
          snapshot.snapshot_id
        )

        // Transform to expected format (frontend expects 'id' not 'districtId')
        const districts = districtSummaries.map(summary => ({
          id: summary.districtId,
          name: summary.districtName,
          status: summary.status,
          lastUpdated: summary.lastUpdated,
        }))

        return transformDistrictsResponse({ districts }) as DistrictsResponse
      },
      'fetch districts from per-district snapshot'
    )

    if (data) {
      logger.info('Successfully served districts list', {
        operation: 'GET /api/districts',
        request_id: requestId,
        snapshot_id: (data as { _snapshot_metadata?: { snapshot_id?: string } })
          ._snapshot_metadata?.snapshot_id,
        district_count: Array.isArray(data.districts)
          ? data.districts.length
          : 0,
      })
      res.json(data)
    }
  }
)

/**
 * GET /api/districts/rankings
 * Fetch all districts with performance rankings from snapshot
 * Reads from all-districts-rankings.json file for comprehensive rankings
 *
 * Query parameters:
 * - date: Optional ISO date (YYYY-MM-DD) to fetch rankings for a specific historical snapshot
 *         If not provided, returns rankings from the latest successful snapshot
 * - fallback: Optional boolean (default: true) to enable/disable fallback to nearest snapshot
 *
 * Requirements:
 * - 3.2: Return nearest available snapshot when requested date has no data
 * - 3.3: Indicate when data is from prior month's final snapshot
 * - 4.4: Indicate the nearest available snapshot date
 */
coreRouter.get(
  '/rankings',
  cacheMiddleware({
    ttl: 900, // 15 minutes
  }),
  async (req: Request, res: Response) => {
    const requestId = `rankings_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const requestedDate = req.query['date'] as string | undefined
    const enableFallback = req.query['fallback'] !== 'false' // Default to true

    logger.info('Received request for district rankings', {
      operation: 'GET /api/districts/rankings',
      request_id: requestId,
      requested_date: requestedDate || 'latest',
      fallback_enabled: enableFallback,
      user_agent: req.get('user-agent'),
      ip: req.ip,
    })

    try {
      // Get snapshot - either for specific date or latest
      let snapshot: Snapshot | null
      let fallbackReason:
        | 'no_snapshot_for_date'
        | 'closing_period_gap'
        | 'future_date'
        | null = null

      if (requestedDate) {
        // Validate date format (YYYY-MM-DD)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
          logger.warn('Invalid date format in rankings request', {
            operation: 'GET /api/districts/rankings',
            request_id: requestId,
            requested_date: requestedDate,
          })

          res.status(400).json({
            error: {
              code: 'INVALID_DATE_FORMAT',
              message: 'Date must be in YYYY-MM-DD format',
              details: `Received: ${requestedDate}`,
            },
          })
          return
        }

        // Get snapshot for specific date (snapshot IDs are ISO dates)
        snapshot = await perDistrictSnapshotStore.getSnapshot(requestedDate)

        // If no snapshot found and fallback is enabled, find nearest (Requirement 3.2)
        if (!snapshot && enableFallback) {
          logger.info('No exact snapshot found, attempting fallback', {
            operation: 'GET /api/districts/rankings',
            request_id: requestId,
            requested_date: requestedDate,
          })

          const fallbackResult = await findNearestSnapshot(requestedDate)
          snapshot = fallbackResult.snapshot
          fallbackReason = fallbackResult.fallbackReason
        }

        if (!snapshot) {
          logger.warn('No snapshot found for requested date', {
            operation: 'GET /api/districts/rankings',
            request_id: requestId,
            requested_date: requestedDate,
            fallback_enabled: enableFallback,
          })

          res.status(404).json({
            error: {
              code: 'SNAPSHOT_NOT_FOUND',
              message: `No snapshot available for date ${requestedDate}`,
              details: enableFallback
                ? 'No snapshots available to fall back to'
                : 'The requested date does not have cached data. Enable fallback with ?fallback=true',
            },
          })
          return
        }
      } else {
        // Get latest successful snapshot
        snapshot = await perDistrictSnapshotStore.getLatestSuccessful()
      }

      if (!snapshot) {
        logger.warn('No successful snapshot available for rankings request', {
          operation: 'GET /api/districts/rankings',
          request_id: requestId,
        })

        res.status(503).json({
          error: {
            code: 'NO_SNAPSHOT_AVAILABLE',
            message: 'No data snapshot available yet',
            details: 'Run a refresh operation to create the first snapshot',
          },
        })
        return
      }

      logger.info('Retrieved snapshot for rankings request', {
        operation: 'GET /api/districts/rankings',
        request_id: requestId,
        requested_date: requestedDate || 'latest',
        snapshot_id: snapshot.snapshot_id,
      })

      // Read all-districts-rankings.json file
      const rankingsData =
        await perDistrictSnapshotStore.readAllDistrictsRankings(
          snapshot.snapshot_id
        )

      if (!rankingsData) {
        logger.error('All-districts-rankings file not found in snapshot', {
          operation: 'GET /api/districts/rankings',
          request_id: requestId,
          snapshot_id: snapshot.snapshot_id,
        })

        res.status(500).json({
          error: {
            code: 'RANKINGS_DATA_NOT_FOUND',
            message: 'Rankings data not found in snapshot',
            details:
              'The snapshot does not contain all-districts-rankings data',
          },
        })
        return
      }

      logger.info('Successfully read all-districts-rankings file', {
        operation: 'GET /api/districts/rankings',
        request_id: requestId,
        snapshot_id: snapshot.snapshot_id,
        total_districts: rankingsData.metadata.totalDistricts,
        from_cache: rankingsData.metadata.fromCache,
      })

      // Build base metadata including closing period fields and fallback info (Requirement 4.4)
      const baseMetadata = buildSnapshotResponseMetadata(
        snapshot,
        requestedDate,
        fallbackReason
      )

      // Return rankings with metadata (including closing period fields and rankings-specific fields)
      res.json({
        rankings: rankingsData.rankings,
        date: rankingsData.metadata.sourceCsvDate,
        _snapshot_metadata: {
          ...baseMetadata,
          data_source: 'all-districts-rankings-file',
          from_cache: rankingsData.metadata.fromCache,
          calculation_version: rankingsData.metadata.calculationVersion,
          ranking_version: rankingsData.metadata.rankingVersion,
        },
      })

      logger.info('Successfully served district rankings', {
        operation: 'GET /api/districts/rankings',
        request_id: requestId,
        requested_date: requestedDate || 'latest',
        snapshot_id: snapshot.snapshot_id,
        rankings_count: rankingsData.rankings.length,
        data_source: 'all-districts-rankings-file',
        fallback_used: !!fallbackReason,
        fallback_reason: fallbackReason,
      })
    } catch (error) {
      const errorResponse = transformErrorResponse(error)
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      logger.error('Failed to serve district rankings', {
        operation: 'GET /api/districts/rankings',
        request_id: requestId,
        error: errorMessage,
      })

      res.status(500).json({
        error: {
          code: errorResponse.code || 'RANKINGS_ERROR',
          message: 'Failed to fetch district rankings',
          details: errorResponse.details,
        },
      })
    }
  }
)

/**
 * GET /api/districts/:districtId/statistics
 * Fetch district statistics from latest snapshot
 */
coreRouter.get(
  '/:districtId/statistics',
  cacheMiddleware({
    ttl: 900, // 15 minutes
    keyGenerator: req => {
      const districtId = req.params['districtId']
      if (!districtId) throw new Error('Missing districtId parameter')
      return generateDistrictCacheKey(districtId, 'statistics')
    },
  }),
  async (req: Request, res: Response) => {
    const rawDistrictId = req.params['districtId']

    if (!rawDistrictId) {
      res.status(400).json({
        error: {
          code: 'MISSING_PARAMETER',
          message: 'districtId is required',
        },
      })
      return
    }

    if (!validateDistrictId(rawDistrictId)) {
      res.status(400).json({
        error: {
          code: 'INVALID_DISTRICT_ID',
          message: 'Invalid district ID format',
        },
      })
      return
    }

    const districtId = rawDistrictId
    const requestId = `district_stats_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    logger.info('Received request for district statistics', {
      operation: 'GET /api/districts/:districtId/statistics',
      request_id: requestId,
      district_id: districtId,
      user_agent: req.get('user-agent'),
      ip: req.ip,
    })

    const data = await serveDistrictFromPerDistrictSnapshot(
      res,
      districtId,
      district => {
        logger.debug(
          'Extracting district statistics from per-district snapshot',
          {
            operation: 'GET /api/districts/:districtId/statistics',
            request_id: requestId,
            district_id: districtId,
          }
        )

        return transformDistrictStatisticsResponse(
          district
        ) as DistrictStatistics
      },
      'fetch district statistics from per-district snapshot'
    )

    if (data) {
      logger.info('Successfully served district statistics', {
        operation: 'GET /api/districts/:districtId/statistics',
        request_id: requestId,
        district_id: districtId,
        snapshot_id: (data as { _snapshot_metadata?: { snapshot_id?: string } })
          ._snapshot_metadata?.snapshot_id,
      })
      res.json(data)
    }
  }
)

/**
 * GET /api/districts/:districtId/membership-history
 * Fetch membership history from latest snapshot
 */
coreRouter.get(
  '/:districtId/membership-history',
  cacheMiddleware({
    ttl: 900, // 15 minutes
    keyGenerator: req => {
      const districtId = req.params['districtId']
      if (!districtId) throw new Error('Missing districtId parameter')
      return generateDistrictCacheKey(districtId, 'membership-history', {
        months: req.query['months'],
      })
    },
  }),
  async (req: Request, res: Response) => {
    const districtId = getValidDistrictId(req)
    const months = req.query['months']

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

    const data = await serveDistrictFromPerDistrictSnapshot(
      res,
      districtId,
      district => {
        // Extract membership history from district data
        // Note: The months parameter is currently ignored since we serve from snapshot
        // The snapshot contains the most recent data available
        const membershipHistory =
          (district as DistrictStatistics & { membershipHistory?: unknown[] })
            .membershipHistory || []
        return transformMembershipHistoryResponse({
          membershipHistory,
        }) as MembershipHistoryResponse
      },
      'fetch membership history from per-district snapshot'
    )

    if (data) {
      res.json(data)
    }
  }
)

/**
 * GET /api/districts/:districtId/clubs
 * Fetch clubs for a district from latest snapshot
 */
coreRouter.get(
  '/:districtId/clubs',
  cacheMiddleware({
    ttl: 900, // 15 minutes
    keyGenerator: req => {
      const districtId = req.params['districtId']
      if (!districtId) throw new Error('Missing districtId parameter')
      return generateDistrictCacheKey(districtId, 'clubs')
    },
  }),
  async (req: Request, res: Response) => {
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

    const data = await serveDistrictFromPerDistrictSnapshot(
      res,
      districtId,
      district =>
        transformClubsResponse({
          clubs: district.clubs || [],
        }) as ClubsResponse,
      'fetch clubs from per-district snapshot'
    )

    if (data) {
      res.json(data)
    }
  }
)

/**
 * GET /api/districts/:districtId/educational-awards
 * Fetch educational awards history from latest snapshot
 */
coreRouter.get(
  '/:districtId/educational-awards',
  cacheMiddleware({
    ttl: 900, // 15 minutes
    keyGenerator: req => {
      const districtId = req.params['districtId']
      if (!districtId) throw new Error('Missing districtId parameter')
      return generateDistrictCacheKey(districtId, 'educational-awards', {
        months: req.query['months'],
      })
    },
  }),
  async (req: Request, res: Response) => {
    const districtId = getValidDistrictId(req)
    const months = req.query['months']

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

    const data = await serveDistrictFromPerDistrictSnapshot(
      res,
      districtId,
      district => {
        // Extract educational awards from district data
        // Note: The months parameter is currently ignored since we serve from snapshot
        const educationalAwards =
          (district as DistrictStatistics & { educationalAwards?: unknown[] })
            .educationalAwards || []
        return transformEducationalAwardsResponse({ educationalAwards })
      },
      'fetch educational awards from snapshot'
    )

    if (data) {
      res.json(data)
    }
  }
)

/**
 * GET /api/districts/:districtId/daily-reports
 * Fetch daily reports for a date range from latest snapshot
 * Note: Date range parameters are currently ignored as we serve from snapshot
 */
coreRouter.get(
  '/:districtId/daily-reports',
  cacheMiddleware({
    ttl: 900, // 15 minutes
    keyGenerator: req => {
      const districtId = req.params['districtId']
      if (!districtId) throw new Error('Missing districtId parameter')
      return generateDistrictCacheKey(districtId, 'daily-reports', {
        startDate: req.query['startDate'],
        endDate: req.query['endDate'],
      })
    },
  }),
  async (req: Request, res: Response) => {
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

    // Validate date parameters (for backward compatibility)
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

    if (!validateDateFormat(startDate!) || !validateDateFormat(endDate!)) {
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

    const data = await serveDistrictFromPerDistrictSnapshot(
      res,
      districtId,
      district => {
        // Extract daily reports from district data
        // Note: Date range filtering is not applied since we serve from snapshot
        const dailyReports =
          (district as DistrictStatistics & { dailyReports?: unknown[] })
            .dailyReports || []
        return transformDailyReportsResponse({
          dailyReports,
        }) as DailyReportsResponse
      },
      'fetch daily reports from snapshot'
    )

    if (data) {
      res.json(data)
    }
  }
)

/**
 * GET /api/districts/:districtId/daily-reports/:date
 * Fetch detailed daily report for a specific date from latest snapshot
 * Note: Specific date parameter is currently ignored as we serve from snapshot
 */
coreRouter.get(
  '/:districtId/daily-reports/:date',
  cacheMiddleware({
    ttl: 900, // 15 minutes
    keyGenerator: req => {
      const districtId = req.params['districtId']
      const date = req.params['date']
      if (!districtId || !date)
        throw new Error('Missing districtId or date parameter')
      return generateDistrictCacheKey(districtId, `daily-reports/${date}`)
    },
  }),
  async (req: Request, res: Response) => {
    const districtId = getValidDistrictId(req)
    const date = req.params['date']

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

    const data = await serveDistrictFromPerDistrictSnapshot(
      res,
      districtId,
      district => {
        // Extract daily report detail from district data
        // Note: Specific date filtering is not applied since we serve from snapshot
        // We return the most recent daily report data available
        const districtAny = district as DistrictStatistics & {
          dailyReportDetail?: unknown
          dailyReports?: unknown[]
        }
        const dailyReportDetail =
          districtAny.dailyReportDetail || districtAny.dailyReports?.[0] || {}
        return transformDailyReportDetailResponse(
          dailyReportDetail
        ) as DailyReportDetailResponse
      },
      'fetch daily report detail from snapshot'
    )

    if (data) {
      res.json(data)
    }
  }
)

/**
 * GET /api/districts/:districtId/rank-history
 * Fetch historical rank data for a district from all-districts-rankings.json
 * Query params: startDate (optional), endDate (optional) - currently ignored
 *
 * Returns RankHistoryResponse format expected by frontend:
 * - districtId: string
 * - districtName: string
 * - history: HistoricalRankPoint[] (date, aggregateScore, clubsRank, paymentsRank, distinguishedRank)
 * - programYear: ProgramYearInfo (startDate, endDate, year)
 */
coreRouter.get(
  '/:districtId/rank-history',
  async (req: Request, res: Response) => {
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

    const operationId = `rank_history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    try {
      // Get the latest successful snapshot
      const snapshot = await perDistrictSnapshotStore.getLatestSuccessful()

      if (!snapshot) {
        // No snapshot available - return empty response with default program year
        logger.warn('No snapshot available for rank history request', {
          operation: 'GET /api/districts/:districtId/rank-history',
          operation_id: operationId,
          district_id: districtId,
        })

        const now = new Date().toISOString().split('T')[0]
        res.json({
          districtId,
          districtName: `District ${districtId}`,
          history: [],
          programYear: getProgramYearInfo(now ?? '2025-01-01'),
        })
        return
      }

      // Read all-districts rankings from the snapshot
      const allDistrictsRankings =
        await perDistrictSnapshotStore.readAllDistrictsRankings(
          snapshot.snapshot_id
        )

      if (!allDistrictsRankings) {
        // Rankings file not available - return empty history
        logger.info(
          'All-districts rankings not found in snapshot, returning empty rank history',
          {
            operation: 'GET /api/districts/:districtId/rank-history',
            operation_id: operationId,
            district_id: districtId,
            snapshot_id: snapshot.snapshot_id,
          }
        )

        const dataDate = snapshot.payload.metadata.dataAsOfDate
        res.json({
          districtId,
          districtName: `District ${districtId}`,
          history: [],
          programYear: getProgramYearInfo(dataDate),
        })
        return
      }

      // Find the specific district in the rankings array
      const districtRanking = allDistrictsRankings.rankings.find(
        r => r.districtId === districtId
      )

      if (!districtRanking) {
        // District not in rankings - return empty history
        logger.info(
          'District not found in all-districts rankings, returning empty rank history',
          {
            operation: 'GET /api/districts/:districtId/rank-history',
            operation_id: operationId,
            district_id: districtId,
            snapshot_id: snapshot.snapshot_id,
            total_districts_in_rankings: allDistrictsRankings.rankings.length,
          }
        )

        const dataDate = allDistrictsRankings.metadata.sourceCsvDate
        res.json({
          districtId,
          districtName: `District ${districtId}`,
          history: [],
          programYear: getProgramYearInfo(dataDate),
        })
        return
      }

      // Build history entry from the district ranking data
      // Currently returns a single entry from the latest snapshot
      // Future: aggregate across multiple historical snapshots
      const historyEntry = {
        date: allDistrictsRankings.metadata.sourceCsvDate,
        aggregateScore: districtRanking.aggregateScore,
        clubsRank: districtRanking.clubsRank,
        paymentsRank: districtRanking.paymentsRank,
        distinguishedRank: districtRanking.distinguishedRank,
      }

      logger.info(
        'Successfully served rank history from all-districts rankings',
        {
          operation: 'GET /api/districts/:districtId/rank-history',
          operation_id: operationId,
          district_id: districtId,
          snapshot_id: snapshot.snapshot_id,
          district_name: districtRanking.districtName,
          aggregate_score: districtRanking.aggregateScore,
        }
      )

      // Return response in RankHistoryResponse format expected by frontend
      res.json({
        districtId: districtRanking.districtId,
        districtName: districtRanking.districtName,
        history: [historyEntry],
        programYear: getProgramYearInfo(
          allDistrictsRankings.metadata.sourceCsvDate
        ),
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to fetch rank history', {
        operation: 'GET /api/districts/:districtId/rank-history',
        operation_id: operationId,
        district_id: districtId,
        error: errorMessage,
      })

      res.status(500).json({
        error: {
          code: 'RANK_HISTORY_ERROR',
          message: 'Failed to fetch rank history',
          details: errorMessage,
        },
      })
    }
  }
)
