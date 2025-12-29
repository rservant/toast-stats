import { render, screen } from '@testing-library/react'
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
  it('renders critical clubs panel with title', () => {
    render(<CriticalClubsPanel clubs={[mockCriticalClub]} isLoading={false} />)

    expect(screen.getByText('Critical Clubs')).toBeInTheDocument()
    expect(
      screen.getByText('Clubs with membership below 12 members (charter risk)')
    ).toBeInTheDocument()
  })

  it('displays critical clubs only', () => {
    // Now the component expects to receive only critical clubs, not mixed
    render(
      <CriticalClubsPanel
        clubs={[mockCriticalClub]} // Only pass critical clubs
        isLoading={false}
      />
    )

    // Should show the critical club
    expect(screen.getByText('Test Critical Club')).toBeInTheDocument()

    // Should NOT show the at-risk club (it's not passed to the component)
    expect(screen.queryByText('Test At-Risk Club')).not.toBeInTheDocument()

    // Should show correct count
    expect(screen.getByText('1 Critical')).toBeInTheDocument()
  })

  it('shows empty state when no critical clubs', () => {
    // Pass empty array since at-risk clubs are now handled separately
    render(<CriticalClubsPanel clubs={[]} isLoading={false} />)

    expect(screen.getByText('No critical clubs!')).toBeInTheDocument()
    expect(
      screen.getByText(
        'All clubs have sufficient membership to maintain their charter.'
      )
    ).toBeInTheDocument()
  })

  it('shows loading state', () => {
    render(<CriticalClubsPanel clubs={[]} isLoading={true} />)

    // Should show loading skeletons (assuming LoadingSkeleton has testid or specific content)
    expect(screen.getByText('Critical Clubs')).toBeInTheDocument()
  })

  it('displays risk factors for critical clubs', () => {
    render(<CriticalClubsPanel clubs={[mockCriticalClub]} isLoading={false} />)

    expect(screen.getByText('Low membership (8 members)')).toBeInTheDocument()
    expect(screen.getByText('Below charter minimum')).toBeInTheDocument()
  })

  it('shows CRITICAL badge for critical clubs', () => {
    render(<CriticalClubsPanel clubs={[mockCriticalClub]} isLoading={false} />)

    expect(screen.getByText('CRITICAL')).toBeInTheDocument()
  })
})
