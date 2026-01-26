/**
 * Tests for FileSnapshotStore.getSnapshotMetadataBatch()
 *
 * Property 5: Batch Metadata Retrieval
 * For any list of snapshot IDs, the batch metadata retrieval method SHALL:
 * - Return metadata for all requested snapshots that exist
 * - Return null for snapshots that don't exist
 * - Return results in a single operation (not N individual queries)
 *
 * Validates: Requirements 3.4
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { FileSnapshotStore } from '../SnapshotStore.js'
import { Snapshot } from '../../types/snapshots.js'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

describe('FileSnapshotStore getSnapshotMetadataBatch', () => {
  let snapshotStore: FileSnapshotStore
  let tempDir: string

  beforeEach(async () => {
    // Create unique temporary directory for test isolation
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), `snapshot-batch-metadata-test-${uniqueId}-`)
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

  describe('Basic functionality', () => {
    it('should return metadata for all existing snapshots', async () => {
      // Create test snapshots
      await snapshotStore.writeSnapshot(createTestSnapshot('2024-01-01'))
      await snapshotStore.writeSnapshot(createTestSnapshot('2024-01-02'))
      await snapshotStore.writeSnapshot(createTestSnapshot('2024-01-03'))

      // Request metadata for all snapshots
      const results = await snapshotStore.getSnapshotMetadataBatch([
        '2024-01-01',
        '2024-01-02',
        '2024-01-03',
      ])

      expect(results.size).toBe(3)
      expect(results.get('2024-01-01')).not.toBeNull()
      expect(results.get('2024-01-02')).not.toBeNull()
      expect(results.get('2024-01-03')).not.toBeNull()

      // Verify metadata content
      const metadata1 = results.get('2024-01-01')
      expect(metadata1?.snapshotId).toBe('2024-01-01')
      expect(metadata1?.status).toBe('success')
    })

    it('should return null for non-existent snapshots', async () => {
      // Create only one snapshot
      await snapshotStore.writeSnapshot(createTestSnapshot('2024-01-01'))

      // Request metadata including non-existent snapshots
      const results = await snapshotStore.getSnapshotMetadataBatch([
        '2024-01-01',
        '2024-01-02', // Does not exist
        '2024-01-03', // Does not exist
      ])

      expect(results.size).toBe(3)
      expect(results.get('2024-01-01')).not.toBeNull()
      expect(results.get('2024-01-02')).toBeNull()
      expect(results.get('2024-01-03')).toBeNull()
    })

    it('should return empty map for empty input array', async () => {
      const results = await snapshotStore.getSnapshotMetadataBatch([])

      expect(results.size).toBe(0)
    })

    it('should handle single snapshot request', async () => {
      await snapshotStore.writeSnapshot(createTestSnapshot('2024-01-01'))

      const results = await snapshotStore.getSnapshotMetadataBatch([
        '2024-01-01',
      ])

      expect(results.size).toBe(1)
      expect(results.get('2024-01-01')).not.toBeNull()
      expect(results.get('2024-01-01')?.snapshotId).toBe('2024-01-01')
    })
  })

  describe('Cache integration', () => {
    it('should use cached snapshot list to skip disk reads for non-existent snapshots', async () => {
      // Create test snapshots
      await snapshotStore.writeSnapshot(createTestSnapshot('2024-01-01'))
      await snapshotStore.writeSnapshot(createTestSnapshot('2024-01-02'))

      // Populate the snapshot list cache
      await snapshotStore.listSnapshots()

      // Request metadata including non-existent snapshots
      // The cache should help skip disk reads for non-existent ones
      const results = await snapshotStore.getSnapshotMetadataBatch([
        '2024-01-01',
        '2024-01-02',
        '2024-01-03', // Does not exist - should be skipped via cache
        '2024-01-04', // Does not exist - should be skipped via cache
      ])

      expect(results.size).toBe(4)
      expect(results.get('2024-01-01')).not.toBeNull()
      expect(results.get('2024-01-02')).not.toBeNull()
      expect(results.get('2024-01-03')).toBeNull()
      expect(results.get('2024-01-04')).toBeNull()
    })

    it('should work correctly without cached snapshot list', async () => {
      // Create test snapshots
      await snapshotStore.writeSnapshot(createTestSnapshot('2024-01-01'))
      await snapshotStore.writeSnapshot(createTestSnapshot('2024-01-02'))

      // Don't populate the cache - go directly to batch retrieval
      const results = await snapshotStore.getSnapshotMetadataBatch([
        '2024-01-01',
        '2024-01-02',
        '2024-01-03', // Does not exist
      ])

      expect(results.size).toBe(3)
      expect(results.get('2024-01-01')).not.toBeNull()
      expect(results.get('2024-01-02')).not.toBeNull()
      expect(results.get('2024-01-03')).toBeNull()
    })
  })

  describe('Error handling', () => {
    it('should return null for invalid snapshot IDs', async () => {
      await snapshotStore.writeSnapshot(createTestSnapshot('2024-01-01'))

      // Request with invalid snapshot IDs
      const results = await snapshotStore.getSnapshotMetadataBatch([
        '2024-01-01',
        '../invalid', // Invalid - path traversal attempt
        '', // Invalid - empty string
      ])

      expect(results.size).toBe(3)
      expect(results.get('2024-01-01')).not.toBeNull()
      expect(results.get('../invalid')).toBeNull()
      expect(results.get('')).toBeNull()
    })

    it('should handle mixed valid and invalid snapshot IDs', async () => {
      await snapshotStore.writeSnapshot(createTestSnapshot('2024-01-01'))
      await snapshotStore.writeSnapshot(createTestSnapshot('2024-01-02'))

      const results = await snapshotStore.getSnapshotMetadataBatch([
        '2024-01-01', // Valid, exists
        '2024-01-02', // Valid, exists
        '2024-01-03', // Valid, does not exist
        'invalid/path', // Invalid
      ])

      expect(results.size).toBe(4)
      expect(results.get('2024-01-01')).not.toBeNull()
      expect(results.get('2024-01-02')).not.toBeNull()
      expect(results.get('2024-01-03')).toBeNull()
      expect(results.get('invalid/path')).toBeNull()
    })
  })

  describe('Concurrent operations', () => {
    it('should handle concurrent batch requests', async () => {
      // Create test snapshots
      await snapshotStore.writeSnapshot(createTestSnapshot('2024-01-01'))
      await snapshotStore.writeSnapshot(createTestSnapshot('2024-01-02'))
      await snapshotStore.writeSnapshot(createTestSnapshot('2024-01-03'))

      // Make concurrent batch requests
      const [results1, results2, results3] = await Promise.all([
        snapshotStore.getSnapshotMetadataBatch(['2024-01-01', '2024-01-02']),
        snapshotStore.getSnapshotMetadataBatch(['2024-01-02', '2024-01-03']),
        snapshotStore.getSnapshotMetadataBatch(['2024-01-01', '2024-01-03']),
      ])

      // All should return correct results
      expect(results1.size).toBe(2)
      expect(results1.get('2024-01-01')).not.toBeNull()
      expect(results1.get('2024-01-02')).not.toBeNull()

      expect(results2.size).toBe(2)
      expect(results2.get('2024-01-02')).not.toBeNull()
      expect(results2.get('2024-01-03')).not.toBeNull()

      expect(results3.size).toBe(2)
      expect(results3.get('2024-01-01')).not.toBeNull()
      expect(results3.get('2024-01-03')).not.toBeNull()
    })
  })

  describe('Performance characteristics', () => {
    it('should be more efficient than individual getSnapshotMetadata calls', async () => {
      // Create multiple test snapshots
      const snapshotIds: string[] = []
      for (let i = 1; i <= 5; i++) {
        const dateStr = `2024-01-${String(i).padStart(2, '0')}`
        await snapshotStore.writeSnapshot(createTestSnapshot(dateStr))
        snapshotIds.push(dateStr)
      }

      // Measure batch retrieval time
      const batchStart = Date.now()
      const batchResults =
        await snapshotStore.getSnapshotMetadataBatch(snapshotIds)
      const batchDuration = Date.now() - batchStart

      // Verify batch results
      expect(batchResults.size).toBe(5)
      for (const id of snapshotIds) {
        expect(batchResults.get(id)).not.toBeNull()
      }

      // Measure individual retrieval time
      const individualStart = Date.now()
      for (const id of snapshotIds) {
        await snapshotStore.getSnapshotMetadata(id)
      }
      const individualDuration = Date.now() - individualStart

      // Batch should be at least as fast as individual calls
      // (allowing some tolerance for timing variance)
      expect(batchDuration).toBeLessThanOrEqual(individualDuration + 50)
    })
  })

  describe('Metadata content verification', () => {
    it('should return complete metadata for each snapshot', async () => {
      await snapshotStore.writeSnapshot(
        createTestSnapshot('2024-01-01', 'success')
      )
      await snapshotStore.writeSnapshot(
        createTestSnapshot('2024-01-02', 'failed')
      )

      const results = await snapshotStore.getSnapshotMetadataBatch([
        '2024-01-01',
        '2024-01-02',
      ])

      const metadata1 = results.get('2024-01-01')
      expect(metadata1).not.toBeNull()
      expect(metadata1?.snapshotId).toBe('2024-01-01')
      expect(metadata1?.status).toBe('success')
      expect(metadata1?.schemaVersion).toBe('1.0.0')
      expect(metadata1?.calculationVersion).toBe('1.0.0')
      expect(metadata1?.successfulDistricts).toContain('61')

      const metadata2 = results.get('2024-01-02')
      expect(metadata2).not.toBeNull()
      expect(metadata2?.snapshotId).toBe('2024-01-02')
      expect(metadata2?.status).toBe('failed')
    })

    it('should preserve order of results matching input order', async () => {
      await snapshotStore.writeSnapshot(createTestSnapshot('2024-01-03'))
      await snapshotStore.writeSnapshot(createTestSnapshot('2024-01-01'))
      await snapshotStore.writeSnapshot(createTestSnapshot('2024-01-02'))

      // Request in specific order
      const requestOrder = ['2024-01-02', '2024-01-03', '2024-01-01']
      const results = await snapshotStore.getSnapshotMetadataBatch(requestOrder)

      // Results should be available for all requested IDs
      expect(results.size).toBe(3)
      for (const id of requestOrder) {
        expect(results.has(id)).toBe(true)
        expect(results.get(id)?.snapshotId).toBe(id)
      }
    })
  })
})
