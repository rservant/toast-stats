# Requirements Document

## Introduction

This specification defines the refactoring of `admin.ts` (1,478 lines, 16 route handlers) to split routes by domain into focused route modules. The goal is to improve maintainability by organizing related endpoints together and reducing file size.

## Glossary

- **Admin_Router**: The main router that aggregates all admin sub-routers
- **Snapshot_Routes**: Route module for snapshot management endpoints
- **District_Config_Routes**: Route module for district configuration endpoints
- **Monitoring_Routes**: Route module for health, integrity, and performance monitoring endpoints
- **Process_Separation_Routes**: Route module for process separation validation and monitoring

## Requirements

### Requirement 1: Snapshot Routes Extraction

**User Story:** As a maintainer, I want snapshot-related routes grouped together, so that snapshot management logic is easy to find and modify.

#### Acceptance Criteria

1. THE Snapshot_Routes module SHALL handle GET /api/admin/snapshots (list snapshots)
2. THE Snapshot_Routes module SHALL handle GET /api/admin/snapshots/:id (get snapshot details)
3. THE Snapshot_Routes module SHALL handle GET /api/admin/snapshots/:id/districts (get snapshot districts)
4. THE Snapshot_Routes module SHALL handle GET /api/admin/snapshots/:id/debug (debug snapshot)
5. WHEN the Admin_Router receives a snapshot request, THE router SHALL delegate to Snapshot_Routes
6. THE Snapshot_Routes file SHALL have no more than 400 lines

### Requirement 2: District Configuration Routes Extraction

**User Story:** As a maintainer, I want district configuration routes grouped together, so that configuration management logic is easy to find and modify.

#### Acceptance Criteria

1. THE District_Config_Routes module SHALL handle GET /api/admin/districts/config (get configuration)
2. THE District_Config_Routes module SHALL handle POST /api/admin/districts/config (update configuration)
3. THE District_Config_Routes module SHALL handle DELETE /api/admin/districts/config/:districtId (remove district)
4. THE District_Config_Routes module SHALL handle POST /api/admin/districts/config/validate (validate configuration)
5. THE District_Config_Routes module SHALL handle GET /api/admin/districts/config/history (get history)
6. WHEN the Admin_Router receives a district config request, THE router SHALL delegate to District_Config_Routes
7. THE District_Config_Routes file SHALL have no more than 500 lines

### Requirement 3: Monitoring Routes Extraction

**User Story:** As a maintainer, I want monitoring routes grouped together, so that observability endpoints are easy to find and extend.

#### Acceptance Criteria

1. THE Monitoring_Routes module SHALL handle GET /api/admin/snapshot-store/health
2. THE Monitoring_Routes module SHALL handle GET /api/admin/snapshot-store/integrity
3. THE Monitoring_Routes module SHALL handle GET /api/admin/snapshot-store/performance
4. THE Monitoring_Routes module SHALL handle POST /api/admin/snapshot-store/cleanup
5. THE Monitoring_Routes module SHALL handle GET /api/admin/raw-csv-cache/health
6. THE Monitoring_Routes module SHALL handle GET /api/admin/raw-csv-cache/statistics
7. WHEN the Admin_Router receives a monitoring request, THE router SHALL delegate to Monitoring_Routes
8. THE Monitoring_Routes file SHALL have no more than 400 lines

### Requirement 4: Process Separation Routes Extraction

**User Story:** As a maintainer, I want process separation routes grouped together, so that validation and monitoring of process separation is easy to manage.

#### Acceptance Criteria

1. THE Process_Separation_Routes module SHALL handle GET /api/admin/process-separation/validate
2. THE Process_Separation_Routes module SHALL handle GET /api/admin/process-separation/monitor
3. WHEN the Admin_Router receives a process separation request, THE router SHALL delegate to Process_Separation_Routes
4. THE Process_Separation_Routes file SHALL have no more than 200 lines

### Requirement 5: API Preservation

**User Story:** As a developer, I want all existing API endpoints unchanged, so that consuming code requires no modification.

#### Acceptance Criteria

1. THE Admin_Router SHALL expose all existing endpoints at identical paths
2. WHEN any existing endpoint is called, THE response format SHALL be identical to the pre-refactor implementation
3. THE Admin_Router SHALL maintain backward compatibility for all request parameters and response structures
4. THE Admin_Router SHALL preserve the logAdminAccess middleware on all routes

### Requirement 6: Shared Middleware

**User Story:** As a maintainer, I want shared middleware centralized, so that logging and access control are consistently applied.

#### Acceptance Criteria

1. THE logAdminAccess middleware SHALL be defined in a shared location
2. THE logAdminAccess middleware SHALL be applied to all admin routes
3. WHEN a new route module is added, THE module SHALL use the shared middleware
4. THE shared middleware SHALL be importable by all route modules

### Requirement 7: Test Coverage Preservation

**User Story:** As a maintainer, I want all existing tests to continue passing, so that I have confidence the refactoring preserves behavior.

#### Acceptance Criteria

1. WHEN the refactoring is complete, ALL existing admin route tests SHALL pass without modification
2. THE test coverage percentage SHALL NOT decrease after refactoring
