/**
 * Health Matrix Dashboard Component Tests
 *
 * Tests for the club health matrix visualization component
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import HealthMatrixDashboard from '../HealthMatrixDashboard'
import { ClubHealthResult } from '../../types/clubHealth'

// Sample test data
const sampleClubs: ClubHealthResult[] = [
  {
    club_name: 'Test Club 1',
    health_status: 'Thriving',
    reasons: ['Membership requirement met', 'DCP goals on track'],
    trajectory: 'Stable',
    trajectory_reasons: ['Health status unchanged'],
    composite_key: 'Thriving__Stable',
    composite_label: 'Thriving • Stable',
    members_delta_mom: 2,
    dcp_delta_mom: 1,
    metadata: {
      evaluation_date: '2024-01-01',
      processing_time_ms: 45,
      rule_version: '1.0.0',
    },
  },
  {
    club_name: 'Test Club 2',
    health_status: 'Vulnerable',
    reasons: ['Membership below threshold'],
    trajectory: 'Declining',
    trajectory_reasons: ['Lost members this month'],
    composite_key: 'Vulnerable__Declining',
    composite_label: 'Vulnerable • Declining',
    members_delta_mom: -3,
    dcp_delta_mom: 0,
    metadata: {
      evaluation_date: '2024-01-01',
      processing_time_ms: 38,
      rule_version: '1.0.0',
    },
  },
]

describe('HealthMatrixDashboard', () => {
  it('should render the health matrix with club data', () => {
    render(<HealthMatrixDashboard clubs={sampleClubs} districtId="42" />)

    // Check for main title
    expect(screen.getByText('Club Health Matrix')).toBeInTheDocument()
    expect(screen.getByText('- District 42')).toBeInTheDocument()

    // Check for club count
    expect(screen.getByText(/2 clubs displayed/)).toBeInTheDocument()

    // Check for trajectory headers (multiple instances expected)
    expect(screen.getAllByText('Declining')).toHaveLength(2) // Matrix header + legend
    expect(screen.getAllByText('Stable')).toHaveLength(2) // Matrix header + legend
    expect(screen.getAllByText('Recovering')).toHaveLength(2) // Matrix header + legend

    // Check for health status headers (multiple instances expected)
    expect(screen.getAllByText('Thriving')).toHaveLength(2) // Matrix header + legend
    expect(screen.getAllByText('Vulnerable')).toHaveLength(2) // Matrix header + legend
    expect(screen.getAllByText('Intervention Required')).toHaveLength(2) // Matrix header + legend
  })

  it('should display club counts in matrix cells', () => {
    render(<HealthMatrixDashboard clubs={sampleClubs} districtId="42" />)

    // Should show count of 1 for Thriving/Stable cell
    const thrivingStableCell = screen.getByRole('button', {
      name: /Thriving and Stable: 1 clubs/,
    })
    expect(thrivingStableCell).toBeInTheDocument()

    // Should show count of 1 for Vulnerable/Declining cell
    const vulnerableDecliningCell = screen.getByRole('button', {
      name: /Vulnerable and Declining: 1 clubs/,
    })
    expect(vulnerableDecliningCell).toBeInTheDocument()
  })

  it('should handle club selection', () => {
    const mockOnClubSelect = vi.fn()

    render(
      <HealthMatrixDashboard
        clubs={sampleClubs}
        onClubSelect={mockOnClubSelect}
      />
    )

    // Click on a matrix cell to expand it
    const thrivingStableCell = screen.getByRole('button', {
      name: /Thriving and Stable: 1 clubs/,
    })
    fireEvent.click(thrivingStableCell)

    // Should show expanded club details
    expect(screen.getByText('Thriving • Stable Clubs')).toBeInTheDocument()
    expect(screen.getByText('Test Club 1')).toBeInTheDocument()

    // Click on the club to select it
    const clubButton = screen.getByRole('button', {
      name: /View details for Test Club 1/,
    })
    fireEvent.click(clubButton)

    expect(mockOnClubSelect).toHaveBeenCalledWith(sampleClubs[0])
  })

  it('should display loading state', () => {
    render(<HealthMatrixDashboard clubs={[]} loading={true} />)

    expect(
      screen.getByRole('status', { name: /Loading health matrix/ })
    ).toBeInTheDocument()
    expect(
      screen.getByText('Loading club health matrix...')
    ).toBeInTheDocument()
  })

  it('should display error state', () => {
    const errorMessage = 'Failed to load club data'

    render(<HealthMatrixDashboard clubs={[]} error={errorMessage} />)

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Error Loading Health Matrix')).toBeInTheDocument()
    expect(screen.getByText(errorMessage)).toBeInTheDocument()
  })

  it('should apply filters correctly', () => {
    const filters = {
      healthStatus: ['Thriving'] as const,
      trajectory: ['Stable'] as const,
    }

    render(
      <HealthMatrixDashboard
        clubs={sampleClubs}
        filters={{
          healthStatus: [...filters.healthStatus],
          trajectory: [...filters.trajectory],
        }}
      />
    )

    // Should only show 1 club (the Thriving/Stable one)
    expect(screen.getByText(/1 clubs displayed/)).toBeInTheDocument()

    // The Vulnerable/Declining cell should show 0 clubs
    const vulnerableDecliningCell = screen.getByRole('button', {
      name: /Vulnerable and Declining: 0 clubs/,
    })
    expect(vulnerableDecliningCell).toBeInTheDocument()
  })

  it('should show legends for health status and trajectory', () => {
    render(<HealthMatrixDashboard clubs={sampleClubs} />)

    // Check for legend headers
    expect(screen.getByText('Health Status (Vertical)')).toBeInTheDocument()
    expect(screen.getByText('Trajectory (Horizontal)')).toBeInTheDocument()

    // Check for legend items (already accounted for in previous test)
    expect(screen.getAllByText('Thriving')).toHaveLength(2) // One in matrix, one in legend
    expect(screen.getAllByText('Stable')).toHaveLength(2) // One in matrix, one in legend
  })

  it('should support keyboard navigation', () => {
    render(<HealthMatrixDashboard clubs={sampleClubs} />)

    const matrixCell = screen.getByRole('button', {
      name: /Thriving and Stable: 1 clubs/,
    })

    // Should be focusable
    matrixCell.focus()
    expect(matrixCell).toHaveFocus()

    // Should respond to Enter key
    fireEvent.keyDown(matrixCell, { key: 'Enter' })
    expect(screen.getByText('Thriving • Stable Clubs')).toBeInTheDocument()

    // Should respond to Space key
    fireEvent.keyDown(matrixCell, { key: ' ' })
    expect(
      screen.queryByText('Thriving • Stable Clubs')
    ).not.toBeInTheDocument()
  })
})
