/**
 * Unit tests for useGlobalRankings hook
 * Feature: district-global-rankings
 *
 * Validates: Requirements 2.1, 2.2, 3.1-3.6, 5.2, 5.3
 *
 * These tests verify that the useGlobalRankings hook correctly:
 * - Aggregates data from useAvailableProgramYears and useRankHistory
 * - Extracts end-of-year rankings from history data
 * - Calculates year-over-year rank changes
 * - Returns proper loading, error, and success states
 * - Provides a refetch function
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'
import {
  useGlobalRankings,
  extractEndOfYearRankings,
  calculateYearOverYearChange,
  convertToProgramYear,
  globalRankingsQueryKeys,
  buildYearlyRankingSummaries,
  type EndOfYearRankings,
} from '../useGlobalRankings'
import { apiClient } from '../../services/api'
import type {
  AvailableRankingYearsResponse,
  RankHistoryResponse,
  ProgramYearWithData,
} from '../../types/districts'

// Mock the API client
vi.mock('../../services/api', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

// Type the mocked apiClient
const mockedApiClient = vi.mocked(apiClient)

// ========== Test Data Factories ==========

const createMockAvailableYearsResponse = (
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

const createMockRankHistoryResponse = (
  districtId: string,
  programYear: string = '2024-2025'
): RankHistoryResponse => ({
  districtId,
  districtName: `District ${districtId}`,
  history: [
    {
      date: '2024-07-15',
      aggregateScore: 350,
      clubsRank: 15,
      paymentsRank: 20,
      distinguishedRank: 10,
      totalDistricts: 126,
    },
    {
      date: '2024-08-15',
      aggregateScore: 355,
      clubsRank: 12,
      paymentsRank: 18,
      distinguishedRank: 8,
      totalDistricts: 126,
    },
    {
      date: '2024-09-15',
      aggregateScore: 360,
      clubsRank: 10,
      paymentsRank: 15,
      distinguishedRank: 5,
      totalDistricts: 126,
    },
  ],
  programYear: {
    startDate: programYear === '2024-2025' ? '2024-07-01' : '2023-07-01',
    endDate: programYear === '2024-2025' ? '2025-06-30' : '2024-06-30',
    year: programYear,
  },
})

const createMockProgramYearWithData = (
  year: string,
  hasCompleteData: boolean = true
): ProgramYearWithData => ({
  year,
  startDate: `${year.split('-')[0]}-07-01`,
  endDate: `${year.split('-')[1]}-06-30`,
  hasCompleteData,
  snapshotCount: hasCompleteData ? 52 : 15,
  latestSnapshotDate: hasCompleteData
    ? `${year.split('-')[1]}-06-30`
    : '2024-11-15',
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

describe('useGlobalRankings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Query Key Factory', () => {
    /**
     * Test that query key factory produces correct keys
     */
    it('should produce correct query keys', () => {
      expect(globalRankingsQueryKeys.all).toEqual(['global-rankings'])
      expect(globalRankingsQueryKeys.byDistrict('57')).toEqual([
        'global-rankings',
        '57',
      ])
      expect(
        globalRankingsQueryKeys.byDistrictAndYear('57', '2024-2025')
      ).toEqual(['global-rankings', '57', '2024-2025'])
    })
  })

  describe('Successful Data Fetching', () => {
    /**
     * Test that hook fetches and aggregates data correctly
     *
     * **Validates: Requirements 2.1, 2.2**
     */
    it('should fetch and aggregate ranking data for a district', async () => {
      const districtId = '57'
      const mockAvailableYears = createMockAvailableYearsResponse(districtId)
      const mockRankHistory = createMockRankHistoryResponse(districtId)

      // Mock GET for available years, POST for batch rank history
      mockedApiClient.get.mockImplementation((url: string) => {
        if (url.includes('available-ranking-years')) {
          return Promise.resolve({ data: mockAvailableYears })
        }
        return Promise.reject(new Error(`Unexpected GET URL: ${url}`))
      })
      mockedApiClient.post.mockImplementation((url: string) => {
        if (url.includes('rank-history-batch')) {
          return Promise.resolve({ data: [mockRankHistory] })
        }
        return Promise.reject(new Error(`Unexpected POST URL: ${url}`))
      })

      const { result } = renderHook(() => useGlobalRankings({ districtId }), {
        wrapper: createWrapper(),
      })

      // Initially loading
      expect(result.current.isLoading).toBe(true)

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Verify successful response
      expect(result.current.isError).toBe(false)
      expect(result.current.error).toBeNull()
      expect(result.current.availableProgramYears).toHaveLength(3)
      expect(result.current.currentYearHistory).not.toBeNull()
    })

    /**
     * Test that available program years are converted correctly
     *
     * **Validates: Requirements 2.1**
     */
    it('should convert available program years to ProgramYear format', async () => {
      const districtId = '57'
      const mockAvailableYears = createMockAvailableYearsResponse(districtId)
      const mockRankHistory = createMockRankHistoryResponse(districtId)

      mockedApiClient.get.mockImplementation((url: string) => {
        if (url.includes('available-ranking-years')) {
          return Promise.resolve({ data: mockAvailableYears })
        }
        return Promise.reject(new Error(`Unexpected GET URL: ${url}`))
      })
      mockedApiClient.post.mockImplementation((url: string) => {
        if (url.includes('rank-history-batch')) {
          return Promise.resolve({ data: [mockRankHistory] })
        }
        return Promise.reject(new Error(`Unexpected POST URL: ${url}`))
      })

      const { result } = renderHook(() => useGlobalRankings({ districtId }), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const firstYear = result.current.availableProgramYears[0]
      expect(firstYear).toMatchObject({
        year: 2024,
        startDate: '2024-07-01',
        endDate: '2025-06-30',
        label: '2024-2025',
      })
    })

    /**
     * Test that end-of-year rankings are extracted correctly
     *
     * **Validates: Requirements 3.1-3.6**
     */
    it('should extract end-of-year rankings from history data', async () => {
      const districtId = '57'
      const mockAvailableYears = createMockAvailableYearsResponse(districtId)
      const mockRankHistory = createMockRankHistoryResponse(districtId)

      mockedApiClient.get.mockImplementation((url: string) => {
        if (url.includes('available-ranking-years')) {
          return Promise.resolve({ data: mockAvailableYears })
        }
        return Promise.reject(new Error(`Unexpected GET URL: ${url}`))
      })
      mockedApiClient.post.mockImplementation((url: string) => {
        if (url.includes('rank-history-batch')) {
          return Promise.resolve({ data: [mockRankHistory] })
        }
        return Promise.reject(new Error(`Unexpected POST URL: ${url}`))
      })

      const { result } = renderHook(() => useGlobalRankings({ districtId }), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const rankings = result.current.endOfYearRankings
      expect(rankings).not.toBeNull()
      expect(rankings?.paidClubs.rank).toBe(10) // Latest point
      expect(rankings?.membershipPayments.rank).toBe(15)
      expect(rankings?.distinguishedClubs.rank).toBe(5)
      expect(rankings?.asOfDate).toBe('2024-09-15')
      expect(rankings?.isPartialYear).toBe(true) // 2024-2025 is not complete
    })
  })

  describe('Loading State', () => {
    /**
     * Test that hook returns loading state while fetching
     */
    it('should return isLoading=true while fetching', async () => {
      const districtId = '57'
      const mockAvailableYears = createMockAvailableYearsResponse(districtId)
      const mockRankHistory = createMockRankHistoryResponse(districtId)

      // Create delayed responses
      mockedApiClient.get.mockImplementation((url: string) => {
        if (url.includes('available-ranking-years')) {
          return new Promise(resolve =>
            setTimeout(() => resolve({ data: mockAvailableYears }), 50)
          )
        }
        return Promise.reject(new Error(`Unexpected GET URL: ${url}`))
      })
      mockedApiClient.post.mockImplementation((url: string) => {
        if (url.includes('rank-history-batch')) {
          return new Promise(resolve =>
            setTimeout(() => resolve({ data: [mockRankHistory] }), 50)
          )
        }
        return Promise.reject(new Error(`Unexpected POST URL: ${url}`))
      })

      const { result } = renderHook(() => useGlobalRankings({ districtId }), {
        wrapper: createWrapper(),
      })

      // Should be loading initially
      expect(result.current.isLoading).toBe(true)

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })
  })

  describe('Error Handling', () => {
    /**
     * Test that API errors are properly propagated
     */
    it('should handle API errors correctly', async () => {
      const districtId = '57'
      const errorMessage = 'Network error'

      mockedApiClient.get.mockRejectedValue(new Error(errorMessage))

      const { result } = renderHook(() => useGlobalRankings({ districtId }), {
        wrapper: createWrapper(),
      })

      await waitFor(
        () => {
          expect(result.current.isError).toBe(true)
        },
        { timeout: 5000 }
      )

      expect(result.current.error?.message).toBe(errorMessage)
    })
  })

  describe('Refetch Function', () => {
    /**
     * Test that refetch function is provided and works
     */
    it('should provide a working refetch function', async () => {
      const districtId = '57'
      const mockAvailableYears = createMockAvailableYearsResponse(districtId)
      const mockRankHistory = createMockRankHistoryResponse(districtId)

      mockedApiClient.get.mockImplementation((url: string) => {
        if (url.includes('available-ranking-years')) {
          return Promise.resolve({ data: mockAvailableYears })
        }
        return Promise.reject(new Error(`Unexpected GET URL: ${url}`))
      })
      mockedApiClient.post.mockImplementation((url: string) => {
        if (url.includes('rank-history-batch')) {
          return Promise.resolve({ data: [mockRankHistory] })
        }
        return Promise.reject(new Error(`Unexpected POST URL: ${url}`))
      })

      const { result } = renderHook(() => useGlobalRankings({ districtId }), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Verify refetch function exists
      expect(typeof result.current.refetch).toBe('function')
    })
  })

  describe('Empty Data Handling', () => {
    /**
     * Test that hook handles empty program years array
     */
    it('should handle empty program years array', async () => {
      const districtId = '57'
      const mockAvailableYears: AvailableRankingYearsResponse = {
        districtId,
        programYears: [],
      }

      // When there are no program years, the rank history hook will still be called
      // but with no date range, so we need to handle both endpoints
      mockedApiClient.get.mockImplementation((url: string) => {
        if (url.includes('available-ranking-years')) {
          return Promise.resolve({ data: mockAvailableYears })
        }
        return Promise.reject(new Error(`Unexpected GET URL: ${url}`))
      })
      mockedApiClient.post.mockImplementation((url: string) => {
        if (url.includes('rank-history-batch')) {
          // Return empty history when no program years
          return Promise.resolve({
            data: [
              {
                districtId,
                districtName: `District ${districtId}`,
                history: [],
                programYear: {
                  startDate: '',
                  endDate: '',
                  year: '',
                },
              },
            ],
          })
        }
        return Promise.reject(new Error(`Unexpected POST URL: ${url}`))
      })

      const { result } = renderHook(() => useGlobalRankings({ districtId }), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.availableProgramYears).toHaveLength(0)
      // When there are no program years, currentYearHistory will have empty history
      expect(result.current.currentYearHistory?.history).toHaveLength(0)
      // End of year rankings should be null when history is empty
      expect(result.current.endOfYearRankings).toBeNull()
    })
  })
})

describe('Helper Functions', () => {
  describe('convertToProgramYear', () => {
    /**
     * Test conversion from ProgramYearWithData to ProgramYear
     */
    it('should convert ProgramYearWithData to ProgramYear format', () => {
      const input: ProgramYearWithData = {
        year: '2023-2024',
        startDate: '2023-07-01',
        endDate: '2024-06-30',
        hasCompleteData: true,
        snapshotCount: 52,
        latestSnapshotDate: '2024-06-30',
      }

      const result = convertToProgramYear(input)

      expect(result).toEqual({
        year: 2023,
        startDate: '2023-07-01',
        endDate: '2024-06-30',
        label: '2023-2024',
      })
    })
  })

  describe('extractEndOfYearRankings', () => {
    /**
     * Test extraction of end-of-year rankings from history
     *
     * **Validates: Requirements 3.1-3.6**
     */
    it('should extract rankings from the most recent history point', () => {
      const history: RankHistoryResponse = {
        districtId: '57',
        districtName: 'District 57',
        history: [
          {
            date: '2024-07-15',
            aggregateScore: 350,
            clubsRank: 15,
            paymentsRank: 20,
            distinguishedRank: 10,
            totalDistricts: 126,
          },
          {
            date: '2024-09-15',
            aggregateScore: 360,
            clubsRank: 10,
            paymentsRank: 15,
            distinguishedRank: 5,
            totalDistricts: 126,
          },
          {
            date: '2024-08-15',
            aggregateScore: 355,
            clubsRank: 12,
            paymentsRank: 18,
            distinguishedRank: 8,
            totalDistricts: 126,
          },
        ],
        programYear: {
          startDate: '2024-07-01',
          endDate: '2025-06-30',
          year: '2024-2025',
        },
      }

      const programYearData = createMockProgramYearWithData('2024-2025', false)
      const result = extractEndOfYearRankings(history, programYearData)

      expect(result).not.toBeNull()
      // Should use the most recent date (2024-09-15)
      expect(result?.paidClubs.rank).toBe(10)
      expect(result?.membershipPayments.rank).toBe(15)
      expect(result?.distinguishedClubs.rank).toBe(5)
      expect(result?.asOfDate).toBe('2024-09-15')
      expect(result?.isPartialYear).toBe(true)
    })

    /**
     * Test that extractEndOfYearRankings uses overallRank from API when present
     *
     * **Validates: Requirements 3.1** - WHEN extractEndOfYearRankings processes rank history data,
     * THE System SHALL use the overallRank field from the API response
     */
    it('should use overallRank from API when present', () => {
      const history: RankHistoryResponse = {
        districtId: '57',
        districtName: 'District 57',
        history: [
          {
            date: '2024-09-15',
            aggregateScore: 360,
            clubsRank: 10,
            paymentsRank: 15,
            distinguishedRank: 5,
            totalDistricts: 126,
            overallRank: 7, // API-provided overallRank based on aggregateScore position
          },
        ],
        programYear: {
          startDate: '2024-07-01',
          endDate: '2025-06-30',
          year: '2024-2025',
        },
      }

      const programYearData = createMockProgramYearWithData('2024-2025', false)
      const result = extractEndOfYearRankings(history, programYearData)

      expect(result).not.toBeNull()
      // Should use the API-provided overallRank (7), NOT the average of category ranks
      // Average would be: Math.round((10 + 15 + 5) / 3) = 10
      expect(result?.overall.rank).toBe(7)
    })

    /**
     * Test that extractEndOfYearRankings falls back to averaging when overallRank is missing
     *
     * **Validates: Requirements 3.4** - IF the overallRank field is not present in legacy data,
     * THEN THE System SHALL fall back to calculating rank from aggregateScore position
     */
    it('should fall back to averaging category ranks when overallRank is missing (legacy data)', () => {
      const history: RankHistoryResponse = {
        districtId: '57',
        districtName: 'District 57',
        history: [
          {
            date: '2024-09-15',
            aggregateScore: 360,
            clubsRank: 10,
            paymentsRank: 15,
            distinguishedRank: 5,
            totalDistricts: 126,
            // No overallRank field - simulating legacy data
          },
        ],
        programYear: {
          startDate: '2024-07-01',
          endDate: '2025-06-30',
          year: '2024-2025',
        },
      }

      const programYearData = createMockProgramYearWithData('2024-2025', false)
      const result = extractEndOfYearRankings(history, programYearData)

      expect(result).not.toBeNull()
      // Should fall back to averaging: Math.round((10 + 15 + 5) / 3) = 10
      expect(result?.overall.rank).toBe(10)
    })

    /**
     * Test that overallRank is used even when it differs significantly from category average
     *
     * **Validates: Requirements 3.1, 3.3** - THE System SHALL NOT calculate overall rank
     * by averaging clubsRank, paymentsRank, and distinguishedRank
     */
    it('should use overallRank even when it differs significantly from category average', () => {
      const history: RankHistoryResponse = {
        districtId: '57',
        districtName: 'District 57',
        history: [
          {
            date: '2024-09-15',
            aggregateScore: 400, // High aggregate score
            clubsRank: 50, // Poor clubs rank
            paymentsRank: 60, // Poor payments rank
            distinguishedRank: 70, // Poor distinguished rank
            totalDistricts: 126,
            overallRank: 3, // But excellent overall rank due to high aggregate score
          },
        ],
        programYear: {
          startDate: '2024-07-01',
          endDate: '2025-06-30',
          year: '2024-2025',
        },
      }

      const programYearData = createMockProgramYearWithData('2024-2025', false)
      const result = extractEndOfYearRankings(history, programYearData)

      expect(result).not.toBeNull()
      // Should use API-provided overallRank (3), NOT the average
      // Average would be: Math.round((50 + 60 + 70) / 3) = 60
      expect(result?.overall.rank).toBe(3)
      // Verify category ranks are still correct
      expect(result?.paidClubs.rank).toBe(50)
      expect(result?.membershipPayments.rank).toBe(60)
      expect(result?.distinguishedClubs.rank).toBe(70)
    })

    /**
     * Test that percentiles are calculated correctly
     *
     * **Validates: Requirements 3.5**
     */
    it('should calculate percentiles correctly', () => {
      const history: RankHistoryResponse = {
        districtId: '57',
        districtName: 'District 57',
        history: [
          {
            date: '2024-09-15',
            aggregateScore: 360,
            clubsRank: 1, // Best rank
            paymentsRank: 126, // Worst rank
            distinguishedRank: 63, // Middle rank
            totalDistricts: 126,
          },
        ],
        programYear: {
          startDate: '2024-07-01',
          endDate: '2025-06-30',
          year: '2024-2025',
        },
      }

      const programYearData = createMockProgramYearWithData('2024-2025', true)
      const result = extractEndOfYearRankings(history, programYearData)

      expect(result).not.toBeNull()
      // Rank 1 of 126 = (126 - 1 + 1) / 126 * 100 = 100%
      expect(result?.paidClubs.percentile).toBe(100)
      // Rank 126 of 126 = (126 - 126 + 1) / 126 * 100 = 0.79%
      expect(result?.membershipPayments.percentile).toBeCloseTo(0.8, 1)
      // Rank 63 of 126 = (126 - 63 + 1) / 126 * 100 = 50.79%
      expect(result?.distinguishedClubs.percentile).toBeCloseTo(50.8, 1)
    })

    /**
     * Test handling of null/empty history
     */
    it('should return null for empty history', () => {
      const history: RankHistoryResponse = {
        districtId: '57',
        districtName: 'District 57',
        history: [],
        programYear: {
          startDate: '2024-07-01',
          endDate: '2025-06-30',
          year: '2024-2025',
        },
      }

      const result = extractEndOfYearRankings(history, undefined)
      expect(result).toBeNull()
    })

    it('should return null for null history', () => {
      const result = extractEndOfYearRankings(null, undefined)
      expect(result).toBeNull()
    })
  })

  describe('calculateYearOverYearChange', () => {
    /**
     * Test year-over-year change calculation for improvement
     *
     * **Validates: Requirements 5.2**
     */
    it('should calculate positive change for rank improvement', () => {
      const currentYear: EndOfYearRankings = {
        overall: { rank: 5, totalDistricts: 126, percentile: 96.8 },
        paidClubs: { rank: 5, totalDistricts: 126, percentile: 96.8 },
        membershipPayments: { rank: 8, totalDistricts: 126, percentile: 94.4 },
        distinguishedClubs: { rank: 3, totalDistricts: 126, percentile: 98.4 },
        asOfDate: '2024-06-30',
        isPartialYear: false,
      }

      const previousYear: EndOfYearRankings = {
        overall: { rank: 10, totalDistricts: 126, percentile: 92.9 },
        paidClubs: { rank: 10, totalDistricts: 126, percentile: 92.9 },
        membershipPayments: { rank: 15, totalDistricts: 126, percentile: 88.9 },
        distinguishedClubs: { rank: 8, totalDistricts: 126, percentile: 94.4 },
        asOfDate: '2023-06-30',
        isPartialYear: false,
      }

      const result = calculateYearOverYearChange(currentYear, previousYear)

      expect(result).not.toBeNull()
      // Rank improved from 10 to 5 = 10 - 5 = 5 (positive = improvement)
      expect(result?.overall).toBe(5)
      expect(result?.clubs).toBe(5)
      expect(result?.payments).toBe(7)
      expect(result?.distinguished).toBe(5)
    })

    /**
     * Test year-over-year change calculation for decline
     *
     * **Validates: Requirements 5.2**
     */
    it('should calculate negative change for rank decline', () => {
      const currentYear: EndOfYearRankings = {
        overall: { rank: 15, totalDistricts: 126, percentile: 88.9 },
        paidClubs: { rank: 15, totalDistricts: 126, percentile: 88.9 },
        membershipPayments: { rank: 20, totalDistricts: 126, percentile: 84.9 },
        distinguishedClubs: { rank: 12, totalDistricts: 126, percentile: 91.3 },
        asOfDate: '2024-06-30',
        isPartialYear: false,
      }

      const previousYear: EndOfYearRankings = {
        overall: { rank: 10, totalDistricts: 126, percentile: 92.9 },
        paidClubs: { rank: 10, totalDistricts: 126, percentile: 92.9 },
        membershipPayments: { rank: 12, totalDistricts: 126, percentile: 91.3 },
        distinguishedClubs: { rank: 8, totalDistricts: 126, percentile: 94.4 },
        asOfDate: '2023-06-30',
        isPartialYear: false,
      }

      const result = calculateYearOverYearChange(currentYear, previousYear)

      expect(result).not.toBeNull()
      // Rank declined from 10 to 15 = 10 - 15 = -5 (negative = decline)
      expect(result?.overall).toBe(-5)
      expect(result?.clubs).toBe(-5)
      expect(result?.payments).toBe(-8)
      expect(result?.distinguished).toBe(-4)
    })

    /**
     * Test handling of null inputs
     */
    it('should return null when current year is null', () => {
      const previousYear: EndOfYearRankings = {
        overall: { rank: 10, totalDistricts: 126, percentile: 92.9 },
        paidClubs: { rank: 10, totalDistricts: 126, percentile: 92.9 },
        membershipPayments: { rank: 15, totalDistricts: 126, percentile: 88.9 },
        distinguishedClubs: { rank: 8, totalDistricts: 126, percentile: 94.4 },
        asOfDate: '2023-06-30',
        isPartialYear: false,
      }

      const result = calculateYearOverYearChange(null, previousYear)
      expect(result).toBeNull()
    })

    it('should return null when previous year is null', () => {
      const currentYear: EndOfYearRankings = {
        overall: { rank: 5, totalDistricts: 126, percentile: 96.8 },
        paidClubs: { rank: 5, totalDistricts: 126, percentile: 96.8 },
        membershipPayments: { rank: 8, totalDistricts: 126, percentile: 94.4 },
        distinguishedClubs: { rank: 3, totalDistricts: 126, percentile: 98.4 },
        asOfDate: '2024-06-30',
        isPartialYear: false,
      }

      const result = calculateYearOverYearChange(currentYear, null)
      expect(result).toBeNull()
    })
  })

  describe('buildYearlyRankingSummaries', () => {
    /**
     * Test that buildYearlyRankingSummaries uses overallRank from API when present
     *
     * **Validates: Requirements 3.3** - WHEN buildYearlyRankingSummaries creates yearly summaries,
     * THE System SHALL use the overallRank field from the latest data point
     */
    it('should use overallRank from API when present in history data', () => {
      const programYears: ProgramYearWithData[] = [
        {
          year: '2023-2024',
          startDate: '2023-07-01',
          endDate: '2024-06-30',
          hasCompleteData: true,
          snapshotCount: 52,
          latestSnapshotDate: '2024-06-30',
        },
      ]

      const historyByYear = new Map<string, RankHistoryResponse>()
      historyByYear.set('2023-2024', {
        districtId: '57',
        districtName: 'District 57',
        history: [
          {
            date: '2024-06-30',
            aggregateScore: 380,
            clubsRank: 12,
            paymentsRank: 18,
            distinguishedRank: 9,
            totalDistricts: 126,
            overallRank: 5, // API-provided overallRank based on aggregateScore position
          },
        ],
        programYear: {
          startDate: '2023-07-01',
          endDate: '2024-06-30',
          year: '2023-2024',
        },
      })

      const result = buildYearlyRankingSummaries(programYears, historyByYear)

      expect(result).toHaveLength(1)
      // Should use API-provided overallRank (5), NOT the average of category ranks
      // Average would be: Math.round((12 + 18 + 9) / 3) = 13
      expect(result[0]?.overallRank).toBe(5)
      expect(result[0]?.clubsRank).toBe(12)
      expect(result[0]?.paymentsRank).toBe(18)
      expect(result[0]?.distinguishedRank).toBe(9)
    })

    /**
     * Test that buildYearlyRankingSummaries falls back to averaging when overallRank is missing
     *
     * **Validates: Requirements 3.4** - IF the overallRank field is not present in legacy data,
     * THEN THE System SHALL fall back to calculating rank
     */
    it('should fall back to averaging category ranks when overallRank is missing', () => {
      const programYears: ProgramYearWithData[] = [
        {
          year: '2022-2023',
          startDate: '2022-07-01',
          endDate: '2023-06-30',
          hasCompleteData: true,
          snapshotCount: 48,
          latestSnapshotDate: '2023-06-30',
        },
      ]

      const historyByYear = new Map<string, RankHistoryResponse>()
      historyByYear.set('2022-2023', {
        districtId: '57',
        districtName: 'District 57',
        history: [
          {
            date: '2023-06-30',
            aggregateScore: 350,
            clubsRank: 15,
            paymentsRank: 21,
            distinguishedRank: 12,
            totalDistricts: 126,
            // No overallRank - simulating legacy data
          },
        ],
        programYear: {
          startDate: '2022-07-01',
          endDate: '2023-06-30',
          year: '2022-2023',
        },
      })

      const result = buildYearlyRankingSummaries(programYears, historyByYear)

      expect(result).toHaveLength(1)
      // Should fall back to averaging: Math.round((15 + 21 + 12) / 3) = 16
      expect(result[0]?.overallRank).toBe(16)
    })

    /**
     * Test that year-over-year changes use overallRank correctly
     *
     * **Validates: Requirements 3.3** - Year-over-year changes should be calculated
     * using the correct overallRank values from the API
     */
    it('should calculate year-over-year changes using overallRank from API', () => {
      const programYears: ProgramYearWithData[] = [
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
      ]

      const historyByYear = new Map<string, RankHistoryResponse>()

      // 2022-2023: overallRank = 10
      historyByYear.set('2022-2023', {
        districtId: '57',
        districtName: 'District 57',
        history: [
          {
            date: '2023-06-30',
            aggregateScore: 350,
            clubsRank: 15,
            paymentsRank: 20,
            distinguishedRank: 10,
            totalDistricts: 126,
            overallRank: 10,
          },
        ],
        programYear: {
          startDate: '2022-07-01',
          endDate: '2023-06-30',
          year: '2022-2023',
        },
      })

      // 2023-2024: overallRank = 5 (improved from 10)
      historyByYear.set('2023-2024', {
        districtId: '57',
        districtName: 'District 57',
        history: [
          {
            date: '2024-06-30',
            aggregateScore: 380,
            clubsRank: 10,
            paymentsRank: 15,
            distinguishedRank: 5,
            totalDistricts: 126,
            overallRank: 5,
          },
        ],
        programYear: {
          startDate: '2023-07-01',
          endDate: '2024-06-30',
          year: '2023-2024',
        },
      })

      const result = buildYearlyRankingSummaries(programYears, historyByYear)

      expect(result).toHaveLength(2)

      // Most recent year (2023-2024) should be first
      const currentYear = result[0]
      expect(currentYear?.programYear).toBe('2023-2024')
      expect(currentYear?.overallRank).toBe(5)
      // Year-over-year change: previous (10) - current (5) = 5 (positive = improvement)
      expect(currentYear?.yearOverYearChange?.overall).toBe(5)

      // Previous year (2022-2023) should be second
      const previousYear = result[1]
      expect(previousYear?.programYear).toBe('2022-2023')
      expect(previousYear?.overallRank).toBe(10)
      // No year-over-year change for oldest year
      expect(previousYear?.yearOverYearChange).toBeNull()
    })

    /**
     * Test that buildYearlyRankingSummaries handles empty history gracefully
     */
    it('should return empty array when no history data available', () => {
      const programYears: ProgramYearWithData[] = [
        {
          year: '2023-2024',
          startDate: '2023-07-01',
          endDate: '2024-06-30',
          hasCompleteData: false,
          snapshotCount: 0,
          latestSnapshotDate: '',
        },
      ]

      const historyByYear = new Map<string, RankHistoryResponse>()
      // No history data for the program year

      const result = buildYearlyRankingSummaries(programYears, historyByYear)

      expect(result).toHaveLength(0)
    })
  })
})
