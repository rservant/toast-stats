/**
 * Integration tests for service factory dependency injection
 *
 * Tests that the service factories correctly wire services together.
 * Note: RankingCalculator has been moved to analytics-core and is no longer
 * part of the backend. Rankings are now pre-computed by scraper-cli.
 */

import { describe, it, expect, afterEach } from 'vitest'
import {
  getProductionServiceFactory,
  resetProductionServiceFactory,
} from '../ProductionServiceFactory.js'
import {
  getTestServiceFactory,
  resetTestServiceFactory,
  ServiceTokens as TestServiceTokens,
} from '../TestServiceFactory.js'

describe('Service Factory Integration', () => {
  afterEach(async () => {
    await resetProductionServiceFactory()
    await resetTestServiceFactory()
  })

  describe('Production Service Factory', () => {
    it('should create RefreshService', () => {
      const factory = getProductionServiceFactory()
      const refreshService = factory.createRefreshService()

      // Verify RefreshService was created
      expect(refreshService).toBeDefined()
      expect(refreshService.constructor.name).toBe('RefreshService')

      // Verify the service has expected interface
      expect(typeof refreshService.executeRefresh).toBe('function')
    })

    it('should create services with proper dependency chain', () => {
      const factory = getProductionServiceFactory()

      // Create services - each creates its own internal dependencies
      const snapshotStorage = factory.createSnapshotStorage()
      const refreshService = factory.createRefreshService()

      // Verify all services were created
      expect(snapshotStorage).toBeDefined()
      expect(refreshService).toBeDefined()

      // Verify services have expected interfaces
      expect(typeof refreshService.executeRefresh).toBe('function')
    })
  })

  describe('Test Service Factory', () => {
    it('should create RefreshService', () => {
      const factory = getTestServiceFactory()
      const refreshService = factory.createRefreshService()

      // Verify RefreshService was created
      expect(refreshService).toBeDefined()
      expect(refreshService.constructor.name).toBe('RefreshService')

      // Verify the service has expected interface
      expect(typeof refreshService.executeRefresh).toBe('function')
    })

    it('should create services with proper dependency chain', () => {
      const factory = getTestServiceFactory()

      // Create services - each creates its own internal dependencies
      const snapshotStorage = factory.createSnapshotStorage()
      const refreshService = factory.createRefreshService()

      // Verify all services were created
      expect(snapshotStorage).toBeDefined()
      expect(refreshService).toBeDefined()

      // Verify services have expected interfaces
      expect(typeof refreshService.executeRefresh).toBe('function')
    })

    it('should create services via container registration', () => {
      const factory = getTestServiceFactory()
      const container = factory.createConfiguredContainer()

      // Verify container was created
      expect(container).toBeDefined()

      // Test that we can resolve services from the container using service tokens
      // Note: RankingCalculator is no longer registered - it's in analytics-core
      // Note: BackfillService has been removed - backfill is no longer in the backend
      expect(() =>
        container.resolve(TestServiceTokens.Configuration)
      ).not.toThrow()
      expect(() =>
        container.resolve(TestServiceTokens.CacheConfigService)
      ).not.toThrow()
      expect(() =>
        container.resolve(TestServiceTokens.SnapshotStore)
      ).not.toThrow()
      expect(() =>
        container.resolve(TestServiceTokens.RefreshService)
      ).not.toThrow()
    })
  })

  describe('Service Factory Consistency', () => {
    it('should create services with consistent interfaces', () => {
      const productionFactory = getProductionServiceFactory()
      const testFactory = getTestServiceFactory()

      const prodRefresh = productionFactory.createRefreshService()
      const testRefresh = testFactory.createRefreshService()

      // Both should have the same constructor
      expect(prodRefresh.constructor.name).toBe(testRefresh.constructor.name)

      // Both should have the same interface
      expect(typeof prodRefresh.executeRefresh).toBe('function')
      expect(typeof testRefresh.executeRefresh).toBe('function')
    })
  })
})
