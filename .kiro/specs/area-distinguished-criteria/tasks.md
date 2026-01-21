# Implementation Plan: Area Distinguished Criteria

## Overview

This implementation adds an Area Recognition section to the existing Divisions & Areas tab on the District page. The feature displays DAP criteria and shows each area's progress toward distinguished status with gap analysis.

## Tasks

- [ ] 1. Create gap calculation utility
  - [x] 1.1 Create `calculateAreaGapAnalysis` function in `frontend/src/utils/areaGapAnalysis.ts`
    - Calculate paid clubs gap (clubs needed to reach 75% threshold)
    - Calculate distinguished clubs gaps for each recognition level
    - Determine current recognition level achieved
    - Handle edge cases (zero clubs, zero paid clubs)
    - _Requirements: 5.4, 5.5, 5.6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_
  - [x] 1.2 Write unit tests for gap calculation utility
    - Test paid clubs gap calculation with various inputs
    - Test distinguished gaps for all three levels
    - Test recognition level classification
    - Test edge cases (0 clubs, boundary values)
    - _Requirements: 5.4, 5.5, 5.6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [ ] 2. Create CriteriaExplanation component
  - [x] 2.1 Create `CriteriaExplanation.tsx` component in `frontend/src/components/`
    - Display eligibility gate requirement (club visits)
    - Display paid clubs requirement (75% threshold)
    - Display recognition level criteria table
    - Include collapsible/expandable functionality
    - Follow Toastmasters brand guidelines
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4, 4.5_
  - [x] 2.2 Write unit tests for CriteriaExplanation component
    - Test criteria content is displayed correctly
    - Test expand/collapse functionality
    - Test accessibility attributes
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4, 4.5, 7.4_

- [x] 3. Checkpoint - Ensure utility and criteria component work
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Create AreaProgressTable component
  - [x] 4.1 Create `AreaProgressTable.tsx` component in `frontend/src/components/`
    - Display all areas with division grouping
    - Show paid clubs count, percentage, and gap
    - Show distinguished clubs count, percentage, and gaps
    - Show current recognition level achieved
    - Indicate when paid threshold blocks recognition
    - Support sorting by area ID or recognition level
    - Follow existing table patterns (DivisionRankings, ClubsTable)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_
  - [x] 4.2 Write unit tests for AreaProgressTable component
    - Test all areas are displayed
    - Test metrics display for each area
    - Test gap analysis display
    - Test recognition level indicators
    - Test empty state
    - Test loading state
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [ ] 5. Create AreaRecognitionPanel container component
  - [x] 5.1 Create `AreaRecognitionPanel.tsx` component in `frontend/src/components/`
    - Combine CriteriaExplanation and AreaProgressTable
    - Extract areas from DivisionPerformance data
    - Handle loading and empty states
    - Add section header with title and description
    - _Requirements: 1.1, 1.2, 1.3_
  - [x] 5.2 Write unit tests for AreaRecognitionPanel component
    - Test rendering with valid division data
    - Test empty state when no divisions
    - Test loading state
    - _Requirements: 1.1_

- [x] 6. Checkpoint - Ensure all components work independently
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Integrate into DistrictDetailPage
  - [x] 7.1 Add AreaRecognitionPanel to Divisions & Areas tab in `DistrictDetailPage.tsx`
    - Import AreaRecognitionPanel component
    - Pass districtStatistics data to component
    - Position after existing DivisionPerformanceCards
    - _Requirements: 1.1, 1.2_
  - [x] 7.2 Write integration test for Divisions & Areas tab
    - Test AreaRecognitionPanel renders in tab
    - Test data flows correctly from page to component
    - _Requirements: 1.1_

- [x] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks including tests are required for comprehensive coverage
- Each task references specific requirements for traceability
- The implementation reuses existing types from `divisionStatus.ts`
- Follow existing component patterns in the codebase for consistency
