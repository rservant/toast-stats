/**
 * Performance monitoring service for reconciliation operations
 * Tracks metrics, identifies bottlenecks, and provides optimization insights
 */

import { logger } from '../utils/logger.js'

export interface PerformanceMetrics {
  operationName: string
  duration: number
  timestamp: number
  success: boolean
  metadata?: Record<string, unknown>
}

export interface PerformanceStats {
  operationName: string
  totalCalls: number
  successfulCalls: number
  failedCalls: number
  averageDuration: number
  minDuration: number
  maxDuration: number
  p95Duration: number
  p99Duration: number
  successRate: number
  callsPerSecond: number
}

export interface SystemResourceMetrics {
  timestamp: number
  memoryUsageMB: number
  cpuUsagePercent: number
  activeConnections: number
  cacheHitRate: number
  diskIOPS: number
}

export class ReconciliationPerformanceMonitor {
  private metrics: PerformanceMetrics[] = []
  private resourceMetrics: SystemResourceMetrics[] = []
  private maxMetricsHistory = 10000
  private maxResourceHistory = 1000
  private monitoringInterval: ReturnType<typeof setTimeout> | null = null

  constructor() {
    this.startResourceMonitoring()
  }

  /**
   * Record a performance metric for an operation
   */
  recordMetric(
    operationName: string,
    duration: number,
    success: boolean = true,
    metadata?: Record<string, unknown>
  ): void {
    const metric: PerformanceMetrics = {
      operationName,
      duration,
      timestamp: Date.now(),
      success,
      metadata,
    }

    this.metrics.push(metric)

    // Maintain history limit
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory)
    }

    // Log slow operations
    if (duration > 5000) {
      // 5 seconds
      logger.warn('Slow operation detected', {
        operationName,
        duration,
        success,
        metadata,
      })
    }
  }

  /**
   * Time an operation and record its performance
   */
  async timeOperation<T>(
    operationName: string,
    operation: () => Promise<T>,
    metadata?: Record<string, unknown>
  ): Promise<T> {
    const startTime = Date.now()
    let success = true
    let result: T

    try {
      result = await operation()
      return result
    } catch (error) {
      success = false
      throw error
    } finally {
      const duration = Date.now() - startTime
      this.recordMetric(operationName, duration, success, metadata)
    }
  }

  /**
   * Get performance statistics for an operation
   */
  getOperationStats(
    operationName: string,
    timeWindowMs?: number
  ): PerformanceStats | null {
    const cutoffTime = timeWindowMs ? Date.now() - timeWindowMs : 0
    const operationMetrics = this.metrics.filter(
      m => m.operationName === operationName && m.timestamp >= cutoffTime
    )

    if (operationMetrics.length === 0) {
      return null
    }

    const durations = operationMetrics
      .map(m => m.duration)
      .sort((a, b) => a - b)
    const successfulCalls = operationMetrics.filter(m => m.success).length
    const totalCalls = operationMetrics.length
    const timeSpanMs = Math.max(
      1,
      operationMetrics[operationMetrics.length - 1].timestamp -
        operationMetrics[0].timestamp
    )

    return {
      operationName,
      totalCalls,
      successfulCalls,
      failedCalls: totalCalls - successfulCalls,
      averageDuration:
        durations.reduce((sum, d) => sum + d, 0) / durations.length,
      minDuration: durations[0],
      maxDuration: durations[durations.length - 1],
      p95Duration:
        durations[Math.floor(durations.length * 0.95)] ||
        durations[durations.length - 1],
      p99Duration:
        durations[Math.floor(durations.length * 0.99)] ||
        durations[durations.length - 1],
      successRate: successfulCalls / totalCalls,
      callsPerSecond: (totalCalls / timeSpanMs) * 1000,
    }
  }

  /**
   * Get all operation statistics
   */
  getAllOperationStats(timeWindowMs?: number): PerformanceStats[] {
    const operationNames = [...new Set(this.metrics.map(m => m.operationName))]
    return operationNames
      .map(name => this.getOperationStats(name, timeWindowMs))
      .filter(stats => stats !== null) as PerformanceStats[]
  }

  /**
   * Get performance bottlenecks
   */
  getBottlenecks(timeWindowMs: number = 300000): Array<{
    operationName: string
    issue: string
    severity: 'low' | 'medium' | 'high'
    recommendation: string
    stats: PerformanceStats
  }> {
    const bottlenecks: Array<{
      operationName: string
      issue: string
      severity: 'low' | 'medium' | 'high'
      recommendation: string
      stats: PerformanceStats
    }> = []

    const allStats = this.getAllOperationStats(timeWindowMs)

    for (const stats of allStats) {
      // Check for slow operations
      if (stats.averageDuration > 10000) {
        // 10 seconds
        bottlenecks.push({
          operationName: stats.operationName,
          issue: `High average duration: ${stats.averageDuration.toFixed(0)}ms`,
          severity: stats.averageDuration > 30000 ? 'high' : 'medium',
          recommendation:
            'Consider optimizing database queries or adding caching',
          stats,
        })
      }

      // Check for high failure rates
      if (stats.successRate < 0.95 && stats.totalCalls > 10) {
        bottlenecks.push({
          operationName: stats.operationName,
          issue: `Low success rate: ${(stats.successRate * 100).toFixed(1)}%`,
          severity: stats.successRate < 0.8 ? 'high' : 'medium',
          recommendation: 'Investigate error causes and improve error handling',
          stats,
        })
      }

      // Check for high P99 latency
      if (stats.p99Duration > stats.averageDuration * 3) {
        bottlenecks.push({
          operationName: stats.operationName,
          issue: `High P99 latency: ${stats.p99Duration.toFixed(0)}ms vs avg ${stats.averageDuration.toFixed(0)}ms`,
          severity: 'medium',
          recommendation:
            'Investigate outlier cases and add timeout protection',
          stats,
        })
      }

      // Check for low throughput
      if (stats.callsPerSecond < 0.1 && stats.totalCalls > 5) {
        bottlenecks.push({
          operationName: stats.operationName,
          issue: `Low throughput: ${stats.callsPerSecond.toFixed(2)} calls/sec`,
          severity: 'low',
          recommendation: 'Consider batch processing or parallel execution',
          stats,
        })
      }
    }

    return bottlenecks.sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, low: 1 }
      return severityOrder[b.severity] - severityOrder[a.severity]
    })
  }

  /**
   * Start monitoring system resources
   */
  private startResourceMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.recordResourceMetrics()
    }, 30000) // Every 30 seconds
  }

  /**
   * Record current system resource metrics
   */
  private recordResourceMetrics(): void {
    try {
      const memoryUsage = process.memoryUsage()
      const cpuUsage = process.cpuUsage()

      const resourceMetric: SystemResourceMetrics = {
        timestamp: Date.now(),
        memoryUsageMB: memoryUsage.heapUsed / 1024 / 1024,
        cpuUsagePercent: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to percentage
        activeConnections: 0, // Would need to be implemented based on actual connection tracking
        cacheHitRate: 0, // Would need to be provided by cache service
        diskIOPS: 0, // Would need OS-level monitoring
      }

      this.resourceMetrics.push(resourceMetric)

      // Maintain history limit
      if (this.resourceMetrics.length > this.maxResourceHistory) {
        this.resourceMetrics = this.resourceMetrics.slice(
          -this.maxResourceHistory
        )
      }

      // Log resource warnings
      if (resourceMetric.memoryUsageMB > 1024) {
        // 1GB
        logger.warn('High memory usage detected', {
          memoryUsageMB: resourceMetric.memoryUsageMB,
        })
      }
    } catch (error) {
      logger.error('Failed to record resource metrics', { error })
    }
  }

  /**
   * Get recent resource metrics
   */
  getResourceMetrics(timeWindowMs: number = 300000): SystemResourceMetrics[] {
    const cutoffTime = Date.now() - timeWindowMs
    return this.resourceMetrics.filter(m => m.timestamp >= cutoffTime)
  }

  /**
   * Get resource usage summary
   */
  getResourceSummary(timeWindowMs: number = 300000): {
    averageMemoryMB: number
    peakMemoryMB: number
    averageCpuPercent: number
    peakCpuPercent: number
    dataPoints: number
  } {
    const metrics = this.getResourceMetrics(timeWindowMs)

    if (metrics.length === 0) {
      return {
        averageMemoryMB: 0,
        peakMemoryMB: 0,
        averageCpuPercent: 0,
        peakCpuPercent: 0,
        dataPoints: 0,
      }
    }

    const memoryValues = metrics.map(m => m.memoryUsageMB)
    const cpuValues = metrics.map(m => m.cpuUsagePercent)

    return {
      averageMemoryMB:
        memoryValues.reduce((sum, val) => sum + val, 0) / memoryValues.length,
      peakMemoryMB: Math.max(...memoryValues),
      averageCpuPercent:
        cpuValues.reduce((sum, val) => sum + val, 0) / cpuValues.length,
      peakCpuPercent: Math.max(...cpuValues),
      dataPoints: metrics.length,
    }
  }

  /**
   * Generate performance report
   */
  generatePerformanceReport(timeWindowMs: number = 300000): {
    summary: {
      totalOperations: number
      uniqueOperations: number
      overallSuccessRate: number
      averageResponseTime: number
    }
    topOperations: PerformanceStats[]
    bottlenecks: Array<{
      operationName: string
      issue: string
      severity: 'low' | 'medium' | 'high'
      recommendation: string
      stats: PerformanceStats
    }>
    resourceSummary: {
      averageMemoryMB: number
      peakMemoryMB: number
      averageCpuPercent: number
      peakCpuPercent: number
      dataPoints: number
    }
    recommendations: string[]
  } {
    const cutoffTime = Date.now() - timeWindowMs
    const recentMetrics = this.metrics.filter(m => m.timestamp >= cutoffTime)
    const allStats = this.getAllOperationStats(timeWindowMs)
    const bottlenecks = this.getBottlenecks(timeWindowMs)
    const resourceSummary = this.getResourceSummary(timeWindowMs)

    // Calculate summary statistics
    const totalOperations = recentMetrics.length
    const uniqueOperations = new Set(recentMetrics.map(m => m.operationName))
      .size
    const successfulOperations = recentMetrics.filter(m => m.success).length
    const overallSuccessRate =
      totalOperations > 0 ? successfulOperations / totalOperations : 0
    const averageResponseTime =
      totalOperations > 0
        ? recentMetrics.reduce((sum, m) => sum + m.duration, 0) /
          totalOperations
        : 0

    // Get top operations by call count
    const topOperations = allStats
      .sort((a, b) => b.totalCalls - a.totalCalls)
      .slice(0, 10)

    // Generate recommendations
    const recommendations: string[] = []

    if (overallSuccessRate < 0.95) {
      recommendations.push(
        'Overall success rate is below 95%. Review error handling and retry mechanisms.'
      )
    }

    if (averageResponseTime > 5000) {
      recommendations.push(
        'Average response time is high. Consider implementing caching and query optimization.'
      )
    }

    if (resourceSummary.peakMemoryMB > 1024) {
      recommendations.push(
        'Peak memory usage is high. Consider implementing memory-efficient data structures and garbage collection tuning.'
      )
    }

    if (bottlenecks.filter(b => b.severity === 'high').length > 0) {
      recommendations.push(
        'High-severity performance bottlenecks detected. Prioritize optimization of slow operations.'
      )
    }

    return {
      summary: {
        totalOperations,
        uniqueOperations,
        overallSuccessRate,
        averageResponseTime,
      },
      topOperations,
      bottlenecks,
      resourceSummary,
      recommendations,
    }
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics = []
    this.resourceMetrics = []
    logger.info('Performance metrics cleared')
  }

  /**
   * Shutdown monitoring
   */
  shutdown(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }

    logger.info('Performance monitoring shutdown')
  }
}
