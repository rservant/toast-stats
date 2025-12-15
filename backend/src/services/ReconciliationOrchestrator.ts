/**
 * Reconciliation Orchestrator for Month-End Data Reconciliation
 * 
 * Coordinates the entire reconciliation process for a district/month.
 * Manages job lifecycle, cycle processing, and finalization logic.
 */

import { logger } from '../utils/logger.js'
import { ChangeDetectionEngine } from './ChangeDetectionEngine.js'
import { ReconciliationStorageManager } from './ReconciliationStorageManager.js'
import { ReconciliationConfigService } from './ReconciliationConfigService.js'
import { CacheUpdateManager } from './CacheUpdateManager.js'
import type { 
  ReconciliationJob,
  ReconciliationStatus,
  ReconciliationTimeline,
  ReconciliationEntry,
  DataChanges,
  ReconciliationConfig
} from '../types/reconciliation.js'
import type { DistrictStatistics } from '../types/districts.js'

export class ReconciliationOrchestrator {
  private changeDetectionEngine: ChangeDetectionEngine
  private storageManager: ReconciliationStorageManager
  private configService: ReconciliationConfigService
  private cacheUpdateManager: CacheUpdateManager

  constructor(
    changeDetectionEngine?: ChangeDetectionEngine,
    storageManager?: ReconciliationStorageManager,
    configService?: ReconciliationConfigService,
    cacheUpdateManager?: CacheUpdateManager
  ) {
    this.changeDetectionEngine = changeDetectionEngine || new ChangeDetectionEngine()
    this.storageManager = storageManager || new ReconciliationStorageManager()
    this.configService = configService || new ReconciliationConfigService()
    this.cacheUpdateManager = cacheUpdateManager || new CacheUpdateManager()
  }

  /**
   * Start a new reconciliation job for a district/month
   * 
   * @param districtId - The district ID to reconcile
   * @param targetMonth - The target month in YYYY-MM format
   * @param triggeredBy - Whether this was triggered automatically or manually
   * @returns The created reconciliation job
   */
  async startReconciliation(
    districtId: string, 
    targetMonth: string,
    triggeredBy: 'automatic' | 'manual' = 'automatic'
  ): Promise<ReconciliationJob> {
    logger.info('Starting reconciliation', { districtId, targetMonth, triggeredBy })

    try {
      // Get configuration
      const config = await this.configService.getConfig()

      // Check if there's already an active reconciliation for this district/month
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
        metadata: {
          createdAt: now,
          updatedAt: now,
          triggeredBy
        }
      }

      // Save the job
      await this.storageManager.saveJob(job)

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

    } catch (error) {
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

    try {
      // Get job and timeline
      const job = await this.storageManager.getJob(jobId)
      if (!job) {
        throw new Error(`Reconciliation job not found: ${jobId}`)
      }

      if (job.status !== 'active') {
        logger.warn('Attempting to process inactive reconciliation job', { 
          jobId, 
          status: job.status 
        })
        return this.getJobStatus(job)
      }

      const timeline = await this.storageManager.getTimeline(jobId)
      if (!timeline) {
        throw new Error(`Reconciliation timeline not found: ${jobId}`)
      }

      // Detect changes
      const changes = this.changeDetectionEngine.detectChanges(
        job.districtId,
        cachedData,
        currentData
      )

      // Check if changes are significant
      const isSignificant = this.changeDetectionEngine.isSignificantChange(
        changes,
        job.config.significantChangeThresholds
      )

      // Update cache immediately if changes are detected
      let cacheUpdateResult
      if (changes.hasChanges) {
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
            logger.warn('Automatic extension failed', {
              jobId,
              extensionDays: extensionInfo.extensionDays,
              error: extensionError
            })
            // Continue processing even if extension fails
            status.message = `Significant changes detected but extension failed: ${extensionError}`
          }
        }
      }

      // Update timeline status
      timeline.status = status

      // Save updates
      await this.storageManager.saveJob(job)
      await this.storageManager.saveTimeline(timeline)

      logger.debug('Reconciliation cycle processed', { 
        jobId, 
        hasChanges: changes.hasChanges,
        isSignificant,
        phase: status.phase
      })

      return status

    } catch (error) {
      logger.error('Failed to process reconciliation cycle', { jobId, error })
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

      logger.info('Reconciliation finalized', { 
        jobId, 
        districtId: job.districtId,
        targetMonth: job.targetMonth,
        daysActive: timeline.status.daysActive,
        daysStable: timeline.status.daysStable
      })

    } catch (error) {
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

      logger.info('Reconciliation extended', { 
        jobId, 
        additionalDays,
        newMaxEndDate: job.maxEndDate,
        totalExtensionDays: currentExtensionDays + additionalDays
      })

    } catch (error) {
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

      logger.info('Reconciliation cancelled', { jobId })

    } catch (error) {
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
    const timestamp = Date.now()
    return `reconciliation-${districtId}-${targetMonth}-${timestamp}`
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