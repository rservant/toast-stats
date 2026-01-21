/**
 * Area Progress Text Generation Unit Tests
 *
 * Unit tests for the generateAreaProgressText function that creates
 * concise English paragraphs describing an area's progress toward
 * Distinguished Area recognition.
 *
 * Test scenarios cover:
 * - President's Distinguished achieved (no further gaps)
 * - Select Distinguished with incremental gap to President's
 * - Distinguished with incremental gaps to Select and President's
 * - Not distinguished with all gaps described incrementally
 * - Net club loss scenario with eligibility explanation
 * - Club visit status display (complete, partial, unknown)
 * - Edge cases (0 clubs, 1 club)
 *
 * Requirements: 5.1, 5.2, 5.3, 5.6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7
 */

import { describe, it, expect } from 'vitest'
import {
  generateAreaProgressText,
  ClubVisitInfo,
  AreaProgressText,
} from '../areaProgressText'
import { AreaWithDivision } from '../../components/AreaProgressTable'
import { calculateAreaGapAnalysis, GapAnalysis } from '../areaGapAnalysis'
import { DistinguishedStatus } from '../divisionStatus'

/**
 * Helper function to create an AreaWithDivision object for testing
 */
function createArea(
  areaId: string,
  divisionId: string,
  clubBase: number,
  paidClubs: number,
  distinguishedClubs: number
): AreaWithDivision {
  // Determine status based on metrics
  let status: DistinguishedStatus = 'not-distinguished'
  if (paidClubs < clubBase) {
    status = 'not-qualified'
  }

  return {
    areaId,
    divisionId,
    clubBase,
    paidClubs,
    distinguishedClubs,
    netGrowth: paidClubs - clubBase,
    requiredDistinguishedClubs: Math.ceil(clubBase * 0.5),
    firstRoundVisits: {
      completed: 0,
      required: Math.ceil(clubBase * 0.75),
      percentage: 0,
      meetsThreshold: false,
    },
    secondRoundVisits: {
      completed: 0,
      required: Math.ceil(clubBase * 0.75),
      percentage: 0,
      meetsThreshold: false,
    },
    status,
    isQualified: paidClubs >= clubBase,
  }
}

/**
 * Helper function to create ClubVisitInfo for testing
 */
function createVisitInfo(
  firstRoundCompleted: number,
  secondRoundCompleted: number,
  totalClubs: number
): ClubVisitInfo {
  return {
    firstRoundCompleted,
    secondRoundCompleted,
    totalClubs,
  }
}

describe('generateAreaProgressText', () => {
  /**
   * Requirement 6.5: When an area has achieved President's Distinguished,
   * no further gaps should be mentioned.
   */
  describe("President's Distinguished achieved", () => {
    it('should describe achievement when both visit rounds meet 75% threshold', () => {
      // 4 clubs, 5 paid (club base + 1), 3 distinguished (50% + 1 = 3)
      const area = createArea('A1', 'A', 4, 5, 3)
      const gapAnalysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 5,
        distinguishedClubs: 3,
      })
      // 75% of 4 = 3, so 3+ visits meets threshold
      const visitInfo = createVisitInfo(3, 3, 4)

      const result = generateAreaProgressText(area, gapAnalysis, visitInfo)

      expect(result.currentLevel).toBe('presidents')
      expect(result.areaLabel).toBe('Area A1 (Division A)')
      expect(result.progressText).toContain("President's Distinguished")
      expect(result.progressText).toContain('club visits meeting 75% threshold')
      // Should NOT mention any gaps
      expect(result.progressText).not.toContain('For Select')
      expect(result.progressText).not.toContain('For Distinguished')
    })

    it('should describe achievement with partial club visits', () => {
      const area = createArea('B2', 'B', 4, 5, 3)
      const gapAnalysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 5,
        distinguishedClubs: 3,
      })
      const visitInfo = createVisitInfo(4, 2, 4)

      const result = generateAreaProgressText(area, gapAnalysis, visitInfo)

      expect(result.currentLevel).toBe('presidents')
      expect(result.progressText).toContain("President's Distinguished")
      expect(result.progressText).toContain('Club visits:')
      // Should NOT mention any gaps
      expect(result.progressText).not.toContain('For Select')
    })

    it('should describe achievement with unknown club visits', () => {
      const area = createArea('C3', 'C', 4, 5, 3)
      const gapAnalysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 5,
        distinguishedClubs: 3,
      })

      const result = generateAreaProgressText(area, gapAnalysis, undefined)

      expect(result.currentLevel).toBe('presidents')
      expect(result.progressText).toContain("President's Distinguished")
      expect(result.progressText).toContain('Club visits: status unknown')
    })

    it('should include all metrics in the text', () => {
      const area = createArea('D4', 'D', 4, 5, 3)
      const gapAnalysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 5,
        distinguishedClubs: 3,
      })

      const result = generateAreaProgressText(area, gapAnalysis, undefined)

      // President's Distinguished doesn't show metrics in parentheses
      // but should mention the achievement
      expect(result.progressText).toContain("President's Distinguished status")
    })
  })

  /**
   * Requirement 6.3, 6.4: Select Distinguished should mention achievement
   * and incremental gap to President's (only the paid club difference)
   */
  describe('Select Distinguished with incremental gap to Presidents', () => {
    it('should describe achievement and gap to Presidents (1 paid club needed)', () => {
      // 4 clubs, 4 paid (exactly club base), 3 distinguished (50% + 1 = 3)
      // Select achieved, but Presidents needs 1 more paid club
      const area = createArea('A1', 'A', 4, 4, 3)
      const gapAnalysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 4,
        distinguishedClubs: 3,
      })
      const visitInfo = createVisitInfo(3, 2, 4)

      const result = generateAreaProgressText(area, gapAnalysis, visitInfo)

      expect(result.currentLevel).toBe('select')
      expect(result.progressText).toContain('Select Distinguished status')
      expect(result.progressText).toContain('4 of 4 clubs paid')
      expect(result.progressText).toContain('3 of 4 distinguished')
      // Should mention gap to President's (1 paid club)
      expect(result.progressText).toContain("President's Distinguished")
      expect(result.progressText).toContain('1 paid club')
      // Should NOT mention gap to Distinguished (already achieved)
      expect(result.progressText).not.toContain('For Distinguished')
    })

    it('should include club visit status', () => {
      const area = createArea('B2', 'B', 4, 4, 3)
      const gapAnalysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 4,
        distinguishedClubs: 3,
      })
      const visitInfo = createVisitInfo(4, 4, 4)

      const result = generateAreaProgressText(area, gapAnalysis, visitInfo)

      expect(result.progressText).toContain('Club visits:')
    })
  })

  /**
   * Requirement 6.2, 6.3, 6.4: Distinguished should mention achievement
   * and incremental gaps to Select and President's
   */
  describe('Distinguished with incremental gaps to Select and Presidents', () => {
    it('should describe achievement and incremental gaps', () => {
      // 4 clubs, 4 paid (no net loss), 2 distinguished (50% = 2)
      // Distinguished achieved, Select needs 1 more distinguished, Presidents needs 1 more distinguished + 1 paid
      const area = createArea('A1', 'A', 4, 4, 2)
      const gapAnalysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 4,
        distinguishedClubs: 2,
      })
      const visitInfo = createVisitInfo(2, 1, 4)

      const result = generateAreaProgressText(area, gapAnalysis, visitInfo)

      expect(result.currentLevel).toBe('distinguished')
      expect(result.progressText).toContain('Distinguished status')
      expect(result.progressText).toContain('4 of 4 clubs paid')
      expect(result.progressText).toContain('2 of 4 distinguished')
      // Should mention gap to Select (1 more distinguished)
      expect(result.progressText).toContain('Select Distinguished')
      // Should mention gap to President's (1 paid club)
      expect(result.progressText).toContain("President's Distinguished")
    })

    it('should build gaps incrementally (not repeat requirements)', () => {
      const area = createArea('B2', 'B', 4, 4, 2)
      const gapAnalysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 4,
        distinguishedClubs: 2,
      })

      const result = generateAreaProgressText(area, gapAnalysis, undefined)

      // The text should build incrementally
      // Select gap mentions distinguished clubs needed
      // President's gap should mention "also" to indicate building on previous
      expect(result.progressText).toContain('Select Distinguished')
      expect(result.progressText).toContain("President's Distinguished")
    })

    it('should include club visit status showing visits needed for 75%', () => {
      const area = createArea('C3', 'C', 4, 4, 2)
      const gapAnalysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 4,
        distinguishedClubs: 2,
      })
      // 75% of 4 = 3, first round has 3 (meets), second has 0 (needs 3)
      const visitInfo = createVisitInfo(3, 0, 4)

      const result = generateAreaProgressText(area, gapAnalysis, visitInfo)

      expect(result.progressText).toContain('Club visits:')
      expect(result.progressText).toContain('first-round meets 75% threshold')
      expect(result.progressText).toContain(
        'second-round needs 3 visits for 75%'
      )
    })
  })

  /**
   * Requirement 5.2, 5.3, 6.2, 6.3, 6.4: Not distinguished but eligible
   * should describe all gaps incrementally
   */
  describe('Not distinguished with all gaps described incrementally', () => {
    it('should describe current status and all gaps', () => {
      // 4 clubs, 4 paid (no net loss), 1 distinguished (25% - below 50%)
      const area = createArea('A1', 'A', 4, 4, 1)
      const gapAnalysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 4,
        distinguishedClubs: 1,
      })
      const visitInfo = createVisitInfo(2, 0, 4)

      const result = generateAreaProgressText(area, gapAnalysis, visitInfo)

      expect(result.currentLevel).toBe('none')
      expect(result.progressText).toContain('not yet distinguished')
      expect(result.progressText).toContain('4 of 4 clubs paid')
      expect(result.progressText).toContain('1 of 4 distinguished')
      // Should mention all gaps
      expect(result.progressText).toContain('For Distinguished')
      expect(result.progressText).toContain('For Select Distinguished')
      expect(result.progressText).toContain("For President's Distinguished")
    })

    it('should describe gaps incrementally (not repeat requirements)', () => {
      const area = createArea('B2', 'B', 4, 4, 0)
      const gapAnalysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 4,
        distinguishedClubs: 0,
      })

      const result = generateAreaProgressText(area, gapAnalysis, undefined)

      // Distinguished needs 2 clubs (50% of 4)
      // Select needs 3 clubs (50% + 1), so 1 additional beyond Distinguished
      // President's needs 3 distinguished + 1 paid
      expect(result.progressText).toContain('For Distinguished')
      expect(result.progressText).toContain('For Select Distinguished')
      expect(result.progressText).toContain("President's Distinguished")
    })

    it('should include club visit status unknown when not provided', () => {
      const area = createArea('C3', 'C', 4, 4, 1)
      const gapAnalysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 4,
        distinguishedClubs: 1,
      })

      const result = generateAreaProgressText(area, gapAnalysis, undefined)

      expect(result.progressText).toContain('Club visits: status unknown')
    })
  })

  /**
   * Requirement 6.1, 6.6: Net club loss scenario should explain
   * eligibility requirement first, then gaps
   */
  describe('Net club loss scenario with eligibility explanation', () => {
    it('should explain eligibility requirement first (already has enough distinguished)', () => {
      // 4 clubs, 3 paid (net club loss), 2 distinguished
      // Once eligibility is met, Distinguished requirements would be met (2 = 50% of 4)
      const area = createArea('A1', 'A', 4, 3, 2)
      const gapAnalysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 3,
        distinguishedClubs: 2,
      })
      const visitInfo = createVisitInfo(3, 1, 4)

      const result = generateAreaProgressText(area, gapAnalysis, visitInfo)

      expect(result.currentLevel).toBe('none')
      expect(result.progressText).toContain('net club loss')
      expect(result.progressText).toContain('3 of 4 clubs paid')
      // Should explain eligibility requirement
      expect(result.progressText).toContain('To become eligible')
      expect(result.progressText).toContain('1 paid club')
      // Since area already has 2 distinguished (50% of 4), Distinguished would be met
      expect(result.progressText).toContain(
        'Then Distinguished requirements would be met'
      )
    })

    it('should handle significant net club loss', () => {
      // 10 clubs, 7 paid (need 3 more)
      const area = createArea('B2', 'B', 10, 7, 3)
      const gapAnalysis = calculateAreaGapAnalysis({
        clubBase: 10,
        paidClubs: 7,
        distinguishedClubs: 3,
      })

      const result = generateAreaProgressText(area, gapAnalysis, undefined)

      expect(result.progressText).toContain('net club loss')
      expect(result.progressText).toContain('7 of 10 clubs paid')
      expect(result.progressText).toContain('To become eligible')
      expect(result.progressText).toContain('3 paid clubs')
    })

    it('should include club visit status', () => {
      const area = createArea('C3', 'C', 4, 3, 2)
      const gapAnalysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 3,
        distinguishedClubs: 2,
      })
      const visitInfo = createVisitInfo(3, 0, 4)

      const result = generateAreaProgressText(area, gapAnalysis, visitInfo)

      expect(result.progressText).toContain('Club visits:')
    })

    it('should describe Distinguished requirements after eligibility', () => {
      // 4 clubs, 2 paid (need 2 more), 0 distinguished
      const area = createArea('D4', 'D', 4, 2, 0)
      const gapAnalysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 2,
        distinguishedClubs: 0,
      })

      const result = generateAreaProgressText(area, gapAnalysis, undefined)

      expect(result.progressText).toContain('To become eligible')
      expect(result.progressText).toContain('2 paid clubs')
      // After eligibility, need 2 distinguished for Distinguished (50% of 4)
      expect(result.progressText).toContain('Then for Distinguished')
      expect(result.progressText).toContain(
        '2 clubs need to become distinguished'
      )
    })
  })

  /**
   * Requirement 6.7, 6.8, 6.9: Club visit status display in terms of 75% threshold
   */
  describe('Club visit status display', () => {
    it('should show "both rounds meet 75% threshold" when threshold is met', () => {
      const area = createArea('A1', 'A', 4, 4, 2)
      const gapAnalysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 4,
        distinguishedClubs: 2,
      })
      // 75% of 4 = 3, so 3+ visits meets threshold
      const visitInfo = createVisitInfo(3, 3, 4)

      const result = generateAreaProgressText(area, gapAnalysis, visitInfo)

      expect(result.progressText).toContain('both rounds meet 75% threshold')
    })

    it('should show visits needed for 75% when threshold not met', () => {
      const area = createArea('B2', 'B', 4, 4, 2)
      const gapAnalysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 4,
        distinguishedClubs: 2,
      })
      // 75% of 4 = 3, so 2 visits needs 1 more
      const visitInfo = createVisitInfo(2, 1, 4)

      const result = generateAreaProgressText(area, gapAnalysis, visitInfo)

      expect(result.progressText).toContain('Club visits:')
      expect(result.progressText).toContain('first-round')
      expect(result.progressText).toContain('second-round')
      expect(result.progressText).toContain('75%')
    })

    it('should show "status unknown" when visit data unavailable', () => {
      const area = createArea('C3', 'C', 4, 4, 2)
      const gapAnalysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 4,
        distinguishedClubs: 2,
      })

      const result = generateAreaProgressText(area, gapAnalysis, undefined)

      expect(result.progressText).toContain('Club visits: status unknown')
    })

    it('should show visits needed when zero visits completed', () => {
      const area = createArea('D4', 'D', 4, 4, 2)
      const gapAnalysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 4,
        distinguishedClubs: 2,
      })
      const visitInfo = createVisitInfo(0, 0, 4)

      const result = generateAreaProgressText(area, gapAnalysis, visitInfo)

      // 75% of 4 = 3 visits needed
      expect(result.progressText).toContain(
        'first-round needs 3 visits for 75%'
      )
      expect(result.progressText).toContain(
        'second-round needs 3 visits for 75%'
      )
    })

    it('should show first-round meets threshold, second-round needs more', () => {
      const area = createArea('E5', 'E', 4, 4, 2)
      const gapAnalysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 4,
        distinguishedClubs: 2,
      })
      // 75% of 4 = 3, first round has 3 (meets), second has 1 (needs 2 more)
      const visitInfo = createVisitInfo(3, 1, 4)

      const result = generateAreaProgressText(area, gapAnalysis, visitInfo)

      expect(result.progressText).toContain('first-round meets 75% threshold')
      expect(result.progressText).toContain(
        'second-round 1/3 (need 2 more for 75%)'
      )
    })
  })

  /**
   * Edge cases: 0 clubs and 1 club scenarios
   */
  describe('Edge cases', () => {
    describe('0 clubs (clubBase = 0)', () => {
      it('should handle area with 0 clubs gracefully', () => {
        const area = createArea('A1', 'A', 0, 0, 0)
        const gapAnalysis = calculateAreaGapAnalysis({
          clubBase: 0,
          paidClubs: 0,
          distinguishedClubs: 0,
        })

        const result = generateAreaProgressText(area, gapAnalysis, undefined)

        expect(result.currentLevel).toBe('none')
        expect(result.areaLabel).toBe('Area A1 (Division A)')
        // Should handle gracefully without errors
        expect(result.progressText).toBeDefined()
      })

      it('should show "no clubs in area" for visit info with 0 clubs', () => {
        const area = createArea('B2', 'B', 0, 0, 0)
        const gapAnalysis = calculateAreaGapAnalysis({
          clubBase: 0,
          paidClubs: 0,
          distinguishedClubs: 0,
        })
        const visitInfo = createVisitInfo(0, 0, 0)

        const result = generateAreaProgressText(area, gapAnalysis, visitInfo)

        expect(result.progressText).toContain('no clubs in area')
      })
    })

    describe('1 club (minimum case)', () => {
      it('should handle 1 club area at Distinguished level', () => {
        // 1 club, 1 paid (no net loss), 1 distinguished (50% = ceil(0.5) = 1)
        const area = createArea('A1', 'A', 1, 1, 1)
        const gapAnalysis = calculateAreaGapAnalysis({
          clubBase: 1,
          paidClubs: 1,
          distinguishedClubs: 1,
        })

        const result = generateAreaProgressText(area, gapAnalysis, undefined)

        expect(result.currentLevel).toBe('distinguished')
        expect(result.progressText).toContain('Distinguished status')
        expect(result.progressText).toContain('1 of 1 clubs paid')
        expect(result.progressText).toContain('1 of 1 distinguished')
      })

      it('should handle 1 club area not distinguished', () => {
        // 1 club, 1 paid (no net loss), 0 distinguished
        const area = createArea('B2', 'B', 1, 1, 0)
        const gapAnalysis = calculateAreaGapAnalysis({
          clubBase: 1,
          paidClubs: 1,
          distinguishedClubs: 0,
        })

        const result = generateAreaProgressText(area, gapAnalysis, undefined)

        expect(result.currentLevel).toBe('none')
        expect(result.progressText).toContain('not yet distinguished')
        expect(result.progressText).toContain('1 of 1 clubs paid')
        expect(result.progressText).toContain('0 of 1 distinguished')
        // Should mention gap to Distinguished (need 1)
        expect(result.progressText).toContain('For Distinguished')
      })

      it('should handle 1 club area with net club loss', () => {
        // 1 club, 0 paid (net club loss)
        const area = createArea('C3', 'C', 1, 0, 0)
        const gapAnalysis = calculateAreaGapAnalysis({
          clubBase: 1,
          paidClubs: 0,
          distinguishedClubs: 0,
        })

        const result = generateAreaProgressText(area, gapAnalysis, undefined)

        expect(result.currentLevel).toBe('none')
        expect(result.progressText).toContain('net club loss')
        expect(result.progressText).toContain('0 of 1 clubs paid')
        expect(result.progressText).toContain('To become eligible')
        expect(result.progressText).toContain('1 paid club')
      })

      it('should handle 1 club area at Presidents level', () => {
        // 1 club, 2 paid (club base + 1), 2 distinguished (50% + 1 = ceil(0.5) + 1 = 2)
        const area = createArea('D4', 'D', 1, 2, 2)
        const gapAnalysis = calculateAreaGapAnalysis({
          clubBase: 1,
          paidClubs: 2,
          distinguishedClubs: 2,
        })

        const result = generateAreaProgressText(area, gapAnalysis, undefined)

        expect(result.currentLevel).toBe('presidents')
        expect(result.progressText).toContain("President's Distinguished")
      })
    })
  })

  /**
   * Area label generation tests
   */
  describe('Area label generation', () => {
    it('should format area label correctly', () => {
      const area = createArea('A1', 'A', 4, 4, 2)
      const gapAnalysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 4,
        distinguishedClubs: 2,
      })

      const result = generateAreaProgressText(area, gapAnalysis, undefined)

      expect(result.areaLabel).toBe('Area A1 (Division A)')
      expect(result.progressText).toContain('Area A1 (Division A)')
    })

    it('should handle different area and division IDs', () => {
      const area = createArea('B3', 'X', 4, 4, 2)
      const gapAnalysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 4,
        distinguishedClubs: 2,
      })

      const result = generateAreaProgressText(area, gapAnalysis, undefined)

      expect(result.areaLabel).toBe('Area B3 (Division X)')
    })
  })

  /**
   * Return value structure tests
   */
  describe('Return value structure', () => {
    it('should return correct structure for AreaProgressText', () => {
      const area = createArea('A1', 'A', 4, 4, 2)
      const gapAnalysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 4,
        distinguishedClubs: 2,
      })

      const result = generateAreaProgressText(area, gapAnalysis, undefined)

      expect(result).toHaveProperty('areaLabel')
      expect(result).toHaveProperty('currentLevel')
      expect(result).toHaveProperty('progressText')
      expect(typeof result.areaLabel).toBe('string')
      expect(typeof result.currentLevel).toBe('string')
      expect(typeof result.progressText).toBe('string')
    })

    it('should return currentLevel matching gap analysis', () => {
      const area = createArea('A1', 'A', 4, 5, 3)
      const gapAnalysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 5,
        distinguishedClubs: 3,
      })

      const result = generateAreaProgressText(area, gapAnalysis, undefined)

      expect(result.currentLevel).toBe(gapAnalysis.currentLevel)
    })
  })

  /**
   * Text formatting tests - ensure no double spaces or formatting issues
   */
  describe('Text formatting', () => {
    it('should not have double spaces in progress text', () => {
      const area = createArea('A1', 'A', 4, 4, 2)
      const gapAnalysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 4,
        distinguishedClubs: 2,
      })

      const result = generateAreaProgressText(area, gapAnalysis, undefined)

      expect(result.progressText).not.toMatch(/\s{2,}/)
    })

    it('should have proper sentence structure', () => {
      const area = createArea('A1', 'A', 4, 4, 2)
      const gapAnalysis = calculateAreaGapAnalysis({
        clubBase: 4,
        paidClubs: 4,
        distinguishedClubs: 2,
      })

      const result = generateAreaProgressText(area, gapAnalysis, undefined)

      // Should start with area label
      expect(result.progressText).toMatch(/^Area/)
      // Should end with a period
      expect(result.progressText).toMatch(/\.$/)
    })
  })

  /**
   * Larger area scenarios (10+ clubs)
   */
  describe('Larger area scenarios', () => {
    it('should handle 10 club area at Distinguished', () => {
      // 10 clubs, 10 paid, 5 distinguished (50% = ceil(5) = 5)
      const area = createArea('A1', 'A', 10, 10, 5)
      const gapAnalysis = calculateAreaGapAnalysis({
        clubBase: 10,
        paidClubs: 10,
        distinguishedClubs: 5,
      })

      const result = generateAreaProgressText(area, gapAnalysis, undefined)

      expect(result.currentLevel).toBe('distinguished')
      expect(result.progressText).toContain('10 of 10 clubs paid')
      expect(result.progressText).toContain('5 of 10 distinguished')
    })

    it('should handle 10 club area not distinguished', () => {
      // 10 clubs, 10 paid, 4 distinguished (40% - below 50%)
      const area = createArea('B2', 'B', 10, 10, 4)
      const gapAnalysis = calculateAreaGapAnalysis({
        clubBase: 10,
        paidClubs: 10,
        distinguishedClubs: 4,
      })

      const result = generateAreaProgressText(area, gapAnalysis, undefined)

      expect(result.currentLevel).toBe('none')
      expect(result.progressText).toContain('not yet distinguished')
      // Need 1 more for Distinguished (50% of 10 = 5)
      expect(result.progressText).toContain('For Distinguished')
    })
  })
})
