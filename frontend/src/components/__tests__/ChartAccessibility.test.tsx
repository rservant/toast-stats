/**
 * Tests for ChartAccessibility (#218)
 */
import { describe, it, expect } from 'vitest'
import { screen, render, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import ChartAccessibility from '../ChartAccessibility'

const mockTableData = {
  headers: ['Month', 'Members'],
  rows: [
    ['Jan', 20],
    ['Feb', 22],
    ['Mar', 25],
  ],
}

describe('ChartAccessibility (#218)', () => {
  it('renders chart by default with aria-label', () => {
    render(
      <ChartAccessibility
        ariaLabel="Membership trend: 20 to 25 over 3 months"
        tableData={mockTableData}
        caption="Membership Trend"
      >
        <div data-testid="mock-chart">Chart content</div>
      </ChartAccessibility>
    )

    const chart = screen.getByTestId('chart-a11y-chart')
    expect(chart).toHaveAttribute(
      'aria-label',
      'Membership trend: 20 to 25 over 3 months'
    )
    expect(chart).toHaveAttribute('role', 'img')
    expect(screen.getByTestId('mock-chart')).toBeInTheDocument()
  })

  it('shows toggle button', () => {
    render(
      <ChartAccessibility
        ariaLabel="Test"
        tableData={mockTableData}
        caption="Test"
      >
        <div>Chart</div>
      </ChartAccessibility>
    )

    expect(screen.getByTestId('chart-a11y-toggle')).toBeInTheDocument()
    expect(screen.getByTestId('chart-a11y-toggle').textContent).toContain(
      'Show as table'
    )
  })

  it('toggles to data table view', () => {
    render(
      <ChartAccessibility
        ariaLabel="Test"
        tableData={mockTableData}
        caption="Membership Trend"
      >
        <div data-testid="mock-chart">Chart</div>
      </ChartAccessibility>
    )

    fireEvent.click(screen.getByTestId('chart-a11y-toggle'))

    // Table should be visible
    const table = screen.getByTestId('chart-a11y-table')
    expect(table).toBeInTheDocument()

    // Chart should be hidden
    expect(screen.queryByTestId('mock-chart')).not.toBeInTheDocument()

    // Headers should be rendered
    expect(screen.getByText('Month')).toBeInTheDocument()
    expect(screen.getByText('Members')).toBeInTheDocument()

    // Rows should be rendered
    expect(screen.getByText('Jan')).toBeInTheDocument()
    expect(screen.getByText('25')).toBeInTheDocument()
  })

  it('toggles back to chart view', () => {
    render(
      <ChartAccessibility
        ariaLabel="Test"
        tableData={mockTableData}
        caption="Test"
      >
        <div data-testid="mock-chart">Chart</div>
      </ChartAccessibility>
    )

    // Toggle to table
    fireEvent.click(screen.getByTestId('chart-a11y-toggle'))
    expect(screen.queryByTestId('mock-chart')).not.toBeInTheDocument()

    // Toggle back to chart
    fireEvent.click(screen.getByTestId('chart-a11y-toggle'))
    expect(screen.getByTestId('mock-chart')).toBeInTheDocument()
  })

  it('table has proper accessibility attributes', () => {
    render(
      <ChartAccessibility
        ariaLabel="Test"
        tableData={mockTableData}
        caption="Membership Trend"
      >
        <div>Chart</div>
      </ChartAccessibility>
    )

    fireEvent.click(screen.getByTestId('chart-a11y-toggle'))

    const region = screen.getByTestId('chart-a11y-table')
    expect(region).toHaveAttribute('role', 'region')
    expect(region).toHaveAttribute(
      'aria-label',
      'Membership Trend — data table'
    )
  })
})
