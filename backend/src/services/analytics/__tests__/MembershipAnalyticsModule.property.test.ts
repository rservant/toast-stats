/**
 * Property-Based Tests for MembershipAnalyticsModule
 *
 * Feature: analytics-engine-refactor
 * Property 1: Output Equivalence (Membership)
 *
 * Validates: Requirements 2.3, 5.4
 *
 * This test verifies that the extracted MembershipAnalyticsModule produces
 * results identical to the original AnalyticsEngine implementation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import fs from 'fs/promises'
import path from 'path'
import { MembershipAnalyticsModule } from '../MembershipAnalyticsModule.js'
import { AnalyticsEngine } from '../../AnalyticsEngine.js'
import type {
  IAnalyticsDataSource,
  AnalyticsSnapshotInfo,
} from '../../../types/serviceInterfaces.js'
import type { DistrictStatistics } from '../../../types/districts.js'
import type { Snapshot } from '../../../types/snapshots.js'

describe('MembershipAnalyticsModule - Property-Based Tests', () => {
  let testCacheDir: string

  beforeEach(async () => {
    // Create a unique test cache directory
    testCacheDir = path.join(
      process.cwd(),
      'test-cache',
      `membership-analytics-pbt-${Date.now()}-${Math.random().toString(36).substring(7)}`
    )
    await fs.mkdir(testCacheDir, { recursive: true })
  })

  afterEach(async () => {
    // Clean up test cache directory
    try {
      await fs.rm(testCacheDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  // Generator for valid district IDs
  const generateValidDistrictId = (): fc.Arbitrary<string> =>
    fc.oneof(
      fc.integer({ min: 1, max: 999 }).map(n => n.toString()),
      fc.constantFrom('A', 'B', 'C', 'D', 'E', 'F')
    )

  // Generator for valid dates in YYYY-MM-DD format
  const generateValidDate = (): fc.Arbitrary<string> =>
    fc
      .tuple(
        fc.integer({ min: 2020, max: 2025 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 28 })
      )
      .map(
        ([year, month, day]) =>
          `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      )

  // Generator for club performance records
  const generateClubPerformance = (): fc.Arbitrary<
    Record<string, string | number | null>[]
  > =>
    fc.array(
      fc.record({
        'Club Number': fc.integer({ min: 1000, max: 9999 }).map(String),
        'Club Name': fc
          .string({ minLength: 3, maxLength: 30 })
          .map(s => s.replace(/[^a-zA-Z0-9 ]/g, 'X')),
        Division: fc.constantFrom('A', 'B', 'C', 'D', 'E'),
        Area: fc.integer({ min: 1, max: 9 }).map(String),
        'Active Members': fc.integer({ min: 5, max: 50 }).map(String),
        'Goals Met': fc.integer({ min: 0, max: 10 }).map(String),
        'Mem. Base': fc.integer({ min: 5, max: 40 }).map(String),
      }),
      { minLength: 3, maxLength: 15 }
    )

  // Generator for district statistics
  const generateDistrictStatistics = (
    districtId: string,
    date: string
  ): fc.Arbitrary<DistrictStatistics> =>
    generateClubPerformance().map(clubPerformance => ({
      districtId,
      asOfDate: date,
      membership: {
        total: clubPerformance.reduce(
          (sum, club) =>
            sum + parseInt(String(club['Active Members'] || '0'), 10),
          0
        ),
        change: 0,
        changePercent: 0,
        byClub: [],
      },
      clubs: {
        total: clubPerformance.length,
        active: clubPerformance.length,
        suspended: 0,
        ineligible: 0,
        low: 0,
        distinguished: 0,
      },
      education: {
        totalAwards: 0,
        byType: [],
        topClubs: [],
      },
      clubPerformance,
      divisionPerformance: [],
      districtPerformance: [],
    }))

  /**
   * Create a mock data source that returns consistent data for both
   * the original AnalyticsEngine and the extracted MembershipAnalyticsModule
   */
  const createMockDataSource = (
    districtData: Map<string, DistrictStatistics>,
    snapshotDates: string[]
  ): IAnalyticsDataSource => ({
    async getDistrictData(
      snapshotId: string,
      districtId: string
    ): Promise<DistrictStatistics | null> {
      const key = `${snapshotId}-${districtId}`
      return districtData.get(key) || null
    },
    async getSnapshotsInRange(
      startDate?: string,
      endDate?: string
    ): Promise<AnalyticsSnapshotInfo[]> {
      return snapshotDates
        .filter(date => {
          if (startDate && date < startDate) return false
          if (endDate && date > endDate) return false
          return true
        })
        .map(date => ({
          snapshotId: date,
          status: 'success' as const,
          createdAt: new Date(date).toISOString(),
          dataAsOfDate: date,
        }))
    },
    async getLatestSnapshot(): Promise<Snapshot | null> {
      if (snapshotDates.length === 0) return null
      const latestDate = snapshotDates.sort().reverse()[0]!
      return {
        snapshot_id: latestDate,
        created_at: new Date(latestDate).toISOString(),
        schema_version: '1.0.0',
        calculation_version: '1.0.0',
        status: 'success',
        errors: [],
        payload: {
          districts: [],
          metadata: {
            source: 'test',
            fetchedAt: new Date(latestDate).toISOString(),
            dataAsOfDate: latestDate,
            districtCount: 1,
            processingDurationMs: 0,
          },
        },
      }
    },
    async getSnapshotMetadata() {
      return null
    },
  })

  /**
   * Property 1: Output Equivalence (Membership)
   *
   * For any valid district ID and date range, calling generateMembershipAnalytics
   * on the extracted MembershipAnalyticsModule SHALL produce results identical
   * to the original AnalyticsEngine implementation.
   *
   * **Validates: Requirements 2.3, 5.4**
   */
  it('Property 1: Output Equivalence - generateMembershipAnalytics should produce identical results', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateValidDistrictId(),
        fc.array(generateValidDate(), { minLength: 1, maxLength: 5 }),
        async (districtId: string, dates: string[]) => {
          // Sort dates to ensure consistent ordering
          const sortedDates = [...new Set(dates)].sort()

          // Generate district data for each date
          const districtData = new Map<string, DistrictStatistics>()

          for (const date of sortedDates) {
            const stats = fc.sample(
              generateDistrictStatistics(districtId, date),
              1
            )[0]!
            districtData.set(`${date}-${districtId}`, stats)
          }

          // Create mock data source
          const mockDataSource = createMockDataSource(districtData, sortedDates)

          // Create both the original AnalyticsEngine and the extracted module
          const originalEngine = new AnalyticsEngine(mockDataSource)
          const membershipModule = new MembershipAnalyticsModule(mockDataSource)

          // Call generateMembershipAnalytics on both
          const startDate = sortedDates[0]
          const endDate = sortedDates[sortedDates.length - 1]

          const originalResult =
            await originalEngine.generateMembershipAnalytics(
              districtId,
              startDate,
              endDate
            )

          const moduleResult =
            await membershipModule.generateMembershipAnalytics(
              districtId,
              startDate,
              endDate
            )

          // Verify output equivalence
          // Compare totalMembership
          expect(moduleResult.totalMembership).toBe(
            originalResult.totalMembership
          )

          // Compare membershipChange
          expect(moduleResult.membershipChange).toBe(
            originalResult.membershipChange
          )

          // Compare programYearChange
          expect(moduleResult.programYearChange).toBe(
            originalResult.programYearChange
          )

          // Compare membershipTrend length and values
          expect(moduleResult.membershipTrend.length).toBe(
            originalResult.membershipTrend.length
          )
          for (let i = 0; i < moduleResult.membershipTrend.length; i++) {
            expect(moduleResult.membershipTrend[i]?.date).toBe(
              originalResult.membershipTrend[i]?.date
            )
            expect(moduleResult.membershipTrend[i]?.count).toBe(
              originalResult.membershipTrend[i]?.count
            )
          }

          // Compare topGrowthClubs length
          expect(moduleResult.topGrowthClubs.length).toBe(
            originalResult.topGrowthClubs.length
          )

          // Compare topDecliningClubs length
          expect(moduleResult.topDecliningClubs.length).toBe(
            originalResult.topDecliningClubs.length
          )

          // Compare seasonalPatterns length
          expect(moduleResult.seasonalPatterns.length).toBe(
            originalResult.seasonalPatterns.length
          )

          // Compare yearOverYearComparison presence
          if (originalResult.yearOverYearComparison) {
            expect(moduleResult.yearOverYearComparison).toBeDefined()
            expect(moduleResult.yearOverYearComparison?.currentMembership).toBe(
              originalResult.yearOverYearComparison.currentMembership
            )
            expect(
              moduleResult.yearOverYearComparison?.previousMembership
            ).toBe(originalResult.yearOverYearComparison.previousMembership)
          } else {
            expect(moduleResult.yearOverYearComparison).toBeUndefined()
          }

          return true
        }
      ),
      { numRuns: 100 }
    )
  }, 60000) // 60 second timeout for property test
})
