/**
 * Property-Based Tests for ReconciliationConfigService
 * 
 * **Feature: month-end-data-reconciliation, Property 8: Configuration Compliance**
 * **Validates: Requirements 6.1, 6.2, 6.3**
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ReconciliationConfigService } from '../ReconciliationConfigService'
import { ReconciliationConfig } from '../../types/reconciliation'

// Mock dependencies
vi.mock('../CacheService', () => ({
  cacheService: {
    get: vi.fn(),
    set: vi.fn(),
    invalidate: vi.fn()
  }
}))

vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn()
}))

vi.mock('path', () => ({
  resolve: vi.fn().mockReturnValue('/test/path/reconciliation-config.json')
}))

describe('ReconciliationConfigService - Property-Based Tests', () => {
  let configService: ReconciliationConfigService

  beforeEach(() => {
    configService = new ReconciliationConfigService()
    vi.clearAllMocks()
  })

  // Property test generators
  const generateValidConfig = (seed: number = Math.random()): ReconciliationConfig => {
    const maxReconciliationDays = Math.floor(seed * 59) + 1 // 1-60 days (valid range)
    const stabilityPeriodDays = Math.min(Math.floor(seed * maxReconciliationDays) + 1, maxReconciliationDays) // 1 to maxReconciliationDays
    
    return {
      maxReconciliationDays,
      stabilityPeriodDays,
      checkFrequencyHours: Math.floor(seed * 167) + 1, // 1-168 hours (valid range)
      significantChangeThresholds: {
        membershipPercent: seed * 100, // 0-100%
        clubCountAbsolute: Math.floor(seed * 100), // 0-100 clubs (non-negative integer)
        distinguishedPercent: seed * 100 // 0-100%
      },
      autoExtensionEnabled: seed > 0.5,
      maxExtensionDays: Math.floor(seed * 30) // 0-30 days (valid range)
    }
  }

  const generateInvalidConfig = (seed: number = Math.random(), violationType: string): ReconciliationConfig => {
    const baseConfig = generateValidConfig(seed)
    
    switch (violationType) {
      case 'maxReconciliationDays_negative':
        return { ...baseConfig, maxReconciliationDays: -Math.floor(seed * 10) - 1 }
      case 'maxReconciliationDays_zero':
        return { ...baseConfig, maxReconciliationDays: 0 }
      case 'maxReconciliationDays_too_large':
        return { ...baseConfig, maxReconciliationDays: Math.floor(seed * 40) + 61 } // 61-100
      case 'maxReconciliationDays_float':
        return { ...baseConfig, maxReconciliationDays: seed * 30 + 0.5 } // Non-integer
      case 'stabilityPeriodDays_negative':
        return { ...baseConfig, stabilityPeriodDays: -Math.floor(seed * 10) - 1 }
      case 'stabilityPeriodDays_zero':
        return { ...baseConfig, stabilityPeriodDays: 0 }
      case 'stabilityPeriodDays_exceeds_max':
        return { ...baseConfig, stabilityPeriodDays: baseConfig.maxReconciliationDays + Math.floor(seed * 10) + 1 }
      case 'checkFrequencyHours_negative':
        return { ...baseConfig, checkFrequencyHours: -Math.floor(seed * 10) - 1 }
      case 'checkFrequencyHours_zero':
        return { ...baseConfig, checkFrequencyHours: 0 }
      case 'checkFrequencyHours_too_large':
        return { ...baseConfig, checkFrequencyHours: Math.floor(seed * 100) + 169 } // > 168
      case 'membershipPercent_negative':
        return { 
          ...baseConfig, 
          significantChangeThresholds: { 
            ...baseConfig.significantChangeThresholds, 
            membershipPercent: -(seed * 50 + 1) // Ensure it's always negative
          } 
        }
      case 'membershipPercent_too_large':
        return { 
          ...baseConfig, 
          significantChangeThresholds: { 
            ...baseConfig.significantChangeThresholds, 
            membershipPercent: 100 + (seed * 50) + 1 // Ensure it's always > 100
          } 
        }
      case 'clubCountAbsolute_negative':
        return { 
          ...baseConfig, 
          significantChangeThresholds: { 
            ...baseConfig.significantChangeThresholds, 
            clubCountAbsolute: -(Math.floor(seed * 10) + 1) // Ensure it's always negative
          } 
        }
      case 'clubCountAbsolute_float':
        return { 
          ...baseConfig, 
          significantChangeThresholds: { 
            ...baseConfig.significantChangeThresholds, 
            clubCountAbsolute: seed * 10 + 0.5 
          } 
        }
      case 'distinguishedPercent_negative':
        return { 
          ...baseConfig, 
          significantChangeThresholds: { 
            ...baseConfig.significantChangeThresholds, 
            distinguishedPercent: -(seed * 50 + 1) // Ensure it's always negative
          } 
        }
      case 'distinguishedPercent_too_large':
        return { 
          ...baseConfig, 
          significantChangeThresholds: { 
            ...baseConfig.significantChangeThresholds, 
            distinguishedPercent: 100 + (seed * 50) + 1 // Ensure it's always > 100
          } 
        }
      case 'autoExtensionEnabled_not_boolean':
        return { ...baseConfig, autoExtensionEnabled: 'true' as unknown as boolean }
      case 'maxExtensionDays_negative':
        return { ...baseConfig, maxExtensionDays: -Math.floor(seed * 10) - 1 }
      case 'maxExtensionDays_too_large':
        return { ...baseConfig, maxExtensionDays: Math.floor(seed * 20) + 31 } // > 30
      case 'maxExtensionDays_float':
        return { ...baseConfig, maxExtensionDays: seed * 20 + 0.5 } // Non-integer
      default:
        return baseConfig
    }
  }

  /**
   * Property 8: Configuration Compliance
   * For any reconciliation job, the system should respect all configured parameters 
   * including maximum periods, thresholds, and monitoring frequency
   */
  describe('Property 8: Configuration Compliance', () => {
    
    it('should accept all valid configurations (Requirement 6.1)', () => {
      // Generate 100 test cases with valid configurations
      for (let i = 0; i < 100; i++) {
        const seed = i / 100
        const config = generateValidConfig(seed)
        
        // Property: All valid configurations should pass validation
        const errors = configService.validateConfig(config)
        expect(errors).toHaveLength(0)
        
        // Property: Valid configurations should maintain their structure
        expect(config.maxReconciliationDays).toBeGreaterThanOrEqual(1)
        expect(config.maxReconciliationDays).toBeLessThanOrEqual(60)
        expect(Number.isInteger(config.maxReconciliationDays)).toBe(true)
        
        expect(config.stabilityPeriodDays).toBeGreaterThanOrEqual(1)
        expect(config.stabilityPeriodDays).toBeLessThanOrEqual(config.maxReconciliationDays)
        expect(Number.isInteger(config.stabilityPeriodDays)).toBe(true)
        
        expect(config.checkFrequencyHours).toBeGreaterThanOrEqual(1)
        expect(config.checkFrequencyHours).toBeLessThanOrEqual(168)
        expect(Number.isInteger(config.checkFrequencyHours)).toBe(true)
        
        expect(config.maxExtensionDays).toBeGreaterThanOrEqual(0)
        expect(config.maxExtensionDays).toBeLessThanOrEqual(30)
        expect(Number.isInteger(config.maxExtensionDays)).toBe(true)
        
        expect(typeof config.autoExtensionEnabled).toBe('boolean')
      }
    })

    it('should reject configurations with invalid maxReconciliationDays (Requirement 6.1)', () => {
      const invalidTypes = [
        'maxReconciliationDays_negative',
        'maxReconciliationDays_zero', 
        'maxReconciliationDays_too_large',
        'maxReconciliationDays_float'
      ]
      
      // Test each invalid type with multiple seeds
      for (const violationType of invalidTypes) {
        for (let i = 0; i < 25; i++) {
          const seed = i / 25
          const config = generateInvalidConfig(seed, violationType)
          
          // Property: Invalid maxReconciliationDays should be rejected
          const errors = configService.validateConfig(config)
          expect(errors.length).toBeGreaterThan(0)
          expect(errors.some(e => e.field === 'maxReconciliationDays')).toBe(true)
        }
      }
    })

    it('should reject configurations with invalid stabilityPeriodDays (Requirement 6.1)', () => {
      const invalidTypes = [
        'stabilityPeriodDays_negative',
        'stabilityPeriodDays_zero',
        'stabilityPeriodDays_exceeds_max'
      ]
      
      // Test each invalid type with multiple seeds
      for (const violationType of invalidTypes) {
        for (let i = 0; i < 25; i++) {
          const seed = i / 25
          const config = generateInvalidConfig(seed, violationType)
          
          // Property: Invalid stabilityPeriodDays should be rejected
          const errors = configService.validateConfig(config)
          expect(errors.length).toBeGreaterThan(0)
          expect(errors.some(e => e.field === 'stabilityPeriodDays')).toBe(true)
        }
      }
    })

    it('should reject configurations with invalid checkFrequencyHours (Requirement 6.3)', () => {
      const invalidTypes = [
        'checkFrequencyHours_negative',
        'checkFrequencyHours_zero',
        'checkFrequencyHours_too_large'
      ]
      
      // Test each invalid type with multiple seeds
      for (const violationType of invalidTypes) {
        for (let i = 0; i < 25; i++) {
          const seed = i / 25
          const config = generateInvalidConfig(seed, violationType)
          
          // Property: Invalid checkFrequencyHours should be rejected
          const errors = configService.validateConfig(config)
          expect(errors.length).toBeGreaterThan(0)
          expect(errors.some(e => e.field === 'checkFrequencyHours')).toBe(true)
        }
      }
    })

    it('should reject configurations with invalid significantChangeThresholds (Requirement 6.2)', () => {
      const invalidTypes = [
        'membershipPercent_negative',
        'membershipPercent_too_large',
        'clubCountAbsolute_negative',
        'clubCountAbsolute_float',
        'distinguishedPercent_negative',
        'distinguishedPercent_too_large'
      ]
      
      // Test each invalid type with multiple seeds
      for (const violationType of invalidTypes) {
        for (let i = 0; i < 15; i++) {
          const seed = i / 15
          const config = generateInvalidConfig(seed, violationType)
          
          // Property: Invalid thresholds should be rejected
          const errors = configService.validateConfig(config)
          expect(errors.length).toBeGreaterThan(0)
          
          if (violationType.includes('membershipPercent')) {
            expect(errors.some(e => e.field === 'significantChangeThresholds.membershipPercent')).toBe(true)
          } else if (violationType.includes('clubCountAbsolute')) {
            expect(errors.some(e => e.field === 'significantChangeThresholds.clubCountAbsolute')).toBe(true)
          } else if (violationType.includes('distinguishedPercent')) {
            expect(errors.some(e => e.field === 'significantChangeThresholds.distinguishedPercent')).toBe(true)
          }
        }
      }
    })

    it('should reject configurations with invalid extension settings (Requirement 6.1)', () => {
      const invalidTypes = [
        'autoExtensionEnabled_not_boolean',
        'maxExtensionDays_negative',
        'maxExtensionDays_too_large',
        'maxExtensionDays_float'
      ]
      
      // Test each invalid type with multiple seeds
      for (const violationType of invalidTypes) {
        for (let i = 0; i < 25; i++) {
          const seed = i / 25
          const config = generateInvalidConfig(seed, violationType)
          
          // Property: Invalid extension settings should be rejected
          const errors = configService.validateConfig(config)
          expect(errors.length).toBeGreaterThan(0)
          
          if (violationType.includes('autoExtensionEnabled')) {
            expect(errors.some(e => e.field === 'autoExtensionEnabled')).toBe(true)
          } else if (violationType.includes('maxExtensionDays')) {
            expect(errors.some(e => e.field === 'maxExtensionDays')).toBe(true)
          }
        }
      }
    })

    it('should validate threshold structure completeness (Requirement 6.2)', () => {
      // Generate 50 test cases
      for (let i = 0; i < 50; i++) {
        const seed = i / 50
        const config = generateValidConfig(seed)
        
        // Property: significantChangeThresholds should have all required fields
        expect(config.significantChangeThresholds).toBeDefined()
        expect(typeof config.significantChangeThresholds.membershipPercent).toBe('number')
        expect(typeof config.significantChangeThresholds.clubCountAbsolute).toBe('number')
        expect(typeof config.significantChangeThresholds.distinguishedPercent).toBe('number')
        
        // Property: All threshold values should be within valid ranges
        expect(config.significantChangeThresholds.membershipPercent).toBeGreaterThanOrEqual(0)
        expect(config.significantChangeThresholds.membershipPercent).toBeLessThanOrEqual(100)
        
        expect(config.significantChangeThresholds.clubCountAbsolute).toBeGreaterThanOrEqual(0)
        expect(Number.isInteger(config.significantChangeThresholds.clubCountAbsolute)).toBe(true)
        
        expect(config.significantChangeThresholds.distinguishedPercent).toBeGreaterThanOrEqual(0)
        expect(config.significantChangeThresholds.distinguishedPercent).toBeLessThanOrEqual(100)
      }
    })

    it('should maintain configuration consistency relationships (Requirement 6.1)', () => {
      // Generate 75 test cases
      for (let i = 0; i < 75; i++) {
        const seed = i / 75
        const config = generateValidConfig(seed)
        
        // Property: stabilityPeriodDays should never exceed maxReconciliationDays
        expect(config.stabilityPeriodDays).toBeLessThanOrEqual(config.maxReconciliationDays)
        
        // Property: All time-based values should be positive integers
        expect(config.maxReconciliationDays).toBeGreaterThan(0)
        expect(config.stabilityPeriodDays).toBeGreaterThan(0)
        expect(config.checkFrequencyHours).toBeGreaterThan(0)
        expect(config.maxExtensionDays).toBeGreaterThanOrEqual(0)
        
        expect(Number.isInteger(config.maxReconciliationDays)).toBe(true)
        expect(Number.isInteger(config.stabilityPeriodDays)).toBe(true)
        expect(Number.isInteger(config.checkFrequencyHours)).toBe(true)
        expect(Number.isInteger(config.maxExtensionDays)).toBe(true)
      }
    })

    it('should handle missing significantChangeThresholds gracefully (Requirement 6.2)', () => {
      // Generate 30 test cases with missing thresholds
      for (let i = 0; i < 30; i++) {
        const seed = i / 30
        const config = generateValidConfig(seed)
        const configWithMissingThresholds = {
          ...config,
          significantChangeThresholds: undefined as unknown
        } as unknown as ReconciliationConfig
        
        // Property: Missing thresholds should be detected and rejected
        const errors = configService.validateConfig(configWithMissingThresholds)
        expect(errors.length).toBeGreaterThan(0)
        expect(errors.some(e => e.field === 'significantChangeThresholds')).toBe(true)
      }
    })

    it('should validate configuration field types strictly (Requirements 6.1, 6.2, 6.3)', () => {
      // Generate 40 test cases with type violations
      for (let i = 0; i < 40; i++) {
        const seed = i / 40
        const baseConfig = generateValidConfig(seed)
        
        // Test various type violations
        const typeViolations = [
          { ...baseConfig, maxReconciliationDays: '15' as unknown as number },
          { ...baseConfig, stabilityPeriodDays: '3' as unknown as number },
          { ...baseConfig, checkFrequencyHours: '24' as unknown as number },
          { ...baseConfig, maxExtensionDays: '5' as unknown as number },
          { ...baseConfig, autoExtensionEnabled: 1 as unknown as boolean },
          { 
            ...baseConfig, 
            significantChangeThresholds: {
              ...baseConfig.significantChangeThresholds,
              membershipPercent: '1' as unknown as number
            }
          },
          { 
            ...baseConfig, 
            significantChangeThresholds: {
              ...baseConfig.significantChangeThresholds,
              distinguishedPercent: '2' as unknown as number
            }
          }
        ]
        
        const violationIndex = Math.floor(seed * typeViolations.length)
        const configWithTypeViolation = typeViolations[violationIndex]
        
        // Property: Type violations should be detected and rejected
        const errors = configService.validateConfig(configWithTypeViolation)
        expect(errors.length).toBeGreaterThan(0)
      }
    })
  })
})