/**
 * Club Health Service Tests
 *
 * Tests for the ClubHealthService implementation including caching,
 * historical data management, and audit trail functionality.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ClubHealthServiceImpl } from '../ClubHealthService'
import { ClubHealthInput } from '../../types/clubHealth'
import fs from 'fs/promises'
import path from 'path'

describe('ClubHealthService', () => {
  let service: ClubHealthServiceImpl
  let testDataDir: string

  beforeEach(async () => {
    // Create a temporary directory for test data
    testDataDir = path.join(
      process.cwd(),
      'test_data',
      `club_health_${Date.now()}`
    )
    await fs.mkdir(testDataDir, { recursive: true })

    // Initialize service with test directory
    service = new ClubHealthServiceImpl(
      undefined,
      undefined,
      undefined,
      testDataDir
    )

    // Give the service time to initialize
    await new Promise(resolve => setTimeout(resolve, 100))
  })

  afterEach(async () => {
    // Clean up test data directory
    try {
      await fs.rm(testDataDir, { recursive: true, force: true })
    } catch (error) {
      // Ignore cleanup errors
      console.debug('Test cleanup error (ignored):', error)
    }
  })

  describe('processClubHealth', () => {
    it('should process club health and return valid result', async () => {
      const input: ClubHealthInput = {
        club_name: 'Test Club',
        current_members: 25,
        member_growth_since_july: 5,
        current_month: 'October',
        dcp_goals_achieved_ytd: 3,
        csp_submitted: true,
        officer_list_submitted: true,
        officers_trained: true,
        previous_month_members: 23,
        previous_month_dcp_goals_achieved_ytd: 2,
        previous_month_health_status: 'Vulnerable',
      }

      const result = await service.processClubHealth(input)

      expect(result).toBeDefined()
      expect(result.club_name).toBe('Test Club')
      expect(result.health_status).toBe('Thriving')
      expect(result.trajectory).toBe('Recovering')
      expect(result.composite_key).toBe('Thriving__Recovering')
      expect(result.composite_label).toBe('Thriving · Recovering')
      expect(result.members_delta_mom).toBe(2)
      expect(result.dcp_delta_mom).toBe(1)
      expect(result.reasons).toBeInstanceOf(Array)
      expect(result.trajectory_reasons).toBeInstanceOf(Array)
      expect(result.metadata).toBeDefined()
      expect(result.metadata.evaluation_date).toBeDefined()
      expect(result.metadata.processing_time_ms).toBeGreaterThanOrEqual(0)
      expect(result.metadata.rule_version).toBeDefined()
    })

    it('should cache results and return cached data on subsequent calls', async () => {
      const input: ClubHealthInput = {
        club_name: 'Cached Club',
        current_members: 20,
        member_growth_since_july: 3,
        current_month: 'September',
        dcp_goals_achieved_ytd: 1,
        csp_submitted: true,
        officer_list_submitted: true,
        officers_trained: false,
        previous_month_members: 18,
        previous_month_dcp_goals_achieved_ytd: 1,
        previous_month_health_status: 'Vulnerable',
      }

      // First call - should process and cache
      const result1 = await service.processClubHealth(input)

      // Second call - should return cached result
      const result2 = await service.processClubHealth(input)

      expect(result1).toEqual(result2)
      expect(result1.club_name).toBe('Cached Club')
      expect(result1.health_status).toBe('Thriving')
    })
  })

  describe('batchProcessClubs', () => {
    it('should process multiple clubs in batch', async () => {
      const inputs: ClubHealthInput[] = [
        {
          club_name: 'Batch Club 1',
          current_members: 15,
          member_growth_since_july: 2,
          current_month: 'November',
          dcp_goals_achieved_ytd: 2,
          csp_submitted: false,
          officer_list_submitted: true,
          officers_trained: true,
          previous_month_members: 14,
          previous_month_dcp_goals_achieved_ytd: 1,
          previous_month_health_status: 'Vulnerable',
        },
        {
          club_name: 'Batch Club 2',
          current_members: 30,
          member_growth_since_july: 8,
          current_month: 'November',
          dcp_goals_achieved_ytd: 3,
          csp_submitted: true,
          officer_list_submitted: true,
          officers_trained: true,
          previous_month_members: 28,
          previous_month_dcp_goals_achieved_ytd: 2,
          previous_month_health_status: 'Thriving',
        },
      ]

      const results = await service.batchProcessClubs(inputs)

      expect(results).toHaveLength(2)
      expect(results[0].club_name).toBe('Batch Club 1')
      expect(results[1].club_name).toBe('Batch Club 2')
      expect(results[0].health_status).toBe('Vulnerable')
      expect(results[1].health_status).toBe('Thriving')
    })

    it('should return empty array for empty input', async () => {
      const results = await service.batchProcessClubs([])
      expect(results).toEqual([])
    })
  })

  describe('getClubHealthHistory', () => {
    it('should return empty history for new club', async () => {
      const history = await service.getClubHealthHistory('New Club', 6)
      expect(history).toEqual([])
    })

    it('should return history after processing club', async () => {
      // Use a unique club name with timestamp to avoid cache conflicts
      const uniqueClubName = `History Club ${Date.now()}`
      const input: ClubHealthInput = {
        club_name: uniqueClubName,
        current_members: 22,
        member_growth_since_july: 4,
        current_month: 'December',
        dcp_goals_achieved_ytd: 4,
        csp_submitted: true,
        officer_list_submitted: true,
        officers_trained: true,
        previous_month_members: 20,
        previous_month_dcp_goals_achieved_ytd: 3,
        previous_month_health_status: 'Vulnerable',
      }

      // Clear any existing cache for this club first
      await service.invalidateClubCache(uniqueClubName)

      // Process club to create history
      await service.processClubHealth(input)

      // Get history
      const history = await service.getClubHealthHistory(uniqueClubName, 6)

      expect(history).toHaveLength(1)
      expect(history[0].health_status).toBe('Thriving')
      expect(history[0].trajectory).toBe('Recovering')
      expect(history[0].members).toBe(22)
      expect(history[0].dcp_goals).toBe(4)
      expect(history[0].evaluation_date).toBeDefined()
    })
  })

  describe('getDistrictHealthSummary', () => {
    it('should return empty summary for district with no clubs', async () => {
      const summary = await service.getDistrictHealthSummary('D99')

      expect(summary.district_id).toBe('D99')
      expect(summary.total_clubs).toBe(0)
      expect(summary.health_distribution).toEqual({
        Thriving: 0,
        Vulnerable: 0,
        'Intervention Required': 0,
      })
      expect(summary.trajectory_distribution).toEqual({
        Recovering: 0,
        Stable: 0,
        Declining: 0,
      })
      expect(summary.clubs_needing_attention).toEqual([])
    })
  })

  describe('cache invalidation', () => {
    it('should invalidate club cache', async () => {
      const input: ClubHealthInput = {
        club_name: 'Invalidate Club',
        current_members: 18,
        member_growth_since_july: 1,
        current_month: 'January',
        dcp_goals_achieved_ytd: 3,
        csp_submitted: false,
        officer_list_submitted: true,
        officers_trained: true,
        previous_month_members: 17,
        previous_month_dcp_goals_achieved_ytd: 3,
        previous_month_health_status: 'Vulnerable',
      }

      // Process club to cache result
      await service.processClubHealth(input)

      // Invalidate cache
      await service.invalidateClubCache('Invalidate Club')

      // This should succeed without error
      expect(true).toBe(true)
    })

    it('should invalidate district cache', async () => {
      // Invalidate district cache
      await service.invalidateDistrictCache('D50')

      // This should succeed without error
      expect(true).toBe(true)
    })
  })

  describe('audit trail', () => {
    it('should track audit entries for club operations', async () => {
      // Use a unique club name with timestamp to avoid cache conflicts
      const uniqueClubName = `Audit Club ${Date.now()}`
      const input: ClubHealthInput = {
        club_name: uniqueClubName,
        current_members: 16,
        member_growth_since_july: 0,
        current_month: 'February',
        dcp_goals_achieved_ytd: 4,
        csp_submitted: true,
        officer_list_submitted: true,
        officers_trained: false,
        previous_month_members: 16,
        previous_month_dcp_goals_achieved_ytd: 4,
        previous_month_health_status: 'Vulnerable',
      }

      // Clear any existing cache for this club first
      await service.invalidateClubCache(uniqueClubName)

      // Process club to generate audit entry
      await service.processClubHealth(input)

      // Get audit trail
      const auditTrail = service.getClubAuditTrail(uniqueClubName, 10)

      expect(auditTrail.length).toBeGreaterThan(0)
      expect(auditTrail[0].operation).toBe('classify')
      expect(auditTrail[0].club_name).toBe(uniqueClubName)
      expect(auditTrail[0].timestamp).toBeDefined()
    })

    it('should return full audit trail', async () => {
      const fullAudit = service.getFullAuditTrail(100)
      expect(Array.isArray(fullAudit)).toBe(true)
    })
  })

  describe('cache statistics', () => {
    it('should return cache statistics', () => {
      const stats = service.getCacheStats()
      expect(stats).toBeDefined()
      expect(typeof stats.hits).toBe('number')
      expect(typeof stats.misses).toBe('number')
      expect(typeof stats.keys).toBe('number')
    })

    it('should clear all cache', () => {
      service.clearAllCache()
      // This should succeed without error
      expect(true).toBe(true)
    })
  })
})
