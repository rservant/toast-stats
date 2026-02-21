/**
 * Unit tests for the aggregated analytics summary endpoint
 *
 * Tests the GET /api/districts/:districtId/analytics-summary endpoint
 * which returns combined analytics data from pre-computed analytics
 * and time-series index.
 *
 * Requirements:
 * - 1.1: Read summary data from PreComputedAnalyticsReader.readDistrictAnalytics()
 * - 1.4: Return 404 when readDistrictAnalytics() returns null
 * - 1.5: Return 404 when no successful snapshot exists
 * - 2.1-2.4: Derive club counts from array lengths
 * - 3.1: Single readDistrictAnalytics() call for all per-district data
 * - 4.1: No dependency on PreComputedAnalyticsService
 * - 5.1-5.2: Response contract preserved, dataSource is "precomputed"
 * - 6.1, 6.3: Tests mock readDistrictAnalytics() and verify correct mapping
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import express, { type Express } from 'express'
import request from 'supertest'
import { analyticsSummaryRouter } from '../analyticsSummary.js'

// Use vi.hoisted to define mocks that are used in vi.mock factories
const { mockSnapshotStore, mockReadYearOverYear, mockReadDistrictAnalytics } =
  vi.hoisted(() => ({
    mockSnapshotStore: {
      getLatestSuccessful: vi.fn(),
    },
    mockReadYearOverYear: vi.fn(),
    mockReadDistrictAnalytics: vi.fn(),
  }))

// Mock the shared module
// Requirement 4.1: No dependency on PreComputedAnalyticsService — getPreComputedAnalyticsService is NOT mocked
vi.mock('../shared.js', () => ({
  getValidDistrictId: vi.fn(req => {
    const districtId = req.params['districtId']
    if (!districtId || !/^[A-Za-z0-9]+$/.test(districtId)) {
      return null
    }
    return districtId
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
  getTimeSeriesIndexService: vi.fn(),
  cacheDirectory: '/tmp/test-cache',
  snapshotStore: mockSnapshotStore,
  analyticsFileReader: undefined,
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

// Mock the request deduplication middleware
vi.mock('../../../middleware/requestDeduplication.js', () => ({
  requestDeduplicationMiddleware: vi.fn(
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

// Mock the PreComputedAnalyticsReader
// Requirement 6.1: Mock readDistrictAnalytics() instead of PreComputedAnalyticsService.getLatestSummary()
vi.mock('../../../services/PreComputedAnalyticsReader.js', () => ({
  PreComputedAnalyticsReader: class MockPreComputedAnalyticsReader {
    readYearOverYear = mockReadYearOverYear
    readDistrictAnalytics = mockReadDistrictAnalytics
  },
}))

// Import mocked functions
import { getTimeSeriesIndexService } from '../shared.js'

/**
 * Helper to create a realistic DistrictAnalytics mock object.
 * Club counts are derived from array lengths (Requirements 2.1-2.4).
 *
 * @param overrides - Partial overrides for the DistrictAnalytics fields
 */
function createMockDistrictAnalytics(overrides?: {
  totalMembership?: number
  membershipChange?: number
  allClubsCount?: number
  thrivingClubsCount?: number
  vulnerableClubsCount?: number
  interventionRequiredClubsCount?: number
  distinguishedClubs?: {
    smedley: number
    presidents: number
    select: number
    distinguished: number
    total: number
  }
  projectedDistinguished?: number
}) {
  const allClubsCount = overrides?.allClubsCount ?? 50
  const thrivingClubsCount = overrides?.thrivingClubsCount ?? 30
  const vulnerableClubsCount = overrides?.vulnerableClubsCount ?? 15
  const interventionRequiredClubsCount =
    overrides?.interventionRequiredClubsCount ?? 5

  const makeClub = (id: number, status: string) => ({
    clubId: `club-${id}`,
    clubName: `Club ${id}`,
    divisionId: 'A',
    divisionName: 'Division A',
    areaId: 'A1',
    areaName: 'Area A1',
    currentStatus: status,
    healthScore: 0.8,
    membershipCount: 25,
    paymentsCount: 20,
    membershipTrend: [],
    dcpGoalsTrend: [],
    riskFactors: [],
    distinguishedLevel: 'none',
  })

  return {
    districtId: '42',
    dateRange: { start: '2024-07-01', end: '2024-01-15' },
    totalMembership: overrides?.totalMembership ?? 1500,
    membershipChange: overrides?.membershipChange ?? 50,
    membershipTrend: [],
    allClubs: Array.from({ length: allClubsCount }, (_, i) =>
      makeClub(i, 'thriving')
    ),
    thrivingClubs: Array.from({ length: thrivingClubsCount }, (_, i) =>
      makeClub(i, 'thriving')
    ),
    vulnerableClubs: Array.from({ length: vulnerableClubsCount }, (_, i) =>
      makeClub(i, 'vulnerable')
    ),
    interventionRequiredClubs: Array.from(
      { length: interventionRequiredClubsCount },
      (_, i) => makeClub(i, 'intervention-required')
    ),
    distinguishedClubs: overrides?.distinguishedClubs ?? {
      smedley: 2,
      presidents: 5,
      select: 8,
      distinguished: 10,
      total: 25,
    },
    distinguishedClubsList: [],
    distinguishedProjection: {
      projectedDistinguished: overrides?.projectedDistinguished ?? 30,
      currentDistinguished: 25,
      currentSelect: 8,
      currentPresident: 5,
      projectionDate: '2024-01-15',
    },
    divisionRankings: [],
    topPerformingAreas: [],
  }
}

describe('Analytics Summary Route', () => {
  let app: Express

  beforeEach(() => {
    app = express()
    app.use(express.json())
    app.use('/api/districts', analyticsSummaryRouter)

    // Reset all mocks
    vi.clearAllMocks()

    // Default mock for snapshotStore — includes created_at (used for computedAt)
    mockSnapshotStore.getLatestSuccessful.mockResolvedValue({
      snapshot_id: '2024-01-15',
      created_at: '2024-01-15T10:00:00Z',
    })

    // Default mock for readYearOverYear
    mockReadYearOverYear.mockResolvedValue(null)

    // Default mock for readDistrictAnalytics — returns a full DistrictAnalytics object
    // Requirement 6.1: Mock readDistrictAnalytics() with DistrictAnalytics shape
    mockReadDistrictAnalytics.mockResolvedValue(createMockDistrictAnalytics())
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('GET /api/districts/:districtId/analytics-summary', () => {
    describe('Input Validation', () => {
      it('should return 400 for invalid district ID', async () => {
        const response = await request(app)
          .get('/api/districts/invalid-id!/analytics-summary')
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_DISTRICT_ID')
      })

      it('should return 400 for invalid startDate format', async () => {
        const response = await request(app)
          .get('/api/districts/42/analytics-summary')
          .query({ startDate: 'invalid-date' })
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_DATE_FORMAT')
        expect(response.body.error.message).toContain('startDate')
      })

      it('should return 400 for invalid endDate format', async () => {
        const response = await request(app)
          .get('/api/districts/42/analytics-summary')
          .query({ endDate: '2024/01/01' })
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_DATE_FORMAT')
        expect(response.body.error.message).toContain('endDate')
      })

      it('should return 400 when startDate is after endDate', async () => {
        const response = await request(app)
          .get('/api/districts/42/analytics-summary')
          .query({ startDate: '2024-12-31', endDate: '2024-01-01' })
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_DATE_RANGE')
      })
    })

    describe('Successful Response with Pre-computed Data', () => {
      it('should return aggregated analytics from pre-computed district analytics', async () => {
        // Requirement 6.3: Verify response contains correctly mapped summary fields
        // including club counts derived from array lengths
        const mockAnalytics = createMockDistrictAnalytics({
          totalMembership: 1500,
          membershipChange: 50,
          allClubsCount: 50,
          thrivingClubsCount: 30,
          vulnerableClubsCount: 15,
          interventionRequiredClubsCount: 5,
          distinguishedClubs: {
            smedley: 2,
            presidents: 5,
            select: 8,
            distinguished: 10,
            total: 25,
          },
          projectedDistinguished: 35,
        })

        mockReadDistrictAnalytics.mockResolvedValue(mockAnalytics)

        const mockTrendData = [
          {
            date: '2024-01-01',
            snapshotId: '2024-01-01',
            membership: 1400,
            payments: 180,
            dcpGoals: 140,
            distinguishedTotal: 20,
            clubCounts: {
              total: 50,
              thriving: 28,
              vulnerable: 17,
              interventionRequired: 5,
            },
          },
          {
            date: '2024-01-15',
            snapshotId: '2024-01-15',
            membership: 1500,
            payments: 200,
            dcpGoals: 150,
            distinguishedTotal: 25,
            clubCounts: {
              total: 50,
              thriving: 30,
              vulnerable: 15,
              interventionRequired: 5,
            },
          },
        ]

        const mockTimeSeriesService = {
          getTrendData: vi.fn().mockResolvedValue(mockTrendData),
        }

        vi.mocked(getTimeSeriesIndexService).mockResolvedValue(
          mockTimeSeriesService as never
        )

        const response = await request(app)
          .get('/api/districts/42/analytics-summary')
          .expect(200)

        expect(response.body.districtId).toBe('42')
        expect(response.body.dataSource).toBe('precomputed')

        // Verify summary fields mapped from DistrictAnalytics
        expect(response.body.summary.totalMembership).toBe(1500)
        expect(response.body.summary.membershipChange).toBe(50)

        // Requirement 2.1-2.4: Club counts derived from array lengths
        expect(response.body.summary.clubCounts.total).toBe(50)
        expect(response.body.summary.clubCounts.thriving).toBe(30)
        expect(response.body.summary.clubCounts.vulnerable).toBe(15)
        expect(response.body.summary.clubCounts.interventionRequired).toBe(5)

        // Distinguished clubs mapped directly
        expect(response.body.summary.distinguishedClubs.smedley).toBe(2)
        expect(response.body.summary.distinguishedClubs.presidents).toBe(5)
        expect(response.body.summary.distinguishedClubs.select).toBe(8)
        expect(response.body.summary.distinguishedClubs.distinguished).toBe(10)
        expect(response.body.summary.distinguishedClubs.total).toBe(25)

        // Distinguished projection from DistrictAnalytics.distinguishedProjection.projectedDistinguished
        expect(response.body.summary.distinguishedProjection).toBe(35)

        // computedAt from latestSnapshot.created_at
        expect(response.body.computedAt).toBe('2024-01-15T10:00:00Z')

        // Trend data still works
        expect(response.body.trends.membership).toHaveLength(2)
        expect(response.body.trends.payments).toHaveLength(2)
      })

      it('should derive club counts from array lengths with varying sizes (Req 2.1-2.4)', async () => {
        // Requirement 6.3: Verify club counts are derived from array lengths
        // Use non-standard counts to prove they come from array lengths, not hardcoded values
        const mockAnalytics = createMockDistrictAnalytics({
          allClubsCount: 73,
          thrivingClubsCount: 41,
          vulnerableClubsCount: 22,
          interventionRequiredClubsCount: 10,
        })

        mockReadDistrictAnalytics.mockResolvedValue(mockAnalytics)

        const mockTimeSeriesService = {
          getTrendData: vi.fn().mockResolvedValue([]),
        }
        vi.mocked(getTimeSeriesIndexService).mockResolvedValue(
          mockTimeSeriesService as never
        )

        const response = await request(app)
          .get('/api/districts/42/analytics-summary')
          .expect(200)

        // These counts MUST match the array lengths, not any pre-computed numeric field
        expect(response.body.summary.clubCounts.total).toBe(73)
        expect(response.body.summary.clubCounts.thriving).toBe(41)
        expect(response.body.summary.clubCounts.vulnerable).toBe(22)
        expect(response.body.summary.clubCounts.interventionRequired).toBe(10)
      })

      it('should read distinguishedProjection from pre-computed analytics files (Req 3.3)', async () => {
        const mockAnalytics = createMockDistrictAnalytics({
          projectedDistinguished: 42,
        })

        mockReadDistrictAnalytics.mockResolvedValue(mockAnalytics)

        const mockTimeSeriesService = {
          getTrendData: vi.fn().mockResolvedValue([]),
        }
        vi.mocked(getTimeSeriesIndexService).mockResolvedValue(
          mockTimeSeriesService as never
        )

        const response = await request(app)
          .get('/api/districts/42/analytics-summary')
          .expect(200)

        // Verify distinguishedProjection is read from pre-computed data
        expect(response.body.summary.distinguishedProjection).toBe(42)

        // Verify readDistrictAnalytics was called with correct args
        expect(mockReadDistrictAnalytics).toHaveBeenCalledWith(
          '2024-01-15',
          '42'
        )
      })

      it('should include year-over-year comparison when available from pre-computed data', async () => {
        const mockTimeSeriesService = {
          getTrendData: vi.fn().mockResolvedValue([]),
        }
        vi.mocked(getTimeSeriesIndexService).mockResolvedValue(
          mockTimeSeriesService as never
        )

        // Mock year-over-year data from PreComputedAnalyticsReader
        // Requirement 4.1: Route sends percentageChange values, not change values
        const mockYoY = {
          currentDate: '2024-01-15',
          previousYearDate: '2023-01-15',
          dataAvailable: true,
          metrics: {
            membership: {
              current: 1500,
              previous: 1400,
              change: 100,
              percentageChange: 7.14,
            },
            distinguishedClubs: {
              current: 25,
              previous: 20,
              change: 5,
              percentageChange: 25,
            },
            clubHealth: {
              thrivingClubs: {
                current: 30,
                previous: 25,
                change: 5,
                percentageChange: 20,
              },
              vulnerableClubs: {
                current: 15,
                previous: 18,
                change: -3,
                percentageChange: -16.67,
              },
            },
          },
        }

        mockReadYearOverYear.mockResolvedValue(mockYoY)

        const response = await request(app)
          .get('/api/districts/42/analytics-summary')
          .expect(200)

        // Requirement 4.1: Response uses percentageChange values, not absolute change values
        expect(response.body.yearOverYear).toBeDefined()
        expect(response.body.yearOverYear.membershipChange).toBe(7.14)
        expect(response.body.yearOverYear.distinguishedChange).toBe(25)
        expect(response.body.yearOverYear.clubHealthChange).toBe(20)
      })
    })

    describe('Analytics Not Available (No Fallback)', () => {
      it('should return 404 with ANALYTICS_NOT_AVAILABLE when readDistrictAnalytics returns null', async () => {
        // Requirement 1.4: Return 404 when readDistrictAnalytics() returns null
        // Requirement 6.2: Verify route returns HTTP 404 with error code ANALYTICS_NOT_AVAILABLE
        mockReadDistrictAnalytics.mockResolvedValue(null)

        const mockTimeSeriesService = {
          getTrendData: vi.fn().mockResolvedValue([]),
        }
        vi.mocked(getTimeSeriesIndexService).mockResolvedValue(
          mockTimeSeriesService as never
        )

        const response = await request(app)
          .get('/api/districts/42/analytics-summary')
          .expect(404)

        expect(response.body.error.code).toBe('ANALYTICS_NOT_AVAILABLE')
        expect(response.body.error.message).toContain(
          'Pre-computed analytics are not available'
        )
        expect(response.body.error.message).toContain('42')

        expect(response.body.error.details.districtId).toBe('42')
        expect(response.body.error.details.recommendation).toContain(
          'scraper-cli compute-analytics'
        )
      })

      it('should return 404 with ANALYTICS_NOT_AVAILABLE when no snapshot exists', async () => {
        // Requirement 1.5: Return 404 when no successful snapshot exists
        mockSnapshotStore.getLatestSuccessful.mockResolvedValue(null)

        const response = await request(app)
          .get('/api/districts/42/analytics-summary')
          .expect(404)

        expect(response.body.error.code).toBe('ANALYTICS_NOT_AVAILABLE')
        expect(response.body.error.details.districtId).toBe('42')
      })
    })

    describe('Date Range Query Parameters', () => {
      it('should accept valid startDate and endDate parameters', async () => {
        const mockTimeSeriesService = {
          getTrendData: vi.fn().mockResolvedValue([]),
        }
        vi.mocked(getTimeSeriesIndexService).mockResolvedValue(
          mockTimeSeriesService as never
        )

        const response = await request(app)
          .get('/api/districts/42/analytics-summary')
          .query({ startDate: '2024-01-01', endDate: '2024-01-31' })
          .expect(200)

        expect(response.body.dateRange.start).toBe('2024-01-01')
        expect(response.body.dateRange.end).toBe('2024-01-31')

        // Verify time series service was called with correct date range
        expect(mockTimeSeriesService.getTrendData).toHaveBeenCalledWith(
          '42',
          '2024-01-01',
          '2024-01-31'
        )
      })
    })

    describe('Data Source Consolidation (Req 3.1, 4.1)', () => {
      it('should call readDistrictAnalytics exactly once per request and not use PreComputedAnalyticsService', async () => {
        // Requirement 3.1: Single readDistrictAnalytics() call for all per-district data
        // (summary, distinguished projection — no redundant second call)
        // Requirement 4.1: No dependency on PreComputedAnalyticsService
        const mockTimeSeriesService = {
          getTrendData: vi.fn().mockResolvedValue([]),
        }
        vi.mocked(getTimeSeriesIndexService).mockResolvedValue(
          mockTimeSeriesService as never
        )

        await request(app)
          .get('/api/districts/42/analytics-summary')
          .expect(200)

        // Requirement 3.1: readDistrictAnalytics is called exactly once —
        // no separate call for distinguished projection data
        expect(mockReadDistrictAnalytics).toHaveBeenCalledTimes(1)
        expect(mockReadDistrictAnalytics).toHaveBeenCalledWith(
          '2024-01-15',
          '42'
        )

        // Requirement 4.1: getPreComputedAnalyticsService is not exported from shared module
        // (it was removed in Task 2.1 — the mock factory intentionally omits it)
        // Use Object.keys to inspect the mock without triggering Vitest's proxy trap
        const sharedModule = await import('../shared.js')
        const sharedExports = Object.keys(sharedModule)
        expect(sharedExports).not.toContain('getPreComputedAnalyticsService')
      })
    })

    describe('Error Handling', () => {
      it('should return 404 with ANALYTICS_NOT_AVAILABLE when pre-computed analytics are missing', async () => {
        // readDistrictAnalytics returns null — no analytics file for this district
        mockReadDistrictAnalytics.mockResolvedValue(null)

        const mockTimeSeriesService = {
          getTrendData: vi.fn().mockResolvedValue([]),
        }
        vi.mocked(getTimeSeriesIndexService).mockResolvedValue(
          mockTimeSeriesService as never
        )

        const response = await request(app)
          .get('/api/districts/42/analytics-summary')
          .expect(404)

        expect(response.body.error.code).toBe('ANALYTICS_NOT_AVAILABLE')
        expect(response.body.error.details.districtId).toBe('42')
        expect(response.body.error.details.recommendation).toContain(
          'scraper-cli compute-analytics'
        )
      })

      it('should return 503 when readDistrictAnalytics throws ENOENT error', async () => {
        // Test that storage errors are properly handled
        mockReadDistrictAnalytics.mockRejectedValue(
          new Error('ENOENT: no such file or directory')
        )

        const mockTimeSeriesService = {
          getTrendData: vi.fn().mockResolvedValue([]),
        }
        vi.mocked(getTimeSeriesIndexService).mockResolvedValue(
          mockTimeSeriesService as never
        )

        const response = await request(app)
          .get('/api/districts/42/analytics-summary')
          .expect(503)

        expect(response.body.error.code).toBe('SERVICE_UNAVAILABLE')
      })

      it('should handle time series index errors gracefully', async () => {
        const mockTimeSeriesService = {
          getTrendData: vi
            .fn()
            .mockRejectedValue(new Error('Index file not found')),
        }
        vi.mocked(getTimeSeriesIndexService).mockResolvedValue(
          mockTimeSeriesService as never
        )

        // Should still return 200 with summary data, just without trend data
        const response = await request(app)
          .get('/api/districts/42/analytics-summary')
          .expect(200)

        expect(response.body.summary.totalMembership).toBe(1500)
        expect(response.body.trends.membership).toHaveLength(0)
      })
    })

    /**
     * Sparse Data Fallback Tests (Requirements 1.1, 1.2, 1.3)
     *
     * When the initial time-series query returns zero data points (because the
     * selected date falls before the first available data point in a sparse index),
     * the route expands the query to the full program year and returns whatever
     * data exists. The response dateRange always reflects the original request.
     *
     * Property 1: Response dateRange preserves original request
     * Validates: Requirements 1.1, 1.2, 1.3
     */
    describe('Sparse Data Fallback (Req 1.1, 1.2, 1.3)', () => {
      /**
       * Helper to create a mock time-series data point.
       */
      function createMockTimeSeriesDataPoint(overrides: {
        date: string
        membership?: number
        payments?: number
      }) {
        return {
          date: overrides.date,
          snapshotId: overrides.date,
          membership: overrides.membership ?? 1000,
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

      it('should return expanded program year data when initial query returns empty (Req 1.1)', async () => {
        // Requirement 1.1: When the initial date range query returns zero trend data points,
        // expand to the full program year and return available data points.
        //
        // Scenario: User selects startDate=2025-07-01, endDate=2025-09-26 but the sparse
        // time-series only has data points starting from 2025-10-15. The initial query
        // returns empty, so the route re-queries with the full program year (2025-07-01
        // to 2026-06-30) and finds the data.
        const expandedData = [
          createMockTimeSeriesDataPoint({
            date: '2025-10-15',
            membership: 1200,
          }),
          createMockTimeSeriesDataPoint({
            date: '2025-11-15',
            membership: 1250,
          }),
          createMockTimeSeriesDataPoint({
            date: '2025-12-15',
            membership: 1300,
          }),
        ]

        const mockTimeSeriesService = {
          getTrendData: vi
            .fn()
            // First call: original date range returns empty
            .mockResolvedValueOnce([])
            // Second call: expanded program year range returns data
            .mockResolvedValueOnce(expandedData),
        }
        vi.mocked(getTimeSeriesIndexService).mockResolvedValue(
          mockTimeSeriesService as never
        )

        const response = await request(app)
          .get('/api/districts/42/analytics-summary')
          .query({ startDate: '2025-07-01', endDate: '2025-09-26' })
          .expect(200)

        // Verify the route returned the expanded data
        expect(response.body.trends.membership).toHaveLength(3)
        expect(response.body.trends.membership[0].date).toBe('2025-10-15')
        expect(response.body.trends.membership[0].count).toBe(1200)
        expect(response.body.trends.membership[2].date).toBe('2025-12-15')
        expect(response.body.trends.membership[2].count).toBe(1300)

        // Verify getTrendData was called twice:
        // 1st: original range, 2nd: expanded program year range
        expect(mockTimeSeriesService.getTrendData).toHaveBeenCalledTimes(2)
        expect(mockTimeSeriesService.getTrendData).toHaveBeenNthCalledWith(
          1,
          '42',
          '2025-07-01',
          '2025-09-26'
        )
        // Program year for endDate 2025-09-26 is 2025-07-01 to 2026-06-30
        expect(mockTimeSeriesService.getTrendData).toHaveBeenNthCalledWith(
          2,
          '42',
          '2025-07-01',
          '2026-06-30'
        )
      })

      it('should preserve original dateRange in response when query is expanded (Req 1.2)', async () => {
        // Requirement 1.2: The response dateRange field SHALL preserve the original
        // requested date range, NOT the expanded program year range.
        //
        // Property 1: Response dateRange preserves original request
        const expandedData = [
          createMockTimeSeriesDataPoint({
            date: '2025-10-15',
            membership: 1100,
          }),
        ]

        const mockTimeSeriesService = {
          getTrendData: vi
            .fn()
            .mockResolvedValueOnce([]) // initial: empty
            .mockResolvedValueOnce(expandedData), // expanded: has data
        }
        vi.mocked(getTimeSeriesIndexService).mockResolvedValue(
          mockTimeSeriesService as never
        )

        const response = await request(app)
          .get('/api/districts/42/analytics-summary')
          .query({ startDate: '2025-08-01', endDate: '2025-09-15' })
          .expect(200)

        // dateRange MUST reflect the original request, not the expanded range
        expect(response.body.dateRange.start).toBe('2025-08-01')
        expect(response.body.dateRange.end).toBe('2025-09-15')

        // But the trend data comes from the expanded query
        expect(response.body.trends.membership).toHaveLength(1)
        expect(response.body.trends.membership[0].date).toBe('2025-10-15')
      })

      it('should preserve original dateRange when initial query has data (no expansion needed)', async () => {
        // When the initial query returns data, no expansion happens.
        // The dateRange should still reflect the original request.
        const initialData = [
          createMockTimeSeriesDataPoint({
            date: '2025-08-15',
            membership: 1400,
          }),
          createMockTimeSeriesDataPoint({
            date: '2025-09-01',
            membership: 1450,
          }),
        ]

        const mockTimeSeriesService = {
          getTrendData: vi.fn().mockResolvedValueOnce(initialData),
        }
        vi.mocked(getTimeSeriesIndexService).mockResolvedValue(
          mockTimeSeriesService as never
        )

        const response = await request(app)
          .get('/api/districts/42/analytics-summary')
          .query({ startDate: '2025-08-01', endDate: '2025-09-30' })
          .expect(200)

        // dateRange reflects the original request
        expect(response.body.dateRange.start).toBe('2025-08-01')
        expect(response.body.dateRange.end).toBe('2025-09-30')

        // Data from the initial (non-expanded) query
        expect(response.body.trends.membership).toHaveLength(2)

        // getTrendData called only once — no expansion needed
        expect(mockTimeSeriesService.getTrendData).toHaveBeenCalledTimes(1)
      })

      it('should return empty trends array without error when both queries return empty (Req 1.3)', async () => {
        // Requirement 1.3: When the Time_Series_Index contains no data points for
        // the entire program year, return an empty trend array without error.
        const mockTimeSeriesService = {
          getTrendData: vi
            .fn()
            .mockResolvedValueOnce([]) // initial: empty
            .mockResolvedValueOnce([]), // expanded: also empty
        }
        vi.mocked(getTimeSeriesIndexService).mockResolvedValue(
          mockTimeSeriesService as never
        )

        const response = await request(app)
          .get('/api/districts/42/analytics-summary')
          .query({ startDate: '2025-07-01', endDate: '2025-09-26' })
          .expect(200)

        // Empty trends, no error
        expect(response.body.trends.membership).toHaveLength(0)
        expect(response.body.trends.payments).toBeUndefined()
        expect(response.body.error).toBeUndefined()

        // dateRange still reflects the original request
        expect(response.body.dateRange.start).toBe('2025-07-01')
        expect(response.body.dateRange.end).toBe('2025-09-26')

        // Both queries were attempted
        expect(mockTimeSeriesService.getTrendData).toHaveBeenCalledTimes(2)
      })

      it('should expand to correct program year when endDate is in first half of calendar year', async () => {
        // When endDate is before July (e.g., 2025-03-15), the program year is 2024-2025
        // which runs from 2024-07-01 to 2025-06-30.
        const expandedData = [
          createMockTimeSeriesDataPoint({
            date: '2024-10-01',
            membership: 900,
          }),
        ]

        const mockTimeSeriesService = {
          getTrendData: vi
            .fn()
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce(expandedData),
        }
        vi.mocked(getTimeSeriesIndexService).mockResolvedValue(
          mockTimeSeriesService as never
        )

        const response = await request(app)
          .get('/api/districts/42/analytics-summary')
          .query({ startDate: '2025-01-01', endDate: '2025-03-15' })
          .expect(200)

        // Verify the expanded query used the correct program year boundaries
        // endDate 2025-03-15 → program year 2024-07-01 to 2025-06-30
        expect(mockTimeSeriesService.getTrendData).toHaveBeenNthCalledWith(
          2,
          '42',
          '2024-07-01',
          '2025-06-30'
        )

        // dateRange preserves original request
        expect(response.body.dateRange.start).toBe('2025-01-01')
        expect(response.body.dateRange.end).toBe('2025-03-15')

        // Expanded data is returned
        expect(response.body.trends.membership).toHaveLength(1)
      })

      it('should include payments trend data from expanded query', async () => {
        // Verify that payments data is also returned from the expanded query
        const expandedData = [
          createMockTimeSeriesDataPoint({
            date: '2025-10-15',
            membership: 1200,
            payments: 180,
          }),
          createMockTimeSeriesDataPoint({
            date: '2025-11-15',
            membership: 1250,
            payments: 200,
          }),
        ]

        const mockTimeSeriesService = {
          getTrendData: vi
            .fn()
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce(expandedData),
        }
        vi.mocked(getTimeSeriesIndexService).mockResolvedValue(
          mockTimeSeriesService as never
        )

        const response = await request(app)
          .get('/api/districts/42/analytics-summary')
          .query({ startDate: '2025-07-01', endDate: '2025-09-26' })
          .expect(200)

        // Both membership and payments trends from expanded query
        expect(response.body.trends.membership).toHaveLength(2)
        expect(response.body.trends.payments).toHaveLength(2)
        expect(response.body.trends.payments[0].payments).toBe(180)
        expect(response.body.trends.payments[1].payments).toBe(200)
      })
    })

    /**
     * YoY Contract Alignment Tests (Requirements 4.1, 4.2, 4.3)
     *
     * The route MUST send `percentageChange` values from MetricComparison
     * (not `change` values) for the yearOverYear response fields. The key
     * insight: `change` and `percentageChange` are set to DIFFERENT values
     * in the mock, and we verify the response contains `percentageChange`.
     *
     * Property 4: Route sends percentageChange values
     * Validates: Requirements 4.1, 4.2, 4.3
     */
    describe('YoY Contract Alignment (Req 4.1, 4.2, 4.3)', () => {
      it('should map percentageChange (not change) to yearOverYear response fields (Req 4.1)', async () => {
        // Requirement 4.1: The route SHALL send percentageChange values from
        // MetricComparison, not change values.
        //
        // Key: change and percentageChange are deliberately set to DIFFERENT
        // values. If the route reads `change`, the assertions will fail.
        const mockTimeSeriesService = {
          getTrendData: vi.fn().mockResolvedValue([]),
        }
        vi.mocked(getTimeSeriesIndexService).mockResolvedValue(
          mockTimeSeriesService as never
        )

        const mockYoY = {
          currentDate: '2024-01-15',
          previousYearDate: '2023-01-15',
          dataAvailable: true,
          metrics: {
            membership: {
              current: 1500,
              previous: 1400,
              change: 100, // absolute: +100 members
              percentageChange: 7.14, // percentage: +7.14%
            },
            distinguishedClubs: {
              current: 25,
              previous: 20,
              change: 5, // absolute: +5 clubs
              percentageChange: 25, // percentage: +25%
            },
            clubHealth: {
              thrivingClubs: {
                current: 30,
                previous: 25,
                change: 5, // absolute: +5 clubs
                percentageChange: 20, // percentage: +20%
              },
              vulnerableClubs: {
                current: 15,
                previous: 18,
                change: -3,
                percentageChange: -16.67,
              },
            },
          },
        }

        mockReadYearOverYear.mockResolvedValue(mockYoY)

        const response = await request(app)
          .get('/api/districts/42/analytics-summary')
          .expect(200)

        // These MUST be percentageChange values, NOT change values.
        // membershipChange: 7.14 (not 100)
        // distinguishedChange: 25 (not 5)
        // clubHealthChange: 20 (not 5)
        expect(response.body.yearOverYear).toBeDefined()
        expect(response.body.yearOverYear.membershipChange).toBe(7.14)
        expect(response.body.yearOverYear.distinguishedChange).toBe(25)
        expect(response.body.yearOverYear.clubHealthChange).toBe(20)
      })

      it('should return 0 for yearOverYear fields when percentageChange is 0', async () => {
        // When there is no change between years, percentageChange is 0.
        // The response fields should be 0.
        const mockTimeSeriesService = {
          getTrendData: vi.fn().mockResolvedValue([]),
        }
        vi.mocked(getTimeSeriesIndexService).mockResolvedValue(
          mockTimeSeriesService as never
        )

        const mockYoY = {
          currentDate: '2024-01-15',
          previousYearDate: '2023-01-15',
          dataAvailable: true,
          metrics: {
            membership: {
              current: 1500,
              previous: 1500,
              change: 0,
              percentageChange: 0,
            },
            distinguishedClubs: {
              current: 25,
              previous: 25,
              change: 0,
              percentageChange: 0,
            },
            clubHealth: {
              thrivingClubs: {
                current: 30,
                previous: 30,
                change: 0,
                percentageChange: 0,
              },
              vulnerableClubs: {
                current: 15,
                previous: 15,
                change: 0,
                percentageChange: 0,
              },
            },
          },
        }

        mockReadYearOverYear.mockResolvedValue(mockYoY)

        const response = await request(app)
          .get('/api/districts/42/analytics-summary')
          .expect(200)

        expect(response.body.yearOverYear).toBeDefined()
        expect(response.body.yearOverYear.membershipChange).toBe(0)
        expect(response.body.yearOverYear.distinguishedChange).toBe(0)
        expect(response.body.yearOverYear.clubHealthChange).toBe(0)
      })

      it('should return negative values for yearOverYear fields when percentageChange is negative', async () => {
        // When metrics declined year-over-year, percentageChange is negative.
        // The response fields should reflect the negative percentages.
        const mockTimeSeriesService = {
          getTrendData: vi.fn().mockResolvedValue([]),
        }
        vi.mocked(getTimeSeriesIndexService).mockResolvedValue(
          mockTimeSeriesService as never
        )

        const mockYoY = {
          currentDate: '2024-01-15',
          previousYearDate: '2023-01-15',
          dataAvailable: true,
          metrics: {
            membership: {
              current: 1200,
              previous: 1500,
              change: -300, // absolute: lost 300 members
              percentageChange: -20, // percentage: -20%
            },
            distinguishedClubs: {
              current: 15,
              previous: 25,
              change: -10, // absolute: lost 10 clubs
              percentageChange: -40, // percentage: -40%
            },
            clubHealth: {
              thrivingClubs: {
                current: 20,
                previous: 30,
                change: -10, // absolute: lost 10 clubs
                percentageChange: -33.33, // percentage: -33.33%
              },
              vulnerableClubs: {
                current: 25,
                previous: 15,
                change: 10,
                percentageChange: 66.67,
              },
            },
          },
        }

        mockReadYearOverYear.mockResolvedValue(mockYoY)

        const response = await request(app)
          .get('/api/districts/42/analytics-summary')
          .expect(200)

        // These MUST be the negative percentageChange values, NOT the negative change values.
        // membershipChange: -20 (not -300)
        // distinguishedChange: -40 (not -10)
        // clubHealthChange: -33.33 (not -10)
        expect(response.body.yearOverYear).toBeDefined()
        expect(response.body.yearOverYear.membershipChange).toBe(-20)
        expect(response.body.yearOverYear.distinguishedChange).toBe(-40)
        expect(response.body.yearOverYear.clubHealthChange).toBe(-33.33)
      })
    })
  })
})
