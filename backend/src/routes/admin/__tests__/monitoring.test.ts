/**
 * Unit tests for admin monitoring routes
 *
 * Tests:
 * - Health check
 * - Integrity check
 * - Performance metrics
 * - Metrics reset
 *
 * Requirements: 7.1
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { monitoringRouter } from '../monitoring.js'
import { FileSnapshotStore } from '../../../services/FileSnapshotStore.js'
import { Snapshot } from '../../../types/snapshots.js'

// Test snapshot store instance
let testSnapshotStore: FileSnapshotStore

// Mock the production service factory to use our test snapshot store
const mockFactory = {
  createSnapshotStore: () => testSnapshotStore,
  createCacheConfigService: vi.fn(),
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

describe('Monitoring Routes', () => {
  let app: express.Application
  let tempDir: string

  beforeEach(async () => {
    // Create unique temporary directory for test isolation
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), `monitoring-test-${uniqueId}-`)
    )

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
   * Helper to create a test snapshot
   */
  const createTestSnapshot = (
    id: string,
    status: 'success' | 'partial' | 'failed' = 'success',
    districtCount = 1
  ): Snapshot => {
    const districts = Array.from({ length: districtCount }, (_, i) => ({
      districtId: `${100 + i}`,
      asOfDate: '2024-01-01',
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
      snapshot_id: id,
      created_at: new Date(parseInt(id)).toISOString(),
      schema_version: '1.0.0',
      calculation_version: '1.0.0',
      status,
      errors: status === 'failed' ? ['Test error'] : [],
      payload: {
        districts,
        metadata: {
          source: 'test',
          fetchedAt: new Date(parseInt(id)).toISOString(),
          dataAsOfDate: '2024-01-01',
          districtCount,
          processingDurationMs: 1000,
        },
      },
    }
  }

  describe('GET /snapshot-store/health', () => {
    it('should return health information when store is ready', async () => {
      // Create a test snapshot
      const testSnapshot = createTestSnapshot('1704067200000', 'success', 2)
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
      const testSnapshot = createTestSnapshot('1704067200000', 'success', 2)
      await testSnapshotStore.writeSnapshot(testSnapshot)

      const response = await request(app).get(
        '/api/admin/snapshot-store/health'
      )

      expect(response.status).toBe(200)
      expect(response.body.health.current_snapshot).not.toBeNull()
      expect(response.body.health.current_snapshot.snapshot_id).toBe(
        '1704067200000'
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
        createTestSnapshot('1704067200000', 'success')
      )
      await testSnapshotStore.writeSnapshot(
        createTestSnapshot('1704153600000', 'failed')
      )
      await testSnapshotStore.writeSnapshot(
        createTestSnapshot('1704240000000', 'success')
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
      const testSnapshot = createTestSnapshot('1704067200000', 'success')
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
      const originalCreateSnapshotStore = mockFactory.createSnapshotStore
      mockFactory.createSnapshotStore = () =>
        ({
          isReady: () => Promise.reject(new Error('Store unavailable')),
        }) as unknown as FileSnapshotStore

      const response = await request(app).get(
        '/api/admin/snapshot-store/health'
      )

      expect(response.status).toBe(500)
      expect(response.body.error.code).toBe('HEALTH_CHECK_FAILED')
      expect(response.body.error.details).toContain('Store unavailable')

      // Restore original mock
      mockFactory.createSnapshotStore = originalCreateSnapshotStore
    })
  })

  describe('GET /snapshot-store/integrity', () => {
    it('should return integrity check results', async () => {
      // Create a test snapshot
      const testSnapshot = createTestSnapshot('1704067200000', 'success')
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
      const originalCreateSnapshotStore = mockFactory.createSnapshotStore
      mockFactory.createSnapshotStore = () =>
        ({
          validateIntegrity: () =>
            Promise.reject(new Error('Integrity check failed')),
        }) as unknown as FileSnapshotStore

      const response = await request(app).get(
        '/api/admin/snapshot-store/integrity'
      )

      expect(response.status).toBe(500)
      expect(response.body.error.code).toBe('INTEGRITY_CHECK_FAILED')
      expect(response.body.error.details).toContain('Integrity check failed')

      // Restore original mock
      mockFactory.createSnapshotStore = originalCreateSnapshotStore
    })

    it('should return default values when validateIntegrity method is missing', async () => {
      // Create a mock without validateIntegrity method
      const originalCreateSnapshotStore = mockFactory.createSnapshotStore
      mockFactory.createSnapshotStore = () =>
        ({
          // No validateIntegrity method
        }) as unknown as FileSnapshotStore

      const response = await request(app).get(
        '/api/admin/snapshot-store/integrity'
      )

      expect(response.status).toBe(200)
      expect(response.body.integrity.isValid).toBe(true)

      // Restore original mock
      mockFactory.createSnapshotStore = originalCreateSnapshotStore
    })
  })

  describe('GET /snapshot-store/performance', () => {
    it('should return performance metrics', async () => {
      // Create a test snapshot and read it to generate metrics
      const testSnapshot = createTestSnapshot('1704067200000', 'success')
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
      const testSnapshot = createTestSnapshot('1704067200000', 'success')
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
      const testSnapshot = createTestSnapshot('1704067200000', 'success')
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
      const originalCreateSnapshotStore = mockFactory.createSnapshotStore
      mockFactory.createSnapshotStore = () =>
        ({
          getPerformanceMetrics: () => ({
            totalReads: 0,
            cacheHits: 0,
            cacheMisses: 0,
            averageReadTime: 0,
            concurrentReads: 0,
            maxConcurrentReads: 0,
          }),
        }) as unknown as FileSnapshotStore

      const response = await request(app).get(
        '/api/admin/snapshot-store/performance'
      )

      expect(response.status).toBe(200)
      expect(response.body.performance.cache_efficiency).toBe('no_data')
      expect(response.body.performance.cache_hit_rate_percent).toBe(0)

      // Restore original mock
      mockFactory.createSnapshotStore = originalCreateSnapshotStore
    })

    it('should handle performance metrics errors gracefully', async () => {
      // Create a mock that throws an error
      const originalCreateSnapshotStore = mockFactory.createSnapshotStore
      mockFactory.createSnapshotStore = () =>
        ({
          getPerformanceMetrics: () => {
            throw new Error('Metrics unavailable')
          },
        }) as unknown as FileSnapshotStore

      const response = await request(app).get(
        '/api/admin/snapshot-store/performance'
      )

      expect(response.status).toBe(500)
      expect(response.body.error.code).toBe('PERFORMANCE_METRICS_FAILED')
      expect(response.body.error.details).toContain('Metrics unavailable')

      // Restore original mock
      mockFactory.createSnapshotStore = originalCreateSnapshotStore
    })

    it('should return default values when getPerformanceMetrics method is missing', async () => {
      // Create a mock without getPerformanceMetrics method
      const originalCreateSnapshotStore = mockFactory.createSnapshotStore
      mockFactory.createSnapshotStore = () =>
        ({
          // No getPerformanceMetrics method
        }) as unknown as FileSnapshotStore

      const response = await request(app).get(
        '/api/admin/snapshot-store/performance'
      )

      expect(response.status).toBe(200)
      expect(response.body.performance.totalReads).toBe(0)

      // Restore original mock
      mockFactory.createSnapshotStore = originalCreateSnapshotStore
    })
  })

  describe('POST /snapshot-store/performance/reset', () => {
    it('should reset performance metrics successfully', async () => {
      // Create a test snapshot and generate some metrics
      const testSnapshot = createTestSnapshot('1704067200000', 'success')
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
      const originalCreateSnapshotStore = mockFactory.createSnapshotStore
      mockFactory.createSnapshotStore = () =>
        ({
          resetPerformanceMetrics: () => {
            throw new Error('Reset failed')
          },
        }) as unknown as FileSnapshotStore

      const response = await request(app).post(
        '/api/admin/snapshot-store/performance/reset'
      )

      expect(response.status).toBe(500)
      expect(response.body.error.code).toBe('METRICS_RESET_FAILED')
      expect(response.body.error.details).toContain('Reset failed')

      // Restore original mock
      mockFactory.createSnapshotStore = originalCreateSnapshotStore
    })

    it('should succeed when resetPerformanceMetrics method is missing', async () => {
      // Create a mock without resetPerformanceMetrics method
      const originalCreateSnapshotStore = mockFactory.createSnapshotStore
      mockFactory.createSnapshotStore = () =>
        ({
          // No resetPerformanceMetrics method
        }) as unknown as FileSnapshotStore

      const response = await request(app).post(
        '/api/admin/snapshot-store/performance/reset'
      )

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)

      // Restore original mock
      mockFactory.createSnapshotStore = originalCreateSnapshotStore
    })

    it('should verify metrics are actually reset', async () => {
      // Create a test snapshot and generate some metrics
      const testSnapshot = createTestSnapshot('1704067200000', 'success')
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
})
