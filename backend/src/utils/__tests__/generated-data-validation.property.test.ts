/**
 * Property-based tests for generated data validation
 * Feature: test-infrastructure-stabilization, Property 22: Generated Data Validation
 * Validates: Requirements 8.3
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import {
  serviceConfigurationArbitrary,
  districtCacheEntryArbitrary,
  validateGeneratedData,
  isFilesystemSafe,
} from '../test-string-generators.js'
import {
  validateServiceConfiguration,
  validateDistrictCacheEntry,
  checkServiceConfigurationCompatibility,
} from '../test-data-factories.js'
import { createTestSelfCleanup } from '../test-self-cleanup.js'
import type { ServiceConfiguration } from '../../types/serviceContainer.js'

describe('Generated Data Validation Property Tests', () => {
  // Self-cleanup setup - each test manages its own cleanup
  const { cleanup, afterEach: performCleanup } = createTestSelfCleanup({
    verbose: false,
  })

  beforeEach(() => {
    cleanup.reset()
  })

  afterEach(async () => {
    await performCleanup()
  })

  describe('Property 22: Generated Data Validation - Data Validity', () => {
    it('should ensure generated ServiceConfiguration data is valid and realistic', () => {
      // Feature: test-infrastructure-stabilization, Property 22: Generated Data Validation
      fc.assert(
        fc.property(serviceConfigurationArbitrary(), config => {
          // Generated data should be valid
          expect(validateServiceConfiguration(config)).toBe(true)

          // Check realistic constraints
          expect(config.cacheDirectory).toBeTruthy()
          expect(typeof config.cacheDirectory).toBe('string')
          expect(config.cacheDirectory.length).toBeGreaterThan(0)

          // Environment should be one of valid values
          expect(['test', 'development', 'production']).toContain(
            config.environment
          )

          // Log level should be one of valid values
          expect(['debug', 'info', 'warn', 'error']).toContain(config.logLevel)

          // Cache directory should be filesystem-safe
          const pathParts = config.cacheDirectory.split('/')
          for (const part of pathParts) {
            if (part && part !== '.' && part !== '..') {
              expect(isFilesystemSafe(part)).toBe(true)
            }
          }
        }),
        { numRuns: 5 }
      )
    })



    it('should ensure generated DistrictCacheEntry data is valid and realistic', () => {
      fc.assert(
        fc.property(districtCacheEntryArbitrary(), entry => {
          // Generated data should be valid
          expect(validateDistrictCacheEntry(entry)).toBe(true)

          // Check realistic constraints
          expect(entry.districtId).toBeTruthy()
          expect(typeof entry.districtId).toBe('string')

          // Date should be in valid format
          expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)

          // Performance arrays should be valid
          expect(Array.isArray(entry.districtPerformance)).toBe(true)
          expect(Array.isArray(entry.divisionPerformance)).toBe(true)
          expect(Array.isArray(entry.clubPerformance)).toBe(true)

          // Check district performance entries if any exist
          for (const performance of entry.districtPerformance) {
            expect(typeof performance).toBe('object')
            expect(performance).not.toBeNull()
          }

          // Check division performance entries if any exist
          for (const performance of entry.divisionPerformance) {
            expect(typeof performance).toBe('object')
            expect(performance).not.toBeNull()
          }

          // Check club performance entries if any exist
          for (const performance of entry.clubPerformance) {
            expect(typeof performance).toBe('object')
            expect(performance).not.toBeNull()
          }

          // FetchedAt should be a valid ISO string
          expect(typeof entry.fetchedAt).toBe('string')
          expect(() => new Date(entry.fetchedAt)).not.toThrow()

          // Validate the fetchedAt date is reasonable (not too far in the future)
          const fetchedDate = new Date(entry.fetchedAt)
          const maxFutureDate = new Date('2030-12-31')
          expect(fetchedDate.getTime()).toBeLessThanOrEqual(
            maxFutureDate.getTime()
          )
        }),
        { numRuns: 5 }
      )
    })
  })

  describe('Property 22: Generated Data Validation - Constraint Validation', () => {
    it('should validate data according to specified constraints', () => {
      fc.assert(
        fc.property(
          fc.record({
            name: fc
              .string({ minLength: 1, maxLength: 50 })
              .filter(s => s.trim().length > 0),
            age: fc.integer({ min: 0, max: 150 }),
            email: fc
              .string({ minLength: 5, maxLength: 100 })
              .filter(
                s => s.trim().length >= 5 && /^[a-zA-Z0-9@._-]+$/.test(s)
              ),
            createdAt: fc.date(),
            isActive: fc.boolean(),
          }),
          testData => {
            // Test constraint validation
            const isValid = validateGeneratedData(testData, {
              requiredFields: ['name', 'age', 'email'],
              stringFields: ['name', 'email'],
              numberFields: ['age'],
              dateFields: ['createdAt'],
              customValidators: [
                data => data.age >= 0 && data.age <= 150,
                data => data.name.trim().length > 0, // Require non-whitespace content
                _data => true, // Accept any email for test data - this is just testing the validation framework
              ],
            })

            expect(isValid).toBe(true)

            // Test with missing required field
            const invalidData = { ...testData }
            delete (invalidData as Partial<typeof testData>).name

            const isInvalid = validateGeneratedData(invalidData, {
              requiredFields: ['name', 'age', 'email'],
              stringFields: ['name', 'email'],
              numberFields: ['age'],
            })

            expect(isInvalid).toBe(false)
          }
        ),
        { numRuns: 5 }
      )
    })

    it('should validate data compatibility between versions', () => {
      fc.assert(
        fc.property(
          serviceConfigurationArbitrary(),
          serviceConfigurationArbitrary(),
          (oldConfig, newConfigBase) => {
            // Create new config that preserves required fields
            const newConfig: ServiceConfiguration = {
              ...newConfigBase,
              cacheDirectory: oldConfig.cacheDirectory, // Preserve required field
              environment: oldConfig.environment, // Preserve required field
              logLevel: oldConfig.logLevel, // Preserve required field
            }

            // Test compatibility
            const isCompatible = checkServiceConfigurationCompatibility(
              oldConfig,
              newConfig
            )
            expect(isCompatible).toBe(true)

            // Test incompatibility by removing required field
            const incompatibleConfig = { ...newConfig }
            delete (incompatibleConfig as Partial<ServiceConfiguration>)
              .cacheDirectory

            const isIncompatible = checkServiceConfigurationCompatibility(
              oldConfig,
              incompatibleConfig as ServiceConfiguration
            )
            expect(isIncompatible).toBe(false)
          }
        ),
        { numRuns: 5 }
      )
    })


  })

  describe('Property 22: Generated Data Validation - Edge Cases', () => {
    it('should handle edge cases in data validation', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.constant(''),
            fc.constant(0),
            fc.constant(false),
            fc.constant([]),
            fc.constant({})
          ),
          edgeValue => {
            // Test validation with edge values
            const testData = {
              validField: 'valid',
              edgeField: edgeValue,
            }

            // Should handle null/undefined gracefully
            const result = validateGeneratedData(testData, {
              requiredFields: ['validField'],
              stringFields: ['validField'],
              customValidators: [data => data.validField === 'valid'],
            })

            expect(result).toBe(true)

            // Should fail when edge value is in required field
            const invalidResult = validateGeneratedData(testData, {
              requiredFields: ['edgeField'],
            })

            if (edgeValue === null || edgeValue === undefined) {
              expect(invalidResult).toBe(false)
            } else {
              expect(invalidResult).toBe(true)
            }
          }
        ),
        { numRuns: 5 }
      )
    })

    it('should validate filesystem safety for generated paths', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 100 }), testString => {
          // Test filesystem safety validation
          const isSafe = isFilesystemSafe(testString)

          if (isSafe) {
            // Safe strings should not contain invalid characters
            expect(testString).not.toMatch(/[<>:"/\\|?*]/)
            expect(testString).not.toMatch(
              /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i
            )
            expect(testString).not.toMatch(/^\./)
            expect(testString).not.toMatch(/\.$/)
            expect(testString).not.toMatch(/ $/)
          }

          // The validation should be consistent
          expect(isFilesystemSafe(testString)).toBe(isSafe)
        }),
        { numRuns: 5 }
      )
    })
  })
})
