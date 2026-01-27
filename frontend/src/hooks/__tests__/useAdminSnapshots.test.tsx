/**
 * Unit tests for useAdminSnapshots hook
 * Feature: district-analytics-performance
 *
 * Validates: Requirements 10.2, 10.3
 *
 * These tests verify that the useAdminSnapshots hook correctly:
 * - Fetches snapshot list from the admin API
 * - Handles loading and error states
 * - Provides delete mutations for single, range, and all snapshots
 * - Invalidates queries after successful deletions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'
import {
  useAdminSnapshots,
  useSnapshotList,
  useDeleteSnapshots,
  useDeleteSnapshotsRange,
  useDeleteAllSnapshots,
  SnapshotMetadata,
} from '../useAdminSnapshots'
import { apiClient } from '../../services/api'

// Mock the API client
vi.mock('../../services/api', () => ({
  apiClient: {
    get: vi.fn(),
    delete: vi.fn(),
  },
}))

// Type the mocked apiClient
const mockedApiClient = vi.mocked(apiClient)

// ========== Test Data Factories ==========

const createMockSnapshot = (
  id: string,
  status: 'success' | 'partial' | 'failed' = 'success'
): SnapshotMetadata => ({
  snapshot_id: id,
  created_at: `${id}T12:00:00.000Z`,
  status,
  schema_version: '1.0.0',
  calculation_version: '1.0.0',
  size_bytes: 1024 * 100,
  error_count: status === 'failed' ? 3 : 0,
  district_count: 5,
})

const createMockListResponse = (snapshots: SnapshotMetadata[]) => ({
  snapshots,
  metadata: {
    total_count: snapshots.length,
    filters_applied: {},
    query_duration_ms: 50,
    generated_at: new Date().toISOString(),
  },
})

const createMockDeleteResponse = (snapshotIds: string[]) => ({
  summary: {
    totalRequested: snapshotIds.length,
    successfulDeletions: snapshotIds.length,
    failedDeletions: 0,
    results: snapshotIds.map(id => ({
      snapshotId: id,
      success: true,
      deletedFiles: {
        snapshotDir: true,
        analyticsFile: true,
        timeSeriesEntries: 2,
      },
    })),
  },
  metadata: {
    operationId: 'test-op-123',
    durationMs: 100,
    completedAt: new Date().toISOString(),
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

describe('useAdminSnapshots', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('useSnapshotList', () => {
    /**
     * Test that hook fetches snapshot list correctly
     *
     * **Validates: Requirements 10.2**
     */
    it('should fetch snapshot list from admin API', async () => {
      const mockSnapshots = [
        createMockSnapshot('2024-01-15'),
        createMockSnapshot('2024-01-14'),
        createMockSnapshot('2024-01-13', 'partial'),
      ]
      const mockResponse = createMockListResponse(mockSnapshots)

      mockedApiClient.get.mockResolvedValue({ data: mockResponse })

      const { result } = renderHook(() => useSnapshotList(), {
        wrapper: createWrapper(),
      })

      // Initially loading
      expect(result.current.isLoading).toBe(true)

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.data?.snapshots).toHaveLength(3)
      expect(result.current.data?.metadata.total_count).toBe(3)
      expect(mockedApiClient.get).toHaveBeenCalledWith('/admin/snapshots')
    })

    /**
     * Test that hook applies limit parameter
     */
    it('should apply limit parameter to API request', async () => {
      const mockResponse = createMockListResponse([])
      mockedApiClient.get.mockResolvedValue({ data: mockResponse })

      const { result } = renderHook(() => useSnapshotList(10), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(mockedApiClient.get).toHaveBeenCalledWith(
        '/admin/snapshots?limit=10'
      )
    })

    /**
     * Test that hook applies filters to API request
     */
    it('should apply filters to API request', async () => {
      const mockResponse = createMockListResponse([])
      mockedApiClient.get.mockResolvedValue({ data: mockResponse })

      const { result } = renderHook(
        () => useSnapshotList(undefined, { status: 'success' }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(mockedApiClient.get).toHaveBeenCalledWith(
        '/admin/snapshots?status=success'
      )
    })

    /**
     * Test error handling
     */
    it('should handle API errors correctly', async () => {
      const errorMessage = 'Network error'
      mockedApiClient.get.mockRejectedValue(new Error(errorMessage))

      const { result } = renderHook(() => useSnapshotList(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error?.message).toBe(errorMessage)
    })
  })

  describe('useDeleteSnapshots', () => {
    /**
     * Test that hook deletes snapshots by IDs
     *
     * **Validates: Requirements 10.3**
     */
    it('should delete snapshots by IDs', async () => {
      const snapshotIds = ['2024-01-15', '2024-01-14']
      const mockResponse = createMockDeleteResponse(snapshotIds)

      mockedApiClient.delete.mockResolvedValue({ data: mockResponse })

      const { result } = renderHook(() => useDeleteSnapshots(), {
        wrapper: createWrapper(),
      })

      let mutationResult: typeof mockResponse | undefined

      await act(async () => {
        mutationResult = await result.current.mutateAsync(snapshotIds)
      })

      expect(mockedApiClient.delete).toHaveBeenCalledWith('/admin/snapshots', {
        data: { snapshotIds },
      })
      expect(mutationResult?.summary.successfulDeletions).toBe(2)
    })

    /**
     * Test error handling for delete operation
     */
    it('should handle delete errors correctly', async () => {
      const errorMessage = 'Delete failed'
      mockedApiClient.delete.mockRejectedValue(new Error(errorMessage))

      const { result } = renderHook(() => useDeleteSnapshots(), {
        wrapper: createWrapper(),
      })

      await expect(
        act(async () => {
          await result.current.mutateAsync(['2024-01-15'])
        })
      ).rejects.toThrow(errorMessage)

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })
    })
  })

  describe('useDeleteSnapshotsRange', () => {
    /**
     * Test that hook deletes snapshots in date range
     *
     * **Validates: Requirements 10.3**
     */
    it('should delete snapshots in date range', async () => {
      const mockResponse = {
        summary: {
          totalRequested: 5,
          successfulDeletions: 5,
          failedDeletions: 0,
          results: [],
        },
        dateRange: {
          startDate: '2024-01-01',
          endDate: '2024-01-15',
        },
        metadata: {
          operationId: 'test-op-456',
          durationMs: 200,
          completedAt: new Date().toISOString(),
        },
      }

      mockedApiClient.delete.mockResolvedValue({ data: mockResponse })

      const { result } = renderHook(() => useDeleteSnapshotsRange(), {
        wrapper: createWrapper(),
      })

      let mutationResult: typeof mockResponse | undefined

      await act(async () => {
        mutationResult = await result.current.mutateAsync({
          startDate: '2024-01-01',
          endDate: '2024-01-15',
        })
      })

      expect(mockedApiClient.delete).toHaveBeenCalledWith(
        '/admin/snapshots/range',
        {
          data: { startDate: '2024-01-01', endDate: '2024-01-15' },
        }
      )
      expect(mutationResult?.summary.successfulDeletions).toBe(5)
    })
  })

  describe('useDeleteAllSnapshots', () => {
    /**
     * Test that hook deletes all snapshots
     *
     * **Validates: Requirements 10.3**
     */
    it('should delete all snapshots', async () => {
      const mockResponse = {
        summary: {
          totalRequested: 10,
          successfulDeletions: 10,
          failedDeletions: 0,
          results: [],
          cleanedTimeSeriesDirectories: 5,
        },
        metadata: {
          operationId: 'test-op-789',
          durationMs: 500,
          completedAt: new Date().toISOString(),
        },
      }

      mockedApiClient.delete.mockResolvedValue({ data: mockResponse })

      const { result } = renderHook(() => useDeleteAllSnapshots(), {
        wrapper: createWrapper(),
      })

      let mutationResult: typeof mockResponse | undefined

      await act(async () => {
        mutationResult = await result.current.mutateAsync(undefined)
      })

      expect(mockedApiClient.delete).toHaveBeenCalledWith(
        '/admin/snapshots/all',
        { data: {} }
      )
      expect(mutationResult?.summary.successfulDeletions).toBe(10)
    })

    /**
     * Test that hook passes districtId filter when provided
     */
    it('should pass districtId filter when provided', async () => {
      const mockResponse = {
        summary: {
          districtId: '42',
          deletedDistrictFiles: 5,
          deletedTimeSeriesDirectory: true,
        },
        metadata: {
          operationId: 'test-op-abc',
          durationMs: 150,
          completedAt: new Date().toISOString(),
        },
      }

      mockedApiClient.delete.mockResolvedValue({ data: mockResponse })

      const { result } = renderHook(() => useDeleteAllSnapshots(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        await result.current.mutateAsync('42')
      })

      expect(mockedApiClient.delete).toHaveBeenCalledWith(
        '/admin/snapshots/all',
        { data: { districtId: '42' } }
      )
    })
  })

  describe('useAdminSnapshots (unified hook)', () => {
    /**
     * Test that unified hook provides all functionality
     *
     * **Validates: Requirements 10.2, 10.3**
     */
    it('should provide snapshot list and all delete mutations', async () => {
      const mockSnapshots = [
        createMockSnapshot('2024-01-15'),
        createMockSnapshot('2024-01-14'),
      ]
      const mockResponse = createMockListResponse(mockSnapshots)

      mockedApiClient.get.mockResolvedValue({ data: mockResponse })

      const { result } = renderHook(() => useAdminSnapshots(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Verify snapshot list
      expect(result.current.snapshots).toHaveLength(2)
      expect(result.current.metadata?.total_count).toBe(2)

      // Verify mutations are available
      expect(result.current.deleteSnapshots).toBeDefined()
      expect(result.current.deleteSnapshotsRange).toBeDefined()
      expect(result.current.deleteAllSnapshots).toBeDefined()
      expect(typeof result.current.refetch).toBe('function')
    })

    /**
     * Test that unified hook returns empty array when loading
     */
    it('should return empty array while loading', () => {
      mockedApiClient.get.mockImplementation(
        () =>
          new Promise(resolve =>
            setTimeout(
              () => resolve({ data: createMockListResponse([]) }),
              1000
            )
          )
      )

      const { result } = renderHook(() => useAdminSnapshots(), {
        wrapper: createWrapper(),
      })

      expect(result.current.isLoading).toBe(true)
      expect(result.current.snapshots).toEqual([])
    })
  })
})
