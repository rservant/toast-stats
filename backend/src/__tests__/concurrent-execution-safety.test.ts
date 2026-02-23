/**
 * Unit Tests for Concurrent Test Execution Safety
 *
 * Converted from property-based test: concurrent-execution-safety.property.test.ts
 * Rationale: PBT not warranted per testing.md — these test concurrent fs.mkdir
 * and service init with randomized integer counts. The input space is trivially
 * small (2–8 concurrent, 3–10 ops) and easily covered by explicit examples.
 * No mathematical invariants or complex input-space exploration needed.
 *
 * Validates: Requirements 2.1, 2.3
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { DefaultTestServiceFactory } from '../services/TestServiceFactory'
import { DefaultTestIsolationManager } from '../utils/TestIsolationManager'
import path from 'path'
import fs from 'fs/promises'

describe('Concurrent Test Execution Safety', () => {
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

  it('should prevent resource conflicts when 4 tests run concurrently with 5 operations each', async () => {
    const concurrentTestCount = 4
    const operationsPerTest = 5

    const testPromises = Array.from(
      { length: concurrentTestCount },
      async (_, testIndex) => {
        const testId = `concurrent-test-${testIndex}`
        const testDir = await isolationManager.createIsolatedDirectory()
        const cacheDirectory = path.join(testDir, 'cache')

        const cacheConfigService = testFactory.createCacheConfigService({
          cacheDirectory,
        })
        await cacheConfigService.initialize()

        const operations = Array.from(
          { length: operationsPerTest },
          async (_, opIndex) => {
            const opDir = path.join(testDir, `operation-${opIndex}`)
            await fs.mkdir(opDir, { recursive: true })

            const dirStats = await fs.stat(opDir)
            expect(dirStats.isDirectory()).toBe(true)
            expect(cacheConfigService.getCacheDirectory()).toBe(
              path.resolve(cacheDirectory)
            )
            expect(cacheConfigService.isReady()).toBe(true)

            return { operationId: `${testId}-op-${opIndex}`, opDir }
          }
        )

        const results = await Promise.all(operations)
        expect(results).toHaveLength(operationsPerTest)

        await isolationManager.removeIsolatedDirectory(testDir)
        return { testId, results, cacheDirectory }
      }
    )

    const allResults = await Promise.all(testPromises)

    expect(allResults).toHaveLength(concurrentTestCount)

    // Each test should have unique IDs (no cross-contamination)
    const uniqueTestIds = new Set(allResults.map(r => r.testId))
    expect(uniqueTestIds.size).toBe(concurrentTestCount)

    allResults.forEach((testResult, testIndex) => {
      expect(testResult.results).toHaveLength(operationsPerTest)
      expect(testResult.testId).toBe(`concurrent-test-${testIndex}`)
    })
  })

  it('should handle concurrent directory creation at multiple depths', async () => {
    const concurrentOperations = 6
    const directoryDepth = 3
    const baseTestDir = await isolationManager.createIsolatedDirectory()

    const directoryPromises = Array.from(
      { length: concurrentOperations },
      async (_, index) => {
        const dirPath = path.join(baseTestDir, `concurrent-dir-${index}`)
        const nestedPath = Array.from(
          { length: directoryDepth },
          (_, depth) => `level-${depth}`
        ).join(path.sep)
        const fullPath = path.join(dirPath, nestedPath)

        await fs.mkdir(fullPath, { recursive: true })

        const stats = await fs.stat(fullPath)
        expect(stats.isDirectory()).toBe(true)

        const testFile = path.join(fullPath, `test-file-${index}.txt`)
        await fs.writeFile(testFile, `test content ${index}`)

        const fileContent = await fs.readFile(testFile, 'utf-8')
        expect(fileContent).toBe(`test content ${index}`)

        return { dirPath: fullPath, testFile, index }
      }
    )

    const results = await Promise.all(directoryPromises)

    expect(results).toHaveLength(concurrentOperations)
    const uniquePaths = new Set(results.map(r => r.dirPath))
    expect(uniquePaths.size).toBe(concurrentOperations)

    for (const result of results) {
      const fileContent = await fs.readFile(result.testFile, 'utf-8')
      expect(fileContent).toBe(`test content ${result.index}`)
    }

    await isolationManager.removeIsolatedDirectory(baseTestDir)
  })

  it('should prevent race conditions in service initialization with 4 concurrent services', async () => {
    const concurrentServices = 4

    const servicePromises = Array.from(
      { length: concurrentServices },
      async (_, index) => {
        const testDir = await isolationManager.createIsolatedDirectory()
        const cacheDirectory = path.join(testDir, 'cache')

        const cacheConfigService = testFactory.createCacheConfigService({
          cacheDirectory,
        })
        await cacheConfigService.initialize()

        expect(cacheConfigService.isReady()).toBe(true)
        expect(cacheConfigService.getCacheDirectory()).toBe(
          path.resolve(cacheDirectory)
        )

        await cacheConfigService.dispose()
        await isolationManager.removeIsolatedDirectory(testDir)

        return { serviceId: `service-${index}`, cacheDirectory }
      }
    )

    const results = await Promise.all(servicePromises)

    expect(results).toHaveLength(concurrentServices)

    const uniqueCacheDirs = new Set(results.map(r => r.cacheDirectory))
    expect(uniqueCacheDirs.size).toBe(concurrentServices)

    const uniqueServiceIds = new Set(results.map(r => r.serviceId))
    expect(uniqueServiceIds.size).toBe(concurrentServices)
  })

  it('should handle minimum concurrency of 2 services', async () => {
    const testDirs: string[] = []
    const services = await Promise.all(
      [0, 1].map(async i => {
        const testDir = await isolationManager.createIsolatedDirectory()
        testDirs.push(testDir)
        const cacheDirectory = path.join(testDir, 'cache')
        const service = testFactory.createCacheConfigService({ cacheDirectory })
        await service.initialize()
        return { service, cacheDirectory }
      })
    )

    expect(services[0].cacheDirectory).not.toBe(services[1].cacheDirectory)
    services.forEach(({ service }) => expect(service.isReady()).toBe(true))

    for (const { service } of services) await service.dispose()
    for (const dir of testDirs)
      await isolationManager.removeIsolatedDirectory(dir)
  })
})
