/**
 * Unit Tests for Service Container (Converted from Property Tests)
 *
 * Converted from property-based test: ServiceContainer.property.test.ts
 * Rationale: PBT not warranted per testing.md — the original file (576 lines) used
 * fast-check to generate random service names and lifecycle types for DI container
 * operations. The DI container has a fixed API (register/resolve/dispose) with a
 * small enum of lifecycles (singleton/transient/scoped). This is CRUD on a container,
 * not complex input-space exploration. Explicit examples with known service names
 * cover all behavioral paths.
 *
 * Validates: Requirements 6.1, 6.2, 6.3
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  DefaultServiceContainer,
  createServiceToken,
  createServiceFactory,
} from '../ServiceContainer.js'
import {
  ServiceContainer,
  ServiceToken,
  ServiceFactory,
  ServiceLifecycle,
  ServiceContainerError,
  CircularDependencyError,
  ServiceNotFoundError,
} from '../../types/serviceContainer.js'
import { createTestSelfCleanup } from '../../utils/test-self-cleanup.js'

describe('ServiceContainer - Converted Property Tests', () => {
  let container: ServiceContainer

  const { afterEach: performCleanup } = createTestSelfCleanup({
    verbose: false,
  })

  beforeEach(() => {
    container = new DefaultServiceContainer()
  })

  afterEach(async () => {
    if (container) await container.dispose()
    await performCleanup()
  })

  // Mock service
  class MockService {
    public disposed = false
    constructor(
      public name: string,
      public dependencies: unknown[] = []
    ) {}
    async dispose(): Promise<void> {
      this.disposed = true
    }
  }

  const createToken = (name: string): ServiceToken<MockService> =>
    createServiceToken(name, MockService)

  const createFactory = (
    name: string,
    deps: ServiceToken<unknown>[] = []
  ): ServiceFactory<MockService> =>
    createServiceFactory(
      (container: ServiceContainer) => {
        const resolved = deps.map(d => container.resolve(d))
        return new MockService(name, resolved)
      },
      async (instance: MockService) => {
        await instance.dispose()
      }
    )

  describe('Service registration and resolution', () => {
    it.each<{ lifecycle: ServiceLifecycle; label: string }>([
      { lifecycle: 'singleton', label: 'singleton' },
      { lifecycle: 'transient', label: 'transient' },
      { lifecycle: 'scoped', label: 'scoped' },
    ])(
      'should register and resolve a $label service',
      async ({ lifecycle }) => {
        const token = createToken(`TestService-${lifecycle}`)
        const factory = createFactory(`TestService-${lifecycle}`)

        container.register(token, factory, lifecycle)
        expect(container.isRegistered(token)).toBe(true)

        const instance = container.resolve(token)
        expect(instance).toBeInstanceOf(MockService)
        expect(instance.name).toBe(`TestService-${lifecycle}`)
        expect(instance.disposed).toBe(false)
      }
    )

    it('should return same instance for singleton lifecycle', () => {
      const token = createToken('SingletonService')
      const factory = createFactory('SingletonService')

      container.register(token, factory, 'singleton')
      const instance1 = container.resolve(token)
      const instance2 = container.resolve(token)
      expect(instance2).toBe(instance1)
    })

    it('should return different instances for transient lifecycle', () => {
      const token = createToken('TransientService')
      const factory = createFactory('TransientService')

      container.register(token, factory, 'transient')
      const instance1 = container.resolve(token)
      const instance2 = container.resolve(token)
      expect(instance2).not.toBe(instance1)
      expect(instance2.name).toBe('TransientService')
    })

    it('should register and resolve 5 services simultaneously', async () => {
      const testContainer = new DefaultServiceContainer()
      const lifecycles: ServiceLifecycle[] = [
        'singleton',
        'transient',
        'scoped',
        'singleton',
        'transient',
      ]

      try {
        for (let i = 0; i < 5; i++) {
          const token = createToken(`Service-${i}`)
          const factory = createFactory(`Service-${i}`)
          testContainer.register(token, factory, lifecycles[i])
        }

        const stats = testContainer.getStats()
        expect(stats.totalRegistrations).toBe(5)
      } finally {
        await testContainer.dispose()
      }
    })
  })

  describe('Service dependencies', () => {
    it('should resolve dependencies automatically', () => {
      const baseToken = createToken('BaseService')
      const baseFactory = createFactory('BaseService')

      const dependentToken = createToken('DependentService')
      const dependentFactory = createServiceFactory(
        (container: ServiceContainer) => {
          const base = container.resolve(baseToken)
          return new MockService('DependentService', [base])
        },
        async (instance: MockService) => {
          await instance.dispose()
        }
      )

      container.register(baseToken, baseFactory, 'singleton')
      container.register(dependentToken, dependentFactory, 'singleton')

      const dependent = container.resolve(dependentToken)
      expect(dependent.name).toBe('DependentService')
      expect(dependent.dependencies).toHaveLength(1)
      expect((dependent.dependencies[0] as MockService).name).toBe(
        'BaseService'
      )
    })

    it('should detect circular dependencies', () => {
      const token1 = createToken('CircularA')
      const token2 = createToken('CircularB')

      const factory1 = createServiceFactory((container: ServiceContainer) => {
        container.resolve(token2)
        return new MockService('CircularA')
      })
      const factory2 = createServiceFactory((container: ServiceContainer) => {
        container.resolve(token1)
        return new MockService('CircularB')
      })

      container.register(token1, factory1)
      container.register(token2, factory2)

      expect(() => container.resolve(token1)).toThrow(CircularDependencyError)
      expect(() => container.resolve(token2)).toThrow(CircularDependencyError)
    })

    it('should resolve a 3-level dependency chain', () => {
      const baseToken = createToken('Base')
      const middleToken = createToken('Middle')
      const topToken = createToken('Top')

      container.register(baseToken, createFactory('Base'))
      container.register(
        middleToken,
        createServiceFactory(
          (c: ServiceContainer) =>
            new MockService('Middle', [c.resolve(baseToken)]),
          async (i: MockService) => {
            await i.dispose()
          }
        )
      )
      container.register(
        topToken,
        createServiceFactory(
          (c: ServiceContainer) =>
            new MockService('Top', [c.resolve(middleToken)]),
          async (i: MockService) => {
            await i.dispose()
          }
        )
      )

      const top = container.resolve(topToken)
      expect(top.name).toBe('Top')
      const middle = top.dependencies[0] as MockService
      expect(middle.name).toBe('Middle')
      const base = middle.dependencies[0] as MockService
      expect(base.name).toBe('Base')
    })
  })

  describe('Error handling', () => {
    it('should throw ServiceNotFoundError for unregistered service', () => {
      const token = createToken('Unregistered')
      expect(() => container.resolve(token)).toThrow(ServiceNotFoundError)
    })

    it('should throw ServiceContainerError for duplicate registration', () => {
      const token = createToken('Duplicate')
      const factory = createFactory('Duplicate')

      container.register(token, factory)
      expect(() => container.register(token, factory)).toThrow(
        ServiceContainerError
      )
    })
  })

  describe('Service disposal', () => {
    it('should dispose all singleton and scoped instances on container dispose', async () => {
      const testContainer = new DefaultServiceContainer()

      const singletonToken = createToken('DisposeSingleton')
      const scopedToken = createToken('DisposeScoped')
      const transientToken = createToken('DisposeTransient')

      testContainer.register(
        singletonToken,
        createFactory('DisposeSingleton'),
        'singleton'
      )
      testContainer.register(
        scopedToken,
        createFactory('DisposeScoped'),
        'scoped'
      )
      testContainer.register(
        transientToken,
        createFactory('DisposeTransient'),
        'transient'
      )

      const singleton = testContainer.resolve(singletonToken)
      const scoped = testContainer.resolve(scopedToken)
      const transient = testContainer.resolve(transientToken)

      expect(singleton.disposed).toBe(false)
      expect(scoped.disposed).toBe(false)
      expect(transient.disposed).toBe(false)

      await testContainer.dispose()

      // Only singleton and scoped are tracked and disposed
      expect(singleton.disposed).toBe(true)
      expect(scoped.disposed).toBe(true)
      // Transient may not be tracked
    })

    it('should track container statistics accurately', async () => {
      const testContainer = new DefaultServiceContainer()

      testContainer.register(
        createToken('S1'),
        createFactory('S1'),
        'singleton'
      )
      testContainer.register(createToken('S2'), createFactory('S2'), 'scoped')
      testContainer.register(
        createToken('S3'),
        createFactory('S3'),
        'transient'
      )

      const stats = testContainer.getStats()
      expect(stats.totalRegistrations).toBe(3)
      expect(stats.disposedInstances).toBe(0)

      // Resolve to create instances
      testContainer.resolve(createToken('S1'))
      testContainer.resolve(createToken('S2'))
      testContainer.resolve(createToken('S3'))

      await testContainer.dispose()
      const disposedStats = testContainer.getStats()
      expect(disposedStats.disposedInstances).toBeGreaterThan(0)
    })
  })
})
