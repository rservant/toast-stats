/**
 * Memory Integration Tests
 *
 * Verifies the integration of heap validation and memory monitoring
 * into the application startup and shutdown sequence.
 *
 * These tests verify ORDER OF OPERATIONS — not the individual module logic,
 * which is covered by unit tests in utils/__tests__/.
 *
 * Validates: Requirements 2.4, 4.1, 4.2, 4.3
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Registers all the non-core dependency mocks needed to import index.ts
 * without triggering real side effects.
 */
function mockAllDependencies() {
  vi.doMock('dotenv', () => ({ default: { config: vi.fn() } }))
  vi.doMock('cors', () => ({ default: vi.fn(() => vi.fn()) }))
  vi.doMock('../utils/logger.js', () => ({
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      requestLogger: vi.fn(() => vi.fn()),
    },
  }))
  vi.doMock('../routes/districts/index.js', () => ({ default: vi.fn() }))
  vi.doMock('../routes/admin/index.js', () => ({ default: vi.fn() }))
  vi.doMock('../services/ProductionServiceFactory.js', () => ({
    getProductionServiceFactory: vi.fn(() => ({
      createCacheConfigService: vi.fn(() => ({
        initialize: vi.fn(),
        getConfiguration: vi.fn(() => ({
          baseDirectory: '/tmp/test',
          source: 'test',
          isConfigured: true,
          validationStatus: {
            isValid: true,
            isAccessible: true,
            isSecure: true,
          },
        })),
        isReady: vi.fn(() => true),
      })),
      createRefreshService: vi.fn(),
    })),
  }))
  vi.doMock('../services/storage/StorageProviderFactory.js', () => ({
    StorageProviderFactory: {
      createFromEnvironment: vi.fn(() => ({
        districtConfigStorage: {},
        backfillJobStorage: {},
        snapshotStorage: {},
        timeSeriesIndexStorage: {},
      })),
    },
  }))
  vi.doMock('../services/backfill/unified/UnifiedBackfillService.js', () => ({
    UnifiedBackfillService: class {
      async initialize() {
        return { success: true, jobsRecovered: 0, jobsFailed: 0, errors: [] }
      }
    },
  }))
  vi.doMock('../services/DistrictConfigurationService.js', () => ({
    DistrictConfigurationService: class {},
  }))
  vi.doMock('../services/PreComputedAnalyticsService.js', () => ({
    PreComputedAnalyticsService: class {},
  }))
}

/**
 * Creates a mock express factory. The listen callback is NOT invoked
 * automatically — callers capture it via the returned ref.
 */
function mockExpress(opts: {
  callOrder?: string[]
  onListen?: (cb: () => Promise<void>) => void
  mockServerClose?: ReturnType<typeof vi.fn>
}) {
  const serverClose = opts.mockServerClose ?? vi.fn()
  const mockServer = { close: serverClose }

  return () => {
    const mockApp = {
      use: vi.fn(),
      get: vi.fn(),
      listen: vi.fn((_port: unknown, cb: () => Promise<void>) => {
        opts.callOrder?.push('server.listen')
        opts.onListen?.(cb)
        return mockServer
      }),
    }
    function expressFn() {
      return mockApp
    }
    expressFn.Router = vi.fn(() => ({
      get: vi.fn(),
      post: vi.fn(),
      delete: vi.fn(),
      use: vi.fn(),
    }))
    expressFn.json = vi.fn(() => vi.fn())
    return { default: expressFn }
  }
}

describe('Memory Integration - Startup and Shutdown Sequence', () => {
  // Typed as callable functions so the mock class can invoke them
  let startSpy: ReturnType<typeof vi.fn<(ms: number) => void>>
  let stopSpy: ReturnType<typeof vi.fn<() => void>>
  let callOrder: string[]

  beforeEach(() => {
    callOrder = []
    startSpy = vi.fn<(ms: number) => void>()
    stopSpy = vi.fn<() => void>()
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  /** Wire up the MemoryMonitor mock as a real class so `new` works. */
  function mockMemoryMonitor() {
    const startFn = startSpy
    const stopFn = stopSpy
    vi.doMock('../utils/memoryMonitor.js', () => {
      return {
        MemoryMonitor: class MockMemoryMonitor {
          start(ms: number) {
            startFn(ms)
          }
          stop() {
            stopFn()
          }
        },
      }
    })
  }

  function mockHeapValidator(opts?: { trackOrder?: boolean }) {
    vi.doMock('../utils/heapValidator.js', () => ({
      validateHeapConfiguration: vi.fn(() => {
        if (opts?.trackOrder) {
          callOrder.push('validateHeapConfiguration')
        }
        return {
          heapSizeLimitMB: 384,
          containerMemoryMB: 512,
          heapRatio: 0.75,
          isValid: true,
        }
      }),
    }))
  }

  /**
   * Validates: Requirement 2.4
   * THE Heap_Validator SHALL execute before the HTTP server starts listening
   */
  it('should run heap validation before server starts listening', async () => {
    mockHeapValidator({ trackOrder: true })
    mockMemoryMonitor()
    vi.doMock('express', mockExpress({ callOrder }))
    mockAllDependencies()

    await import('../index.js')

    const validateIndex = callOrder.indexOf('validateHeapConfiguration')
    const listenIndex = callOrder.indexOf('server.listen')

    expect(validateIndex).toBeGreaterThanOrEqual(0)
    expect(listenIndex).toBeGreaterThanOrEqual(0)
    expect(validateIndex).toBeLessThan(listenIndex)
  })

  /**
   * Validates: Requirements 3.1, 3.2
   * Memory monitor starts AFTER server initialization (inside listen callback)
   */
  it('should start memory monitor after server initialization', async () => {
    let listenCallback: (() => Promise<void>) | undefined

    mockHeapValidator()
    mockMemoryMonitor()
    vi.doMock(
      'express',
      mockExpress({
        onListen: cb => {
          listenCallback = cb
        },
      })
    )
    mockAllDependencies()

    await import('../index.js')

    // Before the listen callback fires, start should NOT have been called
    expect(startSpy).not.toHaveBeenCalled()

    // Fire the listen callback (simulates server ready)
    expect(listenCallback).toBeDefined()
    await listenCallback!()

    // Now start should have been called with 60000ms
    expect(startSpy).toHaveBeenCalledWith(60000)
  })

  /**
   * Validates: Requirements 4.1, 4.2, 4.3
   * SIGTERM handler stops the memory monitor before closing the server
   */
  it('should stop memory monitor on SIGTERM before closing server', async () => {
    let listenCallback: (() => Promise<void>) | undefined
    const signalHandlers = new Map<string, (() => void)[]>()
    const mockServerClose = vi.fn()

    mockHeapValidator()
    mockMemoryMonitor()
    vi.doMock(
      'express',
      mockExpress({
        onListen: cb => {
          listenCallback = cb
        },
        mockServerClose,
      })
    )
    mockAllDependencies()

    // Intercept process.on to capture signal handlers
    const originalProcessOn = process.on.bind(process)
    const processOnSpy = vi.spyOn(process, 'on').mockImplementation(((
      event: string | symbol,
      handler: (...args: unknown[]) => void
    ) => {
      const key = String(event)
      if (key === 'SIGTERM' || key === 'SIGINT') {
        const list = signalHandlers.get(key) ?? []
        list.push(handler as () => void)
        signalHandlers.set(key, list)
        return process
      }
      return originalProcessOn(event as string, handler)
    }) as NodeJS.Process['on'])
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => {}) as never)

    await import('../index.js')
    expect(listenCallback).toBeDefined()
    await listenCallback!()

    // Simulate SIGTERM
    const handlers = signalHandlers.get('SIGTERM') ?? []
    expect(handlers.length).toBeGreaterThan(0)
    handlers.forEach(h => h())

    // stop() must be called BEFORE server.close()
    expect(stopSpy).toHaveBeenCalled()
    expect(mockServerClose).toHaveBeenCalled()

    const stopOrder = stopSpy.mock.invocationCallOrder[0]
    const closeOrder = mockServerClose.mock.invocationCallOrder[0]
    expect(stopOrder).toBeDefined()
    expect(closeOrder).toBeDefined()
    expect(stopOrder!).toBeLessThan(closeOrder!)

    processOnSpy.mockRestore()
    exitSpy.mockRestore()
  })

  /**
   * Validates: Requirements 4.1, 4.2
   * SIGINT handler also stops the memory monitor before closing the server
   */
  it('should stop memory monitor on SIGINT before closing server', async () => {
    let listenCallback: (() => Promise<void>) | undefined
    const signalHandlers = new Map<string, (() => void)[]>()
    const mockServerClose = vi.fn()

    mockHeapValidator()
    mockMemoryMonitor()
    vi.doMock(
      'express',
      mockExpress({
        onListen: cb => {
          listenCallback = cb
        },
        mockServerClose,
      })
    )
    mockAllDependencies()

    const originalProcessOn = process.on.bind(process)
    const processOnSpy = vi.spyOn(process, 'on').mockImplementation(((
      event: string | symbol,
      handler: (...args: unknown[]) => void
    ) => {
      const key = String(event)
      if (key === 'SIGTERM' || key === 'SIGINT') {
        const list = signalHandlers.get(key) ?? []
        list.push(handler as () => void)
        signalHandlers.set(key, list)
        return process
      }
      return originalProcessOn(event as string, handler)
    }) as NodeJS.Process['on'])
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => {}) as never)

    await import('../index.js')
    expect(listenCallback).toBeDefined()
    await listenCallback!()

    // Simulate SIGINT
    const handlers = signalHandlers.get('SIGINT') ?? []
    expect(handlers.length).toBeGreaterThan(0)
    handlers.forEach(h => h())

    expect(stopSpy).toHaveBeenCalled()
    expect(mockServerClose).toHaveBeenCalled()

    const stopOrder = stopSpy.mock.invocationCallOrder[0]
    const closeOrder = mockServerClose.mock.invocationCallOrder[0]
    expect(stopOrder).toBeDefined()
    expect(closeOrder).toBeDefined()
    expect(stopOrder!).toBeLessThan(closeOrder!)

    processOnSpy.mockRestore()
    exitSpy.mockRestore()
  })
})
