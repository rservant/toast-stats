/**
 * Progress Tracker for Month-End Data Reconciliation
 * 
 * Tracks and stores reconciliation progress for visibility and analysis.
 * Records timeline entries, estimates completion, and manages progress data.
 */

import { logger } from '../utils/logger.js'
import { ReconciliationStorageManager } from './ReconciliationStorageManager.js'
import type { 
  ReconciliationTimeline,
  ReconciliationEntry,
  ReconciliationStatus,
  DataChanges,
  ReconciliationJob
} from '../types/reconciliation.js'

export class ProgressTracker {
  private storageManager: ReconciliationStorageManager

  constructor(storageManager?: ReconciliationStorageManager) {
    this.storageManager = storageManager || new ReconciliationStorageManager()
  }

  /**
   * Record a data update in the reconciliation timeline
   * 
   * @param jobId - The reconciliation job ID
   * @param date - The date of the update
   * @param changes - The data changes detected
   * @returns void
   */
  async recordDataUpdate(jobId: string, date: Date, changes: DataChanges): Promise<void> {
    logger.debug('Recording data update', { jobId, date, hasChanges: changes.hasChanges })

    try {
      // Get job details first
      const job = await this.storageManager.getJob(jobId)
      if (!job) {
        throw new Error(`Reconciliation job not found: ${jobId}`)
      }

      // Get existing timeline or create new one
      let timeline = await this.storageManager.getTimeline(jobId)
      
      if (!timeline) {
        timeline = {
          jobId,
          districtId: job.districtId,
          targetMonth: job.targetMonth,
          entries: [],
          status: {
            phase: 'monitoring',
            daysActive: 0,
            daysStable: 0,
            message: 'Timeline initialized'
          }
        }
      }

      const isSignificant = this.isSignificantChange(changes, job.config.significantChangeThresholds)

      // Create new timeline entry
      const entry: ReconciliationEntry = {
        date,
        sourceDataDate: changes.sourceDataDate,
        changes,
        isSignificant,
        cacheUpdated: changes.hasChanges, // Assume cache was updated if there were changes
        notes: isSignificant ? 'Significant changes detected' : 
               changes.hasChanges ? 'Minor changes detected' : 'No changes detected'
      }

      // Add entry to timeline (maintain chronological order)
      timeline.entries.push(entry)
      timeline.entries.sort((a, b) => a.date.getTime() - b.date.getTime())

      // Update timeline status
      timeline.status = this.calculateTimelineStatus(timeline, job)

      // Estimate completion if possible
      const estimatedCompletion = await this.estimateCompletion(timeline, job)
      timeline.estimatedCompletion = estimatedCompletion || undefined

      // Save updated timeline
      await this.storageManager.saveTimeline(timeline)

      logger.info('Data update recorded', { 
        jobId, 
        date, 
        isSignificant, 
        totalEntries: timeline.entries.length 
      })

    } catch (error) {
      logger.error('Failed to record data update', { jobId, date, error })
      throw error
    }
  }

  /**
   * Get the reconciliation timeline for a job
   * 
   * @param jobId - The reconciliation job ID
   * @returns The reconciliation timeline
   */
  async getReconciliationTimeline(jobId: string): Promise<ReconciliationTimeline> {
    logger.debug('Getting reconciliation timeline', { jobId })

    try {
      const timeline = await this.storageManager.getTimeline(jobId)
      
      if (!timeline) {
        // If no timeline exists, create an empty one
        const job = await this.storageManager.getJob(jobId)
        if (!job) {
          throw new Error(`Reconciliation job not found: ${jobId}`)
        }

        const emptyTimeline: ReconciliationTimeline = {
          jobId,
          districtId: job.districtId,
          targetMonth: job.targetMonth,
          entries: [],
          status: {
            phase: 'monitoring',
            daysActive: this.calculateDaysActive(job),
            daysStable: 0,
            message: 'No timeline entries yet'
          }
        }

        return emptyTimeline
      }

      // Refresh the timeline status based on current state
      const job = await this.storageManager.getJob(jobId)
      if (job) {
        timeline.status = this.calculateTimelineStatus(timeline, job)
        
        // Only calculate estimated completion for active jobs
        if (job.status === 'active') {
          const estimatedCompletion = await this.estimateCompletion(timeline, job)
          timeline.estimatedCompletion = estimatedCompletion || undefined
        } else if (job.status === 'completed') {
          // Keep estimated completion undefined for completed jobs
          timeline.estimatedCompletion = undefined
        }
      }

      return timeline

    } catch (error) {
      logger.error('Failed to get reconciliation timeline', { jobId, error })
      throw error
    }
  }

  /**
   * Estimate completion date for a reconciliation job
   * 
   * @param jobId - The reconciliation job ID
   * @returns Estimated completion date or null if cannot be estimated
   */
  async estimateCompletion(jobId: string): Promise<Date | null>
  async estimateCompletion(timeline: ReconciliationTimeline, job: ReconciliationJob): Promise<Date | null>
  async estimateCompletion(
    timelineOrJobId: ReconciliationTimeline | string, 
    job?: ReconciliationJob
  ): Promise<Date | null> {
    try {
      let timeline: ReconciliationTimeline
      let reconciliationJob: ReconciliationJob

      if (typeof timelineOrJobId === 'string') {
        // Called with jobId
        const jobId = timelineOrJobId
        logger.debug('Estimating completion', { jobId })

        timeline = await this.getReconciliationTimeline(jobId)
        const jobData = await this.storageManager.getJob(jobId)
        if (!jobData) {
          throw new Error(`Reconciliation job not found: ${jobId}`)
        }
        reconciliationJob = jobData
      } else {
        // Called with timeline and job objects
        timeline = timelineOrJobId
        if (!job) {
          throw new Error('Job parameter is required when timeline is provided')
        }
        reconciliationJob = job
        logger.debug('Estimating completion from timeline', { jobId: timeline.jobId })
      }

      // If job is already completed, return the finalized date
      if (reconciliationJob.status === 'completed' && reconciliationJob.finalizedDate) {
        return reconciliationJob.finalizedDate
      }

      // If job is failed or cancelled, no completion estimate
      if (reconciliationJob.status === 'failed' || reconciliationJob.status === 'cancelled') {
        return null
      }

      const now = new Date()
      const config = reconciliationJob.config

      // Calculate current stability period
      const daysStable = this.calculateDaysStable(timeline)
      
      // If we already have enough stable days, completion is imminent
      if (daysStable >= config.stabilityPeriodDays) {
        return new Date(now.getTime() + (config.checkFrequencyHours * 60 * 60 * 1000))
      }

      // If we're close to max end date, use that as the completion estimate
      const timeUntilMaxEnd = reconciliationJob.maxEndDate.getTime() - now.getTime()
      const daysUntilMaxEnd = timeUntilMaxEnd / (24 * 60 * 60 * 1000)
      
      if (daysUntilMaxEnd <= 1) {
        return reconciliationJob.maxEndDate
      }

      // Analyze recent activity patterns to estimate completion
      const recentEntries = timeline.entries.filter(entry => {
        const daysSinceEntry = (now.getTime() - entry.date.getTime()) / (24 * 60 * 60 * 1000)
        return daysSinceEntry <= 7 // Last 7 days
      })

      if (recentEntries.length === 0) {
        // No recent activity, use conservative estimate based on remaining stability period
        const remainingStableDays = Math.max(0, config.stabilityPeriodDays - daysStable)
        const estimatedDays = remainingStableDays + 2 // Add buffer
        return new Date(now.getTime() + (estimatedDays * 24 * 60 * 60 * 1000))
      }

      // Calculate change frequency in recent entries
      const significantChanges = recentEntries.filter(entry => entry.isSignificant).length
      const changeFrequency = significantChanges / Math.max(1, recentEntries.length)

      // Estimate based on change frequency
      let estimatedDaysToStability: number
      
      if (changeFrequency > 0.5) {
        // High change frequency - likely to take longer
        estimatedDaysToStability = config.stabilityPeriodDays + Math.ceil(changeFrequency * 5)
      } else if (changeFrequency > 0.2) {
        // Moderate change frequency
        estimatedDaysToStability = config.stabilityPeriodDays + Math.ceil(changeFrequency * 3)
      } else {
        // Low change frequency - likely to stabilize soon
        const remainingStableDays = Math.max(0, config.stabilityPeriodDays - daysStable)
        estimatedDaysToStability = remainingStableDays + 1
      }

      // Ensure estimate doesn't exceed max end date
      const estimatedCompletion = new Date(now.getTime() + (estimatedDaysToStability * 24 * 60 * 60 * 1000))
      
      if (estimatedCompletion.getTime() > reconciliationJob.maxEndDate.getTime()) {
        return reconciliationJob.maxEndDate
      }

      return estimatedCompletion

    } catch (error) {
      logger.error('Failed to estimate completion', { error })
      return null
    }
  }

  /**
   * Mark a reconciliation as finalized
   * 
   * @param jobId - The reconciliation job ID
   * @param finalDate - The finalization date
   * @returns void
   */
  async markAsFinalized(jobId: string, finalDate: Date): Promise<void> {
    logger.info('Marking reconciliation as finalized', { jobId, finalDate })

    try {
      // Get and update job
      const job = await this.storageManager.getJob(jobId)
      if (!job) {
        throw new Error(`Reconciliation job not found: ${jobId}`)
      }

      // Update job status
      job.status = 'completed'
      job.endDate = finalDate
      job.finalizedDate = finalDate
      job.metadata.updatedAt = finalDate

      // Save updated job
      await this.storageManager.saveJob(job)

      // Get and update timeline
      const timeline = await this.storageManager.getTimeline(jobId)
      if (!timeline) {
        throw new Error(`Reconciliation timeline not found: ${jobId}`)
      }

      // Update timeline status
      timeline.status = {
        phase: 'completed',
        daysActive: this.calculateDaysActiveFromTimeline(timeline, finalDate),
        daysStable: this.calculateDaysStable(timeline),
        message: 'Reconciliation completed and finalized'
      }

      // Clear estimated completion since it's now finalized
      timeline.estimatedCompletion = undefined

      // Save updated timeline
      await this.storageManager.saveTimeline(timeline)

      logger.info('Reconciliation marked as finalized', { 
        jobId, 
        finalDate,
        daysActive: timeline.status.daysActive,
        daysStable: timeline.status.daysStable
      })

    } catch (error) {
      logger.error('Failed to mark reconciliation as finalized', { jobId, finalDate, error })
      throw error
    }
  }

  /**
   * Get progress statistics for a reconciliation job
   * 
   * @param jobId - The reconciliation job ID
   * @returns Progress statistics
   */
  async getProgressStatistics(jobId: string): Promise<{
    totalEntries: number
    significantChanges: number
    minorChanges: number
    noChangeEntries: number
    averageTimeBetweenEntries: number
    mostRecentEntry?: Date
    oldestEntry?: Date
    changeFrequency: number
    stabilityTrend: 'improving' | 'stable' | 'declining' | 'unknown'
  }> {
    logger.debug('Getting progress statistics', { jobId })

    try {
      const timeline = await this.getReconciliationTimeline(jobId)
      
      if (timeline.entries.length === 0) {
        return {
          totalEntries: 0,
          significantChanges: 0,
          minorChanges: 0,
          noChangeEntries: 0,
          averageTimeBetweenEntries: 0,
          changeFrequency: 0,
          stabilityTrend: 'unknown'
        }
      }

      // Calculate basic statistics
      const totalEntries = timeline.entries.length
      const significantChanges = timeline.entries.filter(e => e.isSignificant).length
      const minorChanges = timeline.entries.filter(e => e.changes.hasChanges && !e.isSignificant).length
      const noChangeEntries = timeline.entries.filter(e => !e.changes.hasChanges).length

      // Calculate time-based statistics
      const sortedEntries = [...timeline.entries].sort((a, b) => a.date.getTime() - b.date.getTime())
      const oldestEntry = sortedEntries[0]?.date
      const mostRecentEntry = sortedEntries[sortedEntries.length - 1]?.date

      let averageTimeBetweenEntries = 0
      if (sortedEntries.length > 1) {
        const totalTimeSpan = mostRecentEntry!.getTime() - oldestEntry!.getTime()
        averageTimeBetweenEntries = totalTimeSpan / (sortedEntries.length - 1)
      }

      // Calculate change frequency (changes per day)
      const changeFrequency = totalEntries > 1 && oldestEntry && mostRecentEntry ? 
        (significantChanges + minorChanges) / Math.max(1, (mostRecentEntry.getTime() - oldestEntry.getTime()) / (24 * 60 * 60 * 1000)) : 0

      // Analyze stability trend
      const stabilityTrend = this.analyzeStabilityTrend(timeline)

      return {
        totalEntries,
        significantChanges,
        minorChanges,
        noChangeEntries,
        averageTimeBetweenEntries,
        mostRecentEntry,
        oldestEntry,
        changeFrequency,
        stabilityTrend
      }

    } catch (error) {
      logger.error('Failed to get progress statistics', { jobId, error })
      throw error
    }
  }

  /**
   * Calculate the current timeline status based on entries and job configuration
   * 
   * @param timeline - The reconciliation timeline
   * @param job - The reconciliation job
   * @returns Current reconciliation status
   */
  private calculateTimelineStatus(timeline: ReconciliationTimeline, job: ReconciliationJob): ReconciliationStatus {
    const now = new Date()
    const daysActive = this.calculateDaysActive(job)
    const daysStable = this.calculateDaysStable(timeline)

    // Check if job is already completed
    if (job.status === 'completed') {
      return {
        phase: 'completed',
        daysActive,
        daysStable,
        message: 'Reconciliation completed and finalized'
      }
    }

    // Check if we've exceeded the maximum reconciliation period
    if (now > job.maxEndDate) {
      return {
        phase: 'finalizing',
        daysActive,
        daysStable,
        message: 'Maximum reconciliation period reached - ready for finalization'
      }
    }

    // Check if stability period has been met
    if (daysStable >= job.config.stabilityPeriodDays) {
      return {
        phase: 'finalizing',
        daysActive,
        daysStable,
        message: `Stability period met (${daysStable}/${job.config.stabilityPeriodDays} days) - ready for finalization`
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
   * Calculate days active from timeline entries
   * 
   * @param timeline - The reconciliation timeline
   * @param endDate - The end date to calculate from
   * @returns Number of days active
   */
  private calculateDaysActiveFromTimeline(timeline: ReconciliationTimeline, endDate: Date): number {
    if (timeline.entries.length === 0) {
      return 0
    }

    const sortedEntries = [...timeline.entries].sort((a, b) => a.date.getTime() - b.date.getTime())
    const startDate = sortedEntries[0].date
    
    return Math.floor((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000))
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
   * Determine if changes are significant based on thresholds
   * 
   * @param changes - The data changes
   * @param thresholds - The significance thresholds
   * @returns true if changes are significant
   */
  private isSignificantChange(changes: DataChanges, thresholds: any): boolean {
    if (!changes.hasChanges) {
      return false
    }

    // Check membership changes
    if (changes.membershipChange) {
      if (Math.abs(changes.membershipChange.percentChange) >= thresholds.membershipPercent) {
        return true
      }
    }

    // Check club count changes
    if (changes.clubCountChange) {
      if (Math.abs(changes.clubCountChange.absoluteChange) >= thresholds.clubCountAbsolute) {
        return true
      }
    }

    // Check distinguished club changes
    if (changes.distinguishedChange) {
      if (Math.abs(changes.distinguishedChange.percentChange) >= thresholds.distinguishedPercent) {
        return true
      }
    }

    return false
  }

  /**
   * Analyze the stability trend of a reconciliation timeline
   * 
   * @param timeline - The reconciliation timeline
   * @returns Stability trend analysis
   */
  private analyzeStabilityTrend(timeline: ReconciliationTimeline): 'improving' | 'stable' | 'declining' | 'unknown' {
    if (timeline.entries.length < 3) {
      return 'unknown'
    }

    // Sort entries by date
    const sortedEntries = [...timeline.entries].sort((a, b) => a.date.getTime() - b.date.getTime())
    
    // Split into two halves to compare trends
    const midpoint = Math.floor(sortedEntries.length / 2)
    const firstHalf = sortedEntries.slice(0, midpoint)
    const secondHalf = sortedEntries.slice(midpoint)

    // Calculate significant change rates for each half
    const firstHalfSignificantRate = firstHalf.filter(e => e.isSignificant).length / firstHalf.length
    const secondHalfSignificantRate = secondHalf.filter(e => e.isSignificant).length / secondHalf.length

    const rateDifference = secondHalfSignificantRate - firstHalfSignificantRate

    if (rateDifference < -0.1) {
      return 'improving' // Fewer significant changes in recent period
    } else if (rateDifference > 0.1) {
      return 'declining' // More significant changes in recent period
    } else {
      return 'stable' // Similar rate of changes
    }
  }
}