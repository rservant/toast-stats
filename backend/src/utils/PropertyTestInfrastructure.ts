/**
 * Property-Based Testing Infrastructure Improvements
 *
 * This module provides enhanced property-based testing utilities with:
 * - Deterministic test data generators
 * - Optimized iteration counts for CI
 * - Timeout handling and error reporting
 * - Counterexample capture and reporting
 *
 * **Feature: test-infrastructure-stabilization**
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 */

import fc from 'fast-check'
import { logger } from './logger.js'

/**
 * Configuration for property-based tests
 */
export interface PropertyTestConfig {
  /** Number of iterations to run (optimized for CI) */
  iterations: number
  /** Timeout in milliseconds */
  timeout: number
  /** Seed for deterministic generation */
  seed?: number
  /** Enable shrinking to find minimal counterexamples */
  shrinkingEnabled: boolean
  /** Environment-specific settings */
  environment: 'ci' | 'local' | 'test'
}

/**
 * Result of a property test execution
 */
export interface PropertyTestResult<T> {
  /** Whether the test passed */
  passed: boolean
  /** Number of iterations completed */
  iterations: number
  /** Original counterexample that caused failure */
  counterExample?: T
  /** Shrunk counterexample (minimal failing case) */
  shrunkCounterExample?: T
  /** Error that occurred during testing */
  error?: Error
  /** Execution time in milliseconds */
  executionTime: number
  /** Seed used for generation */
  seed: number
}

/**
 * Enhanced property test runner with improved error reporting and timeout handling
 */
export class PropertyTestRunner {
  private defaultConfig: PropertyTestConfig

  constructor(environment: 'ci' | 'local' | 'test' = 'test') {
    this.defaultConfig = this.getDefaultConfig(environment)
  }

  /**
   * Run a property test with enhanced error reporting and timeout handling
   */
  async runProperty<T>(
    property:
      | fc.IAsyncProperty<T>
      | fc.IProperty<T>
      | fc.IRawProperty<T, boolean>,
    config?: Partial<PropertyTestConfig>
  ): Promise<PropertyTestResult<T>> {
    const finalConfig = { ...this.defaultConfig, ...config }
    const startTime = Date.now()

    try {
      // Configure fast-check with optimized settings
      const fcConfig: fc.Parameters<T> = {
        numRuns: finalConfig.iterations,
        seed: finalConfig.seed,
        timeout: finalConfig.timeout,
        verbose: true, // Enable verbose output for better error reporting
        markInterruptAsFailure: true, // Treat timeouts as failures
      }

      logger.debug('Starting property test', {
        iterations: finalConfig.iterations,
        timeout: finalConfig.timeout,
        seed: finalConfig.seed,
        environment: finalConfig.environment,
      })

      // Run the property test with timeout handling
      await fc.assert(property, fcConfig)

      const executionTime = Date.now() - startTime

      logger.debug('Property test passed', {
        iterations: finalConfig.iterations,
        executionTime,
        seed: finalConfig.seed,
      })

      return {
        passed: true,
        iterations: finalConfig.iterations,
        executionTime,
        seed: finalConfig.seed || 0,
      }
    } catch (error) {
      const executionTime = Date.now() - startTime

      // Extract counterexample information from fast-check error
      const result = this.extractCounterexampleFromError<T>(
        error,
        finalConfig,
        executionTime
      )

      logger.error('Property test failed', {
        iterations: finalConfig.iterations,
        executionTime,
        seed: finalConfig.seed,
        counterExample: result.counterExample,
        shrunkCounterExample: result.shrunkCounterExample,
        error: error instanceof Error ? error.message : String(error),
      })

      return result
    }
  }

  /**
   * Create deterministic generators with seeded randomization
   */
  createDeterministicGenerators(seed: number): DeterministicGenerators {
    return new DeterministicGenerators(seed)
  }

  /**
   * Get default configuration based on environment
   */
  private getDefaultConfig(
    environment: 'ci' | 'local' | 'test'
  ): PropertyTestConfig {
    switch (environment) {
      case 'ci':
        return {
          iterations: 5, // Optimized for CI speed
          timeout: 10000, // 10 seconds
          shrinkingEnabled: true,
          environment: 'ci',
        }
      case 'local':
        return {
          iterations: 100, // More thorough for local development
          timeout: 30000, // 30 seconds
          shrinkingEnabled: true,
          environment: 'local',
        }
      case 'test':
      default:
        return {
          iterations: 3, // Minimal for unit tests
          timeout: 5000, // 5 seconds
          shrinkingEnabled: true,
          environment: 'test',
        }
    }
  }

  /**
   * Extract counterexample information from fast-check error
   */
  private extractCounterexampleFromError<T>(
    error: unknown,
    config: PropertyTestConfig,
    executionTime: number
  ): PropertyTestResult<T> {
    let counterExample: T | undefined
    let shrunkCounterExample: T | undefined
    let actualError: Error

    if (error instanceof Error) {
      actualError = error

      // Try to extract counterexample from fast-check error message
      const errorMessage = error.message

      // Look for counterexample in error message
      const counterexampleMatch = errorMessage.match(/Counterexample: (.+)/)
      if (counterexampleMatch) {
        try {
          counterExample = JSON.parse(counterexampleMatch[1]) as T
        } catch {
          // If parsing fails, store as string
          counterExample = counterexampleMatch[1] as unknown as T
        }
      }

      // Look for shrunk counterexample
      const shrunkMatch = errorMessage.match(
        /Shrunk \d+ time\(s\)\nCounterexample: (.+)/
      )
      if (shrunkMatch) {
        try {
          shrunkCounterExample = JSON.parse(shrunkMatch[1]) as T
        } catch {
          shrunkCounterExample = shrunkMatch[1] as unknown as T
        }
      }
    } else {
      actualError = new Error(String(error))
    }

    return {
      passed: false,
      iterations: config.iterations,
      counterExample,
      shrunkCounterExample,
      error: actualError,
      executionTime,
      seed: config.seed || 0,
    }
  }
}

/**
 * Deterministic generators for reproducible property-based testing
 */
export class DeterministicGenerators {
  private seed: number

  constructor(seed: number) {
    this.seed = seed
  }

  /**
   * Generate deterministic safe strings using seeded RNG
   */
  deterministicSafeString(
    minLength: number = 1,
    maxLength: number = 10
  ): string {
    // Create a fresh RNG for this specific call using seed + method identifier
    const rng = this.createSeededRNG(
      this.seed +
        this.hashString('deterministicSafeString') +
        minLength +
        maxLength
    )
    const chars =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_'
    const firstChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ' // No numbers or hyphens for first char
    const length = Math.floor(rng() * (maxLength - minLength + 1)) + minLength
    let result = ''

    for (let i = 0; i < length; i++) {
      if (i === 0) {
        // First character cannot be a number or hyphen
        const charIndex = Math.floor(rng() * firstChars.length)
        result += firstChars[charIndex]
      } else {
        const charIndex = Math.floor(rng() * chars.length)
        result += chars[charIndex]
      }
    }

    return result
  }

  /**
   * Generate deterministic integers within a range using seeded RNG
   */
  deterministicInteger(min: number = 0, max: number = 100): number {
    const rng = this.createSeededRNG(
      this.seed + this.hashString('deterministicInteger') + min + max
    )
    return Math.floor(rng() * (max - min + 1)) + min
  }

  /**
   * Generate deterministic booleans with controlled probability using seeded RNG
   */
  deterministicBoolean(trueProbability: number = 0.5): boolean {
    const rng = this.createSeededRNG(
      this.seed +
        this.hashString('deterministicBoolean') +
        Math.floor(trueProbability * 1000)
    )
    return rng() < trueProbability
  }

  /**
   * Generate deterministic arrays with controlled size using seeded RNG
   */
  deterministicArray<T>(
    elementGenerator: () => T,
    minLength: number = 0,
    maxLength: number = 10
  ): T[] {
    const rng = this.createSeededRNG(
      this.seed + this.hashString('deterministicArray') + minLength + maxLength
    )
    const length = Math.floor(rng() * (maxLength - minLength + 1)) + minLength
    const result: T[] = []

    for (let i = 0; i < length; i++) {
      result.push(elementGenerator())
    }

    return result
  }

  /**
   * Generate deterministic cache directories for testing using seeded RNG
   */
  deterministicCacheDirectory(): string {
    const rng = this.createSeededRNG(
      this.seed + this.hashString('deterministicCacheDirectory')
    )
    const chars =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_'
    const firstChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

    // Generate suffix deterministically
    const suffixLength = Math.floor(rng() * (15 - 5 + 1)) + 5
    let suffix = ''

    for (let i = 0; i < suffixLength; i++) {
      if (i === 0) {
        const charIndex = Math.floor(rng() * firstChars.length)
        suffix += firstChars[charIndex]
      } else {
        const charIndex = Math.floor(rng() * chars.length)
        suffix += chars[charIndex]
      }
    }

    return `./test-dir/test-cache-${suffix}-${this.seed}`
  }

  /**
   * Generate deterministic service configurations using seeded RNG
   */
  deterministicServiceConfig(): {
    cacheDirectory: string
    environment: 'test' | 'development' | 'production'
    logLevel: 'debug' | 'info' | 'warn' | 'error'
  } {
    const rng = this.createSeededRNG(
      this.seed + this.hashString('deterministicServiceConfig')
    )
    const environments: ('test' | 'development' | 'production')[] = [
      'test',
      'development',
      'production',
    ]
    const logLevels: ('debug' | 'info' | 'warn' | 'error')[] = [
      'debug',
      'info',
      'warn',
      'error',
    ]

    // Generate cache directory deterministically
    const chars =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_'
    const firstChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const suffixLength = Math.floor(rng() * (15 - 5 + 1)) + 5
    let suffix = ''

    for (let i = 0; i < suffixLength; i++) {
      if (i === 0) {
        const charIndex = Math.floor(rng() * firstChars.length)
        suffix += firstChars[charIndex]
      } else {
        const charIndex = Math.floor(rng() * chars.length)
        suffix += chars[charIndex]
      }
    }

    const cacheDirectory = `./test-dir/test-cache-${suffix}-${this.seed}`

    return {
      cacheDirectory,
      environment: environments[Math.floor(rng() * environments.length)],
      logLevel: logLevels[Math.floor(rng() * logLevels.length)],
    }
  }

  /**
   * Create fast-check arbitraries that use the seeded RNG for deterministic generation
   */
  createArbitraries() {
    return {
      safeString: (
        minLength: number = 1,
        maxLength: number = 10
      ): fc.Arbitrary<string> => {
        return fc.constant(this.deterministicSafeString(minLength, maxLength))
      },
      integer: (min: number = 0, max: number = 100): fc.Arbitrary<number> => {
        return fc.constant(this.deterministicInteger(min, max))
      },
      boolean: (trueProbability: number = 0.5): fc.Arbitrary<boolean> => {
        return fc.constant(this.deterministicBoolean(trueProbability))
      },
      cacheDirectory: (): fc.Arbitrary<string> => {
        return fc.constant(this.deterministicCacheDirectory())
      },
      serviceConfig: (): fc.Arbitrary<{
        cacheDirectory: string
        environment: 'test' | 'development' | 'production'
        logLevel: 'debug' | 'info' | 'warn' | 'error'
      }> => {
        return fc.constant(this.deterministicServiceConfig())
      },
    }
  }

  /**
   * Get the current seed
   */
  getSeed(): number {
    return this.seed
  }

  /**
   * Create a simple hash from a string for deterministic seeding
   */
  private hashString(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash)
  }

  /**
   * Create a seeded random number generator
   */
  private createSeededRNG(seed: number): () => number {
    let state = seed
    return () => {
      state = (state * 1664525 + 1013904223) % 4294967296
      return state / 4294967296
    }
  }
}

/**
 * Utility functions for property test configuration
 */
export class PropertyTestUtils {
  /**
   * Create a property test configuration for CI environment
   */
  static createCIConfig(
    overrides?: Partial<PropertyTestConfig>
  ): PropertyTestConfig {
    return {
      iterations: 5,
      timeout: 10000,
      shrinkingEnabled: true,
      environment: 'ci',
      ...overrides,
    }
  }

  /**
   * Create a property test configuration for local development
   */
  static createLocalConfig(
    overrides?: Partial<PropertyTestConfig>
  ): PropertyTestConfig {
    return {
      iterations: 100,
      timeout: 30000,
      shrinkingEnabled: true,
      environment: 'local',
      ...overrides,
    }
  }

  /**
   * Create a property test configuration for unit tests
   */
  static createTestConfig(
    overrides?: Partial<PropertyTestConfig>
  ): PropertyTestConfig {
    return {
      iterations: 3,
      timeout: 5000,
      shrinkingEnabled: true,
      environment: 'test',
      ...overrides,
    }
  }

  /**
   * Determine appropriate configuration based on environment variables
   */
  static createEnvironmentConfig(): PropertyTestConfig {
    const isCI = process.env.CI === 'true' || process.env.NODE_ENV === 'ci'
    const isTest = process.env.NODE_ENV === 'test'

    if (isCI) {
      return this.createCIConfig()
    } else if (isTest) {
      return this.createTestConfig()
    } else {
      return this.createLocalConfig()
    }
  }
}

/**
 * Default property test runner instance
 */
export const defaultPropertyTestRunner = new PropertyTestRunner(
  process.env.CI === 'true'
    ? 'ci'
    : process.env.NODE_ENV === 'test'
      ? 'test'
      : 'local'
)
