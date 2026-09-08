/**
 * Absence-as-zero census — the pure classifier (#1534).
 *
 * ## Why this exists
 *
 * `DataTransformer.extractNumber(record, ...keys)`
 * (`packages/analytics-core/src/transformation/DataTransformer.ts:668`)
 * returns `0` when NO candidate key matched. Seven typed `clubs[]` fields
 * flow through it — `membershipCount`, `paymentsCount`, `dcpGoals`,
 * `octoberRenewals`, `aprilRenewals`, `newMembers`, `membershipBase`. TI
 * renames and omits columns between eras, so a whole-era column miss becomes
 * a silent all-zero population rather than an error.
 *
 * Two instances of that class already shipped, and both were found by
 * accident: #1501 (a rankings rebuild without raw CSVs zeroed
 * `newCharteredClubs`) and #1514 (`suspendedClubs: 0` for eight program years
 * because the `Susp` branch of `Charter Date/Suspend Date` carries zero
 * values in 138,000 rows). This module is the deliberate version: hand it
 * per-date per-field population counts and it names every field whose zeros
 * carry the phantom signature.
 *
 * ## The rule, and why it is shaped this way
 *
 * The evidence does not exist at the row level. A `0` from *nothing happened*
 * and a `0` from *never collected* are identical bytes. It exists only at the
 * population level, and the presence signal must be **wider than the count it
 * guards** (the #1514 design). So every measurement carries three numbers:
 *
 *   - `rowsTotal`          — the population at that date
 *   - `rowsCarryingField`  — rows carrying ANY parseable value, zero included
 *                            (the wide presence signal)
 *   - `rowsNonZero`        — rows carrying a non-zero value (the count)
 *
 * and the verdict is decided in this order:
 *
 *   1. `rowsNonZero > 0`                → `populated`
 *   2. the field is zero at EVERY date  → `no-signal`  (indistinguishable
 *                                          from a true constant; never a
 *                                          finding — #1534 AC4)
 *   3. `rowsTotal < rowFloor`           → `below-floor` (a sub-census file is
 *                                          not a global zero — the #1501
 *                                          limit, AC2)
 *   4. `rowsCarryingField === 0`        → `suspected-absence`  ← the finding
 *   5. otherwise                        → `all-zero-carried`
 *
 * Step 5 is the load-bearing conservatism. A population that CARRIES the
 * field on every row and measures zero everywhere is a **measured zero**, not
 * an absence: `aprilRenewals` really is zero for every club in the world at a
 * September month-end. Collapsing 4 and 5 into one "all zero → defect" rule
 * would report that as a bug. #1514 drew exactly this line — none-anywhere is
 * unknown, some-present-but-all-outside-the-window is a measured zero — and
 * guarding one direction only ships the opposite bug.
 *
 * `all-zero-carried` is still *reported*: it is the shape #1501 had at the
 * derived layer, where the typed field is always present and no wider signal
 * exists. But it never sets the exit code, because at that layer the census
 * genuinely cannot tell a phantom from a real zero on its own — a human has
 * to say whether the world produces that zero. `correlateTypedFieldAbsence`
 * below is what turns some of them into evidence: when a typed field is
 * all-zero AND none of the source columns `extractNumber` would have read is
 * carried, the phantom is confirmed at the layer that can see it.
 *
 * Purity: every export here is a pure function over its arguments. All I/O —
 * reading the snapshot archive and counting rows — lives in
 * `scripts/absence-as-zero-census.ts`.
 */

/** What one (date, field) population measurement says about its zeros. */
export type AbsenceVerdict =
  /** At least one row carries a non-zero value. Never a finding. */
  | 'populated'
  /** Zero at every date in the archive — a true constant is indistinguishable
   *  from a never-collected field, so this is reported, never flagged. */
  | 'no-signal'
  /** The population is too small to conclude anything (the #1501 limit). */
  | 'below-floor'
  /** Nothing in the population carries the field at all — the finding. */
  | 'suspected-absence'
  /** The field is carried but measures zero everywhere: a measured zero at a
   *  layer with no wider presence signal. Reported, never gating. */
  | 'all-zero-carried'

/** One field's population counts at one snapshot date. */
export interface FieldPopulationStats {
  /** Snapshot date, `YYYY-MM-DD`. */
  readonly date: string
  /** Fully-qualified field name — see `sourceFieldName` / `typedFieldName`. */
  readonly field: string
  /** Rows in the population at that date. */
  readonly rowsTotal: number
  /** Rows carrying any parseable value for the field, zero included. */
  readonly rowsCarryingField: number
  /** Rows carrying a non-zero value. Always `<= rowsCarryingField`. */
  readonly rowsNonZero: number
}

/** A measurement plus the verdict the rule reaches on it. */
export interface FieldDateVerdict extends FieldPopulationStats {
  readonly verdict: AbsenceVerdict
}

/**
 * Minimum population size for an all-zero date to mean anything.
 *
 * Reused verbatim from `frontend/src/hooks/useClubGrowthMilestones.ts:186`,
 * where #1501 calibrated it against the archive rather than intuition: the
 * rankings files it guards hold 94–132 district rows, so 50 is comfortably
 * below every real file while still excluding a partial sync.
 *
 * The archive sweep this census runs measures far larger populations — club
 * rows across all districts at one date — and
 * `scripts/absence-as-zero-census.ts` reports the observed minimum so the
 * floor stays justified by measurement. It is deliberately LOW: raising it
 * would only hide findings, and every finding is adjudicated by hand anyway.
 */
export const CENSUS_ROW_FLOOR = 50

/** Raw snapshot arrays a source column can live in. */
export type SourcePopulation =
  'clubPerformance' | 'districtPerformance' | 'divisionPerformance'

/** The typed `clubs[]` fields `extractNumber` produces. */
export type TypedClubField =
  | 'membershipCount'
  | 'paymentsCount'
  | 'dcpGoals'
  | 'octoberRenewals'
  | 'aprilRenewals'
  | 'newMembers'
  | 'membershipBase'

/** Where one typed field's value can come from, in the order tried. */
export interface ExtractNumberSource {
  /** Candidate column keys, in `extractNumber`'s argument order. */
  readonly keys: readonly string[]
  /** Raw arrays the keys are looked up in, in `DataTransformer`'s order. */
  readonly populations: readonly SourcePopulation[]
}

/**
 * The candidate keys `DataTransformer.transformClubs` passes to
 * `extractNumber`, transcribed from `DataTransformer.ts:315-350`.
 *
 * Payment and renewal fields read `paymentSource` — the matching
 * `districtPerformance` row when one exists, falling back to the
 * `clubPerformance` row — so both populations are candidates. The others read
 * the `clubPerformance` record only.
 *
 * `absenceAsZeroCensus.test.ts` asserts every key here still appears verbatim
 * in `DataTransformer.ts`, so a rename upstream fails a test instead of
 * silently narrowing the census to columns that no longer exist.
 */
export const EXTRACT_NUMBER_SOURCE_KEYS: Record<
  TypedClubField,
  ExtractNumberSource
> = {
  membershipCount: {
    keys: ['Active Members', 'Membership', 'Members'],
    populations: ['clubPerformance'],
  },
  paymentsCount: {
    keys: ['Total to Date', 'Payments', 'Total'],
    populations: ['districtPerformance', 'clubPerformance'],
  },
  dcpGoals: {
    keys: ['Goals Met', 'DCP Goals', 'Goals'],
    populations: ['clubPerformance'],
  },
  octoberRenewals: {
    keys: ['Oct. Ren.', 'Oct. Ren', 'October Renewals', 'Oct Ren'],
    populations: ['districtPerformance', 'clubPerformance'],
  },
  aprilRenewals: {
    keys: ['Apr. Ren.', 'Apr. Ren', 'April Renewals', 'Apr Ren'],
    populations: ['districtPerformance', 'clubPerformance'],
  },
  newMembers: {
    keys: ['New Members', 'New'],
    populations: ['districtPerformance', 'clubPerformance'],
  },
  membershipBase: {
    keys: ['Mem. Base', 'Membership Base', 'Base'],
    populations: ['clubPerformance'],
  },
}

/** Fully-qualified name of a raw source column. */
export function sourceFieldName(
  population: SourcePopulation,
  key: string
): string {
  return `${population}.${key}`
}

/** Fully-qualified name of a typed `clubs[]` field. */
export function typedFieldName(field: TypedClubField): string {
  return `clubs.${field}`
}

/**
 * Fully-qualified name of one branch of a branch-encoded column — the
 * `Charter Date/Suspend Date` shape, where a single column carries two
 * mutually exclusive facts distinguished by a leading token.
 */
export function branchFieldName(
  population: SourcePopulation,
  column: string,
  branch: string
): string {
  return `${population}.${column}[${branch}]`
}

function assertSane(stats: FieldPopulationStats): void {
  const where = `${stats.field} @ ${stats.date}`
  if (
    stats.rowsTotal < 0 ||
    stats.rowsCarryingField < 0 ||
    stats.rowsNonZero < 0
  ) {
    throw new Error(`${where}: negative row count`)
  }
  if (stats.rowsCarryingField > stats.rowsTotal) {
    throw new Error(
      `${where}: rowsCarryingField (${stats.rowsCarryingField}) exceeds rowsTotal (${stats.rowsTotal})`
    )
  }
  if (stats.rowsNonZero > stats.rowsCarryingField) {
    throw new Error(
      `${where}: rowsNonZero (${stats.rowsNonZero}) exceeds rowsCarryingField (${stats.rowsCarryingField})`
    )
  }
}

export interface ClassifyOptions {
  /** Override the calibrated default. Only ever raise it with evidence. */
  readonly rowFloor?: number
}

/**
 * Classify every (date, field) measurement in one archive sweep.
 *
 * The archive is classified as a whole, not date by date, because step 2 of
 * the rule — "is this field non-zero ANYWHERE?" — is a property of the whole
 * sweep. A field with no non-zero value anywhere cannot be told apart from a
 * true constant and must not be reported as a defect.
 *
 * Returns one verdict per input, sorted by field then date, so the output is
 * a stable, diffable table.
 */
export function classifyAbsenceAsZero(
  stats: readonly FieldPopulationStats[],
  options: ClassifyOptions = {}
): FieldDateVerdict[] {
  const rowFloor = options.rowFloor ?? CENSUS_ROW_FLOOR

  const nonZeroSomewhere = new Set<string>()
  for (const entry of stats) {
    assertSane(entry)
    if (entry.rowsNonZero > 0) nonZeroSomewhere.add(entry.field)
  }

  return [...stats]
    .sort(
      (a, b) => a.field.localeCompare(b.field) || a.date.localeCompare(b.date)
    )
    .map(entry => ({
      ...entry,
      verdict: verdictFor(entry, nonZeroSomewhere.has(entry.field), rowFloor),
    }))
}

function verdictFor(
  entry: FieldPopulationStats,
  hasNonZeroSomewhere: boolean,
  rowFloor: number
): AbsenceVerdict {
  if (entry.rowsNonZero > 0) return 'populated'
  if (!hasNonZeroSomewhere) return 'no-signal'
  if (entry.rowsTotal < rowFloor) return 'below-floor'
  if (entry.rowsCarryingField === 0) return 'suspected-absence'
  return 'all-zero-carried'
}

/** The findings: every date where a known-live field is carried by nothing. */
export function suspectedAbsences(
  verdicts: readonly FieldDateVerdict[]
): FieldDateVerdict[] {
  return verdicts.filter(v => v.verdict === 'suspected-absence')
}

/** Measured zeros at a layer with no wider presence signal (the #1501 shape). */
export function allZeroCarried(
  verdicts: readonly FieldDateVerdict[]
): FieldDateVerdict[] {
  return verdicts.filter(v => v.verdict === 'all-zero-carried')
}

/** What the raw source columns say about a typed field's all-zero date. */
export type SourceEvidence =
  /** No candidate column is carried by any row — the extractNumber phantom. */
  | 'source-absent'
  /** A candidate column is carried and non-zero: the zero came from elsewhere. */
  | 'source-populated'
  /** A candidate column is carried and measures zero: a real zero. */
  | 'source-all-zero'
  /** No candidate column was measured at that date at all. */
  | 'source-not-measured'

/** One typed field's all-zero date, adjudicated against its source columns. */
export interface TypedFieldCorrelation {
  readonly date: string
  readonly typedField: TypedClubField
  readonly rowsTotal: number
  readonly sourceEvidence: SourceEvidence
  /** Candidate source columns carried by at least one row at that date. */
  readonly carriedSourceFields: readonly string[]
}

/**
 * Join the typed layer to the source layer.
 *
 * A typed `clubs[]` field is always PRESENT in the snapshot — `extractNumber`
 * defaults it — so on its own it can only ever reach `all-zero-carried`, and
 * the census cannot say whether that zero is real. The raw source arrays are
 * persisted verbatim on the same snapshot, and they DO carry the wider signal.
 * Joining the two is what turns "every club reports 0" into "every club
 * reports 0 and the column it is read from is not in the file" — the #1514
 * conclusion, reached deliberately.
 */
export function correlateTypedFieldAbsence(
  verdicts: readonly FieldDateVerdict[]
): TypedFieldCorrelation[] {
  const byKey = new Map<string, FieldDateVerdict>()
  for (const v of verdicts) byKey.set(`${v.date} ${v.field}`, v)

  const results: TypedFieldCorrelation[] = []

  for (const v of verdicts) {
    if (v.verdict !== 'all-zero-carried' && v.verdict !== 'suspected-absence') {
      continue
    }
    const typedField = typedFieldOf(v.field)
    if (!typedField) continue

    const source = EXTRACT_NUMBER_SOURCE_KEYS[typedField]
    const candidates: FieldDateVerdict[] = []
    for (const population of source.populations) {
      for (const key of source.keys) {
        const found = byKey.get(`${v.date} ${sourceFieldName(population, key)}`)
        if (found) candidates.push(found)
      }
    }

    const carried = candidates.filter(c => c.rowsCarryingField > 0)
    const sourceEvidence: SourceEvidence =
      candidates.length === 0
        ? 'source-not-measured'
        : carried.length === 0
          ? 'source-absent'
          : carried.some(c => c.rowsNonZero > 0)
            ? 'source-populated'
            : 'source-all-zero'

    results.push({
      date: v.date,
      typedField,
      rowsTotal: v.rowsTotal,
      sourceEvidence,
      carriedSourceFields: carried.map(c => c.field),
    })
  }

  return results.sort(
    (a, b) =>
      a.typedField.localeCompare(b.typedField) || a.date.localeCompare(b.date)
  )
}

/** The typed field a `clubs.<name>` field name refers to, if any. */
function typedFieldOf(field: string): TypedClubField | undefined {
  if (!field.startsWith('clubs.')) return undefined
  const name = field.slice('clubs.'.length)
  return name in EXTRACT_NUMBER_SOURCE_KEYS
    ? (name as TypedClubField)
    : undefined
}

/** One-character verdict codes, so a wide field × date grid stays readable. */
const VERDICT_CODE: Record<AbsenceVerdict, string> = {
  populated: '.',
  'no-signal': '-',
  'below-floor': '~',
  'suspected-absence': 'X',
  'all-zero-carried': '0',
}

/**
 * The coverage table: one row per field, one column per date, so an era-wide
 * absence reads as a run of `X` across consecutive years instead of a list of
 * unrelated lines. That shape is the whole diagnosis — #1514's `Susp` gap was
 * bimodal across eight consecutive years, never partial.
 */
export function formatCoverageTable(
  verdicts: readonly FieldDateVerdict[]
): string {
  const dates = [...new Set(verdicts.map(v => v.date))].sort()
  const fields = [...new Set(verdicts.map(v => v.field))].sort()
  const byKey = new Map(verdicts.map(v => [`${v.date} ${v.field}`, v.verdict]))

  const fieldWidth = Math.max(5, ...fields.map(f => f.length))
  const lines: string[] = []

  lines.push(
    'legend: . populated · 0 all-zero-carried · X suspected-absence · ' +
      '~ below-floor · - no-signal · (blank) not measured'
  )
  lines.push('')
  lines.push(`${'field'.padEnd(fieldWidth)} | ${dates.join(' ')}`)
  lines.push(
    `${'-'.repeat(fieldWidth)} | ${dates.map(d => '-'.repeat(d.length)).join(' ')}`
  )

  for (const field of fields) {
    const cells = dates.map(date => {
      const verdict = byKey.get(`${date} ${field}`)
      const code = verdict ? VERDICT_CODE[verdict] : ' '
      return code.padStart(Math.ceil((date.length + 1) / 2)).padEnd(date.length)
    })
    lines.push(`${field.padEnd(fieldWidth)} | ${cells.join(' ')}`)
  }

  return lines.join('\n')
}

/**
 * The findings list. Zero findings is a valid outcome and is stated
 * explicitly — a silent report is indistinguishable from a report that never
 * ran (#1534 AC7).
 */
export function formatFindings(verdicts: readonly FieldDateVerdict[]): string {
  const findings = suspectedAbsences(verdicts)
  if (findings.length === 0) {
    return 'No suspected-absence findings: every field measured is populated, a measured zero, or below the census floor.'
  }

  const lines = [`${findings.length} suspected-absence finding(s):`, '']
  lines.push('field | date | rowsTotal | rowsCarryingField')
  lines.push('----- | ---- | --------- | -----------------')
  for (const f of findings) {
    lines.push(
      `${f.field} | ${f.date} | ${f.rowsTotal} | ${f.rowsCarryingField}`
    )
  }
  return lines.join('\n')
}
