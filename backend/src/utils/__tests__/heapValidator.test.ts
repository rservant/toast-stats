import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { HeapStatistics } from 'node:v8'

// Mock v8 module before importing the module under test
vi.mock('node:v8', () => ({
  default: {
    getHeapStatistics: vi.fn(),
  },
}))

// Mock the logger to verify log calls
vi.mock('../logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

import v8 from 'node:v8'
import { logger } from '../logger.js'
import { validateHeapConfiguration } from '../heapValidator.js'

const BYTES_PER_MB = 1024 * 1024

function mockHeapSizeLimit(limitMB: number): void {
  vi.mocked(v8.getHeapStatistics).mockReturnValue({
    heap_size_limit: limitMB * BYTES_PER_MB,
    total_heap_size: 0,
    total_heap_size_executable: 0,
    total_physical_size: 0,
    total_available_size: 0,
    used_heap_size: 0,
    malloced_memory: 0,
    peak_malloced_memory: 0,
    does_zap_garbage: 0,
    number_of_native_contexts: 0,
    number_of_detached_contexts: 0,
    total_global_handles_size: 0,
    used_global_handles_size: 0,
    external_memory: 0,
  } satisfies HeapStatistics)
}

describe('HeapValidator', () => {
  let originalContainerMemory: string | undefined

  beforeEach(() => {
    originalContainerMemory = process.env['CONTAINER_MEMORY_MB']
    delete process.env['CONTAINER_MEMORY_MB']
    vi.mocked(logger.info).mockClear()
    vi.mocked(logger.warn).mockClear()
    vi.mocked(logger.error).mockClear()
  })

  afterEach(() => {
    if (originalContainerMemory !== undefined) {
      process.env['CONTAINER_MEMORY_MB'] = originalContainerMemory
    } else {
      delete process.env['CONTAINER_MEMORY_MB']
    }
  })

  describe('warning when heap > 85% of container', () => {
    it('should log warning when heap is 440MB of 512MB container (86%)', () => {
      mockHeapSizeLimit(440)

      const result = validateHeapConfiguration()

      expect(result.isValid).toBe(false)
      expect(result.heapRatio).toBeCloseTo(440 / 512, 5)
      expect(result.warning).toBeDefined()
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('exceeds 85%'),
        expect.objectContaining({ component: 'HeapValidator' })
      )
    })
  })

  describe('no warning when heap ≤ 85% of container', () => {
    it('should not warn when heap is 384MB of 512MB container (75%)', () => {
      mockHeapSizeLimit(384)

      const result = validateHeapConfiguration()

      expect(result.isValid).toBe(true)
      expect(result.warning).toBeUndefined()
      expect(logger.warn).not.toHaveBeenCalled()
      expect(logger.info).toHaveBeenCalledWith(
        'V8 heap configuration',
        expect.objectContaining({
          component: 'HeapValidator',
          containerMemoryMB: 512,
        })
      )
    })
  })

  describe('boundary condition at exactly 85%', () => {
    it('should not warn at exactly 85% (435.2MB of 512MB)', () => {
      // 512 * 0.85 = 435.2 — exactly at the threshold
      mockHeapSizeLimit(435.2)

      const result = validateHeapConfiguration()

      expect(result.isValid).toBe(true)
      expect(result.heapRatio).toBeCloseTo(0.85, 5)
      expect(result.warning).toBeUndefined()
      expect(logger.warn).not.toHaveBeenCalled()
    })

    it('should warn just above 85% (435.3MB of 512MB)', () => {
      mockHeapSizeLimit(435.3)

      const result = validateHeapConfiguration()

      expect(result.isValid).toBe(false)
      expect(result.heapRatio).toBeGreaterThan(0.85)
      expect(result.warning).toBeDefined()
      expect(logger.warn).toHaveBeenCalled()
    })
  })

  describe('default container memory when env var not set', () => {
    it('should use 512MB as default container memory', () => {
      delete process.env['CONTAINER_MEMORY_MB']
      mockHeapSizeLimit(384)

      const result = validateHeapConfiguration()

      expect(result.containerMemoryMB).toBe(512)
    })
  })

  describe('custom container memory from CONTAINER_MEMORY_MB', () => {
    it('should use custom container memory from env var', () => {
      process.env['CONTAINER_MEMORY_MB'] = '1024'
      mockHeapSizeLimit(384)

      const result = validateHeapConfiguration()

      expect(result.containerMemoryMB).toBe(1024)
      expect(result.heapRatio).toBeCloseTo(384 / 1024, 5)
      expect(result.isValid).toBe(true)
    })

    it('should fall back to default for invalid env var', () => {
      process.env['CONTAINER_MEMORY_MB'] = 'not-a-number'
      mockHeapSizeLimit(384)

      const result = validateHeapConfiguration()

      expect(result.containerMemoryMB).toBe(512)
      expect(logger.warn).toHaveBeenCalledWith(
        'Invalid CONTAINER_MEMORY_MB value, using default',
        expect.objectContaining({ envValue: 'not-a-number' })
      )
    })

    it('should fall back to default for negative env var', () => {
      process.env['CONTAINER_MEMORY_MB'] = '-256'
      mockHeapSizeLimit(384)

      const result = validateHeapConfiguration()

      expect(result.containerMemoryMB).toBe(512)
      expect(logger.warn).toHaveBeenCalledWith(
        'Invalid CONTAINER_MEMORY_MB value, using default',
        expect.objectContaining({ envValue: '-256' })
      )
    })
  })

  describe('error handling', () => {
    it('should handle v8.getHeapStatistics failure gracefully', () => {
      vi.mocked(v8.getHeapStatistics).mockImplementation(() => {
        throw new Error('V8 unavailable')
      })

      const result = validateHeapConfiguration()

      expect(result.isValid).toBe(false)
      expect(result.heapSizeLimitMB).toBe(0)
      expect(result.warning).toContain('V8 unavailable')
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to validate heap configuration',
        expect.objectContaining({ error: 'V8 unavailable' })
      )
    })
  })
})
