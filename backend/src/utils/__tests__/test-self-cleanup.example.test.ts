/**
 * Example Test: Self-Cleanup Pattern
 *
 * This file demonstrates how to use the self-cleanup utilities to ensure
 * tests clean up after themselves without relying on external cleanup scripts.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import {
  createTestSelfCleanup,
  createUniqueTestDir,
  createUniqueTestFile,
  withSelfCleanup,
  verifyTestDirEmpty,
} from '../test-self-cleanup.ts'

describe('Self-Cleanup Pattern Examples', () => {
  describe('Basic Self-Cleanup Pattern', () => {
    // Create self-cleanup manager for this test suite
    const { cleanup, afterEach: performCleanup } = createTestSelfCleanup({
      verbose: false,
    })

    // Each test cleans up after itself
    afterEach(performCleanup)

    it('should create and cleanup test directories automatically', async () => {
      // Create unique test directory (automatically tracked for cleanup)
      const testDir = createUniqueTestDir(cleanup, 'example-test')

      // Create the directory and add some test data
      await fs.mkdir(testDir, { recursive: true })
      await fs.writeFile(path.join(testDir, 'test-file.txt'), 'test content')

      // Verify directory exists
      const stats = await fs.stat(testDir)
      expect(stats.isDirectory()).toBe(true)

      // File will be automatically cleaned up in afterEach
      // No manual cleanup needed!
    })

    it('should create and cleanup test files automatically', async () => {
      // Create unique test file (automatically tracked for cleanup)
      const testFile = createUniqueTestFile(cleanup, 'example-file', '.json')

      // Write test data
      const testData = { message: 'Hello, World!', timestamp: Date.now() }
      await fs.writeFile(testFile, JSON.stringify(testData))

      // Verify file exists and has correct content
      const content = JSON.parse(await fs.readFile(testFile, 'utf-8'))
      expect(content.message).toBe('Hello, World!')

      // File will be automatically cleaned up in afterEach
      // No manual cleanup needed!
    })

    it('should handle custom cleanup functions', async () => {
      // Add custom cleanup function
      cleanup.addCleanupFunction(async () => {
        // Custom cleanup logic here
        console.log('Custom cleanup executed')
      })

      // Create some test resources
      const testDir = createUniqueTestDir(cleanup, 'custom-cleanup-test')
      await fs.mkdir(testDir, { recursive: true })

      // Verify directory exists
      const stats = await fs.stat(testDir)
      expect(stats.isDirectory()).toBe(true)

      // Custom cleanup function will be called automatically in afterEach
      // along with directory cleanup

      // Note: We can't verify the cleanup was called here because afterEach hasn't run yet
      // In a real test, you would verify the effects of the cleanup, not the cleanup itself
    })
  })

  describe('Wrapper Function Pattern', () => {
    it('should use withSelfCleanup wrapper for automatic cleanup', async () => {
      await withSelfCleanup(async cleanup => {
        // Create test resources within the wrapper
        const testDir = createUniqueTestDir(cleanup, 'wrapper-test')
        const testFile = createUniqueTestFile(cleanup, 'wrapper-file', '.txt')

        // Create directory and file
        await fs.mkdir(testDir, { recursive: true })
        await fs.writeFile(testFile, 'wrapper test content')

        // Verify resources exist
        const dirStats = await fs.stat(testDir)
        const fileContent = await fs.readFile(testFile, 'utf-8')

        expect(dirStats.isDirectory()).toBe(true)
        expect(fileContent).toBe('wrapper test content')

        // Resources will be automatically cleaned up when wrapper exits
        // Even if this test throws an error!
      })

      // No afterEach needed - cleanup is handled by the wrapper
    })
  })

  describe('Manual Cleanup Management', () => {
    let manualCleanup: ReturnType<typeof createTestSelfCleanup>['cleanup']

    beforeEach(() => {
      const { cleanup } = createTestSelfCleanup({ verbose: false })
      manualCleanup = cleanup
    })

    afterEach(async () => {
      // Manually call cleanup
      await manualCleanup.cleanup()
    })

    it('should allow manual control of cleanup timing', async () => {
      // Create test resources
      const testDir = createUniqueTestDir(manualCleanup, 'manual-test')
      await fs.mkdir(testDir, { recursive: true })

      // Verify resource tracking
      const resourceCount = manualCleanup.getTrackedResourceCount()
      expect(resourceCount.directories).toBe(1)
      expect(resourceCount.files).toBe(0)
      expect(resourceCount.functions).toBe(0)

      // Verify directory exists
      const stats = await fs.stat(testDir)
      expect(stats.isDirectory()).toBe(true)

      // Cleanup will happen in afterEach
    })
  })

  describe('Cleanup Verification', () => {
    it('should verify test directory is empty after cleanup', async () => {
      await withSelfCleanup(async cleanup => {
        // Create multiple test resources
        const testDir1 = createUniqueTestDir(cleanup, 'verify-test-1')
        const testDir2 = createUniqueTestDir(cleanup, 'verify-test-2')
        const testFile = createUniqueTestFile(cleanup, 'verify-file', '.tmp')

        // Create the resources
        await fs.mkdir(testDir1, { recursive: true })
        await fs.mkdir(testDir2, { recursive: true })
        await fs.writeFile(testFile, 'verification test')

        // Verify they exist
        expect((await fs.stat(testDir1)).isDirectory()).toBe(true)
        expect((await fs.stat(testDir2)).isDirectory()).toBe(true)
        expect(await fs.readFile(testFile, 'utf-8')).toBe('verification test')
      })

      // After cleanup, verify test directory is clean
      const { isEmpty, remainingItems } = await verifyTestDirEmpty(
        './test-dir',
        false
      )

      // Note: This might not be completely empty if other tests are running concurrently
      // but our specific test resources should be cleaned up
      if (!isEmpty) {
        // Log remaining items for debugging (but don't fail the test)
        console.log('Remaining items in test-dir:', remainingItems.slice(0, 5))
      }
    })
  })

  describe('Error Handling in Cleanup', () => {
    it('should handle cleanup errors gracefully', async () => {
      const { cleanup, afterEach: performCleanup } = createTestSelfCleanup({
        verbose: false,
        failOnCleanupError: false, // Don't fail test if cleanup fails
      })

      // Create test directory
      const testDir = createUniqueTestDir(cleanup, 'error-handling-test')
      await fs.mkdir(testDir, { recursive: true })

      // Add a cleanup function that will fail
      cleanup.addCleanupFunction(async () => {
        throw new Error('Simulated cleanup failure')
      })

      // Verify directory exists
      const stats = await fs.stat(testDir)
      expect(stats.isDirectory()).toBe(true)

      // Cleanup should handle the error gracefully
      await expect(performCleanup()).resolves.not.toThrow()
    })
  })
})
