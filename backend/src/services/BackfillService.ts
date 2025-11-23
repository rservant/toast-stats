/**
 * Backfill Service
 * Handles background processing of historical data backfill requests
 * Only fetches data that isn't already cached
 */

import { v4 as uuidv4 } from 'uuid'
import { logger } from '../utils/logger.js'
import type { BackfillRequest, BackfillJob, BackfillResponse } from '../types/districts.js'
import { CacheManager } from './CacheManager.js'

// Interface for API service that can fetch rankings
interface ToastmastersAPIService {
  getAllDistrictsRankings(date?: string): Promise<any>
}

export class BackfillService {
  private jobs: Map<string, BackfillJob> = new Map()
  private cacheManager: CacheManager
  private apiService: ToastmastersAPIService

  constructor(cacheManager: CacheManager, apiService: ToastmastersAPIService) {
    this.cacheManager = cacheManager
    this.apiService = apiService
  }

  /**
   * Initiate a backfill job
   */
  async initiateBackfill(request: BackfillRequest): Promise<string> {
    const backfillId = uuidv4()

    // Get program year start date (July 1)
    const programYearStart = CacheManager.getProgramYearStart()
    const today = new Date()

    // Parse date range
    const startDate = request.startDate
      ? new Date(request.startDate)
      : programYearStart
    const endDate = request.endDate ? new Date(request.endDate) : today

    // Validate date range
    if (startDate > endDate) {
      throw new Error('Start date must be before or equal to end date')
    }

    if (endDate > today) {
      throw new Error('End date cannot be in the future')
    }

    // Generate list of all dates in range
    const allDates: string[] = []
    const currentDate = new Date(startDate)
    while (currentDate <= endDate) {
      allDates.push(currentDate.toISOString().split('T')[0])
      currentDate.setDate(currentDate.getDate() + 1)
    }

    if (allDates.length === 0) {
      throw new Error('No dates in the specified range')
    }

    // Check which dates are already cached
    const cachedDates = await this.cacheManager.getCachedDates('districts')
    const cachedSet = new Set(cachedDates)
    const missingDates = allDates.filter((d) => !cachedSet.has(d))

    if (missingDates.length === 0) {
      throw new Error('All dates in the range are already cached')
    }

    // Reverse the dates to start with most recent and go backwards
    missingDates.reverse()

    // Create job
    const job: BackfillJob = {
      backfillId,
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
    this.processBackfill(backfillId, missingDates).catch((error) => {
      logger.error('Backfill processing failed', { backfillId, error })
      const failedJob = this.jobs.get(backfillId)
      if (failedJob) {
        failedJob.status = 'error'
        failedJob.error = error.message || 'Unknown error occurred'
      }
    })

    logger.info('Backfill initiated', {
      backfillId,
      totalDates: allDates.length,
      missingDates: missingDates.length,
      alreadyCached: allDates.length - missingDates.length,
    })

    return backfillId
  }

  /**
   * Get backfill job status
   */
  getBackfillStatus(backfillId: string): BackfillResponse | null {
    const job = this.jobs.get(backfillId)

    if (!job) {
      return null
    }

    return {
      backfillId: job.backfillId,
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

      logger.info('Backfill cancelled', { backfillId })
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

    jobsToDelete.forEach((id) => this.jobs.delete(id))

    if (jobsToDelete.length > 0) {
      logger.info('Cleaned up old backfill jobs', { count: jobsToDelete.length })
    }
  }

  /**
   * Process backfill in background
   */
  private async processBackfill(backfillId: string, dates: string[]): Promise<void> {
    const job = this.jobs.get(backfillId)
    if (!job) {
      throw new Error('Job not found')
    }

    try {
      let successCount = 0

      // Process each date
      for (let i = 0; i < dates.length; i++) {
        const date = dates[i]

        // Check if job was cancelled
        if (job.status === 'error') {
          logger.info('Job cancelled, stopping processing', { backfillId })
          return
        }

        // Update progress
        job.progress.current = date
        job.progress.completed = i

        try {
          // Fetch data for this date
          logger.info('Fetching data for date', { backfillId, date })
          const result = await this.apiService.getAllDistrictsRankings(date)
          
          // Check if we got valid data
          if (result && result.rankings && result.rankings.length > 0) {
            successCount++
            logger.info('Successfully fetched data for date', { backfillId, date, districtCount: result.rankings.length })
          } else {
            // Data unavailable (blackout period or reconciliation)
            job.progress.unavailable++
            logger.info('No data available for date (expected blackout/reconciliation period)', { backfillId, date })
          }

          // Add a delay to avoid overwhelming the server
          await new Promise((resolve) => setTimeout(resolve, 2000))
        } catch (error) {
          // Check if it's a "date not available" error vs actual failure
          const errorMessage = error instanceof Error ? error.message : String(error)
          
          if (errorMessage.includes('not available') || 
              errorMessage.includes('dashboard returned') ||
              errorMessage.includes('Date selection failed') || 
              errorMessage.includes('not found') ||
              errorMessage.includes('404')) {
            // Expected - date doesn't exist on dashboard (blackout/reconciliation period)
            job.progress.unavailable++
            logger.info('Date not available on dashboard (blackout/reconciliation period)', { backfillId, date })
          } else {
            // Actual error
            job.progress.failed++
            logger.error('Failed to fetch data for date', { backfillId, date, error: errorMessage })
          }
          
          // Continue with next date
        }
      }

      // Update final progress
      job.progress.completed = dates.length
      job.status = 'complete'

      logger.info('Backfill completed', {
        backfillId,
        successCount,
        unavailable: job.progress.unavailable,
        failed: job.progress.failed,
        skipped: job.progress.skipped,
        totalProcessed: dates.length,
      })
    } catch (error) {
      logger.error('Error processing backfill', { backfillId, error })
      job.status = 'error'
      job.error = error instanceof Error ? error.message : 'Unknown error'
      throw error
    }
  }
}
