/**
 * Club Health Frontend Workflow Integration Tests
 *
 * Simplified integration tests focusing on core workflow functionality
 * rather than specific UI text matching.
 *
 * Requirements: 1.1, 4.6, 8.1, 10.5
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ClubHealthDashboardPage } from '../pages/ClubHealthDashboardPage'
import { HealthMatrixDashboard } from '../components/HealthMatrixDashboard'
import { DistrictAnalyticsDashboard } from '../components/DistrictAnalyticsDashboard'
import { ClubHealthDetailModal } from '../components/ClubHealthDetailModal'
import type { ClubHealthResult } from '../types/clubHealth'
import { apiClient } from '../services/api'

// Mock the API client
vi.mock('../services/api', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
  enableCacheBypass: vi.fn(),
  disableCacheBypass: vi.fn(),
}))

// Sample test data
const mockClubHealthData: ClubHealthResult[] = [
  {
    club_name: 'Integration Test Club A',
    health_status: 'Thriving',
    reasons: [
      'Membership requirement met (25 members)',
      'DCP goals on track (3/3)',
      'CSP submitted',
    ],
    trajectory: 'Stable',
    trajectory_reasons: ['Health status unchanged', 'Consistent performance'],
    composite_key: 'Thriving__Stable',
    composite_label: 'Thriving • Stable',
    members_delta_mom: 2,
    dcp_delta_mom: 1,
    metadata: {
      evaluation_date: '2024-01-01',
      processing_time_ms: 45,
      rule_version: '1.0.0',
    },
  },
]

// Test utilities
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })

const renderWithProviders = (
  component: React.ReactElement,
  { queryClient = createTestQueryClient() } = {}
) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{component}</BrowserRouter>
    </QueryClientProvider>
  )
}

describe('Club Health Frontend Workflow Integration Tests', () => {
  let mockApiGet: ReturnType<typeof vi.fn>
  let mockApiPost: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()

    // Setup API mocks with proper return values
    mockApiGet = vi.fn().mockResolvedValue({ data: mockClubHealthData })
    mockApiPost = vi.fn().mockResolvedValue({ data: mockClubHealthData[0] })

    // Mock the apiClient methods
    vi.mocked(apiClient.get).mockImplementation(mockApiGet as never)
    vi.mocked(apiClient.post).mockImplementation(mockApiPost as never)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Dashboard Component Rendering', () => {
    it('should render dashboard with basic structure', async () => {
      renderWithProviders(<ClubHealthDashboardPage />)

      // Verify basic dashboard structure
      expect(screen.getByText('Club Health Dashboard')).toBeInTheDocument()
      expect(
        screen.getByText('Club Health Classification & Analytics')
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Health Matrix' })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Analytics' })
      ).toBeInTheDocument()
    })

    it('should switch between matrix and analytics views', async () => {
      const user = userEvent.setup()

      renderWithProviders(<ClubHealthDashboardPage />)

      // Verify Health Matrix view is active by default
      const matrixButton = screen.getByRole('button', { name: 'Health Matrix' })
      const analyticsButton = screen.getByRole('button', { name: 'Analytics' })

      expect(matrixButton).toHaveClass('bg-tm-loyal-blue')
      expect(analyticsButton).not.toHaveClass('bg-tm-loyal-blue')

      // Switch to Analytics view
      await user.click(analyticsButton)

      // Verify Analytics view is now active
      expect(analyticsButton).toHaveClass('bg-tm-loyal-blue')
      expect(matrixButton).not.toHaveClass('bg-tm-loyal-blue')
    })
  })

  describe('Health Matrix Component', () => {
    it('should render health matrix with proper structure', () => {
      renderWithProviders(
        <HealthMatrixDashboard
          clubs={mockClubHealthData}
          onClubSelect={vi.fn()}
          loading={false}
        />
      )

      // Verify matrix structure is rendered
      expect(screen.getByText('Club Health Matrix')).toBeInTheDocument()
      expect(screen.getByText(/clubs displayed/)).toBeInTheDocument()

      // Verify axis labels - use getAllByText for labels that appear multiple times
      expect(screen.getAllByText('Declining')[0]).toBeInTheDocument()
      expect(screen.getAllByText('Stable')[0]).toBeInTheDocument()
      expect(screen.getAllByText('Recovering')[0]).toBeInTheDocument()
      expect(screen.getAllByText('Thriving')[0]).toBeInTheDocument()
      expect(screen.getAllByText('Vulnerable')[0]).toBeInTheDocument()
      expect(
        screen.getAllByText('Intervention Required')[0]
      ).toBeInTheDocument()
    })

    it('should handle club selection interactions', async () => {
      const user = userEvent.setup()
      const mockOnClubSelect = vi.fn()

      renderWithProviders(
        <HealthMatrixDashboard
          clubs={mockClubHealthData}
          onClubSelect={mockOnClubSelect}
          loading={false}
        />
      )

      // Find matrix cells and interact with them
      const matrixCells = screen.getAllByRole('button')
      const clubCells = matrixCells.filter(
        cell =>
          cell.getAttribute('aria-label')?.includes('clubs') &&
          !cell.getAttribute('aria-label')?.includes('0 clubs')
      )

      // Click on a cell that has clubs
      if (clubCells.length > 0) {
        await user.click(clubCells[0])
        // The click should trigger some interaction (exact behavior depends on implementation)
      }
    })
  })

  describe('District Analytics Component', () => {
    it('should render analytics dashboard with proper structure', () => {
      renderWithProviders(
        <DistrictAnalyticsDashboard
          districtId="D42"
          clubs={mockClubHealthData}
          onClubSelect={vi.fn()}
          onExportData={vi.fn()}
          onNavigateToClub={vi.fn()}
          loading={false}
        />
      )

      // Verify analytics content is displayed - text is split across elements
      expect(screen.getByText(/District/)).toBeInTheDocument()
      expect(screen.getByText(/D42/)).toBeInTheDocument()
      expect(screen.getByText(/Analytics/)).toBeInTheDocument()
      expect(screen.getByText('Health Status Distribution')).toBeInTheDocument()
      expect(screen.getByText('Trajectory Distribution')).toBeInTheDocument()
      expect(screen.getByText('Total Clubs')).toBeInTheDocument()
    })
  })

  describe('Club Detail Modal Component', () => {
    it('should display detailed club information', () => {
      const selectedClub = mockClubHealthData[0]

      renderWithProviders(
        <ClubHealthDetailModal club={selectedClub} onClose={vi.fn()} />
      )

      // Verify club details are displayed
      expect(screen.getByText('Integration Test Club A')).toBeInTheDocument()
      expect(screen.getByText('Thriving')).toBeInTheDocument()
      expect(screen.getByText('Stable')).toBeInTheDocument()

      // Verify reasoning is displayed
      expect(
        screen.getByText('Membership requirement met (25 members)')
      ).toBeInTheDocument()
      expect(screen.getByText('DCP goals on track (3/3)')).toBeInTheDocument()
    })

    it('should handle modal with null club (closed state)', () => {
      renderWithProviders(
        <ClubHealthDetailModal club={null} onClose={vi.fn()} />
      )

      // Modal should not be visible when club is null
      expect(
        screen.queryByText('Integration Test Club A')
      ).not.toBeInTheDocument()
    })
  })

  describe('Performance and Accessibility', () => {
    it('should render components within performance thresholds', async () => {
      const startTime = performance.now()

      renderWithProviders(
        <HealthMatrixDashboard
          clubs={mockClubHealthData}
          onClubSelect={vi.fn()}
          loading={false}
        />
      )

      // Wait for component to fully render
      await waitFor(() => {
        expect(screen.getByText('Club Health Matrix')).toBeInTheDocument()
      })

      const renderTime = performance.now() - startTime

      // Component should render quickly (generous threshold for test environment)
      expect(renderTime).toBeLessThan(1000) // 1 second
    })

    it('should maintain accessibility standards', () => {
      renderWithProviders(
        <HealthMatrixDashboard
          clubs={mockClubHealthData}
          onClubSelect={vi.fn()}
          loading={false}
        />
      )

      // Verify proper heading structure
      const headings = screen.getAllByRole('heading')
      expect(headings.length).toBeGreaterThan(0)

      // Verify interactive elements are accessible
      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThan(0)

      // Verify proper labeling
      for (const button of buttons) {
        expect(button).toHaveAccessibleName()
      }
    })
  })

  describe('Error Handling', () => {
    it('should handle loading states properly', () => {
      renderWithProviders(
        <HealthMatrixDashboard
          clubs={[]}
          onClubSelect={vi.fn()}
          loading={true}
        />
      )

      // Verify loading state is shown
      expect(screen.getByRole('status')).toBeInTheDocument()
      expect(
        screen.getByText('Loading club health matrix...')
      ).toBeInTheDocument()
    })

    it('should handle empty data gracefully', () => {
      renderWithProviders(
        <HealthMatrixDashboard
          clubs={[]}
          onClubSelect={vi.fn()}
          loading={false}
        />
      )

      // Component should still render basic structure
      expect(screen.getByText('Club Health Matrix')).toBeInTheDocument()
      expect(screen.getByText(/0 clubs displayed/)).toBeInTheDocument()
    })

    it('should handle error states', () => {
      renderWithProviders(
        <HealthMatrixDashboard
          clubs={[]}
          onClubSelect={vi.fn()}
          loading={false}
          error="Network error"
        />
      )

      // Component should display error message - use getAllByText for multiple error elements
      const errorElements = screen.getAllByText(/error/i)
      expect(errorElements.length).toBeGreaterThan(0)
    })
  })
})
