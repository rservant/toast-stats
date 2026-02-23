/**
 * Unit tests for FileSnapshotStore pointer reader and fallback behavior
 *
 * These tests validate the two-phase approach for resolving the latest
 * successful snapshot: fast path via pointer file, fallback via directory scan,
 * and pointer repair after fallback.
 *
 * **Validates: Requirements 2.1, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 5.1, 5.2, 5.3**
 *
 * Test Isolation:
 * - Each test uses unique, isolated temporary directories
 * - Tests clean up resources in afterEach hooks
 * - Tests do not depend on execution order
 * - All tests pass when run with `--run` (parallel mode)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { FileSnapshotStore } from '../SnapshotStore.js'
import { SCHEMA_VERSION } from '@toastmasters/shared-contracts'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

/**
 * Helper: create a valid metadata.json for a snapshot directory.
 */
function createMetadata(
  snapshotId: string,
  status: 'success' | 'partial' | 'failed'
): Record<string, unknown> {
  return {
    snapshotId,
    createdAt: new Date().toISOString(),
    schemaVersion: '1.0.0',
    calculationVersion: '1.0.0',
    status,
    configuredDistricts: ['61'],
    successfulDistricts: status === 'success' ? ['61'] : [],
    failedDistricts: status === 'failed' ? ['61'] : [],
    errors: status === 'failed' ? ['Test error'] : [],
    processingDuration: 1000,
    source: 'test',
    dataAsOfDate: snapshotId,
  }
}

/**
 * Helper: create a valid manifest.json for a snapshot directory.
 */
function createManifest(
  snapshotId: string,
  status: 'success' | 'partial' | 'failed'
): Record<string, unknown> {
  return {
    snapshotId,
    createdAt: new Date().toISOString(),
    districts:
      status === 'success'
        ? [
            {
              districtId: '61',
              fileName: 'district_61.json',
              status: 'success',
              fileSize: 100,
              lastModified: new Date().toISOString(),
            },
          ]
        : [],
    totalDistricts: 1,
    successfulDistricts: status === 'success' ? 1 : 0,
    failedDistricts: status === 'failed' ? 1 : 0,
  }
}

/**
 * Helper: create a minimal district data file.
 */
function createDistrictData(): Record<string, unknown> {
  return {
    schemaVersion: '1.0.0',
    districtId: '61',
    asOfDate: new Date().toISOString(),
    membership: {
      total: 100,
      change: 5,
      changePercent: 5.26,
      byClub: [],
      new: 10,
      renewed: 5,
      dual: 2,
    },
    clubs: {
      total: 50,
      active: 45,
      suspended: 2,
      ineligible: 1,
      low: 2,
      distinguished: 10,
      chartered: 1,
    },
    education: {
      totalAwards: 25,
      byType: [],
      topClubs: [],
    },
  }
}

/**
 * Helper: create a valid snapshot pointer file content.
 */
function createPointerContent(snapshotId: string): Record<string, unknown> {
  return {
    snapshotId,
    updatedAt: new Date().toISOString(),
    schemaVersion: SCHEMA_VERSION,
  }
}

/**
 * Helper: set up a complete snapshot directory with metadata, manifest, and district data.
 */
async function setupSnapshotDirectory(
  snapshotsDir: string,
  snapshotId: string,
  status: 'success' | 'partial' | 'failed' = 'success'
): Promise<void> {
  const snapshotDir = path.join(snapshotsDir, snapshotId)
  await fs.mkdir(snapshotDir, { recursive: true })

  await fs.writeFile(
    path.join(snapshotDir, 'metadata.json'),
    JSON.stringify(createMetadata(snapshotId, status), null, 2)
  )

  await fs.writeFile(
    path.join(snapshotDir, 'manifest.json'),
    JSON.stringify(createManifest(snapshotId, status), null, 2)
  )

  if (status === 'success') {
    await fs.writeFile(
      path.join(snapshotDir, 'district_61.json'),
      JSON.stringify(createDistrictData(), null, 2)
    )
  }
}

describe('FileSnapshotStore Pointer Reader and Fallback', () => {
  let tempDir: string
  let snapshotsDir: string
  let snapshotStore: FileSnapshotStore

  beforeEach(async () => {
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substring(2, 8)
    tempDir = await fs.mkdtemp(
      path.join(
        os.tmpdir(),
        `snapshot-store-pointer-test-${timestamp}-${randomSuffix}-`
      )
    )
    snapshotsDir = path.join(tempDir, 'snapshots')
    await fs.mkdir(snapshotsDir, { recursive: true })

    snapshotStore = new FileSnapshotStore({
      cacheDir: tempDir,
      maxSnapshots: 10,
      maxAgeDays: 7,
      enableCompression: false,
    })
  })

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('fast path with valid pointer', () => {
    /**
     * Test: Valid pointer file returns the correct snapshot directly
     *
     * **Validates: Requirements 2.1**
     *
     * When a valid pointer file exists and references a snapshot directory
     * with status "success", the store should resolve the snapshot via the
     * pointer without scanning other directories.
     */
    it('should return the correct snapshot when pointer is valid', async () => {
      // Set up two snapshot directories - the pointer references the latest
      await setupSnapshotDirectory(snapshotsDir, '2024-01-01')
      await setupSnapshotDirectory(snapshotsDir, '2024-01-15')

      // Write a valid pointer referencing the latest snapshot
      const pointerPath = path.join(snapshotsDir, 'latest-successful.json')
      await fs.writeFile(
        pointerPath,
        JSON.stringify(createPointerContent('2024-01-15'), null, 2)
      )

      const result = await snapshotStore.getLatestSuccessful()

      expect(result).not.toBeNull()
      expect(result?.snapshot_id).toBe('2024-01-15')
      expect(result?.status).toBe('success')
    })
  })

  describe('missing pointer file triggers fallback', () => {
    /**
     * Test: Missing pointer file falls back to directory scan
     *
     * **Validates: Requirements 3.1, 5.1**
     *
     * When the pointer file does not exist, the store should fall back
     * to scanning directories and still find the latest successful snapshot.
     * This ensures backward compatibility when the collector-cli hasn't been
     * updated yet.
     */
    it('should fall back to directory scan when pointer file is missing', async () => {
      // Set up snapshot directories but NO pointer file
      await setupSnapshotDirectory(snapshotsDir, '2024-01-01')
      await setupSnapshotDirectory(snapshotsDir, '2024-01-15')

      // Verify no pointer file exists
      const pointerPath = path.join(snapshotsDir, 'latest-successful.json')
      const pointerExists = await fs
        .access(pointerPath)
        .then(() => true)
        .catch(() => false)
      expect(pointerExists).toBe(false)

      const result = await snapshotStore.getLatestSuccessful()

      expect(result).not.toBeNull()
      expect(result?.snapshot_id).toBe('2024-01-15')
      expect(result?.status).toBe('success')
    })
  })

  describe('invalid JSON pointer triggers fallback', () => {
    /**
     * Test: Invalid JSON in pointer file falls back to directory scan
     *
     * **Validates: Requirements 3.2**
     *
     * When the pointer file contains invalid JSON, the store should
     * log a warning and fall back to the directory scan.
     */
    it('should fall back to directory scan when pointer contains invalid JSON', async () => {
      await setupSnapshotDirectory(snapshotsDir, '2024-01-10')

      // Write invalid JSON to the pointer file
      const pointerPath = path.join(snapshotsDir, 'latest-successful.json')
      await fs.writeFile(pointerPath, '{not valid json!!!', 'utf-8')

      const result = await snapshotStore.getLatestSuccessful()

      expect(result).not.toBeNull()
      expect(result?.snapshot_id).toBe('2024-01-10')
      expect(result?.status).toBe('success')
    })

    /**
     * Test: Pointer with missing required fields falls back to directory scan
     *
     * **Validates: Requirements 3.2**
     *
     * When the pointer file contains valid JSON but fails Zod schema
     * validation (e.g., missing snapshotId), the store should fall back.
     */
    it('should fall back when pointer has valid JSON but missing required fields', async () => {
      await setupSnapshotDirectory(snapshotsDir, '2024-02-01')

      // Write JSON that is valid but doesn't match the SnapshotPointer schema
      const pointerPath = path.join(snapshotsDir, 'latest-successful.json')
      await fs.writeFile(
        pointerPath,
        JSON.stringify({ someField: 'not a pointer' }),
        'utf-8'
      )

      const result = await snapshotStore.getLatestSuccessful()

      expect(result).not.toBeNull()
      expect(result?.snapshot_id).toBe('2024-02-01')
      expect(result?.status).toBe('success')
    })
  })

  describe('pointer to non-existent directory triggers fallback', () => {
    /**
     * Test: Pointer referencing a non-existent snapshot directory falls back
     *
     * **Validates: Requirements 2.4**
     *
     * When the pointer references a snapshot ID whose directory doesn't exist,
     * the store should fall back to the directory scan.
     */
    it('should fall back when pointer references non-existent directory', async () => {
      await setupSnapshotDirectory(snapshotsDir, '2024-03-01')

      // Write pointer referencing a snapshot that doesn't exist on disk
      const pointerPath = path.join(snapshotsDir, 'latest-successful.json')
      await fs.writeFile(
        pointerPath,
        JSON.stringify(createPointerContent('2024-12-31'), null, 2)
      )

      const result = await snapshotStore.getLatestSuccessful()

      expect(result).not.toBeNull()
      expect(result?.snapshot_id).toBe('2024-03-01')
      expect(result?.status).toBe('success')
    })
  })

  describe('pointer to non-success snapshot triggers fallback', () => {
    /**
     * Test: Pointer referencing a failed snapshot falls back to directory scan
     *
     * **Validates: Requirements 2.3**
     *
     * When the pointer references a snapshot directory that exists but has
     * a non-success status (e.g., "failed"), the store should fall back
     * to scanning for the actual latest successful snapshot.
     */
    it('should fall back when pointer references a failed snapshot', async () => {
      // Set up a successful snapshot and a failed one
      await setupSnapshotDirectory(snapshotsDir, '2024-04-01')
      await setupSnapshotDirectory(snapshotsDir, '2024-04-15', 'failed')

      // Pointer references the failed snapshot
      const pointerPath = path.join(snapshotsDir, 'latest-successful.json')
      await fs.writeFile(
        pointerPath,
        JSON.stringify(createPointerContent('2024-04-15'), null, 2)
      )

      const result = await snapshotStore.getLatestSuccessful()

      expect(result).not.toBeNull()
      expect(result?.snapshot_id).toBe('2024-04-01')
      expect(result?.status).toBe('success')
    })

    /**
     * Test: Pointer referencing a partial snapshot falls back to directory scan
     *
     * **Validates: Requirements 2.3**
     *
     * When the pointer references a snapshot with "partial" status,
     * the store should fall back to scanning for a fully successful snapshot.
     */
    it('should fall back when pointer references a partial snapshot', async () => {
      await setupSnapshotDirectory(snapshotsDir, '2024-05-01')
      await setupSnapshotDirectory(snapshotsDir, '2024-05-10', 'partial')

      // Pointer references the partial snapshot
      const pointerPath = path.join(snapshotsDir, 'latest-successful.json')
      await fs.writeFile(
        pointerPath,
        JSON.stringify(createPointerContent('2024-05-10'), null, 2)
      )

      const result = await snapshotStore.getLatestSuccessful()

      expect(result).not.toBeNull()
      expect(result?.snapshot_id).toBe('2024-05-01')
      expect(result?.status).toBe('success')
    })
  })

  describe('fallback repairs pointer file', () => {
    /**
     * Test: After fallback scan succeeds, the pointer file is repaired
     *
     * **Validates: Requirements 3.4**
     *
     * When the pointer is missing or invalid and the fallback scan finds
     * a successful snapshot, the store should write a new valid pointer
     * file so that subsequent cold starts are fast.
     */
    it('should write a valid pointer file after successful fallback scan', async () => {
      await setupSnapshotDirectory(snapshotsDir, '2024-06-01')

      // No pointer file exists initially
      const pointerPath = path.join(snapshotsDir, 'latest-successful.json')
      const pointerExistsBefore = await fs
        .access(pointerPath)
        .then(() => true)
        .catch(() => false)
      expect(pointerExistsBefore).toBe(false)

      // Trigger getLatestSuccessful which will fall back and repair
      const result = await snapshotStore.getLatestSuccessful()
      expect(result).not.toBeNull()
      expect(result?.snapshot_id).toBe('2024-06-01')

      // Verify the pointer file was created
      const pointerExistsAfter = await fs
        .access(pointerPath)
        .then(() => true)
        .catch(() => false)
      expect(pointerExistsAfter).toBe(true)

      // Verify the pointer content is valid and references the correct snapshot
      const pointerContent = JSON.parse(
        await fs.readFile(pointerPath, 'utf-8')
      ) as Record<string, unknown>
      expect(pointerContent['snapshotId']).toBe('2024-06-01')
      expect(pointerContent['updatedAt']).toBeDefined()
      expect(pointerContent['schemaVersion']).toBe(SCHEMA_VERSION)
    })

    /**
     * Test: Repaired pointer works on subsequent calls (no second scan needed)
     *
     * **Validates: Requirements 3.4, 2.1**
     *
     * After the pointer is repaired by a fallback scan, a fresh store
     * instance should be able to use the pointer directly.
     */
    it('should allow subsequent reads to use the repaired pointer', async () => {
      await setupSnapshotDirectory(snapshotsDir, '2024-06-15')

      // First call: no pointer, triggers fallback + repair
      const result1 = await snapshotStore.getLatestSuccessful()
      expect(result1).not.toBeNull()
      expect(result1?.snapshot_id).toBe('2024-06-15')

      // Create a fresh store instance (simulating a new cold start)
      const freshStore = new FileSnapshotStore({
        cacheDir: tempDir,
        maxSnapshots: 10,
        maxAgeDays: 7,
        enableCompression: false,
      })

      // Second call on fresh store: should use the repaired pointer
      const result2 = await freshStore.getLatestSuccessful()
      expect(result2).not.toBeNull()
      expect(result2?.snapshot_id).toBe('2024-06-15')
    })
  })

  describe('backward compatibility with no pointer file', () => {
    /**
     * Test: Backend works correctly with no pointer file (backward compatibility)
     *
     * **Validates: Requirements 5.1**
     *
     * When the backend is updated but the collector-cli has not yet been
     * updated to write pointer files, the backend should operate using
     * the existing full directory scan without errors.
     */
    it('should find latest successful snapshot via scan when no pointer exists', async () => {
      // Set up multiple snapshots with different statuses, no pointer
      await setupSnapshotDirectory(snapshotsDir, '2024-07-01')
      await setupSnapshotDirectory(snapshotsDir, '2024-07-10', 'failed')
      await setupSnapshotDirectory(snapshotsDir, '2024-07-05')

      const result = await snapshotStore.getLatestSuccessful()

      // Should find the latest successful snapshot by date (2024-07-05)
      // since 2024-07-10 is failed
      expect(result).not.toBeNull()
      expect(result?.snapshot_id).toBe('2024-07-05')
      expect(result?.status).toBe('success')
    })

    /**
     * Test: Backend returns null gracefully when no snapshots exist and no pointer
     *
     * **Validates: Requirements 5.1**
     *
     * When neither pointer nor snapshot directories exist, the backend
     * should return null without errors.
     */
    it('should return null when no snapshots and no pointer exist', async () => {
      // Empty snapshots directory, no pointer
      const result = await snapshotStore.getLatestSuccessful()
      expect(result).toBeNull()
    })
  })

  describe('pointer write does not modify existing snapshot files', () => {
    /**
     * Test: Writing a pointer file does not modify existing snapshot files
     *
     * **Validates: Requirements 5.2, 5.3**
     *
     * The pointer file is stored alongside existing snapshot directories
     * without modifying any existing file or directory layout. This test
     * verifies that after a fallback repair writes the pointer, all
     * existing snapshot files remain unchanged.
     */
    it('should not modify existing snapshot files when pointer is written', async () => {
      const snapshotId = '2024-08-01'
      await setupSnapshotDirectory(snapshotsDir, snapshotId)

      // Record the content of all snapshot files before the pointer write
      const snapshotDir = path.join(snapshotsDir, snapshotId)
      const metadataBefore = await fs.readFile(
        path.join(snapshotDir, 'metadata.json'),
        'utf-8'
      )
      const manifestBefore = await fs.readFile(
        path.join(snapshotDir, 'manifest.json'),
        'utf-8'
      )
      const districtBefore = await fs.readFile(
        path.join(snapshotDir, 'district_61.json'),
        'utf-8'
      )

      // Record file stats (modification times) before
      const metadataStatBefore = await fs.stat(
        path.join(snapshotDir, 'metadata.json')
      )
      const manifestStatBefore = await fs.stat(
        path.join(snapshotDir, 'manifest.json')
      )
      const districtStatBefore = await fs.stat(
        path.join(snapshotDir, 'district_61.json')
      )

      // Trigger getLatestSuccessful which will fall back and write the pointer
      const result = await snapshotStore.getLatestSuccessful()
      expect(result).not.toBeNull()

      // Verify the pointer file was created
      const pointerPath = path.join(snapshotsDir, 'latest-successful.json')
      const pointerExists = await fs
        .access(pointerPath)
        .then(() => true)
        .catch(() => false)
      expect(pointerExists).toBe(true)

      // Verify all existing snapshot files are unchanged
      const metadataAfter = await fs.readFile(
        path.join(snapshotDir, 'metadata.json'),
        'utf-8'
      )
      const manifestAfter = await fs.readFile(
        path.join(snapshotDir, 'manifest.json'),
        'utf-8'
      )
      const districtAfter = await fs.readFile(
        path.join(snapshotDir, 'district_61.json'),
        'utf-8'
      )

      expect(metadataAfter).toBe(metadataBefore)
      expect(manifestAfter).toBe(manifestBefore)
      expect(districtAfter).toBe(districtBefore)

      // Verify modification times are unchanged
      const metadataStatAfter = await fs.stat(
        path.join(snapshotDir, 'metadata.json')
      )
      const manifestStatAfter = await fs.stat(
        path.join(snapshotDir, 'manifest.json')
      )
      const districtStatAfter = await fs.stat(
        path.join(snapshotDir, 'district_61.json')
      )

      expect(metadataStatAfter.mtimeMs).toBe(metadataStatBefore.mtimeMs)
      expect(manifestStatAfter.mtimeMs).toBe(manifestStatBefore.mtimeMs)
      expect(districtStatAfter.mtimeMs).toBe(districtStatBefore.mtimeMs)

      // Verify the snapshot directory listing only gained the pointer file
      const snapshotsDirContents = await fs.readdir(snapshotsDir)
      expect(snapshotsDirContents).toContain(snapshotId)
      expect(snapshotsDirContents).toContain('latest-successful.json')
      // No .tmp files should remain
      const tmpFiles = snapshotsDirContents.filter(f => f.includes('.tmp'))
      expect(tmpFiles).toHaveLength(0)
    })
  })
})
