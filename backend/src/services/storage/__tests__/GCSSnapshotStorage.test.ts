/**
 * GCSSnapshotStorage Unit Tests — Task 3 (Read Helpers & Write Rejection)
 *
 * Tests readObject, checkObjectExists, iterateSnapshotPrefixes,
 * write/delete rejection, and path construction.
 *
 * Requirements: 1.3, 1.4, 1.5, 3.1, 3.2, 3.3, 3.4, 4.1, 4.4
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { z } from 'zod'
import { StorageOperationError } from '../../../types/storageInterfaces.js'

// Mock logger
vi.mock('../../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// Mock CircuitBreaker to pass operations through directly
vi.mock('../../../utils/CircuitBreaker.js', () => {
  const MockCircuitBreaker = function (this: Record<string, unknown>) {
    this.execute = vi.fn(async <T>(operation: () => Promise<T>) => operation())
    this.getStats = vi.fn(() => ({
      state: 'CLOSED',
      failureCount: 0,
      successCount: 0,
      totalRequests: 0,
      totalFailures: 0,
      totalSuccesses: 0,
    }))
    this.reset = vi.fn()
  }
  return { CircuitBreaker: MockCircuitBreaker }
})

import { GCSSnapshotStorage } from '../GCSSnapshotStorage.js'
import type { GCSSnapshotStorageConfig } from '../GCSSnapshotStorage.js'

// ============================================================================
// Mock Helpers
// ============================================================================

interface MockFile {
  download: ReturnType<typeof vi.fn>
  exists: ReturnType<typeof vi.fn>
  name: string
}

interface MockBucket {
  file: ReturnType<typeof vi.fn>
  getFiles: ReturnType<typeof vi.fn>
}

function createMockFile(name: string): MockFile {
  return {
    download: vi.fn(),
    exists: vi.fn(),
    name,
  }
}

function createMockBucket(): MockBucket {
  return {
    file: vi.fn(),
    getFiles: vi.fn(),
  }
}

function createMockStorage(bucket: MockBucket) {
  return {
    bucket: vi.fn().mockReturnValue(bucket),
  }
}

function createStorage(
  bucket: MockBucket,
  prefix = 'snapshots'
): GCSSnapshotStorage {
  const mockStorage = createMockStorage(bucket)
  const config: GCSSnapshotStorageConfig = {
    projectId: 'test-project',
    bucketName: 'test-bucket',
    prefix,
    storage: mockStorage as unknown as import('@google-cloud/storage').Storage,
  }
  return new GCSSnapshotStorage(config)
}

// Simple test schema
const TestSchema = z.object({
  id: z.string(),
  value: z.number(),
})

// ============================================================================
// Tests
// ============================================================================

describe('GCSSnapshotStorage — Task 3', () => {
  let mockBucket: MockBucket

  beforeEach(() => {
    mockBucket = createMockBucket()
  })

  // ==========================================================================
  // readObject tests
  // ==========================================================================

  describe('readObject', () => {
    it('should parse and validate valid JSON data', async () => {
      const mockFile = createMockFile('snapshots/2024-01-15/test.json')
      mockFile.download.mockResolvedValue([
        Buffer.from(JSON.stringify({ id: 'abc', value: 42 })),
      ])
      mockBucket.file.mockReturnValue(mockFile)

      const storage = createStorage(mockBucket)
      // Access private method via bracket notation
      const result = await (
        storage as unknown as Record<string, (...args: unknown[]) => unknown>
      )['readObject']('snapshots/2024-01-15/test.json', TestSchema, 'testOp')

      expect(result).toEqual({ id: 'abc', value: 42 })
      expect(mockBucket.file).toHaveBeenCalledWith(
        'snapshots/2024-01-15/test.json'
      )
    })

    it('should return null on 404', async () => {
      const mockFile = createMockFile('snapshots/2024-01-15/test.json')
      const notFoundError = new Error('Not Found')
      Object.assign(notFoundError, { code: 404 })
      mockFile.download.mockRejectedValue(notFoundError)
      mockBucket.file.mockReturnValue(mockFile)

      const storage = createStorage(mockBucket)
      const result = await (
        storage as unknown as Record<string, (...args: unknown[]) => unknown>
      )['readObject']('snapshots/2024-01-15/test.json', TestSchema, 'testOp')

      expect(result).toBeNull()
    })

    it('should throw non-retryable StorageOperationError on invalid JSON', async () => {
      const mockFile = createMockFile('snapshots/2024-01-15/test.json')
      mockFile.download.mockResolvedValue([Buffer.from('not valid json {')])
      mockBucket.file.mockReturnValue(mockFile)

      const storage = createStorage(mockBucket)
      await expect(
        (storage as unknown as Record<string, (...args: unknown[]) => unknown>)[
          'readObject'
        ]('snapshots/2024-01-15/test.json', TestSchema, 'testOp')
      ).rejects.toThrow(StorageOperationError)

      try {
        await (
          storage as unknown as Record<string, (...args: unknown[]) => unknown>
        )['readObject']('snapshots/2024-01-15/test.json', TestSchema, 'testOp')
      } catch (error) {
        expect(error).toBeInstanceOf(StorageOperationError)
        const opError = error as StorageOperationError
        expect(opError.retryable).toBe(false)
        expect(opError.provider).toBe('gcs')
        expect(opError.message).toContain('Failed to parse JSON')
      }
    })

    it('should throw non-retryable StorageOperationError on schema validation failure', async () => {
      const mockFile = createMockFile('snapshots/2024-01-15/test.json')
      // Valid JSON but wrong shape — missing 'value' field
      mockFile.download.mockResolvedValue([
        Buffer.from(JSON.stringify({ id: 'abc', wrong: 'field' })),
      ])
      mockBucket.file.mockReturnValue(mockFile)

      const storage = createStorage(mockBucket)

      try {
        await (
          storage as unknown as Record<string, (...args: unknown[]) => unknown>
        )['readObject']('snapshots/2024-01-15/test.json', TestSchema, 'testOp')
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(StorageOperationError)
        const opError = error as StorageOperationError
        expect(opError.retryable).toBe(false)
        expect(opError.provider).toBe('gcs')
        expect(opError.message).toContain('Schema validation failed')
      }
    })

    it('should throw retryable StorageOperationError on transient GCS error', async () => {
      const mockFile = createMockFile('snapshots/2024-01-15/test.json')
      const networkError = new Error('network timeout')
      Object.assign(networkError, { code: 503 })
      mockFile.download.mockRejectedValue(networkError)
      mockBucket.file.mockReturnValue(mockFile)

      const storage = createStorage(mockBucket)

      try {
        await (
          storage as unknown as Record<string, (...args: unknown[]) => unknown>
        )['readObject']('snapshots/2024-01-15/test.json', TestSchema, 'testOp')
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(StorageOperationError)
        const opError = error as StorageOperationError
        expect(opError.retryable).toBe(true)
        expect(opError.provider).toBe('gcs')
      }
    })
  })

  // ==========================================================================
  // checkObjectExists tests
  // ==========================================================================

  describe('checkObjectExists', () => {
    it('should return true when object exists', async () => {
      const mockFile = createMockFile('snapshots/2024-01-15/rankings.json')
      mockFile.exists.mockResolvedValue([true])
      mockBucket.file.mockReturnValue(mockFile)

      const storage = createStorage(mockBucket)
      const result = await (
        storage as unknown as Record<string, (...args: unknown[]) => unknown>
      )['checkObjectExists']('snapshots/2024-01-15/rankings.json', 'testOp')

      expect(result).toBe(true)
    })

    it('should return false when object does not exist (no throw)', async () => {
      const mockFile = createMockFile('snapshots/2024-01-15/rankings.json')
      mockFile.exists.mockResolvedValue([false])
      mockBucket.file.mockReturnValue(mockFile)

      const storage = createStorage(mockBucket)
      const result = await (
        storage as unknown as Record<string, (...args: unknown[]) => unknown>
      )['checkObjectExists']('snapshots/2024-01-15/rankings.json', 'testOp')

      expect(result).toBe(false)
    })

    it('should throw StorageOperationError on infra error', async () => {
      const mockFile = createMockFile('snapshots/2024-01-15/rankings.json')
      const infraError = new Error('permission denied')
      Object.assign(infraError, { code: 403 })
      mockFile.exists.mockRejectedValue(infraError)
      mockBucket.file.mockReturnValue(mockFile)

      const storage = createStorage(mockBucket)

      try {
        await (
          storage as unknown as Record<string, (...args: unknown[]) => unknown>
        )['checkObjectExists']('snapshots/2024-01-15/rankings.json', 'testOp')
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(StorageOperationError)
        const opError = error as StorageOperationError
        expect(opError.retryable).toBe(false)
        expect(opError.provider).toBe('gcs')
      }
    })
  })

  // ==========================================================================
  // iterateSnapshotPrefixes tests
  // ==========================================================================

  describe('iterateSnapshotPrefixes', () => {
    it('should extract snapshot IDs from apiResponse.prefixes', async () => {
      mockBucket.getFiles.mockResolvedValue([
        [], // files array (ignored for prefix listing)
        null, // query
        {
          prefixes: [
            'snapshots/2024-01-15/',
            'snapshots/2024-01-14/',
            'snapshots/2024-01-13/',
          ],
        },
      ])

      const storage = createStorage(mockBucket)
      const gen = (
        storage as unknown as Record<string, (...args: unknown[]) => unknown>
      )['iterateSnapshotPrefixes']() as AsyncGenerator<string>

      const ids: string[] = []
      for await (const id of gen) {
        ids.push(id)
      }

      expect(ids).toEqual(['2024-01-15', '2024-01-14', '2024-01-13'])
    })

    it('should use prefixes from apiResponse, not from files array', async () => {
      // Files array has objects, but prefixes come from apiResponse.prefixes
      const fakeFile = { name: 'snapshots/2024-01-15/metadata.json' }
      mockBucket.getFiles.mockResolvedValue([
        [fakeFile], // files array — should be ignored
        null,
        {
          prefixes: ['snapshots/2024-01-10/'],
        },
      ])

      const storage = createStorage(mockBucket)
      const gen = (
        storage as unknown as Record<string, (...args: unknown[]) => unknown>
      )['iterateSnapshotPrefixes']() as AsyncGenerator<string>

      const ids: string[] = []
      for await (const id of gen) {
        ids.push(id)
      }

      // Should only contain the prefix from apiResponse, not from files
      expect(ids).toEqual(['2024-01-10'])
    })

    it('should handle pagination via nextPageToken', async () => {
      // First page
      mockBucket.getFiles
        .mockResolvedValueOnce([
          [],
          null,
          {
            prefixes: ['snapshots/2024-01-15/'],
            nextPageToken: 'token123',
          },
        ])
        // Second page (no more tokens)
        .mockResolvedValueOnce([
          [],
          null,
          {
            prefixes: ['snapshots/2024-01-14/'],
          },
        ])

      const storage = createStorage(mockBucket)
      const gen = (
        storage as unknown as Record<string, (...args: unknown[]) => unknown>
      )['iterateSnapshotPrefixes']() as AsyncGenerator<string>

      const ids: string[] = []
      for await (const id of gen) {
        ids.push(id)
      }

      expect(ids).toEqual(['2024-01-15', '2024-01-14'])
      expect(mockBucket.getFiles).toHaveBeenCalledTimes(2)
    })

    it('should handle empty prefixes', async () => {
      mockBucket.getFiles.mockResolvedValue([[], null, {}])

      const storage = createStorage(mockBucket)
      const gen = (
        storage as unknown as Record<string, (...args: unknown[]) => unknown>
      )['iterateSnapshotPrefixes']() as AsyncGenerator<string>

      const ids: string[] = []
      for await (const id of gen) {
        ids.push(id)
      }

      expect(ids).toEqual([])
    })

    it('should call getFiles with correct parameters', async () => {
      mockBucket.getFiles.mockResolvedValue([[], null, {}])

      const storage = createStorage(mockBucket, 'my-prefix')
      const gen = (
        storage as unknown as Record<string, (...args: unknown[]) => unknown>
      )['iterateSnapshotPrefixes']() as AsyncGenerator<string>

      // Consume the generator
      for await (const _ of gen) {
        // no-op
      }

      expect(mockBucket.getFiles).toHaveBeenCalledWith({
        prefix: 'my-prefix/',
        delimiter: '/',
        maxResults: 100,
        pageToken: undefined,
        autoPaginate: false,
      })
    })
  })

  // ==========================================================================
  // Write/Delete rejection tests
  // ==========================================================================

  describe('write/delete rejection', () => {
    it('writeSnapshot should throw StorageOperationError with retryable: false', async () => {
      const storage = createStorage(mockBucket)

      try {
        await storage.writeSnapshot(
          {} as import('../../../types/snapshots.js').Snapshot
        )
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(StorageOperationError)
        const opError = error as StorageOperationError
        expect(opError.retryable).toBe(false)
        expect(opError.provider).toBe('gcs')
        expect(opError.operation).toBe('writeSnapshot')
        expect(opError.message).toContain('Write operations are not supported')
      }
    })

    it('writeDistrictData should throw StorageOperationError with retryable: false', async () => {
      const storage = createStorage(mockBucket)

      try {
        await storage.writeDistrictData(
          '2024-01-15',
          '42',
          {} as import('../../../types/districts.js').DistrictStatistics
        )
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(StorageOperationError)
        const opError = error as StorageOperationError
        expect(opError.retryable).toBe(false)
        expect(opError.provider).toBe('gcs')
        expect(opError.operation).toBe('writeDistrictData')
      }
    })

    it('writeAllDistrictsRankings should throw StorageOperationError with retryable: false', async () => {
      const storage = createStorage(mockBucket)

      try {
        await storage.writeAllDistrictsRankings(
          '2024-01-15',
          {} as import('@toastmasters/shared-contracts').AllDistrictsRankingsData
        )
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(StorageOperationError)
        const opError = error as StorageOperationError
        expect(opError.retryable).toBe(false)
        expect(opError.provider).toBe('gcs')
        expect(opError.operation).toBe('writeAllDistrictsRankings')
      }
    })

    it('deleteSnapshot should throw StorageOperationError with retryable: false', async () => {
      const storage = createStorage(mockBucket)

      try {
        await storage.deleteSnapshot('2024-01-15')
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(StorageOperationError)
        const opError = error as StorageOperationError
        expect(opError.retryable).toBe(false)
        expect(opError.provider).toBe('gcs')
        expect(opError.operation).toBe('deleteSnapshot')
        expect(opError.message).toContain('Delete operations are not supported')
      }
    })
  })

  // ==========================================================================
  // Path construction tests
  // ==========================================================================

  describe('path construction', () => {
    it('should build correct path for metadata.json', async () => {
      const mockFile = createMockFile('snapshots/2024-01-15/metadata.json')
      mockFile.download.mockResolvedValue([
        Buffer.from(JSON.stringify({ id: 'test', value: 1 })),
      ])
      mockBucket.file.mockReturnValue(mockFile)

      const storage = createStorage(mockBucket)
      await (
        storage as unknown as Record<string, (...args: unknown[]) => unknown>
      )['readObject']('snapshots/2024-01-15/metadata.json', TestSchema, 'test')

      expect(mockBucket.file).toHaveBeenCalledWith(
        'snapshots/2024-01-15/metadata.json'
      )
    })

    it('should build correct path with custom prefix', async () => {
      const mockFile = createMockFile('custom/2024-01-15/manifest.json')
      mockFile.download.mockResolvedValue([
        Buffer.from(JSON.stringify({ id: 'test', value: 1 })),
      ])
      mockBucket.file.mockReturnValue(mockFile)

      const storage = createStorage(mockBucket, 'custom')
      const path = (
        storage as unknown as Record<string, (...args: unknown[]) => unknown>
      )['buildObjectPath']('2024-01-15', 'manifest.json')

      expect(path).toBe('custom/2024-01-15/manifest.json')
    })

    it('should build correct path for district files', () => {
      const storage = createStorage(mockBucket)
      const path = (
        storage as unknown as Record<string, (...args: unknown[]) => unknown>
      )['buildObjectPath']('2024-01-15', 'district_42.json')

      expect(path).toBe('snapshots/2024-01-15/district_42.json')
    })

    it('should build correct path for rankings file', () => {
      const storage = createStorage(mockBucket)
      const path = (
        storage as unknown as Record<string, (...args: unknown[]) => unknown>
      )['buildObjectPath']('2024-01-15', 'all-districts-rankings.json')

      expect(path).toBe('snapshots/2024-01-15/all-districts-rankings.json')
    })
  })
})
