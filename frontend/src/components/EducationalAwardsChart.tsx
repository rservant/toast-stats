import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import { useEducationalAwards } from '../hooks/useEducationalAwards';
import { useDistrictStatistics } from '../hooks/useMembershipData';
import { ExportButton } from './ExportButton';
import { exportEducationalAwards } from '../utils/csvExport';

interface EducationalAwardsChartProps {
  districtId: string;
  districtName: string;
  months?: number;
}

type ChartView = 'byType' | 'byMonth' | 'topClubs';

const EducationalAwardsChart: React.FC<EducationalAwardsChartProps> = ({
  districtId,
  districtName,
  months = 12,
}) => {
  const [chartView, setChartView] = useState<ChartView>('byType');
  const { data, isLoading, isError, error } = useEducationalAwards(
    districtId,
    months
  );
  const { data: statistics } = useDistrictStatistics(districtId);

  const handleExport = () => {
    if (data) {
      exportEducationalAwards(data, districtId, districtName);
    }
  };

  if (isLoading) {
    return (
      <section className="bg-white rounded-lg shadow-md p-6" aria-busy="true" aria-label="Loading educational awards">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Educational Awards
        </h2>
        <div className="flex items-center justify-center h-80">
          <div className="animate-pulse flex flex-col items-center">
            <div className="h-4 w-32 bg-gray-300 rounded mb-2"></div>
            <div className="h-4 w-24 bg-gray-300 rounded"></div>
          </div>
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="bg-white rounded-lg shadow-md p-6" role="alert" aria-label="Educational awards error">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Educational Awards
        </h2>
        <div className="flex items-center justify-center h-80">
          <div className="text-center">
            <p className="text-red-600 font-medium mb-2">
              Failed to load educational awards data
            </p>
            <p className="text-gray-600 text-sm">
              {error?.message || 'An unexpected error occurred'}
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="bg-white rounded-lg shadow-md p-6" role="status" aria-label="Educational awards">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Educational Awards
        </h2>
        <div className="flex items-center justify-center h-80">
          <p className="text-gray-600">No educational awards data available</p>
        </div>
      </section>
    );
  }

  // Calculate average awards per member
  const totalMembers = statistics?.membership.total || 0;
  const averageAwardsPerMember =
    totalMembers > 0 ? (data.totalAwards / totalMembers).toFixed(2) : '0.00';

  // Color palette for charts
  const colors = [
    '#3b82f6',
    '#8b5cf6',
    '#ec4899',
    '#f59e0b',
    '#10b981',
    '#06b6d4',
    '#6366f1',
    '#f97316',
  ];

  // Format data for by-type chart
  const byTypeData = data.byType.map((item, index) => ({
    ...item,
    color: colors[index % colors.length],
  }));

  // Format data for monthly chart
  const byMonthData = data.byMonth.map((point) => ({
    month: new Date(point.month).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    }),
    awards: point.count,
    fullDate: point.month,
  }));

  // Format data for top clubs
  const topClubsData = data.topClubs.slice(0, 10).map((club, index) => ({
    ...club,
    color: colors[index % colors.length],
  }));

  // Custom tooltip for monthly chart
  const MonthlyTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const formattedDate = new Date(data.fullDate).toLocaleDateString(
        'en-US',
        {
          month: 'long',
          year: 'numeric',
        }
      );

      return (
        <div className="bg-white border border-gray-300 rounded-lg shadow-lg p-3">
          <p className="text-sm font-medium text-gray-900 mb-1">
            {formattedDate}
          </p>
          <p className="text-sm text-gray-700">
            <span className="font-semibold">Awards:</span>{' '}
            {data.awards.toLocaleString()}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <section className="bg-white rounded-lg shadow-md p-4 sm:p-6" aria-label="Educational awards chart">
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
          <div className="flex-1">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
              Educational Awards
            </h2>
            <div className="flex flex-wrap gap-3 sm:gap-4 text-xs sm:text-sm text-gray-600" role="status" aria-live="polite">
              <div>
                <span className="font-medium">Total Awards:</span>{' '}
                {data.totalAwards.toLocaleString()}
              </div>
              <div>
                <span className="font-medium">Avg per Member:</span>{' '}
                {averageAwardsPerMember}
              </div>
            </div>
          </div>

          <ExportButton
            onExport={handleExport}
            disabled={!data}
            label="Export"
            className="text-xs sm:text-sm px-3 py-2 min-h-[44px] self-start"
          />
        </div>

        {/* View Toggle Buttons */}
        <div className="flex flex-wrap gap-2" role="group" aria-label="Chart view options">
          <button
            onClick={() => setChartView('byType')}
            className={`min-h-[44px] px-3 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors ${
              chartView === 'byType'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            aria-label="View awards by type"
            aria-pressed={chartView === 'byType'}
          >
            By Type
          </button>
          <button
            onClick={() => setChartView('byMonth')}
            className={`min-h-[44px] px-3 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors ${
              chartView === 'byMonth'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            aria-label="View awards by month"
            aria-pressed={chartView === 'byMonth'}
          >
            By Month
          </button>
          <button
            onClick={() => setChartView('topClubs')}
            className={`min-h-[44px] px-3 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors ${
              chartView === 'topClubs'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            aria-label="View top performing clubs"
            aria-pressed={chartView === 'topClubs'}
          >
            Top Clubs
          </button>
        </div>
      </div>

      {/* Chart Display */}
      <div className="mt-4">
        {chartView === 'byType' && (
          <div>
            <h3 className="text-xs sm:text-sm font-medium text-gray-700 mb-3">
              Awards by Type
            </h3>
            {byTypeData.length > 0 ? (
              <div role="img" aria-label={`Bar chart showing ${data.totalAwards} educational awards distributed across ${byTypeData.length} award types`} className="w-full overflow-x-auto">
                <div className="min-w-[320px]">
                  <ResponsiveContainer width="100%" height={280} minWidth={320}>
                    <BarChart
                      data={byTypeData}
                      margin={{ top: 5, right: 10, left: 0, bottom: 60 }}
                      aria-hidden="true"
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="type"
                        stroke="#6b7280"
                        style={{ fontSize: '10px' }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        stroke="#6b7280"
                        style={{ fontSize: '10px' }}
                        allowDecimals={false}
                        width={40}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #e5e7eb',
                          borderRadius: '0.375rem',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="count" name="Awards" radius={[8, 8, 0, 0]}>
                        {byTypeData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-80">
                <p className="text-gray-600">No award type data available</p>
              </div>
            )}
          </div>
        )}

        {chartView === 'byMonth' && (
          <div>
            <h3 className="text-xs sm:text-sm font-medium text-gray-700 mb-3">
              Awards Over Time ({months} Months)
            </h3>
            {byMonthData.length > 0 ? (
              <div role="img" aria-label={`Line chart showing educational awards earned over ${months} months`} className="w-full overflow-x-auto">
                <div className="min-w-[320px]">
                  <ResponsiveContainer width="100%" height={280} minWidth={320}>
                    <LineChart
                      data={byMonthData}
                      margin={{ top: 5, right: 10, left: 0, bottom: 60 }}
                      aria-hidden="true"
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="month"
                        stroke="#6b7280"
                        style={{ fontSize: '10px' }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        stroke="#6b7280"
                        style={{ fontSize: '10px' }}
                        allowDecimals={false}
                        tickFormatter={(value) => value.toLocaleString()}
                        width={50}
                      />
                      <Tooltip content={<MonthlyTooltip />} />
                      <Legend
                        wrapperStyle={{ fontSize: '12px' }}
                        iconType="line"
                        verticalAlign="top"
                        height={36}
                      />
                      <Line
                        type="monotone"
                        dataKey="awards"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        dot={{ fill: '#8b5cf6', r: 3 }}
                        activeDot={{ r: 5 }}
                        name="Awards Earned"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-80">
                <p className="text-gray-600">No monthly data available</p>
              </div>
            )}
          </div>
        )}

        {chartView === 'topClubs' && (
          <div>
            <h3 className="text-xs sm:text-sm font-medium text-gray-700 mb-3">
              Top Performing Clubs (by Educational Awards)
            </h3>
            {topClubsData.length > 0 ? (
              <div role="img" aria-label={`Bar chart showing top ${topClubsData.length} clubs ranked by educational awards`} className="w-full overflow-x-auto">
                <div className="min-w-[320px]">
                  <ResponsiveContainer width="100%" height={320} minWidth={320}>
                    <BarChart
                      data={topClubsData}
                      margin={{ top: 5, right: 10, left: 0, bottom: 100 }}
                      layout="horizontal"
                      aria-hidden="true"
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="clubName"
                        stroke="#6b7280"
                        style={{ fontSize: '9px' }}
                        angle={-45}
                        textAnchor="end"
                        height={120}
                        interval={0}
                      />
                      <YAxis
                        stroke="#6b7280"
                        style={{ fontSize: '10px' }}
                        allowDecimals={false}
                        width={40}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #e5e7eb',
                          borderRadius: '0.375rem',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="awards" name="Awards" radius={[8, 8, 0, 0]}>
                        {topClubsData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-80">
                <p className="text-gray-600">No club data available</p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default EducationalAwardsChart;
