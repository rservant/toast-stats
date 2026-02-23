/**
 * GCSSnapshotStorage Unit Tests — isSnapshotWriteComplete (Task 5.1)
 *
 * Tests that isSnapshotWriteComplete reads the manifest and checks
 * the writeComplete flag correctly.
 *
 * Requirements: 9.1, 9.2, 9.3
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
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

function createStorage(bucket: MockBucket): GCSSnapshotStorage {
  const mockStorage = createMockStorage(bucket)
  const config: GCSSnapshotStorageConfig = {
    projectId: 'test-project',
    bucketName: 'test-bucket',
    prefix: 'snapshots',
    storage: mockStorage as unknown as import('@google-cloud/storage').Storage,
  }
  return new GCSSnapshotStorage(config)
}

/**
 * Creates a valid manifest JSON buffer with the given writeComplete value.
 * If writeComplete is undefined, the field is omitted entirely.
 */
function makeManifestBuffer(writeComplete?: boolean): Buffer {
  const manifest: Record<string, unknown> = {
    snapshotId: '2024-01-15',
    createdAt: '2024-01-15T10:00:00Z',
    districts: [
      {
        districtId: '42',
        fileName: 'district_42.json',
        status: 'success',
        fileSize: 1024,
        lastModified: '2024-01-15T10:00:00Z',
      },
    ],
    totalDistricts: 1,
    successfulDistricts: 1,
    failedDistricts: 0,
  }
  if (writeComplete !== undefined) {
    manifest['writeComplete'] = writeComplete
  }
  return Buffer.from(JSON.stringify(manifest))
}

// ============================================================================
// Tests
// ============================================================================

describe('GCSSnapshotStorage — isSnapshotWriteComplete', () => {
  let mockBucket: MockBucket

  beforeEach(() => {
    mockBucket = createMockBucket()
  })

  it('should return true when manifest exists and writeComplete is true', async () => {
    const mockFile = createMockFile('snapshots/2024-01-15/manifest.json')
    mockFile.download.mockResolvedValue([makeManifestBuffer(true)])
    mockBucket.file.mockReturnValue(mockFile)

    const storage = createStorage(mockBucket)
    const result = await storage.isSnapshotWriteComplete('2024-01-15')

    expect(result).toBe(true)
    expect(mockBucket.file).toHaveBeenCalledWith(
      'snapshots/2024-01-15/manifest.json'
    )
  })

  it('should return false when manifest exists and writeComplete is false', async () => {
    const mockFile = createMockFile('snapshots/2024-01-15/manifest.json')
    mockFile.download.mockResolvedValue([makeManifestBuffer(false)])
    mockBucket.file.mockReturnValue(mockFile)

    const storage = createStorage(mockBucket)
    const result = await storage.isSnapshotWriteComplete('2024-01-15')

    expect(result).toBe(false)
  })

  it('should return true when manifest exists but writeComplete field is missing (backward compat)', async () => {
    // Missing writeComplete is treated as true for backward compatibility
    // with collector-cli manifests that don't include the field
    const mockFile = createMockFile('snapshots/2024-01-15/manifest.json')
    mockFile.download.mockResolvedValue([makeManifestBuffer(undefined)])
    mockBucket.file.mockReturnValue(mockFile)

    const storage = createStorage(mockBucket)
    const result = await storage.isSnapshotWriteComplete('2024-01-15')

    expect(result).toBe(true)
  })

  it('should return false when manifest does not exist (404)', async () => {
    const mockFile = createMockFile('snapshots/2024-01-15/manifest.json')
    const notFoundError = new Error('Not Found')
    Object.assign(notFoundError, { code: 404 })
    mockFile.download.mockRejectedValue(notFoundError)
    mockBucket.file.mockReturnValue(mockFile)

    const storage = createStorage(mockBucket)
    const result = await storage.isSnapshotWriteComplete('2024-01-15')

    expect(result).toBe(false)
  })

  it('should throw StorageOperationError for invalid snapshot ID', async () => {
    const storage = createStorage(mockBucket)

    await expect(storage.isSnapshotWriteComplete('not-a-date')).rejects.toThrow(
      StorageOperationError
    )

    // Verify no GCS call was made
    expect(mockBucket.file).not.toHaveBeenCalled()
  })

  it('should throw StorageOperationError for path traversal in snapshot ID', async () => {
    const storage = createStorage(mockBucket)

    await expect(
      storage.isSnapshotWriteComplete('../2024-01-15')
    ).rejects.toThrow(StorageOperationError)

    expect(mockBucket.file).not.toHaveBeenCalled()
  })
})
