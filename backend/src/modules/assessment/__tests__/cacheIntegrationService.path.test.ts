import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import CacheIntegrationService from '../services/cacheIntegrationService.js'

describe('CacheIntegrationService.selectCachePath', () => {
  const originalEnv = process.env.DISTRICT_CACHE_DIR

  beforeEach(() => {
    delete process.env.DISTRICT_CACHE_DIR
  })

  afterEach(() => {
    process.env.DISTRICT_CACHE_DIR = originalEnv
    vi.restoreAllMocks()
  })

  it('honors DISTRICT_CACHE_DIR when set', () => {
    process.env.DISTRICT_CACHE_DIR = '/tmp/some-cache'
    const p = CacheIntegrationService.selectCachePath()
    expect(path.resolve('/tmp/some-cache')).toBe(p)
  })

  it('prefers cwd/cache when present', () => {
    vi.spyOn(fs, 'existsSync').mockImplementation((p) => {
      if (p === path.resolve(process.cwd(), 'cache')) return true
      return false
    })

    const p = CacheIntegrationService.selectCachePath()
    expect(p).toBe(path.resolve(process.cwd(), 'cache'))
  })

  it('falls back to backend/cache when cwd/cache absent', () => {
    vi.spyOn(fs, 'existsSync').mockImplementation((p) => {
      if (p === path.resolve(process.cwd(), 'cache')) return false
      if (p === path.resolve(process.cwd(), 'backend', 'cache')) return true
      return false
    })

    const p = CacheIntegrationService.selectCachePath()
    expect(p).toBe(path.resolve(process.cwd(), 'backend', 'cache'))
  })

  it('returns default ./cache when no other options exist', () => {
    vi.spyOn(fs, 'existsSync').mockImplementation(() => false)

    const p = CacheIntegrationService.selectCachePath()
    expect(p).toBe(path.resolve('./cache'))
  })
})
