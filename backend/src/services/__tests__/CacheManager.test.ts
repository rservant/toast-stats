import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { CacheManager } from '../CacheManager.js'
import fs from 'fs/promises'

describe('CacheManager - Historical Data Aggregation', () => {
  const testCacheDir = './test-cache'
  let cacheManager: CacheManager

  beforeEach(async () => {
    cacheManager = new CacheManager(testCacheDir)
    await cacheManager.init()
  })

  afterEach(async () => {
    // Clean up test cache directory
    try {
      await fs.rm(testCacheDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('Metadata Tracking', () => {
    it('should create metadata when caching district data', async () => {
      const testDate = '2024-11-22'
      const testData = {
        rankings: [
          {
            districtId: '1',
            districtName: 'District 1',
            aggregateScore: 10,
            clubsRank: 3,
            paymentsRank: 4,
            distinguishedRank: 3,
            paidClubs: 100,
            totalPayments: 5000,
            distinguishedClubs: 30,
          },
          {
            districtId: '2',
            districtName: 'District 2',
            aggregateScore: 15,
            clubsRank: 5,
            paymentsRank: 5,
            distinguishedRank: 5,
            paidClubs: 80,
            totalPayments: 4000,
            distinguishedClubs: 25,
          },
        ],
        date: testDate,
      }

      await cacheManager.setCache(testDate, testData, 'districts')

      const metadata = await cacheManager.getMetadata(testDate)
      
      expect(metadata).toBeDefined()
      expect(metadata?.date).toBe(testDate)
      expect(metadata?.districtCount).toBe(2)
      expect(metadata?.dataCompleteness).toBe('partial') // Less than 50 districts
      expect(metadata?.source).toBe('scraper')
    })

    it('should mark data as complete when district count is high', async () => {
      const testDate = '2024-11-23'
      const rankings = Array.from({ length: 100 }, (_, i) => ({
        districtId: String(i + 1),
        districtName: `District ${i + 1}`,
        aggregateScore: i + 10,
        clubsRank: i + 1,
        paymentsRank: i + 1,
        distinguishedRank: i + 1,
        paidClubs: 100 + i,
        totalPayments: 5000 + i * 100,
        distinguishedClubs: 30 + i,
      }))

      const testData = { rankings, date: testDate }

      await cacheManager.setCache(testDate, testData, 'districts')

      const metadata = await cacheManager.getMetadata(testDate)
      
      expect(metadata?.dataCompleteness).toBe('complete')
      expect(metadata?.districtCount).toBe(100)
    })
  })

  describe('Historical Index', () => {
    it('should build historical index when caching data', async () => {
      const testDate1 = '2024-11-20'
      const testDate2 = '2024-11-21'
      
      const testData1 = {
        rankings: [
          {
            districtId: '1',
            districtName: 'District 1',
            aggregateScore: 10,
            clubsRank: 3,
            paymentsRank: 4,
            distinguishedRank: 3,
            paidClubs: 100,
            totalPayments: 5000,
            distinguishedClubs: 30,
          },
        ],
        date: testDate1,
      }

      const testData2 = {
        rankings: [
          {
            districtId: '1',
            districtName: 'District 1',
            aggregateScore: 12,
            clubsRank: 4,
            paymentsRank: 4,
            distinguishedRank: 4,
            paidClubs: 102,
            totalPayments: 5100,
            distinguishedClubs: 31,
          },
        ],
        date: testDate2,
      }

      await cacheManager.setCache(testDate1, testData1, 'districts')
      await cacheManager.setCache(testDate2, testData2, 'districts')

      // Load index and verify
      await cacheManager.loadHistoricalIndex()
      
      const history = await cacheManager.getDistrictRankHistory('1')
      
      expect(history).toHaveLength(2)
      expect(history[0].date).toBe(testDate1)
      expect(history[0].aggregateScore).toBe(10)
      expect(history[1].date).toBe(testDate2)
      expect(history[1].aggregateScore).toBe(12)
    })

    it('should filter history by date range', async () => {
      const dates = ['2024-11-20', '2024-11-21', '2024-11-22', '2024-11-23']
      
      for (const date of dates) {
        const testData = {
          rankings: [
            {
              districtId: '1',
              districtName: 'District 1',
              aggregateScore: 10,
              clubsRank: 3,
              paymentsRank: 4,
              distinguishedRank: 3,
              paidClubs: 100,
              totalPayments: 5000,
              distinguishedClubs: 30,
            },
          ],
          date,
        }
        await cacheManager.setCache(date, testData, 'districts')
      }

      await cacheManager.loadHistoricalIndex()
      
      const history = await cacheManager.getDistrictRankHistory('1', '2024-11-21', '2024-11-22')
      
      expect(history).toHaveLength(2)
      expect(history[0].date).toBe('2024-11-21')
      expect(history[1].date).toBe('2024-11-22')
    })
  })

  describe('Cache Statistics', () => {
    it('should calculate cache statistics correctly', async () => {
      const dates = ['2024-11-20', '2024-11-21', '2024-11-22']
      
      for (const date of dates) {
        const rankings = Array.from({ length: 100 }, (_, i) => ({
          districtId: String(i + 1),
          districtName: `District ${i + 1}`,
          aggregateScore: i + 10,
          clubsRank: i + 1,
          paymentsRank: i + 1,
          distinguishedRank: i + 1,
          paidClubs: 100 + i,
          totalPayments: 5000 + i * 100,
          distinguishedClubs: 30 + i,
        }))
        
        const testData = { rankings, date }
        await cacheManager.setCache(date, testData, 'districts')
      }

      const stats = await cacheManager.getCacheStatistics()
      
      expect(stats.totalDates).toBe(3)
      expect(stats.dateRange.earliest).toBe('2024-11-20')
      expect(stats.dateRange.latest).toBe('2024-11-22')
      expect(stats.completeDates).toBe(3)
      expect(stats.totalDistricts).toBe(100)
      expect(stats.cacheSize).toBeGreaterThan(0)
    })
  })
})
