/**
 * Unit tests for RankHistoryIndex (#115)
 *
 * Tests the in-memory index that caches rank history across all snapshots
 * for fast query serving.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  RankHistoryIndex,
  type RankHistorySnapshotStore,
} from '../RankHistoryIndex.js'

// ========== Test Factories ==========

function createMockStore(): RankHistorySnapshotStore {
  return {
    listSnapshotIds: vi.fn(),
    readAllDistrictsRankings: vi.fn(),
  }
}

function createRankingsData(
  snapshotDate: string,
  districts: Array<{
    districtId: string
    districtName: string
    aggregateScore: number
    overallRank: number
  }>
) {
  return {
    metadata: {
      sourceCsvDate: snapshotDate,
      totalDistricts: districts.length,
      calculatedAt: snapshotDate,
      version: '1.0',
    },
    rankings: districts.map(d => ({
      districtId: d.districtId,
      districtName: d.districtName,
      aggregateScore: d.aggregateScore,
      clubsRank: 1,
      paymentsRank: 2,
      distinguishedRank: 3,
      overallRank: d.overallRank,
    })),
  }
}

describe('RankHistoryIndex', () => {
  let mockStore: RankHistorySnapshotStore
  let index: RankHistoryIndex

  beforeEach(() => {
    mockStore = createMockStore()
    index = new RankHistoryIndex(mockStore, { cacheTtlMs: 60_000 })
    vi.clearAllMocks()
  })

  describe('getRankHistory', () => {
    it('should build index and return district history', async () => {
      const listSnapshotIds = mockStore.listSnapshotIds as ReturnType<
        typeof vi.fn
      >
      listSnapshotIds.mockResolvedValue(['2024-07-15', '2024-08-15'])

      const readRankings = mockStore.readAllDistrictsRankings as ReturnType<
        typeof vi.fn
      >
      readRankings
        .mockResolvedValueOnce(
          createRankingsData('2024-07-15', [
            {
              districtId: '57',
              districtName: 'District 57',
              aggregateScore: 350,
              overallRank: 5,
            },
          ])
        )
        .mockResolvedValueOnce(
          createRankingsData('2024-08-15', [
            {
              districtId: '57',
              districtName: 'District 57',
              aggregateScore: 360,
              overallRank: 4,
            },
          ])
        )

      const results = await index.getRankHistory(['57'])

      expect(results).toHaveLength(1)
      expect(results[0].districtId).toBe('57')
      expect(results[0].districtName).toBe('District 57')
      expect(results[0].history).toHaveLength(2)
      expect(results[0].history[0].date).toBe('2024-07-15')
      expect(results[0].history[1].date).toBe('2024-08-15')
    })

    it('should filter by date range', async () => {
      const listSnapshotIds = mockStore.listSnapshotIds as ReturnType<
        typeof vi.fn
      >
      listSnapshotIds.mockResolvedValue([
        '2024-07-15',
        '2024-08-15',
        '2024-09-15',
      ])

      const readRankings = mockStore.readAllDistrictsRankings as ReturnType<
        typeof vi.fn
      >
      readRankings
        .mockResolvedValueOnce(
          createRankingsData('2024-07-15', [
            {
              districtId: '57',
              districtName: 'District 57',
              aggregateScore: 350,
              overallRank: 5,
            },
          ])
        )
        .mockResolvedValueOnce(
          createRankingsData('2024-08-15', [
            {
              districtId: '57',
              districtName: 'District 57',
              aggregateScore: 360,
              overallRank: 4,
            },
          ])
        )
        .mockResolvedValueOnce(
          createRankingsData('2024-09-15', [
            {
              districtId: '57',
              districtName: 'District 57',
              aggregateScore: 370,
              overallRank: 3,
            },
          ])
        )

      // Only request Aug–Sep
      const results = await index.getRankHistory(
        ['57'],
        '2024-08-01',
        '2024-09-30'
      )

      expect(results[0].history).toHaveLength(2)
      expect(results[0].history[0].date).toBe('2024-08-15')
      expect(results[0].history[1].date).toBe('2024-09-15')
    })

    it('should return empty history for unknown districts', async () => {
      const listSnapshotIds = mockStore.listSnapshotIds as ReturnType<
        typeof vi.fn
      >
      listSnapshotIds.mockResolvedValue(['2024-07-15'])

      const readRankings = mockStore.readAllDistrictsRankings as ReturnType<
        typeof vi.fn
      >
      readRankings.mockResolvedValueOnce(
        createRankingsData('2024-07-15', [
          {
            districtId: '57',
            districtName: 'District 57',
            aggregateScore: 350,
            overallRank: 5,
          },
        ])
      )

      const results = await index.getRankHistory(['99'])

      expect(results).toHaveLength(1)
      expect(results[0].districtId).toBe('99')
      expect(results[0].history).toHaveLength(0)
    })

    it('should serve from cache on second call', async () => {
      const listSnapshotIds = mockStore.listSnapshotIds as ReturnType<
        typeof vi.fn
      >
      listSnapshotIds.mockResolvedValue(['2024-07-15'])

      const readRankings = mockStore.readAllDistrictsRankings as ReturnType<
        typeof vi.fn
      >
      readRankings.mockResolvedValueOnce(
        createRankingsData('2024-07-15', [
          {
            districtId: '57',
            districtName: 'District 57',
            aggregateScore: 350,
            overallRank: 5,
          },
        ])
      )

      // First call: builds index
      await index.getRankHistory(['57'])
      expect(listSnapshotIds).toHaveBeenCalledTimes(1)
      expect(readRankings).toHaveBeenCalledTimes(1)

      // Second call: should use cache (no additional GCS reads)
      const results = await index.getRankHistory(['57'])
      expect(listSnapshotIds).toHaveBeenCalledTimes(1) // NOT called again
      expect(readRankings).toHaveBeenCalledTimes(1) // NOT called again
      expect(results[0].history).toHaveLength(1)
    })

    it('should handle snapshot read errors gracefully', async () => {
      const listSnapshotIds = mockStore.listSnapshotIds as ReturnType<
        typeof vi.fn
      >
      listSnapshotIds.mockResolvedValue(['2024-07-15', '2024-08-15'])

      const readRankings = mockStore.readAllDistrictsRankings as ReturnType<
        typeof vi.fn
      >
      readRankings
        .mockRejectedValueOnce(new Error('GCS read failure'))
        .mockResolvedValueOnce(
          createRankingsData('2024-08-15', [
            {
              districtId: '57',
              districtName: 'District 57',
              aggregateScore: 360,
              overallRank: 4,
            },
          ])
        )

      const results = await index.getRankHistory(['57'])

      // Should still return data from the successful snapshot
      expect(results[0].history).toHaveLength(1)
      expect(results[0].history[0].date).toBe('2024-08-15')
    })

    it('should deduplicate by date', async () => {
      const listSnapshotIds = mockStore.listSnapshotIds as ReturnType<
        typeof vi.fn
      >
      // Two snapshots with the same source CSV date
      listSnapshotIds.mockResolvedValue(['2024-07-15', '2024-07-16'])

      const readRankings = mockStore.readAllDistrictsRankings as ReturnType<
        typeof vi.fn
      >
      readRankings
        .mockResolvedValueOnce(
          createRankingsData('2024-07-15', [
            {
              districtId: '57',
              districtName: 'District 57',
              aggregateScore: 350,
              overallRank: 5,
            },
          ])
        )
        .mockResolvedValueOnce(
          createRankingsData('2024-07-15', [
            // Same source CSV date!
            {
              districtId: '57',
              districtName: 'District 57',
              aggregateScore: 351,
              overallRank: 5,
            },
          ])
        )

      const results = await index.getRankHistory(['57'])

      // Should only have 1 entry (deduplicated by date)
      expect(results[0].history).toHaveLength(1)
    })
  })

  describe('invalidate', () => {
    it('should rebuild index after invalidation', async () => {
      const listSnapshotIds = mockStore.listSnapshotIds as ReturnType<
        typeof vi.fn
      >
      listSnapshotIds.mockResolvedValue(['2024-07-15'])

      const readRankings = mockStore.readAllDistrictsRankings as ReturnType<
        typeof vi.fn
      >
      readRankings.mockResolvedValue(
        createRankingsData('2024-07-15', [
          {
            districtId: '57',
            districtName: 'District 57',
            aggregateScore: 350,
            overallRank: 5,
          },
        ])
      )

      // Build initial index
      await index.getRankHistory(['57'])
      expect(listSnapshotIds).toHaveBeenCalledTimes(1)

      // Invalidate and request again
      index.invalidate()
      await index.getRankHistory(['57'])

      // Should have called listSnapshotIds again after invalidation
      expect(listSnapshotIds).toHaveBeenCalledTimes(2)
    })
  })

  describe('isLoaded', () => {
    it('should return false before first query', () => {
      expect(index.isLoaded()).toBe(false)
    })

    it('should return true after first query', async () => {
      const listSnapshotIds = mockStore.listSnapshotIds as ReturnType<
        typeof vi.fn
      >
      listSnapshotIds.mockResolvedValue([])

      await index.getRankHistory(['57'])
      expect(index.isLoaded()).toBe(true)
    })
  })
})
