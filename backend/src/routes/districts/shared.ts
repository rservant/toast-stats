/**
 * Shared utilities, services, and types for district routes
 * This module provides common functionality used across all district route modules.
 */

import { type Request, type Response } from 'express'
import { logger } from '../../utils/logger.js'
import { BackfillService } from '../../services/UnifiedBackfillService.js'
import { RefreshService } from '../../services/RefreshService.js'
import { DistrictConfigurationService } from '../../services/DistrictConfigurationService.js'
import { getProductionServiceFactory } from '../../services/ProductionServiceFactory.js'
import {
  DistrictDataAggregator,
  createDistrictDataAggregator,
} from '../../services/DistrictDataAggregator.js'
import { StorageProviderFactory } from '../../services/storage/StorageProviderFactory.js'
import { PreComputedAnalyticsService } from '../../services/PreComputedAnalyticsService.js'
import {
  TimeSeriesIndexService,
  type ITimeSeriesIndexService,
} from '../../services/TimeSeriesIndexService.js'
import type { ISnapshotStorage } from '../../types/storageInterfaces.js'
import type { PerDistrictSnapshotStoreInterface } from '../../services/SnapshotStore.js'
import { transformErrorResponse } from '../../utils/transformers.js'
import type { DistrictStatistics } from '../../types/districts.js'
import type { Snapshot } from '../../types/snapshots.js'

// ============================================================================
// Service Initialization
// ============================================================================

// Initialize cache configuration service and get cache directory
const productionFactory = getProductionServiceFactory()
const cacheConfig = productionFactory.createCacheConfigService()

export const cacheDirectory = cacheConfig.getCacheDirectory()

// Create storage providers from environment configuration
// This respects the STORAGE_PROVIDER environment variable:
// - STORAGE_PROVIDER=gcp: Uses FirestoreSnapshotStorage
// - STORAGE_PROVIDER=local or unset: Uses LocalSnapshotStorage
const storageProviders = StorageProviderFactory.createFromEnvironment()

// Export the snapshot storage (respects STORAGE_PROVIDER env var)
export const snapshotStore: ISnapshotStorage = storageProviders.snapshotStorage

// Backward compatibility alias
export const perDistrictSnapshotStore = snapshotStore

// Note: createDistrictDataAggregator expects PerDistrictSnapshotStoreInterface which includes
// checkVersionCompatibility and shouldUpdateClosingPeriodSnapshot methods. ISnapshotStorage
// includes all methods that DistrictDataAggregator actually uses. This type assertion is safe
// because DistrictDataAggregator only uses: readDistrictData, listDistrictsInSnapshot,
// getSnapshotManifest, and getSnapshotMetadata - all of which are in ISnapshotStorage.
export const districtDataAggregator = createDistrictDataAggregator(
  snapshotStore as unknown as PerDistrictSnapshotStoreInterface
)

// Use rawCSVStorage from StorageProviderFactory to respect STORAGE_PROVIDER env var
// - STORAGE_PROVIDER=gcp: Uses GCSRawCSVStorage (reads from GCS bucket)
// - STORAGE_PROVIDER=local or unset: Uses LocalRawCSVStorage (reads from local filesystem)
export const rawCSVCacheService = storageProviders.rawCSVStorage

// Create DistrictConfigurationService with storage from StorageProviderFactory
// This respects the STORAGE_PROVIDER environment variable for storage backend selection
export const districtConfigService = new DistrictConfigurationService(
  storageProviders.districtConfigStorage
)

// Initialize services (async initialization)
let _refreshService: RefreshService | null = null
let _backfillService: BackfillService | null = null
let _preComputedAnalyticsService: PreComputedAnalyticsService | null = null
let _timeSeriesIndexService: ITimeSeriesIndexService | null = null

// Async initialization function
async function initializeServices(): Promise<void> {
  if (_refreshService) return // Already initialized

  // Initialize PreComputedAnalyticsService
  const snapshotsDir = `${cacheDirectory}/snapshots`
  _preComputedAnalyticsService = new PreComputedAnalyticsService({
    snapshotsDir,
  })

  // Initialize TimeSeriesIndexService (read-only, for serving pre-computed data)
  _timeSeriesIndexService = new TimeSeriesIndexService({
    cacheDir: cacheDirectory,
  })

  // RefreshService no longer takes timeSeriesIndexService or rankingCalculator
  // Time-series data and rankings are now pre-computed by scraper-cli
  _refreshService = new RefreshService(
    snapshotStore,
    rawCSVCacheService,
    districtConfigService,
    undefined, // rankingCalculator - DEPRECATED: rankings are pre-computed by scraper-cli
    undefined, // closingPeriodDetector
    undefined, // dataNormalizer
    undefined, // validator
    _preComputedAnalyticsService
  )

  _backfillService = new BackfillService(
    _refreshService,
    // BackfillService now accepts ISnapshotStorage, supporting both local and cloud storage
    snapshotStore,
    districtConfigService,
    undefined, // alertManager
    undefined, // circuitBreakerManager
    undefined // rankingCalculator - DEPRECATED: rankings are pre-computed by scraper-cli
  )
}

// Getters for services (ensure initialization)
export async function getRefreshService(): Promise<RefreshService> {
  await initializeServices()
  return _refreshService!
}

export async function getBackfillService(): Promise<BackfillService> {
  await initializeServices()
  return _backfillService!
}

export async function getTimeSeriesIndexService(): Promise<ITimeSeriesIndexService> {
  await initializeServices()
  return _timeSeriesIndexService!
}

// Initialize cache configuration asynchronously (validation happens lazily)
cacheConfig.initialize().catch((error: unknown) => {
  console.error('Failed to initialize cache configuration:', error)
  // Services will still work with the resolved cache directory path
})

// Start service initialization immediately
initializeServices().catch((error: unknown) => {
  console.error('Failed to initialize services:', error)
})

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate district ID format
 */
export function validateDistrictId(districtId: string): boolean {
  // District IDs are typically numeric or alphanumeric
  // Adjust this validation based on actual Toastmasters district ID format
  return /^[A-Za-z0-9]+$/.test(districtId) && districtId.length > 0
}

/**
 * Extract a string parameter from Express params (handles string | string[] type)
 * Returns the string value or throws if not a valid string
 */
export function extractStringParam(
  value: string | string[] | undefined,
  paramName: string
): string {
  if (!value) {
    throw new Error(`Missing ${paramName} parameter`)
  }
  if (Array.isArray(value)) {
    throw new Error(
      `Invalid ${paramName} parameter: expected string, got array`
    )
  }
  return value
}

/**
 * Helper function to validate and extract district ID from request params
 */
export function getValidDistrictId(req: Request): string | null {
  const districtId = req.params['districtId']
  // Express params can be string | string[] - we only accept string
  if (!districtId || Array.isArray(districtId)) {
    return null
  }
  if (!validateDistrictId(districtId)) {
    return null
  }
  return districtId
}

/**
 * Validate date format (YYYY-MM-DD)
 */
export function validateDateFormat(date: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(date)) {
    return false
  }

  const parsedDate = new Date(date)
  return !isNaN(parsedDate.getTime())
}

// ============================================================================
// Response Metadata Types and Helpers
// ============================================================================

/**
 * Interface for fallback metadata in API responses
 * Indicates when a different snapshot was returned than requested
 * Requirement 4.4
 */
export interface FallbackMetadata {
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
export interface SnapshotResponseMetadata {
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
export function buildSnapshotResponseMetadata(
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

// ============================================================================
// Snapshot Finding Helpers
// ============================================================================

/**
 * Result of finding the nearest snapshot
 */
export interface FindNearestSnapshotResult {
  snapshot: Snapshot | null
  fallbackReason:
    | 'no_snapshot_for_date'
    | 'closing_period_gap'
    | 'future_date'
    | null
}

/**
 * Result of getting a snapshot for a specific date
 * Used by getSnapshotForDate helper for date-aware snapshot selection
 *
 * Requirements:
 * - 1.1, 6.1, 6.2, 6.3, 6.4: Consistent error handling for missing snapshots
 */
export interface GetSnapshotForDateResult {
  snapshot: Snapshot | null
  snapshotDate: string | null
  error?: {
    code: string
    message: string
    details: string
  }
}

/**
 * Get a snapshot for a specific date, or the latest successful snapshot if no date provided.
 *
 * This helper centralizes date-aware snapshot selection logic for all analytics endpoints.
 * It ensures consistent behavior:
 * - When endDate is provided: retrieves the exact snapshot for that date
 * - When endDate is not provided: retrieves the latest successful snapshot (backward compatible)
 *
 * Requirements:
 * - 1.1, 2.1, 3.1, 4.1, 5.1: Use snapshotStore.getSnapshot(endDate) when date is provided
 * - 1.2, 2.2, 3.2, 4.2, 5.2: Use snapshotStore.getLatestSuccessful() when no date provided
 * - 1.3, 2.3, 3.3, 4.3, 5.3, 6.1, 6.2, 6.3, 6.4: Return proper error for non-existent snapshots
 *
 * @param endDate - Optional ISO date string (YYYY-MM-DD) for the requested snapshot
 * @returns The snapshot and its date, or an error if the requested snapshot doesn't exist
 */
export async function getSnapshotForDate(
  endDate?: string
): Promise<GetSnapshotForDateResult> {
  // When no endDate is provided, use the latest successful snapshot (backward compatibility)
  // Requirements: 1.2, 2.2, 3.2, 4.2, 5.2
  if (!endDate) {
    const latestSnapshot = await snapshotStore.getLatestSuccessful()

    if (!latestSnapshot) {
      return {
        snapshot: null,
        snapshotDate: null,
      }
    }

    return {
      snapshot: latestSnapshot,
      snapshotDate: latestSnapshot.snapshot_id,
    }
  }

  // When endDate is provided, get the specific snapshot for that date
  // Requirements: 1.1, 2.1, 3.1, 4.1, 5.1
  const snapshot = await snapshotStore.getSnapshot(endDate)

  if (!snapshot) {
    // Return error structure for non-existent snapshot
    // Requirements: 1.3, 2.3, 3.3, 4.3, 5.3, 6.1, 6.2, 6.3, 6.4
    return {
      snapshot: null,
      snapshotDate: null,
      error: {
        code: 'SNAPSHOT_NOT_FOUND',
        message: `Snapshot not found for date ${endDate}`,
        details:
          'The requested snapshot does not exist. Try a different date or check available snapshots.',
      },
    }
  }

  return {
    snapshot,
    snapshotDate: snapshot.snapshot_id,
  }
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
export async function findNearestSnapshot(
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

// ============================================================================
// Data Serving Helpers
// ============================================================================

/**
 * Helper function to serve data from per-district snapshots with proper error handling
 * Uses the new DistrictDataAggregator for efficient per-district file access
 */
export async function serveFromPerDistrictSnapshot<T>(
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
export async function serveDistrictFromSnapshot<T>(
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
 * with support for date-aware snapshot selection.
 *
 * Uses the new DistrictDataAggregator for efficient per-district file access.
 *
 * Requirements:
 * - 4.3: Accept optional date parameter for historical snapshot access
 * - 4.4: Include fallback metadata when a different snapshot is returned
 * - 5.1: Prefer exact date match, fall back to nearest snapshot
 * - Property 5: Snapshot selection priority (exact match preferred)
 * - Property 6: Fallback metadata inclusion
 */
export async function serveDistrictFromPerDistrictSnapshotByDate<T>(
  res: Response,
  districtId: string,
  requestedDate: string | undefined,
  dataExtractor: (district: DistrictStatistics) => T,
  errorContext: string
): Promise<T | null> {
  // If no date is provided, delegate to the existing function for backward compatibility
  // (Property 3: Backward compatibility)
  if (!requestedDate) {
    return serveDistrictFromPerDistrictSnapshot(
      res,
      districtId,
      dataExtractor,
      errorContext
    )
  }

  const startTime = Date.now()
  const operationId = `per_district_date_read_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  logger.info('Starting date-aware per-district snapshot read operation', {
    operation: 'serveDistrictFromPerDistrictSnapshotByDate',
    operation_id: operationId,
    district_id: districtId,
    requested_date: requestedDate,
    context: errorContext,
  })

  try {
    // First, try to get the exact snapshot for the requested date
    // (Property 5: Snapshot selection priority - exact match preferred)
    let snapshot = await perDistrictSnapshotStore.getSnapshot(requestedDate)
    let fallbackReason:
      | 'no_snapshot_for_date'
      | 'closing_period_gap'
      | 'future_date'
      | null = null

    // If exact date not found, use findNearestSnapshot for fallback
    // (Requirement 5.1: Fallback to nearest snapshot)
    if (!snapshot) {
      logger.info('Exact snapshot not found, searching for nearest', {
        operation: 'serveDistrictFromPerDistrictSnapshotByDate',
        operation_id: operationId,
        requested_date: requestedDate,
      })

      const nearestResult = await findNearestSnapshot(requestedDate)
      snapshot = nearestResult.snapshot
      fallbackReason = nearestResult.fallbackReason
    }

    if (!snapshot) {
      const duration = Date.now() - startTime
      logger.warn('No snapshot available for date-aware read operation', {
        operation: 'serveDistrictFromPerDistrictSnapshotByDate',
        operation_id: operationId,
        district_id: districtId,
        requested_date: requestedDate,
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

    logger.info('Retrieved snapshot for date-aware read operation', {
      operation: 'serveDistrictFromPerDistrictSnapshotByDate',
      operation_id: operationId,
      snapshot_id: snapshot.snapshot_id,
      district_id: districtId,
      requested_date: requestedDate,
      is_fallback: fallbackReason !== null,
      fallback_reason: fallbackReason,
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
      logger.warn('District not found in date-aware snapshot', {
        operation: 'serveDistrictFromPerDistrictSnapshotByDate',
        operation_id: operationId,
        snapshot_id: snapshot.snapshot_id,
        district_id: districtId,
        requested_date: requestedDate,
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

    logger.debug('Found district in date-aware snapshot', {
      operation: 'serveDistrictFromPerDistrictSnapshotByDate',
      operation_id: operationId,
      snapshot_id: snapshot.snapshot_id,
      district_id: districtId,
      requested_date: requestedDate,
    })

    const data = dataExtractor(district)

    // Build snapshot metadata with fallback information when applicable
    // (Property 6: Fallback metadata inclusion)
    const responseWithMetadata = {
      ...data,
      _snapshot_metadata: buildSnapshotResponseMetadata(
        snapshot,
        requestedDate,
        fallbackReason
      ),
    }

    const duration = Date.now() - startTime
    logger.info(
      'Date-aware per-district snapshot read operation completed successfully',
      {
        operation: 'serveDistrictFromPerDistrictSnapshotByDate',
        operation_id: operationId,
        snapshot_id: snapshot.snapshot_id,
        district_id: districtId,
        requested_date: requestedDate,
        is_fallback: fallbackReason !== null,
        fallback_reason: fallbackReason,
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

    logger.error('Date-aware per-district snapshot read operation failed', {
      operation: 'serveDistrictFromPerDistrictSnapshotByDate',
      operation_id: operationId,
      district_id: districtId,
      requested_date: requestedDate,
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
export async function serveDistrictFromPerDistrictSnapshot<T>(
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

// ============================================================================
// Backfill Validation Helpers
// ============================================================================

import type { BackfillRequest } from '../../services/UnifiedBackfillService.js'

/**
 * Comprehensive backfill request validation with detailed error reporting
 */
export interface BackfillValidationResult {
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

export function validateBackfillRequest(
  body: unknown
): BackfillValidationResult {
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
export function estimateCompletionTime(progress: {
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

// ============================================================================
// Program Year Helper
// ============================================================================

/**
 * Helper function to calculate program year info from a date
 * Toastmasters program year runs July 1 to June 30
 */
export function getProgramYearInfo(dateStr: string): {
  startDate: string
  endDate: string
  year: string
} {
  const date = new Date(dateStr)
  const month = date.getMonth() // 0-indexed (0 = January, 6 = July)
  const year = date.getFullYear()

  // If July or later, program year is current year to next year
  // If before July, program year is previous year to current year
  const programYearStart = month >= 6 ? year : year - 1
  const programYearEnd = programYearStart + 1

  return {
    startDate: `${programYearStart}-07-01`,
    endDate: `${programYearEnd}-06-30`,
    year: `${programYearStart}-${programYearEnd}`,
  }
}

// ============================================================================
// Backfill Job Cleanup
// ============================================================================

// Cleanup old jobs every hour
let cleanupIntervalId: ReturnType<typeof setInterval> | null = null

export function startBackfillCleanupInterval(): void {
  if (cleanupIntervalId) return // Already started

  cleanupIntervalId = setInterval(
    async () => {
      try {
        const backfillService = await getBackfillService()
        await backfillService.cleanupOldJobs()
      } catch (error) {
        console.error('Failed to cleanup old backfill jobs:', error)
      }
    },
    60 * 60 * 1000
  )
}

export function stopBackfillCleanupInterval(): void {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId)
    cleanupIntervalId = null
  }
}

// Start cleanup interval on module load
startBackfillCleanupInterval()
