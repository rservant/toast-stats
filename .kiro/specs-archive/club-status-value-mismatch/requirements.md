# Requirements Document

## Introduction

This document specifies the requirements for fixing the `ClubHealthStatus` type mismatch between the backend/analytics-core and frontend. Currently, the analytics-core uses `intervention_required` (underscore) while the frontend expects `intervention-required` (hyphen), causing clubs with "Intervention Required" status to not display correctly in the Clubs tab.

## Glossary

- **ClubHealthStatus**: A type representing the health classification of a club. Valid values are 'thriving', 'stable', 'vulnerable', or 'intervention-required'.
- **shared-contracts**: The canonical package (`packages/shared-contracts/`) that defines data contracts between collector-cli and backend.
- **analytics-core**: The package (`packages/analytics-core/`) that computes analytics data including club health status.
- **Frontend**: The React application that displays club data to users.
- **Backend**: The Express server that serves pre-computed analytics data.

## Requirements

### Requirement 1: Define Canonical ClubHealthStatus Type

**User Story:** As a developer, I want a single source of truth for the ClubHealthStatus type, so that all packages use consistent values.

#### Acceptance Criteria

1. THE shared-contracts package SHALL define a `ClubHealthStatus` type with values: 'thriving', 'stable', 'vulnerable', 'intervention-required'
2. THE shared-contracts package SHALL export a Zod schema `ClubHealthStatusSchema` for runtime validation
3. THE shared-contracts package SHALL use hyphen format ('intervention-required') to match frontend conventions

### Requirement 2: Update analytics-core to Use Shared Type

**User Story:** As a developer, I want analytics-core to use the canonical ClubHealthStatus type, so that computed data matches the expected format.

#### Acceptance Criteria

1. WHEN analytics-core computes club health status, THE ClubHealthAnalyticsModule SHALL import ClubHealthStatus from shared-contracts
2. WHEN a club is classified as intervention required, THE ClubHealthAnalyticsModule SHALL assign the value 'intervention-required' (hyphen format)
3. THE analytics-core types.ts SHALL re-export ClubHealthStatus from shared-contracts instead of defining it locally

### Requirement 3: Update Frontend to Use Shared Type

**User Story:** As a developer, I want the frontend to import ClubHealthStatus from shared-contracts, so that type definitions are consistent.

#### Acceptance Criteria

1. THE useDistrictAnalytics hook SHALL import ClubHealthStatus from shared-contracts
2. THE useClubTrends hook SHALL import ClubHealthStatus from shared-contracts
3. THE ClubsTable component SHALL correctly display clubs with 'intervention-required' status

### Requirement 4: Update Backend to Use Shared Type

**User Story:** As a developer, I want the backend to use the canonical ClubHealthStatus type, so that API responses match the expected format.

#### Acceptance Criteria

1. THE backend analytics types SHALL import ClubHealthStatus from shared-contracts
2. WHEN serving club data, THE backend SHALL pass through the status value unchanged from pre-computed files

### Requirement 5: Verify End-to-End Functionality

**User Story:** As a user, I want to see intervention-required clubs correctly displayed in the Clubs tab, so that I can identify clubs needing attention.

#### Acceptance Criteria

1. WHEN viewing the Clubs tab, THE system SHALL display clubs with 'intervention-required' status with correct styling
2. WHEN filtering by status, THE system SHALL correctly filter clubs with 'intervention-required' status
3. THE Overview tab count of intervention-required clubs SHALL match the count displayed in the Clubs tab
