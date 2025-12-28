import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { DistrictBackfillService } from '../DistrictBackfillService.ts'
import { DistrictCacheManager } from '../DistrictCacheManager.ts'
import { ToastmastersScraper } from '../ToastmastersScraper.ts'
import type { ScrapedRecord } from '../../types/districts.ts'
import {
  createTestCacheConfig,
  cleanupTestCacheConfig,
  type TestCacheConfig,
} from '../../utils/test-cache-helper.ts'

// Mock interface for ToastmastersScraper
interface MockToastmastersScraper {
  config: { baseUrl: string; headless: boolean; timeout: number }
  browser: null
  getProgramYear: (dateString: string) => string
  buildBaseUrl: (dateString: string) => string
  closeBrowser: () => Promise<void>
  getAllDistrictsList: () => Promise<Array<{ id: string; name: string }>>
  getAllDistricts: () => Promise<ScrapedRecord[]>
  getAllDistrictsForDate: (dateString: string) => Promise<ScrapedRecord[]>
  getDistrictPerformance: (
    districtId: string,
    dateString?: string
  ) => Promise<ScrapedRecord[]>
  getDivisionPerformance: (
    districtId: string,
    dateString?: string
  ) => Promise<ScrapedRecord[]>
  getClubPerformance: (
    districtId: string,
    dateString?: string
  ) => Promise<ScrapedRecord[]>
  scrapePage: (url: string, selector: string) => Promise<string>
}

describe('DistrictBackfillService', () => {
  let testCacheConfig: TestCacheConfig
  let cacheManager: DistrictCacheManager
  let scraper: ToastmastersScraper
  let backfillService: DistrictBackfillService

  beforeEach(async () => {
    testCacheConfig = await createTestCacheConfig('district-backfill-service')
    cacheManager = new DistrictCacheManager(testCacheConfig.cacheDir)
    scraper = new ToastmastersScraper()
    backfillService = new DistrictBackfillService(cacheManager, scraper)
  })

  afterEach(async () => {
    await cleanupTestCacheConfig(testCacheConfig)
  })

  describe('initiateDistrictBackfill', () => {
    it('should create a backfill job with unique ID', async () => {
      const districtId = '42'
      const startDate = '2024-11-01'
      const endDate = '2024-11-05'

      const backfillId = await backfillService.initiateDistrictBackfill({
        districtId,
        startDate,
        endDate,
      })

      expect(backfillId).toBeDefined()
      expect(typeof backfillId).toBe('string')
      expect(backfillId.length).toBeGreaterThan(0)
    })

    it('should track job status and progress', async () => {
      const districtId = '42'
      const startDate = '2024-11-01'
      const endDate = '2024-11-03'

      const backfillId = await backfillService.initiateDistrictBackfill({
        districtId,
        startDate,
        endDate,
      })

      const status = backfillService.getBackfillStatus(backfillId)

      expect(status).toBeDefined()
      expect(status?.backfillId).toBe(backfillId)
      expect(status?.districtId).toBe(districtId)
      expect(status?.status).toBe('processing')
      expect(status?.progress).toBeDefined()
      expect(status?.progress.total).toBeGreaterThan(0)
    })

    it('should reject invalid date range', async () => {
      const districtId = '42'
      const startDate = '2024-11-10'
      const endDate = '2024-11-05' // End before start

      await expect(
        backfillService.initiateDistrictBackfill({
          districtId,
          startDate,
          endDate,
        })
      ).rejects.toThrow('Start date must be before or equal to end date')
    })

    it('should reject future end date', async () => {
      const districtId = '42'
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 10)
      const endDate = futureDate.toISOString().split('T')[0]

      await expect(
        backfillService.initiateDistrictBackfill({
          districtId,
          endDate,
        })
      ).rejects.toThrow('End date cannot be in the future')
    })

    it('should skip already cached dates', async () => {
      const districtId = '42'
      const date = '2024-11-01'

      // Pre-cache one date
      await cacheManager.cacheDistrictData(districtId, date, [], [], [])

      const backfillId = await backfillService.initiateDistrictBackfill({
        districtId,
        startDate: date,
        endDate: '2024-11-03',
      })

      const status = backfillService.getBackfillStatus(backfillId)

      expect(status?.progress.skipped).toBe(1)
      expect(status?.progress.total).toBe(2) // Only 2 missing dates
    })

    it('should reject when all dates are already cached', async () => {
      const districtId = '42'
      const dates = ['2024-11-01', '2024-11-02', '2024-11-03']

      // Pre-cache all dates
      for (const date of dates) {
        await cacheManager.cacheDistrictData(districtId, date, [], [], [])
      }

      await expect(
        backfillService.initiateDistrictBackfill({
          districtId,
          startDate: dates[0],
          endDate: dates[dates.length - 1],
        })
      ).rejects.toThrow('All dates in the range are already cached')
    })
  })

  describe('getBackfillStatus', () => {
    it('should return null for non-existent job', () => {
      const status = backfillService.getBackfillStatus('non-existent-id')
      expect(status).toBeNull()
    })

    it('should return current job status', async () => {
      const districtId = '42'
      const backfillId = await backfillService.initiateDistrictBackfill({
        districtId,
        startDate: '2024-11-01',
        endDate: '2024-11-03',
      })

      const status = backfillService.getBackfillStatus(backfillId)

      expect(status).toBeDefined()
      expect(status?.backfillId).toBe(backfillId)
      expect(status?.districtId).toBe(districtId)
      expect(['processing', 'complete', 'error']).toContain(status?.status)
    })
  })

  describe('cancelBackfill', () => {
    it('should cancel a processing job', async () => {
      const districtId = '42'
      const backfillId = await backfillService.initiateDistrictBackfill({
        districtId,
        startDate: '2024-11-01',
        endDate: '2024-11-10', // Longer range to ensure it's still processing
      })

      // Cancel immediately
      const cancelled = await backfillService.cancelBackfill(backfillId)

      expect(cancelled).toBe(true)

      const status = backfillService.getBackfillStatus(backfillId)
      expect(status?.status).toBe('error')
      expect(status?.error).toContain('cancelled')
    })

    it('should return false for non-existent job', async () => {
      const cancelled = await backfillService.cancelBackfill('non-existent-id')
      expect(cancelled).toBe(false)
    })
  })

  describe('error handling', () => {
    it('should handle scraper errors gracefully', async () => {
      // Mock scraper to throw errors
      const errorScraper: MockToastmastersScraper = {
        config: { baseUrl: 'test', headless: true, timeout: 30000 },
        browser: null,
        getProgramYear: vi.fn().mockReturnValue('2024-2025'),
        buildBaseUrl: vi.fn().mockReturnValue('test-url'),
        closeBrowser: vi.fn().mockResolvedValue(undefined),
        getAllDistrictsList: vi.fn().mockResolvedValue([]),
        getAllDistricts: vi.fn().mockResolvedValue([]),
        getAllDistrictsForDate: vi.fn().mockResolvedValue([]),
        scrapePage: vi.fn().mockResolvedValue(''),
        getDistrictPerformance: vi
          .fn()
          .mockRejectedValue(new Error('Scraper error')),
        getDivisionPerformance: vi
          .fn()
          .mockRejectedValue(new Error('Scraper error')),
        getClubPerformance: vi
          .fn()
          .mockRejectedValue(new Error('Scraper error')),
      }

      const errorBackfillService = new DistrictBackfillService(
        cacheManager,
        errorScraper as unknown as ToastmastersScraper
      )

      const backfillId = await errorBackfillService.initiateDistrictBackfill({
        districtId: '42',
        startDate: '2024-11-01',
        endDate: '2024-11-02',
      })

      // Wait a bit for processing
      await new Promise(resolve => setTimeout(resolve, 100))

      const status = errorBackfillService.getBackfillStatus(backfillId)

      // Should track failed dates
      expect(status?.progress.failed).toBeGreaterThan(0)
    })

    it('should continue processing after individual date failures', async () => {
      // Mock scraper to fail on first date, succeed on second
      let callCount = 0
      const mixedScraper: MockToastmastersScraper = {
        config: { baseUrl: 'test', headless: true, timeout: 30000 },
        browser: null,
        getProgramYear: vi.fn().mockReturnValue('2024-2025'),
        buildBaseUrl: vi.fn().mockReturnValue('test-url'),
        closeBrowser: vi.fn().mockResolvedValue(undefined),
        getAllDistrictsList: vi.fn().mockResolvedValue([]),
        getAllDistricts: vi.fn().mockResolvedValue([]),
        getAllDistrictsForDate: vi.fn().mockResolvedValue([]),
        scrapePage: vi.fn().mockResolvedValue(''),
        getDistrictPerformance: vi.fn().mockImplementation(() => {
          callCount++
          if (callCount === 1) {
            return Promise.reject(new Error('First date error'))
          }
          return Promise.resolve([{ test: 'data' }])
        }),
        getDivisionPerformance: vi.fn().mockResolvedValue([]),
        getClubPerformance: vi.fn().mockResolvedValue([]),
      }

      const mixedBackfillService = new DistrictBackfillService(
        cacheManager,
        mixedScraper as unknown as ToastmastersScraper
      )

      const backfillId = await mixedBackfillService.initiateDistrictBackfill({
        districtId: '42',
        startDate: '2024-11-01',
        endDate: '2024-11-02',
      })

      // Wait for processing to complete (with delay between dates)
      await new Promise(resolve => setTimeout(resolve, 6000))

      const status = mixedBackfillService.getBackfillStatus(backfillId)

      // Should have completed despite one failure
      expect(status?.status).toBe('complete')
      expect(status?.progress.completed).toBe(2)
    }, 10000) // Increase timeout to 10 seconds
  })

  describe('cleanupOldJobs', () => {
    it('should remove old completed jobs', async () => {
      const districtId = '42'

      // Use mock scraper to avoid real network calls
      const mockScraper: MockToastmastersScraper = {
        config: { baseUrl: 'test', headless: true, timeout: 30000 },
        browser: null,
        getProgramYear: vi.fn().mockReturnValue('2024-2025'),
        buildBaseUrl: vi.fn().mockReturnValue('test-url'),
        closeBrowser: vi.fn().mockResolvedValue(undefined),
        getAllDistrictsList: vi.fn().mockResolvedValue([]),
        getAllDistricts: vi.fn().mockResolvedValue([]),
        getAllDistrictsForDate: vi.fn().mockResolvedValue([]),
        scrapePage: vi.fn().mockResolvedValue(''),
        getDistrictPerformance: vi.fn().mockResolvedValue([{ test: 'data' }]),
        getDivisionPerformance: vi.fn().mockResolvedValue([]),
        getClubPerformance: vi.fn().mockResolvedValue([]),
      }

      const testBackfillService = new DistrictBackfillService(
        cacheManager,
        mockScraper as unknown as ToastmastersScraper
      )

      const backfillId = await testBackfillService.initiateDistrictBackfill({
        districtId,
        startDate: '2024-11-01',
        endDate: '2024-11-01',
      })

      // Wait for job to complete
      await new Promise(resolve => setTimeout(resolve, 3000))

      // Manually set job as old (more than 1 hour ago)
      const status = testBackfillService.getBackfillStatus(backfillId)
      if (status) {
        // Access private jobs map through type assertion
        const service = testBackfillService as unknown as {
          jobs: Map<string, { createdAt: number; status: string }>
        }
        const job = service.jobs.get(backfillId)
        if (job) {
          job.createdAt = Date.now() - 2 * 60 * 60 * 1000 // 2 hours ago
          job.status = 'complete' // Ensure it's marked complete
        }
      }

      await testBackfillService.cleanupOldJobs()

      // Job should be removed
      const statusAfterCleanup =
        testBackfillService.getBackfillStatus(backfillId)
      expect(statusAfterCleanup).toBeNull()
    }, 5000) // Increase timeout to 5 seconds
  })
})
