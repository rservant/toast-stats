/**
 * Test Cache Helper Utilities
 *
 * Provides utilities for configurable cache directories in tests,
 * supporting test isolation and parallel execution.
 */

import fs from 'fs/promises'
import path from 'path'
import { deterministicSafeString } from './test-string-generators'
import { getTestServiceFactory } from '../services/TestServiceFactory.js'

export interface TestCacheConfig {
  testId: string
  cacheDir: string
  originalCacheDir?: string
}

/**
 * Creates an isolated cache directory for a test
 */
export async function createTestCacheConfig(
  testName: string
): Promise<TestCacheConfig> {
  // Generate unique test ID using deterministic approach
  const timestamp = Date.now()
  const deterministicId = deterministicSafeString(
    timestamp + testName.length,
    7
  )
  const testId = `${testName}-${timestamp}-${deterministicId}`

  // Create test-specific cache directory in dedicated test directory
  const testBaseDir = path.resolve('./test-dir')
  const cacheDir = path.resolve(testBaseDir, `test-cache-${testId}`)

  // Ensure test base directory and cache directory exist
  await fs.mkdir(testBaseDir, { recursive: true })
  await fs.mkdir(cacheDir, { recursive: true })

  // Store original CACHE_DIR
  const originalCacheDir = process.env.CACHE_DIR

  // Set test cache directory
  process.env.CACHE_DIR = cacheDir

  // No need to reset singleton - using dependency injection

  return {
    testId,
    cacheDir,
    originalCacheDir,
  }
}

/**
 * Cleans up test cache configuration
 */
export async function cleanupTestCacheConfig(
  config: TestCacheConfig
): Promise<void> {
  try {
    // Restore original CACHE_DIR
    if (config.originalCacheDir !== undefined) {
      process.env.CACHE_DIR = config.originalCacheDir
    } else {
      delete process.env.CACHE_DIR
    }

    // No need to reset singleton - using dependency injection

    // Clean up test cache directory
    await fs.rm(config.cacheDir, { recursive: true, force: true })
  } catch (error) {
    // Ignore cleanup errors
    console.warn(`Failed to cleanup test cache ${config.cacheDir}:`, error)
  }
}

/**
 * Creates multiple isolated cache configurations for parallel testing
 */
export async function createParallelTestCacheConfigs(
  testName: string,
  count: number
): Promise<TestCacheConfig[]> {
  const configs: TestCacheConfig[] = []

  for (let i = 0; i < count; i++) {
    const config = await createTestCacheConfig(`${testName}-${i}`)
    configs.push(config)
  }

  return configs
}

/**
 * Cleans up multiple test cache configurations
 */
export async function cleanupParallelTestCacheConfigs(
  configs: TestCacheConfig[]
): Promise<void> {
  await Promise.all(configs.map(config => cleanupTestCacheConfig(config)))
}

/**
 * Ensures test cache directory is properly initialized
 */
export async function initializeTestCache(
  config: TestCacheConfig
): Promise<void> {
  // Set environment variable
  process.env.CACHE_DIR = config.cacheDir

  // Ensure the cache directory exists
  await fs.mkdir(config.cacheDir, { recursive: true })

  // Create and initialize cache config service using dependency injection
  const testFactory = getTestServiceFactory()
  const cacheConfigService = testFactory.createCacheConfigService({
    cacheDirectory: config.cacheDir,
    environment: 'test',
    logLevel: 'error',
  })
  await cacheConfigService.initialize()

  // Verify configuration
  if (!cacheConfigService.isReady()) {
    throw new Error(`Failed to initialize test cache: ${config.cacheDir}`)
  }
}

/**
 * Gets a configured cache directory for the current test environment
 */
export function getTestCacheDirectory(): string {
  const testFactory = getTestServiceFactory()
  const cacheConfigService = testFactory.createCacheConfigService()
  return cacheConfigService.getCacheDirectory()
}

/**
 * Verifies that test cache directories are properly isolated
 */
export async function verifyTestCacheIsolation(
  configs: TestCacheConfig[]
): Promise<void> {
  // Verify all cache directories are different
  const cacheDirs = configs.map(config => config.cacheDir)
  const uniqueCacheDirs = new Set(cacheDirs)

  if (uniqueCacheDirs.size !== configs.length) {
    throw new Error('Test cache directories are not properly isolated')
  }

  // Verify all directories exist
  for (const config of configs) {
    try {
      await fs.access(config.cacheDir)
    } catch {
      throw new Error(`Test cache directory does not exist: ${config.cacheDir}`)
    }
  }
}

/**
 * Ensures parent directories exist for a given file path
 */
export async function ensureParentDirectoryExists(
  filePath: string
): Promise<void> {
  const parentDir = path.dirname(filePath)
  await fs.mkdir(parentDir, { recursive: true })
}

/**
 * Creates a test file with proper directory structure
 */
export async function createTestFile(
  filePath: string,
  content: string = ''
): Promise<void> {
  await ensureParentDirectoryExists(filePath)
  await fs.writeFile(filePath, content)
}

/**
 * Ensures a directory exists, creating it and all parent directories if necessary
 */
export async function ensureDirectoryExists(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true })
}

/**
 * Safely removes a file, ignoring errors if the file doesn't exist
 */
export async function safeRemoveFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath)
  } catch (error) {
    // Ignore ENOENT errors (file doesn't exist)
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }
}
