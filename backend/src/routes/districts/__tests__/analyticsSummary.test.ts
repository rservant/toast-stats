/**
 * Unit tests for the aggregated analytics summary endpoint
 *
 * Tests the GET /api/districts/:districtId/analytics-summary endpoint
 * which returns combined analytics data from pre-computed analytics
 * and time-series index.
 *
 * Requirements:
 * - 4.1: Single aggregated endpoint returning analytics in one response
 * - 4.4: Support startDate and endDate query parameters
 * - 8.8: Route SHALL NOT call AnalyticsEngine for year-over-year data
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import express, { type Express } from 'express'
import request from 'supertest'
import { analyticsSummaryRouter } from '../analyticsSummary.js'

// Use vi.hoisted to define mocks that are used in vi.mock factories
const { mockSnapshotStore, mockReadYearOverYear } = vi.hoisted(() => ({
  mockSnapshotStore: {
    getLatestSuccessful: vi.fn(),
  },
  mockReadYearOverYear: vi.fn(),
}))

// Mock the shared module
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
  getPreComputedAnalyticsService: vi.fn(),
  getTimeSeriesIndexService: vi.fn(),
  cacheDirectory: '/tmp/test-cache',
  snapshotStore: mockSnapshotStore,
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

// Mock the PreComputedAnalyticsReader - year-over-year is now read from pre-computed files
vi.mock('../../../services/PreComputedAnalyticsReader.js', () => ({
  PreComputedAnalyticsReader: class MockPreComputedAnalyticsReader {
    readYearOverYear = mockReadYearOverYear
  },
}))

// Import mocked functions
import {
  getPreComputedAnalyticsService,
  getTimeSeriesIndexService,
} from '../shared.js'

describe('Analytics Summary Route', () => {
  let app: Express

  beforeEach(() => {
    app = express()
    app.use(express.json())
    app.use('/api/districts', analyticsSummaryRouter)

    // Reset all mocks
    vi.clearAllMocks()

    // Default mock for snapshotStore
    mockSnapshotStore.getLatestSuccessful.mockResolvedValue({
      snapshot_id: '2024-01-15',
    })

    // Default mock for readYearOverYear
    mockReadYearOverYear.mockResolvedValue(null)
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
      it('should return aggregated analytics from pre-computed data', async () => {
        const mockSummary = {
          snapshotId: '2024-01-15',
          districtId: '42',
          computedAt: '2024-01-15T10:00:00Z',
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
          trendDataPoint: {
            date: '2024-01-15',
            membership: 1500,
            payments: 200,
            dcpGoals: 150,
          },
        }

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

        const mockPreComputedService = {
          getLatestSummary: vi.fn().mockResolvedValue(mockSummary),
        }
        const mockTimeSeriesService = {
          getTrendData: vi.fn().mockResolvedValue(mockTrendData),
        }

        vi.mocked(getPreComputedAnalyticsService).mockResolvedValue(
          mockPreComputedService as never
        )
        vi.mocked(getTimeSeriesIndexService).mockResolvedValue(
          mockTimeSeriesService as never
        )

        const response = await request(app)
          .get('/api/districts/42/analytics-summary')
          .expect(200)

        expect(response.body.districtId).toBe('42')
        expect(response.body.dataSource).toBe('precomputed')
        expect(response.body.summary.totalMembership).toBe(1500)
        expect(response.body.summary.membershipChange).toBe(50)
        expect(response.body.summary.clubCounts.total).toBe(50)
        expect(response.body.summary.clubCounts.thriving).toBe(30)
        expect(response.body.summary.distinguishedClubs.total).toBe(25)
        expect(response.body.trends.membership).toHaveLength(2)
        expect(response.body.trends.payments).toHaveLength(2)
      })

      it('should include year-over-year comparison when available from pre-computed data', async () => {
        const mockSummary = {
          snapshotId: '2024-01-15',
          districtId: '42',
          computedAt: '2024-01-15T10:00:00Z',
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
          trendDataPoint: {
            date: '2024-01-15',
            membership: 1500,
            payments: 200,
            dcpGoals: 150,
          },
        }

        // Mock year-over-year data from PreComputedAnalyticsReader
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

        const mockPreComputedService = {
          getLatestSummary: vi.fn().mockResolvedValue(mockSummary),
        }
        const mockTimeSeriesService = {
          getTrendData: vi.fn().mockResolvedValue([]),
        }

        vi.mocked(getPreComputedAnalyticsService).mockResolvedValue(
          mockPreComputedService as never
        )
        vi.mocked(getTimeSeriesIndexService).mockResolvedValue(
          mockTimeSeriesService as never
        )

        // Mock the PreComputedAnalyticsReader to return year-over-year data
        mockReadYearOverYear.mockResolvedValue(mockYoY)

        const response = await request(app)
          .get('/api/districts/42/analytics-summary')
          .expect(200)

        expect(response.body.yearOverYear).toBeDefined()
        expect(response.body.yearOverYear.membershipChange).toBe(100)
        expect(response.body.yearOverYear.distinguishedChange).toBe(5)
        expect(response.body.yearOverYear.clubHealthChange).toBe(5)
      })
    })

    describe('Analytics Not Available (No Fallback)', () => {
      it('should return 404 with ANALYTICS_NOT_AVAILABLE when pre-computed data is unavailable', async () => {
        // Requirement 1.1: Return HTTP 404 when pre-computed analytics not available
        // Requirement 1.4: Do NOT fall back to on-demand analytics computation
        const mockPreComputedService = {
          getLatestSummary: vi.fn().mockResolvedValue(null),
        }
        const mockTimeSeriesService = {
          getTrendData: vi.fn().mockResolvedValue([]),
        }

        vi.mocked(getPreComputedAnalyticsService).mockResolvedValue(
          mockPreComputedService as never
        )
        vi.mocked(getTimeSeriesIndexService).mockResolvedValue(
          mockTimeSeriesService as never
        )

        const response = await request(app)
          .get('/api/districts/42/analytics-summary')
          .expect(404)

        // Requirement 1.2: Error response includes clear message
        expect(response.body.error.code).toBe('ANALYTICS_NOT_AVAILABLE')
        expect(response.body.error.message).toContain(
          'Pre-computed analytics are not available'
        )
        expect(response.body.error.message).toContain('42')

        // Requirement 1.5: Error response includes district ID
        expect(response.body.error.details.districtId).toBe('42')

        // Requirement 1.3: Error response includes backfill recommendation
        expect(response.body.error.details.recommendation).toContain(
          'analytics-generation'
        )
        expect(response.body.error.details.backfillJobType).toBe(
          'analytics-generation'
        )
      })
    })

    describe('Date Range Query Parameters', () => {
      it('should accept valid startDate and endDate parameters', async () => {
        const mockSummary = {
          snapshotId: '2024-01-15',
          districtId: '42',
          computedAt: '2024-01-15T10:00:00Z',
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
          trendDataPoint: {
            date: '2024-01-15',
            membership: 1500,
            payments: 200,
            dcpGoals: 150,
          },
        }

        const mockPreComputedService = {
          getLatestSummary: vi.fn().mockResolvedValue(mockSummary),
        }
        const mockTimeSeriesService = {
          getTrendData: vi.fn().mockResolvedValue([]),
        }

        vi.mocked(getPreComputedAnalyticsService).mockResolvedValue(
          mockPreComputedService as never
        )
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

    describe('Error Handling', () => {
      it('should return 404 with ANALYTICS_NOT_AVAILABLE when pre-computed analytics are missing', async () => {
        // This test verifies the primary error case: pre-computed analytics not available
        const mockPreComputedService = {
          getLatestSummary: vi.fn().mockResolvedValue(null),
        }
        const mockTimeSeriesService = {
          getTrendData: vi.fn().mockResolvedValue([]),
        }

        vi.mocked(getPreComputedAnalyticsService).mockResolvedValue(
          mockPreComputedService as never
        )
        vi.mocked(getTimeSeriesIndexService).mockResolvedValue(
          mockTimeSeriesService as never
        )

        const response = await request(app)
          .get('/api/districts/42/analytics-summary')
          .expect(404)

        expect(response.body.error.code).toBe('ANALYTICS_NOT_AVAILABLE')
        expect(response.body.error.details.districtId).toBe('42')
        expect(response.body.error.details.backfillJobType).toBe(
          'analytics-generation'
        )
      })

      it('should return 503 when pre-computed analytics service throws ENOENT error', async () => {
        // Test that storage errors are properly handled
        const mockPreComputedService = {
          getLatestSummary: vi
            .fn()
            .mockRejectedValue(new Error('ENOENT: no such file or directory')),
        }
        const mockTimeSeriesService = {
          getTrendData: vi.fn().mockResolvedValue([]),
        }

        vi.mocked(getPreComputedAnalyticsService).mockResolvedValue(
          mockPreComputedService as never
        )
        vi.mocked(getTimeSeriesIndexService).mockResolvedValue(
          mockTimeSeriesService as never
        )

        const response = await request(app)
          .get('/api/districts/42/analytics-summary')
          .expect(503)

        expect(response.body.error.code).toBe('SERVICE_UNAVAILABLE')
      })

      it('should handle time series index errors gracefully', async () => {
        const mockSummary = {
          snapshotId: '2024-01-15',
          districtId: '42',
          computedAt: '2024-01-15T10:00:00Z',
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
          trendDataPoint: {
            date: '2024-01-15',
            membership: 1500,
            payments: 200,
            dcpGoals: 150,
          },
        }

        const mockPreComputedService = {
          getLatestSummary: vi.fn().mockResolvedValue(mockSummary),
        }
        const mockTimeSeriesService = {
          getTrendData: vi
            .fn()
            .mockRejectedValue(new Error('Index file not found')),
        }

        vi.mocked(getPreComputedAnalyticsService).mockResolvedValue(
          mockPreComputedService as never
        )
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
  })
})
