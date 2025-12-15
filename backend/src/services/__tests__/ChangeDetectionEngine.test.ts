/**
 * Tests for ChangeDetectionEngine
 */

import { ChangeDetectionEngine } from '../ChangeDetectionEngine'
import type { DistrictStatistics } from '../../types/districts'
import type { ChangeThresholds } from '../../types/reconciliation'

describe('ChangeDetectionEngine', () => {
  let engine: ChangeDetectionEngine

  beforeEach(() => {
    engine = new ChangeDetectionEngine()
  })

  const createMockDistrictStatistics = (overrides: Partial<DistrictStatistics> = {}): DistrictStatistics => ({
    districtId: 'D1',
    asOfDate: '2024-01-31',
    membership: {
      total: 1000,
      change: 50,
      changePercent: 5.0,
      byClub: []
    },
    clubs: {
      total: 50,
      active: 45,
      suspended: 3,
      ineligible: 1,
      low: 1,
      distinguished: 20
    },
    education: {
      totalAwards: 100,
      byType: [],
      topClubs: []
    },
    ...overrides
  })

  const defaultThresholds: ChangeThresholds = {
    membershipPercent: 1.0,
    clubCountAbsolute: 1,
    distinguishedPercent: 2.0
  }

  describe('detectChanges', () => {
    it('should detect no changes when data is identical', () => {
      const cachedData = createMockDistrictStatistics()
      const currentData = createMockDistrictStatistics()

      const changes = engine.detectChanges('D1', cachedData, currentData)

      expect(changes.hasChanges).toBe(false)
      expect(changes.changedFields).toHaveLength(0)
      expect(changes.membershipChange).toBeUndefined()
      expect(changes.clubCountChange).toBeUndefined()
      expect(changes.distinguishedChange).toBeUndefined()
    })

    it('should detect membership changes', () => {
      const cachedData = createMockDistrictStatistics()
      const currentData = createMockDistrictStatistics({
        membership: {
          total: 1050,
          change: 100,
          changePercent: 10.0,
          byClub: []
        }
      })

      const changes = engine.detectChanges('D1', cachedData, currentData)

      expect(changes.hasChanges).toBe(true)
      expect(changes.changedFields).toContain('membership')
      expect(changes.membershipChange).toEqual({
        previous: 1000,
        current: 1050,
        percentChange: 5.0
      })
    })

    it('should detect club count changes', () => {
      const cachedData = createMockDistrictStatistics()
      const currentData = createMockDistrictStatistics({
        clubs: {
          total: 52,
          active: 47,
          suspended: 3,
          ineligible: 1,
          low: 1,
          distinguished: 22
        }
      })

      const changes = engine.detectChanges('D1', cachedData, currentData)

      expect(changes.hasChanges).toBe(true)
      expect(changes.changedFields).toContain('clubCount')
      expect(changes.clubCountChange).toEqual({
        previous: 50,
        current: 52,
        absoluteChange: 2
      })
    })

    it('should detect distinguished club changes', () => {
      const cachedData = createMockDistrictStatistics()
      const currentData = createMockDistrictStatistics({
        clubs: {
          total: 50,
          active: 45,
          suspended: 3,
          ineligible: 1,
          low: 1,
          distinguished: 25
        }
      })

      const changes = engine.detectChanges('D1', cachedData, currentData)

      expect(changes.hasChanges).toBe(true)
      expect(changes.changedFields).toContain('distinguished')
      expect(changes.distinguishedChange).toBeDefined()
      expect(changes.distinguishedChange!.previous.total).toBe(20)
      expect(changes.distinguishedChange!.current.total).toBe(25)
      expect(changes.distinguishedChange!.percentChange).toBe(25.0)
    })

    it('should detect multiple changes simultaneously', () => {
      const cachedData = createMockDistrictStatistics()
      const currentData = createMockDistrictStatistics({
        membership: {
          total: 1100,
          change: 150,
          changePercent: 15.0,
          byClub: []
        },
        clubs: {
          total: 55,
          active: 50,
          suspended: 3,
          ineligible: 1,
          low: 1,
          distinguished: 30
        }
      })

      const changes = engine.detectChanges('D1', cachedData, currentData)

      expect(changes.hasChanges).toBe(true)
      expect(changes.changedFields).toHaveLength(3)
      expect(changes.changedFields).toContain('membership')
      expect(changes.changedFields).toContain('clubCount')
      expect(changes.changedFields).toContain('distinguished')
    })

    it('should handle zero membership base correctly', () => {
      const cachedData = createMockDistrictStatistics({
        membership: { total: 0, change: 0, changePercent: 0, byClub: [] }
      })
      const currentData = createMockDistrictStatistics({
        membership: { total: 100, change: 100, changePercent: 0, byClub: [] }
      })

      const changes = engine.detectChanges('D1', cachedData, currentData)

      expect(changes.hasChanges).toBe(true)
      expect(changes.membershipChange).toEqual({
        previous: 0,
        current: 100,
        percentChange: 0
      })
    })
  })

  describe('isSignificantChange', () => {
    it('should return false for no changes', () => {
      const changes = engine.detectChanges(
        'D1',
        createMockDistrictStatistics(),
        createMockDistrictStatistics()
      )

      const isSignificant = engine.isSignificantChange(changes, defaultThresholds)

      expect(isSignificant).toBe(false)
    })

    it('should detect significant membership changes', () => {
      const cachedData = createMockDistrictStatistics()
      const currentData = createMockDistrictStatistics({
        membership: {
          total: 1020, // 2% increase
          change: 70,
          changePercent: 7.0,
          byClub: []
        }
      })

      const changes = engine.detectChanges('D1', cachedData, currentData)
      const isSignificant = engine.isSignificantChange(changes, defaultThresholds)

      expect(isSignificant).toBe(true)
    })

    it('should detect significant club count changes', () => {
      const cachedData = createMockDistrictStatistics()
      const currentData = createMockDistrictStatistics({
        clubs: {
          total: 52, // +2 clubs
          active: 47,
          suspended: 3,
          ineligible: 1,
          low: 1,
          distinguished: 22
        }
      })

      const changes = engine.detectChanges('D1', cachedData, currentData)
      const isSignificant = engine.isSignificantChange(changes, defaultThresholds)

      expect(isSignificant).toBe(true)
    })

    it('should detect significant distinguished changes', () => {
      const cachedData = createMockDistrictStatistics()
      const currentData = createMockDistrictStatistics({
        clubs: {
          total: 50,
          active: 45,
          suspended: 3,
          ineligible: 1,
          low: 1,
          distinguished: 25 // 25% increase
        }
      })

      const changes = engine.detectChanges('D1', cachedData, currentData)
      const isSignificant = engine.isSignificantChange(changes, defaultThresholds)

      expect(isSignificant).toBe(true)
    })

    it('should not detect insignificant changes', () => {
      const cachedData = createMockDistrictStatistics()
      const currentData = createMockDistrictStatistics({
        membership: {
          total: 1005, // 0.5% increase (below 1% threshold)
          change: 55,
          changePercent: 5.5,
          byClub: []
        }
      })

      const changes = engine.detectChanges('D1', cachedData, currentData)
      const isSignificant = engine.isSignificantChange(changes, defaultThresholds)

      expect(isSignificant).toBe(false)
    })

    it('should use custom thresholds correctly', () => {
      const customThresholds: ChangeThresholds = {
        membershipPercent: 5.0, // Higher threshold
        clubCountAbsolute: 3,   // Higher threshold
        distinguishedPercent: 10.0 // Higher threshold
      }

      const cachedData = createMockDistrictStatistics()
      const currentData = createMockDistrictStatistics({
        membership: {
          total: 1020, // 2% increase (below 5% threshold)
          change: 70,
          changePercent: 7.0,
          byClub: []
        }
      })

      const changes = engine.detectChanges('D1', cachedData, currentData)
      const isSignificant = engine.isSignificantChange(changes, customThresholds)

      expect(isSignificant).toBe(false)
    })
  })

  describe('calculateChangeMetrics', () => {
    it('should calculate metrics for no changes', () => {
      const changes = engine.detectChanges(
        'D1',
        createMockDistrictStatistics(),
        createMockDistrictStatistics()
      )

      const metrics = engine.calculateChangeMetrics(changes)

      expect(metrics.totalChanges).toBe(0)
      expect(metrics.significantChanges).toBe(0)
      expect(metrics.membershipImpact).toBe(0)
      expect(metrics.clubCountImpact).toBe(0)
      expect(metrics.distinguishedImpact).toBe(0)
      expect(metrics.overallSignificance).toBe(0)
    })

    it('should calculate metrics for membership changes', () => {
      const cachedData = createMockDistrictStatistics()
      const currentData = createMockDistrictStatistics({
        membership: {
          total: 1050, // 5% increase
          change: 100,
          changePercent: 10.0,
          byClub: []
        }
      })

      const changes = engine.detectChanges('D1', cachedData, currentData)
      const metrics = engine.calculateChangeMetrics(changes)

      expect(metrics.totalChanges).toBe(1)
      expect(metrics.significantChanges).toBe(1)
      expect(metrics.membershipImpact).toBe(5.0)
      expect(metrics.overallSignificance).toBeCloseTo(2.0, 1) // 5.0 * 0.4 weight
    })

    it('should calculate metrics for club count changes', () => {
      const cachedData = createMockDistrictStatistics()
      const currentData = createMockDistrictStatistics({
        clubs: {
          total: 55, // +5 clubs (10% increase)
          active: 50,
          suspended: 3,
          ineligible: 1,
          low: 1,
          distinguished: 25
        }
      })

      const changes = engine.detectChanges('D1', cachedData, currentData)
      const metrics = engine.calculateChangeMetrics(changes)

      expect(metrics.totalChanges).toBe(2) // clubCount and distinguished
      expect(metrics.significantChanges).toBe(2)
      expect(metrics.clubCountImpact).toBe(10.0) // 5/50 * 100
    })

    it('should calculate comprehensive metrics for multiple changes', () => {
      const cachedData = createMockDistrictStatistics()
      const currentData = createMockDistrictStatistics({
        membership: {
          total: 1100, // 10% increase
          change: 150,
          changePercent: 15.0,
          byClub: []
        },
        clubs: {
          total: 60, // +10 clubs (20% increase)
          active: 55,
          suspended: 3,
          ineligible: 1,
          low: 1,
          distinguished: 35 // +15 clubs (75% increase)
        }
      })

      const changes = engine.detectChanges('D1', cachedData, currentData)
      const metrics = engine.calculateChangeMetrics(changes)

      expect(metrics.totalChanges).toBe(3)
      expect(metrics.significantChanges).toBe(3)
      expect(metrics.membershipImpact).toBe(10.0)
      expect(metrics.clubCountImpact).toBe(20.0)
      expect(metrics.distinguishedImpact).toBe(75.0)
      
      // Weighted average: 10*0.4 + 20*0.3 + 75*0.3 = 4 + 6 + 22.5 = 32.5
      expect(metrics.overallSignificance).toBeCloseTo(32.5, 1)
    })

    it('should handle zero base values correctly', () => {
      const cachedData = createMockDistrictStatistics({
        clubs: { total: 0, active: 0, suspended: 0, ineligible: 0, low: 0, distinguished: 0 }
      })
      const currentData = createMockDistrictStatistics({
        clubs: { total: 5, active: 5, suspended: 0, ineligible: 0, low: 0, distinguished: 2 }
      })

      const changes = engine.detectChanges('D1', cachedData, currentData)
      const metrics = engine.calculateChangeMetrics(changes)

      expect(metrics.totalChanges).toBe(2)
      expect(metrics.clubCountImpact).toBe(50) // 5 * 10 (arbitrary scaling)
    })
  })

  describe('edge cases', () => {
    it('should handle negative changes correctly', () => {
      const cachedData = createMockDistrictStatistics()
      const currentData = createMockDistrictStatistics({
        membership: {
          total: 900, // 10% decrease
          change: -50,
          changePercent: -5.0,
          byClub: []
        },
        clubs: {
          total: 45, // -5 clubs
          active: 40,
          suspended: 3,
          ineligible: 1,
          low: 1,
          distinguished: 15 // -5 clubs
        }
      })

      const changes = engine.detectChanges('D1', cachedData, currentData)
      const isSignificant = engine.isSignificantChange(changes, defaultThresholds)

      expect(changes.hasChanges).toBe(true)
      expect(changes.membershipChange!.percentChange).toBe(-10.0)
      expect(changes.clubCountChange!.absoluteChange).toBe(-5)
      expect(isSignificant).toBe(true) // Absolute values should be used for significance
    })

    it('should handle very small changes correctly', () => {
      const cachedData = createMockDistrictStatistics()
      const currentData = createMockDistrictStatistics({
        membership: {
          total: 1001, // 0.1% increase
          change: 51,
          changePercent: 5.1,
          byClub: []
        }
      })

      const changes = engine.detectChanges('D1', cachedData, currentData)
      const isSignificant = engine.isSignificantChange(changes, defaultThresholds)

      expect(changes.hasChanges).toBe(true)
      expect(changes.membershipChange!.percentChange).toBe(0.1)
      expect(isSignificant).toBe(false) // Below 1% threshold
    })
  })
})