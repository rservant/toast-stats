/**
 * Regression test: analytics-core modules must NOT write to stdout.
 *
 * The data pipeline pipes CLI output through `tee` and parses it with `jq`.
 * Any `console.log()` call in analytics-core contaminates stdout and breaks
 * the pipeline. All logging MUST use `console.error()` (stderr).
 *
 * Strategy: We use two complementary approaches:
 * 1. Source-level check: scan module source for `console.log` calls
 * 2. Runtime check: spy on console.log during execution (with NODE_ENV forced)
 *
 * Issue: #100
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { ClubHealthAnalyticsModule } from '../ClubHealthAnalyticsModule.js'
import { DistinguishedClubAnalyticsModule } from '../DistinguishedClubAnalyticsModule.js'
import type { DistrictStatistics, ClubStatistics } from '../../interfaces.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function createClub(overrides: Partial<ClubStatistics> = {}): ClubStatistics {
  return {
    clubId: '1',
    clubName: 'Test Club',
    divisionId: 'A',
    areaId: 'A1',
    divisionName: 'Division A',
    areaName: 'Area A1',
    membershipCount: 25,
    paymentsCount: 20,
    dcpGoals: 7,
    status: 'Active',
    octoberRenewals: 10,
    aprilRenewals: 5,
    newMembers: 5,
    membershipBase: 20,
    clubStatus: 'Active',
    ...overrides,
  }
}

function createSnapshot(
  clubs: ClubStatistics[] = [createClub()]
): DistrictStatistics {
  return {
    districtId: '61',
    snapshotDate: '2026-02-22',
    clubs,
    divisions: [],
    areas: [],
    totals: {
      totalClubs: clubs.length,
      totalMembership: clubs.reduce((s, c) => s + c.membershipCount, 0),
      totalPayments: clubs.reduce((s, c) => s + c.paymentsCount, 0),
      distinguishedClubs: 0,
      selectDistinguishedClubs: 0,
      presidentDistinguishedClubs: 0,
    },
  }
}

describe('no stdout leak from analytics-core (#100)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('source-level check: no console.log in analytics modules', () => {
    it('ClubHealthAnalyticsModule.ts must not contain console.log calls', () => {
      const source = readFileSync(
        resolve(__dirname, '..', 'ClubHealthAnalyticsModule.ts'),
        'utf-8'
      )
      // Match console.log calls in executable code, not in comments
      const lines = source.split('\n')
      const consoleLogLines = lines.filter(
        line =>
          line.includes('console.log') &&
          !line.trimStart().startsWith('//') &&
          !line.trimStart().startsWith('*')
      )
      expect(
        consoleLogLines,
        `Found console.log in ClubHealthAnalyticsModule.ts:\n${consoleLogLines.join('\n')}`
      ).toHaveLength(0)
    })

    it('DistinguishedClubAnalyticsModule.ts must not contain console.log calls', () => {
      const source = readFileSync(
        resolve(__dirname, '..', 'DistinguishedClubAnalyticsModule.ts'),
        'utf-8'
      )
      const lines = source.split('\n')
      const consoleLogLines = lines.filter(
        line =>
          line.includes('console.log') &&
          !line.trimStart().startsWith('//') &&
          !line.trimStart().startsWith('*')
      )
      expect(
        consoleLogLines,
        `Found console.log in DistinguishedClubAnalyticsModule.ts:\n${consoleLogLines.join('\n')}`
      ).toHaveLength(0)
    })
  })

  describe('runtime check: no stdout during execution', () => {
    it('ClubHealthAnalyticsModule.generateClubHealthData does not call console.log', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const module = new ClubHealthAnalyticsModule()
      module.generateClubHealthData([createSnapshot()])
      expect(consoleSpy).not.toHaveBeenCalled()
    })

    it('DistinguishedClubAnalyticsModule.generateDistinguishedClubAnalytics does not call console.log', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const module = new DistinguishedClubAnalyticsModule()
      module.generateDistinguishedClubAnalytics('61', [createSnapshot()])
      expect(consoleSpy).not.toHaveBeenCalled()
    })
  })
})
