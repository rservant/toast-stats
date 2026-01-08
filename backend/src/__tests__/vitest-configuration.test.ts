/**
 * Unit tests for Vitest configuration validation
 *
 * Tests that sequential execution is properly configured
 * Tests timeout settings for different test types
 *
 * **Feature: test-infrastructure-stabilization**
 * **Validates: Requirements 5.1, 5.2**
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

interface VitestConfig {
  test: {
    pool?: string
    singleFork?: boolean
    isolate?: boolean
    clearMocks?: boolean
    restoreMocks?: boolean
    testTimeout?: number
    hookTimeout?: number
    teardownTimeout?: number
    slowTestThreshold?: number
    environment?: string
    globals?: boolean
    setupFiles?: string[]
    exclude?: string[]
    coverage?: {
      provider?: string
      reporter?: string[]
      exclude?: string[]
    }
  }
}

describe('Vitest Configuration', () => {
  let vitestConfig: VitestConfig

  beforeEach(() => {
    // Read and parse the vitest config file
    const configPath = join(process.cwd(), 'vitest.config.ts')
    const configContent = readFileSync(configPath, 'utf-8')

    // Extract the configuration object from the TypeScript file
    // This is a simple approach - in a real scenario you might want to use a proper TS parser
    const configMatch = configContent.match(
      /export default defineConfig\((\{[\s\S]*\})\)/
    )
    if (!configMatch) {
      throw new Error('Could not parse vitest config')
    }

    // Parse the configuration (simplified approach)
    vitestConfig = parseVitestConfig(configContent)
  })

  describe('Sequential Execution Configuration', () => {
    it('should configure pool as forks', () => {
      expect(vitestConfig.test.pool).toBe('forks')
    })

    it('should configure singleFork as true', () => {
      expect(vitestConfig.test.singleFork).toBe(true)
    })

    it('should enable test isolation', () => {
      expect(vitestConfig.test.isolate).toBe(true)
    })

    it('should enable mock clearing and restoration', () => {
      expect(vitestConfig.test.clearMocks).toBe(true)
      expect(vitestConfig.test.restoreMocks).toBe(true)
    })
  })

  describe('Timeout Configuration', () => {
    it('should set appropriate test timeout (30 seconds)', () => {
      expect(vitestConfig.test.testTimeout).toBe(30000)
    })

    it('should set appropriate hook timeout (10 seconds)', () => {
      expect(vitestConfig.test.hookTimeout).toBe(10000)
    })

    it('should set appropriate teardown timeout (10 seconds)', () => {
      expect(vitestConfig.test.teardownTimeout).toBe(10000)
    })

    it('should set slow test threshold to 10 seconds (property test requirement)', () => {
      expect(vitestConfig.test.slowTestThreshold).toBe(10000)
    })
  })

  describe('Environment Configuration', () => {
    it('should use node environment', () => {
      expect(vitestConfig.test.environment).toBe('node')
    })

    it('should enable globals', () => {
      expect(vitestConfig.test.globals).toBe(true)
    })

    it('should configure setup files', () => {
      expect(vitestConfig.test.setupFiles).toContain(
        './src/__tests__/vitest.setup.ts'
      )
    })
  })

  describe('Test Environment Variables', () => {
    it('should have NODE_ENV set to test', () => {
      expect(process.env.NODE_ENV).toBe('test')
    })

    it('should have USE_MOCK_DATA enabled', () => {
      expect(process.env.USE_MOCK_DATA).toBe('true')
    })

    it('should have TEST_ISOLATION enabled', () => {
      expect(process.env.TEST_ISOLATION).toBe('true')
    })

    it('should have property test configuration set', () => {
      expect(process.env.PROPERTY_TEST_ITERATIONS).toBe('3')
      expect(process.env.PROPERTY_TEST_TIMEOUT).toBe('5000')
    })

    it('should have cache directory configured', () => {
      expect(process.env.CACHE_DIR).toBeDefined()
    })
  })

  describe('Exclusion Configuration', () => {
    it('should exclude node_modules and dist directories', () => {
      expect(vitestConfig.test.exclude).toContain('**/node_modules/**')
      expect(vitestConfig.test.exclude).toContain('**/dist/**')
    })

    it('should exclude test directory artifacts', () => {
      expect(vitestConfig.test.exclude).toContain('**/test-dir/**')
    })
  })

  describe('Coverage Configuration', () => {
    it('should use v8 coverage provider', () => {
      expect(vitestConfig.test.coverage?.provider).toBe('v8')
    })

    it('should configure coverage reporters', () => {
      expect(vitestConfig.test.coverage?.reporter).toContain('text')
      expect(vitestConfig.test.coverage?.reporter).toContain('json')
      expect(vitestConfig.test.coverage?.reporter).toContain('html')
    })

    it('should exclude appropriate directories from coverage', () => {
      expect(vitestConfig.test.coverage?.exclude).toContain(
        '**/node_modules/**'
      )
      expect(vitestConfig.test.coverage?.exclude).toContain('**/dist/**')
      expect(vitestConfig.test.coverage?.exclude).toContain('**/test-dir/**')
    })
  })
})

/**
 * Simple parser for vitest config - extracts key configuration values
 * This is a simplified approach for testing purposes
 */
function parseVitestConfig(configContent: string): VitestConfig {
  const config: VitestConfig = {
    test: {
      coverage: {},
    },
  }

  // Extract pool configuration
  if (configContent.includes("pool: 'forks'")) {
    config.test.pool = 'forks'
  }

  // Extract singleFork configuration (updated for Vitest 4.x)
  if (configContent.includes('singleFork: true')) {
    config.test.singleFork = true
  }

  // Extract isolate configuration
  if (configContent.includes('isolate: true')) {
    config.test.isolate = true
  }

  // Extract environment
  if (configContent.includes("environment: 'node'")) {
    config.test.environment = 'node'
  }

  // Extract globals
  if (configContent.includes('globals: true')) {
    config.test.globals = true
  }

  // Extract mock configuration
  if (configContent.includes('clearMocks: true')) {
    config.test.clearMocks = true
  }
  if (configContent.includes('restoreMocks: true')) {
    config.test.restoreMocks = true
  }

  // Extract timeout configurations
  const testTimeoutMatch = configContent.match(/testTimeout:\s*(\d+)/)
  if (testTimeoutMatch) {
    config.test.testTimeout = parseInt(testTimeoutMatch[1], 10)
  }

  const hookTimeoutMatch = configContent.match(/hookTimeout:\s*(\d+)/)
  if (hookTimeoutMatch) {
    config.test.hookTimeout = parseInt(hookTimeoutMatch[1], 10)
  }

  const teardownTimeoutMatch = configContent.match(/teardownTimeout:\s*(\d+)/)
  if (teardownTimeoutMatch) {
    config.test.teardownTimeout = parseInt(teardownTimeoutMatch[1], 10)
  }

  const slowTestThresholdMatch = configContent.match(
    /slowTestThreshold:\s*(\d+)/
  )
  if (slowTestThresholdMatch) {
    config.test.slowTestThreshold = parseInt(slowTestThresholdMatch[1], 10)
  }

  // Extract setup files
  const setupFilesMatch = configContent.match(/setupFiles:\s*\[(.*?)\]/)
  if (setupFilesMatch) {
    config.test.setupFiles = setupFilesMatch[1]
      .split(',')
      .map(file => file.trim().replace(/['"]/g, ''))
  }

  // Extract exclude patterns - improved regex to handle multiline arrays
  const excludeMatch = configContent.match(
    /exclude:\s*\[([\s\S]*?)\],?\s*coverage:/
  )
  if (excludeMatch) {
    config.test.exclude = excludeMatch[1]
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.startsWith("'") || line.startsWith('"'))
      .map(line => line.replace(/['"]/g, '').replace(/,$/, ''))
      .filter(pattern => pattern.length > 0 && !pattern.startsWith('//'))
  }

  // Extract coverage configuration
  if (configContent.includes("provider: 'v8'")) {
    if (!config.test.coverage) config.test.coverage = {}
    config.test.coverage.provider = 'v8'
  }

  const reporterMatch = configContent.match(/reporter:\s*\[(.*?)\]/)
  if (reporterMatch) {
    if (!config.test.coverage) config.test.coverage = {}
    config.test.coverage.reporter = reporterMatch[1]
      .split(',')
      .map(reporter => reporter.trim().replace(/['"]/g, ''))
  }

  // Extract coverage exclude patterns - improved regex
  const coverageExcludeMatch = configContent.match(
    /coverage:\s*{[\s\S]*?exclude:\s*\[([\s\S]*?)\]/
  )
  if (coverageExcludeMatch) {
    if (!config.test.coverage) config.test.coverage = {}
    config.test.coverage.exclude = coverageExcludeMatch[1]
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.startsWith("'") || line.startsWith('"'))
      .map(line => line.replace(/['"]/g, '').replace(/,$/, ''))
      .filter(pattern => pattern.length > 0 && !pattern.startsWith('//'))
  }

  return config
}
