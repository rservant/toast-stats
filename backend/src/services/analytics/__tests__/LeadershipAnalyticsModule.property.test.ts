/**
 * Property-Based Tests for LeadershipAnalyticsModule
 *
 * Feature: analytics-engine-refactor
 * Property 1: Output Equivalence (Leadership)
 *
 * Validates: Requirements 2.3, 5.4
 *
 * This test verifies that the extracted LeadershipAnalyticsModule produces
 * results identical to the original AnalyticsEngine implementation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import fs from 'fs/promises'
import path from 'path'
import { LeadershipAnalyticsModule } from '../LeadershipAnalyticsModule.js'
import { AnalyticsEngine } from '../../AnalyticsEngine.js'
import type {
  IAnalyticsDataSource,
  AnalyticsSnapshotInfo,
} from '../../../types/serviceInterfaces.js'
import type { DistrictStatistics } from '../../../types/districts.js'
import type { Snapshot } from '../../../types/snapshots.js'

describe('LeadershipAnalyticsModule - Property-Based Tests', () => {
  let testCacheDir: string

  beforeEach(async () => {
    // Create a unique test cache directory
    testCacheDir = path.join(
      process.cwd(),
      'test-cache',
      `leadership-analytics-pbt-${Date.now()}-${Math.random().toString(36).substring(7)}`
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

  // Generator for club performance records with division/area data
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
        'Division Name': fc.constantFrom(
          'Division A',
          'Division B',
          'Division C',
          'Division D',
          'Division E'
        ),
        Area: fc.integer({ min: 1, max: 9 }).map(String),
        'Area Name': fc.integer({ min: 1, max: 9 }).map(n => `Area ${n}`),
        'Active Members': fc.integer({ min: 5, max: 50 }).map(String),
        'Goals Met': fc.integer({ min: 0, max: 10 }).map(String),
        'Mem. Base': fc.integer({ min: 5, max: 40 }).map(String),
      }),
      { minLength: 5, maxLength: 20 }
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
   * the original AnalyticsEngine and the extracted LeadershipAnalyticsModule
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
   * Property 1: Output Equivalence (Leadership) - generateLeadershipInsights
   *
   * For any valid district ID and date range, calling generateLeadershipInsights on the extracted
   * LeadershipAnalyticsModule SHALL produce results identical to the original
   * AnalyticsEngine implementation.
   *
   * **Validates: Requirements 2.3, 5.4**
   */
  it('Property 1: Output Equivalence - generateLeadershipInsights should produce identical results', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateValidDistrictId(),
        generateValidDate(),
        async (districtId: string, date: string) => {
          // Generate district data for the date
          const districtData = new Map<string, DistrictStatistics>()
          const stats = fc.sample(
            generateDistrictStatistics(districtId, date),
            1
          )[0]!
          districtData.set(`${date}-${districtId}`, stats)

          // Create mock data source
          const mockDataSource = createMockDataSource(districtData, [date])

          // Create both the original AnalyticsEngine and the extracted module
          const originalEngine = new AnalyticsEngine(mockDataSource)
          const leadershipModule = new LeadershipAnalyticsModule(mockDataSource)

          // Call generateLeadershipInsights on both
          const originalResult =
            await originalEngine.generateLeadershipInsights(districtId)
          const moduleResult =
            await leadershipModule.generateLeadershipInsights(districtId)

          // Verify output equivalence for leadershipScores
          expect(moduleResult.leadershipScores.length).toBe(
            originalResult.leadershipScores.length
          )

          // Sort both results by divisionId for consistent comparison
          const sortedOriginalScores = [
            ...originalResult.leadershipScores,
          ].sort((a, b) => a.divisionId.localeCompare(b.divisionId))
          const sortedModuleScores = [...moduleResult.leadershipScores].sort(
            (a, b) => a.divisionId.localeCompare(b.divisionId)
          )

          // Compare each leadership score's properties
          for (let i = 0; i < sortedModuleScores.length; i++) {
            const moduleScore = sortedModuleScores[i]!
            const originalScore = sortedOriginalScores[i]!

            expect(moduleScore.divisionId).toBe(originalScore.divisionId)
            expect(moduleScore.divisionName).toBe(originalScore.divisionName)
            expect(moduleScore.healthScore).toBe(originalScore.healthScore)
            expect(moduleScore.growthScore).toBe(originalScore.growthScore)
            expect(moduleScore.dcpScore).toBe(originalScore.dcpScore)
            expect(moduleScore.overallScore).toBe(originalScore.overallScore)
            expect(moduleScore.rank).toBe(originalScore.rank)
            expect(moduleScore.isBestPractice).toBe(
              originalScore.isBestPractice
            )
          }

          // Verify bestPracticeDivisions equivalence
          expect(moduleResult.bestPracticeDivisions.length).toBe(
            originalResult.bestPracticeDivisions.length
          )

          // Verify leadershipChanges equivalence
          expect(moduleResult.leadershipChanges.length).toBe(
            originalResult.leadershipChanges.length
          )

          // Verify areaDirectorCorrelations equivalence
          expect(moduleResult.areaDirectorCorrelations.length).toBe(
            originalResult.areaDirectorCorrelations.length
          )

          // Sort correlations by areaId for consistent comparison
          const sortedOriginalCorrelations = [
            ...originalResult.areaDirectorCorrelations,
          ].sort((a, b) => a.areaId.localeCompare(b.areaId))
          const sortedModuleCorrelations = [
            ...moduleResult.areaDirectorCorrelations,
          ].sort((a, b) => a.areaId.localeCompare(b.areaId))

          for (let i = 0; i < sortedModuleCorrelations.length; i++) {
            const moduleCorrelation = sortedModuleCorrelations[i]!
            const originalCorrelation = sortedOriginalCorrelations[i]!

            expect(moduleCorrelation.areaId).toBe(originalCorrelation.areaId)
            expect(moduleCorrelation.areaName).toBe(
              originalCorrelation.areaName
            )
            expect(moduleCorrelation.divisionId).toBe(
              originalCorrelation.divisionId
            )
            expect(moduleCorrelation.clubPerformanceScore).toBe(
              originalCorrelation.clubPerformanceScore
            )
            expect(moduleCorrelation.activityIndicator).toBe(
              originalCorrelation.activityIndicator
            )
            expect(moduleCorrelation.correlation).toBe(
              originalCorrelation.correlation
            )
          }

          // Verify summary equivalence
          expect(moduleResult.summary.averageLeadershipScore).toBe(
            originalResult.summary.averageLeadershipScore
          )
          expect(moduleResult.summary.totalBestPracticeDivisions).toBe(
            originalResult.summary.totalBestPracticeDivisions
          )
          expect(moduleResult.summary.topPerformingDivisions.length).toBe(
            originalResult.summary.topPerformingDivisions.length
          )
          expect(moduleResult.summary.topPerformingAreas.length).toBe(
            originalResult.summary.topPerformingAreas.length
          )

          return true
        }
      ),
      { numRuns: 100 }
    )
  }, 60000) // 60 second timeout for property test
})
