import { useMemo } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { DailyReportsResponse } from '../types/districts';

interface DailyReportTrendsProps {
  data: DailyReportsResponse | undefined;
  isLoading: boolean;
  error: Error | null;
}

interface AggregatedData {
  period: string;
  newMembers: number;
  renewals: number;
  awards: number;
  netChange: number;
}

export const DailyReportTrends = ({
  data,
  isLoading,
  error,
}: DailyReportTrendsProps) => {
  // Calculate daily trend data
  const dailyTrendData = useMemo(() => {
    if (!data?.reports) return [];

    return data.reports.map((report) => ({
      date: new Date(report.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      fullDate: report.date,
      newMembers: report.newMembers,
      renewals: report.renewals,
      awards: report.awards,
      netChange: report.newMembers + report.renewals,
    }));
  }, [data]);

  // Calculate weekly aggregations
  const weeklyData = useMemo((): AggregatedData[] => {
    if (!data?.reports || data.reports.length === 0) return [];

    const weeks = new Map<string, AggregatedData>();

    data.reports.forEach((report) => {
      const date = new Date(report.date);
      // Get the Monday of the week
      const monday = new Date(date);
      monday.setDate(date.getDate() - date.getDay() + 1);
      const weekKey = monday.toISOString().split('T')[0];

      if (!weeks.has(weekKey)) {
        weeks.set(weekKey, {
          period: `Week of ${monday.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })}`,
          newMembers: 0,
          renewals: 0,
          awards: 0,
          netChange: 0,
        });
      }

      const week = weeks.get(weekKey)!;
      week.newMembers += report.newMembers;
      week.renewals += report.renewals;
      week.awards += report.awards;
      week.netChange += report.newMembers + report.renewals;
    });

    return Array.from(weeks.values()).sort((a, b) =>
      a.period.localeCompare(b.period)
    );
  }, [data]);

  // Calculate monthly aggregations
  const monthlyData = useMemo((): AggregatedData[] => {
    if (!data?.reports || data.reports.length === 0) return [];

    const months = new Map<string, AggregatedData>();

    data.reports.forEach((report) => {
      const date = new Date(report.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!months.has(monthKey)) {
        months.set(monthKey, {
          period: date.toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric',
          }),
          newMembers: 0,
          renewals: 0,
          awards: 0,
          netChange: 0,
        });
      }

      const month = months.get(monthKey)!;
      month.newMembers += report.newMembers;
      month.renewals += report.renewals;
      month.awards += report.awards;
      month.netChange += report.newMembers + report.renewals;
    });

    return Array.from(months.values()).sort((a, b) =>
      a.period.localeCompare(b.period)
    );
  }, [data]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    if (!data?.reports || data.reports.length === 0) {
      return {
        totalNewMembers: 0,
        totalRenewals: 0,
        totalAwards: 0,
        totalNetChange: 0,
        avgDailyNewMembers: 0,
        avgDailyRenewals: 0,
        avgDailyAwards: 0,
      };
    }

    const totals = data.reports.reduce(
      (acc, report) => ({
        newMembers: acc.newMembers + report.newMembers,
        renewals: acc.renewals + report.renewals,
        awards: acc.awards + report.awards,
      }),
      { newMembers: 0, renewals: 0, awards: 0 }
    );

    const days = data.reports.length;

    return {
      totalNewMembers: totals.newMembers,
      totalRenewals: totals.renewals,
      totalAwards: totals.awards,
      totalNetChange: totals.newMembers + totals.renewals,
      avgDailyNewMembers: (totals.newMembers / days).toFixed(1),
      avgDailyRenewals: (totals.renewals / days).toFixed(1),
      avgDailyAwards: (totals.awards / days).toFixed(1),
    };
  }, [data]);

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-red-600">
          Error loading trend data: {error.message}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading trend analysis...</div>
        </div>
      </div>
    );
  }

  if (!data?.reports || data.reports.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-8 text-gray-500">
          No data available for the selected date range.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Statistics */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-4">
          Period Summary
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-blue-50 rounded-lg p-3 sm:p-4">
            <div className="text-xs sm:text-sm text-blue-600 font-medium">
              Total New Members
            </div>
            <div className="text-xl sm:text-2xl font-bold text-blue-900">
              {summaryStats.totalNewMembers}
            </div>
            <div className="text-xs text-blue-600 mt-1">
              Avg: {summaryStats.avgDailyNewMembers}/day
            </div>
          </div>
          <div className="bg-green-50 rounded-lg p-3 sm:p-4">
            <div className="text-xs sm:text-sm text-green-600 font-medium">
              Total Renewals
            </div>
            <div className="text-xl sm:text-2xl font-bold text-green-900">
              {summaryStats.totalRenewals}
            </div>
            <div className="text-xs text-green-600 mt-1">
              Avg: {summaryStats.avgDailyRenewals}/day
            </div>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 sm:p-4">
            <div className="text-xs sm:text-sm text-purple-600 font-medium">
              Total Awards
            </div>
            <div className="text-xl sm:text-2xl font-bold text-purple-900">
              {summaryStats.totalAwards}
            </div>
            <div className="text-xs text-purple-600 mt-1">
              Avg: {summaryStats.avgDailyAwards}/day
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
            <div className="text-xs sm:text-sm text-gray-600 font-medium">
              Net Change
            </div>
            <div className="text-xl sm:text-2xl font-bold text-gray-900">
              +{summaryStats.totalNetChange}
            </div>
            <div className="text-xs text-gray-600 mt-1">
              New + Renewals
            </div>
          </div>
        </div>
      </div>

      {/* Daily Trends Chart */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-4">
          Daily Trends
        </h3>
        <div className="w-full overflow-x-auto">
          <div className="min-w-[320px]">
            <ResponsiveContainer width="100%" height={280} minWidth={320}>
              <LineChart data={dailyTrendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 10 }} width={50} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line
                  type="monotone"
                  dataKey="newMembers"
                  stroke="#3b82f6"
                  name="New Members"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="renewals"
                  stroke="#10b981"
                  name="Renewals"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="awards"
                  stroke="#8b5cf6"
                  name="Awards"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Weekly Aggregation */}
      {weeklyData.length > 1 && (
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-4">
            Weekly Summary
          </h3>
          <div className="w-full overflow-x-auto">
            <div className="min-w-[320px]">
              <ResponsiveContainer width="100%" height={280} minWidth={320}>
                <BarChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="period"
                    tick={{ fontSize: 10 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: 10 }} width={50} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="newMembers" fill="#3b82f6" name="New Members" />
                  <Bar dataKey="renewals" fill="#10b981" name="Renewals" />
                  <Bar dataKey="awards" fill="#8b5cf6" name="Awards" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Monthly Comparison */}
      {monthlyData.length > 1 && (
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-4">
            Month-by-Month Comparison
          </h3>
          <div className="w-full overflow-x-auto">
            <div className="min-w-[320px]">
              <ResponsiveContainer width="100%" height={280} minWidth={320}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
                  <YAxis tick={{ fontSize: 10 }} width={50} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="newMembers" fill="#3b82f6" name="New Members" />
                  <Bar dataKey="renewals" fill="#10b981" name="Renewals" />
                  <Bar dataKey="awards" fill="#8b5cf6" name="Awards" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Monthly Comparison Table */}
          <div className="mt-6 overflow-x-auto -mx-4 sm:mx-0">
            <div className="inline-block min-w-full align-middle">
              <div className="overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Month
                  </th>
                  <th className="px-3 sm:px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                    New Members
                  </th>
                  <th className="px-3 sm:px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Renewals
                  </th>
                  <th className="px-3 sm:px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Awards
                  </th>
                  <th className="px-3 sm:px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Net Change
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {monthlyData.map((month, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium text-gray-900">
                      {month.period}
                    </td>
                    <td className="px-3 sm:px-4 py-3 text-xs sm:text-sm text-right text-gray-700">
                      {month.newMembers}
                    </td>
                    <td className="px-3 sm:px-4 py-3 text-xs sm:text-sm text-right text-gray-700">
                      {month.renewals}
                    </td>
                    <td className="px-3 sm:px-4 py-3 text-xs sm:text-sm text-right text-gray-700">
                      {month.awards}
                    </td>
                    <td className="px-3 sm:px-4 py-3 text-xs sm:text-sm text-right font-medium text-gray-900">
                      +{month.netChange}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
