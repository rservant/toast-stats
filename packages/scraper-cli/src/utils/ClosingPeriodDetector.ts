/**
 * ClosingPeriodDetector - Detects and handles Toastmasters month-end closing periods
 *
 * A closing period occurs when the Toastmasters dashboard publishes data
 * for a prior month (data month) with an "As of" date in the current month.
 * During closing periods, snapshots should be dated as the last day of the
 * data month, not the "As of" date.
 *
 * This module is ported from backend/src/services/ClosingPeriodDetector.ts
 * and adapted for the scraper-cli context.
 *
 * Requirements:
 * - 2.1: WHEN `isClosingPeriod` is true THEN the TransformService SHALL calculate the last day of the data month
 * - 2.3: WHEN the data month is December and the collection date is in January THEN the snapshot SHALL be dated December 31 of the prior year
 *
 * @module ClosingPeriodDetector
 */

import type { CacheMetadata } from '../types/index.js'

/**
 * Result of closing period detection
 *
 * This interface matches the design document specification for ClosingPeriodInfo
 */
export interface ClosingPeriodInfo {
  /** Whether the data represents a closing period */
  isClosingPeriod: boolean
  /** The month the data represents (YYYY-MM format) */
  dataMonth: string
  /** The actual "As of" date when data was collected (YYYY-MM-DD format) */
  collectionDate: string
  /** The date to use for the snapshot directory (YYYY-MM-DD format) */
  snapshotDate: string
  /** Same as snapshotDate for closing periods, represents the logical date of the data */
  logicalDate: string
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
  /**
   * Detect closing period from cache metadata and determine appropriate snapshot date
   *
   * @param requestedDate - The date that was requested for scraping (YYYY-MM-DD)
   * @param metadata - Cache metadata containing isClosingPeriod and dataMonth fields
   * @returns ClosingPeriodInfo with appropriate snapshot date
   */
  detect(
    requestedDate: string,
    metadata: CacheMetadata | null
  ): ClosingPeriodInfo {
    // If no metadata or not a closing period, use requested date as-is
    if (!metadata || !metadata.isClosingPeriod || !metadata.dataMonth) {
      return this.createNonClosingPeriodResult(requestedDate)
    }

    try {
      // Parse the requested date to get reference year and month
      const requestedDateObj = new Date(requestedDate)

      if (isNaN(requestedDateObj.getTime())) {
        // Invalid requested date, fall back to non-closing period behavior
        return this.createNonClosingPeriodResult(requestedDate)
      }

      const referenceYear = requestedDateObj.getUTCFullYear()
      const referenceMonth = requestedDateObj.getUTCMonth() + 1 // getUTCMonth() returns 0-11

      // Parse the data month
      const parsedDataMonth = this.parseDataMonth(
        metadata.dataMonth,
        referenceYear,
        referenceMonth
      )

      if (!parsedDataMonth) {
        // Invalid data month format, fall back to non-closing period behavior
        return this.createNonClosingPeriodResult(requestedDate)
      }

      const { year: dataYear, month: dataMonthNum } = parsedDataMonth

      // Calculate the last day of the data month
      const lastDay = this.getLastDayOfMonth(dataYear, dataMonthNum)
      const snapshotDate = `${dataYear}-${dataMonthNum.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`
      const formattedDataMonth = `${dataYear}-${dataMonthNum.toString().padStart(2, '0')}`

      return {
        isClosingPeriod: true,
        dataMonth: formattedDataMonth,
        collectionDate: requestedDate,
        snapshotDate,
        logicalDate: snapshotDate,
      }
    } catch {
      // On any error, fall back to non-closing period behavior
      return this.createNonClosingPeriodResult(requestedDate)
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
   *
   * Requirements:
   * - 2.1: WHEN `isClosingPeriod` is true THEN the TransformService SHALL calculate the last day of the data month
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
   *
   * Requirements:
   * - 2.3: WHEN the data month is December and the collection date is in January THEN the snapshot SHALL be dated December 31 of the prior year
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
      // Example: data month is 12 (December), reference month is 1 (January)
      // This means December data collected in January, so data year is previous year
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
   * Create a non-closing period result with the requested date
   *
   * @param requestedDate - The requested date to use as snapshot date
   * @returns A ClosingPeriodInfo indicating no closing period
   */
  private createNonClosingPeriodResult(
    requestedDate: string
  ): ClosingPeriodInfo {
    // Extract YYYY-MM from the requested date for dataMonth
    const dataMonth = requestedDate.substring(0, 7)

    return {
      isClosingPeriod: false,
      dataMonth,
      collectionDate: requestedDate,
      snapshotDate: requestedDate,
      logicalDate: requestedDate,
    }
  }
}
