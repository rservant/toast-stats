/**
 * Shared utilities, services, and types for district routes
 * This module provides common functionality used across all district route modules.
 */

import { type Request, type Response } from 'express'
import { logger } from '../../utils/logger.js'
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
import { GCSTimeSeriesIndexStorage } from '../../services/storage/GCSTimeSeriesIndexStorage.js'
import {
  DistrictSnapshotIndexService,
  type IndexStorageReader,
  type DistrictSnapshotIndex,
} from '../../services/DistrictSnapshotIndexService.js'
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
// - STORAGE_PROVIDER=gcp: Uses GCSSnapshotStorage
// - STORAGE_PROVIDER=local or unset: Uses LocalSnapshotStorage
const storageProviders = StorageProviderFactory.createFromEnvironment()

// Export the snapshot storage (respects STORAGE_PROVIDER env var)
export const snapshotStore: ISnapshotStorage = storageProviders.snapshotStorage

// Backward compatibility alias
export const perDistrictSnapshotStore = snapshotStore

// Rank history index — lazy-loaded in-memory cache (#115)
import { RankHistoryIndex } from '../../services/RankHistoryIndex.js'
export const rankHistoryIndex = new RankHistoryIndex(snapshotStore)

/**
 * Creates an analytics file reader appropriate for the current storage provider.
 *
 * When STORAGE_PROVIDER=gcp, returns a reader that downloads files from GCS.
 * When STORAGE_PROVIDER=local, returns undefined (uses default fs.readFile).
 *
 * The reader translates local filesystem paths like:
 *   {cacheDir}/snapshots/2026-02-19/analytics/district_61_analytics.json
 * into GCS object paths like:
 *   snapshots/2026-02-19/analytics/district_61_analytics.json
 */
function createAnalyticsFileReader():
  | ((filePath: string) => Promise<string | null>)
  | undefined {
  const provider = process.env['STORAGE_PROVIDER']
  if (provider !== 'gcp') {
    return undefined // Use default fs.readFile
  }

  const bucketName = process.env['GCS_BUCKET_NAME']
  if (!bucketName) {
    logger.warn(
      'GCS_BUCKET_NAME not set, analytics reader falling back to local filesystem',
      {
        operation: 'createAnalyticsFileReader',
      }
    )
    return undefined
  }

  // Capture as const to satisfy TypeScript narrowing in closures
  const gcsAnalyticsBucket = bucketName

  // Lazy-initialize bucket reference on first read
  let bucketPromise: Promise<import('@google-cloud/storage').Bucket> | null =
    null

  function getBucket(): Promise<import('@google-cloud/storage').Bucket> {
    if (!bucketPromise) {
      bucketPromise = import('@google-cloud/storage').then(({ Storage }) => {
        const storage = new Storage()
        return storage.bucket(gcsAnalyticsBucket)
      })
    }
    return bucketPromise
  }

  logger.info('Created GCS-backed analytics file reader', {
    operation: 'createAnalyticsFileReader',
    bucket: bucketName,
  })

  return async (filePath: string): Promise<string | null> => {
    // Extract the GCS object path from the local filesystem path.
    // Local paths look like: /path/to/cache/snapshots/2026-02-19/analytics/file.json
    // GCS paths look like:   snapshots/2026-02-19/analytics/file.json
    const snapshotsIdx = filePath.indexOf('/snapshots/')
    if (snapshotsIdx === -1) {
      logger.warn('Cannot map file path to GCS object path', {
        operation: 'analyticsFileReader',
        filePath,
      })
      return null
    }

    // Strip the leading slash from the extracted path
    const objectPath = filePath.substring(snapshotsIdx + 1)

    try {
      const bucket = await getBucket()
      const file = bucket.file(objectPath)
      const [exists] = await file.exists()
      if (!exists) {
        return null
      }
      const [buffer] = await file.download()
      return buffer.toString('utf-8')
    } catch (error) {
      // GCS 404 → return null
      const gcsError = error as { code?: number }
      if (gcsError.code === 404) {
        return null
      }
      throw error
    }
  }
}

export const analyticsFileReader = createAnalyticsFileReader()

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

// ─── District Snapshot Index Service ─────────────────────────────────────────
// Reads pre-computed index mapping districts → available snapshot dates.
// Uses GCS in production, local filesystem in development.

function createIndexStorageReader(): IndexStorageReader {
  const storageProvider = process.env['STORAGE_PROVIDER']
  const gcsBucketName = process.env['GCS_BUCKET_NAME']

  if (storageProvider === 'gcp' && gcsBucketName) {
    // GCS-backed: read config/district-snapshot-index.json from bucket
    let bucketPromise: Promise<import('@google-cloud/storage').Bucket> | null =
      null
    const bucket = gcsBucketName

    function getBucket(): Promise<import('@google-cloud/storage').Bucket> {
      if (!bucketPromise) {
        bucketPromise = import('@google-cloud/storage').then(({ Storage }) => {
          const storage = new Storage()
          return storage.bucket(bucket)
        })
      }
      return bucketPromise
    }

    logger.info('Using GCS-backed DistrictSnapshotIndexReader', {
      operation: 'createIndexStorageReader',
      bucket: gcsBucketName,
    })

    return {
      async readIndex(): Promise<DistrictSnapshotIndex | null> {
        const b = await getBucket()
        const file = b.file('config/district-snapshot-index.json')
        const [exists] = await file.exists()
        if (!exists) return null
        const [buffer] = await file.download()
        return JSON.parse(buffer.toString('utf-8')) as DistrictSnapshotIndex
      },
    }
  } else {
    // Local filesystem: read from {cacheDir}/config/district-snapshot-index.json
    const indexPath = `${cacheDirectory}/config/district-snapshot-index.json`
    return {
      async readIndex(): Promise<DistrictSnapshotIndex | null> {
        try {
          const { readFile } = await import('fs/promises')
          const data = await readFile(indexPath, 'utf-8')
          return JSON.parse(data) as DistrictSnapshotIndex
        } catch (error) {
          const fsError = error as { code?: string }
          if (fsError.code === 'ENOENT') return null
          throw error
        }
      },
    }
  }
}

export const districtSnapshotIndexService = new DistrictSnapshotIndexService(
  createIndexStorageReader()
)

// Initialize services (async initialization)
let _refreshService: RefreshService | null = null
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
  // Use GCS-backed implementation when STORAGE_PROVIDER=gcp
  const storageProvider = process.env['STORAGE_PROVIDER']
  const gcsBucketName = process.env['GCS_BUCKET_NAME']
  const gcpProjectId = process.env['GCP_PROJECT_ID']

  if (storageProvider === 'gcp' && gcsBucketName && gcpProjectId) {
    _timeSeriesIndexService = new GCSTimeSeriesIndexStorage({
      projectId: gcpProjectId,
      bucketName: gcsBucketName,
    })
    logger.info('Using GCS-backed TimeSeriesIndexService', {
      operation: 'initializeServices',
      bucket: gcsBucketName,
    })
  } else {
    _timeSeriesIndexService = new TimeSeriesIndexService({
      cacheDir: cacheDirectory,
    })
  }

  // RefreshService no longer takes timeSeriesIndexService or rankingCalculator
  // Time-series data and rankings are now pre-computed by collector-cli
  _refreshService = new RefreshService(
    snapshotStore,
    rawCSVCacheService,
    districtConfigService,
    undefined, // rankingCalculator - DEPRECATED: rankings are pre-computed by collector-cli
    undefined, // closingPeriodDetector
    undefined, // dataNormalizer
    undefined, // validator
    _preComputedAnalyticsService
  )
}

// Getters for services (ensure initialization)
export async function getRefreshService(): Promise<RefreshService> {
  await initializeServices()
  return _refreshService!
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
 * Extract an optional string from an Express query parameter.
 * Handles the full `string | ParsedQs | string[] | ParsedQs[] | undefined` union
 * that `req.query[key]` produces, returning `string | undefined`.
 */
export function extractQueryParam(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    const first: unknown = value[0]
    return typeof first === 'string' ? first : undefined
  }
  return undefined
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
  // Use fast prefix listing (~1s) instead of listSnapshots (~91s with 2,370 snapshots)
  const availableSnapshotIds = await perDistrictSnapshotStore.listSnapshotIds()

  if (availableSnapshotIds.length === 0) {
    return { snapshot: null, fallbackReason: null }
  }

  // Sort by date (newest first) using lexical ordering on YYYY-MM-DD strings
  const sortedSnapshotIds = [...availableSnapshotIds].sort((a, b) =>
    b.localeCompare(a)
  )

  const requestedDateObj = new Date(requestedDate)
  const today = new Date()

  // Check if requested date is in the future
  if (requestedDateObj > today) {
    // Return latest available snapshot
    const latestId = sortedSnapshotIds[0]
    if (latestId) {
      const snapshot = await perDistrictSnapshotStore.getSnapshot(latestId)
      return { snapshot, fallbackReason: 'future_date' }
    }
    return { snapshot: null, fallbackReason: null }
  }

  // Find the nearest snapshot (prefer earlier dates, then later)
  let nearestBefore: string | null = null
  let nearestAfter: string | null = null

  for (const snapshotId of sortedSnapshotIds) {
    const snapshotDate = new Date(snapshotId)
    if (snapshotDate <= requestedDateObj && !nearestBefore) {
      nearestBefore = snapshotId
    }
    if (snapshotDate > requestedDateObj) {
      nearestAfter = snapshotId
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
