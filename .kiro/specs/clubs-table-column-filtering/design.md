# Design Document: Clubs Table Column Filtering

## Overview

This design document outlines the implementation of individual column filtering capabilities for the ClubsTable component while removing global filter controls. The enhancement will provide a more intuitive and flexible filtering experience by embedding filter controls directly within column headers.

## Architecture

The enhanced ClubsTable will maintain its current React functional component structure but will be extended with:

1. **Column Filter State Management**: Individual filter states for each column
2. **Filter UI Components**: Reusable filter components for different data types
3. **Enhanced Header Components**: Interactive column headers with sort and filter controls
4. **Filter Logic Engine**: Centralized filtering logic that combines multiple column filters

## Components and Interfaces

### Core Component Structure

```typescript
interface ColumnFilter {
  field: SortField
  type: 'text' | 'numeric' | 'categorical'
  value: string | number[] | string[]
  operator?: 'contains' | 'startsWith' | 'equals' | 'range' | 'in'
}

interface FilterState {
  [key: string]: ColumnFilter | null
}

interface ColumnHeaderProps {
  field: SortField
  label: string
  sortable: boolean
  filterable: boolean
  filterType: 'text' | 'numeric' | 'categorical'
  currentSort: { field: SortField | null; direction: SortDirection }
  currentFilter: ColumnFilter | null
  onSort: (field: SortField) => void
  onFilter: (field: SortField, filter: ColumnFilter | null) => void
  options?: string[] // For categorical filters
}
```

### Filter Component Types

#### TextFilter Component

```typescript
interface TextFilterProps {
  value: string
  onChange: (value: string, operator: 'contains' | 'startsWith') => void
  onClear: () => void
}
```

#### NumericFilter Component

```typescript
interface NumericFilterProps {
  value: [number | null, number | null]
  onChange: (min: number | null, max: number | null) => void
  onClear: () => void
  label: string
}
```

#### CategoricalFilter Component

```typescript
interface CategoricalFilterProps {
  options: string[]
  selectedValues: string[]
  onChange: (values: string[]) => void
  onClear: () => void
  label: string
}
```

## Data Models

### Enhanced Club Data Processing

The existing ClubTrend interface will be extended with computed properties for filtering:

```typescript
interface ProcessedClubTrend extends ClubTrend {
  // Computed values for filtering
  latestMembership: number
  latestDcpGoals: number
  distinguishedOrder: number // For proper Distinguished column sorting
}
```

### Filter Configuration

```typescript
interface ColumnConfig {
  field: SortField
  label: string
  sortable: boolean
  filterable: boolean
  filterType: 'text' | 'numeric' | 'categorical'
  filterOptions?: string[]
  sortCustom?: (a: any, b: any) => number
}

const COLUMN_CONFIGS: ColumnConfig[] = [
  {
    field: 'name',
    label: 'Club Name',
    sortable: true,
    filterable: true,
    filterType: 'text',
  },
  {
    field: 'division',
    label: 'Division',
    sortable: true,
    filterable: true,
    filterType: 'text',
  },
  {
    field: 'area',
    label: 'Area',
    sortable: true,
    filterable: true,
    filterType: 'text',
  },
  {
    field: 'membership',
    label: 'Members',
    sortable: true,
    filterable: true,
    filterType: 'numeric',
  },
  {
    field: 'dcpGoals',
    label: 'DCP Goals',
    sortable: true,
    filterable: true,
    filterType: 'numeric',
  },
  {
    field: 'distinguished',
    label: 'Distinguished',
    sortable: true,
    filterable: true,
    filterType: 'categorical',
    filterOptions: ['Distinguished', 'Select', 'President', 'Smedley'],
    sortCustom: (a, b) => {
      const order = { Distinguished: 0, Select: 1, President: 2, Smedley: 3 }
      return (order[a] || 999) - (order[b] || 999)
    },
  },
  {
    field: 'status',
    label: 'Status',
    sortable: true,
    filterable: true,
    filterType: 'categorical',
    filterOptions: ['healthy', 'at-risk', 'critical'],
  },
]
```

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

### Property Reflection

After analyzing all acceptance criteria, I identified several redundant properties that can be consolidated:

- Properties 1.4 and 4.2 both test filter indicator display (consolidated into Property 2)
- Properties 1.1 and 4.4 both test column header click behavior (consolidated into Property 1)
- Several properties test similar UI state behaviors that can be combined

### Core Filtering Properties

**Property 1: Column header interaction displays controls**
_For any_ filterable column header, when clicked, both sort and filter UI controls should become visible and accessible
**Validates: Requirements 1.1, 4.4**

**Property 2: Active filters show visual indicators**
_For any_ column with an active filter, the column header should display a visual filter indicator
**Validates: Requirements 1.4, 4.2**

**Property 3: Single column filtering correctness**
_For any_ column and any valid filter value, applying the filter should result in only rows that match the filter criteria being displayed
**Validates: Requirements 1.2**

**Property 4: Multiple filter combination (AND logic)**
_For any_ combination of active column filters, the displayed rows should satisfy ALL active filter conditions simultaneously
**Validates: Requirements 1.3**

**Property 5: Filter clearing restores state**
_For any_ active column filter, clearing the filter should restore the display to show all rows that match other active filters (or all rows if no other filters are active)
**Validates: Requirements 1.5**

**Property 6: Filter type consistency**
_For any_ filterable column, all columns of the same data type should provide the same filter UI type (text columns get text filters, numeric get range filters, categorical get multi-select)
**Validates: Requirements 2.4**

**Property 7: Results count accuracy**
_For any_ combination of active filters, the displayed results count should exactly match the number of visible rows
**Validates: Requirements 2.5, 3.4**

**Property 8: Distinguished column sort order**
_For any_ set of clubs with Distinguished values, sorting the Distinguished column in ascending order should order values as: Distinguished, Select, President, Smedley
**Validates: Requirements 4.6**

**Property 9: Sortable columns show indicators**
_For any_ sortable column, the column header should display a sort indicator icon
**Validates: Requirements 4.1**

**Property 10: Interactive column hover states**
_For any_ interactive column header, hovering should show visual indication of interactivity
**Validates: Requirements 4.3**

**Property 11: Text filter debouncing**
_For any_ text filter input, rapid typing should be debounced with a 300ms delay before filtering occurs
**Validates: Requirements 5.2**

**Property 12: Pagination with filtering**
_For any_ filtered dataset, pagination should work correctly with the filtered results maintaining proper page boundaries
**Validates: Requirements 5.3**

**Property 13: Export respects filters**
_For any_ combination of active filters and sorts, the export function should export only the currently filtered and sorted data
**Validates: Requirements 5.5**

**Property 14: Keyboard accessibility**
_For any_ filter control, it should be reachable and operable via keyboard navigation using the Tab key
**Validates: Requirements 6.1**

**Property 15: Focus indicators on column headers**
_For any_ column header that receives keyboard focus, clear visual focus indicators should be displayed
**Validates: Requirements 6.4**

**Property 16: Focus trapping in filter dropdowns**
_For any_ open filter dropdown, keyboard navigation should be trapped within the dropdown until it is closed
**Validates: Requirements 6.5**

<function_calls>
<invoke name="prework">
<parameter name="featureName">clubs-table-column-filtering

## Error Handling

### Filter Validation

- **Invalid numeric ranges**: When min > max in numeric filters, display validation error and disable apply
- **Empty filter values**: Treat empty filter inputs as "no filter" rather than error state
- **Invalid filter combinations**: Prevent conflicting filter states through UI constraints

### Performance Degradation

- **Large datasets**: Implement virtual scrolling if filtered results exceed 1000 rows
- **Complex filters**: Show loading indicator for filter operations taking >100ms
- **Memory constraints**: Implement filter result caching with LRU eviction

### Accessibility Failures

- **Screen reader compatibility**: Provide fallback text descriptions for all visual indicators
- **Keyboard navigation**: Ensure all interactive elements have proper tab order and focus management
- **Color contrast**: Maintain WCAG AA compliance for all filter UI elements

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests for comprehensive coverage:

**Unit Tests** will verify:

- Specific filter UI component rendering
- Individual filter type behaviors (text, numeric, categorical)
- Edge cases like empty datasets or invalid inputs
- Integration between filter components and table state

**Property-Based Tests** will verify:

- Universal filtering correctness across all data combinations
- Filter combination logic (AND operations)
- Sort and filter interaction behaviors
- Performance characteristics under various data loads

### Property-Based Testing Configuration

- **Testing Framework**: Vitest with fast-check for property-based testing
- **Test Iterations**: Minimum 100 iterations per property test
- **Data Generation**: Custom generators for ClubTrend data with realistic constraints
- **Test Tagging**: Each property test tagged with format: **Feature: clubs-table-column-filtering, Property {number}: {property_text}**

### Unit Testing Focus Areas

- **Filter Component Isolation**: Test each filter type (TextFilter, NumericFilter, CategoricalFilter) independently
- **State Management**: Verify filter state updates and persistence within component lifecycle
- **UI Integration**: Test filter dropdown positioning, keyboard navigation, and accessibility features
- **Edge Cases**: Empty datasets, single-item datasets, all-filtered-out scenarios

### Integration Testing

- **Full Table Workflow**: Test complete user journeys from filter application to export
- **Performance Benchmarks**: Verify filtering performance meets 100ms requirement for up to 1000 clubs
- **Cross-browser Compatibility**: Test filter UI behavior across modern browsers
- **Mobile Responsiveness**: Verify touch-friendly filter controls on mobile devices

### Test Data Strategy

- **Realistic Club Data**: Generate test data that mirrors production club structures
- **Edge Case Data**: Include clubs with missing fields, extreme values, and special characters
- **Performance Data**: Create large datasets (100, 500, 1000+ clubs) for performance testing
- **Accessibility Data**: Test with screen reader simulation and keyboard-only navigation
