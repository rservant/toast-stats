# Implementation Plan: Club Status Field

## Overview

This implementation adds the "Club Status" field from club-performance.csv to the ClubsTable component with sorting, filtering, and export support, plus a badge in the ClubDetailModal. The implementation follows existing patterns for similar fields.

## Tasks

- [x] 1. Add clubStatus field to ClubTrend interface and backend parsing
  - [x] 1.1 Add clubStatus field to ClubTrend interface in useDistrictAnalytics.ts
    - Add optional `clubStatus?: string` field to the ClubTrend interface
    - Add JSDoc comment explaining the field purpose and possible values
    - _Requirements: 2.1_

  - [x] 1.2 Implement extractClubStatus method in ClubHealthAnalyticsModule
    - Add private method to extract club status from ScrapedRecord
    - Handle "Club Status" and "Status" field names for compatibility
    - Return undefined for missing, null, or empty values
    - Trim whitespace from valid values
    - _Requirements: 1.2, 1.3, 1.4_

  - [x] 1.3 Integrate clubStatus extraction in analyzeClubTrends method
    - Call extractClubStatus when building ClubTrend objects
    - Populate clubStatus field in the clubMap initialization
    - _Requirements: 2.2_

  - [x] 1.4 Write unit tests for club status parsing
    - Test extraction of valid status values
    - Test undefined returned for missing/empty/null values
    - Test whitespace trimming
    - _Requirements: 1.2, 1.3, 1.4_

- [x] 2. Add Club Status column to ClubsTable with sorting and filtering
  - [x] 2.1 Add clubStatus to SortField type in filters/types.ts
    - Add 'clubStatus' to the SortField union type
    - _Requirements: 4.1_

  - [x] 2.2 Add Club Status column configuration to COLUMN_CONFIGS
    - Add new ColumnConfig for clubStatus field
    - Set sortable: true, filterable: true, filterType: 'categorical'
    - Add filterOptions: ['Active', 'Suspended', 'Ineligible', 'Low']
    - Position after the 'status' (health status) column
    - _Requirements: 3.4, 4.1, 5.1, 5.2_

  - [x] 2.3 Add sorting logic for clubStatus in ClubsTable
    - Add case 'clubStatus' to the sortField switch statement
    - Sort alphabetically with undefined values at end
    - _Requirements: 4.2, 4.3, 4.4_

  - [x] 2.4 Add filtering logic for clubStatus in useColumnFilters hook
    - Add case 'clubStatus' to the applyFilter switch statement
    - Filter by categorical values matching clubStatus
    - _Requirements: 5.3, 5.4, 5.5_

  - [x] 2.5 Add Club Status column rendering in ClubsTable
    - Add table cell for clubStatus in the table body
    - Display status value or "—" placeholder for undefined
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 2.6 Write unit tests for club status sorting and filtering
    - Test alphabetical sorting (ascending and descending)
    - Test undefined values sort to end
    - Test categorical filtering with single and multiple selections
    - _Requirements: 4.2, 4.3, 4.4, 5.3, 5.4, 5.5_

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Add Club Status badge to ClubDetailModal
  - [x] 4.1 Add getClubStatusBadge helper function
    - Create function to return appropriate CSS classes based on status
    - Active → green, Suspended → red, Ineligible/Low → yellow, other → gray
    - _Requirements: 7.2, 7.3, 7.4_

  - [x] 4.2 Add Club Status badge to modal UI
    - Add badge next to existing health status badge
    - Only render when clubStatus is defined
    - _Requirements: 7.1, 7.5, 7.6_

  - [x] 4.3 Write unit tests for ClubDetailModal club status badge
    - Test badge renders with correct styling for each status
    - Test badge does not render when clubStatus is undefined
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 5. Add Club Status to CSV export
  - [x] 5.1 Update exportClubPerformance function
    - Add "Club Status" to CSV headers
    - Include clubStatus value in row data (empty string for undefined)
    - _Requirements: 6.1, 6.2_

  - [x] 5.2 Write unit tests for club status export
    - Test CSV includes Club Status column
    - Test defined values exported correctly
    - Test undefined values exported as empty string
    - _Requirements: 6.1, 6.2_

- [x] 6. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks are required for comprehensive test coverage
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Unit tests are used instead of property tests per steering guidance (simple CRUD operations where examples are clearer)
