/**
 * Club Health Page Component
 *
 * Main page component for the club health dashboard
 * Demonstrates the health matrix visualization with sample data
 */

import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import { ClubHealthDashboard } from '../components'
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

export const ClubHealthPage: React.FC = () => {
  const { districtId, clubName } = useParams<{
    districtId?: string
    clubName?: string
  }>()
  const [selectedClub, setSelectedClub] = useState<ClubHealthResult | null>(
    null
  )

  // Use the hook for real data (currently will show loading/error states)
  // Use districtId from URL params if available, otherwise default to '42'
  const {
    data: clubs = [],
    isLoading: loading,
    error,
  } = useDistrictClubsHealth(districtId || '42')

  const handleClubSelect = (club: ClubHealthResult) => {
    setSelectedClub(club)
    console.log('Selected club:', club)
    // In a real application, this would open a detailed modal or navigate to a detail page
  }

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

  return (
    <div className="min-h-screen bg-gray-50">
      <ClubHealthDashboard
        clubs={displayClubs}
        districtId={districtId || '42'}
        onClubSelect={handleClubSelect}
        loading={loading && clubs.length === 0} // Only show loading if no data
        error={error?.message || undefined}
        availableDistricts={['42', '43', '44']}
        availableDivisions={['A', 'B', 'C', 'D']}
        availableAreas={['1', '2', '3', '4', '5']}
      />

      {/* Selected Club Debug Info */}
      {selectedClub && (
        <div className="fixed bottom-4 right-4 bg-white border border-tm-cool-gray rounded-lg p-4 shadow-lg max-w-sm">
          <h4
            className="font-semibold text-tm-black mb-2"
            style={{ fontFamily: 'Montserrat, sans-serif' }}
          >
            Selected Club
          </h4>
          <div
            className="text-sm text-tm-cool-gray space-y-1"
            style={{ fontFamily: 'Source Sans 3, sans-serif' }}
          >
            <div>
              <strong>Name:</strong> {selectedClub.club_name}
            </div>
            <div>
              <strong>Status:</strong> {selectedClub.health_status}
            </div>
            <div>
              <strong>Trajectory:</strong> {selectedClub.trajectory}
            </div>
            <div>
              <strong>Members Δ:</strong>{' '}
              {selectedClub.members_delta_mom > 0 ? '+' : ''}
              {selectedClub.members_delta_mom}
            </div>
          </div>
          <button
            onClick={() => setSelectedClub(null)}
            className="mt-2 text-xs text-tm-true-maroon hover:text-tm-true-maroon/80"
            style={{ fontFamily: 'Source Sans 3, sans-serif' }}
          >
            Close
          </button>
        </div>
      )}
    </div>
  )
}

export default ClubHealthPage
