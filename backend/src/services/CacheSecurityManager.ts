/**
 * Cache Security Manager
 *
 * Handles path safety validation, directory bounds checking, file permissions,
 * and content security validation for the raw CSV cache system.
 */

import { promises as fs } from 'fs'
import * as path from 'path'
import type {
  ICacheSecurityManager,
  SecurityConfig,
  ILogger,
} from '../types/serviceInterfaces.js'

/** Default security configuration */
const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  validatePaths: true,
  sanitizeInputs: true,
  enforcePermissions: true,
}

/** Cache Security Manager Implementation */
export class CacheSecurityManager implements ICacheSecurityManager {
  private readonly config: SecurityConfig
  private readonly logger: ILogger

  constructor(logger: ILogger, config?: Partial<SecurityConfig>) {
    this.logger = logger
    this.config = { ...DEFAULT_SECURITY_CONFIG, ...config }
  }

  /** Comprehensive path safety validation to prevent path traversal attacks */
  validatePathSafety(input: string, inputType: string): void {
    // Check for null bytes
    if (input.includes('\0')) {
      throw new Error(`${inputType} contains null bytes`)
    }

    // Check for path traversal patterns
    const dangerousPatterns = [
      '..', // Parent directory
      '/', // Unix path separator
      '\\', // Windows path separator
      ':', // Drive separator (Windows)
      '<', // Redirection
      '>', // Redirection
      '|', // Pipe
      '?', // Wildcard
      '*', // Wildcard
      '"', // Quote
      '\n', // Newline
      '\r', // Carriage return
      '\t', // Tab
    ]

    for (const pattern of dangerousPatterns) {
      if (input.includes(pattern)) {
        throw new Error(
          `${inputType} contains dangerous character or pattern: ${pattern}`
        )
      }
    }

    // Check for control characters
    // eslint-disable-next-line no-control-regex
    if (/[\x00-\x1f\x7f-\x9f]/.test(input)) {
      throw new Error(`${inputType} contains control characters`)
    }

    // Ensure the input doesn't start with dangerous prefixes
    const dangerousPrefixes = ['-', '.', ' ']
    if (dangerousPrefixes.some(prefix => input.startsWith(prefix))) {
      throw new Error(`${inputType} starts with dangerous character`)
    }
  }

  /** Ensure all cache operations remain within the designated cache directory */
  validateCacheDirectoryBounds(filePath: string, cacheDir: string): void {
    if (!this.config.validatePaths) {
      return
    }

    try {
      // Resolve the absolute path to handle any relative path components
      const resolvedPath = path.resolve(filePath)
      const resolvedCacheDir = path.resolve(cacheDir)

      // Check if the resolved path is within the cache directory
      if (
        !resolvedPath.startsWith(resolvedCacheDir + path.sep) &&
        resolvedPath !== resolvedCacheDir
      ) {
        throw new Error(
          `File path ${filePath} is outside the cache directory bounds`
        )
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('outside the cache directory')
      ) {
        throw error
      }
      throw new Error(
        `Invalid file path: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /** Set appropriate file permissions for cached files (owner read/write only) */
  async setSecureFilePermissions(filePath: string): Promise<void> {
    if (!this.config.enforcePermissions) {
      return
    }

    try {
      // Set file permissions to be readable/writable by owner only (600)
      // This prevents other users from reading potentially sensitive data
      await fs.chmod(filePath, 0o600)

      this.logger.debug('Set secure file permissions', {
        filePath,
        permissions: '600',
      })
    } catch (error) {
      this.logger.warn('Failed to set secure file permissions', {
        filePath,
        error,
      })
      // Don't throw - this is a security enhancement, not a critical failure
    }
  }

  /** Set appropriate directory permissions for cache directories (owner access only) */
  async setSecureDirectoryPermissions(dirPath: string): Promise<void> {
    if (!this.config.enforcePermissions) {
      return
    }

    try {
      // Set directory permissions to be accessible by owner only (700)
      await fs.chmod(dirPath, 0o700)

      this.logger.debug('Set secure directory permissions', {
        dirPath,
        permissions: '700',
      })
    } catch (error) {
      this.logger.warn('Failed to set secure directory permissions', {
        dirPath,
        error,
      })
      // Don't throw - this is a security enhancement, not a critical failure
    }
  }

  /** Validate CSV content for security issues */
  validateCSVContentSecurity(csvContent: string): void {
    // Check for potential script injection in CSV content
    const dangerousPatterns = [
      /^=.*[|!]/m, // Formula injection (Excel) - starts with = and contains | or !
      /=\s*[+\-@]/, // Formula injection (Excel) - traditional patterns
      /<script/i, // Script tags
      /javascript:/i, // JavaScript URLs
      /data:text\/html/i, // Data URLs
      /vbscript:/i, // VBScript URLs
      /on\w+\s*=/i, // Event handlers
    ]

    for (const pattern of dangerousPatterns) {
      if (pattern.test(csvContent)) {
        throw new Error('CSV content contains potentially malicious patterns')
      }
    }

    // Check for excessive line length that might indicate malicious content
    const lines = csvContent.split('\n')
    const maxLineLength = 10000 // 10KB per line should be sufficient for legitimate CSV

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (line !== undefined && line.length > maxLineLength) {
        throw new Error(
          `CSV line ${i + 1} exceeds maximum length of ${maxLineLength} characters`
        )
      }
    }

    // Check for suspicious binary content
    // eslint-disable-next-line no-control-regex
    if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(csvContent)) {
      throw new Error('CSV content contains binary or control characters')
    }
  }

  /** Sanitize district ID by removing dangerous characters */
  sanitizeDistrictId(districtId: string): string {
    // Remove any characters that aren't alphanumeric, hyphens, or underscores
    return districtId.replace(/[^a-zA-Z0-9\-_]/g, '')
  }

  /** Validate district ID and sanitize for path safety */
  validateDistrictId(districtId: string): void {
    if (this.config.sanitizeInputs) {
      // Enhanced path traversal protection
      this.validatePathSafety(districtId, 'district ID')

      // Sanitize district ID
      const sanitized = this.sanitizeDistrictId(districtId)
      if (sanitized !== districtId) {
        throw new Error(
          `District ID contains invalid characters: ${districtId}`
        )
      }
    }

    // Basic validation - district IDs should be alphanumeric with limited special characters
    if (!/^[a-zA-Z0-9\-_]+$/.test(districtId)) {
      throw new Error(
        `Invalid district ID format: ${districtId}. Only alphanumeric characters, hyphens, and underscores are allowed.`
      )
    }

    // Length validation
    if (districtId.length > 50) {
      throw new Error(
        `District ID too long: ${districtId}. Maximum length is 50 characters.`
      )
    }
  }

  /** Validate date string format (YYYY-MM-DD) and prevent path traversal */
  validateDateString(date: string): void {
    if (!this.isValidDateString(date)) {
      throw new Error(
        `Invalid date format: ${date}. Expected YYYY-MM-DD format.`
      )
    }

    // Enhanced security validation for path traversal prevention
    if (this.config.validatePaths) {
      this.validatePathSafety(date, 'date string')
    }
  }

  /** Validate CSV content before caching to prevent malicious content storage */
  validateCSVContent(csvContent: string, maxSizeMB: number): void {
    if (!csvContent || csvContent.trim().length === 0) {
      throw new Error('CSV content cannot be empty')
    }

    // Size validation to prevent excessive memory usage
    const maxSize = maxSizeMB * 1024 * 1024 // Convert MB to bytes
    if (Buffer.byteLength(csvContent, 'utf-8') > maxSize) {
      throw new Error(`CSV content too large. Maximum size is ${maxSizeMB}MB`)
    }

    // Basic CSV structure validation
    const lines = csvContent.trim().split('\n')
    if (lines.length < 2) {
      throw new Error('CSV must have at least a header and one data row')
    }

    // Enhanced security validation
    if (this.config.sanitizeInputs) {
      this.validateCSVContentSecurity(csvContent)
    }
  }

  /** Check if date string is valid (YYYY-MM-DD format) */
  private isValidDateString(date: string): boolean {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(date)) {
      return false
    }

    const dateObj = new Date(date + 'T00:00:00')
    return dateObj.toISOString().startsWith(date)
  }
}
