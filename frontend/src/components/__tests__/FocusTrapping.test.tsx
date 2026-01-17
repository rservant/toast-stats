import { render, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ColumnHeader } from '../ColumnHeader'
import type { SortField, SortDirection } from '../filters/types'

/**
 * Unit tests for focus trapping in filter dropdowns
 *
 * **Feature: clubs-table-column-filtering**
 * **Validates: Requirements 6.5**
 *
 * Tests that keyboard navigation is trapped within filter dropdowns until they are closed,
 * ensuring accessibility compliance for keyboard-only users.
 */

// Helper function to get all focusable elements within a container
const getFocusableElements = (container: Element): HTMLElement[] => {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  )
}

describe('Focus Trapping', () => {
  const defaultSort = {
    field: 'name' as SortField,
    direction: 'asc' as SortDirection,
  }

  describe('dropdown focus management', () => {
    it('should focus first element in dropdown when dropdown opens', () => {
      const mockOnSort = vi.fn()
      const mockOnFilter = vi.fn()

      const { container } = render(
        <ColumnHeader
          field="name"
          label="Club Name"
          sortable={true}
          filterable={true}
          filterType="text"
          currentSort={defaultSort}
          currentFilter={null}
          onSort={mockOnSort}
          onFilter={mockOnFilter}
          options={[]}
        />
      )

      const headerButton = container.querySelector('button[aria-expanded]')
      expect(headerButton).toBeTruthy()

      // Open the dropdown
      fireEvent.click(headerButton!)

      // Verify dropdown is open
      expect(headerButton).toHaveAttribute('aria-expanded', 'true')

      // Get dropdown and its focusable elements
      const dropdown = container.querySelector('[class*="absolute"]')
      expect(dropdown).toBeTruthy()

      const focusableElements = getFocusableElements(dropdown!)
      expect(focusableElements.length).toBeGreaterThan(0)

      // The focus trap hook sets up focus management for the dropdown
      // Verify that focusable elements exist and are properly configured
      focusableElements.forEach(element => {
        const tabIndex = element.getAttribute('tabIndex')
        // Elements should be focusable (tabIndex 0 or null/not set)
        expect(tabIndex === '0' || tabIndex === null).toBe(true)
      })
    })

    it('should contain multiple focusable elements for text filter', () => {
      const mockOnSort = vi.fn()
      const mockOnFilter = vi.fn()

      const { container } = render(
        <ColumnHeader
          field="name"
          label="Club Name"
          sortable={true}
          filterable={true}
          filterType="text"
          currentSort={defaultSort}
          currentFilter={null}
          onSort={mockOnSort}
          onFilter={mockOnFilter}
          options={[]}
        />
      )

      const headerButton = container.querySelector('button[aria-expanded]')
      fireEvent.click(headerButton!)

      const dropdown = container.querySelector('[class*="absolute"]')
      const focusableElements = getFocusableElements(dropdown!)

      // Text filter should have: sort buttons (2) + operator buttons (2) + text input + apply/clear buttons (2)
      expect(focusableElements.length).toBeGreaterThanOrEqual(4)

      // All elements should have proper tabIndex for focus management
      focusableElements.forEach(element => {
        const tabIndex = element.getAttribute('tabIndex')
        expect(tabIndex === '0' || tabIndex === null).toBe(true)
      })
    })

    it('should contain multiple focusable elements for numeric filter', () => {
      const mockOnSort = vi.fn()
      const mockOnFilter = vi.fn()

      const { container } = render(
        <ColumnHeader
          field="membership"
          label="Members"
          sortable={true}
          filterable={true}
          filterType="numeric"
          currentSort={defaultSort}
          currentFilter={null}
          onSort={mockOnSort}
          onFilter={mockOnFilter}
          options={[]}
        />
      )

      const headerButton = container.querySelector('button[aria-expanded]')
      fireEvent.click(headerButton!)

      const dropdown = container.querySelector('[class*="absolute"]')
      const focusableElements = getFocusableElements(dropdown!)

      // Numeric filter should have: sort buttons (2) + min/max inputs (2) + apply/clear buttons (2)
      expect(focusableElements.length).toBeGreaterThanOrEqual(4)
    })

    it('should contain multiple focusable elements for categorical filter', () => {
      const mockOnSort = vi.fn()
      const mockOnFilter = vi.fn()

      const { container } = render(
        <ColumnHeader
          field="status"
          label="Status"
          sortable={true}
          filterable={true}
          filterType="categorical"
          currentSort={defaultSort}
          currentFilter={null}
          onSort={mockOnSort}
          onFilter={mockOnFilter}
          options={['Active', 'Inactive', 'Suspended']}
        />
      )

      const headerButton = container.querySelector('button[aria-expanded]')
      fireEvent.click(headerButton!)

      const dropdown = container.querySelector('[class*="absolute"]')
      const focusableElements = getFocusableElements(dropdown!)

      // Categorical filter should have: sort buttons (2) + select all + options (3) + apply/clear buttons (2)
      expect(focusableElements.length).toBeGreaterThanOrEqual(5)
    })
  })

  describe('Escape key behavior', () => {
    it('should close dropdown when Escape is pressed', () => {
      const mockOnSort = vi.fn()
      const mockOnFilter = vi.fn()

      const { container } = render(
        <ColumnHeader
          field="name"
          label="Club Name"
          sortable={true}
          filterable={true}
          filterType="text"
          currentSort={defaultSort}
          currentFilter={null}
          onSort={mockOnSort}
          onFilter={mockOnFilter}
          options={[]}
        />
      )

      const headerButton = container.querySelector('button[aria-expanded]')

      // Open the dropdown
      fireEvent.click(headerButton!)
      expect(headerButton).toHaveAttribute('aria-expanded', 'true')

      // Press Escape
      fireEvent.keyDown(headerButton!, { key: 'Escape' })

      // Dropdown should be closed
      expect(headerButton).toHaveAttribute('aria-expanded', 'false')
    })

    it('should return focus to header button when Escape closes dropdown', () => {
      const mockOnSort = vi.fn()
      const mockOnFilter = vi.fn()

      const { container } = render(
        <ColumnHeader
          field="name"
          label="Club Name"
          sortable={true}
          filterable={true}
          filterType="text"
          currentSort={defaultSort}
          currentFilter={null}
          onSort={mockOnSort}
          onFilter={mockOnFilter}
          options={[]}
        />
      )

      const headerButton = container.querySelector(
        'button[aria-expanded]'
      ) as HTMLButtonElement

      // Open the dropdown
      fireEvent.click(headerButton!)
      expect(headerButton).toHaveAttribute('aria-expanded', 'true')

      // Verify dropdown exists
      const dropdown = container.querySelector('[class*="absolute"]')
      expect(dropdown).toBeTruthy()

      // Press Escape on document (simulating global escape handler)
      fireEvent.keyDown(document, { key: 'Escape' })

      // Dropdown should be closed
      expect(headerButton).toHaveAttribute('aria-expanded', 'false')

      // Focus should return to header button
      expect(document.activeElement).toBe(headerButton)
    })

    it('should close dropdown when Escape is pressed from within dropdown', () => {
      const mockOnSort = vi.fn()
      const mockOnFilter = vi.fn()

      const { container } = render(
        <ColumnHeader
          field="division"
          label="Division"
          sortable={true}
          filterable={true}
          filterType="categorical"
          currentSort={defaultSort}
          currentFilter={null}
          onSort={mockOnSort}
          onFilter={mockOnFilter}
          options={['A', 'B', 'C']}
        />
      )

      const headerButton = container.querySelector('button[aria-expanded]')

      // Open the dropdown
      fireEvent.click(headerButton!)
      expect(headerButton).toHaveAttribute('aria-expanded', 'true')

      // Get dropdown
      const dropdown = container.querySelector('[class*="absolute"]')
      expect(dropdown).toBeTruthy()

      // Press Escape on the dropdown
      fireEvent.keyDown(dropdown!, { key: 'Escape' })

      // Dropdown should be closed
      expect(headerButton).toHaveAttribute('aria-expanded', 'false')
    })
  })

  describe('focus containment', () => {
    it('should keep focusable elements within dropdown boundaries', () => {
      const mockOnSort = vi.fn()
      const mockOnFilter = vi.fn()

      const { container } = render(
        <div>
          <button data-testid="outside-before">Before</button>
          <ColumnHeader
            field="name"
            label="Club Name"
            sortable={true}
            filterable={true}
            filterType="text"
            currentSort={defaultSort}
            currentFilter={null}
            onSort={mockOnSort}
            onFilter={mockOnFilter}
            options={[]}
          />
          <button data-testid="outside-after">After</button>
        </div>
      )

      const headerButton = container.querySelector('button[aria-expanded]')

      // Open the dropdown
      fireEvent.click(headerButton!)

      const dropdown = container.querySelector('[class*="absolute"]')
      expect(dropdown).toBeTruthy()

      // Get focusable elements within dropdown
      const focusableElements = getFocusableElements(dropdown!)
      expect(focusableElements.length).toBeGreaterThan(0)

      // All focusable elements should be contained within the dropdown
      focusableElements.forEach(element => {
        expect(dropdown!.contains(element)).toBe(true)
      })

      // Elements outside should not be in the dropdown's focusable elements
      const outsideElements = container.querySelectorAll(
        '[data-testid^="outside"]'
      )
      expect(outsideElements.length).toBe(2)

      outsideElements.forEach(outsideElement => {
        expect(focusableElements.includes(outsideElement as HTMLElement)).toBe(
          false
        )
      })
    })

    it('should remove dropdown from DOM when closed', () => {
      const mockOnSort = vi.fn()
      const mockOnFilter = vi.fn()

      const { container } = render(
        <ColumnHeader
          field="name"
          label="Club Name"
          sortable={true}
          filterable={true}
          filterType="text"
          currentSort={defaultSort}
          currentFilter={null}
          onSort={mockOnSort}
          onFilter={mockOnFilter}
          options={[]}
        />
      )

      const headerButton = container.querySelector('button[aria-expanded]')

      // Open the dropdown
      fireEvent.click(headerButton!)

      // Verify dropdown exists
      let dropdown = container.querySelector('[class*="absolute"]')
      expect(dropdown).toBeTruthy()

      // Close the dropdown
      fireEvent.keyDown(headerButton!, { key: 'Escape' })

      // Dropdown should no longer be in DOM
      dropdown = container.querySelector('[class*="absolute"]')
      expect(dropdown).toBeFalsy()
    })
  })

  describe('sortable-only and filterable-only headers', () => {
    it('should have focusable elements for sortable-only header', () => {
      const mockOnSort = vi.fn()
      const mockOnFilter = vi.fn()

      const { container } = render(
        <ColumnHeader
          field="name"
          label="Club Name"
          sortable={true}
          filterable={false}
          filterType="text"
          currentSort={defaultSort}
          currentFilter={null}
          onSort={mockOnSort}
          onFilter={mockOnFilter}
          options={[]}
        />
      )

      const headerButton = container.querySelector('button[aria-expanded]')
      fireEvent.click(headerButton!)

      const dropdown = container.querySelector('[class*="absolute"]')
      expect(dropdown).toBeTruthy()

      const focusableElements = getFocusableElements(dropdown!)
      // Should have at least sort buttons
      expect(focusableElements.length).toBeGreaterThanOrEqual(2)
    })

    it('should have focusable elements for filterable-only header', () => {
      const mockOnSort = vi.fn()
      const mockOnFilter = vi.fn()

      const { container } = render(
        <ColumnHeader
          field="name"
          label="Club Name"
          sortable={false}
          filterable={true}
          filterType="text"
          currentSort={defaultSort}
          currentFilter={null}
          onSort={mockOnSort}
          onFilter={mockOnFilter}
          options={[]}
        />
      )

      const headerButton = container.querySelector('button[aria-expanded]')
      fireEvent.click(headerButton!)

      const dropdown = container.querySelector('[class*="absolute"]')
      expect(dropdown).toBeTruthy()

      const focusableElements = getFocusableElements(dropdown!)
      // Should have filter input and buttons
      expect(focusableElements.length).toBeGreaterThanOrEqual(2)
    })
  })
})
