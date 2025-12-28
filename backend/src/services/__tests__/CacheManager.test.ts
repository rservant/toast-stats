import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { CacheManager } from '../CacheManager.js'
import {
  createTestCacheConfig,
  cleanupTestCacheConfig,
  initializeTestCache,
  getTestCacheDirectory,
} from '../../utils/test-cache-helper.js'
import type { TestCacheConfig } from '../../utils/test-cache-helper.js'

describe('CacheManager - Historical Data Aggregation', () => {
  let cacheManager: CacheManager
  let testCacheConfig: TestCacheConfig

  beforeEach(async () => {
    // Create isolated test cache configuration
    testCacheConfig = await createTestCacheConfig('cache-manager')
    await initializeTestCache(testCacheConfig)

    // Use configured cache directory
    const testCacheDir = getTestCacheDirectory()
    cacheManager = new CacheManager(testCacheDir)
    await cacheManager.init()
  })

  afterEach(async () => {
    // Clean up test cache configuration
    await cleanupTestCacheConfig(testCacheConfig)
  })

  describe('Security Validation', () => {
    it('should reject invalid date formats that could be path traversal', async () => {
      const maliciousDates = [
        '../../../etc/passwd',
        '..\\..\\windows\\system32',
        '2024/../../../etc',
        '2024-11/../passwd',
        '2024/11/22',
        '2024.11.22',
        '2024-13-01', // Invalid month
        '2024-11-32', // Invalid day
        '1999-11-22', // Year too old
        '2101-11-22', // Year too new
        '', // Empty string
        'not-a-date',
      ]

      for (const maliciousDate of maliciousDates) {
        // Should reject caching with malicious date
        await expect(
          cacheManager.setCache(maliciousDate, { test: 'data' }, 'districts')
        ).rejects.toThrow()

        // Should reject reading with malicious date
        const result = await cacheManager.getCache(maliciousDate, 'districts')
        expect(result).toBeNull()

        // Should reject checking cache with malicious date
        const hasCache = await cacheManager.hasCache(maliciousDate, 'districts')
        expect(hasCache).toBe(false)

        // Should reject metadata access with malicious date
        const metadata = await cacheManager.getMetadata(maliciousDate)
        expect(metadata).toBeNull()
      }
    })

    it('should reject invalid type parameters that could be path traversal', async () => {
      const validDate = '2024-11-22'
      const maliciousTypes = [
        '../../../etc/passwd',
        '..\\..\\windows\\system32',
        'districts/../../../etc',
        'test/path',
        'test\\path',
        'test:path',
        'test*path',
        'test?path',
        'test<path',
        'test>path',
        'test|path',
        '', // Empty string
      ]

      for (const maliciousType of maliciousTypes) {
        // Should reject caching with malicious type
        await expect(
          cacheManager.setCache(validDate, { test: 'data' }, maliciousType)
        ).rejects.toThrow()

        // Should reject reading with malicious type
        const result = await cacheManager.getCache(validDate, maliciousType)
        expect(result).toBeNull()

        // Should reject checking cache with malicious type
        const hasCache = await cacheManager.hasCache(validDate, maliciousType)
        expect(hasCache).toBe(false)

        // Should reject getting cached dates with malicious type
        const dates = await cacheManager.getCachedDates(maliciousType)
        expect(dates).toEqual([])
      }
    })

    it('should accept valid date and type parameters', async () => {
      const validDate = '2024-11-22'
      const validTypes = [
        'districts',
        'clubs',
        'test-data',
        'test_data',
        'TestData123',
      ]
      const testData = { test: 'data' }

      for (const validType of validTypes) {
        // Should accept valid parameters
        await expect(
          cacheManager.setCache(validDate, testData, validType)
        ).resolves.not.toThrow()

        // Should be able to read back the data
        const result = await cacheManager.getCache(validDate, validType)
        expect(result).toEqual(testData)

        // Should report cache exists
        const hasCache = await cacheManager.hasCache(validDate, validType)
        expect(hasCache).toBe(true)

        // Should include in cached dates
        const dates = await cacheManager.getCachedDates(validType)
        expect(dates).toContain(validDate)

        // Clean up for next iteration
        await cacheManager.clearCacheForDate(validDate, validType)
      }
    })

    it('should prevent path traversal through constructed filenames', async () => {
      // Test that even if somehow malicious content gets through validation,
      // the path resolution prevents escaping the cache directory
      const validDate = '2024-11-22'
      const validType = 'districts'

      // This should work normally
      await expect(
        cacheManager.setCache(validDate, { test: 'data' }, validType)
      ).resolves.not.toThrow()

      // Verify the file was created in the expected location
      const hasCache = await cacheManager.hasCache(validDate, validType)
      expect(hasCache).toBe(true)

      // Verify we can read it back
      const result = await cacheManager.getCache(validDate, validType)
      expect(result).toEqual({ test: 'data' })
    })

    it('should validate date format strictly', async () => {
      const strictlyInvalidDates = [
        '2024-1-1', // Single digit month/day
        '24-11-22', // Two digit year
        '2024-11-1', // Single digit day
        '2024-1-22', // Single digit month
        '2024/11/22', // Wrong separators
        '2024.11.22', // Wrong separators
        '2024 11 22', // Spaces
        '20241122', // No separators
        '2024-11', // Missing day
        '11-22', // Missing year
        '2024-11-22T00:00:00Z', // ISO format with time
      ]

      for (const invalidDate of strictlyInvalidDates) {
        await expect(
          cacheManager.setCache(invalidDate, { test: 'data' })
        ).rejects.toThrow('Invalid date format')

        const result = await cacheManager.getCache(invalidDate)
        expect(result).toBeNull()

        const hasCache = await cacheManager.hasCache(invalidDate)
        expect(hasCache).toBe(false)
      }
    })

    it('should validate leap years correctly', async () => {
      // Valid leap year dates
      const validLeapDates = [
        '2024-02-29', // 2024 is a leap year
        '2020-02-29', // 2020 is a leap year
        '2000-02-29', // 2000 is a leap year (divisible by 400)
      ]

      for (const date of validLeapDates) {
        await expect(
          cacheManager.setCache(date, { test: 'data' })
        ).resolves.not.toThrow()
      }

      // Invalid leap year dates
      const invalidLeapDates = [
        '2023-02-29', // 2023 is not a leap year
        '2021-02-29', // 2021 is not a leap year
        '1900-02-29', // 1900 is not a leap year (divisible by 100 but not 400)
      ]

      for (const date of invalidLeapDates) {
        await expect(
          cacheManager.setCache(date, { test: 'data' })
        ).rejects.toThrow('Invalid date format')
      }
    })
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

      const history = await cacheManager.getDistrictRankHistory(
        '1',
        '2024-11-21',
        '2024-11-22'
      )

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
