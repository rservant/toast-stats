/**
 * Property 10: Input validation rejects invalid IDs before GCS calls
 *
 * Generates invalid snapshot IDs (bad format, invalid calendar dates,
 * path traversal, unicode, percent-encoded) and invalid district IDs
 * (empty, whitespace, traversal characters).
 *
 * Verifies StorageOperationError thrown with retryable: false.
 *
 * **Validates: Requirements 6.1, 6.2, 6.3, 4.6**
 *
 * Feature: gcs-snapshot-storage, Property 10: Input validation rejects invalid IDs before GCS calls
 */

import { describe, it, expect, vi } from 'vitest'
import * as fc from 'fast-check'
import { StorageOperationError } from '../types/storageInterfaces.js'

// Mock logger
vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// Mock CircuitBreaker
vi.mock('../../utils/CircuitBreaker.js', () => {
  const MockCircuitBreaker = function (this: Record<string, unknown>) {
    this.execute = vi.fn(async <T>(operation: () => Promise<T>) => operation())
    this.getStats = vi.fn()
    this.reset = vi.fn()
  }
  return { CircuitBreaker: MockCircuitBreaker }
})

import { GCSSnapshotStorage } from '../services/storage/GCSSnapshotStorage.js'
import type { GCSSnapshotStorageConfig } from '../services/storage/GCSSnapshotStorage.js'

// ============================================================================
// Test Helpers
// ============================================================================

function createStorage(): GCSSnapshotStorage {
  const mockStorage = {
    bucket: vi.fn().mockReturnValue({
      file: vi.fn(),
      getFiles: vi.fn(),
    }),
  }
  const config: GCSSnapshotStorageConfig = {
    projectId: 'test-project',
    bucketName: 'test-bucket',
    storage: mockStorage as unknown as import('@google-cloud/storage').Storage,
  }
  return new GCSSnapshotStorage(config)
}

function validateSnapshotId(storage: GCSSnapshotStorage, id: string): void {
  ;(storage as unknown as Record<string, Function>)['validateSnapshotId'](id)
}

function validateDistrictId(storage: GCSSnapshotStorage, id: string): void {
  ;(storage as unknown as Record<string, Function>)['validateDistrictId'](id)
}

// ============================================================================
// Generators for Invalid Snapshot IDs
// ============================================================================

/** Bad format — doesn't match YYYY-MM-DD regex */
const badFormatSnapshotIdArb = fc.oneof(
  fc.string({ minLength: 1, maxLength: 20 }).filter(
    (s) => !/^\d{4}-\d{2}-\d{2}$/.test(s)
  ),
  fc.constant('2024/01/15'),
  fc.constant('20240115'),
  fc.constant('24-01-15'),
  fc.constant('2024-1-15'),
  fc.constant('2024-01-5'),
  fc.constant('abcd-ef-gh'),
  fc.constant('')
)

/** Invalid calendar dates — correct format but impossible dates */
const invalidCalendarDateArb = fc.constantFrom(
  '2024-02-30', // Feb 30
  '2024-02-31', // Feb 31
  '2023-02-29', // Non-leap year Feb 29
  '2024-04-31', // April 31
  '2024-06-31', // June 31
  '2024-13-01', // Month 13
  '2024-00-15', // Month 0
  '2024-01-00', // Day 0
  '2024-01-32'  // Day 32
)

/** Path traversal sequences */
const pathTraversalSnapshotIdArb = fc.constantFrom(
  '../2024-01-15',
  '2024-01-15/../etc',
  '..\\2024-01-15'
)

/** Unicode separators */
const unicodeSnapshotIdArb = fc.constantFrom(
  '2024\u2028-01-15',
  '2024-01\u2029-15'
)

/** Percent-encoded characters */
const percentEncodedSnapshotIdArb = fc.constantFrom(
  '2024%2F01-15',
  '2024-01%2E15',
  '%2E%2E/2024-01-15'
)

// ============================================================================
// Generators for Invalid District IDs
// ============================================================================

/** Empty district IDs */
const emptyDistrictIdArb = fc.constantFrom('', '   ', '\t', '\n')

/** District IDs with non-alphanumeric characters */
const nonAlphanumericDistrictIdArb = fc.oneof(
  fc.constant('district-42'),
  fc.constant('district_42'),
  fc.constant('42/43'),
  fc.constant('../42'),
  fc.constant('42 43'),
  fc.constant('42\t43'),
  fc.constant('42.json'),
  fc.constant('district@42'),
  fc.string({ minLength: 1, maxLength: 10 }).filter(
    (s) => s.trim().length > 0 && !/^[A-Za-z0-9]+$/.test(s)
  )
)

// ============================================================================
// Tests
// ============================================================================

describe('GCSSnapshotStorage — Property 10: Input validation', () => {
  const storage = createStorage()

  describe('Invalid snapshot IDs', () => {
    it('should reject bad format snapshot IDs', () => {
      fc.assert(
        fc.property(badFormatSnapshotIdArb, (id) => {
          expect(() => validateSnapshotId(storage, id)).toThrow(
            StorageOperationError
          )
          try {
            validateSnapshotId(storage, id)
          } catch (error) {
            const opError = error as StorageOperationError
            expect(opError.retryable).toBe(false)
            expect(opError.provider).toBe('gcs')
          }
        }),
        { numRuns: 100 }
      )
    })

    it('should reject invalid calendar dates', () => {
      fc.assert(
        fc.property(invalidCalendarDateArb, (id) => {
          expect(() => validateSnapshotId(storage, id)).toThrow(
            StorageOperationError
          )
          try {
            validateSnapshotId(storage, id)
          } catch (error) {
            const opError = error as StorageOperationError
            expect(opError.retryable).toBe(false)
          }
        }),
        { numRuns: 100 }
      )
    })

    it('should reject path traversal sequences', () => {
      fc.assert(
        fc.property(pathTraversalSnapshotIdArb, (id) => {
          expect(() => validateSnapshotId(storage, id)).toThrow(
            StorageOperationError
          )
          try {
            validateSnapshotId(storage, id)
          } catch (error) {
            const opError = error as StorageOperationError
            expect(opError.retryable).toBe(false)
          }
        }),
        { numRuns: 100 }
      )
    })

    it('should reject unicode separators', () => {
      fc.assert(
        fc.property(unicodeSnapshotIdArb, (id) => {
          expect(() => validateSnapshotId(storage, id)).toThrow(
            StorageOperationError
          )
          try {
            validateSnapshotId(storage, id)
          } catch (error) {
            const opError = error as StorageOperationError
            expect(opError.retryable).toBe(false)
          }
        }),
        { numRuns: 100 }
      )
    })

    it('should reject percent-encoded characters', () => {
      fc.assert(
        fc.property(percentEncodedSnapshotIdArb, (id) => {
          expect(() => validateSnapshotId(storage, id)).toThrow(
            StorageOperationError
          )
          try {
            validateSnapshotId(storage, id)
          } catch (error) {
            const opError = error as StorageOperationError
            expect(opError.retryable).toBe(false)
          }
        }),
        { numRuns: 100 }
      )
    })

    it('should accept valid calendar dates', () => {
      // Sanity check: valid dates should NOT throw
      fc.assert(
        fc.property(
          fc.integer({ min: 2020, max: 2030 }),
          fc.integer({ min: 1, max: 12 }),
          fc.integer({ min: 1, max: 28 }), // 1-28 always valid
          (year, month, day) => {
            const id = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            expect(() => validateSnapshotId(storage, id)).not.toThrow()
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Invalid district IDs', () => {
    it('should reject empty and whitespace-only district IDs', () => {
      fc.assert(
        fc.property(emptyDistrictIdArb, (id) => {
          expect(() => validateDistrictId(storage, id)).toThrow(
            StorageOperationError
          )
          try {
            validateDistrictId(storage, id)
          } catch (error) {
            const opError = error as StorageOperationError
            expect(opError.retryable).toBe(false)
            expect(opError.provider).toBe('gcs')
          }
        }),
        { numRuns: 100 }
      )
    })

    it('should reject non-alphanumeric district IDs', () => {
      fc.assert(
        fc.property(nonAlphanumericDistrictIdArb, (id) => {
          expect(() => validateDistrictId(storage, id)).toThrow(
            StorageOperationError
          )
          try {
            validateDistrictId(storage, id)
          } catch (error) {
            const opError = error as StorageOperationError
            expect(opError.retryable).toBe(false)
          }
        }),
        { numRuns: 100 }
      )
    })

    it('should accept valid alphanumeric district IDs', () => {
      // Sanity check: valid IDs should NOT throw
      fc.assert(
        fc.property(
          fc
            .string({ minLength: 1, maxLength: 10 })
            .filter((s) => /^[A-Za-z0-9]+$/.test(s)),
          (id) => {
            expect(() => validateDistrictId(storage, id)).not.toThrow()
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
