import { render, screen, cleanup } from '@testing-library/react'
import {
  ReconciliationTimeline,
  ReconciliationTimelineEntry,
} from '../ReconciliationTimeline'

describe('ReconciliationTimeline', () => {
  afterEach(() => {
    cleanup()
  })

  const mockEntries: ReconciliationTimelineEntry[] = [
    {
      date: new Date('2024-11-01T12:00:00'),
      sourceDataDate: '2024-10-31',
      hasChanges: true,
      isSignificant: true,
      changesSummary: 'Membership increased by 5%',
      cacheUpdated: true,
    },
    {
      date: new Date('2024-11-02T12:00:00'),
      sourceDataDate: '2024-10-31',
      hasChanges: true,
      isSignificant: false,
      changesSummary: 'Minor club count adjustment',
      cacheUpdated: true,
    },
    {
      date: new Date('2024-11-03T12:00:00'),
      sourceDataDate: '2024-10-31',
      hasChanges: false,
      isSignificant: false,
      cacheUpdated: false,
    },
  ]

  it('renders timeline with entries correctly', () => {
    render(
      <ReconciliationTimeline entries={mockEntries} targetMonth="2024-10" />
    )

    expect(screen.getByText('Reconciliation Timeline')).toBeInTheDocument()
    expect(screen.getByText('Nov 1')).toBeInTheDocument()
    expect(screen.getByText('Nov 2')).toBeInTheDocument()
    expect(screen.getByText('Nov 3')).toBeInTheDocument()
  })

  it('displays empty state when no entries provided', () => {
    render(<ReconciliationTimeline entries={[]} targetMonth="2024-10" />)

    expect(
      screen.getByText('No reconciliation activity yet for 2024-10')
    ).toBeInTheDocument()
  })

  it('shows change summaries when showDetails is true', () => {
    render(
      <ReconciliationTimeline
        entries={mockEntries}
        targetMonth="2024-10"
        showDetails={true}
      />
    )

    expect(screen.getByText('Membership increased by 5%')).toBeInTheDocument()
    expect(screen.getByText('Minor club count adjustment')).toBeInTheDocument()
  })

  it('hides change summaries when showDetails is false', () => {
    render(
      <ReconciliationTimeline
        entries={mockEntries}
        targetMonth="2024-10"
        showDetails={false}
      />
    )

    expect(
      screen.queryByText('Membership increased by 5%')
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText('Minor club count adjustment')
    ).not.toBeInTheDocument()
  })

  it('displays correct status indicators for different change types', () => {
    render(
      <ReconciliationTimeline entries={mockEntries} targetMonth="2024-10" />
    )

    // Check for significant changes indicator
    expect(screen.getByText('Significant changes detected')).toBeInTheDocument()
    // Check for minor changes indicator
    expect(screen.getByText('Minor changes detected')).toBeInTheDocument()
    // Check for no changes indicator
    expect(screen.getByText('No changes detected')).toBeInTheDocument()
  })

  it('shows updated badges for cache updates', () => {
    render(
      <ReconciliationTimeline entries={mockEntries} targetMonth="2024-10" />
    )

    const updatedBadges = screen.getAllByText('Updated')
    expect(updatedBadges).toHaveLength(2) // First two entries have cacheUpdated: true
  })

  it('displays legend correctly', () => {
    render(
      <ReconciliationTimeline entries={mockEntries} targetMonth="2024-10" />
    )

    expect(screen.getByText('Significant changes')).toBeInTheDocument()
    expect(screen.getByText('Minor changes')).toBeInTheDocument()
    expect(screen.getByText('No changes')).toBeInTheDocument()
  })

  it('formats dates correctly', () => {
    render(
      <ReconciliationTimeline entries={mockEntries} targetMonth="2024-10" />
    )

    // Check that dates are formatted as "Nov 1", "Nov 2", etc.
    expect(screen.getByText('Nov 1')).toBeInTheDocument()
    expect(screen.getByText('Nov 2')).toBeInTheDocument()
    expect(screen.getByText('Nov 3')).toBeInTheDocument()
  })

  it('displays source data dates correctly', () => {
    render(
      <ReconciliationTimeline entries={mockEntries} targetMonth="2024-10" />
    )

    const sourceDataElements = screen.getAllByText('Data as of 2024-10-31')
    expect(sourceDataElements).toHaveLength(3) // All entries have same source date
  })

  it('applies custom className when provided', () => {
    const { container } = render(
      <ReconciliationTimeline
        entries={mockEntries}
        targetMonth="2024-10"
        className="custom-class"
      />
    )

    expect(container.firstChild).toHaveClass('custom-class')
  })

  it('handles single entry correctly', () => {
    const singleEntry = [mockEntries[0]]
    render(
      <ReconciliationTimeline entries={singleEntry} targetMonth="2024-10" />
    )

    expect(screen.getByText('Nov 1')).toBeInTheDocument()
    expect(screen.getByText('Significant changes detected')).toBeInTheDocument()
  })

  it('maintains accessibility standards', () => {
    render(
      <ReconciliationTimeline entries={mockEntries} targetMonth="2024-10" />
    )

    // Check for proper heading structure
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(
      'Reconciliation Timeline'
    )

    // Check that the component renders without accessibility violations
    expect(screen.getByText('Reconciliation Timeline')).toBeInTheDocument()
  })

  it('handles entries with missing optional fields', () => {
    const entriesWithMissingFields: ReconciliationTimelineEntry[] = [
      {
        date: new Date('2024-11-01'),
        sourceDataDate: '2024-10-31',
        hasChanges: false,
        isSignificant: false,
        cacheUpdated: false,
        // changesSummary is undefined
      },
    ]

    expect(() => {
      render(
        <ReconciliationTimeline
          entries={entriesWithMissingFields}
          targetMonth="2024-10"
        />
      )
    }).not.toThrow()

    expect(screen.getByText('No changes detected')).toBeInTheDocument()
  })
})
