import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { enableCacheBypass, disableCacheBypass } from '../services/api';
import DistrictSelector from '../components/DistrictSelector';
import DashboardLayout from '../components/DashboardLayout';
import StatCard from '../components/StatCard';
import ErrorBoundary from '../components/ErrorBoundary';
import MembershipChart from '../components/MembershipChart';
import ClubPerformanceTable from '../components/ClubPerformanceTable';
import ClubStatusChart from '../components/ClubStatusChart';
import EducationalAwardsChart from '../components/EducationalAwardsChart';
import { DailyReportCalendar } from '../components/DailyReportCalendar';
import { DailyReportDetail } from '../components/DailyReportDetail';
import { HistoricalDailyReports } from '../components/HistoricalDailyReports';
import SignificantEventsPanel from '../components/SignificantEventsPanel';
import RealTimeMembershipCard from '../components/RealTimeMembershipCard';
import { useDistrictStatistics } from '../hooks/useMembershipData';
import { useEnhancedClubs } from '../hooks/useIntegratedData';
import { useDistricts } from '../hooks/useDistricts';

const DashboardPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedDistrictId, setSelectedDistrictId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  
  // Fetch district statistics and enhanced clubs data with recent changes
  const { data: statistics, isLoading: isLoadingStats } = useDistrictStatistics(selectedDistrictId);
  const { clubs: enhancedClubs, isLoading: isLoadingClubs } = useEnhancedClubs(selectedDistrictId, 7);
  const { data: districtsData } = useDistricts();

  // Get the selected district name
  const selectedDistrictName = districtsData?.districts?.find(
    (d) => d.id === selectedDistrictId
  )?.name || 'Unknown District';

  const handleDistrictSelect = (districtId: string) => {
    setSelectedDistrictId(districtId);
  };

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
  };

  const handleCloseDetail = () => {
    setSelectedDate(null);
  };

  const handleRefresh = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      // Enable cache bypass for the next set of requests
      enableCacheBypass();
      
      // Invalidate all queries to force refetch with cache bypass
      await queryClient.invalidateQueries();
      
      // Wait a bit for queries to refetch
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setLastRefreshed(new Date());
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      // Disable cache bypass after refresh
      disableCacheBypass();
      setIsRefreshing(false);
    }
  };

  const formatLastRefreshed = (date: Date | null): string => {
    if (!date) return 'Never';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins === 1) return '1 minute ago';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    
    return date.toLocaleString();
  };

  const header = (
    <>
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Toastmasters District Statistics
          </h1>
          {selectedDistrictId && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
              <div className="hidden sm:flex flex-col items-end text-sm text-gray-600">
                <span className="font-medium">Last refreshed:</span>
                <span>{formatLastRefreshed(lastRefreshed)}</span>
              </div>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="min-h-[44px] px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
                aria-label="Refresh data"
              >
                <svg
                  className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                <span>{isRefreshing ? 'Refreshing...' : 'Refresh Data'}</span>
              </button>
            </div>
          )}
        </div>
        {selectedDistrictId && (
          <div className="sm:hidden text-xs text-gray-600 bg-gray-50 rounded p-2">
            <span className="font-medium">Last refreshed:</span>{' '}
            <span>{formatLastRefreshed(lastRefreshed)}</span>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
        <DistrictSelector
          selectedDistrictId={selectedDistrictId}
          onDistrictSelect={handleDistrictSelect}
        />
      </div>
    </>
  );

  return (
    <ErrorBoundary>
      {selectedDistrictId ? (
        <DashboardLayout header={header}>
          {/* Membership Statistics - Using Real-Time Integration */}
          <RealTimeMembershipCard districtId={selectedDistrictId} />
          
          {isLoadingStats ? (
            <>
              <StatCard
                name="Total Clubs"
                value="..."
                changePercent={0}
                trend="neutral"
              />
              <StatCard
                name="Educational Awards"
                value="..."
                changePercent={0}
                trend="neutral"
              />
              <StatCard
                name="Distinguished Clubs"
                value="..."
                changePercent={0}
                trend="neutral"
              />
            </>
          ) : statistics ? (
            <>
              <StatCard
                name="Total Clubs"
                value={statistics.clubs.total.toString()}
                changePercent={0}
                trend="neutral"
              />
              <StatCard
                name="Educational Awards"
                value={statistics.education.totalAwards.toLocaleString()}
                changePercent={0}
                trend="neutral"
              />
              <StatCard
                name="Distinguished Clubs"
                value={`${statistics.clubs.distinguished} / ${statistics.clubs.total}`}
                changePercent={
                  statistics.clubs.total > 0
                    ? (statistics.clubs.distinguished / statistics.clubs.total) * 100
                    : 0
                }
                trend={
                  statistics.clubs.total > 0 &&
                  statistics.clubs.distinguished / statistics.clubs.total >= 0.5
                    ? 'positive'
                    : 'neutral'
                }
              />
            </>
          ) : (
            <>
              <StatCard
                name="Total Clubs"
                value="N/A"
                changePercent={0}
                trend="neutral"
              />
              <StatCard
                name="Educational Awards"
                value="N/A"
                changePercent={0}
                trend="neutral"
              />
              <StatCard
                name="Distinguished Clubs"
                value="N/A"
                changePercent={0}
                trend="neutral"
              />
            </>
          )}

          {/* Significant Events Panel - Full width */}
          <div className="col-span-full">
            <SignificantEventsPanel districtId={selectedDistrictId} daysToShow={30} maxEvents={5} />
          </div>

          {/* Membership Chart - Full width */}
          <div className="col-span-full">
            <MembershipChart 
              districtId={selectedDistrictId} 
              districtName={selectedDistrictName}
              months={12} 
            />
          </div>

          {/* Club Status Chart - Full width */}
          <div className="col-span-full">
            <ClubStatusChart
              clubs={enhancedClubs}
              isLoading={isLoadingClubs}
            />
          </div>

          {/* Educational Awards Chart - Full width */}
          <div className="col-span-full">
            <EducationalAwardsChart 
              districtId={selectedDistrictId} 
              districtName={selectedDistrictName}
              months={12} 
            />
          </div>

          {/* Club Performance Table with Recent Changes - Full width */}
          <div className="col-span-full">
            <ClubPerformanceTable
              clubs={enhancedClubs}
              districtId={selectedDistrictId}
              districtName={selectedDistrictName}
              isLoading={isLoadingClubs}
            />
          </div>

          {/* Daily Report Calendar - Full width */}
          <div className="col-span-full">
            <DailyReportCalendar
              districtId={selectedDistrictId}
              onDateSelect={handleDateSelect}
            />
          </div>

          {/* Daily Report Detail - Full width (conditionally rendered) */}
          {selectedDate && (
            <div className="col-span-full">
              <DailyReportDetail
                districtId={selectedDistrictId}
                districtName={selectedDistrictName}
                selectedDate={selectedDate}
                onClose={handleCloseDetail}
              />
            </div>
          )}

          {/* Historical Daily Reports - Full width */}
          <div className="col-span-full">
            <HistoricalDailyReports 
              districtId={selectedDistrictId} 
              districtName={selectedDistrictName}
            />
          </div>
        </DashboardLayout>
      ) : (
        <div className="min-h-screen bg-gray-100">
          <div className="container mx-auto px-4 py-4 sm:py-8">
            {header}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 sm:p-6 mt-6">
              <p className="text-blue-800 text-sm sm:text-base">
                Please select a district to view statistics and visualizations
              </p>
            </div>
          </div>
        </div>
      )}
    </ErrorBoundary>
  );
};

export default DashboardPage;
