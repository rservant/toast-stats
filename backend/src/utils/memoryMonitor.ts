/**
 * Memory Monitor
 *
 * Provides periodic memory metrics logging for operational visibility.
 * Uses process.memoryUsage() to collect heap, RSS, and external memory metrics,
 * converting bytes to megabytes for readability.
 *
 * This module MUST be resilient to transient errors and continue operating.
 */

import { logger } from './logger.js'

const BYTES_PER_MB = 1024 * 1024

export interface MemoryMetrics {
  heapUsedMB: number
  heapTotalMB: number
  rssMB: number
  externalMB: number
  arrayBuffersMB: number
  timestamp: string
}

function bytesToMB(bytes: number): number {
  return Math.round((bytes / BYTES_PER_MB) * 100) / 100
}

export class MemoryMonitor {
  private intervalRef: ReturnType<typeof setInterval> | null = null

  /**
   * Collect current memory metrics from process.memoryUsage().
   * Returns structured metrics with values in megabytes.
   */
  collectMetrics(): MemoryMetrics {
    const usage = process.memoryUsage()
    return {
      heapUsedMB: bytesToMB(usage.heapUsed),
      heapTotalMB: bytesToMB(usage.heapTotal),
      rssMB: bytesToMB(usage.rss),
      externalMB: bytesToMB(usage.external),
      arrayBuffersMB: bytesToMB(usage.arrayBuffers),
      timestamp: new Date().toISOString(),
    }
  }

  /**
   * Log current memory metrics using the existing logger infrastructure.
   */
  logMetrics(): void {
    try {
      const metrics = this.collectMetrics()
      logger.info('Memory metrics', {
        component: 'MemoryMonitor',
        ...metrics,
      })
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown error collecting memory metrics'
      logger.error('Failed to collect memory metrics', {
        component: 'MemoryMonitor',
        error: message,
      })
    }
  }

  /**
   * Start periodic memory metrics logging.
   * If already running, this is a no-op.
   */
  start(intervalMs: number): void {
    if (this.intervalRef !== null) {
      logger.debug('Memory monitor already running', {
        component: 'MemoryMonitor',
      })
      return
    }

    // Log metrics immediately at startup
    this.logMetrics()

    this.intervalRef = setInterval(() => {
      this.logMetrics()
    }, intervalMs)

    // Unref the interval so it doesn't prevent graceful shutdown
    this.intervalRef.unref()

    logger.info('Memory monitor started', {
      component: 'MemoryMonitor',
      intervalMs,
    })
  }

  /**
   * Stop periodic memory metrics logging.
   * Safe to call multiple times (idempotent).
   */
  stop(): void {
    if (this.intervalRef !== null) {
      clearInterval(this.intervalRef)
      this.intervalRef = null
      logger.info('Memory monitor stopped', {
        component: 'MemoryMonitor',
      })
    }
  }

  /**
   * Whether the monitor is currently running.
   */
  isRunning(): boolean {
    return this.intervalRef !== null
  }
}
