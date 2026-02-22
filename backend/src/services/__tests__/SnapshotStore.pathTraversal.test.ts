/**
 * Security test: Path traversal in SnapshotStore.hasDistrictInSnapshot
 *
 * Proves that malicious districtId values are rejected before
 * reaching the file system. Tracks CodeQL alert #57 / GitHub issue #75.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import { FileSnapshotStore } from '../SnapshotStore.js'

describe('SnapshotStore.hasDistrictInSnapshot - Path traversal protection (#75)', () => {
  let testCacheDir: string
  let store: FileSnapshotStore

  beforeEach(async () => {
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substring(2, 8)
    testCacheDir = path.join(
      process.cwd(),
      'test-cache',
      `path-traversal-test-${timestamp}-${randomSuffix}`
    )
    await fs.mkdir(path.join(testCacheDir, 'snapshots', '2024-01-01'), {
      recursive: true,
    })

    store = new FileSnapshotStore({
      cacheDir: testCacheDir,
      maxSnapshots: 10,
      maxAgeDays: 7,
    })
  })

  afterEach(async () => {
    try {
      await fs.rm(testCacheDir, { recursive: true, force: true })
    } catch {
      // ignore cleanup errors
    }
  })

  const MALICIOUS_IDS = [
    '../../../etc/passwd',
    '..',
    'foo/bar',
    'foo\\bar',
    '.',
    '../secret',
    'valid/../../../escape',
  ]

  for (const maliciousId of MALICIOUS_IDS) {
    it(`rejects malicious districtId: "${maliciousId}"`, async () => {
      await expect(
        store.hasDistrictInSnapshot('2024-01-01', maliciousId)
      ).rejects.toThrow()
    })
  }

  it('allows valid numeric districtId', async () => {
    // Should not throw — just return false because the file does not exist
    const result = await store.hasDistrictInSnapshot('2024-01-01', '42')
    expect(result).toBe(false)
  })

  it('allows valid alphabetic districtId', async () => {
    const result = await store.hasDistrictInSnapshot('2024-01-01', 'F')
    expect(result).toBe(false)
  })

  it('allows valid alphanumeric districtId', async () => {
    const result = await store.hasDistrictInSnapshot(
      '2024-01-01',
      'NONEXISTENT1'
    )
    expect(result).toBe(false)
  })
})
