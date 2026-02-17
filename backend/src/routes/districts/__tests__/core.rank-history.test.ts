/**
 * Unit Tests for Backend overallRank in Rank History Endpoint
 *
 * Tests the overallRank field in the rank-history endpoint:
 * - Requirement 17.3: Route SHALL NOT compute overallRank by sorting rankings
 * - Requirement 17.4: overallRank SHALL be pre-computed and stored in rankings files
 *
 * The overallRank is now read directly from pre-computed rankings data,
 * not computed on-demand by sorting.
 *
 * Test Isolation:
 * - Each test uses a fresh Express app instance
 * - Cache is cleared before each test to prevent cross-test pollution
 * - Uses mocked snapshot store to control test data
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

// Define types for mock data
interface MockDistrictRanking {
  districtId: string
  districtName: string
  aggregateScore: number
  clubsRank: number
  paymentsRank: number
  distinguishedRank: number
  overallRank: number // Pre-computed overall rank (Requirement 17.4)
}

interface MockRankingsData {
  rankings: MockDistrictRanking[]
  metadata: {
    sourceCsvDate: string
    totalDistricts: number
    fromCache: boolean
    calculationVersion: string
    rankingVersion: string
  }
}

interface MockSnapshot {
  snapshot_id: string
  status: string
  created_at: string
}

// Mock data for testing
const createMockRankingsData = (
  rankings: MockDistrictRanking[],
  date: string
): MockRankingsData => ({
  rankings,
  metadata: {
    sourceCsvDate: date,
    totalDistricts: rankings.length,
    fromCache: false,
    calculationVersion: '1.0.0',
    rankingVersion: '1.0.0',
  },
})

// Mock the shared module to control snapshot behavior
vi.mock('../shared.js', async importOriginal => {
  const original = await importOriginal<typeof import('../shared.js')>()

  // Create mock snapshot store with configurable data
  const mockSnapshots: MockSnapshot[] = []
  let mockRankingsDataBySnapshot: Map<string, MockRankingsData> = new Map()

  return {
    ...original,
    validateDistrictId: original.validateDistrictId,
    getValidDistrictId: original.getValidDistrictId,
    getProgramYearInfo: original.getProgramYearInfo,
    perDistrictSnapshotStore: {
      listSnapshots: vi.fn(async () => mockSnapshots),
      readAllDistrictsRankings: vi.fn(
        async (snapshotId: string) =>
          mockRankingsDataBySnapshot.get(snapshotId) ?? null
      ),
      getLatestSuccessful: vi.fn(async () => mockSnapshots[0] ?? null),
      getSnapshot: vi.fn(async (snapshotId: string) =>
        mockSnapshots.find(s => s.snapshot_id === snapshotId)
      ),
    },
    // Expose setters for test configuration
    __setMockSnapshots: (snapshots: MockSnapshot[]) => {
      mockSnapshots.length = 0
      mockSnapshots.push(...snapshots)
    },
    __setMockRankingsData: (data: Map<string, MockRankingsData>) => {
      mockRankingsDataBySnapshot = data
    },
    __clearMocks: () => {
      mockSnapshots.length = 0
      mockRankingsDataBySnapshot = new Map()
    },
  }
})

// Import after mocking
import districtRoutes from '../index.js'
import * as sharedModule from '../shared.js'

// Type assertion for mock helpers
const mockHelpers = sharedModule as typeof sharedModule & {
  __setMockSnapshots: (snapshots: MockSnapshot[]) => void
  __setMockRankingsData: (data: Map<string, MockRankingsData>) => void
  __clearMocks: () => void
}

describe('Rank History Endpoint - overallRank Read from Pre-computed Data', () => {
  let app: Express

  beforeAll(() => {
    app = express()
    app.use(express.json())
    app.use('/api/districts', districtRoutes)
  })

  beforeEach(() => {
    // Clear cache before each test to ensure test isolation
    cacheService.clear()
    // Clear mock data
    mockHelpers.__clearMocks()
  })

  afterAll(() => {
    // Final cleanup
    cacheService.clear()
    vi.restoreAllMocks()
  })

  /**
   * Test Suite: overallRank Read from Pre-computed Rankings
   * **Validates: Requirements 17.3, 17.4**
   *
   * Tests that overallRank is read directly from pre-computed rankings data,
   * not computed on-demand by sorting.
   */
  describe('overallRank Read from Pre-computed Rankings', () => {
    it('should read overallRank = 1 from pre-computed data for top-ranked district (Req 17.3, 17.4)', async () => {
      // Setup: Create rankings where district 101 has pre-computed overallRank = 1
      const rankings: MockDistrictRanking[] = [
        {
          districtId: '101',
          districtName: 'District 101',
          aggregateScore: 300,
          clubsRank: 1,
          paymentsRank: 1,
          distinguishedRank: 1,
          overallRank: 1, // Pre-computed
        },
        {
          districtId: '102',
          districtName: 'District 102',
          aggregateScore: 250,
          clubsRank: 2,
          paymentsRank: 2,
          distinguishedRank: 2,
          overallRank: 2, // Pre-computed
        },
        {
          districtId: '103',
          districtName: 'District 103',
          aggregateScore: 200,
          clubsRank: 3,
          paymentsRank: 3,
          distinguishedRank: 3,
          overallRank: 3, // Pre-computed
        },
      ]

      const snapshotId = '2024-01-15'
      mockHelpers.__setMockSnapshots([
        { snapshot_id: snapshotId, status: 'success', created_at: snapshotId },
      ])
      mockHelpers.__setMockRankingsData(
        new Map([[snapshotId, createMockRankingsData(rankings, snapshotId)]])
      )

      const response = await request(app).get(
        '/api/districts/101/rank-history?startDate=2024-01-01&endDate=2024-12-31'
      )

      expect(response.status).toBe(200)
      expect(response.body.history).toHaveLength(1)
      // Verify overallRank is read from pre-computed data, not computed
      expect(response.body.history[0].overallRank).toBe(1)
      expect(response.body.history[0].aggregateScore).toBe(300)
    })

    it('should read correct overallRank from pre-computed data for middle-ranked district (Req 17.3, 17.4)', async () => {
      // Setup: Create 10 districts where district 105 has pre-computed overallRank = 5
      const rankings: MockDistrictRanking[] = Array.from(
        { length: 10 },
        (_, i) => ({
          districtId: `${101 + i}`,
          districtName: `District ${101 + i}`,
          aggregateScore: 300 - i * 10, // 300, 290, 280, ..., 210
          clubsRank: i + 1,
          paymentsRank: i + 1,
          distinguishedRank: i + 1,
          overallRank: i + 1, // Pre-computed
        })
      )

      const snapshotId = '2024-01-15'
      mockHelpers.__setMockSnapshots([
        { snapshot_id: snapshotId, status: 'success', created_at: snapshotId },
      ])
      mockHelpers.__setMockRankingsData(
        new Map([[snapshotId, createMockRankingsData(rankings, snapshotId)]])
      )

      // District 105 has pre-computed overallRank = 5
      const response = await request(app).get(
        '/api/districts/105/rank-history?startDate=2024-01-01&endDate=2024-12-31'
      )

      expect(response.status).toBe(200)
      expect(response.body.history).toHaveLength(1)
      expect(response.body.history[0].overallRank).toBe(5)
      expect(response.body.history[0].aggregateScore).toBe(260)
    })

    it('should read overallRank = totalDistricts from pre-computed data for last-ranked district (Req 17.3, 17.4)', async () => {
      // Setup: Create rankings where district 103 has pre-computed overallRank = 3 (last)
      const rankings: MockDistrictRanking[] = [
        {
          districtId: '101',
          districtName: 'District 101',
          aggregateScore: 300,
          clubsRank: 1,
          paymentsRank: 1,
          distinguishedRank: 1,
          overallRank: 1,
        },
        {
          districtId: '102',
          districtName: 'District 102',
          aggregateScore: 250,
          clubsRank: 2,
          paymentsRank: 2,
          distinguishedRank: 2,
          overallRank: 2,
        },
        {
          districtId: '103',
          districtName: 'District 103',
          aggregateScore: 100,
          clubsRank: 3,
          paymentsRank: 3,
          distinguishedRank: 3,
          overallRank: 3, // Pre-computed as last
        },
      ]

      const snapshotId = '2024-01-15'
      mockHelpers.__setMockSnapshots([
        { snapshot_id: snapshotId, status: 'success', created_at: snapshotId },
      ])
      mockHelpers.__setMockRankingsData(
        new Map([[snapshotId, createMockRankingsData(rankings, snapshotId)]])
      )

      const response = await request(app).get(
        '/api/districts/103/rank-history?startDate=2024-01-01&endDate=2024-12-31'
      )

      expect(response.status).toBe(200)
      expect(response.body.history).toHaveLength(1)
      expect(response.body.history[0].overallRank).toBe(3) // totalDistricts = 3
      expect(response.body.history[0].totalDistricts).toBe(3)
      expect(response.body.history[0].aggregateScore).toBe(100)
    })

    it('should exclude district not found in snapshot from history', async () => {
      // Setup: Create rankings that don't include district 999
      const rankings: MockDistrictRanking[] = [
        {
          districtId: '101',
          districtName: 'District 101',
          aggregateScore: 300,
          clubsRank: 1,
          paymentsRank: 1,
          distinguishedRank: 1,
          overallRank: 1,
        },
        {
          districtId: '102',
          districtName: 'District 102',
          aggregateScore: 250,
          clubsRank: 2,
          paymentsRank: 2,
          distinguishedRank: 2,
          overallRank: 2,
        },
      ]

      const snapshotId = '2024-01-15'
      mockHelpers.__setMockSnapshots([
        { snapshot_id: snapshotId, status: 'success', created_at: snapshotId },
      ])
      mockHelpers.__setMockRankingsData(
        new Map([[snapshotId, createMockRankingsData(rankings, snapshotId)]])
      )

      // Request rank history for a district that doesn't exist in the rankings
      const response = await request(app).get(
        '/api/districts/999/rank-history?startDate=2024-01-01&endDate=2024-12-31'
      )

      expect(response.status).toBe(200)
      expect(response.body.districtId).toBe('999')
      expect(response.body.districtName).toBe('District 999') // Default name
      expect(response.body.history).toHaveLength(0) // Empty history
    })
  })

  /**
   * Test Suite: overallRank Consistency Across Multiple Snapshots
   * **Validates: Requirements 17.3, 17.4**
   *
   * Tests that overallRank is correctly read from pre-computed data for each snapshot
   * when a district's position changes over time.
   */
  describe('overallRank Consistency Across Multiple Snapshots', () => {
    it('should read correct pre-computed overallRank for each snapshot when position changes (Req 17.3, 17.4)', async () => {
      // Setup: Create two snapshots where district 102 improves from rank 3 to rank 1
      const rankings1: MockDistrictRanking[] = [
        {
          districtId: '101',
          districtName: 'District 101',
          aggregateScore: 300,
          clubsRank: 1,
          paymentsRank: 1,
          distinguishedRank: 1,
          overallRank: 1,
        },
        {
          districtId: '103',
          districtName: 'District 103',
          aggregateScore: 250,
          clubsRank: 2,
          paymentsRank: 2,
          distinguishedRank: 2,
          overallRank: 2,
        },
        {
          districtId: '102',
          districtName: 'District 102',
          aggregateScore: 200, // Ranked 3rd
          clubsRank: 3,
          paymentsRank: 3,
          distinguishedRank: 3,
          overallRank: 3,
        },
      ]

      const rankings2: MockDistrictRanking[] = [
        {
          districtId: '102',
          districtName: 'District 102',
          aggregateScore: 350, // Now ranked 1st
          clubsRank: 1,
          paymentsRank: 1,
          distinguishedRank: 1,
          overallRank: 1,
        },
        {
          districtId: '101',
          districtName: 'District 101',
          aggregateScore: 300,
          clubsRank: 2,
          paymentsRank: 2,
          distinguishedRank: 2,
          overallRank: 2,
        },
        {
          districtId: '103',
          districtName: 'District 103',
          aggregateScore: 250,
          clubsRank: 3,
          paymentsRank: 3,
          distinguishedRank: 3,
          overallRank: 3,
        },
      ]

      const snapshotId1 = '2024-01-15'
      const snapshotId2 = '2024-02-15'

      mockHelpers.__setMockSnapshots([
        {
          snapshot_id: snapshotId2,
          status: 'success',
          created_at: snapshotId2,
        },
        {
          snapshot_id: snapshotId1,
          status: 'success',
          created_at: snapshotId1,
        },
      ])
      mockHelpers.__setMockRankingsData(
        new Map([
          [snapshotId1, createMockRankingsData(rankings1, snapshotId1)],
          [snapshotId2, createMockRankingsData(rankings2, snapshotId2)],
        ])
      )

      const response = await request(app).get(
        '/api/districts/102/rank-history?startDate=2024-01-01&endDate=2024-12-31'
      )

      expect(response.status).toBe(200)
      expect(response.body.history).toHaveLength(2)

      // History is sorted chronologically (oldest first)
      const [firstPoint, secondPoint] = response.body.history

      // First snapshot: district 102 was ranked 3rd
      expect(firstPoint.date).toBe('2024-01-15')
      expect(firstPoint.overallRank).toBe(3)
      expect(firstPoint.aggregateScore).toBe(200)

      // Second snapshot: district 102 improved to rank 1st
      expect(secondPoint.date).toBe('2024-02-15')
      expect(secondPoint.overallRank).toBe(1)
      expect(secondPoint.aggregateScore).toBe(350)
    })
  })

  /**
   * Test Suite: Response Structure Validation
   * **Validates: Requirements 17.3, 17.4**
   *
   * Tests that the API response includes the overallRank field
   * read from pre-computed data with the correct structure.
   */
  describe('Response Structure Validation', () => {
    it('should include overallRank field read from pre-computed data in each history entry (Req 17.3, 17.4)', async () => {
      const rankings: MockDistrictRanking[] = [
        {
          districtId: '101',
          districtName: 'District 101',
          aggregateScore: 300,
          clubsRank: 1,
          paymentsRank: 1,
          distinguishedRank: 1,
          overallRank: 1,
        },
      ]

      const snapshotId = '2024-01-15'
      mockHelpers.__setMockSnapshots([
        { snapshot_id: snapshotId, status: 'success', created_at: snapshotId },
      ])
      mockHelpers.__setMockRankingsData(
        new Map([[snapshotId, createMockRankingsData(rankings, snapshotId)]])
      )

      const response = await request(app).get(
        '/api/districts/101/rank-history?startDate=2024-01-01&endDate=2024-12-31'
      )

      expect(response.status).toBe(200)
      expect(response.body.history).toHaveLength(1)

      const historyEntry = response.body.history[0]

      // Verify all expected fields are present
      expect(historyEntry).toHaveProperty('date')
      expect(historyEntry).toHaveProperty('aggregateScore')
      expect(historyEntry).toHaveProperty('clubsRank')
      expect(historyEntry).toHaveProperty('paymentsRank')
      expect(historyEntry).toHaveProperty('distinguishedRank')
      expect(historyEntry).toHaveProperty('totalDistricts')
      expect(historyEntry).toHaveProperty('overallRank')

      // Verify overallRank is a positive integer
      expect(typeof historyEntry.overallRank).toBe('number')
      expect(historyEntry.overallRank).toBeGreaterThan(0)
      expect(Number.isInteger(historyEntry.overallRank)).toBe(true)
    })

    it('should return proper response structure with programYear info', async () => {
      const rankings: MockDistrictRanking[] = [
        {
          districtId: '101',
          districtName: 'District 101',
          aggregateScore: 300,
          clubsRank: 1,
          paymentsRank: 1,
          distinguishedRank: 1,
          overallRank: 1,
        },
      ]

      const snapshotId = '2024-01-15'
      mockHelpers.__setMockSnapshots([
        { snapshot_id: snapshotId, status: 'success', created_at: snapshotId },
      ])
      mockHelpers.__setMockRankingsData(
        new Map([[snapshotId, createMockRankingsData(rankings, snapshotId)]])
      )

      const response = await request(app).get(
        '/api/districts/101/rank-history?startDate=2024-01-01&endDate=2024-12-31'
      )

      expect(response.status).toBe(200)

      // Verify response structure
      expect(response.body).toHaveProperty('districtId', '101')
      expect(response.body).toHaveProperty('districtName', 'District 101')
      expect(response.body).toHaveProperty('history')
      expect(response.body).toHaveProperty('programYear')
      expect(Array.isArray(response.body.history)).toBe(true)
    })
  })

  /**
   * Test Suite: Edge Cases
   * **Validates: Requirements 17.3, 17.4**
   *
   * Tests edge cases for overallRank read from pre-computed data.
   */
  describe('Edge Cases', () => {
    it('should handle single district in rankings with pre-computed overallRank (Req 17.3, 17.4)', async () => {
      const rankings: MockDistrictRanking[] = [
        {
          districtId: '101',
          districtName: 'District 101',
          aggregateScore: 300,
          clubsRank: 1,
          paymentsRank: 1,
          distinguishedRank: 1,
          overallRank: 1,
        },
      ]

      const snapshotId = '2024-01-15'
      mockHelpers.__setMockSnapshots([
        { snapshot_id: snapshotId, status: 'success', created_at: snapshotId },
      ])
      mockHelpers.__setMockRankingsData(
        new Map([[snapshotId, createMockRankingsData(rankings, snapshotId)]])
      )

      const response = await request(app).get(
        '/api/districts/101/rank-history?startDate=2024-01-01&endDate=2024-12-31'
      )

      expect(response.status).toBe(200)
      expect(response.body.history).toHaveLength(1)
      expect(response.body.history[0].overallRank).toBe(1)
      expect(response.body.history[0].totalDistricts).toBe(1)
    })

    it('should return empty history when no snapshots are available', async () => {
      mockHelpers.__setMockSnapshots([])
      mockHelpers.__setMockRankingsData(new Map())

      const response = await request(app).get(
        '/api/districts/101/rank-history?startDate=2024-01-01&endDate=2024-12-31'
      )

      expect(response.status).toBe(200)
      expect(response.body.districtId).toBe('101')
      expect(response.body.history).toHaveLength(0)
    })

    it('should handle district with zero aggregate score and pre-computed overallRank (Req 17.3, 17.4)', async () => {
      const rankings: MockDistrictRanking[] = [
        {
          districtId: '101',
          districtName: 'District 101',
          aggregateScore: 100,
          clubsRank: 1,
          paymentsRank: 1,
          distinguishedRank: 1,
          overallRank: 1,
        },
        {
          districtId: '102',
          districtName: 'District 102',
          aggregateScore: 0, // Zero score
          clubsRank: 2,
          paymentsRank: 2,
          distinguishedRank: 2,
          overallRank: 2, // Pre-computed as last
        },
      ]

      const snapshotId = '2024-01-15'
      mockHelpers.__setMockSnapshots([
        { snapshot_id: snapshotId, status: 'success', created_at: snapshotId },
      ])
      mockHelpers.__setMockRankingsData(
        new Map([[snapshotId, createMockRankingsData(rankings, snapshotId)]])
      )

      const response = await request(app).get(
        '/api/districts/102/rank-history?startDate=2024-01-01&endDate=2024-12-31'
      )

      expect(response.status).toBe(200)
      expect(response.body.history).toHaveLength(1)
      expect(response.body.history[0].overallRank).toBe(2) // Last place
      expect(response.body.history[0].aggregateScore).toBe(0)
    })
  })
})
