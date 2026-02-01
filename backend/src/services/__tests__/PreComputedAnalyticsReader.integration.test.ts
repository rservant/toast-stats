/**
 * Integration tests for PreComputedAnalyticsReader with backend serving
 *
 * Tests the full integration of pre-computed analytics serving through the backend API.
 * These tests verify that the backend correctly reads and serves pre-computed analytics
 * files from the file system.
 *
 * Requirements tested:
 * - 4.3: THE Backend SHALL maintain API compatibility with existing frontend hooks
 * - 11.1: THE Backend SHALL read pre-computed analytics from the local file system when running locally
 * - 11.2: THE Backend SHALL use the same CACHE_DIR configuration for both local development and production
 * - 11.3: WHEN the Scraper_CLI generates pre-computed analytics locally, THE Backend SHALL be able to serve them immediately
 *
 * Test cases:
 * 1. Backend serves pre-computed analytics from local file system
 * 2. API response matches file content exactly
 * 3. Returns 404 when analytics file not found
 * 4. Returns 500 when analytics file is corrupted/invalid JSON
 * 5. Returns 500 when schema version is incompatible
 * 6. API response structure matches DistrictAnalytics type expected by frontend
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import express, { type Express, type Router } from 'express'
import cors from 'cors'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import {
  PreComputedAnalyticsReader,
  SchemaVersionError,
  CorruptedFileError,
} from '../PreComputedAnalyticsReader.js'
import type {
  DistrictAnalytics,
  PreComputedAnalyticsFile,
} from '@toastmasters/analytics-core'
import { ANALYTICS_SCHEMA_VERSION } from '@toastmasters/analytics-core'

/**
 * Test isolation configuration
 */
interface TestConfig {
  testId: string
  cacheDir: string
  snapshotsDir: string
  cleanup: () => Promise<void>
}

/**
 * Creates an isolated test directory with unique naming
 */
async function createIsolatedTestConfig(testName: string): Promise<TestConfig> {
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  const testId = `${testName}-${uniqueId}`
  const cacheDir = path.join(os.tmpdir(), `precomputed-integration-${testId}`)
  const snapshotsDir = path.join(cacheDir, 'snapshots')

  await fs.mkdir(snapshotsDir, { recursive: true })

  return {
    testId,
    cacheDir,
    snapshotsDir,
    cleanup: async () => {
      try {
        await fs.rm(cacheDir, { recursive: true, force: true })
      } catch {
        // Ignore cleanup errors
      }
    },
  }
}

/**
 * Creates a valid district analytics file for testing
 */
function createValidDistrictAnalyticsFile(
  districtId: string,
  snapshotDate: string,
  schemaVersion = ANALYTICS_SCHEMA_VERSION
): PreComputedAnalyticsFile<DistrictAnalytics> {
  return {
    metadata: {
      schemaVersion,
      computedAt: new Date().toISOString(),
      snapshotDate,
      districtId,
      checksum: 'test-checksum-abc123',
    },
    data: {
      districtId,
      dateRange: { start: '2024-01-01', end: snapshotDate },
      totalMembership: 500,
      membershipChange: 10,
      membershipTrend: [
        { date: '2024-01-01', count: 490 },
        { date: snapshotDate, count: 500 },
      ],
      allClubs: [
        {
          clubId: 'club-1',
          clubName: 'Test Club 1',
          currentStatus: 'thriving',
          riskFactors: {
            lowMembership: false,
            decliningMembership: false,
            lowPayments: false,
            inactiveOfficers: false,
            noRecentMeetings: false,
          },
          membershipCount: 25,
          paymentsCount: 20,
          healthScore: 85,
        },
      ],
      vulnerableClubs: [],
      thrivingClubs: [
        {
          clubId: 'club-1',
          clubName: 'Test Club 1',
          currentStatus: 'thriving',
          riskFactors: {
            lowMembership: false,
            decliningMembership: false,
            lowPayments: false,
            inactiveOfficers: false,
            noRecentMeetings: false,
          },
          membershipCount: 25,
          paymentsCount: 20,
          healthScore: 85,
        },
      ],
      interventionRequiredClubs: [],
      distinguishedClubs: [
        {
          clubId: 'club-1',
          clubName: 'Test Club 1',
          status: 'distinguished',
          dcpPoints: 7,
          goalsCompleted: 7,
        },
      ],
      distinguishedProjection: {
        projectedDistinguished: 10,
        projectedSelect: 5,
        projectedPresident: 3,
        currentDistinguished: 8,
        currentSelect: 4,
        currentPresident: 2,
        projectionDate: snapshotDate,
      },
      divisionRankings: [
        {
          divisionId: 'A',
          divisionName: 'Division A',
          rank: 1,
          score: 92,
          clubCount: 10,
          membershipTotal: 250,
        },
      ],
      topPerformingAreas: [
        {
          areaId: 'A1',
          areaName: 'Area A1',
          divisionId: 'A',
          score: 92,
          clubCount: 5,
          membershipTotal: 125,
        },
      ],
    },
  }
}

/**
 * Creates a mock snapshot metadata file for the snapshot store
 */
async function createSnapshotMetadata(
  snapshotsDir: string,
  snapshotDate: string
): Promise<void> {
  const snapshotDir = path.join(snapshotsDir, snapshotDate)
  await fs.mkdir(snapshotDir, { recursive: true })

  const metadata = {
    snapshot_id: snapshotDate,
    created_at: new Date().toISOString(),
    status: 'success',
    schema_version: '1.0.0',
    calculation_version: '1.0.0',
    dataAsOfDate: snapshotDate,
  }

  await fs.writeFile(
    path.join(snapshotDir, 'metadata.json'),
    JSON.stringify(metadata, null, 2),
    'utf-8'
  )
}

/**
 * Creates an analytics directory with a district analytics file
 */
async function createAnalyticsFile(
  snapshotsDir: string,
  snapshotDate: string,
  districtId: string,
  content: unknown
): Promise<string> {
  const analyticsDir = path.join(snapshotsDir, snapshotDate, 'analytics')
  await fs.mkdir(analyticsDir, { recursive: true })

  const filePath = path.join(
    analyticsDir,
    `district_${districtId}_analytics.json`
  )
  await fs.writeFile(filePath, JSON.stringify(content, null, 2), 'utf-8')

  return filePath
}

/**
 * Creates a test Express app with the analytics endpoint
 * Uses dependency injection for the PreComputedAnalyticsReader
 */
function createTestApp(
  cacheDir: string,
  mockSnapshotStore?: {
    getLatestSuccessful: () => Promise<{ snapshot_id: string } | null>
  }
): Express {
  const app = express()
  app.use(cors())
  app.use(express.json())

  // Create PreComputedAnalyticsReader with test cache directory
  const reader = new PreComputedAnalyticsReader({ cacheDir })

  // Create a mock snapshot store that returns the test snapshot
  const snapshotStore = mockSnapshotStore ?? {
    getLatestSuccessful: async () => null,
  }

  // Create analytics router
  const router: Router = express.Router()

  /**
   * GET /api/districts/:districtId/analytics
   * Serves pre-computed district analytics
   * Requirements: 4.1, 4.2, 4.3, 4.5, 4.6, 11.1, 11.2, 11.3
   */
  router.get('/:districtId/analytics', async (req, res) => {
    try {
      const districtId = req.params['districtId']

      // Validate district ID
      if (!districtId || !/^[A-Za-z0-9]+$/.test(districtId)) {
        res.status(400).json({
          error: {
            code: 'INVALID_DISTRICT_ID',
            message: 'Invalid district ID format',
          },
        })
        return
      }

      // Get the latest snapshot to determine the snapshot date
      const latestSnapshot = await snapshotStore.getLatestSuccessful()

      if (!latestSnapshot) {
        res.status(404).json({
          error: {
            code: 'NO_DATA_AVAILABLE',
            message: 'No cached data available for analytics',
            details: 'Consider initiating a backfill to fetch historical data',
          },
        })
        return
      }

      const snapshotDate = latestSnapshot.snapshot_id

      // Read pre-computed analytics from file system
      const analytics = await reader.readDistrictAnalytics(
        snapshotDate,
        districtId
      )

      // Return 404 if analytics not found
      if (analytics === null) {
        res.status(404).json({
          error: {
            code: 'NO_DATA_AVAILABLE',
            message: `Analytics not available for district ${districtId} on ${snapshotDate}`,
            details:
              'Pre-computed analytics have not been generated for this district. Run the compute-analytics command in scraper-cli.',
          },
        })
        return
      }

      // Set cache control headers
      res.set('Cache-Control', 'public, max-age=300')
      res.json(analytics)
    } catch (error) {
      // Handle schema version mismatch
      if (error instanceof SchemaVersionError) {
        res.status(500).json({
          error: {
            code: 'SCHEMA_VERSION_MISMATCH',
            message: 'Incompatible analytics schema version',
            details: `The pre-computed analytics file has schema version ${error.fileVersion} which is incompatible with the current backend version. Re-run compute-analytics to regenerate.`,
          },
        })
        return
      }

      // Handle corrupted file
      if (error instanceof CorruptedFileError) {
        res.status(500).json({
          error: {
            code: 'CORRUPTED_FILE',
            message: 'Corrupted analytics file',
            details:
              'The pre-computed analytics file is corrupted or contains invalid JSON. Re-run compute-analytics to regenerate.',
          },
        })
        return
      }

      // Handle other errors
      res.status(500).json({
        error: {
          code: 'ANALYTICS_ERROR',
          message: 'Failed to read analytics',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      })
    }
  })

  app.use('/api/districts', router)

  return app
}

describe('PreComputedAnalyticsReader Integration Tests', () => {
  let testConfig: TestConfig
  let app: Express

  beforeEach(async () => {
    testConfig = await createIsolatedTestConfig('backend-serving')
  })

  afterEach(async () => {
    await testConfig.cleanup()
  })

  describe('Backend serves pre-computed analytics from local file system', () => {
    /**
     * Test: Backend serves pre-computed analytics from local file system
     * Requirements: 11.1, 11.3
     */
    it('should serve pre-computed analytics from local file system', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'
      const districtId = '42'

      // Create snapshot metadata
      await createSnapshotMetadata(testConfig.snapshotsDir, snapshotDate)

      // Create analytics file
      const analyticsFile = createValidDistrictAnalyticsFile(
        districtId,
        snapshotDate
      )
      await createAnalyticsFile(
        testConfig.snapshotsDir,
        snapshotDate,
        districtId,
        analyticsFile
      )

      // Create app with mock snapshot store
      app = createTestApp(testConfig.cacheDir, {
        getLatestSuccessful: async () => ({ snapshot_id: snapshotDate }),
      })

      // Act
      const response = await request(app)
        .get(`/api/districts/${districtId}/analytics`)
        .expect(200)

      // Assert
      expect(response.body).toBeDefined()
      expect(response.body.districtId).toBe(districtId)
      expect(response.body.totalMembership).toBe(500)
    })

    /**
     * Test: API response matches file content exactly
     * Requirements: 4.3, 11.1
     */
    it('should return API response that matches file content exactly', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'
      const districtId = '42'

      await createSnapshotMetadata(testConfig.snapshotsDir, snapshotDate)

      const analyticsFile = createValidDistrictAnalyticsFile(
        districtId,
        snapshotDate
      )
      await createAnalyticsFile(
        testConfig.snapshotsDir,
        snapshotDate,
        districtId,
        analyticsFile
      )

      app = createTestApp(testConfig.cacheDir, {
        getLatestSuccessful: async () => ({ snapshot_id: snapshotDate }),
      })

      // Act
      const response = await request(app)
        .get(`/api/districts/${districtId}/analytics`)
        .expect(200)

      // Assert - verify response matches file data exactly
      expect(response.body).toEqual(analyticsFile.data)
    })
  })

  describe('Error handling', () => {
    /**
     * Test: Returns 404 when analytics file not found
     * Requirements: 4.2
     */
    it('should return 404 when analytics file not found', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'
      const districtId = '99' // Non-existent district

      // Create snapshot metadata but no analytics file
      await createSnapshotMetadata(testConfig.snapshotsDir, snapshotDate)

      app = createTestApp(testConfig.cacheDir, {
        getLatestSuccessful: async () => ({ snapshot_id: snapshotDate }),
      })

      // Act
      const response = await request(app)
        .get(`/api/districts/${districtId}/analytics`)
        .expect(404)

      // Assert
      expect(response.body.error.code).toBe('NO_DATA_AVAILABLE')
      expect(response.body.error.message).toContain('Analytics not available')
      expect(response.body.error.message).toContain(districtId)
    })

    /**
     * Test: Returns 404 when no snapshot available
     */
    it('should return 404 when no snapshot available', async () => {
      // Arrange - no snapshot store data
      app = createTestApp(testConfig.cacheDir, {
        getLatestSuccessful: async () => null,
      })

      // Act
      const response = await request(app)
        .get('/api/districts/42/analytics')
        .expect(404)

      // Assert
      expect(response.body.error.code).toBe('NO_DATA_AVAILABLE')
      expect(response.body.error.message).toContain('No cached data available')
    })

    /**
     * Test: Returns 500 when analytics file is corrupted/invalid JSON
     * Requirements: 10.3, 10.5
     */
    it('should return 500 when analytics file is corrupted/invalid JSON', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'
      const districtId = '42'

      await createSnapshotMetadata(testConfig.snapshotsDir, snapshotDate)

      // Create corrupted analytics file
      const analyticsDir = path.join(
        testConfig.snapshotsDir,
        snapshotDate,
        'analytics'
      )
      await fs.mkdir(analyticsDir, { recursive: true })
      await fs.writeFile(
        path.join(analyticsDir, `district_${districtId}_analytics.json`),
        'not valid json {{{',
        'utf-8'
      )

      app = createTestApp(testConfig.cacheDir, {
        getLatestSuccessful: async () => ({ snapshot_id: snapshotDate }),
      })

      // Act
      const response = await request(app)
        .get(`/api/districts/${districtId}/analytics`)
        .expect(500)

      // Assert
      expect(response.body.error.code).toBe('CORRUPTED_FILE')
      expect(response.body.error.message).toContain('Corrupted analytics file')
    })

    /**
     * Test: Returns 500 when schema version is incompatible
     * Requirements: 4.4, 4.5
     */
    it('should return 500 when schema version is incompatible', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'
      const districtId = '42'

      await createSnapshotMetadata(testConfig.snapshotsDir, snapshotDate)

      // Create analytics file with incompatible schema version (major version mismatch)
      const analyticsFile = createValidDistrictAnalyticsFile(
        districtId,
        snapshotDate,
        '9.0.0' // Incompatible major version
      )
      await createAnalyticsFile(
        testConfig.snapshotsDir,
        snapshotDate,
        districtId,
        analyticsFile
      )

      app = createTestApp(testConfig.cacheDir, {
        getLatestSuccessful: async () => ({ snapshot_id: snapshotDate }),
      })

      // Act
      const response = await request(app)
        .get(`/api/districts/${districtId}/analytics`)
        .expect(500)

      // Assert
      expect(response.body.error.code).toBe('SCHEMA_VERSION_MISMATCH')
      expect(response.body.error.message).toContain(
        'Incompatible analytics schema version'
      )
      expect(response.body.error.details).toContain('9.0.0')
    })
  })

  describe('API response structure matches DistrictAnalytics type', () => {
    /**
     * Test: API response structure matches DistrictAnalytics type expected by frontend
     * Requirements: 4.3
     */
    it('should return response with all required DistrictAnalytics fields', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'
      const districtId = '42'

      await createSnapshotMetadata(testConfig.snapshotsDir, snapshotDate)

      const analyticsFile = createValidDistrictAnalyticsFile(
        districtId,
        snapshotDate
      )
      await createAnalyticsFile(
        testConfig.snapshotsDir,
        snapshotDate,
        districtId,
        analyticsFile
      )

      app = createTestApp(testConfig.cacheDir, {
        getLatestSuccessful: async () => ({ snapshot_id: snapshotDate }),
      })

      // Act
      const response = await request(app)
        .get(`/api/districts/${districtId}/analytics`)
        .expect(200)

      // Assert - verify all required DistrictAnalytics fields are present
      const analytics = response.body

      // Required fields per DistrictAnalytics interface
      expect(analytics).toHaveProperty('districtId')
      expect(analytics).toHaveProperty('dateRange')
      expect(analytics.dateRange).toHaveProperty('start')
      expect(analytics.dateRange).toHaveProperty('end')
      expect(analytics).toHaveProperty('totalMembership')
      expect(analytics).toHaveProperty('membershipChange')
      expect(analytics).toHaveProperty('membershipTrend')
      expect(Array.isArray(analytics.membershipTrend)).toBe(true)
      expect(analytics).toHaveProperty('allClubs')
      expect(Array.isArray(analytics.allClubs)).toBe(true)
      expect(analytics).toHaveProperty('vulnerableClubs')
      expect(Array.isArray(analytics.vulnerableClubs)).toBe(true)
      expect(analytics).toHaveProperty('thrivingClubs')
      expect(Array.isArray(analytics.thrivingClubs)).toBe(true)
      expect(analytics).toHaveProperty('interventionRequiredClubs')
      expect(Array.isArray(analytics.interventionRequiredClubs)).toBe(true)
      expect(analytics).toHaveProperty('distinguishedClubs')
      expect(Array.isArray(analytics.distinguishedClubs)).toBe(true)
      expect(analytics).toHaveProperty('distinguishedProjection')
      expect(analytics.distinguishedProjection).toHaveProperty(
        'projectedDistinguished'
      )
      expect(analytics.distinguishedProjection).toHaveProperty(
        'projectedSelect'
      )
      expect(analytics.distinguishedProjection).toHaveProperty(
        'projectedPresident'
      )
      expect(analytics).toHaveProperty('divisionRankings')
      expect(Array.isArray(analytics.divisionRankings)).toBe(true)
      expect(analytics).toHaveProperty('topPerformingAreas')
      expect(Array.isArray(analytics.topPerformingAreas)).toBe(true)
    })

    /**
     * Test: Membership trend data has correct structure
     */
    it('should return membership trend with date and count fields', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'
      const districtId = '42'

      await createSnapshotMetadata(testConfig.snapshotsDir, snapshotDate)

      const analyticsFile = createValidDistrictAnalyticsFile(
        districtId,
        snapshotDate
      )
      await createAnalyticsFile(
        testConfig.snapshotsDir,
        snapshotDate,
        districtId,
        analyticsFile
      )

      app = createTestApp(testConfig.cacheDir, {
        getLatestSuccessful: async () => ({ snapshot_id: snapshotDate }),
      })

      // Act
      const response = await request(app)
        .get(`/api/districts/${districtId}/analytics`)
        .expect(200)

      // Assert
      const trendPoint = response.body.membershipTrend[0]
      expect(trendPoint).toHaveProperty('date')
      expect(trendPoint).toHaveProperty('count')
      expect(typeof trendPoint.date).toBe('string')
      expect(typeof trendPoint.count).toBe('number')
    })

    /**
     * Test: Club data has correct structure
     */
    it('should return club data with required fields', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'
      const districtId = '42'

      await createSnapshotMetadata(testConfig.snapshotsDir, snapshotDate)

      const analyticsFile = createValidDistrictAnalyticsFile(
        districtId,
        snapshotDate
      )
      await createAnalyticsFile(
        testConfig.snapshotsDir,
        snapshotDate,
        districtId,
        analyticsFile
      )

      app = createTestApp(testConfig.cacheDir, {
        getLatestSuccessful: async () => ({ snapshot_id: snapshotDate }),
      })

      // Act
      const response = await request(app)
        .get(`/api/districts/${districtId}/analytics`)
        .expect(200)

      // Assert
      const club = response.body.allClubs[0]
      expect(club).toHaveProperty('clubId')
      expect(club).toHaveProperty('clubName')
      expect(club).toHaveProperty('currentStatus')
      expect(club).toHaveProperty('riskFactors')
      // riskFactors is an object with boolean properties, not an array
      expect(typeof club.riskFactors).toBe('object')
      expect(club.riskFactors).toHaveProperty('lowMembership')
      expect(club.riskFactors).toHaveProperty('decliningMembership')
      expect(club.riskFactors).toHaveProperty('lowPayments')
      expect(club.riskFactors).toHaveProperty('inactiveOfficers')
      expect(club.riskFactors).toHaveProperty('noRecentMeetings')
    })
  })

  describe('CACHE_DIR configuration', () => {
    /**
     * Test: Backend uses CACHE_DIR configuration correctly
     * Requirements: 11.2
     */
    it('should use the configured cache directory for reading analytics', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'
      const districtId = '42'

      // Create analytics in the test cache directory
      await createSnapshotMetadata(testConfig.snapshotsDir, snapshotDate)

      const analyticsFile = createValidDistrictAnalyticsFile(
        districtId,
        snapshotDate
      )
      await createAnalyticsFile(
        testConfig.snapshotsDir,
        snapshotDate,
        districtId,
        analyticsFile
      )

      // Create app with the test cache directory
      app = createTestApp(testConfig.cacheDir, {
        getLatestSuccessful: async () => ({ snapshot_id: snapshotDate }),
      })

      // Act
      const response = await request(app)
        .get(`/api/districts/${districtId}/analytics`)
        .expect(200)

      // Assert - if we got a 200, the cache directory was used correctly
      expect(response.body.districtId).toBe(districtId)
    })
  })

  describe('Multiple districts', () => {
    /**
     * Test: Backend serves analytics for different districts independently
     */
    it('should serve analytics for different districts independently', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'

      await createSnapshotMetadata(testConfig.snapshotsDir, snapshotDate)

      // Create analytics for district 42
      const analytics42 = createValidDistrictAnalyticsFile('42', snapshotDate)
      analytics42.data.totalMembership = 500
      await createAnalyticsFile(
        testConfig.snapshotsDir,
        snapshotDate,
        '42',
        analytics42
      )

      // Create analytics for district 61
      const analytics61 = createValidDistrictAnalyticsFile('61', snapshotDate)
      analytics61.data.totalMembership = 750
      await createAnalyticsFile(
        testConfig.snapshotsDir,
        snapshotDate,
        '61',
        analytics61
      )

      app = createTestApp(testConfig.cacheDir, {
        getLatestSuccessful: async () => ({ snapshot_id: snapshotDate }),
      })

      // Act
      const response42 = await request(app)
        .get('/api/districts/42/analytics')
        .expect(200)

      const response61 = await request(app)
        .get('/api/districts/61/analytics')
        .expect(200)

      // Assert
      expect(response42.body.districtId).toBe('42')
      expect(response42.body.totalMembership).toBe(500)

      expect(response61.body.districtId).toBe('61')
      expect(response61.body.totalMembership).toBe(750)
    })
  })

  describe('Input validation', () => {
    /**
     * Test: Returns 400 for invalid district ID format
     */
    it('should return 400 for invalid district ID format', async () => {
      // Arrange
      app = createTestApp(testConfig.cacheDir, {
        getLatestSuccessful: async () => ({ snapshot_id: '2024-01-15' }),
      })

      // Act
      const response = await request(app)
        .get('/api/districts/invalid@id/analytics')
        .expect(400)

      // Assert
      expect(response.body.error.code).toBe('INVALID_DISTRICT_ID')
    })

    /**
     * Test: Accepts alphanumeric district IDs
     */
    it('should accept alphanumeric district IDs', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'
      const districtId = 'F' // Alphanumeric district ID

      await createSnapshotMetadata(testConfig.snapshotsDir, snapshotDate)

      const analyticsFile = createValidDistrictAnalyticsFile(
        districtId,
        snapshotDate
      )
      await createAnalyticsFile(
        testConfig.snapshotsDir,
        snapshotDate,
        districtId,
        analyticsFile
      )

      app = createTestApp(testConfig.cacheDir, {
        getLatestSuccessful: async () => ({ snapshot_id: snapshotDate }),
      })

      // Act
      const response = await request(app)
        .get(`/api/districts/${districtId}/analytics`)
        .expect(200)

      // Assert
      expect(response.body.districtId).toBe(districtId)
    })
  })
})
