/**
 * Unit Tests for Admin API Path Preservation
 *
 * Verifies that all admin API endpoints are registered, respond with
 * consistent structure, and handle errors properly.
 *
 * Converted from property-based tests — PBT used fc.constantFrom() over
 * fixed endpoint lists and fc.integer for limit params, replaced with
 * deterministic test cases.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import express, { type Express } from 'express'
import request from 'supertest'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import adminRoutes from '../index.js'
import { FileSnapshotStore } from '../../../services/SnapshotStore.js'
import { Snapshot } from '../../../types/snapshots.js'

let testSnapshotStore: FileSnapshotStore
let tempDir: string

const { mockFactory, setTestSnapshotStore, setTempDir } = vi.hoisted(() => {
  let hoistedSnapshotStore: unknown = null
  let hoistedTempDir = ''
  return {
    mockFactory: {
      createSnapshotStorage: () => hoistedSnapshotStore,
      createCacheConfigService: () => ({
        getConfiguration: () => ({
          baseDirectory: hoistedTempDir,
          source: 'test',
          isConfigured: true,
          validationStatus: {
            isValid: true,
            isAccessible: true,
            isSecure: true,
          },
        }),
        getCacheDirectory: () => hoistedTempDir,
        initialize: () => Promise.resolve(),
      }),
      createRefreshService: () => ({
        isRefreshing: () => false,
        getLastRefreshTime: () => null,
      }),
    },
    setTestSnapshotStore: (store: unknown) => {
      hoistedSnapshotStore = store
    },
    setTempDir: (dir: string) => {
      hoistedTempDir = dir
    },
  }
})

vi.mock('../../../services/ProductionServiceFactory.js', () => ({
  getProductionServiceFactory: () => mockFactory,
}))

vi.mock('../../../index.js', () => ({
  getUnifiedBackfillServiceInstance: vi.fn(),
}))

vi.mock('../../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('../../../services/ProcessSeparationValidator.js', () => ({
  ProcessSeparationValidator: class MockProcessSeparationValidator {
    validateProcessSeparation = vi.fn().mockResolvedValue({
      isValid: true,
      issues: [],
      recommendations: [],
    })
    monitorConcurrentOperations = vi.fn().mockResolvedValue({
      maxConcurrentReads: 5,
      readThroughput: 100,
      writeLatency: 10,
    })
    getComplianceMetrics = vi.fn().mockResolvedValue({
      processSeparationScore: 100,
      complianceStatus: 'compliant',
      lastChecked: new Date().toISOString(),
    })
    validateReadPerformanceIndependence = vi.fn().mockResolvedValue({
      isIndependent: true,
      performanceDegradation: 0,
      baselineLatency: 5,
      concurrentLatency: 5,
    })
  },
}))

describe('Admin API Path Preservation', () => {
  let app: Express

  const createTestSnapshot = (
    dateStr: string,
    status: 'success' | 'partial' | 'failed' = 'success'
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
          education: { totalAwards: 25, byType: [], topClubs: [] },
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

  beforeEach(async () => {
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), `api-equiv-test-${uniqueId}-`)
    )
    setTempDir(tempDir)

    testSnapshotStore = new FileSnapshotStore({
      cacheDir: tempDir,
      maxSnapshots: 10,
      maxAgeDays: 7,
      enableCompression: false,
    })
    setTestSnapshotStore(testSnapshotStore)

    app = express()
    app.use(express.json())
    app.use('/api/admin', adminRoutes)
  })

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore
    }
  })

  it('should have all expected admin routes registered', () => {
    expect(adminRoutes).toBeDefined()
    expect(typeof adminRoutes).toBe('function')
    const routerStack = (adminRoutes as express.Router).stack
    expect(routerStack.length).toBeGreaterThanOrEqual(4)
  })

  it('should respond with consistent structure for snapshot list endpoint', async () => {
    await testSnapshotStore.writeSnapshot(
      createTestSnapshot('2024-01-01', 'success')
    )

    for (const limit of [1, 10, 50]) {
      const response = await request(app).get(
        `/api/admin/snapshots?limit=${limit}`
      )

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('snapshots')
      expect(response.body).toHaveProperty('metadata')
      expect(Array.isArray(response.body.snapshots)).toBe(true)
      expect(response.body.metadata).toHaveProperty('total_count')
      expect(response.body.metadata).toHaveProperty('generated_at')
      expect(response.body.metadata).toHaveProperty('limit_applied')
    }
  })

  it.each(['abc123', 'nonexistent', 'XYZ99'])(
    'should return 404 with standard error for non-existent snapshot ID: %s',
    async invalidSnapshotId => {
      const response = await request(app).get(
        `/api/admin/snapshots/${invalidSnapshotId}`
      )

      expect(response.status).toBe(404)
      expect(response.body.error.code).toBe('SNAPSHOT_NOT_FOUND')
      expect(response.body.error).toHaveProperty('message')
    }
  )

  it('should respond with consistent structure for snapshot detail', async () => {
    const snapshotIds = ['2024-01-01', '2024-01-02', '2024-01-03']
    for (const id of snapshotIds) {
      await testSnapshotStore.writeSnapshot(createTestSnapshot(id, 'success'))
    }

    // Verify all snapshots are readable before making HTTP requests
    for (const id of snapshotIds) {
      const snapshot = await testSnapshotStore.getSnapshot(id)
      expect(
        snapshot,
        `Snapshot ${id} should be readable after write`
      ).not.toBeNull()
    }

    for (const snapshotId of snapshotIds) {
      const response = await request(app).get(
        `/api/admin/snapshots/${snapshotId}`
      )

      expect(
        response.status,
        `Expected 200 for snapshot ${snapshotId}, got ${response.status}: ${JSON.stringify(response.body)}`
      ).toBe(200)
      expect(response.body).toHaveProperty('inspection')
      expect(response.body).toHaveProperty('metadata')
      expect(response.body.inspection).toHaveProperty('snapshot_id')
      expect(response.body.inspection).toHaveProperty('status')
      expect(response.body.inspection).toHaveProperty('payload_summary')
      expect(response.body.metadata).toHaveProperty('operation_id')
    }
  })

  it('should respond with consistent structure for snapshot payload', async () => {
    const snapshotId = '2024-01-01'
    await testSnapshotStore.writeSnapshot(
      createTestSnapshot(snapshotId, 'success')
    )

    const response = await request(app).get(
      `/api/admin/snapshots/${snapshotId}/payload`
    )

    expect(response.status).toBe(200)
    expect(response.body).toHaveProperty('snapshot_id')
    expect(response.body).toHaveProperty('payload')
    expect(response.body).toHaveProperty('metadata')
    expect(response.body.payload).toHaveProperty('districts')
  })

  it('should respond with consistent structure for health endpoint', async () => {
    await testSnapshotStore.writeSnapshot(
      createTestSnapshot('2024-01-01', 'success')
    )

    const response = await request(app).get('/api/admin/snapshot-store/health')

    expect(response.status).toBe(200)
    expect(response.body.health).toHaveProperty('is_ready')
    expect(response.body.health).toHaveProperty('current_snapshot')
    expect(response.body.health).toHaveProperty('recent_activity')
    expect(response.body.metadata).toHaveProperty('operation_id')
  })

  it('should respond with consistent structure for integrity endpoint', async () => {
    const response = await request(app).get(
      '/api/admin/snapshot-store/integrity'
    )

    expect(response.status).toBe(200)
    expect(response.body).toHaveProperty('integrity')
    expect(response.body.metadata).toHaveProperty('operation_id')
  })

  it('should respond with consistent structure for performance endpoint', async () => {
    const response = await request(app).get(
      '/api/admin/snapshot-store/performance'
    )

    expect(response.status).toBe(200)
    expect(response.body.performance).toHaveProperty('totalReads')
    expect(response.body.performance).toHaveProperty('cache_hit_rate_percent')
    expect(response.body.metadata).toHaveProperty('operation_id')
  })

  it('should respond for performance reset endpoint', async () => {
    const response = await request(app).post(
      '/api/admin/snapshot-store/performance/reset'
    )

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
    expect(response.body.metadata).toHaveProperty('operation_id')
  })

  it('should respond with consistent structure for district config', async () => {
    const response = await request(app).get('/api/admin/districts/config')

    expect(response.status).toBe(200)
    expect(response.body).toHaveProperty('configuration')
    expect(response.body).toHaveProperty('status')
    expect(response.body.status).toHaveProperty('hasConfiguredDistricts')
    expect(response.body.metadata).toHaveProperty('operation_id')
  })

  it.each([
    ['missing districtIds', {}],
    ['invalid format', { districtIds: 'not-an-array' }],
    ['empty array', { districtIds: [] }],
  ])(
    'should return 400 for invalid district config: %s',
    async (_desc, invalidBody) => {
      const response = await request(app)
        .post('/api/admin/districts/config')
        .send(invalidBody)
        .set('Content-Type', 'application/json')

      expect(response.status).toBe(400)
      expect(response.body.error).toHaveProperty('code')
      expect(response.body.error).toHaveProperty('message')
    }
  )

  it('should respond for all process separation endpoints', async () => {
    const endpoints = [
      '/api/admin/process-separation/validate',
      '/api/admin/process-separation/monitor',
      '/api/admin/process-separation/compliance',
      '/api/admin/process-separation/independence',
    ]

    for (const endpoint of endpoints) {
      const response = await request(app).get(endpoint)
      expect(response.status).toBe(200)
      expect(response.body.metadata).toHaveProperty('operation_id')
    }
  })

  it('should filter snapshots by status', async () => {
    await testSnapshotStore.writeSnapshot(
      createTestSnapshot('2024-01-01', 'success')
    )
    await testSnapshotStore.writeSnapshot(
      createTestSnapshot('2024-01-02', 'failed')
    )

    for (const status of ['success', 'failed']) {
      const response = await request(app).get(
        `/api/admin/snapshots?status=${status}`
      )

      expect(response.status).toBe(200)
      expect(response.body.metadata.filters_applied.status).toBe(status)

      for (const snapshot of response.body.snapshots) {
        expect(snapshot.status).toBe(status)
      }
    }
  })
})
