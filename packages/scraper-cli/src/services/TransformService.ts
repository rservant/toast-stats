/**
 * TransformService - Transforms raw CSV files into snapshot format.
 *
 * This service reads raw CSV files from the cache directory and transforms
 * them into the snapshot format used by the backend for analytics computation.
 *
 * Requirements:
 * - 2.2: WHEN transforming raw CSVs, THE Scraper_CLI SHALL use the same
 *        DataTransformationService logic as the Backend
 * - 2.3: THE Scraper_CLI SHALL store snapshots in the same directory structure
 *        as the Backend expects: `CACHE_DIR/snapshots/{date}/`
 * - 2.4: WHEN a snapshot is created, THE Scraper_CLI SHALL write district JSON
 *        files, metadata.json, and manifest.json
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import { parse } from 'csv-parse/sync'
import {
  DataTransformer,
  ANALYTICS_SCHEMA_VERSION,
  type Logger,
  type RawCSVData,
} from '@toastmasters/analytics-core'

/**
 * Configuration for TransformService
 */
export interface TransformServiceConfig {
  /** Base cache directory */
  cacheDir: string
  /** Optional logger for diagnostic output */
  logger?: Logger
}

/**
 * Options for transform operation
 */
export interface TransformOperationOptions {
  /** Target date in YYYY-MM-DD format */
  date: string
  /** Specific districts to transform (if not provided, transforms all available) */
  districts?: string[]
  /** Force re-transform even if snapshots exist */
  force?: boolean
  /** Enable verbose logging */
  verbose?: boolean
}

/**
 * Result of transforming a single district
 */
export interface DistrictTransformResult {
  districtId: string
  success: boolean
  snapshotPath?: string
  error?: string
  skipped?: boolean
}

/**
 * Result of the transform operation
 */
export interface TransformOperationResult {
  success: boolean
  date: string
  districtsProcessed: string[]
  districtsSucceeded: string[]
  districtsFailed: string[]
  districtsSkipped: string[]
  snapshotLocations: string[]
  errors: Array<{
    districtId: string
    error: string
    timestamp: string
  }>
  duration_ms: number
}

/**
 * District manifest entry - compatible with backend's DistrictManifestEntry
 */
interface DistrictManifestEntry {
  districtId: string
  fileName: string
  status: 'success' | 'failed'
  fileSize: number
  lastModified: string
  errorMessage?: string
}

/**
 * Snapshot manifest structure - compatible with backend's SnapshotManifest
 */
interface SnapshotManifest {
  snapshotId: string
  createdAt: string
  districts: DistrictManifestEntry[]
  totalDistricts: number
  successfulDistricts: number
  failedDistricts: number
}

/**
 * Snapshot metadata structure
 * Must be compatible with backend's PerDistrictSnapshotMetadata interface
 */
interface SnapshotMetadataFile {
  /** Snapshot ID (date in YYYY-MM-DD format) */
  snapshotId: string
  /** ISO timestamp when snapshot was created */
  createdAt: string
  /** Schema version for data structure compatibility */
  schemaVersion: string
  /** Calculation version for business logic compatibility */
  calculationVersion: string
  /** Status of the snapshot - required for backend compatibility */
  status: 'success' | 'partial' | 'failed'
  /** Districts that were configured for processing */
  configuredDistricts: string[]
  /** Districts that were successfully processed */
  successfulDistricts: string[]
  /** Districts that failed processing */
  failedDistricts: string[]
  /** Error messages (empty array for success) */
  errors: string[]
  /** Processing duration in milliseconds */
  processingDuration: number
  /** Source of the snapshot */
  source: 'scraper-cli'
  /** Date the data represents (same as snapshotId for scraper-cli) */
  dataAsOfDate: string
}

/**
 * Default no-op logger
 */
const noopLogger: Logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
}

/**
 * TransformService transforms raw CSV files into snapshot format.
 *
 * The service reads CSV files from the raw-csv cache directory structure:
 *   CACHE_DIR/raw-csv/{date}/district-{id}/club-performance.csv
 *   CACHE_DIR/raw-csv/{date}/district-{id}/division-performance.csv
 *   CACHE_DIR/raw-csv/{date}/district-{id}/district-performance.csv
 *
 * And writes snapshots to:
 *   CACHE_DIR/snapshots/{date}/district_{id}.json
 *   CACHE_DIR/snapshots/{date}/metadata.json
 *   CACHE_DIR/snapshots/{date}/manifest.json
 */
export class TransformService {
  private readonly cacheDir: string
  private readonly logger: Logger
  private readonly dataTransformer: DataTransformer

  constructor(config: TransformServiceConfig) {
    this.cacheDir = config.cacheDir
    this.logger = config.logger ?? noopLogger
    this.dataTransformer = new DataTransformer({ logger: this.logger })
  }

  /**
   * Get the raw CSV directory path for a date
   */
  private getRawCsvDir(date: string): string {
    return path.join(this.cacheDir, 'raw-csv', date)
  }

  /**
   * Get the snapshot directory path for a date
   */
  private getSnapshotDir(date: string): string {
    return path.join(this.cacheDir, 'snapshots', date)
  }

  /**
   * Get the district snapshot file path
   */
  private getDistrictSnapshotPath(date: string, districtId: string): string {
    return path.join(this.getSnapshotDir(date), `district_${districtId}.json`)
  }

  /**
   * Parse CSV content into 2D array format expected by DataTransformer
   */
  private parseCSVToArray(csvContent: string): string[][] {
    try {
      const records = parse(csvContent, {
        skip_empty_lines: false,
        trim: true,
        relax_column_count: true,
        relax_quotes: true,
      }) as string[][]
      return records
    } catch (error) {
      this.logger.error('Failed to parse CSV content', error)
      throw new Error(
        `CSV parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Read raw CSV file and return content
   */
  private async readCSVFile(filePath: string): Promise<string | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      return content
    } catch (error) {
      const err = error as { code?: string }
      if (err.code === 'ENOENT') {
        return null
      }
      throw error
    }
  }

  /**
   * Load raw CSV data for a district
   */
  private async loadRawCSVData(
    date: string,
    districtId: string
  ): Promise<RawCSVData | null> {
    const districtDir = path.join(
      this.getRawCsvDir(date),
      `district-${districtId}`
    )

    // Check if district directory exists
    try {
      await fs.access(districtDir)
    } catch {
      this.logger.debug('District directory not found', {
        date,
        districtId,
        districtDir,
      })
      return null
    }

    // Read CSV files
    const clubPerformancePath = path.join(districtDir, 'club-performance.csv')
    const divisionPerformancePath = path.join(
      districtDir,
      'division-performance.csv'
    )
    const districtPerformancePath = path.join(
      districtDir,
      'district-performance.csv'
    )

    const clubContent = await this.readCSVFile(clubPerformancePath)
    const divisionContent = await this.readCSVFile(divisionPerformancePath)
    const districtContent = await this.readCSVFile(districtPerformancePath)

    // At minimum, we need club performance data
    if (!clubContent) {
      this.logger.warn('Club performance CSV not found', {
        date,
        districtId,
        path: clubPerformancePath,
      })
      return null
    }

    const rawData: RawCSVData = {
      clubPerformance: this.parseCSVToArray(clubContent),
    }

    if (divisionContent) {
      rawData.divisionPerformance = this.parseCSVToArray(divisionContent)
    }

    if (districtContent) {
      rawData.districtPerformance = this.parseCSVToArray(districtContent)
    }

    return rawData
  }

  /**
   * Discover available districts from raw CSV cache
   */
  async discoverAvailableDistricts(date: string): Promise<string[]> {
    const rawCsvDir = this.getRawCsvDir(date)
    const districts: string[] = []

    try {
      const entries = await fs.readdir(rawCsvDir, { withFileTypes: true })

      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith('district-')) {
          const districtId = entry.name.replace('district-', '')
          districts.push(districtId)
        }
      }

      districts.sort((a, b) => {
        const numA = parseInt(a, 10)
        const numB = parseInt(b, 10)
        if (!isNaN(numA) && !isNaN(numB)) {
          return numA - numB
        }
        return a.localeCompare(b)
      })

      return districts
    } catch (error) {
      const err = error as { code?: string }
      if (err.code === 'ENOENT') {
        this.logger.warn('Raw CSV directory not found', { date, rawCsvDir })
        return []
      }
      throw error
    }
  }

  /**
   * Check if snapshot already exists for a district
   */
  async snapshotExists(date: string, districtId: string): Promise<boolean> {
    const snapshotPath = this.getDistrictSnapshotPath(date, districtId)
    try {
      await fs.access(snapshotPath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Transform a single district's raw CSV data into snapshot format
   */
  async transformDistrict(
    date: string,
    districtId: string,
    options?: { force?: boolean }
  ): Promise<DistrictTransformResult> {
    const force = options?.force ?? false

    this.logger.info('Transforming district', { date, districtId, force })

    // Check if snapshot already exists (unless force is true)
    if (!force) {
      const exists = await this.snapshotExists(date, districtId)
      if (exists) {
        this.logger.info('Snapshot already exists, skipping', {
          date,
          districtId,
        })
        return {
          districtId,
          success: true,
          skipped: true,
        }
      }
    }

    // Load raw CSV data
    const rawData = await this.loadRawCSVData(date, districtId)
    if (!rawData) {
      return {
        districtId,
        success: false,
        error: `Raw CSV data not found for district ${districtId} on ${date}`,
      }
    }

    try {
      // Transform using shared DataTransformer
      const districtStats = await this.dataTransformer.transformRawCSV(
        date,
        districtId,
        rawData
      )

      // Write district snapshot file
      const snapshotPath = this.getDistrictSnapshotPath(date, districtId)
      const snapshotDir = path.dirname(snapshotPath)

      await fs.mkdir(snapshotDir, { recursive: true })

      const snapshotContent = JSON.stringify(districtStats, null, 2)
      const tempPath = `${snapshotPath}.tmp.${Date.now()}`
      await fs.writeFile(tempPath, snapshotContent, 'utf-8')
      await fs.rename(tempPath, snapshotPath)

      this.logger.info('District snapshot written', {
        date,
        districtId,
        path: snapshotPath,
        clubCount: districtStats.clubs.length,
      })

      return {
        districtId,
        success: true,
        snapshotPath,
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      this.logger.error('Failed to transform district', {
        date,
        districtId,
        error: errorMessage,
      })
      return {
        districtId,
        success: false,
        error: errorMessage,
      }
    }
  }

  /**
   * Write snapshot metadata file
   */
  private async writeMetadata(
    date: string,
    successfulDistricts: string[],
    failedDistricts: string[],
    errors: string[],
    processingDuration: number
  ): Promise<void> {
    const snapshotDir = this.getSnapshotDir(date)
    const metadataPath = path.join(snapshotDir, 'metadata.json')

    // Determine status based on results
    let status: 'success' | 'partial' | 'failed'
    if (failedDistricts.length === 0) {
      status = 'success'
    } else if (successfulDistricts.length > 0) {
      status = 'partial'
    } else {
      status = 'failed'
    }

    const allDistricts = [...successfulDistricts, ...failedDistricts]

    const metadata: SnapshotMetadataFile = {
      snapshotId: date,
      createdAt: new Date().toISOString(),
      schemaVersion: ANALYTICS_SCHEMA_VERSION,
      calculationVersion: ANALYTICS_SCHEMA_VERSION,
      status,
      configuredDistricts: allDistricts,
      successfulDistricts,
      failedDistricts,
      errors,
      processingDuration,
      source: 'scraper-cli',
      dataAsOfDate: date,
    }

    const content = JSON.stringify(metadata, null, 2)
    const tempPath = `${metadataPath}.tmp.${Date.now()}`
    await fs.writeFile(tempPath, content, 'utf-8')
    await fs.rename(tempPath, metadataPath)

    this.logger.info('Metadata file written', { date, path: metadataPath })
  }

  /**
   * Write snapshot manifest file
   */
  private async writeManifest(
    date: string,
    districtEntries: DistrictManifestEntry[],
    failedDistrictIds: string[]
  ): Promise<void> {
    const snapshotDir = this.getSnapshotDir(date)
    const manifestPath = path.join(snapshotDir, 'manifest.json')

    const manifest: SnapshotManifest = {
      snapshotId: date,
      createdAt: new Date().toISOString(),
      districts: districtEntries,
      totalDistricts: districtEntries.length + failedDistrictIds.length,
      successfulDistricts: districtEntries.length,
      failedDistricts: failedDistrictIds.length,
    }

    const content = JSON.stringify(manifest, null, 2)
    const tempPath = `${manifestPath}.tmp.${Date.now()}`
    await fs.writeFile(tempPath, content, 'utf-8')
    await fs.rename(tempPath, manifestPath)

    this.logger.info('Manifest file written', {
      date,
      path: manifestPath,
      totalDistricts: manifest.totalDistricts,
      successfulDistricts: manifest.successfulDistricts,
    })
  }

  /**
   * Get manifest entry for a district snapshot file
   */
  private async getDistrictManifestEntry(
    date: string,
    districtId: string
  ): Promise<DistrictManifestEntry | null> {
    const snapshotPath = this.getDistrictSnapshotPath(date, districtId)

    try {
      const stat = await fs.stat(snapshotPath)

      return {
        districtId,
        fileName: `district_${districtId}.json`,
        status: 'success',
        fileSize: stat.size,
        lastModified: stat.mtime.toISOString(),
      }
    } catch {
      return null
    }
  }

  /**
   * Transform all available districts for a date
   *
   * Requirements:
   * - 2.2: Use the same DataTransformationService logic as the Backend
   * - 2.3: Store snapshots in CACHE_DIR/snapshots/{date}/
   * - 2.4: Write district JSON files, metadata.json, and manifest.json
   */
  async transform(
    options: TransformOperationOptions
  ): Promise<TransformOperationResult> {
    const startTime = Date.now()
    const { date, districts: requestedDistricts, force, verbose } = options

    if (verbose) {
      this.logger.info('Starting transform operation', {
        date,
        requestedDistricts,
        force,
      })
    }

    // Discover available districts if not specified
    let districtsToTransform: string[]
    if (requestedDistricts && requestedDistricts.length > 0) {
      districtsToTransform = requestedDistricts
    } else {
      districtsToTransform = await this.discoverAvailableDistricts(date)
    }

    if (districtsToTransform.length === 0) {
      this.logger.warn('No districts found to transform', { date })
      return {
        success: false,
        date,
        districtsProcessed: [],
        districtsSucceeded: [],
        districtsFailed: [],
        districtsSkipped: [],
        snapshotLocations: [],
        errors: [
          {
            districtId: 'N/A',
            error: `No raw CSV data found for date ${date}`,
            timestamp: new Date().toISOString(),
          },
        ],
        duration_ms: Date.now() - startTime,
      }
    }

    // Transform each district
    const results: DistrictTransformResult[] = []
    const errors: Array<{
      districtId: string
      error: string
      timestamp: string
    }> = []
    const snapshotLocations: string[] = []
    const successfulDistricts: string[] = []

    for (const districtId of districtsToTransform) {
      const result = await this.transformDistrict(date, districtId, { force })
      results.push(result)

      if (result.success) {
        if (!result.skipped) {
          successfulDistricts.push(districtId)
          if (result.snapshotPath) {
            snapshotLocations.push(result.snapshotPath)
          }
        }
      } else if (result.error) {
        errors.push({
          districtId,
          error: result.error,
          timestamp: new Date().toISOString(),
        })
      }
    }

    // Collect manifest entries for all district files (including previously existing ones)
    const districtEntries: DistrictManifestEntry[] = []
    const allSuccessfulDistricts: string[] = []

    for (const districtId of districtsToTransform) {
      const entry = await this.getDistrictManifestEntry(date, districtId)
      if (entry) {
        districtEntries.push(entry)
        allSuccessfulDistricts.push(districtId)
      }
    }

    // Write metadata and manifest if we have any successful districts
    if (allSuccessfulDistricts.length > 0) {
      try {
        // Collect failed districts and error messages for metadata
        const failedDistrictIds = results
          .filter(r => !r.success)
          .map(r => r.districtId)
        const errorMessages = errors.map(e => `${e.districtId}: ${e.error}`)
        const processingDuration = Date.now() - startTime

        await this.writeMetadata(
          date,
          allSuccessfulDistricts,
          failedDistrictIds,
          errorMessages,
          processingDuration
        )
        await this.writeManifest(date, districtEntries, failedDistrictIds)

        // Add metadata and manifest to snapshot locations
        const snapshotDir = this.getSnapshotDir(date)
        snapshotLocations.push(path.join(snapshotDir, 'metadata.json'))
        snapshotLocations.push(path.join(snapshotDir, 'manifest.json'))
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error'
        this.logger.error('Failed to write metadata/manifest', {
          date,
          error: errorMessage,
        })
        errors.push({
          districtId: 'N/A',
          error: `Failed to write metadata/manifest: ${errorMessage}`,
          timestamp: new Date().toISOString(),
        })
      }
    }

    // Calculate result statistics
    const districtsProcessed = districtsToTransform
    const districtsSucceeded = results
      .filter(r => r.success && !r.skipped)
      .map(r => r.districtId)
    const districtsFailed = results
      .filter(r => !r.success)
      .map(r => r.districtId)
    const districtsSkipped = results
      .filter(r => r.success && r.skipped)
      .map(r => r.districtId)

    const success = districtsFailed.length === 0 && errors.length === 0

    if (verbose) {
      this.logger.info('Transform operation completed', {
        date,
        success,
        processed: districtsProcessed.length,
        succeeded: districtsSucceeded.length,
        failed: districtsFailed.length,
        skipped: districtsSkipped.length,
      })
    }

    return {
      success,
      date,
      districtsProcessed,
      districtsSucceeded,
      districtsFailed,
      districtsSkipped,
      snapshotLocations,
      errors,
      duration_ms: Date.now() - startTime,
    }
  }
}
