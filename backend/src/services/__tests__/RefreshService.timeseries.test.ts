/**
 * Unit tests for RefreshService time-series index integration
 *
 * Tests the integration between RefreshService and TimeSeriesIndexService
 * to verify that time-series data points are appended during snapshot creation.
 *
 * Requirements:
 * - 2.2: Append analytics summary to time-series index when snapshot is created
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import { RefreshService } from '../RefreshService.js'
import { TimeSeriesIndexService } from '../TimeSeriesIndexService.js'
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
import type { ITimeSeriesIndexService } from '../TimeSeriesIndexService.js'

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

describe('RefreshService - Time-Series Index Integration', () => {
  let testDir: string
  let snapshotsDir: string
  let snapshotStorage: PerDistrictFileSnapshotStore
  let rawCSVCache: RawCSVCacheService
  let districtConfigService: DistrictConfigurationService
  let preComputedAnalyticsService: PreComputedAnalyticsService
  let timeSeriesIndexService: TimeSeriesIndexService
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
      `refresh-timeseries-test-${uniqueId}`
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

    timeSeriesIndexService = new TimeSeriesIndexService({
      cacheDir: testDir,
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

  describe('Time-series index integration', () => {
    it('should trigger time-series index update when service is provided (Requirement 2.2)', async () => {
      // Set up cache data
      await setupCacheData(testDate)

      // Create RefreshService with TimeSeriesIndexService
      refreshService = new RefreshService(
        snapshotStorage,
        rawCSVCache,
        districtConfigService,
        undefined, // rankingCalculator
        undefined, // closingPeriodDetector
        undefined, // dataNormalizer
        undefined, // validator
        preComputedAnalyticsService,
        timeSeriesIndexService
      )

      // Execute refresh
      const result = await refreshService.executeRefresh(testDate)

      // Verify refresh was successful
      expect(result.success).toBe(true)
      expect(result.snapshot_id).toBe(testDate)

      // Verify time-series index was updated
      const programYear = timeSeriesIndexService.getProgramYearForDate(testDate)
      const indexData = await timeSeriesIndexService.getProgramYearData(
        testDistrictId,
        programYear
      )

      expect(indexData).not.toBeNull()
      expect(indexData?.dataPoints.length).toBeGreaterThan(0)

      // Verify the data point contains expected fields
      const dataPoint = indexData?.dataPoints[0]
      expect(dataPoint?.date).toBe(testDate)
      expect(dataPoint?.snapshotId).toBe(testDate)
      expect(dataPoint?.membership).toBeGreaterThan(0)
      expect(dataPoint?.clubCounts).toBeDefined()
      expect(dataPoint?.clubCounts.total).toBe(3) // 3 clubs in test data
    })

    it('should work without time-series index service (backward compatibility)', async () => {
      // Set up cache data
      await setupCacheData(testDate)

      // Create RefreshService WITHOUT TimeSeriesIndexService
      refreshService = new RefreshService(
        snapshotStorage,
        rawCSVCache,
        districtConfigService,
        undefined, // rankingCalculator
        undefined, // closingPeriodDetector
        undefined, // dataNormalizer
        undefined, // validator
        preComputedAnalyticsService
        // No timeSeriesIndexService
      )

      // Execute refresh
      const result = await refreshService.executeRefresh(testDate)

      // Verify refresh was successful
      expect(result.success).toBe(true)
      expect(result.snapshot_id).toBe(testDate)

      // Verify time-series index was NOT created (no service provided)
      const programYear = timeSeriesIndexService.getProgramYearForDate(testDate)
      const indexData = await timeSeriesIndexService.getProgramYearData(
        testDistrictId,
        programYear
      )

      expect(indexData).toBeNull()
    })

    it('should continue if time-series index update fails', async () => {
      // Set up cache data
      await setupCacheData(testDate)

      // Create a mock TimeSeriesIndexService that throws an error
      const failingTimeSeriesService = {
        appendDataPoint: vi.fn().mockRejectedValue(new Error('Time-series index update failed')),
        getTrendData: vi.fn(),
        getProgramYearData: vi.fn(),
        rebuildIndex: vi.fn(),
      } as unknown as ITimeSeriesIndexService

      // Create RefreshService with failing time-series service
      refreshService = new RefreshService(
        snapshotStorage,
        rawCSVCache,
        districtConfigService,
        undefined, // rankingCalculator
        undefined, // closingPeriodDetector
        undefined, // dataNormalizer
        undefined, // validator
        preComputedAnalyticsService,
        failingTimeSeriesService
      )

      // Execute refresh - should succeed despite time-series failure
      const result = await refreshService.executeRefresh(testDate)

      // Verify refresh was still successful
      expect(result.success).toBe(true)
      expect(result.snapshot_id).toBe(testDate)

      // Verify time-series service was called
      expect(failingTimeSeriesService.appendDataPoint).toHaveBeenCalled()
    })

    it('should not trigger time-series update for failed builds', async () => {
      // Don't set up cache data - this will cause the build to fail

      // Create a mock TimeSeriesIndexService
      const mockTimeSeriesService = {
        appendDataPoint: vi.fn(),
        getTrendData: vi.fn(),
        getProgramYearData: vi.fn(),
        rebuildIndex: vi.fn(),
      } as unknown as ITimeSeriesIndexService

      // Create RefreshService with mock time-series service
      refreshService = new RefreshService(
        snapshotStorage,
        rawCSVCache,
        districtConfigService,
        undefined, // rankingCalculator
        undefined, // closingPeriodDetector
        undefined, // dataNormalizer
        undefined, // validator
        preComputedAnalyticsService,
        mockTimeSeriesService
      )

      // Execute refresh - should fail due to missing cache
      const result = await refreshService.executeRefresh(testDate)

      // Verify refresh failed
      expect(result.success).toBe(false)

      // Verify time-series service was NOT called for failed build
      expect(mockTimeSeriesService.appendDataPoint).not.toHaveBeenCalled()
    })

    it('should calculate correct club health counts in time-series data point', async () => {
      // Set up cache data
      await setupCacheData(testDate)

      // Create RefreshService with TimeSeriesIndexService
      refreshService = new RefreshService(
        snapshotStorage,
        rawCSVCache,
        districtConfigService,
        undefined, // rankingCalculator
        undefined, // closingPeriodDetector
        undefined, // dataNormalizer
        undefined, // validator
        preComputedAnalyticsService,
        timeSeriesIndexService
      )

      // Execute refresh
      const result = await refreshService.executeRefresh(testDate)
      expect(result.success).toBe(true)

      // Get the time-series data
      const programYear = timeSeriesIndexService.getProgramYearForDate(testDate)
      const indexData = await timeSeriesIndexService.getProgramYearData(
        testDistrictId,
        programYear
      )

      expect(indexData).not.toBeNull()
      const dataPoint = indexData?.dataPoints[0]

      // Verify club counts add up correctly
      // total = thriving + vulnerable + interventionRequired
      expect(dataPoint?.clubCounts.total).toBe(
        dataPoint?.clubCounts.thriving +
        dataPoint?.clubCounts.vulnerable +
        dataPoint?.clubCounts.interventionRequired
      )
    })

    it('should work with both pre-computed analytics and time-series index services', async () => {
      // Set up cache data
      await setupCacheData(testDate)

      // Create RefreshService with both services
      refreshService = new RefreshService(
        snapshotStorage,
        rawCSVCache,
        districtConfigService,
        undefined, // rankingCalculator
        undefined, // closingPeriodDetector
        undefined, // dataNormalizer
        undefined, // validator
        preComputedAnalyticsService,
        timeSeriesIndexService
      )

      // Execute refresh
      const result = await refreshService.executeRefresh(testDate)

      // Verify refresh was successful
      expect(result.success).toBe(true)

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

      // Verify time-series index was updated
      const programYear = timeSeriesIndexService.getProgramYearForDate(testDate)
      const indexData = await timeSeriesIndexService.getProgramYearData(
        testDistrictId,
        programYear
      )
      expect(indexData).not.toBeNull()
      expect(indexData?.dataPoints.length).toBeGreaterThan(0)
    })
  })
})
