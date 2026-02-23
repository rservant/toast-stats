/**
 * Logger utility for the Collector CLI
 *
 * Provides structured logging with JSON output for production monitoring.
 * This is a standalone implementation that doesn't depend on the backend.
 *
 * Requirement 6.5: Log all operations with timestamps for debugging and audit
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug'

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  data?: unknown
  component: string
}

class Logger {
  private verbose: boolean = false
  private component: string = 'collector-cli'

  /**
   * Set verbose mode for detailed logging
   */
  setVerbose(verbose: boolean): void {
    this.verbose = verbose
  }

  /**
   * Set the component name for log entries
   */
  setComponent(component: string): void {
    this.component = component
  }

  private formatLog(
    level: LogLevel,
    message: string,
    data?: unknown
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      component: this.component,
    }
  }

  private output(logEntry: LogEntry): void {
    // Always output to stderr to keep stdout clean for JSON output
    const logString = JSON.stringify(logEntry)

    switch (logEntry.level) {
      case 'error':
        console.error(logString)
        break
      case 'warn':
        console.error(logString)
        break
      case 'debug':
        if (this.verbose) {
          console.error(logString)
        }
        break
      default:
        console.error(logString)
    }
  }

  info(message: string, data?: unknown): void {
    this.output(this.formatLog('info', message, data))
  }

  warn(message: string, data?: unknown): void {
    this.output(this.formatLog('warn', message, data))
  }

  error(message: string, error?: Error | unknown): void {
    const errorData =
      error instanceof Error
        ? {
            message: error.message,
            stack: error.stack,
            name: error.name,
          }
        : error

    this.output(this.formatLog('error', message, errorData))
  }

  debug(message: string, data?: unknown): void {
    this.output(this.formatLog('debug', message, data))
  }
}

export const logger = new Logger()
