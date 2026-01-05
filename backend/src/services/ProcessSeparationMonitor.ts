/**
 * ProcessSeparationMonitor provides continuous monitoring of process separation compliance
 *
 * This service:
 * - Continuously monitors process separation compliance
 * - Provides real-time metrics and alerts
 * - Tracks compliance trends over time
 * - Integrates with logging and alerting systems
 *
 * Requirements: 2.2, 2.3
 */

import { logger } from '../utils/logger.js'
import {
  ProcessSeparationValidator,
  type ComplianceMetrics,
} from './ProcessSeparationValidator.js'
import type { SnapshotStore } from '../types/snapshots.js'
import type { RefreshService } from './RefreshService.js'

/**
 * Monitoring configuration
 */
export interface ProcessSeparationMonitorConfig {
  /** Monitoring interval in milliseconds */
  monitoringIntervalMs: number
  /** Compliance score threshold for warnings */
  warningThreshold: number
  /** Compliance score threshold for critical alerts */
  criticalThreshold: number
  /** Maximum number of compliance history entries to keep */
  maxHistoryEntries: number
  /** Whether to enable automatic monitoring */
  enableAutoMonitoring: boolean
}

/**
 * Monitoring alert
 */
export interface ProcessSeparationAlert {
  /** Alert severity level */
  severity: 'info' | 'warning' | 'critical'
  /** Alert message */
  message: string
  /** Alert timestamp */
  timestamp: string
  /** Current compliance score */
  complianceScore: number
  /** Compliance status */
  complianceStatus: string
  /** Recommended actions */
  recommendedActions: string[]
  /** Alert ID for tracking */
  alertId: string
}

/**
 * Monitoring status
 */
export interface ProcessSeparationMonitorStatus {
  /** Whether monitoring is active */
  isActive: boolean
  /** Last monitoring check timestamp */
  lastCheckTime: string
  /** Current compliance metrics */
  currentMetrics: ComplianceMetrics
  /** Recent alerts */
  recentAlerts: ProcessSeparationAlert[]
  /** Monitoring configuration */
  config: ProcessSeparationMonitorConfig
  /** Monitoring statistics */
  statistics: {
    totalChecks: number
    alertsGenerated: number
    averageComplianceScore: number
    uptimePercentage: number
  }
}

/**
 * ProcessSeparationMonitor continuously monitors process separation compliance
 */
export class ProcessSeparationMonitor {
  private readonly validator: ProcessSeparationValidator
  private readonly config: ProcessSeparationMonitorConfig
  private monitoringTimer: ReturnType<typeof setTimeout> | null = null
  private isMonitoring = false
  private readonly alerts: ProcessSeparationAlert[] = []
  private readonly statistics = {
    totalChecks: 0,
    alertsGenerated: 0,
    complianceScores: [] as number[],
    startTime: Date.now(),
  }

  // Default configuration
  private static readonly DEFAULT_CONFIG: ProcessSeparationMonitorConfig = {
    monitoringIntervalMs: 300000, // 5 minutes
    warningThreshold: 80,
    criticalThreshold: 60,
    maxHistoryEntries: 100,
    enableAutoMonitoring: false,
  }

  constructor(
    snapshotStore: SnapshotStore,
    refreshService: RefreshService,
    config: Partial<ProcessSeparationMonitorConfig> = {}
  ) {
    this.validator = new ProcessSeparationValidator(
      snapshotStore,
      refreshService
    )
    this.config = { ...ProcessSeparationMonitor.DEFAULT_CONFIG, ...config }

    logger.info('ProcessSeparationMonitor initialized', {
      operation: 'constructor',
      monitoring_interval_ms: this.config.monitoringIntervalMs,
      warning_threshold: this.config.warningThreshold,
      critical_threshold: this.config.criticalThreshold,
      auto_monitoring_enabled: this.config.enableAutoMonitoring,
    })

    // Start automatic monitoring if enabled
    if (this.config.enableAutoMonitoring) {
      this.startMonitoring()
    }
  }

  /**
   * Start continuous monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      logger.warn('Process separation monitoring is already active', {
        operation: 'startMonitoring',
      })
      return
    }

    this.isMonitoring = true
    this.scheduleNextCheck()

    logger.info('Process separation monitoring started', {
      operation: 'startMonitoring',
      interval_ms: this.config.monitoringIntervalMs,
    })
  }

  /**
   * Stop continuous monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      logger.warn('Process separation monitoring is not active', {
        operation: 'stopMonitoring',
      })
      return
    }

    this.isMonitoring = false

    if (this.monitoringTimer) {
      clearTimeout(this.monitoringTimer)
      this.monitoringTimer = null
    }

    logger.info('Process separation monitoring stopped', {
      operation: 'stopMonitoring',
      total_checks: this.statistics.totalChecks,
      alerts_generated: this.statistics.alertsGenerated,
    })
  }

  /**
   * Perform a single monitoring check
   */
  async performMonitoringCheck(): Promise<ComplianceMetrics> {
    const checkId = `monitoring_check_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    logger.debug('Performing process separation monitoring check', {
      operation: 'performMonitoringCheck',
      check_id: checkId,
    })

    try {
      // Get current compliance metrics
      const metrics = await this.validator.getComplianceMetrics()

      // Update statistics
      this.statistics.totalChecks++
      this.statistics.complianceScores.push(metrics.processSeparationScore)

      // Keep only recent scores for average calculation
      if (this.statistics.complianceScores.length > 100) {
        this.statistics.complianceScores =
          this.statistics.complianceScores.slice(-100)
      }

      // Check for alert conditions
      await this.checkAlertConditions(metrics)

      logger.debug('Process separation monitoring check completed', {
        operation: 'performMonitoringCheck',
        check_id: checkId,
        compliance_score: metrics.processSeparationScore,
        compliance_status: metrics.complianceStatus,
        read_health: metrics.readOperationHealth,
        refresh_health: metrics.refreshOperationHealth,
      })

      return metrics
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      logger.error('Process separation monitoring check failed', {
        operation: 'performMonitoringCheck',
        check_id: checkId,
        error: errorMessage,
      })

      // Generate critical alert for monitoring failure
      await this.generateAlert(
        'critical',
        'Monitoring check failed',
        0,
        'unknown',
        [
          'Check system health',
          'Review monitoring service logs',
          'Verify snapshot store accessibility',
        ]
      )

      throw new Error(`Monitoring check failed: ${errorMessage}`)
    }
  }

  /**
   * Get current monitoring status
   */
  async getMonitoringStatus(): Promise<ProcessSeparationMonitorStatus> {
    logger.debug('Retrieving process separation monitoring status', {
      operation: 'getMonitoringStatus',
    })

    try {
      // Get current metrics
      const currentMetrics = await this.validator.getComplianceMetrics()

      // Calculate statistics
      const averageComplianceScore =
        this.statistics.complianceScores.length > 0
          ? this.statistics.complianceScores.reduce(
              (sum, score) => sum + score,
              0
            ) / this.statistics.complianceScores.length
          : 0

      // const uptimeMs = Date.now() - this.statistics.startTime
      const uptimePercentage = this.isMonitoring ? 100 : 0 // Simplified uptime calculation

      const status: ProcessSeparationMonitorStatus = {
        isActive: this.isMonitoring,
        lastCheckTime: currentMetrics.lastValidationTime,
        currentMetrics,
        recentAlerts: this.getRecentAlerts(10), // Last 10 alerts
        config: this.config,
        statistics: {
          totalChecks: this.statistics.totalChecks,
          alertsGenerated: this.statistics.alertsGenerated,
          averageComplianceScore,
          uptimePercentage,
        },
      }

      logger.debug('Process separation monitoring status retrieved', {
        operation: 'getMonitoringStatus',
        is_active: status.isActive,
        total_checks: status.statistics.totalChecks,
        alerts_generated: status.statistics.alertsGenerated,
        average_score: averageComplianceScore,
      })

      return status
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      logger.error('Failed to get monitoring status', {
        operation: 'getMonitoringStatus',
        error: errorMessage,
      })

      throw new Error(`Failed to get monitoring status: ${errorMessage}`)
    }
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(limit: number = 10): ProcessSeparationAlert[] {
    return this.alerts
      .slice(-limit)
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
  }

  /**
   * Update monitoring configuration
   */
  updateConfiguration(
    newConfig: Partial<ProcessSeparationMonitorConfig>
  ): void {
    const oldConfig = { ...this.config }
    Object.assign(this.config, newConfig)

    logger.info('Process separation monitoring configuration updated', {
      operation: 'updateConfiguration',
      old_interval: oldConfig.monitoringIntervalMs,
      new_interval: this.config.monitoringIntervalMs,
      old_warning_threshold: oldConfig.warningThreshold,
      new_warning_threshold: this.config.warningThreshold,
      old_critical_threshold: oldConfig.criticalThreshold,
      new_critical_threshold: this.config.criticalThreshold,
    })

    // Restart monitoring if interval changed and monitoring is active
    if (
      this.isMonitoring &&
      oldConfig.monitoringIntervalMs !== this.config.monitoringIntervalMs
    ) {
      this.stopMonitoring()
      this.startMonitoring()
    }
  }

  /**
   * Schedule the next monitoring check
   */
  private scheduleNextCheck(): void {
    if (!this.isMonitoring) {
      return
    }

    this.monitoringTimer = setTimeout(async () => {
      try {
        await this.performMonitoringCheck()
      } catch (error) {
        logger.error('Scheduled monitoring check failed', {
          operation: 'scheduleNextCheck',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }

      // Schedule next check
      this.scheduleNextCheck()
    }, this.config.monitoringIntervalMs)
  }

  /**
   * Check for alert conditions and generate alerts if needed
   */
  private async checkAlertConditions(
    metrics: ComplianceMetrics
  ): Promise<void> {
    const score = metrics.processSeparationScore
    const status = metrics.complianceStatus

    // Generate alerts based on thresholds
    if (score <= this.config.criticalThreshold) {
      await this.generateAlert(
        'critical',
        'Process separation compliance is critical',
        score,
        status,
        [
          'Immediate investigation required',
          'Check snapshot store performance',
          'Review refresh operation impact on reads',
          'Consider scaling resources',
        ]
      )
    } else if (score <= this.config.warningThreshold) {
      await this.generateAlert(
        'warning',
        'Process separation compliance is degraded',
        score,
        status,
        [
          'Monitor system performance closely',
          'Review recent changes',
          'Check resource utilization',
          'Consider performance optimization',
        ]
      )
    } else if (status === 'compliant' && score >= 95) {
      // Generate info alert for excellent compliance (but limit frequency)
      const recentInfoAlerts = this.alerts.filter(
        alert =>
          alert.severity === 'info' &&
          Date.now() - new Date(alert.timestamp).getTime() < 3600000 // Last hour
      )

      if (recentInfoAlerts.length === 0) {
        await this.generateAlert(
          'info',
          'Process separation compliance is excellent',
          score,
          status,
          [
            'System is performing optimally',
            'Continue current monitoring practices',
          ]
        )
      }
    }
  }

  /**
   * Generate and store an alert
   */
  private async generateAlert(
    severity: 'info' | 'warning' | 'critical',
    message: string,
    complianceScore: number,
    complianceStatus: string,
    recommendedActions: string[]
  ): Promise<void> {
    const alert: ProcessSeparationAlert = {
      severity,
      message,
      timestamp: new Date().toISOString(),
      complianceScore,
      complianceStatus,
      recommendedActions,
      alertId: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    }

    // Store alert
    this.alerts.push(alert)
    this.statistics.alertsGenerated++

    // Limit alert history
    if (this.alerts.length > this.config.maxHistoryEntries) {
      this.alerts.splice(0, this.alerts.length - this.config.maxHistoryEntries)
    }

    // Log alert
    const logLevel =
      severity === 'critical'
        ? 'error'
        : severity === 'warning'
          ? 'warn'
          : 'info'
    logger[logLevel]('Process separation alert generated', {
      operation: 'generateAlert',
      alert_id: alert.alertId,
      severity: alert.severity,
      message: alert.message,
      compliance_score: alert.complianceScore,
      compliance_status: alert.complianceStatus,
      recommended_actions: alert.recommendedActions,
    })
  }

  /**
   * Cleanup resources when shutting down
   */
  destroy(): void {
    this.stopMonitoring()

    logger.info('ProcessSeparationMonitor destroyed', {
      operation: 'destroy',
      total_checks: this.statistics.totalChecks,
      alerts_generated: this.statistics.alertsGenerated,
    })
  }
}
