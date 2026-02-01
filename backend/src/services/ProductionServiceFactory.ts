/**
 * Production Service Factory
 *
 * Provides factory methods for creating production instances of services
 * with proper dependency injection and lifecycle management.
 *
 * Storage Abstraction:
 * This factory now supports the storage abstraction layer, enabling
 * environment-based selection between local filesystem and GCP cloud storage.
 * The storage provider is determined by the STORAGE_PROVIDER environment variable.
 *
 * Requirements: 1.3, 1.4
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
  createInterfaceToken,
} from './ServiceContainer.js'
import { CacheConfigService } from './CacheConfigService.js'
import { RawCSVCacheService } from './RawCSVCacheService.js'
import { ILogger, ICircuitBreakerManager } from '../types/serviceInterfaces.js'
import type {
  ISnapshotStorage,
  IRawCSVStorage,
  ITimeSeriesIndexStorage,
} from '../types/storageInterfaces.js'
import { CircuitBreakerManager } from '../utils/CircuitBreaker.js'
import { logger } from '../utils/logger.js'
import { FileSnapshotStore } from './SnapshotStore.js'
import { RefreshService } from './RefreshService.js'
import {
  BordaCountRankingCalculator,
  type RankingCalculator,
} from './RankingCalculator.js'
import { BackfillService } from './UnifiedBackfillService.js'
import { DistrictConfigurationService } from './DistrictConfigurationService.js'
import { MonthEndDataMapper } from './MonthEndDataMapper.js'
import { SnapshotStore } from '../types/snapshots.js'
import { config } from '../config/index.js'
import { StorageProviderFactory } from './storage/StorageProviderFactory.js'

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
   * Create CircuitBreakerManager instance
   */
  createCircuitBreakerManager(): ICircuitBreakerManager

  /**
   * Create SnapshotStore instance
   *
   * @deprecated Use createSnapshotStorage() for storage abstraction layer support.
   * This method returns FileSnapshotStore directly for backward compatibility.
   */
  createSnapshotStore(cacheConfig?: CacheConfigService): SnapshotStore

  /**
   * Create ISnapshotStorage instance using the storage abstraction layer
   *
   * Returns the appropriate storage implementation based on the STORAGE_PROVIDER
   * environment variable:
   * - 'local' (default): Returns LocalSnapshotStorage (wraps FileSnapshotStore)
   * - 'gcp': Returns FirestoreSnapshotStorage
   *
   * This method should be preferred over createSnapshotStore() for new code
   * to ensure compatibility with both local and cloud storage backends.
   *
   * Requirements: 1.3, 1.4
   */
  createSnapshotStorage(): ISnapshotStorage

  /**
   * Create IRawCSVStorage instance using the storage abstraction layer
   *
   * Returns the appropriate storage implementation based on the STORAGE_PROVIDER
   * environment variable:
   * - 'local' (default): Returns LocalRawCSVStorage (wraps RawCSVCacheService)
   * - 'gcp': Returns GCSRawCSVStorage
   *
   * This method should be preferred over createRawCSVCacheService() for new code
   * to ensure compatibility with both local and cloud storage backends.
   *
   * Requirements: 1.3, 1.4
   */
  createRawCSVStorage(): IRawCSVStorage

  /**
   * Create ITimeSeriesIndexStorage instance using the storage abstraction layer
   *
   * Returns the appropriate storage implementation based on the STORAGE_PROVIDER
   * environment variable:
   * - 'local' (default): Returns LocalTimeSeriesIndexStorage
   * - 'gcp': Returns FirestoreTimeSeriesIndexStorage
   *
   * This method provides access to time-series index operations including
   * deleteSnapshotEntries for cascading deletion support.
   *
   * Requirements: 4.4, 4.5
   */
  createTimeSeriesIndexStorage(): ITimeSeriesIndexStorage

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
   *
   * @deprecated Use createRawCSVStorage() for storage abstraction layer support.
   * This method returns RawCSVCacheService directly for backward compatibility.
   */
  createRawCSVCacheService(cacheConfig?: CacheConfigService): RawCSVCacheService

  /**
   * Create MonthEndDataMapper instance
   */
  createMonthEndDataMapper(
    cacheConfig?: CacheConfigService,
    rawCSVCache?: RawCSVCacheService
  ): MonthEndDataMapper

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

    // =========================================================================
    // Storage Abstraction Layer
    // =========================================================================
    // Register storage providers using the StorageProviderFactory.
    // This enables environment-based selection between local filesystem
    // and GCP cloud storage (Firestore + GCS).
    //
    // The provider is determined by the STORAGE_PROVIDER environment variable:
    // - 'local' (default): Uses local filesystem storage
    // - 'gcp': Uses Cloud Firestore for snapshots and GCS for CSV files
    //
    // Requirements: 1.3, 1.4
    // =========================================================================

    // Create storage providers from environment configuration
    // This is done once and cached to ensure consistent provider instances
    const storageProviders = StorageProviderFactory.createFromEnvironment()

    // Register ISnapshotStorage interface
    // Provides abstracted snapshot storage operations that work with both
    // local filesystem and Cloud Firestore backends
    container.registerInterface<ISnapshotStorage>(
      'ISnapshotStorage',
      createServiceFactory(
        () => storageProviders.snapshotStorage,
        async () => {
          // Storage providers don't have dispose methods
        }
      )
    )

    // Register IRawCSVStorage interface
    // Provides abstracted CSV cache operations that work with both
    // local filesystem and Cloud Storage backends
    container.registerInterface<IRawCSVStorage>(
      'IRawCSVStorage',
      createServiceFactory(
        () => storageProviders.rawCSVStorage,
        async () => {
          // Storage providers don't have dispose methods
        }
      )
    )

    // Register ITimeSeriesIndexStorage interface
    // Provides abstracted time-series index operations that work with both
    // local filesystem and Cloud Firestore backends
    // Includes deleteSnapshotEntries for cascading deletion support
    // Requirements: 4.1, 4.4, 4.5
    container.registerInterface<ITimeSeriesIndexStorage>(
      'ITimeSeriesIndexStorage',
      createServiceFactory(
        () => storageProviders.timeSeriesIndexStorage,
        async () => {
          // Storage providers don't have dispose methods
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

    // Register SnapshotStore - using FileSnapshotStore for date-based folder structure
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
          // Use ISnapshotStorage from the storage abstraction layer
          // This enables environment-based selection between local and cloud storage
          const snapshotStorage =
            container.resolveInterface<ISnapshotStorage>('ISnapshotStorage')
          // Use IRawCSVStorage from the storage abstraction layer
          // This respects STORAGE_PROVIDER env var:
          // - 'gcp': Uses GCSRawCSVStorage (reads from GCS bucket)
          // - 'local' or unset: Uses LocalRawCSVStorage (reads from local filesystem)
          const rawCSVStorage =
            container.resolveInterface<IRawCSVStorage>('IRawCSVStorage')
          const rankingCalculator = container.resolve(
            ServiceTokens.RankingCalculator
          )

          // RefreshService now uses SnapshotBuilder internally (no scraping)
          // and accepts ISnapshotStorage and IRawCSVStorage for storage abstraction
          return new RefreshService(
            snapshotStorage,
            rawCSVStorage,
            undefined, // districtConfigService
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
          // Create DistrictConfigurationService with storage from StorageProviderFactory
          const storageProviders =
            StorageProviderFactory.createFromEnvironment()
          const configService = new DistrictConfigurationService(
            storageProviders.districtConfigStorage
          )

          return new BackfillService(
            refreshService,
            snapshotStore as FileSnapshotStore,
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
   * Create CircuitBreakerManager instance
   */
  createCircuitBreakerManager(): ICircuitBreakerManager {
    const service = new CircuitBreakerManager()
    this.services.push(service)
    return service
  }

  /**
   * Create SnapshotStore instance
   *
   * @deprecated Use createSnapshotStorage() for storage abstraction layer support.
   * This method returns FileSnapshotStore directly for backward compatibility.
   */
  createSnapshotStore(cacheConfig?: CacheConfigService): SnapshotStore {
    const config = cacheConfig || this.createCacheConfigService()
    const service = new FileSnapshotStore({
      cacheDir: config.getCacheDirectory(),
      maxSnapshots: 100,
      maxAgeDays: 30,
    })
    // FileSnapshotStore doesn't have dispose method, so we don't track it
    return service
  }

  /**
   * Create ISnapshotStorage instance using the storage abstraction layer
   *
   * Returns the appropriate storage implementation based on the STORAGE_PROVIDER
   * environment variable:
   * - 'local' (default): Returns LocalSnapshotStorage (wraps FileSnapshotStore)
   * - 'gcp': Returns FirestoreSnapshotStorage
   *
   * This method should be preferred over createSnapshotStore() for new code
   * to ensure compatibility with both local and cloud storage backends.
   *
   * Requirements: 1.3, 1.4
   */
  createSnapshotStorage(): ISnapshotStorage {
    const storageProviders = StorageProviderFactory.createFromEnvironment()
    return storageProviders.snapshotStorage
  }

  /**
   * Create IRawCSVStorage instance using the storage abstraction layer
   *
   * Returns the appropriate storage implementation based on the STORAGE_PROVIDER
   * environment variable:
   * - 'local' (default): Returns LocalRawCSVStorage (wraps RawCSVCacheService)
   * - 'gcp': Returns GCSRawCSVStorage
   *
   * This method should be preferred over createRawCSVCacheService() for new code
   * to ensure compatibility with both local and cloud storage backends.
   *
   * Requirements: 1.3, 1.4
   */
  createRawCSVStorage(): IRawCSVStorage {
    const storageProviders = StorageProviderFactory.createFromEnvironment()
    return storageProviders.rawCSVStorage
  }

  /**
   * Create ITimeSeriesIndexStorage instance using the storage abstraction layer
   *
   * Returns the appropriate storage implementation based on the STORAGE_PROVIDER
   * environment variable:
   * - 'local' (default): Returns LocalTimeSeriesIndexStorage
   * - 'gcp': Returns FirestoreTimeSeriesIndexStorage
   *
   * This method provides access to time-series index operations including
   * deleteSnapshotEntries for cascading deletion support.
   *
   * Requirements: 4.4, 4.5
   */
  createTimeSeriesIndexStorage(): ITimeSeriesIndexStorage {
    const storageProviders = StorageProviderFactory.createFromEnvironment()
    return storageProviders.timeSeriesIndexStorage
  }

  /**
   * Create RefreshService instance
   *
   * This method creates a RefreshService using the storage abstraction layer,
   * respecting the STORAGE_PROVIDER environment variable for both snapshot
   * storage and raw CSV storage.
   *
   * Requirements: 1.3, 1.4 (Storage Abstraction)
   */
  createRefreshService(snapshotStore?: SnapshotStore): RefreshService {
    // Use storage abstraction layer to respect STORAGE_PROVIDER env var
    // - STORAGE_PROVIDER=gcp: Uses FirestoreSnapshotStorage + GCSRawCSVStorage
    // - STORAGE_PROVIDER=local or unset: Uses local filesystem storage
    const storageProviders = StorageProviderFactory.createFromEnvironment()
    const store = snapshotStore || storageProviders.snapshotStorage
    const rawCSVStorage = storageProviders.rawCSVStorage
    const rankingCalculator = this.createRankingCalculator()

    // RefreshService now uses SnapshotBuilder internally (no scraping)
    // and accepts IRawCSVStorage for storage abstraction
    const service = new RefreshService(
      store,
      rawCSVStorage,
      undefined, // districtConfigService
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
   *
   * @deprecated Use createRawCSVStorage() for storage abstraction layer support.
   * This method returns RawCSVCacheService directly for backward compatibility.
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
   * Create MonthEndDataMapper instance
   */
  createMonthEndDataMapper(
    cacheConfig?: CacheConfigService,
    rawCSVCache?: RawCSVCacheService
  ): MonthEndDataMapper {
    const config = cacheConfig || this.createCacheConfigService()
    const cache = rawCSVCache || this.createRawCSVCacheService(config)
    const logger = new ProductionLogger()
    const service = new MonthEndDataMapper(config, cache, logger)
    // MonthEndDataMapper doesn't have dispose method, so we don't track it
    return service
  }

  /**
   * Create BackfillService instance
   *
   * Uses the storage abstraction layer to respect STORAGE_PROVIDER env var:
   * - STORAGE_PROVIDER=gcp: Uses FirestoreSnapshotStorage
   * - STORAGE_PROVIDER=local or unset: Uses LocalSnapshotStorage
   *
   * Requirements: 1.3, 1.4 (Storage Abstraction)
   */
  createBackfillService(
    refreshService?: RefreshService,
    snapshotStore?: SnapshotStore,
    configService?: DistrictConfigurationService
  ): BackfillService {
    const refresh = refreshService || this.createRefreshService()
    // Use storage abstraction layer if no store provided
    const storageProviders = StorageProviderFactory.createFromEnvironment()
    const store = snapshotStore || storageProviders.snapshotStorage
    // Create DistrictConfigurationService with storage from StorageProviderFactory if not provided
    let config = configService
    if (!config) {
      config = new DistrictConfigurationService(
        storageProviders.districtConfigStorage
      )
    }
    const rankingCalculator = this.createRankingCalculator()

    const service = new BackfillService(
      refresh,
      store,
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
 * Interface tokens for storage abstraction layer
 *
 * These tokens enable interface-based dependency injection for the
 * storage abstraction layer, allowing services to depend on storage
 * interfaces rather than concrete implementations.
 *
 * Requirements: 1.3, 1.4
 */
export const InterfaceTokens = {
  /**
   * Token for ISnapshotStorage interface
   *
   * Resolves to either LocalSnapshotStorage or FirestoreSnapshotStorage
   * based on the STORAGE_PROVIDER environment variable.
   */
  ISnapshotStorage: createInterfaceToken<ISnapshotStorage>('ISnapshotStorage'),

  /**
   * Token for IRawCSVStorage interface
   *
   * Resolves to either LocalRawCSVStorage or GCSRawCSVStorage
   * based on the STORAGE_PROVIDER environment variable.
   */
  IRawCSVStorage: createInterfaceToken<IRawCSVStorage>('IRawCSVStorage'),

  /**
   * Token for ITimeSeriesIndexStorage interface
   *
   * Resolves to either LocalTimeSeriesIndexStorage or FirestoreTimeSeriesIndexStorage
   * based on the STORAGE_PROVIDER environment variable.
   * Includes deleteSnapshotEntries for cascading deletion support.
   *
   * Requirements: 4.1, 4.4, 4.5
   */
  ITimeSeriesIndexStorage: createInterfaceToken<ITimeSeriesIndexStorage>(
    'ITimeSeriesIndexStorage'
  ),
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
