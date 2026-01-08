/**
 * Per-district snapshot store implementation
 *
 * Extends FileSnapshotStore to provide directory-based storage where each
 * snapshot is stored as a directory containing individual JSON files per district.
 *
 * Storage structure:
 * CACHE_DIR/
 * ├── snapshots/
 * │   ├── 1704067200000/                    # Snapshot directory
 * │   │   ├── metadata.json                 # Snapshot-level metadata
 * │   │   ├── manifest.json                 # List of district files
 * │   │   ├── district_42.json              # District 42 data
 * │   │   ├── district_15.json              # District 15 data
 * │   │   └── district_F.json               # District F data
 * │   └── 1704153600000/                    # Another snapshot
 * │       ├── metadata.json
 * │       ├── manifest.json
 * │       └── district_*.json
 * ├── current.json                          # Points to latest successful snapshot
 * └── config/
 *     └── districts.json                    # District configuration
 */

import fs from 'fs/promises'
import path from 'path'
import { logger } from '../utils/logger.js'
import { FileSnapshotStore } from './FileSnapshotStore.js'
import {
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

  // Closing period tracking fields (Requirements 2.6, 4.1, 4.2, 4.3)

  /**
   * Indicates whether this snapshot contains closing period data.
   * True when the data month differs from the "As of" date month.
   */
  isClosingPeriodData?: boolean

  /**
   * The actual date when the CSV data was collected (the "As of" date from the CSV).
   * Preserved for transparency even when snapshot is dated differently.
   * Format: YYYY-MM-DD
   */
  collectionDate?: string

  /**
   * The logical date this snapshot represents.
   * For closing period data, this is the last day of the data month.
   * For normal data, this equals the dataAsOfDate.
   * Format: YYYY-MM-DD
   */
  logicalDate?: string
}

/**
 * Options for writing snapshots
 */
export interface WriteSnapshotOptions {
  /** If true, don't update current.json (useful for backfill operations) */
  skipCurrentPointerUpdate?: boolean

  /**
   * Override the snapshot directory date.
   * When provided, this date is used for the snapshot directory name
   * instead of the dataAsOfDate from the snapshot metadata.
   * Used for closing period data where the snapshot should be dated
   * as the last day of the data month.
   * Format: YYYY-MM-DD
   */
  overrideSnapshotDate?: string
}

/**
 * Result of comparing a new snapshot's collection date against an existing snapshot
 * Used to determine whether a closing period snapshot should be updated
 *
 * Requirements: 2.2, 2.3, 2.4
 */
export interface SnapshotComparisonResult {
  /** Whether the snapshot should be updated with the new data */
  shouldUpdate: boolean
  /** Reason for the decision */
  reason:
    | 'no_existing'
    | 'newer_data'
    | 'same_day_refresh'
    | 'existing_is_newer'
  /** Collection date of the existing snapshot (if any) */
  existingCollectionDate?: string
  /** Collection date of the new data */
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
export interface PerDistrictSnapshotStore {
  /**
   * Write district data to a snapshot
   */
  writeDistrictData(
    snapshotId: string,
    districtId: string,
    data: DistrictStatistics
  ): Promise<void>

  /**
   * Read district data from a snapshot
   */
  readDistrictData(
    snapshotId: string,
    districtId: string
  ): Promise<DistrictStatistics | null>

  /**
   * List all districts in a snapshot
   */
  listDistrictsInSnapshot(snapshotId: string): Promise<string[]>

  /**
   * Get snapshot manifest
   */
  getSnapshotManifest(snapshotId: string): Promise<SnapshotManifest | null>

  /**
   * Get snapshot metadata
   */
  getSnapshotMetadata(
    snapshotId: string
  ): Promise<PerDistrictSnapshotMetadata | null>

  /**
   * Check version compatibility for historical snapshots
   */
  checkVersionCompatibility(snapshotId: string): Promise<{
    isCompatible: boolean
    schemaCompatible: boolean
    calculationCompatible: boolean
    rankingCompatible: boolean
    warnings: string[]
  }>

  /**
   * Compare a new snapshot's collection date against an existing snapshot
   * to determine if the snapshot should be updated.
   *
   * Used for closing period snapshots where we only want to update if
   * the new data has a newer or equal collection date.
   *
   * Requirements: 2.2, 2.3, 2.4
   *
   * @param snapshotDate - The snapshot date (directory name) to check
   * @param newCollectionDate - The collection date of the new data
   * @returns Comparison result indicating whether to update
   */
  shouldUpdateClosingPeriodSnapshot(
    snapshotDate: string,
    newCollectionDate: string
  ): Promise<SnapshotComparisonResult>
}

/**
 * Per-district file-based snapshot store implementation
 *
 * Provides directory-based snapshot storage with individual district files
 * while maintaining compatibility with the existing FileSnapshotStore interface.
 */
export class PerDistrictFileSnapshotStore
  extends FileSnapshotStore
  implements PerDistrictSnapshotStore
{
  private readonly perDistrictSnapshotsDir: string
  private readonly perDistrictCurrentPointerFile: string

  constructor(config: SnapshotStoreConfig) {
    super(config)
    this.perDistrictSnapshotsDir = path.join(config.cacheDir, 'snapshots')
    this.perDistrictCurrentPointerFile = path.join(
      config.cacheDir,
      'current.json'
    )
  }

  /**
   * Write a snapshot using per-district directory structure
   *
   * @param snapshot - The snapshot to write
   * @param allDistrictsRankings - Optional all-districts rankings data to include
   * @param options - Optional write options
   * @param options.skipCurrentPointerUpdate - If true, don't update current.json (useful for backfill operations)
   * @param options.overrideSnapshotDate - If provided, use this date for the snapshot directory name instead of dataAsOfDate
   */
  override async writeSnapshot(
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
      await fs.mkdir(this.perDistrictSnapshotsDir, { recursive: true })

      // Generate ISO date-based directory name
      // Use override date if provided (for closing period data), otherwise use dataAsOfDate
      const snapshotDirName = options?.overrideSnapshotDate
        ? this.generateSnapshotDirectoryName(options.overrideSnapshotDate)
        : this.generateSnapshotDirectoryName(
            snapshot.payload.metadata.dataAsOfDate
          )
      const snapshotDir = path.join(
        this.perDistrictSnapshotsDir,
        snapshotDirName
      )

      // Create snapshot directory (overwrite if exists for same date)
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

          // Add rankings file to manifest
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
          // Fail entire operation if rankings write fails
          throw new Error(
            `Failed to write all-districts rankings: ${errorMessage}`
          )
        }
      } else {
        // No rankings provided, mark as missing in manifest
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

      // Write metadata.json with enhanced error tracking
      const districtErrorsFromSnapshot =
        this.extractDistrictErrorsFromSnapshot(snapshot)

      // Extract ranking version from all-districts rankings if provided, otherwise from district data
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
        // Closing period tracking fields (Requirements 2.6, 4.1, 4.2, 4.3)
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

      // Update current pointer if this is a successful snapshot and not skipped
      if (snapshot.status === 'success' && !options?.skipCurrentPointerUpdate) {
        // Update snapshot_id to match directory name for pointer
        const snapshotWithUpdatedId = {
          ...snapshot,
          snapshot_id: snapshotDirName,
        }
        await this.updatePerDistrictCurrentPointer(snapshotWithUpdatedId)

        logger.info(
          'Current pointer updated for successful per-district snapshot',
          {
            operation: 'writeSnapshot',
            snapshot_id: snapshotDirName,
            pointer_file: this.perDistrictCurrentPointerFile,
          }
        )
      } else if (options?.skipCurrentPointerUpdate) {
        logger.info(
          'Skipping current pointer update as requested (backfill mode)',
          {
            operation: 'writeSnapshot',
            snapshot_id: snapshotDirName,
            status: snapshot.status,
          }
        )
      } else {
        logger.info(
          'Skipping current pointer update for non-successful per-district snapshot',
          {
            operation: 'writeSnapshot',
            snapshot_id: snapshotDirName,
            status: snapshot.status,
          }
        )
      }

      // Note: Cleanup is handled by parent class during normal operations

      const duration = Date.now() - startTime
      logger.info(
        'Per-district snapshot write operation completed successfully',
        {
          operation: 'writeSnapshot',
          snapshot_id: snapshotDirName,
          status: snapshot.status,
          successful_districts: successfulDistricts,
          failed_districts: failedDistricts,
          duration_ms: duration,
        }
      )
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to write per-district snapshot', {
        operation: 'writeSnapshot',
        snapshot_id: snapshot.snapshot_id,
        error: errorMessage,
        duration_ms: duration,
      })
      throw new Error(`Failed to write per-district snapshot: ${errorMessage}`)
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
    const snapshotDir = path.join(this.perDistrictSnapshotsDir, snapshotId)
    const districtFile = path.join(snapshotDir, `district_${districtId}.json`)

    const perDistrictData: PerDistrictData = {
      districtId,
      districtName: `District ${districtId}`, // TODO: Get actual name from data
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
   * Creates all-districts-rankings.json file with rankings data and metadata
   *
   * @param snapshotId - The snapshot ID (ISO date format)
   * @param rankingsData - The all-districts rankings data to write
   */
  async writeAllDistrictsRankings(
    snapshotId: string,
    rankingsData: AllDistrictsRankingsData
  ): Promise<void> {
    const snapshotDir = path.join(this.perDistrictSnapshotsDir, snapshotId)
    const rankingsFile = path.join(snapshotDir, 'all-districts-rankings.json')

    // Update the snapshotId in metadata to match the actual snapshot directory
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
   * Returns null if the rankings file doesn't exist
   *
   * @param snapshotId - The snapshot ID (ISO date format)
   * @returns The all-districts rankings data, or null if not found
   */
  async readAllDistrictsRankings(
    snapshotId: string
  ): Promise<AllDistrictsRankingsData | null> {
    try {
      const snapshotDir = path.join(this.perDistrictSnapshotsDir, snapshotId)
      const rankingsFile = path.join(snapshotDir, 'all-districts-rankings.json')

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
   *
   * @param snapshotId - The snapshot ID (ISO date format)
   * @returns True if the rankings file exists, false otherwise
   */
  async hasAllDistrictsRankings(snapshotId: string): Promise<boolean> {
    try {
      const snapshotDir = path.join(this.perDistrictSnapshotsDir, snapshotId)
      const rankingsFile = path.join(snapshotDir, 'all-districts-rankings.json')

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
      const snapshotDir = path.join(this.perDistrictSnapshotsDir, snapshotId)
      const districtFile = path.join(snapshotDir, `district_${districtId}.json`)

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
      const snapshotDir = path.join(this.perDistrictSnapshotsDir, snapshotId)
      const manifestPath = path.join(snapshotDir, 'manifest.json')

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
      const snapshotDir = path.join(this.perDistrictSnapshotsDir, snapshotId)
      const metadataPath = path.join(snapshotDir, 'metadata.json')

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
   * Get the most recent successful snapshot with per-district support
   */
  override async getLatestSuccessful(): Promise<Snapshot | null> {
    try {
      // Try to read from current.json pointer first
      try {
        const pointerContent = await fs.readFile(
          this.perDistrictCurrentPointerFile,
          'utf-8'
        )
        const pointer = JSON.parse(pointerContent)

        // Try to get the snapshot referenced by the pointer
        const snapshot = await this.getSnapshot(pointer.snapshot_id)
        if (snapshot && snapshot.status === 'success') {
          return snapshot
        }
      } catch (error) {
        // Pointer file doesn't exist or is corrupted, fall back to scanning
        logger.debug(
          'Current pointer read failed, scanning for latest successful',
          {
            operation: 'getLatestSuccessful',
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        )
      }

      // Fall back to scanning directories for latest successful snapshot
      await fs.mkdir(this.perDistrictSnapshotsDir, { recursive: true })
      const files = await fs.readdir(this.perDistrictSnapshotsDir)

      // Get directories (per-district snapshots) and sort by timestamp (newest first)
      const snapshotDirs: string[] = []
      for (const file of files) {
        const filePath = path.join(this.perDistrictSnapshotsDir, file)
        const stats = await fs.stat(filePath)
        if (stats.isDirectory()) {
          snapshotDirs.push(file)
        }
      }

      snapshotDirs.sort((a, b) => {
        const timestampA = parseInt(a)
        const timestampB = parseInt(b)
        return timestampB - timestampA // Newest first
      })

      // Check each directory for successful snapshots
      for (const dir of snapshotDirs) {
        try {
          const snapshot = await this.getSnapshot(dir)
          if (snapshot && snapshot.status === 'success') {
            // Update the current pointer to this snapshot
            await this.updatePerDistrictCurrentPointer(snapshot)
            return snapshot
          }
        } catch (error) {
          // Skip corrupted snapshots
          logger.warn('Failed to read snapshot during scanning', {
            operation: 'getLatestSuccessful',
            snapshot_id: dir,
            error: error instanceof Error ? error.message : 'Unknown error',
          })
          continue
        }
      }

      // No successful snapshots found
      return null
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to get latest successful snapshot', {
        operation: 'getLatestSuccessful',
        error: errorMessage,
      })
      throw new Error(
        `Failed to get latest successful snapshot: ${errorMessage}`
      )
    }
  }

  /**
   * Read a snapshot from per-district directory structure
   * This method aggregates individual district files back into a single Snapshot object
   * for backward compatibility with existing code
   */
  override async getSnapshot(snapshotId: string): Promise<Snapshot | null> {
    try {
      const snapshotDir = path.join(this.perDistrictSnapshotsDir, snapshotId)

      // Check if this is a per-district snapshot (has metadata.json)
      const metadataPath = path.join(snapshotDir, 'metadata.json')
      try {
        await fs.access(metadataPath)
      } catch {
        // Not a per-district snapshot, fall back to parent implementation
        return await super.getSnapshot(snapshotId)
      }

      // Read metadata and manifest
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
          // Restore closing period tracking fields (Requirements 2.6, 4.1, 4.2, 4.3)
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
        operation: 'getSnapshot',
        snapshot_id: snapshotId,
        district_count: districts.length,
        status: snapshot.status,
      })

      return snapshot
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to read per-district snapshot', {
        operation: 'getSnapshot',
        snapshot_id: snapshotId,
        error: errorMessage,
      })
      throw new Error(`Failed to read per-district snapshot: ${errorMessage}`)
    }
  }

  /**
   * List snapshots with support for both old and new formats
   */
  override async listSnapshots(
    limit?: number,
    filters?: SnapshotFilters
  ): Promise<SnapshotMetadata[]> {
    try {
      await fs.mkdir(this.perDistrictSnapshotsDir, { recursive: true })

      const files = await fs.readdir(this.perDistrictSnapshotsDir)

      // Separate directories (new format) from files (old format)
      const snapshotDirs: string[] = []
      const snapshotFiles: string[] = []

      for (const file of files) {
        const filePath = path.join(this.perDistrictSnapshotsDir, file)
        const stats = await fs.stat(filePath)

        if (stats.isDirectory()) {
          snapshotDirs.push(file)
        } else if (file.endsWith('.json')) {
          snapshotFiles.push(file)
        }
      }

      const metadataPromises: Promise<SnapshotMetadata>[] = []

      // Process new format (directories)
      for (const dir of snapshotDirs) {
        metadataPromises.push(this.getPerDistrictSnapshotMetadata(dir))
      }

      // Process old format (files) - delegate to parent
      for (const file of snapshotFiles) {
        metadataPromises.push(this.getFileSnapshotMetadata(file))
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
   * Get metadata for a per-district snapshot directory
   */
  private async getPerDistrictSnapshotMetadata(
    snapshotId: string
  ): Promise<SnapshotMetadata> {
    const snapshotDir = path.join(this.perDistrictSnapshotsDir, snapshotId)
    const metadataPath = path.join(snapshotDir, 'metadata.json')
    const manifestPath = path.join(snapshotDir, 'manifest.json')

    const [metadataContent, manifestContent] = await Promise.all([
      fs.readFile(metadataPath, 'utf-8'),
      fs.readFile(manifestPath, 'utf-8'),
    ])

    const metadata: PerDistrictSnapshotMetadata = JSON.parse(metadataContent)
    const manifest: SnapshotManifest = JSON.parse(manifestContent)

    // Calculate total size of all district files
    let totalSize = 0
    for (const entry of manifest.districts) {
      totalSize += entry.fileSize
    }

    // Add metadata and manifest file sizes
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
   * Get metadata for an old-format snapshot file
   */
  private async getFileSnapshotMetadata(
    file: string
  ): Promise<SnapshotMetadata> {
    const filePath = path.join(this.perDistrictSnapshotsDir, file)
    const stats = await fs.stat(filePath)
    const content = await fs.readFile(filePath, 'utf-8')
    const snapshot: Snapshot = JSON.parse(content)

    return {
      snapshot_id: snapshot.snapshot_id,
      created_at: snapshot.created_at,
      status: snapshot.status,
      schema_version: snapshot.schema_version,
      calculation_version: snapshot.calculation_version,
      size_bytes: stats.size,
      error_count: snapshot.errors.length,
      district_count: snapshot.payload.districts.length,
    }
  }

  /**
   * Update the current snapshot pointer atomically
   */
  private async updatePerDistrictCurrentPointer(
    snapshot: Snapshot
  ): Promise<void> {
    const startTime = Date.now()
    logger.debug('Starting current pointer update', {
      operation: 'updateCurrentPointer',
      snapshot_id: snapshot.snapshot_id,
      status: snapshot.status,
    })

    const pointer = {
      snapshot_id: snapshot.snapshot_id,
      updated_at: new Date().toISOString(),
      schema_version: snapshot.schema_version,
      calculation_version: snapshot.calculation_version,
    }

    const tempPath = `${this.perDistrictCurrentPointerFile}.tmp`

    try {
      // Write to temporary file first for atomic operation
      await fs.writeFile(tempPath, JSON.stringify(pointer, null, 2), 'utf-8')

      // Atomically rename to final location
      await fs.rename(tempPath, this.perDistrictCurrentPointerFile)

      const duration = Date.now() - startTime
      logger.info('Current pointer updated successfully', {
        operation: 'updateCurrentPointer',
        snapshot_id: snapshot.snapshot_id,
        updated_at: pointer.updated_at,
        schema_version: pointer.schema_version,
        calculation_version: pointer.calculation_version,
        duration_ms: duration,
      })
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to update current pointer', {
        operation: 'updateCurrentPointer',
        snapshot_id: snapshot.snapshot_id,
        error: errorMessage,
        duration_ms: duration,
      })
      throw error
    }
  }

  /**
   * Set the current snapshot pointer to a specific snapshot ID
   * This is useful for backfill operations where we want to set the current
   * pointer to the most recent date after all snapshots are written.
   *
   * @param snapshotId - The snapshot ID (ISO date format) to set as current
   */
  async setCurrentSnapshot(snapshotId: string): Promise<void> {
    logger.info('Setting current snapshot pointer', {
      operation: 'setCurrentSnapshot',
      snapshot_id: snapshotId,
    })

    // Verify the snapshot exists
    const snapshot = await this.getSnapshot(snapshotId)
    if (!snapshot) {
      throw new Error(`Snapshot ${snapshotId} not found`)
    }

    if (snapshot.status !== 'success' && snapshot.status !== 'partial') {
      logger.warn('Setting current pointer to non-successful snapshot', {
        operation: 'setCurrentSnapshot',
        snapshot_id: snapshotId,
        status: snapshot.status,
      })
    }

    await this.updatePerDistrictCurrentPointer(snapshot)

    logger.info('Current snapshot pointer set successfully', {
      operation: 'setCurrentSnapshot',
      snapshot_id: snapshotId,
    })
  }

  /**
   * Extract detailed district error information from snapshot errors
   * Parses error messages to reconstruct district-level error details for retry logic
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

    // Parse error messages that follow the pattern: "DistrictId: operation - error"
    for (const error of snapshot.errors) {
      const match = error.match(/^([^:]+):\s*([^-]+)\s*-\s*(.+)$/)
      if (match && match[1] && match[2] && match[3]) {
        const [, districtId, operation, errorMessage] = match
        districtErrors.push({
          districtId: districtId.trim(),
          operation: operation.trim(),
          error: errorMessage.trim(),
          timestamp: snapshot.created_at,
          shouldRetry: !errorMessage.includes('Circuit breaker'), // Don't retry circuit breaker errors immediately
        })
      }
    }

    return districtErrors
  }

  /**
   * Extract ranking algorithm version from districts with ranking data
   * Returns the ranking version if any districts have ranking data, undefined otherwise
   */
  private extractRankingVersion(snapshot: Snapshot): string | undefined {
    // Look for districts with ranking data
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

    // No ranking data found
    logger.debug('No ranking version found in district data', {
      operation: 'extractRankingVersion',
      snapshot_id: snapshot.snapshot_id,
      district_count: snapshot.payload.districts.length,
    })
    return undefined
  }

  /**
   * Check version compatibility for historical snapshots
   * Validates that the snapshot metadata versions are compatible with current system
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
      let calculationCompatible = true
      let rankingCompatible = true

      // Check schema version compatibility
      // For now, we only support exact schema version matches
      if (metadata.schemaVersion !== this.getCurrentSchemaVersion()) {
        schemaCompatible = false
        warnings.push(
          `Schema version mismatch: snapshot has ${metadata.schemaVersion}, current is ${this.getCurrentSchemaVersion()}`
        )
      }

      // Check calculation version compatibility
      // Different calculation versions are acceptable but should be noted
      if (metadata.calculationVersion !== this.getCurrentCalculationVersion()) {
        warnings.push(
          `Calculation version difference: snapshot has ${metadata.calculationVersion}, current is ${this.getCurrentCalculationVersion()}`
        )
      }

      // Check ranking version compatibility
      // Missing ranking version is acceptable for historical snapshots
      if (metadata.rankingVersion) {
        // If ranking version exists, check if it's different from current
        // This would require access to current ranking calculator version
        // For now, just note the version
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
   * to determine if the snapshot should be updated.
   *
   * Used for closing period snapshots where we only want to update if
   * the new data has a newer or equal collection date.
   *
   * Requirements: 2.2, 2.3, 2.4
   * - 2.2: Create snapshot if no snapshot exists for that date
   * - 2.3: Overwrite if existing snapshot has older or equal collection date
   * - 2.4: Do NOT overwrite if existing snapshot has newer collection date
   *
   * @param snapshotDate - The snapshot date (directory name) to check
   * @param newCollectionDate - The collection date of the new data
   * @returns Comparison result indicating whether to update
   */
  async shouldUpdateClosingPeriodSnapshot(
    snapshotDate: string,
    newCollectionDate: string
  ): Promise<SnapshotComparisonResult> {
    try {
      // Try to read existing snapshot metadata
      const existingMetadata = await this.getSnapshotMetadata(snapshotDate)

      if (!existingMetadata) {
        // No existing snapshot - should create new one (Requirement 2.2)
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

      // Get the existing collection date
      // Use collectionDate if available (closing period data), otherwise fall back to dataAsOfDate
      const existingCollectionDate =
        existingMetadata.collectionDate ?? existingMetadata.dataAsOfDate

      // Compare dates
      const existingDate = new Date(existingCollectionDate)
      const newDate = new Date(newCollectionDate)

      if (newDate > existingDate) {
        // New data is strictly newer - should update (Requirement 2.3)
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
        // Same collection date - allow update for same-day refresh (Requirement 2.3)
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
        // Existing snapshot has newer collection date - do NOT update (Requirement 2.4)
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

      // If we can't read existing metadata, treat as no existing snapshot
      // This allows recovery from corrupted metadata
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
   * Get current schema version (delegated to parent class method)
   */
  private getCurrentSchemaVersion(): string {
    return CURRENT_SCHEMA_VERSION
  }

  /**
   * Get current calculation version (delegated to parent class method)
   */
  private getCurrentCalculationVersion(): string {
    return CURRENT_CALCULATION_VERSION
  }

  /**
   * Generate ISO date-based snapshot directory name from dataAsOfDate
   * Converts a date string to YYYY-MM-DD format for snapshot directory naming
   *
   * @param dataAsOfDate - The date string to convert (ISO 8601 format)
   * @returns Directory name in YYYY-MM-DD format
   */
  private generateSnapshotDirectoryName(dataAsOfDate: string): string {
    const date = new Date(dataAsOfDate)
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const day = String(date.getUTCDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
}

/**
 * Factory function to create a PerDistrictFileSnapshotStore
 */
export function createPerDistrictSnapshotStore(
  cacheDir?: string
): PerDistrictFileSnapshotStore {
  const resolvedCacheDir = cacheDir || process.env['CACHE_DIR'] || './cache'

  return new PerDistrictFileSnapshotStore({
    cacheDir: resolvedCacheDir,
    maxSnapshots: 100,
    maxAgeDays: 30,
    enableCompression: false,
  })
}
