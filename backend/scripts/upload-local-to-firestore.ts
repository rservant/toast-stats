#!/usr/bin/env npx ts-node
/**
 * Upload Local Cache to Firestore (BulkWriter)
 *
 * Uploads local snapshots, config, and time-series data to Cloud Firestore
 * using BulkWriter for efficient bulk operations with automatic batching,
 * retries, and rate limiting.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
 *   npx ts-node backend/scripts/upload-local-to-firestore.ts <cache-dir> [options]
 *
 * Options:
 *   --dry-run       Show what would be uploaded without actually uploading
 *   --skip-existing Skip documents that already exist in Firestore
 *   --snapshots     Upload only snapshots
 *   --config        Upload only config
 *   --time-series   Upload only time-series
 *
 * Examples:
 *   npx ts-node backend/scripts/upload-local-to-firestore.ts /path/to/ti-cache --dry-run
 *   npx ts-node backend/scripts/upload-local-to-firestore.ts /path/to/ti-cache --skip-existing
 *   npx ts-node backend/scripts/upload-local-to-firestore.ts /path/to/ti-cache --snapshots
 */

import { Firestore, BulkWriter } from '@google-cloud/firestore'
import { promises as fs } from 'fs'
import path from 'path'

// Configuration - matches your Firebase project
const PROJECT_ID = 'toast-stats-prod-6d64a'

interface UploadOptions {
  dryRun: boolean
  skipExisting: boolean
  uploadSnapshots: boolean
  uploadConfig: boolean
  uploadTimeSeries: boolean
}

interface UploadStats {
  snapshots: { uploaded: number; skipped: number; errors: number }
  districts: { uploaded: number; skipped: number; errors: number }
  config: { uploaded: number; skipped: number; errors: number }
  timeSeries: { uploaded: number; skipped: number; errors: number }
}

/**
 * Progress tracker for bulk operations
 */
class ProgressTracker {
  private total = 0
  private completed = 0
  private errors = 0
  private lastLogTime = Date.now()
  private readonly logIntervalMs = 2000

  increment(): void {
    this.total++
  }

  complete(): void {
    this.completed++
    this.maybeLog()
  }

  error(): void {
    this.errors++
    this.completed++
    this.maybeLog()
  }

  private maybeLog(): void {
    const now = Date.now()
    if (now - this.lastLogTime > this.logIntervalMs) {
      this.log()
      this.lastLogTime = now
    }
  }

  log(): void {
    const percent =
      this.total > 0 ? Math.round((this.completed / this.total) * 100) : 0
    console.log(
      `    Progress: ${this.completed}/${this.total} (${percent}%) - ${this.errors} errors`
    )
  }

  getStats(): { total: number; completed: number; errors: number } {
    return { total: this.total, completed: this.completed, errors: this.errors }
  }
}

/**
 * Check if a directory exists
 */
async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath)
    return stat.isDirectory()
  } catch {
    return false
  }
}

/**
 * Read and parse a JSON file
 */
async function readJsonFile(filePath: string): Promise<unknown> {
  const content = await fs.readFile(filePath, 'utf-8')
  return JSON.parse(content)
}

/**
 * Upload snapshots to Firestore using BulkWriter
 *
 * Local structure:
 *   snapshots/
 *     YYYY-MM-DD/
 *       metadata.json
 *       manifest.json
 *       all-districts-rankings.json
 *       district_{id}.json          # District files are in the snapshot root, not a subdirectory
 *
 * Firestore structure:
 *   snapshots/{YYYY-MM-DD}
 *     - metadata: {...}
 *     - manifest: {...}
 *     - rankings: {...}
 *     districts/{district_ID}
 *       - districtId, districtName, collectedAt, status, data
 */
async function uploadSnapshots(
  firestore: Firestore,
  bulkWriter: BulkWriter,
  cacheDir: string,
  options: UploadOptions,
  stats: UploadStats
): Promise<void> {
  const snapshotsDir = path.join(cacheDir, 'snapshots')

  if (!(await directoryExists(snapshotsDir))) {
    console.log('  No snapshots directory found, skipping')
    return
  }

  const entries = await fs.readdir(snapshotsDir, { withFileTypes: true })
  const snapshotDirs = entries
    .filter(e => e.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(e.name))
    .map(e => e.name)
    .sort()

  console.log(`  Found ${snapshotDirs.length} snapshot directories`)

  const progress = new ProgressTracker()

  for (const snapshotId of snapshotDirs) {
    const snapshotPath = path.join(snapshotsDir, snapshotId)
    console.log(`\n  Processing snapshot: ${snapshotId}`)

    // Check if already exists
    if (options.skipExisting) {
      const docRef = firestore.collection('snapshots').doc(snapshotId)
      const doc = await docRef.get()
      if (doc.exists) {
        console.log(`    Skipping (already exists)`)
        stats.snapshots.skipped++
        continue
      }
    }

    try {
      // Read local files
      const metadataPath = path.join(snapshotPath, 'metadata.json')
      const manifestPath = path.join(snapshotPath, 'manifest.json')
      const rankingsPath = path.join(
        snapshotPath,
        'all-districts-rankings.json'
      )

      let metadata: unknown = null
      let manifest: unknown = null
      let rankings: unknown = null

      try {
        metadata = await readJsonFile(metadataPath)
      } catch {
        console.log(`    Warning: No metadata.json found`)
      }

      try {
        manifest = await readJsonFile(manifestPath)
      } catch {
        console.log(`    Warning: No manifest.json found`)
      }

      try {
        rankings = await readJsonFile(rankingsPath)
      } catch {
        console.log(`    No rankings file found (optional)`)
      }

      if (!metadata && !manifest) {
        console.log(`    Error: Missing both metadata and manifest, skipping`)
        stats.snapshots.errors++
        continue
      }

      // Build root document
      const rootDoc: Record<string, unknown> = {}
      if (metadata) rootDoc['metadata'] = metadata
      if (manifest) rootDoc['manifest'] = manifest
      if (rankings) rootDoc['rankings'] = rankings

      if (options.dryRun) {
        console.log(`    [DRY RUN] Would upload root document`)
        stats.snapshots.uploaded++
      } else {
        const docRef = firestore.collection('snapshots').doc(snapshotId)
        progress.increment()
        bulkWriter.set(docRef, rootDoc).then(
          () => {
            progress.complete()
            stats.snapshots.uploaded++
          },
          err => {
            progress.error()
            stats.snapshots.errors++
            console.error(`    Error writing snapshot ${snapshotId}:`, err)
          }
        )
      }

      // Upload district data - files are in the snapshot root directory, named district_{id}.json
      const districtFiles = (await fs.readdir(snapshotPath)).filter(
        f => f.startsWith('district_') && f.endsWith('.json')
      )

      if (districtFiles.length > 0) {
        console.log(`    Queueing ${districtFiles.length} district files...`)

        for (const districtFile of districtFiles) {
          // Extract district ID from filename: district_42.json -> 42
          const districtId = districtFile
            .replace('district_', '')
            .replace('.json', '')

          try {
            // The local file already has the correct structure:
            // { districtId, districtName, collectedAt, status, data: DistrictStatistics }
            const districtDoc = (await readJsonFile(
              path.join(snapshotPath, districtFile)
            )) as Record<string, unknown>

            if (options.dryRun) {
              stats.districts.uploaded++
            } else {
              const districtDocRef = firestore
                .collection('snapshots')
                .doc(snapshotId)
                .collection('districts')
                .doc(`district_${districtId}`)

              progress.increment()
              bulkWriter.set(districtDocRef, districtDoc).then(
                () => {
                  progress.complete()
                  stats.districts.uploaded++
                },
                err => {
                  progress.error()
                  stats.districts.errors++
                  console.error(
                    `      Error writing district ${districtId}:`,
                    err
                  )
                }
              )
            }
          } catch (err) {
            console.log(`      Error reading district ${districtId}: ${err}`)
            stats.districts.errors++
          }
        }

        if (options.dryRun) {
          console.log(
            `    [DRY RUN] Would upload ${districtFiles.length} districts`
          )
        }
      }
    } catch (error) {
      console.error(`    Error processing snapshot ${snapshotId}:`, error)
      stats.snapshots.errors++
    }
  }

  // Flush remaining writes for snapshots
  if (!options.dryRun) {
    console.log('\n    Flushing snapshot writes...')
    await bulkWriter.flush()
    progress.log()
  }
}

/**
 * Upload config collection to Firestore using BulkWriter
 *
 * Local structure:
 *   config/
 *     {documentId}.json
 *
 * Firestore structure:
 *   config/{documentId}
 */
async function uploadConfig(
  firestore: Firestore,
  bulkWriter: BulkWriter,
  cacheDir: string,
  options: UploadOptions,
  stats: UploadStats
): Promise<void> {
  const configDir = path.join(cacheDir, 'config')

  if (!(await directoryExists(configDir))) {
    console.log('  No config directory found, skipping')
    return
  }

  const files = await fs.readdir(configDir)
  const jsonFiles = files.filter(f => f.endsWith('.json'))

  console.log(`  Found ${jsonFiles.length} config files`)

  const progress = new ProgressTracker()

  for (const file of jsonFiles) {
    const docId = file.replace('.json', '')

    try {
      // Check if already exists
      if (options.skipExisting) {
        const docRef = firestore.collection('config').doc(docId)
        const doc = await docRef.get()
        if (doc.exists) {
          console.log(`    Skipping ${docId} (already exists)`)
          stats.config.skipped++
          continue
        }
      }

      const data = await readJsonFile(path.join(configDir, file))

      if (options.dryRun) {
        console.log(`    [DRY RUN] Would upload config/${docId}`)
        stats.config.uploaded++
      } else {
        const docRef = firestore.collection('config').doc(docId)
        progress.increment()
        bulkWriter.set(docRef, data as Record<string, unknown>).then(
          () => {
            progress.complete()
            stats.config.uploaded++
          },
          err => {
            progress.error()
            stats.config.errors++
            console.error(`    Error writing config ${docId}:`, err)
          }
        )
      }
    } catch (err) {
      console.error(`    Error reading config ${docId}:`, err)
      stats.config.errors++
    }
  }

  if (!options.dryRun && jsonFiles.length > 0) {
    console.log('    Flushing config writes...')
    await bulkWriter.flush()
    progress.log()
  }
}

/**
 * Upload time-series collection to Firestore using BulkWriter
 *
 * Local structure:
 *   time-series/
 *     district_{districtId}/
 *       {programYear}.json       # e.g., 2023-2024.json
 *
 * Firestore structure (subcollection pattern):
 *   time-series/{districtId}/program-years/{programYear}
 *     - districtId, programYear, startDate, endDate, lastUpdated, dataPoints, summary
 */
async function uploadTimeSeries(
  firestore: Firestore,
  bulkWriter: BulkWriter,
  cacheDir: string,
  options: UploadOptions,
  stats: UploadStats
): Promise<void> {
  const timeSeriesDir = path.join(cacheDir, 'time-series')

  if (!(await directoryExists(timeSeriesDir))) {
    console.log('  No time-series directory found, skipping')
    return
  }

  const entries = await fs.readdir(timeSeriesDir, { withFileTypes: true })
  const progress = new ProgressTracker()

  // Look for district_* subdirectories (the correct local structure)
  const districtDirs = entries.filter(
    e => e.isDirectory() && e.name.startsWith('district_')
  )

  if (districtDirs.length === 0) {
    console.log('  No district directories found in time-series, skipping')
    return
  }

  console.log(`  Found ${districtDirs.length} district directories`)

  let totalFiles = 0
  for (const districtDir of districtDirs) {
    // Extract district ID from folder name: district_42 -> 42
    const districtId = districtDir.name.replace('district_', '')
    const districtPath = path.join(timeSeriesDir, districtDir.name)

    const files = await fs.readdir(districtPath)
    // Program year files are like 2023-2024.json (not index-metadata.json)
    const programYearFiles = files.filter(
      f =>
        f.endsWith('.json') &&
        f !== 'index-metadata.json' &&
        /^\d{4}-\d{4}\.json$/.test(f)
    )

    if (programYearFiles.length === 0) {
      continue
    }

    console.log(
      `    District ${districtId}: ${programYearFiles.length} program year files`
    )
    totalFiles += programYearFiles.length

    for (const file of programYearFiles) {
      // Extract program year from filename: 2023-2024.json -> 2023-2024
      const programYear = file.replace('.json', '')

      try {
        // Check if already exists in Firestore subcollection
        if (options.skipExisting) {
          const docRef = firestore
            .collection('time-series')
            .doc(districtId)
            .collection('program-years')
            .doc(programYear)
          const doc = await docRef.get()
          if (doc.exists) {
            stats.timeSeries.skipped++
            continue
          }
        }

        // Read the local program year file - it already has the correct structure
        const data = await readJsonFile(path.join(districtPath, file))

        if (options.dryRun) {
          stats.timeSeries.uploaded++
        } else {
          // Upload to subcollection: time-series/{districtId}/program-years/{programYear}
          const docRef = firestore
            .collection('time-series')
            .doc(districtId)
            .collection('program-years')
            .doc(programYear)

          progress.increment()
          bulkWriter.set(docRef, data as Record<string, unknown>).then(
            () => {
              progress.complete()
              stats.timeSeries.uploaded++
            },
            err => {
              progress.error()
              stats.timeSeries.errors++
              console.error(
                `    Error writing time-series ${districtId}/${programYear}:`,
                err
              )
            }
          )
        }
      } catch (err) {
        console.error(
          `    Error reading time-series ${districtId}/${programYear}:`,
          err
        )
        stats.timeSeries.errors++
      }
    }
  }

  if (options.dryRun) {
    console.log(
      `    [DRY RUN] Would upload ${totalFiles} time-series documents`
    )
  }

  if (!options.dryRun && totalFiles > 0) {
    console.log('    Flushing time-series writes...')
    await bulkWriter.flush()
    progress.log()
  }
}

/**
 * Main upload function
 */
async function uploadToFirestore(
  cacheDir: string,
  options: UploadOptions
): Promise<void> {
  console.log('='.repeat(60))
  console.log('Upload Local Cache to Firestore (BulkWriter)')
  console.log('='.repeat(60))
  console.log()
  console.log(`Source: ${cacheDir}`)
  console.log(`Project: ${PROJECT_ID}`)
  console.log(`Dry run: ${options.dryRun}`)
  console.log(`Skip existing: ${options.skipExisting}`)
  console.log()

  // Verify cache directory exists
  if (!(await directoryExists(cacheDir))) {
    console.error(`Error: Cache directory does not exist: ${cacheDir}`)
    process.exit(1)
  }

  const firestore = new Firestore({ projectId: PROJECT_ID })

  // Create BulkWriter with throttling for large uploads
  const bulkWriter = firestore.bulkWriter()

  // Configure error handling
  bulkWriter.onWriteError(error => {
    if (error.failedAttempts < 3) {
      // Retry up to 3 times
      return true
    }
    console.error(
      `Failed to write after ${error.failedAttempts} attempts:`,
      error.documentRef.path
    )
    return false
  })

  const stats: UploadStats = {
    snapshots: { uploaded: 0, skipped: 0, errors: 0 },
    districts: { uploaded: 0, skipped: 0, errors: 0 },
    config: { uploaded: 0, skipped: 0, errors: 0 },
    timeSeries: { uploaded: 0, skipped: 0, errors: 0 },
  }

  const startTime = Date.now()

  // Upload snapshots
  if (options.uploadSnapshots) {
    console.log('\n� Uploading Snapshots...')
    await uploadSnapshots(firestore, bulkWriter, cacheDir, options, stats)
  }

  // Upload config
  if (options.uploadConfig) {
    console.log('\n⚙️  Uploading Config...')
    await uploadConfig(firestore, bulkWriter, cacheDir, options, stats)
  }

  // Upload time-series
  if (options.uploadTimeSeries) {
    console.log('\n📈 Uploading Time-Series...')
    await uploadTimeSeries(firestore, bulkWriter, cacheDir, options, stats)
  }

  // Final flush and close
  if (!options.dryRun) {
    console.log('\n⏳ Finalizing all writes...')
    await bulkWriter.close()
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1)

  // Print summary
  console.log('\n' + '='.repeat(60))
  console.log('Summary')
  console.log('='.repeat(60))
  console.log(
    `Snapshots:   ${stats.snapshots.uploaded} uploaded, ${stats.snapshots.skipped} skipped, ${stats.snapshots.errors} errors`
  )
  console.log(
    `Districts:   ${stats.districts.uploaded} uploaded, ${stats.districts.skipped} skipped, ${stats.districts.errors} errors`
  )
  console.log(
    `Config:      ${stats.config.uploaded} uploaded, ${stats.config.skipped} skipped, ${stats.config.errors} errors`
  )
  console.log(
    `Time-Series: ${stats.timeSeries.uploaded} uploaded, ${stats.timeSeries.skipped} skipped, ${stats.timeSeries.errors} errors`
  )
  console.log(`Duration:    ${duration}s`)

  if (options.dryRun) {
    console.log('\n⚠️  This was a dry run. No data was actually uploaded.')
    console.log('   Remove --dry-run to perform the actual upload.')
  }

  console.log('\nDone!')
}

// Parse command line arguments
const args = process.argv.slice(2)
const cacheDir = args.find(arg => !arg.startsWith('--'))

if (!cacheDir) {
  console.error(
    'Usage: npx ts-node upload-local-to-firestore.ts <cache-dir> [options]'
  )
  console.error('')
  console.error('Options:')
  console.error(
    '  --dry-run       Show what would be uploaded without uploading'
  )
  console.error('  --skip-existing Skip documents that already exist')
  console.error('  --snapshots     Upload only snapshots')
  console.error('  --config        Upload only config')
  console.error('  --time-series   Upload only time-series')
  process.exit(1)
}

const dryRun = args.includes('--dry-run')
const skipExisting = args.includes('--skip-existing')
const snapshotsOnly = args.includes('--snapshots')
const configOnly = args.includes('--config')
const timeSeriesOnly = args.includes('--time-series')

// If no specific collection is specified, upload all
const uploadAll = !snapshotsOnly && !configOnly && !timeSeriesOnly

const options: UploadOptions = {
  dryRun,
  skipExisting,
  uploadSnapshots: uploadAll || snapshotsOnly,
  uploadConfig: uploadAll || configOnly,
  uploadTimeSeries: uploadAll || timeSeriesOnly,
}

uploadToFirestore(cacheDir, options)
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Upload failed:', err)
    process.exit(1)
  })
