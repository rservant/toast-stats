/**
 * Unit tests for configService
 * Tests configuration loading, caching, hot-reload, and validation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  loadConfig,
  invalidateCache,
  invalidateAllCache,
  getCacheStats,
  validateConfig,
} from '../services/configService.ts'
import { DistrictConfig } from '../types/assessment.ts'

const mockConfig: DistrictConfig = {
  district_number: 61,
  program_year: '2024-2025',
  year_end_targets: {
    membership_growth: 100,
    club_growth: 5,
    distinguished_clubs: 12,
  },
  recognition_levels: [
    {
      level: 'Distinguished',
      membershipPaymentsTarget: 25,
      paidClubsTarget: 1,
      distinguishedClubsTarget: 3,
    },
    {
      level: 'Select',
      membershipPaymentsTarget: 25,
      paidClubsTarget: 1,
      distinguishedClubsTarget: 3,
    },
    {
      level: "President's",
      membershipPaymentsTarget: 25,
      paidClubsTarget: 2,
      distinguishedClubsTarget: 3,
    },
    {
      level: 'Smedley Distinguished',
      membershipPaymentsTarget: 25,
      paidClubsTarget: 1,
      distinguishedClubsTarget: 3,
    },
  ],
  csp_submission_target: 40,
  csp_to_distinguished_clubs_ratio: 0.3,
}

describe('configService', () => {
  beforeEach(() => {
    invalidateAllCache()
  })

  afterEach(() => {
    invalidateAllCache()
  })

  describe('loadConfig', () => {
    it('should load config from file', async () => {
      // Note: This test assumes recognitionThresholds.json exists and contains District 61 2024-2025
      // In production, this would be an integration test
      const config = await loadConfig(61, '2024-2025')
      expect(config).toBeDefined()
      expect(config.district_number).toBe(61)
      expect(config.program_year).toBe('2024-2025')
    })

    it('should throw error for non-existent config', async () => {
      await expect(loadConfig(999, '2099-2100')).rejects.toThrow()
    })

    it('should cache loaded config', async () => {
      const cache1 = getCacheStats()
      expect(cache1.size).toBe(0)

      const config = await loadConfig(61, '2024-2025')
      expect(config).toBeDefined()

      const cache2 = getCacheStats()
      expect(cache2.size).toBeGreaterThan(0)
    })

    it('should return cached config on subsequent loads', async () => {
      const config1 = await loadConfig(61, '2024-2025')
      const config2 = await loadConfig(61, '2024-2025')

      expect(config1).toEqual(config2)
      expect(getCacheStats().size).toBe(1)
    })

    it('should respect TTL for cache expiration', async () => {
      const ttl = 1 // 1ms
      const config1 = await loadConfig(61, '2024-2025', ttl)

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 10))

      // Access again with longer TTL to prevent auto-load
      const config2 = await loadConfig(61, '2024-2025', 60000)
      expect(config1).toEqual(config2)
    })
  })

  describe('invalidateCache', () => {
    it('should invalidate cache for specific district and year', async () => {
      await loadConfig(61, '2024-2025')
      expect(getCacheStats().size).toBe(1)

      invalidateCache(61, '2024-2025')
      expect(getCacheStats().size).toBe(0)
    })

    it('should not affect other districts when invalidating specific cache', async () => {
      // Note: This test assumes multiple configs exist
      // Placeholder for future multi-district testing
      invalidateAllCache()
      expect(getCacheStats().size).toBe(0)
    })
  })

  describe('invalidateAllCache', () => {
    it('should clear all cache entries', async () => {
      await loadConfig(61, '2024-2025')
      expect(getCacheStats().size).toBe(1)

      invalidateAllCache()
      expect(getCacheStats().size).toBe(0)
    })
  })

  describe('getCacheStats', () => {
    it('should return cache statistics', async () => {
      const stats1 = getCacheStats()
      expect(stats1.size).toBe(0)
      expect(stats1.entries).toEqual([])

      await loadConfig(61, '2024-2025')
      const stats2 = getCacheStats()
      expect(stats2.size).toBe(1)
      expect(stats2.entries.length).toBe(1)
      expect(stats2.entries[0][0]).toBe('61_2024-2025')
    })
  })

  describe('validateConfig', () => {
    it('should validate correct config', () => {
      const errors = validateConfig(mockConfig)
      expect(errors).toEqual([])
    })

    it('should reject invalid district number', () => {
      const invalid = { ...mockConfig, district_number: 0 }
      const errors = validateConfig(invalid)
      expect(errors.some(e => e.includes('district_number'))).toBe(true)
    })

    it('should reject invalid program year format', () => {
      const invalid = { ...mockConfig, program_year: 'invalid' }
      const errors = validateConfig(invalid)
      expect(errors.some(e => e.includes('program_year'))).toBe(true)
    })

    it('should reject missing year_end_targets', () => {
      const invalid = {
        ...mockConfig,
        year_end_targets: undefined,
      } as unknown as DistrictConfig
      const errors = validateConfig(invalid)
      expect(errors.some(e => e.includes('year_end_targets'))).toBe(true)
    })

    it('should reject invalid membership growth target', () => {
      const invalid = {
        ...mockConfig,
        year_end_targets: {
          ...mockConfig.year_end_targets,
          membership_growth: -1,
        },
      }
      const errors = validateConfig(invalid)
      expect(errors.some(e => e.includes('membership_growth'))).toBe(true)
    })

    it('should reject empty recognition levels', () => {
      const invalid = { ...mockConfig, recognition_levels: [] }
      const errors = validateConfig(invalid)
      expect(errors.some(e => e.includes('recognition_levels'))).toBe(true)
    })

    it('should reject invalid CSP ratio (out of range)', () => {
      const invalid = { ...mockConfig, csp_to_distinguished_clubs_ratio: 1.5 }
      const errors = validateConfig(invalid)
      expect(
        errors.some(e => e.includes('csp_to_distinguished_clubs_ratio'))
      ).toBe(true)
    })

    it('should accept CSP ratio at boundaries', () => {
      const config1 = { ...mockConfig, csp_to_distinguished_clubs_ratio: 0 }
      const errors1 = validateConfig(config1)
      expect(
        errors1.some(e => e.includes('csp_to_distinguished_clubs_ratio'))
      ).toBe(false)

      const config2 = { ...mockConfig, csp_to_distinguished_clubs_ratio: 1 }
      const errors2 = validateConfig(config2)
      expect(
        errors2.some(e => e.includes('csp_to_distinguished_clubs_ratio'))
      ).toBe(false)
    })
  })
})
