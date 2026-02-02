/**
 * Unit Tests for TransformService
 *
 * Tests the CSV-to-snapshot transformation functionality.
 *
 * Requirements:
 * - 2.2: WHEN transforming raw CSVs, THE Scraper_CLI SHALL use the same
 *        DataTransformationService logic as the Backend
 * - 2.3: THE Scraper_CLI SHALL store snapshots in the same directory structure
 *        as the Backend expects: `CACHE_DIR/snapshots/{date}/`
 * - 2.4: WHEN a snapshot is created, THE Scraper_CLI SHALL write district JSON
 *        files, metadata.json, and manifest.json
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { TransformService } from '../services/TransformService.js'
import { ANALYTICS_SCHEMA_VERSION } from '@toastmasters/analytics-core'

/**
 * Create an isolated test cache directory
 */
function createIsolatedCacheDir(): {
  path: string
  cleanup: () => Promise<void>
} {
  const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const cachePath = path.join(os.tmpdir(), `transform-service-test-${uniqueId}`)

  return {
    path: cachePath,
    cleanup: async () => {
      await fs.rm(cachePath, { recursive: true, force: true })
    },
  }
}

/**
 * Sample club performance CSV content
 */
const SAMPLE_CLUB_CSV = `Club Number,Club Name,Division,Area,Active Members,Total to Date,Goals Met,Club Status
1234,Test Club One,A,1,25,30,5,Active
5678,Test Club Two,A,2,18,22,3,Active
9012,Test Club Three,B,1,12,15,2,Distinguished`

/**
 * Sample division performance CSV content
 */
const SAMPLE_DIVISION_CSV = `Division,Division Name,Club Count,Membership,Total to Date
A,Division Alpha,2,43,52
B,Division Beta,1,12,15`

/**
 * Sample district performance CSV content
 */
const SAMPLE_DISTRICT_CSV = `District,Distinguished Clubs,Select Distinguished,President's Distinguished
1,1,0,0`

describe('TransformService', () => {
  let testCache: { path: string; cleanup: () => Promise<void> }
  let transformService: TransformService

  beforeEach(async () => {
    testCache = createIsolatedCacheDir()
    await fs.mkdir(testCache.path, { recursive: true })

    transformService = new TransformService({
      cacheDir: testCache.path,
    })
  })

  afterEach(async () => {
    await testCache.cleanup()
  })

  describe('discoverAvailableDistricts', () => {
    it('should return empty array when raw-csv directory does not exist', async () => {
      const districts =
        await transformService.discoverAvailableDistricts('2024-01-15')
      expect(districts).toEqual([])
    })

    it('should discover districts from raw-csv directory structure', async () => {
      // Create raw-csv directory structure
      const date = '2024-01-15'
      const rawCsvDir = path.join(testCache.path, 'raw-csv', date)

      await fs.mkdir(path.join(rawCsvDir, 'district-1'), { recursive: true })
      await fs.mkdir(path.join(rawCsvDir, 'district-42'), { recursive: true })
      await fs.mkdir(path.join(rawCsvDir, 'district-100'), { recursive: true })

      const districts = await transformService.discoverAvailableDistricts(date)

      // Should be sorted numerically
      expect(districts).toEqual(['1', '42', '100'])
    })

    it('should ignore non-district directories', async () => {
      const date = '2024-01-15'
      const rawCsvDir = path.join(testCache.path, 'raw-csv', date)

      await fs.mkdir(path.join(rawCsvDir, 'district-1'), { recursive: true })
      await fs.mkdir(path.join(rawCsvDir, 'other-folder'), { recursive: true })
      await fs.writeFile(path.join(rawCsvDir, 'all-districts.csv'), 'test')

      const districts = await transformService.discoverAvailableDistricts(date)

      expect(districts).toEqual(['1'])
    })
  })

  describe('snapshotExists', () => {
    it('should return false when snapshot does not exist', async () => {
      const exists = await transformService.snapshotExists('2024-01-15', '1')
      expect(exists).toBe(false)
    })

    it('should return true when snapshot exists', async () => {
      const date = '2024-01-15'
      const snapshotDir = path.join(testCache.path, 'snapshots', date)
      await fs.mkdir(snapshotDir, { recursive: true })
      await fs.writeFile(
        path.join(snapshotDir, 'district_1.json'),
        JSON.stringify({ districtId: '1' })
      )

      const exists = await transformService.snapshotExists(date, '1')
      expect(exists).toBe(true)
    })
  })

  describe('transformDistrict', () => {
    it('should return error when raw CSV data not found', async () => {
      const result = await transformService.transformDistrict('2024-01-15', '1')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Raw CSV data not found')
    })

    it('should skip transformation when snapshot exists and force is false', async () => {
      const date = '2024-01-15'

      // Create existing snapshot
      const snapshotDir = path.join(testCache.path, 'snapshots', date)
      await fs.mkdir(snapshotDir, { recursive: true })
      await fs.writeFile(
        path.join(snapshotDir, 'district_1.json'),
        JSON.stringify({ districtId: '1' })
      )

      const result = await transformService.transformDistrict(date, '1', {
        force: false,
      })

      expect(result.success).toBe(true)
      expect(result.skipped).toBe(true)
    })

    it('should transform raw CSV data into snapshot format', async () => {
      const date = '2024-01-15'
      const districtId = '1'

      // Create raw CSV files
      const districtDir = path.join(
        testCache.path,
        'raw-csv',
        date,
        `district-${districtId}`
      )
      await fs.mkdir(districtDir, { recursive: true })
      await fs.writeFile(
        path.join(districtDir, 'club-performance.csv'),
        SAMPLE_CLUB_CSV
      )
      await fs.writeFile(
        path.join(districtDir, 'division-performance.csv'),
        SAMPLE_DIVISION_CSV
      )
      await fs.writeFile(
        path.join(districtDir, 'district-performance.csv'),
        SAMPLE_DISTRICT_CSV
      )

      const result = await transformService.transformDistrict(date, districtId)

      expect(result.success).toBe(true)
      expect(result.skipped).toBeFalsy()
      expect(result.snapshotPath).toBeDefined()

      // Verify snapshot file was created
      const snapshotPath = path.join(
        testCache.path,
        'snapshots',
        date,
        `district_${districtId}.json`
      )
      const snapshotContent = await fs.readFile(snapshotPath, 'utf-8')
      const snapshot = JSON.parse(snapshotContent)

      // Verify PerDistrictData wrapper structure
      expect(snapshot.districtId).toBe(districtId)
      expect(snapshot.districtName).toBe(`District ${districtId}`)
      expect(snapshot.status).toBe('success')
      expect(snapshot.collectedAt).toBeDefined()
      
      // Verify the actual district data inside the wrapper
      expect(snapshot.data.districtId).toBe(districtId)
      expect(snapshot.data.snapshotDate).toBe(date)
      expect(snapshot.data.clubs).toHaveLength(3)
      expect(snapshot.data.divisions).toHaveLength(2)
    })

    it('should force re-transform when force option is true', async () => {
      const date = '2024-01-15'
      const districtId = '1'

      // Create existing snapshot with old data
      const snapshotDir = path.join(testCache.path, 'snapshots', date)
      await fs.mkdir(snapshotDir, { recursive: true })
      await fs.writeFile(
        path.join(snapshotDir, `district_${districtId}.json`),
        JSON.stringify({ districtId, clubs: [] })
      )

      // Create raw CSV files with new data
      const districtDir = path.join(
        testCache.path,
        'raw-csv',
        date,
        `district-${districtId}`
      )
      await fs.mkdir(districtDir, { recursive: true })
      await fs.writeFile(
        path.join(districtDir, 'club-performance.csv'),
        SAMPLE_CLUB_CSV
      )

      const result = await transformService.transformDistrict(
        date,
        districtId,
        {
          force: true,
        }
      )

      expect(result.success).toBe(true)
      expect(result.skipped).toBeFalsy()

      // Verify snapshot was updated
      const snapshotContent = await fs.readFile(
        path.join(snapshotDir, `district_${districtId}.json`),
        'utf-8'
      )
      const snapshot = JSON.parse(snapshotContent)
      // Verify the data inside the PerDistrictData wrapper
      expect(snapshot.data.clubs).toHaveLength(3)
    })
  })

  describe('transform', () => {
    it('should return error when no districts found', async () => {
      const result = await transformService.transform({
        date: '2024-01-15',
      })

      expect(result.success).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]?.error).toContain('No raw CSV data found')
    })

    it('should transform all available districts', async () => {
      const date = '2024-01-15'

      // Create raw CSV files for two districts
      for (const districtId of ['1', '2']) {
        const districtDir = path.join(
          testCache.path,
          'raw-csv',
          date,
          `district-${districtId}`
        )
        await fs.mkdir(districtDir, { recursive: true })
        await fs.writeFile(
          path.join(districtDir, 'club-performance.csv'),
          SAMPLE_CLUB_CSV
        )
      }

      const result = await transformService.transform({ date })

      expect(result.success).toBe(true)
      expect(result.districtsProcessed).toEqual(['1', '2'])
      expect(result.districtsSucceeded).toEqual(['1', '2'])
      expect(result.districtsFailed).toEqual([])
    })

    it('should transform only specified districts', async () => {
      const date = '2024-01-15'

      // Create raw CSV files for three districts
      for (const districtId of ['1', '2', '3']) {
        const districtDir = path.join(
          testCache.path,
          'raw-csv',
          date,
          `district-${districtId}`
        )
        await fs.mkdir(districtDir, { recursive: true })
        await fs.writeFile(
          path.join(districtDir, 'club-performance.csv'),
          SAMPLE_CLUB_CSV
        )
      }

      const result = await transformService.transform({
        date,
        districts: ['1', '3'],
      })

      expect(result.success).toBe(true)
      expect(result.districtsProcessed).toEqual(['1', '3'])
      expect(result.districtsSucceeded).toEqual(['1', '3'])
    })

    it('should write metadata.json with correct structure', async () => {
      const date = '2024-01-15'

      // Create raw CSV files
      const districtDir = path.join(
        testCache.path,
        'raw-csv',
        date,
        'district-1'
      )
      await fs.mkdir(districtDir, { recursive: true })
      await fs.writeFile(
        path.join(districtDir, 'club-performance.csv'),
        SAMPLE_CLUB_CSV
      )

      await transformService.transform({ date })

      // Verify metadata.json - now uses backend-compatible structure
      const metadataPath = path.join(
        testCache.path,
        'snapshots',
        date,
        'metadata.json'
      )
      const metadataContent = await fs.readFile(metadataPath, 'utf-8')
      const metadata = JSON.parse(metadataContent)

      expect(metadata.snapshotId).toBe(date)
      expect(metadata.schemaVersion).toBe(ANALYTICS_SCHEMA_VERSION)
      expect(metadata.calculationVersion).toBe(ANALYTICS_SCHEMA_VERSION)
      expect(metadata.status).toBe('success')
      expect(metadata.source).toBe('scraper-cli')
      expect(metadata.successfulDistricts).toEqual(['1'])
      expect(metadata.failedDistricts).toEqual([])
      expect(metadata.configuredDistricts).toEqual(['1'])
      expect(metadata.dataAsOfDate).toBe(date)
      expect(metadata.createdAt).toBeDefined()
      expect(metadata.processingDuration).toBeGreaterThanOrEqual(0)
    })

    it('should write manifest.json with district entries', async () => {
      const date = '2024-01-15'

      // Create raw CSV files for two districts
      for (const districtId of ['1', '2']) {
        const districtDir = path.join(
          testCache.path,
          'raw-csv',
          date,
          `district-${districtId}`
        )
        await fs.mkdir(districtDir, { recursive: true })
        await fs.writeFile(
          path.join(districtDir, 'club-performance.csv'),
          SAMPLE_CLUB_CSV
        )
      }

      await transformService.transform({ date })

      // Verify manifest.json - now uses backend-compatible structure
      const manifestPath = path.join(
        testCache.path,
        'snapshots',
        date,
        'manifest.json'
      )
      const manifestContent = await fs.readFile(manifestPath, 'utf-8')
      const manifest = JSON.parse(manifestContent)

      expect(manifest.snapshotId).toBe(date)
      expect(manifest.totalDistricts).toBe(2)
      expect(manifest.successfulDistricts).toBe(2)
      expect(manifest.failedDistricts).toBe(0)
      expect(manifest.districts).toHaveLength(2)

      // Verify district entries have required fields
      for (const district of manifest.districts) {
        expect(district.districtId).toBeDefined()
        expect(district.fileName).toBeDefined()
        expect(district.status).toBe('success')
        expect(district.fileSize).toBeGreaterThan(0)
        expect(district.lastModified).toBeDefined()
      }

      // Verify district files are present
      const districtIds = manifest.districts.map(
        (d: { districtId: string }) => d.districtId
      )
      expect(districtIds).toContain('1')
      expect(districtIds).toContain('2')
    })

    it('should continue processing when one district fails', async () => {
      const date = '2024-01-15'

      // Create valid raw CSV for district 1
      const district1Dir = path.join(
        testCache.path,
        'raw-csv',
        date,
        'district-1'
      )
      await fs.mkdir(district1Dir, { recursive: true })
      await fs.writeFile(
        path.join(district1Dir, 'club-performance.csv'),
        SAMPLE_CLUB_CSV
      )

      // Create invalid raw CSV for district 2 (empty directory, no club-performance.csv)
      const district2Dir = path.join(
        testCache.path,
        'raw-csv',
        date,
        'district-2'
      )
      await fs.mkdir(district2Dir, { recursive: true })

      const result = await transformService.transform({ date })

      // Should have partial success
      expect(result.districtsProcessed).toEqual(['1', '2'])
      expect(result.districtsSucceeded).toEqual(['1'])
      expect(result.districtsFailed).toEqual(['2'])
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]?.districtId).toBe('2')
    })

    it('should skip already transformed districts when force is false', async () => {
      const date = '2024-01-15'

      // Create raw CSV files
      const districtDir = path.join(
        testCache.path,
        'raw-csv',
        date,
        'district-1'
      )
      await fs.mkdir(districtDir, { recursive: true })
      await fs.writeFile(
        path.join(districtDir, 'club-performance.csv'),
        SAMPLE_CLUB_CSV
      )

      // First transform
      await transformService.transform({ date })

      // Second transform without force
      const result = await transformService.transform({ date, force: false })

      expect(result.success).toBe(true)
      expect(result.districtsSkipped).toEqual(['1'])
      expect(result.districtsSucceeded).toEqual([])
    })

    it('should re-transform all districts when force is true', async () => {
      const date = '2024-01-15'

      // Create raw CSV files
      const districtDir = path.join(
        testCache.path,
        'raw-csv',
        date,
        'district-1'
      )
      await fs.mkdir(districtDir, { recursive: true })
      await fs.writeFile(
        path.join(districtDir, 'club-performance.csv'),
        SAMPLE_CLUB_CSV
      )

      // First transform
      await transformService.transform({ date })

      // Second transform with force
      const result = await transformService.transform({ date, force: true })

      expect(result.success).toBe(true)
      expect(result.districtsSkipped).toEqual([])
      expect(result.districtsSucceeded).toEqual(['1'])
    })
  })

  describe('snapshot directory structure', () => {
    it('should create snapshots in CACHE_DIR/snapshots/{date}/ structure', async () => {
      const date = '2024-01-15'

      // Create raw CSV files
      const districtDir = path.join(
        testCache.path,
        'raw-csv',
        date,
        'district-1'
      )
      await fs.mkdir(districtDir, { recursive: true })
      await fs.writeFile(
        path.join(districtDir, 'club-performance.csv'),
        SAMPLE_CLUB_CSV
      )

      await transformService.transform({ date })

      // Verify directory structure
      const snapshotDir = path.join(testCache.path, 'snapshots', date)
      const files = await fs.readdir(snapshotDir)

      expect(files).toContain('district_1.json')
      expect(files).toContain('metadata.json')
      expect(files).toContain('manifest.json')
    })
  })
})
