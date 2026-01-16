# Implementation Plan: Division and Area Performance Cards

## Overview

This implementation plan breaks down the Division and Area Performance Cards feature into discrete, incremental coding tasks. Each task builds on previous work, starting with core calculation logic, then data extraction, then UI components, and finally integration with the District Detail Page.

## Tasks

- [ ] 1. Implement core status calculation utilities
  - [ ] 1.1 Create status calculation module with TypeScript types
    - Create `frontend/src/utils/divisionStatus.ts`
    - Define `DistinguishedStatus` type
    - Define `DivisionPerformance` interface
    - Define `AreaPerformance` interface
    - Define `VisitStatus` interface
    - _Requirements: 2.1, 2.6, 5.5, 7.3_

  - [ ] 1.2 Write property test for distinguished club threshold calculation
    - **Property 1: Distinguished Club Threshold Calculation**
    - **Validates: Requirements 2.1, 5.5**

  - [ ] 1.3 Implement `calculateRequiredDistinguishedClubs` function
    - Calculate Math.ceil(clubBase * 0.5)
    - Handle edge case of zero club base
    - _Requirements: 2.1, 5.5_

  - [ ] 1.4 Write property test for net growth calculation
    - **Property 5: Net Growth Calculation**
    - **Validates: Requirements 2.6**

  - [ ] 1.5 Implement net growth calculation logic
    - Calculate (paidClubs - clubBase)
    - _Requirements: 2.6_

  - [ ] 1.6 Write property test for visit completion percentage
    - **Property 6: Visit Completion Percentage Calculation**
    - **Validates: Requirements 7.3, 7.4**

  - [ ] 1.7 Implement `calculateVisitStatus` function
    - Calculate completion percentage
    - Determine if 75% threshold is met
    - Return VisitStatus object
    - _Requirements: 7.3, 7.4_

- [ ] 2. Implement division status classification
  - [ ] 2.1 Create `calculateDivisionStatus` function
    - Implement President's Distinguished logic (distinguished ≥ threshold + 1, net growth ≥ 1)
    - Implement Select Distinguished logic (distinguished ≥ threshold + 1, paid ≥ base)
    - Implement Distinguished logic (distinguished ≥ threshold, paid ≥ base)
    - Return Not Distinguished as default
    - _Requirements: 2.2, 2.3, 2.4, 2.5_

  - [ ] 2.2 Write property test for division status classification
    - **Property 2: Division Status Classification**
    - **Validates: Requirements 2.2, 2.3, 2.4, 2.5**

  - [ ] 2.3 Write unit tests for division status boundary conditions
    - Test exactly at 50% threshold
    - Test exactly at threshold + 1
    - Test exactly at net growth = 1
    - Test zero club base edge case
    - _Requirements: 2.2, 2.3, 2.4, 2.5_

- [ ] 3. Implement area status classification
  - [ ] 3.1 Create `checkAreaQualifying` function
    - Check net growth ≥ 0 (no club loss)
    - Check first round visits ≥ 75%
    - Check second round visits ≥ 75%
    - Return true only if all three conditions met
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ] 3.2 Write property test for area qualifying requirements
    - **Property 3: Area Qualifying Requirements**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**

  - [ ] 3.3 Create `calculateAreaStatus` function
    - Return "not-qualified" if not qualified
    - Apply same classification logic as divisions if qualified
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ] 3.4 Write property test for area status with qualifying gate
    - **Property 4: Area Status Classification with Qualifying Gate**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**

  - [ ] 3.5 Write unit tests for area status edge cases
    - Test non-qualified area with excellent metrics
    - Test qualified area with minimal metrics
    - Test missing visit data scenario
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 4. Checkpoint - Ensure calculation tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement data extraction utilities
  - [ ] 5.1 Create data extraction module
    - Create `frontend/src/utils/extractDivisionPerformance.ts`
    - Define extraction function signatures
    - _Requirements: 1.4, 7.1, 7.2_

  - [ ] 5.2 Implement `extractVisitData` function
    - Extract "Nov Visit award" for first round
    - Extract "May visit award" for second round
    - Handle missing visit data gracefully
    - Calculate visit status for both rounds
    - _Requirements: 7.1, 7.2, 7.5_

  - [ ] 5.3 Write property test for visit data extraction
    - **Property 11: Visit Data Extraction**
    - **Validates: Requirements 7.1, 7.2**

  - [ ] 5.4 Write unit test for missing visit data
    - Test with missing "Nov Visit award"
    - Test with missing "May visit award"
    - Verify appropriate indicator displayed
    - _Requirements: 7.5_

  - [ ] 5.5 Implement `extractDivisionPerformance` function
    - Extract all divisions from district snapshot
    - Extract all areas within each division
    - Calculate metrics for each division and area
    - Apply status classification functions
    - Sort divisions by identifier
    - Sort areas within each division by identifier
    - _Requirements: 1.1, 1.3, 1.4, 6.8_

  - [ ] 5.6 Write property test for data extraction completeness
    - **Property 12: Data Extraction Completeness**
    - **Validates: Requirements 1.4**

  - [ ] 5.7 Write unit tests for data extraction edge cases
    - Test with empty divisions
    - Test with missing area data
    - Test with invalid numeric values
    - _Requirements: 1.4_

- [ ] 6. Checkpoint - Ensure extraction tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Implement AreaPerformanceRow component
  - [ ] 7.1 Create AreaPerformanceRow component
    - Create `frontend/src/components/AreaPerformanceRow.tsx`
    - Accept AreaPerformance props
    - Render area identifier
    - Render paid clubs in "current/base" format with net growth
    - Render distinguished clubs in "current/required" format
    - Render first round visit status
    - Render second round visit status
    - Render status badge
    - Apply Toastmasters brand styling
    - _Requirements: 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 8.1, 8.2_

  - [ ] 7.2 Write property test for area row data completeness
    - **Property 10: Area Row Data Completeness**
    - **Validates: Requirements 6.2, 6.3, 6.4, 6.5, 6.6, 6.7**

  - [ ] 7.3 Write unit tests for AreaPerformanceRow rendering
    - Test with qualified area
    - Test with not-qualified area
    - Test with missing visit data
    - Test with negative net growth
    - _Requirements: 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

- [ ] 8. Implement AreaPerformanceTable component
  - [ ] 8.1 Create AreaPerformanceTable component
    - Create `frontend/src/components/AreaPerformanceTable.tsx`
    - Accept array of AreaPerformance props
    - Render table header with column labels
    - Render AreaPerformanceRow for each area
    - Apply responsive table styling
    - Ensure accessibility (table semantics, headers)
    - _Requirements: 6.1, 6.8, 8.6, 8.7, 9.3_

  - [ ] 8.2 Write property test for area row count and ordering
    - **Property 8: Area Row Count and Ordering**
    - **Validates: Requirements 6.1, 6.8**

  - [ ] 8.3 Write unit tests for AreaPerformanceTable
    - Test with empty areas array
    - Test with single area
    - Test with multiple areas
    - _Requirements: 6.1, 6.8_

- [ ] 9. Implement DivisionSummary component
  - [ ] 9.1 Create DivisionSummary component
    - Create `frontend/src/components/DivisionSummary.tsx`
    - Accept division summary props
    - Render division identifier
    - Render status badge with visual indicators
    - Render paid clubs progress
    - Render distinguished clubs progress
    - Apply TM Loyal Blue for primary elements
    - Apply brand typography (Montserrat for headings)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 8.1, 8.3_

  - [ ] 9.2 Write property test for division summary data completeness
    - **Property 9: Division Summary Data Completeness**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**

  - [ ] 9.3 Write unit tests for DivisionSummary rendering
    - Test each status level rendering
    - Test positive and negative net growth
    - Test at threshold boundaries
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 10. Implement DivisionPerformanceCard component
  - [ ] 10.1 Create DivisionPerformanceCard component
    - Create `frontend/src/components/DivisionPerformanceCard.tsx`
    - Accept DivisionPerformance props
    - Render DivisionSummary at top
    - Render AreaPerformanceTable below
    - Apply card styling with brand colors
    - Ensure minimum touch targets (44px)
    - _Requirements: 1.1, 8.1, 8.7_

  - [ ] 10.2 Write unit tests for DivisionPerformanceCard
    - Test with division containing no areas
    - Test with division containing multiple areas
    - Test integration of summary and table
    - _Requirements: 1.1_

- [ ] 11. Checkpoint - Ensure component tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Implement DivisionPerformanceCards container component
  - [ ] 12.1 Create DivisionPerformanceCards component
    - Create `frontend/src/components/DivisionPerformanceCards.tsx`
    - Accept DistrictSnapshot props
    - Call extractDivisionPerformance to process snapshot
    - Render DivisionPerformanceCard for each division
    - Display snapshot timestamp
    - Handle loading state
    - Handle error state for invalid data
    - _Requirements: 1.1, 1.2, 1.3, 10.3, 10.4_

  - [ ] 12.2 Write property test for division card count and ordering
    - **Property 7: Division Card Count and Ordering**
    - **Validates: Requirements 1.1, 1.3**

  - [ ] 12.3 Write property test for snapshot update reactivity
    - **Property 13: Snapshot Update Reactivity**
    - **Validates: Requirements 10.1, 10.2**

  - [ ] 12.4 Write property test for snapshot timestamp display
    - **Property 14: Snapshot Timestamp Display**
    - **Validates: Requirements 10.3**

  - [ ] 12.5 Write unit tests for DivisionPerformanceCards
    - Test with empty district snapshot
    - Test with single division
    - Test with multiple divisions
    - Test loading state
    - Test error handling for invalid data
    - _Requirements: 1.1, 1.2, 1.3, 10.3, 10.4_

- [ ] 13. Integrate with District Detail Page
  - [ ] 13.1 Add DivisionPerformanceCards to District Detail Page
    - Import DivisionPerformanceCards component
    - Pass district snapshot data as props
    - Position cards section appropriately in page layout
    - Ensure responsive layout at all breakpoints
    - _Requirements: 1.1, 9.1, 9.2, 9.3, 9.4_

  - [ ] 13.2 Write integration tests for District Detail Page
    - Test DivisionPerformanceCards renders with real snapshot structure
    - Test responsive behavior at mobile, tablet, desktop breakpoints
    - Test accessibility with axe-core
    - _Requirements: 8.6, 8.7, 9.1, 9.2, 9.3, 9.4_

- [ ] 14. Add custom fast-check generators for property tests
  - [ ] 14.1 Create test utility generators
    - Create `frontend/src/test-utils/generators/divisionPerformance.ts`
    - Implement division performance data generator
    - Implement area performance data generator
    - Implement visit status generator
    - Implement district snapshot structure generator
    - _Requirements: All property tests_

- [ ] 15. Apply brand styling and accessibility polish
  - [ ] 15.1 Refine component styling
    - Verify TM Loyal Blue usage for primary elements
    - Verify brand color palette usage for status indicators
    - Verify Montserrat font for headings
    - Verify Source Sans 3 font for body text
    - Verify minimum 14px font size
    - Verify minimum 4.5:1 contrast ratios
    - Verify minimum 44px touch targets
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [ ] 15.2 Run accessibility audit
    - Run axe-core on all components
    - Test keyboard navigation
    - Test screen reader announcements
    - Verify ARIA labels and roles
    - _Requirements: 8.6, 8.7_

- [ ] 16. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Each task references specific requirements for traceability
- Property tests use fast-check library with minimum 100 iterations
- All components follow existing patterns in the codebase
- Brand compliance is validated through existing design system
- Accessibility testing uses axe-core (existing tool)
