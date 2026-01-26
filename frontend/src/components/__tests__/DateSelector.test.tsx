/**
 * Unit tests for DateSelector error handling
 * Feature: firestore-index-fix
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4
 *
 * These tests verify that the DateSelector component correctly:
 * - Displays error state with user-friendly message on API failure (3.1)
 * - Displays empty state when no dates are available (3.2)
 * - Provides a retry button that triggers refetch (3.3)
 * - Does not display loading spinner indefinitely when API fails (3.4)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'
import { render } from '@testing-library/react'
import DateSelector from '../DateSelector'
import { apiClient } from '../../services/api'
import type { AvailableDatesResponse } from '../../types/districts'

// Mock the API client
vi.mock('../../services/api', () => ({
  apiClient: {
    get: vi.fn(),
  },
}))

// Type the mocked apiClient
const mockedApiClient = vi.mocked(apiClient)

// Create a mock AvailableDatesResponse with dates
const createMockDatesResponse = (): AvailableDatesResponse => ({
  dates: [
    { date: '2024-01-15', month: 1, day: 15, monthName: 'January' },
    { date: '2024-01-20', month: 1, day: 20, monthName: 'January' },
    { date: '2024-02-10', month: 2, day: 10, monthName: 'February' },
  ],
  programYear: {
    year: '2023-2024',
    startDate: '2023-07-01',
    endDate: '2024-06-30',
  },
})

// Create an empty dates response
const createEmptyDatesResponse = (): AvailableDatesResponse => ({
  dates: [],
  programYear: {
    year: '2023-2024',
    startDate: '2023-07-01',
    endDate: '2024-06-30',
  },
})

// Create a wrapper with QueryClientProvider for testing
// Note: retry: false ensures errors are immediately propagated without retries
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
    },
  })

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

// Helper to render DateSelector with providers
const renderDateSelector = (onDateChange = vi.fn(), selectedDate?: string) => {
  const wrapper = createWrapper()
  return render(
    <DateSelector onDateChange={onDateChange} selectedDate={selectedDate} />,
    { wrapper }
  )
}

// Extended timeout for error state tests (React Query needs time to process)
const ERROR_TIMEOUT = { timeout: 5000 }

describe('DateSelector Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Suppress console.error for cleaner test output
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Error State Rendering', () => {
    /**
     * Test that error state renders on API failure
     *
     * **Validates: Requirement 3.1**
     * WHEN the available dates API returns an error
     * THEN THE Date_Selector SHALL display an error state with a user-friendly message
     */
    it('should display error state with user-friendly message on API failure', async () => {
      const errorMessage = 'Network error'
      mockedApiClient.get.mockRejectedValue(new Error(errorMessage))

      renderDateSelector()

      // Wait for error state to appear (with extended timeout for React Query processing)
      await waitFor(() => {
        expect(
          screen.getByText('Unable to load available dates. Please try again.')
        ).toBeInTheDocument()
      }, ERROR_TIMEOUT)

      // Verify error alert is present with proper role
      const alert = screen.getByRole('alert')
      expect(alert).toBeInTheDocument()
    })

    /**
     * Test that error state includes error icon
     *
     * **Validates: Requirement 3.1**
     */
    it('should display error icon in error state', async () => {
      mockedApiClient.get.mockRejectedValue(new Error('API Error'))

      const { container } = renderDateSelector()

      await waitFor(() => {
        expect(
          screen.getByText('Unable to load available dates. Please try again.')
        ).toBeInTheDocument()
      }, ERROR_TIMEOUT)

      // Check for SVG error icon
      const svg = container.querySelector('svg')
      expect(svg).toBeInTheDocument()
    })
  })

  describe('Empty State Rendering', () => {
    /**
     * Test that empty state renders when no dates are available
     *
     * **Validates: Requirement 3.2**
     * WHEN the available dates API returns an empty array
     * THEN THE Date_Selector SHALL display a message indicating no dates are available
     */
    it('should display empty state message when no dates are available', async () => {
      mockedApiClient.get.mockResolvedValue({
        data: createEmptyDatesResponse(),
      })

      renderDateSelector()

      await waitFor(() => {
        expect(
          screen.getByText(
            'No dates available. Data may not have been collected yet.'
          )
        ).toBeInTheDocument()
      })

      // Verify status role is present
      const status = screen.getByRole('status')
      expect(status).toBeInTheDocument()
    })

    /**
     * Test that empty state includes calendar icon
     *
     * **Validates: Requirement 3.2**
     */
    it('should display calendar icon in empty state', async () => {
      mockedApiClient.get.mockResolvedValue({
        data: createEmptyDatesResponse(),
      })

      const { container } = renderDateSelector()

      await waitFor(() => {
        expect(
          screen.getByText(
            'No dates available. Data may not have been collected yet.'
          )
        ).toBeInTheDocument()
      })

      // Check for SVG calendar icon
      const svg = container.querySelector('svg')
      expect(svg).toBeInTheDocument()
    })
  })

  describe('Retry Button Functionality', () => {
    /**
     * Test that retry button is displayed in error state
     *
     * **Validates: Requirement 3.3**
     * WHEN the Date_Selector is in an error state
     * THEN THE Date_Selector SHALL provide a retry button
     */
    it('should display retry button when in error state', async () => {
      mockedApiClient.get.mockRejectedValue(new Error('API Error'))

      renderDateSelector()

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /retry/i })
        ).toBeInTheDocument()
      }, ERROR_TIMEOUT)
    })

    /**
     * Test that retry button triggers refetch
     *
     * **Validates: Requirement 3.3**
     * WHEN the retry button is clicked
     * THEN the Date_Selector SHALL attempt to fetch dates again
     */
    it('should trigger refetch when retry button is clicked', async () => {
      // First call fails
      mockedApiClient.get.mockRejectedValueOnce(new Error('API Error'))

      renderDateSelector()

      // Wait for error state
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /retry/i })
        ).toBeInTheDocument()
      }, ERROR_TIMEOUT)

      // Clear mock to track retry call
      mockedApiClient.get.mockClear()
      // Second call succeeds
      mockedApiClient.get.mockResolvedValue({
        data: createMockDatesResponse(),
      })

      // Click retry button
      const retryButton = screen.getByRole('button', { name: /retry/i })
      fireEvent.click(retryButton)

      // Verify API was called again
      await waitFor(() => {
        expect(mockedApiClient.get).toHaveBeenCalledWith(
          '/districts/available-dates'
        )
      }, ERROR_TIMEOUT)
    })

    /**
     * Test that retry button has proper accessibility label
     *
     * **Validates: Requirement 3.3**
     */
    it('should have accessible retry button with aria-label', async () => {
      mockedApiClient.get.mockRejectedValue(new Error('API Error'))

      renderDateSelector()

      await waitFor(() => {
        const retryButton = screen.getByRole('button', { name: /retry/i })
        expect(retryButton).toHaveAttribute(
          'aria-label',
          'Retry loading available dates'
        )
      }, ERROR_TIMEOUT)
    })

    /**
     * Test that successful retry clears error state and shows dates
     *
     * **Validates: Requirement 3.3**
     */
    it('should clear error state and show dates after successful retry', async () => {
      // First call fails
      mockedApiClient.get.mockRejectedValueOnce(new Error('API Error'))

      renderDateSelector()

      // Wait for error state
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /retry/i })
        ).toBeInTheDocument()
      }, ERROR_TIMEOUT)

      // Second call succeeds
      mockedApiClient.get.mockResolvedValue({
        data: createMockDatesResponse(),
      })

      // Click retry button
      const retryButton = screen.getByRole('button', { name: /retry/i })
      fireEvent.click(retryButton)

      // Wait for successful state - should show month selector
      await waitFor(() => {
        expect(screen.getByLabelText('Select month')).toBeInTheDocument()
      }, ERROR_TIMEOUT)

      // Error message should be gone
      expect(
        screen.queryByText('Unable to load available dates. Please try again.')
      ).not.toBeInTheDocument()
    })
  })

  describe('Loading State Transitions', () => {
    /**
     * Test that loading state is shown initially
     *
     * **Validates: Requirement 3.4**
     */
    it('should show loading state initially while fetching', async () => {
      // Create a delayed response
      mockedApiClient.get.mockImplementation(
        () =>
          new Promise(resolve =>
            setTimeout(() => resolve({ data: createMockDatesResponse() }), 100)
          )
      )

      const { container } = renderDateSelector()

      // Should show loading skeleton
      const loadingElements = container.querySelectorAll('.animate-pulse')
      expect(loadingElements.length).toBeGreaterThan(0)
    })

    /**
     * Test that loading state transitions to error state (not infinite loading)
     *
     * **Validates: Requirement 3.4**
     * THE Date_Selector SHALL NOT display a loading spinner indefinitely when the API fails
     */
    it('should transition from loading to error state on API failure', async () => {
      mockedApiClient.get.mockRejectedValue(new Error('API Error'))

      const { container } = renderDateSelector()

      // Initially may show loading
      // Wait for error state to appear
      await waitFor(() => {
        expect(
          screen.getByText('Unable to load available dates. Please try again.')
        ).toBeInTheDocument()
      }, ERROR_TIMEOUT)

      // Loading skeleton should be gone
      const loadingElements = container.querySelectorAll('.animate-pulse')
      expect(loadingElements.length).toBe(0)
    })

    /**
     * Test that loading state transitions to empty state
     *
     * **Validates: Requirement 3.4**
     */
    it('should transition from loading to empty state when no dates', async () => {
      mockedApiClient.get.mockResolvedValue({
        data: createEmptyDatesResponse(),
      })

      const { container } = renderDateSelector()

      // Wait for empty state
      await waitFor(() => {
        expect(
          screen.getByText(
            'No dates available. Data may not have been collected yet.'
          )
        ).toBeInTheDocument()
      })

      // Loading skeleton should be gone
      const loadingElements = container.querySelectorAll('.animate-pulse')
      expect(loadingElements.length).toBe(0)
    })

    /**
     * Test that loading state transitions to success state
     *
     * **Validates: Requirement 3.4**
     */
    it('should transition from loading to success state with dates', async () => {
      mockedApiClient.get.mockResolvedValue({
        data: createMockDatesResponse(),
      })

      const { container } = renderDateSelector()

      // Wait for success state - should show month selector
      await waitFor(() => {
        expect(screen.getByLabelText('Select month')).toBeInTheDocument()
      })

      // Loading skeleton should be gone
      const loadingElements = container.querySelectorAll('.animate-pulse')
      expect(loadingElements.length).toBe(0)
    })
  })

  describe('Error Logging', () => {
    /**
     * Test that errors are logged for debugging
     *
     * **Validates: Requirement 3.5**
     * WHEN the Date_Selector encounters an error
     * THEN THE Date_Selector SHALL log the error details for debugging purposes
     */
    it('should log error details when API fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error')
      const errorMessage = 'Network connection failed'
      mockedApiClient.get.mockRejectedValue(new Error(errorMessage))

      renderDateSelector()

      // Wait for error state
      await waitFor(() => {
        expect(
          screen.getByText('Unable to load available dates. Please try again.')
        ).toBeInTheDocument()
      }, ERROR_TIMEOUT)

      // Verify error was logged
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          '[DateSelector] Failed to load available dates:',
          expect.objectContaining({
            error: errorMessage,
            timestamp: expect.any(String),
          })
        )
      }, ERROR_TIMEOUT)
    })
  })

  describe('Retry Limit', () => {
    /**
     * Test that retry count is bounded (not infinite)
     *
     * **Validates: Requirement 3.4**
     * The query should have limited retries to prevent infinite retry loops
     */
    it('should have bounded retry count configured', async () => {
      // Track how many times the API is called
      let callCount = 0
      mockedApiClient.get.mockImplementation(() => {
        callCount++
        return Promise.reject(new Error('Persistent error'))
      })

      renderDateSelector()

      // Wait for error state to appear (after retries are exhausted)
      await waitFor(
        () => {
          expect(
            screen.getByText(
              'Unable to load available dates. Please try again.'
            )
          ).toBeInTheDocument()
        },
        { timeout: 5000 }
      )

      // The component has retry: 2 configured, so we expect:
      // 1 initial call + 2 retries = 3 total calls maximum
      expect(callCount).toBeLessThanOrEqual(3)
    })
  })
})
