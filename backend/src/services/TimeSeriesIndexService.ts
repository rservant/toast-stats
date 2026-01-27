/**
 * TimeSeriesIndexService
 *
 * Manages time-series index files for efficient range queries across snapshots.
 * Indexes are partitioned by program year (July 1 - June 30) to limit file sizes.
 *
 * Storage structure:
 * CACHE_DIR/time-series/
 * ├── district_42/
 * │   ├── 2023-2024.json            # Program year index
 * │   ├── 2022-2023.json
 * │   └── index-metadata.json
 * └── district_61/
 *     └── ...
 *
 * Requirements:
 * - 2.1: Maintain a time-series index file with date-indexed analytics summaries
 * - 2.2: Append analytics summary to time-series index when snapshot is created
 * - 2.4: Support efficient range queries for program year boundaries (July 1 to June 30)
 * - 2.5: Partition indexes by program year to limit file sizes
 */

import fs from 'fs/promises'
import path from 'path'
import { logger } from '../utils/logger.js'
import type {
  TimeSeriesDataPoint,
  ProgramYearIndex,
  ProgramYearIndexFile,
  ProgramYearSummary,
  TimeSeriesIndexMetadata,
} from '../types/precomputedAnalytics.js'

/**
 * Configuration for TimeSeriesIndexService
 */
export interface TimeSeriesIndexServiceConfig {
  /** Base directory for cache storage */
  cacheDir: string
}

/**
 * Interface for the Time Series Index Service
 */
export interface ITimeSeriesIndexService {
  /**
   * Append a data point to the time-series index
   * Called after snapshot creation
   */
  appendDataPoint(
    districtId: string,
    dataPoint: TimeSeriesDataPoint
  ): Promise<void>

  /**
   * Get trend data for a date range
   * Returns data points without loading individual snapshots
   */
  getTrendData(
    districtId: string,
    startDate: string,
    endDate: string
  ): Promise<TimeSeriesDataPoint[]>

  /**
   * Get all data for a program year
   */
  getProgramYearData(
    districtId: string,
    programYear: string
  ): Promise<ProgramYearIndex | null>

  /**
   * Rebuild index from snapshots (for backfill)
   */
  rebuildIndex(districtId: string, fromDate?: string): Promise<void>
}

/**
 * Pattern for valid district IDs - only alphanumeric characters allowed
 */
const VALID_DISTRICT_ID_PATTERN = /^[A-Za-z0-9]+$/

/**
 * Pattern for valid program year format (e.g., "2023-2024")
 */
const VALID_PROGRAM_YEAR_PATTERN = /^\d{4}-\d{4}$/

/**
 * Service for managing time-series indexes for efficient range queries.
 *
 * This service maintains per-district, per-program-year index files that
 * enable fast retrieval of trend data without loading individual snapshots.
 *
 * Requirement 2.1: Maintain time-series index with date-indexed analytics summaries
 * Requirement 2.5: Partition indexes by program year to limit file sizes
 */
export class TimeSeriesIndexService implements ITimeSeriesIndexService {
  private readonly cacheDir: string
  private readonly timeSeriesDir: string

  constructor(config: TimeSeriesIndexServiceConfig) {
    this.cacheDir = config.cacheDir
    this.timeSeriesDir = path.join(this.cacheDir, 'time-series')
  }

  /**
   * Append a data point to the time-series index
   *
   * Called after snapshot creation to add the analytics summary to the
   * appropriate program year index file.
   *
   * Requirement 2.2: Append analytics summary to time-series index when snapshot is created
   *
   * @param districtId - The district ID to append data for
   * @param dataPoint - The time-series data point to append
   */
  async appendDataPoint(
    districtId: string,
    dataPoint: TimeSeriesDataPoint
  ): Promise<void> {
    const operationId = `append_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    logger.info('Appending data point to time-series index', {
      operation: 'appendDataPoint',
      operationId,
      districtId,
      date: dataPoint.date,
      snapshotId: dataPoint.snapshotId,
    })

    try {
      // Validate district ID
      this.validateDistrictId(districtId)

      // Determine program year for this data point
      const programYear = this.getProgramYearForDate(dataPoint.date)

      // Ensure district directory exists
      await this.ensureDistrictDirectory(districtId)

      // Read or create program year index file
      const indexFile = await this.readOrCreateProgramYearIndex(
        districtId,
        programYear
      )

      // Check if data point already exists (by date and snapshotId)
      const existingIndex = indexFile.dataPoints.findIndex(
        dp =>
          dp.date === dataPoint.date && dp.snapshotId === dataPoint.snapshotId
      )

      if (existingIndex >= 0) {
        // Update existing data point
        indexFile.dataPoints[existingIndex] = dataPoint
        logger.debug('Updated existing data point in index', {
          operation: 'appendDataPoint',
          operationId,
          districtId,
          programYear,
          date: dataPoint.date,
        })
      } else {
        // Append new data point
        indexFile.dataPoints.push(dataPoint)
        logger.debug('Appended new data point to index', {
          operation: 'appendDataPoint',
          operationId,
          districtId,
          programYear,
          date: dataPoint.date,
        })
      }

      // Sort data points by date (chronological order)
      indexFile.dataPoints.sort((a, b) => a.date.localeCompare(b.date))

      // Update summary statistics
      indexFile.summary = this.calculateProgramYearSummary(indexFile.dataPoints)
      indexFile.lastUpdated = new Date().toISOString()

      // Write updated index file
      await this.writeProgramYearIndex(districtId, programYear, indexFile)

      // Update index metadata
      await this.updateIndexMetadata(districtId)

      logger.info('Successfully appended data point to time-series index', {
        operation: 'appendDataPoint',
        operationId,
        districtId,
        programYear,
        date: dataPoint.date,
        totalDataPoints: indexFile.dataPoints.length,
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to append data point to time-series index', {
        operation: 'appendDataPoint',
        operationId,
        districtId,
        date: dataPoint.date,
        error: errorMessage,
      })
      throw new Error(`Failed to append data point: ${errorMessage}`)
    }
  }

  /**
   * Get trend data for a date range
   *
   * Returns data points within the specified date range without loading
   * individual snapshots. Efficiently queries across program year boundaries.
   *
   * Requirement 2.4: Support efficient range queries for program year boundaries
   *
   * @param districtId - The district ID to query
   * @param startDate - Start date (inclusive, YYYY-MM-DD format)
   * @param endDate - End date (inclusive, YYYY-MM-DD format)
   * @returns Array of data points within the date range
   */
  async getTrendData(
    districtId: string,
    startDate: string,
    endDate: string
  ): Promise<TimeSeriesDataPoint[]> {
    const operationId = `trend_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    logger.info('Getting trend data from time-series index', {
      operation: 'getTrendData',
      operationId,
      districtId,
      startDate,
      endDate,
    })

    try {
      // Validate district ID
      this.validateDistrictId(districtId)

      // Determine which program years to query
      const programYears = this.getProgramYearsInRange(startDate, endDate)

      logger.debug('Program years to query', {
        operation: 'getTrendData',
        operationId,
        districtId,
        programYears,
      })

      // Collect data points from all relevant program years
      const allDataPoints: TimeSeriesDataPoint[] = []

      for (const programYear of programYears) {
        const indexFile = await this.readProgramYearIndex(
          districtId,
          programYear
        )

        if (indexFile) {
          // Filter data points within the date range
          const filteredPoints = indexFile.dataPoints.filter(
            dp => dp.date >= startDate && dp.date <= endDate
          )
          allDataPoints.push(...filteredPoints)
        }
      }

      // Sort by date (should already be sorted, but ensure consistency)
      allDataPoints.sort((a, b) => a.date.localeCompare(b.date))

      logger.info('Successfully retrieved trend data', {
        operation: 'getTrendData',
        operationId,
        districtId,
        startDate,
        endDate,
        programYearsQueried: programYears.length,
        dataPointsReturned: allDataPoints.length,
      })

      return allDataPoints
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to get trend data', {
        operation: 'getTrendData',
        operationId,
        districtId,
        startDate,
        endDate,
        error: errorMessage,
      })
      throw new Error(`Failed to get trend data: ${errorMessage}`)
    }
  }

  /**
   * Get all data for a program year
   *
   * Returns the complete program year index including all data points
   * and summary statistics.
   *
   * Requirement 2.4: Support efficient range queries for program year boundaries
   *
   * @param districtId - The district ID to query
   * @param programYear - The program year (e.g., "2023-2024")
   * @returns Program year index or null if not found
   */
  async getProgramYearData(
    districtId: string,
    programYear: string
  ): Promise<ProgramYearIndex | null> {
    const operationId = `pydata_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    logger.info('Getting program year data', {
      operation: 'getProgramYearData',
      operationId,
      districtId,
      programYear,
    })

    try {
      // Validate inputs
      this.validateDistrictId(districtId)
      this.validateProgramYear(programYear)

      const indexFile = await this.readProgramYearIndex(districtId, programYear)

      if (!indexFile) {
        logger.debug('Program year index not found', {
          operation: 'getProgramYearData',
          operationId,
          districtId,
          programYear,
        })
        return null
      }

      // Convert to ProgramYearIndex interface
      const result: ProgramYearIndex = {
        programYear: indexFile.programYear,
        startDate: indexFile.startDate,
        endDate: indexFile.endDate,
        dataPoints: indexFile.dataPoints,
        lastUpdated: indexFile.lastUpdated,
      }

      logger.info('Successfully retrieved program year data', {
        operation: 'getProgramYearData',
        operationId,
        districtId,
        programYear,
        dataPointCount: result.dataPoints.length,
      })

      return result
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to get program year data', {
        operation: 'getProgramYearData',
        operationId,
        districtId,
        programYear,
        error: errorMessage,
      })
      throw new Error(`Failed to get program year data: ${errorMessage}`)
    }
  }

  /**
   * Rebuild index from snapshots (for backfill)
   *
   * This method is a placeholder for the backfill service integration.
   * The actual implementation will be done in the BackfillService.
   *
   * @param districtId - The district ID to rebuild index for
   * @param fromDate - Optional start date for partial rebuild
   */
  async rebuildIndex(districtId: string, fromDate?: string): Promise<void> {
    logger.info('Rebuild index requested', {
      operation: 'rebuildIndex',
      districtId,
      fromDate,
    })

    // Validate district ID
    this.validateDistrictId(districtId)

    // This is a placeholder - actual implementation will be in BackfillService
    // which will iterate through snapshots and call appendDataPoint for each
    logger.warn(
      'rebuildIndex is a placeholder - use BackfillService for actual rebuild',
      {
        operation: 'rebuildIndex',
        districtId,
        fromDate,
      }
    )
  }

  // ========== Program Year Calculation Methods ==========

  /**
   * Get the program year for a given date
   *
   * Toastmasters program years run from July 1 to June 30.
   * For example:
   * - 2023-07-01 to 2024-06-30 is program year "2023-2024"
   * - 2024-01-15 is in program year "2023-2024"
   * - 2024-07-01 is in program year "2024-2025"
   *
   * Requirement 2.4: Support program year boundaries (July 1 to June 30)
   *
   * @param dateStr - Date string in YYYY-MM-DD format
   * @returns Program year string (e.g., "2023-2024")
   */
  getProgramYearForDate(dateStr: string): string {
    // Parse date string directly to avoid timezone issues
    // Expected format: YYYY-MM-DD
    const parts = dateStr.split('-')
    const year = parseInt(parts[0] ?? '0', 10)
    const month = parseInt(parts[1] ?? '0', 10)

    // If month is July (7) or later, program year starts this year
    // If month is before July, program year started last year
    if (month >= 7) {
      return `${year}-${year + 1}`
    } else {
      return `${year - 1}-${year}`
    }
  }

  /**
   * Get the start date of a program year
   *
   * @param programYear - Program year string (e.g., "2023-2024")
   * @returns Start date in YYYY-MM-DD format (e.g., "2023-07-01")
   */
  getProgramYearStartDate(programYear: string): string {
    const startYear = parseInt(programYear.split('-')[0] ?? '0', 10)
    return `${startYear}-07-01`
  }

  /**
   * Get the end date of a program year
   *
   * @param programYear - Program year string (e.g., "2023-2024")
   * @returns End date in YYYY-MM-DD format (e.g., "2024-06-30")
   */
  getProgramYearEndDate(programYear: string): string {
    const endYear = parseInt(programYear.split('-')[1] ?? '0', 10)
    return `${endYear}-06-30`
  }

  /**
   * Get all program years that overlap with a date range
   *
   * @param startDate - Start date in YYYY-MM-DD format
   * @param endDate - End date in YYYY-MM-DD format
   * @returns Array of program year strings
   */
  getProgramYearsInRange(startDate: string, endDate: string): string[] {
    const programYears: string[] = []

    const startProgramYear = this.getProgramYearForDate(startDate)
    const endProgramYear = this.getProgramYearForDate(endDate)

    // Extract start years
    const startYearNum = parseInt(startProgramYear.split('-')[0] ?? '0', 10)
    const endYearNum = parseInt(endProgramYear.split('-')[0] ?? '0', 10)

    // Generate all program years in range
    for (let year = startYearNum; year <= endYearNum; year++) {
      programYears.push(`${year}-${year + 1}`)
    }

    return programYears
  }

  // ========== File I/O Methods ==========

  /**
   * Ensure the district directory exists
   */
  private async ensureDistrictDirectory(districtId: string): Promise<string> {
    const districtDir = path.join(this.timeSeriesDir, `district_${districtId}`)
    await fs.mkdir(districtDir, { recursive: true })
    return districtDir
  }

  /**
   * Read or create a program year index file
   */
  private async readOrCreateProgramYearIndex(
    districtId: string,
    programYear: string
  ): Promise<ProgramYearIndexFile> {
    const existing = await this.readProgramYearIndex(districtId, programYear)

    if (existing) {
      return existing
    }

    // Create new index file
    const newIndex: ProgramYearIndexFile = {
      districtId,
      programYear,
      startDate: this.getProgramYearStartDate(programYear),
      endDate: this.getProgramYearEndDate(programYear),
      lastUpdated: new Date().toISOString(),
      dataPoints: [],
      summary: {
        totalDataPoints: 0,
        membershipStart: 0,
        membershipEnd: 0,
        membershipPeak: 0,
        membershipLow: 0,
      },
    }

    return newIndex
  }

  /**
   * Read a program year index file
   */
  private async readProgramYearIndex(
    districtId: string,
    programYear: string
  ): Promise<ProgramYearIndexFile | null> {
    const filePath = path.join(
      this.timeSeriesDir,
      `district_${districtId}`,
      `${programYear}.json`
    )

    // Normalize and ensure the resolved path stays within the timeSeriesDir
    const resolvedRoot = path.resolve(this.timeSeriesDir)
    const resolvedPath = path.resolve(filePath)

    if (!resolvedPath.startsWith(resolvedRoot + path.sep)) {
      logger.error('Resolved index file path is outside of timeSeriesDir', {
        operation: 'readProgramYearIndex',
        districtId,
        programYear,
        timeSeriesDir: resolvedRoot,
        resolvedPath,
      })
      // Treat as not found to avoid exposing filesystem details
      return null
    }

    try {
      const content = await fs.readFile(resolvedPath, 'utf-8')
      const indexFile: ProgramYearIndexFile = JSON.parse(content)

      logger.debug('Read program year index file', {
        operation: 'readProgramYearIndex',
        districtId,
        programYear,
        filePath: resolvedPath,
        dataPointCount: indexFile.dataPoints.length,
      })

      return indexFile
    } catch (error) {
      if ((error as { code?: string }).code === 'ENOENT') {
        logger.debug('Program year index file not found', {
          operation: 'readProgramYearIndex',
          districtId,
          programYear,
          filePath: resolvedPath,
        })
        return null
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to read program year index file', {
        operation: 'readProgramYearIndex',
        districtId,
        programYear,
        filePath: resolvedPath,
        error: errorMessage,
      })
      throw new Error(`Failed to read program year index: ${errorMessage}`)
    }
  }

  /**
   * Write a program year index file
   */
  private async writeProgramYearIndex(
    districtId: string,
    programYear: string,
    indexFile: ProgramYearIndexFile
  ): Promise<void> {
    const filePath = path.join(
      this.timeSeriesDir,
      `district_${districtId}`,
      `${programYear}.json`
    )

    try {
      await fs.writeFile(filePath, JSON.stringify(indexFile, null, 2), 'utf-8')

      logger.debug('Wrote program year index file', {
        operation: 'writeProgramYearIndex',
        districtId,
        programYear,
        filePath,
        dataPointCount: indexFile.dataPoints.length,
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to write program year index file', {
        operation: 'writeProgramYearIndex',
        districtId,
        programYear,
        filePath,
        error: errorMessage,
      })
      throw new Error(`Failed to write program year index: ${errorMessage}`)
    }
  }

  /**
   * Update the index metadata file for a district
   */
  private async updateIndexMetadata(districtId: string): Promise<void> {
    const districtDir = path.join(this.timeSeriesDir, `district_${districtId}`)
    const metadataPath = path.join(districtDir, 'index-metadata.json')

    try {
      // List all program year files
      const files = await fs.readdir(districtDir)
      const programYearFiles = files.filter(
        f => f.endsWith('.json') && f !== 'index-metadata.json'
      )

      // Extract program years and sort
      const programYears = programYearFiles
        .map(f => f.replace('.json', ''))
        .filter(py => VALID_PROGRAM_YEAR_PATTERN.test(py))
        .sort()

      // Count total data points
      let totalDataPoints = 0
      for (const programYear of programYears) {
        const indexFile = await this.readProgramYearIndex(
          districtId,
          programYear
        )
        if (indexFile) {
          totalDataPoints += indexFile.dataPoints.length
        }
      }

      const metadata: TimeSeriesIndexMetadata = {
        districtId,
        lastUpdated: new Date().toISOString(),
        availableProgramYears: programYears,
        totalDataPoints,
      }

      await fs.writeFile(
        metadataPath,
        JSON.stringify(metadata, null, 2),
        'utf-8'
      )

      logger.debug('Updated index metadata', {
        operation: 'updateIndexMetadata',
        districtId,
        programYearCount: programYears.length,
        totalDataPoints,
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.warn('Failed to update index metadata', {
        operation: 'updateIndexMetadata',
        districtId,
        error: errorMessage,
      })
      // Don't throw - metadata update is not critical
    }
  }

  // ========== Summary Calculation Methods ==========

  /**
   * Calculate summary statistics for a program year
   */
  private calculateProgramYearSummary(
    dataPoints: TimeSeriesDataPoint[]
  ): ProgramYearSummary {
    if (dataPoints.length === 0) {
      return {
        totalDataPoints: 0,
        membershipStart: 0,
        membershipEnd: 0,
        membershipPeak: 0,
        membershipLow: 0,
      }
    }

    const memberships = dataPoints.map(dp => dp.membership)
    const firstDataPoint = dataPoints[0]
    const lastDataPoint = dataPoints[dataPoints.length - 1]

    return {
      totalDataPoints: dataPoints.length,
      membershipStart: firstDataPoint?.membership ?? 0,
      membershipEnd: lastDataPoint?.membership ?? 0,
      membershipPeak: Math.max(...memberships),
      membershipLow: Math.min(...memberships),
    }
  }

  // ========== Validation Methods ==========

  /**
   * Validate a district ID
   */
  private validateDistrictId(districtId: string): void {
    if (typeof districtId !== 'string' || districtId.length === 0) {
      throw new Error('Invalid district ID: empty or non-string value')
    }

    if (!VALID_DISTRICT_ID_PATTERN.test(districtId)) {
      throw new Error(
        'Invalid district ID format: only alphanumeric characters allowed'
      )
    }
  }

  /**
   * Validate a program year string
   */
  private validateProgramYear(programYear: string): void {
    if (!VALID_PROGRAM_YEAR_PATTERN.test(programYear)) {
      throw new Error(
        'Invalid program year format: expected YYYY-YYYY (e.g., "2023-2024")'
      )
    }

    const [startYear, endYear] = programYear
      .split('-')
      .map(y => parseInt(y, 10))
    if (
      startYear === undefined ||
      endYear === undefined ||
      endYear !== startYear + 1
    ) {
      throw new Error('Invalid program year: end year must be start year + 1')
    }
  }
}

/**
 * Factory function to create a TimeSeriesIndexService instance
 */
export function createTimeSeriesIndexService(
  config: TimeSeriesIndexServiceConfig
): ITimeSeriesIndexService {
  return new TimeSeriesIndexService(config)
}
