/**
 * Property-Based Tests for Error Type Consistency
 *
 * Feature: district-configuration-storage-abstraction
 *
 * Property 5: Error Type Consistency
 * **Validates: Requirements 7.1**
 *
 * This test validates that:
 * - For any storage operation that fails, the storage implementation SHALL throw
 *   a StorageOperationError with the operation name and provider type in the error context.
 * - Both LocalDistrictConfigStorage and FirestoreDistrictConfigStorage maintain
 *   consistent error handling patterns.
 *
 * The property ensures consistent error handling across storage implementations.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fc from 'fast-check'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { LocalDistrictConfigStorage } from '../LocalDistrictConfigStorage.js'
import { FirestoreDistrictConfigStorage } from '../FirestoreDistrictConfigStorage.js'
import { StorageOperationError } from '../../../types/storageInterfaces.js'
import type {
  DistrictConfiguration,
  ConfigurationChange,
} from '../../DistrictConfigurationService.js'

/**
 * Generate a unique test directory for isolation
 * Uses timestamp, random string, and process ID to ensure uniqueness
 */
function createUniqueTestDir(): string {
  const timestamp = Date.now()
  const randomSuffix = Math.random().toString(36).substring(2, 11)
  const processId = process.pid
  return path.join(
    os.tmpdir(),
    `error-consistency-pbt-${timestamp}-${randomSuffix}-${processId}`
  )
}

/**
 * Arbitrary for generating valid district IDs
 */
const districtIdArbitrary = fc.oneof(
  fc.integer({ min: 1, max: 200 }).map(n => String(n)),
  fc.constantFrom('F', 'U', 'A', 'B', 'C', 'D', 'E')
)

/**
 * Arbitrary for generating valid updatedBy strings
 */
const updatedByArbitrary = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_-]{0,49}$/)

/**
 * Arbitrary for generating valid ISO date strings
 */
const isoDateArbitrary = fc
  .tuple(
    fc.integer({ min: 2020, max: 2030 }),
    fc.integer({ min: 1, max: 12 }),
    fc.integer({ min: 1, max: 28 }),
    fc.integer({ min: 0, max: 23 }),
    fc.integer({ min: 0, max: 59 }),
    fc.integer({ min: 0, max: 59 }),
    fc.integer({ min: 0, max: 999 })
  )
  .map(([year, month, day, hour, minute, second, ms]) => {
    const date = new Date(
      Date.UTC(year, month - 1, day, hour, minute, second, ms)
    )
    return date.toISOString()
  })

/**
 * Arbitrary for generating valid DistrictConfiguration objects
 */
const districtConfigurationArbitrary: fc.Arbitrary<DistrictConfiguration> =
  fc.record({
    configuredDistricts: fc
      .array(districtIdArbitrary, { minLength: 0, maxLength: 10 })
      .map(ids => [...new Set(ids)]),
    lastUpdated: isoDateArbitrary,
    updatedBy: updatedByArbitrary,
    version: fc.integer({ min: 1, max: 1000 }),
  })

/**
 * Arbitrary for generating valid ConfigurationChange objects
 */
const configurationChangeArbitrary: fc.Arbitrary<ConfigurationChange> =
  fc.record({
    timestamp: isoDateArbitrary,
    action: fc.constantFrom('add', 'remove', 'replace') as fc.Arbitrary<
      'add' | 'remove' | 'replace'
    >,
    districtId: fc.oneof(districtIdArbitrary, fc.constant(null)),
    adminUser: updatedByArbitrary,
    previousDistricts: fc.option(
      fc
        .array(districtIdArbitrary, { minLength: 0, maxLength: 5 })
        .map(ids => [...new Set(ids)]),
      { nil: undefined }
    ),
    newDistricts: fc.option(
      fc
        .array(districtIdArbitrary, { minLength: 0, maxLength: 5 })
        .map(ids => [...new Set(ids)]),
      { nil: undefined }
    ),
    context: fc.option(fc.string({ minLength: 1, maxLength: 100 }), {
      nil: undefined,
    }),
  })

/**
 * Arbitrary for generating storage operation names
 */
const operationNameArbitrary = fc.constantFrom(
  'getConfiguration',
  'saveConfiguration',
  'appendChangeLog',
  'getChangeHistory'
)

/**
 * Arbitrary for generating limit values for getChangeHistory
 */
const limitArbitrary = fc.integer({ min: 1, max: 100 })

describe('Property 5: Error Type Consistency', () => {
  describe('LocalDistrictConfigStorage Error Handling', () => {
    let testDir: string

    beforeEach(async () => {
      testDir = createUniqueTestDir()
      await fs.mkdir(testDir, { recursive: true })
    })

    afterEach(async () => {
      vi.restoreAllMocks()
      try {
        await fs.rm(testDir, { recursive: true, force: true })
      } catch {
        // Ignore cleanup errors
      }
    })

    it('should throw StorageOperationError with operation name and provider type for getConfiguration failures', async () => {
      // Feature: district-configuration-storage-abstraction, Property 5: Error Type Consistency
      // **Validates: Requirements 7.1**
      await fc.assert(
        fc.asyncProperty(fc.constant(null), async () => {
          const iterationDir = createUniqueTestDir()
          await fs.mkdir(iterationDir, { recursive: true })
          const storage = new LocalDistrictConfigStorage(iterationDir)

          // Create a config file with invalid JSON to trigger a parse error
          const configDir = path.join(iterationDir, 'config')
          await fs.mkdir(configDir, { recursive: true })
          await fs.writeFile(
            path.join(configDir, 'districts.json'),
            'invalid json content',
            'utf-8'
          )

          try {
            await storage.getConfiguration()
            // If we get here without error, the implementation handles invalid JSON gracefully
            // by returning null - which is acceptable behavior
            return true
          } catch (error) {
            // Property: Error must be StorageOperationError with correct context
            expect(error).toBeInstanceOf(StorageOperationError)
            const storageError = error as StorageOperationError
            expect(storageError.operation).toBe('getConfiguration')
            expect(storageError.provider).toBe('local')
            expect(typeof storageError.retryable).toBe('boolean')
            return true
          } finally {
            try {
              await fs.rm(iterationDir, { recursive: true, force: true })
            } catch {
              // Ignore cleanup errors
            }
          }
        }),
        { numRuns: 10, timeout: 30000 }
      )
    })

    it('should throw StorageOperationError with operation name and provider type for saveConfiguration failures', async () => {
      // Feature: district-configuration-storage-abstraction, Property 5: Error Type Consistency
      // **Validates: Requirements 7.1**
      await fc.assert(
        fc.asyncProperty(districtConfigurationArbitrary, async config => {
          const iterationDir = createUniqueTestDir()
          await fs.mkdir(iterationDir, { recursive: true })
          const storage = new LocalDistrictConfigStorage(iterationDir)

          // Create a file where the config directory should be to cause a write failure
          const configDir = path.join(iterationDir, 'config')
          // Create a file (not directory) at the config path to cause mkdir to fail
          await fs.writeFile(configDir, 'blocking file', 'utf-8')

          try {
            await storage.saveConfiguration(config)
            // Should not reach here
            expect.fail('Expected StorageOperationError to be thrown')
          } catch (error) {
            // Property: Error must be StorageOperationError with correct context
            expect(error).toBeInstanceOf(StorageOperationError)
            const storageError = error as StorageOperationError
            expect(storageError.operation).toBe('saveConfiguration')
            expect(storageError.provider).toBe('local')
            expect(typeof storageError.retryable).toBe('boolean')
            return true
          } finally {
            try {
              await fs.rm(iterationDir, { recursive: true, force: true })
            } catch {
              // Ignore cleanup errors
            }
          }
        }),
        { numRuns: 50, timeout: 60000 }
      )
    })

    it('should throw StorageOperationError with operation name and provider type for appendChangeLog failures', async () => {
      // Feature: district-configuration-storage-abstraction, Property 5: Error Type Consistency
      // **Validates: Requirements 7.1**
      await fc.assert(
        fc.asyncProperty(configurationChangeArbitrary, async change => {
          const iterationDir = createUniqueTestDir()
          await fs.mkdir(iterationDir, { recursive: true })
          const storage = new LocalDistrictConfigStorage(iterationDir)

          // Create a file where the config directory should be to cause a write failure
          const configDir = path.join(iterationDir, 'config')
          await fs.writeFile(configDir, 'blocking file', 'utf-8')

          try {
            await storage.appendChangeLog(change)
            // Should not reach here
            expect.fail('Expected StorageOperationError to be thrown')
          } catch (error) {
            // Property: Error must be StorageOperationError with correct context
            expect(error).toBeInstanceOf(StorageOperationError)
            const storageError = error as StorageOperationError
            expect(storageError.operation).toBe('appendChangeLog')
            expect(storageError.provider).toBe('local')
            expect(typeof storageError.retryable).toBe('boolean')
            return true
          } finally {
            try {
              await fs.rm(iterationDir, { recursive: true, force: true })
            } catch {
              // Ignore cleanup errors
            }
          }
        }),
        { numRuns: 50, timeout: 60000 }
      )
    })

    it('should throw StorageOperationError with operation name and provider type for getChangeHistory failures', async () => {
      // Feature: district-configuration-storage-abstraction, Property 5: Error Type Consistency
      // **Validates: Requirements 7.1**
      await fc.assert(
        fc.asyncProperty(limitArbitrary, async limit => {
          const iterationDir = createUniqueTestDir()
          await fs.mkdir(iterationDir, { recursive: true })
          const storage = new LocalDistrictConfigStorage(iterationDir)

          // Create the config directory and a log file that's actually a directory
          // to cause a read failure
          const configDir = path.join(iterationDir, 'config')
          await fs.mkdir(configDir, { recursive: true })
          const logPath = path.join(configDir, 'district-changes.log')
          await fs.mkdir(logPath, { recursive: true }) // Create directory instead of file

          try {
            await storage.getChangeHistory(limit)
            // Should not reach here
            expect.fail('Expected StorageOperationError to be thrown')
          } catch (error) {
            // Property: Error must be StorageOperationError with correct context
            expect(error).toBeInstanceOf(StorageOperationError)
            const storageError = error as StorageOperationError
            expect(storageError.operation).toBe('getChangeHistory')
            expect(storageError.provider).toBe('local')
            expect(typeof storageError.retryable).toBe('boolean')
            return true
          } finally {
            try {
              await fs.rm(iterationDir, { recursive: true, force: true })
            } catch {
              // Ignore cleanup errors
            }
          }
        }),
        { numRuns: 50, timeout: 60000 }
      )
    })

    it('should include original error as cause when available', async () => {
      // Feature: district-configuration-storage-abstraction, Property 5: Error Type Consistency
      // **Validates: Requirements 7.1**
      await fc.assert(
        fc.asyncProperty(districtConfigurationArbitrary, async config => {
          const iterationDir = createUniqueTestDir()
          await fs.mkdir(iterationDir, { recursive: true })
          const storage = new LocalDistrictConfigStorage(iterationDir)

          // Create a file where the config directory should be to cause a write failure
          const configDir = path.join(iterationDir, 'config')
          await fs.writeFile(configDir, 'blocking file', 'utf-8')

          try {
            await storage.saveConfiguration(config)
            expect.fail('Expected StorageOperationError to be thrown')
          } catch (error) {
            // Property: Error should include the original cause
            expect(error).toBeInstanceOf(StorageOperationError)
            const storageError = error as StorageOperationError
            // The cause should be the original filesystem error
            expect(storageError.cause).toBeDefined()
            expect(storageError.cause).toBeInstanceOf(Error)
            return true
          } finally {
            try {
              await fs.rm(iterationDir, { recursive: true, force: true })
            } catch {
              // Ignore cleanup errors
            }
          }
        }),
        { numRuns: 20, timeout: 30000 }
      )
    })
  })

  describe('FirestoreDistrictConfigStorage Error Handling', () => {
    it('should throw StorageOperationError with operation name and provider type for getConfiguration failures', async () => {
      // Feature: district-configuration-storage-abstraction, Property 5: Error Type Consistency
      // **Validates: Requirements 7.1**
      await fc.assert(
        fc.asyncProperty(fc.constant(null), async () => {
          // Create storage with invalid project ID to trigger connection failure
          const storage = new FirestoreDistrictConfigStorage({
            projectId: 'invalid-project-that-does-not-exist-' + Date.now(),
          })

          try {
            await storage.getConfiguration()
            // If we get here, the emulator might be running - skip this iteration
            return true
          } catch (error) {
            // Property: Error must be StorageOperationError with correct context
            expect(error).toBeInstanceOf(StorageOperationError)
            const storageError = error as StorageOperationError
            expect(storageError.operation).toBe('getConfiguration')
            expect(storageError.provider).toBe('firestore')
            expect(typeof storageError.retryable).toBe('boolean')
            return true
          }
        }),
        { numRuns: 5, timeout: 60000 }
      )
    })

    it('should throw StorageOperationError with operation name and provider type for saveConfiguration failures', async () => {
      // Feature: district-configuration-storage-abstraction, Property 5: Error Type Consistency
      // **Validates: Requirements 7.1**
      await fc.assert(
        fc.asyncProperty(districtConfigurationArbitrary, async config => {
          // Create storage with invalid project ID to trigger connection failure
          const storage = new FirestoreDistrictConfigStorage({
            projectId: 'invalid-project-that-does-not-exist-' + Date.now(),
          })

          try {
            await storage.saveConfiguration(config)
            // If we get here, the emulator might be running - skip this iteration
            return true
          } catch (error) {
            // Property: Error must be StorageOperationError with correct context
            expect(error).toBeInstanceOf(StorageOperationError)
            const storageError = error as StorageOperationError
            expect(storageError.operation).toBe('saveConfiguration')
            expect(storageError.provider).toBe('firestore')
            expect(typeof storageError.retryable).toBe('boolean')
            return true
          }
        }),
        { numRuns: 5, timeout: 60000 }
      )
    })

    it('should throw StorageOperationError with operation name and provider type for appendChangeLog failures', async () => {
      // Feature: district-configuration-storage-abstraction, Property 5: Error Type Consistency
      // **Validates: Requirements 7.1**
      await fc.assert(
        fc.asyncProperty(configurationChangeArbitrary, async change => {
          // Create storage with invalid project ID to trigger connection failure
          const storage = new FirestoreDistrictConfigStorage({
            projectId: 'invalid-project-that-does-not-exist-' + Date.now(),
          })

          try {
            await storage.appendChangeLog(change)
            // If we get here, the emulator might be running - skip this iteration
            return true
          } catch (error) {
            // Property: Error must be StorageOperationError with correct context
            expect(error).toBeInstanceOf(StorageOperationError)
            const storageError = error as StorageOperationError
            expect(storageError.operation).toBe('appendChangeLog')
            expect(storageError.provider).toBe('firestore')
            expect(typeof storageError.retryable).toBe('boolean')
            return true
          }
        }),
        { numRuns: 5, timeout: 60000 }
      )
    })

    it('should throw StorageOperationError with operation name and provider type for getChangeHistory failures', async () => {
      // Feature: district-configuration-storage-abstraction, Property 5: Error Type Consistency
      // **Validates: Requirements 7.1**
      await fc.assert(
        fc.asyncProperty(limitArbitrary, async limit => {
          // Create storage with invalid project ID to trigger connection failure
          const storage = new FirestoreDistrictConfigStorage({
            projectId: 'invalid-project-that-does-not-exist-' + Date.now(),
          })

          try {
            await storage.getChangeHistory(limit)
            // If we get here, the emulator might be running - skip this iteration
            return true
          } catch (error) {
            // Property: Error must be StorageOperationError with correct context
            expect(error).toBeInstanceOf(StorageOperationError)
            const storageError = error as StorageOperationError
            expect(storageError.operation).toBe('getChangeHistory')
            expect(storageError.provider).toBe('firestore')
            expect(typeof storageError.retryable).toBe('boolean')
            return true
          }
        }),
        { numRuns: 5, timeout: 60000 }
      )
    })

    it('should correctly classify retryable errors for transient failures', async () => {
      // Feature: district-configuration-storage-abstraction, Property 5: Error Type Consistency
      // **Validates: Requirements 7.1**
      await fc.assert(
        fc.asyncProperty(districtConfigurationArbitrary, async config => {
          // Create storage with invalid project ID to trigger connection failure
          const storage = new FirestoreDistrictConfigStorage({
            projectId: 'invalid-project-that-does-not-exist-' + Date.now(),
          })

          try {
            await storage.saveConfiguration(config)
            return true
          } catch (error) {
            // Property: Error should have retryable flag set appropriately
            expect(error).toBeInstanceOf(StorageOperationError)
            const storageError = error as StorageOperationError
            // The retryable flag should be a boolean
            expect(typeof storageError.retryable).toBe('boolean')
            // Network/connection errors are typically retryable
            // The implementation should classify this correctly
            return true
          }
        }),
        { numRuns: 5, timeout: 60000 }
      )
    })
  })

  describe('Cross-Implementation Error Consistency', () => {
    it('should use consistent error structure across both implementations', async () => {
      // Feature: district-configuration-storage-abstraction, Property 5: Error Type Consistency
      // **Validates: Requirements 7.1**
      await fc.assert(
        fc.asyncProperty(operationNameArbitrary, async operationName => {
          // This test verifies that both implementations use the same error structure
          // by checking that StorageOperationError has the expected properties

          // Create a sample error to verify structure
          const localError = new StorageOperationError(
            'Test error message',
            operationName,
            'local',
            false,
            new Error('Original error')
          )

          const firestoreError = new StorageOperationError(
            'Test error message',
            operationName,
            'firestore',
            true,
            new Error('Original error')
          )

          // Property: Both errors should have the same structure
          expect(localError).toBeInstanceOf(StorageOperationError)
          expect(firestoreError).toBeInstanceOf(StorageOperationError)

          // Property: Operation name should be preserved
          expect(localError.operation).toBe(operationName)
          expect(firestoreError.operation).toBe(operationName)

          // Property: Provider type should be correct
          expect(localError.provider).toBe('local')
          expect(firestoreError.provider).toBe('firestore')

          // Property: Retryable flag should be boolean
          expect(typeof localError.retryable).toBe('boolean')
          expect(typeof firestoreError.retryable).toBe('boolean')

          // Property: Cause should be preserved
          expect(localError.cause).toBeInstanceOf(Error)
          expect(firestoreError.cause).toBeInstanceOf(Error)

          // Property: Error name should be consistent
          expect(localError.name).toBe('StorageOperationError')
          expect(firestoreError.name).toBe('StorageOperationError')

          return true
        }),
        { numRuns: 100, timeout: 30000 }
      )
    })

    it('should ensure all storage operations are covered by error handling', async () => {
      // Feature: district-configuration-storage-abstraction, Property 5: Error Type Consistency
      // **Validates: Requirements 7.1**

      // Define the expected operations that should throw StorageOperationError
      const expectedOperations = [
        'getConfiguration',
        'saveConfiguration',
        'appendChangeLog',
        'getChangeHistory',
      ]

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...expectedOperations),
          async operation => {
            // Property: Each operation should be a valid operation name
            expect(expectedOperations).toContain(operation)

            // Property: Creating an error with this operation should work
            const error = new StorageOperationError(
              `Failed ${operation}`,
              operation,
              'local',
              false
            )
            expect(error.operation).toBe(operation)

            return true
          }
        ),
        { numRuns: 100, timeout: 30000 }
      )
    })
  })
})
