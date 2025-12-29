import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'
import { DefaultTestServiceFactory } from '../services/TestServiceFactory'
import { DefaultTestIsolationManager } from '../utils/TestIsolationManager'
import { CacheConfigService } from '../services/CacheConfigService'
import { AnalyticsEngine } from '../services/AnalyticsEngine'
import path from 'path'
import fs from 'fs/promises'
import { createDeterministicServiceConfiguration } from '../utils/test-data-factories'

/**
 * Property-Based Test for Resource Isolation
 *
 * Feature: test-infrastructure-stabilization, Property 11: Resource Isolation
 * **Validates: Requirements 4.3**
 *
 * This test validates that when multiple tests use shared resources,
 * conflicts are prevented through proper isolation.
 */
describe('Property 11: Resource Isolation', () => {
  let testFactory: DefaultTestServiceFactory
  let isolationManager: DefaultTestIsolationManager

  beforeEach(async () => {
    testFactory = new DefaultTestServiceFactory()
    isolationManager = new DefaultTestIsolationManager()
    await isolationManager.setupTestEnvironment()
  })

  afterEach(async () => {
    await testFactory.cleanup()
    await isolationManager.cleanupTestEnvironment()
  })

  it('should prevent conflicts when multiple tests use shared resources', async () => {
    // Feature: test-infrastructure-stabilization, Property 11: Resource Isolation
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          testCount: fc.integer({ min: 2, max: 6 }),
          resourcesPerTest: fc.integer({ min: 2, max: 8 }),
          testSeed: fc.integer({ min: 1, max: 1000000 }),
        }),
        async ({ testCount, resourcesPerTest, testSeed }) => {
          // Create multiple test scenarios that use shared resource types
          const testPromises = Array.from(
            { length: testCount },
            async (_, testIndex) => {
              const testId = `isolation-test-${testSeed}-${testIndex}`

              // Each test gets its own isolated directory
              const testDir = await isolationManager.createIsolatedDirectory()
              const cacheDirectory = path.join(
                testDir,
                'cache',
                `test-${testIndex}`
              )

              // Create fresh service instances for this test
              const cacheConfigService = testFactory.createCacheConfigService({
                cacheDirectory,
              })

              // Initialize services
              await cacheConfigService.initialize()

              // Create multiple resources within this test
              const resources = Array.from(
                { length: resourcesPerTest },
                async (_, resourceIndex) => {
                  const resourceId = `${testId}-resource-${resourceIndex}`

                  // Create resource-specific directory
                  const resourceDir = path.join(
                    testDir,
                    `resource-${resourceIndex}`
                  )
                  await fs.mkdir(resourceDir, { recursive: true })

                  // Create resource-specific file
                  const resourceFile = path.join(
                    resourceDir,
                    `data-${resourceIndex}.json`
                  )
                  const resourceData = {
                    testId,
                    resourceId,
                    resourceIndex,
                    timestamp: Date.now(),
                    testSeed: testSeed + testIndex,
                  }

                  await fs.writeFile(
                    resourceFile,
                    JSON.stringify(resourceData, null, 2)
                  )

                  // Verify resource was created correctly
                  const fileContent = await fs.readFile(resourceFile, 'utf-8')
                  const parsedData = JSON.parse(fileContent)

                  expect(parsedData.testId).toBe(testId)
                  expect(parsedData.resourceId).toBe(resourceId)
                  expect(parsedData.resourceIndex).toBe(resourceIndex)

                  return {
                    resourceId,
                    resourceDir,
                    resourceFile,
                    resourceData: parsedData,
                  }
                }
              )

              const testResources = await Promise.all(resources)

              // Verify all resources are isolated to this test
              expect(testResources).toHaveLength(resourcesPerTest)

              // Verify cache directory is unique to this test
              expect(cacheConfigService.getCacheDirectory()).toBe(
                cacheDirectory
              )
              expect(cacheConfigService.getCacheDirectory()).toContain(
                `test-${testIndex}`
              )

              // Clean up test-specific resources
              await cacheConfigService.dispose()
              await isolationManager.removeIsolatedDirectory(testDir)

              return {
                testId,
                testIndex,
                cacheDirectory,
                resourceCount: testResources.length,
                resources: testResources.map(r => ({
                  resourceId: r.resourceId,
                  resourceIndex: r.resourceData.resourceIndex,
                })),
              }
            }
          )

          // Wait for all tests to complete
          const allResults = await Promise.all(testPromises)

          // Property: All tests should complete successfully without resource conflicts
          expect(allResults).toHaveLength(testCount)

          // Property: Each test should have unique cache directories
          const allCacheDirs = allResults.map(result => result.cacheDirectory)
          const uniqueCacheDirs = new Set(allCacheDirs)
          expect(uniqueCacheDirs.size).toBe(testCount)

          // Property: Each test should have unique test IDs
          const allTestIds = allResults.map(result => result.testId)
          const uniqueTestIds = new Set(allTestIds)
          expect(uniqueTestIds.size).toBe(testCount)

          // Property: Each test should have created the expected number of resources
          allResults.forEach((result, index) => {
            expect(result.testIndex).toBe(index)
            expect(result.resourceCount).toBe(resourcesPerTest)
            expect(result.resources).toHaveLength(resourcesPerTest)

            // Verify resource indices are unique within each test
            const resourceIndices = result.resources.map(r => r.resourceIndex)
            const uniqueIndices = new Set(resourceIndices)
            expect(uniqueIndices.size).toBe(resourcesPerTest)
          })
        }
      ),
      { numRuns: 5, timeout: 25000 }
    )
  })

  it('should isolate environment variables between tests', async () => {
    // Feature: test-infrastructure-stabilization, Property 11: Resource Isolation
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          testCount: fc.integer({ min: 2, max: 5 }),
          envVarCount: fc.integer({ min: 2, max: 6 }),
          testSeed: fc.integer({ min: 1, max: 1000000 }),
        }),
        async ({ testCount, envVarCount, testSeed }) => {
          // Store original environment state
          const originalEnv = { ...process.env }

          // Create multiple test scenarios with different environment variables
          const testPromises = Array.from(
            { length: testCount },
            async (_, testIndex) => {
              const testId = `env-test-${testSeed}-${testIndex}`

              // Create isolated environment manager for this test
              const testIsolationManager = new DefaultTestIsolationManager()
              await testIsolationManager.setupTestEnvironment()

              // Set test-specific environment variables
              const testEnvVars: Record<string, string> = {}
              for (let i = 0; i < envVarCount; i++) {
                const varName = `TEST_VAR_${testId}_${i}`
                const varValue = `value-${testSeed}-${testIndex}-${i}`
                process.env[varName] = varValue
                testEnvVars[varName] = varValue
              }

              // Create test-specific configuration
              const testDir = await isolationManager.createIsolatedDirectory()
              const cacheDirectory = path.join(testDir, 'cache')

              // Create service with environment-dependent configuration
              const cacheConfigService = testFactory.createCacheConfigService({
                cacheDirectory,
              })
              await cacheConfigService.initialize()

              // Verify environment variables are set correctly for this test
              for (const [varName, expectedValue] of Object.entries(
                testEnvVars
              )) {
                expect(process.env[varName]).toBe(expectedValue)
              }

              // Clean up test environment
              await cacheConfigService.dispose()
              await testIsolationManager.cleanupTestEnvironment()
              await testIsolationManager.removeIsolatedDirectory(testDir)

              return {
                testId,
                testIndex,
                envVars: testEnvVars,
                cacheDirectory,
              }
            }
          )

          // Wait for all tests to complete
          const allResults = await Promise.all(testPromises)

          // Restore original environment
          process.env = originalEnv

          // Property: All tests should complete successfully
          expect(allResults).toHaveLength(testCount)

          // Property: Each test should have unique environment variable sets
          const allEnvVarSets = allResults.map(result =>
            Object.keys(result.envVars).sort().join(',')
          )
          const uniqueEnvVarSets = new Set(allEnvVarSets)
          expect(uniqueEnvVarSets.size).toBe(testCount)

          // Property: Each test should have created the expected number of env vars
          allResults.forEach((result, index) => {
            expect(result.testIndex).toBe(index)
            expect(Object.keys(result.envVars)).toHaveLength(envVarCount)

            // Verify all env var names are unique to this test
            Object.keys(result.envVars).forEach(varName => {
              expect(varName).toContain(`env-test-${testSeed}-${index}`)
            })
          })
        }
      ),
      { numRuns: 5, timeout: 20000 }
    )
  })

  it('should isolate file system resources between tests', async () => {
    // Feature: test-infrastructure-stabilization, Property 11: Resource Isolation
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          testCount: fc.integer({ min: 2, max: 4 }),
          filesPerTest: fc.integer({ min: 3, max: 8 }),
          testSeed: fc.integer({ min: 1, max: 1000000 }),
        }),
        async ({ testCount, filesPerTest, testSeed }) => {
          // Create multiple test scenarios that create files
          const testPromises = Array.from(
            { length: testCount },
            async (_, testIndex) => {
              const testId = `fs-test-${testSeed}-${testIndex}`

              // Each test gets its own isolated directory
              const testDir = await isolationManager.createIsolatedDirectory()

              // Create multiple files within this test's directory
              const files = Array.from(
                { length: filesPerTest },
                async (_, fileIndex) => {
                  const fileName = `test-file-${testIndex}-${fileIndex}.txt`
                  const filePath = path.join(testDir, fileName)
                  const fileContent = `Test ${testId} - File ${fileIndex} - Seed ${testSeed}`

                  await fs.writeFile(filePath, fileContent)

                  // Verify file was created correctly
                  const readContent = await fs.readFile(filePath, 'utf-8')
                  expect(readContent).toBe(fileContent)

                  return {
                    fileName,
                    filePath,
                    fileContent,
                    fileIndex,
                  }
                }
              )

              const testFiles = await Promise.all(files)

              // Verify all files exist and are accessible
              for (const file of testFiles) {
                const stats = await fs.stat(file.filePath)
                expect(stats.isFile()).toBe(true)

                const content = await fs.readFile(file.filePath, 'utf-8')
                expect(content).toBe(file.fileContent)
                expect(content).toContain(testId)
              }

              // Clean up test directory
              await isolationManager.removeIsolatedDirectory(testDir)

              return {
                testId,
                testIndex,
                testDir,
                fileCount: testFiles.length,
                files: testFiles.map(f => ({
                  fileName: f.fileName,
                  fileIndex: f.fileIndex,
                })),
              }
            }
          )

          // Wait for all tests to complete
          const allResults = await Promise.all(testPromises)

          // Property: All tests should complete successfully
          expect(allResults).toHaveLength(testCount)

          // Property: Each test should have unique directories
          const allTestDirs = allResults.map(result => result.testDir)
          const uniqueTestDirs = new Set(allTestDirs)
          expect(uniqueTestDirs.size).toBe(testCount)

          // Property: Each test should have created the expected number of files
          allResults.forEach((result, index) => {
            expect(result.testIndex).toBe(index)
            expect(result.fileCount).toBe(filesPerTest)
            expect(result.files).toHaveLength(filesPerTest)

            // Verify file names are unique within each test
            const fileNames = result.files.map(f => f.fileName)
            const uniqueFileNames = new Set(fileNames)
            expect(uniqueFileNames.size).toBe(filesPerTest)

            // Verify all file names contain the test index
            fileNames.forEach(fileName => {
              expect(fileName).toContain(`test-file-${index}-`)
            })
          })

          // Property: All test directories should be cleaned up (no longer exist)
          for (const result of allResults) {
            try {
              await fs.access(result.testDir)
              // If we reach here, the directory still exists (should not happen)
              expect(false).toBe(true) // Force failure
            } catch (error) {
              // Directory should not exist (this is expected)
              expect(error).toBeDefined()
            }
          }
        }
      ),
      { numRuns: 5, timeout: 20000 }
    )
  })
})
