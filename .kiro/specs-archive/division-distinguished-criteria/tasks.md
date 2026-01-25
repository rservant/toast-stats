# Implementation Plan: Division Distinguished Criteria

## Overview

This implementation adds Division recognition criteria and progress display to the existing Division Performance Cards and augments the Area Recognition Panel to become a unified "Division and Area Recognition" panel. The feature displays DDP criteria and shows each division's progress toward distinguished status with gap analysis.

## Tasks

- [x] 1. Create division gap calculation utility
  - [x] 1.1 Create `calculateDivisionGapAnalysis` function in `frontend/src/utils/divisionGapAnalysis.ts`
    - Calculate paid clubs gap (clubs needed to meet no net loss requirement)
    - Calculate distinguished clubs gaps for each recognition level (45%/50%/55%)
    - Calculate paid clubs gaps for each recognition level (base/base+1/base+2)
    - Determine current recognition level achieved
    - Handle edge cases (zero clubs, zero paid clubs)
    - _Requirements: 5.2, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5, 9.1, 9.2, 9.3, 9.4_
  - [x] 1.2 Write unit tests for division gap calculation utility
    - Test paid clubs gap calculation with various inputs
    - Test distinguished gaps for all three levels (45%/50%/55%)
    - Test paid clubs requirements for each level (base/base+1/base+2)
    - Test recognition level classification
    - Test edge cases (0 clubs, boundary values)
    - _Requirements: 5.2, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5, 9.1, 9.2, 9.3, 9.4_

- [x] 2. Create division progress text generation utility
  - [x] 2.1 Create `generateDivisionProgressText` function in `frontend/src/utils/divisionProgressText.ts`
    - Generate concise English paragraph for each division
    - Include current metrics: paid clubs (X of Y), distinguished clubs (X of Y)
    - Describe current recognition level achieved
    - Build incrementally on differences between levels (don't repeat requirements)
    - Handle net club loss scenario with eligibility explanation
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_
  - [x] 2.2 Write unit tests for division progress text generation
    - Test President's Distinguished achieved text
    - Test Select Distinguished with incremental gap to President's
    - Test Distinguished with incremental gaps to Select and President's
    - Test not distinguished with all gaps described incrementally
    - Test net club loss scenario with eligibility explanation
    - Test edge cases (0 clubs, 1 club)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

- [x] 3. Checkpoint - Ensure utilities work
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Create DivisionCriteriaExplanation component
  - [x] 4.1 Create `DivisionCriteriaExplanation.tsx` component in `frontend/src/components/`
    - Display eligibility gate requirement (no net club loss)
    - Display recognition level criteria table (45%/50%/55%, base/base+1/base+2)
    - Include collapsible/expandable functionality
    - Follow Toastmasters brand guidelines
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4, 4.5_
  - [x] 4.2 Write unit tests for DivisionCriteriaExplanation component
    - Test criteria content is displayed correctly
    - Test expand/collapse functionality
    - Test accessibility attributes
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4, 4.5, 7.4_

- [x] 5. Enhance DivisionSummary component with recognition metrics
  - [x] 5.1 Update `DivisionSummary.tsx` to add recognition badge and gap indicators
    - Add recognition badge (Distinguished, Select Distinguished, President's Distinguished, Not Distinguished, Net Loss)
    - Add Gap to D indicator (distinguished clubs needed for 45%)
    - Add Gap to S indicator (distinguished clubs + paid clubs needed for 50% + base+1)
    - Add Gap to P indicator (distinguished clubs + paid clubs needed for 55% + base+2)
    - Show "✓" when level is achieved, number when not achieved
    - Show "N/A" or indicator when net loss blocks achievability
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_
  - [x] 5.2 Write unit tests for enhanced DivisionSummary component
    - Test recognition badge displays correct level
    - Test gap indicators show correct values
    - Test checkmark shown for achieved levels
    - Test net loss indicator
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

- [x] 6. Checkpoint - Ensure components work independently
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Rename and enhance AreaRecognitionPanel to DivisionAreaRecognitionPanel
  - [x] 7.1 Rename `AreaRecognitionPanel.tsx` to `DivisionAreaRecognitionPanel.tsx`
    - Update component name and exports
    - Update section header from "Area Recognition" to "Division and Area Recognition"
    - Update all internal references
    - _Requirements: 10.1, 10.2, 10.7_
  - [x] 7.2 Add DivisionCriteriaExplanation to DivisionAreaRecognitionPanel
    - Import DivisionCriteriaExplanation component
    - Display DivisionCriteriaExplanation before existing CriteriaExplanation
    - _Requirements: 10.3, 10.4_
  - [x] 7.3 Update tests for renamed panel
    - Update test file name and imports
    - Add tests for DivisionCriteriaExplanation rendering
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [x] 8. Enhance AreaProgressSummary to include division narratives
  - [x] 8.1 Rename `AreaProgressSummary.tsx` to `DivisionAreaProgressSummary.tsx`
    - Update component name and exports
    - Update props to accept DivisionPerformance array
    - _Requirements: 10.5, 11.1_
  - [x] 8.2 Add division progress narratives to DivisionAreaProgressSummary
    - Generate division progress text using divisionProgressText utility
    - Display division narrative before area narratives for each division
    - Visually distinguish division narratives from area narratives
    - _Requirements: 10.5, 10.6, 11.2, 11.3, 11.4, 11.5_
  - [x] 8.3 Update tests for enhanced progress summary
    - Update test file name and imports
    - Add tests for division narrative display
    - Test division narratives appear before area narratives
    - Test visual distinction between division and area narratives
    - _Requirements: 10.5, 10.6, 11.1, 11.2, 11.3, 11.4, 11.5_

- [x] 9. Update DivisionPerformanceCard to pass gap analysis
  - [x] 9.1 Update `DivisionPerformanceCard.tsx` to calculate and pass gap analysis
    - Import divisionGapAnalysis utility
    - Calculate gap analysis for division
    - Pass gapAnalysis prop to DivisionSummary
    - _Requirements: 9.1, 9.2, 9.3, 9.4_
  - [x] 9.2 Update tests for DivisionPerformanceCard
    - Test gap analysis is calculated and passed correctly
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 10. Update DistrictDetailPage imports and references
  - [x] 10.1 Update `DistrictDetailPage.tsx` to use renamed components
    - Update import from AreaRecognitionPanel to DivisionAreaRecognitionPanel
    - Update component usage in JSX
    - _Requirements: 10.1, 10.7_
  - [x] 10.2 Update integration tests for DistrictDetailPage
    - Update tests to reference renamed components
    - _Requirements: 10.1, 10.7_

- [x] 11. Checkpoint - Ensure integration works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Clean up old component files
  - [x] 12.1 Remove old AreaRecognitionPanel references
    - Delete old AreaRecognitionPanel.tsx if separate file exists
    - Update any remaining imports throughout codebase
    - _Requirements: 10.1_
  - [x] 12.2 Remove old AreaProgressSummary references
    - Delete old AreaProgressSummary.tsx if separate file exists
    - Update any remaining imports throughout codebase
    - _Requirements: 10.5_

- [x] 13. Final checkpoint - Verify complete implementation
  - [x] 13.1 Ensure all tests pass
    - Run frontend test suite
    - Verify no TypeScript errors
    - Verify no lint errors
  - [x] 13.2 Verify visual integration
    - Confirm DivisionSummary shows recognition badge and gap indicators
    - Confirm DivisionAreaRecognitionPanel shows both DDP and DAP criteria
    - Confirm DivisionAreaProgressSummary shows division narratives before area narratives
    - Confirm section header reads "Division and Area Recognition"

## Notes

- All tasks including tests are required for comprehensive coverage
- Each task references specific requirements for traceability
- The implementation reuses existing types from `divisionStatus.ts`
- Follow existing component patterns in the codebase for consistency
- DDP uses different thresholds than DAP: 45%/50%/55% vs 50%/50%+1/50%+1
- DDP has NO club visit requirements (unlike DAP)
- Division narratives should be visually distinguished from area narratives (e.g., bold heading, different indentation)
