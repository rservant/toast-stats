/**
 * Tests for ranking version functionality in PerDistrictSnapshotStore
 *
 * Tests that the ranking version is properly extracted from district data
 * and stored in snapshot metadata.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PerDistrictFileSnapshotStore } from '../PerDistrictSnapshotStore.js'
import type { Snapshot, NormalizedData } from '../../types/snapshots.js'
import type { DistrictStatistics } from '../../types/districts.js'
import fs from 'fs/promises'
import path from 'path'

describe('PerDistrictSnapshotStore - Ranking Version', () => {
  let store: PerDistrictFileSnapshotStore
  let testCacheDir: string

  beforeEach(async () => {
    // Create unique test cache directory
    testCacheDir = path.join(
      process.cwd(),
      'test-cache',
      `ranking-version-test-${Date.now()}-${Math.random().toString(36).substring(7)}`
    )
    await fs.mkdir(testCacheDir, { recursive: true })

    store = new PerDistrictFileSnapshotStore({
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
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  it('should extract and store ranking version from district data', async () => {
    // Create test district with ranking data
    const districtWithRanking: DistrictStatistics = {
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
      ranking: {
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
        region: 'Region 1',
        districtName: 'District 42',
        rankingVersion: '2.0',
        calculatedAt: '2024-01-01T12:00:00Z',
      },
    }

    // Create test snapshot with ranking data
    const normalizedData: NormalizedData = {
      districts: [districtWithRanking],
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

    // Write snapshot
    await store.writeSnapshot(snapshot)

    // Read metadata and verify ranking version is stored
    const metadata = await store.getSnapshotMetadata('1704067200000')
    expect(metadata).toBeTruthy()
    expect(metadata!.rankingVersion).toBe('2.0')
  })

  it('should handle snapshots without ranking data', async () => {
    // Create test district without ranking data
    const districtWithoutRanking: DistrictStatistics = {
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
      // No ranking data
    }

    const normalizedData: NormalizedData = {
      districts: [districtWithoutRanking],
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

    // Write snapshot
    await store.writeSnapshot(snapshot)

    // Read metadata and verify ranking version is undefined
    const metadata = await store.getSnapshotMetadata('1704067300000')
    expect(metadata).toBeTruthy()
    expect(metadata!.rankingVersion).toBeUndefined()
  })

  it('should check version compatibility correctly', async () => {
    // Create and store a snapshot with ranking data
    const districtWithRanking: DistrictStatistics = {
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
      ranking: {
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
        region: 'Region 1',
        districtName: 'District 42',
        rankingVersion: '2.0',
        calculatedAt: '2024-01-01T12:00:00Z',
      },
    }

    const normalizedData: NormalizedData = {
      districts: [districtWithRanking],
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

    await store.writeSnapshot(snapshot)

    // Check version compatibility
    const compatibility = await store.checkVersionCompatibility('1704067400000')

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
