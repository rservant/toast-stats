import { describe, it, expect } from 'vitest'
import { ClubHealthAnalyticsModule } from '../ClubHealthAnalyticsModule.js'
import type { ClubHealthData, ClubTrend } from '../../types.js'

function makeClubTrend(overrides: Partial<ClubTrend>): ClubTrend {
  return {
    clubId: '1',
    clubName: 'Test Club',
    divisionId: 'A',
    divisionName: 'Division A',
    areaId: 'A1',
    areaName: 'Area A1',
    currentStatus: 'vulnerable',
    healthScore: 0.5,
    membershipCount: 18,
    membershipBase: 20,
    paymentsCount: 18,
    membershipTrend: [],
    dcpGoalsTrend: [],
    riskFactors: [],
    distinguishedLevel: 'NotDistinguished',
    ...overrides,
  }
}

function makeHealthData(clubs: ClubTrend[]): ClubHealthData {
  return {
    allClubs: clubs,
    thrivingClubs: clubs.filter(c => c.currentStatus === 'thriving'),
    vulnerableClubs: clubs.filter(c => c.currentStatus === 'vulnerable'),
    interventionRequiredClubs: clubs.filter(
      c => c.currentStatus === 'intervention-required'
    ),
  }
}

describe('ClubHealthAnalyticsModule — Seasonal Risk Scoring (#221)', () => {
  const module = new ClubHealthAnalyticsModule()

  describe('SEASONAL_THRESHOLDS', () => {
    it('should define thresholds for January, June, July, August', () => {
      expect(ClubHealthAnalyticsModule.SEASONAL_THRESHOLDS.get(1)).toBe(3)
      expect(ClubHealthAnalyticsModule.SEASONAL_THRESHOLDS.get(6)).toBe(2)
      expect(ClubHealthAnalyticsModule.SEASONAL_THRESHOLDS.get(7)).toBe(4)
      expect(ClubHealthAnalyticsModule.SEASONAL_THRESHOLDS.get(8)).toBe(3)
    })

    it('should not define thresholds for non-seasonal months', () => {
      expect(
        ClubHealthAnalyticsModule.SEASONAL_THRESHOLDS.get(3)
      ).toBeUndefined()
      expect(
        ClubHealthAnalyticsModule.SEASONAL_THRESHOLDS.get(10)
      ).toBeUndefined()
    })
  })

  describe('applySeasonalAdjustments', () => {
    it('should not modify clubs when month has no seasonal threshold', () => {
      const club = makeClubTrend({
        membershipTrend: [
          { date: '2026-02-01', count: 20 },
          { date: '2026-03-01', count: 18 },
        ],
      })
      const data = makeHealthData([club])

      module.applySeasonalAdjustments(data, 3) // March — no threshold
      expect(club.isSeasonallyAdjusted).toBeUndefined()
    })

    it('should mark vulnerable club as seasonally adjusted when decline is within threshold', () => {
      const club = makeClubTrend({
        currentStatus: 'vulnerable',
        riskFactors: [
          'Membership below threshold (18 members, need 20+ or net growth 3+)',
        ],
        membershipTrend: [
          { date: '2025-12-01', count: 20 },
          { date: '2026-01-01', count: 18 }, // 2 members decline, threshold is 3
        ],
      })
      const data = makeHealthData([club])

      module.applySeasonalAdjustments(data, 1) // January
      expect(club.isSeasonallyAdjusted).toBe(true)
      expect(club.riskFactors).toContain('Seasonal decline (expected)')
      expect(club.riskFactors).not.toContain(
        'Membership below threshold (18 members, need 20+ or net growth 3+)'
      )
    })

    it('should NOT mark club when decline exceeds seasonal threshold', () => {
      const club = makeClubTrend({
        currentStatus: 'vulnerable',
        riskFactors: [
          'Membership below threshold (14 members, need 20+ or net growth 3+)',
        ],
        membershipTrend: [
          { date: '2025-12-01', count: 20 },
          { date: '2026-01-01', count: 14 }, // 6 members decline, threshold is 3
        ],
      })
      const data = makeHealthData([club])

      module.applySeasonalAdjustments(data, 1)
      expect(club.isSeasonallyAdjusted).toBeUndefined()
    })

    it('should NOT adjust thriving clubs', () => {
      const club = makeClubTrend({
        currentStatus: 'thriving',
        membershipTrend: [
          { date: '2025-12-01', count: 22 },
          { date: '2026-01-01', count: 20 },
        ],
      })
      const data = makeHealthData([club])

      module.applySeasonalAdjustments(data, 1)
      expect(club.isSeasonallyAdjusted).toBeUndefined()
    })

    it('should NOT adjust clubs with membership growth (no decline)', () => {
      const club = makeClubTrend({
        currentStatus: 'vulnerable',
        membershipTrend: [
          { date: '2025-12-01', count: 18 },
          { date: '2026-01-01', count: 19 },
        ],
      })
      const data = makeHealthData([club])

      module.applySeasonalAdjustments(data, 1)
      expect(club.isSeasonallyAdjusted).toBeUndefined()
    })

    it('should preserve non-membership risk factors', () => {
      const club = makeClubTrend({
        currentStatus: 'vulnerable',
        riskFactors: [
          'Membership below threshold (18 members, need 20+ or net growth 3+)',
          'CSP not submitted',
        ],
        membershipTrend: [
          { date: '2025-12-01', count: 20 },
          { date: '2026-01-01', count: 18 },
        ],
      })
      const data = makeHealthData([club])

      module.applySeasonalAdjustments(data, 1)
      expect(club.riskFactors).toContain('CSP not submitted')
      expect(club.riskFactors).toContain('Seasonal decline (expected)')
    })

    it('should handle clubs with insufficient trend data', () => {
      const club = makeClubTrend({
        currentStatus: 'vulnerable',
        membershipTrend: [{ date: '2026-01-01', count: 18 }],
      })
      const data = makeHealthData([club])

      module.applySeasonalAdjustments(data, 1)
      expect(club.isSeasonallyAdjusted).toBeUndefined()
    })
  })
})
