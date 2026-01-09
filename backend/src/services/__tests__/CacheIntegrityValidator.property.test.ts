/**
 * Property-Based Tests for CacheIntegrityValidator
 *
 * **Feature: raw-csv-cache-refactor, Property 1: Integrity Validation Correctness**
 * **Validates: Requirements 1.1, 1.2, 1.4**
 *
 * Tests that integrity validation correctly identifies:
 * - File count mismatches between metadata and actual files
 * - Total size mismatches between metadata and actual files
 * - Checksum mismatches for individual files
 * - Missing files referenced in metadata
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'
import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import { CacheIntegrityValidator } from '../CacheIntegrityValidator'
import { ILogger } from '../../types/serviceInterfaces'
import { RawCSVCacheMetadata, CSVType } from '../../types/rawCSVCache'
import { createTestSelfCleanup } from '../../utils/test-self-cleanup'

/** Mock logger for testing */
class TestLogger implements ILogger {
  info(_message: string, _data?: unknown): void {}
  warn(_message: string, _data?: unknown): void {}
  error(_message: string, _error?: Error | unknown): void {}
  debug(_message: string, _data?: unknown): void {}
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
    source: 'scraper',
    cacheVersion: 1,
    ...overrides,
  }
}

describe('CacheIntegrityValidator - Property-Based Tests', () => {
  let logger: TestLogger
  let validator: CacheIntegrityValidator
  let testCacheDir: string

  const { cleanup, afterEach: performCleanup } = createTestSelfCleanup({
    verbose: false,
  })

  beforeEach(async () => {
    logger = new TestLogger()
    validator = new CacheIntegrityValidator(logger)
    testCacheDir = `./test-cache/integrity-pbt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    cleanup.trackDirectory(path.resolve(testCacheDir))
    await fs.mkdir(testCacheDir, { recursive: true })
  })

  afterEach(async () => {
    await performCleanup()
  })

  // Generator for valid date strings
  const validDateString = fc
    .tuple(
      fc.integer({ min: 2020, max: 2030 }),
      fc.integer({ min: 1, max: 12 }),
      fc.integer({ min: 1, max: 28 })
    )
    .map(([year, month, day]) => {
      const monthStr = month.toString().padStart(2, '0')
      const dayStr = day.toString().padStart(2, '0')
      return `${year}-${monthStr}-${dayStr}`
    })

  // Generator for CSV row counts (at least 1 data row)
  const csvRowCount = fc.integer({ min: 1, max: 20 })

  // Generator for file counts (1-5 files)
  const fileCount = fc.integer({ min: 1, max: 5 })

  // Generator for wrong file counts (different from actual)
  const wrongFileCount = (actual: number) =>
    fc.integer({ min: 0, max: 20 }).filter(n => n !== actual)

  // Generator for wrong sizes (different from actual by more than tolerance)
  const wrongSize = (actual: number) =>
    fc.integer({ min: 0, max: 1000000 }).filter(n => Math.abs(n - actual) > 100)

  describe('Property 1: Integrity Validation Correctness', () => {
    /**
     * Property 1.1: Correct metadata always validates successfully
     * For any set of files with matching metadata, validation SHALL return isValid: true
     */
    it('should validate successfully when metadata matches actual files', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDateString,
          csvRowCount,
          async (date: string, rows: number) => {
            const datePath = path.join(testCacheDir, date)
            await fs.mkdir(datePath, { recursive: true })

            const csvContent = createValidCSV(rows)
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
            })

            const result = await validator.validateMetadataIntegrity(
              testCacheDir,
              date,
              metadata
            )

            expect(result.isValid).toBe(true)
            expect(result.issues).toHaveLength(0)

            // Cleanup for next iteration
            await fs.rm(datePath, { recursive: true, force: true })
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * Property 1.2: File count mismatch is always detected
     * For any metadata with wrong file count, validation SHALL return isValid: false with file count issue
     */
    it('should detect file count mismatch for any wrong count', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDateString,
          csvRowCount,
          fc.integer({ min: 2, max: 10 }), // Wrong count (actual is 1)
          async (date: string, rows: number, wrongCount: number) => {
            const datePath = path.join(testCacheDir, date)
            await fs.mkdir(datePath, { recursive: true })

            const csvContent = createValidCSV(rows)
            await fs.writeFile(
              path.join(datePath, 'all-districts.csv'),
              csvContent
            )

            const metadata = createTestMetadata(date, {
              integrity: {
                checksums: {},
                totalSize: 0,
                fileCount: wrongCount, // Wrong count
              },
            })

            const result = await validator.validateMetadataIntegrity(
              testCacheDir,
              date,
              metadata
            )

            expect(result.isValid).toBe(false)
            expect(
              result.issues.some(i => i.includes('File count mismatch'))
            ).toBe(true)
            expect(result.actualStats.fileCount).toBe(1)
            expect(result.metadataStats.fileCount).toBe(wrongCount)

            // Cleanup for next iteration
            await fs.rm(datePath, { recursive: true, force: true })
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * Property 1.3: Size mismatch is always detected (beyond tolerance)
     * For any metadata with significantly wrong size, validation SHALL return isValid: false
     */
    it('should detect total size mismatch beyond tolerance', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDateString,
          csvRowCount,
          fc.integer({ min: 10000, max: 100000 }), // Wrong size (much larger than actual)
          async (date: string, rows: number, wrongSizeValue: number) => {
            const datePath = path.join(testCacheDir, date)
            await fs.mkdir(datePath, { recursive: true })

            const csvContent = createValidCSV(rows)
            const csvPath = path.join(datePath, 'all-districts.csv')
            await fs.writeFile(csvPath, csvContent)

            const stats = await fs.stat(csvPath)

            // Only test if the wrong size is significantly different
            if (Math.abs(wrongSizeValue - stats.size) <= 100) {
              return // Skip this case - within tolerance
            }

            const metadata = createTestMetadata(date, {
              integrity: {
                checksums: {},
                totalSize: wrongSizeValue,
                fileCount: 1,
              },
            })

            const result = await validator.validateMetadataIntegrity(
              testCacheDir,
              date,
              metadata
            )

            expect(result.isValid).toBe(false)
            expect(
              result.issues.some(i => i.includes('Total size mismatch'))
            ).toBe(true)

            // Cleanup for next iteration
            await fs.rm(datePath, { recursive: true, force: true })
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * Property 1.4: Checksum mismatch is always detected
     * For any file with wrong checksum in metadata, validation SHALL detect the mismatch
     */
    it('should detect checksum mismatch for any wrong checksum', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDateString,
          csvRowCount,
          fc.integer({ min: 1, max: 1000000 }), // Use integer to generate different checksums
          async (date: string, rows: number, checksumSeed: number) => {
            const datePath = path.join(testCacheDir, date)
            await fs.mkdir(datePath, { recursive: true })

            const csvContent = createValidCSV(rows)
            const csvPath = path.join(datePath, 'all-districts.csv')
            await fs.writeFile(csvPath, csvContent)

            const stats = await fs.stat(csvPath)
            const actualChecksum = crypto
              .createHash('sha256')
              .update(csvContent)
              .digest('hex')

            // Generate a different checksum by hashing the seed
            const badChecksum = crypto
              .createHash('sha256')
              .update(checksumSeed.toString())
              .digest('hex')

            // Skip if randomly generated checksum matches actual (extremely unlikely)
            if (badChecksum === actualChecksum) {
              await fs.rm(datePath, { recursive: true, force: true })
              return
            }

            const metadata = createTestMetadata(date, {
              integrity: {
                checksums: { 'all-districts.csv': badChecksum },
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
            expect(
              result.issues.some(i => i.includes('Checksum mismatch'))
            ).toBe(true)

            // Cleanup for next iteration
            await fs.rm(datePath, { recursive: true, force: true })
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * Property 1.5: Missing files are always detected
     * For any metadata referencing non-existent files, validation SHALL detect missing files
     */
    it('should detect missing files referenced in metadata', async () => {
      // Generator for fake filenames
      const fakeFilename = fc.stringMatching(/^[a-z]{3,10}\.csv$/)

      await fc.assert(
        fc.asyncProperty(
          validDateString,
          fakeFilename,
          async (date: string, missingFile: string) => {
            const datePath = path.join(testCacheDir, date)
            await fs.mkdir(datePath, { recursive: true })

            // Create an empty directory (no files)
            const metadata = createTestMetadata(date, {
              integrity: {
                checksums: {
                  [missingFile]:
                    'somechecksum1234567890abcdef1234567890abcdef1234567890abcdef1234',
                },
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
            expect(result.issues.some(i => i.includes('Missing file'))).toBe(
              true
            )

            // Cleanup for next iteration
            await fs.rm(datePath, { recursive: true, force: true })
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * Property 1.6: Null metadata always returns invalid
     * For any date, null metadata SHALL return isValid: false
     */
    it('should return invalid for null metadata regardless of date', async () => {
      await fc.assert(
        fc.asyncProperty(validDateString, async (date: string) => {
          const result = await validator.validateMetadataIntegrity(
            testCacheDir,
            date,
            null
          )

          expect(result.isValid).toBe(false)
          expect(result.issues).toContain('Metadata file does not exist')
        }),
        { numRuns: 100 }
      )
    })
  })
})

describe('CacheIntegrityValidator - Property 2: Corruption Detection and Recovery', () => {
  let logger: TestLogger
  let validator: CacheIntegrityValidator
  let testCacheDir: string

  const { cleanup: cleanup2, afterEach: performCleanup2 } =
    createTestSelfCleanup({ verbose: false })

  beforeEach(async () => {
    logger = new TestLogger()
    validator = new CacheIntegrityValidator(logger)
    testCacheDir = `./test-cache/corruption-pbt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    cleanup2.trackDirectory(path.resolve(testCacheDir))
    await fs.mkdir(testCacheDir, { recursive: true })
  })

  afterEach(async () => {
    await performCleanup2()
  })

  // Generator for valid CSV content with variable rows
  const validCSVGenerator = fc
    .integer({ min: 2, max: 50 })
    .map(rows => createValidCSV(rows))

  // Generator for empty/whitespace content
  const emptyContentGenerator = fc.oneof(
    fc.constant(''),
    fc.constant('   '),
    fc.constant('\n'),
    fc.constant('\t\n  ')
  )

  // Generator for content with binary/control characters
  const binaryContentGenerator = fc
    .tuple(
      fc.string({ minLength: 5, maxLength: 20 }),
      fc.constantFrom(
        '\x00',
        '\x01',
        '\x02',
        '\x03',
        '\x04',
        '\x05',
        '\x06',
        '\x07',
        '\x08',
        '\x0B',
        '\x0C',
        '\x0E',
        '\x1F',
        '\x7F'
      ),
      fc.string({ minLength: 5, maxLength: 20 })
    )
    .map(([before, binary, after]) => `header,col\n${before}${binary}${after}`)

  // Generator for excessively long lines
  const longLineGenerator = fc
    .integer({ min: 60000, max: 100000 })
    .map(length => {
      return `header\n${'a'.repeat(length)}`
    })

  // Generator for valid date strings
  const validDateString = fc
    .tuple(
      fc.integer({ min: 2020, max: 2030 }),
      fc.integer({ min: 1, max: 12 }),
      fc.integer({ min: 1, max: 28 })
    )
    .map(([year, month, day]) => {
      const monthStr = month.toString().padStart(2, '0')
      const dayStr = day.toString().padStart(2, '0')
      return `${year}-${monthStr}-${dayStr}`
    })

  describe('Property 2: Corruption Detection and Recovery', () => {
    /**
     * Property 2.1: Valid CSV content always passes corruption detection
     * For any valid CSV content with matching checksum, detectCorruption SHALL return isValid: true
     */
    it('should return isValid: true for valid CSV content with matching checksums', async () => {
      await fc.assert(
        fc.asyncProperty(validCSVGenerator, async (csvContent: string) => {
          const checksum = crypto
            .createHash('sha256')
            .update(csvContent)
            .digest('hex')
          const metadata = createTestMetadata('2024-01-15', {
            integrity: {
              checksums: { 'test.csv': checksum },
              totalSize: 0,
              fileCount: 0,
            },
          })

          const result = await validator.detectCorruption(
            csvContent,
            metadata,
            'test.csv'
          )

          expect(result.isValid).toBe(true)
          expect(result.issues).toHaveLength(0)
        }),
        { numRuns: 100 }
      )
    })

    /**
     * Property 2.2: Empty content always fails corruption detection
     * For any empty or whitespace-only content, detectCorruption SHALL return isValid: false
     */
    it('should return isValid: false for empty content', async () => {
      await fc.assert(
        fc.asyncProperty(
          emptyContentGenerator,
          async (emptyContent: string) => {
            const result = await validator.detectCorruption(
              emptyContent,
              null,
              'test.csv'
            )

            expect(result.isValid).toBe(false)
            expect(result.issues.some(i => i.includes('empty'))).toBe(true)
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * Property 2.3: Binary/control characters always fail corruption detection
     * For any content containing binary or control characters, detectCorruption SHALL return isValid: false
     */
    it('should return isValid: false for content with binary/control characters', async () => {
      await fc.assert(
        fc.asyncProperty(
          binaryContentGenerator,
          async (binaryContent: string) => {
            const result = await validator.detectCorruption(
              binaryContent,
              null,
              'test.csv'
            )

            expect(result.isValid).toBe(false)
            expect(
              result.issues.some(
                i => i.includes('binary') || i.includes('control')
              )
            ).toBe(true)
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * Property 2.4: Excessively long lines always fail corruption detection
     * For any content with lines exceeding 50000 characters, detectCorruption SHALL return isValid: false
     */
    it('should return isValid: false for excessively long lines', async () => {
      await fc.assert(
        fc.asyncProperty(longLineGenerator, async (longContent: string) => {
          const result = await validator.detectCorruption(
            longContent,
            null,
            'test.csv'
          )

          expect(result.isValid).toBe(false)
          expect(result.issues.some(i => i.includes('excessively long'))).toBe(
            true
          )
        }),
        { numRuns: 100 }
      )
    })

    /**
     * Property 2.5: Checksum mismatch always fails corruption detection
     * For any content with mismatched checksum, detectCorruption SHALL return isValid: false
     */
    it('should return isValid: false for checksum mismatch', async () => {
      await fc.assert(
        fc.asyncProperty(
          validCSVGenerator,
          fc.integer({ min: 1, max: 1000000 }),
          async (csvContent: string, checksumSeed: number) => {
            const actualChecksum = crypto
              .createHash('sha256')
              .update(csvContent)
              .digest('hex')
            const wrongChecksum = crypto
              .createHash('sha256')
              .update(checksumSeed.toString())
              .digest('hex')

            // Skip if checksums happen to match
            if (actualChecksum === wrongChecksum) return

            const metadata = createTestMetadata('2024-01-15', {
              integrity: {
                checksums: { 'test.csv': wrongChecksum },
                totalSize: 0,
                fileCount: 0,
              },
            })

            const result = await validator.detectCorruption(
              csvContent,
              metadata,
              'test.csv'
            )

            expect(result.isValid).toBe(false)
            expect(
              result.issues.some(i => i.includes('Checksum mismatch'))
            ).toBe(true)
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * Property 2.6: Recovery removes corrupted files
     * For any corrupted file, attemptCorruptionRecovery SHALL remove the file
     */
    it('should remove corrupted files during recovery', async () => {
      await fc.assert(
        fc.asyncProperty(validDateString, async (date: string) => {
          const datePath = path.join(testCacheDir, date)
          await fs.mkdir(datePath, { recursive: true })

          const csvPath = path.join(datePath, 'all-districts.csv')
          await fs.writeFile(csvPath, 'corrupted\x00content')

          // Verify file exists before recovery
          const existsBefore = await fs
            .access(csvPath)
            .then(() => true)
            .catch(() => false)
          expect(existsBefore).toBe(true)

          const result = await validator.attemptCorruptionRecovery(
            testCacheDir,
            date,
            'all-districts' as CSVType
          )

          expect(result.success).toBe(true)
          expect(result.actions).toContain('Removed corrupted file')

          // Verify file was removed
          const existsAfter = await fs
            .access(csvPath)
            .then(() => true)
            .catch(() => false)
          expect(existsAfter).toBe(false)

          // Cleanup for next iteration
          await fs.rm(datePath, { recursive: true, force: true })
        }),
        { numRuns: 100 }
      )
    })

    /**
     * Property 2.7: Recovery handles non-existent files gracefully
     * For any non-existent file, attemptCorruptionRecovery SHALL succeed without errors
     */
    it('should handle non-existent files gracefully during recovery', async () => {
      await fc.assert(
        fc.asyncProperty(validDateString, async (date: string) => {
          const datePath = path.join(testCacheDir, date)
          await fs.mkdir(datePath, { recursive: true })

          // Don't create any file - it doesn't exist
          const result = await validator.attemptCorruptionRecovery(
            testCacheDir,
            date,
            'all-districts' as CSVType
          )

          // Should succeed even if file doesn't exist (ENOENT is ignored)
          expect(result.success).toBe(true)
          expect(result.errors).toHaveLength(0)

          // Cleanup for next iteration
          await fs.rm(datePath, { recursive: true, force: true })
        }),
        { numRuns: 100 }
      )
    })
  })
})
