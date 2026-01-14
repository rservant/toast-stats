/**
 * Unit tests for DistrictDataAggregator
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import {
  DistrictDataAggregator,
  createDistrictDataAggregator,
} from '../DistrictDataAggregator.js'
import { DistrictStatistics } from '../../types/districts.js'
import {
  PerDistrictSnapshotStoreInterface as PerDistrictSnapshotStore,
  SnapshotManifest,
} from '../SnapshotStore.js'

// Mock the logger
vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// Create a mock PerDistrictSnapshotStore
const createMockSnapshotStore = (): PerDistrictSnapshotStore => ({
  readDistrictData: vi.fn(),
  listDistrictsInSnapshot: vi.fn(),
  getSnapshotManifest: vi.fn(),
  writeDistrictData: vi.fn(),
  getSnapshotMetadata: vi.fn(),
})

// Sample test data
const createSampleDistrictData = (districtId: string): DistrictStatistics => ({
  districtId,
  asOfDate: '2024-01-04',
  membership: {
    total: 1000,
    change: 50,
    changePercent: 5.0,
    byClub: [],
  },
  clubs: {
    total: 50,
    active: 45,
    suspended: 3,
    ineligible: 2,
    low: 5,
    distinguished: 20,
  },
  education: {
    totalAwards: 100,
    byType: [],
    topClubs: [],
  },
})

const createSampleManifest = (districtIds: string[]): SnapshotManifest => ({
  snapshotId: 'test-snapshot',
  createdAt: '2024-01-04T12:00:00Z',
  districts: districtIds.map(id => ({
    districtId: id,
    fileName: `district_${id}.json`,
    status: 'success' as const,
    fileSize: 1024,
    lastModified: '2024-01-04T12:00:00Z',
  })),
  totalDistricts: districtIds.length,
  successfulDistricts: districtIds.length,
  failedDistricts: 0,
})

describe('DistrictDataAggregator', () => {
  let mockSnapshotStore: PerDistrictSnapshotStore
  let aggregator: DistrictDataAggregator

  beforeEach(() => {
    mockSnapshotStore = createMockSnapshotStore()
    aggregator = new DistrictDataAggregator(mockSnapshotStore, {
      maxCacheSize: 5,
      cacheExpirationMs: 1000,
      enableMetrics: true,
    })
  })

  describe('getDistrictData', () => {
    it('should return district data from storage', async () => {
      const districtData = createSampleDistrictData('42')
      ;(mockSnapshotStore.readDistrictData as Mock).mockResolvedValue(
        districtData
      )

      const result = await aggregator.getDistrictData('snapshot-1', '42')

      expect(result).toEqual(districtData)
      expect(mockSnapshotStore.readDistrictData).toHaveBeenCalledWith(
        'snapshot-1',
        '42'
      )
    })

    it('should return null when district data is not found', async () => {
      ;(mockSnapshotStore.readDistrictData as Mock).mockResolvedValue(null)

      const result = await aggregator.getDistrictData('snapshot-1', '42')

      expect(result).toBeNull()
      expect(mockSnapshotStore.readDistrictData).toHaveBeenCalledWith(
        'snapshot-1',
        '42'
      )
    })

    it('should cache district data for subsequent requests', async () => {
      const districtData = createSampleDistrictData('42')
      ;(mockSnapshotStore.readDistrictData as Mock).mockResolvedValue(
        districtData
      )

      // First request - should hit storage
      const result1 = await aggregator.getDistrictData('snapshot-1', '42')
      expect(result1).toEqual(districtData)
      expect(mockSnapshotStore.readDistrictData).toHaveBeenCalledTimes(1)

      // Second request - should hit cache
      const result2 = await aggregator.getDistrictData('snapshot-1', '42')
      expect(result2).toEqual(districtData)
      expect(mockSnapshotStore.readDistrictData).toHaveBeenCalledTimes(1) // No additional call
    })

    it('should handle storage errors gracefully', async () => {
      const error = new Error('Storage error')
      ;(mockSnapshotStore.readDistrictData as Mock).mockRejectedValue(error)

      await expect(
        aggregator.getDistrictData('snapshot-1', '42')
      ).rejects.toThrow('Failed to get district data for 42: Storage error')
    })
  })

  describe('getMultipleDistricts', () => {
    it('should return data for multiple districts', async () => {
      const district42 = createSampleDistrictData('42')
      const district15 = createSampleDistrictData('15')

      ;(mockSnapshotStore.readDistrictData as Mock)
        .mockResolvedValueOnce(district42)
        .mockResolvedValueOnce(district15)

      const result = await aggregator.getMultipleDistricts('snapshot-1', [
        '42',
        '15',
      ])

      expect(result).toHaveLength(2)
      expect(result).toContain(district42)
      expect(result).toContain(district15)
      expect(mockSnapshotStore.readDistrictData).toHaveBeenCalledTimes(2)
    })

    it('should filter out null results', async () => {
      const district42 = createSampleDistrictData('42')

      ;(mockSnapshotStore.readDistrictData as Mock)
        .mockResolvedValueOnce(district42)
        .mockResolvedValueOnce(null) // District not found

      const result = await aggregator.getMultipleDistricts('snapshot-1', [
        '42',
        '15',
      ])

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual(district42)
    })

    it('should handle empty district list', async () => {
      const result = await aggregator.getMultipleDistricts('snapshot-1', [])

      expect(result).toHaveLength(0)
      expect(mockSnapshotStore.readDistrictData).not.toHaveBeenCalled()
    })
  })

  describe('getAllDistricts', () => {
    it('should return all districts in a snapshot', async () => {
      const districtIds = ['42', '15', 'F']
      const districts = districtIds.map(createSampleDistrictData)

      ;(mockSnapshotStore.listDistrictsInSnapshot as Mock).mockResolvedValue(
        districtIds
      )
      ;(mockSnapshotStore.readDistrictData as Mock)
        .mockResolvedValueOnce(districts[0])
        .mockResolvedValueOnce(districts[1])
        .mockResolvedValueOnce(districts[2])

      const result = await aggregator.getAllDistricts('snapshot-1')

      expect(result).toHaveLength(3)
      expect(mockSnapshotStore.listDistrictsInSnapshot).toHaveBeenCalledWith(
        'snapshot-1'
      )
      expect(mockSnapshotStore.readDistrictData).toHaveBeenCalledTimes(3)
    })

    it('should return empty array when no districts exist', async () => {
      ;(mockSnapshotStore.listDistrictsInSnapshot as Mock).mockResolvedValue([])

      const result = await aggregator.getAllDistricts('snapshot-1')

      expect(result).toHaveLength(0)
      expect(mockSnapshotStore.readDistrictData).not.toHaveBeenCalled()
    })
  })

  describe('getDistrictSummary', () => {
    it('should return district summaries', async () => {
      const districtIds = ['42', '15']
      const districts = districtIds.map(createSampleDistrictData)
      const manifest = createSampleManifest(districtIds)

      ;(mockSnapshotStore.getSnapshotManifest as Mock).mockResolvedValue(
        manifest
      )
      ;(mockSnapshotStore.readDistrictData as Mock)
        .mockResolvedValueOnce(districts[0])
        .mockResolvedValueOnce(districts[1])

      const result = await aggregator.getDistrictSummary('snapshot-1')

      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject({
        districtId: '42',
        memberCount: 1000,
        clubCount: 50,
        distinguishedClubs: 20,
      })
      expect(result[1]).toMatchObject({
        districtId: '15',
        memberCount: 1000,
        clubCount: 50,
        distinguishedClubs: 20,
      })
    })

    it('should return empty array when manifest is not found', async () => {
      ;(mockSnapshotStore.getSnapshotManifest as Mock).mockResolvedValue(null)

      const result = await aggregator.getDistrictSummary('snapshot-1')

      expect(result).toHaveLength(0)
    })
  })

  describe('caching behavior', () => {
    it('should evict least recently used entries when cache is full', async () => {
      // Create a fresh aggregator with a smaller cache for easier testing
      const smallAggregator = new DistrictDataAggregator(mockSnapshotStore, {
        maxCacheSize: 2, // Very small cache for easier testing
        cacheExpirationMs: 10000,
        enableMetrics: true,
      })

      // Reset mock to ensure clean state
      ;(mockSnapshotStore.readDistrictData as Mock).mockReset()

      // Fill cache to capacity (2 entries)
      const district1 = createSampleDistrictData('1')
      const district2 = createSampleDistrictData('2')
      ;(mockSnapshotStore.readDistrictData as Mock)
        .mockResolvedValueOnce(district1)
        .mockResolvedValueOnce(district2)

      await smallAggregator.getDistrictData('snapshot-1', '1')
      await smallAggregator.getDistrictData('snapshot-1', '2')

      // Verify cache is full
      expect(smallAggregator.getMetrics().cacheSize).toBe(2)

      // Add a third entry - this should trigger eviction
      const district3 = createSampleDistrictData('3')
      ;(mockSnapshotStore.readDistrictData as Mock).mockResolvedValueOnce(
        district3
      )
      await smallAggregator.getDistrictData('snapshot-1', '3')

      // Verify eviction occurred - cache should still be at max size but with 1 eviction
      const metrics = smallAggregator.getMetrics()
      expect(metrics.cacheSize).toBe(2)
      expect(metrics.evictions).toBe(1)
    })

    it('should expire cache entries after expiration time', async () => {
      const districtData = createSampleDistrictData('42')
      ;(mockSnapshotStore.readDistrictData as Mock).mockResolvedValue(
        districtData
      )

      // First request
      await aggregator.getDistrictData('snapshot-1', '42')
      expect(mockSnapshotStore.readDistrictData).toHaveBeenCalledTimes(1)

      // Wait for cache to expire (using a short expiration time in test config)
      await new Promise(resolve => setTimeout(resolve, 1100))

      // Second request after expiration - should hit storage again
      await aggregator.getDistrictData('snapshot-1', '42')
      expect(mockSnapshotStore.readDistrictData).toHaveBeenCalledTimes(2)
    })
  })

  describe('metrics', () => {
    it('should track cache hits and misses', async () => {
      const districtData = createSampleDistrictData('42')
      ;(mockSnapshotStore.readDistrictData as Mock).mockResolvedValue(
        districtData
      )

      // First request - cache miss
      await aggregator.getDistrictData('snapshot-1', '42')

      // Second request - cache hit
      await aggregator.getDistrictData('snapshot-1', '42')

      const metrics = aggregator.getMetrics()
      expect(metrics.cacheHits).toBe(1)
      expect(metrics.cacheMisses).toBe(1)
      expect(metrics.totalRequests).toBe(2)
    })

    it('should track average response time', async () => {
      const districtData = createSampleDistrictData('42')
      ;(mockSnapshotStore.readDistrictData as Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(districtData), 1))
      )

      await aggregator.getDistrictData('snapshot-1', '42')

      const metrics = aggregator.getMetrics()
      expect(metrics.averageResponseTime).toBeGreaterThanOrEqual(0)
    })
  })

  describe('clearCache', () => {
    it('should clear all cache entries', async () => {
      const districtData = createSampleDistrictData('42')
      ;(mockSnapshotStore.readDistrictData as Mock).mockResolvedValue(
        districtData
      )

      // Add entry to cache
      await aggregator.getDistrictData('snapshot-1', '42')
      expect(aggregator.getMetrics().cacheSize).toBe(1)

      // Clear cache
      aggregator.clearCache()
      expect(aggregator.getMetrics().cacheSize).toBe(0)
      expect(aggregator.getMetrics().evictions).toBe(1)
    })
  })

  describe('preloadDistricts', () => {
    it('should preload districts into cache', async () => {
      const districtIds = ['42', '15']
      const districts = districtIds.map(createSampleDistrictData)

      ;(mockSnapshotStore.readDistrictData as Mock)
        .mockResolvedValueOnce(districts[0])
        .mockResolvedValueOnce(districts[1])

      await aggregator.preloadDistricts('snapshot-1', districtIds)

      // Verify districts are in cache by checking subsequent requests don't hit storage
      ;(mockSnapshotStore.readDistrictData as Mock).mockClear()

      await aggregator.getDistrictData('snapshot-1', '42')
      await aggregator.getDistrictData('snapshot-1', '15')

      expect(mockSnapshotStore.readDistrictData).not.toHaveBeenCalled()
    })
  })

  describe('factory function', () => {
    it('should create aggregator with default config', () => {
      const aggregator = createDistrictDataAggregator(mockSnapshotStore)
      expect(aggregator).toBeInstanceOf(DistrictDataAggregator)
    })

    it('should create aggregator with custom config', () => {
      const config = { maxCacheSize: 100, enableMetrics: false }
      const aggregator = createDistrictDataAggregator(mockSnapshotStore, config)
      expect(aggregator).toBeInstanceOf(DistrictDataAggregator)
    })
  })
})
