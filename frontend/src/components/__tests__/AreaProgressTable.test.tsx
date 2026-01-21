/**
 * AreaProgressTable Component Tests
 *
 * Tests for the Area Progress Table component that displays all areas
 * with their current progress toward Distinguished Area recognition levels.
 *
 * Correctness Properties validated:
 * - Property 1: All areas displayed exactly once
 * - Property 2: Area metrics display completeness (paid clubs, total clubs, distinguished clubs)
 * - Property 3: Paid clubs percentage calculation
 * - Property 4: Distinguished clubs percentage calculation
 * - Property 5: Recognition level classification
 * - Property 6: Paid clubs gap calculation
 * - Property 7: Distinguished clubs gap calculation
 * - Property 8: Paid threshold blocker display
 *
 * Requirements validated:
 * - 5.1: Display all areas in the district with their current progress
 * - 5.2: Display current paid clubs count and total clubs count
 * - 5.3: Display current distinguished clubs count (of paid clubs)
 * - 5.4: Calculate and display paid clubs percentage achieved
 * - 5.5: Calculate and display distinguished clubs percentage achieved
 * - 5.6: Indicate which recognition level the area currently qualifies for
 * - 6.1: Calculate and display paid clubs gap
 * - 6.2: Calculate and display distinguished clubs gap for Distinguished
 * - 6.3: Calculate and display distinguished clubs gap for Select Distinguished
 * - 6.4: Calculate and display distinguished clubs gap for President's Distinguished
 * - 6.5: Indicate when level is achieved
 * - 6.6: Indicate when paid clubs requirement must be met first
 */

import { describe, it, expect, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { AreaProgressTable, AreaWithDivision } from '../AreaProgressTable'
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
  ...overrides,
})

describe('AreaProgressTable', () => {
  afterEach(() => {
    cleanupAllResources()
  })

  describe('Property 1: All Areas Displayed', () => {
    /**
     * Validates: Requirement 5.1
     * THE System SHALL display all areas in the district with their current progress
     */
    it('should display all areas from all divisions exactly once', () => {
      const areas: AreaWithDivision[] = [
        createArea({ areaId: 'A1', divisionId: 'A' }),
        createArea({ areaId: 'A2', divisionId: 'A' }),
        createArea({ areaId: 'B1', divisionId: 'B' }),
        createArea({ areaId: 'C1', divisionId: 'C' }),
      ]

      renderWithProviders(<AreaProgressTable areas={areas} />)

      // Each area should appear exactly once
      expect(screen.getByText('A1')).toBeInTheDocument()
      expect(screen.getByText('A2')).toBeInTheDocument()
      expect(screen.getByText('B1')).toBeInTheDocument()
      expect(screen.getByText('C1')).toBeInTheDocument()

      // Verify count in header
      expect(screen.getByText('4 areas')).toBeInTheDocument()
    })

    /**
     * Validates: Requirement 5.1
     * Single area should display correctly
     */
    it('should display single area correctly', () => {
      const areas: AreaWithDivision[] = [
        createArea({ areaId: 'A1', divisionId: 'A' }),
      ]

      renderWithProviders(<AreaProgressTable areas={areas} />)

      expect(screen.getByText('A1')).toBeInTheDocument()
      expect(screen.getByText('1 area')).toBeInTheDocument()
    })

    /**
     * Validates: Requirement 5.1
     * Areas should show their division context
     */
    it('should display division context for each area', () => {
      const areas: AreaWithDivision[] = [
        createArea({ areaId: 'A1', divisionId: 'A' }),
        createArea({ areaId: 'B1', divisionId: 'B' }),
      ]

      renderWithProviders(<AreaProgressTable areas={areas} />)

      expect(screen.getByText('Division A')).toBeInTheDocument()
      expect(screen.getByText('Division B')).toBeInTheDocument()
    })
  })

  describe('Property 2: Area Metrics Display Completeness', () => {
    /**
     * Validates: Requirements 5.2, 5.3
     * FOR EACH area, THE System SHALL display paid clubs count, total clubs count,
     * and distinguished clubs count
     */
    it('should display paid clubs count and total clubs count', () => {
      const areas: AreaWithDivision[] = [
        createArea({ clubBase: 5, paidClubs: 4, distinguishedClubs: 2 }),
      ]

      renderWithProviders(<AreaProgressTable areas={areas} />)

      // Paid clubs / total clubs format
      expect(screen.getByText('4/5')).toBeInTheDocument()
    })

    /**
     * Validates: Requirement 5.3
     * FOR EACH area, THE System SHALL display distinguished clubs count (of paid clubs)
     */
    it('should display distinguished clubs count of paid clubs', () => {
      const areas: AreaWithDivision[] = [
        createArea({ clubBase: 5, paidClubs: 4, distinguishedClubs: 2 }),
      ]

      renderWithProviders(<AreaProgressTable areas={areas} />)

      // Distinguished clubs / paid clubs format
      expect(screen.getByText('2/4')).toBeInTheDocument()
    })
  })

  describe('Property 3: Paid Clubs Percentage Display', () => {
    /**
     * Validates: Requirement 5.4
     * FOR EACH area, THE System SHALL calculate and display the paid clubs percentage
     * Percentage = Math.round((paidClubs / clubBase) * 100)
     */
    it('should display paid clubs percentage correctly', () => {
      const areas: AreaWithDivision[] = [
        createArea({ clubBase: 4, paidClubs: 3, distinguishedClubs: 2 }),
      ]

      renderWithProviders(<AreaProgressTable areas={areas} />)

      // 3/4 = 75%
      expect(screen.getByText('75%')).toBeInTheDocument()
    })

    /**
     * Validates: Requirement 5.4
     * Edge case: 100% paid clubs
     */
    it('should display 100% when all clubs are paid', () => {
      const areas: AreaWithDivision[] = [
        createArea({ clubBase: 4, paidClubs: 4, distinguishedClubs: 2 }),
      ]

      renderWithProviders(<AreaProgressTable areas={areas} />)

      expect(screen.getByText('100%')).toBeInTheDocument()
    })

    /**
     * Validates: Requirement 5.4
     * Edge case: 0% paid clubs
     */
    it('should display 0% when no clubs are paid', () => {
      const areas: AreaWithDivision[] = [
        createArea({ clubBase: 4, paidClubs: 0, distinguishedClubs: 0 }),
      ]

      renderWithProviders(<AreaProgressTable areas={areas} />)

      // Should show 0% for paid clubs
      const percentageElements = screen.getAllByText('0%')
      expect(percentageElements.length).toBeGreaterThan(0)
    })
  })

  describe('Property 4: Distinguished Clubs Percentage Display', () => {
    /**
     * Validates: Requirement 5.5
     * FOR EACH area, THE System SHALL calculate and display distinguished clubs percentage
     * Percentage = Math.round((distinguishedClubs / paidClubs) * 100)
     */
    it('should display distinguished clubs percentage correctly', () => {
      const areas: AreaWithDivision[] = [
        createArea({ clubBase: 4, paidClubs: 4, distinguishedClubs: 2 }),
      ]

      renderWithProviders(<AreaProgressTable areas={areas} />)

      // 2/4 = 50%
      expect(screen.getByText('50%')).toBeInTheDocument()
    })

    /**
     * Validates: Requirement 5.5
     * Edge case: 100% distinguished
     */
    it('should display 100% when all paid clubs are distinguished', () => {
      const areas: AreaWithDivision[] = [
        createArea({ clubBase: 4, paidClubs: 4, distinguishedClubs: 4 }),
      ]

      renderWithProviders(<AreaProgressTable areas={areas} />)

      // Both paid and distinguished should show 100%
      const percentageElements = screen.getAllByText('100%')
      expect(percentageElements.length).toBeGreaterThanOrEqual(1)
    })

    /**
     * Validates: Requirement 5.5
     * Edge case: 0 paid clubs should show 0% distinguished
     */
    it('should display 0% distinguished when no paid clubs', () => {
      const areas: AreaWithDivision[] = [
        createArea({ clubBase: 4, paidClubs: 0, distinguishedClubs: 0 }),
      ]

      renderWithProviders(<AreaProgressTable areas={areas} />)

      // Should show 0% for distinguished
      const percentageElements = screen.getAllByText('0%')
      expect(percentageElements.length).toBeGreaterThan(0)
    })
  })

  describe('Property 5: Recognition Level Indicators', () => {
    /**
     * Validates: Requirements 5.6, 6.5
     * FOR EACH area, THE System SHALL indicate which recognition level the area qualifies for
     */
    it('should display "Not Distinguished" when below 50% distinguished', () => {
      const areas: AreaWithDivision[] = [
        createArea({ clubBase: 4, paidClubs: 4, distinguishedClubs: 1 }),
      ]

      renderWithProviders(<AreaProgressTable areas={areas} />)

      expect(screen.getByText('Not Distinguished')).toBeInTheDocument()
    })

    /**
     * Validates: Requirements 5.6, 6.5
     * Distinguished Area requires at least 50% of paid clubs distinguished
     */
    it('should display "Distinguished" when at 50% distinguished', () => {
      const areas: AreaWithDivision[] = [
        createArea({ clubBase: 4, paidClubs: 4, distinguishedClubs: 2 }),
      ]

      renderWithProviders(<AreaProgressTable areas={areas} />)

      // Use getAllByText since "Distinguished" appears in header and badge
      const distinguishedElements = screen.getAllByText('Distinguished')
      // Should have at least 2: one in header, one in badge
      expect(distinguishedElements.length).toBeGreaterThanOrEqual(2)
    })

    /**
     * Validates: Requirements 5.6, 6.5
     * Select Distinguished Area requires at least 75% of paid clubs distinguished
     */
    it('should display "Select Distinguished" when at 75% distinguished', () => {
      const areas: AreaWithDivision[] = [
        createArea({ clubBase: 4, paidClubs: 4, distinguishedClubs: 3 }),
      ]

      renderWithProviders(<AreaProgressTable areas={areas} />)

      expect(screen.getByText('Select Distinguished')).toBeInTheDocument()
    })

    /**
     * Validates: Requirements 5.6, 6.5
     * President's Distinguished Area requires 100% of paid clubs distinguished
     */
    it('should display "President\'s Distinguished" when at 100% distinguished', () => {
      const areas: AreaWithDivision[] = [
        createArea({ clubBase: 4, paidClubs: 4, distinguishedClubs: 4 }),
      ]

      renderWithProviders(<AreaProgressTable areas={areas} />)

      expect(screen.getByText("President's Distinguished")).toBeInTheDocument()
    })

    /**
     * Validates: Requirement 6.6
     * When paid threshold not met, show special indicator
     */
    it('should display "Paid Threshold Not Met" when below 75% paid', () => {
      const areas: AreaWithDivision[] = [
        createArea({ clubBase: 4, paidClubs: 2, distinguishedClubs: 2 }),
      ]

      renderWithProviders(<AreaProgressTable areas={areas} />)

      expect(screen.getByText('Paid Threshold Not Met')).toBeInTheDocument()
    })
  })

  describe('Property 6: Paid Clubs Gap Display', () => {
    /**
     * Validates: Requirement 6.1
     * FOR EACH area, THE System SHALL calculate and display paid clubs gap
     */
    it('should display paid clubs needed when below 75% threshold', () => {
      const areas: AreaWithDivision[] = [
        // 4 clubs, 2 paid = 50%, need 1 more to reach 75% (3 clubs)
        createArea({ clubBase: 4, paidClubs: 2, distinguishedClubs: 1 }),
      ]

      renderWithProviders(<AreaProgressTable areas={areas} />)

      // Should show "+1 needed" for paid clubs
      expect(screen.getByText(/\+1 needed/)).toBeInTheDocument()
    })

    /**
     * Validates: Requirement 6.1
     * No gap shown when threshold is met
     */
    it('should not display paid clubs gap when threshold is met', () => {
      const areas: AreaWithDivision[] = [
        createArea({ clubBase: 4, paidClubs: 3, distinguishedClubs: 2 }),
      ]

      renderWithProviders(<AreaProgressTable areas={areas} />)

      // Should not show "needed" text for paid clubs when threshold met
      expect(screen.queryByText(/\+\d+ needed/)).not.toBeInTheDocument()
    })
  })

  describe('Property 7: Distinguished Clubs Gap Display', () => {
    /**
     * Validates: Requirements 6.2, 6.3, 6.4
     * FOR EACH area, THE System SHALL calculate and display distinguished clubs gaps
     */
    it('should display gap to Distinguished level', () => {
      const areas: AreaWithDivision[] = [
        // 4 paid clubs, 1 distinguished = 25%, need 1 more for 50% (2 clubs)
        createArea({ clubBase: 4, paidClubs: 4, distinguishedClubs: 1 }),
      ]

      renderWithProviders(<AreaProgressTable areas={areas} />)

      // Should show +1 for Distinguished gap
      const gapElements = screen.getAllByText('+1')
      expect(gapElements.length).toBeGreaterThan(0)
    })

    /**
     * Validates: Requirement 6.5
     * WHEN an area has already achieved a recognition level, show checkmark
     */
    it('should display checkmark when Distinguished level is achieved', () => {
      const areas: AreaWithDivision[] = [
        // 4 paid clubs, 2 distinguished = 50%, Distinguished achieved
        createArea({ clubBase: 4, paidClubs: 4, distinguishedClubs: 2 }),
      ]

      renderWithProviders(<AreaProgressTable areas={areas} />)

      // Should show checkmarks (one in gap column + one in legend)
      const checkmarks = screen.getAllByText('✓')
      expect(checkmarks.length).toBeGreaterThanOrEqual(1)
    })

    /**
     * Validates: Requirements 6.2, 6.3, 6.4
     * Should show gaps for all three levels
     */
    it('should display gaps for all recognition levels', () => {
      const areas: AreaWithDivision[] = [
        // 4 paid clubs, 0 distinguished
        // Distinguished (50%) needs 2, Select (75%) needs 3, Presidents (100%) needs 4
        createArea({ clubBase: 4, paidClubs: 4, distinguishedClubs: 0 }),
      ]

      renderWithProviders(<AreaProgressTable areas={areas} />)

      // Should show multiple gap values
      expect(screen.getByText('+2')).toBeInTheDocument()
      expect(screen.getByText('+3')).toBeInTheDocument()
      expect(screen.getByText('+4')).toBeInTheDocument()
    })

    /**
     * Validates: Requirement 6.5
     * All levels achieved should show checkmarks
     */
    it('should display checkmarks for all achieved levels', () => {
      const areas: AreaWithDivision[] = [
        // 4 paid clubs, 4 distinguished = 100%, all levels achieved
        createArea({ clubBase: 4, paidClubs: 4, distinguishedClubs: 4 }),
      ]

      renderWithProviders(<AreaProgressTable areas={areas} />)

      // Should show 4 checkmarks (3 in gap columns + 1 in legend)
      const checkmarks = screen.getAllByText('✓')
      expect(checkmarks.length).toBe(4)
    })
  })

  describe('Property 8: Paid Threshold Blocker Display', () => {
    /**
     * Validates: Requirement 6.6
     * WHEN an area cannot achieve a recognition level due to insufficient paid clubs,
     * THE System SHALL indicate the paid clubs requirement must be met first
     */
    it('should display dash for gaps when paid threshold not met', () => {
      const areas: AreaWithDivision[] = [
        // 4 clubs, 2 paid = 50%, below 75% threshold
        createArea({ clubBase: 4, paidClubs: 2, distinguishedClubs: 2 }),
      ]

      renderWithProviders(<AreaProgressTable areas={areas} />)

      // Should show dashes for gap columns (3) plus one in legend (4 total)
      const dashElements = screen.getAllByText('—')
      expect(dashElements.length).toBe(4)
    })

    /**
     * Validates: Requirement 6.6
     * Gap dashes should have appropriate title attribute explaining the blocker
     */
    it('should have tooltip explaining paid threshold requirement on gap dashes', () => {
      const areas: AreaWithDivision[] = [
        createArea({ clubBase: 4, paidClubs: 2, distinguishedClubs: 2 }),
      ]

      renderWithProviders(<AreaProgressTable areas={areas} />)

      // Find dashes with the specific title (gap column dashes, not legend)
      const dashElements = screen.getAllByText('—')
      const gapDashes = dashElements.filter(
        element =>
          element.getAttribute('title') === 'Meet paid clubs threshold first'
      )
      expect(gapDashes.length).toBe(3) // One for each recognition level gap
    })
  })

  describe('Empty State', () => {
    /**
     * Tests empty state when no areas provided
     */
    it('should display empty state when no areas', () => {
      renderWithProviders(<AreaProgressTable areas={[]} />)

      expect(screen.getByText('No Area Data')).toBeInTheDocument()
      expect(
        screen.getByText(/No area performance data is available/i)
      ).toBeInTheDocument()
    })

    /**
     * Tests that table is not rendered when no areas
     */
    it('should not render table when no areas', () => {
      renderWithProviders(<AreaProgressTable areas={[]} />)

      expect(screen.queryByRole('grid')).not.toBeInTheDocument()
    })

    /**
     * Tests header shows 0 areas count
     */
    it('should show 0 areas in header', () => {
      renderWithProviders(<AreaProgressTable areas={[]} />)

      expect(screen.getByText('0 areas')).toBeInTheDocument()
    })
  })

  describe('Loading State', () => {
    /**
     * Tests loading state display
     */
    it('should display loading skeleton when isLoading is true', () => {
      renderWithProviders(<AreaProgressTable areas={[]} isLoading={true} />)

      // LoadingSkeleton with variant="table" has role="status" and aria-label="Loading table"
      expect(
        screen.getByRole('status', { name: /loading table/i })
      ).toBeInTheDocument()
    })

    /**
     * Tests that table is not rendered during loading
     */
    it('should not render table during loading', () => {
      const areas: AreaWithDivision[] = [
        createArea({ areaId: 'A1', divisionId: 'A' }),
      ]

      renderWithProviders(<AreaProgressTable areas={areas} isLoading={true} />)

      // Table should not be rendered
      expect(screen.queryByRole('grid')).not.toBeInTheDocument()
    })

    /**
     * Tests that empty state is not shown during loading
     */
    it('should not show empty state during loading', () => {
      renderWithProviders(<AreaProgressTable areas={[]} isLoading={true} />)

      expect(screen.queryByText('No Area Data')).not.toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    /**
     * Tests table has proper ARIA attributes
     */
    it('should have proper table role and aria-label', () => {
      const areas: AreaWithDivision[] = [
        createArea({ areaId: 'A1', divisionId: 'A' }),
      ]

      renderWithProviders(<AreaProgressTable areas={areas} />)

      const table = screen.getByRole('grid', { name: /area progress table/i })
      expect(table).toBeInTheDocument()
    })

    /**
     * Tests sortable columns have aria-sort attribute
     */
    it('should have aria-sort attribute on sortable columns', () => {
      const areas: AreaWithDivision[] = [
        createArea({ areaId: 'A1', divisionId: 'A' }),
      ]

      renderWithProviders(<AreaProgressTable areas={areas} />)

      // Area column should have aria-sort
      const areaHeader = screen.getByRole('columnheader', { name: /area/i })
      expect(areaHeader).toHaveAttribute('aria-sort')

      // Recognition column should have aria-sort
      const recognitionHeader = screen.getByRole('columnheader', {
        name: /recognition/i,
      })
      expect(recognitionHeader).toHaveAttribute('aria-sort')
    })

    /**
     * Tests column headers have proper scope attribute
     */
    it('should have scope="col" on all column headers', () => {
      const areas: AreaWithDivision[] = [
        createArea({ areaId: 'A1', divisionId: 'A' }),
      ]

      renderWithProviders(<AreaProgressTable areas={areas} />)

      const headers = screen.getAllByRole('columnheader')
      headers.forEach(header => {
        expect(header).toHaveAttribute('scope', 'col')
      })
    })
  })

  describe('Edge Cases', () => {
    /**
     * Tests area with zero clubs (clubBase = 0)
     */
    it('should handle area with zero clubs', () => {
      const areas: AreaWithDivision[] = [
        createArea({ clubBase: 0, paidClubs: 0, distinguishedClubs: 0 }),
      ]

      renderWithProviders(<AreaProgressTable areas={areas} />)

      // Should render without crashing
      expect(screen.getByText('A1')).toBeInTheDocument()
      // Should show 0/0 for both paid clubs and distinguished clubs columns
      const zeroRatios = screen.getAllByText('0/0')
      expect(zeroRatios.length).toBe(2)
    })

    /**
     * Tests area with exactly threshold values (boundary conditions)
     */
    it('should correctly classify area at exact 75% paid threshold', () => {
      const areas: AreaWithDivision[] = [
        // 4 clubs, 3 paid = 75% exactly
        createArea({ clubBase: 4, paidClubs: 3, distinguishedClubs: 2 }),
      ]

      renderWithProviders(<AreaProgressTable areas={areas} />)

      // Should meet threshold and show recognition level
      expect(
        screen.queryByText('Paid Threshold Not Met')
      ).not.toBeInTheDocument()
      // Use getAllByText since "Distinguished" appears in header and badge
      const distinguishedElements = screen.getAllByText('Distinguished')
      expect(distinguishedElements.length).toBeGreaterThanOrEqual(1)
    })

    /**
     * Tests area with 1 club (minimum case)
     */
    it('should handle area with single club', () => {
      const areas: AreaWithDivision[] = [
        createArea({ clubBase: 1, paidClubs: 1, distinguishedClubs: 1 }),
      ]

      renderWithProviders(<AreaProgressTable areas={areas} />)

      // Should render and show President's Distinguished (100%)
      expect(screen.getByText("President's Distinguished")).toBeInTheDocument()
    })

    /**
     * Tests multiple areas with different recognition levels
     */
    it('should display multiple areas with different recognition levels', () => {
      const areas: AreaWithDivision[] = [
        createArea({
          areaId: 'A1',
          divisionId: 'A',
          clubBase: 4,
          paidClubs: 4,
          distinguishedClubs: 4,
        }),
        createArea({
          areaId: 'A2',
          divisionId: 'A',
          clubBase: 4,
          paidClubs: 4,
          distinguishedClubs: 3,
        }),
        createArea({
          areaId: 'B1',
          divisionId: 'B',
          clubBase: 4,
          paidClubs: 4,
          distinguishedClubs: 2,
        }),
        createArea({
          areaId: 'B2',
          divisionId: 'B',
          clubBase: 4,
          paidClubs: 4,
          distinguishedClubs: 1,
        }),
      ]

      renderWithProviders(<AreaProgressTable areas={areas} />)

      expect(screen.getByText("President's Distinguished")).toBeInTheDocument()
      expect(screen.getByText('Select Distinguished')).toBeInTheDocument()
      // Use getAllByText since "Distinguished" appears in header and badge
      const distinguishedElements = screen.getAllByText('Distinguished')
      expect(distinguishedElements.length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('Not Distinguished')).toBeInTheDocument()
    })
  })

  describe('Table Footer Legend', () => {
    /**
     * Tests that legend is displayed when areas exist
     */
    it('should display legend explaining gap columns', () => {
      const areas: AreaWithDivision[] = [
        createArea({ areaId: 'A1', divisionId: 'A' }),
      ]

      renderWithProviders(<AreaProgressTable areas={areas} />)

      expect(screen.getByText(/Gap columns:/)).toBeInTheDocument()
      expect(screen.getByText(/Level achieved/)).toBeInTheDocument()
      expect(screen.getByText(/Meet paid threshold first/)).toBeInTheDocument()
    })

    /**
     * Tests that legend is not displayed when no areas
     */
    it('should not display legend when no areas', () => {
      renderWithProviders(<AreaProgressTable areas={[]} />)

      expect(screen.queryByText(/Gap columns:/)).not.toBeInTheDocument()
    })
  })
})
