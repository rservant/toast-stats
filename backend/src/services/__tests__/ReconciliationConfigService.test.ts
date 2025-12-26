import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest'
import { ReconciliationConfigService } from '../ReconciliationConfigService'
import { ReconciliationConfig } from '../../types/reconciliation'
import { cacheService } from '../CacheService'

// Mock the cache service
vi.mock('../CacheService', () => ({
  cacheService: {
    get: vi.fn(),
    set: vi.fn(),
    invalidate: vi.fn(),
  },
}))

// Mock the logger
vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock fs/promises
const mockReadFile = vi.fn()
const mockWriteFile = vi.fn()
vi.mock('fs/promises', () => ({
  readFile: mockReadFile,
  writeFile: mockWriteFile,
}))

// Mock path
const mockResolve = vi.fn()
vi.mock('path', () => ({
  resolve: mockResolve,
}))

describe('ReconciliationConfigService', () => {
  let configService: ReconciliationConfigService
  const mockCacheService = cacheService as unknown as {
    get: Mock
    set: Mock
    invalidate: Mock
  }

  const defaultConfig: ReconciliationConfig = {
    maxReconciliationDays: 15,
    stabilityPeriodDays: 3,
    checkFrequencyHours: 24,
    significantChangeThresholds: {
      membershipPercent: 1,
      clubCountAbsolute: 1,
      distinguishedPercent: 2,
    },
    autoExtensionEnabled: true,
    maxExtensionDays: 5,
  }

  beforeEach(() => {
    configService = new ReconciliationConfigService()
    mockResolve.mockReturnValue('/test/path/reconciliation-config.json')
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('getConfig', () => {
    it('should return cached config when available', async () => {
      const cachedConfig = { ...defaultConfig, maxReconciliationDays: 20 }
      mockCacheService.get.mockReturnValue(cachedConfig)

      const result = await configService.getConfig()

      expect(result).toEqual(cachedConfig)
      expect(mockCacheService.get).toHaveBeenCalledWith('reconciliation:config')
      expect(mockReadFile).not.toHaveBeenCalled()
    })

    it('should load from file when cache is empty', async () => {
      mockCacheService.get.mockReturnValue(undefined)
      const fileConfig = { ...defaultConfig, maxReconciliationDays: 10 }
      mockReadFile.mockResolvedValue(JSON.stringify(fileConfig))

      const result = await configService.getConfig()

      expect(result).toEqual(fileConfig)
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'reconciliation:config',
        fileConfig,
        3600
      )
    })

    it('should use defaults when file does not exist', async () => {
      mockCacheService.get.mockReturnValue(undefined)
      const fileError = new Error('File not found')
      ;(fileError as unknown as { code: string }).code = 'ENOENT'
      mockReadFile.mockRejectedValue(fileError)
      mockWriteFile.mockResolvedValue(undefined)

      const result = await configService.getConfig()

      expect(result).toEqual(defaultConfig)
      expect(mockWriteFile).toHaveBeenCalledWith(
        '/test/path/reconciliation-config.json',
        JSON.stringify(defaultConfig, null, 2),
        'utf-8'
      )
    })

    it('should use defaults when file contains invalid JSON', async () => {
      mockCacheService.get.mockReturnValue(undefined)
      mockReadFile.mockResolvedValue('invalid json')

      const result = await configService.getConfig()

      expect(result).toEqual(defaultConfig)
    })

    it('should merge partial config from file with defaults', async () => {
      mockCacheService.get.mockReturnValue(undefined)
      const partialConfig = { maxReconciliationDays: 20 }
      mockReadFile.mockResolvedValue(JSON.stringify(partialConfig))

      const result = await configService.getConfig()

      expect(result).toEqual({
        ...defaultConfig,
        maxReconciliationDays: 20,
      })
    })
  })

  describe('updateConfig', () => {
    it('should update config with valid changes', async () => {
      mockCacheService.get.mockReturnValue(defaultConfig)
      mockWriteFile.mockResolvedValue(undefined)

      const updates = { maxReconciliationDays: 20 }
      const result = await configService.updateConfig(updates)

      expect(result.maxReconciliationDays).toBe(20)
      expect(mockWriteFile).toHaveBeenCalled()
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'reconciliation:config',
        result,
        3600
      )
    })

    it('should reject invalid configuration updates', async () => {
      mockCacheService.get.mockReturnValue(defaultConfig)

      const invalidUpdates = { maxReconciliationDays: -1 }

      await expect(configService.updateConfig(invalidUpdates)).rejects.toThrow(
        'Configuration validation failed'
      )
    })

    it('should merge nested objects correctly', async () => {
      mockCacheService.get.mockReturnValue(defaultConfig)
      mockWriteFile.mockResolvedValue(undefined)

      const updates = {
        significantChangeThresholds: {
          membershipPercent: 2.5,
          clubCountAbsolute: 1,
          distinguishedPercent: 2,
        },
      }
      const result = await configService.updateConfig(updates)

      expect(result.significantChangeThresholds).toEqual({
        membershipPercent: 2.5,
        clubCountAbsolute: 1,
        distinguishedPercent: 2,
      })
    })
  })

  describe('validateConfig', () => {
    it('should return no errors for valid config', () => {
      const errors = configService.validateConfig(defaultConfig)
      expect(errors).toHaveLength(0)
    })

    it('should validate maxReconciliationDays', () => {
      const invalidConfig = { ...defaultConfig, maxReconciliationDays: 100 }
      const errors = configService.validateConfig(invalidConfig)

      expect(errors).toHaveLength(1)
      expect(errors[0].field).toBe('maxReconciliationDays')
      expect(errors[0].message).toContain('Must be an integer between 1 and 60')
    })

    it('should validate stabilityPeriodDays against maxReconciliationDays', () => {
      const invalidConfig = {
        ...defaultConfig,
        stabilityPeriodDays: 20,
        maxReconciliationDays: 15,
      }
      const errors = configService.validateConfig(invalidConfig)

      expect(errors).toHaveLength(1)
      expect(errors[0].field).toBe('stabilityPeriodDays')
      expect(errors[0].message).toContain(
        'Must be an integer between 1 and maxReconciliationDays'
      )
    })

    it('should validate checkFrequencyHours', () => {
      const invalidConfig = { ...defaultConfig, checkFrequencyHours: 200 }
      const errors = configService.validateConfig(invalidConfig)

      expect(errors).toHaveLength(1)
      expect(errors[0].field).toBe('checkFrequencyHours')
      expect(errors[0].message).toContain(
        'Must be an integer between 1 and 168'
      )
    })

    it('should validate significantChangeThresholds', () => {
      const invalidConfig = {
        ...defaultConfig,
        significantChangeThresholds: {
          membershipPercent: 150,
          clubCountAbsolute: -1,
          distinguishedPercent: -5,
        },
      }
      const errors = configService.validateConfig(invalidConfig)

      expect(errors).toHaveLength(3)
      expect(
        errors.some(
          e => e.field === 'significantChangeThresholds.membershipPercent'
        )
      ).toBe(true)
      expect(
        errors.some(
          e => e.field === 'significantChangeThresholds.clubCountAbsolute'
        )
      ).toBe(true)
      expect(
        errors.some(
          e => e.field === 'significantChangeThresholds.distinguishedPercent'
        )
      ).toBe(true)
    })

    it('should validate autoExtensionEnabled', () => {
      const invalidConfig = {
        ...defaultConfig,
        autoExtensionEnabled: 'true' as unknown as boolean,
      }
      const errors = configService.validateConfig(invalidConfig)

      expect(errors).toHaveLength(1)
      expect(errors[0].field).toBe('autoExtensionEnabled')
      expect(errors[0].message).toContain('Must be a boolean value')
    })

    it('should validate maxExtensionDays', () => {
      const invalidConfig = { ...defaultConfig, maxExtensionDays: 50 }
      const errors = configService.validateConfig(invalidConfig)

      expect(errors).toHaveLength(1)
      expect(errors[0].field).toBe('maxExtensionDays')
      expect(errors[0].message).toContain('Must be an integer between 0 and 30')
    })
  })

  describe('resetToDefaults', () => {
    it('should reset config to defaults and clear cache', async () => {
      mockWriteFile.mockResolvedValue(undefined)

      const result = await configService.resetToDefaults()

      expect(result).toEqual(defaultConfig)
      expect(mockWriteFile).toHaveBeenCalledWith(
        '/test/path/reconciliation-config.json',
        JSON.stringify(defaultConfig, null, 2),
        'utf-8'
      )
      expect(mockCacheService.invalidate).toHaveBeenCalledWith(
        'reconciliation:config'
      )
    })
  })

  describe('clearCache', () => {
    it('should clear the cached configuration', () => {
      configService.clearCache()
      expect(mockCacheService.invalidate).toHaveBeenCalledWith(
        'reconciliation:config'
      )
    })
  })

  describe('getDefaultConfig', () => {
    it('should return a copy of the default configuration', () => {
      const result = configService.getDefaultConfig()
      expect(result).toEqual(defaultConfig)
      expect(result).not.toBe(defaultConfig) // Should be a copy, not the same reference
    })
  })
})
