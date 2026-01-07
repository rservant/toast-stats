/**
 * Test Performance Monitoring and Alerting
 *
 * This module provides performance monitoring and alerting for test execution:
 * - Performance degradation detection
 * - Alert generation and management
 * - Performance trend analysis
 * - Dashboard data aggregation
 *
 * **Feature: test-infrastructure-stabilization**
 * **Validates: Requirements 7.3, 7.4**
 */

import { logger } from './logger.js'
import { TestResult, PerformanceAlert } from './TestReliabilityMonitor.js'

/**
 * Performance trend data
 */
export interface PerformanceTrend {
  /** Test identifier */
  testName: string
  /** Suite name */
  suiteName: string
  /** Time series data points */
  dataPoints: PerformanceDataPoint[]
  /** Trend direction */
  trend: 'improving' | 'degrading' | 'stable'
  /** Trend strength (0-1) */
  trendStrength: number
}

/**
 * Performance data point
 */
export interface PerformanceDataPoint {
  /** Timestamp */
  timestamp: Date
  /** Execution time in milliseconds */
  executionTime: number
  /** Pass/fail status */
  passed: boolean
}

/**
 * Dashboard metrics for test health
 */
export interface TestHealthDashboard {
  /** Overall test health score (0-100) */
  healthScore: number
  /** Total number of tests */
  totalTests: number
  /** Number of flaky tests */
  flakyTests: number
  /** Number of performance alerts */
  performanceAlerts: number
  /** Average execution time */
  averageExecutionTime: number
  /** Pass rate percentage */
  passRate: number
  /** Performance trends */
  performanceTrends: PerformanceTrend[]
  /** Recent alerts */
  recentAlerts: PerformanceAlert[]
  /** Test execution timeline */
  executionTimeline: TimelineEntry[]
}

/**
 * Timeline entry for dashboard
 */
export interface TimelineEntry {
  /** Timestamp */
  timestamp: Date
  /** Event type */
  eventType: 'test_run' | 'flaky_detected' | 'performance_alert' | 'improvement'
  /** Event description */
  description: string
  /** Severity level */
  severity: 'info' | 'warning' | 'error'
  /** Associated test name */
  testName?: string
  /** Associated suite name */
  suiteName?: string
}

/**
 * Test performance monitor interface
 */
export interface TestPerformanceMonitor {
  /** Record performance data */
  recordPerformanceData(result: TestResult): void

  /** Get performance trends */
  getPerformanceTrends(): PerformanceTrend[]

  /** Generate dashboard data */
  generateDashboard(): TestHealthDashboard

  /** Get recent alerts */
  getRecentAlerts(hours?: number): PerformanceAlert[]

  /** Clear performance data */
  clearPerformanceData(): void
}

/**
 * Default implementation of test performance monitor
 */
export class DefaultTestPerformanceMonitor implements TestPerformanceMonitor {
  private performanceData: Map<string, PerformanceDataPoint[]> = new Map()
  private alerts: PerformanceAlert[] = []
  private timeline: TimelineEntry[] = []
  private readonly maxDataPoints = 100
  private readonly maxTimelineEntries = 200

  /**
   * Record performance data for a test
   */
  recordPerformanceData(result: TestResult): void {
    const key = `${result.testName}::${result.suiteName}`

    if (!this.performanceData.has(key)) {
      this.performanceData.set(key, [])
    }

    const dataPoints = this.performanceData.get(key)!
    dataPoints.push({
      timestamp: result.timestamp,
      executionTime: result.executionTime,
      passed: result.passed,
    })

    // Keep only recent data points
    if (dataPoints.length > this.maxDataPoints) {
      dataPoints.splice(0, dataPoints.length - this.maxDataPoints)
    }

    // Add timeline entry
    this.addTimelineEntry({
      timestamp: result.timestamp,
      eventType: 'test_run',
      description: `Test ${result.testName} ${result.passed ? 'passed' : 'failed'} in ${result.executionTime}ms`,
      severity: result.passed ? 'info' : 'warning',
      testName: result.testName,
      suiteName: result.suiteName,
    })

    logger.debug('Performance data recorded', {
      testName: result.testName,
      suiteName: result.suiteName,
      executionTime: result.executionTime,
      passed: result.passed,
    })
  }

  /**
   * Get performance trends for all tests
   */
  getPerformanceTrends(): PerformanceTrend[] {
    const trends: PerformanceTrend[] = []

    for (const [testKey, dataPoints] of Array.from(
      this.performanceData.entries()
    )) {
      if (dataPoints.length < 5) continue // Need enough data for trend analysis

      const keyParts = testKey.split('::')
      const testName = keyParts[0]
      const suiteName = keyParts[1]

      // Skip if key format is invalid
      if (!testName || !suiteName) continue

      const trend = this.calculateTrend(dataPoints)

      trends.push({
        testName,
        suiteName,
        dataPoints: [...dataPoints], // Copy to avoid mutation
        trend: trend.direction,
        trendStrength: trend.strength,
      })
    }

    return trends
  }

  /**
   * Generate comprehensive dashboard data
   */
  generateDashboard(): TestHealthDashboard {
    const allDataPoints = Array.from(this.performanceData.values()).flat()
    const totalTests = this.performanceData.size

    // Calculate basic metrics
    const totalExecutions = allDataPoints.length
    const passedExecutions = allDataPoints.filter(dp => dp.passed).length
    const passRate =
      totalExecutions > 0 ? (passedExecutions / totalExecutions) * 100 : 0

    const totalTime = allDataPoints.reduce(
      (sum, dp) => sum + dp.executionTime,
      0
    )
    const averageExecutionTime =
      totalExecutions > 0 ? totalTime / totalExecutions : 0

    // Get performance trends
    const performanceTrends = this.getPerformanceTrends()

    // Count degrading trends as performance alerts
    const performanceAlerts = performanceTrends.filter(
      trend => trend.trend === 'degrading' && trend.trendStrength > 0.5
    ).length

    // Estimate flaky tests (simplified - would integrate with TestReliabilityMonitor in real implementation)
    const flakyTests = this.estimateFlakyTests()

    // Calculate health score
    const healthScore = this.calculateHealthScore(
      passRate,
      performanceAlerts,
      flakyTests,
      totalTests
    )

    // Get recent alerts
    const recentAlerts = this.getRecentAlerts(24) // Last 24 hours

    return {
      healthScore,
      totalTests,
      flakyTests,
      performanceAlerts,
      averageExecutionTime,
      passRate,
      performanceTrends,
      recentAlerts,
      executionTimeline: [...this.timeline].slice(-50), // Last 50 entries
    }
  }

  /**
   * Get recent performance alerts
   */
  getRecentAlerts(hours: number = 24): PerformanceAlert[] {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000)
    return this.alerts.filter(alert => alert.timestamp >= cutoffTime)
  }

  /**
   * Clear all performance data
   */
  clearPerformanceData(): void {
    this.performanceData.clear()
    this.alerts = []
    this.timeline = []
  }

  /**
   * Calculate trend direction and strength
   */
  private calculateTrend(dataPoints: PerformanceDataPoint[]): {
    direction: 'improving' | 'degrading' | 'stable'
    strength: number
  } {
    if (dataPoints.length < 5) {
      return { direction: 'stable', strength: 0 }
    }

    // Use linear regression to determine trend
    const n = dataPoints.length
    const x = Array.from({ length: n }, (_, i) => i)
    const y = dataPoints.map(dp => dp.executionTime)

    const sumX = x.reduce((sum, val) => sum + val, 0)
    const sumY = y.reduce((sum, val) => sum + val, 0)
    const sumXY = x.reduce((sum, val, i) => {
      const yValue = y[i]
      return yValue !== undefined ? sum + val * yValue : sum
    }, 0)
    const sumXX = x.reduce((sum, val) => sum + val * val, 0)

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)

    // Calculate correlation coefficient for strength
    const meanX = sumX / n
    const meanY = sumY / n

    const numerator = x.reduce((sum, val, i) => {
      const yValue = y[i]
      return yValue !== undefined ? sum + (val - meanX) * (yValue - meanY) : sum
    }, 0)
    const denomX = Math.sqrt(
      x.reduce((sum, val) => sum + (val - meanX) ** 2, 0)
    )
    const denomY = Math.sqrt(
      y.reduce((sum, val) => sum + (val - meanY) ** 2, 0)
    )

    const correlation = denomX * denomY > 0 ? numerator / (denomX * denomY) : 0
    const strength = Math.abs(correlation)

    // Determine direction based on slope
    let direction: 'improving' | 'degrading' | 'stable'
    if (Math.abs(slope) < 1) {
      // Less than 1ms change per execution
      direction = 'stable'
    } else if (slope > 0) {
      direction = 'degrading' // Execution time increasing
    } else {
      direction = 'improving' // Execution time decreasing
    }

    return { direction, strength }
  }

  /**
   * Add entry to timeline
   */
  private addTimelineEntry(entry: TimelineEntry): void {
    this.timeline.push(entry)

    // Keep only recent entries
    if (this.timeline.length > this.maxTimelineEntries) {
      this.timeline.splice(0, this.timeline.length - this.maxTimelineEntries)
    }
  }

  /**
   * Estimate flaky tests based on performance data
   */
  private estimateFlakyTests(): number {
    let flakyCount = 0

    for (const [, dataPoints] of Array.from(this.performanceData.entries())) {
      if (dataPoints.length < 5) continue

      const failures = dataPoints.filter(dp => !dp.passed).length
      const failureRate = failures / dataPoints.length

      // Simple flaky test detection based on failure rate
      if (failureRate > 0 && failureRate < 1 && failureRate >= 0.2) {
        flakyCount++
      }
    }

    return flakyCount
  }

  /**
   * Calculate overall health score
   */
  private calculateHealthScore(
    passRate: number,
    performanceAlerts: number,
    flakyTests: number,
    totalTests: number
  ): number {
    // Base score from pass rate
    let score = passRate

    // Penalize for performance alerts
    const alertPenalty = Math.min(performanceAlerts * 5, 20) // Max 20 point penalty
    score -= alertPenalty

    // Penalize for flaky tests
    const flakyPenalty = totalTests > 0 ? (flakyTests / totalTests) * 30 : 0 // Max 30 point penalty
    score -= flakyPenalty

    // Ensure score is between 0 and 100
    return Math.max(0, Math.min(100, score))
  }
}

/**
 * Global test performance monitor instance
 */
let globalPerformanceMonitor: DefaultTestPerformanceMonitor | null = null

/**
 * Get or create the global test performance monitor
 */
export function getTestPerformanceMonitor(): TestPerformanceMonitor {
  if (!globalPerformanceMonitor) {
    globalPerformanceMonitor = new DefaultTestPerformanceMonitor()
  }
  return globalPerformanceMonitor
}

/**
 * Reset the global test performance monitor (for testing)
 */
export function resetTestPerformanceMonitor(): void {
  if (globalPerformanceMonitor) {
    globalPerformanceMonitor.clearPerformanceData()
  }
  globalPerformanceMonitor = null
}
