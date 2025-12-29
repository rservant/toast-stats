/**
 * Service Container Implementation
 *
 * Core dependency injection container that manages service lifecycle,
 * resolves dependencies, and provides proper cleanup for test isolation.
 */

import {
  ServiceContainer,
  ServiceToken,
  ServiceFactory,
  ServiceRegistration,
  ServiceInstance,
  ServiceLifecycle,
  ContainerStats,
  ServiceContainerError,
  CircularDependencyError,
  ServiceNotFoundError,
} from '../types/serviceContainer.js'

export class DefaultServiceContainer implements ServiceContainer {
  private registrations = new Map<string, ServiceRegistration<any>>()
  private instances = new Map<string, ServiceInstance<any>>()
  private interfaceRegistrations = new Map<string, ServiceRegistration<any>>()
  private interfaceInstances = new Map<string, ServiceInstance<any>>()
  private mockRegistrations = new Map<string, any>()
  private resolutionStack: string[] = []
  private disposedCount = 0

  /**
   * Register a service with the container
   */
  register<T>(
    token: ServiceToken<T>,
    factory: ServiceFactory<T>,
    lifecycle: ServiceLifecycle = 'singleton'
  ): void {
    if (this.registrations.has(token.name)) {
      throw new ServiceContainerError(
        `Service already registered: ${token.name}`,
        token
      )
    }

    const registration: ServiceRegistration<T> = {
      token,
      factory,
      lifecycle,
      dependencies: [],
    }

    this.registrations.set(token.name, registration)
  }

  /**
   * Resolve a service instance from the container
   */
  resolve<T>(token: ServiceToken<T>): T {
    // Check for mock first
    if (this.mockRegistrations.has(token.name)) {
      return this.mockRegistrations.get(token.name)
    }

    // Check for circular dependencies
    if (this.resolutionStack.includes(token.name)) {
      const cycle = [...this.resolutionStack, token.name]
      throw new CircularDependencyError(cycle)
    }

    // Check if service is registered
    const registration = this.registrations.get(token.name)
    if (!registration) {
      throw new ServiceNotFoundError(token)
    }

    // For singleton lifecycle, return existing instance if available
    if (registration.lifecycle === 'singleton') {
      const existingInstance = this.instances.get(token.name)
      if (existingInstance && !existingInstance.disposed) {
        return existingInstance.instance
      }
    }

    // For scoped lifecycle, return existing instance if available
    if (registration.lifecycle === 'scoped') {
      const existingInstance = this.instances.get(token.name)
      if (existingInstance && !existingInstance.disposed) {
        return existingInstance.instance
      }
    }

    // Create new instance
    this.resolutionStack.push(token.name)

    try {
      const instance = registration.factory.create(this)

      const serviceInstance: ServiceInstance<T> = {
        instance,
        created: new Date(),
        disposed: false,
        dependencies: [],
      }

      // Store instance for singleton and scoped lifecycles
      if (
        registration.lifecycle === 'singleton' ||
        registration.lifecycle === 'scoped'
      ) {
        this.instances.set(token.name, serviceInstance)
      }

      return instance
    } finally {
      this.resolutionStack.pop()
    }
  }

  /**
   * Check if a service is registered
   */
  isRegistered<T>(token: ServiceToken<T>): boolean {
    return this.registrations.has(token.name)
  }

  /**
   * Dispose all services and clean up resources
   */
  async dispose(): Promise<void> {
    const disposePromises: Promise<void>[] = []

    // Dispose all regular instances in reverse order of creation
    const instanceEntries = Array.from(this.instances.entries())
    instanceEntries.reverse()

    for (const [tokenName, serviceInstance] of instanceEntries) {
      if (!serviceInstance.disposed) {
        const registration = this.registrations.get(tokenName)
        if (registration?.factory.dispose) {
          disposePromises.push(
            registration.factory
              .dispose(serviceInstance.instance)
              .then(() => {
                serviceInstance.disposed = true
                this.disposedCount++
              })
              .catch(error => {
                console.error(`Error disposing service ${tokenName}:`, error)
                // Still mark as disposed even if disposal failed
                serviceInstance.disposed = true
                this.disposedCount++
              })
          )
        } else {
          serviceInstance.disposed = true
          this.disposedCount++
        }
      }
    }

    // Dispose all interface instances in reverse order of creation
    const interfaceInstanceEntries = Array.from(
      this.interfaceInstances.entries()
    )
    interfaceInstanceEntries.reverse()

    for (const [interfaceName, serviceInstance] of interfaceInstanceEntries) {
      if (!serviceInstance.disposed) {
        const registration = this.interfaceRegistrations.get(interfaceName)
        if (registration?.factory.dispose) {
          disposePromises.push(
            registration.factory
              .dispose(serviceInstance.instance)
              .then(() => {
                serviceInstance.disposed = true
                this.disposedCount++
              })
              .catch(error => {
                console.error(
                  `Error disposing interface service ${interfaceName}:`,
                  error
                )
                // Still mark as disposed even if disposal failed
                serviceInstance.disposed = true
                this.disposedCount++
              })
          )
        } else {
          serviceInstance.disposed = true
          this.disposedCount++
        }
      }
    }

    await Promise.all(disposePromises)

    // Don't clear registrations and instances immediately - keep them for stats
    // Only clear the resolution stack
    this.resolutionStack = []
  }

  /**
   * Get container statistics for monitoring
   */
  getStats(): ContainerStats {
    const activeInstances = Array.from(this.instances.values()).filter(
      instance => !instance.disposed
    ).length

    const activeInterfaceInstances = Array.from(
      this.interfaceInstances.values()
    ).filter(instance => !instance.disposed).length

    return {
      totalRegistrations:
        this.registrations.size + this.interfaceRegistrations.size,
      activeInstances: activeInstances + activeInterfaceInstances,
      disposedInstances: this.disposedCount,
      circularDependencies: [], // Would be populated during resolution attempts
    }
  }

  /**
   * Register a service with the container using interface-based injection
   */
  registerInterface<T>(
    interfaceName: string,
    factory: ServiceFactory<T>,
    lifecycle: ServiceLifecycle = 'singleton'
  ): void {
    if (this.interfaceRegistrations.has(interfaceName)) {
      throw new ServiceContainerError(
        `Interface already registered: ${interfaceName}`
      )
    }

    const registration: ServiceRegistration<T> = {
      token: { name: interfaceName, interfaceType: interfaceName },
      factory,
      lifecycle,
      dependencies: [],
    }

    this.interfaceRegistrations.set(interfaceName, registration)
  }

  /**
   * Resolve a service instance by interface name
   */
  resolveInterface<T>(interfaceName: string): T {
    // Check for mock first
    if (this.mockRegistrations.has(interfaceName)) {
      return this.mockRegistrations.get(interfaceName)
    }

    // Check for circular dependencies
    if (this.resolutionStack.includes(interfaceName)) {
      const cycle = [...this.resolutionStack, interfaceName]
      throw new CircularDependencyError(cycle)
    }

    // Check if interface is registered
    const registration = this.interfaceRegistrations.get(interfaceName)
    if (!registration) {
      throw new ServiceContainerError(`Interface not found: ${interfaceName}`)
    }

    // For singleton lifecycle, return existing instance if available
    if (registration.lifecycle === 'singleton') {
      const existingInstance = this.interfaceInstances.get(interfaceName)
      if (existingInstance && !existingInstance.disposed) {
        return existingInstance.instance
      }
    }

    // For scoped lifecycle, return existing instance if available
    if (registration.lifecycle === 'scoped') {
      const existingInstance = this.interfaceInstances.get(interfaceName)
      if (existingInstance && !existingInstance.disposed) {
        return existingInstance.instance
      }
    }

    // Create new instance
    this.resolutionStack.push(interfaceName)

    try {
      const instance = registration.factory.create(this)

      const serviceInstance: ServiceInstance<T> = {
        instance,
        created: new Date(),
        disposed: false,
        dependencies: [],
      }

      // Store instance for singleton and scoped lifecycles
      if (
        registration.lifecycle === 'singleton' ||
        registration.lifecycle === 'scoped'
      ) {
        this.interfaceInstances.set(interfaceName, serviceInstance)
      }

      return instance
    } finally {
      this.resolutionStack.pop()
    }
  }

  /**
   * Check if an interface is registered
   */
  isInterfaceRegistered(interfaceName: string): boolean {
    return (
      this.interfaceRegistrations.has(interfaceName) ||
      this.mockRegistrations.has(interfaceName)
    )
  }

  /**
   * Register a mock implementation for testing
   */
  registerMock<T>(token: ServiceToken<T> | string, mockInstance: T): void {
    const key = typeof token === 'string' ? token : token.name
    this.mockRegistrations.set(key, mockInstance)
  }

  /**
   * Clear all mock registrations
   */
  clearMocks(): void {
    this.mockRegistrations.clear()
  }

  /**
   * Reset the container to initial state (for testing)
   */
  reset(): void {
    this.instances.clear()
    this.registrations.clear()
    this.interfaceInstances.clear()
    this.interfaceRegistrations.clear()
    this.mockRegistrations.clear()
    this.resolutionStack = []
    this.disposedCount = 0
  }
}

/**
 * Utility function to create service tokens
 */
export function createServiceToken<T>(
  name: string,
  type: new (...args: any[]) => T
): ServiceToken<T> {
  return {
    name,
    type,
  }
}

/**
 * Utility function to create interface-based service tokens
 */
export function createInterfaceToken<T>(
  interfaceName: string
): ServiceToken<T> {
  return {
    name: interfaceName,
    interfaceType: interfaceName,
  }
}

/**
 * Utility function to create simple service factories
 */
export function createServiceFactory<T>(
  createFn: (container: ServiceContainer) => T,
  disposeFn?: (instance: T) => Promise<void>
): ServiceFactory<T> {
  return {
    create: createFn,
    dispose: disposeFn,
  }
}
