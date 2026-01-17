/**
 * Basic tests for snapshot infrastructure
 *
 * Tests the core snapshot types, FileSnapshotStore, and utility functions
 * to ensure the basic infrastructure is working correctly.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import { FileSnapshotStore } from '../services/SnapshotStore.js'
import {
  Snapshot,
  // NormalizedData,
  CURRENT_SCHEMA_VERSION,
  CURRENT_CALCULATION_VERSION,
} from '../types/snapshots.js'
import {
  generateSnapshotId,
  isValidSnapshotId,
  getCurrentSchemaVersion,
  getCurrentCalculationVersion,
} from '../utils/snapshotUtils.js'

describe('Snapshot Infrastructure', () => {
  let testCacheDir: string
  let snapshotStore: FileSnapshotStore

  beforeEach(async () => {
    // Create a temporary test directory
    testCacheDir = path.join(
      process.cwd(),
      'test-snapshots',
      `test-${Date.now()}`
    )
    await fs.mkdir(testCacheDir, { recursive: true })

    snapshotStore = new FileSnapshotStore({
      cacheDir: testCacheDir,
      maxSnapshots: 10,
      maxAgeDays: 7,
      enableCompression: false,
    })
  })

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testCacheDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('Snapshot Types', () => {
    it('should have correct current versions', () => {
      expect(CURRENT_SCHEMA_VERSION).toBe('1.0.0')
      expect(CURRENT_CALCULATION_VERSION).toBe('1.0.0')
      expect(getCurrentSchemaVersion()).toBe('1.0.0')
      expect(getCurrentCalculationVersion()).toBe('1.0.0')
    })
  })

  describe('Snapshot Utilities', () => {
    it('should generate valid snapshot IDs', async () => {
      const id1 = generateSnapshotId()
      // Add a small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 1))
      const id2 = generateSnapshotId()

      expect(isValidSnapshotId(id1)).toBe(true)
      expect(isValidSnapshotId(id2)).toBe(true)
      expect(id1).not.toBe(id2) // Should be unique
    })

    it('should validate snapshot ID format', () => {
      expect(isValidSnapshotId('1234567890')).toBe(true)
      expect(isValidSnapshotId('invalid')).toBe(false)
      expect(isValidSnapshotId('')).toBe(false)
      expect(isValidSnapshotId('0')).toBe(false)
    })
  })

  describe('FileSnapshotStore', () => {
    it('should initialize and be ready', async () => {
      const isReady = await snapshotStore.isReady()
      expect(isReady).toBe(true)
    })

    it('should return null when no snapshots exist', async () => {
      const latest = await snapshotStore.getLatest()
      const latestSuccessful = await snapshotStore.getLatestSuccessful()

      expect(latest).toBeNull()
      expect(latestSuccessful).toBeNull()
    })

    it('should write and retrieve a successful snapshot', async () => {
      const dataAsOfDate = '2024-01-01'
      const testSnapshot: Snapshot = {
        snapshot_id: dataAsOfDate, // Will be overwritten by writeSnapshot based on dataAsOfDate
        created_at: new Date().toISOString(),
        schema_version: CURRENT_SCHEMA_VERSION,
        calculation_version: CURRENT_CALCULATION_VERSION,
        status: 'success',
        errors: [],
        payload: {
          districts: [],
          metadata: {
            source: 'test',
            fetchedAt: new Date().toISOString(),
            dataAsOfDate,
            districtCount: 0,
            processingDurationMs: 100,
          },
        },
      }

      await snapshotStore.writeSnapshot(testSnapshot)

      const retrieved = await snapshotStore.getLatest()
      const retrievedSuccessful = await snapshotStore.getLatestSuccessful()
      const retrievedById = await snapshotStore.getSnapshot(dataAsOfDate)

      // Snapshot ID is now based on dataAsOfDate
      expect(retrieved?.snapshot_id).toBe(dataAsOfDate)
      expect(retrieved?.status).toBe('success')
      expect(retrievedSuccessful?.snapshot_id).toBe(dataAsOfDate)
      expect(retrievedById?.snapshot_id).toBe(dataAsOfDate)
    })

    it('should not serve failed snapshots as latest successful', async () => {
      const dataAsOfDate = '2024-01-01'
      const failedSnapshot: Snapshot = {
        snapshot_id: dataAsOfDate,
        created_at: new Date().toISOString(),
        schema_version: CURRENT_SCHEMA_VERSION,
        calculation_version: CURRENT_CALCULATION_VERSION,
        status: 'failed',
        errors: ['Test error'],
        payload: {
          districts: [],
          metadata: {
            source: 'test',
            fetchedAt: new Date().toISOString(),
            dataAsOfDate,
            districtCount: 0,
            processingDurationMs: 100,
          },
        },
      }

      await snapshotStore.writeSnapshot(failedSnapshot)

      const latest = await snapshotStore.getLatest()
      const latestSuccessful = await snapshotStore.getLatestSuccessful()

      expect(latest?.snapshot_id).toBe(dataAsOfDate)
      expect(latest?.status).toBe('failed')
      expect(latestSuccessful).toBeNull() // Should not return failed snapshot
    })

    it('should return latest successful snapshot when mixed with failed snapshots', async () => {
      // Create an older successful snapshot
      const olderSuccessfulSnapshot: Snapshot = {
        snapshot_id: '2024-01-01',
        created_at: '2024-01-01T00:00:00.000Z',
        schema_version: CURRENT_SCHEMA_VERSION,
        calculation_version: CURRENT_CALCULATION_VERSION,
        status: 'success',
        errors: [],
        payload: {
          districts: [],
          metadata: {
            source: 'test',
            fetchedAt: '2024-01-01T00:00:00.000Z',
            dataAsOfDate: '2024-01-01',
            districtCount: 0,
            processingDurationMs: 100,
          },
        },
      }

      // Create a newer failed snapshot
      const newerFailedSnapshot: Snapshot = {
        snapshot_id: '2024-01-02',
        created_at: '2024-01-02T00:00:00.000Z',
        schema_version: CURRENT_SCHEMA_VERSION,
        calculation_version: CURRENT_CALCULATION_VERSION,
        status: 'failed',
        errors: ['Test error'],
        payload: {
          districts: [],
          metadata: {
            source: 'test',
            fetchedAt: '2024-01-02T00:00:00.000Z',
            dataAsOfDate: '2024-01-02',
            districtCount: 0,
            processingDurationMs: 100,
          },
        },
      }

      // Write snapshots in chronological order
      await snapshotStore.writeSnapshot(olderSuccessfulSnapshot)
      await snapshotStore.writeSnapshot(newerFailedSnapshot)

      const latest = await snapshotStore.getLatest()
      const latestSuccessful = await snapshotStore.getLatestSuccessful()

      // getLatest should return the newest snapshot (failed)
      expect(latest?.snapshot_id).toBe('2024-01-02')
      expect(latest?.status).toBe('failed')

      // getLatestSuccessful should return the older successful snapshot, not the newer failed one
      expect(latestSuccessful?.snapshot_id).toBe('2024-01-01')
      expect(latestSuccessful?.status).toBe('success')
    })

    it('should list snapshots with metadata', async () => {
      const dataAsOfDate = '2024-01-01'
      const snapshot1: Snapshot = {
        snapshot_id: dataAsOfDate,
        created_at: new Date().toISOString(),
        schema_version: CURRENT_SCHEMA_VERSION,
        calculation_version: CURRENT_CALCULATION_VERSION,
        status: 'success',
        errors: [],
        payload: {
          districts: [],
          metadata: {
            source: 'test',
            fetchedAt: new Date().toISOString(),
            dataAsOfDate,
            districtCount: 0,
            processingDurationMs: 100,
          },
        },
      }

      await snapshotStore.writeSnapshot(snapshot1)

      const snapshots = await snapshotStore.listSnapshots()

      expect(snapshots).toHaveLength(1)
      expect(snapshots[0]?.snapshot_id).toBe(dataAsOfDate)
      expect(snapshots[0]?.status).toBe('success')
      expect(snapshots[0]?.error_count).toBe(0)
      expect(snapshots[0]?.district_count).toBe(0)
    })

    it('should handle non-existent snapshot retrieval', async () => {
      const nonExistent = await snapshotStore.getSnapshot('nonexistent')
      expect(nonExistent).toBeNull()
    })
  })

  describe('Directory Structure', () => {
    it('should create proper directory structure', async () => {
      await snapshotStore.isReady() // This should create directories

      const snapshotsDir = path.join(testCacheDir, 'snapshots')
      const snapshotsDirExists = await fs
        .access(snapshotsDir)
        .then(() => true)
        .catch(() => false)

      expect(snapshotsDirExists).toBe(true)
    })

    it('should retrieve latest successful snapshot via directory scanning', async () => {
      const dataAsOfDate = '2024-01-01'
      const testSnapshot: Snapshot = {
        snapshot_id: dataAsOfDate,
        created_at: new Date().toISOString(),
        schema_version: CURRENT_SCHEMA_VERSION,
        calculation_version: CURRENT_CALCULATION_VERSION,
        status: 'success',
        errors: [],
        payload: {
          districts: [],
          metadata: {
            source: 'test',
            fetchedAt: new Date().toISOString(),
            dataAsOfDate,
            districtCount: 0,
            processingDurationMs: 100,
          },
        },
      }

      await snapshotStore.writeSnapshot(testSnapshot)

      // Verify latest snapshot can be retrieved via directory scanning (no current.json pointer)
      const latestSnapshot = await snapshotStore.getLatestSuccessful()

      expect(latestSnapshot).not.toBeNull()
      expect(latestSnapshot!.snapshot_id).toBe(dataAsOfDate)
      expect(latestSnapshot!.schema_version).toBe(testSnapshot.schema_version)
      expect(latestSnapshot!.calculation_version).toBe(
        testSnapshot.calculation_version
      )
    })
  })
})
