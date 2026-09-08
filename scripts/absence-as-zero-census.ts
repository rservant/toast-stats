/**
 * Absence-as-zero census — runner (#1534).
 *
 * Thin glue around the pure classifier in `./lib/absenceAsZeroCensus.js`.
 * Nothing here decides what a number means: this file reads snapshot files
 * and counts rows. Every rule is unit-tested in
 * `scripts/lib/__tests__/absenceAsZeroCensus.test.ts`.
 *
 * ## Why two subcommands
 *
 * The archive is ~78 MB per snapshot date across ~125 district files, and
 * there are ~180 dates. Measuring and reporting in one pass would need the
 * whole archive on disk at once. `measure` reduces one date to a few hundred
 * kilobytes of counters and is idempotent per date, so a sweep can stream:
 * sync one date → measure → delete → next. `report` then classifies the
 * accumulated counters. It also means a re-run costs nothing.
 *
 *   npx tsx scripts/absence-as-zero-census.ts measure \
 *     --cache-dir ./cache --out ./census-stats
 *   npx tsx scripts/absence-as-zero-census.ts report --stats-dir ./census-stats
 *
 * ## What it reads
 *
 * Per snapshot date, every `district_NN.json` (never the `_reports`
 * sidecars — `isDistrictSnapshotFile` is the one matcher, #1428), and within
 * each: the typed `clubs[]` array, the three raw arrays
 * (`clubPerformance` / `districtPerformance` / `divisionPerformance`) and the
 * `totals` block. Read-only throughout: no GCS write, no workflow dispatch.
 *
 * ## Exit codes
 *
 * 0 = no suspected-absence findings · 1 = findings · 2 = usage or setup
 * error. `all-zero-carried` never sets the code: at the typed layer the
 * census cannot tell a phantom from a real zero on its own, so those are
 * reported for adjudication rather than asserted as defects.
 *
 * Stdout carries structured JSON only; every log line goes to stderr (R4).
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import {
  allZeroCarried,
  buildFieldPopulationStats,
  classifyAbsenceAsZero,
  correlateTypedFieldAbsence,
  formatCoverageTable,
  formatFindings,
  measureRows,
  suspectedAbsences,
  type DateMeasurement,
  type PopulationMeasurement,
} from './lib/absenceAsZeroCensus.js'
import { isDistrictSnapshotFile } from './lib/snapshotFileNames.js'
import { SNAPSHOT_DATE_DIR_PATTERN } from './lib/ceoReportSnapshotDates.js'

function log(msg: string): void {
  process.stderr.write(`${msg}\n`)
}

/** The populations measured, in report order. */
const RAW_POPULATIONS = [
  'clubPerformance',
  'districtPerformance',
  'divisionPerformance',
] as const

interface MeasureArgs {
  command: 'measure'
  cacheDir: string
  outDir: string
}

interface ReportArgs {
  command: 'report'
  statsDir: string
  json: boolean
  rowFloor?: number
}

function parseArgs(argv: string[]): MeasureArgs | ReportArgs {
  const [command, ...rest] = argv
  const flags = new Map<string, string>()
  let json = false

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i]!
    if (arg === '--json') {
      json = true
    } else if (arg.startsWith('--') && arg.includes('=')) {
      const eq = arg.indexOf('=')
      flags.set(arg.slice(2, eq), arg.slice(eq + 1))
    } else if (arg.startsWith('--')) {
      const value = rest[++i]
      if (value === undefined) throw new Error(`${arg} needs a value`)
      flags.set(arg.slice(2), value)
    } else {
      throw new Error(`unknown argument: ${arg}`)
    }
  }

  if (command === 'measure') {
    return {
      command: 'measure',
      cacheDir: flags.get('cache-dir') ?? './cache',
      outDir: flags.get('out') ?? './census-stats',
    }
  }
  if (command === 'report') {
    const floor = flags.get('row-floor')
    return {
      command: 'report',
      statsDir: flags.get('stats-dir') ?? './census-stats',
      json,
      ...(floor === undefined ? {} : { rowFloor: Number.parseInt(floor, 10) }),
    }
  }
  throw new Error(`usage: absence-as-zero-census.ts <measure|report> [flags]`)
}

/** Every `YYYY-MM-DD` snapshot directory in the cache, oldest first. */
function listSnapshotDates(cacheDir: string): string[] {
  const snapshotsDir = join(cacheDir, 'snapshots')
  if (!existsSync(snapshotsDir)) return []
  return readdirSync(snapshotsDir, { withFileTypes: true })
    .filter(e => e.isDirectory() && SNAPSHOT_DATE_DIR_PATTERN.test(e.name))
    .map(e => e.name)
    .sort()
}

/** Rows of a snapshot array, defensively — an absent array is zero rows. */
function rowsOf(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : []
}

/**
 * Measure one snapshot date across every district file present.
 *
 * The district-file envelope is `{ districtId, status, data: { … } }`; a
 * district whose scrape failed carries no `data` and contributes nothing but
 * is still counted in `districtsRead`, so a thin date is visible in the
 * report rather than silently shrinking a population.
 */
function measureDate(cacheDir: string, date: string): DateMeasurement {
  const dir = join(cacheDir, 'snapshots', date)
  const populations: Record<string, PopulationMeasurement> = {}
  let districtsRead = 0

  for (const file of readdirSync(dir).sort()) {
    if (!isDistrictSnapshotFile(file)) continue
    districtsRead += 1

    const envelope = JSON.parse(readFileSync(join(dir, file), 'utf-8')) as {
      data?: Record<string, unknown>
    }
    const data = envelope.data
    if (!data) continue

    for (const population of RAW_POPULATIONS) {
      populations[population] = measureRows(
        rowsOf(data[population]),
        populations[population]
      )
    }
    populations.clubs = measureRows(rowsOf(data.clubs), populations.clubs)

    // One `totals` block per district — a ~125-row population, small enough
    // that the census floor is load-bearing on it.
    const totals = data.totals
    if (totals && typeof totals === 'object') {
      populations.totals = measureRows(
        [totals as Record<string, unknown>],
        populations.totals
      )
    }
  }

  return { date, districtsRead, populations }
}

function runMeasure(args: MeasureArgs): number {
  const dates = listSnapshotDates(args.cacheDir)
  if (dates.length === 0) {
    log(`no snapshot dates under ${join(args.cacheDir, 'snapshots')}`)
    return 2
  }
  mkdirSync(args.outDir, { recursive: true })

  const written: string[] = []
  for (const date of dates) {
    const measurement = measureDate(args.cacheDir, date)
    const out = join(args.outDir, `${date}.json`)
    writeFileSync(out, `${JSON.stringify(measurement)}\n`)
    written.push(date)
    log(
      `measured ${date}: ${measurement.districtsRead} districts, ` +
        Object.entries(measurement.populations)
          .map(([name, pop]) => `${name}=${pop.rows}`)
          .join(' ')
    )
  }

  process.stdout.write(`${JSON.stringify({ measured: written }, null, 2)}\n`)
  return 0
}

/** Every measurement file in the stats directory, oldest date first. */
function loadMeasurements(statsDir: string): DateMeasurement[] {
  if (!existsSync(statsDir)) return []
  return readdirSync(statsDir)
    .filter(f => f.endsWith('.json'))
    .sort()
    .map(
      f =>
        JSON.parse(readFileSync(join(statsDir, f), 'utf-8')) as DateMeasurement
    )
}

/**
 * The floor census: the smallest population the archive actually contains,
 * per population. This is what keeps `CENSUS_ROW_FLOOR` justified by
 * measurement rather than intuition (#1501's calibration rule) — if a real
 * population ever approaches the floor, the floor is wrong.
 */
function formatFloorCensus(measurements: readonly DateMeasurement[]): string {
  const minima = new Map<string, { rows: number; date: string }>()
  for (const m of measurements) {
    for (const [population, pop] of Object.entries(m.populations)) {
      const current = minima.get(population)
      if (!current || pop.rows < current.rows) {
        minima.set(population, { rows: pop.rows, date: m.date })
      }
    }
  }
  const lines = [
    'population | smallest observed | at date',
    '---------- | ----------------- | -------',
  ]
  for (const [population, min] of [...minima].sort()) {
    lines.push(`${population} | ${min.rows} | ${min.date}`)
  }
  return lines.join('\n')
}

function runReport(args: ReportArgs): number {
  const measurements = loadMeasurements(args.statsDir)
  if (measurements.length === 0) {
    log(`no measurement files under ${args.statsDir} — run \`measure\` first`)
    return 2
  }

  const stats = buildFieldPopulationStats(measurements)
  const verdicts = classifyAbsenceAsZero(
    stats,
    args.rowFloor === undefined ? {} : { rowFloor: args.rowFloor }
  )
  const findings = suspectedAbsences(verdicts)
  const measuredZeros = allZeroCarried(verdicts)
  const correlations = correlateTypedFieldAbsence(verdicts)

  log(
    `\n${measurements.length} snapshot date(s), ${new Set(stats.map(s => s.field)).size} fields, ${stats.length} measurements\n`
  )
  log('── Population floor census ───────────────────────────────')
  log(formatFloorCensus(measurements))
  log('\n── Coverage ──────────────────────────────────────────────')
  log(formatCoverageTable(verdicts))
  log('\n── Findings ──────────────────────────────────────────────')
  log(formatFindings(verdicts))

  log(
    `\n── Measured zeros (carried, all-zero — reported, NOT flagged): ${measuredZeros.length}`
  )
  for (const zero of measuredZeros) {
    log(`  ${zero.field} @ ${zero.date} (${zero.rowsTotal} rows carried)`)
  }

  log(`\n── Typed clubs[] fields joined to their source columns`)
  if (correlations.length === 0) {
    log('  every typed field is populated at every date measured')
  }
  for (const c of correlations) {
    log(
      `  ${c.typedField} @ ${c.date}: ${c.sourceEvidence}` +
        (c.carriedSourceFields.length > 0
          ? ` (carried: ${c.carriedSourceFields.join(', ')})`
          : '')
    )
  }

  if (args.json) {
    process.stdout.write(
      `${JSON.stringify({ verdicts, findings, measuredZeros, correlations }, null, 2)}\n`
    )
  }

  return findings.length > 0 ? 1 : 0
}

function main(): void {
  let code: number
  try {
    const args = parseArgs(process.argv.slice(2))
    code = args.command === 'measure' ? runMeasure(args) : runReport(args)
  } catch (error) {
    log(`error: ${error instanceof Error ? error.message : String(error)}`)
    code = 2
  }
  process.exit(code)
}

main()
