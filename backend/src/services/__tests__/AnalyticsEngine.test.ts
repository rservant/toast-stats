import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { AnalyticsEngine } from '../AnalyticsEngine.js'
import { DistrictCacheManager } from '../DistrictCacheManager.js'
import fs from 'fs/promises'

describe('AnalyticsEngine', () => {
  const testCacheDir = './test-cache-analytics'
  let cacheManager: DistrictCacheManager
  let analyticsEngine: AnalyticsEngine

  beforeEach(async () => {
    cacheManager = new DistrictCacheManager(testCacheDir)
    analyticsEngine = new AnalyticsEngine(cacheManager)
  })

  afterEach(async () => {
    // Clean up test cache directory
    try {
      await fs.rm(testCacheDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('at-risk club detection', () => {
    it('should identify clubs with membership below 12 as critical', async () => {
      const districtId = '42'
      const date = '2024-11-01'

      // Cache test data with a critical club
      const clubPerformance = [
        {
          'Club Number': '123',
          'Club Name': 'Critical Club',
          'Active Membership': '10', // Below 12
          'Goals Met': '5',
          Division: 'A',
          Area: '1',
        },
        {
          'Club Number': '456',
          'Club Name': 'Healthy Club',
          'Active Membership': '25',
          'Goals Met': '7',
          Division: 'A',
          Area: '1',
        },
      ]

      await cacheManager.cacheDistrictData(districtId, date, [], [], clubPerformance)

      const atRiskClubs = await analyticsEngine.identifyAtRiskClubs(districtId)

      expect(atRiskClubs.length).toBeGreaterThan(0)
      const criticalClub = atRiskClubs.find(c => c.clubId === '123')
      expect(criticalClub).toBeDefined()
      expect(criticalClub?.currentStatus).toBe('critical')
      expect(criticalClub?.riskFactors).toContain('Membership below 12 (critical)')
    })

    it('should identify clubs with zero DCP goals as at-risk', async () => {
      const districtId = '42'
      const date = '2024-11-01'

      const clubPerformance = [
        {
          'Club Number': '789',
          'Club Name': 'Zero Goals Club',
          'Active Membership': '20',
          'Goals Met': '0', // Zero goals
          Division: 'B',
          Area: '2',
        },
      ]

      await cacheManager.cacheDistrictData(districtId, date, [], [], clubPerformance)

      const atRiskClubs = await analyticsEngine.identifyAtRiskClubs(districtId)

      expect(atRiskClubs.length).toBeGreaterThan(0)
      const zeroGoalsClub = atRiskClubs.find(c => c.clubId === '789')
      expect(zeroGoalsClub).toBeDefined()
      expect(zeroGoalsClub?.currentStatus).toBe('at-risk')
      expect(zeroGoalsClub?.riskFactors).toContain('Zero DCP goals achieved')
    })

    it('should identify clubs with declining membership as at-risk', async () => {
      const districtId = '42'
      const dates = ['2024-11-01', '2024-11-02', '2024-11-03']

      // Cache data showing declining membership
      for (let i = 0; i < dates.length; i++) {
        const clubPerformance = [
          {
            'Club Number': '999',
            'Club Name': 'Declining Club',
            'Active Membership': String(25 - i * 2), // 25, 23, 21 (declining)
            'Goals Met': '5',
            Division: 'C',
            Area: '3',
          },
        ]
        await cacheManager.cacheDistrictData(districtId, dates[i], [], [], clubPerformance)
      }

      const atRiskClubs = await analyticsEngine.identifyAtRiskClubs(districtId)

      const decliningClub = atRiskClubs.find(c => c.clubId === '999')
      expect(decliningClub).toBeDefined()
      expect(decliningClub?.riskFactors).toContain('Declining membership for 3+ months')
    })
  })

  describe('trend calculations', () => {
    it('should calculate membership trends over time', async () => {
      const districtId = '42'
      const dates = ['2024-11-01', '2024-11-02', '2024-11-03']

      // Cache data with increasing membership
      for (let i = 0; i < dates.length; i++) {
        const clubPerformance = [
          {
            'Club Number': '100',
            'Club Name': 'Growing Club',
            'Active Membership': String(20 + i * 5), // 20, 25, 30
            'Goals Met': '5',
            Division: 'A',
            Area: '1',
          },
        ]
        await cacheManager.cacheDistrictData(districtId, dates[i], [], [], clubPerformance)
      }

      const analytics = await analyticsEngine.generateDistrictAnalytics(districtId)

      expect(analytics.membershipTrend).toBeDefined()
      expect(analytics.membershipTrend.length).toBe(3)
      expect(analytics.membershipTrend[0].count).toBe(20)
      expect(analytics.membershipTrend[2].count).toBe(30)
      expect(analytics.membershipChange).toBe(10) // 30 - 20
    })

    it('should calculate club trends with DCP goals', async () => {
      const districtId = '42'
      const clubId = '200'
      const dates = ['2024-11-01', '2024-11-02']

      for (let i = 0; i < dates.length; i++) {
        const clubPerformance = [
          {
            'Club Number': clubId,
            'Club Name': 'Test Club',
            'Active Membership': '25',
            'Goals Met': String(3 + i * 2), // 3, 5
            Division: 'A',
            Area: '1',
          },
        ]
        await cacheManager.cacheDistrictData(districtId, dates[i], [], [], clubPerformance)
      }

      const clubTrend = await analyticsEngine.getClubTrends(districtId, clubId)

      expect(clubTrend).toBeDefined()
      expect(clubTrend?.dcpGoalsTrend.length).toBe(2)
      expect(clubTrend?.dcpGoalsTrend[0].goalsAchieved).toBe(3)
      expect(clubTrend?.dcpGoalsTrend[1].goalsAchieved).toBe(5)
    })
  })

  describe('year-over-year comparisons', () => {
    it('should calculate year-over-year metrics when data available', async () => {
      const districtId = '42'
      const currentDate = '2024-11-01'
      const previousYearDate = '2023-11-01'

      // Cache current year data
      await cacheManager.cacheDistrictData(
        districtId,
        currentDate,
        [],
        [],
        [
          {
            'Club Number': '100',
            'Club Name': 'Club A',
            'Active Membership': '30',
            'Goals Met': '7',
            Division: 'A',
            Area: '1',
          },
        ]
      )

      // Cache previous year data
      await cacheManager.cacheDistrictData(
        districtId,
        previousYearDate,
        [],
        [],
        [
          {
            'Club Number': '100',
            'Club Name': 'Club A',
            'Active Membership': '25',
            'Goals Met': '5',
            Division: 'A',
            Area: '1',
          },
        ]
      )

      const yoyMetrics = await analyticsEngine.calculateYearOverYear(districtId, currentDate)

      expect(yoyMetrics).toBeDefined()
      expect(yoyMetrics.dataAvailable).toBe(true)
      expect(yoyMetrics.metrics.membership.current).toBe(30)
      expect(yoyMetrics.metrics.membership.previous).toBe(25)
      expect(yoyMetrics.metrics.membership.change).toBe(5)
    })

    it('should handle missing previous year data gracefully', async () => {
      const districtId = '42'
      const currentDate = '2024-11-01'

      // Only cache current year data
      await cacheManager.cacheDistrictData(
        districtId,
        currentDate,
        [],
        [],
        [
          {
            'Club Number': '100',
            'Club Name': 'Club A',
            'Active Membership': '30',
            'Goals Met': '7',
            Division: 'A',
            Area: '1',
          },
        ]
      )

      const yoyMetrics = await analyticsEngine.calculateYearOverYear(districtId, currentDate)

      expect(yoyMetrics).toBeDefined()
      expect(yoyMetrics.dataAvailable).toBe(false)
      expect(yoyMetrics.message).toContain('N/A')
    })
  })

  describe('projection algorithms', () => {
    it('should project distinguished club counts based on trends', async () => {
      const districtId = '42'
      const dates = ['2024-11-01', '2024-11-02', '2024-11-03']

      // Cache data showing increasing distinguished clubs
      for (let i = 0; i < dates.length; i++) {
        const clubPerformance = [
          {
            'Club Number': '100',
            'Club Name': 'Club A',
            'Active Membership': '25',
            'Goals Met': String(5 + i), // 5, 6, 7 (progressing to Select)
            Division: 'A',
            Area: '1',
          },
          {
            'Club Number': '200',
            'Club Name': 'Club B',
            'Active Membership': '30',
            'Goals Met': String(7 + i), // 7, 8, 9 (progressing to President's)
            Division: 'A',
            Area: '1',
          },
        ]
        await cacheManager.cacheDistrictData(districtId, dates[i], [], [], clubPerformance)
      }

      const analytics = await analyticsEngine.generateDistrictAnalytics(districtId)

      expect(analytics.distinguishedProjection).toBeDefined()
      expect(analytics.distinguishedProjection).toBeGreaterThan(0)
    })
  })

  describe('division analytics', () => {
    it('should rank divisions by performance', async () => {
      const districtId = '42'
      const date = '2024-11-01'

      const clubPerformance = [
        {
          'Club Number': '100',
          'Club Name': 'Club A',
          'Active Membership': '25',
          'Goals Met': '8',
          Division: 'A',
          'Division Name': 'Division A',
          Area: '1',
        },
        {
          'Club Number': '200',
          'Club Name': 'Club B',
          'Active Membership': '30',
          'Goals Met': '9',
          Division: 'A',
          'Division Name': 'Division A',
          Area: '1',
        },
        {
          'Club Number': '300',
          'Club Name': 'Club C',
          'Active Membership': '20',
          'Goals Met': '3',
          Division: 'B',
          'Division Name': 'Division B',
          Area: '2',
        },
      ]

      await cacheManager.cacheDistrictData(districtId, date, [], [], clubPerformance)

      const divisions = await analyticsEngine.compareDivisions(districtId, date)

      expect(divisions.length).toBeGreaterThan(0)
      expect(divisions[0].rank).toBe(1)
      expect(divisions[0].divisionId).toBe('A') // Division A should rank first (17 total goals)
      expect(divisions[0].totalDcpGoals).toBe(17)
    })
  })

  describe('error handling', () => {
    it('should throw error when no cached data available', async () => {
      const districtId = '99'

      await expect(
        analyticsEngine.generateDistrictAnalytics(districtId)
      ).rejects.toThrow('No cached data available')
    })

    it('should return null for non-existent club trends', async () => {
      const districtId = '42'
      const date = '2024-11-01'

      await cacheManager.cacheDistrictData(districtId, date, [], [], [])

      const clubTrend = await analyticsEngine.getClubTrends(districtId, 'non-existent')

      expect(clubTrend).toBeNull()
    })
  })
})
