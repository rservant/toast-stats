/**
 * Unit Tests for Storage Provider Selection
 *
 * Verifies that StorageProviderFactory.createFromEnvironment() returns
 * the correct storage implementation based on STORAGE_PROVIDER env var.
 *
 * Converted from property-based tests — the PBT only iterated over
 * constantFrom case variations which are adequately covered by these
 * deterministic tests.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { StorageProviderFactory } from '../StorageProviderFactory.js'
import { LocalSnapshotStorage } from '../LocalSnapshotStorage.js'
import { LocalRawCSVStorage } from '../LocalRawCSVStorage.js'

// ============================================================================
// Mock GCP Providers
// ============================================================================

interface MockGCSSnapshotConfig {
  projectId: string
  bucketName: string
  prefix?: string
}

interface MockGCSConfig {
  projectId: string
  bucketName: string
}

const gcsSnapshotConstructorCalls: MockGCSSnapshotConfig[] = []
const gcsConstructorCalls: MockGCSConfig[] = []

vi.mock('../GCSSnapshotStorage.js', () => {
  return {
    GCSSnapshotStorage: class MockGCSSnapshotStorage {
      _mockType = 'GCSSnapshotStorage'
      _config: MockGCSSnapshotConfig

      constructor(config: MockGCSSnapshotConfig) {
        this._config = config
        gcsSnapshotConstructorCalls.push(config)
      }

      getLatestSuccessful = vi.fn()
      getLatest = vi.fn()
      writeSnapshot = vi.fn()
      listSnapshots = vi.fn()
      getSnapshot = vi.fn()
      isReady = vi.fn().mockResolvedValue(true)
      writeDistrictData = vi.fn()
      readDistrictData = vi.fn()
      listDistrictsInSnapshot = vi.fn()
      getSnapshotManifest = vi.fn()
      getSnapshotMetadata = vi.fn()
      writeAllDistrictsRankings = vi.fn()
      readAllDistrictsRankings = vi.fn()
      hasAllDistrictsRankings = vi.fn()
      isSnapshotWriteComplete = vi.fn()
      deleteSnapshot = vi.fn()
    },
  }
})

vi.mock('../GCSRawCSVStorage.js', () => {
  return {
    GCSRawCSVStorage: class MockGCSRawCSVStorage {
      _mockType = 'GCSRawCSVStorage'
      _config: MockGCSConfig

      constructor(config: MockGCSConfig) {
        this._config = config
        gcsConstructorCalls.push(config)
      }

      getCachedCSV = vi.fn()
      setCachedCSV = vi.fn()
      setCachedCSVWithMetadata = vi.fn()
      hasCachedCSV = vi.fn()
      getCacheMetadata = vi.fn()
      updateCacheMetadata = vi.fn()
      clearCacheForDate = vi.fn()
      getCachedDates = vi.fn()
      getCacheStorageInfo = vi.fn()
      getCacheStatistics = vi.fn()
      getHealthStatus = vi.fn()
    },
  }
})

// ============================================================================
// Test Suite
// ============================================================================

describe('Storage Provider Selection', () => {
  let originalEnv: Record<string, string | undefined>

  beforeEach(() => {
    originalEnv = { ...process.env }
    delete process.env['STORAGE_PROVIDER']
    delete process.env['GCP_PROJECT_ID']
    delete process.env['GCS_BUCKET_NAME']
    delete process.env['FIRESTORE_COLLECTION']
    delete process.env['CACHE_DIR']
    vi.clearAllMocks()
    gcsSnapshotConstructorCalls.length = 0
    gcsConstructorCalls.length = 0
  })

  afterEach(() => {
    process.env = originalEnv as typeof process.env
  })

  it('should use LocalSnapshotStorage when STORAGE_PROVIDER=local', () => {
    process.env['STORAGE_PROVIDER'] = 'local'

    const result = StorageProviderFactory.createFromEnvironment()

    expect(result.snapshotStorage).toBeInstanceOf(LocalSnapshotStorage)
    expect(result.rawCSVStorage).toBeInstanceOf(LocalRawCSVStorage)
    expect(gcsSnapshotConstructorCalls).toHaveLength(0)
    expect(gcsConstructorCalls).toHaveLength(0)
  })

  it('should use LocalSnapshotStorage for case variations of "local"', () => {
    for (const variation of ['LOCAL', 'Local', 'lOcAl']) {
      gcsSnapshotConstructorCalls.length = 0
      gcsConstructorCalls.length = 0
      process.env['STORAGE_PROVIDER'] = variation

      const result = StorageProviderFactory.createFromEnvironment()

      expect(result.snapshotStorage).toBeInstanceOf(LocalSnapshotStorage)
      expect(result.rawCSVStorage).toBeInstanceOf(LocalRawCSVStorage)
      expect(gcsSnapshotConstructorCalls).toHaveLength(0)
    }
  })

  it('should use GCSSnapshotStorage when STORAGE_PROVIDER=gcp', () => {
    process.env['STORAGE_PROVIDER'] = 'gcp'
    process.env['GCP_PROJECT_ID'] = 'test-project'
    process.env['GCS_BUCKET_NAME'] = 'test-bucket'

    const result = StorageProviderFactory.createFromEnvironment()

    expect(gcsSnapshotConstructorCalls).toHaveLength(1)
    expect(gcsConstructorCalls).toHaveLength(1)
    expect(
      (result.snapshotStorage as unknown as { _mockType: string })._mockType
    ).toBe('GCSSnapshotStorage')
    expect(
      (result.rawCSVStorage as unknown as { _mockType: string })._mockType
    ).toBe('GCSRawCSVStorage')
  })

  it('should use GCSSnapshotStorage for case variations of "gcp"', () => {
    for (const variation of ['GCP', 'Gcp', 'gCp']) {
      gcsSnapshotConstructorCalls.length = 0
      gcsConstructorCalls.length = 0
      process.env['STORAGE_PROVIDER'] = variation
      process.env['GCP_PROJECT_ID'] = 'test-project'
      process.env['GCS_BUCKET_NAME'] = 'test-bucket'

      const result = StorageProviderFactory.createFromEnvironment()

      expect(gcsSnapshotConstructorCalls).toHaveLength(1)
      expect(
        (result.snapshotStorage as unknown as { _mockType: string })._mockType
      ).toBe('GCSSnapshotStorage')
    }
  })

  it('should default to LocalSnapshotStorage when STORAGE_PROVIDER is unset', () => {
    const result = StorageProviderFactory.createFromEnvironment()

    expect(result.snapshotStorage).toBeInstanceOf(LocalSnapshotStorage)
    expect(result.rawCSVStorage).toBeInstanceOf(LocalRawCSVStorage)
    expect(gcsSnapshotConstructorCalls).toHaveLength(0)
    expect(gcsConstructorCalls).toHaveLength(0)
  })

  it('should default to LocalSnapshotStorage when STORAGE_PROVIDER is empty', () => {
    process.env['STORAGE_PROVIDER'] = ''

    const result = StorageProviderFactory.createFromEnvironment()

    expect(result.snapshotStorage).toBeInstanceOf(LocalSnapshotStorage)
    expect(result.rawCSVStorage).toBeInstanceOf(LocalRawCSVStorage)
  })

  it('should default to LocalSnapshotStorage when STORAGE_PROVIDER is whitespace', () => {
    process.env['STORAGE_PROVIDER'] = '   '

    const result = StorageProviderFactory.createFromEnvironment()

    expect(result.snapshotStorage).toBeInstanceOf(LocalSnapshotStorage)
    expect(result.rawCSVStorage).toBeInstanceOf(LocalRawCSVStorage)
  })

  it('should default to LocalSnapshotStorage for invalid provider values', () => {
    for (const invalid of ['invalid', 'aws', 'azure', 'gcp-local']) {
      process.env['STORAGE_PROVIDER'] = invalid

      const result = StorageProviderFactory.createFromEnvironment()

      expect(result.snapshotStorage).toBeInstanceOf(LocalSnapshotStorage)
      expect(result.rawCSVStorage).toBeInstanceOf(LocalRawCSVStorage)
    }
  })

  it('should be deterministic across multiple calls', () => {
    process.env['STORAGE_PROVIDER'] = 'local'

    const result1 = StorageProviderFactory.createFromEnvironment()
    const result2 = StorageProviderFactory.createFromEnvironment()

    expect(result1.snapshotStorage).toBeInstanceOf(LocalSnapshotStorage)
    expect(result2.snapshotStorage).toBeInstanceOf(LocalSnapshotStorage)
  })

  it('should pass GCP config to GCS constructors', () => {
    process.env['STORAGE_PROVIDER'] = 'gcp'
    process.env['GCP_PROJECT_ID'] = 'my-project'
    process.env['GCS_BUCKET_NAME'] = 'my-bucket'

    StorageProviderFactory.createFromEnvironment()

    expect(gcsSnapshotConstructorCalls[0]?.projectId).toBe('my-project')
    expect(gcsConstructorCalls[0]?.projectId).toBe('my-project')
    expect(gcsConstructorCalls[0]?.bucketName).toBe('my-bucket')
  })
})
