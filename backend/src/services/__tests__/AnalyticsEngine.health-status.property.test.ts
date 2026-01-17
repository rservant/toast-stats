/**
 * Property-Based Tests for AnalyticsEngine Health Status Classification
 *
 * Feature: club-health-classification
 * Property 1: Health Status Mutual Exclusivity
 * Property 2: Intervention Override Rule
 *
 * Validates: Requirements 1.1, 1.2, 1.4, 1.5
 *
 * The health status classification follows these rules:
 * - Intervention Required: membership < 12 AND net growth < 3
 * - Thriving: membership requirement met AND DCP checkpoint met AND CSP submitted
 * - Vulnerable: any requirement not met (but not intervention)
 *
 * Note: After the analytics-engine-refactor, assessClubHealth is now on
 * ClubHealthAnalyticsModule, not AnalyticsEngine. These tests use the module directly.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import { ClubHealthAnalyticsModule } from '../analytics/ClubHealthAnalyticsModule.js'
import { getDCPCheckpoint } from '../analytics/AnalyticsUtils.js'
import { AnalyticsDataSourceAdapter } from '../AnalyticsDataSourceAdapter.js'
import {
  FileSnapshotStore,
  PerDistrictFileSnapshotStore,
} from '../SnapshotStore.js'
import { createDistrictDataAggregator } from '../DistrictDataAggregator.js'
import type { ClubTrend, ClubHealthStatus } from '../../types/analytics.js'
import type { ScrapedRecord } from '../../types/districts.js'
import fs from 'fs/promises'
import path from 'path'

// Valid health status values
const VALID_HEALTH_STATUSES: ClubHealthStatus[] = [
  'thriving',
  'vulnerable',
  'intervention-required',
]

describe('AnalyticsEngine Health Status Classification - Property-Based Tests', () => {
  let testCacheDir: string
  let clubHealthModule: ClubHealthAnalyticsModule

  beforeEach(async () => {
    // Create a unique test cache directory
    testCacheDir = path.join(
      process.cwd(),
      'test-cache',
      `analytics-health-status-pbt-${Date.now()}-${Math.random().toString(36).substring(7)}`
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
    date: string = '2026-01-08'
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
    cspSubmitted: boolean = true
  ): ScrapedRecord {
    return {
      'Club Number': 'test-club-1',
      'Club Name': 'Test Club',
      'Active Members': activeMembers,
      'Mem. Base': memBase,
      'Goals Met': 0,
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
   * Property 1: Health Status Mutual Exclusivity
   *
   * For any club evaluation, the club SHALL be assigned exactly one of the three
   * health statuses (Thriving/healthy, Vulnerable/at-risk, Intervention Required/critical)
   * - never zero, never more than one.
   *
   * **Validates: Requirements 1.1, 1.4, 1.5**
   */
  it('Property 1: Health status should be exactly one of the valid statuses (mutual exclusivity)', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate membership (0-50)
        fc.integer({ min: 0, max: 50 }),
        // Generate DCP goals (0-10)
        fc.integer({ min: 0, max: 10 }),
        // Generate membership base for net growth calculation (0-50)
        fc.integer({ min: 0, max: 50 }),
        // Generate CSP status
        fc.boolean(),
        // Generate month (1-12)
        fc.integer({ min: 1, max: 12 }),
        async (
          membership: number,
          dcpGoals: number,
          memBase: number,
          cspSubmitted: boolean,
          month: number
        ) => {
          // Create a date string for the given month
          const dateString = `2026-${month.toString().padStart(2, '0')}-15`

          // Create club trend with the generated values
          const clubTrend = createClubTrend(membership, dcpGoals, dateString)

          // Create club data for net growth calculation
          const clubData = createClubData(membership, memBase, cspSubmitted)

          // Call assessClubHealth
          callAssessClubHealth(
            clubHealthModule,
            clubTrend,
            clubData,
            dateString
          )

          // Property: The status should be exactly one of the valid statuses
          expect(VALID_HEALTH_STATUSES).toContain(clubTrend.currentStatus)

          // Property: The status should be a string (not undefined or null)
          expect(typeof clubTrend.currentStatus).toBe('string')
          expect(clubTrend.currentStatus).not.toBeNull()
          expect(clubTrend.currentStatus).not.toBeUndefined()

          // Property: Count how many statuses match - should be exactly 1
          const matchingStatuses = VALID_HEALTH_STATUSES.filter(
            status => clubTrend.currentStatus === status
          )
          expect(matchingStatuses.length).toBe(1)

          return true
        }
      ),
      { numRuns: 25 } // Optimized for CI/CD timeout compliance
    )
  })

  /**
   * Property 2: Intervention Override Rule
   *
   * For any club with membership < 12 AND net growth < 3, the health status
   * SHALL be "Intervention Required" (critical) regardless of DCP goals or CSP status.
   *
   * **Validates: Requirements 1.2**
   */
  it('Property 2: Clubs with membership < 12 AND net growth < 3 should always be intervention-required (critical)', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate membership < 12
        fc.integer({ min: 0, max: 11 }),
        // Generate net growth < 3 (memBase such that activeMembers - memBase < 3)
        // If activeMembers is X, memBase must be > X - 3 to ensure net growth < 3
        fc.integer({ min: 0, max: 11 }),
        // Generate any DCP goals (should not affect the result)
        fc.integer({ min: 0, max: 10 }),
        // Generate any CSP status (should not affect the result)
        fc.boolean(),
        // Generate any month (should not affect the result)
        fc.integer({ min: 1, max: 12 }),
        async (
          membership: number,
          memBaseOffset: number,
          dcpGoals: number,
          cspSubmitted: boolean,
          month: number
        ) => {
          // Calculate memBase to ensure net growth < 3
          // net growth = membership - memBase < 3
          // memBase > membership - 3
          const memBase = Math.max(0, membership - 2 + memBaseOffset)
          const netGrowth = membership - memBase

          // Skip if net growth >= 3 (not in the intervention zone)
          if (netGrowth >= 3) {
            return true
          }

          // Create a date string for the given month
          const dateString = `2026-${month.toString().padStart(2, '0')}-15`

          // Create club trend with the generated values
          const clubTrend = createClubTrend(membership, dcpGoals, dateString)

          // Create club data for net growth calculation
          const clubData = createClubData(membership, memBase, cspSubmitted)

          // Call assessClubHealth
          callAssessClubHealth(
            clubHealthModule,
            clubTrend,
            clubData,
            dateString
          )

          // Property: Status should be 'intervention-required'
          expect(clubTrend.currentStatus).toBe('intervention-required')

          // Property: Risk factors should mention membership and net growth
          expect(clubTrend.riskFactors.length).toBeGreaterThan(0)
          expect(
            clubTrend.riskFactors.some(r => r.includes('Membership below 12'))
          ).toBe(true)
          expect(
            clubTrend.riskFactors.some(r => r.includes('Net growth'))
          ).toBe(true)

          return true
        }
      ),
      { numRuns: 25 } // Optimized for CI/CD timeout compliance
    )
  })

  /**
   * Property 2a: Growth Override - Clubs with membership < 12 but net growth >= 3
   * should NOT automatically be intervention-required
   *
   * **Validates: Requirements 1.2, 1.3**
   */
  it('Property 2a: Clubs with membership < 12 but net growth >= 3 should NOT be intervention-required', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate membership in range 3-11 (need at least 3 members to have net growth >= 3 with memBase = 0)
        fc.integer({ min: 3, max: 11 }),
        // Generate net growth >= 3 (but <= membership to ensure memBase >= 0)
        fc.integer({ min: 3, max: 11 }),
        // Generate any DCP goals
        fc.integer({ min: 0, max: 10 }),
        // Generate any CSP status
        fc.boolean(),
        // Generate any month
        fc.integer({ min: 1, max: 12 }),
        async (
          membership: number,
          netGrowthTarget: number,
          dcpGoals: number,
          cspSubmitted: boolean,
          month: number
        ) => {
          // Ensure net growth is achievable (can't have net growth > membership with memBase >= 0)
          const netGrowth = Math.min(netGrowthTarget, membership)

          // Skip if net growth < 3 (not in the growth override zone)
          if (netGrowth < 3) {
            return true
          }

          // Calculate memBase to achieve the desired net growth
          // net growth = membership - memBase
          // memBase = membership - netGrowth
          const memBase = membership - netGrowth

          // Create a date string for the given month
          const dateString = `2026-${month.toString().padStart(2, '0')}-15`

          // Create club trend with the generated values
          const clubTrend = createClubTrend(membership, dcpGoals, dateString)

          // Create club data for net growth calculation
          const clubData = createClubData(membership, memBase, cspSubmitted)

          // Call assessClubHealth
          callAssessClubHealth(
            clubHealthModule,
            clubTrend,
            clubData,
            dateString
          )

          // Property: Status should NOT be 'intervention-required' because net growth >= 3
          // (the growth override applies)
          expect(clubTrend.currentStatus).not.toBe('intervention-required')

          // Property: Status should be either 'thriving' or 'vulnerable'
          expect(['thriving', 'vulnerable']).toContain(clubTrend.currentStatus)

          return true
        }
      ),
      { numRuns: 25 } // Optimized for CI/CD timeout compliance
    )
  })

  /**
   * Property 4: Thriving Completeness
   *
   * For any club classified as Thriving, ALL of the following SHALL be true:
   * - Membership requirement met (>= 20 OR net growth >= 3)
   * - DCP checkpoint met (goals >= required for current month)
   * - CSP submitted (or unavailable, which defaults to true)
   *
   * **Validates: Requirements 1.4**
   */
  it('Property 4: Thriving clubs should have all requirements met', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate membership that meets requirement (>= 20)
        fc.integer({ min: 20, max: 50 }),
        // Generate DCP goals that meet checkpoint (we'll use a high value to ensure it passes)
        fc.integer({ min: 5, max: 10 }),
        // Generate membership base (for net growth calculation)
        fc.integer({ min: 0, max: 20 }),
        // CSP submitted (true to ensure requirement is met)
        fc.constant(true),
        // Generate month (1-12)
        fc.integer({ min: 1, max: 12 }),
        async (
          membership: number,
          dcpGoals: number,
          memBase: number,
          cspSubmitted: boolean,
          month: number
        ) => {
          // Create a date string for the given month
          const dateString = `2026-${month.toString().padStart(2, '0')}-15`

          // Create club trend with the generated values
          const clubTrend = createClubTrend(membership, dcpGoals, dateString)

          // Create club data for net growth calculation
          const clubData = createClubData(membership, memBase, cspSubmitted)

          // Call assessClubHealth
          callAssessClubHealth(
            clubHealthModule,
            clubTrend,
            clubData,
            dateString
          )

          // If the club is thriving, verify all requirements are met
          if (clubTrend.currentStatus === 'thriving') {
            // Membership requirement: >= 20 OR net growth >= 3
            const netGrowth = membership - memBase
            const membershipRequirementMet = membership >= 20 || netGrowth >= 3
            expect(membershipRequirementMet).toBe(true)

            // DCP checkpoint requirement
            const requiredCheckpoint = getDCPCheckpoint(month)
            expect(dcpGoals).toBeGreaterThanOrEqual(requiredCheckpoint)

            // Risk factors should be empty for thriving clubs
            expect(clubTrend.riskFactors.length).toBe(0)
          }

          return true
        }
      ),
      { numRuns: 25 } // Optimized for CI/CD timeout compliance
    )
  })

  /**
   * Property 5: API Type Consistency
   *
   * For any club health result, the `currentStatus` field SHALL contain one of
   * the new values ('thriving', 'vulnerable', 'intervention-required').
   *
   * **Validates: Requirements 3.1, 3.3**
   */
  it('Property 5: currentStatus should always be one of the valid new status values', async () => {
    const validStatuses = ['thriving', 'vulnerable', 'intervention-required']

    await fc.assert(
      fc.asyncProperty(
        // Generate any membership (0-100)
        fc.integer({ min: 0, max: 100 }),
        // Generate any DCP goals (0-10)
        fc.integer({ min: 0, max: 10 }),
        // Generate any membership base (0-100)
        fc.integer({ min: 0, max: 100 }),
        // Generate any CSP status
        fc.boolean(),
        // Generate any month (1-12)
        fc.integer({ min: 1, max: 12 }),
        async (
          membership: number,
          dcpGoals: number,
          memBase: number,
          cspSubmitted: boolean,
          month: number
        ) => {
          // Create a date string for the given month
          const dateString = `2026-${month.toString().padStart(2, '0')}-15`

          // Create club trend with the generated values
          const clubTrend = createClubTrend(membership, dcpGoals, dateString)

          // Create club data for net growth calculation
          const clubData = createClubData(membership, memBase, cspSubmitted)

          // Call assessClubHealth
          callAssessClubHealth(
            clubHealthModule,
            clubTrend,
            clubData,
            dateString
          )

          // Property: The status should be one of the valid new status values
          expect(validStatuses).toContain(clubTrend.currentStatus)

          // Property: The status should be a non-empty string
          expect(typeof clubTrend.currentStatus).toBe('string')
          expect(clubTrend.currentStatus.length).toBeGreaterThan(0)

          return true
        }
      ),
      { numRuns: 25 } // Optimized for CI/CD timeout compliance
    )
  })

  /**
   * Property 6: Reason Completeness
   *
   * For any club not classified as Thriving, the `riskFactors` array SHALL contain
   * at least one specific reason explaining why the club is not Thriving.
   *
   * **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
   */
  it('Property 6: Non-thriving clubs should have at least one risk factor explaining why', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate any membership (0-50)
        fc.integer({ min: 0, max: 50 }),
        // Generate any DCP goals (0-10)
        fc.integer({ min: 0, max: 10 }),
        // Generate any membership base (0-50)
        fc.integer({ min: 0, max: 50 }),
        // Generate any CSP status
        fc.boolean(),
        // Generate any month (1-12)
        fc.integer({ min: 1, max: 12 }),
        async (
          membership: number,
          dcpGoals: number,
          memBase: number,
          cspSubmitted: boolean,
          month: number
        ) => {
          // Create a date string for the given month
          const dateString = `2026-${month.toString().padStart(2, '0')}-15`

          // Create club trend with the generated values
          const clubTrend = createClubTrend(membership, dcpGoals, dateString)

          // Create club data for net growth calculation
          const clubData = createClubData(membership, memBase, cspSubmitted)

          // Call assessClubHealth
          callAssessClubHealth(
            clubHealthModule,
            clubTrend,
            clubData,
            dateString
          )

          // Property: If not thriving, there should be at least one risk factor
          if (clubTrend.currentStatus !== 'thriving') {
            expect(clubTrend.riskFactors.length).toBeGreaterThan(0)

            // Each risk factor should be a non-empty string
            for (const factor of clubTrend.riskFactors) {
              expect(typeof factor).toBe('string')
              expect(factor.length).toBeGreaterThan(0)
            }
          }

          return true
        }
      ),
      { numRuns: 25 } // Optimized for CI/CD timeout compliance
    )
  })
})
