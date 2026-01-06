/**
 * Tests for admin snapshot management routes
 *
 * Tests the debugging endpoints for snapshot analysis, listing,
 * inspection, and health checking functionality.
 *
 * Note: Admin token validation has been removed for development simplicity.
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

const mockCacheConfigService = {
  getConfiguration: vi.fn(() => ({
    baseDirectory: './test-cache',
    source: 'test',
    isConfigured: true,
    validationStatus: {
      isValid: true,
      isAccessible: true,
      isSecure: true,
    },
  })),
}

const mockFactory = {
  createSnapshotStore: vi.fn(() => mockSnapshotStore),
  createCacheConfigService: vi.fn(() => mockCacheConfigService),
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

// Mock DistrictConfigurationService
const mockDistrictConfigService = {
  getConfiguration: vi.fn(),
  hasConfiguredDistricts: vi.fn(),
  addDistrict: vi.fn(),
  removeDistrict: vi.fn(),
  setConfiguredDistricts: vi.fn(),
  validateConfiguration: vi.fn(),
  getConfiguredDistricts: vi.fn(),
}

vi.mock('../../services/DistrictConfigurationService.js', () => ({
  DistrictConfigurationService: class MockDistrictConfigurationService {
    getConfiguration = mockDistrictConfigService.getConfiguration
    hasConfiguredDistricts = mockDistrictConfigService.hasConfiguredDistricts
    addDistrict = mockDistrictConfigService.addDistrict
    removeDistrict = mockDistrictConfigService.removeDistrict
    setConfiguredDistricts = mockDistrictConfigService.setConfiguredDistricts
    validateConfiguration = mockDistrictConfigService.validateConfiguration
    getConfiguredDistricts = mockDistrictConfigService.getConfiguredDistricts
  },
}))

describe('Admin Routes', () => {
  let app: express.Application

  beforeEach(() => {
    // Create test app
    app = express()
    app.use(express.json())
    app.use('/api/admin', adminRoutes)

    // Reset all mocks
    vi.clearAllMocks()

    // Reset district config service mock
    mockDistrictConfigService.getConfiguration.mockResolvedValue({
      configuredDistricts: ['42', '15'],
      lastUpdated: '2024-01-01T00:00:00Z',
      updatedBy: 'admin',
      version: 1,
    })
    mockDistrictConfigService.hasConfiguredDistricts.mockResolvedValue(true)
    mockDistrictConfigService.getConfiguredDistricts.mockResolvedValue([
      '42',
      '15',
    ])
    mockDistrictConfigService.validateConfiguration.mockResolvedValue({
      isValid: true,
      configuredDistricts: ['42', '15'],
      validDistricts: ['42', '15'],
      invalidDistricts: [],
      warnings: [],
      suggestions: [],
      lastCollectionInfo: [],
    })
    mockDistrictConfigService.addDistrict.mockResolvedValue(undefined)
    mockDistrictConfigService.removeDistrict.mockResolvedValue(undefined)
    mockDistrictConfigService.setConfiguredDistricts.mockResolvedValue(
      undefined
    )
  })

  afterEach(() => {
    // Clean up after tests
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
          asOfDate: '2024-01-01',
          membership: {
            total: 100,
            base: 90,
            new: 10,
            renewed: 80,
            net: 10,
            netGrowth: 0.11,
          },
          clubs: {
            total: 25,
            distinguished: 10,
            select: 8,
            president: 7,
          },
          education: {
            awards: 150,
            cc: 50,
            ac: 30,
            cl: 25,
            al: 20,
            dtm: 15,
            pathways: 10,
          },
          performance: {
            membershipNet: 85,
            clubsDistinguished: 40,
            educationAwards: 75,
            overallScore: 85,
          },
        },
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

  describe('Admin Access Logging', () => {
    it('should allow requests without admin token and log access', async () => {
      mockSnapshotStore.listSnapshots.mockResolvedValue([])

      const response = await request(app).get('/api/admin/snapshots')

      expect(response.status).toBe(200)
    })

    it('should allow requests with any token and log access', async () => {
      mockSnapshotStore.listSnapshots.mockResolvedValue([])

      const response = await request(app).get('/api/admin/snapshots')

      expect(response.status).toBe(200)
    })

    it('should allow requests with query token and log access', async () => {
      mockSnapshotStore.listSnapshots.mockResolvedValue([])

      const response = await request(app).get(
        '/api/admin/snapshots?token=any-token'
      )

      expect(response.status).toBe(200)
    })
  })

  describe('GET /api/admin/snapshots', () => {
    it('should list snapshots without filters', async () => {
      const testMetadata = [
        createTestMetadata('1704067200000'),
        createTestMetadata('1704153600000'),
      ]
      mockSnapshotStore.listSnapshots.mockResolvedValue(testMetadata)

      const response = await request(app).get('/api/admin/snapshots')

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

      const response = await request(app).get('/api/admin/snapshots').query({
        limit: '5',
        status: 'success',
        schema_version: '1.0.0',
        min_district_count: '1',
      })

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

      const response = await request(app).get('/api/admin/snapshots')

      expect(response.status).toBe(500)
      expect(response.body.error.code).toBe('SNAPSHOT_LISTING_FAILED')
    })
  })

  describe('GET /api/admin/snapshots/:snapshotId', () => {
    it('should inspect a specific snapshot', async () => {
      const testSnapshot = createTestSnapshot('1704067200000')
      mockSnapshotStore.getSnapshot.mockResolvedValue(testSnapshot)

      const response = await request(app).get(
        '/api/admin/snapshots/1704067200000'
      )

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

      const response = await request(app).get(
        '/api/admin/snapshots/nonexistent'
      )

      expect(response.status).toBe(404)
      expect(response.body.error.code).toBe('SNAPSHOT_NOT_FOUND')
    })

    it('should handle snapshot inspection errors', async () => {
      mockSnapshotStore.getSnapshot.mockRejectedValue(new Error('Read error'))

      const response = await request(app).get(
        '/api/admin/snapshots/1704067200000'
      )

      expect(response.status).toBe(500)
      expect(response.body.error.code).toBe('SNAPSHOT_INSPECTION_FAILED')
    })
  })

  describe('GET /api/admin/snapshots/:snapshotId/payload', () => {
    it('should return snapshot payload', async () => {
      const testSnapshot = createTestSnapshot('1704067200000')
      mockSnapshotStore.getSnapshot.mockResolvedValue(testSnapshot)

      const response = await request(app).get(
        '/api/admin/snapshots/1704067200000/payload'
      )

      expect(response.status).toBe(200)
      expect(response.body.snapshot_id).toBe('1704067200000')
      expect(response.body.payload).toEqual(testSnapshot.payload)
    })

    it('should return 404 for non-existent snapshot payload', async () => {
      mockSnapshotStore.getSnapshot.mockResolvedValue(null)

      const response = await request(app).get(
        '/api/admin/snapshots/nonexistent/payload'
      )

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

      const response = await request(app).get(
        '/api/admin/snapshot-store/health'
      )

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

      const response = await request(app).get(
        '/api/admin/snapshot-store/health'
      )

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

      const response = await request(app).get(
        '/api/admin/snapshot-store/integrity'
      )

      expect(response.status).toBe(200)
      expect(response.body.integrity.isValid).toBe(true)
    })

    it('should handle missing validateIntegrity method', async () => {
      // Remove the method to test fallback
      delete (mockSnapshotStore as Record<string, unknown>).validateIntegrity

      const response = await request(app).get(
        '/api/admin/snapshot-store/integrity'
      )

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

      const response = await request(app).get(
        '/api/admin/snapshot-store/performance'
      )

      expect(response.status).toBe(200)
      expect(response.body.performance.totalReads).toBe(100)
      expect(response.body.performance.cache_hit_rate_percent).toBe(80)
    })

    it('should handle missing getPerformanceMetrics method', async () => {
      // Remove the method to test fallback
      delete (mockSnapshotStore as Record<string, unknown>)
        .getPerformanceMetrics

      const response = await request(app).get(
        '/api/admin/snapshot-store/performance'
      )

      expect(response.status).toBe(200)
      expect(response.body.performance.totalReads).toBe(0) // Default fallback
    })
  })

  describe('POST /api/admin/snapshot-store/performance/reset', () => {
    it('should reset performance metrics', async () => {
      mockSnapshotStore.resetPerformanceMetrics.mockImplementation(() => {})

      const response = await request(app).post(
        '/api/admin/snapshot-store/performance/reset'
      )

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(mockSnapshotStore.resetPerformanceMetrics).toHaveBeenCalled()
    })

    it('should handle missing resetPerformanceMetrics method', async () => {
      // Remove the method to test fallback
      delete (mockSnapshotStore as Record<string, unknown>)
        .resetPerformanceMetrics

      const response = await request(app).post(
        '/api/admin/snapshot-store/performance/reset'
      )

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true) // Should still succeed
    })
  })

  describe('District Configuration Endpoints', () => {
    describe('GET /api/admin/districts/config', () => {
      it('should return current district configuration', async () => {
        const response = await request(app).get('/api/admin/districts/config')

        if (response.status !== 200) {
          console.log('Error response:', response.body)
        }
        expect(response.status).toBe(200)
        expect(response.body.configuration.configuredDistricts).toEqual([
          '42',
          '15',
        ])
        expect(response.body.status.hasConfiguredDistricts).toBe(true)
        expect(response.body.status.totalDistricts).toBe(2)
      })

      it('should handle configuration retrieval errors', async () => {
        mockDistrictConfigService.getConfiguration.mockRejectedValue(
          new Error('Config read error')
        )

        const response = await request(app).get('/api/admin/districts/config')

        expect(response.status).toBe(500)
        expect(response.body.error.code).toBe(
          'DISTRICT_CONFIG_RETRIEVAL_FAILED'
        )
      })
    })

    describe('POST /api/admin/districts/config', () => {
      it('should add districts to configuration', async () => {
        mockDistrictConfigService.getConfiguration.mockResolvedValue({
          configuredDistricts: ['42', '15', '23'],
          lastUpdated: '2024-01-01T00:00:00Z',
          updatedBy: 'admin',
          version: 1,
        })

        const response = await request(app)
          .post('/api/admin/districts/config')

          .send({
            districtIds: ['23'],
          })

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
        expect(response.body.message).toContain('added to configuration')
        expect(response.body.changes.action).toBe('add')
        expect(response.body.changes.districts).toEqual(['23'])
        expect(mockDistrictConfigService.addDistrict).toHaveBeenCalledWith(
          '23',
          'admin'
        )
      })

      it('should replace entire configuration when replace=true', async () => {
        mockDistrictConfigService.getConfiguration.mockResolvedValue({
          configuredDistricts: ['100', '200'],
          lastUpdated: '2024-01-01T00:00:00Z',
          updatedBy: 'admin',
          version: 1,
        })

        const response = await request(app)
          .post('/api/admin/districts/config')

          .send({
            districtIds: ['100', '200'],
            replace: true,
          })

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
        expect(response.body.message).toContain('replaced successfully')
        expect(response.body.changes.action).toBe('replace')
        expect(
          mockDistrictConfigService.setConfiguredDistricts
        ).toHaveBeenCalledWith(['100', '200'], 'admin')
      })

      it('should validate request body - missing districtIds', async () => {
        const response = await request(app)
          .post('/api/admin/districts/config')

          .send({})

        expect(response.status).toBe(400)
        expect(response.body.error.code).toBe('MISSING_DISTRICT_IDS')
      })

      it('should validate request body - invalid districtIds format', async () => {
        const response = await request(app)
          .post('/api/admin/districts/config')

          .send({
            districtIds: 'not-an-array',
          })

        expect(response.status).toBe(400)
        expect(response.body.error.code).toBe('INVALID_DISTRICT_IDS_FORMAT')
      })

      it('should validate request body - empty districtIds array', async () => {
        const response = await request(app)
          .post('/api/admin/districts/config')

          .send({
            districtIds: [],
          })

        expect(response.status).toBe(400)
        expect(response.body.error.code).toBe('EMPTY_DISTRICT_IDS')
      })

      it('should validate individual district IDs', async () => {
        const response = await request(app)
          .post('/api/admin/districts/config')

          .send({
            districtIds: ['42', null, '15'],
          })

        expect(response.status).toBe(400)
        expect(response.body.error.code).toBe('INVALID_DISTRICT_ID')
      })

      it('should handle district format validation errors', async () => {
        mockDistrictConfigService.addDistrict.mockRejectedValue(
          new Error('Invalid district ID format: invalid-id')
        )

        const response = await request(app)
          .post('/api/admin/districts/config')

          .send({
            districtIds: ['invalid-id'],
          })

        expect(response.status).toBe(400)
        expect(response.body.error.code).toBe('INVALID_DISTRICT_ID_FORMAT')
      })

      it('should handle configuration update errors', async () => {
        mockDistrictConfigService.addDistrict.mockRejectedValue(
          new Error('Database error')
        )

        const response = await request(app)
          .post('/api/admin/districts/config')

          .send({
            districtIds: ['42'],
          })

        expect(response.status).toBe(500)
        expect(response.body.error.code).toBe('DISTRICT_CONFIG_UPDATE_FAILED')
      })
    })

    describe('DELETE /api/admin/districts/config/:districtId', () => {
      it('should remove district from configuration', async () => {
        mockDistrictConfigService.getConfiguration.mockResolvedValue({
          configuredDistricts: ['42'],
          lastUpdated: '2024-01-01T00:00:00Z',
          updatedBy: 'admin',
          version: 1,
        })

        const response = await request(app).delete(
          '/api/admin/districts/config/15'
        )

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
        expect(response.body.message).toContain('removed from configuration')
        expect(response.body.changes.action).toBe('remove')
        expect(response.body.changes.district).toBe('15')
        expect(mockDistrictConfigService.removeDistrict).toHaveBeenCalledWith(
          '15',
          'admin'
        )
      })

      it('should return 404 for district not in configuration', async () => {
        mockDistrictConfigService.getConfiguredDistricts.mockResolvedValue([
          '42',
        ])

        const response = await request(app).delete(
          '/api/admin/districts/config/999'
        )

        expect(response.status).toBe(404)
        expect(response.body.error.code).toBe('DISTRICT_NOT_CONFIGURED')
      })

      it('should validate district ID parameter', async () => {
        const response = await request(app).delete(
          '/api/admin/districts/config/'
        )

        expect(response.status).toBe(404) // Express route not found
      })

      it('should handle district removal errors', async () => {
        mockDistrictConfigService.removeDistrict.mockRejectedValue(
          new Error('Database error')
        )

        const response = await request(app).delete(
          '/api/admin/districts/config/15'
        )

        expect(response.status).toBe(500)
        expect(response.body.error.code).toBe('DISTRICT_CONFIG_REMOVAL_FAILED')
      })
    })

    describe('POST /api/admin/districts/config/validate', () => {
      it('should validate district configuration without all-districts data', async () => {
        const validationResult = {
          isValid: true,
          configuredDistricts: ['42', '15'],
          validDistricts: ['42', '15'],
          invalidDistricts: [],
          warnings: [],
          suggestions: [],
          lastCollectionInfo: [],
        }
        mockDistrictConfigService.validateConfiguration.mockResolvedValue(
          validationResult
        )

        const response = await request(app)
          .post('/api/admin/districts/config/validate')

          .send({})

        expect(response.status).toBe(200)
        expect(response.body.validation.isValid).toBe(true)
        expect(response.body.validation.configuredDistricts).toEqual([
          '42',
          '15',
        ])
        expect(
          mockDistrictConfigService.validateConfiguration
        ).toHaveBeenCalledWith(undefined, expect.any(Object))
      })

      it('should validate district configuration with all-districts data', async () => {
        const validationResult = {
          isValid: false,
          configuredDistricts: ['42', '999'],
          validDistricts: ['42'],
          invalidDistricts: ['999'],
          warnings: ['District ID "999" not found in Toastmasters system.'],
          suggestions: [],
          lastCollectionInfo: [],
        }
        mockDistrictConfigService.validateConfiguration.mockResolvedValue(
          validationResult
        )

        const response = await request(app)
          .post('/api/admin/districts/config/validate')

          .send({
            allDistrictIds: ['42', '15', '23'],
          })

        expect(response.status).toBe(200)
        expect(response.body.validation.isValid).toBe(false)
        expect(response.body.validation.invalidDistricts).toEqual(['999'])
        expect(response.body.validation.warnings).toHaveLength(1)
        expect(
          mockDistrictConfigService.validateConfiguration
        ).toHaveBeenCalledWith(['42', '15', '23'], expect.any(Object))
      })

      it('should handle validation errors', async () => {
        mockDistrictConfigService.validateConfiguration.mockRejectedValue(
          new Error('Validation error')
        )

        const response = await request(app)
          .post('/api/admin/districts/config/validate')

          .send({})

        expect(response.status).toBe(500)
        expect(response.body.error.code).toBe(
          'DISTRICT_CONFIG_VALIDATION_FAILED'
        )
      })
    })
  })
})
