/**
 * Property Test: API Path Preservation
 *
 * **Property 1: API Path Preservation**
 * *For any* valid HTTP request to an admin endpoint path that existed before refactoring,
 * the refactored router SHALL route the request to a handler that produces an identical
 * response structure.
 *
 * **Validates: Requirements 5.1, 5.2, 5.3**
 *
 * This test verifies that:
 * 1. All expected admin routes are registered and accessible
 * 2. Response structures are consistent with the API contract
 * 3. Error responses follow the standard format
 * 4. All endpoints respond at their original paths
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

// Mock the production service factory to use our test snapshot store
// Routes now use createSnapshotStorage() which returns ISnapshotStorage
const mockFactory = {
  createSnapshotStorage: () => testSnapshotStore as unknown as ISnapshotStorage,
  createSnapshotStore: () => testSnapshotStore,
  createCacheConfigService: () => ({
    getConfiguration: () => ({
      baseDirectory: tempDir,
      source: 'test',
      isConfigured: true,
      validationStatus: {
        isValid: true,
        isAccessible: true,
        isSecure: true,
      },
    }),
  }),
  createRefreshService: () => ({
    isRefreshing: () => false,
    getLastRefreshTime: () => null,
  }),
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

describe('API Path Preservation Property Tests', () => {
  let app: Express

  beforeEach(async () => {
    // Create unique temporary directory for test isolation
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), `api-equiv-test-${uniqueId}-`)
    )

    // Create test snapshot store
    testSnapshotStore = new FileSnapshotStore({
      cacheDir: tempDir,
      maxSnapshots: 10,
      maxAgeDays: 7,
      enableCompression: false,
    })

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
   * Helper to create a test snapshot with ISO date format
   */
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

  /**
   * Property 1: API Path Preservation
   *
   * For any valid admin endpoint path, the router SHALL respond with
   * appropriate status codes and consistent response structure.
   *
   * Feature: admin-routes-refactor, Property 1: API Path Preservation
   * Validates: Requirements 5.1, 5.2, 5.3
   */
  describe('Property 1: API Path Preservation', () => {
    it('should have all expected admin routes registered', () => {
      // Verify the router is properly composed
      expect(adminRoutes).toBeDefined()
      expect(typeof adminRoutes).toBe('function')

      // Get the router's stack to verify routes are registered
      const routerStack = (adminRoutes as express.Router).stack

      // The router should have multiple layers (one for each sub-router)
      expect(routerStack.length).toBeGreaterThan(0)

      // Verify we have a reasonable number of route handlers
      // (4 sub-routers: snapshots, district-config, monitoring, process-separation)
      expect(routerStack.length).toBeGreaterThanOrEqual(4)
    })

    it('should respond with consistent structure for snapshot list endpoint', async () => {
      // Create test snapshot
      await testSnapshotStore.writeSnapshot(
        createTestSnapshot('2024-01-01', 'success')
      )

      // Property: For any valid limit parameter, response structure should be consistent
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 1, max: 100 }), async limit => {
          const response = await request(app).get(
            `/api/admin/snapshots?limit=${limit}`
          )

          // Should return 200 for valid requests
          expect(response.status).toBe(200)

          // Response should have required structure
          expect(response.body).toHaveProperty('snapshots')
          expect(response.body).toHaveProperty('metadata')
          expect(Array.isArray(response.body.snapshots)).toBe(true)
          expect(response.body.metadata).toHaveProperty('total_count')
          expect(response.body.metadata).toHaveProperty('generated_at')
          expect(response.body.metadata).toHaveProperty('limit_applied')

          return true
        }),
        {
          numRuns: 20,
          seed: 12345,
        }
      )
    })

    it('should respond with consistent error format for invalid snapshot IDs', async () => {
      // Property: For any non-existent snapshot ID, error response should be consistent
      await fc.assert(
        fc.asyncProperty(
          fc.stringMatching(/^[a-zA-Z0-9]{5,20}$/),
          async invalidSnapshotId => {
            const response = await request(app).get(
              `/api/admin/snapshots/${invalidSnapshotId}`
            )

            // Should return 404 for non-existent snapshots
            expect(response.status).toBe(404)

            // Error response should have standard structure
            expect(response.body).toHaveProperty('error')
            expect(response.body.error).toHaveProperty('code')
            expect(response.body.error).toHaveProperty('message')
            expect(response.body.error.code).toBe('SNAPSHOT_NOT_FOUND')

            return true
          }
        ),
        {
          numRuns: 15,
          seed: 23456,
        }
      )
    })

    it('should respond with consistent structure for snapshot detail endpoint', async () => {
      // Create test snapshots with different IDs
      const snapshotIds = ['2024-01-01', '2024-01-02', '2024-01-03']
      for (const id of snapshotIds) {
        await testSnapshotStore.writeSnapshot(createTestSnapshot(id, 'success'))
      }

      // Property: For any existing snapshot ID, response structure should be consistent
      await fc.assert(
        fc.asyncProperty(fc.constantFrom(...snapshotIds), async snapshotId => {
          const response = await request(app).get(
            `/api/admin/snapshots/${snapshotId}`
          )

          // Should return 200 for existing snapshots
          expect(response.status).toBe(200)

          // Response should have required structure
          expect(response.body).toHaveProperty('inspection')
          expect(response.body).toHaveProperty('metadata')
          expect(response.body.inspection).toHaveProperty('snapshot_id')
          expect(response.body.inspection).toHaveProperty('status')
          expect(response.body.inspection).toHaveProperty('payload_summary')
          expect(response.body.metadata).toHaveProperty('operation_id')

          return true
        }),
        {
          numRuns: 10,
          seed: 34567,
        }
      )
    })

    it('should respond with consistent structure for snapshot payload endpoint', async () => {
      // Create test snapshot
      const snapshotId = '2024-01-01'
      await testSnapshotStore.writeSnapshot(
        createTestSnapshot(snapshotId, 'success')
      )

      const response = await request(app).get(
        `/api/admin/snapshots/${snapshotId}/payload`
      )

      // Should return 200 for existing snapshots
      expect(response.status).toBe(200)

      // Response should have required structure
      expect(response.body).toHaveProperty('snapshot_id')
      expect(response.body).toHaveProperty('created_at')
      expect(response.body).toHaveProperty('status')
      expect(response.body).toHaveProperty('payload')
      expect(response.body).toHaveProperty('metadata')
      expect(response.body.payload).toHaveProperty('districts')
      expect(response.body.payload).toHaveProperty('metadata')
    })

    it('should respond with consistent structure for health endpoint', async () => {
      // Create test snapshot for health check
      await testSnapshotStore.writeSnapshot(
        createTestSnapshot('2024-01-01', 'success')
      )

      const response = await request(app).get(
        '/api/admin/snapshot-store/health'
      )

      // Should return 200 for health check
      expect(response.status).toBe(200)

      // Response should have required structure
      expect(response.body).toHaveProperty('health')
      expect(response.body).toHaveProperty('metadata')
      expect(response.body.health).toHaveProperty('is_ready')
      expect(response.body.health).toHaveProperty('current_snapshot')
      expect(response.body.health).toHaveProperty('recent_activity')
      expect(response.body.health).toHaveProperty('store_status')
      expect(response.body.metadata).toHaveProperty('operation_id')
    })

    it('should respond with consistent structure for integrity endpoint', async () => {
      const response = await request(app).get(
        '/api/admin/snapshot-store/integrity'
      )

      // Should return 200 for integrity check
      expect(response.status).toBe(200)

      // Response should have required structure
      expect(response.body).toHaveProperty('integrity')
      expect(response.body).toHaveProperty('metadata')
      expect(response.body.metadata).toHaveProperty('operation_id')
    })

    it('should respond with consistent structure for performance endpoint', async () => {
      const response = await request(app).get(
        '/api/admin/snapshot-store/performance'
      )

      // Should return 200 for performance metrics
      expect(response.status).toBe(200)

      // Response should have required structure
      expect(response.body).toHaveProperty('performance')
      expect(response.body).toHaveProperty('metadata')
      expect(response.body.performance).toHaveProperty('totalReads')
      expect(response.body.performance).toHaveProperty('cache_hit_rate_percent')
      expect(response.body.metadata).toHaveProperty('operation_id')
    })

    it('should respond with consistent structure for performance reset endpoint', async () => {
      const response = await request(app).post(
        '/api/admin/snapshot-store/performance/reset'
      )

      // Should return 200 for performance reset
      expect(response.status).toBe(200)

      // Response should have required structure
      expect(response.body).toHaveProperty('success')
      expect(response.body).toHaveProperty('message')
      expect(response.body).toHaveProperty('metadata')
      expect(response.body.success).toBe(true)
      expect(response.body.metadata).toHaveProperty('operation_id')
    })

    it('should respond with consistent structure for district config endpoint', async () => {
      const response = await request(app).get('/api/admin/districts/config')

      // Should return 200 for district config
      expect(response.status).toBe(200)

      // Response should have required structure
      expect(response.body).toHaveProperty('configuration')
      expect(response.body).toHaveProperty('status')
      expect(response.body).toHaveProperty('validation')
      expect(response.body).toHaveProperty('metadata')
      expect(response.body.status).toHaveProperty('hasConfiguredDistricts')
      expect(response.body.status).toHaveProperty('totalDistricts')
      expect(response.body.metadata).toHaveProperty('operation_id')
    })

    it('should respond with consistent error format for invalid district config requests', async () => {
      // Property: For any invalid request body, error response should be consistent
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant({}), // Missing districtIds
            fc.constant({ districtIds: 'not-an-array' }), // Invalid format
            fc.constant({ districtIds: [] }) // Empty array
          ),
          async invalidBody => {
            const response = await request(app)
              .post('/api/admin/districts/config')
              .send(invalidBody)
              .set('Content-Type', 'application/json')

            // Should return 400 for invalid requests
            expect(response.status).toBe(400)

            // Error response should have standard structure
            expect(response.body).toHaveProperty('error')
            expect(response.body.error).toHaveProperty('code')
            expect(response.body.error).toHaveProperty('message')

            return true
          }
        ),
        {
          numRuns: 10,
          seed: 45678,
        }
      )
    })

    it('should respond with consistent structure for process separation endpoints', async () => {
      // Test all process separation endpoints
      const endpoints = [
        '/api/admin/process-separation/validate',
        '/api/admin/process-separation/monitor',
        '/api/admin/process-separation/compliance',
        '/api/admin/process-separation/independence',
      ]

      for (const endpoint of endpoints) {
        const response = await request(app).get(endpoint)

        // Should return 200 for process separation endpoints
        expect(response.status).toBe(200)

        // Response should have metadata with operation_id
        expect(response.body).toHaveProperty('metadata')
        expect(response.body.metadata).toHaveProperty('operation_id')
      }
    })

    it('should filter snapshots by status consistently', async () => {
      // Create snapshots with different statuses
      await testSnapshotStore.writeSnapshot(
        createTestSnapshot('2024-01-01', 'success')
      )
      await testSnapshotStore.writeSnapshot(
        createTestSnapshot('2024-01-02', 'failed')
      )

      // Property: For any valid status filter, response should only contain matching snapshots
      await fc.assert(
        fc.asyncProperty(fc.constantFrom('success', 'failed'), async status => {
          const response = await request(app).get(
            `/api/admin/snapshots?status=${status}`
          )

          expect(response.status).toBe(200)
          expect(response.body).toHaveProperty('snapshots')
          expect(response.body.metadata.filters_applied).toHaveProperty(
            'status'
          )
          expect(response.body.metadata.filters_applied.status).toBe(status)

          // All returned snapshots should have the requested status
          for (const snapshot of response.body.snapshots) {
            expect(snapshot.status).toBe(status)
          }

          return true
        }),
        {
          numRuns: 5,
          seed: 56789,
        }
      )
    })
  })
})
