import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { DistrictCacheManager } from '../DistrictCacheManager'
import {
  createTestCacheConfig,
  cleanupTestCacheConfig,
  initializeTestCache,
  getTestCacheDirectory,
} from '../../utils/test-cache-helper'
import type { TestCacheConfig } from '../../utils/test-cache-helper'

describe('DistrictCacheManager', () => {
  let cacheManager: DistrictCacheManager
  let testCacheConfig: TestCacheConfig

  beforeEach(async () => {
    // Create isolated test cache configuration
    testCacheConfig = await createTestCacheConfig('district-cache-manager')
    await initializeTestCache(testCacheConfig)

    // Use configured cache directory
    const testCacheDir = getTestCacheDirectory()
    cacheManager = new DistrictCacheManager(testCacheDir)
  })

  afterEach(async () => {
    // Clean up test cache configuration
    await cleanupTestCacheConfig(testCacheConfig)
  })

  describe('cacheDistrictData', () => {
    it('should cache all three report types together', async () => {
      const districtId = '42'
      const date = '2024-11-22'
      const districtPerformance = [{ metric: 'district1' }]
      const divisionPerformance = [{ metric: 'division1' }]
      const clubPerformance = [{ metric: 'club1' }]

      await cacheManager.cacheDistrictData(
        districtId,
        date,
        districtPerformance,
        divisionPerformance,
        clubPerformance
      )

      const cached = await cacheManager.getDistrictData(districtId, date)

      expect(cached).toBeDefined()
      expect(cached?.districtId).toBe(districtId)
      expect(cached?.date).toBe(date)
      expect(cached?.districtPerformance).toEqual(districtPerformance)
      expect(cached?.divisionPerformance).toEqual(divisionPerformance)
      expect(cached?.clubPerformance).toEqual(clubPerformance)
      expect(cached?.fetchedAt).toBeDefined()
    })

    it('should create district directory structure', async () => {
      const districtId = '42'
      const date = '2024-11-22'

      await cacheManager.cacheDistrictData(districtId, date, [], [], [])

      const dates = await cacheManager.getCachedDatesForDistrict(districtId)
      expect(dates).toContain(date)
    })

    it('should handle atomic writes correctly', async () => {
      const districtId = '42'
      const date = '2024-11-22'
      const districtPerformance = [{ metric: 'test' }]

      await cacheManager.cacheDistrictData(
        districtId,
        date,
        districtPerformance,
        [],
        []
      )

      // Verify no temp files left behind
      const dates = await cacheManager.getCachedDatesForDistrict(districtId)
      expect(dates).toEqual([date])
    })
  })

  describe('getDistrictData', () => {
    it('should return null for non-existent data', async () => {
      const cached = await cacheManager.getDistrictData('99', '2024-11-22')
      expect(cached).toBeNull()
    })

    it('should retrieve cached data correctly', async () => {
      const districtId = '42'
      const date = '2024-11-22'
      const districtPerformance = [{ id: 1, name: 'Test' }]
      const divisionPerformance = [{ id: 2, name: 'Division' }]
      const clubPerformance = [{ id: 3, name: 'Club' }]

      await cacheManager.cacheDistrictData(
        districtId,
        date,
        districtPerformance,
        divisionPerformance,
        clubPerformance
      )

      const cached = await cacheManager.getDistrictData(districtId, date)

      expect(cached?.districtPerformance).toEqual(districtPerformance)
      expect(cached?.divisionPerformance).toEqual(divisionPerformance)
      expect(cached?.clubPerformance).toEqual(clubPerformance)
    })
  })

  describe('getCachedDatesForDistrict', () => {
    it('should return empty array for district with no cache', async () => {
      const dates = await cacheManager.getCachedDatesForDistrict('99')
      expect(dates).toEqual([])
    })

    it('should return sorted list of cached dates', async () => {
      const districtId = '42'
      const testDates = ['2024-11-22', '2024-11-20', '2024-11-21']

      for (const date of testDates) {
        await cacheManager.cacheDistrictData(districtId, date, [], [], [])
      }

      const dates = await cacheManager.getCachedDatesForDistrict(districtId)

      expect(dates).toEqual(['2024-11-20', '2024-11-21', '2024-11-22'])
    })

    it('should not include temp files', async () => {
      const districtId = '42'
      const date = '2024-11-22'

      await cacheManager.cacheDistrictData(districtId, date, [], [], [])

      const dates = await cacheManager.getCachedDatesForDistrict(districtId)
      expect(dates).toEqual([date])
    })
  })

  describe('hasDistrictData', () => {
    it('should return false for non-existent data', async () => {
      const exists = await cacheManager.hasDistrictData('99', '2024-11-22')
      expect(exists).toBe(false)
    })

    it('should return true for cached data', async () => {
      const districtId = '42'
      const date = '2024-11-22'

      await cacheManager.cacheDistrictData(districtId, date, [], [], [])

      const exists = await cacheManager.hasDistrictData(districtId, date)
      expect(exists).toBe(true)
    })
  })

  describe('getDistrictDataRange', () => {
    it('should return null for district with no cache', async () => {
      const range = await cacheManager.getDistrictDataRange('99')
      expect(range).toBeNull()
    })

    it('should return correct date range', async () => {
      const districtId = '42'
      const dates = ['2024-11-20', '2024-11-22', '2024-11-21', '2024-11-25']

      for (const date of dates) {
        await cacheManager.cacheDistrictData(districtId, date, [], [], [])
      }

      const range = await cacheManager.getDistrictDataRange(districtId)

      expect(range).toEqual({
        startDate: '2024-11-20',
        endDate: '2024-11-25',
      })
    })

    it('should handle single date correctly', async () => {
      const districtId = '42'
      const date = '2024-11-22'

      await cacheManager.cacheDistrictData(districtId, date, [], [], [])

      const range = await cacheManager.getDistrictDataRange(districtId)

      expect(range).toEqual({
        startDate: date,
        endDate: date,
      })
    })
  })

  describe('clearDistrictCache', () => {
    it('should clear all cached data for a district', async () => {
      const districtId = '42'
      const dates = ['2024-11-20', '2024-11-21', '2024-11-22']

      for (const date of dates) {
        await cacheManager.cacheDistrictData(districtId, date, [], [], [])
      }

      await cacheManager.clearDistrictCache(districtId)

      const cachedDates =
        await cacheManager.getCachedDatesForDistrict(districtId)
      expect(cachedDates).toEqual([])
    })

    it('should not throw error for non-existent district', async () => {
      await expect(cacheManager.clearDistrictCache('99')).resolves.not.toThrow()
    })
  })

  describe('clearDistrictCacheForDate', () => {
    it('should clear cache for specific date', async () => {
      const districtId = '42'
      const dates = ['2024-11-20', '2024-11-21', '2024-11-22']

      for (const date of dates) {
        await cacheManager.cacheDistrictData(districtId, date, [], [], [])
      }

      await cacheManager.clearDistrictCacheForDate(districtId, '2024-11-21')

      const cachedDates =
        await cacheManager.getCachedDatesForDistrict(districtId)
      expect(cachedDates).toEqual(['2024-11-20', '2024-11-22'])
    })

    it('should not throw error for non-existent date', async () => {
      await expect(
        cacheManager.clearDistrictCacheForDate('42', '2024-11-22')
      ).resolves.not.toThrow()
    })
  })

  describe('getCachedDistricts', () => {
    it('should return empty array when no districts cached', async () => {
      const districts = await cacheManager.getCachedDistricts()
      expect(districts).toEqual([])
    })

    it('should return sorted list of cached districts', async () => {
      const districtIds = ['42', '10', '99', '5']

      for (const districtId of districtIds) {
        await cacheManager.cacheDistrictData(
          districtId,
          '2024-11-22',
          [],
          [],
          []
        )
      }

      const districts = await cacheManager.getCachedDistricts()
      expect(districts).toEqual(['10', '42', '5', '99'])
    })
  })

  describe('security validation', () => {
    it('should reject district IDs with path traversal attempts', async () => {
      const maliciousIds = [
        '../../../etc/passwd',
        '..\\..\\windows\\system32',
        '../test',
        'test/../other',
      ]

      for (const maliciousId of maliciousIds) {
        await expect(
          cacheManager.cacheDistrictData(maliciousId, '2024-11-22', [], [], [])
        ).rejects.toThrow('Invalid districtId for cache directory')

        await expect(
          cacheManager.getDistrictData(maliciousId, '2024-11-22')
        ).rejects.toThrow('Invalid districtId for cache file path')

        await expect(
          cacheManager.getCachedDatesForDistrict(maliciousId)
        ).rejects.toThrow('Invalid district ID')

        await expect(
          cacheManager.clearDistrictCache(maliciousId)
        ).rejects.toThrow('Invalid district ID')
      }
    })

    it('should reject district IDs with special characters', async () => {
      const invalidIds = [
        'test/path',
        'test\\path',
        'test:path',
        'test*path',
        'test?path',
        'test<path',
        'test>path',
        'test|path',
      ]

      for (const invalidId of invalidIds) {
        await expect(
          cacheManager.cacheDistrictData(invalidId, '2024-11-22', [], [], [])
        ).rejects.toThrow('Invalid districtId for cache directory')

        await expect(
          cacheManager.getCachedDatesForDistrict(invalidId)
        ).rejects.toThrow('Invalid district ID')
      }
    })

    it('should accept valid district IDs', async () => {
      const validIds = [
        '42',
        'D42',
        'district-123',
        'district_456',
        'ABC-123_XYZ',
      ]

      for (const validId of validIds) {
        await expect(
          cacheManager.cacheDistrictData(validId, '2024-11-22', [], [], [])
        ).resolves.not.toThrow()

        await expect(
          cacheManager.getCachedDatesForDistrict(validId)
        ).resolves.not.toThrow()

        await expect(
          cacheManager.clearDistrictCache(validId)
        ).resolves.not.toThrow()
      }
    })

    it('should reject invalid date formats that could be path traversal', async () => {
      const invalidDates = ['../../../etc/passwd', '2024/11/22', '2024.11.22']

      for (const invalidDate of invalidDates) {
        await expect(
          cacheManager.cacheDistrictData('42', invalidDate, [], [], [])
        ).rejects.toThrow('Invalid date for cache file path')

        await expect(
          cacheManager.getDistrictData('42', invalidDate)
        ).rejects.toThrow('Invalid date for cache file path')
      }
    })
  })
})
