# Implementation Plan: Test Consolidation

## Overview

This implementation plan systematically consolidates the test suite to align with PBT steering guidance. The work is organized into three phases: converting over-engineered property tests, eliminating redundant coverage, and documenting/validating the results.

## Tasks

- [ ] 1. Phase 1: Convert Over-Engineered Property Tests
  - [ ] 1.1 Convert `concurrent-execution-safety.property.test.ts` to unit test
    - Replace fast-check generators with 5-7 explicit test cases
    - Cover: 2 concurrent tests, 4 concurrent tests, 8 concurrent tests scenarios
    - Add file-level comment explaining conversion rationale
    - Remove fast-check import and property test structure
    - _Requirements: 1.1, 1.6, 1.7_

  - [ ] 1.2 Convert `resource-isolation.property.test.ts` to unit test
    - Replace property tests with explicit isolation scenarios
    - Cover: directory isolation, environment variable isolation, file system isolation
    - Add file-level comment: "Property restated implementation; examples suffice per property-testing-guidance.md Section 4"
    - _Requirements: 1.2, 1.6, 1.7_

  - [ ] 1.3 Convert `functionality-preservation.property.test.ts` to integration test
    - Replace property tests with specific endpoint examples
    - Cover: district statistics, analytics, backfill, rankings, export endpoints
    - Add file-level comment explaining conversion to integration test
    - _Requirements: 1.3, 1.6, 1.7_

  - [ ] 1.4 Convert `migration-pattern-replacement.property.test.tsx` to unit test
    - Replace property tests with explicit file analysis tests
    - Cover: each migrated test file as a specific test case
    - Add file-level comment: "Static file analysis; not property testing domain per property-testing-guidance.md Section 4"
    - _Requirements: 1.4, 1.6, 1.7_

  - [ ] 1.5 Convert `DistrictConfigurationService.property.test.ts` to unit test
    - Replace property tests with explicit configuration scenarios
    - Cover: persistence, ID format support, validation enforcement
    - Add file-level comment: "Input space not genuinely complex per property-testing-guidance.md Section 5"
    - _Requirements: 1.5, 1.6, 1.7_

- [ ] 2. Checkpoint - Verify Phase 1 conversions
  - Run converted tests to ensure they pass
  - Verify behavioral coverage is preserved
  - Ensure all tests pass, ask the user if questions arise

- [ ] 3. Phase 2: Eliminate Redundant Coverage in CacheIntegrityValidator
  - [ ] 3.1 Analyze overlap between CacheIntegrityValidator unit and property tests
    - Identify tests in unit file that duplicate property test coverage
    - Mark tests covering mathematical invariants (checksums, file counts) as property-only
    - Identify edge case tests to preserve in unit file
    - _Requirements: 2.1, 2.5, 2.6_

  - [ ] 3.2 Remove redundant tests from CacheIntegrityValidator.test.ts
    - Remove tests that duplicate property test coverage for: file count validation, size validation, checksum validation
    - Preserve edge case tests: null metadata, empty directory, non-existent files
    - Add comments to preserved tests explaining their unique value
    - _Requirements: 2.1, 2.5, 2.7_

  - [ ] 3.3 Add justification comment to CacheIntegrityValidator.property.test.ts
    - Add file-level comment: "PBT warranted: Mathematical invariants (checksums, file counts) per property-testing-guidance.md Section 3.1"
    - _Requirements: 3.1, 3.6_

- [ ] 4. Phase 2: Eliminate Redundant Coverage in CacheSecurityManager
  - [ ] 4.1 Analyze overlap between CacheSecurityManager unit and property tests
    - Identify tests in unit file that duplicate property test coverage
    - Mark tests covering security pattern validation as property-only
    - Identify edge case tests to preserve in unit file
    - _Requirements: 2.2, 2.5, 2.6_

  - [ ] 4.2 Remove redundant tests from CacheSecurityManager.test.ts
    - Remove tests that duplicate property test coverage for security patterns
    - Preserve edge case tests and specific security scenario documentation
    - Add comments to preserved tests explaining their unique value
    - _Requirements: 2.2, 2.5, 2.7_

  - [ ] 4.3 Add justification comment to CacheSecurityManager.property.test.ts
    - Add file-level comment: "PBT warranted: Complex input spaces (security patterns) per property-testing-guidance.md Section 3.2"
    - _Requirements: 3.2, 3.6_

- [ ] 5. Phase 2: Eliminate Redundant Coverage in DistrictIdValidator
  - [ ] 5.1 Analyze overlap between DistrictIdValidator unit and property tests
    - Identify tests in unit file that duplicate property test coverage
    - Mark tests covering input validation patterns as property-only
    - Identify edge case tests to preserve in unit file
    - _Requirements: 2.3, 2.5, 2.6_

  - [ ] 5.2 Remove redundant tests from DistrictIdValidator.test.ts
    - Remove tests that duplicate property test coverage for: alphanumeric validation, date pattern rejection, whitespace rejection
    - Preserve edge case tests: specific date formats, specific invalid characters
    - Preserve documentation tests: RejectionReasons constants, factory function
    - Add comments to preserved tests explaining their unique value
    - _Requirements: 2.3, 2.5, 2.7_

  - [ ] 5.3 Add justification comment to DistrictIdValidator.property.test.ts
    - Add file-level comment: "PBT warranted: Input validation with many boundary conditions per property-testing-guidance.md Section 3.2"
    - _Requirements: 3.3, 3.6_

- [ ] 6. Phase 2: Consolidate DistrictConfigurationService tests
  - [ ] 6.1 Consolidate DistrictConfigurationService tests after conversion
    - After property test conversion (task 1.5), analyze remaining unit test overlap
    - Remove tests that duplicate converted unit test coverage
    - Preserve unique edge case and documentation tests
    - _Requirements: 2.4, 2.5, 2.6_

- [ ] 7. Checkpoint - Verify Phase 2 consolidation
  - Run full test suite to verify no regressions
  - Verify test isolation is maintained
  - Verify tests run successfully in parallel
  - Ensure all tests pass, ask the user if questions arise

- [ ] 8. Phase 3: Document Preserved Property Tests
  - [ ] 8.1 Add justification comment to RankingCalculator.property.test.ts
    - Add file-level comment: "PBT warranted: Mathematical/algebraic properties per property-testing-guidance.md Section 3.1"
    - _Requirements: 3.4, 3.6_

  - [ ] 8.2 Add justification comment to SnapshotBuilder.property.test.ts
    - Add file-level comment: "PBT warranted: Universal business rules per property-testing-guidance.md Section 3.3"
    - _Requirements: 3.5, 3.6_

- [ ] 9. Phase 3: Update Steering Documentation
  - [ ] 9.1 Update property-testing-guidance.md "Existing Coverage" section
    - Update Section 6 to reflect consolidated test suite
    - List preserved property tests with their justifications
    - Note converted tests and their new locations
    - _Requirements: 5.4_

  - [ ] 9.2 Create consolidation summary
    - Document total tests removed
    - Document tests converted from property to unit
    - Document property tests preserved with justifications
    - Estimate coverage impact
    - _Requirements: 5.2, 5.5_

- [ ] 10. Final Checkpoint - Validate Consolidation
  - Run full test suite (backend and frontend)
  - Verify all tests pass
  - Verify tests run successfully in parallel mode
  - Compare test counts before and after consolidation
  - Ensure all tests pass, ask the user if questions arise

## Notes

- Each conversion task preserves behavioral coverage while simplifying test structure
- Redundancy removal focuses on eliminating duplicate coverage, not reducing test quality
- All preserved property tests are explicitly justified per steering guidance
- Checkpoints ensure incremental validation and prevent regression accumulation
