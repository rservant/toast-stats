/**
 * Unit tests for admin snapshot routes
 *
 * Tests:
 * - List snapshots with filters
 * - Get snapshot details
 * - Get snapshot payload
 * - Error handling
 *
 * Requirements: 7.1
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { snapshotsRouter } from '../snapshots.js'
import { FileSnapshotStore } from '../../../services/SnapshotStore.js'
import { Snapshot } from '../../../types/snapshots.js'
import type { ISnapshotStorage } from '../../../types/storageInterfaces.js'

// Test snapshot store instance
let testSnapshotStore: FileSnapshotStore

// Mock the production service factory to use our test snapshot store
// Routes now use createSnapshotStorage() which returns ISnapshotStorage
const mockFactory = {
  createSnapshotStorage: () => testSnapshotStore as ISnapshotStorage,
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

describe('Snapshot Routes', () => {
  let app: express.Application
  let tempDir: string

  beforeEach(async () => {
    // Create unique temporary directory for test isolation
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), `snapshots-test-${uniqueId}-`)
    )

    // Create test snapshot store
    testSnapshotStore = new FileSnapshotStore({
      cacheDir: tempDir,
      maxSnapshots: 10,
      maxAgeDays: 7,
      enableCompression: false,
    })

    // Create test app with snapshot routes
    app = express()
    app.use(express.json())
    app.use('/api/admin', snapshotsRouter)
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
   * Uses ISO date format (YYYY-MM-DD) for snapshot IDs to match the new SnapshotStore implementation
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

  describe('GET /snapshots', () => {
    it('should list snapshots from store', async () => {
      // Create test snapshots with ISO date format
      const snapshot1 = createTestSnapshot('2024-01-01', 'success')
      const snapshot2 = createTestSnapshot('2024-01-02', 'success')

      await testSnapshotStore.writeSnapshot(snapshot1)
      await testSnapshotStore.writeSnapshot(snapshot2)

      const response = await request(app).get('/api/admin/snapshots')

      expect(response.status).toBe(200)
      expect(response.body.snapshots).toBeDefined()
      expect(response.body.snapshots.length).toBeGreaterThanOrEqual(2)
      expect(response.body.metadata.total_count).toBeGreaterThanOrEqual(2)
      expect(response.body.metadata.generated_at).toBeDefined()
    })

    it('should apply limit parameter', async () => {
      // Create multiple snapshots with ISO date format
      await testSnapshotStore.writeSnapshot(
        createTestSnapshot('2024-01-01', 'success')
      )
      await testSnapshotStore.writeSnapshot(
        createTestSnapshot('2024-01-02', 'success')
      )
      await testSnapshotStore.writeSnapshot(
        createTestSnapshot('2024-01-03', 'success')
      )

      const response = await request(app).get('/api/admin/snapshots?limit=2')

      expect(response.status).toBe(200)
      expect(response.body.snapshots.length).toBeLessThanOrEqual(2)
      expect(response.body.metadata.limit_applied).toBe(2)
    })

    it('should filter by status', async () => {
      // Create snapshots with different statuses
      await testSnapshotStore.writeSnapshot(
        createTestSnapshot('2024-01-01', 'success')
      )
      await testSnapshotStore.writeSnapshot(
        createTestSnapshot('2024-01-02', 'failed')
      )

      const response = await request(app).get(
        '/api/admin/snapshots?status=success'
      )

      expect(response.status).toBe(200)
      expect(response.body.snapshots.length).toBe(1)
      expect(response.body.snapshots[0].status).toBe('success')
      expect(response.body.metadata.filters_applied.status).toBe('success')
    })

    it('should return empty list when no snapshots exist', async () => {
      const response = await request(app).get('/api/admin/snapshots')

      expect(response.status).toBe(200)
      expect(response.body.snapshots).toEqual([])
      expect(response.body.metadata.total_count).toBe(0)
    })

    it('should include query duration in metadata', async () => {
      await testSnapshotStore.writeSnapshot(
        createTestSnapshot('2024-01-01', 'success')
      )

      const response = await request(app).get('/api/admin/snapshots')

      expect(response.status).toBe(200)
      expect(response.body.metadata.query_duration_ms).toBeDefined()
      expect(typeof response.body.metadata.query_duration_ms).toBe('number')
    })
  })

  describe('GET /snapshots/:snapshotId', () => {
    it('should return snapshot details', async () => {
      const testSnapshot = createTestSnapshot('2024-01-01', 'success', 2)
      await testSnapshotStore.writeSnapshot(testSnapshot)

      const response = await request(app).get('/api/admin/snapshots/2024-01-01')

      expect(response.status).toBe(200)
      expect(response.body.inspection.snapshot_id).toBe('2024-01-01')
      expect(response.body.inspection.status).toBe('success')
      expect(response.body.inspection.schema_version).toBe('1.0.0')
      expect(response.body.inspection.payload_summary.district_count).toBe(2)
      expect(response.body.metadata.operation_id).toBeDefined()
    })

    it('should return 404 for non-existent snapshot', async () => {
      const response = await request(app).get(
        '/api/admin/snapshots/nonexistent'
      )

      expect(response.status).toBe(404)
      expect(response.body.error.code).toBe('SNAPSHOT_NOT_FOUND')
      expect(response.body.error.message).toContain('nonexistent')
    })

    it('should include size analysis in inspection', async () => {
      const testSnapshot = createTestSnapshot('2024-01-01', 'success')
      await testSnapshotStore.writeSnapshot(testSnapshot)

      const response = await request(app).get('/api/admin/snapshots/2024-01-01')

      expect(response.status).toBe(200)
      expect(response.body.inspection.size_analysis).toBeDefined()
      expect(
        response.body.inspection.size_analysis.total_size_estimate
      ).toBeGreaterThan(0)
      expect(
        response.body.inspection.size_analysis.payload_size_estimate
      ).toBeGreaterThan(0)
    })

    it('should include district summaries in payload_summary', async () => {
      const testSnapshot = createTestSnapshot('2024-01-01', 'success', 2)
      await testSnapshotStore.writeSnapshot(testSnapshot)

      const response = await request(app).get('/api/admin/snapshots/2024-01-01')

      expect(response.status).toBe(200)
      expect(response.body.inspection.payload_summary.districts).toHaveLength(2)
      expect(
        response.body.inspection.payload_summary.districts[0].districtId
      ).toBe('100')
      expect(
        response.body.inspection.payload_summary.districts[0].club_count
      ).toBeDefined()
    })
  })

  describe('GET /snapshots/:snapshotId/payload', () => {
    it('should return full snapshot payload', async () => {
      const testSnapshot = createTestSnapshot('2024-01-01', 'success', 2)
      await testSnapshotStore.writeSnapshot(testSnapshot)

      const response = await request(app).get(
        '/api/admin/snapshots/2024-01-01/payload'
      )

      expect(response.status).toBe(200)
      expect(response.body.snapshot_id).toBe('2024-01-01')
      expect(response.body.status).toBe('success')
      expect(response.body.payload).toBeDefined()
      expect(response.body.payload.districts).toHaveLength(2)
    })

    it('should return 404 for non-existent snapshot payload', async () => {
      const response = await request(app).get(
        '/api/admin/snapshots/nonexistent/payload'
      )

      expect(response.status).toBe(404)
      expect(response.body.error.code).toBe('SNAPSHOT_NOT_FOUND')
    })

    it('should include retrieval metadata', async () => {
      const testSnapshot = createTestSnapshot('2024-01-01', 'success')
      await testSnapshotStore.writeSnapshot(testSnapshot)

      const response = await request(app).get(
        '/api/admin/snapshots/2024-01-01/payload'
      )

      expect(response.status).toBe(200)
      expect(response.body.metadata.retrieved_at).toBeDefined()
      expect(response.body.metadata.retrieval_duration_ms).toBeDefined()
    })

    it('should return created_at timestamp', async () => {
      const testSnapshot = createTestSnapshot('2024-01-01', 'success')
      await testSnapshotStore.writeSnapshot(testSnapshot)

      const response = await request(app).get(
        '/api/admin/snapshots/2024-01-01/payload'
      )

      expect(response.status).toBe(200)
      expect(response.body.created_at).toBeDefined()
    })
  })

  describe('Error Handling', () => {
    it('should handle store errors gracefully for list', async () => {
      // Create a mock that throws an error
      const originalCreateSnapshotStorage = mockFactory.createSnapshotStorage
      mockFactory.createSnapshotStorage = () =>
        ({
          listSnapshots: () => Promise.reject(new Error('Store unavailable')),
        }) as unknown as ISnapshotStorage

      const response = await request(app).get('/api/admin/snapshots')

      expect(response.status).toBe(500)
      expect(response.body.error.code).toBe('SNAPSHOT_LISTING_FAILED')
      expect(response.body.error.details).toContain('Store unavailable')

      // Restore original mock
      mockFactory.createSnapshotStorage = originalCreateSnapshotStorage
    })

    it('should handle store errors gracefully for get snapshot', async () => {
      const originalCreateSnapshotStorage = mockFactory.createSnapshotStorage
      mockFactory.createSnapshotStorage = () =>
        ({
          getSnapshot: () => Promise.reject(new Error('Read error')),
        }) as unknown as ISnapshotStorage

      const response = await request(app).get('/api/admin/snapshots/2024-01-01')

      expect(response.status).toBe(500)
      expect(response.body.error.code).toBe('SNAPSHOT_INSPECTION_FAILED')
      expect(response.body.error.details).toContain('Read error')

      // Restore original mock
      mockFactory.createSnapshotStorage = originalCreateSnapshotStorage
    })

    it('should handle store errors gracefully for get payload', async () => {
      const originalCreateSnapshotStorage = mockFactory.createSnapshotStorage
      mockFactory.createSnapshotStorage = () =>
        ({
          getSnapshot: () => Promise.reject(new Error('Payload read error')),
        }) as unknown as ISnapshotStorage

      const response = await request(app).get(
        '/api/admin/snapshots/2024-01-01/payload'
      )

      expect(response.status).toBe(500)
      expect(response.body.error.code).toBe('PAYLOAD_RETRIEVAL_FAILED')
      expect(response.body.error.details).toContain('Payload read error')

      // Restore original mock
      mockFactory.createSnapshotStorage = originalCreateSnapshotStorage
    })
  })
})
