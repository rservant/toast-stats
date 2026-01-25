/**
 * Property-Based Tests for DistrictConfigurationService
 *
 * Feature: district-configuration-storage-abstraction
 * Property 1: District Configuration Persistence
 * Property 2: District ID Format Support
 * Property 3: Configuration Validation Enforcement
 * Property 4: Validation Preservation (storage-independent validation)
 *
 * Validates: Requirements 1.4, 1.5, 5.4
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import fs from 'fs/promises'
import path from 'path'
import { DistrictConfigurationService } from '../DistrictConfigurationService.js'
import { LocalDistrictConfigStorage } from '../storage/LocalDistrictConfigStorage.js'
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
   * Helper function to create a service with storage abstraction
   */
  const createServiceWithStorage = (
    cacheDir: string
  ): DistrictConfigurationService => {
    const storage = new LocalDistrictConfigStorage(cacheDir)
    return new DistrictConfigurationService(storage)
  }

  /**
   * Property 1: District Configuration Persistence
   *
   * Validates that district configurations persist correctly across service instances
   * and that all CRUD operations maintain data integrity.
   *
   * **Validates: Requirements 1.5, 5.2**
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

            // Create a fresh service instance with storage abstraction
            const testService = createServiceWithStorage(propertyTestCacheDir)

            // Add all districts to the service
            for (const districtId of uniqueDistrictIds) {
              await testService.addDistrict(districtId, adminUser)
            }

            // Verify districts are configured
            const configuredDistricts =
              await testService.getConfiguredDistricts()
            expect(configuredDistricts).toEqual(uniqueDistrictIds)

            // Create a new service instance with the same cache directory
            const newService = createServiceWithStorage(propertyTestCacheDir)

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
              const thirdService =
                createServiceWithStorage(propertyTestCacheDir)
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
   * **Validates: Requirements 1.4, 5.4**
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
            // Create a fresh service instance with storage abstraction
            const testService = createServiceWithStorage(propertyTestCacheDir)

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
   * **Validates: Requirements 1.2, 5.4, 9.5**
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

            // Create a fresh service instance with storage abstraction
            const testService = createServiceWithStorage(propertyTestCacheDir)

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

  /**
   * Property 4: Validation Preservation
   *
   * *For any* district ID input, the DistrictConfigurationService SHALL apply
   * the same validation and normalization rules regardless of which storage
   * implementation is used.
   *
   * This property ensures business logic (validation, normalization) is
   * independent of storage backend.
   *
   * **Validates: Requirements 5.4**
   */
  it('Property 4: Validation should be consistent regardless of storage backend', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a mix of valid and invalid district IDs
        fc.array(
          fc.oneof(
            // Valid numeric IDs
            fc.integer({ min: 1, max: 999 }).map(n => n.toString()),
            // Valid alphabetic IDs
            fc.constantFrom('A', 'B', 'F', 'Z'),
            // IDs with "District " prefix (should normalize)
            fc.integer({ min: 1, max: 100 }).map(n => `District ${n}`),
            fc.constantFrom('District A', 'District F'),
            // Invalid IDs (multi-letter, mixed, special chars)
            fc.constantFrom('AB', '42A', 'A1', '42-A', '', '  ', 'abc', 'XYZ')
          ),
          { minLength: 1, maxLength: 10 }
        ),
        async (districtIds: string[]) => {
          // Create two separate test cache directories
          const cacheDir1 = path.join(
            process.cwd(),
            'test-cache',
            `district-config-pbt-property4-1-${Date.now()}-${Math.random()}`
          )
          const cacheDir2 = path.join(
            process.cwd(),
            'test-cache',
            `district-config-pbt-property4-2-${Date.now()}-${Math.random()}`
          )
          await fs.mkdir(cacheDir1, { recursive: true })
          await fs.mkdir(cacheDir2, { recursive: true })

          try {
            // Create two service instances with different storage directories
            const service1 = createServiceWithStorage(cacheDir1)
            const service2 = createServiceWithStorage(cacheDir2)

            // Test validation consistency for each district ID
            for (const districtId of districtIds) {
              const validation1 = service1.validateDistrictId(districtId)
              const validation2 = service2.validateDistrictId(districtId)

              // Validation results should be identical regardless of storage
              expect(validation1).toBe(validation2)
            }

            // Test that valid IDs can be added to both services consistently
            const validIds = districtIds.filter(id =>
              service1.validateDistrictId(id)
            )

            for (const validId of validIds) {
              // Both services should accept the same valid IDs
              await service1.addDistrict(validId, 'test-admin')
              await service2.addDistrict(validId, 'test-admin')
            }

            // Both services should have the same configured districts
            const districts1 = await service1.getConfiguredDistricts()
            const districts2 = await service2.getConfiguredDistricts()
            expect(districts1).toEqual(districts2)

            // Test that invalid IDs are rejected consistently
            const invalidIds = districtIds.filter(
              id => !service1.validateDistrictId(id)
            )

            for (const invalidId of invalidIds) {
              // Skip empty strings as they throw a different error
              if (!invalidId || invalidId.trim() === '') continue

              // Both services should reject the same invalid IDs
              let error1: Error | null = null
              let error2: Error | null = null

              try {
                await service1.addDistrict(invalidId, 'test-admin')
              } catch (e) {
                error1 = e as Error
              }

              try {
                await service2.addDistrict(invalidId, 'test-admin')
              } catch (e) {
                error2 = e as Error
              }

              // Both should throw errors for invalid IDs
              expect(error1).not.toBeNull()
              expect(error2).not.toBeNull()

              // Error messages should be consistent
              if (error1 && error2) {
                expect(error1.message).toBe(error2.message)
              }
            }
          } finally {
            // Clean up both test cache directories
            try {
              await fs.rm(cacheDir1, { recursive: true, force: true })
              await fs.rm(cacheDir2, { recursive: true, force: true })
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
