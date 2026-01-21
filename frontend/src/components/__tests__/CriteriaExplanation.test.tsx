/**
 * CriteriaExplanation Component Tests
 *
 * Tests for the Distinguished Area Program criteria explanation component.
 * Validates content display, expand/collapse functionality, and accessibility.
 *
 * Requirements validated:
 * - 2.1: Show eligibility gate requirement prominently at the top
 * - 2.2: Explain that at least two club visits per club must be completed
 * - 2.3: Indicate that club visit data is not currently available
 * - 2.4: Display eligibility status as "Unknown" when data unavailable
 * - 3.1: Show that at least 75% of clubs must be paid clubs
 * - 3.2: Explain what constitutes a "paid club" (Active status, dues current)
 * - 3.3: Explain what statuses disqualify a club from being "paid"
 * - 4.1: Show Distinguished Area requires at least 50% of paid clubs distinguished
 * - 4.2: Show Select Distinguished requires at least 75% of paid clubs distinguished
 * - 4.3: Show President's Distinguished requires 100% of paid clubs distinguished
 * - 4.4: Indicate percentages are calculated against paid clubs only
 * - 4.5: Present recognition levels in ascending order of achievement
 * - 7.4: Use semantic HTML with appropriate ARIA labels
 */

import { describe, it, expect, afterEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { CriteriaExplanation } from '../CriteriaExplanation'
import {
  renderWithProviders,
  cleanupAllResources,
} from '../../__tests__/utils/componentTestUtils'

describe('CriteriaExplanation', () => {
  afterEach(() => {
    cleanupAllResources()
  })

  describe('Criteria Content Display', () => {
    /**
     * Validates: Requirements 2.1, 2.2
     * THE Criteria_Display SHALL show the eligibility gate requirement prominently
     * THE Criteria_Display SHALL explain that at least two club visits per club must be completed
     */
    it('should display eligibility gate section with club visits requirement', () => {
      renderWithProviders(<CriteriaExplanation defaultExpanded={true} />)

      // Check eligibility gate heading is present
      expect(screen.getByText('Eligibility Gate')).toBeInTheDocument()

      // Check club visits requirement is explained
      expect(screen.getByText('Club Visit Reports')).toBeInTheDocument()
      expect(
        screen.getByText(/at least two Area Director Club Visit Reports/i)
      ).toBeInTheDocument()
    })

    /**
     * Validates: Requirements 2.3, 2.4
     * THE Criteria_Display SHALL indicate that club visit data is not currently available
     * WHEN club visit data is unavailable, THE System SHALL display eligibility status as "Unknown"
     */
    it('should display "Status: Unknown" for club visit data', () => {
      renderWithProviders(<CriteriaExplanation defaultExpanded={true} />)

      expect(screen.getByText('Status: Unknown')).toBeInTheDocument()
      expect(
        screen.getByText(/Club visit data is not currently available/i)
      ).toBeInTheDocument()
    })

    /**
     * Validates: Requirement 3.1
     * THE Criteria_Display SHALL show that at least 75% of clubs must be paid clubs
     */
    it('should display paid clubs 75% threshold requirement', () => {
      renderWithProviders(<CriteriaExplanation defaultExpanded={true} />)

      expect(screen.getByText('Paid Clubs Requirement')).toBeInTheDocument()
      expect(screen.getByText('75%')).toBeInTheDocument()
      expect(screen.getByText(/75% of clubs/i)).toBeInTheDocument()
    })

    /**
     * Validates: Requirements 3.2, 3.3
     * THE Criteria_Display SHALL explain what constitutes a "paid club"
     * THE Criteria_Display SHALL explain what statuses disqualify a club
     */
    it('should display what qualifies and disqualifies as paid club', () => {
      renderWithProviders(<CriteriaExplanation defaultExpanded={true} />)

      // What qualifies
      expect(screen.getByText('Qualifies as Paid Club')).toBeInTheDocument()
      expect(screen.getByText('Active')).toBeInTheDocument()
      expect(screen.getByText(/Membership dues current/i)).toBeInTheDocument()

      // What disqualifies
      expect(screen.getByText('Does Not Qualify')).toBeInTheDocument()
      expect(screen.getByText('Suspended')).toBeInTheDocument()
      expect(screen.getByText('Ineligible')).toBeInTheDocument()
      expect(screen.getByText('Low')).toBeInTheDocument()
    })

    /**
     * Validates: Requirements 4.1, 4.2, 4.3, 4.5
     * THE Criteria_Display SHALL show all three recognition levels with correct percentages
     * THE Criteria_Display SHALL present recognition levels in ascending order
     */
    it('should display all three recognition levels with correct percentages', () => {
      renderWithProviders(<CriteriaExplanation defaultExpanded={true} />)

      expect(screen.getByText('Recognition Levels')).toBeInTheDocument()

      // Distinguished Area - 50%
      expect(screen.getByText('Distinguished Area')).toBeInTheDocument()
      expect(screen.getByText('≥ 50%')).toBeInTheDocument()

      // Select Distinguished Area - 75%
      expect(screen.getByText('Select Distinguished Area')).toBeInTheDocument()
      // Note: There are multiple ≥ 75% values (paid clubs column and distinguished column)
      const seventyFivePercentElements = screen.getAllByText('≥ 75%')
      expect(seventyFivePercentElements.length).toBeGreaterThanOrEqual(1)

      // President's Distinguished Area - 100%
      expect(
        screen.getByText("President's Distinguished Area")
      ).toBeInTheDocument()
      expect(screen.getByText('100%')).toBeInTheDocument()
    })

    /**
     * Validates: Requirement 4.4
     * THE Criteria_Display SHALL indicate percentages are calculated against paid clubs only
     */
    it('should display note about percentages calculated against paid clubs', () => {
      renderWithProviders(<CriteriaExplanation defaultExpanded={true} />)

      expect(
        screen.getByText(
          /Distinguished club percentages are calculated against/i
        )
      ).toBeInTheDocument()
      expect(screen.getByText(/paid clubs only/i)).toBeInTheDocument()
    })

    /**
     * Validates: Requirement 4.5
     * THE Criteria_Display SHALL present recognition levels in ascending order of achievement
     */
    it('should display recognition levels in ascending order', () => {
      renderWithProviders(<CriteriaExplanation defaultExpanded={true} />)

      const table = screen.getByRole('table', {
        name: /recognition level requirements/i,
      })
      const rows = table.querySelectorAll('tbody tr')

      // Verify order: Distinguished (50%), Select (75%), President's (100%)
      expect(rows[0]).toHaveTextContent('Distinguished Area')
      expect(rows[0]).toHaveTextContent('≥ 50%')

      expect(rows[1]).toHaveTextContent('Select Distinguished Area')
      expect(rows[1]).toHaveTextContent('≥ 75%')

      expect(rows[2]).toHaveTextContent("President's Distinguished Area")
      expect(rows[2]).toHaveTextContent('100%')
    })
  })

  describe('Expand/Collapse Functionality', () => {
    /**
     * Tests that component starts collapsed by default
     */
    it('should start collapsed by default', () => {
      renderWithProviders(<CriteriaExplanation />)

      const toggleButton = screen.getByRole('button', {
        name: /Distinguished Area Program Criteria/i,
      })
      expect(toggleButton).toHaveAttribute('aria-expanded', 'false')

      // Content should be hidden
      const content = document.getElementById('criteria-content')
      expect(content).toHaveAttribute('aria-hidden', 'true')
    })

    /**
     * Tests that component starts expanded when defaultExpanded={true}
     */
    it('should start expanded when defaultExpanded is true', () => {
      renderWithProviders(<CriteriaExplanation defaultExpanded={true} />)

      const toggleButton = screen.getByRole('button', {
        name: /Distinguished Area Program Criteria/i,
      })
      expect(toggleButton).toHaveAttribute('aria-expanded', 'true')

      // Content should be visible
      const content = document.getElementById('criteria-content')
      expect(content).toHaveAttribute('aria-hidden', 'false')
    })

    /**
     * Tests that clicking toggle button expands/collapses content
     */
    it('should toggle content visibility when button is clicked', () => {
      renderWithProviders(<CriteriaExplanation />)

      const toggleButton = screen.getByRole('button', {
        name: /Distinguished Area Program Criteria/i,
      })
      const content = document.getElementById('criteria-content')

      // Initially collapsed
      expect(toggleButton).toHaveAttribute('aria-expanded', 'false')
      expect(content).toHaveAttribute('aria-hidden', 'true')

      // Click to expand
      fireEvent.click(toggleButton)
      expect(toggleButton).toHaveAttribute('aria-expanded', 'true')
      expect(content).toHaveAttribute('aria-hidden', 'false')

      // Click to collapse
      fireEvent.click(toggleButton)
      expect(toggleButton).toHaveAttribute('aria-expanded', 'false')
      expect(content).toHaveAttribute('aria-hidden', 'true')
    })

    /**
     * Tests that content visibility changes appropriately with expand/collapse
     */
    it('should change content visibility classes appropriately', () => {
      renderWithProviders(<CriteriaExplanation />)

      const toggleButton = screen.getByRole('button', {
        name: /Distinguished Area Program Criteria/i,
      })
      const content = document.getElementById('criteria-content')

      // Initially collapsed - should have max-h-0 and opacity-0
      expect(content).toHaveClass('max-h-0')
      expect(content).toHaveClass('opacity-0')

      // Click to expand
      fireEvent.click(toggleButton)

      // Expanded - should have max-h-[2000px] and opacity-100
      expect(content).toHaveClass('max-h-[2000px]')
      expect(content).toHaveClass('opacity-100')
    })
  })

  describe('Accessibility', () => {
    /**
     * Validates: Requirement 7.4
     * Toggle button has aria-expanded attribute
     */
    it('should have aria-expanded attribute on toggle button', () => {
      renderWithProviders(<CriteriaExplanation />)

      const toggleButton = screen.getByRole('button', {
        name: /Distinguished Area Program Criteria/i,
      })
      expect(toggleButton).toHaveAttribute('aria-expanded')
    })

    /**
     * Validates: Requirement 7.4
     * Toggle button has aria-controls attribute
     */
    it('should have aria-controls attribute on toggle button', () => {
      renderWithProviders(<CriteriaExplanation />)

      const toggleButton = screen.getByRole('button', {
        name: /Distinguished Area Program Criteria/i,
      })
      expect(toggleButton).toHaveAttribute('aria-controls', 'criteria-content')
    })

    /**
     * Validates: Requirement 7.4
     * Content section has aria-hidden attribute
     */
    it('should have aria-hidden attribute on content section', () => {
      renderWithProviders(<CriteriaExplanation />)

      const content = document.getElementById('criteria-content')
      expect(content).toHaveAttribute('aria-hidden')
    })

    /**
     * Validates: Requirement 7.4
     * Sections have proper aria-labelledby attributes
     */
    it('should have proper aria-labelledby attributes on sections', () => {
      renderWithProviders(<CriteriaExplanation defaultExpanded={true} />)

      // Eligibility section
      const eligibilitySection = document.querySelector(
        '[aria-labelledby="eligibility-heading"]'
      )
      expect(eligibilitySection).toBeInTheDocument()
      expect(document.getElementById('eligibility-heading')).toBeInTheDocument()

      // Paid clubs section
      const paidClubsSection = document.querySelector(
        '[aria-labelledby="paid-clubs-heading"]'
      )
      expect(paidClubsSection).toBeInTheDocument()
      expect(document.getElementById('paid-clubs-heading')).toBeInTheDocument()

      // Recognition levels section
      const recognitionSection = document.querySelector(
        '[aria-labelledby="recognition-levels-heading"]'
      )
      expect(recognitionSection).toBeInTheDocument()
      expect(
        document.getElementById('recognition-levels-heading')
      ).toBeInTheDocument()
    })

    /**
     * Validates: Requirement 7.4
     * Card has aria-label for screen readers
     */
    it('should have aria-label on the main card', () => {
      const { container } = renderWithProviders(<CriteriaExplanation />)

      const card = container.querySelector(
        '[aria-label="Distinguished Area Program criteria explanation"]'
      )
      expect(card).toBeInTheDocument()
    })

    /**
     * Validates: Requirement 7.4
     * Table has aria-label for screen readers
     */
    it('should have aria-label on the recognition levels table', () => {
      renderWithProviders(<CriteriaExplanation defaultExpanded={true} />)

      const table = screen.getByRole('table', {
        name: /recognition level requirements/i,
      })
      expect(table).toBeInTheDocument()
    })

    /**
     * Validates: Requirement 7.4
     * Table headers have proper scope attributes
     */
    it('should have proper scope attributes on table headers', () => {
      renderWithProviders(<CriteriaExplanation defaultExpanded={true} />)

      const table = screen.getByRole('table', {
        name: /recognition level requirements/i,
      })
      const headers = table.querySelectorAll('th')

      headers.forEach(header => {
        expect(header).toHaveAttribute('scope', 'col')
      })
    })

    /**
     * Validates: Requirement 7.4
     * Decorative icons are hidden from screen readers
     */
    it('should hide decorative icons from screen readers', () => {
      const { container } = renderWithProviders(
        <CriteriaExplanation defaultExpanded={true} />
      )

      const decorativeIcons = container.querySelectorAll(
        'svg[aria-hidden="true"]'
      )
      expect(decorativeIcons.length).toBeGreaterThan(0)
    })

    /**
     * Validates: Requirement 7.3 (touch targets)
     * Toggle button meets minimum touch target size
     */
    it('should have minimum 44px touch target on toggle button', () => {
      renderWithProviders(<CriteriaExplanation />)

      const toggleButton = screen.getByRole('button', {
        name: /Distinguished Area Program Criteria/i,
      })
      expect(toggleButton).toHaveClass('min-h-[44px]')
    })

    /**
     * Validates: Requirement 7.4
     * Toggle button has visible focus indicator
     */
    it('should have visible focus indicator on toggle button', () => {
      renderWithProviders(<CriteriaExplanation />)

      const toggleButton = screen.getByRole('button', {
        name: /Distinguished Area Program Criteria/i,
      })
      expect(toggleButton).toHaveClass('focus-visible:ring-2')
    })
  })
})
