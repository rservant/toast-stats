/**
 * Club Health Detail Modal Component
 *
 * Displays detailed club health information including status, trajectory,
 * historical trends, and actionable recommendations
 */

import React from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  ClubHealthResult,
  ClubHealthHistory,
  HealthStatus,
  Trajectory,
} from '../types/clubHealth'

interface ClubHealthDetailModalProps {
  club: ClubHealthResult | null
  clubHistory?: ClubHealthHistory[]
  onClose: () => void
}

export const ClubHealthDetailModal: React.FC<ClubHealthDetailModalProps> = ({
  club,
  clubHistory = [],
  onClose,
}) => {
  if (!club) return null

  // Get health status styling
  const getHealthStatusStyling = (status: HealthStatus) => {
    switch (status) {
      case 'Thriving':
        return 'bg-tm-loyal-blue text-tm-white border-tm-loyal-blue'
      case 'Vulnerable':
        return 'bg-tm-happy-yellow text-tm-black border-tm-happy-yellow'
      case 'Intervention Required':
        return 'bg-tm-true-maroon text-tm-white border-tm-true-maroon'
      default:
        return 'bg-tm-cool-gray text-tm-black border-tm-cool-gray'
    }
  }

  // Get trajectory styling
  const getTrajectoryStyling = (trajectory: Trajectory) => {
    switch (trajectory) {
      case 'Recovering':
        return 'bg-green-100 text-green-800 border-green-300'
      case 'Stable':
        return 'bg-tm-cool-gray text-tm-black border-tm-cool-gray'
      case 'Declining':
        return 'bg-red-100 text-red-800 border-red-300'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  // Generate recommendations based on health status and reasons
  const generateRecommendations = (): string[] => {
    const recommendations: string[] = []

    if (club.health_status === 'Intervention Required') {
      recommendations.push(
        'Immediate action required: Focus on membership recruitment and retention'
      )
      recommendations.push(
        'Contact District Leadership Team for support and resources'
      )
    }

    if (club.health_status === 'Vulnerable') {
      recommendations.push('Monitor club closely and provide proactive support')
    }

    // Check specific reasons for targeted recommendations
    club.reasons.forEach(reason => {
      if (reason.includes('membership')) {
        recommendations.push('Implement membership recruitment campaign')
        recommendations.push(
          'Focus on guest retention and conversion strategies'
        )
      }
      if (reason.includes('DCP')) {
        recommendations.push('Review DCP goals and create action plan')
        recommendations.push(
          'Engage members in educational and leadership opportunities'
        )
      }
      if (reason.includes('officer')) {
        recommendations.push('Complete officer training requirements')
        recommendations.push(
          'Submit updated officer list to Toastmasters International'
        )
      }
    })

    if (club.trajectory === 'Declining') {
      recommendations.push('Investigate root causes of declining performance')
      recommendations.push('Consider club coaching or mentoring support')
    }

    return [...new Set(recommendations)] // Remove duplicates
  }

  const recommendations = generateRecommendations()

  // Export club health report as PDF-ready HTML
  const handleExportReport = () => {
    const reportContent = `
      <html>
        <head>
          <title>Club Health Report - ${club.club_name}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { border-bottom: 2px solid #004165; padding-bottom: 10px; margin-bottom: 20px; }
            .status-badge { padding: 8px 16px; border-radius: 20px; display: inline-block; margin: 5px 0; }
            .thriving { background-color: #004165; color: white; }
            .vulnerable { background-color: #F2DF74; color: black; }
            .intervention { background-color: #772432; color: white; }
            .section { margin: 20px 0; }
            .metric { margin: 10px 0; }
            ul { margin: 10px 0; padding-left: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Club Health Report</h1>
            <h2>${club.club_name}</h2>
            <p>Generated on: ${new Date().toLocaleDateString()}</p>
          </div>
          
          <div class="section">
            <h3>Current Health Status</h3>
            <div class="status-badge ${club.health_status.toLowerCase().replace(' ', '-')}">
              ${club.health_status}
            </div>
            <h4>Reasons:</h4>
            <ul>
              ${club.reasons.map(reason => `<li>${reason}</li>`).join('')}
            </ul>
          </div>
          
          <div class="section">
            <h3>Trajectory</h3>
            <p><strong>${club.trajectory}</strong></p>
            <h4>Trajectory Reasons:</h4>
            <ul>
              ${club.trajectory_reasons.map(reason => `<li>${reason}</li>`).join('')}
            </ul>
          </div>
          
          <div class="section">
            <h3>Month-over-Month Changes</h3>
            <div class="metric">Membership Change: ${club.members_delta_mom >= 0 ? '+' : ''}${club.members_delta_mom}</div>
            <div class="metric">DCP Goals Change: ${club.dcp_delta_mom >= 0 ? '+' : ''}${club.dcp_delta_mom}</div>
          </div>
          
          <div class="section">
            <h3>Recommendations</h3>
            <ul>
              ${recommendations.map(rec => `<li>${rec}</li>`).join('')}
            </ul>
          </div>
          
          <div class="section">
            <h3>Report Metadata</h3>
            <div class="metric">Evaluation Date: ${club.metadata.evaluation_date}</div>
            <div class="metric">Processing Time: ${club.metadata.processing_time_ms}ms</div>
            <div class="metric">Rule Version: ${club.metadata.rule_version}</div>
          </div>
        </body>
      </html>
    `

    const blob = new Blob([reportContent], { type: 'text/html' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${club.club_name.replace(/[^a-z0-9]/gi, '_')}_health_report.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-tm-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-tm-black font-tm-headline">
                {club.club_name}
              </h3>
              <p className="text-tm-cool-gray mt-1 font-tm-body">
                Club Health Classification Report
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-tm-cool-gray hover:text-tm-black transition-colors ml-4 min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Close modal"
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

          {/* Status and Export */}
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <div className="flex items-center gap-4 flex-wrap">
              <span
                className={`px-4 py-2 text-sm font-medium rounded-full border-2 ${getHealthStatusStyling(club.health_status)}`}
              >
                {club.health_status}
              </span>
              <span
                className={`px-4 py-2 text-sm font-medium rounded-full border-2 ${getTrajectoryStyling(club.trajectory)}`}
              >
                {club.trajectory}
              </span>
            </div>
            <button
              onClick={handleExportReport}
              className="flex items-center gap-2 px-4 py-2 bg-tm-loyal-blue text-tm-white rounded-lg hover:opacity-90 transition-opacity font-tm-body min-h-[44px]"
            >
              <svg
                className="w-5 h-5"
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
              Export Report
            </button>
          </div>

          {/* Health Status Details */}
          <div className="mb-6 bg-tm-cool-gray bg-opacity-20 border border-tm-cool-gray rounded-lg p-4">
            <h4 className="font-semibold text-tm-black mb-3 flex items-center gap-2 font-tm-headline">
              <svg
                className="w-5 h-5 text-tm-loyal-blue"
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
              Health Status Analysis
            </h4>
            <div className="space-y-2">
              {club.reasons.map((reason, index) => (
                <div key={index} className="flex items-start gap-2">
                  <svg
                    className="w-5 h-5 text-tm-loyal-blue mt-0.5 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-tm-black font-tm-body">{reason}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Trajectory Analysis */}
          <div className="mb-6 bg-tm-cool-gray bg-opacity-20 border border-tm-cool-gray rounded-lg p-4">
            <h4 className="font-semibold text-tm-black mb-3 flex items-center gap-2 font-tm-headline">
              <svg
                className="w-5 h-5 text-tm-loyal-blue"
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
              Trajectory Analysis
            </h4>
            <div className="space-y-2">
              {club.trajectory_reasons.map((reason, index) => (
                <div key={index} className="flex items-start gap-2">
                  <svg
                    className="w-5 h-5 text-tm-loyal-blue mt-0.5 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-tm-black font-tm-body">{reason}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Month-over-Month Changes */}
          <div className="mb-6">
            <h4 className="font-semibold text-tm-black mb-4 flex items-center gap-2 font-tm-headline">
              <svg
                className="w-5 h-5 text-tm-loyal-blue"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              Month-over-Month Changes
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-tm-white border border-tm-cool-gray rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-tm-cool-gray font-tm-body">
                    Membership Change
                  </span>
                  <span
                    className={`font-semibold font-tm-body ${
                      club.members_delta_mom >= 0
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {club.members_delta_mom >= 0 ? '+' : ''}
                    {club.members_delta_mom} members
                  </span>
                </div>
              </div>
              <div className="bg-tm-white border border-tm-cool-gray rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-tm-cool-gray font-tm-body">
                    DCP Goals Change
                  </span>
                  <span
                    className={`font-semibold font-tm-body ${
                      club.dcp_delta_mom >= 0
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {club.dcp_delta_mom >= 0 ? '+' : ''}
                    {club.dcp_delta_mom} goals
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Historical Trend Visualization */}
          {clubHistory.length > 0 && (
            <div className="mb-6">
              <h4 className="font-semibold text-tm-black mb-4 flex items-center gap-2 font-tm-headline">
                <svg
                  className="w-5 h-5 text-tm-loyal-blue"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                Historical Trends
              </h4>
              <div className="bg-tm-white border border-tm-cool-gray rounded-lg p-4">
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={clubHistory.map(point => ({
                        date: new Date(
                          point.evaluation_date
                        ).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        }),
                        members: point.members,
                        dcp_goals: point.dcp_goals,
                        health_numeric:
                          point.health_status === 'Thriving'
                            ? 3
                            : point.health_status === 'Vulnerable'
                              ? 2
                              : 1,
                      }))}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--tm-cool-gray)"
                      />
                      <XAxis
                        dataKey="date"
                        stroke="var(--tm-black)"
                        fontSize={12}
                        fontFamily="var(--tm-body-font)"
                      />
                      <YAxis
                        yAxisId="left"
                        stroke="var(--tm-loyal-blue)"
                        fontSize={12}
                        fontFamily="var(--tm-body-font)"
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        stroke="var(--tm-true-maroon)"
                        fontSize={12}
                        fontFamily="var(--tm-body-font)"
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--tm-white)',
                          border: '1px solid var(--tm-cool-gray)',
                          borderRadius: '8px',
                          fontFamily: 'var(--tm-body-font)',
                        }}
                        formatter={(value, name) => {
                          if (name === 'members') return [value, 'Members']
                          if (name === 'dcp_goals') return [value, 'DCP Goals']
                          return [value, name]
                        }}
                      />
                      <Legend
                        wrapperStyle={{
                          fontFamily: 'var(--tm-body-font)',
                          fontSize: '14px',
                        }}
                      />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="members"
                        stroke="var(--tm-loyal-blue)"
                        strokeWidth={2}
                        dot={{
                          fill: 'var(--tm-loyal-blue)',
                          strokeWidth: 2,
                          r: 4,
                        }}
                        name="Members"
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="dcp_goals"
                        stroke="var(--tm-true-maroon)"
                        strokeWidth={2}
                        dot={{
                          fill: 'var(--tm-true-maroon)',
                          strokeWidth: 2,
                          r: 4,
                        }}
                        name="DCP Goals"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 text-sm text-tm-cool-gray font-tm-body">
                  <p>
                    Historical data showing membership and DCP goals progress
                    over time. Trends help identify patterns and inform
                    strategic decisions.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <div className="mb-6 bg-tm-happy-yellow bg-opacity-20 border border-tm-happy-yellow rounded-lg p-4">
              <h4 className="font-semibold text-tm-true-maroon mb-3 flex items-center gap-2 font-tm-headline">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
                Actionable Recommendations
              </h4>
              <div className="space-y-2">
                {recommendations.map((recommendation, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <svg
                      className="w-5 h-5 text-tm-true-maroon mt-0.5 flex-shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-tm-true-maroon font-tm-body">
                      {recommendation}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Report Metadata */}
          <div className="mb-6 bg-tm-cool-gray bg-opacity-10 border border-tm-cool-gray rounded-lg p-4">
            <h4 className="font-semibold text-tm-black mb-3 font-tm-headline">
              Report Information
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-tm-cool-gray font-tm-body">
                  Evaluation Date:
                </span>
                <div className="font-semibold text-tm-black font-tm-body">
                  {new Date(club.metadata.evaluation_date).toLocaleDateString()}
                </div>
              </div>
              <div>
                <span className="text-tm-cool-gray font-tm-body">
                  Processing Time:
                </span>
                <div className="font-semibold text-tm-black font-tm-body">
                  {club.metadata.processing_time_ms}ms
                </div>
              </div>
              <div>
                <span className="text-tm-cool-gray font-tm-body">
                  Rule Version:
                </span>
                <div className="font-semibold text-tm-black font-tm-body">
                  {club.metadata.rule_version}
                </div>
              </div>
            </div>
          </div>

          {/* Close Button */}
          <div className="flex justify-end gap-3 pt-4 border-t border-tm-cool-gray">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-tm-cool-gray text-tm-black rounded-lg hover:opacity-90 transition-opacity font-medium font-tm-body min-h-[44px]"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
