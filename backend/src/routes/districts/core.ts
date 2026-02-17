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
  serveDistrictFromPerDistrictSnapshotByDate,
  perDistrictSnapshotStore,
  buildSnapshotResponseMetadata,
  findNearestSnapshot,
  getProgramYearInfo,
  extractStringParam,
  extractQueryParam,
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

        return { districts } as DistrictsResponse
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
    const requestedDate = extractQueryParam(req.query['date'])
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
 * Fetch district statistics from snapshot
 *
 * Query parameters:
 * - date: Optional ISO date (YYYY-MM-DD) to fetch statistics for a specific historical snapshot
 *         If not provided, returns statistics from the latest successful snapshot
 *
 * Requirements:
 * - 4.3: Accept optional date query parameter
 * - Property 4: Validate date format and return 400 for invalid dates
 */
coreRouter.get(
  '/:districtId/statistics',
  cacheMiddleware({
    ttl: 900, // 15 minutes
    keyGenerator: req => {
      const districtId = extractStringParam(
        req.params['districtId'],
        'districtId'
      )
      const date = extractQueryParam(req.query['date'])
      // Include date in cache key for proper cache invalidation (Requirement 6.1)
      return generateDistrictCacheKey(
        districtId,
        'statistics',
        date ? { date } : undefined
      )
    },
  }),
  async (req: Request, res: Response) => {
    const rawDistrictId = req.params['districtId']
    const requestedDate = extractQueryParam(req.query['date'])

    // Handle string | string[] type from Express
    const districtIdStr = Array.isArray(rawDistrictId)
      ? rawDistrictId[0]
      : rawDistrictId

    if (!districtIdStr) {
      res.status(400).json({
        error: {
          code: 'MISSING_PARAMETER',
          message: 'districtId is required',
        },
      })
      return
    }

    if (!validateDistrictId(districtIdStr)) {
      res.status(400).json({
        error: {
          code: 'INVALID_DISTRICT_ID',
          message: 'Invalid district ID format',
        },
      })
      return
    }

    // Validate date format if provided (Property 4: Date format validation)
    if (requestedDate !== undefined) {
      if (!validateDateFormat(requestedDate)) {
        res.status(400).json({
          error: {
            code: 'INVALID_DATE_FORMAT',
            message: 'Date must be in YYYY-MM-DD format',
            details: `Received: ${requestedDate}`,
          },
        })
        return
      }
    }

    const districtId = districtIdStr
    const requestId = `district_stats_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    logger.info('Received request for district statistics', {
      operation: 'GET /api/districts/:districtId/statistics',
      request_id: requestId,
      district_id: districtId,
      requested_date: requestedDate || 'latest',
      user_agent: req.get('user-agent'),
      ip: req.ip,
    })

    // Use date-aware snapshot selection (Task 1.3)
    // - When requestedDate is provided: get snapshot for that date with fallback to nearest
    // - When requestedDate is undefined: get latest snapshot (backward compatible - Property 3)
    const data = await serveDistrictFromPerDistrictSnapshotByDate(
      res,
      districtId,
      requestedDate,
      district => {
        logger.debug(
          'Extracting district statistics from per-district snapshot',
          {
            operation: 'GET /api/districts/:districtId/statistics',
            request_id: requestId,
            district_id: districtId,
            requested_date: requestedDate || 'latest',
          }
        )

        return district as DistrictStatistics
      },
      'fetch district statistics from per-district snapshot'
    )

    if (data) {
      logger.info('Successfully served district statistics', {
        operation: 'GET /api/districts/:districtId/statistics',
        request_id: requestId,
        district_id: districtId,
        requested_date: requestedDate || 'latest',
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
      const districtId = extractStringParam(
        req.params['districtId'],
        'districtId'
      )
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
        return {
          data: membershipHistory as MembershipHistoryResponse['data'],
        } satisfies MembershipHistoryResponse
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
      const districtId = extractStringParam(
        req.params['districtId'],
        'districtId'
      )
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
        ({
          clubs: (district.clubs || []) as unknown as ClubsResponse['clubs'],
        }) satisfies Record<string, unknown> as ClubsResponse,
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
      const districtId = extractStringParam(
        req.params['districtId'],
        'districtId'
      )
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
      const districtId = extractStringParam(
        req.params['districtId'],
        'districtId'
      )
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
        return {
          reports: dailyReports as DailyReportsResponse['reports'],
        } satisfies DailyReportsResponse
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
      const districtId = extractStringParam(
        req.params['districtId'],
        'districtId'
      )
      const date = extractStringParam(req.params['date'], 'date')
      return generateDistrictCacheKey(districtId, `daily-reports/${date}`)
    },
  }),
  async (req: Request, res: Response) => {
    const districtId = getValidDistrictId(req)
    const date = extractQueryParam(req.params['date'])

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
        return dailyReportDetail as DailyReportDetailResponse
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
 * Fetch historical rank data for a district from all-districts-rankings.json across all snapshots
 * Query params: startDate (optional), endDate (optional) - filter snapshots by date range
 *
 * Returns RankHistoryResponse format expected by frontend:
 * - districtId: string
 * - districtName: string
 * - history: HistoricalRankPoint[] (date, aggregateScore, clubsRank, paymentsRank, distinguishedRank, overallRank)
 * - programYear: ProgramYearInfo (startDate, endDate, year)
 *
 * Requirements:
 * - 17.3: Route SHALL NOT compute overallRank by sorting rankings
 * - 17.4: overallRank SHALL be pre-computed and stored in rankings files
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
      // Get optional date range from query params
      const startDateParam =
        typeof req.query['startDate'] === 'string'
          ? req.query['startDate']
          : undefined
      const endDateParam =
        typeof req.query['endDate'] === 'string'
          ? req.query['endDate']
          : undefined

      // Determine program year boundaries (July 1 to June 30)
      // Use provided startDate to determine program year, or fall back to current date
      const referenceDate =
        startDateParam ?? new Date().toISOString().split('T')[0] ?? '2025-01-01'
      const programYear = getProgramYearInfo(referenceDate)

      // If explicit date range provided, use those instead of computed program year boundaries
      const effectiveStartDate = startDateParam ?? programYear.startDate
      const effectiveEndDate = endDateParam ?? programYear.endDate

      logger.info('Rank history request parameters', {
        operation: 'GET /api/districts/:districtId/rank-history',
        operation_id: operationId,
        district_id: districtId,
        startDateParam,
        endDateParam,
        effectiveStartDate,
        effectiveEndDate,
        programYear: programYear.year,
      })

      // Get all successful snapshots
      const allSnapshots = await perDistrictSnapshotStore.listSnapshots(
        undefined,
        { status: 'success' }
      )

      if (allSnapshots.length === 0) {
        // No snapshots available - return empty response with default program year
        logger.warn('No snapshots available for rank history request', {
          operation: 'GET /api/districts/:districtId/rank-history',
          operation_id: operationId,
          district_id: districtId,
        })

        res.json({
          districtId,
          districtName: `District ${districtId}`,
          history: [],
          programYear,
        })
        return
      }

      // Build history by reading rankings from each snapshot
      interface HistoryEntry {
        date: string
        aggregateScore: number
        clubsRank: number
        paymentsRank: number
        distinguishedRank: number
        totalDistricts: number
        overallRank: number // Position when sorted by aggregateScore (1 = best)
      }
      const history: HistoryEntry[] = []
      let districtName = `District ${districtId}`
      const seenDates = new Set<string>()

      // Process snapshots (already sorted newest first by listSnapshots)
      for (const snapshotMeta of allSnapshots) {
        try {
          const rankings =
            await perDistrictSnapshotStore.readAllDistrictsRankings(
              snapshotMeta.snapshot_id
            )

          if (!rankings) {
            continue
          }

          // Use the source CSV date as the history date
          const date = rankings.metadata.sourceCsvDate

          // Filter to effective date range (from query params or program year)
          if (date < effectiveStartDate || date > effectiveEndDate) {
            continue
          }

          // Skip duplicate dates (keep the first/newest one)
          if (seenDates.has(date)) {
            continue
          }
          seenDates.add(date)

          const districtRanking = rankings.rankings.find(
            r => r.districtId === districtId
          )

          if (!districtRanking) {
            continue
          }

          // Capture district name from the first found entry
          if (districtName === `District ${districtId}`) {
            districtName = districtRanking.districtName
          }

          // Read pre-computed overallRank from rankings data
          // Requirement 17.3: Route SHALL NOT compute overallRank by sorting rankings
          // Requirement 17.4: overallRank SHALL be pre-computed and stored in rankings files
          const overallRank = districtRanking.overallRank ?? 0

          history.push({
            date,
            aggregateScore: districtRanking.aggregateScore,
            clubsRank: districtRanking.clubsRank,
            paymentsRank: districtRanking.paymentsRank,
            distinguishedRank: districtRanking.distinguishedRank,
            totalDistricts: rankings.metadata.totalDistricts,
            overallRank,
          })
        } catch (error) {
          // Log but continue processing other snapshots
          logger.warn('Failed to read rankings from snapshot', {
            operation: 'GET /api/districts/:districtId/rank-history',
            operation_id: operationId,
            snapshot_id: snapshotMeta.snapshot_id,
            error: error instanceof Error ? error.message : 'Unknown error',
          })
        }
      }

      // Sort history chronologically (oldest first for chart display)
      history.sort((a, b) => a.date.localeCompare(b.date))

      if (history.length === 0) {
        // District not found in any snapshot within program year
        logger.info(
          'District not found in any snapshot rankings for current program year, returning empty rank history',
          {
            operation: 'GET /api/districts/:districtId/rank-history',
            operation_id: operationId,
            district_id: districtId,
            snapshots_checked: allSnapshots.length,
            program_year: programYear.year,
          }
        )

        res.json({
          districtId,
          districtName,
          history: [],
          programYear,
        })
        return
      }

      logger.info('Successfully served rank history from multiple snapshots', {
        operation: 'GET /api/districts/:districtId/rank-history',
        operation_id: operationId,
        district_id: districtId,
        district_name: districtName,
        history_points: history.length,
        snapshots_checked: allSnapshots.length,
        program_year: programYear.year,
        date_range:
          history.length > 0
            ? `${history[0]?.date} to ${history[history.length - 1]?.date}`
            : 'none',
      })

      // Return response in RankHistoryResponse format expected by frontend
      res.json({
        districtId,
        districtName,
        history,
        programYear,
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
