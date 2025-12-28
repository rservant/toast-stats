/**
 * @deprecated Use test-self-cleanup.ts instead
 *
 * Comprehensive Test Cleanup Utilities
 *
 * ⚠️  DEPRECATED: This utility is for external cleanup scripts.
 * For new tests, use `test-self-cleanup.ts` which provides utilities
 * for tests to clean up after themselves in afterEach hooks.
 *
 * Provides utilities for cleaning up test directories and ensuring
 * tests don't leave behind temporary files and directories.
 *
 * @see test-self-cleanup.ts for the recommended self-cleanup approach
 */

import fs from 'fs/promises'
import path from 'path'

/**
 * Configuration for test cleanup
 */
export interface TestCleanupConfig {
  /** Base directory where test artifacts are created */
  baseDir: string
  /** Patterns to match for cleanup */
  patterns: string[]
  /** Whether to log cleanup operations */
  verbose: boolean
}

/**
 * Default cleanup configuration
 */
export const DEFAULT_CLEANUP_CONFIG: TestCleanupConfig = {
  baseDir: './test-dir',
  patterns: [
    'test-cache*',
    'test-reconciliation*',
    'test-assessment*',
    'test-*',
  ],
  verbose: false,
}

/**
 * Cleanup statistics
 */
export interface CleanupStats {
  totalFound: number
  totalCleaned: number
  totalFailed: number
  patterns: Record<string, { found: number; cleaned: number; failed: number }>
}

/**
 * Cleans up test directories matching specified patterns
 */
export async function cleanupTestDirectories(
  config: Partial<TestCleanupConfig> = {}
): Promise<CleanupStats> {
  const finalConfig = { ...DEFAULT_CLEANUP_CONFIG, ...config }
  const stats: CleanupStats = {
    totalFound: 0,
    totalCleaned: 0,
    totalFailed: 0,
    patterns: {},
  }

  // Check if base directory exists
  try {
    await fs.access(finalConfig.baseDir)
  } catch {
    if (finalConfig.verbose) {
      console.log(
        `Base directory ${finalConfig.baseDir} does not exist - nothing to clean`
      )
    }
    return stats
  }

  // Process each pattern
  for (const pattern of finalConfig.patterns) {
    const patternStats = await cleanupPattern(
      finalConfig.baseDir,
      pattern,
      finalConfig.verbose
    )
    stats.patterns[pattern] = patternStats
    stats.totalFound += patternStats.found
    stats.totalCleaned += patternStats.cleaned
    stats.totalFailed += patternStats.failed
  }

  if (finalConfig.verbose) {
    console.log(
      `Cleanup complete: ${stats.totalCleaned}/${stats.totalFound} directories cleaned`
    )
  }

  return stats
}

/**
 * Cleans up directories matching a specific pattern
 */
async function cleanupPattern(
  baseDir: string,
  pattern: string,
  verbose: boolean
): Promise<{ found: number; cleaned: number; failed: number }> {
  const stats = { found: 0, cleaned: 0, failed: 0 }

  try {
    const entries = await fs.readdir(baseDir, { withFileTypes: true })
    const matchingDirs = entries.filter(
      entry => entry.isDirectory() && matchesPattern(entry.name, pattern)
    )

    stats.found = matchingDirs.length

    if (verbose && stats.found > 0) {
      console.log(
        `Found ${stats.found} directories matching pattern: ${pattern}`
      )
    }

    // Clean up each matching directory
    for (const dir of matchingDirs) {
      const dirPath = path.join(baseDir, dir.name)
      try {
        await fs.rm(dirPath, { recursive: true, force: true })
        stats.cleaned++
        if (verbose) {
          console.log(`Cleaned: ${dirPath}`)
        }
      } catch (error) {
        stats.failed++
        if (verbose) {
          console.warn(`Failed to clean ${dirPath}:`, error)
        }
      }
    }
  } catch (error) {
    if (verbose) {
      console.warn(`Error processing pattern ${pattern}:`, error)
    }
  }

  return stats
}

/**
 * Simple pattern matching (supports * wildcard)
 */
function matchesPattern(name: string, pattern: string): boolean {
  if (pattern === '*') return true
  if (!pattern.includes('*')) return name === pattern

  // Convert pattern to regex
  const regexPattern = pattern
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape special chars
    .replace(/\\\*/g, '.*') // Convert * to .*

  const regex = new RegExp(`^${regexPattern}$`)
  return regex.test(name)
}

/**
 * Ensures a test directory is cleaned up after a test
 * Returns a cleanup function that should be called in afterEach or finally blocks
 */
export function createTestDirectoryCleanup(
  testDir: string,
  verbose: boolean = false
): () => Promise<void> {
  return async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true })
      if (verbose) {
        console.log(`Cleaned up test directory: ${testDir}`)
      }
    } catch (error) {
      if (verbose) {
        console.warn(`Failed to clean up test directory ${testDir}:`, error)
      }
      // Don't throw - cleanup failures shouldn't break tests
    }
  }
}

/**
 * Tracks test directories for cleanup
 */
export class TestDirectoryTracker {
  private directories: Set<string> = new Set()
  private verbose: boolean

  constructor(verbose: boolean = false) {
    this.verbose = verbose
  }

  /**
   * Register a directory for cleanup
   */
  track(directory: string): void {
    this.directories.add(path.resolve(directory))
    if (this.verbose) {
      console.log(`Tracking test directory: ${directory}`)
    }
  }

  /**
   * Clean up all tracked directories
   */
  async cleanup(): Promise<CleanupStats> {
    const stats: CleanupStats = {
      totalFound: this.directories.size,
      totalCleaned: 0,
      totalFailed: 0,
      patterns: {},
    }

    for (const dir of this.directories) {
      try {
        await fs.rm(dir, { recursive: true, force: true })
        stats.totalCleaned++
        if (this.verbose) {
          console.log(`Cleaned tracked directory: ${dir}`)
        }
      } catch (error) {
        stats.totalFailed++
        if (this.verbose) {
          console.warn(`Failed to clean tracked directory ${dir}:`, error)
        }
      }
    }

    this.directories.clear()
    return stats
  }

  /**
   * Get count of tracked directories
   */
  getTrackedCount(): number {
    return this.directories.size
  }
}

/**
 * Global test directory tracker instance
 */
export const globalTestTracker = new TestDirectoryTracker()

/**
 * Utility to ensure test-dir is empty after tests
 * This can be used in global test teardown
 */
export async function ensureTestDirEmpty(
  baseDir: string = './test-dir',
  verbose: boolean = false
): Promise<boolean> {
  try {
    const entries = await fs.readdir(baseDir, { withFileTypes: true })
    const directories = entries.filter(entry => entry.isDirectory())

    if (directories.length === 0) {
      if (verbose) {
        console.log(`✅ ${baseDir} is clean`)
      }
      return true
    }

    if (verbose) {
      console.log(`⚠️  ${directories.length} directories remain in ${baseDir}:`)
      directories.slice(0, 10).forEach(dir => console.log(`  - ${dir.name}`))
      if (directories.length > 10) {
        console.log(`  ... and ${directories.length - 10} more`)
      }
    }

    return false
  } catch {
    // Directory doesn't exist - that's clean
    return true
  }
}
