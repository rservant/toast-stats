/**
 * Cache Management Utilities
 *
 * Provides utilities for cache initialization validation, directory existence checks,
 * meaningful error messages, and test cleanup operations.
 */

import { promises as fs } from 'fs'
import path from 'path'
import { logger } from './logger.js'

interface ErrnoException extends Error {
  code?: string
  errno?: number
}

/**
 * Cache initialization validation result
 */
export interface CacheInitializationResult {
  isValid: boolean
  isInitialized: boolean
  errorMessage?: string
  validationDetails: {
    directoryExists: boolean
    isWritable: boolean
    isReadable: boolean
    hasCorrectPermissions: boolean
  }
}

/**
 * Cache cleanup options
 */
export interface CacheCleanupOptions {
  removeDirectories?: boolean
  removeFiles?: boolean
  recursive?: boolean
  dryRun?: boolean
  verbose?: boolean
}

/**
 * Cache management error with detailed context
 */
export class CacheManagementError extends Error {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly cachePath: string,
    public readonly cause?: Error
  ) {
    super(message)
    this.name = 'CacheManagementError'
  }
}

/**
 * Validate cache initialization with comprehensive checks
 */
export async function validateCacheInitialization(
  cachePath: string
): Promise<CacheInitializationResult> {
  const result: CacheInitializationResult = {
    isValid: false,
    isInitialized: false,
    validationDetails: {
      directoryExists: false,
      isWritable: false,
      isReadable: false,
      hasCorrectPermissions: false,
    },
  }

  try {
    // Check if directory exists
    try {
      const stats = await fs.stat(cachePath)
      result.validationDetails.directoryExists = stats.isDirectory()

      if (!result.validationDetails.directoryExists) {
        result.errorMessage = `Cache path exists but is not a directory: ${cachePath}`
        return result
      }
    } catch (error) {
      if ((error as ErrnoException).code === 'ENOENT') {
        result.errorMessage = `Cache directory does not exist: ${cachePath}`
        return result
      }
      throw error
    }

    // Check read permissions
    try {
      await fs.access(cachePath, fs.constants.R_OK)
      result.validationDetails.isReadable = true
    } catch {
      result.errorMessage = `Cache directory is not readable: ${cachePath}`
      return result
    }

    // Check write permissions
    try {
      await fs.access(cachePath, fs.constants.W_OK)
      result.validationDetails.isWritable = true
    } catch {
      result.errorMessage = `Cache directory is not writable: ${cachePath}`
      return result
    }

    // Test actual write capability with a temporary file
    try {
      const testFile = path.join(cachePath, `.cache-test-${Date.now()}`)
      await fs.writeFile(testFile, 'test', 'utf-8')
      await fs.unlink(testFile)
      result.validationDetails.hasCorrectPermissions = true
    } catch (error) {
      result.errorMessage = `Cannot write to cache directory: ${cachePath}. ${(error as Error).message}`
      return result
    }

    // All checks passed
    result.isValid = true
    result.isInitialized = true

    return result
  } catch (error) {
    result.errorMessage = `Cache validation failed: ${(error as Error).message}`
    return result
  }
}

/**
 * Ensure cache directory exists and is properly initialized
 */
export async function ensureCacheDirectoryExists(
  cachePath: string,
  createIfMissing: boolean = true
): Promise<void> {
  try {
    // Check if directory already exists
    const validation = await validateCacheInitialization(cachePath)

    if (validation.isValid && validation.isInitialized) {
      logger.debug('Cache directory already exists and is valid', { cachePath })
      return
    }

    if (!validation.validationDetails.directoryExists && createIfMissing) {
      // Create directory with proper permissions
      await fs.mkdir(cachePath, { recursive: true, mode: 0o755 })
      logger.info('Cache directory created', { cachePath })

      // Validate the newly created directory
      const newValidation = await validateCacheInitialization(cachePath)
      if (!newValidation.isValid) {
        throw new CacheManagementError(
          `Failed to create valid cache directory: ${newValidation.errorMessage}`,
          'create_directory',
          cachePath
        )
      }
    } else if (!validation.validationDetails.directoryExists) {
      throw new CacheManagementError(
        `Cache directory does not exist and creation is disabled: ${cachePath}`,
        'check_directory',
        cachePath
      )
    } else {
      throw new CacheManagementError(
        `Cache directory validation failed: ${validation.errorMessage}`,
        'validate_directory',
        cachePath
      )
    }
  } catch (error) {
    if (error instanceof CacheManagementError) {
      throw error
    }

    throw new CacheManagementError(
      `Failed to ensure cache directory exists: ${(error as Error).message}`,
      'ensure_directory',
      cachePath,
      error as Error
    )
  }
}

/**
 * Clean up cache directory with various options
 */
export async function cleanupCacheDirectory(
  cachePath: string,
  options: CacheCleanupOptions = {}
): Promise<{ filesRemoved: number; directoriesRemoved: number }> {
  const {
    removeDirectories = false,
    removeFiles = true,
    recursive = false,
    dryRun = false,
    verbose = false,
  } = options

  let filesRemoved = 0
  let directoriesRemoved = 0

  try {
    // Check if directory exists
    try {
      await fs.access(cachePath)
    } catch {
      if (verbose) {
        logger.info('Cache directory does not exist, nothing to clean up', {
          cachePath,
        })
      }
      return { filesRemoved, directoriesRemoved }
    }

    // Get directory contents
    const entries = await fs.readdir(cachePath, { withFileTypes: true })

    for (const entry of entries) {
      const entryPath = path.join(cachePath, entry.name)

      if (entry.isFile() && removeFiles) {
        if (verbose) {
          logger.debug(`${dryRun ? 'Would remove' : 'Removing'} file`, {
            path: entryPath,
          })
        }

        if (!dryRun) {
          await fs.unlink(entryPath)
        }
        filesRemoved++
      } else if (entry.isDirectory()) {
        if (recursive) {
          // Recursively clean subdirectory
          const subResult = await cleanupCacheDirectory(entryPath, options)
          filesRemoved += subResult.filesRemoved
          directoriesRemoved += subResult.directoriesRemoved
        }

        if (removeDirectories) {
          if (verbose) {
            logger.debug(`${dryRun ? 'Would remove' : 'Removing'} directory`, {
              path: entryPath,
            })
          }

          if (!dryRun) {
            try {
              await fs.rmdir(entryPath)
              directoriesRemoved++
            } catch (error) {
              if (
                (error as ErrnoException).code === 'ENOTEMPTY' &&
                !recursive
              ) {
                logger.warn('Directory not empty, skipping removal', {
                  path: entryPath,
                })
              } else {
                throw error
              }
            }
          } else {
            directoriesRemoved++
          }
        }
      }
    }

    if (verbose) {
      logger.info('Cache cleanup completed', {
        cachePath,
        filesRemoved,
        directoriesRemoved,
        dryRun,
      })
    }

    return { filesRemoved, directoriesRemoved }
  } catch (error) {
    throw new CacheManagementError(
      `Failed to clean up cache directory: ${(error as Error).message}`,
      'cleanup_directory',
      cachePath,
      error as Error
    )
  }
}

/**
 * Get cache directory statistics
 */
export async function getCacheDirectoryStats(cachePath: string): Promise<{
  exists: boolean
  totalFiles: number
  totalDirectories: number
  totalSize: number
  lastModified?: Date
}> {
  const stats = {
    exists: false,
    totalFiles: 0,
    totalDirectories: 0,
    totalSize: 0,
    lastModified: undefined as Date | undefined,
  }

  try {
    // Check if directory exists
    const dirStats = await fs.stat(cachePath)
    stats.exists = true
    stats.lastModified = dirStats.mtime

    // Recursively count files and calculate size
    async function countEntries(dirPath: string): Promise<void> {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })

      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name)

        if (entry.isFile()) {
          stats.totalFiles++
          const fileStats = await fs.stat(entryPath)
          stats.totalSize += fileStats.size

          // Update last modified if this file is newer
          if (!stats.lastModified || fileStats.mtime > stats.lastModified) {
            stats.lastModified = fileStats.mtime
          }
        } else if (entry.isDirectory()) {
          stats.totalDirectories++
          await countEntries(entryPath)
        }
      }
    }

    await countEntries(cachePath)
  } catch (error) {
    if ((error as ErrnoException).code !== 'ENOENT') {
      throw new CacheManagementError(
        `Failed to get cache directory statistics: ${(error as Error).message}`,
        'get_stats',
        cachePath,
        error as Error
      )
    }
  }

  return stats
}

/**
 * Create a test cache cleanup utility for use in tests
 */
export function createTestCacheCleanup(baseCachePath: string): {
  trackDirectory: (dirPath: string) => void
  trackFile: (filePath: string) => void
  cleanup: () => Promise<void>
  getTrackedPaths: () => { directories: string[]; files: string[] }
} {
  const createdDirectories: string[] = []
  const createdFiles: string[] = []

  return {
    /**
     * Track a directory for cleanup
     */
    trackDirectory(dirPath: string): void {
      const resolvedPath = path.resolve(baseCachePath, dirPath)
      if (!createdDirectories.includes(resolvedPath)) {
        createdDirectories.push(resolvedPath)
      }
    },

    /**
     * Track a file for cleanup
     */
    trackFile(filePath: string): void {
      const resolvedPath = path.resolve(baseCachePath, filePath)
      if (!createdFiles.includes(resolvedPath)) {
        createdFiles.push(resolvedPath)
      }
    },

    /**
     * Clean up all tracked resources
     */
    async cleanup(): Promise<void> {
      // Clean up files first
      for (const filePath of createdFiles) {
        try {
          await fs.unlink(filePath)
        } catch (error) {
          if ((error as ErrnoException).code !== 'ENOENT') {
            logger.warn('Failed to clean up test file', { filePath, error })
          }
        }
      }

      // Clean up directories (in reverse order to handle nested directories)
      for (const dirPath of createdDirectories.reverse()) {
        try {
          await cleanupCacheDirectory(dirPath, {
            removeDirectories: true,
            removeFiles: true,
            recursive: true,
          })

          // Also try to remove the directory itself if it still exists
          try {
            await fs.rmdir(dirPath)
          } catch {
            // Ignore if already removed
          }
        } catch (error) {
          logger.warn('Failed to clean up test directory', { dirPath, error })
        }
      }

      // Clear tracking arrays
      createdDirectories.length = 0
      createdFiles.length = 0
    },

    /**
     * Get tracked paths for inspection
     */
    getTrackedPaths(): { directories: string[]; files: string[] } {
      return {
        directories: [...createdDirectories],
        files: [...createdFiles],
      }
    },
  }
}

/**
 * Validate cache manager initialization with detailed error reporting
 */
export async function validateCacheManagerInitialization(
  cacheManager: { init?: () => Promise<void> },
  cachePath: string
): Promise<{ isInitialized: boolean; errorMessage?: string }> {
  try {
    // First validate the cache directory
    const dirValidation = await validateCacheInitialization(cachePath)
    if (!dirValidation.isValid) {
      return {
        isInitialized: false,
        errorMessage: `Cache directory validation failed: ${dirValidation.errorMessage}`,
      }
    }

    // If the cache manager has an init method, call it
    if (cacheManager.init) {
      await cacheManager.init()
    }

    return { isInitialized: true }
  } catch (error) {
    return {
      isInitialized: false,
      errorMessage: `Cache manager initialization failed: ${(error as Error).message}`,
    }
  }
}
