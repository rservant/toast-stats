/**
 * Unit tests for FileSnapshotStore empty directory handling
 *
 * These tests validate that the FileSnapshotStore gracefully handles
 * scenarios where the snapshots directory doesn't exist or is empty.
 *
 * **Validates: Requirements 2.3, 2.4, 3.1, 3.2**
 *
 * Requirements:
 * - 2.3: WHEN `getLatestSuccessful()` is called on empty storage, THE Storage_Provider SHALL return `null` instead of throwing an error
 * - 2.4: WHEN the snapshots directory does not exist, THE FileSnapshotStore SHALL handle this gracefully and return `null` from `getLatestSuccessful()`
 * - 3.1: WHEN the snapshots directory does not exist, THE `findLatestSuccessfulByScanning()` method SHALL return `null` instead of throwing an error
 * - 3.2: WHEN the snapshots directory is empty, THE `findLatestSuccessfulByScanning()` method SHALL return `null`
 *
 * Test Isolation:
 * - Each test uses unique, isolated directories
 * - Tests clean up resources in afterEach hooks
 * - Tests do not depend on execution order
 * - All tests pass when run with `--run` (parallel mode)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { FileSnapshotStore } from '../SnapshotStore.js'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

describe('FileSnapshotStore Empty Directory Handling', () => {
  let tempDir: string
  let snapshotStore: FileSnapshotStore

  beforeEach(async () => {
    // Create unique temporary directory for each test
    // Using timestamp + random suffix ensures isolation for parallel test execution
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substring(2, 8)
    tempDir = await fs.mkdtemp(
      path.join(
        os.tmpdir(),
        `snapshot-store-empty-test-${timestamp}-${randomSuffix}-`
      )
    )
  })

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors - directory may not exist in some test cases
    }
  })

  describe('getLatestSuccessful with non-existent directory', () => {
    /**
     * Test: getLatestSuccessful returns null when snapshots directory does not exist
     *
     * **Validates: Requirements 2.4, 3.1**
     *
     * This test verifies that when the snapshots directory doesn't exist at all,
     * the FileSnapshotStore gracefully returns null instead of throwing an error.
     * This is critical for fresh deployments where no data has been collected yet.
     */
    it('should return null when snapshots directory does not exist', async () => {
      // Create store pointing to a non-existent directory
      // The cacheDir exists but the snapshots subdirectory does not
      snapshotStore = new FileSnapshotStore({
        cacheDir: tempDir,
        maxSnapshots: 10,
        maxAgeDays: 7,
        enableCompression: false,
      })

      // Verify the snapshots directory does not exist
      const snapshotsDir = path.join(tempDir, 'snapshots')
      const dirExists = await fs
        .access(snapshotsDir)
        .then(() => true)
        .catch(() => false)
      expect(dirExists).toBe(false)

      // Call getLatestSuccessful - should return null, not throw
      const result = await snapshotStore.getLatestSuccessful()

      expect(result).toBeNull()
    })

    /**
     * Test: getLatestSuccessful returns null when entire cache directory does not exist
     *
     * **Validates: Requirements 2.4, 3.1**
     *
     * This test verifies that when even the cache directory doesn't exist,
     * the FileSnapshotStore gracefully returns null instead of throwing an error.
     */
    it('should return null when entire cache directory does not exist', async () => {
      // Create a path to a non-existent directory
      const nonExistentDir = path.join(tempDir, 'non-existent-cache')

      snapshotStore = new FileSnapshotStore({
        cacheDir: nonExistentDir,
        maxSnapshots: 10,
        maxAgeDays: 7,
        enableCompression: false,
      })

      // Verify the directory does not exist
      const dirExists = await fs
        .access(nonExistentDir)
        .then(() => true)
        .catch(() => false)
      expect(dirExists).toBe(false)

      // Call getLatestSuccessful - should return null, not throw
      const result = await snapshotStore.getLatestSuccessful()

      expect(result).toBeNull()
    })
  })

  describe('getLatestSuccessful with empty directory', () => {
    /**
     * Test: getLatestSuccessful returns null when snapshots directory is empty
     *
     * **Validates: Requirements 2.3, 3.2**
     *
     * This test verifies that when the snapshots directory exists but contains
     * no snapshot subdirectories, the FileSnapshotStore returns null.
     */
    it('should return null when snapshots directory is empty', async () => {
      // Create the snapshots directory but leave it empty
      const snapshotsDir = path.join(tempDir, 'snapshots')
      await fs.mkdir(snapshotsDir, { recursive: true })

      snapshotStore = new FileSnapshotStore({
        cacheDir: tempDir,
        maxSnapshots: 10,
        maxAgeDays: 7,
        enableCompression: false,
      })

      // Verify the snapshots directory exists and is empty
      const dirExists = await fs
        .access(snapshotsDir)
        .then(() => true)
        .catch(() => false)
      expect(dirExists).toBe(true)

      const files = await fs.readdir(snapshotsDir)
      expect(files).toHaveLength(0)

      // Call getLatestSuccessful - should return null, not throw
      const result = await snapshotStore.getLatestSuccessful()

      expect(result).toBeNull()
    })

    /**
     * Test: getLatestSuccessful returns null when snapshots directory contains only files (no subdirectories)
     *
     * **Validates: Requirements 2.3, 3.2**
     *
     * This test verifies that when the snapshots directory contains only files
     * (not snapshot subdirectories), the FileSnapshotStore returns null.
     * Snapshot data is stored in subdirectories, so files should be ignored.
     */
    it('should return null when snapshots directory contains only files (no subdirectories)', async () => {
      // Create the snapshots directory with some files but no subdirectories
      const snapshotsDir = path.join(tempDir, 'snapshots')
      await fs.mkdir(snapshotsDir, { recursive: true })

      // Create some random files that are not snapshot directories
      await fs.writeFile(
        path.join(snapshotsDir, 'random-file.txt'),
        'test content'
      )
      await fs.writeFile(path.join(snapshotsDir, '.gitkeep'), '')

      snapshotStore = new FileSnapshotStore({
        cacheDir: tempDir,
        maxSnapshots: 10,
        maxAgeDays: 7,
        enableCompression: false,
      })

      // Verify the snapshots directory exists and contains files
      const files = await fs.readdir(snapshotsDir)
      expect(files.length).toBeGreaterThan(0)

      // Call getLatestSuccessful - should return null since there are no snapshot directories
      const result = await snapshotStore.getLatestSuccessful()

      expect(result).toBeNull()
    })
  })

  describe('getLatestSuccessful with no successful snapshots', () => {
    /**
     * Test: getLatestSuccessful returns null when all snapshots have failed status
     *
     * **Validates: Requirements 2.3**
     *
     * This test verifies that when the snapshots directory contains only
     * failed snapshots, getLatestSuccessful returns null.
     */
    it('should return null when all snapshots have failed status', async () => {
      // Create the snapshots directory with a failed snapshot
      const snapshotsDir = path.join(tempDir, 'snapshots')
      const failedSnapshotDir = path.join(snapshotsDir, '2024-01-01')
      await fs.mkdir(failedSnapshotDir, { recursive: true })

      // Create metadata.json with failed status
      const metadata = {
        snapshotId: '2024-01-01',
        createdAt: new Date().toISOString(),
        schemaVersion: '1.0.0',
        calculationVersion: '1.0.0',
        status: 'failed',
        configuredDistricts: ['61'],
        successfulDistricts: [],
        failedDistricts: ['61'],
        errors: ['Test error'],
        processingDuration: 1000,
        source: 'test',
        dataAsOfDate: '2024-01-01',
      }
      await fs.writeFile(
        path.join(failedSnapshotDir, 'metadata.json'),
        JSON.stringify(metadata, null, 2)
      )

      // Create manifest.json
      const manifest = {
        snapshotId: '2024-01-01',
        createdAt: new Date().toISOString(),
        districts: [],
        totalDistricts: 1,
        successfulDistricts: 0,
        failedDistricts: 1,
      }
      await fs.writeFile(
        path.join(failedSnapshotDir, 'manifest.json'),
        JSON.stringify(manifest, null, 2)
      )

      snapshotStore = new FileSnapshotStore({
        cacheDir: tempDir,
        maxSnapshots: 10,
        maxAgeDays: 7,
        enableCompression: false,
      })

      // Call getLatestSuccessful - should return null since there are no successful snapshots
      const result = await snapshotStore.getLatestSuccessful()

      expect(result).toBeNull()
    })
  })

  describe('error handling', () => {
    /**
     * Test: getLatestSuccessful does not throw when directory doesn't exist
     *
     * **Validates: Requirements 2.4, 3.1, 3.3**
     *
     * This test explicitly verifies that no error is thrown when the
     * snapshots directory doesn't exist - the method should return null gracefully.
     */
    it('should not throw an error when snapshots directory does not exist', async () => {
      snapshotStore = new FileSnapshotStore({
        cacheDir: tempDir,
        maxSnapshots: 10,
        maxAgeDays: 7,
        enableCompression: false,
      })

      // This should not throw
      await expect(snapshotStore.getLatestSuccessful()).resolves.not.toThrow()
    })

    /**
     * Test: getLatestSuccessful does not throw when directory is empty
     *
     * **Validates: Requirements 2.3, 3.2**
     *
     * This test explicitly verifies that no error is thrown when the
     * snapshots directory is empty - the method should return null gracefully.
     */
    it('should not throw an error when snapshots directory is empty', async () => {
      // Create empty snapshots directory
      const snapshotsDir = path.join(tempDir, 'snapshots')
      await fs.mkdir(snapshotsDir, { recursive: true })

      snapshotStore = new FileSnapshotStore({
        cacheDir: tempDir,
        maxSnapshots: 10,
        maxAgeDays: 7,
        enableCompression: false,
      })

      // This should not throw
      await expect(snapshotStore.getLatestSuccessful()).resolves.not.toThrow()
    })
  })

  describe('cache behavior with empty storage', () => {
    /**
     * Test: Multiple calls to getLatestSuccessful on empty storage return null consistently
     *
     * **Validates: Requirements 2.3, 2.4**
     *
     * This test verifies that the caching mechanism doesn't interfere with
     * empty storage handling - multiple calls should all return null.
     */
    it('should return null consistently on multiple calls to empty storage', async () => {
      snapshotStore = new FileSnapshotStore({
        cacheDir: tempDir,
        maxSnapshots: 10,
        maxAgeDays: 7,
        enableCompression: false,
      })

      // Call multiple times - all should return null
      const result1 = await snapshotStore.getLatestSuccessful()
      const result2 = await snapshotStore.getLatestSuccessful()
      const result3 = await snapshotStore.getLatestSuccessful()

      expect(result1).toBeNull()
      expect(result2).toBeNull()
      expect(result3).toBeNull()
    })

    /**
     * Test: Concurrent calls to getLatestSuccessful on empty storage all return null
     *
     * **Validates: Requirements 2.3, 2.4**
     *
     * This test verifies that concurrent read handling works correctly
     * when storage is empty - all concurrent calls should return null.
     */
    it('should handle concurrent calls to empty storage correctly', async () => {
      snapshotStore = new FileSnapshotStore({
        cacheDir: tempDir,
        maxSnapshots: 10,
        maxAgeDays: 7,
        enableCompression: false,
      })

      // Make concurrent calls
      const results = await Promise.all([
        snapshotStore.getLatestSuccessful(),
        snapshotStore.getLatestSuccessful(),
        snapshotStore.getLatestSuccessful(),
        snapshotStore.getLatestSuccessful(),
        snapshotStore.getLatestSuccessful(),
      ])

      // All results should be null
      results.forEach(result => {
        expect(result).toBeNull()
      })
    })
  })
})
