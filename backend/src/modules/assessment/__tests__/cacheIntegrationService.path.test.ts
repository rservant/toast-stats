import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { CacheConfigService } from '../../../services/CacheConfigService.js'
import path from 'path'

describe('CacheIntegrationService Cache Path Configuration', () => {
  let originalEnv: string | undefined

  beforeEach(() => {
    originalEnv = process.env.CACHE_DIR
    CacheConfigService.resetInstance()
  })

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.CACHE_DIR = originalEnv
    } else {
      delete process.env.CACHE_DIR
    }
    CacheConfigService.resetInstance()
    vi.restoreAllMocks()
  })

  it('uses CACHE_DIR when set', () => {
    process.env.CACHE_DIR = '/tmp/some-cache'
    CacheConfigService.resetInstance()
    
    const configService = CacheConfigService.getInstance()
    const cachePath = configService.getCacheDirectory()
    
    expect(cachePath).toBe(path.resolve('/tmp/some-cache'))
  })

  it('uses default cache directory when CACHE_DIR is not set', () => {
    delete process.env.CACHE_DIR
    CacheConfigService.resetInstance()
    
    const configService = CacheConfigService.getInstance()
    const cachePath = configService.getCacheDirectory()
    
    expect(cachePath).toBe(path.resolve('./cache'))
  })

  it('ignores DISTRICT_CACHE_DIR environment variable', () => {
    process.env.CACHE_DIR = '/tmp/unified-cache'
    process.env.DISTRICT_CACHE_DIR = '/tmp/old-cache'
    CacheConfigService.resetInstance()
    
    const configService = CacheConfigService.getInstance()
    const cachePath = configService.getCacheDirectory()
    
    expect(cachePath).toBe(path.resolve('/tmp/unified-cache'))
    expect(cachePath).not.toBe(path.resolve('/tmp/old-cache'))
  })

  it('falls back to default when CACHE_DIR is empty', () => {
    process.env.CACHE_DIR = ''
    CacheConfigService.resetInstance()
    
    const configService = CacheConfigService.getInstance()
    const cachePath = configService.getCacheDirectory()
    
    expect(cachePath).toBe(path.resolve('./cache'))
  })
})
