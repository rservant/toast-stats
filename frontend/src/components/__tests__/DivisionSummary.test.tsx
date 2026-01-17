/**
 * Unit Tests for DivisionSummary Component
 *
 * Tests the rendering and behavior of the DivisionSummary component,
 * verifying that it correctly displays division identifier, status badge,
 * paid clubs progress, and distinguished clubs progress.
 *
 * Validates Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 8.1, 8.3
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import DivisionSummary from '../DivisionSummary'
// DistinguishedStatus type is used implicitly through the status prop

describe('DivisionSummary', () => {
  describe('Division Identifier Display (Requirement 3.1)', () => {
    it('should display the division identifier', () => {
      render(
        <DivisionSummary
          divisionId="A"
          status="distinguished"
          paidClubs={10}
          clubBase={10}
          netGrowth={0}
          distinguishedClubs={5}
          requiredDistinguishedClubs={5}
        />
      )

      expect(screen.getByText('Division A')).toBeInTheDocument()
    })

    it('should display different division identifiers', () => {
      const { rerender } = render(
        <DivisionSummary
          divisionId="B"
          status="distinguished"
          paidClubs={10}
          clubBase={10}
          netGrowth={0}
          distinguishedClubs={5}
          requiredDistinguishedClubs={5}
        />
      )

      expect(screen.getByText('Division B')).toBeInTheDocument()

      rerender(
        <DivisionSummary
          divisionId="C"
          status="distinguished"
          paidClubs={10}
          clubBase={10}
          netGrowth={0}
          distinguishedClubs={5}
          requiredDistinguishedClubs={5}
        />
      )

      expect(screen.getByText('Division C')).toBeInTheDocument()
    })
  })

  describe('Status Badge Display (Requirement 3.2, 3.5)', () => {
    it('should display "President\'s Distinguished" status', () => {
      render(
        <DivisionSummary
          divisionId="A"
          status="presidents-distinguished"
          paidClubs={12}
          clubBase={10}
          netGrowth={2}
          distinguishedClubs={6}
          requiredDistinguishedClubs={5}
        />
      )

      expect(screen.getByText("President's Distinguished")).toBeInTheDocument()
      expect(
        screen.getByRole('status', {
          name: /Division status: President's Distinguished/i,
        })
      ).toBeInTheDocument()
    })

    it('should display "Select Distinguished" status', () => {
      render(
        <DivisionSummary
          divisionId="A"
          status="select-distinguished"
          paidClubs={10}
          clubBase={10}
          netGrowth={0}
          distinguishedClubs={6}
          requiredDistinguishedClubs={5}
        />
      )

      expect(screen.getByText('Select Distinguished')).toBeInTheDocument()
      expect(
        screen.getByRole('status', {
          name: /Division status: Select Distinguished/i,
        })
      ).toBeInTheDocument()
    })

    it('should display "Distinguished" status', () => {
      render(
        <DivisionSummary
          divisionId="A"
          status="distinguished"
          paidClubs={10}
          clubBase={10}
          netGrowth={0}
          distinguishedClubs={5}
          requiredDistinguishedClubs={5}
        />
      )

      expect(screen.getByText('Distinguished')).toBeInTheDocument()
      expect(
        screen.getByRole('status', { name: /Division status: Distinguished/i })
      ).toBeInTheDocument()
    })

    it('should display "Not Distinguished" status', () => {
      render(
        <DivisionSummary
          divisionId="A"
          status="not-distinguished"
          paidClubs={10}
          clubBase={10}
          netGrowth={0}
          distinguishedClubs={4}
          requiredDistinguishedClubs={5}
        />
      )

      expect(screen.getByText('Not Distinguished')).toBeInTheDocument()
      expect(
        screen.getByRole('status', {
          name: /Division status: Not Distinguished/i,
        })
      ).toBeInTheDocument()
    })
  })

  describe('Paid Clubs Progress Display (Requirement 3.3)', () => {
    it('should display paid clubs in "current / base" format', () => {
      render(
        <DivisionSummary
          divisionId="A"
          status="distinguished"
          paidClubs={12}
          clubBase={10}
          netGrowth={2}
          distinguishedClubs={5}
          requiredDistinguishedClubs={5}
        />
      )

      expect(screen.getByText('Paid Clubs')).toBeInTheDocument()
      expect(screen.getByText(/12 \/ 10/)).toBeInTheDocument()
    })

    it('should display positive net growth with up arrow and plus sign', () => {
      render(
        <DivisionSummary
          divisionId="A"
          status="distinguished"
          paidClubs={12}
          clubBase={10}
          netGrowth={2}
          distinguishedClubs={5}
          requiredDistinguishedClubs={5}
        />
      )

      const netGrowthElement = screen.getByLabelText(/Net growth: positive 2/i)
      expect(netGrowthElement).toBeInTheDocument()
      expect(netGrowthElement).toHaveTextContent('↑')
      expect(netGrowthElement).toHaveTextContent('+2')
    })

    it('should display negative net growth with down arrow', () => {
      render(
        <DivisionSummary
          divisionId="A"
          status="not-distinguished"
          paidClubs={8}
          clubBase={10}
          netGrowth={-2}
          distinguishedClubs={4}
          requiredDistinguishedClubs={5}
        />
      )

      const netGrowthElement = screen.getByLabelText(/Net growth: negative 2/i)
      expect(netGrowthElement).toBeInTheDocument()
      expect(netGrowthElement).toHaveTextContent('↓')
      expect(netGrowthElement).toHaveTextContent('-2')
    })

    it('should display zero net growth with neutral arrow', () => {
      render(
        <DivisionSummary
          divisionId="A"
          status="distinguished"
          paidClubs={10}
          clubBase={10}
          netGrowth={0}
          distinguishedClubs={5}
          requiredDistinguishedClubs={5}
        />
      )

      const netGrowthElement = screen.getByLabelText(/Net growth: neutral 0/i)
      expect(netGrowthElement).toBeInTheDocument()
      expect(netGrowthElement).toHaveTextContent('→')
      expect(netGrowthElement).toHaveTextContent('0')
    })
  })

  describe('Distinguished Clubs Progress Display (Requirement 3.4)', () => {
    it('should display distinguished clubs in "current / required" format', () => {
      render(
        <DivisionSummary
          divisionId="A"
          status="distinguished"
          paidClubs={10}
          clubBase={10}
          netGrowth={0}
          distinguishedClubs={5}
          requiredDistinguishedClubs={5}
        />
      )

      expect(screen.getByText('Distinguished Clubs')).toBeInTheDocument()
      expect(screen.getByText(/5 \/ 5/)).toBeInTheDocument()
    })

    it('should display checkmark when threshold is met', () => {
      render(
        <DivisionSummary
          divisionId="A"
          status="distinguished"
          paidClubs={10}
          clubBase={10}
          netGrowth={0}
          distinguishedClubs={5}
          requiredDistinguishedClubs={5}
        />
      )

      expect(screen.getByLabelText('Threshold met')).toBeInTheDocument()
      expect(screen.getByText('✓')).toBeInTheDocument()
    })

    it('should display checkmark when threshold is exceeded', () => {
      render(
        <DivisionSummary
          divisionId="A"
          status="select-distinguished"
          paidClubs={10}
          clubBase={10}
          netGrowth={0}
          distinguishedClubs={6}
          requiredDistinguishedClubs={5}
        />
      )

      expect(screen.getByLabelText('Threshold met')).toBeInTheDocument()
      expect(screen.getByText('✓')).toBeInTheDocument()
    })

    it('should not display checkmark when threshold is not met', () => {
      render(
        <DivisionSummary
          divisionId="A"
          status="not-distinguished"
          paidClubs={10}
          clubBase={10}
          netGrowth={0}
          distinguishedClubs={4}
          requiredDistinguishedClubs={5}
        />
      )

      expect(screen.queryByLabelText('Threshold met')).not.toBeInTheDocument()
      expect(screen.queryByText('✓')).not.toBeInTheDocument()
    })
  })

  describe('Visual Indicators (Requirement 3.5)', () => {
    it('should use different colors for different status levels', () => {
      const { rerender } = render(
        <DivisionSummary
          divisionId="A"
          status="presidents-distinguished"
          paidClubs={12}
          clubBase={10}
          netGrowth={2}
          distinguishedClubs={6}
          requiredDistinguishedClubs={5}
        />
      )

      let statusBadge = screen.getByRole('status', { name: /Division status/i })
      expect(statusBadge).toHaveClass('tm-bg-loyal-blue')

      rerender(
        <DivisionSummary
          divisionId="A"
          status="not-distinguished"
          paidClubs={10}
          clubBase={10}
          netGrowth={0}
          distinguishedClubs={4}
          requiredDistinguishedClubs={5}
        />
      )

      statusBadge = screen.getByRole('status', { name: /Division status/i })
      expect(statusBadge).toHaveClass('tm-bg-cool-gray-40')
    })

    it('should use color indicators for net growth', () => {
      const { rerender } = render(
        <DivisionSummary
          divisionId="A"
          status="distinguished"
          paidClubs={12}
          clubBase={10}
          netGrowth={2}
          distinguishedClubs={5}
          requiredDistinguishedClubs={5}
        />
      )

      let netGrowthElement = screen.getByLabelText(/Net growth: positive/i)
      expect(netGrowthElement).toHaveClass('tm-text-loyal-blue')

      rerender(
        <DivisionSummary
          divisionId="A"
          status="not-distinguished"
          paidClubs={8}
          clubBase={10}
          netGrowth={-2}
          distinguishedClubs={4}
          requiredDistinguishedClubs={5}
        />
      )

      netGrowthElement = screen.getByLabelText(/Net growth: negative/i)
      expect(netGrowthElement).toHaveClass('tm-text-true-maroon')
    })
  })

  describe('Brand Compliance (Requirements 8.1, 8.3)', () => {
    it('should use TM Loyal Blue for division heading', () => {
      render(
        <DivisionSummary
          divisionId="A"
          status="distinguished"
          paidClubs={10}
          clubBase={10}
          netGrowth={0}
          distinguishedClubs={5}
          requiredDistinguishedClubs={5}
        />
      )

      const heading = screen.getByText('Division A')
      expect(heading).toHaveClass('tm-text-loyal-blue')
    })

    it('should use Montserrat font for headings', () => {
      render(
        <DivisionSummary
          divisionId="A"
          status="distinguished"
          paidClubs={10}
          clubBase={10}
          netGrowth={0}
          distinguishedClubs={5}
          requiredDistinguishedClubs={5}
        />
      )

      const heading = screen.getByText('Division A')
      expect(heading).toHaveClass('tm-h2')
    })
  })

  describe('Edge Cases', () => {
    it('should handle zero club base', () => {
      render(
        <DivisionSummary
          divisionId="A"
          status="not-distinguished"
          paidClubs={0}
          clubBase={0}
          netGrowth={0}
          distinguishedClubs={0}
          requiredDistinguishedClubs={0}
        />
      )

      expect(screen.getByText('Paid Clubs')).toBeInTheDocument()
      expect(screen.getByText('Distinguished Clubs')).toBeInTheDocument()
      expect(screen.getAllByText(/0 \/ 0/)).toHaveLength(2)
    })

    it('should handle large numbers', () => {
      render(
        <DivisionSummary
          divisionId="A"
          status="distinguished"
          paidClubs={100}
          clubBase={95}
          netGrowth={5}
          distinguishedClubs={50}
          requiredDistinguishedClubs={48}
        />
      )

      expect(screen.getByText(/100 \/ 95/)).toBeInTheDocument()
      expect(screen.getByText(/50 \/ 48/)).toBeInTheDocument()
    })
  })
})
