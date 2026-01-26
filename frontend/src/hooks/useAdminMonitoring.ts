/**
 * useAdminMonitoring Hook
 *
 * Provides functionality for fetching system health metrics from the admin API:
 * - Fetches from GET /api/admin/health endpoint
 * - Auto-refreshes every 30 seconds
 * - Returns health metrics, loading, and error states
 *
 * Also provides backward-compatible hooks for AdminDashboardPage:
 * - useAdminHealth: Fetches snapshot store health
 * - useAdminPerformance: Fetches performance metrics
 * - useResetPerformanceMetrics: Resets performance metrics
 * - useProcessSeparationCompliance: Fetches compliance metrics
 * - useAdminSnapshots: Fetches snapshot list
 *
 * Requirements: 10.5
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../services/api'
import type {
  HealthResponse,
  PerformanceResponse,
  PerformanceResetResponse,
  ComplianceResponse,
  SnapshotsListResponse,
  SnapshotFilters,
} from '../types/admin'

// ============================================================================
// Type Definitions for System Health (Task 10.4)
// ============================================================================

/**
 * Cache performance details
 */
export interface CacheDetails {
  /** Cache hit rate as a percentage (0-100) */
  hitRate: number
  /** Total number of read operations */
  totalReads: number
  /** Number of cache hits */
  cacheHits: number
  /** Number of cache misses */
  cacheMisses: number
  /** Cache efficiency status */
  efficiency: 'operational' | 'no_data'
}

/**
 * Snapshot coverage details
 */
export interface SnapshotDetails {
  /** Total number of snapshots */
  total: number
  /** Number of snapshots with pre-computed analytics */
  withPrecomputedAnalytics: number
  /** Analytics coverage percentage (0-100) */
  analyticsCoverage: number
}

/**
 * Operations status details
 */
export interface OperationsDetails {
  /** Number of pending operations */
  pending: number
  /** Current operations status */
  status: 'processing' | 'idle'
}

/**
 * Performance metrics details
 */
export interface PerformanceDetails {
  /** Average response time in milliseconds */
  averageResponseTime: number
  /** Current number of concurrent reads */
  concurrentReads: number
  /** Maximum concurrent reads observed */
  maxConcurrentReads: number
}

/**
 * System health metrics from the admin API
 */
export interface SystemHealthMetrics {
  /** Cache hit rate as a percentage (0-100) */
  cacheHitRate: number
  /** Average response time in milliseconds for analytics requests */
  averageResponseTime: number
  /** Number of pending background operations (e.g., backfill jobs) */
  pendingOperations: number
  /** Total number of snapshots in the store */
  snapshotCount: number
  /** Number of snapshots with pre-computed analytics */
  precomputedAnalyticsCount: number
}

/**
 * Detailed health information
 */
export interface SystemHealthDetails {
  /** Cache performance details */
  cache: CacheDetails
  /** Snapshot coverage details */
  snapshots: SnapshotDetails
  /** Operations status details */
  operations: OperationsDetails
  /** Performance metrics details */
  performance: PerformanceDetails
}

/**
 * Response metadata
 */
export interface HealthResponseMetadata {
  /** ISO timestamp when the health check was performed */
  checked_at: string
  /** Duration of the health check in milliseconds */
  check_duration_ms: number
  /** Unique operation identifier */
  operation_id: string
}

/**
 * Response from GET /api/admin/health
 */
export interface SystemHealthResponse {
  /** Summary health metrics */
  health: SystemHealthMetrics
  /** Detailed health information */
  details: SystemHealthDetails
  /** Response metadata */
  metadata: HealthResponseMetadata
}

// ============================================================================
// System Health Hook Implementation (Task 10.4)
// ============================================================================

/**
 * Default auto-refresh interval in milliseconds (30 seconds)
 */
const DEFAULT_REFRESH_INTERVAL = 30000

/**
 * Hook to fetch system health metrics
 *
 * Automatically polls the health endpoint at the specified interval.
 *
 * @param enabled - Whether the query is enabled (default: true)
 * @param refetchInterval - Auto-refresh interval in milliseconds (default: 30000)
 *
 * @example
 * const { data, isLoading, error, refetch } = useSystemHealth()
 */
export function useSystemHealth(
  enabled: boolean = true,
  refetchInterval: number = DEFAULT_REFRESH_INTERVAL
) {
  return useQuery({
    queryKey: ['admin-health'],
    queryFn: async () => {
      const response =
        await apiClient.get<SystemHealthResponse>('/admin/health')
      return response.data
    },
    enabled,
    refetchInterval,
    refetchIntervalInBackground: false, // Don't poll when tab is not visible
    staleTime: 10000, // Consider data stale after 10 seconds
  })
}

/**
 * Result type for the unified useAdminMonitoring hook
 */
export interface UseAdminMonitoringResult {
  /** Summary health metrics */
  health: SystemHealthMetrics | null
  /** Detailed health information */
  details: SystemHealthDetails | null
  /** Response metadata */
  metadata: HealthResponseMetadata | null
  /** Whether the query is currently loading */
  isLoading: boolean
  /** Whether the query encountered an error */
  isError: boolean
  /** Error object if the query failed */
  error: Error | null
  /** Function to manually trigger a refetch */
  refetch: () => void
  /** ISO timestamp of the last successful fetch */
  lastUpdated: string | null
}

/**
 * Unified hook for admin monitoring operations
 *
 * Provides a single interface for fetching and monitoring system health metrics
 * from the admin panel.
 *
 * @param enabled - Whether the query is enabled (default: true)
 * @param refetchInterval - Auto-refresh interval in milliseconds (default: 30000)
 *
 * @example
 * const {
 *   health,
 *   details,
 *   isLoading,
 *   isError,
 *   error,
 *   refetch,
 *   lastUpdated
 * } = useAdminMonitoring()
 *
 * // Display cache hit rate
 * if (health) {
 *   console.log(`Cache hit rate: ${health.cacheHitRate}%`)
 * }
 *
 * // Manual refresh
 * refetch()
 *
 * Requirements: 10.5
 */
export function useAdminMonitoring(
  enabled: boolean = true,
  refetchInterval: number = DEFAULT_REFRESH_INTERVAL
): UseAdminMonitoringResult {
  const queryClient = useQueryClient()
  const healthQuery = useSystemHealth(enabled, refetchInterval)

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-health'] })
  }

  return {
    health: healthQuery.data?.health ?? null,
    details: healthQuery.data?.details ?? null,
    metadata: healthQuery.data?.metadata ?? null,
    isLoading: healthQuery.isLoading,
    isError: healthQuery.isError,
    error: healthQuery.error,
    refetch,
    lastUpdated: healthQuery.data?.metadata?.checked_at ?? null,
  }
}

// ============================================================================
// Backward-Compatible Hooks for AdminDashboardPage
// ============================================================================

/**
 * Hook to fetch snapshot store health
 * Used by AdminDashboardPage
 */
export function useAdminHealth() {
  return useQuery({
    queryKey: ['admin-snapshot-store-health'],
    queryFn: async () => {
      const response = await apiClient.get<HealthResponse>(
        '/admin/snapshot-store/health'
      )
      return response.data
    },
    staleTime: 30000,
  })
}

/**
 * Hook to fetch performance metrics
 * Used by AdminDashboardPage
 */
export function useAdminPerformance() {
  return useQuery({
    queryKey: ['admin-snapshot-store-performance'],
    queryFn: async () => {
      const response = await apiClient.get<PerformanceResponse>(
        '/admin/snapshot-store/performance'
      )
      return response.data
    },
    staleTime: 30000,
  })
}

/**
 * Hook to reset performance metrics
 * Used by AdminDashboardPage
 */
export function useResetPerformanceMetrics() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<PerformanceResetResponse>(
        '/admin/snapshot-store/performance/reset'
      )
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['admin-snapshot-store-performance'],
      })
    },
  })
}

/**
 * Hook to fetch process separation compliance metrics
 * Used by AdminDashboardPage
 */
export function useProcessSeparationCompliance() {
  return useQuery({
    queryKey: ['admin-process-separation-compliance'],
    queryFn: async () => {
      const response = await apiClient.get<ComplianceResponse>(
        '/admin/process-separation/compliance'
      )
      return response.data
    },
    staleTime: 30000,
  })
}

/**
 * Hook to fetch snapshot list
 * Used by AdminDashboardPage
 *
 * @param filters - Optional filters for the query
 * @param limit - Maximum number of snapshots to return
 */
export function useAdminSnapshots(filters?: SnapshotFilters, limit?: number) {
  return useQuery({
    queryKey: ['admin-snapshots-list', filters, limit],
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
          params.append(
            'min_district_count',
            filters.min_district_count.toString()
          )
      }

      const queryString = params.toString()
      const url = queryString
        ? `/admin/snapshots?${queryString}`
        : '/admin/snapshots'

      const response = await apiClient.get<SnapshotsListResponse>(url)
      return response.data
    },
    staleTime: 30000,
  })
}
