import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { VulnerableClubsPanel } from '../VulnerableClubsPanel'
import { ClubTrend } from '../../hooks/useDistrictAnalytics'

const mockVulnerableClub: ClubTrend = {
  clubId: 'club-2',
  clubName: 'Test Vulnerable Club',
  divisionId: 'div-1',
  divisionName: 'Division A',
  areaId: 'area-1',
  areaName: 'Area 1',
  membershipTrend: [{ date: '2024-01-01', count: 15 }],
  dcpGoalsTrend: [{ date: '2024-01-01', goalsAchieved: 1 }],
  currentStatus: 'vulnerable',
  riskFactors: ['DCP checkpoint not met'],
  distinguishedLevel: 'NotDistinguished',
}

describe('VulnerableClubsPanel', () => {
  it('renders vulnerable clubs panel with title and is collapsed by default', () => {
    render(
      <VulnerableClubsPanel clubs={[mockVulnerableClub]} isLoading={false} />
    )

    expect(screen.getByText('Vulnerable Clubs')).toBeInTheDocument()
    expect(screen.getByText('1 Vulnerable')).toBeInTheDocument()

    // Should be collapsed by default - subtitle and clubs should not be visible
    expect(
      screen.queryByText(
        'Clubs with some requirements not met (membership, DCP checkpoint, or CSP)'
      )
    ).not.toBeInTheDocument()
    expect(screen.queryByText('Test Vulnerable Club')).not.toBeInTheDocument()
  })

  it('expands when clicked and shows content', () => {
    render(
      <VulnerableClubsPanel clubs={[mockVulnerableClub]} isLoading={false} />
    )

    // Click to expand
    fireEvent.click(screen.getByText('Vulnerable Clubs'))

    // Now content should be visible
    expect(
      screen.getByText(
        'Clubs with some requirements not met (membership, DCP checkpoint, or CSP)'
      )
    ).toBeInTheDocument()
    expect(screen.getByText('Test Vulnerable Club')).toBeInTheDocument()
  })

  it('collapses when clicked again', () => {
    render(
      <VulnerableClubsPanel clubs={[mockVulnerableClub]} isLoading={false} />
    )

    // Click to expand
    fireEvent.click(screen.getByText('Vulnerable Clubs'))
    expect(screen.getByText('Test Vulnerable Club')).toBeInTheDocument()

    // Click to collapse
    fireEvent.click(screen.getByText('Vulnerable Clubs'))
    expect(screen.queryByText('Test Vulnerable Club')).not.toBeInTheDocument()
  })

  it('displays vulnerable clubs only (not intervention-required) when expanded', () => {
    render(
      <VulnerableClubsPanel clubs={[mockVulnerableClub]} isLoading={false} />
    )

    // Expand the panel
    fireEvent.click(screen.getByText('Vulnerable Clubs'))

    // Should show the vulnerable club
    expect(screen.getByText('Test Vulnerable Club')).toBeInTheDocument()

    // Should show correct count
    expect(screen.getByText('1 Vulnerable')).toBeInTheDocument()
  })

  it('shows empty state when no vulnerable clubs and expanded', () => {
    render(<VulnerableClubsPanel clubs={[]} isLoading={false} />)

    // Expand the panel
    fireEvent.click(screen.getByText('Vulnerable Clubs'))

    expect(screen.getByText('No vulnerable clubs!')).toBeInTheDocument()
    expect(
      screen.getByText(
        'All clubs are meeting their requirements and performing well.'
      )
    ).toBeInTheDocument()
  })

  it('shows loading state when expanded', () => {
    render(<VulnerableClubsPanel clubs={[]} isLoading={true} />)

    // Expand the panel
    fireEvent.click(screen.getByText('Vulnerable Clubs'))

    expect(screen.getByText('Vulnerable Clubs')).toBeInTheDocument()
  })

  it('displays risk factors for vulnerable clubs when expanded', () => {
    render(
      <VulnerableClubsPanel clubs={[mockVulnerableClub]} isLoading={false} />
    )

    // Expand the panel
    fireEvent.click(screen.getByText('Vulnerable Clubs'))

    expect(screen.getByText('DCP checkpoint not met')).toBeInTheDocument()
  })

  it('shows VULNERABLE badge for vulnerable clubs when expanded', () => {
    render(
      <VulnerableClubsPanel clubs={[mockVulnerableClub]} isLoading={false} />
    )

    // Expand the panel
    fireEvent.click(screen.getByText('Vulnerable Clubs'))

    expect(screen.getByText('VULNERABLE')).toBeInTheDocument()
  })
})
