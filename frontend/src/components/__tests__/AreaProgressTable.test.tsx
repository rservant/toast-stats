/**
 * AreaProgressTable Component Tests
 *
 * Tests for the Area Progress Table component that displays all areas
 * with their current progress toward Distinguished Area recognition levels.
 *
 * Updated for revised DAP criteria:
 * - No net club loss requirement (paidClubs >= clubBase) instead of 75% paid threshold
 * - Distinguished percentage calculated against club base, not paid clubs
 * - Distinguished: paidClubs >= clubBase AND distinguishedClubs >= 50% of clubBase
 * - Select Distinguished: paidClubs >= clubBase AND distinguishedClubs >= 50% of clubBase + 1
 * - President's Distinguished: paidClubs >= clubBase + 1 AND distinguishedClubs >= 50% of clubBase + 1
 *
 * Correctness Properties validated:
 * - Property 1: All areas displayed exactly once
 * - Property 2: Area metrics display completeness (paid clubs, club base, distinguished clubs)
 * - Property 3: Paid clubs percentage calculation (against club base)
 * - Property 4: Distinguished clubs percentage calculation (against club base)
 * - Property 5: Recognition level classification (new DAP thresholds)
 * - Property 6: Paid clubs gap calculation (no net loss requirement)
 * - Property 7: Distinguished clubs gap calculation (50% of club base thresholds)
 * - Property 8: No net loss blocker display
 *
 * Requirements validated:
 * - 5.1: Display all areas in the district with their current progress
 * - 5.2: Display current paid clubs count and club base count
 * - 5.3: Display current distinguished clubs count (of club base)
 * - 5.4: Calculate and display whether no net club loss requirement is met
 * - 5.5: Calculate and display distinguished clubs percentage (of club base)
 * - 5.6: Indicate which recognition level the area currently qualifies for
 * - 6.1: Calculate and display paid clubs gap (to meet no net loss)
 * - 6.2: Calculate and display distinguished clubs gap for Distinguished (50% of club base)
 * - 6.3: Calculate and display distinguished clubs gap for Select Distinguished (50% + 1)
 * - 6.4: Calculate and display distinguished clubs gap for President's Distinguished
 * - 6.5: Indicate when level is achieved
 * - 6.6: Indicate when no net loss requirement must be met first
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

  describe('Column Headers - New DAP Criteria Labels', () => {
    /**
     * Validates: Requirements 5.2, 5.3
     * Column headers should reflect new DAP criteria terminology
     */
    it('should display "Paid / Base" column header with subtitle', () => {
      const areas: AreaWithDivision[] = [createArea()]

      renderWithProviders(<AreaProgressTable areas={areas} />)

      // Check for "Paid / Base" header
      expect(screen.getByText('Paid / Base')).toBeInTheDocument()
      // Check for subtitle explaining the requirement
      expect(screen.getByText('(≥ club base required)')).toBeInTheDocument()
    })

    /**
     * Validates: Requirement 5.3
     * Distinguished column should show it's calculated against club base
     */
    it('should display "Distinguished" column header with "(of club base)" subtitle', () => {
      const areas: AreaWithDivision[] = [createArea()]

      renderWithProviders(<AreaProgressTable areas={areas} />)

      // Check for "Distinguished" header (use getAllByText since it appears in header and badge)
      const distinguishedElements = screen.getAllByText('Distinguished')
      expect(distinguishedElements.length).toBeGreaterThanOrEqual(1)
      // Check for subtitle explaining calculation basis
      expect(screen.getByText('(of club base)')).toBeInTheDocument()
    })

    /**
     * Validates: Requirements 6.2, 6.3, 6.4
     * Gap columns should show new threshold descriptions
     */
    it('should display gap column headers with new threshold descriptions', () => {
      const areas: AreaWithDivision[] = [createArea()]

      renderWithProviders(<AreaProgressTable areas={areas} />)

      // Gap to Distinguished: 50% of base
      expect(screen.getByText('(50% of base)')).toBeInTheDocument()
      // Gap to Select: 50% + 1
      expect(screen.getByText('(50% + 1)')).toBeInTheDocument()
      // Gap to President's: base+1 paid, 50%+1 distinguished
      expect(screen.getByText('(base+1, 50%+1)')).toBeInTheDocument()
    })
  })

  describe('Property 2: Area Metrics Display Completeness', () => {
    /**
     * Validates: Requirements 5.2, 5.3
     * FOR EACH area, THE System SHALL display paid clubs count and club base count
     * Paid clubs shown as "X / clubBase" (not "X / totalClubs")
     */
    it('should display paid clubs count and club base count', () => {
      const areas: AreaWithDivision[] = [
        createArea({ clubBase: 5, paidClubs: 4, distinguishedClubs: 2 }),
      ]

      renderWithProviders(<AreaProgressTable areas={areas} />)

      // Paid clubs / club base format
      expect(screen.getByText('4/5')).toBeInTheDocument()
    })

    /**
     * Validates: Requirement 5.3
     * FOR EACH area, THE System SHALL display distinguished clubs count of club base
     * Distinguished clubs shown as "X / clubBase" (not "X / paidClubs")
     */
    it('should display distinguished clubs count of club base', () => {
      const areas: AreaWithDivision[] = [
        createArea({ clubBase: 5, paidClubs: 4, distinguishedClubs: 2 }),
      ]

      renderWithProviders(<AreaProgressTable areas={areas} />)

      // Distinguished clubs / club base format (not / paidClubs)
      expect(screen.getByText('2/5')).toBeInTheDocument()
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
     * Edge case: 100% paid clubs (meets no net loss requirement)
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
     * Percentage = Math.round((distinguishedClubs / clubBase) * 100)
     * Note: Calculated against club base, NOT paid clubs
     */
    it('should display distinguished clubs percentage against club base', () => {
      const areas: AreaWithDivision[] = [
        createArea({ clubBase: 4, paidClubs: 4, distinguishedClubs: 2 }),
      ]

      renderWithProviders(<AreaProgressTable areas={areas} />)

      // 2/4 = 50% (against club base)
      expect(screen.getByText('50%')).toBeInTheDocument()
    })

    /**
     * Validates: Requirement 5.5
     * Edge case: 100% distinguished
     */
    it('should display 100% when all clubs in base are distinguished', () => {
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

  describe('Property 5: Recognition Level Indicators - New DAP Criteria', () => {
    /**
     * Validates: Requirements 5.6, 6.6
     * When paidClubs < clubBase (net club loss), show "Net Loss" badge
     */
    it('should display "Net Loss" when paidClubs < clubBase', () => {
      const areas: AreaWithDivision[] = [
        // Net club loss: 3 paid < 4 club base
        createArea({ clubBase: 4, paidClubs: 3, distinguishedClubs: 2 }),
      ]

      renderWithProviders(<AreaProgressTable areas={areas} />)

      expect(screen.getByText('Net Loss')).toBeInTheDocument()
    })

    /**
     * Validates: Requirements 5.6, 6.5
     * FOR EACH area, THE System SHALL indicate which recognition level the area qualifies for
     */
    it('should display "Not Distinguished" when below 50% distinguished of club base', () => {
      const areas: AreaWithDivision[] = [
        // 4 club base, 4 paid (meets no net loss), 1 distinguished = 25% < 50%
        createArea({ clubBase: 4, paidClubs: 4, distinguishedClubs: 1 }),
      ]

      renderWithProviders(<AreaProgressTable areas={areas} />)

      expect(screen.getByText('Not Distinguished')).toBeInTheDocument()
    })

    /**
     * Validates: Requirements 5.6, 6.5
     * Distinguished Area: paidClubs >= clubBase AND distinguishedClubs >= 50% of clubBase
     * For clubBase=4: need 2 distinguished (ceil(4*0.5) = 2)
     */
    it('should display "Distinguished" when at 50% distinguished of club base', () => {
      const areas: AreaWithDivision[] = [
        // 4 club base, 4 paid, 2 distinguished = 50% of club base
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
     * Select Distinguished Area: paidClubs >= clubBase AND distinguishedClubs >= 50% of clubBase + 1
     * For clubBase=4: need 3 distinguished (ceil(4*0.5) + 1 = 3)
     */
    it('should display "Select Distinguished" when at 50% + 1 distinguished of club base', () => {
      const areas: AreaWithDivision[] = [
        // 4 club base, 4 paid, 3 distinguished = 50% + 1 of club base
        createArea({ clubBase: 4, paidClubs: 4, distinguishedClubs: 3 }),
      ]

      renderWithProviders(<AreaProgressTable areas={areas} />)

      expect(screen.getByText('Select Distinguished')).toBeInTheDocument()
    })

    /**
     * Validates: Requirements 5.6, 6.5
     * President's Distinguished Area: paidClubs >= clubBase + 1 AND distinguishedClubs >= 50% of clubBase + 1
     * For clubBase=4: need 5 paid AND 3 distinguished
     */
    it('should display "President\'s Distinguished" when at clubBase+1 paid AND 50%+1 distinguished', () => {
      const areas: AreaWithDivision[] = [
        // 4 club base, 5 paid (clubBase+1), 3 distinguished (50%+1)
        createArea({ clubBase: 4, paidClubs: 5, distinguishedClubs: 3 }),
      ]

      renderWithProviders(<AreaProgressTable areas={areas} />)

      expect(screen.getByText("President's Distinguished")).toBeInTheDocument()
    })

    /**
     * Validates: Requirements 5.6, 6.5
     * Edge case: Having 50%+1 distinguished but only clubBase paid = Select, not President's
     */
    it('should display "Select Distinguished" when 50%+1 distinguished but only clubBase paid', () => {
      const areas: AreaWithDivision[] = [
        // 4 club base, 4 paid (not clubBase+1), 3 distinguished (50%+1)
        createArea({ clubBase: 4, paidClubs: 4, distinguishedClubs: 3 }),
      ]

      renderWithProviders(<AreaProgressTable areas={areas} />)

      // Should be Select, not President's (missing the +1 paid requirement)
      expect(screen.getByText('Select Distinguished')).toBeInTheDocument()
      expect(
        screen.queryByText("President's Distinguished")
      ).not.toBeInTheDocument()
    })
  })

  describe('Property 6: Paid Clubs Gap Display - No Net Loss Requirement', () => {
    /**
     * Validates: Requirement 6.1
     * FOR EACH area, THE System SHALL calculate and display paid clubs gap
     * Gap = max(0, clubBase - paidClubs) for no net loss requirement
     */
    it('should display paid clubs needed when below club base (net loss)', () => {
      const areas: AreaWithDivision[] = [
        // 4 club base, 3 paid = need 1 more to meet no net loss
        createArea({ clubBase: 4, paidClubs: 3, distinguishedClubs: 1 }),
      ]

      renderWithProviders(<AreaProgressTable areas={areas} />)

      // Should show "+1 needed" for paid clubs
      expect(screen.getByText(/\+1 needed/)).toBeInTheDocument()
    })

    /**
     * Validates: Requirement 6.1
     * No gap shown when no net loss requirement is met
     */
    it('should not display paid clubs gap when no net loss requirement is met', () => {
      const areas: AreaWithDivision[] = [
        // 4 club base, 4 paid = no net loss requirement met
        createArea({ clubBase: 4, paidClubs: 4, distinguishedClubs: 2 }),
      ]

      renderWithProviders(<AreaProgressTable areas={areas} />)

      // Should not show "needed" text for paid clubs when requirement met
      expect(screen.queryByText(/\+\d+ needed/)).not.toBeInTheDocument()
    })

    /**
     * Validates: Requirement 6.1
     * Edge case: More paid clubs than club base (growth)
     */
    it('should not display paid clubs gap when paidClubs > clubBase', () => {
      const areas: AreaWithDivision[] = [
        // 4 club base, 5 paid = growth, no gap
        createArea({ clubBase: 4, paidClubs: 5, distinguishedClubs: 2 }),
      ]

      renderWithProviders(<AreaProgressTable areas={areas} />)

      // Should not show "needed" text
      expect(screen.queryByText(/\+\d+ needed/)).not.toBeInTheDocument()
    })
  })

  describe('Property 7: Distinguished Clubs Gap Display - New Thresholds', () => {
    /**
     * Validates: Requirements 6.2, 6.3, 6.4
     * FOR EACH area, THE System SHALL calculate and display distinguished clubs gaps
     * Distinguished: 50% of club base
     * Select: 50% of club base + 1
     * President's: 50% of club base + 1 (plus clubBase+1 paid)
     */
    it('should display gap to Distinguished level (50% of club base)', () => {
      const areas: AreaWithDivision[] = [
        // 4 club base, 4 paid, 1 distinguished
        // Distinguished needs ceil(4*0.5) = 2, so gap = 1
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
        // 4 club base, 4 paid, 2 distinguished = 50%, Distinguished achieved
        createArea({ clubBase: 4, paidClubs: 4, distinguishedClubs: 2 }),
      ]

      renderWithProviders(<AreaProgressTable areas={areas} />)

      // Should show checkmarks (one in gap column + one in legend)
      const checkmarks = screen.getAllByText('✓')
      expect(checkmarks.length).toBeGreaterThanOrEqual(1)
    })

    /**
     * Validates: Requirements 6.2, 6.3, 6.4
     * Should show gaps for all three levels with new thresholds
     * For clubBase=4: Distinguished=2, Select=3, President's=3 (plus 5 paid)
     */
    it('should display gaps for all recognition levels with new thresholds', () => {
      const areas: AreaWithDivision[] = [
        // 4 club base, 4 paid, 0 distinguished
        // Distinguished (50%) needs 2, Select (50%+1) needs 3, Presidents needs 3 (but also +1 paid)
        createArea({ clubBase: 4, paidClubs: 4, distinguishedClubs: 0 }),
      ]

      renderWithProviders(<AreaProgressTable areas={areas} />)

      // Should show gap values for each level
      expect(screen.getByText('+2')).toBeInTheDocument() // Distinguished gap
      // Select and President's both need +3, so use getAllByText
      const plus3Elements = screen.getAllByText('+3')
      expect(plus3Elements.length).toBe(2) // One for Select, one for President's
    })

    /**
     * Validates: Requirement 6.5
     * All levels achieved should show checkmarks
     */
    it('should display checkmarks for all achieved levels', () => {
      const areas: AreaWithDivision[] = [
        // 4 club base, 5 paid (clubBase+1), 3 distinguished (50%+1)
        // All levels achieved: Distinguished, Select, President's
        createArea({ clubBase: 4, paidClubs: 5, distinguishedClubs: 3 }),
      ]

      renderWithProviders(<AreaProgressTable areas={areas} />)

      // Should show 4 checkmarks (3 in gap columns + 1 in legend)
      const checkmarks = screen.getAllByText('✓')
      expect(checkmarks.length).toBe(4)
    })
  })

  describe('Property 8: No Net Loss Blocker Display', () => {
    /**
     * Validates: Requirement 6.6
     * WHEN an area cannot achieve a recognition level due to net club loss,
     * THE System SHALL indicate the no net loss requirement must be met first
     */
    it('should display dash for gaps when no net loss requirement not met', () => {
      const areas: AreaWithDivision[] = [
        // 4 club base, 3 paid = net loss, below requirement
        createArea({ clubBase: 4, paidClubs: 3, distinguishedClubs: 2 }),
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
    it('should have tooltip explaining no net loss requirement on gap dashes', () => {
      const areas: AreaWithDivision[] = [
        createArea({ clubBase: 4, paidClubs: 3, distinguishedClubs: 2 }),
      ]

      renderWithProviders(<AreaProgressTable areas={areas} />)

      // Find dashes with the specific title (gap column dashes, not legend)
      const dashElements = screen.getAllByText('—')
      const gapDashes = dashElements.filter(
        element =>
          element.getAttribute('title') ===
          'Meet no net club loss requirement first'
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
     * Tests area with exactly no net loss threshold (paidClubs = clubBase)
     */
    it('should correctly classify area at exact no net loss threshold', () => {
      const areas: AreaWithDivision[] = [
        // 4 club base, 4 paid = exactly meets no net loss
        createArea({ clubBase: 4, paidClubs: 4, distinguishedClubs: 2 }),
      ]

      renderWithProviders(<AreaProgressTable areas={areas} />)

      // Should meet requirement and show recognition level (not "Net Loss")
      expect(screen.queryByText('Net Loss')).not.toBeInTheDocument()
      // Use getAllByText since "Distinguished" appears in header and badge
      const distinguishedElements = screen.getAllByText('Distinguished')
      expect(distinguishedElements.length).toBeGreaterThanOrEqual(1)
    })

    /**
     * Tests area with 1 club (minimum case)
     * For clubBase=1: Distinguished needs ceil(1*0.5)=1, Select needs 2, President's needs 2 (and 2 paid)
     */
    it('should handle area with single club', () => {
      const areas: AreaWithDivision[] = [
        // 1 club base, 2 paid (clubBase+1), 2 distinguished (50%+1)
        createArea({ clubBase: 1, paidClubs: 2, distinguishedClubs: 2 }),
      ]

      renderWithProviders(<AreaProgressTable areas={areas} />)

      // Should render and show President's Distinguished
      expect(screen.getByText("President's Distinguished")).toBeInTheDocument()
    })

    /**
     * Tests multiple areas with different recognition levels under new DAP criteria
     */
    it('should display multiple areas with different recognition levels', () => {
      const areas: AreaWithDivision[] = [
        // President's Distinguished: 5 paid (clubBase+1), 3 distinguished (50%+1)
        createArea({
          areaId: 'A1',
          divisionId: 'A',
          clubBase: 4,
          paidClubs: 5,
          distinguishedClubs: 3,
        }),
        // Select Distinguished: 4 paid (clubBase), 3 distinguished (50%+1)
        createArea({
          areaId: 'A2',
          divisionId: 'A',
          clubBase: 4,
          paidClubs: 4,
          distinguishedClubs: 3,
        }),
        // Distinguished: 4 paid (clubBase), 2 distinguished (50%)
        createArea({
          areaId: 'B1',
          divisionId: 'B',
          clubBase: 4,
          paidClubs: 4,
          distinguishedClubs: 2,
        }),
        // Not Distinguished: 4 paid (clubBase), 1 distinguished (25%)
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

    /**
     * Tests area with net club loss among multiple areas
     */
    it('should display "Net Loss" for area with paidClubs < clubBase among multiple areas', () => {
      const areas: AreaWithDivision[] = [
        // Distinguished: meets requirements
        createArea({
          areaId: 'A1',
          divisionId: 'A',
          clubBase: 4,
          paidClubs: 4,
          distinguishedClubs: 2,
        }),
        // Net Loss: paidClubs < clubBase
        createArea({
          areaId: 'A2',
          divisionId: 'A',
          clubBase: 4,
          paidClubs: 3,
          distinguishedClubs: 2,
        }),
      ]

      renderWithProviders(<AreaProgressTable areas={areas} />)

      expect(screen.getByText('Net Loss')).toBeInTheDocument()
    })
  })

  describe('Table Footer Legend - Updated Text', () => {
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
    })

    /**
     * Tests that legend shows updated text for no net loss requirement
     * Should say "Meet no net loss requirement first" instead of "Meet paid threshold first"
     */
    it('should display "Meet no net loss requirement first" in legend', () => {
      const areas: AreaWithDivision[] = [
        createArea({ areaId: 'A1', divisionId: 'A' }),
      ]

      renderWithProviders(<AreaProgressTable areas={areas} />)

      expect(
        screen.getByText(/Meet no net loss requirement first/)
      ).toBeInTheDocument()
      // Should NOT have old text
      expect(
        screen.queryByText(/Meet paid threshold first/)
      ).not.toBeInTheDocument()
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
