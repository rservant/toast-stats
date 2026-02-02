/**
 * Unit tests for BordaCountRankingCalculator
 *
 * Tests the buildRankingsData method that creates AllDistrictsRankingsData
 * from ranked districts.
 *
 * **Validates: Requirements 5.2**
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  BordaCountRankingCalculator,
  type RankingDistrictStatistics,
  type DistrictRankingData,
} from './BordaCountRankingCalculator.js'

describe('BordaCountRankingCalculator', () => {
  let calculator: BordaCountRankingCalculator

  beforeEach(() => {
    calculator = new BordaCountRankingCalculator()
  })

  describe('buildRankingsData', () => {
    it('should build AllDistrictsRankingsData with correct metadata', () => {
      const snapshotId = '2024-01-15'
      const rankedDistricts: RankingDistrictStatistics[] = []

      const result = calculator.buildRankingsData(rankedDistricts, snapshotId)

      expect(result.metadata.snapshotId).toBe(snapshotId)
      expect(result.metadata.schemaVersion).toBe('1.0')
      expect(result.metadata.calculationVersion).toBe('1.0')
      expect(result.metadata.rankingVersion).toBe('2.0')
      expect(result.metadata.sourceCsvDate).toBe(snapshotId)
      expect(result.metadata.totalDistricts).toBe(0)
      expect(result.metadata.fromCache).toBe(false)
      expect(result.metadata.calculatedAt).toBeDefined()
      expect(result.metadata.csvFetchedAt).toBeDefined()
    })

    it('should build rankings array from ranked districts', () => {
      const snapshotId = '2024-01-15'
      const ranking: DistrictRankingData = {
        clubsRank: 1,
        paymentsRank: 2,
        distinguishedRank: 3,
        aggregateScore: 150,
        clubGrowthPercent: 5.5,
        paymentGrowthPercent: 3.2,
        distinguishedPercent: 45.0,
        paidClubBase: 100,
        paymentBase: 5000,
        paidClubs: 105,
        totalPayments: 5160,
        distinguishedClubs: 47,
        activeClubs: 104,
        selectDistinguished: 20,
        presidentsDistinguished: 10,
        region: 'Region 1',
        districtName: 'District 42',
        rankingVersion: '2.0',
        calculatedAt: '2024-01-15T00:00:00.000Z',
      }

      const rankedDistricts: RankingDistrictStatistics[] = [
        {
          districtId: '42',
          asOfDate: '2024-01-15',
          membership: { total: 1000, change: 50, changePercent: 5.0, byClub: [] },
          clubs: {
            total: 105,
            active: 104,
            suspended: 1,
            ineligible: 0,
            low: 5,
            distinguished: 47,
          },
          education: { totalAwards: 200, byType: [], topClubs: [] },
          ranking,
        },
      ]

      const result = calculator.buildRankingsData(rankedDistricts, snapshotId)

      expect(result.rankings).toHaveLength(1)
      expect(result.metadata.totalDistricts).toBe(1)

      const districtRanking = result.rankings[0]
      expect(districtRanking).toBeDefined()
      expect(districtRanking!.districtId).toBe('42')
      expect(districtRanking!.districtName).toBe('District 42')
      expect(districtRanking!.region).toBe('Region 1')
      expect(districtRanking!.paidClubs).toBe(105)
      expect(districtRanking!.paidClubBase).toBe(100)
      expect(districtRanking!.clubGrowthPercent).toBe(5.5)
      expect(districtRanking!.totalPayments).toBe(5160)
      expect(districtRanking!.paymentBase).toBe(5000)
      expect(districtRanking!.paymentGrowthPercent).toBe(3.2)
      expect(districtRanking!.activeClubs).toBe(104)
      expect(districtRanking!.distinguishedClubs).toBe(47)
      expect(districtRanking!.selectDistinguished).toBe(20)
      expect(districtRanking!.presidentsDistinguished).toBe(10)
      expect(districtRanking!.distinguishedPercent).toBe(45.0)
      expect(districtRanking!.clubsRank).toBe(1)
      expect(districtRanking!.paymentsRank).toBe(2)
      expect(districtRanking!.distinguishedRank).toBe(3)
      expect(districtRanking!.aggregateScore).toBe(150)
    })

    it('should filter out districts without ranking data', () => {
      const snapshotId = '2024-01-15'
      const ranking: DistrictRankingData = {
        clubsRank: 1,
        paymentsRank: 1,
        distinguishedRank: 1,
        aggregateScore: 180,
        clubGrowthPercent: 10.0,
        paymentGrowthPercent: 8.0,
        distinguishedPercent: 50.0,
        paidClubBase: 50,
        paymentBase: 2500,
        paidClubs: 55,
        totalPayments: 2700,
        distinguishedClubs: 27,
        activeClubs: 54,
        selectDistinguished: 10,
        presidentsDistinguished: 5,
        region: 'Region 2',
        districtName: 'District 1',
        rankingVersion: '2.0',
        calculatedAt: '2024-01-15T00:00:00.000Z',
      }

      const rankedDistricts: RankingDistrictStatistics[] = [
        {
          districtId: '1',
          asOfDate: '2024-01-15',
          membership: { total: 500, change: 25, changePercent: 5.0, byClub: [] },
          clubs: {
            total: 55,
            active: 54,
            suspended: 1,
            ineligible: 0,
            low: 2,
            distinguished: 27,
          },
          education: { totalAwards: 100, byType: [], topClubs: [] },
          ranking,
        },
        {
          // District without ranking data - should be filtered out
          districtId: '2',
          asOfDate: '2024-01-15',
          membership: { total: 300, change: 10, changePercent: 3.0, byClub: [] },
          clubs: {
            total: 30,
            active: 29,
            suspended: 1,
            ineligible: 0,
            low: 3,
            distinguished: 10,
          },
          education: { totalAwards: 50, byType: [], topClubs: [] },
          // No ranking property
        },
      ]

      const result = calculator.buildRankingsData(rankedDistricts, snapshotId)

      // Only district with ranking data should be included
      expect(result.rankings).toHaveLength(1)
      expect(result.rankings[0]!.districtId).toBe('1')
    })

    it('should handle multiple districts correctly', () => {
      const snapshotId = '2024-01-15'

      const createRanking = (
        rank: number,
        districtName: string
      ): DistrictRankingData => ({
        clubsRank: rank,
        paymentsRank: rank,
        distinguishedRank: rank,
        aggregateScore: 200 - rank * 10,
        clubGrowthPercent: 10 - rank,
        paymentGrowthPercent: 8 - rank,
        distinguishedPercent: 50 - rank * 5,
        paidClubBase: 100,
        paymentBase: 5000,
        paidClubs: 100 + rank,
        totalPayments: 5000 + rank * 100,
        distinguishedClubs: 50 - rank * 2,
        activeClubs: 100,
        selectDistinguished: 20 - rank,
        presidentsDistinguished: 10 - rank,
        region: `Region ${rank}`,
        districtName,
        rankingVersion: '2.0',
        calculatedAt: '2024-01-15T00:00:00.000Z',
      })

      const rankedDistricts: RankingDistrictStatistics[] = [
        {
          districtId: '42',
          asOfDate: '2024-01-15',
          membership: { total: 1000, change: 50, changePercent: 5.0, byClub: [] },
          clubs: {
            total: 100,
            active: 100,
            suspended: 0,
            ineligible: 0,
            low: 0,
            distinguished: 50,
          },
          education: { totalAwards: 200, byType: [], topClubs: [] },
          ranking: createRanking(1, 'District 42'),
        },
        {
          districtId: 'F',
          asOfDate: '2024-01-15',
          membership: { total: 800, change: 40, changePercent: 5.0, byClub: [] },
          clubs: {
            total: 80,
            active: 80,
            suspended: 0,
            ineligible: 0,
            low: 0,
            distinguished: 40,
          },
          education: { totalAwards: 150, byType: [], topClubs: [] },
          ranking: createRanking(2, 'District F'),
        },
        {
          districtId: '101',
          asOfDate: '2024-01-15',
          membership: { total: 600, change: 30, changePercent: 5.0, byClub: [] },
          clubs: {
            total: 60,
            active: 60,
            suspended: 0,
            ineligible: 0,
            low: 0,
            distinguished: 30,
          },
          education: { totalAwards: 100, byType: [], topClubs: [] },
          ranking: createRanking(3, 'District 101'),
        },
      ]

      const result = calculator.buildRankingsData(rankedDistricts, snapshotId)

      expect(result.rankings).toHaveLength(3)
      expect(result.metadata.totalDistricts).toBe(3)

      // Verify all districts are present
      const districtIds = result.rankings.map(r => r.districtId)
      expect(districtIds).toContain('42')
      expect(districtIds).toContain('F')
      expect(districtIds).toContain('101')
    })

    it('should return empty rankings array for empty input', () => {
      const snapshotId = '2024-01-15'
      const rankedDistricts: RankingDistrictStatistics[] = []

      const result = calculator.buildRankingsData(rankedDistricts, snapshotId)

      expect(result.rankings).toHaveLength(0)
      expect(result.metadata.totalDistricts).toBe(0)
    })
  })

  describe('getRankingVersion', () => {
    it('should return the current ranking version', () => {
      expect(calculator.getRankingVersion()).toBe('2.0')
    })
  })
})
