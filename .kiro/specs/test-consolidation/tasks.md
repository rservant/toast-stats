# Implementation Plan: Test Consolidation

## Overview

This implementation plan systematically consolidates the test suite to align with PBT steering guidance in `testing.md`. The work is organized into four phases: converting over-engineered property tests, eliminating redundant coverage, triaging unreviewed property tests, and documenting/validating the results.

> [!NOTE]
> Updated to reflect current codebase state: 71 property test files exist (38 backend, 12 frontend, 21 packages). The original spec covered only ~10. This plan now addresses all backend property tests. Frontend/packages are deferred.

## Tasks

- [ ] 1. Phase 1: Convert Over-Engineered Property Tests (Backend)
  - [ ] 1.1 Convert `concurrent-execution-safety.property.test.ts` to unit test
    - Replace fast-check generators with 5-7 explicit test cases
    - Cover: 2 concurrent, 4 concurrent, 8 concurrent test scenarios
    - Add file-level comment explaining conversion rationale referencing `testing.md`
    - _Requirements: 1.1, 1.10, 1.11_

  - [ ] 1.2 Convert `resource-isolation.property.test.ts` to unit test
    - Replace property tests with explicit isolation scenarios
    - Cover: directory isolation, environment variable isolation, file system isolation
    - Add comment: "Property restated implementation; examples suffice per testing.md"
    - _Requirements: 1.2, 1.10, 1.11_

  - [ ] 1.3 Convert `functionality-preservation.property.test.ts` to integration test
    - Replace property tests with specific endpoint examples
    - Cover: district statistics, analytics, backfill, rankings, export endpoints
    - _Requirements: 1.3, 1.10, 1.11_

  - [ ] 1.4 Convert `migration-pattern-replacement.property.test.tsx` (frontend) to unit test
    - Replace property tests with explicit file analysis tests
    - Add comment: "Static file analysis; not PBT domain per testing.md"
    - _Requirements: 1.4, 1.10, 1.11_

  - [ ] 1.5 Convert `DistrictConfigurationService.property.test.ts` to unit test
    - Replace property tests with explicit configuration scenarios
    - Cover: persistence, ID format support, validation enforcement
    - _Requirements: 1.5, 1.10, 1.11_

  - [ ] 1.6 Merge `DistrictConfigurationService.emptyDefault.property.test.ts` into unit test
    - Merge coverage into existing `DistrictConfigurationService.test.ts`
    - Delete the property test file
    - _Requirements: 1.6, 1.10_

  - [ ] 1.7 Convert `CacheConfigService.migrated.property.test.ts` to unit test
    - Replace property tests with explicit migration verification cases
    - _Requirements: 1.7, 1.10, 1.11_

  - [ ] 1.8 Convert `ServiceContainer.property.test.ts` to unit test
    - Replace property tests with explicit DI wiring examples
    - _Requirements: 1.8, 1.10, 1.11_

  - [ ] 1.9 Convert `TestServiceFactory.instance-isolation.property.test.ts` to unit test
    - Replace property tests with explicit factory isolation examples
    - _Requirements: 1.9, 1.10, 1.11_

- [ ] 2. Checkpoint - Verify Phase 1 conversions
  - Run converted tests to ensure they pass
  - Verify behavioral coverage is preserved
  - Ensure all tests pass, ask the user if questions arise

- [ ] 3. Phase 2: Eliminate Redundant Coverage in CacheIntegrityValidator
  - [ ] 3.1 Analyze overlap between unit and property tests (~70% overlap)
  - [ ] 3.2 Remove redundant tests, preserve edge cases
  - [ ] 3.3 Add justification comment to property test: "PBT warranted: Mathematical invariants (checksums, file counts) per testing.md"
  - _Requirements: 2.1, 2.5, 2.7, 3.1, 3.7_

- [ ] 4. Phase 2: Eliminate Redundant Coverage in CacheSecurityManager
  - [ ] 4.1 Analyze overlap between unit and property tests (~60% overlap)
  - [ ] 4.2 Remove redundant tests, preserve edge cases
  - [ ] 4.3 Add justification comment to property test: "PBT warranted: Complex input spaces (security patterns) per testing.md"
  - _Requirements: 2.2, 2.5, 2.7, 3.2, 3.7_

- [ ] 5. Phase 2: Eliminate Redundant Coverage in DistrictIdValidator
  - [ ] 5.1 Analyze overlap between unit and property tests (~80% overlap)
  - [ ] 5.2 Remove redundant tests, preserve edge cases and documentation tests
  - [ ] 5.3 Add justification comment to property test: "PBT warranted: Input validation with many boundary conditions per testing.md"
  - _Requirements: 2.3, 2.5, 2.7, 3.3, 3.7_

- [ ] 6. Phase 2: Consolidate DistrictConfigurationService tests
  - [ ] 6.1 After conversion (task 1.5/1.6), analyze remaining unit test overlap
  - [ ] 6.2 Remove duplicate coverage, preserve unique edge cases
  - _Requirements: 2.4, 2.5, 2.6_

- [ ] 7. Checkpoint - Verify Phase 2 consolidation
  - Run full test suite to verify no regressions
  - Verify test isolation and parallel execution
  - Ensure all tests pass, ask the user if questions arise

- [ ] 8. Phase 3: Triage Unreviewed Backend Property Tests
  - [ ] 8.1 Assess storage layer property tests (10+ files)
    - Evaluate each against `testing.md` PBT criteria
    - Classify as convert/preserve/remove_redundant
    - Apply actions per classification
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  - [ ] 8.2 Assess route property tests (4+ files)
    - Same evaluation process
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  - [ ] 8.3 Assess remaining service property tests (6+ files)
    - ClosingPeriodDetector, DataNormalizer, RawCSVCacheService, RefreshService, PerDistrictSnapshotStore
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 9. Checkpoint - Verify Phase 3 triage
  - Run full test suite to verify no regressions
  - Ensure all tests pass, ask the user if questions arise

- [ ] 10. Phase 4: Document Preserved Property Tests
  - [ ] 10.1 Add justification comment to `BordaCountRankingCalculator.property.test.ts`
    - "PBT warranted: Mathematical/algebraic properties per testing.md"
    - _Requirements: 3.4, 3.7_
  - [ ] 10.2 Add justification comment to `SnapshotBuilder.property.test.ts`
    - "PBT warranted: Universal business rules per testing.md"
    - _Requirements: 3.5, 3.7_
  - [ ] 10.3 Add justification comment to `CacheService.property.test.ts`
    - "PBT warranted: Bounded cache invariants (entry limits, size limits, LRU ordering) per testing.md"
    - _Requirements: 3.6, 3.7_

- [ ] 11. Phase 4: Update Steering Documentation
  - [ ] 11.1 Update `testing.md` if PBT coverage section exists
  - [ ] 11.2 Create consolidation summary with metrics
    - Total tests removed, converted, preserved
    - Coverage impact assessment
    - _Requirements: 6.4, 6.5_

- [ ] 12. Final Checkpoint - Validate Consolidation
  - Run full test suite (backend and frontend)
  - Verify all tests pass in parallel mode
  - Compare test counts before and after
  - Ensure all tests pass, ask the user if questions arise

## Notes

- Each conversion preserves behavioral coverage while simplifying test structure
- Redundancy removal eliminates duplicate coverage, not test quality
- All preserved property tests are explicitly justified per steering guidance
- **Scope**: Backend property tests only. Frontend (12 files) and packages (21 files) deferred
- Checkpoints ensure incremental validation and prevent regression accumulation
