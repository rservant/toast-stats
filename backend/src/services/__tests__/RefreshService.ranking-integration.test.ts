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
import type { DistrictStatistics } from '../../types/districts.js'

// Mock the scraper to simulate network operations
vi.mock('../ToastmastersScraper.ts')

describe('RefreshService Ranking Integration', () => {
  let testCacheDir: string
  let snapshotStore: FileSnapshotStore
  let mockScraper: vi.Mocked<ToastmastersScraper>
  let validator: DataValidator
  let districtConfigService: DistrictConfigurationService
  let rankingCalculator: BordaCountRankingCalculator

  beforeEach(async () => {
    // Create a unique test cache directory
    testCacheDir = path.join(
      process.cwd(),
      'test-cache',
      `refresh-service-ranking-${Date.now()}-${Math.random()}`
    )
    await fs.mkdir(testCacheDir, { recursive: true })

    // Initialize services
    snapshotStore = new FileSnapshotStore({ cacheDir: testCacheDir })
    validator = new DataValidator()
    districtConfigService = new DistrictConfigurationService(testCacheDir)
    rankingCalculator = new BordaCountRankingCalculator()

    // Mock scraper
    mockScraper = vi.mocked(new ToastmastersScraper())

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

    mockScraper.getAllDistricts.mockResolvedValue(mockAllDistricts)
    mockScraper.getDistrictPerformance.mockResolvedValue(mockDistrictData)
    mockScraper.getDivisionPerformance.mockResolvedValue([])
    mockScraper.getClubPerformance.mockResolvedValue(mockClubData)

    mockScraper.closeBrowser.mockResolvedValue()

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

    // Verify that districts have ranking data
    const districts = snapshot!.payload.districts
    expect(districts).toHaveLength(1)

    const district = districts[0]
    expect(district.ranking).toBeDefined()
    expect(district.ranking!.clubsRank).toBeDefined()
    expect(district.ranking!.paymentsRank).toBeDefined()
    expect(district.ranking!.distinguishedRank).toBeDefined()
    expect(district.ranking!.aggregateScore).toBeDefined()
    expect(district.ranking!.rankingVersion).toBe('2.0')
    expect(district.ranking!.calculatedAt).toBeDefined()
  })

  it('should handle ranking calculator failures gracefully', async () => {
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
      validator,
      districtConfigService,
      failingRankingCalculator
    )

    // Execute refresh
    const result = await refreshService.executeRefresh()

    // Verify refresh was still successful (error handling requirement 5.3)
    expect(result.success).toBe(true)
    expect(result.snapshot_id).toBeDefined()

    // Get the created snapshot
    const snapshot = await snapshotStore.getSnapshot(result.snapshot_id!)
    expect(snapshot).toBeDefined()

    // Verify that districts don't have ranking data (graceful degradation)
    const districts = snapshot!.payload.districts
    expect(districts).toHaveLength(1)

    const district = districts[0]
    expect(district.ranking).toBeUndefined()

    // Verify the failing calculator was called
    expect(failingRankingCalculator.calculateRankings).toHaveBeenCalledWith(
      districts
    )
  })

  it('should work without ranking calculator (backward compatibility)', async () => {
    // Create RefreshService without ranking calculator
    const refreshService = new RefreshService(
      snapshotStore,
      mockScraper,
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
      validator,
      districtConfigService,
      spyRankingCalculator
    )

    // Execute refresh
    const result = await refreshService.executeRefresh()

    // Verify refresh was successful
    expect(result.success).toBe(true)

    // Verify the ranking calculator was called with normalized district data
    expect(spyRankingCalculator.calculateRankings).toHaveBeenCalledTimes(1)
    const calledWith = spyRankingCalculator.calculateRankings.mock.calls[0][0]

    // Verify the districts have the expected structure and data
    expect(calledWith).toHaveLength(1)
    expect(calledWith[0].districtId).toBe('42')
    expect(calledWith[0].districtPerformance).toBeDefined()
    expect(calledWith[0].districtPerformance).toHaveLength(1)

    // Verify the source data matches what was provided by the scraper
    const districtPerformance = calledWith[0].districtPerformance![0]
    expect(districtPerformance.DISTRICT).toBe('42')
    expect(districtPerformance['% Club Growth']).toBe('25.0')
  })
})
