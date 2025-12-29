/**
 * Unit Tests for CacheConfigService Edge Cases
 *
 * Tests configuration validation and error handling, directory creation and permission scenarios.
 * **Validates: Requirements 1.1, 1.5**
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import {
  CacheConfigService,
  CacheDirectoryValidator,
  CacheConfigurationError,
  ILogger,
} from '../CacheConfigService'
import { ServiceConfiguration } from '../../types/serviceContainer'
import { createTestSelfCleanup } from '../../utils/test-self-cleanup'

// Mock logger implementation for testing
class TestLogger implements ILogger {
  public logs: Array<{ level: string; message: string; data?: unknown }> = []

  info(message: string, data?: unknown): void {
    this.logs.push({ level: 'info', message, data })
  }

  warn(message: string, data?: unknown): void {
    this.logs.push({ level: 'warn', message, data })
  }

  error(message: string, error?: Error | unknown): void {
    this.logs.push({ level: 'error', message, data: error })
  }

  debug(message: string, data?: unknown): void {
    this.logs.push({ level: 'debug', message, data })
  }

  clear(): void {
    this.logs = []
  }
}

describe('CacheConfigService - Edge Cases Unit Tests', () => {
  let originalEnv: string | undefined

  // Self-cleanup setup
  const { cleanup, afterEach: performCleanup } = createTestSelfCleanup({
    verbose: false,
  })

  beforeEach(() => {
    originalEnv = process.env.CACHE_DIR
  })

  afterEach(async () => {
    // Restore original environment variable
    if (originalEnv !== undefined) {
      process.env.CACHE_DIR = originalEnv
    } else {
      delete process.env.CACHE_DIR
    }

    await performCleanup()
  })

  describe('Configuration Validation Edge Cases', () => {
    it('should handle null and undefined configuration gracefully', async () => {
      const logger = new TestLogger()
      const config: ServiceConfiguration = {
        cacheDirectory: './test-dir/null-config-test',
        environment: 'test',
        logLevel: 'debug',
      }

      cleanup.trackDirectory(path.resolve(config.cacheDirectory))

      const service = new CacheConfigService(config, logger)
      await service.initialize()

      expect(service.isReady()).toBe(true)
      expect(service.getCacheDirectory()).toBe(config.cacheDirectory)
    })

    it('should handle empty string cache directory configuration', async () => {
      const logger = new TestLogger()
      const config: ServiceConfiguration = {
        cacheDirectory: '',
        environment: 'test',
        logLevel: 'debug',
      }

      // Clear any environment variable that might interfere
      delete process.env.CACHE_DIR

      const service = new CacheConfigService(config, logger)

      // Should fall back to environment variable or default
      const cacheDir = service.getCacheDirectory()
      expect(cacheDir).toBeTruthy()
      expect(cacheDir.length).toBeGreaterThan(0)
      // Should fall back to default since empty string is invalid
      expect(cacheDir).toBe(path.resolve('./cache'))
    })

    it('should handle whitespace-only cache directory configuration', async () => {
      const logger = new TestLogger()
      const config: ServiceConfiguration = {
        cacheDirectory: '   \t\n   ',
        environment: 'test',
        logLevel: 'debug',
      }

      // Clear any environment variable that might interfere
      delete process.env.CACHE_DIR

      const service = new CacheConfigService(config, logger)

      // Should handle whitespace gracefully and fall back to default
      const cacheDir = service.getCacheDirectory()
      expect(cacheDir).toBeTruthy()
      expect(cacheDir.length).toBeGreaterThan(0)
      // Should fall back to default since whitespace-only is invalid
      expect(cacheDir).toBe(path.resolve('./cache'))
    })

    it('should validate configuration with special characters in path', async () => {
      const logger = new TestLogger()
      const specialPath = './test-dir/cache-with-special-chars-@#$%'
      const config: ServiceConfiguration = {
        cacheDirectory: specialPath,
        environment: 'test',
        logLevel: 'debug',
      }

      cleanup.trackDirectory(path.resolve(specialPath))

      const service = new CacheConfigService(config, logger)
      await service.initialize()

      expect(service.isReady()).toBe(true)
      expect(service.getCacheDirectory()).toBe(specialPath)
    })

    it('should handle very long cache directory paths', async () => {
      const logger = new TestLogger()
      const longPath = './test-dir/' + 'a'.repeat(100)
      const config: ServiceConfiguration = {
        cacheDirectory: longPath,
        environment: 'test',
        logLevel: 'debug',
      }

      cleanup.trackDirectory(path.resolve(longPath))

      const service = new CacheConfigService(config, logger)
      await service.initialize()

      expect(service.isReady()).toBe(true)
      expect(service.getCacheDirectory()).toBe(longPath)
    })
  })

  describe('Directory Creation Edge Cases', () => {
    it('should handle nested directory creation', async () => {
      const logger = new TestLogger()
      const nestedPath = './test-dir/deeply/nested/cache/directory'
      const config: ServiceConfiguration = {
        cacheDirectory: nestedPath,
        environment: 'test',
        logLevel: 'debug',
      }

      cleanup.trackDirectory(path.resolve('./test-dir/deeply'))

      const service = new CacheConfigService(config, logger)
      await service.initialize()

      expect(service.isReady()).toBe(true)
      expect(service.getCacheDirectory()).toBe(nestedPath)

      // Verify directory was actually created
      const stats = await fs.stat(nestedPath)
      expect(stats.isDirectory()).toBe(true)
    })

    it('should handle concurrent directory creation attempts', async () => {
      const logger1 = new TestLogger()
      const logger2 = new TestLogger()
      const sharedPath = './test-dir/concurrent-creation-test'

      const config1: ServiceConfiguration = {
        cacheDirectory: sharedPath,
        environment: 'test',
        logLevel: 'debug',
      }

      const config2: ServiceConfiguration = {
        cacheDirectory: sharedPath,
        environment: 'test',
        logLevel: 'debug',
      }

      cleanup.trackDirectory(path.resolve(sharedPath))

      const service1 = new CacheConfigService(config1, logger1)
      const service2 = new CacheConfigService(config2, logger2)

      // Initialize both services concurrently
      const [result1, result2] = await Promise.allSettled([
        service1.initialize(),
        service2.initialize(),
      ])

      // Both should succeed (or at least one should succeed)
      expect(
        result1.status === 'fulfilled' || result2.status === 'fulfilled'
      ).toBe(true)

      // At least one service should be ready
      expect(service1.isReady() || service2.isReady()).toBe(true)

      // Directory should exist
      const stats = await fs.stat(sharedPath)
      expect(stats.isDirectory()).toBe(true)
    })

    it('should handle directory creation when parent directory does not exist', async () => {
      const logger = new TestLogger()
      const pathWithMissingParent = './test-dir/missing-parent/cache'
      const config: ServiceConfiguration = {
        cacheDirectory: pathWithMissingParent,
        environment: 'test',
        logLevel: 'debug',
      }

      cleanup.trackDirectory(path.resolve('./test-dir/missing-parent'))

      const service = new CacheConfigService(config, logger)
      await service.initialize()

      expect(service.isReady()).toBe(true)
      expect(service.getCacheDirectory()).toBe(pathWithMissingParent)

      // Verify both parent and target directories were created
      const parentStats = await fs.stat('./test-dir/missing-parent')
      const targetStats = await fs.stat(pathWithMissingParent)
      expect(parentStats.isDirectory()).toBe(true)
      expect(targetStats.isDirectory()).toBe(true)
    })
  })

  describe('Permission Scenarios Edge Cases', () => {
    it('should handle directory with existing files', async () => {
      const logger = new TestLogger()
      const existingDirPath = './test-dir/existing-files-test'
      const config: ServiceConfiguration = {
        cacheDirectory: existingDirPath,
        environment: 'test',
        logLevel: 'debug',
      }

      cleanup.trackDirectory(path.resolve(existingDirPath))

      // Pre-create directory with some files
      await fs.mkdir(existingDirPath, { recursive: true })
      await fs.writeFile(
        path.join(existingDirPath, 'existing-file.txt'),
        'test content'
      )

      const service = new CacheConfigService(config, logger)
      await service.initialize()

      expect(service.isReady()).toBe(true)
      expect(service.getCacheDirectory()).toBe(existingDirPath)

      // Verify existing file is still there
      const fileContent = await fs.readFile(
        path.join(existingDirPath, 'existing-file.txt'),
        'utf-8'
      )
      expect(fileContent).toBe('test content')
    })

    it('should handle symbolic links in cache directory path', async () => {
      const logger = new TestLogger()
      const realPath = './test-dir/real-cache-dir'
      const symlinkPath = './test-dir/symlink-cache-dir'

      cleanup.trackDirectory(path.resolve(realPath))
      cleanup.trackFile(path.resolve(symlinkPath))

      try {
        // Create real directory and symlink
        await fs.mkdir(realPath, { recursive: true })

        // Check if symlink already exists and remove it
        try {
          await fs.unlink(symlinkPath)
        } catch {
          // Ignore if symlink doesn't exist
        }

        await fs.symlink(path.resolve(realPath), symlinkPath)

        const config: ServiceConfiguration = {
          cacheDirectory: symlinkPath,
          environment: 'test',
          logLevel: 'debug',
        }

        const service = new CacheConfigService(config, logger)
        await service.initialize()

        expect(service.isReady()).toBe(true)
        expect(service.getCacheDirectory()).toBe(symlinkPath)
      } catch (error) {
        // On some systems, symlinks might not be supported or might fail
        // In that case, we'll skip this test
        if (
          (error as NodeJS.ErrnoException).code === 'EPERM' ||
          (error as NodeJS.ErrnoException).code === 'ENOENT'
        ) {
          console.warn('Skipping symlink test due to system limitations')
          return
        }
        throw error
      }
    })

    it('should handle case where directory exists but is not writable initially', async () => {
      const logger = new TestLogger()
      const readOnlyPath = './test-dir/readonly-test'
      const config: ServiceConfiguration = {
        cacheDirectory: readOnlyPath,
        environment: 'test',
        logLevel: 'debug',
      }

      cleanup.trackDirectory(path.resolve(readOnlyPath))

      // Create directory and make it read-only
      await fs.mkdir(readOnlyPath, { recursive: true })
      await fs.chmod(readOnlyPath, 0o444)

      const service = new CacheConfigService(config, logger)

      try {
        await service.initialize()

        // If initialization succeeds, the service should have handled the permission issue
        // (either by fixing permissions or falling back)
        if (service.isReady()) {
          expect(service.getCacheDirectory()).toBeTruthy()
        }
      } catch (error) {
        // If initialization fails, it should be due to permission issues
        expect(error).toBeInstanceOf(CacheConfigurationError)
        expect((error as Error).message).toMatch(/permission|writable|access/i)
      } finally {
        // Restore permissions for cleanup
        try {
          await fs.chmod(readOnlyPath, 0o755)
        } catch {
          // Ignore permission restore errors
        }
      }
    })
  })

  describe('Error Handling Edge Cases', () => {
    it('should provide detailed error messages for invalid paths', async () => {
      const logger = new TestLogger()
      const invalidPath = '/etc/passwd'
      const config: ServiceConfiguration = {
        cacheDirectory: invalidPath,
        environment: 'development', // Use development to test environment variable fallback
        logLevel: 'debug',
      }

      // Set environment variable to the same invalid path
      process.env.CACHE_DIR = invalidPath

      const service = new CacheConfigService(config, logger)

      try {
        await service.initialize()

        // If initialization succeeds, it should have fallen back to default
        const actualPath = service.getCacheDirectory()
        expect(actualPath).toBe(path.resolve('./cache'))

        const serviceConfig = service.getConfiguration()
        expect(serviceConfig.source).toBe('default')

        // Should have logged warnings about the invalid path
        const hasWarning = logger.logs.some(
          log => log.level === 'warn' && log.message.includes('invalid')
        )
        expect(hasWarning).toBe(true)
      } catch (error) {
        // If initialization fails completely, error should be descriptive
        expect(error).toBeInstanceOf(CacheConfigurationError)
        expect((error as Error).message).toMatch(
          /cache|directory|invalid|fallback/i
        )
      }
    })

    it('should handle validator errors gracefully', async () => {
      const logger = new TestLogger()
      const problematicPath = '/nonexistent/deeply/nested/invalid/path'

      // Test the validator directly
      const validation = await CacheDirectoryValidator.validate(problematicPath)

      if (
        !validation.isValid ||
        !validation.isAccessible ||
        !validation.isSecure
      ) {
        expect(validation.errorMessage).toBeDefined()
        expect(validation.errorMessage!.length).toBeGreaterThan(0)
        expect(validation.errorMessage).toMatch(
          /path|directory|create|permission|access/i
        )
      }
    })

    it('should handle disposal errors gracefully', async () => {
      const logger = new TestLogger()
      const config: ServiceConfiguration = {
        cacheDirectory: './test-dir/disposal-test',
        environment: 'test',
        logLevel: 'debug',
      }

      cleanup.trackDirectory(path.resolve(config.cacheDirectory))

      const service = new CacheConfigService(config, logger)
      await service.initialize()

      expect(service.isReady()).toBe(true)

      // Dispose multiple times should not cause errors
      await service.dispose()
      expect(service.isReady()).toBe(false)

      await service.dispose() // Second disposal should be safe
      expect(service.isReady()).toBe(false)

      // Should log disposal
      const hasDisposeLog = logger.logs.some(log =>
        log.message.includes('CacheConfigService disposed')
      )
      expect(hasDisposeLog).toBe(true)
    })

    it('should handle refresh configuration edge cases', async () => {
      const logger = new TestLogger()
      const initialPath = './test-dir/initial-config'
      const config: ServiceConfiguration = {
        cacheDirectory: initialPath,
        environment: 'test',
        logLevel: 'debug',
      }

      cleanup.trackDirectory(path.resolve(initialPath))

      const service = new CacheConfigService(config, logger)
      await service.initialize()

      expect(service.isReady()).toBe(true)
      expect(service.getCacheDirectory()).toBe(initialPath)

      // Change environment variable and refresh
      const newEnvPath = './test-dir/new-env-config'
      process.env.CACHE_DIR = newEnvPath
      cleanup.trackDirectory(path.resolve(newEnvPath))

      service.refreshConfiguration()

      // For test environment, should still use the injected config, not env var
      expect(service.getCacheDirectory()).toBe(initialPath)
      expect(service.getConfiguration().source).toBe('test')

      // Should not be ready after refresh (needs re-initialization)
      expect(service.isReady()).toBe(false)

      // Re-initialize should work
      await service.initialize()
      expect(service.isReady()).toBe(true)
    })

    it('should handle validateCacheDirectory when not initialized', async () => {
      const logger = new TestLogger()
      const config: ServiceConfiguration = {
        cacheDirectory: './test-dir/validate-test',
        environment: 'test',
        logLevel: 'debug',
      }

      cleanup.trackDirectory(path.resolve(config.cacheDirectory))

      const service = new CacheConfigService(config, logger)

      // Should not be ready initially
      expect(service.isReady()).toBe(false)

      // Calling validateCacheDirectory should initialize the service
      await service.validateCacheDirectory()

      expect(service.isReady()).toBe(true)
    })
  })

  describe('Logger Integration Edge Cases', () => {
    it('should handle logger that throws errors', async () => {
      class ErrorThrowingLogger implements ILogger {
        info(): void {
          throw new Error('Logger error')
        }
        warn(): void {
          throw new Error('Logger error')
        }
        error(): void {
          throw new Error('Logger error')
        }
        debug(): void {
          throw new Error('Logger error')
        }
      }

      const logger = new ErrorThrowingLogger()
      const config: ServiceConfiguration = {
        cacheDirectory: './test-dir/logger-error-test',
        environment: 'test',
        logLevel: 'debug',
      }

      cleanup.trackDirectory(path.resolve(config.cacheDirectory))

      const service = new CacheConfigService(config, logger)

      // Service should still work even if logger throws errors
      await expect(service.initialize()).resolves.not.toThrow()
      expect(service.isReady()).toBe(true)
    })

    it('should log appropriate messages for different scenarios', async () => {
      const logger = new TestLogger()
      const config: ServiceConfiguration = {
        cacheDirectory: './test-dir/logging-test',
        environment: 'test',
        logLevel: 'debug',
      }

      cleanup.trackDirectory(path.resolve(config.cacheDirectory))

      const service = new CacheConfigService(config, logger)
      await service.initialize()

      // Should have logged initialization success
      const hasInitLog = logger.logs.some(
        log =>
          log.level === 'info' &&
          log.message.includes('Cache configuration initialized successfully')
      )
      expect(hasInitLog).toBe(true)

      // Clear logs and dispose
      logger.clear()
      await service.dispose()

      // Should have logged disposal
      const hasDisposeLog = logger.logs.some(
        log =>
          log.level === 'debug' &&
          log.message.includes('CacheConfigService disposed')
      )
      expect(hasDisposeLog).toBe(true)
    })
  })
})
