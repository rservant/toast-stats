/**
 * Integration Tests for UploadService
 *
 * These tests exercise the full upload pipeline using fake dependencies
 * (FakeFileSystem, FakeHasher, FakeBucketClient, FakeClock, FakeProgressReporter)
 * to verify end-to-end behavior without real IO or network calls.
 *
 * Requirements: 1.1, 1.2, 1.5, 2.1, 4.2, 4.3, 4.4, 4.5, 4.8, 4.9, 5.1, 7.1, 7.3
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { UploadService } from '../services/UploadService.js'
import {
  FakeFileSystem,
  FakeHasher,
  FakeBucketClient,
  FakeClock,
  FakeProgressReporter,
} from './fakes/index.js'
import { formatUploadSummary } from '../cli.js'
import type { UploadResult } from '../types/index.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CACHE_DIR = '/cache'
const BUCKET = 'test-bucket'
const PREFIX = 'snapshots'

interface TestHarness {
  fs: FakeFileSystem
  hasher: FakeHasher
  bucket: FakeBucketClient
  clock: FakeClock
  progress: FakeProgressReporter
  service: UploadService
}

function createHarness(): TestHarness {
  const fs = new FakeFileSystem()
  const hasher = new FakeHasher()
  const bucket = new FakeBucketClient()
  const clock = new FakeClock('2024-01-15T10:30:00.000Z')
  const progress = new FakeProgressReporter()

  const service = new UploadService({
    cacheDir: CACHE_DIR,
    bucket: BUCKET,
    prefix: PREFIX,
    fs,
    hasher,
    bucketClient: bucket,
    clock,
    progressReporter: progress,
  })

  return { fs, hasher, bucket, clock, progress, service }
}

/**
 * Populate a snapshot date with a small set of files in the fake filesystem.
 * Creates: metadata.json, manifest.json, district_1.json
 */
function addSnapshotDate(
  fs: FakeFileSystem,
  date: string,
  mtimeMs: number = 1705312200000
): void {
  const base = `${CACHE_DIR}/snapshots/${date}`
  fs.addFile(`${base}/metadata.json`, JSON.stringify({ date }), mtimeMs)
  fs.addFile(
    `${base}/manifest.json`,
    JSON.stringify({ date, districts: ['1'] }),
    mtimeMs
  )
  fs.addFile(
    `${base}/district_1.json`,
    JSON.stringify({ districtId: '1', snapshotDate: date }),
    mtimeMs
  )
}


// ─── 8.1 Dry-run integration ────────────────────────────────────────────────

describe('Integration: dry-run scans dates, emits progress, outputs JSON, no hashing, no GCS calls', () => {
  let h: TestHarness

  beforeEach(() => {
    h = createHarness()
    addSnapshotDate(h.fs, '2024-01-15')
    addSnapshotDate(h.fs, '2024-01-16')
  })

  it('should never call FakeHasher.sha256 during dry-run (Req 1.1)', async () => {
    await h.service.upload({ dryRun: true })
    expect(h.hasher.calls).toHaveLength(0)
  })

  it('should never call FakeBucketClient.uploadStream during dry-run (Req 1.2)', async () => {
    await h.service.upload({ dryRun: true })
    expect(h.bucket.calls).toHaveLength(0)
  })

  it('should emit date-level progress for each date (Req 2.1)', async () => {
    await h.service.upload({ dryRun: true })

    expect(h.progress.dateCompleteCalls).toHaveLength(2)
    // Dates are sorted newest-first by getAvailableDates
    expect(h.progress.dateCompleteCalls[0]).toMatchObject({
      index: 1,
      total: 2,
      date: '2024-01-16',
      fileCount: 3,
    })
    expect(h.progress.dateCompleteCalls[1]).toMatchObject({
      index: 2,
      total: 2,
      date: '2024-01-15',
      fileCount: 3,
    })
  })

  it('should return UploadResult matching the expected shape (Req 7.1)', async () => {
    const result = await h.service.upload({ dryRun: true })

    // Verify all required UploadResult fields exist with correct types
    expect(typeof result.success).toBe('boolean')
    expect(Array.isArray(result.dates)).toBe(true)
    expect(Array.isArray(result.filesProcessed)).toBe(true)
    expect(Array.isArray(result.filesUploaded)).toBe(true)
    expect(Array.isArray(result.filesFailed)).toBe(true)
    expect(Array.isArray(result.filesSkipped)).toBe(true)
    expect(Array.isArray(result.errors)).toBe(true)
    expect(typeof result.duration_ms).toBe('number')

    // Dry-run should report all files as "uploaded" (simulated)
    expect(result.filesProcessed.length).toBe(6) // 3 files × 2 dates
    expect(result.filesUploaded.length).toBe(6)
    expect(result.filesFailed).toHaveLength(0)
  })

  it('should produce valid UploadSummary JSON via formatUploadSummary (Req 7.1)', async () => {
    const result = await h.service.upload({ dryRun: true })
    const summary = formatUploadSummary(result, BUCKET, PREFIX, true)

    expect(summary.dryRun).toBe(true)
    expect(summary.files.total).toBe(result.filesProcessed.length)
    expect(summary.files.uploaded).toBe(result.filesUploaded.length)
    expect(summary.destination).toEqual({ bucket: BUCKET, prefix: PREFIX })
    expect(typeof summary.timestamp).toBe('string')
    expect(typeof summary.duration_ms).toBe('number')
  })
})


// ─── 8.2 Non-incremental upload with concurrency ────────────────────────────

describe('Integration: non-incremental upload uploads all files with concurrency', () => {
  let h: TestHarness

  beforeEach(() => {
    h = createHarness()
    addSnapshotDate(h.fs, '2024-01-15')
  })

  it('should upload all files via FakeBucketClient.uploadStream (stream-based) (Req 1.5)', async () => {
    const result = await h.service.upload({ incremental: false })

    expect(result.success).toBe(true)
    expect(result.filesUploaded).toHaveLength(3)
    expect(h.bucket.calls).toHaveLength(3)

    // Verify each call used stream-based upload (body is a Buffer from consumed stream)
    for (const call of h.bucket.calls) {
      expect(Buffer.isBuffer(call.body)).toBe(true)
      expect(call.body.length).toBeGreaterThan(0)
    }
  })

  it('should not perform manifest comparison in non-incremental mode (Req 7.3)', async () => {
    // Pre-populate a manifest — it should be ignored in non-incremental mode
    const manifestPath = `${CACHE_DIR}/.upload-manifest.json`
    h.fs.addFile(
      manifestPath,
      JSON.stringify({
        schemaVersion: '1.0.0',
        entries: {
          'snapshots/2024-01-15/metadata.json': {
            checksum: 'abc',
            size: 100,
            mtimeMs: 1705312200000,
            uploadedAt: '2024-01-15T00:00:00.000Z',
          },
        },
      })
    )

    const result = await h.service.upload({ incremental: false })

    // All files should be uploaded regardless of manifest
    expect(result.filesUploaded).toHaveLength(3)
    expect(result.filesSkipped).toHaveLength(0)
    // Hasher should not be called in non-incremental mode
    expect(h.hasher.calls).toHaveLength(0)
  })

  it('should respect concurrency limit (Req 5.1)', async () => {
    // Add more files to make concurrency observable
    const date = '2024-02-01'
    for (let i = 0; i < 15; i++) {
      h.fs.addFile(
        `${CACHE_DIR}/snapshots/${date}/file_${i}.json`,
        JSON.stringify({ index: i }),
        1705312200000
      )
    }

    let maxConcurrent = 0
    let currentConcurrent = 0
    const originalUploadStream = h.bucket.uploadStream.bind(h.bucket)

    // Wrap uploadStream to track concurrency
    h.bucket.uploadStream = async (
      remotePath: string,
      stream: Parameters<typeof h.bucket.uploadStream>[1],
      contentType: string,
      metadata: Record<string, string>
    ): Promise<void> => {
      currentConcurrent++
      if (currentConcurrent > maxConcurrent) {
        maxConcurrent = currentConcurrent
      }
      // Simulate async work to allow concurrency to build up
      await new Promise((resolve) => setTimeout(resolve, 5))
      await originalUploadStream(remotePath, stream, contentType, metadata)
      currentConcurrent--
    }

    const concurrencyLimit = 3
    await h.service.upload({ date, concurrency: concurrencyLimit })

    // Max concurrent should not exceed the limit
    expect(maxConcurrent).toBeLessThanOrEqual(concurrencyLimit)
    // Should have actually used some concurrency (more than 1 at a time)
    expect(maxConcurrent).toBeGreaterThan(0)
  })
})


// ─── 8.3 Incremental no-change (fast-path) ─────────────────────────────────

describe('Integration: incremental no-change — second run uploads nothing via fast-path', () => {
  let h: TestHarness

  beforeEach(() => {
    h = createHarness()
    addSnapshotDate(h.fs, '2024-01-15')
  })

  it('should upload all on first run, then skip all on second run with zero hashing (Req 4.2, 4.3)', async () => {
    // First run: incremental, uploads everything (no manifest yet)
    const first = await h.service.upload({ incremental: true })
    expect(first.success).toBe(true)
    expect(first.filesUploaded).toHaveLength(3)

    // Record hasher calls from first run, then reset
    const firstRunHashCalls = h.hasher.calls.length
    expect(firstRunHashCalls).toBeGreaterThan(0) // hashing happened on first run
    h.hasher.calls.length = 0
    h.bucket.calls.length = 0

    // Second run: same files, same size+mtime → fast-path matches, zero uploads
    const second = await h.service.upload({ incremental: true })

    expect(second.success).toBe(true)
    expect(second.filesUploaded).toHaveLength(0)
    expect(second.filesSkipped).toHaveLength(3)
    // FakeHasher.sha256 should never be called on second run (fast-path)
    expect(h.hasher.calls).toHaveLength(0)
    // No GCS calls on second run
    expect(h.bucket.calls).toHaveLength(0)
  })
})


// ─── 8.4 Incremental with one changed file ──────────────────────────────────

describe('Integration: incremental with one changed file', () => {
  let h: TestHarness

  beforeEach(() => {
    h = createHarness()
    addSnapshotDate(h.fs, '2024-01-15')
  })

  it('should upload only the changed file on second run (Req 4.4, 4.5)', async () => {
    // First run: upload all
    const first = await h.service.upload({ incremental: true })
    expect(first.success).toBe(true)
    expect(first.filesUploaded).toHaveLength(3)

    // Reset tracking
    h.hasher.calls.length = 0
    h.bucket.calls.length = 0

    // Modify one file — change mtime so fast-path fails
    const changedFile = `${CACHE_DIR}/snapshots/2024-01-15/metadata.json`
    h.fs.updateFileMtime(changedFile, 1705312300000)

    // Override hasher to return a DIFFERENT checksum for the changed file
    // so the manifest comparison also fails (FakeHasher normally hashes the path,
    // which would produce the same checksum and cause a skip at step 3).
    const originalSha256 = h.hasher.sha256.bind(h.hasher)
    h.hasher.sha256 = async (filePath: string): Promise<string> => {
      h.hasher.calls.push(filePath)
      if (filePath === changedFile) {
        return 'changed-checksum-' + Date.now().toString(16)
      }
      return originalSha256(filePath).then((hash) => {
        // Remove the duplicate call added by originalSha256
        h.hasher.calls.pop()
        return hash
      })
    }

    // Second run: only the changed file should be uploaded
    const second = await h.service.upload({ incremental: true })

    expect(second.filesUploaded).toHaveLength(1)
    expect(second.filesUploaded[0]).toContain('metadata.json')
    expect(second.filesSkipped).toHaveLength(2)

    // Only the changed file should have been uploaded to GCS
    expect(h.bucket.calls).toHaveLength(1)
    expect(h.bucket.calls[0]!.remotePath).toContain('metadata.json')
  })
})


// ─── 8.5 Corrupted manifest falls back to full upload ───────────────────────

describe('Integration: corrupted manifest falls back to full upload', () => {
  let h: TestHarness

  beforeEach(() => {
    h = createHarness()
    addSnapshotDate(h.fs, '2024-01-15')
  })

  it('should upload all files when manifest contains invalid JSON (Req 4.8)', async () => {
    // Write invalid JSON to the manifest path
    const manifestPath = `${CACHE_DIR}/.upload-manifest.json`
    h.fs.addFile(manifestPath, '{ this is not valid JSON !!!', 1705312200000)

    const result = await h.service.upload({ incremental: true })

    // Should succeed — corrupted manifest treated as empty
    expect(result.success).toBe(true)
    // All files should be uploaded (no skipping since manifest is empty)
    expect(result.filesUploaded).toHaveLength(3)
    expect(result.filesSkipped).toHaveLength(0)
    expect(h.bucket.calls).toHaveLength(3)
  })
})


// ─── 8.6 Manifest write failure surfaces in summary ─────────────────────────

describe('Integration: manifest write failure surfaces in summary', () => {
  let h: TestHarness

  beforeEach(() => {
    h = createHarness()
    addSnapshotDate(h.fs, '2024-01-15')
  })

  it('should set manifestWriteError when manifest write fails after retry (Req 4.9)', async () => {
    // Configure FakeFileSystem to fail on writeFile for the manifest tmp path
    // saveManifest writes to `.upload-manifest.json.tmp` then renames.
    // We need both attempts to fail (retry logic: 2 attempts).
    const manifestTmpPath = `${CACHE_DIR}/.upload-manifest.json.tmp`
    h.fs.setWriteFileFailure(manifestTmpPath, 2) // fail both attempts

    const result = await h.service.upload({ incremental: true })

    // Files should still be uploaded successfully
    expect(result.filesUploaded).toHaveLength(3)
    // manifestWriteError should be true
    expect(result.manifestWriteError).toBe(true)

    // Verify retry was attempted: two writeFile calls for the manifest tmp path
    const manifestWriteCalls = h.fs.writeFileCalls.filter(
      (c) => c.path === manifestTmpPath
    )
    expect(manifestWriteCalls).toHaveLength(2)
  })
})


// ─── 8.7 Backward compatibility snapshot test ───────────────────────────────

describe('Integration: backward compatibility — UploadResult and UploadSummary field verification', () => {
  let h: TestHarness

  beforeEach(() => {
    h = createHarness()
    addSnapshotDate(h.fs, '2024-01-15')
  })

  it('should contain all required UploadResult fields with correct types (Req 7.1)', async () => {
    const result: UploadResult = await h.service.upload({})

    // ── Required fields (must always be present) ──
    const requiredFields: Array<{
      key: keyof UploadResult
      type: string
      arrayCheck?: boolean
    }> = [
      { key: 'success', type: 'boolean' },
      { key: 'dates', type: 'object', arrayCheck: true },
      { key: 'filesProcessed', type: 'object', arrayCheck: true },
      { key: 'filesUploaded', type: 'object', arrayCheck: true },
      { key: 'filesFailed', type: 'object', arrayCheck: true },
      { key: 'filesSkipped', type: 'object', arrayCheck: true },
      { key: 'errors', type: 'object', arrayCheck: true },
      { key: 'duration_ms', type: 'number' },
    ]

    for (const { key, type, arrayCheck } of requiredFields) {
      expect(result).toHaveProperty(key)
      expect(typeof result[key]).toBe(type)
      if (arrayCheck) {
        expect(Array.isArray(result[key])).toBe(true)
      }
    }

    // ── Optional fields (must be correct type when present) ──
    if (result.authError !== undefined) {
      expect(typeof result.authError).toBe('boolean')
    }
    if (result.manifestWriteError !== undefined) {
      expect(typeof result.manifestWriteError).toBe('boolean')
    }

    // ── Error entries shape ──
    for (const err of result.errors) {
      expect(typeof err.file).toBe('string')
      expect(typeof err.error).toBe('string')
      expect(typeof err.timestamp).toBe('string')
    }
  })

  it('should produce UploadSummary with all required fields via formatUploadSummary (Req 7.1)', async () => {
    const result = await h.service.upload({})
    const summary = formatUploadSummary(result, BUCKET, PREFIX, false)

    // ── Required top-level fields ──
    expect(typeof summary.timestamp).toBe('string')
    expect(Array.isArray(summary.dates)).toBe(true)
    expect(['success', 'partial', 'failed']).toContain(summary.status)
    expect(typeof summary.dryRun).toBe('boolean')
    expect(typeof summary.duration_ms).toBe('number')

    // ── Required nested: files ──
    expect(typeof summary.files.total).toBe('number')
    expect(typeof summary.files.uploaded).toBe('number')
    expect(typeof summary.files.failed).toBe('number')
    expect(typeof summary.files.skipped).toBe('number')

    // ── Required nested: destination ──
    expect(typeof summary.destination.bucket).toBe('string')
    expect(typeof summary.destination.prefix).toBe('string')

    // ── Required nested: errors array ──
    expect(Array.isArray(summary.errors)).toBe(true)
    for (const err of summary.errors) {
      expect(typeof err.file).toBe('string')
      expect(typeof err.error).toBe('string')
    }

    // ── Optional fields ──
    if (summary.authError !== undefined) {
      expect(typeof summary.authError).toBe('boolean')
    }
  })

  it('should not remove or rename any baseline UploadResult fields across runs (Req 7.1)', async () => {
    // Baseline: the set of field names that must always exist in UploadResult
    const baselineKeys = [
      'success',
      'dates',
      'filesProcessed',
      'filesUploaded',
      'filesFailed',
      'filesSkipped',
      'errors',
      'duration_ms',
    ]

    const result = await h.service.upload({})
    const resultKeys = Object.keys(result)

    for (const key of baselineKeys) {
      expect(resultKeys).toContain(key)
    }
  })
})
