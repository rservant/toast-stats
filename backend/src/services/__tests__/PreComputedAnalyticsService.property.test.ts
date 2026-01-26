/**
 * Property-Based Tests for PreComputedAnalyticsService
 *
 * **Feature: district-analytics-performance, Property 1: Pre-Computed Analytics Totals Invariant**
 *
 * This test validates the pre-computed analytics totals using property-based testing
 * to ensure mathematical invariants hold across all valid inputs.
 *
 * **Validates: Requirements 1.2**
 *
 * Property 1: Pre-Computed Analytics Totals Invariant
 * *For any* generated district data with N clubs:
 * - `clubCounts.total` = `clubCounts.thriving + clubCounts.vulnerable + clubCounts.interventionRequired`
 * - `totalMembership` = sum of all club membership counts (when membership.total is undefined)
 * - `distinguishedClubs.total` = sum of all distinguished level counts
 *
 * This is warranted because:
 * - Mathematical invariant exists (totals = sum of parts)
 * - Complex input space (varying club counts, membership values)
 * - Existing bug ("As of" dates) suggests edge cases were missed
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { PreComputedAnalyticsService } from '../PreComputedAnalyticsService.js'
import type {
  DistrictStatistics,
  ScrapedRecord,
} from '../../types/districts.js'
import type { AnalyticsSummaryFile } from '../../types/precomputedAnalytics.js'

describe('PreComputedAnalyticsService - Property Tests', () => {
  let service: PreComputedAnalyticsService
  let testDir: string
  let snapshotsDir: string

  // Helper to create a unique test directory
  const createTestDir = async (): Promise<string> => {
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    const dir = path.join(
      os.tmpdir(),
      `precomputed-analytics-property-test-${uniqueId}`
    )
    await fs.mkdir(dir, { recursive: true })
    return dir
  }

  beforeEach(async () => {
    testDir = await createTestDir()
    snapshotsDir = path.join(testDir, 'snapshots')
    await fs.mkdir(snapshotsDir, { recursive: true })

    service = new PreComputedAnalyticsService({
      snapshotsDir,
    })
  })

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  // ========== Generators ==========

  /**
   * Generator for valid alphanumeric district IDs
   */
  const districtIdArb = fc
    .stringMatching(/^[A-Za-z0-9]+$/)
    .filter(s => s.length > 0 && s.length <= 10)

  /**
   * Generator for valid date strings (YYYY-MM-DD format)
   */
  const dateStringArb = fc
    .tuple(
      fc.integer({ min: 2020, max: 2030 }),
      fc.integer({ min: 1, max: 12 }),
      fc.integer({ min: 1, max: 28 }) // Use 28 to avoid invalid dates
    )
    .map(([year, month, day]) => {
      const monthStr = month.toString().padStart(2, '0')
      const dayStr = day.toString().padStart(2, '0')
      return `${year}-${monthStr}-${dayStr}`
    })

  /**
   * Generator for club membership values (realistic range)
   */
  const membershipArb = fc.integer({ min: 1, max: 100 })

  /**
   * Generator for DCP goals met (0-10 range)
   */
  const goalsMetArb = fc.integer({ min: 0, max: 10 })

  /**
   * Generator for membership base (realistic range)
   */
  const memBaseArb = fc.integer({ min: 1, max: 50 })

  /**
   * Generator for payment counts (realistic range)
   */
  const paymentCountArb = fc.integer({ min: 0, max: 30 })

  /**
   * Generator for distinguished status field values
   */
  const distinguishedStatusArb = fc.oneof(
    fc.constant(''),
    fc.constant('Distinguished'),
    fc.constant('Select Distinguished'),
    fc.constant('Presidents Distinguished'),
    fc.constant('Smedley Distinguished'),
    fc.constant('None'),
    fc.constant('N/A')
  )

  /**
   * Generator for a single club performance record
   */
  const clubRecordArb = fc
    .tuple(
      fc.integer({ min: 1000, max: 9999 }), // Club number
      membershipArb,
      goalsMetArb,
      memBaseArb,
      paymentCountArb, // Oct renewals
      paymentCountArb, // Apr renewals
      paymentCountArb, // New members
      distinguishedStatusArb
    )
    .map(
      ([
        clubNumber,
        activeMembers,
        goalsMet,
        memBase,
        octRen,
        aprRen,
        newMembers,
        distinguishedStatus,
      ]): ScrapedRecord => ({
        'Club Number': clubNumber.toString(),
        'Club Name': `Test Club ${clubNumber}`,
        'Active Members': activeMembers,
        'Goals Met': goalsMet,
        'Mem. Base': memBase,
        'Oct. Ren.': octRen,
        'Apr. Ren.': aprRen,
        'New Members': newMembers,
        'Club Distinguished Status': distinguishedStatus,
        Division: 'A',
        Area: '1',
      })
    )

  /**
   * Generator for an array of club records (1-50 clubs)
   */
  const clubsArrayArb = fc.array(clubRecordArb, { minLength: 1, maxLength: 50 })

  /**
   * Generator for district statistics with clubs
   * Uses undefined membership.total to force calculation from club data
   */
  const districtStatisticsArb = fc
    .tuple(districtIdArb, dateStringArb, clubsArrayArb)
    .map(
      ([districtId, asOfDate, clubs]): DistrictStatistics => ({
        districtId,
        asOfDate,
        membership: {
          total: undefined as unknown as number, // Force calculation from clubs
          change: 0,
          changePercent: 0,
          byClub: [],
        },
        clubs: {
          total: clubs.length,
          active: clubs.length,
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
        clubPerformance: clubs,
      })
    )

  // ========== Property Tests ==========

  /**
   * Property 1: Pre-Computed Analytics Totals Invariant
   *
   * **Feature: district-analytics-performance, Property 1: Pre-Computed Analytics Totals Invariant**
   * **Validates: Requirements 1.2**
   *
   * *For any* generated district data with N clubs:
   * - `clubCounts.total` = `clubCounts.thriving + clubCounts.vulnerable + clubCounts.interventionRequired`
   * - `totalMembership` = sum of all club membership counts
   * - `distinguishedClubs.total` = sum of all distinguished level counts
   */
  describe('Property 1: Pre-Computed Analytics Totals Invariant', () => {
    /**
     * Property: Club health counts sum to total
     *
     * For any district data, the sum of thriving, vulnerable, and intervention-required
     * clubs must equal the total club count.
     *
     * **Validates: Requirements 1.2**
     */
    it('club health counts sum equals total clubs', async () => {
      await fc.assert(
        fc.asyncProperty(districtStatisticsArb, async districtStats => {
          // Create unique snapshot directory for this test run
          const snapshotId = `test-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
          const snapshotDir = path.join(snapshotsDir, snapshotId)
          await fs.mkdir(snapshotDir, { recursive: true })

          try {
            // Compute analytics
            await service.computeAndStore(snapshotId, [districtStats])

            // Read the result
            const analyticsPath = path.join(
              snapshotDir,
              'analytics-summary.json'
            )
            const content = await fs.readFile(analyticsPath, 'utf-8')
            const summaryFile: AnalyticsSummaryFile = JSON.parse(content)

            const summary = summaryFile.districts[districtStats.districtId]
            expect(summary).toBeDefined()

            if (summary) {
              const { clubCounts } = summary
              const sumOfParts =
                clubCounts.thriving +
                clubCounts.vulnerable +
                clubCounts.interventionRequired

              // Invariant: total = thriving + vulnerable + interventionRequired
              expect(clubCounts.total).toBe(sumOfParts)
            }
          } finally {
            // Cleanup this specific snapshot directory
            await fs
              .rm(snapshotDir, { recursive: true, force: true })
              .catch(() => {})
          }
        }),
        { numRuns: 50 }
      )
    })

    /**
     * Property: Total membership equals sum of club memberships
     *
     * When membership.total is not provided, the total membership should equal
     * the sum of all individual club membership counts.
     *
     * **Validates: Requirements 1.2**
     */
    it('total membership equals sum of club memberships', async () => {
      await fc.assert(
        fc.asyncProperty(districtStatisticsArb, async districtStats => {
          // Create unique snapshot directory for this test run
          const snapshotId = `test-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
          const snapshotDir = path.join(snapshotsDir, snapshotId)
          await fs.mkdir(snapshotDir, { recursive: true })

          try {
            // Compute analytics
            await service.computeAndStore(snapshotId, [districtStats])

            // Read the result
            const analyticsPath = path.join(
              snapshotDir,
              'analytics-summary.json'
            )
            const content = await fs.readFile(analyticsPath, 'utf-8')
            const summaryFile: AnalyticsSummaryFile = JSON.parse(content)

            const summary = summaryFile.districts[districtStats.districtId]
            expect(summary).toBeDefined()

            if (summary) {
              // Calculate expected total from club data
              const clubs = districtStats.clubPerformance ?? []
              const expectedTotal = clubs.reduce((total, club) => {
                const membership = parseIntSafe(
                  club['Active Members'] ??
                    club['Active Membership'] ??
                    club['Membership']
                )
                return total + membership
              }, 0)

              // Invariant: totalMembership = sum of all club memberships
              expect(summary.totalMembership).toBe(expectedTotal)
            }
          } finally {
            // Cleanup this specific snapshot directory
            await fs
              .rm(snapshotDir, { recursive: true, force: true })
              .catch(() => {})
          }
        }),
        { numRuns: 50 }
      )
    })

    /**
     * Property: Distinguished clubs total equals sum of levels
     *
     * The total distinguished clubs count must equal the sum of
     * smedley + presidents + select + distinguished counts.
     *
     * **Validates: Requirements 1.2**
     */
    it('distinguished clubs total equals sum of levels', async () => {
      await fc.assert(
        fc.asyncProperty(districtStatisticsArb, async districtStats => {
          // Create unique snapshot directory for this test run
          const snapshotId = `test-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
          const snapshotDir = path.join(snapshotsDir, snapshotId)
          await fs.mkdir(snapshotDir, { recursive: true })

          try {
            // Compute analytics
            await service.computeAndStore(snapshotId, [districtStats])

            // Read the result
            const analyticsPath = path.join(
              snapshotDir,
              'analytics-summary.json'
            )
            const content = await fs.readFile(analyticsPath, 'utf-8')
            const summaryFile: AnalyticsSummaryFile = JSON.parse(content)

            const summary = summaryFile.districts[districtStats.districtId]
            expect(summary).toBeDefined()

            if (summary) {
              const { distinguishedClubs } = summary
              const sumOfLevels =
                distinguishedClubs.smedley +
                distinguishedClubs.presidents +
                distinguishedClubs.select +
                distinguishedClubs.distinguished

              // Invariant: total = smedley + presidents + select + distinguished
              expect(distinguishedClubs.total).toBe(sumOfLevels)
            }
          } finally {
            // Cleanup this specific snapshot directory
            await fs
              .rm(snapshotDir, { recursive: true, force: true })
              .catch(() => {})
          }
        }),
        { numRuns: 50 }
      )
    })

    /**
     * Property: All counts are non-negative
     *
     * All computed counts (membership, club health, distinguished) must be
     * non-negative integers.
     *
     * **Validates: Requirements 1.2**
     */
    it('all counts are non-negative', async () => {
      await fc.assert(
        fc.asyncProperty(districtStatisticsArb, async districtStats => {
          // Create unique snapshot directory for this test run
          const snapshotId = `test-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
          const snapshotDir = path.join(snapshotsDir, snapshotId)
          await fs.mkdir(snapshotDir, { recursive: true })

          try {
            // Compute analytics
            await service.computeAndStore(snapshotId, [districtStats])

            // Read the result
            const analyticsPath = path.join(
              snapshotDir,
              'analytics-summary.json'
            )
            const content = await fs.readFile(analyticsPath, 'utf-8')
            const summaryFile: AnalyticsSummaryFile = JSON.parse(content)

            const summary = summaryFile.districts[districtStats.districtId]
            expect(summary).toBeDefined()

            if (summary) {
              // Membership must be non-negative
              expect(summary.totalMembership).toBeGreaterThanOrEqual(0)

              // Club health counts must be non-negative
              expect(summary.clubCounts.total).toBeGreaterThanOrEqual(0)
              expect(summary.clubCounts.thriving).toBeGreaterThanOrEqual(0)
              expect(summary.clubCounts.vulnerable).toBeGreaterThanOrEqual(0)
              expect(
                summary.clubCounts.interventionRequired
              ).toBeGreaterThanOrEqual(0)

              // Distinguished counts must be non-negative
              expect(summary.distinguishedClubs.total).toBeGreaterThanOrEqual(0)
              expect(summary.distinguishedClubs.smedley).toBeGreaterThanOrEqual(
                0
              )
              expect(
                summary.distinguishedClubs.presidents
              ).toBeGreaterThanOrEqual(0)
              expect(summary.distinguishedClubs.select).toBeGreaterThanOrEqual(
                0
              )
              expect(
                summary.distinguishedClubs.distinguished
              ).toBeGreaterThanOrEqual(0)

              // Trend data point values must be non-negative
              expect(summary.trendDataPoint.membership).toBeGreaterThanOrEqual(
                0
              )
              expect(summary.trendDataPoint.payments).toBeGreaterThanOrEqual(0)
              expect(summary.trendDataPoint.dcpGoals).toBeGreaterThanOrEqual(0)
            }
          } finally {
            // Cleanup this specific snapshot directory
            await fs
              .rm(snapshotDir, { recursive: true, force: true })
              .catch(() => {})
          }
        }),
        { numRuns: 50 }
      )
    })

    /**
     * Property: Club count total matches input club array length
     *
     * The total club count should equal the number of clubs in the input data.
     *
     * **Validates: Requirements 1.2**
     */
    it('club count total matches input club array length', async () => {
      await fc.assert(
        fc.asyncProperty(districtStatisticsArb, async districtStats => {
          // Create unique snapshot directory for this test run
          const snapshotId = `test-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
          const snapshotDir = path.join(snapshotsDir, snapshotId)
          await fs.mkdir(snapshotDir, { recursive: true })

          try {
            // Compute analytics
            await service.computeAndStore(snapshotId, [districtStats])

            // Read the result
            const analyticsPath = path.join(
              snapshotDir,
              'analytics-summary.json'
            )
            const content = await fs.readFile(analyticsPath, 'utf-8')
            const summaryFile: AnalyticsSummaryFile = JSON.parse(content)

            const summary = summaryFile.districts[districtStats.districtId]
            expect(summary).toBeDefined()

            if (summary) {
              const inputClubCount = districtStats.clubPerformance?.length ?? 0

              // Invariant: clubCounts.total = number of input clubs
              expect(summary.clubCounts.total).toBe(inputClubCount)
            }
          } finally {
            // Cleanup this specific snapshot directory
            await fs
              .rm(snapshotDir, { recursive: true, force: true })
              .catch(() => {})
          }
        }),
        { numRuns: 50 }
      )
    })

    /**
     * Property: Trend data point date matches input date
     *
     * The trend data point date should match the asOfDate from the input.
     *
     * **Validates: Requirements 1.3**
     */
    it('trend data point date matches input date', async () => {
      await fc.assert(
        fc.asyncProperty(districtStatisticsArb, async districtStats => {
          // Create unique snapshot directory for this test run
          const snapshotId = `test-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
          const snapshotDir = path.join(snapshotsDir, snapshotId)
          await fs.mkdir(snapshotDir, { recursive: true })

          try {
            // Compute analytics
            await service.computeAndStore(snapshotId, [districtStats])

            // Read the result
            const analyticsPath = path.join(
              snapshotDir,
              'analytics-summary.json'
            )
            const content = await fs.readFile(analyticsPath, 'utf-8')
            const summaryFile: AnalyticsSummaryFile = JSON.parse(content)

            const summary = summaryFile.districts[districtStats.districtId]
            expect(summary).toBeDefined()

            if (summary) {
              // Invariant: trendDataPoint.date = input asOfDate
              expect(summary.trendDataPoint.date).toBe(districtStats.asOfDate)
            }
          } finally {
            // Cleanup this specific snapshot directory
            await fs
              .rm(snapshotDir, { recursive: true, force: true })
              .catch(() => {})
          }
        }),
        { numRuns: 50 }
      )
    })

    /**
     * Property: Distinguished clubs cannot exceed total clubs
     *
     * The number of distinguished clubs at any level cannot exceed the total
     * number of clubs.
     *
     * **Validates: Requirements 1.2**
     */
    it('distinguished clubs cannot exceed total clubs', async () => {
      await fc.assert(
        fc.asyncProperty(districtStatisticsArb, async districtStats => {
          // Create unique snapshot directory for this test run
          const snapshotId = `test-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
          const snapshotDir = path.join(snapshotsDir, snapshotId)
          await fs.mkdir(snapshotDir, { recursive: true })

          try {
            // Compute analytics
            await service.computeAndStore(snapshotId, [districtStats])

            // Read the result
            const analyticsPath = path.join(
              snapshotDir,
              'analytics-summary.json'
            )
            const content = await fs.readFile(analyticsPath, 'utf-8')
            const summaryFile: AnalyticsSummaryFile = JSON.parse(content)

            const summary = summaryFile.districts[districtStats.districtId]
            expect(summary).toBeDefined()

            if (summary) {
              // Invariant: distinguished total <= club total
              expect(summary.distinguishedClubs.total).toBeLessThanOrEqual(
                summary.clubCounts.total
              )
            }
          } finally {
            // Cleanup this specific snapshot directory
            await fs
              .rm(snapshotDir, { recursive: true, force: true })
              .catch(() => {})
          }
        }),
        { numRuns: 50 }
      )
    })
  })
})

// ========== Helper Functions ==========

/**
 * Parse an integer value safely, returning 0 for invalid values
 * Mirrors the implementation in PreComputedAnalyticsService
 */
function parseIntSafe(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') {
    return 0
  }
  if (typeof value === 'number') {
    return isNaN(value) ? 0 : Math.floor(value)
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === '') {
      return 0
    }
    const parsed = parseInt(trimmed, 10)
    return isNaN(parsed) ? 0 : parsed
  }
  return 0
}
