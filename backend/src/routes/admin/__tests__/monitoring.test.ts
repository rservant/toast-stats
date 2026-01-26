/**
 * Unit tests for admin monitoring routes
 *
 * Tests:
 * - Health check
 * - Integrity check
 * - Performance metrics
 * - Metrics reset
 * - System health
 *
 * Requirements: 7.1, 11.1
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { monitoringRouter } from '../monitoring.js'
import { FileSnapshotStore } from '../../../services/SnapshotStore.js'
import { Snapshot } from '../../../types/snapshots.js'
import type { ISnapshotStorage } from '../../../types/storageInterfaces.js'

// Test snapshot store instance
let testSnapshotStore: FileSnapshotStore

// Variable to hold the current temp directory for the mock
let currentTempDir: string = ''

// Mock the production service factory to use our test snapshot store
// Routes now use createSnapshotStorage() which returns ISnapshotStorage
const mockFactory = {
  createSnapshotStorage: () => testSnapshotStore as unknown as ISnapshotStorage,
  createSnapshotStore: () => testSnapshotStore,
  createCacheConfigService: () => ({
    getCacheDirectory: () => currentTempDir,
  }),
  createRefreshService: vi.fn(),
}

vi.mock('../../../services/ProductionServiceFactory.js', () => ({
  getProductionServiceFactory: () => mockFactory,
}))

// Mock logger
vi.mock('../../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// Mock the backfill module to control pending operations count
vi.mock('../backfill.js', () => ({
  getPendingBackfillJobCount: vi.fn(() => 0),
}))

describe('Monitoring Routes', () => {
  let app: express.Application
  let tempDir: string

  beforeEach(async () => {
    // Create unique temporary directory for test isolation
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), `monitoring-test-${uniqueId}-`)
    )

    // Update the module-level variable for the mock
    currentTempDir = tempDir

    // Create test snapshot store
    testSnapshotStore = new FileSnapshotStore({
      cacheDir: tempDir,
      maxSnapshots: 10,
      maxAgeDays: 7,
      enableCompression: false,
    })

    // Create test app with monitoring routes
    app = express()
    app.use(express.json())
    app.use('/api/admin', monitoringRouter)
  })

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  /**
   * Helper to create a test snapshot with ISO date format
   */
  const createTestSnapshot = (
    dateStr: string,
    status: 'success' | 'partial' | 'failed' = 'success',
    districtCount = 1
  ): Snapshot => {
    const districts = Array.from({ length: districtCount }, (_, i) => ({
      districtId: `${100 + i}`,
      asOfDate: dateStr,
      membership: {
        total: 100 + i * 10,
        change: 5,
        changePercent: 5.0,
        byClub: [],
      },
      clubs: {
        total: 10 + i,
        active: 8,
        suspended: 1,
        ineligible: 0,
        low: 1,
        distinguished: 3,
      },
      education: {
        totalAwards: 25,
        byType: [],
        topClubs: [],
      },
      performance: {
        membershipNet: 5,
        clubsNet: 1,
        distinguishedPercent: 30.0,
      },
    }))

    return {
      snapshot_id: dateStr,
      created_at: new Date().toISOString(),
      schema_version: '1.0.0',
      calculation_version: '1.0.0',
      status,
      errors: status === 'failed' ? ['Test error'] : [],
      payload: {
        districts,
        metadata: {
          source: 'test',
          fetchedAt: new Date().toISOString(),
          dataAsOfDate: dateStr,
          districtCount,
          processingDurationMs: 1000,
        },
      },
    }
  }

  describe('GET /snapshot-store/health', () => {
    it('should return health information when store is ready', async () => {
      // Create a test snapshot
      const testSnapshot = createTestSnapshot('2024-01-01', 'success', 2)
      await testSnapshotStore.writeSnapshot(testSnapshot)

      const response = await request(app).get(
        '/api/admin/snapshot-store/health'
      )

      expect(response.status).toBe(200)
      expect(response.body.health).toBeDefined()
      expect(response.body.health.is_ready).toBe(true)
      expect(response.body.health.store_status.store_accessible).toBe(true)
      expect(response.body.metadata.checked_at).toBeDefined()
      expect(response.body.metadata.operation_id).toBeDefined()
    })

    it('should return current snapshot details when available', async () => {
      const testSnapshot = createTestSnapshot('2024-01-01', 'success', 2)
      await testSnapshotStore.writeSnapshot(testSnapshot)

      const response = await request(app).get(
        '/api/admin/snapshot-store/health'
      )

      expect(response.status).toBe(200)
      expect(response.body.health.current_snapshot).not.toBeNull()
      expect(response.body.health.current_snapshot.snapshot_id).toBe(
        '2024-01-01'
      )
      expect(response.body.health.current_snapshot.status).toBe('success')
      expect(response.body.health.current_snapshot.district_count).toBe(2)
    })

    it('should return null current_snapshot when no snapshots exist', async () => {
      const response = await request(app).get(
        '/api/admin/snapshot-store/health'
      )

      expect(response.status).toBe(200)
      expect(response.body.health.current_snapshot).toBeNull()
      expect(response.body.health.latest_snapshot).toBeNull()
    })

    it('should include recent activity summary', async () => {
      // Create multiple snapshots with different statuses
      await testSnapshotStore.writeSnapshot(
        createTestSnapshot('2024-01-01', 'success')
      )
      await testSnapshotStore.writeSnapshot(
        createTestSnapshot('2024-01-02', 'failed')
      )
      await testSnapshotStore.writeSnapshot(
        createTestSnapshot('2024-01-03', 'success')
      )

      const response = await request(app).get(
        '/api/admin/snapshot-store/health'
      )

      expect(response.status).toBe(200)
      expect(response.body.health.recent_activity).toBeDefined()
      expect(response.body.health.recent_activity.total_snapshots).toBe(3)
      expect(response.body.health.recent_activity.successful_snapshots).toBe(2)
      expect(response.body.health.recent_activity.failed_snapshots).toBe(1)
    })

    it('should include store status indicators', async () => {
      const testSnapshot = createTestSnapshot('2024-01-01', 'success')
      await testSnapshotStore.writeSnapshot(testSnapshot)

      const response = await request(app).get(
        '/api/admin/snapshot-store/health'
      )

      expect(response.status).toBe(200)
      expect(response.body.health.store_status).toBeDefined()
      expect(response.body.health.store_status.has_current_snapshot).toBe(true)
      expect(response.body.health.store_status.store_accessible).toBe(true)
    })

    it('should handle health check errors gracefully', async () => {
      // Create a mock that throws an error
      const originalCreateSnapshotStorage = mockFactory.createSnapshotStorage
      mockFactory.createSnapshotStorage = () =>
        ({
          isReady: () => Promise.reject(new Error('Store unavailable')),
        }) as unknown as ISnapshotStorage

      const response = await request(app).get(
        '/api/admin/snapshot-store/health'
      )

      expect(response.status).toBe(500)
      expect(response.body.error.code).toBe('HEALTH_CHECK_FAILED')
      expect(response.body.error.details).toContain('Store unavailable')

      // Restore original mock
      mockFactory.createSnapshotStorage = originalCreateSnapshotStorage
    })
  })

  describe('GET /snapshot-store/integrity', () => {
    it('should return integrity check results', async () => {
      // Create a test snapshot
      const testSnapshot = createTestSnapshot('2024-01-01', 'success')
      await testSnapshotStore.writeSnapshot(testSnapshot)

      const response = await request(app).get(
        '/api/admin/snapshot-store/integrity'
      )

      expect(response.status).toBe(200)
      expect(response.body.integrity).toBeDefined()
      expect(response.body.metadata.checked_at).toBeDefined()
      expect(response.body.metadata.operation_id).toBeDefined()
    })

    it('should include check duration in metadata', async () => {
      const response = await request(app).get(
        '/api/admin/snapshot-store/integrity'
      )

      expect(response.status).toBe(200)
      expect(response.body.metadata.check_duration_ms).toBeDefined()
      expect(typeof response.body.metadata.check_duration_ms).toBe('number')
    })

    it('should handle integrity check errors gracefully', async () => {
      // Create a mock that throws an error
      const originalCreateSnapshotStorage = mockFactory.createSnapshotStorage
      mockFactory.createSnapshotStorage = () =>
        ({
          validateIntegrity: () =>
            Promise.reject(new Error('Integrity check failed')),
        }) as unknown as ISnapshotStorage

      const response = await request(app).get(
        '/api/admin/snapshot-store/integrity'
      )

      expect(response.status).toBe(500)
      expect(response.body.error.code).toBe('INTEGRITY_CHECK_FAILED')
      expect(response.body.error.details).toContain('Integrity check failed')

      // Restore original mock
      mockFactory.createSnapshotStorage = originalCreateSnapshotStorage
    })

    it('should return default values when validateIntegrity method is missing', async () => {
      // Create a mock without validateIntegrity method
      const originalCreateSnapshotStorage = mockFactory.createSnapshotStorage
      mockFactory.createSnapshotStorage = () =>
        ({
          // No validateIntegrity method
        }) as unknown as ISnapshotStorage

      const response = await request(app).get(
        '/api/admin/snapshot-store/integrity'
      )

      expect(response.status).toBe(200)
      expect(response.body.integrity.isValid).toBe(true)

      // Restore original mock
      mockFactory.createSnapshotStorage = originalCreateSnapshotStorage
    })
  })

  describe('GET /snapshot-store/performance', () => {
    it('should return performance metrics', async () => {
      // Create a test snapshot and read it to generate metrics
      const testSnapshot = createTestSnapshot('2024-01-01', 'success')
      await testSnapshotStore.writeSnapshot(testSnapshot)
      await testSnapshotStore.getLatestSuccessful() // Generate a read

      const response = await request(app).get(
        '/api/admin/snapshot-store/performance'
      )

      expect(response.status).toBe(200)
      expect(response.body.performance).toBeDefined()
      expect(response.body.performance.totalReads).toBeDefined()
      expect(response.body.performance.cacheHits).toBeDefined()
      expect(response.body.metadata.retrieved_at).toBeDefined()
      expect(response.body.metadata.operation_id).toBeDefined()
    })

    it('should calculate cache hit rate percentage', async () => {
      // Create a test snapshot and read it multiple times
      const testSnapshot = createTestSnapshot('2024-01-01', 'success')
      await testSnapshotStore.writeSnapshot(testSnapshot)
      await testSnapshotStore.getLatestSuccessful() // First read
      await testSnapshotStore.getLatestSuccessful() // Second read (cache hit)

      const response = await request(app).get(
        '/api/admin/snapshot-store/performance'
      )

      expect(response.status).toBe(200)
      expect(response.body.performance.cache_hit_rate_percent).toBeDefined()
      expect(typeof response.body.performance.cache_hit_rate_percent).toBe(
        'number'
      )
    })

    it('should include cache efficiency indicator', async () => {
      const testSnapshot = createTestSnapshot('2024-01-01', 'success')
      await testSnapshotStore.writeSnapshot(testSnapshot)
      await testSnapshotStore.getLatestSuccessful()

      const response = await request(app).get(
        '/api/admin/snapshot-store/performance'
      )

      expect(response.status).toBe(200)
      expect(response.body.performance.cache_efficiency).toBeDefined()
      expect(['good', 'no_data']).toContain(
        response.body.performance.cache_efficiency
      )
    })

    it('should return no_data efficiency when no reads have occurred', async () => {
      // Create a mock with zero reads
      const originalCreateSnapshotStorage = mockFactory.createSnapshotStorage
      mockFactory.createSnapshotStorage = () =>
        ({
          getPerformanceMetrics: () => ({
            totalReads: 0,
            cacheHits: 0,
            cacheMisses: 0,
            averageReadTime: 0,
            concurrentReads: 0,
            maxConcurrentReads: 0,
          }),
        }) as unknown as ISnapshotStorage

      const response = await request(app).get(
        '/api/admin/snapshot-store/performance'
      )

      expect(response.status).toBe(200)
      expect(response.body.performance.cache_efficiency).toBe('no_data')
      expect(response.body.performance.cache_hit_rate_percent).toBe(0)

      // Restore original mock
      mockFactory.createSnapshotStorage = originalCreateSnapshotStorage
    })

    it('should handle performance metrics errors gracefully', async () => {
      // Create a mock that throws an error
      const originalCreateSnapshotStorage = mockFactory.createSnapshotStorage
      mockFactory.createSnapshotStorage = () =>
        ({
          getPerformanceMetrics: () => {
            throw new Error('Metrics unavailable')
          },
        }) as unknown as ISnapshotStorage

      const response = await request(app).get(
        '/api/admin/snapshot-store/performance'
      )

      expect(response.status).toBe(500)
      expect(response.body.error.code).toBe('PERFORMANCE_METRICS_FAILED')
      expect(response.body.error.details).toContain('Metrics unavailable')

      // Restore original mock
      mockFactory.createSnapshotStorage = originalCreateSnapshotStorage
    })

    it('should return default values when getPerformanceMetrics method is missing', async () => {
      // Create a mock without getPerformanceMetrics method
      const originalCreateSnapshotStorage = mockFactory.createSnapshotStorage
      mockFactory.createSnapshotStorage = () =>
        ({
          // No getPerformanceMetrics method
        }) as unknown as ISnapshotStorage

      const response = await request(app).get(
        '/api/admin/snapshot-store/performance'
      )

      expect(response.status).toBe(200)
      expect(response.body.performance.totalReads).toBe(0)

      // Restore original mock
      mockFactory.createSnapshotStorage = originalCreateSnapshotStorage
    })
  })

  describe('POST /snapshot-store/performance/reset', () => {
    it('should reset performance metrics successfully', async () => {
      // Create a test snapshot and generate some metrics
      const testSnapshot = createTestSnapshot('2024-01-01', 'success')
      await testSnapshotStore.writeSnapshot(testSnapshot)
      await testSnapshotStore.getLatestSuccessful()

      const response = await request(app).post(
        '/api/admin/snapshot-store/performance/reset'
      )

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.message).toContain('reset successfully')
      expect(response.body.metadata.reset_at).toBeDefined()
      expect(response.body.metadata.operation_id).toBeDefined()
    })

    it('should include operation duration in metadata', async () => {
      const response = await request(app).post(
        '/api/admin/snapshot-store/performance/reset'
      )

      expect(response.status).toBe(200)
      expect(response.body.metadata.operation_duration_ms).toBeDefined()
      expect(typeof response.body.metadata.operation_duration_ms).toBe('number')
    })

    it('should handle reset errors gracefully', async () => {
      // Create a mock that throws an error
      const originalCreateSnapshotStorage = mockFactory.createSnapshotStorage
      mockFactory.createSnapshotStorage = () =>
        ({
          resetPerformanceMetrics: () => {
            throw new Error('Reset failed')
          },
        }) as unknown as ISnapshotStorage

      const response = await request(app).post(
        '/api/admin/snapshot-store/performance/reset'
      )

      expect(response.status).toBe(500)
      expect(response.body.error.code).toBe('METRICS_RESET_FAILED')
      expect(response.body.error.details).toContain('Reset failed')

      // Restore original mock
      mockFactory.createSnapshotStorage = originalCreateSnapshotStorage
    })

    it('should succeed when resetPerformanceMetrics method is missing', async () => {
      // Create a mock without resetPerformanceMetrics method
      const originalCreateSnapshotStorage = mockFactory.createSnapshotStorage
      mockFactory.createSnapshotStorage = () =>
        ({
          // No resetPerformanceMetrics method
        }) as unknown as ISnapshotStorage

      const response = await request(app).post(
        '/api/admin/snapshot-store/performance/reset'
      )

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)

      // Restore original mock
      mockFactory.createSnapshotStorage = originalCreateSnapshotStorage
    })

    it('should verify metrics are actually reset', async () => {
      // Create a test snapshot and generate some metrics
      const testSnapshot = createTestSnapshot('2024-01-01', 'success')
      await testSnapshotStore.writeSnapshot(testSnapshot)
      await testSnapshotStore.getLatestSuccessful()
      await testSnapshotStore.getLatestSuccessful()

      // Get metrics before reset
      const beforeResponse = await request(app).get(
        '/api/admin/snapshot-store/performance'
      )
      expect(beforeResponse.body.performance.totalReads).toBeGreaterThan(0)

      // Reset metrics
      await request(app).post('/api/admin/snapshot-store/performance/reset')

      // Get metrics after reset
      const afterResponse = await request(app).get(
        '/api/admin/snapshot-store/performance'
      )
      expect(afterResponse.body.performance.totalReads).toBe(0)
    })
  })

  describe('GET /health', () => {
    it('should return system health metrics', async () => {
      const response = await request(app).get('/api/admin/health')

      expect(response.status).toBe(200)
      expect(response.body.health).toBeDefined()
      expect(response.body.health.cacheHitRate).toBeDefined()
      expect(response.body.health.averageResponseTime).toBeDefined()
      expect(response.body.health.pendingOperations).toBeDefined()
      expect(response.body.health.snapshotCount).toBeDefined()
      expect(response.body.health.precomputedAnalyticsCount).toBeDefined()
      expect(response.body.metadata.checked_at).toBeDefined()
      expect(response.body.metadata.operation_id).toBeDefined()
    })

    it('should return correct snapshot count', async () => {
      // Create test snapshots
      await testSnapshotStore.writeSnapshot(
        createTestSnapshot('2024-01-01', 'success')
      )
      await testSnapshotStore.writeSnapshot(
        createTestSnapshot('2024-01-02', 'success')
      )
      await testSnapshotStore.writeSnapshot(
        createTestSnapshot('2024-01-03', 'success')
      )

      const response = await request(app).get('/api/admin/health')

      expect(response.status).toBe(200)
      expect(response.body.health.snapshotCount).toBe(3)
    })

    it('should return zero snapshot count when no snapshots exist', async () => {
      const response = await request(app).get('/api/admin/health')

      expect(response.status).toBe(200)
      expect(response.body.health.snapshotCount).toBe(0)
      expect(response.body.health.precomputedAnalyticsCount).toBe(0)
    })

    it('should include detailed cache information', async () => {
      // Create a test snapshot and read it to generate metrics
      const testSnapshot = createTestSnapshot('2024-01-01', 'success')
      await testSnapshotStore.writeSnapshot(testSnapshot)
      await testSnapshotStore.getLatestSuccessful()

      const response = await request(app).get('/api/admin/health')

      expect(response.status).toBe(200)
      expect(response.body.details).toBeDefined()
      expect(response.body.details.cache).toBeDefined()
      expect(response.body.details.cache.hitRate).toBeDefined()
      expect(response.body.details.cache.totalReads).toBeDefined()
      expect(response.body.details.cache.cacheHits).toBeDefined()
      expect(response.body.details.cache.cacheMisses).toBeDefined()
      expect(response.body.details.cache.efficiency).toBeDefined()
    })

    it('should include snapshot details with analytics coverage', async () => {
      const testSnapshot = createTestSnapshot('2024-01-01', 'success')
      await testSnapshotStore.writeSnapshot(testSnapshot)

      const response = await request(app).get('/api/admin/health')

      expect(response.status).toBe(200)
      expect(response.body.details.snapshots).toBeDefined()
      expect(response.body.details.snapshots.total).toBe(1)
      expect(response.body.details.snapshots.withPrecomputedAnalytics).toBeDefined()
      expect(response.body.details.snapshots.analyticsCoverage).toBeDefined()
    })

    it('should include operations status', async () => {
      const response = await request(app).get('/api/admin/health')

      expect(response.status).toBe(200)
      expect(response.body.details.operations).toBeDefined()
      expect(response.body.details.operations.pending).toBeDefined()
      expect(response.body.details.operations.status).toBeDefined()
      expect(['idle', 'processing']).toContain(
        response.body.details.operations.status
      )
    })

    it('should include performance metrics', async () => {
      const response = await request(app).get('/api/admin/health')

      expect(response.status).toBe(200)
      expect(response.body.details.performance).toBeDefined()
      expect(response.body.details.performance.averageResponseTime).toBeDefined()
      expect(response.body.details.performance.concurrentReads).toBeDefined()
      expect(response.body.details.performance.maxConcurrentReads).toBeDefined()
    })

    it('should include check duration in metadata', async () => {
      const response = await request(app).get('/api/admin/health')

      expect(response.status).toBe(200)
      expect(response.body.metadata.check_duration_ms).toBeDefined()
      expect(typeof response.body.metadata.check_duration_ms).toBe('number')
    })

    it('should handle health check errors gracefully', async () => {
      // Create a mock that throws an error
      const originalCreateSnapshotStorage = mockFactory.createSnapshotStorage
      mockFactory.createSnapshotStorage = () =>
        ({
          listSnapshots: () => Promise.reject(new Error('Store unavailable')),
        }) as unknown as ISnapshotStorage

      const response = await request(app).get('/api/admin/health')

      expect(response.status).toBe(500)
      expect(response.body.error.code).toBe('SYSTEM_HEALTH_CHECK_FAILED')
      expect(response.body.error.details).toContain('Store unavailable')

      // Restore original mock
      mockFactory.createSnapshotStorage = originalCreateSnapshotStorage
    })

    it('should return default values when getPerformanceMetrics method is missing', async () => {
      // Create a mock without getPerformanceMetrics method
      const originalCreateSnapshotStorage = mockFactory.createSnapshotStorage
      mockFactory.createSnapshotStorage = () =>
        ({
          listSnapshots: () => Promise.resolve([]),
          getPerformanceMetrics: undefined,
        }) as unknown as ISnapshotStorage

      const response = await request(app).get('/api/admin/health')

      expect(response.status).toBe(200)
      expect(response.body.health.cacheHitRate).toBe(0)
      expect(response.body.health.averageResponseTime).toBe(0)

      // Restore original mock
      mockFactory.createSnapshotStorage = originalCreateSnapshotStorage
    })

    it('should calculate cache hit rate correctly', async () => {
      // Create a test snapshot and read it multiple times
      const testSnapshot = createTestSnapshot('2024-01-01', 'success')
      await testSnapshotStore.writeSnapshot(testSnapshot)
      await testSnapshotStore.getLatestSuccessful() // First read
      await testSnapshotStore.getLatestSuccessful() // Second read (cache hit)
      await testSnapshotStore.getLatestSuccessful() // Third read (cache hit)

      const response = await request(app).get('/api/admin/health')

      expect(response.status).toBe(200)
      expect(response.body.health.cacheHitRate).toBeGreaterThanOrEqual(0)
      expect(response.body.health.cacheHitRate).toBeLessThanOrEqual(100)
    })

    it('should report idle status when no pending operations', async () => {
      const response = await request(app).get('/api/admin/health')

      expect(response.status).toBe(200)
      expect(response.body.health.pendingOperations).toBe(0)
      expect(response.body.details.operations.status).toBe('idle')
    })
  })
})
