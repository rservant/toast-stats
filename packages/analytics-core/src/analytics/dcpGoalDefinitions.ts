/**
 * Single shared source of truth for the 10 Distinguished Club Program (DCP)
 * goal definitions (epic #1095, #1118).
 *
 * Encodes, for every goal: the current dashboard CSV header (plus historical
 * aliases, tried in order), the official achievement threshold, and the rule
 * structure. Requirements are ANDed; columns within one requirement are ORed —
 * goal 10 is officer list AND (Oct dues OR Apr dues), per
 * docs/toastmasters-rules-reference.md §10.2.
 *
 * Semantics are verified against TI's own "Goals Met" column (2026-06-09
 * deep-dive audit: 0 mismatches across all 162 D61 clubs) and must stay
 * identical to what DataTransformer publishes as dcpGoalsAchieved — see the
 * parity tests in ../transformation/DataTransformer.test.ts.
 */

import type { ScrapedRecord } from '@taverns-red/shared-contracts'

export interface DcpGoalColumn {
  /** CSV header aliases, tried in order; the first present key wins */
  aliases: readonly string[]
  /** Human-readable label for UI surfaces (per-goal panel sub-items) */
  label: string
  /** Official threshold the column value must reach for this column to count */
  required: number
  /**
   * The shape a rename of this column keeps (#1539).
   *
   * Every rename TI has made has EXTENDED the existing name rather than
   * replaced it — `Level 2s` → `Level 2s or EOM`, `Level 4s` →
   * `Level 4s, Level 5s, or DTM award` → `Level 4s, Path Completions, or DTM
   * Awards`. So a header that starts the same way and matches no alias is
   * almost certainly this column under a new name, and
   * `suspectedDcpGoalHeaderRenames` says so by name instead of leaving the
   * reader with "some goals are missing".
   *
   * Deliberately anchored and narrow: it must not match a column that
   * belongs to a different goal (goal 5's pattern must not claim
   * `Add. Level 4s…`, and neither may claim the pre-2020 `Level 5s`, which
   * is a real column of its own and not a rename of anything).
   */
  renamedFrom?: RegExp
}

export interface DcpGoalDefinition {
  /** Goal number, 1-10 */
  goal: number
  name: string
  category: 'Education' | 'Membership' | 'Training' | 'Administration'
  /**
   * ANDed requirements; a requirement is satisfied when ANY of its columns
   * meets that column's threshold.
   */
  requirements: ReadonlyArray<{ anyOf: readonly DcpGoalColumn[] }>
}

export const DCP_GOAL_DEFINITIONS: readonly DcpGoalDefinition[] = [
  {
    goal: 1,
    name: 'Level 1 awards',
    category: 'Education',
    requirements: [
      {
        anyOf: [
          {
            aliases: ['Level 1s'],
            label: 'Level 1 awards',
            required: 4,
            renamedFrom: /^level 1s?\b/i,
          },
        ],
      },
    ],
  },
  {
    goal: 2,
    name: 'Level 2 or Online Meeting Mastery awards',
    category: 'Education',
    requirements: [
      {
        anyOf: [
          {
            // PY 2026-27 renamed this column when TI made Online Meeting
            // Mastery ("EOM") completions an alternative route to the goal
            // (#1399). Historical snapshots carry 'Level 2s'; first match
            // wins, so a record carrying both is read once, not summed.
            aliases: ['Level 2s or EOM', 'Level 2s'],
            label: 'Level 2 or Online Meeting Mastery awards',
            required: 2,
            renamedFrom: /^level 2s?\b/i,
          },
        ],
      },
    ],
  },
  {
    goal: 3,
    name: 'More Level 2 or Online Meeting Mastery awards',
    category: 'Education',
    requirements: [
      {
        anyOf: [
          {
            // See goal 2 — same PY 2026-27 rename (#1399).
            aliases: ['Add. Level 2s or EOM', 'Add. Level 2s', 'Add Level 2s'],
            label: 'More Level 2 or Online Meeting Mastery awards',
            required: 2,
            renamedFrom: /^add\.? level 2s?\b/i,
          },
        ],
      },
    ],
  },
  {
    goal: 4,
    name: 'Level 3 awards',
    category: 'Education',
    requirements: [
      {
        anyOf: [
          {
            aliases: ['Level 3s'],
            label: 'Level 3 awards',
            required: 2,
            renamedFrom: /^level 3s?\b/i,
          },
        ],
      },
    ],
  },
  {
    goal: 5,
    name: 'Level 4, Path Completion, or DTM',
    category: 'Education',
    requirements: [
      {
        anyOf: [
          {
            // TI has spelled this column three ways. First match wins, so a
            // record is read once, newest name first:
            //   2025-07 onward         'Level 4s, Path Completions, or DTM Awards'
            //   2020-07 → 2025-06      '…, Level 5s, …' — five program years
            //     that read as "no goal columns at all" for want of this one
            //     alias, and published no dcpGoalsAchieved at all (#1539)
            //   archive start → 2020-06  'Level 4s'
            aliases: [
              'Level 4s, Path Completions, or DTM Awards',
              'Level 4s, Level 5s, or DTM award',
              'Level 4s',
              'Level 4',
            ],
            label: 'Level 4/Path Completion/DTM',
            required: 1,
            renamedFrom: /^level 4s?\b/i,
          },
        ],
      },
    ],
  },
  {
    goal: 6,
    name: 'Additional Level 4, Path Completion, or DTM',
    category: 'Education',
    requirements: [
      {
        anyOf: [
          {
            // See goal 5 — the same three spellings behind an 'Add.' prefix.
            // Exports before 2020-07 carry NO additional-Level-4 column at
            // all (that era's DCP ran the traditional and Pathways education
            // tracks side by side, scored either-route), so this goal stays
            // unresolvable there and hasDcpGoalColumns keeps answering false
            // for those records — deliberately, not for want of an alias.
            aliases: [
              'Add. Level 4s, Path Completions, or DTM award',
              'Add. Level 4s, Level 5s, or DTM award',
              'Add. Level 4s',
              'Add Level 4',
            ],
            label: 'Additional Level 4/Path Completion/DTM',
            required: 1,
            renamedFrom: /^add\.? level 4s?\b/i,
          },
        ],
      },
    ],
  },
  {
    goal: 7,
    name: 'New members',
    category: 'Membership',
    requirements: [
      {
        anyOf: [
          {
            aliases: ['New Members'],
            label: 'New members',
            required: 4,
            renamedFrom: /^new members?\b/i,
          },
        ],
      },
    ],
  },
  {
    goal: 8,
    name: 'More new members',
    category: 'Membership',
    requirements: [
      {
        anyOf: [
          {
            aliases: ['Add. New Members', 'Add New Members'],
            label: 'More new members',
            required: 4,
            renamedFrom: /^add\.? new members?\b/i,
          },
        ],
      },
    ],
  },
  {
    goal: 9,
    name: 'Officer training',
    category: 'Training',
    requirements: [
      {
        anyOf: [
          {
            aliases: ['Off. Trained Round 1'],
            label: 'Officers trained Jun–Aug',
            required: 4,
            renamedFrom: /^off\.? trained round 1\b/i,
          },
        ],
      },
      {
        anyOf: [
          {
            aliases: ['Off. Trained Round 2'],
            label: 'Officers trained Nov–Feb',
            required: 4,
            renamedFrom: /^off\.? trained round 2\b/i,
          },
        ],
      },
    ],
  },
  {
    goal: 10,
    name: 'Admin requirements',
    category: 'Administration',
    requirements: [
      {
        anyOf: [
          {
            aliases: ['Mem. dues on time Oct'],
            label: 'Membership dues on time (Oct)',
            required: 1,
            renamedFrom: /^mem\.? dues on time oct\b/i,
          },
          {
            aliases: ['Mem. dues on time Apr'],
            label: 'Membership dues on time (Apr)',
            required: 1,
            renamedFrom: /^mem\.? dues on time apr\b/i,
          },
        ],
      },
      {
        anyOf: [
          {
            aliases: ['Off. List On Time'],
            label: 'Officer list on time',
            required: 1,
            renamedFrom: /^off\.? list on time\b/i,
          },
        ],
      },
    ],
  },
]

/** Whether the record carries any of one column's own aliases. */
const columnIsPresent = (
  record: ScrapedRecord,
  column: DcpGoalColumn
): boolean =>
  column.aliases.some(key => {
    const value = record[key]
    return value !== null && value !== undefined && value !== ''
  })

const requirementIsPresent = (
  record: ScrapedRecord,
  requirement: { anyOf: readonly DcpGoalColumn[] }
): boolean => requirement.anyOf.some(column => columnIsPresent(record, column))

/**
 * Goal numbers for which the record carries no recognised header — i.e. at
 * least one of the goal's requirements resolved none of its aliases.
 *
 * Empty for a well-formed club-performance record. A non-empty result means
 * either legacy data without the per-goal columns, or a dashboard header we
 * do not know about yet (#1399); callers with a logger should say so.
 */
export function missingDcpGoalHeaders(record: ScrapedRecord): number[] {
  return DCP_GOAL_DEFINITIONS.filter(
    definition =>
      !definition.requirements.every(requirement =>
        requirementIsPresent(record, requirement)
      )
  ).map(definition => definition.goal)
}

/** One unresolved goal, and the export header that most likely replaced it. */
export interface SuspectedDcpGoalHeaderRename {
  /** Goal number, 1-10, that resolved none of its aliases. */
  goal: number
  /** The export's own header that matches this goal's `renamedFrom` shape. */
  header: string
}

/** Every alias any goal knows about — the "we already claim this" set. */
const KNOWN_GOAL_HEADERS: ReadonlySet<string> = new Set(
  DCP_GOAL_DEFINITIONS.flatMap(definition =>
    definition.requirements.flatMap(requirement =>
      requirement.anyOf.flatMap(column => column.aliases)
    )
  )
)

/**
 * Unresolved goals whose column looks RENAMED rather than absent (#1539).
 *
 * `missingDcpGoalHeaders` answers "which goals can we not read", which reads
 * the same for two very different situations: TI renamed the column last
 * month, or the export predates the column existing at all. The first is a
 * defect that costs every club in every district its per-goal data until
 * someone adds four words; the second is a fact about history that no code
 * change can fix. Told apart only by a human squinting at a header list, the
 * first hid inside the second for five program years — which is the actual
 * #1539 bug, not the two missing alias strings.
 *
 * So: for each column that resolves none of its own aliases, look for a header
 * the export DOES carry that matches that column's `renamedFrom` shape and
 * that no alias already claims. Found, it is a rename and the caller can name
 * the new column; not found, the era genuinely lacks it and the documented
 * fallback is correct.
 *
 * Per COLUMN, not per goal, deliberately — that is the whole #1399 lesson
 * repeated one level down. Goal 10 passes on Oct dues alone (§10.2), so a
 * rename of the Oct column leaves the GOAL resolved and
 * `missingDcpGoalHeaders` empty, while `readDcpGoalColumn` quietly returns 0
 * for it and ClubDCPGoalsPanel renders that 0 as a sub-item for every club in
 * every district. A detector keyed on the goal cannot see the one column that
 * changed, exactly as the old goal-1 sentinel could not.
 *
 * Known limit: it catches the rename shape TI has actually used every time —
 * extending the existing name. A column renamed to something unrecognisable
 * still degrades safely via `hasDcpGoalColumns`; it just arrives undiagnosed.
 */
export function suspectedDcpGoalHeaderRenames(
  record: ScrapedRecord
): SuspectedDcpGoalHeaderRename[] {
  const unclaimed = Object.keys(record).filter(
    header => !KNOWN_GOAL_HEADERS.has(header)
  )
  if (unclaimed.length === 0) return []

  const suspects: SuspectedDcpGoalHeaderRename[] = []
  const seen = new Set<string>()

  for (const definition of DCP_GOAL_DEFINITIONS) {
    for (const requirement of definition.requirements) {
      for (const column of requirement.anyOf) {
        // Only a column that reads NOTHING can have been renamed. An OR
        // alternative the export genuinely never carried reads nothing
        // either, which is why the PATTERN — not the absence — is the signal.
        if (!column.renamedFrom || columnIsPresent(record, column)) continue
        for (const header of unclaimed) {
          const key = `${definition.goal} ${header}`
          if (seen.has(key) || !column.renamedFrom.test(header)) continue
          seen.add(key)
          suspects.push({ goal: definition.goal, header })
        }
      }
    }
  }

  return suspects
}

/**
 * Whether a raw club-performance record carries the per-goal CSV columns.
 * Consumers without goal columns fall back: DataTransformer omits
 * dcpGoalsAchieved, the analytics module uses its sequential approximation.
 *
 * DELIBERATE (#1399): this spans ALL ten goals, not goal 1 as a sentinel.
 * The single-column sentinel is what made the PY 2026-27 rename silent —
 * TI renamed goals 2-3 to '… or EOM' and left 'Level 1s' alone, so the
 * detector kept answering "yes, good goal data" while two goals read 0 for
 * every club in every district. A sentinel keyed on the one column that did
 * not change cannot detect the change. Requiring every goal to resolve a
 * known header means the next rename we have not seen degrades to the
 * documented fallback (visibly, and logged by DataTransformer) instead of
 * publishing confident zeros.
 *
 * Granularity is per requirement, not per column, because columns inside a
 * requirement are alternatives: goal 10 passes on Oct dues alone (§10.2).
 * Real exports carry every goal column for every club (pinned against the
 * captured D61 2026-06-09 and 2026-08-01 pairs), so this is not stricter
 * than production data.
 */
export function hasDcpGoalColumns(record: ScrapedRecord): boolean {
  return missingDcpGoalHeaders(record).length === 0
}

/**
 * Read a goal column from a raw CSV record, trying aliases in order.
 * Mirrors DataTransformer.extractNumber: a present-but-unparseable value
 * falls through to the next alias; absence everywhere yields 0.
 */
export function readDcpGoalColumn(
  record: ScrapedRecord,
  column: DcpGoalColumn
): number {
  for (const key of column.aliases) {
    const value = record[key]
    if (value !== null && value !== undefined) {
      if (typeof value === 'number') {
        return value
      }
      const parsed = parseInt(String(value), 10)
      if (!isNaN(parsed)) {
        return parsed
      }
    }
  }
  return 0
}

/**
 * Evaluate one DCP goal against a raw club-performance CSV record.
 */
export function isDcpGoalAchieved(
  record: ScrapedRecord,
  definition: DcpGoalDefinition
): boolean {
  return definition.requirements.every(requirement =>
    requirement.anyOf.some(
      column => readDcpGoalColumn(record, column) >= column.required
    )
  )
}

/**
 * Evaluate all 10 DCP goals against a raw club-performance CSV record.
 * Index i holds goal i+1.
 */
export function computeDcpGoalsAchieved(record: ScrapedRecord): boolean[] {
  return DCP_GOAL_DEFINITIONS.map(definition =>
    isDcpGoalAchieved(record, definition)
  )
}
