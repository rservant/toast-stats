# Optimize `cached-dates` Endpoint

## Problem

The `GET /api/districts/:districtId/cached-dates` endpoint takes **~5 seconds** to return 311 bytes of data. This is the slowest endpoint relative to its payload size.

## Root Cause

The endpoint performs **2,370 GCS HEAD requests** — one per snapshot folder since 2017:

```
1. listSnapshotIds() → lists all ~2,370 snapshot date prefixes (single GCS call, ~1s)
2. For each snapshot, calls hasDistrictInSnapshot(snapshotId, districtId)
   → Each call performs a GCS HEAD request to check if district_{id}.json exists
   → 2,370 HEAD requests at ~2ms each ≈ 4.7s (even with concurrency=25 batching)
```

See [snapshots.ts](../backend/src/routes/districts/snapshots.ts) lines 57–136.

## Proposed Solution: Pre-Computed District-Snapshot Index

Maintain a single JSON index file in GCS that maps each district to its available snapshot dates:

```
gs://toast-stats-data/config/district-snapshot-index.json
```

### Index Structure

```json
{
  "generatedAt": "2026-02-21T12:00:00Z",
  "districts": {
    "109": ["2025-07-23", "2025-07-24", "2025-07-25", "..."],
    "117": ["2025-07-23", "2025-07-24", "..."],
    "20": ["2017-01-31", "2017-02-09", "..."],
    "42": ["2017-01-31", "2017-02-09", "..."],
    "61": ["2017-01-31", "2017-02-09", "..."],
    "86": ["2017-01-31", "2017-02-09", "..."]
  }
}
```

### Implementation Steps

1. **Collector pipeline update**: After writing per-district snapshot files, update the index file
2. **Backend endpoint update**: Read the index file (single GCS read, cached for 1 hour) instead of 2,370 HEAD requests
3. **One-time backfill**: Run a script to generate the initial index from existing data

### Expected Performance

| Metric        | Current | Proposed |
| ------------- | ------- | -------- |
| GCS calls     | ~2,370  | 1        |
| TTFB          | ~5s     | <200ms   |
| Response size | 311B    | 311B     |

### Fallback

If the index file is missing or stale, fall back to the current HEAD-request approach (already implemented).

## Acceptance Criteria

- [ ] `cached-dates` endpoint responds in <500ms for all districts
- [ ] Index file is updated by the collector pipeline on each run
- [ ] Backend gracefully falls back if index is missing
- [ ] Integration test updated to enforce <500ms performance budget
