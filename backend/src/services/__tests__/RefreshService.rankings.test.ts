/**
 * RefreshService Rankings Calculation Tests
 *
 * Tests for all-districts rankings calculation functionality
 * Property 1: All Districts Rankings Completeness
 * Property 4: Version Consistency
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { RefreshService } from '../RefreshService.js'
import { FileSnapshotStore } from '../FileSnapshotStore.js'
import { ToastmastersScraper } from '../ToastmastersScraper.js'
import { RawCSVCacheService } from '../RawCSVCacheService.js'
import { BordaCountRankingCalculator } from '../RankingCalculator.js'
import type { ScrapedRecord } from '../../types/districts.js'
import type { AllDistrictsRankingsData } from '../../types/snapshots.js'

describe('RefreshService - Rankings Calculation', () => {
  let refreshService: RefreshService
  let mockSnapshotStore: FileSnapshotStore
  let mockScraper: ToastmastersScraper
  let mockRawCSVCache: RawCSVCacheService
  let rankingCalculator: BordaCountRankingCalculator

  beforeEach(() => {
    // Create mock instances
    mockSnapshotStore = {
      writeSnapshot: vi.fn(),
      getLatestSuccessful: vi.fn(),
      getLatest: vi.fn(),
      listSnapshots: vi.fn(),
      getSnapshot: vi.fn(),
      isReady: vi.fn().mockResolvedValue(true),
    } as unknown as FileSnapshotStore

    mockScraper = {
      getAllDistricts: vi.fn(),
      getDistrictPerformance: vi.fn(),
      getDivisionPerformance: vi.fn(),
      getClubPerformance: vi.fn(),
      closeBrowser: vi.fn(),
    } as unknown as ToastmastersScraper

    mockRawCSVCache = {
      getAllDistrictsCached: vi.fn(),
      cacheAllDistricts: vi.fn(),
    } as unknown as RawCSVCacheService

    rankingCalculator = new BordaCountRankingCalculator()

    refreshService = new RefreshService(
      mockSnapshotStore,
      mockScraper,
      mockRawCSVCache,
      undefined,
      undefined,
      rankingCalculator
    )
  })

  describe('calculateAllDistrictsRankings', () => {
    it('should calculate rankings with valid data', async () => {
      // Arrange
      const allDistricts: ScrapedRecord[] = [
        {
          DISTRICT: '42',
          REGION: 'Region 5',
          'Paid Clubs': '245',
          'Paid Club Base': '240',
          '% Club Growth': '2.08',
          'Total YTD Payments': '12500',
          'Payment Base': '12000',
          '% Payment Growth': '4.17',
          'Active Clubs': '243',
          'Total Distinguished Clubs': '180',
          'Select Distinguished Clubs': '45',
          'Presidents Distinguished Clubs': '12',
        },
        {
          DISTRICT: '15',
          REGION: 'Region 2',
          'Paid Clubs': '200',
          'Paid Club Base': '195',
          '% Club Growth': '2.56',
          'Total YTD Payments': '10000',
          'Payment Base': '9500',
          '% Payment Growth': '5.26',
          'Active Clubs': '198',
          'Total Distinguished Clubs': '150',
          'Select Distinguished Clubs': '35',
          'Presidents Distinguished Clubs': '10',
        },
      ]

      const metadata = {
        csvDate: '2025-01-07',
        fetchedAt: '2025-01-07T10:00:00.000Z',
        fromCache: false,
      }

      // Act
      const result = await (
        refreshService as any
      ).calculateAllDistrictsRankings(allDistricts, metadata)

      // Assert
      expect(result).toBeDefined()
      expect(result.rankings).toHaveLength(2)
      expect(result.metadata.totalDistricts).toBe(2)
      expect(result.metadata.sourceCsvDate).toBe('2025-01-07')
      expect(result.metadata.fromCache).toBe(false)
      expect(result.metadata.rankingVersion).toBe('2.0')

      // Verify rankings have required fields
      const ranking = result.rankings[0]
      expect(ranking).toBeDefined()
      expect(ranking?.districtId).toBeDefined()
      expect(ranking?.clubsRank).toBeGreaterThan(0)
      expect(ranking?.paymentsRank).toBeGreaterThan(0)
      expect(ranking?.distinguishedRank).toBeGreaterThan(0)
      expect(ranking?.aggregateScore).toBeGreaterThan(0)
    })

    it('should handle error when ranking calculator fails', async () => {
      // Arrange
      const allDistricts: ScrapedRecord[] = [
        {
          DISTRICT: '42',
          REGION: 'Region 5',
        },
      ]

      const metadata = {
        csvDate: '2025-01-07',
        fetchedAt: '2025-01-07T10:00:00.000Z',
        fromCache: false,
      }

      // Mock ranking calculator to throw error
      const failingCalculator = {
        calculateRankings: vi
          .fn()
          .mockRejectedValue(new Error('Calculation failed')),
        getRankingVersion: vi.fn().mockReturnValue('2.0'),
      }

      const serviceWithFailingCalculator = new RefreshService(
        mockSnapshotStore,
        mockScraper,
        mockRawCSVCache,
        undefined,
        undefined,
        failingCalculator as any
      )

      // Act & Assert
      await expect(
        (serviceWithFailingCalculator as any).calculateAllDistrictsRankings(
          allDistricts,
          metadata
        )
      ).rejects.toThrow('Failed to calculate all-districts rankings')
    })

    it('should validate rankings data structure is correct', async () => {
      // Arrange
      const allDistricts: ScrapedRecord[] = [
        {
          DISTRICT: 'F',
          REGION: 'Region 1',
          'Paid Clubs': '150',
          'Paid Club Base': '145',
          '% Club Growth': '3.45',
          'Total YTD Payments': '8000',
          'Payment Base': '7500',
          '% Payment Growth': '6.67',
          'Active Clubs': '148',
          'Total Distinguished Clubs': '120',
          'Select Distinguished Clubs': '30',
          'Presidents Distinguished Clubs': '8',
        },
      ]

      const metadata = {
        csvDate: '2025-01-07',
        fetchedAt: '2025-01-07T10:00:00.000Z',
        fromCache: true,
      }

      // Act
      const result: AllDistrictsRankingsData = await (
        refreshService as any
      ).calculateAllDistrictsRankings(allDistricts, metadata)

      // Assert - Property 1: All Districts Rankings Completeness
      // Validates: Requirements 1.2, 5.2, 6.1, 6.2
      expect(result.metadata).toBeDefined()
      expect(result.metadata.snapshotId).toBe('') // Will be set by caller
      expect(result.metadata.calculatedAt).toBeDefined()
      expect(result.metadata.schemaVersion).toBeDefined()
      expect(result.metadata.calculationVersion).toBeDefined()
      expect(result.metadata.rankingVersion).toBe('2.0')
      expect(result.metadata.sourceCsvDate).toBe('2025-01-07')
      expect(result.metadata.csvFetchedAt).toBe('2025-01-07T10:00:00.000Z')
      expect(result.metadata.totalDistricts).toBe(1)
      expect(result.metadata.fromCache).toBe(true)

      expect(result.rankings).toHaveLength(1)
      const ranking = result.rankings[0]
      expect(ranking).toBeDefined()
      expect(ranking?.districtId).toBe('F')
      expect(ranking?.districtName).toBeDefined()
      expect(ranking?.region).toBe('Region 1')
      expect(ranking?.paidClubs).toBe(150)
      expect(ranking?.paidClubBase).toBe(145)
      expect(ranking?.clubGrowthPercent).toBeCloseTo(3.45, 2)
      expect(ranking?.totalPayments).toBe(8000)
      expect(ranking?.paymentBase).toBe(7500)
      expect(ranking?.paymentGrowthPercent).toBeCloseTo(6.67, 2)
      expect(ranking?.activeClubs).toBe(148)
      expect(ranking?.distinguishedClubs).toBe(120)
      expect(ranking?.selectDistinguished).toBe(30)
      expect(ranking?.presidentsDistinguished).toBe(8)
      expect(ranking?.distinguishedPercent).toBeGreaterThan(0)
      expect(ranking?.clubsRank).toBe(1)
      expect(ranking?.paymentsRank).toBe(1)
      expect(ranking?.distinguishedRank).toBe(1)
      expect(ranking?.aggregateScore).toBeGreaterThan(0)
    })

    it('should ensure version consistency - Property 4', async () => {
      // Arrange
      const allDistricts: ScrapedRecord[] = [
        {
          DISTRICT: '42',
          REGION: 'Region 5',
          'Paid Clubs': '245',
          'Paid Club Base': '240',
          '% Club Growth': '2.08',
          'Total YTD Payments': '12500',
          'Payment Base': '12000',
          '% Payment Growth': '4.17',
          'Active Clubs': '243',
          'Total Distinguished Clubs': '180',
          'Select Distinguished Clubs': '45',
          'Presidents Distinguished Clubs': '12',
        },
      ]

      const metadata = {
        csvDate: '2025-01-07',
        fetchedAt: '2025-01-07T10:00:00.000Z',
        fromCache: false,
      }

      // Act
      const result = await (
        refreshService as any
      ).calculateAllDistrictsRankings(allDistricts, metadata)

      // Assert - Property 4: Version Consistency
      // Validates: Requirements 6.1, 6.2, 6.4
      expect(result.metadata.calculationVersion).toBe('1.0.0')
      expect(result.metadata.schemaVersion).toBe('1.0.0')
      expect(result.metadata.rankingVersion).toBe('2.0')

      // Verify ranking version matches the calculator's version
      expect(result.metadata.rankingVersion).toBe(
        rankingCalculator.getRankingVersion()
      )
    })
  })
})
