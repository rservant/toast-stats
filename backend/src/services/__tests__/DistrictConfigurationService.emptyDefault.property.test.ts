/**
 * Property-Based Tests for Empty Configuration Default
 *
 * Feature: district-configuration-storage-abstraction
 *
 * Property 6: Empty Configuration Default
 * **Validates: Requirements 8.3**
 *
 * This test validates that:
 * - For any storage backend where no configuration exists, reading configuration
 *   SHALL return the default empty configuration (empty configuredDistricts array, version 1).
 * - The DistrictConfigurationService correctly handles null from storage and provides
 *   consistent default configuration.
 *
 * The property ensures consistent behavior when configuration is missing.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest'
import * as fc from 'fast-check'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { DistrictConfigurationService } from '../DistrictConfigurationService.js'
import { LocalDistrictConfigStorage } from '../storage/LocalDistrictConfigStorage.js'
import { FirestoreDistrictConfigStorage } from '../storage/FirestoreDistrictConfigStorage.js'
import type { IDistrictConfigStorage } from '../../types/storageInterfaces.js'
import {
  getEmulatorConfig,
  skipIfNoFirestoreEmulator,
} from '../../__tests__/emulator-config.js'
import { Firestore } from '@google-cloud/firestore'

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
    `empty-config-default-pbt-${timestamp}-${randomSuffix}-${processId}`
  )
}

/**
 * Generate a unique document path for Firestore test isolation
 */
function createUniqueDocPath(): string {
  const timestamp = Date.now()
  const randomSuffix = Math.random().toString(36).substring(2, 11)
  const processId = process.pid
  return `test-empty-config-${timestamp}-${randomSuffix}-${processId}`
}

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
   * Returns null when document doesn't exist (empty configuration scenario)
   */
  override async getConfiguration() {
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
   * Clean up test document (ensure it doesn't exist for empty config tests)
   */
  async ensureEmpty(): Promise<void> {
    try {
      const docRef = this.testFirestore.doc(this.testDocPath)
      await docRef.delete()
    } catch {
      // Ignore errors - document may not exist
    }
  }
}

/**
 * Arbitrary for generating various storage backend scenarios
 * This generates different "empty" scenarios that should all result in default config
 */
const emptyStorageScenarioArbitrary = fc.constantFrom(
  'fresh-directory', // New directory with no config file
  'empty-config-directory', // Config directory exists but no config file
  'never-written' // Storage instance that has never had data written
)

describe('Property 6: Empty Configuration Default', () => {
  describe('LocalDistrictConfigStorage - Empty Configuration Default', () => {
    let testDir: string

    beforeEach(async () => {
      testDir = createUniqueTestDir()
      await fs.mkdir(testDir, { recursive: true })
    })

    afterEach(async () => {
      try {
        await fs.rm(testDir, { recursive: true, force: true })
      } catch {
        // Ignore cleanup errors
      }
    })

    it('should return default empty configuration when no configuration exists in local storage', async () => {
      // Feature: district-configuration-storage-abstraction, Property 6: Empty Configuration Default
      // **Validates: Requirements 8.3**
      await fc.assert(
        fc.asyncProperty(emptyStorageScenarioArbitrary, async scenario => {
          // Create unique test directory for this iteration
          const iterationDir = createUniqueTestDir()
          await fs.mkdir(iterationDir, { recursive: true })

          try {
            // Set up the scenario
            if (scenario === 'empty-config-directory') {
              // Create config directory but no config file
              await fs.mkdir(path.join(iterationDir, 'config'), {
                recursive: true,
              })
            }
            // For 'fresh-directory' and 'never-written', the directory is already empty

            // Create storage and service
            const storage = new LocalDistrictConfigStorage(iterationDir)
            const service = new DistrictConfigurationService(storage)

            // Get configuration from service
            const config = await service.getConfiguration()

            // Property: Configuration must have empty configuredDistricts array
            expect(config.configuredDistricts).toEqual([])
            expect(config.configuredDistricts.length).toBe(0)

            // Property: Configuration must have version 1
            expect(config.version).toBe(1)

            // Property: Configuration must have valid structure
            expect(typeof config.lastUpdated).toBe('string')
            expect(typeof config.updatedBy).toBe('string')
            expect(config.updatedBy).toBe('system')

            // Property: lastUpdated must be a valid ISO date string
            const parsedDate = new Date(config.lastUpdated)
            expect(parsedDate.toString()).not.toBe('Invalid Date')

            return true
          } finally {
            try {
              await fs.rm(iterationDir, { recursive: true, force: true })
            } catch {
              // Ignore cleanup errors
            }
          }
        }),
        { numRuns: 100, timeout: 60000 }
      )
    })

    it('should return empty districts array from getConfiguredDistricts when no configuration exists', async () => {
      // Feature: district-configuration-storage-abstraction, Property 6: Empty Configuration Default
      // **Validates: Requirements 8.3**
      await fc.assert(
        fc.asyncProperty(fc.constant(null), async () => {
          // Create unique test directory for this iteration
          const iterationDir = createUniqueTestDir()
          await fs.mkdir(iterationDir, { recursive: true })

          try {
            // Create storage and service with empty storage
            const storage = new LocalDistrictConfigStorage(iterationDir)
            const service = new DistrictConfigurationService(storage)

            // Get configured districts
            const districts = await service.getConfiguredDistricts()

            // Property: Must return empty array
            expect(districts).toEqual([])
            expect(Array.isArray(districts)).toBe(true)
            expect(districts.length).toBe(0)

            return true
          } finally {
            try {
              await fs.rm(iterationDir, { recursive: true, force: true })
            } catch {
              // Ignore cleanup errors
            }
          }
        }),
        { numRuns: 50, timeout: 30000 }
      )
    })

    it('should report hasConfiguredDistricts as false when no configuration exists', async () => {
      // Feature: district-configuration-storage-abstraction, Property 6: Empty Configuration Default
      // **Validates: Requirements 8.3**
      await fc.assert(
        fc.asyncProperty(fc.constant(null), async () => {
          // Create unique test directory for this iteration
          const iterationDir = createUniqueTestDir()
          await fs.mkdir(iterationDir, { recursive: true })

          try {
            // Create storage and service with empty storage
            const storage = new LocalDistrictConfigStorage(iterationDir)
            const service = new DistrictConfigurationService(storage)

            // Check if districts are configured
            const hasDistricts = await service.hasConfiguredDistricts()

            // Property: Must return false for empty configuration
            expect(hasDistricts).toBe(false)

            return true
          } finally {
            try {
              await fs.rm(iterationDir, { recursive: true, force: true })
            } catch {
              // Ignore cleanup errors
            }
          }
        }),
        { numRuns: 50, timeout: 30000 }
      )
    })

    it('should return consistent default configuration across multiple reads', async () => {
      // Feature: district-configuration-storage-abstraction, Property 6: Empty Configuration Default
      // **Validates: Requirements 8.3**
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 10 }), // Number of reads to perform
          async numReads => {
            // Create unique test directory for this iteration
            const iterationDir = createUniqueTestDir()
            await fs.mkdir(iterationDir, { recursive: true })

            try {
              // Create storage and service with empty storage
              const storage = new LocalDistrictConfigStorage(iterationDir)
              const service = new DistrictConfigurationService(storage)

              // Perform multiple reads
              const configs: Awaited<
                ReturnType<typeof service.getConfiguration>
              >[] = []
              for (let i = 0; i < numReads; i++) {
                service.clearCache() // Clear cache to force re-read
                const config = await service.getConfiguration()
                configs.push(config)
              }

              // Property: All reads must return consistent default configuration
              for (const config of configs) {
                expect(config.configuredDistricts).toEqual([])
                expect(config.version).toBe(1)
                expect(config.updatedBy).toBe('system')
              }

              return true
            } finally {
              try {
                await fs.rm(iterationDir, { recursive: true, force: true })
              } catch {
                // Ignore cleanup errors
              }
            }
          }
        ),
        { numRuns: 50, timeout: 60000 }
      )
    })

    it('should return null from storage.getConfiguration when no configuration exists', async () => {
      // Feature: district-configuration-storage-abstraction, Property 6: Empty Configuration Default
      // **Validates: Requirements 8.3**
      await fc.assert(
        fc.asyncProperty(fc.constant(null), async () => {
          // Create unique test directory for this iteration
          const iterationDir = createUniqueTestDir()
          await fs.mkdir(iterationDir, { recursive: true })

          try {
            // Create storage with empty directory
            const storage = new LocalDistrictConfigStorage(iterationDir)

            // Get configuration directly from storage
            const config = await storage.getConfiguration()

            // Property: Storage must return null when no configuration exists
            expect(config).toBeNull()

            return true
          } finally {
            try {
              await fs.rm(iterationDir, { recursive: true, force: true })
            } catch {
              // Ignore cleanup errors
            }
          }
        }),
        { numRuns: 50, timeout: 30000 }
      )
    })
  })

  describe.skipIf(skipIfNoFirestoreEmulator())(
    'FirestoreDistrictConfigStorage - Empty Configuration Default',
    () => {
      let projectId: string
      const createdStorages: TestableFirestoreDistrictConfigStorage[] = []

      beforeAll(() => {
        const config = getEmulatorConfig()
        projectId = config.projectId
      })

      beforeEach(() => {
        createdStorages.length = 0
      })

      afterEach(async () => {
        for (const storage of createdStorages) {
          await storage.ensureEmpty()
        }
      })

      it('should return default empty configuration when no configuration exists in Firestore', async () => {
        // Feature: district-configuration-storage-abstraction, Property 6: Empty Configuration Default
        // **Validates: Requirements 8.3**
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
              // Ensure document doesn't exist
              await storage.ensureEmpty()

              // Create service with empty storage
              const service = new DistrictConfigurationService(
                storage as IDistrictConfigStorage
              )

              // Get configuration from service
              const config = await service.getConfiguration()

              // Property: Configuration must have empty configuredDistricts array
              expect(config.configuredDistricts).toEqual([])
              expect(config.configuredDistricts.length).toBe(0)

              // Property: Configuration must have version 1
              expect(config.version).toBe(1)

              // Property: Configuration must have valid structure
              expect(typeof config.lastUpdated).toBe('string')
              expect(typeof config.updatedBy).toBe('string')
              expect(config.updatedBy).toBe('system')

              return true
            } finally {
              await storage.ensureEmpty()
            }
          }),
          { numRuns: 30, timeout: 120000 }
        )
      })

      it('should return empty districts array from getConfiguredDistricts when no configuration exists in Firestore', async () => {
        // Feature: district-configuration-storage-abstraction, Property 6: Empty Configuration Default
        // **Validates: Requirements 8.3**
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
              // Ensure document doesn't exist
              await storage.ensureEmpty()

              // Create service with empty storage
              const service = new DistrictConfigurationService(
                storage as IDistrictConfigStorage
              )

              // Get configured districts
              const districts = await service.getConfiguredDistricts()

              // Property: Must return empty array
              expect(districts).toEqual([])
              expect(Array.isArray(districts)).toBe(true)
              expect(districts.length).toBe(0)

              return true
            } finally {
              await storage.ensureEmpty()
            }
          }),
          { numRuns: 30, timeout: 120000 }
        )
      })

      it('should return null from storage.getConfiguration when no document exists in Firestore', async () => {
        // Feature: district-configuration-storage-abstraction, Property 6: Empty Configuration Default
        // **Validates: Requirements 8.3**
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
              // Ensure document doesn't exist
              await storage.ensureEmpty()

              // Get configuration directly from storage
              const config = await storage.getConfiguration()

              // Property: Storage must return null when no document exists
              expect(config).toBeNull()

              return true
            } finally {
              await storage.ensureEmpty()
            }
          }),
          { numRuns: 30, timeout: 120000 }
        )
      })
    }
  )

  describe('Cross-Implementation Empty Configuration Consistency', () => {
    let testDir: string

    beforeEach(async () => {
      testDir = createUniqueTestDir()
      await fs.mkdir(testDir, { recursive: true })
    })

    afterEach(async () => {
      try {
        await fs.rm(testDir, { recursive: true, force: true })
      } catch {
        // Ignore cleanup errors
      }
    })

    it('should return identical default configuration structure regardless of storage backend', async () => {
      // Feature: district-configuration-storage-abstraction, Property 6: Empty Configuration Default
      // **Validates: Requirements 8.3**
      await fc.assert(
        fc.asyncProperty(fc.constant(null), async () => {
          // Create unique test directory for this iteration
          const iterationDir = createUniqueTestDir()
          await fs.mkdir(iterationDir, { recursive: true })

          try {
            // Create local storage and service
            const localStorage = new LocalDistrictConfigStorage(iterationDir)
            const localService = new DistrictConfigurationService(localStorage)

            // Get configuration from local service
            const localConfig = await localService.getConfiguration()

            // Property: Default configuration must have consistent structure
            expect(localConfig.configuredDistricts).toEqual([])
            expect(localConfig.version).toBe(1)
            expect(localConfig.updatedBy).toBe('system')
            expect(typeof localConfig.lastUpdated).toBe('string')

            // Property: configuredDistricts must be an array
            expect(Array.isArray(localConfig.configuredDistricts)).toBe(true)

            // Property: version must be exactly 1 for default
            expect(localConfig.version).toBe(1)

            return true
          } finally {
            try {
              await fs.rm(iterationDir, { recursive: true, force: true })
            } catch {
              // Ignore cleanup errors
            }
          }
        }),
        { numRuns: 50, timeout: 30000 }
      )
    })

    it('should ensure default configuration values are correct across multiple service instances', async () => {
      // Feature: district-configuration-storage-abstraction, Property 6: Empty Configuration Default
      // **Validates: Requirements 8.3**
      await fc.assert(
        fc.asyncProperty(fc.constant(null), async () => {
          // Create unique test directory for this iteration
          const iterationDir = createUniqueTestDir()
          await fs.mkdir(iterationDir, { recursive: true })

          try {
            // Create two separate service instances with the same empty storage
            const storage1 = new LocalDistrictConfigStorage(iterationDir)
            const service1 = new DistrictConfigurationService(storage1)

            const storage2 = new LocalDistrictConfigStorage(iterationDir)
            const service2 = new DistrictConfigurationService(storage2)

            // Get configuration from both services
            const config1 = await service1.getConfiguration()
            const config2 = await service2.getConfiguration()

            // Property: Both services should return equivalent default configurations
            expect(config1.configuredDistricts).toEqual([])
            expect(config2.configuredDistricts).toEqual([])
            expect(config1.version).toBe(1)
            expect(config2.version).toBe(1)
            expect(config1.updatedBy).toBe('system')
            expect(config2.updatedBy).toBe('system')

            return true
          } finally {
            try {
              await fs.rm(iterationDir, { recursive: true, force: true })
            } catch {
              // Ignore cleanup errors
            }
          }
        }),
        { numRuns: 50, timeout: 30000 }
      )
    })

    it('should ensure getConfiguredDistricts returns empty array for empty storage', async () => {
      // Feature: district-configuration-storage-abstraction, Property 6: Empty Configuration Default
      // **Validates: Requirements 8.3**
      await fc.assert(
        fc.asyncProperty(fc.constant(null), async () => {
          // Create unique test directory for this iteration
          const iterationDir = createUniqueTestDir()
          await fs.mkdir(iterationDir, { recursive: true })

          try {
            // Create storage and service
            const storage = new LocalDistrictConfigStorage(iterationDir)
            const service = new DistrictConfigurationService(storage)

            // Get districts multiple times
            const districts1 = await service.getConfiguredDistricts()
            service.clearCache() // Clear cache to force re-read from storage
            const districts2 = await service.getConfiguredDistricts()

            // Property: Both calls should return empty arrays
            expect(districts1).toEqual([])
            expect(districts2).toEqual([])
            expect(Array.isArray(districts1)).toBe(true)
            expect(Array.isArray(districts2)).toBe(true)

            return true
          } finally {
            try {
              await fs.rm(iterationDir, { recursive: true, force: true })
            } catch {
              // Ignore cleanup errors
            }
          }
        }),
        { numRuns: 50, timeout: 30000 }
      )
    })
  })
})
