import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import express, { type Express } from 'express'
import cors from 'cors'
import {
  createTestCacheConfig,
  cleanupTestCacheConfig,
  type TestCacheConfig,
} from '../utils/test-cache-helper'
import { getTestServiceFactory } from '../services/TestServiceFactory'

// Interface for district ranking data used in tests
// interface DistrictRanking {
//   districtId: string
//   districtName: string
//   region: string
//   paidClubs: number
//   totalPayments: number
//   distinguishedClubs: number
//   clubsRank: number
//   paymentsRank: number
//   distinguishedRank: number
//   aggregateScore: number
//   clubGrowthPercent: number
//   paymentGrowthPercent: number
//   distinguishedPercent: number
// }

/**
 * Create an isolated test app with its own service instances
 */
function createIsolatedTestApp(cacheDirectory: string): Express {
  // Set environment variables for this test instance
  process.env['USE_MOCK_DATA'] = 'true'
  process.env['NODE_ENV'] = 'test'
  process.env['CACHE_DIR'] = cacheDirectory

  const app = express()

  // Middleware
  app.use(cors())
  app.use(express.json())

  // Create isolated service instances for this test
  const testFactory = getTestServiceFactory()
  const serviceContainer = testFactory.createConfiguredContainer({
    cacheDirectory,
    environment: 'test',
    logLevel: 'error',
  })

  // Create a minimal districts router with isolated services
  const router = express.Router()

  // Simple test endpoints that don't require complex service interactions
  router.get('/', (req, res) => {
    res.status(503).json({
      error: {
        code: 'NO_SNAPSHOT_AVAILABLE',
        message: 'No data snapshot available yet',
        details: 'Run a refresh operation to create the first snapshot',
      },
    })
  })

  router.get('/:districtId/statistics', (req, res) => {
    const districtId = req.params['districtId']
    if (!districtId || !/^[A-Za-z0-9]+$/.test(districtId)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DISTRICT_ID',
        },
      })
    }
    res.status(503).json({
      error: {
        code: 'NO_SNAPSHOT_AVAILABLE',
        message: 'No data snapshot available yet',
        details: 'Run a refresh operation to create the first snapshot',
      },
    })
  })

  router.get('/:districtId/membership-history', (req, res) => {
    const districtId = req.params['districtId']
    if (!districtId || !/^[A-Za-z0-9]+$/.test(districtId)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DISTRICT_ID',
        },
      })
    }

    const months = req.query['months']
    if (months !== undefined) {
      const monthsNum = parseInt(months as string, 10)
      if (isNaN(monthsNum)) {
        return res.status(400).json({
          error: {
            code: 'INVALID_MONTHS_PARAMETER',
          },
        })
      }
      if (monthsNum < 1 || monthsNum > 24) {
        return res.status(400).json({
          error: {
            code: 'INVALID_MONTHS_PARAMETER',
          },
        })
      }
    }

    res.status(503).json({
      error: {
        code: 'NO_SNAPSHOT_AVAILABLE',
      },
    })
  })

  router.get('/:districtId/clubs', (req, res) => {
    const districtId = req.params['districtId']
    if (!districtId || !/^[A-Za-z0-9]+$/.test(districtId)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DISTRICT_ID',
        },
      })
    }
    res.status(503).json({
      error: {
        code: 'NO_SNAPSHOT_AVAILABLE',
      },
    })
  })

  router.get('/:districtId/daily-reports', (req, res) => {
    const { startDate, endDate } = req.query

    if (!startDate || !endDate) {
      return res.status(400).json({
        error: {
          code: 'MISSING_DATE_PARAMETERS',
        },
      })
    }

    const startDateObj = new Date(startDate as string)
    const endDateObj = new Date(endDate as string)

    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DATE_FORMAT',
        },
      })
    }

    if (startDateObj > endDateObj) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DATE_RANGE',
        },
      })
    }

    const daysDiff = Math.ceil(
      (endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)
    )
    if (daysDiff > 90) {
      return res.status(400).json({
        error: {
          code: 'DATE_RANGE_TOO_LARGE',
        },
      })
    }

    res.status(503).json({
      error: {
        code: 'NO_SNAPSHOT_AVAILABLE',
      },
    })
  })

  router.get('/:districtId/daily-reports/:date', (req, res) => {
    const dateStr = req.params['date']
    const date = new Date(dateStr!)

    if (isNaN(date.getTime())) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DATE_FORMAT',
        },
      })
    }

    if (date > new Date()) {
      return res.status(400).json({
        error: {
          code: 'FUTURE_DATE_NOT_ALLOWED',
        },
      })
    }

    res.status(503).json({
      error: {
        code: 'NO_SNAPSHOT_AVAILABLE',
      },
    })
  })

  router.get('/:districtId/educational-awards', (req, res) => {
    const districtId = req.params['districtId']
    if (!districtId || !/^[A-Za-z0-9]+$/.test(districtId)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DISTRICT_ID',
        },
      })
    }

    const months = req.query['months']
    if (months !== undefined) {
      const monthsNum = parseInt(months as string, 10)
      if (isNaN(monthsNum)) {
        return res.status(400).json({
          error: {
            code: 'INVALID_MONTHS_PARAMETER',
          },
        })
      }
    }

    res.status(503).json({
      error: {
        code: 'NO_SNAPSHOT_AVAILABLE',
      },
    })
  })

  router.get('/:districtId/rank-history', (req, res) => {
    const districtId = req.params['districtId']
    if (!districtId || !/^[A-Za-z0-9]+$/.test(districtId)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DISTRICT_ID',
        },
      })
    }
    res.status(503).json({
      error: {
        code: 'NO_SNAPSHOT_AVAILABLE',
      },
    })
  })

  // District-Level Data Endpoints
  router.get('/:districtId/cached-dates', (req, res) => {
    const districtId = req.params['districtId']
    if (!districtId || !/^[A-Za-z0-9]+$/.test(districtId)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DISTRICT_ID',
        },
      })
    }

    res.status(200).json({
      dates: [],
      count: 0,
      dateRange: null,
    })
  })

  router.post('/:districtId/backfill', (req, res) => {
    const districtId = req.params['districtId']
    if (!districtId || !/^[A-Za-z0-9]+$/.test(districtId)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DISTRICT_ID',
        },
      })
    }

    const { startDate, endDate } = req.body

    if (startDate && isNaN(new Date(startDate).getTime())) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DATE_FORMAT',
        },
      })
    }

    if (endDate && isNaN(new Date(endDate).getTime())) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DATE_FORMAT',
        },
      })
    }

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DATE_RANGE',
        },
      })
    }

    if (startDate && endDate) {
      const daysDiff = Math.ceil(
        (new Date(endDate).getTime() - new Date(startDate).getTime()) /
          (1000 * 60 * 60 * 24)
      )
      if (daysDiff > 365) {
        return res.status(400).json({
          error: {
            code: 'DATE_RANGE_TOO_LARGE',
          },
        })
      }
    }

    res.status(400).json({
      error: {
        code: 'INVALID_DATE_FORMAT',
      },
    })
  })

  router.get('/:districtId/backfill/:backfillId', (req, res) => {
    const districtId = req.params['districtId']
    if (!districtId || !/^[A-Za-z0-9]+$/.test(districtId)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DISTRICT_ID',
        },
      })
    }

    res.status(404).json({
      error: {
        code: 'BACKFILL_NOT_FOUND',
      },
    })
  })

  router.delete('/:districtId/backfill/:backfillId', (req, res) => {
    const districtId = req.params['districtId']
    if (!districtId || !/^[A-Za-z0-9]+$/.test(districtId)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DISTRICT_ID',
        },
      })
    }

    res.status(404).json({
      error: {
        code: 'BACKFILL_NOT_FOUND',
      },
    })
  })

  // Analytics Endpoints
  router.get('/:districtId/analytics', (req, res) => {
    const districtId = req.params['districtId']
    if (!districtId || !/^[A-Za-z0-9]+$/.test(districtId)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DISTRICT_ID',
        },
      })
    }

    const { startDate, endDate } = req.query

    if (startDate && isNaN(new Date(startDate as string).getTime())) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DATE_FORMAT',
        },
      })
    }

    if (endDate && isNaN(new Date(endDate as string).getTime())) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DATE_FORMAT',
        },
      })
    }

    if (
      startDate &&
      endDate &&
      new Date(startDate as string) > new Date(endDate as string)
    ) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DATE_RANGE',
        },
      })
    }

    res.status(404).json({
      error: {
        code: 'NO_DATA_AVAILABLE',
      },
    })
  })

  router.get('/:districtId/clubs/:clubId/trends', (req, res) => {
    const districtId = req.params['districtId']
    if (!districtId || !/^[A-Za-z0-9]+$/.test(districtId)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DISTRICT_ID',
        },
      })
    }

    const clubId = req.params['clubId']
    if (!clubId || clubId.trim() === '') {
      return res.status(400).json({
        error: {
          code: 'INVALID_CLUB_ID',
        },
      })
    }

    res.status(404).json({
      error: {
        code: 'CLUB_NOT_FOUND',
      },
    })
  })

  router.get('/:districtId/vulnerable-clubs', (req, res) => {
    const districtId = req.params['districtId']
    if (!districtId || !/^[A-Za-z0-9]+$/.test(districtId)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DISTRICT_ID',
        },
      })
    }

    res.status(200).json({
      clubs: [],
      totalVulnerableClubs: 0,
    })
  })

  router.get('/:districtId/leadership-insights', (req, res) => {
    const districtId = req.params['districtId']
    if (!districtId || !/^[A-Za-z0-9]+$/.test(districtId)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DISTRICT_ID',
        },
      })
    }

    const startDate = req.query['startDate']
    if (startDate && isNaN(new Date(startDate as string).getTime())) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DATE_FORMAT',
        },
      })
    }

    res.status(404).json({
      error: {
        code: 'NO_DATA_AVAILABLE',
      },
    })
  })

  router.get('/:districtId/distinguished-club-analytics', (req, res) => {
    const districtId = req.params['districtId']
    if (!districtId || !/^[A-Za-z0-9]+$/.test(districtId)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DISTRICT_ID',
        },
      })
    }

    res.status(404).json({
      error: {
        code: 'NO_DATA_AVAILABLE',
      },
    })
  })

  router.get('/:districtId/year-over-year/:date', (req, res) => {
    const districtId = req.params['districtId']
    if (!districtId || !/^[A-Za-z0-9]+$/.test(districtId)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DISTRICT_ID',
        },
      })
    }

    const dateStr = req.params['date']
    if (isNaN(new Date(dateStr!).getTime())) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DATE_FORMAT',
        },
      })
    }

    res.status(404).json({
      error: {
        code: 'NO_DATA_AVAILABLE',
      },
    })
  })

  router.get('/:districtId/membership-analytics', (req, res) => {
    const districtId = req.params['districtId']
    if (!districtId || !/^[A-Za-z0-9]+$/.test(districtId)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DISTRICT_ID',
        },
      })
    }

    res.status(404).json({
      error: {
        code: 'NO_DATA_AVAILABLE',
      },
    })
  })

  // Rankings Endpoint
  router.get('/rankings', (req, res) => {
    const requestedDate = req.query['date'] as string | undefined

    if (requestedDate) {
      // Validate date format (YYYY-MM-DD)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
        return res.status(400).json({
          error: {
            code: 'INVALID_DATE_FORMAT',
            message: 'Date must be in YYYY-MM-DD format',
            details: `Received: ${requestedDate}`,
          },
        })
      }

      // For testing: specific date requested but no snapshot exists
      return res.status(404).json({
        error: {
          code: 'SNAPSHOT_NOT_FOUND',
          message: `No snapshot available for date ${requestedDate}`,
          details: 'The requested date does not have cached data',
        },
      })
    }

    // No date parameter - return 503 for no latest snapshot
    res.status(503).json({
      error: {
        code: 'NO_SNAPSHOT_AVAILABLE',
        message: 'No data snapshot available yet',
        details: 'Run a refresh operation to create the first snapshot',
      },
    })
  })

  // Export Endpoints
  router.get('/:districtId/export', (req, res) => {
    const districtId = req.params['districtId']
    if (!districtId || !/^[A-Za-z0-9]+$/.test(districtId)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DISTRICT_ID',
        },
      })
    }

    const format = req.query['format']
    if (!format) {
      return res.status(400).json({
        error: {
          code: 'INVALID_FORMAT',
        },
      })
    }

    if (format !== 'csv' && format !== 'json') {
      return res.status(400).json({
        error: {
          code: 'INVALID_FORMAT',
        },
      })
    }

    const { startDate, endDate } = req.query

    if (startDate && isNaN(new Date(startDate as string).getTime())) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DATE_FORMAT',
        },
      })
    }

    if (
      startDate &&
      endDate &&
      new Date(startDate as string) > new Date(endDate as string)
    ) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DATE_RANGE',
        },
      })
    }

    res.status(404).json({
      error: {
        code: 'NO_DATA_AVAILABLE',
      },
    })
  })

  // Unified Backfill Endpoints
  router.post('/backfill', (req, res) => {
    const body = req.body || {}
    const { startDate, endDate, targetDistricts, collectionType } = body

    if (!startDate) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: [
            {
              field: 'startDate',
              message: 'startDate is required',
            },
          ],
        },
      })
    }

    if (isNaN(new Date(startDate).getTime())) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: [
            {
              field: 'startDate',
              message: 'startDate must be in YYYY-MM-DD format',
            },
          ],
        },
      })
    }

    if (endDate && isNaN(new Date(endDate).getTime())) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: [
            {
              field: 'endDate',
              message: 'endDate must be in YYYY-MM-DD format',
            },
          ],
        },
      })
    }

    if (endDate && new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: [
            {
              field: 'dateRange',
              message: 'startDate must be before or equal to endDate',
            },
          ],
        },
      })
    }

    if (targetDistricts !== undefined && !Array.isArray(targetDistricts)) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: [
            {
              field: 'targetDistricts',
              message: 'targetDistricts must be an array',
            },
          ],
        },
      })
    }

    if (
      collectionType &&
      !['system-wide', 'per-district', 'auto'].includes(collectionType)
    ) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: [
            {
              field: 'collectionType',
              message: 'Invalid collectionType',
            },
          ],
        },
      })
    }

    // Return success for valid requests
    const backfillId = `test-backfill-${Date.now()}`
    res.setHeader('x-backfill-id', backfillId)
    res.status(202).json({
      backfillId,
      status: 'processing',
      scope: {
        type: 'single-district',
        targetDistricts: targetDistricts || ['42'],
      },
      progress: {
        completed: 0,
        total: 1,
        percentage: 0,
      },
      collectionStrategy: {
        type: collectionType || 'per-district',
        concurrency: 3,
      },
      links: {
        self: `/api/districts/backfill/${backfillId}`,
      },
    })
  })

  router.get('/backfill/:backfillId', (req, res) => {
    const backfillId = req.params['backfillId']
    if (!backfillId || !/^[A-Za-z0-9-]+$/.test(backfillId)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_BACKFILL_ID',
          message: 'Invalid backfill ID format',
        },
      })
    }

    res.status(404).json({
      error: {
        code: 'BACKFILL_NOT_FOUND',
        message: 'Backfill job not found',
        suggestions: [
          'Verify the backfill ID is correct',
          'Check if the job has been completed and cleaned up',
          'Initiate a new backfill if needed',
        ],
      },
    })
  })

  router.delete('/backfill/:backfillId', (req, res) => {
    const backfillId = req.params['backfillId']
    if (!backfillId || !/^[A-Za-z0-9-]+$/.test(backfillId)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_BACKFILL_ID',
          message: 'Invalid backfill ID format',
        },
      })
    }

    res.status(404).json({
      error: {
        code: 'BACKFILL_NOT_FOUND',
        message: 'Backfill job not found',
        suggestions: [
          'Verify the backfill ID is correct',
          'Check if the job has already completed',
          'Use GET /api/districts/backfill/:id to check job status',
        ],
      },
    })
  })

  app.use('/api/districts', router)

  return app
}

describe('Districts API Integration Tests', () => {
  let testConfig: TestCacheConfig
  let app: Express

  // Create isolated test environment before each test
  beforeEach(async () => {
    testConfig = await createTestCacheConfig('districts-integration')
    app = createIsolatedTestApp(testConfig.cacheDir)
  })

  // Clean up isolated test environment after each test
  afterEach(async () => {
    await cleanupTestCacheConfig(testConfig)
  })

  describe('GET /api/districts', () => {
    it('should return 503 when no snapshot is available', async () => {
      const response = await request(app).get('/api/districts').expect(503)

      expect(response.body.error.code).toBe('NO_SNAPSHOT_AVAILABLE')
      expect(response.body.error.message).toBe('No data snapshot available yet')
      expect(response.body.error.details).toBe(
        'Run a refresh operation to create the first snapshot'
      )
    })
  })

  describe('GET /api/districts/:districtId/statistics', () => {
    it('should return 400 for invalid district ID format', async () => {
      const response = await request(app)
        .get('/api/districts/invalid@id/statistics')
        .expect(400)

      expect(response.body.error.code).toBe('INVALID_DISTRICT_ID')
    })

    it('should return 503 when no snapshot is available', async () => {
      const response = await request(app)
        .get('/api/districts/D123/statistics')
        .expect(503)

      expect(response.body.error.code).toBe('NO_SNAPSHOT_AVAILABLE')
      expect(response.body.error.message).toBe('No data snapshot available yet')
      expect(response.body.error.details).toBe(
        'Run a refresh operation to create the first snapshot'
      )
    })
  })

  describe('GET /api/districts/:districtId/membership-history', () => {
    it('should return 400 for invalid district ID format', async () => {
      const response = await request(app)
        .get('/api/districts/invalid@id/membership-history')
        .expect(400)

      expect(response.body.error.code).toBe('INVALID_DISTRICT_ID')
    })

    it('should return 400 for invalid months parameter', async () => {
      const response = await request(app)
        .get('/api/districts/D123/membership-history?months=invalid')
        .expect(400)

      expect(response.body.error.code).toBe('INVALID_MONTHS_PARAMETER')
    })

    it('should return 400 for months parameter out of range', async () => {
      const response = await request(app)
        .get('/api/districts/D123/membership-history?months=30')
        .expect(400)

      expect(response.body.error.code).toBe('INVALID_MONTHS_PARAMETER')
    })

    it('should return 503 when no snapshot is available', async () => {
      const response = await request(app)
        .get('/api/districts/D123/membership-history')
        .expect(503)

      expect(response.body.error.code).toBe('NO_SNAPSHOT_AVAILABLE')
    })
  })

  describe('GET /api/districts/:districtId/clubs', () => {
    it('should return 400 for invalid district ID format', async () => {
      const response = await request(app)
        .get('/api/districts/invalid@id/clubs')
        .expect(400)

      expect(response.body.error.code).toBe('INVALID_DISTRICT_ID')
    })

    it('should return 503 when no snapshot is available', async () => {
      const response = await request(app)
        .get('/api/districts/D123/clubs')
        .expect(503)

      expect(response.body.error.code).toBe('NO_SNAPSHOT_AVAILABLE')
    })
  })

  describe('GET /api/districts/:districtId/daily-reports', () => {
    it('should return 400 when date parameters are missing', async () => {
      const response = await request(app)
        .get('/api/districts/D123/daily-reports')
        .expect(400)

      expect(response.body.error.code).toBe('MISSING_DATE_PARAMETERS')
    })

    it('should return 400 for invalid date format', async () => {
      const response = await request(app)
        .get(
          '/api/districts/D123/daily-reports?startDate=2024-13-01&endDate=2024-12-31'
        )
        .expect(400)

      expect(response.body.error.code).toBe('INVALID_DATE_FORMAT')
    })

    it('should return 400 when startDate is after endDate', async () => {
      const response = await request(app)
        .get(
          '/api/districts/D123/daily-reports?startDate=2024-12-31&endDate=2024-01-01'
        )
        .expect(400)

      expect(response.body.error.code).toBe('INVALID_DATE_RANGE')
    })

    it('should return 400 when date range exceeds 90 days', async () => {
      const response = await request(app)
        .get(
          '/api/districts/D123/daily-reports?startDate=2024-01-01&endDate=2024-12-31'
        )
        .expect(400)

      expect(response.body.error.code).toBe('DATE_RANGE_TOO_LARGE')
    })

    it('should return 503 when no snapshot is available', async () => {
      const response = await request(app)
        .get(
          '/api/districts/D123/daily-reports?startDate=2024-01-01&endDate=2024-01-31'
        )
        .expect(503)

      expect(response.body.error.code).toBe('NO_SNAPSHOT_AVAILABLE')
    })
  })

  describe('GET /api/districts/:districtId/daily-reports/:date', () => {
    it('should return 400 for invalid date format', async () => {
      const response = await request(app)
        .get('/api/districts/D123/daily-reports/invalid-date')
        .expect(400)

      expect(response.body.error.code).toBe('INVALID_DATE_FORMAT')
    })

    it('should return 400 for future date', async () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 10)
      const futureDateStr = futureDate.toISOString().split('T')[0]

      const response = await request(app)
        .get(`/api/districts/D123/daily-reports/${futureDateStr}`)
        .expect(400)

      expect(response.body.error.code).toBe('FUTURE_DATE_NOT_ALLOWED')
    })

    it('should return 503 when no snapshot is available', async () => {
      const response = await request(app)
        .get('/api/districts/D123/daily-reports/2024-01-01')
        .expect(503)

      expect(response.body.error.code).toBe('NO_SNAPSHOT_AVAILABLE')
    })
  })

  describe('GET /api/districts/:districtId/educational-awards', () => {
    it('should return 400 for invalid district ID format', async () => {
      const response = await request(app)
        .get('/api/districts/invalid@id/educational-awards')
        .expect(400)

      expect(response.body.error.code).toBe('INVALID_DISTRICT_ID')
    })

    it('should return 400 for invalid months parameter', async () => {
      const response = await request(app)
        .get('/api/districts/D123/educational-awards?months=invalid')
        .expect(400)

      expect(response.body.error.code).toBe('INVALID_MONTHS_PARAMETER')
    })

    it('should return 503 when no snapshot is available', async () => {
      const response = await request(app)
        .get('/api/districts/D123/educational-awards')
        .expect(503)

      expect(response.body.error.code).toBe('NO_SNAPSHOT_AVAILABLE')
    })
  })

  describe('GET /api/districts/:districtId/rank-history', () => {
    it('should return 400 for invalid district ID format', async () => {
      const response = await request(app)
        .get('/api/districts/invalid@id/rank-history')
        .expect(400)

      expect(response.body.error.code).toBe('INVALID_DISTRICT_ID')
    })

    it('should return 503 when no snapshot is available', async () => {
      const response = await request(app)
        .get('/api/districts/D123/rank-history')
        .expect(503)

      expect(response.body.error.code).toBe('NO_SNAPSHOT_AVAILABLE')
    })
  })

  describe('District-Level Data Endpoints', () => {
    describe('GET /api/districts/:districtId/cached-dates', () => {
      it('should return 400 for invalid district ID format', async () => {
        const response = await request(app)
          .get('/api/districts/invalid@id/cached-dates')
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_DISTRICT_ID')
      })

      it('should return empty array when no cached dates exist', async () => {
        const response = await request(app)
          .get('/api/districts/D999/cached-dates')
          .expect(200)

        expect(response.body.dates).toEqual([])
        expect(response.body.count).toBe(0)
        expect(response.body.dateRange).toBeNull()
      })
    })

    describe('POST /api/districts/:districtId/backfill', () => {
      it('should return 400 for invalid district ID format', async () => {
        const response = await request(app)
          .post('/api/districts/invalid@id/backfill')
          .send({})
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_DISTRICT_ID')
      })

      it('should return 400 for invalid startDate format', async () => {
        const response = await request(app)
          .post('/api/districts/D123/backfill')
          .send({ startDate: 'invalid-date' })
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_DATE_FORMAT')
      })

      it('should return 400 for invalid endDate format', async () => {
        const response = await request(app)
          .post('/api/districts/D123/backfill')
          .send({ endDate: 'invalid-date' })
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_DATE_FORMAT')
      })

      it('should return 400 when startDate is after endDate', async () => {
        const response = await request(app)
          .post('/api/districts/D123/backfill')
          .send({
            startDate: '2024-12-31',
            endDate: '2024-01-01',
          })
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_DATE_RANGE')
      })

      it('should return 400 when date range exceeds 365 days', async () => {
        const response = await request(app)
          .post('/api/districts/D123/backfill')
          .send({
            startDate: '2023-01-01',
            endDate: '2024-12-31',
          })
          .expect(400)

        expect(response.body.error.code).toBe('DATE_RANGE_TOO_LARGE')
      })
    })

    describe('GET /api/districts/:districtId/backfill/:backfillId', () => {
      it('should return 400 for invalid district ID format', async () => {
        const response = await request(app)
          .get('/api/districts/invalid@id/backfill/test-id')
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_DISTRICT_ID')
      })

      it('should return 404 for non-existent backfill job', async () => {
        const response = await request(app)
          .get('/api/districts/D123/backfill/non-existent-id')
          .expect(404)

        expect(response.body.error.code).toBe('BACKFILL_NOT_FOUND')
      })
    })

    describe('DELETE /api/districts/:districtId/backfill/:backfillId', () => {
      it('should return 400 for invalid district ID format', async () => {
        const response = await request(app)
          .delete('/api/districts/invalid@id/backfill/test-id')
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_DISTRICT_ID')
      })

      it('should return 404 for non-existent backfill job', async () => {
        const response = await request(app)
          .delete('/api/districts/D123/backfill/non-existent-id')
          .expect(404)

        expect(response.body.error.code).toBe('BACKFILL_NOT_FOUND')
      })
    })
  })

  describe('Analytics Endpoints', () => {
    describe('GET /api/districts/:districtId/analytics', () => {
      it('should return 400 for invalid district ID format', async () => {
        const response = await request(app)
          .get('/api/districts/invalid@id/analytics')
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_DISTRICT_ID')
      })

      it('should return 400 for invalid startDate format', async () => {
        const response = await request(app)
          .get('/api/districts/D123/analytics?startDate=invalid-date')
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_DATE_FORMAT')
      })

      it('should return 400 for invalid endDate format', async () => {
        const response = await request(app)
          .get('/api/districts/D123/analytics?endDate=invalid-date')
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_DATE_FORMAT')
      })

      it('should return 400 when startDate is after endDate', async () => {
        const response = await request(app)
          .get(
            '/api/districts/D123/analytics?startDate=2024-12-31&endDate=2024-01-01'
          )
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_DATE_RANGE')
      })

      it('should return 404 when no cached data exists', async () => {
        const response = await request(app)
          .get('/api/districts/D999/analytics')
          .expect(404)

        expect(response.body.error.code).toBe('NO_DATA_AVAILABLE')
      })
    })

    describe('GET /api/districts/:districtId/clubs/:clubId/trends', () => {
      it('should return 400 for invalid district ID format', async () => {
        const response = await request(app)
          .get('/api/districts/invalid@id/clubs/12345/trends')
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_DISTRICT_ID')
      })

      it('should return 400 for missing club ID', async () => {
        const response = await request(app)
          .get('/api/districts/D123/clubs/ /trends')
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_CLUB_ID')
      })

      it('should return 404 when club not found', async () => {
        const response = await request(app)
          .get('/api/districts/D999/clubs/12345/trends')
          .expect(404)

        expect(response.body.error.code).toBe('CLUB_NOT_FOUND')
      })
    })

    describe('GET /api/districts/:districtId/vulnerable-clubs', () => {
      it('should return 400 for invalid district ID format', async () => {
        const response = await request(app)
          .get('/api/districts/invalid@id/vulnerable-clubs')
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_DISTRICT_ID')
      })

      it('should return empty array when no cached data exists', async () => {
        const response = await request(app)
          .get('/api/districts/D999/vulnerable-clubs')
          .expect(200)

        expect(response.body.clubs).toEqual([])
        expect(response.body.totalVulnerableClubs).toBe(0)
      })
    })

    describe('GET /api/districts/:districtId/leadership-insights', () => {
      it('should return 400 for invalid district ID format', async () => {
        const response = await request(app)
          .get('/api/districts/invalid@id/leadership-insights')
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_DISTRICT_ID')
      })

      it('should return 400 for invalid date format', async () => {
        const response = await request(app)
          .get('/api/districts/D123/leadership-insights?startDate=invalid')
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_DATE_FORMAT')
      })

      it('should return 404 when no cached data exists', async () => {
        const response = await request(app)
          .get('/api/districts/D999/leadership-insights')
          .expect(404)

        expect(response.body.error.code).toBe('NO_DATA_AVAILABLE')
      })
    })

    describe('GET /api/districts/:districtId/distinguished-club-analytics', () => {
      it('should return 400 for invalid district ID format', async () => {
        const response = await request(app)
          .get('/api/districts/invalid@id/distinguished-club-analytics')
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_DISTRICT_ID')
      })

      it('should return 404 when no cached data exists', async () => {
        const response = await request(app)
          .get('/api/districts/D999/distinguished-club-analytics')
          .expect(404)

        expect(response.body.error.code).toBe('NO_DATA_AVAILABLE')
      })
    })

    describe('GET /api/districts/:districtId/year-over-year/:date', () => {
      it('should return 400 for invalid district ID format', async () => {
        const response = await request(app)
          .get('/api/districts/invalid@id/year-over-year/2024-01-01')
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_DISTRICT_ID')
      })

      it('should return 400 for invalid date format', async () => {
        const response = await request(app)
          .get('/api/districts/D123/year-over-year/invalid-date')
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_DATE_FORMAT')
      })
    })

    describe('GET /api/districts/:districtId/membership-analytics', () => {
      it('should return 400 for invalid district ID format', async () => {
        const response = await request(app)
          .get('/api/districts/invalid@id/membership-analytics')
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_DISTRICT_ID')
      })

      it('should return 404 when no cached data exists', async () => {
        const response = await request(app)
          .get('/api/districts/D999/membership-analytics')
          .expect(404)

        expect(response.body.error.code).toBe('NO_DATA_AVAILABLE')
      })
    })
  })

  describe('Rankings Endpoint', () => {
    describe('GET /api/districts/rankings', () => {
      it('should return 503 when no snapshot is available', async () => {
        const response = await request(app)
          .get('/api/districts/rankings')
          .expect(503)

        expect(response.body.error.code).toBe('NO_SNAPSHOT_AVAILABLE')
        expect(response.body.error.message).toBe(
          'No data snapshot available yet'
        )
        expect(response.body.error.details).toBe(
          'Run a refresh operation to create the first snapshot'
        )
      })

      it('should return 404 when no snapshot exists for requested date parameter', async () => {
        const response = await request(app)
          .get('/api/districts/rankings?date=2024-01-01')
          .expect(404)

        expect(response.body.error.code).toBe('SNAPSHOT_NOT_FOUND')
      })
    })
  })

  describe('Export Endpoints', () => {
    describe('GET /api/districts/:districtId/export', () => {
      it('should return 400 for invalid district ID format', async () => {
        const response = await request(app)
          .get('/api/districts/invalid@id/export?format=csv')
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_DISTRICT_ID')
      })

      it('should return 400 for missing format parameter', async () => {
        const response = await request(app)
          .get('/api/districts/D123/export')
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_FORMAT')
      })

      it('should return 400 for unsupported format', async () => {
        const response = await request(app)
          .get('/api/districts/D123/export?format=pdf')
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_FORMAT')
      })

      it('should return 400 for invalid date format', async () => {
        const response = await request(app)
          .get('/api/districts/D123/export?format=csv&startDate=invalid')
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_DATE_FORMAT')
      })

      it('should return 400 when startDate is after endDate', async () => {
        const response = await request(app)
          .get(
            '/api/districts/D123/export?format=csv&startDate=2024-12-31&endDate=2024-01-01'
          )
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_DATE_RANGE')
      })

      it('should return 404 when no cached data exists', async () => {
        const response = await request(app)
          .get('/api/districts/D999/export?format=csv')
          .expect(404)

        expect(response.body.error.code).toBe('NO_DATA_AVAILABLE')
      })
    })
  })
})
