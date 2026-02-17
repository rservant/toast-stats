/**
 * Property-Based Tests for UploadService
 *
 * Property 2: Date range filtering
 * For any list of valid YYYY-MM-DD date strings and any since/until pair
 * where since <= until, filterDatesByRange(dates, since, until) SHALL return
 * only dates d where since <= d <= until (lexicographic comparison), and
 * SHALL include all such dates from the input.
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.7**
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import {
  UploadService,
  type UploadManifestEntry,
} from '../services/UploadService.js'
import {
  FakeFileSystem,
  FakeBucketClient,
  FakeClock,
  FakeHasher,
  FakeProgressReporter,
} from './fakes/index.js'

/**
 * Arbitrary for valid YYYY-MM-DD date strings.
 * Constrains to realistic date ranges to keep the input space meaningful.
 */
const arbDateString = fc
  .record({
    year: fc.integer({ min: 2000, max: 2099 }),
    month: fc.integer({ min: 1, max: 12 }),
    day: fc.integer({ min: 1, max: 28 }), // 28 to avoid invalid dates
  })
  .map(
    ({ year, month, day }) =>
      `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  )

/**
 * Arbitrary for a list of unique date strings (simulating snapshot dates).
 */
const arbDateList = fc.uniqueArray(arbDateString, {
  minLength: 0,
  maxLength: 50,
})

/**
 * Arbitrary for a since/until pair where since <= until (lexicographic).
 */
const arbDateRange = fc
  .tuple(arbDateString, arbDateString)
  .map(([a, b]) => (a <= b ? { since: a, until: b } : { since: b, until: a }))

function createUploadService(): UploadService {
  const fs = new FakeFileSystem()
  fs.addDirectory('/cache/snapshots')
  return new UploadService({
    cacheDir: '/cache',
    bucket: 'test-bucket',
    prefix: 'snapshots',
    fs,
    hasher: new FakeHasher(),
    bucketClient: new FakeBucketClient(),
    clock: new FakeClock(),
    progressReporter: new FakeProgressReporter(),
  })
}

describe('UploadService Property Tests', () => {
  describe('Property 2: Date range filtering', () => {
    it('returns only dates within [since, until] inclusive range', () => {
      const service = createUploadService()

      fc.assert(
        fc.property(arbDateList, arbDateRange, (dates, { since, until }) => {
          const result = service.filterDatesByRange(dates, since, until)

          // Every returned date must be within [since, until]
          for (const date of result) {
            expect(date >= since).toBe(true)
            expect(date <= until).toBe(true)
          }
        }),
        { numRuns: 200 }
      )
    })

    it('includes all dates from input that fall within [since, until]', () => {
      const service = createUploadService()

      fc.assert(
        fc.property(arbDateList, arbDateRange, (dates, { since, until }) => {
          const result = service.filterDatesByRange(dates, since, until)
          const resultSet = new Set(result)

          // Every input date within range must appear in result
          for (const date of dates) {
            if (date >= since && date <= until) {
              expect(resultSet.has(date)).toBe(true)
            }
          }
        }),
        { numRuns: 200 }
      )
    })

    it('with only since provided, returns dates >= since', () => {
      const service = createUploadService()

      fc.assert(
        fc.property(arbDateList, arbDateString, (dates, since) => {
          const result = service.filterDatesByRange(dates, since, undefined)

          // All returned dates must be >= since
          for (const date of result) {
            expect(date >= since).toBe(true)
          }

          // All input dates >= since must be in result
          const resultSet = new Set(result)
          for (const date of dates) {
            if (date >= since) {
              expect(resultSet.has(date)).toBe(true)
            }
          }
        }),
        { numRuns: 200 }
      )
    })

    it('with only until provided, returns dates <= until', () => {
      const service = createUploadService()

      fc.assert(
        fc.property(arbDateList, arbDateString, (dates, until) => {
          const result = service.filterDatesByRange(dates, undefined, until)

          // All returned dates must be <= until
          for (const date of result) {
            expect(date <= until).toBe(true)
          }

          // All input dates <= until must be in result
          const resultSet = new Set(result)
          for (const date of dates) {
            if (date <= until) {
              expect(resultSet.has(date)).toBe(true)
            }
          }
        }),
        { numRuns: 200 }
      )
    })

    it('with neither since nor until, returns all dates unchanged', () => {
      const service = createUploadService()

      fc.assert(
        fc.property(arbDateList, dates => {
          const result = service.filterDatesByRange(dates, undefined, undefined)
          expect(result).toEqual(dates)
        }),
        { numRuns: 200 }
      )
    })
  })
})

/**
 * Property 5: File collector completeness
 *
 * For any directory tree, the async generator collectFiles SHALL yield exactly
 * one FileInfo for each regular file in the tree, with no duplicates and no
 * omissions.
 *
 * Tested via the upload method in dry-run mode (which consumes collectFiles
 * internally). The filesProcessed array in the result reflects every file
 * yielded by the generator.
 *
 * **Validates: Requirements 6.1**
 */

/**
 * Arbitrary for a valid filename segment (no slashes, no empty strings).
 */
const arbFileName = fc.stringMatching(/^[a-z0-9_-]{1,8}$/).map(s => s + '.json') // ensure a file extension

/**
 * Arbitrary for a directory name segment.
 */
const arbDirName = fc.stringMatching(/^[a-z0-9_-]{1,8}$/)

/**
 * Represents a file at a relative path within a snapshot date directory.
 */
interface TreeFile {
  /** Path segments relative to the date directory, e.g. ['subdir', 'file.json'] */
  segments: string[]
}

/**
 * Arbitrary for a flat or nested directory tree of files.
 * Generates a list of unique file paths (as segment arrays) within a snapshot date.
 */
const arbDirectoryTree: fc.Arbitrary<TreeFile[]> = fc
  .array(
    fc.tuple(fc.array(arbDirName, { minLength: 0, maxLength: 3 }), arbFileName),
    { minLength: 1, maxLength: 20 }
  )
  .map(entries => {
    // Deduplicate by full path string to ensure unique files
    const seen = new Set<string>()
    const files: TreeFile[] = []
    for (const [dirs, name] of entries) {
      const segments = [...dirs, name]
      const key = segments.join('/')
      if (!seen.has(key)) {
        seen.add(key)
        files.push({ segments })
      }
    }
    return files
  })
  .filter(files => files.length > 0)

describe('Property 5: File collector completeness', () => {
  it('yields exactly one FileInfo per regular file — no duplicates, no omissions', async () => {
    const snapshotDate = '2024-01-15'

    await fc.assert(
      fc.asyncProperty(arbDirectoryTree, async treeFiles => {
        // Build a FakeFileSystem with the generated tree under a snapshot date
        const fs = new FakeFileSystem()
        const basePath = `/cache/snapshots/${snapshotDate}`
        fs.addDirectory(basePath)

        for (const file of treeFiles) {
          const filePath = `${basePath}/${file.segments.join('/')}`
          fs.addFile(filePath, `content-of-${file.segments.join('/')}`)
        }

        // Create service with the populated filesystem
        const service = new UploadService({
          cacheDir: '/cache',
          bucket: 'test-bucket',
          prefix: 'snapshots',
          fs,
          hasher: new FakeHasher(),
          bucketClient: new FakeBucketClient(),
          clock: new FakeClock(),
          progressReporter: new FakeProgressReporter(),
        })

        // Run upload in dry-run mode to exercise collectFiles
        const result = await service.upload({
          date: snapshotDate,
          dryRun: true,
        })

        // Build expected set of remote paths
        const expectedPaths = new Set(
          treeFiles.map(
            f => `snapshots/${snapshotDate}/${f.segments.join('/')}`
          )
        )

        const processedPaths = new Set(result.filesProcessed)

        // No omissions: every expected file must be in filesProcessed
        for (const expected of expectedPaths) {
          expect(processedPaths.has(expected)).toBe(true)
        }

        // No extras: every processed file must be in expected set
        for (const processed of processedPaths) {
          expect(expectedPaths.has(processed)).toBe(true)
        }

        // No duplicates: filesProcessed length equals unique count
        expect(result.filesProcessed.length).toBe(expectedPaths.size)
      }),
      { numRuns: 100 }
    )
  })
})

/**
 * Property 3: Manifest fast-path correctness
 *
 * For any file where size and mtimeMs match the manifest entry,
 * shouldSkipFastPath SHALL return true. For any file where size or mtimeMs
 * differ from the manifest entry (or no entry exists), shouldSkipFastPath
 * SHALL return false.
 *
 * **Validates: Requirements 4.2, 4.3**
 */

/**
 * Arbitrary for file metadata (size and mtimeMs).
 */
const arbFileMetadata = fc.record({
  size: fc.integer({ min: 0, max: 10_000_000 }),
  mtimeMs: fc.integer({ min: 0, max: 2_000_000_000_000 }),
})

/**
 * Arbitrary for a manifest entry with all required fields.
 */
const arbManifestEntry: fc.Arbitrary<UploadManifestEntry> = fc.record({
  checksum: fc
    .string({ minLength: 64, maxLength: 64 })
    .map(s => s.replace(/[^a-f0-9]/g, 'a').padEnd(64, '0')),
  size: fc.integer({ min: 0, max: 10_000_000 }),
  mtimeMs: fc.integer({ min: 0, max: 2_000_000_000_000 }),
  uploadedAt: fc.constant('2024-01-15T10:30:00.000Z'),
})

describe('Property 3: Manifest fast-path correctness', () => {
  const service = createUploadService()

  it('returns true when size and mtimeMs both match the manifest entry', () => {
    fc.assert(
      fc.property(arbManifestEntry, entry => {
        const fileInfo = { size: entry.size, mtimeMs: entry.mtimeMs }
        expect(service.shouldSkipFastPath(fileInfo, entry)).toBe(true)
      }),
      { numRuns: 200 }
    )
  })

  it('returns false when size differs from the manifest entry', () => {
    fc.assert(
      fc.property(
        arbManifestEntry,
        fc.integer({ min: 1, max: 10_000_000 }),
        (entry, sizeDelta) => {
          const differentSize = entry.size + sizeDelta
          // Ensure size actually differs (avoid overflow wrapping to same value)
          fc.pre(differentSize !== entry.size)
          const fileInfo = { size: differentSize, mtimeMs: entry.mtimeMs }
          expect(service.shouldSkipFastPath(fileInfo, entry)).toBe(false)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('returns false when mtimeMs differs from the manifest entry', () => {
    fc.assert(
      fc.property(
        arbManifestEntry,
        fc.integer({ min: 1, max: 1_000_000 }),
        (entry, mtimeDelta) => {
          const differentMtime = entry.mtimeMs + mtimeDelta
          fc.pre(differentMtime !== entry.mtimeMs)
          const fileInfo = { size: entry.size, mtimeMs: differentMtime }
          expect(service.shouldSkipFastPath(fileInfo, entry)).toBe(false)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('returns false when both size and mtimeMs differ', () => {
    fc.assert(
      fc.property(arbManifestEntry, arbFileMetadata, (entry, fileInfo) => {
        fc.pre(
          fileInfo.size !== entry.size || fileInfo.mtimeMs !== entry.mtimeMs
        )
        // At least one differs, so should not skip
        if (
          fileInfo.size !== entry.size ||
          fileInfo.mtimeMs !== entry.mtimeMs
        ) {
          expect(service.shouldSkipFastPath(fileInfo, entry)).toBe(false)
        }
      }),
      { numRuns: 200 }
    )
  })

  it('returns false when no manifest entry exists (undefined)', () => {
    fc.assert(
      fc.property(arbFileMetadata, fileInfo => {
        expect(service.shouldSkipFastPath(fileInfo, undefined)).toBe(false)
      }),
      { numRuns: 200 }
    )
  })
})

/**
 * Property 4: Summary count invariant
 *
 * For any upload operation result, filesProcessed.length SHALL equal
 * filesUploaded.length + filesFailed.length + filesSkipped.length.
 *
 * Uses FakeBucketClient with configurable failures to exercise various
 * combinations of uploaded/failed/skipped files.
 *
 * **Validates: Requirements 5.6, 6.3**
 */

/**
 * Arbitrary for a file configuration: name and whether it should fail on upload.
 */
const arbFileConfig = fc.record({
  name: fc.stringMatching(/^[a-z][a-z0-9]{0,7}$/).map(s => s + '.json'),
  shouldFail: fc.boolean(),
})

/**
 * Arbitrary for a set of unique file configs for a single snapshot date.
 */
const arbFileConfigs = fc.uniqueArray(arbFileConfig, {
  minLength: 1,
  maxLength: 15,
  selector: c => c.name,
})

/**
 * Arbitrary for whether incremental mode is enabled.
 * When incremental, some files may be skipped via fast-path.
 */
const arbIncremental = fc.boolean()

describe('Property 4: Summary count invariant', () => {
  it('filesProcessed.length === filesUploaded.length + filesFailed.length + filesSkipped.length', async () => {
    const snapshotDate = '2024-06-15'

    await fc.assert(
      fc.asyncProperty(
        arbFileConfigs,
        arbIncremental,
        async (fileConfigs, incremental) => {
          const fakeFs = new FakeFileSystem()
          const basePath = `/cache/snapshots/${snapshotDate}`
          fakeFs.addDirectory(basePath)
          fakeFs.addDirectory('/cache')

          // Add files to the fake filesystem
          for (const config of fileConfigs) {
            fakeFs.addFile(
              `${basePath}/${config.name}`,
              `content-${config.name}`,
              1000000
            )
          }

          const fakeBucket = new FakeBucketClient()

          // Configure failures for files that should fail (non-auth errors)
          for (const config of fileConfigs) {
            if (config.shouldFail) {
              const remotePath = `snapshots/${snapshotDate}/${config.name}`
              fakeBucket.setFailure(
                remotePath,
                new Error(`Upload failed: ${config.name}`)
              )
            }
          }

          const service = new UploadService({
            cacheDir: '/cache',
            bucket: 'test-bucket',
            prefix: 'snapshots',
            fs: fakeFs,
            hasher: new FakeHasher(),
            bucketClient: fakeBucket,
            clock: new FakeClock(),
            progressReporter: new FakeProgressReporter(),
          })

          const result = await service.upload({
            date: snapshotDate,
            incremental,
            dryRun: false,
            concurrency: 5,
          })

          // Property 4: Summary count invariant
          expect(result.filesProcessed.length).toBe(
            result.filesUploaded.length +
              result.filesFailed.length +
              result.filesSkipped.length
          )
        }
      ),
      { numRuns: 100 }
    )
  })

  it('holds when auth error causes early abort', async () => {
    const snapshotDate = '2024-06-15'

    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(
          fc.stringMatching(/^[a-z][a-z0-9]{0,5}$/).map(s => s + '.json'),
          { minLength: 3, maxLength: 15 }
        ),
        fc.integer({ min: 0, max: 14 }),
        async (fileNames, authFailIndex) => {
          const safeIndex = authFailIndex % fileNames.length

          const fakeFs = new FakeFileSystem()
          const basePath = `/cache/snapshots/${snapshotDate}`
          fakeFs.addDirectory(basePath)
          fakeFs.addDirectory('/cache')

          for (const name of fileNames) {
            fakeFs.addFile(`${basePath}/${name}`, `content-${name}`, 1000000)
          }

          const fakeBucket = new FakeBucketClient()

          // Set auth error on one file (deterministic code-based)
          const authFileName = fileNames[safeIndex]!
          const authRemotePath = `snapshots/${snapshotDate}/${authFileName}`
          const authErr = new Error('UNAUTHENTICATED') as Error & {
            code: string
          }
          authErr.code = 'UNAUTHENTICATED'
          fakeBucket.setFailure(authRemotePath, authErr)

          const service = new UploadService({
            cacheDir: '/cache',
            bucket: 'test-bucket',
            prefix: 'snapshots',
            fs: fakeFs,
            hasher: new FakeHasher(),
            bucketClient: fakeBucket,
            clock: new FakeClock(),
            progressReporter: new FakeProgressReporter(),
          })

          const result = await service.upload({
            date: snapshotDate,
            dryRun: false,
            concurrency: 3,
          })

          // Property 4 must hold even on auth abort
          expect(result.filesProcessed.length).toBe(
            result.filesUploaded.length +
              result.filesFailed.length +
              result.filesSkipped.length
          )

          // Auth error must be flagged
          expect(result.authError).toBe(true)
        }
      ),
      { numRuns: 50 }
    )
  })
})
