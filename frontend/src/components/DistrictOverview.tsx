import React from 'react';
import { useDistrictAnalytics } from '../hooks/useDistrictAnalytics';
import { ExportButton } from './ExportButton';
import { exportDistrictAnalytics } from '../utils/csvExport';
import { LoadingSkeleton } from './LoadingSkeleton';
import { ErrorDisplay, EmptyState } from './ErrorDisplay';
import { Tooltip, InfoIcon } from './Tooltip';

interface DistrictOverviewProps {
  districtId: string;
  districtName: string;
  selectedDate?: string;
}

export const DistrictOverview: React.FC<DistrictOverviewProps> = ({
  districtId,
  districtName,
  selectedDate,
}) => {
  // Fetch analytics with the provided selectedDate
  const { data: analytics, isLoading: isLoadingAnalytics, error } = useDistrictAnalytics(
    districtId,
    undefined,
    selectedDate
  );

  const isLoading = isLoadingAnalytics;

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{districtName} Overview</h2>
          {analytics?.dateRange && (
            <p className="text-sm text-gray-600 mt-1">
              Data range: {formatDate(analytics.dateRange.start)} - {formatDate(analytics.dateRange.end)}
            </p>
          )}
        </div>

        {/* Export Button */}
        {analytics && (
          <div className="flex flex-col gap-2">
            <ExportButton
              onExport={() => exportDistrictAnalytics(
                districtId,
                analytics.dateRange.start,
                analytics.dateRange.end
              )}
              label="Export Analytics"
              disabled={!analytics}
            />
          </div>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <LoadingSkeleton variant="stat" />
          <LoadingSkeleton variant="stat" />
          <LoadingSkeleton variant="stat" />
          <LoadingSkeleton variant="stat" />
        </div>
      )}

      {/* Error State */}
      {!isLoading && error && (
        <ErrorDisplay
          error={error}
          title="Failed to Load District Analytics"
          onRetry={() => window.location.reload()}
          showDetails={true}
        />
      )}

      {/* No Data State */}
      {!isLoading && !error && !analytics && (
        <EmptyState
          title="No Cached Data Available"
          message="This district doesn't have any cached historical data yet. Initiate a backfill to start collecting performance data over time."
          icon="backfill"
          action={{
            label: 'Initiate Backfill',
            onClick: () => {
              // Trigger backfill button - this will be handled by the parent component
              const backfillButton = document.querySelector('[data-backfill-trigger]') as HTMLButtonElement;
              if (backfillButton) {
                backfillButton.click();
              }
            },
          }}
        />
      )}

      {/* Key Metrics */}
      {!isLoading && !error && analytics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Clubs */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1">
                  <p className="text-sm font-medium text-blue-700">Total Clubs</p>
                  <Tooltip content="Total number of clubs in the district, categorized by health status">
                    <InfoIcon />
                  </Tooltip>
                </div>
                <p className="text-3xl font-bold text-blue-900 mt-1">
                  {analytics.allClubs.length}
                </p>
              </div>
              <div className="bg-blue-200 rounded-full p-3">
                <svg className="w-6 h-6 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-green-700 bg-green-100 px-2 py-1 rounded">
                {analytics.healthyClubs} Healthy
              </span>
              {analytics.atRiskClubs.length > 0 && (
                <span className="text-xs text-yellow-700 bg-yellow-100 px-2 py-1 rounded">
                  {analytics.atRiskClubs.length} At-Risk
                </span>
              )}
              {analytics.criticalClubs > 0 && (
                <span className="text-xs text-red-700 bg-red-100 px-2 py-1 rounded">
                  {analytics.criticalClubs} Critical
                </span>
              )}
            </div>
          </div>

          {/* Total Membership */}
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1">
                  <p className="text-sm font-medium text-green-700">Total Membership</p>
                  <Tooltip content="Sum of active members across all clubs in the district">
                    <InfoIcon />
                  </Tooltip>
                </div>
                <p className="text-3xl font-bold text-green-900 mt-1">
                  {analytics.totalMembership.toLocaleString()}
                </p>
              </div>
              <div className="bg-green-200 rounded-full p-3">
                <svg className="w-6 h-6 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>
            <div className="mt-2">
              <span className={`text-xs px-2 py-1 rounded ${
                analytics.membershipChange >= 0
                  ? 'text-green-700 bg-green-100'
                  : 'text-red-700 bg-red-100'
              }`}>
                {analytics.membershipChange >= 0 ? '+' : ''}{analytics.membershipChange} members
              </span>
            </div>
          </div>

          {/* Distinguished Clubs */}
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1">
                  <p className="text-sm font-medium text-purple-700">Distinguished Clubs</p>
                  <Tooltip content="Clubs achieving DCP goals + membership requirements (valid from April 1 onwards): Distinguished (5 goals + 20 members), Select (7 goals + 20 members), President's (9 goals + 20 members), Smedley (10 goals + 25 members)">
                    <InfoIcon />
                  </Tooltip>
                </div>
                <p className="text-3xl font-bold text-purple-900 mt-1">
                  {analytics.distinguishedClubs.total}
                </p>
              </div>
              <div className="bg-purple-200 rounded-full p-3">
                <svg className="w-6 h-6 text-purple-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {analytics.distinguishedClubs.smedley > 0 && (
                <span className="text-xs text-purple-700 bg-purple-100 px-2 py-1 rounded font-semibold">
                  {analytics.distinguishedClubs.smedley} Smedley
                </span>
              )}
              {analytics.distinguishedClubs.presidents > 0 && (
                <span className="text-xs text-purple-700 bg-purple-100 px-2 py-1 rounded">
                  {analytics.distinguishedClubs.presidents} President's
                </span>
              )}
              {analytics.distinguishedClubs.select > 0 && (
                <span className="text-xs text-purple-700 bg-purple-100 px-2 py-1 rounded">
                  {analytics.distinguishedClubs.select} Select
                </span>
              )}
              {analytics.distinguishedClubs.distinguished > 0 && (
                <span className="text-xs text-purple-700 bg-purple-100 px-2 py-1 rounded">
                  {analytics.distinguishedClubs.distinguished} Distinguished
                </span>
              )}
            </div>
          </div>

          {/* Projected Distinguished */}
          <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-4 border border-amber-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1">
                  <p className="text-sm font-medium text-amber-700">Projected Year-End</p>
                  <Tooltip content="Estimated number of distinguished clubs by end of program year based on current trends">
                    <InfoIcon />
                  </Tooltip>
                </div>
                <p className="text-3xl font-bold text-amber-900 mt-1">
                  {analytics.distinguishedProjection}
                </p>
              </div>
              <div className="bg-amber-200 rounded-full p-3">
                <svg className="w-6 h-6 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
            <div className="mt-2">
              <span className="text-xs text-amber-700 bg-amber-100 px-2 py-1 rounded">
                Distinguished Clubs
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
