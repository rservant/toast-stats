# Requirements Document

## Introduction

This specification covers a comprehensive cleanup of the Toast-Stats codebase to remove dead code, consolidate duplicated functionality, and simplify overly complex infrastructure. The cleanup targets four main areas: legacy CacheManager removal, routes file splitting, backfill hooks consolidation, and test infrastructure simplification.

## Glossary

- **CacheManager**: Legacy file-based cache service for district rankings data, superseded by the snapshot-based architecture
- **RealToastmastersAPIService**: Service that uses CacheManager for caching district rankings, also legacy
- **PerDistrictSnapshotStore**: New snapshot-based storage system that replaced the legacy cache
- **Backfill_Hooks**: React Query hooks for initiating and monitoring backfill operations
- **Test_Infrastructure**: Utilities for monitoring test performance and reliability

## Requirements

### Requirement 1: Remove Legacy CacheManager System

**User Story:** As a developer, I want to remove the legacy CacheManager and related code, so that the codebase has a single, clear data storage pattern.

#### Acceptance Criteria

1. THE System SHALL remove the CacheManager class from the codebase
2. THE System SHALL remove the RealToastmastersAPIService class which depends on CacheManager
3. THE System SHALL remove or migrate the legacy cache endpoints (`/cache/dates`, `/cache/statistics`, `/cache/metadata/:date`, `/cache/version`, `/cache/stats`, `DELETE /cache`)
4. THE System SHALL update the districts routes to use only the snapshot-based data sources
5. THE System SHALL remove the `migrate-cache.ts` and `clear-rankings-cache.ts` utility scripts
6. THE System SHALL ensure all existing functionality continues to work using the snapshot-based architecture
7. IF legacy cache endpoints are still needed, THEN THE System SHALL implement them using the snapshot store

### Requirement 2: Split Large Routes File

**User Story:** As a developer, I want the districts routes file split into logical modules, so that the code is easier to navigate and maintain.

#### Acceptance Criteria

1. THE System SHALL split `backend/src/routes/districts.ts` into separate route modules
2. THE System SHALL create a `districts/analytics.ts` module for analytics-related endpoints
3. THE System SHALL create a `districts/backfill.ts` module for backfill operation endpoints
4. THE System SHALL create a `districts/cache.ts` module for cache and snapshot management endpoints
5. THE System SHALL create a `districts/core.ts` module for core district data endpoints
6. THE System SHALL create a `districts/index.ts` that composes all route modules
7. THE System SHALL maintain all existing API contracts and endpoint paths
8. THE System SHALL share common middleware and utilities across route modules

### Requirement 3: Consolidate Backfill Hooks

**User Story:** As a developer, I want the backfill hooks consolidated into a single unified hook, so that there is less code duplication and a clearer API.

#### Acceptance Criteria

1. THE System SHALL consolidate `useBackfill.ts` and `useDistrictBackfill.ts` into a single hook
2. THE System SHALL provide a unified interface that handles both global and district-specific backfills
3. THE System SHALL maintain backward compatibility with existing component usage
4. THE System SHALL remove the separate `useDistrictBackfill.ts` file after consolidation
5. WHEN a district ID is provided, THE System SHALL use district-specific backfill endpoints
6. WHEN no district ID is provided, THE System SHALL use global backfill endpoints

### Requirement 4: Simplify Test Infrastructure

**User Story:** As a developer, I want the test infrastructure simplified, so that tests are easier to write and maintain without excessive monitoring overhead.

#### Acceptance Criteria

1. THE System SHALL evaluate which test monitoring utilities are actively used
2. THE System SHALL remove unused test infrastructure components
3. THE System SHALL consolidate overlapping test utilities where appropriate
4. THE System SHALL maintain essential test isolation and cleanup functionality
5. THE System SHALL document the remaining test infrastructure in a README
6. IF a test utility is used only in its own tests, THEN THE System SHALL consider it for removal

### Requirement 5: Remove Dead Code and Unused Files

**User Story:** As a developer, I want dead code and unused files removed, so that the codebase is cleaner and easier to understand.

#### Acceptance Criteria

1. THE System SHALL remove debug/inspection scripts prefixed with `__` that are not imported anywhere
2. THE System SHALL remove or archive the `ProcessSeparationMonitor` if it is not actively used
3. THE System SHALL remove demo/example components that are not imported (`BrandComplianceDemo.tsx`, `NavigationExample.tsx`)
4. THE System SHALL consolidate the duplicate context folders (`context/` and `contexts/`)
5. THE System SHALL verify each removal does not break any functionality
