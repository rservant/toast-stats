import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the logger to verify log calls
vi.mock('../logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

import { logger } from '../logger.js'
import { MemoryMonitor } from '../memoryMonitor.js'

const BYTES_PER_MB = 1024 * 1024

describe('MemoryMonitor', () => {
  let monitor: MemoryMonitor

  beforeEach(() => {
    monitor = new MemoryMonitor()
    vi.useFakeTimers()
    vi.mocked(logger.info).mockClear()
    vi.mocked(logger.warn).mockClear()
    vi.mocked(logger.error).mockClear()
    vi.mocked(logger.debug).mockClear()
  })

  afterEach(() => {
    monitor.stop()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('collectMetrics', () => {
    it('should return metrics with correct structure', () => {
      const metrics = monitor.collectMetrics()

      expect(metrics).toHaveProperty('heapUsedMB')
      expect(metrics).toHaveProperty('heapTotalMB')
      expect(metrics).toHaveProperty('rssMB')
      expect(metrics).toHaveProperty('externalMB')
      expect(metrics).toHaveProperty('arrayBuffersMB')
      expect(metrics).toHaveProperty('timestamp')
      expect(typeof metrics.heapUsedMB).toBe('number')
      expect(typeof metrics.timestamp).toBe('string')
    })

    it('should convert bytes to megabytes correctly — 0 bytes → 0 MB', () => {
      const memUsageSpy = vi.spyOn(process, 'memoryUsage').mockReturnValue({
        rss: 0,
        heapTotal: 0,
        heapUsed: 0,
        external: 0,
        arrayBuffers: 0,
      })

      const metrics = monitor.collectMetrics()

      expect(metrics.heapUsedMB).toBe(0)
      expect(metrics.heapTotalMB).toBe(0)
      expect(metrics.rssMB).toBe(0)
      expect(metrics.externalMB).toBe(0)
      expect(metrics.arrayBuffersMB).toBe(0)

      memUsageSpy.mockRestore()
    })

    it('should convert bytes to megabytes correctly — 1048576 bytes → 1 MB', () => {
      const memUsageSpy = vi.spyOn(process, 'memoryUsage').mockReturnValue({
        rss: BYTES_PER_MB,
        heapTotal: BYTES_PER_MB,
        heapUsed: BYTES_PER_MB,
        external: BYTES_PER_MB,
        arrayBuffers: BYTES_PER_MB,
      })

      const metrics = monitor.collectMetrics()

      expect(metrics.heapUsedMB).toBe(1)
      expect(metrics.heapTotalMB).toBe(1)
      expect(metrics.rssMB).toBe(1)
      expect(metrics.externalMB).toBe(1)
      expect(metrics.arrayBuffersMB).toBe(1)

      memUsageSpy.mockRestore()
    })

    it('should convert bytes to megabytes correctly — 402653184 bytes → 384 MB', () => {
      const bytes384MB = 384 * BYTES_PER_MB
      const memUsageSpy = vi.spyOn(process, 'memoryUsage').mockReturnValue({
        rss: bytes384MB,
        heapTotal: bytes384MB,
        heapUsed: bytes384MB,
        external: bytes384MB,
        arrayBuffers: bytes384MB,
      })

      const metrics = monitor.collectMetrics()

      expect(metrics.heapUsedMB).toBe(384)
      expect(metrics.rssMB).toBe(384)

      memUsageSpy.mockRestore()
    })
  })

  describe('logMetrics', () => {
    it('should log metrics with correct structure via logger.info', () => {
      monitor.logMetrics()

      expect(logger.info).toHaveBeenCalledWith(
        'Memory metrics',
        expect.objectContaining({
          component: 'MemoryMonitor',
          heapUsedMB: expect.any(Number),
          heapTotalMB: expect.any(Number),
          rssMB: expect.any(Number),
          externalMB: expect.any(Number),
          arrayBuffersMB: expect.any(Number),
          timestamp: expect.any(String),
        })
      )
    })

    it('should handle process.memoryUsage() failure gracefully', () => {
      const memUsageSpy = vi
        .spyOn(process, 'memoryUsage')
        .mockImplementation(() => {
          throw new Error('memoryUsage unavailable')
        })

      monitor.logMetrics()

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to collect memory metrics',
        expect.objectContaining({
          component: 'MemoryMonitor',
          error: 'memoryUsage unavailable',
        })
      )

      memUsageSpy.mockRestore()
    })
  })

  describe('start/stop lifecycle', () => {
    it('should create interval on start', () => {
      expect(monitor.isRunning()).toBe(false)

      monitor.start(60000)

      expect(monitor.isRunning()).toBe(true)
    })

    it('should log metrics immediately on start', () => {
      monitor.start(60000)

      // First call is the immediate logMetrics, second is the "started" log
      expect(logger.info).toHaveBeenCalledWith(
        'Memory metrics',
        expect.objectContaining({ component: 'MemoryMonitor' })
      )
    })

    it('should log metrics periodically after start', () => {
      monitor.start(60000)

      // Clear the initial calls
      vi.mocked(logger.info).mockClear()

      // Advance by one interval
      vi.advanceTimersByTime(60000)

      expect(logger.info).toHaveBeenCalledWith(
        'Memory metrics',
        expect.objectContaining({ component: 'MemoryMonitor' })
      )
    })

    it('should clear interval on stop', () => {
      monitor.start(60000)
      expect(monitor.isRunning()).toBe(true)

      monitor.stop()
      expect(monitor.isRunning()).toBe(false)

      // Verify the "stopped" log
      expect(logger.info).toHaveBeenCalledWith(
        'Memory monitor stopped',
        expect.objectContaining({ component: 'MemoryMonitor' })
      )
    })

    it('should be idempotent — calling stop twice does not throw', () => {
      monitor.start(60000)
      monitor.stop()
      monitor.stop() // second call should be a no-op

      // "stopped" log should only appear once
      const stopCalls = vi
        .mocked(logger.info)
        .mock.calls.filter(call => call[0] === 'Memory monitor stopped')
      expect(stopCalls).toHaveLength(1)
    })

    it('should be a no-op if start is called while already running', () => {
      monitor.start(60000)
      vi.mocked(logger.info).mockClear()
      vi.mocked(logger.debug).mockClear()

      monitor.start(60000) // second call — should no-op

      expect(logger.debug).toHaveBeenCalledWith(
        'Memory monitor already running',
        expect.objectContaining({ component: 'MemoryMonitor' })
      )
    })

    it('should not log metrics after stop', () => {
      monitor.start(60000)
      monitor.stop()

      vi.mocked(logger.info).mockClear()
      vi.advanceTimersByTime(120000)

      // No "Memory metrics" calls after stop
      const metricsCalls = vi
        .mocked(logger.info)
        .mock.calls.filter(call => call[0] === 'Memory metrics')
      expect(metricsCalls).toHaveLength(0)
    })
  })
})
