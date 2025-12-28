/**
 * Property-Based Tests for ChangeDetectionEngine
 *
 * **Feature: month-end-data-reconciliation, Property 3: Change Detection Accuracy**
 * **Validates: Requirements 2.2, 6.2**
 */

import { describe, it, expect } from 'vitest'
import { ChangeDetectionEngine } from '../ChangeDetectionEngine'
import type { DistrictStatistics } from '../../types/districts'
import type { ChangeThresholds } from '../../types/reconciliation'

describe('ChangeDetectionEngine - Property-Based Tests', () => {
  const engine = new ChangeDetectionEngine()

  // Property test generators using deterministic seeding
  const generateDistrictStatistics = (
    seed: number = 0.5
  ): DistrictStatistics => {
    const membershipTotal = Math.floor(seed * 5000) + 100 // 100-5100 members
    const clubsTotal = Math.floor(seed * 100) + 10 // 10-110 clubs
    const distinguishedCount = Math.floor(seed * clubsTotal * 0.8) // 0-80% of clubs

    return {
      districtId: `D${Math.floor(seed * 100)}`,
      asOfDate: new Date(2024, 0, Math.floor(seed * 28) + 1)
        .toISOString()
        .split('T')[0],
      membership: {
        total: membershipTotal,
        change: Math.floor((seed - 0.5) * 200), // -100 to +100 change
        changePercent: (seed - 0.5) * 20, // -10% to +10%
        byClub: [],
      },
      clubs: {
        total: clubsTotal,
        active: Math.floor(clubsTotal * (0.7 + seed * 0.25)), // 70-95% active
        suspended: Math.floor(clubsTotal * seed * 0.1), // 0-10% suspended
        ineligible: Math.floor(clubsTotal * seed * 0.05), // 0-5% ineligible
        low: Math.floor(clubsTotal * seed * 0.05), // 0-5% low
        distinguished: distinguishedCount,
      },
      education: {
        totalAwards: Math.floor(seed * 500),
        byType: [],
        topClubs: [],
      },
    }
  }

  const generateThresholds = (seed: number = 0.5): ChangeThresholds => ({
    membershipPercent: seed * 5 + 0.5, // 0.5% to 5.5%
    clubCountAbsolute: Math.floor(seed * 5) + 1, // 1 to 5 clubs
    distinguishedPercent: seed * 10 + 1, // 1% to 11%
  })

  /**
   * Property 3: Change Detection Accuracy
   * For any comparison between cached and current dashboard data,
   * the system should correctly identify all significant changes based on configured thresholds
   */
  describe('Property 3: Change Detection Accuracy', () => {
    it('should correctly identify when no changes exist', () => {
      // Generate 50 test cases
      for (let i = 0; i < 50; i++) {
        const seed = i / 50
        const data = generateDistrictStatistics(seed)
        const identicalData = JSON.parse(JSON.stringify(data)) // Deep copy

        const changes = engine.detectChanges('test', data, identicalData)

        // Property: Identical data should never show changes
        expect(changes.hasChanges).toBe(false)
        expect(changes.changedFields).toHaveLength(0)
        expect(changes.membershipChange).toBeUndefined()
        expect(changes.clubCountChange).toBeUndefined()
        expect(changes.distinguishedChange).toBeUndefined()
      }
    })

    it('should detect membership changes accurately', () => {
      // Generate 50 test cases
      for (let i = 0; i < 50; i++) {
        const seed = i / 50
        const cachedData = generateDistrictStatistics(seed)
        const currentData = generateDistrictStatistics(seed + 0.1) // Different seed for changes

        // Ensure membership is actually different
        if (cachedData.membership.total !== currentData.membership.total) {
          const changes = engine.detectChanges('test', cachedData, currentData)

          // Property: When membership totals differ, changes should be detected
          expect(changes.hasChanges).toBe(true)
          expect(changes.changedFields).toContain('membership')
          expect(changes.membershipChange).toBeDefined()
          expect(changes.membershipChange!.previous).toBe(
            cachedData.membership.total
          )
          expect(changes.membershipChange!.current).toBe(
            currentData.membership.total
          )

          // Property: Percentage change should be calculated correctly
          const expectedPercent =
            cachedData.membership.total > 0
              ? ((currentData.membership.total - cachedData.membership.total) /
                  cachedData.membership.total) *
                100
              : 0
          expect(changes.membershipChange!.percentChange).toBeCloseTo(
            expectedPercent,
            1
          )
        }
      }
    })

    it('should detect club count changes accurately', () => {
      // Generate 50 test cases
      for (let i = 0; i < 50; i++) {
        const seed = i / 50
        const cachedData = generateDistrictStatistics(seed)
        const currentData = generateDistrictStatistics(seed + 0.2) // Different seed for changes

        // Ensure club count is actually different
        if (cachedData.clubs.total !== currentData.clubs.total) {
          const changes = engine.detectChanges('test', cachedData, currentData)

          // Property: When club totals differ, changes should be detected
          expect(changes.hasChanges).toBe(true)
          expect(changes.changedFields).toContain('clubCount')
          expect(changes.clubCountChange).toBeDefined()
          expect(changes.clubCountChange!.previous).toBe(cachedData.clubs.total)
          expect(changes.clubCountChange!.current).toBe(currentData.clubs.total)
          expect(changes.clubCountChange!.absoluteChange).toBe(
            currentData.clubs.total - cachedData.clubs.total
          )
        }
      }
    })

    it('should detect distinguished club changes accurately', () => {
      // Generate 50 test cases
      for (let i = 0; i < 50; i++) {
        const seed = i / 50
        const cachedData = generateDistrictStatistics(seed)
        const currentData = generateDistrictStatistics(seed + 0.3) // Different seed for changes

        // Ensure distinguished count is actually different
        if (
          cachedData.clubs.distinguished !== currentData.clubs.distinguished
        ) {
          const changes = engine.detectChanges('test', cachedData, currentData)

          // Property: When distinguished totals differ, changes should be detected
          expect(changes.hasChanges).toBe(true)
          expect(changes.changedFields).toContain('distinguished')
          expect(changes.distinguishedChange).toBeDefined()
          expect(changes.distinguishedChange!.previous.total).toBe(
            cachedData.clubs.distinguished
          )
          expect(changes.distinguishedChange!.current.total).toBe(
            currentData.clubs.distinguished
          )

          // Property: Percentage change should be calculated correctly
          const expectedPercent =
            cachedData.clubs.distinguished > 0
              ? ((currentData.clubs.distinguished -
                  cachedData.clubs.distinguished) /
                  cachedData.clubs.distinguished) *
                100
              : 0
          expect(changes.distinguishedChange!.percentChange).toBeCloseTo(
            expectedPercent,
            1
          )
        }
      }
    })

    it('should apply significance thresholds correctly', () => {
      // Generate 30 test cases with various thresholds
      for (let i = 0; i < 30; i++) {
        const seed = i / 30
        const thresholds = generateThresholds(seed)

        // Create data with known percentage changes
        const cachedData = generateDistrictStatistics(seed)
        const membershipChange = (thresholds.membershipPercent + 1) / 100 // Slightly above threshold
        const currentData: DistrictStatistics = {
          ...cachedData,
          membership: {
            ...cachedData.membership,
            total: Math.floor(
              cachedData.membership.total * (1 + membershipChange)
            ),
          },
        }

        const changes = engine.detectChanges('test', cachedData, currentData)
        const isSignificant = engine.isSignificantChange(changes, thresholds)

        // Property: Changes above threshold should be significant
        if (
          changes.membershipChange &&
          Math.abs(changes.membershipChange.percentChange) >
            thresholds.membershipPercent
        ) {
          expect(isSignificant).toBe(true)
        }
      }
    })

    it('should calculate change metrics consistently', () => {
      // Generate 40 test cases
      for (let i = 0; i < 40; i++) {
        const seed = i / 40
        const cachedData = generateDistrictStatistics(seed)
        const currentData = generateDistrictStatistics(seed + 0.4) // Different seed for changes

        const changes = engine.detectChanges('test', cachedData, currentData)
        const metrics = engine.calculateChangeMetrics(changes)

        // Property: Total changes should match changed fields count
        expect(metrics.totalChanges).toBe(changes.changedFields.length)

        // Property: Metrics should be non-negative
        expect(metrics.membershipImpact).toBeGreaterThanOrEqual(0)
        expect(metrics.clubCountImpact).toBeGreaterThanOrEqual(0)
        expect(metrics.distinguishedImpact).toBeGreaterThanOrEqual(0)
        expect(metrics.overallSignificance).toBeGreaterThanOrEqual(0)

        // Property: Significant changes count should not exceed total changes
        expect(metrics.significantChanges).toBeLessThanOrEqual(
          metrics.totalChanges
        )

        // Property: If no changes, all metrics should be zero
        if (!changes.hasChanges) {
          expect(metrics.totalChanges).toBe(0)
          expect(metrics.significantChanges).toBe(0)
          expect(metrics.membershipImpact).toBe(0)
          expect(metrics.clubCountImpact).toBe(0)
          expect(metrics.distinguishedImpact).toBe(0)
          expect(metrics.overallSignificance).toBe(0)
        }
      }
    })

    it('should handle edge cases consistently', () => {
      // Test with zero values
      const zeroData: DistrictStatistics = {
        districtId: 'D0',
        asOfDate: '2024-01-01',
        membership: { total: 0, change: 0, changePercent: 0, byClub: [] },
        clubs: {
          total: 0,
          active: 0,
          suspended: 0,
          ineligible: 0,
          low: 0,
          distinguished: 0,
        },
        education: { totalAwards: 0, byType: [], topClubs: [] },
      }

      // Generate 20 test cases with non-zero data
      for (let i = 0; i < 20; i++) {
        const seed = (i + 1) / 20 // Avoid zero seed
        const nonZeroData = generateDistrictStatistics(seed)

        const changes = engine.detectChanges('test', zeroData, nonZeroData)

        // Property: Changes from zero should be detected
        expect(changes.hasChanges).toBe(true)

        // Property: Percentage changes from zero base should be handled gracefully
        if (changes.membershipChange) {
          expect(changes.membershipChange.percentChange).toBe(0) // Zero base case
        }

        const metrics = engine.calculateChangeMetrics(changes)

        // Property: Metrics should still be calculable
        expect(metrics.totalChanges).toBeGreaterThan(0)
        expect(metrics.overallSignificance).toBeGreaterThanOrEqual(0)
      }
    })

    it('should be symmetric for equivalent changes', () => {
      // Generate 25 test cases
      for (let i = 0; i < 25; i++) {
        const seed = i / 25
        const baseData = generateDistrictStatistics(seed)

        // Create two datasets with equivalent but opposite changes
        const data1 = { ...baseData }
        const data2 = {
          ...baseData,
          membership: {
            ...baseData.membership,
            total: baseData.membership.total + 100,
          },
        }
        const data3 = {
          ...baseData,
          membership: {
            ...baseData.membership,
            total: baseData.membership.total - 100,
          },
        }

        const changes1to2 = engine.detectChanges('test', data1, data2)
        const changes1to3 = engine.detectChanges('test', data1, data3)

        // Property: Equivalent magnitude changes should have same significance
        const thresholds = generateThresholds(seed)
        const sig1to2 = engine.isSignificantChange(changes1to2, thresholds)
        const sig1to3 = engine.isSignificantChange(changes1to3, thresholds)

        expect(sig1to2).toBe(sig1to3) // Same significance for equivalent magnitude changes

        // Property: Absolute percentage changes should be equal
        if (changes1to2.membershipChange && changes1to3.membershipChange) {
          expect(
            Math.abs(changes1to2.membershipChange.percentChange)
          ).toBeCloseTo(Math.abs(changes1to3.membershipChange.percentChange), 1)
        }
      }
    })
  })
})
