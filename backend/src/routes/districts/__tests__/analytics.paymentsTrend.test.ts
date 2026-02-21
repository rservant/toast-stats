/**
 * Unit tests for the analytics endpoint payments trend change
 *
 * Tests the GET /api/districts/:districtId/analytics endpoint's
 * paymentsTrend behavior after switching from readMembershipAnalytics
 * to the time-series index via getTimeSeriesIndexService().
 *
 * Requirements:
 * - 1.1: When startDate+endDate provided, retrieve paymentsTrend from TimeSeriesIndexService
 * - 1.2: Map each data point to { date, payments } and include as paymentsTrend
 * - 1.3: When getTrendData returns empty or throws, omit paymentsTrend
 * - 1.4: When no startDate/endDate provided, omit paymentsTrend
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import express, { type Express } from 'express'
import request from 'supertest'

// Use vi.hoisted to define mocks used in vi.mock factories
const {
  mockGetSnapshotForDate,
  mockGetTimeSeriesIndexService,
  mockReadDistrictAnalytics,
  mockReadPerformanceTargets,
} = vi.hoisted(() => ({
  mockGetSnapshotForDate: vi.fn(),
  mockGetTimeSeriesIndexService: vi.fn(),
  mockReadDistrictAnalytics: vi.fn(),
  mockReadPerformanceTargets: vi.fn(),
}))

// Mock the shared module
vi.mock('../shared.js', () => ({
  getValidDistrictId: vi.fn(
    (req: { params: Record<string, string | undefined> }) => {
      const districtId = req.params['districtId']
      if (!districtId || !/^[A-Za-z0-9]+$/.test(districtId)) {
        return null
      }
      return districtId
    }
  ),
  validateDateFormat: vi.fn((date: string) => {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(date)) {
      return false
    }
    const parsedDate = new Date(date)
    return !isNaN(parsedDate.getTime())
  }),
  extractStringParam: vi.fn((value: unknown, _paramName: string) => {
    if (typeof value === 'string') return value
    return 'unknown'
  }),
  validateDistrictId: vi.fn(() => true),
  getSnapshotForDate: mockGetSnapshotForDate,
  getTimeSeriesIndexService: mockGetTimeSeriesIndexService,
  snapshotStore: { getLatestSuccessful: vi.fn() },
  cacheDirectory: '/tmp/test-cache',
  analyticsFileReader: undefined,
}))

// Mock the cache middleware (pass-through)
vi.mock('../../../middleware/cache.js', () => ({
  cacheMiddleware: vi.fn(
    () =>
      (
        _req: express.Request,
        _res: express.Response,
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
  transformErrorResponse: vi.fn((error: unknown) => ({
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
  transformPerformanceTargets: vi.fn((targets: unknown) => targets),
}))

// Mock the PreComputedAnalyticsReader
vi.mock('../../../services/PreComputedAnalyticsReader.js', () => ({
  PreComputedAnalyticsReader: class {
    readDistrictAnalytics = mockReadDistrictAnalytics
    readPerformanceTargets = mockReadPerformanceTargets
  },
  SchemaVersionError: class extends Error {
    fileVersion: string
    filePath: string
    constructor(message: string, fileVersion: string, filePath: string) {
      super(message)
      this.fileVersion = fileVersion
      this.filePath = filePath
    }
  },
  CorruptedFileError: class extends Error {
    filePath: string
    override cause: Error
    constructor(message: string, filePath: string, cause: Error) {
      super(message)
      this.filePath = filePath
      this.cause = cause
    }
  },
}))

// Mock analytics-core for ANALYTICS_SCHEMA_VERSION
vi.mock('@toastmasters/analytics-core', () => ({
  ANALYTICS_SCHEMA_VERSION: '1.0.0',
}))

// Import the router under test (after mocks are set up)
import { analyticsRouter } from '../analytics.js'

/**
 * Creates a minimal mock DistrictAnalytics object for testing.
 * Only includes fields needed by the analytics endpoint response.
 */
function createMinimalMockAnalytics() {
  return {
    districtId: '42',
    snapshotDate: '2024-01-15',
    dateRange: { start: '2024-07-01', end: '2024-01-15' },
    totalMembership: 1500,
    membershipChange: 50,
    membershipTrend: [],
    allClubs: [],
    thrivingClubs: [],
    vulnerableClubs: [],
    interventionRequiredClubs: [],
    distinguishedClubs: {
      smedley: 2,
      presidents: 5,
      select: 8,
      distinguished: 10,
      total: 25,
    },
    distinguishedClubsList: [],
    distinguishedProjection: {
      projectedDistinguished: 30,
      currentDistinguished: 25,
      currentSelect: 8,
      currentPresident: 5,
      projectionDate: '2024-01-15',
    },
    divisionRankings: [],
    topPerformingAreas: [],
  }
}

/**
 * Creates a mock TimeSeriesDataPoint for testing.
 */
function createMockTimeSeriesDataPoint(overrides: {
  date: string
  payments?: number
}) {
  return {
    date: overrides.date,
    snapshotId: overrides.date,
    membership: 1000,
    payments: overrides.payments ?? 150,
    dcpGoals: 100,
    distinguishedTotal: 15,
    clubCounts: {
      total: 50,
      thriving: 30,
      vulnerable: 15,
      interventionRequired: 5,
    },
  }
}

describe('Analytics Endpoint — Payments Trend (Requirements 1.1–1.4)', () => {
  let app: Express

  beforeEach(() => {
    app = express()
    app.use(express.json())
    app.use('/api/districts', analyticsRouter)

    vi.clearAllMocks()

    // Default: getSnapshotForDate returns a valid snapshot
    mockGetSnapshotForDate.mockResolvedValue({
      snapshot: {
        snapshot_id: '2024-01-15',
        created_at: '2024-01-15T10:00:00Z',
      },
      snapshotDate: '2024-01-15',
    })

    // Default: readDistrictAnalytics returns valid analytics
    mockReadDistrictAnalytics.mockResolvedValue(createMinimalMockAnalytics())

    // Default: readPerformanceTargets returns null (no targets)
    mockReadPerformanceTargets.mockResolvedValue(null)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('GET /api/districts/:districtId/analytics', () => {
    it('should include paymentsTrend when startDate and endDate are provided (Req 1.1, 1.2)', async () => {
      // Requirement 1.1: When startDate+endDate are present, retrieve from TimeSeriesIndexService
      // Requirement 1.2: Map each data point to { date, payments }
      const mockTrendData = [
        createMockTimeSeriesDataPoint({ date: '2024-01-01', payments: 180 }),
        createMockTimeSeriesDataPoint({ date: '2024-01-08', payments: 195 }),
        createMockTimeSeriesDataPoint({ date: '2024-01-15', payments: 210 }),
      ]

      const mockTimeSeriesService = {
        getTrendData: vi.fn().mockResolvedValue(mockTrendData),
      }
      mockGetTimeSeriesIndexService.mockResolvedValue(mockTimeSeriesService)

      const response = await request(app)
        .get('/api/districts/42/analytics')
        .query({ startDate: '2024-01-01', endDate: '2024-01-31' })
        .expect(200)

      // paymentsTrend MUST be present with mapped { date, payments } objects
      expect(response.body.paymentsTrend).toBeDefined()
      expect(response.body.paymentsTrend).toHaveLength(3)
      expect(response.body.paymentsTrend[0]).toEqual({
        date: '2024-01-01',
        payments: 180,
      })
      expect(response.body.paymentsTrend[1]).toEqual({
        date: '2024-01-08',
        payments: 195,
      })
      expect(response.body.paymentsTrend[2]).toEqual({
        date: '2024-01-15',
        payments: 210,
      })

      // Verify getTrendData was called with correct arguments
      expect(mockTimeSeriesService.getTrendData).toHaveBeenCalledWith(
        '42',
        '2024-01-01',
        '2024-01-31'
      )
    })

    it('should omit paymentsTrend when no date params are provided (Req 1.4)', async () => {
      // Requirement 1.4: When no startDate/endDate, omit paymentsTrend entirely
      const mockTimeSeriesService = {
        getTrendData: vi.fn(),
      }
      mockGetTimeSeriesIndexService.mockResolvedValue(mockTimeSeriesService)

      const response = await request(app)
        .get('/api/districts/42/analytics')
        .expect(200)

      // paymentsTrend MUST NOT be present in the response
      expect(response.body.paymentsTrend).toBeUndefined()

      // getTrendData should NOT have been called
      expect(mockTimeSeriesService.getTrendData).not.toHaveBeenCalled()
    })

    it('should omit paymentsTrend when getTrendData returns empty array (Req 1.3)', async () => {
      // Requirement 1.3: When TimeSeriesIndexService returns empty array, omit paymentsTrend
      const mockTimeSeriesService = {
        getTrendData: vi.fn().mockResolvedValue([]),
      }
      mockGetTimeSeriesIndexService.mockResolvedValue(mockTimeSeriesService)

      const response = await request(app)
        .get('/api/districts/42/analytics')
        .query({ startDate: '2024-01-01', endDate: '2024-01-31' })
        .expect(200)

      // paymentsTrend MUST NOT be present when data is empty
      expect(response.body.paymentsTrend).toBeUndefined()

      // getTrendData was still called — it just returned empty
      expect(mockTimeSeriesService.getTrendData).toHaveBeenCalledWith(
        '42',
        '2024-01-01',
        '2024-01-31'
      )
    })

    it('should omit paymentsTrend and still succeed when getTrendData throws (Req 1.3)', async () => {
      // Requirement 1.3: When TimeSeriesIndexService throws, omit paymentsTrend
      // and log a debug message — the response should still succeed with analytics data
      const mockTimeSeriesService = {
        getTrendData: vi
          .fn()
          .mockRejectedValue(new Error('Index file not found')),
      }
      mockGetTimeSeriesIndexService.mockResolvedValue(mockTimeSeriesService)

      const response = await request(app)
        .get('/api/districts/42/analytics')
        .query({ startDate: '2024-01-01', endDate: '2024-01-31' })
        .expect(200)

      // paymentsTrend MUST NOT be present when getTrendData throws
      expect(response.body.paymentsTrend).toBeUndefined()

      // The rest of the analytics response should still be present
      expect(response.body.districtId).toBe('42')
      expect(response.body.totalMembership).toBe(1500)
    })
  })
})
