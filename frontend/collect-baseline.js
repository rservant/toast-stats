/* global console */
import { promises as fs } from 'fs'

async function countFileLines(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return content.split('\n').length
  } catch (error) {
    console.warn(`Could not read file ${filePath}:`, error.message)
    return 0
  }
}

async function countTestCases(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const itMatches = content.match(/\s+it\(/g) || []
    const testMatches = content.match(/\s+test\(/g) || []
    return itMatches.length + testMatches.length
  } catch (error) {
    console.warn(`Could not analyze file ${filePath}:`, error.message)
    return 0
  }
}

async function identifyRedundantPatterns(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const patterns = []

    if (content.includes('should render')) patterns.push('should render')
    if (content.includes('should display')) patterns.push('should display')
    if (content.includes('toHaveClass')) patterns.push('styling assertions')
    if (content.includes('getByRole')) patterns.push('semantic markup tests')
    if (content.includes('variant')) patterns.push('variant testing')

    return patterns
  } catch (error) {
    console.warn(`Could not analyze patterns in ${filePath}:`, error.message)
    return []
  }
}

async function collectComponentMetrics(filePath) {
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

async function main() {
  const phase1Files = [
    'src/components/__tests__/StatCard.test.tsx',
    'src/components/Navigation/__tests__/Navigation.test.tsx',
    'src/components/Header/__tests__/Header.test.tsx',
    'src/components/ui/Button/__tests__/Button.test.tsx',
    'src/components/__tests__/ErrorHandling.test.tsx',
  ]

  console.log('Phase 1 Baseline Metrics Collection')
  console.log('===================================')

  const metrics = []
  let totalLines = 0
  let totalTests = 0

  for (const filePath of phase1Files) {
    try {
      const componentMetrics = await collectComponentMetrics(filePath)
      metrics.push(componentMetrics)
      totalLines += componentMetrics.lineCount
      totalTests += componentMetrics.testCount

      console.log(`${componentMetrics.fileName}:`)
      console.log(`  Tests: ${componentMetrics.testCount}`)
      console.log(`  Lines: ${componentMetrics.lineCount}`)
      console.log(
        `  Patterns: ${componentMetrics.redundantPatterns.join(', ')}`
      )
      console.log('')
    } catch (error) {
      console.warn(`Could not collect metrics for ${filePath}:`, error.message)
    }
  }

  console.log('Summary:')
  console.log(`Total Tests: ${totalTests}`)
  console.log(`Total Lines: ${totalLines}`)
  console.log(`Average Lines per Test: ${Math.round(totalLines / totalTests)}`)

  // Save metrics
  const migrationData = {
    phase: 'Phase 1 - Baseline',
    timestamp: new Date().toISOString(),
    beforeMigration: metrics,
    summary: {
      totalTests,
      totalLines,
      averageLinesPerTest: Math.round(totalLines / totalTests),
    },
  }

  try {
    await fs.writeFile(
      'src/__tests__/migration-metrics.json',
      JSON.stringify(migrationData, null, 2)
    )
    console.log(
      '\nBaseline metrics saved to src/__tests__/migration-metrics.json'
    )
  } catch (error) {
    console.error('Failed to save metrics:', error.message)
  }
}

main().catch(console.error)
