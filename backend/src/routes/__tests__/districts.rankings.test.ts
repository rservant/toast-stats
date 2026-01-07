import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import request from 'supertest'
import express, { type Express } from 'express'
import { Router } from 'express'
import { PerDistrictFileSnapshotStore } from '../../services/PerDistrictSnapshotStore.js'
import type { AllDistrictsRankingsData } from '../../types/snapshots.js'
import type { Snapshot } from '../../types/snapshots.js'
import {
  createTestCacheConfig,
  cleanupTestCacheConfig,
  type TestCacheConfig,
} from '../../utils/test-cache-helper.js'

/**
 * Unit tests for GET /api/districts/rankings endpoint
 * Tests the rankings endpoint reading from all-districts-rankings.json file
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4
 */
describe('Districts Rankings Endpoint', () => {
  let app: Express
  let testConfig: TestCacheConfig
  let mockSnapshotStore: {
    getLatestSuccessful: ReturnType<typeof vi.fn>
    getSnapshot: ReturnType<typeof vi.fn>
    readAllDistrictsRankings: ReturnType<typeof vi.fn>
  }

  // Sample test data
  const mockSnapshot: Snapshot = {
    snapshot_id: '2025-01-07',
    created_at: '2025-01-07T10:30:00.000Z',
    status: 'success',
    schema_version: '2.0.0',
    calculation_version: '2.0.0',
    errors: [],
    payload: {
      metadata: {
        source: 'toastmasters-dashboard',
        dataAsOfDate: '2025-01-07',
        fetchedAt: '2025-01-07T10:25:00.000Z',
        districtCount: 0,
        processingDurationMs: 1000,
      },
      districts: [],
    },
  }

  // Historical snapshot for date parameter tests
  const mockHistoricalSnapshot: Snapshot = {
    snapshot_id: '2025-01-01',
    created_at: '2025-01-01T10:30:00.000Z',
    status: 'success',
    schema_version: '2.0.0',
    calculation_version: '2.0.0',
    errors: [],
    payload: {
      metadata: {
        source: 'toastmasters-dashboard',
        dataAsOfDate: '2025-01-01',
        fetchedAt: '2025-01-01T10:25:00.000Z',
        districtCount: 0,
        processingDurationMs: 1000,
      },
      districts: [],
    },
  }

  const mockRankingsData: AllDistrictsRankingsData = {
    metadata: {
      snapshotId: '2025-01-07',
      calculatedAt: '2025-01-07T10:30:00.000Z',
      schemaVersion: '2.0.0',
      calculationVersion: '2.0.0',
      rankingVersion: 'borda-count-v1',
      sourceCsvDate: '2025-01-07',
      csvFetchedAt: '2025-01-07T10:25:00.000Z',
      totalDistricts: 3,
      fromCache: false,
    },
    rankings: [
      {
        districtId: '42',
        districtName: 'District 42',
        region: 'Region 5',
        paidClubs: 245,
        paidClubBase: 240,
        clubGrowthPercent: 2.08,
        totalPayments: 12500,
        paymentBase: 12000,
        paymentGrowthPercent: 4.17,
        activeClubs: 243,
        distinguishedClubs: 180,
        selectDistinguished: 45,
        presidentsDistinguished: 12,
        distinguishedPercent: 74.07,
        clubsRank: 1,
        paymentsRank: 2,
        distinguishedRank: 1,
        aggregateScore: 342.5,
      },
      {
        districtId: '15',
        districtName: 'District 15',
        region: 'Region 2',
        paidClubs: 220,
        paidClubBase: 215,
        clubGrowthPercent: 2.33,
        totalPayments: 11000,
        paymentBase: 10500,
        paymentGrowthPercent: 4.76,
        activeClubs: 218,
        distinguishedClubs: 160,
        selectDistinguished: 40,
        presidentsDistinguished: 10,
        distinguishedPercent: 73.39,
        clubsRank: 2,
        paymentsRank: 1,
        distinguishedRank: 2,
        aggregateScore: 338.2,
      },
      {
        districtId: 'F',
        districtName: 'District F',
        region: 'Region 1',
        paidClubs: 200,
        paidClubBase: 195,
        clubGrowthPercent: 2.56,
        totalPayments: 10000,
        paymentBase: 9500,
        paymentGrowthPercent: 5.26,
        activeClubs: 198,
        distinguishedClubs: 145,
        selectDistinguished: 35,
        presidentsDistinguished: 8,
        distinguishedPercent: 73.23,
        clubsRank: 3,
        paymentsRank: 3,
        distinguishedRank: 3,
        aggregateScore: 330.1,
      },
    ],
  }

  // Historical rankings data for date parameter tests
  const mockHistoricalRankingsData: AllDistrictsRankingsData = {
    metadata: {
      snapshotId: '2025-01-01',
      calculatedAt: '2025-01-01T10:30:00.000Z',
      schemaVersion: '2.0.0',
      calculationVersion: '2.0.0',
      rankingVersion: 'borda-count-v1',
      sourceCsvDate: '2025-01-01',
      csvFetchedAt: '2025-01-01T10:25:00.000Z',
      totalDistricts: 3,
      fromCache: false,
    },
    rankings: [
      {
        districtId: '42',
        districtName: 'District 42',
        region: 'Region 5',
        paidClubs: 240,
        paidClubBase: 235,
        clubGrowthPercent: 2.13,
        totalPayments: 12000,
        paymentBase: 11500,
        paymentGrowthPercent: 4.35,
        activeClubs: 238,
        distinguishedClubs: 175,
        selectDistinguished: 42,
        presidentsDistinguished: 10,
        distinguishedPercent: 73.53,
        clubsRank: 1,
        paymentsRank: 2,
        distinguishedRank: 1,
        aggregateScore: 340.0,
      },
    ],
  }

  beforeEach(async () => {
    // Create isolated test cache directory
    testConfig = await createTestCacheConfig('rankings-endpoint')

    // Create mock snapshot store with proper typing
    mockSnapshotStore = {
      getLatestSuccessful: vi.fn(),
      getSnapshot: vi.fn(),
      readAllDistrictsRankings: vi.fn(),
    } as {
      getLatestSuccessful: ReturnType<typeof vi.fn>
      getSnapshot: ReturnType<typeof vi.fn>
      readAllDistrictsRankings: ReturnType<typeof vi.fn>
    }

    // Create test Express app
    app = express()
    app.use(express.json())

    // Create router with mocked dependencies
    const router = Router()

    router.get('/rankings', async (req, res) => {
      try {
        const requestedDate = req.query['date'] as string | undefined
        let snapshot: Snapshot | null

        if (requestedDate) {
          // Validate date format (YYYY-MM-DD)
          if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
            res.status(400).json({
              error: {
                code: 'INVALID_DATE_FORMAT',
                message: 'Date must be in YYYY-MM-DD format',
                details: `Received: ${requestedDate}`,
              },
            })
            return
          }

          // Get snapshot for specific date
          snapshot = await (
            mockSnapshotStore.getSnapshot as (
              snapshotId: string
            ) => Promise<Snapshot | null>
          )(requestedDate)

          if (!snapshot) {
            res.status(404).json({
              error: {
                code: 'SNAPSHOT_NOT_FOUND',
                message: `No snapshot available for date ${requestedDate}`,
                details: 'The requested date does not have cached data',
              },
            })
            return
          }
        } else {
          // Get latest successful snapshot
          snapshot = await (
            mockSnapshotStore.getLatestSuccessful as () => Promise<Snapshot | null>
          )()
        }

        if (!snapshot) {
          res.status(503).json({
            error: {
              code: 'NO_SNAPSHOT_AVAILABLE',
              message: 'No data snapshot available yet',
              details: 'Run a refresh operation to create the first snapshot',
            },
          })
          return
        }

        const rankingsData = await (
          mockSnapshotStore.readAllDistrictsRankings as (
            snapshotId: string
          ) => Promise<AllDistrictsRankingsData | null>
        )(snapshot.snapshot_id)

        if (!rankingsData) {
          res.status(500).json({
            error: {
              code: 'RANKINGS_DATA_NOT_FOUND',
              message: 'Rankings data not found in snapshot',
              details:
                'The snapshot does not contain all-districts-rankings data',
            },
          })
          return
        }

        res.json({
          rankings: rankingsData.rankings,
          date: rankingsData.metadata.sourceCsvDate,
          _snapshot_metadata: {
            snapshot_id: snapshot.snapshot_id,
            created_at: snapshot.created_at,
            data_source: 'all-districts-rankings-file',
            from_cache: rankingsData.metadata.fromCache,
            calculation_version: rankingsData.metadata.calculationVersion,
            ranking_version: rankingsData.metadata.rankingVersion,
          },
        })
      } catch (error) {
        res.status(500).json({
          error: {
            code: 'RANKINGS_ERROR',
            message: 'Failed to fetch district rankings',
            details: error instanceof Error ? error.message : 'Unknown error',
          },
        })
      }
    })

    app.use('/api/districts', router)
  })

  afterEach(async () => {
    // Clean up test cache directory
    await cleanupTestCacheConfig(testConfig)
    vi.clearAllMocks()
  })

  describe('GET /api/districts/rankings', () => {
    it('should return 503 when no snapshot is available', async () => {
      // Mock: No snapshot available
      mockSnapshotStore.getLatestSuccessful.mockResolvedValue(null)

      const response = await request(app)
        .get('/api/districts/rankings')
        .expect(503)

      expect(response.body).toEqual({
        error: {
          code: 'NO_SNAPSHOT_AVAILABLE',
          message: 'No data snapshot available yet',
          details: 'Run a refresh operation to create the first snapshot',
        },
      })

      expect(mockSnapshotStore.getLatestSuccessful).toHaveBeenCalledOnce()
      expect(mockSnapshotStore.readAllDistrictsRankings).not.toHaveBeenCalled()
    })

    it('should return 500 when rankings file is missing', async () => {
      // Mock: Snapshot exists but rankings file is missing
      mockSnapshotStore.getLatestSuccessful.mockResolvedValue(mockSnapshot)
      mockSnapshotStore.readAllDistrictsRankings.mockResolvedValue(null)

      const response = await request(app)
        .get('/api/districts/rankings')
        .expect(500)

      expect(response.body).toEqual({
        error: {
          code: 'RANKINGS_DATA_NOT_FOUND',
          message: 'Rankings data not found in snapshot',
          details: 'The snapshot does not contain all-districts-rankings data',
        },
      })

      expect(mockSnapshotStore.getLatestSuccessful).toHaveBeenCalledOnce()
      expect(mockSnapshotStore.readAllDistrictsRankings).toHaveBeenCalledWith(
        '2025-01-07'
      )
    })

    it('should return rankings data when file exists', async () => {
      // Mock: Snapshot and rankings file both exist
      mockSnapshotStore.getLatestSuccessful.mockResolvedValue(mockSnapshot)
      mockSnapshotStore.readAllDistrictsRankings.mockResolvedValue(
        mockRankingsData
      )

      const response = await request(app)
        .get('/api/districts/rankings')
        .expect(200)

      expect(response.body).toEqual({
        rankings: mockRankingsData.rankings,
        date: '2025-01-07',
        _snapshot_metadata: {
          snapshot_id: '2025-01-07',
          created_at: '2025-01-07T10:30:00.000Z',
          data_source: 'all-districts-rankings-file',
          from_cache: false,
          calculation_version: '2.0.0',
          ranking_version: 'borda-count-v1',
        },
      })

      expect(mockSnapshotStore.getLatestSuccessful).toHaveBeenCalledOnce()
      expect(mockSnapshotStore.readAllDistrictsRankings).toHaveBeenCalledWith(
        '2025-01-07'
      )
    })

    it('should include correct metadata indicating data source', async () => {
      // Mock: Snapshot and rankings file both exist
      mockSnapshotStore.getLatestSuccessful.mockResolvedValue(mockSnapshot)
      mockSnapshotStore.readAllDistrictsRankings.mockResolvedValue(
        mockRankingsData
      )

      const response = await request(app)
        .get('/api/districts/rankings')
        .expect(200)

      // Verify metadata indicates data source
      expect(response.body._snapshot_metadata).toBeDefined()
      expect(response.body._snapshot_metadata.data_source).toBe(
        'all-districts-rankings-file'
      )
      expect(response.body._snapshot_metadata.snapshot_id).toBe('2025-01-07')
      expect(response.body._snapshot_metadata.from_cache).toBe(false)
      expect(response.body._snapshot_metadata.calculation_version).toBe('2.0.0')
      expect(response.body._snapshot_metadata.ranking_version).toBe(
        'borda-count-v1'
      )
    })

    it('should return all districts from rankings file', async () => {
      // Mock: Snapshot and rankings file both exist
      mockSnapshotStore.getLatestSuccessful.mockResolvedValue(mockSnapshot)
      mockSnapshotStore.readAllDistrictsRankings.mockResolvedValue(
        mockRankingsData
      )

      const response = await request(app)
        .get('/api/districts/rankings')
        .expect(200)

      // Verify all districts are returned
      expect(response.body.rankings).toHaveLength(3)
      expect(response.body.rankings[0].districtId).toBe('42')
      expect(response.body.rankings[1].districtId).toBe('15')
      expect(response.body.rankings[2].districtId).toBe('F')

      // Verify ranking data structure
      const firstRanking = response.body.rankings[0]
      expect(firstRanking).toHaveProperty('districtId')
      expect(firstRanking).toHaveProperty('districtName')
      expect(firstRanking).toHaveProperty('region')
      expect(firstRanking).toHaveProperty('paidClubs')
      expect(firstRanking).toHaveProperty('clubsRank')
      expect(firstRanking).toHaveProperty('paymentsRank')
      expect(firstRanking).toHaveProperty('distinguishedRank')
      expect(firstRanking).toHaveProperty('aggregateScore')
    })

    it('should handle cached data correctly', async () => {
      // Mock: Rankings data from cache
      const cachedRankingsData: AllDistrictsRankingsData = {
        ...mockRankingsData,
        metadata: {
          ...mockRankingsData.metadata,
          fromCache: true,
        },
      }

      mockSnapshotStore.getLatestSuccessful.mockResolvedValue(mockSnapshot)
      mockSnapshotStore.readAllDistrictsRankings.mockResolvedValue(
        cachedRankingsData
      )

      const response = await request(app)
        .get('/api/districts/rankings')
        .expect(200)

      // Verify from_cache flag is set correctly
      expect(response.body._snapshot_metadata.from_cache).toBe(true)
    })

    it('should return 500 on unexpected error', async () => {
      // Mock: Unexpected error during processing
      mockSnapshotStore.getLatestSuccessful.mockRejectedValue(
        new Error('Database connection failed')
      )

      const response = await request(app)
        .get('/api/districts/rankings')
        .expect(500)

      expect(response.body.error).toBeDefined()
      expect(response.body.error.code).toBe('RANKINGS_ERROR')
      expect(response.body.error.message).toBe(
        'Failed to fetch district rankings'
      )
      expect(response.body.error.details).toBe('Database connection failed')
    })
  })

  describe('GET /api/districts/rankings with date parameter', () => {
    it('should return rankings for a specific historical date', async () => {
      // Mock: Historical snapshot exists
      mockSnapshotStore.getSnapshot.mockResolvedValue(mockHistoricalSnapshot)
      mockSnapshotStore.readAllDistrictsRankings.mockResolvedValue(
        mockHistoricalRankingsData
      )

      const response = await request(app)
        .get('/api/districts/rankings?date=2025-01-01')
        .expect(200)

      expect(response.body.date).toBe('2025-01-01')
      expect(response.body._snapshot_metadata.snapshot_id).toBe('2025-01-01')
      expect(response.body.rankings).toHaveLength(1)
      expect(response.body.rankings[0].paidClubs).toBe(240) // Historical value

      // Should use getSnapshot, not getLatestSuccessful
      expect(mockSnapshotStore.getSnapshot).toHaveBeenCalledWith('2025-01-01')
      expect(mockSnapshotStore.getLatestSuccessful).not.toHaveBeenCalled()
      expect(mockSnapshotStore.readAllDistrictsRankings).toHaveBeenCalledWith(
        '2025-01-01'
      )
    })

    it('should return 404 when requested date has no snapshot', async () => {
      // Mock: No snapshot for requested date
      mockSnapshotStore.getSnapshot.mockResolvedValue(null)

      const response = await request(app)
        .get('/api/districts/rankings?date=2024-12-25')
        .expect(404)

      expect(response.body).toEqual({
        error: {
          code: 'SNAPSHOT_NOT_FOUND',
          message: 'No snapshot available for date 2024-12-25',
          details: 'The requested date does not have cached data',
        },
      })

      expect(mockSnapshotStore.getSnapshot).toHaveBeenCalledWith('2024-12-25')
      expect(mockSnapshotStore.getLatestSuccessful).not.toHaveBeenCalled()
    })

    it('should return 400 for invalid date format', async () => {
      const response = await request(app)
        .get('/api/districts/rankings?date=01-07-2025')
        .expect(400)

      expect(response.body).toEqual({
        error: {
          code: 'INVALID_DATE_FORMAT',
          message: 'Date must be in YYYY-MM-DD format',
          details: 'Received: 01-07-2025',
        },
      })

      // Should not call any snapshot methods
      expect(mockSnapshotStore.getSnapshot).not.toHaveBeenCalled()
      expect(mockSnapshotStore.getLatestSuccessful).not.toHaveBeenCalled()
    })

    it('should return 400 for malformed date string', async () => {
      const response = await request(app)
        .get('/api/districts/rankings?date=not-a-date')
        .expect(400)

      expect(response.body.error.code).toBe('INVALID_DATE_FORMAT')
    })

    it('should use latest snapshot when no date parameter provided', async () => {
      // Mock: Latest snapshot exists
      mockSnapshotStore.getLatestSuccessful.mockResolvedValue(mockSnapshot)
      mockSnapshotStore.readAllDistrictsRankings.mockResolvedValue(
        mockRankingsData
      )

      const response = await request(app)
        .get('/api/districts/rankings')
        .expect(200)

      expect(response.body.date).toBe('2025-01-07')
      expect(response.body._snapshot_metadata.snapshot_id).toBe('2025-01-07')

      // Should use getLatestSuccessful, not getSnapshot
      expect(mockSnapshotStore.getLatestSuccessful).toHaveBeenCalledOnce()
      expect(mockSnapshotStore.getSnapshot).not.toHaveBeenCalled()
    })

    it('should return 500 when historical snapshot has no rankings file', async () => {
      // Mock: Historical snapshot exists but rankings file is missing
      mockSnapshotStore.getSnapshot.mockResolvedValue(mockHistoricalSnapshot)
      mockSnapshotStore.readAllDistrictsRankings.mockResolvedValue(null)

      const response = await request(app)
        .get('/api/districts/rankings?date=2025-01-01')
        .expect(500)

      expect(response.body.error.code).toBe('RANKINGS_DATA_NOT_FOUND')
    })
  })
})
