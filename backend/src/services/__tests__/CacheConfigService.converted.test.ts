/**
 * Unit Tests for CacheConfigService (Migrated from Property Tests)
 *
 * Converted from property-based test: CacheConfigService.migrated.property.test.ts
 * Rationale: PBT not warranted per testing.md — tests verify service DI init,
 * multiple instances, and disposal with randomized integer counts (2-6) and
 * random path suffixes. The behaviors are simple CRUD/lifecycle operations
 * easily covered by 5 explicit examples. No mathematical invariants.
 *
 * Note: Does not replace CacheConfigService.edge-cases.test.ts which remains.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import path from 'path'
import fs from 'fs/promises'
import { DefaultTestServiceFactory, ServiceTokens } from '../TestServiceFactory'
import { DefaultTestIsolationManager } from '../../utils/TestIsolationManager'

describe('CacheConfigService - Converted Property Tests', () => {
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

  it('should initialize with a specific cache directory using dependency injection', async () => {
    const testDir = await isolationManager.createIsolatedDirectory()
    const cacheDirectory = path.join(testDir, 'test-cache-config')

    const cacheConfigService = testFactory.createCacheConfigService({
      cacheDirectory,
    })
    await cacheConfigService.initialize()

    expect(cacheConfigService.getCacheDirectory()).toBe(cacheDirectory)
    expect(cacheConfigService.isReady()).toBe(true)

    const stats = await fs.stat(cacheDirectory)
    expect(stats.isDirectory()).toBe(true)

    await cacheConfigService.dispose()
    await isolationManager.removeIsolatedDirectory(testDir)
  })

  it('should create 3 independent service instances with unique cache directories', async () => {
    const instanceCount = 3
    const services = []
    const testDirs = []

    for (let i = 0; i < instanceCount; i++) {
      const testDir = await isolationManager.createIsolatedDirectory()
      const cacheDirectory = path.join(testDir, `cache-${i}`)

      const service = testFactory.createCacheConfigService({ cacheDirectory })
      await service.initialize()

      services.push(service)
      testDirs.push(testDir)
    }

    const cacheDirs = services.map(s => s.getCacheDirectory())
    const uniqueCacheDirs = new Set(cacheDirs)
    expect(uniqueCacheDirs.size).toBe(instanceCount)

    services.forEach(service => {
      expect(service.isReady()).toBe(true)
    })

    for (const cacheDir of cacheDirs) {
      const stats = await fs.stat(cacheDir)
      expect(stats.isDirectory()).toBe(true)
    }

    for (let i = 0; i < services.length; i++) {
      await services[i].dispose()
      await isolationManager.removeIsolatedDirectory(testDirs[i])
    }
  })

  it('should handle concurrent service creation without conflicts', async () => {
    const concurrentCount = 4

    const servicePromises = Array.from(
      { length: concurrentCount },
      async (_, index) => {
        const testDir = await isolationManager.createIsolatedDirectory()
        const cacheDirectory = path.join(testDir, `concurrent-cache-${index}`)

        const service = testFactory.createCacheConfigService({ cacheDirectory })
        await service.initialize()

        return { service, testDir, cacheDirectory }
      }
    )

    const results = await Promise.all(servicePromises)

    expect(results).toHaveLength(concurrentCount)

    const cachePaths = results.map(r => r.cacheDirectory)
    const uniquePaths = new Set(cachePaths)
    expect(uniquePaths.size).toBe(concurrentCount)

    results.forEach(({ service }) => {
      expect(service.isReady()).toBe(true)
    })

    for (const { service, testDir } of results) {
      await service.dispose()
      await isolationManager.removeIsolatedDirectory(testDir)
    }
  })

  it('should properly dispose of resources', async () => {
    const testDir = await isolationManager.createIsolatedDirectory()
    const cacheDirectory = path.join(testDir, 'dispose-test-cache')

    const service = testFactory.createCacheConfigService({ cacheDirectory })
    await service.initialize()

    expect(service.isReady()).toBe(true)
    expect(service.getCacheDirectory()).toBe(cacheDirectory)

    await service.dispose()
    await isolationManager.removeIsolatedDirectory(testDir)
  })

  it('should work with test service factory container', async () => {
    const testDir = await isolationManager.createIsolatedDirectory()
    const cacheDirectory = path.join(testDir, 'container-cache')

    const container = testFactory.createConfiguredContainer({ cacheDirectory })

    const cacheConfigService = container.resolve(
      ServiceTokens.CacheConfigService
    )
    await cacheConfigService.initialize()

    expect(cacheConfigService.isReady()).toBe(true)
    expect(cacheConfigService.getCacheDirectory()).toBe(cacheDirectory)

    const stats = await fs.stat(cacheDirectory)
    expect(stats.isDirectory()).toBe(true)

    await container.dispose()
    await isolationManager.removeIsolatedDirectory(testDir)
  })
})
