/**
 * MembershipAnalyticsModule Unit Tests
 *
 * Tests for the adapted MembershipAnalyticsModule that was moved from backend
 * to analytics-core. Verifies that the module produces correct results when
 * working with DistrictStatistics[] instead of IAnalyticsDataSource.
 *
 * Key test areas:
 * - generateMembershipAnalytics() returns correct MembershipAnalytics structure
 * - Seasonal patterns are correctly identified
 * - Program year change is correctly calculated
 * - Top growth/declining clubs are correctly identified
 * - Year-over-year comparison works correctly
 * - Edge cases: empty snapshots, single snapshot, no previous year data
 *
 * Requirements: 1.1, 1.2
 */

import { describe, it, expect } from 'vitest'
import { MembershipAnalyticsModule } from './MembershipAnalyticsModule.js'
import type { DistrictStatistics, ClubStatistics } from '../interfaces.js'

/**
 * Helper to create a mock club with specified properties
 */
function createMockClub(
  overrides: Partial<ClubStatistics> = {}
): ClubStatistics {
  return {
    clubId: '1234',
    clubName: 'Test Club',
    divisionId: 'A',
    areaId: 'A1',
    divisionName: 'Division A',
    areaName: 'Area A1',
    membershipCount: 25,
    paymentsCount: 20,
    dcpGoals: 5,
    status: 'Active',
    octoberRenewals: 10,
    aprilRenewals: 5,
    newMembers: 5,
    membershipBase: 20,
    clubStatus: 'Active',
    ...overrides,
  }
}

/**
 * Helper to create a mock district statistics snapshot
 */
function createMockSnapshot(
  districtId: string,
  snapshotDate: string,
  clubs: ClubStatistics[] = []
): DistrictStatistics {
  const totalMembership = clubs.reduce((sum, c) => sum + c.membershipCount, 0)
  const totalPayments = clubs.reduce((sum, c) => sum + c.paymentsCount, 0)

  return {
    districtId,
    snapshotDate,
    clubs,
    divisions: [],
    areas: [],
    totals: {
      totalClubs: clubs.length,
      totalMembership,
      totalPayments,
      distinguishedClubs: clubs.filter(c => c.dcpGoals >= 5).length,
      selectDistinguishedClubs: clubs.filter(c => c.dcpGoals >= 7).length,
      presidentDistinguishedClubs: clubs.filter(c => c.dcpGoals >= 9).length,
    },
  }
}

describe('MembershipAnalyticsModule', () => {
  describe('generateMembershipAnalytics - Basic Structure', () => {
    it('should return correct MembershipAnalytics structure with single snapshot', () => {
      const module = new MembershipAnalyticsModule()
      const clubs = [
        createMockClub({ clubId: '1', clubName: 'Club A', membershipCount: 25 }),
        createMockClub({ clubId: '2', clubName: 'Club B', membershipCount: 30 }),
      ]
      const snapshot = createMockSnapshot('D101', '2024-03-15', clubs)

      const result = module.generateMembershipAnalytics('D101', [snapshot])

      // Verify structure
      expect(result).toHaveProperty('totalMembership')
      expect(result).toHaveProperty('membershipChange')
      expect(result).toHaveProperty('programYearChange')
      expect(result).toHaveProperty('membershipTrend')
      expect(result).toHaveProperty('topGrowthClubs')
      expect(result).toHaveProperty('topDecliningClubs')
      expect(result).toHaveProperty('seasonalPatterns')
      expect(result).toHaveProperty('yearOverYearComparison')

      // Verify values
      expect(result.totalMembership).toBe(55) // 25 + 30
      expect(result.membershipChange).toBe(0) // Single snapshot = no change
      expect(result.membershipTrend).toHaveLength(1)
      expect(result.membershipTrend[0]).toEqual({ date: '2024-03-15', count: 55 })
    })

    it('should return empty analytics for empty snapshots array', () => {
      const module = new MembershipAnalyticsModule()

      const result = module.generateMembershipAnalytics('D101', [])

      expect(result.totalMembership).toBe(0)
      expect(result.membershipChange).toBe(0)
      expect(result.programYearChange).toBe(0)
      expect(result.membershipTrend).toHaveLength(0)
      expect(result.topGrowthClubs).toHaveLength(0)
      expect(result.topDecliningClubs).toHaveLength(0)
      expect(result.seasonalPatterns).toHaveLength(0)
      expect(result.yearOverYearComparison).toBeUndefined()
    })

    it('should return empty analytics when no snapshots match district ID', () => {
      const module = new MembershipAnalyticsModule()
      const snapshot = createMockSnapshot('D999', '2024-03-15', [
        createMockClub({ clubId: '1', membershipCount: 25 }),
      ])

      const result = module.generateMembershipAnalytics('D101', [snapshot])

      expect(result.totalMembership).toBe(0)
      expect(result.membershipChange).toBe(0)
      expect(result.membershipTrend).toHaveLength(0)
    })
  })

  describe('generateMembershipAnalytics - Membership Trend', () => {
    it('should calculate membership trend across multiple snapshots', () => {
      const module = new MembershipAnalyticsModule()
      const snapshots = [
        createMockSnapshot('D101', '2024-01-15', [
          createMockClub({ clubId: '1', membershipCount: 20 }),
        ]),
        createMockSnapshot('D101', '2024-02-15', [
          createMockClub({ clubId: '1', membershipCount: 22 }),
        ]),
        createMockSnapshot('D101', '2024-03-15', [
          createMockClub({ clubId: '1', membershipCount: 25 }),
        ]),
      ]

      const result = module.generateMembershipAnalytics('D101', snapshots)

      expect(result.membershipTrend).toHaveLength(3)
      expect(result.membershipTrend).toEqual([
        { date: '2024-01-15', count: 20 },
        { date: '2024-02-15', count: 22 },
        { date: '2024-03-15', count: 25 },
      ])
      expect(result.totalMembership).toBe(25) // Latest snapshot
      expect(result.membershipChange).toBe(5) // 25 - 20
    })

    it('should handle membership decline correctly', () => {
      const module = new MembershipAnalyticsModule()
      const snapshots = [
        createMockSnapshot('D101', '2024-01-15', [
          createMockClub({ clubId: '1', membershipCount: 30 }),
        ]),
        createMockSnapshot('D101', '2024-02-15', [
          createMockClub({ clubId: '1', membershipCount: 25 }),
        ]),
      ]

      const result = module.generateMembershipAnalytics('D101', snapshots)

      expect(result.membershipChange).toBe(-5) // 25 - 30
    })
  })


  describe('generateMembershipAnalytics - Top Growth Clubs', () => {
    it('should identify top growth clubs correctly', () => {
      const module = new MembershipAnalyticsModule()
      const snapshots = [
        createMockSnapshot('D101', '2024-01-15', [
          createMockClub({ clubId: '1', clubName: 'Growing Club', membershipCount: 20 }),
          createMockClub({ clubId: '2', clubName: 'Stable Club', membershipCount: 25 }),
          createMockClub({ clubId: '3', clubName: 'Fast Growing', membershipCount: 15 }),
        ]),
        createMockSnapshot('D101', '2024-03-15', [
          createMockClub({ clubId: '1', clubName: 'Growing Club', membershipCount: 28 }),
          createMockClub({ clubId: '2', clubName: 'Stable Club', membershipCount: 25 }),
          createMockClub({ clubId: '3', clubName: 'Fast Growing', membershipCount: 30 }),
        ]),
      ]

      const result = module.generateMembershipAnalytics('D101', snapshots)

      // Fast Growing: 30 - 15 = 15 growth
      // Growing Club: 28 - 20 = 8 growth
      // Stable Club: 25 - 25 = 0 growth (not included)
      expect(result.topGrowthClubs).toHaveLength(2)
      expect(result.topGrowthClubs[0]?.clubName).toBe('Fast Growing')
      expect(result.topGrowthClubs[0]?.growth).toBe(15)
      expect(result.topGrowthClubs[1]?.clubName).toBe('Growing Club')
      expect(result.topGrowthClubs[1]?.growth).toBe(8)
    })

    it('should return empty array when no clubs have growth', () => {
      const module = new MembershipAnalyticsModule()
      const snapshots = [
        createMockSnapshot('D101', '2024-01-15', [
          createMockClub({ clubId: '1', membershipCount: 25 }),
        ]),
        createMockSnapshot('D101', '2024-03-15', [
          createMockClub({ clubId: '1', membershipCount: 20 }),
        ]),
      ]

      const result = module.generateMembershipAnalytics('D101', snapshots)

      expect(result.topGrowthClubs).toHaveLength(0)
    })

    it('should limit top growth clubs to 10', () => {
      const module = new MembershipAnalyticsModule()
      // Create 15 clubs all with growth
      const clubs1 = Array.from({ length: 15 }, (_, i) =>
        createMockClub({ clubId: `${i + 1}`, clubName: `Club ${i + 1}`, membershipCount: 10 })
      )
      const clubs2 = Array.from({ length: 15 }, (_, i) =>
        createMockClub({ clubId: `${i + 1}`, clubName: `Club ${i + 1}`, membershipCount: 20 + i })
      )
      const snapshots = [
        createMockSnapshot('D101', '2024-01-15', clubs1),
        createMockSnapshot('D101', '2024-03-15', clubs2),
      ]

      const result = module.generateMembershipAnalytics('D101', snapshots)

      expect(result.topGrowthClubs).toHaveLength(10)
    })
  })

  describe('generateMembershipAnalytics - Top Declining Clubs', () => {
    it('should identify top declining clubs correctly', () => {
      const module = new MembershipAnalyticsModule()
      const snapshots = [
        createMockSnapshot('D101', '2024-01-15', [
          createMockClub({ clubId: '1', clubName: 'Declining Club', membershipCount: 30 }),
          createMockClub({ clubId: '2', clubName: 'Stable Club', membershipCount: 25 }),
          createMockClub({ clubId: '3', clubName: 'Fast Declining', membershipCount: 40 }),
        ]),
        createMockSnapshot('D101', '2024-03-15', [
          createMockClub({ clubId: '1', clubName: 'Declining Club', membershipCount: 25 }),
          createMockClub({ clubId: '2', clubName: 'Stable Club', membershipCount: 25 }),
          createMockClub({ clubId: '3', clubName: 'Fast Declining', membershipCount: 25 }),
        ]),
      ]

      const result = module.generateMembershipAnalytics('D101', snapshots)

      // Fast Declining: 40 - 25 = 15 decline
      // Declining Club: 30 - 25 = 5 decline
      // Stable Club: 25 - 25 = 0 decline (not included)
      expect(result.topDecliningClubs).toHaveLength(2)
      expect(result.topDecliningClubs[0]?.clubName).toBe('Fast Declining')
      expect(result.topDecliningClubs[0]?.decline).toBe(15)
      expect(result.topDecliningClubs[1]?.clubName).toBe('Declining Club')
      expect(result.topDecliningClubs[1]?.decline).toBe(5)
    })

    it('should return empty array when no clubs have decline', () => {
      const module = new MembershipAnalyticsModule()
      const snapshots = [
        createMockSnapshot('D101', '2024-01-15', [
          createMockClub({ clubId: '1', membershipCount: 20 }),
        ]),
        createMockSnapshot('D101', '2024-03-15', [
          createMockClub({ clubId: '1', membershipCount: 25 }),
        ]),
      ]

      const result = module.generateMembershipAnalytics('D101', snapshots)

      expect(result.topDecliningClubs).toHaveLength(0)
    })
  })


  describe('generateMembershipAnalytics - Seasonal Patterns', () => {
    it('should identify seasonal patterns from monthly data', () => {
      const module = new MembershipAnalyticsModule()
      // Create snapshots across multiple months showing growth in January
      const snapshots = [
        createMockSnapshot('D101', '2023-12-15', [
          createMockClub({ clubId: '1', membershipCount: 100 }),
        ]),
        createMockSnapshot('D101', '2024-01-15', [
          createMockClub({ clubId: '1', membershipCount: 110 }),
        ]),
        createMockSnapshot('D101', '2024-02-15', [
          createMockClub({ clubId: '1', membershipCount: 108 }),
        ]),
      ]

      const result = module.generateMembershipAnalytics('D101', snapshots)

      // Should have patterns for January and February
      expect(result.seasonalPatterns.length).toBeGreaterThan(0)
      
      const januaryPattern = result.seasonalPatterns.find(p => p.month === 1)
      expect(januaryPattern).toBeDefined()
      expect(januaryPattern?.monthName).toBe('January')
      expect(januaryPattern?.averageChange).toBe(10) // 110 - 100
      expect(januaryPattern?.trend).toBe('growth')

      const februaryPattern = result.seasonalPatterns.find(p => p.month === 2)
      expect(februaryPattern).toBeDefined()
      expect(februaryPattern?.averageChange).toBe(-2) // 108 - 110
      expect(februaryPattern?.trend).toBe('stable') // -2 is within stable range
    })

    it('should classify trends correctly based on average change', () => {
      const module = new MembershipAnalyticsModule()
      // Create data that will produce clear growth, decline, and stable patterns
      const snapshots = [
        createMockSnapshot('D101', '2023-11-15', [
          createMockClub({ clubId: '1', membershipCount: 100 }),
        ]),
        createMockSnapshot('D101', '2023-12-15', [
          createMockClub({ clubId: '1', membershipCount: 90 }), // -10 decline
        ]),
        createMockSnapshot('D101', '2024-01-15', [
          createMockClub({ clubId: '1', membershipCount: 100 }), // +10 growth
        ]),
        createMockSnapshot('D101', '2024-02-15', [
          createMockClub({ clubId: '1', membershipCount: 101 }), // +1 stable
        ]),
      ]

      const result = module.generateMembershipAnalytics('D101', snapshots)

      const decemberPattern = result.seasonalPatterns.find(p => p.month === 12)
      expect(decemberPattern?.trend).toBe('decline')

      const januaryPattern = result.seasonalPatterns.find(p => p.month === 1)
      expect(januaryPattern?.trend).toBe('growth')

      const februaryPattern = result.seasonalPatterns.find(p => p.month === 2)
      expect(februaryPattern?.trend).toBe('stable')
    })

    it('should return empty patterns for single snapshot', () => {
      const module = new MembershipAnalyticsModule()
      const snapshot = createMockSnapshot('D101', '2024-01-15', [
        createMockClub({ clubId: '1', membershipCount: 100 }),
      ])

      const result = module.generateMembershipAnalytics('D101', [snapshot])

      expect(result.seasonalPatterns).toHaveLength(0)
    })

    it('should sort patterns by month', () => {
      const module = new MembershipAnalyticsModule()
      const snapshots = [
        createMockSnapshot('D101', '2024-01-15', [
          createMockClub({ clubId: '1', membershipCount: 100 }),
        ]),
        createMockSnapshot('D101', '2024-02-15', [
          createMockClub({ clubId: '1', membershipCount: 105 }),
        ]),
        createMockSnapshot('D101', '2024-03-15', [
          createMockClub({ clubId: '1', membershipCount: 110 }),
        ]),
      ]

      const result = module.generateMembershipAnalytics('D101', snapshots)

      // Patterns should be sorted by month
      for (let i = 1; i < result.seasonalPatterns.length; i++) {
        const prev = result.seasonalPatterns[i - 1]
        const curr = result.seasonalPatterns[i]
        if (prev && curr) {
          expect(prev.month).toBeLessThan(curr.month)
        }
      }
    })
  })


  describe('generateMembershipAnalytics - Program Year Change', () => {
    it('should calculate program year change from July 1 start', () => {
      const module = new MembershipAnalyticsModule()
      // Program year 2023-2024 starts July 1, 2023
      const snapshots = [
        createMockSnapshot('D101', '2023-07-01', [
          createMockClub({ clubId: '1', membershipCount: 100 }),
        ]),
        createMockSnapshot('D101', '2023-10-15', [
          createMockClub({ clubId: '1', membershipCount: 110 }),
        ]),
        createMockSnapshot('D101', '2024-01-15', [
          createMockClub({ clubId: '1', membershipCount: 120 }),
        ]),
      ]

      const result = module.generateMembershipAnalytics('D101', snapshots)

      // Program year change should be from July 1 (100) to latest (120) = 20
      expect(result.programYearChange).toBe(20)
    })

    it('should use previous July for dates before July', () => {
      const module = new MembershipAnalyticsModule()
      // For March 2024, program year started July 1, 2023
      const snapshots = [
        createMockSnapshot('D101', '2023-07-15', [
          createMockClub({ clubId: '1', membershipCount: 100 }),
        ]),
        createMockSnapshot('D101', '2024-03-15', [
          createMockClub({ clubId: '1', membershipCount: 115 }),
        ]),
      ]

      const result = module.generateMembershipAnalytics('D101', snapshots)

      // Program year change from July 2023 (100) to March 2024 (115) = 15
      expect(result.programYearChange).toBe(15)
    })

    it('should use current July for dates in July or later', () => {
      const module = new MembershipAnalyticsModule()
      // For September 2024, program year started July 1, 2024
      const snapshots = [
        createMockSnapshot('D101', '2024-07-01', [
          createMockClub({ clubId: '1', membershipCount: 100 }),
        ]),
        createMockSnapshot('D101', '2024-09-15', [
          createMockClub({ clubId: '1', membershipCount: 108 }),
        ]),
      ]

      const result = module.generateMembershipAnalytics('D101', snapshots)

      // Program year change from July 2024 (100) to September 2024 (108) = 8
      expect(result.programYearChange).toBe(8)
    })

    it('should fall back to total change when no program year start data', () => {
      const module = new MembershipAnalyticsModule()
      // Only have data from October, no July data
      const snapshots = [
        createMockSnapshot('D101', '2023-10-15', [
          createMockClub({ clubId: '1', membershipCount: 100 }),
        ]),
        createMockSnapshot('D101', '2024-01-15', [
          createMockClub({ clubId: '1', membershipCount: 110 }),
        ]),
      ]

      const result = module.generateMembershipAnalytics('D101', snapshots)

      // Should use first available data point (October) as fallback
      expect(result.programYearChange).toBe(10) // 110 - 100
    })

    it('should return 0 for empty snapshots', () => {
      const module = new MembershipAnalyticsModule()

      const result = module.generateMembershipAnalytics('D101', [])

      expect(result.programYearChange).toBe(0)
    })
  })


  describe('generateMembershipAnalytics - Year Over Year Comparison', () => {
    it('should calculate year-over-year comparison when previous year data exists', () => {
      const module = new MembershipAnalyticsModule()
      const snapshots = [
        createMockSnapshot('D101', '2023-03-15', [
          createMockClub({ clubId: '1', membershipCount: 100 }),
        ]),
        createMockSnapshot('D101', '2024-03-15', [
          createMockClub({ clubId: '1', membershipCount: 120 }),
        ]),
      ]

      const result = module.generateMembershipAnalytics('D101', snapshots)

      expect(result.yearOverYearComparison).toBeDefined()
      expect(result.yearOverYearComparison?.currentMembership).toBe(120)
      expect(result.yearOverYearComparison?.previousMembership).toBe(100)
      expect(result.yearOverYearComparison?.membershipChange).toBe(20)
      expect(result.yearOverYearComparison?.percentageChange).toBe(20) // (20/100) * 100
    })

    it('should return undefined when no previous year data exists', () => {
      const module = new MembershipAnalyticsModule()
      const snapshots = [
        createMockSnapshot('D101', '2024-01-15', [
          createMockClub({ clubId: '1', membershipCount: 100 }),
        ]),
        createMockSnapshot('D101', '2024-03-15', [
          createMockClub({ clubId: '1', membershipCount: 110 }),
        ]),
      ]

      const result = module.generateMembershipAnalytics('D101', snapshots)

      expect(result.yearOverYearComparison).toBeUndefined()
    })

    it('should handle negative year-over-year change', () => {
      const module = new MembershipAnalyticsModule()
      const snapshots = [
        createMockSnapshot('D101', '2023-03-15', [
          createMockClub({ clubId: '1', membershipCount: 150 }),
        ]),
        createMockSnapshot('D101', '2024-03-15', [
          createMockClub({ clubId: '1', membershipCount: 120 }),
        ]),
      ]

      const result = module.generateMembershipAnalytics('D101', snapshots)

      expect(result.yearOverYearComparison?.membershipChange).toBe(-30)
      expect(result.yearOverYearComparison?.percentageChange).toBe(-20) // (-30/150) * 100
    })

    it('should handle zero previous membership gracefully', () => {
      const module = new MembershipAnalyticsModule()
      const snapshots = [
        createMockSnapshot('D101', '2023-03-15', []),
        createMockSnapshot('D101', '2024-03-15', [
          createMockClub({ clubId: '1', membershipCount: 100 }),
        ]),
      ]

      const result = module.generateMembershipAnalytics('D101', snapshots)

      // When previous membership is 0, percentage change should be 0
      expect(result.yearOverYearComparison?.previousMembership).toBe(0)
      expect(result.yearOverYearComparison?.percentageChange).toBe(0)
    })
  })


  describe('generateMembershipAnalytics - Edge Cases', () => {
    it('should handle single club correctly', () => {
      const module = new MembershipAnalyticsModule()
      const snapshots = [
        createMockSnapshot('D101', '2024-01-15', [
          createMockClub({ clubId: '1', clubName: 'Only Club', membershipCount: 25 }),
        ]),
        createMockSnapshot('D101', '2024-03-15', [
          createMockClub({ clubId: '1', clubName: 'Only Club', membershipCount: 30 }),
        ]),
      ]

      const result = module.generateMembershipAnalytics('D101', snapshots)

      expect(result.totalMembership).toBe(30)
      expect(result.membershipChange).toBe(5)
      expect(result.topGrowthClubs).toHaveLength(1)
      expect(result.topGrowthClubs[0]?.clubName).toBe('Only Club')
    })

    it('should handle clubs appearing in only some snapshots', () => {
      const module = new MembershipAnalyticsModule()
      const snapshots = [
        createMockSnapshot('D101', '2024-01-15', [
          createMockClub({ clubId: '1', clubName: 'Original Club', membershipCount: 20 }),
        ]),
        createMockSnapshot('D101', '2024-02-15', [
          createMockClub({ clubId: '1', clubName: 'Original Club', membershipCount: 22 }),
          createMockClub({ clubId: '2', clubName: 'New Club', membershipCount: 15 }),
        ]),
        createMockSnapshot('D101', '2024-03-15', [
          createMockClub({ clubId: '1', clubName: 'Original Club', membershipCount: 25 }),
          createMockClub({ clubId: '2', clubName: 'New Club', membershipCount: 20 }),
        ]),
      ]

      const result = module.generateMembershipAnalytics('D101', snapshots)

      // Total membership should be from latest snapshot
      expect(result.totalMembership).toBe(45) // 25 + 20

      // Both clubs should appear in growth analysis
      expect(result.topGrowthClubs.length).toBeGreaterThan(0)
    })

    it('should handle multiple districts in snapshots array', () => {
      const module = new MembershipAnalyticsModule()
      const snapshots = [
        createMockSnapshot('D101', '2024-01-15', [
          createMockClub({ clubId: '1', membershipCount: 20 }),
        ]),
        createMockSnapshot('D102', '2024-01-15', [
          createMockClub({ clubId: '2', membershipCount: 100 }),
        ]),
        createMockSnapshot('D101', '2024-03-15', [
          createMockClub({ clubId: '1', membershipCount: 25 }),
        ]),
      ]

      const result = module.generateMembershipAnalytics('D101', snapshots)

      // Should only include D101 data
      expect(result.totalMembership).toBe(25)
      expect(result.membershipChange).toBe(5)
      expect(result.membershipTrend).toHaveLength(2)
    })

    it('should handle clubs with zero membership', () => {
      const module = new MembershipAnalyticsModule()
      const snapshots = [
        createMockSnapshot('D101', '2024-01-15', [
          createMockClub({ clubId: '1', membershipCount: 0 }),
          createMockClub({ clubId: '2', membershipCount: 25 }),
        ]),
      ]

      const result = module.generateMembershipAnalytics('D101', snapshots)

      expect(result.totalMembership).toBe(25)
    })

    it('should handle large number of clubs', () => {
      const module = new MembershipAnalyticsModule()
      const clubs = Array.from({ length: 100 }, (_, i) =>
        createMockClub({
          clubId: `${i + 1}`,
          clubName: `Club ${i + 1}`,
          membershipCount: 20 + (i % 10),
        })
      )
      const snapshot = createMockSnapshot('D101', '2024-03-15', clubs)

      const result = module.generateMembershipAnalytics('D101', [snapshot])

      expect(result.totalMembership).toBe(clubs.reduce((sum, c) => sum + c.membershipCount, 0))
    })
  })


  describe('generateMembershipTrends - Backward Compatibility', () => {
    it('should return MembershipTrendData structure', () => {
      const module = new MembershipAnalyticsModule()
      const snapshots = [
        createMockSnapshot('D101', '2024-01-15', [
          createMockClub({ clubId: '1', membershipCount: 20, paymentsCount: 18 }),
        ]),
        createMockSnapshot('D101', '2024-03-15', [
          createMockClub({ clubId: '1', membershipCount: 25, paymentsCount: 22 }),
        ]),
      ]

      const result = module.generateMembershipTrends(snapshots)

      expect(result).toHaveProperty('membershipTrend')
      expect(result).toHaveProperty('paymentsTrend')
      expect(result.membershipTrend).toHaveLength(2)
      expect(result.paymentsTrend).toHaveLength(2)
    })

    it('should calculate payments trend correctly', () => {
      const module = new MembershipAnalyticsModule()
      const snapshots = [
        createMockSnapshot('D101', '2024-01-15', [
          createMockClub({ clubId: '1', paymentsCount: 15 }),
          createMockClub({ clubId: '2', paymentsCount: 20 }),
        ]),
        createMockSnapshot('D101', '2024-03-15', [
          createMockClub({ clubId: '1', paymentsCount: 18 }),
          createMockClub({ clubId: '2', paymentsCount: 25 }),
        ]),
      ]

      const result = module.generateMembershipTrends(snapshots)

      expect(result.paymentsTrend).toEqual([
        { date: '2024-01-15', payments: 35 },
        { date: '2024-03-15', payments: 43 },
      ])
    })

    it('should include year-over-year when data available', () => {
      const module = new MembershipAnalyticsModule()
      const snapshots = [
        createMockSnapshot('D101', '2023-03-15', [
          createMockClub({ clubId: '1', membershipCount: 100, paymentsCount: 90 }),
        ]),
        createMockSnapshot('D101', '2024-03-15', [
          createMockClub({ clubId: '1', membershipCount: 120, paymentsCount: 110 }),
        ]),
      ]

      const result = module.generateMembershipTrends(snapshots)

      expect(result.yearOverYear).toBeDefined()
      expect(result.yearOverYear?.membershipChange).toBe(20)
      expect(result.yearOverYear?.paymentsChange).toBe(20)
    })
  })

  describe('Public Helper Methods', () => {
    it('getTotalMembership should sum all club memberships', () => {
      const module = new MembershipAnalyticsModule()
      const snapshot = createMockSnapshot('D101', '2024-03-15', [
        createMockClub({ clubId: '1', membershipCount: 25 }),
        createMockClub({ clubId: '2', membershipCount: 30 }),
        createMockClub({ clubId: '3', membershipCount: 15 }),
      ])

      const result = module.getTotalMembership(snapshot)

      expect(result).toBe(70)
    })

    it('getTotalPayments should sum all club payments', () => {
      const module = new MembershipAnalyticsModule()
      const snapshot = createMockSnapshot('D101', '2024-03-15', [
        createMockClub({ clubId: '1', paymentsCount: 20 }),
        createMockClub({ clubId: '2', paymentsCount: 25 }),
      ])

      const result = module.getTotalPayments(snapshot)

      expect(result).toBe(45)
    })

    it('calculateMembershipChange should return difference between first and last', () => {
      const module = new MembershipAnalyticsModule()
      const snapshots = [
        createMockSnapshot('D101', '2024-01-15', [
          createMockClub({ clubId: '1', membershipCount: 100 }),
        ]),
        createMockSnapshot('D101', '2024-02-15', [
          createMockClub({ clubId: '1', membershipCount: 110 }),
        ]),
        createMockSnapshot('D101', '2024-03-15', [
          createMockClub({ clubId: '1', membershipCount: 125 }),
        ]),
      ]

      const result = module.calculateMembershipChange(snapshots)

      expect(result).toBe(25) // 125 - 100
    })

    it('calculateMembershipChange should return 0 for single snapshot', () => {
      const module = new MembershipAnalyticsModule()
      const snapshots = [
        createMockSnapshot('D101', '2024-01-15', [
          createMockClub({ clubId: '1', membershipCount: 100 }),
        ]),
      ]

      const result = module.calculateMembershipChange(snapshots)

      expect(result).toBe(0)
    })

    it('calculateTopGrowthClubs should respect limit parameter', () => {
      const module = new MembershipAnalyticsModule()
      const clubs1 = Array.from({ length: 10 }, (_, i) =>
        createMockClub({ clubId: `${i + 1}`, clubName: `Club ${i + 1}`, membershipCount: 10 })
      )
      const clubs2 = Array.from({ length: 10 }, (_, i) =>
        createMockClub({ clubId: `${i + 1}`, clubName: `Club ${i + 1}`, membershipCount: 20 + i })
      )
      const snapshots = [
        createMockSnapshot('D101', '2024-01-15', clubs1),
        createMockSnapshot('D101', '2024-03-15', clubs2),
      ]

      const result = module.calculateTopGrowthClubs(snapshots, 5)

      expect(result).toHaveLength(5)
    })

    it('calculateTopDecliningClubs should respect limit parameter', () => {
      const module = new MembershipAnalyticsModule()
      const clubs1 = Array.from({ length: 10 }, (_, i) =>
        createMockClub({ clubId: `${i + 1}`, clubName: `Club ${i + 1}`, membershipCount: 30 - i })
      )
      const clubs2 = Array.from({ length: 10 }, (_, i) =>
        createMockClub({ clubId: `${i + 1}`, clubName: `Club ${i + 1}`, membershipCount: 10 })
      )
      const snapshots = [
        createMockSnapshot('D101', '2024-01-15', clubs1),
        createMockSnapshot('D101', '2024-03-15', clubs2),
      ]

      const result = module.calculateTopDecliningClubs(snapshots, 3)

      expect(result).toHaveLength(3)
    })
  })
})
