/**
 * Area Gap Analysis Unit Tests
 *
 * Unit tests for area gap analysis calculation focusing on boundary conditions,
 * edge cases, and recognition level classification.
 *
 * DAP Criteria (from TOASTMASTERS_DASHBOARD_KNOWLEDGE.md):
 * - Eligibility: No net club loss (paidClubs >= clubBase)
 * - Distinguished Area: paidClubs >= clubBase AND distinguishedClubs >= 50% of clubBase
 * - Select Distinguished Area: paidClubs >= clubBase AND distinguishedClubs >= 50% of clubBase + 1
 * - President's Distinguished Area: paidClubs >= clubBase + 1 AND distinguishedClubs >= 50% of clubBase + 1
 *
 * Key differences from previous implementation:
 * - Distinguished percentage is calculated against club base, not paid clubs
 * - Paid clubs threshold is >= club base (no net loss), not 75%
 * - Select Distinguished requires 50% + 1 additional club
 * - President's Distinguished requires club base + 1 paid clubs AND 50% + 1 distinguished
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
} from '../areaGapAnalysis'

describe('calculatePaidClubsGap', () => {
  /**
   * Property 6: Paid Clubs Gap = max(0, clubBase - paidClubs)
   * For no net club loss requirement: paidClubs must be >= clubBase
   * Requirements: 6.1
   */

  describe('basic gap calculations', () => {
    it('should calculate gap when below club base (4 clubs, 3 paid → needs 1)', () => {
      // No net loss: need 4 paid, have 3, need 1 more
      const gap = calculatePaidClubsGap(4, 3)
      expect(gap).toBe(1)
    })

    it('should return 0 when at club base (4 clubs, 4 paid)', () => {
      // No net loss: need 4 paid, have 4, need 0
      const gap = calculatePaidClubsGap(4, 4)
      expect(gap).toBe(0)
    })

    it('should return 0 when above club base (4 clubs, 5 paid)', () => {
      // No net loss: need 4 paid, have 5, need 0
      const gap = calculatePaidClubsGap(4, 5)
      expect(gap).toBe(0)
    })

    it('should handle larger club bases (10 clubs, 7 paid → needs 3)', () => {
      // No net loss: need 10 paid, have 7, need 3
      const gap = calculatePaidClubsGap(10, 7)
      expect(gap).toBe(3)
    })
  })

  describe('edge cases', () => {
    it('should return 0 when clubBase is 0', () => {
      const gap = calculatePaidClubsGap(0, 0)
      expect(gap).toBe(0)
    })

    it('should handle 1 club (needs 1 paid)', () => {
      // No net loss: need 1 paid, have 0, need 1
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
   * Property 4: Distinguished Clubs Percentage = Math.round((distinguishedClubs / clubBase) * 100)
   * Note: Calculated against clubBase, NOT paidClubs
   * When clubBase = 0, percentage should be 0
   * Requirements: 5.5
   */

  it('should calculate 50% correctly (against club base)', () => {
    // 2 distinguished out of 4 club base = 50%
    expect(calculateDistinguishedPercentage(4, 2)).toBe(50)
  })

  it('should calculate 75% correctly (against club base)', () => {
    // 3 distinguished out of 4 club base = 75%
    expect(calculateDistinguishedPercentage(4, 3)).toBe(75)
  })

  it('should calculate 100% correctly (against club base)', () => {
    // 4 distinguished out of 4 club base = 100%
    expect(calculateDistinguishedPercentage(4, 4)).toBe(100)
  })

  it('should return 0 when clubBase is 0', () => {
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
   * - If paidClubs < clubBase: "none" (net club loss - not eligible)
   * - Else if paidClubs >= clubBase + 1 AND distinguishedClubs >= Math.ceil(clubBase * 0.50) + 1: "presidents"
   * - Else if paidClubs >= clubBase AND distinguishedClubs >= Math.ceil(clubBase * 0.50) + 1: "select"
   * - Else if paidClubs >= clubBase AND distinguishedClubs >= Math.ceil(clubBase * 0.50): "distinguished"
   * - Else: "none"
   * Requirements: 5.6, 6.5
   */

  describe('net club loss (paidClubs < clubBase)', () => {
    it('should return "none" when paidClubs < clubBase (net club loss)', () => {
      // 3/4 paid = net club loss (need 4 to meet no net loss)
      const level = determineRecognitionLevel({
        clubBase: 4,
        paidClubs: 3,
        distinguishedClubs: 3, // Even if all paid are distinguished
      })
      expect(level).toBe('none')
    })

    it('should return "none" when significantly below club base', () => {
      // 50/100 paid = significant net club loss
      const level = determineRecognitionLevel({
        clubBase: 100,
        paidClubs: 50,
        distinguishedClubs: 50,
      })
      expect(level).toBe('none')
    })
  })

  describe('recognition levels when no net club loss (paidClubs >= clubBase)', () => {
    it('should return "distinguished" when at 50% distinguished of club base', () => {
      // 4 clubs, 4 paid (no net loss), 2 distinguished (50% of club base)
      // 50% of 4 = 2, ceil(4 * 0.5) = 2
      const level = determineRecognitionLevel({
        clubBase: 4,
        paidClubs: 4,
        distinguishedClubs: 2,
      })
      expect(level).toBe('distinguished')
    })

    it('should return "select" when at 50% + 1 distinguished of club base', () => {
      // 4 clubs, 4 paid (no net loss), 3 distinguished (50% + 1 = 3)
      // ceil(4 * 0.5) + 1 = 2 + 1 = 3
      const level = determineRecognitionLevel({
        clubBase: 4,
        paidClubs: 4,
        distinguishedClubs: 3,
      })
      expect(level).toBe('select')
    })

    it('should return "presidents" when at club base + 1 paid AND 50% + 1 distinguished', () => {
      // 4 clubs, 5 paid (club base + 1), 3 distinguished (50% + 1 = 3)
      const level = determineRecognitionLevel({
        clubBase: 4,
        paidClubs: 5,
        distinguishedClubs: 3,
      })
      expect(level).toBe('presidents')
    })

    it('should return "select" (not presidents) when at club base paid AND 50% + 1 distinguished', () => {
      // 4 clubs, 4 paid (exactly club base, not +1), 3 distinguished (50% + 1 = 3)
      // This meets Select but NOT Presidents (needs club base + 1 paid)
      const level = determineRecognitionLevel({
        clubBase: 4,
        paidClubs: 4,
        distinguishedClubs: 3,
      })
      expect(level).toBe('select')
    })

    it('should return "none" when below 50% distinguished of club base', () => {
      // 4 clubs, 4 paid (no net loss), 1 distinguished (25% of club base)
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

    it('should return "none" when paidClubs is 0', () => {
      // 0 paid clubs = net club loss
      const level = determineRecognitionLevel({
        clubBase: 4,
        paidClubs: 0,
        distinguishedClubs: 0,
      })
      expect(level).toBe('none')
    })

    it('should handle 1 club area correctly - presidents', () => {
      // 1 club, 2 paid (club base + 1), 1 distinguished (50% + 1 = ceil(0.5) + 1 = 1 + 1 = 2? No, ceil(1*0.5) = 1, +1 = 2)
      // Actually for 1 club: ceil(1 * 0.5) = 1, so 50% threshold = 1, 50% + 1 = 2
      // But we only have 1 distinguished, so we can only reach Distinguished
      // To get Presidents: need 2 paid (club base + 1) AND 2 distinguished (50% + 1)
      const level = determineRecognitionLevel({
        clubBase: 1,
        paidClubs: 2,
        distinguishedClubs: 2,
      })
      expect(level).toBe('presidents')
    })

    it('should handle 1 club area - distinguished only', () => {
      // 1 club, 1 paid (no net loss), 1 distinguished (50% of club base = ceil(0.5) = 1)
      const level = determineRecognitionLevel({
        clubBase: 1,
        paidClubs: 1,
        distinguishedClubs: 1,
      })
      expect(level).toBe('distinguished')
    })

    it('should handle 1 club area with no distinguished', () => {
      // 1 club, 1 paid (no net loss), 0 distinguished (0%)
      const level = determineRecognitionLevel({
        clubBase: 1,
        paidClubs: 1,
        distinguishedClubs: 0,
      })
      expect(level).toBe('none')
    })
  })

  describe('boundary conditions', () => {
    it('should return "distinguished" at exactly 50% of club base (boundary)', () => {
      // 10 clubs, 10 paid (no net loss), 5 distinguished (50% of club base)
      // ceil(10 * 0.5) = 5
      const level = determineRecognitionLevel({
        clubBase: 10,
        paidClubs: 10,
        distinguishedClubs: 5,
      })
      expect(level).toBe('distinguished')
    })

    it('should return "select" at exactly 50% + 1 of club base (boundary)', () => {
      // 10 clubs, 10 paid (no net loss), 6 distinguished (50% + 1 = 6)
      // ceil(10 * 0.5) + 1 = 5 + 1 = 6
      const level = determineRecognitionLevel({
        clubBase: 10,
        paidClubs: 10,
        distinguishedClubs: 6,
      })
      expect(level).toBe('select')
    })

    it('should return "presidents" at club base + 1 paid AND 50% + 1 distinguished (boundary)', () => {
      // 10 clubs, 11 paid (club base + 1), 6 distinguished (50% + 1 = 6)
      const level = determineRecognitionLevel({
        clubBase: 10,
        paidClubs: 11,
        distinguishedClubs: 6,
      })
      expect(level).toBe('presidents')
    })

    it('should return "none" at 49% distinguished (just below 50% threshold)', () => {
      // 100 clubs, 100 paid (no net loss), 49 distinguished (49% of club base)
      // ceil(100 * 0.5) = 50, have 49, below threshold
      const level = determineRecognitionLevel({
        clubBase: 100,
        paidClubs: 100,
        distinguishedClubs: 49,
      })
      expect(level).toBe('none')
    })

    it('should return "distinguished" at exactly 50% with odd club base', () => {
      // 5 clubs, 5 paid (no net loss), 3 distinguished
      // ceil(5 * 0.5) = ceil(2.5) = 3
      const level = determineRecognitionLevel({
        clubBase: 5,
        paidClubs: 5,
        distinguishedClubs: 3,
      })
      expect(level).toBe('distinguished')
    })
  })
})

describe('calculateAreaGapAnalysis', () => {
  /**
   * Complete gap analysis tests covering:
   * - Property 6: Paid Clubs Gap (no net club loss)
   * - Property 7: Distinguished Clubs Gaps (against club base)
   * - Property 8: No Net Loss Blocker
   * Requirements: 5.4, 5.5, 5.6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
   */

  describe('no net club loss requirement (Property 6)', () => {
    it('should calculate paid clubs gap correctly (4 clubs, 3 paid → needs 1)', () => {
      const analysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 3,
        distinguishedClubs: 0,
      })
      expect(analysis.paidClubsNeeded).toBe(1)
      expect(analysis.meetsNoNetLossRequirement).toBe(false)
      expect(analysis.meetsPaidThreshold).toBe(false) // backward compatibility
    })

    it('should return 0 paid clubs needed when no net loss met (4 clubs, 4 paid)', () => {
      const analysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 4,
        distinguishedClubs: 0,
      })
      expect(analysis.paidClubsNeeded).toBe(0)
      expect(analysis.meetsNoNetLossRequirement).toBe(true)
      expect(analysis.meetsPaidThreshold).toBe(true) // backward compatibility
    })

    it('should return 0 paid clubs needed when above club base (4 clubs, 5 paid)', () => {
      const analysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 5,
        distinguishedClubs: 0,
      })
      expect(analysis.paidClubsNeeded).toBe(0)
      expect(analysis.meetsNoNetLossRequirement).toBe(true)
    })
  })

  describe('distinguished gaps against club base (Property 7)', () => {
    it('should calculate Distinguished gap (4 club base, 1 distinguished → needs 1)', () => {
      // 50% of 4 = ceil(4 * 0.5) = 2, have 1, need 1
      const analysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 4,
        distinguishedClubs: 1,
      })
      expect(analysis.distinguishedGap.distinguishedClubsNeeded).toBe(1)
      expect(analysis.distinguishedGap.clubsNeeded).toBe(1) // backward compatibility
      expect(analysis.distinguishedGap.achieved).toBe(false)
      expect(analysis.distinguishedGap.achievable).toBe(true)
    })

    it('should calculate Select gap (4 club base, 2 distinguished → needs 1)', () => {
      // 50% + 1 of 4 = ceil(4 * 0.5) + 1 = 2 + 1 = 3, have 2, need 1
      const analysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 4,
        distinguishedClubs: 2,
      })
      expect(analysis.selectGap.distinguishedClubsNeeded).toBe(1)
      expect(analysis.selectGap.clubsNeeded).toBe(1) // backward compatibility
      expect(analysis.selectGap.achieved).toBe(false)
      expect(analysis.selectGap.achievable).toBe(true)
    })

    it('should calculate Presidents gap - distinguished clubs (4 club base, 2 distinguished → needs 1)', () => {
      // 50% + 1 of 4 = ceil(4 * 0.5) + 1 = 2 + 1 = 3, have 2, need 1
      const analysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 4,
        distinguishedClubs: 2,
      })
      expect(analysis.presidentsGap.distinguishedClubsNeeded).toBe(1)
      expect(analysis.presidentsGap.clubsNeeded).toBe(1) // backward compatibility
    })

    it('should calculate Presidents gap - paid clubs (4 club base, 4 paid → needs 1)', () => {
      // Presidents requires club base + 1 paid = 5, have 4, need 1
      const analysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 4,
        distinguishedClubs: 3,
      })
      expect(analysis.presidentsGap.paidClubsNeeded).toBe(1)
      expect(analysis.presidentsGap.achieved).toBe(false)
      expect(analysis.presidentsGap.achievable).toBe(true)
    })

    it('should show Distinguished as achieved when at 50% of club base', () => {
      // 50% of 4 = ceil(4 * 0.5) = 2
      const analysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 4,
        distinguishedClubs: 2,
      })
      expect(analysis.distinguishedGap.achieved).toBe(true)
      expect(analysis.distinguishedGap.distinguishedClubsNeeded).toBe(0)
    })

    it('should show Select as achieved when at 50% + 1 of club base', () => {
      // 50% + 1 of 4 = ceil(4 * 0.5) + 1 = 3
      const analysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 4,
        distinguishedClubs: 3,
      })
      expect(analysis.selectGap.achieved).toBe(true)
      expect(analysis.selectGap.distinguishedClubsNeeded).toBe(0)
    })

    it('should show Presidents as achieved when at club base + 1 paid AND 50% + 1 distinguished', () => {
      // Presidents: paidClubs >= clubBase + 1 AND distinguishedClubs >= 50% + 1
      const analysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 5,
        distinguishedClubs: 3,
      })
      expect(analysis.presidentsGap.achieved).toBe(true)
      expect(analysis.presidentsGap.distinguishedClubsNeeded).toBe(0)
      expect(analysis.presidentsGap.paidClubsNeeded).toBe(0)
    })
  })

  describe('no net loss blocker (Property 8)', () => {
    it('should mark all levels as not achievable when net club loss exists', () => {
      const analysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 3, // Below club base = net club loss
        distinguishedClubs: 3,
      })

      expect(analysis.meetsNoNetLossRequirement).toBe(false)
      expect(analysis.distinguishedGap.achievable).toBe(false)
      expect(analysis.selectGap.achievable).toBe(false)
      expect(analysis.presidentsGap.achievable).toBe(false)
    })

    it('should show distinguishedClubsNeeded as 0 when not achievable (net club loss)', () => {
      const analysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 3,
        distinguishedClubs: 0,
      })

      // When not achievable, distinguishedClubsNeeded should be 0 (not meaningful)
      expect(analysis.distinguishedGap.distinguishedClubsNeeded).toBe(0)
      expect(analysis.selectGap.distinguishedClubsNeeded).toBe(0)
      expect(analysis.presidentsGap.distinguishedClubsNeeded).toBe(0)
    })

    it('should show paidClubsNeeded in gap when net club loss exists', () => {
      const analysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 2,
        distinguishedClubs: 2,
      })

      // Each gap should show how many paid clubs needed to meet no net loss
      expect(analysis.distinguishedGap.paidClubsNeeded).toBe(2)
      expect(analysis.selectGap.paidClubsNeeded).toBe(2)
      expect(analysis.presidentsGap.paidClubsNeeded).toBe(2)
    })
  })

  describe('recognition level classification', () => {
    it('should classify as "none" when net club loss exists', () => {
      const analysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 3,
        distinguishedClubs: 3,
      })
      expect(analysis.currentLevel).toBe('none')
    })

    it('should classify as "distinguished" at 50% distinguished of club base', () => {
      const analysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 4,
        distinguishedClubs: 2,
      })
      expect(analysis.currentLevel).toBe('distinguished')
    })

    it('should classify as "select" at 50% + 1 distinguished of club base', () => {
      const analysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 4,
        distinguishedClubs: 3,
      })
      expect(analysis.currentLevel).toBe('select')
    })

    it('should classify as "presidents" at club base + 1 paid AND 50% + 1 distinguished', () => {
      const analysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 5,
        distinguishedClubs: 3,
      })
      expect(analysis.currentLevel).toBe('presidents')
    })

    it('should classify as "none" when below 50% distinguished of club base', () => {
      const analysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 4,
        distinguishedClubs: 1,
      })
      expect(analysis.currentLevel).toBe('none')
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
      expect(analysis.meetsNoNetLossRequirement).toBe(false)
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
      expect(analysis.meetsNoNetLossRequirement).toBe(false)
      expect(analysis.paidClubsNeeded).toBe(4) // Need 4 paid clubs (club base)
    })

    it('should handle area with 1 club (minimum case) - distinguished', () => {
      // 1 club, 1 paid (no net loss), 1 distinguished
      // 50% of 1 = ceil(1 * 0.5) = 1
      const analysis = calculateAreaGapAnalysis({
        clubBase: 1,
        paidClubs: 1,
        distinguishedClubs: 1,
      })

      expect(analysis.currentLevel).toBe('distinguished')
      expect(analysis.meetsNoNetLossRequirement).toBe(true)
      expect(analysis.paidClubsNeeded).toBe(0)
      expect(analysis.distinguishedGap.achieved).toBe(true)
    })

    it('should handle area with 1 club - select requires 50% + 1 = 2 distinguished', () => {
      // 1 club, 1 paid, 1 distinguished
      // Select requires: ceil(1 * 0.5) + 1 = 1 + 1 = 2 distinguished
      const analysis = calculateAreaGapAnalysis({
        clubBase: 1,
        paidClubs: 1,
        distinguishedClubs: 1,
      })

      expect(analysis.selectGap.achieved).toBe(false)
      expect(analysis.selectGap.distinguishedClubsNeeded).toBe(1) // Need 2, have 1
    })

    it('should handle area with 1 club, 0 distinguished', () => {
      const analysis = calculateAreaGapAnalysis({
        clubBase: 1,
        paidClubs: 1,
        distinguishedClubs: 0,
      })

      expect(analysis.currentLevel).toBe('none')
      expect(analysis.meetsNoNetLossRequirement).toBe(true)
      expect(analysis.distinguishedGap.distinguishedClubsNeeded).toBe(1) // Need 1 for Distinguished
      expect(analysis.selectGap.distinguishedClubsNeeded).toBe(2) // Need 2 for Select
      expect(analysis.presidentsGap.distinguishedClubsNeeded).toBe(2) // Need 2 for Presidents
    })
  })

  describe('boundary values', () => {
    it('should handle exactly at club base (no net loss met)', () => {
      // 4 clubs, 4 paid = exactly at club base
      const analysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 4,
        distinguishedClubs: 0,
      })

      expect(analysis.meetsNoNetLossRequirement).toBe(true)
      expect(analysis.paidClubsNeeded).toBe(0)
    })

    it('should handle just below club base (net club loss)', () => {
      // 100 clubs, 99 paid = 1 below club base
      const analysis = calculateAreaGapAnalysis({
        clubBase: 100,
        paidClubs: 99,
        distinguishedClubs: 99,
      })

      expect(analysis.meetsNoNetLossRequirement).toBe(false)
      expect(analysis.paidClubsNeeded).toBe(1) // Need 100 paid clubs
      expect(analysis.currentLevel).toBe('none')
    })

    it('should handle exactly 50% distinguished of club base threshold', () => {
      // 4 club base, 2 distinguished = 50%
      // ceil(4 * 0.5) = 2
      const analysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 4,
        distinguishedClubs: 2,
      })

      expect(analysis.currentLevel).toBe('distinguished')
      expect(analysis.distinguishedGap.achieved).toBe(true)
    })

    it('should handle just below 50% distinguished threshold', () => {
      // 100 club base, 49 distinguished = 49%
      // ceil(100 * 0.5) = 50, have 49, below threshold
      const analysis = calculateAreaGapAnalysis({
        clubBase: 100,
        paidClubs: 100,
        distinguishedClubs: 49,
      })

      expect(analysis.currentLevel).toBe('none')
      expect(analysis.distinguishedGap.achieved).toBe(false)
      expect(analysis.distinguishedGap.distinguishedClubsNeeded).toBe(1) // Need 50 distinguished
    })

    it('should handle odd club base for 50% calculation', () => {
      // 5 club base: ceil(5 * 0.5) = ceil(2.5) = 3
      const analysis = calculateAreaGapAnalysis({
        clubBase: 5,
        paidClubs: 5,
        distinguishedClubs: 3,
      })

      expect(analysis.currentLevel).toBe('distinguished')
      expect(analysis.distinguishedGap.achieved).toBe(true)
      expect(analysis.distinguishedGap.distinguishedClubsNeeded).toBe(0)
    })

    it('should handle odd club base for 50% + 1 calculation', () => {
      // 5 club base: ceil(5 * 0.5) + 1 = 3 + 1 = 4
      const analysis = calculateAreaGapAnalysis({
        clubBase: 5,
        paidClubs: 5,
        distinguishedClubs: 4,
      })

      expect(analysis.currentLevel).toBe('select')
      expect(analysis.selectGap.achieved).toBe(true)
      expect(analysis.selectGap.distinguishedClubsNeeded).toBe(0)
    })
  })

  describe('complete scenario tests from design document', () => {
    it('scenario: area with 4 clubs, 4 paid, 2 distinguished - Distinguished level', () => {
      const analysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 4,
        distinguishedClubs: 2,
      })

      // 4/4 = 100% paid (no net loss met)
      expect(analysis.meetsNoNetLossRequirement).toBe(true)
      expect(analysis.paidClubsNeeded).toBe(0)

      // 2/4 = 50% distinguished of club base
      expect(analysis.currentLevel).toBe('distinguished')

      // Distinguished gap: ceil(4 * 0.5) = 2, have 2, need 0
      expect(analysis.distinguishedGap.achieved).toBe(true)
      expect(analysis.distinguishedGap.distinguishedClubsNeeded).toBe(0)

      // Select gap: ceil(4 * 0.5) + 1 = 3, have 2, need 1
      expect(analysis.selectGap.achieved).toBe(false)
      expect(analysis.selectGap.distinguishedClubsNeeded).toBe(1)

      // Presidents gap: need 3 distinguished AND 5 paid
      expect(analysis.presidentsGap.achieved).toBe(false)
      expect(analysis.presidentsGap.distinguishedClubsNeeded).toBe(1)
      expect(analysis.presidentsGap.paidClubsNeeded).toBe(1)
    })

    it('scenario: area with net club loss (paidClubs < clubBase)', () => {
      const analysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 3,
        distinguishedClubs: 3,
      })

      // 3/4 = 75% paid (net club loss - below club base)
      expect(analysis.meetsNoNetLossRequirement).toBe(false)
      expect(analysis.paidClubsNeeded).toBe(1)
      expect(analysis.currentLevel).toBe('none')

      // All levels not achievable due to net club loss
      expect(analysis.distinguishedGap.achievable).toBe(false)
      expect(analysis.selectGap.achievable).toBe(false)
      expect(analysis.presidentsGap.achievable).toBe(false)
    })

    it('scenario: area achieving Presidents Distinguished', () => {
      const analysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 5, // club base + 1
        distinguishedClubs: 3, // 50% + 1 = ceil(4 * 0.5) + 1 = 3
      })

      expect(analysis.meetsNoNetLossRequirement).toBe(true)
      expect(analysis.currentLevel).toBe('presidents')

      // All levels achieved
      expect(analysis.distinguishedGap.achieved).toBe(true)
      expect(analysis.selectGap.achieved).toBe(true)
      expect(analysis.presidentsGap.achieved).toBe(true)
    })

    it('scenario: area at Select but not Presidents (missing paid clubs)', () => {
      const analysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 4, // exactly club base, not +1
        distinguishedClubs: 3, // 50% + 1 = 3
      })

      expect(analysis.meetsNoNetLossRequirement).toBe(true)
      expect(analysis.currentLevel).toBe('select')

      // Distinguished and Select achieved
      expect(analysis.distinguishedGap.achieved).toBe(true)
      expect(analysis.selectGap.achieved).toBe(true)

      // Presidents NOT achieved - needs 1 more paid club
      expect(analysis.presidentsGap.achieved).toBe(false)
      expect(analysis.presidentsGap.paidClubsNeeded).toBe(1)
      expect(analysis.presidentsGap.distinguishedClubsNeeded).toBe(0)
    })

    it('scenario: large area with 10 clubs', () => {
      // 10 club base
      // Distinguished: ceil(10 * 0.5) = 5
      // Select/Presidents: ceil(10 * 0.5) + 1 = 6
      const analysis = calculateAreaGapAnalysis({
        clubBase: 10,
        paidClubs: 10,
        distinguishedClubs: 5,
      })

      expect(analysis.meetsNoNetLossRequirement).toBe(true)
      expect(analysis.currentLevel).toBe('distinguished')

      expect(analysis.distinguishedGap.achieved).toBe(true)
      expect(analysis.distinguishedGap.distinguishedClubsNeeded).toBe(0)

      expect(analysis.selectGap.achieved).toBe(false)
      expect(analysis.selectGap.distinguishedClubsNeeded).toBe(1) // Need 6, have 5

      expect(analysis.presidentsGap.achieved).toBe(false)
      expect(analysis.presidentsGap.distinguishedClubsNeeded).toBe(1) // Need 6, have 5
      expect(analysis.presidentsGap.paidClubsNeeded).toBe(1) // Need 11, have 10
    })
  })
})
