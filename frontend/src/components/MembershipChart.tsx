import React from 'react';
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Scatter,
  ComposedChart,
} from 'recharts';
import { useEnhancedMembershipData } from '../hooks/useIntegratedData';

interface MembershipChartProps {
  districtId: string;
  months?: number;
}

const MembershipChart: React.FC<MembershipChartProps> = ({
  districtId,
  months = 12,
}) => {
  const { data, isLoading, error } = useEnhancedMembershipData(
    districtId,
    months
  );
  const isError = !!error;

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Membership Trends
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
          Membership Trends
        </h2>
        <div className="flex items-center justify-center h-80">
          <div className="text-center">
            <p className="text-red-600 font-medium mb-2">
              Failed to load membership data
            </p>
            <p className="text-gray-600 text-sm">
              {error?.message || 'An unexpected error occurred'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Membership Trends
        </h2>
        <div className="flex items-center justify-center h-80">
          <p className="text-gray-600">No membership data available</p>
        </div>
      </div>
    );
  }

  // Format data for the chart with daily events
  const chartData = data.map((point) => ({
    date: new Date(point.date).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    }),
    members: point.count,
    fullDate: point.date,
    dailyEvents: point.dailyEvents,
    isSignificant: point.isSignificant,
    // For scatter plot - only show significant events
    significantValue: point.isSignificant ? point.count : null,
  }));

  // Custom tooltip component with daily events
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const formattedDate = new Date(data.fullDate).toLocaleDateString(
        'en-US',
        {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        }
      );

      return (
        <div className="bg-white border border-gray-300 rounded-lg shadow-lg p-3 max-w-xs">
          <p className="text-sm font-medium text-gray-900 mb-2">
            {formattedDate}
          </p>
          <p className="text-sm text-gray-700 mb-1">
            <span className="font-semibold">Members:</span>{' '}
            {data.members.toLocaleString()}
          </p>
          {data.dailyEvents && (
            <div className="mt-2 pt-2 border-t border-gray-200">
              <p className="text-xs font-semibold text-gray-600 mb-1">Daily Activity:</p>
              <p className="text-xs text-green-600">
                +{data.dailyEvents.newMembers} new members
              </p>
              <p className="text-xs text-orange-600">
                {data.dailyEvents.renewals} renewals
              </p>
              <p className="text-xs text-blue-600">
                {data.dailyEvents.awards} awards
              </p>
              <p className="text-xs text-gray-700 font-medium mt-1">
                Net: {data.dailyEvents.netChange > 0 ? '+' : ''}{data.dailyEvents.netChange}
              </p>
            </div>
          )}
          {data.isSignificant && (
            <div className="mt-2 pt-2 border-t border-gray-200">
              <p className="text-xs font-semibold text-purple-600">⭐ Significant Event</p>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Membership Trends ({months} Months)
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            ⭐ marks significant daily events
          </p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart
          data={chartData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
            tickFormatter={(value) => value.toLocaleString()}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: '14px' }}
            verticalAlign="top"
            height={36}
          />
          <Line
            type="monotone"
            dataKey="members"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ fill: '#3b82f6', r: 4 }}
            activeDot={{ r: 6 }}
            name="Total Members"
          />
          <Scatter
            dataKey="significantValue"
            fill="#9333ea"
            shape="star"
            name="Significant Events"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default MembershipChart;
