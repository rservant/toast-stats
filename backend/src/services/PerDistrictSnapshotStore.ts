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
}

/**
 * Per-district snapshot metadata with enhanced error tracking
 */
export interface PerDistrictSnapshotMetadata {
  snapshotId: string
  createdAt: string
  schemaVersion: string
  calculationVersion: string
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
   */
  async writeSnapshot(snapshot: Snapshot): Promise<void> {
    const startTime = Date.now()
    logger.info('Starting per-district snapshot write operation', {
      operation: 'writeSnapshot',
      snapshot_id: snapshot.snapshot_id,
      status: snapshot.status,
      schema_version: snapshot.schema_version,
      calculation_version: snapshot.calculation_version,
      district_count: snapshot.payload.districts.length,
      error_count: snapshot.errors.length,
    })

    try {
      await fs.mkdir(this.perDistrictSnapshotsDir, { recursive: true })

      const snapshotDir = path.join(
        this.perDistrictSnapshotsDir,
        snapshot.snapshot_id
      )

      // Create snapshot directory
      await fs.mkdir(snapshotDir, { recursive: true })

      logger.debug('Created snapshot directory', {
        operation: 'writeSnapshot',
        snapshot_id: snapshot.snapshot_id,
        snapshot_dir: snapshotDir,
      })

      // Write individual district files
      const manifestEntries: DistrictManifestEntry[] = []
      let successfulDistricts = 0
      let failedDistricts = 0

      for (const district of snapshot.payload.districts) {
        try {
          await this.writeDistrictData(
            snapshot.snapshot_id,
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
            snapshot_id: snapshot.snapshot_id,
            district_id: district.districtId,
            error: errorMessage,
          })
        }
      }

      // Write manifest.json
      const manifest: SnapshotManifest = {
        snapshotId: snapshot.snapshot_id,
        createdAt: snapshot.created_at,
        districts: manifestEntries,
        totalDistricts: snapshot.payload.districts.length,
        successfulDistricts,
        failedDistricts,
      }

      const manifestPath = path.join(snapshotDir, 'manifest.json')
      await fs.writeFile(
        manifestPath,
        JSON.stringify(manifest, null, 2),
        'utf-8'
      )

      logger.debug('Wrote snapshot manifest', {
        operation: 'writeSnapshot',
        snapshot_id: snapshot.snapshot_id,
        manifest_path: manifestPath,
        total_districts: manifest.totalDistricts,
        successful_districts: manifest.successfulDistricts,
        failed_districts: manifest.failedDistricts,
      })

      // Write metadata.json with enhanced error tracking
      const districtErrorsFromSnapshot =
        this.extractDistrictErrorsFromSnapshot(snapshot)

      const metadata: PerDistrictSnapshotMetadata = {
        snapshotId: snapshot.snapshot_id,
        createdAt: snapshot.created_at,
        schemaVersion: snapshot.schema_version,
        calculationVersion: snapshot.calculation_version,
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
      }

      const metadataPath = path.join(snapshotDir, 'metadata.json')
      await fs.writeFile(
        metadataPath,
        JSON.stringify(metadata, null, 2),
        'utf-8'
      )

      logger.debug('Wrote snapshot metadata', {
        operation: 'writeSnapshot',
        snapshot_id: snapshot.snapshot_id,
        metadata_path: metadataPath,
        processing_duration: metadata.processingDuration,
      })

      // Update current pointer if this is a successful snapshot
      if (snapshot.status === 'success') {
        await this.updatePerDistrictCurrentPointer(snapshot)

        logger.info(
          'Current pointer updated for successful per-district snapshot',
          {
            operation: 'writeSnapshot',
            snapshot_id: snapshot.snapshot_id,
            pointer_file: this.perDistrictCurrentPointerFile,
          }
        )
      } else {
        logger.info(
          'Skipping current pointer update for non-successful per-district snapshot',
          {
            operation: 'writeSnapshot',
            snapshot_id: snapshot.snapshot_id,
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
          snapshot_id: snapshot.snapshot_id,
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
  async getLatestSuccessful(): Promise<Snapshot | null> {
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
  async getSnapshot(snapshotId: string): Promise<Snapshot | null> {
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
  async listSnapshots(
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
      if (match) {
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
}

/**
 * Factory function to create a PerDistrictFileSnapshotStore
 */
export function createPerDistrictSnapshotStore(
  cacheDir?: string
): PerDistrictFileSnapshotStore {
  const resolvedCacheDir = cacheDir || process.env.CACHE_DIR || './cache'

  return new PerDistrictFileSnapshotStore({
    cacheDir: resolvedCacheDir,
    maxSnapshots: 100,
    maxAgeDays: 30,
    enableCompression: false,
  })
}
