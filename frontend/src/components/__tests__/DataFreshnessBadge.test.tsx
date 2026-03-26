/**
 * Tests for DataFreshnessBadge (#213)
 */
import { describe, it, expect } from 'vitest'
import { relativeTime, freshnessColor } from '../../utils/dataFreshness'

describe('DataFreshnessBadge helpers', () => {
  describe('relativeTime', () => {
    it('returns "just now" for timestamps less than a minute old', () => {
      const now = new Date().toISOString()
      expect(relativeTime(now)).toBe('just now')
    })

    it('returns minutes for timestamps <60 minutes old', () => {
      const thirtyMinAgo = new Date(Date.now() - 30 * 60_000).toISOString()
      expect(relativeTime(thirtyMinAgo)).toBe('30m ago')
    })

    it('returns hours for timestamps <24 hours old', () => {
      const threeHoursAgo = new Date(Date.now() - 3 * 3_600_000).toISOString()
      expect(relativeTime(threeHoursAgo)).toBe('3h ago')
    })

    it('returns days for timestamps <7 days old', () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString()
      expect(relativeTime(twoDaysAgo)).toBe('2d ago')
    })

    it('returns weeks for timestamps ≥7 days old', () => {
      const fourteenDaysAgo = new Date(
        Date.now() - 14 * 86_400_000
      ).toISOString()
      expect(relativeTime(fourteenDaysAgo)).toBe('2w ago')
    })
  })

  describe('freshnessColor', () => {
    it('returns green for data <24h old', () => {
      const recent = new Date(Date.now() - 2 * 3_600_000).toISOString()
      const result = freshnessColor(recent)
      expect(result.dot).toBe('#22c55e')
      expect(result.label).toBe('Fresh')
    })

    it('returns yellow for data 24-48h old', () => {
      const aging = new Date(Date.now() - 30 * 3_600_000).toISOString()
      const result = freshnessColor(aging)
      expect(result.dot).toBe('#eab308')
      expect(result.label).toBe('Aging')
    })

    it('returns red for data >48h old', () => {
      const stale = new Date(Date.now() - 72 * 3_600_000).toISOString()
      const result = freshnessColor(stale)
      expect(result.dot).toBe('#ef4444')
      expect(result.label).toBe('Stale')
    })
  })
})
