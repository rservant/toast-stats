# Requirements Document

## Introduction

This feature addresses the removal of low-priority dead code identified in the dead code report (`docs/dead-code-report.md`), items 4–9. These are deprecated aliases, unused type aliases, and unnecessary indirection that remain in the codebase as cleanup debt. Some are consumed only by test files, some only by their own definition file, and one is a re-export shim that adds pointless indirection. No new functionality is introduced — this is pure cleanup.

## Glossary

- **SnapshotStore_Module**: The file `backend/src/services/SnapshotStore.ts` containing snapshot storage implementations
- **DivisionAreaProgressSummary_Module**: The file `frontend/src/components/DivisionAreaProgressSummary.tsx` containing the progress summary component
- **DivisionAreaRecognitionPanel_Module**: The file `frontend/src/components/DivisionAreaRecognitionPanel.tsx` containing the recognition panel component
- **Components_Index**: The file `frontend/src/components/index.ts` that re-exports frontend components
- **ProductionServiceFactory_Module**: The file `backend/src/services/ProductionServiceFactory.ts` containing the production service factory
- **TestServiceFactory_Module**: The file `backend/src/services/TestServiceFactory.ts` containing the test service factory
- **AvailableProgramYearsService_Module**: The file `backend/src/services/AvailableProgramYearsService.ts` containing the available years service
- **Admin_Shim**: The file `backend/src/routes/admin.ts` that re-exports from `./admin/index.js`
- **Backend_Entry**: The file `backend/src/index.ts` that bootstraps the backend application
- **Deprecated_Alias**: An exported symbol marked `@deprecated` that maps to a renamed symbol

## Requirements

### Requirement 1: Remove `PerDistrictFileSnapshotStore` alias and update consumers

**User Story:** As a developer, I want the deprecated `PerDistrictFileSnapshotStore` alias removed and all test files updated to use `FileSnapshotStore` directly, so that the codebase uses consistent naming without misleading aliases.

#### Acceptance Criteria

1. WHEN the cleanup is complete, THE SnapshotStore_Module SHALL NOT export a `PerDistrictFileSnapshotStore` symbol
2. WHEN the cleanup is complete, THE codebase SHALL contain zero import statements referencing `PerDistrictFileSnapshotStore`
3. WHEN the cleanup is complete, THE codebase SHALL contain zero type annotations referencing `PerDistrictFileSnapshotStore`
4. WHEN the cleanup is complete, THE test files that previously imported `PerDistrictFileSnapshotStore` SHALL import `FileSnapshotStore` instead
5. WHEN the cleanup is complete, THE test files SHALL pass with the same behavior as before the alias removal

### Requirement 2: Remove `AreaProgressSummary`, `AreaProgressSummaryProps`, and `AreaWithDivision` deprecated aliases

**User Story:** As a developer, I want the deprecated component aliases removed from the DivisionAreaProgressSummary module and all consumers updated to use the current names, so that the component naming is consistent and unambiguous.

#### Acceptance Criteria

1. WHEN the cleanup is complete, THE DivisionAreaProgressSummary_Module SHALL NOT export an `AreaProgressSummary` component alias
2. WHEN the cleanup is complete, THE DivisionAreaProgressSummary_Module SHALL NOT export an `AreaProgressSummaryProps` type alias
3. WHEN the cleanup is complete, THE Components_Index SHALL NOT re-export `AreaProgressSummary`, `AreaProgressSummaryProps`, or `AreaWithDivision`
4. WHEN the cleanup is complete, THE codebase SHALL contain zero import statements referencing `AreaProgressSummary` as a component name
5. WHEN the cleanup is complete, THE test file `AreaProgressSummary.test.tsx` SHALL import `DivisionAreaProgressSummary` instead of `AreaProgressSummary`
6. WHEN the cleanup is complete, THE `areaProgressText.ts` utility and its tests SHALL use `DivisionAreaProgressSummary` module types directly without relying on the `AreaWithDivision` deprecated alias name in imports
7. WHEN the cleanup is complete, THE affected test files SHALL pass with the same behavior as before the alias removal

### Requirement 3: Remove `AreaRecognitionPanel` and `AreaRecognitionPanelProps` deprecated aliases

**User Story:** As a developer, I want the deprecated `AreaRecognitionPanel` and `AreaRecognitionPanelProps` aliases removed, so that only the canonical `DivisionAreaRecognitionPanel` name exists in the codebase.

#### Acceptance Criteria

1. WHEN the cleanup is complete, THE DivisionAreaRecognitionPanel_Module SHALL NOT export an `AreaRecognitionPanel` component alias
2. WHEN the cleanup is complete, THE DivisionAreaRecognitionPanel_Module SHALL NOT export an `AreaRecognitionPanelProps` type alias
3. WHEN the cleanup is complete, THE Components_Index SHALL NOT re-export `AreaRecognitionPanel` or `AreaRecognitionPanelProps`
4. WHEN the cleanup is complete, THE codebase SHALL contain zero import statements referencing `AreaRecognitionPanel` as a component name
5. WHEN the cleanup is complete, THE existing tests for `DivisionAreaRecognitionPanel` SHALL pass with the same behavior as before the alias removal

### Requirement 4: Remove `createSnapshotStore()` method and update consumers to use `createSnapshotStorage()`

**User Story:** As a developer, I want the legacy `createSnapshotStore()` method removed from the service factory interface and all consumers updated to use `createSnapshotStorage()`, so that there is a single method for creating snapshot storage.

#### Acceptance Criteria

1. WHEN the cleanup is complete, THE ProductionServiceFactory_Module SHALL NOT define a `createSnapshotStore` method on the factory interface
2. WHEN the cleanup is complete, THE ProductionServiceFactory_Module SHALL NOT contain a `createSnapshotStore` method implementation
3. WHEN the cleanup is complete, THE TestServiceFactory_Module SHALL NOT define a `createSnapshotStore` method
4. WHEN the cleanup is complete, THE `snapshot-debug.ts` script SHALL use `createSnapshotStorage()` instead of `createSnapshotStore()`
5. WHEN the cleanup is complete, THE test mock objects that previously provided `createSnapshotStore` SHALL provide `createSnapshotStorage` instead
6. WHEN the cleanup is complete, THE codebase SHALL contain zero references to `createSnapshotStore` as a method name
7. WHEN the cleanup is complete, THE affected tests SHALL pass with the same behavior as before the method removal

### Requirement 5: Remove `AvailableProgramYearsResult` type alias

**User Story:** As a developer, I want the deprecated `AvailableProgramYearsResult` type alias removed, so that only the canonical `AvailableRankingYearsResponse` type name exists.

#### Acceptance Criteria

1. WHEN the cleanup is complete, THE AvailableProgramYearsService_Module SHALL NOT export an `AvailableProgramYearsResult` type
2. WHEN the cleanup is complete, THE codebase SHALL contain zero references to `AvailableProgramYearsResult`

### Requirement 6: Remove `admin.ts` re-export shim and update import

**User Story:** As a developer, I want the unnecessary `admin.ts` re-export shim removed and the backend entry point updated to import from `./routes/admin/index.js` directly, so that the routing module structure has no pointless indirection.

#### Acceptance Criteria

1. WHEN the cleanup is complete, THE Admin_Shim file SHALL NOT exist in the repository
2. WHEN the cleanup is complete, THE Backend_Entry SHALL import admin routes from `./routes/admin/index.js` directly
3. WHEN the cleanup is complete, THE codebase SHALL contain zero import statements referencing `./routes/admin.js` as a module path
4. WHEN the cleanup is complete, THE backend SHALL compile with zero TypeScript errors
5. WHEN the cleanup is complete, THE backend admin route tests SHALL pass with the same behavior as before the shim removal

### Requirement 7: Verify codebase integrity after cleanup

**User Story:** As a developer, I want the codebase to compile and pass all existing tests after dead code removal, so that the cleanup does not introduce regressions.

#### Acceptance Criteria

1. WHEN the cleanup is complete, THE backend SHALL compile with zero TypeScript errors
2. WHEN the cleanup is complete, THE frontend SHALL compile with zero TypeScript errors
3. WHEN the cleanup is complete, THE existing test suite SHALL pass with no new failures attributable to the cleanup
