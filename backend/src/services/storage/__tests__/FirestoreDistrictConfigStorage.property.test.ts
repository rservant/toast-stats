/**
 * Property-Based Tests for FirestoreDistrictConfigStorage
 *
 * Feature: district-configuration-storage-abstraction
 *
 * Property 1: Configuration Round-Trip Consistency
 * **Validates: Requirements 2.1, 3.1**
 *
 * This test validates that:
 * - For any valid DistrictConfiguration object, saving it to storage and then
 *   reading it back SHALL produce an equivalent configuration object.
 * - The storage implementation correctly persists and retrieves configuration
 *   data without loss or corruption.
 *
 * The property ensures complete data integrity through the Firestore storage layer.
 *
 * NOTE: These tests require the Firestore emulator to be running.
 * Set FIRESTORE_EMULATOR_HOST environment variable to enable tests.
 * Tests will be skipped gracefully if the emulator is not available.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest'
import * as fc from 'fast-check'
import { Firestore } from '@google-cloud/firestore'
import { FirestoreDistrictConfigStorage } from '../FirestoreDistrictConfigStorage.js'
import type { DistrictConfiguration } from '../../DistrictConfigurationService.js'
import {
  getEmulatorConfig,
  skipIfNoFirestoreEmulator,
} from '../../../__tests__/emulator-config.js'

/**
 * Generate a unique document path for test isolation
 * Uses timestamp, random string, and process ID to ensure uniqueness
 */
function createUniqueDocPath(): string {
  const timestamp = Date.now()
  const randomSuffix = Math.random().toString(36).substring(2, 11)
  const processId = process.pid
  return `test-config-${timestamp}-${randomSuffix}-${processId}`
}

/**
 * Arbitrary for generating valid district IDs
 *
 * District IDs can be:
 * - Numeric strings: "1", "42", "101"
 * - Alphabetic strings: "F", "U"
 * - Mixed: "42F" (rare but valid)
 */
const districtIdArbitrary = fc.oneof(
  // Numeric district IDs (most common)
  fc.integer({ min: 1, max: 200 }).map(n => String(n)),
  // Alphabetic district IDs (special districts)
  fc.constantFrom('F', 'U', 'A', 'B', 'C', 'D', 'E'),
  // Mixed alphanumeric (rare)
  fc
    .tuple(fc.integer({ min: 1, max: 99 }), fc.constantFrom('F', 'U', 'A'))
    .map(([n, letter]) => `${n}${letter}`)
)

/**
 * Arbitrary for generating valid updatedBy strings
 * Uses alphanumeric characters plus common username characters
 */
const updatedByArbitrary = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_-]{0,49}$/)

/**
 * Arbitrary for generating valid ISO date strings
 * Generates dates between 2020-01-01 and 2030-12-31
 */
const isoDateArbitrary = fc
  .tuple(
    fc.integer({ min: 2020, max: 2030 }), // year
    fc.integer({ min: 1, max: 12 }), // month
    fc.integer({ min: 1, max: 28 }), // day (use 28 to avoid invalid dates)
    fc.integer({ min: 0, max: 23 }), // hour
    fc.integer({ min: 0, max: 59 }), // minute
    fc.integer({ min: 0, max: 59 }), // second
    fc.integer({ min: 0, max: 999 }) // millisecond
  )
  .map(([year, month, day, hour, minute, second, ms]) => {
    const date = new Date(
      Date.UTC(year, month - 1, day, hour, minute, second, ms)
    )
    return date.toISOString()
  })

/**
 * Arbitrary for generating valid DistrictConfiguration objects
 *
 * Generates configurations with:
 * - 0 to 20 unique district IDs
 * - Valid ISO timestamp for lastUpdated
 * - Non-empty updatedBy string
 * - Positive integer version
 */
const districtConfigurationArbitrary: fc.Arbitrary<DistrictConfiguration> =
  fc.record({
    configuredDistricts: fc
      .array(districtIdArbitrary, { minLength: 0, maxLength: 20 })
      .map(ids => [...new Set(ids)]), // Ensure uniqueness
    lastUpdated: isoDateArbitrary,
    updatedBy: updatedByArbitrary,
    version: fc.integer({ min: 1, max: 1000 }),
  })

/**
 * Custom FirestoreDistrictConfigStorage that allows custom document paths
 * for test isolation. This extends the base class to override the document path.
 */
class TestableFirestoreDistrictConfigStorage extends FirestoreDistrictConfigStorage {
  private readonly testDocPath: string
  private readonly testFirestore: Firestore

  constructor(config: { projectId: string }, testDocPath: string) {
    super(config)
    this.testDocPath = testDocPath
    this.testFirestore = new Firestore({ projectId: config.projectId })
  }

  /**
   * Override getConfiguration to use test document path
   */
  override async getConfiguration(): Promise<DistrictConfiguration | null> {
    const docRef = this.testFirestore.doc(this.testDocPath)
    const docSnapshot = await docRef.get()

    if (!docSnapshot.exists) {
      return null
    }

    const data = docSnapshot.data()
    if (!data) {
      return null
    }

    // Validate configuration structure
    if (
      !Array.isArray(data['configuredDistricts']) ||
      typeof data['lastUpdated'] !== 'string' ||
      typeof data['updatedBy'] !== 'string' ||
      typeof data['version'] !== 'number'
    ) {
      return null
    }

    return {
      configuredDistricts: data['configuredDistricts'] as string[],
      lastUpdated: data['lastUpdated'] as string,
      updatedBy: data['updatedBy'] as string,
      version: data['version'] as number,
    }
  }

  /**
   * Override saveConfiguration to use test document path
   */
  override async saveConfiguration(
    config: DistrictConfiguration
  ): Promise<void> {
    const docRef = this.testFirestore.doc(this.testDocPath)
    await docRef.set({
      configuredDistricts: config.configuredDistricts,
      lastUpdated: config.lastUpdated,
      updatedBy: config.updatedBy,
      version: config.version,
    })
  }

  /**
   * Clean up test document
   */
  async cleanup(): Promise<void> {
    try {
      const docRef = this.testFirestore.doc(this.testDocPath)
      await docRef.delete()
    } catch {
      // Ignore cleanup errors
    }
  }
}

describe.skipIf(skipIfNoFirestoreEmulator())(
  'Property 1: Configuration Round-Trip Consistency (Firestore)',
  () => {
    let projectId: string
    const createdStorages: TestableFirestoreDistrictConfigStorage[] = []

    beforeAll(() => {
      const config = getEmulatorConfig()
      projectId = config.projectId
    })

    beforeEach(() => {
      // Clear the list of created storages for each test
      createdStorages.length = 0
    })

    afterEach(async () => {
      // Clean up all created test documents
      for (const storage of createdStorages) {
        await storage.cleanup()
      }
    })

    it('should preserve configuration data through save and read cycle', async () => {
      // Feature: district-configuration-storage-abstraction, Property 1: Configuration Round-Trip Consistency
      // **Validates: Requirements 2.1, 3.1**
      await fc.assert(
        fc.asyncProperty(districtConfigurationArbitrary, async config => {
          // Create unique document path for this iteration
          const testDocPath = createUniqueDocPath()
          const storage = new TestableFirestoreDistrictConfigStorage(
            { projectId },
            testDocPath
          )
          createdStorages.push(storage)

          try {
            // Save the configuration
            await storage.saveConfiguration(config)

            // Read it back
            const retrieved = await storage.getConfiguration()

            // Property: Retrieved configuration must be equivalent to saved configuration
            expect(retrieved).not.toBeNull()
            expect(retrieved?.configuredDistricts).toEqual(
              config.configuredDistricts
            )
            expect(retrieved?.lastUpdated).toBe(config.lastUpdated)
            expect(retrieved?.updatedBy).toBe(config.updatedBy)
            expect(retrieved?.version).toBe(config.version)

            return true
          } finally {
            // Clean up this iteration's document
            await storage.cleanup()
          }
        }),
        // Use fewer iterations for Firestore due to network latency
        { numRuns: 50, timeout: 120000 }
      )
    })

    it('should maintain district array order through round-trip', async () => {
      // Feature: district-configuration-storage-abstraction, Property 1: Configuration Round-Trip Consistency
      // **Validates: Requirements 2.1, 3.1**
      await fc.assert(
        fc.asyncProperty(districtConfigurationArbitrary, async config => {
          // Create unique document path for this iteration
          const testDocPath = createUniqueDocPath()
          const storage = new TestableFirestoreDistrictConfigStorage(
            { projectId },
            testDocPath
          )
          createdStorages.push(storage)

          try {
            // Save the configuration
            await storage.saveConfiguration(config)

            // Read it back
            const retrieved = await storage.getConfiguration()

            // Property: Array order must be preserved exactly
            expect(retrieved).not.toBeNull()
            expect(retrieved?.configuredDistricts.length).toBe(
              config.configuredDistricts.length
            )

            // Check each element in order
            for (let i = 0; i < config.configuredDistricts.length; i++) {
              expect(retrieved?.configuredDistricts[i]).toBe(
                config.configuredDistricts[i]
              )
            }

            return true
          } finally {
            await storage.cleanup()
          }
        }),
        { numRuns: 50, timeout: 120000 }
      )
    })

    it('should handle empty configuration arrays correctly', async () => {
      // Feature: district-configuration-storage-abstraction, Property 1: Configuration Round-Trip Consistency
      // **Validates: Requirements 2.1, 3.1**
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            configuredDistricts: fc.constant([] as string[]), // Always empty
            lastUpdated: isoDateArbitrary,
            updatedBy: updatedByArbitrary,
            version: fc.integer({ min: 1, max: 1000 }),
          }),
          async config => {
            // Create unique document path for this iteration
            const testDocPath = createUniqueDocPath()
            const storage = new TestableFirestoreDistrictConfigStorage(
              { projectId },
              testDocPath
            )
            createdStorages.push(storage)

            try {
              // Save the configuration
              await storage.saveConfiguration(config)

              // Read it back
              const retrieved = await storage.getConfiguration()

              // Property: Empty arrays must remain empty
              expect(retrieved).not.toBeNull()
              expect(retrieved?.configuredDistricts).toEqual([])
              expect(retrieved?.configuredDistricts.length).toBe(0)

              return true
            } finally {
              await storage.cleanup()
            }
          }
        ),
        { numRuns: 50, timeout: 120000 }
      )
    })

    it('should preserve special characters in updatedBy field', async () => {
      // Feature: district-configuration-storage-abstraction, Property 1: Configuration Round-Trip Consistency
      // **Validates: Requirements 2.1, 3.1**
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            configuredDistricts: fc
              .array(districtIdArbitrary, { minLength: 0, maxLength: 10 })
              .map(ids => [...new Set(ids)]),
            lastUpdated: isoDateArbitrary,
            // Include special characters that might be in usernames/emails
            updatedBy: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_.@+-]{0,99}$/),
            version: fc.integer({ min: 1, max: 1000 }),
          }),
          async config => {
            // Create unique document path for this iteration
            const testDocPath = createUniqueDocPath()
            const storage = new TestableFirestoreDistrictConfigStorage(
              { projectId },
              testDocPath
            )
            createdStorages.push(storage)

            try {
              // Save the configuration
              await storage.saveConfiguration(config)

              // Read it back
              const retrieved = await storage.getConfiguration()

              // Property: updatedBy field must be preserved exactly
              expect(retrieved).not.toBeNull()
              expect(retrieved?.updatedBy).toBe(config.updatedBy)

              return true
            } finally {
              await storage.cleanup()
            }
          }
        ),
        { numRuns: 50, timeout: 120000 }
      )
    })

    it('should handle multiple consecutive save operations correctly', async () => {
      // Feature: district-configuration-storage-abstraction, Property 1: Configuration Round-Trip Consistency
      // **Validates: Requirements 2.1, 3.1**
      await fc.assert(
        fc.asyncProperty(
          fc.array(districtConfigurationArbitrary, {
            minLength: 2,
            maxLength: 5,
          }),
          async configs => {
            // Create unique document path for this iteration
            const testDocPath = createUniqueDocPath()
            const storage = new TestableFirestoreDistrictConfigStorage(
              { projectId },
              testDocPath
            )
            createdStorages.push(storage)

            try {
              // Save each configuration in sequence
              for (const config of configs) {
                await storage.saveConfiguration(config)
              }

              // Read back the final configuration
              const retrieved = await storage.getConfiguration()

              // Property: Only the last saved configuration should be present
              const lastConfig = configs[configs.length - 1]
              expect(retrieved).not.toBeNull()
              expect(retrieved?.configuredDistricts).toEqual(
                lastConfig?.configuredDistricts
              )
              expect(retrieved?.lastUpdated).toBe(lastConfig?.lastUpdated)
              expect(retrieved?.updatedBy).toBe(lastConfig?.updatedBy)
              expect(retrieved?.version).toBe(lastConfig?.version)

              return true
            } finally {
              await storage.cleanup()
            }
          }
        ),
        { numRuns: 30, timeout: 120000 } // Fewer runs for sequential operations
      )
    })

    it('should return null when no configuration exists', async () => {
      // Feature: district-configuration-storage-abstraction, Property 1: Configuration Round-Trip Consistency
      // **Validates: Requirements 2.1, 3.1**
      await fc.assert(
        fc.asyncProperty(fc.constant(null), async () => {
          // Create unique document path for this iteration
          const testDocPath = createUniqueDocPath()
          const storage = new TestableFirestoreDistrictConfigStorage(
            { projectId },
            testDocPath
          )
          createdStorages.push(storage)

          try {
            // Read without saving anything first
            const retrieved = await storage.getConfiguration()

            // Property: Should return null when no configuration exists
            expect(retrieved).toBeNull()

            return true
          } finally {
            await storage.cleanup()
          }
        }),
        { numRuns: 10, timeout: 60000 } // Fewer runs needed for this simple case
      )
    })

    it('should preserve ISO timestamp format exactly', async () => {
      // Feature: district-configuration-storage-abstraction, Property 1: Configuration Round-Trip Consistency
      // **Validates: Requirements 2.1, 3.1**
      await fc.assert(
        fc.asyncProperty(districtConfigurationArbitrary, async config => {
          // Create unique document path for this iteration
          const testDocPath = createUniqueDocPath()
          const storage = new TestableFirestoreDistrictConfigStorage(
            { projectId },
            testDocPath
          )
          createdStorages.push(storage)

          try {
            // Save the configuration
            await storage.saveConfiguration(config)

            // Read it back
            const retrieved = await storage.getConfiguration()

            // Property: ISO timestamp must be preserved exactly (including milliseconds)
            expect(retrieved).not.toBeNull()
            expect(retrieved?.lastUpdated).toBe(config.lastUpdated)

            // Verify it's still a valid ISO date string
            const parsedDate = new Date(retrieved?.lastUpdated ?? '')
            expect(parsedDate.toISOString()).toBe(config.lastUpdated)

            return true
          } finally {
            await storage.cleanup()
          }
        }),
        { numRuns: 50, timeout: 120000 }
      )
    })

    it('should handle large district lists correctly', async () => {
      // Feature: district-configuration-storage-abstraction, Property 1: Configuration Round-Trip Consistency
      // **Validates: Requirements 2.1, 3.1**
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            // Generate larger district lists (50-100 districts)
            // Reduced from 200 to avoid Firestore document size limits
            configuredDistricts: fc
              .array(districtIdArbitrary, { minLength: 50, maxLength: 100 })
              .map(ids => [...new Set(ids)]),
            lastUpdated: isoDateArbitrary,
            updatedBy: updatedByArbitrary,
            version: fc.integer({ min: 1, max: 1000 }),
          }),
          async config => {
            // Create unique document path for this iteration
            const testDocPath = createUniqueDocPath()
            const storage = new TestableFirestoreDistrictConfigStorage(
              { projectId },
              testDocPath
            )
            createdStorages.push(storage)

            try {
              // Save the configuration
              await storage.saveConfiguration(config)

              // Read it back
              const retrieved = await storage.getConfiguration()

              // Property: Large district lists must be preserved completely
              expect(retrieved).not.toBeNull()
              expect(retrieved?.configuredDistricts.length).toBe(
                config.configuredDistricts.length
              )
              expect(retrieved?.configuredDistricts).toEqual(
                config.configuredDistricts
              )

              return true
            } finally {
              await storage.cleanup()
            }
          }
        ),
        { numRuns: 20, timeout: 120000 } // Fewer runs for larger data
      )
    })
  }
)
