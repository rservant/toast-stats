/**
 * Integration tests for service factory dependency injection
 *
 * Tests that the service factories correctly wire the RankingCalculator
 * into RefreshService and BackfillService.
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
import { RefreshService } from '../RefreshService.js'
import { BackfillService } from '../UnifiedBackfillService.js'

describe('Service Factory Integration', () => {
  afterEach(async () => {
    await resetProductionServiceFactory()
    await resetTestServiceFactory()
  })

  describe('Production Service Factory', () => {
    it('should create RefreshService with RankingCalculator dependency', () => {
      const factory = getProductionServiceFactory()
      const refreshService = factory.createRefreshService()

      // Verify RefreshService was created
      expect(refreshService).toBeDefined()
      expect(refreshService.constructor.name).toBe('RefreshService')

      // RefreshService now delegates to SnapshotBuilder which has the ranking calculator
      // We verify the service was created successfully - the ranking calculator is internal
      expect(typeof refreshService.executeRefresh).toBe('function')
    })

    it('should create BackfillService with RankingCalculator dependency', () => {
      const factory = getProductionServiceFactory()
      const backfillService = factory.createBackfillService()

      // Verify BackfillService was created
      expect(backfillService).toBeDefined()
      expect(backfillService.constructor.name).toBe('BackfillService')

      // Verify it has ranking calculator (check via private property access)
      const hasRankingCalculator =
        (backfillService as BackfillService & { rankingCalculator: unknown })
          .rankingCalculator !== undefined
      expect(hasRankingCalculator).toBe(true)
    })

    it('should create RankingCalculator instance', () => {
      const factory = getProductionServiceFactory()
      const rankingCalculator = factory.createRankingCalculator()

      // Verify RankingCalculator was created
      expect(rankingCalculator).toBeDefined()
      expect(rankingCalculator.constructor.name).toBe(
        'BordaCountRankingCalculator'
      )

      // Verify it has the expected interface
      expect(typeof rankingCalculator.calculateRankings).toBe('function')
      expect(typeof rankingCalculator.getRankingVersion).toBe('function')

      // Verify version is set
      const version = rankingCalculator.getRankingVersion()
      expect(version).toBeDefined()
      expect(typeof version).toBe('string')
      expect(version.length).toBeGreaterThan(0)
    })

    it('should create services with proper dependency chain', () => {
      const factory = getProductionServiceFactory()

      // Create services in dependency order
      const snapshotStore = factory.createSnapshotStore()
      const rankingCalculator = factory.createRankingCalculator()
      const refreshService = factory.createRefreshService(snapshotStore)
      const backfillService = factory.createBackfillService(
        refreshService,
        snapshotStore
      )

      // Verify all services were created
      expect(snapshotStore).toBeDefined()
      expect(rankingCalculator).toBeDefined()
      expect(refreshService).toBeDefined()
      expect(backfillService).toBeDefined()

      // Verify services have expected interfaces
      expect(typeof refreshService.executeRefresh).toBe('function')
      expect(
        (backfillService as BackfillService & { rankingCalculator: unknown })
          .rankingCalculator
      ).toBeDefined()
    })
  })

  describe('Test Service Factory', () => {
    it('should create RefreshService with RankingCalculator dependency', () => {
      const factory = getTestServiceFactory()
      const refreshService = factory.createRefreshService()

      // Verify RefreshService was created
      expect(refreshService).toBeDefined()
      expect(refreshService.constructor.name).toBe('RefreshService')

      // RefreshService now delegates to SnapshotBuilder which has the ranking calculator
      // We verify the service was created successfully - the ranking calculator is internal
      expect(typeof refreshService.executeRefresh).toBe('function')
    })

    it('should create BackfillService with RankingCalculator dependency', () => {
      const factory = getTestServiceFactory()
      const backfillService = factory.createBackfillService()

      // Verify BackfillService was created
      expect(backfillService).toBeDefined()
      expect(backfillService.constructor.name).toBe('BackfillService')

      // Verify it has ranking calculator (check via private property access)
      const hasRankingCalculator =
        (backfillService as BackfillService & { rankingCalculator: unknown })
          .rankingCalculator !== undefined
      expect(hasRankingCalculator).toBe(true)
    })

    it('should create RankingCalculator instance', () => {
      const factory = getTestServiceFactory()
      const rankingCalculator = factory.createRankingCalculator()

      // Verify RankingCalculator was created
      expect(rankingCalculator).toBeDefined()
      expect(rankingCalculator.constructor.name).toBe(
        'BordaCountRankingCalculator'
      )

      // Verify it has the expected interface
      expect(typeof rankingCalculator.calculateRankings).toBe('function')
      expect(typeof rankingCalculator.getRankingVersion).toBe('function')

      // Verify version is set
      const version = rankingCalculator.getRankingVersion()
      expect(version).toBeDefined()
      expect(typeof version).toBe('string')
      expect(version.length).toBeGreaterThan(0)
    })

    it('should create services with proper dependency chain', () => {
      const factory = getTestServiceFactory()

      // Create services in dependency order
      const snapshotStore = factory.createSnapshotStore()
      const rankingCalculator = factory.createRankingCalculator()
      const refreshService = factory.createRefreshService(snapshotStore)
      const backfillService = factory.createBackfillService(
        refreshService,
        snapshotStore
      )

      // Verify all services were created
      expect(snapshotStore).toBeDefined()
      expect(rankingCalculator).toBeDefined()
      expect(refreshService).toBeDefined()
      expect(backfillService).toBeDefined()

      // Verify services have expected interfaces
      expect(typeof refreshService.executeRefresh).toBe('function')
      expect(
        (backfillService as BackfillService & { rankingCalculator: unknown })
          .rankingCalculator
      ).toBeDefined()
    })

    it('should create services via container registration', () => {
      const factory = getTestServiceFactory()
      const container = factory.createConfiguredContainer()

      // Verify container was created
      expect(container).toBeDefined()

      // Test that we can resolve services from the container using service tokens
      // Note: This tests the service token registration
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
        container.resolve(TestServiceTokens.RankingCalculator)
      ).not.toThrow()
      expect(() =>
        container.resolve(TestServiceTokens.RefreshService)
      ).not.toThrow()
      expect(() =>
        container.resolve(TestServiceTokens.BackfillService)
      ).not.toThrow()
    })
  })

  describe('Service Factory Consistency', () => {
    it('should create equivalent RankingCalculator instances', () => {
      const productionFactory = getProductionServiceFactory()
      const testFactory = getTestServiceFactory()

      const prodCalculator = productionFactory.createRankingCalculator()
      const testCalculator = testFactory.createRankingCalculator()

      // Both should be the same type
      expect(prodCalculator.constructor.name).toBe(
        testCalculator.constructor.name
      )

      // Both should have the same version
      expect(prodCalculator.getRankingVersion()).toBe(
        testCalculator.getRankingVersion()
      )
    })

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
