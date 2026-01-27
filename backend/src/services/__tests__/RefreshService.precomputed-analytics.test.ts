/**
 * Unit tests for RefreshService pre-computed analytics integration
 *
 * Tests the integration between RefreshService and PreComputedAnalyticsService
 * to verify that analytics are computed during snapshot creation.
 *
 * Requirements:
 * - 1.1: Compute and store analytics summaries for each district in the snapshot
 * - 1.4: Log errors and continue if individual district fails
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import { RefreshService } from '../RefreshService.js'
import { PreComputedAnalyticsService } from '../PreComputedAnalyticsService.js'
import { PerDistrictFileSnapshotStore } from '../SnapshotStore.js'
import { RawCSVCacheService } from '../RawCSVCacheService.js'
import { DistrictConfigurationService } from '../DistrictConfigurationService.js'
import { LocalDistrictConfigStorage } from '../storage/LocalDistrictConfigStorage.js'
import { CSVType } from '../../types/rawCSVCache.js'
import type {
  ICacheConfigService,
  ILogger,
} from '../../types/serviceInterfaces.js'

// Mock implementations for testing
class MockCacheConfigService implements ICacheConfigService {
  private cacheDir: string

  constructor(cacheDir: string) {
    this.cacheDir = cacheDir
  }

  getCacheDirectory(): string {
    return this.cacheDir
  }

  getConfiguration() {
    return {
      baseDirectory: this.cacheDir,
      isConfigured: true,
      source: 'test' as const,
      validationStatus: {
        isValid: true,
        isAccessible: true,
        isSecure: true,
      },
    }
  }

  async initialize(): Promise<void> {
    // Mock implementation
  }

  async validateCacheDirectory(): Promise<void> {
    // Mock implementation
  }

  isReady(): boolean {
    return true
  }

  async dispose(): Promise<void> {
    // Mock implementation
  }
}

class MockLogger implements ILogger {
  info(_message: string, _data?: unknown): void {
    // Silent for tests
  }

  warn(_message: string, _data?: unknown): void {
    // Silent for tests
  }

  error(_message: string, _error?: Error | unknown): void {
    // Silent for tests
  }

  debug(_message: string, _data?: unknown): void {
    // Silent for tests
  }
}

describe('RefreshService - Pre-Computed Analytics Integration', () => {
  let testDir: string
  let snapshotsDir: string
  let snapshotStorage: PerDistrictFileSnapshotStore
  let rawCSVCache: RawCSVCacheService
  let districtConfigService: DistrictConfigurationService
  let preComputedAnalyticsService: PreComputedAnalyticsService
  let refreshService: RefreshService
  let mockCacheConfig: MockCacheConfigService
  let mockLogger: MockLogger

  const testDate = '2025-01-15'
  const testDistrictId = '42'

  beforeEach(async () => {
    // Create unique test directory
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    testDir = path.join(
      process.cwd(),
      'test-cache',
      `refresh-precomputed-test-${uniqueId}`
    )
    snapshotsDir = path.join(testDir, 'snapshots')

    await fs.mkdir(testDir, { recursive: true })
    await fs.mkdir(snapshotsDir, { recursive: true })

    // Create mock cache config and logger
    mockCacheConfig = new MockCacheConfigService(testDir)
    mockLogger = new MockLogger()

    // Initialize services
    snapshotStorage = new PerDistrictFileSnapshotStore({
      cacheDir: testDir,
      maxSnapshots: 100,
      maxAgeDays: 30,
    })
    rawCSVCache = new RawCSVCacheService(mockCacheConfig, mockLogger)

    const configStorage = new LocalDistrictConfigStorage(testDir)
    districtConfigService = new DistrictConfigurationService(configStorage)

    preComputedAnalyticsService = new PreComputedAnalyticsService({
      snapshotsDir,
    })

    // Configure a test district
    await districtConfigService.addDistrict(testDistrictId, 'test-admin')
  })

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  /**
   * Helper to create test CSV data
   */
  function createTestClubPerformanceCSV(): string {
    return `Club Number,Club Name,District,Division,Area,Active Members,Mem. Base,Goals Met,Oct. Ren.,Apr. Ren.,New Members,CSP
1234,Test Club 1,${testDistrictId},A,1,25,20,7,10,8,5,Yes
5678,Test Club 2,${testDistrictId},A,2,18,15,4,8,6,3,Yes
9012,Test Club 3,${testDistrictId},B,1,10,12,2,5,3,1,Yes`
  }

  /**
   * Helper to create test all-districts CSV data
   */
  function createTestAllDistrictsCSV(): string {
    return `DISTRICT,Region,Paid Clubs,Paid Club Base,Club Growth %,Total Payments,Payment Base,Payment Growth %,Active Clubs,Distinguished Clubs,Select Distinguished,Presidents Distinguished,Distinguished %
${testDistrictId},North America,50,48,4.17,1200,1100,9.09,48,15,5,3,31.25`
  }

  /**
   * Helper to set up cache data for a test date
   */
  async function setupCacheData(date: string): Promise<void> {
    // Store all-districts CSV
    await rawCSVCache.setCachedCSV(
      date,
      CSVType.ALL_DISTRICTS,
      createTestAllDistrictsCSV(),
      undefined
    )

    // Store club performance CSV
    await rawCSVCache.setCachedCSV(
      date,
      CSVType.CLUB_PERFORMANCE,
      createTestClubPerformanceCSV(),
      testDistrictId
    )
  }

  describe('Pre-computed analytics integration', () => {
    it('should trigger pre-computed analytics when service is provided', async () => {
      // Set up cache data
      await setupCacheData(testDate)

      // Create RefreshService with PreComputedAnalyticsService
      refreshService = new RefreshService(
        snapshotStorage,
        rawCSVCache,
        districtConfigService,
        undefined, // rankingCalculator
        undefined, // closingPeriodDetector
        undefined, // dataNormalizer
        undefined, // validator
        preComputedAnalyticsService
      )

      // Execute refresh
      const result = await refreshService.executeRefresh(testDate)

      // Verify refresh was successful
      expect(result.success).toBe(true)
      expect(result.snapshot_id).toBe(testDate)

      // Verify analytics summary file was created
      const analyticsSummaryPath = path.join(
        snapshotsDir,
        testDate,
        'analytics-summary.json'
      )
      const analyticsExists = await fs
        .access(analyticsSummaryPath)
        .then(() => true)
        .catch(() => false)

      expect(analyticsExists).toBe(true)

      // Verify analytics content
      const analyticsContent = await fs.readFile(analyticsSummaryPath, 'utf-8')
      const analytics = JSON.parse(analyticsContent)

      expect(analytics.snapshotId).toBe(testDate)
      expect(analytics.districts).toBeDefined()
      expect(Object.keys(analytics.districts).length).toBeGreaterThan(0)
    })

    it('should work without pre-computed analytics service (backward compatibility)', async () => {
      // Set up cache data
      await setupCacheData(testDate)

      // Create RefreshService WITHOUT PreComputedAnalyticsService
      refreshService = new RefreshService(
        snapshotStorage,
        rawCSVCache,
        districtConfigService
      )

      // Execute refresh
      const result = await refreshService.executeRefresh(testDate)

      // Verify refresh was successful
      expect(result.success).toBe(true)
      expect(result.snapshot_id).toBe(testDate)

      // Verify analytics summary file was NOT created
      const analyticsSummaryPath = path.join(
        snapshotsDir,
        testDate,
        'analytics-summary.json'
      )
      const analyticsExists = await fs
        .access(analyticsSummaryPath)
        .then(() => true)
        .catch(() => false)

      expect(analyticsExists).toBe(false)
    })

    it('should continue if pre-computed analytics fails (Requirement 1.4)', async () => {
      // Set up cache data
      await setupCacheData(testDate)

      // Create a mock PreComputedAnalyticsService that throws an error
      const failingAnalyticsService = {
        computeAndStore: vi
          .fn()
          .mockRejectedValue(new Error('Analytics computation failed')),
        getAnalyticsSummary: vi.fn(),
        getLatestSummary: vi.fn(),
      } as unknown as PreComputedAnalyticsService

      // Create RefreshService with failing analytics service
      refreshService = new RefreshService(
        snapshotStorage,
        rawCSVCache,
        districtConfigService,
        undefined, // rankingCalculator
        undefined, // closingPeriodDetector
        undefined, // dataNormalizer
        undefined, // validator
        failingAnalyticsService
      )

      // Execute refresh - should succeed despite analytics failure
      const result = await refreshService.executeRefresh(testDate)

      // Verify refresh was still successful (Requirement 1.4)
      expect(result.success).toBe(true)
      expect(result.snapshot_id).toBe(testDate)

      // Verify analytics service was called
      expect(failingAnalyticsService.computeAndStore).toHaveBeenCalled()
    })

    it('should not trigger analytics for failed builds', async () => {
      // Don't set up cache data - this will cause the build to fail

      // Create a mock PreComputedAnalyticsService
      const mockAnalyticsService = {
        computeAndStore: vi.fn(),
        getAnalyticsSummary: vi.fn(),
        getLatestSummary: vi.fn(),
      } as unknown as PreComputedAnalyticsService

      // Create RefreshService with mock analytics service
      refreshService = new RefreshService(
        snapshotStorage,
        rawCSVCache,
        districtConfigService,
        undefined, // rankingCalculator
        undefined, // closingPeriodDetector
        undefined, // dataNormalizer
        undefined, // validator
        mockAnalyticsService
      )

      // Execute refresh - should fail due to missing cache
      const result = await refreshService.executeRefresh(testDate)

      // Verify refresh failed
      expect(result.success).toBe(false)

      // Verify analytics service was NOT called for failed build
      expect(mockAnalyticsService.computeAndStore).not.toHaveBeenCalled()
    })
  })
})
