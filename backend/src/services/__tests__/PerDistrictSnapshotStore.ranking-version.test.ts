/**
 * Tests for ranking version functionality in PerDistrictSnapshotStore
 *
 * Tests that the ranking version is properly extracted from district data
 * and stored in snapshot metadata.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  FileSnapshotStore,
} from '../SnapshotStore.js'
import type { Snapshot, NormalizedData } from '../../types/snapshots.js'
import type { DistrictStatistics } from '../../types/districts.js'
import fs from 'fs/promises'
import path from 'path'

describe('PerDistrictSnapshotStore - Ranking Version', () => {
  let store: FileSnapshotStore
  let testCacheDir: string

  beforeEach(async () => {
    // Create unique test cache directory
    testCacheDir = path.join(
      process.cwd(),
      'test-cache',
      `ranking-version-test-${Date.now()}-${Math.random().toString(36).substring(7)}`
    )
    await fs.mkdir(testCacheDir, { recursive: true })

    store = new FileSnapshotStore({
      cacheDir: testCacheDir,
      maxSnapshots: 10,
      maxAgeDays: 30,
      enableCompression: false,
    })
  })

  afterEach(async () => {
    // Clean up test cache directory
    try {
      await fs.rm(testCacheDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  it('should extract and store ranking version from all-districts-rankings file', async () => {
    // Create test snapshot with all-districts rankings
    const normalizedData: NormalizedData = {
      districts: [
        {
          districtId: '42',
          asOfDate: '2024-01-01',
          membership: {
            totalMembers: 100,
            newMembers: 10,
            renewedMembers: 90,
            charterMembers: 5,
            totalClubs: 20,
            newClubs: 2,
            renewedClubs: 18,
            charterClubs: 1,
          },
          clubs: {
            totalClubs: 20,
            activeClubs: 18,
            suspendedClubs: 2,
            charterClubs: 1,
          },
          education: {
            totalAwards: 50,
            cc: 10,
            alb: 5,
            ams: 3,
            b: 2,
            dtm: 1,
          },
        },
      ],
      metadata: {
        source: 'test',
        fetchedAt: '2024-01-01T12:00:00Z',
        dataAsOfDate: '2024-01-01',
        districtCount: 1,
        processingDurationMs: 100,
      },
    }

    const snapshot: Snapshot = {
      snapshot_id: '1704067200000',
      created_at: '2024-01-01T12:00:00Z',
      schema_version: '1.0.0',
      calculation_version: '1.0.0',
      status: 'success',
      errors: [],
      payload: normalizedData,
    }

    // Write all-districts-rankings file with ranking version
    const rankingsData = {
      rankings: [
        {
          districtId: '42',
          districtName: 'District 42',
          region: 'Region 1',
          clubsRank: 1,
          paymentsRank: 2,
          distinguishedRank: 3,
          aggregateScore: 85,
          clubGrowthPercent: 10.5,
          paymentGrowthPercent: 8.2,
          distinguishedPercent: 75.0,
          paidClubBase: 18,
          paymentBase: 1800,
          paidClubs: 20,
          totalPayments: 1950,
          distinguishedClubs: 15,
          activeClubs: 18,
          selectDistinguished: 8,
          presidentsDistinguished: 7,
        },
      ],
      metadata: {
        snapshotId: '2024-01-01', // Will be ISO date format
        calculatedAt: '2024-01-01T12:00:00Z',
        schemaVersion: '1.0.0',
        calculationVersion: '1.0.0',
        rankingVersion: '2.0',
        sourceCsvDate: '2024-01-01',
        csvFetchedAt: '2024-01-01T12:00:00Z',
        totalDistricts: 1,
        fromCache: false,
      },
    }

    // Write snapshot with rankings - this creates the ISO date directory
    await store.writeSnapshot(snapshot, rankingsData)

    // Get the actual snapshot ID that was written (ISO date format)
    const writtenSnapshot = await store.getLatestSuccessful()
    expect(writtenSnapshot).toBeTruthy()

    // Read metadata and verify ranking version is stored
    const metadata = await store.getSnapshotMetadata(
      writtenSnapshot!.snapshot_id
    )
    expect(metadata).toBeTruthy()
    expect(metadata!.rankingVersion).toBe('2.0')
  })

  it('should handle snapshots without ranking data', async () => {
    // Create test district without ranking data
    const normalizedData: NormalizedData = {
      districts: [
        {
          districtId: '15',
          asOfDate: '2024-01-01',
          membership: {
            totalMembers: 80,
            newMembers: 8,
            renewedMembers: 72,
            charterMembers: 3,
            totalClubs: 15,
            newClubs: 1,
            renewedClubs: 14,
            charterClubs: 0,
          },
          clubs: {
            totalClubs: 15,
            activeClubs: 14,
            suspendedClubs: 1,
            charterClubs: 0,
          },
          education: {
            totalAwards: 30,
            cc: 8,
            alb: 3,
            ams: 2,
            b: 1,
            dtm: 0,
          },
        },
      ],
      metadata: {
        source: 'test',
        fetchedAt: '2024-01-01T12:00:00Z',
        dataAsOfDate: '2024-01-01',
        districtCount: 1,
        processingDurationMs: 100,
      },
    }

    const snapshot: Snapshot = {
      snapshot_id: '1704067300000',
      created_at: '2024-01-01T12:05:00Z',
      schema_version: '1.0.0',
      calculation_version: '1.0.0',
      status: 'success',
      errors: [],
      payload: normalizedData,
    }

    // Write snapshot without rankings file
    await store.writeSnapshot(snapshot)

    // Get the actual snapshot ID that was written (ISO date format)
    const writtenSnapshot = await store.getLatestSuccessful()
    expect(writtenSnapshot).toBeTruthy()

    // Read metadata and verify ranking version is undefined
    const metadata = await store.getSnapshotMetadata(
      writtenSnapshot!.snapshot_id
    )
    expect(metadata).toBeTruthy()
    expect(metadata!.rankingVersion).toBeUndefined()
  })

  it('should check version compatibility correctly', async () => {
    // Create and store a snapshot with ranking data
    const normalizedData: NormalizedData = {
      districts: [
        {
          districtId: '42',
          asOfDate: '2024-01-01',
          membership: {
            totalMembers: 100,
            newMembers: 10,
            renewedMembers: 90,
            charterMembers: 5,
            totalClubs: 20,
            newClubs: 2,
            renewedClubs: 18,
            charterClubs: 1,
          },
          clubs: {
            totalClubs: 20,
            activeClubs: 18,
            suspendedClubs: 2,
            charterClubs: 1,
          },
          education: {
            totalAwards: 50,
            cc: 10,
            alb: 5,
            ams: 3,
            b: 2,
            dtm: 1,
          },
        },
      ],
      metadata: {
        source: 'test',
        fetchedAt: '2024-01-01T12:00:00Z',
        dataAsOfDate: '2024-01-01',
        districtCount: 1,
        processingDurationMs: 100,
      },
    }

    const snapshot: Snapshot = {
      snapshot_id: '1704067400000',
      created_at: '2024-01-01T12:10:00Z',
      schema_version: '1.0.0',
      calculation_version: '1.0.0',
      status: 'success',
      errors: [],
      payload: normalizedData,
    }

    // Write all-districts-rankings file with ranking version
    const rankingsData = {
      rankings: [
        {
          districtId: '42',
          districtName: 'District 42',
          region: 'Region 1',
          clubsRank: 1,
          paymentsRank: 2,
          distinguishedRank: 3,
          aggregateScore: 85,
          clubGrowthPercent: 10.5,
          paymentGrowthPercent: 8.2,
          distinguishedPercent: 75.0,
          paidClubBase: 18,
          paymentBase: 1800,
          paidClubs: 20,
          totalPayments: 1950,
          distinguishedClubs: 15,
          activeClubs: 18,
          selectDistinguished: 8,
          presidentsDistinguished: 7,
        },
      ],
      metadata: {
        snapshotId: '2024-01-01', // Will be ISO date format
        calculatedAt: '2024-01-01T12:10:00Z',
        schemaVersion: '1.0.0',
        calculationVersion: '1.0.0',
        rankingVersion: '2.0',
        sourceCsvDate: '2024-01-01',
        csvFetchedAt: '2024-01-01T12:10:00Z',
        totalDistricts: 1,
        fromCache: false,
      },
    }

    // Write snapshot with rankings
    await store.writeSnapshot(snapshot, rankingsData)

    // Get the actual snapshot ID that was written (ISO date format)
    const writtenSnapshot = await store.getLatestSuccessful()
    expect(writtenSnapshot).toBeTruthy()

    // Check version compatibility
    const compatibility = await store.checkVersionCompatibility(
      writtenSnapshot!.snapshot_id
    )

    expect(compatibility.isCompatible).toBe(true)
    expect(compatibility.schemaCompatible).toBe(true)
    expect(compatibility.calculationCompatible).toBe(true)
    expect(compatibility.rankingCompatible).toBe(true)
    expect(compatibility.warnings).toContain(
      'Snapshot has ranking version: 2.0'
    )
  })

  it('should handle missing snapshot for version compatibility check', async () => {
    const compatibility = await store.checkVersionCompatibility('nonexistent')

    expect(compatibility.isCompatible).toBe(false)
    expect(compatibility.schemaCompatible).toBe(false)
    expect(compatibility.calculationCompatible).toBe(false)
    expect(compatibility.rankingCompatible).toBe(false)
    expect(compatibility.warnings).toContain('Snapshot metadata not found')
  })
})
