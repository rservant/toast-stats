/**
 * Utilities Index
 *
 * Exports all utility modules for the Scraper CLI package.
 *
 * Requirements:
 * - 5.1: THE Scraper_CLI SHALL operate without requiring the backend to be running
 * - 6.1: Retry with exponential backoff
 * - 6.2: Circuit breaker status reporting
 */

export { logger } from './logger.js'
export {
  CircuitBreaker,
  CircuitBreakerError,
  CircuitState,
  type CircuitBreakerOptions,
  type CircuitBreakerStats,
} from './CircuitBreaker.js'
export {
  RetryManager,
  type RetryOptions,
  type RetryResult,
} from './RetryManager.js'
