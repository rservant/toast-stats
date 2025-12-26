/**
 * Reconciliation Scheduler for Month-End Data Reconciliation
 * 
 * Automatically initiates reconciliation monitoring when months transition.
 * Manages job queue for concurrent reconciliations and provides job status tracking.
 */

import { logger } from '../utils/logger.js'
import { ReconciliationOrchestrator } from './ReconciliationOrchestrator.js'
import { ReconciliationStorageManager } from './ReconciliationStorageManager.js'
import { ReconciliationConfigService } from './ReconciliationConfigService.js'
import type { ReconciliationJob } from '../types/reconciliation.js'

export interface ScheduledReconciliation {
  districtId: string
  targetMonth: string
  scheduledFor: Date
  status: 'pending' | 'initiated' | 'failed'
  attempts: number
  lastAttempt?: Date
  error?: string
}

export class ReconciliationScheduler {
  private orchestrator: ReconciliationOrchestrator
  private storageManager: ReconciliationStorageManager
  private scheduledReconciliations: Map<string, ScheduledReconciliation> = new Map()
  private isRunning: boolean = false
  private checkInterval?: ReturnType<typeof setTimeout>

  constructor(
    orchestrator?: ReconciliationOrchestrator,
    storageManager?: ReconciliationStorageManager,
    _configService?: ReconciliationConfigService
  ) {
    this.orchestrator = orchestrator || new ReconciliationOrchestrator()
    this.storageManager = storageManager || new ReconciliationStorageManager()
  }

  /**
   * Start the scheduler to monitor for month transitions and process scheduled reconciliations
   * 
   * @param checkIntervalMinutes - How often to check for new months and process scheduled reconciliations (default: 60 minutes)
   */
  start(checkIntervalMinutes: number = 60): void {
    if (this.isRunning) {
      logger.warn('ReconciliationScheduler is already running')
      return
    }

    this.isRunning = true
    logger.info('Starting ReconciliationScheduler', { checkIntervalMinutes })

    // Run initial check
    this.processScheduledReconciliations().catch(error => {
      logger.error('Initial scheduled reconciliation processing failed', { error })
    })

    // Set up periodic checks
    this.checkInterval = setInterval(() => {
      this.processScheduledReconciliations().catch(error => {
        logger.error('Scheduled reconciliation processing failed', { error })
      })
    }, checkIntervalMinutes * 60 * 1000)
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (!this.isRunning) {
      logger.warn('ReconciliationScheduler is not running')
      return
    }

    this.isRunning = false
    logger.info('Stopping ReconciliationScheduler')

    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = undefined
    }
  }

  /**
   * Schedule a reconciliation for a specific district and month
   * 
   * @param districtId - The district ID to reconcile
   * @param targetMonth - The target month in YYYY-MM format
   * @param scheduledFor - When to initiate the reconciliation (default: now)
   * @returns The scheduled reconciliation entry
   */
  async scheduleMonthEndReconciliation(
    districtId: string, 
    targetMonth: string,
    scheduledFor: Date = new Date()
  ): Promise<ScheduledReconciliation> {
    logger.info('Scheduling month-end reconciliation', { districtId, targetMonth, scheduledFor })

    // Validate target month format
    if (!/^\d{4}-\d{2}$/.test(targetMonth)) {
      throw new Error(`Invalid target month format: ${targetMonth}. Expected YYYY-MM format.`)
    }

    // Check if there's already an active reconciliation for this district/month
    const existingJobs = await this.storageManager.getJobsByDistrict(districtId)
    const activeJob = existingJobs.find(job => 
      job.targetMonth === targetMonth && 
      job.status === 'active'
    )

    if (activeJob) {
      logger.warn('Reconciliation already active for district/month', { 
        districtId, 
        targetMonth, 
        existingJobId: activeJob.id 
      })
      throw new Error(`Active reconciliation already exists for district ${districtId} month ${targetMonth}`)
    }

    const scheduleKey = `${districtId}-${targetMonth}`
    
    // Check if already scheduled
    const existingSchedule = this.scheduledReconciliations.get(scheduleKey)
    if (existingSchedule && existingSchedule.status === 'pending') {
      logger.warn('Reconciliation already scheduled for district/month', { 
        districtId, 
        targetMonth,
        existingSchedule
      })
      return existingSchedule
    }

    const scheduled: ScheduledReconciliation = {
      districtId,
      targetMonth,
      scheduledFor,
      status: 'pending',
      attempts: 0
    }

    this.scheduledReconciliations.set(scheduleKey, scheduled)

    logger.info('Month-end reconciliation scheduled', { districtId, targetMonth, scheduledFor })
    return scheduled
  }

  /**
   * Check for pending reconciliations and return their status
   * 
   * @returns Array of all reconciliation jobs (active, completed, failed, cancelled)
   */
  async checkPendingReconciliations(): Promise<ReconciliationJob[]> {
    logger.debug('Checking pending reconciliations')

    try {
      // Get all jobs from storage
      const allJobs = await this.storageManager.getAllJobs()
      
      logger.debug('Found reconciliation jobs', { 
        total: allJobs.length,
        active: allJobs.filter(job => job.status === 'active').length,
        completed: allJobs.filter(job => job.status === 'completed').length,
        failed: allJobs.filter(job => job.status === 'failed').length,
        cancelled: allJobs.filter(job => job.status === 'cancelled').length
      })

      return allJobs

    } catch (error) {
      logger.error('Failed to check pending reconciliations', { error })
      throw error
    }
  }

  /**
   * Cancel a reconciliation job
   * 
   * @param jobId - The reconciliation job ID to cancel
   * @returns void
   */
  async cancelReconciliation(jobId: string): Promise<void> {
    logger.info('Cancelling reconciliation via scheduler', { jobId })

    try {
      // Use the orchestrator to cancel the job
      await this.orchestrator.cancelReconciliation(jobId)

      // Also remove from scheduled reconciliations if it exists
      for (const [, scheduled] of this.scheduledReconciliations.entries()) {
        if (scheduled.status === 'pending') {
          // We don't have the job ID for pending schedules, so we can't match directly
          // This is handled by the orchestrator for active jobs
          continue
        }
      }

      logger.info('Reconciliation cancelled successfully', { jobId })

    } catch (error) {
      logger.error('Failed to cancel reconciliation', { jobId, error })
      throw error
    }
  }

  /**
   * Get all scheduled reconciliations (pending, not yet initiated)
   * 
   * @returns Array of scheduled reconciliations
   */
  getScheduledReconciliations(): ScheduledReconciliation[] {
    return Array.from(this.scheduledReconciliations.values())
  }

  /**
   * Automatically detect month transitions and schedule reconciliations for all districts
   * 
   * @param districts - Array of district IDs to monitor (if not provided, will use a default set)
   * @returns Number of reconciliations scheduled
   */
  async autoScheduleForMonthTransition(districts?: string[]): Promise<number> {
    logger.info('Auto-scheduling reconciliations for month transition')

    const now = new Date()
    
    // Calculate previous month
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const previousMonth = `${prevMonthDate.getFullYear()}-${(prevMonthDate.getMonth() + 1).toString().padStart(2, '0')}`

    // If no districts provided, use a default set (this would typically come from configuration)
    const targetDistricts = districts || this.getDefaultDistricts()

    let scheduledCount = 0

    for (const districtId of targetDistricts) {
      try {
        // Check if we're in a new month (first few days)
        const dayOfMonth = now.getDate()
        if (dayOfMonth <= 5) { // Only auto-schedule in first 5 days of new month
          // Schedule reconciliation for the previous month
          await this.scheduleMonthEndReconciliation(districtId, previousMonth)
          scheduledCount++
        }
      } catch (error) {
        // Log error but continue with other districts
        logger.warn('Failed to auto-schedule reconciliation for district', { 
          districtId, 
          previousMonth, 
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    logger.info('Auto-scheduling completed', { 
      targetDistricts: targetDistricts.length,
      scheduledCount,
      previousMonth
    })

    return scheduledCount
  }

  /**
   * Process all scheduled reconciliations that are due
   * 
   * @returns Number of reconciliations initiated
   */
  private async processScheduledReconciliations(): Promise<number> {
    logger.debug('Processing scheduled reconciliations')

    const now = new Date()
    let initiatedCount = 0

    // First, check for month transitions and auto-schedule if needed
    try {
      const autoScheduledCount = await this.autoScheduleForMonthTransition()
      if (autoScheduledCount > 0) {
        logger.info('Auto-scheduled reconciliations for month transition', { count: autoScheduledCount })
      }
    } catch (error) {
      logger.error('Failed to auto-schedule for month transition', { error })
    }

    // Process pending scheduled reconciliations
    for (const [key, scheduled] of this.scheduledReconciliations.entries()) {
      if (scheduled.status !== 'pending') {
        continue
      }

      // Check if it's time to initiate this reconciliation
      if (now >= scheduled.scheduledFor) {
        try {
          logger.info('Initiating scheduled reconciliation', { 
            districtId: scheduled.districtId,
            targetMonth: scheduled.targetMonth
          })

          // Initiate the reconciliation
          const job = await this.orchestrator.startReconciliation(
            scheduled.districtId,
            scheduled.targetMonth,
            undefined,
            'automatic'
          )

          // Update scheduled reconciliation status
          scheduled.status = 'initiated'
          scheduled.attempts++
          scheduled.lastAttempt = now

          initiatedCount++

          logger.info('Scheduled reconciliation initiated successfully', { 
            districtId: scheduled.districtId,
            targetMonth: scheduled.targetMonth,
            jobId: job.id
          })

        } catch (error) {
          // Mark as failed and increment attempts
          scheduled.status = 'failed'
          scheduled.attempts++
          scheduled.lastAttempt = now
          scheduled.error = error instanceof Error ? error.message : String(error)

          logger.error('Failed to initiate scheduled reconciliation', { 
            districtId: scheduled.districtId,
            targetMonth: scheduled.targetMonth,
            attempts: scheduled.attempts,
            error: scheduled.error
          })

          // If we've tried too many times, remove from schedule
          if (scheduled.attempts >= 3) {
            logger.warn('Removing failed scheduled reconciliation after max attempts', { 
              districtId: scheduled.districtId,
              targetMonth: scheduled.targetMonth,
              attempts: scheduled.attempts
            })
            this.scheduledReconciliations.delete(key)
          } else {
            // Reset to pending for retry, but schedule for later
            scheduled.status = 'pending'
            scheduled.scheduledFor = new Date(now.getTime() + (60 * 60 * 1000)) // Retry in 1 hour
          }
        }
      }
    }

    // Clean up old completed/failed scheduled reconciliations
    await this.cleanupScheduledReconciliations()

    if (initiatedCount > 0) {
      logger.info('Scheduled reconciliation processing completed', { initiatedCount })
    }

    return initiatedCount
  }

  /**
   * Clean up old scheduled reconciliations and completed jobs
   */
  private async cleanupScheduledReconciliations(): Promise<void> {
    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000))
    const keysToDelete: string[] = []

    // Clean up old scheduled reconciliations
    for (const [key, scheduled] of this.scheduledReconciliations.entries()) {
      // Remove initiated or failed reconciliations older than 1 day
      if ((scheduled.status === 'initiated' || scheduled.status === 'failed') && 
          scheduled.lastAttempt && scheduled.lastAttempt < oneDayAgo) {
        keysToDelete.push(key)
      }
    }

    keysToDelete.forEach(key => this.scheduledReconciliations.delete(key))

    if (keysToDelete.length > 0) {
      logger.info('Cleaned up old scheduled reconciliations', { count: keysToDelete.length })
    }

    // Also clean up old completed reconciliation jobs via storage manager
    try {
      await this.storageManager.cleanupOldJobs()
    } catch (error) {
      logger.error('Failed to cleanup old reconciliation jobs', { error })
    }
  }

  /**
   * Get default districts to monitor (this would typically come from configuration)
   * For now, returns a basic set of districts
   * 
   * @returns Array of district IDs
   */
  private getDefaultDistricts(): string[] {
    // This would typically be loaded from configuration
    // For now, return a basic set of districts
    return [
      '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
      '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
      '21', '22', '23', '24', '25', '26', '27', '28', '29', '30',
      '31', '32', '33', '34', '35', '36', '37', '38', '39', '40',
      '41', '42', '43', '44', '45', '46', '47', '48', '49', '50',
      '51', '52', '53', '54', '55', '56', '57', '58', '59', '60',
      '61', '62', '63', '64', '65', '66', '67', '68', '69', '70',
      '71', '72', '73', '74', '75', '76', '77', '78', '79', '80',
      '81', '82', '83', '84', '85', '86', '87', '88', '89', '90',
      '91', '92', '93', '94', '95', '96', '97', '98', '99', '100',
      '101', '102', '103', '104', '105', '106', '107', '108', '109', '110',
      '111', '112', '113', '114', '115', '116', '117', '118', '119', '120',
      '121', '122', '123', '124', '125', '126', '127', '128', '129', '130'
    ]
  }

  /**
   * Get scheduler status and statistics
   * 
   * @returns Scheduler status information
   */
  getSchedulerStatus(): {
    isRunning: boolean
    scheduledCount: number
    pendingCount: number
    failedCount: number
    lastProcessedAt?: Date
  } {
    const scheduled = Array.from(this.scheduledReconciliations.values())
    
    return {
      isRunning: this.isRunning,
      scheduledCount: scheduled.length,
      pendingCount: scheduled.filter(s => s.status === 'pending').length,
      failedCount: scheduled.filter(s => s.status === 'failed').length
    }
  }
}