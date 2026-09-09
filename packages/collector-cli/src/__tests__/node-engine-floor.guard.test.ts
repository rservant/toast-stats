import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Runtime-engine regression guard (#1531).
 *
 * `@google-cloud/storage` 8.0.0 was an **engine-only major**: its single
 * breaking change is `engines.node: ">=22"` (was `">=14"`). Nothing in the
 * request, listing, retry or object-metadata surface changed — so no unit test
 * that mocks GCS can ever observe the break. It only shows up at runtime, on a
 * runner whose Node is too old.
 *
 * Every CI job resolves its Node from `.nvmrc` via `setup-node`'s
 * `node-version-file`, so `.nvmrc` is the single source of truth for the
 * pipeline's runtime. This guard asserts that source of truth still satisfies
 * the floor the GCS client actually declares — read from the installed package,
 * not hard-coded — so a future storage major that raises the floor again fails
 * here instead of at 03:00 in the data pipeline.
 */

const repoRoot = new URL('../../../../', import.meta.url)

function readJson<T>(relative: string): T {
  return JSON.parse(
    readFileSync(fileURLToPath(new URL(relative, repoRoot)), 'utf8')
  ) as T
}

/** Lowest Node major permitted by a `>=X` / `^X` / `X.y.z` engines range. */
function majorFloor(range: string): number {
  const match = /(\d+)/.exec(range)
  if (!match) throw new Error(`Unparseable engines.node range: ${range}`)
  return Number.parseInt(match[1], 10)
}

describe('Node engine floor guard (#1531)', () => {
  const nvmrc = readFileSync(
    fileURLToPath(new URL('.nvmrc', repoRoot)),
    'utf8'
  ).trim()
  const nvmrcMajor = majorFloor(nvmrc)

  const storagePkg = readJson<{ version: string; engines?: { node?: string } }>(
    'node_modules/@google-cloud/storage/package.json'
  )
  const storageFloor = majorFloor(storagePkg.engines?.node ?? '>=0')

  it('resolves a Node major from .nvmrc', () => {
    expect(Number.isFinite(nvmrcMajor)).toBe(true)
    expect(nvmrcMajor).toBeGreaterThan(0)
  })

  it('runs CI on a Node major that @google-cloud/storage supports', () => {
    expect(
      nvmrcMajor,
      `.nvmrc pins Node ${nvmrc}, but @google-cloud/storage@${storagePkg.version} ` +
        `declares engines.node "${storagePkg.engines?.node}". Raise .nvmrc — every ` +
        `workflow resolves its runtime from that file.`
    ).toBeGreaterThanOrEqual(storageFloor)
  })

  it('declares an engines.node floor in every workspace that is at least as high as the GCS client requires', () => {
    const workspaces = [
      'package.json',
      'frontend/package.json',
      'packages/shared-contracts/package.json',
      'packages/analytics-core/package.json',
      'packages/collector-cli/package.json',
      'packages/mcp-server/package.json',
    ]
    const tooLow = workspaces
      .map(path => ({
        path,
        engines: readJson<{ engines?: { node?: string } }>(path).engines?.node,
      }))
      .filter(
        w => w.engines === undefined || majorFloor(w.engines) < storageFloor
      )

    expect(
      tooLow,
      `Workspaces declaring a Node floor below @google-cloud/storage's ` +
        `"${storagePkg.engines?.node}":\n` +
        tooLow.map(w => `  ${w.path} @ ${w.engines ?? '(missing)'}`).join('\n')
    ).toEqual([])
  })
})
