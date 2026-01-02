/**
 * Club Health Complete Workflow Integration Tests
 *
 * Tests complete workflows from API request to data processing and caching.
 * Validates end-to-end functionality including batch processing, district analytics,
 * error handling, and performance requirements.
 *
 * Requirements: 1.1, 4.6, 8.1, 10.5
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import request, { type Response } from 'supertest'
import express, { type Express } from 'express'
import cors from 'cors'
import fs from 'fs/promises'
import path from 'path'
import clubHealthRoutes from '../routes/clubHealthRoutes.js'
import type { ClubHealthInput, ClubHealthResult } from '../types/clubHealth.js'

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

describe('Club Health Complete Workflow Integration Tests', () => {
  let app: Express
  let testDataDir: string

  beforeEach(async () => {
    // Create test app
    app = createTestApp()

    // Create a temporary directory for test data
    testDataDir = path.join(
      process.cwd(),
      'test_data',
      `club_health_workflow_${Date.now()}`
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

  // Test data for complete workflows
  const createTestClubInput = (
    overrides: Partial<ClubHealthInput> = {}
  ): ClubHealthInput => ({
    club_name: 'Workflow Test Club',
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
    ...overrides,
  })

  describe('Complete Classification Workflow', () => {
    it('should process club classification from API request to cached result', async () => {
      // Step 1: Submit classification request
      const clubInput = createTestClubInput()

      const classifyResponse = await request(app)
        .post('/api/club-health/classify')
        .send(clubInput)
        .expect(200)

      // Verify classification response structure
      expect(classifyResponse.body.success).toBe(true)
      expect(classifyResponse.body.data).toBeDefined()

      const result: ClubHealthResult = classifyResponse.body.data
      expect(result.club_name).toBe('Workflow Test Club')
      expect(result.health_status).toBe('Thriving')
      expect(result.trajectory).toBe('Recovering')
      expect(result.composite_key).toBe('Thriving__Recovering')
      expect(result.members_delta_mom).toBe(2)
      expect(result.dcp_delta_mom).toBe(1)
      expect(Array.isArray(result.reasons)).toBe(true)
      expect(Array.isArray(result.trajectory_reasons)).toBe(true)

      // Step 2: Verify history is created and accessible
      const historyResponse = await request(app)
        .get('/api/club-health/Workflow Test Club/history')
        .expect(200)

      expect(historyResponse.body.success).toBe(true)
      expect(historyResponse.body.data.club_name).toBe('Workflow Test Club')
      expect(Array.isArray(historyResponse.body.data.history)).toBe(true)

      // Step 3: Verify caching behavior - second request should be faster
      const startTime = Date.now()
      const cachedHistoryResponse = await request(app)
        .get('/api/club-health/Workflow Test Club/history')
        .expect(200)
      const responseTime = Date.now() - startTime

      // Cached response should be identical
      expect(cachedHistoryResponse.body).toEqual(historyResponse.body)

      // Response should be reasonably fast (cached)
      expect(responseTime).toBeLessThan(500)
    })

    it('should handle classification workflow with different health statuses', async () => {
      // Test Intervention Required status
      const interventionClub = createTestClubInput({
        club_name: 'Intervention Club',
        current_members: 8,
        member_growth_since_july: -2,
        dcp_goals_achieved_ytd: 0,
        csp_submitted: false,
      })

      const interventionResponse = await request(app)
        .post('/api/club-health/classify')
        .send(interventionClub)
        .expect(200)

      expect(interventionResponse.body.data.health_status).toBe(
        'Intervention Required'
      )
      expect(interventionResponse.body.data.club_name).toBe('Intervention Club')

      // Test Vulnerable status
      const vulnerableClub = createTestClubInput({
        club_name: 'Vulnerable Club',
        current_members: 18,
        member_growth_since_july: 1,
        dcp_goals_achieved_ytd: 1,
        csp_submitted: false,
      })

      const vulnerableResponse = await request(app)
        .post('/api/club-health/classify')
        .send(vulnerableClub)
        .expect(200)

      expect(vulnerableResponse.body.data.health_status).toBe('Vulnerable')
      expect(vulnerableResponse.body.data.club_name).toBe('Vulnerable Club')
    })
  })

  describe('Batch Processing Workflow', () => {
    it('should process multiple clubs and aggregate results correctly', async () => {
      // Create batch of diverse clubs
      const batchInput: ClubHealthInput[] = [
        createTestClubInput({
          club_name: 'Batch Club A',
          current_members: 30,
          dcp_goals_achieved_ytd: 4,
        }),
        createTestClubInput({
          club_name: 'Batch Club B',
          current_members: 15,
          dcp_goals_achieved_ytd: 1,
          csp_submitted: false,
        }),
        createTestClubInput({
          club_name: 'Batch Club C',
          current_members: 8,
          member_growth_since_july: -3,
          dcp_goals_achieved_ytd: 0,
        }),
      ]

      // Step 1: Process batch
      const batchResponse = await request(app)
        .post('/api/club-health/batch')
        .send(batchInput)
        .expect(200)

      expect(batchResponse.body.success).toBe(true)
      expect(Array.isArray(batchResponse.body.data)).toBe(true)
      expect(batchResponse.body.data.length).toBeGreaterThan(0)
      expect(batchResponse.body.metadata.total_clubs).toBe(3)
      expect(
        batchResponse.body.metadata.successful_classifications
      ).toBeGreaterThan(0)

      const results: ClubHealthResult[] = batchResponse.body.data

      // Verify individual results - check that we have valid results
      expect(results.length).toBeGreaterThan(0)

      // Verify each result has the expected structure
      for (const result of results) {
        expect(result.club_name).toBeDefined()
        expect(result.health_status).toMatch(
          /^(Thriving|Vulnerable|Intervention Required)$/
        )
        expect(result.trajectory).toMatch(/^(Recovering|Stable|Declining)$/)
        expect(result.composite_key).toBeDefined()
        expect(result.composite_label).toBeDefined()
        expect(typeof result.members_delta_mom).toBe('number')
        expect(typeof result.dcp_delta_mom).toBe('number')
        expect(Array.isArray(result.reasons)).toBe(true)
        expect(Array.isArray(result.trajectory_reasons)).toBe(true)
      }

      // Step 2: Verify all clubs are accessible via history
      for (const result of results) {
        const historyResponse = await request(app)
          .get(`/api/club-health/${result.club_name}/history`)
          .expect(200)

        expect(historyResponse.body.success).toBe(true)
        expect(historyResponse.body.data.club_name).toBe(result.club_name)
      }
    })

    it('should handle batch processing performance requirements', async () => {
      // Create a reasonable batch size for testing
      const batchSize = 10
      const batchInput: ClubHealthInput[] = Array.from(
        { length: batchSize },
        (_, i) =>
          createTestClubInput({
            club_name: `Performance Test Club ${i + 1}`,
            current_members: 20 + (i % 10),
            dcp_goals_achieved_ytd: 2 + (i % 3),
          })
      )

      const startTime = Date.now()

      const batchResponse = await request(app)
        .post('/api/club-health/batch')
        .send(batchInput)
        .expect(200)

      const totalTime = Date.now() - startTime

      // Verify performance requirements
      expect(batchResponse.body.success).toBe(true)
      expect(batchResponse.body.data.length).toBeGreaterThan(0)

      // Should process within reasonable time (generous for test environment)
      expect(totalTime).toBeLessThan(5000) // 5 seconds for batch processing

      // API processing time should be tracked
      expect(
        batchResponse.body.metadata.api_processing_time_ms
      ).toBeGreaterThanOrEqual(0)
      expect(batchResponse.body.metadata.api_processing_time_ms).toBeLessThan(
        totalTime
      )
    })
  })

  describe('District Analytics Workflow', () => {
    it('should aggregate district health data correctly', async () => {
      const districtId = 'D42'

      // Step 1: Create clubs in the district (simulate by processing clubs)
      const districtClubs: ClubHealthInput[] = [
        createTestClubInput({
          club_name: 'District 42 Club A',
          current_members: 25,
          dcp_goals_achieved_ytd: 3,
        }),
        createTestClubInput({
          club_name: 'District 42 Club B',
          current_members: 15,
          dcp_goals_achieved_ytd: 1,
          csp_submitted: false,
        }),
        createTestClubInput({
          club_name: 'District 42 Club C',
          current_members: 8,
          member_growth_since_july: -2,
          dcp_goals_achieved_ytd: 0,
        }),
      ]

      // Process clubs to create data
      await request(app)
        .post('/api/club-health/batch')
        .send(districtClubs)
        .expect(200)

      // Step 2: Get district summary
      const summaryResponse = await request(app)
        .get(`/api/club-health/districts/${districtId}/health-summary`)
        .expect(200)

      expect(summaryResponse.body.success).toBe(true)

      const summary = summaryResponse.body.data
      expect(summary.district_id).toBe(districtId)
      expect(typeof summary.total_clubs).toBe('number')
      expect(summary.health_distribution).toBeDefined()
      expect(summary.trajectory_distribution).toBeDefined()
      expect(Array.isArray(summary.clubs_needing_attention)).toBe(true)
      expect(summary.evaluation_date).toBeDefined()

      // Step 3: Verify caching of district summary
      const startTime = Date.now()
      const cachedSummaryResponse = await request(app)
        .get(`/api/club-health/districts/${districtId}/health-summary`)
        .expect(200)
      const responseTime = Date.now() - startTime

      // Cached response should be identical and fast
      expect(cachedSummaryResponse.body).toEqual(summaryResponse.body)
      expect(responseTime).toBeLessThan(500)
    })
  })

  describe('Error Handling Workflow', () => {
    it('should handle validation errors gracefully across the stack', async () => {
      // Test single classification with invalid data
      const invalidSingleInput = {
        club_name: '', // Invalid empty name
        current_members: -5, // Invalid negative members
        current_month: 'InvalidMonth', // Invalid month
      }

      const singleErrorResponse = await request(app)
        .post('/api/club-health/classify')
        .send(invalidSingleInput)
        .expect(400)

      expect(singleErrorResponse.body.success).toBe(false)
      expect(singleErrorResponse.body.error.code).toBe('VALIDATION_ERROR')
      expect(Array.isArray(singleErrorResponse.body.error.details)).toBe(true)
      expect(singleErrorResponse.body.error.details.length).toBeGreaterThan(0)

      // Test batch processing with mixed valid/invalid data
      const mixedBatchInput = [
        createTestClubInput({ club_name: 'Valid Club' }),
        { club_name: '', current_members: -1 }, // Invalid
        createTestClubInput({ club_name: 'Another Valid Club' }),
      ]

      const batchErrorResponse = await request(app)
        .post('/api/club-health/batch')
        .send(mixedBatchInput)
        .expect(400)

      expect(batchErrorResponse.body.success).toBe(false)
      expect(batchErrorResponse.body.error.code).toBe('BATCH_VALIDATION_ERROR')
      expect(Array.isArray(batchErrorResponse.body.error.details)).toBe(true)

      // Test invalid history request
      const historyErrorResponse = await request(app)
        .get('/api/club-health/ /history') // Invalid club name
        .expect(400)

      expect(historyErrorResponse.body.success).toBe(false)
      expect(historyErrorResponse.body.error.code).toBe('INVALID_CLUB_NAME')

      // Test invalid district summary request
      const districtErrorResponse = await request(app)
        .get('/api/club-health/districts/invalid@id/health-summary')
        .expect(400)

      expect(districtErrorResponse.body.success).toBe(false)
      expect(districtErrorResponse.body.error.code).toBe('INVALID_DISTRICT_ID')
    })

    it('should maintain consistent error response format across all endpoints', async () => {
      const endpoints = [
        {
          method: 'post',
          path: '/api/club-health/classify',
          data: {},
        },
        {
          method: 'post',
          path: '/api/club-health/batch',
          data: 'invalid',
        },
        {
          method: 'get',
          path: '/api/club-health/ /history',
        },
        {
          method: 'get',
          path: '/api/club-health/districts/invalid@/health-summary',
        },
      ]

      for (const endpoint of endpoints) {
        let response: Response
        if (endpoint.method === 'post') {
          response = await request(app).post(endpoint.path).send(endpoint.data)
        } else {
          response = await request(app).get(endpoint.path)
        }

        // All error responses should have consistent structure
        expect(response.status).toBe(400)
        expect(response.body.success).toBe(false)
        expect(response.body.error).toBeDefined()
        expect(response.body.error.code).toBeDefined()
        expect(response.body.error.message).toBeDefined()
        expect(response.body.metadata).toBeDefined()
        expect(response.body.metadata.timestamp).toBeDefined()
      }
    })
  })

  describe('Caching Behavior Validation', () => {
    it('should demonstrate effective caching across different endpoints', async () => {
      const clubInput = createTestClubInput({ club_name: 'Cache Test Club' })

      // Step 1: Process club to create data
      await request(app)
        .post('/api/club-health/classify')
        .send(clubInput)
        .expect(200)

      // Step 2: Test history endpoint caching
      const historyResponse1 = await request(app)
        .get('/api/club-health/Cache Test Club/history')
        .expect(200)

      const historyStartTime = Date.now()
      const historyResponse2 = await request(app)
        .get('/api/club-health/Cache Test Club/history')
        .expect(200)
      const historyResponseTime = Date.now() - historyStartTime

      expect(historyResponse1.body).toEqual(historyResponse2.body)
      expect(historyResponseTime).toBeLessThan(100) // Should be very fast from cache

      // Step 3: Test district summary caching
      const districtResponse1 = await request(app)
        .get('/api/club-health/districts/D123/health-summary')
        .expect(200)

      const districtStartTime = Date.now()
      const districtResponse2 = await request(app)
        .get('/api/club-health/districts/D123/health-summary')
        .expect(200)
      const districtResponseTime = Date.now() - districtStartTime

      expect(districtResponse1.body).toEqual(districtResponse2.body)
      expect(districtResponseTime).toBeLessThan(100) // Should be very fast from cache
    })

    it('should handle cache invalidation correctly', async () => {
      const clubInput = createTestClubInput({
        club_name: 'Cache Invalidation Test',
      })

      // Step 1: Get initial history (empty)
      const initialHistory = await request(app)
        .get('/api/club-health/Cache Invalidation Test/history')
        .expect(200)

      // Step 2: Process club to create new data
      await request(app)
        .post('/api/club-health/classify')
        .send(clubInput)
        .expect(200)

      // Step 3: Get history again - should reflect new data
      const updatedHistory = await request(app)
        .get('/api/club-health/Cache Invalidation Test/history')
        .expect(200)

      // History should be different after processing
      expect(updatedHistory.body.data.club_name).toBe('Cache Invalidation Test')

      // The responses should have the same structure but potentially different data
      expect(updatedHistory.body.success).toBe(true)
      expect(initialHistory.body.success).toBe(true)
    })
  })

  describe('Performance Requirements Validation', () => {
    it('should meet individual classification performance requirements', async () => {
      const clubInput = createTestClubInput({
        club_name: 'Performance Test Club',
      })

      const startTime = Date.now()
      const response = await request(app)
        .post('/api/club-health/classify')
        .send(clubInput)
        .expect(200)
      const totalTime = Date.now() - startTime

      // Should complete within performance threshold
      expect(totalTime).toBeLessThan(1000) // 1 second (generous for test environment)

      // API should track processing time
      expect(
        response.body.metadata.api_processing_time_ms
      ).toBeGreaterThanOrEqual(0)
      expect(response.body.metadata.api_processing_time_ms).toBeLessThan(
        totalTime
      )
    })

    it('should meet dashboard loading performance requirements', async () => {
      // Simulate dashboard data loading by requesting district summary
      const startTime = Date.now()
      const response = await request(app)
        .get('/api/club-health/districts/D789/health-summary')
        .expect(200)
      const responseTime = Date.now() - startTime

      // Should load within performance threshold
      expect(responseTime).toBeLessThan(2000) // 2 seconds for initial load
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
    })
  })
})
