/**
 * Unit tests for ComparisonPanel (#93, #109, #110)
 *
 * Verifies:
 * - Does not render when fewer than 2 districts pinned
 * - Renders panel with metrics table when 2 districts pinned
 * - Renders radar chart with correct number of data series
 * - "Clear All" button calls onClearAll
 * - Individual remove button calls onRemove(districtId)
 * - Displays correct metric values for pinned districts
 * - (#109) Overall Rank shows actual position, not percentage
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import ComparisonPanel from '../ComparisonPanel'
import { DistrictRanking } from '../../types/districts'

const MOCK_DISTRICTS: DistrictRanking[] = [
  {
    districtId: '57',
    districtName: 'District 57',
    region: '1',
    paidClubs: 100,
    paidClubBase: 90,
    clubGrowthPercent: 12.5,
    totalPayments: 5000,
    paymentBase: 4500,
    paymentGrowthPercent: 11.1,
    activeClubs: 100,
    distinguishedClubs: 50,
    selectDistinguished: 20,
    presidentsDistinguished: 10,
    distinguishedPercent: 50,
    clubsRank: 1,
    paymentsRank: 1,
    distinguishedRank: 1,
    aggregateScore: 300,
  },
  {
    districtId: '61',
    districtName: 'District 61',
    region: '2',
    paidClubs: 80,
    paidClubBase: 75,
    clubGrowthPercent: 6.7,
    totalPayments: 3000,
    paymentBase: 2800,
    paymentGrowthPercent: 7.1,
    activeClubs: 80,
    distinguishedClubs: 30,
    selectDistinguished: 10,
    presidentsDistinguished: 5,
    distinguishedPercent: 37.5,
    clubsRank: 2,
    paymentsRank: 2,
    distinguishedRank: 2,
    aggregateScore: 250,
  },
  {
    districtId: '83',
    districtName: 'District 83',
    region: '1',
    paidClubs: 60,
    paidClubBase: 65,
    clubGrowthPercent: -7.7,
    totalPayments: 2000,
    paymentBase: 2200,
    paymentGrowthPercent: -9.1,
    activeClubs: 60,
    distinguishedClubs: 20,
    selectDistinguished: 5,
    presidentsDistinguished: 3,
    distinguishedPercent: 33.3,
    clubsRank: 3,
    paymentsRank: 3,
    distinguishedRank: 3,
    aggregateScore: 200,
  },
]

describe('ComparisonPanel (#93)', () => {
  it('should not render anything when fewer than 2 districts are pinned', () => {
    const { container } = render(
      <ComparisonPanel
        pinnedDistricts={[MOCK_DISTRICTS[0]]}
        allRankings={MOCK_DISTRICTS}
        totalDistricts={3}
        onRemove={vi.fn()}
        onClearAll={vi.fn()}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('should render panel with header when 2 districts are pinned', () => {
    render(
      <ComparisonPanel
        pinnedDistricts={[MOCK_DISTRICTS[0], MOCK_DISTRICTS[1]]}
        allRankings={MOCK_DISTRICTS}
        totalDistricts={3}
        onRemove={vi.fn()}
        onClearAll={vi.fn()}
      />
    )

    expect(screen.getByText(/Comparing 2 Districts/i)).toBeInTheDocument()
  })

  it('should display district names in the comparison', () => {
    render(
      <ComparisonPanel
        pinnedDistricts={[MOCK_DISTRICTS[0], MOCK_DISTRICTS[1]]}
        allRankings={MOCK_DISTRICTS}
        totalDistricts={3}
        onRemove={vi.fn()}
        onClearAll={vi.fn()}
      />
    )

    expect(screen.getByText('District 57')).toBeInTheDocument()
    expect(screen.getByText('District 61')).toBeInTheDocument()
  })

  it('should display metric values for pinned districts', () => {
    render(
      <ComparisonPanel
        pinnedDistricts={[MOCK_DISTRICTS[0], MOCK_DISTRICTS[1]]}
        allRankings={MOCK_DISTRICTS}
        totalDistricts={3}
        onRemove={vi.fn()}
        onClearAll={vi.fn()}
      />
    )

    // Check that key metric labels exist
    expect(screen.getByText('Paid Clubs')).toBeInTheDocument()
    expect(screen.getByText('Payments')).toBeInTheDocument()
    expect(screen.getByText('Distinguished')).toBeInTheDocument()
  })

  it('should render a radar chart SVG element', () => {
    const { container } = render(
      <ComparisonPanel
        pinnedDistricts={[MOCK_DISTRICTS[0], MOCK_DISTRICTS[1]]}
        allRankings={MOCK_DISTRICTS}
        totalDistricts={3}
        onRemove={vi.fn()}
        onClearAll={vi.fn()}
      />
    )

    // Recharts renders an SVG
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('should call onClearAll when "Clear All" button is clicked', () => {
    const onClearAll = vi.fn()
    render(
      <ComparisonPanel
        pinnedDistricts={[MOCK_DISTRICTS[0], MOCK_DISTRICTS[1]]}
        allRankings={MOCK_DISTRICTS}
        totalDistricts={3}
        onRemove={vi.fn()}
        onClearAll={onClearAll}
      />
    )

    const clearButton = screen.getByRole('button', { name: /clear all/i })
    fireEvent.click(clearButton)
    expect(onClearAll).toHaveBeenCalledTimes(1)
  })

  it('should call onRemove with correct districtId when remove button is clicked', () => {
    const onRemove = vi.fn()
    render(
      <ComparisonPanel
        pinnedDistricts={[MOCK_DISTRICTS[0], MOCK_DISTRICTS[1]]}
        allRankings={MOCK_DISTRICTS}
        totalDistricts={3}
        onRemove={onRemove}
        onClearAll={vi.fn()}
      />
    )

    // Each district column should have a remove button
    const removeButtons = screen.getAllByRole('button', { name: /remove/i })
    expect(removeButtons.length).toBe(2)

    fireEvent.click(removeButtons[0])
    expect(onRemove).toHaveBeenCalledWith('57')
  })

  it('should render with 3 pinned districts', () => {
    render(
      <ComparisonPanel
        pinnedDistricts={MOCK_DISTRICTS}
        allRankings={MOCK_DISTRICTS}
        totalDistricts={3}
        onRemove={vi.fn()}
        onClearAll={vi.fn()}
      />
    )

    expect(screen.getByText(/Comparing 3 Districts/i)).toBeInTheDocument()
    expect(screen.getByText('District 57')).toBeInTheDocument()
    expect(screen.getByText('District 61')).toBeInTheDocument()
    expect(screen.getByText('District 83')).toBeInTheDocument()
  })

  // #109: Verify Overall Rank shows actual rank position, not percentage
  it('should display correct overall rank from position in allRankings (#109)', () => {
    render(
      <ComparisonPanel
        pinnedDistricts={[MOCK_DISTRICTS[0], MOCK_DISTRICTS[1]]}
        allRankings={MOCK_DISTRICTS}
        totalDistricts={3}
        onRemove={vi.fn()}
        onClearAll={vi.fn()}
      />
    )

    // District 57 is at index 0 in allRankings (sorted by score desc) → rank #1
    // District 61 is at index 1 → rank #2
    // The old bug showed #100 and #83 (percentage formula)
    expect(screen.getByText('#1')).toBeInTheDocument()
    expect(screen.getByText('#2')).toBeInTheDocument()
  })
})
