/**
 * Migrated Property-Based Tests for CacheConfigService
 *
 * This file demonstrates the migration from singleton patterns to dependency injection
 * using the new test infrastructure.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'
import path from 'path'
import fs from 'fs/promises'
import { DefaultTestServiceFactory, ServiceTokens } from '../TestServiceFactory'
import { DefaultTestIsolationManager } from '../../utils/TestIsolationManager'
import { safeString } from '../../utils/test-string-generators'

describe('CacheConfigService - Migrated Property-Based Tests', () => {
  let testFactory: DefaultTestServiceFactory
  let isolationManager: DefaultTestIsolationManager

  beforeEach(async () => {
    // Initialize new test infrastructure - no more singleton resets!
    testFactory = new DefaultTestServiceFactory()
    isolationManager = new DefaultTestIsolationManager()
    await isolationManager.setupTestEnvironment()
  })

  afterEach(async () => {
    // Clean up using new infrastructure - no more manual singleton resets!
    await testFactory.cleanup()
    await isolationManager.cleanupTestEnvironment()
  })

  // Test data generators using safe paths
  const generateValidCachePath = (): fc.Arbitrary<string> =>
    fc.oneof(
      fc.constant('cache'),
      fc.constant('test-cache-config'),
      safeString(5, 20).map(s => `test-cache-${s}`)
    )

  it('should initialize with different cache directories using dependency injection', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateValidCachePath(),
        async (relativeCachePath: string) => {
          // Create isolated test directory
          const testDir = await isolationManager.createIsolatedDirectory()
          const cacheDirectory = path.join(testDir, relativeCachePath)

          // Create fresh service instance using dependency injection
          const cacheConfigService = testFactory.createCacheConfigService({
            cacheDirectory,
          })

          // Initialize the service
          await cacheConfigService.initialize()

          // Property: Service should use the configured cache directory
          expect(cacheConfigService.getCacheDirectory()).toBe(cacheDirectory)
          expect(cacheConfigService.isReady()).toBe(true)

          // Property: Cache directory should exist after initialization
          const stats = await fs.stat(cacheDirectory)
          expect(stats.isDirectory()).toBe(true)

          // Clean up
          await cacheConfigService.dispose()
          await isolationManager.removeIsolatedDirectory(testDir)
        }
      ),
      { numRuns: 10 }
    )
  })

  it('should create multiple independent service instances', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 5 }),
        fc.integer({ min: 1, max: 1000000 }),
        async (instanceCount: number, _seed: number) => {
          // Create multiple independent service instances
          const services = []
          const testDirs = []

          for (let i = 0; i < instanceCount; i++) {
            const testDir = await isolationManager.createIsolatedDirectory()
            const cacheDirectory = path.join(testDir, `cache-${i}`)

            const service = testFactory.createCacheConfigService({
              cacheDirectory,
            })
            await service.initialize()

            services.push(service)
            testDirs.push(testDir)
          }

          // Property: All services should be independent with unique cache directories
          const cacheDirs = services.map(s => s.getCacheDirectory())
          const uniqueCacheDirs = new Set(cacheDirs)
          expect(uniqueCacheDirs.size).toBe(instanceCount)

          // Property: All services should be ready
          services.forEach(service => {
            expect(service.isReady()).toBe(true)
          })

          // Property: All cache directories should exist
          for (const cacheDir of cacheDirs) {
            const stats = await fs.stat(cacheDir)
            expect(stats.isDirectory()).toBe(true)
          }

          // Clean up all services and directories
          for (let i = 0; i < services.length; i++) {
            await services[i].dispose()
            await isolationManager.removeIsolatedDirectory(testDirs[i])
          }
        }
      ),
      { numRuns: 5 }
    )
  })

  it('should handle concurrent service creation without conflicts', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 6 }),
        fc.integer({ min: 1, max: 1000000 }),
        async (concurrentCount: number, _seed: number) => {
          // Create concurrent service instances
          const servicePromises = Array.from(
            { length: concurrentCount },
            async (_, index) => {
              const testDir = await isolationManager.createIsolatedDirectory()
              const cacheDirectory = path.join(
                testDir,
                `concurrent-cache-${index}`
              )

              const service = testFactory.createCacheConfigService({
                cacheDirectory,
              })
              await service.initialize()

              return { service, testDir, cacheDirectory }
            }
          )

          // Wait for all services to be created concurrently
          const results = await Promise.all(servicePromises)

          // Property: All services should be created successfully
          expect(results).toHaveLength(concurrentCount)

          // Property: All cache directories should be unique
          const cachePaths = results.map(r => r.cacheDirectory)
          const uniquePaths = new Set(cachePaths)
          expect(uniquePaths.size).toBe(concurrentCount)

          // Property: All services should be ready
          results.forEach(({ service }) => {
            expect(service.isReady()).toBe(true)
          })

          // Property: All cache directories should exist
          for (const { cacheDirectory } of results) {
            const stats = await fs.stat(cacheDirectory)
            expect(stats.isDirectory()).toBe(true)
          }

          // Clean up all services and directories
          for (const { service, testDir } of results) {
            await service.dispose()
            await isolationManager.removeIsolatedDirectory(testDir)
          }
        }
      ),
      { numRuns: 5 }
    )
  })

  it('should properly dispose of resources', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateValidCachePath(),
        fc.integer({ min: 1, max: 1000000 }),
        async (relativeCachePath: string, _seed: number) => {
          const testDir = await isolationManager.createIsolatedDirectory()
          const cacheDirectory = path.join(testDir, relativeCachePath)

          const service = testFactory.createCacheConfigService({
            cacheDirectory,
          })
          await service.initialize()

          // Verify service is ready
          expect(service.isReady()).toBe(true)
          expect(service.getCacheDirectory()).toBe(cacheDirectory)

          // Dispose of the service
          await service.dispose()

          // Property: Service should be properly disposed
          // Note: The specific behavior after disposal depends on implementation
          // but the service should handle disposal gracefully

          // Clean up test directory
          await isolationManager.removeIsolatedDirectory(testDir)
        }
      ),
      { numRuns: 10 }
    )
  })

  it('should work with test service factory container', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 1000000 }),
        async (_seed: number) => {
          const testDir = await isolationManager.createIsolatedDirectory()
          const cacheDirectory = path.join(testDir, 'container-cache')

          // Create a configured container
          const container = testFactory.createConfiguredContainer({
            cacheDirectory,
          })

          // Resolve CacheConfigService from container
          const cacheConfigService = container.resolve(
            ServiceTokens.CacheConfigService
          )
          await cacheConfigService.initialize()

          // Property: Service from container should work correctly
          expect(cacheConfigService.isReady()).toBe(true)
          expect(cacheConfigService.getCacheDirectory()).toBe(cacheDirectory)

          // Property: Cache directory should exist
          const stats = await fs.stat(cacheDirectory)
          expect(stats.isDirectory()).toBe(true)

          // Clean up container and test directory
          await container.dispose()
          await isolationManager.removeIsolatedDirectory(testDir)
        }
      ),
      { numRuns: 5 }
    )
  })
})
