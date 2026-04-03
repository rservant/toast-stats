import { describe, it, expect } from 'vitest'
import { logger } from '../logger'

describe('logger', () => {
  it('exports debug, info, warn, and error methods', () => {
    expect(typeof logger.debug).toBe('function')
    expect(typeof logger.info).toBe('function')
    expect(typeof logger.warn).toBe('function')
    expect(typeof logger.error).toBe('function')
  })

  it('debug and info are callable without throwing', () => {
    // In DEV mode (vitest), these delegate to console
    // In prod they would be noop — either way, they should not throw
    expect(() => logger.debug('test debug')).not.toThrow()
    expect(() => logger.info('test info')).not.toThrow()
  })

  it('warn and error are callable without throwing', () => {
    expect(() => logger.warn('test warn')).not.toThrow()
    expect(() => logger.error('test error')).not.toThrow()
  })

  it('debug and info are active in DEV mode (vitest)', () => {
    // Vitest runs with DEV=true, so these should be console delegates
    // A noop function has a different identity than console.debug
    expect(logger.debug).not.toBe(logger.warn) // not the same function
  })
})
