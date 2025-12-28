import { describe, it, expect, afterEach, vi } from 'vitest'
import { DistrictBackfillService } from '../DistrictBackfillService.ts'
import { DistrictCacheManager } from '../DistrictCacheManager.ts'
import { ToastmastersScraper } from '../ToastmastersScraper.ts'
import type { ScrapedRecord } from '../../types/districts.ts'
import { createTestSelfCleanup, createUniqueTestDir } from '../../utils/test-self-cleanup.ts'

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
  // Self-cleanup setup - each test manages its own cleanup
  const { cleanup, afterEach: performCleanup } = createTestSelfCleanup({ verbose: false })
  
  // Each test cleans up after itself
  afterEach(performCleanup)

  function setupBackfillService() {
    const cacheDir = createUniqueTestDir(cleanup, 'district-backfill-service')
    const cacheManager = new DistrictCacheManager(cacheDir)
    const scraper = new ToastmastersScraper()
    const backfillService = new DistrictBackfillService(cacheManager, scraper)
    
    return { cacheManager, scraper, backfillService }
  }

  describe('initiateDistrictBackfill', () => {
    it('should create a backfill job with unique ID', async () => {
      const { backfillService } = setupBackfillService()
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
      const { backfillService } = setupBackfillService()
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
      const { backfillService } = setupBackfillService()
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
      const { backfillService } = setupBackfillService()
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
      const { cacheManager, backfillService } = setupBackfillService()
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
      const { cacheManager, backfillService } = setupBackfillService()
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
      const { backfillService } = setupBackfillService()
      const status = backfillService.getBackfillStatus('non-existent-id')
      expect(status).toBeNull()
    })

    it('should return current job status', async () => {
      const { backfillService } = setupBackfillService()
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
      const { backfillService } = setupBackfillService()
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
      const { backfillService } = setupBackfillService()
      const cancelled = await backfillService.cancelBackfill('non-existent-id')
      expect(cancelled).toBe(false)
    })
  })

  describe('error handling', () => {
    it('should handle scraper errors gracefully', async () => {
      const { cacheManager } = setupBackfillService()
      
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
      const { cacheManager } = setupBackfillService()
      
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
      const { cacheManager } = setupBackfillService()
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
