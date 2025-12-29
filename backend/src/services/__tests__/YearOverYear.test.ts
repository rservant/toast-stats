/**
 * Tests for Year-Over-Year Comparison Logic
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'fs'
import { AnalyticsEngine } from '../AnalyticsEngine'
import { DistrictCacheManager } from '../DistrictCacheManager'
import {
  createTestCacheConfig,
  cleanupTestCacheConfig,
  initializeTestCache,
} from '../../utils/test-cache-helper'
import type { TestCacheConfig } from '../../utils/test-cache-helper'

describe('Year-Over-Year Comparison Logic', () => {
  let cacheManager: DistrictCacheManager
  let analyticsEngine: AnalyticsEngine
  let testCacheConfig: TestCacheConfig

  beforeEach(async () => {
    // Create isolated test cache configuration with simpler test name
    const testName = `year-over-year`
    testCacheConfig = await createTestCacheConfig(testName)

    try {
      await initializeTestCache(testCacheConfig)
    } catch {
      // If initialization fails, ensure directory exists and retry
      await fs.mkdir(testCacheConfig.cacheDir, { recursive: true })
      await initializeTestCache(testCacheConfig)
    }

    // Use the CacheConfigService to get the configured cache directory
    cacheManager = new DistrictCacheManager()
    await cacheManager.init()
    analyticsEngine = new AnalyticsEngine(cacheManager)

    // Clear any internal caches
    analyticsEngine.clearCaches()
  })

  afterEach(async () => {
    // Clear caches before cleanup
    if (analyticsEngine) {
      analyticsEngine.clearCaches()
    }

    // Clean up test cache configuration
    await cleanupTestCacheConfig(testCacheConfig)
  })

  describe('findPreviousProgramYearDate', () => {
    it('should calculate previous year date correctly (Requirement 9.1)', async () => {
      const districtId = `test-district-${Date.now()}-5`
      // Cache data for current year
      const currentDate = '2024-11-22'
      const currentClubPerformance = [
        {
          'Club Number': '12345',
          'Club Name': 'Test Club',
          'Active Membership': '25',
          'Goals Met': '5',
        },
      ]

      await cacheManager.cacheDistrictData(
        districtId,
        currentDate,
        [],
        [],
        currentClubPerformance
      )

      // Cache data for previous year (same date, one year earlier)
      const previousDate = '2023-11-22'
      const previousClubPerformance = [
        {
          'Club Number': '12345',
          'Club Name': 'Test Club',
          'Active Membership': '20',
          'Goals Met': '3',
        },
      ]

      await cacheManager.cacheDistrictData(
        districtId,
        previousDate,
        [],
        [],
        previousClubPerformance
      )

      // Calculate year-over-year
      const result = await analyticsEngine.calculateYearOverYear(
        districtId,
        currentDate
      )

      expect(result).toBeDefined()
      expect(result).not.toBeNull()
      expect(result!.currentDate).toBe(currentDate)
      expect(result!.previousYearDate).toBe(previousDate)
      expect(result!.dataAvailable).toBe(true)
    })
  })

  describe('calculatePercentageChanges', () => {
    it('should calculate percentage changes for all key metrics (Requirement 9.2)', async () => {
      const districtId = `test-district-${Date.now()}-6`
      const currentDate = '2024-11-22'
      const previousDate = '2023-11-22'

      // Current year data
      const currentClubPerformance = [
        {
          'Club Number': '1',
          'Club Name': 'Club 1',
          'Active Membership': '30',
          'Goals Met': '8',
        },
        {
          'Club Number': '2',
          'Club Name': 'Club 2',
          'Active Membership': '25',
          'Goals Met': '6',
        },
      ]

      // Previous year data
      const previousClubPerformance = [
        {
          'Club Number': '1',
          'Club Name': 'Club 1',
          'Active Membership': '25',
          'Goals Met': '5',
        },
        {
          'Club Number': '2',
          'Club Name': 'Club 2',
          'Active Membership': '20',
          'Goals Met': '4',
        },
      ]

      await cacheManager.cacheDistrictData(
        districtId,
        currentDate,
        [],
        [],
        currentClubPerformance
      )
      await cacheManager.cacheDistrictData(
        districtId,
        previousDate,
        [],
        [],
        previousClubPerformance
      )

      const result = await analyticsEngine.calculateYearOverYear(
        districtId,
        currentDate
      )

      expect(result).not.toBeNull()
      expect(result!.dataAvailable).toBe(true)
      expect(result!.metrics).toBeDefined()

      // Check membership metrics
      expect(result!.metrics!.membership.current).toBe(55) // 30 + 25
      expect(result!.metrics!.membership.previous).toBe(45) // 25 + 20
      expect(result!.metrics!.membership.change).toBe(10)
      expect(result!.metrics!.membership.percentageChange).toBeCloseTo(22.2, 1)

      // Check DCP goals metrics
      expect(result!.metrics!.dcpGoals.totalGoals.current).toBe(14) // 8 + 6
      expect(result!.metrics!.dcpGoals.totalGoals.previous).toBe(9) // 5 + 4
      expect(result!.metrics!.dcpGoals.totalGoals.change).toBe(5)

      // Check club count
      expect(result!.metrics!.clubCount.current).toBe(2)
      expect(result!.metrics!.clubCount.previous).toBe(2)
    })
  })

  describe('handleMissingData', () => {
    it('should handle missing previous year data gracefully (Requirement 9.3)', async () => {
      const districtId = `test-district-${Date.now()}-1`
      const currentDate = '2024-11-22'

      // Only cache current year data
      const currentClubPerformance = [
        {
          'Club Number': '1',
          'Club Name': 'Club 1',
          'Active Membership': '25',
          'Goals Met': '5',
        },
      ]

      await cacheManager.cacheDistrictData(
        districtId,
        currentDate,
        [],
        [],
        currentClubPerformance
      )

      const result = await analyticsEngine.calculateYearOverYear(
        districtId,
        currentDate
      )

      expect(result).toBeDefined()
      expect(result).not.toBeNull()
      expect(result!.dataAvailable).toBe(false)
      expect(result!.message).toContain('N/A')
      expect(result!.metrics).toBeUndefined()
    })

    it('should handle missing current year data gracefully (Requirement 9.3)', async () => {
      const districtId = `test-district-${Date.now()}-2`
      const currentDate = '2024-11-22'

      // No data cached at all for this district
      const result = await analyticsEngine.calculateYearOverYear(
        districtId,
        currentDate
      )

      expect(result).toBeNull()
    })
  })

  describe('multiYearTrends', () => {
    it('should support multi-year trends when 3+ years available (Requirement 9.5)', async () => {
      const districtId = `test-district-${Date.now()}-3`

      // Cache data for 3 years
      for (let year = 2022; year <= 2024; year++) {
        const date = `${year}-11-22`
        const membership = 40 + (year - 2022) * 5 // Growing membership
        const clubPerformance = [
          {
            'Club Number': '1',
            'Club Name': 'Club 1',
            'Active Membership': String(membership),
            'Goals Met': String(5 + (year - 2022)),
          },
        ]

        await cacheManager.cacheDistrictData(
          districtId,
          date,
          [],
          [],
          clubPerformance
        )
      }

      const result = await analyticsEngine.calculateYearOverYear(
        districtId,
        '2024-11-22'
      )

      expect(result).not.toBeNull()
      expect(result!.dataAvailable).toBe(true)
      expect(result!.multiYearTrends).toBeDefined()
      expect(result!.multiYearTrends!.available).toBe(true)
      expect(result!.multiYearTrends!.years).toHaveLength(3)
      expect(result!.multiYearTrends!.trends).toBeDefined()
      expect(result!.multiYearTrends!.trends!.membershipTrend).toBe(
        'increasing'
      )
    })

    it('should not provide multi-year trends when less than 3 years available', async () => {
      const districtId = `test-district-${Date.now()}-4`

      // Cache data for only 2 years
      for (let year = 2023; year <= 2024; year++) {
        const date = `${year}-11-22`
        const clubPerformance = [
          {
            'Club Number': '1',
            'Club Name': 'Club 1',
            'Active Membership': '25',
            'Goals Met': '5',
          },
        ]

        await cacheManager.cacheDistrictData(
          districtId,
          date,
          [],
          [],
          clubPerformance
        )
      }

      const result = await analyticsEngine.calculateYearOverYear(
        districtId,
        '2024-11-22'
      )

      expect(result).not.toBeNull()
      expect(result!.dataAvailable).toBe(true)
      expect(result!.multiYearTrends).toBeDefined()
      expect(result!.multiYearTrends!.available).toBe(false)
    })
  })

  describe('distinguishedClubsComparison', () => {
    it('should calculate distinguished clubs year-over-year with breakdown by level', async () => {
      const districtId = `test-district-${Date.now()}-7`
      const currentDate = '2024-11-22'
      const previousDate = '2023-11-22'

      // Current year: 2 President's, 1 Select, 1 Distinguished
      const currentClubPerformance = [
        {
          'Club Number': '1',
          'Club Name': 'Club 1',
          'Active Membership': '25',
          'Goals Met': '9',
        },
        {
          'Club Number': '2',
          'Club Name': 'Club 2',
          'Active Membership': '25',
          'Goals Met': '9',
        },
        {
          'Club Number': '3',
          'Club Name': 'Club 3',
          'Active Membership': '25',
          'Goals Met': '7',
        },
        {
          'Club Number': '4',
          'Club Name': 'Club 4',
          'Active Membership': '25',
          'Goals Met': '5',
        },
      ]

      // Previous year: 1 President's, 1 Select, 1 Distinguished
      const previousClubPerformance = [
        {
          'Club Number': '1',
          'Club Name': 'Club 1',
          'Active Membership': '25',
          'Goals Met': '9',
        },
        {
          'Club Number': '2',
          'Club Name': 'Club 2',
          'Active Membership': '25',
          'Goals Met': '7',
        },
        {
          'Club Number': '3',
          'Club Name': 'Club 3',
          'Active Membership': '25',
          'Goals Met': '5',
        },
      ]

      await cacheManager.cacheDistrictData(
        districtId,
        currentDate,
        [],
        [],
        currentClubPerformance
      )
      await cacheManager.cacheDistrictData(
        districtId,
        previousDate,
        [],
        [],
        previousClubPerformance
      )

      const result = await analyticsEngine.calculateYearOverYear(
        districtId,
        currentDate
      )

      // Add debugging if result is null
      if (!result) {
        console.error(
          'YearOverYear result is null for distinguished clubs test'
        )
        console.error('Current date:', currentDate)
        console.error('Previous date:', previousDate)

        // Check if data was cached properly
        const currentData = await cacheManager.getDistrictData(
          districtId,
          currentDate
        )
        const previousData = await cacheManager.getDistrictData(
          districtId,
          previousDate
        )
        console.error('Current data exists:', !!currentData)
        console.error('Previous data exists:', !!previousData)

        if (currentData) {
          console.error(
            'Current club count:',
            currentData.clubPerformance.length
          )
        }
        if (previousData) {
          console.error(
            'Previous club count:',
            previousData.clubPerformance.length
          )
        }
      }

      expect(result).not.toBeNull()
      expect(result!.dataAvailable).toBe(true)
      expect(result!.metrics!.distinguishedClubs.current).toBe(4)
      expect(result!.metrics!.distinguishedClubs.previous).toBe(3)
      expect(result!.metrics!.distinguishedClubs.change).toBe(1)
      expect(
        result!.metrics!.distinguishedClubs.byLevel.presidents.current
      ).toBe(2)
      expect(
        result!.metrics!.distinguishedClubs.byLevel.presidents.previous
      ).toBe(1)
      expect(
        result!.metrics!.distinguishedClubs.byLevel.presidents.change
      ).toBe(1)
    })
  })
})
