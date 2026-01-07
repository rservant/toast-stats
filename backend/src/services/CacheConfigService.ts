/**
 * Cache Configuration Service
 *
 * Centralized service for managing cache directory configuration across the entire application.
 * Provides a single source of truth for cache directory paths using the CACHE_DIR environment variable.
 *
 * Features:
 * - Singleton pattern for consistent configuration
 * - Environment variable support with fallback
 * - Path security validation to prevent traversal attacks
 * - Write permission verification
 * - Automatic directory creation
 */

import fs from 'fs/promises'
import path from 'path'
import { ServiceConfiguration } from '../types/serviceContainer.js'
import { ICacheConfigService, ILogger } from '../types/serviceInterfaces.js'

export interface CacheDirectoryValidation {
  isValid: boolean
  isAccessible: boolean
  isSecure: boolean
  errorMessage?: string
}

export class CacheDirectoryValidator {
  /**
   * Validate cache directory path for security and accessibility
   */
  static async validate(
    cacheDir: string,
    environment: 'test' | 'development' | 'production' = 'production'
  ): Promise<CacheDirectoryValidation> {
    try {
      // Check for path traversal attempts
      const normalizedPath = path.resolve(cacheDir)

      // Reject paths containing dangerous patterns
      if (
        cacheDir.includes('..') ||
        cacheDir.includes('~') ||
        normalizedPath.includes('..') ||
        normalizedPath === '/' ||
        normalizedPath === path.parse(normalizedPath).root
      ) {
        return {
          isValid: false,
          isAccessible: false,
          isSecure: false,
          errorMessage:
            'Cache directory path contains unsafe patterns or points to system root',
        }
      }

      // Check if path is secure (not pointing to sensitive system directories)
      const sensitiveDirectories = ['/etc', '/usr', '/sys', '/proc', '/boot']

      // In test environment, allow /var directories (for temporary directories)
      if (environment !== 'test') {
        sensitiveDirectories.push('/var')
      }

      const isSystemPath = sensitiveDirectories.some(dir =>
        normalizedPath.startsWith(dir)
      )

      // Additional check for test environment: allow temporary directories
      const isTempDirectory =
        environment === 'test' &&
        (normalizedPath.startsWith('/tmp') ||
          normalizedPath.startsWith('/var/folders') || // macOS temp dirs
          normalizedPath.includes('/tmp/') ||
          normalizedPath.includes('test-'))

      if (isSystemPath && !isTempDirectory) {
        return {
          isValid: false,
          isAccessible: false,
          isSecure: false,
          errorMessage:
            'Cache directory path is unsafe: points to sensitive system directory',
        }
      }

      // Try to create directory if it doesn't exist
      try {
        // Ensure parent directory exists first
        const parentDir = path.dirname(normalizedPath)
        if (parentDir !== normalizedPath) {
          await fs.mkdir(parentDir, { recursive: true })
        }
        await fs.mkdir(normalizedPath, { recursive: true })
      } catch (error) {
        const err = error as { code?: string }
        // Ignore EEXIST errors (directory already exists)
        if (err.code !== 'EEXIST') {
          return {
            isValid: true,
            isAccessible: false,
            isSecure: true,
            errorMessage: `Cannot create directory: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }
        }
      }

      // Test write permissions with retry logic for race conditions
      let writeTestPassed = false
      let lastError: Error | null = null

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const testFile = path.join(
            normalizedPath,
            `.cache-test-write-${Date.now()}-${attempt}`
          )
          await fs.writeFile(testFile, 'test', 'utf-8')
          await fs.unlink(testFile)
          writeTestPassed = true
          break
        } catch (error) {
          lastError = error as Error
          // Wait a bit before retrying to handle race conditions
          if (attempt < 2) {
            await new Promise(resolve => setTimeout(resolve, 10))
          }
        }
      }

      if (!writeTestPassed) {
        return {
          isValid: true,
          isAccessible: false,
          isSecure: true,
          errorMessage: `Directory is not writable: ${lastError?.message || 'Unknown error'}`,
        }
      }

      return {
        isValid: true,
        isAccessible: true,
        isSecure: true,
      }
    } catch (error) {
      return {
        isValid: false,
        isAccessible: false,
        isSecure: false,
        errorMessage: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
    }
  }
}

export class CacheConfigurationError extends Error {
  constructor(
    message: string,
    public readonly configuredPath?: string,
    public readonly fallbackPath?: string
  ) {
    super(message)
    this.name = 'CacheConfigurationError'
  }
}

export interface CacheConfiguration {
  baseDirectory: string
  isConfigured: boolean
  source: 'environment' | 'default' | 'test'
  validationStatus: CacheDirectoryValidation
}

export class CacheConfigService implements ICacheConfigService {
  private cacheDir: string
  private readonly configuration: CacheConfiguration
  private initialized: boolean = false

  constructor(
    private config: ServiceConfiguration,
    private logger: ILogger
  ) {
    this.cacheDir = this.resolveCacheDirectory()
    const envCacheDir = process.env['CACHE_DIR']
    const isConfigured = !!(envCacheDir && envCacheDir.trim())

    // Determine source based on environment and configuration
    let source: 'environment' | 'default' | 'test'
    if (this.config.environment === 'test') {
      source = 'test'
    } else if (isConfigured) {
      source = 'environment'
    } else {
      source = 'default'
    }

    this.configuration = {
      baseDirectory: this.cacheDir,
      isConfigured,
      source,
      validationStatus: {
        isValid: false,
        isAccessible: false,
        isSecure: false,
      },
    }
  }

  /**
   * Get the configured cache directory path
   */
  getCacheDirectory(): string {
    return this.cacheDir
  }

  /**
   * Get the complete cache configuration
   */
  getConfiguration(): CacheConfiguration {
    return { ...this.configuration }
  }

  /**
   * Initialize and validate the cache directory
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    // Refresh configuration from environment variables in case they changed
    this.refreshConfiguration()

    try {
      // Validate the cache directory
      const validation = await CacheDirectoryValidator.validate(
        this.cacheDir,
        this.config.environment
      )
      this.configuration.validationStatus = validation

      if (
        !validation.isValid ||
        !validation.isAccessible ||
        !validation.isSecure
      ) {
        const errorMessage =
          validation.errorMessage || 'Cache directory validation failed'

        // If configured path is invalid, try fallback
        if (this.configuration.source === 'environment') {
          this.logger.warn(
            'Configured cache directory is invalid, falling back to default',
            {
              configuredPath: this.cacheDir,
              error: errorMessage,
            }
          )

          // Try default fallback
          const fallbackPath = path.resolve('./cache')
          const fallbackValidation = await CacheDirectoryValidator.validate(
            fallbackPath,
            this.config.environment
          )

          if (
            fallbackValidation.isValid &&
            fallbackValidation.isAccessible &&
            fallbackValidation.isSecure
          ) {
            // Update configuration to use fallback
            Object.assign(this.configuration, {
              baseDirectory: fallbackPath,
              source: 'default' as const,
              validationStatus: fallbackValidation,
            })

            // Update internal cache directory
            this.cacheDir = fallbackPath

            this.logger.info(
              'Successfully fell back to default cache directory',
              {
                fallbackPath,
              }
            )
          } else {
            throw new CacheConfigurationError(
              `Both configured and fallback cache directories are invalid: ${errorMessage}`,
              this.cacheDir,
              fallbackPath
            )
          }
        } else {
          throw new CacheConfigurationError(
            `Default cache directory is invalid: ${errorMessage}`,
            this.cacheDir
          )
        }
      }

      this.initialized = true
      try {
        this.logger.info('Cache configuration initialized successfully', {
          cacheDirectory: this.cacheDir,
          source: this.configuration.source,
          isConfigured: this.configuration.isConfigured,
        })
      } catch {
        // Ignore logger errors to prevent them from breaking the service
      }
    } catch (error) {
      try {
        this.logger.error('Failed to initialize cache configuration', {
          cacheDirectory: this.cacheDir,
          error,
        })
      } catch {
        // Ignore logger errors to prevent them from breaking the service
      }
      throw error
    }
  }

  /**
   * Validate that the cache directory is properly configured and accessible
   */
  async validateCacheDirectory(): Promise<void> {
    if (!this.initialized) {
      await this.initialize()
    }

    const validation = this.configuration.validationStatus
    if (
      !validation.isValid ||
      !validation.isAccessible ||
      !validation.isSecure
    ) {
      throw new CacheConfigurationError(
        validation.errorMessage || 'Cache directory validation failed',
        this.cacheDir
      )
    }
  }

  /**
   * Check if the cache configuration is ready for use
   */
  isReady(): boolean {
    return (
      this.initialized &&
      this.configuration.validationStatus.isValid &&
      this.configuration.validationStatus.isAccessible &&
      this.configuration.validationStatus.isSecure
    )
  }

  /**
   * Resolve cache directory from environment variable or default
   */
  private resolveCacheDirectory(): string {
    // For test environment, use the configured cache directory if it's valid
    if (this.config.environment === 'test') {
      const configDir = this.config.cacheDirectory
      if (configDir && configDir.trim()) {
        return configDir
      }
    }

    const envCacheDir = process.env['CACHE_DIR']
    if (envCacheDir && envCacheDir.trim()) {
      return path.resolve(envCacheDir.trim())
    }
    return path.resolve('./cache')
  }

  /**
   * Refresh configuration from environment variables
   * This is useful when environment variables are loaded after the service is instantiated
   */
  refreshConfiguration(): void {
    const newCacheDir = this.resolveCacheDirectory()
    const envCacheDir = process.env['CACHE_DIR']
    const isConfigured = !!(envCacheDir && envCacheDir.trim())

    // Update the cache directory if it changed
    this.cacheDir = newCacheDir

    // Determine source based on environment and configuration
    let source: 'environment' | 'default' | 'test'
    if (this.config.environment === 'test') {
      source = 'test'
    } else if (isConfigured) {
      source = 'environment'
    } else {
      source = 'default'
    }

    // Update configuration
    this.configuration.baseDirectory = newCacheDir
    this.configuration.isConfigured = isConfigured
    this.configuration.source = source

    // Reset validation status
    this.configuration.validationStatus = {
      isValid: false,
      isAccessible: false,
      isSecure: false,
    }

    // Reset initialization status so it will re-validate
    this.initialized = false
  }

  /**
   * Dispose of the service and clean up resources
   */
  async dispose(): Promise<void> {
    // Reset initialization status
    this.initialized = false

    // Reset validation status
    this.configuration.validationStatus = {
      isValid: false,
      isAccessible: false,
      isSecure: false,
    }

    try {
      this.logger.debug('CacheConfigService disposed')
    } catch {
      // Ignore logger errors to prevent them from breaking the service
    }
  }
}
