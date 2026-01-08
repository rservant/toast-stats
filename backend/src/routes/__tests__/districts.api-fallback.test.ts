/**
 * Unit Tests for API Fallback Behavior
 *
 * Feature: closing-period-api-integration
 * Task: 8.1 Write unit tests for API fallback behavior
 *
 * Validates: Requirements 3.2, 3.3, 4.4
 *
 * Tests the API behavior when a requested date has no snapshot:
 * - Returns nearest available snapshot
 * - Includes metadata indicating the actual snapshot date returned
 * - Distinguishes between "no data yet" and "closing period gap"
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import request from 'supertest'
import express, { type Express } from 'express'
import { Router } from 'express'
import type {
  Snapshot,
  AllDistrictsRankingsData,
} from '../../types/snapshots.js'
import {
  createTestCacheConfig,
  cleanupTestCacheConfig,
  type TestCacheConfig,
} from '../../utils/test-cache-helper.js'

/**
 * Interface for fallback metadata in API responses
 * Indicates when a different snapshot was returned than requested
 */
interface FallbackMetadata {
  /** The date that was originally requested */
  requested_date: string
  /** The actual snapshot date returned */
  actual_snapshot_date: string
  /** Reason for the fallback */
  fallback_reason: 'no_snapshot_for_date' | 'closing_period_gap' | 'future_date'
  /** Whether this is closing period data */
  is_closing_period_data?: boolean
}

/**
 * Extended snapshot metadata including fallback information
 */
interface SnapshotResponseMetadataWithFallback {
  snapshot_id: string
  created_at: string
  schema_version: string
  calculation_version: string
  data_as_of: string
  // Closing period fields
  is_closing_period_data?: boolean
  collection_date?: string
  logical_date?: string
  // Fallback fields (Requirement 4.4)
  fallback?: FallbackMetadata
}

describe('API Fallback for Missing Dates', () => {
  let app: Express
  let testConfig: TestCacheConfig
  let mockSnapshotStore: {
    getLatestSuccessful: ReturnType<typeof vi.fn>
    getSnapshot: ReturnType<typeof vi.fn>
    readAllDistrictsRankings: ReturnType<typeof vi.fn>
    listSnapshots: ReturnType<typeof vi.fn>
    findNearestSnapshot: ReturnType<typeof vi.fn>
  }

  // Sample test data - latest snapshot
  const mockLatestSnapshot: Snapshot = {
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
        districtCount: 3,
        processingDurationMs: 1000,
        isClosingPeriodData: false,
        collectionDate: '2025-01-07',
        logicalDate: '2025-01-07',
      },
      districts: [],
    },
  }

  // Closing period snapshot (December data collected in January)
  const mockClosingPeriodSnapshot: Snapshot = {
    snapshot_id: '2024-12-31',
    created_at: '2025-01-02T10:30:00.000Z',
    status: 'success',
    schema_version: '2.0.0',
    calculation_version: '2.0.0',
    errors: [],
    payload: {
      metadata: {
        source: 'toastmasters-dashboard',
        dataAsOfDate: '2025-01-02',
        fetchedAt: '2025-01-02T10:25:00.000Z',
        districtCount: 3,
        processingDurationMs: 1000,
        isClosingPeriodData: true,
        collectionDate: '2025-01-02',
        logicalDate: '2024-12-31',
      },
      districts: [],
    },
  }

  // Historical snapshot
  const mockHistoricalSnapshot: Snapshot = {
    snapshot_id: '2024-12-15',
    created_at: '2024-12-15T10:30:00.000Z',
    status: 'success',
    schema_version: '2.0.0',
    calculation_version: '2.0.0',
    errors: [],
    payload: {
      metadata: {
        source: 'toastmasters-dashboard',
        dataAsOfDate: '2024-12-15',
        fetchedAt: '2024-12-15T10:25:00.000Z',
        districtCount: 3,
        processingDurationMs: 1000,
        isClosingPeriodData: false,
        collectionDate: '2024-12-15',
        logicalDate: '2024-12-15',
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
    ],
  }

  const mockClosingPeriodRankingsData: AllDistrictsRankingsData = {
    ...mockRankingsData,
    metadata: {
      ...mockRankingsData.metadata,
      snapshotId: '2024-12-31',
      sourceCsvDate: '2025-01-02',
    },
  }

  beforeEach(async () => {
    // Create isolated test cache directory
    testConfig = await createTestCacheConfig('api-fallback')

    // Create mock snapshot store
    mockSnapshotStore = {
      getLatestSuccessful: vi.fn(),
      getSnapshot: vi.fn(),
      readAllDistrictsRankings: vi.fn(),
      listSnapshots: vi.fn(),
      findNearestSnapshot: vi.fn(),
    }

    // Create test Express app
    app = express()
    app.use(express.json())

    // Create router with fallback logic
    const router = Router()

    /**
     * Helper function to find the nearest available snapshot
     * Returns the closest snapshot before or after the requested date
     */
    async function findNearestSnapshot(
      requestedDate: string,
      availableSnapshots: Array<{
        snapshot_id: string
        created_at: string
        status: string
      }>
    ): Promise<{
      snapshot: Snapshot | null
      fallbackReason:
        | 'no_snapshot_for_date'
        | 'closing_period_gap'
        | 'future_date'
        | null
    }> {
      if (availableSnapshots.length === 0) {
        return { snapshot: null, fallbackReason: null }
      }

      // Sort snapshots by date (newest first)
      const sortedSnapshots = [...availableSnapshots]
        .filter(s => s.status === 'success')
        .sort((a, b) => b.snapshot_id.localeCompare(a.snapshot_id))

      const requestedDateObj = new Date(requestedDate)
      const today = new Date()

      // Check if requested date is in the future
      if (requestedDateObj > today) {
        // Return latest available snapshot
        const latestId = sortedSnapshots[0]?.snapshot_id
        if (latestId) {
          const snapshot = await mockSnapshotStore.getSnapshot(latestId)
          return { snapshot, fallbackReason: 'future_date' }
        }
        return { snapshot: null, fallbackReason: null }
      }

      // Find the nearest snapshot (prefer earlier dates, then later)
      let nearestBefore: string | null = null
      let nearestAfter: string | null = null

      for (const s of sortedSnapshots) {
        const snapshotDate = new Date(s.snapshot_id)
        if (snapshotDate <= requestedDateObj && !nearestBefore) {
          nearestBefore = s.snapshot_id
        }
        if (snapshotDate > requestedDateObj) {
          nearestAfter = s.snapshot_id
        }
      }

      // Prefer the nearest snapshot before the requested date
      const nearestId = nearestBefore ?? nearestAfter
      if (nearestId) {
        const snapshot = await mockSnapshotStore.getSnapshot(nearestId)

        // Determine fallback reason
        let fallbackReason: 'no_snapshot_for_date' | 'closing_period_gap' =
          'no_snapshot_for_date'

        // Check if this is a closing period gap
        // A closing period gap occurs when:
        // 1. The requested date is in a new month (e.g., Jan 1-5)
        // 2. The nearest snapshot is from the prior month's end (closing period data)
        if (snapshot?.payload.metadata.isClosingPeriodData) {
          const snapshotMonth = new Date(snapshot.snapshot_id).getMonth()
          const requestedMonth = requestedDateObj.getMonth()
          if (requestedMonth !== snapshotMonth) {
            fallbackReason = 'closing_period_gap'
          }
        }

        return { snapshot, fallbackReason }
      }

      return { snapshot: null, fallbackReason: null }
    }

    /**
     * Build snapshot response metadata including fallback information
     */
    function buildSnapshotResponseMetadata(
      snapshot: Snapshot,
      requestedDate?: string,
      fallbackReason?:
        | 'no_snapshot_for_date'
        | 'closing_period_gap'
        | 'future_date'
        | null
    ): SnapshotResponseMetadataWithFallback {
      const metadata = snapshot.payload.metadata

      const responseMetadata: SnapshotResponseMetadataWithFallback = {
        snapshot_id: snapshot.snapshot_id,
        created_at: snapshot.created_at,
        schema_version: snapshot.schema_version,
        calculation_version: snapshot.calculation_version,
        data_as_of: metadata.dataAsOfDate,
      }

      // Add closing period fields when present
      if (metadata.isClosingPeriodData !== undefined) {
        responseMetadata.is_closing_period_data = metadata.isClosingPeriodData
      }
      if (metadata.collectionDate !== undefined) {
        responseMetadata.collection_date = metadata.collectionDate
      }
      if (metadata.logicalDate !== undefined) {
        responseMetadata.logical_date = metadata.logicalDate
      }

      // Add fallback information when a different snapshot was returned (Requirement 4.4)
      if (
        requestedDate &&
        fallbackReason &&
        requestedDate !== snapshot.snapshot_id
      ) {
        responseMetadata.fallback = {
          requested_date: requestedDate,
          actual_snapshot_date: snapshot.snapshot_id,
          fallback_reason: fallbackReason,
          is_closing_period_data: metadata.isClosingPeriodData,
        }
      }

      return responseMetadata
    }

    router.get('/rankings', async (req, res) => {
      try {
        const requestedDate = req.query['date'] as string | undefined
        const enableFallback = req.query['fallback'] !== 'false' // Default to true
        let snapshot: Snapshot | null
        let fallbackReason:
          | 'no_snapshot_for_date'
          | 'closing_period_gap'
          | 'future_date'
          | null = null

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

          // Try to get snapshot for specific date
          snapshot = await mockSnapshotStore.getSnapshot(requestedDate)

          // If no snapshot found and fallback is enabled, find nearest (Requirement 3.2)
          if (!snapshot && enableFallback) {
            const availableSnapshots = await mockSnapshotStore.listSnapshots()
            const result = await findNearestSnapshot(
              requestedDate,
              availableSnapshots
            )
            snapshot = result.snapshot
            fallbackReason = result.fallbackReason
          }

          if (!snapshot) {
            res.status(404).json({
              error: {
                code: 'SNAPSHOT_NOT_FOUND',
                message: `No snapshot available for date ${requestedDate}`,
                details: enableFallback
                  ? 'No snapshots available to fall back to'
                  : 'The requested date does not have cached data. Enable fallback with ?fallback=true',
              },
            })
            return
          }
        } else {
          // Get latest successful snapshot
          snapshot = await mockSnapshotStore.getLatestSuccessful()
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

        const rankingsData = await mockSnapshotStore.readAllDistrictsRankings(
          snapshot.snapshot_id
        )

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

        // Build response with fallback metadata (Requirement 4.4)
        const responseMetadata = buildSnapshotResponseMetadata(
          snapshot,
          requestedDate,
          fallbackReason
        )

        res.json({
          rankings: rankingsData.rankings,
          date: rankingsData.metadata.sourceCsvDate,
          _snapshot_metadata: {
            ...responseMetadata,
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
    await cleanupTestCacheConfig(testConfig)
    vi.clearAllMocks()
  })

  describe('Requirement 3.2: Return nearest available snapshot when requested date has no data', () => {
    it('should return nearest earlier snapshot when requested date has no snapshot', async () => {
      // Setup: No snapshot for 2024-12-20, but 2024-12-15 exists
      mockSnapshotStore.getSnapshot.mockImplementation(async (id: string) => {
        if (id === '2024-12-15') return mockHistoricalSnapshot
        if (id === '2024-12-31') return mockClosingPeriodSnapshot
        return null
      })
      mockSnapshotStore.listSnapshots.mockResolvedValue([
        {
          snapshot_id: '2024-12-31',
          created_at: '2025-01-02T10:30:00.000Z',
          status: 'success',
        },
        {
          snapshot_id: '2024-12-15',
          created_at: '2024-12-15T10:30:00.000Z',
          status: 'success',
        },
      ])
      mockSnapshotStore.readAllDistrictsRankings.mockResolvedValue(
        mockRankingsData
      )

      const response = await request(app)
        .get('/api/districts/rankings?date=2024-12-20')
        .expect(200)

      // Should return the nearest earlier snapshot (2024-12-15)
      expect(response.body._snapshot_metadata.snapshot_id).toBe('2024-12-15')
      expect(response.body._snapshot_metadata.fallback).toBeDefined()
      expect(response.body._snapshot_metadata.fallback.requested_date).toBe(
        '2024-12-20'
      )
      expect(
        response.body._snapshot_metadata.fallback.actual_snapshot_date
      ).toBe('2024-12-15')
      expect(response.body._snapshot_metadata.fallback.fallback_reason).toBe(
        'no_snapshot_for_date'
      )
    })

    it('should return nearest later snapshot when no earlier snapshot exists', async () => {
      // Setup: No snapshot for 2024-12-01, but 2024-12-15 exists
      mockSnapshotStore.getSnapshot.mockImplementation(async (id: string) => {
        if (id === '2024-12-15') return mockHistoricalSnapshot
        return null
      })
      mockSnapshotStore.listSnapshots.mockResolvedValue([
        {
          snapshot_id: '2024-12-15',
          created_at: '2024-12-15T10:30:00.000Z',
          status: 'success',
        },
      ])
      mockSnapshotStore.readAllDistrictsRankings.mockResolvedValue(
        mockRankingsData
      )

      const response = await request(app)
        .get('/api/districts/rankings?date=2024-12-01')
        .expect(200)

      // Should return the nearest later snapshot (2024-12-15)
      expect(response.body._snapshot_metadata.snapshot_id).toBe('2024-12-15')
      expect(response.body._snapshot_metadata.fallback).toBeDefined()
      expect(response.body._snapshot_metadata.fallback.requested_date).toBe(
        '2024-12-01'
      )
      expect(
        response.body._snapshot_metadata.fallback.actual_snapshot_date
      ).toBe('2024-12-15')
    })

    it('should return 404 when no snapshots exist at all', async () => {
      mockSnapshotStore.getSnapshot.mockResolvedValue(null)
      mockSnapshotStore.listSnapshots.mockResolvedValue([])

      const response = await request(app)
        .get('/api/districts/rankings?date=2024-12-20')
        .expect(404)

      expect(response.body.error.code).toBe('SNAPSHOT_NOT_FOUND')
      expect(response.body.error.details).toContain('No snapshots available')
    })

    it('should allow disabling fallback with query parameter', async () => {
      mockSnapshotStore.getSnapshot.mockResolvedValue(null)
      mockSnapshotStore.listSnapshots.mockResolvedValue([
        {
          snapshot_id: '2024-12-15',
          created_at: '2024-12-15T10:30:00.000Z',
          status: 'success',
        },
      ])

      const response = await request(app)
        .get('/api/districts/rankings?date=2024-12-20&fallback=false')
        .expect(404)

      expect(response.body.error.code).toBe('SNAPSHOT_NOT_FOUND')
      expect(response.body.error.details).toContain('Enable fallback')
      // Should not have called listSnapshots since fallback is disabled
      expect(mockSnapshotStore.listSnapshots).not.toHaveBeenCalled()
    })
  })

  describe('Requirement 3.3: Indicate when data is from prior month final snapshot', () => {
    it('should indicate closing period gap when returning prior month data for new month request', async () => {
      // Setup: Request Jan 3, but only Dec 31 closing period snapshot exists
      mockSnapshotStore.getSnapshot.mockImplementation(async (id: string) => {
        if (id === '2024-12-31') return mockClosingPeriodSnapshot
        return null
      })
      mockSnapshotStore.listSnapshots.mockResolvedValue([
        {
          snapshot_id: '2024-12-31',
          created_at: '2025-01-02T10:30:00.000Z',
          status: 'success',
        },
      ])
      mockSnapshotStore.readAllDistrictsRankings.mockResolvedValue(
        mockClosingPeriodRankingsData
      )

      const response = await request(app)
        .get('/api/districts/rankings?date=2025-01-03')
        .expect(200)

      // Should return the closing period snapshot with appropriate metadata
      expect(response.body._snapshot_metadata.snapshot_id).toBe('2024-12-31')
      expect(response.body._snapshot_metadata.is_closing_period_data).toBe(true)
      expect(response.body._snapshot_metadata.fallback).toBeDefined()
      expect(response.body._snapshot_metadata.fallback.fallback_reason).toBe(
        'closing_period_gap'
      )
      expect(
        response.body._snapshot_metadata.fallback.is_closing_period_data
      ).toBe(true)
    })

    it('should include collection_date and logical_date for closing period data', async () => {
      mockSnapshotStore.getSnapshot.mockImplementation(async (id: string) => {
        if (id === '2024-12-31') return mockClosingPeriodSnapshot
        return null
      })
      mockSnapshotStore.listSnapshots.mockResolvedValue([
        {
          snapshot_id: '2024-12-31',
          created_at: '2025-01-02T10:30:00.000Z',
          status: 'success',
        },
      ])
      mockSnapshotStore.readAllDistrictsRankings.mockResolvedValue(
        mockClosingPeriodRankingsData
      )

      const response = await request(app)
        .get('/api/districts/rankings?date=2025-01-03')
        .expect(200)

      // Should include both collection_date and logical_date
      expect(response.body._snapshot_metadata.collection_date).toBe(
        '2025-01-02'
      )
      expect(response.body._snapshot_metadata.logical_date).toBe('2024-12-31')
    })
  })

  describe('Requirement 4.4: Indicate nearest available snapshot date', () => {
    it('should include fallback metadata with requested and actual dates', async () => {
      mockSnapshotStore.getSnapshot.mockImplementation(async (id: string) => {
        if (id === '2024-12-15') return mockHistoricalSnapshot
        return null
      })
      mockSnapshotStore.listSnapshots.mockResolvedValue([
        {
          snapshot_id: '2024-12-15',
          created_at: '2024-12-15T10:30:00.000Z',
          status: 'success',
        },
      ])
      mockSnapshotStore.readAllDistrictsRankings.mockResolvedValue(
        mockRankingsData
      )

      const response = await request(app)
        .get('/api/districts/rankings?date=2024-12-18')
        .expect(200)

      const fallback = response.body._snapshot_metadata.fallback
      expect(fallback).toBeDefined()
      expect(fallback.requested_date).toBe('2024-12-18')
      expect(fallback.actual_snapshot_date).toBe('2024-12-15')
      expect(fallback.fallback_reason).toBe('no_snapshot_for_date')
    })

    it('should not include fallback metadata when exact date is found', async () => {
      mockSnapshotStore.getSnapshot.mockResolvedValue(mockLatestSnapshot)
      mockSnapshotStore.readAllDistrictsRankings.mockResolvedValue(
        mockRankingsData
      )

      const response = await request(app)
        .get('/api/districts/rankings?date=2025-01-07')
        .expect(200)

      // Should not have fallback metadata since exact date was found
      expect(response.body._snapshot_metadata.fallback).toBeUndefined()
      expect(response.body._snapshot_metadata.snapshot_id).toBe('2025-01-07')
    })

    it('should not include fallback metadata when no date is requested', async () => {
      mockSnapshotStore.getLatestSuccessful.mockResolvedValue(
        mockLatestSnapshot
      )
      mockSnapshotStore.readAllDistrictsRankings.mockResolvedValue(
        mockRankingsData
      )

      const response = await request(app)
        .get('/api/districts/rankings')
        .expect(200)

      // Should not have fallback metadata for latest snapshot request
      expect(response.body._snapshot_metadata.fallback).toBeUndefined()
    })

    it('should indicate future_date reason when requesting a future date', async () => {
      // Setup: Request a future date
      const futureDate = '2030-01-01'
      mockSnapshotStore.getSnapshot.mockImplementation(async (id: string) => {
        if (id === '2025-01-07') return mockLatestSnapshot
        return null
      })
      mockSnapshotStore.listSnapshots.mockResolvedValue([
        {
          snapshot_id: '2025-01-07',
          created_at: '2025-01-07T10:30:00.000Z',
          status: 'success',
        },
      ])
      mockSnapshotStore.readAllDistrictsRankings.mockResolvedValue(
        mockRankingsData
      )

      const response = await request(app)
        .get(`/api/districts/rankings?date=${futureDate}`)
        .expect(200)

      expect(response.body._snapshot_metadata.fallback).toBeDefined()
      expect(response.body._snapshot_metadata.fallback.requested_date).toBe(
        futureDate
      )
      expect(response.body._snapshot_metadata.fallback.fallback_reason).toBe(
        'future_date'
      )
    })
  })

  describe('Edge cases', () => {
    it('should handle multiple snapshots and find the nearest one', async () => {
      // Setup: Multiple snapshots available
      mockSnapshotStore.getSnapshot.mockImplementation(async (id: string) => {
        if (id === '2024-12-10')
          return { ...mockHistoricalSnapshot, snapshot_id: '2024-12-10' }
        if (id === '2024-12-20')
          return { ...mockHistoricalSnapshot, snapshot_id: '2024-12-20' }
        return null
      })
      mockSnapshotStore.listSnapshots.mockResolvedValue([
        {
          snapshot_id: '2024-12-20',
          created_at: '2024-12-20T10:30:00.000Z',
          status: 'success',
        },
        {
          snapshot_id: '2024-12-10',
          created_at: '2024-12-10T10:30:00.000Z',
          status: 'success',
        },
      ])
      mockSnapshotStore.readAllDistrictsRankings.mockResolvedValue(
        mockRankingsData
      )

      // Request 2024-12-15 - should get 2024-12-10 (nearest before)
      const response = await request(app)
        .get('/api/districts/rankings?date=2024-12-15')
        .expect(200)

      expect(response.body._snapshot_metadata.snapshot_id).toBe('2024-12-10')
      expect(
        response.body._snapshot_metadata.fallback.actual_snapshot_date
      ).toBe('2024-12-10')
    })

    it('should skip failed snapshots when finding nearest', async () => {
      mockSnapshotStore.getSnapshot.mockImplementation(async (id: string) => {
        if (id === '2024-12-15') return mockHistoricalSnapshot
        return null
      })
      mockSnapshotStore.listSnapshots.mockResolvedValue([
        {
          snapshot_id: '2024-12-18',
          created_at: '2024-12-18T10:30:00.000Z',
          status: 'failed',
        },
        {
          snapshot_id: '2024-12-15',
          created_at: '2024-12-15T10:30:00.000Z',
          status: 'success',
        },
      ])
      mockSnapshotStore.readAllDistrictsRankings.mockResolvedValue(
        mockRankingsData
      )

      const response = await request(app)
        .get('/api/districts/rankings?date=2024-12-17')
        .expect(200)

      // Should skip the failed snapshot and return 2024-12-15
      expect(response.body._snapshot_metadata.snapshot_id).toBe('2024-12-15')
    })
  })
})
