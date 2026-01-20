# Implementation Tasks: District Global Rankings Tab

## Overview

This document outlines the implementation tasks for adding a Global Rankings tab to the District Performance page. Tasks are organized by component and follow the architecture defined in design.md.

## Task List

- [x] 1. Backend: Available Program Years Endpoint
  - [x] 1.1 Create `GET /api/districts/:districtId/available-ranking-years` route
  - [x] 1.2 Implement service method to query SnapshotStore for program years with ranking data
  - [x] 1.3 Add response type definitions to backend types
  - [x] 1.4 Write unit tests for the new endpoint

- [x] 2. Frontend: Data Hooks
  - [x] 2.1 Create `useAvailableProgramYears` hook to fetch available program years
  - [x] 2.2 Create `useGlobalRankings` hook that aggregates ranking data across years
  - [x] 2.3 Add helper functions for extracting end-of-year rankings from history data
  - [x] 2.4 Add helper function for calculating year-over-year rank changes
  - [x] 2.5 Write unit tests for hooks and helper functions

- [x] 3. Frontend: RankingCard Component
  - [x] 3.1 Create `RankingCard` component with rank display, total districts, and percentile
  - [x] 3.2 Add year-over-year change indicator with directional arrows
  - [x] 3.3 Implement color schemes for different metrics (blue, green, purple, yellow)
  - [x] 3.4 Ensure 44px minimum touch targets and WCAG AA contrast
  - [x] 3.5 Write unit tests for RankingCard component

- [x] 4. Frontend: EndOfYearRankingsPanel Component
  - [x] 4.1 Create `EndOfYearRankingsPanel` container component
  - [x] 4.2 Render four RankingCard instances (Overall, Clubs, Payments, Distinguished)
  - [x] 4.3 Add loading skeleton state
  - [x] 4.4 Add partial year indicator when data is incomplete
  - [x] 4.5 Implement responsive stacking for mobile viewports
  - [x] 4.6 Write unit tests for EndOfYearRankingsPanel

- [x] 5. Frontend: FullYearRankingChart Component
  - [x] 5.1 Create `FullYearRankingChart` component extending HistoricalRankChart pattern
  - [x] 5.2 Implement metric toggle (Overall/Clubs/Payments/Distinguished)
  - [x] 5.3 Configure inverted Y-axis (rank 1 at top)
  - [x] 5.4 Add tooltip showing exact rank and date on hover
  - [x] 5.5 Apply Toastmasters brand colors to chart elements
  - [x] 5.6 Add aria-label and screen reader accessible description
  - [x] 5.7 Implement horizontal scroll for mobile viewports
  - [x] 5.8 Write unit tests for FullYearRankingChart

- [x] 6. Frontend: MultiYearComparisonTable Component
  - [x] 6.1 Create `MultiYearComparisonTable` component
  - [x] 6.2 Display end-of-year rankings for all available program years
  - [x] 6.3 Add year-over-year change indicators with visual arrows
  - [x] 6.4 Order program years chronologically (most recent first)
  - [x] 6.5 Add partial year indicator for incomplete data
  - [x] 6.6 Implement responsive layout for mobile
  - [x] 6.7 Write unit tests for MultiYearComparisonTable

- [x] 7. Frontend: GlobalRankingsTab Component
  - [x] 7.1 Create `GlobalRankingsTab` main container component
  - [x] 7.2 Integrate ProgramYearSelector for year selection
  - [x] 7.3 Compose EndOfYearRankingsPanel, FullYearRankingChart, and MultiYearComparisonTable
  - [x] 7.4 Implement loading state with skeleton matching content layout
  - [x] 7.5 Implement error state with retry button
  - [x] 7.6 Implement empty state for districts without ranking data
  - [x] 7.7 Add data freshness timestamp display
  - [x] 7.8 Write unit tests for GlobalRankingsTab

- [x] 8. Frontend: Tab Navigation Integration
  - [x] 8.1 Add "Global Rankings" tab to DistrictDetailPage tab navigation
  - [x] 8.2 Implement tab routing/state management for new tab
  - [x] 8.3 Ensure consistent styling with existing tabs per brand guidelines
  - [x] 8.4 Write integration test for tab navigation

- [x] 9. Accessibility Testing
  - [x] 9.1 Run axe-core accessibility tests on all new components
  - [x] 9.2 Verify keyboard navigation for all interactive elements
  - [x] 9.3 Verify screen reader compatibility for chart and data
  - [x] 9.4 Verify color-independent meaning (icons/text with color indicators)

- [x] 10. Integration Testing
  - [x] 10.1 Write integration test for complete data flow (API → hooks → components)
  - [x] 10.2 Test program year transitions and data updates
  - [x] 10.3 Test error handling and retry functionality
