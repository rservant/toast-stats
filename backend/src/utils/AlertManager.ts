/**
 * Alert Manager for Administrator Notifications
 *
 * Provides centralized alerting functionality for circuit breaker events,
 * and other critical system issues.
 */

import { logger } from './logger.js'

export interface IAlertManager {
  sendAlert(
    severity: AlertSeverity,
    category: AlertCategory,
    title: string,
    message: string,
    context?: Record<string, unknown>
  ): Promise<string | null>
  sendCircuitBreakerAlert(
    circuitName: string,
    state: string,
    failureCount: number,
    nextRetryTime?: Date
  ): Promise<string | null>
  sendDashboardUnavailableAlert(
    duration: number,
    lastError: string,
    affectedOperations: string[]
  ): Promise<string | null>
  sendDataQualityAlert(
    districtId: string,
    date: string,
    issue: string,
    details: Record<string, unknown>
  ): Promise<string | null>
  resolveAlert(alertId: string, resolvedBy?: string): Promise<boolean>
  getActiveAlerts(category?: AlertCategory): Alert[]
  getAlertStats(): {
    total: number
    active: number
    resolved: number
    bySeverity: Record<AlertSeverity, number>
    byCategory: Record<AlertCategory, number>
  }
  cleanupOldAlerts(): Promise<number>
}

export enum AlertSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum AlertCategory {
  CIRCUIT_BREAKER = 'CIRCUIT_BREAKER',
  DATA_QUALITY = 'DATA_QUALITY',
  SYSTEM = 'SYSTEM',
  NETWORK = 'NETWORK',
}

export interface Alert {
  id: string
  timestamp: Date
  severity: AlertSeverity
  category: AlertCategory
  title: string
  message: string
  context: Record<string, unknown>
  resolved: boolean
  resolvedAt?: Date
  acknowledgedBy?: string
  acknowledgedAt?: Date
}

export interface AlertRule {
  id: string
  category: AlertCategory
  severity: AlertSeverity
  enabled: boolean
  throttleMinutes: number
  description: string
}

export class AlertManager implements IAlertManager {
  private alerts: Map<string, Alert> = new Map()
  private alertRules: Map<string, AlertRule> = new Map()
  private throttleTracker: Map<string, Date> = new Map()

  constructor() {
    this.initializeDefaultRules()
  }

  /**
   * Send an alert
   *
   * @param severity - Alert severity level
   * @param category - Alert category
   * @param title - Short alert title
   * @param message - Detailed alert message
   * @param context - Additional context data
   * @returns Alert ID if sent, null if throttled
   */
  async sendAlert(
    severity: AlertSeverity,
    category: AlertCategory,
    title: string,
    message: string,
    context: Record<string, unknown> = {}
  ): Promise<string | null> {
    const alertId = this.generateAlertId(category, title)

    // Check if this alert is throttled
    if (this.isThrottled(alertId, category)) {
      logger.debug('Alert throttled', { alertId, category, title })
      return null
    }

    const alert: Alert = {
      id: alertId,
      timestamp: new Date(),
      severity,
      category,
      title,
      message,
      context,
      resolved: false,
    }

    this.alerts.set(alertId, alert)
    this.updateThrottle(alertId, category)

    // Log the alert
    logger.error('ALERT TRIGGERED', {
      alertId,
      severity,
      category,
      title,
      message,
      context,
    })

    // Send the alert through configured channels
    await this.deliverAlert(alert)

    return alertId
  }

  /**
   * Send circuit breaker alert
   */
  async sendCircuitBreakerAlert(
    circuitName: string,
    state: string,
    failureCount: number,
    nextRetryTime?: Date
  ): Promise<string | null> {
    const severity =
      state === 'OPEN' ? AlertSeverity.HIGH : AlertSeverity.MEDIUM

    return this.sendAlert(
      severity,
      AlertCategory.CIRCUIT_BREAKER,
      `Circuit Breaker ${state}`,
      `Circuit breaker '${circuitName}' is now ${state} after ${failureCount} failures`,
      {
        circuitName,
        state,
        failureCount,
        nextRetryTime: nextRetryTime?.toISOString(),
      }
    )
  }

  /**
   * Send dashboard unavailable alert
   */
  async sendDashboardUnavailableAlert(
    duration: number,
    lastError: string,
    affectedOperations: string[]
  ): Promise<string | null> {
    const severity =
      duration > 300000 ? AlertSeverity.CRITICAL : AlertSeverity.HIGH // 5 minutes

    return this.sendAlert(
      severity,
      AlertCategory.NETWORK,
      'Dashboard Unavailable',
      `Toastmasters dashboard has been unavailable for ${Math.round(duration / 60000)} minutes. Last error: ${lastError}`,
      { duration, lastError, affectedOperations }
    )
  }

  /**
   * Send data quality alert
   */
  async sendDataQualityAlert(
    districtId: string,
    date: string,
    issue: string,
    details: Record<string, unknown>
  ): Promise<string | null> {
    return this.sendAlert(
      AlertSeverity.MEDIUM,
      AlertCategory.DATA_QUALITY,
      'Data Quality Issue',
      `Data quality issue detected for district ${districtId} on ${date}: ${issue}`,
      { districtId, date, issue, ...details }
    )
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string, resolvedBy?: string): Promise<boolean> {
    const alert = this.alerts.get(alertId)

    if (!alert || alert.resolved) {
      return false
    }

    alert.resolved = true
    alert.resolvedAt = new Date()

    if (resolvedBy) {
      alert.acknowledgedBy = resolvedBy
      alert.acknowledgedAt = new Date()
    }

    logger.info('Alert resolved', {
      alertId,
      resolvedBy,
      title: alert.title,
      category: alert.category,
    })

    return true
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(category?: AlertCategory): Alert[] {
    const alerts = Array.from(this.alerts.values())
      .filter(alert => !alert.resolved)
      .filter(alert => !category || alert.category === category)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

    return alerts
  }

  /**
   * Get alert statistics
   */
  getAlertStats(): {
    total: number
    active: number
    resolved: number
    bySeverity: Record<AlertSeverity, number>
    byCategory: Record<AlertCategory, number>
  } {
    const alerts = Array.from(this.alerts.values())
    const active = alerts.filter(a => !a.resolved)
    const resolved = alerts.filter(a => a.resolved)

    const bySeverity: Record<AlertSeverity, number> = {
      [AlertSeverity.LOW]: 0,
      [AlertSeverity.MEDIUM]: 0,
      [AlertSeverity.HIGH]: 0,
      [AlertSeverity.CRITICAL]: 0,
    }

    const byCategory: Record<AlertCategory, number> = {
      [AlertCategory.CIRCUIT_BREAKER]: 0,
      [AlertCategory.DATA_QUALITY]: 0,
      [AlertCategory.SYSTEM]: 0,
      [AlertCategory.NETWORK]: 0,
    }

    for (const alert of active) {
      bySeverity[alert.severity]++
      byCategory[alert.category]++
    }

    return {
      total: alerts.length,
      active: active.length,
      resolved: resolved.length,
      bySeverity,
      byCategory,
    }
  }

  /**
   * Clean up old resolved alerts (older than 7 days)
   */
  async cleanupOldAlerts(): Promise<number> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    let cleanedCount = 0

    for (const [alertId, alert] of Array.from(this.alerts.entries())) {
      if (
        alert.resolved &&
        alert.resolvedAt &&
        alert.resolvedAt < sevenDaysAgo
      ) {
        this.alerts.delete(alertId)
        cleanedCount++
      }
    }

    if (cleanedCount > 0) {
      logger.info('Cleaned up old alerts', { count: cleanedCount })
    }

    return cleanedCount
  }

  /**
   * Initialize default alert rules
   */
  private initializeDefaultRules(): void {
    const defaultRules: AlertRule[] = [
      {
        id: 'circuit-breaker-open',
        category: AlertCategory.CIRCUIT_BREAKER,
        severity: AlertSeverity.HIGH,
        enabled: true,
        throttleMinutes: 15,
        description: 'Circuit breaker opened',
      },
      {
        id: 'dashboard-unavailable',
        category: AlertCategory.NETWORK,
        severity: AlertSeverity.CRITICAL,
        enabled: true,
        throttleMinutes: 10,
        description: 'Dashboard unavailable for extended period',
      },
      {
        id: 'data-quality-issue',
        category: AlertCategory.DATA_QUALITY,
        severity: AlertSeverity.MEDIUM,
        enabled: true,
        throttleMinutes: 60,
        description: 'Data quality issues detected',
      },
    ]

    for (const rule of defaultRules) {
      this.alertRules.set(rule.id, rule)
    }
  }

  /**
   * Check if an alert is throttled
   */
  private isThrottled(alertId: string, category: AlertCategory): boolean {
    const rule = this.getAlertRule(category)
    if (!rule || !rule.enabled) {
      return true // Disabled rules are effectively throttled
    }

    const lastSent = this.throttleTracker.get(alertId)
    if (!lastSent) {
      return false
    }

    const throttleMs = rule.throttleMinutes * 60 * 1000
    return Date.now() - lastSent.getTime() < throttleMs
  }

  /**
   * Update throttle tracker
   */
  private updateThrottle(alertId: string, _category: AlertCategory): void {
    this.throttleTracker.set(alertId, new Date())
  }

  /**
   * Get alert rule for category
   */
  private getAlertRule(category: AlertCategory): AlertRule | undefined {
    return Array.from(this.alertRules.values()).find(
      rule => rule.category === category
    )
  }

  /**
   * Generate alert ID
   */
  private generateAlertId(category: AlertCategory, title: string): string {
    const hash = Buffer.from(`${category}-${title}`)
      .toString('base64')
      .slice(0, 8)
    return `alert-${hash}-${Date.now()}`
  }

  /**
   * Deliver alert through configured channels
   */
  private async deliverAlert(alert: Alert): Promise<void> {
    // In a production environment, this would integrate with:
    // - Email services (SendGrid, AWS SES, etc.)
    // - Slack/Teams webhooks
    // - PagerDuty/OpsGenie
    // - SMS services

    // For now, we'll use structured logging that can be picked up by monitoring systems
    logger.error('ADMINISTRATOR ALERT', {
      alertId: alert.id,
      severity: alert.severity,
      category: alert.category,
      title: alert.title,
      message: alert.message,
      context: alert.context,
      timestamp: alert.timestamp.toISOString(),
      // Add tags for monitoring systems to pick up
      tags: [
        'alert',
        'administrator',
        alert.severity.toLowerCase(),
        alert.category.toLowerCase(),
      ],
    })

    // TODO: Implement actual delivery mechanisms based on deployment environment
    // Examples:
    // - await this.sendEmail(alert)
    // - await this.sendSlackMessage(alert)
    // - await this.sendPagerDutyAlert(alert)
  }
}
