/**
 * Club Health Classification Hook
 *
 * Custom React hook for club health classification using React Query
 * Provides data fetching, caching, and state management for individual club classification
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../services/api'
import {
  ClubHealthInput,
  ClubHealthResult,
  DistrictHealthSummary,
  ClubHealthHistory,
} from '../types/clubHealth'

/**
 * Hook for classifying individual clubs with React Query mutation
 */
export const useClubHealthClassification = () => {
  const queryClient = useQueryClient()

  return useMutation<ClubHealthResult, Error, ClubHealthInput>({
    mutationFn: async (input: ClubHealthInput) => {
      const response = await apiClient.post<{
        success: boolean
        data: ClubHealthResult
        metadata?: Record<string, unknown>
      }>('/club-health/classify', input)

      // Extract the data from the API response
      return response.data.data
    },
    onSuccess: (_, variables) => {
      // Invalidate related queries to ensure fresh data
      queryClient.invalidateQueries({
        queryKey: ['clubHealthHistory', variables.club_name],
      })
      queryClient.invalidateQueries({
        queryKey: ['districtHealthSummary'],
      })
    },
    onError: error => {
      console.error('Error classifying club:', error)
    },
  })
}

export default useClubHealthClassification

/**
 * Hook for fetching district health summary with React Query
 */
export const useDistrictHealthSummary = (districtId: string | null) => {
  return useQuery<DistrictHealthSummary, Error>({
    queryKey: ['districtHealthSummary', districtId],
    queryFn: async () => {
      if (!districtId) {
        throw new Error('District ID is required')
      }
      const response = await apiClient.get<{
        success: boolean
        data: DistrictHealthSummary
        metadata?: Record<string, unknown>
      }>(`/club-health/districts/${districtId}/health-summary`)

      // Extract the data from the API response
      return response.data.data
    },
    enabled: !!districtId,
    staleTime: 10 * 60 * 1000, // 10 minutes - district summaries change less frequently
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: (failureCount, error: unknown) => {
      // Don't retry on 404 (no data) or 400 (bad request)
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { status?: number } }
        if (
          axiosError.response?.status === 404 ||
          axiosError.response?.status === 400
        ) {
          return false
        }
      }
      return failureCount < 2
    },
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}

/**
 * Hook for fetching club health history (time-series data) with React Query
 */
export const useClubHealthHistory = (
  clubName: string | null,
  months?: number
) => {
  return useQuery<ClubHealthHistory[], Error>({
    queryKey: ['clubHealthHistory', clubName, months],
    queryFn: async () => {
      if (!clubName) {
        throw new Error('Club name is required')
      }

      const params = new URLSearchParams()
      if (months) {
        params.append('months', months.toString())
      }

      const response = await apiClient.get<{
        success: boolean
        data: {
          club_name: string
          months_requested: number
          history: ClubHealthHistory[]
        }
        metadata?: Record<string, unknown>
      }>(
        `/club-health/${encodeURIComponent(clubName)}/history${
          params.toString() ? `?${params.toString()}` : ''
        }`
      )

      // Extract the history array from the nested data structure
      return response.data.data.history
    },
    enabled: !!clubName,
    staleTime: 5 * 60 * 1000, // 5 minutes - history data is relatively stable
    gcTime: 15 * 60 * 1000, // 15 minutes
    retry: (failureCount, error: unknown) => {
      // Don't retry on 404 (club not found) or 400 (bad request)
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { status?: number } }
        if (
          axiosError.response?.status === 404 ||
          axiosError.response?.status === 400
        ) {
          return false
        }
      }
      return failureCount < 2
    },
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}

/**
 * Hook for fetching multiple clubs health data for a district
 */
export const useDistrictClubsHealth = (districtId: string | null) => {
  return useQuery<ClubHealthResult[], Error>({
    queryKey: ['districtClubsHealth', districtId],
    queryFn: async () => {
      if (!districtId) {
        throw new Error('District ID is required')
      }
      const response = await apiClient.get<{
        success: boolean
        data: ClubHealthResult[]
        metadata?: Record<string, unknown>
      }>(`/club-health/districts/${districtId}/club-health`)

      // Extract the data array from the API response
      return response.data.data
    },
    enabled: !!districtId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    retry: (failureCount, error: unknown) => {
      // Don't retry on 404 (no data) or 400 (bad request)
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { status?: number } }
        if (
          axiosError.response?.status === 404 ||
          axiosError.response?.status === 400
        ) {
          return false
        }
      }
      return failureCount < 2
    },
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}

/**
 * Hook for refreshing club data from external sources
 */
export const useClubHealthRefresh = () => {
  const queryClient = useQueryClient()

  return useMutation<
    ClubHealthResult,
    Error,
    { clubName: string; districtId?: string }
  >({
    mutationFn: async ({ clubName, districtId }) => {
      const response = await apiClient.post<{
        success: boolean
        data: ClubHealthResult
        metadata?: Record<string, unknown>
      }>(`/club-health/refresh/${encodeURIComponent(clubName)}`, { districtId })

      // Extract the data from the API response
      return response.data.data
    },
    onSuccess: (_, variables) => {
      // Invalidate related queries to ensure fresh data
      queryClient.invalidateQueries({
        queryKey: ['clubHealthHistory', variables.clubName],
      })
      queryClient.invalidateQueries({
        queryKey: ['districtHealthSummary'],
      })
      queryClient.invalidateQueries({
        queryKey: ['districtClubsHealth'],
      })
    },
    onError: error => {
      console.error('Error refreshing club data:', error)
    },
  })
}

/**
 * Hook for refreshing all club data for a district from external sources
 */
export const useDistrictClubHealthRefresh = () => {
  const queryClient = useQueryClient()

  return useMutation<ClubHealthResult[], Error, string>({
    mutationFn: async (districtId: string) => {
      const response = await apiClient.post<{
        success: boolean
        data: ClubHealthResult[]
        metadata?: Record<string, unknown>
      }>(`/club-health/refresh/district/${districtId}`)

      // Extract the data from the API response
      return response.data.data
    },
    onSuccess: (_, districtId) => {
      // Invalidate all related queries for the district
      queryClient.invalidateQueries({
        queryKey: ['districtHealthSummary', districtId],
      })
      queryClient.invalidateQueries({
        queryKey: ['districtClubsHealth', districtId],
      })
      // Also invalidate individual club histories
      queryClient.invalidateQueries({
        queryKey: ['clubHealthHistory'],
      })
    },
    onError: error => {
      console.error('Error refreshing district club data:', error)
    },
  })
}

// Re-export for backward compatibility
export { useClubHealthClassification as useClubHealth }
