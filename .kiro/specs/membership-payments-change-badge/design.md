# Design Document: Membership Payments Change Badge Fix

## Overview

The Membership Payments card on the District Overview page always shows "+0 members" because `calculateMembershipChangeWithBase()` silently fails to find the district in rankings data and falls back to `calculateMembershipChange()`, which returns 0 when given a single snapshot.

The fix targets `AnalyticsComputer.calculateMembershipChangeWithBase()` in `packages/analytics-core`. The method needs:
1. Diagnostic logging when the rankings lookup fails
2. A normalized districtId lookup to handle format mismatches (e.g., "D42" vs "42")
3. A meaningful fallback using per-club `membershipBase` values from the snapshot instead of returning 0

No changes to the backend, frontend, or API contracts are needed — the `membershipChange` field already exists and is served correctly. The computation just needs to produce the right value.

## Architecture

The fix is entirely within `packages/analytics-core`. The data flow remains:

```
scraper-cli (AnalyticsComputeService)
  → passes [snapshot] + allDistrictsRankings
  → AnalyticsComputer.computeDistrictAnalytics()
    → calculateMembershipChangeWithBase()  ← FIX HERE
      → writes membershipChange into DistrictAnalytics
        → pre-computed JSON file
          → backend serves it
            → frontend displays it
```

No architectural changes. The fix is a logic correction in a single private method.

## Components and Interfaces

### Modified: `AnalyticsComputer.calculateMembershipChangeWithBase()`

Current signature (unchanged):
```typescript
private calculateMembershipChangeWithBase(
  snapshots: DistrictStatistics[],
  allDistrictsRankings: AllDistrictsRankingsData | undefined,
  districtId: string
): number
```

The method's internal logic changes:

1. **Try exact match** on `allDistrictsRankings.rankings` by `districtId` (existing behavior)
2. **Try normalized match** — strip non-numeric chars from both sides and compare (new)
3. **If ranking found with valid `paymentBase`** — return `totalPayments - paymentBase` (existing behavior, now reachable via normalized match)
4. **If no ranking found** — compute from snapshot: `sum(club.paymentsCount) - sum(club.membershipBase)` (new fallback, replaces the old fallback that returned 0)

### Helper: `normalizeDistrictId()`

New private utility (or inline logic):
```typescript
private normalizeDistrictId(id: string): string {
  return id.replace(/\D/g, '')
}
```

### Logging additions

The method will accept or use a logger to emit warnings at each failure point. Since `AnalyticsComputer` doesn't currently have a logger, we'll add optional logging via `console.warn` or by adding a logger parameter to the constructor (following existing patterns in `AnalyticsComputeService`).

## Data Models

No changes to data models. The existing types are sufficient:

- `DistrictAnalytics.membershipChange: number` — already exists, just needs correct values
- `ClubStatistics.paymentsCount: number` — used in new fallback
- `ClubStatistics.membershipBase: number` — used in new fallback
- `DistrictRanking.paymentBase: number` — used in rankings-based calculation
- `DistrictRanking.totalPayments: number` — used in rankings-based calculation

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Rankings-based membership change calculation

*For any* district and any All_Districts_Rankings data where the district has a matching entry with valid `paymentBase` and `totalPayments`, `calculateMembershipChangeWithBase` should return `totalPayments - paymentBase`.

**Validates: Requirements 2.1**

### Property 2: Normalized districtId lookup finds format variants

*For any* districtId string and any rankings entry whose numeric portion matches, the normalized lookup should find the ranking entry regardless of prefix formatting (e.g., "D42" matches "42", "42" matches "D42").

**Validates: Requirements 2.2**

### Property 3: Snapshot-based fallback uses membershipBase

*For any* single snapshot with no available rankings data, `calculateMembershipChangeWithBase` should return `sum(club.paymentsCount) - sum(club.membershipBase)` across all clubs in the snapshot.

**Validates: Requirements 2.3**

## Error Handling

- If `allDistrictsRankings` is `undefined`: log warning, proceed to snapshot fallback
- If district not found in rankings (exact or normalized): log warning with sought ID and available IDs, proceed to snapshot fallback
- If `paymentBase` is null/undefined on matched ranking: log warning, proceed to snapshot fallback
- If snapshots array is empty: return 0 (existing behavior, unchanged)
- All error paths produce a numeric result (never throws)

## Testing Strategy

### Unit Tests

Specific example tests for `calculateMembershipChangeWithBase` (via `computeDistrictAnalytics`):

1. Rankings available with exact districtId match → correct `totalPayments - paymentBase`
2. Rankings available but districtId has format mismatch (e.g., "D42" vs "42") → normalized lookup succeeds
3. Rankings unavailable (`undefined`) → snapshot-based fallback
4. Rankings available but district not found → snapshot-based fallback
5. Rankings available but `paymentBase` is null → snapshot-based fallback
6. Empty snapshots with no rankings → returns 0
7. Logging assertions for each warning path

### Property-Based Tests

Using `fast-check` (already available in the project's test infrastructure).

Each property test runs minimum 100 iterations.

- **Feature: membership-payments-change-badge, Property 1: Rankings-based membership change calculation** — Generate arbitrary rankings data with valid paymentBase/totalPayments, verify result equals `totalPayments - paymentBase`
- **Feature: membership-payments-change-badge, Property 2: Normalized districtId lookup finds format variants** — Generate arbitrary districtId strings with random prefixes, verify normalized lookup matches
- **Feature: membership-payments-change-badge, Property 3: Snapshot-based fallback uses membershipBase** — Generate arbitrary snapshots with random clubs, verify result equals `sum(paymentsCount) - sum(membershipBase)`
