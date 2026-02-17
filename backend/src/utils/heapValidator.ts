/**
 * Heap Configuration Validator
 *
 * Validates V8 heap configuration against container memory limits at startup.
 * Logs warnings if the heap-to-container ratio exceeds safe thresholds.
 *
 * This module MUST NOT prevent application startup — all validation errors
 * are logged but never block the server from starting.
 */

import v8 from 'node:v8'
import { logger } from './logger.js'

const BYTES_PER_MB = 1024 * 1024
const DEFAULT_CONTAINER_MEMORY_MB = 512
const WARNING_THRESHOLD = 0.85

export interface HeapValidationResult {
  heapSizeLimitMB: number
  containerMemoryMB: number
  heapRatio: number
  isValid: boolean
  warning?: string
}

function getContainerMemoryMB(): number {
  const envValue = process.env['CONTAINER_MEMORY_MB']
  if (envValue === undefined) {
    return DEFAULT_CONTAINER_MEMORY_MB
  }

  const parsed = parseInt(envValue, 10)
  if (Number.isNaN(parsed) || parsed <= 0) {
    logger.warn('Invalid CONTAINER_MEMORY_MB value, using default', {
      component: 'HeapValidator',
      envValue,
      default: DEFAULT_CONTAINER_MEMORY_MB,
    })
    return DEFAULT_CONTAINER_MEMORY_MB
  }

  return parsed
}

export function validateHeapConfiguration(): HeapValidationResult {
  try {
    const heapStats = v8.getHeapStatistics()
    const heapSizeLimitMB = heapStats.heap_size_limit / BYTES_PER_MB
    const containerMemoryMB = getContainerMemoryMB()
    const heapRatio = heapSizeLimitMB / containerMemoryMB

    logger.info('V8 heap configuration', {
      component: 'HeapValidator',
      heapSizeLimitMB: Math.round(heapSizeLimitMB * 100) / 100,
      containerMemoryMB,
      heapRatio: Math.round(heapRatio * 100) / 100,
    })

    if (heapRatio > WARNING_THRESHOLD) {
      const warning =
        `Heap limit (${Math.round(heapSizeLimitMB)}MB) exceeds ${WARNING_THRESHOLD * 100}% ` +
        `of container memory (${containerMemoryMB}MB). ` +
        `Recommended max: ${Math.floor(containerMemoryMB * WARNING_THRESHOLD)}MB.`

      logger.warn(warning, {
        component: 'HeapValidator',
        heapSizeLimitMB: Math.round(heapSizeLimitMB * 100) / 100,
        containerMemoryMB,
        heapRatio: Math.round(heapRatio * 100) / 100,
        recommendedMaxMB: Math.floor(containerMemoryMB * WARNING_THRESHOLD),
      })

      return {
        heapSizeLimitMB,
        containerMemoryMB,
        heapRatio,
        isValid: false,
        warning,
      }
    }

    return {
      heapSizeLimitMB,
      containerMemoryMB,
      heapRatio,
      isValid: true,
    }
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unknown error reading V8 heap statistics'

    logger.error('Failed to validate heap configuration', {
      component: 'HeapValidator',
      error: message,
    })

    return {
      heapSizeLimitMB: 0,
      containerMemoryMB: getContainerMemoryMB(),
      heapRatio: 0,
      isValid: false,
      warning: `Unable to validate heap configuration: ${message}`,
    }
  }
}
