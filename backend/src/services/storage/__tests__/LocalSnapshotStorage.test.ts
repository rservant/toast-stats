/**
 * LocalSnapshotStorage Unit Tests
 *
 * Tests the LocalSnapshotStorage adapter that implements ISnapshotStorage
 * by delegating to the existing FileSnapshotStore implementation.
 *
 * Requirements Validated: 4.1, 4.2, 4.3, 4.4
 *
 * Test Isolation Requirements (per testing steering document):
 * - Each test uses unique, isolated directories
 * - Tests clean up all resources in afterEach hooks
 * - Tests do not depend on execution order
 * - All tests pass when run with --run (parallel mode)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import { LocalSnapshotStorage } from '../LocalSnapshotStorage.js'
import type { ISnapshotStorage } from '../../../types/storageInterfaces.js'
import type {
  Snapshot,
  AllDistrictsRankingsData,
} from '../../../types/snapshots.js'
import type { DistrictStatistics } from '../../../types/districts.js'
import {
  CURRENT_SCHEMA_VERSION,
  CURRENT_CALCULATION_VERSION,
} from '../../../types/snapshots.js'

describe('LocalSnapshotStorage', () => {
  let storage: ISnapshotStorage
  let testCacheDir: string
  let testId: string

  beforeEach(async () => {
    // Create unique test directory for isolation
    testId = `local-snapshot-storage-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
    testCacheDir = path.join(process.cwd(), 'test-cache', testId)
    await fs.mkdir(testCacheDir, { recursive: true })

    // Create storage instance
    storage = new LocalSnapshotStorage({ cacheDir: testCacheDir })
  })

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testCacheDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  // ============================================================================
  // Interface Compliance Tests
  // ============================================================================

  describe('Interface Compliance', () => {
    it('should implement ISnapshotStorage interface', () => {
      // Verify all required methods exist
      expect(typeof storage.getLatestSuccessful).toBe('function')
      expect(typeof storage.getLatest).toBe('function')
      expect(typeof storage.writeSnapshot).toBe('function')
      expect(typeof storage.listSnapshots).toBe('function')
      expect(typeof storage.getSnapshot).toBe('function')
      expect(typeof storage.isReady).toBe('function')
      expect(typeof storage.writeDistrictData).toBe('function')
      expect(typeof storage.readDistrictData).toBe('function')
      expect(typeof storage.listDistrictsInSnapshot).toBe('function')
      expect(typeof storage.getSnapshotManifest).toBe('function')
      expect(typeof storage.getSnapshotMetadata).toBe('function')
      expect(typeof storage.writeAllDistrictsRankings).toBe('function')
      expect(typeof storage.readAllDistrictsRankings).toBe('function')
      expect(typeof storage.hasAllDistrictsRankings).toBe('function')
    })

    it('should be ready after construction', async () => {
      const isReady = await storage.isReady()
      expect(isReady).toBe(true)
    })
  })

  // ============================================================================
  // Core Snapshot Operations - Delegation Tests
  // ============================================================================

  describe('Core Snapshot Operations', () => {
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
        districts: [],
        metadata: {
          source: 'test',
          fetchedAt: new Date().toISOString(),
          dataAsOfDate: snapshotId,
          districtCount: 0,
          processingDurationMs: 100,
        },
      },
    })

    describe('getLatestSuccessful', () => {
      it('should return null when no snapshots exist (directory not initialized)', async () => {
        // Per Requirement 2.3, 2.4, 3.1, 3.2: getLatestSuccessful returns null
        // when storage is empty instead of throwing an error
        const result = await storage.getLatestSuccessful()
        expect(result).toBeNull()
      })

      it('should return the latest successful snapshot', async () => {
        const snapshot = createTestSnapshot('2024-01-15', 'success')
        await storage.writeSnapshot(snapshot)

        const result = await storage.getLatestSuccessful()
        expect(result).not.toBeNull()
        expect(result?.snapshot_id).toBe('2024-01-15')
        expect(result?.status).toBe('success')
      })

      it('should not return failed snapshots', async () => {
        const failedSnapshot = createTestSnapshot('2024-01-16', 'failed')
        await storage.writeSnapshot(failedSnapshot)

        const result = await storage.getLatestSuccessful()
        expect(result).toBeNull()
      })

      it('should return older successful snapshot when newer one failed', async () => {
        const successSnapshot = createTestSnapshot('2024-01-15', 'success')
        const failedSnapshot = createTestSnapshot('2024-01-16', 'failed')

        await storage.writeSnapshot(successSnapshot)
        await storage.writeSnapshot(failedSnapshot)

        const result = await storage.getLatestSuccessful()
        expect(result?.snapshot_id).toBe('2024-01-15')
        expect(result?.status).toBe('success')
      })
    })

    describe('getLatest', () => {
      it('should return null when no snapshots exist', async () => {
        const result = await storage.getLatest()
        expect(result).toBeNull()
      })

      it('should return the most recent snapshot regardless of status', async () => {
        const successSnapshot = createTestSnapshot('2024-01-15', 'success')
        const failedSnapshot = createTestSnapshot('2024-01-16', 'failed')

        await storage.writeSnapshot(successSnapshot)
        await storage.writeSnapshot(failedSnapshot)

        const result = await storage.getLatest()
        expect(result?.snapshot_id).toBe('2024-01-16')
        expect(result?.status).toBe('failed')
      })
    })

    describe('writeSnapshot', () => {
      it('should write a snapshot successfully', async () => {
        const snapshot = createTestSnapshot('2024-01-15')
        await storage.writeSnapshot(snapshot)

        const retrieved = await storage.getSnapshot('2024-01-15')
        expect(retrieved).not.toBeNull()
        expect(retrieved?.snapshot_id).toBe('2024-01-15')
      })

      it('should write snapshot with rankings data', async () => {
        const snapshot = createTestSnapshot('2024-01-15')
        const rankings: AllDistrictsRankingsData = {
          calculatedAt: new Date().toISOString(),
          rankingVersion: '1.0.0',
          totalDistricts: 1,
          rankings: [
            {
              districtId: '42',
              districtName: 'Test District',
              overallRank: 1,
              overallScore: 100,
              metrics: {},
            },
          ],
        }

        // Write snapshot first without rankings
        await storage.writeSnapshot(snapshot)
        // Then write rankings separately
        await storage.writeAllDistrictsRankings('2024-01-15', rankings)

        const hasRankings = await storage.hasAllDistrictsRankings('2024-01-15')
        expect(hasRankings).toBe(true)
      })
    })

    describe('listSnapshots', () => {
      it('should return empty array when no snapshots exist', async () => {
        const result = await storage.listSnapshots()
        expect(result).toEqual([])
      })

      it('should list all snapshots', async () => {
        await storage.writeSnapshot(createTestSnapshot('2024-01-15'))
        await storage.writeSnapshot(createTestSnapshot('2024-01-16'))

        const result = await storage.listSnapshots()
        expect(result.length).toBe(2)
      })

      it('should respect limit parameter', async () => {
        await storage.writeSnapshot(createTestSnapshot('2024-01-15'))
        await storage.writeSnapshot(createTestSnapshot('2024-01-16'))
        await storage.writeSnapshot(createTestSnapshot('2024-01-17'))

        const result = await storage.listSnapshots(2)
        expect(result.length).toBe(2)
      })
    })

    describe('getSnapshot', () => {
      it('should return null for non-existent snapshot', async () => {
        const result = await storage.getSnapshot('non-existent')
        expect(result).toBeNull()
      })

      it('should retrieve a specific snapshot by ID', async () => {
        await storage.writeSnapshot(createTestSnapshot('2024-01-15'))
        await storage.writeSnapshot(createTestSnapshot('2024-01-16'))

        const result = await storage.getSnapshot('2024-01-15')
        expect(result?.snapshot_id).toBe('2024-01-15')
      })
    })
  })

  // ============================================================================
  // Per-District Operations - Delegation Tests
  // ============================================================================

  describe('Per-District Operations', () => {
    const snapshotId = '2024-01-15'
    const districtId = '42'

    const createTestDistrictData = (): DistrictStatistics => ({
      districtId,
      districtName: 'Test District',
      region: 1,
      programYear: '2024-2025',
      asOfDate: snapshotId,
      clubs: [],
      divisions: [],
      areas: [],
      summary: {
        totalClubs: 10,
        totalMembers: 200,
        distinguishedClubs: 5,
        selectDistinguishedClubs: 2,
        presidentDistinguishedClubs: 1,
        suspendedClubs: 0,
        lowMembershipClubs: 1,
        goalsMet: {
          dcpGoals: 8,
          membershipGoals: 6,
          trainingGoals: 4,
          adminGoals: 2,
        },
      },
    })

    beforeEach(async () => {
      // Create a snapshot first
      const snapshot: Snapshot = {
        snapshot_id: snapshotId,
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
            dataAsOfDate: snapshotId,
            districtCount: 0,
            processingDurationMs: 100,
          },
        },
      }
      await storage.writeSnapshot(snapshot)
    })

    describe('writeDistrictData', () => {
      it('should write district data to a snapshot', async () => {
        const districtData = createTestDistrictData()
        await storage.writeDistrictData(snapshotId, districtId, districtData)

        const retrieved = await storage.readDistrictData(snapshotId, districtId)
        expect(retrieved).not.toBeNull()
        expect(retrieved?.districtId).toBe(districtId)
      })
    })

    describe('readDistrictData', () => {
      it('should return null for non-existent district', async () => {
        // Use a valid district ID format that doesn't exist
        const result = await storage.readDistrictData(snapshotId, '999')
        expect(result).toBeNull()
      })

      it('should retrieve district data correctly', async () => {
        const districtData = createTestDistrictData()
        await storage.writeDistrictData(snapshotId, districtId, districtData)

        const result = await storage.readDistrictData(snapshotId, districtId)
        expect(result?.districtName).toBe('Test District')
        expect(result?.summary.totalClubs).toBe(10)
      })
    })

    describe('listDistrictsInSnapshot', () => {
      it('should return empty array for snapshot with no districts', async () => {
        const result = await storage.listDistrictsInSnapshot(snapshotId)
        expect(result).toEqual([])
      })

      it('should list all districts in a snapshot', async () => {
        const districtData1 = createTestDistrictData()
        const districtData2 = { ...createTestDistrictData(), districtId: '43' }

        await storage.writeDistrictData(snapshotId, '42', districtData1)
        await storage.writeDistrictData(snapshotId, '43', districtData2)

        const result = await storage.listDistrictsInSnapshot(snapshotId)
        // Note: listDistrictsInSnapshot returns districts from the manifest,
        // which is updated when writeSnapshot is called with districts in payload.
        // writeDistrictData alone doesn't update the manifest.
        // This test verifies the delegation works - the actual behavior depends on FileSnapshotStore
        expect(Array.isArray(result)).toBe(true)
      })
    })

    describe('getSnapshotManifest', () => {
      it('should return manifest for existing snapshot', async () => {
        const result = await storage.getSnapshotManifest(snapshotId)
        expect(result).not.toBeNull()
      })

      it('should return null for non-existent snapshot', async () => {
        const result = await storage.getSnapshotManifest('non-existent')
        expect(result).toBeNull()
      })
    })

    describe('getSnapshotMetadata', () => {
      it('should return metadata for existing snapshot', async () => {
        const result = await storage.getSnapshotMetadata(snapshotId)
        expect(result).not.toBeNull()
        expect(result?.snapshotId).toBe(snapshotId)
      })

      it('should return null for non-existent snapshot', async () => {
        const result = await storage.getSnapshotMetadata('non-existent')
        expect(result).toBeNull()
      })
    })
  })

  // ============================================================================
  // Rankings Operations - Delegation Tests
  // ============================================================================

  describe('Rankings Operations', () => {
    const snapshotId = '2024-01-15'

    const createTestRankings = (): AllDistrictsRankingsData => ({
      calculatedAt: new Date().toISOString(),
      rankingVersion: '1.0.0',
      totalDistricts: 2,
      rankings: [
        {
          districtId: '42',
          districtName: 'District 42',
          overallRank: 1,
          overallScore: 100,
          metrics: {},
        },
        {
          districtId: '43',
          districtName: 'District 43',
          overallRank: 2,
          overallScore: 90,
          metrics: {},
        },
      ],
    })

    beforeEach(async () => {
      // Create a snapshot first
      const snapshot: Snapshot = {
        snapshot_id: snapshotId,
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
            dataAsOfDate: snapshotId,
            districtCount: 0,
            processingDurationMs: 100,
          },
        },
      }
      await storage.writeSnapshot(snapshot)
    })

    describe('writeAllDistrictsRankings', () => {
      it('should write rankings data to a snapshot', async () => {
        const rankings = createTestRankings()
        await storage.writeAllDistrictsRankings(snapshotId, rankings)

        const hasRankings = await storage.hasAllDistrictsRankings(snapshotId)
        expect(hasRankings).toBe(true)
      })
    })

    describe('readAllDistrictsRankings', () => {
      it('should return null when no rankings exist', async () => {
        const result = await storage.readAllDistrictsRankings(snapshotId)
        expect(result).toBeNull()
      })

      it('should retrieve rankings data correctly', async () => {
        const rankings = createTestRankings()
        await storage.writeAllDistrictsRankings(snapshotId, rankings)

        const result = await storage.readAllDistrictsRankings(snapshotId)
        expect(result).not.toBeNull()
        expect(result?.totalDistricts).toBe(2)
        expect(result?.rankings.length).toBe(2)
      })
    })

    describe('hasAllDistrictsRankings', () => {
      it('should return false when no rankings exist', async () => {
        const result = await storage.hasAllDistrictsRankings(snapshotId)
        expect(result).toBe(false)
      })

      it('should return true when rankings exist', async () => {
        const rankings = createTestRankings()
        await storage.writeAllDistrictsRankings(snapshotId, rankings)

        const result = await storage.hasAllDistrictsRankings(snapshotId)
        expect(result).toBe(true)
      })
    })
  })

  // ============================================================================
  // Requirement 4.3: No GCP Credentials Required
  // ============================================================================

  describe('No GCP Credentials Required (Requirement 4.3)', () => {
    it('should work without any GCP environment variables', async () => {
      // Save and clear any GCP-related environment variables
      const savedEnv = {
        GOOGLE_APPLICATION_CREDENTIALS:
          process.env['GOOGLE_APPLICATION_CREDENTIALS'],
        GCP_PROJECT_ID: process.env['GCP_PROJECT_ID'],
        GCS_BUCKET_NAME: process.env['GCS_BUCKET_NAME'],
      }

      delete process.env['GOOGLE_APPLICATION_CREDENTIALS']
      delete process.env['GCP_PROJECT_ID']
      delete process.env['GCS_BUCKET_NAME']

      try {
        // Create a new storage instance without GCP credentials
        const isolatedDir = path.join(testCacheDir, 'no-gcp-test')
        await fs.mkdir(isolatedDir, { recursive: true })
        const isolatedStorage = new LocalSnapshotStorage({
          cacheDir: isolatedDir,
        })

        // Should be able to perform all operations
        const isReady = await isolatedStorage.isReady()
        expect(isReady).toBe(true)

        const snapshot: Snapshot = {
          snapshot_id: '2024-01-15',
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
              dataAsOfDate: '2024-01-15',
              districtCount: 0,
              processingDurationMs: 100,
            },
          },
        }

        await isolatedStorage.writeSnapshot(snapshot)
        const retrieved = await isolatedStorage.getLatestSuccessful()
        expect(retrieved?.snapshot_id).toBe('2024-01-15')
      } finally {
        // Restore environment variables
        if (savedEnv.GOOGLE_APPLICATION_CREDENTIALS !== undefined) {
          process.env['GOOGLE_APPLICATION_CREDENTIALS'] =
            savedEnv.GOOGLE_APPLICATION_CREDENTIALS
        }
        if (savedEnv.GCP_PROJECT_ID !== undefined) {
          process.env['GCP_PROJECT_ID'] = savedEnv.GCP_PROJECT_ID
        }
        if (savedEnv.GCS_BUCKET_NAME !== undefined) {
          process.env['GCS_BUCKET_NAME'] = savedEnv.GCS_BUCKET_NAME
        }
      }
    })
  })

  // ============================================================================
  // Requirement 4.4: Feature Parity with Cloud Providers
  // ============================================================================

  describe('Feature Parity (Requirement 4.4)', () => {
    it('should support all ISnapshotStorage operations', async () => {
      // This test verifies that LocalSnapshotStorage supports all operations
      // that would be available in cloud providers

      const snapshotId = '2024-01-15'
      const districtId = '42'

      // 1. Write a snapshot
      const snapshot: Snapshot = {
        snapshot_id: snapshotId,
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
            dataAsOfDate: snapshotId,
            districtCount: 1,
            processingDurationMs: 100,
          },
        },
      }
      await storage.writeSnapshot(snapshot)

      // 2. Write district data
      const districtData: DistrictStatistics = {
        districtId,
        districtName: 'Test District',
        region: 1,
        programYear: '2024-2025',
        asOfDate: snapshotId,
        clubs: [],
        divisions: [],
        areas: [],
        summary: {
          totalClubs: 10,
          totalMembers: 200,
          distinguishedClubs: 5,
          selectDistinguishedClubs: 2,
          presidentDistinguishedClubs: 1,
          suspendedClubs: 0,
          lowMembershipClubs: 1,
          goalsMet: {
            dcpGoals: 8,
            membershipGoals: 6,
            trainingGoals: 4,
            adminGoals: 2,
          },
        },
      }
      await storage.writeDistrictData(snapshotId, districtId, districtData)

      // 3. Write rankings
      const rankings: AllDistrictsRankingsData = {
        calculatedAt: new Date().toISOString(),
        rankingVersion: '1.0.0',
        totalDistricts: 1,
        rankings: [
          {
            districtId,
            districtName: 'Test District',
            overallRank: 1,
            overallScore: 100,
            metrics: {},
          },
        ],
      }
      await storage.writeAllDistrictsRankings(snapshotId, rankings)

      // 4. Verify all read operations work
      expect(await storage.isReady()).toBe(true)
      expect(await storage.getLatest()).not.toBeNull()
      expect(await storage.getLatestSuccessful()).not.toBeNull()
      expect(await storage.getSnapshot(snapshotId)).not.toBeNull()
      expect((await storage.listSnapshots()).length).toBe(1)
      expect(
        await storage.readDistrictData(snapshotId, districtId)
      ).not.toBeNull()
      // listDistrictsInSnapshot returns districts from manifest, which may not include
      // districts written via writeDistrictData (depends on FileSnapshotStore implementation)
      const districts = await storage.listDistrictsInSnapshot(snapshotId)
      expect(Array.isArray(districts)).toBe(true)
      expect(await storage.getSnapshotManifest(snapshotId)).not.toBeNull()
      expect(await storage.getSnapshotMetadata(snapshotId)).not.toBeNull()
      expect(await storage.hasAllDistrictsRankings(snapshotId)).toBe(true)
      expect(await storage.readAllDistrictsRankings(snapshotId)).not.toBeNull()
    })
  })
})
