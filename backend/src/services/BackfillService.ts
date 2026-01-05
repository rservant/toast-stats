/**
 * Backfill Service
 * Handles background processing of historical data backfill requests
 * Only fetches data that isn't already cached
 */

import { v4 as uuidv4 } from 'uuid'
import { logger } from '../utils/logger.js'
import type {
  BackfillRequest,
  BackfillJob,
  BackfillResponse,
} from '../types/districts.js'
import { CacheManager } from './CacheManager.js'
import type { DistrictRankingsResponse } from '../types/districts.js'
import { PerDistrictFileSnapshotStore } from './PerDistrictSnapshotStore.js'
import { Snapshot, NormalizedData } from '../types/snapshots.js'
import { DistrictConfigurationService } from './DistrictConfigurationService.js'

// Interface for API service that can fetch rankings
interface ToastmastersAPIService {
  getAllDistrictsRankings(date?: string): Promise<DistrictRankingsResponse>
}

// Interface for district-specific error tracking
interface DistrictError {
  districtId: string
  districtName?: string
  error: string
  errorType: 'fetch_failed' | 'validation_failed' | 'processing_failed'
  timestamp: string
}

export class BackfillService {
  private jobs: Map<string, BackfillJob> = new Map()
  private cacheManager: CacheManager
  private apiService: ToastmastersAPIService
  private snapshotStore: PerDistrictFileSnapshotStore
  private districtConfigService: DistrictConfigurationService

  constructor(
    cacheManager: CacheManager, 
    apiService: ToastmastersAPIService,
    snapshotStore?: PerDistrictFileSnapshotStore,
    districtConfigService?: DistrictConfigurationService
  ) {
    this.cacheManager = cacheManager
    this.apiService = apiService
    this.snapshotStore = snapshotStore || new PerDistrictFileSnapshotStore({
      cacheDir: process.env.CACHE_DIR || './cache',
      maxSnapshots: 100,
      maxAgeDays: 365,
      enableCompression: false,
    })
    this.districtConfigService = districtConfigService || new DistrictConfigurationService(
      process.env.CACHE_DIR || './cache'
    )
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
    const missingDates = allDates.filter(d => !cachedSet.has(d))

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
    this.processBackfill(backfillId, missingDates).catch(error => {
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

    jobsToDelete.forEach(id => this.jobs.delete(id))

    if (jobsToDelete.length > 0) {
      logger.info('Cleaned up old backfill jobs', {
        count: jobsToDelete.length,
      })
    }
  }

  /**
   * Create a snapshot from backfill data with enhanced error handling
   * 
   * This method creates a snapshot directory containing individual per-district JSON files
   * for successful backfill operations, integrating with the PerDistrictSnapshotStore.
   * Supports partial snapshot creation when some districts fail.
   */
  async createSnapshotFromBackfill(
    date: string,
    data: DistrictRankingsResponse,
    backfillId: string
  ): Promise<string> {
    const snapshotId = Date.parse(date).toString()
    
    logger.info('Creating snapshot from backfill data', {
      operation: 'createSnapshotFromBackfill',
      backfill_id: backfillId,
      snapshot_id: snapshotId,
      date,
      district_count: data.rankings.length,
    })

    try {
      // Get current district configuration to respect scope
      const configuredDistricts = await this.districtConfigService.getConfiguredDistricts()
      
      // Filter rankings to only include configured districts
      const scopedRankings = data.rankings.filter(ranking => 
        configuredDistricts.length === 0 || configuredDistricts.includes(ranking.districtId)
      )

      if (scopedRankings.length === 0) {
        logger.warn('No rankings data matches current district configuration scope', {
          operation: 'createSnapshotFromBackfill',
          backfill_id: backfillId,
          snapshot_id: snapshotId,
          date,
          configured_districts: configuredDistricts,
          total_rankings: data.rankings.length,
        })
      }

      // Track district-specific errors and successes
      const districtErrors: DistrictError[] = []
      const successfulDistricts: string[] = []

      // Convert rankings data to DistrictStatistics format with error tracking
      const districts = scopedRankings.map(ranking => {
        try {
          const districtStats = {
            districtId: ranking.districtId,
            districtName: ranking.districtName,
            asOfDate: date,
            membership: {
              total: ranking.totalPayments, // Use total payments as a proxy for membership
              change: ranking.paymentGrowthPercent,
              changePercent: ranking.paymentGrowthPercent,
              byClub: [], // Backfill data doesn't include club-level details
            },
            clubs: {
              total: ranking.paidClubs,
              active: ranking.activeClubs,
              suspended: 0, // Not available in rankings data
              ineligible: 0, // Not available in rankings data
              low: 0, // Not available in rankings data
              distinguished: ranking.distinguishedClubs,
            },
            education: {
              totalAwards: 0, // Not available in rankings data
              byType: [], // Not available in rankings data
              topClubs: [], // Not available in rankings data
              byMonth: [], // Not available in rankings data
            },
          }

          // Validate district data quality
          const validationErrors = this.validateDistrictData(districtStats)
          if (validationErrors.length > 0) {
            districtErrors.push({
              districtId: ranking.districtId,
              districtName: ranking.districtName,
              error: `Data validation failed: ${validationErrors.join(', ')}`,
              errorType: 'validation_failed',
              timestamp: new Date().toISOString(),
            })
            logger.warn('District data validation failed', {
              operation: 'createSnapshotFromBackfill',
              backfill_id: backfillId,
              district_id: ranking.districtId,
              validation_errors: validationErrors,
            })
            return null // Exclude invalid district data
          }

          successfulDistricts.push(ranking.districtId)
          return districtStats
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown processing error'
          districtErrors.push({
            districtId: ranking.districtId,
            districtName: ranking.districtName,
            error: errorMessage,
            errorType: 'processing_failed',
            timestamp: new Date().toISOString(),
          })
          logger.error('Failed to process district data', {
            operation: 'createSnapshotFromBackfill',
            backfill_id: backfillId,
            district_id: ranking.districtId,
            error: errorMessage,
          })
          return null // Exclude failed district data
        }
      }).filter(district => district !== null)

      // Determine snapshot status based on success/failure ratio
      let snapshotStatus: 'success' | 'partial' | 'failed' = 'success'
      if (districts.length === 0) {
        snapshotStatus = 'failed'
      } else if (districtErrors.length > 0) {
        snapshotStatus = 'partial'
      }

      // Create normalized data structure with enhanced metadata
      const normalizedData: NormalizedData = {
        districts,
        metadata: {
          source: 'backfill-service',
          fetchedAt: new Date().toISOString(),
          dataAsOfDate: date,
          districtCount: districts.length,
          processingDurationMs: 0, // Will be updated by snapshot store
          backfillJobId: backfillId,
          configuredDistricts,
          successfulDistricts,
          failedDistricts: districtErrors.map(e => e.districtId),
          districtErrors: districtErrors.map(e => ({
            districtId: e.districtId,
            districtName: e.districtName,
            error: e.error,
            errorType: e.errorType,
            timestamp: e.timestamp,
          })),
        },
      }

      // Create snapshot object with enhanced error tracking
      const snapshot: Snapshot = {
        snapshot_id: snapshotId,
        created_at: new Date().toISOString(),
        schema_version: '2.0.0',
        calculation_version: '1.0.0',
        status: snapshotStatus,
        errors: districtErrors.map(e => `District ${e.districtId}: ${e.error}`),
        payload: normalizedData,
      }

      // Write snapshot using PerDistrictSnapshotStore
      await this.snapshotStore.writeSnapshot(snapshot)

      // Check if this snapshot is more recent than current and update pointer if needed
      // Only update pointer for successful or partial snapshots
      if (snapshotStatus !== 'failed') {
        await this.updateCurrentPointerIfNewer(snapshot)
      }

      logger.info('Successfully created snapshot from backfill data with enhanced error handling', {
        operation: 'createSnapshotFromBackfill',
        backfill_id: backfillId,
        snapshot_id: snapshotId,
        date,
        status: snapshotStatus,
        successful_districts: successfulDistricts.length,
        failed_districts: districtErrors.length,
        configured_districts: configuredDistricts.length,
        total_input_districts: data.rankings.length,
        scoped_districts: scopedRankings.length,
      })

      return snapshotId
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to create snapshot from backfill data', {
        operation: 'createSnapshotFromBackfill',
        backfill_id: backfillId,
        snapshot_id: snapshotId,
        date,
        error: errorMessage,
      })
      throw new Error(`Failed to create snapshot from backfill data: ${errorMessage}`)
    }
  }

  /**
   * Integrate with snapshot store for consistent storage format
   */
  integrateWithSnapshotStore(snapshotStore: PerDistrictFileSnapshotStore): void {
    this.snapshotStore = snapshotStore
    logger.info('BackfillService integrated with PerDistrictSnapshotStore', {
      operation: 'integrateWithSnapshotStore',
    })
  }

  /**
   * Update current snapshot pointer if the new snapshot is more recent
   */
  private async updateCurrentPointerIfNewer(snapshot: Snapshot): Promise<void> {
    try {
      const currentSnapshot = await this.snapshotStore.getLatestSuccessful()
      
      if (!currentSnapshot) {
        // No current snapshot, this becomes the current one
        logger.info('No current snapshot found, new backfill snapshot becomes current', {
          operation: 'updateCurrentPointerIfNewer',
          snapshot_id: snapshot.snapshot_id,
          date: snapshot.payload.metadata.dataAsOfDate,
        })
        return
      }

      const currentDate = new Date(currentSnapshot.payload.metadata.dataAsOfDate)
      const newDate = new Date(snapshot.payload.metadata.dataAsOfDate)

      if (newDate > currentDate) {
        logger.info('Backfill snapshot is more recent than current, updating pointer', {
          operation: 'updateCurrentPointerIfNewer',
          current_snapshot_id: currentSnapshot.snapshot_id,
          current_date: currentSnapshot.payload.metadata.dataAsOfDate,
          new_snapshot_id: snapshot.snapshot_id,
          new_date: snapshot.payload.metadata.dataAsOfDate,
        })
        // The writeSnapshot method already handles current pointer updates for successful snapshots
      } else {
        logger.debug('Backfill snapshot is not more recent than current, keeping existing pointer', {
          operation: 'updateCurrentPointerIfNewer',
          current_date: currentSnapshot.payload.metadata.dataAsOfDate,
          new_date: snapshot.payload.metadata.dataAsOfDate,
        })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.warn('Failed to check/update current pointer for backfill snapshot', {
        operation: 'updateCurrentPointerIfNewer',
        snapshot_id: snapshot.snapshot_id,
        error: errorMessage,
      })
      // Don't throw - this is not critical for backfill success
    }
  }

  /**
   * Validate district data quality and return list of validation errors
   */
  private validateDistrictData(districtStats: any): string[] {
    const errors: string[] = []

    // Check for required fields
    if (!districtStats.districtId) {
      errors.push('Missing district ID')
    }

    if (!districtStats.districtName) {
      errors.push('Missing district name')
    }

    // Check for reasonable membership values
    if (typeof districtStats.membership?.total !== 'number' || districtStats.membership.total < 0) {
      errors.push('Invalid membership total')
    }

    // Check for reasonable club values
    if (typeof districtStats.clubs?.total !== 'number' || districtStats.clubs.total < 0) {
      errors.push('Invalid club total')
    }

    // Check for suspiciously low membership (likely data quality issue)
    if (districtStats.clubs?.total > 0 && districtStats.membership?.total < 50) {
      errors.push(`Suspiciously low membership: ${districtStats.membership.total} total members for ${districtStats.clubs.total} clubs`)
    }

    // Check for impossible ratios
    if (districtStats.clubs?.distinguished > districtStats.clubs?.total) {
      errors.push('More distinguished clubs than total clubs')
    }

    return errors
  }

  /**
   * Process backfill in background
   */
  private async processBackfill(
    backfillId: string,
    dates: string[]
  ): Promise<void> {
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
            // Create snapshot from backfill data instead of direct cache storage
            try {
              const snapshotId = await this.createSnapshotFromBackfill(
                date,
                result,
                backfillId
              )
              
              successCount++
              logger.info('Successfully created snapshot for backfill date', {
                backfillId,
                date,
                snapshot_id: snapshotId,
                districtCount: result.rankings.length,
              })
            } catch (snapshotError) {
              const snapshotErrorMessage = snapshotError instanceof Error 
                ? snapshotError.message 
                : 'Unknown snapshot creation error'
              
              job.progress.failed++
              logger.error('Failed to create snapshot for backfill date', {
                backfillId,
                date,
                error: snapshotErrorMessage,
              })
            }
          } else {
            // Data unavailable (blackout period or reconciliation)
            job.progress.unavailable++
            logger.info(
              'No data available for date (expected blackout/reconciliation period)',
              { backfillId, date }
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
              { backfillId, date }
            )
          } else {
            // Actual error
            job.progress.failed++
            logger.error('Failed to fetch data for date', {
              backfillId,
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
