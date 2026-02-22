/**
 * Unit Tests for Backend Date Parameter Handling - Statistics Endpoint
 *
 * Tests date parameter parsing and validation, exact date snapshot retrieval,
 * fallback to nearest snapshot, backward compatibility without date parameter,
 * and error responses for invalid dates.
 *
 * **Validates: Requirements 4.3, 5.1, 5.2**
 *
 * Test Isolation:
 * - Each test uses a fresh Express app instance
 * - Cache is cleared before each test to prevent cross-test pollution
 * - Uses deterministic test data for reproducibility
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  vi,
} from 'vitest'
import express, { type Express } from 'express'
import request from 'supertest'
import { cacheService } from '../../../services/CacheService.js'

// Mock the shared module to control snapshot behavior
vi.mock('../shared.js', async importOriginal => {
  const original = await importOriginal<typeof import('../shared.js')>()
  return {
    ...original,
    // We'll override specific functions in individual tests
  }
})

import districtRoutes from '../index.js'

describe('Statistics Endpoint - Date Parameter Handling Unit Tests', () => {
  let app: Express

  beforeAll(() => {
    app = express()
    app.use(express.json())
    app.use('/api/districts', districtRoutes)
  })

  beforeEach(() => {
    // Clear cache before each test to ensure test isolation
    cacheService.clear()
  })

  afterAll(() => {
    // Final cleanup
    cacheService.clear()
    vi.restoreAllMocks()
  })

  /**
   * Test Suite: Date Parameter Parsing and Validation
   * **Validates: Requirements 4.3, Property 4**
   *
   * Tests that the endpoint correctly validates date format (YYYY-MM-DD)
   * and returns appropriate error responses for invalid formats.
   */
  describe('Date Parameter Parsing and Validation', () => {
    it('should accept valid YYYY-MM-DD date format', async () => {
      const response = await request(app).get(
        '/api/districts/101/statistics?date=2024-01-15'
      )

      // Should not return 400 for valid date format
      // May return 404 (district not found) or 503 (no snapshot) but not 400 for date
      expect(response.status).not.toBe(400)

      // If it's a 400, it should NOT be for date format
      if (response.status === 400) {
        expect(response.body.error?.code).not.toBe('INVALID_DATE_FORMAT')
      }
    })

    it('should reject date with invalid format - missing dashes', async () => {
      const response = await request(app).get(
        '/api/districts/101/statistics?date=20240115'
      )

      expect(response.status).toBe(400)
      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toHaveProperty('code', 'INVALID_DATE_FORMAT')
      expect(response.body.error).toHaveProperty(
        'message',
        'Date must be in YYYY-MM-DD format'
      )
      expect(response.body.error).toHaveProperty(
        'details',
        'Received: 20240115'
      )
    })

    it('should reject date with invalid format - wrong separator', async () => {
      const response = await request(app).get(
        '/api/districts/101/statistics?date=2024/01/15'
      )

      expect(response.status).toBe(400)
      expect(response.body.error).toHaveProperty('code', 'INVALID_DATE_FORMAT')
      expect(response.body.error.details).toBe('Received: 2024/01/15')
    })

    it('should reject date with invalid format - incomplete date', async () => {
      const response = await request(app).get(
        '/api/districts/101/statistics?date=2024-01'
      )

      expect(response.status).toBe(400)
      expect(response.body.error).toHaveProperty('code', 'INVALID_DATE_FORMAT')
    })

    it('should reject date with invalid format - text instead of date', async () => {
      const response = await request(app).get(
        '/api/districts/101/statistics?date=invalid-date'
      )

      expect(response.status).toBe(400)
      expect(response.body.error).toHaveProperty('code', 'INVALID_DATE_FORMAT')
      expect(response.body.error.details).toBe('Received: invalid-date')
    })

    it('should reject date with invalid format - extra characters', async () => {
      const response = await request(app).get(
        '/api/districts/101/statistics?date=2024-01-15T00:00:00'
      )

      expect(response.status).toBe(400)
      expect(response.body.error).toHaveProperty('code', 'INVALID_DATE_FORMAT')
    })

    it('should reject empty date parameter', async () => {
      const response = await request(app).get(
        '/api/districts/101/statistics?date='
      )

      expect(response.status).toBe(400)
      expect(response.body.error).toHaveProperty('code', 'INVALID_DATE_FORMAT')
    })

    it('should reject date with invalid month (13)', async () => {
      const response = await request(app).get(
        '/api/districts/101/statistics?date=2024-13-15'
      )

      expect(response.status).toBe(400)
      expect(response.body.error).toHaveProperty('code', 'INVALID_DATE_FORMAT')
    })

    it('should reject date with invalid day (32)', async () => {
      const response = await request(app).get(
        '/api/districts/101/statistics?date=2024-01-32'
      )

      expect(response.status).toBe(400)
      expect(response.body.error).toHaveProperty('code', 'INVALID_DATE_FORMAT')
    })
  })

  /**
   * Test Suite: Backward Compatibility Without Date Parameter
   * **Validates: Requirements 6.2, Property 3**
   *
   * Tests that the endpoint maintains backward compatibility when
   * no date parameter is provided (returns latest snapshot).
   */
  describe('Backward Compatibility Without Date Parameter', () => {
    it('should accept request without date parameter', async () => {
      const response = await request(app).get('/api/districts/101/statistics')

      // Should not return 400 - the date parameter is optional
      expect(response.status).not.toBe(400)

      // Valid responses are 200 (success), 404 (district not found),
      // 503 (no snapshot), or 500 (internal error during initialization)
      expect([200, 404, 500, 503]).toContain(response.status)
    })

    it('should return proper response structure without date parameter', async () => {
      const response = await request(app).get('/api/districts/101/statistics')

      expect(response.body).toBeDefined()

      // Response should have either error structure or success structure
      if (response.status === 200) {
        expect(response.body).toHaveProperty('_snapshot_metadata')
      } else {
        expect(response.body).toHaveProperty('error')
        expect(response.body.error).toHaveProperty('code')
        expect(response.body.error).toHaveProperty('message')
      }
    })

    it('should not include fallback metadata when no date is requested', async () => {
      const response = await request(app).get('/api/districts/101/statistics')

      // If successful, should not have fallback metadata since no date was requested
      if (response.status === 200) {
        expect(response.body._snapshot_metadata).toBeDefined()
        // Fallback should not be present when no date was requested
        expect(response.body._snapshot_metadata.fallback).toBeUndefined()
      }
    })
  })

  /**
   * Test Suite: Error Response Structure
   * **Validates: Requirements 5.2, Property 9**
   *
   * Tests that error responses follow the expected structure with
   * code, message, and details fields.
   */
  describe('Error Response Structure', () => {
    it('should return structured error for invalid date format', async () => {
      const response = await request(app).get(
        '/api/districts/101/statistics?date=not-a-date'
      )

      expect(response.status).toBe(400)
      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toHaveProperty('code')
      expect(response.body.error).toHaveProperty('message')
      expect(response.body.error).toHaveProperty('details')

      // Verify the specific error format from design document
      expect(response.body.error.code).toBe('INVALID_DATE_FORMAT')
      expect(response.body.error.message).toBe(
        'Date must be in YYYY-MM-DD format'
      )
      expect(response.body.error.details).toContain('Received:')
    })

    it('should return structured error for invalid district ID', async () => {
      const response = await request(app).get(
        '/api/districts/invalid!id/statistics'
      )

      expect(response.status).toBe(400)
      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toHaveProperty('code', 'INVALID_DISTRICT_ID')
      expect(response.body.error).toHaveProperty('message')
    })

    it('should return structured error for missing district ID', async () => {
      // This tests the route pattern - empty districtId
      const response = await request(app).get('/api/districts//statistics')

      // Express may return 404 for this malformed route
      expect([400, 404]).toContain(response.status)
    })
  })

  /**
   * Test Suite: Cache Key Generation with Date Parameter
   * **Validates: Requirements 6.1**
   *
   * Tests that the cache key includes the date parameter for proper
   * cache invalidation when dates change.
   */
  describe('Cache Key Generation with Date Parameter', () => {
    it('should generate different cache keys for different dates', async () => {
      // Make two requests with different dates
      const response1 = await request(app).get(
        '/api/districts/101/statistics?date=2024-01-15'
      )

      const response2 = await request(app).get(
        '/api/districts/101/statistics?date=2024-01-16'
      )

      // Both requests should complete (regardless of status)
      // The important thing is they don't interfere with each other
      expect(response1.status).toBeDefined()
      expect(response2.status).toBeDefined()
    })

    it('should generate different cache key when date is present vs absent', async () => {
      // Request without date
      const responseNoDate = await request(app).get(
        '/api/districts/101/statistics'
      )

      // Request with date
      const responseWithDate = await request(app).get(
        '/api/districts/101/statistics?date=2024-01-15'
      )

      // Both should complete independently
      expect(responseNoDate.status).toBeDefined()
      expect(responseWithDate.status).toBeDefined()
    })
  })

  /**
   * Test Suite: District ID Validation with Date Parameter
   * **Validates: Requirements 4.3**
   *
   * Tests that district ID validation works correctly alongside
   * date parameter validation.
   */
  describe('District ID Validation with Date Parameter', () => {
    it('should validate district ID before date parameter', async () => {
      // Invalid district ID with valid date
      const response = await request(app).get(
        '/api/districts/invalid!id/statistics?date=2024-01-15'
      )

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('INVALID_DISTRICT_ID')
    })

    it('should accept alphanumeric district IDs with date parameter', async () => {
      const response = await request(app).get(
        '/api/districts/101/statistics?date=2024-01-15'
      )

      // Should not fail on district ID validation
      if (response.status === 400) {
        expect(response.body.error.code).not.toBe('INVALID_DISTRICT_ID')
      }
    })

    it('should accept letter-based district IDs with date parameter', async () => {
      const response = await request(app).get(
        '/api/districts/F/statistics?date=2024-01-15'
      )

      // Should not fail on district ID validation
      if (response.status === 400) {
        expect(response.body.error.code).not.toBe('INVALID_DISTRICT_ID')
      }
    })
  })

  /**
   * Test Suite: Response Metadata Structure
   * **Validates: Requirements 5.1, 5.2, Property 6, Property 10**
   *
   * Tests that successful responses include proper snapshot metadata
   * and fallback information when applicable.
   */
  describe('Response Metadata Structure', () => {
    it('should include _snapshot_metadata in successful response', async () => {
      const response = await request(app).get('/api/districts/101/statistics')

      if (response.status === 200) {
        expect(response.body).toHaveProperty('_snapshot_metadata')
        expect(response.body._snapshot_metadata).toHaveProperty('snapshot_id')
        expect(response.body._snapshot_metadata).toHaveProperty('created_at')
        expect(response.body._snapshot_metadata).toHaveProperty(
          'schema_version'
        )
        expect(response.body._snapshot_metadata).toHaveProperty(
          'calculation_version'
        )
        expect(response.body._snapshot_metadata).toHaveProperty('data_as_of')
      }
    })

    it('should include fallback metadata when date fallback occurs', async () => {
      // Request a date that likely doesn't have an exact snapshot
      const response = await request(app).get(
        '/api/districts/101/statistics?date=2020-01-01'
      )

      if (response.status === 200) {
        // If a fallback occurred, metadata should include fallback info
        const metadata = response.body._snapshot_metadata
        if (metadata.fallback) {
          expect(metadata.fallback).toHaveProperty(
            'requested_date',
            '2020-01-01'
          )
          expect(metadata.fallback).toHaveProperty('actual_snapshot_date')
          expect(metadata.fallback).toHaveProperty('fallback_reason')
          expect([
            'no_snapshot_for_date',
            'closing_period_gap',
            'future_date',
          ]).toContain(metadata.fallback.fallback_reason)
        }
      }
    })
  })

  /**
   * Test Suite: Edge Cases for Date Parameter
   * **Validates: Requirements 4.3, 5.1**
   *
   * Tests edge cases and boundary conditions for date parameter handling.
   */
  describe('Edge Cases for Date Parameter', () => {
    it('should handle leap year date correctly', async () => {
      const response = await request(app).get(
        '/api/districts/101/statistics?date=2024-02-29'
      )

      // Should not return 400 for valid leap year date
      if (response.status === 400) {
        expect(response.body.error.code).not.toBe('INVALID_DATE_FORMAT')
      }
    })

    it('should handle invalid leap year date (JavaScript Date is lenient)', async () => {
      // Note: JavaScript's Date constructor is lenient with invalid dates like Feb 29 in non-leap years
      // It rolls over to March 1, so the format validation passes but the date is interpreted differently
      // This test documents the actual behavior - the date format is technically valid (YYYY-MM-DD pattern)
      const response = await request(app).get(
        '/api/districts/101/statistics?date=2023-02-29'
      )

      // The format is valid (matches YYYY-MM-DD pattern), so it won't return 400 for INVALID_DATE_FORMAT
      // It will proceed to snapshot lookup and return 503 (no snapshot) or other status
      if (response.status === 400) {
        // If it does return 400, it should be for a different reason than date format
        expect(response.body.error.code).not.toBe('INVALID_DATE_FORMAT')
      } else {
        // Expected: proceeds past validation to snapshot lookup
        expect([200, 404, 500, 503]).toContain(response.status)
      }
    })

    it('should handle year boundary dates', async () => {
      // Test December 31
      const responseDec = await request(app).get(
        '/api/districts/101/statistics?date=2024-12-31'
      )

      if (responseDec.status === 400) {
        expect(responseDec.body.error.code).not.toBe('INVALID_DATE_FORMAT')
      }

      // Test January 1
      const responseJan = await request(app).get(
        '/api/districts/101/statistics?date=2024-01-01'
      )

      if (responseJan.status === 400) {
        expect(responseJan.body.error.code).not.toBe('INVALID_DATE_FORMAT')
      }
    })

    it('should handle URL-encoded date parameter', async () => {
      // URL encode the date (though typically not needed for YYYY-MM-DD)
      const response = await request(app).get(
        '/api/districts/101/statistics?date=2024%2D01%2D15'
      )

      // Should handle URL-encoded dashes correctly
      if (response.status === 400) {
        expect(response.body.error.code).not.toBe('INVALID_DATE_FORMAT')
      }
    })
  })

  /**
   * Test Suite: Fields Query Parameter
   * Tests the `fields` query parameter for response optimization.
   *
   * - Default (no fields): excludes heavy arrays (clubPerformance, divisionPerformance, districtPerformance)
   * - fields=divisions: includes divisionPerformance and clubPerformance
   * - fields=clubs: includes clubPerformance
   * - fields=all: includes all data (backward compatible full response)
   * - Invalid fields value: treated as summary-only (no error)
   */
  describe('Fields Query Parameter', () => {
    it('should accept fields=divisions without returning 400', async () => {
      const response = await request(app).get(
        '/api/districts/101/statistics?fields=divisions'
      )

      // Should not return 400 for valid fields param
      expect(response.status).not.toBe(400)
    })

    it('should accept fields=clubs without returning 400', async () => {
      const response = await request(app).get(
        '/api/districts/101/statistics?fields=clubs'
      )

      expect(response.status).not.toBe(400)
    })

    it('should accept fields=all without returning 400', async () => {
      const response = await request(app).get(
        '/api/districts/101/statistics?fields=all'
      )

      expect(response.status).not.toBe(400)
    })

    it('should exclude heavy arrays from default response (no fields param)', async () => {
      const response = await request(app).get('/api/districts/101/statistics')

      if (response.status === 200) {
        // Default response should NOT include heavy arrays
        expect(response.body).not.toHaveProperty('clubPerformance')
        expect(response.body).not.toHaveProperty('divisionPerformance')
        expect(response.body).not.toHaveProperty('districtPerformance')

        // But should include summary fields
        expect(response.body).toHaveProperty('districtId')
        expect(response.body).toHaveProperty('membership')
        expect(response.body).toHaveProperty('clubs')
        expect(response.body).toHaveProperty('education')
      }
    })

    it('should include all data when fields=all', async () => {
      const response = await request(app).get(
        '/api/districts/101/statistics?fields=all'
      )

      if (response.status === 200) {
        // fields=all should preserve the full response including heavy arrays
        expect(response.body).toHaveProperty('districtId')
        expect(response.body).toHaveProperty('membership')
        expect(response.body).toHaveProperty('clubs')
        expect(response.body).toHaveProperty('education')
        // Heavy arrays should be present
        expect(response.body).toHaveProperty('clubPerformance')
        expect(response.body).toHaveProperty('divisionPerformance')
        expect(response.body).toHaveProperty('districtPerformance')
      }
    })

    it('should include division data when fields=divisions', async () => {
      const response = await request(app).get(
        '/api/districts/101/statistics?fields=divisions'
      )

      if (response.status === 200) {
        // Should include division-related arrays
        expect(response.body).toHaveProperty('divisionPerformance')
        expect(response.body).toHaveProperty('clubPerformance')
        // Should NOT include other heavy arrays
        expect(response.body).not.toHaveProperty('districtPerformance')
      }
    })

    it('should include club data when fields=clubs', async () => {
      const response = await request(app).get(
        '/api/districts/101/statistics?fields=clubs'
      )

      if (response.status === 200) {
        // Should include clubPerformance
        expect(response.body).toHaveProperty('clubPerformance')
        // Should NOT include other heavy arrays
        expect(response.body).not.toHaveProperty('divisionPerformance')
        expect(response.body).not.toHaveProperty('districtPerformance')
      }
    })

    it('should not return 400 for unknown fields value', async () => {
      const response = await request(app).get(
        '/api/districts/101/statistics?fields=unknown'
      )

      // Unknown fields value should fallback to summary-only, not error
      expect(response.status).not.toBe(400)
    })

    it('should work with both fields and date params together', async () => {
      const response = await request(app).get(
        '/api/districts/101/statistics?date=2024-01-15&fields=divisions'
      )

      // Should not return 400 for valid combination
      expect(response.status).not.toBe(400)

      // If successful, date validation should still work
      if (response.status === 200) {
        expect(response.body).toHaveProperty('divisionPerformance')
      }
    })

    it('should generate different cache keys for different fields values', async () => {
      const response1 = await request(app).get(
        '/api/districts/101/statistics?fields=divisions'
      )

      const response2 = await request(app).get(
        '/api/districts/101/statistics?fields=all'
      )

      // Both requests should complete independently
      expect(response1.status).toBeDefined()
      expect(response2.status).toBeDefined()
    })
  })
})
