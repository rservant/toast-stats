# Requirements Document

## Introduction

This feature addresses the removal of medium-priority dead code identified in the dead code report (`docs/dead-code-report.md`). The dead code is a cascading consequence of the prior removal of `backend/src/routes/districts/backfill.ts` and `frontend/src/hooks/useResponsiveDesign.ts`. The work involves removing orphaned functions, orphaned test blocks, orphaned re-exports, and an orphaned frontend hook file. No new functionality is introduced.

## Glossary

- **Shared_Module**: The file `backend/src/routes/districts/shared.ts` containing shared utilities for district routes
- **Districts_Index**: The file `backend/src/routes/districts/index.ts` that re-exports shared utilities
- **Integration_Test_File**: The file `backend/src/__tests__/districts.integration.test.ts`
- **Property_Test_File**: The file `backend/src/__tests__/functionality-preservation.property.test.ts`
- **Route_Composition_Test_File**: The file `backend/src/routes/districts/__tests__/route-composition.property.test.ts`
- **Contrast_Hook_File**: The file `frontend/src/hooks/useContrastCheck.ts`
- **Orphaned_Code**: Code that has zero importers or callers after the removal of its only consumer

## Requirements

### Requirement 1: Remove orphaned backfill functions from Shared_Module

**User Story:** As a developer, I want orphaned backfill-related functions removed from the Shared_Module, so that the codebase contains no dead code that could mislead future maintainers.

#### Acceptance Criteria

1. WHEN the cleanup is complete, THE Shared_Module SHALL NOT contain the `validateBackfillRequest` function
2. WHEN the cleanup is complete, THE Shared_Module SHALL NOT contain the `estimateCompletionTime` function
3. WHEN the cleanup is complete, THE Shared_Module SHALL NOT contain the `startBackfillCleanupInterval` function
4. WHEN the cleanup is complete, THE Shared_Module SHALL NOT contain the `stopBackfillCleanupInterval` function
5. WHEN the cleanup is complete, THE Shared_Module SHALL NOT contain the `BackfillValidationResult` interface
6. WHEN the cleanup is complete, THE Shared_Module SHALL NOT contain the backfill cleanup interval state variable or the auto-start call to `startBackfillCleanupInterval()`
7. WHEN the cleanup is complete, THE Shared_Module SHALL NOT import `BackfillRequest` from `UnifiedBackfillService`
8. WHEN the cleanup is complete, THE Shared_Module SHALL retain all non-backfill functions and exports without modification

### Requirement 2: Remove orphaned backfill re-exports from Districts_Index

**User Story:** As a developer, I want orphaned backfill re-exports removed from the Districts_Index, so that the module's public API only exposes actively used symbols.

#### Acceptance Criteria

1. WHEN the cleanup is complete, THE Districts_Index SHALL NOT re-export `getBackfillService`
2. WHEN the cleanup is complete, THE Districts_Index SHALL NOT re-export `startBackfillCleanupInterval`
3. WHEN the cleanup is complete, THE Districts_Index SHALL NOT re-export `stopBackfillCleanupInterval`
4. WHEN the cleanup is complete, THE Districts_Index SHALL retain all non-backfill re-exports without modification

### Requirement 3: Remove orphaned backfill test blocks

**User Story:** As a developer, I want test blocks that exercise deleted `/api/districts/backfill` endpoints removed, so that the test suite does not contain tests that always produce 404 errors.

#### Acceptance Criteria

1. WHEN the cleanup is complete, THE Integration_Test_File SHALL NOT contain the "Unified Backfill Endpoints" describe block or any tests exercising `POST /api/districts/backfill`, `GET /api/districts/backfill/:backfillId`, or `DELETE /api/districts/backfill/:backfillId`
2. WHEN the cleanup is complete, THE Property_Test_File SHALL NOT contain tests referencing `/api/districts/backfill` endpoints
3. WHEN the cleanup is complete, THE Route_Composition_Test_File SHALL NOT contain tests referencing `/api/districts/backfill` endpoints
4. WHEN the cleanup is complete, THE Integration_Test_File SHALL retain all non-backfill test blocks without modification
5. WHEN the cleanup is complete, THE Property_Test_File SHALL retain all non-backfill tests without modification
6. WHEN the cleanup is complete, THE Route_Composition_Test_File SHALL retain all non-backfill tests without modification

### Requirement 4: Delete orphaned Contrast_Hook_File

**User Story:** As a developer, I want the orphaned `useContrastCheck` hook deleted, so that the frontend codebase does not contain an unused module.

#### Acceptance Criteria

1. WHEN the cleanup is complete, THE Contrast_Hook_File SHALL NOT exist in the repository
2. WHEN the cleanup is complete, THE frontend codebase SHALL contain zero import statements referencing `useContrastCheck`

### Requirement 5: Verify codebase integrity after cleanup

**User Story:** As a developer, I want the codebase to compile and pass existing tests after dead code removal, so that the cleanup does not introduce regressions.

#### Acceptance Criteria

1. WHEN the cleanup is complete, THE backend SHALL compile with zero TypeScript errors
2. WHEN the cleanup is complete, THE frontend SHALL compile with zero TypeScript errors
3. WHEN the cleanup is complete, THE existing test suite SHALL pass with no new failures attributable to the cleanup
