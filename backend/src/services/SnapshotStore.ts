/**
 * Unified Snapshot Store Implementation
 *
 * Provides file-based snapshot storage with per-district directory structure.
 * Each snapshot is stored as a directory containing individual JSON files per district.
 *
 * Storage structure:
 * CACHE_DIR/
 * ├── snapshots/
 * │   ├── 2024-01-01/                       # Snapshot directory (ISO date)
 * │   │   ├── metadata.json                 # Snapshot-level metadata
 * │   │   ├── manifest.json                 # List of district files
 * │   │   ├── all-districts-rankings.json   # Rankings data (optional)
 * │   │   ├── district_42.json              # District 42 data
 * │   │   ├── district_15.json              # District 15 data
 * │   │   └── district_F.json               # District F data
 * │   └── 2024-01-02/                       # Another snapshot
 * │       ├── metadata.json
 * │       ├── manifest.json
 * │       └── district_*.json
 * └── config/
 *     └── districts.json                    # District configuration
 *
 * This file is a thin façade that delegates to focused sub-modules:
 * - SnapshotReader:    Read operations, caching, listings
 * - SnapshotWriter:    Write and delete operations
 * - SnapshotDiscovery: Pointer management and directory scanning
 * - SnapshotPathUtils: Validation and path resolution
 */

import fs from 'fs/promises'
import path from 'path'
import { logger } from '../utils/logger.js'
import { SnapshotIntegrityValidator } from './SnapshotIntegrityValidator.js'
import { SnapshotRecoveryService } from './SnapshotRecoveryService.js'
import {
  SnapshotStore,
  Snapshot,
  SnapshotMetadata,
  SnapshotFilters,
  SnapshotStoreConfig,
} from '../types/snapshots.js'
import { DistrictStatistics } from '../types/districts.js'
import type {
  SnapshotManifest,
  AllDistrictsRankingsData,
} from '@toastmasters/shared-contracts'
import {
  resolvePathUnderBase,
  validateSnapshotId,
} from './snapshot/SnapshotPathUtils.js'
import {
  findLatestSuccessful,
  readSnapshotFromDirectory,
} from './snapshot/index.js'
import * as reader from './snapshot/SnapshotReader.js'
import * as writer from './snapshot/SnapshotWriter.js'

// Re-export types from shared-contracts for backward compatibility
export type {
  DistrictManifestEntry,
  SnapshotManifest,
} from '@toastmasters/shared-contracts'

/**
 * Per-district snapshot metadata with enhanced error tracking
 */
export interface PerDistrictSnapshotMetadata {
  snapshotId: string
  createdAt: string
  schemaVersion: string
  calculationVersion: string
  /** Version of the ranking algorithm used for calculations */
  rankingVersion?: string
  status: 'success' | 'partial' | 'failed'
  configuredDistricts: string[]
  successfulDistricts: string[]
  failedDistricts: string[]
  errors: string[]
  /** Detailed per-district error information for retry logic */
  districtErrors?: Array<{
    districtId: string
    operation: string
    error: string
    timestamp: string
    shouldRetry: boolean
  }>
  processingDuration: number
  source: string
  dataAsOfDate: string

  // Closing period tracking fields
  isClosingPeriodData?: boolean
  collectionDate?: string
  logicalDate?: string

  // Chunked write tracking fields (added for Firestore timeout fix)
  writeFailedDistricts?: string[]
  writeComplete?: boolean
}

/**
 * Options for writing snapshots
 */
export interface WriteSnapshotOptions {
  overrideSnapshotDate?: string
}

/**
 * Result of comparing a new snapshot's collection date against an existing snapshot
 */
export interface SnapshotComparisonResult {
  shouldUpdate: boolean
  reason:
    | 'no_existing'
    | 'newer_data'
    | 'same_day_refresh'
    | 'existing_is_newer'
  existingCollectionDate?: string
  newCollectionDate: string
}

// Re-export for backward compatibility
export type { PerDistrictData } from '@toastmasters/shared-contracts'

/**
 * Backend-specific per-district data structure
 */
export interface BackendPerDistrictData {
  districtId: string
  districtName: string
  collectedAt: string
  status: 'success' | 'failed'
  errorMessage?: string
  data: DistrictStatistics
}

/**
 * Extended snapshot store interface for per-district operations
 */
export interface PerDistrictSnapshotStoreInterface {
  writeDistrictData(
    snapshotId: string,
    districtId: string,
    data: DistrictStatistics
  ): Promise<void>

  readDistrictData(
    snapshotId: string,
    districtId: string
  ): Promise<DistrictStatistics | null>

  listDistrictsInSnapshot(snapshotId: string): Promise<string[]>

  getSnapshotManifest(snapshotId: string): Promise<SnapshotManifest | null>

  getSnapshotMetadata(
    snapshotId: string
  ): Promise<PerDistrictSnapshotMetadata | null>

  getSnapshotMetadataBatch(
    snapshotIds: string[]
  ): Promise<Map<string, PerDistrictSnapshotMetadata | null>>

  checkVersionCompatibility(snapshotId: string): Promise<{
    isCompatible: boolean
    schemaCompatible: boolean
    calculationCompatible: boolean
    rankingCompatible: boolean
    warnings: string[]
  }>

  shouldUpdateClosingPeriodSnapshot(
    snapshotDate: string,
    newCollectionDate: string
  ): Promise<SnapshotComparisonResult>
}

/**
 * Unified file-based snapshot store implementation.
 *
 * Thin façade delegating to focused sub-modules while preserving the
 * existing public API surface for all 50+ consumer import sites.
 */
export class FileSnapshotStore
  implements SnapshotStore, PerDistrictSnapshotStoreInterface
{
  private readonly cacheDir: string
  private readonly snapshotsDir: string
  private readonly config: Required<SnapshotStoreConfig>
  private readonly integrityValidator: SnapshotIntegrityValidator
  private readonly recoveryService: SnapshotRecoveryService

  // Cache state
  private currentSnapshotCache: reader.SnapshotCacheEntry | null = null
  private readonly SNAPSHOT_CACHE_TTL = 300000 // 5 minutes
  private snapshotListCache: reader.SnapshotListCacheEntry | null = null
  private readonly SNAPSHOT_LIST_CACHE_TTL = 60000 // 60 seconds

  // Concurrent read handling
  private readonly activeReads = new Map<string, Promise<Snapshot | null>>()
  private activeListSnapshotsRead: Promise<SnapshotMetadata[]> | null = null
  private readonly performanceMetrics: reader.ReadPerformanceMetrics = {
    totalReads: 0,
    cacheHits: 0,
    cacheMisses: 0,
    averageReadTime: 0,
    concurrentReads: 0,
    maxConcurrentReads: 0,
  }

  constructor(config: SnapshotStoreConfig) {
    this.cacheDir = config.cacheDir
    this.snapshotsDir = path.join(this.cacheDir, 'snapshots')

    this.config = {
      cacheDir: config.cacheDir,
      maxSnapshots: config.maxSnapshots ?? 100,
      maxAgeDays: config.maxAgeDays ?? 30,
      enableCompression: config.enableCompression ?? false,
    }

    this.integrityValidator = new SnapshotIntegrityValidator(
      this.cacheDir,
      this.snapshotsDir
    )
    this.recoveryService = new SnapshotRecoveryService(this.config)
  }

  // ==========================================================================
  // Read operations (delegated to SnapshotReader)
  // ==========================================================================

  async getLatestSuccessful(): Promise<Snapshot | null> {
    const startTime = Date.now()
    const operationId = `read_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    this.performanceMetrics.concurrentReads++
    this.performanceMetrics.maxConcurrentReads = Math.max(
      this.performanceMetrics.maxConcurrentReads,
      this.performanceMetrics.concurrentReads
    )

    logger.info('Starting optimized getLatestSuccessful operation', {
      operation: 'getLatestSuccessful',
      operation_id: operationId,
      cacheDir: this.cacheDir,
      concurrent_reads: this.performanceMetrics.concurrentReads,
      cache_hit_rate:
        this.performanceMetrics.totalReads > 0
          ? (
              (this.performanceMetrics.cacheHits /
                this.performanceMetrics.totalReads) *
              100
            ).toFixed(2) + '%'
          : '0%',
    })

    try {
      // Check cache
      const cachedSnapshot = reader.getCachedCurrentSnapshot(
        this.currentSnapshotCache,
        this.SNAPSHOT_CACHE_TTL
      )
      if (cachedSnapshot) {
        const duration = Date.now() - startTime
        reader.updatePerformanceMetrics(this.performanceMetrics, duration, true)

        logger.info('Served snapshot from in-memory cache', {
          operation: 'getLatestSuccessful',
          operation_id: operationId,
          snapshot_id: cachedSnapshot.snapshot_id,
          cache_age_ms: Date.now() - (this.currentSnapshotCache?.cachedAt || 0),
          duration_ms: duration,
          cache_hit: true,
        })

        return cachedSnapshot
      } else if (this.currentSnapshotCache) {
        // Cache returned null — expired; clear it
        this.currentSnapshotCache = null
      }

      // Concurrent read dedup
      const cacheKey = 'current_snapshot'
      if (this.activeReads.has(cacheKey)) {
        logger.debug('Joining concurrent read operation', {
          operation: 'getLatestSuccessful',
          operation_id: operationId,
          cache_key: cacheKey,
        })

        const result = await this.activeReads.get(cacheKey)!
        const duration = Date.now() - startTime
        reader.updatePerformanceMetrics(
          this.performanceMetrics,
          duration,
          false
        )
        return result
      }

      // Start new read using two-phase discovery
      const readPromise = findLatestSuccessful(
        this.snapshotsDir,
        (id: string) => readSnapshotFromDirectory(this.snapshotsDir, id)
      )
      this.activeReads.set(cacheKey, readPromise)

      try {
        const result = await readPromise
        const duration = Date.now() - startTime
        reader.updatePerformanceMetrics(
          this.performanceMetrics,
          duration,
          false
        )

        if (result) {
          this.currentSnapshotCache = reader.createSnapshotCacheEntry(result)

          logger.info(
            'Successfully retrieved and cached latest successful snapshot',
            {
              operation: 'getLatestSuccessful',
              operation_id: operationId,
              snapshot_id: result.snapshot_id,
              created_at: result.created_at,
              schema_version: result.schema_version,
              calculation_version: result.calculation_version,
              district_count: result.payload.districts.length,
              duration_ms: duration,
              cache_hit: false,
            }
          )
        }

        return result
      } finally {
        this.activeReads.delete(cacheKey)
      }
    } catch (error) {
      const duration = Date.now() - startTime
      reader.updatePerformanceMetrics(this.performanceMetrics, duration, false)

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to get latest successful snapshot', {
        operation: 'getLatestSuccessful',
        operation_id: operationId,
        error: errorMessage,
        duration_ms: duration,
      })
      throw new Error(
        `Failed to get latest successful snapshot: ${errorMessage}`
      )
    } finally {
      this.performanceMetrics.concurrentReads--
    }
  }

  async getLatest(): Promise<Snapshot | null> {
    const startTime = Date.now()
    logger.info('Starting getLatest operation', {
      operation: 'getLatest',
      cacheDir: this.cacheDir,
    })

    try {
      await fs.mkdir(this.snapshotsDir, { recursive: true })

      const files = await fs.readdir(this.snapshotsDir)
      const snapshotDirs: string[] = []
      for (const file of files) {
        const filePath = path.join(this.snapshotsDir, file)
        const stats = await fs.stat(filePath)
        if (stats.isDirectory()) {
          snapshotDirs.push(file)
        }
      }

      snapshotDirs.sort((a, b) => b.localeCompare(a))

      logger.info('Found snapshot directories for getLatest', {
        operation: 'getLatest',
        total_dirs: snapshotDirs.length,
        dirs: snapshotDirs.slice(0, 5),
      })

      if (snapshotDirs.length === 0) {
        const duration = Date.now() - startTime
        logger.info('No snapshots found', {
          operation: 'getLatest',
          duration_ms: duration,
        })
        return null
      }

      const latestDir = snapshotDirs[0]
      if (!latestDir) {
        logger.warn('No snapshot directories found')
        return null
      }

      const snapshot = await this.getSnapshot(latestDir)

      const duration = Date.now() - startTime
      if (snapshot) {
        logger.info('Successfully retrieved latest snapshot', {
          operation: 'getLatest',
          snapshot_id: snapshot.snapshot_id,
          created_at: snapshot.created_at,
          status: snapshot.status,
          schema_version: snapshot.schema_version,
          calculation_version: snapshot.calculation_version,
          district_count: snapshot.payload?.districts?.length || 0,
          duration_ms: duration,
        })
      }

      return snapshot
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to get latest snapshot', {
        operation: 'getLatest',
        error: errorMessage,
        duration_ms: duration,
      })
      throw new Error(`Failed to get latest snapshot: ${errorMessage}`)
    }
  }

  async getSnapshot(snapshotId: string): Promise<Snapshot | null> {
    validateSnapshotId(snapshotId)

    const startTime = Date.now()
    const operationId = `read_specific_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    this.performanceMetrics.concurrentReads++
    this.performanceMetrics.maxConcurrentReads = Math.max(
      this.performanceMetrics.maxConcurrentReads,
      this.performanceMetrics.concurrentReads
    )

    logger.info('Starting optimized getSnapshot operation', {
      operation: 'getSnapshot',
      operation_id: operationId,
      snapshot_id: snapshotId,
      concurrent_reads: this.performanceMetrics.concurrentReads,
    })

    try {
      // Cache hit for current snapshot
      if (
        this.currentSnapshotCache &&
        this.currentSnapshotCache.snapshot.snapshot_id === snapshotId
      ) {
        const cachedSnapshot = reader.getCachedCurrentSnapshot(
          this.currentSnapshotCache,
          this.SNAPSHOT_CACHE_TTL
        )
        if (cachedSnapshot) {
          const duration = Date.now() - startTime
          reader.updatePerformanceMetrics(
            this.performanceMetrics,
            duration,
            true
          )

          logger.info('Served specific snapshot from in-memory cache', {
            operation: 'getSnapshot',
            operation_id: operationId,
            snapshot_id: snapshotId,
            cache_age_ms:
              Date.now() - (this.currentSnapshotCache?.cachedAt || 0),
            duration_ms: duration,
            cache_hit: true,
          })

          return cachedSnapshot
        }
      }

      // Concurrent read dedup
      const cacheKey = `snapshot_${snapshotId}`
      if (this.activeReads.has(cacheKey)) {
        logger.debug(
          'Joining concurrent read operation for specific snapshot',
          {
            operation: 'getSnapshot',
            operation_id: operationId,
            snapshot_id: snapshotId,
            cache_key: cacheKey,
          }
        )

        const result = await this.activeReads.get(cacheKey)!
        const duration = Date.now() - startTime
        reader.updatePerformanceMetrics(
          this.performanceMetrics,
          duration,
          false
        )
        return result
      }

      // New read
      const readPromise = reader.performSpecificSnapshotRead(
        this.snapshotsDir,
        snapshotId,
        operationId
      )
      this.activeReads.set(cacheKey, readPromise)

      try {
        const result = await readPromise
        const duration = Date.now() - startTime
        reader.updatePerformanceMetrics(
          this.performanceMetrics,
          duration,
          false
        )

        if (result) {
          logger.info('Successfully retrieved specific snapshot', {
            operation: 'getSnapshot',
            operation_id: operationId,
            snapshot_id: snapshotId,
            created_at: result.created_at,
            status: result.status,
            schema_version: result.schema_version,
            calculation_version: result.calculation_version,
            district_count: result.payload?.districts?.length || 0,
            duration_ms: duration,
            cache_hit: false,
          })
        } else {
          logger.info('Specific snapshot not found', {
            operation: 'getSnapshot',
            operation_id: operationId,
            snapshot_id: snapshotId,
            duration_ms: duration,
          })
        }

        return result
      } finally {
        this.activeReads.delete(cacheKey)
      }
    } catch (error) {
      const duration = Date.now() - startTime
      reader.updatePerformanceMetrics(this.performanceMetrics, duration, false)

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to get specific snapshot', {
        operation: 'getSnapshot',
        operation_id: operationId,
        snapshot_id: snapshotId,
        error: errorMessage,
        duration_ms: duration,
      })
      throw new Error(`Failed to get snapshot ${snapshotId}: ${errorMessage}`)
    } finally {
      this.performanceMetrics.concurrentReads--
    }
  }

  async readDistrictData(
    snapshotId: string,
    districtId: string
  ): Promise<DistrictStatistics | null> {
    return reader.readDistrictData(this.snapshotsDir, snapshotId, districtId)
  }

  async readAllDistrictsRankings(
    snapshotId: string
  ): Promise<AllDistrictsRankingsData | null> {
    return reader.readAllDistrictsRankings(this.snapshotsDir, snapshotId)
  }

  async hasAllDistrictsRankings(snapshotId: string): Promise<boolean> {
    return reader.hasAllDistrictsRankings(this.snapshotsDir, snapshotId)
  }

  async listDistrictsInSnapshot(snapshotId: string): Promise<string[]> {
    return reader.listDistrictsInSnapshot(this.snapshotsDir, snapshotId)
  }

  async getSnapshotManifest(
    snapshotId: string
  ): Promise<SnapshotManifest | null> {
    return reader.getSnapshotManifest(this.snapshotsDir, snapshotId)
  }

  async getSnapshotMetadata(
    snapshotId: string
  ): Promise<PerDistrictSnapshotMetadata | null> {
    return reader.getSnapshotMetadata(this.snapshotsDir, snapshotId)
  }

  async getSnapshotMetadataBatch(
    snapshotIds: string[]
  ): Promise<Map<string, PerDistrictSnapshotMetadata | null>> {
    const startTime = Date.now()
    const results = new Map<string, PerDistrictSnapshotMetadata | null>()

    logger.info('Starting batch metadata retrieval', {
      operation: 'getSnapshotMetadataBatch',
      requested_count: snapshotIds.length,
      snapshot_ids: snapshotIds.slice(0, 10),
    })

    if (snapshotIds.length === 0) {
      return results
    }

    const validSnapshotIds: string[] = []
    for (const snapshotId of snapshotIds) {
      try {
        validateSnapshotId(snapshotId)
        validSnapshotIds.push(snapshotId)
      } catch (error) {
        logger.warn('Invalid snapshot ID in batch request', {
          operation: 'getSnapshotMetadataBatch',
          snapshot_id: snapshotId,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        results.set(snapshotId, null)
      }
    }

    const cachedList = reader.getCachedSnapshotList(
      this.snapshotListCache,
      this.SNAPSHOT_LIST_CACHE_TTL
    )
    const cachedSnapshotIds = cachedList
      ? new Set(cachedList.map(m => m.snapshot_id))
      : null

    if (!cachedList && this.snapshotListCache) {
      this.snapshotListCache = null
    }

    const metadataPromises = validSnapshotIds.map(async snapshotId => {
      if (cachedSnapshotIds && !cachedSnapshotIds.has(snapshotId)) {
        return { snapshotId, metadata: null }
      }
      try {
        const metadata = await reader.getSnapshotMetadata(
          this.snapshotsDir,
          snapshotId
        )
        return { snapshotId, metadata }
      } catch {
        return { snapshotId, metadata: null }
      }
    })

    const metadataResults = await Promise.all(metadataPromises)
    for (const { snapshotId, metadata } of metadataResults) {
      results.set(snapshotId, metadata)
    }

    const duration = Date.now() - startTime
    const foundCount = Array.from(results.values()).filter(
      m => m !== null
    ).length

    logger.info('Batch metadata retrieval completed', {
      operation: 'getSnapshotMetadataBatch',
      requested_count: snapshotIds.length,
      found_count: foundCount,
      not_found_count: results.size - foundCount,
      used_cache: cachedSnapshotIds !== null,
      duration_ms: duration,
    })

    return results
  }

  async isSnapshotWriteComplete(snapshotId: string): Promise<boolean> {
    return reader.isSnapshotWriteComplete(this.snapshotsDir, snapshotId)
  }

  async listSnapshots(
    limit?: number,
    filters?: SnapshotFilters
  ): Promise<SnapshotMetadata[]> {
    const startTime = Date.now()

    try {
      let metadata: SnapshotMetadata[]
      const cachedData = reader.getCachedSnapshotList(
        this.snapshotListCache,
        this.SNAPSHOT_LIST_CACHE_TTL
      )

      if (cachedData) {
        metadata = [...cachedData]

        logger.debug('Snapshot list cache hit', {
          operation: 'listSnapshots',
          cache_age_ms: Date.now() - (this.snapshotListCache?.cachedAt ?? 0),
          cached_count: metadata.length,
        })
      } else {
        if (this.snapshotListCache) {
          this.snapshotListCache = null
        }

        if (this.activeListSnapshotsRead) {
          logger.debug('Joining in-flight listSnapshots disk scan', {
            operation: 'listSnapshots',
          })
          metadata = [...(await this.activeListSnapshotsRead)]
        } else {
          logger.debug('Snapshot list cache miss, reading from disk', {
            operation: 'listSnapshots',
          })

          const readPromise = reader.performListSnapshotsDiskScan(
            this.snapshotsDir,
            startTime
          )
          this.activeListSnapshotsRead = readPromise

          try {
            metadata = await readPromise
            this.snapshotListCache =
              reader.createSnapshotListCacheEntry(metadata)
          } finally {
            this.activeListSnapshotsRead = null
          }
        }
      }

      return reader.applyFiltersAndLimit(metadata, limit, filters)
    } catch (error) {
      throw new Error(
        `Failed to list snapshots: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  async listSnapshotIds(): Promise<string[]> {
    try {
      await fs.mkdir(this.snapshotsDir, { recursive: true })
      const entries = await fs.readdir(this.snapshotsDir)
      const snapshotIds: string[] = []
      for (const entry of entries) {
        const fullPath = path.join(this.snapshotsDir, entry)
        const stats = await fs.stat(fullPath)
        if (stats.isDirectory()) {
          snapshotIds.push(entry)
        }
      }
      // Sort newest first
      snapshotIds.sort((a, b) => b.localeCompare(a))
      return snapshotIds
    } catch {
      return []
    }
  }

  async hasDistrictInSnapshot(
    snapshotId: string,
    districtId: string
  ): Promise<boolean> {
    try {
      const districtPath = path.join(
        this.snapshotsDir,
        snapshotId,
        `district_${districtId}.json`
      )
      await fs.access(districtPath)
      return true
    } catch {
      return false
    }
  }

  async checkVersionCompatibility(snapshotId: string): Promise<{
    isCompatible: boolean
    schemaCompatible: boolean
    calculationCompatible: boolean
    rankingCompatible: boolean
    warnings: string[]
  }> {
    return reader.checkVersionCompatibility(this.snapshotsDir, snapshotId)
  }

  getPerformanceMetrics(): reader.ReadPerformanceMetrics {
    return { ...this.performanceMetrics }
  }

  resetPerformanceMetrics(): void {
    this.performanceMetrics.totalReads = 0
    this.performanceMetrics.cacheHits = 0
    this.performanceMetrics.cacheMisses = 0
    this.performanceMetrics.averageReadTime = 0
    this.performanceMetrics.concurrentReads = 0
    this.performanceMetrics.maxConcurrentReads = 0
  }

  // ==========================================================================
  // Write operations (delegated to SnapshotWriter)
  // ==========================================================================

  async writeSnapshot(
    snapshot: Snapshot,
    allDistrictsRankings?: AllDistrictsRankingsData,
    options?: WriteSnapshotOptions
  ): Promise<void> {
    return writer.writeSnapshot(
      this.snapshotsDir,
      snapshot,
      () => this.invalidateCaches(),
      allDistrictsRankings,
      options
    )
  }

  async writeDistrictData(
    snapshotId: string,
    districtId: string,
    data: DistrictStatistics
  ): Promise<void> {
    return writer.writeDistrictData(
      this.snapshotsDir,
      snapshotId,
      districtId,
      data
    )
  }

  async writeAllDistrictsRankings(
    snapshotId: string,
    rankingsData: AllDistrictsRankingsData
  ): Promise<void> {
    return writer.writeAllDistrictsRankings(
      this.snapshotsDir,
      snapshotId,
      rankingsData
    )
  }

  async deleteSnapshot(snapshotId: string): Promise<boolean> {
    return writer.deleteSnapshot(this.snapshotsDir, snapshotId, (id: string) =>
      this.invalidateSnapshotCache(id)
    )
  }

  async shouldUpdateClosingPeriodSnapshot(
    snapshotDate: string,
    newCollectionDate: string
  ): Promise<SnapshotComparisonResult> {
    return writer.shouldUpdateClosingPeriodSnapshot(
      this.snapshotsDir,
      snapshotDate,
      newCollectionDate
    )
  }

  // ==========================================================================
  // Integrity and recovery (kept inline — already delegated to services)
  // ==========================================================================

  async isReady(): Promise<boolean> {
    try {
      await fs.mkdir(this.snapshotsDir, { recursive: true })

      const testFile = path.join(this.snapshotsDir, '.write-test')
      await fs.writeFile(testFile, 'test', 'utf-8')
      await fs.unlink(testFile)

      return true
    } catch {
      return false
    }
  }

  async validateIntegrity(): Promise<
    import('./SnapshotIntegrityValidator.js').SnapshotStoreIntegrityResult
  > {
    logger.info('Starting snapshot store integrity validation', {
      operation: 'validateIntegrity',
      cache_dir: this.cacheDir,
    })

    return await this.integrityValidator.validateSnapshotStore()
  }

  async recoverFromCorruption(
    options: {
      createBackups?: boolean
      removeCorruptedFiles?: boolean
      forceRecovery?: boolean
    } = {}
  ): Promise<import('./SnapshotRecoveryService.js').RecoveryResult> {
    logger.info('Starting snapshot store recovery', {
      operation: 'recoverFromCorruption',
      cache_dir: this.cacheDir,
      options,
    })

    return await this.recoveryService.recoverSnapshotStore(options)
  }

  async getRecoveryGuidance(): Promise<{
    integrityStatus: import('./SnapshotIntegrityValidator.js').SnapshotStoreIntegrityResult
    recoverySteps: string[]
    urgencyLevel: 'low' | 'medium' | 'high' | 'critical'
    estimatedRecoveryTime: string
  }> {
    return await this.recoveryService.getRecoveryGuidance()
  }

  // ==========================================================================
  // Private cache management
  // ==========================================================================

  private async invalidateCaches(): Promise<void> {
    this.currentSnapshotCache = null
    this.snapshotListCache = null

    const pointerPath = resolvePathUnderBase(
      this.snapshotsDir,
      'latest-successful.json'
    )
    try {
      await fs.unlink(pointerPath)
    } catch {
      // Ignore — file may not exist
    }

    logger.debug('Invalidated all in-memory caches and snapshot pointer', {
      operation: 'invalidateCaches',
      invalidated: [
        'currentSnapshotCache',
        'snapshotListCache',
        'snapshotPointerFile',
      ],
    })
  }

  private invalidateSnapshotCache(snapshotId: string): void {
    if (
      this.currentSnapshotCache &&
      this.currentSnapshotCache.snapshot.snapshot_id === snapshotId
    ) {
      this.currentSnapshotCache = null
      logger.debug('Invalidated current snapshot cache for deleted snapshot', {
        operation: 'invalidateSnapshotCache',
        snapshot_id: snapshotId,
      })
    }

    this.snapshotListCache = null

    logger.debug('Invalidated snapshot list cache after deletion', {
      operation: 'invalidateSnapshotCache',
      snapshot_id: snapshotId,
    })
  }
}

// ============================================================================
// Aliases for backward compatibility
// ============================================================================

/**
 * @deprecated Use PerDistrictSnapshotStoreInterface instead
 */
export type PerDistrictSnapshotStore = PerDistrictSnapshotStoreInterface

/**
 * Factory function to create a FileSnapshotStore with default configuration
 */
export function createFileSnapshotStore(cacheDir?: string): FileSnapshotStore {
  const resolvedCacheDir = cacheDir || process.env['CACHE_DIR'] || './cache'

  return new FileSnapshotStore({
    cacheDir: resolvedCacheDir,
    maxSnapshots: 100,
    maxAgeDays: 30,
    enableCompression: false,
  })
}
