/**
 * Simple logging utility for production monitoring
 */

import type { Request, Response, NextFunction } from 'express'

type LogLevel = 'info' | 'warn' | 'error' | 'debug'

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  data?: unknown
  environment: string
}

class Logger {
  private environment: string

  constructor() {
    this.environment = process.env['NODE_ENV'] || 'development'
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
      environment: this.environment,
    }
  }

  private output(logEntry: LogEntry): void {
    const logString = JSON.stringify(logEntry)

    switch (logEntry.level) {
      case 'error':
        console.error(logString)
        break
      case 'warn':
        console.warn(logString)
        break
      case 'debug':
        if (this.environment === 'development') {
          console.debug(logString)
        }
        break
      default:
        console.log(logString)
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

  // Request logging middleware
  requestLogger() {
    return (req: Request, res: Response, next: NextFunction) => {
      const start = Date.now()

      res.on('finish', () => {
        const duration = Date.now() - start
        this.info('HTTP Request', {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration: `${duration}ms`,
          userAgent: req.get('user-agent'),
        })
      })

      next()
    }
  }
}

export const logger = new Logger()
