/**
 * Centralized logger that gates debug/info output behind DEV mode.
 *
 * Usage:
 *   import { logger } from '@/utils/logger'
 *   logger.debug('cache stats:', stats)   // silent in production
 *   logger.info('loaded', count, 'items') // silent in production
 *   logger.warn('fallback used')          // always logged
 *   logger.error('failed:', err)          // always logged
 */

/* eslint-disable no-console */

const noop = (..._args: unknown[]) => {}

const isDev =
  typeof import.meta !== 'undefined' && import.meta.env?.DEV === true

export const logger = {
  /** Dev-only. Silent in production builds. */
  debug: isDev ? console.debug.bind(console) : noop,

  /** Dev-only. Silent in production builds. */
  info: isDev ? console.info.bind(console) : noop,

  /** Always logged — indicates a recoverable problem. */
  warn: console.warn.bind(console),

  /** Always logged — indicates a failure. */
  error: console.error.bind(console),
}
