import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import StatCard from '../StatCard'

describe('StatCard', () => {
  it('should render stat name and value', () => {
    render(<StatCard name="Total Members" value={1250} />)

    expect(screen.getByText('Total Members')).toBeInTheDocument()
    expect(screen.getByText('1250')).toBeInTheDocument()
  })

  it('should display loading state', () => {
    render(<StatCard name="Total Members" value={1250} isLoading={true} />)

    expect(screen.getByLabelText('Loading statistics')).toBeInTheDocument()
    expect(screen.queryByText('Total Members')).not.toBeInTheDocument()
  })

  it('should display positive trend with green color', () => {
    render(
      <StatCard
        name="Total Members"
        value={1250}
        change={50}
        changePercent={4.2}
        trend="positive"
      />
    )

    const trendElement = screen.getByRole('status')
    expect(trendElement).toHaveTextContent('+50')
    expect(trendElement).toHaveTextContent('(+4.2%)')
    expect(trendElement).toHaveClass('text-green-600')
  })

  it('should display negative trend with red color', () => {
    render(
      <StatCard
        name="Total Members"
        value={1200}
        change={-50}
        changePercent={-4.0}
        trend="negative"
      />
    )

    const trendElement = screen.getByRole('status')
    expect(trendElement).toHaveTextContent('-50')
    expect(trendElement).toHaveTextContent('(-4.0%)')
    expect(trendElement).toHaveClass('text-red-600')
  })

  it('should display neutral trend', () => {
    render(
      <StatCard
        name="Total Members"
        value={1250}
        change={0}
        changePercent={0}
        trend="neutral"
      />
    )

    const trendElement = screen.getByRole('status')
    expect(trendElement).toHaveTextContent('0')
    expect(trendElement).toHaveClass('text-gray-600')
  })

  it('should render footer content when provided', () => {
    render(
      <StatCard
        name="Total Members"
        value={1250}
        footer={<div>Last updated: Today</div>}
      />
    )

    expect(screen.getByText('Last updated: Today')).toBeInTheDocument()
  })

  it('should handle string values', () => {
    render(<StatCard name="Status" value="Active" />)

    expect(screen.getByText('Active')).toBeInTheDocument()
  })
})
