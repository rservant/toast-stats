/**
 * Unit tests for useAdminBackfill hook
 * Feature: district-analytics-performance
 *
 * Validates: Requirements 10.4, 10.6
 *
 * These tests verify that the useAdminBackfill hook correctly:
 * - Triggers backfill operations via POST /api/admin/backfill
 * - Polls for progress via GET /api/admin/backfill/:jobId
 * - Cancels backfill via DELETE /api/admin/backfill/:jobId
 * - Handles loading and error states appropriately
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'
import {
  useAdminBackfill,
  useTriggerBackfill,
  useBackfillProgress,
  useCancelBackfill,
  BackfillTriggerResponse,
  BackfillProgressResponse,
  BackfillCancelResponse,
  BackfillJobStatus,
} from '../useAdminBackfill'
import { apiClient } from '../../services/api'

// Mock the API client
vi.mock('../../services/api', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}))

// Type the mocked apiClient
const mockedApiClient = vi.mocked(apiClient)

// ========== Test Data Factories ==========

const createMockTriggerResponse = (
  jobId: string = 'backfill_123_abc'
): BackfillTriggerResponse => ({
  jobId,
  status: 'pending',
  message: 'Backfill job created and queued for processing',
  metadata: {
    operationId: 'op_123',
    createdAt: new Date().toISOString(),
  },
})

const createMockProgressResponse = (
  jobId: string,
  status: BackfillJobStatus = 'running',
  percentComplete: number = 50
): BackfillProgressResponse => ({
  jobId,
  options: {},
  progress: {
    status,
    totalSnapshots: 100,
    processedSnapshots: percentComplete,
    percentComplete,
    currentSnapshot: status === 'running' ? '2024-01-15' : undefined,
    startedAt: '2024-01-20T10:00:00.000Z',
    completedAt:
      status === 'completed' || status === 'failed' || status === 'cancelled'
        ? '2024-01-20T10:30:00.000Z'
        : undefined,
    estimatedTimeRemaining: status === 'running' ? 300 : undefined,
    errors: [],
  },
  metadata: {
    operationId: 'op_456',
    retrievedAt: new Date().toISOString(),
  },
})

const createMockCancelResponse = (
  jobId: string
): BackfillCancelResponse => ({
  jobId,
  cancelled: true,
  previousStatus: 'running',
  message: 'Backfill job has been cancelled',
  metadata: {
    operationId: 'op_789',
    cancelledAt: new Date().toISOString(),
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

describe('useAdminBackfill', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('useTriggerBackfill', () => {
    /**
     * Test that hook triggers backfill via POST endpoint
     *
     * **Validates: Requirements 10.4**
     */
    it('should trigger backfill via POST /api/admin/backfill', async () => {
      const mockResponse = createMockTriggerResponse()
      mockedApiClient.post.mockResolvedValue({ data: mockResponse })

      const { result } = renderHook(() => useTriggerBackfill(), {
        wrapper: createWrapper(),
      })

      let triggerResult: BackfillTriggerResponse | undefined

      await act(async () => {
        triggerResult = await result.current.mutateAsync({})
      })

      expect(mockedApiClient.post).toHaveBeenCalledWith('/admin/backfill', {})
      expect(triggerResult?.jobId).toBe('backfill_123_abc')
      expect(triggerResult?.status).toBe('pending')
    })

    /**
     * Test that hook passes options to the API
     */
    it('should pass backfill options to API', async () => {
      const mockResponse = createMockTriggerResponse()
      mockedApiClient.post.mockResolvedValue({ data: mockResponse })

      const { result } = renderHook(() => useTriggerBackfill(), {
        wrapper: createWrapper(),
      })

      const options = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        districtIds: ['42', '61'],
      }

      await act(async () => {
        await result.current.mutateAsync(options)
      })

      expect(mockedApiClient.post).toHaveBeenCalledWith(
        '/admin/backfill',
        options
      )
    })

    /**
     * Test error handling for trigger operation
     */
    it('should handle trigger errors correctly', async () => {
      const errorMessage = 'Failed to create backfill job'
      mockedApiClient.post.mockRejectedValue(new Error(errorMessage))

      const { result } = renderHook(() => useTriggerBackfill(), {
        wrapper: createWrapper(),
      })

      await expect(
        act(async () => {
          await result.current.mutateAsync({})
        })
      ).rejects.toThrow(errorMessage)

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })
    })
  })

  describe('useBackfillProgress', () => {
    /**
     * Test that hook fetches progress from GET endpoint
     *
     * **Validates: Requirements 10.6**
     */
    it('should fetch backfill progress via GET /api/admin/backfill/:jobId', async () => {
      const jobId = 'backfill_123_abc'
      const mockResponse = createMockProgressResponse(jobId, 'running', 50)
      mockedApiClient.get.mockResolvedValue({ data: mockResponse })

      const { result } = renderHook(() => useBackfillProgress(jobId), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(mockedApiClient.get).toHaveBeenCalledWith(
        `/admin/backfill/${jobId}`
      )
      expect(result.current.data?.progress.status).toBe('running')
      expect(result.current.data?.progress.percentComplete).toBe(50)
    })

    /**
     * Test that hook does not fetch when jobId is null
     */
    it('should not fetch when jobId is null', async () => {
      const { result } = renderHook(() => useBackfillProgress(null), {
        wrapper: createWrapper(),
      })

      // Wait a bit to ensure no fetch happens
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockedApiClient.get).not.toHaveBeenCalled()
      expect(result.current.data).toBeUndefined()
    })

    /**
     * Test that hook does not fetch when disabled
     */
    it('should not fetch when disabled', async () => {
      const { result } = renderHook(
        () => useBackfillProgress('backfill_123', false),
        { wrapper: createWrapper() }
      )

      // Wait a bit to ensure no fetch happens
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockedApiClient.get).not.toHaveBeenCalled()
      expect(result.current.data).toBeUndefined()
    })

    /**
     * Test error handling for progress fetch
     */
    it('should handle progress fetch errors correctly', async () => {
      const errorMessage = 'Job not found'
      mockedApiClient.get.mockRejectedValue(new Error(errorMessage))

      const { result } = renderHook(
        () => useBackfillProgress('backfill_invalid'),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error?.message).toBe(errorMessage)
    })
  })

  describe('useCancelBackfill', () => {
    /**
     * Test that hook cancels backfill via DELETE endpoint
     *
     * **Validates: Requirements 10.4**
     */
    it('should cancel backfill via DELETE /api/admin/backfill/:jobId', async () => {
      const jobId = 'backfill_123_abc'
      const mockResponse = createMockCancelResponse(jobId)
      mockedApiClient.delete.mockResolvedValue({ data: mockResponse })

      const { result } = renderHook(() => useCancelBackfill(), {
        wrapper: createWrapper(),
      })

      let cancelResult: BackfillCancelResponse | undefined

      await act(async () => {
        cancelResult = await result.current.mutateAsync(jobId)
      })

      expect(mockedApiClient.delete).toHaveBeenCalledWith(
        `/admin/backfill/${jobId}`
      )
      expect(cancelResult?.cancelled).toBe(true)
      expect(cancelResult?.previousStatus).toBe('running')
    })

    /**
     * Test error handling for cancel operation
     */
    it('should handle cancel errors correctly', async () => {
      const errorMessage = 'Cannot cancel completed job'
      mockedApiClient.delete.mockRejectedValue(new Error(errorMessage))

      const { result } = renderHook(() => useCancelBackfill(), {
        wrapper: createWrapper(),
      })

      await expect(
        act(async () => {
          await result.current.mutateAsync('backfill_completed')
        })
      ).rejects.toThrow(errorMessage)

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })
    })
  })

  describe('useAdminBackfill (unified hook)', () => {
    /**
     * Test that unified hook provides all functionality
     *
     * **Validates: Requirements 10.4, 10.6**
     */
    it('should provide trigger, progress, and cancel functionality', async () => {
      const jobId = 'backfill_123_abc'
      const mockProgressResponse = createMockProgressResponse(
        jobId,
        'running',
        50
      )
      mockedApiClient.get.mockResolvedValue({ data: mockProgressResponse })

      const { result } = renderHook(() => useAdminBackfill(jobId), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.progress.isLoading).toBe(false)
      })

      // Verify all parts are available
      expect(result.current.triggerBackfill).toBeDefined()
      expect(result.current.progress).toBeDefined()
      expect(result.current.cancelBackfill).toBeDefined()
      expect(result.current.isBackfillRunning).toBe(true)
      expect(result.current.isBackfillComplete).toBe(false)
      expect(result.current.backfillStatus).toBe('running')
    })

    /**
     * Test that isBackfillRunning is true for pending status
     */
    it('should report isBackfillRunning true for pending status', async () => {
      const jobId = 'backfill_pending'
      const mockResponse = createMockProgressResponse(jobId, 'pending', 0)
      mockedApiClient.get.mockResolvedValue({ data: mockResponse })

      const { result } = renderHook(() => useAdminBackfill(jobId), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.progress.isLoading).toBe(false)
      })

      expect(result.current.isBackfillRunning).toBe(true)
      expect(result.current.isBackfillComplete).toBe(false)
    })

    /**
     * Test that isBackfillComplete is true for completed status
     */
    it('should report isBackfillComplete true for completed status', async () => {
      const jobId = 'backfill_done'
      const mockResponse = createMockProgressResponse(jobId, 'completed', 100)
      mockedApiClient.get.mockResolvedValue({ data: mockResponse })

      const { result } = renderHook(() => useAdminBackfill(jobId), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.progress.isLoading).toBe(false)
      })

      expect(result.current.isBackfillRunning).toBe(false)
      expect(result.current.isBackfillComplete).toBe(true)
      expect(result.current.backfillStatus).toBe('completed')
    })

    /**
     * Test that isBackfillComplete is true for failed status
     */
    it('should report isBackfillComplete true for failed status', async () => {
      const jobId = 'backfill_failed'
      const mockResponse = createMockProgressResponse(jobId, 'failed', 30)
      mockedApiClient.get.mockResolvedValue({ data: mockResponse })

      const { result } = renderHook(() => useAdminBackfill(jobId), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.progress.isLoading).toBe(false)
      })

      expect(result.current.isBackfillRunning).toBe(false)
      expect(result.current.isBackfillComplete).toBe(true)
      expect(result.current.backfillStatus).toBe('failed')
    })

    /**
     * Test that isBackfillComplete is true for cancelled status
     */
    it('should report isBackfillComplete true for cancelled status', async () => {
      const jobId = 'backfill_cancelled'
      const mockResponse = createMockProgressResponse(jobId, 'cancelled', 45)
      mockedApiClient.get.mockResolvedValue({ data: mockResponse })

      const { result } = renderHook(() => useAdminBackfill(jobId), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.progress.isLoading).toBe(false)
      })

      expect(result.current.isBackfillRunning).toBe(false)
      expect(result.current.isBackfillComplete).toBe(true)
      expect(result.current.backfillStatus).toBe('cancelled')
    })

    /**
     * Test that hook returns null status when no jobId provided
     */
    it('should return null status when no jobId provided', () => {
      const { result } = renderHook(() => useAdminBackfill(null), {
        wrapper: createWrapper(),
      })

      expect(result.current.backfillStatus).toBeNull()
      expect(result.current.isBackfillRunning).toBe(false)
      expect(result.current.isBackfillComplete).toBe(false)
    })
  })
})
