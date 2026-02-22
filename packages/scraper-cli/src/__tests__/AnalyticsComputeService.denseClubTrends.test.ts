/**
 * Unit Tests for AnalyticsComputeService - Dense Club Trends Enrichment
 *
 * Tests that club-trends-index files are enriched with data from all
 * program-year snapshots, not just the 2 (previous-year + current) used
 * for the standard YoY computation.
 *
 * Issue #79b: Club membership graph only shows 1-2 points instead of
 * the full program-year history.
 *
 * Validates: Requirement 79b
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { AnalyticsComputeService } from '../services/AnalyticsComputeService.js'
import type {
  DistrictStatistics,
  PreComputedAnalyticsFile,
  ClubTrendsIndex,
} from '@toastmasters/analytics-core'

/**
 * Create an isolated test cache directory with automatic cleanup.
 */
function createIsolatedCacheDir(): {
  path: string
  cleanup: () => Promise<void>
} {
  const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const cachePath = path.join(
    os.tmpdir(),
    `analytics-dense-trends-test-${uniqueId}`
  )

  return {
    path: cachePath,
    cleanup: async () => {
      await fs.rm(cachePath, { recursive: true, force: true })
    },
  }
}

/**
 * Create sample district statistics with configurable membership per club.
 */
function createSampleDistrictStatistics(
  districtId: string,
  date: string,
  overrides?: {
    clubOneMembership?: number
    clubTwoMembership?: number
    clubThreeMembership?: number
    clubOneGoals?: number
    clubTwoGoals?: number
    clubThreeGoals?: number
  }
): DistrictStatistics {
  const club1Membership = overrides?.clubOneMembership ?? 25
  const club2Membership = overrides?.clubTwoMembership ?? 15
  const club3Membership = overrides?.clubThreeMembership ?? 8
  const club1Goals = overrides?.clubOneGoals ?? 7
  const club2Goals = overrides?.clubTwoGoals ?? 4
  const club3Goals = overrides?.clubThreeGoals ?? 2
  const totalMembership = club1Membership + club2Membership + club3Membership

  return {
    districtId,
    snapshotDate: date,
    clubs: [
      {
        clubId: '1234',
        clubName: 'Test Club One',
        divisionId: 'A',
        areaId: 'A1',
        divisionName: 'Division Alpha',
        areaName: 'Area A1',
        membershipCount: club1Membership,
        paymentsCount: 30,
        dcpGoals: club1Goals,
        status: 'Active',
        charterDate: '2020-01-15',
        octoberRenewals: 10,
        aprilRenewals: 8,
        newMembers: 12,
        membershipBase: 20,
      },
      {
        clubId: '5678',
        clubName: 'Test Club Two',
        divisionId: 'A',
        areaId: 'A2',
        divisionName: 'Division Alpha',
        areaName: 'Area A2',
        membershipCount: club2Membership,
        paymentsCount: 18,
        dcpGoals: club2Goals,
        status: 'Active',
        charterDate: '2019-06-01',
        octoberRenewals: 6,
        aprilRenewals: 5,
        newMembers: 7,
        membershipBase: 12,
      },
      {
        clubId: '9012',
        clubName: 'Test Club Three',
        divisionId: 'B',
        areaId: 'B1',
        divisionName: 'Division Beta',
        areaName: 'Area B1',
        membershipCount: club3Membership,
        paymentsCount: 10,
        dcpGoals: club3Goals,
        status: 'Active',
        charterDate: '2021-03-20',
        octoberRenewals: 3,
        aprilRenewals: 2,
        newMembers: 5,
        membershipBase: 10,
      },
    ],
    divisions: [
      {
        divisionId: 'A',
        divisionName: 'Division Alpha',
        clubCount: 2,
        membershipTotal: club1Membership + club2Membership,
        paymentsTotal: 48,
      },
      {
        divisionId: 'B',
        divisionName: 'Division Beta',
        clubCount: 1,
        membershipTotal: club3Membership,
        paymentsTotal: 10,
      },
    ],
    areas: [
      {
        areaId: 'A1',
        areaName: 'Area A1',
        divisionId: 'A',
        clubCount: 1,
        membershipTotal: club1Membership,
        paymentsTotal: 30,
      },
      {
        areaId: 'A2',
        areaName: 'Area A2',
        divisionId: 'A',
        clubCount: 1,
        membershipTotal: club2Membership,
        paymentsTotal: 18,
      },
      {
        areaId: 'B1',
        areaName: 'Area B1',
        divisionId: 'B',
        clubCount: 1,
        membershipTotal: club3Membership,
        paymentsTotal: 10,
      },
    ],
    totals: {
      totalClubs: 3,
      totalMembership,
      totalPayments: 58,
      distinguishedClubs: 1,
      selectDistinguishedClubs: 0,
      presidentDistinguishedClubs: 0,
    },
  }
}

/**
 * Write a district snapshot to the test cache directory.
 */
async function writeDistrictSnapshot(
  cacheDir: string,
  date: string,
  districtId: string,
  stats: DistrictStatistics
): Promise<void> {
  const snapshotDir = path.join(cacheDir, 'snapshots', date)
  await fs.mkdir(snapshotDir, { recursive: true })
  const snapshotPath = path.join(snapshotDir, `district_${districtId}.json`)
  await fs.writeFile(snapshotPath, JSON.stringify(stats, null, 2), 'utf-8')
}

/**
 * Read the club-trends-index output file for a district.
 */
async function readClubTrendsIndex(
  cacheDir: string,
  date: string,
  districtId: string
): Promise<PreComputedAnalyticsFile<ClubTrendsIndex>> {
  const filePath = path.join(
    cacheDir,
    'snapshots',
    date,
    'analytics',
    `district_${districtId}_club-trends-index.json`
  )
  const content = await fs.readFile(filePath, 'utf-8')
  return JSON.parse(content) as PreComputedAnalyticsFile<ClubTrendsIndex>
}

describe('AnalyticsComputeService - Dense Club Trends (#79b)', () => {
  let testCache: { path: string; cleanup: () => Promise<void> }

  beforeEach(async () => {
    testCache = createIsolatedCacheDir()
    await fs.mkdir(testCache.path, { recursive: true })
  })

  afterEach(async () => {
    await testCache.cleanup()
  })

  it('should enrich club-trends-index with data from multiple program-year snapshots', async () => {
    const districtId = '1'
    // Use dates within the same program year (July 1 - June 30)
    // Program year 2024-2025: July 1 2024 to June 30 2025
    const dates = [
      '2024-10-01', // earlier in program year
      '2024-11-15', // middle
      '2025-01-15', // current date for computation
    ]

    // Previous year snapshot for YoY
    const previousYearDate = '2024-01-15'

    // Create snapshots with different membership counts to show progression
    await writeDistrictSnapshot(
      testCache.path,
      previousYearDate,
      districtId,
      createSampleDistrictStatistics(districtId, previousYearDate, {
        clubOneMembership: 20,
        clubTwoMembership: 12,
        clubThreeMembership: 6,
      })
    )

    await writeDistrictSnapshot(
      testCache.path,
      dates[0]!,
      districtId,
      createSampleDistrictStatistics(districtId, dates[0]!, {
        clubOneMembership: 22,
        clubTwoMembership: 14,
        clubThreeMembership: 7,
        clubOneGoals: 3,
        clubTwoGoals: 2,
        clubThreeGoals: 1,
      })
    )

    await writeDistrictSnapshot(
      testCache.path,
      dates[1]!,
      districtId,
      createSampleDistrictStatistics(districtId, dates[1]!, {
        clubOneMembership: 24,
        clubTwoMembership: 15,
        clubThreeMembership: 8,
        clubOneGoals: 5,
        clubTwoGoals: 3,
        clubThreeGoals: 1,
      })
    )

    await writeDistrictSnapshot(
      testCache.path,
      dates[2]!,
      districtId,
      createSampleDistrictStatistics(districtId, dates[2]!, {
        clubOneMembership: 25,
        clubTwoMembership: 15,
        clubThreeMembership: 8,
        clubOneGoals: 7,
        clubTwoGoals: 4,
        clubThreeGoals: 2,
      })
    )

    const service = new AnalyticsComputeService({
      cacheDir: testCache.path,
    })

    const result = await service.computeDistrictAnalytics(
      dates[2]!,
      districtId,
      { force: true }
    )

    expect(result.success).toBe(true)
    expect(result.clubTrendsIndexPath).toBeDefined()

    // Read the club-trends-index output
    const indexFile = await readClubTrendsIndex(
      testCache.path,
      dates[2]!,
      districtId
    )

    const clubs = indexFile.data.clubs

    // Club 1234 should have membershipTrend with more than 2 points
    // (3 program-year dates + 1 previous year = 4 total, but enrichment
    // focuses on program-year dates, so at minimum 3)
    const club1 = clubs['1234']
    expect(club1).toBeDefined()
    expect(club1!.membershipTrend.length).toBeGreaterThanOrEqual(3)

    // Verify the trend data is sorted by date ascending
    const membershipDates = club1!.membershipTrend.map(p => p.date)
    const sortedDates = [...membershipDates].sort()
    expect(membershipDates).toEqual(sortedDates)

    // Verify membership values match what we set
    const club1Trend = club1!.membershipTrend
    // Should see the progression 22 → 24 → 25 from program-year dates
    const programYearTrend = club1Trend.filter(p => p.date >= '2024-07-01')
    expect(programYearTrend.length).toBe(3)
    expect(programYearTrend[0]!.count).toBe(22) // 2024-10-01
    expect(programYearTrend[1]!.count).toBe(24) // 2024-11-15
    expect(programYearTrend[2]!.count).toBe(25) // 2025-01-15

    // DCP goals should also be enriched
    const club1DcpTrend = club1!.dcpGoalsTrend
    const programYearDcp = club1DcpTrend.filter(p => p.date >= '2024-07-01')
    expect(programYearDcp.length).toBe(3)
    expect(programYearDcp[0]!.goalsAchieved).toBe(3)
    expect(programYearDcp[1]!.goalsAchieved).toBe(5)
    expect(programYearDcp[2]!.goalsAchieved).toBe(7)

    // All 3 clubs should be enriched
    expect(Object.keys(clubs)).toHaveLength(3)
    const club2 = clubs['5678']
    expect(club2).toBeDefined()
    expect(club2!.membershipTrend.length).toBeGreaterThanOrEqual(3)
  })

  it('should gracefully handle enrichment when no additional snapshots exist', async () => {
    const districtId = '1'
    const currentDate = '2025-01-15'
    const previousDate = '2024-01-15'

    // Only current + previous year snapshots (no extra program-year dates)
    await writeDistrictSnapshot(
      testCache.path,
      currentDate,
      districtId,
      createSampleDistrictStatistics(districtId, currentDate)
    )

    await writeDistrictSnapshot(
      testCache.path,
      previousDate,
      districtId,
      createSampleDistrictStatistics(districtId, previousDate, {
        clubOneMembership: 20,
      })
    )

    const service = new AnalyticsComputeService({
      cacheDir: testCache.path,
    })

    const result = await service.computeDistrictAnalytics(
      currentDate,
      districtId,
      { force: true }
    )

    expect(result.success).toBe(true)

    // Should still work with 2-point trends (no crash)
    const indexFile = await readClubTrendsIndex(
      testCache.path,
      currentDate,
      districtId
    )
    const club1 = indexFile.data.clubs['1234']
    expect(club1).toBeDefined()
    // With only current + previous, we get 2 points
    expect(club1!.membershipTrend.length).toBeGreaterThanOrEqual(2)
  })
})
