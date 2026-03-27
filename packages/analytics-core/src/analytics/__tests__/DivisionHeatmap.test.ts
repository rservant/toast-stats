import { describe, it, expect } from 'vitest'
import { DivisionAreaAnalyticsModule } from '../DivisionAreaAnalyticsModule.js'
import type { DistrictStatistics } from '../../interfaces.js'

/**
 * Minimal club factory for heatmap tests.
 */
function makeClub(overrides: {
  clubId: string
  divisionId: string
  membershipCount: number
  dcpGoals: number
}) {
  return {
    clubId: overrides.clubId,
    clubName: `Club ${overrides.clubId}`,
    divisionId: overrides.divisionId,
    divisionName: `Division ${overrides.divisionId}`,
    areaId: 'A1',
    areaName: 'Area A1',
    membershipCount: overrides.membershipCount,
    membershipBase: overrides.membershipCount,
    paymentsCount: overrides.membershipCount,
    dcpGoals: overrides.dcpGoals,
    status: 'Active',
    clubStatus: 'Active',
    octoberRenewals: 0,
    aprilRenewals: 0,
    newMembers: 0,
  }
}

function makeSnapshot(
  clubs: ReturnType<typeof makeClub>[]
): DistrictStatistics {
  return {
    districtId: '61',
    snapshotDate: '2026-03-01',
    clubs,
    divisions: [],
    areas: [],
    totals: {
      totalClubs: clubs.length,
      totalMembership: clubs.reduce((s, c) => s + c.membershipCount, 0),
      totalPayments: 0,
      distinguishedClubs: 0,
      selectDistinguishedClubs: 0,
      presidentDistinguishedClubs: 0,
    },
    divisionPerformance: [],
    clubPerformance: [],
    districtPerformance: [],
  }
}

describe('DivisionAreaAnalyticsModule — generateHeatmapData (#220)', () => {
  const module = new DivisionAreaAnalyticsModule()

  it('should return empty array for snapshot with no clubs', () => {
    const snapshot = makeSnapshot([])
    expect(module.generateHeatmapData(snapshot)).toEqual([])
  })

  it('should produce one row per division', () => {
    const snapshot = makeSnapshot([
      makeClub({
        clubId: '1',
        divisionId: 'A',
        membershipCount: 20,
        dcpGoals: 5,
      }),
      makeClub({
        clubId: '2',
        divisionId: 'A',
        membershipCount: 25,
        dcpGoals: 3,
      }),
      makeClub({
        clubId: '3',
        divisionId: 'B',
        membershipCount: 15,
        dcpGoals: 7,
      }),
    ])
    const result = module.generateHeatmapData(snapshot)
    expect(result).toHaveLength(2)
    expect(result[0]?.divisionId).toBe('A')
    expect(result[1]?.divisionId).toBe('B')
  })

  it('should produce 3 metric cells per division', () => {
    const snapshot = makeSnapshot([
      makeClub({
        clubId: '1',
        divisionId: 'A',
        membershipCount: 20,
        dcpGoals: 5,
      }),
    ])
    const result = module.generateHeatmapData(snapshot)
    expect(result[0]?.cells).toHaveLength(3)
    const metrics = result[0]?.cells.map(c => c.metric)
    expect(metrics).toEqual(['clubHealth', 'dcpProgress', 'membershipDensity'])
  })

  it('should normalize scores to 0–1 range', () => {
    const snapshot = makeSnapshot([
      makeClub({
        clubId: '1',
        divisionId: 'A',
        membershipCount: 20,
        dcpGoals: 5,
      }),
    ])
    const result = module.generateHeatmapData(snapshot)
    for (const cell of result[0]!.cells) {
      expect(cell.score).toBeGreaterThanOrEqual(0)
      expect(cell.score).toBeLessThanOrEqual(1)
    }
  })

  it('should compute correct club health score', () => {
    // All clubs healthy (membership >= 12 && dcpGoals >= 1) → health = 1.0
    const snapshot = makeSnapshot([
      makeClub({
        clubId: '1',
        divisionId: 'A',
        membershipCount: 20,
        dcpGoals: 3,
      }),
      makeClub({
        clubId: '2',
        divisionId: 'A',
        membershipCount: 18,
        dcpGoals: 2,
      }),
    ])
    const result = module.generateHeatmapData(snapshot)
    const healthCell = result[0]?.cells.find(c => c.metric === 'clubHealth')
    expect(healthCell?.score).toBe(1)
  })

  it('should compute mixed health scores correctly', () => {
    // 1 healthy (1.0) + 1 critical (0) = avg 0.5
    const snapshot = makeSnapshot([
      makeClub({
        clubId: '1',
        divisionId: 'A',
        membershipCount: 20,
        dcpGoals: 3,
      }),
      makeClub({
        clubId: '2',
        divisionId: 'A',
        membershipCount: 8,
        dcpGoals: 0,
      }),
    ])
    const result = module.generateHeatmapData(snapshot)
    const healthCell = result[0]?.cells.find(c => c.metric === 'clubHealth')
    expect(healthCell?.score).toBe(0.5)
  })

  it('should cap membership density score at 1.0', () => {
    // 50 members / 30 max → capped at 1.0
    const snapshot = makeSnapshot([
      makeClub({
        clubId: '1',
        divisionId: 'A',
        membershipCount: 50,
        dcpGoals: 1,
      }),
    ])
    const result = module.generateHeatmapData(snapshot)
    const densityCell = result[0]?.cells.find(
      c => c.metric === 'membershipDensity'
    )
    expect(densityCell?.score).toBe(1)
    expect(densityCell?.rawValue).toBe(50)
  })

  it('should sort rows by divisionId', () => {
    const snapshot = makeSnapshot([
      makeClub({
        clubId: '1',
        divisionId: 'C',
        membershipCount: 20,
        dcpGoals: 5,
      }),
      makeClub({
        clubId: '2',
        divisionId: 'A',
        membershipCount: 15,
        dcpGoals: 3,
      }),
      makeClub({
        clubId: '3',
        divisionId: 'B',
        membershipCount: 18,
        dcpGoals: 4,
      }),
    ])
    const result = module.generateHeatmapData(snapshot)
    expect(result.map(r => r.divisionId)).toEqual(['A', 'B', 'C'])
  })
})
