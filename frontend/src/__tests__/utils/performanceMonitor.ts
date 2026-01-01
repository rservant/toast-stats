/**
 * Test Performance Monitoring Infrastructure
 *
 * Provides comprehensive performance monitoring for test suite optimization,
 * including render time tracking, memory usage monitoring, and performance regression detection.
 */

import {
  TestPerformanceMonitor,
  TestPerformanceMetrics,
  TestPerformanceThresholds,
  TestPerformanceReport,
} from './types'

class TestPerformanceMonitorImpl implements TestPerformanceMonitor {
  private activeMonitoring: Map<
    string,
    { startTime: number; startMemory: number }
  > = new Map()
  private metrics: Map<string, TestPerformanceMetrics> = new Map()
  private thresholds: TestPerformanceThresholds = {
    maxRenderTime: 100, // 100ms
    maxQueryTime: 50, // 50ms
    maxInteractionTime: 200, // 200ms
    maxMemoryUsage: 50 * 1024 * 1024, // 50MB
    maxComponentCount: 1000,
  }

  startMonitoring(testName: string): void {
    const startTime = performance.now()
    const startMemory = this.getMemoryUsage()

    this.activeMonitoring.set(testName, {
      startTime,
      startMemory,
    })
  }

  stopMonitoring(testName: string): TestPerformanceMetrics {
    const monitoring = this.activeMonitoring.get(testName)
    if (!monitoring) {
      // Return default metrics instead of throwing error for missing monitoring
      const defaultMetrics: TestPerformanceMetrics = {
        renderTime: 0,
        queryTime: 0,
        interactionTime: 0,
        memoryUsage: 0,
        componentCount: 0,
        timestamp: new Date(),
      }
      this.metrics.set(testName, defaultMetrics)
      return defaultMetrics
    }

    const endTime = performance.now()
    const endMemory = this.getMemoryUsage()

    const metrics: TestPerformanceMetrics = {
      renderTime: endTime - monitoring.startTime,
      queryTime: 0, // Will be updated by specific query measurements
      interactionTime: 0, // Will be updated by specific interaction measurements
      memoryUsage: endMemory - monitoring.startMemory,
      componentCount: this.getComponentCount(),
      timestamp: new Date(),
    }

    this.metrics.set(testName, metrics)
    this.activeMonitoring.delete(testName)

    return metrics
  }

  getReport(testName: string): TestPerformanceReport {
    const metrics = this.metrics.get(testName)
    if (!metrics) {
      throw new Error(`No metrics found for test: ${testName}`)
    }

    const violations: string[] = []
    let passed = true

    if (metrics.renderTime > this.thresholds.maxRenderTime) {
      violations.push(
        `Render time ${metrics.renderTime.toFixed(2)}ms exceeds threshold ${this.thresholds.maxRenderTime}ms`
      )
      passed = false
    }

    if (metrics.queryTime > this.thresholds.maxQueryTime) {
      violations.push(
        `Query time ${metrics.queryTime.toFixed(2)}ms exceeds threshold ${this.thresholds.maxQueryTime}ms`
      )
      passed = false
    }

    if (metrics.interactionTime > this.thresholds.maxInteractionTime) {
      violations.push(
        `Interaction time ${metrics.interactionTime.toFixed(2)}ms exceeds threshold ${this.thresholds.maxInteractionTime}ms`
      )
      passed = false
    }

    if (metrics.memoryUsage > this.thresholds.maxMemoryUsage) {
      violations.push(
        `Memory usage ${this.formatBytes(metrics.memoryUsage)} exceeds threshold ${this.formatBytes(this.thresholds.maxMemoryUsage)}`
      )
      passed = false
    }

    if (metrics.componentCount > this.thresholds.maxComponentCount) {
      violations.push(
        `Component count ${metrics.componentCount} exceeds threshold ${this.thresholds.maxComponentCount}`
      )
      passed = false
    }

    return {
      testName,
      metrics,
      thresholds: this.thresholds,
      passed,
      violations,
    }
  }

  setThresholds(thresholds: Partial<TestPerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds }
  }

  // Utility methods for measuring specific performance aspects
  measureQueryTime<T>(queryFn: () => T): { result: T; time: number } {
    const startTime = performance.now()
    const result = queryFn()
    const endTime = performance.now()

    return {
      result,
      time: endTime - startTime,
    }
  }

  measureInteractionTime<T>(interactionFn: () => T): {
    result: T
    time: number
  } {
    const startTime = performance.now()
    const result = interactionFn()
    const endTime = performance.now()

    return {
      result,
      time: endTime - startTime,
    }
  }

  updateQueryTime(testName: string, queryTime: number): void {
    const metrics = this.metrics.get(testName)
    if (metrics) {
      metrics.queryTime = Math.max(metrics.queryTime, queryTime)
    }
  }

  updateInteractionTime(testName: string, interactionTime: number): void {
    const metrics = this.metrics.get(testName)
    if (metrics) {
      metrics.interactionTime = Math.max(
        metrics.interactionTime,
        interactionTime
      )
    }
  }

  private getMemoryUsage(): number {
    // In browser environment, use performance.memory if available
    if (
      typeof window !== 'undefined' &&
      'performance' in window &&
      'memory' in (window.performance as { memory?: unknown })
    ) {
      return (
        (
          window.performance as unknown as {
            memory: { usedJSHeapSize: number }
          }
        ).memory.usedJSHeapSize || 0
      )
    }

    // In Node.js environment, use process.memoryUsage
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed
    }

    return 0
  }

  private getComponentCount(): number {
    // Count React components in the DOM
    if (typeof document !== 'undefined') {
      const reactElements = document.querySelectorAll(
        '[data-reactroot], [data-react-component]'
      )
      return reactElements.length
    }

    return 0
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes'

    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Get all metrics for reporting
  getAllMetrics(): Map<string, TestPerformanceMetrics> {
    return new Map(this.metrics)
  }

  // Clear all metrics (useful for test cleanup)
  clearMetrics(): void {
    this.metrics.clear()
    this.activeMonitoring.clear()
  }

  // Get performance summary
  getPerformanceSummary(): {
    totalTests: number
    averageRenderTime: number
    averageMemoryUsage: number
    slowestTest: string | null
    fastestTest: string | null
  } {
    const allMetrics = Array.from(this.metrics.entries())

    if (allMetrics.length === 0) {
      return {
        totalTests: 0,
        averageRenderTime: 0,
        averageMemoryUsage: 0,
        slowestTest: null,
        fastestTest: null,
      }
    }

    const totalRenderTime = allMetrics.reduce(
      (sum, [, metrics]) => sum + metrics.renderTime,
      0
    )
    const totalMemoryUsage = allMetrics.reduce(
      (sum, [, metrics]) => sum + metrics.memoryUsage,
      0
    )

    const sortedByRenderTime = allMetrics.sort(
      ([, a], [, b]) => b.renderTime - a.renderTime
    )

    return {
      totalTests: allMetrics.length,
      averageRenderTime: totalRenderTime / allMetrics.length,
      averageMemoryUsage: totalMemoryUsage / allMetrics.length,
      slowestTest: sortedByRenderTime[0]?.[0] || null,
      fastestTest:
        sortedByRenderTime[sortedByRenderTime.length - 1]?.[0] || null,
    }
  }
}

// Singleton instance for global use
export const testPerformanceMonitor = new TestPerformanceMonitorImpl()

// Helper functions for easy integration with existing tests
export function withPerformanceMonitoring<T>(
  testName: string,
  testFn: () => T
): T {
  testPerformanceMonitor.startMonitoring(testName)

  try {
    const result = testFn()
    return result
  } finally {
    testPerformanceMonitor.stopMonitoring(testName)
  }
}

export function withQueryPerformanceMonitoring<T>(
  testName: string,
  queryFn: () => T
): T {
  const { result, time } = testPerformanceMonitor.measureQueryTime(queryFn)
  testPerformanceMonitor.updateQueryTime(testName, time)
  return result
}

export function withInteractionPerformanceMonitoring<T>(
  testName: string,
  interactionFn: () => T
): T {
  const { result, time } =
    testPerformanceMonitor.measureInteractionTime(interactionFn)
  testPerformanceMonitor.updateInteractionTime(testName, time)
  return result
}

// Performance assertion helpers
export function expectPerformanceWithinThresholds(testName: string): void {
  const report = testPerformanceMonitor.getReport(testName)

  if (!report.passed) {
    throw new Error(
      `Performance test failed for ${testName}:\n${report.violations.join('\n')}`
    )
  }
}

export function expectRenderTimeUnder(testName: string, maxTime: number): void {
  const report = testPerformanceMonitor.getReport(testName)

  if (report.metrics.renderTime > maxTime) {
    throw new Error(
      `Render time ${report.metrics.renderTime.toFixed(2)}ms exceeds expected maximum ${maxTime}ms`
    )
  }
}

export function expectMemoryUsageUnder(
  testName: string,
  maxMemory: number
): void {
  const report = testPerformanceMonitor.getReport(testName)

  if (report.metrics.memoryUsage > maxMemory) {
    throw new Error(
      `Memory usage ${report.metrics.memoryUsage} bytes exceeds expected maximum ${maxMemory} bytes`
    )
  }
}
