/**
 * Snapshot Reader
 *
 * Read operations, caching, and listing for snapshot data.
 * All functions accept explicit dependencies rather than relying on class state,
 * enabling independent testing and clear ownership.
 */

import fs from 'fs/promises'
import path from 'path'
import { logger } from '../../utils/logger.js'
import {
  resolveExistingPathUnderBase,
  validateSnapshotId,
  validateDistrictId,
  ensureDirectoryExists,
} from './SnapshotPathUtils.js'
import type {
  Snapshot,
  SnapshotMetadata,
  SnapshotFilters,
  NormalizedData,
} from '../../types/snapshots.js'
import {
  CURRENT_SCHEMA_VERSION,
  CURRENT_CALCULATION_VERSION,
} from '../../types/snapshots.js'
import type { DistrictStatistics } from '../../types/districts.js'
import type {
  SnapshotManifest,
  AllDistrictsRankingsData,
} from '@toastmasters/shared-contracts'
import {
  validatePerDistrictData,
  validateAllDistrictsRankings,
  validateSnapshotManifest,
} from '@toastmasters/shared-contracts'
import { adaptDistrictStatisticsFileToBackend } from '../../adapters/district-statistics-adapter.js'
import type { PerDistrictSnapshotMetadata } from '../SnapshotStore.js'

// ============================================================================
// Cache types
// ============================================================================

/**
 * In-memory cache entry for snapshot data
 */
export interface SnapshotCacheEntry {
  snapshot: Snapshot
  cachedAt: number
  fileSize: number
  lastModified: number
}

/**
 * In-memory cache entry for snapshot list
 */
export interface SnapshotListCacheEntry {
  metadata: SnapshotMetadata[]
  cachedAt: number
}

/**
 * Performance metrics for monitoring read operations
 */
export interface ReadPerformanceMetrics {
  totalReads: number
  cacheHits: number
  cacheMisses: number
  averageReadTime: number
  concurrentReads: number
  maxConcurrentReads: number
}

// ============================================================================
// Cache helpers
// ============================================================================

/**
 * Get cached current snapshot if within TTL
 */
export function getCachedCurrentSnapshot(
  cache: SnapshotCacheEntry | null,
  ttl: number
): Snapshot | null {
  if (!cache) {
    return null
  }

  const now = Date.now()
  const cacheAge = now - cache.cachedAt

  if (cacheAge > ttl) {
    logger.debug('Snapshot cache expired', {
      operation: 'getCachedCurrentSnapshot',
      cache_age_ms: cacheAge,
      ttl_ms: ttl,
    })
    return null // caller is responsible for clearing
  }

  return cache.snapshot
}

/**
 * Create a new cache entry for a snapshot
 */
export function createSnapshotCacheEntry(
  snapshot: Snapshot
): SnapshotCacheEntry {
  return {
    snapshot,
    cachedAt: Date.now(),
    fileSize: 0, // Not applicable for directory-based snapshots
    lastModified: Date.now(),
  }
}

/**
 * Get cached snapshot list if within TTL
 */
export function getCachedSnapshotList(
  cache: SnapshotListCacheEntry | null,
  ttl: number
): SnapshotMetadata[] | null {
  if (!cache) {
    return null
  }

  const now = Date.now()
  const cacheAge = now - cache.cachedAt

  if (cacheAge > ttl) {
    logger.debug('Snapshot list cache expired', {
      operation: 'getCachedSnapshotList',
      cache_age_ms: cacheAge,
      ttl_ms: ttl,
    })
    return null
  }

  return cache.metadata
}

/**
 * Create a new cache entry for the snapshot list
 */
export function createSnapshotListCacheEntry(
  metadata: SnapshotMetadata[]
): SnapshotListCacheEntry {
  return {
    metadata: [...metadata],
    cachedAt: Date.now(),
  }
}

// ============================================================================
// Performance metrics
// ============================================================================

/**
 * Update performance metrics after a read operation
 */
export function updatePerformanceMetrics(
  metrics: ReadPerformanceMetrics,
  duration: number,
  cacheHit: boolean
): void {
  metrics.totalReads++

  if (cacheHit) {
    metrics.cacheHits++
  } else {
    metrics.cacheMisses++
  }

  const totalTime =
    metrics.averageReadTime * (metrics.totalReads - 1) + duration
  metrics.averageReadTime = totalTime / metrics.totalReads
}

// ============================================================================
// Read operations
// ============================================================================

/**
 * Read district data from a snapshot directory
 */
export async function readDistrictData(
  snapshotsDir: string,
  snapshotId: string,
  districtId: string
): Promise<DistrictStatistics | null> {
  try {
    validateSnapshotId(snapshotId)
    validateDistrictId(districtId)

    const districtFile = await resolveExistingPathUnderBase(
      snapshotsDir,
      snapshotId,
      `district_${districtId}.json`
    )

    const content = await fs.readFile(districtFile, 'utf-8')
    const rawData: unknown = JSON.parse(content)

    const validationResult = validatePerDistrictData(rawData)
    if (!validationResult.success || !validationResult.data) {
      logger.error('District data validation failed', {
        operation: 'readDistrictData',
        snapshot_id: snapshotId,
        district_id: districtId,
        error: validationResult.error ?? 'Validation returned no data',
      })
      return null
    }

    const perDistrictData = validationResult.data

    logger.debug('Read and validated district data file', {
      operation: 'readDistrictData',
      snapshot_id: snapshotId,
      district_id: districtId,
      file_path: districtFile,
      status: perDistrictData.status,
    })

    if (perDistrictData.status !== 'success') {
      return null
    }

    return adaptDistrictStatisticsFileToBackend(perDistrictData.data)
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') {
      logger.debug('District data file not found', {
        operation: 'readDistrictData',
        snapshot_id: snapshotId,
        district_id: districtId,
      })
      return null
    }

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    logger.error('Failed to read district data', {
      operation: 'readDistrictData',
      snapshot_id: snapshotId,
      district_id: districtId,
      error: errorMessage,
    })
    throw new Error(
      `Failed to read district data for ${districtId}: ${errorMessage}`
    )
  }
}

/**
 * Read all-districts rankings data from a snapshot directory
 */
export async function readAllDistrictsRankings(
  snapshotsDir: string,
  snapshotId: string
): Promise<AllDistrictsRankingsData | null> {
  try {
    validateSnapshotId(snapshotId)

    const rankingsFile = await resolveExistingPathUnderBase(
      snapshotsDir,
      snapshotId,
      'all-districts-rankings.json'
    )

    const content = await fs.readFile(rankingsFile, 'utf-8')
    const rawData: unknown = JSON.parse(content)

    const validationResult = validateAllDistrictsRankings(rawData)
    if (!validationResult.success || !validationResult.data) {
      logger.error('All-districts rankings validation failed', {
        operation: 'readAllDistrictsRankings',
        snapshot_id: snapshotId,
        error: validationResult.error ?? 'Validation returned no data',
      })
      return null
    }

    const rankingsData = validationResult.data

    logger.debug('Read and validated all-districts rankings file', {
      operation: 'readAllDistrictsRankings',
      snapshot_id: snapshotId,
      file_path: rankingsFile,
      district_count: rankingsData.rankings.length,
    })

    return rankingsData
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') {
      logger.debug('All-districts rankings file not found', {
        operation: 'readAllDistrictsRankings',
        snapshot_id: snapshotId,
      })
      return null
    }

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    logger.error('Failed to read all-districts rankings file', {
      operation: 'readAllDistrictsRankings',
      snapshot_id: snapshotId,
      error: errorMessage,
    })
    throw new Error(`Failed to read all-districts rankings: ${errorMessage}`)
  }
}

/**
 * Check if all-districts rankings file exists for a snapshot
 */
export async function hasAllDistrictsRankings(
  snapshotsDir: string,
  snapshotId: string
): Promise<boolean> {
  try {
    validateSnapshotId(snapshotId)

    const rankingsFile = await resolveExistingPathUnderBase(
      snapshotsDir,
      snapshotId,
      'all-districts-rankings.json'
    )

    await fs.access(rankingsFile)
    return true
  } catch {
    return false
  }
}

/**
 * Get snapshot manifest
 */
export async function getSnapshotManifest(
  snapshotsDir: string,
  snapshotId: string
): Promise<SnapshotManifest | null> {
  try {
    validateSnapshotId(snapshotId)

    const manifestPath = await resolveExistingPathUnderBase(
      snapshotsDir,
      snapshotId,
      'manifest.json'
    )

    const content = await fs.readFile(manifestPath, 'utf-8')
    const rawData: unknown = JSON.parse(content)

    const validationResult = validateSnapshotManifest(rawData)
    if (!validationResult.success || !validationResult.data) {
      logger.error('Snapshot manifest validation failed', {
        operation: 'getSnapshotManifest',
        snapshot_id: snapshotId,
        error: validationResult.error ?? 'Validation returned no data',
      })
      return null
    }

    const manifest = validationResult.data

    logger.debug('Read and validated snapshot manifest', {
      operation: 'getSnapshotManifest',
      snapshot_id: snapshotId,
      manifest_path: manifestPath,
      total_districts: manifest.totalDistricts,
    })

    return manifest
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') {
      logger.debug('Snapshot manifest not found', {
        operation: 'getSnapshotManifest',
        snapshot_id: snapshotId,
      })
      return null
    }

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    logger.error('Failed to read snapshot manifest', {
      operation: 'getSnapshotManifest',
      snapshot_id: snapshotId,
      error: errorMessage,
    })
    throw new Error(`Failed to read snapshot manifest: ${errorMessage}`)
  }
}

/**
 * Get snapshot metadata
 */
export async function getSnapshotMetadata(
  snapshotsDir: string,
  snapshotId: string
): Promise<PerDistrictSnapshotMetadata | null> {
  try {
    validateSnapshotId(snapshotId)

    const metadataPath = await resolveExistingPathUnderBase(
      snapshotsDir,
      snapshotId,
      'metadata.json'
    )

    const content = await fs.readFile(metadataPath, 'utf-8')
    const metadata: PerDistrictSnapshotMetadata = JSON.parse(content)

    logger.debug('Read snapshot metadata', {
      operation: 'getSnapshotMetadata',
      snapshot_id: snapshotId,
      metadata_path: metadataPath,
      status: metadata.status,
    })

    return metadata
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') {
      logger.debug('Snapshot metadata not found', {
        operation: 'getSnapshotMetadata',
        snapshot_id: snapshotId,
      })
      return null
    }

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    logger.error('Failed to read snapshot metadata', {
      operation: 'getSnapshotMetadata',
      snapshot_id: snapshotId,
      error: errorMessage,
    })
    throw new Error(`Failed to read snapshot metadata: ${errorMessage}`)
  }
}

/**
 * List all districts in a snapshot
 */
export async function listDistrictsInSnapshot(
  snapshotsDir: string,
  snapshotId: string
): Promise<string[]> {
  try {
    const manifest = await getSnapshotManifest(snapshotsDir, snapshotId)
    if (!manifest) {
      return []
    }

    return manifest.districts
      .filter(d => d.status === 'success')
      .map(d => d.districtId)
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    logger.error('Failed to list districts in snapshot', {
      operation: 'listDistrictsInSnapshot',
      snapshot_id: snapshotId,
      error: errorMessage,
    })
    return []
  }
}

/**
 * Read a snapshot from its directory structure
 */
export async function readSnapshotFromDirectory(
  snapshotsDir: string,
  snapshotId: string
): Promise<Snapshot | null> {
  validateSnapshotId(snapshotId)

  // Check if metadata file exists via symlink-safe resolution
  let metadataPath: string
  try {
    metadataPath = await resolveExistingPathUnderBase(
      snapshotsDir,
      snapshotId,
      'metadata.json'
    )
  } catch {
    return null
  }

  try {
    await fs.access(metadataPath)
  } catch {
    return null
  }

  const metadata = await getSnapshotMetadata(snapshotsDir, snapshotId)
  const manifest = await getSnapshotManifest(snapshotsDir, snapshotId)

  if (!metadata || !manifest) {
    return null
  }

  // Read all successful district data
  const districts: DistrictStatistics[] = []
  for (const entry of manifest.districts) {
    if (entry.status === 'success') {
      const districtData = await readDistrictData(
        snapshotsDir,
        snapshotId,
        entry.districtId
      )
      if (districtData) {
        districts.push(districtData)
      }
    }
  }

  // Reconstruct the original Snapshot format
  const normalizedData: NormalizedData = {
    districts,
    metadata: {
      source: metadata.source,
      fetchedAt: metadata.createdAt,
      dataAsOfDate: metadata.dataAsOfDate,
      districtCount: districts.length,
      processingDurationMs: metadata.processingDuration,
      isClosingPeriodData: metadata.isClosingPeriodData,
      collectionDate: metadata.collectionDate,
      logicalDate: metadata.logicalDate,
    },
  }

  const snapshot: Snapshot = {
    snapshot_id: metadata.snapshotId,
    created_at: metadata.createdAt,
    schema_version: metadata.schemaVersion,
    calculation_version: metadata.calculationVersion,
    status: metadata.status,
    errors: metadata.errors,
    payload: normalizedData,
  }

  logger.debug('Reconstructed snapshot from per-district files', {
    operation: 'readSnapshotFromDirectory',
    snapshot_id: snapshotId,
    district_count: districts.length,
    status: snapshot.status,
  })

  return snapshot
}

/**
 * Perform optimized read of a specific snapshot
 */
export async function performSpecificSnapshotRead(
  snapshotsDir: string,
  snapshotId: string,
  operationId: string
): Promise<Snapshot | null> {
  await ensureDirectoryExists(snapshotsDir)

  try {
    const snapshot = await readSnapshotFromDirectory(snapshotsDir, snapshotId)

    logger.debug('Successfully read specific snapshot', {
      operation: 'performSpecificSnapshotRead',
      operation_id: operationId,
      snapshot_id: snapshotId,
    })

    return snapshot
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') {
      logger.debug('Specific snapshot not found', {
        operation: 'performSpecificSnapshotRead',
        operation_id: operationId,
        snapshot_id: snapshotId,
      })
      return null
    }
    throw error
  }
}

/**
 * Get snapshot metadata for listing purposes.
 * Reads only metadata.json (skips manifest.json and stat calls) for speed.
 */
export async function getPerDistrictSnapshotMetadataForList(
  snapshotsDir: string,
  snapshotId: string
): Promise<SnapshotMetadata> {
  const metadataPath = path.join(snapshotsDir, snapshotId, 'metadata.json')

  const metadataContent = await fs.readFile(metadataPath, 'utf-8')
  const metadata: PerDistrictSnapshotMetadata = JSON.parse(metadataContent)

  return {
    snapshot_id: metadata.snapshotId,
    created_at: metadata.createdAt,
    status: metadata.status,
    schema_version: metadata.schemaVersion,
    calculation_version: metadata.calculationVersion,
    size_bytes: 0,
    error_count: metadata.errors.length,
    district_count: metadata.successfulDistricts.length,
  }
}

/**
 * Perform the actual disk scan for listSnapshots.
 * Reads directory entries with withFileTypes to avoid extra stat calls,
 * then reads metadata in parallel batches to avoid overwhelming the filesystem.
 */
export async function performListSnapshotsDiskScan(
  snapshotsDir: string,
  startTime: number
): Promise<SnapshotMetadata[]> {
  await fs.mkdir(snapshotsDir, { recursive: true })

  // Use withFileTypes to avoid separate stat() calls per entry
  const entries = await fs.readdir(snapshotsDir, {
    withFileTypes: true,
  })

  const snapshotDirs = entries
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)

  // Read metadata in parallel batches to avoid overwhelming the filesystem
  const BATCH_SIZE = 50
  const allMetadata: SnapshotMetadata[] = []

  for (let i = 0; i < snapshotDirs.length; i += BATCH_SIZE) {
    const batch = snapshotDirs.slice(i, i + BATCH_SIZE)
    const batchResults = await Promise.all(
      batch.map(dir =>
        getPerDistrictSnapshotMetadataForList(snapshotsDir, dir).catch(
          () => null
        )
      )
    )
    for (const result of batchResults) {
      if (result !== null) {
        allMetadata.push(result)
      }
    }
  }

  logger.info('Snapshot list loaded from disk', {
    operation: 'performListSnapshotsDiskScan',
    snapshot_count: allMetadata.length,
    total_dirs: snapshotDirs.length,
    duration_ms: Date.now() - startTime,
  })

  return allMetadata
}

/**
 * Check if a snapshot write completed fully
 */
export async function isSnapshotWriteComplete(
  snapshotsDir: string,
  snapshotId: string
): Promise<boolean> {
  try {
    const metadata = await getSnapshotMetadata(snapshotsDir, snapshotId)

    if (!metadata) {
      logger.debug('Snapshot not found for write completion check', {
        operation: 'isSnapshotWriteComplete',
        snapshot_id: snapshotId,
      })
      return false
    }

    const isComplete = metadata.writeComplete !== false

    logger.debug('Checked snapshot write completion status', {
      operation: 'isSnapshotWriteComplete',
      snapshot_id: snapshotId,
      writeComplete: metadata.writeComplete,
      isComplete,
      hasWriteFailedDistricts: !!metadata.writeFailedDistricts?.length,
    })

    return isComplete
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    logger.error('Failed to check snapshot write completion', {
      operation: 'isSnapshotWriteComplete',
      snapshot_id: snapshotId,
      error: errorMessage,
    })
    return false
  }
}

/**
 * Check version compatibility for historical snapshots
 */
export async function checkVersionCompatibility(
  snapshotsDir: string,
  snapshotId: string
): Promise<{
  isCompatible: boolean
  schemaCompatible: boolean
  calculationCompatible: boolean
  rankingCompatible: boolean
  warnings: string[]
}> {
  try {
    const metadata = await getSnapshotMetadata(snapshotsDir, snapshotId)
    if (!metadata) {
      return {
        isCompatible: false,
        schemaCompatible: false,
        calculationCompatible: false,
        rankingCompatible: false,
        warnings: ['Snapshot metadata not found'],
      }
    }

    const warnings: string[] = []
    let schemaCompatible = true
    const calculationCompatible = true
    const rankingCompatible = true

    if (metadata.schemaVersion !== CURRENT_SCHEMA_VERSION) {
      schemaCompatible = false
      warnings.push(
        `Schema version mismatch: snapshot has ${metadata.schemaVersion}, current is ${CURRENT_SCHEMA_VERSION}`
      )
    }

    if (metadata.calculationVersion !== CURRENT_CALCULATION_VERSION) {
      warnings.push(
        `Calculation version difference: snapshot has ${metadata.calculationVersion}, current is ${CURRENT_CALCULATION_VERSION}`
      )
    }

    if (metadata.rankingVersion) {
      warnings.push(`Snapshot has ranking version: ${metadata.rankingVersion}`)
    } else {
      warnings.push('Snapshot has no ranking data (pre-ranking implementation)')
    }

    const isCompatible =
      schemaCompatible && calculationCompatible && rankingCompatible

    logger.debug('Version compatibility check completed', {
      operation: 'checkVersionCompatibility',
      snapshot_id: snapshotId,
      is_compatible: isCompatible,
      schema_compatible: schemaCompatible,
      calculation_compatible: calculationCompatible,
      ranking_compatible: rankingCompatible,
      warnings_count: warnings.length,
    })

    return {
      isCompatible,
      schemaCompatible,
      calculationCompatible,
      rankingCompatible,
      warnings,
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    logger.error('Version compatibility check failed', {
      operation: 'checkVersionCompatibility',
      snapshot_id: snapshotId,
      error: errorMessage,
    })

    return {
      isCompatible: false,
      schemaCompatible: false,
      calculationCompatible: false,
      rankingCompatible: false,
      warnings: [`Compatibility check failed: ${errorMessage}`],
    }
  }
}

/**
 * Apply filters and limit to a snapshot metadata list
 */
export function applyFiltersAndLimit(
  metadata: SnapshotMetadata[],
  limit?: number,
  filters?: SnapshotFilters
): SnapshotMetadata[] {
  let result = [...metadata]

  if (filters) {
    result = result.filter(item => {
      if (filters.status && item.status !== filters.status) return false
      if (
        filters.schema_version &&
        item.schema_version !== filters.schema_version
      )
        return false
      if (
        filters.calculation_version &&
        item.calculation_version !== filters.calculation_version
      )
        return false
      if (filters.created_after && item.created_at < filters.created_after)
        return false
      if (filters.created_before && item.created_at > filters.created_before)
        return false
      if (
        filters.min_district_count &&
        item.district_count < filters.min_district_count
      )
        return false
      return true
    })
  }

  // Sort by creation date (newest first)
  result.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  // Apply limit
  if (limit && limit > 0) {
    result = result.slice(0, limit)
  }

  return result
}
