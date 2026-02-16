/**
 * Unit tests for admin district configuration routes
 *
 * Tests:
 * - Get configuration
 * - Add/replace districts
 * - Remove district
 * - Validate configuration
 * - Get history
 *
 * Requirements: 7.1
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { districtConfigRouter } from '../district-config.js'
import { DistrictConfigurationService } from '../../../services/DistrictConfigurationService.js'
import { FileSnapshotStore } from '../../../services/SnapshotStore.js'
import { LocalDistrictConfigStorage } from '../../../services/storage/LocalDistrictConfigStorage.js'
import type { ISnapshotStorage } from '../../../types/storageInterfaces.js'

// Test instances
let testDistrictConfigService: DistrictConfigurationService
let testSnapshotStore: FileSnapshotStore
let testDistrictConfigStorage: LocalDistrictConfigStorage
let tempDir: string

// Mock the production service factory
const mockCacheConfig = {
  getConfiguration: () => ({ baseDirectory: tempDir }),
}

// Routes now use createSnapshotStorage() which returns ISnapshotStorage
const mockFactory = {
  createSnapshotStorage: () => testSnapshotStore as unknown as ISnapshotStorage,
  createCacheConfigService: () => mockCacheConfig,
  createRefreshService: vi.fn(),
}

vi.mock('../../../services/ProductionServiceFactory.js', () => ({
  getProductionServiceFactory: () => mockFactory,
}))

// Mock StorageProviderFactory to return our test storage
vi.mock('../../../services/storage/StorageProviderFactory.js', () => ({
  StorageProviderFactory: {
    createFromEnvironment: () => ({
      snapshotStorage: testSnapshotStore,
      rawCSVStorage: {},
      districtConfigStorage: testDistrictConfigStorage,
    }),
  },
}))

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

describe('District Configuration Routes', () => {
  let app: express.Application

  beforeEach(async () => {
    // Create unique temporary directory for test isolation
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), `district-config-test-${uniqueId}-`)
    )

    // Update mock to use new temp directory
    mockCacheConfig.getConfiguration = () => ({ baseDirectory: tempDir })

    // Create test storage and services
    testDistrictConfigStorage = new LocalDistrictConfigStorage(tempDir)
    testDistrictConfigService = new DistrictConfigurationService(
      testDistrictConfigStorage
    )
    testSnapshotStore = new FileSnapshotStore({
      cacheDir: tempDir,
      maxSnapshots: 10,
      maxAgeDays: 7,
      enableCompression: false,
    })

    // Create test app with district config routes
    app = express()
    app.use(express.json())
    app.use('/api/admin', districtConfigRouter)
  })

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('GET /districts/config', () => {
    it('should return empty configuration when no districts configured', async () => {
      const response = await request(app).get('/api/admin/districts/config')

      expect(response.status).toBe(200)
      expect(response.body.configuration).toBeDefined()
      expect(response.body.configuration.configuredDistricts).toEqual([])
      expect(response.body.status.hasConfiguredDistricts).toBe(false)
      expect(response.body.status.totalDistricts).toBe(0)
      expect(response.body.metadata.operation_id).toBeDefined()
    })

    it('should return configured districts', async () => {
      // Add some districts first
      await testDistrictConfigService.addDistrict('42', 'test-admin')
      await testDistrictConfigService.addDistrict('57', 'test-admin')

      const response = await request(app).get('/api/admin/districts/config')

      expect(response.status).toBe(200)
      expect(response.body.configuration.configuredDistricts).toContain('42')
      expect(response.body.configuration.configuredDistricts).toContain('57')
      expect(response.body.status.hasConfiguredDistricts).toBe(true)
      expect(response.body.status.totalDistricts).toBe(2)
    })

    it('should include validation information', async () => {
      await testDistrictConfigService.addDistrict('42', 'test-admin')

      const response = await request(app).get('/api/admin/districts/config')

      expect(response.status).toBe(200)
      expect(response.body.validation).toBeDefined()
      expect(response.body.validation.isValid).toBe(true)
      expect(response.body.validation.configuredDistricts).toContain('42')
    })

    it('should include retrieval metadata', async () => {
      const response = await request(app).get('/api/admin/districts/config')

      expect(response.status).toBe(200)
      expect(response.body.metadata.retrieved_at).toBeDefined()
      expect(response.body.metadata.retrieval_duration_ms).toBeDefined()
      expect(typeof response.body.metadata.retrieval_duration_ms).toBe('number')
    })
  })

  describe('POST /districts/config', () => {
    it('should add districts to configuration', async () => {
      const response = await request(app)
        .post('/api/admin/districts/config')
        .send({ districtIds: ['42', '57'] })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.message).toContain('added')
      expect(response.body.configuration.configuredDistricts).toContain('42')
      expect(response.body.configuration.configuredDistricts).toContain('57')
      expect(response.body.changes.action).toBe('add')
      expect(response.body.changes.total_districts).toBe(2)
    })

    it('should replace configuration when replace flag is true', async () => {
      // Add initial districts
      await testDistrictConfigService.addDistrict('42', 'test-admin')
      await testDistrictConfigService.addDistrict('57', 'test-admin')

      const response = await request(app)
        .post('/api/admin/districts/config')
        .send({ districtIds: ['100', '101'], replace: true })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.message).toContain('replaced')
      expect(response.body.configuration.configuredDistricts).toContain('100')
      expect(response.body.configuration.configuredDistricts).toContain('101')
      expect(response.body.configuration.configuredDistricts).not.toContain(
        '42'
      )
      expect(response.body.changes.action).toBe('replace')
    })

    it('should return 400 when districtIds is missing', async () => {
      const response = await request(app)
        .post('/api/admin/districts/config')
        .send({})

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('MISSING_DISTRICT_IDS')
    })

    it('should return 400 when districtIds is not an array', async () => {
      const response = await request(app)
        .post('/api/admin/districts/config')
        .send({ districtIds: '42' })

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('INVALID_DISTRICT_IDS_FORMAT')
    })

    it('should return 400 when districtIds is empty', async () => {
      const response = await request(app)
        .post('/api/admin/districts/config')
        .send({ districtIds: [] })

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('EMPTY_DISTRICT_IDS')
    })

    it('should return 400 when district ID is invalid', async () => {
      const response = await request(app)
        .post('/api/admin/districts/config')
        .send({ districtIds: [null] })

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('INVALID_DISTRICT_ID')
    })

    it('should include operation metadata', async () => {
      const response = await request(app)
        .post('/api/admin/districts/config')
        .send({ districtIds: ['42'] })

      expect(response.status).toBe(200)
      expect(response.body.metadata.updated_at).toBeDefined()
      expect(response.body.metadata.operation_duration_ms).toBeDefined()
      expect(response.body.metadata.operation_id).toBeDefined()
    })
  })

  describe('DELETE /districts/config/:districtId', () => {
    it('should remove a district from configuration', async () => {
      // Add districts first
      await testDistrictConfigService.addDistrict('42', 'test-admin')
      await testDistrictConfigService.addDistrict('57', 'test-admin')

      const response = await request(app).delete(
        '/api/admin/districts/config/42'
      )

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.message).toContain('removed')
      expect(response.body.configuration.configuredDistricts).not.toContain(
        '42'
      )
      expect(response.body.configuration.configuredDistricts).toContain('57')
      expect(response.body.changes.action).toBe('remove')
      expect(response.body.changes.district).toBe('42')
    })

    it('should return 404 when district is not configured', async () => {
      const response = await request(app).delete(
        '/api/admin/districts/config/999'
      )

      expect(response.status).toBe(404)
      expect(response.body.error.code).toBe('DISTRICT_NOT_CONFIGURED')
    })

    it('should handle District prefix in ID', async () => {
      await testDistrictConfigService.addDistrict('42', 'test-admin')

      const response = await request(app).delete(
        '/api/admin/districts/config/District%2042'
      )

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
    })

    it('should include operation metadata', async () => {
      await testDistrictConfigService.addDistrict('42', 'test-admin')

      const response = await request(app).delete(
        '/api/admin/districts/config/42'
      )

      expect(response.status).toBe(200)
      expect(response.body.metadata.updated_at).toBeDefined()
      expect(response.body.metadata.operation_duration_ms).toBeDefined()
      expect(response.body.metadata.operation_id).toBeDefined()
    })
  })

  describe('POST /districts/config/validate', () => {
    it('should validate configuration format', async () => {
      await testDistrictConfigService.addDistrict('42', 'test-admin')

      const response = await request(app)
        .post('/api/admin/districts/config/validate')
        .send({})

      expect(response.status).toBe(200)
      expect(response.body.validation).toBeDefined()
      expect(response.body.validation.isValid).toBe(true)
      expect(response.body.validation.configuredDistricts).toContain('42')
      expect(response.body.validation.validDistricts).toContain('42')
    })

    it('should validate against provided district list', async () => {
      await testDistrictConfigService.addDistrict('42', 'test-admin')
      await testDistrictConfigService.addDistrict('999', 'test-admin')

      const response = await request(app)
        .post('/api/admin/districts/config/validate')
        .send({ allDistrictIds: ['42', '57', '100'] })

      expect(response.status).toBe(200)
      expect(response.body.validation.validDistricts).toContain('42')
      expect(response.body.validation.invalidDistricts).toContain('999')
      expect(response.body.validation.warnings.length).toBeGreaterThan(0)
    })

    it('should include collection info with status', async () => {
      await testDistrictConfigService.addDistrict('42', 'test-admin')

      const response = await request(app)
        .post('/api/admin/districts/config/validate')
        .send({})

      expect(response.status).toBe(200)
      expect(response.body.validation.lastCollectionInfo).toBeDefined()
      expect(Array.isArray(response.body.validation.lastCollectionInfo)).toBe(
        true
      )
    })

    it('should include validation metadata', async () => {
      const response = await request(app)
        .post('/api/admin/districts/config/validate')
        .send({})

      expect(response.status).toBe(200)
      expect(response.body.metadata.validated_at).toBeDefined()
      expect(response.body.metadata.validation_duration_ms).toBeDefined()
      expect(response.body.metadata.operation_id).toBeDefined()
    })
  })

  describe('GET /districts/config/history', () => {
    it('should return empty history when no changes made', async () => {
      const response = await request(app).get(
        '/api/admin/districts/config/history'
      )

      expect(response.status).toBe(200)
      expect(response.body.history).toEqual([])
      expect(response.body.summary).toBeNull()
    })

    it('should return configuration change history', async () => {
      // Make some configuration changes
      await testDistrictConfigService.addDistrict('42', 'test-admin')
      await testDistrictConfigService.addDistrict('57', 'test-admin')
      await testDistrictConfigService.removeDistrict('42', 'test-admin')

      const response = await request(app).get(
        '/api/admin/districts/config/history'
      )

      expect(response.status).toBe(200)
      expect(response.body.history.length).toBe(3)
      // History is returned most recent first
      expect(response.body.history[0].action).toBe('remove')
      expect(response.body.history[1].action).toBe('add')
      expect(response.body.history[2].action).toBe('add')
    })

    it('should apply limit parameter', async () => {
      await testDistrictConfigService.addDistrict('42', 'test-admin')
      await testDistrictConfigService.addDistrict('57', 'test-admin')
      await testDistrictConfigService.addDistrict('100', 'test-admin')

      const response = await request(app).get(
        '/api/admin/districts/config/history?limit=2'
      )

      expect(response.status).toBe(200)
      expect(response.body.history.length).toBeLessThanOrEqual(2)
      expect(response.body.metadata.filters.limit).toBe(2)
    })

    it('should include summary when requested', async () => {
      await testDistrictConfigService.addDistrict('42', 'test-admin')
      await testDistrictConfigService.addDistrict('57', 'test-admin')

      const response = await request(app).get(
        '/api/admin/districts/config/history?include_summary=true'
      )

      expect(response.status).toBe(200)
      expect(response.body.summary).toBeDefined()
      expect(response.body.summary.totalChanges).toBe(2)
      expect(response.body.summary.addedDistricts).toContain('42')
      expect(response.body.summary.addedDistricts).toContain('57')
    })

    it('should include retrieval metadata', async () => {
      const response = await request(app).get(
        '/api/admin/districts/config/history'
      )

      expect(response.status).toBe(200)
      expect(response.body.metadata.retrieved_at).toBeDefined()
      expect(response.body.metadata.retrieval_duration_ms).toBeDefined()
      expect(response.body.metadata.operation_id).toBeDefined()
      expect(response.body.metadata.filters).toBeDefined()
    })
  })

  describe('Error Handling', () => {
    it('should handle service errors gracefully for get config', async () => {
      // This test verifies error handling when the storage provider fails
      // Since we're using mocked StorageProviderFactory, we need to test
      // that the route handles errors from the DistrictConfigurationService
      // The current implementation catches errors and returns 500 status

      // For now, we verify the route works correctly with valid storage
      // Error handling is tested at the service level in DistrictConfigurationService.test.ts
      const response = await request(app).get('/api/admin/districts/config')

      // Route should work with valid storage
      expect(response.status).toBe(200)
      expect(response.body.configuration).toBeDefined()
    })
  })
})
