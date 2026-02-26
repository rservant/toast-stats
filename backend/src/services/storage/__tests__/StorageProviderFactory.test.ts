/**
 * StorageProviderFactory Unit Tests
 *
 * Tests the StorageProviderFactory that creates storage provider instances
 * based on environment configuration or explicit configuration.
 *
 * Requirements Validated: 5.1-5.7, 1.3
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
import { LocalSnapshotStorage } from '../LocalSnapshotStorage.js'
import { LocalRawCSVStorage } from '../LocalRawCSVStorage.js'
import { StorageConfigurationError } from '../../../types/storageInterfaces.js'
import type { StorageConfig } from '../../../types/storageInterfaces.js'

// ============================================================================
// Mock GCP Providers
// ============================================================================

// Track constructor calls for verification
interface MockGCSConfig {
  projectId: string
  bucketName: string
}

interface MockGCSSnapshotConfig {
  projectId: string
  bucketName: string
  prefix?: string
  storage?: unknown
}

const gcsConstructorCalls: MockGCSConfig[] = []
const gcsSnapshotConstructorCalls: MockGCSSnapshotConfig[] = []

// Mock the GCP provider modules to avoid actual GCP connections
// Using class syntax to properly support 'new' operator
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

describe('StorageProviderFactory', () => {
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
    gcsConstructorCalls.length = 0
    gcsSnapshotConstructorCalls.length = 0
  })

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv as typeof process.env
  })

  // ============================================================================
  // Local Provider Creation Tests
  // ============================================================================

  describe('Local Provider Creation', () => {
    describe('createFromEnvironment with default config', () => {
      it('should create local providers when STORAGE_PROVIDER is not set (Requirement 5.4)', () => {
        // STORAGE_PROVIDER not set - should default to 'local'
        const result = StorageProviderFactory.createFromEnvironment()

        expect(result).toHaveProperty('snapshotStorage')
        expect(result).toHaveProperty('rawCSVStorage')
        expect(result.snapshotStorage).toBeInstanceOf(LocalSnapshotStorage)
        expect(result.rawCSVStorage).toBeInstanceOf(LocalRawCSVStorage)
      })

      it('should create local providers when STORAGE_PROVIDER is empty string (Requirement 5.4)', () => {
        process.env['STORAGE_PROVIDER'] = ''

        const result = StorageProviderFactory.createFromEnvironment()

        expect(result.snapshotStorage).toBeInstanceOf(LocalSnapshotStorage)
        expect(result.rawCSVStorage).toBeInstanceOf(LocalRawCSVStorage)
      })

      it('should create local providers when STORAGE_PROVIDER is whitespace only (Requirement 5.4)', () => {
        process.env['STORAGE_PROVIDER'] = '   '

        const result = StorageProviderFactory.createFromEnvironment()

        expect(result.snapshotStorage).toBeInstanceOf(LocalSnapshotStorage)
        expect(result.rawCSVStorage).toBeInstanceOf(LocalRawCSVStorage)
      })

      it('should use default cache directory when CACHE_DIR is not set', () => {
        const result = StorageProviderFactory.createFromEnvironment()

        // Verify local providers are created (default cache dir is './data/cache')
        expect(result.snapshotStorage).toBeInstanceOf(LocalSnapshotStorage)
        expect(result.rawCSVStorage).toBeInstanceOf(LocalRawCSVStorage)
      })
    })

    describe('createFromEnvironment with explicit local config', () => {
      it('should create local providers when STORAGE_PROVIDER is "local" (Requirement 5.2)', () => {
        process.env['STORAGE_PROVIDER'] = 'local'

        const result = StorageProviderFactory.createFromEnvironment()

        expect(result.snapshotStorage).toBeInstanceOf(LocalSnapshotStorage)
        expect(result.rawCSVStorage).toBeInstanceOf(LocalRawCSVStorage)
      })

      it('should create local providers when STORAGE_PROVIDER is "LOCAL" (case insensitive)', () => {
        process.env['STORAGE_PROVIDER'] = 'LOCAL'

        const result = StorageProviderFactory.createFromEnvironment()

        expect(result.snapshotStorage).toBeInstanceOf(LocalSnapshotStorage)
        expect(result.rawCSVStorage).toBeInstanceOf(LocalRawCSVStorage)
      })

      it('should use custom CACHE_DIR when provided', () => {
        process.env['STORAGE_PROVIDER'] = 'local'
        process.env['CACHE_DIR'] = '/custom/cache/path'

        const result = StorageProviderFactory.createFromEnvironment()

        expect(result.snapshotStorage).toBeInstanceOf(LocalSnapshotStorage)
        expect(result.rawCSVStorage).toBeInstanceOf(LocalRawCSVStorage)
      })

      it('should default to local when STORAGE_PROVIDER has invalid value', () => {
        process.env['STORAGE_PROVIDER'] = 'invalid-provider'

        const result = StorageProviderFactory.createFromEnvironment()

        expect(result.snapshotStorage).toBeInstanceOf(LocalSnapshotStorage)
        expect(result.rawCSVStorage).toBeInstanceOf(LocalRawCSVStorage)
      })
    })

    describe('create with explicit local config', () => {
      it('should create local providers with explicit config (Requirement 1.3)', () => {
        const config: StorageConfig = {
          provider: 'local',
          local: {
            cacheDir: '/explicit/cache/dir',
          },
        }

        const result = StorageProviderFactory.create(config)

        expect(result.snapshotStorage).toBeInstanceOf(LocalSnapshotStorage)
        expect(result.rawCSVStorage).toBeInstanceOf(LocalRawCSVStorage)
      })

      it('should use default cache directory when local config is not provided', () => {
        const config: StorageConfig = {
          provider: 'local',
        }

        const result = StorageProviderFactory.create(config)

        expect(result.snapshotStorage).toBeInstanceOf(LocalSnapshotStorage)
        expect(result.rawCSVStorage).toBeInstanceOf(LocalRawCSVStorage)
      })
    })
  })

  // ============================================================================
  // GCP Provider Creation Tests
  // ============================================================================

  describe('GCP Provider Creation', () => {
    describe('createFromEnvironment with valid GCP config', () => {
      it('should create GCP providers when STORAGE_PROVIDER is "gcp" with valid config (Requirements 5.3, 5.5, 5.6)', () => {
        process.env['STORAGE_PROVIDER'] = 'gcp'
        process.env['GCP_PROJECT_ID'] = 'test-project-id'
        process.env['GCS_BUCKET_NAME'] = 'test-bucket-name'

        const result = StorageProviderFactory.createFromEnvironment()

        expect(result).toHaveProperty('snapshotStorage')
        expect(result).toHaveProperty('rawCSVStorage')

        // Verify GCSSnapshotStorage was called with correct config (Requirement 7.1)
        expect(gcsSnapshotConstructorCalls).toHaveLength(1)
        expect(gcsSnapshotConstructorCalls[0]).toEqual({
          projectId: 'test-project-id',
          bucketName: 'test-bucket-name',
          prefix: 'snapshots',
        })

        // Verify GCSRawCSVStorage was called with correct config
        expect(gcsConstructorCalls).toHaveLength(1)
        expect(gcsConstructorCalls[0]).toEqual({
          projectId: 'test-project-id',
          bucketName: 'test-bucket-name',
        })
      })

      it('should create GCP providers when STORAGE_PROVIDER is "GCP" (case insensitive)', () => {
        process.env['STORAGE_PROVIDER'] = 'GCP'
        process.env['GCP_PROJECT_ID'] = 'test-project-id'
        process.env['GCS_BUCKET_NAME'] = 'test-bucket-name'

        const result = StorageProviderFactory.createFromEnvironment()

        expect(gcsSnapshotConstructorCalls).toHaveLength(1)
        expect(gcsConstructorCalls).toHaveLength(1)
        expect(result).toHaveProperty('snapshotStorage')
        expect(result).toHaveProperty('rawCSVStorage')
      })
    })

    describe('create with explicit GCP config', () => {
      it('should create GCP providers with explicit config (Requirement 1.3)', () => {
        const config: StorageConfig = {
          provider: 'gcp',
          gcp: {
            projectId: 'explicit-project-id',
            bucketName: 'explicit-bucket-name',
          },
        }

        const result = StorageProviderFactory.create(config)

        // Verify GCSSnapshotStorage was created with correct config
        expect(gcsSnapshotConstructorCalls).toHaveLength(1)
        expect(gcsSnapshotConstructorCalls[0]).toEqual({
          projectId: 'explicit-project-id',
          bucketName: 'explicit-bucket-name',
          prefix: 'snapshots',
        })

        expect(gcsConstructorCalls).toHaveLength(1)
        expect(gcsConstructorCalls[0]).toEqual({
          projectId: 'explicit-project-id',
          bucketName: 'explicit-bucket-name',
        })

        expect(result).toHaveProperty('snapshotStorage')
        expect(result).toHaveProperty('rawCSVStorage')
      })

      it('should create GCP providers with minimal required config', () => {
        const config: StorageConfig = {
          provider: 'gcp',
          gcp: {
            projectId: 'explicit-project-id',
            bucketName: 'explicit-bucket-name',
          },
        }

        StorageProviderFactory.create(config)

        // GCSSnapshotStorage should still be created with correct config
        expect(gcsSnapshotConstructorCalls).toHaveLength(1)
        expect(gcsSnapshotConstructorCalls[0]).toEqual({
          projectId: 'explicit-project-id',
          bucketName: 'explicit-bucket-name',
          prefix: 'snapshots',
        })
      })
    })

    describe('GCSSnapshotStorage integration (Requirements 7.1, 7.2)', () => {
      it('should create GCSSnapshotStorage when STORAGE_PROVIDER=gcp (Requirement 7.1)', () => {
        process.env['STORAGE_PROVIDER'] = 'gcp'
        process.env['GCP_PROJECT_ID'] = 'test-project'
        process.env['GCS_BUCKET_NAME'] = 'test-bucket'

        const result = StorageProviderFactory.createFromEnvironment()

        // Verify snapshotStorage is a GCSSnapshotStorage instance
        expect(
          (result.snapshotStorage as unknown as { _mockType: string })._mockType
        ).toBe('GCSSnapshotStorage')

        // Verify it was constructed with correct config
        expect(gcsSnapshotConstructorCalls).toHaveLength(1)
        expect(gcsSnapshotConstructorCalls[0]).toEqual({
          projectId: 'test-project',
          bucketName: 'test-bucket',
          prefix: 'snapshots',
        })
      })

      it('should throw StorageConfigurationError when GCS_BUCKET_NAME is missing (Requirement 7.2)', () => {
        process.env['STORAGE_PROVIDER'] = 'gcp'
        process.env['GCP_PROJECT_ID'] = 'test-project'
        // GCS_BUCKET_NAME intentionally not set

        expect(() => StorageProviderFactory.createFromEnvironment()).toThrow(
          StorageConfigurationError
        )

        try {
          StorageProviderFactory.createFromEnvironment()
        } catch (error) {
          expect(error).toBeInstanceOf(StorageConfigurationError)
          const configError = error as StorageConfigurationError
          expect(configError.missingConfig).toContain('GCS_BUCKET_NAME')
        }

        // Verify no GCSSnapshotStorage was created
        expect(gcsSnapshotConstructorCalls).toHaveLength(0)
      })
    })
  })

  // ============================================================================
  // Fail-Fast Behavior Tests (Requirement 5.7)
  // ============================================================================

  describe('Fail-Fast Behavior (Requirement 5.7)', () => {
    describe('createFromEnvironment with missing GCP config', () => {
      it('should throw StorageConfigurationError when GCP_PROJECT_ID is missing', () => {
        process.env['STORAGE_PROVIDER'] = 'gcp'
        process.env['GCS_BUCKET_NAME'] = 'test-bucket-name'
        // GCP_PROJECT_ID not set

        expect(() => StorageProviderFactory.createFromEnvironment()).toThrow(
          StorageConfigurationError
        )

        try {
          StorageProviderFactory.createFromEnvironment()
        } catch (error) {
          expect(error).toBeInstanceOf(StorageConfigurationError)
          const configError = error as StorageConfigurationError
          expect(configError.missingConfig).toContain('GCP_PROJECT_ID')
          expect(configError.message).toContain('GCP_PROJECT_ID')
        }
      })

      it('should throw StorageConfigurationError when GCS_BUCKET_NAME is missing', () => {
        process.env['STORAGE_PROVIDER'] = 'gcp'
        process.env['GCP_PROJECT_ID'] = 'test-project-id'
        // GCS_BUCKET_NAME not set

        expect(() => StorageProviderFactory.createFromEnvironment()).toThrow(
          StorageConfigurationError
        )

        try {
          StorageProviderFactory.createFromEnvironment()
        } catch (error) {
          expect(error).toBeInstanceOf(StorageConfigurationError)
          const configError = error as StorageConfigurationError
          expect(configError.missingConfig).toContain('GCS_BUCKET_NAME')
          expect(configError.message).toContain('GCS_BUCKET_NAME')
        }
      })

      it('should throw StorageConfigurationError when both GCP_PROJECT_ID and GCS_BUCKET_NAME are missing', () => {
        process.env['STORAGE_PROVIDER'] = 'gcp'
        // Neither GCP_PROJECT_ID nor GCS_BUCKET_NAME set

        expect(() => StorageProviderFactory.createFromEnvironment()).toThrow(
          StorageConfigurationError
        )

        try {
          StorageProviderFactory.createFromEnvironment()
        } catch (error) {
          expect(error).toBeInstanceOf(StorageConfigurationError)
          const configError = error as StorageConfigurationError
          expect(configError.missingConfig).toContain('GCP_PROJECT_ID')
          expect(configError.missingConfig).toContain('GCS_BUCKET_NAME')
        }
      })

      it('should throw StorageConfigurationError when GCP_PROJECT_ID is empty string', () => {
        process.env['STORAGE_PROVIDER'] = 'gcp'
        process.env['GCP_PROJECT_ID'] = ''
        process.env['GCS_BUCKET_NAME'] = 'test-bucket-name'

        expect(() => StorageProviderFactory.createFromEnvironment()).toThrow(
          StorageConfigurationError
        )
      })

      it('should throw StorageConfigurationError when GCS_BUCKET_NAME is empty string', () => {
        process.env['STORAGE_PROVIDER'] = 'gcp'
        process.env['GCP_PROJECT_ID'] = 'test-project-id'
        process.env['GCS_BUCKET_NAME'] = ''

        expect(() => StorageProviderFactory.createFromEnvironment()).toThrow(
          StorageConfigurationError
        )
      })

      it('should throw StorageConfigurationError when GCP_PROJECT_ID is whitespace only', () => {
        process.env['STORAGE_PROVIDER'] = 'gcp'
        process.env['GCP_PROJECT_ID'] = '   '
        process.env['GCS_BUCKET_NAME'] = 'test-bucket-name'

        expect(() => StorageProviderFactory.createFromEnvironment()).toThrow(
          StorageConfigurationError
        )
      })
    })

    describe('create with missing GCP config', () => {
      it('should throw StorageConfigurationError when gcp config object is missing', () => {
        const config: StorageConfig = {
          provider: 'gcp',
          // gcp config not provided
        }

        expect(() => StorageProviderFactory.create(config)).toThrow(
          StorageConfigurationError
        )
      })

      it('should throw StorageConfigurationError when gcp.projectId is missing', () => {
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

        try {
          StorageProviderFactory.create(config)
        } catch (error) {
          expect(error).toBeInstanceOf(StorageConfigurationError)
          const configError = error as StorageConfigurationError
          expect(configError.missingConfig).toContain('gcp.projectId')
        }
      })

      it('should throw StorageConfigurationError when gcp.bucketName is missing', () => {
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

        try {
          StorageProviderFactory.create(config)
        } catch (error) {
          expect(error).toBeInstanceOf(StorageConfigurationError)
          const configError = error as StorageConfigurationError
          expect(configError.missingConfig).toContain('gcp.bucketName')
        }
      })

      it('should include clear error message about missing configuration', () => {
        process.env['STORAGE_PROVIDER'] = 'gcp'

        try {
          StorageProviderFactory.createFromEnvironment()
          expect.fail('Should have thrown StorageConfigurationError')
        } catch (error) {
          expect(error).toBeInstanceOf(StorageConfigurationError)
          const configError = error as StorageConfigurationError
          expect(configError.message).toMatch(/missing/i)
          expect(configError.message).toMatch(/GCP/i)
        }
      })
    })
  })

  // ============================================================================
  // Environment Variable Reading Tests
  // ============================================================================

  describe('Environment Variable Reading', () => {
    it('should read STORAGE_PROVIDER environment variable (Requirement 5.1)', () => {
      process.env['STORAGE_PROVIDER'] = 'local'

      const result = StorageProviderFactory.createFromEnvironment()

      expect(result.snapshotStorage).toBeInstanceOf(LocalSnapshotStorage)
    })

    it('should read GCP_PROJECT_ID environment variable (Requirement 5.5)', () => {
      process.env['STORAGE_PROVIDER'] = 'gcp'
      process.env['GCP_PROJECT_ID'] = 'my-gcp-project'
      process.env['GCS_BUCKET_NAME'] = 'my-bucket'

      StorageProviderFactory.createFromEnvironment()

      expect(gcsSnapshotConstructorCalls).toHaveLength(1)
      expect(gcsSnapshotConstructorCalls[0]?.projectId).toBe('my-gcp-project')
    })

    it('should read GCS_BUCKET_NAME environment variable (Requirement 5.6)', () => {
      process.env['STORAGE_PROVIDER'] = 'gcp'
      process.env['GCP_PROJECT_ID'] = 'my-gcp-project'
      process.env['GCS_BUCKET_NAME'] = 'my-csv-bucket'

      StorageProviderFactory.createFromEnvironment()

      expect(gcsConstructorCalls).toHaveLength(1)
      expect(gcsConstructorCalls[0]?.bucketName).toBe('my-csv-bucket')
    })

    it('should read CACHE_DIR environment variable for local provider', () => {
      process.env['STORAGE_PROVIDER'] = 'local'
      process.env['CACHE_DIR'] = '/custom/cache/directory'

      const result = StorageProviderFactory.createFromEnvironment()

      // Local providers should be created (we can't easily verify the cache dir
      // without accessing internal state, but we verify the providers are created)
      expect(result.snapshotStorage).toBeInstanceOf(LocalSnapshotStorage)
      expect(result.rawCSVStorage).toBeInstanceOf(LocalRawCSVStorage)
    })

    it('should read FIRESTORE_COLLECTION environment variable for GCP provider', () => {
      process.env['STORAGE_PROVIDER'] = 'gcp'
      process.env['GCP_PROJECT_ID'] = 'my-gcp-project'
      process.env['GCS_BUCKET_NAME'] = 'my-bucket'
      process.env['FIRESTORE_COLLECTION'] = 'my-custom-collection'

      // FIRESTORE_COLLECTION is used by Firestore-based providers (district config, etc.)
      // GCSSnapshotStorage does not use it, but the factory should still accept it
      const result = StorageProviderFactory.createFromEnvironment()

      expect(result).toHaveProperty('snapshotStorage')
      expect(gcsSnapshotConstructorCalls).toHaveLength(1)
    })

    it('should trim whitespace from environment variable values', () => {
      process.env['STORAGE_PROVIDER'] = '  gcp  '
      process.env['GCP_PROJECT_ID'] = 'test-project'
      process.env['GCS_BUCKET_NAME'] = 'test-bucket'

      const result = StorageProviderFactory.createFromEnvironment()

      // Should recognize 'gcp' after trimming
      expect(gcsSnapshotConstructorCalls).toHaveLength(1)
      expect(gcsConstructorCalls).toHaveLength(1)
      expect(result).toHaveProperty('snapshotStorage')
    })
  })

  // ============================================================================
  // Return Type Verification Tests
  // ============================================================================

  describe('Return Type Verification', () => {
    it('should return object with snapshotStorage, rawCSVStorage, and timeSeriesIndexStorage properties', () => {
      const result = StorageProviderFactory.createFromEnvironment()

      expect(result).toHaveProperty('snapshotStorage')
      expect(result).toHaveProperty('rawCSVStorage')
      expect(result).toHaveProperty('timeSeriesIndexStorage')
      expect(Object.keys(result)).toHaveLength(3)
    })

    it('should return ISnapshotStorage-compatible snapshotStorage for local provider', () => {
      const result = StorageProviderFactory.createFromEnvironment()

      // Verify the returned object has the expected interface methods
      expect(typeof result.snapshotStorage.getLatestSuccessful).toBe('function')
      expect(typeof result.snapshotStorage.getLatest).toBe('function')
      expect(typeof result.snapshotStorage.writeSnapshot).toBe('function')
      expect(typeof result.snapshotStorage.listSnapshots).toBe('function')
      expect(typeof result.snapshotStorage.getSnapshot).toBe('function')
      expect(typeof result.snapshotStorage.isReady).toBe('function')
    })

    it('should return IRawCSVStorage-compatible rawCSVStorage for local provider', () => {
      const result = StorageProviderFactory.createFromEnvironment()

      // Verify the returned object has the expected interface methods
      expect(typeof result.rawCSVStorage.getCachedCSV).toBe('function')
      expect(typeof result.rawCSVStorage.setCachedCSV).toBe('function')
      expect(typeof result.rawCSVStorage.hasCachedCSV).toBe('function')
      expect(typeof result.rawCSVStorage.getCacheMetadata).toBe('function')
      expect(typeof result.rawCSVStorage.getHealthStatus).toBe('function')
    })

    it('should return ISnapshotStorage-compatible snapshotStorage for GCP provider', () => {
      process.env['STORAGE_PROVIDER'] = 'gcp'
      process.env['GCP_PROJECT_ID'] = 'test-project'
      process.env['GCS_BUCKET_NAME'] = 'test-bucket'

      const result = StorageProviderFactory.createFromEnvironment()

      // GCSSnapshotStorage (mocked) should have the interface methods
      expect(typeof result.snapshotStorage.getLatestSuccessful).toBe('function')
      expect(typeof result.snapshotStorage.writeSnapshot).toBe('function')
      expect(typeof result.snapshotStorage.isReady).toBe('function')

      // Verify it's the GCSSnapshotStorage mock instance (Requirement 7.1)
      expect(
        (result.snapshotStorage as unknown as { _mockType: string })._mockType
      ).toBe('GCSSnapshotStorage')
    })

    it('should return IRawCSVStorage-compatible rawCSVStorage for GCP provider', () => {
      process.env['STORAGE_PROVIDER'] = 'gcp'
      process.env['GCP_PROJECT_ID'] = 'test-project'
      process.env['GCS_BUCKET_NAME'] = 'test-bucket'

      const result = StorageProviderFactory.createFromEnvironment()

      // Mocked GCP providers should have the interface methods
      expect(typeof result.rawCSVStorage.getCachedCSV).toBe('function')
      expect(typeof result.rawCSVStorage.setCachedCSV).toBe('function')
      expect(typeof result.rawCSVStorage.getHealthStatus).toBe('function')

      // Verify it's the mock instance
      expect(
        (result.rawCSVStorage as unknown as { _mockType: string })._mockType
      ).toBe('GCSRawCSVStorage')
    })
  })

  // ============================================================================
  // Edge Cases and Error Handling
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle mixed case provider values', () => {
      const testCases = ['Local', 'LOCAL', 'lOcAl', 'Gcp', 'GCP', 'gCp']

      for (const testCase of testCases) {
        // Reset tracking arrays for each iteration
        gcsConstructorCalls.length = 0
        gcsSnapshotConstructorCalls.length = 0

        process.env['STORAGE_PROVIDER'] = testCase

        if (testCase.toLowerCase() === 'gcp') {
          process.env['GCP_PROJECT_ID'] = 'test-project'
          process.env['GCS_BUCKET_NAME'] = 'test-bucket'
        } else {
          delete process.env['GCP_PROJECT_ID']
          delete process.env['GCS_BUCKET_NAME']
        }

        const result = StorageProviderFactory.createFromEnvironment()

        expect(result).toHaveProperty('snapshotStorage')
        expect(result).toHaveProperty('rawCSVStorage')
      }
    })

    it('should handle unknown provider values by defaulting to local', () => {
      const unknownProviders = ['aws', 'azure', 'unknown', '123', 'gcp-local']

      for (const provider of unknownProviders) {
        process.env['STORAGE_PROVIDER'] = provider

        const result = StorageProviderFactory.createFromEnvironment()

        expect(result.snapshotStorage).toBeInstanceOf(LocalSnapshotStorage)
        expect(result.rawCSVStorage).toBeInstanceOf(LocalRawCSVStorage)
      }
    })
  })
})
