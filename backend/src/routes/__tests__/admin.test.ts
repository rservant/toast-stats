/**
 * Tests for admin snapshot management routes
 *
 * Tests the debugging endpoints for snapshot analysis, listing,
 * inspection, and health checking functionality.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import request from 'supertest'
import express from 'express'
import adminRoutes from '../admin.js'
import { Snapshot, SnapshotMetadata } from '../../types/snapshots.js'

// Mock the production service factory
const mockSnapshotStore = {
  listSnapshots: vi.fn(),
  getSnapshot: vi.fn(),
  getLatestSuccessful: vi.fn(),
  getLatest: vi.fn(),
  isReady: vi.fn(),
  validateIntegrity: vi.fn(),
  getPerformanceMetrics: vi.fn(),
  resetPerformanceMetrics: vi.fn(),
}

const mockFactory = {
  createSnapshotStore: vi.fn(() => mockSnapshotStore),
}

vi.mock('../../services/ProductionServiceFactory.js', () => ({
  getProductionServiceFactory: () => mockFactory,
}))

// Mock logger
vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('Admin Routes', () => {
  let app: express.Application
  const validAdminToken = 'test-admin-token'

  beforeEach(() => {
    // Set up test environment
    process.env.ADMIN_TOKEN = validAdminToken

    // Create test app
    app = express()
    app.use(express.json())
    app.use('/api/admin', adminRoutes)

    // Reset all mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    delete process.env.ADMIN_TOKEN
  })

  const createTestSnapshot = (
    id: string,
    status: 'success' | 'failed' = 'success'
  ): Snapshot => ({
    snapshot_id: id,
    created_at: new Date().toISOString(),
    schema_version: '1.0.0',
    calculation_version: '1.0.0',
    status,
    errors: status === 'failed' ? ['Test error'] : [],
    payload: {
      districts: [
        {
          districtId: '123',
          name: 'Test District',
          clubs: [],
          membership: { total: 100 },
          performance: { overallScore: 85 },
        } as Snapshot['payload']['districts'][0],
      ],
      metadata: {
        source: 'test',
        fetchedAt: new Date().toISOString(),
        dataAsOfDate: '2024-01-01',
        districtCount: 1,
        processingDurationMs: 1000,
      },
    },
  })

  const createTestMetadata = (
    id: string,
    status: 'success' | 'failed' = 'success'
  ): SnapshotMetadata => ({
    snapshot_id: id,
    created_at: new Date().toISOString(),
    status,
    schema_version: '1.0.0',
    calculation_version: '1.0.0',
    size_bytes: 1024,
    error_count: status === 'failed' ? 1 : 0,
    district_count: 1,
  })

  describe('Authentication', () => {
    it('should reject requests without admin token', async () => {
      const response = await request(app).get('/api/admin/snapshots')

      expect(response.status).toBe(401)
      expect(response.body.error.code).toBe('UNAUTHORIZED')
    })

    it('should reject requests with invalid admin token', async () => {
      const response = await request(app)
        .get('/api/admin/snapshots')
        .set('Authorization', 'Bearer invalid-token')

      expect(response.status).toBe(401)
      expect(response.body.error.code).toBe('UNAUTHORIZED')
    })

    it('should accept requests with valid admin token in header', async () => {
      mockSnapshotStore.listSnapshots.mockResolvedValue([])

      const response = await request(app)
        .get('/api/admin/snapshots')
        .set('Authorization', `Bearer ${validAdminToken}`)

      expect(response.status).toBe(200)
    })

    it('should accept requests with valid admin token in query', async () => {
      mockSnapshotStore.listSnapshots.mockResolvedValue([])

      const response = await request(app).get(
        `/api/admin/snapshots?token=${validAdminToken}`
      )

      expect(response.status).toBe(200)
    })

    it('should return 500 when ADMIN_TOKEN is not configured', async () => {
      delete process.env.ADMIN_TOKEN

      const response = await request(app)
        .get('/api/admin/snapshots')
        .set('Authorization', 'Bearer some-token')

      expect(response.status).toBe(500)
      expect(response.body.error.code).toBe('ADMIN_TOKEN_NOT_CONFIGURED')
    })
  })

  describe('GET /api/admin/snapshots', () => {
    it('should list snapshots without filters', async () => {
      const testMetadata = [
        createTestMetadata('1704067200000'),
        createTestMetadata('1704153600000'),
      ]
      mockSnapshotStore.listSnapshots.mockResolvedValue(testMetadata)

      const response = await request(app)
        .get('/api/admin/snapshots')
        .set('Authorization', `Bearer ${validAdminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.snapshots).toEqual(testMetadata)
      expect(response.body.metadata.total_count).toBe(2)
      expect(mockSnapshotStore.listSnapshots).toHaveBeenCalledWith(
        undefined,
        {}
      )
    })

    it('should list snapshots with filters', async () => {
      const testMetadata = [createTestMetadata('1704067200000')]
      mockSnapshotStore.listSnapshots.mockResolvedValue(testMetadata)

      const response = await request(app)
        .get('/api/admin/snapshots')
        .query({
          limit: '5',
          status: 'success',
          schema_version: '1.0.0',
          min_district_count: '1',
        })
        .set('Authorization', `Bearer ${validAdminToken}`)

      expect(response.status).toBe(200)
      expect(mockSnapshotStore.listSnapshots).toHaveBeenCalledWith(5, {
        status: 'success',
        schema_version: '1.0.0',
        min_district_count: 1,
      })
    })

    it('should handle snapshot listing errors', async () => {
      mockSnapshotStore.listSnapshots.mockRejectedValue(
        new Error('Database error')
      )

      const response = await request(app)
        .get('/api/admin/snapshots')
        .set('Authorization', `Bearer ${validAdminToken}`)

      expect(response.status).toBe(500)
      expect(response.body.error.code).toBe('SNAPSHOT_LISTING_FAILED')
    })
  })

  describe('GET /api/admin/snapshots/:snapshotId', () => {
    it('should inspect a specific snapshot', async () => {
      const testSnapshot = createTestSnapshot('1704067200000')
      mockSnapshotStore.getSnapshot.mockResolvedValue(testSnapshot)

      const response = await request(app)
        .get('/api/admin/snapshots/1704067200000')
        .set('Authorization', `Bearer ${validAdminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.inspection.snapshot_id).toBe('1704067200000')
      expect(response.body.inspection.status).toBe('success')
      expect(response.body.inspection.payload_summary.district_count).toBe(1)
      expect(mockSnapshotStore.getSnapshot).toHaveBeenCalledWith(
        '1704067200000'
      )
    })

    it('should return 404 for non-existent snapshot', async () => {
      mockSnapshotStore.getSnapshot.mockResolvedValue(null)

      const response = await request(app)
        .get('/api/admin/snapshots/nonexistent')
        .set('Authorization', `Bearer ${validAdminToken}`)

      expect(response.status).toBe(404)
      expect(response.body.error.code).toBe('SNAPSHOT_NOT_FOUND')
    })

    it('should handle snapshot inspection errors', async () => {
      mockSnapshotStore.getSnapshot.mockRejectedValue(new Error('Read error'))

      const response = await request(app)
        .get('/api/admin/snapshots/1704067200000')
        .set('Authorization', `Bearer ${validAdminToken}`)

      expect(response.status).toBe(500)
      expect(response.body.error.code).toBe('SNAPSHOT_INSPECTION_FAILED')
    })
  })

  describe('GET /api/admin/snapshots/:snapshotId/payload', () => {
    it('should return snapshot payload', async () => {
      const testSnapshot = createTestSnapshot('1704067200000')
      mockSnapshotStore.getSnapshot.mockResolvedValue(testSnapshot)

      const response = await request(app)
        .get('/api/admin/snapshots/1704067200000/payload')
        .set('Authorization', `Bearer ${validAdminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.snapshot_id).toBe('1704067200000')
      expect(response.body.payload).toEqual(testSnapshot.payload)
    })

    it('should return 404 for non-existent snapshot payload', async () => {
      mockSnapshotStore.getSnapshot.mockResolvedValue(null)

      const response = await request(app)
        .get('/api/admin/snapshots/nonexistent/payload')
        .set('Authorization', `Bearer ${validAdminToken}`)

      expect(response.status).toBe(404)
      expect(response.body.error.code).toBe('SNAPSHOT_NOT_FOUND')
    })
  })

  describe('GET /api/admin/snapshot-store/health', () => {
    it('should return snapshot store health information', async () => {
      const currentSnapshot = createTestSnapshot('1704067200000')
      const latestSnapshot = createTestSnapshot('1704153600000')
      const recentSnapshots = [
        createTestMetadata('1704153600000'),
        createTestMetadata('1704067200000'),
      ]

      mockSnapshotStore.isReady.mockResolvedValue(true)
      mockSnapshotStore.getLatestSuccessful.mockResolvedValue(currentSnapshot)
      mockSnapshotStore.getLatest.mockResolvedValue(latestSnapshot)
      mockSnapshotStore.listSnapshots.mockResolvedValue(recentSnapshots)

      const response = await request(app)
        .get('/api/admin/snapshot-store/health')
        .set('Authorization', `Bearer ${validAdminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.health.is_ready).toBe(true)
      expect(response.body.health.current_snapshot.snapshot_id).toBe(
        '1704067200000'
      )
      expect(response.body.health.recent_activity.total_snapshots).toBe(2)
      expect(response.body.health.recent_activity.successful_snapshots).toBe(2)
    })

    it('should handle health check errors', async () => {
      mockSnapshotStore.isReady.mockRejectedValue(new Error('Access error'))

      const response = await request(app)
        .get('/api/admin/snapshot-store/health')
        .set('Authorization', `Bearer ${validAdminToken}`)

      expect(response.status).toBe(500)
      expect(response.body.error.code).toBe('HEALTH_CHECK_FAILED')
    })
  })

  describe('GET /api/admin/snapshot-store/integrity', () => {
    it('should return integrity check results', async () => {
      const integrityResult = {
        isValid: true,
        corruptionIssues: [],
        recoveryRecommendations: [],
        validatedAt: new Date().toISOString(),
      }
      mockSnapshotStore.validateIntegrity.mockResolvedValue(integrityResult)

      const response = await request(app)
        .get('/api/admin/snapshot-store/integrity')
        .set('Authorization', `Bearer ${validAdminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.integrity.isValid).toBe(true)
    })

    it('should handle missing validateIntegrity method', async () => {
      // Remove the method to test fallback
      delete (mockSnapshotStore as Record<string, unknown>).validateIntegrity

      const response = await request(app)
        .get('/api/admin/snapshot-store/integrity')
        .set('Authorization', `Bearer ${validAdminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.integrity.isValid).toBe(true) // Default fallback
    })
  })

  describe('GET /api/admin/snapshot-store/performance', () => {
    it('should return performance metrics', async () => {
      const performanceMetrics = {
        totalReads: 100,
        cacheHits: 80,
        cacheMisses: 20,
        averageReadTime: 15.5,
        concurrentReads: 2,
        maxConcurrentReads: 5,
      }
      mockSnapshotStore.getPerformanceMetrics.mockReturnValue(
        performanceMetrics
      )

      const response = await request(app)
        .get('/api/admin/snapshot-store/performance')
        .set('Authorization', `Bearer ${validAdminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.performance.totalReads).toBe(100)
      expect(response.body.performance.cache_hit_rate_percent).toBe(80)
    })

    it('should handle missing getPerformanceMetrics method', async () => {
      // Remove the method to test fallback
      delete (mockSnapshotStore as Record<string, unknown>)
        .getPerformanceMetrics

      const response = await request(app)
        .get('/api/admin/snapshot-store/performance')
        .set('Authorization', `Bearer ${validAdminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.performance.totalReads).toBe(0) // Default fallback
    })
  })

  describe('POST /api/admin/snapshot-store/performance/reset', () => {
    it('should reset performance metrics', async () => {
      mockSnapshotStore.resetPerformanceMetrics.mockImplementation(() => {})

      const response = await request(app)
        .post('/api/admin/snapshot-store/performance/reset')
        .set('Authorization', `Bearer ${validAdminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(mockSnapshotStore.resetPerformanceMetrics).toHaveBeenCalled()
    })

    it('should handle missing resetPerformanceMetrics method', async () => {
      // Remove the method to test fallback
      delete (mockSnapshotStore as Record<string, unknown>)
        .resetPerformanceMetrics

      const response = await request(app)
        .post('/api/admin/snapshot-store/performance/reset')
        .set('Authorization', `Bearer ${validAdminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true) // Should still succeed
    })
  })
})
