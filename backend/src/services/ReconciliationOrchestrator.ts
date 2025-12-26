/**
 * Reconciliation Orchestrator for Month-End Data Reconciliation
 * 
 * Coordinates the entire reconciliation process for a district/month.
 * Manages job lifecycle, cycle processing, and finalization logic.
 */

import { logger } from '../utils/logger.js'
import { RetryManager } from '../utils/RetryManager.js'
import { CircuitBreaker, CircuitBreakerManager } from '../utils/CircuitBreaker.js'
import { AlertManager, AlertSeverity, AlertCategory } from '../utils/AlertManager.js'
import { ChangeDetectionEngine } from './ChangeDetectionEngine.js'
import { ReconciliationStorageOptimizer } from './ReconciliationStorageOptimizer.js'
import { ReconciliationCacheService } from './ReconciliationCacheService.js'
import { ReconciliationConfigService } from './ReconciliationConfigService.js'
import { CacheUpdateManager } from './CacheUpdateManager.js'
import { ReconciliationMetricsService } from './ReconciliationMetricsService.js'
import type { 
  ReconciliationJob,
  ReconciliationStatus,
  ReconciliationTimeline,
  ReconciliationEntry,
  ReconciliationConfig
} from '../types/reconciliation.js'
import type { DistrictStatistics } from '../types/districts.js'

export class ReconciliationOrchestrator {
  private changeDetectionEngine: ChangeDetectionEngine
  private storageManager: ReconciliationStorageOptimizer
  private cacheService: ReconciliationCacheService
  private configService: ReconciliationConfigService
  private cacheUpdateManager: CacheUpdateManager
  private alertManager: AlertManager
  private metricsService: ReconciliationMetricsService
  private storageCircuitBreaker: CircuitBreaker

  constructor(
    changeDetectionEngine?: ChangeDetectionEngine,
    storageManager?: ReconciliationStorageOptimizer,
    cacheService?: ReconciliationCacheService,
    configService?: ReconciliationConfigService,
    cacheUpdateManager?: CacheUpdateManager
  ) {
    this.changeDetectionEngine = changeDetectionEngine || new ChangeDetectionEngine()
    this.storageManager = storageManager || new ReconciliationStorageOptimizer()
    this.cacheService = cacheService || new ReconciliationCacheService()
    this.configService = configService || new ReconciliationConfigService()
    this.cacheUpdateManager = cacheUpdateManager || new CacheUpdateManager()
    this.alertManager = AlertManager.getInstance()
    this.metricsService = ReconciliationMetricsService.getInstance()
    
    // Initialize circuit breaker for storage operations
    const circuitManager = CircuitBreakerManager.getInstance()
    this.storageCircuitBreaker = circuitManager.getCircuitBreaker(
      'reconciliation-storage',
      {
        failureThreshold: 3,
        recoveryTimeout: 30000,
        monitoringPeriod: 120000
      }
    )
  }

  /**
   * Start a new reconciliation job for a district/month
   * 
   * @param districtId - The district ID to reconcile
   * @param targetMonth - The target month in YYYY-MM format
   * @param configOverride - Optional configuration overrides for this job
   * @param triggeredBy - Whether this was triggered automatically or manually
   * @returns The created reconciliation job
   */
  async startReconciliation(
    districtId: string, 
    targetMonth: string,
    configOverride?: Partial<ReconciliationConfig>,
    triggeredBy: 'automatic' | 'manual' = 'manual'
  ): Promise<ReconciliationJob> {
    logger.info('Starting reconciliation', { districtId, targetMonth, triggeredBy, configOverride })

    try {
      // Get base configuration and merge with overrides
      const baseConfig = await this.configService.getConfig()
      const config = configOverride ? { ...baseConfig, ...configOverride } : baseConfig

      // Validate the final configuration if overrides were provided
      if (configOverride) {
        const validationResult = await this.validateConfiguration(configOverride)
        if (!validationResult.isValid) {
          throw new Error(`Invalid configuration: ${validationResult.errors?.join(', ')}`)
        }
      }

      // Check if there's already an active reconciliation for this district/month
      await this.storageManager.flush() // Ensure any pending writes are completed
      const existingJobs = await this.storageManager.getJobsByDistrict(districtId)
      const activeJob = existingJobs.find(job => 
        job.targetMonth === targetMonth && 
        (job.status === 'active')
      )

      if (activeJob) {
        logger.warn('Reconciliation already active', { 
          districtId, 
          targetMonth, 
          existingJobId: activeJob.id 
        })
        return activeJob
      }

      // Create new reconciliation job
      const now = new Date()
      const maxEndDate = new Date(now.getTime() + (config.maxReconciliationDays * 24 * 60 * 60 * 1000))

      const job: ReconciliationJob = {
        id: this.generateJobId(districtId, targetMonth),
        districtId,
        targetMonth,
        status: 'active',
        startDate: now,
        maxEndDate,
        config,
        triggeredBy,
        progress: {
          phase: 'monitoring',
          completionPercentage: 0
        },
        metadata: {
          createdAt: now,
          updatedAt: now,
          triggeredBy
        }
      }

      // Save the job
      await this.storageManager.saveJob(job)

      // Record job start metrics
      this.metricsService.recordJobStart(job)

      // Initialize empty timeline
      const timeline: ReconciliationTimeline = {
        jobId: job.id,
        districtId,
        targetMonth,
        entries: [],
        status: {
          phase: 'monitoring',
          daysActive: 0,
          daysStable: 0,
          nextCheckDate: new Date(now.getTime() + (config.checkFrequencyHours * 60 * 60 * 1000)),
          message: 'Reconciliation started - monitoring for changes'
        }
      }

      await this.storageManager.saveTimeline(timeline)

      logger.info('Reconciliation job created', { jobId: job.id, districtId, targetMonth })
      return job

    } catch (_error) {
      logger.error('Failed to start reconciliation', { districtId, targetMonth, error })
      throw error
    }
  }

  /**
   * Process a reconciliation cycle for a job
   * 
   * @param jobId - The reconciliation job ID
   * @param currentData - Current district data from dashboard
   * @param cachedData - Previously cached district data
   * @returns Updated reconciliation status
   */
  async processReconciliationCycle(
    jobId: string,
    currentData: DistrictStatistics,
    cachedData: DistrictStatistics
  ): Promise<ReconciliationStatus> {
    logger.debug('Processing reconciliation cycle', { jobId })

    const context = { jobId, operation: 'processReconciliationCycle' }

    try {
      // Check cache first for job and timeline
      let job = this.cacheService.getJob(jobId)
      let timeline = this.cacheService.getTimeline(jobId)

      // If not in cache, load from storage with circuit breaker and retry logic
      if (!job || !timeline) {
        const result = await this.storageCircuitBreaker.execute(async () => {
          return await RetryManager.executeWithRetry(
            async () => {
              const loadedJob = job || await this.storageManager.getJob(jobId)
              const loadedTimeline = timeline || await this.storageManager.getTimeline(jobId)
              
              if (!loadedJob) {
                throw new Error(`Reconciliation job not found: ${jobId}`)
              }
              if (!loadedTimeline) {
                throw new Error(`Reconciliation timeline not found: ${jobId}`)
              }

              return { job: loadedJob, timeline: loadedTimeline }
            },
            RetryManager.getCacheRetryOptions(),
            context
          )
        }, context)

        if (!result.success) {
          const errorMessage = result.error?.message || 'Failed to load reconciliation data'
          
          await this.alertManager.sendReconciliationFailureAlert(
            'unknown',
            'unknown',
            errorMessage,
            jobId
          )

          throw new Error(errorMessage)
        }

        job = result.result!.job
        timeline = result.result!.timeline

        // Cache the loaded data
        this.cacheService.setJob(jobId, job)
        this.cacheService.setTimeline(jobId, timeline)
      }

      if (job.status !== 'active') {
        logger.warn('Attempting to process inactive reconciliation job', { 
          jobId, 
          status: job.status 
        })
        return this.getJobStatus(job)
      }

      // Detect changes with error handling
      let changes
      try {
        changes = this.changeDetectionEngine.detectChanges(
          job.districtId,
          cachedData,
          currentData
        )
      } catch (_error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error('Change detection failed', { jobId, error: errorMessage })
        
        await this.alertManager.sendAlert(
          AlertSeverity.MEDIUM,
          AlertCategory.RECONCILIATION,
          'Change Detection Failed',
          `Change detection failed for job ${jobId}: ${errorMessage}`,
          { jobId, districtId: job.districtId, error: errorMessage }
        )

        throw error
      }

      // Check if changes are significant
      const isSignificant = this.changeDetectionEngine.isSignificantChange(
        changes,
        job.config.significantChangeThresholds
      )

      // Update cache immediately if changes are detected
      let cacheUpdateResult
      if (changes.hasChanges) {
        try {
          // Extract the month-end date from the target month
          const monthEndDate = this.getMonthEndDate(job.targetMonth)
          
          cacheUpdateResult = await this.cacheUpdateManager.updateCacheImmediately(
            job.districtId,
            monthEndDate,
            currentData,
            changes
          )

          if (!cacheUpdateResult.success) {
            logger.error('Cache update failed during reconciliation cycle', {
              jobId,
              districtId: job.districtId,
              date: monthEndDate,
              error: cacheUpdateResult.error
            })

            // Send alert for cache update failures
            await this.alertManager.sendAlert(
              AlertSeverity.MEDIUM,
              AlertCategory.SYSTEM,
              'Cache Update Failed',
              `Cache update failed during reconciliation for district ${job.districtId}: ${cacheUpdateResult.error}`,
              { jobId, districtId: job.districtId, date: monthEndDate, error: cacheUpdateResult.error }
            )
          }
        } catch (cacheError) {
          const errorMessage = cacheError instanceof Error ? cacheError.message : String(cacheError)
          logger.error('Critical cache update error', { jobId, error: errorMessage })
          
          await this.alertManager.sendAlert(
            AlertSeverity.HIGH,
            AlertCategory.SYSTEM,
            'Critical Cache Update Error',
            `Critical error updating cache during reconciliation for job ${jobId}: ${errorMessage}`,
            { jobId, districtId: job.districtId, error: errorMessage }
          )
        }
      }

      // Create timeline entry
      const entry: ReconciliationEntry = {
        date: new Date(),
        sourceDataDate: changes.sourceDataDate,
        changes,
        isSignificant,
        cacheUpdated: cacheUpdateResult?.success && cacheUpdateResult?.updated || false,
        notes: isSignificant ? 'Significant changes detected' : undefined
      }

      // Add entry to timeline
      timeline.entries.push(entry)

      // Update job's current data date
      job.currentDataDate = changes.sourceDataDate
      job.metadata.updatedAt = new Date()

      // Calculate status
      const status = this.calculateReconciliationStatus(job, timeline)

      // Check if we need to extend reconciliation due to significant changes
      if (isSignificant && job.config.autoExtensionEnabled) {
        const extensionInfo = this.shouldExtendReconciliation(job, timeline)
        if (extensionInfo.shouldExtend) {
          try {
            await this.extendReconciliation(jobId, extensionInfo.extensionDays)
            // Reload the job to get the updated maxEndDate
            const updatedJob = await this.storageManager.getJob(jobId)
            if (updatedJob) {
              job.maxEndDate = updatedJob.maxEndDate
              job.metadata = updatedJob.metadata
            }
            status.message = `Reconciliation extended by ${extensionInfo.extensionDays} days due to significant changes`
            logger.info('Automatic extension triggered', {
              jobId,
              extensionDays: extensionInfo.extensionDays,
              reason: extensionInfo.reason
            })
          } catch (extensionError) {
            const errorMessage = extensionError instanceof Error ? extensionError.message : String(extensionError)
            logger.warn('Automatic extension failed', {
              jobId,
              extensionDays: extensionInfo.extensionDays,
              error: errorMessage
            })

            // Send alert for extension failures
            await this.alertManager.sendAlert(
              AlertSeverity.MEDIUM,
              AlertCategory.RECONCILIATION,
              'Auto-Extension Failed',
              `Automatic reconciliation extension failed for job ${jobId}: ${errorMessage}`,
              { jobId, extensionDays: extensionInfo.extensionDays, error: errorMessage }
            )

            // Continue processing even if extension fails
            status.message = `Significant changes detected but extension failed: ${errorMessage}`
          }
        }
      }

      // Update timeline status
      timeline.status = status

      // Save updates with error handling and caching
      try {
        await this.storageCircuitBreaker.execute(async () => {
          return await RetryManager.executeWithRetry(
            async () => {
              await this.storageManager.saveJob(job)
              await this.storageManager.saveTimeline(timeline)
              
              // Update cache with latest data
              this.cacheService.setJob(jobId, job)
              this.cacheService.setTimeline(jobId, timeline)
              this.cacheService.setStatus(jobId, status)
            },
            RetryManager.getCacheRetryOptions(),
            { ...context, operation: 'saveUpdates' }
          )
        }, context)
      } catch (saveError) {
        const errorMessage = saveError instanceof Error ? saveError.message : String(saveError)
        logger.error('Failed to save reconciliation updates', { jobId, error: errorMessage })
        
        await this.alertManager.sendAlert(
          AlertSeverity.HIGH,
          AlertCategory.SYSTEM,
          'Reconciliation Save Failed',
          `Failed to save reconciliation updates for job ${jobId}: ${errorMessage}`,
          { jobId, error: errorMessage }
        )

        throw saveError
      }

      logger.debug('Reconciliation cycle processed', { 
        jobId, 
        hasChanges: changes.hasChanges,
        isSignificant,
        phase: status.phase
      })

      return status

    } catch (_error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error('Failed to process reconciliation cycle', { jobId, error: errorMessage })
      
      // Get job for failure metrics recording
      try {
        const job = await this.storageManager.getJob(jobId)
        if (job) {
          await this.metricsService.recordJobFailure(job, errorMessage)
        }
      } catch (metricsError) {
        logger.warn('Failed to record failure metrics', { jobId, metricsError })
      }
      
      // Send alert for critical reconciliation processing failures
      await this.alertManager.sendAlert(
        'HIGH' as any,
        'RECONCILIATION' as any,
        'Reconciliation Processing Failed',
        `Critical error processing reconciliation cycle for job ${jobId}: ${errorMessage}`,
        { jobId, error: errorMessage }
      )

      throw error
    }
  }

  /**
   * Finalize a reconciliation job
   * 
   * @param jobId - The reconciliation job ID
   * @returns void
   */
  async finalizeReconciliation(jobId: string): Promise<void> {
    logger.info('Finalizing reconciliation', { jobId })

    try {
      const job = await this.storageManager.getJob(jobId)
      if (!job) {
        throw new Error(`Reconciliation job not found: ${jobId}`)
      }

      if (job.status !== 'active') {
        logger.warn('Attempting to finalize non-active reconciliation job', { 
          jobId, 
          status: job.status 
        })
        return
      }

      const timeline = await this.storageManager.getTimeline(jobId)
      if (!timeline) {
        throw new Error(`Reconciliation timeline not found: ${jobId}`)
      }

      // Check if stability period has been met
      const stabilityMet = this.hasStabilityPeriodBeenMet(job, timeline)
      if (!stabilityMet) {
        logger.warn('Attempting to finalize reconciliation before stability period met', { 
          jobId,
          stabilityPeriodDays: job.config.stabilityPeriodDays
        })
        throw new Error('Stability period not met - cannot finalize reconciliation')
      }

      // Update job status
      job.status = 'completed'
      job.endDate = new Date()
      job.finalizedDate = new Date()
      job.metadata.updatedAt = new Date()

      // Update timeline status
      timeline.status = {
        phase: 'completed',
        daysActive: this.calculateDaysActive(job),
        daysStable: this.calculateDaysStable(timeline),
        message: 'Reconciliation completed - data finalized'
      }

      // Save updates
      await this.storageManager.saveJob(job)
      await this.storageManager.saveTimeline(timeline)

      // Record job completion metrics
      this.metricsService.recordJobCompletion(job, timeline.status.daysStable)

      logger.info('Reconciliation finalized', { 
        jobId, 
        districtId: job.districtId,
        targetMonth: job.targetMonth,
        daysActive: timeline.status.daysActive,
        daysStable: timeline.status.daysStable
      })

    } catch (_error) {
      logger.error('Failed to finalize reconciliation', { jobId, error })
      throw error
    }
  }

  /**
   * Extend a reconciliation job by additional days
   * 
   * @param jobId - The reconciliation job ID
   * @param additionalDays - Number of additional days to extend
   * @returns void
   */
  async extendReconciliation(jobId: string, additionalDays: number): Promise<void> {
    logger.info('Extending reconciliation', { jobId, additionalDays })

    try {
      const job = await this.storageManager.getJob(jobId)
      if (!job) {
        throw new Error(`Reconciliation job not found: ${jobId}`)
      }

      if (job.status !== 'active') {
        logger.warn('Attempting to extend non-active reconciliation job', { 
          jobId, 
          status: job.status 
        })
        return
      }

      // Validate extension days
      if (additionalDays < 0) {
        throw new Error('Extension days cannot be negative')
      }

      if (additionalDays === 0) {
        logger.debug('Extension with 0 days requested, no changes made', { jobId })
        return
      }

      // Calculate current total extension
      const originalMaxEndDate = new Date(job.startDate.getTime() + (job.config.maxReconciliationDays * 24 * 60 * 60 * 1000))
      const currentExtensionMs = job.maxEndDate.getTime() - originalMaxEndDate.getTime()
      const currentExtensionDays = Math.max(0, Math.floor(currentExtensionMs / (24 * 60 * 60 * 1000)))

      // Check if the additional extension would exceed the maximum allowed
      const totalExtensionDays = currentExtensionDays + additionalDays
      if (totalExtensionDays > job.config.maxExtensionDays) {
        const remainingExtensionDays = job.config.maxExtensionDays - currentExtensionDays
        if (remainingExtensionDays <= 0) {
          logger.warn('Cannot extend reconciliation - maximum extension limit already reached', {
            jobId,
            currentExtensionDays,
            maxExtensionDays: job.config.maxExtensionDays,
            requestedAdditionalDays: additionalDays
          })
          throw new Error(`Cannot extend reconciliation - maximum extension limit of ${job.config.maxExtensionDays} days already reached`)
        }

        logger.warn('Requested extension exceeds maximum limit, extending by maximum allowed', {
          jobId,
          requestedDays: additionalDays,
          remainingDays: remainingExtensionDays,
          maxExtensionDays: job.config.maxExtensionDays
        })
        additionalDays = remainingExtensionDays
      }

      // Extend the max end date
      const extensionMs = additionalDays * 24 * 60 * 60 * 1000
      job.maxEndDate = new Date(job.maxEndDate.getTime() + extensionMs)
      job.metadata.updatedAt = new Date()

      await this.storageManager.saveJob(job)

      // Record job extension metrics
      this.metricsService.recordJobExtension(jobId, additionalDays)

      logger.info('Reconciliation extended', { 
        jobId, 
        additionalDays,
        newMaxEndDate: job.maxEndDate,
        totalExtensionDays: currentExtensionDays + additionalDays
      })

    } catch (_error) {
      logger.error('Failed to extend reconciliation', { jobId, error })
      throw error
    }
  }

  /**
   * Cancel a reconciliation job
   * 
   * @param jobId - The reconciliation job ID
   * @returns void
   */
  async cancelReconciliation(jobId: string): Promise<void> {
    logger.info('Cancelling reconciliation', { jobId })

    try {
      const job = await this.storageManager.getJob(jobId)
      if (!job) {
        throw new Error(`Reconciliation job not found: ${jobId}`)
      }

      if (job.status !== 'active') {
        logger.warn('Attempting to cancel non-active reconciliation job', { 
          jobId, 
          status: job.status 
        })
        return
      }

      // Update job status
      job.status = 'cancelled'
      job.endDate = new Date()
      job.metadata.updatedAt = new Date()

      // Update timeline status
      const timeline = await this.storageManager.getTimeline(jobId)
      if (timeline) {
        timeline.status = {
          phase: 'failed',
          daysActive: this.calculateDaysActive(job),
          daysStable: this.calculateDaysStable(timeline),
          message: 'Reconciliation cancelled by user'
        }
        await this.storageManager.saveTimeline(timeline)
      }

      await this.storageManager.saveJob(job)

      // Record job completion metrics (cancelled)
      const stabilityDays = timeline ? this.calculateDaysStable(timeline) : 0
      this.metricsService.recordJobCompletion(job, stabilityDays)

      logger.info('Reconciliation cancelled', { jobId })

    } catch (_error) {
      logger.error('Failed to cancel reconciliation', { jobId, error })
      throw error
    }
  }

  /**
   * Get the current status of a reconciliation job
   * 
   * @param job - The reconciliation job
   * @returns Current reconciliation status
   */
  private getJobStatus(job: ReconciliationJob): ReconciliationStatus {
    const now = new Date()
    const daysActive = Math.floor((now.getTime() - job.startDate.getTime()) / (24 * 60 * 60 * 1000))

    switch (job.status) {
      case 'completed':
        return {
          phase: 'completed',
          daysActive,
          daysStable: 0, // Will be calculated from timeline
          message: 'Reconciliation completed'
        }
      case 'failed':
        return {
          phase: 'failed',
          daysActive,
          daysStable: 0,
          message: 'Reconciliation failed'
        }
      case 'cancelled':
        return {
          phase: 'failed',
          daysActive,
          daysStable: 0,
          message: 'Reconciliation cancelled'
        }
      default:
        return {
          phase: 'monitoring',
          daysActive,
          daysStable: 0,
          nextCheckDate: new Date(now.getTime() + (job.config.checkFrequencyHours * 60 * 60 * 1000)),
          message: 'Monitoring for changes'
        }
    }
  }

  /**
   * Calculate the current reconciliation status based on job and timeline
   * 
   * @param job - The reconciliation job
   * @param timeline - The reconciliation timeline
   * @returns Current reconciliation status
   */
  private calculateReconciliationStatus(
    job: ReconciliationJob, 
    timeline: ReconciliationTimeline
  ): ReconciliationStatus {
    const now = new Date()
    const daysActive = this.calculateDaysActive(job)
    const daysStable = this.calculateDaysStable(timeline)

    // Check if we've exceeded the maximum reconciliation period
    if (now > job.maxEndDate) {
      return {
        phase: 'finalizing',
        daysActive,
        daysStable,
        message: 'Maximum reconciliation period reached - finalizing with current data'
      }
    }

    // Check if stability period has been met
    if (daysStable >= job.config.stabilityPeriodDays) {
      return {
        phase: 'finalizing',
        daysActive,
        daysStable,
        message: `Stability period met (${daysStable} days) - ready for finalization`
      }
    }

    // Check if we're in stabilizing phase (some stable days but not enough)
    if (daysStable > 0) {
      return {
        phase: 'stabilizing',
        daysActive,
        daysStable,
        nextCheckDate: new Date(now.getTime() + (job.config.checkFrequencyHours * 60 * 60 * 1000)),
        message: `Stabilizing - ${daysStable}/${job.config.stabilityPeriodDays} stable days`
      }
    }

    // Still monitoring for changes
    return {
      phase: 'monitoring',
      daysActive,
      daysStable,
      nextCheckDate: new Date(now.getTime() + (job.config.checkFrequencyHours * 60 * 60 * 1000)),
      message: 'Monitoring for changes'
    }
  }

  /**
   * Check if the stability period has been met or if max reconciliation period exceeded
   * 
   * @param job - The reconciliation job
   * @param timeline - The reconciliation timeline
   * @returns true if stability period has been met or max period exceeded
   */
  private hasStabilityPeriodBeenMet(
    job: ReconciliationJob, 
    timeline: ReconciliationTimeline
  ): boolean {
    const now = new Date()
    
    // If max reconciliation period has been exceeded, allow finalization
    if (now > job.maxEndDate) {
      return true
    }
    
    // Otherwise, check if stability period has been met
    const daysStable = this.calculateDaysStable(timeline)
    return daysStable >= job.config.stabilityPeriodDays
  }

  /**
   * Calculate the number of days the reconciliation has been active
   * 
   * @param job - The reconciliation job
   * @returns Number of days active
   */
  private calculateDaysActive(job: ReconciliationJob): number {
    const now = new Date()
    const endDate = job.endDate || now
    return Math.floor((endDate.getTime() - job.startDate.getTime()) / (24 * 60 * 60 * 1000))
  }

  /**
   * Calculate the number of consecutive stable days (no significant changes)
   * 
   * @param timeline - The reconciliation timeline
   * @returns Number of consecutive stable days
   */
  private calculateDaysStable(timeline: ReconciliationTimeline): number {
    if (timeline.entries.length === 0) {
      return 0
    }

    // Sort entries by date (most recent first)
    const sortedEntries = [...timeline.entries].sort((a, b) => b.date.getTime() - a.date.getTime())

    let stableDays = 0
    for (const entry of sortedEntries) {
      if (!entry.isSignificant) {
        stableDays++
      } else {
        // Found a significant change, stop counting
        break
      }
    }

    return stableDays
  }

  /**
   * Determine if reconciliation should be extended due to recent significant changes
   * 
   * @param job - The reconciliation job
   * @param timeline - The reconciliation timeline
   * @returns Extension information including whether to extend and by how many days
   */
  private shouldExtendReconciliation(
    job: ReconciliationJob, 
    timeline: ReconciliationTimeline
  ): { shouldExtend: boolean; extensionDays: number; reason?: string } {
    if (!job.config.autoExtensionEnabled) {
      return { shouldExtend: false, extensionDays: 0, reason: 'Auto-extension disabled' }
    }

    const now = new Date()
    const timeUntilMaxEnd = job.maxEndDate.getTime() - now.getTime()
    const daysUntilMaxEnd = timeUntilMaxEnd / (24 * 60 * 60 * 1000)

    // Only extend if we're close to the max end date (within 2 days)
    if (daysUntilMaxEnd > 2) {
      return { shouldExtend: false, extensionDays: 0, reason: 'Not close to max end date' }
    }

    // Check if there have been recent significant changes
    const recentEntries = timeline.entries.filter(entry => {
      const daysSinceEntry = (now.getTime() - entry.date.getTime()) / (24 * 60 * 60 * 1000)
      return daysSinceEntry <= 2 // Within last 2 days
    })

    const hasRecentSignificantChanges = recentEntries.some(entry => entry.isSignificant)
    
    if (!hasRecentSignificantChanges) {
      return { shouldExtend: false, extensionDays: 0, reason: 'No recent significant changes' }
    }

    // Calculate current total extension to check limits
    const originalMaxEndDate = new Date(job.startDate.getTime() + (job.config.maxReconciliationDays * 24 * 60 * 60 * 1000))
    const currentExtensionMs = job.maxEndDate.getTime() - originalMaxEndDate.getTime()
    const currentExtensionDays = Math.max(0, Math.floor(currentExtensionMs / (24 * 60 * 60 * 1000)))

    // Check if we can still extend
    if (currentExtensionDays >= job.config.maxExtensionDays) {
      return { 
        shouldExtend: false, 
        extensionDays: 0, 
        reason: `Maximum extension limit of ${job.config.maxExtensionDays} days already reached` 
      }
    }

    // Calculate how many days to extend
    // Use a conservative approach: extend by the minimum needed or remaining allowance
    const remainingExtensionDays = job.config.maxExtensionDays - currentExtensionDays
    const defaultExtensionDays = Math.min(3, remainingExtensionDays) // Default to 3 days or remaining allowance
    
    // Count the number of recent significant changes to determine extension length
    const significantChangesCount = recentEntries.filter(entry => entry.isSignificant).length
    let extensionDays = Math.min(
      Math.max(defaultExtensionDays, significantChangesCount), // At least default, more if many changes
      remainingExtensionDays // But not more than remaining allowance
    )

    // Ensure we extend by at least 1 day if we're extending at all
    extensionDays = Math.max(1, extensionDays)

    return { 
      shouldExtend: true, 
      extensionDays, 
      reason: `Recent significant changes detected (${significantChangesCount} changes in last 2 days)` 
    }
  }

  /**
   * Generate a unique job ID for a district/month combination
   * 
   * @param districtId - The district ID
   * @param targetMonth - The target month in YYYY-MM format
   * @returns Unique job ID
   */
  private generateJobId(districtId: string, targetMonth: string): string {
    // Use deterministic ID for duplicate detection
    return `reconciliation-${districtId}-${targetMonth}`
  }

  /**
   * Get the default reconciliation configuration
   * 
   * @returns The default configuration
   */
  async getDefaultConfiguration(): Promise<ReconciliationConfig> {
    return await this.configService.getConfig()
  }

  /**
   * Update the reconciliation configuration
   * 
   * @param configUpdate - Partial configuration update
   * @returns The updated configuration
   */
  async updateConfiguration(configUpdate: Partial<ReconciliationConfig>): Promise<ReconciliationConfig> {
    // Validate the configuration first
    const validationResult = await this.validateConfiguration(configUpdate)
    
    if (!validationResult.isValid) {
      throw new Error(`Configuration validation failed: ${validationResult.errors?.join(', ')}`)
    }

    // Update the configuration
    return await this.configService.updateConfig(configUpdate)
  }

  /**
   * Validate a reconciliation configuration
   * 
   * @param config - Configuration to validate
   * @returns Validation result with errors and warnings
   */
  async validateConfiguration(config: Partial<ReconciliationConfig>): Promise<{
    isValid: boolean
    errors?: string[]
    warnings?: string[]
    validatedConfig?: ReconciliationConfig
  }> {
    const errors: string[] = []
    const warnings: string[] = []

    // Get current config to merge with updates
    const currentConfig = await this.configService.getConfig()
    const mergedConfig = { ...currentConfig, ...config }

    // Validate maxReconciliationDays
    if (config.maxReconciliationDays !== undefined) {
      if (!Number.isInteger(config.maxReconciliationDays) || config.maxReconciliationDays < 1) {
        errors.push('maxReconciliationDays must be a positive integer')
      } else if (config.maxReconciliationDays > 30) {
        warnings.push('maxReconciliationDays is very high (>30 days), consider reducing for better performance')
      }
    }

    // Validate stabilityPeriodDays
    if (config.stabilityPeriodDays !== undefined) {
      if (!Number.isInteger(config.stabilityPeriodDays) || config.stabilityPeriodDays < 1) {
        errors.push('stabilityPeriodDays must be a positive integer')
      } else if (config.stabilityPeriodDays > mergedConfig.maxReconciliationDays) {
        errors.push('stabilityPeriodDays cannot be greater than maxReconciliationDays')
      }
    }

    // Validate checkFrequencyHours
    if (config.checkFrequencyHours !== undefined) {
      if (!Number.isInteger(config.checkFrequencyHours) || config.checkFrequencyHours < 1) {
        errors.push('checkFrequencyHours must be a positive integer')
      } else if (config.checkFrequencyHours < 6) {
        warnings.push('checkFrequencyHours is very low (<6 hours), this may cause excessive API calls')
      } else if (config.checkFrequencyHours > 48) {
        warnings.push('checkFrequencyHours is very high (>48 hours), changes may be detected late')
      }
    }

    // Validate maxExtensionDays
    if (config.maxExtensionDays !== undefined) {
      if (!Number.isInteger(config.maxExtensionDays) || config.maxExtensionDays < 0) {
        errors.push('maxExtensionDays must be a non-negative integer')
      } else if (config.maxExtensionDays > 15) {
        warnings.push('maxExtensionDays is very high (>15 days), consider reducing to avoid indefinite reconciliation')
      }
    }

    // Validate significantChangeThresholds
    if (config.significantChangeThresholds) {
      const thresholds = config.significantChangeThresholds

      if (thresholds.membershipPercent !== undefined) {
        if (typeof thresholds.membershipPercent !== 'number' || thresholds.membershipPercent < 0) {
          errors.push('significantChangeThresholds.membershipPercent must be a non-negative number')
        } else if (thresholds.membershipPercent > 10) {
          warnings.push('membershipPercent threshold is very high (>10%), significant changes may be missed')
        }
      }

      if (thresholds.clubCountAbsolute !== undefined) {
        if (!Number.isInteger(thresholds.clubCountAbsolute) || thresholds.clubCountAbsolute < 0) {
          errors.push('significantChangeThresholds.clubCountAbsolute must be a non-negative integer')
        }
      }

      if (thresholds.distinguishedPercent !== undefined) {
        if (typeof thresholds.distinguishedPercent !== 'number' || thresholds.distinguishedPercent < 0) {
          errors.push('significantChangeThresholds.distinguishedPercent must be a non-negative number')
        } else if (thresholds.distinguishedPercent > 20) {
          warnings.push('distinguishedPercent threshold is very high (>20%), significant changes may be missed')
        }
      }
    }

    // Validate autoExtensionEnabled
    if (config.autoExtensionEnabled !== undefined) {
      if (typeof config.autoExtensionEnabled !== 'boolean') {
        errors.push('autoExtensionEnabled must be a boolean')
      }
    }

    // Cross-validation checks
    if (mergedConfig.stabilityPeriodDays > mergedConfig.maxReconciliationDays) {
      errors.push('stabilityPeriodDays cannot be greater than maxReconciliationDays')
    }

    if (mergedConfig.maxExtensionDays > 0 && !mergedConfig.autoExtensionEnabled) {
      warnings.push('maxExtensionDays is set but autoExtensionEnabled is false - extensions will not be automatic')
    }

    const isValid = errors.length === 0

    return {
      isValid,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
      validatedConfig: isValid ? mergedConfig : undefined
    }
  }

  /**
   * Get extension information for a reconciliation job
   * 
   * @param jobId - The reconciliation job ID
   * @returns Extension information including current extension and remaining allowance
   */
  async getExtensionInfo(jobId: string): Promise<{
    currentExtensionDays: number
    maxExtensionDays: number
    remainingExtensionDays: number
    canExtend: boolean
    autoExtensionEnabled: boolean
  }> {
    const job = await this.storageManager.getJob(jobId)
    if (!job) {
      throw new Error(`Reconciliation job not found: ${jobId}`)
    }

    // Calculate current extension
    const originalMaxEndDate = new Date(job.startDate.getTime() + (job.config.maxReconciliationDays * 24 * 60 * 60 * 1000))
    const currentExtensionMs = job.maxEndDate.getTime() - originalMaxEndDate.getTime()
    const currentExtensionDays = Math.max(0, Math.floor(currentExtensionMs / (24 * 60 * 60 * 1000)))

    const remainingExtensionDays = Math.max(0, job.config.maxExtensionDays - currentExtensionDays)
    const canExtend = job.status === 'active' && remainingExtensionDays > 0

    return {
      currentExtensionDays,
      maxExtensionDays: job.config.maxExtensionDays,
      remainingExtensionDays,
      canExtend,
      autoExtensionEnabled: job.config.autoExtensionEnabled
    }
  }

  /**
   * Get the last day of the month for a given target month
   * 
   * @param targetMonth - The target month in YYYY-MM format
   * @returns Date string in YYYY-MM-DD format for the last day of the month
   */
  private getMonthEndDate(targetMonth: string): string {
    const [year, month] = targetMonth.split('-').map(Number)
    const lastDay = new Date(year, month, 0).getDate() // month is 1-indexed, so this gets last day of previous month
    return `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`
  }
}