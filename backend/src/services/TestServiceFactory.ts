/**
 * Test Service Factory
 *
 * Provides factory methods for creating test instances of services
 * with proper isolation and cleanup capabilities.
 */

import {
  ServiceContainer,
  ServiceConfiguration,
  ConfigurationProvider,
} from '../types/serviceContainer.js'
import {
  ICacheConfigService,
  IAnalyticsEngine,
  IDistrictCacheManager,
  ILogger,
  ICircuitBreakerManager,
} from '../types/serviceInterfaces.js'
import {
  DefaultServiceContainer,
  createServiceToken,
  createServiceFactory,
  createInterfaceToken,
} from './ServiceContainer.js'
import { CacheConfigService } from './CacheConfigService.js'
import { AnalyticsEngine } from './AnalyticsEngine.js'
import { DistrictCacheManager } from './DistrictCacheManager.js'
import { CircuitBreakerManager } from '../utils/CircuitBreaker.js'
import {
  BordaCountRankingCalculator,
  type RankingCalculator,
} from './RankingCalculator.js'
import { RefreshService } from './RefreshService.js'
import { BackfillService } from './UnifiedBackfillService.js'
import { DistrictConfigurationService } from './DistrictConfigurationService.js'
import { FileSnapshotStore } from './FileSnapshotStore.js'
import { SnapshotStore } from '../types/snapshots.js'
import path from 'path'

/**
 * Test-specific configuration provider
 */
export class TestConfigurationProvider implements ConfigurationProvider {
  private config: ServiceConfiguration

  constructor(overrides: Partial<ServiceConfiguration> = {}) {
    const baseConfig = {
      cacheDirectory: '/tmp/test-cache',
      environment: 'test' as const,
      logLevel: 'error' as const,
    }

    // Resolve cache directory path if provided in overrides
    const resolvedOverrides = { ...overrides }
    if (resolvedOverrides.cacheDirectory) {
      resolvedOverrides.cacheDirectory = path.resolve(
        resolvedOverrides.cacheDirectory
      )
    }

    this.config = {
      ...baseConfig,
      ...resolvedOverrides,
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
 * Test logger implementation
 */
export class TestLogger implements ILogger {
  public logs: Array<{ level: string; message: string; data?: unknown }> = []

  info(message: string, data?: unknown): void {
    this.logs.push({ level: 'info', message, data })
  }

  warn(message: string, data?: unknown): void {
    this.logs.push({ level: 'warn', message, data })
  }

  error(message: string, error?: Error | unknown): void {
    this.logs.push({ level: 'error', message, data: error })
  }

  debug(message: string, data?: unknown): void {
    this.logs.push({ level: 'debug', message, data })
  }

  clear(): void {
    this.logs = []
  }
}

/**
 * Test service factory for creating isolated test instances
 */
export interface TestServiceFactory {
  /**
   * Create a test container with isolated services
   */
  createTestContainer(): ServiceContainer

  /**
   * Create test configuration provider
   */
  createTestConfiguration(
    overrides?: Partial<ServiceConfiguration>
  ): ConfigurationProvider

  /**
   * Create CacheConfigService instance with dependency injection
   */
  createCacheConfigService(
    config?: Partial<ServiceConfiguration>
  ): ICacheConfigService

  /**
   * Create AnalyticsEngine instance with dependency injection
   */
  createAnalyticsEngine(cacheManager?: IDistrictCacheManager): IAnalyticsEngine

  /**
   * Create DistrictCacheManager instance
   */
  createDistrictCacheManager(
    cacheConfig?: ICacheConfigService
  ): IDistrictCacheManager

  /**
   * Create CircuitBreakerManager instance
   */
  createCircuitBreakerManager(): ICircuitBreakerManager

  /**
   * Create SnapshotStore instance
   */
  createSnapshotStore(cacheConfig?: ICacheConfigService): SnapshotStore

  /**
   * Create RefreshService instance
   */
  createRefreshService(snapshotStore?: SnapshotStore): RefreshService

  /**
   * Create RankingCalculator instance
   */
  createRankingCalculator(): RankingCalculator

  /**
   * Create BackfillService instance
   */
  createBackfillService(
    refreshService?: RefreshService,
    snapshotStore?: SnapshotStore,
    configService?: DistrictConfigurationService
  ): BackfillService

  /**
   * Create a fully configured service container with all services registered
   */
  createConfiguredContainer(
    config?: Partial<ServiceConfiguration>
  ): ServiceContainer

  /**
   * Create service by interface name
   */
  createServiceByInterface<T>(interfaceName: string): T

  /**
   * Register mock service for testing
   */
  registerMockService<T>(interfaceName: string, mockInstance: T): void

  /**
   * Clear all mock registrations
   */
  clearMocks(): void

  /**
   * Cleanup all test resources
   */
  cleanup(): Promise<void>
}

/**
 * Default implementation of test service factory
 */
export class DefaultTestServiceFactory implements TestServiceFactory {
  private containers: ServiceContainer[] = []
  private configurations: TestConfigurationProvider[] = []
  private services: Array<{ dispose: () => Promise<void> }> = []
  private mockRegistrations = new Map<string, unknown>()

  /**
   * Create a test container with isolated services
   */
  createTestContainer(): ServiceContainer {
    const container = new DefaultServiceContainer()
    this.containers.push(container)
    return container
  }

  /**
   * Create test configuration provider
   */
  createTestConfiguration(
    overrides?: Partial<ServiceConfiguration>
  ): ConfigurationProvider {
    const config = new TestConfigurationProvider(overrides)
    this.configurations.push(config)
    return config
  }

  /**
   * Create CacheConfigService instance with dependency injection
   */
  createCacheConfigService(
    config?: Partial<ServiceConfiguration>
  ): ICacheConfigService {
    const serviceConfig = this.createTestConfiguration(config)
    const logger = new TestLogger()
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
  createAnalyticsEngine(
    cacheManager?: IDistrictCacheManager
  ): IAnalyticsEngine {
    const manager = cacheManager || this.createDistrictCacheManager()
    const service = new AnalyticsEngine(manager)
    this.services.push(service)
    return service
  }

  /**
   * Create DistrictCacheManager instance
   */
  createDistrictCacheManager(
    cacheConfig?: ICacheConfigService
  ): IDistrictCacheManager {
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
  createSnapshotStore(cacheConfig?: ICacheConfigService): SnapshotStore {
    const config = cacheConfig || this.createCacheConfigService()
    const service = new FileSnapshotStore({
      cacheDir: config.getCacheDirectory(),
      maxSnapshots: 10, // Lower limit for tests
      maxAgeDays: 1, // Shorter retention for tests
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
    const rankingCalculator = this.createRankingCalculator()
    const service = new RefreshService(
      store,
      undefined,
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
      store as any, // Cast to PerDistrictFileSnapshotStore - they're compatible
      config,
      undefined, // alertManager
      undefined, // circuitBreakerManager
      rankingCalculator
    )
    // BackfillService doesn't have dispose method, so we don't track it
    return service
  }

  /**
   * Create a fully configured service container with all services registered
   */
  createConfiguredContainer(
    config?: Partial<ServiceConfiguration>
  ): ServiceContainer {
    const container = this.createTestContainer()
    const serviceConfig = this.createTestConfiguration(config)

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

    // Register CacheConfigService
    container.register(
      ServiceTokens.CacheConfigService,
      createServiceFactory(
        (container: ServiceContainer) => {
          const config = container.resolve(ServiceTokens.Configuration)
          const logger = new TestLogger()
          return new CacheConfigService(config.getConfiguration(), logger)
        },
        async (instance: CacheConfigService) => {
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
            maxSnapshots: 10, // Lower limit for tests
            maxAgeDays: 1, // Shorter retention for tests
            enableCompression: false,
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
          const rankingCalculator = container.resolve(
            ServiceTokens.RankingCalculator
          )
          return new RefreshService(
            snapshotStore,
            undefined,
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
            snapshotStore as any, // Cast to PerDistrictFileSnapshotStore - they're compatible
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

    return container
  }

  /**
   * Create service by interface name
   */
  createServiceByInterface<T>(interfaceName: string): T {
    // Check for mock first
    if (this.mockRegistrations.has(interfaceName)) {
      return this.mockRegistrations.get(interfaceName) as T
    }

    // Create a temporary container with interface registrations
    const container = this.createTestContainer()

    // Register common interfaces
    this.registerCommonInterfaces(container)

    return container.resolveInterface<T>(interfaceName)
  }

  /**
   * Register mock service for testing
   */
  registerMockService<T>(interfaceName: string, mockInstance: T): void {
    this.mockRegistrations.set(interfaceName, mockInstance)
  }

  /**
   * Clear all mock registrations
   */
  clearMocks(): void {
    this.mockRegistrations.clear()
  }

  /**
   * Register common interfaces with the container
   */
  private registerCommonInterfaces(container: ServiceContainer): void {
    // Register ICacheConfigService
    container.registerInterface(
      'ICacheConfigService',
      createServiceFactory(
        () => this.createCacheConfigService(),
        async instance => await instance.dispose()
      )
    )

    // Register IAnalyticsEngine
    container.registerInterface(
      'IAnalyticsEngine',
      createServiceFactory(
        () => this.createAnalyticsEngine(),
        async instance => await instance.dispose()
      )
    )

    // Register IDistrictCacheManager
    container.registerInterface(
      'IDistrictCacheManager',
      createServiceFactory(
        () => this.createDistrictCacheManager(),
        async _instance => {
          // DistrictCacheManager doesn't have dispose method
        }
      )
    )

    // Register ICircuitBreakerManager
    container.registerInterface(
      'ICircuitBreakerManager',
      createServiceFactory(
        () => this.createCircuitBreakerManager(),
        async instance => await instance.dispose()
      )
    )

    // Register SnapshotStore
    container.registerInterface(
      'SnapshotStore',
      createServiceFactory(
        () => this.createSnapshotStore(),
        async _instance => {
          // FileSnapshotStore doesn't have dispose method
        }
      )
    )

    // Register RankingCalculator
    container.registerInterface(
      'RankingCalculator',
      createServiceFactory(
        () => this.createRankingCalculator(),
        async _instance => {
          // RankingCalculator doesn't have dispose method
        }
      )
    )

    // Register RefreshService
    container.registerInterface(
      'RefreshService',
      createServiceFactory(
        () => this.createRefreshService(),
        async _instance => {
          // RefreshService doesn't have dispose method
        }
      )
    )

    // Register BackfillService
    container.registerInterface(
      'BackfillService',
      createServiceFactory(
        () => this.createBackfillService(),
        async _instance => {
          // BackfillService doesn't have dispose method
        }
      )
    )
  }

  /**
   * Cleanup all test resources
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

    // Clear mocks
    this.mockRegistrations.clear()
  }
}

/**
 * Service tokens for common services
 */
export const ServiceTokens = {
  Configuration: createServiceToken('Configuration', TestConfigurationProvider),
  CacheConfigService: createServiceToken(
    'CacheConfigService',
    CacheConfigService
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
  Logger: createServiceToken('Logger', TestLogger),
  SnapshotStore: createServiceToken('SnapshotStore', FileSnapshotStore),
  RankingCalculator: createServiceToken(
    'RankingCalculator',
    BordaCountRankingCalculator
  ),
  RefreshService: createServiceToken('RefreshService', RefreshService),
  BackfillService: createServiceToken('BackfillService', BackfillService),
}

/**
 * Interface tokens for interface-based injection
 */
export const InterfaceTokens = {
  ICacheConfigService: createInterfaceToken<ICacheConfigService>(
    'ICacheConfigService'
  ),
  IAnalyticsEngine: createInterfaceToken<IAnalyticsEngine>('IAnalyticsEngine'),
  IDistrictCacheManager: createInterfaceToken<IDistrictCacheManager>(
    'IDistrictCacheManager'
  ),
  ICircuitBreakerManager: createInterfaceToken<ICircuitBreakerManager>(
    'ICircuitBreakerManager'
  ),
  ILogger: createInterfaceToken<ILogger>('ILogger'),
  SnapshotStore: createInterfaceToken<SnapshotStore>('SnapshotStore'),
  RankingCalculator:
    createInterfaceToken<RankingCalculator>('RankingCalculator'),
  RefreshService: createInterfaceToken<RefreshService>('RefreshService'),
  BackfillService: createInterfaceToken<BackfillService>('BackfillService'),
}

/**
 * Global test service factory instance
 */
let globalTestFactory: DefaultTestServiceFactory | null = null

/**
 * Get or create the global test service factory
 */
export function getTestServiceFactory(): TestServiceFactory {
  if (!globalTestFactory) {
    globalTestFactory = new DefaultTestServiceFactory()
  }
  return globalTestFactory
}

/**
 * Reset the global test service factory (for test cleanup)
 */
export async function resetTestServiceFactory(): Promise<void> {
  if (globalTestFactory) {
    await globalTestFactory.cleanup()
    globalTestFactory = null
  }
}
