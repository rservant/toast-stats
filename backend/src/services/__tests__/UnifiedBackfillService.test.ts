import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  BackfillService,
  JobManager,
  DataSourceSelector,
  ScopeManager,
  PartialSnapshotResult,
} from '../UnifiedBackfillService'
import { RefreshService } from '../RefreshService'
import { PerDistrictFileSnapshotStore } from '../PerDistrictSnapshotStore'
import { DistrictConfigurationService } from '../DistrictConfigurationService'
import { AlertManager } from '../../utils/AlertManager'

// Mock dependencies
vi.mock('../RefreshService')
vi.mock('../PerDistrictSnapshotStore')
vi.mock('../DistrictConfigurationService')
vi.mock('../../utils/AlertManager')

describe('UnifiedBackfillService', () => {
  let refreshService: RefreshService
  let snapshotStore: PerDistrictFileSnapshotStore
  let configService: DistrictConfigurationService
  let alertManager: AlertManager
  let backfillService: BackfillService

  beforeEach(() => {
    // Create mocked instances
    refreshService = new RefreshService({} as Record<string, unknown>)
    snapshotStore = new PerDistrictFileSnapshotStore({
      cacheDir: './test-cache',
    })
    configService = new DistrictConfigurationService('./test-cache')
    alertManager = new AlertManager()

    // Create service instance
    backfillService = new BackfillService(
      refreshService,
      snapshotStore,
      configService,
      alertManager
    )
  })

  describe('JobManager', () => {
    it('should create a job with unique ID', () => {
      const jobManager = new JobManager()
      const request = {
        startDate: '2024-01-01',
        endDate: '2024-01-05',
      }
      const scope = {
        targetDistricts: ['42'],
        configuredDistricts: ['42'],
        scopeType: 'single-district' as const,
        validationPassed: true,
      }

      const job = jobManager.createJob(request, scope)

      expect(job.backfillId).toBeDefined()
      expect(job.status).toBe('processing')
      expect(job.scope).toEqual(scope)
      expect(job.progress.total).toBe(0)
      expect(job.progress.completed).toBe(0)
      expect(job.createdAt).toBeGreaterThan(0)
    })

    it('should update job progress', () => {
      const jobManager = new JobManager()
      const request = {
        startDate: '2024-01-01',
      }
      const scope = {
        targetDistricts: [],
        configuredDistricts: [],
        scopeType: 'system-wide' as const,
        validationPassed: true,
      }

      const job = jobManager.createJob(request, scope)

      jobManager.updateProgress(job.backfillId, {
        total: 10,
        completed: 5,
        current: '2024-01-03',
      })

      const updatedJob = jobManager.getJob(job.backfillId)
      expect(updatedJob?.progress.total).toBe(10)
      expect(updatedJob?.progress.completed).toBe(5)
      expect(updatedJob?.progress.current).toBe('2024-01-03')
    })

    it('should cancel a job', () => {
      const jobManager = new JobManager()
      const request = {
        startDate: '2024-01-01',
      }
      const scope = {
        targetDistricts: [],
        configuredDistricts: [],
        scopeType: 'system-wide' as const,
        validationPassed: true,
      }

      const job = jobManager.createJob(request, scope)
      const cancelled = jobManager.cancelJob(job.backfillId)

      expect(cancelled).toBe(true)

      const cancelledJob = jobManager.getJob(job.backfillId)
      expect(cancelledJob?.status).toBe('cancelled')
      expect(cancelledJob?.error).toBe('Backfill cancelled by user')
      expect(cancelledJob?.completedAt).toBeGreaterThan(0)
    })

    it('should return null for non-existent job', () => {
      const jobManager = new JobManager()
      const job = jobManager.getJob('non-existent-id')
      expect(job).toBeNull()
    })
  })

  describe('DataSourceSelector', () => {
    it('should select system-wide strategy for auto collection with no targets', () => {
      const selector = new DataSourceSelector(refreshService, snapshotStore)
      const request = {
        startDate: '2024-01-01',
        collectionType: 'auto' as const,
      }

      const strategy = selector.selectCollectionStrategy(request)

      expect(strategy.type).toBe('system-wide')
      expect(strategy.refreshMethod.name).toBe('getAllDistricts')
      expect(strategy.rationale).toContain('System-wide collection')
      expect(strategy.estimatedEfficiency).toBe(0.9)
    })

    it('should select per-district strategy for single district', () => {
      const selector = new DataSourceSelector(refreshService, snapshotStore)
      const request = {
        startDate: '2024-01-01',
        targetDistricts: ['42'],
        collectionType: 'auto' as const,
      }

      const strategy = selector.selectCollectionStrategy(request)

      expect(strategy.type).toBe('per-district')
      expect(strategy.refreshMethod.name).toBe('getDistrictPerformance')
      expect(strategy.targetDistricts).toEqual(['42'])
      expect(strategy.rationale).toContain('Per-district collection')
      expect(strategy.estimatedEfficiency).toBe(0.8)
    })

    it('should select targeted strategy for multiple districts', () => {
      const selector = new DataSourceSelector(refreshService, snapshotStore)
      const request = {
        startDate: '2024-01-01',
        targetDistricts: ['42', '15', 'F'],
        collectionType: 'auto' as const,
      }

      const strategy = selector.selectCollectionStrategy(request)

      expect(strategy.type).toBe('targeted')
      expect(strategy.refreshMethod.name).toBe('getMultipleDistricts')
      expect(strategy.targetDistricts).toEqual(['42', '15', 'F'])
      expect(strategy.rationale).toContain('Targeted collection')
      expect(strategy.estimatedEfficiency).toBe(0.7)
    })

    it('should respect explicit collection type', () => {
      const selector = new DataSourceSelector(refreshService, snapshotStore)
      const request = {
        startDate: '2024-01-01',
        targetDistricts: ['42'],
        collectionType: 'system-wide' as const,
      }

      const strategy = selector.selectCollectionStrategy(request)

      expect(strategy.type).toBe('system-wide')
      expect(strategy.refreshMethod.name).toBe('getAllDistricts')
      expect(strategy.rationale).toContain('Explicit system-wide')
    })
  })

  describe('ScopeManager', () => {
    it('should validate scope with configured districts', async () => {
      const scopeManager = new ScopeManager(configService)

      // Mock configured districts
      vi.mocked(configService.getConfiguredDistricts).mockResolvedValue([
        '42',
        '15',
        'F',
      ])

      const request = {
        startDate: '2024-01-01',
        targetDistricts: ['42', '15'],
      }

      const scope = await scopeManager.validateScope(request)

      expect(scope.targetDistricts).toEqual(['42', '15'])
      expect(scope.configuredDistricts).toEqual(['42', '15', 'F'])
      expect(scope.scopeType).toBe('targeted')
      expect(scope.validationPassed).toBe(true)
    })

    it('should fail validation for out-of-scope districts', async () => {
      const scopeManager = new ScopeManager(configService)

      // Mock configured districts
      vi.mocked(configService.getConfiguredDistricts).mockResolvedValue([
        '42',
        '15',
      ])

      const request = {
        startDate: '2024-01-01',
        targetDistricts: ['42', 'F'], // 'F' is not configured
      }

      const scope = await scopeManager.validateScope(request)

      expect(scope.validationPassed).toBe(false)
    })

    it('should determine single-district scope type', async () => {
      const scopeManager = new ScopeManager(configService)

      vi.mocked(configService.getConfiguredDistricts).mockResolvedValue([
        '42',
        '15',
        'F',
      ])

      const request = {
        startDate: '2024-01-01',
        targetDistricts: ['42'],
      }

      const scope = await scopeManager.validateScope(request)

      expect(scope.scopeType).toBe('single-district')
    })

    it('should determine system-wide scope type when no targets specified', async () => {
      const scopeManager = new ScopeManager(configService)

      vi.mocked(configService.getConfiguredDistricts).mockResolvedValue([
        '42',
        '15',
        'F',
      ])

      const request = {
        startDate: '2024-01-01',
      }

      const scope = await scopeManager.validateScope(request)

      expect(scope.scopeType).toBe('system-wide')
      expect(scope.targetDistricts).toEqual(['42', '15', 'F'])
    })
  })

  describe('Enhanced ScopeManager', () => {
    it('should filter out-of-scope districts and log violations', async () => {
      const scopeManager = new ScopeManager(configService)

      vi.mocked(configService.getConfiguredDistricts).mockResolvedValue([
        '42',
        '15',
      ])

      const result = await scopeManager.filterValidDistricts(
        ['42', 'F', '15', 'G'],
        true
      )

      expect(result.validDistricts).toEqual(['42', '15'])
      expect(result.invalidDistricts).toEqual(['F', 'G'])
      expect(result.scopeViolations).toHaveLength(2)
      expect(result.scopeViolations[0].districtId).toBe('F')
      expect(result.scopeViolations[0].violationType).toBe('not_configured')
      expect(result.scopeViolations[1].districtId).toBe('G')
    })

    it('should determine scope type correctly', async () => {
      const scopeManager = new ScopeManager(configService)

      vi.mocked(configService.getConfiguredDistricts).mockResolvedValue([
        '42',
        '15',
        'F',
      ])

      // Test single district
      expect(scopeManager.determineScopeType(['42'], ['42', '15', 'F'])).toBe(
        'single-district'
      )

      // Test multiple districts (but not all)
      expect(
        scopeManager.determineScopeType(['42', '15'], ['42', '15', 'F'])
      ).toBe('targeted')

      // Test all configured districts
      expect(
        scopeManager.determineScopeType(['42', '15', 'F'], ['42', '15', 'F'])
      ).toBe('system-wide')

      // Test empty target districts
      expect(scopeManager.determineScopeType([], ['42', '15', 'F'])).toBe(
        'system-wide'
      )
    })

    it('should handle no configured districts correctly', async () => {
      const scopeManager = new ScopeManager(configService)

      vi.mocked(configService.getConfiguredDistricts).mockResolvedValue([])

      // When no districts are configured, all districts should be in scope (Requirement 7.2)
      expect(scopeManager.isDistrictInScope('42', [])).toBe(true)
      expect(scopeManager.isDistrictInScope('F', [])).toBe(true)

      const result = await scopeManager.filterValidDistricts(
        ['42', 'F', '15'],
        true
      )
      expect(result.validDistricts).toEqual(['42', 'F', '15'])
      expect(result.invalidDistricts).toEqual([])
      expect(result.scopeViolations).toHaveLength(0)
    })
  })

  describe('Enhanced Error Handling', () => {
    it('should track district-level errors with detailed context', async () => {
      const jobManager = new JobManager()
      const request = {
        startDate: '2024-01-01',
        targetDistricts: ['42'],
        retryFailures: true,
      }
      const scope = {
        targetDistricts: ['42'],
        configuredDistricts: ['42'],
        scopeType: 'single-district' as const,
        validationPassed: true,
      }

      const job = jobManager.createJob(request, scope)
      const testError = new Error('Network timeout occurred')

      // Track district error
      jobManager.trackDistrictError(
        job.backfillId,
        '42',
        testError,
        'network_error',
        { date: '2024-01-01', attempt: 1 }
      )

      const errorTracker = job.errorTrackers.get('42')
      expect(errorTracker).toBeDefined()
      expect(errorTracker?.errors).toHaveLength(1)
      expect(errorTracker?.errors[0].errorType).toBe('network_error')
      expect(errorTracker?.errors[0].isRetryable).toBe(true)
      expect(errorTracker?.consecutiveFailures).toBe(1)
      expect(job.progress.totalErrors).toBe(1)
      expect(job.progress.retryableErrors).toBe(1)
    })

    it('should blacklist districts after consecutive failures', async () => {
      const jobManager = new JobManager()
      const request = {
        startDate: '2024-01-01',
        targetDistricts: ['42'],
      }
      const scope = {
        targetDistricts: ['42'],
        configuredDistricts: ['42'],
        scopeType: 'single-district' as const,
        validationPassed: true,
      }

      const job = jobManager.createJob(request, scope)

      // Track 5 consecutive failures to trigger blacklisting
      for (let i = 0; i < 5; i++) {
        jobManager.trackDistrictError(
          job.backfillId,
          '42',
          new Error(`Failure ${i + 1}`),
          'fetch_failed'
        )
      }

      const errorTracker = job.errorTrackers.get('42')
      expect(errorTracker?.isBlacklisted).toBe(true)
      expect(errorTracker?.blacklistUntil).toBeDefined()
      expect(jobManager.isDistrictBlacklisted(job.backfillId, '42')).toBe(true)
    })

    it('should reset error counters on district success', async () => {
      const jobManager = new JobManager()
      const request = {
        startDate: '2024-01-01',
        targetDistricts: ['42'],
      }
      const scope = {
        targetDistricts: ['42'],
        configuredDistricts: ['42'],
        scopeType: 'single-district' as const,
        validationPassed: true,
      }

      const job = jobManager.createJob(request, scope)

      // Track some failures
      jobManager.trackDistrictError(
        job.backfillId,
        '42',
        new Error('Temporary failure'),
        'network_error'
      )

      let errorTracker = job.errorTrackers.get('42')
      expect(errorTracker?.consecutiveFailures).toBe(1)

      // Track success
      jobManager.trackDistrictSuccess(job.backfillId, '42')

      errorTracker = job.errorTrackers.get('42')
      expect(errorTracker?.consecutiveFailures).toBe(0)
      expect(errorTracker?.isBlacklisted).toBe(false)
      expect(errorTracker?.lastSuccessAt).toBeDefined()
    })

    it('should record partial snapshots', async () => {
      const jobManager = new JobManager()
      const request = {
        startDate: '2024-01-01',
        targetDistricts: ['42', '15'],
      }
      const scope = {
        targetDistricts: ['42', '15'],
        configuredDistricts: ['42', '15'],
        scopeType: 'targeted' as const,
        validationPassed: true,
      }

      const job = jobManager.createJob(request, scope)

      const partialSnapshot: PartialSnapshotResult = {
        snapshotId: 'test-snapshot-123',
        successfulDistricts: ['42'],
        failedDistricts: ['15'],
        totalDistricts: 2,
        successRate: 0.5,
        errors: [],
        metadata: {
          createdAt: new Date().toISOString(),
          processingTime: 1000,
          isPartial: true,
          backfillJobId: job.backfillId,
        },
      }

      jobManager.recordPartialSnapshot(job.backfillId, partialSnapshot)

      expect(job.partialSnapshots).toHaveLength(1)
      expect(job.partialSnapshots[0]).toEqual(partialSnapshot)
      expect(job.progress.partialSnapshots).toBe(1)
    })

    it('should create enhanced backfill response with error summary', async () => {
      // Mock dependencies
      vi.mocked(configService.getConfiguredDistricts).mockResolvedValue([
        '42',
        '15',
      ])

      const request = {
        startDate: '2024-01-01',
        targetDistricts: ['42', '15'],
      }

      const backfillId = await backfillService.initiateBackfill(request)

      // Simulate some errors
      const jobManager = (
        backfillService as BackfillService & { jobManager: JobManager }
      ).jobManager
      jobManager.trackDistrictError(
        backfillId,
        '42',
        new Error('Test error'),
        'fetch_failed'
      )

      const updatedStatus = backfillService.getBackfillStatus(backfillId)

      expect(updatedStatus?.errorSummary).toBeDefined()
      expect(updatedStatus?.errorSummary?.totalErrors).toBe(1)
      expect(updatedStatus?.errorSummary?.affectedDistricts).toContain('42')
    })
  })

  describe('BackfillService Integration', () => {
    it('should initiate backfill with valid request', async () => {
      // Mock dependencies
      vi.mocked(configService.getConfiguredDistricts).mockResolvedValue(['42'])

      const request = {
        startDate: '2024-01-01',
        targetDistricts: ['42'],
      }

      const backfillId = await backfillService.initiateBackfill(request)

      expect(backfillId).toBeDefined()
      expect(typeof backfillId).toBe('string')
    })

    it('should reject backfill with out-of-scope districts', async () => {
      // Mock configured districts
      vi.mocked(configService.getConfiguredDistricts).mockResolvedValue(['42'])

      const request = {
        startDate: '2024-01-01',
        targetDistricts: ['F'], // Not in configured districts
      }

      await expect(backfillService.initiateBackfill(request)).rejects.toThrow(
        'No valid districts to process'
      )
    })

    it('should get backfill status', async () => {
      // Mock dependencies
      vi.mocked(configService.getConfiguredDistricts).mockResolvedValue(['42'])

      const request = {
        startDate: '2024-01-01',
        targetDistricts: ['42'],
      }

      const backfillId = await backfillService.initiateBackfill(request)
      const status = backfillService.getBackfillStatus(backfillId)

      expect(status).toBeDefined()
      expect(status?.backfillId).toBe(backfillId)
      expect(status?.status).toBe('processing')
      expect(status?.scope.targetDistricts).toEqual(['42'])
    })

    it('should return null for non-existent backfill status', () => {
      const status = backfillService.getBackfillStatus('non-existent-id')
      expect(status).toBeNull()
    })

    it('should cancel backfill', async () => {
      // Mock dependencies
      vi.mocked(configService.getConfiguredDistricts).mockResolvedValue(['42'])

      const request = {
        startDate: '2024-01-01',
        targetDistricts: ['42'],
      }

      const backfillId = await backfillService.initiateBackfill(request)
      const cancelled = await backfillService.cancelBackfill(backfillId)

      expect(cancelled).toBe(true)

      const status = backfillService.getBackfillStatus(backfillId)
      expect(status?.status).toBe('cancelled')
    })

    it('should reject backfill with end date of today or later', async () => {
      // The Toastmasters dashboard data is always 1-2 days behind,
      // so requesting today's date would result in a mismatch between
      // the requested date and the actual "As of" date in the CSV.
      vi.mocked(configService.getConfiguredDistricts).mockResolvedValue(['42'])

      const today = new Date()
      const todayStr = today.toISOString().split('T')[0]

      const request = {
        startDate: '2024-01-01',
        endDate: todayStr,
        targetDistricts: ['42'],
      }

      await expect(backfillService.initiateBackfill(request)).rejects.toThrow(
        /End date must be before today/
      )
    })

    it('should reject backfill with start date of today when no end date specified', async () => {
      // When no end date is specified, startDate is used as the effective end date
      vi.mocked(configService.getConfiguredDistricts).mockResolvedValue(['42'])

      const today = new Date()
      const todayStr = today.toISOString().split('T')[0]

      const request = {
        startDate: todayStr!,
        targetDistricts: ['42'],
      }

      await expect(backfillService.initiateBackfill(request)).rejects.toThrow(
        /End date must be before today/
      )
    })

    it('should accept backfill with end date of yesterday', async () => {
      vi.mocked(configService.getConfiguredDistricts).mockResolvedValue(['42'])

      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toISOString().split('T')[0]

      const request = {
        startDate: '2024-01-01',
        endDate: yesterdayStr,
        targetDistricts: ['42'],
      }

      const backfillId = await backfillService.initiateBackfill(request)
      expect(backfillId).toBeDefined()
      expect(typeof backfillId).toBe('string')
    })
  })
})
