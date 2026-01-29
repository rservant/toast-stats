# Design Document: Test Consolidation

## Overview

This design addresses the systematic consolidation of the test suite to align with the Property-Based Testing (PBT) steering guidance. The consolidation involves three main activities:

1. **Converting over-engineered property tests** to simpler unit tests where PBT adds complexity without value
2. **Eliminating redundant coverage** between unit tests and property tests
3. **Preserving and documenting well-justified property tests** that test mathematical invariants or complex input spaces

The design follows the decision framework from `property-testing-guidance.md`:

- Property tests are warranted for mathematical invariants, complex input spaces, and universal business rules
- Property tests are NOT warranted for static analysis, simple CRUD, integration glue, or cases where 5 examples suffice

## Architecture

The consolidation follows a phased approach to minimize risk:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Test Consolidation Phases                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Phase 1: Convert Over-Engineered Property Tests                │
│  ├── concurrent-execution-safety.property.test.ts → unit test   │
│  ├── resource-isolation.property.test.ts → unit test            │
│  ├── functionality-preservation.property.test.ts → integration  │
│  ├── migration-pattern-replacement.property.test.tsx → unit     │
│  └── DistrictConfigurationService.property.test.ts → unit test  │
│                                                                  │
│  Phase 2: Eliminate Redundant Coverage                          │
│  ├── CacheIntegrityValidator: ~70% overlap reduction            │
│  ├── CacheSecurityManager: ~60% overlap reduction               │
│  ├── DistrictIdValidator: ~80% overlap reduction                │
│  └── DistrictConfigurationService: ~50% overlap reduction       │
│                                                                  │
│  Phase 3: Document and Validate                                 │
│  ├── Add justification comments to preserved property tests     │
│  ├── Update property-testing-guidance.md coverage section       │
│  └── Run full test suite to verify no regressions               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Conversion Strategy

For each over-engineered property test, the conversion follows this pattern:

```
┌─────────────────────┐     ┌─────────────────────┐
│  Property Test      │     │  Unit Test          │
│  (fast-check)       │ ──► │  (explicit cases)   │
├─────────────────────┤     ├─────────────────────┤
│ - Random generation │     │ - 5-7 chosen cases  │
│ - 100+ iterations   │     │ - Edge cases        │
│ - Complex setup     │     │ - Clear intent      │
│ - Implicit coverage │     │ - Documented why    │
└─────────────────────┘     └─────────────────────┘
```

## Components and Interfaces

### Component 1: Test File Converter

Responsible for converting property test files to unit test files.

```typescript
interface TestConversionResult {
  originalFile: string
  newFile: string
  testCasesExtracted: number
  coveragePreserved: boolean
  conversionRationale: string
}

interface TestConverter {
  /**
   * Analyzes a property test file to extract representative test cases
   */
  analyzePropertyTest(filePath: string): Promise<PropertyTestAnalysis>

  /**
   * Converts a property test to a unit test with explicit examples
   */
  convertToUnitTest(
    analysis: PropertyTestAnalysis,
    targetPath: string
  ): Promise<TestConversionResult>
}
```

### Component 2: Redundancy Analyzer

Responsible for identifying overlapping coverage between unit and property tests.

```typescript
interface RedundancyAnalysis {
  unitTestFile: string
  propertyTestFile: string
  overlapPercentage: number
  redundantTests: RedundantTest[]
  uniqueUnitTests: string[]
  uniquePropertyTests: string[]
}

interface RedundantTest {
  testName: string
  reason: 'duplicate_coverage' | 'subset_of_property' | 'same_behavior'
  recommendation: 'remove' | 'keep_as_documentation' | 'merge'
}

interface RedundancyAnalyzer {
  /**
   * Compares unit and property test files to identify overlap
   */
  analyzeOverlap(
    unitTestPath: string,
    propertyTestPath: string
  ): Promise<RedundancyAnalysis>

  /**
   * Generates a consolidation plan for a test pair
   */
  generateConsolidationPlan(analysis: RedundancyAnalysis): ConsolidationPlan
}
```

### Component 3: Documentation Generator

Responsible for adding justification comments and updating steering documents.

```typescript
interface JustificationComment {
  type: 'pbt_warranted' | 'pbt_converted' | 'redundancy_removed'
  criteria: string[] // References to property-testing-guidance.md
  rationale: string
}

interface DocumentationGenerator {
  /**
   * Generates a file-level comment explaining PBT justification
   */
  generatePBTJustification(testFile: string, criteria: string[]): string

  /**
   * Generates a conversion rationale comment
   */
  generateConversionRationale(originalFile: string, reason: string): string

  /**
   * Updates the property-testing-guidance.md coverage section
   */
  updateSteeringDocument(
    consolidationSummary: ConsolidationSummary
  ): Promise<void>
}
```

## Data Models

### Test Analysis Models

```typescript
/**
 * Analysis of a property test file
 */
interface PropertyTestAnalysis {
  filePath: string
  testCount: number
  generators: GeneratorInfo[]
  properties: PropertyInfo[]
  pbtJustification: PBTJustification
}

interface GeneratorInfo {
  name: string
  type: 'arbitrary' | 'constant' | 'composite'
  complexity: 'simple' | 'moderate' | 'complex'
}

interface PropertyInfo {
  name: string
  description: string
  validatesRequirements: string[]
  canBeReplacedWithExamples: boolean
  exampleCount: number // How many examples would cover this
}

/**
 * Justification assessment per property-testing-guidance.md
 */
interface PBTJustification {
  isWarranted: boolean
  criteria: PBTCriteria[]
  recommendation: 'keep' | 'convert' | 'review'
}

type PBTCriteria =
  | 'mathematical_invariants'
  | 'complex_input_space'
  | 'universal_business_rules'
  | 'missed_edge_cases'
  | 'ui_component'
  | 'simple_crud'
  | 'integration_glue'
  | 'examples_suffice'
  | 'restates_implementation'
```

### Consolidation Models

```typescript
/**
 * Plan for consolidating a test pair
 */
interface ConsolidationPlan {
  unitTestFile: string
  propertyTestFile: string
  actions: ConsolidationAction[]
  expectedOutcome: {
    testsRemoved: number
    testsConverted: number
    coverageImpact: 'none' | 'minimal' | 'significant'
  }
}

interface ConsolidationAction {
  type: 'remove_test' | 'convert_test' | 'add_comment' | 'merge_tests'
  target: string
  rationale: string
}

/**
 * Summary of consolidation results
 */
interface ConsolidationSummary {
  totalTestsAnalyzed: number
  testsRemoved: number
  testsConverted: number
  propertyTestsPreserved: number
  estimatedCoverageImpact: string
  filesModified: string[]
  documentationUpdates: string[]
}
```

### File Mapping Models

```typescript
/**
 * Mapping of files to be consolidated
 */
interface ConsolidationTarget {
  category: 'convert' | 'redundancy' | 'preserve'
  files: FileMapping[]
}

interface FileMapping {
  propertyTestFile: string
  unitTestFile?: string
  action: 'convert_to_unit' | 'remove_redundant' | 'preserve_with_docs'
  overlapPercentage?: number
  justification: string
}

/**
 * Complete consolidation manifest
 */
const CONSOLIDATION_MANIFEST: ConsolidationTarget[] = [
  {
    category: 'convert',
    files: [
      {
        propertyTestFile:
          'backend/src/__tests__/concurrent-execution-safety.property.test.ts',
        action: 'convert_to_unit',
        justification:
          'Tests could use 5 well-chosen examples; no complex input space',
      },
      {
        propertyTestFile:
          'backend/src/__tests__/resource-isolation.property.test.ts',
        action: 'convert_to_unit',
        justification: 'Property restates implementation; examples suffice',
      },
      {
        propertyTestFile:
          'backend/src/__tests__/functionality-preservation.property.test.ts',
        action: 'convert_to_unit',
        justification:
          'Better as integration test with specific endpoint examples',
      },
      {
        propertyTestFile:
          'frontend/src/__tests__/migration-pattern-replacement.property.test.tsx',
        action: 'convert_to_unit',
        justification: 'Static file analysis; not property testing domain',
      },
      {
        propertyTestFile:
          'backend/src/services/__tests__/DistrictConfigurationService.property.test.ts',
        action: 'convert_to_unit',
        justification: 'Input space is not genuinely complex',
      },
    ],
  },
  {
    category: 'redundancy',
    files: [
      {
        propertyTestFile:
          'backend/src/services/__tests__/CacheIntegrityValidator.property.test.ts',
        unitTestFile:
          'backend/src/services/__tests__/CacheIntegrityValidator.test.ts',
        action: 'remove_redundant',
        overlapPercentage: 70,
        justification:
          'Property tests cover mathematical invariants; unit tests duplicate',
      },
      {
        propertyTestFile:
          'backend/src/services/__tests__/CacheSecurityManager.property.test.ts',
        unitTestFile:
          'backend/src/services/__tests__/CacheSecurityManager.test.ts',
        action: 'remove_redundant',
        overlapPercentage: 60,
        justification:
          'Property tests cover security patterns; unit tests duplicate',
      },
      {
        propertyTestFile:
          'backend/src/services/__tests__/DistrictIdValidator.property.test.ts',
        unitTestFile:
          'backend/src/services/__tests__/DistrictIdValidator.test.ts',
        action: 'remove_redundant',
        overlapPercentage: 80,
        justification:
          'Property tests cover input validation; unit tests duplicate',
      },
    ],
  },
  {
    category: 'preserve',
    files: [
      {
        propertyTestFile:
          'backend/src/services/__tests__/CacheIntegrityValidator.property.test.ts',
        action: 'preserve_with_docs',
        justification: 'Mathematical invariants: checksums, file counts',
      },
      {
        propertyTestFile:
          'backend/src/services/__tests__/CacheSecurityManager.property.test.ts',
        action: 'preserve_with_docs',
        justification: 'Complex input spaces: security patterns',
      },
      {
        propertyTestFile:
          'backend/src/services/__tests__/DistrictIdValidator.property.test.ts',
        action: 'preserve_with_docs',
        justification: 'Input validation with many boundary conditions',
      },
      {
        propertyTestFile:
          'backend/src/services/__tests__/RankingCalculator.property.test.ts',
        action: 'preserve_with_docs',
        justification: 'Mathematical/algebraic properties',
      },
      {
        propertyTestFile:
          'backend/src/__tests__/SnapshotBuilder.property.test.ts',
        action: 'preserve_with_docs',
        justification: 'Universal business rules',
      },
    ],
  },
]
```

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

Based on the prework analysis, the following properties have been identified. Note that this consolidation effort is primarily a refactoring task with verification through examples rather than property-based testing. However, several universal properties can be validated:

### Property 1: Coverage Preservation

_For any_ test consolidation action (conversion or removal), the behavioral coverage of the original test suite SHALL be preserved in the resulting test suite.

**Validates: Requirements 1.6, 4.1**

This property ensures that consolidation does not reduce test coverage. It can be verified by:

- Comparing test descriptions before and after
- Running coverage reports before and after
- Ensuring all behaviors tested by removed/converted tests are covered elsewhere

### Property 2: Conversion Documentation

_For any_ property test file that is converted to a unit test, the resulting file SHALL contain a file-level comment explaining the conversion rationale with reference to PBT_Steering_Guidance.

**Validates: Requirements 1.7, 5.1**

This property ensures traceability of conversion decisions. It can be verified by checking that all converted files contain the required documentation pattern.

### Property 3: Preservation Justification

_For any_ property test file that is preserved, the file SHALL contain a comment citing the specific PBT_Steering_Guidance criteria that justify its use of property-based testing.

**Validates: Requirements 3.6, 5.3**

This property ensures that preserved property tests are explicitly justified. It can be verified by checking that all preserved property test files contain justification comments.

### Property 4: Edge Case Preservation

_For any_ unit test that covers a specific edge case not addressed by property tests, that test SHALL be preserved during redundancy removal.

**Validates: Requirements 2.5**

This property ensures that valuable edge case tests are not lost during consolidation. Edge cases include boundary conditions, error scenarios, and corner cases that property tests may not explicitly cover.

### Property 5: Documentation-Value Preservation

_For any_ unit test that serves as documentation of specific behavior (explaining "why" a rule exists), that test SHALL be preserved during redundancy removal.

**Validates: Requirements 2.6**

This property ensures that tests with documentation value are retained even if they overlap with property test coverage.

### Property 6: Retained Test Purpose Comments

_For any_ unit test that is retained alongside property tests due to unique value, that test SHALL have a comment explaining its purpose and why it provides value beyond property test coverage.

**Validates: Requirements 2.7**

This property ensures that retained tests are explicitly justified to prevent future confusion about apparent redundancy.

### Property 7: Test Isolation Compliance

_For any_ test in the consolidated test suite, the test SHALL comply with the isolation requirements defined in `testing.md`, including unique resource naming, complete cleanup, and no shared state.

**Validates: Requirements 4.3, 6.3**

This property ensures that consolidation does not introduce isolation issues.

### Property 8: Concurrency Safety Compliance

_For any_ test in the consolidated test suite, the test SHALL be safe for parallel execution per `testing.md` requirements, with no shared resources or race conditions.

**Validates: Requirements 4.4, 6.4**

This property ensures that consolidated tests can run in parallel without interference.

### Property 9: PBT Steering Compliance

_For any_ property test remaining in the consolidated test suite, the test SHALL meet at least one criterion from `property-testing-guidance.md` Section 3 (When Property Tests ARE Warranted) AND SHALL NOT violate any criterion from Section 4 (When Property Tests Are NOT Warranted).

**Validates: Requirements 6.1, 6.2**

This property ensures that all remaining property tests are justified per the steering guidance.

## Error Handling

### Conversion Errors

When converting a property test to a unit test:

1. **Missing coverage detection**: If the conversion would lose behavioral coverage, the process SHALL halt and report the gap
2. **Invalid test structure**: If the resulting unit test has syntax errors, the process SHALL report the error and preserve the original file
3. **Import resolution**: If the converted test has unresolved imports, the process SHALL report missing dependencies

### Redundancy Analysis Errors

When analyzing test redundancy:

1. **File not found**: If a test file in the manifest does not exist, the process SHALL skip that file and log a warning
2. **Parse errors**: If a test file cannot be parsed, the process SHALL skip analysis and log the error
3. **Ambiguous overlap**: If overlap cannot be determined, the process SHALL err on the side of preservation

### Validation Errors

When validating the consolidated test suite:

1. **Test failures**: If any test fails after consolidation, the process SHALL report the failure and recommend investigation
2. **Coverage regression**: If coverage decreases significantly, the process SHALL report the regression
3. **Isolation violations**: If tests fail in parallel but pass sequentially, the process SHALL report isolation issues

## Testing Strategy

### Verification Approach

This consolidation effort is primarily verified through:

1. **Example-based verification**: Specific file conversions and removals are verified by checking file existence and content
2. **Test suite execution**: Running the full test suite before and after consolidation to verify no regressions
3. **Manual review**: Code review of converted tests to ensure quality and coverage preservation

### Property Tests NOT Warranted

Property-based testing is NOT warranted for this consolidation effort because:

1. The input space is finite and known (specific list of files)
2. The operations are file transformations, not algorithmic
3. 5-10 specific examples fully cover the consolidation scenarios
4. The "property" would just restate the implementation

This aligns with `property-testing-guidance.md` Section 4: "When Property Tests Are NOT Warranted" - specifically "Cases where examples are clearer" and "When 3-5 specific examples fully cover the behavior."

### Test Execution Plan

1. **Pre-consolidation baseline**: Run full test suite, record pass/fail counts and coverage
2. **Phase 1 verification**: After each conversion, run affected tests to verify they pass
3. **Phase 2 verification**: After redundancy removal, run full test suite to verify no regressions
4. **Phase 3 verification**: After documentation updates, verify comments are present
5. **Post-consolidation validation**: Run full test suite, compare to baseline

### Success Criteria

The consolidation is successful when:

1. All tests pass after consolidation
2. No coverage regression (or minimal, documented regression)
3. All converted files have rationale comments
4. All preserved property tests have justification comments
5. Consolidation summary is complete and accurate
6. `property-testing-guidance.md` is updated with current coverage
