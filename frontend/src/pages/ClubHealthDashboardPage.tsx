import React, { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { HealthMatrixDashboard } from '../components/HealthMatrixDashboard'
import { DistrictAnalyticsDashboard } from '../components/DistrictAnalyticsDashboard'
import { ClubHealthDetailModal } from '../components/ClubHealthDetailModal'
import { ClubHealthResult } from '../types/clubHealth'
import {
  useDistrictClubsHealth,
  useDistrictClubHealthRefresh,
} from '../hooks/useClubHealth'

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

  // Use the hook for real data
  // Use districtId from URL params if available, otherwise default to 'D42' (proper format)
  const {
    data: clubsData,
    isLoading: loading,
    error,
  } = useDistrictClubsHealth(districtId || 'D42')

  // Ensure clubs is always an array - memoized to prevent useEffect dependency issues
  const clubs = useMemo(() => {
    return Array.isArray(clubsData) ? clubsData : []
  }, [clubsData])

  // Use refresh hooks for populating real data
  const refreshDistrictMutation = useDistrictClubHealthRefresh()

  // Show loading state when fetching data
  const isLoadingData = loading

  // Handle refresh of district data
  const handleRefreshData = async () => {
    if (districtId) {
      try {
        await refreshDistrictMutation.mutateAsync(districtId)
      } catch (error) {
        console.error('Failed to refresh district data:', error)
      }
    }
  }

  // If clubName is provided in URL, pre-select that club
  React.useEffect(() => {
    if (clubName && clubs.length > 0) {
      const club = clubs.find(
        (c: ClubHealthResult) =>
          c.club_name.toLowerCase().replace(/\s+/g, '-') ===
          clubName.toLowerCase()
      )
      if (club) {
        setSelectedClub(club)
      }
    }
  }, [clubName, clubs])

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

            <div className="flex flex-col sm:flex-row gap-2">
              {/* Refresh Data Button */}
              {districtId && (
                <button
                  onClick={handleRefreshData}
                  disabled={refreshDistrictMutation.isPending}
                  className="px-4 py-2 bg-tm-loyal-blue text-tm-white rounded-md font-tm-body font-medium hover:bg-tm-loyal-blue-80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {refreshDistrictMutation.isPending
                    ? 'Refreshing...'
                    : 'Refresh Real Data'}
                </button>
              )}

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
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-sm">
          {currentView === 'matrix' ? (
            <div className="p-6">
              <HealthMatrixDashboard
                clubs={clubs}
                districtId={districtId}
                onClubSelect={handleClubSelect}
                loading={isLoadingData}
                error={error?.message || undefined}
              />
            </div>
          ) : (
            <div className="p-6">
              <DistrictAnalyticsDashboard
                districtId={districtId || 'D42'}
                clubs={clubs}
                onClubSelect={handleClubSelect}
                onExportData={handleExportData}
                onNavigateToClub={handleNavigateToClub}
                loading={isLoadingData}
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
