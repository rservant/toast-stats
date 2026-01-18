#!/usr/bin/env npx ts-node
/**
 * Script to identify CSV files with "As of" dates that do not match
 * the ISO date directory they are stored in.
 *
 * Usage:
 *   npx ts-node scripts/find-csv-date-mismatches.ts [cache-dir]
 *   npx ts-node scripts/find-csv-date-mismatches.ts --scan-all [base-dir]
 *   npx ts-node scripts/find-csv-date-mismatches.ts --json [cache-dir]
 *
 * If no cache-dir is provided, uses CACHE_DIR env var or defaults to ./cache
 *
 * The script scans the raw-csv directory structure:
 *   raw-csv/{ISO-date}/.../*.csv
 *
 * And extracts the "As of" date from CSV footer lines like:
 *   "Month of Jan, As of 01/11/2026"
 *
 * Reports any files where the footer date doesn't match the directory date.
 *
 * Options:
 *   --scan-all    Scan all subdirectories that contain raw-csv folders
 *                 (useful for scanning test-cache directories)
 *   --json        Output results as JSON instead of human-readable text
 */

import * as fs from 'fs'
import * as path from 'path'

interface Mismatch {
  filePath: string
  directoryDate: string
  csvAsOfDate: string
  footerLine: string
}

interface ScanResult {
  totalFilesScanned: number
  filesWithFooter: number
  filesWithoutFooter: number
  mismatches: Mismatch[]
  errors: Array<{ file: string; error: string }>
}

/**
 * Extract "As of" date from CSV footer line
 * Format: "Month of Jan, As of 01/11/2026" -> "2026-01-11"
 */
function extractAsOfDate(csvContent: string): { date: string; footerLine: string } | null {
  const lines = csvContent.trim().split('\n')

  // Check last few lines for the footer (sometimes there's trailing whitespace)
  for (let i = lines.length - 1; i >= Math.max(0, lines.length - 5); i--) {
    const line = lines[i]?.trim()
    if (!line) continue

    // Match pattern: "Month of Jan, As of 01/11/2026"
    const match = line.match(/Month of ([A-Za-z]+),\s*As of (\d{2})\/(\d{2})\/(\d{4})/)
    if (match) {
      const [, , month, day, year] = match
      if (month && day && year) {
        const isoDate = `${year}-${month}-${day}`
        return { date: isoDate, footerLine: line }
      }
    }
  }

  return null
}

/**
 * Check if a directory name is a valid ISO date (YYYY-MM-DD)
 */
function isISODateDirectory(dirName: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dirName)
}

/**
 * Recursively find all CSV files in a directory
 */
function findCSVFiles(dir: string): string[] {
  const csvFiles: string[] = []

  if (!fs.existsSync(dir)) {
    return csvFiles
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      csvFiles.push(...findCSVFiles(fullPath))
    } else if (entry.isFile() && entry.name.endsWith('.csv')) {
      csvFiles.push(fullPath)
    }
  }

  return csvFiles
}

/**
 * Extract the ISO date directory from a file path
 * e.g., /cache/raw-csv/2024-01-15/district-1/club-performance.csv -> "2024-01-15"
 */
function extractDirectoryDate(filePath: string, rawCsvDir: string): string | null {
  const relativePath = path.relative(rawCsvDir, filePath)
  const parts = relativePath.split(path.sep)

  // First part should be the ISO date directory
  if (parts.length > 0 && isISODateDirectory(parts[0]!)) {
    return parts[0]!
  }

  return null
}

/**
 * Scan the raw-csv directory for date mismatches
 */
function scanForMismatches(cacheDir: string, quiet = false): ScanResult {
  const rawCsvDir = path.join(cacheDir, 'raw-csv')
  const result: ScanResult = {
    totalFilesScanned: 0,
    filesWithFooter: 0,
    filesWithoutFooter: 0,
    mismatches: [],
    errors: [],
  }

  if (!fs.existsSync(rawCsvDir)) {
    if (!quiet) {
      console.error(`Raw CSV directory not found: ${rawCsvDir}`)
    }
    return result
  }

  // Get all date directories
  const entries = fs.readdirSync(rawCsvDir, { withFileTypes: true })
  const dateDirs = entries
    .filter(e => e.isDirectory() && isISODateDirectory(e.name))
    .map(e => e.name)

  if (!quiet) {
    console.log(`Found ${dateDirs.length} date directories to scan`)
  }

  for (const dateDir of dateDirs) {
    const datePath = path.join(rawCsvDir, dateDir)
    const csvFiles = findCSVFiles(datePath)

    for (const csvFile of csvFiles) {
      result.totalFilesScanned++

      try {
        const content = fs.readFileSync(csvFile, 'utf-8')
        const extracted = extractAsOfDate(content)

        if (extracted) {
          result.filesWithFooter++
          const directoryDate = extractDirectoryDate(csvFile, rawCsvDir)

          if (directoryDate && extracted.date !== directoryDate) {
            result.mismatches.push({
              filePath: csvFile,
              directoryDate,
              csvAsOfDate: extracted.date,
              footerLine: extracted.footerLine,
            })
          }
        } else {
          result.filesWithoutFooter++
        }
      } catch (error) {
        result.errors.push({
          file: csvFile,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }

  return result
}

/**
 * Resolve cache directory from args, env, or default
 */
function resolveCacheDir(args: string[]): string {
  // Check command line argument (skip --scan-all flag)
  const nonFlagArgs = args.filter(arg => !arg.startsWith('--'))
  if (nonFlagArgs.length > 0 && nonFlagArgs[0]) {
    return path.resolve(nonFlagArgs[0])
  }

  // Check environment variable
  const envCacheDir = process.env['CACHE_DIR']
  if (envCacheDir && envCacheDir.trim()) {
    return path.resolve(envCacheDir.trim())
  }

  // Default
  return path.resolve('./cache')
}

/**
 * Find all directories containing a raw-csv subdirectory
 */
function findRawCsvDirectories(baseDir: string): string[] {
  const rawCsvDirs: string[] = []

  if (!fs.existsSync(baseDir)) {
    return rawCsvDirs
  }

  // Check if this directory itself has a raw-csv subdirectory
  const rawCsvPath = path.join(baseDir, 'raw-csv')
  if (fs.existsSync(rawCsvPath) && fs.statSync(rawCsvPath).isDirectory()) {
    rawCsvDirs.push(baseDir)
  }

  // Recursively check subdirectories (but not too deep)
  try {
    const entries = fs.readdirSync(baseDir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name !== 'raw-csv' && entry.name !== 'node_modules') {
        const subDir = path.join(baseDir, entry.name)
        rawCsvDirs.push(...findRawCsvDirectories(subDir))
      }
    }
  } catch {
    // Ignore permission errors
  }

  return rawCsvDirs
}

// Main execution
function main(): void {
  const args = process.argv.slice(2)
  const scanAll = args.includes('--scan-all')
  const jsonOutput = args.includes('--json')
  const baseDir = resolveCacheDir(args)

  if (!jsonOutput) {
    console.log('='.repeat(60))
    console.log('CSV Date Mismatch Scanner')
    console.log('='.repeat(60))
    console.log(`Base directory: ${baseDir}`)
    console.log(`Mode: ${scanAll ? 'Scan all raw-csv directories' : 'Single cache directory'}`)
    console.log('')
  }

  let totalResult: ScanResult = {
    totalFilesScanned: 0,
    filesWithFooter: 0,
    filesWithoutFooter: 0,
    mismatches: [],
    errors: [],
  }

  if (scanAll) {
    const cacheDirs = findRawCsvDirectories(baseDir)
    if (!jsonOutput) {
      console.log(`Found ${cacheDirs.length} directories with raw-csv subdirectories`)
      console.log('')
    }

    for (const cacheDir of cacheDirs) {
      if (!jsonOutput) {
        console.log(`Scanning: ${cacheDir}`)
      }
      const result = scanForMismatches(cacheDir, jsonOutput)
      totalResult.totalFilesScanned += result.totalFilesScanned
      totalResult.filesWithFooter += result.filesWithFooter
      totalResult.filesWithoutFooter += result.filesWithoutFooter
      totalResult.mismatches.push(...result.mismatches)
      totalResult.errors.push(...result.errors)
    }
  } else {
    totalResult = scanForMismatches(baseDir, jsonOutput)
  }

  if (jsonOutput) {
    console.log(JSON.stringify({
      baseDirectory: baseDir,
      scanMode: scanAll ? 'all' : 'single',
      summary: {
        totalFilesScanned: totalResult.totalFilesScanned,
        filesWithFooter: totalResult.filesWithFooter,
        filesWithoutFooter: totalResult.filesWithoutFooter,
        errorCount: totalResult.errors.length,
        mismatchCount: totalResult.mismatches.length,
      },
      mismatches: totalResult.mismatches,
      errors: totalResult.errors,
    }, null, 2))
  } else {
    console.log('')
    console.log('Summary:')
    console.log('-'.repeat(40))
    console.log(`Total CSV files scanned: ${totalResult.totalFilesScanned}`)
    console.log(`Files with "As of" footer: ${totalResult.filesWithFooter}`)
    console.log(`Files without footer: ${totalResult.filesWithoutFooter}`)
    console.log(`Errors encountered: ${totalResult.errors.length}`)
    console.log(`Mismatches found: ${totalResult.mismatches.length}`)
    console.log('')

    if (totalResult.mismatches.length > 0) {
      console.log('MISMATCHES:')
      console.log('='.repeat(60))
      for (const mismatch of totalResult.mismatches) {
        console.log(`File: ${mismatch.filePath}`)
        console.log(`  Directory date: ${mismatch.directoryDate}`)
        console.log(`  CSV "As of" date: ${mismatch.csvAsOfDate}`)
        console.log(`  Footer line: ${mismatch.footerLine}`)
        console.log('')
      }
    } else {
      console.log('✓ No mismatches found - all CSV files match their directory dates')
    }

    if (totalResult.errors.length > 0) {
      console.log('')
      console.log('ERRORS:')
      console.log('-'.repeat(40))
      for (const err of totalResult.errors) {
        console.log(`${err.file}: ${err.error}`)
      }
    }
  }

  // Exit with error code if mismatches found
  process.exit(totalResult.mismatches.length > 0 ? 1 : 0)
}

main()
