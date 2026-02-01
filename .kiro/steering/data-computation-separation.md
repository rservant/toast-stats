# Data Computation Separation Steering Document

**Status:** Authoritative  
**Applies to:** All backend and scraper-cli code  
**Audience:** All developers and automation agents (including Kiro)  
**Owner:** Development Team

---

## 1. Purpose

This document defines **mandatory architectural boundaries** for data computation in this codebase.

Its goals are to:

- Enforce strict separation between data computation and data serving
- Ensure the backend remains a pure read-only API server
- Consolidate all data computation in the scraper-cli pipeline
- Prevent performance degradation from on-demand computation
- Maintain sub-10ms API response times

This document is **normative**.

The keywords **MUST**, **MUST NOT**, **SHOULD**, and **MAY** are to be interpreted as described in RFC 2119.

Kiro MUST treat this document as the **primary source of truth** for all decisions about where data computation occurs.

---

## 2. Authority Model

In the event of conflict, data computation rules MUST be applied according to the following precedence order (highest first):

1. **This Steering Document**
2. `docs/BACKEND_ARCHITECTURE.md`
3. Existing implementation patterns
4. Developer convenience

Lower-precedence sources MUST NOT weaken higher-precedence rules.

---

## 3. Core Architectural Principle

The system operates on a **two-process architecture** with strict separation:

### Scraper CLI (`packages/scraper-cli/`)

**Role:** Data acquisition AND computation

- Scrapes data from Toastmasters dashboard
- Transforms raw CSV to structured JSON
- Computes ALL analytics, rankings, and derived data
- Writes pre-computed files to storage

### Backend (`backend/`)

**Role:** Data serving ONLY

- Reads pre-computed files from storage
- Serves data via REST API
- Performs NO computation beyond basic response formatting
- Returns errors when pre-computed data is missing

---

## 4. Prohibited Patterns in Backend

### 4.1 On-Demand Computation

The backend MUST NOT perform any on-demand data computation.

```typescript
// ❌ FORBIDDEN - Computing rankings on request
router.get('/rankings', async (req, res) => {
  const districts = await storage.getDistricts()
  const rankings = calculateRankings(districts) // FORBIDDEN
  res.json(rankings)
})

// ✅ CORRECT - Serving pre-computed rankings
router.get('/rankings', async (req, res) => {
  const rankings = await storage.readAllDistrictsRankings(snapshotId)
  if (!rankings) {
    return res.status(500).json({ error: 'Rankings data not found' })
  }
  res.json(rankings)
})
```

### 4.2 Analytics Calculation

The backend MUST NOT calculate analytics.

```typescript
// ❌ FORBIDDEN - Computing analytics on request
const analytics = analyticsEngine.computeDistrictAnalytics(districtData)

// ✅ CORRECT - Reading pre-computed analytics
const analytics = await preComputedAnalyticsReader.readDistrictAnalytics(
  snapshotId,
  districtId
)
```

### 4.3 Data Transformation

The backend MUST NOT transform raw data into derived formats.

```typescript
// ❌ FORBIDDEN - Transforming CSV to statistics
const stats = transformCSVToStatistics(rawCSV)

// ✅ CORRECT - Reading pre-transformed data
const stats = await storage.readDistrictData(snapshotId, districtId)
```

### 4.4 Aggregation Operations

The backend MUST NOT aggregate data across districts or time periods.

```typescript
// ❌ FORBIDDEN - Aggregating across snapshots
const history = snapshots.map(s => extractRankingForDistrict(s, districtId))

// ✅ CORRECT - Reading pre-computed history
const history = await storage.readRankHistory(districtId)
```

---

## 5. Required Patterns in Backend

### 5.1 Pre-Computed File Reading

All data MUST be served from pre-computed files.

```typescript
// Required pattern for all data endpoints
async function serveData(snapshotId: string, dataType: string) {
  const data = await storage.readPreComputedData(snapshotId, dataType)
  
  if (!data) {
    // Return informative error - do NOT compute on demand
    return {
      error: {
        code: 'DATA_NOT_FOUND',
        message: `Pre-computed ${dataType} not found`,
        details: 'Run scraper-cli to generate this data',
      },
    }
  }
  
  return data
}
```

### 5.2 Missing Data Handling

When pre-computed data is missing, the backend MUST:

1. Return an appropriate error code (404 or 500)
2. Include a message indicating the data needs to be generated
3. NOT attempt to compute the data on demand

### 5.3 Schema Version Validation

The backend SHOULD validate schema versions of pre-computed files:

```typescript
const data = await storage.readPreComputedData(snapshotId, dataType)

if (data && !isCompatibleSchemaVersion(data.schemaVersion)) {
  return {
    error: {
      code: 'SCHEMA_VERSION_MISMATCH',
      message: 'Pre-computed data has incompatible schema version',
    },
  }
}
```

---

## 6. Required Patterns in Scraper CLI

### 6.1 Complete Data Pipeline

The scraper-cli MUST generate ALL data files required by the backend:

| Data Type | File Location | Generator |
|-----------|---------------|-----------|
| District Statistics | `snapshots/{date}/district_{id}.json` | `transform` command |
| All-Districts Rankings | `snapshots/{date}/all-districts-rankings.json` | `transform` command |
| District Analytics | `snapshots/{date}/analytics/district_{id}_analytics.json` | `compute-analytics` command |
| Rank History | `snapshots/{date}/rank-history/{id}.json` | `compute-analytics` command |

### 6.2 Atomic File Generation

All pre-computed files MUST be generated atomically:

```typescript
// Write to temp file, then rename
await fs.writeFile(tempPath, JSON.stringify(data))
await fs.rename(tempPath, finalPath)
```

### 6.3 Metadata Inclusion

All pre-computed files MUST include metadata:

```typescript
interface PreComputedFile<T> {
  schemaVersion: string      // For compatibility checking
  computedAt: string         // ISO timestamp
  checksum?: string          // Optional integrity check
  data: T                    // The actual data
}
```

---

## 7. Data Files Required by Backend

The following files MUST be generated by scraper-cli for each snapshot:

### 7.1 Core Snapshot Files

- `metadata.json` - Snapshot metadata
- `manifest.json` - List of districts in snapshot
- `district_{id}.json` - Per-district statistics (one per district)

### 7.2 Rankings Files

- `all-districts-rankings.json` - Global rankings for all districts

### 7.3 Analytics Files (in `analytics/` subdirectory)

- `manifest.json` - Analytics manifest with checksums
- `district_{id}_analytics.json` - Per-district analytics

### 7.4 Historical Data Files

- Rank history data (format TBD based on implementation)

---

## 8. Migration Requirements

### 8.1 Existing Backend Computation

Any existing computation in the backend MUST be migrated to scraper-cli:

1. Identify computation logic in backend
2. Move computation to `packages/analytics-core/` (shared package)
3. Call from scraper-cli pipeline
4. Update backend to read pre-computed files
5. Remove computation code from backend

### 8.2 New Features

New features requiring data computation MUST:

1. Implement computation in `packages/analytics-core/`
2. Add generation step to scraper-cli pipeline
3. Add file reading to backend
4. Document the new file format

---

## 9. Enforcement

### 9.1 Code Review Requirements

Pull requests MUST be rejected if they:

- Add computation logic to backend route handlers
- Add analytics calculation to backend services
- Add data transformation to backend code
- Bypass pre-computed file reading

### 9.2 Acceptable Backend Operations

The following operations ARE permitted in the backend:

- Reading files from storage
- JSON parsing and serialization
- Response formatting (adding metadata, filtering fields)
- Error handling and logging
- Cache management (in-memory caching of read files)
- Schema version validation

### 9.3 Unacceptable Backend Operations

The following operations are FORBIDDEN in the backend:

- Ranking calculations
- Analytics computation
- Statistical aggregations
- Data transformations beyond simple field selection
- Cross-snapshot data correlation
- Any operation that could take more than 100ms

---

## 10. Performance Requirements

### 10.1 Backend Response Times

- P50 response time: < 10ms
- P95 response time: < 50ms
- P99 response time: < 100ms

These targets are ONLY achievable with pre-computed data serving.

### 10.2 Computation Budget

The backend has a computation budget of **0ms** for data computation.

All computation time MUST be spent in the scraper-cli pipeline.

---

## 11. Error Messages

When pre-computed data is missing, use these standard error messages:

```typescript
// Rankings not found
{
  code: 'RANKINGS_DATA_NOT_FOUND',
  message: 'Rankings data not found in snapshot',
  details: 'The snapshot does not contain all-districts-rankings data. Run scraper-cli to generate rankings.',
}

// Analytics not found
{
  code: 'ANALYTICS_NOT_FOUND',
  message: 'Pre-computed analytics not found',
  details: 'Run scraper-cli compute-analytics to generate analytics files.',
}

// District data not found
{
  code: 'DISTRICT_NOT_FOUND',
  message: 'District data not found in snapshot',
  details: 'The requested district is not included in this snapshot.',
}
```

---

## 12. Final Rules

> **The backend is a read-only API server.**  
> **All computation happens in scraper-cli.**  
> **Pre-computed files are the contract between scraper-cli and backend.**  
> **Missing data is an error, not a trigger for computation.**  
> **Sub-10ms response times are non-negotiable.**

