import { describe, it, expect, beforeEach } from 'vitest'
import { BordaCountRankingCalculator } from '../RankingCalculator.js'
import type {
  DistrictStatistics,
  AllDistrictsCSVRecord,
} from '../../types/districts.js'

describe('BordaCountRankingCalculator', () => {
  let calculator: BordaCountRankingCalculator

  beforeEach(() => {
    calculator = new BordaCountRankingCalculator()
  })

  describe('Basic functionality', () => {
    it('should return ranking version', () => {
      expect(calculator.getRankingVersion()).toBe('2.0')
    })

    it('should handle empty district list', async () => {
      const result = await calculator.calculateRankings([])
      expect(result).toEqual([])
    })

    it('should return original districts when ranking calculation fails', async () => {
      // Create districts with invalid data that will cause parsing errors
      const districts: DistrictStatistics[] = [
        {
          districtId: 'D1',
          asOfDate: '2024-01-01',
          membership: { total: 0, change: 0, changePercent: 0, byClub: [] },
          clubs: {
            total: 0,
            active: 0,
            suspended: 0,
            ineligible: 0,
            low: 0,
            distinguished: 0,
          },
          education: { totalAwards: 0, byType: [], topClubs: [] },
          // No districtPerformance data - will cause extraction to fail
        },
      ]

      const result = await calculator.calculateRankings(districts)
      expect(result).toEqual(districts) // Should return original districts unchanged
    })
  })

  describe('Ranking calculation', () => {
    it('should calculate rankings correctly for three districts', async () => {
      const districts = createTestDistricts([
        {
          districtId: 'D1',
          clubGrowthPercent: '25%',
          paymentGrowthPercent: '30%',
          distinguishedClubs: '30',
          activeClubs: '100',
        },
        {
          districtId: 'D2',
          clubGrowthPercent: '15%',
          paymentGrowthPercent: '20%',
          distinguishedClubs: '20',
          activeClubs: '100',
        },
        {
          districtId: 'D3',
          clubGrowthPercent: '5%',
          paymentGrowthPercent: '10%',
          distinguishedClubs: '10',
          activeClubs: '100',
        },
      ])

      const result = await calculator.calculateRankings(districts)

      // Verify all districts have ranking data
      expect(result).toHaveLength(3)
      result.forEach(district => {
        expect(district.ranking).toBeDefined()
        expect(district.ranking?.rankingVersion).toBe('2.0')
        expect(district.ranking?.calculatedAt).toBeDefined()
      })

      // Find districts by ID
      const d1 = result.find(d => d.districtId === 'D1')
      const d2 = result.find(d => d.districtId === 'D2')
      const d3 = result.find(d => d.districtId === 'D3')

      // Verify individual category rankings (1 = best)
      expect(d1?.ranking?.clubsRank).toBe(1) // 25% - highest
      expect(d2?.ranking?.clubsRank).toBe(2) // 15% - middle
      expect(d3?.ranking?.clubsRank).toBe(3) // 5% - lowest

      expect(d1?.ranking?.paymentsRank).toBe(1) // 30% - highest
      expect(d2?.ranking?.paymentsRank).toBe(2) // 20% - middle
      expect(d3?.ranking?.paymentsRank).toBe(3) // 10% - lowest

      expect(d1?.ranking?.distinguishedRank).toBe(1) // 30% - highest
      expect(d2?.ranking?.distinguishedRank).toBe(2) // 20% - middle
      expect(d3?.ranking?.distinguishedRank).toBe(3) // 10% - lowest

      // Verify Borda count scores
      // With 3 districts: rank 1 gets 3 points, rank 2 gets 2 points, rank 3 gets 1 point
      // D1: 3 + 3 + 3 = 9 points (all rank 1)
      // D2: 2 + 2 + 2 = 6 points (all rank 2)
      // D3: 1 + 1 + 1 = 3 points (all rank 3)
      expect(d1?.ranking?.aggregateScore).toBe(9)
      expect(d2?.ranking?.aggregateScore).toBe(6)
      expect(d3?.ranking?.aggregateScore).toBe(3)
    })

    it('should handle ties correctly', async () => {
      const districts = createTestDistricts([
        {
          districtId: 'D1',
          clubGrowthPercent: '20%',
          paymentGrowthPercent: '20%',
          distinguishedClubs: '20',
          activeClubs: '100',
        },
        {
          districtId: 'D2',
          clubGrowthPercent: '20%', // Same as D1 - should tie for rank 1
          paymentGrowthPercent: '20%', // Same as D1 - should tie for rank 1
          distinguishedClubs: '20', // Same as D1 - should tie for rank 1
          activeClubs: '100',
        },
        {
          districtId: 'D3',
          clubGrowthPercent: '10%',
          paymentGrowthPercent: '10%',
          distinguishedClubs: '10',
          activeClubs: '100',
        },
      ])

      const result = await calculator.calculateRankings(districts)

      const d1 = result.find(d => d.districtId === 'D1')
      const d2 = result.find(d => d.districtId === 'D2')
      const d3 = result.find(d => d.districtId === 'D3')

      // D1 and D2 should tie for rank 1 in all categories
      expect(d1?.ranking?.clubsRank).toBe(1)
      expect(d2?.ranking?.clubsRank).toBe(1)
      expect(d3?.ranking?.clubsRank).toBe(3) // Next rank after tie

      expect(d1?.ranking?.paymentsRank).toBe(1)
      expect(d2?.ranking?.paymentsRank).toBe(1)
      expect(d3?.ranking?.paymentsRank).toBe(3)

      expect(d1?.ranking?.distinguishedRank).toBe(1)
      expect(d2?.ranking?.distinguishedRank).toBe(1)
      expect(d3?.ranking?.distinguishedRank).toBe(3)

      // Borda points for ties: rank 1 gets 3 points, rank 3 gets 1 point
      // D1 and D2: 3 + 3 + 3 = 9 points each
      // D3: 1 + 1 + 1 = 3 points
      expect(d1?.ranking?.aggregateScore).toBe(9)
      expect(d2?.ranking?.aggregateScore).toBe(9)
      expect(d3?.ranking?.aggregateScore).toBe(3)
    })

    it('should preserve all ranking data fields', async () => {
      const districts = createTestDistricts([
        {
          districtId: 'D42',
          districtName: 'Test District',
          region: 'Test Region',
          clubGrowthPercent: '15%',
          paymentGrowthPercent: '25%',
          paidClubs: '150',
          paidClubBase: '130',
          totalPayments: '50000',
          paymentBase: '40000',
          distinguishedClubs: '25',
          activeClubs: '100',
        },
      ])

      const result = await calculator.calculateRankings(districts)
      const district = result[0]

      expect(district.ranking).toBeDefined()
      expect(district.ranking?.clubGrowthPercent).toBe(15)
      expect(district.ranking?.paymentGrowthPercent).toBe(25)
      expect(district.ranking?.distinguishedPercent).toBe(25) // 25/100 * 100
      expect(district.ranking?.paidClubs).toBe(150)
      expect(district.ranking?.paidClubBase).toBe(130)
      expect(district.ranking?.totalPayments).toBe(50000)
      expect(district.ranking?.paymentBase).toBe(40000)
      expect(district.ranking?.distinguishedClubs).toBe(25)
      expect(district.ranking?.activeClubs).toBe(100)
      expect(district.ranking?.region).toBe('Test Region')
      expect(district.ranking?.districtName).toBe('Test District')
      expect(district.ranking?.rankingVersion).toBe('2.0')
      expect(district.ranking?.calculatedAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
      )
    })
  })

  describe('Data parsing', () => {
    it('should parse percentage strings correctly', async () => {
      const districts = createTestDistricts([
        {
          districtId: 'D1',
          clubGrowthPercent: '15.5%', // With decimal
          paymentGrowthPercent: '-5%', // Negative
          distinguishedClubs: '20',
          activeClubs: '100',
        },
      ])

      const result = await calculator.calculateRankings(districts)
      const district = result[0]

      expect(district.ranking?.clubGrowthPercent).toBe(15.5)
      expect(district.ranking?.paymentGrowthPercent).toBe(-5)
    })

    it('should parse numbers with commas correctly', async () => {
      const districts = createTestDistricts([
        {
          districtId: 'D1',
          clubGrowthPercent: '10%',
          paymentGrowthPercent: '10%',
          paidClubs: '1,500', // With comma
          totalPayments: '100,000', // With comma
          distinguishedClubs: '25',
          activeClubs: '100',
        },
      ])

      const result = await calculator.calculateRankings(districts)
      const district = result[0]

      expect(district.ranking?.paidClubs).toBe(1500)
      expect(district.ranking?.totalPayments).toBe(100000)
    })

    it('should handle missing or invalid data gracefully', async () => {
      const districts = createTestDistricts([
        {
          districtId: 'D1',
          clubGrowthPercent: '', // Empty string
          paymentGrowthPercent: 'invalid%', // Invalid format
          paidClubs: 'not-a-number', // Invalid number
          distinguishedClubs: '20',
          activeClubs: '100',
        },
      ])

      const result = await calculator.calculateRankings(districts)
      const district = result[0]

      expect(district.ranking?.clubGrowthPercent).toBe(0)
      expect(district.ranking?.paymentGrowthPercent).toBe(0)
      expect(district.ranking?.paidClubs).toBe(0)
    })
  })
})

/**
 * Helper function to create test districts with ranking data
 */
function createTestDistricts(
  configs: Array<{
    districtId: string
    districtName?: string
    region?: string
    clubGrowthPercent: string
    paymentGrowthPercent: string
    paidClubs?: string
    paidClubBase?: string
    totalPayments?: string
    paymentBase?: string
    distinguishedClubs: string
    activeClubs: string
  }>
): DistrictStatistics[] {
  return configs.map(config => {
    const districtPerformance: AllDistrictsCSVRecord = {
      DISTRICT: config.districtName || config.districtId,
      REGION: config.region || 'Test Region',
      'Paid Clubs': config.paidClubs || '100',
      'Paid Club Base': config.paidClubBase || '100',
      '% Club Growth': config.clubGrowthPercent,
      'Total YTD Payments': config.totalPayments || '10000',
      'Payment Base': config.paymentBase || '10000',
      '% Payment Growth': config.paymentGrowthPercent,
      'Active Clubs': config.activeClubs,
      'Total Distinguished Clubs': config.distinguishedClubs,
      'Select Distinguished Clubs': '0',
    }

    return {
      districtId: config.districtId,
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
