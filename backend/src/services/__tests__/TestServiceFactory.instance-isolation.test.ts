/**
 * Unit Tests for TestServiceFactory Instance Isolation
 *
 * Converted from property-based test: TestServiceFactory.instance-isolation.property.test.ts
 * Rationale: PBT not warranted per testing.md — tests verify container isolation
 * and configuration provider independence with randomized counts (2-5) and path
 * strings. The API under test has a fixed set of operations (createTestContainer,
 * createTestConfiguration, cleanup, reset). No complex input space or mathematical
 * invariants — easily covered by 5 explicit examples.
 *
 * Validates: Requirements 1.3
 */

import { describe, it, expect, afterEach } from 'vitest'
import {
  DefaultTestServiceFactory,
  TestConfigurationProvider,
  getTestServiceFactory,
  resetTestServiceFactory,
} from '../TestServiceFactory.js'
import { createTestSelfCleanup } from '../../utils/test-self-cleanup.js'

describe('TestServiceFactory - Instance Isolation', () => {
  const { afterEach: performCleanup } = createTestSelfCleanup({
    verbose: false,
  })

  afterEach(async () => {
    await resetTestServiceFactory()
    await performCleanup()
  })

  it('should create isolated service containers that do not interfere with each other', async () => {
    const factory = new DefaultTestServiceFactory()
    const config = {
      cacheDirectory: '/tmp/test-isolation-1',
      environment: 'test' as const,
      logLevel: 'error' as const,
    }

    try {
      const container1 = factory.createTestContainer()
      const container2 = factory.createTestContainer()
      const container3 = factory.createTestContainer()

      // Containers should be distinct instances
      expect(container1).not.toBe(container2)
      expect(container2).not.toBe(container3)
      expect(container1).not.toBe(container3)

      // All should have standard DI methods
      for (const c of [container1, container2, container3]) {
        expect(typeof (c as { register: unknown }).register).toBe('function')
        expect(typeof (c as { resolve: unknown }).resolve).toBe('function')
        expect(typeof (c as { dispose: unknown }).dispose).toBe('function')
      }

      // Configuration providers should be independent
      const config1 = factory.createTestConfiguration(config)
      const config2 = factory.createTestConfiguration({
        ...config,
        cacheDirectory: '/tmp/test-isolation-2',
      })

      expect(config1).not.toBe(config2)
      expect(config1.getConfiguration().cacheDirectory).toBe(
        '/tmp/test-isolation-1'
      )
      expect(config2.getConfiguration().cacheDirectory).toBe(
        '/tmp/test-isolation-2'
      )
    } finally {
      await factory.cleanup()
    }
  })

  it('should provide independent configuration providers where modification does not cross-contaminate', async () => {
    const baseConfig = {
      cacheDirectory: '/tmp/base-config',
      environment: 'test' as const,
      logLevel: 'error' as const,
    }

    const provider1 = new TestConfigurationProvider(baseConfig)
    const provider2 = new TestConfigurationProvider(baseConfig)
    const provider3 = new TestConfigurationProvider(baseConfig)

    // All start with the same base config
    expect(provider1.getConfiguration().cacheDirectory).toBe('/tmp/base-config')
    expect(provider2.getConfiguration().cacheDirectory).toBe('/tmp/base-config')
    expect(provider3.getConfiguration().cacheDirectory).toBe('/tmp/base-config')

    // Modifying provider1 should not affect provider2 or provider3
    provider1.updateConfiguration({ cacheDirectory: '/tmp/modified-1' })
    expect(provider1.getConfiguration().cacheDirectory).toBe('/tmp/modified-1')
    expect(provider2.getConfiguration().cacheDirectory).toBe('/tmp/base-config')
    expect(provider3.getConfiguration().cacheDirectory).toBe('/tmp/base-config')

    // Modifying provider2 should not affect provider1 or provider3
    provider2.updateConfiguration({
      cacheDirectory: '/tmp/modified-2',
      logLevel: 'warn',
    })
    expect(provider2.getConfiguration().cacheDirectory).toBe('/tmp/modified-2')
    expect(provider2.getConfiguration().logLevel).toBe('warn')
    expect(provider1.getConfiguration().cacheDirectory).toBe('/tmp/modified-1')
    expect(provider3.getConfiguration().logLevel).toBe('error')
  })

  it('should support proper cleanup and disposal of all created instances', async () => {
    const factory = new DefaultTestServiceFactory()
    const config = {
      cacheDirectory: '/tmp/cleanup-test',
      environment: 'test' as const,
      logLevel: 'error' as const,
    }

    const containers = []
    const configProviders = []

    for (let i = 0; i < 3; i++) {
      containers.push(factory.createTestContainer())
      configProviders.push(factory.createTestConfiguration(config))
    }

    // All should be functional
    for (const c of containers) {
      expect(typeof (c as { dispose: unknown }).dispose).toBe('function')
    }
    for (const p of configProviders) {
      expect(p.getConfiguration().cacheDirectory).toBe('/tmp/cleanup-test')
    }

    // Cleanup should not throw
    await expect(factory.cleanup()).resolves.not.toThrow()
  })

  it('should support global factory reset without affecting other instances', async () => {
    const config = {
      cacheDirectory: '/tmp/reset-test',
      environment: 'test' as const,
      logLevel: 'info' as const,
    }

    const factory1 = getTestServiceFactory()
    const container1 = factory1.createTestContainer()
    expect(container1).toBeDefined()

    // Reset should not throw
    await expect(resetTestServiceFactory()).resolves.not.toThrow()

    // New factory instance should be independent
    const factory2 = getTestServiceFactory()
    expect(factory2).toBeDefined()

    const container2 = factory2.createTestContainer()
    const configProvider2 = factory2.createTestConfiguration(config)

    expect(container2).toBeDefined()
    expect(configProvider2.getConfiguration().cacheDirectory).toBe(
      '/tmp/reset-test'
    )

    await resetTestServiceFactory()
  })
})
