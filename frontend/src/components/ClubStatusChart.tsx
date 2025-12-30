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

    return [
      {
        name: 'Active',
        count: distribution.active || 0,
        color: '#10b981', // green
      },
      {
        name: 'Low',
        count: distribution.low || 0,
        color: '#f59e0b', // amber
      },
      {
        name: 'Suspended',
        count: distribution.suspended || 0,
        color: '#ef4444', // red
      },
      {
        name: 'Ineligible',
        count: distribution.ineligible || 0,
        color: '#6b7280', // gray
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
          acc.regular = (acc.regular || 0) + 1
        }
        return acc
      },
      {} as Record<string, number>
    )

    return [
      {
        name: 'Regular',
        count: distribution.regular || 0,
        color: '#9ca3af',
      },
      {
        name: 'Select',
        count: distribution.select || 0,
        color: '#fbbf24',
      },
      {
        name: 'Distinguished',
        count: distribution.distinguished || 0,
        color: '#004165', // TM Loyal Blue
      },
      {
        name: "President's",
        count: distribution.president || 0,
        color: '#772432', // TM True Maroon
      },
    ].filter(item => item.count > 0)
  }, [clubs])

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4 font-tm-headline">
        Club Status Distribution
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution Chart */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3 font-tm-body">
            By Status
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={statusData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12 }}
                aria-label="Club Status"
              />
              <YAxis
                tick={{ fontSize: 12 }}
                allowDecimals={false}
                aria-label="Number of Clubs"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.375rem',
                }}
              />
              <Bar dataKey="count" name="Clubs" radius={[8, 8, 0, 0]}>
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Distinguished Distribution Chart */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3 font-tm-body">
            By Distinguished Status
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={distinguishedData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12 }}
                aria-label="Distinguished Level"
              />
              <YAxis
                tick={{ fontSize: 12 }}
                allowDecimals={false}
                aria-label="Number of Clubs"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.375rem',
                }}
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

      {/* Summary Statistics */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {statusData.find(s => s.name === 'Active')?.count || 0}
            </div>
            <div className="text-sm text-gray-600 font-tm-body">Active</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-amber-600">
              {statusData.find(s => s.name === 'Low')?.count || 0}
            </div>
            <div className="text-sm text-gray-600 font-tm-body">Low</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">
              {statusData.find(s => s.name === 'Suspended')?.count || 0}
            </div>
            <div className="text-sm text-gray-600 font-tm-body">Suspended</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-600">
              {statusData.find(s => s.name === 'Ineligible')?.count || 0}
            </div>
            <div className="text-sm text-gray-600 font-tm-body">Ineligible</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-tm-loyal-blue">
              {clubs.filter(c => c.distinguished).length}
            </div>
            <div className="text-sm text-gray-600 font-tm-body">
              Distinguished
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-tm-true-maroon">
              {clubs.filter(c => c.distinguishedLevel === 'president').length}
            </div>
            <div className="text-sm text-gray-600 font-tm-body">
              President's
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ClubStatusChart
