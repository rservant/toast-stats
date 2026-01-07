/**
 * Mock Cache Service for Testing
 *
 * Provides a mock implementation of IRawCSVCacheService for use in tests.
 * By default, simulates cache misses to ensure tests exercise the download path.
 */

import { vi } from 'vitest'
import type { IRawCSVCacheService } from '../../types/serviceInterfaces.js'

/**
 * Create a mock cache service for testing
 * By default, all cache operations return cache misses to test the download path
 */
export function createMockCacheService(): IRawCSVCacheService {
  return {
    // Core cache operations - default to cache miss behavior
    getCachedCSV: vi.fn().mockResolvedValue(null),
    setCachedCSV: vi.fn().mockResolvedValue(undefined),
    setCachedCSVWithMetadata: vi.fn().mockResolvedValue(undefined),
    hasCachedCSV: vi.fn().mockResolvedValue(false),

    // Metadata management
    getCacheMetadata: vi.fn().mockResolvedValue(null),
    updateCacheMetadata: vi.fn().mockResolvedValue(undefined),

    // Cache management
    clearCacheForDate: vi.fn().mockResolvedValue(undefined),
    getCachedDates: vi.fn().mockResolvedValue([]),

    // Cache storage information
    getCacheStorageInfo: vi.fn().mockResolvedValue({
      totalSizeMB: 0,
      totalFiles: 0,
      oldestDate: null,
      newestDate: null,
      isLargeCache: false,
      recommendations: [],
    }),

    // Metadata integrity
    validateMetadataIntegrity: vi.fn().mockResolvedValue({
      isValid: true,
      issues: [],
      actualStats: { fileCount: 0, totalSize: 0 },
      metadataStats: { fileCount: 0, totalSize: 0 },
    }),
    repairMetadataIntegrity: vi.fn().mockResolvedValue({
      success: true,
      repairedFields: [],
      errors: [],
    }),

    // Configuration management
    getConfiguration: vi.fn().mockReturnValue({
      cacheDir: '/tmp/test-cache',
      enableCompression: false,
      monitoring: { trackSlowOperations: false },
      performanceThresholds: { maxReadTimeMs: 1000, maxWriteTimeMs: 2000 },
      security: { validatePaths: true, sanitizeInputs: true },
    }),
    updateConfiguration: vi.fn(),
    resetConfiguration: vi.fn(),

    // Statistics and monitoring
    getCacheStatistics: vi.fn().mockResolvedValue({
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
    }),
    getHealthStatus: vi.fn().mockResolvedValue({
      isHealthy: true,
      cacheDirectory: '/tmp/test-cache',
      isAccessible: true,
      hasWritePermissions: true,
      diskSpaceAvailable: 1000000,
      lastSuccessfulOperation: Date.now(),
      errors: [],
      warnings: [],
    }),
    clearPerformanceHistory: vi.fn(),

    // Error handling and recovery
    getCircuitBreakerStatus: vi.fn().mockReturnValue({
      isOpen: false,
      failures: 0,
      lastFailureTime: null,
      timeSinceLastFailure: null,
      halfOpenAttempts: 0,
    }),
    resetCircuitBreakerManually: vi.fn(),

    // Service lifecycle
    dispose: vi.fn().mockResolvedValue(undefined),

    // All Districts caching (added for all-districts-rankings-storage feature)
    getAllDistrictsCached: vi.fn().mockResolvedValue(null),
    cacheAllDistricts: vi.fn().mockResolvedValue(undefined),
  } as IRawCSVCacheService
}

/**
 * Create a mock cache service that simulates cache hits
 * Useful for testing cache hit scenarios
 */
export function createMockCacheServiceWithHits(
  cachedContent: string = 'mock,csv,content\nrow1,value1,value2'
): IRawCSVCacheService {
  const mockService = createMockCacheService()

  // Override to return cached content
  mockService.getCachedCSV = vi.fn().mockResolvedValue(cachedContent)
  mockService.hasCachedCSV = vi.fn().mockResolvedValue(true)

  return mockService
}

/**
 * Helper to set up mock scraper with getAllDistrictsWithMetadata
 *
 * This function sets up the mock implementation for getAllDistrictsWithMetadata
 * based on the getAllDistricts mock data. The actualDate is set to 1 day before
 * the current date to simulate the dashboard's typical behavior.
 *
 * @param mockScraper - The mocked ToastmastersScraper instance
 * @param mockAllDistricts - The mock data to return from getAllDistricts
 */
export function setupMockScraperWithMetadata(
  mockScraper: {
    getAllDistricts: ReturnType<typeof vi.fn>
    getAllDistrictsWithMetadata: ReturnType<typeof vi.fn>
  },
  mockAllDistricts: unknown[]
): void {
  // Calculate the actual date (1 day behind current date, as the dashboard typically is)
  const mockActualDate = new Date()
  mockActualDate.setDate(mockActualDate.getDate() - 1)
  const mockActualDateString = mockActualDate.toISOString().split('T')[0]

  // Set up both methods
  mockScraper.getAllDistricts.mockResolvedValue(mockAllDistricts)
  mockScraper.getAllDistrictsWithMetadata.mockResolvedValue({
    records: mockAllDistricts,
    actualDate: mockActualDateString,
  })
}
