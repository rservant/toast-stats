/**
 * Property-Based Tests for ClubHealthAnalyticsModule
 *
 * Feature: analytics-engine-refactor
 * Property 1: Output Equivalence (Club Health)
 *
 * Validates: Requirements 2.3, 5.4
 *
 * This test verifies that the extracted ClubHealthAnalyticsModule produces
 * results identical to the original AnalyticsEngine implementation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import fs from 'fs/promises'
import path from 'path'
import { ClubHealthAnalyticsModule } from '../ClubHealthAnalyticsModule.js'
import { AnalyticsEngine } from '../../AnalyticsEngine.js'
import type {
  IAnalyticsDataSource,
  AnalyticsSnapshotInfo,
} from '../../../types/serviceInterfaces.js'
import type { DistrictStatistics } from '../../../types/districts.js'
import type { Snapshot } from '../../../types/snapshots.js'

describe('ClubHealthAnalyticsModule - Property-Based Tests', () => {
  let testCacheDir: string

  beforeEach(async () => {
    // Create a unique test cache directory
    testCacheDir = path.join(
      process.cwd(),
      'test-cache',
      `club-health-analytics-pbt-${Date.now()}-${Math.random().toString(36).substring(7)}`
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

  // Generator for club performance records with health-related data
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
        // CSP field for club health assessment
        CSP: fc.constantFrom('Yes', 'No', null),
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
   * the original AnalyticsEngine and the extracted ClubHealthAnalyticsModule
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
   * Property 1: Output Equivalence (Club Health) - identifyAtRiskClubs
   *
   * For any valid district ID, calling identifyAtRiskClubs on the extracted
   * ClubHealthAnalyticsModule SHALL produce results identical to the original
   * AnalyticsEngine implementation.
   *
   * **Validates: Requirements 2.3, 5.4**
   */
  it('Property 1a: Output Equivalence - identifyAtRiskClubs should produce identical results', async () => {
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
          const clubHealthModule = new ClubHealthAnalyticsModule(mockDataSource)

          // Call identifyAtRiskClubs on both
          const originalResult =
            await originalEngine.identifyAtRiskClubs(districtId)
          const moduleResult =
            await clubHealthModule.identifyAtRiskClubs(districtId)

          // Verify output equivalence
          // Compare number of at-risk clubs
          expect(moduleResult.length).toBe(originalResult.length)

          // Sort both results by clubId for consistent comparison
          const sortedOriginal = [...originalResult].sort((a, b) =>
            a.clubId.localeCompare(b.clubId)
          )
          const sortedModule = [...moduleResult].sort((a, b) =>
            a.clubId.localeCompare(b.clubId)
          )

          // Compare each club's properties
          for (let i = 0; i < sortedModule.length; i++) {
            const moduleClub = sortedModule[i]!
            const originalClub = sortedOriginal[i]!

            expect(moduleClub.clubId).toBe(originalClub.clubId)
            expect(moduleClub.clubName).toBe(originalClub.clubName)
            expect(moduleClub.currentStatus).toBe(originalClub.currentStatus)
            expect(moduleClub.divisionId).toBe(originalClub.divisionId)
            expect(moduleClub.areaId).toBe(originalClub.areaId)

            // Compare membership trend
            expect(moduleClub.membershipTrend.length).toBe(
              originalClub.membershipTrend.length
            )
            for (let j = 0; j < moduleClub.membershipTrend.length; j++) {
              expect(moduleClub.membershipTrend[j]?.date).toBe(
                originalClub.membershipTrend[j]?.date
              )
              expect(moduleClub.membershipTrend[j]?.count).toBe(
                originalClub.membershipTrend[j]?.count
              )
            }

            // Compare DCP goals trend
            expect(moduleClub.dcpGoalsTrend.length).toBe(
              originalClub.dcpGoalsTrend.length
            )
            for (let j = 0; j < moduleClub.dcpGoalsTrend.length; j++) {
              expect(moduleClub.dcpGoalsTrend[j]?.date).toBe(
                originalClub.dcpGoalsTrend[j]?.date
              )
              expect(moduleClub.dcpGoalsTrend[j]?.goalsAchieved).toBe(
                originalClub.dcpGoalsTrend[j]?.goalsAchieved
              )
            }

            // Compare risk factors (sort for consistent comparison)
            const sortedModuleRiskFactors = [...moduleClub.riskFactors].sort()
            const sortedOriginalRiskFactors = [
              ...originalClub.riskFactors,
            ].sort()
            expect(sortedModuleRiskFactors).toEqual(sortedOriginalRiskFactors)
          }

          return true
        }
      ),
      { numRuns: 100 }
    )
  }, 60000) // 60 second timeout for property test

  /**
   * Property 1b: Output Equivalence (Club Health) - getClubTrends
   *
   * For any valid district ID and club ID, calling getClubTrends on the extracted
   * ClubHealthAnalyticsModule SHALL produce results identical to the original
   * AnalyticsEngine implementation.
   *
   * **Validates: Requirements 2.3, 5.4**
   */
  it('Property 1b: Output Equivalence - getClubTrends should produce identical results', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateValidDistrictId(),
        fc.array(generateValidDate(), { minLength: 1, maxLength: 5 }),
        async (districtId: string, dates: string[]) => {
          // Sort dates to ensure consistent ordering
          const sortedDates = [...new Set(dates)].sort()

          // Generate district data for each date
          const districtData = new Map<string, DistrictStatistics>()
          let clubIds: string[] = []

          for (const date of sortedDates) {
            const stats = fc.sample(
              generateDistrictStatistics(districtId, date),
              1
            )[0]!
            districtData.set(`${date}-${districtId}`, stats)

            // Collect club IDs from the generated data
            if (clubIds.length === 0 && stats.clubPerformance) {
              clubIds = stats.clubPerformance.map(club =>
                String(club['Club Number'])
              )
            }
          }

          // Skip if no clubs generated
          if (clubIds.length === 0) {
            return true
          }

          // Create mock data source
          const mockDataSource = createMockDataSource(districtData, sortedDates)

          // Create both the original AnalyticsEngine and the extracted module
          const originalEngine = new AnalyticsEngine(mockDataSource)
          const clubHealthModule = new ClubHealthAnalyticsModule(mockDataSource)

          // Test with a random club ID from the generated data
          const testClubId =
            clubIds[Math.floor(Math.random() * clubIds.length)]!

          // Call getClubTrends on both
          const originalResult = await originalEngine.getClubTrends(
            districtId,
            testClubId
          )
          const moduleResult = await clubHealthModule.getClubTrends(
            districtId,
            testClubId
          )

          // Verify output equivalence
          if (originalResult === null) {
            expect(moduleResult).toBeNull()
          } else {
            expect(moduleResult).not.toBeNull()

            expect(moduleResult!.clubId).toBe(originalResult.clubId)
            expect(moduleResult!.clubName).toBe(originalResult.clubName)
            expect(moduleResult!.currentStatus).toBe(
              originalResult.currentStatus
            )
            expect(moduleResult!.divisionId).toBe(originalResult.divisionId)
            expect(moduleResult!.areaId).toBe(originalResult.areaId)
            expect(moduleResult!.distinguishedLevel).toBe(
              originalResult.distinguishedLevel
            )

            // Compare membership trend
            expect(moduleResult!.membershipTrend.length).toBe(
              originalResult.membershipTrend.length
            )
            for (let j = 0; j < moduleResult!.membershipTrend.length; j++) {
              expect(moduleResult!.membershipTrend[j]?.date).toBe(
                originalResult.membershipTrend[j]?.date
              )
              expect(moduleResult!.membershipTrend[j]?.count).toBe(
                originalResult.membershipTrend[j]?.count
              )
            }

            // Compare DCP goals trend
            expect(moduleResult!.dcpGoalsTrend.length).toBe(
              originalResult.dcpGoalsTrend.length
            )
            for (let j = 0; j < moduleResult!.dcpGoalsTrend.length; j++) {
              expect(moduleResult!.dcpGoalsTrend[j]?.date).toBe(
                originalResult.dcpGoalsTrend[j]?.date
              )
              expect(moduleResult!.dcpGoalsTrend[j]?.goalsAchieved).toBe(
                originalResult.dcpGoalsTrend[j]?.goalsAchieved
              )
            }

            // Compare risk factors (sort for consistent comparison)
            const sortedModuleRiskFactors = [
              ...moduleResult!.riskFactors,
            ].sort()
            const sortedOriginalRiskFactors = [
              ...originalResult.riskFactors,
            ].sort()
            expect(sortedModuleRiskFactors).toEqual(sortedOriginalRiskFactors)
          }

          return true
        }
      ),
      { numRuns: 100 }
    )
  }, 60000) // 60 second timeout for property test
})
