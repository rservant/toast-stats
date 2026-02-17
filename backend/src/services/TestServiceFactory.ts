/**
 * Test Service Factory
 *
 * Provides factory methods for creating test instances of services
 * with proper isolation and cleanup capabilities.
 *
 * Storage Abstraction:
 * This factory now supports the storage abstraction layer for test environments,
 * enabling tests to use the same storage interfaces as production code.
 *
 * Requirements: 1.3, 1.4
 */

import {
  ServiceContainer,
  ServiceConfiguration,
  ConfigurationProvider,
} from '../types/serviceContainer.js'
import {
  ICacheConfigService,
  ILogger,
  ICircuitBreakerManager,
} from '../types/serviceInterfaces.js'
import type {
  ISnapshotStorage,
  IRawCSVStorage,
} from '../types/storageInterfaces.js'
import {
  DefaultServiceContainer,
  createServiceToken,
  createServiceFactory,
  createInterfaceToken,
} from './ServiceContainer.js'
import { CacheConfigService } from './CacheConfigService.js'
import { CircuitBreakerManager } from '../utils/CircuitBreaker.js'
import { RefreshService } from './RefreshService.js'
import { FileSnapshotStore } from './SnapshotStore.js'
import { SnapshotStore } from '../types/snapshots.js'
import { RawCSVCacheService } from './RawCSVCacheService.js'
import { createMockCacheService } from '../__tests__/utils/mockCacheService.js'
import { LocalSnapshotStorage } from './storage/LocalSnapshotStorage.js'
import { LocalRawCSVStorage } from './storage/LocalRawCSVStorage.js'
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
   * Create CircuitBreakerManager instance
   */
  createCircuitBreakerManager(): ICircuitBreakerManager

  /**
   * Create ISnapshotStorage instance
   */
  createSnapshotStorage(): ISnapshotStorage

  /**
   * Create RefreshService instance
   */
  createRefreshService(snapshotStore?: SnapshotStore): RefreshService

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
   * Create CircuitBreakerManager instance
   */
  createCircuitBreakerManager(): ICircuitBreakerManager {
    const service = new CircuitBreakerManager()
    this.services.push(service)
    return service
  }

  /**
   * Create SnapshotStore instance (private helper for internal use)
   */
  private createSnapshotStoreInstance(
    cacheConfig?: ICacheConfigService
  ): SnapshotStore {
    const config = cacheConfig || this.createCacheConfigService()
    const service = new FileSnapshotStore({
      cacheDir: config.getCacheDirectory(),
      maxSnapshots: 10, // Lower limit for tests
      maxAgeDays: 1, // Shorter retention for tests
    })
    // FileSnapshotStore doesn't have dispose method, so we don't track it
    return service
  }

  /**
   * Create ISnapshotStorage instance for test environments
   */
  createSnapshotStorage(): ISnapshotStorage {
    const cacheConfig = this.createCacheConfigService()
    return new LocalSnapshotStorage({
      cacheDir: cacheConfig.getCacheDirectory(),
    })
  }

  /**
   * Create RefreshService instance
   */
  createRefreshService(snapshotStore?: SnapshotStore): RefreshService {
    const store = snapshotStore || this.createSnapshotStoreInstance()
    const mockCacheService = createMockCacheService()

    // RefreshService now uses SnapshotBuilder internally (no scraping)
    // Note: Rankings are pre-computed by scraper-cli, no RankingCalculator needed
    const service = new RefreshService(
      store,
      mockCacheService as unknown as RawCSVCacheService,
      undefined, // districtConfigService
      undefined // rankingCalculator - DEPRECATED: rankings are pre-computed by scraper-cli
    )
    // RefreshService doesn't have dispose method, so we don't track it
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
            maxSnapshots: 10, // Lower limit for tests
            maxAgeDays: 1, // Shorter retention for tests
          })
        },
        async () => {
          // FileSnapshotStore doesn't have dispose method
        }
      )
    )

    // Register RefreshService
    // Note: Rankings are pre-computed by scraper-cli, no RankingCalculator needed
    container.register(
      ServiceTokens.RefreshService,
      createServiceFactory(
        (container: ServiceContainer) => {
          const snapshotStore = container.resolve(ServiceTokens.SnapshotStore)
          const mockCacheService = createMockCacheService()

          // RefreshService now uses SnapshotBuilder internally (no scraping)
          return new RefreshService(
            snapshotStore,
            mockCacheService as unknown as RawCSVCacheService,
            undefined, // districtConfigService
            undefined // rankingCalculator - DEPRECATED: rankings are pre-computed by scraper-cli
          )
        },
        async () => {
          // RefreshService doesn't have dispose method
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
        () => this.createSnapshotStoreInstance(),
        async _instance => {
          // FileSnapshotStore doesn't have dispose method
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

    // =========================================================================
    // Storage Abstraction Layer
    // =========================================================================
    // Register storage interfaces for test environments.
    // Tests use local filesystem storage by default for isolation.
    //
    // Requirements: 1.3, 1.4
    // =========================================================================

    // Register ISnapshotStorage interface
    container.registerInterface<ISnapshotStorage>(
      'ISnapshotStorage',
      createServiceFactory(
        () => {
          const cacheConfig = this.createCacheConfigService()
          return new LocalSnapshotStorage({
            cacheDir: cacheConfig.getCacheDirectory(),
          })
        },
        async _instance => {
          // LocalSnapshotStorage doesn't have dispose method
        }
      )
    )

    // Register IRawCSVStorage interface
    container.registerInterface<IRawCSVStorage>(
      'IRawCSVStorage',
      createServiceFactory(
        () => {
          const cacheConfig = this.createCacheConfigService()
          const logger = new TestLogger()
          return new LocalRawCSVStorage(cacheConfig, logger)
        },
        async _instance => {
          // LocalRawCSVStorage doesn't have dispose method
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
  CircuitBreakerManager: createServiceToken(
    'CircuitBreakerManager',
    CircuitBreakerManager
  ),
  Logger: createServiceToken('Logger', TestLogger),
  SnapshotStore: createServiceToken('SnapshotStore', FileSnapshotStore),
  RefreshService: createServiceToken('RefreshService', RefreshService),
}

/**
 * Interface tokens for interface-based injection
 */
export const InterfaceTokens = {
  ICacheConfigService: createInterfaceToken<ICacheConfigService>(
    'ICacheConfigService'
  ),
  ICircuitBreakerManager: createInterfaceToken<ICircuitBreakerManager>(
    'ICircuitBreakerManager'
  ),
  ILogger: createInterfaceToken<ILogger>('ILogger'),
  SnapshotStore: createInterfaceToken<SnapshotStore>('SnapshotStore'),
  RefreshService: createInterfaceToken<RefreshService>('RefreshService'),

  // Storage abstraction layer interface tokens
  // Requirements: 1.3, 1.4
  ISnapshotStorage: createInterfaceToken<ISnapshotStorage>('ISnapshotStorage'),
  IRawCSVStorage: createInterfaceToken<IRawCSVStorage>('IRawCSVStorage'),
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
