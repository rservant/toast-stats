/**
 * Property-Based Tests for AnalyticsEngine Performance Targets
 *
 * These tests validate the correctness of performance targets integration
 * in the AnalyticsEngine using property-based testing with fast-check.
 *
 * **Feature: district-performance-targets**
 *
 * Property 6: API Response Completeness
 * Property 7: Missing Data Graceful Handling
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'
import { AnalyticsEngine } from '../AnalyticsEngine.js'
import { TargetCalculatorService } from '../TargetCalculatorService.js'
import { RegionRankingService } from '../RegionRankingService.js'
import type {
  IAnalyticsDataSource,
  AnalyticsSnapshotInfo,
} from '../../types/serviceInterfaces.js'
import type { DistrictStatistics } from '../../types/districts.js'
import type {
  Snapshot,
  AllDistrictsRankingsData,
  DistrictRanking,
} from '../../types/snapshots.js'
import type { PerDistrictSnapshotMetadata } from '../SnapshotStore.js'

/**
 * Mock IAnalyticsDataSource for testing
 */
class MockAnalyticsDataSource implements IAnalyticsDataSource {
  private districtData: Map<string, DistrictStatistics> = new Map()
  private rankingsData: AllDistrictsRankingsData | null = null
  private snapshots: AnalyticsSnapshotInfo[] = []

  setDistrictData(
    snapshotId: string,
    districtId: string,
    data: DistrictStatistics
  ): void {
    this.districtData.set(`${snapshotId}:${districtId}`, data)
  }

  setRankingsData(data: AllDistrictsRankingsData | null): void {
    this.rankingsData = data
  }

  setSnapshots(snapshots: AnalyticsSnapshotInfo[]): void {
    this.snapshots = snapshots
  }

  async getDistrictData(
    snapshotId: string,
    districtId: string
  ): Promise<DistrictStatistics | null> {
    return this.districtData.get(`${snapshotId}:${districtId}`) ?? null
  }

  async getSnapshotsInRange(
    _startDate?: string,
    _endDate?: string
  ): Promise<AnalyticsSnapshotInfo[]> {
    return this.snapshots
  }

  async getLatestSnapshot(): Promise<Snapshot | null> {
    if (this.snapshots.length === 0) return null
    const latest = this.snapshots[0]
    if (!latest) return null
    return {
      snapshot_id: latest.snapshotId,
      created_at: latest.createdAt,
      schema_version: '1.0.0',
      calculation_version: '1.0.0',
      status: latest.status,
      errors: [],
      payload: {
        districts: [],
        metadata: {
          source: 'test',
          fetchedAt: latest.createdAt,
          dataAsOfDate: latest.dataAsOfDate,
          districtCount: 0,
          processingDurationMs: 0,
        },
      },
    }
  }

  async getSnapshotMetadata(
    snapshotId: string
  ): Promise<PerDistrictSnapshotMetadata | null> {
    const snapshot = this.snapshots.find(s => s.snapshotId === snapshotId)
    if (!snapshot) return null
    return {
      snapshot_id: snapshotId,
      created_at: snapshot.createdAt,
      schema_version: '1.0.0',
      calculation_version: '1.0.0',
      status: snapshot.status,
      error_count: 0,
      district_count: 1,
      dataAsOfDate: snapshot.dataAsOfDate,
      rankingVersion: '1.0.0',
    }
  }

  async getAllDistrictsRankings(
    _snapshotId: string
  ): Promise<AllDistrictsRankingsData | null> {
    return this.rankingsData
  }
}

/**
 * Generator for valid district ranking data
 */
function districtRankingArb(
  districtId: string,
  region: string
): fc.Arbitrary<DistrictRanking> {
  return fc.record({
    districtId: fc.constant(districtId),
    districtName: fc.constant(`District ${districtId}`),
    region: fc.constant(region),
    paidClubs: fc.integer({ min: 10, max: 200 }),
    paidClubBase: fc.integer({ min: 10, max: 200 }),
    clubGrowthPercent: fc.float({ min: -10, max: 20 }),
    totalPayments: fc.integer({ min: 100, max: 5000 }),
    paymentBase: fc.integer({ min: 100, max: 5000 }),
    paymentGrowthPercent: fc.float({ min: -10, max: 20 }),
    activeClubs: fc.integer({ min: 10, max: 200 }),
    distinguishedClubs: fc.integer({ min: 0, max: 100 }),
    selectDistinguished: fc.integer({ min: 0, max: 50 }),
    presidentsDistinguished: fc.integer({ min: 0, max: 30 }),
    distinguishedPercent: fc.float({ min: 0, max: 100 }),
    clubsRank: fc.integer({ min: 1, max: 150 }),
    paymentsRank: fc.integer({ min: 1, max: 150 }),
    distinguishedRank: fc.integer({ min: 1, max: 150 }),
    aggregateScore: fc.integer({ min: 0, max: 450 }),
  })
}

/**
 * Generator for all districts rankings data
 */
function allDistrictsRankingsArb(
  targetDistrictId: string,
  targetRegion: string,
  totalDistricts: number
): fc.Arbitrary<AllDistrictsRankingsData> {
  const regions = ['Region 1', 'Region 2', 'Region 3', 'Region 4']

  return fc
    .tuple(
      districtRankingArb(targetDistrictId, targetRegion),
      fc.array(
        fc
          .tuple(fc.integer({ min: 1, max: 999 }), fc.constantFrom(...regions))
          .chain(([id, region]) => districtRankingArb(`D${id}`, region)),
        { minLength: totalDistricts - 1, maxLength: totalDistricts - 1 }
      )
    )
    .map(([targetRanking, otherRankings]) => ({
      metadata: {
        snapshotId: '2026-01-14',
        calculatedAt: '2026-01-14T12:00:00Z',
        schemaVersion: '1.0.0',
        calculationVersion: '1.0.0',
        rankingVersion: '1.0.0',
        sourceCsvDate: '2026-01-14',
        csvFetchedAt: '2026-01-14T12:00:00Z',
        totalDistricts: totalDistricts,
        fromCache: false,
      },
      rankings: [targetRanking, ...otherRankings],
    }))
}

/**
 * Create minimal district statistics for testing
 */
function createMinimalDistrictStats(
  districtId: string,
  date: string
): DistrictStatistics {
  return {
    districtId,
    asOfDate: date,
    membership: {
      total: 1000,
      change: 10,
      changePercent: 1,
      byClub: [],
    },
    clubs: {
      total: 50,
      active: 45,
      suspended: 3,
      ineligible: 2,
      low: 5,
      distinguished: 20,
    },
    education: {
      totalAwards: 100,
      byType: [],
      topClubs: [],
    },
    clubPerformance: [
      {
        'Club Number': '1234',
        'Club Name': 'Test Club',
        Division: 'A',
        Area: '1',
        'Active Members': '25',
        'Goals Met': '5',
        'Club Distinguished Status': 'Distinguished',
      },
    ],
    divisionPerformance: [],
    districtPerformance: [],
  }
}

describe('AnalyticsEngine Performance Targets - Property Tests', () => {
  let mockDataSource: MockAnalyticsDataSource
  let analyticsEngine: AnalyticsEngine
  let targetCalculator: TargetCalculatorService
  let regionRankingService: RegionRankingService

  beforeEach(() => {
    mockDataSource = new MockAnalyticsDataSource()
    targetCalculator = new TargetCalculatorService()
    regionRankingService = new RegionRankingService()
    analyticsEngine = new AnalyticsEngine(
      mockDataSource,
      targetCalculator,
      regionRankingService
    )
  })

  afterEach(async () => {
    await analyticsEngine.dispose()
  })

  /**
   * Property 6: API Response Completeness
   *
   * For any district analytics request, the response SHALL include:
   * - Target calculations for all three metrics (or null if base unavailable)
   * - World rank, region rank, and world percentile for each metric
   * - Base values used for calculations
   *
   * **Validates: Requirements 7.1, 7.2, 7.3, 7.4**
   */
  describe('Property 6: API Response Completeness', () => {
    it('response includes all required performance target fields when data is available', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 10, max: 100 }), // totalDistricts
          fc.constantFrom('Region 1', 'Region 2', 'Region 3'), // region
          async (totalDistricts, region) => {
            const districtId = 'D101'
            const snapshotId = '2026-01-14'

            // Set up mock data
            const districtStats = createMinimalDistrictStats(
              districtId,
              snapshotId
            )
            mockDataSource.setDistrictData(
              snapshotId,
              districtId,
              districtStats
            )
            mockDataSource.setSnapshots([
              {
                snapshotId,
                status: 'success',
                createdAt: '2026-01-14T12:00:00Z',
                dataAsOfDate: snapshotId,
              },
            ])

            // Generate rankings data
            const rankingsData = await fc.sample(
              allDistrictsRankingsArb(districtId, region, totalDistricts),
              1
            )[0]
            if (!rankingsData) return true
            mockDataSource.setRankingsData(rankingsData)

            // Generate analytics
            const analytics =
              await analyticsEngine.generateDistrictAnalytics(districtId)

            // Property: performanceTargets should be present
            expect(analytics.performanceTargets).toBeDefined()
            const targets = analytics.performanceTargets!

            // Property: All three metrics should be present
            expect(targets.paidClubs).toBeDefined()
            expect(targets.membershipPayments).toBeDefined()
            expect(targets.distinguishedClubs).toBeDefined()

            // Property: Each metric should have required fields
            for (const metric of [
              targets.paidClubs,
              targets.membershipPayments,
              targets.distinguishedClubs,
            ]) {
              expect(typeof metric.current).toBe('number')
              expect(metric.rankings).toBeDefined()
              expect(typeof metric.rankings.totalDistricts).toBe('number')
              expect(metric.rankings.totalDistricts).toBe(totalDistricts)
            }

            // Property: Rankings should include world rank, region rank, and percentile
            for (const metric of [
              targets.paidClubs,
              targets.membershipPayments,
              targets.distinguishedClubs,
            ]) {
              expect(metric.rankings.worldRank).not.toBeUndefined()
              expect(metric.rankings.regionRank).not.toBeUndefined()
              expect(metric.rankings.worldPercentile).not.toBeUndefined()
              expect(metric.rankings.region).toBe(region)
            }

            return true
          }
        ),
        { numRuns: 50 }
      )
    })

    it('base values are included when available', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 10, max: 200 }), // paidClubBase
          fc.integer({ min: 100, max: 5000 }), // paymentBase
          async (paidClubBase, paymentBase) => {
            const districtId = 'D102'
            const snapshotId = '2026-01-14'
            const region = 'Region 1'

            // Set up mock data
            const districtStats = createMinimalDistrictStats(
              districtId,
              snapshotId
            )
            mockDataSource.setDistrictData(
              snapshotId,
              districtId,
              districtStats
            )
            mockDataSource.setSnapshots([
              {
                snapshotId,
                status: 'success',
                createdAt: '2026-01-14T12:00:00Z',
                dataAsOfDate: snapshotId,
              },
            ])

            // Create rankings with specific base values
            const rankingsData: AllDistrictsRankingsData = {
              metadata: {
                snapshotId,
                calculatedAt: '2026-01-14T12:00:00Z',
                schemaVersion: '1.0.0',
                calculationVersion: '1.0.0',
                rankingVersion: '1.0.0',
                sourceCsvDate: snapshotId,
                csvFetchedAt: '2026-01-14T12:00:00Z',
                totalDistricts: 1,
                fromCache: false,
              },
              rankings: [
                {
                  districtId,
                  districtName: `District ${districtId}`,
                  region,
                  paidClubs: paidClubBase + 5,
                  paidClubBase,
                  clubGrowthPercent: 5,
                  totalPayments: paymentBase + 50,
                  paymentBase,
                  paymentGrowthPercent: 5,
                  activeClubs: paidClubBase,
                  distinguishedClubs: 20,
                  selectDistinguished: 10,
                  presidentsDistinguished: 5,
                  distinguishedPercent: 40,
                  clubsRank: 1,
                  paymentsRank: 1,
                  distinguishedRank: 1,
                  aggregateScore: 300,
                },
              ],
            }
            mockDataSource.setRankingsData(rankingsData)

            // Generate analytics
            const analytics =
              await analyticsEngine.generateDistrictAnalytics(districtId)

            // Property: Base values should match input
            expect(analytics.performanceTargets).toBeDefined()
            expect(analytics.performanceTargets!.paidClubs.base).toBe(
              paidClubBase
            )
            expect(analytics.performanceTargets!.membershipPayments.base).toBe(
              paymentBase
            )
            // Distinguished clubs uses paidClubBase
            expect(analytics.performanceTargets!.distinguishedClubs.base).toBe(
              paidClubBase
            )

            return true
          }
        ),
        { numRuns: 50 }
      )
    })
  })

  /**
   * Property 7: Missing Data Graceful Handling
   *
   * For any district where base values are zero, missing, or invalid:
   * - Targets SHALL be null and display "N/A"
   * - Rankings SHALL display "—" if unavailable
   * - Region rank SHALL be omitted if region is unknown
   * - Tooltips SHALL explain data unavailability
   *
   * **Validates: Requirements 8.1, 8.2, 8.3, 8.4**
   */
  describe('Property 7: Missing Data Graceful Handling', () => {
    it('returns null performanceTargets when rankings data is unavailable', async () => {
      const districtId = 'D103'
      const snapshotId = '2026-01-14'

      // Set up mock data without rankings
      const districtStats = createMinimalDistrictStats(districtId, snapshotId)
      mockDataSource.setDistrictData(snapshotId, districtId, districtStats)
      mockDataSource.setSnapshots([
        {
          snapshotId,
          status: 'success',
          createdAt: '2026-01-14T12:00:00Z',
          dataAsOfDate: snapshotId,
        },
      ])
      mockDataSource.setRankingsData(null) // No rankings data

      // Generate analytics
      const analytics =
        await analyticsEngine.generateDistrictAnalytics(districtId)

      // Property: performanceTargets should be undefined when rankings unavailable
      expect(analytics.performanceTargets).toBeUndefined()
    })

    it('returns null performanceTargets when district not found in rankings', async () => {
      const districtId = 'D104'
      const snapshotId = '2026-01-14'

      // Set up mock data
      const districtStats = createMinimalDistrictStats(districtId, snapshotId)
      mockDataSource.setDistrictData(snapshotId, districtId, districtStats)
      mockDataSource.setSnapshots([
        {
          snapshotId,
          status: 'success',
          createdAt: '2026-01-14T12:00:00Z',
          dataAsOfDate: snapshotId,
        },
      ])

      // Rankings data without the target district
      const rankingsData: AllDistrictsRankingsData = {
        metadata: {
          snapshotId,
          calculatedAt: '2026-01-14T12:00:00Z',
          schemaVersion: '1.0.0',
          calculationVersion: '1.0.0',
          rankingVersion: '1.0.0',
          sourceCsvDate: snapshotId,
          csvFetchedAt: '2026-01-14T12:00:00Z',
          totalDistricts: 1,
          fromCache: false,
        },
        rankings: [
          {
            districtId: 'OTHER_DISTRICT',
            districtName: 'Other District',
            region: 'Region 1',
            paidClubs: 50,
            paidClubBase: 48,
            clubGrowthPercent: 4,
            totalPayments: 1000,
            paymentBase: 950,
            paymentGrowthPercent: 5,
            activeClubs: 50,
            distinguishedClubs: 20,
            selectDistinguished: 10,
            presidentsDistinguished: 5,
            distinguishedPercent: 40,
            clubsRank: 1,
            paymentsRank: 1,
            distinguishedRank: 1,
            aggregateScore: 300,
          },
        ],
      }
      mockDataSource.setRankingsData(rankingsData)

      // Generate analytics
      const analytics =
        await analyticsEngine.generateDistrictAnalytics(districtId)

      // Property: performanceTargets should be undefined when district not in rankings
      expect(analytics.performanceTargets).toBeUndefined()
    })

    it('targets are null when base values are zero or invalid', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(0, -1, -100), // invalid base values
          async invalidBase => {
            const districtId = 'D105'
            const snapshotId = '2026-01-14'

            // Set up mock data
            const districtStats = createMinimalDistrictStats(
              districtId,
              snapshotId
            )
            mockDataSource.setDistrictData(
              snapshotId,
              districtId,
              districtStats
            )
            mockDataSource.setSnapshots([
              {
                snapshotId,
                status: 'success',
                createdAt: '2026-01-14T12:00:00Z',
                dataAsOfDate: snapshotId,
              },
            ])

            // Rankings with invalid base values
            const rankingsData: AllDistrictsRankingsData = {
              metadata: {
                snapshotId,
                calculatedAt: '2026-01-14T12:00:00Z',
                schemaVersion: '1.0.0',
                calculationVersion: '1.0.0',
                rankingVersion: '1.0.0',
                sourceCsvDate: snapshotId,
                csvFetchedAt: '2026-01-14T12:00:00Z',
                totalDistricts: 1,
                fromCache: false,
              },
              rankings: [
                {
                  districtId,
                  districtName: `District ${districtId}`,
                  region: 'Region 1',
                  paidClubs: 50,
                  paidClubBase: invalidBase,
                  clubGrowthPercent: 0,
                  totalPayments: 1000,
                  paymentBase: invalidBase,
                  paymentGrowthPercent: 0,
                  activeClubs: 50,
                  distinguishedClubs: 20,
                  selectDistinguished: 10,
                  presidentsDistinguished: 5,
                  distinguishedPercent: 40,
                  clubsRank: 1,
                  paymentsRank: 1,
                  distinguishedRank: 1,
                  aggregateScore: 300,
                },
              ],
            }
            mockDataSource.setRankingsData(rankingsData)

            // Generate analytics
            const analytics =
              await analyticsEngine.generateDistrictAnalytics(districtId)

            // Property: performanceTargets should exist but targets should be null
            expect(analytics.performanceTargets).toBeDefined()
            expect(analytics.performanceTargets!.paidClubs.base).toBeNull()
            expect(analytics.performanceTargets!.paidClubs.targets).toBeNull()
            expect(
              analytics.performanceTargets!.membershipPayments.base
            ).toBeNull()
            expect(
              analytics.performanceTargets!.membershipPayments.targets
            ).toBeNull()
            expect(
              analytics.performanceTargets!.distinguishedClubs.base
            ).toBeNull()
            expect(
              analytics.performanceTargets!.distinguishedClubs.targets
            ).toBeNull()

            return true
          }
        ),
        { numRuns: 10 }
      )
    })

    it('region rank is null when region is empty or missing', async () => {
      const districtId = 'D106'
      const snapshotId = '2026-01-14'

      // Set up mock data
      const districtStats = createMinimalDistrictStats(districtId, snapshotId)
      mockDataSource.setDistrictData(snapshotId, districtId, districtStats)
      mockDataSource.setSnapshots([
        {
          snapshotId,
          status: 'success',
          createdAt: '2026-01-14T12:00:00Z',
          dataAsOfDate: snapshotId,
        },
      ])

      // Rankings with empty region
      const rankingsData: AllDistrictsRankingsData = {
        metadata: {
          snapshotId,
          calculatedAt: '2026-01-14T12:00:00Z',
          schemaVersion: '1.0.0',
          calculationVersion: '1.0.0',
          rankingVersion: '1.0.0',
          sourceCsvDate: snapshotId,
          csvFetchedAt: '2026-01-14T12:00:00Z',
          totalDistricts: 1,
          fromCache: false,
        },
        rankings: [
          {
            districtId,
            districtName: `District ${districtId}`,
            region: '', // Empty region
            paidClubs: 50,
            paidClubBase: 48,
            clubGrowthPercent: 4,
            totalPayments: 1000,
            paymentBase: 950,
            paymentGrowthPercent: 5,
            activeClubs: 50,
            distinguishedClubs: 20,
            selectDistinguished: 10,
            presidentsDistinguished: 5,
            distinguishedPercent: 40,
            clubsRank: 1,
            paymentsRank: 1,
            distinguishedRank: 1,
            aggregateScore: 300,
          },
        ],
      }
      mockDataSource.setRankingsData(rankingsData)

      // Generate analytics
      const analytics =
        await analyticsEngine.generateDistrictAnalytics(districtId)

      // Property: Region rank should be null when region is empty
      expect(analytics.performanceTargets).toBeDefined()
      expect(
        analytics.performanceTargets!.paidClubs.rankings.regionRank
      ).toBeNull()
      expect(
        analytics.performanceTargets!.membershipPayments.rankings.regionRank
      ).toBeNull()
      expect(
        analytics.performanceTargets!.distinguishedClubs.rankings.regionRank
      ).toBeNull()
    })
  })
})
