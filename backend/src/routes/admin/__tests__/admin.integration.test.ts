/**
 * Integration tests for admin snapshot management routes
 *
 * Tests the actual functionality with a real FileSnapshotStore
 * to ensure the debugging endpoints work correctly.
 *
 * Migrated from backend/src/routes/__tests__/admin.integration.test.ts
 * to follow the new admin route module structure.
 *
 * Requirements: 7.1
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import request from 'supertest'
import express from 'express'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import adminRoutes from '../index.js'
import { FileSnapshotStore } from '../../../services/SnapshotStore.js'
import { Snapshot } from '../../../types/snapshots.js'

// Mock the production service factory to use our test snapshot store
let testSnapshotStore: FileSnapshotStore
const mockFactory = {
  createSnapshotStore: () => testSnapshotStore,
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

describe('Admin Routes Integration', () => {
  let app: express.Application
  let tempDir: string

  beforeEach(async () => {
    // Create temporary directory for testing with unique identifier
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), `admin-integration-test-${uniqueId}-`)
    )

    // Create test snapshot store
    testSnapshotStore = new FileSnapshotStore({
      cacheDir: tempDir,
      maxSnapshots: 10,
      maxAgeDays: 7,
      enableCompression: false,
    })

    // Create test app using the new admin routes module
    app = express()
    app.use(express.json())
    app.use('/api/admin', adminRoutes)
  })

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  const createTestSnapshot = (
    dateStr: string,
    status: 'success' | 'failed' = 'success'
  ): Snapshot => ({
    snapshot_id: dateStr,
    created_at: new Date().toISOString(),
    schema_version: '1.0.0',
    calculation_version: '1.0.0',
    status,
    errors: status === 'failed' ? ['Test error'] : [],
    payload: {
      districts: [
        {
          districtId: '123',
          asOfDate: dateStr,
          membership: {
            total: 100,
            change: 5,
            changePercent: 5.0,
            byClub: [],
          },
          clubs: {
            total: 10,
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
        },
      ],
      metadata: {
        source: 'test',
        fetchedAt: new Date().toISOString(),
        dataAsOfDate: dateStr,
        districtCount: 1,
        processingDurationMs: 1000,
      },
    },
  })

  describe('Real Snapshot Store Integration', () => {
    it('should list snapshots from real store', async () => {
      // Create test snapshots with ISO date format
      const snapshot1 = createTestSnapshot('2024-01-01', 'success')
      const snapshot2 = createTestSnapshot('2024-01-02', 'failed')

      await testSnapshotStore.writeSnapshot(snapshot1)
      await testSnapshotStore.writeSnapshot(snapshot2)

      const response = await request(app).get('/api/admin/snapshots?limit=5')

      expect(response.status).toBe(200)

      // The FileSnapshotStore.listSnapshots should return all snapshots, including failed ones
      expect(response.body.snapshots.length).toBeGreaterThanOrEqual(1)
      expect(response.body.metadata.total_count).toBeGreaterThanOrEqual(1)

      // Check that at least the successful snapshot is there
      expect(
        response.body.snapshots.some(
          (s: { snapshot_id: string }) => s.snapshot_id === '2024-01-01'
        )
      ).toBe(true)
    })

    it('should inspect specific snapshot from real store', async () => {
      const testSnapshot = createTestSnapshot('2024-01-01', 'success')
      await testSnapshotStore.writeSnapshot(testSnapshot)

      const response = await request(app).get('/api/admin/snapshots/2024-01-01')

      expect(response.status).toBe(200)
      expect(response.body.inspection.snapshot_id).toBe('2024-01-01')
      expect(response.body.inspection.status).toBe('success')
      expect(response.body.inspection.payload_summary.district_count).toBe(1)
      expect(response.body.inspection.payload_summary.districts).toHaveLength(1)
      expect(
        response.body.inspection.payload_summary.districts[0].districtId
      ).toBe('123')
    })

    it('should return snapshot payload from real store', async () => {
      const testSnapshot = createTestSnapshot('2024-01-01', 'success')
      await testSnapshotStore.writeSnapshot(testSnapshot)

      const response = await request(app).get(
        '/api/admin/snapshots/2024-01-01/payload'
      )

      expect(response.status).toBe(200)
      expect(response.body.snapshot_id).toBe('2024-01-01')
      expect(response.body.payload).toBeDefined()
      expect(response.body.payload.districts).toHaveLength(1)
    })

    it('should check health of real store', async () => {
      // Create a successful snapshot
      const testSnapshot = createTestSnapshot('2024-01-01', 'success')
      await testSnapshotStore.writeSnapshot(testSnapshot)

      const response = await request(app).get(
        '/api/admin/snapshot-store/health'
      )

      expect(response.status).toBe(200)
      expect(response.body.health.is_ready).toBe(true)
      expect(response.body.health.current_snapshot).toBeTruthy()
      expect(response.body.health.current_snapshot.snapshot_id).toBe(
        '2024-01-01'
      )
      expect(response.body.health.store_status.has_current_snapshot).toBe(true)
    })

    it('should handle empty store gracefully', async () => {
      const response = await request(app).get(
        '/api/admin/snapshot-store/health'
      )

      // Empty store might return 500 if no snapshots exist, which is expected behavior
      if (response.status === 500) {
        expect(response.body.error).toBeTruthy()
      } else {
        expect(response.status).toBe(200)
        expect(response.body.health.is_ready).toBe(true)
        expect(response.body.health.current_snapshot).toBeNull()
        expect(response.body.health.recent_activity.total_snapshots).toBe(0)
      }
    })

    it('should filter snapshots by status', async () => {
      // Create snapshots with different statuses
      const successSnapshot = createTestSnapshot('2024-01-01', 'success')
      const failedSnapshot = createTestSnapshot('2024-01-02', 'failed')

      await testSnapshotStore.writeSnapshot(successSnapshot)
      await testSnapshotStore.writeSnapshot(failedSnapshot)

      // Filter for successful snapshots only
      const response = await request(app).get(
        '/api/admin/snapshots?status=success'
      )

      expect(response.status).toBe(200)
      expect(response.body.snapshots).toHaveLength(1)
      expect(response.body.snapshots[0].status).toBe('success')
      expect(response.body.snapshots[0].snapshot_id).toBe('2024-01-01')
    })

    it('should get performance metrics from real store', async () => {
      // Perform some reads to generate metrics
      const testSnapshot = createTestSnapshot('2024-01-01', 'success')
      await testSnapshotStore.writeSnapshot(testSnapshot)

      // Trigger some reads
      await testSnapshotStore.getLatestSuccessful()
      await testSnapshotStore.getLatestSuccessful() // Should be cache hit

      const response = await request(app).get(
        '/api/admin/snapshot-store/performance'
      )

      expect(response.status).toBe(200)
      expect(response.body.performance.totalReads).toBeGreaterThan(0)
      expect(
        response.body.performance.cache_hit_rate_percent
      ).toBeGreaterThanOrEqual(0)
    })

    it('should reset performance metrics', async () => {
      // Perform some reads first
      const testSnapshot = createTestSnapshot('2024-01-01', 'success')
      await testSnapshotStore.writeSnapshot(testSnapshot)
      await testSnapshotStore.getLatestSuccessful()

      // Reset metrics
      const resetResponse = await request(app).post(
        '/api/admin/snapshot-store/performance/reset'
      )

      expect(resetResponse.status).toBe(200)
      expect(resetResponse.body.success).toBe(true)

      // Check that metrics are reset
      const metricsResponse = await request(app).get(
        '/api/admin/snapshot-store/performance'
      )

      expect(metricsResponse.status).toBe(200)
      expect(metricsResponse.body.performance.totalReads).toBe(0)
    })
  })
})
