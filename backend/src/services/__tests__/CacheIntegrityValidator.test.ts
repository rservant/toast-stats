/**
 * Unit Tests for CacheIntegrityValidator
 *
 * Tests metadata validation against file system state, corruption detection
 * for various content types, recovery operations, and integrity totals recalculation.
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 6.2**
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import { CacheIntegrityValidator } from '../CacheIntegrityValidator'
import { ILogger } from '../../types/serviceInterfaces'
import { RawCSVCacheMetadata, CSVType } from '../../types/rawCSVCache'
import { createTestSelfCleanup } from '../../utils/test-self-cleanup'

/** Mock logger implementation for testing */
class TestLogger implements ILogger {
  public logs: Array<{ level: string; message: string; data?: unknown }> = []

  info(message: string, data?: unknown): void {
    this.logs.push({ level: 'info', message, data })
  }

  warn(message: string, data?: unknown): void {
    this.logs.push({ level: 'warn', message, data })
  }

  error(message: string, error?: Error | unknown): void {
    this.logs.push({ level: 'error', message, data: error })
  }

  debug(message: string, data?: unknown): void {
    this.logs.push({ level: 'debug', message, data })
  }

  clear(): void {
    this.logs = []
  }
}

/** Helper to create valid CSV content */
function createValidCSV(rows: number = 3): string {
  const header = 'col1,col2,col3'
  const dataRows = Array.from(
    { length: rows },
    (_, i) => `value${i}a,value${i}b,value${i}c`
  )
  return [header, ...dataRows].join('\n')
}

/** Helper to create test metadata */
function createTestMetadata(
  date: string,
  overrides: Partial<RawCSVCacheMetadata> = {}
): RawCSVCacheMetadata {
  return {
    date,
    timestamp: Date.now(),
    programYear: '2024-2025',
    csvFiles: { allDistricts: false, districts: {} },
    downloadStats: {
      totalDownloads: 0,
      cacheHits: 0,
      cacheMisses: 0,
      lastAccessed: Date.now(),
    },
    integrity: { checksums: {}, totalSize: 0, fileCount: 0 },
    source: 'collector',
    cacheVersion: 1,
    ...overrides,
  }
}

describe('CacheIntegrityValidator - Unit Tests', () => {
  let logger: TestLogger
  let validator: CacheIntegrityValidator
  let testCacheDir: string

  const { cleanup, afterEach: performCleanup } = createTestSelfCleanup({
    verbose: false,
  })

  beforeEach(async () => {
    logger = new TestLogger()
    validator = new CacheIntegrityValidator(logger)
    testCacheDir = `./test-cache/integrity-validator-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    cleanup.trackDirectory(path.resolve(testCacheDir))
    await fs.mkdir(testCacheDir, { recursive: true })
  })

  afterEach(async () => {
    await performCleanup()
  })

  describe('validateMetadataIntegrity - Metadata Validation Against File System', () => {
    it('should return invalid when metadata is null', async () => {
      const result = await validator.validateMetadataIntegrity(
        testCacheDir,
        '2024-01-15',
        null
      )
      expect(result.isValid).toBe(false)
      expect(result.issues).toContain('Metadata file does not exist')
    })

    it('should validate matching file count and size', async () => {
      const date = '2024-01-15'
      const datePath = path.join(testCacheDir, date)
      await fs.mkdir(datePath, { recursive: true })

      const csvContent = createValidCSV()
      const csvPath = path.join(datePath, 'all-districts.csv')
      await fs.writeFile(csvPath, csvContent)

      const stats = await fs.stat(csvPath)
      const checksum = crypto
        .createHash('sha256')
        .update(csvContent)
        .digest('hex')

      const metadata = createTestMetadata(date, {
        integrity: {
          checksums: { 'all-districts.csv': checksum },
          totalSize: stats.size,
          fileCount: 1,
        },
        csvFiles: { allDistricts: true, districts: {} },
      })

      const result = await validator.validateMetadataIntegrity(
        testCacheDir,
        date,
        metadata
      )
      expect(result.isValid).toBe(true)
      expect(result.issues).toHaveLength(0)
      expect(result.actualStats.fileCount).toBe(1)
    })

    it('should detect file count mismatch', async () => {
      const date = '2024-01-15'
      const datePath = path.join(testCacheDir, date)
      await fs.mkdir(datePath, { recursive: true })

      const csvContent = createValidCSV()
      await fs.writeFile(path.join(datePath, 'all-districts.csv'), csvContent)

      const metadata = createTestMetadata(date, {
        integrity: { checksums: {}, totalSize: 0, fileCount: 5 }, // Wrong count
      })

      const result = await validator.validateMetadataIntegrity(
        testCacheDir,
        date,
        metadata
      )
      expect(result.isValid).toBe(false)
      expect(result.issues.some(i => i.includes('File count mismatch'))).toBe(
        true
      )
    })

    it('should detect total size mismatch', async () => {
      const date = '2024-01-15'
      const datePath = path.join(testCacheDir, date)
      await fs.mkdir(datePath, { recursive: true })

      const csvContent = createValidCSV()
      await fs.writeFile(path.join(datePath, 'all-districts.csv'), csvContent)

      const metadata = createTestMetadata(date, {
        integrity: { checksums: {}, totalSize: 999999, fileCount: 1 }, // Wrong size
      })

      const result = await validator.validateMetadataIntegrity(
        testCacheDir,
        date,
        metadata
      )
      expect(result.isValid).toBe(false)
      expect(result.issues.some(i => i.includes('Total size mismatch'))).toBe(
        true
      )
    })

    it('should detect checksum mismatch', async () => {
      const date = '2024-01-15'
      const datePath = path.join(testCacheDir, date)
      await fs.mkdir(datePath, { recursive: true })

      const csvContent = createValidCSV()
      const csvPath = path.join(datePath, 'all-districts.csv')
      await fs.writeFile(csvPath, csvContent)

      const stats = await fs.stat(csvPath)
      const metadata = createTestMetadata(date, {
        integrity: {
          checksums: { 'all-districts.csv': 'wrong-checksum-value' },
          totalSize: stats.size,
          fileCount: 1,
        },
      })

      const result = await validator.validateMetadataIntegrity(
        testCacheDir,
        date,
        metadata
      )
      expect(result.isValid).toBe(false)
      expect(result.issues.some(i => i.includes('Checksum mismatch'))).toBe(
        true
      )
    })

    it('should detect missing files referenced in metadata', async () => {
      const date = '2024-01-15'
      const datePath = path.join(testCacheDir, date)
      await fs.mkdir(datePath, { recursive: true })

      const metadata = createTestMetadata(date, {
        integrity: {
          checksums: { 'nonexistent.csv': 'some-checksum' },
          totalSize: 0,
          fileCount: 0,
        },
      })

      const result = await validator.validateMetadataIntegrity(
        testCacheDir,
        date,
        metadata
      )
      expect(result.isValid).toBe(false)
      expect(result.issues.some(i => i.includes('Missing file'))).toBe(true)
    })

    it('should validate district subdirectory files', async () => {
      const date = '2024-01-15'
      const datePath = path.join(testCacheDir, date)
      const districtPath = path.join(datePath, 'district-42')
      await fs.mkdir(districtPath, { recursive: true })

      const csvContent = createValidCSV()
      const csvPath = path.join(districtPath, 'club-performance.csv')
      await fs.writeFile(csvPath, csvContent)

      const stats = await fs.stat(csvPath)
      const checksum = crypto
        .createHash('sha256')
        .update(csvContent)
        .digest('hex')

      const metadata = createTestMetadata(date, {
        integrity: {
          checksums: { 'district-42/club-performance.csv': checksum },
          totalSize: stats.size,
          fileCount: 1,
        },
      })

      const result = await validator.validateMetadataIntegrity(
        testCacheDir,
        date,
        metadata
      )
      expect(result.isValid).toBe(true)
    })
  })

  describe('detectCorruption - Corruption Detection', () => {
    it('should detect empty content', async () => {
      const result = await validator.detectCorruption('', null, 'test.csv')
      expect(result.isValid).toBe(false)
      expect(result.issues).toContain('File is empty')
    })

    it('should detect whitespace-only content', async () => {
      const result = await validator.detectCorruption(
        '   \n  \t  ',
        null,
        'test.csv'
      )
      expect(result.isValid).toBe(false)
      expect(result.issues).toContain('File is empty')
    })

    it('should detect CSV with only header (no data rows)', async () => {
      const result = await validator.detectCorruption(
        'header1,header2',
        null,
        'test.csv'
      )
      expect(result.isValid).toBe(false)
      expect(
        result.issues.some(i =>
          i.includes('at least a header and one data row')
        )
      ).toBe(true)
    })

    it('should detect binary/control characters', async () => {
      const result = await validator.detectCorruption(
        'header\nvalue\x00data',
        null,
        'test.csv'
      )
      expect(result.isValid).toBe(false)
      expect(
        result.issues.some(i => i.includes('binary or control characters'))
      ).toBe(true)
    })

    it('should detect checksum mismatch when metadata is provided', async () => {
      const content = createValidCSV()
      const metadata = createTestMetadata('2024-01-15', {
        integrity: {
          checksums: { 'test.csv': 'wrong-checksum' },
          totalSize: 0,
          fileCount: 0,
        },
      })

      const result = await validator.detectCorruption(
        content,
        metadata,
        'test.csv'
      )
      expect(result.isValid).toBe(false)
      expect(result.issues.some(i => i.includes('Checksum mismatch'))).toBe(
        true
      )
    })

    it('should detect truncated content', async () => {
      const content = 'header1,header2\nvalue1,value2\ntruncated'
      const result = await validator.detectCorruption(content, null, 'test.csv')
      expect(result.isValid).toBe(false)
      expect(result.issues.some(i => i.includes('truncated'))).toBe(true)
    })

    it('should detect excessively long lines', async () => {
      const longLine = 'a'.repeat(60000)
      const content = `header\n${longLine}`
      const result = await validator.detectCorruption(content, null, 'test.csv')
      expect(result.isValid).toBe(false)
      expect(result.issues.some(i => i.includes('excessively long'))).toBe(true)
    })

    it('should accept valid CSV content', async () => {
      const content = createValidCSV()
      const result = await validator.detectCorruption(content, null, 'test.csv')
      expect(result.isValid).toBe(true)
      expect(result.issues).toHaveLength(0)
    })

    it('should accept valid CSV with matching checksum', async () => {
      const content = createValidCSV()
      const checksum = crypto.createHash('sha256').update(content).digest('hex')
      const metadata = createTestMetadata('2024-01-15', {
        integrity: {
          checksums: { 'test.csv': checksum },
          totalSize: 0,
          fileCount: 0,
        },
      })

      const result = await validator.detectCorruption(
        content,
        metadata,
        'test.csv'
      )
      expect(result.isValid).toBe(true)
    })
  })

  describe('attemptCorruptionRecovery - Recovery Operations', () => {
    it('should remove corrupted file successfully', async () => {
      const date = '2024-01-15'
      const datePath = path.join(testCacheDir, date)
      await fs.mkdir(datePath, { recursive: true })

      const csvPath = path.join(datePath, 'all-districts.csv')
      await fs.writeFile(csvPath, 'corrupted content')

      const result = await validator.attemptCorruptionRecovery(
        testCacheDir,
        date,
        CSVType.ALL_DISTRICTS
      )

      expect(result.success).toBe(true)
      expect(result.actions).toContain('Removed corrupted file')

      // Verify file was removed
      await expect(fs.access(csvPath)).rejects.toThrow()
    })

    it('should handle non-existent file gracefully', async () => {
      const date = '2024-01-15'
      const datePath = path.join(testCacheDir, date)
      await fs.mkdir(datePath, { recursive: true })

      const result = await validator.attemptCorruptionRecovery(
        testCacheDir,
        date,
        CSVType.ALL_DISTRICTS
      )

      // Should succeed even if file doesn't exist (ENOENT is ignored)
      expect(result.success).toBe(true)
    })

    it('should remove district-specific corrupted file', async () => {
      const date = '2024-01-15'
      const districtPath = path.join(testCacheDir, date, 'district-42')
      await fs.mkdir(districtPath, { recursive: true })

      const csvPath = path.join(districtPath, 'club-performance.csv')
      await fs.writeFile(csvPath, 'corrupted content')

      const result = await validator.attemptCorruptionRecovery(
        testCacheDir,
        date,
        CSVType.CLUB_PERFORMANCE,
        '42'
      )

      expect(result.success).toBe(true)
      await expect(fs.access(csvPath)).rejects.toThrow()
    })

    it('should return error when district ID is required but not provided', async () => {
      const date = '2024-01-15'
      await fs.mkdir(path.join(testCacheDir, date), { recursive: true })

      const result = await validator.attemptCorruptionRecovery(
        testCacheDir,
        date,
        CSVType.CLUB_PERFORMANCE
      )

      expect(result.success).toBe(false)
      expect(result.errors.some(e => e.includes('District ID required'))).toBe(
        true
      )
    })
  })

  describe('recalculateIntegrityTotals - Integrity Totals Recalculation', () => {
    it('should calculate correct totals for single file', async () => {
      const date = '2024-01-15'
      const datePath = path.join(testCacheDir, date)
      await fs.mkdir(datePath, { recursive: true })

      const csvContent = createValidCSV()
      await fs.writeFile(path.join(datePath, 'all-districts.csv'), csvContent)

      const metadata = createTestMetadata(date)
      const result = await validator.recalculateIntegrityTotals(
        testCacheDir,
        date,
        metadata
      )

      expect(result.integrity.fileCount).toBe(1)
      expect(result.integrity.totalSize).toBe(Buffer.byteLength(csvContent))
    })

    it('should calculate correct totals for multiple files', async () => {
      const date = '2024-01-15'
      const datePath = path.join(testCacheDir, date)
      await fs.mkdir(datePath, { recursive: true })

      const csv1 = createValidCSV(3)
      const csv2 = createValidCSV(5)
      await fs.writeFile(path.join(datePath, 'file1.csv'), csv1)
      await fs.writeFile(path.join(datePath, 'file2.csv'), csv2)

      const metadata = createTestMetadata(date)
      const result = await validator.recalculateIntegrityTotals(
        testCacheDir,
        date,
        metadata
      )

      expect(result.integrity.fileCount).toBe(2)
      expect(result.integrity.totalSize).toBe(
        Buffer.byteLength(csv1) + Buffer.byteLength(csv2)
      )
    })

    it('should include district subdirectory files in totals', async () => {
      const date = '2024-01-15'
      const datePath = path.join(testCacheDir, date)
      const districtPath = path.join(datePath, 'district-42')
      await fs.mkdir(districtPath, { recursive: true })

      const csv1 = createValidCSV()
      const csv2 = createValidCSV()
      await fs.writeFile(path.join(datePath, 'all-districts.csv'), csv1)
      await fs.writeFile(path.join(districtPath, 'club-performance.csv'), csv2)

      const metadata = createTestMetadata(date)
      const result = await validator.recalculateIntegrityTotals(
        testCacheDir,
        date,
        metadata
      )

      expect(result.integrity.fileCount).toBe(2)
      expect(result.integrity.totalSize).toBe(
        Buffer.byteLength(csv1) + Buffer.byteLength(csv2)
      )
    })

    it('should exclude non-CSV files from totals', async () => {
      const date = '2024-01-15'
      const datePath = path.join(testCacheDir, date)
      await fs.mkdir(datePath, { recursive: true })

      const csvContent = createValidCSV()
      await fs.writeFile(path.join(datePath, 'data.csv'), csvContent)
      await fs.writeFile(path.join(datePath, 'metadata.json'), '{}')
      await fs.writeFile(path.join(datePath, 'readme.txt'), 'readme')

      const metadata = createTestMetadata(date)
      const result = await validator.recalculateIntegrityTotals(
        testCacheDir,
        date,
        metadata
      )

      expect(result.integrity.fileCount).toBe(1) // Only CSV file
    })

    it('should handle empty directory gracefully', async () => {
      const date = '2024-01-15'
      const datePath = path.join(testCacheDir, date)
      await fs.mkdir(datePath, { recursive: true })

      const metadata = createTestMetadata(date)
      const result = await validator.recalculateIntegrityTotals(
        testCacheDir,
        date,
        metadata
      )

      expect(result.integrity.fileCount).toBe(0)
      expect(result.integrity.totalSize).toBe(0)
    })

    it('should handle non-existent directory gracefully', async () => {
      const metadata = createTestMetadata('2024-01-15')
      const result = await validator.recalculateIntegrityTotals(
        testCacheDir,
        'nonexistent',
        metadata
      )

      // Should return metadata unchanged on error
      expect(result).toBe(metadata)
    })
  })

  describe('repairMetadataIntegrity - Metadata Repair', () => {
    it('should create metadata when none exists', async () => {
      const date = '2024-01-15'
      const datePath = path.join(testCacheDir, date)
      await fs.mkdir(datePath, { recursive: true })

      const csvContent = createValidCSV()
      await fs.writeFile(path.join(datePath, 'all-districts.csv'), csvContent)

      const result = await validator.repairMetadataIntegrity(
        testCacheDir,
        date,
        null
      )

      expect(result.success).toBe(true)
      expect(result.actions).toContain('created missing metadata file')
      expect(result.actions).toContain('recalculated file counts and sizes')
      expect(result.actions).toContain('recalculated checksums')
    })

    it('should recalculate checksums for existing files', async () => {
      const date = '2024-01-15'
      const datePath = path.join(testCacheDir, date)
      await fs.mkdir(datePath, { recursive: true })

      const csvContent = createValidCSV()
      await fs.writeFile(path.join(datePath, 'all-districts.csv'), csvContent)

      const metadata = createTestMetadata(date, {
        integrity: {
          checksums: { 'all-districts.csv': 'old-wrong-checksum' },
          totalSize: 0,
          fileCount: 0,
        },
      })

      const result = await validator.repairMetadataIntegrity(
        testCacheDir,
        date,
        metadata
      )

      expect(result.success).toBe(true)
      expect(result.actions).toContain('recalculated checksums')
    })

    it('should update csvFiles tracking for all-districts', async () => {
      const date = '2024-01-15'
      const datePath = path.join(testCacheDir, date)
      await fs.mkdir(datePath, { recursive: true })

      const csvContent = createValidCSV()
      await fs.writeFile(path.join(datePath, 'all-districts.csv'), csvContent)

      const metadata = createTestMetadata(date, {
        csvFiles: { allDistricts: false, districts: {} },
      })

      await validator.repairMetadataIntegrity(testCacheDir, date, metadata)

      // The repair should have updated the metadata object
      expect(metadata.csvFiles.allDistricts).toBe(true)
    })

    it('should update csvFiles tracking for district files', async () => {
      const date = '2024-01-15'
      const districtPath = path.join(testCacheDir, date, 'district-42')
      await fs.mkdir(districtPath, { recursive: true })

      await fs.writeFile(
        path.join(districtPath, 'district-performance.csv'),
        createValidCSV()
      )
      await fs.writeFile(
        path.join(districtPath, 'division-performance.csv'),
        createValidCSV()
      )
      await fs.writeFile(
        path.join(districtPath, 'club-performance.csv'),
        createValidCSV()
      )

      const metadata = createTestMetadata(date)
      await validator.repairMetadataIntegrity(testCacheDir, date, metadata)

      expect(metadata.csvFiles.districts['42']).toBeDefined()
      expect(metadata.csvFiles.districts['42']!.districtPerformance).toBe(true)
      expect(metadata.csvFiles.districts['42']!.divisionPerformance).toBe(true)
      expect(metadata.csvFiles.districts['42']!.clubPerformance).toBe(true)
    })

    it('should handle directory scan failure gracefully', async () => {
      const result = await validator.repairMetadataIntegrity(
        testCacheDir,
        'nonexistent-date',
        null
      )

      expect(result.success).toBe(false)
      expect(
        result.errors.some(e => e.includes('Failed to scan directory'))
      ).toBe(true)
    })
  })

  describe('getFilename - Filename Generation', () => {
    it('should generate correct filename for all-districts', () => {
      expect(validator.getFilename(CSVType.ALL_DISTRICTS)).toBe(
        'all-districts.csv'
      )
    })

    it('should generate correct filename for district-specific files', () => {
      expect(validator.getFilename(CSVType.DISTRICT_PERFORMANCE, '42')).toBe(
        'district-42/district-performance.csv'
      )
      expect(validator.getFilename(CSVType.DIVISION_PERFORMANCE, '42')).toBe(
        'district-42/division-performance.csv'
      )
      expect(validator.getFilename(CSVType.CLUB_PERFORMANCE, '42')).toBe(
        'district-42/club-performance.csv'
      )
    })
  })
})
