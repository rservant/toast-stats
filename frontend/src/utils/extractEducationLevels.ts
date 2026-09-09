/* Education Levels rollup (#426).

   Aggregates per-club education awards from a district snapshot into the
   four reportable buckets that Toastmasters publishes:

   - Level 1s
   - Level 2s (or, from PY 2026-27, "Level 2s or EOM" — the same column,
     now also counting Online Meeting Mastery completions)
   - Level 3s
   - Level 4s, Path Completions, or DTM Awards

   The raw CSV bundles Level 4 + Path Completion + DTM into a single
   column — TI doesn't publicly break out per-Pathway completions in the
   district dashboard, so we report the bundle as-is rather than invent
   a breakdown. The issue's "11 Pathway" ask isn't achievable from
   public data without a per-member feed (see issue #426 comment).

   The "Add. Level Xs" columns also exist in the CSV; they are
   additional/secondary awards earned by clubs that already have a
   primary level award. We include them in the totals so the rollup
   reflects total awards, not unique clubs. */

import { DCP_GOAL_DEFINITIONS } from '@taverns-red/analytics-core'

export interface EducationLevelsTotals {
  level1: number
  level2: number
  level3: number
  /** Level 4s + Path Completions + DTM Awards bundled — TI publishes
   *  these in a single column. */
  level4PathDtm: number
  /** Total of all four buckets. */
  total: number
  /** Number of clubs that contributed at least one award. */
  contributingClubs: number
  /** Total clubs in the snapshot (denominator for participation %). */
  totalClubs: number
}

/* Each bucket has a primary column and an optional additional-awards
   column. TI renames these headers between program years, so the listed
   names are fallback aliases: first match wins for each (primary,
   additional) pair. Summing all aliases as if they were distinct columns
   would double-count clubs whose snapshot carries both old and new names
   (#486 M1).

   DERIVED from the shared DCP goal definitions, not restated (#1539).
   This module used to keep its own copy of the alias table, and the copy
   drifted: it never learned the 2020-07 -> 2025-06 education headers
   ('Level 4s, Level 5s, or DTM award' and its 'Add.' twin), so the rollup
   reported 0 Level 4/Path/DTM awards for five program years of archived
   snapshots. Unlike dcpGoalsAchieved there is no all-or-nothing guard
   here, so that absence rendered as a confident zero. The four buckets
   are exactly DCP goals 1, 2/3, 4 and 5/6, so they now read their columns
   from analytics-core and the next rename can only be missed once. */
const goalAliases = (goal: number): readonly string[] =>
  DCP_GOAL_DEFINITIONS.find(definition => definition.goal === goal)
    ?.requirements[0]?.anyOf[0]?.aliases ?? []

export const EDUCATION_LEVEL_COLUMNS = {
  level1: { primary: goalAliases(1), additional: [] },
  level2: { primary: goalAliases(2), additional: goalAliases(3) },
  level3: { primary: goalAliases(4), additional: [] },
  level4PathDtm: { primary: goalAliases(5), additional: goalAliases(6) },
} as const

const toNumber = (raw: unknown): number => {
  if (raw == null || raw === '') return 0
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : 0
}

const firstPresent = (
  club: Record<string, unknown>,
  keys: ReadonlyArray<string>
): number => {
  for (const key of keys) {
    if (key in club && club[key] != null && club[key] !== '') {
      return toNumber(club[key])
    }
  }
  return 0
}

const bucketTotal = (
  club: Record<string, unknown>,
  def: { primary: ReadonlyArray<string>; additional: ReadonlyArray<string> }
): number =>
  firstPresent(club, def.primary) + firstPresent(club, def.additional)

export function extractEducationLevels(
  districtSnapshot: unknown
): EducationLevelsTotals {
  const empty: EducationLevelsTotals = {
    level1: 0,
    level2: 0,
    level3: 0,
    level4PathDtm: 0,
    total: 0,
    contributingClubs: 0,
    totalClubs: 0,
  }

  if (typeof districtSnapshot !== 'object' || districtSnapshot === null) {
    return empty
  }

  const rawSnapshot = districtSnapshot as Record<string, unknown>
  const snapshot =
    typeof rawSnapshot['data'] === 'object' && rawSnapshot['data'] !== null
      ? (rawSnapshot['data'] as Record<string, unknown>)
      : rawSnapshot

  const clubPerformanceRaw = snapshot['clubPerformance']
  if (!Array.isArray(clubPerformanceRaw)) return empty

  const totals = { level1: 0, level2: 0, level3: 0, level4PathDtm: 0 }
  let contributingClubs = 0

  for (const clubRaw of clubPerformanceRaw) {
    if (typeof clubRaw !== 'object' || clubRaw === null) continue
    const club = clubRaw as Record<string, unknown>

    const l1 = bucketTotal(club, EDUCATION_LEVEL_COLUMNS.level1)
    const l2 = bucketTotal(club, EDUCATION_LEVEL_COLUMNS.level2)
    const l3 = bucketTotal(club, EDUCATION_LEVEL_COLUMNS.level3)
    const l4 = bucketTotal(club, EDUCATION_LEVEL_COLUMNS.level4PathDtm)

    totals.level1 += l1
    totals.level2 += l2
    totals.level3 += l3
    totals.level4PathDtm += l4

    if (l1 + l2 + l3 + l4 > 0) contributingClubs += 1
  }

  return {
    ...totals,
    total: totals.level1 + totals.level2 + totals.level3 + totals.level4PathDtm,
    contributingClubs,
    totalClubs: clubPerformanceRaw.length,
  }
}
