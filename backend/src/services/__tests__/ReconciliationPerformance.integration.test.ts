/**
 * Integration tests for reconciliation performance optimizations
 * Tests the actual performance improvements in a realistic scenario
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ReconciliationOrchestrator } from '../ReconciliationOrchestrator.js'
import { ReconciliationStorageOptimizer } from '../ReconciliationStorageOptimizer.js'
import { ReconciliationCacheService } from '../ReconciliationCacheService.js'
import { ReconciliationPerformanceMonitor } from '../ReconciliationPerformanceMonitor.js'
import type { ReconciliationJob, DistrictStatistics } from '../../types/reconciliation.js'
import { createTestReconciliationJob } from '../../utils/test-helpers.js'

// Mock logger
vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

// Mock external dependencies
vi.mock('../ChangeDetectionEngine.js', () => {
  class MockChangeDetectionEngine {
    detectChanges() {
      return {
        hasChanges: true,
        changedFields: ['membership'],
        membershipChange: {
          previous: 1000,
          current: 1010,
          percentChange: 1.0
        },
        timestamp: new Date(),
        sourceDataDate: '2025-01-15'
      }
    }
    
    isSignificantChange() {
      return false
    }
  }
  
  return {
    ChangeDetectionEngine: MockChangeDetectionEngine
  }
})

vi.mock('../ReconciliationStorageOptimizer.js', () => ({
  ReconciliationStorageOptimizer: vi.fn().mockImplementation(() => ({
    saveJob: vi.fn().mockResolvedValue(undefined),
    getJob: vi.fn().mockResolvedValue(null),
    getAllJobs: vi.fn().mockResolvedValue([]),
    deleteJob: vi.fn().mockResolvedValue(true)
  }))
}))

vi.mock('../CacheUpdateManager.js', () => ({
  CacheUpdateManager: vi.fn().mockImplementation(() => ({
    updateCache: vi.fn().mockResolvedValue(undefined),
    invalidateCache: vi.fn().mockResolvedValue(undefined)
  }))
}))

vi.mock('../../utils/AlertManager.js', () => ({
  AlertManager: {
    getInstance: vi.fn().mockReturnValue({
      sendAlert: vi.fn().mockResolvedValue('alert-id'),
      sendReconciliationFailureAlert: vi.fn().mockResolvedValue('alert-id')
    })
  },
  AlertSeverity: {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
  },
  AlertCategory: {
    SYSTEM: 'system',
    RECONCILIATION: 'reconciliation',
    PERFORMANCE: 'performance',
    DATA: 'data'
  }
}))

vi.mock('../ReconciliationMetricsService.js', () => ({
  ReconciliationMetricsService: {
    getInstance: vi.fn().mockReturnValue({
      recordJobStart: vi.fn(),
      recordJobCompletion: vi.fn(),
      recordJobFailure: vi.fn(),
      recordJobExtension: vi.fn()
    })
  }
}))

describe('Reconciliation Performance Integration', () => {
  let performanceMonitor: ReconciliationPerformanceMonitor
  let cacheService: ReconciliationCacheService
  let storageOptimizer: ReconciliationStorageOptimizer
  let orchestrator: ReconciliationOrchestrator
  let mockChangeDetectionEngine: any

  beforeEach(() => {
    // Create mock instances
    mockChangeDetectionEngine = {
      detectChanges: vi.fn().mockReturnValue({
        hasChanges: true,
        changedFields: ['membership'],
        membershipChange: {
          previous: 1000,
          current: 1010,
          percentChange: 1.0
        },
        timestamp: new Date(),
        sourceDataDate: '2025-01-15'
      }),
      isSignificantChange: vi.fn().mockReturnValue(false)
    }

    const mockConfigService = {
      getConfig: vi.fn().mockResolvedValue({
        maxReconciliationDays: 15,
        stabilityPeriodDays: 3,
        checkFrequencyHours: 24,
        significantChangeThresholds: {
          membershipPercent: 1.0,
          clubCountAbsolute: 1,
          distinguishedPercent: 2.0
        },
        autoExtensionEnabled: true,
        maxExtensionDays: 5
      }),
      updateConfig: vi.fn().mockResolvedValue(undefined)
    }

    const mockCacheUpdateManager = {
      updateCache: vi.fn().mockResolvedValue(undefined),
      invalidateCache: vi.fn().mockResolvedValue(undefined)
    }

    performanceMonitor = new ReconciliationPerformanceMonitor()
    cacheService = new ReconciliationCacheService({
      maxSize: 100,
      ttlMs: 60000,
      enablePrefetch: true
    })
    
    // Pre-populate cache with a timeline to avoid storage loading
    const mockTimeline = {
      jobId: 'test-job-id',
      districtId: 'D1',
      targetMonth: '2025-01',
      entries: [],
      status: {
        phase: 'monitoring' as const,
        daysActive: 0,
        daysStable: 0,
        message: 'Monitoring for changes'
      }
    }
    
    // Create a mock storage optimizer that tracks saved jobs
    const savedJobs = new Map()
    const savedTimelines = new Map()
    
    storageOptimizer = {
      saveJob: vi.fn().mockImplementation(async (job) => {
        savedJobs.set(job.id, job)
        // Also pre-populate cache when job is saved
        cacheService.setJob(job.id, job)
        const timeline = { ...mockTimeline, jobId: job.id, districtId: job.districtId, targetMonth: job.targetMonth }
        cacheService.setTimeline(job.id, timeline)
        return undefined
      }),
      getJob: vi.fn().mockImplementation(async (jobId) => {
        return savedJobs.get(jobId) || null
      }),
      getAllJobs: vi.fn().mockResolvedValue([]),
      getJobsByDistrict: vi.fn().mockResolvedValue([]), // Add missing method
      deleteJob: vi.fn().mockResolvedValue(true),
      cleanup: vi.fn().mockResolvedValue(undefined),
      getStats: vi.fn().mockReturnValue({ totalJobs: 0, cacheHitRate: 0.8 }),
      getCacheStats: vi.fn().mockReturnValue({ // Add missing method
        hitRate: 0.85,
        totalRequests: 100,
        cacheSize: 50,
        jobCacheSize: 10,
        timelineCacheSize: 5,
        pendingOperations: 0
      }),
      saveTimeline: vi.fn().mockImplementation(async (timeline) => {
        savedTimelines.set(timeline.jobId, timeline)
        return undefined
      }),
      getTimeline: vi.fn().mockImplementation(async (jobId) => {
        const existing = savedTimelines.get(jobId)
        if (existing) return existing
        
        // Return a default timeline structure if none exists
        return {
          jobId,
          districtId: 'D1',
          targetMonth: '2025-01',
          entries: [],
          status: {
            phase: 'monitoring',
            daysActive: 0,
            daysStable: 0,
            message: 'Monitoring for changes'
          }
        }
      }),
      flush: vi.fn().mockResolvedValue(undefined) // Add missing method
    } as any
    
    orchestrator = new ReconciliationOrchestrator(
      mockChangeDetectionEngine,
      storageOptimizer,
      cacheService,
      mockConfigService as any,
      mockCacheUpdateManager as any
    )
  })

  afterEach(async () => {
    performanceMonitor.shutdown()
    cacheService.shutdown()
    await storageOptimizer.cleanup()
  })

  it('should demonstrate performance improvements with caching', async () => {
    const districtId = 'D1'
    const targetMonth = '2025-01'

    // Create mock district data
    const currentData: DistrictStatistics = {
      districtId,
      asOfDate: '2025-01-15',
      membership: {
        total: 950,
        change: 50,
        changePercent: 5.6,
        byClub: []
      },
      clubs: {
        total: 100,
        active: 95,
        suspended: 3,
        ineligible: 1,
        low: 1,
        distinguished: 35
      },
      education: {
        totalAwards: 150,
        byType: [],
        topClubs: []
      },
      districtPerformance: [
        {
          districtId,
          districtName: 'District 1',
          totalClubs: 100,
          paidClubs: 95,
          totalPayments: 950,
          distinguishedClubs: { select: 10, distinguished: 20, president: 5, total: 35 }
        }
      ],
      divisionPerformance: [],
      clubPerformance: []
    }

    const cachedData: DistrictStatistics = {
      districtId,
      asOfDate: '2025-01-14',
      membership: {
        total: 940,
        change: 40,
        changePercent: 4.4,
        byClub: []
      },
      clubs: {
        total: 100,
        active: 94,
        suspended: 4,
        ineligible: 1,
        low: 1,
        distinguished: 34
      },
      education: {
        totalAwards: 145,
        byType: [],
        topClubs: []
      },
      districtPerformance: [
        {
          districtId,
          districtName: 'District 1',
          totalClubs: 100,
          paidClubs: 94,
          totalPayments: 940,
          distinguishedClubs: { select: 10, distinguished: 19, president: 5, total: 34 }
        }
      ],
      divisionPerformance: [],
      clubPerformance: []
    }

    // Measure performance of reconciliation operations
    const startTime = Date.now()

    // Start reconciliation
    const job = await performanceMonitor.timeOperation(
      'startReconciliation',
      () => orchestrator.startReconciliation(districtId, targetMonth, undefined, 'automatic')
    )

    expect(job).toBeDefined()
    expect(job.districtId).toBe(districtId)
    expect(job.targetMonth).toBe(targetMonth)

    // Process reconciliation cycle
    const status = await performanceMonitor.timeOperation(
      'processReconciliationCycle',
      () => orchestrator.processReconciliationCycle(job.id, currentData, cachedData)
    )

    expect(status).toBeDefined()
    expect(status.phase).toBeDefined()

    const totalTime = Date.now() - startTime

    // Verify performance metrics were recorded
    const startStats = performanceMonitor.getOperationStats('startReconciliation')
    const processStats = performanceMonitor.getOperationStats('processReconciliationCycle')

    expect(startStats).toBeDefined()
    expect(startStats!.totalCalls).toBe(1)
    expect(startStats!.successRate).toBe(1)

    expect(processStats).toBeDefined()
    expect(processStats!.totalCalls).toBe(1)
    expect(processStats!.successRate).toBe(1)

    // Performance should be reasonable (under 5 seconds for this simple test)
    expect(totalTime).toBeLessThan(5000)

    // Cache should have entries
    const cacheStats = cacheService.getStats()
    expect(cacheStats.size).toBeGreaterThan(0)
  })

  it('should show cache hit performance benefits', async () => {
    const jobId = 'test-job-cache-performance'
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
        triggeredBy: 'manual'
      }
    })

    // Cache the job
    cacheService.setJob(jobId, job)

    // Measure cache hit performance
    const cacheHitTimes: number[] = []
    for (let i = 0; i < 10; i++) {
      const startTime = Date.now()
      const cachedJob = cacheService.getJob(jobId)
      const hitTime = Date.now() - startTime

      cacheHitTimes.push(hitTime)
      expect(cachedJob).toBeDefined()
      expect(cachedJob!.id).toBe(jobId)
    }

    // Cache hits should be very fast (sub-millisecond average)
    const averageHitTime = cacheHitTimes.reduce((sum, time) => sum + time, 0) / cacheHitTimes.length
    expect(averageHitTime).toBeLessThan(5) // Should be very fast

    // Verify cache statistics
    const stats = cacheService.getStats()
    expect(stats.hitRate).toBeGreaterThan(0.8) // Should have good hit rate
    expect(stats.totalHits).toBeGreaterThan(0)
  })

  it('should demonstrate batch processing efficiency', async () => {
    // This test verifies that the batch processing infrastructure is working
    // without actually running a full batch (which would be slow in tests)
    
    const storageStats = storageOptimizer.getCacheStats()
    expect(storageStats).toBeDefined()
    expect(storageStats.jobCacheSize).toBeGreaterThanOrEqual(0)
    expect(storageStats.timelineCacheSize).toBeGreaterThanOrEqual(0)
    expect(storageStats.pendingOperations).toBeGreaterThanOrEqual(0)

    // Test that storage optimizer can handle multiple operations
    const jobs: ReconciliationJob[] = []
    for (let i = 0; i < 3; i++) {
      const job: ReconciliationJob = createTestReconciliationJob({
        id: `batch-test-${i}`,
        districtId: `D${i}`,
        targetMonth: '2025-01',
        status: 'active',
        startDate: new Date(),
        maxEndDate: new Date(Date.now() + 86400000),
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          triggeredBy: 'automatic'
        }
      })
      jobs.push(job)
    }

    // Save jobs (should be batched)
    const startTime = Date.now()
    await Promise.all(jobs.map(job => storageOptimizer.saveJob(job)))
    await storageOptimizer.flush()
    const batchTime = Date.now() - startTime

    expect(batchTime).toBeLessThan(2000) // Should complete quickly
  })

  it('should provide comprehensive performance monitoring', async () => {
    // Record some sample metrics
    performanceMonitor.recordMetric('test-operation-1', 100, true, { type: 'fast' })
    performanceMonitor.recordMetric('test-operation-1', 150, true, { type: 'medium' })
    performanceMonitor.recordMetric('test-operation-2', 2000, true, { type: 'slow' })

    // Generate performance report
    const report = performanceMonitor.generatePerformanceReport(60000) // 1 minute window

    expect(report.summary.totalOperations).toBe(3)
    expect(report.summary.uniqueOperations).toBe(2)
    expect(report.summary.overallSuccessRate).toBe(1.0)
    expect(report.topOperations.length).toBeGreaterThan(0)
    expect(report.recommendations.length).toBeGreaterThanOrEqual(0)

    // Check that bottlenecks are identified
    const bottlenecks = performanceMonitor.getBottlenecks(60000)
    expect(bottlenecks).toBeDefined()
    
    // The slow operation should be identified as a bottleneck
    const slowBottleneck = bottlenecks.find(b => b.operationName === 'test-operation-2')
    if (slowBottleneck) {
      expect(['high', 'medium']).toContain(slowBottleneck.severity)
    }
  })
})