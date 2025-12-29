import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { AtRiskClubsPanel } from '../AtRiskClubsPanel'
import { ClubTrend } from '../../hooks/useDistrictAnalytics'

const mockAtRiskClub: ClubTrend = {
  clubId: 'club-2',
  clubName: 'Test At-Risk Club',
  divisionId: 'div-1',
  divisionName: 'Division A',
  areaId: 'area-1',
  areaName: 'Area 1',
  membershipTrend: [{ date: '2024-01-01', count: 15 }],
  dcpGoalsTrend: [{ date: '2024-01-01', goalsAchieved: 1 }],
  currentStatus: 'at-risk',
  riskFactors: ['Low DCP goals achieved'],
}

describe('AtRiskClubsPanel', () => {
  it('renders at-risk clubs panel with title', () => {
    render(<AtRiskClubsPanel clubs={[mockAtRiskClub]} isLoading={false} />)

    expect(screen.getByText('At-Risk Clubs')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Clubs with declining membership or low DCP goal achievement'
      )
    ).toBeInTheDocument()
  })

  it('displays at-risk clubs only (not critical)', () => {
    // Now the component expects to receive only at-risk clubs, not mixed
    render(
      <AtRiskClubsPanel
        clubs={[mockAtRiskClub]} // Only pass at-risk clubs
        isLoading={false}
      />
    )

    // Should show the at-risk club
    expect(screen.getByText('Test At-Risk Club')).toBeInTheDocument()

    // Should NOT show the critical club (it's not passed to the component)
    expect(screen.queryByText('Test Critical Club')).not.toBeInTheDocument()

    // Should show correct count
    expect(screen.getByText('1 At-Risk')).toBeInTheDocument()
  })

  it('shows empty state when no at-risk clubs', () => {
    // Pass empty array since critical clubs are now handled separately
    render(<AtRiskClubsPanel clubs={[]} isLoading={false} />)

    expect(screen.getByText('No at-risk clubs!')).toBeInTheDocument()
    expect(
      screen.getByText(
        'All clubs are performing well with stable membership and DCP progress.'
      )
    ).toBeInTheDocument()
  })

  it('shows loading state', () => {
    render(<AtRiskClubsPanel clubs={[]} isLoading={true} />)

    expect(screen.getByText('At-Risk Clubs')).toBeInTheDocument()
  })

  it('displays risk factors for at-risk clubs', () => {
    render(<AtRiskClubsPanel clubs={[mockAtRiskClub]} isLoading={false} />)

    expect(screen.getByText('Low DCP goals achieved')).toBeInTheDocument()
  })

  it('shows AT-RISK badge for at-risk clubs', () => {
    render(<AtRiskClubsPanel clubs={[mockAtRiskClub]} isLoading={false} />)

    expect(screen.getByText('AT-RISK')).toBeInTheDocument()
  })
})
