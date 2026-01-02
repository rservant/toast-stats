/**
 * Club Health Detail Modal Component Tests
 *
 * Tests for the club health detail modal component including status display,
 * trajectory analysis, historical trends, and recommendations
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ClubHealthDetailModal } from '../ClubHealthDetailModal'
import { ClubHealthResult, ClubHealthHistory } from '../../types/clubHealth'

// Sample test data
const sampleClub: ClubHealthResult = {
  club_name: 'Test Club Alpha',
  health_status: 'Vulnerable',
  reasons: ['Membership below threshold', 'DCP goals behind schedule'],
  trajectory: 'Declining',
  trajectory_reasons: ['Lost 3 members this month', 'No DCP progress'],
  composite_key: 'Vulnerable__Declining',
  composite_label: 'Vulnerable • Declining',
  members_delta_mom: -3,
  dcp_delta_mom: 0,
  metadata: {
    evaluation_date: '2024-01-15',
    processing_time_ms: 42,
    rule_version: '1.0.0',
  },
}

const sampleThrivingClub: ClubHealthResult = {
  club_name: 'Excellent Speakers',
  health_status: 'Thriving',
  reasons: [
    'Membership requirement met',
    'All DCP goals on track',
    'Strong leadership',
  ],
  trajectory: 'Stable',
  trajectory_reasons: ['Consistent performance', 'Stable membership'],
  composite_key: 'Thriving__Stable',
  composite_label: 'Thriving • Stable',
  members_delta_mom: 2,
  dcp_delta_mom: 1,
  metadata: {
    evaluation_date: '2024-01-15',
    processing_time_ms: 38,
    rule_version: '1.0.0',
  },
}

const sampleHistory: ClubHealthHistory[] = [
  {
    evaluation_date: '2024-01-01',
    health_status: 'Thriving',
    trajectory: 'Stable',
    members: 25,
    dcp_goals: 8,
  },
  {
    evaluation_date: '2024-01-08',
    health_status: 'Vulnerable',
    trajectory: 'Declining',
    members: 22,
    dcp_goals: 8,
  },
  {
    evaluation_date: '2024-01-15',
    health_status: 'Vulnerable',
    trajectory: 'Declining',
    members: 19,
    dcp_goals: 8,
  },
]

describe('ClubHealthDetailModal', () => {
  it('should not render when club is null', () => {
    render(<ClubHealthDetailModal club={null} onClose={vi.fn()} />)

    expect(
      screen.queryByText('Club Health Classification Report')
    ).not.toBeInTheDocument()
  })

  it('should render club information correctly', () => {
    render(<ClubHealthDetailModal club={sampleClub} onClose={vi.fn()} />)

    // Check club name and title
    expect(screen.getByText('Test Club Alpha')).toBeInTheDocument()
    expect(
      screen.getByText('Club Health Classification Report')
    ).toBeInTheDocument()

    // Check health status badge
    expect(screen.getByText('Vulnerable')).toBeInTheDocument()
    expect(screen.getByText('Declining')).toBeInTheDocument()
  })

  it('should display health status analysis with reasons', () => {
    render(<ClubHealthDetailModal club={sampleClub} onClose={vi.fn()} />)

    // Check health status section
    expect(screen.getByText('Health Status Analysis')).toBeInTheDocument()
    expect(screen.getByText('Membership below threshold')).toBeInTheDocument()
    expect(screen.getByText('DCP goals behind schedule')).toBeInTheDocument()
  })

  it('should display trajectory analysis with reasons', () => {
    render(<ClubHealthDetailModal club={sampleClub} onClose={vi.fn()} />)

    // Check trajectory section
    expect(screen.getByText('Trajectory Analysis')).toBeInTheDocument()
    expect(screen.getByText('Lost 3 members this month')).toBeInTheDocument()
    expect(screen.getByText('No DCP progress')).toBeInTheDocument()
  })

  it('should display month-over-month changes', () => {
    render(<ClubHealthDetailModal club={sampleClub} onClose={vi.fn()} />)

    // Check month-over-month section
    expect(screen.getByText('Month-over-Month Changes')).toBeInTheDocument()
    expect(screen.getByText('Membership Change')).toBeInTheDocument()
    expect(screen.getByText('-3 members')).toBeInTheDocument()
    expect(screen.getByText('DCP Goals Change')).toBeInTheDocument()
    expect(screen.getByText(/0 goals/)).toBeInTheDocument()
  })

  it('should generate and display recommendations for vulnerable clubs', () => {
    render(<ClubHealthDetailModal club={sampleClub} onClose={vi.fn()} />)

    // Check recommendations section exists
    expect(screen.getByText('Actionable Recommendations')).toBeInTheDocument()

    // Check that there are some recommendations displayed (at least one)
    const recommendationElements = screen.getAllByText(
      /Monitor|Implement|Review|Focus|Contact|Investigate/
    )
    expect(recommendationElements.length).toBeGreaterThan(0)
  })

  it('should generate appropriate recommendations for intervention required clubs', () => {
    const interventionClub: ClubHealthResult = {
      ...sampleClub,
      health_status: 'Intervention Required',
      reasons: ['Membership critically low', 'No officer training completed'],
    }

    render(<ClubHealthDetailModal club={interventionClub} onClose={vi.fn()} />)

    expect(
      screen.getByText(
        'Immediate action required: Focus on membership recruitment and retention'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Contact District Leadership Team for support and resources'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText('Complete officer training requirements')
    ).toBeInTheDocument()
  })

  it('should display historical trends when history is provided', () => {
    render(
      <ClubHealthDetailModal
        club={sampleClub}
        clubHistory={sampleHistory}
        onClose={vi.fn()}
      />
    )

    // Check historical trends section
    expect(screen.getByText('Historical Trends')).toBeInTheDocument()
    expect(
      screen.getByText(
        /Historical data showing membership and DCP goals progress over time/
      )
    ).toBeInTheDocument()
  })

  it('should not display historical trends when no history is provided', () => {
    render(<ClubHealthDetailModal club={sampleClub} onClose={vi.fn()} />)

    // Historical trends section should not be present
    expect(screen.queryByText('Historical Trends')).not.toBeInTheDocument()
  })

  it('should display report metadata', () => {
    render(<ClubHealthDetailModal club={sampleClub} onClose={vi.fn()} />)

    // Check report information section
    expect(screen.getByText('Report Information')).toBeInTheDocument()
    expect(screen.getByText('Evaluation Date:')).toBeInTheDocument()
    expect(screen.getByText('Processing Time:')).toBeInTheDocument()
    expect(screen.getByText('42ms')).toBeInTheDocument()
    expect(screen.getByText('Rule Version:')).toBeInTheDocument()
    expect(screen.getByText('1.0.0')).toBeInTheDocument()
  })

  it('should handle close modal functionality', () => {
    const mockOnClose = vi.fn()

    render(<ClubHealthDetailModal club={sampleClub} onClose={mockOnClose} />)

    // Click close button (X button)
    const closeButton = screen.getByRole('button', { name: /close modal/i })
    fireEvent.click(closeButton)
    expect(mockOnClose).toHaveBeenCalledTimes(1)

    // Click Close button at bottom
    const bottomCloseButton = screen.getByText('Close')
    fireEvent.click(bottomCloseButton)
    expect(mockOnClose).toHaveBeenCalledTimes(2)
  })

  it('should handle export report functionality', () => {
    // Simple test to verify export button exists and is clickable
    render(<ClubHealthDetailModal club={sampleClub} onClose={vi.fn()} />)

    // Check export button exists
    const exportButton = screen.getByRole('button', { name: /export report/i })
    expect(exportButton).toBeInTheDocument()

    // Verify it's clickable (no errors thrown)
    expect(() => fireEvent.click(exportButton)).not.toThrow()
  })

  it('should apply correct styling for different health statuses', () => {
    render(
      <ClubHealthDetailModal club={sampleThrivingClub} onClose={vi.fn()} />
    )

    // Check thriving club styling
    const thrivingBadge = screen.getByText('Thriving')
    expect(thrivingBadge).toBeInTheDocument()
    expect(thrivingBadge).toHaveClass('bg-tm-loyal-blue', 'text-tm-white')
  })

  it('should apply correct styling for different trajectories', () => {
    render(<ClubHealthDetailModal club={sampleClub} onClose={vi.fn()} />)

    const decliningBadge = screen.getByText('Declining')
    expect(decliningBadge).toBeInTheDocument()
    expect(decliningBadge).toHaveClass('bg-red-100', 'text-red-800')
  })

  it('should show positive and negative changes with appropriate styling', () => {
    render(
      <ClubHealthDetailModal club={sampleThrivingClub} onClose={vi.fn()} />
    )

    // Positive changes should be green
    const positiveMembers = screen.getByText('+2 members')
    expect(positiveMembers).toHaveClass('text-green-600')

    const positiveDcp = screen.getByText('+1 goals')
    expect(positiveDcp).toHaveClass('text-green-600')
  })

  it('should meet accessibility requirements', () => {
    render(<ClubHealthDetailModal club={sampleClub} onClose={vi.fn()} />)

    // Check for proper ARIA labels
    expect(
      screen.getByRole('button', { name: /close modal/i })
    ).toBeInTheDocument()

    // Check minimum touch targets (44px)
    const closeButton = screen.getByRole('button', { name: /close modal/i })
    expect(closeButton).toHaveClass('min-h-[44px]', 'min-w-[44px]')

    const exportButton = screen.getByRole('button', { name: /export report/i })
    expect(exportButton).toHaveClass('min-h-[44px]')
  })

  it('should prevent event propagation when clicking modal content', () => {
    const mockOnClose = vi.fn()

    render(<ClubHealthDetailModal club={sampleClub} onClose={mockOnClose} />)

    // Click on modal content should not close modal
    const modalContent = screen.getByText('Test Club Alpha')
    fireEvent.click(modalContent)
    expect(mockOnClose).not.toHaveBeenCalled()
  })
})
