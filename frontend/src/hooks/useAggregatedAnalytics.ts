/**
 * useAggregatedAnalytics Hook
 *
 * Provides functionality for fetching aggregated analytics data from the
 * `/api/districts/:districtId/analytics-summary` endpoint.
 *
 * Features:
 * - Fetches combined summary, trends, and yearOverYear data in a single request
 * - Falls back to individual endpoints if the aggregated endpoint fails
 * - Uses React Query for caching and state management
 *
 * Requirements: 5.1
 */

import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../services/api'
import type { DistrictAnalytics } from './useDistrictAnalytics'

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Club counts breakdown by health status
 */
export interface ClubCounts {
  /** Total number of clubs */
  total: number
  /** Number of thriving clubs */
  thriving: number
  /** Number of vulnerable clubs */
  vulnerable: number
  /** Number of clubs requiring intervention */
  interventionRequired: number
}

/**
 * Distinguished clubs breakdown by level
 */
export interface DistinguishedClubs {
  /** Number of Smedley Distinguished clubs */
  smedley: number
  /** Number of President's Distinguished clubs */
  presidents: number
  /** Number of Select Distinguished clubs */
  select: number
  /** Number of Distinguished clubs */
  distinguished: number
  /** Total distinguished clubs */
  total: number
}

/**
 * Summary analytics data from pre-computed analytics
 */
export interface AnalyticsSummary {
  /** Total membership count */
  totalMembership: number
  /** Change in membership from previous period */
  membershipChange: number
  /** Club counts by health status */
  clubCounts: ClubCounts
  /** Distinguished clubs by level */
  distinguishedClubs: DistinguishedClubs
  /** Projected number of distinguished clubs by end of program year */
  distinguishedProjection: number
}

/**
 * Membership trend data point
 */
export interface MembershipTrendPoint {
  /** Date of the data point (YYYY-MM-DD) */
  date: string
  /** Membership count at this date */
  count: number
}

/**
 * Payments trend data point
 */
export interface PaymentsTrendPoint {
  /** Date of the data point (YYYY-MM-DD) */
  date: string
  /** Number of payments at this date */
  payments: number
}

/**
 * Trend data from time-series index
 */
export interface TrendData {
  /** Membership trend over time */
  membership: MembershipTrendPoint[]
  /** Payments trend over time (optional) */
  payments?: PaymentsTrendPoint[]
}

/**
 * Year-over-year comparison metrics
 */
export interface YearOverYearComparison {
  /** Change in membership compared to same period last year */
  membershipChange: number
  /** Change in distinguished clubs compared to same period last year */
  distinguishedChange: number
  /** Change in club health metrics compared to same period last year */
  clubHealthChange: number
}

/**
 * Performance targets (optional)
 */
export interface PerformanceTargets {
  /** Target membership count */
  membershipTarget?: number
  /** Target number of distinguished clubs */
  distinguishedTarget?: number
  /** Target club growth */
  clubGrowthTarget?: number
}

/**
 * Response from GET /api/districts/:districtId/analytics-summary
 */
export interface AggregatedAnalyticsResponse {
  /** District identifier */
  districtId: string
  /** Date range for the analytics data */
  dateRange: {
    /** Start date (YYYY-MM-DD) */
    start: string
    /** End date (YYYY-MM-DD) */
    end: string
  }
  /** Summary analytics data */
  summary: AnalyticsSummary
  /** Trend data from time-series index */
  trends: TrendData
  /** Year-over-year comparison (optional) */
  yearOverYear?: YearOverYearComparison
  /** Performance targets (optional) */
  performanceTargets?: PerformanceTargets
  /** Source of the data: 'precomputed' or 'computed' */
  dataSource: 'precomputed' | 'computed'
  /** ISO timestamp when the data was computed */
  computedAt: string
}

/**
 * Result type for the useAggregatedAnalytics hook
 */
export interface UseAggregatedAnalyticsResult {
  /** The aggregated analytics data */
  data: AggregatedAnalyticsResponse | null
  /** Whether the query is currently loading */
  isLoading: boolean
  /** Whether the query encountered an error */
  isError: boolean
  /** Error object if the query failed */
  error: Error | null
  /** Function to manually trigger a refetch */
  refetch: () => void
  /** Whether fallback to individual endpoints was used */
  usedFallback: boolean
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Fetch aggregated analytics from the summary endpoint
 */
async function fetchAggregatedAnalytics(
  districtId: string,
  startDate?: string,
  endDate?: string
): Promise<AggregatedAnalyticsResponse> {
  const params = new URLSearchParams()
  if (startDate) params.append('startDate', startDate)
  if (endDate) params.append('endDate', endDate)

  const queryString = params.toString()
  const url = `/districts/${districtId}/analytics-summary${queryString ? `?${queryString}` : ''}`

  const response = await apiClient.get<AggregatedAnalyticsResponse>(url)
  return response.data
}

/**
 * Fetch individual analytics endpoint (for fallback)
 */
async function fetchIndividualAnalytics(
  districtId: string,
  startDate?: string,
  endDate?: string
): Promise<DistrictAnalytics> {
  const params = new URLSearchParams()
  if (startDate) params.append('startDate', startDate)
  if (endDate) params.append('endDate', endDate)

  const queryString = params.toString()
  const url = `/districts/${districtId}/analytics${queryString ? `?${queryString}` : ''}`

  const response = await apiClient.get<DistrictAnalytics>(url)
  return response.data
}

/**
 * Convert individual analytics response to aggregated format
 */
function convertToAggregatedFormat(
  analytics: DistrictAnalytics
): AggregatedAnalyticsResponse {
  // Build trends object, only including payments if it exists
  const trends: TrendData = {
    membership: analytics.membershipTrend,
  }
  if (analytics.paymentsTrend) {
    trends.payments = analytics.paymentsTrend
  }

  // Handle distinguishedProjection - it may be a number or an object from the backend
  // The /analytics endpoint returns an object, while /analytics-summary returns a number
  let projectionValue: number
  const projection = analytics.distinguishedProjection
  if (typeof projection === 'number') {
    projectionValue = projection
  } else if (projection && typeof projection === 'object') {
    // Extract the total projected distinguished clubs from the object
    const projObj = projection as {
      projectedDistinguished?: number
      projectedSelect?: number
      projectedPresident?: number
    }
    projectionValue =
      (projObj.projectedDistinguished ?? 0) +
      (projObj.projectedSelect ?? 0) +
      (projObj.projectedPresident ?? 0)
  } else {
    projectionValue = 0
  }

  // Build the base response
  const response: AggregatedAnalyticsResponse = {
    districtId: analytics.districtId,
    dateRange: analytics.dateRange,
    summary: {
      totalMembership: analytics.totalMembership,
      membershipChange: analytics.membershipChange,
      clubCounts: {
        total:
          analytics.thrivingClubs.length +
          analytics.vulnerableClubs.length +
          analytics.interventionRequiredClubs.length,
        thriving: analytics.thrivingClubs.length,
        vulnerable: analytics.vulnerableClubs.length,
        interventionRequired: analytics.interventionRequiredClubs.length,
      },
      distinguishedClubs: {
        smedley: analytics.distinguishedClubs.smedley,
        presidents: analytics.distinguishedClubs.presidents,
        select: analytics.distinguishedClubs.select,
        distinguished: analytics.distinguishedClubs.distinguished,
        total: analytics.distinguishedClubs.total,
      },
      distinguishedProjection: projectionValue,
    },
    trends,
    dataSource: 'computed',
    computedAt: new Date().toISOString(),
  }

  // Add optional yearOverYear if present
  if (analytics.yearOverYear) {
    response.yearOverYear = analytics.yearOverYear
  }

  return response
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook to fetch aggregated analytics data
 *
 * Fetches from the `/api/districts/:districtId/analytics-summary` endpoint
 * which returns combined summary, trends, and yearOverYear data.
 *
 * Falls back to individual endpoints if the aggregated endpoint fails.
 *
 * @param districtId - The district ID to fetch analytics for
 * @param startDate - Optional start date for the analytics range (YYYY-MM-DD)
 * @param endDate - Optional end date for the analytics range (YYYY-MM-DD)
 *
 * @example
 * const { data, isLoading, error, usedFallback } = useAggregatedAnalytics('42')
 *
 * // With date range
 * const { data } = useAggregatedAnalytics('42', '2024-07-01', '2024-12-31')
 *
 * Requirements: 5.1
 */
export function useAggregatedAnalytics(
  districtId: string | null,
  startDate?: string,
  endDate?: string
): UseAggregatedAnalyticsResult {
  // Combined query that tries aggregated endpoint first, then falls back to individual
  const query = useQuery({
    queryKey: ['aggregatedAnalytics', districtId, startDate, endDate],
    queryFn: async (): Promise<{
      data: AggregatedAnalyticsResponse
      usedFallback: boolean
    }> => {
      if (!districtId) {
        throw new Error('District ID is required')
      }

      // Try aggregated endpoint first
      try {
        const data = await fetchAggregatedAnalytics(
          districtId,
          startDate,
          endDate
        )
        return { data, usedFallback: false }
      } catch {
        // Fall back to individual endpoint
        const analytics = await fetchIndividualAnalytics(
          districtId,
          startDate,
          endDate
        )
        const data = convertToAggregatedFormat(analytics)
        return { data, usedFallback: true }
      }
    },
    enabled: !!districtId,
    staleTime: 5 * 60 * 1000, // 5 minutes - matches backend cache TTL
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
      // Retry up to 2 times for other errors
      return failureCount < 2
    },
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  })

  const refetch = () => {
    query.refetch()
  }

  // Convert error to Error type if needed
  let error: Error | null = null
  if (query.error) {
    if (query.error instanceof Error) {
      error = query.error
    } else if (typeof query.error === 'object' && 'message' in query.error) {
      error = new Error(String((query.error as { message: unknown }).message))
    } else {
      error = new Error('An unknown error occurred')
    }
  }

  return {
    data: query.data?.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error,
    refetch,
    usedFallback: query.data?.usedFallback ?? false,
  }
}
