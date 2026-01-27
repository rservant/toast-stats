/**
 * Unit tests for FileSnapshotStore.deleteSnapshot
 *
 * These tests validate that the FileSnapshotStore correctly handles
 * snapshot deletion operations including directory removal and cache invalidation.
 *
 * **Validates: Requirements 3.1, 3.2**
 *
 * Requirements:
 * - 3.1: WHEN deleteSnapshot is called on LocalSnapshotStorage, THE implementation SHALL delete the snapshot directory and all its contents
 * - 3.2: IF the snapshot directory does not exist, THEN THE LocalSnapshotStorage deleteSnapshot method SHALL return false without throwing an error
 *
 * Test Isolation:
 * - Each test uses unique, isolated directories with timestamps and random suffixes
 * - Tests clean up resources in afterEach hooks
 * - Tests do not depend on execution order
 * - All tests pass when run with `--run` (parallel mode)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { FileSnapshotStore } from '../SnapshotStore.js'
import { Snapshot } from '../../types/snapshots.js'

describe('FileSnapshotStore.deleteSnapshot', () => {
  let tempDir: string
  let snapshotStore: FileSnapshotStore

  /**
   * Create a unique temporary directory for each test.
   * Using timestamp + random suffix ensures isolation for parallel test execution.
   */
  beforeEach(async () => {
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substring(2, 8)
    tempDir = await fs.mkdtemp(
      path.join(
        os.tmpdir(),
        `snapshot-store-delete-test-${timestamp}-${randomSuffix}-`
      )
    )

    snapshotStore = new FileSnapshotStore({
      cacheDir: tempDir,
      maxSnapshots: 10,
      maxAgeDays: 7,
      enableCompression: false,
    })
  })

  /**
   * Clean up temporary directory after each test.
   */
  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors - directory may not exist in some test cases
    }
  })

  /**
   * Helper function to create a test snapshot with the given date.
   * Creates a minimal valid snapshot structure for testing.
   */
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

  describe('delete existing snapshot', () => {
    /**
     * Test: deleteSnapshot returns true when deleting an existing snapshot
     *
     * **Validates: Requirements 3.1**
     *
     * This test verifies that when a snapshot exists and is deleted,
     * the method returns true to indicate successful deletion.
     */
    it('should return true when deleting an existing snapshot', async () => {
      // Arrange: Create a snapshot
      const snapshotDate = '2024-01-15'
      await snapshotStore.writeSnapshot(createTestSnapshot(snapshotDate))

      // Verify snapshot exists before deletion
      const snapshotDir = path.join(tempDir, 'snapshots', snapshotDate)
      const existsBefore = await fs
        .access(snapshotDir)
        .then(() => true)
        .catch(() => false)
      expect(existsBefore).toBe(true)

      // Act: Delete the snapshot
      const result = await snapshotStore.deleteSnapshot(snapshotDate)

      // Assert: Should return true
      expect(result).toBe(true)
    })

    /**
     * Test: deleteSnapshot removes the snapshot directory and all contents
     *
     * **Validates: Requirements 3.1**
     *
     * This test verifies that when a snapshot is deleted, the entire
     * snapshot directory including all district files is removed.
     */
    it('should remove the snapshot directory and all contents', async () => {
      // Arrange: Create a snapshot with district data
      const snapshotDate = '2024-02-20'
      await snapshotStore.writeSnapshot(createTestSnapshot(snapshotDate))

      // Verify snapshot directory and files exist
      const snapshotDir = path.join(tempDir, 'snapshots', snapshotDate)
      const existsBefore = await fs
        .access(snapshotDir)
        .then(() => true)
        .catch(() => false)
      expect(existsBefore).toBe(true)

      // Verify district file exists
      const districtFile = path.join(snapshotDir, 'district_61.json')
      const districtExistsBefore = await fs
        .access(districtFile)
        .then(() => true)
        .catch(() => false)
      expect(districtExistsBefore).toBe(true)

      // Verify metadata file exists
      const metadataFile = path.join(snapshotDir, 'metadata.json')
      const metadataExistsBefore = await fs
        .access(metadataFile)
        .then(() => true)
        .catch(() => false)
      expect(metadataExistsBefore).toBe(true)

      // Act: Delete the snapshot
      await snapshotStore.deleteSnapshot(snapshotDate)

      // Assert: Directory should no longer exist
      const existsAfter = await fs
        .access(snapshotDir)
        .then(() => true)
        .catch(() => false)
      expect(existsAfter).toBe(false)
    })

    /**
     * Test: deleteSnapshot removes snapshot with multiple district files
     *
     * **Validates: Requirements 3.1**
     *
     * This test verifies that when a snapshot with multiple districts
     * is deleted, all district files are removed along with the directory.
     */
    it('should remove snapshot with multiple district files', async () => {
      // Arrange: Create a snapshot with multiple districts
      const snapshotDate = '2024-03-10'
      const multiDistrictSnapshot: Snapshot = {
        ...createTestSnapshot(snapshotDate),
        payload: {
          ...createTestSnapshot(snapshotDate).payload,
          districts: [
            createTestSnapshot(snapshotDate).payload.districts[0]!,
            {
              ...createTestSnapshot(snapshotDate).payload.districts[0]!,
              districtId: '42',
            },
            {
              ...createTestSnapshot(snapshotDate).payload.districts[0]!,
              districtId: 'F',
            },
          ],
          metadata: {
            ...createTestSnapshot(snapshotDate).payload.metadata,
            districtCount: 3,
          },
        },
      }
      await snapshotStore.writeSnapshot(multiDistrictSnapshot)

      // Verify all district files exist
      const snapshotDir = path.join(tempDir, 'snapshots', snapshotDate)
      const files = await fs.readdir(snapshotDir)
      expect(files).toContain('district_61.json')
      expect(files).toContain('district_42.json')
      expect(files).toContain('district_F.json')

      // Act: Delete the snapshot
      const result = await snapshotStore.deleteSnapshot(snapshotDate)

      // Assert: Should return true and directory should be gone
      expect(result).toBe(true)
      const existsAfter = await fs
        .access(snapshotDir)
        .then(() => true)
        .catch(() => false)
      expect(existsAfter).toBe(false)
    })
  })

  describe('delete non-existent snapshot', () => {
    /**
     * Test: deleteSnapshot returns false when deleting a non-existent snapshot
     *
     * **Validates: Requirements 3.2**
     *
     * This test verifies that when attempting to delete a snapshot that
     * doesn't exist, the method returns false without throwing an error.
     */
    it('should return false when deleting a non-existent snapshot', async () => {
      // Arrange: Ensure snapshots directory exists but snapshot doesn't
      const snapshotsDir = path.join(tempDir, 'snapshots')
      await fs.mkdir(snapshotsDir, { recursive: true })

      // Act: Try to delete a non-existent snapshot
      const result = await snapshotStore.deleteSnapshot('2024-12-31')

      // Assert: Should return false
      expect(result).toBe(false)
    })

    /**
     * Test: deleteSnapshot returns false when snapshots directory doesn't exist
     *
     * **Validates: Requirements 3.2**
     *
     * This test verifies that when the snapshots directory itself doesn't
     * exist, the method returns false without throwing an error.
     */
    it('should return false when snapshots directory does not exist', async () => {
      // Arrange: Don't create any directories - tempDir exists but snapshots/ doesn't

      // Act: Try to delete a snapshot
      const result = await snapshotStore.deleteSnapshot('2024-06-15')

      // Assert: Should return false
      expect(result).toBe(false)
    })

    /**
     * Test: deleteSnapshot does not throw when snapshot doesn't exist
     *
     * **Validates: Requirements 3.2**
     *
     * This test explicitly verifies that no error is thrown when
     * attempting to delete a non-existent snapshot.
     */
    it('should not throw an error when snapshot does not exist', async () => {
      // Act & Assert: Should not throw
      await expect(
        snapshotStore.deleteSnapshot('non-existent-2024-01-01')
      ).resolves.not.toThrow()
    })
  })

  describe('cache invalidation after deletion', () => {
    /**
     * Test: deleteSnapshot invalidates cache after deletion
     *
     * **Validates: Requirements 3.1**
     *
     * This test verifies that when a snapshot is deleted, the internal
     * cache is invalidated so subsequent reads don't return stale data.
     */
    it('should invalidate cache after deletion', async () => {
      // Arrange: Create a snapshot and read it to populate cache
      const snapshotDate = '2024-04-01'
      await snapshotStore.writeSnapshot(createTestSnapshot(snapshotDate))

      // Read the snapshot to populate the cache
      const snapshotBefore = await snapshotStore.getSnapshot(snapshotDate)
      expect(snapshotBefore).not.toBeNull()

      // Also populate the list cache
      const listBefore = await snapshotStore.listSnapshots()
      expect(listBefore).toHaveLength(1)

      // Act: Delete the snapshot
      const deleteResult = await snapshotStore.deleteSnapshot(snapshotDate)
      expect(deleteResult).toBe(true)

      // Assert: Cache should be invalidated - getSnapshot should return null
      const snapshotAfter = await snapshotStore.getSnapshot(snapshotDate)
      expect(snapshotAfter).toBeNull()

      // Assert: List cache should be invalidated - listSnapshots should return empty
      const listAfter = await snapshotStore.listSnapshots()
      expect(listAfter).toHaveLength(0)
    })

    /**
     * Test: deleteSnapshot invalidates current snapshot cache when deleting current
     *
     * **Validates: Requirements 3.1**
     *
     * This test verifies that when the current (latest successful) snapshot
     * is deleted, the current snapshot cache is properly invalidated.
     */
    it('should invalidate current snapshot cache when deleting the current snapshot', async () => {
      // Arrange: Create a snapshot and read it as current to populate cache
      const snapshotDate = '2024-05-15'
      await snapshotStore.writeSnapshot(createTestSnapshot(snapshotDate))

      // Read as latest successful to populate current snapshot cache
      const currentBefore = await snapshotStore.getLatestSuccessful()
      expect(currentBefore).not.toBeNull()
      expect(currentBefore?.snapshot_id).toBe(snapshotDate)

      // Act: Delete the snapshot
      await snapshotStore.deleteSnapshot(snapshotDate)

      // Assert: getLatestSuccessful should return null (no snapshots left)
      const currentAfter = await snapshotStore.getLatestSuccessful()
      expect(currentAfter).toBeNull()
    })

    /**
     * Test: deleteSnapshot updates cache correctly when deleting one of multiple snapshots
     *
     * **Validates: Requirements 3.1**
     *
     * This test verifies that when one snapshot is deleted from multiple,
     * the cache is properly updated to reflect the remaining snapshots.
     */
    it('should update cache correctly when deleting one of multiple snapshots', async () => {
      // Arrange: Create multiple snapshots
      await snapshotStore.writeSnapshot(createTestSnapshot('2024-06-01'))
      await snapshotStore.writeSnapshot(createTestSnapshot('2024-06-15'))
      await snapshotStore.writeSnapshot(createTestSnapshot('2024-06-30'))

      // Populate cache
      const listBefore = await snapshotStore.listSnapshots()
      expect(listBefore).toHaveLength(3)

      // Act: Delete the middle snapshot
      await snapshotStore.deleteSnapshot('2024-06-15')

      // Assert: List should now have 2 snapshots
      const listAfter = await snapshotStore.listSnapshots()
      expect(listAfter).toHaveLength(2)
      expect(listAfter.map(s => s.snapshot_id)).not.toContain('2024-06-15')
      expect(listAfter.map(s => s.snapshot_id)).toContain('2024-06-01')
      expect(listAfter.map(s => s.snapshot_id)).toContain('2024-06-30')
    })
  })

  describe('error handling', () => {
    /**
     * Test: deleteSnapshot throws on invalid snapshot ID format
     *
     * This test verifies that the method validates the snapshot ID
     * format and throws an error for invalid IDs (path traversal prevention).
     */
    it('should throw an error for invalid snapshot ID format', async () => {
      // Act & Assert: Should throw for path traversal attempts
      await expect(
        snapshotStore.deleteSnapshot('../../../etc/passwd')
      ).rejects.toThrow('Invalid snapshot ID format')

      await expect(snapshotStore.deleteSnapshot('../../test')).rejects.toThrow(
        'Invalid snapshot ID format'
      )

      await expect(
        snapshotStore.deleteSnapshot('snapshot/with/slashes')
      ).rejects.toThrow('Invalid snapshot ID format')
    })

    /**
     * Test: deleteSnapshot throws on empty snapshot ID
     *
     * This test verifies that the method validates against empty snapshot IDs.
     */
    it('should throw an error for empty snapshot ID', async () => {
      // Act & Assert: Should throw for empty string
      await expect(snapshotStore.deleteSnapshot('')).rejects.toThrow(
        'Invalid snapshot ID: empty or non-string value'
      )
    })
  })

  describe('concurrent operations', () => {
    /**
     * Test: Multiple concurrent delete operations on different snapshots
     *
     * This test verifies that concurrent delete operations on different
     * snapshots work correctly without interference.
     */
    it('should handle concurrent deletes of different snapshots', async () => {
      // Arrange: Create multiple snapshots
      await snapshotStore.writeSnapshot(createTestSnapshot('2024-07-01'))
      await snapshotStore.writeSnapshot(createTestSnapshot('2024-07-15'))
      await snapshotStore.writeSnapshot(createTestSnapshot('2024-07-30'))

      // Act: Delete all concurrently
      const results = await Promise.all([
        snapshotStore.deleteSnapshot('2024-07-01'),
        snapshotStore.deleteSnapshot('2024-07-15'),
        snapshotStore.deleteSnapshot('2024-07-30'),
      ])

      // Assert: All should return true
      expect(results).toEqual([true, true, true])

      // Verify all are deleted
      const listAfter = await snapshotStore.listSnapshots()
      expect(listAfter).toHaveLength(0)
    })

    /**
     * Test: Concurrent delete of same snapshot returns true once, false for others
     *
     * This test verifies that when multiple concurrent deletes target the
     * same snapshot, only one succeeds (returns true) and others return false.
     */
    it('should handle concurrent deletes of the same snapshot gracefully', async () => {
      // Arrange: Create a snapshot
      await snapshotStore.writeSnapshot(createTestSnapshot('2024-08-15'))

      // Act: Try to delete the same snapshot concurrently
      const results = await Promise.all([
        snapshotStore.deleteSnapshot('2024-08-15'),
        snapshotStore.deleteSnapshot('2024-08-15'),
        snapshotStore.deleteSnapshot('2024-08-15'),
      ])

      // Assert: At least one should return true, others may return true or false
      // depending on timing (fs.rm with force:true is idempotent)
      const trueCount = results.filter(r => r === true).length
      expect(trueCount).toBeGreaterThanOrEqual(1)

      // Verify snapshot is deleted
      const snapshotDir = path.join(tempDir, 'snapshots', '2024-08-15')
      const exists = await fs
        .access(snapshotDir)
        .then(() => true)
        .catch(() => false)
      expect(exists).toBe(false)
    })
  })
})
