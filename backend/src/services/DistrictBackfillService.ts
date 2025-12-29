/**
 * District Backfill Service
 *
 * Manages background processing of historical district-level data backfill requests.
 * This service orchestrates fetching all three report types (district, division, club)
 * for each date in a specified range, handling errors gracefully and providing
 * real-time progress updates.
 *
 * Key features:
 * - Background processing: Backfills continue even if user navigates away
 * - Progress tracking: Real-time updates on completed, skipped, failed, and unavailable dates
 * - Error resilience: Continues processing remaining dates even if some fail
 * - Smart caching: Automatically skips dates that are already cached
 * - Atomic operations: All three report types are cached together via DistrictCacheManager
 *
 * @example
 * ```typescript
 * const service = new DistrictBackfillService(cacheManager, scraper);
 * const backfillId = await service.initiateDistrictBackfill({
 *   districtId: '123',
 *   startDate: '2024-07-01',
 *   endDate: '2025-01-15'
 * });
 *
 * // Check status
 * const status = service.getBackfillStatus(backfillId);
 * console.log(`Progress: ${status.progress.completed}/${status.progress.total}`);
 * ```
 */

import { v4 as uuidv4 } from 'uuid'
import { logger } from '../utils/logger.js'
import { RetryManager } from '../utils/RetryManager.js'
import {
  CircuitBreaker,
  CircuitBreakerManager,
  ICircuitBreakerManager,
} from '../utils/CircuitBreaker.js'
import {
  AlertManager,
  AlertSeverity,
  AlertCategory,
} from '../utils/AlertManager.js'
import { DistrictCacheManager } from './DistrictCacheManager.js'
import { ToastmastersScraper } from './ToastmastersScraper.js'
import type { DistrictStatistics, ScrapedRecord } from '../types/districts.js'

export interface DistrictBackfillRequest {
  districtId: string
  startDate?: string
  endDate?: string
}

export interface DistrictBackfillProgress {
  total: number
  completed: number
  skipped: number
  unavailable: number
  failed: number
  current: string
}

export interface DistrictBackfillJob {
  backfillId: string
  districtId: string
  status: 'processing' | 'complete' | 'error'
  progress: DistrictBackfillProgress
  error?: string
  createdAt: number
  completedAt?: number
}

export interface DistrictBackfillResponse {
  backfillId: string
  districtId: string
  status: 'processing' | 'complete' | 'error'
  progress: DistrictBackfillProgress
  error?: string
}

export interface ReconciliationDataFetchResult {
  success: boolean
  data?: DistrictStatistics
  sourceDataDate?: string
  error?: string
  isDataAvailable: boolean
}

export class DistrictBackfillService {
  private jobs: Map<string, DistrictBackfillJob> = new Map()
  private cacheManager: DistrictCacheManager
  private scraper: ToastmastersScraper
  private dashboardCircuitBreaker: CircuitBreaker
  private cacheCircuitBreaker: CircuitBreaker
  private alertManager: AlertManager
  private reconciliationHooks: Array<
    (districtId: string, date: string, data: DistrictStatistics) => void
  > = []

  constructor(
    cacheManager: DistrictCacheManager,
    scraper: ToastmastersScraper,
    alertManager?: AlertManager,
    circuitBreakerManager?: ICircuitBreakerManager
  ) {
    this.cacheManager = cacheManager
    this.scraper = scraper
    this.alertManager = alertManager || new AlertManager()

    // Initialize circuit breakers
    const circuitManager = circuitBreakerManager || new CircuitBreakerManager()
    this.dashboardCircuitBreaker = circuitManager.getCircuitBreaker(
      'dashboard-api',
      {
        failureThreshold: 5,
        recoveryTimeout: 60000,
        monitoringPeriod: 10000,
      }
    )
    this.cacheCircuitBreaker = circuitManager.getCircuitBreaker(
      'cache-operations',
      {
        failureThreshold: 3,
        recoveryTimeout: 30000,
        monitoringPeriod: 5000,
      }
    )
  }

  /**
   * Initiate a district backfill job
   *
   * Creates and starts a new backfill job for the specified district and date range.
   * The job runs in the background and can be monitored via getBackfillStatus().
   *
   * The service automatically:
   * - Validates the date range
   * - Identifies which dates are already cached (skips them)
   * - Generates a list of missing dates to fetch
   * - Starts background processing
   *
   * @param request - Backfill request containing districtId and optional date range
   * @returns The unique backfill job ID for tracking progress
   * @throws {Error} If date range is invalid or all dates are already cached
   *
   * @example
   * ```typescript
   * const backfillId = await service.initiateDistrictBackfill({
   *   districtId: '123',
   *   startDate: '2024-07-01',  // Optional, defaults to program year start
   *   endDate: '2025-01-15'      // Optional, defaults to today
   * });
   * ```
   */
  async initiateDistrictBackfill(
    request: DistrictBackfillRequest
  ): Promise<string> {
    const { districtId, startDate, endDate } = request
    const backfillId = uuidv4()

    // Get program year start date (July 1)
    const programYearStart = this.getProgramYearStart()
    const today = new Date()

    // Parse date range
    const start = startDate ? new Date(startDate) : programYearStart
    const end = endDate ? new Date(endDate) : today

    // Validate date range
    if (start > end) {
      throw new Error('Start date must be before or equal to end date')
    }

    if (end > today) {
      throw new Error('End date cannot be in the future')
    }

    // Generate list of all dates in range
    const allDates: string[] = []
    const currentDate = new Date(start)
    while (currentDate <= end) {
      allDates.push(currentDate.toISOString().split('T')[0])
      currentDate.setDate(currentDate.getDate() + 1)
    }

    if (allDates.length === 0) {
      throw new Error('No dates in the specified range')
    }

    // Check which dates are already cached for this district
    const cachedDates =
      await this.cacheManager.getCachedDatesForDistrict(districtId)
    const cachedSet = new Set(cachedDates)
    const missingDates = allDates.filter(d => !cachedSet.has(d))

    if (missingDates.length === 0) {
      throw new Error(
        'All dates in the range are already cached for this district'
      )
    }

    // Reverse the dates to start with most recent and go backwards
    missingDates.reverse()

    // Create job
    const job: DistrictBackfillJob = {
      backfillId,
      districtId,
      status: 'processing',
      progress: {
        total: missingDates.length,
        completed: 0,
        skipped: allDates.length - missingDates.length,
        unavailable: 0,
        failed: 0,
        current: missingDates[0],
      },
      createdAt: Date.now(),
    }

    this.jobs.set(backfillId, job)

    // Start background processing
    this.processBackfill(backfillId, missingDates).catch(error => {
      logger.error('District backfill processing failed', {
        backfillId,
        districtId,
        error,
      })
      const failedJob = this.jobs.get(backfillId)
      if (failedJob) {
        failedJob.status = 'error'
        failedJob.error = error.message || 'Unknown error occurred'
      }
    })

    logger.info('District backfill initiated', {
      backfillId,
      districtId,
      totalDates: allDates.length,
      missingDates: missingDates.length,
      alreadyCached: allDates.length - missingDates.length,
    })

    return backfillId
  }

  /**
   * Get backfill job status
   *
   * Retrieves the current status and progress of a backfill job.
   *
   * @param backfillId - The unique backfill job ID
   * @returns The job status and progress, or null if job not found
   *
   * @example
   * ```typescript
   * const status = service.getBackfillStatus(backfillId);
   * if (status) {
   *   console.log(`Status: ${status.status}`);
   *   console.log(`Progress: ${status.progress.completed}/${status.progress.total}`);
   *   console.log(`Failed: ${status.progress.failed}`);
   * }
   * ```
   */
  getBackfillStatus(backfillId: string): DistrictBackfillResponse | null {
    const job = this.jobs.get(backfillId)

    if (!job) {
      return null
    }

    return {
      backfillId: job.backfillId,
      districtId: job.districtId,
      status: job.status,
      progress: job.progress,
      error: job.error,
    }
  }

  /**
   * Cancel a backfill job
   */
  async cancelBackfill(backfillId: string): Promise<boolean> {
    const job = this.jobs.get(backfillId)

    if (!job) {
      return false
    }

    if (job.status === 'processing') {
      job.status = 'error'
      job.error = 'Backfill cancelled by user'
      job.completedAt = Date.now()

      logger.info('District backfill cancelled', {
        backfillId,
        districtId: job.districtId,
      })
      return true
    }

    return false
  }

  /**
   * Clean up old completed jobs (older than 1 hour)
   */
  async cleanupOldJobs(): Promise<void> {
    const oneHourAgo = Date.now() - 60 * 60 * 1000
    const jobsToDelete: string[] = []

    for (const [backfillId, job] of this.jobs.entries()) {
      if (job.createdAt < oneHourAgo && job.status !== 'processing') {
        jobsToDelete.push(backfillId)
      }
    }

    jobsToDelete.forEach(id => this.jobs.delete(id))

    if (jobsToDelete.length > 0) {
      logger.info('Cleaned up old district backfill jobs', {
        count: jobsToDelete.length,
      })
    }
  }

  /**
   * Fetch current district data for reconciliation monitoring
   *
   * This method is specifically designed for reconciliation processes to fetch
   * the latest available data from the dashboard and extract the source data date.
   * Uses comprehensive error handling with retry logic and circuit breaker.
   *
   * @param districtId - The district ID to fetch data for
   * @param targetDate - The target date to fetch data for (usually month-end date)
   * @returns ReconciliationDataFetchResult with data and source date information
   */
  async fetchReconciliationData(
    districtId: string,
    targetDate: string
  ): Promise<ReconciliationDataFetchResult> {
    logger.info('Fetching reconciliation data', { districtId, targetDate })

    const context = {
      districtId,
      targetDate,
      operation: 'fetchReconciliationData',
    }

    try {
      // Execute with circuit breaker and retry logic
      const result = await this.dashboardCircuitBreaker.execute(async () => {
        return await RetryManager.executeWithRetry(
          async () => {
            // Fetch all three report types for the specific date
            const [districtPerformance, divisionPerformance, clubPerformance] =
              await Promise.all([
                this.scraper.getDistrictPerformance(districtId, targetDate),
                this.scraper.getDivisionPerformance(districtId, targetDate),
                this.scraper.getClubPerformance(districtId, targetDate),
              ])

            return { districtPerformance, divisionPerformance, clubPerformance }
          },
          RetryManager.getDashboardRetryOptions(),
          context
        )
      }, context)

      if (!result.success) {
        // Check if it's a "date not available" error vs actual failure
        const errorMessage = result.error?.message || 'Unknown error'

        if (this.isDateUnavailableError(errorMessage)) {
          logger.info('No data available for reconciliation date', {
            districtId,
            targetDate,
          })
          return {
            success: true,
            isDataAvailable: false,
            error: 'No data available for the specified date',
          }
        }

        // Actual error - send alert for extended failures
        if (result.attempts >= 3) {
          await this.alertManager.sendDashboardUnavailableAlert(
            result.totalDuration,
            errorMessage,
            ['reconciliation-data-fetch']
          )
        }

        logger.error('Failed to fetch reconciliation data after retries', {
          districtId,
          targetDate,
          attempts: result.attempts,
          totalDuration: result.totalDuration,
          error: errorMessage,
        })

        return {
          success: false,
          isDataAvailable: false,
          error: errorMessage,
        }
      }

      const { districtPerformance, divisionPerformance, clubPerformance } =
        result.result!

      // Check if we got valid data
      if (
        districtPerformance.length === 0 &&
        divisionPerformance.length === 0 &&
        clubPerformance.length === 0
      ) {
        logger.info('No data available for reconciliation date', {
          districtId,
          targetDate,
        })
        return {
          success: true,
          isDataAvailable: false,
          error: 'No data available for the specified date',
        }
      }

      // Extract source data date from the dashboard
      const sourceDataDate = this.extractSourceDataDate(
        districtPerformance,
        divisionPerformance,
        clubPerformance,
        targetDate
      )

      // Convert raw data to DistrictStatistics format
      const districtStats = this.convertToDistrictStatistics(
        districtId,
        sourceDataDate,
        districtPerformance,
        divisionPerformance,
        clubPerformance
      )

      // Validate data quality
      const qualityIssues = this.validateDataQuality(
        districtStats,
        districtId,
        targetDate
      )
      if (qualityIssues.length > 0) {
        await this.alertManager.sendDataQualityAlert(
          districtId,
          targetDate,
          'Data quality validation failed',
          { issues: qualityIssues }
        )
      }

      logger.info('Reconciliation data fetched successfully', {
        districtId,
        targetDate,
        sourceDataDate,
        districtRecords: districtPerformance.length,
        divisionRecords: divisionPerformance.length,
        clubRecords: clubPerformance.length,
        totalMembers: districtStats.membership.total,
        attempts: result.attempts,
        duration: result.totalDuration,
      })

      return {
        success: true,
        data: districtStats,
        sourceDataDate,
        isDataAvailable: true,
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)

      logger.error('Critical error in reconciliation data fetch', {
        districtId,
        targetDate,
        error: errorMessage,
      })

      // Send alert for critical errors
      await this.alertManager.sendAlert(
        AlertSeverity.HIGH,
        AlertCategory.RECONCILIATION,
        'Reconciliation Data Fetch Failed',
        `Critical error fetching reconciliation data for district ${districtId}, date ${targetDate}: ${errorMessage}`,
        { districtId, targetDate, error: errorMessage }
      )

      return {
        success: false,
        isDataAvailable: false,
        error: errorMessage,
      }
    }
  }

  /**
   * Get cached district data for reconciliation comparison
   *
   * @param districtId - The district ID
   * @param targetDate - The target date (usually month-end date)
   * @returns DistrictStatistics from cache or null if not found
   */
  async getCachedReconciliationData(
    districtId: string,
    targetDate: string
  ): Promise<DistrictStatistics | null> {
    logger.debug('Getting cached reconciliation data', {
      districtId,
      targetDate,
    })

    const context = {
      districtId,
      targetDate,
      operation: 'getCachedReconciliationData',
    }

    try {
      // Execute with circuit breaker and retry logic for cache operations
      const result = await this.cacheCircuitBreaker.execute(async () => {
        return await RetryManager.executeWithRetry(
          async () => {
            // Check if we have cached data for this date
            const cachedDates =
              await this.cacheManager.getCachedDatesForDistrict(districtId)

            if (!cachedDates.includes(targetDate)) {
              return null
            }

            // Get the cached data
            const cachedData = await this.cacheManager.getDistrictData(
              districtId,
              targetDate
            )

            if (!cachedData) {
              logger.warn('Cached date exists but data not found', {
                districtId,
                targetDate,
              })
              return null
            }

            return cachedData
          },
          RetryManager.getCacheRetryOptions(),
          context
        )
      }, context)

      if (!result.success) {
        logger.error('Failed to get cached reconciliation data', {
          districtId,
          targetDate,
          attempts: result.attempts,
          error: result.error?.message,
        })
        return null
      }

      const cachedData = result.result
      if (!cachedData) {
        logger.debug('No cached data found for reconciliation date', {
          districtId,
          targetDate,
        })
        return null
      }

      // Convert cached data to DistrictStatistics format
      const districtStats = this.convertToDistrictStatistics(
        districtId,
        targetDate, // Use target date as source date for cached data
        cachedData.districtPerformance,
        cachedData.divisionPerformance,
        cachedData.clubPerformance
      )

      logger.debug('Cached reconciliation data retrieved', {
        districtId,
        targetDate,
        totalMembers: districtStats.membership.total,
      })

      return districtStats
    } catch (error) {
      logger.error('Critical error getting cached reconciliation data', {
        districtId,
        targetDate,
        error: error instanceof Error ? error.message : String(error),
      })
      return null
    }
  }

  /**
   * Register a reconciliation monitoring hook
   *
   * This allows the reconciliation system to be notified when new data
   * is fetched during regular backfill operations.
   *
   * @param callback - Function to call when data is fetched
   */
  onDataFetched(
    callback: (
      districtId: string,
      date: string,
      data: DistrictStatistics
    ) => void
  ): void {
    // Store the callback for use in processBackfill
    this.reconciliationHooks = this.reconciliationHooks || []
    this.reconciliationHooks.push(callback)

    logger.debug('Reconciliation monitoring hook registered')
  }

  /**
   * Check if an error indicates date unavailability vs actual failure
   */
  private isDateUnavailableError(errorMessage: string): boolean {
    const message = errorMessage.toLowerCase()
    return (
      message.includes('not available') ||
      message.includes('dashboard returned') ||
      message.includes('date selection failed') ||
      message.includes('not found') ||
      message.includes('404')
    )
  }

  /**
   * Validate data quality and return list of issues
   */
  private validateDataQuality(
    districtStats: DistrictStatistics,
    _districtId: string,
    _date: string
  ): string[] {
    const issues: string[] = []

    // Check for suspiciously low membership
    if (districtStats.clubs.total > 0 && districtStats.membership.total < 100) {
      issues.push(
        `Suspiciously low membership: ${districtStats.membership.total} total members`
      )
    }

    // Check for zero clubs but positive membership
    if (districtStats.clubs.total === 0 && districtStats.membership.total > 0) {
      issues.push('Zero clubs but positive membership count')
    }

    // Check for negative values
    if (districtStats.membership.total < 0) {
      issues.push('Negative membership count')
    }

    if (districtStats.clubs.total < 0) {
      issues.push('Negative club count')
    }

    // Check for impossible ratios
    if (districtStats.clubs.distinguished > districtStats.clubs.total) {
      issues.push('More distinguished clubs than total clubs')
    }

    if (
      districtStats.clubs.active +
        districtStats.clubs.suspended +
        districtStats.clubs.ineligible >
      districtStats.clubs.total
    ) {
      issues.push('Sum of club statuses exceeds total clubs')
    }

    return issues
  }

  /**
   * Get program year start date (July 1 of current or previous year)
   */
  private getProgramYearStart(): Date {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() // 0-11

    // If we're before July (month 6), use previous year's July 1
    // Otherwise use current year's July 1
    const programYearStartYear =
      currentMonth < 6 ? currentYear - 1 : currentYear
    return new Date(programYearStartYear, 6, 1) // Month 6 = July
  }

  /**
   * Extract source data date from dashboard data
   *
   * This method attempts to extract the "as of" date from the dashboard data.
   * The dashboard often shows data with a note like "Data as of November 15, 2024"
   *
   * @param districtPerformance - District performance data
   * @param divisionPerformance - Division performance data
   * @param clubPerformance - Club performance data
   * @param fallbackDate - Fallback date if no source date can be extracted
   * @returns The extracted source data date or fallback date
   */
  private extractSourceDataDate(
    districtPerformance: ScrapedRecord[],
    divisionPerformance: ScrapedRecord[],
    clubPerformance: ScrapedRecord[],
    fallbackDate: string
  ): string {
    // Look for date indicators in the data
    // The dashboard sometimes includes metadata about when the data was last updated

    // Check district performance data first (most likely to have metadata)
    const sourceDate =
      this.findSourceDateInData(districtPerformance) ||
      this.findSourceDateInData(divisionPerformance) ||
      this.findSourceDateInData(clubPerformance)

    if (sourceDate) {
      logger.debug('Source data date extracted from dashboard', {
        sourceDate,
        fallbackDate,
      })
      return sourceDate
    }

    // If no source date found, use the fallback date
    logger.debug('No source data date found, using fallback', { fallbackDate })
    return fallbackDate
  }

  /**
   * Search for source date indicators in data records
   *
   * @param data - Array of data records to search
   * @returns Extracted date string or null if not found
   */
  private findSourceDateInData(data: ScrapedRecord[]): string | null {
    if (!data || data.length === 0) {
      return null
    }

    // Look through the data for date-related fields or metadata
    for (const record of data) {
      if (typeof record === 'object' && record !== null) {
        // Check for common date field names
        const dateFields = [
          'asOfDate',
          'dataDate',
          'reportDate',
          'lastUpdated',
          'timestamp',
        ]

        for (const field of dateFields) {
          if (record[field] && typeof record[field] === 'string') {
            // Validate that it looks like a date
            const dateMatch = record[field].match(/\d{4}-\d{2}-\d{2}/)
            if (dateMatch) {
              return dateMatch[0]
            }
          }
        }

        // Look for date patterns in any string field
        for (const [, value] of Object.entries(record)) {
          if (typeof value === 'string') {
            // Look for patterns like "as of November 15, 2024" or "Data as of 2024-11-15"
            const asOfMatch = value.match(
              /as of\s+(\w+\s+\d{1,2},\s+\d{4}|\d{4}-\d{2}-\d{2})/i
            )
            if (asOfMatch) {
              const dateStr = asOfMatch[1]
              // Try to parse and convert to YYYY-MM-DD format
              try {
                const parsedDate = new Date(dateStr)
                if (!isNaN(parsedDate.getTime())) {
                  return parsedDate.toISOString().split('T')[0]
                }
              } catch {
                // Continue searching
              }
            }

            // Look for direct date patterns
            const directDateMatch = value.match(/\d{4}-\d{2}-\d{2}/)
            if (directDateMatch) {
              return directDateMatch[0]
            }
          }
        }
      }
    }

    return null
  }

  /**
   * Convert raw dashboard data to DistrictStatistics format
   *
   * @param districtId - The district ID
   * @param asOfDate - The source data date
   * @param districtPerformance - District performance data
   * @param divisionPerformance - Division performance data
   * @param clubPerformance - Club performance data
   * @returns DistrictStatistics object
   */
  private convertToDistrictStatistics(
    districtId: string,
    asOfDate: string,
    _districtPerformance: ScrapedRecord[],
    _divisionPerformance: ScrapedRecord[],
    clubPerformance: ScrapedRecord[]
  ): DistrictStatistics {
    // Calculate membership statistics from club data
    const totalMembers = clubPerformance.reduce((sum, club) => {
      const members = parseInt(
        (club['Active Members'] || club['Membership'] || '0').toString()
      )
      return sum + (isNaN(members) ? 0 : members)
    }, 0)

    // Calculate club statistics
    const totalClubs = clubPerformance.length
    const activeClubs = clubPerformance.filter(
      club =>
        club['Status'] === 'Active' || !club['Status'] || club['Status'] === ''
    ).length

    const suspendedClubs = clubPerformance.filter(
      club => club['Status'] === 'Suspended'
    ).length

    const ineligibleClubs = clubPerformance.filter(
      club => club['Status'] === 'Ineligible'
    ).length

    const lowClubs = clubPerformance.filter(club => {
      const members = parseInt(
        (club['Active Members'] || club['Membership'] || '0').toString()
      )
      return !isNaN(members) && members < 20 // Typically low membership threshold
    }).length

    // Calculate distinguished clubs
    const distinguishedClubs = clubPerformance.filter(club => {
      // Look for distinguished status indicators
      return (
        club['Distinguished Status'] === 'Distinguished' ||
        club['Distinguished Status'] === 'Select Distinguished' ||
        club['Distinguished Status'] === "President's Distinguished" ||
        club['DCP Status'] === 'Distinguished' ||
        club['DCP Status'] === 'Select Distinguished' ||
        club['DCP Status'] === "President's Distinguished"
      )
    }).length

    // Calculate education statistics (simplified)
    const totalAwards = clubPerformance.reduce((sum, club) => {
      const awards = parseInt(
        (club['Awards'] || club['Total Awards'] || '0').toString()
      )
      return sum + (isNaN(awards) ? 0 : awards)
    }, 0)

    return {
      districtId,
      asOfDate,
      membership: {
        total: totalMembers,
        change: 0, // Would need historical data to calculate
        changePercent: 0, // Would need historical data to calculate
        byClub: clubPerformance.map(club => ({
          clubId: (club['Club Number'] || club['Club ID'] || '').toString(),
          clubName: (club['Club Name'] || '').toString(),
          memberCount:
            parseInt(
              (club['Active Members'] || club['Membership'] || '0').toString()
            ) || 0,
        })),
      },
      clubs: {
        total: totalClubs,
        active: activeClubs,
        suspended: suspendedClubs,
        ineligible: ineligibleClubs,
        low: lowClubs,
        distinguished: distinguishedClubs,
      },
      education: {
        totalAwards,
        byType: [], // Would need more detailed parsing
        topClubs: [], // Would need more detailed parsing
        byMonth: [], // Would need historical data
      },
    }
  }

  /**
   * Process backfill in background
   * This is the core logic that fetches all three report types for each date
   */
  private async processBackfill(
    backfillId: string,
    dates: string[]
  ): Promise<void> {
    const job = this.jobs.get(backfillId)
    if (!job) {
      throw new Error('Job not found')
    }

    const { districtId } = job

    try {
      let successCount = 0

      // Process each date
      for (let i = 0; i < dates.length; i++) {
        const date = dates[i]

        // Check if job was cancelled
        if (job.status === 'error') {
          logger.info('Job cancelled, stopping processing', {
            backfillId,
            districtId,
          })
          return
        }

        // Update progress
        job.progress.current = date
        job.progress.completed = i

        try {
          logger.info('Fetching district data for date', {
            backfillId,
            districtId,
            date,
          })

          // Fetch all three report types for the specific date
          const [districtPerformance, divisionPerformance, clubPerformance] =
            await Promise.all([
              this.scraper.getDistrictPerformance(districtId, date),
              this.scraper.getDivisionPerformance(districtId, date),
              this.scraper.getClubPerformance(districtId, date),
            ])

          // Check if we got valid data
          if (
            districtPerformance.length > 0 ||
            divisionPerformance.length > 0 ||
            clubPerformance.length > 0
          ) {
            // Validate data quality - check if membership data looks reasonable
            const totalMembers = clubPerformance.reduce((sum, club) => {
              const members = parseInt(
                String(club['Active Members'] || club['Membership'] || '0')
              )
              return sum + (isNaN(members) ? 0 : members)
            }, 0)

            // If we have clubs but suspiciously low membership (< 100 total), skip this date
            // This indicates a data reconciliation period where the dashboard shows incomplete data
            if (clubPerformance.length > 0 && totalMembers < 100) {
              job.progress.unavailable++
              logger.warn(
                'Skipping date with suspiciously low membership data (likely reconciliation period)',
                {
                  backfillId,
                  districtId,
                  date,
                  clubCount: clubPerformance.length,
                  totalMembers,
                }
              )
            } else {
              // Cache all three reports together (atomic operation)
              await this.cacheManager.cacheDistrictData(
                districtId,
                date,
                districtPerformance,
                divisionPerformance,
                clubPerformance
              )

              // Trigger reconciliation hooks if any are registered
              if (
                this.reconciliationHooks &&
                this.reconciliationHooks.length > 0
              ) {
                try {
                  const districtStats = this.convertToDistrictStatistics(
                    districtId,
                    date,
                    districtPerformance,
                    divisionPerformance,
                    clubPerformance
                  )

                  for (const hook of this.reconciliationHooks) {
                    try {
                      hook(districtId, date, districtStats)
                    } catch (hookError) {
                      logger.warn('Reconciliation hook failed', {
                        backfillId,
                        districtId,
                        date,
                        error:
                          hookError instanceof Error
                            ? hookError.message
                            : String(hookError),
                      })
                    }
                  }
                } catch (conversionError) {
                  logger.warn(
                    'Failed to convert data for reconciliation hooks',
                    {
                      backfillId,
                      districtId,
                      date,
                      error:
                        conversionError instanceof Error
                          ? conversionError.message
                          : String(conversionError),
                    }
                  )
                }
              }

              successCount++
              logger.info(
                'Successfully fetched and cached district data for date',
                {
                  backfillId,
                  districtId,
                  date,
                  districtRecords: districtPerformance.length,
                  divisionRecords: divisionPerformance.length,
                  clubRecords: clubPerformance.length,
                  totalMembers,
                }
              )
            }
          } else {
            // No data available (blackout period or reconciliation)
            job.progress.unavailable++
            logger.info(
              'No data available for date (expected blackout/reconciliation period)',
              {
                backfillId,
                districtId,
                date,
              }
            )
          }

          // Add a delay to avoid overwhelming the server
          await new Promise(resolve => setTimeout(resolve, 2000))
        } catch (error) {
          // Check if it's a "date not available" error vs actual failure
          const errorMessage =
            error instanceof Error ? error.message : String(error)

          if (
            errorMessage.includes('not available') ||
            errorMessage.includes('dashboard returned') ||
            errorMessage.includes('Date selection failed') ||
            errorMessage.includes('not found') ||
            errorMessage.includes('404')
          ) {
            // Expected - date doesn't exist on dashboard (blackout/reconciliation period)
            job.progress.unavailable++
            logger.info(
              'Date not available on dashboard (blackout/reconciliation period)',
              {
                backfillId,
                districtId,
                date,
              }
            )
          } else {
            // Actual error
            job.progress.failed++
            logger.error('Failed to fetch district data for date', {
              backfillId,
              districtId,
              date,
              error: errorMessage,
            })
          }

          // Continue with next date
        }
      }

      // Update final progress
      job.progress.completed = dates.length
      job.status = 'complete'
      job.completedAt = Date.now()

      logger.info('District backfill completed', {
        backfillId,
        districtId,
        successCount,
        unavailable: job.progress.unavailable,
        failed: job.progress.failed,
        skipped: job.progress.skipped,
        totalProcessed: dates.length,
      })
    } catch (error) {
      logger.error('Error processing district backfill', {
        backfillId,
        districtId,
        error,
      })
      job.status = 'error'
      job.error = error instanceof Error ? error.message : 'Unknown error'
      job.completedAt = Date.now()
      throw error
    }
  }
}
