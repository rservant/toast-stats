/**
 * Shared program-year date helpers (#306).
 *
 * Toastmasters program years run July 1 → June 30. These flexible-format date
 * parsers were duplicated verbatim between `BordaCountRankingCalculator`
 * (analytics-core) and `TransformService` (collector-cli). This module is the
 * single home; both import from here.
 *
 * @module @taverns-red/analytics-core/rankings
 */

/**
 * Parse a date string in ISO (YYYY-MM-DD), US 4-digit (M/D/YYYY), or US
 * 2-digit (M/D/YY) format and return a UTC-normalized Date. Two-digit years
 * are interpreted as 20YY — Toastmasters' district-performance CSVs use this
 * for charter/suspend dates. Returns null on failure.
 */
export function parseDateFlexible(value: string): Date | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  // ISO format: YYYY-MM-DD (optionally with time)
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) {
    const y = Number(isoMatch[1])
    const m = Number(isoMatch[2])
    const d = Number(isoMatch[3])
    if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
      return new Date(Date.UTC(y, m - 1, d))
    }
  }

  // US format: M/D/YY or M/D/YYYY (2-digit year → 20YY)
  const usMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/)
  if (usMatch) {
    const m = Number(usMatch[1])
    const d = Number(usMatch[2])
    const yRaw = Number(usMatch[3])
    const y = usMatch[3]!.length === 2 ? 2000 + yRaw : yRaw
    if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
      return new Date(Date.UTC(y, m - 1, d))
    }
  }

  return null
}

/**
 * Return the start-of-program-year date (July 1) preceding the given snapshot
 * date, or null if the snapshot date is unparseable (#336).
 */
export function getProgramYearStartDate(snapshotDate: string): Date | null {
  const parsed = parseDateFlexible(snapshotDate)
  if (!parsed) return null
  const year = parsed.getUTCFullYear()
  const month = parsed.getUTCMonth() + 1 // 1-indexed
  const pyStartYear = month >= 7 ? year : year - 1
  return new Date(Date.UTC(pyStartYear, 6, 1)) // July 1 UTC
}

/**
 * The two branch literals, each matched as a WHOLE WORD anywhere in the cell
 * and capturing exactly ONE following token (#1540).
 *
 * Two properties, both load-bearing:
 *
 * - `(?:^|\s)` rather than `^` — a cell can carry both branches, and an
 *   anchored match sees only the first. Keeping the boundary is what stops
 *   the search over-firing on a token that merely CONTAINS the literal
 *   (`Recharter 05/22/26` is not a charter).
 * - `(\S+)` rather than `(.+)` — the captured date must be one token, so a
 *   trailing sibling branch cannot poison `parseDateFlexible`. `(.+)` is
 *   precisely how a combined cell lost its charter date as well as its
 *   suspension date.
 */
const CHARTER_BRANCH = /(?:^|\s)Charter\s+(\S+)/i
const SUSPEND_BRANCH = /(?:^|\s)Susp\s+(\S+)/i

/**
 * Extract a charter date from a `Charter Date/Suspend Date` field value (#336).
 *
 * Toastmasters district-performance.csv encodes club status changes in one
 * string: `Charter MM/DD/YY` for newly chartered clubs, `Susp MM/DD/YY` for
 * suspensions — and, for a club that charters and is then suspended inside
 * the same program year, BOTH in the one cell
 * (`'Charter 09/30/25 Susp 03/31/26'`, 19 rows at 2026-06-30 and 5 at
 * 2022-06-30, #1540). The `Susp` branch is ignored here; its sibling parser
 * reads it. Returns null if the field carries no `Charter` branch or the
 * captured token is unparseable.
 */
export function parseCharterDateFromStatusField(value: unknown): Date | null {
  if (typeof value !== 'string') return null
  const match = value.match(CHARTER_BRANCH)
  if (!match) return null
  return parseDateFlexible(match[1]!)
}

/**
 * Extract a suspension date from a `Charter Date/Suspend Date` field value
 * (#1497) — the sibling branch `parseCharterDateFromStatusField` deliberately
 * drops.
 *
 * The column carries `Charter MM/DD/YY` for a new charter, `Susp MM/DD/YY` for
 * a suspension, or BOTH for a club that chartered and was then suspended
 * (#1540 — the reason this searches rather than anchors). Live stored rows put
 * a **leading space** on the suspension form (`' Susp 03/31/26'`, verified
 * 2026-08-31 in `snapshots/2026-06-30/district_61.json`), which the
 * whitespace-or-start boundary absorbs. Returns null if the field carries no
 * `Susp` branch or the captured token is unparseable.
 *
 * The #1497 guarantee survives verbatim: a `Charter`-only cell yields null
 * here, because the branch is keyed on its own whole-word literal — not on
 * position.
 */
export function parseSuspendDateFromStatusField(value: unknown): Date | null {
  if (typeof value !== 'string') return null
  const match = value.match(SUSPEND_BRANCH)
  if (!match) return null
  return parseDateFlexible(match[1]!)
}
