import React from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { LoadingSkeleton } from './LoadingSkeleton'
import { EmptyState } from './ErrorDisplay'

interface YearOverYearData {
  membershipChange: number
  distinguishedChange: number
  clubHealthChange: number
}

interface YearOverYearComparisonProps {
  yearOverYear?: YearOverYearData
  currentYear: {
    totalMembership: number
    distinguishedClubs: number
    healthyClubs: number
    totalClubs: number
  }
  isLoading?: boolean
}

interface ComparisonDataItem {
  metric: string
  previous: number
  current: number
  change: number
  percentChange: string
}

// Custom tooltip moved outside render
const CustomTooltip = ({
  active,
  payload,
  comparisonData,
}: {
  active?: boolean
  payload?: Array<{ payload: { metric: string } }>
  comparisonData: ComparisonDataItem[]
}) => {
  if (active && payload && payload.length) {
    const data = payload[0]?.payload
    if (!data) return null

    const metric = data.metric
    const comparisonItem = comparisonData.find(d => d.metric === metric)

    if (comparisonItem) {
      return (
        <div className="bg-white border border-gray-300 rounded-lg shadow-lg p-3">
          <p className="text-sm font-medium text-gray-900 mb-2">{metric}</p>
          <div className="space-y-1">
            <p className="text-sm text-gray-600">
              Previous:{' '}
              <span className="font-semibold">
                {comparisonItem.previous.toFixed(
                  metric === 'Club Health %' ? 1 : 0
                )}
              </span>
            </p>
            <p className="text-sm text-gray-600">
              Current:{' '}
              <span className="font-semibold">
                {comparisonItem.current.toFixed(
                  metric === 'Club Health %' ? 1 : 0
                )}
              </span>
            </p>
            <p
              className={`text-sm font-semibold ${
                comparisonItem.change >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {comparisonItem.change >= 0 ? '+' : ''}
              {comparisonItem.change.toFixed(
                metric === 'Club Health %' ? 1 : 0
              )}{' '}
              ({comparisonItem.percentChange}%)
            </p>
          </div>
        </div>
      )
    }
  }
  return null
}

export const YearOverYearComparison: React.FC<YearOverYearComparisonProps> = ({
  yearOverYear,
  currentYear,
  isLoading = false,
}) => {
  if (isLoading) {
    return <LoadingSkeleton variant="chart" />
  }

  if (!yearOverYear) {
    return (
      <EmptyState
        title="No Historical Data"
        message="Year-over-year comparison requires data from previous program years. Continue collecting data to enable this feature."
        icon="data"
      />
    )
  }

  // Calculate previous year values
  const previousYear = {
    totalMembership:
      currentYear.totalMembership - yearOverYear.membershipChange,
    distinguishedClubs:
      currentYear.distinguishedClubs - yearOverYear.distinguishedChange,
    healthyClubsPercent:
      (currentYear.healthyClubs / currentYear.totalClubs) * 100 -
      yearOverYear.clubHealthChange,
  }

  const currentHealthPercent =
    (currentYear.healthyClubs / currentYear.totalClubs) * 100

  // Prepare data for side-by-side comparison
  const comparisonData = [
    {
      metric: 'Total Membership',
      previous: previousYear.totalMembership,
      current: currentYear.totalMembership,
      change: yearOverYear.membershipChange,
      percentChange: (
        (yearOverYear.membershipChange / previousYear.totalMembership) *
        100
      ).toFixed(1),
    },
    {
      metric: 'Distinguished Clubs',
      previous: previousYear.distinguishedClubs,
      current: currentYear.distinguishedClubs,
      change: yearOverYear.distinguishedChange,
      percentChange:
        previousYear.distinguishedClubs > 0
          ? (
              (yearOverYear.distinguishedChange /
                previousYear.distinguishedClubs) *
              100
            ).toFixed(1)
          : 'N/A',
    },
    {
      metric: 'Club Health %',
      previous: previousYear.healthyClubsPercent,
      current: currentHealthPercent,
      change: yearOverYear.clubHealthChange,
      percentChange:
        previousYear.healthyClubsPercent > 0
          ? (
              (yearOverYear.clubHealthChange /
                previousYear.healthyClubsPercent) *
              100
            ).toFixed(1)
          : 'N/A',
    },
  ]

  // Chart data for bar chart
  const chartData = comparisonData.map(item => ({
    metric: item.metric,
    'Previous Year': item.previous,
    'Current Year': item.current,
  }))

  // Determine overall trend
  const improvements = comparisonData.filter(d => d.change > 0).length
  const declines = comparisonData.filter(d => d.change < 0).length
  const overallTrend =
    improvements > declines
      ? 'improving'
      : improvements < declines
        ? 'declining'
        : 'stable'

  const chartDescription = `Bar chart comparing current year metrics to previous year. ${improvements} metric(s) improved, ${declines} metric(s) declined.`

  return (
    <div
      className="bg-white rounded-lg shadow-md p-6"
      aria-label="Year-over-year comparison"
    >
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">
          Year-Over-Year Comparison
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Compare current performance to the same time last program year
        </p>
      </div>

      {/* Overall Trend Indicator */}
      <div
        className={`mb-6 p-4 rounded-lg border-2 ${
          overallTrend === 'improving'
            ? 'bg-green-50 border-green-300'
            : overallTrend === 'declining'
              ? 'bg-red-50 border-red-300'
              : 'bg-gray-50 border-gray-300'
        }`}
      >
        <div className="flex items-center gap-3">
          {overallTrend === 'improving' && (
            <>
              <div className="bg-green-500 rounded-full p-2">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                  />
                </svg>
              </div>
              <div>
                <p className="text-lg font-semibold text-green-900">
                  Overall Improvement
                </p>
                <p className="text-sm text-green-700">
                  {improvements} of {comparisonData.length} metrics showing
                  positive growth
                </p>
              </div>
            </>
          )}
          {overallTrend === 'declining' && (
            <>
              <div className="bg-red-500 rounded-full p-2">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"
                  />
                </svg>
              </div>
              <div>
                <p className="text-lg font-semibold text-red-900">
                  Overall Decline
                </p>
                <p className="text-sm text-red-700">
                  {declines} of {comparisonData.length} metrics showing negative
                  trends
                </p>
              </div>
            </>
          )}
          {overallTrend === 'stable' && (
            <>
              <div className="bg-gray-500 rounded-full p-2">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 12h14"
                  />
                </svg>
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-900">
                  Stable Performance
                </p>
                <p className="text-sm text-gray-700">
                  Mixed results across metrics
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Side-by-Side Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {comparisonData.map((item, index) => {
          const isImprovement = item.change > 0
          const isDecline = item.change < 0

          return (
            <div
              key={index}
              className={`rounded-lg p-4 border-2 ${
                isImprovement
                  ? 'bg-green-50 border-green-200'
                  : isDecline
                    ? 'bg-red-50 border-red-200'
                    : 'bg-gray-50 border-gray-200'
              }`}
            >
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                {item.metric}
              </h3>

              <div className="space-y-2">
                {/* Previous Year */}
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-600">Previous Year:</span>
                  <span className="text-lg font-bold text-gray-700">
                    {item.metric === 'Club Health %'
                      ? `${item.previous.toFixed(1)}%`
                      : item.previous.toLocaleString()}
                  </span>
                </div>

                {/* Current Year */}
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-600">Current Year:</span>
                  <span className="text-lg font-bold text-gray-900">
                    {item.metric === 'Club Health %'
                      ? `${item.current.toFixed(1)}%`
                      : item.current.toLocaleString()}
                  </span>
                </div>

                {/* Change */}
                <div className="pt-2 border-t border-gray-300">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-gray-700">
                      Change:
                    </span>
                    <div className="flex items-center gap-2">
                      {isImprovement && (
                        <svg
                          className="w-4 h-4 text-green-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 10l7-7m0 0l7 7m-7-7v18"
                          />
                        </svg>
                      )}
                      {isDecline && (
                        <svg
                          className="w-4 h-4 text-red-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 14l-7 7m0 0l-7-7m7 7V3"
                          />
                        </svg>
                      )}
                      <span
                        className={`text-sm font-bold ${
                          isImprovement
                            ? 'text-green-600'
                            : isDecline
                              ? 'text-red-600'
                              : 'text-gray-600'
                        }`}
                      >
                        {item.change >= 0 ? '+' : ''}
                        {item.metric === 'Club Health %'
                          ? item.change.toFixed(1)
                          : item.change}
                      </span>
                    </div>
                  </div>
                  <div className="text-right mt-1">
                    <span
                      className={`text-xs font-semibold ${
                        isImprovement
                          ? 'text-green-600'
                          : isDecline
                            ? 'text-red-600'
                            : 'text-gray-600'
                      }`}
                    >
                      ({item.percentChange}%)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Bar Chart Visualization */}
      <div
        role="img"
        aria-label={chartDescription}
        className="w-full overflow-x-auto"
      >
        <div className="min-w-[320px]">
          <ResponsiveContainer width="100%" height={350}>
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--tm-cool-gray-20)"
              />
              <XAxis
                dataKey="metric"
                stroke="var(--tm-cool-gray)"
                style={{ fontSize: '11px' }}
                angle={-15}
                textAnchor="end"
                height={80}
              />
              <YAxis
                stroke="var(--tm-cool-gray)"
                style={{ fontSize: '11px' }}
                label={{
                  value: 'Value',
                  angle: -90,
                  position: 'insideLeft',
                  style: { fontSize: '12px' },
                }}
              />
              <Tooltip
                content={<CustomTooltip comparisonData={comparisonData} />}
              />
              <Legend
                wrapperStyle={{ fontSize: '12px' }}
                verticalAlign="top"
                height={36}
              />
              <Bar
                dataKey="Previous Year"
                fill="var(--tm-cool-gray)" // TM Cool Gray
                radius={[8, 8, 0, 0]}
              />
              <Bar
                dataKey="Current Year"
                fill="var(--tm-loyal-blue)" // TM Loyal Blue
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Key Insights */}
      <div className="mt-6 p-4 bg-tm-loyal-blue-10 border border-tm-loyal-blue-20 rounded-lg">
        <h3 className="text-sm font-semibold text-tm-loyal-blue mb-2 font-tm-headline">
          📊 Key Insights
        </h3>
        <ul className="space-y-1 text-sm text-tm-loyal-blue-80 font-tm-body">
          {comparisonData.map((item, index) => {
            if (Math.abs(parseFloat(item.percentChange as string)) >= 5) {
              const isSignificant =
                Math.abs(parseFloat(item.percentChange as string)) >= 10
              return (
                <li key={index}>
                  • {item.metric} {item.change > 0 ? 'increased' : 'decreased'}{' '}
                  by{' '}
                  <span className="font-semibold">
                    {Math.abs(parseFloat(item.percentChange as string))}%
                  </span>
                  {isSignificant && ' (significant change)'}
                </li>
              )
            }
            return null
          })}
          {comparisonData.every(
            item => Math.abs(parseFloat(item.percentChange as string)) < 5
          ) && (
            <li>
              • All metrics showing relatively stable performance year-over-year
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}
