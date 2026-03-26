/**
 * Tests for ClubCard (#217)
 */
import { describe, it, expect, vi } from 'vitest'
import { screen, render, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import ClubCard from '../ClubCard'
import type { ProcessedClubTrend } from '../filters/types'
import type { ClubHealthStatus } from '../../hooks/useDistrictAnalytics'

const mockClub: ProcessedClubTrend = {
  clubId: '123',
  clubName: 'Test Speakers',
  divisionId: 'A',
  divisionName: 'Division A',
  areaId: '1',
  areaName: 'Area 1',
  membershipTrend: [{ date: '2026-03-01', count: 20 }],
  dcpGoalsTrend: [{ date: '2026-03-01', goalsAchieved: 7 }],
  membershipBase: 18,
  currentStatus: 'thriving' as ClubHealthStatus,
  riskFactors: [],
  distinguishedLevel: 'Distinguished',
  latestMembership: 20,
  latestDcpGoals: 7,
  distinguishedOrder: 0,
}

describe('ClubCard (#217)', () => {
  it('renders club name', () => {
    render(<ClubCard club={mockClub} />)
    expect(screen.getByText('Test Speakers')).toBeInTheDocument()
  })

  it('renders status badge', () => {
    render(<ClubCard club={mockClub} />)
    expect(screen.getByText('Thriving')).toBeInTheDocument()
  })

  it('renders membership count', () => {
    render(<ClubCard club={mockClub} />)
    expect(screen.getByText('20')).toBeInTheDocument()
    expect(screen.getByText('Members')).toBeInTheDocument()
  })

  it('renders net change', () => {
    render(<ClubCard club={mockClub} />)
    // 20 - 18 = +2
    expect(screen.getByText('+2')).toBeInTheDocument()
  })

  it('renders DCP goals', () => {
    render(<ClubCard club={mockClub} />)
    // latestDcpGoals = 7, but rendered with /10
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    const onClick = vi.fn()
    render(<ClubCard club={mockClub} onClick={onClick} />)
    fireEvent.click(screen.getByTestId('club-card'))
    expect(onClick).toHaveBeenCalledWith(mockClub)
  })

  it('has accessible aria-label', () => {
    render(<ClubCard club={mockClub} />)
    const card = screen.getByTestId('club-card')
    expect(card).toHaveAttribute(
      'aria-label',
      'Test Speakers — Thriving, 20 members'
    )
  })
})
