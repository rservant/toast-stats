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
 * Performance optimizations:
 * - In-memory caching of current snapshot content
 * - Concurrent read request handling with shared cache
 * - Optimized file system access patterns
 * - Read performance independence from refresh operations
 * - Directory scanning for latest successful snapshot (no pointer file)
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
  NormalizedData,
  CURRENT_SCHEMA_VERSION,
  CURRENT_CALCULATION_VERSION,
  AllDistrictsRankingsData,
} from '../types/snapshots.js'
import { DistrictStatistics } from '../types/districts.js'

/**
 * In-memory cache entry for snapshot data
 */
interface SnapshotCacheEntry {
  snapshot: Snapshot
  cachedAt: number
  fileSize: number
  lastModified: number
}

/**
 * Performance metrics for monitoring read operations
 */
interface ReadPerformanceMetrics {
  totalReads: number
  cacheHits: number
  cacheMisses: number
  averageReadTime: number
  concurrentReads: number
  maxConcurrentReads: number
}

/**
 * Manifest entry for a district file within a snapshot
 */
export interface DistrictManifestEntry {
  districtId: string
  fileName: string
  status: 'success' | 'failed'
  fileSize: number
  lastModified: string
  errorMessage?: string
}

/**
 * Snapshot manifest listing all district files
 */
export interface SnapshotManifest {
  snapshotId: string
  createdAt: string
  districts: DistrictManifestEntry[]
  totalDistricts: number
  successfulDistricts: number
  failedDistricts: number
  /** All districts rankings file information */
  allDistrictsRankings?: {
    filename: string
    size: number
    status: 'present' | 'missing'
  }
}

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
}

/**
 * Options for writing snapshots
 */
export interface WriteSnapshotOptions {
  /**
   * Override the snapshot directory date.
   * Used for closing period data where the snapshot should be dated
   * as the last day of the data month.
   * Format: YYYY-MM-DD
   */
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

/**
 * Per-district snapshot data structure
 */
export interface PerDistrictData {
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
 * Unified file-based snapshot store implementation
 *
 * Provides directory-based snapshot storage with individual district files
 * and performance optimizations including caching and concurrent read handling.
 */
export class FileSnapshotStore
  implements SnapshotStore, PerDistrictSnapshotStoreInterface
{
  private readonly cacheDir: string
  private readonly snapshotsDir: string
  private readonly config: Required<SnapshotStoreConfig>
  private readonly integrityValidator: SnapshotIntegrityValidator
  private readonly recoveryService: SnapshotRecoveryService

  // Performance optimization: In-memory cache for current snapshot
  private currentSnapshotCache: SnapshotCacheEntry | null = null
  private readonly SNAPSHOT_CACHE_TTL = 300000 // 5 minutes

  // Concurrent read handling
  private readonly activeReads = new Map<string, Promise<Snapshot | null>>()
  private readonly performanceMetrics: ReadPerformanceMetrics = {
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

  /**
   * Resolve a path under a base directory, ensuring it doesn't escape via traversal.
   * Returns the sanitized path for use in file operations.
   * This is CodeQL-friendly because it returns a new sanitized value.
   * @throws Error if the path would escape the base directory
   */
  private resolvePathUnderBase(baseDir: string, ...parts: string[]): string {
    const base = path.resolve(baseDir)
    const candidate = path.resolve(baseDir, ...parts)

    const rel = path.relative(base, candidate)

    // Must not be outside base, and must not be absolute (Windows safety)
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new Error(`Path traversal attempt detected: ${candidate}`)
    }

    return candidate
  }

  /**
   * Resolve an existing path under a base directory with symlink protection.
   * Uses realpath to resolve symlinks and ensure the actual file is within base.
   * Use this for reads where the file is expected to exist.
   * @throws Error if the path would escape the base directory or file doesn't exist
   */
  private async resolveExistingPathUnderBase(
    baseDir: string,
    ...parts: string[]
  ): Promise<string> {
    const baseReal = await fs.realpath(baseDir)

    // Resolve the target path lexically first
    const candidate = path.resolve(baseDir, ...parts)

    // realpath resolves symlinks - prevents "symlink escapes base" attacks
    const candidateReal = await fs.realpath(candidate)

    const rel = path.relative(baseReal, candidateReal)
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new Error(`Path traversal attempt detected: ${candidateReal}`)
    }

    return candidateReal
  }

  /**
   * Validate a district ID to ensure it is safe to use in file paths.
   * District IDs are typically numeric (e.g., "42", "15") or alphanumeric (e.g., "F", "NONEXISTENT1").
   * The pattern prevents path traversal by rejecting special characters like /, \, .., etc.
   * @throws Error if the district ID format is invalid
   */
  private validateDistrictId(districtId: string): void {
    if (typeof districtId !== 'string' || districtId.length === 0) {
      throw new Error('Invalid district ID: empty or non-string value')
    }

    // Allow alphanumeric characters only (no path separators, dots, or special chars)
    // This prevents path traversal while allowing valid district IDs
    const DISTRICT_ID_PATTERN = /^[A-Za-z0-9]+$/
    if (!DISTRICT_ID_PATTERN.test(districtId)) {
      logger.warn('Rejected district ID with invalid characters', {
        operation: 'validateDistrictId',
        district_id: districtId,
      })
      throw new Error('Invalid district ID format')
    }
  }

  /**
   * Get the most recent successful snapshot with performance optimizations.
   * Uses directory scanning to find the latest successful snapshot.
   */
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
      // Check if we have a valid cached snapshot
      const cachedSnapshot = await this.getCachedCurrentSnapshot()
      if (cachedSnapshot) {
        const duration = Date.now() - startTime
        this.updatePerformanceMetrics(duration, true)

        logger.info('Served snapshot from in-memory cache', {
          operation: 'getLatestSuccessful',
          operation_id: operationId,
          snapshot_id: cachedSnapshot.snapshot_id,
          cache_age_ms: Date.now() - (this.currentSnapshotCache?.cachedAt || 0),
          duration_ms: duration,
          cache_hit: true,
        })

        return cachedSnapshot
      }

      // Check for concurrent read of the same operation
      const cacheKey = 'current_snapshot'
      if (this.activeReads.has(cacheKey)) {
        logger.debug('Joining concurrent read operation', {
          operation: 'getLatestSuccessful',
          operation_id: operationId,
          cache_key: cacheKey,
        })

        const result = await this.activeReads.get(cacheKey)!
        const duration = Date.now() - startTime
        this.updatePerformanceMetrics(duration, false)
        return result
      }

      // Start new read operation using directory scanning
      const readPromise = this.findLatestSuccessfulByScanning()
      this.activeReads.set(cacheKey, readPromise)

      try {
        const result = await readPromise
        const duration = Date.now() - startTime
        this.updatePerformanceMetrics(duration, false)

        if (result) {
          await this.cacheCurrentSnapshot(result)

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
      this.updatePerformanceMetrics(duration, false)

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

  /**
   * Get the most recent snapshot regardless of status
   */
  async getLatest(): Promise<Snapshot | null> {
    const startTime = Date.now()
    logger.info('Starting getLatest operation', {
      operation: 'getLatest',
      cacheDir: this.cacheDir,
    })

    try {
      await this.ensureDirectoryExists()

      const files = await fs.readdir(this.snapshotsDir)

      // Get directories (per-district snapshots) and sort by date (newest first)
      const snapshotDirs: string[] = []
      for (const file of files) {
        const filePath = path.join(this.snapshotsDir, file)
        const stats = await fs.stat(filePath)
        if (stats.isDirectory()) {
          snapshotDirs.push(file)
        }
      }

      // Sort by ISO date string (works for YYYY-MM-DD format)
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

  /**
   * Write a snapshot using per-district directory structure
   */
  async writeSnapshot(
    snapshot: Snapshot,
    allDistrictsRankings?: AllDistrictsRankingsData,
    options?: WriteSnapshotOptions
  ): Promise<void> {
    const startTime = Date.now()
    logger.info('Starting per-district snapshot write operation', {
      operation: 'writeSnapshot',
      snapshot_id: snapshot.snapshot_id,
      status: snapshot.status,
      schema_version: snapshot.schema_version,
      calculation_version: snapshot.calculation_version,
      district_count: snapshot.payload.districts.length,
      error_count: snapshot.errors.length,
      has_rankings: !!allDistrictsRankings,
      override_snapshot_date: options?.overrideSnapshotDate,
    })

    try {
      await fs.mkdir(this.snapshotsDir, { recursive: true })

      // Generate ISO date-based directory name
      const snapshotDirName = options?.overrideSnapshotDate
        ? this.generateSnapshotDirectoryName(options.overrideSnapshotDate)
        : this.generateSnapshotDirectoryName(
            snapshot.payload.metadata.dataAsOfDate
          )
      const snapshotDir = path.join(this.snapshotsDir, snapshotDirName)

      await fs.mkdir(snapshotDir, { recursive: true })

      logger.debug('Created snapshot directory', {
        operation: 'writeSnapshot',
        snapshot_id: snapshot.snapshot_id,
        snapshot_dir: snapshotDir,
        snapshot_dir_name: snapshotDirName,
      })

      // Write individual district files
      const manifestEntries: DistrictManifestEntry[] = []
      let successfulDistricts = 0
      let failedDistricts = 0

      for (const district of snapshot.payload.districts) {
        try {
          await this.writeDistrictData(
            snapshotDirName,
            district.districtId,
            district
          )

          const districtFile = path.join(
            snapshotDir,
            `district_${district.districtId}.json`
          )
          const stats = await fs.stat(districtFile)

          manifestEntries.push({
            districtId: district.districtId,
            fileName: `district_${district.districtId}.json`,
            status: 'success',
            fileSize: stats.size,
            lastModified: stats.mtime.toISOString(),
          })

          successfulDistricts++
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error'

          manifestEntries.push({
            districtId: district.districtId,
            fileName: `district_${district.districtId}.json`,
            status: 'failed',
            fileSize: 0,
            lastModified: new Date().toISOString(),
            errorMessage,
          })

          failedDistricts++

          logger.warn('Failed to write district data', {
            operation: 'writeSnapshot',
            snapshot_id: snapshotDirName,
            district_id: district.districtId,
            error: errorMessage,
          })
        }
      }

      // Write manifest.json
      const manifest: SnapshotManifest = {
        snapshotId: snapshotDirName,
        createdAt: snapshot.created_at,
        districts: manifestEntries,
        totalDistricts: snapshot.payload.districts.length,
        successfulDistricts,
        failedDistricts,
      }

      // Write all-districts rankings if provided
      if (allDistrictsRankings) {
        try {
          await this.writeAllDistrictsRankings(
            snapshotDirName,
            allDistrictsRankings
          )

          const rankingsFile = path.join(
            snapshotDir,
            'all-districts-rankings.json'
          )
          const rankingsStats = await fs.stat(rankingsFile)
          manifest.allDistrictsRankings = {
            filename: 'all-districts-rankings.json',
            size: rankingsStats.size,
            status: 'present',
          }

          logger.info('Successfully wrote all-districts rankings to snapshot', {
            operation: 'writeSnapshot',
            snapshot_id: snapshotDirName,
            rankings_count: allDistrictsRankings.rankings.length,
            file_size: rankingsStats.size,
          })
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error'
          logger.error('Failed to write all-districts rankings', {
            operation: 'writeSnapshot',
            snapshot_id: snapshotDirName,
            error: errorMessage,
          })
          throw new Error(
            `Failed to write all-districts rankings: ${errorMessage}`
          )
        }
      } else {
        manifest.allDistrictsRankings = {
          filename: 'all-districts-rankings.json',
          size: 0,
          status: 'missing',
        }
      }

      const manifestPath = path.join(snapshotDir, 'manifest.json')
      await fs.writeFile(
        manifestPath,
        JSON.stringify(manifest, null, 2),
        'utf-8'
      )

      logger.debug('Wrote snapshot manifest', {
        operation: 'writeSnapshot',
        snapshot_id: snapshotDirName,
        manifest_path: manifestPath,
        total_districts: manifest.totalDistricts,
        successful_districts: manifest.successfulDistricts,
        failed_districts: manifest.failedDistricts,
      })

      // Write metadata.json
      const districtErrorsFromSnapshot =
        this.extractDistrictErrorsFromSnapshot(snapshot)

      const rankingVersion = allDistrictsRankings
        ? allDistrictsRankings.metadata.rankingVersion
        : this.extractRankingVersion(snapshot)

      const metadata: PerDistrictSnapshotMetadata = {
        snapshotId: snapshotDirName,
        createdAt: snapshot.created_at,
        schemaVersion: snapshot.schema_version,
        calculationVersion: snapshot.calculation_version,
        rankingVersion,
        status: snapshot.status,
        configuredDistricts: snapshot.payload.districts.map(d => d.districtId),
        successfulDistricts: manifestEntries
          .filter(e => e.status === 'success')
          .map(e => e.districtId),
        failedDistricts: manifestEntries
          .filter(e => e.status === 'failed')
          .map(e => e.districtId),
        errors: snapshot.errors,
        districtErrors: districtErrorsFromSnapshot,
        processingDuration: Date.now() - startTime,
        source: snapshot.payload.metadata.source,
        dataAsOfDate: snapshot.payload.metadata.dataAsOfDate,
        isClosingPeriodData: snapshot.payload.metadata.isClosingPeriodData,
        collectionDate: snapshot.payload.metadata.collectionDate,
        logicalDate: snapshot.payload.metadata.logicalDate,
      }

      const metadataPath = path.join(snapshotDir, 'metadata.json')
      await fs.writeFile(
        metadataPath,
        JSON.stringify(metadata, null, 2),
        'utf-8'
      )

      logger.debug('Wrote snapshot metadata', {
        operation: 'writeSnapshot',
        snapshot_id: snapshotDirName,
        metadata_path: metadataPath,
        processing_duration: metadata.processingDuration,
      })

      // Invalidate caches when writing a successful snapshot
      if (snapshot.status === 'success') {
        this.invalidateCaches()

        logger.info('Caches invalidated for successful snapshot', {
          operation: 'writeSnapshot',
          snapshot_id: snapshotDirName,
        })
      }

      const duration = Date.now() - startTime
      logger.info('Snapshot write operation completed successfully', {
        operation: 'writeSnapshot',
        snapshot_id: snapshotDirName,
        status: snapshot.status,
        successful_districts: successfulDistricts,
        failed_districts: failedDistricts,
        duration_ms: duration,
      })
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to write snapshot', {
        operation: 'writeSnapshot',
        snapshot_id: snapshot.snapshot_id,
        error: errorMessage,
        duration_ms: duration,
      })
      throw new Error(`Failed to write snapshot: ${errorMessage}`)
    }
  }

  /**
   * Write district data to a snapshot directory
   */
  async writeDistrictData(
    snapshotId: string,
    districtId: string,
    data: DistrictStatistics
  ): Promise<void> {
    // Validate inputs before constructing paths
    this.validateSnapshotId(snapshotId)
    this.validateDistrictId(districtId)

    // Use safe path resolution for write operation
    const districtFile = this.resolvePathUnderBase(
      this.snapshotsDir,
      snapshotId,
      `district_${districtId}.json`
    )

    const perDistrictData: PerDistrictData = {
      districtId,
      districtName: `District ${districtId}`,
      collectedAt: new Date().toISOString(),
      status: 'success',
      data,
    }

    await fs.writeFile(
      districtFile,
      JSON.stringify(perDistrictData, null, 2),
      'utf-8'
    )

    logger.debug('Wrote district data file', {
      operation: 'writeDistrictData',
      snapshot_id: snapshotId,
      district_id: districtId,
      file_path: districtFile,
    })
  }

  /**
   * Write all-districts rankings data to a snapshot directory
   */
  async writeAllDistrictsRankings(
    snapshotId: string,
    rankingsData: AllDistrictsRankingsData
  ): Promise<void> {
    this.validateSnapshotId(snapshotId)

    // Use safe path resolution for write operation
    const rankingsFile = this.resolvePathUnderBase(
      this.snapshotsDir,
      snapshotId,
      'all-districts-rankings.json'
    )

    const updatedRankingsData = {
      ...rankingsData,
      metadata: {
        ...rankingsData.metadata,
        snapshotId,
      },
    }

    await fs.writeFile(
      rankingsFile,
      JSON.stringify(updatedRankingsData, null, 2),
      'utf-8'
    )

    logger.info('Wrote all-districts rankings file', {
      operation: 'writeAllDistrictsRankings',
      snapshot_id: snapshotId,
      file_path: rankingsFile,
      district_count: updatedRankingsData.rankings.length,
      total_districts: updatedRankingsData.metadata.totalDistricts,
    })
  }

  /**
   * Read all-districts rankings data from a snapshot directory
   */
  async readAllDistrictsRankings(
    snapshotId: string
  ): Promise<AllDistrictsRankingsData | null> {
    try {
      this.validateSnapshotId(snapshotId)

      // Use symlink-safe path resolution for existing file read
      const rankingsFile = await this.resolveExistingPathUnderBase(
        this.snapshotsDir,
        snapshotId,
        'all-districts-rankings.json'
      )

      const content = await fs.readFile(rankingsFile, 'utf-8')
      const rankingsData: AllDistrictsRankingsData = JSON.parse(content)

      logger.debug('Read all-districts rankings file', {
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
  async hasAllDistrictsRankings(snapshotId: string): Promise<boolean> {
    try {
      this.validateSnapshotId(snapshotId)

      // Use symlink-safe path resolution for existing file check
      const rankingsFile = await this.resolveExistingPathUnderBase(
        this.snapshotsDir,
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
   * Read district data from a snapshot directory
   */
  async readDistrictData(
    snapshotId: string,
    districtId: string
  ): Promise<DistrictStatistics | null> {
    try {
      // Validate inputs before constructing paths
      this.validateSnapshotId(snapshotId)
      this.validateDistrictId(districtId)

      // Use symlink-safe path resolution for existing file read
      const districtFile = await this.resolveExistingPathUnderBase(
        this.snapshotsDir,
        snapshotId,
        `district_${districtId}.json`
      )

      const content = await fs.readFile(districtFile, 'utf-8')
      const perDistrictData: PerDistrictData = JSON.parse(content)

      logger.debug('Read district data file', {
        operation: 'readDistrictData',
        snapshot_id: snapshotId,
        district_id: districtId,
        file_path: districtFile,
        status: perDistrictData.status,
      })

      return perDistrictData.status === 'success' ? perDistrictData.data : null
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
   * List all districts in a snapshot
   */
  async listDistrictsInSnapshot(snapshotId: string): Promise<string[]> {
    try {
      const manifest = await this.getSnapshotManifest(snapshotId)
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
   * Get snapshot manifest
   */
  async getSnapshotManifest(
    snapshotId: string
  ): Promise<SnapshotManifest | null> {
    try {
      this.validateSnapshotId(snapshotId)

      // Use symlink-safe path resolution for existing file read
      const manifestPath = await this.resolveExistingPathUnderBase(
        this.snapshotsDir,
        snapshotId,
        'manifest.json'
      )

      const content = await fs.readFile(manifestPath, 'utf-8')
      const manifest: SnapshotManifest = JSON.parse(content)

      logger.debug('Read snapshot manifest', {
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
  async getSnapshotMetadata(
    snapshotId: string
  ): Promise<PerDistrictSnapshotMetadata | null> {
    try {
      this.validateSnapshotId(snapshotId)

      // Use symlink-safe path resolution for existing file read
      const metadataPath = await this.resolveExistingPathUnderBase(
        this.snapshotsDir,
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
   * List snapshots with optional filtering and limiting
   */
  async listSnapshots(
    limit?: number,
    filters?: SnapshotFilters
  ): Promise<SnapshotMetadata[]> {
    try {
      await fs.mkdir(this.snapshotsDir, { recursive: true })

      const files = await fs.readdir(this.snapshotsDir)

      // Get directories (per-district snapshots)
      const snapshotDirs: string[] = []

      for (const file of files) {
        const filePath = path.join(this.snapshotsDir, file)
        const stats = await fs.stat(filePath)

        if (stats.isDirectory()) {
          snapshotDirs.push(file)
        }
      }

      const metadataPromises: Promise<SnapshotMetadata>[] = []

      for (const dir of snapshotDirs) {
        metadataPromises.push(this.getPerDistrictSnapshotMetadataForList(dir))
      }

      let metadata = await Promise.all(metadataPromises)

      // Filter out null results
      metadata = metadata.filter(m => m !== null) as SnapshotMetadata[]

      // Apply filters
      if (filters) {
        metadata = metadata.filter(item => {
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
          if (
            filters.created_before &&
            item.created_at > filters.created_before
          )
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
      metadata.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )

      // Apply limit
      if (limit && limit > 0) {
        metadata = metadata.slice(0, limit)
      }

      return metadata
    } catch (error) {
      throw new Error(
        `Failed to list snapshots: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Validate a snapshot ID to ensure it is safe to use in file paths.
   */
  private validateSnapshotId(snapshotId: string): void {
    if (typeof snapshotId !== 'string' || snapshotId.length === 0) {
      throw new Error('Invalid snapshot ID: empty or non-string value')
    }

    // Allow alphanumeric, underscore, hyphen (for ISO dates like 2024-01-01)
    const SNAPSHOT_ID_PATTERN = /^[A-Za-z0-9_-]+$/
    if (!SNAPSHOT_ID_PATTERN.test(snapshotId)) {
      logger.warn('Rejected snapshot ID with invalid characters', {
        operation: 'validateSnapshotId',
        snapshot_id: snapshotId,
      })
      throw new Error('Invalid snapshot ID format')
    }
  }

  /**
   * Get a specific snapshot by ID
   */
  async getSnapshot(snapshotId: string): Promise<Snapshot | null> {
    this.validateSnapshotId(snapshotId)

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
      // Check if this is the current snapshot and we have it cached
      if (
        this.currentSnapshotCache &&
        this.currentSnapshotCache.snapshot.snapshot_id === snapshotId
      ) {
        const cachedSnapshot = await this.getCachedCurrentSnapshot()
        if (cachedSnapshot) {
          const duration = Date.now() - startTime
          this.updatePerformanceMetrics(duration, true)

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

      // Check for concurrent read of the same snapshot
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
        this.updatePerformanceMetrics(duration, false)
        return result
      }

      // Start new read operation
      const readPromise = this.performSpecificSnapshotRead(
        snapshotId,
        operationId
      )
      this.activeReads.set(cacheKey, readPromise)

      try {
        const result = await readPromise
        const duration = Date.now() - startTime
        this.updatePerformanceMetrics(duration, false)

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
      this.updatePerformanceMetrics(duration, false)

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

  /**
   * Check if the snapshot store is properly initialized and accessible
   */
  async isReady(): Promise<boolean> {
    try {
      await this.ensureDirectoryExists()

      const testFile = path.join(this.snapshotsDir, '.write-test')
      await fs.writeFile(testFile, 'test', 'utf-8')
      await fs.unlink(testFile)

      return true
    } catch {
      return false
    }
  }

  /**
   * Validate the integrity of the snapshot store
   */
  async validateIntegrity(): Promise<
    import('./SnapshotIntegrityValidator.js').SnapshotStoreIntegrityResult
  > {
    logger.info('Starting snapshot store integrity validation', {
      operation: 'validateIntegrity',
      cache_dir: this.cacheDir,
    })

    return await this.integrityValidator.validateSnapshotStore()
  }

  /**
   * Perform automatic recovery of corrupted snapshots or pointers
   */
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

  /**
   * Get recovery guidance for manual intervention
   */
  async getRecoveryGuidance(): Promise<{
    integrityStatus: import('./SnapshotIntegrityValidator.js').SnapshotStoreIntegrityResult
    recoverySteps: string[]
    urgencyLevel: 'low' | 'medium' | 'high' | 'critical'
    estimatedRecoveryTime: string
  }> {
    return await this.recoveryService.getRecoveryGuidance()
  }

  /**
   * Check version compatibility for historical snapshots
   */
  async checkVersionCompatibility(snapshotId: string): Promise<{
    isCompatible: boolean
    schemaCompatible: boolean
    calculationCompatible: boolean
    rankingCompatible: boolean
    warnings: string[]
  }> {
    try {
      const metadata = await this.getSnapshotMetadata(snapshotId)
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
        warnings.push(
          `Snapshot has ranking version: ${metadata.rankingVersion}`
        )
      } else {
        warnings.push(
          'Snapshot has no ranking data (pre-ranking implementation)'
        )
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
   * Compare a new snapshot's collection date against an existing snapshot
   */
  async shouldUpdateClosingPeriodSnapshot(
    snapshotDate: string,
    newCollectionDate: string
  ): Promise<SnapshotComparisonResult> {
    try {
      const existingMetadata = await this.getSnapshotMetadata(snapshotDate)

      if (!existingMetadata) {
        logger.debug('No existing snapshot found, should create new', {
          operation: 'shouldUpdateClosingPeriodSnapshot',
          snapshot_date: snapshotDate,
          new_collection_date: newCollectionDate,
        })

        return {
          shouldUpdate: true,
          reason: 'no_existing',
          newCollectionDate,
        }
      }

      const existingCollectionDate =
        existingMetadata.collectionDate ?? existingMetadata.dataAsOfDate

      const existingDate = new Date(existingCollectionDate)
      const newDate = new Date(newCollectionDate)

      if (newDate > existingDate) {
        logger.info('New data is newer, should update snapshot', {
          operation: 'shouldUpdateClosingPeriodSnapshot',
          snapshot_date: snapshotDate,
          existing_collection_date: existingCollectionDate,
          new_collection_date: newCollectionDate,
        })

        return {
          shouldUpdate: true,
          reason: 'newer_data',
          existingCollectionDate,
          newCollectionDate,
        }
      } else if (newDate.getTime() === existingDate.getTime()) {
        logger.info('Same collection date, allowing same-day refresh', {
          operation: 'shouldUpdateClosingPeriodSnapshot',
          snapshot_date: snapshotDate,
          existing_collection_date: existingCollectionDate,
          new_collection_date: newCollectionDate,
        })

        return {
          shouldUpdate: true,
          reason: 'same_day_refresh',
          existingCollectionDate,
          newCollectionDate,
        }
      } else {
        logger.info('Existing snapshot has newer data, skipping update', {
          operation: 'shouldUpdateClosingPeriodSnapshot',
          snapshot_date: snapshotDate,
          existing_collection_date: existingCollectionDate,
          new_collection_date: newCollectionDate,
        })

        return {
          shouldUpdate: false,
          reason: 'existing_is_newer',
          existingCollectionDate,
          newCollectionDate,
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      logger.warn(
        'Error reading existing snapshot metadata, treating as no existing',
        {
          operation: 'shouldUpdateClosingPeriodSnapshot',
          snapshot_date: snapshotDate,
          new_collection_date: newCollectionDate,
          error: errorMessage,
        }
      )

      return {
        shouldUpdate: true,
        reason: 'no_existing',
        newCollectionDate,
      }
    }
  }

  /**
   * Get performance metrics for monitoring
   */
  getPerformanceMetrics(): ReadPerformanceMetrics {
    return { ...this.performanceMetrics }
  }

  /**
   * Reset performance metrics
   */
  resetPerformanceMetrics(): void {
    this.performanceMetrics.totalReads = 0
    this.performanceMetrics.cacheHits = 0
    this.performanceMetrics.cacheMisses = 0
    this.performanceMetrics.averageReadTime = 0
    this.performanceMetrics.concurrentReads = 0
    this.performanceMetrics.maxConcurrentReads = 0
  }

  // ============================================================================
  // Private helper methods
  // ============================================================================

  /**
   * Ensure the snapshots directory exists
   */
  private async ensureDirectoryExists(): Promise<void> {
    try {
      await fs.mkdir(this.snapshotsDir, { recursive: true })
    } catch (error) {
      throw new Error(
        `Failed to create snapshots directory: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Invalidate all in-memory caches
   */
  private invalidateCaches(): void {
    this.currentSnapshotCache = null

    logger.debug('Invalidated all in-memory caches', {
      operation: 'invalidateCaches',
    })
  }

  /**
   * Get cached current snapshot if valid
   */
  private async getCachedCurrentSnapshot(): Promise<Snapshot | null> {
    if (!this.currentSnapshotCache) {
      return null
    }

    const now = Date.now()
    const cacheAge = now - this.currentSnapshotCache.cachedAt

    if (cacheAge > this.SNAPSHOT_CACHE_TTL) {
      logger.debug('Snapshot cache expired', {
        operation: 'getCachedCurrentSnapshot',
        cache_age_ms: cacheAge,
        ttl_ms: this.SNAPSHOT_CACHE_TTL,
      })
      this.currentSnapshotCache = null
      return null
    }

    // For directory-based snapshots, we can't easily check file modification
    // Just return the cached snapshot if within TTL
    return this.currentSnapshotCache.snapshot
  }

  /**
   * Cache the current snapshot in memory
   */
  private async cacheCurrentSnapshot(snapshot: Snapshot): Promise<void> {
    try {
      this.currentSnapshotCache = {
        snapshot,
        cachedAt: Date.now(),
        fileSize: 0, // Not applicable for directory-based snapshots
        lastModified: Date.now(),
      }

      logger.debug('Cached current snapshot in memory', {
        operation: 'cacheCurrentSnapshot',
        snapshot_id: snapshot.snapshot_id,
        cache_time: this.currentSnapshotCache.cachedAt,
      })
    } catch (error) {
      logger.warn('Failed to cache current snapshot', {
        operation: 'cacheCurrentSnapshot',
        snapshot_id: snapshot.snapshot_id,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  /**
   * Perform optimized read of a specific snapshot
   */
  private async performSpecificSnapshotRead(
    snapshotId: string,
    operationId: string
  ): Promise<Snapshot | null> {
    await this.ensureDirectoryExists()

    try {
      const snapshot = await this.readSnapshotFromDirectory(snapshotId)

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
   * Read a snapshot from its directory structure
   */
  private async readSnapshotFromDirectory(
    snapshotId: string
  ): Promise<Snapshot | null> {
    this.validateSnapshotId(snapshotId)

    // Use symlink-safe path resolution - check if metadata file exists
    let metadataPath: string
    try {
      metadataPath = await this.resolveExistingPathUnderBase(
        this.snapshotsDir,
        snapshotId,
        'metadata.json'
      )
    } catch {
      // File doesn't exist or path traversal attempt
      return null
    }

    try {
      await fs.access(metadataPath)
    } catch {
      return null
    }

    const metadata = await this.getSnapshotMetadata(snapshotId)
    const manifest = await this.getSnapshotManifest(snapshotId)

    if (!metadata || !manifest) {
      return null
    }

    // Read all successful district data
    const districts: DistrictStatistics[] = []
    for (const entry of manifest.districts) {
      if (entry.status === 'success') {
        const districtData = await this.readDistrictData(
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
   * Find the latest successful snapshot by scanning the directory
   */
  private async findLatestSuccessfulByScanning(): Promise<Snapshot | null> {
    const startTime = Date.now()

    logger.debug('Starting directory scan for latest successful snapshot', {
      operation: 'findLatestSuccessfulByScanning',
    })

    // Handle missing directory gracefully (Requirements 3.1, 3.3, 3.4)
    try {
      await fs.access(this.snapshotsDir)
    } catch (error: unknown) {
      const fsError = error as { code?: string }
      if (fsError.code === 'ENOENT') {
        logger.debug('Snapshots directory does not exist, returning null', {
          operation: 'findLatestSuccessfulByScanning',
          snapshotsDir: this.snapshotsDir,
        })
        return null
      }
      throw error
    }

    const files = await fs.readdir(this.snapshotsDir)

    // Get directories and sort by date (newest first)
    const snapshotDirs: string[] = []
    for (const file of files) {
      const filePath = path.join(this.snapshotsDir, file)
      const stats = await fs.stat(filePath)
      if (stats.isDirectory()) {
        snapshotDirs.push(file)
      }
    }

    snapshotDirs.sort((a, b) => b.localeCompare(a))

    logger.debug('Scanning snapshot directories for successful status', {
      operation: 'findLatestSuccessfulByScanning',
      total_dirs: snapshotDirs.length,
      dirs_to_scan: snapshotDirs.slice(0, 10),
    })

    for (const dir of snapshotDirs) {
      try {
        const snapshot = await this.readSnapshotFromDirectory(dir)

        logger.debug('Checking snapshot status', {
          operation: 'findLatestSuccessfulByScanning',
          snapshot_id: dir,
          status: snapshot?.status,
        })

        if (snapshot && snapshot.status === 'success') {
          const duration = Date.now() - startTime
          logger.info('Found latest successful snapshot by scanning', {
            operation: 'findLatestSuccessfulByScanning',
            snapshot_id: snapshot.snapshot_id,
            created_at: snapshot.created_at,
            schema_version: snapshot.schema_version,
            calculation_version: snapshot.calculation_version,
            district_count: snapshot.payload.districts.length,
            scanned_dirs: snapshotDirs.indexOf(dir) + 1,
            duration_ms: duration,
          })

          return snapshot
        }
      } catch (error) {
        logger.warn('Failed to read snapshot during scanning', {
          operation: 'findLatestSuccessfulByScanning',
          dir,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        continue
      }
    }

    const duration = Date.now() - startTime
    logger.info('No successful snapshot found during directory scan', {
      operation: 'findLatestSuccessfulByScanning',
      scanned_dirs: snapshotDirs.length,
      duration_ms: duration,
    })

    return null
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(duration: number, cacheHit: boolean): void {
    this.performanceMetrics.totalReads++

    if (cacheHit) {
      this.performanceMetrics.cacheHits++
    } else {
      this.performanceMetrics.cacheMisses++
    }

    const totalTime =
      this.performanceMetrics.averageReadTime *
        (this.performanceMetrics.totalReads - 1) +
      duration
    this.performanceMetrics.averageReadTime =
      totalTime / this.performanceMetrics.totalReads
  }

  /**
   * Get metadata for a per-district snapshot directory (for listing)
   */
  private async getPerDistrictSnapshotMetadataForList(
    snapshotId: string
  ): Promise<SnapshotMetadata> {
    const snapshotDir = path.join(this.snapshotsDir, snapshotId)
    const metadataPath = path.join(snapshotDir, 'metadata.json')
    const manifestPath = path.join(snapshotDir, 'manifest.json')

    const [metadataContent, manifestContent] = await Promise.all([
      fs.readFile(metadataPath, 'utf-8'),
      fs.readFile(manifestPath, 'utf-8'),
    ])

    const metadata: PerDistrictSnapshotMetadata = JSON.parse(metadataContent)
    const manifest: SnapshotManifest = JSON.parse(manifestContent)

    let totalSize = 0
    for (const entry of manifest.districts) {
      totalSize += entry.fileSize
    }

    const metadataStats = await fs.stat(metadataPath)
    const manifestStats = await fs.stat(manifestPath)
    totalSize += metadataStats.size + manifestStats.size

    return {
      snapshot_id: metadata.snapshotId,
      created_at: metadata.createdAt,
      status: metadata.status,
      schema_version: metadata.schemaVersion,
      calculation_version: metadata.calculationVersion,
      size_bytes: totalSize,
      error_count: metadata.errors.length,
      district_count: metadata.successfulDistricts.length,
    }
  }

  /**
   * Extract detailed district error information from snapshot errors
   */
  private extractDistrictErrorsFromSnapshot(snapshot: Snapshot): Array<{
    districtId: string
    operation: string
    error: string
    timestamp: string
    shouldRetry: boolean
  }> {
    const districtErrors: Array<{
      districtId: string
      operation: string
      error: string
      timestamp: string
      shouldRetry: boolean
    }> = []

    for (const error of snapshot.errors) {
      const match = error.match(/^([^:]+):\s*([^-]+)\s*-\s*(.+)$/)
      if (match && match[1] && match[2] && match[3]) {
        const [, districtId, operation, errorMessage] = match
        districtErrors.push({
          districtId: districtId.trim(),
          operation: operation.trim(),
          error: errorMessage.trim(),
          timestamp: snapshot.created_at,
          shouldRetry: !errorMessage.includes('Circuit breaker'),
        })
      }
    }

    return districtErrors
  }

  /**
   * Extract ranking algorithm version from districts with ranking data
   */
  private extractRankingVersion(snapshot: Snapshot): string | undefined {
    for (const district of snapshot.payload.districts) {
      if (district.ranking?.rankingVersion) {
        logger.debug('Extracted ranking version from district data', {
          operation: 'extractRankingVersion',
          snapshot_id: snapshot.snapshot_id,
          ranking_version: district.ranking.rankingVersion,
          district_id: district.districtId,
        })
        return district.ranking.rankingVersion
      }
    }

    logger.debug('No ranking version found in district data', {
      operation: 'extractRankingVersion',
      snapshot_id: snapshot.snapshot_id,
      district_count: snapshot.payload.districts.length,
    })
    return undefined
  }

  /**
   * Generate ISO date-based snapshot directory name from dataAsOfDate
   */
  private generateSnapshotDirectoryName(dataAsOfDate: string): string {
    const date = new Date(dataAsOfDate)
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const day = String(date.getUTCDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
}

// ============================================================================
// Aliases for backward compatibility
// ============================================================================

/**
 * @deprecated Use FileSnapshotStore instead
 */
export const PerDistrictFileSnapshotStore = FileSnapshotStore

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

/**
 * Factory function to create a PerDistrictFileSnapshotStore
 * @deprecated Use createFileSnapshotStore instead
 */
export function createPerDistrictSnapshotStore(
  cacheDir?: string
): FileSnapshotStore {
  return createFileSnapshotStore(cacheDir)
}
