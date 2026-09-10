/**
 * Workflow Inline-Script Backtick Guard (#1549)
 *
 * Bash performs command substitution on backticks inside a DOUBLE-quoted
 * string. A `run:` step that pipes an inline script to an interpreter in
 * double quotes — `node -e "…"`, `python3 -c "…"`, `sh -c "…"` — therefore
 * hands every backtick in that script to bash, comments included. Bash runs
 * the backticked text as a command, substitutes its (usually empty) output,
 * and the interpreter receives mangled source.
 *
 * That is exactly what took down the rebuild/prune path: JS comments in
 * data-pipeline.yml's `Update district-snapshot-index` step used Markdown-
 * style backticks around identifiers, so run 34468935211 logged
 * `_: command not found`, `district_61_reports.json: command not found`,
 * `61_reports: command not found` and then `SyntaxError`. The comment had
 * been there for three weeks — only rebuild/prune takes that branch.
 *
 * An unquoted heredoc delimiter (`<<EOF`, as opposed to `<<'EOF'`) has the
 * same property: the body is expanded, so backticks in it are executed too.
 *
 * The guard below flags unescaped backticks inside either construct. It is
 * deliberately BOUNDED rather than line-greedy: a naive scanner runs past the
 * end of the block and flags ordinary shell `#` comments and `$(…)` in
 * neighbouring steps, which are perfectly safe. Block ends are found with
 * bash's own rule — a double-quoted string ends at the first `"` that is not
 * backslash-escaped — so a block never leaks into the step after it.
 */

/** Interpreters whose inline-script flag takes the script as an argument. */
const INTERPRETERS = [
  'node',
  'nodejs',
  'deno',
  'python',
  'python3',
  'perl',
  'ruby',
  'php',
  'bash',
  'sh',
  'zsh',
  'dash',
  'ksh',
]

/**
 * `<interpreter> [flags…] -e "` — the opening double quote of an inline
 * script. `sh -c 'single quoted'` is NOT matched: single quotes suppress
 * substitution, so backticks inside them are inert.
 */
const INLINE_SCRIPT_OPENER = new RegExp(
  `(?:^|[\\s;&|(=])(?:${INTERPRETERS.join('|')})` +
    `(?:\\s+-[A-Za-z-]+)*` +
    `\\s+(?:-e|-c|-E|--eval|--exec)\\s+"`
)

/**
 * `<<EOF` / `<<-EOF` and the quoted forms. Only the UNQUOTED delimiter
 * expands its body; `<<'EOF'`, `<<"EOF"` and `<<\EOF` do not.
 */
const HEREDOC_OPENER =
  /<<-?\s*(?:'([A-Za-z_][A-Za-z0-9_]*)'|"([A-Za-z_][A-Za-z0-9_]*)"|\\([A-Za-z_][A-Za-z0-9_]*)|([A-Za-z_][A-Za-z0-9_]*))/

export type InlineScriptKind =
  'double-quoted-inline-script' | 'expanding-heredoc'

export interface InlineScriptBlock {
  kind: InlineScriptKind
  /** 1-based line carrying the opener (`node -e "` / `cat <<EOF`). */
  openerLine: number
  /** The opener line, trimmed — for human-readable failure output. */
  opener: string
  /** 1-based line where the expanded body ends (inclusive). */
  endLine: number
  /** True when no terminator was found before EOF (a malformed workflow). */
  unterminated: boolean
}

export interface BacktickViolation {
  kind: InlineScriptKind
  /** 1-based line of the offending backtick. */
  line: number
  /** The offending source line, trimmed. */
  text: string
  /** 1-based line of the block opener that makes it live. */
  openerLine: number
  opener: string
}

interface Position {
  line: number
  col: number
}

/**
 * Walk forward from (line, col) to the first `"` that bash would treat as the
 * closing quote — i.e. the first one not preceded by a backslash. Returns null
 * at EOF.
 */
function findClosingDoubleQuote(
  lines: string[],
  start: Position
): Position | null {
  for (let i = start.line; i < lines.length; i++) {
    const text = lines[i]
    let col = i === start.line ? start.col : 0
    while (col < text.length) {
      if (text[col] === '\\') {
        col += 2
        continue
      }
      if (text[col] === '"') return { line: i, col }
      col++
    }
  }
  return null
}

/**
 * Locate every bash construct in a workflow whose body is subject to command
 * substitution: a double-quoted inline script, and an unquoted heredoc.
 */
export function findInlineScriptBlocks(source: string): InlineScriptBlock[] {
  const lines = source.split('\n')
  const blocks: InlineScriptBlock[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    const scriptMatch = INLINE_SCRIPT_OPENER.exec(line)
    if (scriptMatch) {
      // The opener regex ends ON the quote, so its last character is it.
      const openCol = scriptMatch.index + scriptMatch[0].length - 1
      const close = findClosingDoubleQuote(lines, {
        line: i,
        col: openCol + 1,
      })
      blocks.push({
        kind: 'double-quoted-inline-script',
        openerLine: i + 1,
        opener: line.trim(),
        endLine: (close ? close.line : lines.length - 1) + 1,
        unterminated: close === null,
      })
      if (close) i = close.line
      continue
    }

    const heredocMatch = HEREDOC_OPENER.exec(line)
    if (heredocMatch) {
      const [, singleQuoted, doubleQuoted, backslashed, bare] = heredocMatch
      // Quoted or backslash-escaped delimiters suppress expansion entirely.
      if (singleQuoted || doubleQuoted || backslashed || !bare) continue
      let end = lines.length - 1
      let terminated = false
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].trim() === bare) {
          end = j
          terminated = true
          break
        }
      }
      blocks.push({
        kind: 'expanding-heredoc',
        openerLine: i + 1,
        opener: line.trim(),
        endLine: end + 1,
        unterminated: !terminated,
      })
      i = end
    }
  }

  return blocks
}

/** True when the backtick at `col` is escaped (`\``) and therefore literal. */
function isEscaped(text: string, col: number): boolean {
  let backslashes = 0
  for (let i = col - 1; i >= 0 && text[i] === '\\'; i--) backslashes++
  return backslashes % 2 === 1
}

/**
 * Every unescaped backtick inside an expanding block — each one is a live
 * command substitution bash will execute before the interpreter ever sees the
 * script.
 *
 * Backticks OUTSIDE such a block are not reported: shell `#` comments, YAML
 * comments and single-quoted strings all treat them as literal text, and the
 * repo uses them freely there for Markdown-ish emphasis.
 */
export function findInlineScriptBacktickSubstitutions(
  source: string
): BacktickViolation[] {
  const lines = source.split('\n')
  const violations: BacktickViolation[] = []

  for (const block of findInlineScriptBlocks(source)) {
    for (
      let i = block.openerLine - 1;
      i < block.endLine && i < lines.length;
      i++
    ) {
      const text = lines[i]
      for (let col = 0; col < text.length; col++) {
        if (text[col] !== '`' || isEscaped(text, col)) continue
        violations.push({
          kind: block.kind,
          line: i + 1,
          text: text.trim(),
          openerLine: block.openerLine,
          opener: block.opener,
        })
        break // one report per line is enough to locate the problem
      }
    }
  }

  return violations.sort((a, b) => a.line - b.line)
}

/** Render violations as a human-readable failure message. */
export function formatBacktickViolations(
  file: string,
  violations: BacktickViolation[]
): string {
  return violations
    .map(
      v =>
        `${file}:${v.line} backtick inside ${v.kind} opened at line ` +
        `${v.openerLine} (${v.opener})\n    ${v.text}`
    )
    .join('\n')
}
