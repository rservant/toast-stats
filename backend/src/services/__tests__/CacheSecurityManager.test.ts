/**
 * Unit Tests for CacheSecurityManager
 *
 * Tests path traversal rejection, directory bounds validation,
 * CSV content security validation, and district ID sanitization.
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 6.2**
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import { CacheSecurityManager } from '../CacheSecurityManager'
import { ILogger } from '../../types/serviceInterfaces'
import { createTestSelfCleanup } from '../../utils/test-self-cleanup'

/** Mock logger implementation for testing */
class TestLogger implements ILogger {
  public logs: Array<{ level: string; message: string; data?: unknown }> = []

  info(message: string, data?: unknown): void {
    this.logs.push({ level: 'info', message, data })
  }

  warn(message: string, data?: unknown): void {
    this.logs.push({ level: 'warn', message, data })
  }

  error(message: string, error?: Error | unknown): void {
    this.logs.push({ level: 'error', message, data: error })
  }

  debug(message: string, data?: unknown): void {
    this.logs.push({ level: 'debug', message, data })
  }

  clear(): void {
    this.logs = []
  }
}

describe('CacheSecurityManager - Unit Tests', () => {
  let logger: TestLogger
  let securityManager: CacheSecurityManager

  const { cleanup, afterEach: performCleanup } = createTestSelfCleanup({
    verbose: false,
  })

  beforeEach(() => {
    logger = new TestLogger()
    securityManager = new CacheSecurityManager(logger)
  })

  afterEach(async () => {
    await performCleanup()
  })

  describe('validatePathSafety - Path Traversal Rejection', () => {
    it('should reject null bytes in input', () => {
      expect(() =>
        securityManager.validatePathSafety('test\0file', 'filename')
      ).toThrow('filename contains null bytes')
    })

    it('should reject parent directory traversal patterns', () => {
      expect(() => securityManager.validatePathSafety('..', 'path')).toThrow(
        'path contains dangerous character or pattern: ..'
      )
      expect(() =>
        securityManager.validatePathSafety('test/../secret', 'path')
      ).toThrow('path contains dangerous character or pattern: ..')
    })

    it('should reject Unix path separators', () => {
      expect(() =>
        securityManager.validatePathSafety('test/file', 'path')
      ).toThrow('path contains dangerous character or pattern: /')
    })

    it('should reject Windows path separators', () => {
      expect(() =>
        securityManager.validatePathSafety('test\\file', 'path')
      ).toThrow('path contains dangerous character or pattern: \\')
    })

    it('should reject drive separators', () => {
      expect(() => securityManager.validatePathSafety('C:', 'path')).toThrow(
        'path contains dangerous character or pattern: :'
      )
    })

    it('should reject shell redirection characters', () => {
      expect(() =>
        securityManager.validatePathSafety('test<file', 'path')
      ).toThrow('path contains dangerous character or pattern: <')
      expect(() =>
        securityManager.validatePathSafety('test>file', 'path')
      ).toThrow('path contains dangerous character or pattern: >')
      expect(() =>
        securityManager.validatePathSafety('test|file', 'path')
      ).toThrow('path contains dangerous character or pattern: |')
    })

    it('should reject wildcard characters', () => {
      expect(() => securityManager.validatePathSafety('test*', 'path')).toThrow(
        'path contains dangerous character or pattern: *'
      )
      expect(() => securityManager.validatePathSafety('test?', 'path')).toThrow(
        'path contains dangerous character or pattern: ?'
      )
    })

    it('should reject control characters', () => {
      expect(() =>
        securityManager.validatePathSafety('test\nfile', 'path')
      ).toThrow('path contains dangerous character or pattern: \n')
      expect(() =>
        securityManager.validatePathSafety('test\rfile', 'path')
      ).toThrow('path contains dangerous character or pattern: \r')
      expect(() =>
        securityManager.validatePathSafety('test\tfile', 'path')
      ).toThrow('path contains dangerous character or pattern: \t')
    })

    it('should reject inputs starting with dangerous prefixes', () => {
      expect(() => securityManager.validatePathSafety('-test', 'path')).toThrow(
        'path starts with dangerous character'
      )
      expect(() =>
        securityManager.validatePathSafety('.hidden', 'path')
      ).toThrow('path starts with dangerous character')
      expect(() =>
        securityManager.validatePathSafety(' space', 'path')
      ).toThrow('path starts with dangerous character')
    })

    it('should accept valid safe inputs', () => {
      expect(() =>
        securityManager.validatePathSafety('valid-input', 'path')
      ).not.toThrow()
      expect(() =>
        securityManager.validatePathSafety('2024-01-15', 'date')
      ).not.toThrow()
      expect(() =>
        securityManager.validatePathSafety('district123', 'id')
      ).not.toThrow()
    })
  })

  describe('validateCacheDirectoryBounds - Directory Bounds Validation', () => {
    it('should accept paths within cache directory', () => {
      const cacheDir = '/app/cache'
      expect(() =>
        securityManager.validateCacheDirectoryBounds(
          '/app/cache/file.csv',
          cacheDir
        )
      ).not.toThrow()
      expect(() =>
        securityManager.validateCacheDirectoryBounds(
          '/app/cache/subdir/file.csv',
          cacheDir
        )
      ).not.toThrow()
    })

    it('should reject paths outside cache directory', () => {
      const cacheDir = '/app/cache'
      expect(() =>
        securityManager.validateCacheDirectoryBounds(
          '/app/other/file.csv',
          cacheDir
        )
      ).toThrow('outside the cache directory bounds')
      expect(() =>
        securityManager.validateCacheDirectoryBounds('/etc/passwd', cacheDir)
      ).toThrow('outside the cache directory bounds')
    })

    it('should reject path traversal attempts', () => {
      const cacheDir = '/app/cache'
      expect(() =>
        securityManager.validateCacheDirectoryBounds(
          '/app/cache/../secret',
          cacheDir
        )
      ).toThrow('outside the cache directory bounds')
    })

    it('should accept the cache directory itself', () => {
      const cacheDir = '/app/cache'
      expect(() =>
        securityManager.validateCacheDirectoryBounds('/app/cache', cacheDir)
      ).not.toThrow()
    })

    it('should skip validation when validatePaths is disabled', () => {
      const permissiveManager = new CacheSecurityManager(logger, {
        validatePaths: false,
      })
      expect(() =>
        permissiveManager.validateCacheDirectoryBounds(
          '/etc/passwd',
          '/app/cache'
        )
      ).not.toThrow()
    })
  })

  describe('validateCSVContentSecurity - CSV Content Security Validation', () => {
    it('should reject Excel formula injection patterns', () => {
      expect(() =>
        securityManager.validateCSVContentSecurity('=cmd|test')
      ).toThrow('CSV content contains potentially malicious patterns')
      expect(() =>
        securityManager.validateCSVContentSecurity('=cmd!test')
      ).toThrow('CSV content contains potentially malicious patterns')
      expect(() =>
        securityManager.validateCSVContentSecurity('= +test')
      ).toThrow('CSV content contains potentially malicious patterns')
      expect(() =>
        securityManager.validateCSVContentSecurity('= -test')
      ).toThrow('CSV content contains potentially malicious patterns')
      expect(() =>
        securityManager.validateCSVContentSecurity('= @test')
      ).toThrow('CSV content contains potentially malicious patterns')
    })

    it('should reject script injection patterns', () => {
      expect(() =>
        securityManager.validateCSVContentSecurity('<script>alert(1)</script>')
      ).toThrow('CSV content contains potentially malicious patterns')
      expect(() =>
        securityManager.validateCSVContentSecurity('javascript:alert(1)')
      ).toThrow('CSV content contains potentially malicious patterns')
      expect(() =>
        securityManager.validateCSVContentSecurity('vbscript:msgbox')
      ).toThrow('CSV content contains potentially malicious patterns')
    })

    it('should reject data URL injection', () => {
      expect(() =>
        securityManager.validateCSVContentSecurity('data:text/html,<script>')
      ).toThrow('CSV content contains potentially malicious patterns')
    })

    it('should reject event handler injection', () => {
      expect(() =>
        securityManager.validateCSVContentSecurity('onclick=alert(1)')
      ).toThrow('CSV content contains potentially malicious patterns')
      expect(() =>
        securityManager.validateCSVContentSecurity('onload =alert(1)')
      ).toThrow('CSV content contains potentially malicious patterns')
    })

    it('should reject excessively long lines', () => {
      const longLine = 'a'.repeat(10001)
      expect(() =>
        securityManager.validateCSVContentSecurity(longLine)
      ).toThrow('exceeds maximum length')
    })

    it('should reject binary/control characters', () => {
      expect(() =>
        securityManager.validateCSVContentSecurity('test\x00data')
      ).toThrow('CSV content contains binary or control characters')
      expect(() =>
        securityManager.validateCSVContentSecurity('test\x1Fdata')
      ).toThrow('CSV content contains binary or control characters')
    })

    it('should accept valid CSV content', () => {
      const validCSV = 'header1,header2\nvalue1,value2\nvalue3,value4'
      expect(() =>
        securityManager.validateCSVContentSecurity(validCSV)
      ).not.toThrow()
    })

    it('should accept CSV with equals sign in data (not formula)', () => {
      const csvWithEquals = 'name,formula\ntest,a=b'
      expect(() =>
        securityManager.validateCSVContentSecurity(csvWithEquals)
      ).not.toThrow()
    })
  })

  describe('sanitizeDistrictId - District ID Sanitization', () => {
    it('should preserve valid alphanumeric district IDs', () => {
      expect(securityManager.sanitizeDistrictId('district123')).toBe(
        'district123'
      )
      expect(securityManager.sanitizeDistrictId('D42')).toBe('D42')
    })

    it('should preserve hyphens and underscores', () => {
      expect(securityManager.sanitizeDistrictId('district-123')).toBe(
        'district-123'
      )
      expect(securityManager.sanitizeDistrictId('district_123')).toBe(
        'district_123'
      )
    })

    it('should remove dangerous characters', () => {
      expect(securityManager.sanitizeDistrictId('district../123')).toBe(
        'district123'
      )
      expect(securityManager.sanitizeDistrictId('district/123')).toBe(
        'district123'
      )
      expect(securityManager.sanitizeDistrictId('district\\123')).toBe(
        'district123'
      )
      expect(securityManager.sanitizeDistrictId('district<>123')).toBe(
        'district123'
      )
    })

    it('should remove spaces and special characters', () => {
      expect(securityManager.sanitizeDistrictId('district 123')).toBe(
        'district123'
      )
      expect(securityManager.sanitizeDistrictId('district@123')).toBe(
        'district123'
      )
      expect(securityManager.sanitizeDistrictId('district#123')).toBe(
        'district123'
      )
    })
  })

  describe('validateDistrictId - District ID Validation', () => {
    it('should accept valid district IDs', () => {
      expect(() =>
        securityManager.validateDistrictId('district123')
      ).not.toThrow()
      expect(() => securityManager.validateDistrictId('D42')).not.toThrow()
      expect(() =>
        securityManager.validateDistrictId('district-123')
      ).not.toThrow()
      expect(() =>
        securityManager.validateDistrictId('district_123')
      ).not.toThrow()
    })

    it('should reject district IDs with invalid characters', () => {
      expect(() => securityManager.validateDistrictId('district/123')).toThrow(
        'dangerous character or pattern'
      )
      expect(() => securityManager.validateDistrictId('district..123')).toThrow(
        'dangerous character or pattern'
      )
    })

    it('should reject district IDs that are too long', () => {
      const longId = 'a'.repeat(51)
      expect(() => securityManager.validateDistrictId(longId)).toThrow(
        'District ID too long'
      )
    })

    it('should reject district IDs with special characters', () => {
      expect(() => securityManager.validateDistrictId('district@123')).toThrow(
        'District ID contains invalid characters'
      )
      expect(() => securityManager.validateDistrictId('district 123')).toThrow(
        'District ID contains invalid characters'
      )
    })

    it('should skip sanitization when sanitizeInputs is disabled', () => {
      const permissiveManager = new CacheSecurityManager(logger, {
        sanitizeInputs: false,
      })
      // Should still fail basic format validation
      expect(() =>
        permissiveManager.validateDistrictId('district@123')
      ).toThrow('Invalid district ID format')
    })
  })

  describe('validateDateString - Date String Validation', () => {
    it('should accept valid YYYY-MM-DD dates', () => {
      expect(() =>
        securityManager.validateDateString('2024-01-15')
      ).not.toThrow()
      expect(() =>
        securityManager.validateDateString('2023-12-31')
      ).not.toThrow()
      expect(() =>
        securityManager.validateDateString('2025-06-01')
      ).not.toThrow()
    })

    it('should reject invalid date formats', () => {
      expect(() => securityManager.validateDateString('01-15-2024')).toThrow(
        'Invalid date format'
      )
      expect(() => securityManager.validateDateString('2024/01/15')).toThrow(
        'Invalid date format'
      )
      expect(() => securityManager.validateDateString('2024-1-15')).toThrow(
        'Invalid date format'
      )
      expect(() => securityManager.validateDateString('not-a-date')).toThrow(
        'Invalid date format'
      )
    })

    it('should reject invalid calendar dates', () => {
      // Invalid month (13) and invalid day (30 in Feb) throw different errors
      // depending on how the Date constructor handles them
      expect(() => securityManager.validateDateString('2024-13-01')).toThrow() // May throw 'Invalid date format' or 'Invalid time value'
      expect(() => securityManager.validateDateString('2024-02-30')).toThrow() // May throw 'Invalid date format' or 'Invalid time value'
    })

    it('should reject dates with path traversal attempts', () => {
      expect(() =>
        securityManager.validateDateString('2024-01-15/../secret')
      ).toThrow('Invalid date format')
    })
  })

  describe('validateCSVContent - CSV Content Validation', () => {
    it('should accept valid CSV content', () => {
      const validCSV = 'header1,header2\nvalue1,value2'
      expect(() =>
        securityManager.validateCSVContent(validCSV, 100)
      ).not.toThrow()
    })

    it('should reject empty content', () => {
      expect(() => securityManager.validateCSVContent('', 100)).toThrow(
        'CSV content cannot be empty'
      )
      expect(() => securityManager.validateCSVContent('   ', 100)).toThrow(
        'CSV content cannot be empty'
      )
    })

    it('should reject content exceeding size limit', () => {
      const largeContent = 'header\n' + 'a'.repeat(2 * 1024 * 1024) // 2MB
      expect(() => securityManager.validateCSVContent(largeContent, 1)).toThrow(
        'CSV content too large'
      )
    })

    it('should reject CSV with only header (no data rows)', () => {
      expect(() =>
        securityManager.validateCSVContent('header1,header2', 100)
      ).toThrow('CSV must have at least a header and one data row')
    })

    it('should reject CSV with malicious content when sanitizeInputs is enabled', () => {
      const maliciousCSV = 'header\n=cmd|test'
      expect(() =>
        securityManager.validateCSVContent(maliciousCSV, 100)
      ).toThrow('CSV content contains potentially malicious patterns')
    })

    it('should skip security validation when sanitizeInputs is disabled', () => {
      const permissiveManager = new CacheSecurityManager(logger, {
        sanitizeInputs: false,
      })
      const csvWithFormula = 'header\n=cmd|test'
      // Should not throw because security validation is skipped
      expect(() =>
        permissiveManager.validateCSVContent(csvWithFormula, 100)
      ).not.toThrow()
    })
  })

  describe('setSecureFilePermissions - File Permission Management', () => {
    it('should set file permissions to 600', async () => {
      const testDir = `./test-cache/security-test-${Date.now()}`
      const testFile = path.join(testDir, 'test-file.txt')

      cleanup.trackDirectory(path.resolve(testDir))

      await fs.mkdir(testDir, { recursive: true })
      await fs.writeFile(testFile, 'test content')

      await securityManager.setSecureFilePermissions(testFile)

      const stats = await fs.stat(testFile)
      // Check that only owner has read/write permissions (0o600 = 384)
      expect(stats.mode & 0o777).toBe(0o600)
    })

    it('should skip permission setting when enforcePermissions is disabled', async () => {
      const permissiveManager = new CacheSecurityManager(logger, {
        enforcePermissions: false,
      })
      const testDir = `./test-cache/security-test-skip-${Date.now()}`
      const testFile = path.join(testDir, 'test-file.txt')

      cleanup.trackDirectory(path.resolve(testDir))

      await fs.mkdir(testDir, { recursive: true })
      await fs.writeFile(testFile, 'test content')

      const statsBefore = await fs.stat(testFile)
      await permissiveManager.setSecureFilePermissions(testFile)
      const statsAfter = await fs.stat(testFile)

      // Permissions should remain unchanged
      expect(statsAfter.mode).toBe(statsBefore.mode)
    })

    it('should log warning on permission failure without throwing', async () => {
      await securityManager.setSecureFilePermissions('/nonexistent/file.txt')

      const hasWarning = logger.logs.some(
        log =>
          log.level === 'warn' &&
          log.message.includes('Failed to set secure file permissions')
      )
      expect(hasWarning).toBe(true)
    })
  })

  describe('setSecureDirectoryPermissions - Directory Permission Management', () => {
    it('should set directory permissions to 700', async () => {
      const testDir = `./test-cache/security-dir-test-${Date.now()}`

      cleanup.trackDirectory(path.resolve(testDir))

      await fs.mkdir(testDir, { recursive: true })

      await securityManager.setSecureDirectoryPermissions(testDir)

      const stats = await fs.stat(testDir)
      // Check that only owner has full permissions (0o700 = 448)
      expect(stats.mode & 0o777).toBe(0o700)
    })

    it('should skip permission setting when enforcePermissions is disabled', async () => {
      const permissiveManager = new CacheSecurityManager(logger, {
        enforcePermissions: false,
      })
      const testDir = `./test-cache/security-dir-skip-${Date.now()}`

      cleanup.trackDirectory(path.resolve(testDir))

      await fs.mkdir(testDir, { recursive: true })

      const statsBefore = await fs.stat(testDir)
      await permissiveManager.setSecureDirectoryPermissions(testDir)
      const statsAfter = await fs.stat(testDir)

      // Permissions should remain unchanged
      expect(statsAfter.mode).toBe(statsBefore.mode)
    })

    it('should log warning on permission failure without throwing', async () => {
      await securityManager.setSecureDirectoryPermissions(
        '/nonexistent/directory'
      )

      const hasWarning = logger.logs.some(
        log =>
          log.level === 'warn' &&
          log.message.includes('Failed to set secure directory permissions')
      )
      expect(hasWarning).toBe(true)
    })
  })
})
