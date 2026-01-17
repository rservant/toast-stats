/**
 * Unit tests for PerDistrictSnapshotStore ISO date directory naming
 *
 * Tests the generateSnapshotDirectoryName() method and related functionality
 * for converting dataAsOfDate to ISO date format (YYYY-MM-DD) for snapshot directories.
 *
 * Feature: all-districts-rankings-storage
 * Property 7: ISO Date Directory Naming
 * Validates: Requirements 8.1, 8.2
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import {
  FileSnapshotStore,
  PerDistrictFileSnapshotStore,
} from '../SnapshotStore.js'

describe('PerDistrictSnapshotStore ISO Date Directory Naming', () => {
  let testCacheDir: string
  let store: PerDistrictFileSnapshotStore

  beforeEach(async () => {
    // Create unique test cache directory for each test run
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substring(2, 8)
    testCacheDir = path.join(
      process.cwd(),
      'test-cache',
      `iso-date-naming-test-${timestamp}-${randomSuffix}`
    )

    await fs.mkdir(testCacheDir, { recursive: true })

    store = new PerDistrictFileSnapshotStore({
      cacheDir: testCacheDir,
      maxSnapshots: 50,
      maxAgeDays: 7,
    })
  })

  afterEach(async () => {
    // Clean up test cache directory
    try {
      await fs.rm(testCacheDir, { recursive: true, force: true })
    } catch (error) {
      console.warn(`Failed to clean up test cache directory: ${error}`)
    }
  })

  describe('generateSnapshotDirectoryName()', () => {
    it('should generate ISO date format (YYYY-MM-DD) from ISO 8601 date string', () => {
      // Access the private method through type assertion for testing
      const storeWithPrivate = store as unknown as {
        generateSnapshotDirectoryName: (dataAsOfDate: string) => string
      }

      const testCases = [
        { input: '2025-01-07T00:00:00.000Z', expected: '2025-01-07' },
        { input: '2024-12-31T23:59:59.999Z', expected: '2024-12-31' },
        { input: '2025-06-15T12:30:45.123Z', expected: '2025-06-15' },
        { input: '2023-02-28T00:00:00.000Z', expected: '2023-02-28' },
        { input: '2024-02-29T00:00:00.000Z', expected: '2024-02-29' }, // Leap year
      ]

      for (const testCase of testCases) {
        const result = storeWithPrivate.generateSnapshotDirectoryName(
          testCase.input
        )
        expect(result).toBe(testCase.expected)
      }
    })

    it('should generate ISO date format from date-only strings', () => {
      const storeWithPrivate = store as unknown as {
        generateSnapshotDirectoryName: (dataAsOfDate: string) => string
      }

      const testCases = [
        { input: '2025-01-07', expected: '2025-01-07' },
        { input: '2024-12-31', expected: '2024-12-31' },
        { input: '2025-06-15', expected: '2025-06-15' },
      ]

      for (const testCase of testCases) {
        const result = storeWithPrivate.generateSnapshotDirectoryName(
          testCase.input
        )
        expect(result).toBe(testCase.expected)
      }
    })

    it('should pad single-digit months and days with leading zeros', () => {
      const storeWithPrivate = store as unknown as {
        generateSnapshotDirectoryName: (dataAsOfDate: string) => string
      }

      const testCases = [
        { input: '2025-01-01T00:00:00.000Z', expected: '2025-01-01' },
        { input: '2025-09-05T00:00:00.000Z', expected: '2025-09-05' },
        { input: '2025-12-09T00:00:00.000Z', expected: '2025-12-09' },
      ]

      for (const testCase of testCases) {
        const result = storeWithPrivate.generateSnapshotDirectoryName(
          testCase.input
        )
        expect(result).toBe(testCase.expected)
      }
    })

    it('should handle different timezones consistently', () => {
      const storeWithPrivate = store as unknown as {
        generateSnapshotDirectoryName: (dataAsOfDate: string) => string
      }

      // Same date in different timezone representations should produce same result
      const testCases = [
        { input: '2025-01-07T00:00:00.000Z', expected: '2025-01-07' },
        { input: '2025-01-07T05:00:00.000-05:00', expected: '2025-01-07' },
        { input: '2025-01-07T08:00:00.000+08:00', expected: '2025-01-07' },
      ]

      for (const testCase of testCases) {
        const result = storeWithPrivate.generateSnapshotDirectoryName(
          testCase.input
        )
        expect(result).toBe(testCase.expected)
      }
    })
  })

  describe('Directory name matches dataAsOfDate', () => {
    it('should use dataAsOfDate for directory naming when creating snapshots', async () => {
      const dataAsOfDate = '2025-01-07'
      const snapshot = {
        snapshot_id: Date.now().toString(),
        created_at: new Date().toISOString(),
        schema_version: '2.0.0',
        calculation_version: '2.0.0',
        status: 'success' as const,
        errors: [],
        payload: {
          districts: [
            {
              districtId: '42',
              asOfDate: new Date().toISOString(),
              membership: {
                total: 1000,
                change: 50,
                changePercent: 5.0,
                byClub: [],
              },
              clubs: {
                total: 50,
                active: 48,
                suspended: 2,
                ineligible: 0,
                low: 5,
                distinguished: 30,
              },
              education: {
                totalAwards: 200,
                byType: [],
                topClubs: [],
              },
            },
          ],
          metadata: {
            source: 'toastmasters-dashboard',
            fetchedAt: new Date().toISOString(),
            dataAsOfDate,
            districtCount: 1,
            processingDurationMs: 5000,
          },
        },
      }

      await store.writeSnapshot(snapshot)

      // Verify directory was created with ISO date format
      const expectedDirName = '2025-01-07'
      const snapshotDir = path.join(testCacheDir, 'snapshots', expectedDirName)

      const dirExists = await fs
        .access(snapshotDir)
        .then(() => true)
        .catch(() => false)

      expect(dirExists).toBe(true)

      // Verify metadata contains the correct dataAsOfDate
      const metadata = await store.getSnapshotMetadata(expectedDirName)
      expect(metadata).toBeDefined()
      expect(metadata!.dataAsOfDate).toBe(dataAsOfDate)
    })

    it('should handle multiple snapshots with different dates', async () => {
      const testDates = ['2025-01-05', '2025-01-06', '2025-01-07']

      for (const dataAsOfDate of testDates) {
        const snapshot = {
          snapshot_id: Date.now().toString(),
          created_at: new Date().toISOString(),
          schema_version: '2.0.0',
          calculation_version: '2.0.0',
          status: 'success' as const,
          errors: [],
          payload: {
            districts: [
              {
                districtId: '42',
                asOfDate: new Date().toISOString(),
                membership: {
                  total: 1000,
                  change: 50,
                  changePercent: 5.0,
                  byClub: [],
                },
                clubs: {
                  total: 50,
                  active: 48,
                  suspended: 2,
                  ineligible: 0,
                  low: 5,
                  distinguished: 30,
                },
                education: {
                  totalAwards: 200,
                  byType: [],
                  topClubs: [],
                },
              },
            ],
            metadata: {
              source: 'toastmasters-dashboard',
              fetchedAt: new Date().toISOString(),
              dataAsOfDate,
              districtCount: 1,
              processingDurationMs: 5000,
            },
          },
        }

        await store.writeSnapshot(snapshot)

        // Verify each directory was created with correct ISO date format
        const snapshotDir = path.join(testCacheDir, 'snapshots', dataAsOfDate)

        const dirExists = await fs
          .access(snapshotDir)
          .then(() => true)
          .catch(() => false)

        expect(dirExists).toBe(true)
      }

      // Verify all three directories exist
      const snapshotsDir = path.join(testCacheDir, 'snapshots')
      const dirs = await fs.readdir(snapshotsDir)

      for (const expectedDate of testDates) {
        expect(dirs).toContain(expectedDate)
      }
    })
  })

  describe('Directory scanning for latest snapshot', () => {
    it('should find latest snapshot via directory scanning without pointer file', async () => {
      const dataAsOfDate = '2025-01-15'

      const snapshot = {
        snapshot_id: Date.now().toString(),
        created_at: new Date().toISOString(),
        schema_version: '2.0.0',
        calculation_version: '2.0.0',
        status: 'success' as const,
        errors: [],
        payload: {
          districts: [
            {
              districtId: '42',
              asOfDate: new Date().toISOString(),
              membership: {
                total: 1000,
                change: 50,
                changePercent: 5.0,
                byClub: [],
              },
              clubs: {
                total: 50,
                active: 48,
                suspended: 2,
                ineligible: 0,
                low: 5,
                distinguished: 30,
              },
              education: {
                totalAwards: 200,
                byType: [],
                topClubs: [],
              },
            },
          ],
          metadata: {
            source: 'toastmasters-dashboard',
            fetchedAt: new Date().toISOString(),
            dataAsOfDate,
            districtCount: 1,
            processingDurationMs: 5000,
          },
        },
      }

      // Write snapshot
      await store.writeSnapshot(snapshot)

      // Verify snapshot directory was created
      const snapshotDir = path.join(testCacheDir, 'snapshots', dataAsOfDate)
      const dirExists = await fs
        .access(snapshotDir)
        .then(() => true)
        .catch(() => false)
      expect(dirExists).toBe(true)

      // Verify no current.json pointer file is created (directory scanning is primary mechanism)
      const currentPointerPath = path.join(testCacheDir, 'current.json')
      const currentExists = await fs
        .access(currentPointerPath)
        .then(() => true)
        .catch(() => false)
      expect(currentExists).toBe(false)

      // Verify latest snapshot can be retrieved via directory scanning
      const latestSnapshot = await store.getLatestSuccessful()
      expect(latestSnapshot).not.toBeNull()
      expect(latestSnapshot!.snapshot_id).toBe(dataAsOfDate)
    })

    it('should find latest snapshot among multiple snapshots via directory scanning', async () => {
      const dates = ['2025-01-10', '2025-01-11', '2025-01-12']

      for (const dataAsOfDate of dates) {
        const snapshot = {
          snapshot_id: Date.now().toString(),
          created_at: new Date().toISOString(),
          schema_version: '2.0.0',
          calculation_version: '2.0.0',
          status: 'success' as const,
          errors: [],
          payload: {
            districts: [
              {
                districtId: '42',
                asOfDate: new Date().toISOString(),
                membership: {
                  total: 1000,
                  change: 50,
                  changePercent: 5.0,
                  byClub: [],
                },
                clubs: {
                  total: 50,
                  active: 48,
                  suspended: 2,
                  ineligible: 0,
                  low: 5,
                  distinguished: 30,
                },
                education: {
                  totalAwards: 200,
                  byType: [],
                  topClubs: [],
                },
              },
            ],
            metadata: {
              source: 'toastmasters-dashboard',
              fetchedAt: new Date().toISOString(),
              dataAsOfDate,
              districtCount: 1,
              processingDurationMs: 5000,
            },
          },
        }

        await store.writeSnapshot(snapshot)
      }

      // Verify latest snapshot is found via directory scanning (should be the most recent date)
      const latestSnapshot = await store.getLatestSuccessful()
      expect(latestSnapshot).not.toBeNull()
      expect(latestSnapshot!.snapshot_id).toBe('2025-01-12')

      // Verify no current.json pointer file exists
      const currentPointerPath = path.join(testCacheDir, 'current.json')
      const currentExists = await fs
        .access(currentPointerPath)
        .then(() => true)
        .catch(() => false)
      expect(currentExists).toBe(false)
    })
  })
})
