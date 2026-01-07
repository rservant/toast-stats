/**
 * Month-End Data Mapper Service
 *
 * Handles the complex logic of mapping month-end closing period CSV data
 * to appropriate processed data dates. This service implements the strategy
 * where:
 * 1. CSV files are stored by actual dashboard date
 * 2. Last day of month uses final closing period data
 * 3. Early month days may have no data during closing periods
 */

import { promises as fs } from 'fs'
import * as path from 'path'
import {
  IMonthEndDataMapper,
  MonthEndClosingInfo,
} from '../types/rawCSVCache.js'
import {
  ILogger,
  ICacheConfigService,
  IRawCSVCacheService,
} from '../types/serviceInterfaces.js'

export class MonthEndDataMapper implements IMonthEndDataMapper {
  private readonly logger: ILogger
  private readonly cacheConfigService: ICacheConfigService
  private readonly rawCSVCache: IRawCSVCacheService
  private readonly cacheDir: string

  constructor(
    cacheConfigService: ICacheConfigService,
    rawCSVCache: IRawCSVCacheService,
    logger: ILogger
  ) {
    this.cacheConfigService = cacheConfigService
    this.rawCSVCache = rawCSVCache
    this.logger = logger

    // Use the cache config service to get the base directory
    const baseDir = this.cacheConfigService.getCacheDirectory()
    this.cacheDir = path.join(baseDir, 'raw-csv')

    this.logger.info('MonthEndDataMapper initialized', {
      cacheDir: this.cacheDir,
    })
  }

  /**
   * Determine if a date falls during a month-end closing period
   */
  detectClosingPeriod(
    requestedDate: string,
    actualDashboardDate: string
  ): MonthEndClosingInfo {
    const requested = new Date(requestedDate + 'T00:00:00')
    const actual = new Date(actualDashboardDate + 'T00:00:00')

    // If dates are the same, not a closing period
    if (requestedDate === actualDashboardDate) {
      return {
        isClosingPeriod: false,
        dataMonth: `${requested.getFullYear()}-${String(requested.getMonth() + 1).padStart(2, '0')}`,
        actualDate: actualDashboardDate,
        requestedDate,
      }
    }

    // If actual date is in a different month than requested, likely closing period
    const requestedMonth = requested.getMonth()
    const actualMonth = actual.getMonth()
    const requestedYear = requested.getFullYear()
    const actualYear = actual.getFullYear()

    const isClosingPeriod =
      actualYear > requestedYear ||
      (actualYear === requestedYear && actualMonth > requestedMonth)

    // Data month is the month being closed (typically the requested month)
    const dataMonth = `${requestedYear}-${String(requestedMonth + 1).padStart(2, '0')}`

    return {
      isClosingPeriod,
      dataMonth,
      actualDate: actualDashboardDate,
      requestedDate,
    }
  }

  /**
   * Get the appropriate CSV date for a given processed data date
   * Returns null if no data should be available (expected gap)
   */
  async getCSVDateForProcessedDate(
    processedDate: string
  ): Promise<string | null> {
    try {
      const processedDateObj = new Date(processedDate + 'T00:00:00')
      const processedMonth = processedDateObj.getMonth() + 1
      const processedYear = processedDateObj.getFullYear()

      // Check if this is the last day of the month
      const isLastDayOfMonth = this.isLastDayOfMonth(processedDate)

      if (isLastDayOfMonth) {
        // For last day of month, find the final closing period data
        return await this.getMonthEndData(
          `${processedYear}-${String(processedMonth).padStart(2, '0')}`,
          processedYear
        )
      }

      // Check if we're in a closing period (regardless of day of month)
      const isInClosingPeriod = await this.isExpectedDataGap(processedDate)
      if (isInClosingPeriod) {
        this.logger.debug('Expected data gap during closing period', {
          processedDate,
          reason: 'month_end_closing_period',
        })
        return null // Expected gap
      }

      // Normal case: look for CSV data from same date or 1-2 days prior
      const candidateDates = [
        processedDate,
        this.subtractDays(processedDate, 1),
        this.subtractDays(processedDate, 2),
      ]

      for (const candidateDate of candidateDates) {
        const hasData = await this.hasCSVDataForDate(candidateDate)
        if (hasData) {
          this.logger.debug('Found CSV data for processed date', {
            processedDate,
            csvDate: candidateDate,
          })
          return candidateDate
        }
      }

      // No data found - could be expected gap or missing data
      this.logger.warn('No CSV data found for processed date', {
        processedDate,
        candidateDates,
      })
      return null
    } catch (error) {
      this.logger.error('Failed to get CSV date for processed date', {
        processedDate,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      return null
    }
  }

  /**
   * Get the last day data for a given month (uses closing period data)
   */
  async getMonthEndData(month: string, year: number): Promise<string | null> {
    try {
      // month format: "YYYY-MM"
      const [, monthStr] = month.split('-')
      if (!monthStr) {
        this.logger.error('Invalid month format', { month })
        return null
      }
      const monthNum = parseInt(monthStr, 10)

      this.logger.debug('Looking for month-end data', { month, year })

      // Get all cached dates
      const cachedDates = await this.rawCSVCache.getCachedDates()

      // Filter for dates that might contain closing period data for this month
      const closingPeriodCandidates: string[] = []

      for (const date of cachedDates) {
        try {
          const metadata = await this.rawCSVCache.getCacheMetadata(date)
          if (metadata?.isClosingPeriod && metadata.dataMonth === month) {
            closingPeriodCandidates.push(date)
          }
        } catch (metadataError) {
          // If we can't read metadata, skip this date
          this.logger.warn(
            'Failed to read metadata for month-end data detection',
            {
              date,
              error:
                metadataError instanceof Error
                  ? metadataError.message
                  : 'Unknown error',
            }
          )
          continue
        }
      }

      if (closingPeriodCandidates.length === 0) {
        // No closing period data found, try the last day of the month directly
        const lastDay = this.getLastDayOfMonth(year, monthNum)
        const lastDayStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

        const hasDirectData = await this.hasCSVDataForDate(lastDayStr)
        if (hasDirectData) {
          this.logger.debug('Found direct month-end data', {
            month,
            csvDate: lastDayStr,
          })
          return lastDayStr
        }

        this.logger.warn('No month-end data found', { month, year })
        return null
      }

      // Sort closing period candidates by date (latest first)
      closingPeriodCandidates.sort((a, b) => b.localeCompare(a))
      const latestClosingData = closingPeriodCandidates[0]

      if (!latestClosingData) {
        this.logger.warn('No closing period data found after sorting', {
          month,
          year,
        })
        return null
      }

      this.logger.info('Found month-end closing period data', {
        month,
        year,
        csvDate: latestClosingData,
        totalCandidates: closingPeriodCandidates.length,
      })

      return latestClosingData
    } catch (error) {
      this.logger.error('Failed to get month-end data', {
        month,
        year,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      return null
    }
  }

  /**
   * Check if a date should have no data due to closing period
   */
  async isExpectedDataGap(date: string): Promise<boolean> {
    try {
      const dateObj = new Date(date + 'T00:00:00')
      const month = dateObj.getMonth() + 1
      const year = dateObj.getFullYear()

      // Check if previous month has closing period data extending into this month
      const prevMonth = month === 1 ? 12 : month - 1
      const prevYear = month === 1 ? year - 1 : year
      const prevMonthStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}`

      // Get all cached dates
      const cachedDates = await this.rawCSVCache.getCachedDates()

      // Look for closing period data from previous month that extends into current month
      for (const cachedDate of cachedDates) {
        const cachedDateObj = new Date(cachedDate + 'T00:00:00')
        const cachedMonth = cachedDateObj.getMonth() + 1
        const cachedYear = cachedDateObj.getFullYear()

        // Check if this cached date is in current month but represents previous month's data
        if (cachedMonth === month && cachedYear === year) {
          try {
            const metadata = await this.rawCSVCache.getCacheMetadata(cachedDate)
            if (
              metadata?.isClosingPeriod &&
              metadata.dataMonth === prevMonthStr
            ) {
              this.logger.debug(
                'Expected data gap due to previous month closing period',
                {
                  date,
                  previousMonth: prevMonthStr,
                  closingPeriodDate: cachedDate,
                }
              )
              return true
            }
          } catch (metadataError) {
            // If we can't read metadata, continue checking other dates
            this.logger.warn(
              'Failed to read metadata for closing period detection',
              {
                cachedDate,
                error:
                  metadataError instanceof Error
                    ? metadataError.message
                    : 'Unknown error',
              }
            )
            continue
          }
        }
      }

      return false
    } catch (error) {
      this.logger.error('Failed to check for expected data gap', {
        date,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      return false
    }
  }

  /**
   * Check if CSV data exists for a specific date
   */
  private async hasCSVDataForDate(date: string): Promise<boolean> {
    try {
      const datePath = path.join(this.cacheDir, date)
      await fs.access(datePath)

      // Check if directory has any CSV files
      const entries = await fs.readdir(datePath, { withFileTypes: true })
      const hasCsvFiles = entries.some(
        entry => entry.isFile() && entry.name.endsWith('.csv')
      )

      return hasCsvFiles
    } catch {
      return false
    }
  }

  /**
   * Check if a date is the last day of its month
   */
  private isLastDayOfMonth(dateString: string): boolean {
    const date = new Date(dateString + 'T00:00:00')
    const nextDay = new Date(date)
    nextDay.setDate(date.getDate() + 1)

    return nextDay.getMonth() !== date.getMonth()
  }

  /**
   * Get the last day number of a specific month/year
   */
  private getLastDayOfMonth(year: number, month: number): number {
    // month is 1-12
    const lastDay = new Date(year, month, 0) // Day 0 of next month = last day of current month
    return lastDay.getDate()
  }

  /**
   * Subtract days from a date string
   */
  private subtractDays(dateString: string, days: number): string {
    const date = new Date(dateString + 'T00:00:00')
    date.setDate(date.getDate() - days)

    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')

    return `${year}-${month}-${day}`
  }
}
