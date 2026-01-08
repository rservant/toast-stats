import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDistricts } from '../hooks/useDistricts'
import { useDistrictAnalytics, ClubTrend } from '../hooks/useDistrictAnalytics'
import { useLeadershipInsights } from '../hooks/useLeadershipInsights'
import { useDistinguishedClubAnalytics } from '../hooks/useDistinguishedClubAnalytics'
import { useDistrictCachedDates } from '../hooks/useDistrictData'
import { useProgramYear } from '../contexts/ProgramYearContext'
import { ProgramYearSelector } from '../components/ProgramYearSelector'
import {
  getAvailableProgramYears,
  filterDatesByProgramYear,
  getMostRecentDateInProgramYear,
} from '../utils/programYear'
import { formatDisplayDate } from '../utils/dateFormatting'
import { DistrictOverview } from '../components/DistrictOverview'
import { AtRiskClubsPanel } from '../components/AtRiskClubsPanel'
import { CriticalClubsPanel } from '../components/CriticalClubsPanel'
import { DistinguishedProgressChart } from '../components/DistinguishedProgressChart'
import { ClubsTable } from '../components/ClubsTable'
import { ClubDetailModal } from '../components/ClubDetailModal'
import { DivisionRankings } from '../components/DivisionRankings'
import { AreaPerformanceChart } from '../components/AreaPerformanceChart'
import { MembershipTrendChart } from '../components/MembershipTrendChart'
import { YearOverYearComparison } from '../components/YearOverYearComparison'
import { LeadershipInsights } from '../components/LeadershipInsights'
import { TopGrowthClubs } from '../components/TopGrowthClubs'
import { DCPGoalAnalysis } from '../components/DCPGoalAnalysis'

import ErrorBoundary from '../components/ErrorBoundary'
import { ErrorDisplay, EmptyState } from '../components/ErrorDisplay'
import { DistrictBackfillButton } from '../components/DistrictBackfillButton'
import { LazyChart } from '../components/LazyChart'
import { useBackfillContext } from '../contexts/BackfillContext'

type TabType = 'overview' | 'clubs' | 'divisions' | 'trends' | 'analytics'

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

  // Fetch analytics with program year boundaries
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

  const districtName = selectedDistrict?.name || 'Unknown District'

  // Get all clubs from analytics
  const allClubs = analytics?.allClubs || []

  // Separate critical and at-risk clubs - now they come as separate arrays
  const criticalClubs = React.useMemo(() => {
    return analytics?.criticalClubs || []
  }, [analytics?.criticalClubs])

  const atRiskClubs = React.useMemo(() => {
    return analytics?.atRiskClubs || []
  }, [analytics?.atRiskClubs])

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
                      className="px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-tm-loyal-blue focus:border-transparent bg-white text-gray-900 text-sm font-tm-body"
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
                    <DistrictBackfillButton
                      districtId={districtId}
                      onBackfillStart={handleBackfillStart}
                    />
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
          {analyticsError && activeTab === 'overview' && (
            <ErrorDisplay
              error={analyticsError}
              title="Failed to Load District Data"
              onRetry={() => refetchAnalytics()}
              showDetails={true}
            />
          )}

          {/* No Data Prompt with Backfill Button */}
          {!isLoadingAnalytics &&
            !analyticsError &&
            !analytics &&
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
            {activeTab === 'overview' && districtId && analytics && (
              <>
                {/* District Overview - Now uses global date selector */}
                <DistrictOverview
                  districtId={districtId}
                  districtName={districtName}
                  {...(selectedDate && { selectedDate })}
                  programYearStartDate={selectedProgramYear.startDate}
                />

                {/* Critical Clubs Panel */}
                {analytics && (
                  <CriticalClubsPanel
                    clubs={criticalClubs}
                    isLoading={isLoadingAnalytics}
                  />
                )}

                {/* At-Risk Clubs Panel */}
                {analytics && (
                  <AtRiskClubsPanel
                    clubs={atRiskClubs}
                    isLoading={isLoadingAnalytics}
                  />
                )}

                {/* Distinguished Progress Chart - Lazy Loaded */}
                {analytics && (
                  <LazyChart height="300px">
                    <DistinguishedProgressChart
                      distinguishedClubs={analytics.distinguishedClubs}
                      distinguishedProjection={
                        analytics.distinguishedProjection
                      }
                      totalClubs={analytics.allClubs.length}
                      isLoading={isLoadingAnalytics}
                    />
                  </LazyChart>
                )}
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
                {/* Division Rankings */}
                {analytics && (
                  <DivisionRankings
                    divisions={analytics.divisionRankings}
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
                        healthyClubs: analytics.healthyClubs.length,
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
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}

export default DistrictDetailPage
