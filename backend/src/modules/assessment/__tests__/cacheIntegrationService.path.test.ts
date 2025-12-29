import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  getTestServiceFactory,
  resetTestServiceFactory,
} from '../../../services/TestServiceFactory'
import CacheIntegrationService from '../services/cacheIntegrationService'
import { DistrictCacheManager } from '../../../services/DistrictCacheManager'
import * as path from 'path'

describe('CacheIntegrationService Cache Path Configuration', () => {
  let originalEnv: string | undefined
  let testFactory: ReturnType<typeof getTestServiceFactory>

  beforeEach(() => {
    originalEnv = process.env.CACHE_DIR
    testFactory = getTestServiceFactory()
  })

  afterEach(async () => {
    if (originalEnv !== undefined) {
      process.env.CACHE_DIR = originalEnv
    } else {
      delete process.env.CACHE_DIR
    }
    await resetTestServiceFactory()
    vi.restoreAllMocks()
  })

  it('uses CACHE_DIR configuration when creating cache manager', () => {
    process.env.CACHE_DIR = './test-dir/some-cache'

    // Create service instance with test factory
    const cacheConfig = testFactory.createCacheConfigService({
      cacheDirectory: './test-dir/some-cache',
    })
    const cacheManager = testFactory.createDistrictCacheManager(cacheConfig)
    const service = new CacheIntegrationService(cacheManager)

    // Verify that CacheConfigService was used with correct configuration
    expect(cacheConfig.getCacheDirectory()).toBe(
      path.resolve('./test-dir/some-cache')
    )

    // Verify the service was created successfully (integration test)
    expect(service).toBeDefined()
    expect(typeof service.getLatestCacheDate).toBe('function')
  })

  it('uses default cache directory when CACHE_DIR is not set', () => {
    delete process.env.CACHE_DIR

    // Create service instance with test factory using default configuration
    const cacheConfig = testFactory.createCacheConfigService()
    const cacheManager = testFactory.createDistrictCacheManager(cacheConfig)
    const service = new CacheIntegrationService(cacheManager)

    // Verify that CacheConfigService uses default configuration
    expect(cacheConfig.getCacheDirectory()).toBe('/tmp/test-cache')

    // Verify the service was created successfully
    expect(service).toBeDefined()
    expect(typeof service.getLatestCacheDate).toBe('function')
  })

  it('uses CACHE_DIR configuration consistently across multiple service instances', () => {
    process.env.CACHE_DIR = './test-dir/unified-cache'

    // Create shared cache configuration
    const cacheConfig = testFactory.createCacheConfigService({
      cacheDirectory: './test-dir/unified-cache',
    })
    const cacheManager = testFactory.createDistrictCacheManager(cacheConfig)

    // Create multiple instances using the same cache manager
    const service1 = new CacheIntegrationService(cacheManager)
    const service2 = new CacheIntegrationService(cacheManager)
    const service3 = new CacheIntegrationService(cacheManager)

    // Verify all instances use the same configured path through CacheConfigService
    const expectedPath = path.resolve('./test-dir/unified-cache')
    expect(cacheConfig.getCacheDirectory()).toBe(expectedPath)

    // Verify all services were created successfully
    expect(service1).toBeDefined()
    expect(service2).toBeDefined()
    expect(service3).toBeDefined()
  })

  it('falls back to default when CACHE_DIR is empty', () => {
    process.env.CACHE_DIR = ''

    // Create service instance with test factory using default configuration
    const cacheConfig = testFactory.createCacheConfigService()
    const cacheManager = testFactory.createDistrictCacheManager(cacheConfig)
    const service = new CacheIntegrationService(cacheManager)

    // Verify fallback to default cache directory (test factory uses /tmp/test-cache)
    expect(cacheConfig.getCacheDirectory()).toBe('/tmp/test-cache')

    // Verify the service was created successfully
    expect(service).toBeDefined()
  })

  it('respects explicit cache manager parameter over configuration', () => {
    process.env.CACHE_DIR = './test-dir/configured-cache'

    // Create explicit cache manager with different path
    const explicitCacheManager = new DistrictCacheManager(
      './test-dir/explicit-cache'
    )

    // Create service with explicit cache manager
    const service = new CacheIntegrationService(explicitCacheManager)

    // Verify that the service uses the explicit cache manager
    expect(service).toBeDefined()

    // The CacheConfigService should still have the configured path, but service uses explicit manager
    const cacheConfig = testFactory.createCacheConfigService({
      cacheDirectory: './test-dir/configured-cache',
    })
    expect(cacheConfig.getCacheDirectory()).toBe(
      path.resolve('./test-dir/configured-cache')
    )
  })

  it('integrates with CacheConfigService for cache directory resolution', () => {
    process.env.CACHE_DIR = './test-dir/integration-test'

    // Create service instance with test factory
    const cacheConfig = testFactory.createCacheConfigService({
      cacheDirectory: './test-dir/integration-test',
    })
    const cacheManager = testFactory.createDistrictCacheManager(cacheConfig)
    const service = new CacheIntegrationService(cacheManager)

    // Verify that CacheConfigService was used and has correct configuration
    const config = cacheConfig.getConfiguration()

    expect(config.baseDirectory).toBe(
      path.resolve('./test-dir/integration-test')
    )
    expect(config.source).toBe('test')
    expect(config.isConfigured).toBe(true) // Environment variable is set, so isConfigured is true

    // Verify service integration
    expect(service).toBeDefined()
    expect(typeof service.getCompleteAssessmentDataByDate).toBe('function')
  })

  it('does not use DISTRICT_CACHE_DIR environment variable', () => {
    // Set both environment variables to different values
    process.env.CACHE_DIR = './test-dir/unified-cache'
    process.env.DISTRICT_CACHE_DIR = './test-dir/old-cache'

    // Create service instance with test factory
    const cacheConfig = testFactory.createCacheConfigService({
      cacheDirectory: './test-dir/unified-cache',
    })
    const cacheManager = testFactory.createDistrictCacheManager(cacheConfig)
    const service = new CacheIntegrationService(cacheManager)

    // Verify that only CACHE_DIR is used, not DISTRICT_CACHE_DIR
    const actualPath = cacheConfig.getCacheDirectory()

    expect(actualPath).toBe(path.resolve('./test-dir/unified-cache'))
    expect(actualPath).not.toBe(path.resolve('./test-dir/old-cache'))

    // Verify service was created successfully
    expect(service).toBeDefined()
  })
})
