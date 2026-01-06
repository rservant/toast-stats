import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { createTestApp } from './setup'

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

describe('Districts API Integration Tests', () => {
  const app = createTestApp()

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
    describe('GET /api/districts/:districtId/data/:date', () => {
      it('should return 400 for invalid district ID format', async () => {
        const response = await request(app)
          .get('/api/districts/invalid@id/data/2024-01-01')
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_DISTRICT_ID')
      })

      it('should return 400 for invalid date format', async () => {
        const response = await request(app)
          .get('/api/districts/D123/data/invalid-date')
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_DATE_FORMAT')
      })

      it('should return 404 when no cached data exists', async () => {
        const response = await request(app)
          .get('/api/districts/D123/data/2024-01-01')
          .expect(404)

        expect(response.body.error.code).toBe('DATA_NOT_FOUND')
      })
    })

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

    describe('GET /api/districts/:districtId/at-risk-clubs', () => {
      it('should return 400 for invalid district ID format', async () => {
        const response = await request(app)
          .get('/api/districts/invalid@id/at-risk-clubs')
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_DISTRICT_ID')
      })

      it('should return empty array when no cached data exists', async () => {
        const response = await request(app)
          .get('/api/districts/D999/at-risk-clubs')
          .expect(200)

        expect(response.body.clubs).toEqual([])
        expect(response.body.totalAtRiskClubs).toBe(0)
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

      it('should return 503 when no snapshot is available for date parameter', async () => {
        const response = await request(app)
          .get('/api/districts/rankings?date=2024-01-01')
          .expect(503)

        expect(response.body.error.code).toBe('NO_SNAPSHOT_AVAILABLE')
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

  describe('Unified Backfill Endpoints', () => {
    describe('POST /api/districts/backfill', () => {
      it('should return 400 for missing request body', async () => {
        const response = await request(app)
          .post('/api/districts/backfill')
          .expect(400)

        expect(response.body.error.code).toBe('VALIDATION_ERROR')
        expect(response.body.error.message).toBe('Request validation failed')
        expect(response.body.error.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              field: 'startDate',
              message: 'startDate is required',
            }),
          ])
        )
      })

      it('should return 400 for invalid startDate format', async () => {
        const response = await request(app)
          .post('/api/districts/backfill')
          .send({ startDate: 'invalid-date' })
          .expect(400)

        expect(response.body.error.code).toBe('VALIDATION_ERROR')
        expect(response.body.error.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              field: 'startDate',
              message: 'startDate must be in YYYY-MM-DD format',
            }),
          ])
        )
      })

      it('should return 400 for invalid endDate format', async () => {
        const response = await request(app)
          .post('/api/districts/backfill')
          .send({
            startDate: '2024-01-01',
            endDate: 'invalid-date',
          })
          .expect(400)

        expect(response.body.error.code).toBe('VALIDATION_ERROR')
        expect(response.body.error.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              field: 'endDate',
              message: 'endDate must be in YYYY-MM-DD format',
            }),
          ])
        )
      })

      it('should return 400 when startDate is after endDate', async () => {
        const response = await request(app)
          .post('/api/districts/backfill')
          .send({
            startDate: '2024-12-31',
            endDate: '2024-01-01',
          })
          .expect(400)

        expect(response.body.error.code).toBe('VALIDATION_ERROR')
        expect(response.body.error.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              field: 'dateRange',
              message: 'startDate must be before or equal to endDate',
            }),
          ])
        )
      })

      it('should return 400 for invalid targetDistricts format', async () => {
        const response = await request(app)
          .post('/api/districts/backfill')
          .send({
            startDate: '2024-01-01',
            targetDistricts: 'not-an-array',
          })
          .expect(400)

        expect(response.body.error.code).toBe('VALIDATION_ERROR')
        expect(response.body.error.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              field: 'targetDistricts',
              message: 'targetDistricts must be an array',
            }),
          ])
        )
      })

      it('should return 400 for invalid collectionType', async () => {
        const response = await request(app)
          .post('/api/districts/backfill')
          .send({
            startDate: '2024-01-01',
            collectionType: 'invalid-type',
          })
          .expect(400)

        expect(response.body.error.code).toBe('VALIDATION_ERROR')
        expect(response.body.error.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              field: 'collectionType',
              message: 'Invalid collectionType',
            }),
          ])
        )
      })

      it('should return 202 for valid backfill request', async () => {
        const response = await request(app)
          .post('/api/districts/backfill')
          .send({
            startDate: '2024-01-01',
            targetDistricts: ['42'],
            collectionType: 'per-district',
          })
          .expect(202)

        expect(response.body).toHaveProperty('backfillId')
        expect(response.body).toHaveProperty('status', 'processing')
        expect(response.body).toHaveProperty('scope')
        expect(response.body).toHaveProperty('progress')
        expect(response.body).toHaveProperty('collectionStrategy')
        expect(response.body).toHaveProperty('links')
        expect(response.body.links).toHaveProperty('self')
        expect(response.headers['x-backfill-id']).toBeDefined()
      })
    })

    describe('GET /api/districts/backfill/:backfillId', () => {
      it('should return 400 for invalid backfill ID format', async () => {
        const response = await request(app)
          .get('/api/districts/backfill/')
          .expect(404) // Express returns 404 for missing route parameter
      })

      it('should return 404 for non-existent backfill job', async () => {
        const response = await request(app)
          .get('/api/districts/backfill/non-existent-id')
          .expect(404)

        expect(response.body.error.code).toBe('BACKFILL_NOT_FOUND')
        expect(response.body.error.message).toBe('Backfill job not found')
        expect(response.body.error.suggestions).toEqual(
          expect.arrayContaining([
            'Verify the backfill ID is correct',
            'Check if the job has been completed and cleaned up',
            'Initiate a new backfill if needed',
          ])
        )
      })
    })

    describe('DELETE /api/districts/backfill/:backfillId', () => {
      it('should return 400 for invalid backfill ID format', async () => {
        const response = await request(app)
          .delete('/api/districts/backfill/ ')
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_BACKFILL_ID')
        expect(response.body.error.message).toBe('Invalid backfill ID format')
      })

      it('should return 404 for non-existent backfill job', async () => {
        const response = await request(app)
          .delete('/api/districts/backfill/non-existent-id')
          .expect(404)

        expect(response.body.error.code).toBe('BACKFILL_NOT_FOUND')
        expect(response.body.error.message).toBe('Backfill job not found')
        expect(response.body.error.suggestions).toEqual(
          expect.arrayContaining([
            'Verify the backfill ID is correct',
            'Check if the job has already completed',
            'Use GET /api/districts/backfill/:id to check job status',
          ])
        )
      })
    })
  })
})
