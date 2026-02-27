#!/usr/bin/env npx ts-node
/**
 * Prune Daily GCS Snapshot Folders (Step 3 of #140 — DESTRUCTIVE)
 *
 * Deletes all GCS snapshot folders (snapshots/{date}/) that are NOT
 * month-end keepers for completed program years.
 *
 * Safety guarantees:
 *   - Current program year snapshots are NEVER deleted (hard exit if violated)
 *   - Defaults to --dry-run; requires explicit --execute to delete
 *   - Processes deletes in parallel batches of 10 folders
 *   - Logs every folder before deleting
 *
 * Prerequisites:
 *   - Run find-month-end-dates.ts first to verify keeper dates look correct
 *   - Run generate-month-end-snapshots.ts --execute to ensure month-end
 *     snapshots exist in GCS before pruning
 *
 * Usage:
 *   npx ts-node scripts/prune-daily-snapshots.ts
 *   npx ts-node scripts/prune-daily-snapshots.ts --execute
 *   npx ts-node scripts/prune-daily-snapshots.ts --program-year 2024-2025
 */

import { Storage } from '@google-cloud/storage'
import {
  buildMonthEndSummary,
  isProgramYearComplete,
  getProgramYearForMonth,
  type RawCSVEntry,
} from './lib/monthEndDates.js'

// ── Config ────────────────────────────────────────────────────────────────────

const RAW_CSV_PREFIX = 'raw-csv'
const SNAPSHOT_PREFIX = 'snapshots'
const METADATA_FILENAME = 'metadata.json'

interface Args {
  bucket: string
  projectId: string | undefined
  dryRun: boolean
  programYear: string | undefined
}

function parseArgs(): Args {
  const args = process.argv.slice(2)
  let bucket = process.env['GCS_BUCKET'] ?? 'toast-stats-data'
  const projectId = process.env['GCP_PROJECT_ID']
  let dryRun = true
  let programYear: string | undefined

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--execute') dryRun = false
    else if (arg === '--dry-run') dryRun = true
    else if (arg === '--bucket' && args[i + 1]) bucket = args[++i]!
    else if (arg === '--program-year' && args[i + 1]) programYear = args[++i]!
  }

  return { bucket, projectId, dryRun, programYear }
}

// ── GCS Helpers ───────────────────────────────────────────────────────────────

async function listSnapshotDates(
  storage: Storage,
  bucketName: string
): Promise<string[]> {
  const bucket = storage.bucket(bucketName)
  const prefix = `${SNAPSHOT_PREFIX}/`

  const [, , apiResponse] = await bucket.getFiles({
    prefix,
    delimiter: '/',
    autoPaginate: true,
  })

  const response = apiResponse as Record<string, unknown>
  const prefixes: string[] =
    (response?.['prefixes'] as string[] | undefined) ?? []

  const dates: string[] = []
  for (const p of prefixes) {
    const date = p.replace(prefix, '').replace(/\/$/, '')
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) dates.push(date)
  }
  return dates.sort()
}

async function listRawCSVDates(
  storage: Storage,
  bucketName: string
): Promise<string[]> {
  const bucket = storage.bucket(bucketName)
  const prefix = `${RAW_CSV_PREFIX}/`

  const [, , apiResponse] = await bucket.getFiles({
    prefix,
    delimiter: '/',
    autoPaginate: true,
  })

  const response = apiResponse as Record<string, unknown>
  const prefixes: string[] =
    (response?.['prefixes'] as string[] | undefined) ?? []

  const dates: string[] = []
  for (const p of prefixes) {
    const date = p.replace(prefix, '').replace(/\/$/, '')
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) dates.push(date)
  }
  return dates.sort()
}

async function readMetadataForDate(
  storage: Storage,
  bucketName: string,
  date: string
): Promise<RawCSVEntry> {
  try {
    const objectPath = `${RAW_CSV_PREFIX}/${date}/${METADATA_FILENAME}`
    const file = storage.bucket(bucketName).file(objectPath)
    const [buffer] = await file.download()
    const meta = JSON.parse(buffer.toString('utf-8')) as {
      isClosingPeriod?: boolean
      dataMonth?: string
    }
    return {
      collectionDate: date,
      isClosingPeriod: meta.isClosingPeriod === true,
      dataMonth: meta.dataMonth,
    }
  } catch {
    return {
      collectionDate: date,
      isClosingPeriod: false,
      dataMonth: undefined,
    }
  }
}

/**
 * Delete all objects under snapshots/{date}/ in GCS.
 * Returns the number of objects deleted.
 */
async function deleteSnapshotFolder(
  storage: Storage,
  bucketName: string,
  date: string
): Promise<number> {
  const bucket = storage.bucket(bucketName)
  const prefix = `${SNAPSHOT_PREFIX}/${date}/`
  const [files] = await bucket.getFiles({ prefix })

  if (files.length === 0) return 0

  await Promise.all(files.map(f => f.delete()))
  return files.length
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { bucket, projectId, dryRun, programYear } = parseArgs()
  const today = new Date()

  console.log('='.repeat(80))
  console.log(
    dryRun
      ? 'Prune Daily Snapshots [DRY RUN — no changes will be made]'
      : '⚠️  Prune Daily Snapshots [EXECUTE MODE — DELETING GCS OBJECTS]'
  )
  console.log('='.repeat(80))
  console.log(`Bucket: gs://${bucket}/`)
  if (programYear) console.log(`Filter: program year ${programYear} only`)
  console.log()

  const storage = new Storage({ projectId })

  // Step 1: Discover month-end keeper dates from raw-csv metadata
  console.log('Step 1: Scanning raw-csv/ to identify month-end keeper dates...')
  const rawDates = await listRawCSVDates(storage, bucket)

  const BATCH_SIZE = 20
  const entries: RawCSVEntry[] = []
  for (let i = 0; i < rawDates.length; i += BATCH_SIZE) {
    const batch = rawDates.slice(i, i + BATCH_SIZE)
    const results = await Promise.all(
      batch.map(d => readMetadataForDate(storage, bucket, d))
    )
    entries.push(...results)
  }

  const summaries = buildMonthEndSummary(entries, today)

  // Build the complete set of keeper collection dates
  const keeperDates = new Set<string>()
  for (const s of summaries) {
    if (!s.isComplete) continue
    if (programYear && s.year !== programYear) continue
    for (const r of s.monthResults) {
      keeperDates.add(r.lastClosingDate)
    }
  }

  console.log(`  Found ${keeperDates.size} month-end keeper dates.`)
  console.log()

  // Step 2: List all GCS snapshot dates
  console.log('Step 2: Listing all GCS snapshot folders...')
  const snapshotDates = await listSnapshotDates(storage, bucket)
  console.log(`  Found ${snapshotDates.length} snapshot folders.`)
  console.log()

  // Step 3: Classify each snapshot date
  const toDelete: string[] = []
  const toKeep: string[] = []
  const currentPYGuardViolations: string[] = []

  for (const date of snapshotDates) {
    // Skip if scoped to a specific program year and this date isn't in it
    if (programYear) {
      const [yearStr, monthStr] = date.split('-')
      if (yearStr && monthStr) {
        const year = parseInt(yearStr, 10)
        const month = parseInt(monthStr, 10)
        const pyStart = month >= 7 ? year : year - 1
        const datePY = `${pyStart}-${pyStart + 1}`
        if (datePY !== programYear) {
          toKeep.push(date)
          continue
        }
      }
    }

    // Hard guard: never delete current program year snapshots
    // Derive the program year from the snapshot date
    const [yearStr, monthStr] = date.split('-')
    if (yearStr && monthStr) {
      const year = parseInt(yearStr, 10)
      const month = parseInt(monthStr, 10)
      const pyStart = month >= 7 ? year : year - 1
      const datePY = `${pyStart}-${pyStart + 1}`

      if (!isProgramYearComplete(datePY, today)) {
        toKeep.push(date)
        continue
      }
    }

    if (keeperDates.has(date)) {
      toKeep.push(date)
    } else {
      // Verify this would-be deletion is not in the current program year
      // (paranoid double-check using snapshot metadata if available)
      const [yearStr, monthStr] = date.split('-')
      if (yearStr && monthStr) {
        const year = parseInt(yearStr, 10)
        const month = parseInt(monthStr, 10)
        const pyStart = month >= 7 ? year : year - 1
        const datePY = `${pyStart}-${pyStart + 1}`

        if (!isProgramYearComplete(datePY, today)) {
          // SAFETY VIOLATION — this should never happen given the guard above
          currentPYGuardViolations.push(date)
          continue
        }
      }

      toDelete.push(date)
    }
  }

  // Hard fail on safety violations
  if (currentPYGuardViolations.length > 0) {
    console.error('FATAL: Current program year guard violation!')
    console.error('The following dates would have been incorrectly deleted:')
    for (const d of currentPYGuardViolations) {
      console.error(`  ${d}`)
    }
    process.exit(1)
  }

  // Report
  console.log('Step 3: Classification results')
  console.log('-'.repeat(60))
  console.log(`  To KEEP: ${toKeep.length} snapshot folders`)
  console.log(`  To DELETE: ${toDelete.length} snapshot folders`)
  console.log()

  console.log('Folders that will be DELETED:')
  for (const date of toDelete) {
    // Find which program year this date belongs to
    const [yearStr, monthStr] = date.split('-')
    let datePY = ''
    if (yearStr && monthStr) {
      const year = parseInt(yearStr, 10)
      const month = parseInt(monthStr, 10)
      const pyStart = month >= 7 ? year : year - 1
      datePY = `${pyStart}-${pyStart + 1}`
    }
    console.log(`  DELETE  gs://${bucket}/snapshots/${date}/  [${datePY}]`)
  }

  console.log()
  console.log('Keeper dates (will NOT be deleted):')
  for (const date of [...keeperDates].sort()) {
    console.log(`  KEEP    gs://${bucket}/snapshots/${date}/`)
  }
  console.log()

  if (dryRun) {
    console.log('DRY RUN complete. Re-run with --execute to perform deletions.')
    return
  }

  // Execute: delete in parallel batches
  console.log(`=`.repeat(80))
  console.log(`EXECUTING DELETIONS (${toDelete.length} folders)...`)
  console.log()

  const DELETE_BATCH_SIZE = 10
  let totalObjectsDeleted = 0
  let foldersDeleted = 0
  let foldersFailed = 0

  for (let i = 0; i < toDelete.length; i += DELETE_BATCH_SIZE) {
    const batch = toDelete.slice(i, i + DELETE_BATCH_SIZE)
    const results = await Promise.allSettled(
      batch.map(async date => {
        const count = await deleteSnapshotFolder(storage, bucket, date)
        console.log(`  ✓ Deleted snapshots/${date}/ (${count} objects)`)
        return count
      })
    )

    for (const result of results) {
      if (result.status === 'fulfilled') {
        totalObjectsDeleted += result.value
        foldersDeleted++
      } else {
        console.error(
          `  ✗ Delete failed: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`
        )
        foldersFailed++
      }
    }
  }

  console.log()
  console.log('='.repeat(80))
  console.log(`Pruning complete:`)
  console.log(`  Folders deleted: ${foldersDeleted}`)
  console.log(`  Objects deleted: ${totalObjectsDeleted}`)
  console.log(`  Failures:        ${foldersFailed}`)

  process.exit(foldersFailed > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
