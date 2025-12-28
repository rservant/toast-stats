import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { AnalyticsEngine } from '../AnalyticsEngine'
import { DistrictCacheManager } from '../DistrictCacheManager'
import {
  createTestCacheConfig,
  cleanupTestCacheConfig,
  type TestCacheConfig,
} from '../../utils/test-cache-helper'

describe('AnalyticsEngine', () => {
  let testCacheConfig: TestCacheConfig
  let cacheManager: DistrictCacheManager
  let analyticsEngine: AnalyticsEngine

  beforeEach(async () => {
    testCacheConfig = await createTestCacheConfig('analytics-engine')
    cacheManager = new DistrictCacheManager(testCacheConfig.cacheDir)
    analyticsEngine = new AnalyticsEngine(cacheManager)
  })

  afterEach(async () => {
    await cleanupTestCacheConfig(testCacheConfig)
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

      await cacheManager.cacheDistrictData(
        districtId,
        date,
        [],
        [],
        clubPerformance
      )

      const atRiskClubs = await analyticsEngine.identifyAtRiskClubs(districtId)

      expect(atRiskClubs.length).toBeGreaterThan(0)
      const criticalClub = atRiskClubs.find(c => c.clubId === '123')
      expect(criticalClub).toBeDefined()
      expect(criticalClub?.currentStatus).toBe('critical')
      expect(criticalClub?.riskFactors).toContain(
        'Membership below 12 (critical)'
      )
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

      await cacheManager.cacheDistrictData(
        districtId,
        date,
        [],
        [],
        clubPerformance
      )

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
        await cacheManager.cacheDistrictData(
          districtId,
          dates[i],
          [],
          [],
          clubPerformance
        )
      }

      const atRiskClubs = await analyticsEngine.identifyAtRiskClubs(districtId)

      const decliningClub = atRiskClubs.find(c => c.clubId === '999')
      expect(decliningClub).toBeDefined()
      expect(decliningClub?.riskFactors).toContain(
        'Declining membership for 3+ months'
      )
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
        await cacheManager.cacheDistrictData(
          districtId,
          dates[i],
          [],
          [],
          clubPerformance
        )
      }

      const analytics =
        await analyticsEngine.generateDistrictAnalytics(districtId)

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
        await cacheManager.cacheDistrictData(
          districtId,
          dates[i],
          [],
          [],
          clubPerformance
        )
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

      const yoyMetrics = await analyticsEngine.calculateYearOverYear(
        districtId,
        currentDate
      )

      expect(yoyMetrics).toBeDefined()
      expect(yoyMetrics).not.toBeNull()
      expect(yoyMetrics!.dataAvailable).toBe(true)
      expect(yoyMetrics!.metrics!.membership.current).toBe(30)
      expect(yoyMetrics!.metrics!.membership.previous).toBe(25)
      expect(yoyMetrics!.metrics!.membership.change).toBe(5)
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

      const yoyMetrics = await analyticsEngine.calculateYearOverYear(
        districtId,
        currentDate
      )

      expect(yoyMetrics).toBeDefined()
      expect(yoyMetrics).not.toBeNull()
      expect(yoyMetrics!.dataAvailable).toBe(false)
      expect(yoyMetrics!.message).toContain('N/A')
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
        await cacheManager.cacheDistrictData(
          districtId,
          dates[i],
          [],
          [],
          clubPerformance
        )
      }

      const analytics =
        await analyticsEngine.generateDistrictAnalytics(districtId)

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

      await cacheManager.cacheDistrictData(
        districtId,
        date,
        [],
        [],
        clubPerformance
      )

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

      const clubTrend = await analyticsEngine.getClubTrends(
        districtId,
        'non-existent'
      )

      expect(clubTrend).toBeNull()
    })
  })

  describe('DCP Goal Counting', () => {
    describe('field name resolution helper', () => {
      it('should return 2025+ field names when Path Completions field exists', async () => {
        const districtId = '42'
        const date = '2024-11-01'

        const clubPerformance = [
          {
            'Club Number': '123',
            'Club Name': 'Test Club',
            'Level 4s, Path Completions, or DTM Awards': '1',
            'Add. Level 4s, Path Completions, or DTM award': '0',
            'Active Membership': '20',
            'Goals Met': '5',
            Division: 'A',
            Area: '1',
          },
        ]

        await cacheManager.cacheDistrictData(
          districtId,
          date,
          [],
          [],
          clubPerformance
        )
        const analytics =
          await analyticsEngine.generateDistrictAnalytics(districtId)

        // Verify Goal 5 is counted (which uses the field name resolution)
        const dcpGoals = analytics.distinguishedClubAnalytics.dcpGoalAnalysis
        const goal5 =
          dcpGoals.mostCommonlyAchieved.find(g => g.goalNumber === 5) ||
          dcpGoals.leastCommonlyAchieved.find(g => g.goalNumber === 5)
        expect(goal5).toBeDefined()
        expect(goal5?.achievementCount).toBe(1)
      })

      it('should return 2020-2024 field names when Level 5s field exists', async () => {
        const districtId = '42'
        const date = '2024-11-01'

        const clubPerformance = [
          {
            'Club Number': '123',
            'Club Name': 'Test Club',
            'Level 4s, Level 5s, or DTM award': '1',
            'Add. Level 4s, Level 5s, or DTM award': '0',
            'Active Membership': '20',
            'Goals Met': '5',
            Division: 'A',
            Area: '1',
          },
        ]

        await cacheManager.cacheDistrictData(
          districtId,
          date,
          [],
          [],
          clubPerformance
        )
        const analytics =
          await analyticsEngine.generateDistrictAnalytics(districtId)

        const dcpGoals = analytics.distinguishedClubAnalytics.dcpGoalAnalysis
        const goal5 =
          dcpGoals.mostCommonlyAchieved.find(g => g.goalNumber === 5) ||
          dcpGoals.leastCommonlyAchieved.find(g => g.goalNumber === 5)
        expect(goal5).toBeDefined()
        expect(goal5?.achievementCount).toBe(1)
      })

      it('should return 2019 field names when CL/AL/DTMs field exists', async () => {
        const districtId = '42'
        const date = '2024-11-01'

        const clubPerformance = [
          {
            'Club Number': '123',
            'Club Name': 'Test Club',
            'CL/AL/DTMs': '1',
            'Add. CL/AL/DTMs': '0',
            'Active Membership': '20',
            'Goals Met': '5',
            Division: 'A',
            Area: '1',
          },
        ]

        await cacheManager.cacheDistrictData(
          districtId,
          date,
          [],
          [],
          clubPerformance
        )
        const analytics =
          await analyticsEngine.generateDistrictAnalytics(districtId)

        const dcpGoals = analytics.distinguishedClubAnalytics.dcpGoalAnalysis
        const goal5 =
          dcpGoals.mostCommonlyAchieved.find(g => g.goalNumber === 5) ||
          dcpGoals.leastCommonlyAchieved.find(g => g.goalNumber === 5)
        expect(goal5).toBeDefined()
        expect(goal5?.achievementCount).toBe(1)
      })

      it('should use fallback when no matching field exists', async () => {
        const districtId = '42'
        const date = '2024-11-01'

        const clubPerformance = [
          {
            'Club Number': '123',
            'Club Name': 'Test Club',
            'Active Membership': '20',
            'Goals Met': '0',
            Division: 'A',
            Area: '1',
          },
        ]

        await cacheManager.cacheDistrictData(
          districtId,
          date,
          [],
          [],
          clubPerformance
        )
        const analytics =
          await analyticsEngine.generateDistrictAnalytics(districtId)

        // Should not throw error, should use fallback
        expect(analytics).toBeDefined()
        const dcpGoals = analytics.distinguishedClubAnalytics.dcpGoalAnalysis
        const goal5 =
          dcpGoals.mostCommonlyAchieved.find(g => g.goalNumber === 5) ||
          dcpGoals.leastCommonlyAchieved.find(g => g.goalNumber === 5)
        expect(goal5).toBeDefined()
        expect(goal5?.achievementCount).toBe(0)
      })
    })

    describe('Goal 5 counting', () => {
      it('should not count Goal 5 when club has 0 Level 4 awards (2025+ format)', async () => {
        const districtId = '42'
        const date = '2024-11-01'

        const clubPerformance = [
          {
            'Club Number': '123',
            'Club Name': 'Test Club',
            'Level 4s, Path Completions, or DTM Awards': '0',
            'Add. Level 4s, Path Completions, or DTM award': '0',
            'Active Membership': '20',
            'Goals Met': '0',
            Division: 'A',
            Area: '1',
          },
        ]

        await cacheManager.cacheDistrictData(
          districtId,
          date,
          [],
          [],
          clubPerformance
        )
        const analytics =
          await analyticsEngine.generateDistrictAnalytics(districtId)

        const dcpGoals = analytics.distinguishedClubAnalytics.dcpGoalAnalysis
        const goal5 =
          dcpGoals.mostCommonlyAchieved.find(g => g.goalNumber === 5) ||
          dcpGoals.leastCommonlyAchieved.find(g => g.goalNumber === 5)
        expect(goal5).toBeDefined()
        expect(goal5?.achievementCount).toBe(0)
      })

      it('should count Goal 5 when club has 1 Level 4 award (2025+ format)', async () => {
        const districtId = '42'
        const date = '2024-11-01'

        const clubPerformance = [
          {
            'Club Number': '123',
            'Club Name': 'Test Club',
            'Level 4s, Path Completions, or DTM Awards': '1',
            'Add. Level 4s, Path Completions, or DTM award': '0',
            'Active Membership': '20',
            'Goals Met': '5',
            Division: 'A',
            Area: '1',
          },
        ]

        await cacheManager.cacheDistrictData(
          districtId,
          date,
          [],
          [],
          clubPerformance
        )
        const analytics =
          await analyticsEngine.generateDistrictAnalytics(districtId)

        const dcpGoals = analytics.distinguishedClubAnalytics.dcpGoalAnalysis
        const goal5 =
          dcpGoals.mostCommonlyAchieved.find(g => g.goalNumber === 5) ||
          dcpGoals.leastCommonlyAchieved.find(g => g.goalNumber === 5)
        expect(goal5).toBeDefined()
        expect(goal5?.achievementCount).toBe(1)
      })

      it('should count Goal 5 when club has 2+ Level 4 awards (2025+ format)', async () => {
        const districtId = '42'
        const date = '2024-11-01'

        const clubPerformance = [
          {
            'Club Number': '123',
            'Club Name': 'Test Club',
            'Level 4s, Path Completions, or DTM Awards': '3',
            'Add. Level 4s, Path Completions, or DTM award': '1',
            'Active Membership': '20',
            'Goals Met': '6',
            Division: 'A',
            Area: '1',
          },
        ]

        await cacheManager.cacheDistrictData(
          districtId,
          date,
          [],
          [],
          clubPerformance
        )
        const analytics =
          await analyticsEngine.generateDistrictAnalytics(districtId)

        const dcpGoals = analytics.distinguishedClubAnalytics.dcpGoalAnalysis
        const goal5 =
          dcpGoals.mostCommonlyAchieved.find(g => g.goalNumber === 5) ||
          dcpGoals.leastCommonlyAchieved.find(g => g.goalNumber === 5)
        expect(goal5).toBeDefined()
        expect(goal5?.achievementCount).toBe(1)
      })

      it('should count Goal 5 with 2020-2024 format (Level 5s)', async () => {
        const districtId = '42'
        const date = '2024-11-01'

        const clubPerformance = [
          {
            'Club Number': '123',
            'Club Name': 'Test Club',
            'Level 4s, Level 5s, or DTM award': '2',
            'Add. Level 4s, Level 5s, or DTM award': '0',
            'Active Membership': '20',
            'Goals Met': '5',
            Division: 'A',
            Area: '1',
          },
        ]

        await cacheManager.cacheDistrictData(
          districtId,
          date,
          [],
          [],
          clubPerformance
        )
        const analytics =
          await analyticsEngine.generateDistrictAnalytics(districtId)

        const dcpGoals = analytics.distinguishedClubAnalytics.dcpGoalAnalysis
        const goal5 =
          dcpGoals.mostCommonlyAchieved.find(g => g.goalNumber === 5) ||
          dcpGoals.leastCommonlyAchieved.find(g => g.goalNumber === 5)
        expect(goal5).toBeDefined()
        expect(goal5?.achievementCount).toBe(1)
      })

      it('should count Goal 5 with 2019 format (CL/AL/DTMs)', async () => {
        const districtId = '42'
        const date = '2024-11-01'

        const clubPerformance = [
          {
            'Club Number': '123',
            'Club Name': 'Test Club',
            'CL/AL/DTMs': '1',
            'Add. CL/AL/DTMs': '0',
            'Active Membership': '20',
            'Goals Met': '5',
            Division: 'A',
            Area: '1',
          },
        ]

        await cacheManager.cacheDistrictData(
          districtId,
          date,
          [],
          [],
          clubPerformance
        )
        const analytics =
          await analyticsEngine.generateDistrictAnalytics(districtId)

        const dcpGoals = analytics.distinguishedClubAnalytics.dcpGoalAnalysis
        const goal5 =
          dcpGoals.mostCommonlyAchieved.find(g => g.goalNumber === 5) ||
          dcpGoals.leastCommonlyAchieved.find(g => g.goalNumber === 5)
        expect(goal5).toBeDefined()
        expect(goal5?.achievementCount).toBe(1)
      })
    })

    describe('Goal 6 counting', () => {
      it('should not count Goal 6 when club has base but no additional Level 4 awards', async () => {
        const districtId = '42'
        const date = '2024-11-01'

        const clubPerformance = [
          {
            'Club Number': '123',
            'Club Name': 'Test Club',
            'Level 4s, Path Completions, or DTM Awards': '1',
            'Add. Level 4s, Path Completions, or DTM award': '0',
            'Active Membership': '20',
            'Goals Met': '5',
            Division: 'A',
            Area: '1',
          },
        ]

        await cacheManager.cacheDistrictData(
          districtId,
          date,
          [],
          [],
          clubPerformance
        )
        const analytics =
          await analyticsEngine.generateDistrictAnalytics(districtId)

        const dcpGoals = analytics.distinguishedClubAnalytics.dcpGoalAnalysis
        const goal6 =
          dcpGoals.mostCommonlyAchieved.find(g => g.goalNumber === 6) ||
          dcpGoals.leastCommonlyAchieved.find(g => g.goalNumber === 6)
        expect(goal6).toBeDefined()
        expect(goal6?.achievementCount).toBe(0)
      })

      it('should not count Goal 6 when club has additional but no base Level 4 awards', async () => {
        const districtId = '42'
        const date = '2024-11-01'

        const clubPerformance = [
          {
            'Club Number': '123',
            'Club Name': 'Test Club',
            'Level 4s, Path Completions, or DTM Awards': '0',
            'Add. Level 4s, Path Completions, or DTM award': '1',
            'Active Membership': '20',
            'Goals Met': '0',
            Division: 'A',
            Area: '1',
          },
        ]

        await cacheManager.cacheDistrictData(
          districtId,
          date,
          [],
          [],
          clubPerformance
        )
        const analytics =
          await analyticsEngine.generateDistrictAnalytics(districtId)

        const dcpGoals = analytics.distinguishedClubAnalytics.dcpGoalAnalysis
        const goal6 =
          dcpGoals.mostCommonlyAchieved.find(g => g.goalNumber === 6) ||
          dcpGoals.leastCommonlyAchieved.find(g => g.goalNumber === 6)
        expect(goal6).toBeDefined()
        expect(goal6?.achievementCount).toBe(0)
      })

      it('should count Goal 6 when club has both base and additional Level 4 awards (2025+ format)', async () => {
        const districtId = '42'
        const date = '2024-11-01'

        const clubPerformance = [
          {
            'Club Number': '123',
            'Club Name': 'Test Club',
            'Level 4s, Path Completions, or DTM Awards': '1',
            'Add. Level 4s, Path Completions, or DTM award': '1',
            'Active Membership': '20',
            'Goals Met': '6',
            Division: 'A',
            Area: '1',
          },
        ]

        await cacheManager.cacheDistrictData(
          districtId,
          date,
          [],
          [],
          clubPerformance
        )
        const analytics =
          await analyticsEngine.generateDistrictAnalytics(districtId)

        const dcpGoals = analytics.distinguishedClubAnalytics.dcpGoalAnalysis
        const goal6 =
          dcpGoals.mostCommonlyAchieved.find(g => g.goalNumber === 6) ||
          dcpGoals.leastCommonlyAchieved.find(g => g.goalNumber === 6)
        expect(goal6).toBeDefined()
        expect(goal6?.achievementCount).toBe(1)
      })

      it('should count Goal 6 with 2020-2024 format (Level 5s)', async () => {
        const districtId = '42'
        const date = '2024-11-01'

        const clubPerformance = [
          {
            'Club Number': '123',
            'Club Name': 'Test Club',
            'Level 4s, Level 5s, or DTM award': '2',
            'Add. Level 4s, Level 5s, or DTM award': '1',
            'Active Membership': '20',
            'Goals Met': '6',
            Division: 'A',
            Area: '1',
          },
        ]

        await cacheManager.cacheDistrictData(
          districtId,
          date,
          [],
          [],
          clubPerformance
        )
        const analytics =
          await analyticsEngine.generateDistrictAnalytics(districtId)

        const dcpGoals = analytics.distinguishedClubAnalytics.dcpGoalAnalysis
        const goal6 =
          dcpGoals.mostCommonlyAchieved.find(g => g.goalNumber === 6) ||
          dcpGoals.leastCommonlyAchieved.find(g => g.goalNumber === 6)
        expect(goal6).toBeDefined()
        expect(goal6?.achievementCount).toBe(1)
      })

      it('should count Goal 6 with 2019 format (CL/AL/DTMs)', async () => {
        const districtId = '42'
        const date = '2024-11-01'

        const clubPerformance = [
          {
            'Club Number': '123',
            'Club Name': 'Test Club',
            'CL/AL/DTMs': '1',
            'Add. CL/AL/DTMs': '1',
            'Active Membership': '20',
            'Goals Met': '6',
            Division: 'A',
            Area: '1',
          },
        ]

        await cacheManager.cacheDistrictData(
          districtId,
          date,
          [],
          [],
          clubPerformance
        )
        const analytics =
          await analyticsEngine.generateDistrictAnalytics(districtId)

        const dcpGoals = analytics.distinguishedClubAnalytics.dcpGoalAnalysis
        const goal6 =
          dcpGoals.mostCommonlyAchieved.find(g => g.goalNumber === 6) ||
          dcpGoals.leastCommonlyAchieved.find(g => g.goalNumber === 6)
        expect(goal6).toBeDefined()
        expect(goal6?.achievementCount).toBe(1)
      })
    })

    describe('Goals 3 and 8 counting', () => {
      it('should not count Goal 3 when club has base but no additional Level 2s', async () => {
        const districtId = '42'
        const date = '2024-11-01'

        const clubPerformance = [
          {
            'Club Number': '123',
            'Club Name': 'Test Club',
            'Level 2s': '2',
            'Add. Level 2s': '0',
            'Active Membership': '20',
            'Goals Met': '2',
            Division: 'A',
            Area: '1',
          },
        ]

        await cacheManager.cacheDistrictData(
          districtId,
          date,
          [],
          [],
          clubPerformance
        )
        const analytics =
          await analyticsEngine.generateDistrictAnalytics(districtId)

        const dcpGoals = analytics.distinguishedClubAnalytics.dcpGoalAnalysis
        const goal3 =
          dcpGoals.mostCommonlyAchieved.find(g => g.goalNumber === 3) ||
          dcpGoals.leastCommonlyAchieved.find(g => g.goalNumber === 3)
        expect(goal3).toBeDefined()
        expect(goal3?.achievementCount).toBe(0)
      })

      it('should count Goal 3 when club has both base and additional Level 2s', async () => {
        const districtId = '42'
        const date = '2024-11-01'

        const clubPerformance = [
          {
            'Club Number': '123',
            'Club Name': 'Test Club',
            'Level 2s': '2',
            'Add. Level 2s': '2',
            'Active Membership': '20',
            'Goals Met': '3',
            Division: 'A',
            Area: '1',
          },
        ]

        await cacheManager.cacheDistrictData(
          districtId,
          date,
          [],
          [],
          clubPerformance
        )
        const analytics =
          await analyticsEngine.generateDistrictAnalytics(districtId)

        const dcpGoals = analytics.distinguishedClubAnalytics.dcpGoalAnalysis
        const goal3 =
          dcpGoals.mostCommonlyAchieved.find(g => g.goalNumber === 3) ||
          dcpGoals.leastCommonlyAchieved.find(g => g.goalNumber === 3)
        expect(goal3).toBeDefined()
        expect(goal3?.achievementCount).toBe(1)
      })

      it('should not count Goal 8 when club has base but no additional New Members', async () => {
        const districtId = '42'
        const date = '2024-11-01'

        const clubPerformance = [
          {
            'Club Number': '123',
            'Club Name': 'Test Club',
            'New Members': '4',
            'Add. New Members': '0',
            'Active Membership': '20',
            'Goals Met': '7',
            Division: 'A',
            Area: '1',
          },
        ]

        await cacheManager.cacheDistrictData(
          districtId,
          date,
          [],
          [],
          clubPerformance
        )
        const analytics =
          await analyticsEngine.generateDistrictAnalytics(districtId)

        const dcpGoals = analytics.distinguishedClubAnalytics.dcpGoalAnalysis
        const goal8 =
          dcpGoals.mostCommonlyAchieved.find(g => g.goalNumber === 8) ||
          dcpGoals.leastCommonlyAchieved.find(g => g.goalNumber === 8)
        expect(goal8).toBeDefined()
        expect(goal8?.achievementCount).toBe(0)
      })

      it('should count Goal 8 when club has both base and additional New Members', async () => {
        const districtId = '42'
        const date = '2024-11-01'

        const clubPerformance = [
          {
            'Club Number': '123',
            'Club Name': 'Test Club',
            'New Members': '4',
            'Add. New Members': '4',
            'Active Membership': '28',
            'Goals Met': '8',
            Division: 'A',
            Area: '1',
          },
        ]

        await cacheManager.cacheDistrictData(
          districtId,
          date,
          [],
          [],
          clubPerformance
        )
        const analytics =
          await analyticsEngine.generateDistrictAnalytics(districtId)

        const dcpGoals = analytics.distinguishedClubAnalytics.dcpGoalAnalysis
        const goal8 =
          dcpGoals.mostCommonlyAchieved.find(g => g.goalNumber === 8) ||
          dcpGoals.leastCommonlyAchieved.find(g => g.goalNumber === 8)
        expect(goal8).toBeDefined()
        expect(goal8?.achievementCount).toBe(1)
      })
    })

    describe('integration test with real cached data', () => {
      it('should return non-zero counts for Goals 5 and 6 with November 2024 data', async () => {
        const districtId = '61'
        const date = '2024-11-22'

        // Try to load real cached data
        const entry = await cacheManager.getDistrictData(districtId, date)

        // Skip test if data doesn't exist
        if (!entry) {
          console.log(
            'Skipping integration test - no cached data for 2024-11-22'
          )
          return
        }

        const analytics =
          await analyticsEngine.generateDistrictAnalytics(districtId)

        const dcpGoals = analytics.distinguishedClubAnalytics.dcpGoalAnalysis
        const goal5 =
          dcpGoals.mostCommonlyAchieved.find(g => g.goalNumber === 5) ||
          dcpGoals.leastCommonlyAchieved.find(g => g.goalNumber === 5)
        const goal6 =
          dcpGoals.mostCommonlyAchieved.find(g => g.goalNumber === 6) ||
          dcpGoals.leastCommonlyAchieved.find(g => g.goalNumber === 6)

        expect(goal5).toBeDefined()
        expect(goal6).toBeDefined()

        // With real data, we expect non-zero counts
        expect(goal5?.achievementCount).toBeGreaterThan(0)
        expect(goal6?.achievementCount).toBeGreaterThan(0)
      })
    })
  })
})
