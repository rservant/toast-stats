/**
 * Unit Tests for CLI Upload Validation Edge Cases
 *
 * Tests the validation logic for --since, --until, --concurrency, and
 * mutual exclusivity with --date.
 *
 * Requirements:
 * - 3.5: --since after --until rejection
 * - 3.6: --date with --since/--until mutual exclusivity
 * - 5.5: Invalid --concurrency values rejection
 *
 * These tests invoke createCLI().parseAsync() with mocked process.exit
 * to verify validation failures exit with code 2.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createCLI } from '../cli.js'

/**
 * Parse CLI args and capture exit code + stderr output.
 * Mocks process.exit and console.error to prevent actual termination.
 */
async function parseCLI(
  args: string[]
): Promise<{ exitCode: number | undefined; stderr: string[] }> {
  const stderr: string[] = []
  let exitCode: number | undefined

  const exitSpy = vi
    .spyOn(process, 'exit')
    .mockImplementation((code?: string | number | null | undefined) => {
      exitCode = typeof code === 'number' ? code : 0
      throw new Error(`process.exit(${code})`)
    })

  const errorSpy = vi
    .spyOn(console, 'error')
    .mockImplementation((...args: unknown[]) => {
      stderr.push(args.map(String).join(' '))
    })

  try {
    const program = createCLI()
    // Prevent Commander from calling process.exit on its own errors
    program.exitOverride()
    await program.parseAsync(['node', 'test', ...args])
  } catch {
    // Expected — process.exit mock throws
  } finally {
    exitSpy.mockRestore()
    errorSpy.mockRestore()
  }

  return { exitCode, stderr }
}

describe('CLI Upload Validation Edge Cases', () => {
  describe('--date with --since mutual exclusivity (Requirement 3.6)', () => {
    it('rejects --date used with --since', async () => {
      const { exitCode, stderr } = await parseCLI([
        'upload',
        '--date',
        '2024-01-15',
        '--since',
        '2024-01-01',
      ])

      expect(exitCode).toBe(2)
      const output = stderr.join(' ')
      expect(output).toContain('--date')
      expect(output).toContain('--since')
    })

    it('rejects --date used with --until', async () => {
      const { exitCode, stderr } = await parseCLI([
        'upload',
        '--date',
        '2024-01-15',
        '--until',
        '2024-01-31',
      ])

      expect(exitCode).toBe(2)
      const output = stderr.join(' ')
      expect(output).toContain('--date')
    })

    it('rejects --date used with both --since and --until', async () => {
      const { exitCode, stderr } = await parseCLI([
        'upload',
        '--date',
        '2024-01-15',
        '--since',
        '2024-01-01',
        '--until',
        '2024-01-31',
      ])

      expect(exitCode).toBe(2)
      const output = stderr.join(' ')
      expect(output).toContain('--date')
    })
  })

  describe('--since after --until rejection (Requirement 3.5)', () => {
    it('rejects when --since is after --until', async () => {
      const { exitCode, stderr } = await parseCLI([
        'upload',
        '--since',
        '2024-06-01',
        '--until',
        '2024-01-01',
      ])

      expect(exitCode).toBe(2)
      const output = stderr.join(' ')
      expect(output).toContain('--since')
      expect(output).toContain('--until')
    })
  })

  describe('Invalid --concurrency values (Requirement 5.5)', () => {
    it('rejects --concurrency 0', async () => {
      const { exitCode, stderr } = await parseCLI([
        'upload',
        '--concurrency',
        '0',
      ])

      expect(exitCode).toBe(2)
      const output = stderr.join(' ')
      expect(output).toContain('concurrency')
    })

    it('rejects --concurrency -1', async () => {
      const { exitCode, stderr } = await parseCLI([
        'upload',
        '--concurrency',
        '-1',
      ])

      expect(exitCode).toBe(2)
      const output = stderr.join(' ')
      expect(output).toContain('concurrency')
    })

    it('rejects non-integer --concurrency', async () => {
      const { exitCode, stderr } = await parseCLI([
        'upload',
        '--concurrency',
        '3.5',
      ])

      expect(exitCode).toBe(2)
      const output = stderr.join(' ')
      expect(output).toContain('concurrency')
    })
  })

  describe('Invalid date format validation (Requirement 3.4)', () => {
    it('rejects invalid --since format', async () => {
      const { exitCode, stderr } = await parseCLI([
        'upload',
        '--since',
        'not-a-date',
      ])

      expect(exitCode).toBe(2)
      const output = stderr.join(' ')
      expect(output).toContain('Invalid date format')
    })

    it('rejects invalid --until format', async () => {
      const { exitCode, stderr } = await parseCLI([
        'upload',
        '--until',
        '2024/01/15',
      ])

      expect(exitCode).toBe(2)
      const output = stderr.join(' ')
      expect(output).toContain('Invalid date format')
    })
  })
})
