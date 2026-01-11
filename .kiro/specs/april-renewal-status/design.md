# Design Document: Membership Payment Tracking

## Overview

This feature adds three new columns to the ClubsTable component to display membership payment metrics: October Renewals, April Renewals, and New Members. These columns integrate with the existing filtering, sorting, and export functionality of the table.

The implementation follows the existing patterns established in the ClubsTable component, extending the ClubTrend interface with new fields and adding corresponding column configurations.

## Architecture

The feature follows a layered architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                          │
├─────────────────────────────────────────────────────────────┤
│  ClubsTable Component                                        │
│  ├── New columns: Oct Ren, Apr Ren, New                     │
│  ├── Numeric filtering (range filter)                        │
│  ├── Sorting (ascending/descending)                          │
│  └── CSV export with new fields                              │
├─────────────────────────────────────────────────────────────┤
│  useColumnFilters Hook                                       │
│  └── Extended to handle new numeric fields                   │
├─────────────────────────────────────────────────────────────┤
│  ClubTrend Interface                                         │
│  └── New fields: octoberRenewals, aprilRenewals, newMembers │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Node.js)                         │
├─────────────────────────────────────────────────────────────┤
│  ClubHealthAnalyticsModule                                   │
│  └── Extract payment fields from CSV data                    │
├─────────────────────────────────────────────────────────────┤
│  ClubTrend Type (backend)                                    │
│  └── New fields: octoberRenewals, aprilRenewals, newMembers │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Toastmasters Dashboard CSV                      │
│  Fields: "Oct. Ren", "Apr. Ren", "New Members"              │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Frontend Type Extensions

```typescript
// frontend/src/hooks/useDistrictAnalytics.ts
export interface ClubTrend {
  // ... existing fields ...

  // New membership payment fields
  octoberRenewals?: number // Count of October renewals
  aprilRenewals?: number // Count of April renewals
  newMembers?: number // Count of new members
}
```

### Column Configuration Extension

```typescript
// frontend/src/components/filters/types.ts
export type SortField =
  | 'name'
  | 'membership'
  | 'dcpGoals'
  | 'status'
  | 'division'
  | 'area'
  | 'distinguished'
  | 'octoberRenewals' // New
  | 'aprilRenewals' // New
  | 'newMembers' // New

// New column configurations
const MEMBERSHIP_PAYMENT_COLUMNS: ColumnConfig[] = [
  {
    field: 'octoberRenewals',
    label: 'Oct Ren',
    sortable: true,
    filterable: true,
    filterType: 'numeric',
  },
  {
    field: 'aprilRenewals',
    label: 'Apr Ren',
    sortable: true,
    filterable: true,
    filterType: 'numeric',
  },
  {
    field: 'newMembers',
    label: 'New',
    sortable: true,
    filterable: true,
    filterType: 'numeric',
  },
]
```

### Backend Type Extensions

```typescript
// backend/src/types/analytics.ts
export interface ClubTrend {
  // ... existing fields ...

  // New membership payment fields
  octoberRenewals?: number
  aprilRenewals?: number
  newMembers?: number
}
```

### Data Extraction Logic

```typescript
// In ClubHealthAnalyticsModule or similar
private extractMembershipPayments(club: ScrapedRecord): {
  octoberRenewals?: number
  aprilRenewals?: number
  newMembers?: number
} {
  return {
    octoberRenewals: parseIntSafe(club['Oct. Ren']),
    aprilRenewals: parseIntSafe(club['Apr. Ren']),
    newMembers: parseIntSafe(club['New Members']),
  }
}
```

## Data Models

### CSV Field Mapping

| CSV Field     | TypeScript Field  | Type                  | Description           |
| ------------- | ----------------- | --------------------- | --------------------- |
| `Oct. Ren`    | `octoberRenewals` | `number \| undefined` | October renewal count |
| `Apr. Ren`    | `aprilRenewals`   | `number \| undefined` | April renewal count   |
| `New Members` | `newMembers`      | `number \| undefined` | New member count      |

### Display Logic

| Field Value           | Display       |
| --------------------- | ------------- |
| `undefined` or `null` | `—` (em dash) |
| `0`                   | `0`           |
| Positive number       | The number    |

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

### Property 1: Membership Payment Column Display

_For any_ club data with membership payment fields (octoberRenewals, aprilRenewals, newMembers), the ClubsTable SHALL render all three columns with values matching the source data: positive numbers display as-is, zero displays as "0", and undefined/null displays as "—".

**Validates: Requirements 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4**

### Property 2: Numeric Range Filtering

_For any_ list of clubs and any numeric range filter (min, max) applied to a membership payment column, all clubs in the filtered result SHALL have payment counts satisfying: `min <= count <= max` (where undefined bounds are treated as unbounded).

**Validates: Requirements 4.2, 4.3**

### Property 3: Filter Clearing Restores Full List

_For any_ filtered club list, clearing all filters SHALL result in the full original club list being displayed.

**Validates: Requirements 4.4**

### Property 4: Sorting Invariant

_For any_ list of clubs sorted by a membership payment column, the resulting list SHALL be correctly ordered: ascending order means each element's count is <= the next element's count; descending order means each element's count is >= the next element's count.

**Validates: Requirements 5.1, 5.2, 5.3**

### Property 5: Secondary Sort Stability

_For any_ list of clubs with equal payment counts, sorting by that payment column SHALL maintain alphabetical ordering by club name as a secondary sort key.

**Validates: Requirements 5.4**

### Property 6: CSV Export Contains Payment Columns

_For any_ club data export, the resulting CSV SHALL contain columns for Oct Ren, Apr Ren, and New with numeric values matching the source data.

**Validates: Requirements 6.1, 6.2**

### Property 7: CSV Field Parsing Round-Trip

_For any_ valid CSV data containing "Oct. Ren", "Apr. Ren", and "New Members" fields, parsing SHALL produce ClubTrend objects with corresponding numeric values that, when exported back to CSV, produce equivalent values.

**Validates: Requirements 8.5, 8.6, 8.7**

## Error Handling

### Missing Data

- If CSV fields are missing or empty, the corresponding TypeScript field is `undefined`
- Frontend displays `—` for undefined values
- Filtering treats undefined as not matching any numeric range
- Sorting places undefined values at the end of the list

### Invalid Data

- Non-numeric CSV values are parsed as `undefined` using `parseIntSafe`
- Negative values are preserved (not clamped to 0) as they may indicate data issues

### API Errors

- If backend fails to provide data, existing error handling in `useDistrictAnalytics` applies
- Loading states show skeleton placeholders for new columns

## Testing Strategy

### Unit Tests

Unit tests verify specific examples and edge cases:

1. **Display rendering**: Test that columns render correctly for various data states
2. **Edge cases**: Zero values, undefined values, large numbers
3. **Filter edge cases**: Empty ranges, single-bound ranges
4. **Sort edge cases**: All equal values, all undefined values

### Property-Based Tests

Property-based tests verify universal properties across generated inputs using fast-check:

1. **Property 1**: Generate random club data, verify display matches source
2. **Property 2**: Generate random clubs and filter ranges, verify filter correctness
3. **Property 3**: Generate random filter states, verify clearing restores full list
4. **Property 4**: Generate random clubs, verify sort ordering invariant
5. **Property 5**: Generate clubs with duplicate counts, verify secondary sort
6. **Property 6**: Generate random club data, verify CSV export format
7. **Property 7**: Generate random CSV data, verify parsing round-trip

### Test Configuration

- Property tests: Minimum 100 iterations per property
- Test framework: Vitest with fast-check
- Tag format: `Feature: april-renewal-status, Property N: [property description]`

### Integration Tests

1. **End-to-end data flow**: Verify data flows from CSV through backend to frontend display
2. **Filter + Sort combination**: Verify filtering and sorting work together correctly
3. **Export after filter**: Verify export respects current filter state
