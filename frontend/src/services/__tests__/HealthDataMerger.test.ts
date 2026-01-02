/**
 * Tests for HealthDataMerger service
 */

import { describe, it, expect } from 'vitest'
import { HealthDataMerger } from '../HealthDataMerger'
import type { ClubHealthResult } from '../../types/clubHealth'
import type { ProcessedClubTrend } from '../../components/filters/types'

describe('HealthDataMerger', () => {
  const mockClubTrends: ProcessedClubTrend[] = [
    {
      clubId: '1',
      clubName: 'Test Club One',
      divisionId: 'D1',
      divisionName: 'Division 1',
      areaId: 'A1',
      areaName: 'Area 1',
      membershipTrend: [{ date: '2024-01-01', count: 20 }],
      dcpGoalsTrend: [{ date: '2024-01-01', goalsAchieved: 5 }],
      currentStatus: 'healthy',
      riskFactors: [],
      latestMembership: 20,
      latestDcpGoals: 5,
      distinguishedOrder: 1,
    },
    {
      clubId: '2',
      clubName: 'Another Test Club',
      divisionId: 'D1',
      divisionName: 'Division 1',
      areaId: 'A1',
      areaName: 'Area 1',
      membershipTrend: [{ date: '2024-01-01', count: 15 }],
      dcpGoalsTrend: [{ date: '2024-01-01', goalsAchieved: 2 }],
      currentStatus: 'at-risk',
      riskFactors: ['Low membership'],
      latestMembership: 15,
      latestDcpGoals: 2,
      distinguishedOrder: 2,
    },
  ]

  const mockHealthResults: ClubHealthResult[] = [
    {
      club_name: 'Test Club One',
      health_status: 'Thriving',
      reasons: ['Good membership', 'Meeting goals'],
      trajectory: 'Recovering',
      trajectory_reasons: ['Membership growing'],
      composite_key: 'Thriving__Recovering',
      composite_label: 'Thriving · Recovering',
      members_delta_mom: 2,
      dcp_delta_mom: 1,
      metadata: {
        evaluation_date: '2024-01-01T10:00:00Z',
        processing_time_ms: 100,
        rule_version: '1.0',
      },
    },
  ]

  describe('mergeClubData', () => {
    it('should merge club data with health results', () => {
      const result = HealthDataMerger.mergeClubData(
        mockClubTrends,
        mockHealthResults
      )

      expect(result).toHaveLength(2)

      // First club should have health data
      expect(result[0].healthStatus).toBe('Thriving')
      expect(result[0].trajectory).toBe('Recovering')
      expect(result[0].healthReasons).toEqual([
        'Good membership',
        'Meeting goals',
      ])
      expect(result[0].trajectoryReasons).toEqual(['Membership growing'])
      expect(result[0].healthDataAge).toBeGreaterThan(0)
      expect(result[0].healthStatusOrder).toBe(2) // Thriving = 2
      expect(result[0].trajectoryOrder).toBe(2) // Recovering = 2

      // Second club should have no health data (unknown)
      expect(result[1].healthStatus).toBeUndefined()
      expect(result[1].trajectory).toBeUndefined()
      expect(result[1].healthStatusOrder).toBe(3) // Unknown = 3
      expect(result[1].trajectoryOrder).toBe(3) // Unknown = 3
    })

    it('should handle empty health results', () => {
      const result = HealthDataMerger.mergeClubData(mockClubTrends, [])

      expect(result).toHaveLength(2)
      result.forEach(club => {
        expect(club.healthStatus).toBeUndefined()
        expect(club.trajectory).toBeUndefined()
        expect(club.healthStatusOrder).toBe(3) // Unknown
        expect(club.trajectoryOrder).toBe(3) // Unknown
      })
    })
  })

  describe('calculateDataAge', () => {
    it('should calculate age in hours correctly', () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      const age = HealthDataMerger.calculateDataAge(oneHourAgo)
      expect(age).toBe(1)
    })

    it('should handle invalid timestamps', () => {
      expect(HealthDataMerger.calculateDataAge('')).toBe(9999)
      expect(HealthDataMerger.calculateDataAge('invalid')).toBe(9999)
    })

    it('should handle future dates', () => {
      const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString()
      const age = HealthDataMerger.calculateDataAge(futureDate)
      expect(age).toBe(0) // Should not return negative values
    })
  })

  describe('getHealthDataStatus', () => {
    it('should return loading status when loading', () => {
      const status = HealthDataMerger.getHealthDataStatus([], true)
      expect(status.isLoading).toBe(true)
      expect(status.isError).toBe(false)
    })

    it('should return error status when error occurs', () => {
      const error = new Error('Test error')
      const status = HealthDataMerger.getHealthDataStatus([], false, error)
      expect(status.isError).toBe(true)
      expect(status.errorMessage).toBe('Test error')
    })

    it('should detect stale data', () => {
      const staleHealthResults: ClubHealthResult[] = [
        {
          ...mockHealthResults[0],
          metadata: {
            ...mockHealthResults[0].metadata,
            evaluation_date: new Date(
              Date.now() - 25 * 60 * 60 * 1000
            ).toISOString(), // 25 hours ago
          },
        },
      ]

      const status = HealthDataMerger.getHealthDataStatus(
        staleHealthResults,
        false
      )
      expect(status.isStale).toBe(true)
      expect(status.isOutdated).toBe(false)
    })

    it('should detect outdated data', () => {
      const outdatedHealthResults: ClubHealthResult[] = [
        {
          ...mockHealthResults[0],
          metadata: {
            ...mockHealthResults[0].metadata,
            evaluation_date: new Date(
              Date.now() - 8 * 24 * 60 * 60 * 1000
            ).toISOString(), // 8 days ago
          },
        },
      ]

      const status = HealthDataMerger.getHealthDataStatus(
        outdatedHealthResults,
        false
      )
      expect(status.isStale).toBe(true)
      expect(status.isOutdated).toBe(true)
    })

    it('should handle missing timestamps', () => {
      const invalidHealthResults: ClubHealthResult[] = [
        {
          ...mockHealthResults[0],
          metadata: {
            ...mockHealthResults[0].metadata,
            evaluation_date: '',
          },
        },
      ]

      const status = HealthDataMerger.getHealthDataStatus(
        invalidHealthResults,
        false
      )
      expect(status.isStale).toBe(true)
      expect(status.isOutdated).toBe(true)
      expect(status.lastUpdated).toBeUndefined()
    })
  })
})
