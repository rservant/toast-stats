/**
 * Production-Like Data Tests for All Districts Rankings Storage
 *
 * Tests the complete refresh flow using realistic data that mimics
 * actual Toastmasters dashboard CSV data structure and values.
 *
 * Feature: all-districts-rankings-storage
 * Task: 10.2 Test with production-like data
 * Validates: Requirements 1.5, 4.3, 6.3
 *
 * CRITICAL: All tests use mocked data and do NOT contact the Toastmasters website
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { promises as fs } from 'fs'
import path from 'path'
import { RefreshService } from '../RefreshService.js'
import { PerDistrictFileSnapshotStore } from '../PerDistrictSnapshotStore.js'
import { ToastmastersScraper } from '../ToastmastersScraper.js'
import { RawCSVCacheService } from '../RawCSVCacheService.js'
import { DistrictConfigurationService } from '../DistrictConfigurationService.js'
import { BordaCountRankingCalculator } from '../RankingCalculator.js'
import type { RankingCalculator } from '../RankingCalculator.js'
import type { ScrapedRecord } from '../../types/districts.js'
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

  async initialize(): Promise<void> {}
  async validateCacheDirectory(): Promise<void> {}
  isReady(): boolean {
    return true
  }
  async dispose(): Promise<void> {}
}

class MockLogger implements ILogger {
  info(_message: string, _data?: unknown): void {}
  warn(_message: string, _data?: unknown): void {}
  error(_message: string, _error?: Error | unknown): void {}
  debug(_message: string, _data?: unknown): void {}
}

/**
 * Generate production-like All Districts CSV data
 * This mimics the actual structure and realistic values from Toastmasters dashboard
 */
function generateProductionLikeAllDistrictsData(): ScrapedRecord[] {
  // Realistic district data based on actual Toastmasters district structure
  const districts: ScrapedRecord[] = [
    // High-performing districts
    {
      DISTRICT: '1',
      REGION: 'Region 1',
      'Paid Clubs': '285',
      'Paid Club Base': '275',
      '% Club Growth': '3.64',
      'Total YTD Payments': '14250',
      'Payment Base': '13750',
      '% Payment Growth': '3.64',
      'Active Clubs': '280',
      'Total Distinguished Clubs': '210',
      'Select Distinguished Clubs': '52',
      'Presidents Distinguished Clubs': '14',
    },
    {
      DISTRICT: '2',
      REGION: 'Region 1',
      'Paid Clubs': '198',
      'Paid Club Base': '195',
      '% Club Growth': '1.54',
      'Total YTD Payments': '9900',
      'Payment Base': '9750',
      '% Payment Growth': '1.54',
      'Active Clubs': '195',
      'Total Distinguished Clubs': '140',
      'Select Distinguished Clubs': '35',
      'Presidents Distinguished Clubs': '9',
    },
    // Mid-performing districts
    {
      DISTRICT: '3',
      REGION: 'Region 2',
      'Paid Clubs': '156',
      'Paid Club Base': '160',
      '% Club Growth': '-2.50',
      'Total YTD Payments': '7800',
      'Payment Base': '8000',
      '% Payment Growth': '-2.50',
      'Active Clubs': '152',
      'Total Distinguished Clubs': '95',
      'Select Distinguished Clubs': '24',
      'Presidents Distinguished Clubs': '6',
    },
    {
      DISTRICT: '4',
      REGION: 'Region 2',
      'Paid Clubs': '220',
      'Paid Club Base': '215',
      '% Club Growth': '2.33',
      'Total YTD Payments': '11000',
      'Payment Base': '10750',
      '% Payment Growth': '2.33',
      'Active Clubs': '218',
      'Total Distinguished Clubs': '165',
      'Select Distinguished Clubs': '41',
      'Presidents Distinguished Clubs': '11',
    },
    // Lower-performing districts
    {
      DISTRICT: '5',
      REGION: 'Region 3',
      'Paid Clubs': '89',
      'Paid Club Base': '95',
      '% Club Growth': '-6.32',
      'Total YTD Payments': '4450',
      'Payment Base': '4750',
      '% Payment Growth': '-6.32',
      'Active Clubs': '85',
      'Total Distinguished Clubs': '42',
      'Select Distinguished Clubs': '10',
      'Presidents Distinguished Clubs': '2',
    },
    {
      DISTRICT: '6',
      REGION: 'Region 3',
      'Paid Clubs': '312',
      'Paid Club Base': '300',
      '% Club Growth': '4.00',
      'Total YTD Payments': '15600',
      'Payment Base': '15000',
      '% Payment Growth': '4.00',
      'Active Clubs': '308',
      'Total Distinguished Clubs': '245',
      'Select Distinguished Clubs': '61',
      'Presidents Distinguished Clubs': '16',
    },
    // International districts (alphanumeric IDs)
    {
      DISTRICT: 'F',
      REGION: 'Region 4',
      'Paid Clubs': '178',
      'Paid Club Base': '175',
      '% Club Growth': '1.71',
      'Total YTD Payments': '8900',
      'Payment Base': '8750',
      '% Payment Growth': '1.71',
      'Active Clubs': '175',
      'Total Distinguished Clubs': '122',
      'Select Distinguished Clubs': '30',
      'Presidents Distinguished Clubs': '8',
    },
    {
      DISTRICT: 'U',
      REGION: 'Region 5',
      'Paid Clubs': '145',
      'Paid Club Base': '148',
      '% Club Growth': '-2.03',
      'Total YTD Payments': '7250',
      'Payment Base': '7400',
      '% Payment Growth': '-2.03',
      'Active Clubs': '142',
      'Total Distinguished Clubs': '85',
      'Select Distinguished Clubs': '21',
      'Presidents Distinguished Clubs': '5',
    },
    // Edge case: Zero growth
    {
      DISTRICT: '42',
      REGION: 'Region 6',
      'Paid Clubs': '200',
      'Paid Club Base': '200',
      '% Club Growth': '0.00',
      'Total YTD Payments': '10000',
      'Payment Base': '10000',
      '% Payment Growth': '0.00',
      'Active Clubs': '198',
      'Total Distinguished Clubs': '148',
      'Select Distinguished Clubs': '37',
      'Presidents Distinguished Clubs': '10',
    },
    // Edge case: Very high growth
    {
      DISTRICT: '60',
      REGION: 'Region 7',
      'Paid Clubs': '125',
      'Paid Club Base': '100',
      '% Club Growth': '25.00',
      'Total YTD Payments': '6250',
      'Payment Base': '5000',
      '% Payment Growth': '25.00',
      'Active Clubs': '122',
      'Total Distinguished Clubs': '98',
      'Select Distinguished Clubs': '24',
      'Presidents Distinguished Clubs': '7',
    },
  ]

  return districts
}

/**
 * Generate mock district-specific performance data
 */
function generateMockDistrictPerformanceData(
  districtId: string
): ScrapedRecord[] {
  return [
    {
      DISTRICT: districtId,
      REGION: 'Test Region',
      'Paid Clubs': '100',
    },
  ]
}

function generateMockDivisionPerformanceData(
  districtId: string
): ScrapedRecord[] {
  return [
    {
      DIVISION: 'A',
      DISTRICT: districtId,
      'Paid Clubs': '25',
    },
  ]
}

function generateMockClubPerformanceData(districtId: string): ScrapedRecord[] {
  return [
    {
      'Club Number': '12345',
      'Club Name': `Test Club ${districtId}`,
      DISTRICT: districtId,
      'Active Members': '25',
    },
  ]
}

describe('RefreshService Production-Like Data Tests', () => {
  let testCacheDir: string
  let refreshService: RefreshService
  let snapshotStore: PerDistrictFileSnapshotStore
  let mockScraper: ToastmastersScraper
  let rawCSVCache: RawCSVCacheService
  let districtConfigService: DistrictConfigurationService
  let rankingCalculator: RankingCalculator
  let mockCacheConfig: MockCacheConfigService
  let mockLogger: MockLogger
  let productionLikeData: ScrapedRecord[]

  beforeEach(async () => {
    // Create unique test cache directory
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substring(2, 8)
    testCacheDir = path.join(
      process.cwd(),
      'test-cache',
      `production-like-${timestamp}-${randomSuffix}`
    )

    await fs.mkdir(testCacheDir, { recursive: true })

    // Generate production-like data
    productionLikeData = generateProductionLikeAllDistrictsData()

    // Create mock cache config and logger
    mockCacheConfig = new MockCacheConfigService(testCacheDir)
    mockLogger = new MockLogger()

    // Create real service instances with test configuration
    snapshotStore = new PerDistrictFileSnapshotStore({
      cacheDir: testCacheDir,
      maxSnapshots: 50,
      maxAgeDays: 7,
    })

    rawCSVCache = new RawCSVCacheService(mockCacheConfig, mockLogger)

    districtConfigService = new DistrictConfigurationService()
    // Configure a subset of districts for detailed data collection
    vi.spyOn(districtConfigService, 'getConfiguredDistricts').mockResolvedValue(
      ['1', '42']
    )
    vi.spyOn(districtConfigService, 'hasConfiguredDistricts').mockResolvedValue(
      true
    )

    rankingCalculator = new BordaCountRankingCalculator()

    // Create mock scraper
    mockScraper = {
      getAllDistricts: vi.fn(),
      getAllDistrictsWithMetadata: vi.fn(),
      getDistrictPerformance: vi.fn(),
      getDivisionPerformance: vi.fn(),
      getClubPerformance: vi.fn(),
      closeBrowser: vi.fn(),
    } as unknown as ToastmastersScraper

    // Mock the actual date from the dashboard (1-2 days behind current date)
    const mockActualDate = new Date()
    mockActualDate.setDate(mockActualDate.getDate() - 1)
    const mockActualDateString = mockActualDate.toISOString().split('T')[0]

    // Setup mock responses with production-like data
    vi.mocked(mockScraper.getAllDistricts).mockResolvedValue(productionLikeData)
    vi.mocked(mockScraper.getAllDistrictsWithMetadata).mockResolvedValue({
      records: productionLikeData,
      actualDate: mockActualDateString!,
    })

    vi.mocked(mockScraper.getDistrictPerformance).mockImplementation(
      async (districtId: string) =>
        generateMockDistrictPerformanceData(districtId)
    )

    vi.mocked(mockScraper.getDivisionPerformance).mockImplementation(
      async (districtId: string) =>
        generateMockDivisionPerformanceData(districtId)
    )

    vi.mocked(mockScraper.getClubPerformance).mockImplementation(
      async (districtId: string) => generateMockClubPerformanceData(districtId)
    )

    vi.mocked(mockScraper.closeBrowser).mockResolvedValue()

    // Create refresh service with all dependencies
    refreshService = new RefreshService(
      snapshotStore,
      mockScraper,
      rawCSVCache,
      undefined,
      districtConfigService,
      rankingCalculator
    )
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

  describe('Rankings Calculations with Production-Like Data', () => {
    it('should calculate correct rankings for all districts from CSV', async () => {
      // Act: Execute refresh with production-like data
      const result = await refreshService.executeRefresh()

      // Assert: Refresh was successful
      expect(result.success).toBe(true)
      expect(result.snapshot_id).toBeDefined()

      // Get rankings data
      const snapshot = await snapshotStore.getLatestSuccessful()
      const rankingsData = await snapshotStore.readAllDistrictsRankings(
        snapshot!.snapshot_id
      )

      // Verify all districts from CSV are in rankings
      expect(rankingsData!.rankings).toHaveLength(productionLikeData.length)
      expect(rankingsData!.metadata.totalDistricts).toBe(
        productionLikeData.length
      )

      // Validates: Requirements 1.5
    })

    it('should rank districts correctly by club growth percentage', async () => {
      // Act
      const result = await refreshService.executeRefresh()
      expect(result.success).toBe(true)

      const snapshot = await snapshotStore.getLatestSuccessful()
      const rankingsData = await snapshotStore.readAllDistrictsRankings(
        snapshot!.snapshot_id
      )

      // Find the district with highest club growth (District 60 with 25%)
      const district60 = rankingsData!.rankings.find(r => r.districtId === '60')
      expect(district60).toBeDefined()
      expect(district60!.clubGrowthPercent).toBe(25.0)
      expect(district60!.clubsRank).toBe(1) // Should be rank 1 for club growth

      // Find the district with lowest club growth (District 5 with -6.32%)
      const district5 = rankingsData!.rankings.find(r => r.districtId === '5')
      expect(district5).toBeDefined()
      expect(district5!.clubGrowthPercent).toBe(-6.32)
      // Should have a lower rank (higher number)
      expect(district5!.clubsRank).toBeGreaterThan(district60!.clubsRank)

      // Validates: Requirements 6.3
    })

    it('should calculate correct distinguished percentages', async () => {
      // Act
      const result = await refreshService.executeRefresh()
      expect(result.success).toBe(true)

      const snapshot = await snapshotStore.getLatestSuccessful()
      const rankingsData = await snapshotStore.readAllDistrictsRankings(
        snapshot!.snapshot_id
      )

      // Verify distinguished percentage calculation for District 6
      // Distinguished: 245, Active: 308 => 245/308 * 100 = 79.55%
      const district6 = rankingsData!.rankings.find(r => r.districtId === '6')
      expect(district6).toBeDefined()
      expect(district6!.distinguishedClubs).toBe(245)
      expect(district6!.activeClubs).toBe(308)
      // Allow for floating point precision
      expect(district6!.distinguishedPercent).toBeCloseTo(79.55, 1)

      // Validates: Requirements 6.3
    })

    it('should handle zero growth districts correctly', async () => {
      // Act
      const result = await refreshService.executeRefresh()
      expect(result.success).toBe(true)

      const snapshot = await snapshotStore.getLatestSuccessful()
      const rankingsData = await snapshotStore.readAllDistrictsRankings(
        snapshot!.snapshot_id
      )

      // District 42 has 0% growth
      const district42 = rankingsData!.rankings.find(r => r.districtId === '42')
      expect(district42).toBeDefined()
      expect(district42!.clubGrowthPercent).toBe(0)
      expect(district42!.paymentGrowthPercent).toBe(0)

      // Should still have valid ranks
      expect(district42!.clubsRank).toBeGreaterThan(0)
      expect(district42!.paymentsRank).toBeGreaterThan(0)
      expect(district42!.distinguishedRank).toBeGreaterThan(0)
    })

    it('should handle alphanumeric district IDs correctly', async () => {
      // Act
      const result = await refreshService.executeRefresh()
      expect(result.success).toBe(true)

      const snapshot = await snapshotStore.getLatestSuccessful()
      const rankingsData = await snapshotStore.readAllDistrictsRankings(
        snapshot!.snapshot_id
      )

      // Verify alphanumeric districts are included
      const districtF = rankingsData!.rankings.find(r => r.districtId === 'F')
      const districtU = rankingsData!.rankings.find(r => r.districtId === 'U')

      expect(districtF).toBeDefined()
      expect(districtU).toBeDefined()

      // Verify they have valid ranking data
      expect(districtF!.aggregateScore).toBeGreaterThan(0)
      expect(districtU!.aggregateScore).toBeGreaterThan(0)
    })

    it('should calculate aggregate scores using Borda count', async () => {
      // Act
      const result = await refreshService.executeRefresh()
      expect(result.success).toBe(true)

      const snapshot = await snapshotStore.getLatestSuccessful()
      const rankingsData = await snapshotStore.readAllDistrictsRankings(
        snapshot!.snapshot_id
      )

      // Verify aggregate scores are calculated
      for (const ranking of rankingsData!.rankings) {
        expect(ranking.aggregateScore).toBeDefined()
        expect(ranking.aggregateScore).toBeGreaterThan(0)

        // Aggregate score should be sum of Borda points from all categories
        // Borda points = (total districts - rank + 1)
        const totalDistricts = rankingsData!.rankings.length
        const maxPossibleScore = totalDistricts * 3 // Max score if rank 1 in all categories
        expect(ranking.aggregateScore).toBeLessThanOrEqual(maxPossibleScore)
      }

      // Validates: Requirements 6.3
    })

    it('should sort rankings by aggregate score (highest first)', async () => {
      // Act
      const result = await refreshService.executeRefresh()
      expect(result.success).toBe(true)

      const snapshot = await snapshotStore.getLatestSuccessful()
      const rankingsData = await snapshotStore.readAllDistrictsRankings(
        snapshot!.snapshot_id
      )

      // Verify rankings are sorted by aggregate score descending
      for (let i = 1; i < rankingsData!.rankings.length; i++) {
        const prevScore = rankingsData!.rankings[i - 1]!.aggregateScore
        const currScore = rankingsData!.rankings[i]!.aggregateScore
        expect(prevScore).toBeGreaterThanOrEqual(currScore)
      }
    })
  })

  describe('API Response Format Verification', () => {
    it('should produce rankings with all required fields', async () => {
      // Act
      const result = await refreshService.executeRefresh()
      expect(result.success).toBe(true)

      const snapshot = await snapshotStore.getLatestSuccessful()
      const rankingsData = await snapshotStore.readAllDistrictsRankings(
        snapshot!.snapshot_id
      )

      // Verify each ranking has all required fields per API spec
      for (const ranking of rankingsData!.rankings) {
        // Identity fields
        expect(ranking.districtId).toBeDefined()
        expect(typeof ranking.districtId).toBe('string')
        expect(ranking.districtName).toBeDefined()
        expect(ranking.region).toBeDefined()

        // Performance metrics
        expect(typeof ranking.paidClubs).toBe('number')
        expect(typeof ranking.paidClubBase).toBe('number')
        expect(typeof ranking.clubGrowthPercent).toBe('number')
        expect(typeof ranking.totalPayments).toBe('number')
        expect(typeof ranking.paymentBase).toBe('number')
        expect(typeof ranking.paymentGrowthPercent).toBe('number')
        expect(typeof ranking.activeClubs).toBe('number')
        expect(typeof ranking.distinguishedClubs).toBe('number')
        expect(typeof ranking.selectDistinguished).toBe('number')
        expect(typeof ranking.presidentsDistinguished).toBe('number')
        expect(typeof ranking.distinguishedPercent).toBe('number')

        // Ranking fields
        expect(typeof ranking.clubsRank).toBe('number')
        expect(typeof ranking.paymentsRank).toBe('number')
        expect(typeof ranking.distinguishedRank).toBe('number')
        expect(typeof ranking.aggregateScore).toBe('number')

        // Ranks should be positive integers
        expect(ranking.clubsRank).toBeGreaterThan(0)
        expect(ranking.paymentsRank).toBeGreaterThan(0)
        expect(ranking.distinguishedRank).toBeGreaterThan(0)
      }

      // Validates: Requirements 4.3
    })

    it('should produce metadata with all required fields', async () => {
      // Act
      const result = await refreshService.executeRefresh()
      expect(result.success).toBe(true)

      const snapshot = await snapshotStore.getLatestSuccessful()
      const rankingsData = await snapshotStore.readAllDistrictsRankings(
        snapshot!.snapshot_id
      )

      // Verify metadata structure
      const metadata = rankingsData!.metadata
      expect(metadata.snapshotId).toBe(snapshot!.snapshot_id)
      expect(metadata.calculatedAt).toBeDefined()
      expect(new Date(metadata.calculatedAt).getTime()).not.toBeNaN()
      expect(metadata.schemaVersion).toBeDefined()
      expect(metadata.calculationVersion).toBeDefined()
      expect(metadata.rankingVersion).toBe('2.0')
      expect(metadata.sourceCsvDate).toBeDefined()
      expect(metadata.csvFetchedAt).toBeDefined()
      expect(metadata.totalDistricts).toBe(productionLikeData.length)
      expect(typeof metadata.fromCache).toBe('boolean')

      // Validates: Requirements 4.3
    })

    it('should match expected API response structure', async () => {
      // Act
      const result = await refreshService.executeRefresh()
      expect(result.success).toBe(true)

      const snapshot = await snapshotStore.getLatestSuccessful()
      const rankingsData = await snapshotStore.readAllDistrictsRankings(
        snapshot!.snapshot_id
      )

      // Simulate API response structure
      const apiResponse = {
        rankings: rankingsData!.rankings,
        date: rankingsData!.metadata.sourceCsvDate,
        _snapshot_metadata: {
          snapshot_id: snapshot!.snapshot_id,
          created_at: snapshot!.created_at,
          data_source: 'all-districts-rankings-file',
          from_cache: rankingsData!.metadata.fromCache,
          calculation_version: rankingsData!.metadata.calculationVersion,
          ranking_version: rankingsData!.metadata.rankingVersion,
        },
      }

      // Verify API response structure
      expect(apiResponse.rankings).toBeInstanceOf(Array)
      expect(apiResponse.rankings.length).toBe(productionLikeData.length)
      expect(apiResponse.date).toBeDefined()
      expect(apiResponse._snapshot_metadata).toBeDefined()
      expect(apiResponse._snapshot_metadata.snapshot_id).toBeDefined()
      expect(apiResponse._snapshot_metadata.data_source).toBe(
        'all-districts-rankings-file'
      )

      // Validates: Requirements 4.3
    })
  })

  describe('Data Integrity Verification', () => {
    it('should preserve original CSV values in rankings', async () => {
      // Act
      const result = await refreshService.executeRefresh()
      expect(result.success).toBe(true)

      const snapshot = await snapshotStore.getLatestSuccessful()
      const rankingsData = await snapshotStore.readAllDistrictsRankings(
        snapshot!.snapshot_id
      )

      // Verify values match original CSV data
      for (const csvRecord of productionLikeData) {
        const ranking = rankingsData!.rankings.find(
          r => r.districtId === csvRecord.DISTRICT
        )
        expect(ranking).toBeDefined()

        // Verify numeric values match
        expect(ranking!.paidClubs).toBe(
          parseInt(csvRecord['Paid Clubs'] as string, 10)
        )
        expect(ranking!.paidClubBase).toBe(
          parseInt(csvRecord['Paid Club Base'] as string, 10)
        )
        expect(ranking!.totalPayments).toBe(
          parseInt(csvRecord['Total YTD Payments'] as string, 10)
        )
        expect(ranking!.paymentBase).toBe(
          parseInt(csvRecord['Payment Base'] as string, 10)
        )
        expect(ranking!.activeClubs).toBe(
          parseInt(csvRecord['Active Clubs'] as string, 10)
        )
        expect(ranking!.distinguishedClubs).toBe(
          parseInt(csvRecord['Total Distinguished Clubs'] as string, 10)
        )
      }
    })

    it('should include all districts regardless of configuration', async () => {
      // Act
      const result = await refreshService.executeRefresh()
      expect(result.success).toBe(true)

      const snapshot = await snapshotStore.getLatestSuccessful()
      const rankingsData = await snapshotStore.readAllDistrictsRankings(
        snapshot!.snapshot_id
      )

      // Verify ALL districts from CSV are in rankings, not just configured ones
      const configuredDistricts =
        await districtConfigService.getConfiguredDistricts()
      expect(configuredDistricts).toHaveLength(2) // Only 2 configured

      // But rankings should have all 10 districts
      expect(rankingsData!.rankings).toHaveLength(10)

      // Verify non-configured districts are included
      const nonConfiguredIds = ['2', '3', '4', '5', '6', 'F', 'U', '60']
      for (const id of nonConfiguredIds) {
        const ranking = rankingsData!.rankings.find(r => r.districtId === id)
        expect(ranking).toBeDefined()
      }

      // Validates: Requirements 1.5
    })
  })
})
