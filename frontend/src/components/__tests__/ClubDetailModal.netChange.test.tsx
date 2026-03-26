/**
 * Tests for #194: ClubDetailModal net change calculation.
 *
 * The bug: membershipChange computes `latest - first trend point`
 * instead of `latestMembership - baseMembership`. With 1 data point,
 * it returns 0.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, render, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ClubDetailModal } from '../ClubDetailModal'

// Mock useClubTrends hook
vi.mock('../../hooks/useClubTrends', () => ({
  useClubTrends: vi.fn(() => ({
    data: null,
    isLoading: false,
    error: null,
  })),
}))

function makeClub(overrides: {
  membershipBase?: number
  membershipTrend?: Array<{ date: string; count: number }>
}) {
  return {
    clubId: 'C001',
    clubName: 'Test Club',
    areaName: 'A1',
    areaId: 'A1',
    divisionName: 'Division A',
    divisionId: 'A',
    currentStatus: 'thriving' as const,
    membershipTrend: overrides.membershipTrend ?? [
      { date: '2025-10-15', count: 21 },
    ],
    dcpGoalsTrend: [{ date: '2025-10-15', goalsAchieved: 5 }],
    riskFactors: [],
    clubStatus: undefined,
    distinguishedLevel: 'NotDistinguished' as const,
    membershipBase: overrides.membershipBase,
    octoberRenewals: 5,
    aprilRenewals: 3,
    newMembers: 2,
  }
}

const programYear = {
  year: 2025,
  label: '2025-2026',
  startDate: '2025-07-01',
  endDate: '2026-06-30',
}

describe('ClubDetailModal - Net Change (#194)', () => {
  afterEach(() => {
    cleanup()
  })

  it('should show correct negative net change from base to current', () => {
    const club = makeClub({
      membershipBase: 26,
      membershipTrend: [{ date: '2025-10-15', count: 21 }],
    })

    render(
      <ClubDetailModal
        club={club}
        districtId="61"
        programYear={programYear}
        onClose={() => {}}
      />
    )

    // Net Change stat block: Base 26, Current 21 → -5
    // The value is next to the "Net Change" label
    expect(screen.getByText('-5')).toBeInTheDocument()
  })

  it('should show correct positive net change from base to current', () => {
    const club = makeClub({
      membershipBase: 20,
      membershipTrend: [{ date: '2025-10-15', count: 25 }],
    })

    render(
      <ClubDetailModal
        club={club}
        districtId="61"
        programYear={programYear}
        onClose={() => {}}
      />
    )

    // Base 20, Current 25 → +5
    expect(screen.getByText('+5')).toBeInTheDocument()
  })

  it('should show 0 net change when base equals current', () => {
    const club = makeClub({
      membershipBase: 21,
      membershipTrend: [{ date: '2025-10-15', count: 21 }],
    })

    render(
      <ClubDetailModal
        club={club}
        districtId="61"
        programYear={programYear}
        onClose={() => {}}
      />
    )

    // Base 21, Current 21 → 0 change
    // The chart stats section renders "+0 members" (uses >= 0 for + prefix)
    expect(screen.getByText(/\+0 members/)).toBeInTheDocument()
  })
})
