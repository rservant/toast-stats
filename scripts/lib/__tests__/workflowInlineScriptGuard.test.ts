import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import * as path from 'node:path'
import {
  findInlineScriptBlocks,
  findInlineScriptBacktickSubstitutions,
  formatBacktickViolations,
} from '../workflowInlineScriptGuard.js'

/**
 * Workflow inline-script backtick guard (#1549).
 *
 * Bash expands backticks inside double quotes, so a backtick anywhere in a
 * `node -e "…"` script — a JS comment included — is executed as a command
 * before node ever runs. Run 34468935211 died exactly that way. An unquoted
 * heredoc body has the same property.
 *
 * The sentinel below proves the rule fires on a known-bad snippet
 * (Lesson 082), the bounding tests prove it does NOT reach past the end of a
 * block into neighbouring steps, and the repo sweep keeps every workflow
 * clean (Lesson 121).
 */

const KNOWN_BAD = `
jobs:
  x:
    steps:
      - name: shell comments are inert — never flag these
        run: |
          # a KEEP-ONLY exclude: \`gcloud storage rsync --exclude\` anchors
          # differently. See lesson \`a-keep-only-rsync-exclude\`.
          COUNT=$(find ./cache -name '*.json' | wc -l)
      - name: index
        run: |
          node -e "
            const fs = require('fs');
            // the guard is load-bearing: \`\\w\` includes \`_\`, so the
            // sidecar \`district_61_reports.json\` enters as \`61_reports\`
            console.log(fs.existsSync('/tmp/x'));
          "
      - name: single quotes suppress substitution — inert
        run: |
          sh -c 'echo \`date\` is literal here'
      - name: after the block
        run: |
          # trailing \`backticked\` shell comment, still inert
          echo done
`

describe('findInlineScriptBlocks', () => {
  it('bounds a double-quoted inline script at bash’s own closing quote', () => {
    const blocks = findInlineScriptBlocks(KNOWN_BAD)
    const script = blocks.find(b => b.kind === 'double-quoted-inline-script')
    expect(script).toBeDefined()
    expect(script!.unterminated).toBe(false)

    const lines = KNOWN_BAD.split('\n')
    expect(lines[script!.openerLine - 1]).toContain('node -e "')
    // Ends on the lone closing quote, NOT at EOF.
    expect(lines[script!.endLine - 1].trim()).toBe('"')
    expect(script!.endLine).toBeLessThan(lines.length)
  })

  it('does not treat a single-quoted inline script as an expanding block', () => {
    const blocks = findInlineScriptBlocks(KNOWN_BAD)
    expect(blocks.some(b => b.opener.includes("sh -c 'echo"))).toBe(false)
  })
})

describe('findInlineScriptBacktickSubstitutions', () => {
  it('fires on backticks inside a double-quoted node -e block (sentinel, L082)', () => {
    const violations = findInlineScriptBacktickSubstitutions(KNOWN_BAD)
    expect(violations.length).toBeGreaterThan(0)
    expect(
      violations.every(v => v.kind === 'double-quoted-inline-script')
    ).toBe(true)
    expect(violations.map(v => v.text).join('\n')).toContain('load-bearing')
  })

  it('does NOT flag backticks in ordinary shell comments, before or after the block', () => {
    const violations = findInlineScriptBacktickSubstitutions(KNOWN_BAD)
    const flagged = violations.map(v => v.text).join('\n')
    expect(flagged).not.toContain('KEEP-ONLY')
    expect(flagged).not.toContain('a-keep-only-rsync-exclude')
    expect(flagged).not.toContain('trailing')
    expect(flagged).not.toContain('literal here')
  })

  it('goes clean once the backticks are removed from the comment', () => {
    const fixed = KNOWN_BAD.replace(
      /\/\/ the guard is load-bearing[\s\S]*?61_reports\` *\n/,
      '// the guard is load-bearing: \\w includes _\n'
    )
    expect(findInlineScriptBacktickSubstitutions(fixed)).toEqual([])
  })

  it('flags an unquoted heredoc body and spares a quoted one', () => {
    const expanding = `
    run: |
      cat <<EOF > /tmp/x.json
      { "note": "\`whoami\`" }
      EOF
`
    const literal = expanding.replace('<<EOF', "<<'EOF'")
    expect(findInlineScriptBacktickSubstitutions(expanding)).toHaveLength(1)
    expect(findInlineScriptBacktickSubstitutions(expanding)[0].kind).toBe(
      'expanding-heredoc'
    )
    expect(findInlineScriptBacktickSubstitutions(literal)).toEqual([])
  })

  it('treats an escaped backtick as literal', () => {
    const escaped = `
      run: |
        node -e "
          console.log(\\\`literal template\\\`);
        "
`
    expect(findInlineScriptBacktickSubstitutions(escaped)).toEqual([])
  })
})

describe('repo sweep: no workflow expands a backtick inside an inline script', () => {
  const workflowsDir = path.resolve(__dirname, '../../../.github/workflows')

  for (const file of readdirSync(workflowsDir).filter(f =>
    /\.ya?ml$/.test(f)
  )) {
    it(`${file} has no live backtick substitutions in inline scripts or heredocs`, () => {
      const source = readFileSync(path.join(workflowsDir, file), 'utf-8')
      const violations = findInlineScriptBacktickSubstitutions(source)
      expect(violations, formatBacktickViolations(file, violations)).toEqual([])
    })

    it(`${file} has no unterminated inline-script or heredoc block`, () => {
      const source = readFileSync(path.join(workflowsDir, file), 'utf-8')
      const unterminated = findInlineScriptBlocks(source).filter(
        b => b.unterminated
      )
      expect(
        unterminated,
        unterminated.map(b => `${file}:${b.openerLine} ${b.opener}`).join('\n')
      ).toEqual([])
    })
  }
})

describe('bounding regression: the neighbouring prune steps stay unflagged (#1549)', () => {
  const pipeline = readFileSync(
    path.resolve(__dirname, '../../../.github/workflows/data-pipeline.yml'),
    'utf-8'
  )

  it('never reports a line whose backtick sits in a shell or YAML comment', () => {
    const lines = pipeline.split('\n')
    const commentHits = findInlineScriptBacktickSubstitutions(pipeline).filter(
      v => /^\s*#/.test(lines[v.line - 1])
    )
    expect(
      commentHits,
      formatBacktickViolations('data-pipeline.yml', commentHits)
    ).toEqual([])
  })

  it('the skeleton-sync rsync comment is inside no inline-script block', () => {
    const lines = pipeline.split('\n')
    const rsyncCommentLine =
      lines.findIndex(l => l.includes('KEEP-ONLY exclude')) + 1
    expect(rsyncCommentLine).toBeGreaterThan(0)

    const covering = findInlineScriptBlocks(pipeline).filter(
      b => b.openerLine <= rsyncCommentLine && rsyncCommentLine <= b.endLine
    )
    expect(
      covering,
      covering.map(b => `${b.openerLine}-${b.endLine} ${b.opener}`).join('\n')
    ).toEqual([])
  })
})
