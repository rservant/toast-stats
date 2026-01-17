import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AreaPerformanceRow } from '../AreaPerformanceRow'
import { AreaPerformance } from '../../utils/divisionStatus'

describe('AreaPerformanceRow', () => {
  const createMockArea = (
    overrides: Partial<AreaPerformance> = {}
  ): AreaPerformance => ({
    areaId: 'A1',
    status: 'distinguished',
    clubBase: 10,
    paidClubs: 10,
    netGrowth: 0,
    distinguishedClubs: 5,
    requiredDistinguishedClubs: 5,
    firstRoundVisits: {
      completed: 8,
      required: 8,
      percentage: 80,
      meetsThreshold: true,
    },
    secondRoundVisits: {
      completed: 8,
      required: 8,
      percentage: 80,
      meetsThreshold: true,
    },
    isQualified: true,
    ...overrides,
  })

  describe('Requirement 6.2: Area Identifier Display', () => {
    it('should display the area identifier', () => {
      const area = createMockArea({ areaId: 'B3' })
      render(
        <table>
          <tbody>
            <AreaPerformanceRow area={area} />
          </tbody>
        </table>
      )

      expect(screen.getByText('B3')).toBeInTheDocument()
    })
  })

  describe('Requirement 6.3: Paid Clubs with Net Growth', () => {
    it('should display paid clubs in "current/base" format', () => {
      const area = createMockArea({ paidClubs: 12, clubBase: 10 })
      render(
        <table>
          <tbody>
            <AreaPerformanceRow area={area} />
          </tbody>
        </table>
      )

      expect(screen.getByText('12/10')).toBeInTheDocument()
    })

    it('should display positive net growth with + sign', () => {
      const area = createMockArea({ paidClubs: 12, clubBase: 10, netGrowth: 2 })
      render(
        <table>
          <tbody>
            <AreaPerformanceRow area={area} />
          </tbody>
        </table>
      )

      expect(screen.getByText('(+2)')).toBeInTheDocument()
    })

    it('should display negative net growth with - sign', () => {
      const area = createMockArea({ paidClubs: 8, clubBase: 10, netGrowth: -2 })
      render(
        <table>
          <tbody>
            <AreaPerformanceRow area={area} />
          </tbody>
        </table>
      )

      expect(screen.getByText('(-2)')).toBeInTheDocument()
    })

    it('should display zero net growth', () => {
      const area = createMockArea({ paidClubs: 10, clubBase: 10, netGrowth: 0 })
      render(
        <table>
          <tbody>
            <AreaPerformanceRow area={area} />
          </tbody>
        </table>
      )

      expect(screen.getByText('(0)')).toBeInTheDocument()
    })
  })

  describe('Requirement 6.4: Distinguished Clubs Progress', () => {
    it('should display distinguished clubs in "current/required" format', () => {
      const area = createMockArea({
        distinguishedClubs: 6,
        requiredDistinguishedClubs: 5,
      })
      render(
        <table>
          <tbody>
            <AreaPerformanceRow area={area} />
          </tbody>
        </table>
      )

      expect(screen.getByText('6/5')).toBeInTheDocument()
    })
  })

  describe('Requirement 6.5: First Round Visit Status', () => {
    it('should display first round visit status with checkmark when threshold met', () => {
      const area = createMockArea({
        firstRoundVisits: {
          completed: 8,
          required: 8,
          percentage: 80,
          meetsThreshold: true,
        },
        secondRoundVisits: {
          completed: 7,
          required: 8,
          percentage: 87.5,
          meetsThreshold: false,
        },
      })
      const { container } = render(
        <table>
          <tbody>
            <AreaPerformanceRow area={area} />
          </tbody>
        </table>
      )

      // Get all cells and check the 4th one (first round visits)
      const cells = container.querySelectorAll('td')
      expect(cells[3].textContent).toBe('8/8 ✓')
    })

    it('should display first round visit status with X when threshold not met', () => {
      const area = createMockArea({
        firstRoundVisits: {
          completed: 5,
          required: 8,
          percentage: 62.5,
          meetsThreshold: false,
        },
      })
      render(
        <table>
          <tbody>
            <AreaPerformanceRow area={area} />
          </tbody>
        </table>
      )

      expect(screen.getByText('5/8 ✗')).toBeInTheDocument()
    })
  })

  describe('Requirement 6.6: Second Round Visit Status', () => {
    it('should display second round visit status with checkmark when threshold met', () => {
      const area = createMockArea({
        secondRoundVisits: {
          completed: 9,
          required: 8,
          percentage: 90,
          meetsThreshold: true,
        },
      })
      render(
        <table>
          <tbody>
            <AreaPerformanceRow area={area} />
          </tbody>
        </table>
      )

      expect(screen.getByText('9/8 ✓')).toBeInTheDocument()
    })

    it('should display second round visit status with X when threshold not met', () => {
      const area = createMockArea({
        secondRoundVisits: {
          completed: 6,
          required: 8,
          percentage: 75,
          meetsThreshold: false,
        },
      })
      render(
        <table>
          <tbody>
            <AreaPerformanceRow area={area} />
          </tbody>
        </table>
      )

      expect(screen.getByText('6/8 ✗')).toBeInTheDocument()
    })
  })

  describe('Requirement 6.7: Status Display', () => {
    it('should display "President\'s Distinguished" status', () => {
      const area = createMockArea({ status: 'presidents-distinguished' })
      render(
        <table>
          <tbody>
            <AreaPerformanceRow area={area} />
          </tbody>
        </table>
      )

      expect(screen.getByText("President's Distinguished")).toBeInTheDocument()
    })

    it('should display "Select Distinguished" status', () => {
      const area = createMockArea({ status: 'select-distinguished' })
      render(
        <table>
          <tbody>
            <AreaPerformanceRow area={area} />
          </tbody>
        </table>
      )

      expect(screen.getByText('Select Distinguished')).toBeInTheDocument()
    })

    it('should display "Distinguished" status', () => {
      const area = createMockArea({ status: 'distinguished' })
      render(
        <table>
          <tbody>
            <AreaPerformanceRow area={area} />
          </tbody>
        </table>
      )

      expect(screen.getByText('Distinguished')).toBeInTheDocument()
    })

    it('should display "Not Qualified" status', () => {
      const area = createMockArea({ status: 'not-qualified' })
      render(
        <table>
          <tbody>
            <AreaPerformanceRow area={area} />
          </tbody>
        </table>
      )

      expect(screen.getByText('Not Qualified')).toBeInTheDocument()
    })

    it('should display "Not Distinguished" status', () => {
      const area = createMockArea({ status: 'not-distinguished' })
      render(
        <table>
          <tbody>
            <AreaPerformanceRow area={area} />
          </tbody>
        </table>
      )

      expect(screen.getByText('Not Distinguished')).toBeInTheDocument()
    })
  })

  describe('Requirements 8.1, 8.2: Brand Styling', () => {
    it('should apply Toastmasters brand font classes', () => {
      const area = createMockArea()
      const { container } = render(
        <table>
          <tbody>
            <AreaPerformanceRow area={area} />
          </tbody>
        </table>
      )

      // Check that font-tm-body class is applied
      const bodyElements = container.querySelectorAll('.font-tm-body')
      expect(bodyElements.length).toBeGreaterThan(0)
    })

    it('should apply brand-approved colors for status badges', () => {
      const area = createMockArea({ status: 'presidents-distinguished' })
      render(
        <table>
          <tbody>
            <AreaPerformanceRow area={area} />
          </tbody>
        </table>
      )

      // Check that status badge has brand color classes
      const statusBadge = screen.getByText("President's Distinguished")
      expect(statusBadge.className).toMatch(/bg-tm-happy-yellow-20/)
      expect(statusBadge.className).toMatch(/text-tm-true-maroon/)
    })
  })

  describe('Edge Cases', () => {
    it('should handle zero club base', () => {
      const area = createMockArea({
        clubBase: 0,
        paidClubs: 0,
        netGrowth: 0,
        distinguishedClubs: 0,
        requiredDistinguishedClubs: 0,
      })
      const { container } = render(
        <table>
          <tbody>
            <AreaPerformanceRow area={area} />
          </tbody>
        </table>
      )

      // Check that both paid clubs and distinguished clubs show 0/0
      const cells = container.querySelectorAll('td')
      expect(cells[1].textContent).toContain('0/0')
      expect(cells[2].textContent).toBe('0/0')
    })

    it('should handle large numbers', () => {
      const area = createMockArea({
        paidClubs: 100,
        clubBase: 95,
        netGrowth: 5,
        distinguishedClubs: 55,
        requiredDistinguishedClubs: 48,
      })
      render(
        <table>
          <tbody>
            <AreaPerformanceRow area={area} />
          </tbody>
        </table>
      )

      expect(screen.getByText('100/95')).toBeInTheDocument()
      expect(screen.getByText('(+5)')).toBeInTheDocument()
      expect(screen.getByText('55/48')).toBeInTheDocument()
    })
  })
})
