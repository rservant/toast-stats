/**
 * Backend Test Types
 *
 * TypeScript interfaces for backend test infrastructure
 */

export interface TestPerformanceMetrics {
  renderTime: number
  queryTime: number
  interactionTime: number
  memoryUsage: number
  componentCount: number
  timestamp: Date
}

export interface TestSuiteMetrics {
  totalTests: number
  totalFiles: number
  totalLines: number
  redundantPatterns: number
  executionTime: number
  passRate: number
  memoryUsage: number
}

export interface OptimizationResult {
  beforeMetrics: TestSuiteMetrics
  afterMetrics: TestSuiteMetrics
  improvements: {
    codeReduction: number
    executionTimeImprovement: number
    passRateChange: number
    memoryUsageChange: number
  }
  targetsMet: boolean
  failedTargets: string[]
}

export interface PropertyTestConfig {
  iterations: number
  seed?: number
  timeout: number
  shrinkingEnabled: boolean
  verbose: boolean
}

export interface PropertyTestResult {
  property: string
  passed: boolean
  iterations: number
  counterExample?: unknown
  shrunkCounterExample?: unknown
  executionTime: number
  error?: string
}
