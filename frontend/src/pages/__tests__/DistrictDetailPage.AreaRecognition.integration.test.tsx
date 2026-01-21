/**
 * Integration Tests for District Detail Page - Area Recognition Panel
 *
 * Tests the integration of AreaRecognitionPanel component within the District Detail Page context,
 * verifying:
 * - Component renders correctly in the Divisions & Areas tab
 * - Data flows correctly from districtStatistics to AreaRecognitionPanel
 * - Loading state is passed correctly
 *
 * Validates Requirements: 1.1 (Integration with Divisions & Areas Tab)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock localStorage before any imports that use it
const localStorageMock = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(() => null),
}
Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

// Mock IntersectionObserver for lazy loading components
class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | null = null
  readonly rootMargin: string = ''
  readonly thresholds: ReadonlyArray<number> = []

  constructor(
    callback: (
      entries: IntersectionObserverEntry[],
      observer: IntersectionObserver
    ) => void
  ) {
    // Immediately call callback with all entries as intersecting
    setTimeout(() => {
      callback([], this)
    }, 0)
  }

  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
}

Object.defineProperty(global, 'IntersectionObserver', {
  value: MockIntersectionObserver,
  writable: true,
})
import { screen, render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import DistrictDetailPage from '../DistrictDetailPage'
import { ProgramYearProvider } from '../../contexts/ProgramYearContext'
import { BackfillProvider } from '../../contexts/BackfillContext'

// Extend expect with jest-axe matchers
// @ts-expect-error - jest-axe types are not perfectly compatible with vitest expect
expect.extend(toHaveNoViolations)

// Mock the hooks used by DistrictDetailPage
vi.mock('../../hooks/useDistricts', () => ({
  useDistricts: vi.fn(() => ({
    data: {
      districts: [{ id: 'D101', name: 'Test District 101' }],
    },
    isLoading: false,
    error: null,
  })),
}))

vi.mock('../../hooks/useDistrictData', () => ({
  useDistrictCachedDates: vi.fn(() => ({
    data: { dates: ['2024-01-15', '2024-01-10', '2024-01-05'] },
    isLoading: false,
    error: null,
  })),
}))

vi.mock('../../hooks/useDistrictAnalytics', () => ({
  useDistrictAnalytics: vi.fn(() => ({
    data: {
      allClubs: [],
      interventionRequiredClubs: [],
      vulnerableClubs: [],
      distinguishedClubs: { total: 0 },
      distinguishedProjection: null,
      thrivingClubs: [],
      topGrowthClubs: [],
      membershipTrend: [],
      divisionRankings: [],
      topPerformingAreas: [],
      totalMembership: 0,
    },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })),
}))

vi.mock('../../hooks/useLeadershipInsights', () => ({
  useLeadershipInsights: vi.fn(() => ({
    data: null,
    isLoading: false,
    error: null,
  })),
}))

vi.mock('../../hooks/useDistinguishedClubAnalytics', () => ({
  useDistinguishedClubAnalytics: vi.fn(() => ({
    data: null,
    isLoading: false,
    error: null,
  })),
}))

vi.mock('../../hooks/usePaymentsTrend', () => ({
  usePaymentsTrend: vi.fn(() => ({
    data: null,
    isLoading: false,
    error: null,
  })),
}))

// Import the mock for useDistrictStatistics so we can control it per test
import { useDistrictStatistics } from '../../hooks/useMembershipData'

vi.mock('../../hooks/useMembershipData', () => ({
  useDistrictStatistics: vi.fn(),
  useMembershipHistory: vi.fn(() => ({
    data: null,
    isLoading: false,
    error: null,
  })),
}))

// Mock district statistics data with division and area performance
const createMockDistrictStatistics = () => ({
  districtId: 'D101',
  asOfDate: '2024-01-15T10:30:00Z',
  membership: {
    total: 5000,
    change: 100,
    changePercent: 2.0,
  },
  clubs: {
    total: 100,
    active: 95,
    suspended: 3,
    ineligible: 2,
    low: 5,
    distinguished: 50,
  },
  education: {
    totalAwards: 500,
    byType: [],
    topClubs: [],
    byMonth: [],
  },
  // divisionPerformance contains club-level data that gets grouped by Division/Area
  divisionPerformance: [
    // Division A, Area A1 - 4 clubs
    {
      Club: '100001',
      'Club Name': 'Club A1-1',
      Division: 'A',
      Area: 'A1',
      'Division Club Base': '8',
      'Area Club Base': '4',
      'Nov Visit award': '1',
      'May visit award': '1',
    },
    {
      Club: '100002',
      'Club Name': 'Club A1-2',
      Division: 'A',
      Area: 'A1',
      'Division Club Base': '8',
      'Area Club Base': '4',
      'Nov Visit award': '1',
      'May visit award': '0',
    },
    {
      Club: '100003',
      'Club Name': 'Club A1-3',
      Division: 'A',
      Area: 'A1',
      'Division Club Base': '8',
      'Area Club Base': '4',
      'Nov Visit award': '1',
      'May visit award': '1',
    },
    {
      Club: '100004',
      'Club Name': 'Club A1-4',
      Division: 'A',
      Area: 'A1',
      'Division Club Base': '8',
      'Area Club Base': '4',
      'Nov Visit award': '0',
      'May visit award': '0',
    },
    // Division A, Area A2 - 4 clubs
    {
      Club: '100005',
      'Club Name': 'Club A2-1',
      Division: 'A',
      Area: 'A2',
      'Division Club Base': '8',
      'Area Club Base': '4',
      'Nov Visit award': '1',
      'May visit award': '1',
    },
    {
      Club: '100006',
      'Club Name': 'Club A2-2',
      Division: 'A',
      Area: 'A2',
      'Division Club Base': '8',
      'Area Club Base': '4',
      'Nov Visit award': '1',
      'May visit award': '1',
    },
    {
      Club: '100007',
      'Club Name': 'Club A2-3',
      Division: 'A',
      Area: 'A2',
      'Division Club Base': '8',
      'Area Club Base': '4',
      'Nov Visit award': '1',
      'May visit award': '1',
    },
    {
      Club: '100008',
      'Club Name': 'Club A2-4',
      Division: 'A',
      Area: 'A2',
      'Division Club Base': '8',
      'Area Club Base': '4',
      'Nov Visit award': '1',
      'May visit award': '1',
    },
    // Division B, Area B1 - 5 clubs
    {
      Club: '100009',
      'Club Name': 'Club B1-1',
      Division: 'B',
      Area: 'B1',
      'Division Club Base': '5',
      'Area Club Base': '5',
      'Nov Visit award': '1',
      'May visit award': '1',
    },
    {
      Club: '100010',
      'Club Name': 'Club B1-2',
      Division: 'B',
      Area: 'B1',
      'Division Club Base': '5',
      'Area Club Base': '5',
      'Nov Visit award': '1',
      'May visit award': '1',
    },
    {
      Club: '100011',
      'Club Name': 'Club B1-3',
      Division: 'B',
      Area: 'B1',
      'Division Club Base': '5',
      'Area Club Base': '5',
      'Nov Visit award': '1',
      'May visit award': '0',
    },
    {
      Club: '100012',
      'Club Name': 'Club B1-4',
      Division: 'B',
      Area: 'B1',
      'Division Club Base': '5',
      'Area Club Base': '5',
      'Nov Visit award': '0',
      'May visit award': '0',
    },
    {
      Club: '100013',
      'Club Name': 'Club B1-5',
      Division: 'B',
      Area: 'B1',
      'Division Club Base': '5',
      'Area Club Base': '5',
      'Nov Visit award': '1',
      'May visit award': '1',
    },
  ],
  // clubPerformance contains club status and distinguished status
  clubPerformance: [
    // Division A, Area A1 clubs - 3 active, 2 distinguished
    {
      'Club Number': '100001',
      'Club Name': 'Club A1-1',
      Division: 'A',
      Area: 'A1',
      'Club Status': 'Active',
      'Club Distinguished Status': 'Distinguished',
      'Mem. Base': '20',
      'Active Members': '22',
      'Goals Met': '5',
    },
    {
      'Club Number': '100002',
      'Club Name': 'Club A1-2',
      Division: 'A',
      Area: 'A1',
      'Club Status': 'Active',
      'Club Distinguished Status': 'Select Distinguished',
      'Mem. Base': '15',
      'Active Members': '20',
      'Goals Met': '7',
    },
    {
      'Club Number': '100003',
      'Club Name': 'Club A1-3',
      Division: 'A',
      Area: 'A1',
      'Club Status': 'Active',
      'Club Distinguished Status': '',
      'Mem. Base': '18',
      'Active Members': '19',
      'Goals Met': '3',
    },
    {
      'Club Number': '100004',
      'Club Name': 'Club A1-4',
      Division: 'A',
      Area: 'A1',
      'Club Status': 'Suspended',
      'Club Distinguished Status': '',
      'Mem. Base': '12',
      'Active Members': '8',
      'Goals Met': '1',
    },
    // Division A, Area A2 clubs - 4 active, 3 distinguished
    {
      'Club Number': '100005',
      'Club Name': 'Club A2-1',
      Division: 'A',
      Area: 'A2',
      'Club Status': 'Active',
      'Club Distinguished Status': 'Distinguished',
      'Mem. Base': '20',
      'Active Members': '25',
      'Goals Met': '6',
    },
    {
      'Club Number': '100006',
      'Club Name': 'Club A2-2',
      Division: 'A',
      Area: 'A2',
      'Club Status': 'Active',
      'Club Distinguished Status': 'Select Distinguished',
      'Mem. Base': '22',
      'Active Members': '24',
      'Goals Met': '8',
    },
    {
      'Club Number': '100007',
      'Club Name': 'Club A2-3',
      Division: 'A',
      Area: 'A2',
      'Club Status': 'Active',
      'Club Distinguished Status': "President's Distinguished",
      'Mem. Base': '25',
      'Active Members': '30',
      'Goals Met': '10',
    },
    {
      'Club Number': '100008',
      'Club Name': 'Club A2-4',
      Division: 'A',
      Area: 'A2',
      'Club Status': 'Active',
      'Club Distinguished Status': '',
      'Mem. Base': '18',
      'Active Members': '20',
      'Goals Met': '4',
    },
    // Division B, Area B1 clubs - 4 active, 4 distinguished (100%)
    {
      'Club Number': '100009',
      'Club Name': 'Club B1-1',
      Division: 'B',
      Area: 'B1',
      'Club Status': 'Active',
      'Club Distinguished Status': 'Distinguished',
      'Mem. Base': '20',
      'Active Members': '22',
      'Goals Met': '5',
    },
    {
      'Club Number': '100010',
      'Club Name': 'Club B1-2',
      Division: 'B',
      Area: 'B1',
      'Club Status': 'Active',
      'Club Distinguished Status': 'Distinguished',
      'Mem. Base': '18',
      'Active Members': '20',
      'Goals Met': '6',
    },
    {
      'Club Number': '100011',
      'Club Name': 'Club B1-3',
      Division: 'B',
      Area: 'B1',
      'Club Status': 'Active',
      'Club Distinguished Status': 'Select Distinguished',
      'Mem. Base': '22',
      'Active Members': '25',
      'Goals Met': '7',
    },
    {
      'Club Number': '100012',
      'Club Name': 'Club B1-4',
      Division: 'B',
      Area: 'B1',
      'Club Status': 'Low',
      'Club Distinguished Status': '',
      'Mem. Base': '15',
      'Active Members': '10',
      'Goals Met': '2',
    },
    {
      'Club Number': '100013',
      'Club Name': 'Club B1-5',
      Division: 'B',
      Area: 'B1',
      'Club Status': 'Active',
      'Club Distinguished Status': 'Distinguished',
      'Mem. Base': '20',
      'Active Members': '23',
      'Goals Met': '5',
    },
  ],
})

// Helper to render DistrictDetailPage with all required providers
const renderDistrictDetailPage = (districtId: string = 'D101') => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, cacheTime: 0, staleTime: 0 },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <BackfillProvider>
        <ProgramYearProvider>
          <MemoryRouter initialEntries={[`/districts/${districtId}`]}>
            <Routes>
              <Route
                path="/districts/:districtId"
                element={<DistrictDetailPage />}
              />
            </Routes>
          </MemoryRouter>
        </ProgramYearProvider>
      </BackfillProvider>
    </QueryClientProvider>
  )
}

describe('DistrictDetailPage - Area Recognition Panel Integration', () => {
  const mockUseDistrictStatistics = vi.mocked(useDistrictStatistics)

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset localStorage mock
    localStorageMock.getItem.mockReturnValue(null)
    localStorageMock.setItem.mockClear()
    // Default mock implementation
    mockUseDistrictStatistics.mockReturnValue({
      data: createMockDistrictStatistics(),
      isLoading: false,
      error: null,
      isError: false,
      isSuccess: true,
      status: 'success',
      refetch: vi.fn(),
    } as ReturnType<typeof useDistrictStatistics>)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('AreaRecognitionPanel renders in Divisions & Areas tab (Requirement 1.1)', () => {
    /**
     * Validates: Requirement 1.1
     * WHEN a user views the Divisions & Areas tab, THE System SHALL display
     * an Area Recognition section alongside existing content
     */
    it('should render AreaRecognitionPanel when navigating to Divisions & Areas tab', async () => {
      const user = userEvent.setup()
      renderDistrictDetailPage()

      // Navigate to Divisions & Areas tab
      const divisionsTab = screen.getByRole('button', {
        name: /Divisions & Areas/i,
      })
      await user.click(divisionsTab)

      // Verify AreaRecognitionPanel is rendered
      await waitFor(() => {
        expect(screen.getByText('Area Recognition')).toBeInTheDocument()
      })

      // Verify the section description is present
      expect(
        screen.getByText(/Track progress toward Distinguished Area Program/i)
      ).toBeInTheDocument()
    })

    /**
     * Validates: Requirement 1.1
     * The CriteriaExplanation component should be rendered within the panel
     */
    it('should render CriteriaExplanation component in the tab', async () => {
      const user = userEvent.setup()
      renderDistrictDetailPage()

      // Navigate to Divisions & Areas tab
      const divisionsTab = screen.getByRole('button', {
        name: /Divisions & Areas/i,
      })
      await user.click(divisionsTab)

      // Verify CriteriaExplanation toggle button is present
      await waitFor(() => {
        expect(
          screen.getByRole('button', {
            name: /Distinguished Area Program Criteria/i,
          })
        ).toBeInTheDocument()
      })
    })

    /**
     * Validates: Requirement 1.1
     * The AreaProgressTable component should be rendered within the panel
     */
    it('should render AreaProgressTable component in the tab', async () => {
      const user = userEvent.setup()
      renderDistrictDetailPage()

      // Navigate to Divisions & Areas tab
      const divisionsTab = screen.getByRole('button', {
        name: /Divisions & Areas/i,
      })
      await user.click(divisionsTab)

      // Verify AreaProgressTable is present (has role="grid")
      await waitFor(() => {
        expect(
          screen.getByRole('grid', { name: /area progress table/i })
        ).toBeInTheDocument()
      })
    })

    /**
     * Validates: Requirement 1.1
     * The panel should be positioned alongside DivisionPerformanceCards
     */
    it('should render alongside DivisionPerformanceCards', async () => {
      const user = userEvent.setup()
      renderDistrictDetailPage()

      // Navigate to Divisions & Areas tab
      const divisionsTab = screen.getByRole('button', {
        name: /Divisions & Areas/i,
      })
      await user.click(divisionsTab)

      // Verify both components are rendered
      await waitFor(() => {
        // DivisionPerformanceCards header
        expect(
          screen.getByText('Division & Area Performance')
        ).toBeInTheDocument()
        // AreaRecognitionPanel header
        expect(screen.getByText('Area Recognition')).toBeInTheDocument()
      })
    })
  })

  describe('Data flows correctly from page to component (Requirement 1.1)', () => {
    /**
     * Validates: Requirement 1.1
     * Data from districtStatistics should flow to AreaRecognitionPanel
     */
    it('should display all areas from districtStatistics data', async () => {
      const user = userEvent.setup()
      renderDistrictDetailPage()

      // Navigate to Divisions & Areas tab
      const divisionsTab = screen.getByRole('button', {
        name: /Divisions & Areas/i,
      })
      await user.click(divisionsTab)

      // Verify all areas are displayed (A1, A2, B1)
      // Use getAllByText since areas appear in multiple components
      await waitFor(() => {
        const a1Elements = screen.getAllByText('A1')
        const a2Elements = screen.getAllByText('A2')
        const b1Elements = screen.getAllByText('B1')

        expect(a1Elements.length).toBeGreaterThan(0)
        expect(a2Elements.length).toBeGreaterThan(0)
        expect(b1Elements.length).toBeGreaterThan(0)
      })
    })

    /**
     * Validates: Requirement 1.1
     * Division context should be preserved for each area
     */
    it('should display division context for each area', async () => {
      const user = userEvent.setup()
      renderDistrictDetailPage()

      // Navigate to Divisions & Areas tab
      const divisionsTab = screen.getByRole('button', {
        name: /Divisions & Areas/i,
      })
      await user.click(divisionsTab)

      // Verify division labels are displayed in the AreaProgressTable
      // The table shows "Division A" and "Division B" as row labels
      await waitFor(() => {
        // Look for division labels in the table - they appear as cell content
        const divisionACells = screen.getAllByText(/Division A/i)
        const divisionBCells = screen.getAllByText(/Division B/i)
        expect(divisionACells.length).toBeGreaterThan(0)
        expect(divisionBCells.length).toBeGreaterThan(0)
      })
    })

    /**
     * Validates: Requirement 1.1
     * Area metrics should be calculated and displayed correctly
     */
    it('should display correct area metrics from data', async () => {
      const user = userEvent.setup()
      renderDistrictDetailPage()

      // Navigate to Divisions & Areas tab
      const divisionsTab = screen.getByRole('button', {
        name: /Divisions & Areas/i,
      })
      await user.click(divisionsTab)

      // Wait for the table to render
      await waitFor(() => {
        expect(
          screen.getByRole('grid', { name: /area progress table/i })
        ).toBeInTheDocument()
      })

      // Verify summary footer shows correct counts
      // 3 areas (A1, A2, B1) across 2 divisions (A, B)
      expect(
        screen.getByText(/Showing 3 areas across 2 divisions/)
      ).toBeInTheDocument()
    })

    /**
     * Validates: Requirement 1.1
     * extractDivisionPerformance utility should correctly process the data
     */
    it('should correctly extract and display paid clubs data', async () => {
      const user = userEvent.setup()
      renderDistrictDetailPage()

      // Navigate to Divisions & Areas tab
      const divisionsTab = screen.getByRole('button', {
        name: /Divisions & Areas/i,
      })
      await user.click(divisionsTab)

      // Wait for the table to render
      await waitFor(() => {
        expect(
          screen.getByRole('grid', { name: /area progress table/i })
        ).toBeInTheDocument()
      })

      // Area A1: 3 active clubs out of 4 total (club 100004 is Suspended)
      // Area A2: 4 active clubs out of 4 total
      // Area B1: 4 active clubs out of 5 total (club 100012 is Low)
      // The table should show paid/total ratios - use getAllByText since values may appear multiple times
      const threeOfFour = screen.getAllByText('3/4')
      const fourOfFour = screen.getAllByText('4/4')
      const fourOfFive = screen.getAllByText('4/5')

      expect(threeOfFour.length).toBeGreaterThan(0) // A1: 3 paid / 4 total
      expect(fourOfFour.length).toBeGreaterThan(0) // A2: 4 paid / 4 total
      expect(fourOfFive.length).toBeGreaterThan(0) // B1: 4 paid / 5 total
    })
  })

  describe('Loading state is passed correctly (Requirement 1.1)', () => {
    /**
     * Validates: Requirement 1.1
     * Loading state should be passed to AreaRecognitionPanel
     */
    it('should show loading state when data is loading', async () => {
      // Mock loading state
      mockUseDistrictStatistics.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        isError: false,
        isSuccess: false,
        status: 'loading',
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useDistrictStatistics>)

      const user = userEvent.setup()
      renderDistrictDetailPage()

      // Navigate to Divisions & Areas tab
      const divisionsTab = screen.getByRole('button', {
        name: /Divisions & Areas/i,
      })
      await user.click(divisionsTab)

      // Verify loading state is shown - look for loading indicators
      // The DivisionPerformanceCards component shows loading state
      await waitFor(() => {
        // Look for loading text or loading indicators
        const loadingText = screen.queryByText(/Loading/i)
        const loadingIndicators = screen.queryAllByRole('status')
        expect(loadingText || loadingIndicators.length > 0).toBeTruthy()
      })
    })

    /**
     * Validates: Requirement 1.1
     * Content should render after loading completes
     */
    it('should render content after loading completes', async () => {
      const user = userEvent.setup()
      renderDistrictDetailPage()

      // Navigate to Divisions & Areas tab
      const divisionsTab = screen.getByRole('button', {
        name: /Divisions & Areas/i,
      })
      await user.click(divisionsTab)

      // Verify content is rendered (not loading)
      await waitFor(() => {
        expect(screen.getByText('Area Recognition')).toBeInTheDocument()
        expect(
          screen.queryByText('Loading division performance data...')
        ).not.toBeInTheDocument()
      })
    })
  })

  describe('Empty state handling', () => {
    /**
     * Tests empty state when no division data is available
     */
    it('should handle empty division data gracefully', async () => {
      // Mock empty data
      mockUseDistrictStatistics.mockReturnValue({
        data: {
          ...createMockDistrictStatistics(),
          divisionPerformance: [],
          clubPerformance: [],
        },
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: true,
        status: 'success',
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useDistrictStatistics>)

      const user = userEvent.setup()
      renderDistrictDetailPage()

      // Navigate to Divisions & Areas tab
      const divisionsTab = screen.getByRole('button', {
        name: /Divisions & Areas/i,
      })
      await user.click(divisionsTab)

      // Verify empty state is shown for AreaRecognitionPanel
      await waitFor(() => {
        expect(screen.getByText('No Area Data Available')).toBeInTheDocument()
      })
    })

    /**
     * Tests that null data is handled gracefully
     */
    it('should handle null districtStatistics gracefully', async () => {
      // Mock null data
      mockUseDistrictStatistics.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: false,
        status: 'idle',
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useDistrictStatistics>)

      const user = userEvent.setup()
      renderDistrictDetailPage()

      // Navigate to Divisions & Areas tab
      const divisionsTab = screen.getByRole('button', {
        name: /Divisions & Areas/i,
      })
      await user.click(divisionsTab)

      // When districtStatistics is null, the components should not render
      // or should show an appropriate empty/no data state
      await waitFor(() => {
        // AreaRecognitionPanel should not be rendered when there's no data
        // The page conditionally renders based on districtStatistics
        const areaRecognitionSection = screen.queryByText('Area Recognition')
        // Either no Area Recognition section, or a "No Data" message
        const noDataMessage =
          screen.queryByText(/No Data/i) || screen.queryByText(/No.*Available/i)
        expect(
          areaRecognitionSection === null || noDataMessage !== null
        ).toBeTruthy()
      })
    })
  })

  describe('Accessibility', () => {
    /**
     * Tests accessibility compliance for the Divisions & Areas tab
     */
    it('should have no accessibility violations in Divisions & Areas tab', async () => {
      const user = userEvent.setup()
      const { container } = renderDistrictDetailPage()

      // Navigate to Divisions & Areas tab
      const divisionsTab = screen.getByRole('button', {
        name: /Divisions & Areas/i,
      })
      await user.click(divisionsTab)

      // Wait for content to render
      await waitFor(() => {
        expect(screen.getByText('Area Recognition')).toBeInTheDocument()
      })

      // Run axe accessibility tests
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    /**
     * Tests that AreaRecognitionPanel has proper ARIA attributes
     */
    it('should have proper ARIA attributes on AreaRecognitionPanel', async () => {
      const user = userEvent.setup()
      renderDistrictDetailPage()

      // Navigate to Divisions & Areas tab
      const divisionsTab = screen.getByRole('button', {
        name: /Divisions & Areas/i,
      })
      await user.click(divisionsTab)

      // Verify ARIA region is present
      await waitFor(() => {
        const region = screen.getByRole('region', { name: /area recognition/i })
        expect(region).toBeInTheDocument()
      })
    })
  })
})
