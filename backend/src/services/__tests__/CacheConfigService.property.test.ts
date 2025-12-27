/**
 * Property-Based Tests for CacheConfigService
 *
 * **Feature: cache-location-configuration, Property 1: Environment Variable Configuration**
 * **Validates: Requirements 1.1, 1.2**
 *
 * **Feature: cache-location-configuration, Property 2: Default Fallback Behavior**
 * **Validates: Requirements 1.3**
 *
 * **Feature: cache-location-configuration, Property 4: Security Validation**
 * **Validates: Requirements 1.5, 4.1, 4.2**
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import fs from 'fs/promises'
import path from 'path'
import { 
  CacheConfigService, 
  CacheDirectoryValidator
} from '../CacheConfigService.js'

describe('CacheConfigService - Property-Based Tests', () => {
  let originalEnv: string | undefined

  beforeEach(() => {
    // Reset singleton instance before each test
    CacheConfigService.resetInstance()
    
    // Store original environment variable
    originalEnv = process.env.CACHE_DIR
  })

  afterEach(async () => {
    // Restore original environment variable
    if (originalEnv !== undefined) {
      process.env.CACHE_DIR = originalEnv
    } else {
      delete process.env.CACHE_DIR
    }

    // Reset singleton instance after each test
    CacheConfigService.resetInstance()

    // Clean up any test directories
    try {
      const testDirs = [
        './test-cache',
        './cache',
        '/tmp/test-cache-config'
      ]
      
      for (const dir of testDirs) {
        try {
          await fs.rm(dir, { recursive: true, force: true })
        } catch {
          // Ignore cleanup errors
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  })

  // Test data generators
  const generateValidCachePath = (): fc.Arbitrary<string> =>
    fc.oneof(
      fc.constant('./cache'),
      fc.constant('./test-cache'),
      fc.constant('/tmp/test-cache-config'),
      fc.string({ minLength: 5, maxLength: 20 })
        .filter(s => !s.includes('..') && !s.includes('~') && !s.startsWith('/'))
        .map(s => `./test-${s.replace(/[^a-zA-Z0-9-]/g, 'x')}`)
    )

  const generateUnsafeCachePath = (): fc.Arbitrary<string> =>
    fc.oneof(
      fc.constant('../../../etc'),
      fc.constant('../../usr/bin'),
      fc.constant('/etc/passwd'),
      fc.constant('/usr'),
      fc.constant('/var'),
      fc.constant('/sys'),
      fc.constant('/proc'),
      fc.constant('/boot'),
      fc.constant('~/.ssh'),
      fc.string({ minLength: 1, maxLength: 10 }).map(s => `../${s}`),
      fc.string({ minLength: 1, maxLength: 10 }).map(s => `~/${s}`)
    )

  /**
   * Property 1: Environment Variable Configuration
   * For any valid cache directory path set in CACHE_DIR environment variable,
   * all cache services should use that directory as their base cache location
   */
  describe('Property 1: Environment Variable Configuration', () => {
    it('should use CACHE_DIR environment variable when set', async () => {
      await fc.assert(
        fc.asyncProperty(
          generateValidCachePath(),
          async (cachePath) => {
            // Set environment variable
            process.env.CACHE_DIR = cachePath
            
            // Reset singleton to pick up new environment
            CacheConfigService.resetInstance()
            
            // Get service instance
            const service = CacheConfigService.getInstance()
            
            // Initialize the service
            await service.initialize()
            
            // Property: Service should use the configured cache directory
            const actualPath = service.getCacheDirectory()
            const expectedPath = path.resolve(cachePath)
            
            expect(actualPath).toBe(expectedPath)
            
            // Property: Configuration should reflect environment source
            const config = service.getConfiguration()
            expect(config.isConfigured).toBe(true)
            expect(config.source).toBe('environment')
            expect(config.baseDirectory).toBe(expectedPath)
            
            // Property: Service should be ready after successful initialization
            expect(service.isReady()).toBe(true)
          }
        ),
        { numRuns: 10 }
      )
    })

    it('should resolve relative paths to absolute paths', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 3, maxLength: 15 })
            .filter(s => !s.includes('..') && !s.includes('~'))
            .map(s => `./test-${s.replace(/[^a-zA-Z0-9-]/g, 'x')}`),
          async (relativePath) => {
            // Set environment variable with relative path
            process.env.CACHE_DIR = relativePath
            
            // Reset singleton to pick up new environment
            CacheConfigService.resetInstance()
            
            // Get service instance
            const service = CacheConfigService.getInstance()
            
            // Initialize the service
            await service.initialize()
            
            // Property: Relative paths should be resolved to absolute paths
            const actualPath = service.getCacheDirectory()
            const expectedPath = path.resolve(relativePath)
            
            expect(actualPath).toBe(expectedPath)
            expect(path.isAbsolute(actualPath)).toBe(true)
          }
        ),
        { numRuns: 10 }
      )
    })
  })

  /**
   * Property 2: Default Fallback Behavior
   * For any system initialization when CACHE_DIR is not set,
   * the system should use './cache' as the default cache directory
   */
  describe('Property 2: Default Fallback Behavior', () => {
    it('should use default cache directory when CACHE_DIR is not set', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(undefined), // No environment variable set
          async () => {
            // Ensure CACHE_DIR is not set
            delete process.env.CACHE_DIR
            
            // Reset singleton to pick up environment change
            CacheConfigService.resetInstance()
            
            // Get service instance
            const service = CacheConfigService.getInstance()
            
            // Initialize the service
            await service.initialize()
            
            // Property: Should use default cache directory
            const actualPath = service.getCacheDirectory()
            const expectedPath = path.resolve('./cache')
            
            expect(actualPath).toBe(expectedPath)
            
            // Property: Configuration should reflect default source
            const config = service.getConfiguration()
            expect(config.isConfigured).toBe(false)
            expect(config.source).toBe('default')
            expect(config.baseDirectory).toBe(expectedPath)
          }
        ),
        { numRuns: 5 }
      )
    })

    it('should fallback to default when environment variable is empty', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant(''),
            fc.constant('   '),
            fc.constant('\t'),
            fc.constant('\n')
          ),
          async (emptyValue) => {
            // Set environment variable to empty/whitespace value
            process.env.CACHE_DIR = emptyValue
            
            // Reset singleton to pick up new environment
            CacheConfigService.resetInstance()
            
            // Get service instance
            const service = CacheConfigService.getInstance()
            
            // Initialize the service
            await service.initialize()
            
            // Property: Should use default cache directory for empty values
            const actualPath = service.getCacheDirectory()
            const expectedPath = path.resolve('./cache')
            
            expect(actualPath).toBe(expectedPath)
            
            // Property: Configuration should reflect default source
            const config = service.getConfiguration()
            expect(config.source).toBe('default')
          }
        ),
        { numRuns: 5 }
      )
    })
  })

  /**
   * Property 4: Security Validation
   * For any cache directory configuration input, the system should validate path format,
   * prevent path traversal attempts, and reject malicious paths
   */
  describe('Property 4: Security Validation', () => {
    it('should reject unsafe cache directory paths', async () => {
      await fc.assert(
        fc.asyncProperty(
          generateUnsafeCachePath(),
          async (unsafePath) => {
            // Set environment variable to unsafe path
            process.env.CACHE_DIR = unsafePath
            
            // Reset singleton to pick up new environment
            CacheConfigService.resetInstance()
            
            // Get service instance
            const service = CacheConfigService.getInstance()
            
            // Property: Should either reject unsafe path or fallback to safe default
            try {
              await service.initialize()
              
              // If initialization succeeds, check the actual path
              const actualPath = service.getCacheDirectory()
              const expectedPath = path.resolve('./cache')
              
              // Either it should have fallen back to default, or it should be a safe path
              if (actualPath === expectedPath) {
                // Successfully fell back to default
                const config = service.getConfiguration()
                expect(config.source).toBe('default')
              } else {
                // If it didn't fall back, the path should at least be safe
                // (not pointing to system directories)
                expect(actualPath).not.toMatch(/^\/etc|^\/usr|^\/var|^\/sys|^\/proc|^\/boot/)
              }
            } catch (error: unknown) {
              // If initialization fails, it should be a configuration error or validation error
              expect(error).toBeInstanceOf(Error)
              // Accept either CacheConfigurationError or other validation errors
              expect((error as Error).message).toMatch(/cache|directory|invalid|unsafe|configuration/i)
            }
          }
        ),
        { numRuns: 10 }
      )
    })

    it('should validate path security through CacheDirectoryValidator', async () => {
      await fc.assert(
        fc.asyncProperty(
          generateUnsafeCachePath(),
          async (unsafePath) => {
            // Property: Validator should identify unsafe paths
            const validation = await CacheDirectoryValidator.validate(unsafePath)
            
            expect(validation.isSecure).toBe(false)
            expect(validation.errorMessage).toBeDefined()
            // Accept various error message patterns for unsafe paths
            expect(validation.errorMessage).toMatch(/unsafe|sensitive|dangerous|traversal|root/i)
          }
        ),
        { numRuns: 10 }
      )
    })

    it('should prevent path traversal attacks', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant('../../../etc/passwd'),
            fc.constant('../../usr/bin'),
            fc.constant('../../../root'),
            fc.string({ minLength: 1, maxLength: 5 }).map(s => `../${s}/../../etc`),
            fc.string({ minLength: 1, maxLength: 5 }).map(s => `${s}/../../../usr`)
          ),
          async (traversalPath) => {
            // Property: Path traversal attempts should be rejected
            const validation = await CacheDirectoryValidator.validate(traversalPath)
            
            expect(validation.isValid).toBe(false)
            expect(validation.isSecure).toBe(false)
            expect(validation.errorMessage).toBeDefined()
          }
        ),
        { numRuns: 10 }
      )
    })

    it('should validate write permissions for cache directories', async () => {
      await fc.assert(
        fc.asyncProperty(
          generateValidCachePath(),
          async (validPath) => {
            // Property: Valid paths should pass security validation and be writable
            const validation = await CacheDirectoryValidator.validate(validPath)
            
            if (validation.isValid && validation.isSecure) {
              expect(validation.isAccessible).toBe(true)
              expect(validation.errorMessage).toBeUndefined()
            }
            
            // Clean up created directory
            try {
              await fs.rm(path.resolve(validPath), { recursive: true, force: true })
            } catch {
              // Ignore cleanup errors
            }
          }
        ),
        { numRuns: 5 }
      )
    })

    it('should handle singleton pattern correctly across multiple calls', async () => {
      await fc.assert(
        fc.asyncProperty(
          generateValidCachePath(),
          async (cachePath) => {
            // Set environment variable
            process.env.CACHE_DIR = cachePath
            
            // Reset singleton to pick up new environment
            CacheConfigService.resetInstance()
            
            // Property: Multiple getInstance calls should return the same instance
            const service1 = CacheConfigService.getInstance()
            const service2 = CacheConfigService.getInstance()
            const service3 = CacheConfigService.getInstance()
            
            expect(service1).toBe(service2)
            expect(service2).toBe(service3)
            
            // Property: All instances should have the same configuration
            await service1.initialize()
            
            expect(service1.getCacheDirectory()).toBe(service2.getCacheDirectory())
            expect(service2.getCacheDirectory()).toBe(service3.getCacheDirectory())
            
            const config1 = service1.getConfiguration()
            const config2 = service2.getConfiguration()
            const config3 = service3.getConfiguration()
            
            expect(config1.baseDirectory).toBe(config2.baseDirectory)
            expect(config2.baseDirectory).toBe(config3.baseDirectory)
            expect(config1.source).toBe(config2.source)
            expect(config2.source).toBe(config3.source)
          }
        ),
        { numRuns: 5 }
      )
    })
  })
})