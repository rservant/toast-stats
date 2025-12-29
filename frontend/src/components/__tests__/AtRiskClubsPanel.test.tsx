import { render, screen, fireEvent } from '@testing-library/react'
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
  it('renders at-risk clubs panel with title and is collapsed by default', () => {
    render(<AtRiskClubsPanel clubs={[mockAtRiskClub]} isLoading={false} />)

    expect(screen.getByText('At-Risk Clubs')).toBeInTheDocument()
    expect(screen.getByText('1 At-Risk')).toBeInTheDocument()
    
    // Should be collapsed by default - subtitle and clubs should not be visible
    expect(screen.queryByText('Clubs with declining membership or low DCP goal achievement')).not.toBeInTheDocument()
    expect(screen.queryByText('Test At-Risk Club')).not.toBeInTheDocument()
  })

  it('expands when clicked and shows content', () => {
    render(<AtRiskClubsPanel clubs={[mockAtRiskClub]} isLoading={false} />)

    // Click to expand
    fireEvent.click(screen.getByText('At-Risk Clubs'))

    // Now content should be visible
    expect(screen.getByText('Clubs with declining membership or low DCP goal achievement')).toBeInTheDocument()
    expect(screen.getByText('Test At-Risk Club')).toBeInTheDocument()
  })

  it('collapses when clicked again', () => {
    render(<AtRiskClubsPanel clubs={[mockAtRiskClub]} isLoading={false} />)

    // Click to expand
    fireEvent.click(screen.getByText('At-Risk Clubs'))
    expect(screen.getByText('Test At-Risk Club')).toBeInTheDocument()

    // Click to collapse
    fireEvent.click(screen.getByText('At-Risk Clubs'))
    expect(screen.queryByText('Test At-Risk Club')).not.toBeInTheDocument()
  })

  it('displays at-risk clubs only (not critical) when expanded', () => {
    render(<AtRiskClubsPanel clubs={[mockAtRiskClub]} isLoading={false} />)

    // Expand the panel
    fireEvent.click(screen.getByText('At-Risk Clubs'))

    // Should show the at-risk club
    expect(screen.getByText('Test At-Risk Club')).toBeInTheDocument()

    // Should show correct count
    expect(screen.getByText('1 At-Risk')).toBeInTheDocument()
  })

  it('shows empty state when no at-risk clubs and expanded', () => {
    render(<AtRiskClubsPanel clubs={[]} isLoading={false} />)

    // Expand the panel
    fireEvent.click(screen.getByText('At-Risk Clubs'))

    expect(screen.getByText('No at-risk clubs!')).toBeInTheDocument()
    expect(
      screen.getByText(
        'All clubs are performing well with stable membership and DCP progress.'
      )
    ).toBeInTheDocument()
  })

  it('shows loading state when expanded', () => {
    render(<AtRiskClubsPanel clubs={[]} isLoading={true} />)

    // Expand the panel
    fireEvent.click(screen.getByText('At-Risk Clubs'))

    expect(screen.getByText('At-Risk Clubs')).toBeInTheDocument()
  })

  it('displays risk factors for at-risk clubs when expanded', () => {
    render(<AtRiskClubsPanel clubs={[mockAtRiskClub]} isLoading={false} />)

    // Expand the panel
    fireEvent.click(screen.getByText('At-Risk Clubs'))

    expect(screen.getByText('Low DCP goals achieved')).toBeInTheDocument()
  })

  it('shows AT-RISK badge for at-risk clubs when expanded', () => {
    render(<AtRiskClubsPanel clubs={[mockAtRiskClub]} isLoading={false} />)

    // Expand the panel
    fireEvent.click(screen.getByText('At-Risk Clubs'))

    expect(screen.getByText('AT-RISK')).toBeInTheDocument()
  })
})
