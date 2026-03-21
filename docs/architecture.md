# Architecture — Toast Stats

**Last updated:** March 2026

---

## System Overview

Toast Stats is a CDN-served analytics platform for Toastmasters district leadership. It has no backend server — all data is pre-computed and served as static JSON via Google Cloud CDN.

```
┌──────────────┐     ┌───────────────────┐     ┌─────────────┐     ┌──────────┐
│  Toastmasters │     │   Data Pipeline    │     │  Google     │     │ React    │
│  Dashboard    │────▶│   (GitHub Actions) │────▶│  Cloud CDN  │────▶│ SPA      │
│  (export.aspx)│     │                   │     │  (GCS)      │     │ (Vite)   │
└──────────────┘     └───────────────────┘     └─────────────┘     └──────────┘
```

## Monorepo Workspaces

| Workspace          | Path                         | Purpose                                | Dependencies                     |
| ------------------ | ---------------------------- | -------------------------------------- | -------------------------------- |
| `frontend`         | `frontend/`                  | React SPA (Vite, React 19)             | shared-contracts                 |
| `collector-cli`    | `packages/collector-cli/`    | Data pipeline CLI                      | analytics-core, shared-contracts |
| `analytics-core`   | `packages/analytics-core/`   | Transformation + analytics computation | shared-contracts                 |
| `shared-contracts` | `packages/shared-contracts/` | Zod schemas, types, validators         | (none)                           |

### Dependency Direction

```
frontend ──▶ shared-contracts
collector-cli ──▶ analytics-core ──▶ shared-contracts
```

No circular dependencies. `shared-contracts` is the foundation.

---

## Data Pipeline Architecture

The pipeline runs as a GitHub Actions workflow (`data-pipeline.yml`) with 4 modes:

| Mode       | Trigger          | What It Does                                                   |
| ---------- | ---------------- | -------------------------------------------------------------- |
| `daily`    | Cron (13:00 UTC) | Scrape today → transform → compute → upload                    |
| `rebuild`  | Manual           | Re-process all historical dates from GCS raw-csv               |
| `rescrape` | Manual           | Re-collect CSVs from dashboard for specific dates/program year |
| `prune`    | Manual           | Remove non-month-end snapshots to reduce storage               |

### Data Flow (daily)

```
1. Discover districts   → curl export.aspx?report=districtsummary
2. Scrape per-district  → collector-cli scrape --date --transform
3. Compute analytics    → collector-cli compute-analytics --date
4. Upload to GCS        → gsutil cp snapshots/ + analytics/
5. Generate manifests   → v1/latest.json, v1/dates.json, v1/rankings.json
```

### Storage Layout (GCS: `toast-stats-data-ca`)

```
gs://toast-stats-data-ca/
├── raw-csv/{YYYY-MM-DD}/
│   ├── all-districts.csv
│   ├── district-{id}/
│   │   ├── club-performance.csv
│   │   ├── division-performance.csv
│   │   └── district-performance.csv
│   └── metadata.json
├── snapshots/{YYYY-MM-DD}/
│   ├── district_{id}.json
│   ├── all-districts-rankings.json
│   └── analytics/
│       ├── district_{id}_analytics.json
│       ├── district_{id}_club-trends-index.json
│       └── district_{id}_performance-targets.json
├── time-series/district_{id}/{year}.json
├── club-trends/district_{id}.json
└── v1/
    ├── latest.json        (5-min cache)
    ├── dates.json         (15-min cache)
    └── rankings.json      (1-hr cache)
```

---

## Frontend Architecture

### Stack

- **React 19** + **Vite** (dev server + build)
- **React Router** (client-side routing)
- **React Query** (data fetching + caching)
- **Recharts** (charts)
- **Vanilla CSS** with design token system

### Routing

```
/                      → LandingPage (global rankings table)
/district/:districtId  → DistrictDetailPage (5-tab detail view)
```

### Data Fetching Pattern

All data comes from CDN. No API server.

```typescript
// Pattern: CDN fetch → React Query cache
const { data } = useQuery({
  queryKey: ['analytics', districtId, date],
  queryFn: () => fetchCdnDistrictAnalytics(districtId, date),
})
```

CDN URL structure: `https://cdn.taverns.red/snapshots/{date}/district_{id}_analytics.json`

### Key Hooks

| Hook                    | CDN Source                                              | Purpose                   |
| ----------------------- | ------------------------------------------------------- | ------------------------- |
| `useGlobalRankings`     | `v1/rankings.json`                                      | Landing page rankings     |
| `useDistrictAnalytics`  | `snapshots/{date}/analytics/*`                          | District detail analytics |
| `useTimeSeries`         | `time-series/district_{id}/{year}.json`                 | Membership/payment trends |
| `useClubs`              | `snapshots/{date}/district_{id}.json`                   | Club-level data           |
| `usePerformanceTargets` | `snapshots/{date}/analytics/*_performance-targets.json` | Rank targets              |

---

## Analytics Pipeline (analytics-core)

### Transformation

`DataTransformer` converts raw CSV → structured district snapshot JSON:

- Parses Toastmasters CSV format (with "As of" date headers)
- Extracts club, division, and district performance data
- Normalizes field names and types

### Computation Modules

| Module                             | Computes                                       |
| ---------------------------------- | ---------------------------------------------- |
| `MembershipAnalyticsModule`        | Growth rates, top growth clubs, trends         |
| `ClubHealthAnalyticsModule`        | Health classification (Thriving/Vulnerable/IR) |
| `DistinguishedClubAnalyticsModule` | DCP goal analysis, projections                 |
| `LeadershipAnalyticsModule`        | Leadership effectiveness scores                |
| `DivisionAreaAnalyticsModule`      | Division/Area performance metrics              |
| `AreaDivisionRecognitionModule`    | DAP/DDP eligibility tracking                   |

### Ranking System

`BordaCountRankingCalculator` ranks districts across 3 metrics (membership, payments, DCP) using a Borda count algorithm — each metric ranks independently, then scores are summed for a fair composite rank.

---

## Infrastructure

| Service                           | Purpose                     | Config                                |
| --------------------------------- | --------------------------- | ------------------------------------- |
| **GCS** (`toast-stats-data-ca`)   | Data storage + CDN origin   | Workload Identity Federation          |
| **Cloud CDN** (`cdn.taverns.red`) | Serves all data to frontend | Immutable cache for snapshots         |
| **GitHub Pages / Vercel**         | Hosts the React SPA         | `ts.taverns.red`                      |
| **GitHub Actions**                | Data pipeline runtime       | WIF auth, 240-min timeout for rebuild |

### Authentication

GitHub Actions authenticates to GCP via Workload Identity Federation (no service account keys). Setup: `scripts/setup-wif.sh`.

---

## Key Design Decisions

See [product-spec.md](product-spec.md) for the decision table. ADRs for significant changes go in `docs/architecture-decisions/`.
