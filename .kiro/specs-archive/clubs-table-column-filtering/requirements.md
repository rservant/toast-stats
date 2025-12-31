# Requirements Document

## Introduction

This specification defines enhancements to the ClubsTable component to provide individual column filtering capabilities while removing the global filter controls. The goal is to create a more intuitive and flexible filtering experience where users can filter directly on each column header rather than using separate filter controls.

## Glossary

- **ClubsTable**: The React component that displays club data in a tabular format
- **Column_Filter**: Individual filter controls embedded within or near column headers
- **Global_Filter**: The current search input and status dropdown above the table
- **Sort_Indicator**: Visual icons showing current sort direction for each column
- **Filter_Indicator**: Visual elements showing active filters on columns

## Requirements

### Requirement 1: Individual Column Filtering

**User Story:** As a district leader, I want to filter clubs by specific column values directly from the column headers, so that I can quickly narrow down the data without using separate filter controls.

#### Acceptance Criteria

1. WHEN a user clicks on a column header, THE System SHALL display both sort and filter options for that column
2. WHEN a user applies a filter to a column, THE System SHALL show only rows that match the filter criteria
3. WHEN multiple column filters are active, THE System SHALL show only rows that match ALL active filters (AND logic)
4. WHEN a column has an active filter, THE System SHALL display a visual indicator on the column header
5. WHEN a user clears a column filter, THE System SHALL remove the filter and update the displayed results immediately

### Requirement 2: Column-Specific Filter Types

**User Story:** As a user, I want different filter types for different column data types, so that I can filter data in the most appropriate way for each column.

#### Acceptance Criteria

1. WHEN filtering text columns (Club Name, Division, Area), THE System SHALL provide a text input filter with contains/starts with options
2. WHEN filtering numeric columns (Members, DCP Goals), THE System SHALL provide range filters with min/max inputs
3. WHEN filtering categorical columns (Status, Distinguished), THE System SHALL provide multi-select dropdown filters
4. WHEN filtering any column, THE System SHALL provide a "Clear Filter" option
5. WHEN a filter is applied, THE System SHALL update the results count immediately

### Requirement 3: Remove Global Filter Controls

**User Story:** As a user, I want a cleaner interface without redundant filter controls, so that I can focus on the column-specific filtering capabilities.

#### Acceptance Criteria

1. WHEN the enhanced table loads, THE System SHALL NOT display the search input box above the table
2. WHEN the enhanced table loads, THE System SHALL NOT display the status dropdown filter above the table
3. WHEN the enhanced table loads, THE System SHALL maintain the Export button and results count display
4. WHEN filters are applied via column headers, THE System SHALL update the "Total: X clubs" or "Showing X of Y clubs" text
5. WHEN no filters are active, THE System SHALL display "Total: X clubs" where X is the total number of clubs

### Requirement 4: Enhanced Sort and Filter UI

**User Story:** As a user, I want clear visual indicators for sorting and filtering states, so that I can understand what filters and sorts are currently active.

#### Acceptance Criteria

1. WHEN a column is sortable, THE System SHALL display a sort indicator icon in the column header
2. WHEN a column has an active filter, THE System SHALL display a filter indicator icon in the column header
3. WHEN a user hovers over a column header, THE System SHALL show a visual indication that the column is interactive
4. WHEN a column header is clicked, THE System SHALL show a dropdown or popover with sort and filter options
5. WHEN multiple filters are active, THE System SHALL provide a "Clear All Filters" option in a prominent location
6. WHEN the Distinguished column is sorted in ascending order, THE System SHALL order values as: Distinguished, Select, President, Smedley

### Requirement 5: Performance and User Experience

**User Story:** As a user, I want filtering and sorting to be fast and responsive, so that I can efficiently analyze club data.

#### Acceptance Criteria

1. WHEN a filter is applied, THE System SHALL update results within 100ms for datasets up to 1000 clubs
2. WHEN typing in a text filter, THE System SHALL debounce input to avoid excessive filtering (300ms delay)
3. WHEN filters are applied, THE System SHALL maintain pagination functionality
4. WHEN the page is refreshed, THE System SHALL reset all filters to their default state
5. WHEN export is triggered, THE System SHALL export only the currently filtered and sorted data

### Requirement 6: Accessibility and Responsive Design

**User Story:** As a user with accessibility needs, I want the filtering interface to be keyboard navigable and screen reader friendly, so that I can use the table effectively.

#### Acceptance Criteria

1. WHEN using keyboard navigation, THE System SHALL allow users to access all filter controls via Tab key
2. WHEN a screen reader is used, THE System SHALL announce filter states and changes
3. WHEN viewed on mobile devices, THE System SHALL provide touch-friendly filter controls
4. WHEN column headers are focused, THE System SHALL show clear visual focus indicators
5. WHEN filter dropdowns are open, THE System SHALL trap focus within the dropdown until closed
