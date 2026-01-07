#!/usr/bin/env npx ts-node
/**
 * Migration Script: Timestamp-based to ISO Date-based Snapshot Directories
 *
 * This script performs the migration from old timestamp-based snapshot directories
 * to the new ISO date-based naming convention (YYYY-MM-DD).
 *
 * Feature: all-districts-rankings-storage
 * Task: 10.3 Perform migration
 * Validates: Requirements 8.1, 8.2, 8.3, 8.5
 *
 * Usage:
 *   npx ts-node scripts/migrate-to-iso-date-snapshots.ts [--dry-run] [--force]
 *
 * Options:
 *   --dry-run  Show what would be deleted without actually deleting
 *   --force    Skip confirmation prompt
 */

import { promises as fs } from 'fs'
import path from 'path'
import readline from 'readline'

// Configuration
const CACHE_DIR = process.env['CACHE_DIR'] || './cache'
const SNAPSHOTS_DIR = path.join(CACHE_DIR, 'snapshots')

interface MigrationResult {
  success: boolean
  deletedDirectories: string[]
  deletedFiles: string[]
  errors: string[]
  newSnapshotId?: string
}

/**
 * Check if a directory name is timestamp-based (old format)
 * Old format: numeric timestamp like "1767139200000" or "1767139200000-partial-1767704952107"
 */
function isTimestampBasedDirectory(name: string): boolean {
  // Match pure timestamps or timestamps with suffixes
  return /^\d{13}(-.*)?$/.test(name)
}

/**
 * Check if a file name is timestamp-based snapshot file (old format)
 * Old format: "1767556697228.json"
 */
function isTimestampBasedFile(name: string): boolean {
  return /^\d{13}\.json$/.test(name)
}

/**
 * Check if a directory name is ISO date-based (new format)
 * New format: "YYYY-MM-DD"
 */
function isISODateDirectory(name: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(name)
}

/**
 * List all items in the snapshots directory
 */
async function listSnapshotItems(): Promise<{
  directories: string[]
  files: string[]
}> {
  const directories: string[] = []
  const files: string[] = []

  try {
    const items = await fs.readdir(SNAPSHOTS_DIR, { withFileTypes: true })

    for (const item of items) {
      if (item.isDirectory()) {
        directories.push(item.name)
      } else if (item.isFile()) {
        files.push(item.name)
      }
    }
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') {
      console.log('Snapshots directory does not exist yet.')
    } else {
      throw error
    }
  }

  return { directories, files }
}

/**
 * Identify items to be deleted during migration
 */
async function identifyItemsToDelete(): Promise<{
  directories: string[]
  files: string[]
  isoDateDirectories: string[]
}> {
  const { directories, files } = await listSnapshotItems()

  const timestampDirectories = directories.filter(isTimestampBasedDirectory)
  const timestampFiles = files.filter(isTimestampBasedFile)
  const isoDateDirectories = directories.filter(isISODateDirectory)

  return {
    directories: timestampDirectories,
    files: timestampFiles,
    isoDateDirectories,
  }
}

/**
 * Delete timestamp-based snapshot directories and files
 */
async function deleteTimestampBasedItems(
  directories: string[],
  files: string[],
  dryRun: boolean
): Promise<{
  deletedDirectories: string[]
  deletedFiles: string[]
  errors: string[]
}> {
  const deletedDirectories: string[] = []
  const deletedFiles: string[] = []
  const errors: string[] = []

  // Delete directories
  for (const dir of directories) {
    const dirPath = path.join(SNAPSHOTS_DIR, dir)
    try {
      if (dryRun) {
        console.log(`[DRY RUN] Would delete directory: ${dirPath}`)
      } else {
        await fs.rm(dirPath, { recursive: true, force: true })
        console.log(`Deleted directory: ${dirPath}`)
      }
      deletedDirectories.push(dir)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      errors.push(`Failed to delete directory ${dir}: ${errorMessage}`)
      console.error(`Error deleting directory ${dir}: ${errorMessage}`)
    }
  }

  // Delete files
  for (const file of files) {
    const filePath = path.join(SNAPSHOTS_DIR, file)
    try {
      if (dryRun) {
        console.log(`[DRY RUN] Would delete file: ${filePath}`)
      } else {
        await fs.unlink(filePath)
        console.log(`Deleted file: ${filePath}`)
      }
      deletedFiles.push(file)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      errors.push(`Failed to delete file ${file}: ${errorMessage}`)
      console.error(`Error deleting file ${file}: ${errorMessage}`)
    }
  }

  return { deletedDirectories, deletedFiles, errors }
}

/**
 * Verify the new snapshot structure after migration
 */
async function verifyNewSnapshotStructure(): Promise<{
  valid: boolean
  snapshotId?: string
  issues: string[]
}> {
  const issues: string[] = []

  // Check for current.json pointer
  const currentPointerPath = path.join(CACHE_DIR, 'current.json')
  let snapshotId: string | undefined

  try {
    const pointerContent = await fs.readFile(currentPointerPath, 'utf-8')
    const pointer = JSON.parse(pointerContent)
    snapshotId = pointer.snapshot_id

    if (!snapshotId) {
      issues.push('current.json does not contain a snapshot_id')
    } else if (!isISODateDirectory(snapshotId)) {
      issues.push(
        `Snapshot ID "${snapshotId}" is not in ISO date format (YYYY-MM-DD)`
      )
    }
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') {
      issues.push('current.json pointer file does not exist')
    } else {
      issues.push(
        `Error reading current.json: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  // If we have a snapshot ID, verify the snapshot directory structure
  if (snapshotId) {
    const snapshotDir = path.join(SNAPSHOTS_DIR, snapshotId)

    // Check for required files
    const requiredFiles = [
      'metadata.json',
      'manifest.json',
      'all-districts-rankings.json',
    ]

    for (const file of requiredFiles) {
      const filePath = path.join(snapshotDir, file)
      try {
        await fs.access(filePath)
      } catch {
        issues.push(`Missing required file: ${file} in snapshot ${snapshotId}`)
      }
    }

    // Verify all-districts-rankings.json structure
    try {
      const rankingsPath = path.join(snapshotDir, 'all-districts-rankings.json')
      const rankingsContent = await fs.readFile(rankingsPath, 'utf-8')
      const rankings = JSON.parse(rankingsContent)

      if (!rankings.metadata) {
        issues.push('all-districts-rankings.json missing metadata')
      }
      if (!rankings.rankings || !Array.isArray(rankings.rankings)) {
        issues.push(
          'all-districts-rankings.json missing or invalid rankings array'
        )
      }
      if (rankings.metadata && rankings.metadata.snapshotId !== snapshotId) {
        issues.push(
          `Rankings snapshotId mismatch: expected ${snapshotId}, got ${rankings.metadata.snapshotId}`
        )
      }
    } catch (error) {
      if ((error as { code?: string }).code !== 'ENOENT') {
        issues.push(
          `Error reading all-districts-rankings.json: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    }
  }

  return {
    valid: issues.length === 0,
    snapshotId,
    issues,
  }
}

/**
 * Prompt user for confirmation
 */
async function promptConfirmation(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise(resolve => {
    rl.question(`${message} (y/N): `, answer => {
      rl.close()
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes')
    })
  })
}

/**
 * Main migration function
 */
async function runMigration(
  dryRun: boolean,
  force: boolean
): Promise<MigrationResult> {
  console.log('='.repeat(60))
  console.log('Migration: Timestamp-based to ISO Date-based Snapshots')
  console.log('='.repeat(60))
  console.log()

  // Step 1: Identify items to delete
  console.log('Step 1: Identifying timestamp-based snapshot items...')
  const { directories, files, isoDateDirectories } =
    await identifyItemsToDelete()

  console.log(`  Found ${directories.length} timestamp-based directories`)
  console.log(`  Found ${files.length} timestamp-based files`)
  console.log(
    `  Found ${isoDateDirectories.length} ISO date-based directories (will be preserved)`
  )
  console.log()

  if (directories.length === 0 && files.length === 0) {
    console.log(
      'No timestamp-based items found. Migration may already be complete.'
    )
    console.log()

    // Verify existing structure
    console.log('Verifying existing snapshot structure...')
    const verification = await verifyNewSnapshotStructure()

    if (verification.valid) {
      console.log('✓ Snapshot structure is valid')
      if (verification.snapshotId) {
        console.log(`  Current snapshot: ${verification.snapshotId}`)
      }
    } else {
      console.log('✗ Snapshot structure has issues:')
      for (const issue of verification.issues) {
        console.log(`  - ${issue}`)
      }
    }

    return {
      success: true,
      deletedDirectories: [],
      deletedFiles: [],
      errors: [],
      newSnapshotId: verification.snapshotId,
    }
  }

  // List items to be deleted
  if (directories.length > 0) {
    console.log('Directories to delete:')
    for (const dir of directories) {
      console.log(`  - ${dir}`)
    }
    console.log()
  }

  if (files.length > 0) {
    console.log('Files to delete:')
    for (const file of files) {
      console.log(`  - ${file}`)
    }
    console.log()
  }

  // Step 2: Confirm deletion
  if (!dryRun && !force) {
    const confirmed = await promptConfirmation(
      'Are you sure you want to delete these items?'
    )
    if (!confirmed) {
      console.log('Migration cancelled.')
      return {
        success: false,
        deletedDirectories: [],
        deletedFiles: [],
        errors: ['Migration cancelled by user'],
      }
    }
  }

  // Step 3: Delete timestamp-based items
  console.log()
  console.log(
    `Step 2: ${dryRun ? '[DRY RUN] ' : ''}Deleting timestamp-based items...`
  )
  const { deletedDirectories, deletedFiles, errors } =
    await deleteTimestampBasedItems(directories, files, dryRun)

  console.log()
  console.log(`  Deleted ${deletedDirectories.length} directories`)
  console.log(`  Deleted ${deletedFiles.length} files`)
  if (errors.length > 0) {
    console.log(`  Encountered ${errors.length} errors`)
  }

  // Step 4: Instructions for creating new snapshot
  console.log()
  console.log('Step 3: Create new ISO date-based snapshot')
  console.log('-'.repeat(40))
  if (dryRun) {
    console.log('[DRY RUN] After running without --dry-run, execute:')
  } else {
    console.log('To create a new snapshot with ISO date naming, run:')
  }
  console.log()
  console.log('  npm run refresh')
  console.log()
  console.log('Or via API:')
  console.log('  curl -X POST http://localhost:3001/api/districts/refresh')
  console.log()

  // Step 5: Verification instructions
  console.log('Step 4: Verify new snapshot structure')
  console.log('-'.repeat(40))
  console.log('After running refresh, verify the new structure:')
  console.log()
  console.log('  npx ts-node scripts/migrate-to-iso-date-snapshots.ts --verify')
  console.log()

  return {
    success: errors.length === 0,
    deletedDirectories,
    deletedFiles,
    errors,
  }
}

/**
 * Verify-only mode
 */
async function runVerification(): Promise<void> {
  console.log('='.repeat(60))
  console.log('Verifying ISO Date-based Snapshot Structure')
  console.log('='.repeat(60))
  console.log()

  const verification = await verifyNewSnapshotStructure()

  if (verification.valid) {
    console.log('✓ Snapshot structure is valid')
    if (verification.snapshotId) {
      console.log(`  Current snapshot: ${verification.snapshotId}`)
    }
  } else {
    console.log('✗ Snapshot structure has issues:')
    for (const issue of verification.issues) {
      console.log(`  - ${issue}`)
    }
  }

  // List current snapshot contents
  if (verification.snapshotId) {
    const snapshotDir = path.join(SNAPSHOTS_DIR, verification.snapshotId)
    try {
      const files = await fs.readdir(snapshotDir)
      console.log()
      console.log(`Snapshot contents (${verification.snapshotId}):`)
      for (const file of files) {
        const filePath = path.join(snapshotDir, file)
        const stats = await fs.stat(filePath)
        const size = stats.isDirectory() ? '<dir>' : `${stats.size} bytes`
        console.log(`  - ${file} (${size})`)
      }
    } catch {
      console.log('  Could not list snapshot contents')
    }
  }
}

// Parse command line arguments
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const force = args.includes('--force')
const verifyOnly = args.includes('--verify')

// Run the appropriate mode
if (verifyOnly) {
  runVerification()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Verification failed:', error)
      process.exit(1)
    })
} else {
  runMigration(dryRun, force)
    .then(result => {
      if (result.success) {
        console.log()
        console.log('='.repeat(60))
        console.log('Migration completed successfully!')
        console.log('='.repeat(60))
        process.exit(0)
      } else {
        console.log()
        console.log('='.repeat(60))
        console.log('Migration completed with errors:')
        for (const error of result.errors) {
          console.log(`  - ${error}`)
        }
        console.log('='.repeat(60))
        process.exit(1)
      }
    })
    .catch(error => {
      console.error('Migration failed:', error)
      process.exit(1)
    })
}
