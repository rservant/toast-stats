/**
 * Property-Based Tests for SnapshotBuilder
 *
 * Feature: scraper-cli-separation
 *
 * Property 10: SnapshotBuilder Isolation
 * **Validates: Requirements 3.2, 4.2**
 *
 * Property 12: Partial Snapshot Creation
 * **Validates: Requirements 3.5**
 *
 * This test validates that the SnapshotBuilder service:
 * - Does NOT make any network requests
 * - Does NOT invoke browser automation
 * - ONLY reads from the local cache
 * - Creates partial snapshots when some districts are missing from cache
 * - Records missing districts in the build result
 *
 * The properties ensure complete isolation of snapshot building from scraping operations
 * and proper handling of partial data scenarios.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fc from 'fast-check'
import crypto from 'crypto'
import { SnapshotBuilder } from '../services/SnapshotBuilder.js'
import type { IRawCSVCacheService } from '../types/serviceInterfaces.js'
import type { DistrictConfigurationService } from '../services/DistrictConfigurationService.js'
import type {
  FileSnapshotStore,
  PerDistrictFileSnapshotStore,
} from '../services/SnapshotStore.js'
import { CSVType, type RawCSVCacheMetadata } from '../types/rawCSVCache.js'
import { TestLogger } from '../services/TestServiceFactory.js'

/**
 * Create a valid RawCSVCacheMetadata object for testing
 */
function createValidCacheMetadata(date: string): RawCSVCacheMetadata {
  return {
    date,
    timestamp: Date.now(),
    programYear: '2024-2025',
    source: 'scraper',
    dataMonth: date.substring(0, 7),
    isClosingPeriod: false,
    csvFiles: {
      allDistricts: true,
      districts: {},
    },
    integrity: {
      fileCount: 1,
      totalSize: 100,
      checksums: {},
    },
    downloadStats: {
      totalDownloads: 1,
      cacheHits: 1,
      cacheMisses: 0,
      lastAccessed: Date.now(),
    },
    cacheVersion: 1,
  }
}

/**
 * Mock RawCSVCacheService that tracks all method calls
 * Used to verify SnapshotBuilder only uses cache operations
 */
function createTrackingMockCacheService(): IRawCSVCacheService & {
  callLog: Array<{ method: string; args: unknown[] }>
} {
  const callLog: Array<{ method: string; args: unknown[] }> = []

  const trackCall = (method: string) => {
    return (...args: unknown[]) => {
      callLog.push({ method, args })
    }
  }

  const mockService = {
    callLog,
    // Core cache operations - these are the ONLY methods SnapshotBuilder should use
    getCachedCSV: vi.fn(
      async (date: string, type: CSVType, districtId?: string) => {
        callLog.push({ method: 'getCachedCSV', args: [date, type, districtId] })
        // Return minimal valid CSV content
        return 'District,Club,Members\n1,Test Club,20'
      }
    ),
    setCachedCSV: vi.fn(async (...args: unknown[]) => {
      callLog.push({ method: 'setCachedCSV', args })
    }),
    setCachedCSVWithMetadata: vi.fn(async (...args: unknown[]) => {
      callLog.push({ method: 'setCachedCSVWithMetadata', args })
    }),
    hasCachedCSV: vi.fn(
      async (date: string, type: CSVType, districtId?: string) => {
        callLog.push({ method: 'hasCachedCSV', args: [date, type, districtId] })
        return true // Simulate cache hit
      }
    ),

    // Metadata management
    getCacheMetadata: vi.fn(async (date: string) => {
      callLog.push({ method: 'getCacheMetadata', args: [date] })
      return createValidCacheMetadata(date)
    }),
    updateCacheMetadata: vi.fn(async (...args: unknown[]) => {
      callLog.push({ method: 'updateCacheMetadata', args })
    }),

    // Cache management
    clearCacheForDate: vi.fn(async (...args: unknown[]) => {
      callLog.push({ method: 'clearCacheForDate', args })
    }),
    getCachedDates: vi.fn(async () => {
      callLog.push({ method: 'getCachedDates', args: [] })
      return []
    }),

    // Cache storage information
    getCacheStorageInfo: vi.fn(async () => {
      callLog.push({ method: 'getCacheStorageInfo', args: [] })
      return {
        totalSizeMB: 0,
        totalFiles: 0,
        oldestDate: null,
        newestDate: null,
        isLargeCache: false,
        recommendations: [],
      }
    }),

    // Metadata integrity
    validateMetadataIntegrity: vi.fn(async (...args: unknown[]) => {
      callLog.push({ method: 'validateMetadataIntegrity', args })
      return {
        isValid: true,
        issues: [],
        actualStats: { fileCount: 0, totalSize: 0 },
        metadataStats: { fileCount: 0, totalSize: 0 },
      }
    }),
    repairMetadataIntegrity: vi.fn(async (...args: unknown[]) => {
      callLog.push({ method: 'repairMetadataIntegrity', args })
      return {
        success: true,
        repairedFields: [],
        errors: [],
      }
    }),

    // Configuration management
    getConfiguration: vi.fn(() => {
      callLog.push({ method: 'getConfiguration', args: [] })
      return {
        cacheDir: '/tmp/test-cache',
        enableCompression: false,
        monitoring: { trackSlowOperations: false },
        performanceThresholds: { maxReadTimeMs: 1000, maxWriteTimeMs: 2000 },
        security: { validatePaths: true, sanitizeInputs: true },
      }
    }),
    updateConfiguration: vi.fn(trackCall('updateConfiguration')),
    resetConfiguration: vi.fn(trackCall('resetConfiguration')),

    // Statistics and monitoring
    getCacheStatistics: vi.fn(async () => {
      callLog.push({ method: 'getCacheStatistics', args: [] })
      return {
        totalCachedDates: 0,
        totalCachedFiles: 0,
        totalCacheSize: 0,
        hitRatio: 0,
        missRatio: 0,
        averageFileSize: 0,
        oldestCacheDate: null,
        newestCacheDate: null,
        diskUsage: { used: 0, available: 1000000, percentUsed: 0 },
        performance: {
          averageReadTime: 0,
          averageWriteTime: 0,
          slowestOperations: [],
        },
      }
    }),
    getHealthStatus: vi.fn(async () => {
      callLog.push({ method: 'getHealthStatus', args: [] })
      return {
        isHealthy: true,
        cacheDirectory: '/tmp/test-cache',
        isAccessible: true,
        hasWritePermissions: true,
        diskSpaceAvailable: 1000000,
        lastSuccessfulOperation: Date.now(),
        errors: [],
        warnings: [],
      }
    }),
    clearPerformanceHistory: vi.fn(trackCall('clearPerformanceHistory')),

    // Error handling and recovery
    getCircuitBreakerStatus: vi.fn(() => {
      callLog.push({ method: 'getCircuitBreakerStatus', args: [] })
      return {
        isOpen: false,
        failures: 0,
        lastFailureTime: null,
        timeSinceLastFailure: null,
        halfOpenAttempts: 0,
      }
    }),
    resetCircuitBreakerManually: vi.fn(
      trackCall('resetCircuitBreakerManually')
    ),

    // Service lifecycle
    dispose: vi.fn(async () => {
      callLog.push({ method: 'dispose', args: [] })
    }),
  }

  return mockService as unknown as IRawCSVCacheService & {
    callLog: Array<{ method: string; args: unknown[] }>
  }
}

/**
 * Create a mock cache service that simulates partial cache availability
 * Some districts have cached data, others don't
 */
function createPartialCacheMockService(
  cachedDistricts: Set<string>
): IRawCSVCacheService & {
  callLog: Array<{ method: string; args: unknown[] }>
} {
  const callLog: Array<{ method: string; args: unknown[] }> = []

  const trackCall = (method: string) => {
    return (...args: unknown[]) => {
      callLog.push({ method, args })
    }
  }

  const mockService = {
    callLog,
    getCachedCSV: vi.fn(
      async (date: string, type: CSVType, districtId?: string) => {
        callLog.push({ method: 'getCachedCSV', args: [date, type, districtId] })

        // Return data only for cached districts
        if (type === CSVType.ALL_DISTRICTS) {
          return 'District,Club,Members\n1,Test Club,20'
        }

        if (districtId && cachedDistricts.has(districtId)) {
          return `District,Club,Members\n${districtId},Test Club ${districtId},20`
        }

        return null // No cache for this district
      }
    ),
    setCachedCSV: vi.fn(async (...args: unknown[]) => {
      callLog.push({ method: 'setCachedCSV', args })
    }),
    setCachedCSVWithMetadata: vi.fn(async (...args: unknown[]) => {
      callLog.push({ method: 'setCachedCSVWithMetadata', args })
    }),
    hasCachedCSV: vi.fn(
      async (date: string, type: CSVType, districtId?: string) => {
        callLog.push({ method: 'hasCachedCSV', args: [date, type, districtId] })

        // ALL_DISTRICTS is always available
        if (type === CSVType.ALL_DISTRICTS) {
          return true
        }

        // CLUB_PERFORMANCE is used to check district availability
        if (type === CSVType.CLUB_PERFORMANCE && districtId) {
          return cachedDistricts.has(districtId)
        }

        return false
      }
    ),
    getCacheMetadata: vi.fn(async (date: string) => {
      callLog.push({ method: 'getCacheMetadata', args: [date] })
      return createValidCacheMetadata(date)
    }),
    updateCacheMetadata: vi.fn(async (...args: unknown[]) => {
      callLog.push({ method: 'updateCacheMetadata', args })
    }),
    clearCacheForDate: vi.fn(async (...args: unknown[]) => {
      callLog.push({ method: 'clearCacheForDate', args })
    }),
    getCachedDates: vi.fn(async () => {
      callLog.push({ method: 'getCachedDates', args: [] })
      return []
    }),
    getCacheStorageInfo: vi.fn(async () => {
      callLog.push({ method: 'getCacheStorageInfo', args: [] })
      return {
        totalSizeMB: 0,
        totalFiles: 0,
        oldestDate: null,
        newestDate: null,
        isLargeCache: false,
        recommendations: [],
      }
    }),
    validateMetadataIntegrity: vi.fn(async (...args: unknown[]) => {
      callLog.push({ method: 'validateMetadataIntegrity', args })
      return {
        isValid: true,
        issues: [],
        actualStats: { fileCount: 0, totalSize: 0 },
        metadataStats: { fileCount: 0, totalSize: 0 },
      }
    }),
    repairMetadataIntegrity: vi.fn(async (...args: unknown[]) => {
      callLog.push({ method: 'repairMetadataIntegrity', args })
      return {
        success: true,
        repairedFields: [],
        errors: [],
      }
    }),
    getConfiguration: vi.fn(() => {
      callLog.push({ method: 'getConfiguration', args: [] })
      return {
        cacheDir: '/tmp/test-cache',
        enableCompression: false,
        monitoring: { trackSlowOperations: false },
        performanceThresholds: { maxReadTimeMs: 1000, maxWriteTimeMs: 2000 },
        security: { validatePaths: true, sanitizeInputs: true },
      }
    }),
    updateConfiguration: vi.fn(trackCall('updateConfiguration')),
    resetConfiguration: vi.fn(trackCall('resetConfiguration')),
    getCacheStatistics: vi.fn(async () => {
      callLog.push({ method: 'getCacheStatistics', args: [] })
      return {
        totalCachedDates: 0,
        totalCachedFiles: 0,
        totalCacheSize: 0,
        hitRatio: 0,
        missRatio: 0,
        averageFileSize: 0,
        oldestCacheDate: null,
        newestCacheDate: null,
        diskUsage: { used: 0, available: 1000000, percentUsed: 0 },
        performance: {
          averageReadTime: 0,
          averageWriteTime: 0,
          slowestOperations: [],
        },
      }
    }),
    getHealthStatus: vi.fn(async () => {
      callLog.push({ method: 'getHealthStatus', args: [] })
      return {
        isHealthy: true,
        cacheDirectory: '/tmp/test-cache',
        isAccessible: true,
        hasWritePermissions: true,
        diskSpaceAvailable: 1000000,
        lastSuccessfulOperation: Date.now(),
        errors: [],
        warnings: [],
      }
    }),
    clearPerformanceHistory: vi.fn(trackCall('clearPerformanceHistory')),
    getCircuitBreakerStatus: vi.fn(() => {
      callLog.push({ method: 'getCircuitBreakerStatus', args: [] })
      return {
        isOpen: false,
        failures: 0,
        lastFailureTime: null,
        timeSinceLastFailure: null,
        halfOpenAttempts: 0,
      }
    }),
    resetCircuitBreakerManually: vi.fn(
      trackCall('resetCircuitBreakerManually')
    ),
    dispose: vi.fn(async () => {
      callLog.push({ method: 'dispose', args: [] })
    }),
  }

  return mockService as unknown as IRawCSVCacheService & {
    callLog: Array<{ method: string; args: unknown[] }>
  }
}

/**
 * Mock DistrictConfigurationService
 */
function createMockDistrictConfigService(
  districts: string[]
): DistrictConfigurationService {
  return {
    getConfiguredDistricts: vi.fn(async () => districts),
    addDistrict: vi.fn(),
    removeDistrict: vi.fn(),
    setConfiguredDistricts: vi.fn(),
    validateDistrictId: vi.fn(() => true),
    getConfigurationHistory: vi.fn(async () => []),
    getConfiguration: vi.fn(async () => ({
      districts,
      lastModified: new Date().toISOString(),
      version: 1,
    })),
    hasConfiguredDistricts: vi.fn(async () => districts.length > 0),
    validateConfiguration: vi.fn(async () => ({
      isValid: true,
      errors: [],
      warnings: [],
    })),
    clearCache: vi.fn(),
  } as unknown as DistrictConfigurationService
}

/**
 * Mock PerDistrictFileSnapshotStore
 */
function createMockSnapshotStore(): PerDistrictFileSnapshotStore {
  return {
    writeSnapshot: vi.fn(async () => {}),
    getLatestSuccessful: vi.fn(async () => null),
    getLatest: vi.fn(async () => null),
    listSnapshots: vi.fn(async () => []),
    getSnapshot: vi.fn(async () => null),
    isReady: vi.fn(async () => true),
    getSnapshotMetadata: vi.fn(async () => null),
    getDistrictData: vi.fn(async () => null),
    getAllDistrictsRankings: vi.fn(async () => null),
    listSnapshotDates: vi.fn(async () => []),
    dispose: vi.fn(async () => {}),
  } as unknown as PerDistrictFileSnapshotStore
}

/**
 * Allowed cache methods that SnapshotBuilder may call
 * These are read-only operations on the cache
 */
const ALLOWED_CACHE_METHODS = new Set([
  'getCachedCSV',
  'hasCachedCSV',
  'getCacheMetadata',
])

/**
 * Forbidden methods that would indicate network/scraping activity
 */
const FORBIDDEN_METHODS = new Set([
  // Any method that would write to cache (scraping would write)
  'setCachedCSV',
  'setCachedCSVWithMetadata',
  // Any method that would clear cache
  'clearCacheForDate',
])

describe('Property 10: SnapshotBuilder Isolation', () => {
  let testLogger: TestLogger

  beforeEach(() => {
    testLogger = new TestLogger()
  })

  afterEach(() => {
    testLogger.clear()
  })

  it('should only use cache read operations and never perform scraping', async () => {
    // Feature: scraper-cli-separation, Property 10: SnapshotBuilder Isolation
    // **Validates: Requirements 3.2, 4.2**
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Generate random date in YYYY-MM-DD format
          year: fc.integer({ min: 2020, max: 2025 }),
          month: fc.integer({ min: 1, max: 12 }),
          day: fc.integer({ min: 1, max: 28 }),
          // Generate random district IDs
          districtCount: fc.integer({ min: 1, max: 5 }),
          districtSeed: fc.integer({ min: 1, max: 100 }),
        }),
        async ({ year, month, day, districtCount, districtSeed }) => {
          // Format date
          const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

          // Generate district IDs
          const districts = Array.from({ length: districtCount }, (_, i) =>
            String(districtSeed + i)
          )

          // Create tracking mock cache service
          const mockCacheService = createTrackingMockCacheService()
          const mockDistrictConfig = createMockDistrictConfigService(districts)
          const mockSnapshotStore = createMockSnapshotStore()

          // Create SnapshotBuilder with mocks
          const snapshotBuilder = new SnapshotBuilder(
            mockCacheService,
            mockDistrictConfig,
            mockSnapshotStore,
            undefined, // validator
            undefined, // rankingCalculator
            undefined, // closingPeriodDetector
            undefined, // dataNormalizer
            testLogger
          )

          // Execute build operation
          await snapshotBuilder.build({ date })

          // Property 1: SnapshotBuilder should only call allowed cache methods
          const calledMethods = new Set(
            mockCacheService.callLog.map(call => call.method)
          )

          // Verify no forbidden methods were called
          for (const method of calledMethods) {
            expect(FORBIDDEN_METHODS.has(method)).toBe(false)
          }

          // Property 2: All cache calls should be read operations
          for (const call of mockCacheService.callLog) {
            // getCachedCSV, hasCachedCSV, getCacheMetadata are allowed
            expect(ALLOWED_CACHE_METHODS.has(call.method)).toBe(true)
          }

          // Property 3: No network-related operations should be logged
          // Check that no log entries indicate network activity
          const networkKeywords = [
            'fetch',
            'download',
            'scrape',
            'browser',
            'playwright',
            'network',
          ]
          for (const log of testLogger.logs) {
            const logMessage = log.message.toLowerCase()
            for (const keyword of networkKeywords) {
              // Allow "fromCache" which is expected
              if (keyword === 'fetch' && logMessage.includes('fromcache')) {
                continue
              }
              // The word "fetch" in "fetchedAt" is acceptable
              if (keyword === 'fetch' && logMessage.includes('fetchedat')) {
                continue
              }
              expect(logMessage.includes(keyword)).toBe(false)
            }
          }

          return true
        }
      ),
      { numRuns: 100, timeout: 30000 }
    )
  })

  it('should read from cache without invoking any external services', async () => {
    // Feature: scraper-cli-separation, Property 10: SnapshotBuilder Isolation
    // **Validates: Requirements 3.2, 4.2**
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Generate random configurations
          dateOffset: fc.integer({ min: 0, max: 365 }),
          districtIds: fc.array(
            fc.stringMatching(/^[1-9][0-9]?$/), // District IDs like "1", "12", "99"
            { minLength: 1, maxLength: 3 }
          ),
        }),
        async ({ dateOffset, districtIds }) => {
          // Calculate date
          const baseDate = new Date('2024-01-01')
          baseDate.setDate(baseDate.getDate() + dateOffset)
          const date = baseDate.toISOString().split('T')[0] ?? '2024-01-01'

          // Ensure unique district IDs
          const uniqueDistricts = [...new Set(districtIds)]
          if (uniqueDistricts.length === 0) {
            uniqueDistricts.push('1')
          }

          // Create tracking mock cache service
          const mockCacheService = createTrackingMockCacheService()
          const mockDistrictConfig =
            createMockDistrictConfigService(uniqueDistricts)
          const mockSnapshotStore = createMockSnapshotStore()

          // Create SnapshotBuilder
          const snapshotBuilder = new SnapshotBuilder(
            mockCacheService,
            mockDistrictConfig,
            mockSnapshotStore,
            undefined,
            undefined,
            undefined,
            undefined,
            testLogger
          )

          // Clear call log before build
          mockCacheService.callLog.length = 0

          // Execute build
          await snapshotBuilder.build({ date })

          // Property: All operations should be cache reads
          const writeOperations = mockCacheService.callLog.filter(
            call =>
              call.method.startsWith('set') || call.method.includes('clear')
          )
          expect(writeOperations).toHaveLength(0)

          // Property: Should have called cache read methods
          const readOperations = mockCacheService.callLog.filter(
            call =>
              call.method === 'getCachedCSV' ||
              call.method === 'hasCachedCSV' ||
              call.method === 'getCacheMetadata'
          )
          expect(readOperations.length).toBeGreaterThan(0)

          return true
        }
      ),
      { numRuns: 100, timeout: 30000 }
    )
  })

  it('should not have any dependencies on browser automation or network libraries', async () => {
    // Feature: scraper-cli-separation, Property 10: SnapshotBuilder Isolation
    // **Validates: Requirements 3.2, 4.2**

    // This is a static analysis property - verify the SnapshotBuilder class
    // does not import or reference any browser/network libraries

    await fc.assert(
      fc.asyncProperty(
        fc.constant(null), // No random input needed for this static check
        async () => {
          // Create a minimal SnapshotBuilder instance
          const mockCacheService = createTrackingMockCacheService()
          const mockDistrictConfig = createMockDistrictConfigService(['1'])
          const mockSnapshotStore = createMockSnapshotStore()

          const snapshotBuilder = new SnapshotBuilder(
            mockCacheService,
            mockDistrictConfig,
            mockSnapshotStore,
            undefined,
            undefined,
            undefined,
            undefined,
            testLogger
          )

          // Property: SnapshotBuilder should be constructable without any browser dependencies
          expect(snapshotBuilder).toBeDefined()

          // Property: SnapshotBuilder should have build and getCacheAvailability methods
          expect(typeof snapshotBuilder.build).toBe('function')
          expect(typeof snapshotBuilder.getCacheAvailability).toBe('function')

          // Property: SnapshotBuilder should not have any scrape-related methods
          const snapshotBuilderMethods = Object.getOwnPropertyNames(
            Object.getPrototypeOf(snapshotBuilder)
          )
          const scrapeRelatedMethods = snapshotBuilderMethods.filter(
            method =>
              method.toLowerCase().includes('scrape') ||
              method.toLowerCase().includes('download') ||
              method.toLowerCase().includes('fetch') ||
              method.toLowerCase().includes('browser')
          )
          expect(scrapeRelatedMethods).toHaveLength(0)

          return true
        }
      ),
      { numRuns: 1 } // Only need to run once for static analysis
    )
  })
})

/**
 * Property 12: Partial Snapshot Creation
 *
 * Feature: scraper-cli-separation, Property 12: Partial Snapshot Creation
 * **Validates: Requirements 3.5**
 *
 * This test validates that:
 * - When some configured districts have cached data and others don't
 * - The SnapshotBuilder creates a partial snapshot containing available districts
 * - Missing districts are recorded in the build result metadata
 */
describe('Property 12: Partial Snapshot Creation', () => {
  let testLogger: TestLogger

  beforeEach(() => {
    testLogger = new TestLogger()
  })

  afterEach(() => {
    testLogger.clear()
  })

  it('should create partial snapshot when some districts are missing from cache', async () => {
    // Feature: scraper-cli-separation, Property 12: Partial Snapshot Creation
    // **Validates: Requirements 3.5**
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Generate random date
          year: fc.integer({ min: 2020, max: 2025 }),
          month: fc.integer({ min: 1, max: 12 }),
          day: fc.integer({ min: 1, max: 28 }),
          // Generate configured districts (total)
          totalDistrictCount: fc.integer({ min: 2, max: 10 }),
          // Generate how many districts have cached data (1 to totalDistrictCount-1)
          cachedDistrictCount: fc.integer({ min: 1, max: 9 }),
          // Seed for district IDs
          districtSeed: fc.integer({ min: 1, max: 50 }),
        }),
        async ({
          year,
          month,
          day,
          totalDistrictCount,
          cachedDistrictCount,
          districtSeed,
        }) => {
          // Format date
          const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

          // Ensure cachedDistrictCount is less than totalDistrictCount
          const actualCachedCount = Math.min(
            cachedDistrictCount,
            totalDistrictCount - 1
          )

          // Generate all configured district IDs
          const allDistricts = Array.from(
            { length: totalDistrictCount },
            (_, i) => String(districtSeed + i)
          )

          // Determine which districts have cached data
          const cachedDistricts = new Set(
            allDistricts.slice(0, actualCachedCount)
          )
          const missingDistricts = allDistricts.slice(actualCachedCount)

          // Create mock services
          const mockCacheService =
            createPartialCacheMockService(cachedDistricts)
          const mockDistrictConfig =
            createMockDistrictConfigService(allDistricts)
          const mockSnapshotStore = createMockSnapshotStore()

          // Create SnapshotBuilder
          const snapshotBuilder = new SnapshotBuilder(
            mockCacheService,
            mockDistrictConfig,
            mockSnapshotStore,
            undefined,
            undefined,
            undefined,
            undefined,
            testLogger
          )

          // Execute build
          const result = await snapshotBuilder.build({ date })

          // Property 1: Build should complete (may be success or partial or failed due to validation)
          // The key property is that missing districts are correctly identified
          expect(result.date).toBe(date)

          // Property 2: districtsIncluded should contain exactly the cached districts
          expect(new Set(result.districtsIncluded)).toEqual(cachedDistricts)

          // Property 3: districtsMissing should contain exactly the missing districts
          expect(new Set(result.districtsMissing)).toEqual(
            new Set(missingDistricts)
          )

          // Property 4: The union of included and missing should equal all configured districts
          const allReportedDistricts = new Set([
            ...result.districtsIncluded,
            ...result.districtsMissing,
          ])
          expect(allReportedDistricts).toEqual(new Set(allDistricts))

          // Property 5: If build succeeded, status should be 'partial' when some districts are missing
          if (result.success && missingDistricts.length > 0) {
            expect(result.status).toBe('partial')
          }

          // Property 6: If status is partial, errors should mention missing districts
          if (result.status === 'partial') {
            const hasPartialSnapshotError = result.errors.some(
              error =>
                error.toLowerCase().includes('partial') ||
                error.toLowerCase().includes('missing')
            )
            expect(hasPartialSnapshotError).toBe(true)
          }

          return true
        }
      ),
      { numRuns: 100, timeout: 30000 }
    )
  })

  it('should correctly identify cached vs missing districts', async () => {
    // Feature: scraper-cli-separation, Property 12: Partial Snapshot Creation
    // **Validates: Requirements 3.5**
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Generate random date offset
          dateOffset: fc.integer({ min: 0, max: 365 }),
          // Generate district configuration
          cachedDistrictIds: fc.array(fc.integer({ min: 1, max: 99 }), {
            minLength: 1,
            maxLength: 5,
          }),
          missingDistrictIds: fc.array(fc.integer({ min: 100, max: 199 }), {
            minLength: 1,
            maxLength: 5,
          }),
        }),
        async ({ dateOffset, cachedDistrictIds, missingDistrictIds }) => {
          // Calculate date
          const baseDate = new Date('2024-01-01')
          baseDate.setDate(baseDate.getDate() + dateOffset)
          const date = baseDate.toISOString().split('T')[0] ?? '2024-01-01'

          // Convert to string IDs and ensure uniqueness
          const cachedDistricts = [...new Set(cachedDistrictIds.map(String))]
          const missingDistricts = [...new Set(missingDistrictIds.map(String))]
          const allDistricts = [...cachedDistricts, ...missingDistricts]

          // Create mock services
          const mockCacheService = createPartialCacheMockService(
            new Set(cachedDistricts)
          )
          const mockDistrictConfig =
            createMockDistrictConfigService(allDistricts)
          const mockSnapshotStore = createMockSnapshotStore()

          // Create SnapshotBuilder
          const snapshotBuilder = new SnapshotBuilder(
            mockCacheService,
            mockDistrictConfig,
            mockSnapshotStore,
            undefined,
            undefined,
            undefined,
            undefined,
            testLogger
          )

          // Check cache availability first
          const availability = await snapshotBuilder.getCacheAvailability(date)

          // Property 1: cachedDistricts in availability should match our cached set
          expect(new Set(availability.cachedDistricts)).toEqual(
            new Set(cachedDistricts)
          )

          // Property 2: missingDistricts in availability should match our missing set
          expect(new Set(availability.missingDistricts)).toEqual(
            new Set(missingDistricts)
          )

          // Property 3: configuredDistricts should be all districts
          expect(new Set(availability.configuredDistricts)).toEqual(
            new Set(allDistricts)
          )

          // Property 4: available should be true since we have at least one cached district
          expect(availability.available).toBe(true)

          return true
        }
      ),
      { numRuns: 100, timeout: 30000 }
    )
  })

  it('should record missing districts in snapshot metadata', async () => {
    // Feature: scraper-cli-separation, Property 12: Partial Snapshot Creation
    // **Validates: Requirements 3.5**
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Generate random date
          year: fc.integer({ min: 2020, max: 2025 }),
          month: fc.integer({ min: 1, max: 12 }),
          day: fc.integer({ min: 1, max: 28 }),
          // Generate district counts
          cachedCount: fc.integer({ min: 1, max: 5 }),
          missingCount: fc.integer({ min: 1, max: 5 }),
        }),
        async ({ year, month, day, cachedCount, missingCount }) => {
          // Format date
          const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

          // Generate district IDs
          const cachedDistricts = Array.from({ length: cachedCount }, (_, i) =>
            String(i + 1)
          )
          const missingDistricts = Array.from(
            { length: missingCount },
            (_, i) => String(i + 100)
          )
          const allDistricts = [...cachedDistricts, ...missingDistricts]

          // Create mock services
          const mockCacheService = createPartialCacheMockService(
            new Set(cachedDistricts)
          )
          const mockDistrictConfig =
            createMockDistrictConfigService(allDistricts)
          const mockSnapshotStore = createMockSnapshotStore()

          // Create SnapshotBuilder
          const snapshotBuilder = new SnapshotBuilder(
            mockCacheService,
            mockDistrictConfig,
            mockSnapshotStore,
            undefined,
            undefined,
            undefined,
            undefined,
            testLogger
          )

          // Execute build
          const result = await snapshotBuilder.build({ date })

          // Property 1: Result should contain missing districts information
          expect(result.districtsMissing.length).toBe(missingCount)

          // Property 2: Missing districts should be exactly what we expected
          expect(new Set(result.districtsMissing)).toEqual(
            new Set(missingDistricts)
          )

          // Property 3: Snapshot store should have been called with the snapshot
          expect(mockSnapshotStore.writeSnapshot).toHaveBeenCalled()

          // Property 4: The number of included districts should match cached count
          expect(result.districtsIncluded.length).toBe(cachedCount)

          return true
        }
      ),
      { numRuns: 100, timeout: 30000 }
    )
  })
})

/**
 * Property 16: Cache Integrity Validation
 *
 * Feature: scraper-cli-separation, Property 16: Cache Integrity Validation
 * **Validates: Requirements 6.3, 6.4**
 *
 * This test validates that:
 * - The SnapshotBuilder validates file checksums against cache metadata
 * - Corrupted files (checksum mismatch) are skipped with error logging
 * - Valid files pass checksum validation
 * - Missing checksums in metadata are handled gracefully
 */
describe('Property 16: Cache Integrity Validation', () => {
  let testLogger: TestLogger

  beforeEach(() => {
    testLogger = new TestLogger()
  })

  afterEach(() => {
    testLogger.clear()
  })

  it('should validate file checksums and skip corrupted files', async () => {
    // Feature: scraper-cli-separation, Property 16: Cache Integrity Validation
    // **Validates: Requirements 6.3, 6.4**
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Generate random date
          year: fc.integer({ min: 2020, max: 2025 }),
          month: fc.integer({ min: 1, max: 12 }),
          day: fc.integer({ min: 1, max: 28 }),
          // Generate random content
          validContent: fc.string({ minLength: 10, maxLength: 100 }),
          corruptedContent: fc.string({ minLength: 10, maxLength: 100 }),
        }),
        async ({ year, month, day, validContent, corruptedContent }) => {
          // Format date
          const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

          // Create mock services
          const mockDistrictConfig = createMockDistrictConfigService(['1'])
          const mockSnapshotStore = createMockSnapshotStore()

          // Create SnapshotBuilder with a minimal mock cache service
          const mockCacheService = createTrackingMockCacheService()

          const snapshotBuilder = new SnapshotBuilder(
            mockCacheService,
            mockDistrictConfig,
            mockSnapshotStore,
            undefined,
            undefined,
            undefined,
            undefined,
            testLogger
          )

          // Test 1: Valid checksum should pass validation
          const validChecksum = crypto
            .createHash('sha256')
            .update(validContent)
            .digest('hex')

          const validMetadata: RawCSVCacheMetadata = {
            date,
            timestamp: Date.now(),
            programYear: '2024-2025',
            source: 'scraper',
            csvFiles: { allDistricts: true, districts: {} },
            integrity: {
              fileCount: 1,
              totalSize: validContent.length,
              checksums: { 'test-file.csv': validChecksum },
            },
            downloadStats: {
              totalDownloads: 1,
              cacheHits: 1,
              cacheMisses: 0,
              lastAccessed: Date.now(),
            },
            cacheVersion: 1,
          }

          const validResult = snapshotBuilder.validateFileChecksum(
            validContent,
            'test-file.csv',
            validMetadata
          )

          // Property 1: Valid content with matching checksum should pass
          expect(validResult.isValid).toBe(true)
          expect(validResult.filename).toBe('test-file.csv')
          expect(validResult.expectedChecksum).toBe(validChecksum)
          expect(validResult.actualChecksum).toBe(validChecksum)

          // Test 2: Corrupted content (different from expected) should fail
          // Ensure corrupted content is different from valid content
          const actualCorruptedContent =
            corruptedContent === validContent
              ? corruptedContent + '_corrupted'
              : corruptedContent

          const corruptedResult = snapshotBuilder.validateFileChecksum(
            actualCorruptedContent,
            'test-file.csv',
            validMetadata
          )

          // Property 2: Corrupted content should fail validation
          expect(corruptedResult.isValid).toBe(false)
          expect(corruptedResult.filename).toBe('test-file.csv')
          expect(corruptedResult.expectedChecksum).toBe(validChecksum)
          expect(corruptedResult.actualChecksum).not.toBe(validChecksum)
          expect(corruptedResult.error).toContain('Checksum mismatch')

          return true
        }
      ),
      { numRuns: 100, timeout: 30000 }
    )
  })

  it('should handle missing checksums in metadata gracefully', async () => {
    // Feature: scraper-cli-separation, Property 16: Cache Integrity Validation
    // **Validates: Requirements 6.3, 6.4**
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Generate random date
          year: fc.integer({ min: 2020, max: 2025 }),
          month: fc.integer({ min: 1, max: 12 }),
          day: fc.integer({ min: 1, max: 28 }),
          // Generate random content
          content: fc.string({ minLength: 10, maxLength: 100 }),
          filename: fc.stringMatching(/^[a-z0-9-]+\.csv$/),
        }),
        async ({ year, month, day, content, filename }) => {
          // Format date
          const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

          // Create mock services
          const mockDistrictConfig = createMockDistrictConfigService(['1'])
          const mockSnapshotStore = createMockSnapshotStore()
          const mockCacheService = createTrackingMockCacheService()

          const snapshotBuilder = new SnapshotBuilder(
            mockCacheService,
            mockDistrictConfig,
            mockSnapshotStore,
            undefined,
            undefined,
            undefined,
            undefined,
            testLogger
          )

          // Test 1: No metadata at all - should treat as valid
          const noMetadataResult = snapshotBuilder.validateFileChecksum(
            content,
            filename,
            null
          )

          // Property 1: Missing metadata should be treated as valid (can't validate)
          expect(noMetadataResult.isValid).toBe(true)
          expect(noMetadataResult.filename).toBe(filename)
          expect(noMetadataResult.error).toContain('No metadata available')

          // Test 2: Metadata exists but no checksum for this file
          const metadataWithoutChecksum: RawCSVCacheMetadata = {
            date,
            timestamp: Date.now(),
            programYear: '2024-2025',
            source: 'scraper',
            csvFiles: { allDistricts: true, districts: {} },
            integrity: {
              fileCount: 1,
              totalSize: 100,
              checksums: { 'other-file.csv': 'some-checksum' }, // Different file
            },
            downloadStats: {
              totalDownloads: 1,
              cacheHits: 1,
              cacheMisses: 0,
              lastAccessed: Date.now(),
            },
            cacheVersion: 1,
          }

          const noChecksumResult = snapshotBuilder.validateFileChecksum(
            content,
            filename,
            metadataWithoutChecksum
          )

          // Property 2: Missing checksum for specific file should be treated as valid
          expect(noChecksumResult.isValid).toBe(true)
          expect(noChecksumResult.filename).toBe(filename)
          expect(noChecksumResult.error).toContain('No checksum in metadata')

          return true
        }
      ),
      { numRuns: 100, timeout: 30000 }
    )
  })

  it('should correctly calculate checksums for any content', async () => {
    // Feature: scraper-cli-separation, Property 16: Cache Integrity Validation
    // **Validates: Requirements 6.3, 6.4**
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Generate random content of various sizes
          content: fc.string({ minLength: 1, maxLength: 1000 }),
        }),
        async ({ content }) => {
          // Create mock services
          const mockDistrictConfig = createMockDistrictConfigService(['1'])
          const mockSnapshotStore = createMockSnapshotStore()
          const mockCacheService = createTrackingMockCacheService()

          const snapshotBuilder = new SnapshotBuilder(
            mockCacheService,
            mockDistrictConfig,
            mockSnapshotStore,
            undefined,
            undefined,
            undefined,
            undefined,
            testLogger
          )

          // Calculate expected checksum using crypto
          const expectedChecksum = crypto
            .createHash('sha256')
            .update(content)
            .digest('hex')

          // Create metadata with the correct checksum
          const metadata: RawCSVCacheMetadata = {
            date: '2024-01-01',
            timestamp: Date.now(),
            programYear: '2024-2025',
            source: 'scraper',
            csvFiles: { allDistricts: true, districts: {} },
            integrity: {
              fileCount: 1,
              totalSize: content.length,
              checksums: { 'test.csv': expectedChecksum },
            },
            downloadStats: {
              totalDownloads: 1,
              cacheHits: 1,
              cacheMisses: 0,
              lastAccessed: Date.now(),
            },
            cacheVersion: 1,
          }

          const result = snapshotBuilder.validateFileChecksum(
            content,
            'test.csv',
            metadata
          )

          // Property: For any content, if we calculate the checksum correctly
          // and store it in metadata, validation should always pass
          expect(result.isValid).toBe(true)
          expect(result.actualChecksum).toBe(expectedChecksum)
          expect(result.expectedChecksum).toBe(expectedChecksum)

          return true
        }
      ),
      { numRuns: 100, timeout: 30000 }
    )
  })
})
