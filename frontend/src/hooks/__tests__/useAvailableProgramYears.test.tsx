/**
 * Unit tests for useAvailableProgramYears hook
 * Feature: district-global-rankings
 *
 * Validates: Requirements 2.1, 2.3
 *
 * These tests verify that the useAvailableProgramYears hook correctly:
 * - Fetches available program years for a district
 * - Returns loading, error, and success states appropriately
 * - Handles API errors gracefully
 * - Respects the enabled flag
 * - Provides a refetch function
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'
import {
  useAvailableProgramYears,
  availableProgramYearsQueryKeys,
} from '../useAvailableProgramYears'
import { apiClient } from '../../services/api'
import type { AvailableRankingYearsResponse } from '../../types/districts'

// Mock the API client
vi.mock('../../services/api', () => ({
  apiClient: {
    get: vi.fn(),
  },
}))

// Type the mocked apiClient
const mockedApiClient = vi.mocked(apiClient)

// Create a mock AvailableRankingYearsResponse
const createMockResponse = (
  districtId: string
): AvailableRankingYearsResponse => ({
  districtId,
  programYears: [
    {
      year: '2024-2025',
      startDate: '2024-07-01',
      endDate: '2025-06-30',
      hasCompleteData: false,
      snapshotCount: 15,
      latestSnapshotDate: '2024-11-15',
    },
    {
      year: '2023-2024',
      startDate: '2023-07-01',
      endDate: '2024-06-30',
      hasCompleteData: true,
      snapshotCount: 52,
      latestSnapshotDate: '2024-06-30',
    },
    {
      year: '2022-2023',
      startDate: '2022-07-01',
      endDate: '2023-06-30',
      hasCompleteData: true,
      snapshotCount: 48,
      latestSnapshotDate: '2023-06-30',
    },
  ],
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

describe('useAvailableProgramYears', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Query Key Factory', () => {
    /**
     * Test that query key factory produces correct keys
     *
     * **Validates: Requirements 2.1**
     */
    it('should produce correct query keys', () => {
      expect(availableProgramYearsQueryKeys.all).toEqual([
        'available-ranking-years',
      ])
      expect(availableProgramYearsQueryKeys.byDistrict('57')).toEqual([
        'available-ranking-years',
        '57',
      ])
    })
  })

  describe('Successful Data Fetching', () => {
    /**
     * Test that hook fetches and returns program years data
     *
     * **Validates: Requirements 2.1 (display program year selector)**
     */
    it('should fetch available program years for a district', async () => {
      const districtId = '57'
      const mockData = createMockResponse(districtId)

      mockedApiClient.get.mockResolvedValueOnce({ data: mockData })

      const { result } = renderHook(
        () => useAvailableProgramYears({ districtId }),
        { wrapper: createWrapper() }
      )

      // Initially loading
      expect(result.current.isLoading).toBe(true)

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Verify successful response
      expect(result.current.data).toEqual(mockData)
      expect(result.current.isError).toBe(false)
      expect(result.current.error).toBeNull()

      // Verify API was called correctly
      expect(mockedApiClient.get).toHaveBeenCalledWith(
        `/districts/${districtId}/available-ranking-years`
      )
    })

    /**
     * Test that hook returns correct data structure
     *
     * **Validates: Requirements 2.1**
     */
    it('should return program years with all required fields', async () => {
      const districtId = '57'
      const mockData = createMockResponse(districtId)

      mockedApiClient.get.mockResolvedValueOnce({ data: mockData })

      const { result } = renderHook(
        () => useAvailableProgramYears({ districtId }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Verify data structure
      expect(result.current.data?.districtId).toBe(districtId)
      expect(result.current.data?.programYears).toHaveLength(3)

      const firstYear = result.current.data?.programYears[0]
      expect(firstYear).toMatchObject({
        year: '2024-2025',
        startDate: '2024-07-01',
        endDate: '2025-06-30',
        hasCompleteData: false,
        snapshotCount: 15,
        latestSnapshotDate: '2024-11-15',
      })
    })
  })

  describe('Loading State', () => {
    /**
     * Test that hook returns loading state while fetching
     *
     * **Validates: Requirements 2.1**
     */
    it('should return isLoading=true while fetching', async () => {
      const districtId = '57'
      const mockData = createMockResponse(districtId)

      // Create a delayed response
      mockedApiClient.get.mockImplementation(
        () =>
          new Promise(resolve =>
            setTimeout(() => resolve({ data: mockData }), 100)
          )
      )

      const { result } = renderHook(
        () => useAvailableProgramYears({ districtId }),
        { wrapper: createWrapper() }
      )

      // Should be loading initially
      expect(result.current.isLoading).toBe(true)
      expect(result.current.data).toBeUndefined()

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.data).toEqual(mockData)
    })
  })

  describe('Error Handling', () => {
    /**
     * Test that API errors are properly propagated
     *
     * **Validates: Requirements 7.2 (error state with retry)**
     */
    it('should handle API errors correctly', async () => {
      const districtId = '57'
      const errorMessage = 'Network error'

      mockedApiClient.get.mockRejectedValue(new Error(errorMessage))

      const { result } = renderHook(
        () => useAvailableProgramYears({ districtId }),
        { wrapper: createWrapper() }
      )

      await waitFor(
        () => {
          expect(result.current.isError).toBe(true)
        },
        { timeout: 5000 }
      )

      expect(result.current.error?.message).toBe(errorMessage)
      expect(result.current.data).toBeUndefined()
    })

    /**
     * Test that 404 errors are handled (district not found)
     *
     * **Validates: Requirements 7.2**
     */
    it('should handle 404 errors for non-existent districts', async () => {
      const districtId = 'INVALID'

      const error = Object.assign(new Error('District not found'), {
        response: { status: 404 },
      })
      mockedApiClient.get.mockRejectedValue(error)

      const { result } = renderHook(
        () => useAvailableProgramYears({ districtId }),
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
  })

  describe('Enabled Flag', () => {
    /**
     * Test that query is disabled when enabled=false
     *
     * **Validates: Requirements 2.1**
     */
    it('should not fetch when enabled is false', async () => {
      const districtId = '57'

      const { result } = renderHook(
        () => useAvailableProgramYears({ districtId, enabled: false }),
        { wrapper: createWrapper() }
      )

      // Query should not be enabled
      expect(result.current.isLoading).toBe(false)
      expect(mockedApiClient.get).not.toHaveBeenCalled()
    })

    /**
     * Test that query is disabled when districtId is empty
     *
     * **Validates: Requirements 2.1**
     */
    it('should not fetch when districtId is empty string', async () => {
      const { result } = renderHook(
        () => useAvailableProgramYears({ districtId: '' }),
        { wrapper: createWrapper() }
      )

      // Query should not be enabled
      expect(result.current.isLoading).toBe(false)
      expect(mockedApiClient.get).not.toHaveBeenCalled()
    })

    /**
     * Test that query is enabled when districtId is provided
     *
     * **Validates: Requirements 2.1**
     */
    it('should fetch when districtId is provided and enabled is true', async () => {
      const districtId = '57'
      const mockData = createMockResponse(districtId)

      mockedApiClient.get.mockResolvedValueOnce({ data: mockData })

      const { result } = renderHook(
        () => useAvailableProgramYears({ districtId, enabled: true }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(mockedApiClient.get).toHaveBeenCalled()
    })
  })

  describe('Refetch Function', () => {
    /**
     * Test that refetch function is provided and works
     *
     * **Validates: Requirements 7.2 (retry option)**
     */
    it('should provide a working refetch function', async () => {
      const districtId = '57'
      const mockData = createMockResponse(districtId)

      mockedApiClient.get.mockResolvedValue({ data: mockData })

      const { result } = renderHook(
        () => useAvailableProgramYears({ districtId }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Clear mock to track refetch call
      mockedApiClient.get.mockClear()
      mockedApiClient.get.mockResolvedValue({ data: mockData })

      // Call refetch
      result.current.refetch()

      await waitFor(() => {
        expect(mockedApiClient.get).toHaveBeenCalled()
      })
    })
  })

  describe('Empty Data Handling', () => {
    /**
     * Test that hook handles empty program years array
     *
     * **Validates: Requirements 2.4 (empty state)**
     */
    it('should handle empty program years array', async () => {
      const districtId = '57'
      const mockData: AvailableRankingYearsResponse = {
        districtId,
        programYears: [],
      }

      mockedApiClient.get.mockResolvedValueOnce({ data: mockData })

      const { result } = renderHook(
        () => useAvailableProgramYears({ districtId }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.data?.programYears).toHaveLength(0)
      expect(result.current.isError).toBe(false)
    })

    /**
     * Test that isEmpty flag is true when data is loaded but contains no program years
     *
     * **Validates: Requirements 4.2 (display message when no program years available)**
     */
    it('should set isEmpty=true when data is loaded but contains no program years', async () => {
      const districtId = '57'
      const mockData: AvailableRankingYearsResponse = {
        districtId,
        programYears: [],
      }

      mockedApiClient.get.mockResolvedValueOnce({ data: mockData })

      const { result } = renderHook(
        () => useAvailableProgramYears({ districtId }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.isEmpty).toBe(true)
      expect(result.current.isError).toBe(false)
      expect(result.current.data?.programYears).toHaveLength(0)
    })

    /**
     * Test that isEmpty flag is false when data contains program years
     *
     * **Validates: Requirements 4.2**
     */
    it('should set isEmpty=false when data contains program years', async () => {
      const districtId = '57'
      const mockData = createMockResponse(districtId)

      mockedApiClient.get.mockResolvedValueOnce({ data: mockData })

      const { result } = renderHook(
        () => useAvailableProgramYears({ districtId }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.isEmpty).toBe(false)
      expect(result.current.data?.programYears.length).toBeGreaterThan(0)
    })

    /**
     * Test that isEmpty flag is false while loading
     *
     * **Validates: Requirements 4.2**
     */
    it('should set isEmpty=false while loading', async () => {
      const districtId = '57'
      const mockData = createMockResponse(districtId)

      // Create a delayed response
      mockedApiClient.get.mockImplementation(
        () =>
          new Promise(resolve =>
            setTimeout(() => resolve({ data: mockData }), 100)
          )
      )

      const { result } = renderHook(
        () => useAvailableProgramYears({ districtId }),
        { wrapper: createWrapper() }
      )

      // While loading, isEmpty should be false
      expect(result.current.isLoading).toBe(true)
      expect(result.current.isEmpty).toBe(false)

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })

    /**
     * Test that isEmpty flag is false when in error state
     *
     * **Validates: Requirements 4.1, 4.2**
     */
    it('should set isEmpty=false when in error state', async () => {
      const districtId = '57'

      mockedApiClient.get.mockRejectedValue(new Error('Network error'))

      const { result } = renderHook(
        () => useAvailableProgramYears({ districtId }),
        { wrapper: createWrapper() }
      )

      await waitFor(
        () => {
          expect(result.current.isError).toBe(true)
        },
        { timeout: 5000 }
      )

      // When in error state, isEmpty should be false
      expect(result.current.isEmpty).toBe(false)
    })
  })

  describe('Different Districts', () => {
    /**
     * Test that different districts result in different API calls
     *
     * **Validates: Requirements 2.1**
     */
    it('should make separate API calls for different districts', async () => {
      const district1 = '57'
      const district2 = '101'
      const mockData1 = createMockResponse(district1)
      const mockData2 = createMockResponse(district2)

      mockedApiClient.get
        .mockResolvedValueOnce({ data: mockData1 })
        .mockResolvedValueOnce({ data: mockData2 })

      const wrapper = createWrapper()

      // First hook with district1
      const { result: result1 } = renderHook(
        () => useAvailableProgramYears({ districtId: district1 }),
        { wrapper }
      )

      await waitFor(() => {
        expect(result1.current.isLoading).toBe(false)
      })

      // Second hook with district2
      const { result: result2 } = renderHook(
        () => useAvailableProgramYears({ districtId: district2 }),
        { wrapper }
      )

      await waitFor(() => {
        expect(result2.current.isLoading).toBe(false)
      })

      // Verify both API calls were made with different districts
      expect(mockedApiClient.get).toHaveBeenCalledTimes(2)
      expect(mockedApiClient.get).toHaveBeenNthCalledWith(
        1,
        `/districts/${district1}/available-ranking-years`
      )
      expect(mockedApiClient.get).toHaveBeenNthCalledWith(
        2,
        `/districts/${district2}/available-ranking-years`
      )
    })
  })
})
