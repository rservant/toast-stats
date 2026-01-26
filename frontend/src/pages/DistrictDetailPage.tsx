import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDistricts } from '../hooks/useDistricts'
import { useDistrictAnalytics, ClubTrend } from '../hooks/useDistrictAnalytics'
import { useAggregatedAnalytics } from '../hooks/useAggregatedAnalytics'
import { useDistrictStatistics } from '../hooks/useMembershipData'
import { useLeadershipInsights } from '../hooks/useLeadershipInsights'
import { useDistinguishedClubAnalytics } from '../hooks/useDistinguishedClubAnalytics'
import { usePaymentsTrend } from '../hooks/usePaymentsTrend'
import { useDistrictCachedDates } from '../hooks/useDistrictData'
import { useProgramYear } from '../contexts/ProgramYearContext'
import { ProgramYearSelector } from '../components/ProgramYearSelector'
import {
  getAvailableProgramYears,
  filterDatesByProgramYear,
  getMostRecentDateInProgramYear,
} from '../utils/programYear'
import { formatDisplayDate } from '../utils/dateFormatting'
import { extractDivisionPerformance } from '../utils/extractDivisionPerformance'
import { DistrictOverview } from '../components/DistrictOverview'
import { VulnerableClubsPanel } from '../components/VulnerableClubsPanel'
import { InterventionRequiredClubsPanel } from '../components/InterventionRequiredClubsPanel'
import { DistinguishedProgressChart } from '../components/DistinguishedProgressChart'
import { ClubsTable } from '../components/ClubsTable'
import { ClubDetailModal } from '../components/ClubDetailModal'
import { DivisionRankings } from '../components/DivisionRankings'
import { AreaPerformanceChart } from '../components/AreaPerformanceChart'
import { MembershipTrendChart } from '../components/MembershipTrendChart'
import { MembershipPaymentsChart } from '../components/MembershipPaymentsChart'
import { YearOverYearComparison } from '../components/YearOverYearComparison'
import { LeadershipInsights } from '../components/LeadershipInsights'
import { TopGrowthClubs } from '../components/TopGrowthClubs'
import { DCPGoalAnalysis } from '../components/DCPGoalAnalysis'
import { DivisionPerformanceCards } from '../components/DivisionPerformanceCards'
import { DivisionAreaRecognitionPanel } from '../components/DivisionAreaRecognitionPanel'

import ErrorBoundary from '../components/ErrorBoundary'
import { ErrorDisplay, EmptyState } from '../components/ErrorDisplay'
import { DistrictBackfillButton } from '../components/DistrictBackfillButton'
import { DistrictExportButton } from '../components/DistrictExportButton'
import { LazyChart } from '../components/LazyChart'
import { useBackfillContext } from '../contexts/BackfillContext'
import GlobalRankingsTab from '../components/GlobalRankingsTab'

type TabType =
  | 'overview'
  | 'clubs'
  | 'divisions'
  | 'trends'
  | 'analytics'
  | 'globalRankings'

const DistrictDetailPage: React.FC = () => {
  const { districtId } = useParams<{ districtId: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [selectedClub, setSelectedClub] = useState<ClubTrend | null>(null)
  const { addBackfill } = useBackfillContext()

  // Use program year context
  const {
    selectedProgramYear,
    setSelectedProgramYear,
    selectedDate,
    setSelectedDate,
  } = useProgramYear()

  // Fetch district info
  const { data: districtsData } = useDistricts()
  const selectedDistrict = districtsData?.districts?.find(
    d => d.id === districtId
  )

  // Fetch cached dates for date selector
  const { data: cachedDatesData } = useDistrictCachedDates(districtId || '')

  // Get all cached dates
  const allCachedDates = React.useMemo(
    () => cachedDatesData?.dates || [],
    [cachedDatesData?.dates]
  )

  // Get available program years from cached dates
  const availableProgramYears = React.useMemo(() => {
    return getAvailableProgramYears(allCachedDates)
  }, [allCachedDates])

  // Filter cached dates by selected program year
  const cachedDatesInProgramYear = React.useMemo(() => {
    return filterDatesByProgramYear(allCachedDates, selectedProgramYear)
  }, [allCachedDates, selectedProgramYear])

  // Auto-select most recent date in program year when program year changes
  React.useEffect(() => {
    if (cachedDatesInProgramYear.length > 0 && !selectedDate) {
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
    cachedDatesInProgramYear,
    allCachedDates,
    selectedDate,
    setSelectedDate,
  ])

  // Fetch aggregated analytics for overview tab (summary, trends, yearOverYear)
  // This uses pre-computed data for faster response times
  // Requirements: 5.1, 5.2
  const {
    data: aggregatedAnalytics,
    isLoading: isLoadingAggregated,
    error: aggregatedError,
    refetch: refetchAggregated,
    usedFallback: aggregatedUsedFallback,
  } = useAggregatedAnalytics(
    districtId || null,
    selectedProgramYear.startDate,
    selectedDate || selectedProgramYear.endDate
  )

  // Fetch full analytics for detailed views (clubs, divisions, analytics tabs)
  // This provides full club arrays needed for tables and detailed panels
  const {
    data: analytics,
    isLoading: isLoadingAnalytics,
    error: analyticsError,
    refetch: refetchAnalytics,
  } = useDistrictAnalytics(
    districtId || null,
    selectedProgramYear.startDate,
    selectedDate || selectedProgramYear.endDate
  )

  // Fetch district statistics for division/area performance cards
  const { data: districtStatistics, isLoading: isLoadingStatistics } =
    useDistrictStatistics(
      districtId || null,
      selectedDate || selectedProgramYear.endDate
    )

  // Fetch leadership insights for analytics tab - use program year boundaries
  const { data: leadershipInsights, isLoading: isLoadingLeadership } =
    useLeadershipInsights(
      districtId || null,
      selectedProgramYear.startDate,
      selectedDate || selectedProgramYear.endDate
    )

  // Fetch distinguished club analytics for analytics tab - use program year boundaries
  const { data: distinguishedAnalytics, isLoading: isLoadingDistinguished } =
    useDistinguishedClubAnalytics(
      districtId || null,
      selectedProgramYear.startDate,
      selectedDate || selectedProgramYear.endDate
    )

  // Fetch payment trend data for trends tab - fetch 3 years for multi-year comparison
  const { data: paymentsTrendData, isLoading: isLoadingPaymentsTrend } =
    usePaymentsTrend(
      districtId || null,
      undefined, // Let hook fetch 3 years automatically for comparison
      selectedDate || selectedProgramYear.endDate
    )

  const districtName = selectedDistrict?.name || 'Unknown District'

  // Get all clubs from analytics
  const allClubs = analytics?.allClubs || []

  // Separate intervention-required and vulnerable clubs - now they come as separate arrays
  const interventionRequiredClubs = React.useMemo(() => {
    return analytics?.interventionRequiredClubs || []
  }, [analytics?.interventionRequiredClubs])

  const vulnerableClubs = React.useMemo(() => {
    return analytics?.vulnerableClubs || []
  }, [analytics?.vulnerableClubs])

  // Derive overview data from aggregated analytics (for overview tab)
  // This uses pre-computed data for faster initial load
  // Requirements: 5.1, 5.2
  const overviewData = React.useMemo(() => {
    if (!aggregatedAnalytics) return null

    return {
      // Summary metrics from aggregated endpoint
      totalMembership: aggregatedAnalytics.summary.totalMembership,
      membershipChange: aggregatedAnalytics.summary.membershipChange,
      clubCounts: aggregatedAnalytics.summary.clubCounts,
      distinguishedClubs: aggregatedAnalytics.summary.distinguishedClubs,
      distinguishedProjection: aggregatedAnalytics.summary.distinguishedProjection,
      // Trend data from time-series index
      membershipTrend: aggregatedAnalytics.trends.membership,
      // Year-over-year comparison
      yearOverYear: aggregatedAnalytics.yearOverYear,
      // Metadata
      dataSource: aggregatedAnalytics.dataSource,
      computedAt: aggregatedAnalytics.computedAt,
    }
  }, [aggregatedAnalytics])

  // Determine if we have data for the overview tab
  // Use aggregated data if available, otherwise fall back to full analytics
  const hasOverviewData = overviewData !== null || analytics !== null

  // Loading state for overview tab - prefer aggregated, but show loading if both are loading
  const isLoadingOverview = isLoadingAggregated && isLoadingAnalytics

  // Error state for overview - only show error if both fail
  const overviewError = aggregatedError && analyticsError ? aggregatedError : null

  // Get available dates sorted in descending order (filtered by program year)
  const availableDates = cachedDatesInProgramYear.sort((a, b) =>
    b.localeCompare(a)
  )

  // Tab configuration
  const tabs: Array<{ id: TabType; label: string; disabled?: boolean }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'clubs', label: 'Clubs' },
    { id: 'divisions', label: 'Divisions & Areas' },
    { id: 'trends', label: 'Trends' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'globalRankings', label: 'Global Rankings' },
  ]

  // Handle club click
  const handleClubClick = (club: ClubTrend) => {
    setSelectedClub(club)
  }

  // Close modal
  const handleCloseModal = () => {
    setSelectedClub(null)
  }

  // Handle date selection
  const handleDateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    setSelectedDate(value === 'latest' ? undefined : value)
  }

  // Format date for display (using utility to avoid UTC timezone shift)
  const formatDate = (dateStr: string) => formatDisplayDate(dateStr)

  // Handle backfill start
  const handleBackfillStart = (backfillId: string) => {
    if (districtId) {
      addBackfill({
        backfillId,
        type: 'district',
        districtId,
      })
    }
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-100" id="main-content">
        <div className="container mx-auto px-4 py-4 sm:py-8">
          {/* Header */}
          <div className="mb-4 sm:mb-6">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 text-tm-loyal-blue hover:text-tm-loyal-blue-80 font-tm-headline font-medium transition-colors mb-4"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back to Rankings
            </button>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-tm-headline font-bold text-tm-black">
                  {districtName}
                </h1>
                <p className="text-sm sm:text-base font-tm-body text-gray-600 mt-1">
                  District Statistics & Performance Analytics
                </p>
              </div>

              {/* Program Year, Date Selector and Backfill Button */}
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-start">
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
                {availableDates.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor="global-date-selector"
                      className="text-xs sm:text-sm font-tm-body font-medium text-gray-700"
                    >
                      View Specific Date
                    </label>
                    <select
                      id="global-date-selector"
                      value={selectedDate || 'latest'}
                      onChange={handleDateChange}
                      className="px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-tm-loyal-blue focus:border-transparent bg-white text-gray-900 text-sm font-tm-body"
                      style={{ color: 'var(--tm-black)' }}
                    >
                      <option value="latest" className="text-gray-900 bg-white">
                        Latest in Program Year
                      </option>
                      {availableDates.map(date => (
                        <option
                          key={date}
                          value={date}
                          className="text-gray-900 bg-white"
                        >
                          {formatDate(date)}
                        </option>
                      ))}
                    </select>
                    <div className="text-xs font-tm-body text-gray-500">
                      {availableDates.length} date
                      {availableDates.length !== 1 ? 's' : ''} in program year
                    </div>
                  </div>
                )}

                {/* Backfill Button */}
                {districtId && (
                  <div className="flex flex-col gap-2">
                    <label className="text-xs sm:text-sm font-tm-body font-medium text-gray-700 opacity-0 pointer-events-none hidden sm:block">
                      Actions
                    </label>
                    <div className="flex gap-2">
                      <DistrictBackfillButton
                        districtId={districtId}
                        onBackfillStart={handleBackfillStart}
                      />
                      {hasOverviewData && (
                        <DistrictExportButton
                          districtId={districtId}
                          startDate={selectedProgramYear.startDate}
                          endDate={selectedDate || selectedProgramYear.endDate}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-lg shadow-md mb-4 sm:mb-6">
            <div className="border-b border-gray-200">
              <nav className="flex -mb-px overflow-x-auto scrollbar-hide">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => !tab.disabled && setActiveTab(tab.id)}
                    disabled={tab.disabled}
                    className={`
                      px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-tm-headline font-medium whitespace-nowrap transition-colors
                      ${
                        activeTab === tab.id
                          ? 'border-b-2 border-tm-loyal-blue text-tm-loyal-blue'
                          : tab.disabled
                            ? 'text-gray-400 cursor-not-allowed'
                            : 'text-gray-600 hover:text-gray-900 hover:border-b-2 hover:border-tm-cool-gray'
                      }
                    `}
                  >
                    {tab.label}
                    {tab.disabled && (
                      <span className="ml-2 text-xs font-tm-body text-gray-400">
                        (Coming Soon)
                      </span>
                    )}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Global Error State */}
          {overviewError && activeTab === 'overview' && (
            <ErrorDisplay
              error={overviewError}
              title="Failed to Load District Data"
              onRetry={() => {
                refetchAggregated()
                refetchAnalytics()
              }}
              showDetails={true}
            />
          )}

          {/* Fallback Data Warning - shown when aggregated endpoint failed but individual succeeded */}
          {aggregatedUsedFallback && activeTab === 'overview' && hasOverviewData && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-sm font-tm-body text-yellow-800">
                  Using fallback data source. Pre-computed analytics may not be available.
                </span>
              </div>
            </div>
          )}

          {/* No Data Prompt with Backfill Button */}
          {!isLoadingOverview &&
            !overviewError &&
            !hasOverviewData &&
            districtId && (
              <EmptyState
                title="No District Data Available"
                message="This district doesn't have any cached historical data yet. Start a backfill to collect performance data and unlock powerful analytics."
                icon="backfill"
                action={{
                  label: 'Start Backfill',
                  onClick: () => {
                    // This will be handled by the DistrictBackfillButton component
                    const backfillBtn = document.querySelector(
                      '[data-district-backfill]'
                    ) as HTMLButtonElement
                    if (backfillBtn) backfillBtn.click()
                  },
                }}
              />
            )}

          {/* Tab Content */}
          <div className="space-y-4 sm:space-y-6">
            {activeTab === 'overview' && districtId && hasOverviewData && (
              <>
                {/* District Overview - Now uses global date selector */}
                <DistrictOverview
                  districtId={districtId}
                  districtName={districtName}
                  {...(selectedDate && { selectedDate })}
                  programYearStartDate={selectedProgramYear.startDate}
                />

                {/* Intervention Required Clubs Panel - uses full analytics for club details */}
                {analytics && (
                  <InterventionRequiredClubsPanel
                    clubs={interventionRequiredClubs}
                    isLoading={isLoadingAnalytics}
                  />
                )}

                {/* Vulnerable Clubs Panel - uses full analytics for club details */}
                {analytics && (
                  <VulnerableClubsPanel
                    clubs={vulnerableClubs}
                    isLoading={isLoadingAnalytics}
                  />
                )}

                {/* Distinguished Progress Chart - uses aggregated data for faster load */}
                {/* Falls back to full analytics if aggregated not available */}
                <LazyChart height="300px">
                  <DistinguishedProgressChart
                    distinguishedClubs={
                      overviewData?.distinguishedClubs ?? analytics?.distinguishedClubs ?? {
                        smedley: 0,
                        presidents: 0,
                        select: 0,
                        distinguished: 0,
                        total: 0,
                      }
                    }
                    distinguishedProjection={
                      overviewData?.distinguishedProjection ?? analytics?.distinguishedProjection ?? 0
                    }
                    totalClubs={
                      overviewData?.clubCounts.total ?? analytics?.allClubs.length ?? 0
                    }
                    isLoading={isLoadingOverview}
                  />
                </LazyChart>
              </>
            )}

            {activeTab === 'clubs' && districtId && (
              <>
                <ClubsTable
                  clubs={allClubs}
                  districtId={districtId}
                  isLoading={isLoadingAnalytics}
                  onClubClick={handleClubClick}
                />
                <ClubDetailModal
                  club={selectedClub}
                  onClose={handleCloseModal}
                />
              </>
            )}

            {activeTab === 'divisions' && (
              <>
                {/* Division Performance Cards */}
                {districtStatistics && (
                  <DivisionPerformanceCards
                    districtSnapshot={districtStatistics}
                    isLoading={isLoadingStatistics}
                    snapshotTimestamp={districtStatistics.asOfDate}
                  />
                )}

                {/* Division and Area Recognition Panel - DDP and DAP criteria and progress */}
                {districtStatistics && (
                  <DivisionAreaRecognitionPanel
                    divisions={extractDivisionPerformance(districtStatistics)}
                    isLoading={isLoadingStatistics}
                  />
                )}

                {/* Division Rankings */}
                {analytics && (
                  <DivisionRankings
                    divisions={analytics.divisionRankings}
                    {...(analytics.divisionRecognition && {
                      recognition: analytics.divisionRecognition,
                    })}
                    isLoading={isLoadingAnalytics}
                  />
                )}

                {/* Area Performance Chart - Lazy Loaded */}
                {analytics && (
                  <LazyChart height="400px">
                    <AreaPerformanceChart
                      areas={analytics.topPerformingAreas}
                      isLoading={isLoadingAnalytics}
                    />
                  </LazyChart>
                )}
              </>
            )}

            {activeTab === 'trends' && (
              <>
                {/* Membership Trend Chart - Lazy Loaded */}
                {analytics && (
                  <LazyChart height="400px">
                    <MembershipTrendChart
                      membershipTrend={analytics.membershipTrend}
                      isLoading={isLoadingAnalytics}
                    />
                  </LazyChart>
                )}

                {/* Membership Payments Chart - Lazy Loaded */}
                {paymentsTrendData && (
                  <LazyChart height="450px">
                    <MembershipPaymentsChart
                      paymentsTrend={paymentsTrendData.currentYearTrend}
                      multiYearData={paymentsTrendData.multiYearData}
                      statistics={paymentsTrendData.statistics}
                      isLoading={isLoadingPaymentsTrend}
                    />
                  </LazyChart>
                )}

                {/* Year-Over-Year Comparison - Lazy Loaded */}
                {analytics && (
                  <LazyChart height="300px">
                    <YearOverYearComparison
                      {...(analytics.yearOverYear && {
                        yearOverYear: analytics.yearOverYear,
                      })}
                      currentYear={{
                        totalMembership: analytics.totalMembership,
                        distinguishedClubs: analytics.distinguishedClubs.total,
                        thrivingClubs: analytics.thrivingClubs.length,
                        totalClubs: analytics.allClubs.length,
                      }}
                      isLoading={isLoadingAnalytics}
                    />
                  </LazyChart>
                )}
              </>
            )}

            {activeTab === 'analytics' && (
              <>
                {/* Leadership Insights */}
                <LeadershipInsights
                  insights={leadershipInsights || null}
                  isLoading={isLoadingLeadership}
                />

                {/* Top Growth Clubs */}
                {analytics && (
                  <TopGrowthClubs
                    topGrowthClubs={analytics.topGrowthClubs}
                    topDCPClubs={analytics.allClubs
                      .filter(club => club.dcpGoalsTrend.length > 0)
                      .map(club => ({
                        clubId: club.clubId,
                        clubName: club.clubName,
                        goalsAchieved:
                          club.dcpGoalsTrend[club.dcpGoalsTrend.length - 1]
                            ?.goalsAchieved || 0,
                        ...(club.distinguishedLevel &&
                          [
                            'Smedley',
                            'President',
                            'Select',
                            'Distinguished',
                          ].includes(club.distinguishedLevel) && {
                            distinguishedLevel: club.distinguishedLevel as
                              | 'Smedley'
                              | 'President'
                              | 'Select'
                              | 'Distinguished',
                          }),
                      }))
                      .sort((a, b) => b.goalsAchieved - a.goalsAchieved)
                      .slice(0, 10)}
                    isLoading={isLoadingAnalytics}
                  />
                )}

                {/* DCP Goal Analysis - Lazy Loaded */}
                {distinguishedAnalytics && (
                  <LazyChart height="400px">
                    <DCPGoalAnalysis
                      dcpGoalAnalysis={distinguishedAnalytics.dcpGoalAnalysis}
                      isLoading={isLoadingDistinguished}
                    />
                  </LazyChart>
                )}
              </>
            )}

            {activeTab === 'globalRankings' && districtId && (
              <GlobalRankingsTab
                districtId={districtId}
                districtName={districtName}
              />
            )}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}

export default DistrictDetailPage
