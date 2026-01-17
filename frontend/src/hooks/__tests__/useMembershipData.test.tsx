/**
 * Unit tests for useMembershipData hooks
 * Feature: date-aware-district-statistics
 *
 * Validates: Requirements 4.1
 *
 * These tests verify that the useDistrictStatistics hook correctly:
 * - Includes selectedDate in the query key for proper cache invalidation
 * - Passes the date query parameter to the API when selectedDate is provided
 * - Maintains backward compatibility when selectedDate is undefined
 * - Handles API errors appropriately
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'
import { useDistrictStatistics } from '../useMembershipData'
import { apiClient } from '../../services/api'
import type { DistrictStatistics } from '../../types/districts'

// Mock the API client
vi.mock('../../services/api', () => ({
  apiClient: {
    get: vi.fn(),
  },
}))

// Type the mocked apiClient
const mockedApiClient = vi.mocked(apiClient)

// Create a mock DistrictStatistics response
const createMockDistrictStatistics = (
  districtId: string,
  asOfDate: string
): DistrictStatistics => ({
  districtId,
  asOfDate,
  membership: {
    totalMembers: 1000,
    activeMembers: 950,
    newMembers: 50,
    renewedMembers: 100,
    droppedMembers: 25,
    membershipGrowth: 2.5,
    retentionRate: 95.0,
  },
  clubs: {
    totalClubs: 50,
    activeClubs: 48,
    suspendedClubs: 2,
    newClubs: 3,
    clubGrowth: 1.5,
  },
  education: {
    totalAwards: 200,
    pathwaysCompletions: 150,
    traditionalCompletions: 50,
    educationGrowth: 5.0,
  },
})

// Create a wrapper with QueryClientProvider for testing hooks
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

describe('useDistrictStatistics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Query Key Behavior', () => {
    /**
     * Test that selectedDate is included in query key when provided
     * This ensures proper cache invalidation when the date changes
     *
     * **Validates: Requirements 4.1 (cache invalidation)**
     */
    it('should include selectedDate in query key when provided', async () => {
      const districtId = 'D101'
      const selectedDate = '2026-01-14'
      const mockData = createMockDistrictStatistics(districtId, selectedDate)

      mockedApiClient.get.mockResolvedValueOnce({ data: mockData })

      const { result } = renderHook(
        () => useDistrictStatistics(districtId, selectedDate),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      // Verify the API was called with the correct parameters
      expect(mockedApiClient.get).toHaveBeenCalledWith(
        `/districts/${districtId}/statistics`,
        {
          params: { date: selectedDate },
        }
      )
    })

    /**
     * Test that query key works correctly when selectedDate is undefined
     * This ensures backward compatibility with existing code
     *
     * **Validates: Requirements 4.1, Property 3 (backward compatibility)**
     */
    it('should work correctly when selectedDate is undefined', async () => {
      const districtId = 'D101'
      const mockData = createMockDistrictStatistics(districtId, '2022-12-05')

      mockedApiClient.get.mockResolvedValueOnce({ data: mockData })

      const { result } = renderHook(
        () => useDistrictStatistics(districtId, undefined),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      // Verify the API was called without date parameter
      expect(mockedApiClient.get).toHaveBeenCalledWith(
        `/districts/${districtId}/statistics`,
        {
          params: undefined,
        }
      )
    })

    /**
     * Test that different dates result in different cache entries
     * by verifying separate API calls are made for different dates
     *
     * **Validates: Requirements 4.1, Property 2 (query key uniqueness)**
     */
    it('should make separate API calls for different dates', async () => {
      const districtId = 'D101'
      const date1 = '2026-01-14'
      const date2 = '2026-01-15'
      const mockData1 = createMockDistrictStatistics(districtId, date1)
      const mockData2 = createMockDistrictStatistics(districtId, date2)

      mockedApiClient.get
        .mockResolvedValueOnce({ data: mockData1 })
        .mockResolvedValueOnce({ data: mockData2 })

      const wrapper = createWrapper()

      // First hook with date1
      const { result: result1 } = renderHook(
        () => useDistrictStatistics(districtId, date1),
        { wrapper }
      )

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true)
      })

      // Second hook with date2 (different date should trigger new API call)
      const { result: result2 } = renderHook(
        () => useDistrictStatistics(districtId, date2),
        { wrapper }
      )

      await waitFor(() => {
        expect(result2.current.isSuccess).toBe(true)
      })

      // Verify both API calls were made with different dates
      expect(mockedApiClient.get).toHaveBeenCalledTimes(2)
      expect(mockedApiClient.get).toHaveBeenNthCalledWith(
        1,
        `/districts/${districtId}/statistics`,
        { params: { date: date1 } }
      )
      expect(mockedApiClient.get).toHaveBeenNthCalledWith(
        2,
        `/districts/${districtId}/statistics`,
        { params: { date: date2 } }
      )
    })
  })

  describe('API Parameter Passing', () => {
    /**
     * Test that date query parameter is passed to API when selectedDate is provided
     *
     * **Validates: Requirements 4.1, Property 1 (date parameter propagation)**
     */
    it('should pass date query parameter to API when selectedDate is provided', async () => {
      const districtId = 'D101'
      const selectedDate = '2026-01-14'
      const mockData = createMockDistrictStatistics(districtId, selectedDate)

      mockedApiClient.get.mockResolvedValueOnce({ data: mockData })

      const { result } = renderHook(
        () => useDistrictStatistics(districtId, selectedDate),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      // Verify the API was called with date parameter
      expect(mockedApiClient.get).toHaveBeenCalledWith(
        `/districts/${districtId}/statistics`,
        expect.objectContaining({
          params: { date: selectedDate },
        })
      )
    })

    /**
     * Test that date parameter is NOT passed when selectedDate is undefined
     *
     * **Validates: Requirements 4.1, Property 3 (backward compatibility)**
     */
    it('should NOT pass date parameter when selectedDate is undefined', async () => {
      const districtId = 'D101'
      const mockData = createMockDistrictStatistics(districtId, '2022-12-05')

      mockedApiClient.get.mockResolvedValueOnce({ data: mockData })

      const { result } = renderHook(() => useDistrictStatistics(districtId), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      // Verify the API was called with params: undefined (no date parameter)
      expect(mockedApiClient.get).toHaveBeenCalledWith(
        `/districts/${districtId}/statistics`,
        { params: undefined }
      )
    })

    /**
     * Test that empty string selectedDate is treated as falsy (no date param)
     *
     * **Validates: Requirements 4.1**
     */
    it('should NOT pass date parameter when selectedDate is empty string', async () => {
      const districtId = 'D101'
      const mockData = createMockDistrictStatistics(districtId, '2022-12-05')

      mockedApiClient.get.mockResolvedValueOnce({ data: mockData })

      const { result } = renderHook(
        () => useDistrictStatistics(districtId, ''),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      // Empty string is falsy, so params should be undefined
      expect(mockedApiClient.get).toHaveBeenCalledWith(
        `/districts/${districtId}/statistics`,
        { params: undefined }
      )
    })
  })

  describe('Backward Compatibility', () => {
    /**
     * Test that hook works without selectedDate parameter (original signature)
     *
     * **Validates: Requirements 6.2, Property 3 (backward compatibility)**
     */
    it('should work when called with only districtId (backward compatible)', async () => {
      const districtId = 'D101'
      const mockData = createMockDistrictStatistics(districtId, '2022-12-05')

      mockedApiClient.get.mockResolvedValueOnce({ data: mockData })

      const { result } = renderHook(() => useDistrictStatistics(districtId), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockData)
    })

    /**
     * Test that hook returns latest snapshot when no date is provided
     *
     * **Validates: Requirements 6.2**
     */
    it('should return data successfully when no date is provided', async () => {
      const districtId = 'D101'
      const latestDate = '2022-12-05'
      const mockData = createMockDistrictStatistics(districtId, latestDate)

      mockedApiClient.get.mockResolvedValueOnce({ data: mockData })

      const { result } = renderHook(() => useDistrictStatistics(districtId), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data?.asOfDate).toBe(latestDate)
    })
  })

  describe('Error Handling', () => {
    /**
     * Test that API errors are properly propagated
     * Note: The hook has retry: 2, so we need to reject all retry attempts
     *
     * **Validates: Requirements 4.1**
     */
    it('should handle API errors correctly', async () => {
      const districtId = 'D101'
      const selectedDate = '2026-01-14'
      const errorMessage = 'Network error'

      // Mock rejection for all retry attempts (initial + 2 retries = 3 calls)
      mockedApiClient.get.mockRejectedValue(new Error(errorMessage))

      const { result } = renderHook(
        () => useDistrictStatistics(districtId, selectedDate),
        { wrapper: createWrapper() }
      )

      await waitFor(
        () => {
          expect(result.current.isError).toBe(true)
        },
        { timeout: 5000 }
      )

      expect(result.current.error?.message).toBe(errorMessage)
    })

    /**
     * Test that 404 errors are handled (district not found)
     * Note: The hook has retry: 2, so we need to reject all retry attempts
     *
     * **Validates: Requirements 5.2**
     */
    it('should handle 404 errors for non-existent districts', async () => {
      const districtId = 'INVALID'
      const selectedDate = '2026-01-14'

      const error = new Error('District not found')
      // Mock rejection for all retry attempts
      mockedApiClient.get.mockRejectedValue(error)

      const { result } = renderHook(
        () => useDistrictStatistics(districtId, selectedDate),
        { wrapper: createWrapper() }
      )

      await waitFor(
        () => {
          expect(result.current.isError).toBe(true)
        },
        { timeout: 5000 }
      )

      expect(result.current.error).toBeDefined()
    })

    /**
     * Test that invalid date format errors are handled
     * Note: The hook has retry: 2, so we need to reject all retry attempts
     *
     * **Validates: Requirements 4.3, Property 4**
     */
    it('should handle invalid date format errors from API', async () => {
      const districtId = 'D101'
      const invalidDate = 'invalid-date'

      const error = new Error('Date must be in YYYY-MM-DD format')
      // Mock rejection for all retry attempts
      mockedApiClient.get.mockRejectedValue(error)

      const { result } = renderHook(
        () => useDistrictStatistics(districtId, invalidDate),
        { wrapper: createWrapper() }
      )

      await waitFor(
        () => {
          expect(result.current.isError).toBe(true)
        },
        { timeout: 5000 }
      )

      expect(result.current.error?.message).toContain('YYYY-MM-DD')
    })
  })

  describe('Query Enabled State', () => {
    /**
     * Test that query is disabled when districtId is null
     *
     * **Validates: Requirements 4.1**
     */
    it('should not fetch when districtId is null', async () => {
      const { result } = renderHook(
        () => useDistrictStatistics(null, '2026-01-14'),
        { wrapper: createWrapper() }
      )

      // Query should not be enabled
      expect(result.current.fetchStatus).toBe('idle')
      expect(mockedApiClient.get).not.toHaveBeenCalled()
    })

    /**
     * Test that query is enabled when districtId is provided
     *
     * **Validates: Requirements 4.1**
     */
    it('should fetch when districtId is provided', async () => {
      const districtId = 'D101'
      const mockData = createMockDistrictStatistics(districtId, '2026-01-14')

      mockedApiClient.get.mockResolvedValueOnce({ data: mockData })

      const { result } = renderHook(
        () => useDistrictStatistics(districtId, '2026-01-14'),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockedApiClient.get).toHaveBeenCalled()
    })
  })

  describe('Data Returned', () => {
    /**
     * Test that the hook returns the correct data structure
     *
     * **Validates: Requirements 4.1**
     */
    it('should return DistrictStatistics data on success', async () => {
      const districtId = 'D101'
      const selectedDate = '2026-01-14'
      const mockData = createMockDistrictStatistics(districtId, selectedDate)

      mockedApiClient.get.mockResolvedValueOnce({ data: mockData })

      const { result } = renderHook(
        () => useDistrictStatistics(districtId, selectedDate),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockData)
      expect(result.current.data?.districtId).toBe(districtId)
      expect(result.current.data?.asOfDate).toBe(selectedDate)
    })
  })
})
