/**
 * Unit tests for SnapshotIntegrityValidator
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import { SnapshotIntegrityValidator } from '../SnapshotIntegrityValidator.js'
import type { Snapshot } from '../../types/snapshots.js'

describe('SnapshotIntegrityValidator', () => {
  const testCacheDir = path.join(process.cwd(), 'test-cache-integrity')
  const testSnapshotsDir = path.join(testCacheDir, 'snapshots')
  const testCurrentPointerFile = path.join(testCacheDir, 'current.json')

  let validator: SnapshotIntegrityValidator

  beforeEach(async () => {
    // Clean up any existing test directory
    try {
      await fs.rm(testCacheDir, { recursive: true, force: true })
    } catch {
      // Directory might not exist
    }

    // Create test directory structure
    await fs.mkdir(testSnapshotsDir, { recursive: true })

    validator = new SnapshotIntegrityValidator(
      testCacheDir,
      testSnapshotsDir,
      testCurrentPointerFile
    )
  })

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testCacheDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('validateSnapshot', () => {
    it('should validate a valid snapshot successfully', async () => {
      // Create a valid snapshot
      const validSnapshot: Snapshot = {
        snapshot_id: '1704067200000',
        created_at: '2024-01-01T00:00:00.000Z',
        schema_version: '1.0.0',
        calculation_version: '1.0.0',
        status: 'success',
        errors: [],
        payload: {
          districts: [
            {
              districtId: '123',
              asOfDate: '2024-01-01',
              membership: {
                total: 100,
                change: 5,
                changePercent: 5.0,
                byClub: [],
              },
              clubs: {
                total: 10,
                active: 8,
                suspended: 1,
                ineligible: 1,
                low: 0,
                distinguished: 3,
              },
              education: { totalAwards: 50, byType: [], topClubs: [] },
            },
          ],
          metadata: {
            source: 'test',
            fetchedAt: '2024-01-01T00:00:00.000Z',
            dataAsOfDate: '2024-01-01',
            districtCount: 1,
            processingDurationMs: 1000,
          },
        },
      }

      const snapshotPath = path.join(testSnapshotsDir, '1704067200000.json')
      await fs.writeFile(snapshotPath, JSON.stringify(validSnapshot, null, 2))

      const result = await validator.validateSnapshot('1704067200000')

      expect(result.isValid).toBe(true)
      expect(result.fileAccessible).toBe(true)
      expect(result.jsonValid).toBe(true)
      expect(result.schemaValid).toBe(true)
      expect(result.contentConsistent).toBe(true)
      expect(result.corruptionIssues).toHaveLength(0)
    })

    it('should detect missing snapshot file', async () => {
      const result = await validator.validateSnapshot('nonexistent')

      console.log('Corruption issues:', result.corruptionIssues)
      console.log('Recovery recommendations:', result.recoveryRecommendations)

      expect(result.isValid).toBe(false)
      expect(result.fileAccessible).toBe(false)
      expect(result.corruptionIssues.length).toBeGreaterThan(0)
      expect(result.recoveryRecommendations.length).toBeGreaterThan(0)
    })

    it('should detect invalid JSON', async () => {
      const snapshotPath = path.join(testSnapshotsDir, 'invalid.json')
      await fs.writeFile(snapshotPath, 'invalid json content')

      const result = await validator.validateSnapshot('invalid')

      expect(result.isValid).toBe(false)
      expect(result.fileAccessible).toBe(true)
      expect(result.jsonValid).toBe(false)
      expect(result.corruptionIssues[0]).toContain('Invalid JSON structure')
      expect(result.recoveryRecommendations).toContain(
        'The snapshot file contains invalid JSON and cannot be recovered'
      )
    })

    it('should detect schema violations', async () => {
      const invalidSnapshot = {
        snapshot_id: '', // Invalid: empty string
        created_at: 'invalid-date', // Invalid: not ISO format
        schema_version: '1.0.0',
        calculation_version: '1.0.0',
        status: 'success',
        errors: [],
        payload: {
          districts: [], // Invalid: empty array but should have at least one
          metadata: {
            source: 'test',
            fetchedAt: '2024-01-01T00:00:00.000Z',
            dataAsOfDate: '2024-01-01',
            districtCount: 1, // Inconsistent with empty districts array
            processingDurationMs: 1000,
          },
        },
      }

      const snapshotPath = path.join(testSnapshotsDir, 'schema-invalid.json')
      await fs.writeFile(snapshotPath, JSON.stringify(invalidSnapshot, null, 2))

      const result = await validator.validateSnapshot('schema-invalid')

      expect(result.isValid).toBe(false)
      expect(result.fileAccessible).toBe(true)
      expect(result.jsonValid).toBe(true)
      expect(result.schemaValid).toBe(false)
      expect(result.corruptionIssues.length).toBeGreaterThan(0)
    })

    it('should detect content inconsistencies', async () => {
      const inconsistentSnapshot: Snapshot = {
        snapshot_id: '1704067200000',
        created_at: '2024-01-01T00:00:00.000Z',
        schema_version: '1.0.0',
        calculation_version: '1.0.0',
        status: 'success',
        errors: ['Some error'], // Inconsistent: success status but has errors
        payload: {
          districts: [
            {
              districtId: '123',
              asOfDate: '2024-01-01',
              membership: {
                total: 100,
                change: 5,
                changePercent: 5.0,
                byClub: [],
              },
              clubs: {
                total: 10,
                active: 8,
                suspended: 1,
                ineligible: 1,
                low: 0,
                distinguished: 3,
              },
              education: { totalAwards: 50, byType: [], topClubs: [] },
            },
          ],
          metadata: {
            source: 'test',
            fetchedAt: '2024-01-01T00:00:00.000Z',
            dataAsOfDate: '2024-01-01',
            districtCount: 2, // Inconsistent: reports 2 but only 1 district
            processingDurationMs: 1000,
          },
        },
      }

      const snapshotPath = path.join(testSnapshotsDir, 'inconsistent.json')
      await fs.writeFile(
        snapshotPath,
        JSON.stringify(inconsistentSnapshot, null, 2)
      )

      const result = await validator.validateSnapshot('inconsistent')

      expect(result.isValid).toBe(false)
      expect(result.contentConsistent).toBe(false)
      expect(result.corruptionIssues).toContain(
        'District count mismatch: metadata reports 2 but found 1 districts'
      )
      expect(result.corruptionIssues).toContain(
        'Snapshot marked as success but contains errors'
      )
    })
  })

  describe('validateCurrentPointer', () => {
    it('should validate a valid current pointer', async () => {
      // Create a valid snapshot first
      const validSnapshot: Snapshot = {
        snapshot_id: '1704067200000',
        created_at: '2024-01-01T00:00:00.000Z',
        schema_version: '1.0.0',
        calculation_version: '1.0.0',
        status: 'success',
        errors: [],
        payload: {
          districts: [
            {
              districtId: '123',
              asOfDate: '2024-01-01',
              membership: {
                total: 100,
                change: 5,
                changePercent: 5.0,
                byClub: [],
              },
              clubs: {
                total: 10,
                active: 8,
                suspended: 1,
                ineligible: 1,
                low: 0,
                distinguished: 3,
              },
              education: { totalAwards: 50, byType: [], topClubs: [] },
            },
          ],
          metadata: {
            source: 'test',
            fetchedAt: '2024-01-01T00:00:00.000Z',
            dataAsOfDate: '2024-01-01',
            districtCount: 1,
            processingDurationMs: 1000,
          },
        },
      }

      const snapshotPath = path.join(testSnapshotsDir, '1704067200000.json')
      await fs.writeFile(snapshotPath, JSON.stringify(validSnapshot, null, 2))

      // Create valid current pointer
      const validPointer = {
        snapshot_id: '1704067200000',
        updated_at: '2024-01-01T00:00:00.000Z',
        schema_version: '1.0.0',
        calculation_version: '1.0.0',
      }

      await fs.writeFile(
        testCurrentPointerFile,
        JSON.stringify(validPointer, null, 2)
      )

      const result = await validator.validateCurrentPointer()

      expect(result.isValid).toBe(true)
      expect(result.fileAccessible).toBe(true)
      expect(result.jsonValid).toBe(true)
      expect(result.referencedSnapshotExists).toBe(true)
      expect(result.referencedSnapshotSuccessful).toBe(true)
      expect(result.issues).toHaveLength(0)
    })

    it('should detect missing current pointer file', async () => {
      const result = await validator.validateCurrentPointer()

      expect(result.isValid).toBe(false)
      expect(result.fileAccessible).toBe(false)
      expect(result.issues).toContain('Current pointer file is not accessible')
      expect(result.recoveryRecommendations).toContain(
        'Scan snapshots directory to find latest successful snapshot'
      )
    })

    it('should detect pointer referencing non-existent snapshot', async () => {
      const invalidPointer = {
        snapshot_id: 'nonexistent',
        updated_at: '2024-01-01T00:00:00.000Z',
        schema_version: '1.0.0',
        calculation_version: '1.0.0',
      }

      await fs.writeFile(
        testCurrentPointerFile,
        JSON.stringify(invalidPointer, null, 2)
      )

      const result = await validator.validateCurrentPointer()

      expect(result.isValid).toBe(false)
      expect(result.referencedSnapshotExists).toBe(false)
      expect(result.issues).toContain(
        'Referenced snapshot does not exist: nonexistent'
      )
      expect(result.recoveryRecommendations).toContain(
        'Current pointer references a non-existent snapshot'
      )
    })

    it('should detect pointer referencing failed snapshot', async () => {
      // Create a failed snapshot
      const failedSnapshot: Snapshot = {
        snapshot_id: '1704067200000',
        created_at: '2024-01-01T00:00:00.000Z',
        schema_version: '1.0.0',
        calculation_version: '1.0.0',
        status: 'failed',
        errors: ['Test error'],
        payload: {
          districts: [],
          metadata: {
            source: 'test',
            fetchedAt: '2024-01-01T00:00:00.000Z',
            dataAsOfDate: '2024-01-01',
            districtCount: 0,
            processingDurationMs: 1000,
          },
        },
      }

      const snapshotPath = path.join(testSnapshotsDir, '1704067200000.json')
      await fs.writeFile(snapshotPath, JSON.stringify(failedSnapshot, null, 2))

      // Create pointer referencing failed snapshot
      const pointer = {
        snapshot_id: '1704067200000',
        updated_at: '2024-01-01T00:00:00.000Z',
        schema_version: '1.0.0',
        calculation_version: '1.0.0',
      }

      await fs.writeFile(
        testCurrentPointerFile,
        JSON.stringify(pointer, null, 2)
      )

      const result = await validator.validateCurrentPointer()

      expect(result.isValid).toBe(false)
      expect(result.referencedSnapshotExists).toBe(true)
      expect(result.referencedSnapshotSuccessful).toBe(false)
      expect(result.issues).toContain(
        "Referenced snapshot has status 'failed', not 'success'"
      )
    })
  })

  describe('validateSnapshotStore', () => {
    it('should validate a healthy snapshot store', async () => {
      // Create a valid snapshot
      const validSnapshot: Snapshot = {
        snapshot_id: '1704067200000',
        created_at: '2024-01-01T00:00:00.000Z',
        schema_version: '1.0.0',
        calculation_version: '1.0.0',
        status: 'success',
        errors: [],
        payload: {
          districts: [
            {
              districtId: '123',
              asOfDate: '2024-01-01',
              membership: {
                total: 100,
                change: 5,
                changePercent: 5.0,
                byClub: [],
              },
              clubs: {
                total: 10,
                active: 8,
                suspended: 1,
                ineligible: 1,
                low: 0,
                distinguished: 3,
              },
              education: { totalAwards: 50, byType: [], topClubs: [] },
            },
          ],
          metadata: {
            source: 'test',
            fetchedAt: '2024-01-01T00:00:00.000Z',
            dataAsOfDate: '2024-01-01',
            districtCount: 1,
            processingDurationMs: 1000,
          },
        },
      }

      const snapshotPath = path.join(testSnapshotsDir, '1704067200000.json')
      await fs.writeFile(snapshotPath, JSON.stringify(validSnapshot, null, 2))

      // Create valid current pointer
      const validPointer = {
        snapshot_id: '1704067200000',
        updated_at: '2024-01-01T00:00:00.000Z',
        schema_version: '1.0.0',
        calculation_version: '1.0.0',
      }

      await fs.writeFile(
        testCurrentPointerFile,
        JSON.stringify(validPointer, null, 2)
      )

      const result = await validator.validateSnapshotStore()

      expect(result.isHealthy).toBe(true)
      expect(result.currentPointer.isValid).toBe(true)
      expect(result.summary.totalSnapshots).toBe(1)
      expect(result.summary.validSnapshots).toBe(1)
      expect(result.summary.successfulSnapshots).toBe(1)
      expect(result.summary.corruptedSnapshots).toBe(0)
      expect(result.summary.latestSuccessfulSnapshot).toBe('1704067200000')
      expect(result.storeIssues).toHaveLength(0)
    })

    it('should detect store with no snapshots', async () => {
      const result = await validator.validateSnapshotStore()

      expect(result.isHealthy).toBe(false)
      expect(result.summary.totalSnapshots).toBe(0)
      expect(result.storeIssues).toContain(
        'No snapshot files found in snapshots directory'
      )
      expect(result.storeRecoveryRecommendations).toContain(
        'Run data refresh to create initial snapshot'
      )
    })

    it('should detect store with corrupted snapshots', async () => {
      // Create a corrupted snapshot (invalid JSON)
      const corruptedPath = path.join(testSnapshotsDir, 'corrupted.json')
      await fs.writeFile(corruptedPath, 'invalid json')

      // Create a valid snapshot
      const validSnapshot: Snapshot = {
        snapshot_id: '1704067200000',
        created_at: '2024-01-01T00:00:00.000Z',
        schema_version: '1.0.0',
        calculation_version: '1.0.0',
        status: 'success',
        errors: [],
        payload: {
          districts: [
            {
              districtId: '123',
              asOfDate: '2024-01-01',
              membership: {
                total: 100,
                change: 5,
                changePercent: 5.0,
                byClub: [],
              },
              clubs: {
                total: 10,
                active: 8,
                suspended: 1,
                ineligible: 1,
                low: 0,
                distinguished: 3,
              },
              education: { totalAwards: 50, byType: [], topClubs: [] },
            },
          ],
          metadata: {
            source: 'test',
            fetchedAt: '2024-01-01T00:00:00.000Z',
            dataAsOfDate: '2024-01-01',
            districtCount: 1,
            processingDurationMs: 1000,
          },
        },
      }

      const validPath = path.join(testSnapshotsDir, '1704067200000.json')
      await fs.writeFile(validPath, JSON.stringify(validSnapshot, null, 2))

      const result = await validator.validateSnapshotStore()

      expect(result.isHealthy).toBe(false)
      expect(result.summary.totalSnapshots).toBe(2)
      expect(result.summary.validSnapshots).toBe(1)
      expect(result.summary.corruptedSnapshots).toBe(1)
      expect(result.storeIssues).toContain('Found 1 corrupted snapshots')
      expect(result.storeRecoveryRecommendations).toContain(
        'Remove corrupted snapshot files'
      )
    })
  })
})
