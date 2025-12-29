/**
 * Test Isolation Manager
 *
 * Manages test environment isolation including directory creation,
 * environment variable management, and resource cleanup.
 */

import { promises as fs } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

/**
 * Test isolation manager interface
 */
export interface TestIsolationManager {
  setupTestEnvironment(): Promise<void>
  cleanupTestEnvironment(): Promise<void>
  createIsolatedDirectory(): Promise<string>
  removeIsolatedDirectory(path: string): Promise<void>
  resetEnvironmentVariables(): void
}

/**
 * Default implementation of test isolation manager
 */
export class DefaultTestIsolationManager implements TestIsolationManager {
  private isolatedDirectories: string[] = []
  private originalEnvVars: Record<string, string | undefined> = {}

  /**
   * Setup test environment with isolation
   */
  async setupTestEnvironment(): Promise<void> {
    // Store original environment variables
    this.storeOriginalEnvironmentVariables()

    // Set test-specific environment variables
    this.setTestEnvironmentVariables()
  }

  /**
   * Cleanup test environment and restore original state
   */
  async cleanupTestEnvironment(): Promise<void> {
    // Clean up isolated directories
    await this.cleanupIsolatedDirectories()

    // Restore original environment variables
    this.restoreOriginalEnvironmentVariables()
  }

  /**
   * Create an isolated directory for test use
   */
  async createIsolatedDirectory(): Promise<string> {
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substring(2, 8)
    const dirName = `test-${timestamp}-${randomSuffix}`
    const dirPath = join(tmpdir(), dirName)

    try {
      await fs.mkdir(dirPath, { recursive: true })
      this.isolatedDirectories.push(dirPath)
      return dirPath
    } catch (error) {
      throw new Error(`Failed to create isolated directory: ${error}`)
    }
  }

  /**
   * Remove a specific isolated directory
   */
  async removeIsolatedDirectory(path: string): Promise<void> {
    try {
      await fs.rm(path, { recursive: true, force: true })

      // Remove from tracking array
      const index = this.isolatedDirectories.indexOf(path)
      if (index > -1) {
        this.isolatedDirectories.splice(index, 1)
      }
    } catch (error) {
      console.warn(`Failed to remove isolated directory ${path}:`, error)
    }
  }

  /**
   * Reset environment variables to test-safe values
   */
  resetEnvironmentVariables(): void {
    // Store current values before resetting
    this.storeOriginalEnvironmentVariables()

    // Set test-specific values
    this.setTestEnvironmentVariables()
  }

  /**
   * Store original environment variables
   */
  private storeOriginalEnvironmentVariables(): void {
    const envVarsToStore = [
      'NODE_ENV',
      'CACHE_DIRECTORY',
      'LOG_LEVEL',
      'DATABASE_URL',
      'API_BASE_URL',
    ]

    for (const varName of envVarsToStore) {
      if (!(varName in this.originalEnvVars)) {
        this.originalEnvVars[varName] = process.env[varName]
      }
    }
  }

  /**
   * Set test-specific environment variables
   */
  private setTestEnvironmentVariables(): void {
    process.env.NODE_ENV = 'test'
    process.env.LOG_LEVEL = 'error'

    // Set test-specific cache directory if not already set
    if (!process.env.CACHE_DIRECTORY) {
      process.env.CACHE_DIRECTORY = join(tmpdir(), 'test-cache')
    }
  }

  /**
   * Restore original environment variables
   */
  private restoreOriginalEnvironmentVariables(): void {
    for (const [varName, originalValue] of Object.entries(
      this.originalEnvVars
    )) {
      if (originalValue === undefined) {
        delete process.env[varName]
      } else {
        process.env[varName] = originalValue
      }
    }

    // Clear stored values
    this.originalEnvVars = {}
  }

  /**
   * Clean up all isolated directories
   */
  private async cleanupIsolatedDirectories(): Promise<void> {
    const cleanupPromises = this.isolatedDirectories.map(dir =>
      this.removeIsolatedDirectory(dir)
    )

    await Promise.all(cleanupPromises)
    this.isolatedDirectories = []
  }
}

/**
 * Global test isolation manager instance
 */
let globalIsolationManager: DefaultTestIsolationManager | null = null

/**
 * Get or create the global test isolation manager
 */
export function getTestIsolationManager(): TestIsolationManager {
  if (!globalIsolationManager) {
    globalIsolationManager = new DefaultTestIsolationManager()
  }
  return globalIsolationManager
}

/**
 * Reset the global test isolation manager
 */
export async function resetTestIsolationManager(): Promise<void> {
  if (globalIsolationManager) {
    await globalIsolationManager.cleanupTestEnvironment()
    globalIsolationManager = null
  }
}
