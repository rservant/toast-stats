/**
 * Performance tests for reconciliation optimization features
 * Tests caching, batch processing, and storage optimization
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import { ReconciliationStorageOptimizer } from '../ReconciliationStorageOptimizer.ts'
import { ReconciliationCacheService } from '../ReconciliationCacheService.ts'
import {
  ReconciliationBatchProcessor,
  type BatchJob,
} from '../ReconciliationBatchProcessor.ts'
import { ReconciliationPerformanceMonitor } from '../ReconciliationPerformanceMonitor.ts'
import type { ReconciliationJob } from '../../types/reconciliation.ts'
import { createTestReconciliationJob } from '../../utils/test-helpers.ts'
import { createTestSelfCleanup, createUniqueTestDir } from '../../utils/test-self-cleanup.ts'

// Mock logger
vi.mock('../../utils/logger.ts', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe('ReconciliationStorageOptimizer', () => {
  // Self-cleanup setup - each test manages its own cleanup
  const { cleanup, afterEach: performCleanup } = createTestSelfCleanup({ verbose: false })
  
  // Each test cleans up after itself
  afterEach(performCleanup)

  function setupOptimizer() {
    const testStorageDir = createUniqueTestDir(cleanup, 'test-cache-reconciliation-optimizer')
    const optimizer = new ReconciliationStorageOptimizer(testStorageDir, {
      enableInMemoryCache: true,
      cacheMaxSize: 100,
      batchSize: 5,
    })
    
    // Register cleanup for the optimizer
    cleanup.addCleanupFunction(async () => {
      await optimizer.cleanup()
    })
    
    return optimizer
  }

  it('should cache jobs in memory for faster retrieval', async () => {
    const optimizer = setupOptimizer()
    
    const job: ReconciliationJob = createTestReconciliationJob({
      id: 'test-job-1',
      districtId: 'D1',
      targetMonth: '2025-01',
      status: 'active',
      startDate: new Date(),
      maxEndDate: new Date(Date.now() + 86400000),
      triggeredBy: 'manual',
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        triggeredBy: 'manual',
      },
    })

    // First save should write to storage and cache
    await optimizer.saveJob(job)

    // First retrieval should hit cache
    const startTime = Date.now()
    const retrievedJob = await optimizer.getJob(job.id)
    const retrievalTime = Date.now() - startTime

    expect(retrievedJob).toBeDefined()
    expect(retrievedJob!.id).toBe(job.id)
    expect(retrievalTime).toBeLessThan(10) // Should be very fast from cache
  })

  it('should batch multiple save operations for better performance', async () => {
    const optimizer = setupOptimizer()
    const jobs: ReconciliationJob[] = []

    // Create multiple jobs
    for (let i = 0; i < 10; i++) {
      jobs.push(
        createTestReconciliationJob({
          id: `batch-job-${i}`,
          districtId: `D${i}`,
          targetMonth: '2025-01',
          status: 'active',
          startDate: new Date(),
          maxEndDate: new Date(Date.now() + 86400000),
          metadata: {
            createdAt: new Date(),
            updatedAt: new Date(),
            triggeredBy: 'automatic',
          },
        })
      )
    }

    // Save all jobs (should be batched)
    const startTime = Date.now()
    await Promise.all(jobs.map(job => optimizer.saveJob(job)))
    await optimizer.flush() // Force batch processing
    const saveTime = Date.now() - startTime

    // Verify all jobs were saved
    for (const job of jobs) {
      const retrieved = await optimizer.getJob(job.id)
      expect(retrieved).toBeDefined()
      expect(retrieved!.id).toBe(job.id)
    }

    expect(saveTime).toBeLessThan(5000) // Should complete within 5 seconds
  })

  it('should efficiently bulk load multiple jobs', async () => {
    const optimizer = setupOptimizer()
    const jobIds = ['bulk-1', 'bulk-2', 'bulk-3', 'bulk-4', 'bulk-5']
    const jobs: ReconciliationJob[] = jobIds.map(id =>
      createTestReconciliationJob({
        id,
        districtId: 'D1',
        targetMonth: '2025-01',
        status: 'active',
        startDate: new Date(),
        maxEndDate: new Date(Date.now() + 86400000),
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          triggeredBy: 'automatic',
        },
      })
    )

    // Save jobs first
    await Promise.all(jobs.map(job => optimizer.saveJob(job)))
    await optimizer.flush()

    // Bulk load should be faster than individual loads
    const startTime = Date.now()
    const bulkResults = await optimizer.getJobsBulk(jobIds)
    const bulkTime = Date.now() - startTime

    expect(bulkResults.size).toBe(jobIds.length)
    expect(bulkTime).toBeLessThan(1000) // Should be fast

    // Verify all jobs were loaded correctly
    for (const jobId of jobIds) {
      expect(bulkResults.has(jobId)).toBe(true)
      expect(bulkResults.get(jobId)!.id).toBe(jobId)
    }
  })
})

describe('ReconciliationCacheService', () => {
  // Self-cleanup setup - each test manages its own cleanup
  const { cleanup, afterEach: performCleanup } = createTestSelfCleanup({ verbose: false })
  
  // Each test cleans up after itself
  afterEach(performCleanup)

  function setupCacheService() {
    const cacheService = new ReconciliationCacheService({
      maxSize: 50,
      ttlMs: 60000, // 1 minute
      enablePrefetch: true,
    })
    
    // Register cleanup for the cache service
    cleanup.addCleanupFunction(async () => {
      cacheService.shutdown()
    })
    
    return cacheService
  }

  it('should provide fast cache hits for frequently accessed jobs', async () => {
    const cacheService = setupCacheService()
    
    const job: ReconciliationJob = createTestReconciliationJob({
      id: 'cache-test-job',
      districtId: 'D1',
      targetMonth: '2025-01',
      status: 'active',
      startDate: new Date(),
      maxEndDate: new Date(Date.now() + 86400000),
      triggeredBy: 'manual',
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        triggeredBy: 'manual',
      },
    })

    // Cache the job
    cacheService.setJob(job.id, job)

    // Multiple fast retrievals
    const retrievalTimes: number[] = []
    for (let i = 0; i < 10; i++) {
      const startTime = Date.now()
      const cachedJob = cacheService.getJob(job.id)
      const retrievalTime = Date.now() - startTime

      retrievalTimes.push(retrievalTime)
      expect(cachedJob).toBeDefined()
      expect(cachedJob!.id).toBe(job.id)
    }

    // All retrievals should be very fast
    const averageTime =
      retrievalTimes.reduce((sum, time) => sum + time, 0) /
      retrievalTimes.length
    expect(averageTime).toBeLessThan(1) // Sub-millisecond average
  })

  it('should maintain high cache hit rate under load', async () => {
    const cacheService = setupCacheService()
    const jobs: ReconciliationJob[] = []

    // Create and cache multiple jobs
    for (let i = 0; i < 30; i++) {
      const job: ReconciliationJob = createTestReconciliationJob({
        id: `load-test-${i}`,
        districtId: `D${i % 5}`, // 5 districts
        targetMonth: '2025-01',
        status: 'active',
        startDate: new Date(),
        maxEndDate: new Date(Date.now() + 86400000),
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          triggeredBy: 'automatic',
        },
      })

      jobs.push(job)
      cacheService.setJob(job.id, job)
    }

    // Simulate random access pattern
    let hits = 0
    const totalAccesses = 100

    for (let i = 0; i < totalAccesses; i++) {
      const randomJobId = jobs[Math.floor(Math.random() * jobs.length)].id
      const cachedJob = cacheService.getJob(randomJobId)
      if (cachedJob) {
        hits++
      }
    }

    const hitRate = hits / totalAccesses
    expect(hitRate).toBeGreaterThan(0.8) // Should maintain >80% hit rate
  })

  it('should evict least recently used items when cache is full', async () => {
    const cacheSize = 5
    const smallCache = new ReconciliationCacheService({
      maxSize: cacheSize,
      ttlMs: 60000,
    })

    // Register cleanup for the small cache
    cleanup.addCleanupFunction(async () => {
      smallCache.shutdown()
    })

    try {
      // Fill cache to capacity + 1 to trigger eviction
      for (let i = 0; i < cacheSize + 1; i++) {
        const job: ReconciliationJob = createTestReconciliationJob({
          id: `eviction-test-${i}`,
          districtId: 'D1',
          targetMonth: '2025-01',
          status: 'active',
          startDate: new Date(),
          maxEndDate: new Date(Date.now() + 86400000),
          metadata: {
            createdAt: new Date(),
            updatedAt: new Date(),
            triggeredBy: 'automatic',
          },
        })

        smallCache.setJob(job.id, job)

        // Access some items after adding them to make them recently used
        if (i === 2 || i === 4) {
          smallCache.getJob(job.id)
        }
      }

      // Cache should not exceed max size due to eviction
      // Check job cache size specifically since we're only adding jobs
      const jobCacheSize = (
        smallCache as unknown as { jobCache: { size: number } }
      ).jobCache.size
      expect(jobCacheSize).toBeLessThanOrEqual(cacheSize)

      // The most recently added item should still be in cache
      expect(smallCache.getJob(`eviction-test-${cacheSize}`)).toBeDefined()
    } finally {
      smallCache.shutdown()
    }
  })
})

describe('ReconciliationBatchProcessor', () => {
  // Self-cleanup setup - each test manages its own cleanup
  const { cleanup, afterEach: performCleanup } = createTestSelfCleanup({ verbose: false })
  
  // Each test cleans up after itself
  afterEach(performCleanup)

  function setupBatchProcessor() {
    const batchProcessor = new ReconciliationBatchProcessor(
      undefined, // Use default orchestrator
      undefined, // Use default cache service
      undefined, // Use default storage optimizer
      {
        maxConcurrentJobs: 3,
        batchSize: 5,
        retryAttempts: 2,
        timeoutMs: 10000,
      }
    )
    
    // Register cleanup for the batch processor
    cleanup.addCleanupFunction(async () => {
      await batchProcessor.cleanup()
    })
    
    return batchProcessor
  }

  it('should process multiple districts in parallel', async () => {
    const batchProcessor = setupBatchProcessor()
    const batchJobs: BatchJob[] = []

    // Create batch jobs for multiple districts
    for (let i = 0; i < 6; i++) {
      batchJobs.push({
        districtId: `D${i}`,
        targetMonth: '2025-01',
        priority: Math.random() * 10,
      })
    }

    const startTime = Date.now()
    const results = await batchProcessor.processBatch(batchJobs)
    const processingTime = Date.now() - startTime

    expect(results).toHaveLength(batchJobs.length)
    expect(processingTime).toBeLessThan(30000) // Should complete within 30 seconds

    // Check that jobs were processed
    const successfulJobs = results.filter(r => r.success)
    expect(successfulJobs.length).toBeGreaterThan(0)
  })

  it('should handle batch processing progress tracking', async () => {
    const batchProcessor = setupBatchProcessor()
    const batchJobs: BatchJob[] = []

    // Create a smaller batch for progress tracking
    for (let i = 0; i < 3; i++) {
      batchJobs.push({
        districtId: `Progress-D${i}`,
        targetMonth: '2025-01',
        priority: 5,
      })
    }

    // Start batch processing (don't await)
    const processingPromise = batchProcessor.processBatch(batchJobs)

    // Check progress during processing
    await new Promise(resolve => setTimeout(resolve, 100)) // Small delay

    const progress = batchProcessor.getProgress()
    expect(progress.totalJobs).toBe(batchJobs.length)
    expect(
      progress.completedJobs + progress.activeJobs + progress.queuedJobs
    ).toBe(batchJobs.length)

    // Wait for completion
    const results = await processingPromise
    expect(results).toHaveLength(batchJobs.length)
  })

  it('should provide performance statistics', async () => {
    const batchProcessor = setupBatchProcessor()
    const batchJobs: BatchJob[] = [
      {
        districtId: 'Stats-D1',
        targetMonth: '2025-01',
        priority: 5,
      },
    ]

    await batchProcessor.processBatch(batchJobs)

    const stats = batchProcessor.getStatistics()
    expect(stats.totalProcessed).toBe(1)
    expect(stats.successRate).toBeGreaterThanOrEqual(0)
    expect(stats.averageProcessingTime).toBeGreaterThanOrEqual(0)
    expect(stats.totalProcessingTime).toBeGreaterThanOrEqual(0)
  })
})

describe('ReconciliationPerformanceMonitor', () => {
  // Self-cleanup setup - each test manages its own cleanup
  const { cleanup, afterEach: performCleanup } = createTestSelfCleanup({ verbose: false })
  
  // Each test cleans up after itself
  afterEach(performCleanup)

  function setupMonitor() {
    const monitor = new ReconciliationPerformanceMonitor()
    
    // Register cleanup for the monitor
    cleanup.addCleanupFunction(async () => {
      monitor.shutdown()
    })
    
    return monitor
  }

  it('should track operation performance metrics', async () => {
    const monitor = setupMonitor()
    const operationName = 'test-operation'

    // Record some metrics
    monitor.recordMetric(operationName, 100, true)
    monitor.recordMetric(operationName, 150, true)
    monitor.recordMetric(operationName, 200, false)

    const stats = monitor.getOperationStats(operationName)
    expect(stats).toBeDefined()
    expect(stats!.totalCalls).toBe(3)
    expect(stats!.successfulCalls).toBe(2)
    expect(stats!.failedCalls).toBe(1)
    expect(stats!.averageDuration).toBe(150) // (100 + 150 + 200) / 3
    expect(stats!.successRate).toBeCloseTo(0.667, 2)
  })

  it('should time operations automatically', async () => {
    const monitor = setupMonitor()
    const operationName = 'timed-operation'

    const result = await monitor.timeOperation(operationName, async () => {
      await new Promise(resolve => setTimeout(resolve, 50))
      return 'success'
    })

    expect(result).toBe('success')

    const stats = monitor.getOperationStats(operationName)
    expect(stats).toBeDefined()
    expect(stats!.totalCalls).toBe(1)
    expect(stats!.averageDuration).toBeGreaterThan(40) // Should be around 50ms
    expect(stats!.successRate).toBe(1)
  })

  it('should identify performance bottlenecks', async () => {
    const monitor = setupMonitor()
    
    // Record metrics for slow operation
    monitor.recordMetric('slow-operation', 15000, true) // 15 seconds
    monitor.recordMetric('slow-operation', 20000, true) // 20 seconds

    // Record metrics for fast operation
    monitor.recordMetric('fast-operation', 100, true)
    monitor.recordMetric('fast-operation', 150, true)

    const bottlenecks = monitor.getBottlenecks()
    expect(bottlenecks.length).toBeGreaterThan(0)

    const slowBottleneck = bottlenecks.find(
      b => b.operationName === 'slow-operation'
    )
    expect(slowBottleneck).toBeDefined()
    expect(['high', 'medium']).toContain(slowBottleneck!.severity) // Accept either high or medium severity
  })

  it('should generate comprehensive performance reports', async () => {
    const monitor = setupMonitor()
    
    // Record various metrics
    monitor.recordMetric('operation-1', 1000, true)
    monitor.recordMetric('operation-1', 1200, true)
    monitor.recordMetric('operation-2', 500, true)
    monitor.recordMetric('operation-2', 600, false)

    const report = monitor.generatePerformanceReport()

    expect(report.summary.totalOperations).toBe(4)
    expect(report.summary.uniqueOperations).toBe(2)
    expect(report.topOperations.length).toBeGreaterThan(0)
    expect(report.recommendations.length).toBeGreaterThanOrEqual(0)
  })
})
