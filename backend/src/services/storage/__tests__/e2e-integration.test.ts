/**
 * End-to-End Integration Test with GCP Emulators
 *
 * This test suite verifies the complete refresh flow using GCP storage providers
 * (Firestore and GCS) with emulators. It tests:
 * - Full refresh flow with GCP providers
 * - Data persistence and retrieval
 * - Error recovery scenarios
 *
 * **Validates: Requirements 8.2, 8.3, 8.4**
 *
 * Prerequisites:
 * - Firestore emulator running: firebase emulators:start --only firestore
 * - GCS emulator running: docker run -d -p 4443:4443 fsouza/fake-gcs-server -scheme http -port 4443
 *
 * Environment Variables:
 * - FIRESTORE_EMULATOR_HOST=localhost:8080
 * - GCS_EMULATOR_HOST=http://localhost:4443
 * - STORAGE_EMULATOR_HOST=http://localhost:4443
 *
 * Test Isolation Requirements (per testing steering document):
 * - Each test uses unique, isolated resources (collections, buckets)
 * - Tests clean up all resources in afterEach hooks
 * - Tests do not depend on execution order
 * - All tests pass when run with --run (parallel mode)
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest'
import { FirestoreSnapshotStorage } from '../FirestoreSnapshotStorage.js'
import { GCSRawCSVStorage } from '../GCSRawCSVStorage.js'
import type {
  ISnapshotStorage,
  IRawCSVStorage,
} from '../../../types/storageInterfaces.js'
import type {
  Snapshot,
  AllDistrictsRankingsData,
} from '../../../types/snapshots.js'
import type { DistrictStatistics } from '../../../types/districts.js'
import { CSVType } from '../../../types/rawCSVCache.js'
import {
  CURRENT_SCHEMA_VERSION,
  CURRENT_CALCULATION_VERSION,
} from '../../../types/snapshots.js'

// ============================================================================
// Test Configuration
// ============================================================================

/**
 * Check if Firestore emulator is available
 */
function isFirestoreEmulatorAvailable(): boolean {
  return !!process.env['FIRESTORE_EMULATOR_HOST']
}

/**
 * Check if GCS emulator is available
 */
function isGCSEmulatorAvailable(): boolean {
  return (
    !!process.env['STORAGE_EMULATOR_HOST'] || !!process.env['GCS_EMULATOR_HOST']
  )
}

/**
 * Check if both emulators are available for full E2E testing
 */
function areEmulatorsAvailable(): boolean {
  return isFirestoreEmulatorAvailable() && isGCSEmulatorAvailable()
}

// Skip entire suite if emulators are not available
const describeWithEmulators = areEmulatorsAvailable() ? describe : describe.skip

// ============================================================================
// Test Data Factories
// ============================================================================

/**
 * Create a test snapshot with configurable properties
 */
function createTestSnapshot(
  snapshotId: string,
  status: 'success' | 'partial' | 'failed' = 'success',
  districts: DistrictStatistics[] = []
): Snapshot {
  return {
    snapshot_id: snapshotId,
    created_at: new Date().toISOString(),
    schema_version: CURRENT_SCHEMA_VERSION,
    calculation_version: CURRENT_CALCULATION_VERSION,
    status,
    errors: status === 'failed' ? ['Test error'] : [],
    payload: {
      districts,
      metadata: {
        source: 'e2e-test',
        fetchedAt: new Date().toISOString(),
        dataAsOfDate: snapshotId,
        districtCount: districts.length,
        processingDurationMs: 100,
      },
    },
  }
}

/**
 * Create test district statistics
 */
function createTestDistrictData(
  districtId: string,
  asOfDate: string
): DistrictStatistics {
  return {
    districtId,
    asOfDate,
    membership: {
      total: 200 + parseInt(districtId, 10),
      change: 10,
      changePercent: 5.0,
      byClub: [],
    },
    clubs: {
      total: 10 + parseInt(districtId, 10),
      active: 8,
      suspended: 1,
      ineligible: 0,
      low: 1,
      distinguished: 5,
    },
    education: {
      totalAwards: 50,
      byType: [],
      topClubs: [],
    },
  }
}

/**
 * Create test rankings data
 */
function createTestRankings(snapshotId: string): AllDistrictsRankingsData {
  return {
    metadata: {
      snapshotId,
      calculatedAt: new Date().toISOString(),
      schemaVersion: '1.0.0',
      calculationVersion: '1.0.0',
      rankingVersion: '1.0.0',
      sourceCsvDate: snapshotId,
      csvFetchedAt: new Date().toISOString(),
      totalDistricts: 2,
      fromCache: false,
    },
    rankings: [
      {
        districtId: '42',
        districtName: 'District 42',
        region: 'Region 1',
        paidClubs: 50,
        paidClubBase: 48,
        clubGrowthPercent: 4.17,
        totalPayments: 1000,
        paymentBase: 950,
        paymentGrowthPercent: 5.26,
        activeClubs: 48,
        distinguishedClubs: 20,
        selectDistinguished: 10,
        presidentsDistinguished: 5,
        distinguishedPercent: 41.67,
        clubsRank: 1,
        paymentsRank: 1,
        distinguishedRank: 1,
        aggregateScore: 100,
      },
      {
        districtId: '43',
        districtName: 'District 43',
        region: 'Region 2',
        paidClubs: 45,
        paidClubBase: 44,
        clubGrowthPercent: 2.27,
        totalPayments: 900,
        paymentBase: 880,
        paymentGrowthPercent: 2.27,
        activeClubs: 43,
        distinguishedClubs: 15,
        selectDistinguished: 8,
        presidentsDistinguished: 3,
        distinguishedPercent: 34.88,
        clubsRank: 2,
        paymentsRank: 2,
        distinguishedRank: 2,
        aggregateScore: 90,
      },
    ],
  }
}

/**
 * Generate test CSV content
 */
function generateTestCSV(type: CSVType, districtId?: string): string {
  if (type === 'all-districts') {
    return `District,Region,Clubs,Members
42,Region 1,50,1000
43,Region 2,45,900
44,Region 3,40,800
`
  }

  if (type === 'club-performance') {
    return `Club Number,Club Name,Members,Goals Met,Status
${districtId}001,Test Club 1,25,7,Distinguished
${districtId}002,Test Club 2,20,5,Active
${districtId}003,Test Club 3,15,3,Active
`
  }

  if (type === 'division-performance') {
    return `Division,Area,Clubs,Members,Distinguished
A,1,10,200,5
A,2,8,160,3
B,1,12,240,6
`
  }

  return `District,Data
${districtId ?? '42'},Test Data
`
}

// ============================================================================
// E2E Integration Tests
// ============================================================================

describeWithEmulators('E2E Integration Tests with GCP Emulators', () => {
  // Unique identifiers for test isolation
  let testId: string
  let firestoreCollectionName: string
  let gcsBucketName: string

  // Storage providers
  let snapshotStorage: ISnapshotStorage
  let csvStorage: IRawCSVStorage

  beforeAll(() => {
    // Log emulator configuration
    console.log('E2E Test Configuration:')
    console.log(
      `  FIRESTORE_EMULATOR_HOST: ${process.env['FIRESTORE_EMULATOR_HOST']}`
    )
    console.log(`  GCS_EMULATOR_HOST: ${process.env['GCS_EMULATOR_HOST']}`)
    console.log(
      `  STORAGE_EMULATOR_HOST: ${process.env['STORAGE_EMULATOR_HOST']}`
    )
  })

  beforeEach(() => {
    // Generate unique identifiers for test isolation
    testId = `e2e-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
    firestoreCollectionName = `snapshots-${testId}`
    gcsBucketName = `test-bucket-${testId}`

    // Create storage providers with unique collections/buckets
    snapshotStorage = new FirestoreSnapshotStorage({
      projectId: 'test-project',
      collectionName: firestoreCollectionName,
    })

    csvStorage = new GCSRawCSVStorage({
      projectId: 'test-project',
      bucketName: gcsBucketName,
    })
  })

  afterEach(async () => {
    // Emulator data is ephemeral per collection/bucket, no explicit cleanup needed
    // The unique collection/bucket names ensure test isolation
  })

  // ==========================================================================
  // Full Refresh Flow Tests
  // ==========================================================================

  describe('Full Refresh Flow', () => {
    it('should complete a full refresh cycle: cache CSV → create snapshot → retrieve data', async () => {
      const testDate = '2024-01-15'
      const districtIds = ['42', '43']

      // Step 1: Cache CSV data (simulating scraper output)
      await csvStorage.setCachedCSV(
        testDate,
        'all-districts' as CSVType,
        generateTestCSV('all-districts' as CSVType)
      )

      for (const districtId of districtIds) {
        await csvStorage.setCachedCSV(
          testDate,
          'club-performance' as CSVType,
          generateTestCSV('club-performance' as CSVType, districtId),
          districtId
        )
      }

      // Verify CSV data was cached
      const allDistrictsCSV = await csvStorage.getCachedCSV(
        testDate,
        'all-districts' as CSVType
      )
      expect(allDistrictsCSV).not.toBeNull()
      expect(allDistrictsCSV).toContain('District,Region,Clubs,Members')

      // Step 2: Create snapshot with district data
      const districts = districtIds.map(id =>
        createTestDistrictData(id, testDate)
      )
      const snapshot = createTestSnapshot(testDate, 'success', districts)
      const rankings = createTestRankings(testDate)

      await snapshotStorage.writeSnapshot(snapshot, rankings)

      // Step 3: Retrieve and verify snapshot
      const retrievedSnapshot = await snapshotStorage.getSnapshot(testDate)
      expect(retrievedSnapshot).not.toBeNull()
      expect(retrievedSnapshot?.snapshot_id).toBe(testDate)
      expect(retrievedSnapshot?.status).toBe('success')
      expect(retrievedSnapshot?.payload.districts.length).toBe(2)

      // Step 4: Verify latest successful snapshot
      const latestSuccessful = await snapshotStorage.getLatestSuccessful()
      expect(latestSuccessful).not.toBeNull()
      expect(latestSuccessful?.snapshot_id).toBe(testDate)

      // Step 5: Verify rankings
      const retrievedRankings =
        await snapshotStorage.readAllDistrictsRankings(testDate)
      expect(retrievedRankings).not.toBeNull()
      expect(retrievedRankings?.rankings.length).toBe(2)
    })

    it('should handle multiple snapshots across different dates', async () => {
      const dates = ['2024-01-13', '2024-01-14', '2024-01-15']

      // Create snapshots for multiple dates
      for (const date of dates) {
        const districts = [createTestDistrictData('42', date)]
        const snapshot = createTestSnapshot(date, 'success', districts)
        await snapshotStorage.writeSnapshot(snapshot)
      }

      // Verify all snapshots exist
      const snapshotList = await snapshotStorage.listSnapshots()
      expect(snapshotList.length).toBe(3)

      // Verify latest is the most recent date
      const latest = await snapshotStorage.getLatest()
      expect(latest?.snapshot_id).toBe('2024-01-15')
    })

    it('should correctly identify latest successful snapshot when some fail', async () => {
      // Create snapshots with mixed statuses
      const successSnapshot1 = createTestSnapshot('2024-01-13', 'success', [
        createTestDistrictData('42', '2024-01-13'),
      ])
      const successSnapshot2 = createTestSnapshot('2024-01-14', 'success', [
        createTestDistrictData('42', '2024-01-14'),
      ])
      const failedSnapshot = createTestSnapshot('2024-01-15', 'failed', [])

      await snapshotStorage.writeSnapshot(successSnapshot1)
      await snapshotStorage.writeSnapshot(successSnapshot2)
      await snapshotStorage.writeSnapshot(failedSnapshot)

      // Latest should be the failed one
      const latest = await snapshotStorage.getLatest()
      expect(latest?.snapshot_id).toBe('2024-01-15')
      expect(latest?.status).toBe('failed')

      // Latest successful should skip the failed one
      const latestSuccessful = await snapshotStorage.getLatestSuccessful()
      expect(latestSuccessful?.snapshot_id).toBe('2024-01-14')
      expect(latestSuccessful?.status).toBe('success')
    })
  })

  // ==========================================================================
  // Data Persistence and Retrieval Tests
  // ==========================================================================

  describe('Data Persistence and Retrieval', () => {
    it('should persist and retrieve district data independently', async () => {
      const snapshotId = '2024-01-15'
      const snapshot = createTestSnapshot(snapshotId, 'success', [])

      await snapshotStorage.writeSnapshot(snapshot)

      // Write district data separately
      const district42 = createTestDistrictData('42', snapshotId)
      const district43 = createTestDistrictData('43', snapshotId)

      await snapshotStorage.writeDistrictData(snapshotId, '42', district42)
      await snapshotStorage.writeDistrictData(snapshotId, '43', district43)

      // Retrieve and verify
      const retrieved42 = await snapshotStorage.readDistrictData(
        snapshotId,
        '42'
      )
      const retrieved43 = await snapshotStorage.readDistrictData(
        snapshotId,
        '43'
      )

      expect(retrieved42?.districtId).toBe('42')
      expect(retrieved43?.districtId).toBe('43')
      expect(retrieved42?.membership.total).toBe(242) // 200 + 42
      expect(retrieved43?.membership.total).toBe(243) // 200 + 43
    })

    it('should persist CSV data with metadata', async () => {
      const testDate = '2024-01-31'
      const csvContent = generateTestCSV('all-districts' as CSVType)
      const closingPeriodMetadata = {
        requestedDate: '2024-02-01',
        isClosingPeriod: true,
        dataMonth: '2024-01',
      }

      await csvStorage.setCachedCSVWithMetadata(
        testDate,
        'all-districts' as CSVType,
        csvContent,
        undefined,
        closingPeriodMetadata
      )

      // Verify content is retrievable
      const retrieved = await csvStorage.getCachedCSV(
        testDate,
        'all-districts' as CSVType
      )
      expect(retrieved).toBe(csvContent)

      // Verify existence check
      const exists = await csvStorage.hasCachedCSV(
        testDate,
        'all-districts' as CSVType
      )
      expect(exists).toBe(true)
    })

    it('should list cached dates correctly', async () => {
      const dates = ['2024-01-13', '2024-01-14', '2024-01-15']

      for (const date of dates) {
        await csvStorage.setCachedCSV(
          date,
          'all-districts' as CSVType,
          generateTestCSV('all-districts' as CSVType)
        )
      }

      const cachedDates = await csvStorage.getCachedDates()
      expect(cachedDates.length).toBeGreaterThanOrEqual(3)

      // All test dates should be present
      for (const date of dates) {
        expect(cachedDates).toContain(date)
      }
    })

    it('should clear cache for a specific date', async () => {
      const testDate = '2024-01-15'

      // Cache some data
      await csvStorage.setCachedCSV(
        testDate,
        'all-districts' as CSVType,
        generateTestCSV('all-districts' as CSVType)
      )
      await csvStorage.setCachedCSV(
        testDate,
        'club-performance' as CSVType,
        generateTestCSV('club-performance' as CSVType, '42'),
        '42'
      )

      // Verify data exists
      expect(
        await csvStorage.hasCachedCSV(testDate, 'all-districts' as CSVType)
      ).toBe(true)

      // Clear cache for date
      await csvStorage.clearCacheForDate(testDate)

      // Verify data is cleared
      expect(
        await csvStorage.hasCachedCSV(testDate, 'all-districts' as CSVType)
      ).toBe(false)
    })
  })

  // ==========================================================================
  // Error Recovery Scenarios
  // ==========================================================================

  describe('Error Recovery Scenarios', () => {
    it('should handle reading non-existent snapshot gracefully', async () => {
      const result = await snapshotStorage.getSnapshot('2099-12-31')
      expect(result).toBeNull()
    })

    it('should handle reading non-existent district data gracefully', async () => {
      const snapshotId = '2024-01-15'
      const snapshot = createTestSnapshot(snapshotId, 'success', [])
      await snapshotStorage.writeSnapshot(snapshot)

      const result = await snapshotStorage.readDistrictData(snapshotId, '999')
      expect(result).toBeNull()
    })

    it('should handle reading non-existent CSV gracefully', async () => {
      const result = await csvStorage.getCachedCSV(
        '2099-12-31',
        'all-districts' as CSVType
      )
      expect(result).toBeNull()
    })

    it('should return false for non-existent CSV existence check', async () => {
      const exists = await csvStorage.hasCachedCSV(
        '2099-12-31',
        'all-districts' as CSVType
      )
      expect(exists).toBe(false)
    })

    it('should handle empty snapshot list gracefully', async () => {
      const snapshots = await snapshotStorage.listSnapshots()
      expect(Array.isArray(snapshots)).toBe(true)
    })

    it('should handle getLatestSuccessful when no successful snapshots exist', async () => {
      // Create only failed snapshots
      const failedSnapshot = createTestSnapshot('2024-01-15', 'failed', [])
      await snapshotStorage.writeSnapshot(failedSnapshot)

      const result = await snapshotStorage.getLatestSuccessful()
      expect(result).toBeNull()
    })

    it('should overwrite existing snapshot data', async () => {
      const snapshotId = '2024-01-15'

      // Write initial snapshot
      const initialSnapshot = createTestSnapshot(snapshotId, 'success', [
        createTestDistrictData('42', snapshotId),
      ])
      await snapshotStorage.writeSnapshot(initialSnapshot)

      // Verify initial data
      let retrieved = await snapshotStorage.getSnapshot(snapshotId)
      expect(retrieved?.payload.districts.length).toBe(1)

      // Overwrite with updated snapshot
      const updatedSnapshot = createTestSnapshot(snapshotId, 'success', [
        createTestDistrictData('42', snapshotId),
        createTestDistrictData('43', snapshotId),
      ])
      await snapshotStorage.writeSnapshot(updatedSnapshot)

      // Verify updated data
      retrieved = await snapshotStorage.getSnapshot(snapshotId)
      expect(retrieved?.payload.districts.length).toBe(2)
    })

    it('should handle concurrent writes to different snapshots', async () => {
      const dates = ['2024-01-13', '2024-01-14', '2024-01-15']

      // Write snapshots concurrently
      await Promise.all(
        dates.map(date => {
          const snapshot = createTestSnapshot(date, 'success', [
            createTestDistrictData('42', date),
          ])
          return snapshotStorage.writeSnapshot(snapshot)
        })
      )

      // Verify all snapshots were written
      const snapshots = await snapshotStorage.listSnapshots()
      expect(snapshots.length).toBe(3)
    })
  })

  // ==========================================================================
  // Storage Health and Statistics Tests
  // ==========================================================================

  describe('Storage Health and Statistics', () => {
    it('should report storage readiness', async () => {
      const isReady = await snapshotStorage.isReady()
      expect(isReady).toBe(true)
    })

    it('should provide cache storage info', async () => {
      // Add some test data first
      await csvStorage.setCachedCSV(
        '2024-01-15',
        'all-districts' as CSVType,
        generateTestCSV('all-districts' as CSVType)
      )

      const storageInfo = await csvStorage.getCacheStorageInfo()
      expect(storageInfo).toBeDefined()
      expect(typeof storageInfo.totalSizeMB).toBe('number')
      expect(typeof storageInfo.totalFiles).toBe('number')
      expect(Array.isArray(storageInfo.recommendations)).toBe(true)
    })

    it('should provide cache statistics', async () => {
      // Add some test data first
      await csvStorage.setCachedCSV(
        '2024-01-15',
        'all-districts' as CSVType,
        generateTestCSV('all-districts' as CSVType)
      )

      const stats = await csvStorage.getCacheStatistics()
      expect(stats).toBeDefined()
      expect(typeof stats.totalCachedDates).toBe('number')
      expect(typeof stats.totalCachedFiles).toBe('number')
    })

    it('should provide health status', async () => {
      const healthStatus = await csvStorage.getHealthStatus()
      expect(healthStatus).toBeDefined()
      expect(typeof healthStatus.isHealthy).toBe('boolean')
    })
  })

  // ==========================================================================
  // Rankings Integration Tests
  // ==========================================================================

  describe('Rankings Integration', () => {
    it('should store and retrieve rankings with snapshot', async () => {
      const snapshotId = '2024-01-15'
      const snapshot = createTestSnapshot(snapshotId, 'success', [
        createTestDistrictData('42', snapshotId),
        createTestDistrictData('43', snapshotId),
      ])
      const rankings = createTestRankings(snapshotId)

      // Write snapshot with rankings
      await snapshotStorage.writeSnapshot(snapshot, rankings)

      // Verify rankings exist
      const hasRankings =
        await snapshotStorage.hasAllDistrictsRankings(snapshotId)
      expect(hasRankings).toBe(true)

      // Retrieve and verify rankings
      const retrievedRankings =
        await snapshotStorage.readAllDistrictsRankings(snapshotId)
      expect(retrievedRankings).not.toBeNull()
      expect(retrievedRankings?.metadata.snapshotId).toBe(snapshotId)
      expect(retrievedRankings?.rankings.length).toBe(2)
      expect(retrievedRankings?.rankings[0]?.districtId).toBe('42')
      expect(retrievedRankings?.rankings[0]?.clubsRank).toBe(1)
    })

    it('should write rankings separately after snapshot creation', async () => {
      const snapshotId = '2024-01-15'
      const snapshot = createTestSnapshot(snapshotId, 'success', [])

      // Write snapshot without rankings
      await snapshotStorage.writeSnapshot(snapshot)

      // Verify no rankings initially
      let hasRankings =
        await snapshotStorage.hasAllDistrictsRankings(snapshotId)
      expect(hasRankings).toBe(false)

      // Write rankings separately
      const rankings = createTestRankings(snapshotId)
      await snapshotStorage.writeAllDistrictsRankings(snapshotId, rankings)

      // Verify rankings now exist
      hasRankings = await snapshotStorage.hasAllDistrictsRankings(snapshotId)
      expect(hasRankings).toBe(true)
    })
  })
})
