/**
 * Verbose Logger Factory
 *
 * Creates a simple stderr-based logger for verbose CLI output.
 * Extracted to eliminate 4 duplicated logger definitions in cli.ts.
 */

/**
 * Logger interface matching the shape expected by CLI services.
 */
export interface VerboseLogger {
  info: (msg: string, data?: unknown) => void
  warn: (msg: string, data?: unknown) => void
  error: (msg: string, err?: unknown) => void
  debug: (msg: string, data?: unknown) => void
}

/**
 * Create a verbose logger that writes to stderr with level prefixes.
 * Returns undefined when verbose is false, matching the optional logger
 * pattern used throughout the CLI services.
 */
export function createVerboseLogger(
  verbose: boolean
): VerboseLogger | undefined {
  if (!verbose) {
    return undefined
  }

  return {
    info: (msg: string, data?: unknown) =>
      console.error(`[INFO] ${msg}`, data ? JSON.stringify(data) : ''),
    warn: (msg: string, data?: unknown) =>
      console.error(`[WARN] ${msg}`, data ? JSON.stringify(data) : ''),
    error: (msg: string, err?: unknown) =>
      console.error(`[ERROR] ${msg}`, err instanceof Error ? err.message : ''),
    debug: (msg: string, data?: unknown) =>
      console.error(`[DEBUG] ${msg}`, data ? JSON.stringify(data) : ''),
  }
}
