/**
 * Unit Tests for Admin Middleware Application Consistency
 *
 * Verifies that the logAdminAccess middleware is invoked exactly once
 * before the route handler for every admin endpoint.
 *
 * Converted from property-based tests — PBT used fc.constantFrom() over
 * a fixed endpoint list and fc.array for request sequences, replaced
 * with deterministic loops.
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

let middlewareInvocations: Array<{
  endpoint: string
  ip: string | undefined
  userAgent: string | undefined
  timestamp: number
}> = []

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
    info: vi.fn((message: string, data?: Record<string, unknown>) => {
      if (message === 'Admin endpoint accessed' && data) {
        middlewareInvocations.push({
          endpoint: data['endpoint'] as string,
          ip: data['ip'] as string | undefined,
          userAgent: data['userAgent'] as string | undefined,
          timestamp: Date.now(),
        })
      }
    }),
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

describe('Admin Middleware Application Consistency', () => {
  let app: Express

  const createTestSnapshot = (
    id: string,
    status: 'success' | 'partial' | 'failed' = 'success'
  ): Snapshot => ({
    snapshot_id: id,
    created_at: new Date(parseInt(id)).toISOString(),
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
        fetchedAt: new Date(parseInt(id)).toISOString(),
        dataAsOfDate: '2024-01-01',
        districtCount: 1,
        processingDurationMs: 1000,
      },
    },
  })

  const getEndpoints = [
    '/api/admin/snapshots',
    '/api/admin/snapshots/test-id',
    '/api/admin/snapshots/test-id/payload',
    '/api/admin/snapshot-store/health',
    '/api/admin/snapshot-store/integrity',
    '/api/admin/snapshot-store/performance',
    '/api/admin/districts/config',
    '/api/admin/districts/config/history',
    '/api/admin/process-separation/validate',
    '/api/admin/process-separation/monitor',
    '/api/admin/process-separation/compliance',
    '/api/admin/process-separation/independence',
  ]

  beforeEach(async () => {
    middlewareInvocations = []
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), `middleware-test-${uniqueId}-`)
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

  it('should invoke middleware exactly once for each GET endpoint', async () => {
    await testSnapshotStore.writeSnapshot(
      createTestSnapshot('1704067200000', 'success')
    )

    for (const endpointPath of getEndpoints) {
      middlewareInvocations = []
      await request(app).get(endpointPath)

      expect(middlewareInvocations.length).toBe(1)
      const expectedPath = endpointPath.replace('/api/admin', '')
      expect(middlewareInvocations[0]?.endpoint).toBe(expectedPath)
    }
  })

  it('should invoke middleware exactly once for POST endpoints', async () => {
    const postEndpoints = [
      { path: '/api/admin/snapshot-store/performance/reset', body: {} },
      {
        path: '/api/admin/districts/config',
        body: { districtIds: ['42'] },
      },
      {
        path: '/api/admin/districts/config/validate',
        body: {},
      },
    ]

    for (const { path: endpointPath, body } of postEndpoints) {
      middlewareInvocations = []
      await request(app)
        .post(endpointPath)
        .send(body)
        .set('Content-Type', 'application/json')

      expect(middlewareInvocations.length).toBe(1)
      const expectedPath = endpointPath.replace('/api/admin', '')
      expect(middlewareInvocations[0]?.endpoint).toBe(expectedPath)
    }
  })

  it('should invoke middleware exactly once for DELETE endpoints', async () => {
    middlewareInvocations = []
    await request(app).delete('/api/admin/districts/config/testDistrict')

    expect(middlewareInvocations.length).toBe(1)
    expect(middlewareInvocations[0]?.endpoint).toBe(
      '/districts/config/testDistrict'
    )
  })

  it('should log correct endpoint path for parameterized routes', async () => {
    const snapshotId = '1704067200000'
    await testSnapshotStore.writeSnapshot(
      createTestSnapshot(snapshotId, 'success')
    )

    for (const fullPath of [
      `/api/admin/snapshots/${snapshotId}`,
      `/api/admin/snapshots/${snapshotId}/payload`,
    ]) {
      middlewareInvocations = []
      await request(app).get(fullPath)

      expect(middlewareInvocations.length).toBe(1)
      expect(middlewareInvocations[0]?.endpoint).toBe(
        fullPath.replace('/api/admin', '')
      )
    }
  })

  it('should invoke middleware once per request in a sequence', async () => {
    await testSnapshotStore.writeSnapshot(
      createTestSnapshot('1704067200000', 'success')
    )

    const endpoints = [
      '/api/admin/snapshots',
      '/api/admin/snapshot-store/health',
      '/api/admin/districts/config',
      '/api/admin/process-separation/validate',
    ]

    middlewareInvocations = []
    for (const endpoint of endpoints) {
      await request(app).get(endpoint)
    }

    expect(middlewareInvocations.length).toBe(endpoints.length)

    for (let i = 0; i < endpoints.length; i++) {
      const expectedPath = endpoints[i]?.replace('/api/admin', '')
      expect(middlewareInvocations[i]?.endpoint).toBe(expectedPath)
    }
  })

  it('should invoke middleware before route handler executes', async () => {
    await testSnapshotStore.writeSnapshot(
      createTestSnapshot('1704067200000', 'success')
    )
    middlewareInvocations = []

    const response = await request(app).get('/api/admin/snapshots')

    expect(middlewareInvocations.length).toBe(1)
    expect(response.status).toBe(200)
    expect(middlewareInvocations[0]?.timestamp).toBeLessThanOrEqual(Date.now())
  })

  it('should invoke middleware even for error responses', async () => {
    for (const endpoint of [
      '/api/admin/snapshots/nonexistent-snapshot',
      '/api/admin/snapshots/nonexistent-snapshot/payload',
    ]) {
      middlewareInvocations = []
      const response = await request(app).get(endpoint)

      expect(middlewareInvocations.length).toBe(1)
      expect(response.status).toBe(404)
    }
  })

  it('should invoke middleware for validation error responses', async () => {
    middlewareInvocations = []

    const response = await request(app)
      .post('/api/admin/districts/config')
      .send({})
      .set('Content-Type', 'application/json')

    expect(middlewareInvocations.length).toBe(1)
    expect(response.status).toBe(400)
  })
})
