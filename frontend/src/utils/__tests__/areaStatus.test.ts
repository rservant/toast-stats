/**
 * Area Status Unit Tests
 *
 * Unit tests for area status calculation focusing on edge cases and
 * the qualifying gate behavior.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */

import { describe, it, expect } from 'vitest'
import {
  calculateAreaStatus,
  calculateRequiredDistinguishedClubs,
  calculateVisitStatus,
  checkAreaQualifying,
} from '../divisionStatus'

describe('calculateAreaStatus', () => {
  describe('edge case: non-qualified area with excellent metrics', () => {
    it('should return "not-qualified" even with President\'s Distinguished level metrics', () => {
      // Area has excellent metrics that would qualify for President's Distinguished
      const clubBase = 10
      const threshold = calculateRequiredDistinguishedClubs(clubBase)
      const distinguishedClubs = 8 // Well above threshold + 1
      const paidClubs = 15 // High net growth
      const netGrowth = 5
      const isQualified = false // But area is not qualified

      const status = calculateAreaStatus(
        isQualified,
        distinguishedClubs,
        threshold,
        paidClubs,
        clubBase,
        netGrowth
      )

      // Must be 'not-qualified' despite excellent metrics
      expect(status).toBe('not-qualified')
      expect(threshold).toBe(5)
      expect(distinguishedClubs).toBeGreaterThan(threshold + 1)
      expect(netGrowth).toBeGreaterThan(1)
    })

    it('should return "not-qualified" even with Select Distinguished level metrics', () => {
      // Area has metrics that would qualify for Select Distinguished
      const clubBase = 10
      const threshold = calculateRequiredDistinguishedClubs(clubBase)
      const distinguishedClubs = 6 // threshold + 1
      const paidClubs = 10 // No net growth but paid >= base
      const netGrowth = 0
      const isQualified = false // But area is not qualified

      const status = calculateAreaStatus(
        isQualified,
        distinguishedClubs,
        threshold,
        paidClubs,
        clubBase,
        netGrowth
      )

      // Must be 'not-qualified' despite Select Distinguished metrics
      expect(status).toBe('not-qualified')
      expect(distinguishedClubs).toBe(threshold + 1)
      expect(paidClubs).toBeGreaterThanOrEqual(clubBase)
    })

    it('should return "not-qualified" even with Distinguished level metrics', () => {
      // Area has metrics that would qualify for Distinguished
      const clubBase = 10
      const threshold = calculateRequiredDistinguishedClubs(clubBase)
      const distinguishedClubs = 5 // Exactly at threshold
      const paidClubs = 10 // paid >= base
      const netGrowth = 0
      const isQualified = false // But area is not qualified

      const status = calculateAreaStatus(
        isQualified,
        distinguishedClubs,
        threshold,
        paidClubs,
        clubBase,
        netGrowth
      )

      // Must be 'not-qualified' despite Distinguished metrics
      expect(status).toBe('not-qualified')
      expect(distinguishedClubs).toBe(threshold)
      expect(paidClubs).toBeGreaterThanOrEqual(clubBase)
    })

    it('should return "not-qualified" with perfect metrics (100% distinguished, high growth)', () => {
      // Area has perfect metrics
      const clubBase = 10
      const threshold = calculateRequiredDistinguishedClubs(clubBase)
      const distinguishedClubs = 10 // All clubs are distinguished
      const paidClubs = 20 // Doubled the club base
      const netGrowth = 10
      const isQualified = false // But area is not qualified

      const status = calculateAreaStatus(
        isQualified,
        distinguishedClubs,
        threshold,
        paidClubs,
        clubBase,
        netGrowth
      )

      // Must be 'not-qualified' despite perfect metrics
      expect(status).toBe('not-qualified')
      expect(distinguishedClubs).toBe(clubBase)
      expect(netGrowth).toBe(10)
    })
  })

  describe('edge case: qualified area with minimal metrics', () => {
    it('should return "distinguished" when qualified with exactly threshold and paid = base', () => {
      // Area is qualified with minimal Distinguished metrics
      const clubBase = 10
      const threshold = calculateRequiredDistinguishedClubs(clubBase)
      const distinguishedClubs = 5 // Exactly at threshold
      const paidClubs = 10 // Exactly at base
      const netGrowth = 0
      const isQualified = true // Area is qualified

      const status = calculateAreaStatus(
        isQualified,
        distinguishedClubs,
        threshold,
        paidClubs,
        clubBase,
        netGrowth
      )

      // Should be 'distinguished' with minimal qualifying metrics
      expect(status).toBe('distinguished')
      expect(distinguishedClubs).toBe(threshold)
      expect(paidClubs).toBe(clubBase)
    })

    it('should return "not-distinguished" when qualified but one below threshold', () => {
      // Area is qualified but distinguished clubs one below threshold
      const clubBase = 10
      const threshold = calculateRequiredDistinguishedClubs(clubBase)
      const distinguishedClubs = 4 // One below threshold
      const paidClubs = 10 // paid = base
      const netGrowth = 0
      const isQualified = true // Area is qualified

      const status = calculateAreaStatus(
        isQualified,
        distinguishedClubs,
        threshold,
        paidClubs,
        clubBase,
        netGrowth
      )

      // Should be 'not-distinguished' because below threshold
      expect(status).toBe('not-distinguished')
      expect(distinguishedClubs).toBe(threshold - 1)
    })

    it('should return "not-distinguished" when qualified but paid clubs below base', () => {
      // Area is qualified but paid clubs below base
      const clubBase = 10
      const threshold = calculateRequiredDistinguishedClubs(clubBase)
      const distinguishedClubs = 5 // At threshold
      const paidClubs = 9 // One below base
      const netGrowth = -1
      const isQualified = true // Area is qualified

      const status = calculateAreaStatus(
        isQualified,
        distinguishedClubs,
        threshold,
        paidClubs,
        clubBase,
        netGrowth
      )

      // Should be 'not-distinguished' because paid < base
      expect(status).toBe('not-distinguished')
      expect(paidClubs).toBeLessThan(clubBase)
    })

    it('should return "select-distinguished" when qualified with threshold + 1 and paid = base', () => {
      // Area is qualified with minimal Select Distinguished metrics
      const clubBase = 10
      const threshold = calculateRequiredDistinguishedClubs(clubBase)
      const distinguishedClubs = 6 // threshold + 1
      const paidClubs = 10 // Exactly at base (net growth = 0)
      const netGrowth = 0
      const isQualified = true // Area is qualified

      const status = calculateAreaStatus(
        isQualified,
        distinguishedClubs,
        threshold,
        paidClubs,
        clubBase,
        netGrowth
      )

      // Should be 'select-distinguished' with minimal qualifying metrics
      expect(status).toBe('select-distinguished')
      expect(distinguishedClubs).toBe(threshold + 1)
      expect(paidClubs).toBe(clubBase)
      expect(netGrowth).toBe(0)
    })

    it('should return "presidents-distinguished" when qualified with threshold + 1 and net growth = 1', () => {
      // Area is qualified with minimal President's Distinguished metrics
      const clubBase = 10
      const threshold = calculateRequiredDistinguishedClubs(clubBase)
      const distinguishedClubs = 6 // threshold + 1
      const paidClubs = 11 // net growth = 1
      const netGrowth = 1
      const isQualified = true // Area is qualified

      const status = calculateAreaStatus(
        isQualified,
        distinguishedClubs,
        threshold,
        paidClubs,
        clubBase,
        netGrowth
      )

      // Should be 'presidents-distinguished' with minimal qualifying metrics
      expect(status).toBe('presidents-distinguished')
      expect(distinguishedClubs).toBe(threshold + 1)
      expect(netGrowth).toBe(1)
    })
  })

  describe('edge case: missing visit data scenario', () => {
    it('should mark area as not qualified when first round visit data is missing (0 completed)', () => {
      // Simulate missing first round visit data
      const clubBase = 10
      const netGrowth = 0 // No club loss

      // First round: missing data (0 completed visits)
      const firstRoundVisits = calculateVisitStatus(0, clubBase)
      // Second round: meets threshold
      const secondRoundVisits = calculateVisitStatus(8, clubBase)

      const isQualified = checkAreaQualifying(
        netGrowth,
        firstRoundVisits,
        secondRoundVisits
      )

      // Should not be qualified due to missing first round data
      expect(isQualified).toBe(false)
      expect(firstRoundVisits.completed).toBe(0)
      expect(firstRoundVisits.meetsThreshold).toBe(false)
      expect(secondRoundVisits.meetsThreshold).toBe(true)
    })

    it('should mark area as not qualified when second round visit data is missing (0 completed)', () => {
      // Simulate missing second round visit data
      const clubBase = 10
      const netGrowth = 0 // No club loss

      // First round: meets threshold
      const firstRoundVisits = calculateVisitStatus(8, clubBase)
      // Second round: missing data (0 completed visits)
      const secondRoundVisits = calculateVisitStatus(0, clubBase)

      const isQualified = checkAreaQualifying(
        netGrowth,
        firstRoundVisits,
        secondRoundVisits
      )

      // Should not be qualified due to missing second round data
      expect(isQualified).toBe(false)
      expect(firstRoundVisits.meetsThreshold).toBe(true)
      expect(secondRoundVisits.completed).toBe(0)
      expect(secondRoundVisits.meetsThreshold).toBe(false)
    })

    it('should mark area as not qualified when both visit rounds have missing data', () => {
      // Simulate missing data for both visit rounds
      const clubBase = 10
      const netGrowth = 0 // No club loss

      // Both rounds: missing data (0 completed visits)
      const firstRoundVisits = calculateVisitStatus(0, clubBase)
      const secondRoundVisits = calculateVisitStatus(0, clubBase)

      const isQualified = checkAreaQualifying(
        netGrowth,
        firstRoundVisits,
        secondRoundVisits
      )

      // Should not be qualified due to missing data in both rounds
      expect(isQualified).toBe(false)
      expect(firstRoundVisits.completed).toBe(0)
      expect(firstRoundVisits.meetsThreshold).toBe(false)
      expect(secondRoundVisits.completed).toBe(0)
      expect(secondRoundVisits.meetsThreshold).toBe(false)
    })

    it('should return "not-qualified" status when area has missing visit data', () => {
      // Area with excellent metrics but missing visit data
      const clubBase = 10
      const threshold = calculateRequiredDistinguishedClubs(clubBase)
      const distinguishedClubs = 8 // Excellent
      const paidClubs = 12 // Positive growth
      const netGrowth = 2

      // Missing visit data means not qualified
      const firstRoundVisits = calculateVisitStatus(0, clubBase)
      const secondRoundVisits = calculateVisitStatus(0, clubBase)
      const isQualified = checkAreaQualifying(
        netGrowth,
        firstRoundVisits,
        secondRoundVisits
      )

      const status = calculateAreaStatus(
        isQualified,
        distinguishedClubs,
        threshold,
        paidClubs,
        clubBase,
        netGrowth
      )

      // Should be 'not-qualified' due to missing visit data
      expect(status).toBe('not-qualified')
      expect(isQualified).toBe(false)
    })

    it('should mark area as qualified when visit data is present and meets thresholds', () => {
      // Area with complete visit data that meets thresholds
      const clubBase = 10
      const netGrowth = 0 // No club loss

      // Both rounds: complete data meeting thresholds
      const firstRoundVisits = calculateVisitStatus(8, clubBase)
      const secondRoundVisits = calculateVisitStatus(8, clubBase)

      const isQualified = checkAreaQualifying(
        netGrowth,
        firstRoundVisits,
        secondRoundVisits
      )

      // Should be qualified with complete data
      expect(isQualified).toBe(true)
      expect(firstRoundVisits.completed).toBe(8)
      expect(firstRoundVisits.meetsThreshold).toBe(true)
      expect(secondRoundVisits.completed).toBe(8)
      expect(secondRoundVisits.meetsThreshold).toBe(true)
    })
  })

  describe('edge case: club base = 1', () => {
    it('should handle qualified area with club base = 1', () => {
      const clubBase = 1
      const threshold = calculateRequiredDistinguishedClubs(clubBase)
      const distinguishedClubs = 1
      const paidClubs = 1
      const netGrowth = 0
      const isQualified = true

      const status = calculateAreaStatus(
        isQualified,
        distinguishedClubs,
        threshold,
        paidClubs,
        clubBase,
        netGrowth
      )

      expect(threshold).toBe(1)
      expect(status).toBe('distinguished')
    })

    it('should handle non-qualified area with club base = 1', () => {
      const clubBase = 1
      const threshold = calculateRequiredDistinguishedClubs(clubBase)
      const distinguishedClubs = 1
      const paidClubs = 1
      const netGrowth = 0
      const isQualified = false

      const status = calculateAreaStatus(
        isQualified,
        distinguishedClubs,
        threshold,
        paidClubs,
        clubBase,
        netGrowth
      )

      expect(threshold).toBe(1)
      expect(status).toBe('not-qualified')
    })
  })

  describe('edge case: zero net growth boundary', () => {
    it('should qualify area with exactly zero net growth (no change)', () => {
      const clubBase = 10
      const netGrowth = 0 // Exactly zero (no change)

      const firstRoundVisits = calculateVisitStatus(8, clubBase)
      const secondRoundVisits = calculateVisitStatus(8, clubBase)

      const isQualified = checkAreaQualifying(
        netGrowth,
        firstRoundVisits,
        secondRoundVisits
      )

      // Zero net growth should still qualify (no club loss)
      expect(isQualified).toBe(true)
      expect(netGrowth).toBe(0)
    })

    it('should not qualify area with net growth = -1 (one club lost)', () => {
      const clubBase = 10
      const netGrowth = -1 // One club lost

      const firstRoundVisits = calculateVisitStatus(8, clubBase)
      const secondRoundVisits = calculateVisitStatus(8, clubBase)

      const isQualified = checkAreaQualifying(
        netGrowth,
        firstRoundVisits,
        secondRoundVisits
      )

      // Negative net growth should not qualify (club loss)
      expect(isQualified).toBe(false)
      expect(netGrowth).toBe(-1)
    })
  })

  describe('edge case: exactly at 75% visit threshold', () => {
    it('should qualify area when first round visits exactly at 75%', () => {
      const clubBase = 4
      const netGrowth = 0

      // First round: exactly 3 visits (75% of 4)
      const firstRoundVisits = calculateVisitStatus(3, clubBase)
      const secondRoundVisits = calculateVisitStatus(3, clubBase)

      const isQualified = checkAreaQualifying(
        netGrowth,
        firstRoundVisits,
        secondRoundVisits
      )

      expect(isQualified).toBe(true)
      expect(firstRoundVisits.percentage).toBe(75)
      expect(firstRoundVisits.meetsThreshold).toBe(true)
    })

    it('should not qualify area when first round visits one below 75%', () => {
      const clubBase = 4
      const netGrowth = 0

      // First round: 2 visits (50% of 4, below 75%)
      const firstRoundVisits = calculateVisitStatus(2, clubBase)
      const secondRoundVisits = calculateVisitStatus(3, clubBase)

      const isQualified = checkAreaQualifying(
        netGrowth,
        firstRoundVisits,
        secondRoundVisits
      )

      expect(isQualified).toBe(false)
      expect(firstRoundVisits.percentage).toBe(50)
      expect(firstRoundVisits.meetsThreshold).toBe(false)
    })
  })
})
