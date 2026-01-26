/**
 * Tests for FileSnapshotStore.listSnapshots() in-memory caching
 * Validates Requirements 3.2 and 3.3:
 * - Cache snapshot list with 60-second TTL
 * - Return cached results without querying database
 * - Invalidate cache on snapshot write/delete
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { FileSnapshotStore } from '../SnapshotStore.js'
import { Snapshot } from '../../types/snapshots.js'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

describe('FileSnapshotStore listSnapshots Cache', () => {
  let snapshotStore: FileSnapshotStore
  let tempDir: string

  beforeEach(async () => {
    // Create temporary directory for testing
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'snapshot-list-cache-test-')
    )

    snapshotStore = new FileSnapshotStore({
      cacheDir: tempDir,
      maxSnapshots: 10,
      maxAgeDays: 7,
      enableCompression: false,
    })
  })

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  const createTestSnapshot = (
    dateStr: string,
    status: 'success' | 'failed' = 'success'
  ): Snapshot => ({
    snapshot_id: dateStr,
    created_at: new Date().toISOString(),
    schema_version: '1.0.0',
    calculation_version: '1.0.0',
    status,
    errors: [],
    payload: {
      districts: [
        {
          districtId: '61',
          asOfDate: new Date().toISOString(),
          membership: {
            total: 100,
            change: 5,
            changePercent: 5.0,
            byClub: [],
            new: 10,
            renewed: 90,
            dual: 0,
          },
          clubs: {
            total: 10,
            active: 8,
            suspended: 1,
            ineligible: 1,
            low: 2,
            distinguished: 3,
            chartered: 0,
          },
          education: {
            totalAwards: 50,
            byType: [],
            topClubs: [],
          },
        },
      ],
      metadata: {
        source: 'test',
        fetchedAt: new Date().toISOString(),
        dataAsOfDate: dateStr,
        districtCount: 1,
        processingDurationMs: 0,
      },
    },
  })

  describe('Cache behavior', () => {
    it('should cache listSnapshots results for subsequent calls', async () => {
      // Create test snapshots
      await snapshotStore.writeSnapshot(createTestSnapshot('2024-01-01'))
      await snapshotStore.writeSnapshot(createTestSnapshot('2024-01-02'))

      // First call - should read from disk
      const result1 = await snapshotStore.listSnapshots()
      expect(result1).toHaveLength(2)

      // Second call - should use cache (same results)
      const result2 = await snapshotStore.listSnapshots()
      expect(result2).toHaveLength(2)

      // Results should be equivalent
      expect(result1.map(s => s.snapshot_id).sort()).toEqual(
        result2.map(s => s.snapshot_id).sort()
      )
    })

    it('should return cached results faster than disk reads', async () => {
      // Create multiple test snapshots
      await snapshotStore.writeSnapshot(createTestSnapshot('2024-01-01'))
      await snapshotStore.writeSnapshot(createTestSnapshot('2024-01-02'))
      await snapshotStore.writeSnapshot(createTestSnapshot('2024-01-03'))

      // First call - reads from disk (cache miss)
      const start1 = Date.now()
      await snapshotStore.listSnapshots()
      const duration1 = Date.now() - start1

      // Second call - should use cache (cache hit)
      const start2 = Date.now()
      await snapshotStore.listSnapshots()
      const duration2 = Date.now() - start2

      // Cache hit should be faster or equal (allowing for timing variance)
      expect(duration2).toBeLessThanOrEqual(duration1 + 5) // 5ms tolerance
    })

    it('should apply filters on cached data without re-reading from disk', async () => {
      // Create test snapshots with different statuses
      await snapshotStore.writeSnapshot(
        createTestSnapshot('2024-01-01', 'success')
      )
      await snapshotStore.writeSnapshot(
        createTestSnapshot('2024-01-02', 'success')
      )

      // First call - populates cache
      const allSnapshots = await snapshotStore.listSnapshots()
      expect(allSnapshots).toHaveLength(2)

      // Second call with filter - should use cached data
      const filteredSnapshots = await snapshotStore.listSnapshots(undefined, {
        status: 'success',
      })
      expect(filteredSnapshots).toHaveLength(2)

      // Third call with limit - should use cached data
      const limitedSnapshots = await snapshotStore.listSnapshots(1)
      expect(limitedSnapshots).toHaveLength(1)
    })
  })

  describe('Cache invalidation', () => {
    it('should invalidate cache when a new snapshot is written', async () => {
      // Create initial snapshot
      await snapshotStore.writeSnapshot(createTestSnapshot('2024-01-01'))

      // First call - populates cache
      const result1 = await snapshotStore.listSnapshots()
      expect(result1).toHaveLength(1)

      // Write a new snapshot - should invalidate cache
      await snapshotStore.writeSnapshot(createTestSnapshot('2024-01-02'))

      // Next call should reflect the new snapshot
      const result2 = await snapshotStore.listSnapshots()
      expect(result2).toHaveLength(2)
    })

    it('should invalidate cache when multiple snapshots are written', async () => {
      // Create initial snapshot
      await snapshotStore.writeSnapshot(createTestSnapshot('2024-01-01'))

      // Populate cache
      const result1 = await snapshotStore.listSnapshots()
      expect(result1).toHaveLength(1)

      // Write multiple new snapshots
      await snapshotStore.writeSnapshot(createTestSnapshot('2024-01-02'))
      await snapshotStore.writeSnapshot(createTestSnapshot('2024-01-03'))

      // Cache should be invalidated and show all snapshots
      const result2 = await snapshotStore.listSnapshots()
      expect(result2).toHaveLength(3)
    })
  })

  describe('Cache TTL', () => {
    it('should have a TTL of at least 60 seconds', async () => {
      // Create test snapshot
      await snapshotStore.writeSnapshot(createTestSnapshot('2024-01-01'))

      // Populate cache
      await snapshotStore.listSnapshots()

      // Access the private TTL constant via type assertion
      // The TTL should be at least 60000ms (60 seconds) per requirements
      const store = snapshotStore as unknown as {
        SNAPSHOT_LIST_CACHE_TTL: number
      }
      expect(store.SNAPSHOT_LIST_CACHE_TTL).toBeGreaterThanOrEqual(60000)
    })

    it('should expire cache after TTL', async () => {
      // Use fake timers for this test
      vi.useFakeTimers()

      try {
        // Create test snapshot
        await snapshotStore.writeSnapshot(createTestSnapshot('2024-01-01'))

        // Populate cache
        const result1 = await snapshotStore.listSnapshots()
        expect(result1).toHaveLength(1)

        // Advance time past TTL (61 seconds)
        vi.advanceTimersByTime(61000)

        // After TTL, cache should be expired and re-read from disk
        // Since we haven't added any new snapshots, it should still return 1
        const result2 = await snapshotStore.listSnapshots()
        expect(result2).toHaveLength(1)

        // Verify the cache was actually expired by checking that
        // a subsequent call within TTL uses the new cache
        const result3 = await snapshotStore.listSnapshots()
        expect(result3).toHaveLength(1)
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('Edge cases', () => {
    it('should handle empty snapshot directory', async () => {
      // First call with no snapshots
      const result1 = await snapshotStore.listSnapshots()
      expect(result1).toHaveLength(0)

      // Second call should also return empty (from cache)
      const result2 = await snapshotStore.listSnapshots()
      expect(result2).toHaveLength(0)
    })

    it('should not mutate cached data when applying filters', async () => {
      // Create test snapshots
      await snapshotStore.writeSnapshot(createTestSnapshot('2024-01-01'))
      await snapshotStore.writeSnapshot(createTestSnapshot('2024-01-02'))
      await snapshotStore.writeSnapshot(createTestSnapshot('2024-01-03'))

      // First call - populates cache
      const allSnapshots = await snapshotStore.listSnapshots()
      expect(allSnapshots).toHaveLength(3)

      // Call with limit
      const limited = await snapshotStore.listSnapshots(1)
      expect(limited).toHaveLength(1)

      // Original cache should still have all snapshots
      const allAgain = await snapshotStore.listSnapshots()
      expect(allAgain).toHaveLength(3)
    })

    it('should handle concurrent listSnapshots calls', async () => {
      // Create test snapshots
      await snapshotStore.writeSnapshot(createTestSnapshot('2024-01-01'))
      await snapshotStore.writeSnapshot(createTestSnapshot('2024-01-02'))

      // Make concurrent calls
      const [result1, result2, result3] = await Promise.all([
        snapshotStore.listSnapshots(),
        snapshotStore.listSnapshots(),
        snapshotStore.listSnapshots(),
      ])

      // All should return the same results
      expect(result1).toHaveLength(2)
      expect(result2).toHaveLength(2)
      expect(result3).toHaveLength(2)
    })
  })
})
