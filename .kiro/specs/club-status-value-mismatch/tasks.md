# Implementation Plan: Club Status Value Mismatch Fix

## Overview

This implementation fixes the `ClubHealthStatus` type mismatch by establishing a canonical type in `shared-contracts` and updating all consumers to use the hyphenated format ('intervention-required'). The review revealed additional issues:
1. analytics-core uses `intervention_required` (underscore) in multiple files
2. Frontend property tests use outdated status values ('healthy', 'at-risk', 'critical')

## Tasks

- [ ] 1. Define canonical ClubHealthStatus in shared-contracts
  - [ ] 1.1 Create type definition file
    - Create `packages/shared-contracts/src/types/club-health-status.ts`
    - Define `ClubHealthStatus` type with values: 'thriving', 'stable', 'vulnerable', 'intervention-required'
    - _Requirements: 1.1, 1.3_
  
  - [ ] 1.2 Create Zod schema file
    - Create `packages/shared-contracts/src/schemas/club-health-status.schema.ts`
    - Define `ClubHealthStatusSchema` using `z.enum()`
    - _Requirements: 1.2_
  
  - [ ] 1.3 Export from shared-contracts index
    - Update `packages/shared-contracts/src/index.ts` to export type and schema
    - _Requirements: 1.1, 1.2_
  
  - [ ] 1.4 Write unit tests for ClubHealthStatusSchema
    - Test schema accepts all 4 valid values
    - Test schema rejects 'intervention_required' (underscore variant)
    - Test schema rejects arbitrary invalid strings
    - _Requirements: 1.2, 1.3_

- [ ] 2. Update analytics-core to use shared type
  - [ ] 2.1 Update types.ts to re-export from shared-contracts
    - Import and re-export `ClubHealthStatus` from `@toastmasters/shared-contracts`
    - Remove local `ClubHealthStatus` type definition
    - _Requirements: 2.3_
  
  - [ ] 2.2 Update ClubHealthAnalyticsModule.ts
    - Change `'intervention_required'` to `'intervention-required'` in assessClubHealth()
    - Change `'intervention_required'` to `'intervention-required'` in generateClubHealthData()
    - _Requirements: 2.2_
  
  - [ ] 2.3 Update ClubHealthAnalyticsModule.backend.ts
    - Change `'intervention_required'` to `'intervention-required'` in assessClubHealth()
    - Update ClubTrendInternal interface to use hyphen format
    - _Requirements: 2.2_
  
  - [ ] 2.4 Update MembershipAnalyticsModule.backend.ts
    - Update ClubTrendInternal interface to use 'intervention-required'
    - _Requirements: 2.2_
  
  - [ ] 2.5 Update analytics-core test files to use hyphen format
    - Update `ClubHealthAnalyticsModule.test.ts`
    - Update `AnalyticsComputer.test.ts`
    - Update `AnalyticsComputer.property.test.ts`
    - Update `AnalyticsComputer.integration.test.ts`
    - Update `clubCategorization.property.test.ts`
    - _Requirements: 2.2_

- [ ] 3. Update scraper-cli tests
  - [ ] 3.1 Update AnalyticsWriter.property.test.ts
    - Change `'intervention_required'` to `'intervention-required'` in clubHealthStatusArb
    - _Requirements: 2.2_

- [ ] 4. Checkpoint - Verify analytics-core and scraper-cli build
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Update backend to use shared type
  - [ ] 5.1 Update backend/src/types/analytics.ts
    - Import `ClubHealthStatus` from `@toastmasters/shared-contracts`
    - Remove local `ClubHealthStatus` type definition
    - _Requirements: 4.1_

- [ ] 6. Update frontend to use shared type
  - [ ] 6.1 Update useDistrictAnalytics.ts
    - Import `ClubHealthStatus` from `@toastmasters/shared-contracts`
    - Remove local `ClubHealthStatus` type definition
    - Re-export for backward compatibility with existing imports
    - _Requirements: 3.1_
  
  - [ ] 6.2 Update useClubTrends.ts
    - Import `ClubHealthStatus` from `@toastmasters/shared-contracts`
    - Remove local `ClubHealthStatus` type definition
    - Re-export for backward compatibility
    - _Requirements: 3.2_
  
  - [ ] 6.3 Fix useColumnFilters.property.test.ts
    - Change outdated status values ('healthy', 'at-risk', 'critical') to current values ('thriving', 'vulnerable', 'intervention-required')
    - Update all occurrences in the file
    - _Requirements: 5.2_

- [ ] 7. Final checkpoint - Verify all packages build and tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks are required for comprehensive testing
- The fix requires updating multiple files across analytics-core, scraper-cli, backend, and frontend
- No data migration is required - new analytics files will use the correct format
- Frontend already expects hyphen format in production code, but property tests use outdated values
- The useColumnFilters.property.test.ts file uses legacy status values that predate the current classification system
