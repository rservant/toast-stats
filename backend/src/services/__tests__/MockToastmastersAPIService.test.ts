import { describe, it, expect } from 'vitest'
import { MockToastmastersAPIService } from '../MockToastmastersAPIService'

describe('MockToastmastersAPIService', () => {
  const service = new MockToastmastersAPIService()

  describe('getAllDistrictsRankings', () => {
    it('should return rankings with Borda count system', async () => {
      const result = await service.getAllDistrictsRankings()

      expect(result).toHaveProperty('rankings')
      expect(result).toHaveProperty('date')
      expect(Array.isArray(result.rankings)).toBe(true)
      expect(result.rankings.length).toBeGreaterThan(0)

      const firstDistrict = result.rankings[0]

      // Verify all required fields are present
      expect(firstDistrict).toHaveProperty('districtId')
      expect(firstDistrict).toHaveProperty('districtName')
      expect(firstDistrict).toHaveProperty('clubGrowthPercent')
      expect(firstDistrict).toHaveProperty('paymentGrowthPercent')
      expect(firstDistrict).toHaveProperty('distinguishedPercent')
      expect(firstDistrict).toHaveProperty('clubsRank')
      expect(firstDistrict).toHaveProperty('paymentsRank')
      expect(firstDistrict).toHaveProperty('distinguishedRank')
      expect(firstDistrict).toHaveProperty('aggregateScore')

      // Verify percentage values are numbers
      expect(typeof firstDistrict.clubGrowthPercent).toBe('number')
      expect(typeof firstDistrict.paymentGrowthPercent).toBe('number')
      expect(typeof firstDistrict.distinguishedPercent).toBe('number')

      // Verify ranks are positive integers
      expect(firstDistrict.clubsRank).toBeGreaterThan(0)
      expect(firstDistrict.paymentsRank).toBeGreaterThan(0)
      expect(firstDistrict.distinguishedRank).toBeGreaterThan(0)

      // Verify aggregate score is sum of Borda points (should be higher for better districts)
      expect(firstDistrict.aggregateScore).toBeGreaterThan(0)
    })

    it('should sort districts by aggregate score in descending order (higher is better)', async () => {
      const result = await service.getAllDistrictsRankings()

      for (let i = 1; i < result.rankings.length; i++) {
        expect(result.rankings[i - 1].aggregateScore).toBeGreaterThanOrEqual(
          result.rankings[i].aggregateScore
        )
      }
    })

    it('should calculate Borda points correctly', async () => {
      const result = await service.getAllDistrictsRankings()
      const totalDistricts = result.rankings.length

      // Find district with rank 1 in any category
      const districtWithRank1 = result.rankings.find(
        d =>
          d.clubsRank === 1 || d.paymentsRank === 1 || d.distinguishedRank === 1
      )

      if (districtWithRank1) {
        // Verify that rank 1 contributes the maximum Borda points (totalDistricts)
        // and the aggregate score reflects this
        expect(districtWithRank1.aggregateScore).toBeGreaterThan(
          totalDistricts - 1
        )
      }
    })

    it('should include percentage values for testing', async () => {
      const result = await service.getAllDistrictsRankings()

      // Verify that percentage values vary (not all the same)
      const clubPercentages = result.rankings.map(d => d.clubGrowthPercent)
      const paymentPercentages = result.rankings.map(
        d => d.paymentGrowthPercent
      )
      const distinguishedPercentages = result.rankings.map(
        d => d.distinguishedPercent
      )

      // Check that we have some variation in percentages
      const uniqueClubPercentages = new Set(clubPercentages)
      const uniquePaymentPercentages = new Set(paymentPercentages)
      const uniqueDistinguishedPercentages = new Set(distinguishedPercentages)

      expect(uniqueClubPercentages.size).toBeGreaterThan(1)
      expect(uniquePaymentPercentages.size).toBeGreaterThan(1)
      expect(uniqueDistinguishedPercentages.size).toBeGreaterThan(1)
    })
  })

  describe('getDistrictRankHistory', () => {
    it('should return history with Borda-based aggregate scores', async () => {
      const result = await service.getDistrictRankHistory('1')

      expect(result).toHaveProperty('districtId', '1')
      expect(result).toHaveProperty('districtName')
      expect(result).toHaveProperty('history')
      expect(Array.isArray(result.history)).toBe(true)

      if (result.history.length > 0) {
        const firstEntry = result.history[0]
        expect(firstEntry).toHaveProperty('date')
        expect(firstEntry).toHaveProperty('aggregateScore')
        expect(firstEntry).toHaveProperty('clubsRank')
        expect(firstEntry).toHaveProperty('paymentsRank')
        expect(firstEntry).toHaveProperty('distinguishedRank')

        // Verify aggregate score is reasonable for Borda system
        // With 8 districts, max score per category is 8, so max total is 24
        expect(firstEntry.aggregateScore).toBeGreaterThan(0)
        expect(firstEntry.aggregateScore).toBeLessThanOrEqual(24)
      }
    })
  })
})
