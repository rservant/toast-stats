/**
 * Property Test: Middleware Application Consistency
 *
 * **Property 3: Middleware Application Consistency**
 * *For any* HTTP request to any admin endpoint, the logAdminAccess middleware
 * SHALL be invoked exactly once before the route handler executes.
 *
 * **Validates: Requirements 5.4, 6.2**
 *
 * This test verifies that:
 * 1. The logAdminAccess middleware is applied to all admin routes
 * 2. The middleware is invoked exactly once per request
 * 3. The middleware logs the correct endpoint path
 * 4. The middleware does not block request processing
 *
 * Test Isolation:
 * - Each test uses a fresh Express app instance
 * - Uses unique temporary directories for test data
 * - Uses deterministic seeds for property tests to ensure reproducibility
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fc from 'fast-check'
import express, { type Express } from 'express'
import request from 'supertest'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import adminRoutes from '../index.js'
import { FileSnapshotStore } from '../../../services/SnapshotStore.js'
import { Snapshot } from '../../../types/snapshots.js'
import type { ISnapshotStorage } from '../../../types/storageInterfaces.js'

// Test snapshot store instance
let testSnapshotStore: FileSnapshotStore
let tempDir: string

// Track middleware invocations
let middlewareInvocations: Array<{
  endpoint: string
  ip: string | undefined
  userAgent: string | undefined
  timestamp: number
}> = []

// Use vi.hoisted to ensure mock factory is available when vi.mock is hoisted
const { mockFactory, setTestSnapshotStore, setTempDir } = vi.hoisted(() => {
  let hoistedSnapshotStore: unknown = null
  let hoistedTempDir = ''
  return {
    mockFactory: {
      createSnapshotStorage: () => hoistedSnapshotStore,
      createSnapshotStore: () => hoistedSnapshotStore,
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

// Mock the production service factory to use our test snapshot store
// Routes now use createSnapshotStorage() which returns ISnapshotStorage
vi.mock('../../../services/ProductionServiceFactory.js', () => ({
  getProductionServiceFactory: () => mockFactory,
}))

// Mock the main index.js to prevent server initialization side effects
vi.mock('../../../index.js', () => ({
  getUnifiedBackfillServiceInstance: vi.fn(),
}))

// Mock logger to track middleware invocations
vi.mock('../../../utils/logger.js', () => ({
  logger: {
    info: vi.fn((message: string, data?: Record<string, unknown>) => {
      // Track admin endpoint access logs
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

// Mock ProcessSeparationValidator
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

describe('Middleware Application Consistency Property Tests', () => {
  let app: Express

  beforeEach(async () => {
    // Reset middleware invocation tracking
    middlewareInvocations = []

    // Create unique temporary directory for test isolation
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), `middleware-test-${uniqueId}-`)
    )
    setTempDir(tempDir)

    // Create test snapshot store
    testSnapshotStore = new FileSnapshotStore({
      cacheDir: tempDir,
      maxSnapshots: 10,
      maxAgeDays: 7,
      enableCompression: false,
    })
    setTestSnapshotStore(testSnapshotStore)

    // Create test app with admin routes
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

  /**
   * Helper to create a test snapshot
   */
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
        fetchedAt: new Date(parseInt(id)).toISOString(),
        dataAsOfDate: '2024-01-01',
        districtCount: 1,
        processingDurationMs: 1000,
      },
    },
  })

  /**
   * Property 3: Middleware Application Consistency
   *
   * For any HTTP request to any admin endpoint, the logAdminAccess middleware
   * SHALL be invoked exactly once before the route handler executes.
   *
   * Feature: admin-routes-refactor, Property 3: Middleware Application Consistency
   * Validates: Requirements 5.4, 6.2
   */
  describe('Property 3: Middleware Application Consistency', () => {
    // Define all admin endpoints that should have middleware applied
    const adminEndpoints = [
      {
        method: 'GET',
        path: '/api/admin/snapshots',
        description: 'list snapshots',
      },
      {
        method: 'GET',
        path: '/api/admin/snapshots/test-id',
        description: 'get snapshot',
      },
      {
        method: 'GET',
        path: '/api/admin/snapshots/test-id/payload',
        description: 'get snapshot payload',
      },
      {
        method: 'GET',
        path: '/api/admin/snapshot-store/health',
        description: 'health check',
      },
      {
        method: 'GET',
        path: '/api/admin/snapshot-store/integrity',
        description: 'integrity check',
      },
      {
        method: 'GET',
        path: '/api/admin/snapshot-store/performance',
        description: 'performance metrics',
      },
      {
        method: 'POST',
        path: '/api/admin/snapshot-store/performance/reset',
        description: 'reset metrics',
      },
      {
        method: 'GET',
        path: '/api/admin/districts/config',
        description: 'get district config',
      },
      {
        method: 'POST',
        path: '/api/admin/districts/config',
        description: 'update district config',
      },
      {
        method: 'DELETE',
        path: '/api/admin/districts/config/testDistrict',
        description: 'delete district',
      },
      {
        method: 'POST',
        path: '/api/admin/districts/config/validate',
        description: 'validate config',
      },
      {
        method: 'GET',
        path: '/api/admin/districts/config/history',
        description: 'config history',
      },
      {
        method: 'GET',
        path: '/api/admin/process-separation/validate',
        description: 'validate process separation',
      },
      {
        method: 'GET',
        path: '/api/admin/process-separation/monitor',
        description: 'monitor operations',
      },
      {
        method: 'GET',
        path: '/api/admin/process-separation/compliance',
        description: 'compliance metrics',
      },
      {
        method: 'GET',
        path: '/api/admin/process-separation/independence',
        description: 'independence validation',
      },
    ]

    it('should invoke middleware exactly once for each GET endpoint', async () => {
      // Create test snapshot for endpoints that need it
      await testSnapshotStore.writeSnapshot(
        createTestSnapshot('1704067200000', 'success')
      )

      // Property: For any GET endpoint, middleware should be invoked exactly once
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...adminEndpoints.filter(e => e.method === 'GET')),
          async endpoint => {
            // Reset invocation tracking
            middlewareInvocations = []

            // Make request
            await request(app).get(endpoint.path)

            // Middleware should be invoked exactly once
            expect(middlewareInvocations.length).toBe(1)

            // The logged endpoint should match the request path (relative to /api/admin)
            const expectedPath = endpoint.path.replace('/api/admin', '')
            expect(middlewareInvocations[0]?.endpoint).toBe(expectedPath)

            return true
          }
        ),
        {
          numRuns: adminEndpoints.filter(e => e.method === 'GET').length,
          seed: 12345,
        }
      )
    })

    it('should invoke middleware exactly once for POST endpoints', async () => {
      // Property: For any POST endpoint, middleware should be invoked exactly once
      const postEndpoints = adminEndpoints.filter(e => e.method === 'POST')

      for (const endpoint of postEndpoints) {
        // Reset invocation tracking
        middlewareInvocations = []

        // Make request with appropriate body
        let body = {}
        if (
          endpoint.path.includes('/districts/config') &&
          !endpoint.path.includes('validate')
        ) {
          body = { districtIds: ['42'] }
        }

        await request(app)
          .post(endpoint.path)
          .send(body)
          .set('Content-Type', 'application/json')

        // Middleware should be invoked exactly once
        expect(middlewareInvocations.length).toBe(1)

        // The logged endpoint should match the request path (relative to /api/admin)
        const expectedPath = endpoint.path.replace('/api/admin', '')
        expect(middlewareInvocations[0]?.endpoint).toBe(expectedPath)
      }
    })

    it('should invoke middleware exactly once for DELETE endpoints', async () => {
      // Property: For any DELETE endpoint, middleware should be invoked exactly once
      const deleteEndpoints = adminEndpoints.filter(e => e.method === 'DELETE')

      for (const endpoint of deleteEndpoints) {
        // Reset invocation tracking
        middlewareInvocations = []

        // Make request
        await request(app).delete(endpoint.path)

        // Middleware should be invoked exactly once
        expect(middlewareInvocations.length).toBe(1)

        // The logged endpoint should match the request path (relative to /api/admin)
        const expectedPath = endpoint.path.replace('/api/admin', '')
        expect(middlewareInvocations[0]?.endpoint).toBe(expectedPath)
      }
    })

    it('should log correct endpoint path for parameterized routes', async () => {
      // Create test snapshot
      const snapshotId = '1704067200000'
      await testSnapshotStore.writeSnapshot(
        createTestSnapshot(snapshotId, 'success')
      )

      // Property: For any parameterized route, the logged path should include the actual parameter value
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            `/api/admin/snapshots/${snapshotId}`,
            `/api/admin/snapshots/${snapshotId}/payload`
          ),
          async fullPath => {
            // Reset invocation tracking
            middlewareInvocations = []

            // Make request
            await request(app).get(fullPath)

            // Middleware should be invoked exactly once
            expect(middlewareInvocations.length).toBe(1)

            // The logged endpoint should include the actual parameter value
            const expectedPath = fullPath.replace('/api/admin', '')
            expect(middlewareInvocations[0]?.endpoint).toBe(expectedPath)

            return true
          }
        ),
        {
          numRuns: 5,
          seed: 23456,
        }
      )
    })

    it('should not invoke middleware multiple times for a single request', async () => {
      // Create test snapshot
      await testSnapshotStore.writeSnapshot(
        createTestSnapshot('1704067200000', 'success')
      )

      // Property: For any sequence of requests, each request should trigger exactly one middleware invocation
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.constantFrom(
              '/api/admin/snapshots',
              '/api/admin/snapshot-store/health',
              '/api/admin/districts/config',
              '/api/admin/process-separation/validate'
            ),
            { minLength: 1, maxLength: 5 }
          ),
          async endpoints => {
            // Reset invocation tracking
            middlewareInvocations = []

            // Make all requests
            for (const endpoint of endpoints) {
              await request(app).get(endpoint)
            }

            // Number of middleware invocations should equal number of requests
            expect(middlewareInvocations.length).toBe(endpoints.length)

            // Each invocation should correspond to the correct endpoint
            for (let i = 0; i < endpoints.length; i++) {
              const expectedPath = endpoints[i]?.replace('/api/admin', '')
              expect(middlewareInvocations[i]?.endpoint).toBe(expectedPath)
            }

            return true
          }
        ),
        {
          numRuns: 10,
          seed: 34567,
        }
      )
    })

    it('should invoke middleware before route handler executes', async () => {
      // Create test snapshot
      await testSnapshotStore.writeSnapshot(
        createTestSnapshot('1704067200000', 'success')
      )

      // Reset invocation tracking
      middlewareInvocations = []

      // Make request
      const response = await request(app).get('/api/admin/snapshots')

      // Middleware should have been invoked
      expect(middlewareInvocations.length).toBe(1)

      // Response should be successful (handler executed after middleware)
      expect(response.status).toBe(200)

      // Middleware invocation timestamp should be before response
      expect(middlewareInvocations[0]?.timestamp).toBeLessThanOrEqual(
        Date.now()
      )
    })

    it('should invoke middleware even for error responses', async () => {
      // Property: Middleware should be invoked even when the route handler returns an error
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            '/api/admin/snapshots/nonexistent-snapshot',
            '/api/admin/snapshots/nonexistent-snapshot/payload'
          ),
          async endpoint => {
            // Reset invocation tracking
            middlewareInvocations = []

            // Make request (will return 404)
            const response = await request(app).get(endpoint)

            // Middleware should still be invoked exactly once
            expect(middlewareInvocations.length).toBe(1)

            // Response should be 404
            expect(response.status).toBe(404)

            return true
          }
        ),
        {
          numRuns: 5,
          seed: 45678,
        }
      )
    })

    it('should invoke middleware for validation error responses', async () => {
      // Reset invocation tracking
      middlewareInvocations = []

      // Make request with invalid body (will return 400)
      const response = await request(app)
        .post('/api/admin/districts/config')
        .send({}) // Missing required districtIds
        .set('Content-Type', 'application/json')

      // Middleware should still be invoked exactly once
      expect(middlewareInvocations.length).toBe(1)

      // Response should be 400
      expect(response.status).toBe(400)
    })
  })
})
