# Design Document: Test Consolidation

## Overview

This design addresses the systematic consolidation of the test suite to align with testing steering guidance. The consolidation involves three main activities:

1. **Converting over-engineered property tests** to simpler unit tests where PBT adds complexity without value
2. **Eliminating redundant coverage** between unit tests and property tests
3. **Preserving and documenting well-justified property tests** that test mathematical invariants or complex input spaces

The decision framework follows the guidance in `testing.md`:

- Property tests are warranted for mathematical invariants, complex input spaces, and universal business rules
- Property tests are NOT warranted for static analysis, simple CRUD, integration glue, or cases where 5 examples suffice

## Current State

The codebase has **71 property test files** across three areas:

| Area | Count | Files |
|------|-------|-------|
| Backend | 38 | Services (17), Storage (10), Routes (5), Top-level (6) |
| Frontend | 12 | Hooks (3), Utils (6+), Components (3) |
| Packages | 21 | analytics-core (8+), shared-contracts |

> [!IMPORTANT]
> The original spec referenced `property-testing-guidance.md` as a standalone steering document. This file does not exist — the PBT guidance lives in `.kiro/steering/testing.md`. All references have been corrected.

## Architecture

The consolidation follows a phased approach to minimize risk:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Test Consolidation Phases                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Phase 1: Convert Over-Engineered Property Tests (Backend)      │
│  ├── concurrent-execution-safety.property.test.ts → unit test   │
│  ├── resource-isolation.property.test.ts → unit test            │
│  ├── functionality-preservation.property.test.ts → integration  │
│  ├── DistrictConfigurationService.property.test.ts → unit test  │
│  ├── DistrictConfigurationService.emptyDefault.property.test.ts │
│  │   → merge into unit test                                     │
│  ├── CacheConfigService.migrated.property.test.ts → unit test   │
│  ├── ServiceContainer.property.test.ts → unit test              │
│  └── TestServiceFactory.instance-isolation.property.test.ts     │
│      → unit test                                                 │
│                                                                  │
│  Phase 1b: Convert Over-Engineered Property Tests (Frontend)    │
│  └── migration-pattern-replacement.property.test.tsx → unit     │
│                                                                  │
│  Phase 2: Eliminate Redundant Coverage                          │
│  ├── CacheIntegrityValidator: ~70% overlap reduction            │
│  ├── CacheSecurityManager: ~60% overlap reduction               │
│  ├── DistrictIdValidator: ~80% overlap reduction                │
│  └── DistrictConfigurationService: ~50% overlap reduction       │
│                                                                  │
│  Phase 3: Triage Unreviewed Property Tests                      │
│  ├── Storage layer: 10 files (assess warrant for each)          │
│  ├── Route tests: 4 files (assess warrant for each)             │
│  ├── Service tests: ClosingPeriodDetector, DataNormalizer, etc. │
│  └── Frontend/packages: defer to separate effort                │
│                                                                  │
│  Phase 4: Document and Validate                                 │
│  ├── Add justification comments to preserved property tests     │
│  ├── Update testing.md coverage section                         │
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
```

## Consolidation Manifest

### Files to Convert (Phase 1)

| File | Location | Rationale |
|------|----------|-----------|
| `concurrent-execution-safety.property.test.ts` | `backend/src/__tests__/` | 5 examples suffice; no complex input space |
| `resource-isolation.property.test.ts` | `backend/src/__tests__/` | Property restates implementation |
| `functionality-preservation.property.test.ts` | `backend/src/__tests__/` | Better as integration test with specific endpoints |
| `migration-pattern-replacement.property.test.tsx` | `frontend/src/__tests__/` | Static file analysis; not PBT domain |
| `DistrictConfigurationService.property.test.ts` | `backend/src/services/__tests__/` | Input space not genuinely complex |
| `DistrictConfigurationService.emptyDefault.property.test.ts` | `backend/src/services/__tests__/` | Simple default behavior; merge into unit file |
| `CacheConfigService.migrated.property.test.ts` | `backend/src/services/__tests__/` | Migration verification; examples suffice |
| `ServiceContainer.property.test.ts` | `backend/src/services/__tests__/` | DI container wiring; examples suffice |
| `TestServiceFactory.instance-isolation.property.test.ts` | `backend/src/services/__tests__/` | Factory isolation; examples suffice |

### Files with Redundant Coverage (Phase 2)

| Unit Test File | Property Test File | Overlap |
|---------------|-------------------|---------|
| `CacheIntegrityValidator.test.ts` | `CacheIntegrityValidator.property.test.ts` | ~70% |
| `CacheSecurityManager.test.ts` | `CacheSecurityManager.property.test.ts` | ~60% |
| `DistrictIdValidator.test.ts` | `DistrictIdValidator.property.test.ts` | ~80% |

### Files to Triage (Phase 3 — New Since Original Spec)

These backend property tests were **not in the original spec** and need assessment:

**Storage layer (10 files):**
- `csv-roundtrip.property.test.ts`
- `snapshot-roundtrip.property.test.ts`
- `snapshot-ordering.property.test.ts`
- `provider-equivalence.property.test.ts`
- `storage-provider-selection.property.test.ts`
- `StorageProviderFactory.property.test.ts`
- `DistrictConfigStorage.errorConsistency.property.test.ts`
- `DistrictConfigStorage.changeHistoryOrdering.property.test.ts`
- `FirestoreDistrictConfigStorage.property.test.ts`
- `FirestoreSnapshotStorage.chunked-write.property.test.ts`
- `LocalDistrictConfigStorage.property.test.ts`

**Route tests (4 files):**
- `districts.closing-period-metadata.property.test.ts`
- `api-equivalence.property.test.ts`
- `middleware-consistency.property.test.ts`
- `error-response-consistency.property.test.ts`
- `route-composition.property.test.ts`

**Service tests (6 files):**
- `ClosingPeriodDetector.property.test.ts`
- `DataNormalizer.property.test.ts`
- `RawCSVCacheService.behavioral-equivalence.property.test.ts`
- `RefreshService.closing-period.property.test.ts`
- `RefreshService.no-new-month-snapshots.property.test.ts`
- `PerDistrictSnapshotStore.*.property.test.ts` (3 files)

### Files to Preserve (Known Justified)

| File | Location | Justification |
|------|----------|---------------|
| `BordaCountRankingCalculator.property.test.ts` | `packages/analytics-core/` | Mathematical/algebraic properties |
| `SnapshotBuilder.property.test.ts` | `backend/src/__tests__/` | Universal business rules |
| `CacheIntegrityValidator.property.test.ts` | `backend/src/services/__tests__/` | Mathematical invariants (checksums) |
| `CacheSecurityManager.property.test.ts` | `backend/src/services/__tests__/` | Complex input spaces (security) |
| `DistrictIdValidator.property.test.ts` | `backend/src/services/__tests__/` | Input validation, many boundaries |
| `CacheService.property.test.ts` | `backend/src/services/__tests__/` | Bounded cache invariants (new) |

> [!NOTE]
> The original spec referenced `RankingCalculator.property.test.ts`. This file was renamed to `BordaCountRankingCalculator.property.test.ts` and moved to `packages/analytics-core/`.

## Correctness Properties

### Property 1: Coverage Preservation

_For any_ test consolidation action (conversion or removal), the behavioral coverage of the original test suite SHALL be preserved in the resulting test suite.

**Validates: Requirements 1.6, 4.1**

### Property 2: Conversion Documentation

_For any_ property test file that is converted to a unit test, the resulting file SHALL contain a file-level comment explaining the conversion rationale with reference to `testing.md`.

**Validates: Requirements 1.7, 5.1**

### Property 3: Preservation Justification

_For any_ property test file that is preserved, the file SHALL contain a comment citing the specific `testing.md` criteria that justify its use of property-based testing.

**Validates: Requirements 3.6, 5.3**

## Error Handling

### Conversion Errors

1. **Missing coverage detection**: If conversion loses behavioral coverage, halt and report the gap
2. **Invalid test structure**: If resulting unit test has syntax errors, report and preserve original
3. **Import resolution**: If converted test has unresolved imports, report missing dependencies

### Redundancy Analysis Errors

1. **File not found**: If a manifest file does not exist, skip and log warning
2. **Ambiguous overlap**: If overlap cannot be determined, err on the side of preservation

## Testing Strategy

### Verification Approach

1. **Example-based verification**: File conversions verified by checking content and passing tests
2. **Test suite execution**: Full suite before and after to verify no regressions
3. **Manual review**: Code review of converted tests for quality and coverage preservation

### Property Tests NOT Warranted for This Effort

This consolidation effort is primarily a refactoring task — the input space is finite (specific list of files), operations are file transformations, and 5-10 examples cover all scenarios. This aligns with `testing.md` guidance: "When 3-5 specific examples fully cover the behavior."

### Test Execution Plan

1. **Pre-consolidation baseline**: Run full test suite, record pass/fail counts
2. **Phase 1 verification**: After each conversion, run affected tests
3. **Phase 2 verification**: After redundancy removal, run full suite
4. **Phase 3 verification**: After triage decisions, run full suite
5. **Post-consolidation validation**: Compare to baseline
