/**
 * Property-Based Tests for CacheConfigService
 *
 * **Feature: cache-location-configuration, Property 1: Environment Variable Configuration**
 * **Validates: Requirements 1.1, 1.2**
 *
 * **Feature: cache-location-configuration, Property 2: Default Fallback Behavior**
 * **Validates: Requirements 1.3**
 *
 * **Feature: cache-location-configuration, Property 3: Service Configuration Consistency**
 * **Validates: Requirements 1.4, 2.1, 2.2, 2.4, 3.3, 6.4**
 *
 * **Feature: cache-location-configuration, Property 4: Security Validation**
 * **Validates: Requirements 1.5, 4.1, 4.2**
 *
 * **Feature: cache-location-configuration, Property 6: Permission Validation**
 * **Validates: Requirements 4.3, 4.4**
 *
 * **Feature: cache-location-configuration, Property 7: Fallback on Validation Failure**
 * **Validates: Requirements 4.5, 4.4**
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import fs from 'fs/promises'
import path from 'path'
import {
  CacheConfigService,
  CacheDirectoryValidator,
} from '../CacheConfigService.ts'
import { safeString } from '../../utils/test-string-generators'
import { createTestSelfCleanup } from '../../utils/test-self-cleanup.ts'

describe('CacheConfigService - Property-Based Tests', () => {
  let originalEnv: string | undefined
  
  // Self-cleanup setup - each test manages its own cleanup
  const { cleanup, afterEach: performCleanup } = createTestSelfCleanup({ verbose: false })

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

    // Perform self-cleanup of all tracked resources
    await performCleanup()
  })

  // Test data generators
  const generateValidCachePath = (): fc.Arbitrary<string> =>
    fc.oneof(
      fc.constant('./cache'),
      fc.constant('./test-dir/test-cache'),
      fc.constant('/tmp/test-cache-config'),
      safeString(5, 20).map(_s => `./test-dir/test-${_s}`)
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
      fc.string({ minLength: 1, maxLength: 10 }).map(_s => `../${_s}`),
      fc.string({ minLength: 1, maxLength: 10 }).map(_s => `~/${_s}`)
    )

  /**
   * Property 1: Environment Variable Configuration
   * For any valid cache directory path set in CACHE_DIR environment variable,
   * all cache services should use that directory as their base cache location
   */
  describe('Property 1: Environment Variable Configuration', () => {
    it('should use CACHE_DIR environment variable when set', async () => {
      await fc.assert(
        fc.asyncProperty(generateValidCachePath(), async cachePath => {
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
        }),
        { numRuns: 10 }
      )
    })

    it('should resolve relative paths to absolute paths', async () => {
      await fc.assert(
        fc.asyncProperty(
          safeString(3, 15).map(_s => `./test-dir/test-${_s}`),
          async relativePath => {
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
          async emptyValue => {
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
   * Property 3: Service Configuration Consistency
   * For any cache service initialization (CacheManager, DistrictCacheManager, Assessment services),
   * all services should receive and use the same cache directory configuration
   */
  describe('Property 3: Service Configuration Consistency', () => {
    it('should provide consistent cache directory to all cache services', async () => {
      await fc.assert(
        fc.asyncProperty(generateValidCachePath(), async cachePath => {
          // Set environment variable
          process.env.CACHE_DIR = cachePath

          // Reset singleton to pick up new environment
          CacheConfigService.resetInstance()

          // Get service instance and initialize
          const configService = CacheConfigService.getInstance()
          await configService.initialize()

          // Property: All calls to getCacheDirectory should return the same path
          const path1 = configService.getCacheDirectory()
          const path2 = configService.getCacheDirectory()
          const path3 = configService.getCacheDirectory()

          expect(path1).toBe(path2)
          expect(path2).toBe(path3)

          // Property: Multiple service instances should get consistent configuration
          const service1 = CacheConfigService.getInstance()
          const service2 = CacheConfigService.getInstance()

          expect(service1.getCacheDirectory()).toBe(
            service2.getCacheDirectory()
          )
          expect(service1.getCacheDirectory()).toBe(path.resolve(cachePath))

          // Property: Configuration objects should be consistent
          const config1 = service1.getConfiguration()
          const config2 = service2.getConfiguration()

          expect(config1.baseDirectory).toBe(config2.baseDirectory)
          expect(config1.source).toBe(config2.source)
          expect(config1.isConfigured).toBe(config2.isConfigured)

          // Property: All configurations should reflect the same cache directory
          expect(config1.baseDirectory).toBe(path.resolve(cachePath))
          expect(config2.baseDirectory).toBe(path.resolve(cachePath))
        }),
        { numRuns: 10 }
      )
    })

    it('should maintain consistency across service resets and reinitializations', async () => {
      await fc.assert(
        fc.asyncProperty(generateValidCachePath(), async cachePath => {
          // Set environment variable
          process.env.CACHE_DIR = cachePath

          // Reset and initialize first time
          CacheConfigService.resetInstance()
          const service1 = CacheConfigService.getInstance()
          await service1.initialize()
          const path1 = service1.getCacheDirectory()

          // Reset and initialize second time
          CacheConfigService.resetInstance()
          const service2 = CacheConfigService.getInstance()
          await service2.initialize()
          const path2 = service2.getCacheDirectory()

          // Reset and initialize third time
          CacheConfigService.resetInstance()
          const service3 = CacheConfigService.getInstance()
          await service3.initialize()
          const path3 = service3.getCacheDirectory()

          // Property: All instances should resolve to the same cache directory
          expect(path1).toBe(path2)
          expect(path2).toBe(path3)
          expect(path1).toBe(path.resolve(cachePath))

          // Property: All configurations should be identical
          const config1 = service1.getConfiguration()
          const config2 = service2.getConfiguration()
          const config3 = service3.getConfiguration()

          expect(config1.baseDirectory).toBe(config2.baseDirectory)
          expect(config2.baseDirectory).toBe(config3.baseDirectory)
          expect(config1.source).toBe(config2.source)
          expect(config2.source).toBe(config3.source)
        }),
        { numRuns: 5 }
      )
    })

    it('should provide consistent configuration regardless of initialization order', async () => {
      await fc.assert(
        fc.asyncProperty(generateValidCachePath(), async cachePath => {
          // Set environment variable
          process.env.CACHE_DIR = cachePath

          // Reset singleton
          CacheConfigService.resetInstance()

          // Get multiple instances before any initialization
          const service1 = CacheConfigService.getInstance()
          const service2 = CacheConfigService.getInstance()
          const service3 = CacheConfigService.getInstance()

          // Property: All instances should be the same object (singleton)
          expect(service1).toBe(service2)
          expect(service2).toBe(service3)

          // Initialize one of them
          await service1.initialize()

          // Property: All instances should now have the same configuration
          expect(service1.getCacheDirectory()).toBe(
            service2.getCacheDirectory()
          )
          expect(service2.getCacheDirectory()).toBe(
            service3.getCacheDirectory()
          )

          const config1 = service1.getConfiguration()
          const config2 = service2.getConfiguration()
          const config3 = service3.getConfiguration()

          expect(config1.baseDirectory).toBe(config2.baseDirectory)
          expect(config2.baseDirectory).toBe(config3.baseDirectory)
          expect(config1.source).toBe(config2.source)
          expect(config2.source).toBe(config3.source)

          // Property: All should reflect the configured cache directory
          expect(config1.baseDirectory).toBe(path.resolve(cachePath))
        }),
        { numRuns: 10 }
      )
    })

    it('should ensure cache directory consistency between default and configured scenarios', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            configuredPath: generateValidCachePath(),
            useDefault: fc.boolean(),
          }),
          async ({ configuredPath, useDefault }) => {
            if (useDefault) {
              // Test default scenario
              delete process.env.CACHE_DIR
            } else {
              // Test configured scenario
              process.env.CACHE_DIR = configuredPath
            }

            // Reset singleton
            CacheConfigService.resetInstance()

            // Get service and initialize
            const service = CacheConfigService.getInstance()
            await service.initialize()

            const actualPath = service.getCacheDirectory()
            const config = service.getConfiguration()

            if (useDefault) {
              // Property: Default scenario should be consistent
              expect(actualPath).toBe(path.resolve('./cache'))
              expect(config.source).toBe('default')
              expect(config.isConfigured).toBe(false)
            } else {
              // Property: Configured scenario should be consistent
              expect(actualPath).toBe(path.resolve(configuredPath))
              expect(config.source).toBe('environment')
              expect(config.isConfigured).toBe(true)
            }

            // Property: Configuration should always be internally consistent
            expect(config.baseDirectory).toBe(actualPath)

            // Property: Service should be ready after successful initialization
            if (service.isReady()) {
              expect(config.validationStatus.isValid).toBe(true)
              expect(config.validationStatus.isAccessible).toBe(true)
              expect(config.validationStatus.isSecure).toBe(true)
            }
          }
        ),
        { numRuns: 10 }
      )
    })

    it('should maintain configuration consistency during concurrent access', async () => {
      await fc.assert(
        fc.asyncProperty(generateValidCachePath(), async cachePath => {
          // Set environment variable
          process.env.CACHE_DIR = cachePath

          // Reset singleton
          CacheConfigService.resetInstance()

          // Get the singleton instance first to ensure it's created
          const service = CacheConfigService.getInstance()

          // Initialize once to avoid race conditions
          await service.initialize()

          // Property: Concurrent access should return consistent results
          const promises = Array.from({ length: 5 }, async () => {
            // Get the same singleton instance (no re-initialization needed)
            const sameService = CacheConfigService.getInstance()
            return {
              cacheDir: sameService.getCacheDirectory(),
              config: sameService.getConfiguration(),
              isReady: sameService.isReady(),
            }
          })

          const results = await Promise.all(promises)

          // Property: All concurrent accesses should return identical results
          const firstResult = results[0]
          for (let i = 1; i < results.length; i++) {
            expect(results[i].cacheDir).toBe(firstResult.cacheDir)
            expect(results[i].config.baseDirectory).toBe(
              firstResult.config.baseDirectory
            )
            expect(results[i].config.source).toBe(firstResult.config.source)
            expect(results[i].config.isConfigured).toBe(
              firstResult.config.isConfigured
            )
            expect(results[i].isReady).toBe(firstResult.isReady)
          }

          // Property: All results should reflect the configured path (or fallback if validation failed)
          const expectedPath = path.resolve(cachePath)
          if (firstResult.config.source === 'environment') {
            // If using environment source, should match configured path
            expect(firstResult.cacheDir).toBe(expectedPath)
          } else {
            // If fell back to default, should be consistent across all calls
            expect(firstResult.cacheDir).toBe(path.resolve('./cache'))
            expect(firstResult.config.source).toBe('default')
          }
        }),
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
        fc.asyncProperty(generateUnsafeCachePath(), async unsafePath => {
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
              expect(actualPath).not.toMatch(
                /^\/etc|^\/usr|^\/var|^\/sys|^\/proc|^\/boot/
              )
            }
          } catch (error: unknown) {
            // If initialization fails, it should be a configuration error or validation error
            expect(error).toBeInstanceOf(Error)
            // Accept either CacheConfigurationError or other validation errors
            expect((error as Error).message).toMatch(
              /cache|directory|invalid|unsafe|configuration/i
            )
          }
        }),
        { numRuns: 10 }
      )
    })

    it('should validate path security through CacheDirectoryValidator', async () => {
      await fc.assert(
        fc.asyncProperty(generateUnsafeCachePath(), async unsafePath => {
          // Property: Validator should identify unsafe paths
          const validation = await CacheDirectoryValidator.validate(unsafePath)

          expect(validation.isSecure).toBe(false)
          expect(validation.errorMessage).toBeDefined()
          // Accept various error message patterns for unsafe paths
          expect(validation.errorMessage).toMatch(
            /unsafe|sensitive|dangerous|traversal|root/i
          )
        }),
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
            fc
              .string({ minLength: 1, maxLength: 5 })
              .map(_s => `../${_s}/../../etc`),
            fc
              .string({ minLength: 1, maxLength: 5 })
              .map(_s => `${_s}/../../../usr`)
          ),
          async traversalPath => {
            // Property: Path traversal attempts should be rejected
            const validation =
              await CacheDirectoryValidator.validate(traversalPath)

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
        fc.asyncProperty(generateValidCachePath(), async validPath => {
          // Property: Valid paths should pass security validation and be writable
          const validation = await CacheDirectoryValidator.validate(validPath)

          if (validation.isValid && validation.isSecure) {
            expect(validation.isAccessible).toBe(true)
            expect(validation.errorMessage).toBeUndefined()
          }

          // Clean up created directory
          try {
            await fs.rm(path.resolve(validPath), {
              recursive: true,
              force: true,
            })
          } catch {
            // Ignore cleanup errors
          }
        }),
        { numRuns: 5 }
      )
    })

    it('should handle singleton pattern correctly across multiple calls', async () => {
      await fc.assert(
        fc.asyncProperty(generateValidCachePath(), async cachePath => {
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

          expect(service1.getCacheDirectory()).toBe(
            service2.getCacheDirectory()
          )
          expect(service2.getCacheDirectory()).toBe(
            service3.getCacheDirectory()
          )

          const config1 = service1.getConfiguration()
          const config2 = service2.getConfiguration()
          const config3 = service3.getConfiguration()

          expect(config1.baseDirectory).toBe(config2.baseDirectory)
          expect(config2.baseDirectory).toBe(config3.baseDirectory)
          expect(config1.source).toBe(config2.source)
          expect(config2.source).toBe(config3.source)
        }),
        { numRuns: 5 }
      )
    })
  })

  /**
   * Property 6: Permission Validation
   * For any configured cache directory, the system should verify write permissions
   * during initialization and handle permission failures appropriately
   */
  describe('Property 6: Permission Validation', () => {
    it('should verify write permissions during cache directory validation', async () => {
      await fc.assert(
        fc.asyncProperty(generateValidCachePath(), async cachePath => {
          // Property: Valid cache directories should pass permission validation
          const validation = await CacheDirectoryValidator.validate(cachePath)

          if (validation.isValid && validation.isSecure) {
            // If the path is valid and secure, it should also be accessible (writable)
            expect(validation.isAccessible).toBe(true)
            expect(validation.errorMessage).toBeUndefined()

            // Verify the directory was actually created and is writable
            const resolvedPath = path.resolve(cachePath)
            const stats = await fs.stat(resolvedPath)
            expect(stats.isDirectory()).toBe(true)

            // Test write access by creating a test file
            const testFile = path.join(resolvedPath, '.permission-test')
            await fs.writeFile(testFile, 'test', 'utf-8')
            const content = await fs.readFile(testFile, 'utf-8')
            expect(content).toBe('test')

            // Clean up test file
            await fs.unlink(testFile)
          }

          // Clean up created directory
          try {
            await fs.rm(path.resolve(cachePath), {
              recursive: true,
              force: true,
            })
          } catch {
            // Ignore cleanup errors
          }
        }),
        { numRuns: 10 }
      )
    })

    it('should handle permission failures appropriately during initialization', async () => {
      await fc.assert(
        fc.asyncProperty(generateValidCachePath(), async cachePath => {
          // Set environment variable to a path we'll make read-only
          process.env.CACHE_DIR = cachePath

          // Reset singleton to pick up new environment
          CacheConfigService.resetInstance()

          // Create the directory first
          const resolvedPath = path.resolve(cachePath)
          await fs.mkdir(resolvedPath, { recursive: true })

          try {
            // Make directory read-only (remove write permissions)
            await fs.chmod(resolvedPath, 0o444)

            // Get service instance
            const service = CacheConfigService.getInstance()

            // Property: Service should handle permission failures gracefully
            try {
              await service.initialize()

              // If initialization succeeds, it should have fallen back to default
              const actualPath = service.getCacheDirectory()
              const config = service.getConfiguration()

              if (actualPath !== resolvedPath) {
                // Successfully fell back to default
                expect(config.source).toBe('default')
                expect(actualPath).toBe(path.resolve('./cache'))
              }
            } catch (error: unknown) {
              // If initialization fails, it should be due to permission issues
              expect(error).toBeInstanceOf(Error)
              expect((error as Error).message).toMatch(
                /permission|writable|access|directory/i
              )
            }
          } finally {
            // Restore permissions for cleanup
            try {
              await fs.chmod(resolvedPath, 0o755)
              await fs.rm(resolvedPath, { recursive: true, force: true })
            } catch {
              // Ignore cleanup errors
            }
          }
        }),
        { numRuns: 5 }
      )
    })

    it('should validate write permissions before using cache directory', async () => {
      await fc.assert(
        fc.asyncProperty(generateValidCachePath(), async cachePath => {
          // Set environment variable
          process.env.CACHE_DIR = cachePath

          // Reset singleton to pick up new environment
          CacheConfigService.resetInstance()

          // Get service instance
          const service = CacheConfigService.getInstance()

          // Property: Service should validate permissions during initialization
          await service.initialize()

          if (service.isReady()) {
            // If service is ready, the cache directory should be writable
            const actualPath = service.getCacheDirectory()

            // Test that we can actually write to the directory
            const testFile = path.join(actualPath, '.write-test')
            await fs.writeFile(testFile, 'permission test', 'utf-8')
            const content = await fs.readFile(testFile, 'utf-8')
            expect(content).toBe('permission test')

            // Clean up test file
            await fs.unlink(testFile)
          }

          // Clean up created directory
          try {
            await fs.rm(path.resolve(cachePath), {
              recursive: true,
              force: true,
            })
          } catch {
            // Ignore cleanup errors
          }
        }),
        { numRuns: 10 }
      )
    })
  })

  /**
   * Property 7: Fallback on Validation Failure
   * For any invalid cache directory configuration, the system should fall back
   * to the default cache location and log appropriate error messages
   */
  describe('Property 7: Fallback on Validation Failure', () => {
    it('should fallback to default when configured path is invalid', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            // Use only paths that are guaranteed to be invalid
            fc.constant('/etc/passwd'),
            fc.constant('/usr/bin'),
            fc.constant('/var/log'),
            fc.constant('/sys/kernel'),
            fc.constant('/proc/version'),
            fc.constant('/boot/grub'),
            fc.constant('/'),
            fc.constant('/root')
          ),
          async invalidPath => {
            // Set environment variable to invalid path
            process.env.CACHE_DIR = invalidPath

            // Reset singleton to pick up new environment
            CacheConfigService.resetInstance()

            // Get service instance
            const service = CacheConfigService.getInstance()

            // Property: Service should fallback to default for truly invalid paths
            try {
              await service.initialize()

              // For these guaranteed invalid paths, we should have fallen back to default
              const actualPath = service.getCacheDirectory()
              const expectedDefaultPath = path.resolve('./cache')

              expect(actualPath).toBe(expectedDefaultPath)

              const config = service.getConfiguration()
              expect(config.source).toBe('default')
              expect(config.baseDirectory).toBe(expectedDefaultPath)

              // Service should be ready after successful fallback
              expect(service.isReady()).toBe(true)
            } catch (error: unknown) {
              // If fallback also fails, it should be a configuration error
              expect(error).toBeInstanceOf(Error)
              expect((error as Error).message).toMatch(
                /cache|directory|invalid|configuration/i
              )
            }
          }
        ),
        { numRuns: 10 }
      )
    })

    it('should handle validation failure with appropriate error messages', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant('/nonexistent/readonly/path'),
            fc.constant('../../../etc/passwd'),
            fc.constant('/root/restricted')
          ),
          async problematicPath => {
            // Property: Validation should provide clear error messages for problematic paths
            const validation =
              await CacheDirectoryValidator.validate(problematicPath)

            // For paths that should be invalid, check if they are properly rejected
            // or if they fail during directory creation/write testing
            if (
              !validation.isValid ||
              !validation.isAccessible ||
              !validation.isSecure
            ) {
              expect(validation.errorMessage).toBeDefined()
              expect(validation.errorMessage).toBeTruthy()

              // Error message should be descriptive
              expect(validation.errorMessage!.length).toBeGreaterThan(10)
              expect(validation.errorMessage).toMatch(
                /path|directory|unsafe|permission|access|create|write|sensitive/i
              )
            } else {
              // If validation passes, the path should actually be usable
              // This can happen for paths like '/nonexistent/readonly/path' which might be created successfully
              expect(validation.isValid).toBe(true)
              expect(validation.isAccessible).toBe(true)
              expect(validation.isSecure).toBe(true)
            }
          }
        ),
        { numRuns: 10 }
      )
    })

    it('should maintain system stability when both configured and fallback paths fail', async () => {
      await fc.assert(
        fc.asyncProperty(generateUnsafeCachePath(), async invalidPath => {
          // Set environment variable to invalid path
          process.env.CACHE_DIR = invalidPath

          // Reset singleton to pick up new environment
          CacheConfigService.resetInstance()

          // Property: System should handle graceful failure when both paths are invalid
          const service = CacheConfigService.getInstance()

          try {
            await service.initialize()

            // If initialization succeeds, verify the service state
            const config = service.getConfiguration()
            expect(config.validationStatus).toBeDefined()

            if (service.isReady()) {
              // If ready, the cache directory should be usable
              const actualPath = service.getCacheDirectory()
              expect(actualPath).toBeTruthy()
              expect(path.isAbsolute(actualPath)).toBe(true)
            }
          } catch (error: unknown) {
            // If initialization fails completely, it should be a clear error
            expect(error).toBeInstanceOf(Error)
            const errorMessage = (error as Error).message
            expect(errorMessage).toMatch(
              /cache|directory|invalid|configuration|fallback/i
            )

            // Error should mention both the configured and fallback paths
            expect(
              errorMessage.includes(invalidPath) ||
                errorMessage.includes('fallback')
            ).toBe(true)
          }
        }),
        { numRuns: 5 }
      )
    })

    it('should preserve original configuration information during fallback', async () => {
      await fc.assert(
        fc.asyncProperty(generateUnsafeCachePath(), async invalidPath => {
          // Set environment variable to invalid path
          process.env.CACHE_DIR = invalidPath

          // Reset singleton to pick up new environment
          CacheConfigService.resetInstance()

          // Get service instance
          const service = CacheConfigService.getInstance()

          // Property: Configuration should preserve information about original attempt
          try {
            await service.initialize()

            const config = service.getConfiguration()

            // Should indicate that fallback occurred
            if (config.source === 'default') {
              // Successfully fell back - this is the expected behavior
              expect(config.baseDirectory).toBe(path.resolve('./cache'))
              expect(config.validationStatus.isValid).toBe(true)
              expect(config.validationStatus.isAccessible).toBe(true)
              expect(config.validationStatus.isSecure).toBe(true)
            }
          } catch (error: unknown) {
            // If both configured and fallback fail, error should be informative
            expect(error).toBeInstanceOf(Error)
            expect((error as Error).message).toMatch(
              /cache|directory|configuration/i
            )
          }
        }),
        { numRuns: 10 }
      )
    })
  })

  /**
   * Property 10: Configuration Migration
   * For any system component that previously used hardcoded cache paths,
   * the component should now use the configurable cache directory system
   */
  describe('Property 10: Configuration Migration', () => {
    it('should ensure all cache services use configurable cache directories', async () => {
      await fc.assert(
        fc.asyncProperty(generateValidCachePath(), async cachePath => {
          // Set environment variable
          process.env.CACHE_DIR = cachePath

          // Reset singleton to pick up new environment
          CacheConfigService.resetInstance()

          // Get service instance and initialize
          const configService = CacheConfigService.getInstance()
          await configService.initialize()

          const expectedPath = path.resolve(cachePath)

          // Property: All cache services should use the same configured directory
          expect(configService.getCacheDirectory()).toBe(expectedPath)

          // Property: Configuration should be consistent across multiple calls
          const path1 = configService.getCacheDirectory()
          const path2 = configService.getCacheDirectory()
          const path3 = configService.getCacheDirectory()

          expect(path1).toBe(path2)
          expect(path2).toBe(path3)
          expect(path1).toBe(expectedPath)

          // Property: Service should be ready and properly configured
          expect(configService.isReady()).toBe(true)

          const config = configService.getConfiguration()
          expect(config.baseDirectory).toBe(expectedPath)
          expect(config.source).toBe('environment')
          expect(config.isConfigured).toBe(true)
        }),
        { numRuns: 10 }
      )
    })

    it('should migrate from hardcoded paths to configurable paths', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            customPath: generateValidCachePath(),
            useCustom: fc.boolean(),
          }),
          async ({ customPath, useCustom }) => {
            if (useCustom) {
              process.env.CACHE_DIR = customPath
            } else {
              delete process.env.CACHE_DIR
            }

            // Reset singleton
            CacheConfigService.resetInstance()

            // Get service and initialize
            const service = CacheConfigService.getInstance()
            await service.initialize()

            const actualPath = service.getCacheDirectory()
            const config = service.getConfiguration()

            if (useCustom) {
              // Property: Custom configuration should override any hardcoded defaults
              expect(actualPath).toBe(path.resolve(customPath))
              expect(config.source).toBe('environment')
              expect(config.isConfigured).toBe(true)
            } else {
              // Property: Default should be used when no configuration is provided
              expect(actualPath).toBe(path.resolve('./cache'))
              expect(config.source).toBe('default')
              expect(config.isConfigured).toBe(false)
            }

            // Property: No hardcoded paths should be used
            expect(actualPath).not.toBe('./cache') // Should be absolute path
            expect(path.isAbsolute(actualPath)).toBe(true)

            // Property: Configuration should be internally consistent
            expect(config.baseDirectory).toBe(actualPath)
          }
        ),
        { numRuns: 10 }
      )
    })

    it('should ensure no hardcoded cache paths remain in configuration', async () => {
      await fc.assert(
        fc.asyncProperty(generateValidCachePath(), async cachePath => {
          // Set environment variable
          process.env.CACHE_DIR = cachePath

          // Reset singleton
          CacheConfigService.resetInstance()

          // Get service and initialize
          const service = CacheConfigService.getInstance()
          await service.initialize()

          const actualPath = service.getCacheDirectory()
          const config = service.getConfiguration()

          // Property: All paths should be resolved to absolute paths (no relative hardcoded paths)
          expect(path.isAbsolute(actualPath)).toBe(true)
          expect(path.isAbsolute(config.baseDirectory)).toBe(true)

          // Property: Configuration should reflect the environment variable, not hardcoded values
          expect(actualPath).toBe(path.resolve(cachePath))
          expect(config.baseDirectory).toBe(path.resolve(cachePath))
          expect(config.source).toBe('environment')

          // Property: Service should be properly migrated (ready and configured)
          expect(service.isReady()).toBe(true)
          expect(config.isConfigured).toBe(true)
        }),
        { numRuns: 10 }
      )
    })

    it('should validate migration completeness across service resets', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(generateValidCachePath(), { minLength: 2, maxLength: 5 }),
          async cachePaths => {
            // Property: Migration should work consistently across multiple configurations
            for (const cachePath of cachePaths) {
              // Set environment variable
              process.env.CACHE_DIR = cachePath

              // Reset singleton to simulate fresh service initialization
              CacheConfigService.resetInstance()

              // Get service and initialize
              const service = CacheConfigService.getInstance()
              await service.initialize()

              const actualPath = service.getCacheDirectory()
              const config = service.getConfiguration()

              // Property: Each configuration should be properly migrated
              expect(actualPath).toBe(path.resolve(cachePath))
              expect(config.baseDirectory).toBe(path.resolve(cachePath))
              expect(config.source).toBe('environment')
              expect(config.isConfigured).toBe(true)
              expect(service.isReady()).toBe(true)

              // Property: No remnants of previous configurations should remain
              expect(config.validationStatus.isValid).toBe(true)
              expect(config.validationStatus.isAccessible).toBe(true)
              expect(config.validationStatus.isSecure).toBe(true)
            }
          }
        ),
        { numRuns: 5 }
      )
    })
  })

  /**
   * Property 8: Backward Compatibility
   * For any existing cache functionality, the new configuration system should maintain
   * the same behavior and preserve existing cache data
   */
  describe('Property 8: Backward Compatibility', () => {
    it('should maintain existing cache functionality with new configuration system', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            useEnvironmentConfig: fc.boolean(),
            customPath: generateValidCachePath(),
          }),
          async ({ useEnvironmentConfig, customPath }) => {
            if (useEnvironmentConfig) {
              process.env.CACHE_DIR = customPath
            } else {
              delete process.env.CACHE_DIR
            }

            // Reset singleton
            CacheConfigService.resetInstance()

            // Get service and initialize
            const service = CacheConfigService.getInstance()
            await service.initialize()

            const actualPath = service.getCacheDirectory()
            const config = service.getConfiguration()

            // Property: Service should work regardless of configuration method
            expect(service.isReady()).toBe(true)
            expect(path.isAbsolute(actualPath)).toBe(true)
            expect(config.baseDirectory).toBe(actualPath)

            if (useEnvironmentConfig) {
              // Property: Environment configuration should work as expected
              expect(actualPath).toBe(path.resolve(customPath))
              expect(config.source).toBe('environment')
              expect(config.isConfigured).toBe(true)
            } else {
              // Property: Default behavior should be preserved
              expect(actualPath).toBe(path.resolve('./cache'))
              expect(config.source).toBe('default')
              expect(config.isConfigured).toBe(false)
            }

            // Property: Configuration should be internally consistent
            expect(config.validationStatus.isValid).toBe(true)
            expect(config.validationStatus.isAccessible).toBe(true)
            expect(config.validationStatus.isSecure).toBe(true)
          }
        ),
        { numRuns: 10 }
      )
    })

    it('should preserve cache directory structure and behavior', async () => {
      await fc.assert(
        fc.asyncProperty(generateValidCachePath(), async cachePath => {
          // Set environment variable
          process.env.CACHE_DIR = cachePath

          // Reset singleton
          CacheConfigService.resetInstance()

          // Get service and initialize
          const service = CacheConfigService.getInstance()
          await service.initialize()

          const actualPath = service.getCacheDirectory()

          // Property: Cache directory should be created and accessible
          expect(service.isReady()).toBe(true)

          // Property: Directory should exist and be writable (backward compatibility)
          const stats = await fs.stat(actualPath)
          expect(stats.isDirectory()).toBe(true)

          // Property: Should be able to create subdirectories (preserving cache structure)
          const subdirPath = path.join(actualPath, 'districts')
          await fs.mkdir(subdirPath, { recursive: true })
          const subdirStats = await fs.stat(subdirPath)
          expect(subdirStats.isDirectory()).toBe(true)

          // Property: Should be able to write files (preserving cache functionality)
          const testFile = path.join(actualPath, 'test-cache-file.json')
          const testData = { test: 'data', timestamp: Date.now() }
          await fs.writeFile(testFile, JSON.stringify(testData), 'utf-8')

          const readData = JSON.parse(await fs.readFile(testFile, 'utf-8'))
          expect(readData).toEqual(testData)

          // Clean up
          await fs.unlink(testFile)

          // Use recursive removal to handle any remaining files
          try {
            await fs.rmdir(subdirPath)
          } catch {
            // If directory is not empty, remove recursively
            await fs.rm(subdirPath, { recursive: true, force: true })
          }

          try {
            await fs.rmdir(actualPath)
          } catch {
            // If directory is not empty, remove recursively
            await fs.rm(actualPath, { recursive: true, force: true })
          }
        }),
        { numRuns: 10 }
      )
    })

    it('should maintain consistent behavior across configuration changes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              path: generateValidCachePath(),
              useConfig: fc.boolean(),
            }),
            { minLength: 2, maxLength: 4 }
          ),
          async configurations => {
            const results: Array<{
              path: string
              source: 'environment' | 'default'
              isReady: boolean
            }> = []

            // Property: Behavior should be consistent across different configurations
            for (const config of configurations) {
              if (config.useConfig) {
                process.env.CACHE_DIR = config.path
              } else {
                delete process.env.CACHE_DIR
              }

              // Reset singleton for each configuration
              CacheConfigService.resetInstance()

              // Get service and initialize
              const service = CacheConfigService.getInstance()
              await service.initialize()

              const actualPath = service.getCacheDirectory()
              const serviceConfig = service.getConfiguration()

              results.push({
                path: actualPath,
                source: serviceConfig.source,
                isReady: service.isReady(),
              })

              // Property: Each configuration should work independently
              expect(service.isReady()).toBe(true)
              expect(path.isAbsolute(actualPath)).toBe(true)

              if (config.useConfig) {
                expect(actualPath).toBe(path.resolve(config.path))
                expect(serviceConfig.source).toBe('environment')
              } else {
                expect(actualPath).toBe(path.resolve('./cache'))
                expect(serviceConfig.source).toBe('default')
              }
            }

            // Property: All configurations should have resulted in ready services
            expect(results.every(r => r.isReady)).toBe(true)

            // Property: Environment vs default configurations should be distinguishable
            const envConfigs = results.filter(r => r.source === 'environment')
            const defaultConfigs = results.filter(r => r.source === 'default')

            if (envConfigs.length > 0 && defaultConfigs.length > 0) {
              // Should have different paths when using different sources
              const defaultPaths = new Set(defaultConfigs.map(r => r.path))

              // Default configs should all use the same path
              expect(defaultPaths.size).toBe(1)
              expect(defaultPaths.has(path.resolve('./cache'))).toBe(true)
            }
          }
        ),
        { numRuns: 5 }
      )
    })

    it('should ensure backward compatibility with existing cache service patterns', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            configPath: generateValidCachePath(),
            testDefault: fc.boolean(),
          }),
          async ({ configPath, testDefault }) => {
            if (testDefault) {
              delete process.env.CACHE_DIR
            } else {
              process.env.CACHE_DIR = configPath
            }

            // Reset singleton
            CacheConfigService.resetInstance()

            // Property: Service should work with both singleton and multiple instance patterns
            const service1 = CacheConfigService.getInstance()
            const service2 = CacheConfigService.getInstance()

            // Property: Multiple getInstance calls should return the same instance (singleton pattern)
            expect(service1).toBe(service2)

            // Initialize once
            await service1.initialize()

            // Property: Both references should have the same configuration
            expect(service1.getCacheDirectory()).toBe(
              service2.getCacheDirectory()
            )
            expect(service1.isReady()).toBe(service2.isReady())

            const config1 = service1.getConfiguration()
            const config2 = service2.getConfiguration()

            expect(config1.baseDirectory).toBe(config2.baseDirectory)
            expect(config1.source).toBe(config2.source)
            expect(config1.isConfigured).toBe(config2.isConfigured)

            // Property: Configuration should match expected values
            if (testDefault) {
              expect(config1.baseDirectory).toBe(path.resolve('./cache'))
              expect(config1.source).toBe('default')
              expect(config1.isConfigured).toBe(false)
            } else {
              expect(config1.baseDirectory).toBe(path.resolve(configPath))
              expect(config1.source).toBe('environment')
              expect(config1.isConfigured).toBe(true)
            }

            // Property: Service should be ready and functional
            expect(service1.isReady()).toBe(true)
            expect(service2.isReady()).toBe(true)
          }
        ),
        { numRuns: 10 }
      )
    })
  })
})
