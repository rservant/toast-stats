/**
 * Unit tests for LocalSnapshotStorage.deleteSnapshot
 *
 * These tests verify that LocalSnapshotStorage correctly delegates
 * deleteSnapshot operations to the underlying FileSnapshotStore.
 *
 * **Validates: Requirements 3.1, 3.2**
 *
 * Requirements:
 * - 3.1: WHEN deleteSnapshot is called on LocalSnapshotStorage, THE implementation SHALL delete the snapshot directory and all its contents
 * - 3.2: IF the snapshot directory does not exist, THEN THE LocalSnapshotStorage deleteSnapshot method SHALL return false without throwing an error
 *
 * Note: The underlying FileSnapshotStore.deleteSnapshot is thoroughly tested
 * in SnapshotStore.deleteSnapshot.test.ts. These tests focus on verifying
 * the delegation through the LocalSnapshotStorage interface works correctly.
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
import { LocalSnapshotStorage } from '../LocalSnapshotStorage.js'
import type { ISnapshotStorage } from '../../../types/storageInterfaces.js'
import type { Snapshot } from '../../../types/snapshots.js'
import {
  CURRENT_SCHEMA_VERSION,
  CURRENT_CALCULATION_VERSION,
} from '../../../types/snapshots.js'

describe('LocalSnapshotStorage.deleteSnapshot', () => {
  let storage: ISnapshotStorage
  let testCacheDir: string
  let testId: string

  /**
   * Create a unique temporary directory for each test.
   * Using timestamp + random suffix ensures isolation for parallel test execution.
   */
  beforeEach(async () => {
    testId = `local-snapshot-delete-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
    testCacheDir = path.join(process.cwd(), 'test-cache', testId)
    await fs.mkdir(testCacheDir, { recursive: true })

    storage = new LocalSnapshotStorage({ cacheDir: testCacheDir })
  })

  /**
   * Clean up temporary directory after each test.
   */
  afterEach(async () => {
    try {
      await fs.rm(testCacheDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors - directory may not exist in some test cases
    }
  })

  /**
   * Helper function to create a test snapshot with the given date.
   * Creates a minimal valid snapshot structure for testing.
   */
  const createTestSnapshot = (
    snapshotId: string,
    status: 'success' | 'partial' | 'failed' = 'success'
  ): Snapshot => ({
    snapshot_id: snapshotId,
    created_at: new Date().toISOString(),
    schema_version: CURRENT_SCHEMA_VERSION,
    calculation_version: CURRENT_CALCULATION_VERSION,
    status,
    errors: status === 'failed' ? ['Test error'] : [],
    payload: {
      districts: [
        {
          districtId: '42',
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
        dataAsOfDate: snapshotId,
        districtCount: 1,
        processingDurationMs: 100,
      },
    },
  })

  describe('delete existing snapshot', () => {
    /**
     * Test: deleteSnapshot returns true when deleting an existing snapshot
     *
     * **Validates: Requirements 3.1**
     *
     * This test verifies that when a snapshot exists and is deleted through
     * the LocalSnapshotStorage interface, the method returns true.
     */
    it('should return true when deleting an existing snapshot', async () => {
      // Arrange: Create a snapshot through the storage interface
      const snapshotId = '2024-01-15'
      await storage.writeSnapshot(createTestSnapshot(snapshotId))

      // Verify snapshot exists before deletion
      const snapshotBefore = await storage.getSnapshot(snapshotId)
      expect(snapshotBefore).not.toBeNull()

      // Act: Delete the snapshot through the storage interface
      const result = await storage.deleteSnapshot(snapshotId)

      // Assert: Should return true
      expect(result).toBe(true)
    })

    /**
     * Test: deleteSnapshot removes the snapshot directory and all contents
     *
     * **Validates: Requirements 3.1**
     *
     * This test verifies that when a snapshot is deleted through the
     * LocalSnapshotStorage interface, the snapshot is no longer retrievable.
     */
    it('should remove the snapshot so it is no longer retrievable', async () => {
      // Arrange: Create a snapshot
      const snapshotId = '2024-02-20'
      await storage.writeSnapshot(createTestSnapshot(snapshotId))

      // Verify snapshot exists
      const snapshotBefore = await storage.getSnapshot(snapshotId)
      expect(snapshotBefore).not.toBeNull()

      // Act: Delete the snapshot
      await storage.deleteSnapshot(snapshotId)

      // Assert: Snapshot should no longer be retrievable
      const snapshotAfter = await storage.getSnapshot(snapshotId)
      expect(snapshotAfter).toBeNull()

      // Assert: Snapshot should not appear in list
      const snapshots = await storage.listSnapshots()
      expect(snapshots.map(s => s.snapshot_id)).not.toContain(snapshotId)
    })
  })

  describe('delete non-existent snapshot', () => {
    /**
     * Test: deleteSnapshot returns false when deleting a non-existent snapshot
     *
     * **Validates: Requirements 3.2**
     *
     * This test verifies that when attempting to delete a snapshot that
     * doesn't exist through the LocalSnapshotStorage interface, the method
     * returns false without throwing an error.
     */
    it('should return false when deleting a non-existent snapshot', async () => {
      // Act: Try to delete a non-existent snapshot
      const result = await storage.deleteSnapshot('2024-12-31')

      // Assert: Should return false
      expect(result).toBe(false)
    })

    /**
     * Test: deleteSnapshot does not throw when snapshot doesn't exist
     *
     * **Validates: Requirements 3.2**
     *
     * This test explicitly verifies that no error is thrown when
     * attempting to delete a non-existent snapshot through the interface.
     */
    it('should not throw an error when snapshot does not exist', async () => {
      // Act & Assert: Should not throw
      await expect(
        storage.deleteSnapshot('non-existent-2024-01-01')
      ).resolves.not.toThrow()
    })
  })
})
