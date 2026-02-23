/**
 * Integration tests for LandingPage comparison mode (#93)
 *
 * Verifies:
 * - Pin icon renders on each table row
 * - Clicking pin icon toggles pinned state
 * - ComparisonPanel appears when 2+ districts are pinned
 * - Cannot pin more than 3 districts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import LandingPage from '../LandingPage'
import * as apiModule from '../../services/api'
import { renderWithProviders } from '../../__tests__/test-utils'

vi.mock('../../services/api', () => ({
  apiClient: {
    get: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('../../hooks/useDistricts', () => ({
  useDistricts: () => ({
    data: { districts: [] },
    isLoading: false,
    isError: false,
  }),
}))

interface MockApiClient {
  get: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}

const MOCK_RANKINGS = [
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
  {
    districtId: '99',
    districtName: 'District 99',
    region: '2',
    paidClubs: 40,
    paidClubBase: 50,
    clubGrowthPercent: -20.0,
    totalPayments: 1000,
    paymentBase: 1500,
    paymentGrowthPercent: -33.3,
    activeClubs: 40,
    distinguishedClubs: 10,
    selectDistinguished: 2,
    presidentsDistinguished: 1,
    distinguishedPercent: 25.0,
    clubsRank: 4,
    paymentsRank: 4,
    distinguishedRank: 4,
    aggregateScore: 150,
  },
]

const setupWithData = () => {
  const apiClient = apiModule.apiClient as unknown as MockApiClient
  apiClient.get.mockResolvedValueOnce({ data: { dates: [] } })
  apiClient.get.mockResolvedValueOnce({
    data: { rankings: MOCK_RANKINGS, date: '2025-11-22' },
  })
}

describe('LandingPage - Comparison Mode (#93)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render pin buttons on each table row', async () => {
    setupWithData()
    renderWithProviders(<LandingPage />)

    await screen.findByText('District 57')

    const pinButtons = screen.getAllByRole('button', { name: /pin district/i })
    expect(pinButtons.length).toBe(MOCK_RANKINGS.length)
  })

  it('should toggle pin state when pin button is clicked', async () => {
    setupWithData()
    renderWithProviders(<LandingPage />)

    await screen.findByText('District 57')

    const pinButtons = screen.getAllByRole('button', { name: /pin district/i })
    // Click to pin District 57
    fireEvent.click(pinButtons[0])

    // The button should now indicate it's pinned (unpin)
    const unpinButtons = screen.getAllByRole('button', {
      name: /unpin district/i,
    })
    expect(unpinButtons.length).toBe(1)
  })

  it('should show ComparisonPanel when 2 districts are pinned', async () => {
    setupWithData()
    renderWithProviders(<LandingPage />)

    await screen.findByText('District 57')

    const pinButtons = screen.getAllByRole('button', { name: /pin district/i })

    // Pin 2 districts
    fireEvent.click(pinButtons[0]) // District 57
    fireEvent.click(pinButtons[1]) // District 61

    // ComparisonPanel should be visible
    expect(screen.getByText(/Comparing 2 Districts/i)).toBeInTheDocument()
  })

  it('should not show ComparisonPanel when only 1 district is pinned', async () => {
    setupWithData()
    renderWithProviders(<LandingPage />)

    await screen.findByText('District 57')

    const pinButtons = screen.getAllByRole('button', { name: /pin district/i })
    fireEvent.click(pinButtons[0]) // Pin only 1

    expect(screen.queryByText(/Comparing/i)).not.toBeInTheDocument()
  })

  it('should disable pin buttons when 3 districts are already pinned', async () => {
    setupWithData()
    renderWithProviders(<LandingPage />)

    await screen.findByText('District 57')

    const pinButtons = screen.getAllByRole('button', { name: /pin district/i })

    // Pin 3 districts
    fireEvent.click(pinButtons[0]) // District 57
    fireEvent.click(pinButtons[1]) // District 61
    fireEvent.click(pinButtons[2]) // District 83

    // The 4th pin button should be disabled
    // After pinning 3, there are 3 "Unpin" buttons and 1 "Pin" button
    const unpinButtons = screen.getAllByRole('button', {
      name: /unpin district/i,
    })
    expect(unpinButtons.length).toBe(3)

    const remainingPinButtons = screen.getAllByRole('button', {
      name: /^Pin District/i,
    })
    expect(remainingPinButtons.length).toBe(1) // Only D99 remains unpinned
    expect(remainingPinButtons[0]).toBeDisabled()
  })

  it('should remove district from comparison when unpin button is clicked in table', async () => {
    setupWithData()
    renderWithProviders(<LandingPage />)

    await screen.findByText('District 57')

    const pinButtons = screen.getAllByRole('button', { name: /pin district/i })

    // Pin 2 districts
    fireEvent.click(pinButtons[0]) // District 57
    fireEvent.click(pinButtons[1]) // District 61

    expect(screen.getByText(/Comparing 2 Districts/i)).toBeInTheDocument()

    // Unpin District 57 via the table row button
    const unpinButtons = screen.getAllByRole('button', {
      name: /unpin district/i,
    })
    fireEvent.click(unpinButtons[0])

    // Panel should disappear (only 1 pinned)
    expect(screen.queryByText(/Comparing/i)).not.toBeInTheDocument()
  })
})
