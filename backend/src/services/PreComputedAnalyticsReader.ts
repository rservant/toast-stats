/**
 * PreComputedAnalyticsReader - Reads pre-computed analytics from the file system.
 *
 * This service reads analytics files from the `analytics/` subdirectory
 * within each snapshot directory. It validates schema versions and handles
 * missing or corrupted files appropriately.
 *
 * Requirements:
 * - 4.1: THE Backend SHALL read pre-computed analytics from the file system
 * - 4.4: THE Backend SHALL validate the schema version of pre-computed analytics files
 * - 4.5: IF the schema version is incompatible, THE Backend SHALL return a 500 error
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import {
  isCompatibleVersion,
  type DistrictAnalytics,
  type MembershipTrendData,
  type ClubHealthData,
  type PreComputedAnalyticsFile,
  type AnalyticsManifest,
} from '@toastmasters/analytics-core'
import { logger } from '../utils/logger.js'

/**
 * Configuration for PreComputedAnalyticsReader
 */
export interface PreComputedAnalyticsReaderConfig {
  /** Base cache directory (CACHE_DIR) */
  cacheDir: string
}

/**
 * Error thrown when schema version is incompatible
 */
export class SchemaVersionError extends Error {
  constructor(
    public readonly fileVersion: string,
    public readonly filePath: string
  ) {
    super(
      `Incompatible analytics schema version: ${fileVersion} in file ${filePath}`
    )
    this.name = 'SchemaVersionError'
  }
}

/**
 * Error thrown when analytics file is corrupted or invalid
 */
export class CorruptedFileError extends Error {
  constructor(
    public readonly filePath: string,
    public readonly cause: Error
  ) {
    super(`Corrupted analytics file: ${filePath}`)
    this.name = 'CorruptedFileError'
  }
}

/**
 * Interface for reading pre-computed analytics files.
 *
 * Requirements:
 * - 4.1: Read pre-computed analytics from the file system
 * - 4.4: Validate schema version of pre-computed analytics files
 * - 4.5: Return error if schema version is incompatible
 */
export interface IPreComputedAnalyticsReader {
  /**
   * Reads district analytics from a pre-computed file.
   *
   * @param snapshotDate - The snapshot date (YYYY-MM-DD)
   * @param districtId - The district identifier
   * @returns Promise resolving to DistrictAnalytics or null if not found
   * @throws SchemaVersionError if schema version is incompatible
   * @throws CorruptedFileError if file is corrupted or invalid JSON
   */
  readDistrictAnalytics(
    snapshotDate: string,
    districtId: string
  ): Promise<DistrictAnalytics | null>

  /**
   * Reads membership trends from a pre-computed file.
   *
   * @param snapshotDate - The snapshot date (YYYY-MM-DD)
   * @param districtId - The district identifier
   * @returns Promise resolving to MembershipTrendData or null if not found
   * @throws SchemaVersionError if schema version is incompatible
   * @throws CorruptedFileError if file is corrupted or invalid JSON
   */
  readMembershipTrends(
    snapshotDate: string,
    districtId: string
  ): Promise<MembershipTrendData | null>

  /**
   * Reads club health data from a pre-computed file.
   *
   * @param snapshotDate - The snapshot date (YYYY-MM-DD)
   * @param districtId - The district identifier
   * @returns Promise resolving to ClubHealthData or null if not found
   * @throws SchemaVersionError if schema version is incompatible
   * @throws CorruptedFileError if file is corrupted or invalid JSON
   */
  readClubHealth(
    snapshotDate: string,
    districtId: string
  ): Promise<ClubHealthData | null>

  /**
   * Validates the schema version of a pre-computed analytics file.
   *
   * @param file - The pre-computed analytics file to validate
   * @returns true if schema version is compatible, false otherwise
   */
  validateSchemaVersion(file: PreComputedAnalyticsFile<unknown>): boolean

  /**
   * Gets the analytics manifest for a snapshot date.
   *
   * @param snapshotDate - The snapshot date (YYYY-MM-DD)
   * @returns Promise resolving to AnalyticsManifest or null if not found
   */
  getAnalyticsManifest(snapshotDate: string): Promise<AnalyticsManifest | null>
}

/**
 * PreComputedAnalyticsReader reads pre-computed analytics from the file system.
 *
 * The service reads analytics files from:
 *   CACHE_DIR/snapshots/{date}/analytics/
 *     ├── manifest.json
 *     ├── district_{id}_analytics.json
 *     ├── district_{id}_membership.json
 *     └── district_{id}_clubhealth.json
 *
 * Each file follows the PreComputedAnalyticsFile structure with metadata
 * including schemaVersion, computedAt, snapshotDate, districtId, and checksum.
 *
 * Requirements:
 * - 4.1: Read pre-computed analytics from the file system
 * - 4.4: Validate schema version of pre-computed analytics files
 * - 4.5: Return error if schema version is incompatible
 */
export class PreComputedAnalyticsReader implements IPreComputedAnalyticsReader {
  private readonly cacheDir: string

  constructor(config: PreComputedAnalyticsReaderConfig) {
    this.cacheDir = config.cacheDir
  }

  /**
   * Get the snapshot directory path for a date
   */
  private getSnapshotDir(snapshotDate: string): string {
    return path.join(this.cacheDir, 'snapshots', snapshotDate)
  }

  /**
   * Get the analytics directory path for a date
   */
  private getAnalyticsDir(snapshotDate: string): string {
    return path.join(this.getSnapshotDir(snapshotDate), 'analytics')
  }

  /**
   * Validate a district ID to ensure it is safe to use in file paths.
   * District IDs are typically numeric (e.g., "42", "15") or alphanumeric (e.g., "F").
   * The pattern prevents path traversal by rejecting special characters.
   * @throws Error if the district ID format is invalid
   */
  private validateDistrictId(districtId: string): void {
    if (typeof districtId !== 'string' || districtId.length === 0) {
      throw new Error('Invalid district ID: empty or non-string value')
    }

    // Allow alphanumeric characters only (no path separators, dots, or special chars)
    const DISTRICT_ID_PATTERN = /^[A-Za-z0-9]+$/
    if (!DISTRICT_ID_PATTERN.test(districtId)) {
      logger.warn('Rejected district ID with invalid characters', {
        operation: 'validateDistrictId',
        districtId,
      })
      throw new Error('Invalid district ID format')
    }
  }

  /**
   * Validate a snapshot date to ensure it is safe to use in file paths.
   * Snapshot dates must be in YYYY-MM-DD format.
   * @throws Error if the snapshot date format is invalid
   */
  private validateSnapshotDate(snapshotDate: string): void {
    if (typeof snapshotDate !== 'string' || snapshotDate.length === 0) {
      throw new Error('Invalid snapshot date: empty or non-string value')
    }

    // Validate YYYY-MM-DD format
    const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
    if (!DATE_PATTERN.test(snapshotDate)) {
      logger.warn('Rejected snapshot date with invalid format', {
        operation: 'validateSnapshotDate',
        snapshotDate,
      })
      throw new Error('Invalid snapshot date format')
    }
  }

  /**
   * Read and parse a pre-computed analytics file.
   *
   * @param filePath - Path to the analytics file
   * @returns The parsed file content or null if file not found
   * @throws SchemaVersionError if schema version is incompatible
   * @throws CorruptedFileError if file is corrupted or invalid JSON
   */
  private async readAnalyticsFile<T>(
    filePath: string
  ): Promise<PreComputedAnalyticsFile<T> | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8')

      let parsed: PreComputedAnalyticsFile<T>
      try {
        parsed = JSON.parse(content) as PreComputedAnalyticsFile<T>
      } catch (parseError) {
        logger.error('Failed to parse analytics file as JSON', {
          operation: 'readAnalyticsFile',
          filePath,
          error:
            parseError instanceof Error
              ? parseError.message
              : 'Unknown parse error',
        })
        throw new CorruptedFileError(
          filePath,
          parseError instanceof Error
            ? parseError
            : new Error('JSON parse error')
        )
      }

      // Validate schema version (Requirement 4.4)
      if (!this.validateSchemaVersion(parsed)) {
        logger.error('Incompatible schema version in analytics file', {
          operation: 'readAnalyticsFile',
          filePath,
          fileVersion: parsed.metadata.schemaVersion,
        })
        throw new SchemaVersionError(parsed.metadata.schemaVersion, filePath)
      }

      logger.debug('Successfully read analytics file', {
        operation: 'readAnalyticsFile',
        filePath,
        schemaVersion: parsed.metadata.schemaVersion,
        districtId: parsed.metadata.districtId,
        snapshotDate: parsed.metadata.snapshotDate,
      })

      return parsed
    } catch (error) {
      // Re-throw our custom errors
      if (
        error instanceof SchemaVersionError ||
        error instanceof CorruptedFileError
      ) {
        throw error
      }

      // Handle file not found
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.debug('Analytics file not found', {
          operation: 'readAnalyticsFile',
          filePath,
        })
        return null
      }

      // Handle other file system errors
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to read analytics file', {
        operation: 'readAnalyticsFile',
        filePath,
        error: errorMessage,
      })
      throw new CorruptedFileError(
        filePath,
        error instanceof Error ? error : new Error(errorMessage)
      )
    }
  }

  /**
   * Validates the schema version of a pre-computed analytics file.
   *
   * Uses the isCompatibleVersion function from analytics-core to check
   * if the file's schema version is compatible with the current version.
   * Major version must match for compatibility.
   *
   * Requirement 4.4: Validate schema version of pre-computed analytics files
   *
   * @param file - The pre-computed analytics file to validate
   * @returns true if schema version is compatible, false otherwise
   */
  validateSchemaVersion(file: PreComputedAnalyticsFile<unknown>): boolean {
    if (!file.metadata?.schemaVersion) {
      return false
    }
    return isCompatibleVersion(file.metadata.schemaVersion)
  }

  /**
   * Reads district analytics from a pre-computed file.
   *
   * Requirement 4.1: Read pre-computed analytics from the file system
   * Requirement 4.4: Validate schema version
   * Requirement 4.5: Return error if schema version is incompatible
   *
   * @param snapshotDate - The snapshot date (YYYY-MM-DD)
   * @param districtId - The district identifier
   * @returns Promise resolving to DistrictAnalytics or null if not found
   * @throws SchemaVersionError if schema version is incompatible
   * @throws CorruptedFileError if file is corrupted or invalid JSON
   */
  async readDistrictAnalytics(
    snapshotDate: string,
    districtId: string
  ): Promise<DistrictAnalytics | null> {
    this.validateSnapshotDate(snapshotDate)
    this.validateDistrictId(districtId)

    const filename = `district_${districtId}_analytics.json`
    const filePath = path.join(this.getAnalyticsDir(snapshotDate), filename)

    logger.info('Reading district analytics', {
      operation: 'readDistrictAnalytics',
      snapshotDate,
      districtId,
      filePath,
    })

    const file = await this.readAnalyticsFile<DistrictAnalytics>(filePath)

    if (file === null) {
      logger.info('District analytics not found', {
        operation: 'readDistrictAnalytics',
        snapshotDate,
        districtId,
      })
      return null
    }

    logger.info('Successfully read district analytics', {
      operation: 'readDistrictAnalytics',
      snapshotDate,
      districtId,
      computedAt: file.metadata.computedAt,
    })

    return file.data
  }

  /**
   * Reads membership trends from a pre-computed file.
   *
   * Requirement 4.1: Read pre-computed analytics from the file system
   * Requirement 4.4: Validate schema version
   * Requirement 4.5: Return error if schema version is incompatible
   *
   * @param snapshotDate - The snapshot date (YYYY-MM-DD)
   * @param districtId - The district identifier
   * @returns Promise resolving to MembershipTrendData or null if not found
   * @throws SchemaVersionError if schema version is incompatible
   * @throws CorruptedFileError if file is corrupted or invalid JSON
   */
  async readMembershipTrends(
    snapshotDate: string,
    districtId: string
  ): Promise<MembershipTrendData | null> {
    this.validateSnapshotDate(snapshotDate)
    this.validateDistrictId(districtId)

    const filename = `district_${districtId}_membership.json`
    const filePath = path.join(this.getAnalyticsDir(snapshotDate), filename)

    logger.info('Reading membership trends', {
      operation: 'readMembershipTrends',
      snapshotDate,
      districtId,
      filePath,
    })

    const file = await this.readAnalyticsFile<MembershipTrendData>(filePath)

    if (file === null) {
      logger.info('Membership trends not found', {
        operation: 'readMembershipTrends',
        snapshotDate,
        districtId,
      })
      return null
    }

    logger.info('Successfully read membership trends', {
      operation: 'readMembershipTrends',
      snapshotDate,
      districtId,
      computedAt: file.metadata.computedAt,
    })

    return file.data
  }

  /**
   * Reads club health data from a pre-computed file.
   *
   * Requirement 4.1: Read pre-computed analytics from the file system
   * Requirement 4.4: Validate schema version
   * Requirement 4.5: Return error if schema version is incompatible
   *
   * @param snapshotDate - The snapshot date (YYYY-MM-DD)
   * @param districtId - The district identifier
   * @returns Promise resolving to ClubHealthData or null if not found
   * @throws SchemaVersionError if schema version is incompatible
   * @throws CorruptedFileError if file is corrupted or invalid JSON
   */
  async readClubHealth(
    snapshotDate: string,
    districtId: string
  ): Promise<ClubHealthData | null> {
    this.validateSnapshotDate(snapshotDate)
    this.validateDistrictId(districtId)

    const filename = `district_${districtId}_clubhealth.json`
    const filePath = path.join(this.getAnalyticsDir(snapshotDate), filename)

    logger.info('Reading club health data', {
      operation: 'readClubHealth',
      snapshotDate,
      districtId,
      filePath,
    })

    const file = await this.readAnalyticsFile<ClubHealthData>(filePath)

    if (file === null) {
      logger.info('Club health data not found', {
        operation: 'readClubHealth',
        snapshotDate,
        districtId,
      })
      return null
    }

    logger.info('Successfully read club health data', {
      operation: 'readClubHealth',
      snapshotDate,
      districtId,
      computedAt: file.metadata.computedAt,
    })

    return file.data
  }

  /**
   * Gets the analytics manifest for a snapshot date.
   *
   * The manifest lists all analytics files with their checksums,
   * enabling validation and discovery of available analytics.
   *
   * @param snapshotDate - The snapshot date (YYYY-MM-DD)
   * @returns Promise resolving to AnalyticsManifest or null if not found
   */
  async getAnalyticsManifest(
    snapshotDate: string
  ): Promise<AnalyticsManifest | null> {
    this.validateSnapshotDate(snapshotDate)

    const manifestPath = path.join(
      this.getAnalyticsDir(snapshotDate),
      'manifest.json'
    )

    logger.info('Reading analytics manifest', {
      operation: 'getAnalyticsManifest',
      snapshotDate,
      manifestPath,
    })

    try {
      const content = await fs.readFile(manifestPath, 'utf-8')

      let manifest: AnalyticsManifest
      try {
        manifest = JSON.parse(content) as AnalyticsManifest
      } catch (parseError) {
        logger.error('Failed to parse analytics manifest as JSON', {
          operation: 'getAnalyticsManifest',
          snapshotDate,
          manifestPath,
          error:
            parseError instanceof Error
              ? parseError.message
              : 'Unknown parse error',
        })
        throw new CorruptedFileError(
          manifestPath,
          parseError instanceof Error
            ? parseError
            : new Error('JSON parse error')
        )
      }

      logger.info('Successfully read analytics manifest', {
        operation: 'getAnalyticsManifest',
        snapshotDate,
        totalFiles: manifest.totalFiles,
        totalSize: manifest.totalSize,
      })

      return manifest
    } catch (error) {
      // Re-throw our custom errors
      if (error instanceof CorruptedFileError) {
        throw error
      }

      // Handle file not found
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.debug('Analytics manifest not found', {
          operation: 'getAnalyticsManifest',
          snapshotDate,
          manifestPath,
        })
        return null
      }

      // Handle other file system errors
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to read analytics manifest', {
        operation: 'getAnalyticsManifest',
        snapshotDate,
        manifestPath,
        error: errorMessage,
      })
      throw new CorruptedFileError(
        manifestPath,
        error instanceof Error ? error : new Error(errorMessage)
      )
    }
  }
}
