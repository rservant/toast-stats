/**
 * Unit Tests for SnapshotBuilder Rankings Reading
 *
 * Feature: refresh-service-computation-removal
 *
 * Tests that the SnapshotBuilder no longer has computation dependencies
 * and that the constructor signature has been updated correctly.
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 *
 * Test Coverage:
 * - SnapshotBuilder no longer requires RankingCalculator
 * - SnapshotBuilder can be constructed without computation dependencies
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SnapshotBuilder } from '../SnapshotBuilder.js'
import type { IRawCSVStorage } from '../../types/storageInterfaces.js'
import type { DistrictConfigurationService } from '../DistrictConfigurationService.js'
import type { FileSnapshotStore } from '../SnapshotStore.js'
import { CSVType, type RawCSVCacheMetadata } from '../../types/rawCSVCache.js'
import { TestLogger } from '../TestServiceFactory.js'

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
 * Create a mock IRawCSVStorage
 */
function createMockCacheService(): IRawCSVStorage {
  return {
    getCachedCSV: vi.fn(async () => null),
    setCachedCSV: vi.fn(async () => {}),
    setCachedCSVWithMetadata: vi.fn(async () => {}),
    hasCachedCSV: vi.fn(async () => false),
    getCacheMetadata: vi.fn(async (date: string) =>
      createValidCacheMetadata(date)
    ),
    updateCacheMetadata: vi.fn(async () => {}),
    clearCacheForDate: vi.fn(async () => {}),
    getCachedDates: vi.fn(async () => []),
    getCacheStorageInfo: vi.fn(async () => ({
      totalSizeMB: 0,
      totalFiles: 0,
      oldestDate: null,
      newestDate: null,
      isLargeCache: false,
      recommendations: [],
    })),
    validateMetadataIntegrity: vi.fn(async () => ({
      isValid: true,
      issues: [],
      actualStats: { fileCount: 0, totalSize: 0 },
      metadataStats: { fileCount: 0, totalSize: 0 },
    })),
    repairMetadataIntegrity: vi.fn(async () => ({
      success: true,
      repairedFields: [],
      errors: [],
    })),
    getConfiguration: vi.fn(() => ({
      cacheDir: '/tmp/test-cache',
      enableCompression: false,
      monitoring: { trackSlowOperations: false },
      performanceThresholds: { maxReadTimeMs: 1000, maxWriteTimeMs: 2000 },
      security: { validatePaths: true, sanitizeInputs: true },
    })),
    updateConfiguration: vi.fn(),
    resetConfiguration: vi.fn(),
    getCacheStatistics: vi.fn(async () => ({
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
    })),
    getHealthStatus: vi.fn(async () => ({
      isHealthy: true,
      cacheDirectory: '/tmp/test-cache',
      isAccessible: true,
      hasWritePermissions: true,
      diskSpaceAvailable: 1000000,
      lastSuccessfulOperation: Date.now(),
      errors: [],
      warnings: [],
    })),
    clearPerformanceHistory: vi.fn(),
    getCircuitBreakerStatus: vi.fn(() => ({
      isOpen: false,
      failures: 0,
      lastFailureTime: null,
      timeSinceLastFailure: null,
      halfOpenAttempts: 0,
    })),
    resetCircuitBreakerManually: vi.fn(),
    dispose: vi.fn(async () => {}),
  } as unknown as IRawCSVStorage
}

/**
 * Create a mock DistrictConfigurationService
 */
function createMockDistrictConfigService(): DistrictConfigurationService {
  return {
    getConfiguredDistricts: vi.fn(async () => []),
    addDistrict: vi.fn(),
    removeDistrict: vi.fn(),
    setConfiguredDistricts: vi.fn(),
    validateDistrictId: vi.fn(() => true),
    getConfigurationHistory: vi.fn(async () => []),
    getConfiguration: vi.fn(async () => ({
      districts: [],
      lastModified: new Date().toISOString(),
      version: 1,
    })),
    hasConfiguredDistricts: vi.fn(async () => false),
    validateConfiguration: vi.fn(async () => ({
      isValid: true,
      errors: [],
      warnings: [],
    })),
    clearCache: vi.fn(),
  } as unknown as DistrictConfigurationService
}

/**
 * Create a mock FileSnapshotStore
 */
function createMockSnapshotStore(): FileSnapshotStore {
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
  } as unknown as FileSnapshotStore
}

describe('SnapshotBuilder Computation Removal', () => {
  let testLogger: TestLogger

  beforeEach(() => {
    testLogger = new TestLogger()
  })

  afterEach(() => {
    testLogger.clear()
    vi.clearAllMocks()
  })

  describe('Constructor', () => {
    /**
     * Test: SnapshotBuilder can be constructed without RankingCalculator
     * **Validates: Requirement 3.2**
     *
     * THE SnapshotBuilder SHALL NOT have a dependency on RankingCalculator
     */
    it('can be constructed without RankingCalculator dependency', () => {
      const mockCacheService = createMockCacheService()
      const mockDistrictConfig = createMockDistrictConfigService()
      const mockSnapshotStore = createMockSnapshotStore()

      // This should work without passing a RankingCalculator
      const snapshotBuilder = new SnapshotBuilder(
        mockCacheService,
        mockDistrictConfig,
        mockSnapshotStore,
        undefined, // validator
        undefined, // closingPeriodDetector
        undefined, // dataNormalizer
        testLogger
      )

      expect(snapshotBuilder).toBeDefined()
      expect(typeof snapshotBuilder.build).toBe('function')
      expect(typeof snapshotBuilder.getCacheAvailability).toBe('function')
    })

    /**
     * Test: SnapshotBuilder accepts optional cacheDir parameter
     * **Validates: Requirement 3.3**
     *
     * THE SnapshotBuilder SHALL read pre-computed rankings from the transform output
     */
    it('accepts optional cacheDir parameter for reading pre-computed rankings', () => {
      const mockCacheService = createMockCacheService()
      const mockDistrictConfig = createMockDistrictConfigService()
      const mockSnapshotStore = createMockSnapshotStore()

      // This should work with a cacheDir parameter
      const snapshotBuilder = new SnapshotBuilder(
        mockCacheService,
        mockDistrictConfig,
        mockSnapshotStore,
        undefined, // validator
        undefined, // closingPeriodDetector
        undefined, // dataNormalizer
        testLogger,
        undefined, // districtIdValidator
        '/tmp/test-cache' // cacheDir
      )

      expect(snapshotBuilder).toBeDefined()
    })
  })

  describe('Method Removal', () => {
    /**
     * Test: SnapshotBuilder does not have calculateAllDistrictsRankings method
     * **Validates: Requirement 3.1**
     *
     * THE SnapshotBuilder SHALL NOT contain the calculateAllDistrictsRankings method
     */
    it('does not have calculateAllDistrictsRankings method', () => {
      const mockCacheService = createMockCacheService()
      const mockDistrictConfig = createMockDistrictConfigService()
      const mockSnapshotStore = createMockSnapshotStore()

      const snapshotBuilder = new SnapshotBuilder(
        mockCacheService,
        mockDistrictConfig,
        mockSnapshotStore,
        undefined,
        undefined,
        undefined,
        testLogger
      )

      // The method should not exist on the public interface
      // Note: It was a private method, so we check that it's not accessible
      const builderAsAny = snapshotBuilder as Record<string, unknown>
      
      // Check that there's no public calculateAllDistrictsRankings method
      expect(typeof builderAsAny['calculateAllDistrictsRankings']).not.toBe('function')
    })
  })

  describe('Graceful Handling', () => {
    /**
     * Test: SnapshotBuilder handles missing cache data gracefully
     * **Validates: Requirement 3.4**
     *
     * IF rankings are not available, THE SnapshotBuilder SHALL create snapshots without rankings
     */
    it('handles missing cache data gracefully', async () => {
      const mockCacheService = createMockCacheService()
      const mockDistrictConfig = createMockDistrictConfigService()
      const mockSnapshotStore = createMockSnapshotStore()

      const snapshotBuilder = new SnapshotBuilder(
        mockCacheService,
        mockDistrictConfig,
        mockSnapshotStore,
        undefined,
        undefined,
        undefined,
        testLogger
      )

      // Build should not throw even when no cache data is available
      const result = await snapshotBuilder.build({ date: '2024-01-15' })

      // Build should complete (may fail due to no data, but should not throw)
      expect(result).toBeDefined()
      expect(result.date).toBe('2024-01-15')
    })
  })
})
