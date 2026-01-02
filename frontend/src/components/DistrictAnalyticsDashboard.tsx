/**
 * District Analytics Dashboard Component
 *
 * Displays comprehensive analytics for district club health including:
 * - Health status distribution across district clubs
 * - Trajectory analytics with counts and percentages
 * - Month-over-month trend calculations and charts
 * - Pattern identification for clubs needing attention
 * - Drill-down capabilities and export functionality
 */

import React, { useState, useMemo } from 'react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  ClubHealthResult,
  DistrictHealthSummary,
  HealthStatus,
  Trajectory,
  HEALTH_STATUS_ORDER,
  TRAJECTORY_ORDER,
  HEALTH_STATUS_COLORS,
  TRAJECTORY_COLORS,
} from '../types/clubHealth'
import { ChartTooltip, MembershipTooltip } from './ChartTooltip'
import {
  BRAND_COLORS,
  TOUCH_TARGET_REQUIREMENTS,
} from '../utils/brandConstants'
import {
  getChartColorPalette,
  generateChartDescription,
  CHART_STYLES,
} from '../utils/chartAccessibility'

export interface DistrictAnalyticsDashboardProps {
  districtId: string
  clubs: ClubHealthResult[]
  districtSummary?: DistrictHealthSummary
  onClubSelect?: (club: ClubHealthResult) => void
  onExportData?: (format: 'csv' | 'pdf' | 'json', data?: unknown) => void
  onNavigateToClub?: (clubName: string) => void
  loading?: boolean
  error?: string
}

interface TrendData {
  month: string
  thriving: number
  vulnerable: number
  intervention_required: number
  total: number
}

interface PatternAlert {
  type: 'consistent_intervention' | 'consistent_vulnerable' | 'declining_trend'
  clubs: ClubHealthResult[]
  severity: 'high' | 'medium' | 'low'
  description: string
}

export const DistrictAnalyticsDashboard: React.FC<
  DistrictAnalyticsDashboardProps
> = ({
  districtId,
  clubs,
  onClubSelect,
  onExportData,
  onNavigateToClub,
  loading = false,
  error,
}) => {
  const [selectedView, setSelectedView] = useState<
    'overview' | 'trends' | 'patterns'
  >('overview')
  const [selectedHealthStatus, setSelectedHealthStatus] =
    useState<HealthStatus | null>(null)
  const [selectedTrajectory, setSelectedTrajectory] =
    useState<Trajectory | null>(null)
  const [drillDownData, setDrillDownData] = useState<{
    type: 'health' | 'trajectory' | 'pattern'
    data: unknown
    clubs: ClubHealthResult[]
  } | null>(null)

  // Calculate health status distribution
  const healthDistribution = useMemo(() => {
    const distribution = clubs.reduce(
      (acc, club) => {
        acc[club.health_status] = (acc[club.health_status] || 0) + 1
        return acc
      },
      {} as Record<HealthStatus, number>
    )

    const total = clubs.length
    const colors = getChartColorPalette(HEALTH_STATUS_ORDER.length)

    return HEALTH_STATUS_ORDER.map((status, index) => ({
      name: status,
      count: distribution[status] || 0,
      percentage: total > 0 ? ((distribution[status] || 0) / total) * 100 : 0,
      color: HEALTH_STATUS_COLORS[status],
      brandColor: colors[index],
    }))
  }, [clubs])

  // Calculate trajectory distribution
  const trajectoryDistribution = useMemo(() => {
    const distribution = clubs.reduce(
      (acc, club) => {
        acc[club.trajectory] = (acc[club.trajectory] || 0) + 1
        return acc
      },
      {} as Record<Trajectory, number>
    )

    const total = clubs.length
    const colors = getChartColorPalette(TRAJECTORY_ORDER.length)

    return TRAJECTORY_ORDER.map((trajectory, index) => ({
      name: trajectory,
      count: distribution[trajectory] || 0,
      percentage:
        total > 0 ? ((distribution[trajectory] || 0) / total) * 100 : 0,
      color: TRAJECTORY_COLORS[trajectory],
      brandColor: colors[index],
    }))
  }, [clubs])

  // Generate mock trend data (in real implementation, this would come from historical data)
  const trendData = useMemo((): TrendData[] => {
    // Mock data for demonstration - in real implementation, fetch from API
    const months = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return months.map((month, index) => {
      const variation = Math.sin(index * 0.5) * 0.1 + 1 // Simulate seasonal variation

      const thriving = Math.round(
        (healthDistribution.find(h => h.name === 'Thriving')?.count || 0) *
          variation
      )
      const vulnerable = Math.round(
        (healthDistribution.find(h => h.name === 'Vulnerable')?.count || 0) *
          variation
      )
      const intervention = Math.round(
        (healthDistribution.find(h => h.name === 'Intervention Required')
          ?.count || 0) * variation
      )

      return {
        month,
        thriving,
        vulnerable,
        intervention_required: intervention,
        total: thriving + vulnerable + intervention,
      }
    })
  }, [healthDistribution])

  // Identify patterns and alerts
  const patternAlerts = useMemo((): PatternAlert[] => {
    const alerts: PatternAlert[] = []

    // Clubs consistently in intervention status
    const interventionClubs = clubs.filter(
      club => club.health_status === 'Intervention Required'
    )
    if (interventionClubs.length > 0) {
      alerts.push({
        type: 'consistent_intervention',
        clubs: interventionClubs,
        severity:
          interventionClubs.length > clubs.length * 0.2 ? 'high' : 'medium',
        description: `${interventionClubs.length} clubs require immediate intervention`,
      })
    }

    // Clubs consistently vulnerable
    const vulnerableClubs = clubs.filter(
      club => club.health_status === 'Vulnerable'
    )
    if (vulnerableClubs.length > clubs.length * 0.3) {
      alerts.push({
        type: 'consistent_vulnerable',
        clubs: vulnerableClubs,
        severity: 'medium',
        description: `${vulnerableClubs.length} clubs are in vulnerable status`,
      })
    }

    // Clubs with declining trajectory
    const decliningClubs = clubs.filter(club => club.trajectory === 'Declining')
    if (decliningClubs.length > 0) {
      alerts.push({
        type: 'declining_trend',
        clubs: decliningClubs,
        severity: decliningClubs.length > clubs.length * 0.25 ? 'high' : 'low',
        description: `${decliningClubs.length} clubs showing declining trends`,
      })
    }

    return alerts.sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, low: 1 }
      return severityOrder[b.severity] - severityOrder[a.severity]
    })
  }, [clubs])

  // Filter clubs based on selected criteria
  const filteredClubs = useMemo(() => {
    return clubs.filter(club => {
      if (selectedHealthStatus && club.health_status !== selectedHealthStatus)
        return false
      if (selectedTrajectory && club.trajectory !== selectedTrajectory)
        return false
      return true
    })
  }, [clubs, selectedHealthStatus, selectedTrajectory])

  const handleHealthStatusClick = (status: HealthStatus) => {
    setSelectedHealthStatus(selectedHealthStatus === status ? null : status)
    setSelectedTrajectory(null)

    // Set drill-down data for detailed analysis
    const statusClubs = clubs.filter(club => club.health_status === status)
    setDrillDownData({
      type: 'health',
      data: {
        status,
        count: statusClubs.length,
        percentage: ((statusClubs.length / clubs.length) * 100).toFixed(1),
      },
      clubs: statusClubs,
    })
  }

  const handleTrajectoryClick = (trajectory: Trajectory) => {
    setSelectedTrajectory(selectedTrajectory === trajectory ? null : trajectory)
    setSelectedHealthStatus(null)

    // Set drill-down data for detailed analysis
    const trajectoryClubs = clubs.filter(club => club.trajectory === trajectory)
    setDrillDownData({
      type: 'trajectory',
      data: {
        trajectory,
        count: trajectoryClubs.length,
        percentage: ((trajectoryClubs.length / clubs.length) * 100).toFixed(1),
      },
      clubs: trajectoryClubs,
    })
  }

  const handleClubClick = (club: ClubHealthResult) => {
    if (onClubSelect) {
      onClubSelect(club)
    }
  }

  const handleNavigateToClub = (clubName: string) => {
    if (onNavigateToClub) {
      onNavigateToClub(clubName)
    }
  }

  // Enhanced export functionality with different data formats
  const generateExportData = (format: 'csv' | 'pdf' | 'json') => {
    const baseData = {
      districtId,
      generatedAt: new Date().toISOString(),
      totalClubs: clubs.length,
      healthDistribution: healthDistribution.reduce(
        (acc, item) => {
          acc[item.name] = { count: item.count, percentage: item.percentage }
          return acc
        },
        {} as Record<string, { count: number; percentage: number }>
      ),
      trajectoryDistribution: trajectoryDistribution.reduce(
        (acc, item) => {
          acc[item.name] = { count: item.count, percentage: item.percentage }
          return acc
        },
        {} as Record<string, { count: number; percentage: number }>
      ),
      patternAlerts: patternAlerts.map(alert => ({
        type: alert.type,
        severity: alert.severity,
        description: alert.description,
        clubCount: alert.clubs.length,
        clubNames: alert.clubs.map(c => c.club_name),
      })),
      clubs: clubs.map(club => ({
        name: club.club_name,
        healthStatus: club.health_status,
        trajectory: club.trajectory,
        membersDelta: club.members_delta_mom,
        dcpDelta: club.dcp_delta_mom,
        reasons: club.reasons,
        trajectoryReasons: club.trajectory_reasons,
      })),
    }

    switch (format) {
      case 'csv':
        return {
          summary: convertToCSV([
            ['Metric', 'Value'],
            ['District ID', districtId],
            ['Total Clubs', clubs.length.toString()],
            ['Generated At', new Date().toLocaleString()],
            ...healthDistribution.map(h => [
              `${h.name} Clubs`,
              `${h.count} (${h.percentage.toFixed(1)}%)`,
            ]),
            ...trajectoryDistribution.map(t => [
              `${t.name} Trajectory`,
              `${t.count} (${t.percentage.toFixed(1)}%)`,
            ]),
          ]),
          clubs: convertToCSV([
            [
              'Club Name',
              'Health Status',
              'Trajectory',
              'Members Delta MoM',
              'DCP Delta MoM',
              'Primary Reason',
            ],
            ...clubs.map(club => [
              club.club_name,
              club.health_status,
              club.trajectory,
              club.members_delta_mom.toString(),
              club.dcp_delta_mom.toString(),
              club.reasons[0] || 'N/A',
            ]),
          ]),
        }
      case 'json':
        return baseData
      case 'pdf':
        return baseData // Will be processed by PDF generator
      default:
        return baseData
    }
  }

  const convertToCSV = (data: string[][]) => {
    return data
      .map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\n')
  }

  const handleExport = (format: 'csv' | 'pdf' | 'json') => {
    const exportData = generateExportData(format)

    if (format === 'csv') {
      // Create and download CSV files
      const csvData = exportData as { summary: string; clubs: string }
      const summaryBlob = new Blob([csvData.summary], { type: 'text/csv' })
      const clubsBlob = new Blob([csvData.clubs], { type: 'text/csv' })

      // Download summary CSV
      const summaryUrl = window.URL.createObjectURL(summaryBlob)
      const summaryLink = document.createElement('a')
      summaryLink.href = summaryUrl
      summaryLink.download = `district_${districtId}_analytics_summary.csv`
      document.body.appendChild(summaryLink)
      summaryLink.click()
      document.body.removeChild(summaryLink)
      window.URL.revokeObjectURL(summaryUrl)

      // Download clubs CSV
      setTimeout(() => {
        const clubsUrl = window.URL.createObjectURL(clubsBlob)
        const clubsLink = document.createElement('a')
        clubsLink.href = clubsUrl
        clubsLink.download = `district_${districtId}_clubs_detail.csv`
        document.body.appendChild(clubsLink)
        clubsLink.click()
        document.body.removeChild(clubsLink)
        window.URL.revokeObjectURL(clubsUrl)
      }, 100)
    } else if (format === 'json') {
      // Download JSON file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `district_${districtId}_analytics.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    }

    if (onExportData) {
      onExportData(format, exportData)
    }
  }

  const handlePatternDrillDown = (alert: PatternAlert) => {
    setDrillDownData({
      type: 'pattern',
      data: alert,
      clubs: alert.clubs,
    })
  }

  const getSeverityColor = (severity: PatternAlert['severity']) => {
    switch (severity) {
      case 'high':
        return BRAND_COLORS.trueMaroon
      case 'medium':
        return BRAND_COLORS.happyYellow
      case 'low':
        return BRAND_COLORS.coolGray
      default:
        return BRAND_COLORS.coolGray
    }
  }

  if (loading) {
    return (
      <div
        className="flex items-center justify-center h-96"
        role="status"
        aria-label="Loading district analytics"
      >
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tm-loyal-blue"></div>
        <span className="sr-only">Loading district analytics...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div
        className="bg-red-50 border border-red-200 rounded-md p-4"
        role="alert"
      >
        <h3 className="text-red-800 font-semibold">
          Error Loading District Analytics
        </h3>
        <p className="text-red-600 mt-1">{error}</p>
      </div>
    )
  }

  return (
    <div className="district-analytics-dashboard space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-tm-black font-tm-headline">
            District {districtId} Analytics
          </h2>
          <p className="text-tm-cool-gray font-tm-body">
            {clubs.length} clubs • Health status and trajectory analysis
          </p>
        </div>

        {/* Export Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-tm-cool-gray bg-opacity-10 rounded-lg p-1">
            <button
              onClick={() => handleExport('csv')}
              className="flex items-center gap-2 px-3 py-2 bg-tm-loyal-blue text-tm-white rounded-md hover:opacity-90 transition-opacity font-tm-body text-sm"
              style={{ minHeight: TOUCH_TARGET_REQUIREMENTS.minHeight }}
              title="Export as CSV files (summary + detailed club data)"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 17v-2m3 2v-4m3 4v-6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              CSV
            </button>
            <button
              onClick={() => handleExport('json')}
              className="flex items-center gap-2 px-3 py-2 bg-tm-cool-gray text-tm-black rounded-md hover:opacity-90 transition-opacity font-tm-body text-sm"
              style={{ minHeight: TOUCH_TARGET_REQUIREMENTS.minHeight }}
              title="Export as JSON data file"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              JSON
            </button>
            <button
              onClick={() => handleExport('pdf')}
              className="flex items-center gap-2 px-3 py-2 bg-tm-true-maroon text-tm-white rounded-md hover:opacity-90 transition-opacity font-tm-body text-sm"
              style={{ minHeight: TOUCH_TARGET_REQUIREMENTS.minHeight }}
              title="Export as PDF report"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
              PDF
            </button>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSelectedView('patterns')}
              className="flex items-center gap-2 px-3 py-2 bg-tm-happy-yellow bg-opacity-20 text-tm-black rounded-md hover:bg-opacity-30 transition-colors font-tm-body text-sm"
              style={{ minHeight: TOUCH_TARGET_REQUIREMENTS.minHeight }}
              title="Jump to pattern analysis"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Alerts
              {patternAlerts.length > 0 && (
                <span className="bg-tm-true-maroon text-tm-white text-xs px-2 py-1 rounded-full">
                  {patternAlerts.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* View Selector */}
      <div className="flex border-b border-tm-cool-gray">
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'trends', label: 'Trends' },
          { key: 'patterns', label: 'Patterns' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setSelectedView(key as typeof selectedView)}
            className={`px-4 py-2 font-tm-body font-medium border-b-2 transition-colors ${
              selectedView === key
                ? 'border-tm-loyal-blue text-tm-loyal-blue'
                : 'border-transparent text-tm-cool-gray hover:text-tm-black'
            }`}
            style={{ minHeight: TOUCH_TARGET_REQUIREMENTS.minHeight }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {selectedView === 'overview' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-tm-white border border-tm-cool-gray rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-tm-cool-gray font-tm-body">
                    Total Clubs
                  </p>
                  <p className="text-2xl font-bold text-tm-black font-tm-headline">
                    {clubs.length}
                  </p>
                </div>
                <div className="w-8 h-8 bg-tm-loyal-blue bg-opacity-10 rounded-full flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-tm-loyal-blue"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-tm-white border border-tm-cool-gray rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-tm-cool-gray font-tm-body">
                    Thriving
                  </p>
                  <p className="text-2xl font-bold text-tm-loyal-blue font-tm-headline">
                    {healthDistribution.find(h => h.name === 'Thriving')
                      ?.count || 0}
                  </p>
                </div>
                <div className="w-8 h-8 bg-tm-loyal-blue bg-opacity-10 rounded-full flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-tm-loyal-blue"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-tm-white border border-tm-cool-gray rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-tm-cool-gray font-tm-body">
                    Vulnerable
                  </p>
                  <p className="text-2xl font-bold text-tm-true-maroon font-tm-headline">
                    {healthDistribution.find(h => h.name === 'Vulnerable')
                      ?.count || 0}
                  </p>
                </div>
                <div className="w-8 h-8 bg-tm-true-maroon bg-opacity-10 rounded-full flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-tm-true-maroon"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-tm-white border border-tm-cool-gray rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-tm-cool-gray font-tm-body">
                    Intervention
                  </p>
                  <p className="text-2xl font-bold text-tm-true-maroon font-tm-headline">
                    {healthDistribution.find(
                      h => h.name === 'Intervention Required'
                    )?.count || 0}
                  </p>
                </div>
                <div className="w-8 h-8 bg-tm-true-maroon bg-opacity-10 rounded-full flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-tm-true-maroon"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Distribution Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Health Status Distribution */}
            <div className="bg-tm-white border border-tm-cool-gray rounded-lg p-6">
              <h3 className="text-lg font-semibold text-tm-black mb-4 font-tm-headline">
                Health Status Distribution
              </h3>
              <div
                role="img"
                aria-label={generateChartDescription(
                  'pie',
                  healthDistribution.length,
                  'Health Status Distribution',
                  `Shows distribution of ${clubs.length} clubs by health status`
                )}
                className="w-full"
              >
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={healthDistribution}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="count"
                      nameKey="name"
                      label={({ name, percentage }) =>
                        `${name}: ${percentage.toFixed(1)}%`
                      }
                    >
                      {healthDistribution.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color}
                          onClick={() => handleHealthStatusClick(entry.name)}
                          style={{ cursor: 'pointer' }}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Trajectory Distribution */}
            <div className="bg-tm-white border border-tm-cool-gray rounded-lg p-6">
              <h3 className="text-lg font-semibold text-tm-black mb-4 font-tm-headline">
                Trajectory Distribution
              </h3>
              <div
                role="img"
                aria-label={generateChartDescription(
                  'bar',
                  trajectoryDistribution.length,
                  'Trajectory Distribution',
                  `Shows distribution of ${clubs.length} clubs by trajectory`
                )}
                className="w-full"
              >
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={trajectoryDistribution}>
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
                    />
                    <YAxis
                      tick={{
                        fontSize: parseInt(CHART_STYLES.AXIS.fontSize),
                        fontFamily: CHART_STYLES.AXIS.fontFamily,
                      }}
                      stroke={CHART_STYLES.AXIS.stroke}
                      allowDecimals={false}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar
                      dataKey="count"
                      name="Clubs"
                      radius={[4, 4, 0, 0]}
                      onClick={data => handleTrajectoryClick(data.name)}
                      style={{ cursor: 'pointer' }}
                    >
                      {trajectoryDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trends Tab */}
      {selectedView === 'trends' && (
        <div className="space-y-6">
          <div className="bg-tm-white border border-tm-cool-gray rounded-lg p-6">
            <h3 className="text-lg font-semibold text-tm-black mb-4 font-tm-headline">
              Month-over-Month Health Trends
            </h3>
            <div
              role="img"
              aria-label={generateChartDescription(
                'line',
                trendData.length,
                'Health Status Trends',
                'Shows health status changes over the past 6 months'
              )}
              className="w-full"
            >
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={trendData}>
                  <CartesianGrid
                    strokeDasharray={CHART_STYLES.GRID.strokeDasharray}
                    stroke={CHART_STYLES.GRID.stroke}
                  />
                  <XAxis
                    dataKey="month"
                    tick={{
                      fontSize: parseInt(CHART_STYLES.AXIS.fontSize),
                      fontFamily: CHART_STYLES.AXIS.fontFamily,
                    }}
                    stroke={CHART_STYLES.AXIS.stroke}
                  />
                  <YAxis
                    tick={{
                      fontSize: parseInt(CHART_STYLES.AXIS.fontSize),
                      fontFamily: CHART_STYLES.AXIS.fontFamily,
                    }}
                    stroke={CHART_STYLES.AXIS.stroke}
                    allowDecimals={false}
                  />
                  <Tooltip content={<MembershipTooltip />} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="thriving"
                    stroke={HEALTH_STATUS_COLORS['Thriving']}
                    strokeWidth={2}
                    dot={{
                      fill: HEALTH_STATUS_COLORS['Thriving'],
                      strokeWidth: 2,
                      r: 4,
                    }}
                    name="Thriving"
                  />
                  <Line
                    type="monotone"
                    dataKey="vulnerable"
                    stroke={HEALTH_STATUS_COLORS['Vulnerable']}
                    strokeWidth={2}
                    dot={{
                      fill: HEALTH_STATUS_COLORS['Vulnerable'],
                      strokeWidth: 2,
                      r: 4,
                    }}
                    name="Vulnerable"
                  />
                  <Line
                    type="monotone"
                    dataKey="intervention_required"
                    stroke={HEALTH_STATUS_COLORS['Intervention Required']}
                    strokeWidth={2}
                    dot={{
                      fill: HEALTH_STATUS_COLORS['Intervention Required'],
                      strokeWidth: 2,
                      r: 4,
                    }}
                    name="Intervention Required"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Patterns Tab */}
      {selectedView === 'patterns' && (
        <div className="space-y-6">
          {/* Pattern Alerts */}
          <div className="bg-tm-white border border-tm-cool-gray rounded-lg p-6">
            <h3 className="text-lg font-semibold text-tm-black mb-4 font-tm-headline">
              Pattern Alerts
            </h3>
            {patternAlerts.length > 0 ? (
              <div className="space-y-3">
                {patternAlerts.map((alert, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-4 rounded-lg border"
                    style={{
                      backgroundColor: `${getSeverityColor(alert.severity)}10`,
                      borderColor: `${getSeverityColor(alert.severity)}30`,
                    }}
                  >
                    <div
                      className="w-2 h-2 rounded-full mt-2 flex-shrink-0"
                      style={{
                        backgroundColor: getSeverityColor(alert.severity),
                      }}
                    />
                    <div className="flex-1">
                      <p className="font-medium text-tm-black font-tm-body">
                        {alert.description}
                      </p>
                      <p className="text-sm text-tm-cool-gray font-tm-body mt-1">
                        Severity:{' '}
                        {alert.severity.charAt(0).toUpperCase() +
                          alert.severity.slice(1)}{' '}
                        •{alert.clubs.length} clubs affected
                      </p>
                    </div>
                    <button
                      onClick={() => handlePatternDrillDown(alert)}
                      className="text-sm text-tm-loyal-blue hover:underline font-tm-body"
                    >
                      View Details
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <svg
                  className="w-12 h-12 text-tm-cool-gray mx-auto mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-tm-cool-gray font-tm-body">
                  No concerning patterns detected
                </p>
                <p className="text-sm text-tm-cool-gray font-tm-body mt-1">
                  All clubs are performing within expected ranges
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filtered Clubs List */}
      {(selectedHealthStatus || selectedTrajectory) && (
        <div className="bg-tm-white border border-tm-cool-gray rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-tm-black font-tm-headline">
              Filtered Clubs
              {selectedHealthStatus && ` - ${selectedHealthStatus}`}
              {selectedTrajectory && ` - ${selectedTrajectory}`}
            </h3>
            <button
              onClick={() => {
                setSelectedHealthStatus(null)
                setSelectedTrajectory(null)
              }}
              className="text-sm text-tm-cool-gray hover:text-tm-black font-tm-body"
            >
              Clear Filters
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredClubs.map(club => (
              <div
                key={club.club_name}
                className="p-3 border border-tm-cool-gray rounded-lg hover:bg-tm-cool-gray hover:bg-opacity-10 cursor-pointer transition-colors"
                onClick={() => handleClubClick(club)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleClubClick(club)
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`View details for ${club.club_name}`}
              >
                <div className="font-medium text-tm-black font-tm-headline text-sm">
                  {club.club_name}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className="px-2 py-1 text-xs rounded-full text-white"
                    style={{
                      backgroundColor: HEALTH_STATUS_COLORS[club.health_status],
                    }}
                  >
                    {club.health_status}
                  </span>
                  <span
                    className="px-2 py-1 text-xs rounded-full text-white"
                    style={{
                      backgroundColor: TRAJECTORY_COLORS[club.trajectory],
                    }}
                  >
                    {club.trajectory}
                  </span>
                </div>
                <div className="text-xs text-tm-cool-gray font-tm-body mt-1">
                  Members: {club.members_delta_mom > 0 ? '+' : ''}
                  {club.members_delta_mom} MoM • DCP:{' '}
                  {club.dcp_delta_mom > 0 ? '+' : ''}
                  {club.dcp_delta_mom} MoM
                </div>
              </div>
            ))}
          </div>
          {filteredClubs.length === 0 && (
            <div className="text-center py-8">
              <p className="text-tm-cool-gray font-tm-body">
                No clubs match the selected criteria
              </p>
            </div>
          )}
        </div>
      )}

      {/* Drill-Down Modal */}
      {drillDownData && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setDrillDownData(null)}
        >
          <div
            className="bg-tm-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6">
              {/* Modal Header */}
              <div className="flex items-start justify-between mb-6">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-tm-black font-tm-headline">
                    {drillDownData.type === 'health' &&
                      `${(drillDownData.data as { status: string }).status} Clubs Analysis`}
                    {drillDownData.type === 'trajectory' &&
                      `${(drillDownData.data as { trajectory: string }).trajectory} Trajectory Analysis`}
                    {drillDownData.type === 'pattern' &&
                      `Pattern Analysis: ${(drillDownData.data as { description: string }).description}`}
                  </h3>
                  <p className="text-tm-cool-gray mt-1 font-tm-body">
                    {drillDownData.clubs.length} clubs •
                    {drillDownData.type !== 'pattern' &&
                      ` ${(drillDownData.data as { percentage: number }).percentage}% of district`}
                    {drillDownData.type === 'pattern' &&
                      ` Severity: ${(drillDownData.data as { severity: string }).severity}`}
                  </p>
                </div>
                <button
                  onClick={() => setDrillDownData(null)}
                  className="text-tm-cool-gray hover:text-tm-black transition-colors ml-4"
                  style={{
                    minHeight: TOUCH_TARGET_REQUIREMENTS.minHeight,
                    minWidth: TOUCH_TARGET_REQUIREMENTS.minWidth,
                  }}
                  aria-label="Close drill-down analysis"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Export Options for Drill-Down Data */}
              <div className="flex items-center justify-between mb-6 p-4 bg-tm-cool-gray bg-opacity-10 rounded-lg">
                <div>
                  <h4 className="font-semibold text-tm-black font-tm-headline">
                    Export This Analysis
                  </h4>
                  <p className="text-sm text-tm-cool-gray font-tm-body">
                    Download detailed data for these{' '}
                    {drillDownData.clubs.length} clubs
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const csvData = convertToCSV([
                        [
                          'Club Name',
                          'Health Status',
                          'Trajectory',
                          'Members Delta MoM',
                          'DCP Delta MoM',
                          'Reasons',
                        ],
                        ...drillDownData.clubs.map(club => [
                          club.club_name,
                          club.health_status,
                          club.trajectory,
                          club.members_delta_mom.toString(),
                          club.dcp_delta_mom.toString(),
                          club.reasons.join('; '),
                        ]),
                      ])
                      const blob = new Blob([csvData], { type: 'text/csv' })
                      const url = window.URL.createObjectURL(blob)
                      const link = document.createElement('a')
                      link.href = url
                      link.download = `district_${districtId}_${drillDownData.type}_analysis.csv`
                      document.body.appendChild(link)
                      link.click()
                      document.body.removeChild(link)
                      window.URL.revokeObjectURL(url)
                    }}
                    className="px-3 py-2 bg-tm-loyal-blue text-tm-white rounded-md hover:opacity-90 transition-opacity font-tm-body text-sm"
                  >
                    Export CSV
                  </button>
                </div>
              </div>

              {/* Clubs Grid with Enhanced Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {drillDownData.clubs.map(club => (
                  <div
                    key={club.club_name}
                    className="p-4 border border-tm-cool-gray rounded-lg hover:bg-tm-cool-gray hover:bg-opacity-10 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h5 className="font-semibold text-tm-black font-tm-headline">
                          {club.club_name}
                        </h5>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className="px-2 py-1 text-xs rounded-full text-white"
                            style={{
                              backgroundColor:
                                HEALTH_STATUS_COLORS[club.health_status],
                            }}
                          >
                            {club.health_status}
                          </span>
                          <span
                            className="px-2 py-1 text-xs rounded-full text-white"
                            style={{
                              backgroundColor:
                                TRAJECTORY_COLORS[club.trajectory],
                            }}
                          >
                            {club.trajectory}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => handleClubClick(club)}
                          className="text-xs text-tm-loyal-blue hover:underline font-tm-body"
                        >
                          View Details
                        </button>
                        {onNavigateToClub && (
                          <button
                            onClick={() => handleNavigateToClub(club.club_name)}
                            className="text-xs text-tm-cool-gray hover:text-tm-black font-tm-body"
                          >
                            Go to Club
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Month-over-Month Changes */}
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="text-center p-2 bg-tm-white border border-tm-cool-gray rounded">
                        <div className="text-xs text-tm-cool-gray font-tm-body">
                          Members MoM
                        </div>
                        <div
                          className={`text-sm font-semibold font-tm-body ${
                            club.members_delta_mom >= 0
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}
                        >
                          {club.members_delta_mom >= 0 ? '+' : ''}
                          {club.members_delta_mom}
                        </div>
                      </div>
                      <div className="text-center p-2 bg-tm-white border border-tm-cool-gray rounded">
                        <div className="text-xs text-tm-cool-gray font-tm-body">
                          DCP MoM
                        </div>
                        <div
                          className={`text-sm font-semibold font-tm-body ${
                            club.dcp_delta_mom >= 0
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}
                        >
                          {club.dcp_delta_mom >= 0 ? '+' : ''}
                          {club.dcp_delta_mom}
                        </div>
                      </div>
                    </div>

                    {/* Reasons */}
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-tm-black font-tm-body">
                        Health Reasons:
                      </div>
                      {club.reasons.slice(0, 2).map((reason, index) => (
                        <div
                          key={index}
                          className="text-xs text-tm-cool-gray font-tm-body flex items-start gap-1"
                        >
                          <span className="text-tm-loyal-blue">•</span>
                          <span>{reason}</span>
                        </div>
                      ))}
                      {club.reasons.length > 2 && (
                        <div className="text-xs text-tm-cool-gray font-tm-body">
                          +{club.reasons.length - 2} more reasons
                        </div>
                      )}
                    </div>

                    {/* Trajectory Reasons */}
                    {club.trajectory_reasons.length > 0 && (
                      <div className="space-y-1 mt-2 pt-2 border-t border-tm-cool-gray">
                        <div className="text-xs font-medium text-tm-black font-tm-body">
                          Trajectory Reasons:
                        </div>
                        {club.trajectory_reasons
                          .slice(0, 1)
                          .map((reason, index) => (
                            <div
                              key={index}
                              className="text-xs text-tm-cool-gray font-tm-body flex items-start gap-1"
                            >
                              <span className="text-tm-true-maroon">•</span>
                              <span>{reason}</span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Summary Statistics for Drill-Down */}
              <div className="mt-6 pt-6 border-t border-tm-cool-gray">
                <h4 className="font-semibold text-tm-black mb-4 font-tm-headline">
                  Analysis Summary
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-tm-cool-gray bg-opacity-10 rounded-lg p-4">
                    <div className="text-sm text-tm-cool-gray font-tm-body">
                      Average Members Change
                    </div>
                    <div className="text-xl font-bold text-tm-black font-tm-headline">
                      {(
                        drillDownData.clubs.reduce(
                          (sum, club) => sum + club.members_delta_mom,
                          0
                        ) / drillDownData.clubs.length
                      ).toFixed(1)}
                    </div>
                  </div>
                  <div className="bg-tm-cool-gray bg-opacity-10 rounded-lg p-4">
                    <div className="text-sm text-tm-cool-gray font-tm-body">
                      Average DCP Change
                    </div>
                    <div className="text-xl font-bold text-tm-black font-tm-headline">
                      {(
                        drillDownData.clubs.reduce(
                          (sum, club) => sum + club.dcp_delta_mom,
                          0
                        ) / drillDownData.clubs.length
                      ).toFixed(1)}
                    </div>
                  </div>
                  <div className="bg-tm-cool-gray bg-opacity-10 rounded-lg p-4">
                    <div className="text-sm text-tm-cool-gray font-tm-body">
                      Most Common Issue
                    </div>
                    <div className="text-sm font-semibold text-tm-black font-tm-body">
                      {(() => {
                        const reasonCounts = drillDownData.clubs.reduce(
                          (acc, club) => {
                            club.reasons.forEach(reason => {
                              const key = reason
                                .split(' ')
                                .slice(0, 3)
                                .join(' ') // First 3 words
                              acc[key] = (acc[key] || 0) + 1
                            })
                            return acc
                          },
                          {} as Record<string, number>
                        )
                        const topReason = Object.entries(reasonCounts).sort(
                          ([, a], [, b]) => b - a
                        )[0]
                        return topReason
                          ? `${topReason[0]}... (${topReason[1]} clubs)`
                          : 'N/A'
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Close Button */}
              <div className="flex justify-end gap-3 pt-6 border-t border-tm-cool-gray mt-6">
                <button
                  onClick={() => setDrillDownData(null)}
                  className="px-6 py-2 bg-tm-cool-gray text-tm-black rounded-lg hover:opacity-90 transition-opacity font-medium font-tm-body"
                  style={{ minHeight: TOUCH_TARGET_REQUIREMENTS.minHeight }}
                >
                  Close Analysis
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DistrictAnalyticsDashboard
