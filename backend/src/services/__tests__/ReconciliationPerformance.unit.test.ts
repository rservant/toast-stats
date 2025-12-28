/**
 * Unit tests for reconciliation performance optimization components
 * Tests individual performance features in isolation
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import { ReconciliationCacheService } from '../ReconciliationCacheService.ts'
import { ReconciliationPerformanceMonitor } from '../ReconciliationPerformanceMonitor.ts'
import type {
  ReconciliationJob,
  ReconciliationTimeline,
  ReconciliationStatus,
} from '../../types/reconciliation.ts'
import { createTestReconciliationJob } from '../../utils/test-helpers.ts'
import { createTestSelfCleanup } from '../../utils/test-self-cleanup.ts'

// Mock logger
vi.mock('../../utils/logger.ts', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe('ReconciliationCacheService Unit Tests', () => {
  // Self-cleanup setup - each test manages its own cleanup
  const { cleanup, afterEach: performCleanup } = createTestSelfCleanup({
    verbose: false,
  })

  // Each test cleans up after itself
  afterEach(performCleanup)

  function setupCacheService() {
    const cacheService = new ReconciliationCacheService({
      maxSize: 10,
      ttlMs: 60000, // 1 minute
      enablePrefetch: false, // Disable for unit tests
    })

    // Register cleanup for the cache service
    cleanup.addCleanupFunction(async () => {
      cacheService.shutdown()
    })

    return cacheService
  }

  it('should cache and retrieve jobs correctly', () => {
    const cacheService = setupCacheService()

    const job: ReconciliationJob = createTestReconciliationJob({
      id: 'test-job-1',
      districtId: 'D1',
      targetMonth: '2025-01',
      status: 'active',
      startDate: new Date('2025-01-01'),
      maxEndDate: new Date('2025-01-16'),
      triggeredBy: 'manual',
      metadata: {
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        triggeredBy: 'manual',
      },
    })

    // Cache miss initially
    expect(cacheService.getJob(job.id)).toBeNull()

    // Cache the job
    cacheService.setJob(job.id, job)

    // Cache hit
    const cachedJob = cacheService.getJob(job.id)
    expect(cachedJob).toBeDefined()
    expect(cachedJob!.id).toBe(job.id)
    expect(cachedJob!.districtId).toBe(job.districtId)
    expect(cachedJob!.status).toBe(job.status)
  })

  it('should cache and retrieve timelines correctly', () => {
    const cacheService = setupCacheService()

    const timeline: ReconciliationTimeline = {
      jobId: 'test-job-1',
      districtId: 'D1',
      targetMonth: '2025-01',
      entries: [
        {
          date: new Date('2025-01-02'),
          sourceDataDate: '2025-01-02',
          changes: {
            hasChanges: true,
            changedFields: ['membership'],
            membershipChange: {
              previous: 1000,
              current: 1010,
              percentChange: 1.0,
            },
            timestamp: new Date('2025-01-02'),
            sourceDataDate: '2025-01-02',
          },
          isSignificant: false,
          cacheUpdated: true,
        },
      ],
      status: {
        phase: 'monitoring',
        daysActive: 1,
        daysStable: 0,
        message: 'Monitoring for changes',
      },
    }

    // Cache miss initially
    expect(cacheService.getTimeline(timeline.jobId)).toBeNull()

    // Cache the timeline
    cacheService.setTimeline(timeline.jobId, timeline)

    // Cache hit
    const cachedTimeline = cacheService.getTimeline(timeline.jobId)
    expect(cachedTimeline).toBeDefined()
    expect(cachedTimeline!.jobId).toBe(timeline.jobId)
    expect(cachedTimeline!.entries).toHaveLength(1)
    expect(cachedTimeline!.status.phase).toBe('monitoring')
  })

  it('should cache and retrieve status correctly', () => {
    const cacheService = setupCacheService()

    const status: ReconciliationStatus = {
      phase: 'stabilizing',
      daysActive: 5,
      daysStable: 2,
      nextCheckDate: new Date('2025-01-06'),
      message: 'Stabilizing - 2/3 stable days',
    }

    const jobId = 'test-job-status'

    // Cache miss initially
    expect(cacheService.getStatus(jobId)).toBeNull()

    // Cache the status
    cacheService.setStatus(jobId, status)

    // Cache hit
    const cachedStatus = cacheService.getStatus(jobId)
    expect(cachedStatus).toBeDefined()
    expect(cachedStatus!.phase).toBe('stabilizing')
    expect(cachedStatus!.daysActive).toBe(5)
    expect(cachedStatus!.daysStable).toBe(2)
  })

  it('should invalidate cache entries correctly', () => {
    const cacheService = setupCacheService()

    const jobId = 'test-job-invalidate'
    const job: ReconciliationJob = createTestReconciliationJob({
      id: jobId,
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

    // Cache job, timeline, and status
    cacheService.setJob(jobId, job)
    cacheService.setTimeline(jobId, {
      jobId,
      districtId: 'D1',
      targetMonth: '2025-01',
      entries: [],
      status: { phase: 'monitoring', daysActive: 0, daysStable: 0 },
    })
    cacheService.setStatus(jobId, {
      phase: 'monitoring',
      daysActive: 0,
      daysStable: 0,
    })

    // Verify all are cached
    expect(cacheService.getJob(jobId)).toBeDefined()
    expect(cacheService.getTimeline(jobId)).toBeDefined()
    expect(cacheService.getStatus(jobId)).toBeDefined()

    // Invalidate job
    cacheService.invalidateJob(jobId)

    // All should be invalidated
    expect(cacheService.getJob(jobId)).toBeNull()
    expect(cacheService.getTimeline(jobId)).toBeNull()
    expect(cacheService.getStatus(jobId)).toBeNull()
  })

  it('should provide accurate cache statistics', () => {
    const cacheService = setupCacheService()

    // Initially empty
    let stats = cacheService.getStats()
    expect(stats.size).toBe(0)
    expect(stats.totalHits).toBe(0)
    expect(stats.totalMisses).toBe(0)

    // Add some cache entries
    const job: ReconciliationJob = createTestReconciliationJob({
      id: 'stats-job',
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

    cacheService.setJob('stats-job', job)

    // Cache hit
    cacheService.getJob('stats-job')

    // Cache miss
    cacheService.getJob('non-existent-job')

    stats = cacheService.getStats()
    expect(stats.size).toBe(1)
    expect(stats.totalHits).toBe(1)
    expect(stats.totalMisses).toBe(1)
    expect(stats.hitRate).toBe(0.5)
  })
})

describe('ReconciliationPerformanceMonitor Unit Tests', () => {
  // Self-cleanup setup - each test manages its own cleanup
  const { cleanup, afterEach: performCleanup } = createTestSelfCleanup({
    verbose: false,
  })

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

  it('should record and retrieve operation metrics', () => {
    const monitor = setupMonitor()
    const operationName = 'test-operation'

    // Record some metrics
    monitor.recordMetric(operationName, 100, true, { type: 'fast' })
    monitor.recordMetric(operationName, 200, true, { type: 'medium' })
    monitor.recordMetric(operationName, 300, false, { type: 'slow' })

    const stats = monitor.getOperationStats(operationName)
    expect(stats).toBeDefined()
    expect(stats!.operationName).toBe(operationName)
    expect(stats!.totalCalls).toBe(3)
    expect(stats!.successfulCalls).toBe(2)
    expect(stats!.failedCalls).toBe(1)
    expect(stats!.averageDuration).toBe(200) // (100 + 200 + 300) / 3
    expect(stats!.minDuration).toBe(100)
    expect(stats!.maxDuration).toBe(300)
    expect(stats!.successRate).toBeCloseTo(0.667, 2)
  })

  it('should time operations automatically', async () => {
    const monitor = setupMonitor()
    const operationName = 'timed-operation'
    const expectedResult = 'operation-result'

    const result = await monitor.timeOperation(operationName, async () => {
      await new Promise(resolve => setTimeout(resolve, 50))
      return expectedResult
    })

    expect(result).toBe(expectedResult)

    const stats = monitor.getOperationStats(operationName)
    expect(stats).toBeDefined()
    expect(stats!.totalCalls).toBe(1)
    expect(stats!.successfulCalls).toBe(1)
    expect(stats!.averageDuration).toBeGreaterThan(40) // Should be around 50ms
    expect(stats!.successRate).toBe(1)
  })

  it('should handle operation failures correctly', async () => {
    const monitor = setupMonitor()
    const operationName = 'failing-operation'
    const errorMessage = 'Test error'

    await expect(
      monitor.timeOperation(operationName, async () => {
        throw new Error(errorMessage)
      })
    ).rejects.toThrow(errorMessage)

    const stats = monitor.getOperationStats(operationName)
    expect(stats).toBeDefined()
    expect(stats!.totalCalls).toBe(1)
    expect(stats!.successfulCalls).toBe(0)
    expect(stats!.failedCalls).toBe(1)
    expect(stats!.successRate).toBe(0)
  })

  it('should identify performance bottlenecks', () => {
    const monitor = setupMonitor()

    // Record metrics for a slow operation
    monitor.recordMetric('slow-operation', 15000, true) // 15 seconds
    monitor.recordMetric('slow-operation', 20000, true) // 20 seconds

    // Record metrics for a fast operation
    monitor.recordMetric('fast-operation', 100, true)
    monitor.recordMetric('fast-operation', 150, true)

    const bottlenecks = monitor.getBottlenecks()
    expect(bottlenecks.length).toBeGreaterThan(0)

    const slowBottleneck = bottlenecks.find(
      b => b.operationName === 'slow-operation'
    )
    expect(slowBottleneck).toBeDefined()
    expect(['high', 'medium']).toContain(slowBottleneck!.severity)
    expect(slowBottleneck!.issue).toContain('High average duration')
  })

  it('should generate comprehensive performance reports', () => {
    const monitor = setupMonitor()

    // Record various metrics
    monitor.recordMetric('operation-1', 1000, true)
    monitor.recordMetric('operation-1', 1200, true)
    monitor.recordMetric('operation-2', 500, true)
    monitor.recordMetric('operation-2', 600, false)

    const report = monitor.generatePerformanceReport()

    expect(report.summary.totalOperations).toBe(4)
    expect(report.summary.uniqueOperations).toBe(2)
    expect(report.summary.overallSuccessRate).toBe(0.75) // 3 successful out of 4
    expect(report.topOperations.length).toBe(2)
    expect(report.recommendations).toBeDefined()
    expect(Array.isArray(report.recommendations)).toBe(true)
  })

  it('should clear metrics correctly', () => {
    const monitor = setupMonitor()

    // Record some metrics
    monitor.recordMetric('test-op', 100, true)

    let stats = monitor.getOperationStats('test-op')
    expect(stats).toBeDefined()

    // Clear metrics
    monitor.clearMetrics()

    stats = monitor.getOperationStats('test-op')
    expect(stats).toBeNull()
  })
})
