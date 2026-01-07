/**
 * Integration tests for RefreshService ranking calculator integration
 *
 * Tests that the RefreshService correctly integrates with the RankingCalculator
 * and handles ranking calculation failures gracefully.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import { RefreshService } from '../RefreshService.js'
import { BordaCountRankingCalculator } from '../RankingCalculator.js'
import { FileSnapshotStore } from '../FileSnapshotStore.js'
import { ToastmastersScraper } from '../ToastmastersScraper.js'
import { DataValidator } from '../DataValidator.js'
import { DistrictConfigurationService } from '../DistrictConfigurationService.js'
import { RawCSVCacheService } from '../RawCSVCacheService.js'
import type { DistrictStatistics } from '../../types/districts.js'
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
  let snapshotStore: FileSnapshotStore
  let mockScraper: ToastmastersScraper
  let validator: DataValidator
  let districtConfigService: DistrictConfigurationService
  let rankingCalculator: BordaCountRankingCalculator
  let rawCSVCache: RawCSVCacheService
  let mockCacheConfig: MockCacheConfigService
  let mockLogger: MockLogger

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
    snapshotStore = new FileSnapshotStore({ cacheDir: testCacheDir })
    validator = new DataValidator()
    districtConfigService = new DistrictConfigurationService(testCacheDir)
    rankingCalculator = new BordaCountRankingCalculator()
    rawCSVCache = new RawCSVCacheService(mockCacheConfig, mockLogger)

    // Create mock scraper
    mockScraper = {
      getAllDistricts: vi.fn(),
      getDistrictPerformance: vi.fn(),
      getDivisionPerformance: vi.fn(),
      getClubPerformance: vi.fn(),
      closeBrowser: vi.fn(),
    } as unknown as ToastmastersScraper

    // Mock scraper methods to return test data (matching property test pattern)
    const mockAllDistricts = [
      {
        DISTRICT: '42',
        REGION: 'Test Region',
        'Paid Clubs': '10',
        'Paid Club Base': '8',
        '% Club Growth': '25.0',
        'Total YTD Payments': '100',
        'Payment Base': '80',
        '% Payment Growth': '25.0',
        'Active Clubs': '12',
        'Total Distinguished Clubs': '6',
        'Select Distinguished Clubs': '2',
        'Presidents Distinguished Clubs': '1',
      },
    ]

    const mockDistrictData = [
      {
        DISTRICT: '42',
        REGION: 'Test Region',
        'Paid Clubs': '10',
        'Paid Club Base': '8',
        '% Club Growth': '25.0',
        'Total YTD Payments': '100',
        'Payment Base': '80',
        '% Payment Growth': '25.0',
        'Active Clubs': '12',
        'Total Distinguished Clubs': '6',
        'Select Distinguished Clubs': '2',
        'Presidents Distinguished Clubs': '1',
      },
    ]

    const mockClubData = [
      {
        'Club Number': '12345',
        'Club Name': 'Test Club',
        'Active Members': '25',
        'Club Status': 'Active',
      },
    ]

    vi.mocked(mockScraper.getAllDistricts).mockResolvedValue(mockAllDistricts)
    vi.mocked(mockScraper.getDistrictPerformance).mockResolvedValue(
      mockDistrictData
    )
    vi.mocked(mockScraper.getDivisionPerformance).mockResolvedValue([])
    vi.mocked(mockScraper.getClubPerformance).mockResolvedValue(mockClubData)
    vi.mocked(mockScraper.closeBrowser).mockResolvedValue()

    // Configure a test district
    await districtConfigService.addDistrict('42', 'test-admin')
  })

  afterEach(async () => {
    // Clean up test cache directory
    try {
      await fs.rm(testCacheDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
    vi.clearAllMocks()
  })

  it('should integrate ranking calculator into snapshot creation', async () => {
    // Create RefreshService with ranking calculator
    const refreshService = new RefreshService(
      snapshotStore,
      mockScraper,
      rawCSVCache,
      validator,
      districtConfigService,
      rankingCalculator
    )

    // Execute refresh
    const result = await refreshService.executeRefresh()

    // Verify refresh was successful
    expect(result.success).toBe(true)
    expect(result.snapshot_id).toBeDefined()

    // Get the created snapshot
    const snapshot = await snapshotStore.getSnapshot(result.snapshot_id!)
    expect(snapshot).toBeDefined()

    // Verify that districts DON'T have ranking data (stored separately now)
    const districts = snapshot!.payload.districts
    expect(districts).toHaveLength(1)

    const district = districts[0]
    expect(district.ranking).toBeUndefined() // Rankings stored separately per Requirement 1.4

    // Verify that all-districts rankings were created
    // Note: This would require checking the all-districts-rankings.json file
    // which is stored separately from the snapshot
  })

  it('should fail refresh when ranking calculator fails (requirement 5.6)', async () => {
    // Create a mock ranking calculator that throws an error
    const failingRankingCalculator = {
      calculateRankings: vi
        .fn()
        .mockRejectedValue(new Error('Ranking calculation failed')),
      getRankingVersion: vi.fn().mockReturnValue('2.0'),
    }

    // Create RefreshService with failing ranking calculator
    const refreshService = new RefreshService(
      snapshotStore,
      mockScraper,
      rawCSVCache,
      validator,
      districtConfigService,
      failingRankingCalculator
    )

    // Execute refresh
    const result = await refreshService.executeRefresh()

    // Per requirement 5.6 in all-districts-rankings-storage spec:
    // "IF ranking calculation fails for all districts, THEN THE System SHALL fail the entire refresh operation"
    expect(result.success).toBe(false)
    expect(result.status).toBe('failed')
    expect(result.errors.length).toBeGreaterThan(0)
    expect(
      result.errors.some(e => e.includes('rankings calculation failed'))
    ).toBe(true)

    // Verify the failing calculator was called with ALL districts data
    expect(failingRankingCalculator.calculateRankings).toHaveBeenCalled()
  })

  it('should work without ranking calculator (backward compatibility)', async () => {
    // Create RefreshService without ranking calculator
    const refreshService = new RefreshService(
      snapshotStore,
      mockScraper,
      rawCSVCache,
      validator,
      districtConfigService
      // No ranking calculator provided
    )

    // Execute refresh
    const result = await refreshService.executeRefresh()

    // Verify refresh was successful
    expect(result.success).toBe(true)
    expect(result.snapshot_id).toBeDefined()

    // Get the created snapshot
    const snapshot = await snapshotStore.getSnapshot(result.snapshot_id!)
    expect(snapshot).toBeDefined()

    // Verify that districts don't have ranking data
    const districts = snapshot!.payload.districts
    expect(districts).toHaveLength(1)

    const district = districts[0]
    expect(district.ranking).toBeUndefined()
  })

  it('should use the same source data for ranking calculations', async () => {
    // Create a spy ranking calculator to verify it receives the correct data
    const spyRankingCalculator = {
      calculateRankings: vi
        .fn()
        .mockImplementation(async (districts: DistrictStatistics[]) => {
          // Add ranking data to districts
          return districts.map(district => ({
            ...district,
            ranking: {
              clubsRank: 1,
              paymentsRank: 1,
              distinguishedRank: 1,
              aggregateScore: 3,
              clubGrowthPercent: 25.0,
              paymentGrowthPercent: 25.0,
              distinguishedPercent: 50.0,
              paidClubBase: 8,
              paymentBase: 80,
              paidClubs: 10,
              totalPayments: 100,
              distinguishedClubs: 6,
              activeClubs: 12,
              selectDistinguished: 2,
              presidentsDistinguished: 1,
              region: 'Test Region',
              districtName: '42',
              rankingVersion: '2.0',
              calculatedAt: new Date().toISOString(),
            },
          }))
        }),
      getRankingVersion: vi.fn().mockReturnValue('2.0'),
    }

    // Create RefreshService with spy ranking calculator
    const refreshService = new RefreshService(
      snapshotStore,
      mockScraper,
      rawCSVCache,
      validator,
      districtConfigService,
      spyRankingCalculator
    )

    // Execute refresh
    const result = await refreshService.executeRefresh()

    // Verify refresh was successful
    expect(result.success).toBe(true)

    // Verify the ranking calculator was called with ALL districts data
    // (from the All Districts CSV, not just configured districts)
    expect(spyRankingCalculator.calculateRankings).toHaveBeenCalledTimes(1)
    const calledWith = spyRankingCalculator.calculateRankings.mock.calls[0][0]

    // Verify the districts have the expected structure and data
    // Note: This is data from the All Districts CSV, not configured districts
    expect(calledWith).toHaveLength(1)
    expect(calledWith[0].districtId).toBe('42')

    // The data structure is different for all-districts vs per-district
    // All-districts data comes from the summary CSV
    expect(calledWith[0]).toHaveProperty('districtId')
  })
})
