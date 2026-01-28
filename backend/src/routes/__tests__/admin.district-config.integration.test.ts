/**
 * Integration tests for admin district configuration routes
 *
 * Tests the actual functionality with real services
 * to ensure the district configuration endpoints work correctly.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import request from 'supertest'
import express from 'express'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import adminRoutes from '../admin.js'

// Use vi.hoisted to ensure mock factory is available when vi.mock is hoisted
const { mockFactory, setTestCacheDir } = vi.hoisted(() => {
  let testCacheDir = ''
  const mockCacheConfigService = {
    getConfiguration: () => ({
      baseDirectory: testCacheDir,
      source: 'test',
      isConfigured: true,
      validationStatus: {
        isValid: true,
        isAccessible: true,
        isSecure: true,
      },
    }),
    getCacheDirectory: () => testCacheDir,
    initialize: () => Promise.resolve(),
  }
  return {
    mockFactory: {
      createCacheConfigService: () => mockCacheConfigService,
      createSnapshotStore: () => ({}), // Not used in district config tests
    },
    setTestCacheDir: (dir: string) => {
      testCacheDir = dir
    },
  }
})

// Mock the production service factory to use our test cache directory
let testCacheDir: string

vi.mock('../../services/ProductionServiceFactory.js', () => ({
  getProductionServiceFactory: () => mockFactory,
}))

// Mock the main index.js to prevent server initialization side effects
vi.mock('../../index.js', () => ({
  getUnifiedBackfillServiceInstance: vi.fn(),
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

describe('Admin District Configuration Integration', () => {
  let app: express.Application
  let tempDir: string
  let originalCacheDir: string | undefined

  beforeEach(async () => {
    // Create temporary directory for testing
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'district-config-integration-test-')
    )
    testCacheDir = tempDir
    setTestCacheDir(tempDir)

    // Set CACHE_DIR environment variable for StorageProviderFactory
    originalCacheDir = process.env['CACHE_DIR']
    process.env['CACHE_DIR'] = tempDir

    // Create test app
    app = express()
    app.use(express.json())
    app.use('/api/admin', adminRoutes)
  })

  afterEach(async () => {
    // Restore original CACHE_DIR
    if (originalCacheDir !== undefined) {
      process.env['CACHE_DIR'] = originalCacheDir
    } else {
      delete process.env['CACHE_DIR']
    }

    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('District Configuration Endpoints', () => {
    it('should return empty configuration initially', async () => {
      const response = await request(app).get('/api/admin/districts/config')

      expect(response.status).toBe(200)
      expect(response.body.configuration.configuredDistricts).toEqual([])
      expect(response.body.status.hasConfiguredDistricts).toBe(false)
      expect(response.body.status.totalDistricts).toBe(0)
    })

    it('should add districts to configuration', async () => {
      const response = await request(app)
        .post('/api/admin/districts/config')
        .send({
          districtIds: ['42', '15'],
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.message).toContain('added to configuration')
      expect(response.body.changes.action).toBe('add')
      expect(response.body.changes.districts).toEqual(['42', '15'])
      expect(response.body.configuration.configuredDistricts).toContain('42')
      expect(response.body.configuration.configuredDistricts).toContain('15')
    })

    it('should replace entire configuration', async () => {
      // First add some districts
      await request(app)
        .post('/api/admin/districts/config')
        .send({
          districtIds: ['42', '15'],
        })

      // Then replace with new configuration
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
      expect(response.body.configuration.configuredDistricts).toEqual([
        '100',
        '200',
      ])
    })

    it('should remove district from configuration', async () => {
      // First add some districts
      await request(app)
        .post('/api/admin/districts/config')
        .send({
          districtIds: ['42', '15'],
        })

      // Then remove one
      const response = await request(app).delete(
        '/api/admin/districts/config/15'
      )

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.message).toContain('removed from configuration')
      expect(response.body.changes.action).toBe('remove')
      expect(response.body.changes.district).toBe('15')
      expect(response.body.configuration.configuredDistricts).toEqual(['42'])
    })

    it('should return 404 for removing non-existent district', async () => {
      const response = await request(app).delete(
        '/api/admin/districts/config/999'
      )

      expect(response.status).toBe(404)
      expect(response.body.error.code).toBe('DISTRICT_NOT_CONFIGURED')
    })

    it('should validate district configuration', async () => {
      // Add some districts first
      await request(app)
        .post('/api/admin/districts/config')
        .send({
          districtIds: ['42', 'F'],
        })

      const response = await request(app)
        .post('/api/admin/districts/config/validate')
        .send({})

      expect(response.status).toBe(200)
      expect(response.body.validation.configuredDistricts).toEqual(['42', 'F'])
      expect(response.body.validation.validDistricts).toEqual(['42', 'F'])
      expect(response.body.validation.invalidDistricts).toEqual([])
    })

    it('should validate district configuration with all-districts data', async () => {
      // Add some districts, including an invalid one
      await request(app)
        .post('/api/admin/districts/config')
        .send({
          districtIds: ['42', '999'],
        })

      const response = await request(app)
        .post('/api/admin/districts/config/validate')
        .send({
          allDistrictIds: ['42', '15', 'F'],
        })

      expect(response.status).toBe(200)
      expect(response.body.validation.isValid).toBe(false)
      expect(response.body.validation.validDistricts).toEqual(['42'])
      expect(response.body.validation.invalidDistricts).toEqual(['999'])
      expect(response.body.validation.warnings).toHaveLength(1)
      expect(response.body.validation.warnings[0]).toContain('999')
    })

    it('should validate request body for POST', async () => {
      // Missing districtIds
      let response = await request(app)
        .post('/api/admin/districts/config')
        .send({})

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('MISSING_DISTRICT_IDS')

      // Invalid districtIds format
      response = await request(app).post('/api/admin/districts/config').send({
        districtIds: 'not-an-array',
      })

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('INVALID_DISTRICT_IDS_FORMAT')

      // Empty districtIds array
      response = await request(app).post('/api/admin/districts/config').send({
        districtIds: [],
      })

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('EMPTY_DISTRICT_IDS')

      // Invalid district ID
      response = await request(app)
        .post('/api/admin/districts/config')
        .send({
          districtIds: ['42', null],
        })

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('INVALID_DISTRICT_ID')
    })

    it('should handle invalid district ID formats', async () => {
      const response = await request(app)
        .post('/api/admin/districts/config')
        .send({
          districtIds: ['invalid-district-id-format'],
        })

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('INVALID_DISTRICT_ID_FORMAT')
    })

    it('should persist configuration across requests', async () => {
      // Add districts
      await request(app)
        .post('/api/admin/districts/config')
        .send({
          districtIds: ['42', 'F'],
        })

      // Verify they persist
      const response = await request(app).get('/api/admin/districts/config')

      expect(response.status).toBe(200)
      expect(response.body.configuration.configuredDistricts).toEqual([
        '42',
        'F',
      ])
      expect(response.body.status.hasConfiguredDistricts).toBe(true)
      expect(response.body.status.totalDistricts).toBe(2)
    })

    it('should provide enhanced validation with suggestions and collection info', async () => {
      // Add some districts including invalid ones
      await request(app)
        .post('/api/admin/districts/config')
        .send({
          districtIds: ['42', '41', '999'], // 42 valid, 41 close typo, 999 invalid
        })

      // Test enhanced validation
      const response = await request(app)
        .post('/api/admin/districts/config/validate')
        .send({
          allDistrictIds: ['42', '15', 'F'], // Available districts
        })

      expect(response.status).toBe(200)
      expect(response.body.validation.isValid).toBe(false)
      expect(response.body.validation.validDistricts).toEqual(['42'])
      expect(response.body.validation.invalidDistricts).toEqual(['41', '999'])

      // Check suggestions
      expect(response.body.validation.suggestions).toHaveLength(2)

      const suggestion41 = response.body.validation.suggestions.find(
        (s: { invalidId: string; suggestions: string[]; confidence: string }) =>
          s.invalidId === '41'
      )
      expect(suggestion41.suggestions).toContain('42')
      expect(suggestion41.confidence).toBe('high')

      const suggestion999 = response.body.validation.suggestions.find(
        (s: { invalidId: string; suggestions: string[]; confidence: string }) =>
          s.invalidId === '999'
      )
      expect(suggestion999.confidence).toBe('low')

      // Check warnings with suggestions
      expect(response.body.validation.warnings).toHaveLength(2)
      const warning41 = response.body.validation.warnings.find((w: string) =>
        w.includes('41')
      )
      expect(warning41).toContain('Did you mean')
      expect(warning41).toContain('(likely matches)')

      // Check collection info
      expect(response.body.validation.lastCollectionInfo).toHaveLength(3)
      const collectionInfo42 = response.body.validation.lastCollectionInfo.find(
        (info: {
          districtId: string
          status: string
          lastSuccessfulCollection: string | null
        }) => info.districtId === '42'
      )
      expect(collectionInfo42.status).toBe('valid')
      expect(collectionInfo42.lastSuccessfulCollection).toBeNull() // No snapshot store in test
    })

    it('should include collection info in GET endpoint', async () => {
      // Add districts
      await request(app)
        .post('/api/admin/districts/config')
        .send({
          districtIds: ['42', 'F'],
        })

      // Get configuration with validation info
      const response = await request(app).get('/api/admin/districts/config')

      expect(response.status).toBe(200)
      expect(response.body.validation).toBeDefined()
      expect(response.body.validation.lastCollectionInfo).toHaveLength(2)
      expect(response.body.validation.validDistricts).toEqual(['42', 'F'])
      expect(response.body.validation.invalidDistricts).toEqual([])
    })
  })
})
