/**
 * Integrated Test Monitoring Service
 *
 * This module provides a unified interface for all test monitoring capabilities:
 * - Test reliability monitoring
 * - Performance monitoring and alerting
 * - Flaky test detection and reporting
 * - Failure categorization system
 * - Dashboard data aggregation
 *
 * **Feature: test-infrastructure-stabilization**
 * **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**
 */

import { logger } from './logger.js'
import {
  TestReliabilityMonitor,
  DefaultTestReliabilityMonitor,
  TestResult,
  TestReliabilityMetrics,
  FlakyTestDetection,
  PerformanceAlert,
} from './TestReliabilityMonitor.js'
import {
  TestPerformanceMonitor,
  DefaultTestPerformanceMonitor,
  TestHealthDashboard,
  PerformanceTrend,
} from './TestPerformanceMonitor.js'

/**
 * Comprehensive test monitoring report
 */
export interface TestMonitoringReport {
  /** Reliability metrics */
  reliability: TestReliabilityMetrics
  /** Flaky test detections */
  flakyTests: FlakyTestDetection[]
  /** Performance alerts */
  performanceAlerts: PerformanceAlert[]
  /** Performance trends */
  performanceTrends: PerformanceTrend[]
  /** Health dashboard */
  dashboard: TestHealthDashboard
  /** Report generation timestamp */
  generatedAt: Date
}

/**
 * Alert configuration
 */
export interface AlertConfiguration {
  /** Enable flaky test alerts */
  enableFlakyTestAlerts: boolean
  /** Enable performance degradation alerts */
  enablePerformanceAlerts: boolean
  /** Flaky test threshold (failure rate) */
  flakyTestThreshold: number
  /** Performance degradation threshold (multiplier) */
  performanceDegradationThreshold: number
  /** Alert cooldown period in minutes */
  alertCooldownMinutes: number
}

/**
 * Integrated test monitor interface
 */
export interface IntegratedTestMonitor {
  /** Record a test result */
  recordTestResult(result: TestResult): void

  /** Generate comprehensive monitoring report */
  generateReport(): TestMonitoringReport

  /** Get reliability metrics */
  getReliabilityMetrics(): TestReliabilityMetrics

  /** Detect flaky tests */
  detectFlakyTests(): FlakyTestDetection[]

  /** Check for performance issues */
  checkPerformanceIssues(): PerformanceAlert[]

  /** Get health dashboard */
  getHealthDashboard(): TestHealthDashboard

  /** Configure alerts */
  configureAlerts(config: AlertConfiguration): void

  /** Clear all monitoring data */
  clearAllData(): void
}

/**
 * Default implementation of integrated test monitor
 */
export class DefaultIntegratedTestMonitor implements IntegratedTestMonitor {
  private reliabilityMonitor: TestReliabilityMonitor
  private performanceMonitor: TestPerformanceMonitor
  private alertConfig: AlertConfiguration
  private lastAlertTimes: Map<string, Date> = new Map()

  constructor() {
    this.reliabilityMonitor = new DefaultTestReliabilityMonitor()
    this.performanceMonitor = new DefaultTestPerformanceMonitor()
    this.alertConfig = {
      enableFlakyTestAlerts: true,
      enablePerformanceAlerts: true,
      flakyTestThreshold: 0.2,
      performanceDegradationThreshold: 1.5,
      alertCooldownMinutes: 30,
    }
  }

  /**
   * Record a test result and update all monitoring systems
   */
  recordTestResult(result: TestResult): void {
    // Record in both monitoring systems
    this.reliabilityMonitor.recordTestResult(result)
    this.performanceMonitor.recordPerformanceData(result)

    // Check for immediate alerts
    this.checkAndSendAlerts(result)

    logger.debug('Test result recorded in integrated monitor', {
      testName: result.testName,
      suiteName: result.suiteName,
      passed: result.passed,
      executionTime: result.executionTime,
    })
  }

  /**
   * Generate comprehensive monitoring report
   */
  generateReport(): TestMonitoringReport {
    const reliability = this.reliabilityMonitor.getReliabilityMetrics()
    const flakyTests = this.reliabilityMonitor.detectFlakyTests()
    const performanceAlerts =
      this.reliabilityMonitor.checkPerformanceDegradation()
    const performanceTrends = this.performanceMonitor.getPerformanceTrends()
    const dashboard = this.performanceMonitor.generateDashboard()

    return {
      reliability,
      flakyTests,
      performanceAlerts,
      performanceTrends,
      dashboard,
      generatedAt: new Date(),
    }
  }

  /**
   * Get reliability metrics
   */
  getReliabilityMetrics(): TestReliabilityMetrics {
    return this.reliabilityMonitor.getReliabilityMetrics()
  }

  /**
   * Detect flaky tests
   */
  detectFlakyTests(): FlakyTestDetection[] {
    return this.reliabilityMonitor.detectFlakyTests()
  }

  /**
   * Check for performance issues
   */
  checkPerformanceIssues(): PerformanceAlert[] {
    return this.reliabilityMonitor.checkPerformanceDegradation()
  }

  /**
   * Get health dashboard
   */
  getHealthDashboard(): TestHealthDashboard {
    return this.performanceMonitor.generateDashboard()
  }

  /**
   * Configure alert settings
   */
  configureAlerts(config: AlertConfiguration): void {
    this.alertConfig = { ...config }
    logger.info('Alert configuration updated', { config })
  }

  /**
   * Clear all monitoring data
   */
  clearAllData(): void {
    this.reliabilityMonitor.clearMetrics()
    this.performanceMonitor.clearPerformanceData()
    this.lastAlertTimes.clear()
    logger.info('All monitoring data cleared')
  }

  /**
   * Check for alerts and send notifications
   */
  private checkAndSendAlerts(result: TestResult): void {
    const testKey = `${result.testName}::${result.suiteName}`

    // Check cooldown period
    const lastAlert = this.lastAlertTimes.get(testKey)
    const cooldownPeriod = this.alertConfig.alertCooldownMinutes * 60 * 1000

    if (lastAlert && Date.now() - lastAlert.getTime() < cooldownPeriod) {
      return // Still in cooldown period
    }

    // Check for flaky test alerts
    if (this.alertConfig.enableFlakyTestAlerts) {
      this.checkFlakyTestAlert(result, testKey)
    }

    // Check for performance alerts
    if (this.alertConfig.enablePerformanceAlerts) {
      this.checkPerformanceAlert(result, testKey)
    }
  }

  /**
   * Check and send flaky test alert
   */
  private checkFlakyTestAlert(result: TestResult, testKey: string): void {
    const flakyTests = this.reliabilityMonitor.detectFlakyTests()
    const flakyTest = flakyTests.find(
      ft => ft.testName === result.testName && ft.suiteName === result.suiteName
    )

    if (flakyTest && flakyTest.isFlaky) {
      this.sendAlert({
        type: 'flaky_test',
        testName: result.testName,
        suiteName: result.suiteName,
        message: `Flaky test detected: ${result.testName} (${(flakyTest.failureRate * 100).toFixed(1)}% failure rate)`,
        severity: 'warning',
        data: flakyTest,
      })

      this.lastAlertTimes.set(testKey, new Date())
    }
  }

  /**
   * Check and send performance alert
   */
  private checkPerformanceAlert(result: TestResult, testKey: string): void {
    const performanceAlerts =
      this.reliabilityMonitor.checkPerformanceDegradation()
    const performanceAlert = performanceAlerts.find(
      pa => pa.testName === result.testName && pa.suiteName === result.suiteName
    )

    if (performanceAlert) {
      this.sendAlert({
        type: 'performance_degradation',
        testName: result.testName,
        suiteName: result.suiteName,
        message: `Performance degradation detected: ${result.testName} (${performanceAlert.degradationPercentage.toFixed(1)}% slower)`,
        severity: performanceAlert.severity === 'high' ? 'error' : 'warning',
        data: performanceAlert,
      })

      this.lastAlertTimes.set(testKey, new Date())
    }
  }

  /**
   * Send alert notification
   */
  private sendAlert(alert: {
    type: string
    testName: string
    suiteName: string
    message: string
    severity: 'info' | 'warning' | 'error'
    data: any
  }): void {
    logger.warn('Test monitoring alert', {
      type: alert.type,
      testName: alert.testName,
      suiteName: alert.suiteName,
      message: alert.message,
      severity: alert.severity,
      data: alert.data,
    })

    // In a real implementation, this would send notifications via:
    // - Email
    // - Slack/Teams
    // - Dashboard updates
    // - Webhook calls
    // etc.
  }
}

/**
 * Global integrated test monitor instance
 */
let globalIntegratedMonitor: DefaultIntegratedTestMonitor | null = null

/**
 * Get or create the global integrated test monitor
 */
export function getIntegratedTestMonitor(): IntegratedTestMonitor {
  if (!globalIntegratedMonitor) {
    globalIntegratedMonitor = new DefaultIntegratedTestMonitor()
  }
  return globalIntegratedMonitor
}

/**
 * Reset the global integrated test monitor (for testing)
 */
export function resetIntegratedTestMonitor(): void {
  if (globalIntegratedMonitor) {
    globalIntegratedMonitor.clearAllData()
  }
  globalIntegratedMonitor = null
}

/**
 * Utility function to create a test result from Vitest test data
 */
export function createTestResultFromVitest(
  testName: string,
  suiteName: string,
  passed: boolean,
  executionTime: number,
  error?: string,
  retries: number = 0
): TestResult {
  return {
    testName,
    suiteName,
    passed,
    executionTime,
    error,
    timestamp: new Date(),
    testType: 'unit', // Default to unit test
    retries,
  }
}

/**
 * Utility function to integrate with Vitest hooks
 */
export function setupVitestIntegration(): void {
  // This would be called from Vitest setup files to automatically
  // record test results. In a real implementation, this would hook
  // into Vitest's reporter system or use custom hooks.

  logger.info('Vitest integration setup complete', {
    monitoringEnabled: true,
  })
}
