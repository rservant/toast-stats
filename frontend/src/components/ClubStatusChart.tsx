import React from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import type { Club } from '../types/districts'
import { ChartContainer } from './ChartLegend'
import { ChartTooltip } from './ChartTooltip'
import {
  getChartColorPalette,
  generateChartDescription,
  CHART_STYLES,
} from '../utils/chartAccessibility'

export interface ClubStatusChartProps {
  clubs: Club[]
  isLoading?: boolean
}

const ClubStatusChart: React.FC<ClubStatusChartProps> = ({
  clubs,
  isLoading = false,
}) => {
  // Calculate status distribution
  const statusData = React.useMemo(() => {
    const distribution = clubs.reduce(
      (acc, club) => {
        acc[club.status] = (acc[club.status] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    const colors = getChartColorPalette(4)
    const fallback = '#888888'
    return [
      {
        name: 'Active',
        count: distribution['active'] || 0,
        color: colors[0] ?? fallback, // TM Loyal Blue for active status
      },
      {
        name: 'Low',
        count: distribution['low'] || 0,
        color: colors[3] ?? fallback, // TM Happy Yellow for warning status
      },
      {
        name: 'Suspended',
        count: distribution['suspended'] || 0,
        color: colors[1] ?? fallback, // TM True Maroon for error status
      },
      {
        name: 'Ineligible',
        count: distribution['ineligible'] || 0,
        color: colors[2] ?? fallback, // TM Cool Gray for neutral status
      },
    ].filter(item => item.count > 0) // Only show statuses that exist
  }, [clubs])

  // Calculate distinguished distribution
  const distinguishedData = React.useMemo(() => {
    const distribution = clubs.reduce(
      (acc, club) => {
        if (club.distinguished) {
          const level = club.distinguishedLevel || 'distinguished'
          acc[level] = (acc[level] || 0) + 1
        } else {
          acc['regular'] = (acc['regular'] || 0) + 1
        }
        return acc
      },
      {} as Record<string, number>
    )

    const colors = getChartColorPalette(4)
    const fallback = '#888888'
    return [
      {
        name: 'Regular',
        count: distribution['regular'] || 0,
        color: colors[2] ?? fallback, // TM Cool Gray for regular status
      },
      {
        name: 'Select',
        count: distribution['select'] || 0,
        color: colors[3] ?? fallback, // TM Happy Yellow for select status
      },
      {
        name: 'Distinguished',
        count: distribution['distinguished'] || 0,
        color: colors[0] ?? fallback, // TM Loyal Blue - already compliant
      },
      {
        name: "President's",
        count: distribution['president'] || 0,
        color: colors[1] ?? fallback, // TM True Maroon - already compliant
      },
    ].filter(item => item.count > 0)
  }, [clubs])

  // Generate chart descriptions for accessibility
  const statusChartDescription = generateChartDescription(
    'bar',
    statusData.length,
    'Club Status Distribution',
    `Shows distribution of ${clubs.length} clubs across different status categories`
  )

  const distinguishedChartDescription = generateChartDescription(
    'bar',
    distinguishedData.length,
    'Distinguished Status Distribution',
    `Shows distribution of ${clubs.length} clubs by distinguished achievement level`
  )

  return (
    <ChartContainer
      title="Club Status Distribution"
      subtitle={`Analysis of ${clubs.length} clubs by status and distinguished achievement`}
      isLoading={isLoading}
      className="tm-brand-compliant"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution Chart */}
        <div>
          <h3 className="text-sm font-tm-headline font-semibold text-tm-black mb-3">
            By Status
          </h3>
          <div
            role="img"
            aria-label={statusChartDescription}
            className="w-full"
          >
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={statusData} aria-hidden="true">
                <CartesianGrid
                  strokeDasharray={CHART_STYLES.GRID.strokeDasharray}
                  stroke={CHART_STYLES.GRID.stroke}
                />
                <XAxis
                  dataKey="name"
                  tick={{
                    fontSize: parseInt(CHART_STYLES.AXIS.fontSize),
                    fontFamily: CHART_STYLES.AXIS.fontFamily,
                  }}
                  stroke={CHART_STYLES.AXIS.stroke}
                  aria-label="Club Status"
                />
                <YAxis
                  tick={{
                    fontSize: parseInt(CHART_STYLES.AXIS.fontSize),
                    fontFamily: CHART_STYLES.AXIS.fontFamily,
                  }}
                  stroke={CHART_STYLES.AXIS.stroke}
                  allowDecimals={false}
                  aria-label="Number of Clubs"
                />
                <Tooltip
                  content={<ChartTooltip />}
                  contentStyle={CHART_STYLES.TOOLTIP}
                />
                <Bar dataKey="count" name="Clubs" radius={[8, 8, 0, 0]}>
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Distinguished Distribution Chart */}
        <div>
          <h3 className="text-sm font-tm-headline font-semibold text-tm-black mb-3">
            By Distinguished Status
          </h3>
          <div
            role="img"
            aria-label={distinguishedChartDescription}
            className="w-full"
          >
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={distinguishedData} aria-hidden="true">
                <CartesianGrid
                  strokeDasharray={CHART_STYLES.GRID.strokeDasharray}
                  stroke={CHART_STYLES.GRID.stroke}
                />
                <XAxis
                  dataKey="name"
                  tick={{
                    fontSize: parseInt(CHART_STYLES.AXIS.fontSize),
                    fontFamily: CHART_STYLES.AXIS.fontFamily,
                  }}
                  stroke={CHART_STYLES.AXIS.stroke}
                  aria-label="Distinguished Level"
                />
                <YAxis
                  tick={{
                    fontSize: parseInt(CHART_STYLES.AXIS.fontSize),
                    fontFamily: CHART_STYLES.AXIS.fontFamily,
                  }}
                  stroke={CHART_STYLES.AXIS.stroke}
                  allowDecimals={false}
                  aria-label="Number of Clubs"
                />
                <Tooltip
                  content={<ChartTooltip />}
                  contentStyle={CHART_STYLES.TOOLTIP}
                />
                <Bar dataKey="count" name="Clubs" radius={[8, 8, 0, 0]}>
                  {distinguishedData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="mt-6 pt-6 border-t border-tm-cool-gray-20">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="text-center">
            <div className="text-2xl font-tm-headline font-bold text-tm-loyal-blue">
              {statusData.find(s => s.name === 'Active')?.count || 0}
            </div>
            <div className="text-sm text-tm-cool-gray font-tm-body">Active</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-tm-headline font-bold text-tm-happy-yellow">
              {statusData.find(s => s.name === 'Low')?.count || 0}
            </div>
            <div className="text-sm text-tm-cool-gray font-tm-body">Low</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-tm-headline font-bold text-tm-true-maroon">
              {statusData.find(s => s.name === 'Suspended')?.count || 0}
            </div>
            <div className="text-sm text-tm-cool-gray font-tm-body">
              Suspended
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-tm-headline font-bold text-tm-cool-gray">
              {statusData.find(s => s.name === 'Ineligible')?.count || 0}
            </div>
            <div className="text-sm text-tm-cool-gray font-tm-body">
              Ineligible
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-tm-headline font-bold text-tm-loyal-blue">
              {clubs.filter(c => c.distinguished).length}
            </div>
            <div className="text-sm text-tm-cool-gray font-tm-body">
              Distinguished
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-tm-headline font-bold text-tm-true-maroon">
              {clubs.filter(c => c.distinguishedLevel === 'president').length}
            </div>
            <div className="text-sm text-tm-cool-gray font-tm-body">
              President's
            </div>
          </div>
        </div>
      </div>
    </ChartContainer>
  )
}

export default ClubStatusChart
