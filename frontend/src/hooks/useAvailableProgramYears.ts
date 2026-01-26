import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { apiClient } from '../services/api'
import type { AvailableRankingYearsResponse } from '../types/districts'

/**
 * Query key factory for available program years queries
 */
export const availableProgramYearsQueryKeys = {
  all: ['available-ranking-years'] as const,
  byDistrict: (districtId: string) =>
    ['available-ranking-years', districtId] as const,
}

interface UseAvailableProgramYearsParams {
  /** District ID to fetch available program years for */
  districtId: string
  /** Whether the query should be enabled (default: true) */
  enabled?: boolean
}

interface UseAvailableProgramYearsResult {
  /** The available program years data */
  data: AvailableRankingYearsResponse | undefined
  /** Whether the query is currently loading */
  isLoading: boolean
  /** Whether the query encountered an error */
  isError: boolean
  /** The error if one occurred */
  error: Error | null
  /** Whether the data is loaded but contains no program years */
  isEmpty: boolean
  /** Function to manually refetch the data */
  refetch: () => void
}

/**
 * React Query hook to fetch available program years with ranking data for a district.
 *
 * This hook fetches from the `/api/districts/:districtId/available-ranking-years` endpoint
 * and returns information about which program years have ranking data available,
 * including snapshot counts and data completeness status.
 *
 * @param params - Hook parameters including districtId and optional enabled flag
 * @returns Query result with program years data, loading state, error state, isEmpty flag, and refetch function
 *
 * @example
 * ```tsx
 * const { data, isLoading, isError, error, isEmpty, refetch } = useAvailableProgramYears({
 *   districtId: '57',
 * })
 *
 * if (isLoading) return <LoadingSpinner />
 * if (isError) return <ErrorMessage error={error} onRetry={refetch} />
 * if (isEmpty) return <EmptyState message="No program years available" />
 *
 * return (
 *   <ProgramYearSelector
 *     programYears={data?.programYears ?? []}
 *     onSelect={handleYearSelect}
 *   />
 * )
 * ```
 */
export const useAvailableProgramYears = ({
  districtId,
  enabled = true,
}: UseAvailableProgramYearsParams): UseAvailableProgramYearsResult => {
  const query: UseQueryResult<AvailableRankingYearsResponse, Error> = useQuery<
    AvailableRankingYearsResponse,
    Error
  >({
    queryKey: availableProgramYearsQueryKeys.byDistrict(districtId),
    queryFn: async () => {
      const response = await apiClient.get<AvailableRankingYearsResponse>(
        `/districts/${districtId}/available-ranking-years`
      )
      return response.data
    },
    enabled: enabled && !!districtId,
    staleTime: 15 * 60 * 1000, // 15 minutes - matches other district data hooks
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
      // Retry up to 2 times for network errors
      return failureCount < 2
    },
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  })

  // Compute isEmpty: data is loaded but contains no program years
  const isEmpty =
    !query.isLoading &&
    !query.isError &&
    (query.data?.programYears?.length ?? 0) === 0

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isEmpty,
    refetch: query.refetch,
  }
}
