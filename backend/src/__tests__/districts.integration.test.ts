import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { createTestApp } from './setup.js'

describe('Districts API Integration Tests', () => {
  const app = createTestApp()
  let authToken: string

  beforeAll(async () => {
    // Get auth token for protected routes
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'testuser',
        password: 'password123',
      })

    authToken = response.body.token
  })

  describe('Authentication Required', () => {
    it('should return 401 when accessing districts without token', async () => {
      await request(app).get('/api/districts').expect(401)
    })

    it('should return 401 when accessing district statistics without token', async () => {
      await request(app).get('/api/districts/D123/statistics').expect(401)
    })

    it('should return 401 with invalid token', async () => {
      await request(app)
        .get('/api/districts')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401)
    })
  })

  describe('GET /api/districts/:districtId/statistics', () => {
    it('should return 400 for invalid district ID format', async () => {
      const response = await request(app)
        .get('/api/districts/invalid@id/statistics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400)

      expect(response.body.error.code).toBe('INVALID_DISTRICT_ID')
    })
  })

  describe('GET /api/districts/:districtId/membership-history', () => {
    it('should return 400 for invalid district ID format', async () => {
      const response = await request(app)
        .get('/api/districts/invalid@id/membership-history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400)

      expect(response.body.error.code).toBe('INVALID_DISTRICT_ID')
    })

    it('should return 400 for invalid months parameter', async () => {
      const response = await request(app)
        .get('/api/districts/D123/membership-history?months=invalid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400)

      expect(response.body.error.code).toBe('INVALID_MONTHS_PARAMETER')
    })

    it('should return 400 for months parameter out of range', async () => {
      const response = await request(app)
        .get('/api/districts/D123/membership-history?months=30')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400)

      expect(response.body.error.code).toBe('INVALID_MONTHS_PARAMETER')
    })
  })

  describe('GET /api/districts/:districtId/clubs', () => {
    it('should return 400 for invalid district ID format', async () => {
      const response = await request(app)
        .get('/api/districts/invalid@id/clubs')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400)

      expect(response.body.error.code).toBe('INVALID_DISTRICT_ID')
    })
  })

  describe('GET /api/districts/:districtId/daily-reports', () => {
    it('should return 400 when date parameters are missing', async () => {
      const response = await request(app)
        .get('/api/districts/D123/daily-reports')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400)

      expect(response.body.error.code).toBe('MISSING_DATE_PARAMETERS')
    })

    it('should return 400 for invalid date format', async () => {
      const response = await request(app)
        .get('/api/districts/D123/daily-reports?startDate=2024-13-01&endDate=2024-12-31')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400)

      expect(response.body.error.code).toBe('INVALID_DATE_FORMAT')
    })

    it('should return 400 when startDate is after endDate', async () => {
      const response = await request(app)
        .get('/api/districts/D123/daily-reports?startDate=2024-12-31&endDate=2024-01-01')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400)

      expect(response.body.error.code).toBe('INVALID_DATE_RANGE')
    })

    it('should return 400 when date range exceeds 90 days', async () => {
      const response = await request(app)
        .get('/api/districts/D123/daily-reports?startDate=2024-01-01&endDate=2024-12-31')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400)

      expect(response.body.error.code).toBe('DATE_RANGE_TOO_LARGE')
    })
  })

  describe('GET /api/districts/:districtId/daily-reports/:date', () => {
    it('should return 400 for invalid date format', async () => {
      const response = await request(app)
        .get('/api/districts/D123/daily-reports/invalid-date')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400)

      expect(response.body.error.code).toBe('INVALID_DATE_FORMAT')
    })

    it('should return 400 for future date', async () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 10)
      const futureDateStr = futureDate.toISOString().split('T')[0]

      const response = await request(app)
        .get(`/api/districts/D123/daily-reports/${futureDateStr}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400)

      expect(response.body.error.code).toBe('FUTURE_DATE_NOT_ALLOWED')
    })
  })

  describe('GET /api/districts/:districtId/educational-awards', () => {
    it('should return 400 for invalid district ID format', async () => {
      const response = await request(app)
        .get('/api/districts/invalid@id/educational-awards')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400)

      expect(response.body.error.code).toBe('INVALID_DISTRICT_ID')
    })

    it('should return 400 for invalid months parameter', async () => {
      const response = await request(app)
        .get('/api/districts/D123/educational-awards?months=invalid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400)

      expect(response.body.error.code).toBe('INVALID_MONTHS_PARAMETER')
    })
  })

  describe('District-Level Data Endpoints', () => {
    describe('GET /api/districts/:districtId/data/:date', () => {
      it('should return 400 for invalid district ID format', async () => {
        const response = await request(app)
          .get('/api/districts/invalid@id/data/2024-01-01')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_DISTRICT_ID')
      })

      it('should return 400 for invalid date format', async () => {
        const response = await request(app)
          .get('/api/districts/D123/data/invalid-date')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_DATE_FORMAT')
      })

      it('should return 404 when no cached data exists', async () => {
        const response = await request(app)
          .get('/api/districts/D123/data/2024-01-01')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404)

        expect(response.body.error.code).toBe('DATA_NOT_FOUND')
      })
    })

    describe('GET /api/districts/:districtId/cached-dates', () => {
      it('should return 400 for invalid district ID format', async () => {
        const response = await request(app)
          .get('/api/districts/invalid@id/cached-dates')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_DISTRICT_ID')
      })

      it('should return empty array when no cached dates exist', async () => {
        const response = await request(app)
          .get('/api/districts/D999/cached-dates')
          .set('Authorization', `Bearer ${authToken}`)
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
          .set('Authorization', `Bearer ${authToken}`)
          .send({})
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_DISTRICT_ID')
      })

      it('should return 400 for invalid startDate format', async () => {
        const response = await request(app)
          .post('/api/districts/D123/backfill')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ startDate: 'invalid-date' })
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_DATE_FORMAT')
      })

      it('should return 400 for invalid endDate format', async () => {
        const response = await request(app)
          .post('/api/districts/D123/backfill')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ endDate: 'invalid-date' })
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_DATE_FORMAT')
      })

      it('should return 400 when startDate is after endDate', async () => {
        const response = await request(app)
          .post('/api/districts/D123/backfill')
          .set('Authorization', `Bearer ${authToken}`)
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
          .set('Authorization', `Bearer ${authToken}`)
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
          .set('Authorization', `Bearer ${authToken}`)
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_DISTRICT_ID')
      })

      it('should return 404 for non-existent backfill job', async () => {
        const response = await request(app)
          .get('/api/districts/D123/backfill/non-existent-id')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404)

        expect(response.body.error.code).toBe('BACKFILL_NOT_FOUND')
      })
    })

    describe('DELETE /api/districts/:districtId/backfill/:backfillId', () => {
      it('should return 400 for invalid district ID format', async () => {
        const response = await request(app)
          .delete('/api/districts/invalid@id/backfill/test-id')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_DISTRICT_ID')
      })

      it('should return 404 for non-existent backfill job', async () => {
        const response = await request(app)
          .delete('/api/districts/D123/backfill/non-existent-id')
          .set('Authorization', `Bearer ${authToken}`)
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
          .set('Authorization', `Bearer ${authToken}`)
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_DISTRICT_ID')
      })

      it('should return 400 for invalid startDate format', async () => {
        const response = await request(app)
          .get('/api/districts/D123/analytics?startDate=invalid-date')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_DATE_FORMAT')
      })

      it('should return 400 for invalid endDate format', async () => {
        const response = await request(app)
          .get('/api/districts/D123/analytics?endDate=invalid-date')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_DATE_FORMAT')
      })

      it('should return 400 when startDate is after endDate', async () => {
        const response = await request(app)
          .get('/api/districts/D123/analytics?startDate=2024-12-31&endDate=2024-01-01')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_DATE_RANGE')
      })

      it('should return 404 when no cached data exists', async () => {
        const response = await request(app)
          .get('/api/districts/D999/analytics')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404)

        expect(response.body.error.code).toBe('NO_DATA_AVAILABLE')
      })
    })

    describe('GET /api/districts/:districtId/clubs/:clubId/trends', () => {
      it('should return 400 for invalid district ID format', async () => {
        const response = await request(app)
          .get('/api/districts/invalid@id/clubs/12345/trends')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_DISTRICT_ID')
      })

      it('should return 400 for missing club ID', async () => {
        const response = await request(app)
          .get('/api/districts/D123/clubs/ /trends')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_CLUB_ID')
      })

      it('should return 404 when club not found', async () => {
        const response = await request(app)
          .get('/api/districts/D999/clubs/12345/trends')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404)

        expect(response.body.error.code).toBe('CLUB_NOT_FOUND')
      })
    })

    describe('GET /api/districts/:districtId/at-risk-clubs', () => {
      it('should return 400 for invalid district ID format', async () => {
        const response = await request(app)
          .get('/api/districts/invalid@id/at-risk-clubs')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_DISTRICT_ID')
      })

      it('should return empty array when no cached data exists', async () => {
        const response = await request(app)
          .get('/api/districts/D999/at-risk-clubs')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)

        expect(response.body.clubs).toEqual([])
        expect(response.body.totalAtRiskClubs).toBe(0)
      })
    })

    describe('GET /api/districts/:districtId/leadership-insights', () => {
      it('should return 400 for invalid district ID format', async () => {
        const response = await request(app)
          .get('/api/districts/invalid@id/leadership-insights')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_DISTRICT_ID')
      })

      it('should return 400 for invalid date format', async () => {
        const response = await request(app)
          .get('/api/districts/D123/leadership-insights?startDate=invalid')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_DATE_FORMAT')
      })

      it('should return 404 when no cached data exists', async () => {
        const response = await request(app)
          .get('/api/districts/D999/leadership-insights')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404)

        expect(response.body.error.code).toBe('NO_DATA_AVAILABLE')
      })
    })

    describe('GET /api/districts/:districtId/distinguished-club-analytics', () => {
      it('should return 400 for invalid district ID format', async () => {
        const response = await request(app)
          .get('/api/districts/invalid@id/distinguished-club-analytics')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_DISTRICT_ID')
      })

      it('should return 404 when no cached data exists', async () => {
        const response = await request(app)
          .get('/api/districts/D999/distinguished-club-analytics')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404)

        expect(response.body.error.code).toBe('NO_DATA_AVAILABLE')
      })
    })

    describe('GET /api/districts/:districtId/year-over-year/:date', () => {
      it('should return 400 for invalid district ID format', async () => {
        const response = await request(app)
          .get('/api/districts/invalid@id/year-over-year/2024-01-01')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_DISTRICT_ID')
      })

      it('should return 400 for invalid date format', async () => {
        const response = await request(app)
          .get('/api/districts/D123/year-over-year/invalid-date')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_DATE_FORMAT')
      })
    })

    describe('GET /api/districts/:districtId/membership-analytics', () => {
      it('should return 400 for invalid district ID format', async () => {
        const response = await request(app)
          .get('/api/districts/invalid@id/membership-analytics')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_DISTRICT_ID')
      })

      it('should return 404 when no cached data exists', async () => {
        const response = await request(app)
          .get('/api/districts/D999/membership-analytics')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404)

        expect(response.body.error.code).toBe('NO_DATA_AVAILABLE')
      })
    })
  })

  describe('Export Endpoints', () => {
    describe('GET /api/districts/:districtId/export', () => {
      it('should return 400 for invalid district ID format', async () => {
        const response = await request(app)
          .get('/api/districts/invalid@id/export?format=csv')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_DISTRICT_ID')
      })

      it('should return 400 for missing format parameter', async () => {
        const response = await request(app)
          .get('/api/districts/D123/export')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_FORMAT')
      })

      it('should return 400 for unsupported format', async () => {
        const response = await request(app)
          .get('/api/districts/D123/export?format=pdf')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_FORMAT')
      })

      it('should return 400 for invalid date format', async () => {
        const response = await request(app)
          .get('/api/districts/D123/export?format=csv&startDate=invalid')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_DATE_FORMAT')
      })

      it('should return 400 when startDate is after endDate', async () => {
        const response = await request(app)
          .get('/api/districts/D123/export?format=csv&startDate=2024-12-31&endDate=2024-01-01')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(400)

        expect(response.body.error.code).toBe('INVALID_DATE_RANGE')
      })

      it('should return 404 when no cached data exists', async () => {
        const response = await request(app)
          .get('/api/districts/D999/export?format=csv')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404)

        expect(response.body.error.code).toBe('NO_DATA_AVAILABLE')
      })
    })
  })
})
