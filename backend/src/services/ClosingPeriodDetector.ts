/**
 * ClosingPeriodDetector - Detects and handles Toastmasters month-end closing periods
 *
 * A closing period occurs when the Toastmasters dashboard publishes data
 * for a prior month (data month) with an "As of" date in the current month.
 * During closing periods, snapshots should be dated as the last day of the
 * data month, not the "As of" date.
 *
 * This module encapsulates the complex domain logic for detecting closing periods
 * and calculating appropriate snapshot dates.
 *
 * @module ClosingPeriodDetector
 */

/**
 * Logger interface for dependency injection
 * Allows for flexible logging implementations in production and testing
 */
export interface Logger {
  info(message: string, data?: unknown): void
  warn(message: string, data?: unknown): void
  error(message: string, error?: Error | unknown): void
  debug(message: string, data?: unknown): void
}

/**
 * Result of closing period detection
 */
export interface ClosingPeriodResult {
  /** Whether the data represents a closing period */
  isClosingPeriod: boolean
  /** The month the data represents (YYYY-MM format) */
  dataMonth: string
  /** The "As of" date from the CSV */
  asOfDate: string
  /** The date to use for the snapshot (last day of data month for closing periods) */
  snapshotDate: string
  /** The actual collection date */
  collectionDate: string
}

/**
 * Dependencies required by ClosingPeriodDetector
 */
export interface ClosingPeriodDetectorDependencies {
  /** Logger instance for diagnostic output */
  logger: Logger
}

/**
 * Detects and handles Toastmasters month-end closing periods
 *
 * A closing period occurs when the Toastmasters dashboard publishes data
 * for a prior month (data month) with an "As of" date in the current month.
 * During closing periods, snapshots should be dated as the last day of the
 * data month, not the "As of" date.
 */
export class ClosingPeriodDetector {
  private readonly logger: Logger

  constructor(dependencies: ClosingPeriodDetectorDependencies) {
    this.logger = dependencies.logger
  }

  /**
   * Detect if CSV data represents a closing period
   *
   * @param csvDate - The "As of" date from the CSV (YYYY-MM-DD)
   * @param dataMonth - The month the statistics represent (YYYY-MM or MM)
   * @returns Closing period detection result
   */
  detect(csvDate: string, dataMonth: string): ClosingPeriodResult {
    try {
      // Parse the CSV date (As of date)
      // IMPORTANT: Use UTC methods to ensure consistent behavior across timezones
      // The csvDate is in ISO format (YYYY-MM-DD), so we need UTC parsing
      const csvDateObj = new Date(csvDate)

      if (isNaN(csvDateObj.getTime())) {
        this.logger.warn('Invalid CSV date format', { csvDate })
        return this.createNonClosingPeriodResult(csvDate, dataMonth)
      }

      const csvYear = csvDateObj.getUTCFullYear()
      const csvMonth = csvDateObj.getUTCMonth() + 1 // getUTCMonth() returns 0-11

      // Parse the data month
      const parsedDataMonth = this.parseDataMonth(dataMonth, csvYear, csvMonth)

      if (!parsedDataMonth) {
        this.logger.warn(
          'Invalid data month format, treating as non-closing period',
          { dataMonth, csvDate }
        )
        return this.createNonClosingPeriodResult(csvDate, dataMonth)
      }

      const { year: dataYear, month: dataMonthNum } = parsedDataMonth

      // Check if this is a closing period (data month < As of month, accounting for year)
      const isClosingPeriod =
        dataYear < csvYear || (dataYear === csvYear && dataMonthNum < csvMonth)

      if (isClosingPeriod) {
        // Calculate the last day of the data month using UTC to avoid timezone issues
        const lastDay = this.getLastDayOfMonth(dataYear, dataMonthNum)
        const snapshotDate = `${dataYear}-${dataMonthNum.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`

        this.logger.info('Closing period detected', {
          csvDate,
          dataMonth: `${dataYear}-${dataMonthNum.toString().padStart(2, '0')}`,
          snapshotDate,
          isClosingPeriod: true,
        })

        return {
          isClosingPeriod: true,
          dataMonth: `${dataYear}-${dataMonthNum.toString().padStart(2, '0')}`,
          asOfDate: csvDate,
          snapshotDate,
          collectionDate: csvDate,
        }
      } else {
        // Not a closing period - use CSV date as-is
        return {
          isClosingPeriod: false,
          dataMonth: `${dataYear}-${dataMonthNum.toString().padStart(2, '0')}`,
          asOfDate: csvDate,
          snapshotDate: csvDate,
          collectionDate: csvDate,
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      this.logger.error(
        'Error detecting closing period, treating as non-closing period',
        { csvDate, dataMonth, error: errorMessage }
      )

      // Fallback to non-closing period behavior
      return this.createNonClosingPeriodResult(csvDate, dataMonth)
    }
  }

  /**
   * Calculate the last day of a given month
   *
   * Uses UTC to avoid timezone issues. Day 0 of month N+1 gives the last day of month N.
   *
   * @param year - The year
   * @param month - The month (1-12)
   * @returns The last day of the month (1-31)
   */
  getLastDayOfMonth(year: number, month: number): number {
    // Day 0 of month N+1 gives the last day of month N
    return new Date(Date.UTC(year, month, 0)).getUTCDate()
  }

  /**
   * Parse a data month string into year and month components
   *
   * Handles both YYYY-MM and MM formats. For MM format, infers the year
   * based on the reference date, handling cross-year scenarios.
   *
   * @param dataMonth - Data month in YYYY-MM or MM format
   * @param referenceYear - Reference year for MM format
   * @param referenceMonth - Reference month for cross-year detection
   * @returns Parsed year and month, or null if invalid
   */
  parseDataMonth(
    dataMonth: string,
    referenceYear: number,
    referenceMonth: number
  ): { year: number; month: number } | null {
    let dataYear: number
    let dataMonthNum: number

    if (dataMonth.includes('-')) {
      // Format: "YYYY-MM"
      const parts = dataMonth.split('-')
      const yearStr = parts[0]
      const monthStr = parts[1]

      if (!yearStr || !monthStr) {
        return null
      }

      dataYear = parseInt(yearStr, 10)
      dataMonthNum = parseInt(monthStr, 10)
    } else {
      // Format: "MM" - assume same year as reference date initially
      dataMonthNum = parseInt(dataMonth, 10)
      dataYear = referenceYear

      // Handle cross-year scenario: if data month > reference month, data is from previous year
      if (dataMonthNum > referenceMonth) {
        dataYear = referenceYear - 1
      }
    }

    // Validate parsed values
    if (
      isNaN(dataYear) ||
      isNaN(dataMonthNum) ||
      dataMonthNum < 1 ||
      dataMonthNum > 12
    ) {
      return null
    }

    return { year: dataYear, month: dataMonthNum }
  }

  /**
   * Create a non-closing period result with safe fallback values
   *
   * @param csvDate - The CSV date to use as fallback
   * @param dataMonth - The original data month string
   * @returns A ClosingPeriodResult indicating no closing period
   */
  private createNonClosingPeriodResult(
    csvDate: string,
    dataMonth: string
  ): ClosingPeriodResult {
    return {
      isClosingPeriod: false,
      dataMonth,
      asOfDate: csvDate,
      snapshotDate: csvDate,
      collectionDate: csvDate,
    }
  }
}
