/**
 * Tests for ISO Date-based Snapshot Migration
 *
 * Verifies that the migration from timestamp-based to ISO date-based
 * snapshot directories works correctly.
 *
 * Feature: all-districts-rankings-storage
 * Task: 10.3 Perform migration
 * Validates: Requirements 8.1, 8.2, 8.3, 8.5
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { promises as fs } from 'fs'
import path from 'path'
import { FileSnapshotStore } from '../SnapshotStore.js'
import type { Snapshot, NormalizedData } from '../../types/snapshots.js'

describe('ISO Date-based Snapshot Migration', () => {
  let testCacheDir: string
  let snapshotStore: FileSnapshotStore

  beforeEach(async () => {
    // Create unique test cache directory
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substring(2, 8)
    testCacheDir = path.join(
      process.cwd(),
      'test-cache',
      `migration-test-${timestamp}-${randomSuffix}`
    )

    await fs.mkdir(testCacheDir, { recursive: true })

    snapshotStore = new FileSnapshotStore({
      cacheDir: testCacheDir,
      maxSnapshots: 50,
      maxAgeDays: 7,
    })
  })

  afterEach(async () => {
    try {
      await fs.rm(testCacheDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
    vi.clearAllMocks()
  })

  describe('Snapshot Directory Naming', () => {
    it('should create snapshot directory with ISO date format (YYYY-MM-DD)', async () => {
      // Create a test snapshot
      const testDate = '2026-01-07'
      const normalizedData: NormalizedData = {
        districts: [],
        metadata: {
          source: 'test',
          fetchedAt: new Date().toISOString(),
          dataAsOfDate: testDate,
          districtCount: 0,
          processingDurationMs: 100,
        },
      }

      const snapshot: Snapshot = {
        snapshot_id: Date.now().toString(),
        created_at: new Date().toISOString(),
        schema_version: '1.0.0',
        calculation_version: '1.0.0',
        status: 'success',
        errors: [],
        payload: normalizedData,
      }

      // Write the snapshot
      await snapshotStore.writeSnapshot(snapshot)

      // Verify directory was created with ISO date name
      const snapshotsDir = path.join(testCacheDir, 'snapshots')
      const directories = await fs.readdir(snapshotsDir)

      expect(directories).toHaveLength(1)
      expect(directories[0]).toBe(testDate)
      expect(directories[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('should overwrite existing snapshot for same date', async () => {
      const testDate = '2026-01-07'

      // Create first snapshot
      const normalizedData1: NormalizedData = {
        districts: [
          {
            districtId: '1',
            asOfDate: testDate,
            membership: { total: 100, change: 0, changePercent: 0, byClub: [] },
            clubs: {
              total: 10,
              active: 10,
              suspended: 0,
              ineligible: 0,
              low: 0,
              distinguished: 5,
            },
            education: { totalAwards: 0, byType: [], topClubs: [] },
          },
        ],
        metadata: {
          source: 'test',
          fetchedAt: new Date().toISOString(),
          dataAsOfDate: testDate,
          districtCount: 1,
          processingDurationMs: 100,
        },
      }

      const snapshot1: Snapshot = {
        snapshot_id: Date.now().toString(),
        created_at: new Date().toISOString(),
        schema_version: '1.0.0',
        calculation_version: '1.0.0',
        status: 'success',
        errors: [],
        payload: normalizedData1,
      }

      await snapshotStore.writeSnapshot(snapshot1)

      // Create second snapshot for same date with different data
      const normalizedData2: NormalizedData = {
        districts: [
          {
            districtId: '1',
            asOfDate: testDate,
            membership: { total: 200, change: 0, changePercent: 0, byClub: [] },
            clubs: {
              total: 20,
              active: 20,
              suspended: 0,
              ineligible: 0,
              low: 0,
              distinguished: 10,
            },
            education: { totalAwards: 0, byType: [], topClubs: [] },
          },
        ],
        metadata: {
          source: 'test',
          fetchedAt: new Date().toISOString(),
          dataAsOfDate: testDate,
          districtCount: 1,
          processingDurationMs: 100,
        },
      }

      const snapshot2: Snapshot = {
        snapshot_id: Date.now().toString(),
        created_at: new Date().toISOString(),
        schema_version: '1.0.0',
        calculation_version: '1.0.0',
        status: 'success',
        errors: [],
        payload: normalizedData2,
      }

      await snapshotStore.writeSnapshot(snapshot2)

      // Verify only one directory exists
      const snapshotsDir = path.join(testCacheDir, 'snapshots')
      const directories = await fs.readdir(snapshotsDir)
      expect(directories).toHaveLength(1)
      expect(directories[0]).toBe(testDate)

      // Verify the data is from the second snapshot
      const readSnapshot = await snapshotStore.getSnapshot(testDate)
      expect(readSnapshot).toBeDefined()
      expect(readSnapshot!.payload.districts[0]?.membership.total).toBe(200)
    })

    it('should create separate directories for different dates', async () => {
      const dates = ['2026-01-05', '2026-01-06', '2026-01-07']

      for (const testDate of dates) {
        const normalizedData: NormalizedData = {
          districts: [],
          metadata: {
            source: 'test',
            fetchedAt: new Date().toISOString(),
            dataAsOfDate: testDate,
            districtCount: 0,
            processingDurationMs: 100,
          },
        }

        const snapshot: Snapshot = {
          snapshot_id: Date.now().toString(),
          created_at: new Date().toISOString(),
          schema_version: '1.0.0',
          calculation_version: '1.0.0',
          status: 'success',
          errors: [],
          payload: normalizedData,
        }

        await snapshotStore.writeSnapshot(snapshot)
      }

      // Verify all directories exist
      const snapshotsDir = path.join(testCacheDir, 'snapshots')
      const directories = await fs.readdir(snapshotsDir)

      expect(directories).toHaveLength(3)
      expect(directories.sort()).toEqual(dates.sort())
    })
  })

  describe('Latest Snapshot Retrieval', () => {
    it('should retrieve latest snapshot using directory scanning', async () => {
      const testDate = '2026-01-07'
      const normalizedData: NormalizedData = {
        districts: [],
        metadata: {
          source: 'test',
          fetchedAt: new Date().toISOString(),
          dataAsOfDate: testDate,
          districtCount: 0,
          processingDurationMs: 100,
        },
      }

      const snapshot: Snapshot = {
        snapshot_id: Date.now().toString(),
        created_at: new Date().toISOString(),
        schema_version: '1.0.0',
        calculation_version: '1.0.0',
        status: 'success',
        errors: [],
        payload: normalizedData,
      }

      await snapshotStore.writeSnapshot(snapshot)

      // Verify latest snapshot can be retrieved via directory scanning
      const latestSnapshot = await snapshotStore.getLatestSuccessful()

      expect(latestSnapshot).not.toBeNull()
      expect(latestSnapshot!.snapshot_id).toBe(testDate)
      expect(latestSnapshot!.snapshot_id).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })

  describe('Snapshot Retrieval', () => {
    it('should retrieve snapshot by ISO date ID', async () => {
      const testDate = '2026-01-07'
      const normalizedData: NormalizedData = {
        districts: [
          {
            districtId: '42',
            asOfDate: testDate,
            membership: { total: 500, change: 0, changePercent: 0, byClub: [] },
            clubs: {
              total: 50,
              active: 48,
              suspended: 2,
              ineligible: 0,
              low: 0,
              distinguished: 25,
            },
            education: { totalAwards: 100, byType: [], topClubs: [] },
          },
        ],
        metadata: {
          source: 'test',
          fetchedAt: new Date().toISOString(),
          dataAsOfDate: testDate,
          districtCount: 1,
          processingDurationMs: 100,
        },
      }

      const snapshot: Snapshot = {
        snapshot_id: Date.now().toString(),
        created_at: new Date().toISOString(),
        schema_version: '1.0.0',
        calculation_version: '1.0.0',
        status: 'success',
        errors: [],
        payload: normalizedData,
      }

      await snapshotStore.writeSnapshot(snapshot)

      // Retrieve by ISO date ID
      const retrieved = await snapshotStore.getSnapshot(testDate)

      expect(retrieved).toBeDefined()
      expect(retrieved!.snapshot_id).toBe(testDate)
      expect(retrieved!.payload.districts).toHaveLength(1)
      expect(retrieved!.payload.districts[0]?.districtId).toBe('42')
    })

    it('should get latest successful snapshot with ISO date ID', async () => {
      const testDate = '2026-01-07'
      const normalizedData: NormalizedData = {
        districts: [],
        metadata: {
          source: 'test',
          fetchedAt: new Date().toISOString(),
          dataAsOfDate: testDate,
          districtCount: 0,
          processingDurationMs: 100,
        },
      }

      const snapshot: Snapshot = {
        snapshot_id: Date.now().toString(),
        created_at: new Date().toISOString(),
        schema_version: '1.0.0',
        calculation_version: '1.0.0',
        status: 'success',
        errors: [],
        payload: normalizedData,
      }

      await snapshotStore.writeSnapshot(snapshot)

      // Get latest successful
      const latest = await snapshotStore.getLatestSuccessful()

      expect(latest).toBeDefined()
      expect(latest!.snapshot_id).toBe(testDate)
      expect(latest!.snapshot_id).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })

  describe('Metadata Consistency', () => {
    it('should store correct snapshotId in metadata.json', async () => {
      const testDate = '2026-01-07'
      const normalizedData: NormalizedData = {
        districts: [],
        metadata: {
          source: 'test',
          fetchedAt: new Date().toISOString(),
          dataAsOfDate: testDate,
          districtCount: 0,
          processingDurationMs: 100,
        },
      }

      const snapshot: Snapshot = {
        snapshot_id: Date.now().toString(),
        created_at: new Date().toISOString(),
        schema_version: '1.0.0',
        calculation_version: '1.0.0',
        status: 'success',
        errors: [],
        payload: normalizedData,
      }

      await snapshotStore.writeSnapshot(snapshot)

      // Read metadata.json directly
      const metadataPath = path.join(
        testCacheDir,
        'snapshots',
        testDate,
        'metadata.json'
      )
      const metadataContent = await fs.readFile(metadataPath, 'utf-8')
      const metadata = JSON.parse(metadataContent)

      expect(metadata.snapshotId).toBe(testDate)
      expect(metadata.dataAsOfDate).toBe(testDate)
    })
  })
})
