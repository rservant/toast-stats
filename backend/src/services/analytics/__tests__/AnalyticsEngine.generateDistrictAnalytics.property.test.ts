/**
 * Property-Based Tests for generateDistrictAnalytics Module Delegation
 *
 * Feature: analytics-engine-refactor
 * Property 2: Module Delegation Consistency
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5
 *
 * This test verifies that the refactored generateDistrictAnalytics method
 * correctly delegates to specialized modules while maintaining identical
 * output structure and values.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import fs from 'fs/promises'
import path from 'path'
import { AnalyticsEngine } from '../../AnalyticsEngine.js'
import { ClubHealthAnalyticsModule } from '../ClubHealthAnalyticsModule.js'
import { DivisionAreaAnalyticsModule } from '../DivisionAreaAnalyticsModule.js'
import type {
  IAnalyticsDataSource,
  AnalyticsSnapshotInfo,
} from '../../../types/serviceInterfaces.js'
import type {
  DistrictStatistics,
  DistrictCacheEntry,
} from '../../../types/districts.js'
import type { Snapshot } from '../../../types/snapshots.js'

describe('AnalyticsEngine.generateDistrictAnalytics - Property-Based Tests', () => {
  let testCacheDir: string

  beforeEach(async () => {
    // Create a unique test cache directory
    testCacheDir = path.join(
      process.cwd(),
      'test-cache',
      `district-analytics-pbt-${Date.now()}-${Math.random().toString(36).substring(7)}`
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

  // Generator for club performance records with all required fields
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
        'New Members': fc.integer({ min: 0, max: 10 }).map(String),
        'Add. New Members': fc.integer({ min: 0, max: 5 }).map(String),
        'Level 1s': fc.integer({ min: 0, max: 8 }).map(String),
        'Level 2s': fc.integer({ min: 0, max: 6 }).map(String),
        'Add. Level 2s': fc.integer({ min: 0, max: 4 }).map(String),
        'Level 3s': fc.integer({ min: 0, max: 4 }).map(String),
        'Level 4s, Path Completions, or DTM Awards': fc
          .integer({ min: 0, max: 3 })
          .map(String),
        'Add. Level 4s, Path Completions, or DTM award': fc
          .integer({ min: 0, max: 2 })
          .map(String),
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
   * Create a mock data source that returns consistent data
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
   * Helper to convert DistrictStatistics to DistrictCacheEntry
   */
  const toDistrictCacheEntry = (
    stats: DistrictStatistics,
    date: string
  ): DistrictCacheEntry => ({
    districtId: stats.districtId,
    date,
    districtPerformance: stats.districtPerformance ?? [],
    divisionPerformance: stats.divisionPerformance ?? [],
    clubPerformance: stats.clubPerformance ?? [],
    fetchedAt: stats.asOfDate,
  })

  /**
   * Property 2: Module Delegation Consistency
   *
   * For any valid district ID and date range, the refactored generateDistrictAnalytics
   * method SHALL delegate to specialized modules and produce consistent results:
   * - ClubHealthAnalyticsModule for club health classification
   * - DivisionAreaAnalyticsModule for division rankings and area analysis
   *
   * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**
   */
  it('Property 2: Module Delegation Consistency - generateDistrictAnalytics delegates correctly to modules', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateValidDistrictId(),
        fc.array(generateValidDate(), { minLength: 1, maxLength: 3 }),
        async (districtId: string, dates: string[]) => {
          // Sort dates to ensure consistent ordering
          const sortedDates = [...new Set(dates)].sort()

          // Generate district data for each date
          const districtData = new Map<string, DistrictStatistics>()
          const dataEntries: DistrictCacheEntry[] = []

          for (const date of sortedDates) {
            const stats = fc.sample(
              generateDistrictStatistics(districtId, date),
              1
            )[0]!
            districtData.set(`${date}-${districtId}`, stats)
            dataEntries.push(toDistrictCacheEntry(stats, date))
          }

          // Create mock data source
          const mockDataSource = createMockDataSource(districtData, sortedDates)

          // Create AnalyticsEngine and individual modules
          const analyticsEngine = new AnalyticsEngine(mockDataSource)
          const clubHealthModule = new ClubHealthAnalyticsModule(mockDataSource)
          const divisionAreaModule = new DivisionAreaAnalyticsModule(
            mockDataSource
          )

          // Call generateDistrictAnalytics
          const startDate = sortedDates[0]
          const endDate = sortedDates[sortedDates.length - 1]

          const districtAnalytics =
            await analyticsEngine.generateDistrictAnalytics(
              districtId,
              startDate,
              endDate
            )

          // Verify club health delegation (Requirement 1.3)
          // The club trends from generateDistrictAnalytics should match ClubHealthAnalyticsModule
          const moduleClubTrends = await clubHealthModule.analyzeClubTrends(
            districtId,
            dataEntries
          )

          // Verify club count matches
          expect(districtAnalytics.allClubs.length).toBe(
            moduleClubTrends.length
          )

          // Verify club health status distribution matches
          const engineVulnerable = districtAnalytics.vulnerableClubs.length
          const engineThriving = districtAnalytics.thrivingClubs.length
          const engineIntervention =
            districtAnalytics.interventionRequiredClubs.length

          const moduleVulnerable = moduleClubTrends.filter(
            c => c.currentStatus === 'vulnerable'
          ).length
          const moduleThriving = moduleClubTrends.filter(
            c => c.currentStatus === 'thriving'
          ).length
          const moduleIntervention = moduleClubTrends.filter(
            c => c.currentStatus === 'intervention-required'
          ).length

          expect(engineVulnerable).toBe(moduleVulnerable)
          expect(engineThriving).toBe(moduleThriving)
          expect(engineIntervention).toBe(moduleIntervention)

          // Verify division analysis delegation (Requirement 1.4)
          const moduleDivisions =
            divisionAreaModule.analyzeDivisions(dataEntries)

          // Verify division count matches
          expect(districtAnalytics.divisionRankings.length).toBe(
            moduleDivisions.length
          )

          // Verify division rankings match
          for (let i = 0; i < districtAnalytics.divisionRankings.length; i++) {
            const engineDiv = districtAnalytics.divisionRankings[i]
            const moduleDiv = moduleDivisions[i]

            if (engineDiv && moduleDiv) {
              expect(engineDiv.divisionId).toBe(moduleDiv.divisionId)
              expect(engineDiv.totalDcpGoals).toBe(moduleDiv.totalDcpGoals)
              expect(engineDiv.totalClubs).toBe(moduleDiv.totalClubs)
              expect(engineDiv.rank).toBe(moduleDiv.rank)
            }
          }

          // Verify area analysis delegation (Requirement 1.4)
          const latestEntry = dataEntries[dataEntries.length - 1]
          if (latestEntry) {
            const moduleAreas = divisionAreaModule.analyzeAreas(latestEntry)

            // Verify top performing areas count matches (both return top 10)
            expect(districtAnalytics.topPerformingAreas.length).toBe(
              moduleAreas.length
            )

            // Verify area data matches
            for (
              let i = 0;
              i < districtAnalytics.topPerformingAreas.length;
              i++
            ) {
              const engineArea = districtAnalytics.topPerformingAreas[i]
              const moduleArea = moduleAreas[i]

              if (engineArea && moduleArea) {
                expect(engineArea.areaId).toBe(moduleArea.areaId)
                expect(engineArea.totalDcpGoals).toBe(moduleArea.totalDcpGoals)
                expect(engineArea.normalizedScore).toBe(
                  moduleArea.normalizedScore
                )
              }
            }
          }

          // Verify output structure completeness
          expect(districtAnalytics.districtId).toBe(districtId)
          expect(districtAnalytics.dateRange).toBeDefined()
          expect(districtAnalytics.totalMembership).toBeGreaterThanOrEqual(0)
          expect(districtAnalytics.membershipTrend).toBeDefined()
          expect(districtAnalytics.distinguishedClubs).toBeDefined()
          expect(
            districtAnalytics.distinguishedProjection
          ).toBeGreaterThanOrEqual(0)

          // Verify mutually exclusive club health categories
          const totalCategorized =
            engineVulnerable + engineThriving + engineIntervention
          expect(totalCategorized).toBe(districtAnalytics.allClubs.length)

          return true
        }
      ),
      { numRuns: 100 }
    )
  }, 120000) // 120 second timeout for property test
})
