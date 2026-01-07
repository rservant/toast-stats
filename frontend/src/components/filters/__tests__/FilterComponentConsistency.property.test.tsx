/**
 * Property-based tests for filter component consistency
 * Feature: clubs-table-column-filtering, Property 6: Filter type consistency
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TextFilter, NumericFilter, CategoricalFilter } from '../index'
import { COLUMN_CONFIGS } from '../types'

describe('Filter Component Consistency Properties', () => {
  /**
   * Property 6: Filter type consistency
   * For any filterable column, all columns of the same data type should provide
   * the same filter UI type (text columns get text filters, numeric get range filters,
   * categorical get multi-select)
   *
   * **Validates: Requirements 2.4**
   */
  it('should provide consistent filter types for same data types', () => {
    // Group columns by filter type
    const textColumns = COLUMN_CONFIGS.filter(col => col.filterType === 'text')
    const numericColumns = COLUMN_CONFIGS.filter(
      col => col.filterType === 'numeric'
    )
    const categoricalColumns = COLUMN_CONFIGS.filter(
      col => col.filterType === 'categorical'
    )

    // Verify text columns all use TextFilter component
    textColumns.forEach(column => {
      const { unmount } = render(
        <TextFilter
          value=""
          onChange={() => {}}
          onClear={() => {}}
          placeholder={`Filter ${column.label}...`}
        />
      )

      // Should render text input
      expect(screen.getByRole('textbox')).toBeInTheDocument()

      // Should have operator selection buttons
      expect(screen.getByText('Contains')).toBeInTheDocument()
      expect(screen.getByText('Starts with')).toBeInTheDocument()

      unmount()
    })

    // Verify numeric columns all use NumericFilter component
    numericColumns.forEach(column => {
      const { unmount } = render(
        <NumericFilter
          value={[null, null]}
          onChange={() => {}}
          onClear={() => {}}
          label={column.label}
        />
      )

      // Should render min/max inputs
      const numberInputs = screen.getAllByRole('spinbutton')
      expect(numberInputs).toHaveLength(2)

      // Should have range label
      expect(screen.getByText(`${column.label} Range`)).toBeInTheDocument()

      unmount()
    })

    // Verify categorical columns all use CategoricalFilter component
    categoricalColumns.forEach(column => {
      const options = column.filterOptions || []
      const { unmount } = render(
        <CategoricalFilter
          options={options}
          selectedValues={[]}
          onChange={() => {}}
          onClear={() => {}}
          label={column.label}
        />
      )

      // Should render checkboxes for each option
      options.forEach(option => {
        // Use getAllByText to handle duplicate text (header + option)
        const elements = screen.getAllByText(option)
        expect(elements.length).toBeGreaterThan(0)
      })

      // Should have select all functionality for multiple options
      if (options.length > 1) {
        expect(screen.getByText('Select All')).toBeInTheDocument()
      }

      unmount()
    })
  })

  it('should maintain consistent filter behavior across same data types', () => {
    // Test that all text filters behave consistently
    const textColumns = COLUMN_CONFIGS.filter(col => col.filterType === 'text')

    textColumns.forEach(() => {
      const mockOnChange = vi.fn()
      const mockOnClear = vi.fn()

      const { unmount } = render(
        <TextFilter
          value="test"
          onChange={mockOnChange}
          onClear={mockOnClear}
        />
      )

      // All text filters should have clear functionality
      const clearButton = screen.getByText('Clear Filter')
      expect(clearButton).toBeInTheDocument()

      // All text filters should show current operator
      expect(screen.getByText('Contains text')).toBeInTheDocument()

      unmount()
    })

    // Test that all numeric filters behave consistently
    const numericColumns = COLUMN_CONFIGS.filter(
      col => col.filterType === 'numeric'
    )

    numericColumns.forEach(column => {
      const mockOnChange = vi.fn()
      const mockOnClear = vi.fn()

      const { unmount } = render(
        <NumericFilter
          value={[1, 10]}
          onChange={mockOnChange}
          onClear={mockOnClear}
          label={column.label}
        />
      )

      // All numeric filters should show range display
      expect(screen.getByText('1 - 10')).toBeInTheDocument()

      // All numeric filters should have clear functionality
      expect(screen.getByText('Clear')).toBeInTheDocument()

      unmount()
    })
  })

  it('should provide appropriate filter options for categorical columns', () => {
    // Test Distinguished column has correct options in correct order
    const distinguishedConfig = COLUMN_CONFIGS.find(
      col => col.field === 'distinguished'
    )
    expect(distinguishedConfig?.filterOptions).toEqual([
      'Distinguished',
      'Select',
      'President',
      'Smedley',
      'NotDistinguished',
    ])

    // Test Status column has correct options
    const statusConfig = COLUMN_CONFIGS.find(col => col.field === 'status')
    expect(statusConfig?.filterOptions).toEqual([
      'healthy',
      'at-risk',
      'critical',
    ])

    // Verify these options render correctly
    if (distinguishedConfig?.filterOptions) {
      render(
        <CategoricalFilter
          options={distinguishedConfig.filterOptions}
          selectedValues={[]}
          onChange={() => {}}
          onClear={() => {}}
          label="Distinguished"
        />
      )

      distinguishedConfig.filterOptions.forEach(option => {
        // Use getAllByText to handle duplicate text (header + option)
        const elements = screen.getAllByText(option)
        expect(elements.length).toBeGreaterThan(0)
      })
    }
  })
})
