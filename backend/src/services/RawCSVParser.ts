/**
 * Raw CSV Parser
 *
 * Pure parsing functions for CSV content from the Toastmasters dashboard.
 * Extracted from RawCSVCacheService for independent testability
 * and single-responsibility compliance.
 */

import type { ScrapedRecord } from '../types/districts.js'

/**
 * Optional logger interface for reporting skipped footer rows.
 * When not provided, footer rows are silently skipped.
 */
interface ParserLogger {
  debug: (message: string, context?: Record<string, unknown>) => void
}

/**
 * Parse CSV content into an array of ScrapedRecord objects.
 *
 * Handles:
 * - Header row detection and field mapping
 * - Quoted values with escaped quotes
 * - Automatic number coercion (except REGION, which preserves leading zeros)
 * - Footer row filtering ("Month of" metadata lines from the dashboard)
 *
 * @param csvContent - Raw CSV string content
 * @param logger - Optional logger for debug output
 * @returns Array of parsed records
 */
export function parseCSVContent(
  csvContent: string,
  logger?: ParserLogger
): ScrapedRecord[] {
  const lines = csvContent.trim().split('\n')
  if (lines.length < 2) {
    return []
  }

  // Parse header
  const headerLine = lines[0]
  if (!headerLine) {
    return []
  }
  const headers = parseCSVLine(headerLine)

  // Parse data rows
  const records: ScrapedRecord[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line || line.trim().length === 0) {
      continue
    }

    // Skip footer rows containing "Month of" (e.g., "Month of Jan, As of 01/11/2026")
    // These are metadata lines from the Toastmasters dashboard, not actual data records
    if (line.includes('Month of')) {
      logger?.debug('Skipping CSV footer row', { line })
      continue
    }

    const values = parseCSVLine(line)
    const record: ScrapedRecord = {}

    for (let j = 0; j < headers.length; j++) {
      const header = headers[j]
      const value = values[j]
      if (header) {
        // Keep REGION as string to preserve leading zeros (e.g., "01", "09")
        if (header === 'REGION') {
          record[header] = value ?? null
        } else if (value !== undefined && value !== null && value !== '') {
          // Try to parse as number if possible for other fields
          const numValue = Number(value)
          record[header] = isNaN(numValue) ? value : numValue
        } else {
          record[header] = null
        }
      }
    }

    records.push(record)
  }

  return records
}

/**
 * Parse a single CSV line handling quoted values.
 *
 * Supports:
 * - Comma-separated values
 * - Double-quoted fields (handles commas within quotes)
 * - Escaped quotes (doubled double-quotes)
 * - Whitespace trimming per field
 *
 * @param line - A single CSV line
 * @returns Array of parsed field values
 */
export function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      // Check for escaped quote
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++ // Skip next quote
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  // Add last field
  result.push(current.trim())

  return result
}
