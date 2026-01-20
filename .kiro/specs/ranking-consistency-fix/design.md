# Design Document: Ranking Consistency Fix

## Overview

This design addresses the ranking discrepancy between the main rankings page and the Global Rankings tab on district detail pages. The root cause is that `useGlobalRankings.ts` calculates overall rank by averaging three category ranks, while the main rankings page correctly uses the Borda count aggregate score position.

The solution involves:

1. Adding `overallRank` to the backend rank history API response
2. Updating the frontend to use the API-provided `overallRank` instead of calculating it
3. Updating TypeScript types to include the new field

This is a targeted fix with minimal changes to existing architecture.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend                                  │
├─────────────────────────────────────────────────────────────────┤
│  LandingPage.tsx                GlobalRankingsTab.tsx           │
│  ┌─────────────────┐            ┌─────────────────────┐         │
│  │ Sorts by        │            │ Uses useGlobalRankings       │
│  │ aggregateScore  │            │ hook                │         │
│  │ (correct)       │            │                     │         │
│  └─────────────────┘            └──────────┬──────────┘         │
│                                            │                     │
│                                 ┌──────────▼──────────┐         │
│                                 │ useGlobalRankings.ts│         │
│                                 │ - extractEndOfYear  │         │
│                                 │   Rankings()        │         │
│                                 │ - buildYearlySummary│         │
│                                 │   (USES overallRank)│         │
│                                 └──────────┬──────────┘         │
│                                            │                     │
├────────────────────────────────────────────┼─────────────────────┤
│                        API Call            │                     │
│                                            ▼                     │
├─────────────────────────────────────────────────────────────────┤
│                        Backend                                   │
├─────────────────────────────────────────────────────────────────┤
│  GET /api/districts/:districtId/rank-history                    │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ core.ts                                                     ││
│  │ - Reads all-districts-rankings.json from each snapshot      ││
│  │ - Calculates overallRank by sorting all districts by        ││
│  │   aggregateScore and finding position                       ││
│  │ - Returns HistoricalRankPoint[] with overallRank            ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Backend Changes

#### Modified: `backend/src/routes/districts/core.ts`

The rank-history endpoint will be updated to calculate and include `overallRank` for each historical data point.

```typescript
// In the rank-history endpoint, when building history entries:
interface HistoryEntry {
  date: string
  aggregateScore: number
  clubsRank: number
  paymentsRank: number
  distinguishedRank: number
  totalDistricts: number
  overallRank: number // NEW: Position when sorted by aggregateScore
}

// Calculate overallRank by sorting all districts in the snapshot
// and finding the target district's position
function calculateOverallRank(
  rankings: DistrictRanking[],
  targetDistrictId: string
): number {
  // Sort by aggregateScore descending (higher = better)
  const sorted = [...rankings].sort(
    (a, b) => b.aggregateScore - a.aggregateScore
  )

  // Find position (1-indexed)
  const position = sorted.findIndex(r => r.districtId === targetDistrictId)
  return position >= 0 ? position + 1 : 0
}
```

### Frontend Changes

#### Modified: `frontend/src/types/districts.ts`

```typescript
export interface HistoricalRankPoint {
  date: string
  aggregateScore: number
  clubsRank: number
  paymentsRank: number
  distinguishedRank: number
  totalDistricts: number
  overallRank?: number // NEW: Optional for backward compatibility
}
```

#### Modified: `frontend/src/hooks/useGlobalRankings.ts`

The `extractEndOfYearRankings` and `buildYearlyRankingSummaries` functions will be updated to use `overallRank` from the API response instead of calculating it.

```typescript
// BEFORE (incorrect):
const overallRank = Math.round(
  (latestPoint.clubsRank +
    latestPoint.paymentsRank +
    latestPoint.distinguishedRank) /
    3
)

// AFTER (correct):
// Use overallRank from API if available, otherwise fall back to calculation
// based on aggregateScore position within available data
const overallRank =
  latestPoint.overallRank ??
  calculateFallbackOverallRank(history, latestPoint.aggregateScore)
```

## Data Models

### HistoricalRankPoint (Updated)

```typescript
interface HistoricalRankPoint {
  /** ISO date string (YYYY-MM-DD) */
  date: string

  /** Borda count aggregate score (sum of points from all categories) */
  aggregateScore: number

  /** Rank in paid clubs category (1 = best) */
  clubsRank: number

  /** Rank in membership payments category (1 = best) */
  paymentsRank: number

  /** Rank in distinguished clubs category (1 = best) */
  distinguishedRank: number

  /** Total number of districts ranked */
  totalDistricts: number

  /** Overall rank based on aggregateScore position (1 = best) */
  overallRank?: number // Optional for backward compatibility
}
```

### RankHistoryResponse (Unchanged structure, updated content)

```typescript
interface RankHistoryResponse {
  districtId: string
  districtName: string
  history: HistoricalRankPoint[] // Now includes overallRank
  programYear: ProgramYearInfo
}
```

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

### Property 1: Aggregate Score Ranking Produces Correct Positions

_For any_ list of districts with aggregate scores, sorting by aggregateScore in descending order and assigning ranks based on position (index + 1) SHALL produce overall ranks where rank 1 has the highest score and rank N has the lowest score.

**Validates: Requirements 1.1, 1.2**

### Property 2: API Response Includes Overall Rank

_For any_ valid rank history API response, every HistoricalRankPoint in the history array SHALL contain an overallRank field that is a positive integer.

**Validates: Requirements 2.1**

### Property 3: Overall Rank Matches Aggregate Score Position

_For any_ snapshot containing district rankings, the overallRank for a district SHALL equal its 1-indexed position when all districts in that snapshot are sorted by aggregateScore in descending order.

**Validates: Requirements 2.2**

### Property 4: Frontend Uses API-Provided Overall Rank

_For any_ rank history data containing overallRank values, the extractEndOfYearRankings and buildYearlyRankingSummaries functions SHALL use the overallRank value directly from the data without recalculating.

**Validates: Requirements 3.1, 3.3**

### Property 5: Graceful Fallback for Missing Overall Rank

_For any_ rank history data where overallRank is undefined or missing, the system SHALL calculate a fallback rank based on the aggregateScore's relative position within the available data set.

**Validates: Requirements 3.4, 4.3**

## Error Handling

### Backend Error Handling

1. **Missing Rankings Data**: If a snapshot's all-districts-rankings.json cannot be read, the endpoint continues processing other snapshots and logs a warning. The affected snapshot is excluded from the history.

2. **District Not Found**: If the requested district is not found in any snapshot's rankings, the endpoint returns an empty history array with the district name defaulting to "District {id}".

3. **Invalid District ID**: Returns 400 Bad Request with error code `INVALID_DISTRICT_ID`.

### Frontend Error Handling

1. **Missing overallRank Field**: When `overallRank` is undefined (legacy data), the frontend calculates a fallback by:
   - If history contains multiple districts' data: sort by aggregateScore and find position
   - If only single district data: use aggregateScore relative to totalDistricts as approximation

2. **API Error**: The useGlobalRankings hook exposes `isError` and `error` states. The GlobalRankingsTab displays an error state with retry button.

3. **Empty Data**: When no ranking data is available, the GlobalRankingsTab displays an empty state message.

## Testing Strategy

### Testing Approach Rationale

Per the property-testing-guidance steering document, property-based testing should be reserved for cases where it genuinely adds value. This codebase already has substantial PBT coverage for ranking calculations in `RankingCalculator.property.test.ts`.

For this fix:

- The ranking calculation logic is already covered by existing property tests
- The changes are primarily about data flow (passing overallRank through the API)
- 3-5 well-chosen unit test examples provide equivalent confidence
- The changes are low-risk and easily observable

**Decision**: Use unit tests with well-chosen examples. No new property-based tests needed.

### Unit Tests

Unit tests will verify individual functions with specific examples:

1. **Backend: rank-history endpoint overallRank calculation**
   - Test district ranked #1 (highest aggregateScore) → overallRank = 1
   - Test district ranked #5 of 10 → overallRank = 5
   - Test district ranked last → overallRank = totalDistricts
   - Test tied aggregate scores → same overallRank assigned
   - Test district not found in snapshot → excluded from history

2. **Frontend: `extractEndOfYearRankings` function**
   - Test with overallRank present → uses API value directly
   - Test with overallRank missing (legacy data) → calculates fallback
   - Test with empty history array → returns null

3. **Frontend: `buildYearlyRankingSummaries` function**
   - Test that overallRank from latest data point is used
   - Test year-over-year change uses correct overallRank values

### Integration Tests

1. **API Integration**: Verify rank-history endpoint returns overallRank field
2. **End-to-End Consistency**: Verify GlobalRankingsTab shows same rank as LandingPage for a given district

### Test File Locations

- Backend unit tests: `backend/src/routes/districts/__tests__/core.rank-history.test.ts` (extend existing)
- Frontend unit tests: `frontend/src/hooks/__tests__/useGlobalRankings.test.ts` (extend existing)
