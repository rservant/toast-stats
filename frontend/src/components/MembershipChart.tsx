import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useMembershipHistory } from '../hooks/useMembershipData';

interface MembershipChartProps {
  districtId: string;
  months?: number;
}

const MembershipChart: React.FC<MembershipChartProps> = ({
  districtId,
  months = 12,
}) => {
  const { data, isLoading, isError, error } = useMembershipHistory(
    districtId,
    months
  );

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

  if (!data || data.data.length === 0) {
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

  // Format data for the chart
  const chartData = data.data.map((point) => ({
    date: new Date(point.date).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    }),
    members: point.count,
    fullDate: point.date,
  }));

  // Custom tooltip component
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
        <div className="bg-white border border-gray-300 rounded-lg shadow-lg p-3">
          <p className="text-sm font-medium text-gray-900 mb-1">
            {formattedDate}
          </p>
          <p className="text-sm text-gray-700">
            <span className="font-semibold">Members:</span>{' '}
            {data.members.toLocaleString()}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        Membership Trends ({months} Months)
      </h2>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart
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
            iconType="line"
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
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default MembershipChart;
