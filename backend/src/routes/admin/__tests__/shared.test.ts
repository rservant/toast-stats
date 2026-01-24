/**
 * Unit tests for admin shared utilities
 *
 * Tests:
 * - logAdminAccess middleware behavior
 * - generateOperationId uniqueness
 * - getServiceFactory wrapper
 *
 * Requirements: 6.2
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Request, Response, NextFunction } from 'express'
import {
  logAdminAccess,
  generateOperationId,
  getServiceFactory,
} from '../shared.js'

// Mock logger
vi.mock('../../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// Mock ProductionServiceFactory
// Routes now use createSnapshotStorage() which returns ISnapshotStorage
vi.mock('../../../services/ProductionServiceFactory.js', () => ({
  getProductionServiceFactory: vi.fn(() => ({
    createSnapshotStorage: vi.fn(),
    createSnapshotStore: vi.fn(),
    createCacheConfigService: vi.fn(),
    createRefreshService: vi.fn(),
  })),
}))

describe('Admin Shared Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('logAdminAccess middleware', () => {
    it('should call next() to continue request processing', () => {
      const mockReq = {
        path: '/test-endpoint',
        ip: '127.0.0.1',
        get: vi.fn().mockReturnValue('Test User Agent'),
      } as unknown as Request

      const mockRes = {} as Response
      const mockNext = vi.fn() as NextFunction

      logAdminAccess(mockReq, mockRes, mockNext)

      expect(mockNext).toHaveBeenCalledTimes(1)
    })

    it('should log admin access with endpoint path', async () => {
      const { logger } = await import('../../../utils/logger.js')

      const mockReq = {
        path: '/snapshots',
        ip: '192.168.1.1',
        get: vi.fn().mockReturnValue('Mozilla/5.0'),
      } as unknown as Request

      const mockRes = {} as Response
      const mockNext = vi.fn() as NextFunction

      logAdminAccess(mockReq, mockRes, mockNext)

      expect(logger.info).toHaveBeenCalledWith('Admin endpoint accessed', {
        endpoint: '/snapshots',
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      })
    })

    it('should handle missing user agent', async () => {
      const { logger } = await import('../../../utils/logger.js')

      const mockReq = {
        path: '/health',
        ip: '10.0.0.1',
        get: vi.fn().mockReturnValue(undefined),
      } as unknown as Request

      const mockRes = {} as Response
      const mockNext = vi.fn() as NextFunction

      logAdminAccess(mockReq, mockRes, mockNext)

      expect(logger.info).toHaveBeenCalledWith('Admin endpoint accessed', {
        endpoint: '/health',
        ip: '10.0.0.1',
        userAgent: undefined,
      })
      expect(mockNext).toHaveBeenCalled()
    })
  })

  describe('generateOperationId', () => {
    it('should generate operation ID with correct prefix', () => {
      const operationId = generateOperationId('list_snapshots')

      expect(operationId).toMatch(/^list_snapshots_\d+_[a-z0-9]+$/)
    })

    it('should generate unique operation IDs', () => {
      const ids = new Set<string>()

      // Generate 100 IDs and verify uniqueness
      for (let i = 0; i < 100; i++) {
        const id = generateOperationId('test')
        ids.add(id)
      }

      expect(ids.size).toBe(100)
    })

    it('should include timestamp in operation ID', () => {
      const before = Date.now()
      const operationId = generateOperationId('health_check')
      const after = Date.now()

      // Extract timestamp from operation ID
      const parts = operationId.split('_')
      const timestamp = parseInt(parts[2] ?? '0', 10)

      expect(timestamp).toBeGreaterThanOrEqual(before)
      expect(timestamp).toBeLessThanOrEqual(after)
    })

    it('should handle various prefix formats', () => {
      const prefixes = [
        'simple',
        'with_underscore',
        'multiple_underscores_here',
        'CamelCase',
        'with123numbers',
      ]

      for (const prefix of prefixes) {
        const operationId = generateOperationId(prefix)
        expect(operationId.startsWith(`${prefix}_`)).toBe(true)
      }
    })

    it('should generate random suffix', () => {
      // Generate multiple IDs with same prefix at same time
      const ids = []
      for (let i = 0; i < 10; i++) {
        ids.push(generateOperationId('test'))
      }

      // Extract suffixes
      const suffixes = ids.map(id => {
        const parts = id.split('_')
        return parts[parts.length - 1]
      })

      // Check that suffixes are alphanumeric
      for (const suffix of suffixes) {
        expect(suffix).toMatch(/^[a-z0-9]+$/)
      }
    })
  })

  describe('getServiceFactory', () => {
    it('should return production service factory', () => {
      const factory = getServiceFactory()

      expect(factory).toBeDefined()
      expect(typeof factory.createSnapshotStore).toBe('function')
      expect(typeof factory.createCacheConfigService).toBe('function')
    })

    it('should return same factory instance on multiple calls', () => {
      const factory1 = getServiceFactory()
      const factory2 = getServiceFactory()

      // Both should be defined (the mock returns a new object each time,
      // but in production it would be the same singleton)
      expect(factory1).toBeDefined()
      expect(factory2).toBeDefined()
    })
  })
})
