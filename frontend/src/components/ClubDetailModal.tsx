import React from 'react'
import { ClubTrend } from '../hooks/useDistrictAnalytics'
import { formatDisplayDate } from '../utils/dateFormatting'

interface ClubDetailModalProps {
  club: ClubTrend | null
  onClose: () => void
}

export const ClubDetailModal: React.FC<ClubDetailModalProps> = ({
  club,
  onClose,
}) => {
  if (!club) return null

  // Get status badge styling
  const getStatusBadge = (
    status: 'thriving' | 'vulnerable' | 'intervention-required'
  ) => {
    switch (status) {
      case 'intervention-required':
        return 'bg-red-100 text-red-800 border-red-300'
      case 'vulnerable':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      default:
        return 'bg-green-100 text-green-800 border-green-300'
    }
  }

  // Get latest membership
  const latestMembership =
    club.membershipTrend.length > 0
      ? (club.membershipTrend[club.membershipTrend.length - 1]?.count ?? 0)
      : 0

  // Get membership change
  const membershipChange =
    club.membershipTrend.length > 1
      ? (club.membershipTrend[club.membershipTrend.length - 1]?.count ?? 0) -
        (club.membershipTrend[0]?.count ?? 0)
      : 0

  // Get latest DCP goals
  const latestDcpGoals =
    club.dcpGoalsTrend.length > 0
      ? (club.dcpGoalsTrend[club.dcpGoalsTrend.length - 1]?.goalsAchieved ?? 0)
      : 0

  // Format date (using utility to avoid UTC timezone shift)
  const formatDate = (dateStr: string) => formatDisplayDate(dateStr)

  // Export club data as CSV
  const handleExport = () => {
    const csvRows = []

    // Header
    csvRows.push('Date,Membership,DCP Goals')

    // Combine membership and DCP data
    const maxLength = Math.max(
      club.membershipTrend.length,
      club.dcpGoalsTrend.length
    )
    for (let i = 0; i < maxLength; i++) {
      const membershipData = club.membershipTrend[i]
      const dcpData = club.dcpGoalsTrend[i]

      const date = membershipData?.date || dcpData?.date || ''
      const membership = membershipData?.count ?? ''
      const dcpGoals = dcpData?.goalsAchieved ?? ''

      csvRows.push(`${date},${membership},${dcpGoals}`)
    }

    // Create blob and download
    const csvContent = csvRows.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${club.clubName.replace(/[^a-z0-9]/gi, '_')}_data.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  // Calculate min and max for chart scaling
  const membershipValues = club.membershipTrend.map(d => d.count)
  const minMembership = Math.min(...membershipValues)
  const maxMembership = Math.max(...membershipValues)
  const membershipRange = maxMembership - minMembership || 1

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-gray-900 font-tm-headline">
                {club.clubName}
              </h3>
              <p className="text-gray-600 mt-1 font-tm-body">
                {club.areaName} • {club.divisionName}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors ml-4"
              aria-label="Close"
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
          <div className="flex items-center justify-between mb-6">
            <span
              className={`px-4 py-2 text-sm font-medium rounded-full border ${getStatusBadge(club.currentStatus)}`}
            >
              {club.currentStatus.toUpperCase()}
            </span>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-tm-loyal-blue text-white rounded-lg hover:bg-tm-loyal-blue-80 transition-colors font-tm-body"
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
              Export Data
            </button>
          </div>

          {/* Risk Factors */}
          {club.riskFactors.length > 0 && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <h4 className="font-semibold text-red-900 mb-3 flex items-center gap-2 font-tm-headline">
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                Risk Factors
              </h4>
              <div className="space-y-2">
                {club.riskFactors.map((factor, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <svg
                      className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-red-900 font-tm-body">{factor}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Distinguished Status */}
          {club.distinguishedLevel &&
            club.distinguishedLevel !== 'NotDistinguished' && (
              <div className="mb-6 bg-tm-happy-yellow-20 border border-tm-happy-yellow-40 rounded-lg p-4">
                <h4 className="font-semibold text-tm-true-maroon mb-2 flex items-center gap-2 font-tm-headline">
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
                      d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                    />
                  </svg>
                  Distinguished Status
                </h4>
                <span className="inline-block px-4 py-2 bg-tm-happy-yellow-30 text-tm-true-maroon text-sm font-medium rounded-full font-tm-body">
                  {club.distinguishedLevel}
                </span>
              </div>
            )}

          {/* Membership Trend Chart */}
          {club.membershipTrend.length > 0 && (
            <div className="mb-6">
              <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2 font-tm-headline">
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
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                Membership Trend
              </h4>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                {/* Stats */}
                <div className="flex items-center justify-between mb-4 text-sm">
                  <div>
                    <span className="text-gray-600 font-tm-body">
                      Current:{' '}
                    </span>
                    <span className="font-semibold text-gray-900 font-tm-body">
                      {latestMembership} members
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 font-tm-body">Change: </span>
                    <span
                      className={`font-semibold font-tm-body ${membershipChange >= 0 ? 'text-green-600' : 'text-red-600'}`}
                    >
                      {membershipChange >= 0 ? '+' : ''}
                      {membershipChange} members
                    </span>
                  </div>
                </div>

                {/* Simple Line Chart */}
                <div className="relative h-48 bg-white rounded border border-gray-200 p-4">
                  {/* Y-axis labels */}
                  <div className="absolute left-0 top-4 bottom-4 w-10 flex flex-col justify-between text-xs text-gray-500 font-tm-body">
                    <span>{maxMembership}</span>
                    <span>{Math.round(minMembership + membershipRange * 0.75)}</span>
                    <span>{Math.round(minMembership + membershipRange * 0.5)}</span>
                    <span>{Math.round(minMembership + membershipRange * 0.25)}</span>
                    <span>{minMembership}</span>
                  </div>
                  <svg
                    className="w-full h-full ml-8"
                    viewBox="0 0 800 160"
                    preserveAspectRatio="none"
                    aria-label={`Membership trend from ${minMembership} to ${maxMembership} members`}
                  >
                    {/* Grid lines */}
                    <line
                      x1="0"
                      y1="0"
                      x2="800"
                      y2="0"
                      stroke="var(--tm-cool-gray)"
                      strokeWidth="1"
                    />
                    <line
                      x1="0"
                      y1="40"
                      x2="800"
                      y2="40"
                      stroke="var(--tm-cool-gray)"
                      strokeWidth="1"
                    />
                    <line
                      x1="0"
                      y1="80"
                      x2="800"
                      y2="80"
                      stroke="var(--tm-cool-gray)"
                      strokeWidth="1"
                    />
                    <line
                      x1="0"
                      y1="120"
                      x2="800"
                      y2="120"
                      stroke="var(--tm-cool-gray)"
                      strokeWidth="1"
                    />
                    <line
                      x1="0"
                      y1="160"
                      x2="800"
                      y2="160"
                      stroke="var(--tm-cool-gray)"
                      strokeWidth="1"
                    />

                    {/* Line path */}
                    <polyline
                      fill="none"
                      stroke="var(--tm-loyal-blue)" // TM Loyal Blue
                      strokeWidth="2"
                      points={club.membershipTrend
                        .map((point, index) => {
                          const x =
                            (index / (club.membershipTrend.length - 1)) * 800
                          const y =
                            160 -
                            ((point.count - minMembership) / membershipRange) *
                              160
                          return `${x},${y}`
                        })
                        .join(' ')}
                    />

                    {/* Data points */}
                    {club.membershipTrend.map((point, index) => {
                      const x =
                        (index / (club.membershipTrend.length - 1)) * 800
                      const y =
                        160 -
                        ((point.count - minMembership) / membershipRange) * 160
                      return (
                        <circle
                          key={index}
                          cx={x}
                          cy={y}
                          r="4"
                          fill="var(--tm-loyal-blue)" // TM Loyal Blue
                        />
                      )
                    })}
                  </svg>
                </div>

                {/* Date range */}
                <div className="flex items-center justify-between mt-2 text-xs text-gray-600 font-tm-body">
                  <span>
                    {club.membershipTrend[0]
                      ? formatDate(club.membershipTrend[0].date)
                      : 'N/A'}
                  </span>
                  <span>
                    {club.membershipTrend[club.membershipTrend.length - 1]
                      ? formatDate(
                          club.membershipTrend[club.membershipTrend.length - 1]
                            ?.date ?? ''
                        )
                      : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* DCP Goals Progress */}
          {club.dcpGoalsTrend.length > 0 && (
            <div className="mb-6">
              <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2 font-tm-headline">
                <svg
                  className="w-5 h-5 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                  />
                </svg>
                DCP Goals Progress Over Time
              </h4>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                {/* Current Progress */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-gray-600 font-tm-body">
                      Current Progress
                    </span>
                    <span className="font-semibold text-gray-900 font-tm-body">
                      {latestDcpGoals} / 10 goals
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-green-600 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${(latestDcpGoals / 10) * 100}%` }}
                    ></div>
                  </div>
                </div>

                {/* Historical Progress */}
                <div className="space-y-2">
                  {club.dcpGoalsTrend
                    .slice(-5)
                    .reverse()
                    .map((point, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 text-sm"
                      >
                        <span className="text-gray-600 w-24 font-tm-body">
                          {formatDate(point.date)}
                        </span>
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-tm-loyal-blue h-2 rounded-full"
                            style={{
                              width: `${(point.goalsAchieved / 10) * 100}%`,
                            }}
                          ></div>
                        </div>
                        <span className="text-gray-900 w-16 text-right font-tm-body">
                          {point.goalsAchieved} / 10
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* Close Button */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium font-tm-body"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
