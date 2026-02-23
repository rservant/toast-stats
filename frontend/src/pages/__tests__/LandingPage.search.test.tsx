/**
 * Unit tests for LandingPage search bar (#91)
 *
 * Verifies:
 * - Search input renders with placeholder
 * - Typing a district number filters the table
 * - Typing a district name filters the table
 * - Clear button resets the filter
 * - Search is case-insensitive
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
]

const setupWithData = () => {
  const apiClient = apiModule.apiClient as unknown as MockApiClient
  apiClient.get.mockResolvedValueOnce({ data: { dates: [] } })
  apiClient.get.mockResolvedValueOnce({
    data: { rankings: MOCK_RANKINGS, date: '2025-11-22' },
  })
}

describe('LandingPage - District Search (#91)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render a search input with appropriate placeholder', async () => {
    setupWithData()
    renderWithProviders(<LandingPage />)

    await screen.findByText('District 57')

    const searchInput = screen.getByPlaceholderText(/search/i)
    expect(searchInput).toBeInTheDocument()
  })

  it('should filter table rows when typing a district number', async () => {
    setupWithData()
    renderWithProviders(<LandingPage />)

    await screen.findByText('District 57')
    expect(screen.getByText('District 61')).toBeInTheDocument()
    expect(screen.getByText('District 83')).toBeInTheDocument()

    const searchInput = screen.getByPlaceholderText(/search/i)
    fireEvent.change(searchInput, { target: { value: '61' } })

    // Should show District 61 but not the others
    expect(screen.getByText('District 61')).toBeInTheDocument()
    expect(screen.queryByText('District 57')).not.toBeInTheDocument()
    expect(screen.queryByText('District 83')).not.toBeInTheDocument()
  })

  it('should filter table rows when typing a district name', async () => {
    setupWithData()
    renderWithProviders(<LandingPage />)

    await screen.findByText('District 57')

    const searchInput = screen.getByPlaceholderText(/search/i)
    fireEvent.change(searchInput, { target: { value: 'district 83' } })

    expect(screen.getByText('District 83')).toBeInTheDocument()
    expect(screen.queryByText('District 57')).not.toBeInTheDocument()
    expect(screen.queryByText('District 61')).not.toBeInTheDocument()
  })

  it('should clear search and show all districts when clear button is clicked', async () => {
    setupWithData()
    renderWithProviders(<LandingPage />)

    await screen.findByText('District 57')

    const searchInput = screen.getByPlaceholderText(/search/i)
    fireEvent.change(searchInput, { target: { value: '57' } })

    // Only District 57 visible
    expect(screen.queryByText('District 61')).not.toBeInTheDocument()

    // Click the clear button
    const clearButton = screen.getByRole('button', {
      name: /clear search/i,
    })
    fireEvent.click(clearButton)

    // All districts should be visible again
    expect(screen.getByText('District 57')).toBeInTheDocument()
    expect(screen.getByText('District 61')).toBeInTheDocument()
    expect(screen.getByText('District 83')).toBeInTheDocument()
  })
})
