# Design Document: DAP/DDP Tab Integration

## Overview

This design integrates Distinguished Area Program (DAP) and Distinguished Division Program (DDP) recognition data into the existing Divisions & Areas tab on the District Detail page. The backend recognition calculation module (`AreaDivisionRecognitionModule`) already exists; this design covers the API endpoint, React hooks, and UI component enhancements.

The integration follows a layered approach:
1. **API Layer**: New REST endpoint exposing recognition calculations
2. **Data Layer**: React Query hook for fetching and caching recognition data
3. **UI Layer**: Enhanced components with recognition badges, progress bars, and tooltips

## Architecture

```mermaid
flowchart TB
    subgraph Frontend
        DR[DivisionRankings Component]
        AP[AreaPerformanceChart Component]
        RB[RecognitionBadge Component]
        TP[ThresholdProgress Component]
        Hook[useRecognitionData Hook]
    end
    
    subgraph Backend
        API[/api/districts/:id/recognition]
        Module[AreaDivisionRecognitionModule]
        Store[PerDistrictSnapshotStore]
    end
    
    DR --> Hook
    AP --> Hook
    DR --> RB
    AP --> RB
    DR --> TP
    AP --> TP
    Hook -->|GET| API
    API --> Module
    Module --> Store
```

## Components and Interfaces

### API Endpoint

**Route**: `GET /api/districts/:districtId/recognition`

**Query Parameters**:
- `date` (optional): ISO date string for snapshot date. Defaults to current snapshot.

**Response Schema**:
```typescript
interface RecognitionResponse {
  districtId: string
  asOfDate: string
  divisions: DivisionRecognition[]
}
```

**Error Responses**:
- `404 Not Found`: District has no data for the specified date
- `400 Bad Request`: Invalid date format

### React Hook: useRecognitionData

```typescript
interface UseRecognitionDataOptions {
  districtId: string | null
  date?: string
}

interface UseRecognitionDataResult {
  divisions: DivisionRecognition[] | undefined
  areas: AreaRecognition[] | undefined
  isLoading: boolean
  isError: boolean
  error: Error | null
}

function useRecognitionData(options: UseRecognitionDataOptions): UseRecognitionDataResult
```

The hook:
- Fetches recognition data via React Query
- Flattens nested area data for easy access
- Caches with 10-minute stale time (matching existing analytics)
- Returns loading/error states for UI feedback

### RecognitionBadge Component

```typescript
interface RecognitionBadgeProps {
  level: AreaDivisionRecognitionLevel
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}
```

Visual mapping:
| Level | Color | Label |
|-------|-------|-------|
| Presidents | Gold (#F2DF74 / tm-happy-yellow) | President's Distinguished |
| Select | Silver (#A9B2B1 / tm-cool-gray) | Select Distinguished |
| Distinguished | Bronze (#772432 / tm-true-maroon) | Distinguished |
| NotDistinguished | (no badge rendered) | — |

### ThresholdProgress Component

```typescript
interface ThresholdProgressProps {
  current: number
  threshold: number
  label: string
  showPercentage?: boolean
}
```

Color logic:
- `current >= threshold`: Green (success)
- `current >= threshold * 0.75`: Amber (warning)
- `current < threshold * 0.75`: Red (danger)

### EligibilityIndicator Component

```typescript
interface EligibilityIndicatorProps {
  eligibility: RecognitionEligibility
  reason?: string
}
```

Displays an info icon with tooltip when eligibility is "unknown", explaining that club visit data is unavailable from the dashboard.



## Data Models

### Existing Types (from backend)

The following types are already defined in `backend/src/types/analytics.ts` and mirrored in `frontend/src/hooks/useDistrictAnalytics.ts`:

```typescript
type AreaDivisionRecognitionLevel = 'NotDistinguished' | 'Distinguished' | 'Select' | 'Presidents'

type RecognitionEligibility = 'eligible' | 'ineligible' | 'unknown'

interface AreaRecognition {
  areaId: string
  areaName: string
  divisionId: string
  totalClubs: number
  paidClubs: number
  distinguishedClubs: number
  paidClubsPercent: number
  distinguishedClubsPercent: number
  eligibility: RecognitionEligibility
  eligibilityReason?: string
  recognitionLevel: AreaDivisionRecognitionLevel
  meetsPaidThreshold: boolean
  meetsDistinguishedThreshold: boolean
}

interface DivisionRecognition {
  divisionId: string
  divisionName: string
  totalAreas: number
  paidAreas: number
  distinguishedAreas: number
  paidAreasPercent: number
  distinguishedAreasPercent: number
  eligibility: RecognitionEligibility
  eligibilityReason?: string
  recognitionLevel: AreaDivisionRecognitionLevel
  meetsPaidThreshold: boolean
  meetsDistinguishedThreshold: boolean
  areas: AreaRecognition[]
}
```

### Recognition Thresholds (Constants)

```typescript
// DAP Thresholds
const DAP_PAID_CLUBS_THRESHOLD = 75      // ≥75% of clubs must be paid
const DAP_DISTINGUISHED_THRESHOLD = 50   // ≥50% for Distinguished
const DAP_SELECT_THRESHOLD = 75          // ≥75% for Select
const DAP_PRESIDENTS_THRESHOLD = 100     // 100% for President's

// DDP Thresholds
const DDP_PAID_AREAS_THRESHOLD = 85      // ≥85% of areas must be paid
const DDP_DISTINGUISHED_THRESHOLD = 50   // ≥50% for Distinguished
const DDP_SELECT_THRESHOLD = 75          // ≥75% for Select
const DDP_PRESIDENTS_THRESHOLD = 100     // 100% for President's
```

### Extended Component Props

```typescript
// Enhanced DivisionRankings props
interface DivisionRankingsProps {
  divisions: DivisionAnalytics[]
  recognition?: DivisionRecognition[]  // New: recognition data
  isLoading?: boolean
}

// Enhanced AreaPerformanceChart props
interface AreaPerformanceChartProps {
  areas: AreaAnalytics[]
  recognition?: AreaRecognition[]  // New: recognition data
  isLoading?: boolean
}
```

### Sorting Support

```typescript
// Recognition level ordinal values for sorting
const RECOGNITION_LEVEL_ORDER: Record<AreaDivisionRecognitionLevel, number> = {
  NotDistinguished: 0,
  Distinguished: 1,
  Select: 2,
  Presidents: 3,
}
```



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: API Returns Valid Recognition Structure

*For any* valid district with snapshot data, the recognition API response SHALL contain an array of DivisionRecognition objects, each containing a nested array of AreaRecognition objects, and all objects SHALL conform to their respective type schemas.

**Validates: Requirements 1.1, 1.5**

### Property 2: API Date Parameter Selects Correct Snapshot

*For any* district with multiple snapshots and any valid date parameter, the recognition API SHALL return recognition data calculated from the snapshot corresponding to that date.

**Validates: Requirements 1.2**

### Property 3: Recognition Badge Renders Correctly for Level

*For any* recognition level in {Distinguished, Select, Presidents}, the RecognitionBadge component SHALL render a visible badge with the correct color and label text. *For* NotDistinguished, the component SHALL render nothing.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5**

### Property 4: Tooltip Displays Correct Percentages

*For any* division or area with recognition data, hovering over the element SHALL display a tooltip containing the exact paid percentage and distinguished percentage values from the recognition data.

**Validates: Requirements 2.6, 3.6, 4.3**

### Property 5: Progress Bar Renders Correct Percentage

*For any* percentage value and threshold, the ThresholdProgress component SHALL render a progress bar where the filled portion represents `(current / threshold) * 100%`, capped at 100%.

**Validates: Requirements 2.7, 3.7, 5.1, 5.2, 5.3, 5.4**

### Property 6: Progress Bar Color Reflects Threshold Status

*For any* current percentage and threshold:
- IF current >= threshold, THEN the progress bar SHALL be green (success)
- IF current >= threshold * 0.75, THEN the progress bar SHALL be amber (warning)
- IF current < threshold * 0.75, THEN the progress bar SHALL be red (danger)

**Validates: Requirements 5.5, 5.6**

### Property 7: Eligibility Indicator Consistency

*For any* recognition data with eligibility="unknown", the system SHALL display an eligibility indicator AND still display the calculated recognition level. The indicator style SHALL be identical for both division and area displays.

**Validates: Requirements 4.1, 4.2, 4.4**

### Property 8: Sorting Uses Ordinal Recognition Order

*For any* list of divisions sorted by recognition level, the resulting order SHALL satisfy: all NotDistinguished items appear before all Distinguished items, which appear before all Select items, which appear before all Presidents items.

**Validates: Requirements 7.1, 7.4**

### Property 9: Filtering by Recognition Level

*For any* filter level L and list of divisions/areas, the filtered result SHALL contain only items where `RECOGNITION_LEVEL_ORDER[item.recognitionLevel] >= RECOGNITION_LEVEL_ORDER[L]`.

**Validates: Requirements 7.2, 7.3**

### Property 10: Accessibility Attributes Present

*For any* rendered RecognitionBadge, the element SHALL have an aria-label describing the recognition level. *For any* rendered ThresholdProgress, the element SHALL have role="progressbar" and aria-valuenow, aria-valuemin, aria-valuemax attributes.

**Validates: Requirements 8.1, 8.3, 8.5**



## Error Handling

### API Layer

| Error Condition | HTTP Status | Response Body |
|-----------------|-------------|---------------|
| District not found | 404 | `{ error: "District not found", districtId: string }` |
| No data for date | 404 | `{ error: "No data for date", districtId: string, date: string }` |
| Invalid date format | 400 | `{ error: "Invalid date format", provided: string }` |
| Internal error | 500 | `{ error: "Internal server error" }` |

### Frontend Layer

The `useRecognitionData` hook handles errors gracefully:

```typescript
// Error handling in hook
const { data, isError, error } = useQuery({
  queryKey: ['recognition', districtId, date],
  queryFn: fetchRecognition,
  retry: (failureCount, error) => {
    // Don't retry on 404 or 400
    if (error.response?.status === 404 || error.response?.status === 400) {
      return false
    }
    return failureCount < 2
  }
})
```

### Component Error States

Components display graceful fallbacks when recognition data is unavailable:

```typescript
// In DivisionRankings
{recognition ? (
  <RecognitionBadge level={recognition.recognitionLevel} />
) : (
  <span className="text-gray-400">—</span>
)}
```

## Testing Strategy

### Unit Tests

Unit tests verify specific examples and edge cases:

1. **RecognitionBadge Component**
   - Renders correct badge for each recognition level
   - Renders nothing for NotDistinguished
   - Applies correct colors and labels

2. **ThresholdProgress Component**
   - Renders correct fill percentage
   - Applies correct color based on threshold comparison
   - Handles edge cases (0%, 100%, over 100%)

3. **EligibilityIndicator Component**
   - Shows indicator when eligibility is "unknown"
   - Hides when eligibility is "eligible" or "ineligible"
   - Displays correct tooltip content

4. **useRecognitionData Hook**
   - Returns loading state initially
   - Returns data on success
   - Returns error state on failure
   - Flattens area data correctly

### Property-Based Tests

Property tests verify universal properties across generated inputs:

1. **API Response Schema Conformance** (Property 1)
   - Generate random district data
   - Verify response matches DivisionRecognition/AreaRecognition schemas

2. **Badge Rendering by Level** (Property 3)
   - Generate all recognition levels
   - Verify correct badge appearance for each

3. **Progress Bar Percentage** (Property 5)
   - Generate random percentages and thresholds
   - Verify fill width calculation

4. **Progress Bar Color** (Property 6)
   - Generate random percentages and thresholds
   - Verify color matches threshold comparison rules

5. **Sorting Ordinal Order** (Property 8)
   - Generate random lists of recognition levels
   - Verify sorted order satisfies ordinal constraints

6. **Filtering by Level** (Property 9)
   - Generate random lists and filter levels
   - Verify filtered results satisfy level constraint

### Integration Tests

1. **API Endpoint**
   - Test with real snapshot data
   - Verify date parameter handling
   - Verify error responses

2. **Component Integration**
   - Test DivisionRankings with recognition data
   - Test AreaPerformanceChart with recognition data
   - Verify tooltip interactions

### Test Configuration

- **Framework**: Vitest (matching existing project setup)
- **Property Testing**: fast-check
- **Minimum iterations**: 100 per property test
- **Component Testing**: React Testing Library

