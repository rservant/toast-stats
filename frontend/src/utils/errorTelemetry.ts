/**
 * Error Telemetry Utility (#225)
 *
 * Lightweight client-side error recording with localStorage persistence.
 * No PII — only technical context (message, stack, URL, user agent).
 * FIFO eviction at 50 entries.
 */

const STORAGE_KEY = 'toast-stats-error-telemetry'
const MAX_ENTRIES = 50

export interface ErrorRecord {
  timestamp: string
  message: string
  componentStack?: string
  url: string
  userAgent: string
}

/**
 * Record an error to localStorage.
 * Silently no-ops if localStorage is unavailable.
 */
export function recordError(
  error: Error,
  componentStack?: string
): ErrorRecord | null {
  const record: ErrorRecord = {
    timestamp: new Date().toISOString(),
    message: error.message,
    ...(componentStack !== undefined && componentStack !== null
      ? { componentStack }
      : {}),
    url: typeof window !== 'undefined' ? window.location.href : '',
    userAgent:
      typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
  }

  try {
    const existing = getStoredErrors()
    existing.push(record)

    // FIFO eviction — keep only the last MAX_ENTRIES
    const trimmed = existing.slice(-MAX_ENTRIES)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
    return record
  } catch {
    // localStorage unavailable or full — silently ignore
    return null
  }
}

/**
 * Get all stored error records.
 */
export function getStoredErrors(): ErrorRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as ErrorRecord[]
  } catch {
    return []
  }
}

/**
 * Get the count of stored errors.
 */
export function getErrorCount(): number {
  return getStoredErrors().length
}

/**
 * Clear all stored errors.
 */
export function clearErrors(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
