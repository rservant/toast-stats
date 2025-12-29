import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import * as fc from 'fast-check'
import { ColumnHeader } from '../ColumnHeader'
import { SortField, SortDirection, ColumnFilter } from '../filters/types'

/**
 * Property-based tests for ColumnHeader component
 * Feature: clubs-table-column-filtering
 */

describe('ColumnHeader Property Tests', () => {
  /**
   * Property 1: Column header interaction displays controls
   * For any filterable column header, when clicked, both sort and filter UI controls should become visible and accessible
   * **Validates: Requirements 1.1, 4.4**
   */
  it('should display both sort and filter controls when filterable column header is clicked', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<SortField>(
          'name',
          'division',
          'area',
          'membership',
          'dcpGoals',
          'status',
          'distinguished'
        ),
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.boolean(),
        fc.boolean(),
        fc.constantFrom<'text' | 'numeric' | 'categorical'>(
          'text',
          'numeric',
          'categorical'
        ),
        fc.constantFrom<SortDirection>('asc', 'desc'),
        fc.array(fc.string({ minLength: 1, maxLength: 10 }), {
          minLength: 0,
          maxLength: 5,
        }),
        (
          field,
          label,
          sortable,
          filterable,
          filterType,
          sortDirection,
          options
        ) => {
          // Skip test if column is not filterable - property only applies to filterable columns
          if (!filterable) return

          const mockOnSort = vi.fn()
          const mockOnFilter = vi.fn()

          const currentSort = {
            field: null as SortField | null,
            direction: sortDirection,
          }
          const currentFilter: ColumnFilter | null = null

          const { unmount } = render(
            <ColumnHeader
              field={field}
              label={label}
              sortable={sortable}
              filterable={filterable}
              filterType={filterType}
              currentSort={currentSort}
              currentFilter={currentFilter}
              onSort={mockOnSort}
              onFilter={mockOnFilter}
              options={options}
            />
          )

          try {
            // Find the column header button - use a more robust selector
            const headerButton = screen.getByRole('button', {
              name: (_name, element) => {
                // Match any button that contains the label text (even if whitespace-only)
                const ariaLabel = element?.getAttribute('aria-label') || ''
                return (
                  ariaLabel.includes(label) ||
                  ariaLabel.includes('column header')
                )
              },
            })
            expect(headerButton).toBeInTheDocument()

            // Click to open dropdown
            fireEvent.click(headerButton)

            // Verify dropdown is open and accessible
            const dropdown = screen.getByRole('button', { expanded: true })
            expect(dropdown).toBeInTheDocument()

            // For filterable columns, filter controls should be visible
            if (filterable) {
              const filterHeading = screen.getByText('Filter')
              expect(filterHeading).toBeInTheDocument()

              // Apply and Clear buttons should be present
              const applyButton = screen.getByText('Apply')
              const clearButton = screen.getByText('Clear')
              expect(applyButton).toBeInTheDocument()
              expect(clearButton).toBeInTheDocument()
            }

            // For sortable columns, sort controls should be visible
            if (sortable) {
              const sortHeading = screen.getByText('Sort')
              expect(sortHeading).toBeInTheDocument()

              // Sort buttons should be present
              const sortAscButton = screen.getByText('Sort A-Z')
              const sortDescButton = screen.getByText('Sort Z-A')
              expect(sortAscButton).toBeInTheDocument()
              expect(sortDescButton).toBeInTheDocument()
            }
          } finally {
            unmount()
          }
        }
      ),
      { numRuns: 100, verbose: true }
    )
  })

  /**
   * Property 2: Active filters show visual indicators
   * For any column with an active filter, the column header should display a visual filter indicator
   * **Validates: Requirements 1.4, 4.2**
   */
  it('should display visual filter indicator when column has active filter', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<SortField>(
          'name',
          'division',
          'area',
          'membership',
          'dcpGoals',
          'status',
          'distinguished'
        ),
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.boolean(),
        fc.constantFrom<'text' | 'numeric' | 'categorical'>(
          'text',
          'numeric',
          'categorical'
        ),
        fc.constantFrom<SortDirection>('asc', 'desc'),
        fc.array(fc.string({ minLength: 1, maxLength: 10 }), {
          minLength: 0,
          maxLength: 5,
        }),
        (field, label, sortable, filterType, sortDirection, options) => {
          const mockOnSort = vi.fn()
          const mockOnFilter = vi.fn()

          const currentSort = {
            field: null as SortField | null,
            direction: sortDirection,
          }

          // Create an active filter based on filter type
          let activeFilter: ColumnFilter
          switch (filterType) {
            case 'text':
              activeFilter = {
                field,
                type: filterType,
                value: 'test filter',
                operator: 'contains',
              }
              break
            case 'numeric':
              activeFilter = {
                field,
                type: filterType,
                value: [1, 10],
                operator: 'range',
              }
              break
            case 'categorical':
              activeFilter = {
                field,
                type: filterType,
                value: options.slice(0, 1),
                operator: 'in',
              }
              break
          }

          const { unmount } = render(
            <ColumnHeader
              field={field}
              label={label}
              sortable={sortable}
              filterable={true}
              filterType={filterType}
              currentSort={currentSort}
              currentFilter={activeFilter}
              onSort={mockOnSort}
              onFilter={mockOnFilter}
              options={options}
            />
          )

          try {
            // Find the column header button - use a more robust selector
            const headerButton = screen.getByRole('button', {
              name: (_name, element) => {
                // Match any button that contains the label text (even if whitespace-only)
                const ariaLabel = element?.getAttribute('aria-label') || ''
                return (
                  ariaLabel.includes(label) ||
                  ariaLabel.includes('column header')
                )
              },
            })
            expect(headerButton).toBeInTheDocument()

            // Check for filter indicator - should be blue (active) instead of gray (inactive)
            // The filter icon should have blue color class when active
            const filterIcon = headerButton.querySelector(
              'svg[class*="text-blue-600"]'
            )
            expect(filterIcon).toBeInTheDocument()
          } finally {
            unmount()
          }
        }
      ),
      { numRuns: 100, verbose: true }
    )
  })

  /**
   * Property 9: Sortable columns show indicators
   * For any sortable column, the column header should display a sort indicator icon
   * **Validates: Requirements 4.1**
   */
  it('should display sort indicator icon when column is sortable', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<SortField>(
          'name',
          'division',
          'area',
          'membership',
          'dcpGoals',
          'status',
          'distinguished'
        ),
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.boolean(),
        fc.constantFrom<'text' | 'numeric' | 'categorical'>(
          'text',
          'numeric',
          'categorical'
        ),
        fc.constantFrom<SortDirection>('asc', 'desc'),
        fc.array(fc.string({ minLength: 1, maxLength: 10 }), {
          minLength: 0,
          maxLength: 5,
        }),
        (field, label, sortable, filterType, sortDirection, options) => {
          // Skip test if column is not sortable - property only applies to sortable columns
          if (!sortable) return

          const mockOnSort = vi.fn()
          const mockOnFilter = vi.fn()

          const currentSort = {
            field: null as SortField | null,
            direction: sortDirection,
          }
          const currentFilter: ColumnFilter | null = null

          const { unmount } = render(
            <ColumnHeader
              field={field}
              label={label}
              sortable={sortable}
              filterable={true}
              filterType={filterType}
              currentSort={currentSort}
              currentFilter={currentFilter}
              onSort={mockOnSort}
              onFilter={mockOnFilter}
              options={options}
            />
          )

          try {
            // Find the column header button - use a more robust selector
            const headerButton = screen.getByRole('button', {
              name: (_name, element) => {
                // Match any button that contains the label text (even if whitespace-only)
                const ariaLabel = element?.getAttribute('aria-label') || ''
                return (
                  ariaLabel.includes(label) ||
                  ariaLabel.includes('column header')
                )
              },
            })
            expect(headerButton).toBeInTheDocument()

            // Check for sort indicator icon - should be present for sortable columns
            // Look for SVG elements that represent sort icons
            const sortIcons = headerButton.querySelectorAll('svg')
            expect(sortIcons.length).toBeGreaterThan(0)

            // At least one icon should be a sort indicator (the dual arrow icon for unsorted state)
            const sortIndicator = Array.from(sortIcons).find(icon =>
              icon.querySelector(
                'path[d*="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"]'
              )
            )
            expect(sortIndicator).toBeInTheDocument()
          } finally {
            unmount()
          }
        }
      ),
      { numRuns: 100, verbose: true }
    )
  })

  /**
   * Property 10: Interactive column hover states
   * For any interactive column header, hovering should show visual indication of interactivity
   * **Validates: Requirements 4.3**
   */
  it('should show visual indication of interactivity when column header is hovered', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<SortField>(
          'name',
          'division',
          'area',
          'membership',
          'dcpGoals',
          'status',
          'distinguished'
        ),
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.boolean(),
        fc.boolean(),
        fc.constantFrom<'text' | 'numeric' | 'categorical'>(
          'text',
          'numeric',
          'categorical'
        ),
        fc.constantFrom<SortDirection>('asc', 'desc'),
        fc.array(fc.string({ minLength: 1, maxLength: 10 }), {
          minLength: 0,
          maxLength: 5,
        }),
        (
          field,
          label,
          sortable,
          filterable,
          filterType,
          sortDirection,
          options
        ) => {
          // Skip test if column is neither sortable nor filterable - property only applies to interactive columns
          if (!sortable && !filterable) return

          const mockOnSort = vi.fn()
          const mockOnFilter = vi.fn()

          const currentSort = {
            field: null as SortField | null,
            direction: sortDirection,
          }
          const currentFilter: ColumnFilter | null = null

          const { unmount } = render(
            <ColumnHeader
              field={field}
              label={label}
              sortable={sortable}
              filterable={filterable}
              filterType={filterType}
              currentSort={currentSort}
              currentFilter={currentFilter}
              onSort={mockOnSort}
              onFilter={mockOnFilter}
              options={options}
            />
          )

          try {
            // Find the column header button - use a more robust selector
            const headerButton = screen.getByRole('button', {
              name: (_name, element) => {
                // Match any button that contains the label text (even if whitespace-only)
                const ariaLabel = element?.getAttribute('aria-label') || ''
                return (
                  ariaLabel.includes(label) ||
                  ariaLabel.includes('column header')
                )
              },
            })
            expect(headerButton).toBeInTheDocument()

            // Check that the button has hover classes that provide visual feedback
            // The ColumnHeader component uses these hover classes:
            // - hover:bg-gray-100 (background color change)
            // - hover:text-gray-900 (text color change)
            // - hover:shadow-sm (shadow effect)
            // - group-hover:text-gray-700 (for icons)
            const buttonClasses = headerButton.className

            // Verify hover classes are present for visual feedback
            expect(buttonClasses).toMatch(/hover:bg-gray-100/)
            expect(buttonClasses).toMatch(/hover:text-gray-900/)
            expect(buttonClasses).toMatch(/hover:shadow-sm/)

            // Verify the button has cursor-pointer to indicate interactivity
            expect(buttonClasses).toMatch(/cursor-pointer/)

            // Verify transition classes for smooth hover effects
            expect(buttonClasses).toMatch(/transition-all/)
            expect(buttonClasses).toMatch(/duration-200/)

            // Check that icons within the button have hover state classes
            const icons = headerButton.querySelectorAll('svg')
            if (icons.length > 0) {
              // At least one icon should have group-hover classes for visual feedback
              const hasHoverIcon = Array.from(icons).some(icon => {
                const iconClasses =
                  icon.className.baseVal || icon.getAttribute('class') || ''
                return (
                  iconClasses.includes('group-hover:text-gray-700') ||
                  iconClasses.includes('transition-colors')
                )
              })
              expect(hasHoverIcon).toBe(true)
            }

            // Simulate hover event to verify it doesn't cause errors
            fireEvent.mouseEnter(headerButton)
            fireEvent.mouseLeave(headerButton)

            // Button should still be in the document after hover events
            expect(headerButton).toBeInTheDocument()
          } finally {
            unmount()
          }
        }
      ),
      { numRuns: 100, verbose: true }
    )
  })
})
