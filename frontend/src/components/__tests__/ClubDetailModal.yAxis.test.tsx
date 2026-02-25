/**
 * Unit Tests for ClubDetailModal Y-Axis Labels (#107)
 *
 * Validates that the membership trend chart y-axis:
 * 1. Does NOT show inverted or non-sequential labels
 * 2. Correctly pads the range when all values are equal
 * 3. Shows proper top > middle > bottom ordering
 */

import React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ClubDetailModal } from '../ClubDetailModal'
import { ClubTrend } from '../../hooks/useDistrictAnalytics'
import { getProgramYear } from '../../utils/programYear'

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

describe('ClubDetailModal Y-Axis Labels (#107)', () => {
  afterEach(() => {
    cleanup()
  })

  /**
   * BUG: When all membership values are the same (e.g., 11),
   * the y-axis shows 11, 12, 11 — the middle label exceeds the max.
   *
   * EXPECTED: Labels should be strictly descending top-to-bottom (e.g., 12, 11, 10)
   */
  it('should show sequential y-axis labels when all membership values are equal', () => {
    const programYear = getProgramYear(2025) // 2025-2026
    const club = createMockClub({
      membershipTrend: [
        { date: '2025-08-01', count: 11 },
        { date: '2025-09-01', count: 11 },
        { date: '2025-10-01', count: 11 },
      ],
      dcpGoalsTrend: [],
    })

    const { container } = renderWithQueryClient(
      <ClubDetailModal
        club={club}
        programYear={programYear}
        onClose={() => {}}
      />
    )

    // Find the y-axis label container — it's the div with flex-col
    const yAxisContainer = container.querySelector(
      '.flex.flex-col.justify-between'
    )
    expect(yAxisContainer).toBeTruthy()

    const labels = yAxisContainer!.querySelectorAll('span')
    expect(labels.length).toBe(3)

    const topLabel = Number(labels[0].textContent)
    const midLabel = Number(labels[1].textContent)
    const bottomLabel = Number(labels[2].textContent)

    // Top label must be >= middle, middle must be >= bottom (descending order)
    expect(topLabel).toBeGreaterThanOrEqual(midLabel)
    expect(midLabel).toBeGreaterThanOrEqual(bottomLabel)

    // Top must be strictly greater than bottom (they can't all be the same)
    expect(topLabel).toBeGreaterThan(bottomLabel)
  })

  /**
   * When membership varies (e.g., 10 to 15), labels should be in proper order
   */
  it('should show correct y-axis labels with varying membership', () => {
    const programYear = getProgramYear(2025)
    const club = createMockClub({
      membershipTrend: [
        { date: '2025-08-01', count: 10 },
        { date: '2025-10-01', count: 13 },
        { date: '2026-01-01', count: 15 },
      ],
      dcpGoalsTrend: [],
    })

    const { container } = renderWithQueryClient(
      <ClubDetailModal
        club={club}
        programYear={programYear}
        onClose={() => {}}
      />
    )

    const yAxisContainer = container.querySelector(
      '.flex.flex-col.justify-between'
    )
    expect(yAxisContainer).toBeTruthy()

    const labels = yAxisContainer!.querySelectorAll('span')
    const topLabel = Number(labels[0].textContent)
    const midLabel = Number(labels[1].textContent)
    const bottomLabel = Number(labels[2].textContent)

    // Verify descending order
    expect(topLabel).toBeGreaterThanOrEqual(midLabel)
    expect(midLabel).toBeGreaterThanOrEqual(bottomLabel)

    // Top should be max (15), bottom should be min (10)
    expect(topLabel).toBe(15)
    expect(bottomLabel).toBe(10)
  })
})
