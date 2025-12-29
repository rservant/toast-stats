/**
 * Test Reliability Monitoring Infrastructure
 *
 * This module provides comprehensive test reliability monitoring with:
 * - Test metrics collection and tracking
 * - Flaky test detection and reporting
 * - Performance monitoring and alerting
 * - Failure categorization system
 *
 * **Feature: test-infrastructure-stabilization**
 * **Validates: Requirements 7.1, 7.2, 7.3, 7.5**
 */

import { logger } from './logger.js'

/**
 * Test execution result
 */
export interface TestResult {
  /** Test name/identifier */
  testName: string
  /** Test suite name */
  suiteName: string
  /** Whether the test passed */
  passed: boolean
  /** Execution time in milliseconds */
  executionTime: number
  /** Error message if failed */
  error?: string
  /** Timestamp of execution */
  timestamp: Date
  /** Test type (unit, integration, property, e2e) */
  testType: 'unit' | 'integration' | 'property' | 'e2e'
  /** Number of retries if any */
  retries: number
}

/**
 * Test reliability metrics
 */
export interface TestReliabilityMetrics {
  /** Total number of test executions */
  totalExecutions: number
  /** Number of passed tests */
  passedTests: number
  /** Number of failed tests */
  failedTests: number
  /** Pass rate percentage */
  passRate: number
  /** Average execution time */
  averageExecutionTime: number
  /** Number of flaky tests detected */
  flakyTestCount: number
  /** Performance degradation alerts */
  performanceAlerts: number
  /** Failure categories */
  failureCategories: Record<string, number>
}

/**
 * Flaky test detection result
 */
export interface FlakyTestDetection {
  /** Test identifier */
  testName: string
  /** Suite name */
  suiteName: string
  /** Number of executions analyzed */
  executionsAnalyzed: number
  /** Number of failures */
  failures: number
  /** Failure rate */
  failureRate: number
  /** Is considered flaky */
  isFlaky: boolean
  /** Recent execution results */
  recentResults: boolean[]
}

/**
 * Performance alert
 */
export interface PerformanceAlert {
  /** Test identifier */
  testName: string
  /** Suite name */
  suiteName: string
  /** Current execution time */
  currentTime: number
  /** Baseline execution time */
  baselineTime: number
  /** Performance degradation percentage */
  degradationPercentage: number
  /** Alert severity */
  severity: 'low' | 'medium' | 'high'
  /** Timestamp of alert */
  timestamp: Date
}

/**
 * Failure category
 */
export type FailureCategory =
  | 'timeout'
  | 'assertion'
  | 'setup'
  | 'teardown'
  | 'dependency'
  | 'resource'
  | 'network'
  | 'unknown'

/**
 * Test reliability monitor
 */
export interface TestReliabilityMonitor {
  /** Record a test execution result */
  recordTestResult(result: TestResult): void

  /** Get current reliability metrics */
  getReliabilityMetrics(): TestReliabilityMetrics

  /** Detect flaky tests */
  detectFlakyTests(): FlakyTestDetection[]

  /** Check for performance degradation */
  checkPerformanceDegradation(): PerformanceAlert[]

  /** Categorize test failure */
  categorizeFailure(error: string): FailureCategory

  /** Clear all metrics (for testing) */
  clearMetrics(): void
}

/**
 * Default implementation of test reliability monitor
 */
export class DefaultTestReliabilityMonitor implements TestReliabilityMonitor {
  private testResults: TestResult[] = []
  private performanceBaselines: Map<string, number> = new Map()
  private readonly maxResultsToKeep = 1000
  private readonly flakyThreshold = 0.2 // 20% failure rate
  private readonly performanceDegradationThreshold = 1.5 // 50% slower

  /**
   * Record a test execution result
   */
  recordTestResult(result: TestResult): void {
    this.testResults.push(result)

    // Update performance baseline
    this.updatePerformanceBaseline(result)

    // Keep only recent results to prevent memory issues
    if (this.testResults.length > this.maxResultsToKeep) {
      this.testResults = this.testResults.slice(-this.maxResultsToKeep)
    }

    logger.debug('Test result recorded', {
      testName: result.testName,
      passed: result.passed,
      executionTime: result.executionTime,
      testType: result.testType,
    })
  }

  /**
   * Get current reliability metrics
   */
  getReliabilityMetrics(): TestReliabilityMetrics {
    const totalExecutions = this.testResults.length
    const passedTests = this.testResults.filter(r => r.passed).length
    const failedTests = totalExecutions - passedTests
    const passRate =
      totalExecutions > 0 ? (passedTests / totalExecutions) * 100 : 0

    const totalTime = this.testResults.reduce(
      (sum, r) => sum + r.executionTime,
      0
    )
    const averageExecutionTime =
      totalExecutions > 0 ? totalTime / totalExecutions : 0

    const flakyTests = this.detectFlakyTests()
    const performanceAlerts = this.checkPerformanceDegradation()

    const failureCategories = this.getFailureCategories()

    return {
      totalExecutions,
      passedTests,
      failedTests,
      passRate,
      averageExecutionTime,
      flakyTestCount: flakyTests.length,
      performanceAlerts: performanceAlerts.length,
      failureCategories,
    }
  }

  /**
   * Detect flaky tests based on recent execution history
   */
  detectFlakyTests(): FlakyTestDetection[] {
    const testGroups = this.groupTestsByName()
    const flakyTests: FlakyTestDetection[] = []

    for (const [testKey, results] of Array.from(testGroups.entries())) {
      if (results.length < 3) continue // Need at least 3 executions

      const failures = results.filter(r => !r.passed).length
      const failureRate = failures / results.length
      const isFlaky =
        failureRate > 0 && failureRate < 1 && failureRate >= this.flakyThreshold

      if (isFlaky) {
        const [testName, suiteName] = testKey.split('::')
        const recentResults = results.slice(-10).map(r => r.passed)

        flakyTests.push({
          testName,
          suiteName,
          executionsAnalyzed: results.length,
          failures,
          failureRate,
          isFlaky: true,
          recentResults,
        })

        logger.warn('Flaky test detected', {
          testName,
          suiteName,
          failureRate,
          executionsAnalyzed: results.length,
        })
      }
    }

    return flakyTests
  }

  /**
   * Check for performance degradation
   */
  checkPerformanceDegradation(): PerformanceAlert[] {
    const alerts: PerformanceAlert[] = []
    const testGroups = this.groupTestsByName()

    for (const [testKey, results] of Array.from(testGroups.entries())) {
      if (results.length < 5) continue // Need enough data for comparison

      const [testName, suiteName] = testKey.split('::')
      const baseline = this.performanceBaselines.get(testKey)

      if (!baseline) continue

      // Get recent average execution time
      const recentResults = results.slice(-5)
      const recentAverage =
        recentResults.reduce((sum, r) => sum + r.executionTime, 0) /
        recentResults.length

      if (recentAverage > baseline * this.performanceDegradationThreshold) {
        const degradationPercentage =
          ((recentAverage - baseline) / baseline) * 100
        const severity = this.getPerformanceAlertSeverity(degradationPercentage)

        alerts.push({
          testName,
          suiteName,
          currentTime: recentAverage,
          baselineTime: baseline,
          degradationPercentage,
          severity,
          timestamp: new Date(),
        })

        logger.warn('Performance degradation detected', {
          testName,
          suiteName,
          currentTime: recentAverage,
          baselineTime: baseline,
          degradationPercentage,
          severity,
        })
      }
    }

    return alerts
  }

  /**
   * Categorize test failure based on error message
   */
  categorizeFailure(error: string): FailureCategory {
    const errorLower = error.toLowerCase()

    if (errorLower.includes('timeout') || errorLower.includes('timed out')) {
      return 'timeout'
    }

    if (
      errorLower.includes('assertion') ||
      errorLower.includes('expect') ||
      errorLower.includes('should')
    ) {
      return 'assertion'
    }

    if (
      errorLower.includes('setup') ||
      errorLower.includes('beforeeach') ||
      errorLower.includes('beforeall')
    ) {
      return 'setup'
    }

    if (
      errorLower.includes('teardown') ||
      errorLower.includes('aftereach') ||
      errorLower.includes('afterall')
    ) {
      return 'teardown'
    }

    if (
      errorLower.includes('dependency') ||
      errorLower.includes('import') ||
      errorLower.includes('require')
    ) {
      return 'dependency'
    }

    if (
      errorLower.includes('resource') ||
      errorLower.includes('file') ||
      errorLower.includes('directory')
    ) {
      return 'resource'
    }

    if (
      errorLower.includes('network') ||
      errorLower.includes('connection') ||
      errorLower.includes('fetch')
    ) {
      return 'network'
    }

    return 'unknown'
  }

  /**
   * Clear all metrics (for testing)
   */
  clearMetrics(): void {
    this.testResults = []
    this.performanceBaselines.clear()
  }

  /**
   * Group test results by test name and suite
   */
  private groupTestsByName(): Map<string, TestResult[]> {
    const groups = new Map<string, TestResult[]>()

    for (const result of this.testResults) {
      const key = `${result.testName}::${result.suiteName}`
      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)!.push(result)
    }

    return groups
  }

  /**
   * Update performance baseline for a test
   */
  private updatePerformanceBaseline(result: TestResult): void {
    const key = `${result.testName}::${result.suiteName}`
    const currentBaseline = this.performanceBaselines.get(key)

    if (!currentBaseline) {
      // First execution, set as baseline
      this.performanceBaselines.set(key, result.executionTime)
    } else {
      // Update baseline with exponential moving average
      const alpha = 0.1 // Smoothing factor
      const newBaseline =
        alpha * result.executionTime + (1 - alpha) * currentBaseline
      this.performanceBaselines.set(key, newBaseline)
    }
  }

  /**
   * Get failure categories summary
   */
  private getFailureCategories(): Record<string, number> {
    const categories: Record<string, number> = {}

    for (const result of this.testResults) {
      if (!result.passed && result.error) {
        const category = this.categorizeFailure(result.error)
        categories[category] = (categories[category] || 0) + 1
      }
    }

    return categories
  }

  /**
   * Determine performance alert severity
   */
  private getPerformanceAlertSeverity(
    degradationPercentage: number
  ): 'low' | 'medium' | 'high' {
    if (degradationPercentage >= 200) return 'high'
    if (degradationPercentage >= 100) return 'medium'
    return 'low'
  }
}

/**
 * Global test reliability monitor instance
 */
let globalReliabilityMonitor: DefaultTestReliabilityMonitor | null = null

/**
 * Get or create the global test reliability monitor
 */
export function getTestReliabilityMonitor(): TestReliabilityMonitor {
  if (!globalReliabilityMonitor) {
    globalReliabilityMonitor = new DefaultTestReliabilityMonitor()
  }
  return globalReliabilityMonitor
}

/**
 * Reset the global test reliability monitor (for testing)
 */
export function resetTestReliabilityMonitor(): void {
  if (globalReliabilityMonitor) {
    globalReliabilityMonitor.clearMetrics()
  }
  globalReliabilityMonitor = null
}
