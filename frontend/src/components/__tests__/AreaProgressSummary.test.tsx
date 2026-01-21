/**
 * AreaProgressSummary Component Tests
 *
 * Tests for the Area Progress Summary component that displays all areas
 * with concise English paragraphs describing their progress toward
 * Distinguished Area recognition.
 *
 * Requirements validated:
 * - 5.1: Display all areas in the district with their current progress as concise English paragraphs
 * - 7.4: Semantic HTML with appropriate ARIA labels
 *
 * Test categories:
 * 1. All areas displayed with paragraphs
 * 2. Division grouping
 * 3. Empty state
 * 4. Loading state
 * 5. Accessibility attributes
 * 6. Recognition badges
 * 7. Area count display
 */

import { describe, it, expect, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { AreaProgressSummary, AreaWithDivision } from '../AreaProgressSummary'
import {
  renderWithProviders,
  cleanupAllResources,
} from '../../__tests__/utils/componentTestUtils'

/**
 * Test data factory for creating area data
 */
const createArea = (
  overrides: Partial<AreaWithDivision> = {}
): AreaWithDivision => ({
  areaId: 'A1',
  divisionId: 'A',
  clubBase: 4,
  paidClubs: 4,
  distinguishedClubs: 2,
  netGrowth: 0,
  requiredDistinguishedClubs: 2,
  firstRoundVisits: {
    completed: 4,
    required: 3,
    percentage: 100,
    meetsThreshold: true,
  },
  secondRoundVisits: {
    completed: 2,
    required: 3,
    percentage: 50,
    meetsThreshold: false,
  },
  status: 'distinguished',
  isQualified: true,
  ...overrides,
})

describe('AreaProgressSummary', () => {
  afterEach(() => {
    cleanupAllResources()
  })

  describe('All Areas Displayed with Paragraphs', () => {
    /**
     * Validates: Requirement 5.1
     * THE System SHALL display all areas in the district with their current progress
     * as concise English paragraphs
     */
    it('should display all areas from all divisions exactly once', () => {
      const areas: AreaWithDivision[] = [
        createArea({ areaId: 'A1', divisionId: 'A' }),
        createArea({ areaId: 'A2', divisionId: 'A' }),
        createArea({ areaId: 'B1', divisionId: 'B' }),
        createArea({ areaId: 'C1', divisionId: 'C' }),
      ]

      renderWithProviders(<AreaProgressSummary areas={areas} />)

      // Each area should appear exactly once as a heading
      expect(screen.getByText('Area A1')).toBeInTheDocument()
      expect(screen.getByText('Area A2')).toBeInTheDocument()
      expect(screen.getByText('Area B1')).toBeInTheDocument()
      expect(screen.getByText('Area C1')).toBeInTheDocument()
    })

    /**
     * Validates: Requirement 5.1
     * Each area should have a progress paragraph
     */
    it('should display progress paragraph for each area', () => {
      const areas: AreaWithDivision[] = [
        createArea({
          areaId: 'A1',
          divisionId: 'A',
          clubBase: 4,
          paidClubs: 4,
          distinguishedClubs: 2,
        }),
      ]

      renderWithProviders(<AreaProgressSummary areas={areas} />)

      // Should contain progress text with metrics
      expect(screen.getByText(/4 of 4 clubs paid/)).toBeInTheDocument()
      expect(screen.getByText(/2 of 4 distinguished/)).toBeInTheDocument()
    })

    /**
     * Validates: Requirement 5.1
     * Single area should display correctly
     */
    it('should display single area correctly', () => {
      const areas: AreaWithDivision[] = [
        createArea({ areaId: 'A1', divisionId: 'A' }),
      ]

      renderWithProviders(<AreaProgressSummary areas={areas} />)

      expect(screen.getByText('Area A1')).toBeInTheDocument()
      expect(screen.getByText('1 area in 1 division')).toBeInTheDocument()
    })

    /**
     * Validates: Requirement 5.1
     * Progress text should include area label with division context
     */
    it('should include area label with division context in progress text', () => {
      const areas: AreaWithDivision[] = [
        createArea({ areaId: 'A1', divisionId: 'A' }),
      ]

      renderWithProviders(<AreaProgressSummary areas={areas} />)

      // Progress text should mention "Area A1 (Division A)"
      expect(screen.getByText(/Area A1 \(Division A\)/)).toBeInTheDocument()
    })
  })

  describe('Division Grouping', () => {
    /**
     * Validates: Requirement 5.5
     * THE progress descriptions SHALL be grouped by division for context
     */
    it('should group areas by division', () => {
      const areas: AreaWithDivision[] = [
        createArea({ areaId: 'A1', divisionId: 'A' }),
        createArea({ areaId: 'A2', divisionId: 'A' }),
        createArea({ areaId: 'B1', divisionId: 'B' }),
      ]

      renderWithProviders(<AreaProgressSummary areas={areas} />)

      // Division headers should be present
      expect(screen.getByText('Division A')).toBeInTheDocument()
      expect(screen.getByText('Division B')).toBeInTheDocument()
    })

    /**
     * Validates: Requirement 5.5
     * Areas should be sorted within divisions
     */
    it('should sort areas within each division', () => {
      const areas: AreaWithDivision[] = [
        createArea({ areaId: 'A3', divisionId: 'A' }),
        createArea({ areaId: 'A1', divisionId: 'A' }),
        createArea({ areaId: 'A2', divisionId: 'A' }),
      ]

      const { container } = renderWithProviders(
        <AreaProgressSummary areas={areas} />
      )

      // Get all area headings within Division A section
      const divisionASection = container.querySelector(
        '[aria-labelledby="division-A-heading"]'
      )
      expect(divisionASection).toBeInTheDocument()

      const areaHeadings = divisionASection!.querySelectorAll('h5')
      const areaTexts = Array.from(areaHeadings).map(h => h.textContent)

      // Should be sorted: A1, A2, A3
      expect(areaTexts).toEqual(['Area A1', 'Area A2', 'Area A3'])
    })

    /**
     * Validates: Requirement 5.5
     * Divisions should be sorted alphabetically
     */
    it('should sort divisions alphabetically', () => {
      const areas: AreaWithDivision[] = [
        createArea({ areaId: 'C1', divisionId: 'C' }),
        createArea({ areaId: 'A1', divisionId: 'A' }),
        createArea({ areaId: 'B1', divisionId: 'B' }),
      ]

      const { container } = renderWithProviders(
        <AreaProgressSummary areas={areas} />
      )

      // Get all division headings
      const divisionHeadings = container.querySelectorAll('h4')
      const divisionTexts = Array.from(divisionHeadings).map(h => h.textContent)

      // Should be sorted: A, B, C
      expect(divisionTexts).toEqual(['Division A', 'Division B', 'Division C'])
    })

    /**
     * Validates: Requirement 5.5
     * Each division section should have proper aria-labelledby
     */
    it('should have proper aria-labelledby on division sections', () => {
      const areas: AreaWithDivision[] = [
        createArea({ areaId: 'A1', divisionId: 'A' }),
        createArea({ areaId: 'B1', divisionId: 'B' }),
      ]

      const { container } = renderWithProviders(
        <AreaProgressSummary areas={areas} />
      )

      // Each division section should reference its heading
      const divisionASection = container.querySelector(
        '[aria-labelledby="division-A-heading"]'
      )
      const divisionBSection = container.querySelector(
        '[aria-labelledby="division-B-heading"]'
      )

      expect(divisionASection).toBeInTheDocument()
      expect(divisionBSection).toBeInTheDocument()
    })
  })

  describe('Empty State', () => {
    /**
     * Tests empty state when no areas provided
     */
    it('should display empty state message when no areas', () => {
      renderWithProviders(<AreaProgressSummary areas={[]} />)

      expect(screen.getByText('No Area Data')).toBeInTheDocument()
    })

    /**
     * Tests empty state description text
     */
    it('should display empty state description', () => {
      renderWithProviders(<AreaProgressSummary areas={[]} />)

      expect(
        screen.getByText(/No area performance data is available/i)
      ).toBeInTheDocument()
    })

    /**
     * Tests that section header is still displayed in empty state
     */
    it('should still display section header in empty state', () => {
      renderWithProviders(<AreaProgressSummary areas={[]} />)

      expect(screen.getByText('Area Progress Summary')).toBeInTheDocument()
    })

    /**
     * Tests that division groups are not rendered in empty state
     */
    it('should not render division groups in empty state', () => {
      const { container } = renderWithProviders(
        <AreaProgressSummary areas={[]} />
      )

      // No division sections should be present
      const divisionSections = container.querySelectorAll(
        '[aria-labelledby^="division-"]'
      )
      expect(divisionSections.length).toBe(0)
    })

    /**
     * Tests empty state when areas is undefined (defensive)
     */
    it('should handle undefined areas gracefully', () => {
      // TypeScript would normally prevent this, but testing defensive behavior
      renderWithProviders(
        <AreaProgressSummary
          areas={undefined as unknown as AreaWithDivision[]}
        />
      )

      expect(screen.getByText('No Area Data')).toBeInTheDocument()
    })
  })

  describe('Loading State', () => {
    /**
     * Tests loading state display
     */
    it('should display loading skeleton when isLoading is true', () => {
      renderWithProviders(<AreaProgressSummary areas={[]} isLoading={true} />)

      // Loading state should have role="status" and aria-label
      expect(
        screen.getByRole('status', { name: /loading area progress summaries/i })
      ).toBeInTheDocument()
    })

    /**
     * Tests aria-busy attribute during loading
     */
    it('should set aria-busy attribute when loading', () => {
      renderWithProviders(<AreaProgressSummary areas={[]} isLoading={true} />)

      const loadingContainer = screen.getByRole('status', {
        name: /loading area progress summaries/i,
      })
      expect(loadingContainer).toHaveAttribute('aria-busy', 'true')
    })

    /**
     * Tests that content is not rendered during loading
     */
    it('should not render area content during loading', () => {
      const areas: AreaWithDivision[] = [
        createArea({ areaId: 'A1', divisionId: 'A' }),
      ]

      renderWithProviders(
        <AreaProgressSummary areas={areas} isLoading={true} />
      )

      // Area content should not be visible
      expect(screen.queryByText('Area A1')).not.toBeInTheDocument()
    })

    /**
     * Tests that empty state is not shown during loading
     */
    it('should not show empty state during loading', () => {
      renderWithProviders(<AreaProgressSummary areas={[]} isLoading={true} />)

      expect(screen.queryByText('No Area Data')).not.toBeInTheDocument()
    })

    /**
     * Tests loading skeleton has screen reader text
     */
    it('should have screen reader text during loading', () => {
      renderWithProviders(<AreaProgressSummary areas={[]} isLoading={true} />)

      expect(
        screen.getByText('Loading area progress summaries...')
      ).toBeInTheDocument()
    })
  })

  describe('Accessibility Attributes', () => {
    /**
     * Validates: Requirement 7.4
     * THE Criteria_Display SHALL use semantic HTML with appropriate ARIA labels
     */
    it('should have proper role="region" on main section', () => {
      const areas: AreaWithDivision[] = [createArea()]

      renderWithProviders(<AreaProgressSummary areas={areas} />)

      const section = screen.getByRole('region', {
        name: /area progress summary/i,
      })
      expect(section).toBeInTheDocument()
    })

    /**
     * Validates: Requirement 7.4
     * Each area should be an article element
     */
    it('should use article elements for each area', () => {
      const areas: AreaWithDivision[] = [
        createArea({ areaId: 'A1', divisionId: 'A' }),
        createArea({ areaId: 'A2', divisionId: 'A' }),
      ]

      const { container } = renderWithProviders(
        <AreaProgressSummary areas={areas} />
      )

      const articles = container.querySelectorAll('article')
      expect(articles.length).toBe(2)
    })

    /**
     * Validates: Requirement 7.4
     * Each area article should have aria-labelledby
     */
    it('should have aria-labelledby on area articles', () => {
      const areas: AreaWithDivision[] = [
        createArea({ areaId: 'A1', divisionId: 'A' }),
      ]

      const { container } = renderWithProviders(
        <AreaProgressSummary areas={areas} />
      )

      const article = container.querySelector('article')
      expect(article).toHaveAttribute('aria-labelledby', 'area-A-A1-heading')
    })

    /**
     * Validates: Requirement 7.4
     * Recognition badges should have aria-label
     */
    it('should have aria-label on recognition badges', () => {
      const areas: AreaWithDivision[] = [
        createArea({
          areaId: 'A1',
          divisionId: 'A',
          clubBase: 4,
          paidClubs: 4,
          distinguishedClubs: 2,
        }),
      ]

      renderWithProviders(<AreaProgressSummary areas={areas} />)

      // Badge should have aria-label describing the recognition status
      const badge = screen.getByLabelText(/recognition status/i)
      expect(badge).toBeInTheDocument()
    })

    /**
     * Validates: Requirement 7.4
     * Section should use semantic header element
     */
    it('should use semantic header element', () => {
      const areas: AreaWithDivision[] = [createArea()]

      const { container } = renderWithProviders(
        <AreaProgressSummary areas={areas} />
      )

      const header = container.querySelector('header')
      expect(header).toBeInTheDocument()
    })

    /**
     * Validates: Requirement 7.4
     * Section should use semantic footer element
     */
    it('should use semantic footer element', () => {
      const areas: AreaWithDivision[] = [createArea()]

      const { container } = renderWithProviders(
        <AreaProgressSummary areas={areas} />
      )

      const footer = container.querySelector('footer')
      expect(footer).toBeInTheDocument()
    })
  })

  describe('Recognition Badges', () => {
    /**
     * Tests badge styling for President's Distinguished
     */
    it("should display President's Distinguished badge with correct styling", () => {
      const areas: AreaWithDivision[] = [
        // President's Distinguished: clubBase+1 paid AND 50%+1 distinguished
        createArea({
          areaId: 'A1',
          divisionId: 'A',
          clubBase: 4,
          paidClubs: 5,
          distinguishedClubs: 3,
        }),
      ]

      renderWithProviders(<AreaProgressSummary areas={areas} />)

      expect(screen.getByText("President's Distinguished")).toBeInTheDocument()
    })

    /**
     * Tests badge styling for Select Distinguished
     */
    it('should display Select Distinguished badge', () => {
      const areas: AreaWithDivision[] = [
        // Select Distinguished: clubBase paid AND 50%+1 distinguished
        createArea({
          areaId: 'A1',
          divisionId: 'A',
          clubBase: 4,
          paidClubs: 4,
          distinguishedClubs: 3,
        }),
      ]

      renderWithProviders(<AreaProgressSummary areas={areas} />)

      expect(screen.getByText('Select Distinguished')).toBeInTheDocument()
    })

    /**
     * Tests badge styling for Distinguished
     */
    it('should display Distinguished badge', () => {
      const areas: AreaWithDivision[] = [
        // Distinguished: clubBase paid AND 50% distinguished
        createArea({
          areaId: 'A1',
          divisionId: 'A',
          clubBase: 4,
          paidClubs: 4,
          distinguishedClubs: 2,
        }),
      ]

      renderWithProviders(<AreaProgressSummary areas={areas} />)

      // Use getAllByText since "Distinguished" may appear in multiple places
      const badges = screen.getAllByText('Distinguished')
      expect(badges.length).toBeGreaterThanOrEqual(1)
    })

    /**
     * Tests badge styling for Not Distinguished
     */
    it('should display Not Distinguished badge', () => {
      const areas: AreaWithDivision[] = [
        // Not Distinguished: below 50% distinguished
        createArea({
          areaId: 'A1',
          divisionId: 'A',
          clubBase: 4,
          paidClubs: 4,
          distinguishedClubs: 1,
        }),
      ]

      renderWithProviders(<AreaProgressSummary areas={areas} />)

      expect(screen.getByText('Not Distinguished')).toBeInTheDocument()
    })

    /**
     * Tests badge styling for Net Loss
     */
    it('should display Net Loss badge when paidClubs < clubBase', () => {
      const areas: AreaWithDivision[] = [
        // Net Loss: paidClubs < clubBase
        createArea({
          areaId: 'A1',
          divisionId: 'A',
          clubBase: 4,
          paidClubs: 3,
          distinguishedClubs: 2,
        }),
      ]

      renderWithProviders(<AreaProgressSummary areas={areas} />)

      expect(screen.getByText('Net Loss')).toBeInTheDocument()
    })
  })

  describe('Area Count Display', () => {
    /**
     * Tests header shows correct area count
     */
    it('should display correct area count in header', () => {
      const areas: AreaWithDivision[] = [
        createArea({ areaId: 'A1', divisionId: 'A' }),
        createArea({ areaId: 'A2', divisionId: 'A' }),
        createArea({ areaId: 'B1', divisionId: 'B' }),
      ]

      renderWithProviders(<AreaProgressSummary areas={areas} />)

      expect(screen.getByText('3 areas in 2 divisions')).toBeInTheDocument()
    })

    /**
     * Tests singular form for single area
     */
    it('should use singular form for single area', () => {
      const areas: AreaWithDivision[] = [
        createArea({ areaId: 'A1', divisionId: 'A' }),
      ]

      renderWithProviders(<AreaProgressSummary areas={areas} />)

      expect(screen.getByText('1 area in 1 division')).toBeInTheDocument()
    })

    /**
     * Tests plural form for multiple areas
     */
    it('should use plural form for multiple areas', () => {
      const areas: AreaWithDivision[] = [
        createArea({ areaId: 'A1', divisionId: 'A' }),
        createArea({ areaId: 'A2', divisionId: 'A' }),
      ]

      renderWithProviders(<AreaProgressSummary areas={areas} />)

      expect(screen.getByText('2 areas in 1 division')).toBeInTheDocument()
    })

    /**
     * Tests plural form for multiple divisions
     */
    it('should use plural form for multiple divisions', () => {
      const areas: AreaWithDivision[] = [
        createArea({ areaId: 'A1', divisionId: 'A' }),
        createArea({ areaId: 'B1', divisionId: 'B' }),
        createArea({ areaId: 'C1', divisionId: 'C' }),
      ]

      renderWithProviders(<AreaProgressSummary areas={areas} />)

      expect(screen.getByText('3 areas in 3 divisions')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    /**
     * Tests area with zero clubs (clubBase = 0)
     */
    it('should handle area with zero clubs', () => {
      const areas: AreaWithDivision[] = [
        createArea({
          areaId: 'A1',
          divisionId: 'A',
          clubBase: 0,
          paidClubs: 0,
          distinguishedClubs: 0,
        }),
      ]

      renderWithProviders(<AreaProgressSummary areas={areas} />)

      // Should render without crashing
      expect(screen.getByText('Area A1')).toBeInTheDocument()
    })

    /**
     * Tests area with 1 club (minimum case)
     */
    it('should handle area with single club', () => {
      const areas: AreaWithDivision[] = [
        createArea({
          areaId: 'A1',
          divisionId: 'A',
          clubBase: 1,
          paidClubs: 1,
          distinguishedClubs: 1,
        }),
      ]

      renderWithProviders(<AreaProgressSummary areas={areas} />)

      // Should render and show metrics
      expect(screen.getByText(/1 of 1 clubs paid/)).toBeInTheDocument()
    })

    /**
     * Tests multiple areas with different recognition levels
     */
    it('should display multiple areas with different recognition levels', () => {
      const areas: AreaWithDivision[] = [
        // President's Distinguished
        createArea({
          areaId: 'A1',
          divisionId: 'A',
          clubBase: 4,
          paidClubs: 5,
          distinguishedClubs: 3,
        }),
        // Select Distinguished
        createArea({
          areaId: 'A2',
          divisionId: 'A',
          clubBase: 4,
          paidClubs: 4,
          distinguishedClubs: 3,
        }),
        // Distinguished
        createArea({
          areaId: 'B1',
          divisionId: 'B',
          clubBase: 4,
          paidClubs: 4,
          distinguishedClubs: 2,
        }),
        // Not Distinguished
        createArea({
          areaId: 'B2',
          divisionId: 'B',
          clubBase: 4,
          paidClubs: 4,
          distinguishedClubs: 1,
        }),
        // Net Loss
        createArea({
          areaId: 'C1',
          divisionId: 'C',
          clubBase: 4,
          paidClubs: 3,
          distinguishedClubs: 2,
        }),
      ]

      renderWithProviders(<AreaProgressSummary areas={areas} />)

      expect(screen.getByText("President's Distinguished")).toBeInTheDocument()
      expect(screen.getByText('Select Distinguished')).toBeInTheDocument()
      // Use getAllByText since "Distinguished" appears multiple times
      const distinguishedBadges = screen.getAllByText('Distinguished')
      expect(distinguishedBadges.length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('Not Distinguished')).toBeInTheDocument()
      expect(screen.getByText('Net Loss')).toBeInTheDocument()
    })

    /**
     * Tests that component re-renders correctly when areas change
     */
    it('should update when areas prop changes', () => {
      const initialAreas: AreaWithDivision[] = [
        createArea({ areaId: 'A1', divisionId: 'A' }),
      ]

      const { rerender } = renderWithProviders(
        <AreaProgressSummary areas={initialAreas} />
      )

      expect(screen.getByText('1 area in 1 division')).toBeInTheDocument()

      // Update areas
      const updatedAreas: AreaWithDivision[] = [
        createArea({ areaId: 'A1', divisionId: 'A' }),
        createArea({ areaId: 'A2', divisionId: 'A' }),
        createArea({ areaId: 'B1', divisionId: 'B' }),
      ]

      rerender(<AreaProgressSummary areas={updatedAreas} />)

      expect(screen.getByText('3 areas in 2 divisions')).toBeInTheDocument()
    })
  })

  describe('Progress Text Content', () => {
    /**
     * Tests that progress text mentions club visit status with actual data
     */
    it('should include actual club visit status in progress text', () => {
      const areas: AreaWithDivision[] = [
        createArea({
          areaId: 'A1',
          divisionId: 'A',
          firstRoundVisits: {
            completed: 3,
            required: 3,
            percentage: 75,
            meetsThreshold: true,
          },
          secondRoundVisits: {
            completed: 2,
            required: 3,
            percentage: 50,
            meetsThreshold: false,
          },
        }),
      ]

      renderWithProviders(<AreaProgressSummary areas={areas} />)

      // Club visit status should show progress toward 75% threshold
      expect(screen.getByText(/Club visits:/)).toBeInTheDocument()
      expect(screen.getByText(/75%/)).toBeInTheDocument()
    })

    /**
     * Tests that both rounds meeting threshold shows appropriate message
     */
    it('should show both rounds meet threshold when 75% is achieved', () => {
      const areas: AreaWithDivision[] = [
        createArea({
          areaId: 'A1',
          divisionId: 'A',
          clubBase: 4,
          paidClubs: 5,
          distinguishedClubs: 3,
          firstRoundVisits: {
            completed: 3,
            required: 3,
            percentage: 75,
            meetsThreshold: true,
          },
          secondRoundVisits: {
            completed: 3,
            required: 3,
            percentage: 75,
            meetsThreshold: true,
          },
        }),
      ]

      renderWithProviders(<AreaProgressSummary areas={areas} />)

      // Should show both rounds meet 75% threshold for President's Distinguished
      expect(
        screen.getByText(/club visits meeting 75% threshold/)
      ).toBeInTheDocument()
    })

    /**
     * Tests progress text for area with net club loss
     */
    it('should describe eligibility requirement for net club loss', () => {
      const areas: AreaWithDivision[] = [
        createArea({
          areaId: 'A1',
          divisionId: 'A',
          clubBase: 4,
          paidClubs: 3,
          distinguishedClubs: 2,
        }),
      ]

      renderWithProviders(<AreaProgressSummary areas={areas} />)

      // Should mention net club loss and eligibility
      expect(screen.getByText(/has a net club loss/)).toBeInTheDocument()
      expect(screen.getByText(/To become eligible/)).toBeInTheDocument()
    })

    /**
     * Tests progress text for achieved President's Distinguished
     */
    it("should describe President's Distinguished achievement", () => {
      const areas: AreaWithDivision[] = [
        createArea({
          areaId: 'A1',
          divisionId: 'A',
          clubBase: 4,
          paidClubs: 5,
          distinguishedClubs: 3,
        }),
      ]

      renderWithProviders(<AreaProgressSummary areas={areas} />)

      // Should mention achievement
      expect(
        screen.getByText(/has achieved President's Distinguished status/)
      ).toBeInTheDocument()
    })

    /**
     * Tests progress text includes incremental gaps
     */
    it('should describe incremental gaps for not distinguished area', () => {
      const areas: AreaWithDivision[] = [
        createArea({
          areaId: 'A1',
          divisionId: 'A',
          clubBase: 4,
          paidClubs: 4,
          distinguishedClubs: 1,
        }),
      ]

      renderWithProviders(<AreaProgressSummary areas={areas} />)

      // Should mention gaps to each level
      expect(screen.getByText(/is not yet distinguished/)).toBeInTheDocument()
      expect(screen.getByText(/For Distinguished/)).toBeInTheDocument()
    })
  })
})
