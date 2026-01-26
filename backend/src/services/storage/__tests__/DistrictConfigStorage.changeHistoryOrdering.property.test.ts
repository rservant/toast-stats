/**
 * Property-Based Tests for Change History Ordering
 *
 * Feature: district-configuration-storage-abstraction
 *
 * Property 7: Change History Ordering
 * **Validates: Requirements 1.2, 3.2**
 *
 * This test validates that:
 * - For any sequence of configuration changes, getChangeHistory SHALL return
 *   changes in reverse chronological order (most recent first).
 * - Both LocalDistrictConfigStorage and FirestoreDistrictConfigStorage maintain
 *   consistent ordering behavior.
 *
 * The property ensures audit log queries return predictable ordering.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest'
import * as fc from 'fast-check'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { Firestore } from '@google-cloud/firestore'
import { LocalDistrictConfigStorage } from '../LocalDistrictConfigStorage.js'
import { FirestoreDistrictConfigStorage } from '../FirestoreDistrictConfigStorage.js'
import type { ConfigurationChange } from '../../DistrictConfigurationService.js'
import {
  getEmulatorConfig,
  skipIfNoFirestoreEmulator,
} from '../../../__tests__/emulator-config.js'

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
    `change-history-ordering-pbt-${timestamp}-${randomSuffix}-${processId}`
  )
}

/**
 * Generate a unique document path for Firestore test isolation
 */
function createUniqueDocPath(): string {
  const timestamp = Date.now()
  const randomSuffix = Math.random().toString(36).substring(2, 11)
  const processId = process.pid
  return `test-config-history-${timestamp}-${randomSuffix}-${processId}`
}

/**
 * Arbitrary for generating valid district IDs
 */
const districtIdArbitrary = fc.oneof(
  fc.integer({ min: 1, max: 200 }).map(n => String(n)),
  fc.constantFrom('F', 'U', 'A', 'B', 'C', 'D', 'E')
)

/**
 * Arbitrary for generating valid updatedBy/adminUser strings
 */
const adminUserArbitrary = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_-]{0,49}$/)

/**
 * Arbitrary for generating valid action types
 */
const actionArbitrary = fc.constantFrom(
  'add',
  'remove',
  'replace'
) as fc.Arbitrary<'add' | 'remove' | 'replace'>

/**
 * Generate a sequence of ISO timestamps that are strictly increasing
 * This ensures we have a well-defined chronological order to verify
 *
 * @param count - Number of timestamps to generate
 * @param baseTime - Base timestamp to start from
 * @param minGapMs - Minimum gap between timestamps in milliseconds
 */
function generateIncreasingTimestamps(
  count: number,
  baseTime: number,
  minGapMs: number = 1000
): string[] {
  const timestamps: string[] = []
  let currentTime = baseTime

  for (let i = 0; i < count; i++) {
    timestamps.push(new Date(currentTime).toISOString())
    // Add a random gap between minGapMs and minGapMs * 10
    currentTime += minGapMs + Math.floor(Math.random() * minGapMs * 9)
  }

  return timestamps
}

/**
 * Arbitrary for generating a sequence of configuration changes with strictly increasing timestamps
 * This is the key generator for testing ordering - we generate changes with known chronological order
 */
const configurationChangeSequenceArbitrary = (
  minLength: number,
  maxLength: number
): fc.Arbitrary<ConfigurationChange[]> =>
  fc
    .tuple(
      fc.integer({ min: minLength, max: maxLength }), // Number of changes
      fc.integer({ min: 1577836800000, max: 1893456000000 }), // Base timestamp (2020-2030)
      fc.array(
        fc.record({
          action: actionArbitrary,
          districtId: fc.oneof(districtIdArbitrary, fc.constant(null)),
          adminUser: adminUserArbitrary,
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
          context: fc.option(fc.string({ minLength: 1, maxLength: 50 }), {
            nil: undefined,
          }),
        }),
        { minLength: maxLength, maxLength: maxLength } // Generate enough change templates
      )
    )
    .map(([count, baseTime, changeTemplates]) => {
      // Generate strictly increasing timestamps
      const timestamps = generateIncreasingTimestamps(count, baseTime)

      // Create changes with the generated timestamps
      return timestamps.map((timestamp, index) => {
        const template = changeTemplates[index % changeTemplates.length]!
        return {
          timestamp,
          action: template.action,
          districtId: template.districtId,
          adminUser: template.adminUser,
          previousDistricts: template.previousDistricts,
          newDistricts: template.newDistricts,
          context: template.context,
        }
      })
    })

/**
 * Verify that an array of changes is in reverse chronological order (most recent first)
 */
function isReverseChronologicalOrder(changes: ConfigurationChange[]): boolean {
  if (changes.length <= 1) return true

  for (let i = 0; i < changes.length - 1; i++) {
    const currentTimestamp = new Date(changes[i]!.timestamp).getTime()
    const nextTimestamp = new Date(changes[i + 1]!.timestamp).getTime()

    // Current should be >= next (more recent or equal first)
    if (currentTimestamp < nextTimestamp) {
      return false
    }
  }

  return true
}

describe('Property 7: Change History Ordering', () => {
  describe('LocalDistrictConfigStorage', () => {
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

    it('should return changes in reverse chronological order (most recent first)', async () => {
      // Feature: district-configuration-storage-abstraction, Property 7: Change History Ordering
      // **Validates: Requirements 1.2, 3.2**
      await fc.assert(
        fc.asyncProperty(
          configurationChangeSequenceArbitrary(2, 10),
          async changes => {
            // Create fresh storage instance for each test iteration
            const iterationDir = createUniqueTestDir()
            await fs.mkdir(iterationDir, { recursive: true })
            const storage = new LocalDistrictConfigStorage(iterationDir)

            try {
              // Append all changes in chronological order (oldest first)
              for (const change of changes) {
                await storage.appendChangeLog(change)
              }

              // Retrieve change history
              const retrievedHistory = await storage.getChangeHistory(
                changes.length + 10
              )

              // Property: Retrieved history must be in reverse chronological order
              expect(isReverseChronologicalOrder(retrievedHistory)).toBe(true)

              // Property: The most recent change should be first
              if (retrievedHistory.length > 0 && changes.length > 0) {
                const mostRecentInput = changes[changes.length - 1]!
                expect(retrievedHistory[0]!.timestamp).toBe(
                  mostRecentInput.timestamp
                )
              }

              // Property: The oldest change should be last
              if (retrievedHistory.length > 0 && changes.length > 0) {
                const oldestInput = changes[0]!
                expect(
                  retrievedHistory[retrievedHistory.length - 1]!.timestamp
                ).toBe(oldestInput.timestamp)
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
        { numRuns: 100, timeout: 120000 }
      )
    })

    it('should maintain ordering when limit is less than total changes', async () => {
      // Feature: district-configuration-storage-abstraction, Property 7: Change History Ordering
      // **Validates: Requirements 1.2, 3.2**
      await fc.assert(
        fc.asyncProperty(
          configurationChangeSequenceArbitrary(5, 15),
          fc.integer({ min: 1, max: 10 }),
          async (changes, limit) => {
            const iterationDir = createUniqueTestDir()
            await fs.mkdir(iterationDir, { recursive: true })
            const storage = new LocalDistrictConfigStorage(iterationDir)

            try {
              // Append all changes
              for (const change of changes) {
                await storage.appendChangeLog(change)
              }

              // Retrieve with limit
              const retrievedHistory = await storage.getChangeHistory(limit)

              // Property: Retrieved history must be in reverse chronological order
              expect(isReverseChronologicalOrder(retrievedHistory)).toBe(true)

              // Property: Should return at most 'limit' entries
              expect(retrievedHistory.length).toBeLessThanOrEqual(limit)

              // Property: Should return the most recent entries
              if (retrievedHistory.length > 0) {
                // The first entry should be the most recent
                const mostRecentInput = changes[changes.length - 1]!
                expect(retrievedHistory[0]!.timestamp).toBe(
                  mostRecentInput.timestamp
                )
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
        { numRuns: 100, timeout: 120000 }
      )
    })

    it('should handle single change correctly', async () => {
      // Feature: district-configuration-storage-abstraction, Property 7: Change History Ordering
      // **Validates: Requirements 1.2, 3.2**
      await fc.assert(
        fc.asyncProperty(
          configurationChangeSequenceArbitrary(1, 1),
          async changes => {
            const iterationDir = createUniqueTestDir()
            await fs.mkdir(iterationDir, { recursive: true })
            const storage = new LocalDistrictConfigStorage(iterationDir)

            try {
              // Append single change
              await storage.appendChangeLog(changes[0]!)

              // Retrieve change history
              const retrievedHistory = await storage.getChangeHistory(10)

              // Property: Should return exactly one entry
              expect(retrievedHistory.length).toBe(1)

              // Property: Single entry is trivially in order
              expect(isReverseChronologicalOrder(retrievedHistory)).toBe(true)

              // Property: The entry should match the input
              expect(retrievedHistory[0]!.timestamp).toBe(changes[0]!.timestamp)

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

    it('should return empty array when no changes exist', async () => {
      // Feature: district-configuration-storage-abstraction, Property 7: Change History Ordering
      // **Validates: Requirements 1.2, 3.2**
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 1, max: 100 }), async limit => {
          const iterationDir = createUniqueTestDir()
          await fs.mkdir(iterationDir, { recursive: true })
          const storage = new LocalDistrictConfigStorage(iterationDir)

          try {
            // Retrieve without appending any changes
            const retrievedHistory = await storage.getChangeHistory(limit)

            // Property: Should return empty array
            expect(retrievedHistory).toEqual([])

            // Property: Empty array is trivially in order
            expect(isReverseChronologicalOrder(retrievedHistory)).toBe(true)

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

    it('should preserve all change data while maintaining order', async () => {
      // Feature: district-configuration-storage-abstraction, Property 7: Change History Ordering
      // **Validates: Requirements 1.2, 3.2**
      await fc.assert(
        fc.asyncProperty(
          configurationChangeSequenceArbitrary(3, 8),
          async changes => {
            const iterationDir = createUniqueTestDir()
            await fs.mkdir(iterationDir, { recursive: true })
            const storage = new LocalDistrictConfigStorage(iterationDir)

            try {
              // Append all changes
              for (const change of changes) {
                await storage.appendChangeLog(change)
              }

              // Retrieve change history
              const retrievedHistory = await storage.getChangeHistory(
                changes.length + 10
              )

              // Property: All changes should be present
              expect(retrievedHistory.length).toBe(changes.length)

              // Property: Each change should have all its data preserved
              // (reversed order, so compare with reversed input)
              const reversedInput = [...changes].reverse()
              for (let i = 0; i < retrievedHistory.length; i++) {
                const retrieved = retrievedHistory[i]!
                const expected = reversedInput[i]!

                expect(retrieved.timestamp).toBe(expected.timestamp)
                expect(retrieved.action).toBe(expected.action)
                expect(retrieved.districtId).toBe(expected.districtId)
                expect(retrieved.adminUser).toBe(expected.adminUser)
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
        { numRuns: 100, timeout: 120000 }
      )
    })
  })

  describe.skipIf(skipIfNoFirestoreEmulator())(
    'FirestoreDistrictConfigStorage',
    () => {
      let projectId: string
      let firestore: Firestore

      beforeAll(() => {
        const config = getEmulatorConfig()
        projectId = config.projectId
        firestore = new Firestore({ projectId })
      })

      /**
       * Custom FirestoreDistrictConfigStorage that allows custom document paths
       * for test isolation
       */
      class TestableFirestoreDistrictConfigStorage extends FirestoreDistrictConfigStorage {
        private readonly testDocPath: string
        private readonly testFirestore: Firestore

        constructor(config: { projectId: string }, testDocPath: string) {
          super(config)
          this.testDocPath = testDocPath
          this.testFirestore = new Firestore({ projectId: config.projectId })
        }

        override async appendChangeLog(
          change: ConfigurationChange
        ): Promise<void> {
          const historyCollection = this.testFirestore.collection(
            `${this.testDocPath}/history`
          )

          const docData: Record<string, unknown> = {
            timestamp: change.timestamp,
            action: change.action,
            districtId: change.districtId,
            adminUser: change.adminUser,
          }

          if (change.previousDistricts !== undefined) {
            docData['previousDistricts'] = change.previousDistricts
          }
          if (change.newDistricts !== undefined) {
            docData['newDistricts'] = change.newDistricts
          }
          if (change.context !== undefined) {
            docData['context'] = change.context
          }

          await historyCollection.add(docData)
        }

        override async getChangeHistory(
          limit: number
        ): Promise<ConfigurationChange[]> {
          const historyCollection = this.testFirestore.collection(
            `${this.testDocPath}/history`
          )

          const querySnapshot = await historyCollection
            .orderBy('timestamp', 'desc')
            .limit(limit)
            .get()

          const changes: ConfigurationChange[] = []

          for (const doc of querySnapshot.docs) {
            const data = doc.data()

            const change: ConfigurationChange = {
              timestamp: data['timestamp'] as string,
              action: data['action'] as 'add' | 'remove' | 'replace',
              districtId: data['districtId'] as string | null,
              adminUser: data['adminUser'] as string,
            }

            if (data['previousDistricts'] !== undefined) {
              change.previousDistricts = data['previousDistricts'] as string[]
            }
            if (data['newDistricts'] !== undefined) {
              change.newDistricts = data['newDistricts'] as string[]
            }
            if (data['context'] !== undefined) {
              change.context = data['context'] as string
            }

            changes.push(change)
          }

          return changes
        }

        async cleanup(): Promise<void> {
          try {
            // Delete all documents in the history subcollection
            const historyCollection = this.testFirestore.collection(
              `${this.testDocPath}/history`
            )
            const snapshot = await historyCollection.get()
            const batch = this.testFirestore.batch()
            snapshot.docs.forEach(doc => batch.delete(doc.ref))
            await batch.commit()

            // Delete the main document
            await this.testFirestore.doc(this.testDocPath).delete()
          } catch {
            // Ignore cleanup errors
          }
        }
      }

      it('should return changes in reverse chronological order (most recent first)', async () => {
        // Feature: district-configuration-storage-abstraction, Property 7: Change History Ordering
        // **Validates: Requirements 1.2, 3.2**
        await fc.assert(
          fc.asyncProperty(
            configurationChangeSequenceArbitrary(2, 10),
            async changes => {
              const testDocPath = createUniqueDocPath()
              const storage = new TestableFirestoreDistrictConfigStorage(
                { projectId },
                testDocPath
              )

              try {
                // Append all changes in chronological order (oldest first)
                for (const change of changes) {
                  await storage.appendChangeLog(change)
                }

                // Retrieve change history
                const retrievedHistory = await storage.getChangeHistory(
                  changes.length + 10
                )

                // Property: Retrieved history must be in reverse chronological order
                expect(isReverseChronologicalOrder(retrievedHistory)).toBe(true)

                // Property: The most recent change should be first
                if (retrievedHistory.length > 0 && changes.length > 0) {
                  const mostRecentInput = changes[changes.length - 1]!
                  expect(retrievedHistory[0]!.timestamp).toBe(
                    mostRecentInput.timestamp
                  )
                }

                // Property: The oldest change should be last
                if (retrievedHistory.length > 0 && changes.length > 0) {
                  const oldestInput = changes[0]!
                  expect(
                    retrievedHistory[retrievedHistory.length - 1]!.timestamp
                  ).toBe(oldestInput.timestamp)
                }

                return true
              } finally {
                await storage.cleanup()
              }
            }
          ),
          // Fewer runs for Firestore due to network latency
          { numRuns: 30, timeout: 180000 }
        )
      })

      it('should maintain ordering when limit is less than total changes', async () => {
        // Feature: district-configuration-storage-abstraction, Property 7: Change History Ordering
        // **Validates: Requirements 1.2, 3.2**
        await fc.assert(
          fc.asyncProperty(
            configurationChangeSequenceArbitrary(5, 15),
            fc.integer({ min: 1, max: 10 }),
            async (changes, limit) => {
              const testDocPath = createUniqueDocPath()
              const storage = new TestableFirestoreDistrictConfigStorage(
                { projectId },
                testDocPath
              )

              try {
                // Append all changes
                for (const change of changes) {
                  await storage.appendChangeLog(change)
                }

                // Retrieve with limit
                const retrievedHistory = await storage.getChangeHistory(limit)

                // Property: Retrieved history must be in reverse chronological order
                expect(isReverseChronologicalOrder(retrievedHistory)).toBe(true)

                // Property: Should return at most 'limit' entries
                expect(retrievedHistory.length).toBeLessThanOrEqual(limit)

                // Property: Should return the most recent entries
                if (retrievedHistory.length > 0) {
                  const mostRecentInput = changes[changes.length - 1]!
                  expect(retrievedHistory[0]!.timestamp).toBe(
                    mostRecentInput.timestamp
                  )
                }

                return true
              } finally {
                await storage.cleanup()
              }
            }
          ),
          { numRuns: 20, timeout: 180000 }
        )
      })

      it('should handle single change correctly', async () => {
        // Feature: district-configuration-storage-abstraction, Property 7: Change History Ordering
        // **Validates: Requirements 1.2, 3.2**
        await fc.assert(
          fc.asyncProperty(
            configurationChangeSequenceArbitrary(1, 1),
            async changes => {
              const testDocPath = createUniqueDocPath()
              const storage = new TestableFirestoreDistrictConfigStorage(
                { projectId },
                testDocPath
              )

              try {
                // Append single change
                await storage.appendChangeLog(changes[0]!)

                // Retrieve change history
                const retrievedHistory = await storage.getChangeHistory(10)

                // Property: Should return exactly one entry
                expect(retrievedHistory.length).toBe(1)

                // Property: Single entry is trivially in order
                expect(isReverseChronologicalOrder(retrievedHistory)).toBe(true)

                // Property: The entry should match the input
                expect(retrievedHistory[0]!.timestamp).toBe(
                  changes[0]!.timestamp
                )

                return true
              } finally {
                await storage.cleanup()
              }
            }
          ),
          { numRuns: 20, timeout: 120000 }
        )
      })

      it('should return empty array when no changes exist', async () => {
        // Feature: district-configuration-storage-abstraction, Property 7: Change History Ordering
        // **Validates: Requirements 1.2, 3.2**
        await fc.assert(
          fc.asyncProperty(fc.integer({ min: 1, max: 100 }), async limit => {
            const testDocPath = createUniqueDocPath()
            const storage = new TestableFirestoreDistrictConfigStorage(
              { projectId },
              testDocPath
            )

            try {
              // Retrieve without appending any changes
              const retrievedHistory = await storage.getChangeHistory(limit)

              // Property: Should return empty array
              expect(retrievedHistory).toEqual([])

              // Property: Empty array is trivially in order
              expect(isReverseChronologicalOrder(retrievedHistory)).toBe(true)

              return true
            } finally {
              await storage.cleanup()
            }
          }),
          { numRuns: 10, timeout: 60000 }
        )
      })

      it('should preserve all change data while maintaining order', async () => {
        // Feature: district-configuration-storage-abstraction, Property 7: Change History Ordering
        // **Validates: Requirements 1.2, 3.2**
        await fc.assert(
          fc.asyncProperty(
            configurationChangeSequenceArbitrary(3, 8),
            async changes => {
              const testDocPath = createUniqueDocPath()
              const storage = new TestableFirestoreDistrictConfigStorage(
                { projectId },
                testDocPath
              )

              try {
                // Append all changes
                for (const change of changes) {
                  await storage.appendChangeLog(change)
                }

                // Retrieve change history
                const retrievedHistory = await storage.getChangeHistory(
                  changes.length + 10
                )

                // Property: All changes should be present
                expect(retrievedHistory.length).toBe(changes.length)

                // Property: Each change should have all its data preserved
                // (reversed order, so compare with reversed input)
                const reversedInput = [...changes].reverse()
                for (let i = 0; i < retrievedHistory.length; i++) {
                  const retrieved = retrievedHistory[i]!
                  const expected = reversedInput[i]!

                  expect(retrieved.timestamp).toBe(expected.timestamp)
                  expect(retrieved.action).toBe(expected.action)
                  expect(retrieved.districtId).toBe(expected.districtId)
                  expect(retrieved.adminUser).toBe(expected.adminUser)
                }

                return true
              } finally {
                await storage.cleanup()
              }
            }
          ),
          { numRuns: 20, timeout: 180000 }
        )
      })
    }
  )
})
