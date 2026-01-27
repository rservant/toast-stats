/**
 * Unit Tests for BackfillService Rankings Validation
 *
 * Feature: rankings-district-validation-fix
 *
 * Tests the integration of DistrictIdValidator into BackfillService to filter
 * invalid district IDs before ranking calculation. The validation occurs in
 * fetchAndCalculateAllDistrictsRankings() when parsing the all-districts CSV.
 *
 * **Validates: Requirements 2.1, 2.4**
 *
 * Test Coverage:
 * - Invalid records (like "As of MM/DD/YYYY" date patterns) are filtered before ranking calculation
 * - When all records are invalid, the method throws an error
 * - Valid records are processed correctly after filtering
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BackfillService } from '../backfill/BackfillService.js'
import type { RefreshService } from '../RefreshService.js'
import type { DistrictConfigurationService } from '../DistrictConfigurationService.js'
import type { RankingCalculator } from '../RankingCalculator.js'
import type { ISnapshotStorage } from '../../types/storageInterfaces.js'
import type { IRawCSVStorage } from '../../types/storageInterfaces.js'
import { CSVType, type RawCSVCacheMetadata } from '../../types/rawCSVCache.js'

// Mock logger
vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// Mock StorageProviderFactory to return our mock storage
vi.mock('../storage/StorageProviderFactory.js', () => ({
  StorageProviderFactory: {
    createFromEnvironment: vi.fn(),
  },
}))

// Import the mocked module to configure it
import { StorageProviderFactory } from '../storage/StorageProviderFactory.js'

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
 * Create a mock IRawCSVStorage that returns specified CSV content for ALL_DISTRICTS
 */
function createMockRawCSVStorage(csvContent: string): IRawCSVStorage {
  return {
    getCachedCSV: vi.fn(
      async (_date: string, type: CSVType, _districtId?: string) => {
        if (type === CSVType.ALL_DISTRICTS) {
          return csvContent
        }
        return null
      }
    ),
    setCachedCSV: vi.fn(async () => {}),
    setCachedCSVWithMetadata: vi.fn(async () => {}),
    hasCachedCSV: vi.fn(async (_date: string, type: CSVType) => {
      return type === CSVType.ALL_DISTRICTS
    }),
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
 * Create a mock RefreshService
 */
function createMockRefreshService(): RefreshService {
  return {
    refresh: vi.fn(),
    getDistrictPerformance: vi.fn(),
    getAllDistricts: vi.fn(),
    getMultipleDistricts: vi.fn(),
  } as unknown as RefreshService
}

/**
 * Create a mock DistrictConfigurationService
 */
function createMockDistrictConfigService(): DistrictConfigurationService {
  return {
    getConfiguredDistricts: vi.fn(async () => ['42', '61', 'F']),
    addDistrict: vi.fn(),
    removeDistrict: vi.fn(),
    setConfiguredDistricts: vi.fn(),
    validateDistrictId: vi.fn(() => true),
    getConfigurationHistory: vi.fn(async () => []),
    getConfiguration: vi.fn(async () => ({
      districts: ['42', '61', 'F'],
      lastModified: new Date().toISOString(),
      version: 1,
    })),
    hasConfiguredDistricts: vi.fn(async () => true),
    validateConfiguration: vi.fn(async () => ({
      isValid: true,
      errors: [],
      warnings: [],
    })),
    clearCache: vi.fn(),
  } as unknown as DistrictConfigurationService
}

/**
 * Create a mock ISnapshotStorage
 */
function createMockSnapshotStore(): ISnapshotStorage {
  return {
    writeSnapshot: vi.fn(async () => {}),
    getLatestSuccessful: vi.fn(async () => null),
    getLatest: vi.fn(async () => null),
    listSnapshots: vi.fn(async () => []),
    getSnapshot: vi.fn(async () => null),
    deleteSnapshot: vi.fn(async () => true),
    isReady: vi.fn(async () => true),
    writeDistrictData: vi.fn(async () => {}),
    readDistrictData: vi.fn(async () => null),
    listDistrictsInSnapshot: vi.fn(async () => []),
    getSnapshotManifest: vi.fn(async () => null),
    getSnapshotMetadata: vi.fn(async () => null),
    writeAllDistrictsRankings: vi.fn(async () => {}),
    readAllDistrictsRankings: vi.fn(async () => null),
    hasAllDistrictsRankings: vi.fn(async () => false),
  } as unknown as ISnapshotStorage
}

/**
 * Create a mock RankingCalculator that tracks calls and returns rankings
 */
function createMockRankingCalculator(): RankingCalculator & {
  calculateRankings: ReturnType<typeof vi.fn>
} {
  return {
    calculateRankings: vi.fn(async districtStats => {
      // Return rankings for each district
      return districtStats.map(
        (stat: { districtId: string; districtPerformance?: unknown[] }) => ({
          districtId: stat.districtId,
          ranking: {
            districtName: `District ${stat.districtId}`,
            region: 'Test Region',
            paidClubs: 10,
            paidClubBase: 10,
            clubGrowthPercent: 0,
            totalPayments: 100,
            paymentBase: 100,
            paymentGrowthPercent: 0,
            activeClubs: 10,
            distinguishedClubs: 5,
            selectDistinguished: 2,
            presidentsDistinguished: 1,
            distinguishedPercent: 50,
            clubsRank: 1,
            paymentsRank: 1,
            distinguishedRank: 1,
            aggregateScore: 100,
          },
        })
      )
    }),
    getRankingVersion: vi.fn(() => '1.0.0'),
  } as unknown as RankingCalculator & {
    calculateRankings: ReturnType<typeof vi.fn>
  }
}

/**
 * Type for accessing private methods on BackfillService for testing.
 * This allows us to test the fetchAndCalculateAllDistrictsRankings method
 * which is private but contains the validation logic we need to test.
 */
interface BackfillServiceTestable {
  fetchAndCalculateAllDistrictsRankings(
    backfillId: string,
    date: string,
    snapshotId: string
  ): Promise<unknown>
}

describe('BackfillService Rankings Validation', () => {
  let mockRawCSVStorage: IRawCSVStorage
  let mockRefreshService: RefreshService
  let mockDistrictConfig: DistrictConfigurationService
  let mockSnapshotStore: ISnapshotStorage
  let mockRankingCalculator: RankingCalculator & {
    calculateRankings: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    mockRefreshService = createMockRefreshService()
    mockDistrictConfig = createMockDistrictConfigService()
    mockSnapshotStore = createMockSnapshotStore()
    mockRankingCalculator = createMockRankingCalculator()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  /**
   * Helper to create a BackfillService with mocked storage and return a testable interface
   */
  function createBackfillServiceWithMockedStorage(
    csvContent: string
  ): BackfillServiceTestable {
    mockRawCSVStorage = createMockRawCSVStorage(csvContent)

    // Configure the StorageProviderFactory mock to return our mock storage
    vi.mocked(StorageProviderFactory.createFromEnvironment).mockReturnValue({
      snapshotStorage: mockSnapshotStore,
      rawCSVStorage: mockRawCSVStorage,
      districtConfigStorage: {} as unknown,
    } as ReturnType<typeof StorageProviderFactory.createFromEnvironment>)

    const service = new BackfillService(
      mockRefreshService,
      mockSnapshotStore,
      mockDistrictConfig,
      undefined, // alertManager
      undefined, // circuitBreakerManager
      mockRankingCalculator
    )

    // Cast to testable interface to access private method
    return service as unknown as BackfillServiceTestable
  }

  describe('fetchAndCalculateAllDistrictsRankings filtering', () => {
    /**
     * Test: Invalid records are filtered before ranking calculation
     * **Validates: Requirement 2.1**
     *
     * WHEN the BackfillService fetches and calculates all-districts rankings,
     * THE BackfillService SHALL filter the parsed CSV records using the
     * DistrictIdValidator before converting to DistrictStatistics
     */
    it('filters invalid records before ranking calculation', async () => {
      // Arrange: CSV with mix of valid and invalid district IDs
      // The "As of 01/20/2026" entry should be filtered out
      const csvContent = `DISTRICT,REGION,Paid Clubs,Total Payments
42,Region 1,10,100
As of 01/20/2026,Region 2,5,50
61,Region 3,15,150`

      const service = createBackfillServiceWithMockedStorage(csvContent)

      // Act: Call the private method directly for testing
      const result = await service.fetchAndCalculateAllDistrictsRankings(
        'test-backfill-id',
        '2024-01-15',
        '2024-01-15'
      )

      // Assert: Rankings were calculated
      expect(result).toBeDefined()

      // Assert: RankingCalculator was called with only valid districts (42 and 61)
      expect(mockRankingCalculator.calculateRankings).toHaveBeenCalledTimes(1)

      const calculateRankingsCalls = mockRankingCalculator.calculateRankings
        .mock.calls as Array<Array<Array<{ districtId: string }>>>
      const districtStats = calculateRankingsCalls[0]?.[0]

      expect(districtStats).toBeDefined()
      expect(districtStats?.length).toBe(2)

      const districtIds = districtStats?.map(d => d.districtId)
      expect(districtIds).toContain('42')
      expect(districtIds).toContain('61')
      expect(districtIds).not.toContain('As of 01/20/2026')
    })

    /**
     * Test: Error is thrown when all records are invalid
     * **Validates: Requirement 2.4**
     *
     * IF all records are filtered out as invalid,
     * THEN THE BackfillService SHALL throw an error indicating
     * no valid records were found
     */
    it('throws error when all records are invalid', async () => {
      // Arrange: CSV with only invalid district IDs (date patterns)
      const csvContent = `DISTRICT,REGION,Paid Clubs,Total Payments
As of 01/20/2026,Region 1,10,100
As of 12/31/2024,Region 2,5,50`

      const service = createBackfillServiceWithMockedStorage(csvContent)

      // Act & Assert: Should throw an error
      await expect(
        service.fetchAndCalculateAllDistrictsRankings(
          'test-backfill-id',
          '2024-01-15',
          '2024-01-15'
        )
      ).rejects.toThrow(
        /No valid district records found in All Districts CSV for date 2024-01-15 after filtering invalid IDs/
      )

      // Assert: RankingCalculator was NOT called (no valid records to rank)
      expect(mockRankingCalculator.calculateRankings).not.toHaveBeenCalled()
    })

    /**
     * Test: Valid records are processed correctly after filtering
     * **Validates: Requirements 2.1, 2.4**
     *
     * WHEN valid records remain after filtering,
     * THE BackfillService SHALL process them correctly for ranking calculation
     */
    it('processes valid records correctly after filtering', async () => {
      // Arrange: CSV with all valid district IDs
      const csvContent = `DISTRICT,REGION,Paid Clubs,Total Payments
42,Region 1,10,100
61,Region 2,15,150
F,Region 3,20,200`

      const service = createBackfillServiceWithMockedStorage(csvContent)

      // Act: Call the private method directly for testing
      const result = await service.fetchAndCalculateAllDistrictsRankings(
        'test-backfill-id',
        '2024-01-15',
        '2024-01-15'
      )

      // Assert: Rankings were calculated
      expect(result).toBeDefined()

      // Assert: RankingCalculator was called with all 3 valid districts
      expect(mockRankingCalculator.calculateRankings).toHaveBeenCalledTimes(1)

      const calculateRankingsCalls = mockRankingCalculator.calculateRankings
        .mock.calls as Array<Array<Array<{ districtId: string }>>>
      const districtStats = calculateRankingsCalls[0]?.[0]

      expect(districtStats).toBeDefined()
      expect(districtStats?.length).toBe(3)

      const districtIds = districtStats?.map(d => d.districtId)
      expect(districtIds).toContain('42')
      expect(districtIds).toContain('61')
      expect(districtIds).toContain('F')
    })

    /**
     * Test: Various invalid district ID patterns are filtered
     * **Validates: Requirements 2.1, 3.2, 3.3, 3.4**
     *
     * THE BackfillService SHALL filter district IDs that:
     * - Match date patterns (e.g., "As of MM/DD/YYYY")
     * - Are empty or whitespace-only
     * - Contain non-alphanumeric characters
     */
    it('filters various invalid district ID patterns', async () => {
      // Arrange: CSV with various invalid district ID patterns
      const csvContent = `DISTRICT,REGION,Paid Clubs,Total Payments
42,Region 1,10,100
As of 1/20/2026,Region 2,5,50
,Region 3,8,80
   ,Region 4,12,120
district-42,Region 5,7,70
61,Region 6,15,150`

      const service = createBackfillServiceWithMockedStorage(csvContent)

      // Act: Call the private method directly for testing
      const result = await service.fetchAndCalculateAllDistrictsRankings(
        'test-backfill-id',
        '2024-01-15',
        '2024-01-15'
      )

      // Assert: Rankings were calculated
      expect(result).toBeDefined()

      // Assert: RankingCalculator was called with only valid districts (42 and 61)
      expect(mockRankingCalculator.calculateRankings).toHaveBeenCalledTimes(1)

      const calculateRankingsCalls = mockRankingCalculator.calculateRankings
        .mock.calls as Array<Array<Array<{ districtId: string }>>>
      const districtStats = calculateRankingsCalls[0]?.[0]

      expect(districtStats).toBeDefined()
      expect(districtStats?.length).toBe(2)

      const districtIds = districtStats?.map(d => d.districtId)
      expect(districtIds).toContain('42')
      expect(districtIds).toContain('61')
      // Invalid patterns should be filtered out
      expect(districtIds).not.toContain('As of 1/20/2026')
      expect(districtIds).not.toContain('')
      expect(districtIds).not.toContain('   ')
      expect(districtIds).not.toContain('district-42')
    })
  })
})
