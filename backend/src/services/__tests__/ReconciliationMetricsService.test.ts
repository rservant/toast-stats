/**
 * Tests for ReconciliationMetricsService
 *
 * Tests metrics collection, performance pattern detection, and alerting
 * for reconciliation job monitoring and analysis.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { ReconciliationMetricsService } from '../ReconciliationMetricsService'
import { AlertManager } from '../../utils/AlertManager'
import type { ReconciliationJob } from '../../types/reconciliation'
import { createTestReconciliationJob } from '../../utils/test-helpers'

// Mock AlertManager
vi.mock('../../utils/AlertManager.ts', () => ({
  AlertManager: {
    getInstance: vi.fn(() => ({
      sendAlert: vi.fn(),
      sendReconciliationFailureAlert: vi.fn(),
    })),
  },
  AlertSeverity: {
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH',
    CRITICAL: 'CRITICAL',
  },
  AlertCategory: {
    RECONCILIATION: 'RECONCILIATION',
    CIRCUIT_BREAKER: 'CIRCUIT_BREAKER',
    DATA_QUALITY: 'DATA_QUALITY',
    SYSTEM: 'SYSTEM',
    NETWORK: 'NETWORK',
  },
}))

// Helper function to create a complete ReconciliationJob
function createTestJob(
  overrides: Partial<ReconciliationJob> = {}
): ReconciliationJob {
  return {
    id: 'job-1',
    districtId: 'D1',
    targetMonth: '2024-01',
    status: 'active',
    startDate: new Date('2024-01-01T00:00:00Z'),
    maxEndDate: new Date('2024-01-16T00:00:00Z'),
    triggeredBy: 'automatic',
    progress: {
      phase: 'monitoring',
      completionPercentage: 0,
    },
    config: {
      maxReconciliationDays: 15,
      stabilityPeriodDays: 3,
      checkFrequencyHours: 24,
      significantChangeThresholds: {
        membershipPercent: 1,
        clubCountAbsolute: 1,
        distinguishedPercent: 2,
      },
      autoExtensionEnabled: true,
      maxExtensionDays: 5,
    },
    metadata: {
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
      triggeredBy: 'automatic',
    },
    ...overrides,
  }
}

// Mock logger
vi.mock('../../utils/logger.ts', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// Mock interface for AlertManager
interface MockAlertManager {
  alerts: Map<string, unknown>
  alertRules: Map<string, unknown>
  throttleTracker: Map<string, Date>
  sendAlert: ReturnType<typeof vi.fn>
  getAlertHistory: ReturnType<typeof vi.fn>
  sendReconciliationFailureAlert: ReturnType<typeof vi.fn>
  sendCircuitBreakerAlert: ReturnType<typeof vi.fn>
  sendPerformanceDegradationAlert: ReturnType<typeof vi.fn>
  sendDataInconsistencyAlert: ReturnType<typeof vi.fn>
  sendResourceExhaustionAlert: ReturnType<typeof vi.fn>
  sendSecurityAlert: ReturnType<typeof vi.fn>
  sendComplianceAlert: ReturnType<typeof vi.fn>
  sendBusinessCriticalAlert: ReturnType<typeof vi.fn>
  sendSystemHealthAlert: ReturnType<typeof vi.fn>
  sendUserExperienceAlert: ReturnType<typeof vi.fn>
  sendIntegrationAlert: ReturnType<typeof vi.fn>
  sendMaintenanceAlert: ReturnType<typeof vi.fn>
  sendConfigurationAlert: ReturnType<typeof vi.fn>
  sendCapacityAlert: ReturnType<typeof vi.fn>
  sendNetworkAlert: ReturnType<typeof vi.fn>
  sendDatabaseAlert: ReturnType<typeof vi.fn>
  sendFileSystemAlert: ReturnType<typeof vi.fn>
}

describe('ReconciliationMetricsService', () => {
  let metricsService: ReconciliationMetricsService
  let mockAlertManager: MockAlertManager

  beforeEach(() => {
    mockAlertManager = {
      alerts: new Map(),
      alertRules: new Map(),
      throttleTracker: new Map(),
      sendAlert: vi.fn(),
      getAlertHistory: vi.fn(),
      sendReconciliationFailureAlert: vi.fn(),
      sendCircuitBreakerAlert: vi.fn(),
      sendPerformanceDegradationAlert: vi.fn(),
      sendDataInconsistencyAlert: vi.fn(),
      sendResourceExhaustionAlert: vi.fn(),
      sendSecurityAlert: vi.fn(),
      sendComplianceAlert: vi.fn(),
      sendBusinessCriticalAlert: vi.fn(),
      sendSystemHealthAlert: vi.fn(),
      sendUserExperienceAlert: vi.fn(),
      sendIntegrationAlert: vi.fn(),
      sendMaintenanceAlert: vi.fn(),
      sendConfigurationAlert: vi.fn(),
      sendCapacityAlert: vi.fn(),
      sendNetworkAlert: vi.fn(),
      sendDatabaseAlert: vi.fn(),
      sendFileSystemAlert: vi.fn(),
    }

    // Create metrics service with dependency injection
    metricsService = new ReconciliationMetricsService(
      mockAlertManager as unknown as AlertManager
    )
  })

  afterEach(() => {
    vi.clearAllMocks()
    metricsService.resetMetrics()
  })
  describe('dependency injection', () => {
    it('should work with injected AlertManager', () => {
      const customAlertManager = {
        sendAlert: vi.fn(),
        sendReconciliationFailureAlert: vi.fn(),
      } as unknown as AlertManager

      const customMetricsService = new ReconciliationMetricsService(
        customAlertManager
      )

      expect(customMetricsService).toBeDefined()
    })
  })

  describe('recordJobStart', () => {
    it('should record job start metrics', () => {
      const job = createTestJob()

      metricsService.recordJobStart(job)

      const jobMetrics = metricsService.getJobDurationMetrics()
      expect(jobMetrics).toHaveLength(1)
      expect(jobMetrics[0]).toMatchObject({
        jobId: 'job-1',
        districtId: 'D1',
        targetMonth: '2024-01',
        status: 'active',
        wasExtended: false,
        extensionCount: 0,
        finalStabilityDays: 0,
      })
    })
  })

  describe('recordJobCompletion', () => {
    it('should record successful job completion', () => {
      const job = createTestReconciliationJob({
        id: 'job-1',
        districtId: 'D1',
        targetMonth: '2024-01',
        status: 'completed',
        startDate: new Date('2024-01-01T00:00:00Z'),
        endDate: new Date('2024-01-05T00:00:00Z'),
        maxEndDate: new Date('2024-01-16T00:00:00Z'),
        progress: {
          phase: 'completed',
          completionPercentage: 100,
        },
        triggeredBy: 'automatic',
      })

      metricsService.recordJobStart(job)
      metricsService.recordJobCompletion(job, 3)

      const metrics = metricsService.getMetrics()
      expect(metrics.totalJobs).toBe(1)
      expect(metrics.successfulJobs).toBe(1)
      expect(metrics.failedJobs).toBe(0)
      expect(metrics.successRate).toBe(100)
      expect(metrics.averageDuration).toBeGreaterThan(0)
    })
  })

  describe('recordJobExtension', () => {
    it('should record job extension', () => {
      const job: ReconciliationJob = {
        id: 'job-1',
        districtId: 'D1',
        targetMonth: '2024-01',
        status: 'active',
        startDate: new Date('2024-01-01T00:00:00Z'),
        maxEndDate: new Date('2024-01-16T00:00:00Z'),
        progress: {
          phase: 'monitoring',
          completionPercentage: 50,
        },
        triggeredBy: 'manual',
        config: {
          maxReconciliationDays: 15,
          stabilityPeriodDays: 3,
          checkFrequencyHours: 24,
          significantChangeThresholds: {
            membershipPercent: 1,
            clubCountAbsolute: 1,
            distinguishedPercent: 2,
          },
          autoExtensionEnabled: true,
          maxExtensionDays: 5,
        },
        metadata: {
          createdAt: new Date('2024-01-01T00:00:00Z'),
          updatedAt: new Date('2024-01-01T00:00:00Z'),
          triggeredBy: 'automatic',
        },
      }

      metricsService.recordJobStart(job)
      metricsService.recordJobExtension('job-1', 3)

      const jobMetrics = metricsService.getJobDurationMetrics()
      expect(jobMetrics[0].wasExtended).toBe(true)
      expect(jobMetrics[0].extensionCount).toBe(1)
    })

    it('should handle multiple extensions', () => {
      const job: ReconciliationJob = {
        id: 'job-1',
        districtId: 'D1',
        targetMonth: '2024-01',
        status: 'active',
        startDate: new Date('2024-01-01T00:00:00Z'),
        maxEndDate: new Date('2024-01-16T00:00:00Z'),
        progress: {
          phase: 'monitoring',
          completionPercentage: 50,
        },
        triggeredBy: 'manual',
        config: {
          maxReconciliationDays: 15,
          stabilityPeriodDays: 3,
          checkFrequencyHours: 24,
          significantChangeThresholds: {
            membershipPercent: 1,
            clubCountAbsolute: 1,
            distinguishedPercent: 2,
          },
          autoExtensionEnabled: true,
          maxExtensionDays: 5,
        },
        metadata: {
          createdAt: new Date('2024-01-01T00:00:00Z'),
          updatedAt: new Date('2024-01-01T00:00:00Z'),
          triggeredBy: 'automatic',
        },
      }

      metricsService.recordJobStart(job)
      metricsService.recordJobExtension('job-1', 2)
      metricsService.recordJobExtension('job-1', 1)

      const jobMetrics = metricsService.getJobDurationMetrics()
      expect(jobMetrics[0].extensionCount).toBe(2)
    })
  })
  describe('recordJobFailure', () => {
    it('should record job failure and send alert', async () => {
      const job: ReconciliationJob = {
        id: 'job-1',
        districtId: 'D1',
        targetMonth: '2024-01',
        status: 'failed',
        startDate: new Date('2024-01-01T00:00:00Z'),
        maxEndDate: new Date('2024-01-16T00:00:00Z'),
        progress: {
          phase: 'monitoring',
          completionPercentage: 50,
        },
        triggeredBy: 'manual',
        config: {
          maxReconciliationDays: 15,
          stabilityPeriodDays: 3,
          checkFrequencyHours: 24,
          significantChangeThresholds: {
            membershipPercent: 1,
            clubCountAbsolute: 1,
            distinguishedPercent: 2,
          },
          autoExtensionEnabled: true,
          maxExtensionDays: 5,
        },
        metadata: {
          createdAt: new Date('2024-01-01T00:00:00Z'),
          updatedAt: new Date('2024-01-01T00:00:00Z'),
          triggeredBy: 'automatic',
        },
      }

      metricsService.recordJobStart(job)
      await metricsService.recordJobFailure(job, 'Dashboard unavailable')

      const metrics = metricsService.getMetrics()
      expect(metrics.totalJobs).toBe(1)
      expect(metrics.failedJobs).toBe(1)
      expect(metrics.failureRate).toBe(100)

      expect(
        mockAlertManager.sendReconciliationFailureAlert
      ).toHaveBeenCalledWith('D1', '2024-01', 'Dashboard unavailable', 'job-1')
    })
  })

  describe('getMetrics', () => {
    it('should return comprehensive metrics', () => {
      const job1: ReconciliationJob = createTestReconciliationJob({
        id: 'job-1',
        districtId: 'D1',
        targetMonth: '2024-01',
        status: 'completed',
        startDate: new Date('2024-01-01T00:00:00Z'),
        endDate: new Date('2024-01-05T00:00:00Z'),
        maxEndDate: new Date('2024-01-16T00:00:00Z'),
        metadata: {
          createdAt: new Date('2024-01-01T00:00:00Z'),
          updatedAt: new Date('2024-01-05T00:00:00Z'),
          triggeredBy: 'automatic',
        },
      })

      const job2: ReconciliationJob = createTestReconciliationJob({
        id: 'job-2',
        districtId: 'D2',
        targetMonth: '2024-01',
        status: 'failed',
        startDate: new Date('2024-01-01T00:00:00Z'),
        maxEndDate: new Date('2024-01-16T00:00:00Z'),
        triggeredBy: 'manual',
        metadata: {
          createdAt: new Date('2024-01-01T00:00:00Z'),
          updatedAt: new Date('2024-01-01T00:00:00Z'),
          triggeredBy: 'manual',
        },
      })

      metricsService.recordJobStart(job1)
      metricsService.recordJobCompletion(job1, 3)

      metricsService.recordJobStart(job2)
      metricsService.recordJobFailure(job2, 'Test error')

      const metrics = metricsService.getMetrics()
      expect(metrics.totalJobs).toBe(2)
      expect(metrics.successfulJobs).toBe(1)
      expect(metrics.failedJobs).toBe(1)
      expect(metrics.successRate).toBe(50)
      expect(metrics.failureRate).toBe(50)
    })

    it('should handle empty metrics', () => {
      const metrics = metricsService.getMetrics()
      expect(metrics.totalJobs).toBe(0)
      expect(metrics.successRate).toBe(0)
      expect(metrics.failureRate).toBe(0)
      expect(metrics.averageDuration).toBe(0)
    })
  })

  describe('getDistrictMetrics', () => {
    it('should return metrics for specific district', () => {
      const job1: ReconciliationJob = createTestReconciliationJob({
        id: 'job-1',
        districtId: 'D1',
        targetMonth: '2024-01',
        status: 'completed',
        startDate: new Date('2024-01-01T00:00:00Z'),
        endDate: new Date('2024-01-05T00:00:00Z'),
        maxEndDate: new Date('2024-01-16T00:00:00Z'),
        metadata: {
          createdAt: new Date('2024-01-01T00:00:00Z'),
          updatedAt: new Date('2024-01-05T00:00:00Z'),
          triggeredBy: 'automatic',
        },
      })

      const job2: ReconciliationJob = createTestReconciliationJob({
        id: 'job-2',
        districtId: 'D2',
        targetMonth: '2024-01',
        status: 'completed',
        startDate: new Date('2024-01-01T00:00:00Z'),
        endDate: new Date('2024-01-03T00:00:00Z'),
        maxEndDate: new Date('2024-01-16T00:00:00Z'),
        triggeredBy: 'manual',
        metadata: {
          createdAt: new Date('2024-01-01T00:00:00Z'),
          updatedAt: new Date('2024-01-03T00:00:00Z'),
          triggeredBy: 'manual',
        },
      })

      metricsService.recordJobStart(job1)
      metricsService.recordJobCompletion(job1, 3)

      metricsService.recordJobStart(job2)
      metricsService.recordJobCompletion(job2, 2)

      const d1Metrics = metricsService.getDistrictMetrics('D1')
      expect(d1Metrics.totalJobs).toBe(1)
      expect(d1Metrics.successfulJobs).toBe(1)

      const d2Metrics = metricsService.getDistrictMetrics('D2')
      expect(d2Metrics.totalJobs).toBe(1)
      expect(d2Metrics.successfulJobs).toBe(1)
    })
  })
  describe('performance pattern detection', () => {
    it('should detect frequent failures pattern', async () => {
      // Create 3 failed jobs to trigger frequent failures pattern
      for (let i = 1; i <= 3; i++) {
        const job: ReconciliationJob = createTestReconciliationJob({
          id: `job-${i}`,
          districtId: 'D1',
          targetMonth: `2024-0${i}`,
          status: 'failed',
        })

        metricsService.recordJobStart(job)
        await metricsService.recordJobFailure(job, `Error ${i}`)
      }

      const patterns = metricsService.getPerformancePatterns()
      const frequentFailuresPattern = patterns.find(
        p => p.pattern === 'frequent_failures'
      )

      expect(frequentFailuresPattern).toBeDefined()
      expect(frequentFailuresPattern?.severity).toBe('high')
      expect(frequentFailuresPattern?.affectedJobs).toHaveLength(3)
      expect(mockAlertManager.sendAlert).toHaveBeenCalledWith(
        'HIGH',
        'RECONCILIATION',
        expect.stringContaining('Performance Pattern Detected'),
        expect.stringContaining('3 reconciliation failures'),
        expect.any(Object)
      )
    })

    it('should detect extended reconciliation pattern', () => {
      // Create 2 jobs with multiple extensions
      for (let i = 1; i <= 2; i++) {
        const job: ReconciliationJob = createTestReconciliationJob({
          id: `job-${i}`,
          districtId: 'D1',
          targetMonth: `2024-0${i}`,
          status: 'completed',
        })

        metricsService.recordJobStart(job)
        metricsService.recordJobExtension(`job-${i}`, 2)
        metricsService.recordJobExtension(`job-${i}`, 1) // Multiple extensions
        metricsService.recordJobCompletion(job, 3)
      }

      const patterns = metricsService.getPerformancePatterns()
      const extendedPattern = patterns.find(p => p.pattern === 'extended')

      expect(extendedPattern).toBeDefined()
      expect(extendedPattern?.severity).toBe('medium')
      expect(extendedPattern?.affectedJobs).toHaveLength(2)
    })

    it('should detect timeout pattern', async () => {
      // Create 2 jobs that exceeded maximum period (timeout)
      for (let i = 1; i <= 2; i++) {
        const job: ReconciliationJob = createTestReconciliationJob({
          id: `job-${i}`,
          districtId: 'D1',
          targetMonth: `2024-0${i}`,
          status: 'failed',
          startDate: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000), // 16 days ago
          endDate: new Date(), // Set end date for duration calculation
          maxEndDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
          metadata: {
            createdAt: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000),
            updatedAt: new Date(),
            triggeredBy: 'automatic',
          },
        })

        metricsService.recordJobStart(job)
        await metricsService.recordJobFailure(job, 'Timeout')
      }

      const patterns = metricsService.getPerformancePatterns()
      const timeoutPattern = patterns.find(p => p.pattern === 'timeout')

      expect(timeoutPattern).toBeDefined()
      expect(timeoutPattern?.severity).toBe('high')
      expect(timeoutPattern?.affectedJobs).toHaveLength(2)
    })
  })

  describe('cleanupOldMetrics', () => {
    it('should clean up old completed jobs', async () => {
      const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000) // 100 days ago
      const recentDate = new Date()

      const oldJob: ReconciliationJob = createTestReconciliationJob({
        id: 'old-job',
        districtId: 'D1',
        targetMonth: '2023-01',
        status: 'completed',
        startDate: oldDate,
        endDate: oldDate,
        maxEndDate: new Date(oldDate.getTime() + 15 * 24 * 60 * 60 * 1000),
        metadata: {
          createdAt: oldDate,
          updatedAt: oldDate,
          triggeredBy: 'automatic',
        },
      })

      const recentJob: ReconciliationJob = createTestReconciliationJob({
        id: 'recent-job',
        districtId: 'D1',
        targetMonth: '2024-01',
        status: 'completed',
        startDate: recentDate,
        endDate: recentDate,
        maxEndDate: new Date(recentDate.getTime() + 15 * 24 * 60 * 60 * 1000),
        metadata: {
          createdAt: recentDate,
          updatedAt: recentDate,
          triggeredBy: 'automatic',
        },
      })

      metricsService.recordJobStart(oldJob)
      metricsService.recordJobCompletion(oldJob, 3)

      metricsService.recordJobStart(recentJob)
      metricsService.recordJobCompletion(recentJob, 3)

      expect(metricsService.getJobDurationMetrics()).toHaveLength(2)

      const cleanedCount = await metricsService.cleanupOldMetrics()

      expect(cleanedCount).toBe(1)
      expect(metricsService.getJobDurationMetrics()).toHaveLength(1)
      expect(metricsService.getJobDurationMetrics()[0].jobId).toBe('recent-job')
    })

    it('should not clean up active jobs regardless of age', async () => {
      const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000) // 100 days ago

      const activeJob: ReconciliationJob = createTestReconciliationJob({
        id: 'active-job',
        districtId: 'D1',
        targetMonth: '2023-01',
        status: 'active',
        startDate: oldDate,
        maxEndDate: new Date(oldDate.getTime() + 15 * 24 * 60 * 60 * 1000),
        metadata: {
          createdAt: oldDate,
          updatedAt: oldDate,
          triggeredBy: 'automatic',
        },
      })

      metricsService.recordJobStart(activeJob)

      const cleanedCount = await metricsService.cleanupOldMetrics()

      expect(cleanedCount).toBe(0)
      expect(metricsService.getJobDurationMetrics()).toHaveLength(1)
    })
  })

  describe('getHealthStatus', () => {
    it('should return health status', () => {
      const job: ReconciliationJob = createTestReconciliationJob({
        id: 'job-1',
        districtId: 'D1',
        targetMonth: '2024-01',
        status: 'active',
        startDate: new Date(),
        maxEndDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          triggeredBy: 'automatic',
        },
      })

      metricsService.recordJobStart(job)

      const health = metricsService.getHealthStatus()

      expect(health.isHealthy).toBe(true)
      expect(health.totalJobs).toBe(1)
      expect(health.activeJobs).toBe(1)
      expect(health.performancePatterns).toBe(0)
      expect(health.lastCleanup).toBeDefined()
    })
  })

  describe('resetMetrics', () => {
    it('should reset all metrics', () => {
      const job: ReconciliationJob = createTestReconciliationJob({
        id: 'job-1',
        districtId: 'D1',
        targetMonth: '2024-01',
        status: 'completed',
        startDate: new Date(),
        endDate: new Date(),
        maxEndDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          triggeredBy: 'automatic',
        },
      })

      metricsService.recordJobStart(job)
      metricsService.recordJobCompletion(job, 3)

      expect(metricsService.getMetrics().totalJobs).toBe(1)

      metricsService.resetMetrics()

      expect(metricsService.getMetrics().totalJobs).toBe(0)
      expect(metricsService.getJobDurationMetrics()).toHaveLength(0)
      expect(metricsService.getPerformancePatterns()).toHaveLength(0)
    })
  })

  describe('edge cases', () => {
    it('should handle missing job metrics gracefully', () => {
      metricsService.recordJobExtension('non-existent-job', 3)

      // Should not throw and should log warning
      expect(metricsService.getJobDurationMetrics()).toHaveLength(0)
    })

    it('should calculate median correctly for even number of durations', () => {
      const jobs = [
        { duration: 1000, id: 'job-1' },
        { duration: 2000, id: 'job-2' },
        { duration: 3000, id: 'job-3' },
        { duration: 4000, id: 'job-4' },
      ]

      jobs.forEach(({ duration, id }) => {
        const job: ReconciliationJob = createTestReconciliationJob({
          id,
          districtId: 'D1',
          targetMonth: '2024-01',
          status: 'completed',
          startDate: new Date(Date.now() - duration),
          endDate: new Date(),
          maxEndDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
          metadata: {
            createdAt: new Date(),
            updatedAt: new Date(),
            triggeredBy: 'automatic',
          },
        })

        metricsService.recordJobStart(job)
        metricsService.recordJobCompletion(job, 3)
      })

      const metrics = metricsService.getMetrics()
      expect(metrics.medianDuration).toBe(2500) // (2000 + 3000) / 2
    })
  })
})
