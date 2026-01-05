/**
 * Property-Based Tests for DistrictConfigurationService
 *
 * Feature: district-scoped-data-collection
 * Property 1: District Configuration Persistence
 * Property 2: District ID Format Support
 *
 * Validates: Requirements 1.4, 1.5
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import fs from 'fs/promises'
import path from 'path'
import { DistrictConfigurationService } from '../DistrictConfigurationService.js'
import { safeString } from '../../utils/test-string-generators.js'

describe('DistrictConfigurationService - Property-Based Tests', () => {
  let testCacheDir: string

  beforeEach(async () => {
    // Create a unique test cache directory
    testCacheDir = path.join(
      process.cwd(),
      'test-cache',
      `district-config-pbt-${Date.now()}`
    )
    await fs.mkdir(testCacheDir, { recursive: true })
  })

  afterEach(async () => {
    // Clean up test cache directory
    try {
      await fs.rm(testCacheDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  // Property test generators
  const generateValidDistrictId = (): fc.Arbitrary<string> =>
    fc.oneof(
      // Numeric district IDs (1-999)
      fc.integer({ min: 1, max: 999 }).map(n => n.toString()),
      // Alphabetic district IDs (A-Z)
      fc.constantFrom(
        'A',
        'B',
        'C',
        'D',
        'E',
        'F',
        'G',
        'H',
        'I',
        'J',
        'K',
        'L',
        'M',
        'N',
        'O',
        'P',
        'Q',
        'R',
        'S',
        'T',
        'U',
        'V',
        'W',
        'X',
        'Y',
        'Z'
      )
    )

  const generateDistrictIdWithPrefix = (): fc.Arbitrary<string> =>
    generateValidDistrictId().map(id =>
      fc.sample(fc.boolean(), 1)[0] ? `District ${id}` : id
    )

  const generateAdminUser = (): fc.Arbitrary<string> =>
    safeString(3, 20).map(s => `admin-${s}`)

  /**
   * Property 1: District Configuration Persistence
   *
   * Validates that district configurations persist correctly across service instances
   * and that all CRUD operations maintain data integrity.
   *
   * Requirements: 1.5 (Configuration persistence and retrieval)
   */
  it('Property 1: District configuration should persist across service instances', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(generateValidDistrictId(), { minLength: 1, maxLength: 10 }),
        generateAdminUser(),
        async (districtIds: string[], adminUser: string) => {
          // Create a fresh test cache directory for this property test run
          const propertyTestCacheDir = path.join(
            process.cwd(),
            'test-cache',
            `district-config-pbt-property1-${Date.now()}-${Math.random()}`
          )
          await fs.mkdir(propertyTestCacheDir, { recursive: true })

          try {
            // Remove duplicates and sort for consistent comparison
            const uniqueDistrictIds = [...new Set(districtIds)].sort()

            // Create a fresh service instance for this test
            const testService = new DistrictConfigurationService(
              propertyTestCacheDir
            )

            // Add all districts to the service
            for (const districtId of uniqueDistrictIds) {
              await testService.addDistrict(districtId, adminUser)
            }

            // Verify districts are configured
            const configuredDistricts =
              await testService.getConfiguredDistricts()
            expect(configuredDistricts).toEqual(uniqueDistrictIds)

            // Create a new service instance with the same cache directory
            const newService = new DistrictConfigurationService(
              propertyTestCacheDir
            )

            // Verify persistence across instances
            const persistedDistricts = await newService.getConfiguredDistricts()
            expect(persistedDistricts).toEqual(uniqueDistrictIds)

            // Test removal persistence
            if (uniqueDistrictIds.length > 1) {
              const districtToRemove = uniqueDistrictIds[0]
              await newService.removeDistrict(districtToRemove, adminUser)

              const expectedAfterRemoval = uniqueDistrictIds.slice(1)
              const remainingDistricts =
                await newService.getConfiguredDistricts()
              expect(remainingDistricts).toEqual(expectedAfterRemoval)

              // Verify removal persists in another new instance
              const thirdService = new DistrictConfigurationService(
                propertyTestCacheDir
              )
              const finalDistricts = await thirdService.getConfiguredDistricts()
              expect(finalDistricts).toEqual(expectedAfterRemoval)
            }
          } finally {
            // Clean up property test cache directory
            try {
              await fs.rm(propertyTestCacheDir, {
                recursive: true,
                force: true,
              })
            } catch {
              // Ignore cleanup errors
            }
          }
        }
      ),
      { numRuns: 10 }
    )
  })

  /**
   * Property 2: District ID Format Support
   *
   * Validates that the service correctly handles both numeric and alphabetic
   * district ID formats, including normalization of prefixed formats.
   *
   * Requirements: 1.4 (Support for both numeric and alphabetic district IDs)
   */
  it('Property 2: District ID format support should handle all valid formats', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(generateDistrictIdWithPrefix(), {
          minLength: 1,
          maxLength: 5,
        }),
        generateAdminUser(),
        async (rawDistrictIds: string[], adminUser: string) => {
          // Create a fresh test cache directory for this property test run
          const propertyTestCacheDir = path.join(
            process.cwd(),
            'test-cache',
            `district-config-pbt-property2-${Date.now()}-${Math.random()}`
          )
          await fs.mkdir(propertyTestCacheDir, { recursive: true })

          try {
            // Create a fresh service instance for this test
            const testService = new DistrictConfigurationService(
              propertyTestCacheDir
            )

            // Add all districts (with potential prefixes)
            for (const rawDistrictId of rawDistrictIds) {
              await testService.addDistrict(rawDistrictId, adminUser)
            }

            // Get configured districts (should be normalized)
            const configuredDistricts =
              await testService.getConfiguredDistricts()

            // Verify all districts are valid format after normalization
            for (const districtId of configuredDistricts) {
              expect(testService.validateDistrictId(districtId)).toBe(true)

              // Verify format: either numeric (1-999) or single letter (A-Z)
              const isNumeric =
                /^\d+$/.test(districtId) &&
                parseInt(districtId) >= 1 &&
                parseInt(districtId) <= 999
              const isAlphabetic = /^[A-Z]$/.test(districtId)
              expect(isNumeric || isAlphabetic).toBe(true)
            }

            // Verify normalization: "District 42" becomes "42", "District F" becomes "F"
            const normalizedIds = rawDistrictIds.map(id => {
              if (id.startsWith('District ')) {
                return id.substring(9) // Remove "District " prefix
              }
              return id
            })

            // Remove duplicates and sort for comparison
            const expectedIds = [...new Set(normalizedIds)].sort()
            expect(configuredDistricts).toEqual(expectedIds)
          } finally {
            // Clean up property test cache directory
            try {
              await fs.rm(propertyTestCacheDir, {
                recursive: true,
                force: true,
              })
            } catch {
              // Ignore cleanup errors
            }
          }
        }
      ),
      { numRuns: 10 }
    )
  })

  /**
   * Property 3: Configuration Validation Enforcement
   *
   * Validates that configuration validation correctly identifies valid and invalid
   * districts when provided with all-districts data.
   *
   * Requirements: 1.2 (Configuration validation), 9.5 (Error handling)
   */
  it('Property 3: Configuration validation should correctly identify valid and invalid districts', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(generateValidDistrictId(), { minLength: 3, maxLength: 8 }),
        fc.array(generateValidDistrictId(), { minLength: 1, maxLength: 3 }),
        generateAdminUser(),
        async (
          allDistricts: string[],
          configuredDistricts: string[],
          adminUser: string
        ) => {
          // Create a fresh test cache directory for this property test run
          const propertyTestCacheDir = path.join(
            process.cwd(),
            'test-cache',
            `district-config-pbt-property3-${Date.now()}-${Math.random()}`
          )
          await fs.mkdir(propertyTestCacheDir, { recursive: true })

          try {
            // Ensure unique districts
            const uniqueAllDistricts = [...new Set(allDistricts)]
            const uniqueConfiguredDistricts = [...new Set(configuredDistricts)]

            // Create a fresh service instance for this test
            const testService = new DistrictConfigurationService(
              propertyTestCacheDir
            )

            // Add configured districts to service
            for (const districtId of uniqueConfiguredDistricts) {
              await testService.addDistrict(districtId, adminUser)
            }

            // Validate configuration against all-districts data
            const validationResult =
              await testService.validateConfiguration(uniqueAllDistricts)

            // Determine expected valid and invalid districts
            const expectedValidDistricts = uniqueConfiguredDistricts
              .filter(id => uniqueAllDistricts.includes(id))
              .sort()

            const expectedInvalidDistricts = uniqueConfiguredDistricts
              .filter(id => !uniqueAllDistricts.includes(id))
              .sort()

            // Verify validation results
            expect(validationResult.validDistricts.sort()).toEqual(
              expectedValidDistricts
            )
            expect(validationResult.invalidDistricts.sort()).toEqual(
              expectedInvalidDistricts
            )
            expect(validationResult.isValid).toBe(
              expectedInvalidDistricts.length === 0
            )

            // Verify warnings are generated for invalid districts
            expect(validationResult.warnings.length).toBe(
              expectedInvalidDistricts.length
            )

            for (const invalidDistrict of expectedInvalidDistricts) {
              const hasWarning = validationResult.warnings.some(warning =>
                warning.includes(invalidDistrict)
              )
              expect(hasWarning).toBe(true)
            }
          } finally {
            // Clean up property test cache directory
            try {
              await fs.rm(propertyTestCacheDir, {
                recursive: true,
                force: true,
              })
            } catch {
              // Ignore cleanup errors
            }
          }
        }
      ),
      { numRuns: 10 }
    )
  })
})
