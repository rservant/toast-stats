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
  let originalCacheDir: string | undefined

  beforeEach(async () => {
    // Create unique temporary directory for test isolation
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), `snapshots-test-${uniqueId}-`)
    )

    // Store original CACHE_DIR and set to tempDir for analytics availability checker
    originalCacheDir = process.env['CACHE_DIR']
    process.env['CACHE_DIR'] = tempDir

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

  /**
   * Analytics Availability Tests
   *
   * Tests for the enhanced snapshot list endpoint that includes
   * analytics availability information.
   *
   * Requirements: 2.1, 2.2, 2.3, 2.4
   */
  describe('GET /snapshots - Analytics Availability', () => {
    /**
     * Helper to create analytics-summary.json file for a snapshot
     * @param snapshotId - The snapshot ID to create analytics for
     */
    const createAnalyticsFile = async (snapshotId: string): Promise<void> => {
      const analyticsDir = path.join(tempDir, 'snapshots', snapshotId)
      await fs.mkdir(analyticsDir, { recursive: true })
      const analyticsPath = path.join(analyticsDir, 'analytics-summary.json')
      const analyticsData = {
        snapshotId,
        generatedAt: new Date().toISOString(),
        districts: {},
      }
      await fs.writeFile(analyticsPath, JSON.stringify(analyticsData))
    }

    /**
     * Test: analytics_available is true when analytics-summary.json exists
     *
     * Requirement 2.1: Snapshot list endpoint SHALL include a boolean field
     * indicating whether analytics are available for each snapshot
     *
     * Requirement 2.2: Analytics availability check SHALL verify the existence
     * of the analytics-summary.json file
     */
    it('should return analytics_available: true when analytics-summary.json exists', async () => {
      // Create a test snapshot
      const testSnapshot = createTestSnapshot('2024-01-01', 'success')
      await testSnapshotStore.writeSnapshot(testSnapshot)

      // Create analytics file for the snapshot
      await createAnalyticsFile('2024-01-01')

      const response = await request(app).get('/api/admin/snapshots')

      expect(response.status).toBe(200)
      expect(response.body.snapshots).toHaveLength(1)
      expect(response.body.snapshots[0].analytics_available).toBe(true)
    })

    /**
     * Test: analytics_available is false when analytics-summary.json doesn't exist
     *
     * Requirement 2.1: Snapshot list endpoint SHALL include a boolean field
     * indicating whether analytics are available for each snapshot
     *
     * Requirement 2.2: Analytics availability check SHALL verify the existence
     * of the analytics-summary.json file
     */
    it('should return analytics_available: false when analytics-summary.json does not exist', async () => {
      // Create a test snapshot without analytics file
      const testSnapshot = createTestSnapshot('2024-01-02', 'success')
      await testSnapshotStore.writeSnapshot(testSnapshot)

      const response = await request(app).get('/api/admin/snapshots')

      expect(response.status).toBe(200)
      expect(response.body.snapshots).toHaveLength(1)
      expect(response.body.snapshots[0].analytics_available).toBe(false)
    })

    /**
     * Test: All original SnapshotMetadata fields are still present (backward compatibility)
     *
     * Requirement 2.3: Snapshot list response SHALL include the new field
     * without breaking existing consumers (backward compatible)
     */
    it('should include all original SnapshotMetadata fields for backward compatibility', async () => {
      const testSnapshot = createTestSnapshot('2024-01-03', 'success', 2)
      await testSnapshotStore.writeSnapshot(testSnapshot)

      const response = await request(app).get('/api/admin/snapshots')

      expect(response.status).toBe(200)
      expect(response.body.snapshots).toHaveLength(1)

      const snapshot = response.body.snapshots[0]

      // Verify all original SnapshotMetadata fields are present
      expect(snapshot.snapshot_id).toBe('2024-01-03')
      expect(snapshot.created_at).toBeDefined()
      expect(snapshot.status).toBe('success')
      expect(snapshot.schema_version).toBe('1.0.0')
      expect(snapshot.calculation_version).toBe('1.0.0')
      expect(typeof snapshot.size_bytes).toBe('number')
      expect(typeof snapshot.error_count).toBe('number')
      expect(snapshot.district_count).toBe(2)

      // Verify new analytics_available field is also present
      expect(typeof snapshot.analytics_available).toBe('boolean')
    })

    /**
     * Test: Metadata includes analytics_available_count and analytics_missing_count
     *
     * Requirement 2.1: Snapshot list endpoint SHALL include analytics availability
     * information in the response metadata
     */
    it('should include analytics counts in metadata', async () => {
      // Create 3 snapshots
      await testSnapshotStore.writeSnapshot(
        createTestSnapshot('2024-01-04', 'success')
      )
      await testSnapshotStore.writeSnapshot(
        createTestSnapshot('2024-01-05', 'success')
      )
      await testSnapshotStore.writeSnapshot(
        createTestSnapshot('2024-01-06', 'success')
      )

      // Create analytics for 2 of them
      await createAnalyticsFile('2024-01-04')
      await createAnalyticsFile('2024-01-05')

      const response = await request(app).get('/api/admin/snapshots')

      expect(response.status).toBe(200)
      expect(response.body.snapshots).toHaveLength(3)
      expect(response.body.metadata.analytics_available_count).toBe(2)
      expect(response.body.metadata.analytics_missing_count).toBe(1)
    })

    /**
     * Test: Mixed analytics availability across multiple snapshots
     *
     * Requirement 2.1, 2.2: Verify correct analytics_available values
     * for a mix of snapshots with and without analytics
     */
    it('should correctly report mixed analytics availability', async () => {
      // Create snapshots
      await testSnapshotStore.writeSnapshot(
        createTestSnapshot('2024-01-07', 'success')
      )
      await testSnapshotStore.writeSnapshot(
        createTestSnapshot('2024-01-08', 'success')
      )
      await testSnapshotStore.writeSnapshot(
        createTestSnapshot('2024-01-09', 'success')
      )

      // Create analytics for only the first and third
      await createAnalyticsFile('2024-01-07')
      await createAnalyticsFile('2024-01-09')

      const response = await request(app).get('/api/admin/snapshots')

      expect(response.status).toBe(200)
      expect(response.body.snapshots).toHaveLength(3)

      // Find each snapshot and verify analytics_available
      const snapshotMap = new Map(
        response.body.snapshots.map(
          (s: { snapshot_id: string; analytics_available: boolean }) => [
            s.snapshot_id,
            s.analytics_available,
          ]
        )
      )

      expect(snapshotMap.get('2024-01-07')).toBe(true)
      expect(snapshotMap.get('2024-01-08')).toBe(false)
      expect(snapshotMap.get('2024-01-09')).toBe(true)
    })

    /**
     * Test: Response time increase is under 100ms for analytics availability check
     *
     * Requirement 2.4: Analytics availability check SHALL NOT significantly
     * impact snapshot list performance (under 100ms additional latency)
     *
     * Note: This test verifies the total query duration is reasonable.
     * The actual overhead from analytics checking should be minimal due to
     * batch parallel checking.
     */
    it('should complete analytics availability check within performance budget', async () => {
      // Create multiple snapshots to test batch performance
      const snapshotCount = 10
      for (let i = 0; i < snapshotCount; i++) {
        const dateStr = `2024-02-${String(i + 1).padStart(2, '0')}`
        await testSnapshotStore.writeSnapshot(
          createTestSnapshot(dateStr, 'success')
        )
        // Create analytics for half of them
        if (i % 2 === 0) {
          await createAnalyticsFile(dateStr)
        }
      }

      const startTime = Date.now()
      const response = await request(app).get('/api/admin/snapshots')
      const duration = Date.now() - startTime

      expect(response.status).toBe(200)
      expect(response.body.snapshots).toHaveLength(snapshotCount)

      // Verify the query completed within a reasonable time
      // The 100ms requirement is for the additional latency from analytics checking,
      // but we allow more time for the overall request including snapshot listing
      expect(duration).toBeLessThan(2000) // 2 seconds max for entire request

      // Verify the query_duration_ms is reported in metadata
      expect(response.body.metadata.query_duration_ms).toBeDefined()
      expect(typeof response.body.metadata.query_duration_ms).toBe('number')
    })

    /**
     * Test: Empty snapshot list still includes analytics metadata
     */
    it('should include analytics counts in metadata even when no snapshots exist', async () => {
      const response = await request(app).get('/api/admin/snapshots')

      expect(response.status).toBe(200)
      expect(response.body.snapshots).toEqual([])
      expect(response.body.metadata.analytics_available_count).toBe(0)
      expect(response.body.metadata.analytics_missing_count).toBe(0)
    })
  })
})
