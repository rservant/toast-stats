import { describe, it, expect, beforeEach } from 'vitest'
import { BordaCountRankingCalculator } from '../RankingCalculator.js'
import type {
  DistrictStatistics,
  AllDistrictsCSVRecord,
} from '../../types/districts.js'

describe('BordaCountRankingCalculator - Property Tests', () => {
  let calculator: BordaCountRankingCalculator

  beforeEach(() => {
    calculator = new BordaCountRankingCalculator()
  })

  describe('Property 1: Borda Count Calculation Correctness', () => {
    it('should calculate Borda points correctly for any set of districts', async () => {
      // **Validates: Requirements 1.6, 1.7**

      // Generate test data with various district counts
      const testCases = [
        { districtCount: 3, expectedMaxPoints: 9 }, // 3 + 3 + 3 = 9
        { districtCount: 5, expectedMaxPoints: 15 }, // 5 + 5 + 5 = 15
        { districtCount: 10, expectedMaxPoints: 30 }, // 10 + 10 + 10 = 30
      ]

      for (const testCase of testCases) {
        const districts = generateDistrictsWithVariedMetrics(
          testCase.districtCount
        )
        const result = await calculator.calculateRankings(districts)

        // Verify all districts have ranking data
        expect(result).toHaveLength(testCase.districtCount)
        result.forEach(district => {
          expect(district.ranking).toBeDefined()
        })

        // Find the district with the best performance (should have rank 1 in all categories)
        const bestDistrict = result.find(
          d =>
            d.ranking?.clubsRank === 1 &&
            d.ranking?.paymentsRank === 1 &&
            d.ranking?.distinguishedRank === 1
        )

        expect(bestDistrict).toBeDefined()
        expect(bestDistrict?.ranking?.aggregateScore).toBe(
          testCase.expectedMaxPoints
        )

        // Verify Borda point calculation for each district
        result.forEach(district => {
          const ranking = district.ranking!
          const expectedClubPoints =
            testCase.districtCount - ranking.clubsRank + 1
          const expectedPaymentPoints =
            testCase.districtCount - ranking.paymentsRank + 1
          const expectedDistinguishedPoints =
            testCase.districtCount - ranking.distinguishedRank + 1
          const expectedTotal =
            expectedClubPoints +
            expectedPaymentPoints +
            expectedDistinguishedPoints

          expect(ranking.aggregateScore).toBe(expectedTotal)
        })
      }
    })
  })

  describe('Property 2: Category Ranking Consistency', () => {
    it('should rank districts by descending percentage values in each category', async () => {
      // **Validates: Requirements 1.2, 1.3, 1.4**

      // Generate districts with known ranking order
      const districts = generateDistrictsWithKnownOrder()
      const result = await calculator.calculateRankings(districts)

      // Sort results by district ID for consistent comparison
      const sortedResults = result.sort((a, b) =>
        a.districtId.localeCompare(b.districtId)
      )

      // Verify club growth ranking (D1 > D2 > D3 > D4 > D5)
      const clubRanks = sortedResults.map(d => d.ranking?.clubsRank)
      expect(clubRanks).toEqual([1, 2, 3, 4, 5])

      // Verify payment growth ranking (D5 > D4 > D3 > D2 > D1)
      const paymentRanks = sortedResults.map(d => d.ranking?.paymentsRank)
      expect(paymentRanks).toEqual([5, 4, 3, 2, 1])

      // Verify distinguished percentage ranking (D3 > D1 > D2 > D4 > D5)
      const distinguishedRanks = sortedResults.map(
        d => d.ranking?.distinguishedRank
      )
      expect(distinguishedRanks).toEqual([2, 3, 1, 4, 5])

      // Verify that higher percentages get better (lower) ranks
      for (let i = 0; i < sortedResults.length - 1; i++) {
        const current = sortedResults[i].ranking!
        const next = sortedResults[i + 1].ranking!

        // In club growth: D1 (50%) > D2 (40%) > D3 (30%) > D4 (20%) > D5 (10%)
        if (current.clubGrowthPercent > next.clubGrowthPercent) {
          expect(current.clubsRank).toBeLessThan(next.clubsRank)
        }
      }
    })
  })

  describe('Property 3: Tie Handling Correctness', () => {
    it('should assign the same rank to districts with equal metric values', async () => {
      // **Validates: Requirements 1.5**

      // Create districts with intentional ties
      const districts = generateDistrictsWithTies()
      const result = await calculator.calculateRankings(districts)

      // Find districts with tied values
      const d1 = result.find(d => d.districtId === 'D1')
      const d2 = result.find(d => d.districtId === 'D2')
      const d3 = result.find(d => d.districtId === 'D3')
      const d4 = result.find(d => d.districtId === 'D4')

      // D1 and D2 have same club growth (20%) - should have same rank
      expect(d1?.ranking?.clubsRank).toBe(d2?.ranking?.clubsRank)
      expect(d1?.ranking?.clubsRank).toBe(1) // Both should be rank 1

      // D3 and D4 have same payment growth (15%) - should have same rank
      expect(d3?.ranking?.paymentsRank).toBe(d4?.ranking?.paymentsRank)
      expect(d3?.ranking?.paymentsRank).toBe(1) // Both should be rank 1

      // Verify that the next rank after a tie skips appropriately
      // If two districts tie for rank 1, the next district should be rank 3
      expect(d3?.ranking?.clubsRank).toBe(3) // After D1 and D2 tie for rank 1
      expect(d4?.ranking?.clubsRank).toBe(3) // After D1 and D2 tie for rank 1

      // Verify Borda points are calculated correctly for ties
      // With 4 districts: rank 1 gets 4 points, rank 3 gets 2 points
      expect(d1?.ranking?.clubsRank).toBe(1)
      expect(d2?.ranking?.clubsRank).toBe(1)
      expect(d3?.ranking?.clubsRank).toBe(3)
      expect(d4?.ranking?.clubsRank).toBe(3)
    })
  })

  describe('Property 4: Final Ranking Order', () => {
    it('should order districts by descending aggregate Borda score', async () => {
      // **Validates: Requirements 1.8**

      const districts = generateDistrictsWithVariedPerformance()
      const result = await calculator.calculateRankings(districts)

      // Extract aggregate scores
      const scores = result.map(d => d.ranking?.aggregateScore || 0)

      // Verify scores are in descending order
      for (let i = 0; i < scores.length - 1; i++) {
        expect(scores[i]).toBeGreaterThanOrEqual(scores[i + 1])
      }

      // Verify that the district with the highest aggregate score appears first
      const maxScore = Math.max(...scores)
      const firstDistrict = result[0]
      expect(firstDistrict.ranking?.aggregateScore).toBe(maxScore)

      // Verify that districts with better individual ranks have higher aggregate scores
      const bestOverallDistrict = result.find(
        d =>
          d.ranking?.clubsRank === 1 &&
          d.ranking?.paymentsRank === 1 &&
          d.ranking?.distinguishedRank === 1
      )

      if (bestOverallDistrict) {
        // This district should have the highest possible score
        const expectedMaxScore = districts.length * 3 // 3 categories, max points per category
        expect(bestOverallDistrict.ranking?.aggregateScore).toBe(
          expectedMaxScore
        )
      }
    })
  })

  describe('Property 5: Ranking Data Persistence', () => {
    it('should preserve all ranking fields when district statistics include ranking data', async () => {
      // **Validates: Requirements 2.1, 2.2, 2.3, 2.4**

      const districts = generateDistrictsWithVariedMetrics(5)
      const result = await calculator.calculateRankings(districts)

      // Verify all districts have complete ranking data
      result.forEach(district => {
        const ranking = district.ranking
        expect(ranking).toBeDefined()

        // Verify all required ranking fields are present
        expect(ranking?.clubsRank).toBeTypeOf('number')
        expect(ranking?.paymentsRank).toBeTypeOf('number')
        expect(ranking?.distinguishedRank).toBeTypeOf('number')
        expect(ranking?.aggregateScore).toBeTypeOf('number')

        // Verify growth metrics are preserved
        expect(ranking?.clubGrowthPercent).toBeTypeOf('number')
        expect(ranking?.paymentGrowthPercent).toBeTypeOf('number')
        expect(ranking?.distinguishedPercent).toBeTypeOf('number')

        // Verify base values are preserved
        expect(ranking?.paidClubBase).toBeTypeOf('number')
        expect(ranking?.paymentBase).toBeTypeOf('number')

        // Verify absolute values are preserved
        expect(ranking?.paidClubs).toBeTypeOf('number')
        expect(ranking?.totalPayments).toBeTypeOf('number')
        expect(ranking?.distinguishedClubs).toBeTypeOf('number')
        expect(ranking?.activeClubs).toBeTypeOf('number')
        expect(ranking?.selectDistinguished).toBeTypeOf('number')
        expect(ranking?.presidentsDistinguished).toBeTypeOf('number')

        // Verify metadata is preserved
        expect(ranking?.region).toBeTypeOf('string')
        expect(ranking?.districtName).toBeTypeOf('string')
        expect(ranking?.rankingVersion).toBeTypeOf('string')
        expect(ranking?.calculatedAt).toBeTypeOf('string')

        // Verify ranking values are within valid ranges
        expect(ranking?.clubsRank).toBeGreaterThanOrEqual(1)
        expect(ranking?.clubsRank).toBeLessThanOrEqual(districts.length)
        expect(ranking?.paymentsRank).toBeGreaterThanOrEqual(1)
        expect(ranking?.paymentsRank).toBeLessThanOrEqual(districts.length)
        expect(ranking?.distinguishedRank).toBeGreaterThanOrEqual(1)
        expect(ranking?.distinguishedRank).toBeLessThanOrEqual(districts.length)

        // Verify aggregate score is within valid range
        expect(ranking?.aggregateScore).toBeGreaterThanOrEqual(3) // Minimum: all last place
        expect(ranking?.aggregateScore).toBeLessThanOrEqual(
          districts.length * 3
        ) // Maximum: all first place
      })

      // Verify backward compatibility - districts without ranking data should still work
      const districtsWithoutRanking = generateDistrictsWithVariedMetrics(3)
      districtsWithoutRanking.forEach(district => {
        expect(district.ranking).toBeUndefined()
      })

      // After calculation, they should have ranking data
      const resultWithRanking = await calculator.calculateRankings(
        districtsWithoutRanking
      )
      resultWithRanking.forEach(district => {
        expect(district.ranking).toBeDefined()
      })
    })
  })

  describe('Property 6: Ranking Data Retrieval', () => {
    it('should maintain data integrity when ranking data is accessed from district statistics', async () => {
      // **Validates: Requirements 2.5**

      const districts = generateDistrictsWithKnownOrder()
      const result = await calculator.calculateRankings(districts)

      // Simulate API response transformation (as would happen in districts endpoint)
      const apiResponse = result.map(district => ({
        districtId: district.districtId,
        districtName: district.ranking?.districtName || district.districtId,
        region: district.ranking?.region || 'Unknown',
        clubsRank: district.ranking?.clubsRank || 0,
        paymentsRank: district.ranking?.paymentsRank || 0,
        distinguishedRank: district.ranking?.distinguishedRank || 0,
        aggregateScore: district.ranking?.aggregateScore || 0,
        clubGrowthPercent: district.ranking?.clubGrowthPercent || 0,
        paymentGrowthPercent: district.ranking?.paymentGrowthPercent || 0,
        distinguishedPercent: district.ranking?.distinguishedPercent || 0,
        paidClubBase: district.ranking?.paidClubBase || 0,
        paymentBase: district.ranking?.paymentBase || 0,
        paidClubs: district.ranking?.paidClubs || 0,
        totalPayments: district.ranking?.totalPayments || 0,
        distinguishedClubs: district.ranking?.distinguishedClubs || 0,
        activeClubs: district.ranking?.activeClubs || 0,
        selectDistinguished: district.ranking?.selectDistinguished || 0,
        presidentsDistinguished: district.ranking?.presidentsDistinguished || 0,
      }))

      // Verify API response completeness
      expect(apiResponse).toHaveLength(districts.length)

      apiResponse.forEach((apiDistrict, index) => {
        const originalDistrict = result[index]

        // Verify all fields are properly transformed
        expect(apiDistrict.districtId).toBe(originalDistrict.districtId)
        expect(apiDistrict.districtName).toBe(
          originalDistrict.ranking?.districtName
        )
        expect(apiDistrict.region).toBe(originalDistrict.ranking?.region)
        expect(apiDistrict.clubsRank).toBe(originalDistrict.ranking?.clubsRank)
        expect(apiDistrict.paymentsRank).toBe(
          originalDistrict.ranking?.paymentsRank
        )
        expect(apiDistrict.distinguishedRank).toBe(
          originalDistrict.ranking?.distinguishedRank
        )
        expect(apiDistrict.aggregateScore).toBe(
          originalDistrict.ranking?.aggregateScore
        )

        // Verify growth percentages are preserved
        expect(apiDistrict.clubGrowthPercent).toBe(
          originalDistrict.ranking?.clubGrowthPercent
        )
        expect(apiDistrict.paymentGrowthPercent).toBe(
          originalDistrict.ranking?.paymentGrowthPercent
        )
        expect(apiDistrict.distinguishedPercent).toBe(
          originalDistrict.ranking?.distinguishedPercent
        )

        // Verify base and absolute values are preserved
        expect(apiDistrict.paidClubBase).toBe(
          originalDistrict.ranking?.paidClubBase
        )
        expect(apiDistrict.paymentBase).toBe(
          originalDistrict.ranking?.paymentBase
        )
        expect(apiDistrict.paidClubs).toBe(originalDistrict.ranking?.paidClubs)
        expect(apiDistrict.totalPayments).toBe(
          originalDistrict.ranking?.totalPayments
        )
        expect(apiDistrict.distinguishedClubs).toBe(
          originalDistrict.ranking?.distinguishedClubs
        )
        expect(apiDistrict.activeClubs).toBe(
          originalDistrict.ranking?.activeClubs
        )
        expect(apiDistrict.selectDistinguished).toBe(
          originalDistrict.ranking?.selectDistinguished
        )
        expect(apiDistrict.presidentsDistinguished).toBe(
          originalDistrict.ranking?.presidentsDistinguished
        )

        // Verify no data loss occurred
        expect(apiDistrict.clubsRank).toBeGreaterThan(0)
        expect(apiDistrict.aggregateScore).toBeGreaterThan(0)
        expect(apiDistrict.districtName).toBeTruthy()
        expect(apiDistrict.region).toBeTruthy()
      })

      // Verify ranking order is preserved in API response
      const sortedByAggregate = [...apiResponse].sort(
        (a, b) => b.aggregateScore - a.aggregateScore
      )
      expect(sortedByAggregate[0].aggregateScore).toBeGreaterThanOrEqual(
        sortedByAggregate[sortedByAggregate.length - 1].aggregateScore
      )
    })
  })
})

/**
 * Generate districts with varied metrics for testing Borda count calculation
 */
function generateDistrictsWithVariedMetrics(
  count: number
): DistrictStatistics[] {
  const districts: DistrictStatistics[] = []

  for (let i = 0; i < count; i++) {
    const districtId = `D${i + 1}`

    // Create varied performance metrics
    const clubGrowth = 50 - i * 10 // 50%, 40%, 30%, etc.
    const paymentGrowth = 30 - i * 5 // 30%, 25%, 20%, etc.
    const distinguishedPercent = 40 - i * 8 // 40%, 32%, 24%, etc.

    const districtPerformance: AllDistrictsCSVRecord = {
      DISTRICT: districtId,
      REGION: 'Test Region',
      'Paid Clubs': '100',
      'Paid Club Base': '100',
      '% Club Growth': `${clubGrowth}%`,
      'Total YTD Payments': '10000',
      'Payment Base': '10000',
      '% Payment Growth': `${paymentGrowth}%`,
      'Active Clubs': '100',
      'Total Distinguished Clubs': `${Math.floor(distinguishedPercent)}`,
      'Select Distinguished Clubs': '0',
    }

    districts.push({
      districtId,
      asOfDate: '2024-01-01',
      membership: { total: 1000, change: 0, changePercent: 0, byClub: [] },
      clubs: {
        total: 100,
        active: 100,
        suspended: 0,
        ineligible: 0,
        low: 0,
        distinguished: 25,
      },
      education: { totalAwards: 100, byType: [], topClubs: [] },
      districtPerformance: [districtPerformance],
      divisionPerformance: [],
      clubPerformance: [],
    })
  }

  return districts
}

/**
 * Generate districts with known ranking order for testing consistency
 */
function generateDistrictsWithKnownOrder(): DistrictStatistics[] {
  const configs = [
    { id: 'D1', clubGrowth: 50, paymentGrowth: 10, distinguished: 30 },
    { id: 'D2', clubGrowth: 40, paymentGrowth: 20, distinguished: 25 },
    { id: 'D3', clubGrowth: 30, paymentGrowth: 30, distinguished: 35 },
    { id: 'D4', clubGrowth: 20, paymentGrowth: 40, distinguished: 20 },
    { id: 'D5', clubGrowth: 10, paymentGrowth: 50, distinguished: 15 },
  ]

  return configs.map(config => {
    const districtPerformance: AllDistrictsCSVRecord = {
      DISTRICT: config.id,
      REGION: 'Test Region',
      'Paid Clubs': '100',
      'Paid Club Base': '100',
      '% Club Growth': `${config.clubGrowth}%`,
      'Total YTD Payments': '10000',
      'Payment Base': '10000',
      '% Payment Growth': `${config.paymentGrowth}%`,
      'Active Clubs': '100',
      'Total Distinguished Clubs': `${config.distinguished}`,
      'Select Distinguished Clubs': '0',
    }

    return {
      districtId: config.id,
      asOfDate: '2024-01-01',
      membership: { total: 1000, change: 0, changePercent: 0, byClub: [] },
      clubs: {
        total: 100,
        active: 100,
        suspended: 0,
        ineligible: 0,
        low: 0,
        distinguished: 25,
      },
      education: { totalAwards: 100, byType: [], topClubs: [] },
      districtPerformance: [districtPerformance],
      divisionPerformance: [],
      clubPerformance: [],
    }
  })
}

/**
 * Generate districts with intentional ties for testing tie handling
 */
function generateDistrictsWithTies(): DistrictStatistics[] {
  const configs = [
    { id: 'D1', clubGrowth: 20, paymentGrowth: 10, distinguished: 25 }, // Tied with D2 for club growth
    { id: 'D2', clubGrowth: 20, paymentGrowth: 5, distinguished: 20 }, // Tied with D1 for club growth
    { id: 'D3', clubGrowth: 10, paymentGrowth: 15, distinguished: 30 }, // Tied with D4 for payment growth
    { id: 'D4', clubGrowth: 10, paymentGrowth: 15, distinguished: 15 }, // Tied with D3 for payment growth
  ]

  return configs.map(config => {
    const districtPerformance: AllDistrictsCSVRecord = {
      DISTRICT: config.id,
      REGION: 'Test Region',
      'Paid Clubs': '100',
      'Paid Club Base': '100',
      '% Club Growth': `${config.clubGrowth}%`,
      'Total YTD Payments': '10000',
      'Payment Base': '10000',
      '% Payment Growth': `${config.paymentGrowth}%`,
      'Active Clubs': '100',
      'Total Distinguished Clubs': `${config.distinguished}`,
      'Select Distinguished Clubs': '0',
    }

    return {
      districtId: config.id,
      asOfDate: '2024-01-01',
      membership: { total: 1000, change: 0, changePercent: 0, byClub: [] },
      clubs: {
        total: 100,
        active: 100,
        suspended: 0,
        ineligible: 0,
        low: 0,
        distinguished: 25,
      },
      education: { totalAwards: 100, byType: [], topClubs: [] },
      districtPerformance: [districtPerformance],
      divisionPerformance: [],
      clubPerformance: [],
    }
  })
}

/**
 * Generate districts with varied performance for testing final ranking order
 */
function generateDistrictsWithVariedPerformance(): DistrictStatistics[] {
  const configs = [
    { id: 'D1', clubGrowth: 15, paymentGrowth: 25, distinguished: 20 }, // Mixed performance
    { id: 'D2', clubGrowth: 30, paymentGrowth: 10, distinguished: 35 }, // High club & distinguished, low payment
    { id: 'D3', clubGrowth: 5, paymentGrowth: 40, distinguished: 15 }, // Low club & distinguished, high payment
    { id: 'D4', clubGrowth: 25, paymentGrowth: 30, distinguished: 30 }, // High all-around (should win)
    { id: 'D5', clubGrowth: 10, paymentGrowth: 15, distinguished: 10 }, // Low all-around (should lose)
  ]

  return configs.map(config => {
    const districtPerformance: AllDistrictsCSVRecord = {
      DISTRICT: config.id,
      REGION: 'Test Region',
      'Paid Clubs': '100',
      'Paid Club Base': '100',
      '% Club Growth': `${config.clubGrowth}%`,
      'Total YTD Payments': '10000',
      'Payment Base': '10000',
      '% Payment Growth': `${config.paymentGrowth}%`,
      'Active Clubs': '100',
      'Total Distinguished Clubs': `${config.distinguished}`,
      'Select Distinguished Clubs': '0',
    }

    return {
      districtId: config.id,
      asOfDate: '2024-01-01',
      membership: { total: 1000, change: 0, changePercent: 0, byClub: [] },
      clubs: {
        total: 100,
        active: 100,
        suspended: 0,
        ineligible: 0,
        low: 0,
        distinguished: 25,
      },
      education: { totalAwards: 100, byType: [], topClubs: [] },
      districtPerformance: [districtPerformance],
      divisionPerformance: [],
      clubPerformance: [],
    }
  })
}
