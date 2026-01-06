/**
 * Service Container Integration Tests
 * 
 * Tests the integration of RawCSVCacheService with ToastmastersScraper
 * through the service container dependency injection system.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  DefaultProductionServiceFactory,
  ServiceTokens,
} from '../ProductionServiceFactory.js'
import { ServiceContainer } from '../../types/serviceContainer.js'
import { RefreshService } from '../RefreshService.js'
import { ToastmastersScraper } from '../ToastmastersScraper.js'
import { createTestSelfCleanup, TestSelfCleanup } from '../../utils/test-self-cleanup.js'

describe('Service Container Integration', () => {
  let factory: DefaultProductionServiceFactory
  let container: ServiceContainer
  let testCleanup: { cleanup: TestSelfCleanup; afterEach: () => Promise<void> }

  beforeEach(async () => {
    testCleanup = createTestSelfCleanup()

    factory = new DefaultProductionServiceFactory()
    container = factory.createProductionContainer()
  })

  afterEach(async () => {
    await factory.cleanup()
    await testCleanup.afterEach()
  })

  it('should register RawCSVCacheService in service container', () => {
    // Verify that RawCSVCacheService is registered
    expect(container.isRegistered(ServiceTokens.RawCSVCacheService)).toBe(true)
  })

  it('should resolve RawCSVCacheService from service container', () => {
    // Resolve RawCSVCacheService
    const rawCSVCacheService = container.resolve(ServiceTokens.RawCSVCacheService)
    
    // Verify it's the correct type
    expect(rawCSVCacheService).toBeDefined()
    expect(typeof rawCSVCacheService.getCachedCSV).toBe('function')
    expect(typeof rawCSVCacheService.setCachedCSV).toBe('function')
    expect(typeof rawCSVCacheService.hasCachedCSV).toBe('function')
  })

  it('should inject RawCSVCacheService into RefreshService', () => {
    // Resolve RefreshService which should have ToastmastersScraper with injected cache service
    const refreshService = container.resolve(ServiceTokens.RefreshService)
    
    // Verify RefreshService is created
    expect(refreshService).toBeDefined()
    expect(refreshService).toBeInstanceOf(RefreshService)
  })

  it('should create ToastmastersScraper with RawCSVCacheService through factory', () => {
    // Create ToastmastersScraper through factory method
    const rawCSVCacheService = factory.createRawCSVCacheService()
    
    // Create scraper with cache service
    const scraper = new ToastmastersScraper(rawCSVCacheService)
    
    // Verify scraper is created with cache service
    expect(scraper).toBeDefined()
    
    // Verify the cache service is injected (we can't directly access private field,
    // but we can verify the scraper was constructed successfully)
    expect(typeof scraper.getAllDistricts).toBe('function')
    expect(typeof scraper.getDistrictPerformance).toBe('function')
    expect(typeof scraper.getDivisionPerformance).toBe('function')
    expect(typeof scraper.getClubPerformance).toBe('function')
  })

  it('should maintain service lifecycle management', async () => {
    // Resolve services
    const rawCSVCacheService = container.resolve(ServiceTokens.RawCSVCacheService)
    const cacheConfigService = container.resolve(ServiceTokens.CacheConfigService)
    
    // Verify services are singletons (same instance returned)
    const rawCSVCacheService2 = container.resolve(ServiceTokens.RawCSVCacheService)
    const cacheConfigService2 = container.resolve(ServiceTokens.CacheConfigService)
    
    expect(rawCSVCacheService).toBe(rawCSVCacheService2)
    expect(cacheConfigService).toBe(cacheConfigService2)
    
    // Verify container stats
    const stats = container.getStats()
    expect(stats.totalRegistrations).toBeGreaterThan(0)
    expect(stats.activeInstances).toBeGreaterThan(0)
  })

  it('should properly dispose services during cleanup', async () => {
    // Resolve services to create instances
    container.resolve(ServiceTokens.RawCSVCacheService)
    container.resolve(ServiceTokens.CacheConfigService)
    
    // Get initial stats
    const initialStats = container.getStats()
    expect(initialStats.activeInstances).toBeGreaterThan(0)
    
    // Dispose container
    await container.dispose()
    
    // Verify disposal
    const finalStats = container.getStats()
    expect(finalStats.disposedInstances).toBeGreaterThan(0)
  })

  it('should support configuration service integration', () => {
    // Verify configuration service is registered and can be resolved
    expect(container.isRegistered(ServiceTokens.Configuration)).toBe(true)
    
    const configProvider = container.resolve(ServiceTokens.Configuration)
    expect(configProvider).toBeDefined()
    expect(typeof configProvider.getConfiguration).toBe('function')
    
    const config = configProvider.getConfiguration()
    expect(config).toBeDefined()
    expect(typeof config.cacheDirectory).toBe('string')
    expect(typeof config.environment).toBe('string')
    expect(typeof config.logLevel).toBe('string')
  })
})