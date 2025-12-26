import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../services/api'

/**
 * Interface for club trend data
 */
export interface ClubTrend {
  clubId: string
  clubName: string
  divisionId: string
  divisionName: string
  areaId: string
  areaName: string
  membershipTrend: Array<{ date: string; count: number }>
  dcpGoalsTrend: Array<{ date: string; goalsAchieved: number }>
  currentStatus: 'healthy' | 'at-risk' | 'critical'
  riskFactors: string[]
  distinguishedLevel?: 'President' | 'Select' | 'Distinguished'
}

/**
 * Hook to fetch club-specific trend data
 * Retrieves membership trends, DCP goal progress, and risk assessment for a specific club
 *
 * @param districtId - The district ID the club belongs to
 * @param clubId - The club ID to fetch trends for
 * @param enabled - Whether the query should be enabled (default: true)
 * @returns Query result with club trend data
 *
 * Requirements: 3.1, 3.2, 4.4
 */
export const useClubTrends = (
  districtId: string | null,
  clubId: string | null,
  enabled: boolean = true
) => {
  return useQuery<ClubTrend, Error>({
    queryKey: ['clubTrends', districtId, clubId],
    queryFn: async () => {
      if (!districtId || !clubId) {
        throw new Error('District ID and club ID are required')
      }

      const response = await apiClient.get<ClubTrend>(
        `/districts/${districtId}/clubs/${clubId}/trends`
      )
      return response.data
    },
    enabled: enabled && !!districtId && !!clubId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  })
}

/**
 * Hook to fetch at-risk clubs for a district
 * Returns list of clubs that are at-risk or critical based on various factors
 *
 * @param districtId - The district ID to fetch at-risk clubs for
 * @param enabled - Whether the query should be enabled (default: true)
 * @returns Query result with at-risk clubs data
 *
 * Requirements: 4.4
 */
export const useAtRiskClubs = (
  districtId: string | null,
  enabled: boolean = true
) => {
  return useQuery<
    {
      districtId: string
      totalAtRiskClubs: number
      criticalClubs: number
      atRiskClubs: number
      clubs: ClubTrend[]
    },
    Error
  >({
    queryKey: ['atRiskClubs', districtId],
    queryFn: async () => {
      if (!districtId) {
        throw new Error('District ID is required')
      }

      const response = await apiClient.get(
        `/districts/${districtId}/at-risk-clubs`
      )
      return response.data
    },
    enabled: enabled && !!districtId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  })
}
