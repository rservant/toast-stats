# Implementation Plan: Area Distinguished Criteria

## Overview

This implementation adds an Area Recognition section to the existing Divisions & Areas tab on the District page. The feature displays DAP criteria and shows each area's progress toward distinguished status with gap analysis.

## Tasks

- [x] 1. Create gap calculation utility
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

- [x] 2. Create CriteriaExplanation component
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

- [x] 4. Create AreaProgressTable component
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

- [x] 5. Create AreaRecognitionPanel container component
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

- [x] 7. Integrate into DistrictDetailPage
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

- [x] 9. Update implementation for revised DAP criteria
  - [x] 9.1 Update `areaGapAnalysis.ts` with new recognition level thresholds
    - Change from 75% paid threshold to no net club loss (paidClubs >= clubBase)
    - Change distinguished percentage calculation from paid clubs to club base
    - Update Distinguished: paidClubs >= clubBase AND distinguishedClubs >= 50% of clubBase
    - Update Select Distinguished: paidClubs >= clubBase AND distinguishedClubs >= 50% of clubBase + 1
    - Update President's Distinguished: paidClubs >= clubBase + 1 AND distinguishedClubs >= 50% of clubBase + 1
    - _Requirements: 5.4, 5.5, 5.6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_
  - [x] 9.2 Update unit tests for new gap calculation logic
    - Update test cases for no net club loss requirement
    - Update test cases for new recognition level thresholds
    - Update test cases for distinguished percentage against club base
    - _Requirements: 5.4, 5.5, 5.6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [x] 10. Update CriteriaExplanation component for revised criteria
  - [x] 10.1 Update `CriteriaExplanation.tsx` with new eligibility and recognition criteria
    - Update eligibility gate to show no net club loss + club visits requirements
    - Update recognition level table with new thresholds
    - Update explanation text for distinguished percentage calculation
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 4.1, 4.2, 4.3, 4.4_
  - [x] 10.2 Update unit tests for CriteriaExplanation component
    - Update test cases for new criteria content
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 4.1, 4.2, 4.3, 4.4_

- [x] 11. Update AreaProgressTable component for revised criteria
  - [x] 11.1 Update `AreaProgressTable.tsx` to display new metrics
    - Update column headers and labels for no net club loss
    - Update gap display for new thresholds
    - Update recognition level badges
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_
  - [x] 11.2 Update unit tests for AreaProgressTable component
    - Update test cases for new metrics display
    - Update test cases for new recognition level indicators
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [x] 12. Final checkpoint - Ensure all updated tests pass
  - Ensure all tests pass with new DAP criteria
  - Verify integration tests still work

- [x] 13. Create progress text generation utility
  - [x] 13.1 Create `generateAreaProgressText` function in `frontend/src/utils/areaProgressText.ts`
    - Generate concise English paragraph for each area
    - Include current metrics: paid clubs (X of Y), distinguished clubs (X of Y)
    - Describe current recognition level achieved
    - Build incrementally on differences between levels (don't repeat requirements)
    - Handle net club loss scenario with eligibility explanation
    - Include club visit status (first-round and second-round) when data available
    - Show "Club visits: status unknown" when visit data unavailable
    - _Requirements: 5.1, 5.2, 5.3, 5.6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_
  - [x] 13.2 Write unit tests for progress text generation
    - Test President's Distinguished achieved text (includes all metrics)
    - Test Select Distinguished with incremental gap to President's
    - Test Distinguished with incremental gaps to Select and President's
    - Test not distinguished with all gaps described incrementally
    - Test net club loss scenario with eligibility explanation
    - Test club visit status display (complete, partial, unknown)
    - Test edge cases (0 clubs, 1 club)
    - _Requirements: 5.1, 5.2, 5.3, 5.6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

- [x] 14. Create AreaProgressSummary component
  - [x] 14.1 Create `AreaProgressSummary.tsx` component in `frontend/src/components/`
    - Display one paragraph per area with progress description
    - Group areas by division for context
    - Use semantic HTML (article/section elements)
    - Follow Toastmasters brand guidelines
    - Support loading and empty states
    - _Requirements: 5.1, 5.2, 5.3, 5.6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_
  - [x] 14.2 Write unit tests for AreaProgressSummary component
    - Test all areas are displayed with paragraphs
    - Test division grouping
    - Test empty state
    - Test loading state
    - Test accessibility attributes
    - _Requirements: 5.1, 7.4_

- [x] 15. Add AreaProgressSummary alongside AreaProgressTable
  - [x] 15.1 Update `AreaRecognitionPanel.tsx` to include AreaProgressSummary
    - Add AreaProgressSummary import
    - Display both AreaProgressTable and AreaProgressSummary
    - Position AreaProgressSummary after AreaProgressTable
    - _Requirements: 1.1, 1.2, 9.1, 9.4_
  - [x] 15.2 Update AreaRecognitionPanel tests
    - Add tests to verify paragraph-based display
    - Keep existing table-specific test assertions
    - _Requirements: 1.1, 9.1_

- [x] 16. Final checkpoint
  - [x] 16.1 Final checkpoint - Ensure all tests pass
    - Verify all tests pass
    - Verify both AreaProgressTable and AreaProgressSummary render correctly
    - Verify integration works correctly

- [x] 17. Merge recognition columns into AreaPerformanceTable
  - [x] 17.1 Update `AreaPerformanceTable.tsx` to add recognition columns
    - Add Paid/Base column (paid clubs vs club base with percentage)
    - Add Distinguished column (distinguished clubs vs club base with percentage)
    - Add Recognition badge column
    - Add Gap to D, Gap to S, Gap to P columns
    - Import and use `calculateAreaGapAnalysis` utility
    - _Requirements: 9.1, 9.2, 9.3, 9.5, 9.6_
  - [x] 17.2 Update `AreaPerformanceTable.tsx` to remove old columns
    - Remove old Paid Clubs column (replaced by Paid/Base)
    - Remove old Distinguished Clubs column (replaced by Distinguished of club base)
    - Remove old Status column (replaced by Recognition badge)
    - _Requirements: 9.7_
  - [x] 17.3 Update `AreaPerformanceRow.tsx` to match new column structure
    - Update row rendering to match new column order
    - Add gap analysis calculations per row
    - Add recognition badge rendering
    - _Requirements: 9.1, 9.2, 9.3, 9.5, 9.6_
  - [x] 17.4 Update unit tests for AreaPerformanceTable
    - Update test cases for new column structure
    - Add tests for gap analysis display
    - Add tests for recognition badge display
    - _Requirements: 9.1, 9.2, 9.3, 9.5, 9.6, 9.7_

- [x] 18. Remove standalone AreaProgressTable from AreaRecognitionPanel
  - [x] 18.1 Update `AreaRecognitionPanel.tsx` to remove AreaProgressTable
    - Remove AreaProgressTable import
    - Remove AreaProgressTable rendering
    - Keep CriteriaExplanation and AreaProgressSummary
    - _Requirements: 10.1, 10.2, 10.3_
  - [x] 18.2 Update AreaRecognitionPanel tests
    - Remove tests for AreaProgressTable rendering
    - Verify CriteriaExplanation and AreaProgressSummary still render
    - _Requirements: 10.1, 10.2, 10.3_

- [x] 19. Clean up standalone AreaProgressTable component
  - [x] 19.1 Delete `AreaProgressTable.tsx` component file
    - Remove frontend/src/components/AreaProgressTable.tsx
    - _Requirements: 10.4_
  - [x] 19.2 Delete AreaProgressTable test file
    - Remove frontend/src/components/**tests**/AreaProgressTable.test.tsx
    - _Requirements: 10.4_
  - [x] 19.3 Remove any remaining AreaProgressTable imports
    - Check for and remove any imports of AreaProgressTable
    - Update component index.ts if needed
    - _Requirements: 10.4_

- [x] 20. Final checkpoint - Verify merged implementation
  - [x] 20.1 Ensure all tests pass
    - Run frontend test suite
    - Verify no TypeScript errors
    - Verify no lint errors
  - [x] 20.2 Verify visual integration
    - Confirm Division cards show merged columns
    - Confirm Area Recognition section shows only CriteriaExplanation and AreaProgressSummary
    - Confirm no duplicate data display

## Notes

- All tasks including tests are required for comprehensive coverage
- Each task references specific requirements for traceability
- The implementation reuses existing types from `divisionStatus.ts`
- Follow existing component patterns in the codebase for consistency
- **UPDATED**: Tasks 9-12 added to update implementation for revised DAP criteria from TOASTMASTERS_DASHBOARD_KNOWLEDGE.md
- **UPDATED**: Tasks 13-16 added to add paragraph-based progress summaries alongside the existing table
- **UPDATED**: Tasks 17-20 added to merge AreaProgressTable columns into AreaPerformanceTable (inside Division cards) and remove the standalone AreaProgressTable
- **MERGED**: Recognition metrics (Paid/Base, Distinguished, Recognition badge, Gap columns) now display in the AreaPerformanceTable within each Division card
- **REMOVED**: Standalone AreaProgressTable component - its functionality is now in the Division cards
- **PRESERVED**: AreaProgressSummary remains in the Area Recognition section for paragraph-based progress descriptions
