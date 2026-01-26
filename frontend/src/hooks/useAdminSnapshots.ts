import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../services/api'

/**
 * Snapshot metadata returned from the admin API
 */
export interface SnapshotMetadata {
  snapshot_id: string
  created_at: string
  status: 'success' | 'partial' | 'failed'
  schema_version: string
  calculation_version: string
  size_bytes: number
  error_count: number
  district_count: number
}

/**
 * Response from the list snapshots endpoint
 */
interface ListSnapshotsResponse {
  snapshots: SnapshotMetadata[]
  metadata: {
    total_count: number
    filters_applied: Record<string, unknown>
    limit_applied?: number
    query_duration_ms: number
    generated_at: string
  }
}

/**
 * Filters for listing snapshots
 */
export interface SnapshotFilters {
  status?: 'success' | 'partial' | 'failed'
  schema_version?: string
  calculation_version?: string
  created_after?: string
  created_before?: string
  min_district_count?: number
}

/**
 * Result of a single snapshot deletion
 */
interface SnapshotDeletionResult {
  snapshotId: string
  success: boolean
  error?: string
  deletedFiles: {
    snapshotDir: boolean
    analyticsFile: boolean
    timeSeriesEntries: number
  }
}

/**
 * Summary of a batch deletion operation
 */
interface DeletionSummary {
  totalRequested: number
  successfulDeletions: number
  failedDeletions: number
  results: SnapshotDeletionResult[]
}

/**
 * Response from delete snapshots endpoint
 */
interface DeleteSnapshotsResponse {
  summary: DeletionSummary
  metadata: {
    operationId: string
    durationMs: number
    completedAt: string
  }
}

/**
 * Response from delete snapshots range endpoint
 */
interface DeleteSnapshotsRangeResponse {
  summary: DeletionSummary
  dateRange: {
    startDate: string
    endDate: string
  }
  metadata: {
    operationId: string
    durationMs: number
    completedAt: string
  }
}

/**
 * Response from delete all snapshots endpoint
 */
interface DeleteAllSnapshotsResponse {
  summary: DeletionSummary & {
    cleanedTimeSeriesDirectories?: number
  }
  metadata: {
    operationId: string
    durationMs: number
    completedAt: string
  }
}

/**
 * Hook to fetch the list of snapshots
 *
 * @param limit - Maximum number of snapshots to return
 * @param filters - Optional filters for the query
 * @param enabled - Whether the query is enabled
 */
export function useSnapshotList(
  limit?: number,
  filters?: SnapshotFilters,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['admin-snapshots', limit, filters],
    queryFn: async () => {
      const params = new URLSearchParams()

      if (limit !== undefined) {
        params.append('limit', limit.toString())
      }

      if (filters) {
        if (filters.status) params.append('status', filters.status)
        if (filters.schema_version)
          params.append('schema_version', filters.schema_version)
        if (filters.calculation_version)
          params.append('calculation_version', filters.calculation_version)
        if (filters.created_after)
          params.append('created_after', filters.created_after)
        if (filters.created_before)
          params.append('created_before', filters.created_before)
        if (filters.min_district_count !== undefined)
          params.append('min_district_count', filters.min_district_count.toString())
      }

      const queryString = params.toString()
      const url = queryString
        ? `/admin/snapshots?${queryString}`
        : '/admin/snapshots'

      const response = await apiClient.get<ListSnapshotsResponse>(url)
      return response.data
    },
    enabled,
    staleTime: 30000, // Consider data stale after 30 seconds
  })
}

/**
 * Hook to delete snapshots by IDs
 */
export function useDeleteSnapshots() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (snapshotIds: string[]) => {
      const response = await apiClient.delete<DeleteSnapshotsResponse>(
        '/admin/snapshots',
        { data: { snapshotIds } }
      )
      return response.data
    },
    onSuccess: () => {
      // Invalidate the snapshot list to refresh
      queryClient.invalidateQueries({ queryKey: ['admin-snapshots'] })
    },
  })
}

/**
 * Hook to delete snapshots within a date range
 */
export function useDeleteSnapshotsRange() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      startDate,
      endDate,
    }: {
      startDate: string
      endDate: string
    }) => {
      const response = await apiClient.delete<DeleteSnapshotsRangeResponse>(
        '/admin/snapshots/range',
        { data: { startDate, endDate } }
      )
      return response.data
    },
    onSuccess: () => {
      // Invalidate the snapshot list to refresh
      queryClient.invalidateQueries({ queryKey: ['admin-snapshots'] })
    },
  })
}

/**
 * Hook to delete all snapshots
 */
export function useDeleteAllSnapshots() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (districtId?: string) => {
      const response = await apiClient.delete<DeleteAllSnapshotsResponse>(
        '/admin/snapshots/all',
        { data: districtId ? { districtId } : {} }
      )
      return response.data
    },
    onSuccess: () => {
      // Invalidate the snapshot list to refresh
      queryClient.invalidateQueries({ queryKey: ['admin-snapshots'] })
    },
  })
}

/**
 * Unified hook for admin snapshot operations
 *
 * Provides a single interface for listing and managing snapshots
 *
 * @param limit - Maximum number of snapshots to return
 * @param filters - Optional filters for the query
 * @param enabled - Whether the query is enabled
 *
 * @example
 * const {
 *   snapshots,
 *   isLoading,
 *   deleteSnapshots,
 *   deleteSnapshotsRange,
 *   deleteAllSnapshots
 * } = useAdminSnapshots()
 */
export function useAdminSnapshots(
  limit?: number,
  filters?: SnapshotFilters,
  enabled: boolean = true
) {
  const snapshotList = useSnapshotList(limit, filters, enabled)
  const deleteSnapshots = useDeleteSnapshots()
  const deleteSnapshotsRange = useDeleteSnapshotsRange()
  const deleteAllSnapshots = useDeleteAllSnapshots()

  return {
    // Query results
    snapshots: snapshotList.data?.snapshots ?? [],
    metadata: snapshotList.data?.metadata,
    isLoading: snapshotList.isLoading,
    isError: snapshotList.isError,
    error: snapshotList.error,
    refetch: snapshotList.refetch,

    // Mutations
    deleteSnapshots,
    deleteSnapshotsRange,
    deleteAllSnapshots,
  }
}
