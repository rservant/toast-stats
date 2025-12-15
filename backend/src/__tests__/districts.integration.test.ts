import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { createTestApp } from './setup.js'

describe('Districts API Integration Tests', () => {
  const app = createTestApp()

  describe('GET /api/districts/:districtId/statistics', () => {
    it('should return 400 for invalid district ID format', async () => {
      const response = await request(app)
        .get('/api/districts/invalid@id/statistics')
        .expect(400)

      expect(response.body.error.code).toBe('INVALID_DISTRICT_ID')
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
  })

  describe('GET /api/districts/:districtId/clubs', () => {
    it('should return 400 for invalid district ID format', async () => {
      const response = await request(app)
        .get('/api/districts/invalid@id/clubs')
        .expect(400)

      expect(response.body.error.code).toBe('INVALID_DISTRICT_ID')
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
        .get('/api/districts/D123/daily-reports?startDate=2024-13-01&endDate=2024-12-31')
        .expect(400)

      expect(response.body.error.code).toBe('INVALID_DATE_FORMAT')
    })

    it('should return 400 when startDate is after endDate', async () => {
      const response = await request(app)
        .get('/api/districts/D123/daily-reports?startDate=2024-12-31&endDate=2024-01-01')
        .expect(400)

      expect(response.body.error.code).toBe('INVALID_DATE_RANGE')
    })

    it('should return 400 when date range exceeds 90 days', async () => {
      const response = await request(app)
        .get('/api/districts/D123/daily-reports?startDate=2024-01-01&endDate=2024-12-31')
        .expect(400)

      expect(response.body.error.code).toBe('DATE_RANGE_TOO_LARGE')
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
          .get('/api/districts/D123/analytics?startDate=2024-12-31&endDate=2024-01-01')
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
      it('should return district rankings with Borda scores', async () => {
        const response = await request(app)
          .get('/api/districts/rankings')
          .expect(200)

        expect(response.body).toHaveProperty('rankings')
        expect(response.body).toHaveProperty('date')
        expect(Array.isArray(response.body.rankings)).toBe(true)

        // Verify rankings array has data
        if (response.body.rankings.length > 0) {
          const firstDistrict = response.body.rankings[0]

          // Verify all required fields are present
          expect(firstDistrict).toHaveProperty('districtId')
          expect(firstDistrict).toHaveProperty('districtName')
          expect(firstDistrict).toHaveProperty('paidClubs')
          expect(firstDistrict).toHaveProperty('totalPayments')
          expect(firstDistrict).toHaveProperty('distinguishedClubs')
          expect(firstDistrict).toHaveProperty('clubsRank')
          expect(firstDistrict).toHaveProperty('paymentsRank')
          expect(firstDistrict).toHaveProperty('distinguishedRank')
          expect(firstDistrict).toHaveProperty('aggregateScore')
          expect(firstDistrict).toHaveProperty('clubGrowthPercent')
          expect(firstDistrict).toHaveProperty('paymentGrowthPercent')

          // Verify rank numbers are positive integers
          expect(firstDistrict.clubsRank).toBeGreaterThan(0)
          expect(firstDistrict.paymentsRank).toBeGreaterThan(0)
          expect(firstDistrict.distinguishedRank).toBeGreaterThan(0)

          // Verify aggregate score is positive (sum of Borda points)
          expect(firstDistrict.aggregateScore).toBeGreaterThan(0)

          // Verify percentage values are numbers
          expect(typeof firstDistrict.clubGrowthPercent).toBe('number')
          expect(typeof firstDistrict.paymentGrowthPercent).toBe('number')
        }
      })

      it('should calculate Borda scores correctly', async () => {
        const response = await request(app)
          .get('/api/districts/rankings')
          .expect(200)

        const rankings = response.body.rankings

        if (rankings.length > 0) {
          const totalDistricts = rankings.length

          // Verify Borda point calculation for each district
          rankings.forEach((district: any) => {
            // Borda points = totalDistricts - rank + 1
            // So for rank 1: points = totalDistricts
            // For rank N: points = 1
            
            // Aggregate score should be sum of three Borda point values
            // So minimum is 3 (1+1+1) and maximum is 3*totalDistricts
            expect(district.aggregateScore).toBeGreaterThanOrEqual(3)
            expect(district.aggregateScore).toBeLessThanOrEqual(3 * totalDistricts)
          })
        }
      })

      it('should sort districts by aggregate Borda score in descending order', async () => {
        const response = await request(app)
          .get('/api/districts/rankings')
          .expect(200)

        const rankings = response.body.rankings

        if (rankings.length > 1) {
          // Verify descending order (higher Borda scores first)
          for (let i = 0; i < rankings.length - 1; i++) {
            expect(rankings[i].aggregateScore).toBeGreaterThanOrEqual(
              rankings[i + 1].aggregateScore
            )
          }
        }
      })

      it('should include percentage values in API response', async () => {
        const response = await request(app)
          .get('/api/districts/rankings')
          .expect(200)

        const rankings = response.body.rankings

        if (rankings.length > 0) {
          rankings.forEach((district: any) => {
            // Verify percentage fields exist and are numbers
            expect(district).toHaveProperty('clubGrowthPercent')
            expect(district).toHaveProperty('paymentGrowthPercent')
            expect(district).toHaveProperty('distinguishedPercent')
            
            expect(typeof district.clubGrowthPercent).toBe('number')
            expect(typeof district.paymentGrowthPercent).toBe('number')
            expect(typeof district.distinguishedPercent).toBe('number')
          })
        }
      })

      it('should handle optional date parameter', async () => {
        // First get available cached dates
        const datesResponse = await request(app)
          .get('/api/districts/cache/dates')
          .expect(200)

        const availableDates = datesResponse.body.dates

        if (availableDates.length > 0) {
          // Test with a specific cached date
          const testDate = availableDates[0]
          const response = await request(app)
            .get(`/api/districts/rankings?date=${testDate}`)
            .expect(200)

          expect(response.body).toHaveProperty('rankings')
          expect(response.body.date).toBe(testDate)
        }
      })

      it('should handle ties correctly with same Borda points', async () => {
        const response = await request(app)
          .get('/api/districts/rankings')
          .expect(200)

        const rankings = response.body.rankings

        if (rankings.length > 1) {
          // Check if there are any ties in the data - ranking is based on PERCENTAGES
          const clubPercentages = new Map<number, string[]>()
          
          rankings.forEach((district: any) => {
            const clubPercent = district.clubGrowthPercent
            if (!clubPercentages.has(clubPercent)) {
              clubPercentages.set(clubPercent, [])
            }
            clubPercentages.get(clubPercent)!.push(district.districtId)
          })

          // If we find districts with same percentage values, they should have same rank
          clubPercentages.forEach((districtIds) => {
            if (districtIds.length > 1) {
              const ranks = districtIds.map(id => {
                const district = rankings.find((d: any) => d.districtId === id)
                return district?.clubsRank
              })
              
              // All tied districts should have the same rank
              const firstRank = ranks[0]
              ranks.forEach(rank => {
                expect(rank).toBe(firstRank)
              })
            }
          })
        }
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
          .get('/api/districts/D123/export?format=csv&startDate=2024-12-31&endDate=2024-01-01')
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
