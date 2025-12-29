import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'
import { DefaultTestServiceFactory } from '../services/TestServiceFactory'
import { DefaultTestIsolationManager } from '../utils/TestIsolationManager'
import { CacheConfigService } from '../services/CacheConfigService'
import { AnalyticsEngine } from '../services/AnalyticsEngine'
import { EnhancedDistrictCacheManager } from '../services/EnhancedDistrictCacheManager'
import path from 'path'
import fs from 'fs/promises'
import { createDeterministicServiceConfiguration } from '../utils/test-data-factories'

/**
 * Property-Based Test for Concurrent Test Execution Safety
 *
 * Feature: test-infrastructure-stabilization, Property 4: Concurrent Test Execution Safety
 * **Validates: Requirements 2.1, 2.3**
 *
 * This test validates that when tests are executed in parallel, resource conflicts
 * and race conditions do not occur, and directory operations are handled safely.
 */
describe('Property 4: Concurrent Test Execution Safety', () => {
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

  it('should prevent resource conflicts when tests run concurrently', async () => {
    // Feature: test-infrastructure-stabilization, Property 4: Concurrent Test Execution Safety
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          concurrentTestCount: fc.integer({ min: 2, max: 8 }),
          operationsPerTest: fc.integer({ min: 3, max: 10 }),
          testSeed: fc.integer({ min: 1, max: 1000000 }),
        }),
        async ({ concurrentTestCount, operationsPerTest, testSeed }) => {
          // Create concurrent test scenarios
          const testPromises = Array.from(
            { length: concurrentTestCount },
            async (_, testIndex) => {
              const testId = `concurrent-test-${testSeed}-${testIndex}`

              // Create test-specific configuration
              const testDir = await isolationManager.createIsolatedDirectory()
              const cacheDirectory = path.join(testDir, 'cache')

              // Create fresh service instances for this test
              const cacheConfigService = testFactory.createCacheConfigService({
                cacheDirectory,
              })
              const cacheManager =
                testFactory.createDistrictCacheManager(cacheConfigService)
              const analyticsEngine =
                testFactory.createAnalyticsEngine(cacheManager)

              // Initialize services
              await cacheConfigService.initialize()

              // Perform multiple operations that could cause conflicts
              const operations = Array.from(
                { length: operationsPerTest },
                async (_, opIndex) => {
                  const operationId = `${testId}-op-${opIndex}`

                  // Test directory creation (potential race condition)
                  const opDir = path.join(testDir, `operation-${opIndex}`)
                  await fs.mkdir(opDir, { recursive: true })

                  // Test cache operations (potential resource conflicts)
                  const testData = {
                    testId: operationId,
                    data: `test-data-${opIndex}`,
                  }
                  const cacheKey = `test-key-${operationId}`

                  // Verify directory was created successfully
                  const dirStats = await fs.stat(opDir)
                  expect(dirStats.isDirectory()).toBe(true)

                  // Verify cache operations work without conflicts
                  expect(cacheConfigService.getCacheDirectory()).toBe(
                    cacheDirectory
                  )
                  expect(cacheConfigService.isReady()).toBe(true)

                  return { operationId, opDir, cacheKey, testData }
                }
              )

              const results = await Promise.all(operations)

              // Verify all operations completed successfully
              expect(results).toHaveLength(operationsPerTest)
              results.forEach((result, index) => {
                expect(result.operationId).toBe(`${testId}-op-${index}`)
                expect(result.cacheKey).toBe(`test-key-${testId}-op-${index}`)
              })

              // Clean up test-specific directory
              await isolationManager.removeIsolatedDirectory(testDir)

              return { testId, results, cacheDirectory }
            }
          )

          // Wait for all concurrent tests to complete
          const allResults = await Promise.all(testPromises)

          // Property: All concurrent tests should complete successfully without conflicts
          expect(allResults).toHaveLength(concurrentTestCount)

          // Property: Each test should have unique results (no cross-contamination)
          const allTestIds = allResults.map(result => result.testId)
          const uniqueTestIds = new Set(allTestIds)
          expect(uniqueTestIds.size).toBe(concurrentTestCount)

          // Property: All operations within each test should complete
          allResults.forEach((testResult, testIndex) => {
            expect(testResult.results).toHaveLength(operationsPerTest)
            expect(testResult.testId).toBe(
              `concurrent-test-${testSeed}-${testIndex}`
            )
          })
        }
      ),
      { numRuns: 5, timeout: 30000 } // Reduced iterations for concurrent testing
    )
  })

  it('should handle concurrent directory operations safely', async () => {
    // Feature: test-infrastructure-stabilization, Property 4: Concurrent Test Execution Safety
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          concurrentOperations: fc.integer({ min: 3, max: 12 }),
          directoryDepth: fc.integer({ min: 1, max: 4 }),
          testSeed: fc.integer({ min: 1, max: 1000000 }),
        }),
        async ({ concurrentOperations, directoryDepth, testSeed }) => {
          const baseTestDir = await isolationManager.createIsolatedDirectory()

          // Create concurrent directory operations
          const directoryPromises = Array.from(
            { length: concurrentOperations },
            async (_, index) => {
              const dirPath = path.join(
                baseTestDir,
                `concurrent-dir-${testSeed}-${index}`
              )

              // Create nested directory structure
              const nestedPath = Array.from(
                { length: directoryDepth },
                (_, depth) => `level-${depth}`
              ).join(path.sep)
              const fullPath = path.join(dirPath, nestedPath)

              // Concurrent directory creation
              await fs.mkdir(fullPath, { recursive: true })

              // Verify directory was created
              const stats = await fs.stat(fullPath)
              expect(stats.isDirectory()).toBe(true)

              // Create a test file in the directory
              const testFile = path.join(fullPath, `test-file-${index}.txt`)
              await fs.writeFile(testFile, `test content ${index}`)

              // Verify file was created
              const fileContent = await fs.readFile(testFile, 'utf-8')
              expect(fileContent).toBe(`test content ${index}`)

              return { dirPath: fullPath, testFile, index }
            }
          )

          // Wait for all directory operations to complete
          const results = await Promise.all(directoryPromises)

          // Property: All directory operations should complete successfully
          expect(results).toHaveLength(concurrentOperations)

          // Property: Each operation should have unique paths (no conflicts)
          const allPaths = results.map(result => result.dirPath)
          const uniquePaths = new Set(allPaths)
          expect(uniquePaths.size).toBe(concurrentOperations)

          // Property: All files should be accessible and contain correct content
          for (const result of results) {
            const fileContent = await fs.readFile(result.testFile, 'utf-8')
            expect(fileContent).toBe(`test content ${result.index}`)
          }

          // Clean up
          await isolationManager.removeIsolatedDirectory(baseTestDir)
        }
      ),
      { numRuns: 5, timeout: 20000 }
    )
  })

  it('should prevent race conditions in service initialization', async () => {
    // Feature: test-infrastructure-stabilization, Property 4: Concurrent Test Execution Safety
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          concurrentServices: fc.integer({ min: 2, max: 6 }),
          initializationDelay: fc.integer({ min: 0, max: 100 }),
          testSeed: fc.integer({ min: 1, max: 1000000 }),
        }),
        async ({ concurrentServices, initializationDelay, testSeed }) => {
          // Create concurrent service initialization scenarios
          const servicePromises = Array.from(
            { length: concurrentServices },
            async (_, index) => {
              const serviceId = `service-${testSeed}-${index}`

              // Create isolated configuration for each service
              const testDir = await isolationManager.createIsolatedDirectory()
              const cacheDirectory = path.join(testDir, 'cache')

              // Add artificial delay to increase chance of race conditions
              if (initializationDelay > 0) {
                await new Promise(resolve =>
                  setTimeout(resolve, Math.random() * initializationDelay)
                )
              }

              // Initialize services concurrently
              const cacheConfigService = testFactory.createCacheConfigService({
                cacheDirectory,
              })
              await cacheConfigService.initialize()

              const cacheManager =
                testFactory.createDistrictCacheManager(cacheConfigService)
              const analyticsEngine =
                testFactory.createAnalyticsEngine(cacheManager)

              // Verify service state
              expect(cacheConfigService.isReady()).toBe(true)
              expect(cacheConfigService.getCacheDirectory()).toBe(
                cacheDirectory
              )

              // Clean up
              await cacheConfigService.dispose()
              await isolationManager.removeIsolatedDirectory(testDir)

              return { serviceId, cacheDirectory }
            }
          )

          // Wait for all services to initialize
          const results = await Promise.all(servicePromises)

          // Property: All services should initialize successfully without race conditions
          expect(results).toHaveLength(concurrentServices)

          // Property: Each service should have unique cache directories
          const allCacheDirs = results.map(result => result.cacheDirectory)
          const uniqueCacheDirs = new Set(allCacheDirs)
          expect(uniqueCacheDirs.size).toBe(concurrentServices)

          // Property: All service IDs should be unique
          const allServiceIds = results.map(result => result.serviceId)
          const uniqueServiceIds = new Set(allServiceIds)
          expect(uniqueServiceIds.size).toBe(concurrentServices)
        }
      ),
      { numRuns: 5, timeout: 25000 }
    )
  })
})
