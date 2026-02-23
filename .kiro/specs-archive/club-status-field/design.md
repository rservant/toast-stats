# Design Document: Club Status Field

## Overview

This design adds support for the "Club Status" field from the Toastmasters dashboard club-performance.csv data. The implementation spans three layers:

1. **Backend**: Parse the "Club Status" field from CSV records and include it in the ClubTrend data structure
2. **Types**: Add the clubStatus field to the ClubTrend interface
3. **Frontend**: Display the field in ClubsTable with sorting and filtering support

The design follows existing patterns established for similar fields (e.g., octoberRenewals, aprilRenewals, newMembers) to maintain consistency.

## Architecture

```mermaid
flowchart TD
    subgraph Backend
        CSV[club-performance.csv] --> Parser[ClubHealthAnalyticsModule]
        Parser --> ClubTrend[ClubTrend Object]
    end

    subgraph API
        ClubTrend --> Analytics[/districts/:id/analytics]
    end

    subgraph Frontend
        Analytics --> Hook[useDistrictAnalytics]
        Hook --> Table[ClubsTable]
        Table --> Column[Club Status Column]
        Column --> Sort[Sorting]
        Column --> Filter[Categorical Filter]
        Table --> Export[CSV Export]
    end
```

## Components and Interfaces

### Backend Components

#### ClubHealthAnalyticsModule (Modified)

The `analyzeClubTrends` method will be extended to extract the club status field:

```typescript
// In analyzeClubTrends method, when building ClubTrend objects:
clubMap.set(clubId, {
  // ... existing fields ...
  clubStatus: this.extractClubStatus(club),
})

/**
 * Extract club status from a club record
 *
 * @param club - Raw club data record from CSV
 * @returns Club status string or undefined if not present
 */
private extractClubStatus(club: ScrapedRecord): string | undefined {
  const status = club['Club Status'] ?? club['Status']
  if (status === null || status === undefined || status === '') {
    return undefined
  }
  return String(status).trim()
}
```

### Type Definitions

#### ClubTrend Interface (Modified)

```typescript
// In frontend/src/hooks/useDistrictAnalytics.ts
export interface ClubTrend {
  // ... existing fields ...

  /**
   * Club operational status from Toastmasters dashboard
   * Values: "Active", "Suspended", "Ineligible", "Low", or undefined
   */
  clubStatus?: string
}
```

#### ClubPerformanceRecord Interface (Already Exists)

The `ClubPerformanceRecord` in `packages/collector-cli/src/types/collector.ts` already includes the optional `'Club Status'?: string` field, so no changes are needed there.

#### SortField Type (Modified)

```typescript
// In frontend/src/components/filters/types.ts
export type SortField =
  | 'name'
  | 'membership'
  | 'dcpGoals'
  | 'status'
  | 'division'
  | 'area'
  | 'distinguished'
  | 'octoberRenewals'
  | 'aprilRenewals'
  | 'newMembers'
  | 'clubStatus' // New field
```

### Frontend Components

#### COLUMN_CONFIGS (Modified)

```typescript
// In frontend/src/components/filters/types.ts
export const COLUMN_CONFIGS: ColumnConfig[] = [
  // ... existing columns ...
  {
    field: 'status',
    label: 'Status',
    // ... existing config ...
  },
  // New column - positioned after health status
  {
    field: 'clubStatus',
    label: 'Club Status',
    sortable: true,
    filterable: true,
    filterType: 'categorical',
    filterOptions: ['Active', 'Suspended', 'Ineligible', 'Low'],
  },
  // ... remaining columns ...
]
```

#### ClubsTable Component (Modified)

Add sorting logic for the new field:

```typescript
// In sortedClubs useMemo, add case for clubStatus:
case 'clubStatus':
  aValue = a.clubStatus?.toLowerCase() ?? ''
  bValue = b.clubStatus?.toLowerCase() ?? ''
  break
```

Add table cell rendering:

```typescript
<td className="px-2 py-3 whitespace-nowrap text-sm text-center">
  {club.clubStatus ? (
    <span className="text-gray-900">{club.clubStatus}</span>
  ) : (
    <span className="text-gray-400">—</span>
  )}
</td>
```

#### useColumnFilters Hook (Modified)

Add filter case for clubStatus:

```typescript
case 'clubStatus':
  if (filter.type === 'categorical' && Array.isArray(filter.value)) {
    const selectedValues = filter.value as string[]
    if (selectedValues.length === 0) return clubs
    return clubs.filter(club => {
      return club.clubStatus && selectedValues.includes(club.clubStatus)
    })
  }
  break
```

#### CSV Export (Modified)

```typescript
// In exportClubPerformance function
const headers = [
  // ... existing headers ...
  'Club Status',
]

// In row mapping
clubStatus: club.clubStatus ?? '',
```

#### ClubDetailModal Component (Modified)

Add a Club Status badge near the health status badge:

```typescript
// Helper function for club status badge styling
const getClubStatusBadge = (status: string | undefined) => {
  if (!status) return null

  switch (status.toLowerCase()) {
    case 'active':
      return 'bg-green-100 text-green-800 border-green-300'
    case 'suspended':
      return 'bg-red-100 text-red-800 border-red-300'
    case 'ineligible':
    case 'low':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300'
  }
}

// In the Status and Export section, add club status badge:
<div className="flex items-center justify-between mb-6">
  <div className="flex items-center gap-3">
    {/* Existing health status badge */}
    <span className={`px-4 py-2 text-sm font-medium rounded-full border ${getStatusBadge(club.currentStatus)}`}>
      {club.currentStatus.toUpperCase()}
    </span>

    {/* New club status badge */}
    {club.clubStatus && (
      <span className={`px-4 py-2 text-sm font-medium rounded-full border ${getClubStatusBadge(club.clubStatus)}`}>
        {club.clubStatus}
      </span>
    )}
  </div>
  {/* Export button */}
</div>
```

## Data Models

### Club Status Values

The club status field contains one of the following values from the Toastmasters dashboard:

| Value      | Description                                |
| ---------- | ------------------------------------------ |
| Active     | Club is in good standing                   |
| Suspended  | Club has been suspended                    |
| Ineligible | Club is ineligible for recognition         |
| Low        | Club membership is below minimum threshold |

### Data Flow

1. **Collector**: Fetches club-performance.csv from Toastmasters dashboard (already includes "Club Status" column)
2. **Cache**: Stores raw CSV data in snapshot storage
3. **Analytics Module**: Parses CSV and extracts clubStatus into ClubTrend objects
4. **API**: Returns ClubTrend array via `/districts/:id/analytics` endpoint
5. **Frontend Hook**: Receives data via useDistrictAnalytics
6. **Table Component**: Displays, sorts, and filters by clubStatus

## Correctness Properties

_Note: Per the property-testing-guidance.md steering document, this feature uses unit tests rather than property-based tests. The feature involves simple string extraction, alphabetical sorting, and categorical filtering—cases where "5 well-chosen examples provide equivalent confidence" and property tests would add complexity without value._

The following correctness criteria are validated through unit tests:

### Criterion 1: Club Status Parsing Preserves Values

For non-empty "Club Status" field values, parsing SHALL produce a ClubTrend object where the clubStatus field exactly matches the original CSV value (after trimming whitespace).

**Validates: Requirements 1.2, 1.4, 2.2**

### Criterion 2: Club Status Rendering Displays Correct Values

For ClubTrend objects with a defined clubStatus value, rendering the club row in ClubsTable SHALL produce output containing the exact clubStatus string.

**Validates: Requirements 3.2**

### Criterion 3: Club Status Sorting Produces Correct Order

Sorting by clubStatus SHALL produce:

- Ascending: alphabetical order with undefined values at the end
- Descending: reverse alphabetical order with undefined values at the end

**Validates: Requirements 4.2, 4.3, 4.4**

### Criterion 4: Club Status Filtering Returns Matching Clubs

Filtering by selected clubStatus values SHALL return only clubs whose clubStatus is included in the selected values.

**Validates: Requirements 5.3, 5.5**

### Criterion 5: Club Status Export Contains Correct Values

Exporting to CSV SHALL produce a row where the "Club Status" column contains the clubStatus value if defined, or an empty string if undefined.

**Validates: Requirements 6.1, 6.2**

### Criterion 6: Club Status Badge Styling Matches Status Value

The ClubDetailModal badge SHALL use the correct color scheme:

- "Active" → green (success)
- "Suspended" → red (error)
- "Ineligible" or "Low" → yellow (warning)
- Other values → gray (neutral)

**Validates: Requirements 7.2, 7.3, 7.4**

## Error Handling

### Missing or Invalid Data

| Scenario                                | Handling                                 |
| --------------------------------------- | ---------------------------------------- |
| "Club Status" field missing from CSV    | Set clubStatus to undefined              |
| "Club Status" field is empty string     | Set clubStatus to undefined              |
| "Club Status" field is null             | Set clubStatus to undefined              |
| "Club Status" contains unexpected value | Preserve the value as-is (no validation) |

### UI Error States

| Scenario                  | Handling                                      |
| ------------------------- | --------------------------------------------- |
| clubStatus is undefined   | Display "—" placeholder                       |
| Filter returns no results | Display "No clubs match your filters" message |

## Testing Strategy

### Unit Tests

Unit tests cover specific examples and edge cases. Per the property-testing-guidance.md steering document, this feature uses unit tests rather than property-based tests because:

- The operations are simple (string extraction, alphabetical sorting, categorical filtering)
- 3-5 well-chosen examples fully cover the behavior
- The input space is bounded and not complex

**Parsing Tests:**

- Empty string → undefined
- Null value → undefined
- Missing field → undefined
- Whitespace-only string → undefined
- Valid status values preserved with trimming

**Sorting Tests:**

- Alphabetical order (Active, Ineligible, Low, Suspended)
- Reverse alphabetical order
- Undefined values sort to end in both directions
- Mix of defined and undefined values

**Filtering Tests:**

- Empty filter selection returns all clubs
- Single value selection
- Multiple value selection
- No matching clubs returns empty list

**Export Tests:**

- Club with undefined status exports as empty string
- Club with defined status exports exact value

**Badge Tests:**

- Active status → green styling
- Suspended status → red styling
- Ineligible status → yellow styling
- Low status → yellow styling
- Unknown status → gray styling
- Undefined status → no badge rendered

### Integration Tests

Integration tests verify the end-to-end flow:

1. **API Response**
   - Verify `/districts/:id/analytics` returns clubStatus in ClubTrend objects

2. **Table Rendering**
   - Verify ClubsTable displays Club Status column
   - Verify column is in correct position

3. **Sort and Filter Integration**
   - Verify sorting and filtering work together correctly
