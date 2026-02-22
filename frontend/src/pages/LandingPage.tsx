import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../services/api'
import { useDistricts } from '../hooks/useDistricts'
import HistoricalRankChart from '../components/HistoricalRankChart'
import { useProgramYear } from '../contexts/ProgramYearContext'
import { ProgramYearSelector } from '../components/ProgramYearSelector'
import { useRankHistory } from '../hooks/useRankHistory'
import {
  getAvailableProgramYears,
  filterDatesByProgramYear,
  getMostRecentDateInProgramYear,
} from '../utils/programYear'
import { formatDisplayDate } from '../utils/dateFormatting'
import { DistrictRanking } from '../types/districts'

const LandingPage: React.FC = () => {
  const navigate = useNavigate()
  const [sortBy, setSortBy] = useState<
    'aggregate' | 'clubs' | 'payments' | 'distinguished'
  >('aggregate')

  // Fetch tracked districts to show indicator badges
  const { data: districtsData } = useDistricts()
  const trackedDistrictIds = React.useMemo(() => {
    const ids = new Set<string>()
    districtsData?.districts?.forEach(d => ids.add(d.id))
    return ids
  }, [districtsData])
  const [selectedRegions, setSelectedRegions] = useState<string[]>([])

  // Use program year context
  const {
    selectedProgramYear,
    setSelectedProgramYear,
    selectedDate,
    setSelectedDate,
  } = useProgramYear()

  // Historical rank tracking state
  const [selectedRegionsForHistory, setSelectedRegionsForHistory] = useState<
    string[]
  >([])
  // Mobile-friendly collapsible region filters
  const [isHistoryRegionExpanded, setIsHistoryRegionExpanded] = useState(false)
  const [isTableRegionExpanded, setIsTableRegionExpanded] = useState(false)

  // Fetch cached dates
  const { data: cachedDatesData } = useQuery({
    queryKey: ['cached-dates'],
    queryFn: async () => {
      const response = await apiClient.get('/districts/cache/dates')
      return response.data
    },
  })

  const allCachedDates: string[] = React.useMemo(
    () => cachedDatesData?.dates || [],
    [cachedDatesData?.dates]
  )

  // Get available program years from cached dates
  const availableProgramYears = React.useMemo(() => {
    return getAvailableProgramYears(allCachedDates)
  }, [allCachedDates])

  // Auto-select a valid program year if current selection is not in available list
  React.useEffect(() => {
    if (availableProgramYears.length > 0) {
      const isCurrentYearAvailable = availableProgramYears.some(
        py => py.year === selectedProgramYear.year
      )
      if (!isCurrentYearAvailable) {
        // Select the most recent available program year
        const mostRecentYear = availableProgramYears[0]
        if (mostRecentYear) {
          setSelectedProgramYear(mostRecentYear)
        }
      }
    }
  }, [availableProgramYears, selectedProgramYear.year, setSelectedProgramYear])

  // Filter cached dates by selected program year
  const cachedDates = React.useMemo(() => {
    return filterDatesByProgramYear(allCachedDates, selectedProgramYear)
  }, [allCachedDates, selectedProgramYear])

  // Auto-select most recent date in program year when program year changes
  React.useEffect(() => {
    if (cachedDates.length > 0 && !selectedDate) {
      const mostRecent = getMostRecentDateInProgramYear(
        allCachedDates,
        selectedProgramYear
      )
      if (mostRecent) {
        setSelectedDate(mostRecent)
      }
    }
  }, [
    selectedProgramYear,
    cachedDates,
    allCachedDates,
    selectedDate,
    setSelectedDate,
  ])

  // Fetch rankings for selected date
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['district-rankings', selectedDate],
    queryFn: async () => {
      const params = selectedDate ? { date: selectedDate } : {}
      const response = await apiClient.get('/districts/rankings', { params })
      return response.data
    },
    staleTime: 15 * 60 * 1000, // 15 minutes
  })

  const rankings: DistrictRanking[] = React.useMemo(
    () => data?.rankings || [],
    [data?.rankings]
  )
  const currentDate: string = data?.date || ''

  // Get district IDs for selected regions
  const selectedDistricts = React.useMemo(() => {
    if (selectedRegionsForHistory.length === 0) return []
    return rankings
      .filter(r => selectedRegionsForHistory.includes(r.region))
      .map(r => r.districtId)
  }, [rankings, selectedRegionsForHistory])

  // Fetch historical rank data for selected districts
  const {
    data: rankHistoryData,
    isLoading: isLoadingRankHistory,
    isError: isErrorRankHistory,
    error: rankHistoryError,
  } = useRankHistory({
    districtIds: selectedDistricts,
    startDate: selectedProgramYear.startDate,
    endDate: selectedProgramYear.endDate,
  })

  // Get unique regions for filter
  const regions = React.useMemo(() => {
    const uniqueRegions = new Set(rankings.map(r => r.region))
    return Array.from(uniqueRegions).sort()
  }, [rankings])

  // Initialize selected regions to all regions when data loads
  React.useEffect(() => {
    if (regions.length > 0 && selectedRegions.length === 0) {
      setSelectedRegions(regions)
    }
  }, [regions, selectedRegions.length])

  // Filter by selected regions
  const filteredRankings = React.useMemo(() => {
    if (selectedRegions.length === 0) {
      return rankings
    }
    return rankings.filter(r => selectedRegions.includes(r.region))
  }, [rankings, selectedRegions])

  const sortedRankings = React.useMemo(() => {
    const sorted = [...filteredRankings]
    switch (sortBy) {
      case 'clubs':
        return sorted.sort((a, b) => a.clubsRank - b.clubsRank) // Lower rank is better
      case 'payments':
        return sorted.sort((a, b) => a.paymentsRank - b.paymentsRank) // Lower rank is better
      case 'distinguished':
        return sorted.sort((a, b) => a.distinguishedRank - b.distinguishedRank) // Lower rank is better
      default:
        return sorted.sort((a, b) => b.aggregateScore - a.aggregateScore) // Higher Borda score is better
    }
  }, [filteredRankings, sortBy])

  const handleDistrictClick = (districtId: string) => {
    navigate(`/district/${districtId}`)
  }

  const getRankBadgeColor = (rank: number) => {
    if (rank === 1) return 'bg-yellow-500 text-white'
    if (rank === 2) return 'bg-gray-400 text-white'
    if (rank === 3) return 'bg-amber-600 text-white'
    if (rank <= 10) return 'bg-tm-loyal-blue text-white'
    return 'bg-gray-200 text-gray-700'
  }

  const formatNumber = (num: number) => {
    return num.toLocaleString()
  }

  const formatPercentage = (
    percent: number
  ): { text: string; color: string } => {
    if (percent > 0) {
      return {
        text: `+${percent.toFixed(1)}%`,
        color: 'text-green-600',
      }
    } else if (percent < 0) {
      return {
        text: `${percent.toFixed(1)}%`,
        color: 'text-red-600',
      }
    } else {
      return {
        text: '0.0%',
        color: 'text-gray-600',
      }
    }
  }

  // Handle region selection for historical tracking
  const handleRegionSelection = (region: string) => {
    setSelectedRegionsForHistory(prev => {
      if (prev.includes(region)) {
        return prev.filter(r => r !== region)
      } else {
        return [...prev, region]
      }
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100" id="main-content">
        <div className="container mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow-md p-8">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-200 rounded-sm w-1/3"></div>
              <div className="h-4 bg-gray-200 rounded-sm w-2/3"></div>
              <div className="space-y-3 mt-8">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="h-20 bg-gray-200 rounded-sm"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (isError) {
    // Check if this is a "no snapshots available" error
    const errorResponse = (
      error as Error & {
        response?: {
          data?: {
            error?: {
              code?: string
            }
          }
        }
      }
    )?.response?.data?.error
    const isNoSnapshotError = errorResponse?.code === 'NO_SNAPSHOT_AVAILABLE'

    if (isNoSnapshotError) {
      return (
        <div className="min-h-screen bg-gray-100" id="main-content">
          <div className="container mx-auto px-4 py-8">
            <div
              className="bg-tm-happy-yellow bg-opacity-20 border border-tm-happy-yellow rounded-lg p-8 mx-auto"
              style={{ width: '100%', maxWidth: '42rem' }}
            >
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-tm-loyal-blue rounded-full flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-tm-black mb-3">
                  Welcome to Toast-Stats!
                </h2>
                <p className="text-tm-black mb-6 text-lg">
                  No data snapshots are available yet. To get started, you'll
                  need to fetch data from the Toastmasters dashboard.
                </p>

                <div className="bg-white rounded-lg p-6 mb-6 text-left">
                  <h3 className="font-semibold text-tm-black mb-3">
                    What happens next:
                  </h3>
                  <ul className="space-y-2 text-tm-black">
                    <li className="flex items-start">
                      <span className="text-tm-loyal-blue mr-2">1.</span>
                      The data pipeline will automatically collect data from the
                      Toastmasters dashboard
                    </li>
                    <li className="flex items-start">
                      <span className="text-tm-loyal-blue mr-2">2.</span>
                      Once complete, district rankings and analytics will be
                      available
                    </li>
                  </ul>
                </div>

                <div className="flex justify-center">
                  <button
                    onClick={() => refetch()}
                    className="px-6 py-3 text-lg bg-tm-loyal-blue text-white rounded-lg hover:bg-opacity-90 transition-colors font-medium"
                  >
                    Check Again
                  </button>
                </div>

                <p className="text-sm text-tm-cool-gray mt-4">
                  This is a one-time setup. Future visits will show your data
                  immediately.
                </p>
              </div>
            </div>
          </div>
        </div>
      )
    }

    // Handle other types of errors
    return (
      <div className="min-h-screen bg-gray-100" id="main-content">
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-xl font-bold text-red-800 mb-2">
              Error Loading Rankings
            </h2>
            <p className="text-red-600">
              {(error as Error)?.message || 'Failed to load district rankings'}
            </p>
            <button
              onClick={() => refetch()}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-sm hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100" id="main-content">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Toastmasters District Rankings
              </h1>
              <p className="text-gray-600">
                Compare district performance across paid clubs, payments, and
                distinguished clubs
              </p>
            </div>
          </div>

          {/* Program Year and Date Selectors */}
          <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-gray-200">
            {/* Program Year Selector */}
            {availableProgramYears.length > 0 && (
              <div className="flex-shrink-0">
                <ProgramYearSelector
                  availableProgramYears={availableProgramYears}
                  selectedProgramYear={selectedProgramYear}
                  onProgramYearChange={setSelectedProgramYear}
                  showProgress={true}
                />
              </div>
            )}

            {/* Date Selector - Shows only dates in selected program year */}
            {cachedDates.length > 0 && (
              <div className="flex flex-col gap-2 flex-1">
                <label
                  htmlFor="date-select"
                  className="text-xs sm:text-sm font-medium text-gray-700"
                >
                  View Specific Date
                </label>
                <select
                  id="date-select"
                  value={selectedDate || ''}
                  onChange={e => setSelectedDate(e.target.value || undefined)}
                  className="px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-900 hover:border-tm-loyal-blue-50 focus:outline-hidden focus:ring-2 focus:ring-tm-loyal-blue transition-colors bg-white font-tm-body"
                  style={{ color: 'var(--tm-black)' }}
                >
                  <option value="" className="text-gray-900 bg-white">
                    Latest in Program Year ({currentDate})
                  </option>
                  {cachedDates
                    .sort((a, b) => b.localeCompare(a))
                    .map(date => (
                      <option
                        key={date}
                        value={date}
                        className="text-gray-900 bg-white"
                      >
                        {formatDisplayDate(date)}
                      </option>
                    ))}
                </select>
                <div className="text-xs text-gray-500">
                  {cachedDates.length} date{cachedDates.length !== 1 ? 's' : ''}{' '}
                  available in this program year
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Historical Rank Tracking Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Historical Rank Progression
            </h2>
            <p className="text-gray-600">
              Select regions to compare district rank progression over time
            </p>
          </div>

          {/* Region Multi-Select for Historical Tracking */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() =>
                  setIsHistoryRegionExpanded(!isHistoryRegionExpanded)
                }
                className="text-sm font-medium text-gray-700 flex items-center gap-2 md:cursor-default"
                aria-expanded={isHistoryRegionExpanded}
              >
                Select Regions to Compare ({selectedRegionsForHistory.length}{' '}
                regions, {selectedDistricts.length} districts)
                <svg
                  className={`w-4 h-4 transition-transform md:hidden ${isHistoryRegionExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {selectedRegionsForHistory.length > 0 && (
                <button
                  onClick={() => setSelectedRegionsForHistory([])}
                  className="text-sm text-tm-loyal-blue hover:text-tm-loyal-blue-80 font-medium font-tm-body"
                >
                  Clear Selection
                </button>
              )}
            </div>
            <div
              className={`${isHistoryRegionExpanded ? 'block' : 'hidden'} md:block`}
            >
              <div className="flex flex-wrap gap-2">
                {regions.map(region => {
                  const isSelected = selectedRegionsForHistory.includes(region)
                  const districtCount = rankings.filter(
                    r => r.region === region
                  ).length
                  return (
                    <button
                      key={region}
                      onClick={() => handleRegionSelection(region)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors font-tm-body ${
                        isSelected
                          ? 'bg-tm-loyal-blue text-white hover:bg-tm-loyal-blue-80'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {region} ({districtCount})
                    </button>
                  )
                })}
              </div>
            </div>
            {selectedRegionsForHistory.length > 0 && (
              <p className="text-sm text-gray-600 mt-2">
                Showing {selectedDistricts.length} districts from{' '}
                {selectedRegionsForHistory.length} selected region
                {selectedRegionsForHistory.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          {/* Historical Rank Chart */}
          <HistoricalRankChart
            data={rankHistoryData || []}
            isLoading={isLoadingRankHistory}
            isError={isErrorRankHistory}
            error={rankHistoryError}
          />
        </div>

        {/* Sort Controls */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex flex-wrap gap-2">
            <span className="text-sm font-medium text-gray-700 self-center mr-2">
              Sort by:
            </span>
            <button
              onClick={() => setSortBy('aggregate')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors font-tm-body ${
                sortBy === 'aggregate'
                  ? 'bg-tm-loyal-blue text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Overall Score
            </button>
            <button
              onClick={() => setSortBy('clubs')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors font-tm-body ${
                sortBy === 'clubs'
                  ? 'bg-tm-loyal-blue text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Paid Clubs
            </button>
            <button
              onClick={() => setSortBy('payments')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors font-tm-body ${
                sortBy === 'payments'
                  ? 'bg-tm-loyal-blue text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Total Payments
            </button>
            <button
              onClick={() => setSortBy('distinguished')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors font-tm-body ${
                sortBy === 'distinguished'
                  ? 'bg-tm-loyal-blue text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Distinguished Clubs
            </button>
          </div>
        </div>

        {/* Rankings Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {/* Region Filter in Table Header */}
          <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <button
                  onClick={() =>
                    setIsTableRegionExpanded(!isTableRegionExpanded)
                  }
                  className="text-sm font-semibold text-gray-900 flex items-center gap-2 md:cursor-default"
                  aria-expanded={isTableRegionExpanded}
                >
                  Filter Regions
                  {selectedRegions.length > 0 &&
                    selectedRegions.length < regions.length && (
                      <span className="text-xs font-normal text-tm-loyal-blue md:hidden">
                        ({selectedRegions.length}/{regions.length})
                      </span>
                    )}
                  <svg
                    className={`w-4 h-4 transition-transform md:hidden ${isTableRegionExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
              </div>
              <div
                className={`flex-1 ${isTableRegionExpanded ? 'block' : 'hidden'} md:block`}
              >
                {/* Quick Select Buttons */}
                <div className="flex flex-wrap gap-2 mb-3 pb-3 border-b border-gray-200">
                  <button
                    onClick={() => setSelectedRegions(regions)}
                    className="px-3 py-1 text-xs font-medium bg-tm-loyal-blue-20 text-tm-loyal-blue rounded-sm hover:bg-tm-loyal-blue-30 transition-colors font-tm-body"
                  >
                    All Regions
                  </button>
                  <button
                    onClick={() => {
                      const regions1to7 = regions.filter(r => {
                        const num = parseInt(r, 10)
                        return !isNaN(num) && num >= 1 && num <= 7
                      })
                      setSelectedRegions(regions1to7)
                    }}
                    className="px-3 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-sm hover:bg-green-200 transition-colors"
                  >
                    Regions 1-7
                  </button>
                  <button
                    onClick={() => setSelectedRegions([])}
                    className="px-3 py-1 text-xs font-medium bg-gray-200 text-gray-700 rounded-sm hover:bg-gray-300 transition-colors"
                  >
                    Clear All
                  </button>
                </div>

                {/* Individual Region Checkboxes */}
                <div className="flex flex-wrap gap-3">
                  {regions.map(region => {
                    const count = rankings.filter(
                      r => r.region === region
                    ).length
                    return (
                      <label
                        key={region}
                        className="inline-flex items-center cursor-pointer hover:bg-gray-100 px-3 py-1 rounded-sm transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedRegions.includes(region)}
                          onChange={e => {
                            if (e.target.checked) {
                              setSelectedRegions([...selectedRegions, region])
                            } else {
                              setSelectedRegions(
                                selectedRegions.filter(r => r !== region)
                              )
                            }
                          }}
                          className="w-4 h-4 text-tm-loyal-blue border-gray-300 rounded-sm focus:ring-tm-loyal-blue"
                        />
                        <span className="ml-2 text-sm text-gray-700">
                          Region {region} ({count})
                        </span>
                      </label>
                    )
                  })}
                </div>
                {selectedRegions.length > 0 &&
                  selectedRegions.length < regions.length && (
                    <div className="mt-2 text-sm text-tm-loyal-blue font-medium font-tm-body">
                      Showing {filteredRankings.length} districts from{' '}
                      {selectedRegions.length} region
                      {selectedRegions.length !== 1 ? 's' : ''}
                    </div>
                  )}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    District
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Region
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Paid Clubs
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Payments
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Distinguished
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Score
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedRankings.map((district, index) => {
                  const rank = index + 1
                  return (
                    <tr
                      key={district.districtId}
                      onClick={() => handleDistrictClick(district.districtId)}
                      className="hover:bg-tm-loyal-blue-10 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center justify-center w-10 h-10 rounded-full font-bold ${getRankBadgeColor(rank)}`}
                        >
                          {rank}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">
                            {district.districtName}
                          </span>
                          {trackedDistrictIds.has(district.districtId) && (
                            <span
                              title="Detailed analytics available"
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700"
                            >
                              <svg
                                className="w-3 h-3 mr-0.5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                                />
                              </svg>
                              Analytics
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          {district.activeClubs} active clubs
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {district.region}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm font-medium text-gray-900">
                          {formatNumber(district.paidClubs)}
                        </div>
                        <div className="text-xs flex items-center justify-end gap-1">
                          <span className="text-tm-loyal-blue font-tm-body">
                            Rank #{district.clubsRank}
                          </span>
                          <span className="text-gray-400">•</span>
                          <span
                            className={
                              formatPercentage(district.clubGrowthPercent).color
                            }
                          >
                            {formatPercentage(district.clubGrowthPercent).text}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm font-medium text-gray-900">
                          {formatNumber(district.totalPayments)}
                        </div>
                        <div className="text-xs flex items-center justify-end gap-1">
                          <span className="text-tm-loyal-blue font-tm-body">
                            Rank #{district.paymentsRank}
                          </span>
                          <span className="text-gray-400">•</span>
                          <span
                            className={
                              formatPercentage(district.paymentGrowthPercent)
                                .color
                            }
                          >
                            {
                              formatPercentage(district.paymentGrowthPercent)
                                .text
                            }
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm font-medium text-gray-900">
                          {formatNumber(district.distinguishedClubs)}
                        </div>
                        <div className="text-xs flex items-center justify-end gap-1">
                          <span className="text-tm-loyal-blue font-tm-body">
                            Rank #{district.distinguishedRank}
                          </span>
                          <span className="text-gray-400">•</span>
                          <span
                            className={
                              formatPercentage(district.distinguishedPercent)
                                .color
                            }
                          >
                            {
                              formatPercentage(district.distinguishedPercent)
                                .text
                            }
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm font-bold text-tm-loyal-blue font-tm-headline">
                          {formatNumber(Math.round(district.aggregateScore))}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legend */}
        <div className="bg-white rounded-lg shadow-md p-6 mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Scoring Methodology
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600 mb-4">
            <div>
              <span className="font-medium text-gray-900">Paid Clubs:</span>{' '}
              Number of clubs with paid memberships
            </div>
            <div>
              <span className="font-medium text-gray-900">Total Payments:</span>{' '}
              Year-to-date membership payments
            </div>
            <div>
              <span className="font-medium text-gray-900">
                Distinguished Clubs:
              </span>{' '}
              Clubs achieving distinguished status
            </div>
          </div>
          <div className="bg-tm-loyal-blue-10 border-l-4 border-tm-loyal-blue p-4 text-sm">
            <p className="font-medium text-tm-loyal-blue mb-2 font-tm-headline">
              Ranking Formula (Borda Count System):
            </p>
            <p className="text-tm-loyal-blue-80 font-tm-body">
              Each district is ranked in three categories: Paid Clubs, Total
              Payments, and Distinguished Clubs. Points are awarded based on
              rank position (higher rank = more points).
            </p>
            <p className="text-tm-loyal-blue-70 mt-2 font-tm-body">
              <strong>Point Allocation:</strong> If there are N districts, rank
              #1 receives N points, rank #2 receives N-1 points, and so on. The{' '}
              <strong>Overall Score</strong> is the sum of points from all three
              categories (higher is better).
            </p>
            <p className="text-tm-loyal-blue-70 mt-2 text-xs font-tm-body">
              Example: With 100 districts, if a district ranks #5 in Paid Clubs
              (96 pts), #3 in Payments (98 pts), and #8 in Distinguished Clubs
              (93 pts), their Overall Score = 96 + 98 + 93 = 287 points
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LandingPage
