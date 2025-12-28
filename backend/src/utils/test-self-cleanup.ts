/**
 * Self-Cleanup Test Utilities
 *
 * Provides utilities for tests to clean up after themselves without relying
 * on external cleanup scripts. Each test manages its own temporary resources.
 */

import * as fs from 'fs/promises'
import * as path from 'path'

/**
 * Configuration for self-cleanup behavior
 */
export interface SelfCleanupConfig {
  /** Whether to log cleanup operations for debugging */
  verbose: boolean
  /** Whether to fail tests if cleanup fails */
  failOnCleanupError: boolean
  /** Timeout for cleanup operations in milliseconds */
  timeoutMs: number
}

/**
 * Default self-cleanup configuration
 */
export const DEFAULT_SELF_CLEANUP_CONFIG: SelfCleanupConfig = {
  verbose: false,
  failOnCleanupError: false,
  timeoutMs: 5000,
}

/**
 * Self-cleanup manager for individual tests
 * Each test instance manages its own resources and cleanup
 */
export class TestSelfCleanup {
  private directories: Set<string> = new Set()
  private files: Set<string> = new Set()
  private cleanupFunctions: Array<() => Promise<void>> = []
  private config: SelfCleanupConfig
  private isCleanedUp = false

  constructor(config: Partial<SelfCleanupConfig> = {}) {
    this.config = { ...DEFAULT_SELF_CLEANUP_CONFIG, ...config }
  }

  /**
   * Register a directory for cleanup when the test completes
   */
  trackDirectory(directory: string): void {
    if (this.isCleanedUp) {
      throw new Error('Cannot track resources after cleanup has been performed')
    }

    const resolvedPath = path.resolve(directory)
    this.directories.add(resolvedPath)

    if (this.config.verbose) {
      console.log(`Tracking directory for cleanup: ${resolvedPath}`)
    }
  }

  /**
   * Register a file for cleanup when the test completes
   */
  trackFile(filePath: string): void {
    if (this.isCleanedUp) {
      throw new Error('Cannot track resources after cleanup has been performed')
    }

    const resolvedPath = path.resolve(filePath)
    this.files.add(resolvedPath)

    if (this.config.verbose) {
      console.log(`Tracking file for cleanup: ${resolvedPath}`)
    }
  }

  /**
   * Register a custom cleanup function to run during cleanup
   */
  addCleanupFunction(cleanupFn: () => Promise<void>): void {
    if (this.isCleanedUp) {
      throw new Error(
        'Cannot add cleanup functions after cleanup has been performed'
      )
    }

    this.cleanupFunctions.push(cleanupFn)

    if (this.config.verbose) {
      console.log(
        `Added custom cleanup function (total: ${this.cleanupFunctions.length})`
      )
    }
  }

  /**
   * Perform cleanup of all tracked resources
   * This should be called in afterEach hooks
   */
  async cleanup(): Promise<void> {
    if (this.isCleanedUp) {
      if (this.config.verbose) {
        console.log('Cleanup already performed, skipping')
      }
      return
    }

    const cleanupPromise = this.performCleanup()

    // Apply timeout if configured
    if (this.config.timeoutMs > 0) {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () =>
            reject(
              new Error(`Cleanup timeout after ${this.config.timeoutMs}ms`)
            ),
          this.config.timeoutMs
        )
      })

      await Promise.race([cleanupPromise, timeoutPromise])
    } else {
      await cleanupPromise
    }

    this.isCleanedUp = true
  }

  /**
   * Reset the cleanup state to allow reuse
   * This is useful for test suites that share a cleanup instance
   */
  reset(): void {
    this.directories.clear()
    this.files.clear()
    this.cleanupFunctions.length = 0
    this.isCleanedUp = false

    if (this.config.verbose) {
      console.log('Cleanup state reset')
    }
  }

  private async performCleanup(): Promise<void> {
    const errors: Error[] = []

    // Run custom cleanup functions first
    for (const cleanupFn of this.cleanupFunctions) {
      try {
        await cleanupFn()
        if (this.config.verbose) {
          console.log('Custom cleanup function completed successfully')
        }
      } catch (error) {
        const cleanupError =
          error instanceof Error ? error : new Error(String(error))
        errors.push(cleanupError)
        if (this.config.verbose) {
          console.warn('Custom cleanup function failed:', cleanupError.message)
        }
      }
    }

    // Clean up tracked files
    for (const filePath of Array.from(this.files)) {
      try {
        await fs.unlink(filePath)
        if (this.config.verbose) {
          console.log(`Cleaned up file: ${filePath}`)
        }
      } catch (error) {
        // Only log error if file exists (ignore ENOENT)
        if (error instanceof Error && !error.message.includes('ENOENT')) {
          const cleanupError = new Error(
            `Failed to cleanup file ${filePath}: ${error.message}`
          )
          errors.push(cleanupError)
          if (this.config.verbose) {
            console.warn(cleanupError.message)
          }
        }
      }
    }

    // Clean up tracked directories
    for (const directory of Array.from(this.directories)) {
      try {
        await fs.rm(directory, { recursive: true, force: true })
        if (this.config.verbose) {
          console.log(`Cleaned up directory: ${directory}`)
        }
      } catch (error) {
        const cleanupError =
          error instanceof Error ? error : new Error(String(error))
        errors.push(
          new Error(
            `Failed to cleanup directory ${directory}: ${cleanupError.message}`
          )
        )
        if (this.config.verbose) {
          console.warn(
            `Failed to cleanup directory ${directory}:`,
            cleanupError.message
          )
        }
      }
    }

    // Handle cleanup errors based on configuration
    if (errors.length > 0) {
      const errorMessage = `Cleanup failed with ${errors.length} error(s):\n${errors.map(e => e.message).join('\n')}`

      if (this.config.failOnCleanupError) {
        throw new Error(errorMessage)
      } else if (this.config.verbose) {
        console.warn(errorMessage)
      }
    }

    // Clear tracking sets
    this.directories.clear()
    this.files.clear()
    this.cleanupFunctions.length = 0
  }

  /**
   * Get the number of resources being tracked
   */
  getTrackedResourceCount(): {
    directories: number
    files: number
    functions: number
  } {
    return {
      directories: this.directories.size,
      files: this.files.size,
      functions: this.cleanupFunctions.length,
    }
  }

  /**
   * Check if cleanup has been performed
   */
  isCleanupComplete(): boolean {
    return this.isCleanedUp
  }
}

/**
 * Create a self-cleanup manager for a test
 * Returns both the cleanup manager and a cleanup function for afterEach
 */
export function createTestSelfCleanup(
  config: Partial<SelfCleanupConfig> = {}
): {
  cleanup: TestSelfCleanup
  afterEach: () => Promise<void>
} {
  const cleanup = new TestSelfCleanup(config)

  return {
    cleanup,
    afterEach: async () => {
      await cleanup.cleanup()
      cleanup.reset() // Reset for next test
    },
  }
}

/**
 * Utility function to create a unique test directory and track it for cleanup
 */
export function createUniqueTestDir(
  cleanup: TestSelfCleanup,
  baseName: string,
  baseDir: string = './test-dir'
): string {
  // Sanitize baseName to prevent path traversal and make it readable
  const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9-_]/g, '-')

  // Use a shorter, more readable unique suffix
  const processId = process.pid.toString(36)
  const counter = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0')

  // Create a readable directory name: baseName-pid-counter
  const uniqueSuffix = `${processId}-${counter}`

  // Ensure baseDir is resolved relative to current working directory
  const resolvedBaseDir = path.resolve(process.cwd(), baseDir)
  const uniqueDir = path.resolve(
    resolvedBaseDir,
    `${sanitizedBaseName}-${uniqueSuffix}`
  )

  // Verify the directory is within the expected base directory
  if (!uniqueDir.startsWith(resolvedBaseDir)) {
    throw new Error(`Test directory path traversal detected: ${uniqueDir}`)
  }

  cleanup.trackDirectory(uniqueDir)
  return uniqueDir
}

/**
 * Utility function to create a unique test file and track it for cleanup
 */
export function createUniqueTestFile(
  cleanup: TestSelfCleanup,
  baseName: string,
  extension: string = '.tmp',
  baseDir: string = './test-dir'
): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  const uniqueFile = path.resolve(
    baseDir,
    `${baseName}-${timestamp}-${random}${extension}`
  )

  cleanup.trackFile(uniqueFile)
  return uniqueFile
}

/**
 * Wrapper for test functions that automatically handles cleanup
 * Use this to ensure cleanup happens even if the test throws an error
 */
export async function withSelfCleanup<T>(
  testFn: (cleanup: TestSelfCleanup) => Promise<T>,
  config: Partial<SelfCleanupConfig> = {}
): Promise<T> {
  const cleanup = new TestSelfCleanup(config)

  try {
    return await testFn(cleanup)
  } finally {
    await cleanup.cleanup()
  }
}

/**
 * Verify that a test directory is empty (for debugging cleanup issues)
 */
export async function verifyTestDirEmpty(
  baseDir: string = './test-dir',
  verbose: boolean = false
): Promise<{ isEmpty: boolean; remainingItems: string[] }> {
  try {
    const entries = await fs.readdir(baseDir, { withFileTypes: true })
    const remainingItems = entries.map(entry => entry.name)

    if (verbose && remainingItems.length > 0) {
      console.log(`⚠️  ${remainingItems.length} items remain in ${baseDir}:`)
      remainingItems.slice(0, 10).forEach(item => console.log(`  - ${item}`))
      if (remainingItems.length > 10) {
        console.log(`  ... and ${remainingItems.length - 10} more`)
      }
    }

    return {
      isEmpty: remainingItems.length === 0,
      remainingItems,
    }
  } catch (error) {
    // Directory doesn't exist - that's empty
    if (error instanceof Error && error.message.includes('ENOENT')) {
      return { isEmpty: true, remainingItems: [] }
    }
    throw error
  }
}
