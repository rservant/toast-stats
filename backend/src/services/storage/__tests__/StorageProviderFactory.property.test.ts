/**
 * Property-Based Tests for StorageProviderFactory
 *
 * Feature: district-configuration-storage-abstraction
 *
 * Property 2: Storage Provider Selection Consistency
 * **Validates: Requirements 4.1, 4.2, 4.3**
 *
 * This test validates that:
 * - For any value of the STORAGE_PROVIDER environment variable, the
 *   StorageProviderFactory SHALL create the correct storage implementation type
 * - LocalDistrictConfigStorage for 'local'/unset
 * - FirestoreDistrictConfigStorage for 'gcp'
 * - The districtConfigStorage is included in the returned StorageProviders
 *
 * The property ensures consistent storage provider selection based on
 * environment configuration.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fc from 'fast-check'
import { StorageProviderFactory } from '../StorageProviderFactory.js'
import { LocalDistrictConfigStorage } from '../LocalDistrictConfigStorage.js'
import { LocalSnapshotStorage } from '../LocalSnapshotStorage.js'
import { LocalRawCSVStorage } from '../LocalRawCSVStorage.js'
import { StorageConfigurationError } from '../../../types/storageInterfaces.js'

// ============================================================================
// Mock GCP Providers
// ============================================================================

// Track constructor calls for verification
interface MockGCSSnapshotConfig {
  projectId: string
  bucketName: string
  prefix?: string
}

interface MockFirestoreDistrictConfig {
  projectId: string
}

interface MockGCSConfig {
  projectId: string
  bucketName: string
}

const gcsSnapshotConstructorCalls: MockGCSSnapshotConfig[] = []
const firestoreDistrictConfigConstructorCalls: MockFirestoreDistrictConfig[] =
  []
const gcsConstructorCalls: MockGCSConfig[] = []

// Mock the GCP provider modules to avoid actual GCP connections
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
// Arbitraries for Property-Based Testing
// ============================================================================

/**
 * Arbitrary for generating STORAGE_PROVIDER values that should result in 'local' provider
 *
 * Includes:
 * - undefined (not set)
 * - empty string
 * - whitespace only
 * - 'local' in various cases
 * - invalid/unknown values (which default to local)
 */
const localProviderValueArbitrary = fc.oneof(
  // Undefined (not set)
  fc.constant(undefined),
  // Empty string
  fc.constant(''),
  // Whitespace only
  fc.constantFrom('   ', '\t', '\n', '  \t  ', '\t\n'),
  // 'local' in various cases
  fc.constantFrom('local', 'LOCAL', 'Local', 'lOcAl', 'lOCAL'),
  // Invalid/unknown values that default to local
  fc.constantFrom(
    'aws',
    'azure',
    'unknown',
    'invalid',
    'filesystem',
    'disk',
    'file',
    'memory',
    's3',
    'blob'
  ),
  // Random alphanumeric strings that are not 'gcp' (will default to local)
  fc
    .stringMatching(/^[a-zA-Z][a-zA-Z0-9_-]{0,19}$/)
    .filter(s => s.toLowerCase() !== 'gcp' && s.toLowerCase() !== 'local')
)

/**
 * Arbitrary for generating STORAGE_PROVIDER values that should result in 'gcp' provider
 *
 * Includes 'gcp' in various cases
 */
const gcpProviderValueArbitrary = fc.constantFrom(
  'gcp',
  'GCP',
  'Gcp',
  'gCp',
  'gCP',
  'GcP'
)

/**
 * Arbitrary for generating valid GCP project IDs
 * GCP project IDs must be 6-30 characters, lowercase letters, digits, and hyphens
 */
const gcpProjectIdArbitrary = fc
  .stringMatching(/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/)
  .filter(s => !s.includes('--')) // No consecutive hyphens

/**
 * Arbitrary for generating valid GCS bucket names
 * Bucket names must be 3-63 characters, lowercase letters, digits, hyphens, and underscores
 */
const gcsBucketNameArbitrary = fc
  .stringMatching(/^[a-z][a-z0-9_-]{1,61}[a-z0-9]$/)
  .filter(s => !s.includes('--') && !s.includes('__'))

// ============================================================================
// Test Suite
// ============================================================================

describe('Property 2: Storage Provider Selection Consistency', () => {
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
    gcsSnapshotConstructorCalls.length = 0
    firestoreDistrictConfigConstructorCalls.length = 0
    gcsConstructorCalls.length = 0
  })

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv as typeof process.env
  })

  // ==========================================================================
  // Property: Local provider selection for 'local'/unset/invalid values
  // ==========================================================================

  it('should create LocalDistrictConfigStorage for local/unset/invalid STORAGE_PROVIDER values', () => {
    // Feature: district-configuration-storage-abstraction, Property 2: Storage Provider Selection Consistency
    // **Validates: Requirements 4.1, 4.2, 4.3**
    fc.assert(
      fc.property(localProviderValueArbitrary, providerValue => {
        // Clear tracking arrays for each iteration
        gcsSnapshotConstructorCalls.length = 0
        firestoreDistrictConfigConstructorCalls.length = 0
        gcsConstructorCalls.length = 0

        // Set up environment
        if (providerValue === undefined) {
          delete process.env['STORAGE_PROVIDER']
        } else {
          process.env['STORAGE_PROVIDER'] = providerValue
        }

        // Create providers
        const result = StorageProviderFactory.createFromEnvironment()

        // Property: districtConfigStorage must be included in result
        expect(result).toHaveProperty('districtConfigStorage')

        // Property: districtConfigStorage must be LocalDistrictConfigStorage
        expect(result.districtConfigStorage).toBeInstanceOf(
          LocalDistrictConfigStorage
        )

        // Property: snapshotStorage must be LocalSnapshotStorage
        expect(result.snapshotStorage).toBeInstanceOf(LocalSnapshotStorage)

        // Property: rawCSVStorage must be LocalRawCSVStorage
        expect(result.rawCSVStorage).toBeInstanceOf(LocalRawCSVStorage)

        // Property: No GCP providers should be created
        expect(gcsSnapshotConstructorCalls).toHaveLength(0)
        expect(firestoreDistrictConfigConstructorCalls).toHaveLength(0)
        expect(gcsConstructorCalls).toHaveLength(0)

        return true
      }),
      { numRuns: 100 }
    )
  })

  // ==========================================================================
  // Property: GCP provider selection for 'gcp' values
  // ==========================================================================

  it('should create FirestoreDistrictConfigStorage for gcp STORAGE_PROVIDER values', () => {
    // Feature: district-configuration-storage-abstraction, Property 2: Storage Provider Selection Consistency
    // **Validates: Requirements 4.1, 4.2, 4.3**
    fc.assert(
      fc.property(
        gcpProviderValueArbitrary,
        gcpProjectIdArbitrary,
        gcsBucketNameArbitrary,
        (providerValue, projectId, bucketName) => {
          // Clear tracking arrays for each iteration
          gcsSnapshotConstructorCalls.length = 0
          firestoreDistrictConfigConstructorCalls.length = 0
          gcsConstructorCalls.length = 0

          // Set up environment with valid GCP configuration
          process.env['STORAGE_PROVIDER'] = providerValue
          process.env['GCP_PROJECT_ID'] = projectId
          process.env['GCS_BUCKET_NAME'] = bucketName

          // Create providers
          const result = StorageProviderFactory.createFromEnvironment()

          // Property: districtConfigStorage must be included in result
          expect(result).toHaveProperty('districtConfigStorage')

          // Property: districtConfigStorage must be FirestoreDistrictConfigStorage (mocked)
          expect(
            (
              result.districtConfigStorage as unknown as {
                _mockType: string
              }
            )._mockType
          ).toBe('FirestoreDistrictConfigStorage')

          // Property: FirestoreDistrictConfigStorage must be created with correct projectId
          expect(firestoreDistrictConfigConstructorCalls).toHaveLength(1)
          expect(firestoreDistrictConfigConstructorCalls[0]?.projectId).toBe(
            projectId
          )

          // Property: snapshotStorage must be GCSSnapshotStorage (mocked)
          expect(
            (result.snapshotStorage as unknown as { _mockType: string })
              ._mockType
          ).toBe('GCSSnapshotStorage')

          // Property: rawCSVStorage must be GCSRawCSVStorage (mocked)
          expect(
            (result.rawCSVStorage as unknown as { _mockType: string })._mockType
          ).toBe('GCSRawCSVStorage')

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  // ==========================================================================
  // Property: StorageProviders always includes districtConfigStorage
  // ==========================================================================

  it('should always include districtConfigStorage in returned StorageProviders', () => {
    // Feature: district-configuration-storage-abstraction, Property 2: Storage Provider Selection Consistency
    // **Validates: Requirements 4.1, 4.2, 4.3**
    fc.assert(
      fc.property(
        fc.oneof(localProviderValueArbitrary, gcpProviderValueArbitrary),
        fc.boolean(), // Whether to include GCP config
        (providerValue, includeGcpConfig) => {
          // Clear tracking arrays for each iteration
          gcsSnapshotConstructorCalls.length = 0
          firestoreDistrictConfigConstructorCalls.length = 0
          gcsConstructorCalls.length = 0

          // Set up environment
          if (providerValue === undefined) {
            delete process.env['STORAGE_PROVIDER']
          } else {
            process.env['STORAGE_PROVIDER'] = providerValue
          }

          // Determine if this is a GCP provider value
          const isGcpProvider =
            providerValue !== undefined &&
            providerValue.trim().toLowerCase() === 'gcp'

          // For GCP provider, we need valid GCP config
          if (isGcpProvider) {
            process.env['GCP_PROJECT_ID'] = 'test-project-id'
            process.env['GCS_BUCKET_NAME'] = 'test-bucket-name'
          } else if (includeGcpConfig) {
            // For local provider, GCP config is ignored but shouldn't cause issues
            process.env['GCP_PROJECT_ID'] = 'ignored-project-id'
            process.env['GCS_BUCKET_NAME'] = 'ignored-bucket-name'
          }

          // Create providers
          const result = StorageProviderFactory.createFromEnvironment()

          // Property: Result must always have all three storage providers
          expect(result).toHaveProperty('snapshotStorage')
          expect(result).toHaveProperty('rawCSVStorage')
          expect(result).toHaveProperty('districtConfigStorage')

          // Property: All storage providers must be defined (not null/undefined)
          expect(result.snapshotStorage).toBeDefined()
          expect(result.rawCSVStorage).toBeDefined()
          expect(result.districtConfigStorage).toBeDefined()

          // Property: districtConfigStorage must have the IDistrictConfigStorage interface
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

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  // ==========================================================================
  // Property: Provider type consistency across multiple calls
  // ==========================================================================

  it('should consistently create the same provider type for the same environment', () => {
    // Feature: district-configuration-storage-abstraction, Property 2: Storage Provider Selection Consistency
    // **Validates: Requirements 4.1, 4.2, 4.3**
    fc.assert(
      fc.property(
        fc.oneof(localProviderValueArbitrary, gcpProviderValueArbitrary),
        fc.integer({ min: 2, max: 5 }), // Number of calls to make
        (providerValue, numCalls) => {
          // Set up environment
          if (providerValue === undefined) {
            delete process.env['STORAGE_PROVIDER']
          } else {
            process.env['STORAGE_PROVIDER'] = providerValue
          }

          // Determine if this is a GCP provider value
          const isGcpProvider =
            providerValue !== undefined &&
            providerValue.trim().toLowerCase() === 'gcp'

          // For GCP provider, we need valid GCP config
          if (isGcpProvider) {
            process.env['GCP_PROJECT_ID'] = 'test-project-id'
            process.env['GCS_BUCKET_NAME'] = 'test-bucket-name'
          }

          // Make multiple calls and collect results
          const results: Array<{
            isLocalDistrictConfig: boolean
            isLocalSnapshot: boolean
            isLocalRawCSV: boolean
          }> = []

          for (let i = 0; i < numCalls; i++) {
            // Clear tracking arrays for each call
            gcsSnapshotConstructorCalls.length = 0
            firestoreDistrictConfigConstructorCalls.length = 0
            gcsConstructorCalls.length = 0

            const result = StorageProviderFactory.createFromEnvironment()

            results.push({
              isLocalDistrictConfig:
                result.districtConfigStorage instanceof
                LocalDistrictConfigStorage,
              isLocalSnapshot:
                result.snapshotStorage instanceof LocalSnapshotStorage,
              isLocalRawCSV: result.rawCSVStorage instanceof LocalRawCSVStorage,
            })
          }

          // Property: All calls should produce the same provider types
          const firstResult = results[0]
          for (const result of results) {
            expect(result.isLocalDistrictConfig).toBe(
              firstResult?.isLocalDistrictConfig
            )
            expect(result.isLocalSnapshot).toBe(firstResult?.isLocalSnapshot)
            expect(result.isLocalRawCSV).toBe(firstResult?.isLocalRawCSV)
          }

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  // ==========================================================================
  // Property: GCP provider fails fast without required config
  // ==========================================================================

  it('should throw StorageConfigurationError for gcp provider without required config', () => {
    // Feature: district-configuration-storage-abstraction, Property 2: Storage Provider Selection Consistency
    // **Validates: Requirements 4.1, 4.2, 4.3**
    fc.assert(
      fc.property(
        gcpProviderValueArbitrary,
        fc.constantFrom('missing-project', 'missing-bucket', 'missing-both'),
        (providerValue, missingConfig) => {
          // Clear tracking arrays for each iteration
          gcsSnapshotConstructorCalls.length = 0
          firestoreDistrictConfigConstructorCalls.length = 0
          gcsConstructorCalls.length = 0

          // Set up environment with GCP provider but missing config
          process.env['STORAGE_PROVIDER'] = providerValue

          switch (missingConfig) {
            case 'missing-project':
              delete process.env['GCP_PROJECT_ID']
              process.env['GCS_BUCKET_NAME'] = 'test-bucket'
              break
            case 'missing-bucket':
              process.env['GCP_PROJECT_ID'] = 'test-project'
              delete process.env['GCS_BUCKET_NAME']
              break
            case 'missing-both':
              delete process.env['GCP_PROJECT_ID']
              delete process.env['GCS_BUCKET_NAME']
              break
          }

          // Property: Should throw StorageConfigurationError
          expect(() => StorageProviderFactory.createFromEnvironment()).toThrow(
            StorageConfigurationError
          )

          // Property: No GCP providers should be created
          expect(gcsSnapshotConstructorCalls).toHaveLength(0)
          expect(firestoreDistrictConfigConstructorCalls).toHaveLength(0)
          expect(gcsConstructorCalls).toHaveLength(0)

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  // ==========================================================================
  // Property: Explicit config produces correct provider types
  // ==========================================================================

  it('should create correct provider types with explicit StorageConfig', () => {
    // Feature: district-configuration-storage-abstraction, Property 2: Storage Provider Selection Consistency
    // **Validates: Requirements 4.1, 4.2, 4.3**
    fc.assert(
      fc.property(
        fc.constantFrom('local', 'gcp'),
        gcpProjectIdArbitrary,
        gcsBucketNameArbitrary,
        (provider, projectId, bucketName) => {
          // Clear tracking arrays for each iteration
          gcsSnapshotConstructorCalls.length = 0
          firestoreDistrictConfigConstructorCalls.length = 0
          gcsConstructorCalls.length = 0

          // Create explicit config
          const config =
            provider === 'gcp'
              ? {
                  provider: 'gcp' as const,
                  gcp: {
                    projectId,
                    bucketName,
                  },
                }
              : {
                  provider: 'local' as const,
                  local: {
                    cacheDir: './test-cache',
                  },
                }

          // Create providers with explicit config
          const result = StorageProviderFactory.create(config)

          // Property: districtConfigStorage must be included in result
          expect(result).toHaveProperty('districtConfigStorage')

          if (provider === 'local') {
            // Property: Local provider should create LocalDistrictConfigStorage
            expect(result.districtConfigStorage).toBeInstanceOf(
              LocalDistrictConfigStorage
            )
            expect(result.snapshotStorage).toBeInstanceOf(LocalSnapshotStorage)
            expect(result.rawCSVStorage).toBeInstanceOf(LocalRawCSVStorage)
          } else {
            // Property: GCP provider should create FirestoreDistrictConfigStorage
            expect(
              (
                result.districtConfigStorage as unknown as {
                  _mockType: string
                }
              )._mockType
            ).toBe('FirestoreDistrictConfigStorage')
            expect(firestoreDistrictConfigConstructorCalls).toHaveLength(1)
            expect(firestoreDistrictConfigConstructorCalls[0]?.projectId).toBe(
              projectId
            )
          }

          return true
        }
      ),
      { numRuns: 100 }
    )
  })
})
