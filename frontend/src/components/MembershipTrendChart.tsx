import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts';
import { LoadingSkeleton } from './LoadingSkeleton';
import { EmptyState } from './ErrorDisplay';

interface MembershipTrendChartProps {
  membershipTrend: Array<{ date: string; count: number }>;
  isLoading?: boolean;
}

export const MembershipTrendChart: React.FC<MembershipTrendChartProps> = ({
  membershipTrend,
  isLoading = false,
}) => {
  if (isLoading) {
    return <LoadingSkeleton variant="chart" />;
  }

  if (!membershipTrend || membershipTrend.length === 0) {
    return (
      <EmptyState
        title="No Membership Trend Data"
        message="There isn't enough historical data to display membership trends. Collect more data over time to see trends."
        icon="data"
      />
    );
  }

  // Sort data by date
  const sortedData = [...membershipTrend].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Calculate statistics
  const counts = sortedData.map(d => d.count);
  const maxMembership = Math.max(...counts);
  const minMembership = Math.min(...counts);
  const startMembership = counts[0];
  const endMembership = counts[counts.length - 1];
  const netChange = endMembership - startMembership;
  const percentChange = ((netChange / startMembership) * 100).toFixed(1);

  // Detect growth/decline periods (3+ consecutive increases/decreases)
  const periods: Array<{ start: number; end: number; type: 'growth' | 'decline' }> = [];
  let currentPeriod: { start: number; type: 'growth' | 'decline' } | null = null;

  for (let i = 1; i < sortedData.length; i++) {
    const change = sortedData[i].count - sortedData[i - 1].count;
    const type = change > 0 ? 'growth' : change < 0 ? 'decline' : null;

    if (type) {
      if (!currentPeriod || currentPeriod.type !== type) {
        if (currentPeriod && i - currentPeriod.start >= 3) {
          periods.push({ ...currentPeriod, end: i - 1 });
        }
        currentPeriod = { start: i - 1, type };
      }
    } else {
      if (currentPeriod && i - currentPeriod.start >= 3) {
        periods.push({ ...currentPeriod, end: i - 1 });
      }
      currentPeriod = null;
    }
  }

  if (currentPeriod && sortedData.length - currentPeriod.start >= 3) {
    periods.push({ ...currentPeriod, end: sortedData.length - 1 });
  }

  // Detect seasonal patterns (simple: compare same months across different periods)
  const monthlyAverages: { [key: string]: number[] } = {};
  sortedData.forEach(point => {
    const month = new Date(point.date).getMonth();
    if (!monthlyAverages[month]) {
      monthlyAverages[month] = [];
    }
    monthlyAverages[month].push(point.count);
  });

  // Find months with consistent patterns
  const seasonalMonths: Array<{ month: number; pattern: 'high' | 'low' }> = [];
  Object.entries(monthlyAverages).forEach(([month, values]) => {
    if (values.length >= 2) {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const overallAvg = counts.reduce((a, b) => a + b, 0) / counts.length;
      const deviation = ((avg - overallAvg) / overallAvg) * 100;
      
      if (Math.abs(deviation) > 5) {
        seasonalMonths.push({
          month: parseInt(month),
          pattern: deviation > 0 ? 'high' : 'low',
        });
      }
    }
  });

  // Program year milestones (Toastmasters year: July 1 - June 30)
  const milestones: Array<{ date: string; label: string }> = [];
  const startDate = new Date(sortedData[0].date);
  const endDate = new Date(sortedData[sortedData.length - 1].date);
  
  // Add program year start dates (July 1)
  for (let year = startDate.getFullYear(); year <= endDate.getFullYear() + 1; year++) {
    const julyFirst = new Date(year, 6, 1); // Month is 0-indexed
    if (julyFirst >= startDate && julyFirst <= endDate) {
      milestones.push({
        date: julyFirst.toISOString().split('T')[0],
        label: `PY ${year}-${year + 1}`,
      });
    }
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const date = new Date(data.date);
      const formattedDate = date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });

      // Find if this point is in a growth/decline period
      const pointIndex = sortedData.findIndex(d => d.date === data.date);
      const period = periods.find(p => pointIndex >= p.start && pointIndex <= p.end);

      return (
        <div className="bg-white border border-gray-300 rounded-lg shadow-lg p-3">
          <p className="text-sm font-medium text-gray-900 mb-1">{formattedDate}</p>
          <p className="text-sm text-blue-600 font-semibold">
            Members: {data.count.toLocaleString()}
          </p>
          {period && (
            <p className={`text-xs mt-1 ${
              period.type === 'growth' ? 'text-green-600' : 'text-red-600'
            }`}>
              {period.type === 'growth' ? '📈 Growth Period' : '📉 Decline Period'}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  // Format date for X-axis
  const formatXAxis = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const chartDescription = `Line chart showing district membership trend from ${sortedData[0].date} to ${sortedData[sortedData.length - 1].date}. Membership ${netChange >= 0 ? 'increased' : 'decreased'} by ${Math.abs(netChange)} members (${percentChange}%).`;

  return (
    <div className="bg-white rounded-lg shadow-md p-6" aria-label="District membership trend chart">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">District Membership Trend</h2>
        <p className="text-sm text-gray-600 mt-1">
          Total membership over time with program year milestones
        </p>
      </div>

      {/* Statistics Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
          <p className="text-xs text-blue-700 font-medium">Current</p>
          <p className="text-2xl font-bold text-blue-900">{endMembership.toLocaleString()}</p>
        </div>
        <div className={`rounded-lg p-3 border ${
          netChange >= 0 
            ? 'bg-green-50 border-green-200' 
            : 'bg-red-50 border-red-200'
        }`}>
          <p className={`text-xs font-medium ${
            netChange >= 0 ? 'text-green-700' : 'text-red-700'
          }`}>
            Net Change
          </p>
          <p className={`text-2xl font-bold ${
            netChange >= 0 ? 'text-green-900' : 'text-red-900'
          }`}>
            {netChange >= 0 ? '+' : ''}{netChange}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
          <p className="text-xs text-gray-700 font-medium">Peak</p>
          <p className="text-2xl font-bold text-gray-900">{maxMembership.toLocaleString()}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
          <p className="text-xs text-gray-700 font-medium">Low</p>
          <p className="text-2xl font-bold text-gray-900">{minMembership.toLocaleString()}</p>
        </div>
      </div>

      {/* Insights */}
      {(periods.length > 0 || seasonalMonths.length > 0) && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">📊 Insights</h3>
          <ul className="space-y-1 text-sm text-blue-800">
            {periods.filter(p => p.type === 'growth').length > 0 && (
              <li>
                • {periods.filter(p => p.type === 'growth').length} sustained growth period(s) detected
              </li>
            )}
            {periods.filter(p => p.type === 'decline').length > 0 && (
              <li>
                • {periods.filter(p => p.type === 'decline').length} sustained decline period(s) detected
              </li>
            )}
            {seasonalMonths.length > 0 && (
              <li>
                • Seasonal patterns detected in {seasonalMonths.length} month(s)
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Chart */}
      <div 
        role="img" 
        aria-label={chartDescription}
        className="w-full overflow-x-auto"
      >
        <div className="min-w-[320px]">
          <ResponsiveContainer width="100%" height={400}>
            <LineChart
              data={sortedData}
              margin={{ top: 5, right: 20, left: 10, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                stroke="#6b7280"
                style={{ fontSize: '11px' }}
                angle={-45}
                textAnchor="end"
                height={80}
                tickFormatter={formatXAxis}
              />
              <YAxis
                stroke="#6b7280"
                style={{ fontSize: '11px' }}
                label={{
                  value: 'Total Members',
                  angle: -90,
                  position: 'insideLeft',
                  style: { fontSize: '12px' },
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '12px' }}
                verticalAlign="top"
                height={36}
              />
              
              {/* Program year milestone lines */}
              {milestones.map((milestone, index) => (
                <ReferenceLine
                  key={index}
                  x={milestone.date}
                  stroke="#9333ea"
                  strokeDasharray="5 5"
                  label={{
                    value: milestone.label,
                    position: 'top',
                    fill: '#9333ea',
                    fontSize: 10,
                  }}
                />
              ))}

              {/* Main membership line */}
              <Line
                type="monotone"
                dataKey="count"
                stroke="#3b82f6"
                strokeWidth={3}
                dot={{ fill: '#3b82f6', r: 4 }}
                activeDot={{ r: 6 }}
                name="Total Membership"
              />

              {/* Highlight growth periods */}
              {periods.map((period, index) => {
                if (period.type === 'growth') {
                  const startDate = sortedData[period.start].date;
                  const endDate = sortedData[period.end].date;
                  return (
                    <React.Fragment key={`growth-${index}`}>
                      <ReferenceLine
                        x={startDate}
                        stroke="#10b981"
                        strokeWidth={2}
                        strokeOpacity={0.3}
                      />
                      <ReferenceLine
                        x={endDate}
                        stroke="#10b981"
                        strokeWidth={2}
                        strokeOpacity={0.3}
                      />
                    </React.Fragment>
                  );
                }
                return null;
              })}

              {/* Highlight decline periods */}
              {periods.map((period, index) => {
                if (period.type === 'decline') {
                  const startDate = sortedData[period.start].date;
                  const endDate = sortedData[period.end].date;
                  return (
                    <React.Fragment key={`decline-${index}`}>
                      <ReferenceLine
                        x={startDate}
                        stroke="#ef4444"
                        strokeWidth={2}
                        strokeOpacity={0.3}
                      />
                      <ReferenceLine
                        x={endDate}
                        stroke="#ef4444"
                        strokeWidth={2}
                        strokeOpacity={0.3}
                      />
                    </React.Fragment>
                  );
                }
                return null;
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Legend for highlights */}
      {periods.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-purple-600" style={{ borderTop: '2px dashed' }}></div>
            <span>Program Year Start</span>
          </div>
          {periods.some(p => p.type === 'growth') && (
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-green-500"></div>
              <span>Growth Period</span>
            </div>
          )}
          {periods.some(p => p.type === 'decline') && (
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-red-500"></div>
              <span>Decline Period</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
