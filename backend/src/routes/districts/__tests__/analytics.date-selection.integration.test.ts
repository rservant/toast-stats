/**
 * Integration tests for date-aware analytics endpoint
 *
 * Tests the date selection fix for analytics endpoints, verifying that:
 * - Requests with `endDate` return data from the specific snapshot
 * - Requests without `endDate` return data from the latest snapshot (backward compatibility)
 * - Requests with non-existent `endDate` return 404 with SNAPSHOT_NOT_FOUND error
 *
 * Requirements:
 * - 1.1: Use snapshotStore.getSnapshot(endDate) when date is provided
 * - 1.2: Use snapshotStore.getLatestSuccessful() when no date provided
 * - 1.3: Return 404 error when requested snapshot doesn't exist
 * - 6.1: Return HTTP status 404 for missing snapshots
 * - 6.2: Include error code SNAPSHOT_NOT_FOUND
 *
 * Test Isolation:
 * - Uses vi.mock for dependency injection
 * - Each test uses fresh mock instances
 * - Tests are safe for parallel execution
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import express, { type Express } from 'express'
import request from 'supertest'
import { analyticsRouter } from '../analytics.js'

// Use vi.hoisted to define mocks that are used in vi.mock factories
const {
  mockSnapshotStore,
  mockReadDistrictAnalytics,
  mockReadMembershipAnalytics,
  mockReadLeadershipInsights,
  mockReadVulnerableClubs,
  mockReadPerformanceTargets,
} = vi.hoisted(() => ({
  mockSnapshotStore: {
    getLatestSuccessful: vi.fn(),
    getSnapshot: vi.fn(),
  },
  mockReadDistrictAnalytics: vi.fn(),
  mockReadMembershipAnalytics: vi.fn(),
  mockReadLeadershipInsights: vi.fn(),
  mockReadVulnerableClubs: vi.fn(),
  mockReadPerformanceTargets: vi.fn(),
}))

// Mock the shared module with getSnapshotForDate helper
vi.mock('../shared.js', () => ({
  getValidDistrictId: vi.fn(req => {
    const districtId = req.params['districtId']
    if (!districtId || !/^[A-Za-z0-9]+$/.test(districtId)) {
      return null
    }
    return districtId
  }),
  validateDistrictId: vi.fn((districtId: string) => {
    return /^[A-Za-z0-9]+$/.test(districtId) && districtId.length > 0
  }),
  validateDateFormat: vi.fn((date: string) => {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(date)) {
      return false
    }
    const parsedDate = new Date(date)
    return !isNaN(parsedDate.getTime())
  }),
  extractStringParam: vi.fn((value, paramName) => {
    if (!value) {
      throw new Error(`Missing ${paramName} parameter`)
    }
    if (Array.isArray(value)) {
      throw new Error(
        `Invalid ${paramName} parameter: expected string, got array`
      )
    }
    return value
  }),
  cacheDirectory: '/tmp/test-cache',
  snapshotStore: mockSnapshotStore,
  // Implement getSnapshotForDate using the mock snapshotStore
  getSnapshotForDate: vi.fn(async (endDate?: string) => {
    // When no endDate is provided, use the latest successful snapshot
    if (!endDate) {
      const latestSnapshot = await mockSnapshotStore.getLatestSuccessful()
      if (!latestSnapshot) {
        return {
          snapshot: null,
          snapshotDate: null,
        }
      }
      return {
        snapshot: latestSnapshot,
        snapshotDate: latestSnapshot.snapshot_id,
      }
    }

    // When endDate is provided, get the specific snapshot for that date
    const snapshot = await mockSnapshotStore.getSnapshot(endDate)
    if (!snapshot) {
      return {
        snapshot: null,
        snapshotDate: null,
        error: {
          code: 'SNAPSHOT_NOT_FOUND',
          message: `Snapshot not found for date ${endDate}`,
          details:
            'The requested snapshot does not exist. Try a different date or check available snapshots.',
        },
      }
    }

    return {
      snapshot,
      snapshotDate: snapshot.snapshot_id,
    }
  }),
}))

// Mock the cache middleware
vi.mock('../../../middleware/cache.js', () => ({
  cacheMiddleware: vi.fn(
    () =>
      (
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
      ) =>
        next()
  ),
}))

// Mock the cache keys utility
vi.mock('../../../utils/cacheKeys.js', () => ({
  generateDistrictCacheKey: vi.fn(() => 'test-cache-key'),
}))

// Mock the logger
vi.mock('../../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// Mock the transformers
vi.mock('../../../utils/transformers.js', () => ({
  transformErrorResponse: vi.fn(error => ({
    code: 'TEST_ERROR',
    message: error instanceof Error ? error.message : 'Unknown error',
    details: 'Test error details',
  })),
}))

// Mock the legacy transformation utilities
vi.mock('../../../utils/legacyTransformation.js', () => ({
  isLegacyDistinguishedClubsFormat: vi.fn(() => false),
  transformLegacyDistinguishedClubs: vi.fn(),
}))

// Mock the performance targets transformation
vi.mock('../../../utils/performanceTargetsTransformation.js', () => ({
  transformPerformanceTargets: vi.fn(targets => targets),
}))

// Mock the PreComputedAnalyticsReader
vi.mock('../../../services/PreComputedAnalyticsReader.js', () => ({
  PreComputedAnalyticsReader: class MockPreComputedAnalyticsReader {
    readDistrictAnalytics = mockReadDistrictAnalytics
    readMembershipAnalytics = mockReadMembershipAnalytics
    readLeadershipInsights = mockReadLeadershipInsights
    readVulnerableClubs = mockReadVulnerableClubs
    readPerformanceTargets = mockReadPerformanceTargets
  },
  SchemaVersionError: class SchemaVersionError extends Error {
    constructor(
      public fileVersion: string,
      public filePath: string
    ) {
      super(`Schema version mismatch: ${fileVersion}`)
    }
  },
  CorruptedFileError: class CorruptedFileError extends Error {
    constructor(
      public filePath: string,
      public cause: Error
    ) {
      super(`Corrupted file: ${filePath}`)
    }
  },
}))

/**
 * Helper to create a mock Snapshot object for testing
 */
function createMockSnapshot(snapshotId: string) {
  return {
    snapshot_id: snapshotId,
    created_at: new Date().toISOString(),
    schema_version: '1.0.0',
    calculation_version: '1.0.0',
    status: 'success',
    errors: [],
    payload: {
      districts: [],
      metadata: {
        source: 'test',
        fetchedAt: new Date().toISOString(),
        dataAsOfDate: snapshotId,
        districtCount: 0,
        processingDurationMs: 100,
      },
    },
  }
}

/**
 * Helper to create mock district analytics data
 */
function createMockDistrictAnalytics(snapshotDate: string) {
  return {
    districtId: '42',
    snapshotDate,
    totalMembership: 1500,
    membershipChange: 50,
    clubCounts: {
      total: 50,
      thriving: 30,
      vulnerable: 15,
      interventionRequired: 5,
    },
    distinguishedClubs: {
      smedley: 2,
      presidents: 5,
      select: 8,
      distinguished: 10,
      total: 25,
    },
    dateRange: {
      start: snapshotDate,
      end: snapshotDate,
    },
  }
}

describe('Analytics Date Selection Integration Tests', () => {
  let app: Express

  beforeEach(() => {
    app = express()
    app.use(express.json())
    app.use('/api/districts', analyticsRouter)

    // Reset all mocks
    vi.clearAllMocks()

    // Default mock for performance targets (returns null)
    mockReadPerformanceTargets.mockResolvedValue(null)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('GET /api/districts/:districtId/analytics - Date Selection', () => {
    /**
     * Test: Date-aware selection with valid endDate
     * Requirement 1.1: Use snapshotStore.getSnapshot(endDate) when date is provided
     *
     * Validates: Requirements 1.1
     */
    describe('Date-aware selection (Requirement 1.1)', () => {
      it('should return analytics from the specific snapshot when endDate is provided', async () => {
        // Arrange
        const requestedDate = '2024-01-15'
        const mockSnapshot = createMockSnapshot(requestedDate)
        const mockAnalytics = createMockDistrictAnalytics(requestedDate)

        mockSnapshotStore.getSnapshot.mockResolvedValue(mockSnapshot)
        mockReadDistrictAnalytics.mockResolvedValue(mockAnalytics)

        // Act
        const response = await request(app)
          .get('/api/districts/42/analytics')
          .query({ endDate: requestedDate })
          .expect(200)

        // Assert
        expect(mockSnapshotStore.getSnapshot).toHaveBeenCalledWith(
          requestedDate
        )
        expect(mockReadDistrictAnalytics).toHaveBeenCalledWith(
          requestedDate,
          '42'
        )
        expect(response.body.snapshotDate).toBe(requestedDate)
        expect(response.body.districtId).toBe('42')
      })

      it('should use the exact date provided in endDate parameter', async () => {
        // Arrange - test with a different date to ensure it's not hardcoded
        const requestedDate = '2023-07-22'
        const mockSnapshot = createMockSnapshot(requestedDate)
        const mockAnalytics = createMockDistrictAnalytics(requestedDate)

        mockSnapshotStore.getSnapshot.mockResolvedValue(mockSnapshot)
        mockReadDistrictAnalytics.mockResolvedValue(mockAnalytics)

        // Act
        const response = await request(app)
          .get('/api/districts/42/analytics')
          .query({ endDate: requestedDate })
          .expect(200)

        // Assert - verify the exact date was used
        expect(mockSnapshotStore.getSnapshot).toHaveBeenCalledWith('2023-07-22')
        expect(response.body.snapshotDate).toBe('2023-07-22')
      })
    })

    /**
     * Test: Backward compatibility - no endDate returns latest snapshot
     * Requirement 1.2: Use snapshotStore.getLatestSuccessful() when no date provided
     *
     * Validates: Requirements 1.2
     */
    describe('Backward compatibility - no date returns latest (Requirement 1.2)', () => {
      it('should return analytics from the latest snapshot when no endDate is provided', async () => {
        // Arrange
        const latestSnapshotDate = '2024-02-20'
        const mockLatestSnapshot = createMockSnapshot(latestSnapshotDate)
        const mockAnalytics = createMockDistrictAnalytics(latestSnapshotDate)

        mockSnapshotStore.getLatestSuccessful.mockResolvedValue(
          mockLatestSnapshot
        )
        mockReadDistrictAnalytics.mockResolvedValue(mockAnalytics)

        // Act
        const response = await request(app)
          .get('/api/districts/42/analytics')
          .expect(200)

        // Assert
        expect(mockSnapshotStore.getLatestSuccessful).toHaveBeenCalledTimes(1)
        expect(mockSnapshotStore.getSnapshot).not.toHaveBeenCalled()
        expect(mockReadDistrictAnalytics).toHaveBeenCalledWith(
          latestSnapshotDate,
          '42'
        )
        expect(response.body.snapshotDate).toBe(latestSnapshotDate)
      })

      it('should return 404 when no snapshots exist and no endDate provided', async () => {
        // Arrange
        mockSnapshotStore.getLatestSuccessful.mockResolvedValue(null)

        // Act
        const response = await request(app)
          .get('/api/districts/42/analytics')
          .expect(404)

        // Assert
        expect(response.body.error.code).toBe('NO_DATA_AVAILABLE')
        expect(mockSnapshotStore.getLatestSuccessful).toHaveBeenCalledTimes(1)
      })
    })

    /**
     * Test: Error handling for non-existent snapshots
     * Requirements 1.3, 6.1, 6.2: Return 404 with SNAPSHOT_NOT_FOUND when snapshot doesn't exist
     *
     * Validates: Requirements 1.3, 6.1, 6.2
     */
    describe('Error handling for non-existent snapshots (Requirements 1.3, 6.1, 6.2)', () => {
      it('should return 404 with SNAPSHOT_NOT_FOUND when requested snapshot does not exist', async () => {
        // Arrange
        const nonExistentDate = '2024-01-01'
        mockSnapshotStore.getSnapshot.mockResolvedValue(null)

        // Act
        const response = await request(app)
          .get('/api/districts/42/analytics')
          .query({ endDate: nonExistentDate })
          .expect(404)

        // Assert - Requirement 6.1: HTTP status 404
        expect(response.status).toBe(404)

        // Assert - Requirement 6.2: Error code is SNAPSHOT_NOT_FOUND
        expect(response.body.error.code).toBe('SNAPSHOT_NOT_FOUND')

        // Assert - Requirement 6.3: Message contains the requested date
        expect(response.body.error.message).toContain(nonExistentDate)

        // Assert - Requirement 6.4: Details provide guidance
        expect(response.body.error.details).toContain('different date')
      })

      it('should include the exact requested date in the error message', async () => {
        // Arrange
        const nonExistentDate = '2022-12-25'
        mockSnapshotStore.getSnapshot.mockResolvedValue(null)

        // Act
        const response = await request(app)
          .get('/api/districts/42/analytics')
          .query({ endDate: nonExistentDate })
          .expect(404)

        // Assert
        expect(response.body.error.message).toBe(
          `Snapshot not found for date ${nonExistentDate}`
        )
      })

      it('should not fall back to latest snapshot when requested date does not exist', async () => {
        // Arrange - ensure we don't silently fall back to latest
        const nonExistentDate = '2024-01-01'
        mockSnapshotStore.getSnapshot.mockResolvedValue(null)

        // Act
        await request(app)
          .get('/api/districts/42/analytics')
          .query({ endDate: nonExistentDate })
          .expect(404)

        // Assert - getLatestSuccessful should NOT be called when endDate is provided
        expect(mockSnapshotStore.getLatestSuccessful).not.toHaveBeenCalled()
        expect(mockSnapshotStore.getSnapshot).toHaveBeenCalledWith(
          nonExistentDate
        )
      })
    })
  })

  describe('GET /api/districts/:districtId/membership-analytics - Date Selection', () => {
    /**
     * Test: Date-aware selection for membership analytics
     * Requirement 2.1: Use snapshotStore.getSnapshot(endDate) when date is provided
     */
    it('should return membership analytics from specific snapshot when endDate is provided', async () => {
      // Arrange
      const requestedDate = '2024-01-15'
      const mockSnapshot = createMockSnapshot(requestedDate)
      const mockMembershipAnalytics = {
        districtId: '42',
        snapshotDate: requestedDate,
        totalMembers: 1500,
        newMembers: 50,
        renewals: 100,
      }

      mockSnapshotStore.getSnapshot.mockResolvedValue(mockSnapshot)
      mockReadMembershipAnalytics.mockResolvedValue(mockMembershipAnalytics)

      // Act
      const response = await request(app)
        .get('/api/districts/42/membership-analytics')
        .query({ endDate: requestedDate })
        .expect(200)

      // Assert
      expect(mockSnapshotStore.getSnapshot).toHaveBeenCalledWith(requestedDate)
      expect(mockReadMembershipAnalytics).toHaveBeenCalledWith(
        requestedDate,
        '42'
      )
      expect(response.body.snapshotDate).toBe(requestedDate)
    })

    /**
     * Test: Backward compatibility for membership analytics
     * Requirement 2.2: Use snapshotStore.getLatestSuccessful() when no date provided
     */
    it('should return membership analytics from latest snapshot when no endDate provided', async () => {
      // Arrange
      const latestDate = '2024-02-20'
      const mockLatestSnapshot = createMockSnapshot(latestDate)
      const mockMembershipAnalytics = {
        districtId: '42',
        snapshotDate: latestDate,
        totalMembers: 1600,
        newMembers: 60,
        renewals: 110,
      }

      mockSnapshotStore.getLatestSuccessful.mockResolvedValue(
        mockLatestSnapshot
      )
      mockReadMembershipAnalytics.mockResolvedValue(mockMembershipAnalytics)

      // Act
      const response = await request(app)
        .get('/api/districts/42/membership-analytics')
        .expect(200)

      // Assert
      expect(mockSnapshotStore.getLatestSuccessful).toHaveBeenCalledTimes(1)
      expect(mockSnapshotStore.getSnapshot).not.toHaveBeenCalled()
      expect(response.body.snapshotDate).toBe(latestDate)
    })

    /**
     * Test: Error handling for membership analytics
     * Requirement 2.3: Return 404 when requested snapshot doesn't exist
     */
    it('should return 404 with SNAPSHOT_NOT_FOUND for non-existent date', async () => {
      // Arrange
      const nonExistentDate = '2024-01-01'
      mockSnapshotStore.getSnapshot.mockResolvedValue(null)

      // Act
      const response = await request(app)
        .get('/api/districts/42/membership-analytics')
        .query({ endDate: nonExistentDate })
        .expect(404)

      // Assert
      expect(response.body.error.code).toBe('SNAPSHOT_NOT_FOUND')
      expect(response.body.error.message).toContain(nonExistentDate)
    })
  })

  describe('GET /api/districts/:districtId/leadership-insights - Date Selection', () => {
    /**
     * Test: Date-aware selection for leadership insights
     * Requirement 3.1: Use snapshotStore.getSnapshot(endDate) when date is provided
     */
    it('should return leadership insights from specific snapshot when endDate is provided', async () => {
      // Arrange
      const requestedDate = '2024-01-15'
      const mockSnapshot = createMockSnapshot(requestedDate)
      const mockLeadershipInsights = {
        districtId: '42',
        snapshotDate: requestedDate,
        leadershipEffectiveness: 0.85,
        clubsWithFullLeadership: 40,
      }

      mockSnapshotStore.getSnapshot.mockResolvedValue(mockSnapshot)
      mockReadLeadershipInsights.mockResolvedValue(mockLeadershipInsights)

      // Act
      const response = await request(app)
        .get('/api/districts/42/leadership-insights')
        .query({ endDate: requestedDate })
        .expect(200)

      // Assert
      expect(mockSnapshotStore.getSnapshot).toHaveBeenCalledWith(requestedDate)
      expect(mockReadLeadershipInsights).toHaveBeenCalledWith(
        requestedDate,
        '42'
      )
      expect(response.body.snapshotDate).toBe(requestedDate)
    })

    /**
     * Test: Error handling for leadership insights
     * Requirement 3.3: Return 404 when requested snapshot doesn't exist
     */
    it('should return 404 with SNAPSHOT_NOT_FOUND for non-existent date', async () => {
      // Arrange
      const nonExistentDate = '2024-01-01'
      mockSnapshotStore.getSnapshot.mockResolvedValue(null)

      // Act
      const response = await request(app)
        .get('/api/districts/42/leadership-insights')
        .query({ endDate: nonExistentDate })
        .expect(404)

      // Assert
      expect(response.body.error.code).toBe('SNAPSHOT_NOT_FOUND')
    })
  })

  describe('GET /api/districts/:districtId/vulnerable-clubs - Date Selection', () => {
    /**
     * Test: Date-aware selection for vulnerable clubs
     * Requirement 5.1: Use snapshotStore.getSnapshot(endDate) when date is provided
     */
    it('should return vulnerable clubs from specific snapshot when endDate is provided', async () => {
      // Arrange
      const requestedDate = '2024-01-15'
      const mockSnapshot = createMockSnapshot(requestedDate)
      const mockVulnerableClubs = {
        districtId: '42',
        totalVulnerableClubs: 15,
        interventionRequiredClubs: 5,
        vulnerableClubs: [],
        interventionRequired: [],
      }

      mockSnapshotStore.getSnapshot.mockResolvedValue(mockSnapshot)
      mockReadVulnerableClubs.mockResolvedValue(mockVulnerableClubs)

      // Act
      const response = await request(app)
        .get('/api/districts/42/vulnerable-clubs')
        .query({ endDate: requestedDate })
        .expect(200)

      // Assert
      expect(mockSnapshotStore.getSnapshot).toHaveBeenCalledWith(requestedDate)
      expect(mockReadVulnerableClubs).toHaveBeenCalledWith(requestedDate, '42')
      expect(response.body.totalVulnerableClubs).toBe(15)
    })

    /**
     * Test: Error handling for vulnerable clubs
     * Requirement 5.3: Return 404 when requested snapshot doesn't exist
     */
    it('should return 404 with SNAPSHOT_NOT_FOUND for non-existent date', async () => {
      // Arrange
      const nonExistentDate = '2024-01-01'
      mockSnapshotStore.getSnapshot.mockResolvedValue(null)

      // Act
      const response = await request(app)
        .get('/api/districts/42/vulnerable-clubs')
        .query({ endDate: nonExistentDate })
        .expect(404)

      // Assert
      expect(response.body.error.code).toBe('SNAPSHOT_NOT_FOUND')
    })
  })

  describe('Consistent Error Response Structure (Requirement 6)', () => {
    /**
     * Test: Error response structure consistency across all endpoints
     * Requirements 6.1, 6.2, 6.3, 6.4
     */
    it('should return consistent error structure across all analytics endpoints', async () => {
      // Arrange
      const nonExistentDate = '2024-01-01'
      mockSnapshotStore.getSnapshot.mockResolvedValue(null)

      const endpoints = [
        '/api/districts/42/analytics',
        '/api/districts/42/membership-analytics',
        '/api/districts/42/leadership-insights',
        '/api/districts/42/vulnerable-clubs',
      ]

      for (const endpoint of endpoints) {
        // Act
        const response = await request(app)
          .get(endpoint)
          .query({ endDate: nonExistentDate })
          .expect(404)

        // Assert - all endpoints should have consistent error structure
        expect(response.body.error).toBeDefined()
        expect(response.body.error.code).toBe('SNAPSHOT_NOT_FOUND')
        expect(response.body.error.message).toContain(nonExistentDate)
        expect(response.body.error.details).toBeDefined()
      }
    })
  })
})
