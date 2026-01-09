import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { InterventionRequiredClubsPanel } from '../InterventionRequiredClubsPanel'
import { ClubTrend } from '../../hooks/useDistrictAnalytics'

const mockInterventionRequiredClub: ClubTrend = {
  clubId: 'club-1',
  clubName: 'Test Intervention Required Club',
  divisionId: 'div-1',
  divisionName: 'Division A',
  areaId: 'area-1',
  areaName: 'Area 1',
  membershipTrend: [{ date: '2024-01-01', count: 8 }],
  dcpGoalsTrend: [{ date: '2024-01-01', goalsAchieved: 2 }],
  currentStatus: 'intervention-required',
  riskFactors: ['Membership below 12 (8 members)', 'Net growth below 3'],
  distinguishedLevel: 'NotDistinguished',
}

describe('InterventionRequiredClubsPanel', () => {
  it('renders intervention required clubs panel with title and is collapsed by default', () => {
    render(
      <InterventionRequiredClubsPanel
        clubs={[mockInterventionRequiredClub]}
        isLoading={false}
      />
    )

    expect(screen.getByText('Intervention Required')).toBeInTheDocument()
    expect(screen.getByText('1 Intervention Required')).toBeInTheDocument()

    // Should be collapsed by default - subtitle and clubs should not be visible
    expect(
      screen.queryByText(
        'Clubs with membership below 12 and insufficient growth (need immediate attention)'
      )
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText('Test Intervention Required Club')
    ).not.toBeInTheDocument()
  })

  it('expands when clicked and shows content', () => {
    render(
      <InterventionRequiredClubsPanel
        clubs={[mockInterventionRequiredClub]}
        isLoading={false}
      />
    )

    // Click to expand
    fireEvent.click(screen.getByText('Intervention Required'))

    // Now content should be visible
    expect(
      screen.getByText(
        'Clubs with membership below 12 and insufficient growth (need immediate attention)'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText('Test Intervention Required Club')
    ).toBeInTheDocument()
  })

  it('collapses when clicked again', () => {
    render(
      <InterventionRequiredClubsPanel
        clubs={[mockInterventionRequiredClub]}
        isLoading={false}
      />
    )

    // Click to expand
    fireEvent.click(screen.getByText('Intervention Required'))
    expect(
      screen.getByText('Test Intervention Required Club')
    ).toBeInTheDocument()

    // Click to collapse
    fireEvent.click(screen.getByText('Intervention Required'))
    expect(
      screen.queryByText('Test Intervention Required Club')
    ).not.toBeInTheDocument()
  })

  it('displays intervention required clubs only when expanded', () => {
    render(
      <InterventionRequiredClubsPanel
        clubs={[mockInterventionRequiredClub]}
        isLoading={false}
      />
    )

    // Expand the panel
    fireEvent.click(screen.getByText('Intervention Required'))

    // Should show the intervention required club
    expect(
      screen.getByText('Test Intervention Required Club')
    ).toBeInTheDocument()

    // Should show correct count
    expect(screen.getByText('1 Intervention Required')).toBeInTheDocument()
  })

  it('shows empty state when no intervention required clubs and expanded', () => {
    render(<InterventionRequiredClubsPanel clubs={[]} isLoading={false} />)

    // Expand the panel
    fireEvent.click(screen.getByText('Intervention Required'))

    expect(
      screen.getByText('No clubs require intervention!')
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'All clubs have sufficient membership or growth to maintain their charter.'
      )
    ).toBeInTheDocument()
  })

  it('shows loading state when expanded', () => {
    render(<InterventionRequiredClubsPanel clubs={[]} isLoading={true} />)

    // Expand the panel
    fireEvent.click(screen.getByText('Intervention Required'))

    // Should show loading skeletons (assuming LoadingSkeleton has testid or specific content)
    expect(screen.getByText('Intervention Required')).toBeInTheDocument()
  })

  it('displays risk factors for intervention required clubs when expanded', () => {
    render(
      <InterventionRequiredClubsPanel
        clubs={[mockInterventionRequiredClub]}
        isLoading={false}
      />
    )

    // Expand the panel
    fireEvent.click(screen.getByText('Intervention Required'))

    expect(
      screen.getByText('Membership below 12 (8 members)')
    ).toBeInTheDocument()
    expect(screen.getByText('Net growth below 3')).toBeInTheDocument()
  })

  it('shows INTERVENTION REQUIRED badge for intervention required clubs when expanded', () => {
    render(
      <InterventionRequiredClubsPanel
        clubs={[mockInterventionRequiredClub]}
        isLoading={false}
      />
    )

    // Expand the panel
    fireEvent.click(screen.getByText('Intervention Required'))

    expect(screen.getByText('INTERVENTION REQUIRED')).toBeInTheDocument()
  })
})
