/**
 * Pure date-selection logic for generate-month-end-snapshots.ts (#148).
 *
 * Extracted here to enable unit testing without GCS or CLI side-effects.
 */

import {
  isProgramYearComplete,
  getProgramYearForMonth,
  type ProgramYearSummary,
  type MonthEndResult,
} from './monthEndDates.js'

/**
 * From a set of program-year summaries, return the MonthEndResult entries
 * that should be processed (i.e. transformed + uploaded).
 *
 * Rules:
 * 1. Only completed program years are eligible
 * 2. If `programYear` is specified, scope to that PY only
 * 3. Safety guard: skip any result whose dataMonth belongs to an incomplete PY
 *
 * @param summaries  - Output of buildMonthEndSummary
 * @param today      - Reference date for program-year completeness check
 * @param programYear - Optional PY filter (e.g. "2024-2025")
 */
export function selectDatesToProcess(
  summaries: ProgramYearSummary[],
  today: Date,
  programYear?: string
): MonthEndResult[] {
  let results: MonthEndResult[] = summaries
    .filter(s => s.isComplete)
    .filter(s => !programYear || s.year === programYear)
    .flatMap(s => s.monthResults)

  // Safety guard: never process a date whose dataMonth belongs to the current PY
  results = results.filter(r => {
    const py = getProgramYearForMonth(r.dataMonth)
    return isProgramYearComplete(py, today)
  })

  return results
}
