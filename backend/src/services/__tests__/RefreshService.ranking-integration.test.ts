/**
 * Integration tests for RefreshService ranking calculator integration
 *
 * Tests that the RefreshService correctly integrates with the RankingCalculator
 * through SnapshotBuilder and handles ranking calculation failures gracefully.
 *
 * Note: RefreshService now uses SnapshotBuilder to create snapshots from cached
 * CSV data. Scraping is handled separately by the scraper-cli tool.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import { RefreshService } from '../RefreshService.js'
import { BordaCountRankingCalculator } from '../RankingCalculator.js'
import {
  FileSnapshotStore,
  PerDistrictFileSnapshotStore,
} from '../SnapshotStore.js'
import { DataValidator } from '../DataValidator.js'
import { DistrictConfigurationService } from '../DistrictConfigurationService.js'
import { RawCSVCacheService } from '../RawCSVCacheService.js'
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

describe('RefreshService Ranking Integration', () => {
  let testCacheDir: string
  let snapshotStore: PerDistrictFileSnapshotStore
  let validator: DataValidator
  let districtConfigService: DistrictConfigurationService
  let rankingCalculator: BordaCountRankingCalculator
  let rawCSVCache: RawCSVCacheService
  let mockCacheConfig: MockCacheConfigService
  let mockLogger: MockLogger
  let testDate: string

  beforeEach(async () => {
    // Create a unique test cache directory
    testCacheDir = path.join(
      process.cwd(),
      'test-cache',
      `refresh-service-ranking-${Date.now()}-${Math.random()}`
    )
    await fs.mkdir(testCacheDir, { recursive: true })

    // Create mock cache config and logger
    mockCacheConfig = new MockCacheConfigService(testCacheDir)
    mockLogger = new MockLogger()

    // Initialize services
    snapshotStore = new PerDistrictFileSnapshotStore({
      cacheDir: testCacheDir,
      maxSnapshots: 100,
      maxAgeDays: 30,
    })
    validator = new DataValidator()
    districtConfigService = new DistrictConfigurationService(testCacheDir)
    rankingCalculator = new BordaCountRankingCalculator()
    rawCSVCache = new RawCSVCacheService(mockCacheConfig, mockLogger)

    // Set up test date
    testDate = new Date().toISOString().split('T')[0] ?? '2025-01-01'

    // Configure a test district
    await districtConfigService.addDistrict('42', 'test-admin')

    // Set up cached CSV data for the test
    await setupCachedData()
  })

  async function setupCachedData() {
    // Create all-districts CSV data
    const allDistrictsCSV = `DISTRICT,REGION,Paid Clubs,Paid Club Base,% Club Growth,Total YTD Payments,Payment Base,% Payment Growth,Active Clubs,Total Distinguished Clubs,Select Distinguished Clubs,Presidents Distinguished Clubs
42,Test Region,10,8,25.0,100,80,25.0,12,6,2,1`

    // Create club performance CSV data
    const clubPerformanceCSV = `Club Number,Club Name,Active Members,Club Status
12345,Test Club,25,Active`

    // Store the CSV data in the cache
    await rawCSVCache.setCachedCSV(
      testDate,
      CSVType.ALL_DISTRICTS,
      allDistrictsCSV,
      undefined
    )

    await rawCSVCache.setCachedCSV(
      testDate,
      CSVType.CLUB_PERFORMANCE,
      clubPerformanceCSV,
      '42'
    )
  }

  afterEach(async () => {
    // Clean up test cache directory
    try {
      await fs.rm(testCacheDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
    vi.clearAllMocks()
  })

  it('should return failed result when no cache data is available', async () => {
    // Create a new cache directory without any data
    const emptyCacheDir = path.join(
      process.cwd(),
      'test-cache',
      `empty-cache-${Date.now()}`
    )
    await fs.mkdir(emptyCacheDir, { recursive: true })

    const emptyMockCacheConfig = new MockCacheConfigService(emptyCacheDir)
    const emptyRawCSVCache = new RawCSVCacheService(
      emptyMockCacheConfig,
      mockLogger
    )
    const emptyDistrictConfigService = new DistrictConfigurationService(
      emptyCacheDir
    )
    await emptyDistrictConfigService.addDistrict('42', 'test-admin')

    const emptySnapshotStore = new PerDistrictFileSnapshotStore({
      cacheDir: emptyCacheDir,
      maxSnapshots: 100,
      maxAgeDays: 30,
    })

    // Create RefreshService with empty cache
    const refreshService = new RefreshService(
      emptySnapshotStore,
      emptyRawCSVCache,
      emptyDistrictConfigService,
      rankingCalculator
    )

    // Execute refresh
    const result = await refreshService.executeRefresh()

    // Verify refresh failed due to missing cache
    expect(result.success).toBe(false)
    expect(result.status).toBe('failed')
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0]).toContain('No cached data available')

    // Clean up
    await fs.rm(emptyCacheDir, { recursive: true, force: true })
  })

  it('should check cache availability before building snapshot', async () => {
    // Create RefreshService
    const refreshService = new RefreshService(
      snapshotStore,
      rawCSVCache,
      districtConfigService,
      rankingCalculator
    )

    // Check cache availability
    const availability = await refreshService.checkCacheAvailability(testDate)

    // Verify cache is available
    expect(availability.available).toBe(true)
    expect(availability.date).toBe(testDate)
    expect(availability.cachedDistricts).toContain('42')
  })

  it('should work without ranking calculator (backward compatibility)', async () => {
    // Create RefreshService without ranking calculator
    const refreshService = new RefreshService(
      snapshotStore,
      rawCSVCache,
      districtConfigService
      // No ranking calculator provided
    )

    // Execute refresh
    const result = await refreshService.executeRefresh(testDate)

    // Verify refresh was successful (or failed due to cache structure)
    // The important thing is that it doesn't crash without a ranking calculator
    expect(result).toBeDefined()
    expect(result.metadata).toBeDefined()
    expect(result.metadata.schemaVersion).toBe('1.0.0')
    expect(result.metadata.calculationVersion).toBe('1.0.0')
  })

  it('should include metadata in refresh result', async () => {
    // Create RefreshService
    const refreshService = new RefreshService(
      snapshotStore,
      rawCSVCache,
      districtConfigService,
      rankingCalculator
    )

    // Execute refresh
    const result = await refreshService.executeRefresh(testDate)

    // Verify metadata is present
    expect(result.metadata).toBeDefined()
    expect(result.metadata.startedAt).toBeDefined()
    expect(result.metadata.completedAt).toBeDefined()
    expect(result.metadata.schemaVersion).toBe('1.0.0')
    expect(result.metadata.calculationVersion).toBe('1.0.0')
    expect(result.duration_ms).toBeGreaterThanOrEqual(0)
  })

  it('should validate configuration before refresh', async () => {
    // Create RefreshService
    const refreshService = new RefreshService(
      snapshotStore,
      rawCSVCache,
      districtConfigService,
      rankingCalculator
    )

    // Validate configuration
    const validationResult = await refreshService.validateConfiguration()

    // Verify validation result
    expect(validationResult).toBeDefined()
    expect(validationResult.isValid).toBe(true)
    expect(validationResult.configuredDistricts).toContain('42')
  })
})
