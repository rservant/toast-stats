/**
 * StorageProviderFactory District Configuration Unit Tests
 *
 * Tests the StorageProviderFactory's district configuration storage creation
 * based on environment configuration or explicit configuration.
 *
 * Requirements Validated: 4.1, 4.2, 4.3
 *
 * Test Isolation Requirements (per testing steering document):
 * - Each test uses unique, isolated environment state
 * - Tests clean up all resources in afterEach hooks
 * - Tests do not depend on execution order
 * - Environment variables are scoped to individual tests
 * - All tests pass when run with --run (parallel mode)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { StorageProviderFactory } from '../StorageProviderFactory.js'
import { LocalDistrictConfigStorage } from '../LocalDistrictConfigStorage.js'
import { StorageConfigurationError } from '../../../types/storageInterfaces.js'
import type { StorageConfig } from '../../../types/storageInterfaces.js'

// ============================================================================
// Mock GCP Providers
// ============================================================================

// Track constructor calls for verification
interface MockFirestoreSnapshotConfig {
  projectId: string
  collectionName?: string
}

interface MockFirestoreDistrictConfig {
  projectId: string
}

interface MockGCSConfig {
  projectId: string
  bucketName: string
}

const firestoreSnapshotConstructorCalls: MockFirestoreSnapshotConfig[] = []
const firestoreDistrictConfigConstructorCalls: MockFirestoreDistrictConfig[] =
  []
const gcsConstructorCalls: MockGCSConfig[] = []

// Mock the GCP provider modules to avoid actual GCP connections
vi.mock('../FirestoreSnapshotStorage.js', () => {
  return {
    FirestoreSnapshotStorage: class MockFirestoreSnapshotStorage {
      _mockType = 'FirestoreSnapshotStorage'
      _config: MockFirestoreSnapshotConfig

      constructor(config: MockFirestoreSnapshotConfig) {
        this._config = config
        firestoreSnapshotConstructorCalls.push(config)
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
    },
  }
})

vi.mock('../FirestoreDistrictConfigStorage.js', () => {
  return {
    FirestoreDistrictConfigStorage: class MockFirestoreDistrictConfigStorage {
      _mockType = 'FirestoreDistrictConfigStorage'
      _config: MockFirestoreDistrictConfig

      constructor(config: MockFirestoreDistrictConfig) {
        this._config = config
        firestoreDistrictConfigConstructorCalls.push(config)
      }

      getConfiguration = vi.fn().mockResolvedValue(null)
      saveConfiguration = vi.fn().mockResolvedValue(undefined)
      appendChangeLog = vi.fn().mockResolvedValue(undefined)
      getChangeHistory = vi.fn().mockResolvedValue([])
      isReady = vi.fn().mockResolvedValue(true)
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

describe('StorageProviderFactory - District Configuration Storage', () => {
  // Store original environment variables for restoration
  let originalEnv: Record<string, string | undefined>

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env }

    // Clear all storage-related environment variables for test isolation
    delete process.env['STORAGE_PROVIDER']
    delete process.env['GCP_PROJECT_ID']
    delete process.env['GCS_BUCKET_NAME']
    delete process.env['FIRESTORE_COLLECTION']
    delete process.env['CACHE_DIR']

    // Clear mock call history
    vi.clearAllMocks()

    // Clear constructor call tracking arrays
    firestoreSnapshotConstructorCalls.length = 0
    firestoreDistrictConfigConstructorCalls.length = 0
    gcsConstructorCalls.length = 0
  })

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv as typeof process.env
  })

  // ============================================================================
  // Environment Variable Parsing for District Config (Requirement 4.1)
  // ============================================================================

  describe('Environment Variable Parsing for District Config', () => {
    it('should create LocalDistrictConfigStorage when STORAGE_PROVIDER is not set (Requirement 4.1)', () => {
      // STORAGE_PROVIDER not set - should default to 'local'
      const result = StorageProviderFactory.createFromEnvironment()

      expect(result).toHaveProperty('districtConfigStorage')
      expect(result.districtConfigStorage).toBeInstanceOf(
        LocalDistrictConfigStorage
      )
    })

    it('should create LocalDistrictConfigStorage when STORAGE_PROVIDER is empty string (Requirement 4.1)', () => {
      process.env['STORAGE_PROVIDER'] = ''

      const result = StorageProviderFactory.createFromEnvironment()

      expect(result.districtConfigStorage).toBeInstanceOf(
        LocalDistrictConfigStorage
      )
    })

    it('should create LocalDistrictConfigStorage when STORAGE_PROVIDER is whitespace only (Requirement 4.1)', () => {
      process.env['STORAGE_PROVIDER'] = '   '

      const result = StorageProviderFactory.createFromEnvironment()

      expect(result.districtConfigStorage).toBeInstanceOf(
        LocalDistrictConfigStorage
      )
    })

    it('should create LocalDistrictConfigStorage when STORAGE_PROVIDER is "local" (Requirement 4.3)', () => {
      process.env['STORAGE_PROVIDER'] = 'local'

      const result = StorageProviderFactory.createFromEnvironment()

      expect(result.districtConfigStorage).toBeInstanceOf(
        LocalDistrictConfigStorage
      )
    })

    it('should create LocalDistrictConfigStorage when STORAGE_PROVIDER is "LOCAL" (case insensitive)', () => {
      process.env['STORAGE_PROVIDER'] = 'LOCAL'

      const result = StorageProviderFactory.createFromEnvironment()

      expect(result.districtConfigStorage).toBeInstanceOf(
        LocalDistrictConfigStorage
      )
    })

    it('should create FirestoreDistrictConfigStorage when STORAGE_PROVIDER is "gcp" (Requirement 4.2)', () => {
      process.env['STORAGE_PROVIDER'] = 'gcp'
      process.env['GCP_PROJECT_ID'] = 'test-project-id'
      process.env['GCS_BUCKET_NAME'] = 'test-bucket-name'

      const result = StorageProviderFactory.createFromEnvironment()

      expect(result).toHaveProperty('districtConfigStorage')
      expect(
        (result.districtConfigStorage as unknown as { _mockType: string })
          ._mockType
      ).toBe('FirestoreDistrictConfigStorage')
    })

    it('should create FirestoreDistrictConfigStorage when STORAGE_PROVIDER is "GCP" (case insensitive)', () => {
      process.env['STORAGE_PROVIDER'] = 'GCP'
      process.env['GCP_PROJECT_ID'] = 'test-project-id'
      process.env['GCS_BUCKET_NAME'] = 'test-bucket-name'

      const result = StorageProviderFactory.createFromEnvironment()

      expect(
        (result.districtConfigStorage as unknown as { _mockType: string })
          ._mockType
      ).toBe('FirestoreDistrictConfigStorage')
    })

    it('should default to LocalDistrictConfigStorage for invalid STORAGE_PROVIDER values', () => {
      process.env['STORAGE_PROVIDER'] = 'invalid-provider'

      const result = StorageProviderFactory.createFromEnvironment()

      expect(result.districtConfigStorage).toBeInstanceOf(
        LocalDistrictConfigStorage
      )
    })

    it('should default to LocalDistrictConfigStorage for unknown provider names', () => {
      const unknownProviders = ['aws', 'azure', 's3', 'blob', 'filesystem']

      for (const provider of unknownProviders) {
        process.env['STORAGE_PROVIDER'] = provider

        const result = StorageProviderFactory.createFromEnvironment()

        expect(result.districtConfigStorage).toBeInstanceOf(
          LocalDistrictConfigStorage
        )
      }
    })
  })

  // ============================================================================
  // Provider Type Selection (Requirements 4.2, 4.3)
  // ============================================================================

  describe('Provider Type Selection', () => {
    it('should pass correct projectId to FirestoreDistrictConfigStorage (Requirement 4.2)', () => {
      process.env['STORAGE_PROVIDER'] = 'gcp'
      process.env['GCP_PROJECT_ID'] = 'my-test-project'
      process.env['GCS_BUCKET_NAME'] = 'my-test-bucket'

      StorageProviderFactory.createFromEnvironment()

      expect(firestoreDistrictConfigConstructorCalls).toHaveLength(1)
      expect(firestoreDistrictConfigConstructorCalls[0]?.projectId).toBe(
        'my-test-project'
      )
    })

    it('should use same GCP_PROJECT_ID for all GCP providers', () => {
      process.env['STORAGE_PROVIDER'] = 'gcp'
      process.env['GCP_PROJECT_ID'] = 'shared-project-id'
      process.env['GCS_BUCKET_NAME'] = 'test-bucket'

      StorageProviderFactory.createFromEnvironment()

      // Verify all GCP providers use the same project ID
      expect(firestoreSnapshotConstructorCalls).toHaveLength(1)
      expect(firestoreSnapshotConstructorCalls[0]?.projectId).toBe(
        'shared-project-id'
      )

      expect(firestoreDistrictConfigConstructorCalls).toHaveLength(1)
      expect(firestoreDistrictConfigConstructorCalls[0]?.projectId).toBe(
        'shared-project-id'
      )

      expect(gcsConstructorCalls).toHaveLength(1)
      expect(gcsConstructorCalls[0]?.projectId).toBe('shared-project-id')
    })

    it('should create LocalDistrictConfigStorage with custom CACHE_DIR', () => {
      process.env['STORAGE_PROVIDER'] = 'local'
      process.env['CACHE_DIR'] = '/custom/cache/path'

      const result = StorageProviderFactory.createFromEnvironment()

      // Verify local provider is created (we can't easily verify the cache dir
      // without accessing internal state, but we verify the provider is created)
      expect(result.districtConfigStorage).toBeInstanceOf(
        LocalDistrictConfigStorage
      )
    })

    it('should use default cache directory when CACHE_DIR is not set', () => {
      process.env['STORAGE_PROVIDER'] = 'local'
      // CACHE_DIR not set

      const result = StorageProviderFactory.createFromEnvironment()

      expect(result.districtConfigStorage).toBeInstanceOf(
        LocalDistrictConfigStorage
      )
    })
  })

  // ============================================================================
  // Configuration Validation (Requirement 4.1)
  // ============================================================================

  describe('Configuration Validation', () => {
    it('should throw StorageConfigurationError when GCP provider selected without GCP_PROJECT_ID', () => {
      process.env['STORAGE_PROVIDER'] = 'gcp'
      process.env['GCS_BUCKET_NAME'] = 'test-bucket'
      // GCP_PROJECT_ID not set

      expect(() => StorageProviderFactory.createFromEnvironment()).toThrow(
        StorageConfigurationError
      )

      // Verify no GCP providers were created
      expect(firestoreDistrictConfigConstructorCalls).toHaveLength(0)
    })

    it('should throw StorageConfigurationError when GCP provider selected without GCS_BUCKET_NAME', () => {
      process.env['STORAGE_PROVIDER'] = 'gcp'
      process.env['GCP_PROJECT_ID'] = 'test-project'
      // GCS_BUCKET_NAME not set

      expect(() => StorageProviderFactory.createFromEnvironment()).toThrow(
        StorageConfigurationError
      )

      // Verify no GCP providers were created
      expect(firestoreDistrictConfigConstructorCalls).toHaveLength(0)
    })

    it('should throw StorageConfigurationError when GCP_PROJECT_ID is empty string', () => {
      process.env['STORAGE_PROVIDER'] = 'gcp'
      process.env['GCP_PROJECT_ID'] = ''
      process.env['GCS_BUCKET_NAME'] = 'test-bucket'

      expect(() => StorageProviderFactory.createFromEnvironment()).toThrow(
        StorageConfigurationError
      )
    })

    it('should throw StorageConfigurationError when GCP_PROJECT_ID is whitespace only', () => {
      process.env['STORAGE_PROVIDER'] = 'gcp'
      process.env['GCP_PROJECT_ID'] = '   '
      process.env['GCS_BUCKET_NAME'] = 'test-bucket'

      expect(() => StorageProviderFactory.createFromEnvironment()).toThrow(
        StorageConfigurationError
      )
    })

    it('should include missing config fields in StorageConfigurationError', () => {
      process.env['STORAGE_PROVIDER'] = 'gcp'
      // Both GCP_PROJECT_ID and GCS_BUCKET_NAME not set

      try {
        StorageProviderFactory.createFromEnvironment()
        expect.fail('Should have thrown StorageConfigurationError')
      } catch (error) {
        expect(error).toBeInstanceOf(StorageConfigurationError)
        const configError = error as StorageConfigurationError
        expect(configError.missingConfig).toContain('GCP_PROJECT_ID')
        expect(configError.missingConfig).toContain('GCS_BUCKET_NAME')
      }
    })

    it('should not require GCP config when STORAGE_PROVIDER is local', () => {
      process.env['STORAGE_PROVIDER'] = 'local'
      // No GCP config set - should not throw

      const result = StorageProviderFactory.createFromEnvironment()

      expect(result.districtConfigStorage).toBeInstanceOf(
        LocalDistrictConfigStorage
      )
    })
  })

  // ============================================================================
  // Explicit Configuration (StorageConfig)
  // ============================================================================

  describe('Explicit Configuration', () => {
    it('should create LocalDistrictConfigStorage with explicit local config', () => {
      const config: StorageConfig = {
        provider: 'local',
        local: {
          cacheDir: '/explicit/cache/dir',
        },
      }

      const result = StorageProviderFactory.create(config)

      expect(result.districtConfigStorage).toBeInstanceOf(
        LocalDistrictConfigStorage
      )
    })

    it('should create LocalDistrictConfigStorage with default cache dir when local config is empty', () => {
      const config: StorageConfig = {
        provider: 'local',
      }

      const result = StorageProviderFactory.create(config)

      expect(result.districtConfigStorage).toBeInstanceOf(
        LocalDistrictConfigStorage
      )
    })

    it('should create FirestoreDistrictConfigStorage with explicit GCP config', () => {
      const config: StorageConfig = {
        provider: 'gcp',
        gcp: {
          projectId: 'explicit-project-id',
          bucketName: 'explicit-bucket-name',
        },
      }

      const result = StorageProviderFactory.create(config)

      expect(
        (result.districtConfigStorage as unknown as { _mockType: string })
          ._mockType
      ).toBe('FirestoreDistrictConfigStorage')

      expect(firestoreDistrictConfigConstructorCalls).toHaveLength(1)
      expect(firestoreDistrictConfigConstructorCalls[0]?.projectId).toBe(
        'explicit-project-id'
      )
    })

    it('should throw StorageConfigurationError when gcp config object is missing', () => {
      const config: StorageConfig = {
        provider: 'gcp',
        // gcp config not provided
      }

      expect(() => StorageProviderFactory.create(config)).toThrow(
        StorageConfigurationError
      )
    })

    it('should throw StorageConfigurationError when gcp.projectId is empty', () => {
      const config: StorageConfig = {
        provider: 'gcp',
        gcp: {
          projectId: '',
          bucketName: 'test-bucket',
        },
      }

      expect(() => StorageProviderFactory.create(config)).toThrow(
        StorageConfigurationError
      )
    })

    it('should throw StorageConfigurationError when gcp.bucketName is empty', () => {
      const config: StorageConfig = {
        provider: 'gcp',
        gcp: {
          projectId: 'test-project',
          bucketName: '',
        },
      }

      expect(() => StorageProviderFactory.create(config)).toThrow(
        StorageConfigurationError
      )
    })
  })

  // ============================================================================
  // Interface Compliance
  // ============================================================================

  describe('Interface Compliance', () => {
    it('should return districtConfigStorage with IDistrictConfigStorage interface for local provider', () => {
      const result = StorageProviderFactory.createFromEnvironment()

      // Verify the returned object has the expected interface methods
      expect(typeof result.districtConfigStorage.getConfiguration).toBe(
        'function'
      )
      expect(typeof result.districtConfigStorage.saveConfiguration).toBe(
        'function'
      )
      expect(typeof result.districtConfigStorage.appendChangeLog).toBe(
        'function'
      )
      expect(typeof result.districtConfigStorage.getChangeHistory).toBe(
        'function'
      )
      expect(typeof result.districtConfigStorage.isReady).toBe('function')
    })

    it('should return districtConfigStorage with IDistrictConfigStorage interface for GCP provider', () => {
      process.env['STORAGE_PROVIDER'] = 'gcp'
      process.env['GCP_PROJECT_ID'] = 'test-project'
      process.env['GCS_BUCKET_NAME'] = 'test-bucket'

      const result = StorageProviderFactory.createFromEnvironment()

      // Verify the returned object has the expected interface methods
      expect(typeof result.districtConfigStorage.getConfiguration).toBe(
        'function'
      )
      expect(typeof result.districtConfigStorage.saveConfiguration).toBe(
        'function'
      )
      expect(typeof result.districtConfigStorage.appendChangeLog).toBe(
        'function'
      )
      expect(typeof result.districtConfigStorage.getChangeHistory).toBe(
        'function'
      )
      expect(typeof result.districtConfigStorage.isReady).toBe('function')
    })

    it('should include districtConfigStorage in StorageProviders result alongside other providers', () => {
      const result = StorageProviderFactory.createFromEnvironment()

      expect(result).toHaveProperty('snapshotStorage')
      expect(result).toHaveProperty('rawCSVStorage')
      expect(result).toHaveProperty('districtConfigStorage')
      expect(result).toHaveProperty('timeSeriesIndexStorage')
      expect(result).toHaveProperty('backfillJobStorage')
      expect(Object.keys(result)).toHaveLength(5)
    })
  })

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle mixed case STORAGE_PROVIDER values for district config', () => {
      const localCases = ['Local', 'LOCAL', 'lOcAl']
      const gcpCases = ['Gcp', 'GCP', 'gCp']

      for (const testCase of localCases) {
        process.env['STORAGE_PROVIDER'] = testCase

        const result = StorageProviderFactory.createFromEnvironment()

        expect(result.districtConfigStorage).toBeInstanceOf(
          LocalDistrictConfigStorage
        )
      }

      for (const testCase of gcpCases) {
        // Reset tracking arrays
        firestoreDistrictConfigConstructorCalls.length = 0

        process.env['STORAGE_PROVIDER'] = testCase
        process.env['GCP_PROJECT_ID'] = 'test-project'
        process.env['GCS_BUCKET_NAME'] = 'test-bucket'

        const result = StorageProviderFactory.createFromEnvironment()

        expect(
          (result.districtConfigStorage as unknown as { _mockType: string })
            ._mockType
        ).toBe('FirestoreDistrictConfigStorage')
      }
    })

    it('should trim whitespace from STORAGE_PROVIDER value', () => {
      process.env['STORAGE_PROVIDER'] = '  gcp  '
      process.env['GCP_PROJECT_ID'] = 'test-project'
      process.env['GCS_BUCKET_NAME'] = 'test-bucket'

      const result = StorageProviderFactory.createFromEnvironment()

      // Should recognize 'gcp' after trimming
      expect(
        (result.districtConfigStorage as unknown as { _mockType: string })
          ._mockType
      ).toBe('FirestoreDistrictConfigStorage')
    })

    it('should create all three storage providers consistently', () => {
      // Local provider
      let result = StorageProviderFactory.createFromEnvironment()

      expect(result.snapshotStorage).toBeDefined()
      expect(result.rawCSVStorage).toBeDefined()
      expect(result.districtConfigStorage).toBeDefined()

      // GCP provider
      firestoreSnapshotConstructorCalls.length = 0
      firestoreDistrictConfigConstructorCalls.length = 0
      gcsConstructorCalls.length = 0

      process.env['STORAGE_PROVIDER'] = 'gcp'
      process.env['GCP_PROJECT_ID'] = 'test-project'
      process.env['GCS_BUCKET_NAME'] = 'test-bucket'

      result = StorageProviderFactory.createFromEnvironment()

      expect(result.snapshotStorage).toBeDefined()
      expect(result.rawCSVStorage).toBeDefined()
      expect(result.districtConfigStorage).toBeDefined()
    })

    it('should not create any GCP providers when validation fails', () => {
      process.env['STORAGE_PROVIDER'] = 'gcp'
      // Missing required GCP config

      try {
        StorageProviderFactory.createFromEnvironment()
      } catch {
        // Expected to throw
      }

      // Verify no GCP providers were created
      expect(firestoreSnapshotConstructorCalls).toHaveLength(0)
      expect(firestoreDistrictConfigConstructorCalls).toHaveLength(0)
      expect(gcsConstructorCalls).toHaveLength(0)
    })
  })
})
