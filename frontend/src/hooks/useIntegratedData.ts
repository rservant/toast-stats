/**
 * Custom hooks for integrated data combining daily reports with other statistics
 */

import { useMemo } from 'react'
import {
  useMembershipHistory,
  useDistrictStatistics,
} from './useMembershipData'
import { useDailyReports } from './useDailyReports'
import { useClubs } from './useClubs'
import {
  combineMembershipWithDailyReports,
  calculateRunningTotals,
  identifySignificantEvents,
  calculateRealTimeMembership,
  type EnhancedMembershipPoint,
  type ClubWithRecentChanges,
  type SignificantEvent,
} from '../utils/dataIntegration'

/**
 * Hook to get membership data enhanced with daily report events
 */
export function useEnhancedMembershipData(
  districtId: string | null,
  months: number = 12
) {
  const {
    data: membershipHistory,
    isLoading: isLoadingHistory,
    error: historyError,
  } = useMembershipHistory(districtId, months)

  // Calculate date range for daily reports (last N months)
  const endDate = new Date().toISOString().split('T')[0]
  const startDate = useMemo(() => {
    const date = new Date()
    date.setMonth(date.getMonth() - months)
    return date.toISOString().split('T')[0]
  }, [months])

  const {
    data: dailyReportsData,
    isLoading: isLoadingReports,
    error: reportsError,
  } = useDailyReports(districtId, startDate, endDate)

  const enhancedData = useMemo<EnhancedMembershipPoint[]>(() => {
    if (!membershipHistory?.data || !dailyReportsData?.reports) {
      return membershipHistory?.data || []
    }

    return combineMembershipWithDailyReports(
      membershipHistory.data,
      dailyReportsData.reports
    )
  }, [membershipHistory, dailyReportsData])

  return {
    data: enhancedData,
    isLoading: isLoadingHistory || isLoadingReports,
    error: historyError || reportsError,
  }
}

/**
 * Hook to get clubs enhanced with recent daily changes
 * Note: Currently returns clubs as-is since the daily reports endpoint returns summary data
 * To fully implement this, we would need detailed daily report data with member-level information
 */
export function useEnhancedClubs(
  districtId: string | null,
  daysToConsider: number = 7 // TODO: Use this when detailed daily reports are available
) {
  // Explicitly acknowledge the parameter for future use
  void daysToConsider

  const {
    data: clubsData,
    isLoading: isLoadingClubs,
    error: clubsError,
  } = useClubs(districtId)

  // TODO: When detailed daily reports are available, enhance clubs with recent changes
  // This will use the daysToConsider parameter to analyze recent membership changes
  // For now, return clubs as-is
  const enhancedClubs = useMemo<ClubWithRecentChanges[]>(() => {
    return clubsData?.clubs || []
  }, [clubsData])

  return {
    clubs: enhancedClubs,
    isLoading: isLoadingClubs,
    error: clubsError,
  }
}

/**
 * Hook to get significant events from recent daily reports
 */
export function useSignificantEvents(
  districtId: string | null,
  daysToConsider: number = 30
) {
  const endDate = new Date().toISOString().split('T')[0]
  const startDate = useMemo(() => {
    const date = new Date()
    date.setDate(date.getDate() - daysToConsider)
    return date.toISOString().split('T')[0]
  }, [daysToConsider])

  const {
    data: dailyReportsData,
    isLoading,
    error,
  } = useDailyReports(districtId, startDate, endDate)

  const events = useMemo<SignificantEvent[]>(() => {
    if (!dailyReportsData?.reports) {
      return []
    }

    return identifySignificantEvents(dailyReportsData.reports)
  }, [dailyReportsData])

  return {
    events,
    isLoading,
    error,
  }
}

/**
 * Hook to get real-time membership count combining base statistics with recent daily reports
 */
export function useRealTimeMembership(districtId: string | null) {
  const { data: statistics, isLoading: isLoadingStats } =
    useDistrictStatistics(districtId)

  // Get daily reports since the statistics base date
  const endDate = new Date().toISOString().split('T')[0]
  const startDate = useMemo(() => {
    if (!statistics?.asOfDate) return endDate
    return statistics.asOfDate
  }, [statistics, endDate])

  const { data: dailyReportsData, isLoading: isLoadingReports } =
    useDailyReports(districtId, startDate, endDate)

  const realTimeData = useMemo(() => {
    if (!statistics || !dailyReportsData?.reports) {
      return {
        currentCount: statistics?.membership.total || 0,
        changeFromBase: 0,
        lastUpdated: statistics?.asOfDate || endDate,
        isRealTime: false,
      }
    }

    const result = calculateRealTimeMembership(
      statistics.membership.total,
      statistics.asOfDate,
      dailyReportsData.reports
    )

    return {
      ...result,
      isRealTime: dailyReportsData.reports.length > 0,
    }
  }, [statistics, dailyReportsData, endDate])

  return {
    ...realTimeData,
    isLoading: isLoadingStats || isLoadingReports,
  }
}

/**
 * Hook to get running totals from daily reports with validation
 */
export function useDailyReportTotals(
  districtId: string | null,
  startDate: string,
  endDate: string
) {
  const {
    data: dailyReportsData,
    isLoading,
    error,
  } = useDailyReports(districtId, startDate, endDate)

  const totals = useMemo(() => {
    if (!dailyReportsData?.reports) {
      return null
    }

    return calculateRunningTotals(dailyReportsData.reports)
  }, [dailyReportsData])

  return {
    totals,
    isLoading,
    error,
  }
}
