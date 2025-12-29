/**
 * Tests for Cache Management Utilities
 */

import { describe, it, expect, afterEach } from 'vitest'
import { promises as fs } from 'fs'
import path from 'path'
import {
  validateCacheInitialization,
  ensureCacheDirectoryExists,
  cleanupCacheDirectory,
  getCacheDirectoryStats,
  createTestCacheCleanup,
  CacheManagementError,
} from '../cache-management-utilities.js'
import { createTestSelfCleanup } from '../test-self-cleanup.js'

describe('Cache Management Utilities', () => {
  // Self-cleanup setup
  const { cleanup, afterEach: performCleanup } = createTestSelfCleanup({
    verbose: false,
  })

  afterEach(async () => {
    await performCleanup()
  })

  describe('validateCacheInitialization', () => {
    it('should validate existing cache directory', async () => {
      const testDir = path.resolve('./test-dir/cache-validation-test')
      cleanup.trackDirectory(testDir)

      // Create directory
      await fs.mkdir(testDir, { recursive: true })

      const result = await validateCacheInitialization(testDir)

      expect(result.isValid).toBe(true)
      expect(result.isInitialized).toBe(true)
      expect(result.validationDetails.directoryExists).toBe(true)
      expect(result.validationDetails.isReadable).toBe(true)
      expect(result.validationDetails.isWritable).toBe(true)
      expect(result.validationDetails.hasCorrectPermissions).toBe(true)
    })

    it('should fail validation for non-existent directory', async () => {
      const testDir = path.resolve('./test-dir/non-existent-cache')

      const result = await validateCacheInitialization(testDir)

      expect(result.isValid).toBe(false)
      expect(result.isInitialized).toBe(false)
      expect(result.validationDetails.directoryExists).toBe(false)
      expect(result.errorMessage).toContain('does not exist')
    })

    it('should fail validation for file instead of directory', async () => {
      const testFile = path.resolve('./test-dir/cache-file-test')
      cleanup.trackFile(testFile)

      // Create file instead of directory
      await fs.mkdir(path.dirname(testFile), { recursive: true })
      await fs.writeFile(testFile, 'test', 'utf-8')

      const result = await validateCacheInitialization(testFile)

      expect(result.isValid).toBe(false)
      expect(result.errorMessage).toContain('not a directory')
    })
  })

  describe('ensureCacheDirectoryExists', () => {
    it('should create cache directory if it does not exist', async () => {
      const testDir = path.resolve('./test-dir/ensure-cache-test')
      cleanup.trackDirectory(testDir)

      await ensureCacheDirectoryExists(testDir, true)

      const stats = await fs.stat(testDir)
      expect(stats.isDirectory()).toBe(true)
    })

    it('should not throw if directory already exists', async () => {
      const testDir = path.resolve('./test-dir/existing-cache-test')
      cleanup.trackDirectory(testDir)

      // Create directory first
      await fs.mkdir(testDir, { recursive: true })

      await expect(
        ensureCacheDirectoryExists(testDir, true)
      ).resolves.not.toThrow()
    })

    it('should throw error if creation is disabled and directory does not exist', async () => {
      const testDir = path.resolve('./test-dir/no-create-cache-test')

      await expect(ensureCacheDirectoryExists(testDir, false)).rejects.toThrow(
        CacheManagementError
      )
    })
  })

  describe('cleanupCacheDirectory', () => {
    it('should clean up files in cache directory', async () => {
      const testDir = path.resolve('./test-dir/cleanup-test')
      cleanup.trackDirectory(testDir)

      // Create directory and files
      await fs.mkdir(testDir, { recursive: true })
      await fs.writeFile(path.join(testDir, 'file1.txt'), 'test1', 'utf-8')
      await fs.writeFile(path.join(testDir, 'file2.txt'), 'test2', 'utf-8')

      const result = await cleanupCacheDirectory(testDir, {
        removeFiles: true,
        removeDirectories: false,
      })

      expect(result.filesRemoved).toBe(2)
      expect(result.directoriesRemoved).toBe(0)

      // Verify files are removed
      const files = await fs.readdir(testDir)
      expect(files).toHaveLength(0)
    })

    it('should clean up directories recursively', async () => {
      const testDir = path.resolve('./test-dir/recursive-cleanup-test')
      cleanup.trackDirectory(testDir)

      // Create nested directory structure
      await fs.mkdir(path.join(testDir, 'subdir1', 'subdir2'), {
        recursive: true,
      })
      await fs.writeFile(
        path.join(testDir, 'subdir1', 'file1.txt'),
        'test1',
        'utf-8'
      )
      await fs.writeFile(
        path.join(testDir, 'subdir1', 'subdir2', 'file2.txt'),
        'test2',
        'utf-8'
      )

      const result = await cleanupCacheDirectory(testDir, {
        removeFiles: true,
        removeDirectories: true,
        recursive: true,
      })

      expect(result.filesRemoved).toBe(2)
      expect(result.directoriesRemoved).toBe(2)
    })

    it('should support dry run mode', async () => {
      const testDir = path.resolve('./test-dir/dry-run-test')
      cleanup.trackDirectory(testDir)

      // Create directory and files
      await fs.mkdir(testDir, { recursive: true })
      await fs.writeFile(path.join(testDir, 'file1.txt'), 'test1', 'utf-8')

      const result = await cleanupCacheDirectory(testDir, {
        removeFiles: true,
        dryRun: true,
      })

      expect(result.filesRemoved).toBe(1)

      // Verify files still exist
      const files = await fs.readdir(testDir)
      expect(files).toHaveLength(1)
    })
  })

  describe('getCacheDirectoryStats', () => {
    it('should return correct statistics for cache directory', async () => {
      const testDir = path.resolve('./test-dir/stats-test')
      cleanup.trackDirectory(testDir)

      // Create directory and files
      await fs.mkdir(path.join(testDir, 'subdir'), { recursive: true })
      await fs.writeFile(path.join(testDir, 'file1.txt'), 'test1', 'utf-8')
      await fs.writeFile(
        path.join(testDir, 'subdir', 'file2.txt'),
        'test2',
        'utf-8'
      )

      const stats = await getCacheDirectoryStats(testDir)

      expect(stats.exists).toBe(true)
      expect(stats.totalFiles).toBe(2)
      expect(stats.totalDirectories).toBe(1)
      expect(stats.totalSize).toBeGreaterThan(0)
      expect(stats.lastModified).toBeInstanceOf(Date)
    })

    it('should handle non-existent directory', async () => {
      const testDir = path.resolve('./test-dir/non-existent-stats')

      const stats = await getCacheDirectoryStats(testDir)

      expect(stats.exists).toBe(false)
      expect(stats.totalFiles).toBe(0)
      expect(stats.totalDirectories).toBe(0)
      expect(stats.totalSize).toBe(0)
    })
  })

  describe('createTestCacheCleanup', () => {
    it('should track and clean up directories and files', async () => {
      const baseDir = path.resolve('./test-dir/test-cleanup-base')
      cleanup.trackDirectory(baseDir)

      const testCleanup = createTestCacheCleanup(baseDir)

      // Create and track resources
      const testDir = path.join(baseDir, 'tracked-dir')
      const testFile = path.join(baseDir, 'tracked-file.txt')

      await fs.mkdir(testDir, { recursive: true })
      await fs.writeFile(testFile, 'test', 'utf-8')

      testCleanup.trackDirectory('tracked-dir')
      testCleanup.trackFile('tracked-file.txt')

      // Verify resources exist
      expect(await fs.stat(testDir)).toBeDefined()
      expect(await fs.stat(testFile)).toBeDefined()

      // Clean up
      await testCleanup.cleanup()

      // Verify resources are removed
      await expect(fs.stat(testFile)).rejects.toThrow()
      await expect(fs.stat(testDir)).rejects.toThrow()
    })

    it('should provide cleanup statistics', async () => {
      const baseDir = path.resolve('./test-dir/cleanup-stats-base')
      const testCleanup = createTestCacheCleanup(baseDir)

      testCleanup.trackDirectory('dir1')
      testCleanup.trackDirectory('dir2')
      testCleanup.trackFile('file1.txt')

      const stats = testCleanup.getStats()

      expect(stats.trackedDirectories).toBe(2)
      expect(stats.trackedFiles).toBe(1)
    })
  })

  describe('CacheManagementError', () => {
    it('should create error with proper context', () => {
      const error = new CacheManagementError(
        'Test error message',
        'test_operation',
        '/test/cache/path',
        new Error('Original error')
      )

      expect(error.message).toBe('Test error message')
      expect(error.operation).toBe('test_operation')
      expect(error.cachePath).toBe('/test/cache/path')
      expect(error.cause).toBeInstanceOf(Error)
      expect(error.name).toBe('CacheManagementError')
    })
  })
})
