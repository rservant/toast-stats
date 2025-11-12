import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import DistrictSelector from '../components/DistrictSelector';
import DashboardLayout from '../components/DashboardLayout';
import StatCard from '../components/StatCard';
import ErrorBoundary from '../components/ErrorBoundary';
import MembershipChart from '../components/MembershipChart';
import ClubPerformanceTable from '../components/ClubPerformanceTable';
import ClubStatusChart from '../components/ClubStatusChart';
import { useDistrictStatistics } from '../hooks/useMembershipData';
import { useClubs } from '../hooks/useClubs';

const DashboardPage: React.FC = () => {
  const { logout } = useAuth();
  const [selectedDistrictId, setSelectedDistrictId] = useState<string | null>(null);
  
  // Fetch district statistics and clubs data
  const { data: statistics, isLoading: isLoadingStats } = useDistrictStatistics(selectedDistrictId);
  const { data: clubsData, isLoading: isLoadingClubs } = useClubs(selectedDistrictId);

  const handleDistrictSelect = (districtId: string) => {
    setSelectedDistrictId(districtId);
  };

  const header = (
    <>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <h1 className="text-3xl font-bold text-gray-900">
          Toastmasters District Visualizer
        </h1>
        <button
          onClick={logout}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
          aria-label="Logout"
        >
          Logout
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <DistrictSelector
          selectedDistrictId={selectedDistrictId}
          onDistrictSelect={handleDistrictSelect}
        />
      </div>
    </>
  );

  // Determine trend based on change percentage
  const getMembershipTrend = (changePercent: number): 'positive' | 'negative' | 'neutral' => {
    if (changePercent > 0) return 'positive';
    if (changePercent < 0) return 'negative';
    return 'neutral';
  };

  return (
    <ErrorBoundary>
      {selectedDistrictId ? (
        <DashboardLayout header={header}>
          {/* Membership Statistics */}
          {isLoadingStats ? (
            <>
              <StatCard
                name="Total Members"
                value="..."
                changePercent={0}
                trend="neutral"
              />
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
                name="Total Members"
                value={statistics.membership.total.toLocaleString()}
                change={statistics.membership.change}
                changePercent={statistics.membership.changePercent}
                trend={getMembershipTrend(statistics.membership.changePercent)}
              />
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
                name="Total Members"
                value="N/A"
                changePercent={0}
                trend="neutral"
              />
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

          {/* Membership Chart - Full width */}
          <div className="col-span-1 sm:col-span-2 lg:col-span-4">
            <MembershipChart districtId={selectedDistrictId} months={12} />
          </div>

          {/* Club Status Chart - Full width */}
          <div className="col-span-1 sm:col-span-2 lg:col-span-4">
            <ClubStatusChart
              clubs={clubsData?.clubs || []}
              isLoading={isLoadingClubs}
            />
          </div>

          {/* Club Performance Table - Full width */}
          <div className="col-span-1 sm:col-span-2 lg:col-span-4">
            <ClubPerformanceTable
              clubs={clubsData?.clubs || []}
              isLoading={isLoadingClubs}
            />
          </div>
        </DashboardLayout>
      ) : (
        <div className="min-h-screen bg-gray-100">
          <div className="container mx-auto px-4 py-8">
            {header}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-6">
              <p className="text-blue-800">
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
