/**
 * Property-based tests for PerDistrictSnapshotStore
 *
 * These tests validate universal properties of the per-district snapshot storage system
 * using property-based testing with fast-check to ensure correctness across all inputs.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'
import fs from 'fs/promises'
import path from 'path'
import {
  FileSnapshotStore,
  PerDistrictFileSnapshotStore,
} from '../SnapshotStore.js'

// Test configuration
// Optimized for CI/CD timeout compliance (30s limit)
const TEST_ITERATIONS = 25
const TEST_TIMEOUT = 30000

describe('PerDistrictSnapshotStore Property Tests', () => {
  let testCacheDir: string
  let store: PerDistrictFileSnapshotStore

  beforeEach(async () => {
    // Create unique test cache directory for each test run
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substring(2, 8)
    testCacheDir = path.join(
      process.cwd(),
      'test-cache',
      `per-district-property-test-${timestamp}-${randomSuffix}`
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

  // Counter for generating unique dataAsOfDate values across test iterations
  let testIterationCounter = 0

  // Generators for property-based testing
  const districtIdGenerator = fc.oneof(
    fc.integer({ min: 1, max: 999 }).map(n => n.toString()), // Numeric districts
    fc.constantFrom('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J') // Alphabetic districts
  )

  const districtStatisticsGenerator = fc.record({
    districtId: districtIdGenerator,
    asOfDate: fc
      .integer({ min: 1577836800000, max: 1924992000000 })
      .map(timestamp => new Date(timestamp).toISOString()),
    membership: fc.record({
      total: fc.integer({ min: 0, max: 10000 }),
      change: fc.integer({ min: -1000, max: 1000 }),
      changePercent: fc.float({ min: -50, max: 50 }),
      byClub: fc.array(
        fc.record({
          clubId: fc.string({ minLength: 1, maxLength: 10 }),
          clubName: fc.string({ minLength: 5, maxLength: 50 }),
          memberCount: fc.integer({ min: 0, max: 100 }),
        }),
        { maxLength: 20 }
      ),
    }),
    clubs: fc.record({
      total: fc.integer({ min: 0, max: 500 }),
      active: fc.integer({ min: 0, max: 500 }),
      suspended: fc.integer({ min: 0, max: 50 }),
      ineligible: fc.integer({ min: 0, max: 50 }),
      low: fc.integer({ min: 0, max: 100 }),
      distinguished: fc.integer({ min: 0, max: 200 }),
    }),
    education: fc.record({
      totalAwards: fc.integer({ min: 0, max: 5000 }),
      byType: fc.array(
        fc.record({
          type: fc.constantFrom('CC', 'CL', 'AL', 'AC', 'LD', 'DTM'),
          count: fc.integer({ min: 0, max: 500 }),
        }),
        { maxLength: 10 }
      ),
      topClubs: fc.array(
        fc.record({
          clubId: fc.string({ minLength: 1, maxLength: 10 }),
          clubName: fc.string({ minLength: 5, maxLength: 50 }),
          awards: fc.integer({ min: 0, max: 100 }),
        }),
        { maxLength: 10 }
      ),
    }),
  })

  /**
   * Generate a unique dataAsOfDate for each test iteration.
   * This ensures snapshots don't overwrite each other when using the same store.
   */
  const generateUniqueDataAsOfDate = (): string => {
    testIterationCounter++
    const baseDate = new Date('2020-01-01')
    baseDate.setDate(baseDate.getDate() + testIterationCounter)
    return baseDate.toISOString().split('T')[0]
  }

  const snapshotGenerator = fc.record({
    snapshot_id: fc
      .integer({ min: 1000000000000, max: 9999999999999 })
      .map(n => n.toString()),
    created_at: fc
      .integer({ min: 1577836800000, max: 1924992000000 })
      .map(timestamp => new Date(timestamp).toISOString()),
    schema_version: fc.constantFrom('1.0.0', '1.1.0', '2.0.0'),
    calculation_version: fc.constantFrom('1.0.0', '1.1.0', '1.2.0'),
    status: fc.constantFrom('success', 'partial', 'failed') as fc.Arbitrary<
      'success' | 'partial' | 'failed'
    >,
    errors: fc.array(fc.string({ minLength: 10, maxLength: 100 }), {
      maxLength: 5,
    }),
    payload: fc.record({
      districts: fc.array(districtStatisticsGenerator, {
        minLength: 1,
        maxLength: 10,
      }),
      metadata: fc.record({
        source: fc.constantFrom(
          'toastmasters-dashboard',
          'manual-import',
          'api'
        ),
        fetchedAt: fc
          .integer({ min: 1577836800000, max: 1924992000000 })
          .map(timestamp => new Date(timestamp).toISOString()),
        // Note: dataAsOfDate will be overridden in tests to ensure uniqueness
        dataAsOfDate: fc
          .integer({ min: 1577836800000, max: 1924992000000 })
          .map(timestamp => new Date(timestamp).toISOString().split('T')[0]),
        districtCount: fc.integer({ min: 1, max: 10 }),
        processingDurationMs: fc.integer({ min: 1000, max: 300000 }),
      }),
    }),
  })

  // Feature: district-scoped-data-collection, Property 9: Per-District Snapshot Structure
  it(
    'Property 9: Per-District Snapshot Structure - should create directory structure with individual district files',
    async () => {
      await fc.assert(
        fc.asyncProperty(snapshotGenerator, async snapshot => {
          // Force status to 'success' for this test since we need getLatestSuccessful to work
          snapshot.status = 'success'

          // Generate unique dataAsOfDate to prevent snapshot overwrites
          const uniqueDataAsOfDate = generateUniqueDataAsOfDate()
          snapshot.payload.metadata.dataAsOfDate = uniqueDataAsOfDate

          // Ensure district count matches payload
          snapshot.payload.metadata.districtCount =
            snapshot.payload.districts.length

          // Ensure district IDs are unique
          const uniqueDistricts = Array.from(
            new Set(snapshot.payload.districts.map(d => d.districtId))
          )
          if (uniqueDistricts.length !== snapshot.payload.districts.length) {
            // Skip this test case if districts are not unique
            return true
          }

          // Write the snapshot
          await store.writeSnapshot(snapshot)

          // The actual snapshot ID is the ISO date format of dataAsOfDate
          const actualSnapshotId = uniqueDataAsOfDate

          // Verify directory structure exists using actual snapshot ID
          const snapshotDir = path.join(
            testCacheDir,
            'snapshots',
            actualSnapshotId
          )
          const dirExists = await fs
            .access(snapshotDir)
            .then(() => true)
            .catch(() => false)
          expect(dirExists).toBe(true)

          // Verify individual district files exist with correct naming pattern
          for (const district of snapshot.payload.districts) {
            const districtFile = path.join(
              snapshotDir,
              `district_${district.districtId}.json`
            )
            const fileExists = await fs
              .access(districtFile)
              .then(() => true)
              .catch(() => false)
            expect(fileExists).toBe(true)

            // Verify file contains valid JSON with district data
            const content = await fs.readFile(districtFile, 'utf-8')
            const parsedData = JSON.parse(content)
            expect(parsedData.districtId).toBe(district.districtId)
            expect(parsedData.status).toBe('success')
            expect(parsedData.data).toBeDefined()
          }

          // Verify metadata.json exists
          const metadataFile = path.join(snapshotDir, 'metadata.json')
          const metadataExists = await fs
            .access(metadataFile)
            .then(() => true)
            .catch(() => false)
          expect(metadataExists).toBe(true)

          // Verify manifest.json exists
          const manifestFile = path.join(snapshotDir, 'manifest.json')
          const manifestExists = await fs
            .access(manifestFile)
            .then(() => true)
            .catch(() => false)
          expect(manifestExists).toBe(true)

          return true
        }),
        { numRuns: TEST_ITERATIONS }
      )
    },
    TEST_TIMEOUT
  )

  // Feature: district-scoped-data-collection, Property 10: Snapshot Metadata Completeness
  it(
    'Property 10: Snapshot Metadata Completeness - should include complete metadata and manifest files',
    async () => {
      await fc.assert(
        fc.asyncProperty(snapshotGenerator, async snapshot => {
          // Force status to 'success' for this test since we need getLatestSuccessful to work
          snapshot.status = 'success'

          // Generate unique dataAsOfDate to prevent snapshot overwrites
          const uniqueDataAsOfDate = generateUniqueDataAsOfDate()
          snapshot.payload.metadata.dataAsOfDate = uniqueDataAsOfDate

          // Ensure district count matches payload
          snapshot.payload.metadata.districtCount =
            snapshot.payload.districts.length

          // Ensure district IDs are unique
          const uniqueDistricts = Array.from(
            new Set(snapshot.payload.districts.map(d => d.districtId))
          )
          if (uniqueDistricts.length !== snapshot.payload.districts.length) {
            return true
          }

          // Write the snapshot
          await store.writeSnapshot(snapshot)

          // The actual snapshot ID is the ISO date format of dataAsOfDate
          const actualSnapshotId = uniqueDataAsOfDate

          // Read and verify metadata.json using actual snapshot ID
          const metadata = await store.getSnapshotMetadata(actualSnapshotId)
          expect(metadata).toBeDefined()
          expect(metadata!.snapshotId).toBe(actualSnapshotId)
          expect(metadata!.schemaVersion).toBe(snapshot.schema_version)
          expect(metadata!.calculationVersion).toBe(
            snapshot.calculation_version
          )
          expect(metadata!.status).toBe(snapshot.status)
          expect(metadata!.configuredDistricts).toEqual(
            snapshot.payload.districts.map(d => d.districtId)
          )
          expect(metadata!.source).toBe(snapshot.payload.metadata.source)
          expect(metadata!.dataAsOfDate).toBe(uniqueDataAsOfDate)

          // Read and verify manifest.json using actual snapshot ID
          const manifest = await store.getSnapshotManifest(actualSnapshotId)
          expect(manifest).toBeDefined()
          expect(manifest!.snapshotId).toBe(actualSnapshotId)
          expect(manifest!.totalDistricts).toBe(
            snapshot.payload.districts.length
          )
          expect(manifest!.districts).toHaveLength(
            snapshot.payload.districts.length
          )

          // Verify each district entry in manifest
          for (const district of snapshot.payload.districts) {
            const manifestEntry = manifest!.districts.find(
              d => d.districtId === district.districtId
            )
            expect(manifestEntry).toBeDefined()
            expect(manifestEntry!.fileName).toBe(
              `district_${district.districtId}.json`
            )
            expect(manifestEntry!.status).toBe('success')
            expect(manifestEntry!.fileSize).toBeGreaterThan(0)
          }

          return true
        }),
        { numRuns: TEST_ITERATIONS }
      )
    },
    TEST_TIMEOUT
  )

  // Feature: district-scoped-data-collection, Property 16: Directory Scanning for Latest Snapshot
  // Updated: current.json pointer mechanism removed, directory scanning is now primary mechanism
  it(
    'Property 16: Directory Scanning for Latest Snapshot - should find latest successful snapshot via directory scanning',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(snapshotGenerator, { minLength: 1, maxLength: 3 }),
          async snapshots => {
            // Generate unique base date for this test iteration
            const baseIterationDate = generateUniqueDataAsOfDate()
            const baseDate = new Date(baseIterationDate)

            // Ensure unique snapshot IDs and district IDs within each snapshot
            // Use different dataAsOfDate values to ensure unique snapshot directories
            const uniqueSnapshots = snapshots.map((snapshot, index) => {
              // Generate unique dataAsOfDate for each snapshot within this iteration
              const snapshotDate = new Date(baseDate)
              snapshotDate.setDate(snapshotDate.getDate() + index)
              const dataAsOfDate = snapshotDate.toISOString().split('T')[0]

              return {
                ...snapshot,
                snapshot_id: (Date.now() + index).toString(),
                payload: {
                  ...snapshot.payload,
                  // Limit districts to reduce test complexity
                  districts: snapshot.payload.districts
                    .slice(0, 2)
                    .map((district, districtIndex) => ({
                      ...district,
                      districtId: `D${testIterationCounter}_${index}_${districtIndex}`,
                    })),
                  metadata: {
                    ...snapshot.payload.metadata,
                    districtCount: Math.min(
                      snapshot.payload.districts.length,
                      2
                    ),
                    dataAsOfDate,
                  },
                },
              }
            })

            let lastSuccessfulDataAsOfDate: string | null = null

            // Write snapshots in sequence
            for (const snapshot of uniqueSnapshots) {
              await store.writeSnapshot(snapshot)

              if (snapshot.status === 'success') {
                lastSuccessfulDataAsOfDate =
                  snapshot.payload.metadata.dataAsOfDate
              }
            }

            // Verify latest successful snapshot is found via directory scanning (no current.json pointer)
            if (lastSuccessfulDataAsOfDate) {
              const currentSnapshot = await store.getLatestSuccessful()
              expect(currentSnapshot).toBeDefined()
              // The snapshot_id should be the ISO date format of the dataAsOfDate
              expect(currentSnapshot!.snapshot_id).toBe(
                lastSuccessfulDataAsOfDate
              )

              // Verify no current.json pointer file exists (directory scanning is primary mechanism)
              const currentPointerPath = path.join(testCacheDir, 'current.json')
              const currentExists = await fs
                .access(currentPointerPath)
                .then(() => true)
                .catch(() => false)
              expect(currentExists).toBe(false)
            }

            return true
          }
        ),
        { numRuns: 10 } // Reduced iterations for this complex test
      )
    },
    TEST_TIMEOUT
  )

  // Feature: district-scoped-data-collection, Property 11: Data Aggregation Consistency
  it(
    'Property 11: Data Aggregation Consistency - should reconstruct original snapshot format from per-district files',
    async () => {
      await fc.assert(
        fc.asyncProperty(snapshotGenerator, async originalSnapshot => {
          // Force status to 'success' for this test since we need getLatestSuccessful to work
          originalSnapshot.status = 'success'

          // Generate unique dataAsOfDate to prevent snapshot overwrites
          const uniqueDataAsOfDate = generateUniqueDataAsOfDate()
          originalSnapshot.payload.metadata.dataAsOfDate = uniqueDataAsOfDate

          // Ensure district count matches payload
          originalSnapshot.payload.metadata.districtCount =
            originalSnapshot.payload.districts.length

          // Ensure district IDs are unique
          const uniqueDistricts = Array.from(
            new Set(originalSnapshot.payload.districts.map(d => d.districtId))
          )
          if (
            uniqueDistricts.length !== originalSnapshot.payload.districts.length
          ) {
            return true
          }

          // Write the snapshot
          await store.writeSnapshot(originalSnapshot)

          // The actual snapshot ID is the ISO date format of dataAsOfDate
          const actualSnapshotId = uniqueDataAsOfDate

          // Read it back using the aggregation method with actual snapshot ID
          const reconstructedSnapshot =
            await store.getSnapshot(actualSnapshotId)
          expect(reconstructedSnapshot).toBeDefined()

          // Verify core snapshot properties match (using actual snapshot ID)
          expect(reconstructedSnapshot!.snapshot_id).toBe(actualSnapshotId)
          expect(reconstructedSnapshot!.schema_version).toBe(
            originalSnapshot.schema_version
          )
          expect(reconstructedSnapshot!.calculation_version).toBe(
            originalSnapshot.calculation_version
          )
          expect(reconstructedSnapshot!.status).toBe(originalSnapshot.status)
          expect(reconstructedSnapshot!.errors).toEqual(originalSnapshot.errors)

          // Verify district data is preserved
          expect(reconstructedSnapshot!.payload.districts).toHaveLength(
            originalSnapshot.payload.districts.length
          )

          // Verify each district's data is preserved
          for (const originalDistrict of originalSnapshot.payload.districts) {
            const reconstructedDistrict =
              reconstructedSnapshot!.payload.districts.find(
                d => d.districtId === originalDistrict.districtId
              )
            expect(reconstructedDistrict).toBeDefined()
            expect(reconstructedDistrict!.districtId).toBe(
              originalDistrict.districtId
            )
            expect(reconstructedDistrict!.membership.total).toBe(
              originalDistrict.membership.total
            )
            expect(reconstructedDistrict!.clubs.total).toBe(
              originalDistrict.clubs.total
            )
            expect(reconstructedDistrict!.education.totalAwards).toBe(
              originalDistrict.education.totalAwards
            )
          }

          // Verify metadata is preserved
          expect(reconstructedSnapshot!.payload.metadata.source).toBe(
            originalSnapshot.payload.metadata.source
          )
          expect(reconstructedSnapshot!.payload.metadata.dataAsOfDate).toBe(
            uniqueDataAsOfDate
          )
          expect(reconstructedSnapshot!.payload.metadata.districtCount).toBe(
            originalSnapshot.payload.districts.length
          )

          return true
        }),
        { numRuns: TEST_ITERATIONS }
      )
    },
    TEST_TIMEOUT
  )

  // Feature: district-scoped-data-collection, Property 17: Selective File Access
  it(
    'Property 17: Selective File Access - should read only requested district files',
    async () => {
      await fc.assert(
        fc.asyncProperty(snapshotGenerator, async snapshot => {
          // Force status to 'success' for this test since we need getLatestSuccessful to work
          snapshot.status = 'success'

          // Generate unique dataAsOfDate to prevent snapshot overwrites
          const uniqueDataAsOfDate = generateUniqueDataAsOfDate()
          snapshot.payload.metadata.dataAsOfDate = uniqueDataAsOfDate

          // Ensure district count matches payload
          snapshot.payload.metadata.districtCount =
            snapshot.payload.districts.length

          // Ensure district IDs are unique
          const uniqueDistricts = Array.from(
            new Set(snapshot.payload.districts.map(d => d.districtId))
          )
          if (uniqueDistricts.length !== snapshot.payload.districts.length) {
            return true
          }

          // Write the snapshot
          await store.writeSnapshot(snapshot)

          // The actual snapshot ID is the ISO date format of dataAsOfDate
          const actualSnapshotId = uniqueDataAsOfDate

          // Test reading existing districts using actual snapshot ID
          for (const originalDistrict of snapshot.payload.districts) {
            const districtData = await store.readDistrictData(
              actualSnapshotId,
              originalDistrict.districtId
            )

            // District should be found and data should match
            expect(districtData).toBeDefined()
            expect(districtData).not.toBeNull()
            expect(districtData!.districtId).toBe(originalDistrict.districtId)
            expect(districtData!.membership.total).toBe(
              originalDistrict.membership.total
            )
          }

          // Test reading non-existent districts
          const nonExistentDistrictIds = [
            'NONEXISTENT1',
            'NONEXISTENT2',
            'NONEXISTENT3',
          ]
          for (const nonExistentId of nonExistentDistrictIds) {
            // Only test if this ID doesn't exist in the snapshot
            if (
              !snapshot.payload.districts.some(
                d => d.districtId === nonExistentId
              )
            ) {
              const districtData = await store.readDistrictData(
                actualSnapshotId,
                nonExistentId
              )
              // District should not be found
              expect(districtData).toBeNull()
            }
          }

          // Test listing districts in snapshot using actual snapshot ID
          const districtsInSnapshot =
            await store.listDistrictsInSnapshot(actualSnapshotId)
          expect(districtsInSnapshot).toHaveLength(
            snapshot.payload.districts.length
          )

          for (const district of snapshot.payload.districts) {
            expect(districtsInSnapshot).toContain(district.districtId)
          }

          return true
        }),
        { numRuns: TEST_ITERATIONS }
      )
    },
    TEST_TIMEOUT
  )
})
