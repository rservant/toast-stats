# Requirements: Projected Year-End Simplification

## Overview

The "Projected Year-End" distinguished clubs calculation currently uses linear regression on historical snapshots to extrapolate future counts. This is overly complex. The projection should simply equal the count of thriving clubs.

Additionally, the current data model has three separate projected fields (`projectedDistinguished`, `projectedSelect`, `projectedPresident`) which are being summed in the frontend, causing the displayed value to be 3x the actual projection.

## Rationale

Thriving clubs are on track to achieve distinguished status by year-end. Using thriving club count as the projection is intuitive, simple, and directly observable. Since we no longer differentiate by distinguished level, having three separate projected fields is unnecessary and causes bugs.

## User Stories

### 1. Simplified Projection

**As a** district leader viewing the analytics dashboard  
**I want** the "Projected Year-End" value to equal the count of thriving clubs  
**So that** I understand how many clubs are on track for distinguished status

#### Acceptance Criteria

1.1 The projected year-end value equals the count of clubs with 'thriving' health status  
1.2 No differentiation by distinguished level (Smedley/President's/Select/Distinguished) - just whether they will be distinguished or better  
1.3 The projection calculation no longer uses linear regression  
1.4 Returns 0 when there are zero thriving clubs  
1.5 Returns total club count when all clubs are thriving

### 2. Single Projected Field

**As a** developer maintaining the codebase  
**I want** a single `projectedDistinguished` field instead of three separate projected fields  
**So that** the data model is simpler and prevents summing bugs

#### Acceptance Criteria

2.1 The `DistinguishedProjection` type has only one projected field: `projectedDistinguished`  
2.2 The `projectedSelect` and `projectedPresident` fields are removed from the type  
2.3 The frontend uses the single `projectedDistinguished` field directly without summing  
2.4 The analytics-core module outputs only the single projected field  
2.5 All tests are updated to reflect the simplified data model

### 3. Backend Type Alignment

**As a** developer maintaining the codebase  
**I want** the backend's `DistinguishedClubAnalytics` type to match the simplified analytics-core type  
**So that** there is no type mismatch between packages

#### Acceptance Criteria

3.1 The backend's `DistinguishedClubAnalytics.distinguishedProjection` type matches analytics-core's `DistinguishedProjection`  
3.2 The backend tests use the simplified projection format (only `projectedDistinguished`)  
3.3 All backend tests pass with the updated type

## Technical Notes

- The change spans multiple packages: `analytics-core`, `shared-contracts`, `scraper-cli`, `backend`, and `frontend`
- The `DistinguishedProjection` interface is defined in `packages/analytics-core`
- The backend has its own copy of `DistinguishedClubAnalytics` in `backend/src/types/analytics.ts` that must be updated
- Breaking changes to the API response structure are acceptable
- The frontend helper function `getDistinguishedProjectionValue` in `DistrictDetailPage.tsx` currently sums all three projected fields - this is the source of the 3x bug
- Pre-computed data files must be regenerated after code changes for the fix to take effect
