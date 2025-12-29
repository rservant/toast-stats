/**
 * Service Container Types
 *
 * Defines the core types for dependency injection and service management.
 * These types support the migration from singleton patterns to proper
 * dependency injection for improved test isolation and reliability.
 */

/**
 * Service lifecycle management options
 */
export type ServiceLifecycle = 'singleton' | 'transient' | 'scoped'

/**
 * Service token for type-safe service registration and resolution
 * Supports both concrete classes and interfaces
 */
export interface ServiceToken<T> {
  readonly name: string
  readonly type?: new (...args: unknown[]) => T
  readonly interfaceType?: string // For interface-based injection
}

/**
 * Factory function for creating service instances
 */
export interface ServiceFactory<T> {
  create(container: ServiceContainer): T
  dispose?(instance: T): Promise<void>
}

/**
 * Service registration configuration
 */
export interface ServiceRegistration<T> {
  token: ServiceToken<T>
  factory: ServiceFactory<T>
  lifecycle: ServiceLifecycle
  dependencies: ServiceToken<unknown>[]
}

/**
 * Service instance metadata
 */
export interface ServiceInstance<T> {
  instance: T
  created: Date
  disposed: boolean
  dependencies: ServiceInstance<unknown>[]
}

/**
 * Main service container interface
 */
export interface ServiceContainer {
  /**
   * Register a service with the container
   */
  register<T>(
    token: ServiceToken<T>,
    factory: ServiceFactory<T>,
    lifecycle?: ServiceLifecycle
  ): void

  /**
   * Resolve a service instance from the container
   */
  resolve<T>(token: ServiceToken<T>): T

  /**
   * Check if a service is registered
   */
  isRegistered<T>(token: ServiceToken<T>): boolean

  /**
   * Dispose all services and clean up resources
   */
  dispose(): Promise<void>

  /**
   * Get container statistics for monitoring
   */
  getStats(): ContainerStats

  /**
   * Register a service with the container using interface-based injection
   */
  registerInterface<T>(
    interfaceName: string,
    factory: ServiceFactory<T>,
    lifecycle?: ServiceLifecycle
  ): void

  /**
   * Resolve a service instance by interface name
   */
  resolveInterface<T>(interfaceName: string): T

  /**
   * Check if an interface is registered
   */
  isInterfaceRegistered(interfaceName: string): boolean

  /**
   * Register a mock implementation for testing
   */
  registerMock<T>(token: ServiceToken<T> | string, mockInstance: T): void

  /**
   * Clear all mock registrations
   */
  clearMocks(): void

  /**
   * Reset the container to initial state (for testing)
   */
  reset(): void
}

/**
 * Container statistics for monitoring and debugging
 */
export interface ContainerStats {
  totalRegistrations: number
  activeInstances: number
  disposedInstances: number
  circularDependencies: string[]
}

/**
 * Configuration for service container behavior
 */
export interface ServiceConfiguration {
  cacheDirectory: string
  environment: 'test' | 'development' | 'production'
  logLevel: 'debug' | 'info' | 'warn' | 'error'
}

/**
 * Configuration provider interface
 */
export interface ConfigurationProvider {
  getConfiguration(): ServiceConfiguration
  updateConfiguration(updates: Partial<ServiceConfiguration>): void
}

/**
 * Error types for service container operations
 */
export class ServiceContainerError extends Error {
  constructor(
    message: string,
    public readonly token?: ServiceToken<unknown>
  ) {
    super(message)
    this.name = 'ServiceContainerError'
  }
}

export class CircularDependencyError extends ServiceContainerError {
  constructor(dependencyChain: string[]) {
    super(`Circular dependency detected: ${dependencyChain.join(' -> ')}`)
    this.name = 'CircularDependencyError'
  }
}

export class ServiceNotFoundError extends ServiceContainerError {
  constructor(token: ServiceToken<unknown>) {
    super(`Service not found: ${token.name}`)
    this.name = 'ServiceNotFoundError'
  }
}
