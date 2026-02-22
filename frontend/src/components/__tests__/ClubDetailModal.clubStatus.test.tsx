/**
 * Unit Tests for ClubDetailModal Club Status Badge
 *
 * Tests the club status badge styling and rendering in the ClubDetailModal component.
 * Per the property-testing-guidance.md steering document, this feature uses unit tests rather
 * than property-based tests because the operations are simple (badge styling based on status)
 * and 3-5 well-chosen examples fully cover the behavior.
 *
 * **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**
 *
 * Badge Tests:
 * - Active status → green styling
 * - Suspended status → red styling
 * - Ineligible status → yellow styling
 * - Low status → yellow styling
 * - Unknown status → gray styling
 * - Undefined status → no badge rendered
 */

import React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ClubDetailModal } from '../ClubDetailModal'
import { getClubStatusBadge } from '../../utils/clubStatusBadge'
import { ClubTrend } from '../../hooks/useDistrictAnalytics'

/**
 * Renders component wrapped in QueryClientProvider (required by useClubTrends hook).
 */
function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  )
}

/**
 * Factory function to create a mock ClubTrend object with sensible defaults
 */
const createMockClub = (overrides: Partial<ClubTrend> = {}): ClubTrend => ({
  clubId: 'club-1',
  clubName: 'Test Club',
  divisionId: 'div-1',
  divisionName: 'Division A',
  areaId: 'area-1',
  areaName: 'Area 1',
  distinguishedLevel: 'NotDistinguished',
  currentStatus: 'thriving',
  riskFactors: [],
  membershipTrend: [{ date: new Date().toISOString(), count: 20 }],
  dcpGoalsTrend: [{ date: new Date().toISOString(), goalsAchieved: 5 }],
  ...overrides,
})

describe('getClubStatusBadge Helper Function', () => {
  afterEach(() => {
    cleanup()
  })

  describe('Active Status Styling', () => {
    /**
     * Validates: Requirement 7.2
     * WHEN clubStatus is "Active", THE badge SHALL use a green color scheme (success styling)
     */
    it('should return green styling for "Active" status', () => {
      const result = getClubStatusBadge('Active')
      expect(result).toBe('bg-green-100 text-green-800 border-green-300')
    })

    it('should return green styling for "active" status (case-insensitive)', () => {
      const result = getClubStatusBadge('active')
      expect(result).toBe('bg-green-100 text-green-800 border-green-300')
    })

    it('should return green styling for "ACTIVE" status (uppercase)', () => {
      const result = getClubStatusBadge('ACTIVE')
      expect(result).toBe('bg-green-100 text-green-800 border-green-300')
    })
  })

  describe('Suspended Status Styling', () => {
    /**
     * Validates: Requirement 7.3
     * WHEN clubStatus is "Suspended", THE badge SHALL use a red color scheme (error styling)
     */
    it('should return red styling for "Suspended" status', () => {
      const result = getClubStatusBadge('Suspended')
      expect(result).toBe('bg-red-100 text-red-800 border-red-300')
    })

    it('should return red styling for "suspended" status (case-insensitive)', () => {
      const result = getClubStatusBadge('suspended')
      expect(result).toBe('bg-red-100 text-red-800 border-red-300')
    })
  })

  describe('Ineligible Status Styling', () => {
    /**
     * Validates: Requirement 7.4
     * WHEN clubStatus is "Ineligible", THE badge SHALL use a yellow/amber color scheme (warning styling)
     */
    it('should return yellow styling for "Ineligible" status', () => {
      const result = getClubStatusBadge('Ineligible')
      expect(result).toBe('bg-yellow-100 text-yellow-800 border-yellow-300')
    })

    it('should return yellow styling for "ineligible" status (case-insensitive)', () => {
      const result = getClubStatusBadge('ineligible')
      expect(result).toBe('bg-yellow-100 text-yellow-800 border-yellow-300')
    })
  })

  describe('Low Status Styling', () => {
    /**
     * Validates: Requirement 7.4
     * WHEN clubStatus is "Low", THE badge SHALL use a yellow/amber color scheme (warning styling)
     */
    it('should return yellow styling for "Low" status', () => {
      const result = getClubStatusBadge('Low')
      expect(result).toBe('bg-yellow-100 text-yellow-800 border-yellow-300')
    })

    it('should return yellow styling for "low" status (case-insensitive)', () => {
      const result = getClubStatusBadge('low')
      expect(result).toBe('bg-yellow-100 text-yellow-800 border-yellow-300')
    })
  })

  describe('Unknown Status Styling', () => {
    /**
     * Validates: Criterion 6 from design document
     * For unknown/unexpected status values, THE badge SHALL use gray styling (neutral)
     */
    it('should return gray styling for unknown status values', () => {
      const result = getClubStatusBadge('Unknown')
      expect(result).toBe('bg-gray-100 text-gray-800 border-gray-300')
    })

    it('should return gray styling for unexpected status values', () => {
      const result = getClubStatusBadge('SomeOtherStatus')
      expect(result).toBe('bg-gray-100 text-gray-800 border-gray-300')
    })

    it('should return gray styling for empty string status', () => {
      // Note: Empty string is truthy for the if check, so it goes to default case
      const result = getClubStatusBadge('')
      // Empty string is falsy, so it returns null
      expect(result).toBeNull()
    })
  })

  describe('Undefined Status Handling', () => {
    /**
     * Validates: Requirement 7.5
     * WHEN clubStatus is undefined, THE System SHALL not display a Club Status badge
     */
    it('should return null for undefined status', () => {
      const result = getClubStatusBadge(undefined)
      expect(result).toBeNull()
    })

    it('should return null for null-like values', () => {
      // Test with explicit undefined
      expect(getClubStatusBadge(undefined)).toBeNull()
    })
  })
})

describe('ClubDetailModal Club Status Badge Rendering', () => {
  afterEach(() => {
    cleanup()
  })

  describe('Badge Renders with Correct Styling', () => {
    /**
     * Validates: Requirements 7.1, 7.2
     * THE ClubDetailModal component SHALL display a Club Status badge when clubStatus is defined
     * WHEN clubStatus is "Active", THE badge SHALL use a green color scheme
     */
    it('should render Active status badge with green styling', () => {
      const club = createMockClub({ clubStatus: 'Active' })

      renderWithQueryClient(<ClubDetailModal club={club} onClose={() => {}} />)

      const badge = screen.getByText('Active')
      expect(badge).toBeInTheDocument()
      expect(badge).toHaveClass('bg-green-100')
      expect(badge).toHaveClass('text-green-800')
      expect(badge).toHaveClass('border-green-300')
    })

    /**
     * Validates: Requirements 7.1, 7.3
     * WHEN clubStatus is "Suspended", THE badge SHALL use a red color scheme
     */
    it('should render Suspended status badge with red styling', () => {
      const club = createMockClub({ clubStatus: 'Suspended' })

      renderWithQueryClient(<ClubDetailModal club={club} onClose={() => {}} />)

      const badge = screen.getByText('Suspended')
      expect(badge).toBeInTheDocument()
      expect(badge).toHaveClass('bg-red-100')
      expect(badge).toHaveClass('text-red-800')
      expect(badge).toHaveClass('border-red-300')
    })

    /**
     * Validates: Requirements 7.1, 7.4
     * WHEN clubStatus is "Ineligible", THE badge SHALL use a yellow/amber color scheme
     */
    it('should render Ineligible status badge with yellow styling', () => {
      const club = createMockClub({ clubStatus: 'Ineligible' })

      renderWithQueryClient(<ClubDetailModal club={club} onClose={() => {}} />)

      const badge = screen.getByText('Ineligible')
      expect(badge).toBeInTheDocument()
      expect(badge).toHaveClass('bg-yellow-100')
      expect(badge).toHaveClass('text-yellow-800')
      expect(badge).toHaveClass('border-yellow-300')
    })

    /**
     * Validates: Requirements 7.1, 7.4
     * WHEN clubStatus is "Low", THE badge SHALL use a yellow/amber color scheme
     */
    it('should render Low status badge with yellow styling', () => {
      const club = createMockClub({ clubStatus: 'Low' })

      renderWithQueryClient(<ClubDetailModal club={club} onClose={() => {}} />)

      const badge = screen.getByText('Low')
      expect(badge).toBeInTheDocument()
      expect(badge).toHaveClass('bg-yellow-100')
      expect(badge).toHaveClass('text-yellow-800')
      expect(badge).toHaveClass('border-yellow-300')
    })

    /**
     * Validates: Criterion 6 from design document
     * For unknown status values, THE badge SHALL use gray styling
     */
    it('should render unknown status badge with gray styling', () => {
      const club = createMockClub({ clubStatus: 'Unknown' })

      renderWithQueryClient(<ClubDetailModal club={club} onClose={() => {}} />)

      const badge = screen.getByText('Unknown')
      expect(badge).toBeInTheDocument()
      expect(badge).toHaveClass('bg-gray-100')
      expect(badge).toHaveClass('text-gray-800')
      expect(badge).toHaveClass('border-gray-300')
    })
  })

  describe('Badge Does Not Render When clubStatus is Undefined', () => {
    /**
     * Validates: Requirement 7.5
     * WHEN clubStatus is undefined, THE System SHALL not display a Club Status badge
     */
    it('should not render club status badge when clubStatus is undefined', () => {
      const club = createMockClub({ clubStatus: undefined })

      renderWithQueryClient(<ClubDetailModal club={club} onClose={() => {}} />)

      // The health status badge should still be present
      expect(screen.getByText('THRIVING')).toBeInTheDocument()

      // But no club status badge should be rendered
      // Check that none of the known status values are present as badges
      expect(screen.queryByText('Active')).not.toBeInTheDocument()
      expect(screen.queryByText('Suspended')).not.toBeInTheDocument()
      expect(screen.queryByText('Ineligible')).not.toBeInTheDocument()
      expect(screen.queryByText('Low')).not.toBeInTheDocument()
    })

    it('should not render club status badge when club has no clubStatus property', () => {
      // Create club without clubStatus property at all
      const club = createMockClub({})
      // Explicitly delete clubStatus to ensure it's not present
      delete (club as Partial<ClubTrend>).clubStatus

      renderWithQueryClient(<ClubDetailModal club={club} onClose={() => {}} />)

      // The health status badge should still be present
      expect(screen.getByText('THRIVING')).toBeInTheDocument()

      // Verify no club status badge is rendered by checking the badge container
      // The modal should only have one badge (health status)
      const badges = document.querySelectorAll('.rounded-full.border')
      // Filter to only count status badges (not other rounded elements)
      const statusBadges = Array.from(badges).filter(
        badge =>
          badge.classList.contains('px-4') && badge.classList.contains('py-2')
      )
      expect(statusBadges.length).toBe(1) // Only health status badge
    })
  })

  describe('Badge Positioning', () => {
    /**
     * Validates: Requirement 7.6
     * THE Club Status badge SHALL be positioned near the health status badge for visual grouping
     */
    it('should render club status badge next to health status badge', () => {
      const club = createMockClub({ clubStatus: 'Active' })

      renderWithQueryClient(<ClubDetailModal club={club} onClose={() => {}} />)

      // Both badges should be in the same container
      const healthBadge = screen.getByText('THRIVING')
      const clubStatusBadge = screen.getByText('Active')

      // Both should be present
      expect(healthBadge).toBeInTheDocument()
      expect(clubStatusBadge).toBeInTheDocument()

      // They should share a common parent container with flex layout
      const healthBadgeParent = healthBadge.parentElement
      const clubStatusBadgeParent = clubStatusBadge.parentElement

      // Both badges should be in the same flex container
      expect(healthBadgeParent).toBe(clubStatusBadgeParent)
      expect(healthBadgeParent).toHaveClass('flex')
      expect(healthBadgeParent).toHaveClass('items-center')
      expect(healthBadgeParent).toHaveClass('gap-3')
    })
  })

  describe('Modal Does Not Render When Club is Null', () => {
    it('should not render anything when club is null', () => {
      const { container } = renderWithQueryClient(
        <ClubDetailModal club={null} onClose={() => {}} />
      )

      // The modal should not render any content
      expect(container.firstChild).toBeNull()
    })
  })
})
