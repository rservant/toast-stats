import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../services/api'
import type {
  HealthResponse,
  PerformanceResponse,
  PerformanceResetResponse,
  IntegrityResponse,
  ComplianceResponse,
  SnapshotsListResponse,
  SnapshotFilters,
} from '../types/admin'

/**
 * Hook to fetch snapshot store health status
 *
 * @param enabled - Whether the query should be enabled
 * @returns Query result with health data
 */
export const useAdminHealth = (enabled: boolean = true) => {
  return useQuery<HealthResponse, Error>({
    queryKey: ['admin', 'health'],
    queryFn: async () => {
      const response = await apiClient.get<HealthResponse>(
        '/admin/snapshot-store/health'
      )
      return response.data
    },
    enabled,
    staleTime: 30 * 1000, // 30 seconds - health data should be relatively fresh
    refetchInterval: 60 * 1000, // Auto-refresh every minute
    retry: 2,
  })
}

/**
 * Hook to fetch snapshot store performance metrics
 *
 * @param enabled - Whether the query should be enabled
 * @returns Query result with performance metrics
 */
export const useAdminPerformance = (enabled: boolean = true) => {
  return useQuery<PerformanceResponse, Error>({
    queryKey: ['admin', 'performance'],
    queryFn: async () => {
      const response = await apiClient.get<PerformanceResponse>(
        '/admin/snapshot-store/performance'
      )
      return response.data
    },
    enabled,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    retry: 2,
  })
}

/**
 * Hook to reset performance metrics
 *
 * @returns Mutation for resetting performance metrics
 */
export const useResetPerformanceMetrics = () => {
  const queryClient = useQueryClient()

  return useMutation<PerformanceResetResponse, Error>({
    mutationFn: async () => {
      const response = await apiClient.post<PerformanceResetResponse>(
        '/admin/snapshot-store/performance/reset'
      )
      return response.data
    },
    onSuccess: () => {
      // Invalidate performance query to refetch fresh data
      queryClient.invalidateQueries({ queryKey: ['admin', 'performance'] })
    },
  })
}

/**
 * Hook to fetch snapshot store integrity status
 *
 * @param enabled - Whether the query should be enabled
 * @returns Query result with integrity data
 */
export const useAdminIntegrity = (enabled: boolean = true) => {
  return useQuery<IntegrityResponse, Error>({
    queryKey: ['admin', 'integrity'],
    queryFn: async () => {
      const response = await apiClient.get<IntegrityResponse>(
        '/admin/snapshot-store/integrity'
      )
      return response.data
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes - integrity checks are expensive
    retry: 2,
  })
}

/**
 * Hook to fetch process separation compliance metrics
 *
 * @param enabled - Whether the query should be enabled
 * @returns Query result with compliance metrics
 */
export const useProcessSeparationCompliance = (enabled: boolean = true) => {
  return useQuery<ComplianceResponse, Error>({
    queryKey: ['admin', 'process-separation', 'compliance'],
    queryFn: async () => {
      const response = await apiClient.get<ComplianceResponse>(
        '/admin/process-separation/compliance'
      )
      return response.data
    },
    enabled,
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 2 * 60 * 1000, // Auto-refresh every 2 minutes
    retry: 2,
  })
}

/**
 * Hook to fetch snapshots list with optional filtering
 *
 * @param filters - Optional filters for the snapshots list
 * @param limit - Maximum number of snapshots to return
 * @param enabled - Whether the query should be enabled
 * @returns Query result with snapshots list
 */
export const useAdminSnapshots = (
  filters?: SnapshotFilters,
  limit?: number,
  enabled: boolean = true
) => {
  return useQuery<SnapshotsListResponse, Error>({
    queryKey: ['admin', 'snapshots', filters, limit],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (limit) params.append('limit', limit.toString())
      if (filters?.status) params.append('status', filters.status)
      if (filters?.schema_version)
        params.append('schema_version', filters.schema_version)
      if (filters?.calculation_version)
        params.append('calculation_version', filters.calculation_version)
      if (filters?.created_after)
        params.append('created_after', filters.created_after)
      if (filters?.created_before)
        params.append('created_before', filters.created_before)
      if (filters?.min_district_count)
        params.append('min_district_count', filters.min_district_count.toString())

      const url = `/admin/snapshots${params.toString() ? `?${params.toString()}` : ''}`
      const response = await apiClient.get<SnapshotsListResponse>(url)
      return response.data
    },
    enabled,
    staleTime: 60 * 1000,
    retry: 2,
  })
}
