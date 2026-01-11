# Implementation Plan: Membership Payment Tracking

## Overview

This implementation adds October Renewals, April Renewals, and New Members columns to the ClubsTable component. The work is organized into backend data extraction, frontend type extensions, UI implementation, and testing.

## Tasks

- [ ] 1. Extend backend ClubTrend type with membership payment fields
  - Add `octoberRenewals`, `aprilRenewals`, `newMembers` optional number fields to `ClubTrend` interface in `backend/src/types/analytics.ts`
  - _Requirements: 8.1_

- [ ] 2. Extract membership payment data from CSV in ClubHealthAnalyticsModule
  - [ ] 2.1 Add data extraction logic for membership payment fields
    - Parse `Oct. Ren`, `Apr. Ren`, `New Members` fields from club performance CSV
    - Use `parseIntSafe` for safe numeric parsing
    - Handle missing/invalid data as `undefined`
    - _Requirements: 8.5, 8.6, 8.7_
  - [ ] 2.2 Populate ClubTrend objects with extracted payment data
    - Update `buildClubTrend` or equivalent method to include new fields
    - _Requirements: 8.1_
  - [ ] 2.3 Write property test for CSV field parsing
    - **Property 7: CSV Field Parsing Round-Trip**
    - **Validates: Requirements 8.5, 8.6, 8.7**

- [ ] 3. Extend frontend ClubTrend type with membership payment fields
  - Add `octoberRenewals`, `aprilRenewals`, `newMembers` optional number fields to `ClubTrend` interface in `frontend/src/hooks/useDistrictAnalytics.ts`
  - _Requirements: 8.1_

- [ ] 4. Add column configurations for membership payment columns
  - [ ] 4.1 Extend SortField type with new field names
    - Add `'octoberRenewals' | 'aprilRenewals' | 'newMembers'` to SortField union in `frontend/src/components/filters/types.ts`
    - _Requirements: 5.1_
  - [ ] 4.2 Add column configurations to COLUMN_CONFIGS array
    - Add three new ColumnConfig entries for Oct Ren, Apr Ren, New columns
    - Configure as sortable, filterable, numeric filter type
    - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1_

- [ ] 5. Implement column rendering in ClubsTable
  - [ ] 5.1 Add table header cells for new columns
    - Use ColumnHeader component with new column configs
    - _Requirements: 1.1, 2.1, 3.1_
  - [ ] 5.2 Add table body cells for new columns
    - Display numeric value, "0" for zero, "—" for undefined
    - Apply consistent styling with existing numeric columns
    - _Requirements: 1.2, 1.3, 1.4, 2.2, 2.3, 2.4, 3.2, 3.3, 3.4, 7.1_
  - [ ] 5.3 Write property test for column display
    - **Property 1: Membership Payment Column Display**
    - **Validates: Requirements 1.1-1.4, 2.1-2.4, 3.1-3.4**

- [ ] 6. Implement sorting for membership payment columns
  - [ ] 6.1 Add sort cases for new fields in sortedClubs useMemo
    - Handle octoberRenewals, aprilRenewals, newMembers sort fields
    - Treat undefined as lowest value (sort to end)
    - _Requirements: 5.1, 5.2, 5.3_
  - [ ] 6.2 Implement secondary sort by club name for equal values
    - When payment counts are equal, sort alphabetically by club name
    - _Requirements: 5.4_
  - [ ] 6.3 Write property test for sorting invariant
    - **Property 4: Sorting Invariant**
    - **Validates: Requirements 5.1, 5.2, 5.3**
  - [ ] 6.4 Write property test for secondary sort stability
    - **Property 5: Secondary Sort Stability**
    - **Validates: Requirements 5.4**

- [ ] 7. Implement filtering for membership payment columns
  - [ ] 7.1 Add filter cases for new fields in useColumnFilters hook
    - Handle numeric range filtering for octoberRenewals, aprilRenewals, newMembers
    - Treat undefined as not matching any range
    - _Requirements: 4.2, 4.3_
  - [ ] 7.2 Write property test for numeric range filtering
    - **Property 2: Numeric Range Filtering**
    - **Validates: Requirements 4.2, 4.3**
  - [ ] 7.3 Write property test for filter clearing
    - **Property 3: Filter Clearing Restores Full List**
    - **Validates: Requirements 4.4**

- [ ] 8. Update CSV export to include membership payment columns
  - [ ] 8.1 Add new columns to exportClubPerformance function
    - Include Oct Ren, Apr Ren, New columns in CSV output
    - Export numeric values, empty string for undefined
    - _Requirements: 6.1, 6.2, 6.3_
  - [ ] 8.2 Write property test for CSV export format
    - **Property 6: CSV Export Contains Payment Columns**
    - **Validates: Requirements 6.1, 6.2**

- [ ] 9. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Apply visual styling for membership payment columns
  - Apply consistent numeric formatting
  - Optionally highlight zero values with muted text style
  - Ensure WCAG AA compliance (4.5:1 contrast ratio)
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks including property tests are required for comprehensive coverage
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
