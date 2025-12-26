/**
 * Reconciliation Metrics Service
 *
 * Tracks and provides metrics for reconciliation job success/failure rates,
 * duration patterns, and performance monitoring for alerting and analysis.
 */

import { logger } from '../utils/logger.js'
import {
  AlertManager,
  AlertSeverity,
  AlertCategory,
} from '../utils/AlertManager.js'
import type { ReconciliationJob } from '../types/reconciliation.js'

export interface ReconciliationMetrics {
  totalJobs: number
  successfulJobs: number
  failedJobs: number
  cancelledJobs: number
  activeJobs: number
  successRate: number
  failureRate: number
  averageDuration: number
  medianDuration: number
  longestDuration: number
  shortestDuration: number
  averageStabilityPeriod: number
  extensionRate: number
  timeoutRate: number
}

export interface JobDurationMetrics {
  jobId: string
  districtId: string
  targetMonth: string
  startDate: Date
  endDate?: Date
  duration?: number
  status: string
  wasExtended: boolean
  extensionCount: number
  finalStabilityDays: number
}

export interface PerformancePattern {
  pattern: 'normal' | 'extended' | 'timeout' | 'frequent_failures'
  description: string
  severity: 'low' | 'medium' | 'high'
  affectedJobs: string[]
  recommendation: string
}

export class ReconciliationMetricsService {
  private static instance: ReconciliationMetricsService
  private alertManager: AlertManager
  private jobMetrics: Map<string, JobDurationMetrics> = new Map()
  private performanceHistory: PerformancePattern[] = []
  private lastCleanup: Date = new Date()

  private constructor() {
    this.alertManager = AlertManager.getInstance()
    logger.info('ReconciliationMetricsService initialized')
  }

  static getInstance(): ReconciliationMetricsService {
    if (!ReconciliationMetricsService.instance) {
      ReconciliationMetricsService.instance = new ReconciliationMetricsService()
    }
    return ReconciliationMetricsService.instance
  }
  /**
   * Record job start metrics
   */
  recordJobStart(job: ReconciliationJob): void {
    const metrics: JobDurationMetrics = {
      jobId: job.id,
      districtId: job.districtId,
      targetMonth: job.targetMonth,
      startDate: job.startDate,
      status: job.status,
      wasExtended: false,
      extensionCount: 0,
      finalStabilityDays: 0,
    }

    this.jobMetrics.set(job.id, metrics)

    logger.info('Job start recorded', {
      jobId: job.id,
      districtId: job.districtId,
      targetMonth: job.targetMonth,
    })
  }

  /**
   * Record job completion metrics
   */
  recordJobCompletion(job: ReconciliationJob, stabilityDays: number): void {
    const metrics = this.jobMetrics.get(job.id)
    if (!metrics) {
      logger.warn('Job metrics not found for completion', { jobId: job.id })
      return
    }

    metrics.endDate = job.endDate || new Date()
    metrics.duration = metrics.endDate.getTime() - metrics.startDate.getTime()
    metrics.status = job.status
    metrics.finalStabilityDays = stabilityDays

    logger.info('Job completion recorded', {
      jobId: job.id,
      duration: metrics.duration,
      status: job.status,
      stabilityDays,
    })

    // Check for performance patterns
    this.analyzePerformancePatterns()
  }

  /**
   * Record job extension
   */
  recordJobExtension(jobId: string, extensionDays: number): void {
    const metrics = this.jobMetrics.get(jobId)
    if (!metrics) {
      logger.warn('Job metrics not found for extension', { jobId })
      return
    }

    metrics.wasExtended = true
    metrics.extensionCount++

    logger.info('Job extension recorded', {
      jobId,
      extensionDays,
      totalExtensions: metrics.extensionCount,
    })
  }

  /**
   * Record job failure
   */
  async recordJobFailure(job: ReconciliationJob, error: string): Promise<void> {
    const metrics = this.jobMetrics.get(job.id)
    if (metrics) {
      metrics.endDate = new Date()
      metrics.duration = metrics.endDate.getTime() - metrics.startDate.getTime()
      metrics.status = 'failed'
    }

    logger.error('Job failure recorded', {
      jobId: job.id,
      districtId: job.districtId,
      targetMonth: job.targetMonth,
      error,
    })

    // Send failure alert
    await this.alertManager.sendReconciliationFailureAlert(
      job.districtId,
      job.targetMonth,
      error,
      job.id
    )

    // Check for failure patterns
    this.analyzePerformancePatterns()
  }
  /**
   * Get comprehensive reconciliation metrics
   */
  getMetrics(): ReconciliationMetrics {
    const allJobs = Array.from(this.jobMetrics.values())
    const completedJobs = allJobs.filter(
      job => job.endDate && job.duration !== undefined
    )

    const totalJobs = allJobs.length
    const successfulJobs = allJobs.filter(
      job => job.status === 'completed'
    ).length
    const failedJobs = allJobs.filter(job => job.status === 'failed').length
    const cancelledJobs = allJobs.filter(
      job => job.status === 'cancelled'
    ).length
    const activeJobs = allJobs.filter(job => job.status === 'active').length

    const durations = completedJobs.map(job => job.duration!).filter(d => d > 0)
    const extendedJobs = allJobs.filter(job => job.wasExtended).length
    const timedOutJobs = allJobs.filter(
      job =>
        job.status === 'failed' &&
        job.duration &&
        job.duration > 15 * 24 * 60 * 60 * 1000
    ).length

    return {
      totalJobs,
      successfulJobs,
      failedJobs,
      cancelledJobs,
      activeJobs,
      successRate: totalJobs > 0 ? (successfulJobs / totalJobs) * 100 : 0,
      failureRate: totalJobs > 0 ? (failedJobs / totalJobs) * 100 : 0,
      averageDuration:
        durations.length > 0
          ? durations.reduce((a, b) => a + b, 0) / durations.length
          : 0,
      medianDuration: this.calculateMedian(durations),
      longestDuration: durations.length > 0 ? Math.max(...durations) : 0,
      shortestDuration: durations.length > 0 ? Math.min(...durations) : 0,
      averageStabilityPeriod: this.calculateAverageStabilityPeriod(),
      extensionRate: totalJobs > 0 ? (extendedJobs / totalJobs) * 100 : 0,
      timeoutRate: totalJobs > 0 ? (timedOutJobs / totalJobs) * 100 : 0,
    }
  }

  /**
   * Get job duration metrics for analysis
   */
  getJobDurationMetrics(): JobDurationMetrics[] {
    return Array.from(this.jobMetrics.values())
  }

  /**
   * Get performance patterns detected
   */
  getPerformancePatterns(): PerformancePattern[] {
    return [...this.performanceHistory]
  }

  /**
   * Get metrics for a specific district
   */
  getDistrictMetrics(districtId: string): ReconciliationMetrics {
    const districtJobs = Array.from(this.jobMetrics.values()).filter(
      job => job.districtId === districtId
    )
    const completedJobs = districtJobs.filter(
      job => job.endDate && job.duration !== undefined
    )

    const totalJobs = districtJobs.length
    const successfulJobs = districtJobs.filter(
      job => job.status === 'completed'
    ).length
    const failedJobs = districtJobs.filter(
      job => job.status === 'failed'
    ).length
    const cancelledJobs = districtJobs.filter(
      job => job.status === 'cancelled'
    ).length
    const activeJobs = districtJobs.filter(
      job => job.status === 'active'
    ).length

    const durations = completedJobs.map(job => job.duration!).filter(d => d > 0)
    const extendedJobs = districtJobs.filter(job => job.wasExtended).length
    const timedOutJobs = districtJobs.filter(
      job =>
        job.status === 'failed' &&
        job.duration &&
        job.duration > 15 * 24 * 60 * 60 * 1000
    ).length

    return {
      totalJobs,
      successfulJobs,
      failedJobs,
      cancelledJobs,
      activeJobs,
      successRate: totalJobs > 0 ? (successfulJobs / totalJobs) * 100 : 0,
      failureRate: totalJobs > 0 ? (failedJobs / totalJobs) * 100 : 0,
      averageDuration:
        durations.length > 0
          ? durations.reduce((a, b) => a + b, 0) / durations.length
          : 0,
      medianDuration: this.calculateMedian(durations),
      longestDuration: durations.length > 0 ? Math.max(...durations) : 0,
      shortestDuration: durations.length > 0 ? Math.min(...durations) : 0,
      averageStabilityPeriod: this.calculateAverageStabilityPeriod(districtId),
      extensionRate: totalJobs > 0 ? (extendedJobs / totalJobs) * 100 : 0,
      timeoutRate: totalJobs > 0 ? (timedOutJobs / totalJobs) * 100 : 0,
    }
  }
  /**
   * Analyze performance patterns and detect issues
   */
  private analyzePerformancePatterns(): void {
    const recentJobs = Array.from(this.jobMetrics.values()).filter(
      job => job.startDate.getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000
    ) // Last 30 days

    // Check for frequent failures
    const recentFailures = recentJobs.filter(job => job.status === 'failed')
    if (recentFailures.length >= 3) {
      this.addPerformancePattern({
        pattern: 'frequent_failures',
        description: `${recentFailures.length} reconciliation failures in the last 30 days`,
        severity: 'high',
        affectedJobs: recentFailures.map(job => job.jobId),
        recommendation:
          'Investigate dashboard connectivity and data quality issues',
      })
    }

    // Check for extended reconciliation periods
    const extendedJobs = recentJobs.filter(
      job => job.wasExtended && job.extensionCount > 1
    )
    if (extendedJobs.length >= 2) {
      this.addPerformancePattern({
        pattern: 'extended',
        description: `${extendedJobs.length} jobs required multiple extensions in the last 30 days`,
        severity: 'medium',
        affectedJobs: extendedJobs.map(job => job.jobId),
        recommendation:
          'Review reconciliation configuration and stability thresholds',
      })
    }

    // Check for timeout patterns
    const timeoutJobs = recentJobs.filter(
      job => job.duration && job.duration > 15 * 24 * 60 * 60 * 1000 // 15 days
    )
    if (timeoutJobs.length >= 2) {
      this.addPerformancePattern({
        pattern: 'timeout',
        description: `${timeoutJobs.length} jobs exceeded maximum reconciliation period`,
        severity: 'high',
        affectedJobs: timeoutJobs.map(job => job.jobId),
        recommendation:
          'Increase maximum reconciliation period or investigate data stability issues',
      })
    }
  }

  /**
   * Add a performance pattern to history
   */
  private addPerformancePattern(pattern: PerformancePattern): void {
    // Avoid duplicate patterns
    const existing = this.performanceHistory.find(
      p =>
        p.pattern === pattern.pattern && p.description === pattern.description
    )

    if (!existing) {
      this.performanceHistory.push(pattern)

      // Send alert for high severity patterns
      if (pattern.severity === 'high') {
        this.alertManager.sendAlert(
          AlertSeverity.HIGH,
          AlertCategory.RECONCILIATION,
          `Performance Pattern Detected: ${pattern.pattern}`,
          pattern.description,
          {
            pattern: pattern.pattern,
            affectedJobs: pattern.affectedJobs,
            recommendation: pattern.recommendation,
          }
        )
      }
    }
  }

  /**
   * Calculate median duration
   */
  private calculateMedian(durations: number[]): number {
    if (durations.length === 0) return 0

    const sorted = [...durations].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)

    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid]
  }

  /**
   * Calculate average stability period
   */
  private calculateAverageStabilityPeriod(districtId?: string): number {
    const jobs = Array.from(this.jobMetrics.values())
      .filter(job => !districtId || job.districtId === districtId)
      .filter(job => job.status === 'completed' && job.finalStabilityDays > 0)

    if (jobs.length === 0) return 0

    return (
      jobs.reduce((sum, job) => sum + job.finalStabilityDays, 0) / jobs.length
    )
  }

  /**
   * Clean up old metrics (keep last 90 days)
   */
  async cleanupOldMetrics(): Promise<number> {
    const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    let cleanedCount = 0

    for (const [jobId, metrics] of this.jobMetrics.entries()) {
      if (metrics.startDate < cutoffDate && metrics.status !== 'active') {
        this.jobMetrics.delete(jobId)
        cleanedCount++
      }
    }

    // Clean up old performance patterns
    this.performanceHistory = this.performanceHistory.filter(pattern =>
      pattern.affectedJobs.some(jobId => this.jobMetrics.has(jobId))
    )

    this.lastCleanup = new Date()

    if (cleanedCount > 0) {
      logger.info('Cleaned up old reconciliation metrics', {
        cleanedCount,
        remainingJobs: this.jobMetrics.size,
      })
    }

    return cleanedCount
  }

  /**
   * Reset all metrics (for testing or maintenance)
   */
  resetMetrics(): void {
    this.jobMetrics.clear()
    this.performanceHistory = []
    logger.info('Reconciliation metrics reset')
  }

  /**
   * Get health status of the metrics service
   */
  getHealthStatus(): {
    isHealthy: boolean
    lastCleanup: string
    totalJobs: number
    activeJobs: number
    performancePatterns: number
  } {
    const metrics = this.getMetrics()

    return {
      isHealthy: true,
      lastCleanup: this.lastCleanup.toISOString(),
      totalJobs: metrics.totalJobs,
      activeJobs: metrics.activeJobs,
      performancePatterns: this.performanceHistory.length,
    }
  }
}
