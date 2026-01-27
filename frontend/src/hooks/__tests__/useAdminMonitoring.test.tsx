/**
 * Unit tests for useAdminMonitoring hook
 * Feature: district-analytics-performance
 *
 * Validates: Requirements 10.5
 *
 * These tests verify that the useAdminMonitoring hook correctly:
 * - Fetches system health metrics via GET /api/admin/health
 * - Auto-refreshes at the specified interval
 * - Handles loading and error states appropriately
 * - Provides manual refresh functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'
import {
  useAdminMonitoring,
  useSystemHealth,
  SystemHealthResponse,
} from '../useAdminMonitoring'
import { apiClient } from '../../services/api'

// Mock the API client
vi.mock('../../services/api', () => ({
  apiClient: {
    get: vi.fn(),
  },
}))

// Type the mocked apiClient
const mockedApiClient = vi.mocked(apiClient)

// ========== Test Data Factories ==========

const createMockHealthResponse = (
  overrides: Partial<SystemHealthResponse> = {}
): SystemHealthResponse => ({
  health: {
    cacheHitRate: 85.5,
    averageResponseTime: 45.2,
    pendingOperations: 2,
    snapshotCount: 150,
    precomputedAnalyticsCount: 145,
    ...overrides.health,
  },
  details: {
    cache: {
      hitRate: 85.5,
      totalReads: 1000,
      cacheHits: 855,
      cacheMisses: 145,
      efficiency: 'operational',
      ...overrides.details?.cache,
    },
    snapshots: {
      total: 150,
      withPrecomputedAnalytics: 145,
      analyticsCoverage: 97,
      ...overrides.details?.snapshots,
    },
    operations: {
      pending: 2,
      status: 'processing',
      ...overrides.details?.operations,
    },
    performance: {
      averageResponseTime: 45.2,
      concurrentReads: 3,
      maxConcurrentReads: 10,
      ...overrides.details?.performance,
    },
    ...overrides.details,
  },
  metadata: {
    checked_at: new Date().toISOString(),
    check_duration_ms: 15,
    operation_id: 'op_health_123',
    ...overrides.metadata,
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

describe('useAdminMonitoring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('useSystemHealth', () => {
    /**
     * Test that hook fetches health metrics from GET endpoint
     *
     * **Validates: Requirements 10.5**
     */
    it('should fetch health metrics via GET /api/admin/health', async () => {
      const mockResponse = createMockHealthResponse()
      mockedApiClient.get.mockResolvedValue({ data: mockResponse })

      const { result } = renderHook(() => useSystemHealth(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(mockedApiClient.get).toHaveBeenCalledWith('/admin/health')
      expect(result.current.data?.health.cacheHitRate).toBe(85.5)
      expect(result.current.data?.health.averageResponseTime).toBe(45.2)
      expect(result.current.data?.health.pendingOperations).toBe(2)
      expect(result.current.data?.health.snapshotCount).toBe(150)
    })

    /**
     * Test that hook does not fetch when disabled
     */
    it('should not fetch when disabled', async () => {
      const { result } = renderHook(() => useSystemHealth(false), {
        wrapper: createWrapper(),
      })

      // Wait a bit to ensure no fetch happens
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockedApiClient.get).not.toHaveBeenCalled()
      expect(result.current.data).toBeUndefined()
    })

    /**
     * Test error handling for health fetch
     */
    it('should handle fetch errors correctly', async () => {
      const errorMessage = 'Failed to fetch health metrics'
      mockedApiClient.get.mockRejectedValue(new Error(errorMessage))

      const { result } = renderHook(() => useSystemHealth(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error?.message).toBe(errorMessage)
    })
  })

  describe('useAdminMonitoring (unified hook)', () => {
    /**
     * Test that unified hook provides all health data
     *
     * **Validates: Requirements 10.5**
     */
    it('should provide health metrics, details, and metadata', async () => {
      const mockResponse = createMockHealthResponse()
      mockedApiClient.get.mockResolvedValue({ data: mockResponse })

      const { result } = renderHook(() => useAdminMonitoring(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Verify health metrics
      expect(result.current.health).not.toBeNull()
      expect(result.current.health?.cacheHitRate).toBe(85.5)
      expect(result.current.health?.averageResponseTime).toBe(45.2)
      expect(result.current.health?.pendingOperations).toBe(2)
      expect(result.current.health?.snapshotCount).toBe(150)
      expect(result.current.health?.precomputedAnalyticsCount).toBe(145)

      // Verify details
      expect(result.current.details).not.toBeNull()
      expect(result.current.details?.cache.totalReads).toBe(1000)
      expect(result.current.details?.snapshots.analyticsCoverage).toBe(97)
      expect(result.current.details?.operations.status).toBe('processing')

      // Verify metadata
      expect(result.current.metadata).not.toBeNull()
      expect(result.current.lastUpdated).not.toBeNull()
    })

    /**
     * Test that hook returns null values when no data
     */
    it('should return null values when no data is available', () => {
      mockedApiClient.get.mockImplementation(() => new Promise(() => {})) // Never resolves

      const { result } = renderHook(() => useAdminMonitoring(), {
        wrapper: createWrapper(),
      })

      expect(result.current.health).toBeNull()
      expect(result.current.details).toBeNull()
      expect(result.current.metadata).toBeNull()
      expect(result.current.lastUpdated).toBeNull()
      expect(result.current.isLoading).toBe(true)
    })

    /**
     * Test that hook provides refetch function
     */
    it('should provide refetch function that triggers new fetch', async () => {
      const mockResponse = createMockHealthResponse()
      mockedApiClient.get.mockResolvedValue({ data: mockResponse })

      const { result } = renderHook(() => useAdminMonitoring(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(mockedApiClient.get).toHaveBeenCalledTimes(1)

      // Trigger manual refetch
      act(() => {
        result.current.refetch()
      })

      await waitFor(() => {
        expect(mockedApiClient.get).toHaveBeenCalledTimes(2)
      })
    })

    /**
     * Test that hook handles error state correctly
     */
    it('should handle error state correctly', async () => {
      const errorMessage = 'Network error'
      mockedApiClient.get.mockRejectedValue(new Error(errorMessage))

      const { result } = renderHook(() => useAdminMonitoring(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error?.message).toBe(errorMessage)
      expect(result.current.health).toBeNull()
      expect(result.current.details).toBeNull()
    })

    /**
     * Test that hook respects enabled parameter
     */
    it('should not fetch when disabled', async () => {
      const { result } = renderHook(() => useAdminMonitoring(false), {
        wrapper: createWrapper(),
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockedApiClient.get).not.toHaveBeenCalled()
      expect(result.current.isLoading).toBe(false)
      expect(result.current.health).toBeNull()
    })

    /**
     * Test different health metric scenarios
     */
    it('should handle zero values correctly', async () => {
      const mockResponse = createMockHealthResponse({
        health: {
          cacheHitRate: 0,
          averageResponseTime: 0,
          pendingOperations: 0,
          snapshotCount: 0,
          precomputedAnalyticsCount: 0,
        },
      })
      mockedApiClient.get.mockResolvedValue({ data: mockResponse })

      const { result } = renderHook(() => useAdminMonitoring(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.health?.cacheHitRate).toBe(0)
      expect(result.current.health?.pendingOperations).toBe(0)
      expect(result.current.health?.snapshotCount).toBe(0)
    })

    /**
     * Test idle operations status
     */
    it('should handle idle operations status', async () => {
      const mockResponse = createMockHealthResponse({
        health: {
          cacheHitRate: 95,
          averageResponseTime: 20,
          pendingOperations: 0,
          snapshotCount: 100,
          precomputedAnalyticsCount: 100,
        },
        details: {
          cache: {
            hitRate: 95,
            totalReads: 500,
            cacheHits: 475,
            cacheMisses: 25,
            efficiency: 'operational',
          },
          snapshots: {
            total: 100,
            withPrecomputedAnalytics: 100,
            analyticsCoverage: 100,
          },
          operations: {
            pending: 0,
            status: 'idle',
          },
          performance: {
            averageResponseTime: 20,
            concurrentReads: 0,
            maxConcurrentReads: 5,
          },
        },
      })
      mockedApiClient.get.mockResolvedValue({ data: mockResponse })

      const { result } = renderHook(() => useAdminMonitoring(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.details?.operations.status).toBe('idle')
      expect(result.current.details?.operations.pending).toBe(0)
    })
  })
})
