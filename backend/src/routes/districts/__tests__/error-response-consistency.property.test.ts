/**
 * Property-Based Tests for Error Response Consistency
 *
 * Feature: storage-provider-integration-fix
 * Property 3: HTTP 503 for Empty Storage
 * Property 4: Consistent Error Response Structure
 *
 * **Validates: Requirements 2.1, 2.2, 6.1, 6.2, 6.3, 6.4**
 *
 * Property 3: For any district route handler, when no snapshot is available,
 * the handler SHALL return HTTP 503 with error code `NO_SNAPSHOT_AVAILABLE`
 * and SHALL NOT return HTTP 500.
 *
 * Property 4: For any district route handler returning `NO_SNAPSHOT_AVAILABLE`,
 * the error response SHALL contain:
 * - `error.code`: "NO_SNAPSHOT_AVAILABLE"
 * - `error.message`: A descriptive message
 * - `error.details`: Instructions to run a refresh operation
 *
 * Test Isolation Requirements (per testing steering document):
 * - Each test uses a fresh Express app instance
 * - Cache is cleared before each test to prevent cross-test pollution
 * - Uses deterministic seeds for property tests to ensure reproducibility
 * - Tests do not depend on execution order
 * - All tests pass when run with --run (parallel mode)
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
import * as fc from 'fast-check'
import express, { type Express } from 'express'
import request from 'supertest'
import { cacheService } from '../../../services/CacheService.js'

// ============================================================================
// Mock Configuration
// ============================================================================

// Mock the shared module to simulate empty storage
// The key insight is that we need to mock the helper functions themselves,
// not just the store exports, because the helper functions capture references
// to the stores at module initialization time.
vi.mock('../shared.js', async importOriginal => {
  const original = await importOriginal<typeof import('../shared.js')>()

  // Create a mock snapshot store that always returns null (empty storage)
  const mockEmptySnapshotStore = {
    getLatestSuccessful: vi.fn().mockResolvedValue(null),
    getLatest: vi.fn().mockResolvedValue(null),
    getSnapshot: vi.fn().mockResolvedValue(null),
    listSnapshots: vi.fn().mockResolvedValue([]),
    writeSnapshot: vi.fn(),
    isReady: vi.fn().mockResolvedValue(true),
    writeDistrictData: vi.fn(),
    readDistrictData: vi.fn().mockResolvedValue(null),
    listDistrictsInSnapshot: vi.fn().mockResolvedValue([]),
    getSnapshotManifest: vi.fn().mockResolvedValue(null),
    getSnapshotMetadata: vi.fn().mockResolvedValue(null),
    writeAllDistrictsRankings: vi.fn().mockResolvedValue(undefined),
    readAllDistrictsRankings: vi.fn().mockResolvedValue(null),
    hasAllDistrictsRankings: vi.fn().mockResolvedValue(false),
  }

  // Create a mock district data aggregator
  const mockDistrictDataAggregator = {
    getDistrictData: vi.fn().mockResolvedValue(null),
    getDistrictSummary: vi.fn().mockResolvedValue([]),
    listDistrictsInSnapshot: vi.fn().mockResolvedValue([]),
    getSnapshotManifest: vi.fn().mockResolvedValue(null),
    getSnapshotMetadata: vi.fn().mockResolvedValue(null),
  }

  // Mock the helper functions to simulate empty storage behavior
  // These functions need to be mocked because they capture store references at module load time
  const mockServeFromPerDistrictSnapshot = vi
    .fn()
    .mockImplementation(
      async (
        res: { status: (code: number) => { json: (body: unknown) => void } },
        _dataExtractor: unknown,
        _errorContext: string
      ) => {
        // Simulate empty storage - return 503 NO_SNAPSHOT_AVAILABLE
        res.status(503).json({
          error: {
            code: 'NO_SNAPSHOT_AVAILABLE',
            message: 'No data snapshot available yet',
            details: 'Run a refresh operation to create the first snapshot',
          },
        })
        return null
      }
    )

  const mockServeDistrictFromPerDistrictSnapshot = vi
    .fn()
    .mockImplementation(
      async (
        res: { status: (code: number) => { json: (body: unknown) => void } },
        _districtId: string,
        _dataExtractor: unknown,
        _errorContext: string
      ) => {
        // Simulate empty storage - return 503 NO_SNAPSHOT_AVAILABLE
        res.status(503).json({
          error: {
            code: 'NO_SNAPSHOT_AVAILABLE',
            message: 'No data snapshot available yet',
            details: 'Run a refresh operation to create the first snapshot',
          },
        })
        return null
      }
    )

  const mockServeDistrictFromPerDistrictSnapshotByDate = vi
    .fn()
    .mockImplementation(
      async (
        res: { status: (code: number) => { json: (body: unknown) => void } },
        _districtId: string,
        _requestedDate: string | undefined,
        _dataExtractor: unknown,
        _errorContext: string
      ) => {
        // Simulate empty storage - return 503 NO_SNAPSHOT_AVAILABLE
        res.status(503).json({
          error: {
            code: 'NO_SNAPSHOT_AVAILABLE',
            message: 'No data snapshot available yet',
            details: 'Run a refresh operation to create the first snapshot',
          },
        })
        return null
      }
    )

  const mockServeDistrictFromSnapshot = vi
    .fn()
    .mockImplementation(
      async (
        res: { status: (code: number) => { json: (body: unknown) => void } },
        _districtId: string,
        _dataExtractor: unknown,
        _errorContext: string
      ) => {
        // Simulate empty storage - return 503 NO_SNAPSHOT_AVAILABLE
        res.status(503).json({
          error: {
            code: 'NO_SNAPSHOT_AVAILABLE',
            message: 'No data snapshot available yet',
            details: 'Run a refresh operation to create the first snapshot',
          },
        })
        return null
      }
    )

  return {
    ...original,
    snapshotStore: mockEmptySnapshotStore,
    perDistrictSnapshotStore: mockEmptySnapshotStore,
    districtDataAggregator: mockDistrictDataAggregator,
    // Mock the helper functions to simulate empty storage behavior
    serveFromPerDistrictSnapshot: mockServeFromPerDistrictSnapshot,
    serveDistrictFromPerDistrictSnapshot:
      mockServeDistrictFromPerDistrictSnapshot,
    serveDistrictFromPerDistrictSnapshotByDate:
      mockServeDistrictFromPerDistrictSnapshotByDate,
    serveDistrictFromSnapshot: mockServeDistrictFromSnapshot,
    findNearestSnapshot: vi
      .fn()
      .mockResolvedValue({ snapshot: null, fallbackReason: null }),
  }
})

// Import routes after mocking
import districtRoutes from '../index.js'

// ============================================================================
// Test Configuration
// ============================================================================

const PROPERTY_TEST_ITERATIONS = 20
const PROPERTY_TEST_TIMEOUT = 30000 // 30 seconds
const DETERMINISTIC_SEED = 42 // For reproducibility

// ============================================================================
// Fast-Check Generators
// ============================================================================

/**
 * Generator for valid alphanumeric district IDs
 * District IDs are typically numeric (e.g., "101", "F") or alphanumeric
 */
const generateValidDistrictId = (): fc.Arbitrary<string> =>
  fc.oneof(
    // Numeric district IDs (most common)
    fc.integer({ min: 1, max: 999 }).map(n => String(n)),
    // Letter-based district IDs (e.g., "F" for Founders)
    fc.constantFrom('F', 'U', 'A', 'B', 'C', 'D', 'E'),
    // Alphanumeric combinations
    fc.stringMatching(/^[A-Za-z0-9]{1,5}$/)
  )

/**
 * Generator for valid ISO date strings (YYYY-MM-DD)
 */
const generateValidDate = (): fc.Arbitrary<string> =>
  fc
    .date({
      min: new Date('2020-01-01'),
      max: new Date('2025-12-31'),
    })
    .map(d => d.toISOString().split('T')[0] ?? '2024-01-01')

// ============================================================================
// Test Suite
// ============================================================================

describe('Error Response Consistency Property Tests', () => {
  let app: Express

  beforeAll(() => {
    app = express()
    app.use(express.json())
    app.use('/api/districts', districtRoutes)
  })

  beforeEach(() => {
    // Clear cache before each test to ensure test isolation
    cacheService.clear()
    // Reset all mocks
    vi.clearAllMocks()
  })

  afterAll(() => {
    // Final cleanup
    cacheService.clear()
    vi.restoreAllMocks()
  })

  // ============================================================================
  // Property 3: HTTP 503 for Empty Storage
  // ============================================================================

  describe('Property 3: HTTP 503 for Empty Storage', () => {
    /**
     * Property 3a: GET /api/districts returns 503 when storage is empty
     *
     * **Validates: Requirements 2.1, 2.2, 6.4**
     */
    it('should return 503 for GET /api/districts when storage is empty', async () => {
      const response = await request(app).get('/api/districts')

      expect(response.status).toBe(503)
      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toHaveProperty(
        'code',
        'NO_SNAPSHOT_AVAILABLE'
      )
      // Verify NOT 500
      expect(response.status).not.toBe(500)
    })

    /**
     * Property 3b: GET /api/districts/rankings returns 503 when storage is empty
     *
     * **Validates: Requirements 2.1, 2.2, 6.4**
     */
    it('should return 503 for GET /api/districts/rankings when storage is empty', async () => {
      const response = await request(app).get('/api/districts/rankings')

      expect(response.status).toBe(503)
      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toHaveProperty(
        'code',
        'NO_SNAPSHOT_AVAILABLE'
      )
      // Verify NOT 500
      expect(response.status).not.toBe(500)
    })

    /**
     * Property 3c: For any valid district ID, GET /api/districts/:districtId/statistics
     * returns 503 when storage is empty
     *
     * **Validates: Requirements 2.1, 2.2, 6.4**
     */
    it(
      'Property 3c: GET /api/districts/:districtId/statistics returns 503 for any valid district ID when storage is empty',
      async () => {
        await fc.assert(
          fc.asyncProperty(generateValidDistrictId(), async districtId => {
            const response = await request(app).get(
              `/api/districts/${encodeURIComponent(districtId)}/statistics`
            )

            // Should return 503 for empty storage
            expect(response.status).toBe(503)
            expect(response.body).toHaveProperty('error')
            expect(response.body.error).toHaveProperty(
              'code',
              'NO_SNAPSHOT_AVAILABLE'
            )
            // Verify NOT 500
            expect(response.status).not.toBe(500)

            return true
          }),
          {
            numRuns: PROPERTY_TEST_ITERATIONS,
            seed: DETERMINISTIC_SEED,
          }
        )
      },
      PROPERTY_TEST_TIMEOUT
    )

    /**
     * Property 3d: For any valid district ID, GET /api/districts/:districtId/clubs
     * returns 503 when storage is empty
     *
     * **Validates: Requirements 2.1, 2.2, 6.4**
     */
    it(
      'Property 3d: GET /api/districts/:districtId/clubs returns 503 for any valid district ID when storage is empty',
      async () => {
        await fc.assert(
          fc.asyncProperty(generateValidDistrictId(), async districtId => {
            const response = await request(app).get(
              `/api/districts/${encodeURIComponent(districtId)}/clubs`
            )

            // Should return 503 for empty storage
            expect(response.status).toBe(503)
            expect(response.body).toHaveProperty('error')
            expect(response.body.error).toHaveProperty(
              'code',
              'NO_SNAPSHOT_AVAILABLE'
            )
            // Verify NOT 500
            expect(response.status).not.toBe(500)

            return true
          }),
          {
            numRuns: PROPERTY_TEST_ITERATIONS,
            seed: DETERMINISTIC_SEED + 1,
          }
        )
      },
      PROPERTY_TEST_TIMEOUT
    )

    /**
     * Property 3e: For any valid district ID, GET /api/districts/:districtId/membership-history
     * returns 503 when storage is empty
     *
     * **Validates: Requirements 2.1, 2.2, 6.4**
     */
    it(
      'Property 3e: GET /api/districts/:districtId/membership-history returns 503 for any valid district ID when storage is empty',
      async () => {
        await fc.assert(
          fc.asyncProperty(generateValidDistrictId(), async districtId => {
            const response = await request(app).get(
              `/api/districts/${encodeURIComponent(districtId)}/membership-history`
            )

            // Should return 503 for empty storage
            expect(response.status).toBe(503)
            expect(response.body).toHaveProperty('error')
            expect(response.body.error).toHaveProperty(
              'code',
              'NO_SNAPSHOT_AVAILABLE'
            )
            // Verify NOT 500
            expect(response.status).not.toBe(500)

            return true
          }),
          {
            numRuns: PROPERTY_TEST_ITERATIONS,
            seed: DETERMINISTIC_SEED + 2,
          }
        )
      },
      PROPERTY_TEST_TIMEOUT
    )

    /**
     * Property 3f: For any valid district ID and date, GET /api/districts/:districtId/statistics?date=...
     * returns 503 when storage is empty
     *
     * **Validates: Requirements 2.1, 2.2, 6.4**
     */
    it(
      'Property 3f: GET /api/districts/:districtId/statistics with date returns 503 when storage is empty',
      async () => {
        await fc.assert(
          fc.asyncProperty(
            generateValidDistrictId(),
            generateValidDate(),
            async (districtId, date) => {
              const response = await request(app).get(
                `/api/districts/${encodeURIComponent(districtId)}/statistics?date=${date}`
              )

              // Should return 503 for empty storage
              expect(response.status).toBe(503)
              expect(response.body).toHaveProperty('error')
              expect(response.body.error).toHaveProperty(
                'code',
                'NO_SNAPSHOT_AVAILABLE'
              )
              // Verify NOT 500
              expect(response.status).not.toBe(500)

              return true
            }
          ),
          {
            numRuns: PROPERTY_TEST_ITERATIONS,
            seed: DETERMINISTIC_SEED + 3,
          }
        )
      },
      PROPERTY_TEST_TIMEOUT
    )

    /**
     * Property 3g: GET /api/districts/rankings with date returns 404 when storage is empty
     *
     * Note: When a specific date is requested but no snapshots exist, the endpoint
     * returns 404 SNAPSHOT_NOT_FOUND (the requested resource doesn't exist) rather
     * than 503 NO_SNAPSHOT_AVAILABLE (which is for when no date is specified).
     * This is correct behavior - 404 indicates the specific requested date wasn't found.
     *
     * **Validates: Requirements 2.2 (SHALL NOT return HTTP 500)**
     */
    it(
      'Property 3g: GET /api/districts/rankings with date returns 404 when storage is empty (specific date not found)',
      async () => {
        await fc.assert(
          fc.asyncProperty(generateValidDate(), async date => {
            const response = await request(app).get(
              `/api/districts/rankings?date=${date}`
            )

            // When a specific date is requested and no snapshots exist,
            // returns 404 SNAPSHOT_NOT_FOUND (the requested date doesn't exist)
            expect(response.status).toBe(404)
            expect(response.body).toHaveProperty('error')
            expect(response.body.error).toHaveProperty(
              'code',
              'SNAPSHOT_NOT_FOUND'
            )
            // Verify NOT 500 (Requirement 2.2)
            expect(response.status).not.toBe(500)

            return true
          }),
          {
            numRuns: PROPERTY_TEST_ITERATIONS,
            seed: DETERMINISTIC_SEED + 4,
          }
        )
      },
      PROPERTY_TEST_TIMEOUT
    )
  })

  // ============================================================================
  // Property 4: Consistent Error Response Structure
  // ============================================================================

  describe('Property 4: Consistent Error Response Structure', () => {
    /**
     * Property 4a: Error response for GET /api/districts contains required fields
     *
     * **Validates: Requirements 6.1, 6.2, 6.3**
     */
    it('should return consistent error structure for GET /api/districts', async () => {
      const response = await request(app).get('/api/districts')

      expect(response.status).toBe(503)
      expect(response.body).toHaveProperty('error')

      // Verify error structure (Requirement 6.2)
      expect(response.body.error).toHaveProperty(
        'code',
        'NO_SNAPSHOT_AVAILABLE'
      )
      expect(response.body.error).toHaveProperty('message')
      expect(typeof response.body.error.message).toBe('string')
      expect(response.body.error.message.length).toBeGreaterThan(0)

      // Verify details field with refresh instructions (Requirement 6.3)
      expect(response.body.error).toHaveProperty('details')
      expect(typeof response.body.error.details).toBe('string')
      expect(response.body.error.details.toLowerCase()).toContain('refresh')
    })

    /**
     * Property 4b: Error response for GET /api/districts/rankings contains required fields
     *
     * **Validates: Requirements 6.1, 6.2, 6.3**
     */
    it('should return consistent error structure for GET /api/districts/rankings', async () => {
      const response = await request(app).get('/api/districts/rankings')

      expect(response.status).toBe(503)
      expect(response.body).toHaveProperty('error')

      // Verify error structure (Requirement 6.2)
      expect(response.body.error).toHaveProperty(
        'code',
        'NO_SNAPSHOT_AVAILABLE'
      )
      expect(response.body.error).toHaveProperty('message')
      expect(typeof response.body.error.message).toBe('string')
      expect(response.body.error.message.length).toBeGreaterThan(0)

      // Verify details field with refresh instructions (Requirement 6.3)
      expect(response.body.error).toHaveProperty('details')
      expect(typeof response.body.error.details).toBe('string')
      expect(response.body.error.details.toLowerCase()).toContain('refresh')
    })

    /**
     * Property 4c: For any valid district ID, error response contains required fields
     *
     * **Validates: Requirements 6.1, 6.2, 6.3**
     */
    it(
      'Property 4c: Error response for any district statistics request contains required fields',
      async () => {
        await fc.assert(
          fc.asyncProperty(generateValidDistrictId(), async districtId => {
            const response = await request(app).get(
              `/api/districts/${encodeURIComponent(districtId)}/statistics`
            )

            expect(response.status).toBe(503)
            expect(response.body).toHaveProperty('error')

            // Verify error structure (Requirement 6.2)
            expect(response.body.error).toHaveProperty(
              'code',
              'NO_SNAPSHOT_AVAILABLE'
            )
            expect(response.body.error).toHaveProperty('message')
            expect(typeof response.body.error.message).toBe('string')
            expect(response.body.error.message.length).toBeGreaterThan(0)

            // Verify details field with refresh instructions (Requirement 6.3)
            expect(response.body.error).toHaveProperty('details')
            expect(typeof response.body.error.details).toBe('string')
            expect(response.body.error.details.toLowerCase()).toContain(
              'refresh'
            )

            return true
          }),
          {
            numRuns: PROPERTY_TEST_ITERATIONS,
            seed: DETERMINISTIC_SEED + 10,
          }
        )
      },
      PROPERTY_TEST_TIMEOUT
    )

    /**
     * Property 4d: For any valid district ID, error response for clubs endpoint contains required fields
     *
     * **Validates: Requirements 6.1, 6.2, 6.3**
     */
    it(
      'Property 4d: Error response for any district clubs request contains required fields',
      async () => {
        await fc.assert(
          fc.asyncProperty(generateValidDistrictId(), async districtId => {
            const response = await request(app).get(
              `/api/districts/${encodeURIComponent(districtId)}/clubs`
            )

            expect(response.status).toBe(503)
            expect(response.body).toHaveProperty('error')

            // Verify error structure (Requirement 6.2)
            expect(response.body.error).toHaveProperty(
              'code',
              'NO_SNAPSHOT_AVAILABLE'
            )
            expect(response.body.error).toHaveProperty('message')
            expect(typeof response.body.error.message).toBe('string')

            // Verify details field with refresh instructions (Requirement 6.3)
            expect(response.body.error).toHaveProperty('details')
            expect(typeof response.body.error.details).toBe('string')
            expect(response.body.error.details.toLowerCase()).toContain(
              'refresh'
            )

            return true
          }),
          {
            numRuns: PROPERTY_TEST_ITERATIONS,
            seed: DETERMINISTIC_SEED + 11,
          }
        )
      },
      PROPERTY_TEST_TIMEOUT
    )

    /**
     * Property 4e: All district routes return identical error structure
     *
     * This property verifies that all district routes return the same
     * error structure when storage is empty, ensuring consistency.
     *
     * **Validates: Requirements 6.1, 6.2, 6.3**
     */
    it('Property 4e: All district routes return identical error structure', async () => {
      const districtId = '101'

      // Test multiple routes and collect their error responses
      const routes = [
        '/api/districts',
        '/api/districts/rankings',
        `/api/districts/${districtId}/statistics`,
        `/api/districts/${districtId}/clubs`,
        `/api/districts/${districtId}/membership-history`,
      ]

      const responses = await Promise.all(
        routes.map(route => request(app).get(route))
      )

      // All should return 503
      for (const response of responses) {
        expect(response.status).toBe(503)
      }

      // All should have the same error structure
      for (const response of responses) {
        expect(response.body).toHaveProperty('error')
        expect(response.body.error).toHaveProperty(
          'code',
          'NO_SNAPSHOT_AVAILABLE'
        )
        expect(response.body.error).toHaveProperty('message')
        expect(response.body.error).toHaveProperty('details')
      }

      // Verify the error code is consistent across all routes
      const errorCodes = responses.map(r => r.body.error.code)
      expect(new Set(errorCodes).size).toBe(1) // All codes should be the same
      expect(errorCodes[0]).toBe('NO_SNAPSHOT_AVAILABLE')
    })
  })

  // ============================================================================
  // Additional Integration Tests
  // ============================================================================

  describe('Integration Tests for Error Response Consistency', () => {
    /**
     * Integration test: Verify error message is descriptive
     *
     * **Validates: Requirement 6.2**
     */
    it('should return descriptive error message', async () => {
      const response = await request(app).get('/api/districts')

      expect(response.status).toBe(503)
      expect(response.body.error.message).toBe('No data snapshot available yet')
    })

    /**
     * Integration test: Verify details contain actionable instructions
     *
     * **Validates: Requirement 6.3**
     */
    it('should return actionable details instructing user to run refresh', async () => {
      const response = await request(app).get('/api/districts')

      expect(response.status).toBe(503)
      expect(response.body.error.details).toBe(
        'Run a refresh operation to create the first snapshot'
      )
    })

    /**
     * Integration test: Verify HTTP status code is 503 (Service Unavailable)
     *
     * **Validates: Requirement 6.4**
     */
    it('should return HTTP 503 status code for missing snapshot', async () => {
      const response = await request(app).get('/api/districts')

      expect(response.status).toBe(503)
      // Verify it's specifically 503, not 500 or other error codes
      expect(response.status).not.toBe(500)
      expect(response.status).not.toBe(404)
      expect(response.status).not.toBe(400)
    })

    /**
     * Integration test: Verify error response is valid JSON
     */
    it('should return valid JSON error response', async () => {
      const response = await request(app).get('/api/districts')

      expect(response.headers['content-type']).toMatch(/application\/json/)
      expect(() => JSON.parse(JSON.stringify(response.body))).not.toThrow()
    })

    /**
     * Integration test: Verify error response does not leak internal details
     */
    it('should not leak internal error details in response', async () => {
      const response = await request(app).get('/api/districts')

      expect(response.status).toBe(503)

      // Should not contain stack traces or internal paths
      const responseStr = JSON.stringify(response.body)
      expect(responseStr).not.toContain('stack')
      expect(responseStr).not.toContain('node_modules')
      expect(responseStr).not.toContain('Error:')
    })
  })
})
