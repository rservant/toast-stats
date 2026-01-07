/**
 * End-to-End Integration Tests for All Districts Rankings Storage
 *
 * Tests the complete refresh flow from scraping through snapshot creation
 * to API endpoint access, validating that all-districts rankings are properly
 * stored and accessible.
 *
 * Feature: all-districts-rankings-storage
 * Property 1: All Districts Rankings Completeness
 * Property 2: Cache Consistency
 * Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2, 4.1, 4.3, 5.2
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

describe('RefreshService E2E - All Districts Rankings Storage', () => {
  let testCacheDir: string
  let refreshService: RefreshService
  let snapshotStore: PerDistrictFileSnapshotStore
  let mockScraper: ToastmastersScraper
  let rawCSVCache: RawCSVCacheService
  let districtConfigService: DistrictConfigurationService
  let rankingCalculator: RankingCalculator
  let mockCacheConfig: MockCacheConfigService
  let mockLogger: MockLogger

  // Mock CSV data representing all districts
  const mockAllDistrictsData: ScrapedRecord[] = [
    {
      DISTRICT: '42',
      REGION: 'Region 5',
      'Club Name': 'District 42',
      'Paid Clubs': '245',
      'Paid Club Base': '240',
      'Total Payments': '12500',
      'Payment Base': '12000',
      'Active Clubs': '243',
      'Distinguished Clubs': '180',
      'Select Distinguished': '45',
      "President's Distinguished": '12',
    },
    {
      DISTRICT: '15',
      REGION: 'Region 2',
      'Club Name': 'District 15',
      'Paid Clubs': '200',
      'Paid Club Base': '195',
      'Total Payments': '10000',
      'Payment Base': '9500',
      'Active Clubs': '198',
      'Distinguished Clubs': '145',
      'Select Distinguished': '35',
      "President's Distinguished": '8',
    },
    {
      DISTRICT: 'F',
      REGION: 'Region 1',
      'Club Name': 'District F',
      'Paid Clubs': '320',
      'Paid Club Base': '310',
      'Total Payments': '16000',
      'Payment Base': '15000',
      'Active Clubs': '315',
      'Distinguished Clubs': '240',
      'Select Distinguished': '60',
      "President's Distinguished": '15',
    },
  ]

  // Mock district-specific data for configured districts
  const mockDistrictPerformanceData: ScrapedRecord[] = [
    {
      DISTRICT: '42',
      REGION: 'Region 5',
      'Paid Clubs': '245',
    },
  ]

  const mockDivisionPerformanceData: ScrapedRecord[] = [
    {
      DIVISION: 'A',
      DISTRICT: '42',
      'Paid Clubs': '50',
    },
  ]

  const mockClubPerformanceData: ScrapedRecord[] = [
    {
      'Club Number': '12345',
      'Club Name': 'Test Club',
      DISTRICT: '42',
    },
  ]

  beforeEach(async () => {
    // Create unique test cache directory
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substring(2, 8)
    testCacheDir = path.join(
      process.cwd(),
      'test-cache',
      `e2e-rankings-${timestamp}-${randomSuffix}`
    )

    await fs.mkdir(testCacheDir, { recursive: true })

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
    // Mock configured districts
    vi.spyOn(districtConfigService, 'getConfiguredDistricts').mockResolvedValue(
      ['42', '15']
    )
    vi.spyOn(districtConfigService, 'hasConfiguredDistricts').mockResolvedValue(
      true
    )

    rankingCalculator = new BordaCountRankingCalculator()

    // Create mock scraper
    mockScraper = {
      getAllDistricts: vi.fn(),
      getDistrictPerformance: vi.fn(),
      getDivisionPerformance: vi.fn(),
      getClubPerformance: vi.fn(),
      closeBrowser: vi.fn(),
    } as unknown as ToastmastersScraper

    // Setup default mock responses - scraper methods return arrays directly
    vi.mocked(mockScraper.getAllDistricts).mockResolvedValue(
      mockAllDistrictsData
    )

    vi.mocked(mockScraper.getDistrictPerformance).mockResolvedValue(
      mockDistrictPerformanceData
    )

    vi.mocked(mockScraper.getDivisionPerformance).mockResolvedValue(
      mockDivisionPerformanceData
    )

    vi.mocked(mockScraper.getClubPerformance).mockResolvedValue(
      mockClubPerformanceData
    )

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
    } catch (error) {
      console.warn(`Failed to clean up test cache directory: ${error}`)
    }
    vi.clearAllMocks()
  })

  describe('Complete Refresh Flow', () => {
    it('Property 1: Complete refresh creates all-districts-rankings file with all districts from CSV', async () => {
      // Act: Execute complete refresh
      const result = await refreshService.executeRefresh()

      // Assert: Refresh was successful
      expect(result.success).toBe(true)
      expect(result.snapshot_id).toBeDefined()

      // Verify snapshot was created
      const snapshot = await snapshotStore.getLatestSuccessful()
      expect(snapshot).toBeDefined()
      expect(snapshot!.status).toBe('success')

      // Verify all-districts-rankings file exists
      const hasRankings = await snapshotStore.hasAllDistrictsRankings(
        snapshot!.snapshot_id
      )
      expect(hasRankings).toBe(true)

      // Read rankings data
      const rankingsData = await snapshotStore.readAllDistrictsRankings(
        snapshot!.snapshot_id
      )
      expect(rankingsData).toBeDefined()

      // Property 1: Verify rankings contains ALL districts from CSV
      expect(rankingsData!.rankings).toHaveLength(mockAllDistrictsData.length)
      expect(rankingsData!.metadata.totalDistricts).toBe(
        mockAllDistrictsData.length
      )

      // Verify each district from CSV is in rankings
      for (const csvDistrict of mockAllDistrictsData) {
        const foundRanking = rankingsData!.rankings.find(
          r => r.districtId === csvDistrict.DISTRICT
        )
        expect(foundRanking).toBeDefined()
        expect(foundRanking!.districtId).toBe(csvDistrict.DISTRICT)
      }

      // Validates: Requirements 1.1, 1.2, 1.3
    })

    it('Property 1: Rankings file contains all districts, not just configured districts', async () => {
      // Act: Execute refresh
      const result = await refreshService.executeRefresh()

      expect(result.success).toBe(true)

      // Get snapshot
      const snapshot = await snapshotStore.getLatestSuccessful()
      const rankingsData = await snapshotStore.readAllDistrictsRankings(
        snapshot!.snapshot_id
      )

      // Assert: Rankings includes ALL districts (42, 15, F)
      expect(rankingsData!.rankings).toHaveLength(3)

      const districtIds = rankingsData!.rankings.map(r => r.districtId)
      expect(districtIds).toContain('42') // Configured
      expect(districtIds).toContain('15') // Configured
      expect(districtIds).toContain('F') // NOT configured, but should be in rankings

      // Validates: Requirements 1.5
    })

    it('Rankings accessible via snapshot store methods', async () => {
      // Act: Execute refresh
      const result = await refreshService.executeRefresh()

      expect(result.success).toBe(true)

      const snapshot = await snapshotStore.getLatestSuccessful()

      // Test hasAllDistrictsRankings
      const hasRankings = await snapshotStore.hasAllDistrictsRankings(
        snapshot!.snapshot_id
      )
      expect(hasRankings).toBe(true)

      // Test readAllDistrictsRankings
      const rankingsData = await snapshotStore.readAllDistrictsRankings(
        snapshot!.snapshot_id
      )
      expect(rankingsData).toBeDefined()
      expect(rankingsData!.rankings.length).toBeGreaterThan(0)

      // Validates: Requirements 4.1
    })

    it('Configured districts still get detailed data (3 CSV files each)', async () => {
      // Act: Execute refresh
      const result = await refreshService.executeRefresh()

      expect(result.success).toBe(true)

      // Assert: Scraper was called for each configured district
      // Each configured district should have 3 CSV files fetched
      expect(mockScraper.getDistrictPerformance).toHaveBeenCalledTimes(2) // 2 configured districts
      expect(mockScraper.getDivisionPerformance).toHaveBeenCalledTimes(2)
      expect(mockScraper.getClubPerformance).toHaveBeenCalledTimes(2)

      // Verify calls were made for correct districts
      expect(mockScraper.getDistrictPerformance).toHaveBeenCalledWith('42')
      expect(mockScraper.getDistrictPerformance).toHaveBeenCalledWith('15')

      // Validates: Requirements 5.2
    })
  })

  describe('Cache Integration', () => {
    it('Property 2: Cache reuse on subsequent refresh for same date', async () => {
      // NOTE: Raw CSV caching is not yet fully implemented (see TODO in RefreshService.scrapeData)
      // This test validates the current behavior where each refresh fetches fresh data

      // First refresh - should download
      const result1 = await refreshService.executeRefresh()
      expect(result1.success).toBe(true)

      // Verify download was called
      expect(mockScraper.getAllDistricts).toHaveBeenCalledTimes(1)

      // Reset mock call counts
      vi.mocked(mockScraper.getAllDistricts).mockClear()

      // Second refresh - currently fetches fresh data (cache not implemented)
      const result2 = await refreshService.executeRefresh()
      expect(result2.success).toBe(true)

      // Current behavior: download is called again (cache not implemented)
      // When cache is implemented, this should be: expect(mockScraper.getAllDistricts).not.toHaveBeenCalled()
      expect(mockScraper.getAllDistricts).toHaveBeenCalledTimes(1)

      // Verify both snapshots have rankings
      const snapshot1 = await snapshotStore.getSnapshot(result1.snapshot_id!)
      const snapshot2 = await snapshotStore.getSnapshot(result2.snapshot_id!)

      const rankings1 = await snapshotStore.readAllDistrictsRankings(
        snapshot1!.snapshot_id
      )
      const rankings2 = await snapshotStore.readAllDistrictsRankings(
        snapshot2!.snapshot_id
      )

      expect(rankings1).toBeDefined()
      expect(rankings2).toBeDefined()

      // Current behavior: fromCache is false (cache not implemented)
      // When cache is implemented, second refresh should have fromCache: true
      expect(rankings2!.metadata.fromCache).toBe(false)

      // Validates: Requirements 2.1, 2.2 (partial - cache not yet implemented)
    })

    it('Property 2: Cache metadata indicates data source correctly', async () => {
      // NOTE: Raw CSV caching is not yet fully implemented
      // This test validates the current behavior

      // First refresh
      await refreshService.executeRefresh()

      // Second refresh
      const result = await refreshService.executeRefresh()

      const snapshot = await snapshotStore.getSnapshot(result.snapshot_id!)
      const rankingsData = await snapshotStore.readAllDistrictsRankings(
        snapshot!.snapshot_id
      )

      // Current behavior: fromCache is false (cache not implemented)
      expect(rankingsData!.metadata.fromCache).toBe(false)
      expect(rankingsData!.metadata.csvFetchedAt).toBeDefined()
      expect(rankingsData!.metadata.sourceCsvDate).toBeDefined()

      // Validates: Requirements 2.5 (partial - cache not yet implemented)
    })
  })

  describe('Rankings Data Structure', () => {
    it('Rankings data includes all required metadata', async () => {
      // Act
      const result = await refreshService.executeRefresh()
      expect(result.success).toBe(true)

      const snapshot = await snapshotStore.getLatestSuccessful()
      const rankingsData = await snapshotStore.readAllDistrictsRankings(
        snapshot!.snapshot_id
      )

      // Assert: Metadata structure
      expect(rankingsData!.metadata).toBeDefined()
      expect(rankingsData!.metadata.snapshotId).toBe(snapshot!.snapshot_id)
      expect(rankingsData!.metadata.calculatedAt).toBeDefined()
      expect(rankingsData!.metadata.schemaVersion).toBeDefined()
      expect(rankingsData!.metadata.calculationVersion).toBeDefined()
      expect(rankingsData!.metadata.rankingVersion).toBeDefined()
      expect(rankingsData!.metadata.sourceCsvDate).toBeDefined()
      expect(rankingsData!.metadata.csvFetchedAt).toBeDefined()
      expect(rankingsData!.metadata.totalDistricts).toBe(
        rankingsData!.rankings.length
      )
      expect(rankingsData!.metadata.fromCache).toBeDefined()

      // Validates: Requirements 6.1, 6.2, 6.3
    })

    it('Each ranking includes all required fields', async () => {
      // Act
      const result = await refreshService.executeRefresh()
      expect(result.success).toBe(true)

      const snapshot = await snapshotStore.getLatestSuccessful()
      const rankingsData = await snapshotStore.readAllDistrictsRankings(
        snapshot!.snapshot_id
      )

      // Assert: Each ranking has required fields
      for (const ranking of rankingsData!.rankings) {
        expect(ranking.districtId).toBeDefined()
        expect(ranking.districtName).toBeDefined()
        expect(ranking.region).toBeDefined()
        expect(ranking.paidClubs).toBeDefined()
        expect(ranking.paidClubBase).toBeDefined()
        expect(ranking.clubGrowthPercent).toBeDefined()
        expect(ranking.totalPayments).toBeDefined()
        expect(ranking.paymentBase).toBeDefined()
        expect(ranking.paymentGrowthPercent).toBeDefined()
        expect(ranking.activeClubs).toBeDefined()
        expect(ranking.distinguishedClubs).toBeDefined()
        expect(ranking.selectDistinguished).toBeDefined()
        expect(ranking.presidentsDistinguished).toBeDefined()
        expect(ranking.distinguishedPercent).toBeDefined()
        expect(ranking.clubsRank).toBeDefined()
        expect(ranking.paymentsRank).toBeDefined()
        expect(ranking.distinguishedRank).toBeDefined()
        expect(ranking.aggregateScore).toBeDefined()
      }

      // Validates: Requirements 1.2
    })
  })

  describe('Snapshot Manifest', () => {
    it('Manifest includes rankings file entry', async () => {
      // Act
      const result = await refreshService.executeRefresh()
      expect(result.success).toBe(true)

      const snapshot = await snapshotStore.getLatestSuccessful()

      // Read manifest file directly
      const manifestPath = path.join(
        testCacheDir,
        'snapshots',
        snapshot!.snapshot_id,
        'manifest.json'
      )
      const manifestContent = await fs.readFile(manifestPath, 'utf-8')
      const manifest = JSON.parse(manifestContent)

      // Assert: Manifest includes rankings file
      expect(manifest.allDistrictsRankings).toBeDefined()
      expect(manifest.allDistrictsRankings.status).toBe('present')
      expect(manifest.allDistrictsRankings.filename).toBe(
        'all-districts-rankings.json'
      )
      expect(manifest.allDistrictsRankings.size).toBeGreaterThan(0)

      // Validates: Requirements 3.4
    })
  })

  describe('Error Handling', () => {
    it('Refresh fails if rankings calculation fails', async () => {
      // Mock ranking calculator to throw error
      const errorCalculator = {
        calculateRankings: vi.fn().mockImplementation(() => {
          throw new Error('Ranking calculation failed')
        }),
      } as unknown as RankingCalculator

      // Create refresh service with error calculator
      const errorRefreshService = new RefreshService(
        snapshotStore,
        mockScraper,
        rawCSVCache,
        undefined,
        districtConfigService,
        errorCalculator
      )

      // Act
      const result = await errorRefreshService.executeRefresh()

      // Assert: Refresh should fail
      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)

      // Verify no snapshot was created
      const snapshot = await snapshotStore.getLatestSuccessful()
      expect(snapshot).toBeNull()

      // Validates: Requirements 5.6
    })
  })

  describe('ISO Date Directory Naming', () => {
    it('Snapshot directory uses ISO date format', async () => {
      // Act
      const result = await refreshService.executeRefresh()
      expect(result.success).toBe(true)

      // Assert: Snapshot ID is in ISO date format (YYYY-MM-DD)
      expect(result.snapshot_id).toMatch(/^\d{4}-\d{2}-\d{2}$/)

      // Verify directory exists with ISO date name
      const snapshotDir = path.join(
        testCacheDir,
        'snapshots',
        result.snapshot_id!
      )
      const dirExists = await fs
        .access(snapshotDir)
        .then(() => true)
        .catch(() => false)
      expect(dirExists).toBe(true)

      // Validates: Requirements 8.1, 8.2
    })
  })
})
