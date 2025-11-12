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
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Educational Awards
        </h2>
        <div className="flex items-center justify-center h-80">
          <div className="animate-pulse flex flex-col items-center">
            <div className="h-4 w-32 bg-gray-300 rounded mb-2"></div>
            <div className="h-4 w-24 bg-gray-300 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
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
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Educational Awards
        </h2>
        <div className="flex items-center justify-center h-80">
          <p className="text-gray-600">No educational awards data available</p>
        </div>
      </div>
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
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Educational Awards
          </h2>
          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
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

        {/* View Toggle Buttons and Export */}
        <div className="flex flex-col sm:flex-row gap-2 mt-4 sm:mt-0">
          <div className="flex gap-2">
          <button
            onClick={() => setChartView('byType')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              chartView === 'byType'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            aria-label="View awards by type"
          >
            By Type
          </button>
          <button
            onClick={() => setChartView('byMonth')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              chartView === 'byMonth'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            aria-label="View awards by month"
          >
            By Month
          </button>
          <button
            onClick={() => setChartView('topClubs')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              chartView === 'topClubs'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            aria-label="View top performing clubs"
          >
            Top Clubs
          </button>
          </div>
          <ExportButton
            onExport={handleExport}
            disabled={!data}
            label="Export"
            className="text-sm px-3 py-1.5"
          />
        </div>
      </div>

      {/* Chart Display */}
      <div className="mt-4">
        {chartView === 'byType' && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Awards by Type
            </h3>
            {byTypeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={byTypeData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 60 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="type"
                    stroke="#6b7280"
                    style={{ fontSize: '12px' }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    aria-label="Award Type"
                  />
                  <YAxis
                    stroke="#6b7280"
                    style={{ fontSize: '12px' }}
                    allowDecimals={false}
                    aria-label="Number of Awards"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '0.375rem',
                    }}
                  />
                  <Bar dataKey="count" name="Awards" radius={[8, 8, 0, 0]}>
                    {byTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-80">
                <p className="text-gray-600">No award type data available</p>
              </div>
            )}
          </div>
        )}

        {chartView === 'byMonth' && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Awards Over Time ({months} Months)
            </h3>
            {byMonthData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart
                  data={byMonthData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 60 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="month"
                    stroke="#6b7280"
                    style={{ fontSize: '12px' }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis
                    stroke="#6b7280"
                    style={{ fontSize: '12px' }}
                    allowDecimals={false}
                    tickFormatter={(value) => value.toLocaleString()}
                  />
                  <Tooltip content={<MonthlyTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: '14px' }}
                    iconType="line"
                    verticalAlign="top"
                    height={36}
                  />
                  <Line
                    type="monotone"
                    dataKey="awards"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={{ fill: '#8b5cf6', r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Awards Earned"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-80">
                <p className="text-gray-600">No monthly data available</p>
              </div>
            )}
          </div>
        )}

        {chartView === 'topClubs' && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Top Performing Clubs (by Educational Awards)
            </h3>
            {topClubsData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={topClubsData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 100 }}
                  layout="horizontal"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="clubName"
                    stroke="#6b7280"
                    style={{ fontSize: '11px' }}
                    angle={-45}
                    textAnchor="end"
                    height={120}
                    aria-label="Club Name"
                  />
                  <YAxis
                    stroke="#6b7280"
                    style={{ fontSize: '12px' }}
                    allowDecimals={false}
                    aria-label="Number of Awards"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '0.375rem',
                    }}
                  />
                  <Bar dataKey="awards" name="Awards" radius={[8, 8, 0, 0]}>
                    {topClubsData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-80">
                <p className="text-gray-600">No club data available</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default EducationalAwardsChart;
