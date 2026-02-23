/**
 * TimeSeriesIndexService (Read-Only)
 *
 * Reads time-series index files for efficient range queries across snapshots.
 * Indexes are partitioned by program year (July 1 - June 30) to limit file sizes.
 *
 * IMPORTANT: This service is READ-ONLY. Time-series data is pre-computed by
 * collector-cli during the compute-analytics pipeline. The backend does NOT
 * perform any computation per the data-computation-separation steering document.
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
 * - 8.1: Read time-series data from pre-computed files only
 * - 8.4: Return null or empty results when data is missing
 * - 8.5: No computation performed
 */

import fs from 'fs/promises'
import path from 'path'
import { logger } from '../utils/logger.js'
import type {
  TimeSeriesDataPoint,
  ProgramYearIndex,
  ProgramYearIndexFile,
} from '../types/precomputedAnalytics.js'

/**
 * Configuration for TimeSeriesIndexService
 */
export interface TimeSeriesIndexServiceConfig {
  /** Base directory for cache storage */
  cacheDir: string
}

/**
 * Interface for the Time Series Index Service (Read-Only)
 *
 * This interface only includes read methods. Write operations are performed
 * by collector-cli during the compute-analytics pipeline.
 */
export interface ITimeSeriesIndexService {
  /**
   * Get trend data for a date range
   * Returns data points without loading individual snapshots
   * Returns empty array when data is missing (not an error)
   */
  getTrendData(
    districtId: string,
    startDate: string,
    endDate: string
  ): Promise<TimeSeriesDataPoint[]>

  /**
   * Get all data for a program year
   * Returns null when data is missing (not an error)
   */
  getProgramYearData(
    districtId: string,
    programYear: string
  ): Promise<ProgramYearIndex | null>
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
 * Read-only service for accessing time-series indexes.
 *
 * This service reads pre-computed time-series data from index files.
 * All computation is performed by collector-cli during the compute-analytics
 * pipeline per the data-computation-separation steering document.
 *
 * Requirement 8.1: Read time-series data from pre-computed files only
 * Requirement 8.4: Return null or empty results when data is missing
 * Requirement 8.5: No computation performed
 */
export class TimeSeriesIndexService implements ITimeSeriesIndexService {
  private readonly cacheDir: string
  private readonly timeSeriesDir: string

  constructor(config: TimeSeriesIndexServiceConfig) {
    this.cacheDir = config.cacheDir
    this.timeSeriesDir = path.join(this.cacheDir, 'time-series')
  }

  /**
   * Get trend data for a date range
   *
   * Returns data points within the specified date range without loading
   * individual snapshots. Efficiently queries across program year boundaries.
   *
   * Requirement 8.4: Return empty array when data is missing (not an error)
   *
   * @param districtId - The district ID to query
   * @param startDate - Start date (inclusive, YYYY-MM-DD format)
   * @param endDate - End date (inclusive, YYYY-MM-DD format)
   * @returns Array of data points within the date range (empty if no data)
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
      // For validation errors, log and return empty array
      // This ensures missing data doesn't cause API errors
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      // Only log as error for unexpected failures, not missing data
      if (
        errorMessage.includes('Invalid district ID') ||
        errorMessage.includes('ENOENT')
      ) {
        logger.debug('No trend data available', {
          operation: 'getTrendData',
          operationId,
          districtId,
          startDate,
          endDate,
          reason: errorMessage,
        })
      } else {
        logger.error('Failed to get trend data', {
          operation: 'getTrendData',
          operationId,
          districtId,
          startDate,
          endDate,
          error: errorMessage,
        })
      }

      // Return empty array instead of throwing - data is simply not available
      return []
    }
  }

  /**
   * Get all data for a program year
   *
   * Returns the complete program year index including all data points
   * and summary statistics (pre-computed by collector-cli).
   *
   * Requirement 8.4: Return null when data is missing (not an error)
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

      // For validation errors, return null (data not available)
      if (
        errorMessage.includes('Invalid district ID') ||
        errorMessage.includes('Invalid program year')
      ) {
        logger.debug('Program year data not available due to validation', {
          operation: 'getProgramYearData',
          operationId,
          districtId,
          programYear,
          reason: errorMessage,
        })
        return null
      }

      logger.error('Failed to get program year data', {
        operation: 'getProgramYearData',
        operationId,
        districtId,
        programYear,
        error: errorMessage,
      })

      // Return null instead of throwing - data is simply not available
      return null
    }
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

  // ========== File I/O Methods (Read-Only) ==========

  /**
   * Read a program year index file
   *
   * Returns null if the file doesn't exist (not an error condition).
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
      // Return null instead of throwing - treat as missing data
      return null
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
