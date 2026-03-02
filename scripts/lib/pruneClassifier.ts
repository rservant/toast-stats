/**
 * Prune Classifier — Pure Business Logic
 *
 * Determines which GCS snapshot folders to keep vs. delete during the
 * snapshot pruning operation (#149).
 *
 * All functions are pure (no GCS I/O) to enable unit testing.
 */

import { isProgramYearComplete } from './monthEndDates.js'

export interface ClassificationResult {
  /** Snapshot dates that will be kept */
  toKeep: string[]
  /** Snapshot dates that will be deleted */
  toDelete: string[]
  /**
   * Safety guard violations — dates that should NOT have been classified
   * as deletable but somehow reached the delete path for a current-PY date.
   * Non-empty results in a hard process.exit(1).
   */
  guardViolations: string[]
}

/**
 * Derive the Toastmasters program year for a given YYYY-MM-DD date string.
 */
function getProgramYearForDate(date: string): string {
  const [yearStr, monthStr] = date.split('-')
  const year = parseInt(yearStr ?? '0', 10)
  const month = parseInt(monthStr ?? '0', 10)
  const pyStart = month >= 7 ? year : year - 1
  return `${pyStart}-${pyStart + 1}`
}

/**
 * Classify each snapshot date as keep, delete, or a guard violation.
 *
 * Rules (in order):
 * 1. If `programYear` is specified and the date is NOT in that PY → KEEP (out of scope)
 * 2. If the date belongs to an incomplete (current) program year → KEEP (safety guard)
 * 3. If the date is in `keeperDates` → KEEP (month-end keeper)
 * 4. Paranoid double-check: if somehow a current-PY date slips through → guardViolation
 * 5. Otherwise → DELETE
 *
 * @param snapshotDates - All YYYY-MM-DD dates found in snapshots/ GCS prefix
 * @param keeperDates   - Set of month-end keeper dates from buildMonthEndSummary
 * @param today         - Reference date for program-year completeness check
 * @param programYear   - Optional: scope to a single program year (e.g. "2024-2025")
 */
export function classifySnapshotDates(
  snapshotDates: string[],
  keeperDates: Set<string>,
  today: Date,
  programYear?: string
): ClassificationResult {
  const toKeep: string[] = []
  const toDelete: string[] = []
  const guardViolations: string[] = []

  for (const date of snapshotDates) {
    const datePY = getProgramYearForDate(date)

    // Rule 1: Out of scope — skip without modifying
    if (programYear && datePY !== programYear) {
      toKeep.push(date)
      continue
    }

    // Rule 2: Current (incomplete) program year — always keep
    if (!isProgramYearComplete(datePY, today)) {
      toKeep.push(date)
      continue
    }

    // Rule 3: Month-end keeper — always keep
    if (keeperDates.has(date)) {
      toKeep.push(date)
      continue
    }

    // Rule 4: Paranoid double-check before deleting
    if (!isProgramYearComplete(datePY, today)) {
      // This should never be reached given Rule 2 above, but the hard guard
      // records it as a violation rather than silently deleting
      guardViolations.push(date)
      continue
    }

    // Rule 5: Delete
    toDelete.push(date)
  }

  return { toKeep, toDelete, guardViolations }
}
