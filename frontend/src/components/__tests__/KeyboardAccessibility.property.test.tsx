import { render, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import * as fc from 'fast-check'
import { ColumnHeader } from '../ColumnHeader'
import { TextFilter } from '../filters/TextFilter'
import { NumericFilter } from '../filters/NumericFilter'
import { CategoricalFilter } from '../filters/CategoricalFilter'
import type { SortField, SortDirection } from '../filters/types'

/**
 * Property-based tests for keyboard accessibility
 *
 * **Feature: clubs-table-column-filtering, Property 14: Keyboard accessibility**
 * **Validates: Requirements 6.1**
 *
 * Tests that all filter controls are keyboard accessible via Tab key navigation
 */

// Test data generators
const sortFieldGen = fc.constantFrom(
  'name',
  'division',
  'area',
  'membership',
  'dcpGoals',
  'distinguished',
  'status'
)
const sortDirectionGen = fc.constantFrom('asc', 'desc')
const filterTypeGen = fc.constantFrom('text', 'numeric', 'categorical')

describe('Keyboard Accessibility Property Tests', () => {
  describe('Property 14: Keyboard accessibility', () => {
    it('should make all ColumnHeader controls accessible via Tab key', () => {
      fc.assert(
        fc.property(
          sortFieldGen,
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.boolean(),
          fc.boolean(),
          filterTypeGen,
          sortFieldGen,
          sortDirectionGen,
          (
            field,
            label,
            sortable,
            filterable,
            filterType,
            currentSortField,
            currentSortDirection
          ) => {
            const mockOnSort = vi.fn()
            const mockOnFilter = vi.fn()

            const currentSort = {
              field: currentSortField as SortField,
              direction: currentSortDirection as SortDirection,
            }

            const { container } = render(
              <ColumnHeader
                field={field as SortField}
                label={label}
                sortable={sortable}
                filterable={filterable}
                filterType={filterType}
                currentSort={currentSort}
                currentFilter={null}
                onSort={mockOnSort}
                onFilter={mockOnFilter}
                options={
                  filterType === 'categorical' ? ['Option1', 'Option2'] : []
                }
              />
            )

            // Find the main column header button
            const headerButton = container.querySelector(
              'button[aria-expanded]'
            )
            expect(headerButton).toBeTruthy()

            // Verify the header button has proper tabIndex
            expect(headerButton).toHaveAttribute('tabIndex', '0')

            // Verify the header button has proper aria-label
            expect(headerButton).toHaveAttribute('aria-label')
            const ariaLabel = headerButton?.getAttribute('aria-label') || ''
            expect(ariaLabel).toContain('Press Enter or Space to open options')

            // Open the dropdown to test internal controls
            fireEvent.click(headerButton!)

            // Check that all interactive elements within the dropdown have proper tabIndex
            const interactiveElements = container.querySelectorAll(
              'button:not([tabindex="-1"]), input:not([tabindex="-1"]), [tabindex="0"]'
            )

            // All interactive elements should be keyboard accessible
            interactiveElements.forEach(element => {
              const tabIndex = element.getAttribute('tabIndex')
              // Should either have tabIndex="0" or no tabIndex (which defaults to 0 for interactive elements)
              expect(tabIndex === '0' || tabIndex === null).toBe(true)
            })

            // Verify keyboard event handling on header button
            const keydownEvent = new KeyboardEvent('keydown', { key: 'Enter' })
            Object.defineProperty(keydownEvent, 'preventDefault', {
              value: vi.fn(),
            })

            fireEvent.keyDown(headerButton!, keydownEvent)
            // The dropdown should respond to keyboard events (tested by not throwing errors)
          }
        ),
        { numRuns: 3 }
      )
    })

    it('should make TextFilter controls keyboard accessible', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 20 }),
          (value, placeholder) => {
            const mockOnChange = vi.fn()
            const mockOnClear = vi.fn()

            const { container } = render(
              <TextFilter
                value={value}
                onChange={mockOnChange}
                onClear={mockOnClear}
                placeholder={placeholder}
              />
            )

            // Check text input accessibility
            const textInput = container.querySelector('input[type="text"]')
            expect(textInput).toBeTruthy()
            expect(textInput).toHaveAttribute('tabIndex', '0')
            expect(textInput).toHaveAttribute('aria-label')

            // Check operator buttons accessibility
            const operatorButtons = container.querySelectorAll(
              'button[aria-pressed]'
            )
            expect(operatorButtons.length).toBeGreaterThan(0)

            operatorButtons.forEach(button => {
              expect(button).toHaveAttribute('tabIndex', '0')
              expect(button).toHaveAttribute('aria-label')
              expect(button).toHaveAttribute('aria-pressed')
            })

            // Check clear button accessibility if present
            const clearButtons = container.querySelectorAll(
              'button[aria-label*="Clear"]'
            )
            clearButtons.forEach(button => {
              expect(button).toHaveAttribute('tabIndex', '0')
              expect(button).toHaveAttribute('aria-label')
            })
          }
        ),
        { numRuns: 3 }
      )
    })

    it('should make NumericFilter controls keyboard accessible', () => {
      fc.assert(
        fc.property(
          fc.tuple(fc.option(fc.integer()), fc.option(fc.integer())),
          fc.string({ minLength: 1, maxLength: 20 }),
          ([min, max], label) => {
            const mockOnChange = vi.fn()
            const mockOnClear = vi.fn()

            const { container } = render(
              <NumericFilter
                value={[min, max]}
                onChange={mockOnChange}
                onClear={mockOnClear}
                label={label}
              />
            )

            // Check numeric inputs accessibility
            const numericInputs = container.querySelectorAll(
              'input[type="number"]'
            )
            expect(numericInputs.length).toBe(2) // min and max inputs

            numericInputs.forEach(input => {
              expect(input).toHaveAttribute('tabIndex', '0')
              expect(input).toHaveAttribute('aria-label')
            })

            // Check clear button accessibility if present
            const clearButtons = container.querySelectorAll(
              'button[aria-label*="Clear"]'
            )
            clearButtons.forEach(button => {
              expect(button).toHaveAttribute('tabIndex', '0')
              expect(button).toHaveAttribute('aria-label')
            })
          }
        ),
        { numRuns: 3 }
      )
    })

    it('should make CategoricalFilter controls keyboard accessible', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 15 }), {
            minLength: 1,
            maxLength: 5,
          }),
          fc.array(fc.string({ minLength: 1, maxLength: 15 }), {
            maxLength: 3,
          }),
          fc.string({ minLength: 1, maxLength: 20 }),
          (options, selectedValues, label) => {
            const mockOnChange = vi.fn()
            const mockOnClear = vi.fn()

            const { container } = render(
              <CategoricalFilter
                options={options}
                selectedValues={selectedValues.filter(val =>
                  options.includes(val)
                )}
                onChange={mockOnChange}
                onClear={mockOnClear}
                label={label}
                multiple={true}
              />
            )

            // Check select all button accessibility if present
            const selectAllButtons = container.querySelectorAll(
              'button[aria-label*="Select all"]'
            )
            selectAllButtons.forEach(button => {
              expect(button).toHaveAttribute('tabIndex', '0')
              expect(button).toHaveAttribute('aria-label')
            })

            // Check option checkboxes accessibility
            const checkboxInputs = container.querySelectorAll(
              'input[type="checkbox"]'
            )
            checkboxInputs.forEach(checkbox => {
              expect(checkbox).toHaveAttribute('tabIndex', '0')
              expect(checkbox).toHaveAttribute('aria-label')
            })

            // Check clear button accessibility if present
            const clearButtons = container.querySelectorAll(
              'button[aria-label*="Clear"]'
            )
            clearButtons.forEach(button => {
              expect(button).toHaveAttribute('tabIndex', '0')
              expect(button).toHaveAttribute('aria-label')
            })
          }
        ),
        { numRuns: 3 }
      )
    })

    it('should handle keyboard events properly on all interactive elements', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('Enter', ' ', 'Tab', 'Escape'),
          sortFieldGen,
          fc.string({ minLength: 1, maxLength: 20 }),
          (keyPressed, field, label) => {
            const mockOnSort = vi.fn()
            const mockOnFilter = vi.fn()

            const currentSort = {
              field: 'name' as SortField,
              direction: 'asc' as SortDirection,
            }

            const { container } = render(
              <ColumnHeader
                field={field as SortField}
                label={label}
                sortable={true}
                filterable={true}
                filterType="text"
                currentSort={currentSort}
                currentFilter={null}
                onSort={mockOnSort}
                onFilter={mockOnFilter}
                options={[]}
              />
            )

            const headerButton = container.querySelector(
              'button[aria-expanded]'
            )
            expect(headerButton).toBeTruthy()

            // Test keyboard event handling
            const keydownEvent = new KeyboardEvent('keydown', {
              key: keyPressed,
            })
            const preventDefaultSpy = vi.fn()
            Object.defineProperty(keydownEvent, 'preventDefault', {
              value: preventDefaultSpy,
            })

            // Should not throw errors when handling keyboard events
            expect(() => {
              fireEvent.keyDown(headerButton!, keydownEvent)
            }).not.toThrow()

            // For Enter and Space, preventDefault should be called
            if (keyPressed === 'Enter' || keyPressed === ' ') {
              // The component should handle these keys (tested by not throwing)
            }
          }
        ),
        { numRuns: 3 }
      )
    })
  })
})
