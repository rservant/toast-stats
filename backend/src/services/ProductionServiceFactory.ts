/**
 * Production Service Factory
 *
 * Provides factory methods for creating production instances of services
 * with proper dependency injection and lifecycle management.
 */

import {
  ServiceContainer,
  ServiceConfiguration,
  ConfigurationProvider,
} from '../types/serviceContainer.js'
import {
  DefaultServiceContainer,
  createServiceToken,
  createServiceFactory,
} from './ServiceContainer.js'
import { CacheConfigService } from './CacheConfigService.js'
import { RawCSVCacheService } from './RawCSVCacheService.js'
import { ILogger, ICircuitBreakerManager } from '../types/serviceInterfaces.js'
import { AnalyticsEngine } from './AnalyticsEngine.js'
import { DistrictCacheManager } from './DistrictCacheManager.js'
import { CircuitBreakerManager } from '../utils/CircuitBreaker.js'
import { logger } from '../utils/logger.js'
import { FileSnapshotStore } from './FileSnapshotStore.js'
import { PerDistrictFileSnapshotStore } from './PerDistrictSnapshotStore.js'
import { RefreshService } from './RefreshService.js'
import { ToastmastersScraper } from './ToastmastersScraper.js'
import {
  BordaCountRankingCalculator,
  type RankingCalculator,
} from './RankingCalculator.js'
import { BackfillService } from './UnifiedBackfillService.js'
import { DistrictConfigurationService } from './DistrictConfigurationService.js'
import { SnapshotStore } from '../types/snapshots.js'
import { config } from '../config/index.js'

/**
 * Production configuration provider
 */
export class ProductionConfigurationProvider implements ConfigurationProvider {
  private config: ServiceConfiguration

  constructor(overrides: Partial<ServiceConfiguration> = {}) {
    this.config = {
      cacheDirectory: process.env['CACHE_DIR'] || './cache',
      environment:
        (process.env['NODE_ENV'] as 'test' | 'development' | 'production') ||
        'development',
      logLevel:
        (process.env['LOG_LEVEL'] as 'debug' | 'info' | 'warn' | 'error') ||
        'info',
      ...overrides,
    }
  }

  getConfiguration(): ServiceConfiguration {
    return { ...this.config }
  }

  updateConfiguration(updates: Partial<ServiceConfiguration>): void {
    this.config = { ...this.config, ...updates }
  }
}

/**
 * Production logger wrapper
 */
export class ProductionLogger implements ILogger {
  info(message: string, data?: unknown): void {
    logger.info(message, data)
  }

  warn(message: string, data?: unknown): void {
    logger.warn(message, data)
  }

  error(message: string, error?: Error | unknown): void {
    logger.error(message, error)
  }

  debug(message: string, data?: unknown): void {
    logger.debug(message, data)
  }
}

/**
 * Production service factory for creating production instances
 */
export interface ProductionServiceFactory {
  /**
   * Create a production container with all services registered
   */
  createProductionContainer(): ServiceContainer

  /**
   * Create production configuration provider
   */
  createProductionConfiguration(
    overrides?: Partial<ServiceConfiguration>
  ): ConfigurationProvider

  /**
   * Create CacheConfigService instance with dependency injection
   */
  createCacheConfigService(
    config?: Partial<ServiceConfiguration>
  ): CacheConfigService

  /**
   * Create AnalyticsEngine instance with dependency injection
   */
  createAnalyticsEngine(cacheManager?: DistrictCacheManager): AnalyticsEngine

  /**
   * Create DistrictCacheManager instance
   */
  createDistrictCacheManager(
    cacheConfig?: CacheConfigService
  ): DistrictCacheManager

  /**
   * Create CircuitBreakerManager instance
   */
  createCircuitBreakerManager(): ICircuitBreakerManager

  /**
   * Create SnapshotStore instance
   */
  createSnapshotStore(cacheConfig?: CacheConfigService): SnapshotStore

  /**
   * Create RefreshService instance
   */
  createRefreshService(snapshotStore?: SnapshotStore): RefreshService

  /**
   * Create RankingCalculator instance
   */
  createRankingCalculator(): RankingCalculator

  /**
   * Create RawCSVCacheService instance
   */
  createRawCSVCacheService(cacheConfig?: CacheConfigService): RawCSVCacheService

  /**
   * Create BackfillService instance
   */
  createBackfillService(
    refreshService?: RefreshService,
    snapshotStore?: SnapshotStore,
    configService?: DistrictConfigurationService
  ): BackfillService

  /**
   * Cleanup all resources
   */
  cleanup(): Promise<void>
}

/**
 * Default implementation of production service factory
 */
export class DefaultProductionServiceFactory implements ProductionServiceFactory {
  private containers: ServiceContainer[] = []
  private configurations: ProductionConfigurationProvider[] = []
  private services: Array<{ dispose: () => Promise<void> }> = []

  /**
   * Create a production container with all services registered
   */
  createProductionContainer(): ServiceContainer {
    const container = new DefaultServiceContainer()
    const serviceConfig = this.createProductionConfiguration()

    // Register configuration provider
    container.register(
      ServiceTokens.Configuration,
      createServiceFactory(
        () => serviceConfig,
        async () => {
          // Configuration doesn't need disposal
        }
      )
    )

    // Register logger
    container.register(
      ServiceTokens.Logger,
      createServiceFactory(
        () => new ProductionLogger(),
        async () => {
          // Logger doesn't need disposal
        }
      )
    )

    // Register CacheConfigService
    container.register(
      ServiceTokens.CacheConfigService,
      createServiceFactory(
        (container: ServiceContainer) => {
          const config = container.resolve(ServiceTokens.Configuration)
          const logger = container.resolve(ServiceTokens.Logger)
          return new CacheConfigService(config.getConfiguration(), logger)
        },
        async (instance: CacheConfigService) => {
          await instance.dispose()
        }
      )
    )

    // Register RawCSVCacheService
    container.register(
      ServiceTokens.RawCSVCacheService,
      createServiceFactory(
        (container: ServiceContainer) => {
          const cacheConfig = container.resolve(
            ServiceTokens.CacheConfigService
          )
          const logger = container.resolve(ServiceTokens.Logger)
          return new RawCSVCacheService(cacheConfig, logger)
        },
        async (instance: RawCSVCacheService) => {
          await instance.dispose()
        }
      )
    )

    // Register DistrictCacheManager
    container.register(
      ServiceTokens.DistrictCacheManager,
      createServiceFactory(
        (container: ServiceContainer) => {
          const cacheConfig = container.resolve(
            ServiceTokens.CacheConfigService
          )
          return new DistrictCacheManager(cacheConfig.getCacheDirectory())
        },
        async () => {
          // DistrictCacheManager doesn't have dispose method
        }
      )
    )

    // Register AnalyticsEngine
    container.register(
      ServiceTokens.AnalyticsEngine,
      createServiceFactory(
        (container: ServiceContainer) => {
          const cacheManager = container.resolve(
            ServiceTokens.DistrictCacheManager
          )
          return new AnalyticsEngine(cacheManager)
        },
        async (instance: AnalyticsEngine) => {
          await instance.dispose()
        }
      )
    )

    // Register CircuitBreakerManager
    container.register(
      ServiceTokens.CircuitBreakerManager,
      createServiceFactory(
        () => new CircuitBreakerManager(),
        async (instance: CircuitBreakerManager) => {
          await instance.dispose()
        }
      )
    )

    // Register SnapshotStore
    container.register(
      ServiceTokens.SnapshotStore,
      createServiceFactory(
        (container: ServiceContainer) => {
          const cacheConfig = container.resolve(
            ServiceTokens.CacheConfigService
          )
          return new FileSnapshotStore({
            cacheDir: cacheConfig.getCacheDirectory(),
            maxSnapshots: config.snapshots.maxSnapshots,
            maxAgeDays: config.snapshots.maxAgeDays,
            enableCompression: config.snapshots.enableCompression,
          })
        },
        async () => {
          // FileSnapshotStore doesn't have dispose method
        }
      )
    )

    // Register RankingCalculator
    container.register(
      ServiceTokens.RankingCalculator,
      createServiceFactory(
        () => new BordaCountRankingCalculator(),
        async () => {
          // RankingCalculator doesn't have dispose method
        }
      )
    )

    // Register RefreshService
    container.register(
      ServiceTokens.RefreshService,
      createServiceFactory(
        (container: ServiceContainer) => {
          const snapshotStore = container.resolve(ServiceTokens.SnapshotStore)
          const rawCSVCacheService = container.resolve(
            ServiceTokens.RawCSVCacheService
          )
          const rankingCalculator = container.resolve(
            ServiceTokens.RankingCalculator
          )

          // Create ToastmastersScraper with injected cache service
          const scraper = new ToastmastersScraper(rawCSVCacheService)

          return new RefreshService(
            snapshotStore,
            scraper,
            undefined,
            undefined,
            rankingCalculator
          )
        },
        async () => {
          // RefreshService doesn't have dispose method
        }
      )
    )

    // Register BackfillService
    container.register(
      ServiceTokens.BackfillService,
      createServiceFactory(
        (container: ServiceContainer) => {
          const refreshService = container.resolve(ServiceTokens.RefreshService)
          const snapshotStore = container.resolve(ServiceTokens.SnapshotStore)
          const rankingCalculator = container.resolve(
            ServiceTokens.RankingCalculator
          )
          const configService = new DistrictConfigurationService()

          return new BackfillService(
            refreshService,
            snapshotStore as PerDistrictFileSnapshotStore, // Cast to PerDistrictFileSnapshotStore - they're compatible
            configService,
            undefined, // alertManager
            undefined, // circuitBreakerManager
            rankingCalculator
          )
        },
        async () => {
          // BackfillService doesn't have dispose method
        }
      )
    )

    this.containers.push(container)
    return container
  }

  /**
   * Create production configuration provider
   */
  createProductionConfiguration(
    overrides?: Partial<ServiceConfiguration>
  ): ConfigurationProvider {
    const config = new ProductionConfigurationProvider(overrides)
    this.configurations.push(config)
    return config
  }

  /**
   * Create CacheConfigService instance with dependency injection
   */
  createCacheConfigService(
    config?: Partial<ServiceConfiguration>
  ): CacheConfigService {
    const serviceConfig = this.createProductionConfiguration(config)
    const logger = new ProductionLogger()
    const service = new CacheConfigService(
      serviceConfig.getConfiguration(),
      logger
    )
    this.services.push(service)
    return service
  }

  /**
   * Create AnalyticsEngine instance with dependency injection
   */
  createAnalyticsEngine(cacheManager?: DistrictCacheManager): AnalyticsEngine {
    const manager = cacheManager || this.createDistrictCacheManager()
    const service = new AnalyticsEngine(manager)
    this.services.push(service)
    return service
  }

  /**
   * Create DistrictCacheManager instance
   */
  createDistrictCacheManager(
    cacheConfig?: CacheConfigService
  ): DistrictCacheManager {
    const config = cacheConfig || this.createCacheConfigService()
    const cacheDir = config.getCacheDirectory()
    const service = new DistrictCacheManager(cacheDir)
    // DistrictCacheManager doesn't have dispose method, so we don't track it
    return service
  }

  /**
   * Create CircuitBreakerManager instance
   */
  createCircuitBreakerManager(): ICircuitBreakerManager {
    const service = new CircuitBreakerManager()
    this.services.push(service)
    return service
  }

  /**
   * Create SnapshotStore instance
   */
  createSnapshotStore(cacheConfig?: CacheConfigService): SnapshotStore {
    const config = cacheConfig || this.createCacheConfigService()
    const service = new FileSnapshotStore({
      cacheDir: config.getCacheDirectory(),
      maxSnapshots: 100,
      maxAgeDays: 30,
      enableCompression: false,
    })
    // FileSnapshotStore doesn't have dispose method, so we don't track it
    return service
  }

  /**
   * Create RefreshService instance
   */
  createRefreshService(snapshotStore?: SnapshotStore): RefreshService {
    const store = snapshotStore || this.createSnapshotStore()
    const rawCSVCacheService = this.createRawCSVCacheService()
    const rankingCalculator = this.createRankingCalculator()

    // Create ToastmastersScraper with injected cache service
    const scraper = new ToastmastersScraper(rawCSVCacheService)

    const service = new RefreshService(
      store,
      scraper,
      undefined,
      undefined,
      rankingCalculator
    )
    // RefreshService doesn't have dispose method, so we don't track it
    return service
  }

  /**
   * Create RankingCalculator instance
   */
  createRankingCalculator(): RankingCalculator {
    const calculator = new BordaCountRankingCalculator()
    // RankingCalculator doesn't have dispose method, so we don't track it
    return calculator
  }

  /**
   * Create RawCSVCacheService instance
   */
  createRawCSVCacheService(
    cacheConfig?: CacheConfigService
  ): RawCSVCacheService {
    const config = cacheConfig || this.createCacheConfigService()
    const logger = new ProductionLogger()
    const service = new RawCSVCacheService(config, logger)
    this.services.push(service)
    return service
  }

  /**
   * Create BackfillService instance
   */
  createBackfillService(
    refreshService?: RefreshService,
    snapshotStore?: SnapshotStore,
    configService?: DistrictConfigurationService
  ): BackfillService {
    const refresh = refreshService || this.createRefreshService()
    const store = snapshotStore || this.createSnapshotStore()
    const config = configService || new DistrictConfigurationService()
    const rankingCalculator = this.createRankingCalculator()

    const service = new BackfillService(
      refresh,
      store as PerDistrictFileSnapshotStore, // Cast to PerDistrictFileSnapshotStore - they're compatible
      config,
      undefined, // alertManager
      undefined, // circuitBreakerManager
      rankingCalculator
    )
    // BackfillService doesn't have dispose method, so we don't track it
    return service
  }

  /**
   * Cleanup all resources
   */
  async cleanup(): Promise<void> {
    // Dispose all services
    const serviceDisposePromises = this.services.map(service =>
      service.dispose()
    )
    await Promise.all(serviceDisposePromises)

    // Dispose all containers
    const containerDisposePromises = this.containers.map(container =>
      container.dispose()
    )
    await Promise.all(containerDisposePromises)

    // Clear tracking arrays
    this.containers = []
    this.configurations = []
    this.services = []
  }
}

/**
 * Service tokens for common services
 */
export const ServiceTokens = {
  Configuration: createServiceToken(
    'Configuration',
    ProductionConfigurationProvider
  ),
  CacheConfigService: createServiceToken(
    'CacheConfigService',
    CacheConfigService
  ),
  RawCSVCacheService: createServiceToken(
    'RawCSVCacheService',
    RawCSVCacheService
  ),
  AnalyticsEngine: createServiceToken('AnalyticsEngine', AnalyticsEngine),
  DistrictCacheManager: createServiceToken(
    'DistrictCacheManager',
    DistrictCacheManager
  ),
  CircuitBreakerManager: createServiceToken(
    'CircuitBreakerManager',
    CircuitBreakerManager
  ),
  Logger: createServiceToken('Logger', ProductionLogger),
  SnapshotStore: createServiceToken('SnapshotStore', FileSnapshotStore),
  RankingCalculator: createServiceToken(
    'RankingCalculator',
    BordaCountRankingCalculator
  ),
  RefreshService: createServiceToken('RefreshService', RefreshService),
  BackfillService: createServiceToken('BackfillService', BackfillService),
}

/**
 * Global production service factory instance
 */
let globalProductionFactory: DefaultProductionServiceFactory | null = null

/**
 * Get or create the global production service factory
 */
export function getProductionServiceFactory(): ProductionServiceFactory {
  if (!globalProductionFactory) {
    globalProductionFactory = new DefaultProductionServiceFactory()
  }
  return globalProductionFactory
}

/**
 * Reset the global production service factory (for cleanup)
 */
export async function resetProductionServiceFactory(): Promise<void> {
  if (globalProductionFactory) {
    await globalProductionFactory.cleanup()
    globalProductionFactory = null
  }
}
