import { useMemo } from 'react'
import { useAvailableProgramYears } from './useAvailableProgramYears'
import { useRankHistory } from './useRankHistory'
import type {
  RankHistoryResponse,
  ProgramYearWithData,
} from '../types/districts'
import {
  convertToProgramYear,
  extractEndOfYearRankings,
  buildYearlyRankingSummaries,
} from '../utils/globalRankingsUtils'
import type {
  UseGlobalRankingsParams,
  UseGlobalRankingsResult,
} from '../utils/globalRankingsUtils'

// Re-export types and functions for backward compatibility
export {
  convertToProgramYear,
  extractEndOfYearRankings,
  calculateYearOverYearChange,
  buildYearlyRankingSummaries,
} from '../utils/globalRankingsUtils'
export type {
  RankPosition,
  EndOfYearRankings,
  YearOverYearChange,
  YearlyRankingSummary,
  UseGlobalRankingsParams,
  UseGlobalRankingsResult,
} from '../utils/globalRankingsUtils'

// ========== Query Key Factory ==========

/**
 * Query key factory for global rankings queries
 */
export const globalRankingsQueryKeys = {
  all: ['global-rankings'] as const,
  byDistrict: (districtId: string) => ['global-rankings', districtId] as const,
  byDistrictAndYear: (districtId: string, programYear: string) =>
    ['global-rankings', districtId, programYear] as const,
}

// ========== Main Hook ==========

/**
 * React Query hook that aggregates ranking data across program years.
 *
 * Performance optimization (#115): Previously made 3 sequential API calls
 * (available years → selected year history → all years history).
 * Now makes only 2 PARALLEL calls:
 *   1. Available program years
 *   2. Full rank history (all years) — selected year derived client-side
 *
 * This eliminates 1 full round-trip and removes the waterfall dependency.
 */
export function useGlobalRankings({
  districtId,
  selectedProgramYear,
}: UseGlobalRankingsParams): UseGlobalRankingsResult {
  // ── Call 1: Fetch available program years (parallel with Call 2) ──
  const {
    data: availableYearsData,
    isLoading: isLoadingYears,
    isError: isErrorYears,
    error: errorYears,
    refetch: refetchYears,
  } = useAvailableProgramYears({ districtId })

  // Convert available years to ProgramYear format
  const availableProgramYears = useMemo(() => {
    if (!availableYearsData?.programYears) return []
    return availableYearsData.programYears.map(convertToProgramYear)
  }, [availableYearsData])

  // Determine the effective selected year (default to most recent)
  const effectiveSelectedYear = useMemo(() => {
    if (selectedProgramYear) return selectedProgramYear
    if (availableProgramYears.length > 0) return availableProgramYears[0]
    return undefined
  }, [selectedProgramYear, availableProgramYears])

  // ── Call 2: Fetch ALL years' rank history in ONE request (parallel with Call 1) ──
  // Previously this was split into two sequential calls:
  //   - Selected year history (waited for available years)
  //   - All years history (waited for available years)
  // Now we always request the maximum range and filter client-side.
  const allYearsHistoryParams = useMemo(() => {
    const params: {
      districtIds: string[]
      startDate?: string
      endDate?: string
    } = {
      districtIds: districtId ? [districtId] : [],
    }

    // If we know the available years, narrow the range. Otherwise, use a wide default.
    if (
      availableYearsData?.programYears &&
      availableYearsData.programYears.length > 0
    ) {
      const sortedYears = [...availableYearsData.programYears].sort((a, b) =>
        a.year.localeCompare(b.year)
      )
      const earliestYear = sortedYears[0]
      const latestYear = sortedYears[sortedYears.length - 1]
      if (earliestYear) params.startDate = earliestYear.startDate
      if (latestYear) params.endDate = latestYear.endDate
    }

    return params
  }, [districtId, availableYearsData])

  const {
    data: allYearsHistoryData,
    isLoading: isLoadingAllYears,
    isError: isErrorAllYears,
    error: errorAllYears,
    refetch: refetchAllYears,
  } = useRankHistory(allYearsHistoryParams)

  // ── Derive selected year history from all-years data (no extra API call) ──
  const currentYearHistory = useMemo(() => {
    if (
      !allYearsHistoryData ||
      allYearsHistoryData.length === 0 ||
      !effectiveSelectedYear
    ) {
      return null
    }

    const fullHistory = allYearsHistoryData[0]
    if (!fullHistory) return null

    // Filter history points to the selected year's date range
    const filteredHistory = fullHistory.history.filter(
      point =>
        point.date >= effectiveSelectedYear.startDate &&
        point.date <= effectiveSelectedYear.endDate
    )

    return {
      ...fullHistory,
      history: filteredHistory,
    }
  }, [allYearsHistoryData, effectiveSelectedYear])

  // Find the program year data for the selected year
  const selectedProgramYearData = useMemo(() => {
    if (!effectiveSelectedYear || !availableYearsData?.programYears) {
      return undefined
    }
    return availableYearsData.programYears.find(
      py => py.year === effectiveSelectedYear.label
    )
  }, [effectiveSelectedYear, availableYearsData])

  // Calculate end-of-year rankings for the selected year
  const endOfYearRankings = useMemo(() => {
    return extractEndOfYearRankings(currentYearHistory, selectedProgramYearData)
  }, [currentYearHistory, selectedProgramYearData])

  // Build yearly ranking summaries from selected year and all previous years
  const yearlyRankings = useMemo(() => {
    if (!availableYearsData?.programYears || !effectiveSelectedYear) {
      return []
    }

    const allHistory = allYearsHistoryData?.[0]
    if (!allHistory || allHistory.history.length === 0) {
      return []
    }

    // Filter program years to only include selected year and earlier
    const filteredProgramYears = availableYearsData.programYears.filter(
      yearData => yearData.year <= effectiveSelectedYear.label
    )

    // Group history points by program year
    const historyByYear = new Map<string, RankHistoryResponse>()
    const yearsWithHistory: ProgramYearWithData[] = []

    for (const yearData of filteredProgramYears) {
      const yearHistory = allHistory.history.filter(point => {
        return (
          point.date >= yearData.startDate && point.date <= yearData.endDate
        )
      })

      if (yearHistory.length > 0) {
        historyByYear.set(yearData.year, {
          districtId: allHistory.districtId,
          districtName: allHistory.districtName,
          history: yearHistory,
          programYear: allHistory.programYear,
        })
        yearsWithHistory.push(yearData)
      }
    }

    return buildYearlyRankingSummaries(yearsWithHistory, historyByYear)
  }, [availableYearsData, allYearsHistoryData, effectiveSelectedYear])

  // ── Loading states ──
  // Short-circuit: if years query resolved with no data, show empty state immediately
  const hasNoData = !isLoadingYears && availableProgramYears.length === 0
  const isLoading = hasNoData ? false : isLoadingYears || isLoadingAllYears
  const isLoadingChart = isLoadingAllYears
  const isLoadingMultiYear = isLoadingAllYears

  // Combine error states
  const isError = isErrorYears || isErrorAllYears
  const error = errorYears ?? errorAllYears ?? null

  // Combined refetch function
  const refetch = () => {
    refetchYears()
    refetchAllYears()
  }

  return {
    currentYearHistory,
    endOfYearRankings,
    availableProgramYears,
    yearlyRankings,
    isLoading,
    isLoadingChart,
    isLoadingMultiYear,
    isError,
    error,
    refetch,
  }
}
