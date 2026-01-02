import { render, screen } from '@testing-library/react'
import { ClubHealthSummary } from '../ClubHealthSummary'
import { EnhancedClubTrend } from '../filters/types'

// Mock data for testing
const createMockClub = (
  id: string,
  name: string,
  healthStatus?: 'Thriving' | 'Vulnerable' | 'Intervention Required',
  trajectory?: 'Recovering' | 'Stable' | 'Declining',
  healthDataAge?: number
): EnhancedClubTrend => ({
  clubId: id,
  clubName: name,
  divisionName: 'Division A',
  divisionId: 'A',
  areaName: 'Area 1',
  areaId: '1',
  membershipTrend: [],
  dcpGoalsTrend: [],
  currentStatus: 'healthy',
  distinguishedLevel: undefined,
  riskFactors: [],
  latestMembership: 20,
  latestDcpGoals: 5,
  distinguishedOrder: 999,
  healthStatus,
  trajectory,
  healthDataAge,
  healthStatusOrder:
    healthStatus === 'Intervention Required'
      ? 0
      : healthStatus === 'Vulnerable'
        ? 1
        : healthStatus === 'Thriving'
          ? 2
          : 3,
  trajectoryOrder:
    trajectory === 'Declining'
      ? 0
      : trajectory === 'Stable'
        ? 1
        : trajectory === 'Recovering'
          ? 2
          : 3,
})

describe('ClubHealthSummary', () => {
  describe('Health Status Counts', () => {
    it('should display correct counts for each health status', () => {
      const clubs = [
        createMockClub('1', 'Club A', 'Thriving'),
        createMockClub('2', 'Club B', 'Vulnerable'),
        createMockClub('3', 'Club C', 'Intervention Required'),
        createMockClub('4', 'Club D', 'Thriving'),
        createMockClub('5', 'Club E'), // Unknown
      ]

      render(<ClubHealthSummary clubs={clubs} />)

      // Use ARIA labels for specific counts to avoid ambiguity
      expect(
        screen.getByLabelText('1 clubs need immediate attention')
      ).toBeInTheDocument()
      expect(screen.getByLabelText('1 vulnerable clubs')).toBeInTheDocument()
      expect(screen.getByLabelText('2 thriving clubs')).toBeInTheDocument()
      expect(
        screen.getByLabelText('4 clubs with health data out of 5 total')
      ).toBeInTheDocument()
      expect(screen.getByText('of 5 total')).toBeInTheDocument()
    })

    it('should show fresh data indicator when clubs have recent data', () => {
      const clubs = [
        createMockClub('1', 'Club A', 'Thriving', 'Stable', 12), // Fresh data
        createMockClub('2', 'Club B', 'Vulnerable', 'Declining', 48), // Not fresh
      ]

      render(<ClubHealthSummary clubs={clubs} />)

      expect(screen.getByText('1 clubs with fresh data')).toBeInTheDocument()
    })

    it('should calculate immediate attention count correctly', () => {
      const clubs = [
        createMockClub('1', 'Club A', 'Intervention Required', 'Stable'),
        createMockClub('2', 'Club B', 'Thriving', 'Declining'),
        createMockClub('3', 'Club C', 'Vulnerable', 'Recovering'),
      ]

      render(<ClubHealthSummary clubs={clubs} />)

      // Should count clubs with either Intervention Required OR Declining
      expect(
        screen.getByLabelText('2 clubs need immediate attention')
      ).toBeInTheDocument()
      expect(screen.getByText('Action Required')).toBeInTheDocument()
    })
  })

  describe('Visual Indicators', () => {
    it('should show appropriate styling for different counts', () => {
      const clubs = [
        createMockClub('1', 'Club A', 'Intervention Required'),
        createMockClub('2', 'Club B', 'Vulnerable'),
        createMockClub('3', 'Club C', 'Thriving'),
      ]

      render(<ClubHealthSummary clubs={clubs} />)

      // Check that the summary is rendered
      expect(screen.getByText('Club Health Summary')).toBeInTheDocument()
      // Use text content matcher for text split by line breaks
      expect(
        screen.getByText((_, element) => {
          return element?.textContent === 'Need ImmediateAttention'
        })
      ).toBeInTheDocument()
      expect(
        screen.getByText((_, element) => {
          return element?.textContent === 'VulnerableClubs'
        })
      ).toBeInTheDocument()
      expect(
        screen.getByText((_, element) => {
          return element?.textContent === 'ThrivingClubs'
        })
      ).toBeInTheDocument()
    })

    it('should show health status distribution when clubs have health data', () => {
      const clubs = [
        createMockClub('1', 'Club A', 'Intervention Required'),
        createMockClub('2', 'Club B', 'Vulnerable'),
        createMockClub('3', 'Club C', 'Thriving'),
      ]

      render(<ClubHealthSummary clubs={clubs} />)

      expect(screen.getByText('Health Status Distribution')).toBeInTheDocument()
      expect(screen.getByText('1 Critical')).toBeInTheDocument()
      expect(screen.getByText('1 Vulnerable')).toBeInTheDocument()
      expect(screen.getByText('1 Thriving')).toBeInTheDocument()
    })

    it('should show trajectory trends when clubs have trajectory data', () => {
      const clubs = [
        createMockClub('1', 'Club A', 'Thriving', 'Declining'),
        createMockClub('2', 'Club B', 'Vulnerable', 'Recovering'),
        createMockClub('3', 'Club C', 'Thriving', 'Stable'),
      ]

      render(<ClubHealthSummary clubs={clubs} />)

      expect(screen.getByText('Trajectory Trends')).toBeInTheDocument()
      expect(screen.getByText('1 Declining')).toBeInTheDocument()
      expect(screen.getByText('1 Recovering')).toBeInTheDocument()
      expect(screen.getByText('1 Stable')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty clubs array', () => {
      render(<ClubHealthSummary clubs={[]} />)

      expect(screen.getByText('Club Health Summary')).toBeInTheDocument()
      // Use specific ARIA labels to avoid ambiguity with multiple "0" elements
      expect(
        screen.getByLabelText('0 clubs need immediate attention')
      ).toBeInTheDocument()
      expect(screen.getByLabelText('0 vulnerable clubs')).toBeInTheDocument()
      expect(screen.getByLabelText('0 thriving clubs')).toBeInTheDocument()
      expect(
        screen.getByLabelText('0 clubs with health data out of 0 total')
      ).toBeInTheDocument()
      expect(screen.getByText('of 0 total')).toBeInTheDocument()
    })

    it('should handle clubs with no health data', () => {
      const clubs = [
        createMockClub('1', 'Club A'), // No health data
        createMockClub('2', 'Club B'), // No health data
      ]

      render(<ClubHealthSummary clubs={clubs} />)

      expect(
        screen.getByLabelText('0 clubs with health data out of 2 total')
      ).toBeInTheDocument()
      expect(screen.getByText('of 2 total')).toBeInTheDocument()
    })

    it('should not show fresh data indicator when no clubs have fresh data', () => {
      const clubs = [
        createMockClub('1', 'Club A', 'Thriving', 'Stable', 48), // Not fresh
        createMockClub('2', 'Club B', 'Vulnerable', 'Declining', 72), // Not fresh
      ]

      render(<ClubHealthSummary clubs={clubs} />)

      expect(
        screen.queryByText(/clubs with fresh data/)
      ).not.toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels for counts', () => {
      const clubs = [
        createMockClub('1', 'Club A', 'Intervention Required'),
        createMockClub('2', 'Club B', 'Vulnerable'),
        createMockClub('3', 'Club C', 'Thriving'),
      ]

      render(<ClubHealthSummary clubs={clubs} />)

      expect(
        screen.getByLabelText('1 clubs need immediate attention')
      ).toBeInTheDocument()
      expect(screen.getByLabelText('1 vulnerable clubs')).toBeInTheDocument()
      expect(screen.getByLabelText('1 thriving clubs')).toBeInTheDocument()
      expect(
        screen.getByLabelText('3 clubs with health data out of 3 total')
      ).toBeInTheDocument()
    })
  })
})
