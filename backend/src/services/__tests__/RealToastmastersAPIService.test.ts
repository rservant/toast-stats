import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { RealToastmastersAPIService } from '../RealToastmastersAPIService.js'
import { ToastmastersScraper } from '../ToastmastersScraper.js'
import { CacheManager } from '../CacheManager.js'

// Mock the dependencies
vi.mock('../ToastmastersScraper.js')
vi.mock('../CacheManager.js')

describe('RealToastmastersAPIService - Borda Count System', () => {
  let apiService: RealToastmastersAPIService
  let mockScraper: any
  let mockCacheManager: any

  beforeEach(() => {
    // Create mock instances
    mockScraper = {
      getAllDistricts: vi.fn(),
      getAllDistrictsForDate: vi.fn(),
      closeBrowser: vi.fn(),
    }

    mockCacheManager = {
      getCache: vi.fn(),
      setCache: vi.fn(),
      getCachedDates: vi.fn(),
      clearCache: vi.fn(),
    }

    // Mock the constructors
    vi.mocked(ToastmastersScraper).mockImplementation(() => mockScraper)
    vi.mocked(CacheManager).mockImplementation(() => mockCacheManager)

    // Mock CacheManager static methods
    vi.spyOn(CacheManager, 'getTodayDate').mockReturnValue('2025-11-22')

    apiService = new RealToastmastersAPIService()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('4.1 Test Borda point calculation accuracy', () => {
    it('should calculate correct Borda points for 10 districts', async () => {
      // Create 10 districts with descending values
      const mockDistricts = Array.from({ length: 10 }, (_, i) => ({
        'DISTRICT': `D${i + 1}`,
        'REGION': 'Region 1',
        'Paid Clubs': String(100 - i * 10), // 100, 90, 80, ..., 10
        'Paid Club Base': '100',
        '% Club Growth': '0%',
        'Total YTD Payments': String(1000 - i * 100), // 1000, 900, 800, ..., 100
        'Payment Base': '1000',
        '% Payment Growth': '0%',
        'Active Clubs': '100',
        'Total Distinguished Clubs': String(50 - i * 5), // 50, 45, 40, ..., 5
        'Select Distinguished Clubs': '0',
        'Presidents Distinguished Clubs': '0',
        '% Distinguished Clubs': '0%',
      }))

      mockCacheManager.getCache.mockResolvedValue(null)
      mockScraper.getAllDistricts.mockResolvedValue(mockDistricts)

      const result = await apiService.getAllDistrictsRankings()

      // Verify Borda points calculation
      // Rank 1 should get 10 points, rank 2 gets 9 points, ..., rank 10 gets 1 point
      const district1 = result.rankings.find((d: any) => d.districtId === 'D1')
      const district10 = result.rankings.find((d: any) => d.districtId === 'D10')

      // D1 has highest values in all categories, so rank 1 in all (10 points each)
      expect(district1.clubsRank).toBe(1)
      expect(district1.paymentsRank).toBe(1)
      expect(district1.distinguishedRank).toBe(1)
      // Aggregate score = 10 + 10 + 10 = 30
      expect(district1.aggregateScore).toBe(30)

      // D10 has lowest values in all categories, so rank 10 in all (1 point each)
      expect(district10.clubsRank).toBe(10)
      expect(district10.paymentsRank).toBe(10)
      expect(district10.distinguishedRank).toBe(10)
      // Aggregate score = 1 + 1 + 1 = 3
      expect(district10.aggregateScore).toBe(3)
    })

    it('should calculate correct Borda points for 100 districts', async () => {
      // Create 100 districts with descending values
      const mockDistricts = Array.from({ length: 100 }, (_, i) => ({
        'DISTRICT': `D${i + 1}`,
        'REGION': 'Region 1',
        'Paid Clubs': String(1000 - i * 10),
        'Paid Club Base': '1000',
        '% Club Growth': '0%',
        'Total YTD Payments': String(10000 - i * 100),
        'Payment Base': '10000',
        '% Payment Growth': '0%',
        'Active Clubs': '1000',
        'Total Distinguished Clubs': String(500 - i * 5),
        'Select Distinguished Clubs': '0',
        'Presidents Distinguished Clubs': '0',
        '% Distinguished Clubs': '0%',
      }))

      mockCacheManager.getCache.mockResolvedValue(null)
      mockScraper.getAllDistricts.mockResolvedValue(mockDistricts)

      const result = await apiService.getAllDistrictsRankings()

      // Verify Borda points calculation
      // Rank 1 should get 100 points, rank 100 gets 1 point
      const district1 = result.rankings.find((d: any) => d.districtId === 'D1')
      const district100 = result.rankings.find((d: any) => d.districtId === 'D100')

      // D1 has highest values in all categories, so rank 1 in all (100 points each)
      expect(district1.clubsRank).toBe(1)
      expect(district1.paymentsRank).toBe(1)
      expect(district1.distinguishedRank).toBe(1)
      // Aggregate score = 100 + 100 + 100 = 300
      expect(district1.aggregateScore).toBe(300)

      // D100 has lowest values in all categories, so rank 100 in all (1 point each)
      expect(district100.clubsRank).toBe(100)
      expect(district100.paymentsRank).toBe(100)
      expect(district100.distinguishedRank).toBe(100)
      // Aggregate score = 1 + 1 + 1 = 3
      expect(district100.aggregateScore).toBe(3)
    })

    it('should calculate correct Borda points for various district counts', async () => {
      // Test with 5 districts
      const mockDistricts = Array.from({ length: 5 }, (_, i) => ({
        'DISTRICT': `D${i + 1}`,
        'REGION': 'Region 1',
        'Paid Clubs': String(50 - i * 10),
        'Paid Club Base': '50',
        '% Club Growth': '0%',
        'Total YTD Payments': String(500 - i * 100),
        'Payment Base': '500',
        '% Payment Growth': '0%',
        'Active Clubs': '50',
        'Total Distinguished Clubs': String(25 - i * 5),
        'Select Distinguished Clubs': '0',
        'Presidents Distinguished Clubs': '0',
        '% Distinguished Clubs': '0%',
      }))

      mockCacheManager.getCache.mockResolvedValue(null)
      mockScraper.getAllDistricts.mockResolvedValue(mockDistricts)

      const result = await apiService.getAllDistrictsRankings()

      // With 5 districts: rank 1 gets 5 points, rank 5 gets 1 point
      const district1 = result.rankings.find((d: any) => d.districtId === 'D1')
      const district3 = result.rankings.find((d: any) => d.districtId === 'D3')
      const district5 = result.rankings.find((d: any) => d.districtId === 'D5')

      // D1: rank 1 in all categories (5 points each) = 15 total
      expect(district1.aggregateScore).toBe(15)

      // D3: rank 3 in all categories (3 points each) = 9 total
      expect(district3.aggregateScore).toBe(9)

      // D5: rank 5 in all categories (1 point each) = 3 total
      expect(district5.aggregateScore).toBe(3)
    })
  })

  describe('4.2 Test tie handling with Borda points', () => {
    it('should assign same Borda points to tied districts', async () => {
      // Create scenario with 3 districts tied for rank 2
      const mockDistricts = [
        {
          'DISTRICT': 'D1',
          'REGION': 'Region 1',
          'Paid Clubs': '100', // Rank 1
          'Paid Club Base': '100',
          '% Club Growth': '0%',
          'Total YTD Payments': '1000',
          'Payment Base': '1000',
          '% Payment Growth': '0%',
          'Active Clubs': '100',
          'Total Distinguished Clubs': '50',
          'Select Distinguished Clubs': '0',
          'Presidents Distinguished Clubs': '0',
          '% Distinguished Clubs': '0%',
        },
        {
          'DISTRICT': 'D2',
          'REGION': 'Region 1',
          'Paid Clubs': '80', // Rank 2 (tied)
          'Paid Club Base': '100',
          '% Club Growth': '0%',
          'Total YTD Payments': '800',
          'Payment Base': '1000',
          '% Payment Growth': '0%',
          'Active Clubs': '100',
          'Total Distinguished Clubs': '40',
          'Select Distinguished Clubs': '0',
          'Presidents Distinguished Clubs': '0',
          '% Distinguished Clubs': '0%',
        },
        {
          'DISTRICT': 'D3',
          'REGION': 'Region 1',
          'Paid Clubs': '80', // Rank 2 (tied)
          'Paid Club Base': '100',
          '% Club Growth': '0%',
          'Total YTD Payments': '800',
          'Payment Base': '1000',
          '% Payment Growth': '0%',
          'Active Clubs': '100',
          'Total Distinguished Clubs': '40',
          'Select Distinguished Clubs': '0',
          'Presidents Distinguished Clubs': '0',
          '% Distinguished Clubs': '0%',
        },
        {
          'DISTRICT': 'D4',
          'REGION': 'Region 1',
          'Paid Clubs': '80', // Rank 2 (tied)
          'Paid Club Base': '100',
          '% Club Growth': '0%',
          'Total YTD Payments': '800',
          'Payment Base': '1000',
          '% Payment Growth': '0%',
          'Active Clubs': '100',
          'Total Distinguished Clubs': '40',
          'Select Distinguished Clubs': '0',
          'Presidents Distinguished Clubs': '0',
          '% Distinguished Clubs': '0%',
        },
        {
          'DISTRICT': 'D5',
          'REGION': 'Region 1',
          'Paid Clubs': '60', // Rank 5
          'Paid Club Base': '100',
          '% Club Growth': '0%',
          'Total YTD Payments': '600',
          'Payment Base': '1000',
          '% Payment Growth': '0%',
          'Active Clubs': '100',
          'Total Distinguished Clubs': '30',
          'Select Distinguished Clubs': '0',
          'Presidents Distinguished Clubs': '0',
          '% Distinguished Clubs': '0%',
        },
      ]

      mockCacheManager.getCache.mockResolvedValue(null)
      mockScraper.getAllDistricts.mockResolvedValue(mockDistricts)

      const result = await apiService.getAllDistrictsRankings()

      const d1 = result.rankings.find((d: any) => d.districtId === 'D1')
      const d2 = result.rankings.find((d: any) => d.districtId === 'D2')
      const d3 = result.rankings.find((d: any) => d.districtId === 'D3')
      const d4 = result.rankings.find((d: any) => d.districtId === 'D4')
      const d5 = result.rankings.find((d: any) => d.districtId === 'D5')

      // All three tied districts should have rank 2
      expect(d2.clubsRank).toBe(2)
      expect(d3.clubsRank).toBe(2)
      expect(d4.clubsRank).toBe(2)

      // With 5 districts, rank 2 gets 4 Borda points (5 - 2 + 1 = 4)
      // All tied districts should get the same Borda points
      // Since they're tied in all categories, their aggregate scores should be equal
      expect(d2.aggregateScore).toBe(d3.aggregateScore)
      expect(d3.aggregateScore).toBe(d4.aggregateScore)

      // D1 should have rank 1 (5 points per category) = 15 total
      expect(d1.clubsRank).toBe(1)
      expect(d1.aggregateScore).toBe(15)

      // D5 should have rank 5 (1 point per category) = 3 total
      expect(d5.clubsRank).toBe(5)
      expect(d5.aggregateScore).toBe(3)

      // Next rank after tie should be 5 (not 3)
      expect(d5.clubsRank).toBe(5)
    })
  })

  describe('4.3 Test aggregate score calculation', () => {
    it('should calculate aggregate score as sum of Borda points from all categories', async () => {
      const mockDistricts = [
        {
          'DISTRICT': 'D1',
          'REGION': 'Region 1',
          'Paid Clubs': '100', // Rank 1 in clubs
          'Paid Club Base': '100',
          '% Club Growth': '0%',
          'Total YTD Payments': '500', // Rank 3 in payments
          'Payment Base': '1000',
          '% Payment Growth': '0%',
          'Active Clubs': '100',
          'Total Distinguished Clubs': '30', // Rank 2 in distinguished
          'Select Distinguished Clubs': '0',
          'Presidents Distinguished Clubs': '0',
          '% Distinguished Clubs': '0%',
        },
        {
          'DISTRICT': 'D2',
          'REGION': 'Region 1',
          'Paid Clubs': '80', // Rank 2 in clubs
          'Paid Club Base': '100',
          '% Club Growth': '0%',
          'Total YTD Payments': '1000', // Rank 1 in payments
          'Payment Base': '1000',
          '% Payment Growth': '0%',
          'Active Clubs': '100',
          'Total Distinguished Clubs': '20', // Rank 3 in distinguished
          'Select Distinguished Clubs': '0',
          'Presidents Distinguished Clubs': '0',
          '% Distinguished Clubs': '0%',
        },
        {
          'DISTRICT': 'D3',
          'REGION': 'Region 1',
          'Paid Clubs': '60', // Rank 3 in clubs
          'Paid Club Base': '100',
          '% Club Growth': '0%',
          'Total YTD Payments': '800', // Rank 2 in payments
          'Payment Base': '1000',
          '% Payment Growth': '0%',
          'Active Clubs': '100',
          'Total Distinguished Clubs': '40', // Rank 1 in distinguished
          'Select Distinguished Clubs': '0',
          'Presidents Distinguished Clubs': '0',
          '% Distinguished Clubs': '0%',
        },
      ]

      mockCacheManager.getCache.mockResolvedValue(null)
      mockScraper.getAllDistricts.mockResolvedValue(mockDistricts)

      const result = await apiService.getAllDistrictsRankings()

      const d1 = result.rankings.find((d: any) => d.districtId === 'D1')
      const d2 = result.rankings.find((d: any) => d.districtId === 'D2')
      const d3 = result.rankings.find((d: any) => d.districtId === 'D3')

      // With 3 districts: rank 1 = 3 points, rank 2 = 2 points, rank 3 = 1 point
      // D1: rank 1 in clubs (3) + rank 3 in payments (1) + rank 2 in distinguished (2) = 6
      expect(d1.clubsRank).toBe(1)
      expect(d1.paymentsRank).toBe(3)
      expect(d1.distinguishedRank).toBe(2)
      expect(d1.aggregateScore).toBe(6)

      // D2: rank 2 in clubs (2) + rank 1 in payments (3) + rank 3 in distinguished (1) = 6
      expect(d2.clubsRank).toBe(2)
      expect(d2.paymentsRank).toBe(1)
      expect(d2.distinguishedRank).toBe(3)
      expect(d2.aggregateScore).toBe(6)

      // D3: rank 3 in clubs (1) + rank 2 in payments (2) + rank 1 in distinguished (3) = 6
      expect(d3.clubsRank).toBe(3)
      expect(d3.paymentsRank).toBe(2)
      expect(d3.distinguishedRank).toBe(1)
      expect(d3.aggregateScore).toBe(6)
    })

    it('should sort districts by aggregate score in descending order', async () => {
      const mockDistricts = [
        {
          'DISTRICT': 'D1',
          'REGION': 'Region 1',
          'Paid Clubs': '100',
          'Paid Club Base': '100',
          '% Club Growth': '0%',
          'Total YTD Payments': '1000',
          'Payment Base': '1000',
          '% Payment Growth': '0%',
          'Active Clubs': '100',
          'Total Distinguished Clubs': '50',
          'Select Distinguished Clubs': '0',
          'Presidents Distinguished Clubs': '0',
          '% Distinguished Clubs': '0%',
        },
        {
          'DISTRICT': 'D2',
          'REGION': 'Region 1',
          'Paid Clubs': '50',
          'Paid Club Base': '100',
          '% Club Growth': '0%',
          'Total YTD Payments': '500',
          'Payment Base': '1000',
          '% Payment Growth': '0%',
          'Active Clubs': '100',
          'Total Distinguished Clubs': '25',
          'Select Distinguished Clubs': '0',
          'Presidents Distinguished Clubs': '0',
          '% Distinguished Clubs': '0%',
        },
        {
          'DISTRICT': 'D3',
          'REGION': 'Region 1',
          'Paid Clubs': '75',
          'Paid Club Base': '100',
          '% Club Growth': '0%',
          'Total YTD Payments': '750',
          'Payment Base': '1000',
          '% Payment Growth': '0%',
          'Active Clubs': '100',
          'Total Distinguished Clubs': '37',
          'Select Distinguished Clubs': '0',
          'Presidents Distinguished Clubs': '0',
          '% Distinguished Clubs': '0%',
        },
      ]

      mockCacheManager.getCache.mockResolvedValue(null)
      mockScraper.getAllDistricts.mockResolvedValue(mockDistricts)

      const result = await apiService.getAllDistrictsRankings()

      // Verify sorting: higher aggregate scores should appear first
      expect(result.rankings[0].aggregateScore).toBeGreaterThanOrEqual(result.rankings[1].aggregateScore)
      expect(result.rankings[1].aggregateScore).toBeGreaterThanOrEqual(result.rankings[2].aggregateScore)

      // D1 should be first (highest in all categories)
      expect(result.rankings[0].districtId).toBe('D1')
      // D3 should be second (middle in all categories)
      expect(result.rankings[1].districtId).toBe('D3')
      // D2 should be last (lowest in all categories)
      expect(result.rankings[2].districtId).toBe('D2')
    })

    it('should ensure higher aggregate scores appear first in rankings', async () => {
      const mockDistricts = Array.from({ length: 10 }, (_, i) => ({
        'DISTRICT': `D${i + 1}`,
        'REGION': 'Region 1',
        'Paid Clubs': String(100 - i * 10),
        'Paid Club Base': '100',
        '% Club Growth': '0%',
        'Total YTD Payments': String(1000 - i * 100),
        'Payment Base': '1000',
        '% Payment Growth': '0%',
        'Active Clubs': '100',
        'Total Distinguished Clubs': String(50 - i * 5),
        'Select Distinguished Clubs': '0',
        'Presidents Distinguished Clubs': '0',
        '% Distinguished Clubs': '0%',
      }))

      mockCacheManager.getCache.mockResolvedValue(null)
      mockScraper.getAllDistricts.mockResolvedValue(mockDistricts)

      const result = await apiService.getAllDistrictsRankings()

      // Verify that rankings are in descending order by aggregate score
      for (let i = 0; i < result.rankings.length - 1; i++) {
        expect(result.rankings[i].aggregateScore).toBeGreaterThanOrEqual(
          result.rankings[i + 1].aggregateScore
        )
      }

      // First district should have highest aggregate score
      expect(result.rankings[0].districtId).toBe('D1')
      expect(result.rankings[0].aggregateScore).toBe(30) // 10 + 10 + 10

      // Last district should have lowest aggregate score
      expect(result.rankings[9].districtId).toBe('D10')
      expect(result.rankings[9].aggregateScore).toBe(3) // 1 + 1 + 1
    })
  })

  describe('4.4 Test edge cases', () => {
    it('should handle scenario where all districts have same value (all rank 1)', async () => {
      const mockDistricts = Array.from({ length: 5 }, (_, i) => ({
        'DISTRICT': `D${i + 1}`,
        'REGION': 'Region 1',
        'Paid Clubs': '100', // All same
        'Paid Club Base': '100',
        '% Club Growth': '0%',
        'Total YTD Payments': '1000', // All same
        'Payment Base': '1000',
        '% Payment Growth': '0%',
        'Active Clubs': '100',
        'Total Distinguished Clubs': '50', // All same
        'Select Distinguished Clubs': '0',
        'Presidents Distinguished Clubs': '0',
        '% Distinguished Clubs': '0%',
      }))

      mockCacheManager.getCache.mockResolvedValue(null)
      mockScraper.getAllDistricts.mockResolvedValue(mockDistricts)

      const result = await apiService.getAllDistrictsRankings()

      // All districts should have rank 1
      result.rankings.forEach((district: any) => {
        expect(district.clubsRank).toBe(1)
        expect(district.paymentsRank).toBe(1)
        expect(district.distinguishedRank).toBe(1)
        // With 5 districts, rank 1 gets 5 points per category
        expect(district.aggregateScore).toBe(15) // 5 + 5 + 5
      })
    })

    it('should handle district with 0 values in all categories', async () => {
      const mockDistricts = [
        {
          'DISTRICT': 'D1',
          'REGION': 'Region 1',
          'Paid Clubs': '100',
          'Paid Club Base': '100',
          '% Club Growth': '0%',
          'Total YTD Payments': '1000',
          'Payment Base': '1000',
          '% Payment Growth': '0%',
          'Active Clubs': '100',
          'Total Distinguished Clubs': '50',
          'Select Distinguished Clubs': '0',
          'Presidents Distinguished Clubs': '0',
          '% Distinguished Clubs': '0%',
        },
        {
          'DISTRICT': 'D2',
          'REGION': 'Region 1',
          'Paid Clubs': '0', // Zero values
          'Paid Club Base': '100',
          '% Club Growth': '0%',
          'Total YTD Payments': '0',
          'Payment Base': '1000',
          '% Payment Growth': '0%',
          'Active Clubs': '100',
          'Total Distinguished Clubs': '0',
          'Select Distinguished Clubs': '0',
          'Presidents Distinguished Clubs': '0',
          '% Distinguished Clubs': '0%',
        },
      ]

      mockCacheManager.getCache.mockResolvedValue(null)
      mockScraper.getAllDistricts.mockResolvedValue(mockDistricts)

      const result = await apiService.getAllDistrictsRankings()

      const d1 = result.rankings.find((d: any) => d.districtId === 'D1')
      const d2 = result.rankings.find((d: any) => d.districtId === 'D2')

      // D1 should rank 1 in all categories (2 points each with 2 districts)
      expect(d1.clubsRank).toBe(1)
      expect(d1.paymentsRank).toBe(1)
      expect(d1.distinguishedRank).toBe(1)
      expect(d1.aggregateScore).toBe(6) // 2 + 2 + 2

      // D2 should rank 2 in all categories (1 point each with 2 districts)
      expect(d2.clubsRank).toBe(2)
      expect(d2.paymentsRank).toBe(2)
      expect(d2.distinguishedRank).toBe(2)
      expect(d2.aggregateScore).toBe(3) // 1 + 1 + 1
    })

    it('should handle single district in system', async () => {
      const mockDistricts = [
        {
          'DISTRICT': 'D1',
          'REGION': 'Region 1',
          'Paid Clubs': '100',
          'Paid Club Base': '100',
          '% Club Growth': '0%',
          'Total YTD Payments': '1000',
          'Payment Base': '1000',
          '% Payment Growth': '0%',
          'Active Clubs': '100',
          'Total Distinguished Clubs': '50',
          'Select Distinguished Clubs': '0',
          'Presidents Distinguished Clubs': '0',
          '% Distinguished Clubs': '0%',
        },
      ]

      mockCacheManager.getCache.mockResolvedValue(null)
      mockScraper.getAllDistricts.mockResolvedValue(mockDistricts)

      const result = await apiService.getAllDistrictsRankings()

      expect(result.rankings).toHaveLength(1)

      const d1 = result.rankings[0]
      // Single district should have rank 1 in all categories
      expect(d1.clubsRank).toBe(1)
      expect(d1.paymentsRank).toBe(1)
      expect(d1.distinguishedRank).toBe(1)
      // With 1 district, rank 1 gets 1 point per category
      expect(d1.aggregateScore).toBe(3) // 1 + 1 + 1
    })

    it('should handle missing or null values', async () => {
      const mockDistricts = [
        {
          'DISTRICT': 'D1',
          'REGION': 'Region 1',
          'Paid Clubs': '100',
          'Paid Club Base': '100',
          '% Club Growth': '0%',
          'Total YTD Payments': '1000',
          'Payment Base': '1000',
          '% Payment Growth': '0%',
          'Active Clubs': '100',
          'Total Distinguished Clubs': '50',
          'Select Distinguished Clubs': '0',
          'Presidents Distinguished Clubs': '0',
          '% Distinguished Clubs': '0%',
        },
        {
          'DISTRICT': 'D2',
          'REGION': 'Region 1',
          'Paid Clubs': '', // Missing value
          'Paid Club Base': '100',
          '% Club Growth': '0%',
          'Total YTD Payments': null, // Null value
          'Payment Base': '1000',
          '% Payment Growth': '0%',
          'Active Clubs': '100',
          'Total Distinguished Clubs': undefined, // Undefined value
          'Select Distinguished Clubs': '0',
          'Presidents Distinguished Clubs': '0',
          '% Distinguished Clubs': '0%',
        },
      ]

      mockCacheManager.getCache.mockResolvedValue(null)
      mockScraper.getAllDistricts.mockResolvedValue(mockDistricts)

      const result = await apiService.getAllDistrictsRankings()

      const d2 = result.rankings.find((d: any) => d.districtId === 'D2')

      // Missing/null values should be treated as 0
      expect(d2.paidClubs).toBe(0)
      expect(d2.totalPayments).toBe(0)
      expect(d2.distinguishedClubs).toBe(0)

      // D2 should rank 2 in all categories (lowest values)
      expect(d2.clubsRank).toBe(2)
      expect(d2.paymentsRank).toBe(2)
      expect(d2.distinguishedRank).toBe(2)
    })
  })
})
