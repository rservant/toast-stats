/**
 * Migration Metrics Collection Utility
 * Tracks before/after metrics for test suite optimization
 */

import { promises as fs } from 'fs'
import { join } from 'path'

export interface ComponentMetrics {
  fileName: string
  testCount: number
  lineCount: number
  redundantPatterns: string[]
  executionTime?: number
}

export interface MigrationMetrics {
  phase: string
  timestamp: string
  beforeMigration: ComponentMetrics[]
  afterMigration?: ComponentMetrics[]
  totalReduction?: {
    lines: number
    percentage: number
  }
  performanceImpact?: {
    beforeTime: number
    afterTime: number
    improvement: number
  }
}

/**
 * Count lines in a test file
 */
export async function countFileLines(filePath: string): Promise<number> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return content.split('\n').length
  } catch (error) {
    console.warn(`Could not read file ${filePath}:`, error)
    return 0
  }
}

/**
 * Count test cases in a file
 */
export async function countTestCases(filePath: string): Promise<number> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const itMatches = content.match(/\s+it\(/g) || []
    const testMatches = content.match(/\s+test\(/g) || []
    return itMatches.length + testMatches.length
  } catch (error) {
    console.warn(`Could not analyze file ${filePath}:`, error)
    return 0
  }
}

/**
 * Identify redundant patterns in a test file
 */
export async function identifyRedundantPatterns(
  filePath: string
): Promise<string[]> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const patterns: string[] = []

    // Look for common redundant patterns
    if (content.includes('should render')) {
      patterns.push('should render')
    }
    if (content.includes('should display')) {
      patterns.push('should display')
    }
    if (content.includes('toHaveClass')) {
      patterns.push('styling assertions')
    }
    if (content.includes('getByRole')) {
      patterns.push('semantic markup tests')
    }
    if (content.includes('variant')) {
      patterns.push('variant testing')
    }

    return patterns
  } catch (error) {
    console.warn(`Could not analyze patterns in ${filePath}:`, error)
    return []
  }
}

/**
 * Collect metrics for a component test file
 */
export async function collectComponentMetrics(
  filePath: string
): Promise<ComponentMetrics> {
  const fileName = filePath.split('/').pop() || filePath
  const testCount = await countTestCases(filePath)
  const lineCount = await countFileLines(filePath)
  const redundantPatterns = await identifyRedundantPatterns(filePath)

  return {
    fileName,
    testCount,
    lineCount,
    redundantPatterns,
  }
}

/**
 * Collect baseline metrics for Phase 1 components
 */
export async function collectPhase1BaselineMetrics(): Promise<
  ComponentMetrics[]
> {
  const phase1Files = [
    'frontend/src/components/__tests__/StatCard.test.tsx',
    'frontend/src/components/Navigation/__tests__/Navigation.test.tsx',
    'frontend/src/components/Header/__tests__/Header.test.tsx',
    'frontend/src/components/ui/Button/__tests__/Button.test.tsx',
    'frontend/src/components/__tests__/ErrorHandling.test.tsx',
  ]

  const metrics: ComponentMetrics[] = []

  for (const filePath of phase1Files) {
    try {
      const componentMetrics = await collectComponentMetrics(filePath)
      metrics.push(componentMetrics)
    } catch (error) {
      console.warn(`Could not collect metrics for ${filePath}:`, error)
    }
  }

  return metrics
}

/**
 * Save migration metrics to file
 */
export async function saveMigrationMetrics(
  metrics: MigrationMetrics
): Promise<void> {
  const metricsPath = join(
    process.cwd(),
    'frontend/src/__tests__/migration-metrics.json'
  )

  try {
    // Load existing metrics if they exist
    let existingMetrics: MigrationMetrics[] = []
    try {
      const existingContent = await fs.readFile(metricsPath, 'utf-8')
      existingMetrics = JSON.parse(existingContent)
    } catch {
      // File doesn't exist yet, start with empty array
    }

    // Add new metrics
    existingMetrics.push(metrics)

    // Save updated metrics
    await fs.writeFile(metricsPath, JSON.stringify(existingMetrics, null, 2))
    console.log(`Migration metrics saved to ${metricsPath}`)
  } catch (error) {
    console.error('Failed to save migration metrics:', error)
  }
}

/**
 * Calculate reduction metrics
 */
export function calculateReduction(
  before: ComponentMetrics[],
  after: ComponentMetrics[]
): { lines: number; percentage: number } {
  const beforeLines = before.reduce((sum, m) => sum + m.lineCount, 0)
  const afterLines = after.reduce((sum, m) => sum + m.lineCount, 0)
  const reduction = beforeLines - afterLines
  const percentage = beforeLines > 0 ? (reduction / beforeLines) * 100 : 0

  return {
    lines: reduction,
    percentage: Math.round(percentage * 100) / 100,
  }
}

/**
 * Generate migration report
 */
export function generateMigrationReport(metrics: MigrationMetrics): string {
  const report = [
    `# Migration Report - ${metrics.phase}`,
    `Generated: ${metrics.timestamp}`,
    '',
    '## Before Migration',
    '| Component | Tests | Lines | Patterns |',
    '|-----------|-------|-------|----------|',
  ]

  metrics.beforeMigration.forEach(m => {
    report.push(
      `| ${m.fileName} | ${m.testCount} | ${m.lineCount} | ${m.redundantPatterns.join(', ')} |`
    )
  })

  if (metrics.afterMigration) {
    report.push('')
    report.push('## After Migration')
    report.push('| Component | Tests | Lines | Patterns |')
    report.push('|-----------|-------|-------|----------|')

    metrics.afterMigration.forEach(m => {
      report.push(
        `| ${m.fileName} | ${m.testCount} | ${m.lineCount} | ${m.redundantPatterns.join(', ')} |`
      )
    })
  }

  if (metrics.totalReduction) {
    report.push('')
    report.push('## Summary')
    report.push(`- Lines Reduced: ${metrics.totalReduction.lines}`)
    report.push(`- Percentage Reduction: ${metrics.totalReduction.percentage}%`)
  }

  if (metrics.performanceImpact) {
    report.push(
      `- Performance Impact: ${metrics.performanceImpact.improvement}ms improvement`
    )
  }

  return report.join('\n')
}
