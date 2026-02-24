/**
 * Unit Tests for ClubDetailModal Program Year Filtering (#119)
 *
 * Validates that when a programYear prop is passed, the modal:
 * 1. Displays the correct program year label (not the prior year)
 * 2. Filters membership trend data to only the selected program year
 * 3. Falls back to inferring from data when no prop is passed
 */

import React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ClubDetailModal } from '../ClubDetailModal'
import { ClubTrend } from '../../hooks/useDistrictAnalytics'
import { getProgramYear, type ProgramYear } from '../../utils/programYear'

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  )
}

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
  membershipTrend: [],
  dcpGoalsTrend: [],
  ...overrides,
})

describe('ClubDetailModal Program Year Filtering (#119)', () => {
  afterEach(() => {
    cleanup()
  })

  describe('Program Year Label', () => {
    /**
     * WHEN programYear prop is passed as 2025-2026
     * AND the data contains prior-year data points (2024-2025)
     * THE modal SHALL display "2025-2026" as the program year label
     */
    it('should display the programYear prop label, not the prior year from data', () => {
      const currentYear: ProgramYear = getProgramYear(2025) // 2025-2026
      const club = createMockClub({
        membershipTrend: [
          // Prior year data point (would make getProgramYearForDate return 2024-2025)
          { date: '2025-02-15', count: 18 },
          // Current year data points
          { date: '2025-08-01', count: 20 },
          { date: '2025-12-01', count: 22 },
          { date: '2026-02-01', count: 24 },
        ],
        dcpGoalsTrend: [
          { date: '2025-02-15', goalsAchieved: 3 },
          { date: '2025-08-01', goalsAchieved: 4 },
          { date: '2026-02-01', goalsAchieved: 6 },
        ],
      })

      renderWithQueryClient(
        <ClubDetailModal
          club={club}
          programYear={currentYear}
          onClose={() => {}}
        />
      )

      // Should show the prop's program year, not the prior one inferred from data
      const elements = screen.getAllByText(/2025-2026/)
      expect(elements.length).toBeGreaterThan(0)
      expect(screen.queryByText(/2024-2025/)).not.toBeInTheDocument()
    })
  })

  describe('Data Filtering', () => {
    /**
     * WHEN programYear prop is 2025-2026 (Jul 1, 2025 – Jun 30, 2026)
     * AND data contains prior-year data points (before Jul 1, 2025)
     * THE modal SHALL filter out prior-year data points
     * AND display only 2025-2026 data in the chart
     */
    it('should filter membership trend data to the selected program year', () => {
      const currentYear: ProgramYear = getProgramYear(2025) // 2025-2026
      const club = createMockClub({
        membershipTrend: [
          // Prior year — should be filtered out
          { date: '2025-02-15', count: 18 },
          { date: '2025-06-01', count: 19 },
          // Current year — should be kept
          { date: '2025-08-01', count: 20 },
          { date: '2025-12-01', count: 22 },
          { date: '2026-02-01', count: 24 },
        ],
        dcpGoalsTrend: [],
      })

      const { container } = renderWithQueryClient(
        <ClubDetailModal
          club={club}
          programYear={currentYear}
          onClose={() => {}}
        />
      )

      // The chart should show 3 data points (Aug, Dec, Feb), not 5
      // Each data point is rendered as a <circle> element in the SVG
      const circles = container.querySelectorAll('circle')
      expect(circles.length).toBe(3)

      // Verify the "Current" count shows the latest data from the FILTERED set (24)
      expect(screen.getByText('24 members')).toBeInTheDocument()
    })

    /**
     * WHEN programYear prop is 2025-2026
     * AND data only has prior-year points
     * THE modal SHALL show no chart (0 filtered points)
     */
    it('should show no chart when all data is outside the selected program year', () => {
      const currentYear: ProgramYear = getProgramYear(2025) // 2025-2026
      const club = createMockClub({
        membershipTrend: [
          { date: '2025-02-15', count: 18 },
          { date: '2025-05-01', count: 19 },
        ],
        dcpGoalsTrend: [],
      })

      const { container } = renderWithQueryClient(
        <ClubDetailModal
          club={club}
          programYear={currentYear}
          onClose={() => {}}
        />
      )

      // With 0 filtered points, the membership section should not render
      expect(screen.queryByText('Membership Trend')).not.toBeInTheDocument()
      // No circles should be rendered
      const circles = container.querySelectorAll('circle')
      expect(circles.length).toBe(0)
    })
  })

  describe('Fallback Behavior', () => {
    /**
     * WHEN no programYear prop is passed
     * THE modal SHALL infer the program year from the first data point (existing behavior)
     */
    it('should infer program year from data when no programYear prop is passed', () => {
      const club = createMockClub({
        membershipTrend: [
          { date: '2025-09-01', count: 20 },
          { date: '2025-12-01', count: 22 },
        ],
        dcpGoalsTrend: [],
      })

      renderWithQueryClient(<ClubDetailModal club={club} onClose={() => {}} />)

      // Sep 2025 belongs to program year 2025-2026
      // Label appears in both header ("Program Year 2025-2026") and legend ("2025-2026 Program Year")
      const elements = screen.getAllByText(/2025-2026/)
      expect(elements.length).toBeGreaterThan(0)
    })
  })
})
