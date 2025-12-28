/**
 * Global test cleanup utilities for frontend
 *
 * Provides cleanup mechanisms that run after all tests to ensure
 * no leftover test directories remain in the filesystem.
 */

import * as fs from 'fs/promises'
import * as path from 'path'

/**
 * Clean up all test directories in the specified base directory
 */
export async function cleanupAllTestDirectories(
  baseDir: string = './test-dir',
  verbose: boolean = false
): Promise<void> {
  try {
    const resolvedBaseDir = path.resolve(baseDir)

    // Check if directory exists
    try {
      await fs.access(resolvedBaseDir)
    } catch {
      // Directory doesn't exist, nothing to clean
      return
    }

    // Get all entries in the directory
    const entries = await fs.readdir(resolvedBaseDir, { withFileTypes: true })

    // Filter for test directories (directories starting with 'test-')
    const testDirs = entries
      .filter(entry => entry.isDirectory() && entry.name.startsWith('test-'))
      .map(entry => path.join(resolvedBaseDir, entry.name))

    if (testDirs.length === 0) {
      if (verbose) {
        console.log(`✅ No test directories found in ${resolvedBaseDir}`)
      }
      return
    }

    if (verbose) {
      console.log(
        `🧹 Cleaning up ${testDirs.length} test directories in ${resolvedBaseDir}`
      )
    }

    // Remove all test directories
    await Promise.all(
      testDirs.map(async dir => {
        try {
          await fs.rm(dir, { recursive: true, force: true })
          if (verbose) {
            console.log(`  ✅ Removed: ${path.basename(dir)}`)
          }
        } catch (error) {
          if (verbose) {
            console.warn(`  ⚠️  Failed to remove ${path.basename(dir)}:`, error)
          }
        }
      })
    )

    // If the base directory is now empty, remove it too
    try {
      const remainingEntries = await fs.readdir(resolvedBaseDir)
      if (remainingEntries.length === 0) {
        await fs.rmdir(resolvedBaseDir)
        if (verbose) {
          console.log(`✅ Removed empty base directory: ${resolvedBaseDir}`)
        }
      }
    } catch {
      // Ignore errors when trying to remove base directory
    }

    if (verbose) {
      console.log(`✅ Test directory cleanup completed`)
    }
  } catch (error) {
    if (verbose) {
      console.warn('⚠️  Global test cleanup failed:', error)
    }
  }
}

/**
 * Setup global cleanup that runs after all tests
 */
export function setupGlobalTestCleanup(verbose: boolean = false): void {
  // Register cleanup to run when the process exits
  const cleanup = () => {
    cleanupAllTestDirectories('./test-dir', verbose).catch(error => {
      if (verbose) {
        console.warn('Global cleanup failed:', error)
      }
    })
  }

  // Register for various exit scenarios
  process.on('exit', cleanup)
  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)
  process.on('uncaughtException', cleanup)
}
