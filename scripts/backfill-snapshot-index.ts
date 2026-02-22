#!/usr/bin/env npx tsx
/**
 * One-Time Backfill Script
 *
 * Generates the initial district-snapshot-index.json from existing GCS data.
 * Lists all snapshot prefixes, then for each prefix lists district_*.json files,
 * and aggregates into the index structure.
 *
 * Usage:
 *   GCS_BUCKET_NAME=toast-stats-data npx tsx scripts/backfill-snapshot-index.ts
 *
 * Options:
 *   --dry-run   Print the index without uploading
 */

import { Storage } from '@google-cloud/storage'

interface DistrictSnapshotIndex {
  generatedAt: string
  districts: Record<string, string[]>
}

async function main(): Promise<void> {
  const bucketName = process.env['GCS_BUCKET_NAME']
  if (!bucketName) {
    console.error('Error: GCS_BUCKET_NAME environment variable is required')
    process.exit(1)
  }

  const dryRun = process.argv.includes('--dry-run')
  const storage = new Storage()
  const bucket = storage.bucket(bucketName)

  console.error(`[INFO] Scanning bucket: ${bucketName}`)
  console.error(`[INFO] Listing snapshot prefixes under snapshots/...`)

  // List all objects matching snapshots/{date}/district_{id}.json
  const districtFilePattern =
    /^snapshots\/(\d{4}-\d{2}-\d{2})\/district_(\w+)\.json$/
  const districts: Record<string, Set<string>> = {}
  let fileCount = 0

  const [files] = await bucket.getFiles({
    prefix: 'snapshots/',
    delimiter: undefined,
  })

  for (const file of files) {
    const match = districtFilePattern.exec(file.name)
    if (match) {
      const date = match[1]!
      const districtId = match[2]!
      const existing = districts[districtId] ?? new Set<string>()
      existing.add(date)
      districts[districtId] = existing
      fileCount++
    }
  }

  // Convert sets to sorted arrays
  const districtArrays: Record<string, string[]> = {}
  for (const [districtId, dates] of Object.entries(districts)) {
    districtArrays[districtId] = [...dates].sort()
  }

  const index: DistrictSnapshotIndex = {
    generatedAt: new Date().toISOString(),
    districts: districtArrays,
  }

  const districtCount = Object.keys(districtArrays).length
  const totalDateEntries = Object.values(districtArrays).reduce(
    (sum, dates) => sum + dates.length,
    0
  )

  console.error(`[INFO] Found ${fileCount} district snapshot files`)
  console.error(
    `[INFO] ${districtCount} districts, ${totalDateEntries} total date entries`
  )

  if (dryRun) {
    console.error('[INFO] Dry run — printing index to stdout')
    console.log(JSON.stringify(index, null, 2))
  } else {
    const file = bucket.file('config/district-snapshot-index.json')
    await file.save(JSON.stringify(index, null, 2), {
      contentType: 'application/json',
    })
    console.error(
      `[INFO] Uploaded index to gs://${bucketName}/config/district-snapshot-index.json`
    )
  }
}

main().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
