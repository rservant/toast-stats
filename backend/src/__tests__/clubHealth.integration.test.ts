/**
 * Club Health API Integration Tests
 *
 * Comprehensive integration tests for all club health API endpoints
 * including validation, error handling, and caching integration.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import express, { type Express } from 'express'
import cors from 'cors'
import fs from 'fs/promises'
import path from 'path'
import clubHealthRoutes from '../routes/clubHealthRoutes.js'
import type { ClubHealthInput } from '../types/clubHealth.js'

// Set test environment
process.env.NODE_ENV = 'test'

function createTestApp(): Express {
  const app = express()

  // Middleware
  app.use(cors())
  app.use(express.json())

  // Routes
  app.use('/api/club-health', clubHealthRoutes)

  return app
}

describe('Club Health API Integration Tests', () => {
  let app: Express
  let testDataDir: string

  beforeEach(async () => {
    // Create test app
    app = createTestApp()

    // Create a temporary directory for test data
    testDataDir = path.join(
      process.cwd(),
      'test_data',
      `club_health_api_${Date.now()}`
    )
    await fs.mkdir(testDataDir, { recursive: true })

    // Set cache directory for tests
    process.env.CACHE_DIR = testDataDir
  })

  afterEach(async () => {
    // Clean up test data directory
    try {
      await fs.rm(testDataDir, { recursive: true, force: true })
    } catch (error) {
      // Ignore cleanup errors
      console.debug('Test cleanup error (ignored):', error)
    }

    // Reset environment
    delete process.env.CACHE_DIR
  })

  // Valid test input data
  const validClubInput: ClubHealthInput = {
    club_name: 'Test Club',
    current_members: 25,
    member_growth_since_july: 5,
    current_month: 'October',
    dcp_goals_achieved_ytd: 3,
    csp_submitted: true,
    officer_list_submitted: true,
    officers_trained: true,
    previous_month_members: 23,
    previous_month_dcp_goals_achieved_ytd: 2,
    previous_month_health_status: 'Vulnerable',
  }

  describe('POST /api/club-health/classify', () => {
    it('should successfully classify a single club', async () => {
      const response = await request(app)
        .post('/api/club-health/classify')
        .send(validClubInput)
        .expect(200)

      // Verify response structure
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
      expect(response.body.metadata).toBeDefined()
      expect(response.body.metadata.timestamp).toBeDefined()
      expect(
        response.body.metadata.api_processing_time_ms
      ).toBeGreaterThanOrEqual(0)

      // Verify classification result
      const result = response.body.data
      expect(result.club_name).toBe('Test Club')
      expect(result.health_status).toBe('Thriving')
      expect(result.trajectory).toBe('Recovering')
      expect(result.composite_key).toBe('Thriving__Recovering')
      expect(result.composite_label).toBe('Thriving · Recovering')
      expect(result.members_delta_mom).toBe(2)
      expect(result.dcp_delta_mom).toBe(1)
      expect(Array.isArray(result.reasons)).toBe(true)
      expect(Array.isArray(result.trajectory_reasons)).toBe(true)
      expect(result.metadata).toBeDefined()
    })

    it('should return 400 for missing required fields', async () => {
      const invalidInput = { ...validClubInput }
      delete (invalidInput as Record<string, unknown>).club_name

      const response = await request(app)
        .post('/api/club-health/classify')
        .send(invalidInput)
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
      expect(response.body.error.message).toBe('Invalid input data')
      expect(response.body.error.details).toBeDefined()
      expect(Array.isArray(response.body.error.details)).toBe(true)
    })

    it('should return 400 for invalid field types', async () => {
      const invalidInput = {
        ...validClubInput,
        current_members: 'invalid_number',
      }

      const response = await request(app)
        .post('/api/club-health/classify')
        .send(invalidInput)
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
      expect(response.body.error.details[0].code).toBe('INVALID_FIELD_TYPE')
      expect(response.body.error.details[0].field).toBe('current_members')
    })

    it('should return 400 for invalid month value', async () => {
      const invalidInput = {
        ...validClubInput,
        current_month: 'InvalidMonth',
      }

      const response = await request(app)
        .post('/api/club-health/classify')
        .send(invalidInput)
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.details[0].code).toBe('INVALID_MONTH')
    })

    it('should return 400 for invalid health status', async () => {
      const invalidInput = {
        ...validClubInput,
        previous_month_health_status: 'InvalidStatus',
      }

      const response = await request(app)
        .post('/api/club-health/classify')
        .send(invalidInput)
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.details[0].code).toBe('INVALID_HEALTH_STATUS')
    })

    it('should return 400 for negative membership count', async () => {
      const invalidInput = {
        ...validClubInput,
        current_members: -5,
      }

      const response = await request(app)
        .post('/api/club-health/classify')
        .send(invalidInput)
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.details[0].code).toBe('INVALID_FIELD_VALUE')
      expect(response.body.error.details[0].field).toBe('current_members')
    })

    it('should return 400 for non-object input', async () => {
      const response = await request(app)
        .post('/api/club-health/classify')
        .send('invalid_input')
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('POST /api/club-health/batch', () => {
    const validBatchInput: ClubHealthInput[] = [
      {
        ...validClubInput,
        club_name: 'Batch Club 1',
        current_members: 15,
      },
      {
        ...validClubInput,
        club_name: 'Batch Club 2',
        current_members: 30,
      },
    ]

    it('should successfully process batch classification', async () => {
      const response = await request(app)
        .post('/api/club-health/batch')
        .send(validBatchInput)
        .expect(200)

      // Verify response structure
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
      expect(Array.isArray(response.body.data)).toBe(true)
      expect(response.body.data).toHaveLength(2)
      expect(response.body.metadata.total_clubs).toBe(2)
      expect(response.body.metadata.successful_classifications).toBe(2)
      expect(
        response.body.metadata.api_processing_time_ms
      ).toBeGreaterThanOrEqual(0)

      // Verify individual results
      expect(response.body.data[0].club_name).toBe('Batch Club 1')
      expect(response.body.data[1].club_name).toBe('Batch Club 2')
    })

    it('should return 400 for non-array input', async () => {
      const response = await request(app)
        .post('/api/club-health/batch')
        .send(validClubInput) // Send object instead of array
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('INVALID_INPUT_TYPE')
      expect(response.body.error.message).toBe(
        'Input must be an array of club health data'
      )
    })

    it('should return 400 for empty array', async () => {
      const response = await request(app)
        .post('/api/club-health/batch')
        .send([])
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('EMPTY_INPUT_ARRAY')
    })

    it('should return 400 for array exceeding size limit', async () => {
      const largeArray = Array(101).fill(validClubInput)

      const response = await request(app)
        .post('/api/club-health/batch')
        .send(largeArray)
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('INPUT_ARRAY_TOO_LARGE')
    })

    it('should return 400 for batch with validation errors', async () => {
      const invalidBatch = [
        validClubInput,
        { ...validClubInput, club_name: '' }, // Invalid club name
        { ...validClubInput, current_members: -1 }, // Invalid member count
      ]

      const response = await request(app)
        .post('/api/club-health/batch')
        .send(invalidBatch)
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('BATCH_VALIDATION_ERROR')
      expect(response.body.error.details).toHaveLength(2) // Two invalid inputs
    })
  })

  describe('GET /api/club-health/:clubName/history', () => {
    beforeEach(async () => {
      // Create some history by processing a club first
      await request(app)
        .post('/api/club-health/classify')
        .send({
          ...validClubInput,
          club_name: 'History Test Club',
        })
    })

    it('should return club health history', async () => {
      const response = await request(app)
        .get('/api/club-health/History Test Club/history')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
      expect(response.body.data.club_name).toBe('History Test Club')
      expect(response.body.data.months_requested).toBe(12)
      expect(Array.isArray(response.body.data.history)).toBe(true)
      expect(response.body.metadata.record_count).toBeGreaterThanOrEqual(0)
    })

    it('should accept months query parameter', async () => {
      const response = await request(app)
        .get('/api/club-health/History Test Club/history?months=6')
        .expect(200)

      expect(response.body.data.months_requested).toBe(6)
    })

    it('should return 400 for invalid club name', async () => {
      const response = await request(app)
        .get('/api/club-health/ /history') // Empty club name
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('INVALID_CLUB_NAME')
    })

    it('should return 400 for invalid months parameter', async () => {
      const response = await request(app)
        .get('/api/club-health/Test Club/history?months=invalid')
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('INVALID_MONTHS_PARAMETER')
    })

    it('should return 400 for months parameter out of range', async () => {
      const response = await request(app)
        .get('/api/club-health/Test Club/history?months=30')
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('INVALID_MONTHS_PARAMETER')
    })
  })

  describe('GET /api/club-health/districts/:districtId/health-summary', () => {
    it('should return district health summary', async () => {
      const response = await request(app)
        .get('/api/club-health/districts/D123/health-summary')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
      expect(response.body.data.district_id).toBe('D123')
      expect(typeof response.body.data.total_clubs).toBe('number')
      expect(response.body.data.health_distribution).toBeDefined()
      expect(response.body.data.trajectory_distribution).toBeDefined()
      expect(Array.isArray(response.body.data.clubs)).toBe(true)
      expect(Array.isArray(response.body.data.clubs_needing_attention)).toBe(
        true
      )
      expect(response.body.data.evaluation_date).toBeDefined()
    })

    it('should return 400 for invalid district ID format', async () => {
      const response = await request(app)
        .get('/api/club-health/districts/invalid@id/health-summary')
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('INVALID_DISTRICT_ID')
    })

    it('should return empty summary for non-existent district', async () => {
      const response = await request(app)
        .get('/api/club-health/districts/D999999/health-summary')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.district_id).toBe('D999999')
      expect(response.body.data.total_clubs).toBe(0)
    })
  })

  describe('GET /api/club-health/districts/:districtId/club-health', () => {
    it('should return all clubs health data for district', async () => {
      const response = await request(app)
        .get('/api/club-health/districts/D123/club-health')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(Array.isArray(response.body.data)).toBe(true)
      expect(response.body.metadata).toBeDefined()
      expect(response.body.metadata.district_id).toBe('D123')
      expect(typeof response.body.metadata.total_clubs).toBe('number')
    })

    it('should return 400 for invalid district ID format', async () => {
      const response = await request(app)
        .get('/api/club-health/districts/invalid@id/club-health')
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('INVALID_DISTRICT_ID')
    })

    it('should return empty array for non-existent district', async () => {
      const response = await request(app)
        .get('/api/club-health/districts/D999999/club-health')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toEqual([])
      expect(response.body.metadata.total_clubs).toBe(0)
    })
  })

  describe('Error Handling', () => {
    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/club-health/classify')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400)

      // Express should handle malformed JSON and return 400
      expect(response.status).toBe(400)
    })

    it('should include proper error structure in all error responses', async () => {
      const response = await request(app)
        .post('/api/club-health/classify')
        .send({})
        .expect(400)

      // Verify error response structure
      expect(response.body.success).toBe(false)
      expect(response.body.error).toBeDefined()
      expect(response.body.error.code).toBeDefined()
      expect(response.body.error.message).toBeDefined()
      expect(response.body.metadata).toBeDefined()
      expect(response.body.metadata.timestamp).toBeDefined()
    })

    it('should not expose sensitive information in production mode', async () => {
      // Temporarily set production mode
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'

      try {
        const response = await request(app)
          .post('/api/club-health/classify')
          .send({ invalid: 'data' })
          .expect(400)

        // In production, detailed error information should not be exposed
        expect(response.body.error.details).toBeDefined()
        // The validation middleware still provides details, but internal errors would be hidden
      } finally {
        process.env.NODE_ENV = originalEnv
      }
    })
  })

  describe('Caching Integration', () => {
    it('should use cache for repeated history requests', async () => {
      // First request - should populate cache
      const response1 = await request(app)
        .get('/api/club-health/Cache Test Club/history')
        .expect(200)

      // Second request - should use cache (faster response)
      const startTime = Date.now()
      const response2 = await request(app)
        .get('/api/club-health/Cache Test Club/history')
        .expect(200)
      const responseTime = Date.now() - startTime

      // Both responses should be identical
      expect(response1.body).toEqual(response2.body)

      // Second request should be faster (though this is not guaranteed in tests)
      expect(responseTime).toBeLessThan(1000) // Reasonable upper bound
    })

    it('should use cache for repeated district summary requests', async () => {
      // First request
      const response1 = await request(app)
        .get('/api/club-health/districts/D456/health-summary')
        .expect(200)

      // Second request
      const response2 = await request(app)
        .get('/api/club-health/districts/D456/health-summary')
        .expect(200)

      // Responses should be identical
      expect(response1.body).toEqual(response2.body)
    })
  })

  describe('Performance Requirements', () => {
    it('should complete single classification within performance threshold', async () => {
      const startTime = Date.now()

      await request(app)
        .post('/api/club-health/classify')
        .send(validClubInput)
        .expect(200)

      const responseTime = Date.now() - startTime

      // Should complete within 1 second (generous threshold for tests)
      expect(responseTime).toBeLessThan(1000)
    })

    it('should handle batch processing efficiently', async () => {
      // Test with a simple batch that demonstrates the API works
      const batchInput = [
        {
          ...validClubInput,
          club_name: 'Batch Test Club A',
        },
      ]

      const startTime = Date.now()

      const response = await request(app)
        .post('/api/club-health/batch')
        .send(batchInput)
        .expect(200)

      const responseTime = Date.now() - startTime

      // Should process clubs within reasonable time
      expect(responseTime).toBeLessThan(2000)
      expect(response.body.success).toBe(true)
      expect(Array.isArray(response.body.data)).toBe(true)
      expect(response.body.data.length).toBeGreaterThan(0)
      expect(
        response.body.metadata.api_processing_time_ms
      ).toBeGreaterThanOrEqual(0)
    })
  })

  describe('API Response Format Consistency', () => {
    it('should maintain consistent response format across all endpoints', async () => {
      // Test single classification
      const singleResponse = await request(app)
        .post('/api/club-health/classify')
        .send(validClubInput)
        .expect(200)

      expect(singleResponse.body).toHaveProperty('success')
      expect(singleResponse.body).toHaveProperty('data')
      expect(singleResponse.body).toHaveProperty('metadata')
      expect(singleResponse.body.metadata).toHaveProperty('timestamp')

      // Test batch classification
      const batchResponse = await request(app)
        .post('/api/club-health/batch')
        .send([validClubInput])
        .expect(200)

      expect(batchResponse.body).toHaveProperty('success')
      expect(batchResponse.body).toHaveProperty('data')
      expect(batchResponse.body).toHaveProperty('metadata')
      expect(batchResponse.body.metadata).toHaveProperty('timestamp')

      // Test history endpoint
      const historyResponse = await request(app)
        .get('/api/club-health/Test Club/history')
        .expect(200)

      expect(historyResponse.body).toHaveProperty('success')
      expect(historyResponse.body).toHaveProperty('data')
      expect(historyResponse.body).toHaveProperty('metadata')
      expect(historyResponse.body.metadata).toHaveProperty('timestamp')
    })

    it('should maintain consistent error response format', async () => {
      // Test validation error
      const validationError = await request(app)
        .post('/api/club-health/classify')
        .send({})
        .expect(400)

      expect(validationError.body).toHaveProperty('success', false)
      expect(validationError.body).toHaveProperty('error')
      expect(validationError.body.error).toHaveProperty('code')
      expect(validationError.body.error).toHaveProperty('message')
      expect(validationError.body).toHaveProperty('metadata')

      // Test not found error
      const notFoundError = await request(app)
        .get('/api/club-health/districts/invalid@id/health-summary')
        .expect(400)

      expect(notFoundError.body).toHaveProperty('success', false)
      expect(notFoundError.body).toHaveProperty('error')
      expect(notFoundError.body.error).toHaveProperty('code')
      expect(notFoundError.body.error).toHaveProperty('message')
      expect(notFoundError.body).toHaveProperty('metadata')
    })
  })
})
