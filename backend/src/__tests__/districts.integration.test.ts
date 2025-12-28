import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { createTestApp } from './setup'

// Interface for district ranking data used in tests
interface DistrictRanking {
  districtId: string
  districtName: string
  region: string
  paidClubs: number
  totalPayments: number
  distinguishedClubs: number
  clubsRank: number
  paymentsRank: number
  distinguishedRank: number
  aggregateScore: number
  clubGrowthPercent: number
  paymentGrowthPercent: number
  distinguishedPercent: number
}

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
          rankings.forEach((district: DistrictRanking) => {
            // Borda points = totalDistricts - rank + 1
            // So for rank 1: points = totalDistricts
            // For rank N: points = 1

            // Aggregate score should be sum of three Borda point values
            // So minimum is 3 (1+1+1) and maximum is 3*totalDistricts
            expect(district.aggregateScore).toBeGreaterThanOrEqual(3)
            expect(district.aggregateScore).toBeLessThanOrEqual(
              3 * totalDistricts
            )
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
          rankings.forEach((district: DistrictRanking) => {
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

          rankings.forEach((district: DistrictRanking) => {
            const clubPercent = district.clubGrowthPercent
            if (!clubPercentages.has(clubPercent)) {
              clubPercentages.set(clubPercent, [])
            }
            clubPercentages.get(clubPercent)!.push(district.districtId)
          })

          // If we find districts with same percentage values, they should have same rank
          clubPercentages.forEach(districtIds => {
            if (districtIds.length > 1) {
              const ranks = districtIds.map(id => {
                const district = rankings.find(
                  (d: DistrictRanking) => d.districtId === id
                )
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

      // Task 6: Integration tests for Borda count system with percentage-based ranking
      describe('Borda Count System Integration Tests', () => {
        it('should verify ranks are based on percentages for clubs and payments categories', async () => {
          const response = await request(app)
            .get('/api/districts/rankings')
            .expect(200)

          const rankings = response.body.rankings

          if (rankings.length > 1) {
            // Sort by club growth percentage (descending) to verify ranking logic
            const sortedByClubPercent = [...rankings].sort(
              (a, b) => b.clubGrowthPercent - a.clubGrowthPercent
            )

            // Verify that districts with higher club growth percentage get better (lower) ranks
            let previousRank = 0
            let previousPercent = Number.MAX_VALUE

            sortedByClubPercent.forEach((district: DistrictRanking) => {
              if (district.clubGrowthPercent < previousPercent) {
                // Percentage decreased, so rank should be worse (higher number) or equal
                expect(district.clubsRank).toBeGreaterThanOrEqual(previousRank)
              } else if (district.clubGrowthPercent === previousPercent) {
                // Same percentage, should have same rank
                expect(district.clubsRank).toBe(previousRank)
              }
              previousRank = district.clubsRank
              previousPercent = district.clubGrowthPercent
            })

            // Same verification for payment growth percentage
            const sortedByPaymentPercent = [...rankings].sort(
              (a, b) => b.paymentGrowthPercent - a.paymentGrowthPercent
            )

            previousRank = 0
            previousPercent = Number.MAX_VALUE

            sortedByPaymentPercent.forEach((district: DistrictRanking) => {
              if (district.paymentGrowthPercent < previousPercent) {
                expect(district.paymentsRank).toBeGreaterThanOrEqual(
                  previousRank
                )
              } else if (district.paymentGrowthPercent === previousPercent) {
                expect(district.paymentsRank).toBe(previousRank)
              }
              previousRank = district.paymentsRank
              previousPercent = district.paymentGrowthPercent
            })
          }
        })

        it('should verify Borda scores calculated correctly in response', async () => {
          const response = await request(app)
            .get('/api/districts/rankings')
            .expect(200)

          const rankings = response.body.rankings
          const totalDistricts = rankings.length

          if (totalDistricts > 0) {
            rankings.forEach((district: DistrictRanking) => {
              // Calculate expected Borda points for each category
              const clubBordaPoints = totalDistricts - district.clubsRank + 1
              const paymentBordaPoints =
                totalDistricts - district.paymentsRank + 1
              const distinguishedBordaPoints =
                totalDistricts - district.distinguishedRank + 1

              const expectedAggregateScore =
                clubBordaPoints + paymentBordaPoints + distinguishedBordaPoints

              // Verify the aggregate score matches the sum of Borda points
              expect(district.aggregateScore).toBe(expectedAggregateScore)

              // Verify individual Borda point calculations are within valid range
              expect(clubBordaPoints).toBeGreaterThanOrEqual(1)
              expect(clubBordaPoints).toBeLessThanOrEqual(totalDistricts)
              expect(paymentBordaPoints).toBeGreaterThanOrEqual(1)
              expect(paymentBordaPoints).toBeLessThanOrEqual(totalDistricts)
              expect(distinguishedBordaPoints).toBeGreaterThanOrEqual(1)
              expect(distinguishedBordaPoints).toBeLessThanOrEqual(
                totalDistricts
              )
            })
          }
        })

        it('should verify percentage values included in API response', async () => {
          const response = await request(app)
            .get('/api/districts/rankings')
            .expect(200)

          const rankings = response.body.rankings

          if (rankings.length > 0) {
            rankings.forEach((district: DistrictRanking) => {
              // Verify all three percentage fields are present and are numbers
              expect(district).toHaveProperty('clubGrowthPercent')
              expect(district).toHaveProperty('paymentGrowthPercent')
              expect(district).toHaveProperty('distinguishedPercent')

              expect(typeof district.clubGrowthPercent).toBe('number')
              expect(typeof district.paymentGrowthPercent).toBe('number')
              expect(typeof district.distinguishedPercent).toBe('number')

              // Verify percentages are reasonable values (not NaN or Infinity)
              expect(Number.isFinite(district.clubGrowthPercent)).toBe(true)
              expect(Number.isFinite(district.paymentGrowthPercent)).toBe(true)
              expect(Number.isFinite(district.distinguishedPercent)).toBe(true)
            })
          }
        })

        it('should verify sorting by aggregate Borda score (descending)', async () => {
          const response = await request(app)
            .get('/api/districts/rankings')
            .expect(200)

          const rankings = response.body.rankings

          if (rankings.length > 1) {
            // Verify that rankings are sorted by aggregate score in descending order
            for (let i = 0; i < rankings.length - 1; i++) {
              const currentScore = rankings[i].aggregateScore
              const nextScore = rankings[i + 1].aggregateScore

              // Current district should have higher or equal aggregate score than next
              expect(currentScore).toBeGreaterThanOrEqual(nextScore)
            }

            // Verify that the first district has the highest aggregate score
            const maxScore = Math.max(
              ...rankings.map((d: DistrictRanking) => d.aggregateScore)
            )
            expect(rankings[0].aggregateScore).toBe(maxScore)

            // Verify that the last district has the lowest aggregate score
            const minScore = Math.min(
              ...rankings.map((d: DistrictRanking) => d.aggregateScore)
            )
            expect(rankings[rankings.length - 1].aggregateScore).toBe(minScore)
          }
        })

        it('should verify end-to-end ranking API call returns complete data structure', async () => {
          const response = await request(app)
            .get('/api/districts/rankings')
            .expect(200)

          // Verify top-level response structure
          expect(response.body).toHaveProperty('rankings')
          expect(response.body).toHaveProperty('date')
          expect(Array.isArray(response.body.rankings)).toBe(true)
          expect(typeof response.body.date).toBe('string')

          const rankings = response.body.rankings

          if (rankings.length > 0) {
            const district = rankings[0]

            // Verify complete district data structure
            const requiredFields = [
              'districtId',
              'districtName',
              'region',
              'paidClubs',
              'paidClubBase',
              'clubGrowthPercent',
              'totalPayments',
              'paymentBase',
              'paymentGrowthPercent',
              'activeClubs',
              'distinguishedClubs',
              'selectDistinguished',
              'presidentsDistinguished',
              'distinguishedPercent',
              'clubsRank',
              'paymentsRank',
              'distinguishedRank',
              'aggregateScore',
            ]

            requiredFields.forEach(field => {
              expect(district).toHaveProperty(field)
            })

            // Verify data types
            expect(typeof district.districtId).toBe('string')
            expect(typeof district.districtName).toBe('string')
            expect(typeof district.region).toBe('string')
            expect(typeof district.paidClubs).toBe('number')
            expect(typeof district.totalPayments).toBe('number')
            expect(typeof district.distinguishedClubs).toBe('number')
            expect(typeof district.clubsRank).toBe('number')
            expect(typeof district.paymentsRank).toBe('number')
            expect(typeof district.distinguishedRank).toBe('number')
            expect(typeof district.aggregateScore).toBe('number')
            expect(typeof district.clubGrowthPercent).toBe('number')
            expect(typeof district.paymentGrowthPercent).toBe('number')
            expect(typeof district.distinguishedPercent).toBe('number')
          }
        })

        it('should handle edge cases in Borda point calculation', async () => {
          const response = await request(app)
            .get('/api/districts/rankings')
            .expect(200)

          const rankings = response.body.rankings
          const totalDistricts = rankings.length

          if (totalDistricts > 0) {
            // Find districts with rank 1 (should get maximum Borda points)
            const rank1Districts = rankings.filter(
              (d: DistrictRanking) =>
                d.clubsRank === 1 ||
                d.paymentsRank === 1 ||
                d.distinguishedRank === 1
            )

            rank1Districts.forEach((district: DistrictRanking) => {
              if (district.clubsRank === 1) {
                const expectedPoints = totalDistricts - 1 + 1 // totalDistricts
                const actualPoints = totalDistricts - district.clubsRank + 1
                expect(actualPoints).toBe(expectedPoints)
              }
              if (district.paymentsRank === 1) {
                const expectedPoints = totalDistricts - 1 + 1 // totalDistricts
                const actualPoints = totalDistricts - district.paymentsRank + 1
                expect(actualPoints).toBe(expectedPoints)
              }
              if (district.distinguishedRank === 1) {
                const expectedPoints = totalDistricts - 1 + 1 // totalDistricts
                const actualPoints =
                  totalDistricts - district.distinguishedRank + 1
                expect(actualPoints).toBe(expectedPoints)
              }
            })

            // Find districts with worst rank (should get minimum Borda points = 1)
            const maxRank = Math.max(
              ...rankings.map((d: DistrictRanking) =>
                Math.max(d.clubsRank, d.paymentsRank, d.distinguishedRank)
              )
            )
            const worstRankDistricts = rankings.filter(
              (d: DistrictRanking) =>
                d.clubsRank === maxRank ||
                d.paymentsRank === maxRank ||
                d.distinguishedRank === maxRank
            )

            worstRankDistricts.forEach((district: DistrictRanking) => {
              if (district.clubsRank === maxRank) {
                const actualPoints = totalDistricts - district.clubsRank + 1
                expect(actualPoints).toBeGreaterThanOrEqual(1)
              }
              if (district.paymentsRank === maxRank) {
                const actualPoints = totalDistricts - district.paymentsRank + 1
                expect(actualPoints).toBeGreaterThanOrEqual(1)
              }
              if (district.distinguishedRank === maxRank) {
                const actualPoints =
                  totalDistricts - district.distinguishedRank + 1
                expect(actualPoints).toBeGreaterThanOrEqual(1)
              }
            })
          }
        })
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
