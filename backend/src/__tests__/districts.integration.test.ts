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
})
