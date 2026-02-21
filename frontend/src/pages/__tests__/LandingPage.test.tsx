import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import LandingPage from '../LandingPage'
import * as apiModule from '../../services/api'
import { renderWithProviders } from '../../__tests__/test-utils'

// Mock the API client
vi.mock('../../services/api', () => ({
  apiClient: {
    get: vi.fn(),
    delete: vi.fn(),
  },
}))

interface MockApiClient {
  get: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}

// renderWithProviders is provided by test-utils to include ProgramYearProvider and common wrappers

describe('LandingPage - Percentage Formatting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('formatPercentage function', () => {
    it('should return "+" prefix and green color for positive percentages', async () => {
      const apiClient = apiModule.apiClient as unknown as MockApiClient

      apiClient.get.mockResolvedValueOnce({
        data: {
          dates: [],
        },
      })

      apiClient.get.mockResolvedValueOnce({
        data: {
          rankings: [
            {
              districtId: 'D1',
              districtName: 'District 1',
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
          ],
          date: '2025-11-22',
        },
      })

      renderWithProviders(<LandingPage />)

      // Wait for data to load and check for positive percentage with + prefix
      const element = await screen.findByText('+12.5%')
      expect(element).toBeInTheDocument()
      expect(element).toHaveClass('text-green-600')
    })

    it('should return "-" prefix and red color for negative percentages', async () => {
      const apiClient = apiModule.apiClient as unknown as MockApiClient

      apiClient.get.mockResolvedValueOnce({
        data: {
          dates: [],
        },
      })

      apiClient.get.mockResolvedValueOnce({
        data: {
          rankings: [
            {
              districtId: 'D1',
              districtName: 'District 1',
              region: '1',
              paidClubs: 80,
              paidClubBase: 90,
              clubGrowthPercent: -11.1,
              totalPayments: 4000,
              paymentBase: 4500,
              paymentGrowthPercent: -8.5,
              activeClubs: 80,
              distinguishedClubs: 40,
              selectDistinguished: 15,
              presidentsDistinguished: 5,
              distinguishedPercent: 50,
              clubsRank: 1,
              paymentsRank: 1,
              distinguishedRank: 1,
              aggregateScore: 300,
            },
          ],
          date: '2025-11-22',
        },
      })

      renderWithProviders(<LandingPage />)

      // Wait for data to load and check for negative percentage
      const element = await screen.findByText('-11.1%')
      expect(element).toBeInTheDocument()
      expect(element).toHaveClass('text-red-600')
    })

    it('should return "0.0%" with gray color for zero percentages', async () => {
      const apiClient = apiModule.apiClient as unknown as MockApiClient

      apiClient.get.mockResolvedValueOnce({
        data: {
          dates: [],
        },
      })

      apiClient.get.mockResolvedValueOnce({
        data: {
          rankings: [
            {
              districtId: 'D1',
              districtName: 'District 1',
              region: '1',
              paidClubs: 90,
              paidClubBase: 90,
              clubGrowthPercent: 0,
              totalPayments: 4500,
              paymentBase: 4500,
              paymentGrowthPercent: 1.5,
              activeClubs: 90,
              distinguishedClubs: 45,
              selectDistinguished: 15,
              presidentsDistinguished: 5,
              distinguishedPercent: 50,
              clubsRank: 1,
              paymentsRank: 1,
              distinguishedRank: 1,
              aggregateScore: 300,
            },
          ],
          date: '2025-11-22',
        },
      })

      renderWithProviders(<LandingPage />)

      // Wait for data to load and check for zero percentage
      const element = await screen.findByText('0.0%')
      expect(element).toBeInTheDocument()
      expect(element).toHaveClass('text-gray-600')
    })

    it('should format percentages to 1 decimal place precision', async () => {
      const apiClient = apiModule.apiClient as unknown as MockApiClient

      apiClient.get.mockResolvedValueOnce({
        data: {
          dates: [],
        },
      })

      apiClient.get.mockResolvedValueOnce({
        data: {
          rankings: [
            {
              districtId: 'D1',
              districtName: 'District 1',
              region: '1',
              paidClubs: 100,
              paidClubBase: 90,
              clubGrowthPercent: 12.567,
              totalPayments: 5000,
              paymentBase: 4500,
              paymentGrowthPercent: 8.333,
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
          ],
          date: '2025-11-22',
        },
      })

      renderWithProviders(<LandingPage />)

      // Wait for data to load and check for 1 decimal place formatting
      const element1 = await screen.findByText('+12.6%')
      const element2 = await screen.findByText('+8.3%')
      expect(element1).toBeInTheDocument()
      expect(element2).toBeInTheDocument()
    })
  })
})

describe('LandingPage - Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should display welcome message and backfill button when no snapshots are available', async () => {
    const apiClient = apiModule.apiClient as unknown as MockApiClient

    // Mock cached dates call to succeed
    apiClient.get.mockResolvedValueOnce({
      data: {
        dates: [],
      },
    })

    // Mock rankings call to return NO_SNAPSHOT_AVAILABLE error
    apiClient.get.mockRejectedValueOnce({
      response: {
        status: 503,
        data: {
          error: {
            code: 'NO_SNAPSHOT_AVAILABLE',
            message: 'No data snapshot available yet',
            details: 'Run a refresh operation to create the first snapshot',
          },
        },
      },
    })

    renderWithProviders(<LandingPage />)

    // Wait for error state to render
    const welcomeHeading = await screen.findByText('Welcome to Toast-Stats!')
    expect(welcomeHeading).toBeInTheDocument()

    // Check for guidance message
    expect(
      screen.getByText(
        "No data snapshots are available yet. To get started, you'll need to fetch data from the Toastmasters dashboard."
      )
    ).toBeInTheDocument()

    // Check for "Check Again" button (now the primary action)
    expect(screen.getByText('Check Again')).toBeInTheDocument()

    // Check for setup instructions
    expect(screen.getByText('What happens next:')).toBeInTheDocument()
    expect(
      screen.getByText(/The data pipeline will automatically collect data/)
    ).toBeInTheDocument()
  })

  it('should display generic error message for other types of errors', async () => {
    const apiClient = apiModule.apiClient as unknown as MockApiClient

    // Mock cached dates call to succeed
    apiClient.get.mockResolvedValueOnce({
      data: {
        dates: [],
      },
    })

    // Mock rankings call to return a different error
    const mockError = new Error('Something went wrong')
    apiClient.get.mockRejectedValueOnce(mockError)

    renderWithProviders(<LandingPage />)

    // Wait for error state to render
    const errorHeading = await screen.findByText('Error Loading Rankings')
    expect(errorHeading).toBeInTheDocument()

    // Check for generic error message
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()

    // Check for "Try Again" button
    expect(screen.getByText('Try Again')).toBeInTheDocument()

    // Should NOT show the welcome message
    expect(
      screen.queryByText('Welcome to Toast-Stats!')
    ).not.toBeInTheDocument()
  })
})

describe('LandingPage - Table Cell Rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should display rank number correctly', async () => {
    const apiClient = apiModule.apiClient as unknown as MockApiClient

    apiClient.get.mockResolvedValueOnce({
      data: {
        dates: [],
      },
    })

    apiClient.get.mockResolvedValueOnce({
      data: {
        rankings: [
          {
            districtId: 'D1',
            districtName: 'District 1',
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
            clubsRank: 5,
            paymentsRank: 3,
            distinguishedRank: 1,
            aggregateScore: 300,
          },
        ],
        date: '2025-11-22',
      },
    })

    renderWithProviders(<LandingPage />)

    // Wait for data to load and check for rank numbers
    const clubsRank = await screen.findByText('Rank #5')
    const paymentsRank = await screen.findByText('Rank #3')
    expect(clubsRank).toBeInTheDocument()
    expect(clubsRank).toHaveClass('text-tm-loyal-blue')
    expect(paymentsRank).toBeInTheDocument()
    expect(paymentsRank).toHaveClass('text-tm-loyal-blue')
  })

  it('should display percentage with correct color', async () => {
    const apiClient = apiModule.apiClient as unknown as MockApiClient

    apiClient.get.mockResolvedValueOnce({
      data: {
        dates: [],
      },
    })

    apiClient.get.mockResolvedValueOnce({
      data: {
        rankings: [
          {
            districtId: 'D1',
            districtName: 'District 1',
            region: '1',
            paidClubs: 100,
            paidClubBase: 90,
            clubGrowthPercent: 15.5,
            totalPayments: 4000,
            paymentBase: 4500,
            paymentGrowthPercent: -11.1,
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
        ],
        date: '2025-11-22',
      },
    })

    renderWithProviders(<LandingPage />)

    // Wait for data to load and check for percentage colors
    const positivePercent = await screen.findByText('+15.5%')
    const negativePercent = await screen.findByText('-11.1%')
    expect(positivePercent).toBeInTheDocument()
    expect(positivePercent).toHaveClass('text-green-600')
    expect(negativePercent).toBeInTheDocument()
    expect(negativePercent).toHaveClass('text-red-600')
  })

  it('should display bullet separator between rank and percentage', async () => {
    const apiClient = apiModule.apiClient as unknown as MockApiClient

    apiClient.get.mockResolvedValueOnce({
      data: {
        dates: [],
      },
    })

    apiClient.get.mockResolvedValueOnce({
      data: {
        rankings: [
          {
            districtId: 'D1',
            districtName: 'District 1',
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
        ],
        date: '2025-11-22',
      },
    })

    renderWithProviders(<LandingPage />)

    // Wait for data to load and check for bullet separators
    await screen.findByText('District 1')
    const bullets = screen.getAllByText('•')
    // Should have 2 bullets (one for paid clubs, one for total payments)
    expect(bullets.length).toBeGreaterThanOrEqual(2)
    bullets.forEach(bullet => {
      expect(bullet).toHaveClass('text-gray-400')
    })
  })

  it('should display both rank and percentage values visible and properly aligned', async () => {
    const apiClient = apiModule.apiClient as unknown as MockApiClient

    apiClient.get.mockResolvedValueOnce({
      data: {
        dates: [],
      },
    })

    apiClient.get.mockResolvedValueOnce({
      data: {
        rankings: [
          {
            districtId: 'D1',
            districtName: 'District 1',
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
            clubsRank: 5,
            paymentsRank: 3,
            distinguishedRank: 1,
            aggregateScore: 300,
          },
        ],
        date: '2025-11-22',
      },
    })

    renderWithProviders(<LandingPage />)

    // Wait for data to load and verify all elements are present
    await screen.findByText('District 1')

    // Check paid clubs column
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText('Rank #5')).toBeInTheDocument()
    expect(screen.getByText('+12.5%')).toBeInTheDocument()

    // Check total payments column
    expect(screen.getByText('5,000')).toBeInTheDocument()
    expect(screen.getByText('Rank #3')).toBeInTheDocument()
    expect(screen.getByText('+11.1%')).toBeInTheDocument()

    // Verify the rank and percentage are in the same container (text-xs class)
    const rankElements = screen.getAllByText(/Rank #\d+/)
    // Check that rank elements exist and are styled correctly
    expect(rankElements.length).toBeGreaterThan(0)
    rankElements.forEach(rankElement => {
      expect(rankElement).toHaveClass('text-tm-loyal-blue')
    })
  })
})
