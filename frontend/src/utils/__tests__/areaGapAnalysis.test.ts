/**
 * Area Gap Analysis Unit Tests
 *
 * Unit tests for area gap analysis calculation focusing on boundary conditions,
 * edge cases, and recognition level classification.
 *
 * Requirements: 5.4, 5.5, 5.6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */

import { describe, it, expect } from 'vitest'
import {
  calculatePaidClubsGap,
  calculatePaidClubsPercentage,
  calculateDistinguishedPercentage,
  determineRecognitionLevel,
  calculateAreaGapAnalysis,
  type AreaMetrics,
} from '../areaGapAnalysis'

describe('calculatePaidClubsGap', () => {
  /**
   * Property 6: Paid Clubs Gap = max(0, Math.ceil(clubBase * 0.75) - paidClubs)
   * Requirements: 6.1
   */

  describe('basic gap calculations', () => {
    it('should calculate gap when below 75% threshold (4 clubs, 2 paid → needs 1)', () => {
      // 75% of 4 = 3, have 2, need 1 more
      const gap = calculatePaidClubsGap(4, 2)
      expect(gap).toBe(1)
    })

    it('should return 0 when threshold is met (4 clubs, 3 paid)', () => {
      // 75% of 4 = 3, have 3, need 0
      const gap = calculatePaidClubsGap(4, 3)
      expect(gap).toBe(0)
    })

    it('should return 0 when threshold is exceeded (4 clubs, 4 paid)', () => {
      // 75% of 4 = 3, have 4, need 0
      const gap = calculatePaidClubsGap(4, 4)
      expect(gap).toBe(0)
    })

    it('should handle rounding up correctly (5 clubs needs 4 paid)', () => {
      // 75% of 5 = 3.75, ceil = 4
      const gap = calculatePaidClubsGap(5, 3)
      expect(gap).toBe(1)
    })

    it('should handle larger club bases (10 clubs, 5 paid → needs 3)', () => {
      // 75% of 10 = 7.5, ceil = 8, have 5, need 3
      const gap = calculatePaidClubsGap(10, 5)
      expect(gap).toBe(3)
    })
  })

  describe('edge cases', () => {
    it('should return 0 when clubBase is 0', () => {
      const gap = calculatePaidClubsGap(0, 0)
      expect(gap).toBe(0)
    })

    it('should handle 1 club (needs 1 paid)', () => {
      // 75% of 1 = 0.75, ceil = 1
      const gap = calculatePaidClubsGap(1, 0)
      expect(gap).toBe(1)
    })

    it('should return 0 when 1 club is paid', () => {
      const gap = calculatePaidClubsGap(1, 1)
      expect(gap).toBe(0)
    })
  })
})

describe('calculatePaidClubsPercentage', () => {
  /**
   * Property 3: Paid Clubs Percentage = Math.round((paidClubs / clubBase) * 100)
   * Requirements: 5.4
   */

  it('should calculate 50% correctly', () => {
    expect(calculatePaidClubsPercentage(4, 2)).toBe(50)
  })

  it('should calculate 75% correctly', () => {
    expect(calculatePaidClubsPercentage(4, 3)).toBe(75)
  })

  it('should calculate 100% correctly', () => {
    expect(calculatePaidClubsPercentage(4, 4)).toBe(100)
  })

  it('should return 0 when clubBase is 0', () => {
    expect(calculatePaidClubsPercentage(0, 0)).toBe(0)
  })

  it('should round to nearest integer', () => {
    // 1/3 = 33.33...% → 33%
    expect(calculatePaidClubsPercentage(3, 1)).toBe(33)
    // 2/3 = 66.66...% → 67%
    expect(calculatePaidClubsPercentage(3, 2)).toBe(67)
  })
})

describe('calculateDistinguishedPercentage', () => {
  /**
   * Property 4: Distinguished Clubs Percentage = Math.round((distinguishedClubs / paidClubs) * 100)
   * When paidClubs = 0, percentage should be 0
   * Requirements: 5.5
   */

  it('should calculate 50% correctly', () => {
    expect(calculateDistinguishedPercentage(4, 2)).toBe(50)
  })

  it('should calculate 75% correctly', () => {
    expect(calculateDistinguishedPercentage(4, 3)).toBe(75)
  })

  it('should calculate 100% correctly', () => {
    expect(calculateDistinguishedPercentage(4, 4)).toBe(100)
  })

  it('should return 0 when paidClubs is 0', () => {
    expect(calculateDistinguishedPercentage(0, 0)).toBe(0)
  })

  it('should round to nearest integer', () => {
    // 1/3 = 33.33...% → 33%
    expect(calculateDistinguishedPercentage(3, 1)).toBe(33)
    // 2/3 = 66.66...% → 67%
    expect(calculateDistinguishedPercentage(3, 2)).toBe(67)
  })
})

describe('determineRecognitionLevel', () => {
  /**
   * Property 5: Recognition Level Classification
   * - If paidClubs/clubBase < 0.75: "none" (paid threshold not met)
   * - Else if distinguishedClubs/paidClubs >= 1.0: "presidents"
   * - Else if distinguishedClubs/paidClubs >= 0.75: "select"
   * - Else if distinguishedClubs/paidClubs >= 0.50: "distinguished"
   * - Else: "none"
   * Requirements: 5.6, 6.5
   */

  describe('paid threshold not met', () => {
    it('should return "none" when below 75% paid threshold', () => {
      // 2/4 = 50% paid, below 75% threshold
      const level = determineRecognitionLevel({
        clubBase: 4,
        paidClubs: 2,
        distinguishedClubs: 2, // Even if all paid are distinguished
      })
      expect(level).toBe('none')
    })

    it('should return "none" when exactly at 74% paid (just below threshold)', () => {
      // 74/100 = 74% paid, just below 75%
      const level = determineRecognitionLevel({
        clubBase: 100,
        paidClubs: 74,
        distinguishedClubs: 74,
      })
      expect(level).toBe('none')
    })
  })

  describe('recognition levels when paid threshold is met', () => {
    it('should return "distinguished" when at 50% distinguished', () => {
      // 4 clubs, 3 paid (75%), 2 distinguished (67% of paid)
      // Wait, 2/3 = 67%, which is >= 50% but < 75%
      const level = determineRecognitionLevel({
        clubBase: 4,
        paidClubs: 3,
        distinguishedClubs: 2,
      })
      expect(level).toBe('distinguished')
    })

    it('should return "distinguished" when exactly at 50% distinguished', () => {
      // 4 clubs, 4 paid (100%), 2 distinguished (50% of paid)
      const level = determineRecognitionLevel({
        clubBase: 4,
        paidClubs: 4,
        distinguishedClubs: 2,
      })
      expect(level).toBe('distinguished')
    })

    it('should return "select" when at 75% distinguished', () => {
      // 4 clubs, 4 paid (100%), 3 distinguished (75% of paid)
      const level = determineRecognitionLevel({
        clubBase: 4,
        paidClubs: 4,
        distinguishedClubs: 3,
      })
      expect(level).toBe('select')
    })

    it('should return "presidents" when at 100% distinguished', () => {
      // 4 clubs, 4 paid (100%), 4 distinguished (100% of paid)
      const level = determineRecognitionLevel({
        clubBase: 4,
        paidClubs: 4,
        distinguishedClubs: 4,
      })
      expect(level).toBe('presidents')
    })

    it('should return "none" when below 50% distinguished', () => {
      // 4 clubs, 4 paid (100%), 1 distinguished (25% of paid)
      const level = determineRecognitionLevel({
        clubBase: 4,
        paidClubs: 4,
        distinguishedClubs: 1,
      })
      expect(level).toBe('none')
    })
  })

  describe('edge cases', () => {
    it('should return "none" when clubBase is 0', () => {
      const level = determineRecognitionLevel({
        clubBase: 0,
        paidClubs: 0,
        distinguishedClubs: 0,
      })
      expect(level).toBe('none')
    })

    it('should return "none" when paidClubs is 0 (even if threshold met)', () => {
      // This is a degenerate case - 0 paid clubs can't meet 75% threshold
      const level = determineRecognitionLevel({
        clubBase: 4,
        paidClubs: 0,
        distinguishedClubs: 0,
      })
      expect(level).toBe('none')
    })

    it('should handle 1 club area correctly', () => {
      // 1 club, 1 paid (100%), 1 distinguished (100%)
      const level = determineRecognitionLevel({
        clubBase: 1,
        paidClubs: 1,
        distinguishedClubs: 1,
      })
      expect(level).toBe('presidents')
    })

    it('should handle 1 club area with no distinguished', () => {
      // 1 club, 1 paid (100%), 0 distinguished (0%)
      const level = determineRecognitionLevel({
        clubBase: 1,
        paidClubs: 1,
        distinguishedClubs: 0,
      })
      expect(level).toBe('none')
    })
  })

  describe('boundary conditions', () => {
    it('should return "distinguished" at exactly 50% (boundary)', () => {
      // 10 clubs, 8 paid (80%), 4 distinguished (50% of paid)
      const level = determineRecognitionLevel({
        clubBase: 10,
        paidClubs: 8,
        distinguishedClubs: 4,
      })
      expect(level).toBe('distinguished')
    })

    it('should return "select" at exactly 75% (boundary)', () => {
      // 8 clubs, 8 paid (100%), 6 distinguished (75% of paid)
      const level = determineRecognitionLevel({
        clubBase: 8,
        paidClubs: 8,
        distinguishedClubs: 6,
      })
      expect(level).toBe('select')
    })

    it('should return "presidents" at exactly 100% (boundary)', () => {
      // 8 clubs, 8 paid (100%), 8 distinguished (100% of paid)
      const level = determineRecognitionLevel({
        clubBase: 8,
        paidClubs: 8,
        distinguishedClubs: 8,
      })
      expect(level).toBe('presidents')
    })

    it('should return "none" at 49% distinguished (just below threshold)', () => {
      // 100 clubs, 100 paid (100%), 49 distinguished (49% of paid)
      const level = determineRecognitionLevel({
        clubBase: 100,
        paidClubs: 100,
        distinguishedClubs: 49,
      })
      expect(level).toBe('none')
    })
  })
})

describe('calculateAreaGapAnalysis', () => {
  /**
   * Complete gap analysis tests covering:
   * - Property 6: Paid Clubs Gap
   * - Property 7: Distinguished Clubs Gaps
   * - Property 8: Paid Threshold Blocker
   * Requirements: 5.4, 5.5, 5.6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
   */

  describe('paid clubs gap (Property 6)', () => {
    it('should calculate paid clubs gap correctly (4 clubs, 2 paid → needs 1)', () => {
      const analysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 2,
        distinguishedClubs: 0,
      })
      expect(analysis.paidClubsNeeded).toBe(1)
      expect(analysis.meetsPaidThreshold).toBe(false)
    })

    it('should return 0 paid clubs needed when threshold met (4 clubs, 3 paid)', () => {
      const analysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 3,
        distinguishedClubs: 0,
      })
      expect(analysis.paidClubsNeeded).toBe(0)
      expect(analysis.meetsPaidThreshold).toBe(true)
    })
  })

  describe('distinguished gaps (Property 7)', () => {
    it('should calculate Distinguished gap (4 paid clubs, 1 distinguished → needs 1)', () => {
      // 50% of 4 = 2, have 1, need 1
      const analysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 4,
        distinguishedClubs: 1,
      })
      expect(analysis.distinguishedGap.clubsNeeded).toBe(1)
      expect(analysis.distinguishedGap.achieved).toBe(false)
      expect(analysis.distinguishedGap.achievable).toBe(true)
    })

    it('should calculate Select gap (4 paid clubs, 2 distinguished → needs 1)', () => {
      // 75% of 4 = 3, have 2, need 1
      const analysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 4,
        distinguishedClubs: 2,
      })
      expect(analysis.selectGap.clubsNeeded).toBe(1)
      expect(analysis.selectGap.achieved).toBe(false)
      expect(analysis.selectGap.achievable).toBe(true)
    })

    it('should calculate Presidents gap (4 paid clubs, 3 distinguished → needs 1)', () => {
      // 100% of 4 = 4, have 3, need 1
      const analysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 4,
        distinguishedClubs: 3,
      })
      expect(analysis.presidentsGap.clubsNeeded).toBe(1)
      expect(analysis.presidentsGap.achieved).toBe(false)
      expect(analysis.presidentsGap.achievable).toBe(true)
    })

    it('should show Distinguished as achieved when at 50%', () => {
      const analysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 4,
        distinguishedClubs: 2,
      })
      expect(analysis.distinguishedGap.achieved).toBe(true)
      expect(analysis.distinguishedGap.clubsNeeded).toBe(0)
    })

    it('should show Select as achieved when at 75%', () => {
      const analysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 4,
        distinguishedClubs: 3,
      })
      expect(analysis.selectGap.achieved).toBe(true)
      expect(analysis.selectGap.clubsNeeded).toBe(0)
    })

    it('should show Presidents as achieved when at 100%', () => {
      const analysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 4,
        distinguishedClubs: 4,
      })
      expect(analysis.presidentsGap.achieved).toBe(true)
      expect(analysis.presidentsGap.clubsNeeded).toBe(0)
    })
  })

  describe('paid threshold blocker (Property 8)', () => {
    it('should mark all levels as not achievable when paid threshold not met', () => {
      const analysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 2, // 50%, below 75% threshold
        distinguishedClubs: 2,
      })

      expect(analysis.meetsPaidThreshold).toBe(false)
      expect(analysis.distinguishedGap.achievable).toBe(false)
      expect(analysis.selectGap.achievable).toBe(false)
      expect(analysis.presidentsGap.achievable).toBe(false)
    })

    it('should show clubsNeeded as 0 when not achievable (paid threshold not met)', () => {
      const analysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 2,
        distinguishedClubs: 0,
      })

      // When not achievable, clubsNeeded should be 0 (not meaningful)
      expect(analysis.distinguishedGap.clubsNeeded).toBe(0)
      expect(analysis.selectGap.clubsNeeded).toBe(0)
      expect(analysis.presidentsGap.clubsNeeded).toBe(0)
    })
  })

  describe('recognition level classification', () => {
    it('should classify as "none" when below paid threshold', () => {
      const analysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 2,
        distinguishedClubs: 2,
      })
      expect(analysis.currentLevel).toBe('none')
    })

    it('should classify as "distinguished" at 50% distinguished', () => {
      const analysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 4,
        distinguishedClubs: 2,
      })
      expect(analysis.currentLevel).toBe('distinguished')
    })

    it('should classify as "select" at 75% distinguished', () => {
      const analysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 4,
        distinguishedClubs: 3,
      })
      expect(analysis.currentLevel).toBe('select')
    })

    it('should classify as "presidents" at 100% distinguished', () => {
      const analysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 4,
        distinguishedClubs: 4,
      })
      expect(analysis.currentLevel).toBe('presidents')
    })
  })

  describe('edge cases', () => {
    it('should handle area with 0 clubs', () => {
      const analysis = calculateAreaGapAnalysis({
        clubBase: 0,
        paidClubs: 0,
        distinguishedClubs: 0,
      })

      expect(analysis.currentLevel).toBe('none')
      expect(analysis.meetsPaidThreshold).toBe(false)
      expect(analysis.paidClubsNeeded).toBe(0)
      expect(analysis.distinguishedGap.achievable).toBe(false)
      expect(analysis.selectGap.achievable).toBe(false)
      expect(analysis.presidentsGap.achievable).toBe(false)
    })

    it('should handle area with 0 paid clubs', () => {
      const analysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 0,
        distinguishedClubs: 0,
      })

      expect(analysis.currentLevel).toBe('none')
      expect(analysis.meetsPaidThreshold).toBe(false)
      expect(analysis.paidClubsNeeded).toBe(3) // Need 3 paid clubs (75% of 4)
    })

    it('should handle area with 1 club (minimum case)', () => {
      // 1 club, 1 paid (100%), 1 distinguished (100%)
      const analysis = calculateAreaGapAnalysis({
        clubBase: 1,
        paidClubs: 1,
        distinguishedClubs: 1,
      })

      expect(analysis.currentLevel).toBe('presidents')
      expect(analysis.meetsPaidThreshold).toBe(true)
      expect(analysis.paidClubsNeeded).toBe(0)
      expect(analysis.presidentsGap.achieved).toBe(true)
    })

    it('should handle area with 1 club, 0 distinguished', () => {
      const analysis = calculateAreaGapAnalysis({
        clubBase: 1,
        paidClubs: 1,
        distinguishedClubs: 0,
      })

      expect(analysis.currentLevel).toBe('none')
      expect(analysis.meetsPaidThreshold).toBe(true)
      expect(analysis.distinguishedGap.clubsNeeded).toBe(1)
      expect(analysis.selectGap.clubsNeeded).toBe(1)
      expect(analysis.presidentsGap.clubsNeeded).toBe(1)
    })
  })

  describe('boundary values', () => {
    it('should handle exactly 75% paid threshold', () => {
      // 4 clubs, 3 paid = 75% exactly
      const analysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 3,
        distinguishedClubs: 0,
      })

      expect(analysis.meetsPaidThreshold).toBe(true)
      expect(analysis.paidClubsNeeded).toBe(0)
    })

    it('should handle just below 75% paid threshold', () => {
      // 100 clubs, 74 paid = 74%
      const analysis = calculateAreaGapAnalysis({
        clubBase: 100,
        paidClubs: 74,
        distinguishedClubs: 74,
      })

      expect(analysis.meetsPaidThreshold).toBe(false)
      expect(analysis.paidClubsNeeded).toBe(1) // Need 75 paid clubs
    })

    it('should handle exactly 50% distinguished threshold', () => {
      // 4 paid clubs, 2 distinguished = 50%
      const analysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 4,
        distinguishedClubs: 2,
      })

      expect(analysis.currentLevel).toBe('distinguished')
      expect(analysis.distinguishedGap.achieved).toBe(true)
    })

    it('should handle just below 50% distinguished threshold', () => {
      // 100 paid clubs, 49 distinguished = 49%
      const analysis = calculateAreaGapAnalysis({
        clubBase: 100,
        paidClubs: 100,
        distinguishedClubs: 49,
      })

      expect(analysis.currentLevel).toBe('none')
      expect(analysis.distinguishedGap.achieved).toBe(false)
      expect(analysis.distinguishedGap.clubsNeeded).toBe(1) // Need 50 distinguished
    })
  })

  describe('complete scenario tests from design document', () => {
    it('scenario: area with 4 clubs, 3 paid, 2 distinguished', () => {
      const analysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 3,
        distinguishedClubs: 2,
      })

      // 3/4 = 75% paid (threshold met)
      expect(analysis.meetsPaidThreshold).toBe(true)
      expect(analysis.paidClubsNeeded).toBe(0)

      // 2/3 = 67% distinguished (above 50%, below 75%)
      expect(analysis.currentLevel).toBe('distinguished')

      // Distinguished gap: ceil(3 * 0.5) = 2, have 2, need 0
      expect(analysis.distinguishedGap.achieved).toBe(true)
      expect(analysis.distinguishedGap.clubsNeeded).toBe(0)

      // Select gap: ceil(3 * 0.75) = 3, have 2, need 1
      expect(analysis.selectGap.achieved).toBe(false)
      expect(analysis.selectGap.clubsNeeded).toBe(1)

      // Presidents gap: 3, have 2, need 1
      expect(analysis.presidentsGap.achieved).toBe(false)
      expect(analysis.presidentsGap.clubsNeeded).toBe(1)
    })

    it('scenario: area below paid threshold', () => {
      const analysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 2,
        distinguishedClubs: 2,
      })

      // 2/4 = 50% paid (below 75% threshold)
      expect(analysis.meetsPaidThreshold).toBe(false)
      expect(analysis.paidClubsNeeded).toBe(1)
      expect(analysis.currentLevel).toBe('none')

      // All levels not achievable
      expect(analysis.distinguishedGap.achievable).toBe(false)
      expect(analysis.selectGap.achievable).toBe(false)
      expect(analysis.presidentsGap.achievable).toBe(false)
    })
  })
})
