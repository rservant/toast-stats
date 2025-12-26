/**
 * API endpoints for reconciliation performance monitoring and optimization
 */

import express from 'express'
import { logger } from '../utils/logger.js'
import { ReconciliationPerformanceMonitor } from '../services/ReconciliationPerformanceMonitor.js'
import { ReconciliationCacheService } from '../services/ReconciliationCacheService.js'
import { ReconciliationStorageOptimizer } from '../services/ReconciliationStorageOptimizer.js'
import {
  ReconciliationBatchProcessor,
  BatchProcessingConfig,
} from '../services/ReconciliationBatchProcessor.js'

const router = express.Router()

// Global instances (in production, these would be dependency injected)
const performanceMonitor = new ReconciliationPerformanceMonitor()
const cacheService = new ReconciliationCacheService()
const storageOptimizer = new ReconciliationStorageOptimizer()

/**
 * GET /api/reconciliation/performance/stats
 * Get performance statistics for reconciliation operations
 */
router.get('/stats', async (req, res) => {
  try {
    const timeWindowMs = parseInt(req.query.timeWindow as string) || 300000 // 5 minutes default
    const operationName = req.query.operation as string

    if (operationName) {
      // Get stats for specific operation
      const stats = performanceMonitor.getOperationStats(
        operationName,
        timeWindowMs
      )
      if (!stats) {
        return res.status(404).json({
          error: 'No performance data found for the specified operation',
          operationName,
        })
      }

      res.json({ stats })
    } else {
      // Get stats for all operations
      const allStats = performanceMonitor.getAllOperationStats(timeWindowMs)
      res.json({
        stats: allStats,
        timeWindowMs,
        totalOperations: allStats.length,
      })
    }
  } catch (error) {
    logger.error('Failed to get performance stats', { error })
    res.status(500).json({ error: 'Failed to retrieve performance statistics' })
  }
})

/**
 * GET /api/reconciliation/performance/bottlenecks
 * Get performance bottlenecks and optimization recommendations
 */
router.get('/bottlenecks', async (req, res) => {
  try {
    const timeWindowMs = parseInt(req.query.timeWindow as string) || 300000 // 5 minutes default
    const bottlenecks = performanceMonitor.getBottlenecks(timeWindowMs)

    res.json({
      bottlenecks,
      timeWindowMs,
      totalBottlenecks: bottlenecks.length,
      highSeverityCount: bottlenecks.filter(b => b.severity === 'high').length,
      mediumSeverityCount: bottlenecks.filter(b => b.severity === 'medium')
        .length,
      lowSeverityCount: bottlenecks.filter(b => b.severity === 'low').length,
    })
  } catch (error) {
    logger.error('Failed to get performance bottlenecks', { error })
    res
      .status(500)
      .json({ error: 'Failed to retrieve performance bottlenecks' })
  }
})

/**
 * GET /api/reconciliation/performance/report
 * Get comprehensive performance report
 */
router.get('/report', async (req, res) => {
  try {
    const timeWindowMs = parseInt(req.query.timeWindow as string) || 300000 // 5 minutes default
    const report = performanceMonitor.generatePerformanceReport(timeWindowMs)

    res.json({
      report,
      generatedAt: new Date().toISOString(),
      timeWindowMs,
    })
  } catch (error) {
    logger.error('Failed to generate performance report', { error })
    res.status(500).json({ error: 'Failed to generate performance report' })
  }
})

/**
 * GET /api/reconciliation/performance/cache
 * Get cache performance statistics
 */
router.get('/cache', async (_req, res) => {
  try {
    const cacheStats = cacheService.getStats()
    const storageStats = storageOptimizer.getCacheStats()

    res.json({
      cache: cacheStats,
      storage: storageStats,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    logger.error('Failed to get cache stats', { error })
    res.status(500).json({ error: 'Failed to retrieve cache statistics' })
  }
})

/**
 * POST /api/reconciliation/performance/cache/clear
 * Clear all caches to free memory
 */
router.post('/cache/clear', async (req, res) => {
  try {
    const clearStorage = req.body.clearStorage === true
    const clearCache = req.body.clearCache !== false // Default to true

    let clearedItems = 0

    if (clearCache) {
      cacheService.clear()
      clearedItems++
    }

    if (clearStorage) {
      storageOptimizer.clearCache()
      clearedItems++
    }

    logger.info('Caches cleared via API', { clearCache, clearStorage })

    res.json({
      success: true,
      message: 'Caches cleared successfully',
      clearedItems,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    logger.error('Failed to clear caches', { error })
    res.status(500).json({ error: 'Failed to clear caches' })
  }
})

/**
 * GET /api/reconciliation/performance/resources
 * Get system resource usage metrics
 */
router.get('/resources', async (req, res) => {
  try {
    const timeWindowMs = parseInt(req.query.timeWindow as string) || 300000 // 5 minutes default
    const resourceMetrics = performanceMonitor.getResourceMetrics(timeWindowMs)
    const resourceSummary = performanceMonitor.getResourceSummary(timeWindowMs)

    res.json({
      metrics: resourceMetrics,
      summary: resourceSummary,
      timeWindowMs,
      dataPoints: resourceMetrics.length,
    })
  } catch (error) {
    logger.error('Failed to get resource metrics', { error })
    res.status(500).json({ error: 'Failed to retrieve resource metrics' })
  }
})

/**
 * POST /api/reconciliation/performance/batch/process
 * Start batch processing of reconciliation jobs
 */
router.post('/batch/process', async (req, res) => {
  try {
    const { jobs, config } = req.body

    if (!Array.isArray(jobs) || jobs.length === 0) {
      return res.status(400).json({
        error: 'Invalid request: jobs array is required and must not be empty',
      })
    }

    // Validate job structure
    for (const job of jobs) {
      if (!job.districtId || !job.targetMonth) {
        return res.status(400).json({
          error:
            'Invalid job structure: districtId and targetMonth are required',
        })
      }
    }

    // Validate and sanitize batch processing config to prevent resource exhaustion
    const safeConfig: Partial<BatchProcessingConfig> = {}
    if (config && typeof config === 'object') {
      const {
        maxConcurrentJobs,
        batchSize,
        retryAttempts,
        retryDelayMs,
        timeoutMs,
        enableResourceThrottling,
        memoryThresholdMB,
      } = config

      const clampNumber = (
        value: unknown,
        min: number,
        max: number,
        defaultValue: number
      ): number => {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          return defaultValue
        }
        if (value < min) return min
        if (value > max) return max
        return value
      }

      safeConfig.maxConcurrentJobs = clampNumber(maxConcurrentJobs, 1, 20, 5)
      safeConfig.batchSize = clampNumber(batchSize, 1, 100, 20)
      safeConfig.retryAttempts = clampNumber(retryAttempts, 0, 10, 3)
      safeConfig.retryDelayMs = clampNumber(retryDelayMs, 100, 600000, 5000)
      // Constrain timeout to a reasonable range (e.g. 1s to 30min)
      safeConfig.timeoutMs = clampNumber(timeoutMs, 1000, 1800000, 300000)
      safeConfig.enableResourceThrottling =
        typeof enableResourceThrottling === 'boolean'
          ? enableResourceThrottling
          : true
      // Cap memory threshold to a safe upper bound (e.g. 4GB)
      safeConfig.memoryThresholdMB = clampNumber(
        memoryThresholdMB,
        128,
        4096,
        1024
      )
    }

    const batchProcessor = new ReconciliationBatchProcessor(
      undefined, // Use default orchestrator
      cacheService,
      storageOptimizer,
      safeConfig
    )

    // Start batch processing asynchronously
    const processingPromise = batchProcessor.processBatch(jobs)

    // Return immediate response with batch ID
    const batchId = `batch-${Date.now()}`

    res.json({
      success: true,
      batchId,
      message: 'Batch processing started',
      jobCount: jobs.length,
      startedAt: new Date().toISOString(),
    })

    // Handle batch completion in background
    processingPromise
      .then(results => {
        logger.info('Batch processing completed', {
          batchId,
          totalJobs: results.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length,
        })
      })
      .catch(error => {
        logger.error('Batch processing failed', { batchId, error })
      })
      .finally(() => {
        batchProcessor.cleanup()
      })
  } catch (error) {
    logger.error('Failed to start batch processing', { error })
    res.status(500).json({ error: 'Failed to start batch processing' })
  }
})

/**
 * GET /api/reconciliation/performance/optimization/recommendations
 * Get optimization recommendations based on current performance
 */
router.get('/optimization/recommendations', async (req, res) => {
  try {
    const timeWindowMs = parseInt(req.query.timeWindow as string) || 300000 // 5 minutes default

    const bottlenecks = performanceMonitor.getBottlenecks(timeWindowMs)
    const cacheStats = cacheService.getStats()
    const resourceSummary = performanceMonitor.getResourceSummary(timeWindowMs)

    const recommendations: Array<{
      category: string
      priority: 'high' | 'medium' | 'low'
      recommendation: string
      impact: string
      implementation: string
    }> = []

    // Cache optimization recommendations
    if (cacheStats.hitRate < 0.8) {
      recommendations.push({
        category: 'Caching',
        priority: 'high',
        recommendation: 'Improve cache hit rate',
        impact: 'Reduce database load and improve response times',
        implementation:
          'Increase cache TTL, implement cache warming, or review cache key strategies',
      })
    }

    // Memory optimization recommendations
    if (resourceSummary.peakMemoryMB > 1024) {
      recommendations.push({
        category: 'Memory',
        priority: 'medium',
        recommendation: 'Optimize memory usage',
        impact: 'Prevent out-of-memory errors and improve stability',
        implementation:
          'Implement data streaming, reduce object retention, or increase heap size',
      })
    }

    // Performance bottleneck recommendations
    const highSeverityBottlenecks = bottlenecks.filter(
      b => b.severity === 'high'
    )
    if (highSeverityBottlenecks.length > 0) {
      recommendations.push({
        category: 'Performance',
        priority: 'high',
        recommendation: `Address ${highSeverityBottlenecks.length} high-severity bottlenecks`,
        impact: 'Significantly improve system responsiveness',
        implementation: 'Focus on optimizing the slowest operations first',
      })
    }

    // Batch processing recommendations
    const slowOperations = bottlenecks.filter(
      b => b.stats.averageDuration > 5000 && b.stats.callsPerSecond < 1
    )
    if (slowOperations.length > 0) {
      recommendations.push({
        category: 'Batch Processing',
        priority: 'medium',
        recommendation: 'Implement batch processing for slow operations',
        impact: 'Improve throughput and resource utilization',
        implementation:
          'Group similar operations and process them in parallel batches',
      })
    }

    res.json({
      recommendations: recommendations.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 }
        return priorityOrder[b.priority] - priorityOrder[a.priority]
      }),
      totalRecommendations: recommendations.length,
      highPriority: recommendations.filter(r => r.priority === 'high').length,
      mediumPriority: recommendations.filter(r => r.priority === 'medium')
        .length,
      lowPriority: recommendations.filter(r => r.priority === 'low').length,
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    logger.error('Failed to generate optimization recommendations', { error })
    res
      .status(500)
      .json({ error: 'Failed to generate optimization recommendations' })
  }
})

export default router
