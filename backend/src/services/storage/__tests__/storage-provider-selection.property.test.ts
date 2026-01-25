/**
 * Property-Based Tests for Storage Provider Selection
 *
 * Feature: storage-provider-integration-fix
 * Property 1: Storage Provider Selection
 *
 * **Validates: Requirements 1.1, 1.2**
 *
 * For any value of the `STORAGE_PROVIDER` environment variable, the
 * `StorageProviderFactory.createFromEnvironment()` method SHALL return
 * the correct storage implementation:
 * - When `STORAGE_PROVIDER=gcp`: Returns `FirestoreSnapshotStorage`
 * - When `STORAGE_PROVIDER=local` or unset: Returns `LocalSnapshotStorage`
 *
 * Test Isolation Requirements (per testing steering document):
 * - Each test uses unique, isolated environment state
 * - Tests clean up all resources in afterEach hooks
 * - Tests do not depend on execution order
 * - Environment variables are scoped to individual tests
 * - All tests pass when run with --run (parallel mode)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fc from 'fast-check'
import { StorageProviderFactory } from '../StorageProviderFactory.js'
import { LocalSnapshotStorage } from '../LocalSnapshotStorage.js'
import { LocalRawCSVStorage } from '../LocalRawCSVStorage.js'

// ============================================================================
// Test Configuration
// ============================================================================

const PROPERTY_TEST_ITERATIONS = 50
const PROPERTY_TEST_TIMEOUT = 60000 // 1 minute

// ============================================================================
// Mock GCP Providers
// ============================================================================

// Track constructor calls for verification
interface MockFirestoreConfig {
  projectId: string
  collectionName?: string
}

interface MockGCSConfig {
  projectId: string
  bucketName: string
}

const firestoreConstructorCalls: MockFirestoreConfig[] = []
const gcsConstructorCalls: MockGCSConfig[] = []

// Mock the GCP provider modules to avoid actual GCP connections
vi.mock('../FirestoreSnapshotStorage.js', () => {
  return {
    FirestoreSnapshotStorage: class MockFirestoreSnapshotStorage {
      _mockType = 'FirestoreSnapshotStorage'
      _config: MockFirestoreConfig

      constructor(config: MockFirestoreConfig) {
        this._config = config
        firestoreConstructorCalls.push(config)
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
// Fast-Check Generators
// ============================================================================

/**
 * Generator for valid "local" provider values
 * Includes various case variations and whitespace
 */
const generateLocalProviderValue = (): fc.Arbitrary<string> =>
  fc.oneof(
    fc.constant('local'),
    fc.constant('LOCAL'),
    fc.constant('Local'),
    fc.constant('lOcAl'),
    fc.constant('  local  '),
    fc.constant('LOCAL  '),
    fc.constant('  Local')
  )

/**
 * Generator for valid "gcp" provider values
 * Includes various case variations and whitespace
 */
const generateGCPProviderValue = (): fc.Arbitrary<string> =>
  fc.oneof(
    fc.constant('gcp'),
    fc.constant('GCP'),
    fc.constant('Gcp'),
    fc.constant('gCp'),
    fc.constant('  gcp  '),
    fc.constant('GCP  '),
    fc.constant('  Gcp')
  )

/**
 * Generator for values that should default to local
 * Includes empty strings, whitespace, and invalid values
 */
const generateDefaultToLocalValue = (): fc.Arbitrary<string | undefined> =>
  fc.oneof(
    fc.constant(undefined),
    fc.constant(''),
    fc.constant('   '),
    fc.constant('invalid'),
    fc.constant('aws'),
    fc.constant('azure'),
    fc.constant('filesystem'),
    fc.constant('cloud'),
    fc.constant('gcp-local'),
    fc.constant('local-gcp'),
    // Random alphanumeric strings that aren't 'local' or 'gcp'
    fc
      .string({ minLength: 1, maxLength: 10 })
      .filter(
        s =>
          s.trim().toLowerCase() !== 'local' && s.trim().toLowerCase() !== 'gcp'
      )
  )

/**
 * Generator for valid GCP project IDs
 */
const generateProjectId = (): fc.Arbitrary<string> =>
  fc.oneof(
    fc.constant('test-project'),
    fc.constant('my-gcp-project'),
    fc.constant('production-project-123'),
    fc
      .string({ minLength: 6, maxLength: 30 })
      .filter(s => /^[a-z][a-z0-9-]*[a-z0-9]$/.test(s))
  )

/**
 * Generator for valid GCS bucket names
 */
const generateBucketName = (): fc.Arbitrary<string> =>
  fc.oneof(
    fc.constant('test-bucket'),
    fc.constant('my-csv-bucket'),
    fc.constant('production-bucket-123'),
    fc
      .string({ minLength: 3, maxLength: 30 })
      .filter(s => /^[a-z][a-z0-9-]*[a-z0-9]$/.test(s))
  )

// ============================================================================
// Test Suite
// ============================================================================

describe('Storage Provider Selection Property Tests', () => {
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
    firestoreConstructorCalls.length = 0
    gcsConstructorCalls.length = 0
  })

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv as typeof process.env
  })

  // ============================================================================
  // Property 1: Storage Provider Selection
  // ============================================================================

  describe('Property 1: Storage Provider Selection', () => {
    /**
     * Property 1a: STORAGE_PROVIDER=local uses LocalSnapshotStorage
     *
     * For any valid "local" provider value (case-insensitive, with whitespace),
     * the factory SHALL return LocalSnapshotStorage.
     *
     * **Validates: Requirement 1.2**
     */
    it(
      'Property 1a: STORAGE_PROVIDER=local (any case/whitespace) uses LocalSnapshotStorage',
      async () => {
        await fc.assert(
          fc.asyncProperty(
            generateLocalProviderValue(),
            async providerValue => {
              // Reset tracking
              firestoreConstructorCalls.length = 0
              gcsConstructorCalls.length = 0

              // Set environment
              process.env['STORAGE_PROVIDER'] = providerValue

              // Create providers
              const result = StorageProviderFactory.createFromEnvironment()

              // Verify LocalSnapshotStorage is used
              expect(result.snapshotStorage).toBeInstanceOf(
                LocalSnapshotStorage
              )
              expect(result.rawCSVStorage).toBeInstanceOf(LocalRawCSVStorage)

              // Verify GCP providers were NOT created
              expect(firestoreConstructorCalls).toHaveLength(0)
              expect(gcsConstructorCalls).toHaveLength(0)

              return true
            }
          ),
          { numRuns: PROPERTY_TEST_ITERATIONS }
        )
      },
      PROPERTY_TEST_TIMEOUT
    )

    /**
     * Property 1b: STORAGE_PROVIDER=gcp uses FirestoreSnapshotStorage
     *
     * For any valid "gcp" provider value (case-insensitive, with whitespace),
     * when valid GCP configuration is provided, the factory SHALL return
     * FirestoreSnapshotStorage.
     *
     * **Validates: Requirement 1.1**
     */
    it(
      'Property 1b: STORAGE_PROVIDER=gcp (any case/whitespace) uses FirestoreSnapshotStorage',
      async () => {
        await fc.assert(
          fc.asyncProperty(
            generateGCPProviderValue(),
            generateProjectId(),
            generateBucketName(),
            async (providerValue, projectId, bucketName) => {
              // Reset tracking
              firestoreConstructorCalls.length = 0
              gcsConstructorCalls.length = 0

              // Set environment
              process.env['STORAGE_PROVIDER'] = providerValue
              process.env['GCP_PROJECT_ID'] = projectId
              process.env['GCS_BUCKET_NAME'] = bucketName

              // Create providers
              const result = StorageProviderFactory.createFromEnvironment()

              // Verify FirestoreSnapshotStorage is used (via mock)
              expect(firestoreConstructorCalls).toHaveLength(1)
              expect(firestoreConstructorCalls[0]?.projectId).toBe(projectId)

              // Verify GCSRawCSVStorage is used (via mock)
              expect(gcsConstructorCalls).toHaveLength(1)
              expect(gcsConstructorCalls[0]?.projectId).toBe(projectId)
              expect(gcsConstructorCalls[0]?.bucketName).toBe(bucketName)

              // Verify the mock types
              expect(
                (result.snapshotStorage as unknown as { _mockType: string })
                  ._mockType
              ).toBe('FirestoreSnapshotStorage')
              expect(
                (result.rawCSVStorage as unknown as { _mockType: string })
                  ._mockType
              ).toBe('GCSRawCSVStorage')

              return true
            }
          ),
          { numRuns: PROPERTY_TEST_ITERATIONS }
        )
      },
      PROPERTY_TEST_TIMEOUT
    )

    /**
     * Property 1c: Unset or invalid STORAGE_PROVIDER defaults to local
     *
     * For any value that is not "local" or "gcp" (including undefined, empty,
     * whitespace-only, or invalid strings), the factory SHALL default to
     * LocalSnapshotStorage.
     *
     * **Validates: Requirement 1.2**
     */
    it(
      'Property 1c: Unset or invalid STORAGE_PROVIDER defaults to LocalSnapshotStorage',
      async () => {
        await fc.assert(
          fc.asyncProperty(
            generateDefaultToLocalValue(),
            async providerValue => {
              // Reset tracking
              firestoreConstructorCalls.length = 0
              gcsConstructorCalls.length = 0

              // Set environment (or leave unset)
              if (providerValue !== undefined) {
                process.env['STORAGE_PROVIDER'] = providerValue
              } else {
                delete process.env['STORAGE_PROVIDER']
              }

              // Create providers
              const result = StorageProviderFactory.createFromEnvironment()

              // Verify LocalSnapshotStorage is used
              expect(result.snapshotStorage).toBeInstanceOf(
                LocalSnapshotStorage
              )
              expect(result.rawCSVStorage).toBeInstanceOf(LocalRawCSVStorage)

              // Verify GCP providers were NOT created
              expect(firestoreConstructorCalls).toHaveLength(0)
              expect(gcsConstructorCalls).toHaveLength(0)

              return true
            }
          ),
          { numRuns: PROPERTY_TEST_ITERATIONS }
        )
      },
      PROPERTY_TEST_TIMEOUT
    )

    /**
     * Property 1d: Provider selection is deterministic
     *
     * For any given STORAGE_PROVIDER value, calling createFromEnvironment()
     * multiple times SHALL always return the same type of storage provider.
     *
     * **Validates: Requirements 1.1, 1.2**
     */
    it(
      'Property 1d: Provider selection is deterministic across multiple calls',
      async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.oneof(
              generateLocalProviderValue(),
              generateGCPProviderValue(),
              generateDefaultToLocalValue().filter(
                v => v !== undefined
              ) as fc.Arbitrary<string>
            ),
            async providerValue => {
              // Reset tracking
              firestoreConstructorCalls.length = 0
              gcsConstructorCalls.length = 0

              // Set environment
              process.env['STORAGE_PROVIDER'] = providerValue

              // For GCP, we need valid config
              const isGCP = providerValue.trim().toLowerCase() === 'gcp'
              if (isGCP) {
                process.env['GCP_PROJECT_ID'] = 'test-project'
                process.env['GCS_BUCKET_NAME'] = 'test-bucket'
              }

              // Create providers multiple times
              const result1 = StorageProviderFactory.createFromEnvironment()

              // Reset tracking for second call
              const firstFirestoreCalls = firestoreConstructorCalls.length
              const firstGCSCalls = gcsConstructorCalls.length

              const result2 = StorageProviderFactory.createFromEnvironment()

              // Verify same type is returned
              if (isGCP) {
                expect(
                  (result1.snapshotStorage as unknown as { _mockType: string })
                    ._mockType
                ).toBe('FirestoreSnapshotStorage')
                expect(
                  (result2.snapshotStorage as unknown as { _mockType: string })
                    ._mockType
                ).toBe('FirestoreSnapshotStorage')
                // Verify constructors were called for both
                expect(firestoreConstructorCalls.length).toBe(
                  firstFirestoreCalls + 1
                )
                expect(gcsConstructorCalls.length).toBe(firstGCSCalls + 1)
              } else {
                expect(result1.snapshotStorage).toBeInstanceOf(
                  LocalSnapshotStorage
                )
                expect(result2.snapshotStorage).toBeInstanceOf(
                  LocalSnapshotStorage
                )
                // Verify GCP constructors were NOT called
                expect(firestoreConstructorCalls.length).toBe(0)
                expect(gcsConstructorCalls.length).toBe(0)
              }

              return true
            }
          ),
          { numRuns: PROPERTY_TEST_ITERATIONS }
        )
      },
      PROPERTY_TEST_TIMEOUT
    )
  })

  // ============================================================================
  // Integration Tests (Non-Property)
  // ============================================================================

  describe('Integration Tests for Storage Provider Selection', () => {
    /**
     * Integration test: Verify STORAGE_PROVIDER=local uses LocalSnapshotStorage
     *
     * **Validates: Requirement 1.2**
     */
    it('should use LocalSnapshotStorage when STORAGE_PROVIDER=local', () => {
      process.env['STORAGE_PROVIDER'] = 'local'

      const result = StorageProviderFactory.createFromEnvironment()

      expect(result.snapshotStorage).toBeInstanceOf(LocalSnapshotStorage)
      expect(result.rawCSVStorage).toBeInstanceOf(LocalRawCSVStorage)
      expect(firestoreConstructorCalls).toHaveLength(0)
      expect(gcsConstructorCalls).toHaveLength(0)
    })

    /**
     * Integration test: Verify STORAGE_PROVIDER=gcp uses FirestoreSnapshotStorage
     *
     * **Validates: Requirement 1.1**
     */
    it('should use FirestoreSnapshotStorage when STORAGE_PROVIDER=gcp', () => {
      process.env['STORAGE_PROVIDER'] = 'gcp'
      process.env['GCP_PROJECT_ID'] = 'test-project'
      process.env['GCS_BUCKET_NAME'] = 'test-bucket'

      const result = StorageProviderFactory.createFromEnvironment()

      expect(firestoreConstructorCalls).toHaveLength(1)
      expect(gcsConstructorCalls).toHaveLength(1)
      expect(
        (result.snapshotStorage as unknown as { _mockType: string })._mockType
      ).toBe('FirestoreSnapshotStorage')
      expect(
        (result.rawCSVStorage as unknown as { _mockType: string })._mockType
      ).toBe('GCSRawCSVStorage')
    })

    /**
     * Integration test: Verify unset STORAGE_PROVIDER defaults to local
     *
     * **Validates: Requirement 1.2**
     */
    it('should default to LocalSnapshotStorage when STORAGE_PROVIDER is unset', () => {
      // STORAGE_PROVIDER is not set (deleted in beforeEach)

      const result = StorageProviderFactory.createFromEnvironment()

      expect(result.snapshotStorage).toBeInstanceOf(LocalSnapshotStorage)
      expect(result.rawCSVStorage).toBeInstanceOf(LocalRawCSVStorage)
      expect(firestoreConstructorCalls).toHaveLength(0)
      expect(gcsConstructorCalls).toHaveLength(0)
    })

    /**
     * Integration test: Verify empty STORAGE_PROVIDER defaults to local
     *
     * **Validates: Requirement 1.2**
     */
    it('should default to LocalSnapshotStorage when STORAGE_PROVIDER is empty', () => {
      process.env['STORAGE_PROVIDER'] = ''

      const result = StorageProviderFactory.createFromEnvironment()

      expect(result.snapshotStorage).toBeInstanceOf(LocalSnapshotStorage)
      expect(result.rawCSVStorage).toBeInstanceOf(LocalRawCSVStorage)
    })

    /**
     * Integration test: Verify whitespace-only STORAGE_PROVIDER defaults to local
     *
     * **Validates: Requirement 1.2**
     */
    it('should default to LocalSnapshotStorage when STORAGE_PROVIDER is whitespace', () => {
      process.env['STORAGE_PROVIDER'] = '   '

      const result = StorageProviderFactory.createFromEnvironment()

      expect(result.snapshotStorage).toBeInstanceOf(LocalSnapshotStorage)
      expect(result.rawCSVStorage).toBeInstanceOf(LocalRawCSVStorage)
    })
  })
})
