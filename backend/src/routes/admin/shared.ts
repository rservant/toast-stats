/**
 * Shared utilities, middleware, and types for admin routes
 *
 * This module provides common functionality used across all admin route modules:
 * - logAdminAccess middleware for audit logging
 * - generateOperationId helper for request tracing
 * - getServiceFactory wrapper for service access
 * - Shared type definitions for responses
 *
 * Requirements: 6.1, 6.4
 */

import { Request, Response, NextFunction } from 'express'
import { logger } from '../../utils/logger.js'
import {
  getProductionServiceFactory,
  type ProductionServiceFactory,
} from '../../services/ProductionServiceFactory.js'

// ============================================================================
// Middleware
// ============================================================================

/**
 * Middleware to log admin access
 * Applied to all admin routes for audit trail
 *
 * Logs:
 * - Endpoint path
 * - Client IP address
 * - User agent
 *
 * Requirements: 6.1, 6.2
 */
export const logAdminAccess = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  logger.info('Admin endpoint accessed', {
    endpoint: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  })
  next()
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate unique operation ID for request tracing
 *
 * Format: {prefix}_{timestamp}_{random}
 * Example: list_snapshots_1704067200000_abc123xyz
 *
 * @param prefix - Operation name prefix (e.g., 'list_snapshots', 'health_check')
 * @returns Unique operation ID string
 */
export function generateOperationId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Get production service factory instance
 * Centralized access to avoid repeated imports in route modules
 *
 * @returns ProductionServiceFactory instance
 */
export function getServiceFactory(): ProductionServiceFactory {
  return getProductionServiceFactory()
}

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Standard error response format for admin routes
 *
 * Used consistently across all admin endpoints for error responses
 */
export interface AdminErrorResponse {
  error: {
    /** Error code for programmatic handling (e.g., 'SNAPSHOT_NOT_FOUND') */
    code: string
    /** Human-readable error message */
    message: string
    /** Optional additional context or details */
    details?: string
  }
}

/**
 * Standard metadata format for admin responses
 *
 * Included in successful responses to provide operation context
 */
export interface AdminResponseMetadata {
  /** Unique operation ID for request tracing */
  operation_id: string
  /** Operation duration in milliseconds */
  duration_ms: number
  /** ISO timestamp when response was generated (for list/get operations) */
  generated_at?: string
  /** ISO timestamp when data was retrieved (for data retrieval operations) */
  retrieved_at?: string
  /** ISO timestamp when check was performed (for health/integrity checks) */
  checked_at?: string
  /** ISO timestamp when validation was performed (for validation operations) */
  validated_at?: string
}
