/**
 * Unit tests for admin process separation routes
 *
 * Tests:
 * - Validate process separation
 * - Monitor concurrent operations
 * - Compliance metrics
 * - Independence validation
 *
 * Requirements: 7.1
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { processSeparationRouter } from '../process-separation.js'
import { FileSnapshotStore } from '../../../services/SnapshotStore.js'
import { Snapshot } from '../../../types/snapshots.js'
import type { ISnapshotStorage } from '../../../types/storageInterfaces.js'

// Test snapshot store instance
let testSnapshotStore: FileSnapshotStore

// Mock refresh service
const mockRefreshService = {
  refreshAllDistricts: vi.fn().mockResolvedValue({ success: true }),
  refreshDistrict: vi.fn().mockResolvedValue({ success: true }),
  getRefreshStatus: vi.fn().mockReturnValue({ isRefreshing: false }),
}

// Mock the production service factory to use our test snapshot store
// Routes now use createSnapshotStorage() which returns ISnapshotStorage
const mockFactory = {
  createSnapshotStorage: () => testSnapshotStore as unknown as ISnapshotStorage,
  createCacheConfigService: vi.fn(),
  createRefreshService: () => mockRefreshService,
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

describe('Process Separation Routes', () => {
  let app: express.Application
  let tempDir: string

  beforeEach(async () => {
    // Create unique temporary directory for test isolation
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), `process-sep-test-${uniqueId}-`)
    )

    // Create test snapshot store
    testSnapshotStore = new FileSnapshotStore({
      cacheDir: tempDir,
      maxSnapshots: 10,
      maxAgeDays: 7,
      enableCompression: false,
    })

    // Create test app with process separation routes
    app = express()
    app.use(express.json())
    app.use('/api/admin', processSeparationRouter)
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

  describe('GET /process-separation/validate', () => {
    it('should return validation results', async () => {
      // Create a test snapshot for the validator to read
      const testSnapshot = createTestSnapshot('1704067200000', 'success', 2)
      await testSnapshotStore.writeSnapshot(testSnapshot)

      const response = await request(app).get(
        '/api/admin/process-separation/validate'
      )

      expect(response.status).toBe(200)
      expect(response.body.validation).toBeDefined()
      expect(response.body.validation.isValid).toBeDefined()
      expect(response.body.metadata.validated_at).toBeDefined()
      expect(response.body.metadata.operation_id).toBeDefined()
    })

    it('should include validation duration in metadata', async () => {
      const testSnapshot = createTestSnapshot('1704067200000', 'success')
      await testSnapshotStore.writeSnapshot(testSnapshot)

      const response = await request(app).get(
        '/api/admin/process-separation/validate'
      )

      expect(response.status).toBe(200)
      expect(response.body.metadata.validation_duration_ms).toBeDefined()
      expect(typeof response.body.metadata.validation_duration_ms).toBe(
        'number'
      )
    })

    it('should return validation issues when present', async () => {
      const testSnapshot = createTestSnapshot('1704067200000', 'success')
      await testSnapshotStore.writeSnapshot(testSnapshot)

      const response = await request(app).get(
        '/api/admin/process-separation/validate'
      )

      expect(response.status).toBe(200)
      expect(response.body.validation.issues).toBeDefined()
      expect(Array.isArray(response.body.validation.issues)).toBe(true)
    })

    it('should include recommended actions in validation result', async () => {
      const testSnapshot = createTestSnapshot('1704067200000', 'success')
      await testSnapshotStore.writeSnapshot(testSnapshot)

      const response = await request(app).get(
        '/api/admin/process-separation/validate'
      )

      expect(response.status).toBe(200)
      expect(response.body.validation.recommendedActions).toBeDefined()
      expect(Array.isArray(response.body.validation.recommendedActions)).toBe(
        true
      )
    })

    it('should handle validation errors gracefully', async () => {
      // We need to mock at a level that causes the route handler to catch
      const originalCreateSnapshotStorage = mockFactory.createSnapshotStorage
      mockFactory.createSnapshotStorage = () => {
        throw new Error('Store unavailable')
      }

      const response = await request(app).get(
        '/api/admin/process-separation/validate'
      )

      expect(response.status).toBe(500)
      expect(response.body.error.code).toBe(
        'PROCESS_SEPARATION_VALIDATION_FAILED'
      )
      expect(response.body.error.details).toContain('Store unavailable')

      // Restore original mock
      mockFactory.createSnapshotStorage = originalCreateSnapshotStorage
    })
  })

  describe('GET /process-separation/monitor', () => {
    it('should return monitoring results', async () => {
      const testSnapshot = createTestSnapshot('1704067200000', 'success', 2)
      await testSnapshotStore.writeSnapshot(testSnapshot)

      const response = await request(app).get(
        '/api/admin/process-separation/monitor'
      )

      expect(response.status).toBe(200)
      expect(response.body.monitoring).toBeDefined()
      expect(response.body.monitoring.maxConcurrentReads).toBeDefined()
      expect(response.body.metadata.monitored_at).toBeDefined()
      expect(response.body.metadata.operation_id).toBeDefined()
    })

    it('should include read throughput in monitoring results', async () => {
      const testSnapshot = createTestSnapshot('1704067200000', 'success')
      await testSnapshotStore.writeSnapshot(testSnapshot)

      const response = await request(app).get(
        '/api/admin/process-separation/monitor'
      )

      expect(response.status).toBe(200)
      expect(response.body.monitoring.readThroughput).toBeDefined()
      // readThroughput can be a number or NaN (which is typeof 'number')
      expect(response.body.monitoring.readThroughput !== undefined).toBe(true)
    })

    it('should include average read time in monitoring results', async () => {
      const testSnapshot = createTestSnapshot('1704067200000', 'success')
      await testSnapshotStore.writeSnapshot(testSnapshot)

      const response = await request(app).get(
        '/api/admin/process-separation/monitor'
      )

      expect(response.status).toBe(200)
      expect(response.body.monitoring.averageReadTime).toBeDefined()
      expect(typeof response.body.monitoring.averageReadTime).toBe('number')
    })

    it('should include monitoring duration in metadata', async () => {
      const testSnapshot = createTestSnapshot('1704067200000', 'success')
      await testSnapshotStore.writeSnapshot(testSnapshot)

      const response = await request(app).get(
        '/api/admin/process-separation/monitor'
      )

      expect(response.status).toBe(200)
      expect(response.body.metadata.monitoring_duration_ms).toBeDefined()
      expect(typeof response.body.metadata.monitoring_duration_ms).toBe(
        'number'
      )
    })

    it('should handle monitoring errors gracefully', async () => {
      // The ProcessSeparationValidator catches errors internally and throws
      // We need to mock at a level that causes the route handler to catch
      const originalCreateSnapshotStorage = mockFactory.createSnapshotStorage
      mockFactory.createSnapshotStorage = () => {
        throw new Error('Monitoring failed')
      }

      const response = await request(app).get(
        '/api/admin/process-separation/monitor'
      )

      expect(response.status).toBe(500)
      expect(response.body.error.code).toBe(
        'PROCESS_SEPARATION_MONITORING_FAILED'
      )
      expect(response.body.error.details).toContain('Monitoring failed')

      // Restore original mock
      mockFactory.createSnapshotStorage = originalCreateSnapshotStorage
    })
  })

  describe('GET /process-separation/compliance', () => {
    it('should return compliance metrics', async () => {
      const testSnapshot = createTestSnapshot('1704067200000', 'success', 2)
      await testSnapshotStore.writeSnapshot(testSnapshot)

      const response = await request(app).get(
        '/api/admin/process-separation/compliance'
      )

      expect(response.status).toBe(200)
      expect(response.body.compliance).toBeDefined()
      expect(response.body.compliance.processSeparationScore).toBeDefined()
      expect(response.body.metadata.retrieved_at).toBeDefined()
      expect(response.body.metadata.operation_id).toBeDefined()
    })

    it('should include compliance status in results', async () => {
      const testSnapshot = createTestSnapshot('1704067200000', 'success')
      await testSnapshotStore.writeSnapshot(testSnapshot)

      const response = await request(app).get(
        '/api/admin/process-separation/compliance'
      )

      expect(response.status).toBe(200)
      expect(response.body.compliance.complianceStatus).toBeDefined()
      expect(['compliant', 'warning', 'non_compliant']).toContain(
        response.body.compliance.complianceStatus
      )
    })

    it('should include read operation health status', async () => {
      const testSnapshot = createTestSnapshot('1704067200000', 'success')
      await testSnapshotStore.writeSnapshot(testSnapshot)

      const response = await request(app).get(
        '/api/admin/process-separation/compliance'
      )

      expect(response.status).toBe(200)
      expect(response.body.compliance.readOperationHealth).toBeDefined()
      expect(['healthy', 'degraded', 'critical']).toContain(
        response.body.compliance.readOperationHealth
      )
    })

    it('should include refresh operation health status', async () => {
      const testSnapshot = createTestSnapshot('1704067200000', 'success')
      await testSnapshotStore.writeSnapshot(testSnapshot)

      const response = await request(app).get(
        '/api/admin/process-separation/compliance'
      )

      expect(response.status).toBe(200)
      expect(response.body.compliance.refreshOperationHealth).toBeDefined()
      expect(['healthy', 'degraded', 'critical']).toContain(
        response.body.compliance.refreshOperationHealth
      )
    })

    it('should include retrieval duration in metadata', async () => {
      const testSnapshot = createTestSnapshot('1704067200000', 'success')
      await testSnapshotStore.writeSnapshot(testSnapshot)

      const response = await request(app).get(
        '/api/admin/process-separation/compliance'
      )

      expect(response.status).toBe(200)
      expect(response.body.metadata.retrieval_duration_ms).toBeDefined()
      expect(typeof response.body.metadata.retrieval_duration_ms).toBe('number')
    })

    it('should handle compliance errors gracefully', async () => {
      // The ProcessSeparationValidator catches errors internally
      // We need to mock at a level that causes the route handler to catch
      const originalCreateSnapshotStorage = mockFactory.createSnapshotStorage
      mockFactory.createSnapshotStorage = () => {
        throw new Error('Compliance check failed')
      }

      const response = await request(app).get(
        '/api/admin/process-separation/compliance'
      )

      expect(response.status).toBe(500)
      expect(response.body.error.code).toBe(
        'PROCESS_SEPARATION_COMPLIANCE_FAILED'
      )
      expect(response.body.error.details).toContain('Compliance check failed')

      // Restore original mock
      mockFactory.createSnapshotStorage = originalCreateSnapshotStorage
    })
  })

  describe('GET /process-separation/independence', () => {
    it('should return independence validation results', async () => {
      const testSnapshot = createTestSnapshot('1704067200000', 'success', 2)
      await testSnapshotStore.writeSnapshot(testSnapshot)

      const response = await request(app).get(
        '/api/admin/process-separation/independence'
      )

      expect(response.status).toBe(200)
      expect(response.body.independence).toBeDefined()
      expect(response.body.independence.isIndependent).toBeDefined()
      expect(response.body.metadata.validated_at).toBeDefined()
      expect(response.body.metadata.operation_id).toBeDefined()
    })

    it('should include baseline read time in results', async () => {
      const testSnapshot = createTestSnapshot('1704067200000', 'success')
      await testSnapshotStore.writeSnapshot(testSnapshot)

      const response = await request(app).get(
        '/api/admin/process-separation/independence'
      )

      expect(response.status).toBe(200)
      expect(response.body.independence.baselineReadTime).toBeDefined()
      expect(typeof response.body.independence.baselineReadTime).toBe('number')
    })

    it('should include read time during refresh in results', async () => {
      const testSnapshot = createTestSnapshot('1704067200000', 'success')
      await testSnapshotStore.writeSnapshot(testSnapshot)

      const response = await request(app).get(
        '/api/admin/process-separation/independence'
      )

      expect(response.status).toBe(200)
      expect(response.body.independence.readTimeDuringRefresh).toBeDefined()
      expect(typeof response.body.independence.readTimeDuringRefresh).toBe(
        'number'
      )
    })

    it('should include performance degradation percentage', async () => {
      const testSnapshot = createTestSnapshot('1704067200000', 'success')
      await testSnapshotStore.writeSnapshot(testSnapshot)

      const response = await request(app).get(
        '/api/admin/process-separation/independence'
      )

      expect(response.status).toBe(200)
      expect(response.body.independence.performanceDegradation).toBeDefined()
      expect(typeof response.body.independence.performanceDegradation).toBe(
        'number'
      )
    })

    it('should include acceptable degradation threshold', async () => {
      const testSnapshot = createTestSnapshot('1704067200000', 'success')
      await testSnapshotStore.writeSnapshot(testSnapshot)

      const response = await request(app).get(
        '/api/admin/process-separation/independence'
      )

      expect(response.status).toBe(200)
      expect(
        response.body.independence.acceptableDegradationThreshold
      ).toBeDefined()
      expect(
        typeof response.body.independence.acceptableDegradationThreshold
      ).toBe('number')
    })

    it('should include validation duration in metadata', async () => {
      const testSnapshot = createTestSnapshot('1704067200000', 'success')
      await testSnapshotStore.writeSnapshot(testSnapshot)

      const response = await request(app).get(
        '/api/admin/process-separation/independence'
      )

      expect(response.status).toBe(200)
      expect(response.body.metadata.validation_duration_ms).toBeDefined()
      expect(typeof response.body.metadata.validation_duration_ms).toBe(
        'number'
      )
    })

    it('should handle independence validation errors gracefully', async () => {
      // The ProcessSeparationValidator catches errors internally
      // We need to mock at a level that causes the route handler to catch
      const originalCreateSnapshotStorage = mockFactory.createSnapshotStorage
      mockFactory.createSnapshotStorage = () => {
        throw new Error('Independence check failed')
      }

      const response = await request(app).get(
        '/api/admin/process-separation/independence'
      )

      expect(response.status).toBe(500)
      expect(response.body.error.code).toBe(
        'READ_PERFORMANCE_INDEPENDENCE_FAILED'
      )
      expect(response.body.error.details).toContain('Independence check failed')

      // Restore original mock
      mockFactory.createSnapshotStorage = originalCreateSnapshotStorage
    })
  })
})
