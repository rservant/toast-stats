# Implementation Plan: Clubs Table Column Filtering

## Overview

This implementation plan transforms the existing ClubsTable component to provide individual column filtering capabilities while removing global filter controls. The approach focuses on creating reusable filter components, enhancing the column header interactions, and maintaining performance with proper state management.

## Tasks

- [x] 1. Create filter component infrastructure
  - Create base filter interfaces and types
  - Implement TextFilter component for text columns (Club Name, Division, Area)
  - Implement NumericFilter component for numeric columns (Members, DCP Goals)
  - Implement CategoricalFilter component for categorical columns (Status, Distinguished)
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 1.1 Write property test for filter component consistency
  - **Property 6: Filter type consistency**
  - **Validates: Requirements 2.4**

- [x] 2. Enhance column header component
  - [x] 2.1 Create interactive ColumnHeader component
    - Implement clickable column headers with dropdown/popover functionality
    - Add visual indicators for sort and filter states
    - Include hover states and accessibility attributes
    - _Requirements: 1.1, 4.1, 4.2, 4.3, 4.4_

  - [x] 2.2 Write property test for column header interactions
    - **Property 1: Column header interaction displays controls**
    - **Validates: Requirements 1.1, 4.4**

  - [x] 2.3 Write property test for visual indicators
    - **Property 2: Active filters show visual indicators**
    - **Validates: Requirements 1.4, 4.2**

  - [x] 2.4 Write property test for sortable column indicators
    - **Property 9: Sortable columns show indicators**
    - **Validates: Requirements 4.1**

- [x] 3. Implement filter state management
  - [x] 3.1 Create filter state management hooks
    - Implement useColumnFilters hook for managing individual column filter states
    - Add filter combination logic (AND operations)
    - Include filter clearing and reset functionality
    - _Requirements: 1.2, 1.3, 1.5_

  - [x] 3.2 Write property test for single column filtering
    - **Property 3: Single column filtering correctness**
    - **Status: PASSED** ✅
    - **Validates: Requirements 1.2**

  - [x] 3.3 Write property test for multiple filter combination
    - **Property 4: Multiple filter combination (AND logic)**
    - **Status: PASSED** ✅
    - **Validates: Requirements 1.3**

  - [x] 3.4 Write property test for filter clearing
    - **Property 5: Filter clearing restores state**
    - **Status: PASSED** ✅
    - **Validates: Requirements 1.5**

- [x] 4. Update ClubsTable component structure
  - [x] 4.1 Remove global filter controls
    - Remove search input box and status dropdown from table header
    - Maintain Export button and results count display
    - Update component layout and styling
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 4.2 Integrate column filtering system
    - Replace existing sort-only headers with new ColumnHeader components
    - Wire up filter state management to table data processing
    - Implement Distinguished column custom sort order
    - _Requirements: 4.6_

  - [x] 4.3 Write property test for Distinguished column sorting
    - **Property 8: Distinguished column sort order**
    - **Validates: Requirements 4.6**

- [x] 5. Implement results count and pagination updates
  - [x] 5.1 Update results counting logic
    - Modify results count display to reflect filtered data
    - Implement proper "Total: X clubs" vs "Showing X of Y clubs" logic
    - _Requirements: 2.5, 3.4, 3.5_

  - [x] 5.2 Ensure pagination works with filtering
    - Update pagination to work correctly with filtered datasets
    - Maintain proper page boundaries and navigation
    - _Requirements: 5.3_

  - [x] 5.3 Write property test for results count accuracy
    - **Property 7: Results count accuracy**
    - **Validates: Requirements 2.5, 3.4**

  - [x] 5.4 Write property test for pagination with filtering
    - **Property 12: Pagination with filtering**
    - **Validates: Requirements 5.3**

- [x] 6. Add performance optimizations
  - [x] 6.1 Implement text filter debouncing
    - Add 300ms debounce to text filter inputs
    - Optimize filter processing for large datasets
    - _Requirements: 5.2_

  - [x] 6.2 Write property test for text filter debouncing
    - **Property 11: Text filter debouncing**
    - **Validates: Requirements 5.2**

- [x] 7. Update export functionality
  - [x] 7.1 Modify export to respect active filters
    - Update exportClubPerformance function to use filtered data
    - Ensure exported data matches currently displayed results
    - _Requirements: 5.5_

  - [x] 7.2 Write property test for export with filters
    - **Property 13: Export respects filters**
    - **Validates: Requirements 5.5**

- [x] 8. Implement accessibility features
  - [x] 8.1 Add keyboard navigation support
    - Ensure all filter controls are keyboard accessible
    - Implement proper tab order and focus management
    - Add focus trapping for filter dropdowns
    - _Requirements: 6.1, 6.4, 6.5_

  - [x] 8.2 Write property test for keyboard accessibility
    - **Property 14: Keyboard accessibility**
    - **Validates: Requirements 6.1**

  - [x] 8.3 Write property test for focus indicators
    - **Property 15: Focus indicators on column headers**
    - **Validates: Requirements 6.4**

  - [x] 8.4 Write property test for focus trapping
    - **Property 16: Focus trapping in filter dropdowns**
    - **Validates: Requirements 6.5**

- [x] 9. Add hover state interactions
  - [x] 9.1 Implement interactive hover states
    - Add hover effects for column headers
    - Provide visual feedback for interactive elements
    - _Requirements: 4.3_

  - [x] 9.2 Write property test for hover state interactions
    - **Property 10: Interactive column hover states**
    - **Validates: Requirements 4.3**

- [x] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Integration and final testing
  - [x] 11.1 Add "Clear All Filters" functionality
    - Implement global filter clearing when multiple filters are active
    - Position prominently in the UI
    - _Requirements: 4.5_

  - [x] 11.2 Final integration testing
    - Test complete user workflows from filter application to export
    - Verify performance with large datasets (up to 1000 clubs)
    - Validate cross-browser compatibility
    - _Requirements: 5.1_

  - [x] 11.3 Write integration tests for complete workflows
    - Test end-to-end filtering, sorting, and export workflows
    - Validate UI state consistency across operations

- [x] 12. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation maintains backward compatibility with existing ClubsTable usage
- Performance optimizations are built in from the start to handle large datasets
- Accessibility features are integrated throughout rather than added as an afterthought
