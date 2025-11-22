import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDistricts } from '../hooks/useDistricts';
import { useDistrictAnalytics, ClubTrend } from '../hooks/useDistrictAnalytics';
import { useLeadershipInsights } from '../hooks/useLeadershipInsights';
import { useDistinguishedClubAnalytics } from '../hooks/useDistinguishedClubAnalytics';
import { useDistrictCachedDates } from '../hooks/useDistrictData';
import { DistrictOverview } from '../components/DistrictOverview';
import { AtRiskClubsPanel } from '../components/AtRiskClubsPanel';
import { DistinguishedProgressChart } from '../components/DistinguishedProgressChart';
import { ClubsTable } from '../components/ClubsTable';
import { ClubDetailModal } from '../components/ClubDetailModal';
import { DivisionRankings } from '../components/DivisionRankings';
import { AreaPerformanceChart } from '../components/AreaPerformanceChart';
import { MembershipTrendChart } from '../components/MembershipTrendChart';
import { YearOverYearComparison } from '../components/YearOverYearComparison';
import { LeadershipInsights } from '../components/LeadershipInsights';
import { TopGrowthClubs } from '../components/TopGrowthClubs';
import { DCPGoalAnalysis } from '../components/DCPGoalAnalysis';
import ErrorBoundary from '../components/ErrorBoundary';
import { ErrorDisplay, EmptyState } from '../components/ErrorDisplay';
import { DistrictBackfillButton } from '../components/DistrictBackfillButton';
import { LazyChart } from '../components/LazyChart';
import { useBackfillContext } from '../contexts/BackfillContext';

type TabType = 'overview' | 'clubs' | 'divisions' | 'trends' | 'analytics';

const DistrictDetailPage: React.FC = () => {
  const { districtId } = useParams<{ districtId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [selectedClub, setSelectedClub] = useState<ClubTrend | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined);
  const { setActiveBackfillInfo } = useBackfillContext();

  // Fetch district info
  const { data: districtsData } = useDistricts();
  const selectedDistrict = districtsData?.districts?.find((d) => d.id === districtId);

  // Fetch cached dates for date selector
  const { data: cachedDatesData } = useDistrictCachedDates(districtId || '');

  // Fetch analytics with selected date
  const { data: analytics, isLoading: isLoadingAnalytics, error: analyticsError, refetch: refetchAnalytics } = useDistrictAnalytics(
    districtId || null,
    undefined,
    selectedDate
  );

  // Fetch leadership insights for analytics tab
  const { data: leadershipInsights, isLoading: isLoadingLeadership } = useLeadershipInsights(
    districtId || null
  );

  // Fetch distinguished club analytics for analytics tab
  const { data: distinguishedAnalytics, isLoading: isLoadingDistinguished } = useDistinguishedClubAnalytics(
    districtId || null
  );

  const districtName = selectedDistrict?.name || 'Unknown District';

  // Get all clubs from analytics
  const allClubs = analytics?.allClubs || [];

  // Get available dates sorted in descending order
  const availableDates = cachedDatesData?.dates?.sort((a, b) => b.localeCompare(a)) || [];

  // Tab configuration
  const tabs: Array<{ id: TabType; label: string; disabled?: boolean }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'clubs', label: 'Clubs' },
    { id: 'divisions', label: 'Divisions & Areas' },
    { id: 'trends', label: 'Trends' },
    { id: 'analytics', label: 'Analytics' },
  ];

  // Handle club click
  const handleClubClick = (club: ClubTrend) => {
    setSelectedClub(club);
  };

  // Close modal
  const handleCloseModal = () => {
    setSelectedClub(null);
  };

  // Handle date selection
  const handleDateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedDate(value === 'latest' ? undefined : value);
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Handle backfill start
  const handleBackfillStart = (backfillId: string) => {
    if (districtId) {
      setActiveBackfillInfo({
        backfillId,
        type: 'district',
        districtId,
      });
    }
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-100">
        <div className="container mx-auto px-4 py-4 sm:py-8">
          {/* Header */}
          <div className="mb-4 sm:mb-6">
            <button
              onClick={() => navigate(`/district/${districtId}`)}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium transition-colors mb-4"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Dashboard
            </button>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{districtName}</h1>
                <p className="text-sm sm:text-base text-gray-600 mt-1">District Performance Analytics</p>
              </div>
              
              {/* Global Date Selector and Backfill Button */}
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-start">
                {/* Date Selector - Works across all tabs */}
                {availableDates.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <label htmlFor="global-date-selector" className="text-xs sm:text-sm font-medium text-gray-700">
                      View Historical Data
                    </label>
                    <select
                      id="global-date-selector"
                      value={selectedDate || 'latest'}
                      onChange={handleDateChange}
                      className="px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-sm"
                    >
                      <option value="latest">Latest Data</option>
                      {availableDates.map((date) => (
                        <option key={date} value={date}>
                          {formatDate(date)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Backfill Button */}
                {districtId && (
                  <div className="flex flex-col gap-2">
                    <label className="text-xs sm:text-sm font-medium text-gray-700 opacity-0 pointer-events-none hidden sm:block">
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
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => !tab.disabled && setActiveTab(tab.id)}
                    disabled={tab.disabled}
                    className={`
                      px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium whitespace-nowrap transition-colors
                      ${
                        activeTab === tab.id
                          ? 'border-b-2 border-blue-600 text-blue-600'
                          : tab.disabled
                          ? 'text-gray-400 cursor-not-allowed'
                          : 'text-gray-600 hover:text-gray-900 hover:border-b-2 hover:border-gray-300'
                      }
                    `}
                  >
                    {tab.label}
                    {tab.disabled && (
                      <span className="ml-2 text-xs text-gray-400">(Coming Soon)</span>
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
          {!isLoadingAnalytics && !analyticsError && !analytics && districtId && (
            <EmptyState
              title="No District Data Available"
              message="This district doesn't have any cached historical data yet. Start a backfill to collect performance data and unlock powerful analytics."
              icon="backfill"
              action={{
                label: 'Start Backfill',
                onClick: () => {
                  // This will be handled by the DistrictBackfillButton component
                  const backfillBtn = document.querySelector('[data-district-backfill]') as HTMLButtonElement;
                  if (backfillBtn) backfillBtn.click();
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
                  selectedDate={selectedDate}
                />

                {/* At-Risk Clubs Panel */}
                {analytics && (
                  <AtRiskClubsPanel
                    clubs={analytics.atRiskClubs}
                    isLoading={isLoadingAnalytics}
                  />
                )}

                {/* Distinguished Progress Chart - Lazy Loaded */}
                {analytics && (
                  <LazyChart height="300px">
                    <DistinguishedProgressChart
                      distinguishedClubs={analytics.distinguishedClubs}
                      distinguishedProjection={analytics.distinguishedProjection}
                      totalClubs={
                        analytics.healthyClubs +
                        analytics.atRiskClubs.length +
                        analytics.criticalClubs
                      }
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
                <ClubDetailModal club={selectedClub} onClose={handleCloseModal} />
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
                      yearOverYear={analytics.yearOverYear}
                      currentYear={{
                        totalMembership: analytics.totalMembership,
                        distinguishedClubs: analytics.distinguishedClubs.total,
                        healthyClubs: analytics.healthyClubs,
                        totalClubs:
                          analytics.healthyClubs +
                          analytics.atRiskClubs.length +
                          analytics.criticalClubs,
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
                        goalsAchieved: club.dcpGoalsTrend[club.dcpGoalsTrend.length - 1]?.goalsAchieved || 0,
                        distinguishedLevel: club.distinguishedLevel,
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
  );
};

export default DistrictDetailPage;
