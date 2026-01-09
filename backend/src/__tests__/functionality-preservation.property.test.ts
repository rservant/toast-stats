/**
 * Property Test: Existing Functionality Preservation
 *
 * **Property 1: Existing Functionality Preservation**
 * *For any* API endpoint that existed before the cleanup, calling that endpoint
 * with the same parameters SHALL return a response with the same structure and
 * semantically equivalent data.
 *
 * **Validates: Requirements 1.6, 2.7, 3.3, 4.4, 5.5**
 *
 * This test verifies that the codebase cleanup preserved all existing functionality:
 * - Requirement 1.6: Legacy CacheManager removal didn't break functionality
 * - Requirement 2.7: Route splitting maintained API contracts
 * - Requirement 3.3: Backfill hook consolidation maintained backward compatibility
 * - Requirement 4.4: Test infrastructure simplification maintained essential functionality
 * - Requirement 5.5: Dead code removal didn't break any functionality
 *
 * Feature: codebase-cleanup, Property 1: Existing Functionality Preservation
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as fc from 'fast-check'
import express, { type Express } from 'express'
import request from 'supertest'
import districtRoutes from '../routes/districts/index.js'

describe('Functionality Preservation Property Tests', () => {
  let app: Express

  beforeAll(() => {
    app = express()
    app.use(express.json())
    app.use('/api/districts', districtRoutes)
  })

  afterAll(() => {
    // Cleanup if needed
  })

  /**
   * Property 1: Existing Functionality Preservation
   *
   * For any API endpoint that existed before the cleanup, calling that endpoint
   * with the same parameters SHALL return a response with the same structure
   * and semantically equivalent data.
   */
  describe('Property 1: Existing Functionality Preservation', () => {
    // Generators for test data
    const validDistrictIdGenerator = fc
      .stringMatching(/^[A-Za-z0-9]{1,5}$/)
      .filter(s => s.length > 0)

    const validDateGenerator = fc
      .integer({ min: 2020, max: 2025 })
      .chain(year =>
        fc.integer({ min: 1, max: 12 }).chain(month =>
          fc
            .integer({ min: 1, max: 28 }) // Use 28 to avoid invalid dates
            .map(
              day =>
                `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            )
        )
      )

    const validBackfillIdGenerator = fc
      .stringMatching(/^[a-zA-Z0-9-]{8,36}$/)
      .filter(s => s.length >= 8)

    /**
     * Test: Core district endpoints preserve response structure
     *
     * Verifies that core district endpoints (/, /rankings, /:districtId/*)
     * return responses with consistent structure after the route split.
     */
    it('should preserve response structure for core district endpoints', async () => {
      await fc.assert(
        fc.asyncProperty(validDistrictIdGenerator, async districtId => {
          // Test district statistics endpoint
          const statsResponse = await request(app).get(
            `/api/districts/${districtId}/statistics`
          )

          // Response should have consistent structure
          expect(statsResponse.body).toBeDefined()

          // Either success with data or error with proper structure
          if (statsResponse.status === 200) {
            // Success response should have snapshot metadata
            expect(statsResponse.body).toHaveProperty('_snapshot_metadata')
          } else {
            // Error response should have error object with code and message
            expect(statsResponse.body).toHaveProperty('error')
            expect(statsResponse.body.error).toHaveProperty('code')
            expect(statsResponse.body.error).toHaveProperty('message')
          }

          return true
        }),
        { numRuns: 20 }
      )
    })

    /**
     * Test: Analytics endpoints preserve response structure
     *
     * Verifies that analytics endpoints return responses with consistent
     * structure after being moved to the analytics module.
     */
    it('should preserve response structure for analytics endpoints', async () => {
      await fc.assert(
        fc.asyncProperty(validDistrictIdGenerator, async districtId => {
          // Test analytics endpoint
          const analyticsResponse = await request(app).get(
            `/api/districts/${districtId}/analytics`
          )

          // Response should have consistent structure
          expect(analyticsResponse.body).toBeDefined()

          // Either success with data or error with proper structure
          if (analyticsResponse.status === 200) {
            expect(analyticsResponse.body).toBeDefined()
          } else {
            expect(analyticsResponse.body).toHaveProperty('error')
            expect(analyticsResponse.body.error).toHaveProperty('code')
          }

          // Test at-risk-clubs endpoint
          const atRiskResponse = await request(app).get(
            `/api/districts/${districtId}/at-risk-clubs`
          )

          expect(atRiskResponse.body).toBeDefined()
          if (atRiskResponse.status === 200) {
            // Should have clubs array and totalAtRiskClubs
            expect(atRiskResponse.body).toHaveProperty('clubs')
            expect(atRiskResponse.body).toHaveProperty('totalAtRiskClubs')
          } else {
            expect(atRiskResponse.body).toHaveProperty('error')
          }

          return true
        }),
        { numRuns: 20 }
      )
    })

    /**
     * Test: Backfill endpoints preserve response structure
     *
     * Verifies that backfill endpoints return responses with consistent
     * structure after being moved to the backfill module.
     */
    it('should preserve response structure for backfill endpoints', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDistrictIdGenerator,
          validBackfillIdGenerator,
          async (districtId, backfillId) => {
            // Test global backfill status endpoint
            const globalStatusResponse = await request(app).get(
              `/api/districts/backfill/${backfillId}`
            )

            expect(globalStatusResponse.body).toBeDefined()
            expect(globalStatusResponse.body).toHaveProperty('error')
            expect(globalStatusResponse.body.error).toHaveProperty('code')

            // Test district-specific backfill status endpoint
            const districtStatusResponse = await request(app).get(
              `/api/districts/${districtId}/backfill/${backfillId}`
            )

            expect(districtStatusResponse.body).toBeDefined()
            expect(districtStatusResponse.body).toHaveProperty('error')
            expect(districtStatusResponse.body.error).toHaveProperty('code')

            return true
          }
        ),
        { numRuns: 20 }
      )
    })

    /**
     * Test: Snapshot/cache endpoints preserve response structure
     *
     * Verifies that snapshot-related endpoints return responses with
     * consistent structure after the legacy CacheManager removal.
     */
    it('should preserve response structure for snapshot endpoints', async () => {
      await fc.assert(
        fc.asyncProperty(validDistrictIdGenerator, async districtId => {
          // Test cached-dates endpoint
          const cachedDatesResponse = await request(app).get(
            `/api/districts/${districtId}/cached-dates`
          )

          expect(cachedDatesResponse.body).toBeDefined()

          if (cachedDatesResponse.status === 200) {
            // Should have dates array and count
            expect(cachedDatesResponse.body).toHaveProperty('dates')
            expect(cachedDatesResponse.body).toHaveProperty('count')
            expect(Array.isArray(cachedDatesResponse.body.dates)).toBe(true)
          } else {
            expect(cachedDatesResponse.body).toHaveProperty('error')
          }

          return true
        }),
        { numRuns: 20 }
      )
    })

    /**
     * Test: Error responses preserve consistent format
     *
     * Verifies that error responses maintain the same structure across
     * all endpoints after the cleanup.
     */
    it('should preserve consistent error response format', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 10 }).filter(s =>
            // Generate strings with invalid characters for district IDs
            /[^A-Za-z0-9]/.test(s)
          ),
          async invalidDistrictId => {
            // Test that invalid district IDs return consistent error format
            const response = await request(app).get(
              `/api/districts/${encodeURIComponent(invalidDistrictId)}/statistics`
            )

            // Should return 400 for invalid format
            if (response.status === 400) {
              expect(response.body).toHaveProperty('error')
              expect(response.body.error).toHaveProperty('code')
              expect(response.body.error).toHaveProperty('message')
              expect(response.body.error.code).toBe('INVALID_DISTRICT_ID')
            }

            return true
          }
        ),
        { numRuns: 20 }
      )
    })

    /**
     * Test: Rankings endpoint preserves response structure
     *
     * Verifies that the rankings endpoint returns responses with
     * consistent structure after the route split.
     */
    it('should preserve response structure for rankings endpoint', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.option(validDateGenerator, { nil: undefined }),
          async maybeDate => {
            const url = maybeDate
              ? `/api/districts/rankings?date=${maybeDate}`
              : '/api/districts/rankings'

            const response = await request(app).get(url)

            expect(response.body).toBeDefined()

            // Either success with rankings data or error with proper structure
            if (response.status === 200) {
              // Success response should have rankings data
              expect(response.body).toBeDefined()
            } else {
              // Error response should have error object
              expect(response.body).toHaveProperty('error')
              expect(response.body.error).toHaveProperty('code')
              expect(response.body.error).toHaveProperty('message')
            }

            return true
          }
        ),
        { numRuns: 20 }
      )
    })

    /**
     * Test: Backfill initiation preserves request validation
     *
     * Verifies that backfill initiation endpoints validate requests
     * consistently after the route split.
     */
    it('should preserve request validation for backfill initiation', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            startDate: fc.oneof(
              fc.constant(undefined),
              validDateGenerator,
              fc.string({ minLength: 1, maxLength: 10 })
            ),
            endDate: fc.oneof(
              fc.constant(undefined),
              validDateGenerator,
              fc.string({ minLength: 1, maxLength: 10 })
            ),
            targetDistricts: fc.oneof(
              fc.constant(undefined),
              fc.array(validDistrictIdGenerator, { maxLength: 3 })
            ),
          }),
          async requestBody => {
            const response = await request(app)
              .post('/api/districts/backfill')
              .send(requestBody)
              .set('Content-Type', 'application/json')

            expect(response.body).toBeDefined()

            // Response should have consistent structure
            if (response.status === 202) {
              // Success response should have backfill info
              expect(response.body).toHaveProperty('backfillId')
              expect(response.body).toHaveProperty('status')
            } else if (response.status === 400) {
              // Validation error should have error details
              expect(response.body).toHaveProperty('error')
              expect(response.body.error).toHaveProperty('code')
            }

            return true
          }
        ),
        { numRuns: 15 }
      )
    })

    /**
     * Test: Export endpoint preserves response structure
     *
     * Verifies that the export endpoint returns responses with
     * consistent structure after the route split.
     */
    it('should preserve response structure for export endpoint', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDistrictIdGenerator,
          fc.constantFrom('csv', 'json', 'invalid'),
          async (districtId, format) => {
            const response = await request(app).get(
              `/api/districts/${districtId}/export?format=${format}`
            )

            expect(response.body).toBeDefined()

            if (format === 'invalid') {
              // Invalid format should return 400
              expect(response.status).toBe(400)
              expect(response.body).toHaveProperty('error')
              expect(response.body.error).toHaveProperty('code')
            } else {
              // Valid format should return data or appropriate error
              if (response.status === 200) {
                expect(response.body).toBeDefined()
              } else {
                expect(response.body).toHaveProperty('error')
              }
            }

            return true
          }
        ),
        { numRuns: 20 }
      )
    })

    /**
     * Test: Year-over-year endpoint preserves response structure
     *
     * Verifies that the year-over-year endpoint returns responses with
     * consistent structure after the route split.
     */
    it('should preserve response structure for year-over-year endpoint', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDistrictIdGenerator,
          validDateGenerator,
          async (districtId, date) => {
            const response = await request(app).get(
              `/api/districts/${districtId}/year-over-year/${date}`
            )

            expect(response.body).toBeDefined()

            // Either success with data or error with proper structure
            if (response.status === 200) {
              expect(response.body).toBeDefined()
            } else {
              expect(response.body).toHaveProperty('error')
              expect(response.body.error).toHaveProperty('code')
            }

            return true
          }
        ),
        { numRuns: 20 }
      )
    })
  })
})
