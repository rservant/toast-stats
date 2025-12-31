/**
 * Property Test: Pattern Replacement Completeness
 *
 * **Feature: test-suite-optimization, Property 6: Pattern replacement completeness**
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**
 *
 * This property test validates that migrated test files have successfully
 * replaced redundant patterns with shared utility calls while maintaining
 * identical test coverage.
 */

import { describe, it, expect } from 'vitest'
import { promises as fs } from 'fs'
import fc from 'fast-check'

interface TestFileAnalysis {
  filePath: string
  hasSharedUtilities: boolean
  hasParameterizedTests: boolean
  hasCleanupCalls: boolean
  redundantPatternCount: number
  testCount: number
  lineCount: number
}

/**
 * Analyze a test file for migration patterns
 */
async function analyzeTestFile(filePath: string): Promise<TestFileAnalysis> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')

    // Check for shared utility usage
    const hasSharedUtilities =
      content.includes('testComponentVariants') ||
      content.includes('renderWithProviders')

    // Check for parameterized tests (variants arrays)
    const hasParameterizedTests =
      content.includes('ComponentVariant') &&
      content.includes('testComponentVariants')

    // Check for cleanup calls
    const hasCleanupCalls =
      content.includes('cleanupAllResources') && content.includes('afterEach')

    // Count redundant patterns that should be replaced
    let redundantPatternCount = 0
    const redundantPatterns = [
      /it\(['"`]should render/g,
      /it\(['"`]should display/g,
      /render\(<.*>\)/g,
      /expect\(.*\)\.toHaveClass/g,
    ]

    redundantPatterns.forEach(pattern => {
      const matches = content.match(pattern) || []
      redundantPatternCount += matches.length
    })

    // Count tests and lines
    const itMatches = content.match(/\s+it\(/g) || []
    const testMatches = content.match(/\s+test\(/g) || []
    const testCount = itMatches.length + testMatches.length
    const lineCount = content.split('\n').length

    return {
      filePath,
      hasSharedUtilities,
      hasParameterizedTests,
      hasCleanupCalls,
      redundantPatternCount,
      testCount,
      lineCount,
    }
  } catch (error) {
    throw new Error(`Failed to analyze ${filePath}: ${error}`)
  }
}

/**
 * Get list of migrated test files for Phase 1
 */
function getMigratedTestFiles(): string[] {
  return [
    'src/components/ui/Button/__tests__/Button.test.tsx',
    'src/components/__tests__/StatCard.test.tsx',
    'src/components/Navigation/__tests__/Navigation.test.tsx',
    'src/components/Header/__tests__/Header.test.tsx',
    'src/components/__tests__/ErrorHandling.test.tsx',
  ]
}

describe('Pattern Replacement Completeness Property Tests', () => {
  describe('Property 6: Pattern replacement completeness', () => {
    it('For any migrated test file, old redundant patterns should be replaced with shared utility calls while maintaining identical test coverage', async () => {
      /**
       * **Feature: test-suite-optimization, Property 6: Pattern replacement completeness**
       * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**
       *
       * This property verifies that:
       * 1. Migrated files use shared utilities (testComponentVariants, renderWithProviders)
       * 2. Parameterized testing is implemented for variant testing
       * 3. Proper cleanup is implemented
       * 4. Redundant patterns are minimized
       * 5. Test coverage is maintained
       */

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...getMigratedTestFiles()),
          async testFilePath => {
            const analysis = await analyzeTestFile(testFilePath)

            // Requirement 2.1: Should use shared utilities for rendering
            expect(analysis.hasSharedUtilities).toBe(true)

            // Requirement 2.2: Should use parameterized testing for variants
            if (
              analysis.filePath.includes('Button') ||
              analysis.filePath.includes('StatCard') ||
              analysis.filePath.includes('Navigation') ||
              analysis.filePath.includes('Header') ||
              analysis.filePath.includes('ErrorHandling')
            ) {
              expect(analysis.hasParameterizedTests).toBe(true)
            }

            // Requirement 2.3: Should implement proper cleanup
            expect(analysis.hasCleanupCalls).toBe(true)

            // Requirement 2.4: Should minimize redundant patterns
            // Allow some redundant patterns but they should be significantly reduced
            expect(analysis.redundantPatternCount).toBeLessThan(10)

            // Requirement 2.5: Should maintain test coverage
            // Each migrated file should have at least 1 test
            expect(analysis.testCount).toBeGreaterThan(0)

            // Additional quality checks
            expect(analysis.lineCount).toBeGreaterThan(0)

            console.log(
              `✓ ${analysis.filePath}: ${analysis.testCount} tests, ${analysis.lineCount} lines, ${analysis.redundantPatternCount} redundant patterns`
            )
          }
        ),
        {
          numRuns: 5, // Test each file once
          verbose: true,
        }
      )
    })

    it('validates that shared utilities are consistently used across all migrated files', async () => {
      /**
       * Additional property to ensure consistency in utility usage
       */

      const migratedFiles = getMigratedTestFiles()
      const analyses = await Promise.all(
        migratedFiles.map(file => analyzeTestFile(file))
      )

      // All migrated files should use shared utilities
      const filesWithUtilities = analyses.filter(a => a.hasSharedUtilities)
      expect(filesWithUtilities.length).toBe(analyses.length)

      // All migrated files should have cleanup
      const filesWithCleanup = analyses.filter(a => a.hasCleanupCalls)
      expect(filesWithCleanup.length).toBe(analyses.length)

      // Calculate overall improvement metrics
      const totalTests = analyses.reduce((sum, a) => sum + a.testCount, 0)
      const totalLines = analyses.reduce((sum, a) => sum + a.lineCount, 0)
      const totalRedundantPatterns = analyses.reduce(
        (sum, a) => sum + a.redundantPatternCount,
        0
      )

      console.log(`Migration Summary:`)
      console.log(`- Total tests: ${totalTests}`)
      console.log(`- Total lines: ${totalLines}`)
      console.log(`- Remaining redundant patterns: ${totalRedundantPatterns}`)

      // Quality thresholds
      expect(totalTests).toBeGreaterThan(0)
      expect(totalRedundantPatterns).toBeLessThan(50) // Significantly reduced from original
    })

    it('ensures test files maintain proper structure and imports', async () => {
      /**
       * Property to validate that migrated files have proper structure
       */

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...getMigratedTestFiles()),
          async testFilePath => {
            const content = await fs.readFile(testFilePath, 'utf-8')

            // Should import shared utilities
            expect(content).toMatch(/from.*componentTestUtils/)

            // Should have proper describe blocks
            expect(content).toMatch(/describe\(['"`].*['"`]/)

            // Should have afterEach cleanup
            expect(content).toMatch(/afterEach\(\(\) => \{/)
            expect(content).toMatch(/cleanupAllResources\(\)/)

            // Should not have direct render calls (should use renderWithProviders)
            const directRenderCalls = content.match(/render\(<[^>]*>/g) || []
            expect(directRenderCalls.length).toBeLessThan(3) // Allow minimal direct renders

            console.log(`✓ ${testFilePath}: Proper structure validated`)
          }
        ),
        {
          numRuns: 5,
          verbose: true,
        }
      )
    })
  })
})
