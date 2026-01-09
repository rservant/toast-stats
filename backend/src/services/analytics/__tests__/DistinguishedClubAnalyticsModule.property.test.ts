/**
 * Property-Based Tests for DistinguishedClubAnalyticsModule
 *
 * Feature: analytics-engine-refactor
 * Property 1: Output Equivalence (Distinguished)
 *
 * Validates: Requirements 2.3, 5.4
 *
 * This test verifies that the extracted DistinguishedClubAnalyticsModule produces
 * results identical to the original AnalyticsEngine implementation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import fs from 'fs/promises'
import path from 'path'
import { DistinguishedClubAnalyticsModule } from '../DistinguishedClubAnalyticsModule.js'
import { AnalyticsEngine } from '../../AnalyticsEngine.js'
import type {
  IAnalyticsDataSource,
  AnalyticsSnapshotInfo,
} from '../../../types/serviceInterfaces.js'
import type { DistrictStatistics } from '../../../types/districts.js'
import type { Snapshot } from '../../../types/snapshots.js'

describe('DistinguishedClubAnalyticsModule - Property-Based Tests', () => {
  let testCacheDir: string

  beforeEach(async () => {
    // Create a unique test cache directory
    testCacheDir = path.join(
      process.cwd(),
      'test-cache',
      `distinguished-analytics-pbt-${Date.now()}-${Math.random().toString(36).substring(7)}`
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

  // Generator for club performance records with distinguished club data
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
        'Level 1s': fc.integer({ min: 0, max: 10 }).map(String),
        'Level 2s': fc.integer({ min: 0, max: 6 }).map(String),
        'Add. Level 2s': fc.integer({ min: 0, max: 4 }).map(String),
        'Level 3s': fc.integer({ min: 0, max: 4 }).map(String),
        'Level 4s, Path Completions, or DTM Awards': fc
          .integer({ min: 0, max: 3 })
          .map(String),
        'Add. Level 4s, Path Completions, or DTM award': fc
          .integer({ min: 0, max: 2 })
          .map(String),
        'New Members': fc.integer({ min: 0, max: 15 }).map(String),
        'Add. New Members': fc.integer({ min: 0, max: 10 }).map(String),
        'Off. Trained Round 1': fc.integer({ min: 0, max: 7 }).map(String),
        'Off. Trained Round 2': fc.integer({ min: 0, max: 7 }).map(String),
        'Mem. dues on time Oct': fc.integer({ min: 0, max: 1 }).map(String),
        'Mem. dues on time Apr': fc.integer({ min: 0, max: 1 }).map(String),
        'Off. List On Time': fc.integer({ min: 0, max: 1 }).map(String),
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
   * the original AnalyticsEngine and the extracted DistinguishedClubAnalyticsModule
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
   * Property 1: Output Equivalence (Distinguished)
   *
   * For any valid district ID and date range, calling generateDistinguishedClubAnalytics
   * on the extracted DistinguishedClubAnalyticsModule SHALL produce results identical
   * to the original AnalyticsEngine implementation.
   *
   * **Validates: Requirements 2.3, 5.4**
   */
  it('Property 1: Output Equivalence - generateDistinguishedClubAnalytics should produce identical results', async () => {
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
          const distinguishedModule = new DistinguishedClubAnalyticsModule(
            mockDataSource
          )

          // Call generateDistinguishedClubAnalytics on both
          const startDate = sortedDates[0]
          const endDate = sortedDates[sortedDates.length - 1]

          const originalResult =
            await originalEngine.generateDistinguishedClubAnalytics(
              districtId,
              startDate,
              endDate
            )

          const moduleResult =
            await distinguishedModule.generateDistinguishedClubAnalytics(
              districtId,
              startDate,
              endDate
            )

          // Verify output equivalence for distinguishedClubs
          expect(moduleResult.distinguishedClubs.smedley).toBe(
            originalResult.distinguishedClubs.smedley
          )
          expect(moduleResult.distinguishedClubs.presidents).toBe(
            originalResult.distinguishedClubs.presidents
          )
          expect(moduleResult.distinguishedClubs.select).toBe(
            originalResult.distinguishedClubs.select
          )
          expect(moduleResult.distinguishedClubs.distinguished).toBe(
            originalResult.distinguishedClubs.distinguished
          )
          expect(moduleResult.distinguishedClubs.total).toBe(
            originalResult.distinguishedClubs.total
          )

          // Verify output equivalence for distinguishedProjection
          expect(moduleResult.distinguishedProjection.smedley).toBe(
            originalResult.distinguishedProjection.smedley
          )
          expect(moduleResult.distinguishedProjection.presidents).toBe(
            originalResult.distinguishedProjection.presidents
          )
          expect(moduleResult.distinguishedProjection.select).toBe(
            originalResult.distinguishedProjection.select
          )
          expect(moduleResult.distinguishedProjection.distinguished).toBe(
            originalResult.distinguishedProjection.distinguished
          )
          expect(moduleResult.distinguishedProjection.total).toBe(
            originalResult.distinguishedProjection.total
          )

          // Verify output equivalence for achievements
          expect(moduleResult.achievements.length).toBe(
            originalResult.achievements.length
          )
          for (let i = 0; i < moduleResult.achievements.length; i++) {
            expect(moduleResult.achievements[i]?.clubId).toBe(
              originalResult.achievements[i]?.clubId
            )
            expect(moduleResult.achievements[i]?.level).toBe(
              originalResult.achievements[i]?.level
            )
            expect(moduleResult.achievements[i]?.achievedDate).toBe(
              originalResult.achievements[i]?.achievedDate
            )
          }

          // Verify output equivalence for dcpGoalAnalysis
          expect(moduleResult.dcpGoalAnalysis.mostCommonlyAchieved.length).toBe(
            originalResult.dcpGoalAnalysis.mostCommonlyAchieved.length
          )
          expect(
            moduleResult.dcpGoalAnalysis.leastCommonlyAchieved.length
          ).toBe(originalResult.dcpGoalAnalysis.leastCommonlyAchieved.length)

          // Compare most commonly achieved goals
          for (
            let i = 0;
            i < moduleResult.dcpGoalAnalysis.mostCommonlyAchieved.length;
            i++
          ) {
            expect(
              moduleResult.dcpGoalAnalysis.mostCommonlyAchieved[i]?.goalNumber
            ).toBe(
              originalResult.dcpGoalAnalysis.mostCommonlyAchieved[i]?.goalNumber
            )
            expect(
              moduleResult.dcpGoalAnalysis.mostCommonlyAchieved[i]
                ?.achievementCount
            ).toBe(
              originalResult.dcpGoalAnalysis.mostCommonlyAchieved[i]
                ?.achievementCount
            )
          }

          // Compare least commonly achieved goals
          for (
            let i = 0;
            i < moduleResult.dcpGoalAnalysis.leastCommonlyAchieved.length;
            i++
          ) {
            expect(
              moduleResult.dcpGoalAnalysis.leastCommonlyAchieved[i]?.goalNumber
            ).toBe(
              originalResult.dcpGoalAnalysis.leastCommonlyAchieved[i]
                ?.goalNumber
            )
            expect(
              moduleResult.dcpGoalAnalysis.leastCommonlyAchieved[i]
                ?.achievementCount
            ).toBe(
              originalResult.dcpGoalAnalysis.leastCommonlyAchieved[i]
                ?.achievementCount
            )
          }

          // Verify yearOverYearComparison presence and values
          if (originalResult.yearOverYearComparison) {
            expect(moduleResult.yearOverYearComparison).toBeDefined()
            expect(moduleResult.yearOverYearComparison?.currentTotal).toBe(
              originalResult.yearOverYearComparison.currentTotal
            )
            expect(moduleResult.yearOverYearComparison?.previousTotal).toBe(
              originalResult.yearOverYearComparison.previousTotal
            )
            expect(moduleResult.yearOverYearComparison?.change).toBe(
              originalResult.yearOverYearComparison.change
            )
            expect(moduleResult.yearOverYearComparison?.percentageChange).toBe(
              originalResult.yearOverYearComparison.percentageChange
            )
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
