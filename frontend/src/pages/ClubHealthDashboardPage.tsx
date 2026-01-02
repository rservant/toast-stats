/**
 * Club Health Dashboard Page Component
 *
 * Dedicated page for club health matrix visualization
 * Handles both district-specific and general club health routes
 */

import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { HealthMatrixDashboard } from '../components/HealthMatrixDashboard'
import { DistrictAnalyticsDashboard } from '../components/DistrictAnalyticsDashboard'
import { ClubHealthDetailModal } from '../components/ClubHealthDetailModal'
import { ClubHealthResult } from '../types/clubHealth'
import { useDistrictClubsHealth } from '../hooks/useClubHealth'

// Sample data for demonstration
const sampleClubs: ClubHealthResult[] = [
  {
    club_name: 'Sunrise Speakers',
    health_status: 'Thriving',
    reasons: [
      'Membership requirement met (25 members)',
      'DCP goals on track (3/3)',
      'CSP submitted',
    ],
    trajectory: 'Stable',
    trajectory_reasons: ['Health status unchanged', 'Consistent performance'],
    composite_key: 'Thriving__Stable',
    composite_label: 'Thriving • Stable',
    members_delta_mom: 2,
    dcp_delta_mom: 1,
    metadata: {
      evaluation_date: '2024-01-01',
      processing_time_ms: 45,
      rule_version: '1.0.0',
    },
  },
  {
    club_name: 'Downtown Toastmasters',
    health_status: 'Vulnerable',
    reasons: [
      'Membership below threshold (18 members)',
      'DCP goals behind (1/3)',
      'CSP not submitted',
    ],
    trajectory: 'Declining',
    trajectory_reasons: ['Lost 3 members this month', 'No DCP progress'],
    composite_key: 'Vulnerable__Declining',
    composite_label: 'Vulnerable • Declining',
    members_delta_mom: -3,
    dcp_delta_mom: 0,
    metadata: {
      evaluation_date: '2024-01-01',
      processing_time_ms: 38,
      rule_version: '1.0.0',
    },
  },
  {
    club_name: 'Evening Eloquence',
    health_status: 'Intervention Required',
    reasons: [
      'Membership critically low (8 members)',
      'No growth since July (-2)',
      'DCP goals not met (0/3)',
    ],
    trajectory: 'Recovering',
    trajectory_reasons: [
      'Health status improved from last month',
      'Recent recruitment efforts',
    ],
    composite_key: 'Intervention Required__Recovering',
    composite_label: 'Intervention Required • Recovering',
    members_delta_mom: 1,
    dcp_delta_mom: 0,
    metadata: {
      evaluation_date: '2024-01-01',
      processing_time_ms: 52,
      rule_version: '1.0.0',
    },
  },
  {
    club_name: 'Business Leaders Club',
    health_status: 'Thriving',
    reasons: [
      'Strong membership (32 members)',
      'Excellent DCP progress (5/5)',
      'CSP submitted early',
    ],
    trajectory: 'Recovering',
    trajectory_reasons: [
      'Improved from Vulnerable last month',
      'Strong member recruitment',
    ],
    composite_key: 'Thriving__Recovering',
    composite_label: 'Thriving • Recovering',
    members_delta_mom: 5,
    dcp_delta_mom: 2,
    metadata: {
      evaluation_date: '2024-01-01',
      processing_time_ms: 41,
      rule_version: '1.0.0',
    },
  },
  {
    club_name: 'Tech Talkers',
    health_status: 'Vulnerable',
    reasons: [
      'Membership adequate (22 members)',
      'DCP goals behind (2/4)',
      'CSP submitted',
    ],
    trajectory: 'Stable',
    trajectory_reasons: ['Health status unchanged', 'Steady membership'],
    composite_key: 'Vulnerable__Stable',
    composite_label: 'Vulnerable • Stable',
    members_delta_mom: 0,
    dcp_delta_mom: 1,
    metadata: {
      evaluation_date: '2024-01-01',
      processing_time_ms: 43,
      rule_version: '1.0.0',
    },
  },
  {
    club_name: 'Community Voices',
    health_status: 'Thriving',
    reasons: [
      'Excellent membership (28 members)',
      'DCP goals exceeded (6/5)',
      'CSP submitted',
    ],
    trajectory: 'Declining',
    trajectory_reasons: [
      'Lost 2 members this month',
      'Previous month was stronger',
    ],
    composite_key: 'Thriving__Declining',
    composite_label: 'Thriving • Declining',
    members_delta_mom: -2,
    dcp_delta_mom: 0,
    metadata: {
      evaluation_date: '2024-01-01',
      processing_time_ms: 39,
      rule_version: '1.0.0',
    },
  },
]

type ViewType = 'matrix' | 'analytics'

export const ClubHealthDashboardPage: React.FC = () => {
  const { districtId, clubName } = useParams<{
    districtId?: string
    clubName?: string
  }>()
  const navigate = useNavigate()
  const [selectedClub, setSelectedClub] = useState<ClubHealthResult | null>(
    null
  )
  const [currentView, setCurrentView] = useState<ViewType>('matrix')

  // Use the hook for real data (currently will show loading/error states)
  // Use districtId from URL params if available, otherwise default to '42'
  const {
    data: clubs = [],
    isLoading: loading,
    error,
  } = useDistrictClubsHealth(districtId || '42')

  // Use sample data for demonstration since backend might not be available
  const displayClubs = clubs.length > 0 ? clubs : sampleClubs

  // If clubName is provided in URL, pre-select that club
  React.useEffect(() => {
    if (clubName && displayClubs.length > 0) {
      const club = displayClubs.find(
        (c: ClubHealthResult) =>
          c.club_name.toLowerCase().replace(/\s+/g, '-') ===
          clubName.toLowerCase()
      )
      if (club) {
        setSelectedClub(club)
      }
    }
  }, [clubName, displayClubs])

  const handleClubSelect = (club: ClubHealthResult) => {
    setSelectedClub(club)
    console.log('Selected club:', club)
  }

  const handleNavigateToClub = (clubName: string) => {
    const clubSlug = clubName.toLowerCase().replace(/\s+/g, '-')
    if (districtId) {
      navigate(`/districts/${districtId}/club-health/${clubSlug}`)
    } else {
      navigate(`/club-health/${clubSlug}`)
    }
  }

  const handleExportData = (format: 'csv' | 'pdf' | 'json', data?: unknown) => {
    console.log(`Exporting data in ${format} format:`, data)
    // Export functionality would be implemented here
  }

  const getPageTitle = () => {
    if (districtId) {
      return `District ${districtId} Club Health`
    }
    return 'Club Health Dashboard'
  }

  const getBackLink = () => {
    if (districtId) {
      return `/district/${districtId}`
    }
    return '/'
  }

  const getBackLinkText = () => {
    if (districtId) {
      return `Back to District ${districtId}`
    }
    return 'Back to Rankings'
  }

  return (
    <div className="min-h-screen bg-gray-50" id="main-content">
      <div className="container mx-auto px-4 py-4 sm:py-8">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <button
            onClick={() => navigate(getBackLink())}
            className="flex items-center gap-2 text-tm-loyal-blue hover:text-tm-loyal-blue-80 font-tm-headline font-medium transition-colors mb-4"
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
                d="M15 19l-7-7 7-7"
              />
            </svg>
            {getBackLinkText()}
          </button>

          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-tm-headline font-bold text-tm-black">
                {getPageTitle()}
              </h1>
              <p className="text-sm sm:text-base font-tm-body text-gray-600 mt-1">
                Club Health Classification & Analytics
              </p>
            </div>

            {/* View Toggle */}
            <div className="flex items-center gap-2 bg-tm-cool-gray bg-opacity-20 rounded-lg p-1">
              <button
                onClick={() => setCurrentView('matrix')}
                className={`px-4 py-2 rounded-md font-tm-body font-medium transition-colors ${
                  currentView === 'matrix'
                    ? 'bg-tm-loyal-blue text-tm-white'
                    : 'text-tm-cool-gray hover:text-tm-black'
                }`}
              >
                Health Matrix
              </button>
              <button
                onClick={() => setCurrentView('analytics')}
                className={`px-4 py-2 rounded-md font-tm-body font-medium transition-colors ${
                  currentView === 'analytics'
                    ? 'bg-tm-loyal-blue text-tm-white'
                    : 'text-tm-cool-gray hover:text-tm-black'
                }`}
              >
                Analytics
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-sm">
          {currentView === 'matrix' ? (
            <div className="p-6">
              <HealthMatrixDashboard
                clubs={displayClubs}
                districtId={districtId}
                onClubSelect={handleClubSelect}
                loading={loading && clubs.length === 0}
                error={error?.message || undefined}
              />
            </div>
          ) : (
            <div className="p-6">
              <DistrictAnalyticsDashboard
                districtId={districtId || '42'}
                clubs={displayClubs}
                onClubSelect={handleClubSelect}
                onExportData={handleExportData}
                onNavigateToClub={handleNavigateToClub}
                loading={loading && clubs.length === 0}
                error={error?.message || undefined}
              />
            </div>
          )}
        </div>

        {/* Club Detail Modal */}
        <ClubHealthDetailModal
          club={selectedClub}
          onClose={() => setSelectedClub(null)}
        />
      </div>
    </div>
  )
}

export default ClubHealthDashboardPage
