/**
 * Integration Tests for RawCSVCacheService Dependency Injection
 *
 * Tests that the refactored RawCSVCacheService correctly:
 * - Creates default dependencies when not provided
 * - Accepts and uses injected mock dependencies
 * - Delegates to injected dependencies correctly
 *
 * **Validates: Requirements 5.2, 5.3, 5.4**
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import { RawCSVCacheService } from '../RawCSVCacheService.js'
import { CacheIntegrityValidator } from '../CacheIntegrityValidator.js'
import { CacheSecurityManager } from '../CacheSecurityManager.js'
import { CircuitBreaker } from '../../utils/CircuitBreaker.js'
import { CSVType } from '../../types/rawCSVCache.js'
import type {
  ICacheConfigService,
  ILogger,
  ICacheIntegrityValidator,
  ICacheSecurityManager,
  IntegrityValidationResult,
  CorruptionDetectionResult,
  RecoveryResult,
} from '../../types/serviceInterfaces.js'
import type { RawCSVCacheMetadata } from '../../types/rawCSVCache.js'

/** Mock CacheConfigService for testing */
class MockCacheConfigService implements ICacheConfigService {
  private cacheDir: string

  constructor(cacheDir: string) {
    this.cacheDir = cacheDir
  }

  getCacheDirectory(): string {
    return this.cacheDir
  }

  getConfiguration() {
    return {
      baseDirectory: this.cacheDir,
      isConfigured: true,
      source: 'test' as const,
      validationStatus: {
        isValid: true,
        isAccessible: true,
        isSecure: true,
      },
    }
  }

  async initialize(): Promise<void> {}
  async validateCacheDirectory(): Promise<void> {}
  isReady(): boolean {
    return true
  }
  async dispose(): Promise<void> {}
}

/** Mock Logger for testing */
class MockLogger implements ILogger {
  info(_message: string, _data?: unknown): void {}
  warn(_message: string, _data?: unknown): void {}
  error(_message: string, _error?: Error | unknown): void {}
  debug(_message: string, _data?: unknown): void {}
}

/** Mock CacheIntegrityValidator for testing */
class MockCacheIntegrityValidator implements ICacheIntegrityValidator {
  public validateMetadataIntegrityCalled = false
  public detectCorruptionCalled = false
  public attemptCorruptionRecoveryCalled = false
  public recalculateIntegrityTotalsCalled = false
  public repairMetadataIntegrityCalled = false

  public validateMetadataIntegrityResult: IntegrityValidationResult = {
    isValid: true,
    issues: [],
    actualStats: { fileCount: 1, totalSize: 100 },
    metadataStats: { fileCount: 1, totalSize: 100 },
  }

  public detectCorruptionResult: CorruptionDetectionResult = {
    isValid: true,
    issues: [],
  }

  public attemptCorruptionRecoveryResult: RecoveryResult = {
    success: true,
    actions: ['mock recovery action'],
    errors: [],
  }

  public repairMetadataIntegrityResult: RecoveryResult = {
    success: true,
    actions: ['mock repair action'],
    errors: [],
  }

  async validateMetadataIntegrity(
    _cacheDir: string,
    _date: string,
    _metadata: RawCSVCacheMetadata | null
  ): Promise<IntegrityValidationResult> {
    this.validateMetadataIntegrityCalled = true
    return this.validateMetadataIntegrityResult
  }

  async detectCorruption(
    _content: string,
    _metadata: RawCSVCacheMetadata | null,
    _filename: string
  ): Promise<CorruptionDetectionResult> {
    this.detectCorruptionCalled = true
    return this.detectCorruptionResult
  }

  async attemptCorruptionRecovery(
    _cacheDir: string,
    _date: string,
    _type: CSVType,
    _districtId?: string
  ): Promise<RecoveryResult> {
    this.attemptCorruptionRecoveryCalled = true
    return this.attemptCorruptionRecoveryResult
  }

  async recalculateIntegrityTotals(
    _cacheDir: string,
    _date: string,
    metadata: RawCSVCacheMetadata
  ): Promise<RawCSVCacheMetadata> {
    this.recalculateIntegrityTotalsCalled = true
    return metadata
  }

  async repairMetadataIntegrity(
    _cacheDir: string,
    _date: string,
    _existingMetadata: RawCSVCacheMetadata | null
  ): Promise<RecoveryResult> {
    this.repairMetadataIntegrityCalled = true
    return this.repairMetadataIntegrityResult
  }
}

/** Mock CacheSecurityManager for testing */
class MockCacheSecurityManager implements ICacheSecurityManager {
  public validatePathSafetyCalled = false
  public validateCacheDirectoryBoundsCalled = false
  public setSecureFilePermissionsCalled = false
  public setSecureDirectoryPermissionsCalled = false
  public validateCSVContentSecurityCalled = false
  public sanitizeDistrictIdCalled = false
  public validateDistrictIdCalled = false
  public validateDateStringCalled = false
  public validateCSVContentCalled = false

  validatePathSafety(_input: string, _inputType: string): void {
    this.validatePathSafetyCalled = true
  }

  validateCacheDirectoryBounds(_filePath: string, _cacheDir: string): void {
    this.validateCacheDirectoryBoundsCalled = true
  }

  async setSecureFilePermissions(_filePath: string): Promise<void> {
    this.setSecureFilePermissionsCalled = true
  }

  async setSecureDirectoryPermissions(_dirPath: string): Promise<void> {
    this.setSecureDirectoryPermissionsCalled = true
  }

  validateCSVContentSecurity(_csvContent: string): void {
    this.validateCSVContentSecurityCalled = true
  }

  sanitizeDistrictId(districtId: string): string {
    this.sanitizeDistrictIdCalled = true
    return districtId.replace(/[^a-zA-Z0-9\-_]/g, '')
  }

  validateDistrictId(_districtId: string): void {
    this.validateDistrictIdCalled = true
  }

  validateDateString(_date: string): void {
    this.validateDateStringCalled = true
  }

  validateCSVContent(_csvContent: string, _maxSizeMB: number): void {
    this.validateCSVContentCalled = true
  }
}

describe('RawCSVCacheService - Dependency Injection Integration Tests', () => {
  let testCacheDir: string
  let mockCacheConfig: MockCacheConfigService
  let mockLogger: MockLogger

  beforeEach(async () => {
    // Create unique test cache directory
    testCacheDir = path.join(
      process.cwd(),
      'test-cache',
      `di-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    )
    await fs.mkdir(testCacheDir, { recursive: true })

    mockCacheConfig = new MockCacheConfigService(testCacheDir)
    mockLogger = new MockLogger()
  })

  afterEach(async () => {
    // Clean up test cache directory
    try {
      await fs.rm(testCacheDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('Default Dependency Creation (Requirement 5.2)', () => {
    it('should create service with default dependencies when none provided', async () => {
      // Create service without optional dependencies
      const service = new RawCSVCacheService(mockCacheConfig, mockLogger)

      // Service should be functional
      expect(service).toBeDefined()

      // Test basic operation works (proves default dependencies are created)
      const exists = await service.hasCachedCSV(
        '2026-01-06',
        CSVType.ALL_DISTRICTS
      )
      expect(exists).toBe(false)

      await service.dispose()
    })

    it('should create default CacheIntegrityValidator when not provided', async () => {
      const service = new RawCSVCacheService(mockCacheConfig, mockLogger)

      // Cache a file and validate metadata integrity
      const csvContent = 'District,Region,Clubs\n42,1,25\n'
      await service.setCachedCSV(
        '2026-01-06',
        CSVType.ALL_DISTRICTS,
        csvContent
      )

      // This should use the default integrity validator
      const validation = await service.validateMetadataIntegrity('2026-01-06')
      expect(validation).toHaveProperty('isValid')
      expect(validation).toHaveProperty('issues')

      await service.dispose()
    })

    it('should create default CacheSecurityManager when not provided', async () => {
      const service = new RawCSVCacheService(mockCacheConfig, mockLogger)

      // This should use the default security manager for validation
      const csvContent = 'District,Region,Clubs\n42,1,25\n'
      await service.setCachedCSV(
        '2026-01-06',
        CSVType.ALL_DISTRICTS,
        csvContent
      )

      // If security manager wasn't created, this would fail
      const content = await service.getCachedCSV(
        '2026-01-06',
        CSVType.ALL_DISTRICTS
      )
      expect(content).toBe(csvContent)

      await service.dispose()
    })

    it('should create default CircuitBreaker when not provided', async () => {
      const service = new RawCSVCacheService(mockCacheConfig, mockLogger)

      // Check circuit breaker status (proves it was created)
      const status = service.getCircuitBreakerStatus()
      expect(status).toHaveProperty('isOpen')
      expect(status).toHaveProperty('failures')
      expect(status.isOpen).toBe(false)
      expect(status.failures).toBe(0)

      await service.dispose()
    })
  })

  describe('Mock Dependency Injection (Requirement 5.3)', () => {
    it('should accept and use injected mock CacheIntegrityValidator', async () => {
      const mockIntegrityValidator = new MockCacheIntegrityValidator()

      const service = new RawCSVCacheService(
        mockCacheConfig,
        mockLogger,
        undefined,
        mockIntegrityValidator
      )

      // Cache a file first
      const csvContent = 'District,Region,Clubs\n42,1,25\n'
      await service.setCachedCSV(
        '2026-01-06',
        CSVType.ALL_DISTRICTS,
        csvContent
      )

      // Call validateMetadataIntegrity which should delegate to mock
      await service.validateMetadataIntegrity('2026-01-06')

      // Verify mock was called
      expect(mockIntegrityValidator.validateMetadataIntegrityCalled).toBe(true)

      await service.dispose()
    })

    it('should accept and use injected mock CacheSecurityManager', async () => {
      const mockSecurityManager = new MockCacheSecurityManager()

      const service = new RawCSVCacheService(
        mockCacheConfig,
        mockLogger,
        undefined,
        undefined,
        mockSecurityManager
      )

      // Perform an operation that triggers security validation
      const csvContent = 'District,Region,Clubs\n42,1,25\n'
      await service.setCachedCSV(
        '2026-01-06',
        CSVType.ALL_DISTRICTS,
        csvContent
      )

      // Verify mock security methods were called
      expect(mockSecurityManager.validateDateStringCalled).toBe(true)
      expect(mockSecurityManager.validateCSVContentCalled).toBe(true)

      await service.dispose()
    })

    it('should accept and use injected CircuitBreaker', async () => {
      const mockCircuitBreaker =
        CircuitBreaker.createCacheCircuitBreaker('test-injected')
      const getStatsSpy = vi.spyOn(mockCircuitBreaker, 'getStats')

      const service = new RawCSVCacheService(
        mockCacheConfig,
        mockLogger,
        undefined,
        undefined,
        undefined,
        mockCircuitBreaker
      )

      // Get circuit breaker status which should use the injected circuit breaker
      const status = service.getCircuitBreakerStatus()

      // Verify the injected circuit breaker was used
      expect(getStatsSpy).toHaveBeenCalled()
      expect(status.isOpen).toBe(false)

      await service.dispose()
    })

    it('should accept all three mock dependencies together', async () => {
      const mockIntegrityValidator = new MockCacheIntegrityValidator()
      const mockSecurityManager = new MockCacheSecurityManager()
      const mockCircuitBreaker =
        CircuitBreaker.createCacheCircuitBreaker('test-all')

      const service = new RawCSVCacheService(
        mockCacheConfig,
        mockLogger,
        undefined,
        mockIntegrityValidator,
        mockSecurityManager,
        mockCircuitBreaker
      )

      // Perform operations
      const csvContent = 'District,Region,Clubs\n42,1,25\n'
      await service.setCachedCSV(
        '2026-01-06',
        CSVType.ALL_DISTRICTS,
        csvContent
      )
      await service.validateMetadataIntegrity('2026-01-06')

      // Verify all mocks were used
      expect(mockSecurityManager.validateDateStringCalled).toBe(true)
      expect(mockIntegrityValidator.validateMetadataIntegrityCalled).toBe(true)

      await service.dispose()
    })
  })

  describe('Mock Dependency Delegation Verification (Requirement 5.4)', () => {
    it('should delegate validateMetadataIntegrity to injected validator', async () => {
      const mockIntegrityValidator = new MockCacheIntegrityValidator()
      mockIntegrityValidator.validateMetadataIntegrityResult = {
        isValid: false,
        issues: ['mock issue'],
        actualStats: { fileCount: 2, totalSize: 200 },
        metadataStats: { fileCount: 1, totalSize: 100 },
      }

      const service = new RawCSVCacheService(
        mockCacheConfig,
        mockLogger,
        undefined,
        mockIntegrityValidator
      )

      // Cache a file first
      const csvContent = 'District,Region,Clubs\n42,1,25\n'
      await service.setCachedCSV(
        '2026-01-06',
        CSVType.ALL_DISTRICTS,
        csvContent
      )

      const result = await service.validateMetadataIntegrity('2026-01-06')

      // Result should match mock's configured result
      expect(result.isValid).toBe(false)
      expect(result.issues).toContain('mock issue')
      expect(mockIntegrityValidator.validateMetadataIntegrityCalled).toBe(true)

      await service.dispose()
    })

    it('should delegate repairMetadataIntegrity to injected validator', async () => {
      const mockIntegrityValidator = new MockCacheIntegrityValidator()
      mockIntegrityValidator.repairMetadataIntegrityResult = {
        success: true,
        actions: ['custom repair action'],
        errors: [],
      }

      const service = new RawCSVCacheService(
        mockCacheConfig,
        mockLogger,
        undefined,
        mockIntegrityValidator
      )

      // Cache a file first
      const csvContent = 'District,Region,Clubs\n42,1,25\n'
      await service.setCachedCSV(
        '2026-01-06',
        CSVType.ALL_DISTRICTS,
        csvContent
      )

      const result = await service.repairMetadataIntegrity('2026-01-06')

      expect(result.success).toBe(true)
      expect(mockIntegrityValidator.repairMetadataIntegrityCalled).toBe(true)

      await service.dispose()
    })

    it('should delegate date validation to injected security manager', async () => {
      const mockSecurityManager = new MockCacheSecurityManager()

      const service = new RawCSVCacheService(
        mockCacheConfig,
        mockLogger,
        undefined,
        undefined,
        mockSecurityManager
      )

      // hasCachedCSV should trigger date validation
      await service.hasCachedCSV('2026-01-06', CSVType.ALL_DISTRICTS)

      expect(mockSecurityManager.validateDateStringCalled).toBe(true)

      await service.dispose()
    })

    it('should delegate district ID validation to injected security manager', async () => {
      const mockSecurityManager = new MockCacheSecurityManager()

      const service = new RawCSVCacheService(
        mockCacheConfig,
        mockLogger,
        undefined,
        undefined,
        mockSecurityManager
      )

      // Operation with district ID should trigger validation
      await service.hasCachedCSV(
        '2026-01-06',
        CSVType.DISTRICT_PERFORMANCE,
        '42'
      )

      expect(mockSecurityManager.validateDistrictIdCalled).toBe(true)

      await service.dispose()
    })

    it('should delegate CSV content validation to injected security manager', async () => {
      const mockSecurityManager = new MockCacheSecurityManager()

      const service = new RawCSVCacheService(
        mockCacheConfig,
        mockLogger,
        undefined,
        undefined,
        mockSecurityManager
      )

      const csvContent = 'District,Region,Clubs\n42,1,25\n'
      await service.setCachedCSV(
        '2026-01-06',
        CSVType.ALL_DISTRICTS,
        csvContent
      )

      expect(mockSecurityManager.validateCSVContentCalled).toBe(true)

      await service.dispose()
    })

    it('should use injected circuit breaker for status reporting', async () => {
      const mockCircuitBreaker =
        CircuitBreaker.createCacheCircuitBreaker('test-status')
      const getStatsSpy = vi.spyOn(mockCircuitBreaker, 'getStats')

      const service = new RawCSVCacheService(
        mockCacheConfig,
        mockLogger,
        undefined,
        undefined,
        undefined,
        mockCircuitBreaker
      )

      // Get circuit breaker status
      service.getCircuitBreakerStatus()

      expect(getStatsSpy).toHaveBeenCalled()

      await service.dispose()
    })

    it('should use injected circuit breaker for manual reset', async () => {
      const mockCircuitBreaker =
        CircuitBreaker.createCacheCircuitBreaker('test-reset')
      const resetSpy = vi.spyOn(mockCircuitBreaker, 'reset')

      const service = new RawCSVCacheService(
        mockCacheConfig,
        mockLogger,
        undefined,
        undefined,
        undefined,
        mockCircuitBreaker
      )

      // Manually reset circuit breaker
      service.resetCircuitBreakerManually()

      expect(resetSpy).toHaveBeenCalled()

      await service.dispose()
    })
  })

  describe('Backward Compatibility', () => {
    it('should maintain identical behavior with default vs explicit dependencies', async () => {
      // Create service with defaults
      const serviceWithDefaults = new RawCSVCacheService(
        mockCacheConfig,
        mockLogger
      )

      // Create service with explicit default implementations
      const explicitIntegrityValidator = new CacheIntegrityValidator(mockLogger)
      const explicitSecurityManager = new CacheSecurityManager(mockLogger)
      const explicitCircuitBreaker =
        CircuitBreaker.createCacheCircuitBreaker('explicit')

      const serviceWithExplicit = new RawCSVCacheService(
        mockCacheConfig,
        mockLogger,
        undefined,
        explicitIntegrityValidator,
        explicitSecurityManager,
        explicitCircuitBreaker
      )

      // Both should handle the same operations identically
      const csvContent = 'District,Region,Clubs\n42,1,25\n'

      await serviceWithDefaults.setCachedCSV(
        '2026-01-06',
        CSVType.ALL_DISTRICTS,
        csvContent
      )
      await serviceWithExplicit.setCachedCSV(
        '2026-01-07',
        CSVType.ALL_DISTRICTS,
        csvContent
      )

      const contentFromDefaults = await serviceWithDefaults.getCachedCSV(
        '2026-01-06',
        CSVType.ALL_DISTRICTS
      )
      const contentFromExplicit = await serviceWithExplicit.getCachedCSV(
        '2026-01-07',
        CSVType.ALL_DISTRICTS
      )

      expect(contentFromDefaults).toBe(csvContent)
      expect(contentFromExplicit).toBe(csvContent)

      await serviceWithDefaults.dispose()
      await serviceWithExplicit.dispose()
    })
  })
})
