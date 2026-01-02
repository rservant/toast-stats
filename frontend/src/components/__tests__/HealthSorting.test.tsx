import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ClubsTable } from '../ClubsTable'
import { EnhancedClubTrend } from '../filters/types'

/**
 * Test data for health status and trajectory sorting
 */
const createTestClub = (
  id: string,
  name: string,
  healthStatus?: 'Thriving' | 'Vulnerable' | 'Intervention Required',
  trajectory?: 'Recovering' | 'Stable' | 'Declining'
): EnhancedClubTrend => ({
  clubId: id,
  clubName: name,
  divisionId: 'D1',
  divisionName: 'Test Division',
  areaId: 'A1',
  areaName: 'Test Area',
  membershipTrend: [{ date: '2024-01-01', count: 20 }],
  dcpGoalsTrend: [{ date: '2024-01-01', goalsAchieved: 5 }],
  currentStatus: 'healthy' as const,
  distinguishedLevel: 'President',
  riskFactors: [],
  latestMembership: 20,
  latestDcpGoals: 5,
  distinguishedOrder: 2,
  healthStatus,
  trajectory,
  healthStatusOrder: healthStatus
    ? ({ 'Intervention Required': 0, Vulnerable: 1, Thriving: 2 }[
        healthStatus
      ] ?? 3)
    : 3,
  trajectoryOrder: trajectory
    ? ({ Declining: 0, Stable: 1, Recovering: 2 }[trajectory] ?? 3)
    : 3,
})

const testClubs: EnhancedClubTrend[] = [
  createTestClub('1', 'Alpha Club', 'Thriving', 'Recovering'),
  createTestClub('2', 'Beta Club', 'Vulnerable', 'Stable'),
  createTestClub('3', 'Gamma Club', 'Intervention Required', 'Declining'),
  createTestClub('4', 'Delta Club', undefined, undefined), // Unknown status
]

describe('Health Status and Trajectory Sorting', () => {
  it('should sort health status in correct order (Intervention Required, Vulnerable, Thriving, Unknown)', () => {
    render(
      <ClubsTable
        clubs={testClubs}
        districtId="test-district"
        isLoading={false}
      />
    )

    // Find and click the Health Status column header to open dropdown
    const healthStatusHeader = screen.getByText('Health Status')
    fireEvent.click(healthStatusHeader)

    // Find and click the "Sort A-Z" button in the dropdown
    const sortAscButton = screen.getByText('Sort A-Z')
    fireEvent.click(sortAscButton)

    // Get all rows in the table body, excluding group headers
    const tableRows = screen.getAllByRole('row').slice(1) // Skip header row

    // Filter out group header rows and extract club names from actual club rows
    const clubNames = tableRows
      .filter(row => {
        // Group headers have a single cell that spans all columns
        const cells = row.querySelectorAll('td')
        return cells.length > 1 // Club rows have multiple cells, group headers have one spanning cell
      })
      .map(row => {
        const cells = row.querySelectorAll('td')
        return cells[0]?.textContent?.trim() || ''
      })

    // Expected order: Intervention Required (Gamma), Vulnerable (Beta), Thriving (Alpha), Unknown (Delta)
    expect(clubNames[0]).toBe('Gamma Club') // Intervention Required
    expect(clubNames[1]).toBe('Beta Club') // Vulnerable
    expect(clubNames[2]).toBe('Alpha Club') // Thriving
    expect(clubNames[3]).toBe('Delta Club') // Unknown
  })

  it('should sort trajectory in correct order (Declining, Stable, Recovering, Unknown)', () => {
    render(
      <ClubsTable
        clubs={testClubs}
        districtId="test-district"
        isLoading={false}
      />
    )

    // Find and click the Trajectory column header to open dropdown
    const trajectoryHeader = screen.getByText('Trajectory')
    fireEvent.click(trajectoryHeader)

    // Find and click the "Sort A-Z" button in the dropdown
    const sortAscButton = screen.getByText('Sort A-Z')
    fireEvent.click(sortAscButton)

    // Get all rows in the table body, excluding group headers
    const tableRows = screen.getAllByRole('row').slice(1) // Skip header row

    // Filter out group header rows and extract club names from actual club rows
    const clubNames = tableRows
      .filter(row => {
        // Group headers have a single cell that spans all columns
        const cells = row.querySelectorAll('td')
        return cells.length > 1 // Club rows have multiple cells, group headers have one spanning cell
      })
      .map(row => {
        const cells = row.querySelectorAll('td')
        return cells[0]?.textContent?.trim() || ''
      })

    // Expected order: Declining (Gamma), Stable (Beta), Recovering (Alpha), Unknown (Delta)
    expect(clubNames[0]).toBe('Gamma Club') // Declining
    expect(clubNames[1]).toBe('Beta Club') // Stable
    expect(clubNames[2]).toBe('Alpha Club') // Recovering
    expect(clubNames[3]).toBe('Delta Club') // Unknown
  })

  it('should handle clubs with unknown health status and trajectory', () => {
    const clubsWithUnknown: EnhancedClubTrend[] = [
      createTestClub('1', 'Club A', undefined, undefined),
      createTestClub('2', 'Club B', 'Thriving', 'Recovering'),
      createTestClub('3', 'Club C', undefined, undefined),
    ]

    render(
      <ClubsTable
        clubs={clubsWithUnknown}
        districtId="test-district"
        isLoading={false}
      />
    )

    // Sort by health status
    const healthStatusHeader = screen.getByText('Health Status')
    fireEvent.click(healthStatusHeader)
    const sortAscButton = screen.getByText('Sort A-Z')
    fireEvent.click(sortAscButton)

    // Get all rows in the table body, excluding group headers
    const tableRows = screen.getAllByRole('row').slice(1) // Skip header row

    // Filter out group header rows and extract club names from actual club rows
    const clubNames = tableRows
      .filter(row => {
        // Group headers have a single cell that spans all columns
        const cells = row.querySelectorAll('td')
        return cells.length > 1 // Club rows have multiple cells, group headers have one spanning cell
      })
      .map(row => {
        const cells = row.querySelectorAll('td')
        return cells[0]?.textContent?.trim() || ''
      })

    // Thriving should come first, then Unknown clubs
    expect(clubNames[0]).toBe('Club B') // Thriving
    expect(clubNames[1]).toBe('Club A') // Unknown
    expect(clubNames[2]).toBe('Club C') // Unknown
  })
})
