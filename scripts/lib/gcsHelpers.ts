/**
 * Shared GCS I/O helpers for snapshot pruning scripts.
 *
 * These helpers are pure I/O adapters — no business logic.
 * They are extracted here to:
 *   1. Eliminate duplication across find-month-end-dates.ts,
 *      generate-month-end-snapshots.ts, and prune-daily-snapshots.ts
 *   2. Provide a single seam for mocking in unit tests
 */

import { Storage } from '@google-cloud/storage'
import type { RawCSVEntry } from './monthEndDates.js'

const METADATA_FILENAME = 'metadata.json'

interface RawMetadata {
  date?: string
  isClosingPeriod?: boolean
  dataMonth?: string
}

/**
 * List all YYYY-MM-DD date directories under raw-csv/ in GCS.
 * Returns dates sorted ascending.
 */
export async function listRawCSVDates(
  storage: Storage,
  bucketName: string
): Promise<string[]> {
  const bucket = storage.bucket(bucketName)
  const prefix = 'raw-csv/'

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
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      dates.push(date)
    }
  }

  return dates.sort()
}

/**
 * List all YYYY-MM-DD date directories under snapshots/ in GCS.
 * Returns dates sorted ascending.
 */
export async function listSnapshotDates(
  storage: Storage,
  bucketName: string
): Promise<string[]> {
  const bucket = storage.bucket(bucketName)
  const prefix = 'snapshots/'

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

/**
 * Read raw-csv/{date}/metadata.json from GCS.
 * On any error (missing file, malformed JSON), returns a non-closing-period entry.
 */
export async function readMetadataForDate(
  storage: Storage,
  bucketName: string,
  date: string
): Promise<RawCSVEntry> {
  try {
    const objectPath = `raw-csv/${date}/${METADATA_FILENAME}`
    const file = storage.bucket(bucketName).file(objectPath)
    const [buffer] = await file.download()
    const meta = JSON.parse(buffer.toString('utf-8')) as RawMetadata

    return {
      collectionDate: date,
      isClosingPeriod: meta.isClosingPeriod === true,
      dataMonth: meta.dataMonth,
    }
  } catch {
    // Missing or malformed metadata — treat as non-closing-period entry
    return {
      collectionDate: date,
      isClosingPeriod: false,
      dataMonth: undefined,
    }
  }
}

/**
 * Read metadata for a batch of dates in parallel (batch size 20).
 * Returns entries in the same order as the input dates array.
 */
export async function readMetadataForDates(
  storage: Storage,
  bucketName: string,
  dates: string[],
  batchSize = 20
): Promise<RawCSVEntry[]> {
  const entries: RawCSVEntry[] = []

  for (let i = 0; i < dates.length; i += batchSize) {
    const batch = dates.slice(i, i + batchSize)
    const results = await Promise.all(
      batch.map(date => readMetadataForDate(storage, bucketName, date))
    )
    entries.push(...results)
  }

  return entries
}
