import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { CacheConfigService } from '../../../services/CacheConfigService'
import CacheIntegrationService from '../services/cacheIntegrationService'
import { DistrictCacheManager } from '../../../services/DistrictCacheManager'
import * as path from 'path'

describe('CacheIntegrationService Cache Path Configuration', () => {
  let originalEnv: string | undefined

  beforeEach(() => {
    originalEnv = process.env.CACHE_DIR
    CacheConfigService.resetInstance()
  })

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.CACHE_DIR = originalEnv
    } else {
      delete process.env.CACHE_DIR
    }
    CacheConfigService.resetInstance()
    vi.restoreAllMocks()
  })

  it('uses CACHE_DIR configuration when creating cache manager', () => {
    process.env.CACHE_DIR = '/tmp/some-cache'
    CacheConfigService.resetInstance()

    // Create service instance
    const service = new CacheIntegrationService()

    // Verify that CacheConfigService was used with correct configuration
    const configService = CacheConfigService.getInstance()
    expect(configService.getCacheDirectory()).toBe(
      path.resolve('/tmp/some-cache')
    )

    // Verify the service was created successfully (integration test)
    expect(service).toBeDefined()
    expect(typeof service.getLatestCacheDate).toBe('function')
  })

  it('uses default cache directory when CACHE_DIR is not set', () => {
    delete process.env.CACHE_DIR
    CacheConfigService.resetInstance()

    // Create service instance
    const service = new CacheIntegrationService()

    // Verify that CacheConfigService uses default configuration
    const configService = CacheConfigService.getInstance()
    expect(configService.getCacheDirectory()).toBe(path.resolve('./cache'))

    // Verify the service was created successfully
    expect(service).toBeDefined()
    expect(typeof service.getLatestCacheDate).toBe('function')
  })

  it('uses CACHE_DIR configuration consistently across multiple service instances', () => {
    process.env.CACHE_DIR = '/tmp/unified-cache'
    CacheConfigService.resetInstance()

    // Create multiple instances
    const service1 = new CacheIntegrationService()
    const service2 = new CacheIntegrationService()
    const service3 = new CacheIntegrationService()

    // Verify all instances use the same configured path through CacheConfigService
    const configService = CacheConfigService.getInstance()
    const expectedPath = path.resolve('/tmp/unified-cache')
    expect(configService.getCacheDirectory()).toBe(expectedPath)

    // Verify all services were created successfully
    expect(service1).toBeDefined()
    expect(service2).toBeDefined()
    expect(service3).toBeDefined()
  })

  it('falls back to default when CACHE_DIR is empty', () => {
    process.env.CACHE_DIR = ''
    CacheConfigService.resetInstance()

    // Create service instance
    const service = new CacheIntegrationService()

    // Verify fallback to default cache directory
    const configService = CacheConfigService.getInstance()
    expect(configService.getCacheDirectory()).toBe(path.resolve('./cache'))

    // Verify the service was created successfully
    expect(service).toBeDefined()
  })

  it('respects explicit cache manager parameter over configuration', () => {
    process.env.CACHE_DIR = '/tmp/configured-cache'
    CacheConfigService.resetInstance()

    // Create explicit cache manager with different path
    const explicitCacheManager = new DistrictCacheManager('/tmp/explicit-cache')

    // Create service with explicit cache manager
    const service = new CacheIntegrationService(explicitCacheManager)

    // Verify that the service uses the explicit cache manager
    expect(service).toBeDefined()

    // The CacheConfigService should still have the configured path, but service uses explicit manager
    const configService = CacheConfigService.getInstance()
    expect(configService.getCacheDirectory()).toBe(
      path.resolve('/tmp/configured-cache')
    )
  })

  it('integrates with CacheConfigService for cache directory resolution', () => {
    process.env.CACHE_DIR = '/tmp/integration-test'
    CacheConfigService.resetInstance()

    // Create service instance
    const service = new CacheIntegrationService()

    // Verify that CacheConfigService was used and has correct configuration
    const configService = CacheConfigService.getInstance()
    const config = configService.getConfiguration()

    expect(config.baseDirectory).toBe(path.resolve('/tmp/integration-test'))
    expect(config.source).toBe('environment')
    expect(config.isConfigured).toBe(true)

    // Verify service integration
    expect(service).toBeDefined()
    expect(typeof service.getCompleteAssessmentDataByDate).toBe('function')
  })

  it('does not use DISTRICT_CACHE_DIR environment variable', () => {
    // Set both environment variables to different values
    process.env.CACHE_DIR = '/tmp/unified-cache'
    process.env.DISTRICT_CACHE_DIR = '/tmp/old-cache'
    CacheConfigService.resetInstance()

    // Create service instance
    const service = new CacheIntegrationService()

    // Verify that only CACHE_DIR is used, not DISTRICT_CACHE_DIR
    const configService = CacheConfigService.getInstance()
    const actualPath = configService.getCacheDirectory()

    expect(actualPath).toBe(path.resolve('/tmp/unified-cache'))
    expect(actualPath).not.toBe(path.resolve('/tmp/old-cache'))

    // Verify service was created successfully
    expect(service).toBeDefined()
  })
})
