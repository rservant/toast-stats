import { Router, type Request, type Response } from 'express'
import { cacheMiddleware } from '../middleware/cache.js'
import { generateDistrictCacheKey } from '../utils/cacheKeys.js'
import { logger } from '../utils/logger.js'
import { RealToastmastersAPIService } from '../services/RealToastmastersAPIService.js'
import { MockToastmastersAPIService } from '../services/MockToastmastersAPIService.js'
import { BackfillService } from '../services/UnifiedBackfillService.js'
import { CacheManager } from '../services/CacheManager.js'
import { DistrictCacheManager } from '../services/DistrictCacheManager.js'
import { RefreshService } from '../services/RefreshService.js'
import { DistrictConfigurationService } from '../services/DistrictConfigurationService.js'
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
  DistrictDataAggregator,
  createDistrictDataAggregator,
} from '../services/DistrictDataAggregator.js'
import { PerDistrictFileSnapshotStore } from '../services/PerDistrictSnapshotStore.js'
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
import type { BackfillRequest } from '../services/UnifiedBackfillService.js'
import type { Snapshot } from '../types/snapshots.js'

const router = Router()

// Use mock API in development (USE_MOCK_DATA=true), real scraper otherwise
// Force mock data in test environment
const useMockData =
  process.env['USE_MOCK_DATA'] === 'true' || process.env['NODE_ENV'] === 'test'

// Initialize cache configuration service and get cache directory
const productionFactory = getProductionServiceFactory()
const cacheConfig = productionFactory.createCacheConfigService()

const toastmastersAPI = useMockData
  ? new MockToastmastersAPIService()
  : (() => {
      const rawCSVCacheService = productionFactory.createRawCSVCacheService()
      const scraper = new ToastmastersScraper(rawCSVCacheService)
      return new RealToastmastersAPIService(scraper)
    })()
const cacheDirectory = cacheConfig.getCacheDirectory()

// Initialize snapshot store for serving data from snapshots
const snapshotStore = productionFactory.createSnapshotStore(cacheConfig)

// Initialize per-district snapshot store and aggregator for new format
const perDistrictSnapshotStore = new PerDistrictFileSnapshotStore({
  cacheDir: cacheDirectory,
  maxSnapshots: 100,
  maxAgeDays: 30,
})
const districtDataAggregator = createDistrictDataAggregator(
  perDistrictSnapshotStore
)

// Initialize services with configured cache directory
const cacheManager = new CacheManager(cacheDirectory)
const districtCacheManager = new DistrictCacheManager(cacheDirectory)

// Initialize services using the production service factory
const serviceFactory = getProductionServiceFactory()
const rawCSVCacheService = serviceFactory.createRawCSVCacheService()
const scraper = new ToastmastersScraper(rawCSVCacheService)
const districtConfigService = new DistrictConfigurationService(cacheDirectory)

// Initialize unified backfill service (replaces both BackfillService and DistrictBackfillService)
// Create ranking calculator
const { BordaCountRankingCalculator } =
  await import('../services/RankingCalculator.js')
const rankingCalculator = new BordaCountRankingCalculator()

const refreshService = new RefreshService(
  snapshotStore,
  scraper,
  rawCSVCacheService,
  undefined, // validator - use default
  districtConfigService,
  rankingCalculator
)
const backfillService = new BackfillService(
  refreshService,
  perDistrictSnapshotStore,
  districtConfigService,
  undefined, // alertManager
  undefined, // circuitBreakerManager
  rankingCalculator
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

/**
 * Validate district ID format
 */
function validateDistrictId(districtId: string): boolean {
  // District IDs are typically numeric or alphanumeric
  // Adjust this validation based on actual Toastmasters district ID format
  return /^[A-Za-z0-9]+$/.test(districtId) && districtId.length > 0
}

/**
 * Helper function to validate and extract district ID from request params
 */
function getValidDistrictId(req: Request): string | null {
  const districtId = req.params['districtId']
  if (!districtId || !validateDistrictId(districtId!)) {
    return null
  }
  return districtId
}

/**
 * Interface for fallback metadata in API responses
 * Indicates when a different snapshot was returned than requested
 * Requirement 4.4
 */
interface FallbackMetadata {
  /** The date that was originally requested */
  requested_date: string
  /** The actual snapshot date returned */
  actual_snapshot_date: string
  /** Reason for the fallback */
  fallback_reason: 'no_snapshot_for_date' | 'closing_period_gap' | 'future_date'
  /** Whether this is closing period data */
  is_closing_period_data?: boolean
}

/**
 * Interface for snapshot metadata in API responses
 * Includes closing period fields per Requirements 4.1, 4.2, 4.3
 * Includes fallback fields per Requirement 4.4
 */
interface SnapshotResponseMetadata {
  snapshot_id: string
  created_at: string
  schema_version: string
  calculation_version: string
  data_as_of: string
  // Closing period fields (Requirements 4.1, 4.2, 4.3)
  is_closing_period_data?: boolean
  collection_date?: string
  logical_date?: string
  // Fallback fields (Requirement 4.4)
  fallback?: FallbackMetadata
}

/**
 * Build snapshot metadata for API responses, including closing period fields
 * when applicable.
 *
 * Requirements:
 * - 4.1: Include collection_date showing actual CSV date
 * - 4.2: Include is_closing_period_data when snapshot date differs from collection date
 * - 4.3: Include logical_date showing the date the snapshot represents
 * - 4.4: Include fallback metadata when a different snapshot was returned than requested
 */
function buildSnapshotResponseMetadata(
  snapshot: Snapshot,
  requestedDate?: string,
  fallbackReason?:
    | 'no_snapshot_for_date'
    | 'closing_period_gap'
    | 'future_date'
    | null
): SnapshotResponseMetadata {
  const metadata = snapshot.payload.metadata

  const responseMetadata: SnapshotResponseMetadata = {
    snapshot_id: snapshot.snapshot_id,
    created_at: snapshot.created_at,
    schema_version: snapshot.schema_version,
    calculation_version: snapshot.calculation_version,
    data_as_of: metadata.dataAsOfDate,
  }

  // Add closing period fields when present in snapshot metadata
  // (Requirements 4.1, 4.2, 4.3)
  if (metadata.isClosingPeriodData !== undefined) {
    responseMetadata.is_closing_period_data = metadata.isClosingPeriodData
  }

  if (metadata.collectionDate !== undefined) {
    responseMetadata.collection_date = metadata.collectionDate
  }

  if (metadata.logicalDate !== undefined) {
    responseMetadata.logical_date = metadata.logicalDate
  }

  // Add fallback information when a different snapshot was returned (Requirement 4.4)
  if (
    requestedDate &&
    fallbackReason &&
    requestedDate !== snapshot.snapshot_id
  ) {
    responseMetadata.fallback = {
      requested_date: requestedDate,
      actual_snapshot_date: snapshot.snapshot_id,
      fallback_reason: fallbackReason,
      is_closing_period_data: metadata.isClosingPeriodData,
    }
  }

  return responseMetadata
}

/**
 * Result of finding the nearest snapshot
 */
interface FindNearestSnapshotResult {
  snapshot: Snapshot | null
  fallbackReason:
    | 'no_snapshot_for_date'
    | 'closing_period_gap'
    | 'future_date'
    | null
}

/**
 * Find the nearest available snapshot to the requested date
 * Returns the closest snapshot before or after the requested date
 *
 * Requirements:
 * - 3.2: When requesting data for early new-month dates during closing, return most recent available
 * - 3.3: Clearly indicate when data is from prior month's final snapshot
 * - 4.4: Indicate the nearest available snapshot date
 */
async function findNearestSnapshot(
  requestedDate: string
): Promise<FindNearestSnapshotResult> {
  const availableSnapshots = await perDistrictSnapshotStore.listSnapshots()

  if (availableSnapshots.length === 0) {
    return { snapshot: null, fallbackReason: null }
  }

  // Filter to only successful snapshots and sort by date (newest first)
  const sortedSnapshots = availableSnapshots
    .filter(s => s.status === 'success')
    .sort((a, b) => b.snapshot_id.localeCompare(a.snapshot_id))

  if (sortedSnapshots.length === 0) {
    return { snapshot: null, fallbackReason: null }
  }

  const requestedDateObj = new Date(requestedDate)
  const today = new Date()

  // Check if requested date is in the future
  if (requestedDateObj > today) {
    // Return latest available snapshot
    const latestId = sortedSnapshots[0]?.snapshot_id
    if (latestId) {
      const snapshot = await perDistrictSnapshotStore.getSnapshot(latestId)
      return { snapshot, fallbackReason: 'future_date' }
    }
    return { snapshot: null, fallbackReason: null }
  }

  // Find the nearest snapshot (prefer earlier dates, then later)
  let nearestBefore: string | null = null
  let nearestAfter: string | null = null

  for (const s of sortedSnapshots) {
    const snapshotDate = new Date(s.snapshot_id)
    if (snapshotDate <= requestedDateObj && !nearestBefore) {
      nearestBefore = s.snapshot_id
    }
    if (snapshotDate > requestedDateObj) {
      nearestAfter = s.snapshot_id
    }
  }

  // Prefer the nearest snapshot before the requested date
  const nearestId = nearestBefore ?? nearestAfter
  if (nearestId) {
    const snapshot = await perDistrictSnapshotStore.getSnapshot(nearestId)

    if (!snapshot) {
      return { snapshot: null, fallbackReason: null }
    }

    // Determine fallback reason
    let fallbackReason: 'no_snapshot_for_date' | 'closing_period_gap' =
      'no_snapshot_for_date'

    // Check if this is a closing period gap (Requirement 3.3)
    // A closing period gap occurs when:
    // 1. The requested date is in a new month (e.g., Jan 1-5)
    // 2. The nearest snapshot is from the prior month's end (closing period data)
    if (snapshot.payload.metadata.isClosingPeriodData) {
      const snapshotMonth = new Date(snapshot.snapshot_id).getMonth()
      const requestedMonth = requestedDateObj.getMonth()
      if (requestedMonth !== snapshotMonth) {
        fallbackReason = 'closing_period_gap'
      }
    }

    logger.info('Found nearest snapshot for fallback', {
      operation: 'findNearestSnapshot',
      requested_date: requestedDate,
      nearest_snapshot_id: nearestId,
      fallback_reason: fallbackReason,
      is_closing_period_data: snapshot.payload.metadata.isClosingPeriodData,
    })

    return { snapshot, fallbackReason }
  }

  return { snapshot: null, fallbackReason: null }
}

/**
 * Helper function to serve data from per-district snapshots with proper error handling
 * Uses the new DistrictDataAggregator for efficient per-district file access
 */
async function serveFromPerDistrictSnapshot<T>(
  res: Response,
  dataExtractor: (
    snapshot: Snapshot,
    aggregator: DistrictDataAggregator
  ) => Promise<T>,
  errorContext: string
): Promise<T | null> {
  const startTime = Date.now()
  const operationId = `per_district_read_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  logger.info('Starting per-district snapshot read operation', {
    operation: 'serveFromPerDistrictSnapshot',
    operation_id: operationId,
    context: errorContext,
  })

  try {
    // Try per-district snapshot store first
    const snapshot = await perDistrictSnapshotStore.getLatestSuccessful()

    if (!snapshot) {
      // Try to fall back to old format
      logger.debug(
        'No per-district snapshot found, falling back to old format',
        {
          operation: 'serveFromPerDistrictSnapshot',
          operation_id: operationId,
          context: errorContext,
        }
      )

      // Check if old format snapshot exists
      const oldSnapshot = await snapshotStore.getLatestSuccessful()
      if (!oldSnapshot) {
        const duration = Date.now() - startTime
        logger.warn('No successful snapshot available for read operation', {
          operation: 'serveFromPerDistrictSnapshot',
          operation_id: operationId,
          context: errorContext,
          duration_ms: duration,
        })

        res.status(503).json({
          error: {
            code: 'NO_SNAPSHOT_AVAILABLE',
            message: 'No data snapshot available yet',
            details: 'Run a refresh operation to create the first snapshot',
          },
        })
        return null
      }

      // For now, we don't support async extractors with old format fallback
      // This is acceptable since we're transitioning to per-district snapshots
      const duration = Date.now() - startTime
      logger.warn('Async extractor not supported with old format fallback', {
        operation: 'serveFromPerDistrictSnapshot',
        operation_id: operationId,
        context: errorContext,
        duration_ms: duration,
      })

      res.status(503).json({
        error: {
          code: 'NO_SNAPSHOT_AVAILABLE',
          message: 'No data snapshot available yet',
          details: 'Run a refresh operation to create the first snapshot',
        },
      })
      return null
    }

    logger.info('Retrieved per-district snapshot for read operation', {
      operation: 'serveFromPerDistrictSnapshot',
      operation_id: operationId,
      snapshot_id: snapshot.snapshot_id,
      created_at: snapshot.created_at,
      schema_version: snapshot.schema_version,
      calculation_version: snapshot.calculation_version,
      district_count: snapshot.payload.districts.length,
      context: errorContext,
    })

    const data = await dataExtractor(snapshot, districtDataAggregator)

    // Add snapshot metadata to the response (including closing period fields)
    const responseWithMetadata = {
      ...data,
      _snapshot_metadata: buildSnapshotResponseMetadata(snapshot),
    }

    const duration = Date.now() - startTime
    logger.info('Per-district snapshot read operation completed successfully', {
      operation: 'serveFromPerDistrictSnapshot',
      operation_id: operationId,
      snapshot_id: snapshot.snapshot_id,
      context: errorContext,
      duration_ms: duration,
    })

    return responseWithMetadata as T
  } catch (error) {
    const duration = Date.now() - startTime
    const errorResponse = transformErrorResponse(error)
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'

    logger.error('Per-district snapshot read operation failed', {
      operation: 'serveFromPerDistrictSnapshot',
      operation_id: operationId,
      context: errorContext,
      error: errorMessage,
      duration_ms: duration,
    })

    res.status(500).json({
      error: {
        code: errorResponse.code || 'SNAPSHOT_ERROR',
        message: `Failed to ${errorContext}`,
        details: errorResponse.details,
      },
    })
    return null
  }
}

/**
 * Helper function to serve district-specific data from snapshots
 * Handles district not found cases specifically
 */
async function serveDistrictFromSnapshot<T>(
  res: Response,
  districtId: string,
  dataExtractor: (district: DistrictStatistics) => T,
  errorContext: string
): Promise<T | null> {
  const startTime = Date.now()
  const operationId = `district_read_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  logger.info('Starting district-specific snapshot read operation', {
    operation: 'serveDistrictFromSnapshot',
    operation_id: operationId,
    district_id: districtId,
    context: errorContext,
  })

  try {
    const snapshot = await snapshotStore.getLatestSuccessful()

    if (!snapshot) {
      const duration = Date.now() - startTime
      logger.warn(
        'No successful snapshot available for district read operation',
        {
          operation: 'serveDistrictFromSnapshot',
          operation_id: operationId,
          district_id: districtId,
          context: errorContext,
          duration_ms: duration,
        }
      )

      res.status(503).json({
        error: {
          code: 'NO_SNAPSHOT_AVAILABLE',
          message: 'No data snapshot available yet',
          details: 'Run a refresh operation to create the first snapshot',
        },
      })
      return null
    }

    logger.info('Retrieved snapshot for district read operation', {
      operation: 'serveDistrictFromSnapshot',
      operation_id: operationId,
      snapshot_id: snapshot.snapshot_id,
      district_id: districtId,
      created_at: snapshot.created_at,
      schema_version: snapshot.schema_version,
      calculation_version: snapshot.calculation_version,
      total_districts: snapshot.payload.districts.length,
      context: errorContext,
    })

    // Find the specific district in the snapshot
    const district = snapshot.payload.districts.find(
      (d: DistrictStatistics) => d.districtId === districtId
    )

    if (!district) {
      const duration = Date.now() - startTime
      logger.warn('District not found in snapshot', {
        operation: 'serveDistrictFromSnapshot',
        operation_id: operationId,
        snapshot_id: snapshot.snapshot_id,
        district_id: districtId,
        available_districts: snapshot.payload.districts
          .map((d: DistrictStatistics) => d.districtId)
          .slice(0, 10), // Log first 10 district IDs
        total_districts: snapshot.payload.districts.length,
        context: errorContext,
        duration_ms: duration,
      })

      res.status(404).json({
        error: {
          code: 'DISTRICT_NOT_FOUND',
          message: 'District not found',
        },
      })
      return null
    }

    logger.debug('Found district in snapshot', {
      operation: 'serveDistrictFromSnapshot',
      operation_id: operationId,
      snapshot_id: snapshot.snapshot_id,
      district_id: districtId,
      district_name: `District ${district.districtId}`, // DistrictStatistics doesn't have name field
    })

    const data = dataExtractor(district)

    // Add snapshot metadata to the response (including closing period fields)
    const responseWithMetadata = {
      ...data,
      _snapshot_metadata: buildSnapshotResponseMetadata(snapshot),
    }

    const duration = Date.now() - startTime
    logger.info('District snapshot read operation completed successfully', {
      operation: 'serveDistrictFromSnapshot',
      operation_id: operationId,
      snapshot_id: snapshot.snapshot_id,
      district_id: districtId,
      context: errorContext,
      duration_ms: duration,
    })

    return responseWithMetadata as T
  } catch (error) {
    const duration = Date.now() - startTime
    const errorResponse = transformErrorResponse(error)
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'

    logger.error('District snapshot read operation failed', {
      operation: 'serveDistrictFromSnapshot',
      operation_id: operationId,
      district_id: districtId,
      context: errorContext,
      error: errorMessage,
      duration_ms: duration,
    })

    res.status(500).json({
      error: {
        code: errorResponse.code || 'SNAPSHOT_ERROR',
        message: `Failed to ${errorContext}`,
        details: errorResponse.details,
      },
    })
    return null
  }
}

/**
 * Helper function to serve district-specific data from per-district snapshots
 * Uses the new DistrictDataAggregator for efficient per-district file access
 */
async function serveDistrictFromPerDistrictSnapshot<T>(
  res: Response,
  districtId: string,
  dataExtractor: (district: DistrictStatistics) => T,
  errorContext: string
): Promise<T | null> {
  const startTime = Date.now()
  const operationId = `per_district_district_read_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  logger.info(
    'Starting per-district district-specific snapshot read operation',
    {
      operation: 'serveDistrictFromPerDistrictSnapshot',
      operation_id: operationId,
      district_id: districtId,
      context: errorContext,
    }
  )

  try {
    // Try per-district snapshot store first
    const snapshot = await perDistrictSnapshotStore.getLatestSuccessful()

    if (!snapshot) {
      // Fall back to old format
      logger.debug(
        'No per-district snapshot found, falling back to old format',
        {
          operation: 'serveDistrictFromPerDistrictSnapshot',
          operation_id: operationId,
          district_id: districtId,
          context: errorContext,
        }
      )

      return await serveDistrictFromSnapshot(
        res,
        districtId,
        dataExtractor,
        errorContext
      )
    }

    logger.info('Retrieved per-district snapshot for district read operation', {
      operation: 'serveDistrictFromPerDistrictSnapshot',
      operation_id: operationId,
      snapshot_id: snapshot.snapshot_id,
      district_id: districtId,
      created_at: snapshot.created_at,
      schema_version: snapshot.schema_version,
      calculation_version: snapshot.calculation_version,
      context: errorContext,
    })

    // Get district data using the aggregator
    const district = await districtDataAggregator.getDistrictData(
      snapshot.snapshot_id,
      districtId
    )

    if (!district) {
      const duration = Date.now() - startTime
      logger.warn('District not found in per-district snapshot', {
        operation: 'serveDistrictFromPerDistrictSnapshot',
        operation_id: operationId,
        snapshot_id: snapshot.snapshot_id,
        district_id: districtId,
        context: errorContext,
        duration_ms: duration,
      })

      res.status(404).json({
        error: {
          code: 'DISTRICT_NOT_FOUND',
          message: 'District not found',
        },
      })
      return null
    }

    logger.debug('Found district in per-district snapshot', {
      operation: 'serveDistrictFromPerDistrictSnapshot',
      operation_id: operationId,
      snapshot_id: snapshot.snapshot_id,
      district_id: districtId,
    })

    const data = dataExtractor(district)

    // Add snapshot metadata to the response (including closing period fields)
    const responseWithMetadata = {
      ...data,
      _snapshot_metadata: buildSnapshotResponseMetadata(snapshot),
    }

    const duration = Date.now() - startTime
    logger.info(
      'Per-district district snapshot read operation completed successfully',
      {
        operation: 'serveDistrictFromPerDistrictSnapshot',
        operation_id: operationId,
        snapshot_id: snapshot.snapshot_id,
        district_id: districtId,
        context: errorContext,
        duration_ms: duration,
      }
    )

    return responseWithMetadata as T
  } catch (error) {
    const duration = Date.now() - startTime
    const errorResponse = transformErrorResponse(error)
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'

    logger.error('Per-district district snapshot read operation failed', {
      operation: 'serveDistrictFromPerDistrictSnapshot',
      operation_id: operationId,
      district_id: districtId,
      context: errorContext,
      error: errorMessage,
      duration_ms: duration,
    })

    res.status(500).json({
      error: {
        code: errorResponse.code || 'SNAPSHOT_ERROR',
        message: `Failed to ${errorContext}`,
        details: errorResponse.details,
      },
    })
    return null
  }
}

/**
 * GET /api/districts
 * Fetch available districts from latest snapshot
 */
router.get(
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

        // Transform to expected format
        const districts = districtSummaries.map(summary => ({
          districtId: summary.districtId,
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
router.get(
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
        created_at: snapshot.created_at,
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
 * GET /api/districts/cache/dates
 * Get all cached dates from both old cache format and new per-district snapshots
 */
router.get('/cache/dates', async (_req: Request, res: Response) => {
  try {
    // Get dates from old cache format
    const oldFormatDates = await toastmastersAPI.getCachedDates()

    // Get dates from new per-district snapshot format
    const snapshots = await perDistrictSnapshotStore.listSnapshots()
    const snapshotDates = snapshots
      .filter(s => s.status === 'success')
      .map(s => s.snapshot_id)
      .filter(id => /^\d{4}-\d{2}-\d{2}$/.test(id)) // Only ISO date format IDs

    // Combine and deduplicate dates
    const allDates = [...new Set([...oldFormatDates, ...snapshotDates])]

    // Sort in descending order (newest first)
    allDates.sort((a, b) => b.localeCompare(a))

    res.json({ dates: allDates })
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

    if (!date) {
      res.status(400).json({
        error: {
          code: 'MISSING_PARAMETER',
          message: 'Date parameter is required',
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
    return
  } catch (error) {
    const errorResponse = transformErrorResponse(error)
    res.status(500).json({
      error: {
        code: errorResponse.code || 'CACHE_ERROR',
        message: 'Failed to get cache version information',
        details: errorResponse.details,
      },
    })
    return
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
    return
  } catch (error) {
    const errorResponse = transformErrorResponse(error)
    res.status(500).json({
      error: {
        code: errorResponse.code || 'CACHE_ERROR',
        message: 'Failed to get cache statistics',
        details: errorResponse.details,
      },
    })
    return
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
 * Fetch district statistics from latest snapshot
 */
router.get(
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
router.get(
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
router.get(
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
router.get(
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

    const data = await serveDistrictFromSnapshot(
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
 * Comprehensive backfill request validation with detailed error reporting
 */
interface BackfillValidationResult {
  isValid: boolean
  errors: Array<{
    field: string
    message: string
    received?: unknown
    expected?: string
  }>
  suggestions: string[]
  sanitizedRequest: BackfillRequest
}

function validateBackfillRequest(body: unknown): BackfillValidationResult {
  const errors: BackfillValidationResult['errors'] = []
  const suggestions: string[] = []

  // Initialize with defaults
  const sanitizedRequest: BackfillRequest = {
    startDate: '',
    endDate: undefined,
    targetDistricts: undefined,
    collectionType: 'auto',
    concurrency: 3,
    retryFailures: true,
    skipExisting: true,
  }

  // Check if body exists and is an object
  if (!body || typeof body !== 'object') {
    errors.push({
      field: 'body',
      message: 'Request body must be a JSON object',
      received: typeof body,
      expected: 'object',
    })
    suggestions.push('Ensure Content-Type header is set to application/json')
    suggestions.push('Provide a valid JSON object in the request body')

    return {
      isValid: false,
      errors,
      suggestions,
      sanitizedRequest,
    }
  }

  const req = body as Record<string, unknown>

  // Validate startDate (required)
  if (!req['startDate']) {
    errors.push({
      field: 'startDate',
      message: 'startDate is required',
      expected: 'YYYY-MM-DD format string',
    })
    suggestions.push(
      'Provide a startDate in YYYY-MM-DD format (e.g., "2024-01-01")'
    )
  } else if (typeof req['startDate'] !== 'string') {
    errors.push({
      field: 'startDate',
      message: 'startDate must be a string',
      received: typeof req['startDate'],
      expected: 'string in YYYY-MM-DD format',
    })
  } else if (!validateDateFormat(req['startDate'])) {
    errors.push({
      field: 'startDate',
      message: 'startDate must be in YYYY-MM-DD format',
      received: req['startDate'],
      expected: 'YYYY-MM-DD format (e.g., "2024-01-01")',
    })
  } else {
    sanitizedRequest.startDate = req['startDate']
  }

  // Validate endDate (optional)
  if (req['endDate'] !== undefined) {
    if (typeof req['endDate'] !== 'string') {
      errors.push({
        field: 'endDate',
        message: 'endDate must be a string',
        received: typeof req['endDate'],
        expected: 'string in YYYY-MM-DD format or undefined',
      })
    } else if (!validateDateFormat(req['endDate'])) {
      errors.push({
        field: 'endDate',
        message: 'endDate must be in YYYY-MM-DD format',
        received: req['endDate'],
        expected: 'YYYY-MM-DD format (e.g., "2024-12-31")',
      })
    } else {
      sanitizedRequest.endDate = req['endDate']
    }
  }

  // Validate date range if both dates are provided and valid
  if (sanitizedRequest.startDate && sanitizedRequest.endDate) {
    const start = new Date(sanitizedRequest.startDate)
    const end = new Date(sanitizedRequest.endDate)

    if (start > end) {
      errors.push({
        field: 'dateRange',
        message: 'startDate must be before or equal to endDate',
        received: `${sanitizedRequest.startDate} to ${sanitizedRequest.endDate}`,
      })
      suggestions.push(
        'Ensure startDate is chronologically before or equal to endDate'
      )
    }

    // Check for reasonable date range (not too far in the past or future)
    const now = new Date()
    const oneYearAgo = new Date(
      now.getFullYear() - 1,
      now.getMonth(),
      now.getDate()
    )
    const oneMonthFromNow = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      now.getDate()
    )

    if (start < oneYearAgo) {
      suggestions.push(
        'Consider that data older than one year may not be available'
      )
    }
    if (end > oneMonthFromNow) {
      suggestions.push(
        'Future dates beyond one month may not have data available'
      )
    }
  }

  // Validate targetDistricts (optional)
  if (req['targetDistricts'] !== undefined) {
    if (!Array.isArray(req['targetDistricts'])) {
      errors.push({
        field: 'targetDistricts',
        message: 'targetDistricts must be an array',
        received: typeof req['targetDistricts'],
        expected: 'array of district ID strings',
      })
    } else {
      const validDistricts: string[] = []
      req['targetDistricts'].forEach((district, index) => {
        if (typeof district !== 'string') {
          errors.push({
            field: `targetDistricts[${index}]`,
            message: 'District ID must be a string',
            received: typeof district,
            expected: 'string',
          })
        } else if (!validateDistrictId(district)) {
          errors.push({
            field: `targetDistricts[${index}]`,
            message: 'Invalid district ID format',
            received: district,
            expected: 'alphanumeric string',
          })
        } else {
          validDistricts.push(district)
        }
      })

      if (validDistricts.length > 0) {
        sanitizedRequest.targetDistricts = validDistricts
      }

      if (req['targetDistricts'].length > 50) {
        suggestions.push(
          'Consider processing large numbers of districts in smaller batches'
        )
      }
    }
  }

  // Validate collectionType (optional)
  if (req['collectionType'] !== undefined) {
    const validTypes = ['system-wide', 'per-district', 'auto']
    if (typeof req['collectionType'] !== 'string') {
      errors.push({
        field: 'collectionType',
        message: 'collectionType must be a string',
        received: typeof req['collectionType'],
        expected: `one of: ${validTypes.join(', ')}`,
      })
    } else if (!validTypes.includes(req['collectionType'])) {
      errors.push({
        field: 'collectionType',
        message: 'Invalid collectionType',
        received: req['collectionType'],
        expected: `one of: ${validTypes.join(', ')}`,
      })
    } else {
      sanitizedRequest.collectionType = req['collectionType'] as
        | 'system-wide'
        | 'per-district'
        | 'auto'
    }
  }

  // Validate concurrency (optional)
  if (req['concurrency'] !== undefined) {
    if (typeof req['concurrency'] !== 'number') {
      errors.push({
        field: 'concurrency',
        message: 'concurrency must be a number',
        received: typeof req['concurrency'],
        expected: 'number between 1 and 10',
      })
    } else if (
      !Number.isInteger(req['concurrency']) ||
      req['concurrency'] < 1 ||
      req['concurrency'] > 10
    ) {
      errors.push({
        field: 'concurrency',
        message: 'concurrency must be an integer between 1 and 10',
        received: req['concurrency'],
        expected: 'integer between 1 and 10',
      })
    } else {
      sanitizedRequest.concurrency = req['concurrency']
    }
  }

  // Validate boolean fields
  const booleanFields = ['retryFailures', 'skipExisting'] as const
  booleanFields.forEach(field => {
    if (req[field] !== undefined) {
      if (typeof req[field] !== 'boolean') {
        errors.push({
          field,
          message: `${field} must be a boolean`,
          received: typeof req[field],
          expected: 'boolean (true or false)',
        })
      } else {
        sanitizedRequest[field] = req[field] as boolean
      }
    }
  })

  // Add helpful suggestions
  if (errors.length === 0) {
    if (!req['targetDistricts']) {
      suggestions.push(
        'No target districts specified - will process all configured districts'
      )
    }
    if (!req['endDate']) {
      suggestions.push(
        'No end date specified - will process only the start date'
      )
    }
    if (req['collectionType'] === 'auto' || !req['collectionType']) {
      suggestions.push(
        'Using auto collection type - system will choose optimal strategy'
      )
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    suggestions,
    sanitizedRequest,
  }
}

/**
 * Estimate completion time for a backfill job based on current progress
 */
function estimateCompletionTime(progress: {
  completed: number
  total: number
  current: string
}): string | undefined {
  if (progress.total === 0 || progress.completed === 0) {
    return undefined
  }

  const completionRate = progress.completed / progress.total
  if (completionRate === 0) {
    return undefined
  }

  // Rough estimate: assume linear progress (not always accurate but helpful)
  const estimatedTotalMinutes = (progress.total - progress.completed) * 2 // ~2 minutes per date
  const estimatedCompletion = new Date(
    Date.now() + estimatedTotalMinutes * 60 * 1000
  )

  return estimatedCompletion.toISOString()
}

/**
 * GET /api/districts/:districtId/daily-reports
 * Fetch daily reports for a date range from latest snapshot
 * Note: Date range parameters are currently ignored as we serve from snapshot
 */
router.get(
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

    const data = await serveDistrictFromSnapshot(
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
router.get(
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

    const data = await serveDistrictFromSnapshot(
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
 * Fetch historical rank data for a district from latest snapshot
 * Query params: startDate (optional), endDate (optional) - currently ignored
 */
router.get('/:districtId/rank-history', async (req: Request, res: Response) => {
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

  const data = await serveDistrictFromSnapshot(
    res,
    districtId,
    district => {
      // Extract rank history from district data
      // Note: Date range filtering is not applied since we serve from snapshot
      const rankHistory =
        (district as DistrictStatistics & { rankHistory?: unknown[] })
          .rankHistory || []
      return { rankHistory }
    },
    'fetch district rank history from snapshot'
  )

  if (data) {
    res.json(data)
  }
})

/**
 * POST /api/districts/backfill
 * Initiate backfill of historical data with modern API design
 *
 * Enhanced features:
 * - Comprehensive input validation with detailed error messages
 * - Proper HTTP status codes and response headers
 * - Clear error handling with actionable feedback
 * - Request validation with helpful suggestions
 */
router.post('/backfill', async (req: Request, res: Response) => {
  const requestId = `backfill_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  logger.info('Received backfill initiation request', {
    operation: 'POST /api/districts/backfill',
    request_id: requestId,
    user_agent: req.get('user-agent'),
    ip: req.ip,
    body_keys: Object.keys(req.body || {}),
  })

  try {
    // Enhanced input validation
    const validationResult = validateBackfillRequest(req.body)
    if (!validationResult.isValid) {
      logger.warn('Backfill request validation failed', {
        operation: 'POST /api/districts/backfill',
        request_id: requestId,
        validation_errors: validationResult.errors,
      })

      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: validationResult.errors,
          suggestions: validationResult.suggestions,
        },
        request_id: requestId,
      })
      return
    }

    const request: BackfillRequest = validationResult.sanitizedRequest

    logger.info('Initiating backfill with validated request', {
      operation: 'POST /api/districts/backfill',
      request_id: requestId,
      target_districts: request.targetDistricts?.length || 0,
      start_date: request.startDate,
      end_date: request.endDate,
      collection_type: request.collectionType,
      concurrency: request.concurrency,
    })

    const backfillId = await backfillService.initiateBackfill(request)
    const status = backfillService.getBackfillStatus(backfillId!)

    if (!status) {
      logger.error('Failed to retrieve backfill status after creation', {
        operation: 'POST /api/districts/backfill',
        request_id: requestId,
        backfill_id: backfillId,
      })

      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Backfill initiated but status unavailable',
          details:
            'The backfill job was created but status could not be retrieved',
        },
        request_id: requestId,
      })
      return
    }

    // Set appropriate response headers
    res.set({
      'Content-Type': 'application/json',
      'X-Request-ID': requestId,
      'X-Backfill-ID': backfillId,
    })

    // Return 202 Accepted for async operation
    res.status(202).json({
      ...status,
      request_id: requestId,
      links: {
        self: `/api/districts/backfill/${backfillId}`,
        cancel: `/api/districts/backfill/${backfillId}`,
      },
    })

    logger.info('Backfill initiated successfully', {
      operation: 'POST /api/districts/backfill',
      request_id: requestId,
      backfill_id: backfillId,
      status: status.status,
      scope_type: status.scope.scopeType,
      target_districts: status.scope.targetDistricts.length,
    })
  } catch (error) {
    const errorResponse = transformErrorResponse(error)
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'

    logger.error('Backfill initiation failed', {
      operation: 'POST /api/districts/backfill',
      request_id: requestId,
      error: errorMessage,
      error_code: errorResponse.code,
    })

    // Determine appropriate HTTP status code based on error type
    let statusCode = 500
    let errorCode = errorResponse.code || 'BACKFILL_ERROR'

    if (errorMessage.includes('scope') || errorMessage.includes('district')) {
      statusCode = 400
      errorCode = 'SCOPE_ERROR'
    } else if (errorMessage.includes('configuration')) {
      statusCode = 422
      errorCode = 'CONFIGURATION_ERROR'
    }

    res.status(statusCode).json({
      error: {
        code: errorCode,
        message: 'Failed to initiate backfill',
        details: errorResponse.details,
        original_error: errorMessage,
      },
      request_id: requestId,
    })
  }
})

/**
 * GET /api/districts/backfill/:backfillId
 * Get backfill progress/status with enhanced response format
 *
 * Enhanced features:
 * - Detailed progress information
 * - Proper HTTP status codes
 * - Response headers with metadata
 * - Links for related operations
 */
router.get('/backfill/:backfillId', async (req: Request, res: Response) => {
  const requestId = `backfill_status_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const { backfillId } = req.params

  logger.info('Received backfill status request', {
    operation: 'GET /api/districts/backfill/:backfillId',
    request_id: requestId,
    backfill_id: backfillId,
    user_agent: req.get('user-agent'),
    ip: req.ip,
  })

  try {
    // Validate backfill ID format
    if (
      !backfillId ||
      typeof backfillId !== 'string' ||
      backfillId.trim().length === 0 ||
      !/^[a-zA-Z0-9\-_]+$/.test(backfillId.trim())
    ) {
      logger.warn('Invalid backfill ID format', {
        operation: 'GET /api/districts/backfill/:backfillId',
        request_id: requestId,
        backfill_id: backfillId,
      })

      res.status(400).json({
        error: {
          code: 'INVALID_BACKFILL_ID',
          message: 'Invalid backfill ID format',
          details:
            'Backfill ID must be a non-empty string containing only alphanumeric characters, hyphens, and underscores',
        },
        request_id: requestId,
      })
      return
    }

    const status = backfillService.getBackfillStatus(backfillId!)

    if (!status) {
      logger.warn('Backfill job not found', {
        operation: 'GET /api/districts/backfill/:backfillId',
        request_id: requestId,
        backfill_id: backfillId,
      })

      res.status(404).json({
        error: {
          code: 'BACKFILL_NOT_FOUND',
          message: 'Backfill job not found',
          details:
            'The specified backfill job does not exist or has been cleaned up',
          suggestions: [
            'Verify the backfill ID is correct',
            'Check if the job has been completed and cleaned up',
            'Initiate a new backfill if needed',
          ],
        },
        request_id: requestId,
      })
      return
    }

    // Set response headers
    res.set({
      'Content-Type': 'application/json',
      'X-Request-ID': requestId,
      'X-Backfill-ID': backfillId,
      'X-Backfill-Status': status.status,
    })

    // Add cache headers based on status
    if (
      status.status === 'complete' ||
      status.status === 'error' ||
      status.status === 'cancelled'
    ) {
      res.set('Cache-Control', 'public, max-age=3600') // Cache completed jobs for 1 hour
    } else {
      res.set('Cache-Control', 'no-cache') // Don't cache in-progress jobs
    }

    // Enhanced response with additional metadata
    const enhancedStatus = {
      ...status,
      request_id: requestId,
      links: {
        self: `/api/districts/backfill/${backfillId}`,
        cancel:
          status.status === 'processing'
            ? `/api/districts/backfill/${backfillId}`
            : undefined,
      },
      metadata: {
        estimated_completion:
          status.status === 'processing' && status.progress.total > 0
            ? estimateCompletionTime(status.progress)
            : undefined,
        efficiency_rating: status.collectionStrategy.estimatedEfficiency,
        collection_method: status.collectionStrategy.type,
      },
    }

    // Remove undefined values from links
    if (!enhancedStatus.links.cancel) {
      delete enhancedStatus.links.cancel
    }

    res.json(enhancedStatus)

    logger.info('Backfill status retrieved successfully', {
      operation: 'GET /api/districts/backfill/:backfillId',
      request_id: requestId,
      backfill_id: backfillId,
      status: status.status,
      progress: `${status.progress.completed}/${status.progress.total}`,
      failed: status.progress.failed,
    })
  } catch (error) {
    const errorResponse = transformErrorResponse(error)
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'

    logger.error('Failed to get backfill status', {
      operation: 'GET /api/districts/backfill/:backfillId',
      request_id: requestId,
      backfill_id: backfillId,
      error: errorMessage,
    })

    res.status(500).json({
      error: {
        code: errorResponse.code || 'BACKFILL_ERROR',
        message: 'Failed to get backfill status',
        details: errorResponse.details,
        original_error: errorMessage,
      },
      request_id: requestId,
    })
  }
})

/**
 * DELETE /api/districts/backfill/:backfillId
 * Cancel a backfill job with enhanced error handling
 *
 * Enhanced features:
 * - Detailed validation and error messages
 * - Proper HTTP status codes
 * - Clear success/failure responses
 * - Helpful suggestions for common issues
 */
router.delete('/backfill/:backfillId', async (req: Request, res: Response) => {
  const requestId = `backfill_cancel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const { backfillId } = req.params

  logger.info('Received backfill cancellation request', {
    operation: 'DELETE /api/districts/backfill/:backfillId',
    request_id: requestId,
    backfill_id: backfillId,
    user_agent: req.get('user-agent'),
    ip: req.ip,
  })

  try {
    // Validate backfill ID format
    if (
      !backfillId ||
      typeof backfillId !== 'string' ||
      backfillId.trim().length === 0 ||
      !/^[a-zA-Z0-9\-_]+$/.test(backfillId.trim())
    ) {
      logger.warn('Invalid backfill ID format for cancellation', {
        operation: 'DELETE /api/districts/backfill/:backfillId',
        request_id: requestId,
        backfill_id: backfillId,
      })

      res.status(400).json({
        error: {
          code: 'INVALID_BACKFILL_ID',
          message: 'Invalid backfill ID format',
          details:
            'Backfill ID must be a non-empty string containing only alphanumeric characters, hyphens, and underscores',
        },
        request_id: requestId,
      })
      return
    }

    // Check if job exists before attempting cancellation
    const currentStatus = backfillService.getBackfillStatus(backfillId!)
    if (!currentStatus) {
      logger.warn('Attempted to cancel non-existent backfill job', {
        operation: 'DELETE /api/districts/backfill/:backfillId',
        request_id: requestId,
        backfill_id: backfillId,
      })

      res.status(404).json({
        error: {
          code: 'BACKFILL_NOT_FOUND',
          message: 'Backfill job not found',
          details:
            'The specified backfill job does not exist or has been cleaned up',
          suggestions: [
            'Verify the backfill ID is correct',
            'Check if the job has already completed',
            'Use GET /api/districts/backfill/:id to check job status',
          ],
        },
        request_id: requestId,
      })
      return
    }

    // Check if job can be cancelled
    if (currentStatus.status !== 'processing') {
      logger.warn('Attempted to cancel non-processing backfill job', {
        operation: 'DELETE /api/districts/backfill/:backfillId',
        request_id: requestId,
        backfill_id: backfillId,
        current_status: currentStatus.status,
      })

      res.status(409).json({
        error: {
          code: 'CANNOT_CANCEL_JOB',
          message: `Cannot cancel backfill job in '${currentStatus.status}' status`,
          details: 'Only processing jobs can be cancelled',
          current_status: currentStatus.status,
          suggestions: [
            'Only jobs with status "processing" can be cancelled',
            'Completed, failed, or already cancelled jobs cannot be cancelled',
          ],
        },
        request_id: requestId,
      })
      return
    }

    const cancelled = await backfillService.cancelBackfill(backfillId!)

    if (!cancelled) {
      logger.error('Backfill cancellation failed unexpectedly', {
        operation: 'DELETE /api/districts/backfill/:backfillId',
        request_id: requestId,
        backfill_id: backfillId,
        current_status: currentStatus.status,
      })

      res.status(500).json({
        error: {
          code: 'CANCELLATION_FAILED',
          message: 'Failed to cancel backfill job',
          details: 'The cancellation operation failed unexpectedly',
        },
        request_id: requestId,
      })
      return
    }

    // Set response headers
    res.set({
      'Content-Type': 'application/json',
      'X-Request-ID': requestId,
      'X-Backfill-ID': backfillId,
    })

    res.json({
      success: true,
      message: 'Backfill cancelled successfully',
      backfill_id: backfillId,
      request_id: requestId,
      cancelled_at: new Date().toISOString(),
      links: {
        status: `/api/districts/backfill/${backfillId}`,
      },
    })

    logger.info('Backfill cancelled successfully', {
      operation: 'DELETE /api/districts/backfill/:backfillId',
      request_id: requestId,
      backfill_id: backfillId,
    })
  } catch (error) {
    const errorResponse = transformErrorResponse(error)
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'

    logger.error('Backfill cancellation failed', {
      operation: 'DELETE /api/districts/backfill/:backfillId',
      request_id: requestId,
      backfill_id: backfillId,
      error: errorMessage,
    })

    res.status(500).json({
      error: {
        code: errorResponse.code || 'BACKFILL_ERROR',
        message: 'Failed to cancel backfill',
        details: errorResponse.details,
        original_error: errorMessage,
      },
      request_id: requestId,
    })
  }
})

/**
 * GET /api/districts/:districtId/data/:date
 * Retrieve cached district data for a specific date
 */
router.get('/:districtId/data/:date', async (req: Request, res: Response) => {
  try {
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

    // Get cached district data
    const data = await districtCacheManager.getDistrictData(districtId!, date)

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

    // Get cached dates
    const dates = await districtCacheManager.getCachedDatesForDistrict(
      districtId!
    )

    // Get date range if dates exist
    const dateRange =
      dates.length > 0
        ? await districtCacheManager.getDistrictDataRange(districtId!)
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
    const districtId = getValidDistrictId(req)
    const { startDate, endDate } = req.body

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
    if (startDate && !validateDateFormat(startDate!)) {
      res.status(400).json({
        error: {
          code: 'INVALID_DATE_FORMAT',
          message: 'startDate must be in YYYY-MM-DD format',
        },
      })
      return
    }

    if (endDate && !validateDateFormat(endDate!)) {
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

    // Initiate backfill using unified service
    const backfillId = await backfillService.initiateBackfill({
      targetDistricts: [districtId],
      startDate,
      endDate,
      collectionType: 'per-district',
    })

    const status = backfillService.getBackfillStatus(backfillId!)

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
      const districtId = getValidDistrictId(req)
      const backfillId = req.params['backfillId']

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

      const status = backfillService.getBackfillStatus(backfillId!)

      if (!status) {
        res.status(404).json({
          error: {
            code: 'BACKFILL_NOT_FOUND',
            message: 'Backfill job not found',
          },
        })
        return
      }

      // Verify the backfill includes the requested district
      if (!status.scope.targetDistricts.includes(districtId!)) {
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
      const districtId = getValidDistrictId(req)
      const backfillId = req.params['backfillId']

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

      // Get status first to verify it belongs to this district
      const status = backfillService.getBackfillStatus(backfillId!)

      if (!status) {
        res.status(404).json({
          error: {
            code: 'BACKFILL_NOT_FOUND',
            message: 'Backfill job not found',
          },
        })
        return
      }

      // Verify the backfill includes the requested district
      if (!status.scope.targetDistricts.includes(districtId!)) {
        res.status(404).json({
          error: {
            code: 'BACKFILL_NOT_FOUND',
            message: 'Backfill job not found for this district',
          },
        })
        return
      }

      const cancelled = await backfillService.cancelBackfill(backfillId!)

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
    keyGenerator: req => {
      const districtId = req.params['districtId']
      if (!districtId) throw new Error('Missing districtId parameter')
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
    keyGenerator: req => {
      const districtId = req.params['districtId']
      const clubId = req.params['clubId']
      if (!districtId || !clubId)
        throw new Error('Missing districtId or clubId parameter')
      return generateDistrictCacheKey(districtId, `clubs/${clubId}/trends`)
    },
  }),
  async (req: Request, res: Response) => {
    try {
      const districtId = getValidDistrictId(req)
      const clubId = req.params['clubId']

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
      const clubTrend = await analyticsEngine.getClubTrends(districtId!, clubId)

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
    keyGenerator: req => {
      const districtId = req.params['districtId']
      if (!districtId) throw new Error('Missing districtId parameter')
      return generateDistrictCacheKey(districtId, 'at-risk-clubs')
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

      // Identify at-risk clubs
      const atRiskClubs = await analyticsEngine.identifyAtRiskClubs(districtId!)

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
    keyGenerator: req => {
      const districtId = req.params['districtId']
      if (!districtId) throw new Error('Missing districtId parameter')
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

      // Validate district ID
      if (!validateDistrictId(districtId!)) {
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
      const insights = await analyticsEngine.generateLeadershipInsights(
        districtId!,
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
    keyGenerator: req => {
      const districtId = req.params['districtId']
      if (!districtId) throw new Error('Missing districtId parameter')
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

      // Validate district ID
      if (!validateDistrictId(districtId!)) {
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
      const analytics =
        await analyticsEngine.generateDistinguishedClubAnalytics(
          districtId!,
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
    keyGenerator: req => {
      const districtId = req.params['districtId']
      const date = req.params['date']
      if (!districtId || !date)
        throw new Error('Missing districtId or date parameter')
      return generateDistrictCacheKey(districtId, `year-over-year/${date}`)
    },
  }),
  async (req: Request, res: Response) => {
    try {
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
    if (!validateDistrictId(districtId!)) {
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
    const analytics = await analyticsEngine.generateDistrictAnalytics(
      districtId!,
      startDate as string | undefined,
      endDate as string | undefined
    )

    // Generate CSV content
    const csvContent = generateDistrictAnalyticsCSV(analytics, districtId!)

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
