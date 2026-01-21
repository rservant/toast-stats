/**
 * AreaRecognitionPanel Component Tests
 *
 * Tests for the Area Recognition Panel container component that combines
 * CriteriaExplanation and AreaProgressTable components to display
 * Distinguished Area Program (DAP) criteria and progress.
 *
 * Requirements validated:
 * - 1.1: Display Area Recognition section alongside existing content
 * - 1.2: Position logically within existing tab layout
 * - 1.3: Maintain consistent styling with existing components
 *
 * Test categories:
 * 1. Rendering with valid division data
 * 2. Empty state when no divisions
 * 3. Loading state
 * 4. Data extraction (areas from divisions)
 */

import { describe, it, expect, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { AreaRecognitionPanel } from '../AreaRecognitionPanel'
import { DivisionPerformance } from '../../utils/divisionStatus'
import {
  renderWithProviders,
  cleanupAllResources,
} from '../../__tests__/utils/componentTestUtils'

/**
 * Test data factory for creating division performance data
 */
const createDivision = (
  overrides: Partial<DivisionPerformance> = {}
): DivisionPerformance => ({
  divisionId: 'A',
  areas: [
    {
      areaId: 'A1',
      clubBase: 4,
      paidClubs: 3,
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
    },
  ],
  clubBase: 4,
  paidClubs: 3,
  distinguishedClubs: 2,
  netGrowth: 0,
  requiredDistinguishedClubs: 2,
  status: 'distinguished',
  ...overrides,
})

/**
 * Create a division with multiple areas
 */
const createDivisionWithAreas = (
  divisionId: string,
  areaIds: string[]
): DivisionPerformance => ({
  divisionId,
  areas: areaIds.map(areaId => ({
    areaId,
    clubBase: 4,
    paidClubs: 3,
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
    status: 'distinguished' as const,
    isQualified: true,
  })),
  clubBase: 4 * areaIds.length,
  paidClubs: 3 * areaIds.length,
  distinguishedClubs: 2 * areaIds.length,
  netGrowth: 0,
  requiredDistinguishedClubs: 2 * areaIds.length,
  status: 'distinguished',
})

describe('AreaRecognitionPanel', () => {
  afterEach(() => {
    cleanupAllResources()
  })

  describe('Rendering with Valid Division Data', () => {
    /**
     * Validates: Requirement 1.1
     * WHEN a user views the Divisions & Areas tab, THE System SHALL display
     * an Area Recognition section alongside existing content
     */
    it('should display section header with title', () => {
      const divisions = [createDivision()]

      renderWithProviders(<AreaRecognitionPanel divisions={divisions} />)

      expect(screen.getByText('Area Recognition')).toBeInTheDocument()
    })

    /**
     * Validates: Requirement 1.1
     * Section should include description text
     */
    it('should display section description', () => {
      const divisions = [createDivision()]

      renderWithProviders(<AreaRecognitionPanel divisions={divisions} />)

      expect(
        screen.getByText(/Track progress toward Distinguished Area Program/i)
      ).toBeInTheDocument()
    })

    /**
     * Validates: Requirement 1.1
     * CriteriaExplanation component should be rendered
     */
    it('should render CriteriaExplanation component', () => {
      const divisions = [createDivision()]

      renderWithProviders(<AreaRecognitionPanel divisions={divisions} />)

      // CriteriaExplanation has a toggle button with this text
      expect(
        screen.getByRole('button', {
          name: /Distinguished Area Program Criteria/i,
        })
      ).toBeInTheDocument()
    })

    /**
     * Validates: Requirement 1.1
     * AreaProgressTable component should be rendered
     */
    it('should render AreaProgressTable component', () => {
      const divisions = [createDivision()]

      renderWithProviders(<AreaRecognitionPanel divisions={divisions} />)

      // AreaProgressTable has a table with this aria-label
      expect(
        screen.getByRole('grid', { name: /area progress table/i })
      ).toBeInTheDocument()
    })

    /**
     * Validates: Requirement 1.3
     * Summary footer should show correct counts
     */
    it('should display summary footer with correct area count', () => {
      const divisions = [
        createDivisionWithAreas('A', ['A1', 'A2']),
        createDivisionWithAreas('B', ['B1']),
      ]

      renderWithProviders(<AreaRecognitionPanel divisions={divisions} />)

      // Should show "Showing 3 areas across 2 divisions" in footer
      expect(
        screen.getByText(/Showing 3 areas across 2 divisions/)
      ).toBeInTheDocument()
    })

    /**
     * Validates: Requirement 1.3
     * Summary footer should use singular form for single area
     */
    it('should display singular form for single area', () => {
      const divisions = [createDivisionWithAreas('A', ['A1'])]

      renderWithProviders(<AreaRecognitionPanel divisions={divisions} />)

      // Should show "Showing 1 area across 1 division" in footer
      expect(
        screen.getByText(/Showing 1 area across 1 division/)
      ).toBeInTheDocument()
    })

    /**
     * Validates: Requirement 1.3
     * Section should have proper aria-label for accessibility
     */
    it('should have proper aria-label on section', () => {
      const divisions = [createDivision()]

      renderWithProviders(<AreaRecognitionPanel divisions={divisions} />)

      const section = screen.getByRole('region', { name: /area recognition/i })
      expect(section).toBeInTheDocument()
    })
  })

  describe('Empty State When No Divisions', () => {
    /**
     * Tests empty state when divisions array is empty
     */
    it('should display empty state message when no divisions', () => {
      renderWithProviders(<AreaRecognitionPanel divisions={[]} />)

      expect(screen.getByText('No Area Data Available')).toBeInTheDocument()
    })

    /**
     * Tests empty state description text
     */
    it('should display empty state description', () => {
      renderWithProviders(<AreaRecognitionPanel divisions={[]} />)

      expect(
        screen.getByText(/Division and area performance data is not available/i)
      ).toBeInTheDocument()
    })

    /**
     * Tests that section header is still displayed in empty state
     */
    it('should still display section header in empty state', () => {
      renderWithProviders(<AreaRecognitionPanel divisions={[]} />)

      expect(screen.getByText('Area Recognition')).toBeInTheDocument()
    })

    /**
     * Tests that CriteriaExplanation is NOT rendered in empty state
     */
    it('should not render CriteriaExplanation in empty state', () => {
      renderWithProviders(<AreaRecognitionPanel divisions={[]} />)

      expect(
        screen.queryByRole('button', {
          name: /Distinguished Area Program Criteria/i,
        })
      ).not.toBeInTheDocument()
    })

    /**
     * Tests that AreaProgressTable is NOT rendered in empty state
     */
    it('should not render AreaProgressTable in empty state', () => {
      renderWithProviders(<AreaRecognitionPanel divisions={[]} />)

      expect(
        screen.queryByRole('grid', { name: /area progress table/i })
      ).not.toBeInTheDocument()
    })

    /**
     * Tests empty state when divisions is undefined (defensive)
     */
    it('should handle undefined divisions gracefully', () => {
      // TypeScript would normally prevent this, but testing defensive behavior
      renderWithProviders(
        <AreaRecognitionPanel
          divisions={undefined as unknown as DivisionPerformance[]}
        />
      )

      expect(screen.getByText('No Area Data Available')).toBeInTheDocument()
    })
  })

  describe('Loading State', () => {
    /**
     * Tests loading state display
     */
    it('should display loading skeletons when isLoading is true', () => {
      renderWithProviders(
        <AreaRecognitionPanel divisions={[]} isLoading={true} />
      )

      // LoadingSkeleton with variant="card" has role="status" and aria-label="Loading"
      const loadingElements = screen.getAllByRole('status')
      expect(loadingElements.length).toBeGreaterThan(0)
    })

    /**
     * Tests aria-busy attribute during loading
     */
    it('should set aria-busy attribute when loading', () => {
      renderWithProviders(
        <AreaRecognitionPanel divisions={[]} isLoading={true} />
      )

      const section = screen.getByLabelText('Area Recognition')
      expect(section).toHaveAttribute('aria-busy', 'true')
    })

    /**
     * Tests that content is not rendered during loading
     */
    it('should not render CriteriaExplanation during loading', () => {
      const divisions = [createDivision()]

      renderWithProviders(
        <AreaRecognitionPanel divisions={divisions} isLoading={true} />
      )

      expect(
        screen.queryByRole('button', {
          name: /Distinguished Area Program Criteria/i,
        })
      ).not.toBeInTheDocument()
    })

    /**
     * Tests that AreaProgressTable is not rendered during loading
     */
    it('should not render AreaProgressTable during loading', () => {
      const divisions = [createDivision()]

      renderWithProviders(
        <AreaRecognitionPanel divisions={divisions} isLoading={true} />
      )

      expect(
        screen.queryByRole('grid', { name: /area progress table/i })
      ).not.toBeInTheDocument()
    })

    /**
     * Tests that empty state is not shown during loading
     */
    it('should not show empty state during loading', () => {
      renderWithProviders(
        <AreaRecognitionPanel divisions={[]} isLoading={true} />
      )

      expect(
        screen.queryByText('No Area Data Available')
      ).not.toBeInTheDocument()
    })

    /**
     * Tests loading skeleton for table variant
     */
    it('should display table loading skeleton', () => {
      renderWithProviders(
        <AreaRecognitionPanel divisions={[]} isLoading={true} />
      )

      // LoadingSkeleton with variant="table" has aria-label="Loading table"
      expect(
        screen.getByRole('status', { name: /loading table/i })
      ).toBeInTheDocument()
    })
  })

  describe('Data Extraction', () => {
    /**
     * Tests that areas are correctly extracted from divisions
     */
    it('should extract all areas from all divisions', () => {
      const divisions = [
        createDivisionWithAreas('A', ['A1', 'A2']),
        createDivisionWithAreas('B', ['B1', 'B2', 'B3']),
      ]

      renderWithProviders(<AreaRecognitionPanel divisions={divisions} />)

      // All 5 areas should be displayed
      expect(screen.getByText('A1')).toBeInTheDocument()
      expect(screen.getByText('A2')).toBeInTheDocument()
      expect(screen.getByText('B1')).toBeInTheDocument()
      expect(screen.getByText('B2')).toBeInTheDocument()
      expect(screen.getByText('B3')).toBeInTheDocument()
    })

    /**
     * Tests that division context is preserved for each area
     */
    it('should preserve division context for each area', () => {
      const divisions = [
        createDivisionWithAreas('A', ['A1']),
        createDivisionWithAreas('B', ['B1']),
      ]

      renderWithProviders(<AreaRecognitionPanel divisions={divisions} />)

      // Division context should be displayed
      expect(screen.getByText('Division A')).toBeInTheDocument()
      expect(screen.getByText('Division B')).toBeInTheDocument()
    })

    /**
     * Tests handling of division with no areas
     */
    it('should handle division with no areas', () => {
      const divisions = [
        createDivision({ divisionId: 'A', areas: [] }),
        createDivisionWithAreas('B', ['B1']),
      ]

      renderWithProviders(<AreaRecognitionPanel divisions={divisions} />)

      // Only B1 should be displayed
      expect(screen.getByText('B1')).toBeInTheDocument()
      // Summary should show 1 area across 2 divisions
      expect(
        screen.getByText(/Showing 1 area across 2 divisions/)
      ).toBeInTheDocument()
    })

    /**
     * Tests that area metrics are passed correctly to AreaProgressTable
     */
    it('should pass area metrics correctly to AreaProgressTable', () => {
      const divisions = [
        {
          ...createDivision(),
          divisionId: 'A',
          areas: [
            {
              areaId: 'A1',
              clubBase: 5,
              paidClubs: 4,
              distinguishedClubs: 3,
              netGrowth: 0,
              requiredDistinguishedClubs: 2,
              firstRoundVisits: {
                completed: 5,
                required: 4,
                percentage: 100,
                meetsThreshold: true,
              },
              secondRoundVisits: {
                completed: 3,
                required: 4,
                percentage: 75,
                meetsThreshold: false,
              },
              status: 'select-distinguished' as const,
              isQualified: true,
            },
          ],
        },
      ]

      renderWithProviders(<AreaRecognitionPanel divisions={divisions} />)

      // Verify metrics are displayed (4/5 paid clubs, 3/4 distinguished)
      expect(screen.getByText('4/5')).toBeInTheDocument()
      expect(screen.getByText('3/4')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    /**
     * Tests that section has proper role attribute
     */
    it('should have role="region" on main section', () => {
      const divisions = [createDivision()]

      renderWithProviders(<AreaRecognitionPanel divisions={divisions} />)

      const section = screen.getByRole('region', { name: /area recognition/i })
      expect(section).toBeInTheDocument()
    })

    /**
     * Tests that decorative icon is hidden from screen readers
     */
    it('should hide decorative star icon from screen readers', () => {
      const divisions = [createDivision()]

      const { container } = renderWithProviders(
        <AreaRecognitionPanel divisions={divisions} />
      )

      const decorativeIcons = container.querySelectorAll(
        'svg[aria-hidden="true"]'
      )
      expect(decorativeIcons.length).toBeGreaterThan(0)
    })

    /**
     * Tests that section uses semantic HTML
     */
    it('should use semantic section element', () => {
      const divisions = [createDivision()]

      const { container } = renderWithProviders(
        <AreaRecognitionPanel divisions={divisions} />
      )

      const sections = container.querySelectorAll('section')
      expect(sections.length).toBeGreaterThan(0)
    })
  })

  describe('Edge Cases', () => {
    /**
     * Tests handling of many divisions
     */
    it('should handle many divisions correctly', () => {
      const divisions = Array.from({ length: 10 }, (_, i) =>
        createDivisionWithAreas(String.fromCharCode(65 + i), [
          `${String.fromCharCode(65 + i)}1`,
        ])
      )

      renderWithProviders(<AreaRecognitionPanel divisions={divisions} />)

      // Should show "Showing 10 areas across 10 divisions" in footer
      expect(
        screen.getByText(/Showing 10 areas across 10 divisions/)
      ).toBeInTheDocument()
    })

    /**
     * Tests handling of division with many areas
     */
    it('should handle division with many areas', () => {
      const areaIds = Array.from({ length: 20 }, (_, i) => `A${i + 1}`)
      const divisions = [createDivisionWithAreas('A', areaIds)]

      renderWithProviders(<AreaRecognitionPanel divisions={divisions} />)

      // Should show "Showing 20 areas across 1 division" in footer
      expect(
        screen.getByText(/Showing 20 areas across 1 division/)
      ).toBeInTheDocument()
    })

    /**
     * Tests that component re-renders correctly when divisions change
     */
    it('should update when divisions prop changes', () => {
      const initialDivisions = [createDivisionWithAreas('A', ['A1'])]

      const { rerender } = renderWithProviders(
        <AreaRecognitionPanel divisions={initialDivisions} />
      )

      expect(
        screen.getByText(/Showing 1 area across 1 division/)
      ).toBeInTheDocument()

      // Update divisions
      const updatedDivisions = [
        createDivisionWithAreas('A', ['A1', 'A2']),
        createDivisionWithAreas('B', ['B1']),
      ]

      rerender(<AreaRecognitionPanel divisions={updatedDivisions} />)

      expect(
        screen.getByText(/Showing 3 areas across 2 divisions/)
      ).toBeInTheDocument()
    })
  })
})
