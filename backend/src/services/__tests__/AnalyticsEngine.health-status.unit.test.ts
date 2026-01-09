/**
 * Unit Tests for AnalyticsEngine Health Status Classification
 *
 * Feature: club-health-classification
 * Tests specific classification scenarios for:
 * - Intervention Required cases (Requirements 1.2, 1.3)
 * - Thriving cases (Requirement 1.4)
 * - Vulnerable cases (Requirement 1.5)
 * - Month boundary cases (Requirements 2.1, 2.2, 2.3, 2.4, 2.5)
 *
 * Note: After the analytics-engine-refactor, assessClubHealth is now on
 * ClubHealthAnalyticsModule, not AnalyticsEngine. These tests use the module directly.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ClubHealthAnalyticsModule } from '../analytics/ClubHealthAnalyticsModule.js'
import { AnalyticsDataSourceAdapter } from '../AnalyticsDataSourceAdapter.js'
import { PerDistrictFileSnapshotStore } from '../PerDistrictSnapshotStore.js'
import { createDistrictDataAggregator } from '../DistrictDataAggregator.js'
import type { ClubTrend } from '../../types/analytics.js'
import type { ScrapedRecord } from '../../types/districts.js'
import fs from 'fs/promises'
import path from 'path'

describe('AnalyticsEngine Health Status Classification - Unit Tests', () => {
  let testCacheDir: string
  let clubHealthModule: ClubHealthAnalyticsModule

  beforeEach(async () => {
    // Create a unique test cache directory
    testCacheDir = path.join(
      process.cwd(),
      'test-cache',
      `analytics-health-unit-${Date.now()}-${Math.random().toString(36).substring(7)}`
    )
    await fs.mkdir(testCacheDir, { recursive: true })

    // Create the snapshots subdirectory
    const snapshotsDir = path.join(testCacheDir, 'snapshots')
    await fs.mkdir(snapshotsDir, { recursive: true })

    // Create minimal dependencies for ClubHealthAnalyticsModule
    const snapshotStore = new PerDistrictFileSnapshotStore({
      cacheDir: testCacheDir,
      maxSnapshots: 100,
      maxAgeDays: 365,
    })
    const districtDataAggregator = createDistrictDataAggregator(snapshotStore)
    const dataSource = new AnalyticsDataSourceAdapter(
      districtDataAggregator,
      snapshotStore
    )
    clubHealthModule = new ClubHealthAnalyticsModule(dataSource)
  })

  afterEach(async () => {
    // Clean up test cache directory
    try {
      await fs.rm(testCacheDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  /**
   * Helper function to create a ClubTrend with specified membership and DCP goals
   */
  function createClubTrend(
    membership: number,
    dcpGoals: number,
    date: string = '2026-01-15'
  ): ClubTrend {
    return {
      clubId: 'test-club-1',
      clubName: 'Test Club',
      divisionId: 'A',
      divisionName: 'Division A',
      areaId: '1',
      areaName: 'Area 1',
      membershipTrend: [{ date, count: membership }],
      dcpGoalsTrend: [{ date, goalsAchieved: dcpGoals }],
      currentStatus: 'thriving', // Will be overwritten by assessClubHealth
      riskFactors: [],
      distinguishedLevel: 'NotDistinguished',
    }
  }

  /**
   * Helper function to create ScrapedRecord with specified membership data
   */
  function createClubData(
    activeMembers: number,
    memBase: number,
    cspSubmitted: boolean = true,
    goalsMet: number = 0
  ): ScrapedRecord {
    return {
      'Club Number': 'test-club-1',
      'Club Name': 'Test Club',
      'Active Members': activeMembers,
      'Mem. Base': memBase,
      'Goals Met': goalsMet,
      CSP: cspSubmitted ? 'Yes' : 'No',
    }
  }

  /**
   * Call assessClubHealth on the ClubHealthAnalyticsModule
   */
  function callAssessClubHealth(
    module: ClubHealthAnalyticsModule,
    clubTrend: ClubTrend,
    latestClubData?: ScrapedRecord,
    snapshotDate?: string
  ): void {
    module.assessClubHealth(clubTrend, latestClubData, snapshotDate)
  }

  /**
   * Task 6.1: Test intervention required cases
   * Requirements: 1.2, 1.3
   */
  describe('6.1 Intervention Required Cases', () => {
    it('Membership 8, net growth 0 → intervention-required', () => {
      // Membership 8, memBase 8 → net growth = 8 - 8 = 0
      const clubTrend = createClubTrend(8, 5, '2026-01-15') // January, DCP checkpoint = 3
      const clubData = createClubData(8, 8, true, 5)

      callAssessClubHealth(clubHealthModule, clubTrend, clubData, '2026-01-15')

      expect(clubTrend.currentStatus).toBe('intervention-required')
      expect(clubTrend.riskFactors).toContain('Membership below 12 (critical)')
      expect(
        clubTrend.riskFactors.some(r => r.includes('Net growth since July: 0'))
      ).toBe(true)
    })

    it('Membership 11, net growth 2 → intervention-required', () => {
      // Membership 11, memBase 9 → net growth = 11 - 9 = 2
      const clubTrend = createClubTrend(11, 5, '2026-01-15')
      const clubData = createClubData(11, 9, true, 5)

      callAssessClubHealth(clubHealthModule, clubTrend, clubData, '2026-01-15')

      expect(clubTrend.currentStatus).toBe('intervention-required')
      expect(clubTrend.riskFactors).toContain('Membership below 12 (critical)')
      expect(
        clubTrend.riskFactors.some(r => r.includes('Net growth since July: 2'))
      ).toBe(true)
    })

    it('Membership 11, net growth 3 → NOT intervention-required (growth override)', () => {
      // Membership 11, memBase 8 → net growth = 11 - 8 = 3
      // Growth override: net growth >= 3 means membership requirement is met
      const clubTrend = createClubTrend(11, 5, '2026-01-15')
      const clubData = createClubData(11, 8, true, 5)

      callAssessClubHealth(clubHealthModule, clubTrend, clubData, '2026-01-15')

      // Should NOT be intervention-required because net growth >= 3
      expect(clubTrend.currentStatus).not.toBe('intervention-required')
      // Should be thriving (all requirements met: membership via growth override, DCP 5 >= 3, CSP true)
      expect(clubTrend.currentStatus).toBe('thriving')
    })

    it('Membership 5, net growth -2 → intervention-required', () => {
      // Membership 5, memBase 7 → net growth = 5 - 7 = -2
      const clubTrend = createClubTrend(5, 10, '2026-01-15')
      const clubData = createClubData(5, 7, true, 10)

      callAssessClubHealth(clubHealthModule, clubTrend, clubData, '2026-01-15')

      expect(clubTrend.currentStatus).toBe('intervention-required')
      expect(clubTrend.riskFactors).toContain('Membership below 12 (critical)')
    })

    it('Membership 0, net growth 0 → intervention-required', () => {
      // Edge case: zero membership
      const clubTrend = createClubTrend(0, 0, '2026-01-15')
      const clubData = createClubData(0, 0, true, 0)

      callAssessClubHealth(clubHealthModule, clubTrend, clubData, '2026-01-15')

      expect(clubTrend.currentStatus).toBe('intervention-required')
    })
  })

  /**
   * Task 6.2: Test thriving cases
   * Requirement: 1.4
   */
  describe('6.2 Thriving Cases', () => {
    it('Membership 20, DCP meets checkpoint, CSP true → thriving', () => {
      // January requires 3 DCP goals
      const clubTrend = createClubTrend(20, 3, '2026-01-15')
      const clubData = createClubData(20, 15, true, 3)

      callAssessClubHealth(clubHealthModule, clubTrend, clubData, '2026-01-15')

      expect(clubTrend.currentStatus).toBe('thriving')
      expect(clubTrend.riskFactors).toHaveLength(0)
    })

    it('Membership 15, net growth 5, DCP meets checkpoint → thriving', () => {
      // Membership 15, memBase 10 → net growth = 5
      // Net growth >= 3 satisfies membership requirement
      // January requires 3 DCP goals
      const clubTrend = createClubTrend(15, 4, '2026-01-15')
      const clubData = createClubData(15, 10, true, 4)

      callAssessClubHealth(clubHealthModule, clubTrend, clubData, '2026-01-15')

      expect(clubTrend.currentStatus).toBe('thriving')
      expect(clubTrend.riskFactors).toHaveLength(0)
    })

    it('Membership 25, DCP 5, CSP true in April → thriving', () => {
      // April requires 5 DCP goals
      const clubTrend = createClubTrend(25, 5, '2026-04-15')
      const clubData = createClubData(25, 20, true, 5)

      callAssessClubHealth(clubHealthModule, clubTrend, clubData, '2026-04-15')

      expect(clubTrend.currentStatus).toBe('thriving')
      expect(clubTrend.riskFactors).toHaveLength(0)
    })

    it('Membership 20, DCP 0 in July (admin checkpoint) → thriving', () => {
      // July requires 0 DCP goals (administrative checkpoint)
      const clubTrend = createClubTrend(20, 0, '2026-07-15')
      const clubData = createClubData(20, 15, true, 0)

      callAssessClubHealth(clubHealthModule, clubTrend, clubData, '2026-07-15')

      expect(clubTrend.currentStatus).toBe('thriving')
      expect(clubTrend.riskFactors).toHaveLength(0)
    })

    it('Membership 12, net growth 3, DCP meets checkpoint → thriving', () => {
      // Membership 12 (>= 12, so not intervention), net growth 3 satisfies membership requirement
      const clubTrend = createClubTrend(12, 3, '2026-01-15')
      const clubData = createClubData(12, 9, true, 3)

      callAssessClubHealth(clubHealthModule, clubTrend, clubData, '2026-01-15')

      expect(clubTrend.currentStatus).toBe('thriving')
      expect(clubTrend.riskFactors).toHaveLength(0)
    })
  })

  /**
   * Task 6.3: Test vulnerable cases
   * Requirement: 1.5
   */
  describe('6.3 Vulnerable Cases', () => {
    it('Membership 20, DCP below checkpoint → vulnerable', () => {
      // January requires 3 DCP goals, club has 2
      const clubTrend = createClubTrend(20, 2, '2026-01-15')
      const clubData = createClubData(20, 15, true, 2)

      callAssessClubHealth(clubHealthModule, clubTrend, clubData, '2026-01-15')

      expect(clubTrend.currentStatus).toBe('vulnerable')
      expect(
        clubTrend.riskFactors.some(r => r.includes('DCP checkpoint not met'))
      ).toBe(true)
      expect(clubTrend.riskFactors.some(r => r.includes('2 goal'))).toBe(true)
      expect(clubTrend.riskFactors.some(r => r.includes('3 required'))).toBe(
        true
      )
    })

    it('Membership 20, DCP meets checkpoint, CSP false → vulnerable', () => {
      // All requirements met except CSP
      const clubTrend = createClubTrend(20, 5, '2026-01-15')
      const clubData = createClubData(20, 15, false, 5)

      callAssessClubHealth(clubHealthModule, clubTrend, clubData, '2026-01-15')

      expect(clubTrend.currentStatus).toBe('vulnerable')
      expect(clubTrend.riskFactors).toContain('CSP not submitted')
    })

    it('Membership 15, net growth 2, DCP meets checkpoint → vulnerable (membership not met)', () => {
      // Membership 15 < 20 AND net growth 2 < 3, so membership requirement not met
      const clubTrend = createClubTrend(15, 5, '2026-01-15')
      const clubData = createClubData(15, 13, true, 5)

      callAssessClubHealth(clubHealthModule, clubTrend, clubData, '2026-01-15')

      expect(clubTrend.currentStatus).toBe('vulnerable')
      expect(
        clubTrend.riskFactors.some(r =>
          r.includes('Membership below threshold')
        )
      ).toBe(true)
    })

    it('Membership 20, DCP 4 in April (needs 5) → vulnerable', () => {
      // April requires 5 DCP goals, club has 4
      const clubTrend = createClubTrend(20, 4, '2026-04-15')
      const clubData = createClubData(20, 15, true, 4)

      callAssessClubHealth(clubHealthModule, clubTrend, clubData, '2026-04-15')

      expect(clubTrend.currentStatus).toBe('vulnerable')
      expect(
        clubTrend.riskFactors.some(r => r.includes('DCP checkpoint not met'))
      ).toBe(true)
      expect(clubTrend.riskFactors.some(r => r.includes('5 required'))).toBe(
        true
      )
    })

    it('Multiple requirements not met → vulnerable with multiple risk factors', () => {
      // Membership 18 < 20, net growth 1 < 3, DCP 1 < 3 (January), CSP false
      const clubTrend = createClubTrend(18, 1, '2026-01-15')
      const clubData = createClubData(18, 17, false, 1)

      callAssessClubHealth(clubHealthModule, clubTrend, clubData, '2026-01-15')

      expect(clubTrend.currentStatus).toBe('vulnerable')
      expect(clubTrend.riskFactors.length).toBeGreaterThanOrEqual(3)
      expect(
        clubTrend.riskFactors.some(r =>
          r.includes('Membership below threshold')
        )
      ).toBe(true)
      expect(
        clubTrend.riskFactors.some(r => r.includes('DCP checkpoint not met'))
      ).toBe(true)
      expect(clubTrend.riskFactors).toContain('CSP not submitted')
    })
  })

  /**
   * Task 6.4: Test month boundary cases
   * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
   */
  describe('6.4 Month Boundary Cases', () => {
    // Helper to test classification at a specific month
    function testMonthClassification(
      month: number,
      requiredDcp: number,
      monthName: string
    ) {
      const dateString = `2026-${month.toString().padStart(2, '0')}-15`

      describe(`${monthName} (month ${month}) - requires ${requiredDcp} DCP goals`, () => {
        it(`DCP ${requiredDcp} meets checkpoint → thriving`, () => {
          const clubTrend = createClubTrend(20, requiredDcp, dateString)
          const clubData = createClubData(20, 15, true, requiredDcp)

          callAssessClubHealth(
            clubHealthModule,
            clubTrend,
            clubData,
            dateString
          )

          expect(clubTrend.currentStatus).toBe('thriving')
        })

        if (requiredDcp > 0) {
          it(`DCP ${requiredDcp - 1} below checkpoint → vulnerable`, () => {
            const clubTrend = createClubTrend(20, requiredDcp - 1, dateString)
            const clubData = createClubData(20, 15, true, requiredDcp - 1)

            callAssessClubHealth(
              clubHealthModule,
              clubTrend,
              clubData,
              dateString
            )

            expect(clubTrend.currentStatus).toBe('vulnerable')
            expect(
              clubTrend.riskFactors.some(r =>
                r.includes('DCP checkpoint not met')
              )
            ).toBe(true)
          })
        }
      })
    }

    // July (7): Administrative checkpoint - 0 DCP goals required
    testMonthClassification(7, 0, 'July')

    // August (8): 1 goal required
    testMonthClassification(8, 1, 'August')

    // September (9): 1 goal required
    testMonthClassification(9, 1, 'September')

    // October (10): 2 goals required
    testMonthClassification(10, 2, 'October')

    // November (11): 2 goals required
    testMonthClassification(11, 2, 'November')

    // December (12): 3 goals required
    testMonthClassification(12, 3, 'December')

    // January (1): 3 goals required
    testMonthClassification(1, 3, 'January')

    // February (2): 4 goals required
    testMonthClassification(2, 4, 'February')

    // March (3): 4 goals required
    testMonthClassification(3, 4, 'March')

    // April (4): 5 goals required
    testMonthClassification(4, 5, 'April')

    // May (5): 5 goals required
    testMonthClassification(5, 5, 'May')

    // June (6): 5 goals required
    testMonthClassification(6, 5, 'June')

    describe('Month transition edge cases', () => {
      // Note: Using mid-month dates to avoid timezone issues with date parsing
      // JavaScript's Date constructor interprets YYYY-MM-DD as UTC, which can
      // result in the previous day in local time zones west of UTC.

      it('September (1 goal) vs October (2 goals) - mid-month comparison', () => {
        // September 15 - requires 1 goal
        const septTrend = createClubTrend(20, 1, '2026-09-15')
        const septData = createClubData(20, 15, true, 1)
        callAssessClubHealth(
          clubHealthModule,
          septTrend,
          septData,
          '2026-09-15'
        )
        expect(septTrend.currentStatus).toBe('thriving')

        // October 15 - requires 2 goals, same club with 1 goal is now vulnerable
        const octTrend = createClubTrend(20, 1, '2026-10-15')
        const octData = createClubData(20, 15, true, 1)
        callAssessClubHealth(clubHealthModule, octTrend, octData, '2026-10-15')
        expect(octTrend.currentStatus).toBe('vulnerable')
      })

      it('November (2 goals) vs December (3 goals) - mid-month comparison', () => {
        // November 15 - requires 2 goals
        const novTrend = createClubTrend(20, 2, '2026-11-15')
        const novData = createClubData(20, 15, true, 2)
        callAssessClubHealth(clubHealthModule, novTrend, novData, '2026-11-15')
        expect(novTrend.currentStatus).toBe('thriving')

        // December 15 - requires 3 goals, same club with 2 goals is now vulnerable
        const decTrend = createClubTrend(20, 2, '2026-12-15')
        const decData = createClubData(20, 15, true, 2)
        callAssessClubHealth(clubHealthModule, decTrend, decData, '2026-12-15')
        expect(decTrend.currentStatus).toBe('vulnerable')
      })

      it('January (3 goals) vs February (4 goals) - mid-month comparison', () => {
        // January 15 - requires 3 goals
        const janTrend = createClubTrend(20, 3, '2026-01-15')
        const janData = createClubData(20, 15, true, 3)
        callAssessClubHealth(clubHealthModule, janTrend, janData, '2026-01-15')
        expect(janTrend.currentStatus).toBe('thriving')

        // February 15 - requires 4 goals, same club with 3 goals is now vulnerable
        const febTrend = createClubTrend(20, 3, '2026-02-15')
        const febData = createClubData(20, 15, true, 3)
        callAssessClubHealth(clubHealthModule, febTrend, febData, '2026-02-15')
        expect(febTrend.currentStatus).toBe('vulnerable')
      })

      it('March (4 goals) vs April (5 goals) - mid-month comparison', () => {
        // March 15 - requires 4 goals
        const marTrend = createClubTrend(20, 4, '2026-03-15')
        const marData = createClubData(20, 15, true, 4)
        callAssessClubHealth(clubHealthModule, marTrend, marData, '2026-03-15')
        expect(marTrend.currentStatus).toBe('thriving')

        // April 15 - requires 5 goals, same club with 4 goals is now vulnerable
        const aprTrend = createClubTrend(20, 4, '2026-04-15')
        const aprData = createClubData(20, 15, true, 4)
        callAssessClubHealth(clubHealthModule, aprTrend, aprData, '2026-04-15')
        expect(aprTrend.currentStatus).toBe('vulnerable')
      })
    })
  })
})
