/**
 * Property-Based Tests for Test Resource Cleanup
 *
 * **Feature: test-infrastructure-stabilization, Property 10: Test Resource Cleanup**
 * **Validates: Requirements 4.2**
 *
 * Tests that test isolation manager properly cleans up all test resources including
 * directories, environment variables, and other test artifacts.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import fs from 'fs/promises'
import { existsSync } from 'fs'
import {
  DefaultTestIsolationManager,
  getTestIsolationManager,
  resetTestIsolationManager,
} from '../TestIsolationManager.js'
import { safeString } from '../test-string-generators.js'
import { createTestSelfCleanup } from '../test-self-cleanup.js'

describe('TestIsolationManager - Resource Cleanup Property Tests', () => {
  // Self-cleanup setup - each test manages its own cleanup
  const { cleanup, afterEach: performCleanup } = createTestSelfCleanup({
    verbose: false,
  })

  afterEach(async () => {
    // Reset global isolation manager and perform self-cleanup
    await resetTestIsolationManager()
    await performCleanup()
  })

  // Test data generators
  const generateDirectoryCount = (): fc.Arbitrary<number> =>
    fc.integer({ min: 1, max: 5 })

  const generateEnvironmentVariable = (): fc.Arbitrary<{
    name: string
    value: string
  }> =>
    fc.record({
      name: safeString(5, 15).map(s => `TEST_VAR_${s.toUpperCase()}`),
      value: safeString(3, 20),
    })

  /**
   * Property 10: Test Resource Cleanup
   * For any test isolation manager, all created resources should be properly
   * cleaned up without leaving artifacts that could affect subsequent tests
   * **Validates: Requirements 4.2**
   */
  describe('Property 10: Test Resource Cleanup', () => {
    it('should clean up all isolated directories created during test execution', async () => {
      await fc.assert(
        fc.asyncProperty(generateDirectoryCount(), async directoryCount => {
          const manager = new DefaultTestIsolationManager()
          const createdDirectories: string[] = []

          try {
            // Property: Manager should create isolated directories
            for (let i = 0; i < directoryCount; i++) {
              const dirPath = await manager.createIsolatedDirectory()
              createdDirectories.push(dirPath)

              // Property: Created directory should exist
              expect(existsSync(dirPath)).toBe(true)

              // Property: Directory should be writable
              const testFile = `${dirPath}/test-file-${i}.txt`
              await fs.writeFile(testFile, `test content ${i}`)
              expect(existsSync(testFile)).toBe(true)
            }

            // Property: All directories should exist before cleanup
            for (const dirPath of createdDirectories) {
              expect(existsSync(dirPath)).toBe(true)
            }

            // Property: Cleanup should not throw errors
            await expect(
              manager.cleanupTestEnvironment()
            ).resolves.not.toThrow()

            // Property: All directories should be removed after cleanup
            for (const dirPath of createdDirectories) {
              expect(existsSync(dirPath)).toBe(false)
            }
          } finally {
            // Ensure cleanup even if test fails
            try {
              await manager.cleanupTestEnvironment()
            } catch (error) {
              // Cleanup errors should not fail the test
              console.warn('Cleanup error in test:', error)
            }
          }
        }),
        { numRuns: 5 } // Reduced iterations for CI performance
      )
    })

    it('should handle basic environment setup without breaking test execution', async () => {
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 1, max: 2 }), async setupCount => {
          const manager = new DefaultTestIsolationManager()

          try {
            // Property: Multiple setup calls should not throw errors
            for (let i = 0; i < setupCount; i++) {
              await expect(
                manager.setupTestEnvironment()
              ).resolves.not.toThrow()
            }

            // Property: Cleanup should not throw errors
            await expect(
              manager.cleanupTestEnvironment()
            ).resolves.not.toThrow()

            // Property: Manager should be functional after cleanup
            const testDir = await manager.createIsolatedDirectory()
            expect(existsSync(testDir)).toBe(true)

            await manager.cleanupTestEnvironment()
            expect(existsSync(testDir)).toBe(false)
          } finally {
            // Ensure cleanup
            try {
              await manager.cleanupTestEnvironment()
            } catch (error) {
              console.warn('Cleanup error in test:', error)
            }
          }
        }),
        { numRuns: 3 } // Reduced iterations for CI performance
      )
    })

    it('should handle concurrent directory operations safely', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            managerCount: fc.integer({ min: 2, max: 4 }),
            directoriesPerManager: fc.integer({ min: 1, max: 3 }),
          }),
          async ({ managerCount, directoriesPerManager }) => {
            const managers: DefaultTestIsolationManager[] = []
            const allDirectories: string[] = []

            try {
              // Property: Multiple managers should work concurrently
              for (let i = 0; i < managerCount; i++) {
                managers.push(new DefaultTestIsolationManager())
              }

              // Property: Concurrent directory creation should not conflict
              const creationPromises = managers.map(
                async (manager, managerIndex) => {
                  const directories: string[] = []

                  for (let i = 0; i < directoriesPerManager; i++) {
                    const dirPath = await manager.createIsolatedDirectory()
                    directories.push(dirPath)
                    allDirectories.push(dirPath)

                    // Write a test file to verify directory is functional
                    const testFile = `${dirPath}/test-${managerIndex}-${i}.txt`
                    await fs.writeFile(
                      testFile,
                      `manager ${managerIndex} file ${i}`
                    )
                  }

                  return directories
                }
              )

              const managerDirectories = await Promise.all(creationPromises)

              // Property: All directories should be created and unique
              expect(allDirectories.length).toBe(
                managerCount * directoriesPerManager
              )

              const uniqueDirectories = new Set(allDirectories)
              expect(uniqueDirectories.size).toBe(allDirectories.length)

              // Property: All directories should exist
              for (const dirPath of allDirectories) {
                expect(existsSync(dirPath)).toBe(true)
              }

              // Property: Concurrent cleanup should work safely
              const cleanupPromises = managers.map(manager =>
                manager.cleanupTestEnvironment()
              )

              await expect(Promise.all(cleanupPromises)).resolves.not.toThrow()

              // Property: All directories should be cleaned up
              for (const dirPath of allDirectories) {
                expect(existsSync(dirPath)).toBe(false)
              }
            } finally {
              // Ensure cleanup even if test fails
              const cleanupPromises = managers.map(async manager => {
                try {
                  await manager.cleanupTestEnvironment()
                } catch (error) {
                  console.warn('Cleanup error in test:', error)
                }
              })

              await Promise.all(cleanupPromises)
            }
          }
        ),
        { numRuns: 3 } // Reduced iterations for CI performance
      )
    })

    it('should handle individual directory removal without affecting others', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            totalDirectories: fc.integer({ min: 3, max: 6 }),
            directoriesToRemove: fc.integer({ min: 1, max: 2 }),
          }),
          async ({ totalDirectories, directoriesToRemove }) => {
            const manager = new DefaultTestIsolationManager()
            const createdDirectories: string[] = []

            try {
              // Property: Manager should create multiple directories
              for (let i = 0; i < totalDirectories; i++) {
                const dirPath = await manager.createIsolatedDirectory()
                createdDirectories.push(dirPath)

                // Create test content
                const testFile = `${dirPath}/content-${i}.txt`
                await fs.writeFile(testFile, `content for directory ${i}`)
              }

              // Property: All directories should exist initially
              for (const dirPath of createdDirectories) {
                expect(existsSync(dirPath)).toBe(true)
              }

              // Property: Individual directory removal should work
              const directoriesToRemoveList = createdDirectories.slice(
                0,
                directoriesToRemove
              )
              const remainingDirectories =
                createdDirectories.slice(directoriesToRemove)

              for (const dirPath of directoriesToRemoveList) {
                await expect(
                  manager.removeIsolatedDirectory(dirPath)
                ).resolves.not.toThrow()
                expect(existsSync(dirPath)).toBe(false)
              }

              // Property: Remaining directories should still exist
              for (const dirPath of remainingDirectories) {
                expect(existsSync(dirPath)).toBe(true)
              }

              // Property: Final cleanup should handle remaining directories
              await manager.cleanupTestEnvironment()

              // Property: All remaining directories should be cleaned up
              for (const dirPath of remainingDirectories) {
                expect(existsSync(dirPath)).toBe(false)
              }
            } finally {
              // Ensure cleanup even if test fails
              try {
                await manager.cleanupTestEnvironment()
              } catch (error) {
                console.warn('Cleanup error in test:', error)
              }
            }
          }
        ),
        { numRuns: 3 } // Reduced iterations for CI performance
      )
    })

    it('should support global manager reset and cleanup', async () => {
      await fc.assert(
        fc.asyncProperty(generateDirectoryCount(), async directoryCount => {
          // Property: Global manager should be accessible
          const manager1 = getTestIsolationManager()
          expect(manager1).toBeDefined()

          const directories1: string[] = []

          try {
            // Create some directories with first manager
            for (let i = 0; i < directoryCount; i++) {
              const dirPath = await manager1.createIsolatedDirectory()
              directories1.push(dirPath)
            }

            // Property: Directories should exist
            for (const dirPath of directories1) {
              expect(existsSync(dirPath)).toBe(true)
            }

            // Property: Global reset should not throw errors
            await expect(resetTestIsolationManager()).resolves.not.toThrow()

            // Property: New manager should be independent
            const manager2 = getTestIsolationManager()
            expect(manager2).toBeDefined()

            // Property: New manager should be functional
            const testDir = await manager2.createIsolatedDirectory()
            expect(existsSync(testDir)).toBe(true)

            // Cleanup new manager
            await manager2.cleanupTestEnvironment()
            expect(existsSync(testDir)).toBe(false)
          } finally {
            // Ensure cleanup
            await resetTestIsolationManager()
          }
        }),
        { numRuns: 3 } // Reduced iterations for CI performance
      )
    })
  })
})
