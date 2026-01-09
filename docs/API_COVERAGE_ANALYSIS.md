# API Coverage Analysis

**Date:** January 9, 2026  
**Status:** Current State Assessment  
**Scope:** Frontend-to-Backend API Alignment

---

## Executive Summary

This document analyzes the alignment between frontend API consumption and backend API availability. The analysis reveals two critical mismatches requiring immediate attention, along with several backend endpoints that exist for operational purposes but are not consumed by the frontend.

---

## Critical Issues

### 1. ~~Missing Backend Endpoint: `DELETE /api/districts/cache`~~ ✅ REMOVED

**Status:** Removed (2026-01-09)

The "Clear Cache" functionality has been removed from both frontend and backend. Clearing all historical snapshots is too destructive an action - historical data is valuable for trend analysis and comparisons.

### 2. ~~Endpoint Name Mismatch: `vulnerable-clubs` vs `at-risk-clubs`~~ ✅ FIXED

**Status:** Resolved (2026-01-09)

The backend endpoint has been renamed from `at-risk-clubs` to `vulnerable-clubs` to align with frontend expectations and internal terminology. Response fields also updated to use `totalVulnerableClubs` and `vulnerableClubs` instead of the old naming.

---

## Frontend API Usage (Complete List)

| Endpoint                                              | Hook/Component                     | Method      | Backend Status |
| ----------------------------------------------------- | ---------------------------------- | ----------- | -------------- |
| `/districts`                                          | `useDistricts.ts`                  | GET         | ✅ Exists      |
| `/districts/cache/dates`                              | `LandingPage.tsx`                  | GET         | ✅ Exists      |
| `/districts/rankings`                                 | `LandingPage.tsx`                  | GET         | ✅ Exists      |
| `/districts/cache`                                    | `LandingPage.tsx`                  | DELETE      | ❌ Removed     |
| `/districts/:districtId/statistics`                   | `useMembershipData.ts`             | GET         | ✅ Exists      |
| `/districts/:districtId/membership-history`           | `useMembershipData.ts`             | GET         | ✅ Exists      |
| `/districts/:districtId/clubs`                        | `useClubs.ts`                      | GET         | ✅ Exists      |
| `/districts/:districtId/clubs/:clubId/trends`         | `useClubTrends.ts`                 | GET         | ✅ Exists      |
| `/districts/:districtId/vulnerable-clubs`             | `useClubTrends.ts`                 | GET         | ✅ Exists      |
| `/districts/:districtId/cached-dates`                 | `useDistrictData.ts`               | GET         | ✅ Exists      |
| `/districts/:districtId/analytics`                    | `useDistrictAnalytics.ts`          | GET         | ✅ Exists      |
| `/districts/:districtId/leadership-insights`          | `useLeadershipInsights.ts`         | GET         | ✅ Exists      |
| `/districts/:districtId/distinguished-club-analytics` | `useDistinguishedClubAnalytics.ts` | GET         | ✅ Exists      |
| `/districts/:districtId/educational-awards`           | `useEducationalAwards.ts`          | GET         | ✅ Exists      |
| `/districts/:districtId/daily-reports`                | `useDailyReports.ts`               | GET         | ✅ Exists      |
| `/districts/:districtId/daily-reports/:date`          | `useDailyReports.ts`               | GET         | ✅ Exists      |
| `/districts/:districtId/rank-history`                 | `useRankHistory.ts`                | GET         | ✅ Exists      |
| `/districts/:districtId/backfill`                     | `useBackfill.ts`                   | POST        | ✅ Exists      |
| `/districts/:districtId/backfill/:backfillId`         | `useBackfill.ts`                   | GET, DELETE | ✅ Exists      |
| `/districts/backfill`                                 | `useBackfill.ts`                   | POST        | ✅ Exists      |
| `/districts/backfill/:backfillId`                     | `useBackfill.ts`                   | GET, DELETE | ✅ Exists      |
| `/admin/districts/config`                             | `useDistrictConfiguration.ts`      | GET, POST   | ✅ Exists      |
| `/admin/districts/config/:districtId`                 | `useDistrictConfiguration.ts`      | DELETE      | ✅ Exists      |

---

## Backend-Only Endpoints (Not Used by Frontend)

These endpoints exist in the backend but are not consumed by the current frontend. They serve operational, debugging, or future-use purposes.

### District Analytics (Unused)

| Endpoint                                | Purpose                       | Recommendation                |
| --------------------------------------- | ----------------------------- | ----------------------------- |
| `GET /:districtId/membership-analytics` | Detailed membership analytics | Consider frontend integration |
| `GET /:districtId/year-over-year/:date` | YoY comparison                | Consider frontend integration |
| `GET /:districtId/export`               | CSV export                    | Consider frontend integration |

### Admin Snapshot Management

| Endpoint                                   | Purpose            | Recommendation                     |
| ------------------------------------------ | ------------------ | ---------------------------------- |
| `GET /admin/snapshots`                     | List all snapshots | Operational - keep for admin tools |
| `GET /admin/snapshots/:snapshotId`         | Inspect snapshot   | Operational - keep for admin tools |
| `GET /admin/snapshots/:snapshotId/payload` | Full snapshot data | Operational - keep for admin tools |

### Admin Monitoring

| Endpoint                                       | Purpose              | Recommendation                    |
| ---------------------------------------------- | -------------------- | --------------------------------- |
| `GET /admin/snapshot-store/health`             | Health check         | Operational - keep for monitoring |
| `GET /admin/snapshot-store/integrity`          | Integrity validation | Operational - keep for monitoring |
| `GET /admin/snapshot-store/performance`        | Performance metrics  | Operational - keep for monitoring |
| `POST /admin/snapshot-store/performance/reset` | Reset metrics        | Operational - keep for monitoring |

### Admin Process Separation

| Endpoint                                     | Purpose                 | Recommendation                    |
| -------------------------------------------- | ----------------------- | --------------------------------- |
| `GET /admin/process-separation/validate`     | Validate separation     | Operational - keep for compliance |
| `GET /admin/process-separation/monitor`      | Monitor operations      | Operational - keep for compliance |
| `GET /admin/process-separation/compliance`   | Compliance metrics      | Operational - keep for compliance |
| `GET /admin/process-separation/independence` | Independence validation | Operational - keep for compliance |

### Admin District Configuration (Unused)

| Endpoint                                | Purpose               | Recommendation                |
| --------------------------------------- | --------------------- | ----------------------------- |
| `POST /admin/districts/config/validate` | Validate config       | Consider frontend integration |
| `GET /admin/districts/config/history`   | Config change history | Consider frontend integration |

---

## Recommendations for Continued Evolution

### Immediate Actions (Priority 1)

1. ~~**Fix `DELETE /api/districts/cache`**~~ ✅ REMOVED
   - Functionality removed - clearing all historical data is too destructive

2. ~~**Fix `vulnerable-clubs` naming**~~ ✅ DONE
   - Renamed backend endpoint from `at-risk-clubs` to `vulnerable-clubs`
   - Updated response fields to match frontend expectations

### Short-Term Improvements (Priority 2)

3. **Add API Contract Testing**
   - Implement contract tests that verify frontend expectations match backend reality
   - Consider using a tool like Pact or simple TypeScript type sharing
   - This would have caught both critical issues automatically

4. **Create OpenAPI Specification**
   - Document all endpoints in OpenAPI/Swagger format
   - Generate TypeScript types from the spec for both frontend and backend
   - Enables automated drift detection

### Medium-Term Enhancements (Priority 3)

5. **Frontend Admin Dashboard**
   - Consider building an admin UI that consumes the monitoring endpoints
   - Endpoints exist: health, integrity, performance, process separation
   - Would provide operational visibility without CLI access

6. **Export Functionality**
   - The `/:districtId/export` endpoint exists but isn't used
   - Consider adding CSV export buttons to relevant frontend views

7. **Year-over-Year Comparison**
   - The `/:districtId/year-over-year/:date` endpoint exists
   - Consider adding YoY comparison views to the analytics pages

### Long-Term Architecture (Priority 4)

8. **API Versioning Strategy**
   - Current API has no versioning
   - Consider `/api/v1/` prefix for future breaking changes
   - Allows gradual migration without breaking existing clients

9. **Deprecation Process**
   - Establish a process for deprecating unused endpoints
   - The backend-only endpoints should be reviewed periodically
   - Remove truly unused code to reduce maintenance burden

10. **Shared Types Package**
    - Extract API types into a shared package
    - Both frontend and backend import from the same source
    - Compile-time guarantees of API alignment

---

## Appendix: File Locations

### Frontend API Layer

- `frontend/src/services/api.ts` - Axios client configuration
- `frontend/src/hooks/use*.ts` - React Query hooks for each endpoint

### Backend Route Modules

- `backend/src/routes/districts/core.ts` - Core district endpoints
- `backend/src/routes/districts/analytics.ts` - Analytics endpoints
- `backend/src/routes/districts/backfill.ts` - Backfill operations
- `backend/src/routes/districts/snapshots.ts` - Snapshot/cache endpoints
- `backend/src/routes/admin/district-config.ts` - District configuration
- `backend/src/routes/admin/monitoring.ts` - Monitoring endpoints
- `backend/src/routes/admin/process-separation.ts` - Process separation
- `backend/src/routes/admin/snapshots.ts` - Admin snapshot management

---

## Change Log

| Date       | Author   | Change                    |
| ---------- | -------- | ------------------------- |
| 2026-01-09 | Analysis | Initial document creation |
