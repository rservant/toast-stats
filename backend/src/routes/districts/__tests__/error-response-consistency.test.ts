/**
 * Unit Tests for Error Response Consistency
 *
 * Verifies that district API routes return consistent 503 error responses
 * with NO_SNAPSHOT_AVAILABLE when storage is empty, and proper error
 * response structure.
 *
 * Converted from property-based tests — PBT iterated over generated
 * district IDs but the mock always returns the same response, making
 * fixed test cases equivalent.
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

// Mock shared module to simulate empty storage
vi.mock('../shared.js', async importOriginal => {
  const original = await importOriginal<typeof import('../shared.js')>()

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

  const mockDistrictDataAggregator = {
    getDistrictData: vi.fn().mockResolvedValue(null),
    getDistrictSummary: vi.fn().mockResolvedValue([]),
    listDistrictsInSnapshot: vi.fn().mockResolvedValue([]),
    getSnapshotManifest: vi.fn().mockResolvedValue(null),
    getSnapshotMetadata: vi.fn().mockResolvedValue(null),
  }

  const mock503Response = vi
    .fn()
    .mockImplementation(
      async (
        res: { status: (code: number) => { json: (body: unknown) => void } },
        ..._args: unknown[]
      ) => {
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
    serveFromPerDistrictSnapshot: mock503Response,
    serveDistrictFromPerDistrictSnapshot: mock503Response,
    serveDistrictFromPerDistrictSnapshotByDate: mock503Response,
    serveDistrictFromSnapshot: mock503Response,
    findNearestSnapshot: vi
      .fn()
      .mockResolvedValue({ snapshot: null, fallbackReason: null }),
  }
})

import districtRoutes from '../index.js'

describe('Error Response Consistency', () => {
  let app: Express

  beforeAll(() => {
    app = express()
    app.use(express.json())
    app.use('/api/districts', districtRoutes)
  })

  beforeEach(() => {
    cacheService.clear()
    vi.clearAllMocks()
  })

  afterAll(() => {
    cacheService.clear()
    vi.restoreAllMocks()
  })

  // --------------------------------------------------------------------------
  // HTTP 503 for Empty Storage
  // --------------------------------------------------------------------------

  describe('HTTP 503 for Empty Storage', () => {
    it('should return 503 for GET /api/districts', async () => {
      const response = await request(app).get('/api/districts')
      expect(response.status).toBe(503)
      expect(response.body.error.code).toBe('NO_SNAPSHOT_AVAILABLE')
      expect(response.status).not.toBe(500)
    })

    it('should return 503 for GET /api/districts/rankings', async () => {
      const response = await request(app).get('/api/districts/rankings')
      expect(response.status).toBe(503)
      expect(response.body.error.code).toBe('NO_SNAPSHOT_AVAILABLE')
      expect(response.status).not.toBe(500)
    })

    it.each(['1', '42', '101', 'F', 'U'])(
      'should return 503 for GET /api/districts/%s/statistics',
      async districtId => {
        const response = await request(app).get(
          `/api/districts/${districtId}/statistics`
        )
        expect(response.status).toBe(503)
        expect(response.body.error.code).toBe('NO_SNAPSHOT_AVAILABLE')
        expect(response.status).not.toBe(500)
      }
    )

    it.each(['1', '42', '101', 'F'])(
      'should return 503 for GET /api/districts/%s/clubs',
      async districtId => {
        const response = await request(app).get(
          `/api/districts/${districtId}/clubs`
        )
        expect(response.status).toBe(503)
        expect(response.body.error.code).toBe('NO_SNAPSHOT_AVAILABLE')
        expect(response.status).not.toBe(500)
      }
    )

    it.each(['1', '42', 'F'])(
      'should return 503 for GET /api/districts/%s/membership-history',
      async districtId => {
        const response = await request(app).get(
          `/api/districts/${districtId}/membership-history`
        )
        expect(response.status).toBe(503)
        expect(response.body.error.code).toBe('NO_SNAPSHOT_AVAILABLE')
        expect(response.status).not.toBe(500)
      }
    )

    it('should return 503 for statistics with date param', async () => {
      const response = await request(app).get(
        '/api/districts/101/statistics?date=2024-01-15'
      )
      expect(response.status).toBe(503)
      expect(response.body.error.code).toBe('NO_SNAPSHOT_AVAILABLE')
    })

    it('should return 404 for rankings with specific date (date not found)', async () => {
      const response = await request(app).get(
        '/api/districts/rankings?date=2024-01-15'
      )
      expect(response.status).toBe(404)
      expect(response.body.error.code).toBe('SNAPSHOT_NOT_FOUND')
      expect(response.status).not.toBe(500)
    })
  })

  // --------------------------------------------------------------------------
  // Consistent Error Response Structure
  // --------------------------------------------------------------------------

  describe('Consistent Error Response Structure', () => {
    it('should return consistent error structure for GET /api/districts', async () => {
      const response = await request(app).get('/api/districts')
      expect(response.status).toBe(503)
      expect(response.body.error.code).toBe('NO_SNAPSHOT_AVAILABLE')
      expect(response.body.error.message).toBeTruthy()
      expect(typeof response.body.error.message).toBe('string')
      expect(response.body.error.details).toBeTruthy()
      expect(response.body.error.details.toLowerCase()).toContain('refresh')
    })

    it('should return consistent error structure for GET /api/districts/rankings', async () => {
      const response = await request(app).get('/api/districts/rankings')
      expect(response.status).toBe(503)
      expect(response.body.error.code).toBe('NO_SNAPSHOT_AVAILABLE')
      expect(response.body.error.message).toBeTruthy()
      expect(response.body.error.details.toLowerCase()).toContain('refresh')
    })

    it.each(['101', 'F'])(
      'should return error with required fields for /api/districts/%s/statistics',
      async districtId => {
        const response = await request(app).get(
          `/api/districts/${districtId}/statistics`
        )
        expect(response.status).toBe(503)
        expect(response.body.error.code).toBe('NO_SNAPSHOT_AVAILABLE')
        expect(response.body.error.message).toBeTruthy()
        expect(response.body.error.details.toLowerCase()).toContain('refresh')
      }
    )

    it.each(['101', 'F'])(
      'should return error with required fields for /api/districts/%s/clubs',
      async districtId => {
        const response = await request(app).get(
          `/api/districts/${districtId}/clubs`
        )
        expect(response.status).toBe(503)
        expect(response.body.error.code).toBe('NO_SNAPSHOT_AVAILABLE')
        expect(response.body.error.message).toBeTruthy()
        expect(response.body.error.details.toLowerCase()).toContain('refresh')
      }
    )

    it('should return identical error structure across all routes', async () => {
      const routes = [
        '/api/districts',
        '/api/districts/rankings',
        '/api/districts/101/statistics',
        '/api/districts/101/clubs',
        '/api/districts/101/membership-history',
      ]

      const responses = await Promise.all(
        routes.map(route => request(app).get(route))
      )

      for (const response of responses) {
        expect(response.status).toBe(503)
        expect(response.body.error.code).toBe('NO_SNAPSHOT_AVAILABLE')
        expect(response.body.error).toHaveProperty('message')
        expect(response.body.error).toHaveProperty('details')
      }

      const errorCodes = responses.map(r => r.body.error.code)
      expect(new Set(errorCodes).size).toBe(1)
    })
  })

  // --------------------------------------------------------------------------
  // Integration Tests
  // --------------------------------------------------------------------------

  describe('Integration', () => {
    it('should return descriptive error message', async () => {
      const response = await request(app).get('/api/districts')
      expect(response.body.error.message).toBe('No data snapshot available yet')
    })

    it('should return actionable details', async () => {
      const response = await request(app).get('/api/districts')
      expect(response.body.error.details).toBe(
        'Run a refresh operation to create the first snapshot'
      )
    })

    it('should return HTTP 503 specifically', async () => {
      const response = await request(app).get('/api/districts')
      expect(response.status).toBe(503)
      expect(response.status).not.toBe(500)
      expect(response.status).not.toBe(404)
      expect(response.status).not.toBe(400)
    })

    it('should return valid JSON', async () => {
      const response = await request(app).get('/api/districts')
      expect(response.headers['content-type']).toMatch(/application\/json/)
    })

    it('should not leak internal error details', async () => {
      const response = await request(app).get('/api/districts')
      const responseStr = JSON.stringify(response.body)
      expect(responseStr).not.toContain('stack')
      expect(responseStr).not.toContain('node_modules')
      expect(responseStr).not.toContain('Error:')
    })
  })
})
