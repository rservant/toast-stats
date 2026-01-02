import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'
import { ReactNode } from 'react'
import {
  useClubHealthClassification,
  useDistrictHealthSummary,
  useClubHealthHistory,
} from '../useClubHealth'
import { apiClient } from '../../services/api'
import type {
  ClubHealthInput,
  ClubHealthResult,
  DistrictHealthSummary,
  ClubHealthHistory,
} from '../../types/clubHealth'

// Mock the API client
vi.mock('../../services/api')

interface MockedApiClient {
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
}

const mockedApiClient = apiClient as unknown as MockedApiClient

// Create a wrapper for React Query
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  })

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

// Mock data
const mockClubHealthInput: ClubHealthInput = {
  club_name: 'Test Club',
  current_members: 25,
  member_growth_since_july: 5,
  current_month: 'January',
  dcp_goals_achieved_ytd: 3,
  csp_submitted: true,
  officer_list_submitted: true,
  officers_trained: true,
  previous_month_members: 23,
  previous_month_dcp_goals_achieved_ytd: 2,
  previous_month_health_status: 'Vulnerable',
}

const mockClubHealthResult: ClubHealthResult = {
  club_name: 'Test Club',
  health_status: 'Thriving',
  reasons: [
    'Membership requirement met',
    'DCP requirement met',
    'CSP submitted',
  ],
  trajectory: 'Recovering',
  trajectory_reasons: ['Health status improved from Vulnerable to Thriving'],
  composite_key: 'Thriving__Recovering',
  composite_label: 'Thriving · Recovering',
  members_delta_mom: 2,
  dcp_delta_mom: 1,
  metadata: {
    evaluation_date: '2025-01-01T00:00:00Z',
    processing_time_ms: 15,
    rule_version: '1.0.0',
  },
}

const mockDistrictHealthSummary: DistrictHealthSummary = {
  district_id: 'D123',
  total_clubs: 50,
  health_distribution: {
    Thriving: 20,
    Vulnerable: 25,
    'Intervention Required': 5,
  },
  trajectory_distribution: {
    Recovering: 15,
    Stable: 30,
    Declining: 5,
  },
  clubs_needing_attention: [mockClubHealthResult],
  evaluation_date: '2025-01-01T00:00:00Z',
}

const mockClubHealthHistory: ClubHealthHistory[] = [
  {
    evaluation_date: '2024-12-01T00:00:00Z',
    health_status: 'Vulnerable',
    trajectory: 'Stable',
    members: 23,
    dcp_goals: 2,
  },
  {
    evaluation_date: '2025-01-01T00:00:00Z',
    health_status: 'Thriving',
    trajectory: 'Recovering',
    members: 25,
    dcp_goals: 3,
  },
]

describe('useClubHealthClassification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should classify club successfully', async () => {
    const mockResponse = { data: mockClubHealthResult }
    mockedApiClient.post.mockResolvedValueOnce(mockResponse)

    const { result } = renderHook(() => useClubHealthClassification(), {
      wrapper: createWrapper(),
    })

    // Trigger the mutation
    result.current.mutate(mockClubHealthInput)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockClubHealthResult)
    expect(mockedApiClient.post).toHaveBeenCalledWith(
      '/club-health/classify',
      mockClubHealthInput
    )
  })

  it('should handle classification errors gracefully', async () => {
    const mockError = new Error('Classification failed')
    mockedApiClient.post.mockRejectedValueOnce(mockError)

    const { result } = renderHook(() => useClubHealthClassification(), {
      wrapper: createWrapper(),
    })

    // Trigger the mutation
    result.current.mutate(mockClubHealthInput)

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toEqual(mockError)
  })

  it('should be in idle state initially', () => {
    const { result } = renderHook(() => useClubHealthClassification(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isIdle).toBe(true)
    expect(result.current.data).toBeUndefined()
    expect(result.current.error).toBeNull()
  })

  it('should show loading state during mutation', async () => {
    const mockResponse = { data: mockClubHealthResult }
    mockedApiClient.post.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(mockResponse), 100))
    )

    const { result } = renderHook(() => useClubHealthClassification(), {
      wrapper: createWrapper(),
    })

    // Trigger the mutation
    result.current.mutate(mockClubHealthInput)

    // Wait for the mutation to start
    await waitFor(() => {
      expect(result.current.isPending).toBe(true)
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
  })
})

describe('useDistrictHealthSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch district health summary successfully', async () => {
    const mockResponse = { data: mockDistrictHealthSummary }
    mockedApiClient.get.mockResolvedValueOnce(mockResponse)

    const { result } = renderHook(() => useDistrictHealthSummary('D123'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockDistrictHealthSummary)
    expect(mockedApiClient.get).toHaveBeenCalledWith(
      '/districts/D123/health-summary'
    )
  })

  it('should handle API errors gracefully', async () => {
    const mockError = new Error('District not found')
    mockedApiClient.get.mockRejectedValue(mockError)

    const { result } = renderHook(() => useDistrictHealthSummary('D123'), {
      wrapper: createWrapper(),
    })

    // Wait for the query to complete (either success or error)
    await waitFor(
      () => {
        expect(result.current.isLoading).toBe(false)
      },
      { timeout: 5000 }
    )

    // Check that it's in error state
    expect(result.current.isError).toBe(true)
    expect(result.current.error).toEqual(mockError)
  })

  it('should not fetch when districtId is null', () => {
    renderHook(() => useDistrictHealthSummary(null), {
      wrapper: createWrapper(),
    })

    expect(mockedApiClient.get).not.toHaveBeenCalled()
  })

  it('should not fetch when districtId is empty string', () => {
    renderHook(() => useDistrictHealthSummary(''), {
      wrapper: createWrapper(),
    })

    expect(mockedApiClient.get).not.toHaveBeenCalled()
  })

  it('should use correct cache key for different districts', async () => {
    const mockResponse1 = {
      data: { ...mockDistrictHealthSummary, district_id: 'D123' },
    }
    const mockResponse2 = {
      data: { ...mockDistrictHealthSummary, district_id: 'D456' },
    }

    mockedApiClient.get
      .mockResolvedValueOnce(mockResponse1)
      .mockResolvedValueOnce(mockResponse2)

    // Render hook for first district
    const { result: result1 } = renderHook(
      () => useDistrictHealthSummary('D123'),
      {
        wrapper: createWrapper(),
      }
    )

    // Render hook for second district
    const { result: result2 } = renderHook(
      () => useDistrictHealthSummary('D456'),
      {
        wrapper: createWrapper(),
      }
    )

    await waitFor(() => {
      expect(result1.current.isSuccess).toBe(true)
      expect(result2.current.isSuccess).toBe(true)
    })

    expect(result1.current.data?.district_id).toBe('D123')
    expect(result2.current.data?.district_id).toBe('D456')
    expect(mockedApiClient.get).toHaveBeenCalledTimes(2)
  })
})

describe('useClubHealthHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch club health history successfully', async () => {
    const mockResponse = { data: mockClubHealthHistory }
    mockedApiClient.get.mockResolvedValueOnce(mockResponse)

    const { result } = renderHook(() => useClubHealthHistory('Test Club'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockClubHealthHistory)
    expect(mockedApiClient.get).toHaveBeenCalledWith(
      '/club-health/Test%20Club/history'
    )
  })

  it('should fetch club health history with months parameter', async () => {
    const mockResponse = { data: mockClubHealthHistory }
    mockedApiClient.get.mockResolvedValueOnce(mockResponse)

    const { result } = renderHook(() => useClubHealthHistory('Test Club', 6), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockClubHealthHistory)
    expect(mockedApiClient.get).toHaveBeenCalledWith(
      '/club-health/Test%20Club/history?months=6'
    )
  })

  it('should handle API errors gracefully', async () => {
    const mockError = new Error('Club not found')
    mockedApiClient.get.mockRejectedValue(mockError)

    const { result } = renderHook(() => useClubHealthHistory('Test Club'), {
      wrapper: createWrapper(),
    })

    // Wait for the query to complete (either success or error)
    await waitFor(
      () => {
        expect(result.current.isLoading).toBe(false)
      },
      { timeout: 5000 }
    )

    // Check that it's in error state
    expect(result.current.isError).toBe(true)
    expect(result.current.error).toEqual(mockError)
  })

  it('should not fetch when clubName is null', () => {
    renderHook(() => useClubHealthHistory(null), {
      wrapper: createWrapper(),
    })

    expect(mockedApiClient.get).not.toHaveBeenCalled()
  })

  it('should not fetch when clubName is empty string', () => {
    renderHook(() => useClubHealthHistory(''), {
      wrapper: createWrapper(),
    })

    expect(mockedApiClient.get).not.toHaveBeenCalled()
  })

  it('should properly encode club names with special characters', async () => {
    const mockResponse = { data: mockClubHealthHistory }
    mockedApiClient.get.mockResolvedValueOnce(mockResponse)

    const clubNameWithSpaces = 'Test Club & Associates'
    const { result } = renderHook(
      () => useClubHealthHistory(clubNameWithSpaces),
      {
        wrapper: createWrapper(),
      }
    )

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockedApiClient.get).toHaveBeenCalledWith(
      '/club-health/Test%20Club%20%26%20Associates/history'
    )
  })

  it('should use correct cache key for different clubs and months', async () => {
    const mockResponse = { data: mockClubHealthHistory }
    mockedApiClient.get.mockResolvedValue(mockResponse)

    // Render hook for different club names and months
    const { result: result1 } = renderHook(
      () => useClubHealthHistory('Club A', 3),
      {
        wrapper: createWrapper(),
      }
    )

    const { result: result2 } = renderHook(
      () => useClubHealthHistory('Club B', 6),
      {
        wrapper: createWrapper(),
      }
    )

    await waitFor(() => {
      expect(result1.current.isSuccess).toBe(true)
      expect(result2.current.isSuccess).toBe(true)
    })

    expect(mockedApiClient.get).toHaveBeenCalledWith(
      '/club-health/Club%20A/history?months=3'
    )
    expect(mockedApiClient.get).toHaveBeenCalledWith(
      '/club-health/Club%20B/history?months=6'
    )
    expect(mockedApiClient.get).toHaveBeenCalledTimes(2)
  })

  it('should handle empty history response', async () => {
    const mockResponse = { data: [] }
    mockedApiClient.get.mockResolvedValueOnce(mockResponse)

    const { result } = renderHook(() => useClubHealthHistory('New Club'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual([])
  })
})
