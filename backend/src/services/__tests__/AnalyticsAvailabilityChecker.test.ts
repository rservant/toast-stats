/**
 * Unit Tests for AnalyticsAvailabilityChecker
 *
 * Tests the analytics availability checking logic for determining whether
 * pre-computed analytics exist for snapshots.
 *
 * **Validates: Requirements 2.1, 2.2**
 *
 * Per the property-testing-guidance.md steering document, these are validated
 * through unit tests with well-chosen examples rather than property-based tests,
 * as the behavior is deterministic, easily observable, and does not involve
 * complex input spaces or mathematical invariants.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import {
  AnalyticsAvailabilityChecker,
  createAnalyticsAvailabilityChecker,
} from '../AnalyticsAvailabilityChecker.js'
import {
  createTestSelfCleanup,
  createUniqueTestDir,
} from '../../utils/test-self-cleanup.js'

describe('AnalyticsAvailabilityChecker', () => {
  const { cleanup, afterEach: performCleanup } = createTestSelfCleanup({
    verbose: false,
  })

  let testDir: string
  let snapshotsDir: string
  let checker: AnalyticsAvailabilityChecker

  beforeEach(async () => {
    // Create unique test directory for isolation
    testDir = createUniqueTestDir(
      cleanup,
      'analytics-availability-checker',
      './test-cache'
    )
    snapshotsDir = path.join(testDir, 'snapshots')
    await fs.mkdir(snapshotsDir, { recursive: true })

    checker = new AnalyticsAvailabilityChecker({ snapshotsDir })
  })

  afterEach(async () => {
    await performCleanup()
  })

  describe('hasAnalytics()', () => {
    /**
     * Validates: Requirement 2.2 - Analytics availability check SHALL verify
     * existence of analytics-summary.json file
     */
    describe('when analytics file exists', () => {
      it('returns true when analytics-summary.json exists for snapshot', async () => {
        // Arrange: Create snapshot directory with analytics file
        const snapshotId = '2024-01-15'
        const snapshotDir = path.join(snapshotsDir, snapshotId)
        await fs.mkdir(snapshotDir, { recursive: true })
        await fs.writeFile(
          path.join(snapshotDir, 'analytics-summary.json'),
          JSON.stringify({ test: 'data' })
        )

        // Act
        const result = await checker.hasAnalytics(snapshotId)

        // Assert
        expect(result).toBe(true)
      })

      it('returns true for different valid snapshot date formats', async () => {
        // Arrange: Create multiple snapshots with analytics
        const snapshotIds = ['2024-01-01', '2024-12-31', '2025-06-15']

        for (const snapshotId of snapshotIds) {
          const snapshotDir = path.join(snapshotsDir, snapshotId)
          await fs.mkdir(snapshotDir, { recursive: true })
          await fs.writeFile(
            path.join(snapshotDir, 'analytics-summary.json'),
            '{}'
          )
        }

        // Act & Assert
        for (const snapshotId of snapshotIds) {
          const result = await checker.hasAnalytics(snapshotId)
          expect(result).toBe(true)
        }
      })
    })

    describe('when analytics file does not exist', () => {
      /**
       * Validates: Requirement 2.1 - Snapshot list endpoint SHALL include
       * a boolean field indicating whether analytics are available
       */
      it('returns false when analytics-summary.json does not exist', async () => {
        // Arrange: Create snapshot directory without analytics file
        const snapshotId = '2024-01-15'
        const snapshotDir = path.join(snapshotsDir, snapshotId)
        await fs.mkdir(snapshotDir, { recursive: true })
        // Create other files but not analytics-summary.json
        await fs.writeFile(
          path.join(snapshotDir, 'manifest.json'),
          JSON.stringify({ test: 'data' })
        )

        // Act
        const result = await checker.hasAnalytics(snapshotId)

        // Assert
        expect(result).toBe(false)
      })

      it('returns false when snapshot directory does not exist', async () => {
        // Arrange: Use a snapshot ID that has no directory
        const snapshotId = '2024-01-15'
        // Don't create the directory

        // Act
        const result = await checker.hasAnalytics(snapshotId)

        // Assert
        expect(result).toBe(false)
      })

      it('returns false when snapshots base directory does not exist', async () => {
        // Arrange: Create checker with non-existent base directory
        const nonExistentDir = path.join(testDir, 'non-existent-snapshots')
        const checkerWithBadDir = new AnalyticsAvailabilityChecker({
          snapshotsDir: nonExistentDir,
        })

        // Act
        const result = await checkerWithBadDir.hasAnalytics('2024-01-15')

        // Assert
        expect(result).toBe(false)
      })
    })

    describe('error handling', () => {
      /**
       * Tests that file system errors are handled gracefully and return false
       * rather than throwing exceptions.
       */
      it('returns false for invalid snapshot ID format (path traversal attempt)', async () => {
        // Arrange: Use invalid snapshot ID that could be path traversal
        const invalidIds = [
          '../secret',
          '../../etc/passwd',
          'snapshot/../other',
          '',
          '2024/01/15',
          '2024-01-15-extra',
          'not-a-date',
        ]

        // Act & Assert
        for (const invalidId of invalidIds) {
          const result = await checker.hasAnalytics(invalidId)
          expect(result).toBe(false)
        }
      })

      it('returns false when snapshot ID contains special characters', async () => {
        // Arrange: Use snapshot IDs with special characters
        const specialIds = ['2024-01-15\0', '2024-01-15\n', '2024-01-15;rm -rf']

        // Act & Assert
        for (const specialId of specialIds) {
          const result = await checker.hasAnalytics(specialId)
          expect(result).toBe(false)
        }
      })
    })
  })

  describe('checkBatch()', () => {
    /**
     * Validates: Requirements 2.1, 2.2 - Batch checking for efficient
     * snapshot list operations
     */
    it('returns correct map for mixed availability', async () => {
      // Arrange: Create snapshots with mixed analytics availability
      const snapshotsWithAnalytics = ['2024-01-15', '2024-01-17']
      const snapshotsWithoutAnalytics = ['2024-01-16', '2024-01-18']

      // Create snapshots with analytics
      for (const snapshotId of snapshotsWithAnalytics) {
        const snapshotDir = path.join(snapshotsDir, snapshotId)
        await fs.mkdir(snapshotDir, { recursive: true })
        await fs.writeFile(
          path.join(snapshotDir, 'analytics-summary.json'),
          '{}'
        )
      }

      // Create snapshots without analytics
      for (const snapshotId of snapshotsWithoutAnalytics) {
        const snapshotDir = path.join(snapshotsDir, snapshotId)
        await fs.mkdir(snapshotDir, { recursive: true })
        // Don't create analytics-summary.json
      }

      const allSnapshotIds = [
        ...snapshotsWithAnalytics,
        ...snapshotsWithoutAnalytics,
      ]

      // Act
      const result = await checker.checkBatch(allSnapshotIds)

      // Assert
      expect(result.size).toBe(4)
      expect(result.get('2024-01-15')).toBe(true)
      expect(result.get('2024-01-17')).toBe(true)
      expect(result.get('2024-01-16')).toBe(false)
      expect(result.get('2024-01-18')).toBe(false)
    })

    it('returns empty map for empty input array', async () => {
      // Act
      const result = await checker.checkBatch([])

      // Assert
      expect(result.size).toBe(0)
    })

    it('returns all true when all snapshots have analytics', async () => {
      // Arrange: Create snapshots all with analytics
      const snapshotIds = ['2024-01-15', '2024-01-16', '2024-01-17']

      for (const snapshotId of snapshotIds) {
        const snapshotDir = path.join(snapshotsDir, snapshotId)
        await fs.mkdir(snapshotDir, { recursive: true })
        await fs.writeFile(
          path.join(snapshotDir, 'analytics-summary.json'),
          '{}'
        )
      }

      // Act
      const result = await checker.checkBatch(snapshotIds)

      // Assert
      expect(result.size).toBe(3)
      for (const snapshotId of snapshotIds) {
        expect(result.get(snapshotId)).toBe(true)
      }
    })

    it('returns all false when no snapshots have analytics', async () => {
      // Arrange: Create snapshots without analytics
      const snapshotIds = ['2024-01-15', '2024-01-16', '2024-01-17']

      for (const snapshotId of snapshotIds) {
        const snapshotDir = path.join(snapshotsDir, snapshotId)
        await fs.mkdir(snapshotDir, { recursive: true })
        // Don't create analytics-summary.json
      }

      // Act
      const result = await checker.checkBatch(snapshotIds)

      // Assert
      expect(result.size).toBe(3)
      for (const snapshotId of snapshotIds) {
        expect(result.get(snapshotId)).toBe(false)
      }
    })

    it('returns false for non-existent snapshots in batch', async () => {
      // Arrange: Mix of existing and non-existing snapshots
      const existingSnapshot = '2024-01-15'
      const nonExistingSnapshots = ['2024-01-16', '2024-01-17']

      const snapshotDir = path.join(snapshotsDir, existingSnapshot)
      await fs.mkdir(snapshotDir, { recursive: true })
      await fs.writeFile(path.join(snapshotDir, 'analytics-summary.json'), '{}')

      const allSnapshotIds = [existingSnapshot, ...nonExistingSnapshots]

      // Act
      const result = await checker.checkBatch(allSnapshotIds)

      // Assert
      expect(result.size).toBe(3)
      expect(result.get(existingSnapshot)).toBe(true)
      expect(result.get('2024-01-16')).toBe(false)
      expect(result.get('2024-01-17')).toBe(false)
    })

    it('handles invalid snapshot IDs in batch gracefully', async () => {
      // Arrange: Mix of valid and invalid snapshot IDs
      const validSnapshot = '2024-01-15'
      const invalidSnapshots = ['../secret', 'not-a-date', '']

      const snapshotDir = path.join(snapshotsDir, validSnapshot)
      await fs.mkdir(snapshotDir, { recursive: true })
      await fs.writeFile(path.join(snapshotDir, 'analytics-summary.json'), '{}')

      const allSnapshotIds = [validSnapshot, ...invalidSnapshots]

      // Act
      const result = await checker.checkBatch(allSnapshotIds)

      // Assert
      expect(result.size).toBe(4)
      expect(result.get(validSnapshot)).toBe(true)
      // Invalid IDs should return false, not throw
      for (const invalidId of invalidSnapshots) {
        expect(result.get(invalidId)).toBe(false)
      }
    })
  })

  describe('createAnalyticsAvailabilityChecker factory', () => {
    it('creates checker with correct snapshots directory from cache dir', async () => {
      // Arrange: Create a cache directory structure
      const cacheDir = testDir
      const expectedSnapshotsDir = path.join(cacheDir, 'snapshots')
      await fs.mkdir(expectedSnapshotsDir, { recursive: true })

      // Create a snapshot with analytics
      const snapshotId = '2024-01-15'
      const snapshotDir = path.join(expectedSnapshotsDir, snapshotId)
      await fs.mkdir(snapshotDir, { recursive: true })
      await fs.writeFile(path.join(snapshotDir, 'analytics-summary.json'), '{}')

      // Act
      const factoryChecker = createAnalyticsAvailabilityChecker(cacheDir)
      const result = await factoryChecker.hasAnalytics(snapshotId)

      // Assert
      expect(result).toBe(true)
    })
  })

  describe('snapshot ID validation', () => {
    /**
     * Tests the internal validation of snapshot IDs to ensure
     * only valid ISO date format IDs are accepted.
     */
    it('accepts valid ISO date format snapshot IDs', async () => {
      const validIds = [
        '2024-01-01',
        '2024-12-31',
        '2025-06-15',
        '2000-01-01',
        '2099-12-31',
      ]

      for (const snapshotId of validIds) {
        const snapshotDir = path.join(snapshotsDir, snapshotId)
        await fs.mkdir(snapshotDir, { recursive: true })
        await fs.writeFile(
          path.join(snapshotDir, 'analytics-summary.json'),
          '{}'
        )
      }

      for (const snapshotId of validIds) {
        const result = await checker.hasAnalytics(snapshotId)
        expect(result).toBe(true)
      }
    })

    it('rejects snapshot IDs that do not match ISO date format', async () => {
      const invalidIds = [
        '24-01-15', // Short year
        '2024-1-15', // Single digit month
        '2024-01-5', // Single digit day
        '2024/01/15', // Wrong separator
        '01-15-2024', // Wrong order
        '20240115', // No separators
        'snapshot-2024-01-15', // Prefix
        '2024-01-15-v2', // Suffix
      ]

      for (const invalidId of invalidIds) {
        const result = await checker.hasAnalytics(invalidId)
        expect(result).toBe(false)
      }
    })
  })
})
