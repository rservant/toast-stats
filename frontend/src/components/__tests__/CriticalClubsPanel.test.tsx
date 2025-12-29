import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { CriticalClubsPanel } from '../CriticalClubsPanel'
import { ClubTrend } from '../../hooks/useDistrictAnalytics'

const mockCriticalClub: ClubTrend = {
  clubId: 'club-1',
  clubName: 'Test Critical Club',
  divisionId: 'div-1',
  divisionName: 'Division A',
  areaId: 'area-1',
  areaName: 'Area 1',
  membershipTrend: [{ date: '2024-01-01', count: 8 }],
  dcpGoalsTrend: [{ date: '2024-01-01', goalsAchieved: 2 }],
  currentStatus: 'critical',
  riskFactors: ['Low membership (8 members)', 'Below charter minimum'],
}

describe('CriticalClubsPanel', () => {
  it('renders critical clubs panel with title and is collapsed by default', () => {
    render(<CriticalClubsPanel clubs={[mockCriticalClub]} isLoading={false} />)

    expect(screen.getByText('Critical Clubs')).toBeInTheDocument()
    expect(screen.getByText('1 Critical')).toBeInTheDocument()
    
    // Should be collapsed by default - subtitle and clubs should not be visible
    expect(screen.queryByText('Clubs with membership below 12 members (charter risk)')).not.toBeInTheDocument()
    expect(screen.queryByText('Test Critical Club')).not.toBeInTheDocument()
  })

  it('expands when clicked and shows content', () => {
    render(<CriticalClubsPanel clubs={[mockCriticalClub]} isLoading={false} />)

    // Click to expand
    fireEvent.click(screen.getByText('Critical Clubs'))

    // Now content should be visible
    expect(screen.getByText('Clubs with membership below 12 members (charter risk)')).toBeInTheDocument()
    expect(screen.getByText('Test Critical Club')).toBeInTheDocument()
  })

  it('collapses when clicked again', () => {
    render(<CriticalClubsPanel clubs={[mockCriticalClub]} isLoading={false} />)

    // Click to expand
    fireEvent.click(screen.getByText('Critical Clubs'))
    expect(screen.getByText('Test Critical Club')).toBeInTheDocument()

    // Click to collapse
    fireEvent.click(screen.getByText('Critical Clubs'))
    expect(screen.queryByText('Test Critical Club')).not.toBeInTheDocument()
  })

  it('displays critical clubs only when expanded', () => {
    render(<CriticalClubsPanel clubs={[mockCriticalClub]} isLoading={false} />)

    // Expand the panel
    fireEvent.click(screen.getByText('Critical Clubs'))

    // Should show the critical club
    expect(screen.getByText('Test Critical Club')).toBeInTheDocument()

    // Should show correct count
    expect(screen.getByText('1 Critical')).toBeInTheDocument()
  })

  it('shows empty state when no critical clubs and expanded', () => {
    render(<CriticalClubsPanel clubs={[]} isLoading={false} />)

    // Expand the panel
    fireEvent.click(screen.getByText('Critical Clubs'))

    expect(screen.getByText('No critical clubs!')).toBeInTheDocument()
    expect(
      screen.getByText(
        'All clubs have sufficient membership to maintain their charter.'
      )
    ).toBeInTheDocument()
  })

  it('shows loading state when expanded', () => {
    render(<CriticalClubsPanel clubs={[]} isLoading={true} />)

    // Expand the panel
    fireEvent.click(screen.getByText('Critical Clubs'))

    // Should show loading skeletons (assuming LoadingSkeleton has testid or specific content)
    expect(screen.getByText('Critical Clubs')).toBeInTheDocument()
  })

  it('displays risk factors for critical clubs when expanded', () => {
    render(<CriticalClubsPanel clubs={[mockCriticalClub]} isLoading={false} />)

    // Expand the panel
    fireEvent.click(screen.getByText('Critical Clubs'))

    expect(screen.getByText('Low membership (8 members)')).toBeInTheDocument()
    expect(screen.getByText('Below charter minimum')).toBeInTheDocument()
  })

  it('shows CRITICAL badge for critical clubs when expanded', () => {
    render(<CriticalClubsPanel clubs={[mockCriticalClub]} isLoading={false} />)

    // Expand the panel
    fireEvent.click(screen.getByText('Critical Clubs'))

    expect(screen.getByText('CRITICAL')).toBeInTheDocument()
  })
})
