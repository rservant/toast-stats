# Implementation Plan: DAP/DDP Tab Integration

## Overview

This plan implements the integration of Distinguished Area Program (DAP) and Distinguished Division Program (DDP) recognition data into the Divisions & Areas tab. The backend recognition module already exists; this plan covers the API endpoint, React hook, and UI component enhancements.

## Tasks

- [ ] 1. Create Recognition API Endpoint
  - [ ] 1.1 Add recognition route to backend routes
    - Create `GET /api/districts/:districtId/recognition` endpoint
    - Accept optional `date` query parameter
    - Wire to AreaDivisionRecognitionModule
    - Return DivisionRecognition[] with nested AreaRecognition[]
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ] 1.2 Write property test for API response schema
    - **Property 1: API Returns Valid Recognition Structure**
    - **Validates: Requirements 1.1, 1.5**

  - [ ] 1.3 Write unit tests for API error handling
    - Test 404 for missing district
    - Test 404 for missing date data
    - Test 400 for invalid date format
    - _Requirements: 1.4_

- [ ] 2. Create useRecognitionData Hook
  - [ ] 2.1 Implement useRecognitionData hook
    - Create `frontend/src/hooks/useRecognitionData.ts`
    - Use React Query with 10-minute stale time
    - Flatten nested area data for easy access
    - Handle loading and error states
    - _Requirements: 6.1, 6.4_

  - [ ] 2.2 Write unit tests for hook
    - Test loading state
    - Test success state with data
    - Test error state
    - Test area flattening logic
    - _Requirements: 6.1, 6.2, 6.3_

- [ ] 3. Create RecognitionBadge Component
  - [ ] 3.1 Implement RecognitionBadge component
    - Create `frontend/src/components/RecognitionBadge.tsx`
    - Render gold badge for Presidents
    - Render silver badge for Select
    - Render bronze badge for Distinguished
    - Render nothing for NotDistinguished
    - Include ARIA labels for accessibility
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 8.1, 8.3_

  - [ ] 3.2 Write property test for badge rendering
    - **Property 3: Recognition Badge Renders Correctly for Level**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5**

- [ ] 4. Create ThresholdProgress Component
  - [ ] 4.1 Implement ThresholdProgress component
    - Create `frontend/src/components/ThresholdProgress.tsx`
    - Calculate fill percentage as (current / threshold) \* 100, capped at 100%
    - Apply green color when threshold met
    - Apply amber color when >= 75% of threshold
    - Apply red color when < 75% of threshold
    - Include ARIA progressbar attributes
    - _Requirements: 2.7, 3.7, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 8.5_

  - [ ] 4.2 Write property test for progress bar percentage
    - **Property 5: Progress Bar Renders Correct Percentage**
    - **Validates: Requirements 2.7, 3.7, 5.1, 5.2, 5.3, 5.4**

  - [ ] 4.3 Write property test for progress bar color
    - **Property 6: Progress Bar Color Reflects Threshold Status**
    - **Validates: Requirements 5.5, 5.6**

- [ ] 5. Create EligibilityIndicator Component
  - [ ] 5.1 Implement EligibilityIndicator component
    - Create `frontend/src/components/EligibilityIndicator.tsx`
    - Show info icon when eligibility is "unknown"
    - Display tooltip with eligibility reason on hover
    - Use consistent styling for division and area contexts
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ] 5.2 Write unit tests for eligibility indicator
    - Test visibility for each eligibility state
    - Test tooltip content
    - _Requirements: 4.1, 4.3_

- [ ] 6. Checkpoint - Ensure all new components work
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Enhance DivisionRankings Component
  - [ ] 7.1 Add recognition data integration
    - Accept optional `recognition` prop
    - Match divisions to recognition data by divisionId
    - Display RecognitionBadge in Recognition column
    - Display ThresholdProgress for paid areas percentage
    - Display EligibilityIndicator when eligibility is unknown
    - _Requirements: 2.1, 2.7, 4.1, 4.2_

  - [ ] 7.2 Add recognition tooltip
    - Show paid areas percentage and distinguished areas percentage on hover
    - _Requirements: 2.6_

  - [ ] 7.3 Add sorting by recognition level
    - Add 'recognition' to SortField type
    - Implement ordinal sorting (NotDistinguished < Distinguished < Select < Presidents)
    - _Requirements: 7.1, 7.4_

  - [ ] 7.4 Add filtering by recognition level
    - Add filter dropdown for recognition level
    - Filter to show only divisions at or above selected level
    - _Requirements: 7.2_

  - [ ] 7.5 Write property test for sorting
    - **Property 8: Sorting Uses Ordinal Recognition Order**
    - **Validates: Requirements 7.1, 7.4**

  - [ ] 7.6 Write property test for filtering
    - **Property 9: Filtering by Recognition Level**
    - **Validates: Requirements 7.2**

- [ ] 8. Enhance AreaPerformanceChart Component
  - [ ] 8.1 Add recognition data integration
    - Accept optional `recognition` prop
    - Match areas to recognition data by areaId
    - Display RecognitionBadge in bar chart and heatmap views
    - Display ThresholdProgress for paid clubs percentage
    - Display EligibilityIndicator when eligibility is unknown
    - _Requirements: 3.1, 3.7, 4.1, 4.2_

  - [ ] 8.2 Add recognition tooltip
    - Show paid clubs percentage and distinguished clubs percentage on hover
    - _Requirements: 3.6_

  - [ ] 8.3 Add filtering by recognition level
    - Add filter dropdown for recognition level
    - Filter to show only areas at or above selected level
    - _Requirements: 7.3_

- [ ] 9. Integrate with District Detail Page
  - [ ] 9.1 Wire useRecognitionData hook to page
    - Fetch recognition data alongside existing analytics
    - Pass recognition data to DivisionRankings and AreaPerformanceChart
    - Handle loading states with skeletons
    - Handle error states gracefully
    - _Requirements: 6.1, 6.2, 6.3_

- [ ] 10. Accessibility Verification
  - [ ] 10.1 Write property test for accessibility attributes
    - **Property 10: Accessibility Attributes Present**
    - **Validates: Requirements 8.1, 8.3, 8.5**

  - [ ] 10.2 Verify WCAG AA contrast compliance
    - Verify badge colors meet 4.5:1 contrast ratio
    - Verify progress bar colors meet 3:1 contrast ratio for large elements
    - _Requirements: 8.2_

  - [ ] 10.3 Verify keyboard accessibility
    - Ensure tooltips are keyboard accessible
    - Ensure filter dropdowns are keyboard navigable
    - _Requirements: 8.4_

- [ ] 11. Final Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks are required for comprehensive implementation
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The backend AreaDivisionRecognitionModule already exists and is tested
