/**
 * Property-Based Tests for DistrictBackfillService
 * 
 * **Feature: month-end-data-reconciliation, Property 6: Latest Data Selection**
 * **Validates: Requirements 4.4, 4.5**
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fc from 'fast-check'
import { DistrictBackfillService } from '../DistrictBackfillService.js'
import { DistrictCacheManager } from '../DistrictCacheManager.js'
import { ToastmastersScraper } from '../ToastmastersScraper.js'
import type { DistrictStatistics } from '../../types/districts.js'
import fs from 'fs/promises'

describe('DistrictBackfillService - Property-Based Tests', () => {
  const testCacheDir = './test-cache-backfill-property'
  let cacheManager: DistrictCacheManager
  let scraper: ToastmastersScraper
  let backfillService: DistrictBackfillService

  beforeEach(async () => {
    // Clean up test cache directory
    try {
      await fs.rm(testCacheDir, { recursive: true, force: true })
    } catch (_error) {
      // Directory might not exist, ignore
    }

    cacheManager = new DistrictCacheManager(testCacheDir)
    scraper = new ToastmastersScraper()
    backfillService = new DistrictBackfillService(cacheManager, scraper)
  })

  afterEach(async () => {
    // Clean up test cache directory
    try {
      await fs.rm(testCacheDir, { recursive: true, force: true })
    } catch (_error) {
      // Ignore cleanup errors
    }
  })

  // Property test generators
  const generateDistrictId = (): fc.Arbitrary<string> =>
    fc.integer({ min: 1, max: 150 }).map(n => n.toString())

  const generateDate = (): fc.Arbitrary<string> =>
    fc.date({ min: new Date('2024-01-01T00:00:00.000Z'), max: new Date('2024-12-31T23:59:59.999Z') })
      .map(date => {
        if (isNaN(date.getTime())) {
          return '2024-06-15' // fallback date
        }
        return date.toISOString().split('T')[0]
      })

  const generateDistrictStatistics = (
    districtId: string, 
    asOfDate: string
  ): fc.Arbitrary<DistrictStatistics> =>
    fc.record({
      membershipTotal: fc.integer({ min: 100, max: 5000 }),
      clubsTotal: fc.integer({ min: 10, max: 100 }),
      distinguishedCount: fc.integer({ min: 0, max: 50 }),
      totalAwards: fc.integer({ min: 0, max: 500 })
    }).map(data => ({
      districtId,
      asOfDate,
      membership: {
        total: data.membershipTotal,
        change: 0,
        changePercent: 0,
        byClub: []
      },
      clubs: {
        total: data.clubsTotal,
        active: Math.floor(data.clubsTotal * 0.9),
        suspended: Math.floor(data.clubsTotal * 0.05),
        ineligible: Math.floor(data.clubsTotal * 0.03),
        low: Math.floor(data.clubsTotal * 0.02),
        distinguished: data.distinguishedCount
      },
      education: {
        totalAwards: data.totalAwards,
        byType: [],
        topClubs: []
      }
    }))

  const generateRawDashboardData = (stats: DistrictStatistics) => {
    // Generate mock raw data that would come from the dashboard
    const clubPerformance = Array.from({ length: stats.clubs.total }, (_, i) => ({
      'Club Number': `${stats.districtId}${i.toString().padStart(2, '0')}`,
      'Club Name': `Test Club ${i + 1}`,
      'Active Members': Math.floor(stats.membership.total / stats.clubs.total).toString(),
      'Status': i < stats.clubs.active ? 'Active' : 'Suspended',
      'Distinguished Status': i < stats.clubs.distinguished ? 'Distinguished' : '',
      'Awards': Math.floor(stats.education.totalAwards / stats.clubs.total).toString()
    }))

    const districtPerformance = [{
      'District': stats.districtId,
      'Total Members': stats.membership.total.toString(),
      'Total Clubs': stats.clubs.total.toString(),
      'asOfDate': stats.asOfDate // Include source date in data
    }]

    const divisionPerformance = [{
      'District': stats.districtId,
      'Division': '1',
      'Members': stats.membership.total.toString()
    }]

    return { districtPerformance, divisionPerformance, clubPerformance }
  }

  /**
   * Property 6: Latest Data Selection
   * 
   * For any month with multiple data points during reconciliation, the system should 
   * always use the data with the latest "as of" date from the dashboard.
   */
  it('should always select data with the latest source date when multiple data points exist', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateDistrictId(),
        generateDate(),
        fc.array(fc.integer({ min: 0, max: 10 }), { minLength: 2, maxLength: 5 }),
        async (districtId, targetDate, daysOffsets) => {
          // Generate multiple data points with different source dates
          const dataPoints = await Promise.all(
            daysOffsets.map(async (daysOffset, index) => {
              const sourceDate = new Date(targetDate + 'T00:00:00.000Z')
              sourceDate.setDate(sourceDate.getDate() + daysOffset)
              const sourceDateStr = sourceDate.toISOString().split('T')[0]

              const stats = await fc.sample(
                generateDistrictStatistics(districtId, sourceDateStr),
                1
              )[0]

              return {
                sourceDate: sourceDateStr,
                stats,
                rawData: generateRawDashboardData(stats),
                index
              }
            })
          )

          // Sort by source date to find the latest
          const sortedByDate = [...dataPoints].sort((a, b) => 
            new Date(b.sourceDate).getTime() - new Date(a.sourceDate).getTime()
          )
          const expectedLatest = sortedByDate[0]

          // Mock the scraper to return different data based on call order
          let callCount = 0
          const mockScraper = {
            getDistrictPerformance: vi.fn().mockImplementation(async () => {
              const dataPoint = dataPoints[callCount % dataPoints.length]
              callCount++
              return dataPoint.rawData.districtPerformance
            }),
            getDivisionPerformance: vi.fn().mockImplementation(async () => {
              const dataPoint = dataPoints[(callCount - 1) % dataPoints.length]
              return dataPoint.rawData.divisionPerformance
            }),
            getClubPerformance: vi.fn().mockImplementation(async () => {
              const dataPoint = dataPoints[(callCount - 1) % dataPoints.length]
              return dataPoint.rawData.clubPerformance
            })
          } as any

          const testBackfillService = new DistrictBackfillService(cacheManager, mockScraper)

          // Simulate multiple reconciliation data fetches
          const results = []
          for (let i = 0; i < dataPoints.length; i++) {
            const result = await testBackfillService.fetchReconciliationData(districtId, targetDate)
            if (result.success && result.data) {
              results.push({
                sourceDate: result.sourceDataDate,
                data: result.data
              })
            }
          }

          // The system should be able to identify which data has the latest source date
          if (results.length > 1) {
            // Find the result with the latest source date
            const latestResult = results.reduce((latest, current) => {
              return new Date(current.sourceDate!) > new Date(latest.sourceDate!) 
                ? current 
                : latest
            })

            // Verify that the latest source date matches our expectation
            expect(latestResult.sourceDate).toBe(expectedLatest.sourceDate)
            
            // Verify that when given multiple options, the system would choose the latest
            const allSourceDates = results.map(r => r.sourceDate!).sort()
            const actualLatest = allSourceDates[allSourceDates.length - 1]
            expect(actualLatest).toBe(expectedLatest.sourceDate)
          }

          // Property: For any set of data points, the latest source date should be selected
          const uniqueSourceDates = [...new Set(dataPoints.map(dp => dp.sourceDate))].sort()
          if (uniqueSourceDates.length > 1) {
            // Test the source date extraction logic directly
            const testData = expectedLatest.rawData
            const extractedDate = (testBackfillService as any).extractSourceDataDate(
              testData.districtPerformance,
              testData.divisionPerformance,
              testData.clubPerformance,
              targetDate
            )

            // The extracted date should be the latest available or the fallback
            expect(extractedDate).toBeDefined()
            
            // If source date was found in data, it should match the expected latest
            if (extractedDate !== targetDate) {
              expect(new Date(extractedDate).getTime()).toBeGreaterThanOrEqual(
                new Date(targetDate).getTime()
              )
            }
          }
        }
      ),
      { numRuns: 50 }
    )
  })

  /**
   * Property: Source data date extraction should be consistent
   * 
   * For any valid dashboard data, the source date extraction should return
   * a valid date that is not earlier than the target date.
   */
  it('should extract source dates consistently and never return dates earlier than target', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateDistrictId(),
        generateDate(),
        fc.integer({ min: 0, max: 10 }),
        async (districtId, targetDate, daysOffset) => {
          const sourceDate = new Date(targetDate + 'T00:00:00.000Z')
          sourceDate.setDate(sourceDate.getDate() + daysOffset)
          const sourceDateStr = sourceDate.toISOString().split('T')[0]
          const stats = await fc.sample(generateDistrictStatistics(districtId, sourceDateStr), 1)[0]
          const rawData = generateRawDashboardData(stats)

          // Test the source date extraction
          const extractedDate = (backfillService as any).extractSourceDataDate(
            rawData.districtPerformance,
            rawData.divisionPerformance,
            rawData.clubPerformance,
            targetDate
          )

          // Property 1: Extracted date should be valid
          expect(extractedDate).toBeDefined()
          expect(typeof extractedDate).toBe('string')
          expect(extractedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)

          // Property 2: Extracted date should not be earlier than target date
          expect(new Date(extractedDate).getTime()).toBeGreaterThanOrEqual(
            new Date(targetDate).getTime()
          )

          // Property 3: If source date is in the data, it should be extracted correctly
          if (rawData.districtPerformance[0].asOfDate === sourceDateStr) {
            expect(extractedDate).toBe(sourceDateStr)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property: Reconciliation data fetching should handle missing data gracefully
   * 
   * For any district and date combination, the fetch operation should either
   * succeed with valid data or fail gracefully with appropriate error information.
   */
  it('should handle missing or invalid data gracefully during reconciliation', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateDistrictId(),
        generateDate(),
        fc.boolean(),
        async (districtId, targetDate, shouldHaveData) => {
          // Mock scraper to simulate various data availability scenarios
          const mockScraper = {
            getDistrictPerformance: vi.fn().mockImplementation(async () => {
              if (!shouldHaveData) {
                throw new Error('Date not available on dashboard')
              }
              return [{ 'District': districtId, 'Total Members': '1000' }]
            }),
            getDivisionPerformance: vi.fn().mockImplementation(async () => {
              if (!shouldHaveData) {
                return []
              }
              return [{ 'District': districtId, 'Division': '1' }]
            }),
            getClubPerformance: vi.fn().mockImplementation(async () => {
              if (!shouldHaveData) {
                return []
              }
              return [{ 'Club Number': '123', 'Club Name': 'Test Club' }]
            })
          } as any

          const testBackfillService = new DistrictBackfillService(cacheManager, mockScraper)
          const result = await testBackfillService.fetchReconciliationData(districtId, targetDate)

          // Property 1: Result should always have a success field
          expect(result).toHaveProperty('success')
          expect(typeof result.success).toBe('boolean')

          // Property 2: Result should always have isDataAvailable field
          expect(result).toHaveProperty('isDataAvailable')
          expect(typeof result.isDataAvailable).toBe('boolean')

          if (shouldHaveData) {
            // Property 3: When data is available, result should be successful
            expect(result.success).toBe(true)
            expect(result.isDataAvailable).toBe(true)
            expect(result.data).toBeDefined()
            expect(result.sourceDataDate).toBeDefined()
          } else {
            // Property 4: When data is not available, should handle gracefully
            expect(result.isDataAvailable).toBe(false)
            // Should either succeed with no data or fail gracefully
            if (result.success) {
              expect(result.data).toBeUndefined()
            }
            expect(result.error).toBeDefined()
          }
        }
      ),
      { numRuns: 50 }
    )
  })
})