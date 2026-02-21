# Statistics Response Optimization

## Problem

The `GET /api/districts/:districtId/statistics` endpoint returns a **266KB** response. The majority of this payload is the `byClub` array containing detailed per-club data, which is only needed when the user navigates to the "Clubs" tab.

## Current Response Structure

```json
{
  "districtId": "109",
  "asOfDate": "2026-02-20T...",
  "membership": { "total": 5000, "change": 100, ... },
  "clubs": { "total": 100, "active": 95, ... },
  "education": { ... },
  "divisionPerformance": [ ... ],        // ~20KB - needed for Divisions tab
  "clubPerformance": [ ... ],            // ~200KB - only needed for Clubs tab
  "byClub": [ ... ]                      // Largest array
}
```

## Proposed Solution: Split Endpoint with Lazy Loading

### Option A: Field Selection Parameter (Recommended)

Add a `fields` query parameter to control which sections are included:

```
GET /api/districts/:id/statistics                    → summary only (~10KB)
GET /api/districts/:id/statistics?fields=clubs       → summary + clubs (~250KB)
GET /api/districts/:id/statistics?fields=divisions   → summary + divisions (~30KB)
GET /api/districts/:id/statistics?fields=all         → full response (~266KB)
```

**Pros**: Single endpoint, backward-compatible, flexible
**Cons**: Requires frontend changes to pass `fields` param

### Option B: Separate Endpoints

```
GET /api/districts/:id/statistics/summary     → summary metrics only (~10KB)
GET /api/districts/:id/statistics/clubs        → club-level data (~200KB)
GET /api/districts/:id/statistics/divisions    → division data (~20KB)
```

**Pros**: Clean separation, each endpoint is fast
**Cons**: Multiple endpoints to maintain, more gateway routes

### Recommendation

**Option A** is more functional and performant because:

1. The frontend can request exactly what it needs per tab
2. The Overview tab only needs summary data (~10KB)
3. The Clubs tab can lazy-load club data when the user clicks
4. No new endpoints or gateway routes needed
5. The default response (no `fields` param) returns summary only, which is backward-compatible

### Frontend Changes

```tsx
// Overview tab - fast load
const { data: stats } = useDistrictStatistics(districtId, date) // summary only

// Clubs tab - lazy load on tab click
const { data: clubStats } = useDistrictStatistics(districtId, date, 'clubs') // full clubs data
```

## Expected Performance

| Scenario               | Current        | Proposed               |
| ---------------------- | -------------- | ---------------------- |
| Overview tab load      | 1.6s (266KB)   | <500ms (~10KB)         |
| Clubs tab load         | Already loaded | ~1s (~200KB, lazy)     |
| Total data transferred | 266KB always   | 10KB + 200KB on demand |

## Acceptance Criteria

- [ ] Default statistics response is <20KB
- [ ] Overview tab loads in <500ms
- [ ] Clubs tab data loads lazily when user clicks tab
- [ ] `fields=all` returns the full current response for backward compatibility
- [ ] API Gateway openapi.yaml updated with new parameter
