# Assessment Module Data Integration Plan

**Date**: November 26, 2025  
**Status**: Planning Phase  
**Objective**: Integrate real Toastmasters data from backend cache into assessment module

---

## Executive Summary

The assessment module currently operates in isolation, accepting manual data entry via API. This plan **eliminates manual entry entirely** and integrates it with the existing **DistrictCacheManager** and **DistrictBackfillService** to:

1. **Auto-populate** ALL assessment data from real cached district data (100% automated)
2. **Source data from**:
   - `districts_YYYY-MM-DD.json` → membership payments, paid clubs, distinguished clubs
   - `Club.aspx` CSV cache → CSP submissions (new)
3. **Remove manual entry capability** for all four metrics
4. **Make assessments read-only** once created from real data
5. **Maintain audit trail** of assessment generation with data source & timestamp

**Benefits**:

- ✅ 100% data accuracy - no manual entry errors possible
- ✅ Real-time data sync - reflects official Toastmasters data
- ✅ Complete automation - no user data entry required
- ✅ Immutable assessments - historical data integrity
- ✅ Simplified workflow - one-step assessment generation

---

## Architecture Overview

### Current State: Isolated

```
Assessment Module                    Backend Cache System
├─ Manual Entry (API)               ├─ DistrictBackfillService
├─ Local Config Files               ├─ DistrictCacheManager
├─ File-based Storage               ├─ Cache: districts_YYYY-MM-DD.json
└─ No External Integration          └─ Real Toastmasters Data
```

### Future State: Integrated

```
Assessment Module                    Backend Cache System
├─ Manual Entry (API)               ├─ DistrictBackfillService
├─ Auto-Population Service          ├─ DistrictCacheManager
├─ Validation Service               ├─ Cache: districts_YYYY-MM-DD.json
├─ Reconciliation Service           └─ Real Toastmasters Data
└─ Variance Tracking                    ↓
     └─ Reconciliation Endpoints    Feeds Into Assessment
```

---

## Data Mapping

### Real Data Sources (Both Cached)

**Source 1: District Rankings Cache**

- **File**: `backend/cache/districts_YYYY-MM-DD.json`
- **Structure**: Array of district rankings with aggregated metrics
- **Update Frequency**: Daily via DistrictBackfillService
- **Contains**: paidClubs, totalPayments, distinguishedClubs, growth percentages

**Source 2: Club Performance Cache**

- **File**: Stored in DistrictCacheManager, derived from `Club.aspx` CSV
- **Structure**: CSV parsed into array of club records
- **Update Frequency**: Daily alongside district data
- **Contains**: Individual club data including CSP submission status
- **Columns Include**: Club name, membership, CSP achieved status, payment info
- **CSP Calculation**: Count clubs with CSP achieved = true (or "Competent" status)

### Data Mapping (All Automated - No Manual Entry)

| Assessment Field          | Real Data Source     | Cache File                                                              | Calculation                                |
| ------------------------- | -------------------- | ----------------------------------------------------------------------- | ------------------------------------------ |
| `membership_payments_ytd` | `totalPayments`      | `districts_YYYY-MM-DD.json` → `rankings[districtId].totalPayments`      | Direct read                                |
| `paid_clubs_ytd`          | `paidClubs`          | `districts_YYYY-MM-DD.json` → `rankings[districtId].paidClubs`          | Direct read                                |
| `distinguished_clubs_ytd` | `distinguishedClubs` | `districts_YYYY-MM-DD.json` → `rankings[districtId].distinguishedClubs` | Direct read                                |
| `csp_submissions_ytd`     | Club CSP Status      | Club.aspx CSV (cached) → Count CSP-achieved clubs                       | `clubs.filter(c => c.csp_achieved).length` |

### Assessment Data Model (Updated - Read-Only)

**File**: `backend/src/modules/assessment/storage/data/assessment_*.json`

````typescript
interface MonthlyAssessment {
  // Primary keys
  district_number: number;
  program_year: string;
  month: string;

  // All four metrics from real data (read-only)
  membership_payments_ytd: number;      // From districts cache
  paid_clubs_ytd: number;               // From districts cache
  distinguished_clubs_ytd: number;      // From districts cache
  csp_submissions_ytd: number;          // NEW: From Club.aspx CSV

  // Data source tracking
  data_sources: {
    membership_payments: {
      source: 'DistrictBackfillService';
      cache_file: string;  // e.g., 'districts_2024-07-31.json'
      cache_date: string;  // e.g., '2024-07-31'
    };
    paid_clubs: {
      source: 'DistrictBackfillService';
      cache_file: string;
      cache_date: string;
    };
    distinguished_clubs: {
      source: 'DistrictBackfillService';
      cache_file: string;
      cache_date: string;
    };
    csp_submissions: {
      source: 'DistrictBackfillService (Club.aspx CSV)';
      cache_file: string;  // Reference to Club.aspx cache
      cache_date: string;
      csv_row_count: number;  // Number of clubs processed
    };
  };

  // Audit trail
  generated_at: string;     // ISO 8601 timestamp
  generated_from_cache_date: string;  // Which day's cache was used

  // Read-only flag
  read_only: true;          // Always true - no user modifications
}

---

## Implementation Plan

### Phase 1: Data Access & CSP Extraction Layer (Week 1)

#### 1.1 Create CacheIntegrationService
**File**: `backend/src/modules/assessment/services/cacheIntegrationService.ts`

**Responsibilities**:
- Access DistrictCacheManager to retrieve cached district data
- Access cached Club.aspx CSV to extract CSP counts
- Parse club performance data and count CSP submissions
- Provide type-safe, complete data access for all 4 metrics

**API**:
```typescript
class CacheIntegrationService {
  // Get ALL assessment data from cache for a district on a specific date
  // Returns: { membership_payments, paid_clubs, distinguished_clubs, csp_submissions }
  async getCompleteAssessmentDataByDate(
    districtId: string,
    date: string
  ): Promise<CompleteAssessmentData | null>

  // Get latest available cache date for a district
  getLatestCacheDate(districtId: string): Promise<string | null>

  // Parse club performance CSV and extract CSP count
  async extractCspCount(
    districtId: string,
    date: string
  ): Promise<{ csp_count: number; total_clubs: number; csv_source: string }>
}
````

**Key Features**:

- Unified access to both cache sources (districts + club CSV)
- Extract CSP submissions by parsing club performance records
- Error handling for missing files (fallback to cached files list)
- Type safety with complete TypeScript interfaces
- Metadata tracking: source files, timestamps, record counts

#### 1.2 Create CSP Extraction Logic

**File**: `backend/src/modules/assessment/services/cspExtractorService.ts`

**Responsibilities**:

- Parse Club.aspx CSV data
- Identify CSP submission column
- Count clubs with CSP achieved status
- Handle various CSP field name variations (csv-parse may have different column names)

**Logic**:

```typescript
class CspExtractorService {
  // Parse club CSV and count CSP submissions
  extractCspCount(clubRecords: any[]): {
    csp_count: number
    clubs_with_csp: any[]
    total_clubs: number
    csp_field_name: string // Actual column name found
  }

  // Identify CSP column - handles variations
  // Looks for: "CSP", "Competent Toastmaster Speaker Program", "csp_achieved", etc.
  private findCspColumn(headers: string[]): string | null
}
```

**CSP Identification**:

- Looks for columns containing: "CSP", "Competent", "Speaker Program", "achieved", "submitted"
- Case-insensitive matching
- Accepts variations: "Yes"/"No", "True"/"False", "X"/"", numeric (1/0)

#### 1.3 Create Assessment Generation Service

**File**: `backend/src/modules/assessment/services/assessmentGenerationService.ts`

**Responsibilities**:

- Orchestrate data collection from both cache sources
- Create assessment records from real data
- Track data sources and timestamps
- No user input - purely algorithmic

**API**:

```typescript
class AssessmentGenerationService {
  // Generate assessment from cache data
  async generateMonthlyAssessment(
    districtId: string,
    programYear: string,
    month: string,
    cacheDate?: string // Optional: specific date; else use latest
  ): Promise<MonthlyAssessment>
}
```

---

### Phase 2: New API Endpoints (Week 1-2)

#### 2.1 Generate Assessment Endpoint (NEW - Replaces Manual Entry)

**Endpoint**: `POST /api/assessment/generate`

**Request**:

```json
{
  "district_number": 61,
  "program_year": "2024-2025",
  "month": "July",
  "cache_date": "2024-07-31"
}
```

**Response**:

```json
{
  "success": true,
  "data": {
    "assessment": {
      "district_number": 61,
      "program_year": "2024-2025",
      "month": "July",
      "membership_payments_ytd": 8136,
      "paid_clubs_ytd": 161,
      "distinguished_clubs_ytd": 109,
      "csp_submissions_ytd": 45,
      "read_only": true,
      "generated_at": "2024-08-01T10:30:00Z",
      "generated_from_cache_date": "2024-07-31",
      "data_sources": {
        "membership_payments": {
          "source": "DistrictBackfillService",
          "cache_file": "districts_2024-07-31.json",
          "cache_date": "2024-07-31"
        },
        "paid_clubs": {
          "source": "DistrictBackfillService",
          "cache_file": "districts_2024-07-31.json",
          "cache_date": "2024-07-31"
        },
        "distinguished_clubs": {
          "source": "DistrictBackfillService",
          "cache_file": "districts_2024-07-31.json",
          "cache_date": "2024-07-31"
        },
        "csp_submissions": {
          "source": "DistrictBackfillService (Club.aspx CSV)",
          "cache_file": "club_performance_2024-07-31.csv",
          "cache_date": "2024-07-31",
          "csv_row_count": 163,
          "csp_field_name": "CSP Achieved"
        }
      }
    }
  }
}
```

**Behavior**:

- Zero user input required - all data comes from cache
- Queries both district cache and club performance CSV
- Extracts CSP count from cached club records
- Creates read-only assessment record
- Includes full data lineage for audit trail
- Returns all 4 metrics automatically populated

#### 2.2 List Available Cache Dates Endpoint

**Endpoint**: `GET /api/assessment/available-dates/:districtId`

**Response**:

```json
{
  "success": true,
  "data": {
    "district_id": "61",
    "available_dates": [
      {
        "date": "2024-07-31",
        "has_district_data": true,
        "has_club_data": true,
        "club_count": 163,
        "data_completeness": "complete"
      },
      {
        "date": "2024-07-30",
        "has_district_data": true,
        "has_club_data": true,
        "club_count": 163,
        "data_completeness": "complete"
      }
    ],
    "recommended_date": "2024-07-31"
  }
}
```

**Behavior**:

- Shows which dates have complete cache data for a district
- Indicates if club performance CSV is available
- Helps users understand data availability
- Recommends latest complete date

#### 2.3 Get Assessment Details (Enhanced)

**Endpoint**: `GET /api/assessment/monthly/:districtId/:programYear/:month`

**Response** (includes full data lineage):

```json
{
  "success": true,
  "data": {
    "assessment": {
      /* full assessment object */
    },
    "audit_trail": {
      "generated_at": "2024-08-01T10:30:00Z",
      "generated_from_cache_date": "2024-07-31",
      "cache_age_days": 1,
      "data_sources": {
        /* as shown above */
      }
    },
    "read_only": true,
    "immutable": true
  }
}
```

#### 2.4 Delete Assessment (Remove Old Generated Records)

**Endpoint**: `DELETE /api/assessment/monthly/:districtId/:programYear/:month`

**Behavior**:

- Only allows deletion if assessment was auto-generated
- Marked as "generated" in record
- Soft delete (keeps audit trail)
- Can regenerate from cache

**Note**: Manual edits NOT supported - assess ments are immutable once generated

---

### Phase 3: Enhanced Assessment Routes (Week 2)

#### 3.1 Update POST /api/assessment/monthly (DEPRECATED)

**Change**: This endpoint is NOW read-only. Use `POST /api/assessment/generate` instead.

**New Behavior**: POST /api/assessment/monthly now:

- Accepts NO user-submitted data
- Only generates assessment from cache
- Rejects attempts to submit manual data
- Returns 400 Bad Request if manual fields provided

```typescript
router.post('/monthly', async (req: Request, res: Response) => {
  // NEW: Check if manual data was submitted
  if (
    req.body.membership_payments_ytd !== undefined &&
    !req.body._auto_generated
  ) {
    return res.status(400).json({
      error: {
        code: 'MANUAL_ENTRY_NOT_SUPPORTED',
        message:
          'Manual entry disabled. Use POST /api/assessment/generate for automated assessment creation.',
        suggestion:
          'POST /api/assessment/generate with district_number, program_year, month, cache_date',
      },
    })
  }

  // This route is now for auto-generation only
  return res.status(301).json({
    error: 'Use POST /api/assessment/generate instead',
  })
})
```

#### 3.2 New Workflow: Assessment Generation via Service

**Flow**:

```
User wants assessment for District 61, July 2024

1. Call GET /api/assessment/available-dates/61
   ↓ Response: Latest available cache date is 2024-07-31

2. Call POST /api/assessment/generate
   Request: {
     "district_number": 61,
     "program_year": "2024-2025",
     "month": "July",
     "cache_date": "2024-07-31"
   }
   ↓
3. Backend:
   a. Load district data from: districts_2024-07-31.json
   b. Load club CSV from: cached Club.aspx data
   c. Extract metrics:
      - membership_payments_ytd: 8136
      - paid_clubs_ytd: 161
      - distinguished_clubs_ytd: 109
      - csp_submissions_ytd: 45 (count of CSP-achieved clubs)
   d. Create immutable record
   e. Store with full audit trail
   ↓
4. Return assessment with data lineage
   {
     "assessment": { all 4 metrics, read_only: true },
     "data_sources": { complete lineage }
   }

5. Assessment is IMMUTABLE - no edits allowed
```

---

### Phase 4: Frontend Integration (Week 2-3)

#### 4.1 Create Assessment Generation UI (Replaces Form)

**Changes**: Remove manual entry form entirely. Replace with generation interface.

**New UI**:

1. District & Month Selector (date picker)
2. "Check Available Dates" button
3. Shows cached data availability with freshness
4. "Generate Assessment" button (one-click automation)
5. Auto-populated display of generated values (read-only)
6. Data source/lineage view
7. Success confirmation with timestamp

**No Forms**: Zero user data entry capability

**User Flow**:

```
1. Select district: 61
2. Select month: July
3. Select program year: 2024-2025
4. Click "Check Available Dates"
   → Shows: Latest cache date 2024-07-31, all metrics available
5. Click "Generate Assessment"
   → Backend generates from cache
   → Shows all 4 metrics populated automatically
   → Displays: Source files, timestamps, data lineage
6. Assessment created (immutable)
```

#### 4.2 Assessment History/Audit View

**New Component**: AssessmentHistory

**Shows**:

- List of all generated assessments
- Generation date & cache date used
- Data freshness at generation time
- Full audit trail for each assessment
- Option to regenerate with different cache date
- Can delete and regenerate if cache updates

**No Edit UI**: Assessments are read-only

---

### Phase 5: Storage & Immutability (Week 1)

#### 5.1 Assessment Storage (No Modifications Allowed)

**File**: `backend/src/modules/assessment/storage/assessmentStore.ts`

**Updated CRUD**:

```typescript
class AssessmentStore {
  // Create from auto-generated data only
  async addMonthlyAssessment(assessment: MonthlyAssessment): Promise<void>

  // Retrieve (read-only)
  async getMonthlyAssessment(
    districtId: number,
    programYear: string,
    month: string
  ): Promise<MonthlyAssessment | null>

  // Delete old records (for cache updates/regeneration)
  async deleteMonthlyAssessment(
    districtId: number,
    programYear: string,
    month: string
  ): Promise<void>

  // No update() method - immutable after creation
  // No patch() method - immutable after creation

  // Get audit trail
  async getAuditTrail(
    districtId: number,
    programYear: string,
    month: string
  ): Promise<{
    created_at: string
    generated_from_cache_date: string
    cache_files_used: string[]
    data_lineage: any
  }>
}
```

**Storage Structure** (unchanged except read-only flag):

```
backend/src/modules/assessment/storage/data/
├── assessment_61_2024-2025_July.json (immutable)
├── assessment_61_2024-2025_August.json (immutable)
└── goals_61_2024-2025.json (existing, unchanged)
```

---

## Service Dependencies

### New Services to Create

1. **CacheIntegrationService** - Read district & club data from cache
2. **CspExtractorService** - Parse club CSV, count CSP submissions
3. **AssessmentGenerationService** - Orchestrate assessment creation from cache

### Dependencies

```
AssessmentGenerationService
  ├─ depends on CacheIntegrationService
  ├─ depends on CspExtractorService
  └─ depends on assessmentStore

CacheIntegrationService
  ├─ imports DistrictCacheManager (existing)
  ├─ reads from backend/cache/districts_*.json
  └─ reads from cached Club.aspx CSV

CspExtractorService
  ├─ parses CSV format
  └─ identifies CSP field column
```

---

## Configuration

### 5.1 CSP Field Mapping

**File**: `backend/src/modules/assessment/config/cspMapping.json`

```json
{
  "csv_columns_to_check": [
    "CSP Achieved",
    "CSP",
    "Competent Toastmaster Speaker Program",
    "Speaker Program Achieved",
    "competent_speaker_program",
    "csp_achieved",
    "achievement_status"
  ],
  "valid_true_values": ["Yes", "TRUE", "true", "X", "1", "achieved"],
  "valid_false_values": ["No", "FALSE", "false", " ", "0", "not_achieved", ""]
}
```

---

## Testing Strategy

### Phase 1: Unit Tests

- **CacheIntegrationService**: Mock cache data, test retrieval
- **DataReconciliationService**: Test variance calculations
- **ReconciliationStore**: Test CRUD operations

### Phase 2: Integration Tests

- Test cache access with real files
- Test reconciliation workflow end-to-end
- Test API endpoints with mock cache data

### Phase 3: E2E Tests

- Frontend form interaction with auto-population
- Variance flagging and display
- Approval workflow

### Test Data

```
backend/src/modules/assessment/__tests__/fixtures/
├── mock_cache_district_82.json
├── mock_cache_district_94.json
└── sample_assessments.json
```

---

## Rollout Plan

### Week 1: Foundation & Services

- [ ] Create CacheIntegrationService (district & club data access)
- [ ] Create CspExtractorService (CSP counting logic)
- [ ] Create AssessmentGenerationService (orchestration)
- [ ] Create CSP field mapping config
- [ ] Write unit tests for all services
- [ ] Update assessmentStore for immutability

### Week 2: API & Integration

- [ ] Add POST /api/assessment/generate endpoint
- [ ] Add GET /api/assessment/available-dates endpoint
- [ ] Deprecate POST /api/assessment/monthly (manual entry)
- [ ] Update existing GET endpoints with data lineage
- [ ] Write integration tests with real cache files
- [ ] Verify CSP extraction accuracy

### Week 3: Frontend Integration

- [ ] Create AssessmentGeneration component
- [ ] Add district/month/year selector
- [ ] Add "Check Available Dates" functionality
- [ ] Add "Generate Assessment" button
- [ ] Create AssessmentHistory component
- [ ] Add audit trail display
- [ ] Write E2E tests

### Week 4: Polish & Documentation

- [ ] Performance optimization (cache lookups)
- [ ] Error handling refinement
- [ ] Migration script for existing assessments
- [ ] Documentation updates
- [ ] User acceptance testing

---

## Error Handling

### Cache Unavailable (Critical Error - Generation Fails)

```typescript
if (!districtData || !clubData) {
  throw new Error('Cache data unavailable - cannot generate assessment')
  // Generation fails. User must wait for next cache update or try different date.
}
```

### Missing CSP Field in CSV

```typescript
if (!cspField) {
  // Try variations: "CSP", "Competent", "Speaker Program Achieved"
  // If still not found:
  throw new Error(
    'CSP field not found in Club.aspx CSV - cannot extract CSP count'
  )
  // Generation fails until CSV format is identified
}
```

### Invalid Date/No Cache for Date

```typescript
if (!cacheAvailable) {
  throw new Error(`No cache data available for ${date}`)
  // Return available dates so user can choose valid one
}
```

---

## Success Metrics

### Phase 1-2 (Foundation & API)

- ✅ All new services have >80% test coverage
- ✅ All endpoints return proper responses with data lineage
- ✅ Cache lookups complete in <100ms
- ✅ CSP extraction accuracy >99% (tested against known samples)
- ✅ Generate endpoint returns all 4 metrics 100% populated from real data

### Phase 3 (Frontend)

- ✅ Users can generate with zero data entry (one click)
- ✅ All metrics auto-populated from cache (100% automation)
- ✅ Data lineage clearly displayed (source files, timestamps)
- ✅ No manual entry capability (impossible to override)

### Overall

- ✅ 100% of assessments contain accurate real data
- ✅ 0% manual entry (complete elimination of manual capability)
- ✅ <50ms generation time average
- ✅ 100% immutability (no edit/update capability)
- ✅ Complete audit trail for every assessment (source + timestamp)
- ✅ 100% CSP accuracy (real count from club CSV)

---

## Future Enhancements

### Phase 6: Advanced Features (Post-Launch)

1. **Additional Real Data Metrics**
   - Add more metrics as they become available in Toastmasters cache
   - Potential: Member satisfaction scores, retention rates, training hours
   - Enriches assessments without adding manual burden

2. **Trend Analysis**
   - Historical comparison across months/years
   - Identify growth patterns vs baseline
   - Predictive alerts (e.g., "membership declining trend detected")

3. **Bulk Operations**
   - Generate multiple assessments for multiple districts at once
   - Batch API for reporting workflows
   - Export assessments in multiple formats (PDF, CSV, JSON)

4. **Admin Tools**
   - Dashboard showing assessment generation status per district
   - CSP field mapping inspector/debugger
   - Cache freshness monitoring
   - Manual regeneration tools for specific dates

5. **Integration with Reporting Systems**
   - Webhook notifications when new assessments generated
   - Feed assessments to district dashboards
   - Integration with district reporting platforms

---

## Risk Assessment

### Risk: Cache Data Unavailable During Generation

- **Probability**: Medium (backfill jobs may occasionally fail)
- **Impact**: Users cannot generate assessments until cache is restored
- **Mitigation**:
  - Comprehensive error messages showing available cache dates
  - Automated alerts when cache is stale (>24h old)
  - Retry endpoint for manual cache refresh
- **Owner**: DevOps + Backend

### Risk: CSP Field Format Variations Across Districts

- **Probability**: Medium (Toastmasters CSV formats may vary by region)
- **Impact**: CSP extraction may fail or count incorrectly for some districts
- **Mitigation**:
  - Flexible column name matching (CSP, "CSP Achieved", "Competent Speaker", etc.)
  - Admin tool to inspect and update CSP field mapping per district
  - Validation: auto-detect unknown formats and alert
- **Owner**: Backend + Admin

### Risk: User Confusion About Data Immutability

- **Probability**: Low (UI makes read-only nature clear)
- **Impact**: Users may attempt to edit assessments and get errors
- **Mitigation**:
  - Clear messaging in UI ("This assessment was auto-generated from Toastmasters data")
  - Delete + regenerate workflow if data changes (clear UX pattern)
  - Audit trail always visible
- **Owner**: Product/UX

### Risk: Large CSV Processing Performance

- **Probability**: Low (CSP extraction is O(n) on club count)
- **Impact**: Generation may be slow for large districts (200+ clubs)
- **Mitigation**:
  - Cache CSP extraction results when possible
  - Monitor generation times; optimize if >500ms
  - Async generation with queue if performance becomes issue
- **Owner**: Backend

---

## Documentation TODO

- [ ] User guide for auto-generation feature
- [ ] API documentation for generation endpoints
- [ ] Architecture diagram showing full integration
- [ ] CSP field mapping configuration guide
- [ ] Troubleshooting guide for cache issues
- [ ] Migration guide for existing assessments

---

## Questions & Decisions

### Decision: Full Automation - No Manual Entry

- **Q**: Should assessment system allow ANY manual data entry?
- **Status**: ✅ DECIDED - No manual entry allowed
- **Rationale**: Real data from Toastmasters cache is authoritative; manual entry introduces error
- **Implementation**: POST /api/assessment/monthly endpoint removed; all metrics auto-generated

### Decision: Assessment Immutability

- **Q**: Should users be able to edit assessments after creation?
- **Status**: ✅ DECIDED - Immutable (no edits after generation)
- **Rationale**: Assessments are records of actual data on specific dates; changing them breaks audit trail
- **Implementation**: Delete + regenerate is only modification option

### Decision: CSP Data Source

- **Q**: Where should CSP submission count come from?
- **Status**: ✅ DECIDED - Club.aspx CSV (cached by backend)
- **Rationale**: Real data from Toastmasters dashboards; no manual entry needed
- **Implementation**: CspExtractorService parses club records to count CSP achievements

---

## References

- **Existing Services**: `backend/src/services/DistrictCacheManager.ts`
- **Assessment Module**: `backend/src/modules/assessment/`
- **Cache Data**: `backend/cache/districts_*.json`
- **Assessment Types**: `backend/src/modules/assessment/types/assessment.ts`
