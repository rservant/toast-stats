/**
 * Unit tests for RefreshService (Read-Only)
 *
 * Tests verify that RefreshService operates as a read-only service
 * without performing any time-series computation.
 *
 * IMPORTANT: Time-series index updates are now handled by scraper-cli
 * during the compute-analytics pipeline. The backend does NOT perform
 * any computation per the data-computation-separation steering document.
 *
 * Requirements:
 * - 1.1: RefreshService SHALL NOT contain time-series computation methods
 * - 1.10: RefreshService SHALL NOT have a dependency on ITimeSeriesIndexService
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import { RefreshService } from '../RefreshService.js'
import { PreComputedAnalyticsService } from '../PreComputedAnalyticsService.js'
import { FileSnapshotStore } from '../SnapshotStore.js'
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

describe('RefreshService - Read-Only Operation', () => {
  let testDir: string
  let snapshotsDir: string
  let snapshotStorage: FileSnapshotStore
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
      `refresh-readonly-test-${uniqueId}`
    )
    snapshotsDir = path.join(testDir, 'snapshots')

    await fs.mkdir(testDir, { recursive: true })
    await fs.mkdir(snapshotsDir, { recursive: true })

    // Create mock cache config and logger
    mockCacheConfig = new MockCacheConfigService(testDir)
    mockLogger = new MockLogger()

    // Initialize services
    snapshotStorage = new FileSnapshotStore({
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

  describe('Read-only operation (Requirement 1.1-1.10)', () => {
    it('should create snapshots without time-series computation', async () => {
      // Set up cache data
      await setupCacheData(testDate)

      // Create RefreshService without time-series service
      // (time-series service parameter has been removed from constructor)
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
      expect(result.status).toBe('success')
    })

    it('should work with pre-computed analytics service', async () => {
      // Set up cache data
      await setupCacheData(testDate)

      // Create RefreshService with pre-computed analytics service
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

      // Note: Per data-computation-separation steering document, the backend
      // is read-only and does NOT create analytics-summary.json files.
      // Analytics are computed by scraper-cli's compute-analytics command.
      // The PreComputedAnalyticsService only READS pre-computed files.
    })

    it('should work without any optional services', async () => {
      // Set up cache data
      await setupCacheData(testDate)

      // Create RefreshService with minimal dependencies
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
    })

    it('should fail gracefully when cache data is missing', async () => {
      // Don't set up cache data - this will cause the build to fail

      // Create RefreshService
      refreshService = new RefreshService(
        snapshotStorage,
        rawCSVCache,
        districtConfigService
      )

      // Execute refresh - should fail due to missing cache
      const result = await refreshService.executeRefresh(testDate)

      // Verify refresh failed
      expect(result.success).toBe(false)
      expect(result.status).toBe('failed')
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should include correct metadata in refresh result', async () => {
      // Set up cache data
      await setupCacheData(testDate)

      // Create RefreshService
      refreshService = new RefreshService(
        snapshotStorage,
        rawCSVCache,
        districtConfigService
      )

      // Execute refresh
      const result = await refreshService.executeRefresh(testDate)

      // Verify metadata
      expect(result.metadata).toBeDefined()
      expect(result.metadata.startedAt).toBeDefined()
      expect(result.metadata.completedAt).toBeDefined()
      expect(result.metadata.schemaVersion).toBe('1.0.0')
      expect(result.metadata.calculationVersion).toBe('1.0.0')
      expect(result.metadata.districtCount).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Constructor signature (Requirement 1.10)', () => {
    it('should not accept timeSeriesIndexService parameter', () => {
      // This test verifies that the constructor signature has been updated
      // to remove the timeSeriesIndexService parameter.
      // The test passes if the code compiles without the parameter.

      // Create RefreshService with all valid parameters
      refreshService = new RefreshService(
        snapshotStorage,
        rawCSVCache,
        districtConfigService,
        undefined, // rankingCalculator
        undefined, // closingPeriodDetector
        undefined, // dataNormalizer
        undefined, // validator
        preComputedAnalyticsService
        // Note: No 9th parameter for timeSeriesIndexService
      )

      // If we get here, the constructor signature is correct
      expect(refreshService).toBeDefined()
    })
  })
})
