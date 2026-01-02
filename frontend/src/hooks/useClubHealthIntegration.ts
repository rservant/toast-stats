/**
 * Club Health Integration Hook
 *
 * Custom React hook that integrates club performance data with health classification data.
 * Provides merged data, error handling, and refresh functionality for the club health table.
 *
 * Error Handling Strategy:
 * - Analytics API failures: Return empty clubs array, show error state
 * - Health API failures: Return clubs with "Unknown" health status, continue functioning
 * - Partial health data: Display available data, mark missing as "Unknown"
 * - Stale data: Display warning indicators, provide refresh functionality
 */

import { useCallback, useMemo } from 'react'
import { useDistrictAnalytics } from './useDistrictAnalytics'
import {
  useDistrictClubsHealth,
  useDistrictClubHealthRefresh,
} from './useClubHealth'
import { HealthDataMerger } from '../services/HealthDataMerger'
import type {
  EnhancedClubTrend,
  HealthDataStatus,
  ProcessedClubTrend,
} from '../components/filters/types'

/**
 * Result interface for the useClubHealthIntegration hook
 */
export interface UseClubHealthIntegrationResult {
  enhancedClubs: EnhancedClubTrend[]
  healthDataStatus: HealthDataStatus
  refreshHealthData: () => Promise<void>
  isRefreshing: boolean
  // Pass through analytics data states for backward compatibility
  isLoading: boolean
  isError: boolean
  error: Error | null
  // Additional error handling states
  analyticsError: boolean
  healthError: boolean
  canRetryAnalytics: boolean
  canRetryHealth: boolean
}

/**
 * Hook that integrates club performance data with health classification data
 *
 * @param districtId - District ID to fetch data for
 * @param startDate - Optional start date for analytics data
 * @param endDate - Optional end date for analytics data
 * @returns Integrated club data with health information
 */
export const useClubHealthIntegration = (
  districtId: string | null,
  startDate?: string,
  endDate?: string
): UseClubHealthIntegrationResult => {
  // Fetch club performance data
  const {
    data: analyticsData,
    isLoading: analyticsLoading,
    isError: analyticsError,
    error: analyticsErrorObj,
  } = useDistrictAnalytics(districtId, startDate, endDate)

  // Fetch health classification data
  const {
    data: healthData,
    isLoading: healthLoading,
    isError: healthError,
    error: healthErrorObj,
    refetch: refetchHealth,
  } = useDistrictClubsHealth(districtId)

  // Health data refresh mutation
  const { mutateAsync: refreshHealthMutation, isPending: isRefreshing } =
    useDistrictClubHealthRefresh()

  // Process club trends to add computed properties for filtering
  const processedClubTrends = useMemo((): ProcessedClubTrend[] => {
    const allClubs = analyticsData?.allClubs
    if (!allClubs) {
      return []
    }

    return allClubs.map(club => ({
      ...club,
      // Add computed properties for filtering
      latestMembership:
        club.membershipTrend.length > 0
          ? club.membershipTrend[club.membershipTrend.length - 1].count
          : 0,
      latestDcpGoals:
        club.dcpGoalsTrend.length > 0
          ? club.dcpGoalsTrend[club.dcpGoalsTrend.length - 1].goalsAchieved
          : 0,
      distinguishedOrder: club.distinguishedLevel
        ? { Distinguished: 0, Select: 1, President: 2, Smedley: 3 }[
            club.distinguishedLevel
          ] || 999
        : 999,
    }))
  }, [analyticsData?.allClubs])

  // Merge club performance data with health classification data
  const enhancedClubs = useMemo((): EnhancedClubTrend[] => {
    // If analytics data is not available due to error, return empty array
    if (analyticsError || processedClubTrends.length === 0) {
      return []
    }

    // If health data is not available due to error or missing data,
    // return clubs with unknown health status (graceful degradation)
    if (healthError || !healthData || healthData.length === 0) {
      return processedClubTrends.map(club => ({
        ...club,
        healthStatus: undefined,
        trajectory: undefined,
        healthReasons: undefined,
        trajectoryReasons: undefined,
        healthDataAge: undefined,
        healthDataTimestamp: undefined,
        healthStatusOrder: 3, // Unknown
        trajectoryOrder: 3, // Unknown
      }))
    }

    // Merge data using HealthDataMerger service
    // This handles partial data gracefully by marking missing entries as "Unknown"
    return HealthDataMerger.mergeClubData(processedClubTrends, healthData)
  }, [processedClubTrends, healthData, analyticsError, healthError])

  // Calculate health data status
  const healthDataStatus = useMemo((): HealthDataStatus => {
    return HealthDataMerger.getHealthDataStatus(
      healthData || [],
      healthLoading,
      healthErrorObj || undefined
    )
  }, [healthData, healthLoading, healthErrorObj])

  // Refresh health data function with enhanced error handling
  const refreshHealthData = useCallback(async (): Promise<void> => {
    if (!districtId) {
      throw new Error('District ID is required for refresh')
    }

    try {
      // Attempt to refresh health data using the mutation
      await refreshHealthMutation(districtId)
    } catch (error) {
      // Log error for debugging but don't prevent the UI from functioning
      console.error('Failed to refresh health data:', error)

      // Try to refetch health data as fallback
      try {
        await refetchHealth()
      } catch (refetchError) {
        console.error('Failed to refetch health data:', refetchError)
        // Re-throw the original error to allow caller to handle
        throw error
      }
    }
  }, [districtId, refreshHealthMutation, refetchHealth])

  // Determine retry capabilities based on error types
  const canRetryAnalytics = useMemo(() => {
    if (!analyticsError || !analyticsErrorObj) return false

    // Check if error is retryable (not 404 or 400)
    if (
      analyticsErrorObj &&
      typeof analyticsErrorObj === 'object' &&
      'response' in analyticsErrorObj
    ) {
      const axiosError = analyticsErrorObj as { response?: { status?: number } }
      return (
        axiosError.response?.status !== 404 &&
        axiosError.response?.status !== 400
      )
    }

    return true // Assume retryable for other error types
  }, [analyticsError, analyticsErrorObj])

  const canRetryHealth = useMemo(() => {
    if (!healthError || !healthErrorObj) return false

    // Check if error is retryable (not 404 or 400)
    if (
      healthErrorObj &&
      typeof healthErrorObj === 'object' &&
      'response' in healthErrorObj
    ) {
      const axiosError = healthErrorObj as { response?: { status?: number } }
      return (
        axiosError.response?.status !== 404 &&
        axiosError.response?.status !== 400
      )
    }

    return true // Assume retryable for other error types
  }, [healthError, healthErrorObj])

  // Determine overall loading and error states
  const isLoading = analyticsLoading || healthLoading
  // Only consider it an error if analytics fails (critical) or both fail
  // Health failures alone should not prevent the table from functioning
  const isError =
    analyticsError || (healthError && processedClubTrends.length === 0)
  const error =
    analyticsErrorObj || (analyticsError ? null : healthErrorObj) || null

  return {
    enhancedClubs,
    healthDataStatus,
    refreshHealthData,
    isRefreshing,
    isLoading,
    isError,
    error,
    // Additional error handling states
    analyticsError,
    healthError,
    canRetryAnalytics,
    canRetryHealth,
  }
}
